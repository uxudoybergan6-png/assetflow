/**
 * P1 #19 (P6 §4 / P7 §8) — QAYTA TIKLANADIGAN BULK-INGEST ISHCHISI.
 *
 * Nega: 5000 klip ≈ 42–83 soat ketma-ket ffmpeg (FFMPEG_MAX_CONCURRENCY=1). Ingest
 * HTTP so'rov yo'lida bo'lsa Cloud Run 600s timeout beradi. Yechim: POST /ingest
 * incoming kalitlarni `IngestJob` navbatiga QO'SHADI va darhol qaytadi; bu modul esa
 * navbatni birma-bir claim qilib fon rejimida ishlaydi.
 *
 * Xususiyatlar (talab):
 *  - navbat (IngestJob jadvali, restart-safe);
 *  - har element uchun retry (attempts < maxAttempts, faqat transient xatolarda);
 *  - progress (status maydonlari — klient batchId bilan pollaydi);
 *  - restartdan keyin davom etish (stuck 'processing' → qayta 'queued');
 *  - foydalanuvchi trafigi bilan CPU uchun RAQOBATLASHMASIN — ideal holatda alohida
 *    Cloud Run job (scripts/ingest-worker.ts), yoki API ichida INLINE poller
 *    (INGEST_WORKER_INLINE, default yoniq — kichik deploylarda ishlashi uchun).
 *
 * Claim atomik: `UPDATE ... WHERE id=(SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)` —
 * bir nechta ishchi (inline poller × N instance + alohida job) xavfsiz raqobatlashadi
 * (bir job ikki marta olinmaydi).
 */
import { prisma } from "@creative-tools/database";
import { captureException } from "./sentry.js";

/** Ingest natijasi (zip yoki raw asset uchun umumiy). retryable = transient xato
 *  (storage/tarmoq) → worker qayta urinishi mumkin. false = doimiy rad (skan/format). */
export type IngestItemResult = {
  key: string;
  ok: boolean;
  status: "created" | "duplicate" | "failed";
  id?: string;
  reason?: string;
  duplicateOf?: string;
  /** failed bo'lsa — transient (retry) yoki doimiy (permanent). Default: false (permanent). */
  retryable?: boolean;
};

/** Navbatdagi bitta ishni bajaruvchi. contributor.ts ro'yxatga oladi (sirkular import yo'q). */
export type IngestJobRow = {
  id: string;
  contributorId: string;
  sourceType: string;
  key: string;
  fileName: string;
  kind: string | null;
  templateType: string | null;
  stockType: string | null;
  templateApp: string | null;
  contentType: string | null;
  rightsAcceptedAt: Date | null;
  rightsTermsVersion: string | null;
};
export type IngestProcessor = (job: IngestJobRow) => Promise<IngestItemResult>;

let processor: IngestProcessor | null = null;
/** contributor.ts modul yuklanganda chaqiradi — ingestOneZip/ingestOneAsset'ni ulaydi. */
export function registerIngestProcessor(fn: IngestProcessor): void {
  processor = fn;
}

// ── Sozlamalar (env) ─────────────────────────────────────────────────────────
const WORKER_CONCURRENCY = intEnv("INGEST_WORKER_CONCURRENCY", 2, 1, 8);
const IDLE_POLL_MS = intEnv("INGEST_WORKER_IDLE_MS", 4000, 500, 60_000);
const STUCK_MINUTES = intEnv("INGEST_WORKER_STUCK_MIN", 15, 2, 240);
const DONE_RETENTION_DAYS = intEnv("INGEST_JOB_RETENTION_DAYS", 14, 1, 180);

function intEnv(name: string, def: number, min: number, max: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v)) return def;
  return Math.min(Math.max(Math.floor(v), min), max);
}

const TERMINAL = new Set(["done", "duplicate", "failed"]);

// ── Navbatga qo'shish ──────────────────────────────────────────────────────────
export type EnqueueInput = {
  batchId: string;
  contributorId: string;
  sourceType: "zip" | "asset";
  key: string;
  fileName: string;
  kind?: string | null;
  templateType?: string | null;
  stockType?: string | null;
  templateApp?: string | null;
  contentType?: string | null;
  rightsAcceptedAt?: Date | null;
  rightsTermsVersion?: string | null;
};

/** Partiyani navbatga qo'shadi (bitta transaction). Qaytadi: yaratilgan job id'lar. */
export async function enqueueIngestJobs(items: EnqueueInput[]): Promise<{ jobIds: string[] }> {
  if (!items.length) return { jobIds: [] };
  const created = await prisma.$transaction(
    items.map((it) =>
      prisma.ingestJob.create({
        data: {
          batchId: it.batchId,
          contributorId: it.contributorId,
          sourceType: it.sourceType,
          key: it.key,
          fileName: it.fileName,
          kind: it.kind ?? null,
          templateType: it.templateType ?? null,
          stockType: it.stockType ?? null,
          templateApp: it.templateApp ?? null,
          contentType: it.contentType ?? null,
          rightsAcceptedAt: it.rightsAcceptedAt ?? null,
          rightsTermsVersion: it.rightsTermsVersion ?? null,
        },
        select: { id: true },
      })
    )
  );
  return { jobIds: created.map((c) => c.id) };
}

// ── Progress (klient polling) ──────────────────────────────────────────────────
export type BatchProgressItem = {
  id: string;
  key: string;
  fileName: string;
  status: string;
  attempts: number;
  lastError: string | null;
  resultTemplateId: string | null;
  sourceType: string;
};
export async function getBatchProgress(
  batchId: string,
  contributorId?: string
): Promise<{
  items: BatchProgressItem[];
  counts: Record<string, number>;
  total: number;
  done: boolean;
}> {
  const rows = await prisma.ingestJob.findMany({
    where: { batchId, ...(contributorId ? { contributorId } : {}) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      key: true,
      fileName: true,
      status: true,
      attempts: true,
      lastError: true,
      resultTemplateId: true,
      sourceType: true,
    },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const done = rows.length > 0 && rows.every((r) => TERMINAL.has(r.status));
  return { items: rows, counts, total: rows.length, done };
}

// ── Claim / reclaim / process ──────────────────────────────────────────────────

/** Restart-safe: uzoq 'processing' qolgan (ishchi o'lgan/qayta yuklangan) joblarni
 *  qayta navbatga qo'yadi (attempts limiti oshsa — failed). */
async function reclaimStuck(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "IngestJob"
         SET "status" = CASE WHEN "attempts" >= "maxAttempts" THEN 'failed' ELSE 'queued' END,
             "lastError" = LEFT(COALESCE("lastError", '') || ' [reclaimed: worker restart/stall]', 800),
             "finishedAt" = CASE WHEN "attempts" >= "maxAttempts" THEN now() ELSE "finishedAt" END,
             "claimedAt" = NULL,
             "updatedAt" = now()
       WHERE "status" = 'processing'
         AND "claimedAt" < now() - ($1 || ' minutes')::interval`,
      String(STUCK_MINUTES)
    );
  } catch (e) {
    console.warn("[ingest-worker] reclaimStuck xato:", e);
  }
}

/** Bitta 'queued' jobni atomik claim qiladi (FOR UPDATE SKIP LOCKED) — id qaytadi yoki null. */
async function claimNext(): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "IngestJob"
        SET "status" = 'processing',
            "claimedAt" = now(),
            "startedAt" = COALESCE("startedAt", now()),
            "attempts" = "attempts" + 1,
            "updatedAt" = now()
      WHERE "id" = (
        SELECT "id" FROM "IngestJob"
         WHERE "status" = 'queued'
         ORDER BY "createdAt" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING "id"`
  );
  return rows[0]?.id ?? null;
}

/** Claim qilingan jobni ishlaydi — natijaga qarab terminal status yoki retry. */
async function runClaimedJob(id: string): Promise<void> {
  const job = await prisma.ingestJob.findUnique({ where: { id } });
  if (!job) return;
  if (!processor) {
    // Ishlab chiquvchi ro'yxatga olinmagan (kutilmagan) — qayta navbatga qo'yamiz.
    await prisma.ingestJob.update({
      where: { id },
      data: { status: "queued", claimedAt: null, lastError: "No ingest processor registered" },
    });
    return;
  }

  let result: IngestItemResult;
  try {
    result = await processor({
      id: job.id,
      contributorId: job.contributorId,
      sourceType: job.sourceType,
      key: job.key,
      fileName: job.fileName,
      kind: job.kind,
      templateType: job.templateType,
      stockType: job.stockType,
      templateApp: job.templateApp,
      contentType: job.contentType,
      rightsAcceptedAt: job.rightsAcceptedAt,
      rightsTermsVersion: job.rightsTermsVersion,
    });
  } catch (e) {
    // Kutilmagan throw = transient deb hisoblaymiz (retry qilinadi).
    captureException(e, { area: "ingest-worker", jobId: id, key: job.key });
    result = {
      key: job.key,
      ok: false,
      status: "failed",
      reason: e instanceof Error ? e.message : "Unexpected worker error",
      retryable: true,
    };
  }

  if (result.status === "created") {
    await prisma.ingestJob.update({
      where: { id },
      data: {
        status: "done",
        resultTemplateId: result.id ?? null,
        lastError: null,
        finishedAt: new Date(),
      },
    });
    return;
  }
  if (result.status === "duplicate") {
    await prisma.ingestJob.update({
      where: { id },
      data: {
        status: "duplicate",
        resultTemplateId: result.duplicateOf ?? null,
        lastError: result.reason ?? null,
        finishedAt: new Date(),
      },
    });
    return;
  }

  // failed — transient bo'lsa va limit oshmagan bo'lsa qayta navbatga.
  const canRetry = result.retryable === true && job.attempts < job.maxAttempts;
  await prisma.ingestJob.update({
    where: { id },
    data: canRetry
      ? { status: "queued", claimedAt: null, lastError: result.reason ?? "Transient failure" }
      : { status: "failed", claimedAt: null, lastError: result.reason ?? "Failed", finishedAt: new Date() },
  });
}

/** Bir sikl: reclaim + WORKER_CONCURRENCY tagacha job claim qilib parallel ishlaydi.
 *  Qaytadi: shu siklda nechta job ishlangani (0 = navbat bo'sh). */
export async function ingestWorkerTick(): Promise<number> {
  await reclaimStuck();
  const ids: string[] = [];
  for (let i = 0; i < WORKER_CONCURRENCY; i++) {
    const id = await claimNext();
    if (!id) break;
    ids.push(id);
  }
  if (!ids.length) return 0;
  await Promise.all(ids.map((id) => runClaimedJob(id).catch((e) => console.error("[ingest-worker] job xato:", id, e))));
  return ids.length;
}

/** Eski terminal joblarni tozalaydi (retention) — navbat cheksiz o'smasin. */
async function pruneOldJobs(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "IngestJob"
        WHERE "status" IN ('done','duplicate','failed')
          AND "finishedAt" IS NOT NULL
          AND "finishedAt" < now() - ($1 || ' days')::interval`,
      String(DONE_RETENTION_DAYS)
    );
  } catch (e) {
    console.warn("[ingest-worker] pruneOldJobs xato:", e);
  }
}

let looping = false;
let stopRequested = false;

/** Uzluksiz poller: navbat bo'sh bo'lsa IDLE_POLL_MS kutadi, aks holda darhol davom
 *  etadi. Inline (API ichida) yoki standalone (Cloud Run job) rejimida ishlaydi. */
export async function runIngestWorkerLoop(): Promise<void> {
  if (looping) return;
  looping = true;
  stopRequested = false;
  console.log(
    `[ingest-worker] loop boshlandi (concurrency=${WORKER_CONCURRENCY}, idle=${IDLE_POLL_MS}ms, stuck=${STUCK_MINUTES}min)`
  );
  let sincePrune = 0;
  while (!stopRequested) {
    let processed = 0;
    try {
      processed = await ingestWorkerTick();
    } catch (e) {
      console.error("[ingest-worker] tick xato:", e);
      captureException(e, { area: "ingest-worker-loop" });
    }
    // Har ~50 bo'sh siklda bir marta retention tozalash (arzon).
    if (processed === 0) {
      if (++sincePrune >= 50) {
        sincePrune = 0;
        await pruneOldJobs();
      }
      await sleep(IDLE_POLL_MS);
    } else {
      sincePrune = 0;
      // Ish bor — nafas olish uchun qisqa pauza (DB'ni bosmaslik, ffmpeg semafori baribir seriyalaydi).
      await sleep(50);
    }
  }
  looping = false;
  console.log("[ingest-worker] loop to'xtadi");
}

export function stopIngestWorkerLoop(): void {
  stopRequested = true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
