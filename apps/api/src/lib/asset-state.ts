import { prisma, Prisma } from "@creative-tools/database";
import {
  isS3Configured,
  listTemplateS3Keys,
  resolveS3AssetKey,
  s3AssetKeyFromSet,
  s3ObjectExists,
} from "./s3.js";
import type { TemplateAssetKind } from "./template-files.js";

/**
 * FAZA 5 (A2) — shablon S3 asset kalitlari keshi (ContributorTemplate.assetKeysJson).
 * Katalog/admin listing endi har shablon uchun S3'ga chiqmaydi: kalitlar DB'dan
 * o'qiladi. Bu modul YOZISH tomonini boshqaradi — har asset mutatsiyasidan keyin
 * syncTemplateAssetKeys chaqiriladi.
 */

/** DB'dagi assetKeysJson → Set. null/notog'ri shakl = null (chaqiruvchi live List'ga o'tadi). */
export function assetKeySetFromStored(v: unknown): Set<string> | null {
  if (!Array.isArray(v)) return null;
  return new Set(v.filter((x): x is string => typeof x === "string"));
}

/**
 * S3'dagi joriy kalitlarni (templates/{id}/ prefiksi) DB'ga yozadi.
 * `ensure` — hozirgina yozilgan kalitlar: List eventual-consistent bo'lsa ham
 * tushib qolmasin (pack uchun ayniqsa muhim — hasPack gate'ga kiradi).
 * `remove` — hozirgina o'chirilganlar (List hali ko'rsatib turgan bo'lishi mumkin).
 * Yozuv RAW SQL — prisma.update @updatedAt'ni bump qilardi, bu esa katalog
 * tartibi (orderBy updatedAt) va cache-bust versiyasini soxta o'zgartirardi.
 * Xato YUTILADI (asosiy oqim buzilmasin) — sinxronlanmagan holat keyingi
 * o'qishda live List fallback bilan o'zini tuzatadi.
 */
export async function syncTemplateAssetKeys(
  templateId: string,
  opts?: { ensure?: Array<string | null | undefined>; remove?: string[] }
): Promise<Set<string> | null> {
  if (!isS3Configured()) return null;
  try {
    const keys = await listTemplateS3Keys(templateId);
    for (const k of opts?.ensure ?? []) if (k) keys.add(k);
    for (const k of opts?.remove ?? []) keys.delete(k);
    await persistTemplateAssetKeys(templateId, keys);
    return keys;
  } catch (e) {
    console.warn(`[asset-state] sync xato (${templateId}):`, e);
    return null;
  }
}

/** Kalitlar to'plamini DB'ga yozadi (updatedAt'ga tegmasdan). Shablon o'chirilgan bo'lsa jim. */
export async function persistTemplateAssetKeys(
  templateId: string,
  keys: Set<string>
): Promise<void> {
  const json = JSON.stringify([...keys].sort());
  await prisma.$executeRaw(
    Prisma.sql`UPDATE "ContributorTemplate" SET "assetKeysJson" = ${json}::jsonb WHERE "id" = ${templateId}`
  );
}

// ── #19 (T5.1) — o'qish yo'lida S3 LIST YO'Q ────────────────────────────────
// Ilgari keshi bo'sh har bir qator katalog o'qishida jonli ListObjectsV2 + DB
// UPDATE qilardi: 100 qatorli sahifa = 100 LIST + 100 UPDATE (DB pooli 10 ta
// ulanish). Endi o'qish yo'li faqat DB keshini ishlatadi; kesh yo'q qatorlar shu
// navbatga tushadi va FON'da (bounded) to'ldiriladi. Restartga chidamlilik uchun
// reconcileMissingAssetKeys() ham bor (template-reconcile.ts, har 10 daqiqa).

/** Navbat chegarasi — xotira o'smasin (qolganini reconciler oladi). */
const BACKFILL_QUEUE_MAX = 500;
/** Bir vaqtda nechta LIST (S3 rate va DB pooli uchun juda past). */
const BACKFILL_CONCURRENCY = 2;
const BACKFILL_DELAY_MS = 1_500;

const backfillQueue = new Set<string>();
let backfillRunning = 0;
let backfillTimer: NodeJS.Timeout | null = null;

/** Kesh yo'q shablonni fon to'ldirish navbatiga qo'yadi (dublikatlar birlashadi). */
export function queueAssetKeyBackfill(templateId: string): void {
  if (!isS3Configured() || !templateId) return;
  if (backfillQueue.size >= BACKFILL_QUEUE_MAX) return;
  backfillQueue.add(templateId);
  if (backfillTimer) return;
  backfillTimer = setTimeout(() => {
    backfillTimer = null;
    void drainAssetKeyBackfill();
  }, BACKFILL_DELAY_MS);
  if (typeof backfillTimer.unref === "function") backfillTimer.unref();
}

/** Navbatni bounded parallellik bilan bo'shatadi. Xato yutiladi — keyingi pass qayta uradi. */
export async function drainAssetKeyBackfill(): Promise<number> {
  if (backfillRunning > 0) return 0;
  let done = 0;
  const workers = Array.from({ length: BACKFILL_CONCURRENCY }, async () => {
    backfillRunning++;
    try {
      for (;;) {
        const next = backfillQueue.values().next();
        if (next.done) return;
        backfillQueue.delete(next.value);
        if (await syncTemplateAssetKeys(next.value)) done++;
      }
    } finally {
      backfillRunning--;
    }
  });
  await Promise.all(workers);
  return done;
}

/** Bir pass'da nechta kesh-siz shablon to'ldiriladi (reconciler). */
const RECONCILE_BATCH = 25;

/**
 * Kesh yo'q (assetKeysJson = null) shablonlarni bounded partiyada to'ldiradi —
 * fon navbati restartda yo'qolsa ham katalog o'zini tuzatadi. Katta katalog uchun
 * bir martalik `backfill-asset-keys` skripti tezroq (egasi prod'da ishga tushiradi).
 */
export async function reconcileMissingAssetKeys(): Promise<number> {
  if (!isS3Configured()) return 0;
  const rows = await prisma.contributorTemplate.findMany({
    where: { assetKeysJson: { equals: Prisma.DbNull } },
    select: { id: true },
    take: RECONCILE_BATCH,
    orderBy: { updatedAt: "desc" },
  });
  let done = 0;
  for (const r of rows) {
    if (await syncTemplateAssetKeys(r.id)) done++;
  }
  return done;
}

/**
 * Bitta asset uchun S3 kalitini topadi — AVVAL DB keshidan (bitta PK o'qish),
 * so'ng bitta HeadObject bilan tasdiqlaydi. Kesh yo'q/mos kelmasa eski to'liq
 * probe'ga tushadi (#19: `resolveS3AssetKey` kengaytmalar bo'yicha 27 tagacha
 * ketma-ket HEAD qiladi — pack yuklab olishda ham sezilarli kechikish).
 */
export async function resolveAssetKeyCached(
  templateId: string,
  kind: TemplateAssetKind
): Promise<string | null> {
  if (!isS3Configured()) return null;
  try {
    const row = await prisma.contributorTemplate.findUnique({
      where: { id: templateId },
      select: { assetKeysJson: true },
    });
    const keys = assetKeySetFromStored(row?.assetKeysJson);
    if (keys) {
      const key = s3AssetKeyFromSet(templateId, kind, keys);
      // Kesh "yo'q" desa ham tasdiqlaymiz: kesh eskirgan bo'lishi mumkin
      // (masalan hozirgina yuklangan pack) — bu holda to'liq probe'ga o'tamiz.
      if (key) return (await s3ObjectExists(key)) ? key : resolveS3AssetKey(templateId, kind);
    } else {
      queueAssetKeyBackfill(templateId);
    }
  } catch (e) {
    console.warn(`[asset-state] kesh o'qilmadi (${templateId}):`, e);
  }
  return resolveS3AssetKey(templateId, kind);
}
