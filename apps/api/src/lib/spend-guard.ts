/**
 * Spend himoyasi (Bosqich 1 #2) — tizim o'zini "qochib ketgan hisob"dan himoya qiladi.
 *
 * UCH qatlam, HAMMASI KREDIT YECHISHDAN OLDIN /gen'da tekshiriladi (charge'dan oldin reject):
 *   1) KILL-SWITCH (GEN_KILL_SWITCH=true) — barcha yangi gen'ni darhol 503 qiladi (charge YO'Q).
 *      Runaway bill / provider incident paytida qo'lda "tормоз".
 *   2) GLOBAL SPEND CEILING — kunlik/oylik provider USD (ProviderSpend.estimatedCostUsd, #1)
 *      belgilangan shiftdan oshsa 503 (charge YO'Q). Env bilan sozlanadi; env yo'q → o'chirilgan.
 *   3) PER-USER DAILY CAP — bitta hisob (admin top-up ham) kuniga N tadan ortiq gen qilolmaydi.
 *      ADMIN cheklovdan ozod. In-memory (mavjud HELPER_DAILY_CAP falsafasiga mos, single-instance).
 *
 * PUL ZONASIGA TEGMAYDI — faqat gate. Xato bo'lsa (masalan ceiling DB so'rovi yiqilsa) FAIL-OPEN
 * (foydalanuvchini monitoring so'rovi tufayli bloklamaymiz) — LEKIN kill-switch (env) qat'iy to'siq.
 */
import { prisma } from "@creative-tools/database";

/** GEN_KILL_SWITCH=true → barcha yangi generatsiya to'xtatiladi (charge yo'q). */
export function isGenKillSwitchOn(): boolean {
  return process.env.GEN_KILL_SWITCH === "true";
}

// ── Per-user kunlik /gen cap (in-memory; UTC kun) ────────────────────────────
const DEFAULT_GEN_DAILY_CAP = 200;
function genDailyCap(): number {
  const raw = Number(process.env.GEN_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_GEN_DAILY_CAP;
}
const genDayHits = new Map<string, { day: number; count: number }>();

/**
 * Foydalanuvchi kunlik /gen limiti ichidami? ADMIN → DOIM true (ozod). Limit ichida bo'lsa
 * hisoblagichni oshiradi va true qaytaradi (HELPER_DAILY_CAP naqshi). Bu FAQAT charge'dan
 * OLDIN, gen haqiqatan boshlanayotganida chaqirilsin (rad etilgan so'rovlar sanalmasin).
 */
export function withinGenDailyCap(userId: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const cap = genDailyCap();
  const day = Math.floor(Date.now() / 86_400_000); // UTC kun raqami
  const cur = genDayHits.get(userId);
  if (!cur || cur.day !== day) {
    genDayHits.set(userId, { day, count: 1 });
    return true;
  }
  if (cur.count >= cap) return false;
  cur.count++;
  return true;
}

// ── Global spend ceiling (kunlik/oylik provider USD) ─────────────────────────
function ceiling(envName: string): number | null {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ProviderSpend agregatini har /gen'da so'ramaslik uchun qisqa TTL kesh (DB yukini kamaytiradi).
const SPEND_CACHE_TTL_MS = 30_000;
let spendCache: { at: number; day: number; month: number } | null = null;

async function sumSpendSince(since: Date): Promise<number> {
  const agg = await prisma.providerSpend.aggregate({
    _sum: { estimatedCostUsd: true },
    where: { createdAt: { gte: since } },
  });
  const v = agg._sum.estimatedCostUsd;
  return v == null ? 0 : Number(v);
}

/**
 * Global kunlik/oylik provider USD shifti oshib ketganmi? Env shift yo'q → o'chirilgan
 * ({ exceeded: false }). DB so'rovi yiqilsa FAIL-OPEN (log + not exceeded) — monitoring
 * so'rovi tufayli haqiqiy foydalanuvchini bloklamaymiz; kill-switch qat'iy to'siq bo'lib qoladi.
 */
export async function checkGlobalSpendCeiling(): Promise<{
  exceeded: boolean;
  reason?: string;
}> {
  const dayCap = ceiling("GEN_DAILY_USD_CEILING");
  const monthCap = ceiling("GEN_MONTHLY_USD_CEILING");
  if (dayCap == null && monthCap == null) return { exceeded: false };
  try {
    const now = Date.now();
    if (!spendCache || now - spendCache.at > SPEND_CACHE_TTL_MS) {
      const [day, month] = await Promise.all([
        dayCap != null ? sumSpendSince(startOfUtcDay()) : Promise.resolve(0),
        monthCap != null ? sumSpendSince(startOfUtcMonth()) : Promise.resolve(0),
      ]);
      spendCache = { at: now, day, month };
    }
    if (dayCap != null && spendCache.day >= dayCap) {
      return { exceeded: true, reason: `Kunlik provider xarajat shifti (${dayCap}$) ga yetildi` };
    }
    if (monthCap != null && spendCache.month >= monthCap) {
      return { exceeded: true, reason: `Oylik provider xarajat shifti (${monthCap}$) ga yetildi` };
    }
    return { exceeded: false };
  } catch (e) {
    console.error("[spend-guard] ceiling so'rovi xatosi (fail-open):", e);
    return { exceeded: false };
  }
}
