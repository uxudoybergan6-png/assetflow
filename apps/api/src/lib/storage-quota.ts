import { PluginPlanTier, prisma } from "@creative-tools/database";
import { deleteS3Objects } from "./s3.js";

/**
 * Bosqich 4 #4 — Per-tarif storage kvota + retention (user-generated assetlar).
 *
 * Kvota tarifga qarab (sozlanadigan env bilan):
 *   • FREE  — STORAGE_QUOTA_FREE_GB   (default 3 GB)
 *   • PRO   — STORAGE_QUOTA_PRO_GB    (default 50 GB)
 *   • STUDIO— STORAGE_QUOTA_STUDIO_GB (default 200 GB)
 *
 * ⚠️ EGA QARORI: aniq GB raqamlari biznes qarori — kod sensible default beradi.
 *
 * Enforcement:
 *   1) /gen submission'da: user ALLAQACHON kvotadan oshgan bo'lsa → toza rad
 *      (kredit YECHILMAYDI, chunki tekshiruv consume'dan OLDIN).
 *   2) persist'dan keyin (gen-processor): yangi asset joylashgach kvotadan oshsa →
 *      RETENTION — eng eski o'z assetlarni (R2 + DB) o'chirib joy bo'shatadi.
 *
 * Yosh-asosli retention (ixtiyoriy): GEN_ASSET_RETENTION_DAYS (default 0 = o'chiq).
 */
const GB = 1024 * 1024 * 1024;

function envGb(name: string, fallbackGb: number): number {
  const raw = Number(process.env[name]);
  if (Number.isFinite(raw) && raw > 0) return raw * GB;
  return fallbackGb * GB;
}

export function storageQuotaBytes(plan: PluginPlanTier): number {
  if (plan === PluginPlanTier.STUDIO) return envGb("STORAGE_QUOTA_STUDIO_GB", 200);
  if (plan === PluginPlanTier.PRO) return envGb("STORAGE_QUOTA_PRO_GB", 50);
  return envGb("STORAGE_QUOTA_FREE_GB", 3);
}

/** Foydalanuvchining ishlatilgan storage (bayt) — GenAsset.sizeBytes yig'indisi. */
export async function getUserUsedBytes(userId: string): Promise<number> {
  const agg = await prisma.genAsset.aggregate({
    where: { generation: { userId } },
    _sum: { sizeBytes: true },
  });
  return agg._sum.sizeBytes ?? 0;
}

export async function getUserPlan(userId: string): Promise<PluginPlanTier> {
  const p = await prisma.pluginProfile.findUnique({
    where: { userId },
    select: { plan: true },
  });
  return p?.plan ?? PluginPlanTier.FREE;
}

/**
 * /gen submission gate: user ALLAQACHON kvotadan oshgan bo'lsa true qaytaradi
 * (bunda route toza rad etadi, kredit yechmaydi). ADMIN har doim ozod (cheksiz test).
 */
export async function isStorageOverQuota(
  userId: string,
  isAdmin: boolean
): Promise<{ over: boolean; usedBytes: number; quotaBytes: number }> {
  const plan = await getUserPlan(userId);
  const quotaBytes = storageQuotaBytes(plan);
  if (isAdmin) return { over: false, usedBytes: 0, quotaBytes };
  const usedBytes = await getUserUsedBytes(userId);
  return { over: usedBytes >= quotaBytes, usedBytes, quotaBytes };
}

/**
 * Retention: yangi asset joylashgach kvotadan oshsa, eng ESKI o'z assetlarni
 * (R2 obyekt + DB qatori) o'chirib joy bo'shatadi (delete-oldest-until-under-quota).
 * ADMIN ozod. Best-effort — xato genni buzmaydi. Yosh-asosli retention ham
 * (GEN_ASSET_RETENTION_DAYS > 0 bo'lsa) qo'llanadi.
 *
 * DIQQAT: faqat GenAsset o'chiriladi (natija fayllar) — Generation qatori tarixда
 * qoladi (kredit/refund izi buzilmaydi).
 */
export async function enforceStorageRetention(userId: string): Promise<{ deleted: number; freedBytes: number }> {
  const plan = await getUserPlan(userId);
  const quotaBytes = storageQuotaBytes(plan);
  let deleted = 0;
  let freedBytes = 0;

  // Yosh-asosli (ixtiyoriy) — belgilangan kunlardan eski assetlar.
  const retentionDays = Number(process.env.GEN_ASSET_RETENTION_DAYS);
  if (Number.isFinite(retentionDays) && retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const stale = await prisma.genAsset.findMany({
      where: { generation: { userId }, createdAt: { lt: cutoff } },
      select: { id: true, resultKey: true, sizeBytes: true },
      take: 500,
    });
    if (stale.length) {
      const r = await deleteAssets(stale);
      deleted += r.deleted;
      freedBytes += r.freedBytes;
    }
  }

  // Kvota-asosli — eng eskidan boshlab, kvota ostiga tushguncha.
  let used = await getUserUsedBytes(userId);
  // ADMIN ozod.
  const isAdmin = (await prisma.pluginProfile.findUnique({
    where: { userId },
    select: { user: { select: { role: true } } },
  }))?.user.role === "ADMIN";
  if (isAdmin) return { deleted, freedBytes };

  while (used > quotaBytes) {
    const batch = await prisma.genAsset.findMany({
      where: { generation: { userId } },
      orderBy: { createdAt: "asc" },
      select: { id: true, resultKey: true, sizeBytes: true },
      take: 20,
    });
    if (batch.length === 0) break;
    // Kvota ostiga tushguncha kerak bo'lganlarini tanlaymiz (eng eski birinchi).
    const toDelete: typeof batch = [];
    for (const a of batch) {
      toDelete.push(a);
      used -= a.sizeBytes ?? 0;
      if (used <= quotaBytes) break;
    }
    const r = await deleteAssets(toDelete);
    deleted += r.deleted;
    freedBytes += r.freedBytes;
    if (r.deleted === 0) break; // himoya: hech narsa o'chmasa cheksiz sikl bo'lmasin
  }
  return { deleted, freedBytes };
}

async function deleteAssets(
  assets: Array<{ id: string; resultKey: string | null; sizeBytes: number | null }>
): Promise<{ deleted: number; freedBytes: number }> {
  if (assets.length === 0) return { deleted: 0, freedBytes: 0 };
  const keys = assets
    .map((a) => a.resultKey)
    .filter((k): k is string => typeof k === "string" && k.length > 0);
  if (keys.length) {
    try {
      await deleteS3Objects(keys);
    } catch (e) {
      console.error("enforceStorageRetention: R2 delete", e);
    }
  }
  const res = await prisma.genAsset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
  const freedBytes = assets.reduce((a, x) => a + (x.sizeBytes ?? 0), 0);
  return { deleted: res.count, freedBytes };
}
