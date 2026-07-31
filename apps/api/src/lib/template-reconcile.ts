import { prisma, Prisma, TemplateReviewStatus } from "@creative-tools/database";
import { transcodePreviewInBackground } from "./transcode-preview.js";
import { embedTemplate } from "./ai/embed-templates.js";
import { isAiConfigured } from "./ai/workers-ai.js";
import { captureException } from "./sentry.js";
import { reconcileMissingAssetKeys } from "./asset-state.js";
import { startAdaptiveTimer } from "./idle-timer.js"; // D0 — idle-aware fon jadvali

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
/** #110 (I8) — embedding ijarasi: shundan yaqinroq tegilgan qator o'tkazib yuboriladi
 *  (approve paytidagi asosiy embed yo'li yoki boshqa instansning passi hali ishlayotgan
 *  bo'lishi mumkin). Pass intervalidan biroz kichik — har pass'da yangi qator ko'radi. */
const EMBED_STUCK_MS = 5 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;
/** D0 — ish topilmagan ketma-ket passlarda kechikish shu qiymatgacha ikkilanadi (Neon uxlasin). */
const RECONCILE_IDLE_MAX_MS = Math.max(
  RECONCILE_INTERVAL_MS,
  Number(process.env.RECONCILE_IDLE_MAX_MS) || 60 * 60 * 1000,
);

/** Cutoff'dan oshgan "pending" transcode'larni qayta ishga tushiradi. Qaytaradi: nechta re-run. */
export async function reconcileStuckTranscodes(): Promise<number> {
  const cutoff = new Date(Date.now() - TRANSCODE_STUCK_MS);
  const stuck = await prisma.contributorTemplate.findMany({
    where: { previewTranscodeStatus: "pending", updatedAt: { lt: cutoff } },
    select: { id: true },
    take: TRANSCODE_BATCH,
    orderBy: { updatedAt: "asc" },
  });
  let started = 0;
  for (const t of stuck) {
    // #110 (I8) — ATOMIK EGALLASH (find-then-touch EMAS). Ilgari topilgan qatorni
    // shartsiz `update` qilardi: max-instances 10 da har instansning 10 daqiqalik
    // pass'i AYNAN o'sha qatorni topib, hammasi ffmpeg transcode'ini qayta ishga
    // tushirardi (bir xil ishning 10 nusxasi, CPU va vaqt behuda). Endi "touch"
    // `updateMany` + ASL shart (`pending` va `updatedAt < cutoff`) bilan bajariladi:
    // birinchi instans updatedAt'ni yangilaydi → qolganlarida count=0 → o'tkazib yuboriladi.
    const claimed = await prisma.contributorTemplate.updateMany({
      where: { id: t.id, previewTranscodeStatus: "pending", updatedAt: { lt: cutoff } },
      data: { previewTranscodeStatus: "pending" },
    });
    if (claimed.count === 0) continue; // boshqa instans (yoki pass) allaqachon oldi
    started++;
    console.log(`[template-reconcile] qotib qolgan transcode qayta ishga tushdi: ${t.id}`);
    transcodePreviewInBackground(t.id);
  }
  return started;
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
  // #110 (I8) — embedding uchun ham ijara: yaqinda tegilgan qator (approve paytidagi
  // asosiy yo'l yoki boshqa instansning shu passi) qayta embed qilinmaydi.
  const cutoff = new Date(Date.now() - EMBED_STUCK_MS);
  const rows = await prisma.contributorTemplate.findMany({
    where: {
      reviewStatus: TemplateReviewStatus.APPROVED,
      published: true,
      embedding: { equals: Prisma.AnyNull },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, name: true },
    take: EMBED_BATCH,
    orderBy: { updatedAt: "asc" },
  });
  let done = 0;
  for (const r of rows) {
    // Atomik egallash — `published: true` shu yerda no-op qiymat (where sharti bilan bir xil),
    // maqsad `updatedAt`ni yangilash: boshqa instans shu qatorni ijara muddatigacha olmaydi.
    const claimed = await prisma.contributorTemplate.updateMany({
      where: {
        id: r.id,
        published: true,
        embedding: { equals: Prisma.AnyNull },
        updatedAt: { lt: cutoff },
      },
      data: { published: true },
    });
    if (claimed.count === 0) continue;
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

/** Pass ish topdimi (D0 idle-backoff signali). */
async function runReconcilePass(): Promise<boolean> {
  let hadWork = false;
  try {
    // #19 (T5.1) — o'qish yo'li endi S3 LIST qilmaydi; kesh yo'q qatorlar shu
    // yerda (va fon navbatida) to'ldiriladi. Katta katalog uchun bir martalik
    // `backfill-asset-keys` skripti tezroq.
    const filled = await reconcileMissingAssetKeys();
    if (filled) console.log(`[template-reconcile] asset kesh to'ldirildi: ${filled}`);
    if (filled) hadWork = true;
  } catch (e) {
    console.error("[template-reconcile] asset-kesh pass xato:", e);
    captureException(e, { area: "template-reconcile.assetKeys" });
  }
  try {
    const restarted = await reconcileStuckTranscodes();
    // Tartib MUHIM: avval qayta urinish (30 daq), keyin taslim (45 daq).
    const failed = await sweepStaleTranscodes();
    if (failed) console.log(`[template-reconcile] stale transcode "failed" qilindi: ${failed}`);
    if (restarted || failed) hadWork = true;
  } catch (e) {
    console.error("[template-reconcile] transcode pass xato:", e);
    captureException(e, { area: "template-reconcile.transcode" });
  }
  try {
    const embedded = await reconcileMissingEmbeddings();
    if (embedded) hadWork = true;
  } catch (e) {
    console.error("[template-reconcile] embedding pass xato:", e);
    captureException(e, { area: "template-reconcile.embed" });
  }
  return hadWork;
}

/**
 * Startup pass (kechiktirilgan) + davriy IDLE-AWARE jadval — index.ts listen callback'ida chaqiriladi.
 * D0 (2026-07-31): ilgari qat'iy 10 daqiqalik `setInterval` edi — bo'sh baza ham har 10 daqiqada
 * uyg'onardi va Neon compute-kvotasi oy oxirida tugardi (P0 insident). Endi pass ish topmasa
 * kechikish `RECONCILE_IDLE_MAX_MS`gacha ikkilanadi; ish topilsa darhol 10 daqiqaga qaytadi.
 */
export function startTemplateReconcilers(): void {
  startAdaptiveTimer({
    name: "template-reconcile",
    baseMs: RECONCILE_INTERVAL_MS,
    maxMs: RECONCILE_IDLE_MAX_MS,
    firstDelayMs: 15_000,
    task: runReconcilePass,
  });
}
