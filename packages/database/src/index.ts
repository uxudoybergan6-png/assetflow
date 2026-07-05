import { PrismaClient } from "@prisma/client";

/**
 * Ixtiyoriy pooling knob (additive, env-gated).
 *
 * `DATABASE_CONNECTION_LIMIT` o'rnatilsa — Prisma datasource URL'iga
 * `connection_limit=N` qo'shiladi (URL'da allaqachon bo'lmasa). Bu Prisma'ning
 * har-instans ulanish pool hajmini boshqaradi — Neon pgbouncer / Cloud Run
 * gorizontal scaling uchun (docs/DR-RUNBOOK.md → "Connection pooling").
 *
 * Env YO'Q bo'lsa → URL o'zgarmaydi va PrismaClient DATABASE_URL'ni O'ZI o'qiydi
 * (aynan bugungi xatti-harakat). Secret hardcode QILINMAYDI.
 */
function pooledDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  const limit = process.env.DATABASE_CONNECTION_LIMIT;
  if (!url || !limit) return undefined; // env yo'q → override yo'q (identik)
  if (/[?&]connection_limit=/.test(url)) return undefined; // allaqachon bor → tegmaymiz
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${encodeURIComponent(limit)}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const pooledUrl = pooledDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // pooledUrl faqat DATABASE_CONNECTION_LIMIT o'rnatilganda mavjud; aks holda
    // datasources override umuman berilmaydi (Prisma DATABASE_URL'ni o'zi oladi).
    ...(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
