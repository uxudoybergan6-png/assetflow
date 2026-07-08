import { prisma, Prisma } from "@creative-tools/database";
import { isS3Configured, listTemplateS3Keys } from "./s3.js";

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
