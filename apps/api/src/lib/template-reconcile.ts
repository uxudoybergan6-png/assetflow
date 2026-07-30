import { prisma, Prisma, TemplateReviewStatus } from "@creative-tools/database";
import { transcodePreviewInBackground } from "./transcode-preview.js";
import { embedTemplate } from "./ai/embed-templates.js";
import { isAiConfigured } from "./ai/workers-ai.js";
import { captureException } from "./sentry.js";
import { reconcileMissingAssetKeys } from "./asset-state.js";

/**
 * FAZA 3 (B) — qotib qolgan shablon-fon ishlarini tiklovchi reconciler'lar
 * (gen-processor.ts'dagi reconcileStuckGenerations + resume timer naqshi).
 *
 * 1) transcode: transcodePreviewInBackground fire-and-forget — Cloud Run restart
 *    fon jarayonni o'ldirsa previewTranscodeStatus "pending"da qoladi va preview
 *    hech qachon optimallashmaydi. Cutoff'dan oshgan "pending" → qayta ishga tushiriladi.
 * 2) embedding: embedTemplateInBackground fire-and-forget, retry yo'q — approve
 *    paytida AI yiqilsa APPROVED+published shablon embedding'siz (semantik qidiruvda
 *    ko'rinmas) qoladi. Yetishmayotganlar bounded partiyada qayta embed qilinadi.
 *
 * Ikkalasi ham best-effort: xato keyingi pass'da qayta uriniladi, hech narsani bloklamaydi.
 */

/** Shu vaqtdan oshgan "pending" transcode qotib qolgan hisoblanadi (katta video ham sig'sin). */
const TRANSCODE_STUCK_MS = 30 * 60 * 1000;
/** Bundan oshgan "pending" taslim bo'ladi ("failed"). TRANSCODE_STUCK_MS'dan KATTA
 *  bo'lishi SHART — aks holda qayta urinish hech qachon navbatga tushmaydi. */
const TRANSCODE_FAIL_MS = 45 * 60 * 1000;
/** Bir pass'da qayta ishga tushiriladigan maksimal transcode (ffmpeg semaphore baribir navbatlaydi). */
const TRANSCODE_BATCH = 10;
/** Bir pass'da qayta embed qilinadigan maksimal shablon (AI chaqiruvlari ketma-ket). */
const EMBED_BATCH = 5;
const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;

/** Cutoff'dan oshgan "pending" transcode'larni qayta ishga tushiradi. Qaytaradi: nechta re-run. */
export async function reconcileStuckTranscodes(): Promise<number> {
  const cutoff = new Date(Date.now() - TRANSCODE_STUCK_MS);
  const stuck = await prisma.contributorTemplate.findMany({
    where: { previewTranscodeStatus: "pending", updatedAt: { lt: cutoff } },
    select: { id: true },
    take: TRANSCODE_BATCH,
    orderBy: { updatedAt: "asc" },
  });
  for (const t of stuck) {
    // "Touch" — updatedAt yangilanadi, shu bois uzoq transcode hali ishlayotganda
    // keyingi pass'lar uni qayta-qayta enqueue qilmaydi (cutoff yana boshidan sanaladi).
    await prisma.contributorTemplate.update({
      where: { id: t.id },
      data: { previewTranscodeStatus: "pending" },
    });
    console.log(`[template-reconcile] qotib qolgan transcode qayta ishga tushdi: ${t.id}`);
    transcodePreviewInBackground(t.id);
  }
  return stuck.length;
}

/**
 * #58 (T5.3) — qotib qolgan "pending" transcode'ni halol "failed" qiladi.
 * Ilgari HAR `GET /api/contributor/templates` da `updateMany` bilan ishlardi (listing
 * TTFB'ga kiradigan to'liq jadval skani + yozuv). Endi shu cron pass'da, va faqat
 * `reconcileStuckTranscodes()` dan KEYIN — ya'ni har qotgan qator avval bitta qayta
 * urinish oladi (30 daq), shundan keyingina (45 daq) "failed" deb belgilanadi.
 * Original preview baribir xizmat qilinadi; contributor preview'ni qayta yuklab retry qiladi.
 * Indeks: `ct_transcode_pending_upd_idx` (qisman — faqat 'pending' qatorlar).
 */
export async function sweepStaleTranscodes(): Promise<number> {
  const cutoff = new Date(Date.now() - TRANSCODE_FAIL_MS);
  const r = await prisma.contributorTemplate.updateMany({
    where: { previewTranscodeStatus: "pending", updatedAt: { lt: cutoff } },
    data: {
      previewTranscodeStatus: "failed",
      previewTranscodeError:
        "Background transcode stalled — original preview is served; re-upload the preview to retry",
    },
  });
  return r.count;
}

/** APPROVED+published, lekin embedding'i yo'q shablonlarni bounded partiyada qayta embed qiladi. */
export async function reconcileMissingEmbeddings(): Promise<number> {
  if (!isAiConfigured()) return 0;
  const rows = await prisma.contributorTemplate.findMany({
    where: {
      reviewStatus: TemplateReviewStatus.APPROVED,
      published: true,
      embedding: { equals: Prisma.AnyNull },
    },
    select: { id: true, name: true },
    take: EMBED_BATCH,
    orderBy: { updatedAt: "asc" },
  });
  let done = 0;
  for (const r of rows) {
    const res = await embedTemplate(r.id);
    if (res.ok) {
      done++;
      console.log(`[template-reconcile] embedding tiklandi: ${r.id} (${r.name})`);
    } else {
      console.warn(`[template-reconcile] embedding yiqildi (${r.id}): ${res.reason}`);
    }
  }
  return done;
}

async function runReconcilePass(): Promise<void> {
  try {
    // #19 (T5.1) — o'qish yo'li endi S3 LIST qilmaydi; kesh yo'q qatorlar shu
    // yerda (va fon navbatida) to'ldiriladi. Katta katalog uchun bir martalik
    // `backfill-asset-keys` skripti tezroq.
    const filled = await reconcileMissingAssetKeys();
    if (filled) console.log(`[template-reconcile] asset kesh to'ldirildi: ${filled}`);
  } catch (e) {
    console.error("[template-reconcile] asset-kesh pass xato:", e);
    captureException(e, { area: "template-reconcile.assetKeys" });
  }
  try {
    await reconcileStuckTranscodes();
    // Tartib MUHIM: avval qayta urinish (30 daq), keyin taslim (45 daq).
    const failed = await sweepStaleTranscodes();
    if (failed) console.log(`[template-reconcile] stale transcode "failed" qilindi: ${failed}`);
  } catch (e) {
    console.error("[template-reconcile] transcode pass xato:", e);
    captureException(e, { area: "template-reconcile.transcode" });
  }
  try {
    await reconcileMissingEmbeddings();
  } catch (e) {
    console.error("[template-reconcile] embedding pass xato:", e);
    captureException(e, { area: "template-reconcile.embed" });
  }
}

/** Startup pass (kechiktirilgan) + davriy timer — index.ts listen callback'ida chaqiriladi. */
export function startTemplateReconcilers(): void {
  setTimeout(() => void runReconcilePass(), 15_000);
  const timer = setInterval(() => void runReconcilePass(), RECONCILE_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}
