import { prisma, Prisma, TemplateReviewStatus } from "@creative-tools/database";
import { transcodePreviewInBackground } from "./transcode-preview.js";
import { embedTemplate } from "./ai/embed-templates.js";
import { isAiConfigured } from "./ai/workers-ai.js";
import { captureException } from "./sentry.js";

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
    await reconcileStuckTranscodes();
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
