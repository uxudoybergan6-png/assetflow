import { prisma } from "@creative-tools/database";
import { getS3ObjectMeta, isS3Configured } from "./s3.js";

/**
 * PROBLEM 7 — "Storage (AI results)" noto'g'ri (kam) ko'rsatilishi.
 *
 * Ildiz sabab: `GenAsset.sizeBytes` ustuni 2026-07-05 (migration
 * 20260705150000_genasset_sizebytes) da qo'shilgan — undan OLDIN yaratilgan
 * assetlarda sizeBytes = null bo'lib, kvota yig'indisida 0 deb hisoblanadi
 * (storage-quota.ts getUserUsedBytes). Yangi yozuvlar persist()'da to'g'ri
 * yoziladi; bu modul ESKI qatorlarni haqiqiy obyekt hajmi bilan to'ldiradi.
 *
 * Idempotent: faqat sizeBytes null/0 qatorlar tanlanadi, yozilgach qayta
 * tanlanmaydi. Kredit/billing'ga ALOQASIZ (money-zone tegilmaydi) — faqat
 * storage hisobi ustuni yangilanadi.
 */

/** data-URI (base64) dan haqiqiy bayt hajmini baholaydi (obyekt storage'da yo'q — dev/demo qatorlar). */
function dataUriBytes(url: string | null | undefined): number | null {
  if (!url || !url.startsWith("data:")) return null;
  const i = url.indexOf("base64,");
  if (i < 0) return null;
  const b64len = url.length - i - "base64,".length;
  if (b64len <= 0) return null;
  return Math.floor((b64len * 3) / 4);
}

/** Chegaralangan parallel HeadObject (gen-processor mapLimit naqshi, kichik lokal nusxa). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return results;
}

export type SizeBytesDiagnosis = {
  genAssets: Array<{ type: number; total: number; nullOrZero: number; backfillable: number; summedBytes: number }>;
  savedReferences: { total: number; nullOrZero: number; backfillable: number; summedBytes: number };
};

/** Faqat o'qish — sizeBytes holati bo'yicha hisobot (tur kesimida). */
export async function diagnoseSizeBytes(): Promise<SizeBytesDiagnosis> {
  const rows = await prisma.$queryRaw<
    Array<{ type: number; total: bigint; null_or_zero: bigint; backfillable: bigint; summed: bigint }>
  >`SELECT "type",
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE "sizeBytes" IS NULL OR "sizeBytes" = 0) AS null_or_zero,
       COUNT(*) FILTER (WHERE ("sizeBytes" IS NULL OR "sizeBytes" = 0)
                          AND ("resultKey" IS NOT NULL OR "url" LIKE 'data:%')) AS backfillable,
       COALESCE(SUM("sizeBytes"), 0) AS summed
     FROM "GenAsset" GROUP BY "type" ORDER BY "type"`;
  const refs = await prisma.$queryRaw<
    Array<{ total: bigint; null_or_zero: bigint; backfillable: bigint; summed: bigint }>
  >`SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE "sizeBytes" IS NULL OR "sizeBytes" = 0) AS null_or_zero,
       COUNT(*) FILTER (WHERE ("sizeBytes" IS NULL OR "sizeBytes" = 0)
                          AND ("resultKey" IS NOT NULL OR "url" LIKE 'data:%')) AS backfillable,
       COALESCE(SUM("sizeBytes"), 0) AS summed
     FROM "SavedReference"`;
  return {
    genAssets: rows.map((r) => ({
      type: Number(r.type),
      total: Number(r.total),
      nullOrZero: Number(r.null_or_zero),
      backfillable: Number(r.backfillable),
      summedBytes: Number(r.summed),
    })),
    savedReferences: {
      total: Number(refs[0]?.total ?? 0),
      nullOrZero: Number(refs[0]?.null_or_zero ?? 0),
      backfillable: Number(refs[0]?.backfillable ?? 0),
      summedBytes: Number(refs[0]?.summed ?? 0),
    },
  };
}

export type SizeBytesBackfillResult = {
  dryRun: boolean;
  scanned: number;
  updated: number; // HeadObject'dan haqiqiy hajm yozildi
  estimated: number; // data-URI (obyekt yo'q) — base64'dan baholab yozildi
  missing: number; // obyekt topilmadi/HeadObject xato — null qoldi (keyingi ishga qoladi)
  addedBytes: number;
  remaining: number; // hali null/0 qolgan qatorlar (missing shu yerga kiradi)
};

const HEAD_CONCURRENCY = 8;

/**
 * sizeBytes null/0 qatorlarni haqiqiy hajm bilan to'ldiradi:
 *  - resultKey bor → storage HeadObject (getS3ObjectMeta) haqiqiy ContentLength;
 *  - resultKey yo'q, url data-URI → base64 uzunligidan baholash;
 *  - ikkalasi ham yo'q / HeadObject xato → tegilmaydi (missing hisobida).
 * `limit` — bitta chaqiruvda qayta ishlanadigan maksimal qator (Cloud Run so'rov
 * timeout'iga sig'ishi uchun); qolganini keyingi chaqiruv oladi.
 */
export async function backfillSizeBytes(opts?: { limit?: number; dryRun?: boolean }): Promise<SizeBytesBackfillResult> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 500, 5000));
  const dryRun = opts?.dryRun ?? false;
  const nullOrZero = { OR: [{ sizeBytes: null }, { sizeBytes: 0 }] };

  let scanned = 0;
  let updated = 0;
  let estimated = 0;
  let missing = 0;
  let addedBytes = 0;

  type Row = { id: string; resultKey: string | null; url: string | null };
  const resolveOne = async (row: Row): Promise<{ bytes: number | null; fromHead: boolean }> => {
    if (row.resultKey && isS3Configured()) {
      const meta = await getS3ObjectMeta(row.resultKey);
      if (meta.sizeBytes != null) return { bytes: meta.sizeBytes, fromHead: true };
      return { bytes: null, fromHead: true };
    }
    return { bytes: dataUriBytes(row.url), fromHead: false };
  };

  const processTable = async (
    fetch: (take: number) => Promise<Row[]>,
    write: (id: string, bytes: number) => Promise<void>
  ): Promise<void> => {
    while (scanned < limit) {
      const batch = await fetch(Math.min(200, limit - scanned));
      if (!batch.length) break;
      const resolved = await mapLimit(batch, HEAD_CONCURRENCY, resolveOne);
      let progressed = 0;
      for (let i = 0; i < batch.length; i++) {
        scanned++;
        const r = resolved[i];
        if (r.bytes == null || r.bytes <= 0) {
          missing++;
          continue;
        }
        if (!dryRun) await write(batch[i].id, r.bytes);
        if (r.fromHead) updated++;
        else estimated++;
        addedBytes += r.bytes;
        progressed++;
      }
      // dryRun'da (yoki hech narsa yozilmasa) where-sharti o'zgarmaydi — keyingi
      // fetch AYNI qatorlarni qaytarib cheksiz sikl bo'lmasin.
      if (dryRun || progressed === 0) break;
    }
  };

  // GenAsset — eng eski birinchi (tarixiy null qatorlar asosiy nishon).
  await processTable(
    (take) =>
      prisma.genAsset.findMany({
        where: nullOrZero,
        select: { id: true, resultKey: true, url: true },
        orderBy: { createdAt: "asc" },
        take,
      }),
    async (id, bytes) => {
      await prisma.genAsset.updateMany({ where: { id, ...nullOrZero }, data: { sizeBytes: bytes } });
    }
  );

  // SavedReference — xuddi shu qoida (kvota yig'indisining ikkinchi qismi).
  await processTable(
    (take) =>
      prisma.savedReference.findMany({
        where: nullOrZero,
        select: { id: true, resultKey: true, url: true },
        orderBy: { createdAt: "asc" },
        take,
      }),
    async (id, bytes) => {
      await prisma.savedReference.updateMany({ where: { id, ...nullOrZero }, data: { sizeBytes: bytes } });
    }
  );

  const [remainA, remainR] = await Promise.all([
    prisma.genAsset.count({ where: nullOrZero }),
    prisma.savedReference.count({ where: nullOrZero }),
  ]);

  return { dryRun, scanned, updated, estimated, missing, addedBytes, remaining: remainA + remainR };
}
