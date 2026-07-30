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
 *  - foydalanuvchi trafigi bilan CPU uchun RAQOBATLASHMASIN — alohida Cloud Run job
 *    (scripts/ingest-worker.ts). API ichidagi INLINE poller #64'dan keyin default
 *    O'CHIQ (INGEST_WORKER_INLINE=true bilan yoqiladi — lokal/bitta-servis deploy).
 *
 * Claim atomik: `UPDATE ... WHERE id=(SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)` —
 * bir nechta ishchi (inline poller × N instance + alohida job) xavfsiz raqobatlashadi
 * (bir job ikki marta olinmaydi).
 */
import { prisma } from "@creative-tools/database";
import { captureException } from "./sentry.js";
import { deleteS3Objects, isS3Configured, listS3ObjectsWithMeta } from "./s3.js";

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
export const DONE_RETENTION_DAYS = intEnv("INGEST_JOB_RETENTION_DAYS", 14, 1, 180);
/** #50 — shu yoshdan katta `incoming/` obyekt yetim deb hisoblanadi (navbatda bo'lmasa). */
export const INCOMING_RETENTION_DAYS = intEnv("INGEST_INCOMING_RETENTION_DAYS", 7, 1, 90);

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

/**
 * Bitta 'queued' jobni atomik claim qiladi (FOR UPDATE SKIP LOCKED).
 * Qaytadi: `{ id, attempts }` — `attempts` FENCING TOKEN vazifasini bajaradi (#51).
 */
async function claimNext(): Promise<{ id: string; attempts: number } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; attempts: number }>>(
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
      RETURNING "id", "attempts"`
  );
  const row = rows[0];
  return row ? { id: row.id, attempts: Number(row.attempts) } : null;
}

/**
 * #51 (T3.4) — FENCING. `reclaimStuck` faqat TAXMIN qiladi ("15 daqiqadan beri
 * jim = o'lgan"): birinchi ishchi hali tirik bo'lishi mumkin (uzoq ffmpeg, tarmoq
 * osilishi). Ilgari u qaytib kelib jobni terminal statusga yozardi — reclaim
 * qilingan/qayta claim qilingan ishning natijasini USTIGA yozib. Endi har yozuv
 * `(status='processing' AND attempts=<claim paytidagi qiymat>)` sharti bilan:
 * job reclaim qilingan (status→queued) yoki qayta claim qilingan (attempts+1)
 * bo'lsa eskirgan ishchining yozuvi 0 qatorga tegadi va E'TIBORSIZ qoladi.
 */
async function fencedUpdate(
  id: string,
  attempts: number,
  data: Record<string, unknown>
): Promise<boolean> {
  const r = await prisma.ingestJob.updateMany({
    where: { id, status: "processing", attempts },
    data: data as never,
  });
  if (r.count === 0) {
    console.warn(
      `[ingest-worker] fencing: ${id} natijasi e'tiborsiz qoldirildi (job qayta claim qilingan)`
    );
  }
  return r.count > 0;
}

/** Claim qilingan jobni ishlaydi — natijaga qarab terminal status yoki retry. */
async function runClaimedJob(id: string, attempts: number): Promise<void> {
  const job = await prisma.ingestJob.findUnique({ where: { id } });
  if (!job) return;
  if (!processor) {
    // Ishlab chiquvchi ro'yxatga olinmagan (kutilmagan) — qayta navbatga qo'yamiz.
    await fencedUpdate(id, attempts, {
      status: "queued",
      claimedAt: null,
      lastError: "No ingest processor registered",
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
    await fencedUpdate(id, attempts, {
      status: "done",
      resultTemplateId: result.id ?? null,
      lastError: null,
      finishedAt: new Date(),
    });
    return;
  }
  if (result.status === "duplicate") {
    await fencedUpdate(id, attempts, {
      status: "duplicate",
      resultTemplateId: result.duplicateOf ?? null,
      lastError: result.reason ?? null,
      finishedAt: new Date(),
    });
    return;
  }

  // failed — transient bo'lsa va limit oshmagan bo'lsa qayta navbatga.
  const canRetry = result.retryable === true && job.attempts < job.maxAttempts;
  const applied = await fencedUpdate(
    id,
    attempts,
    canRetry
      ? { status: "queued", claimedAt: null, lastError: result.reason ?? "Transient failure" }
      : {
          status: "failed",
          claimedAt: null,
          lastError: result.reason ?? "Failed",
          finishedAt: new Date(),
        }
  );
  // #50 (T3.4) — retry imkoni tugadi: manba fayl `incoming/` da YETIM qolardi
  // (muvaffaqiyat va doimiy rad yo'llari uni o'chiradi, bu yo'l esa o'chirmasdi) →
  // contributor kvotasini yeb, bulutda abadiy turardi. Endi job yakunida o'chiriladi.
  if (applied && !canRetry) {
    await deleteIncomingSource(job.key);
  }
}

/** `incoming/` prefiksidagi manba faylni o'chiradi (boshqa prefikslarga TEGMAYDI). */
async function deleteIncomingSource(key: string): Promise<void> {
  if (!key || !key.startsWith("incoming/")) return;
  try {
    await deleteS3Objects([key]);
    console.log(`[ingest-worker] yetim incoming fayl o'chirildi: ${key}`);
  } catch (e) {
    console.warn(`[ingest-worker] incoming o'chirilmadi (${key}):`, e);
  }
}

/** Bir sikl: reclaim + WORKER_CONCURRENCY tagacha job claim qilib parallel ishlaydi.
 *  Qaytadi: shu siklda nechta job ishlangani (0 = navbat bo'sh). */
export async function ingestWorkerTick(): Promise<number> {
  await reclaimStuck();
  const claimed: Array<{ id: string; attempts: number }> = [];
  for (let i = 0; i < WORKER_CONCURRENCY; i++) {
    const c = await claimNext();
    if (!c) break;
    claimed.push(c);
  }
  if (!claimed.length) return 0;
  await Promise.all(
    claimed.map((c) =>
      runClaimedJob(c.id, c.attempts).catch((e) =>
        console.error("[ingest-worker] job xato:", c.id, e)
      )
    )
  );
  return claimed.length;
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

/**
 * #50 (T3.4) — YETIM `incoming/` fayllarini tozalaydi. Job yakunidagi o'chirish
 * (deleteIncomingSource) faqat navbatga TUSHGAN fayllarni qamraydi; presigned PUT
 * bilan yuklanib `/ingest` chaqirilmagan yoki job qatori retention'da o'chib ketgan
 * fayllar bulutda abadiy qolardi. Bu supurish faqat ESKI (retention'dan katta)
 * obyektlarni ko'radi — hozir yuklanayotgan fayl hech qachon tegilmaydi.
 */
async function pruneOrphanIncoming(): Promise<number> {
  if (!isS3Configured()) return 0;
  try {
    const cutoff = Date.now() - INCOMING_RETENTION_DAYS * 86_400_000;
    const { objects, truncated } = await listS3ObjectsWithMeta("incoming/", 5000);
    const old = objects.filter((o) => (o.lastModified?.getTime() ?? Date.now()) < cutoff);
    if (!old.length) return 0;
    // Navbatda hali kutayotgan (queued/processing) kalitlar TEGILMAYDI.
    const active = await prisma.ingestJob.findMany({
      where: { key: { in: old.map((o) => o.key) }, status: { in: ["queued", "processing"] } },
      select: { key: true },
    });
    const activeKeys = new Set(active.map((a) => a.key));
    const stale = old.filter((o) => !activeKeys.has(o.key)).map((o) => o.key);
    if (!stale.length) return 0;
    for (let i = 0; i < stale.length; i += 1000) {
      await deleteS3Objects(stale.slice(i, i + 1000));
    }
    console.log(
      `[ingest-worker] yetim incoming tozalandi: ${stale.length} fayl (>${INCOMING_RETENTION_DAYS} kun)` +
        (truncated ? " — ro'yxat kesildi, keyingi passda davom etadi" : "")
    );
    return stale.length;
  } catch (e) {
    console.warn("[ingest-worker] pruneOrphanIncoming xato:", e);
    return 0;
  }
}

/** Retention: eski job qatorlari + yetim `incoming/` obyektlari. RUN_ONCE rejimida
 *  ham chaqiriladi (u yerda bo'sh-sikl hisoblagichi yo'q). */
export async function runIngestRetention(): Promise<void> {
  await pruneOldJobs();
  await pruneOrphanIncoming();
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
        await runIngestRetention();
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
