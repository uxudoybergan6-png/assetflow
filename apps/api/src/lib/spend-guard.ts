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

// ── Per-user kunlik /gen cap (DB — restart/multi-instance'ga chidamli; UTC kun) ───────
const DEFAULT_GEN_DAILY_CAP = 200;
function genDailyCap(): number {
  const raw = Number(process.env.GEN_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_GEN_DAILY_CAP;
}

/** UTC kun raqami (in-memory naqsh bilan bir xil kalit). */
function utcDayNumber(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/**
 * FAZA 2 (H7) — bir foydalanuvchi bir UTC kun ichida limitdan ortiq /gen (yoki helper)
 * so'rov yubordimi? DailyUsageCounter'ni ATOMIK oshiradi (upsert increment) va yangi
 * qiymat cap ichidami tekshiradi. Ilgari in-memory Map edi → process restart / multi-instance
 * cap'ni nolga qaytarib chetlatardi. DB xato bersa FAIL-OPEN (kredit tizimi asosiy to'siq).
 */
export async function incrDailyUsage(
  userId: string,
  kind: "gen" | "helper" | "blocked" | "ai-metadata",
  cap: number
): Promise<boolean> {
  const day = utcDayNumber();
  try {
    const row = await prisma.dailyUsageCounter.upsert({
      where: { userId_day_kind: { userId, day, kind } },
      create: { userId, day, kind, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    return row.count <= cap;
  } catch (e) {
    console.error(`[spend-guard] daily cap DB xato (${kind}, fail-open):`, e);
    return true; // cap DB blip foydalanuvchini bloklamasin — kill-switch/ceiling qat'iy to'siq.
  }
}

/**
 * Foydalanuvchi kunlik /gen limiti ichidami? ADMIN → DOIM true (ozod). Limit ichida bo'lsa
 * hisoblagichni oshiradi va true qaytaradi. Bu FAQAT charge'dan OLDIN, gen haqiqatan
 * boshlanayotganida chaqirilsin (rad etilgan so'rovlar sanalmasin).
 */
export async function withinGenDailyCap(userId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  return incrDailyUsage(userId, "gen", genDailyCap());
}

// ── P30.4 (29c) — bloklangan (moderatsiya/provayder-rad) urinishlar kunlik cap ──
// Refund-farming himoyasi: bloklangan urinish KREDIT olmaydi (refund/pre-block), lekin
// provayder kvota/xarajat oladi. Kuniga N martadan ortiq bloklangach — barcha yangi urinish
// to'xtatiladi (aniq hammer). Default 20, env bilan override.
const BLOCKED_DAILY_CAP = Math.max(1, Number(process.env.BLOCKED_ATTEMPTS_DAILY_CAP) || 20);

/** Bitta bloklangan urinishni sanaydi. overCap=true → foydalanuvchi bugungi cheklovdan oshdi. */
export async function noteBlockedAttempt(userId: string): Promise<{ overCap: boolean; cap: number }> {
  const within = await incrDailyUsage(userId, "blocked", BLOCKED_DAILY_CAP);
  return { overCap: !within, cap: BLOCKED_DAILY_CAP };
}

/** READ-ONLY: foydalanuvchi bugun bloklangan-urinish cap'iga yetganmi (sanashni OSHIRMAYDI). */
export async function isOverBlockedCap(userId: string): Promise<boolean> {
  const day = utcDayNumber();
  try {
    const row = await prisma.dailyUsageCounter.findUnique({
      where: { userId_day_kind: { userId, day, kind: "blocked" } },
      select: { count: true },
    });
    return !!row && row.count >= BLOCKED_DAILY_CAP;
  } catch {
    return false; // DB blip → fail-open (asosiy to'siq kredit/ceiling)
  }
}

// ── Global spend ceiling (kunlik/oylik provider USD) ─────────────────────────
// FAZA 2 (H7) — DEFAULT shift (env unset → o'chiq EMAS, balki xavfsiz default). Runaway
// bill'ga qarshi himoya doim yoqilgan. Aniq O'CHIRISH: env = "0" | "off" | "none" (opt-out).
const DEFAULT_DAILY_USD_CEILING = 250;
const DEFAULT_MONTHLY_USD_CEILING = 4000;
/** Cache DB xatosi'da fail-closed'ga o'tish chegarasi (shift ulushi). */
const CEILING_FAIL_CLOSED_FRACTION = 0.9;

function ceiling(envName: string, defaultVal: number): number | null {
  const raw = process.env[envName];
  if (raw == null || raw.trim() === "") return defaultVal; // unset → default (yoqilgan)
  const t = raw.trim();
  if (/^(off|false|none)$/i.test(t)) return null; // aniq opt-out
  const n = Number(t);
  if (!Number.isFinite(n)) return defaultVal;
  return n > 0 ? n : null; // 0 / manfiy → o'chiq
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
  const dayCap = ceiling("GEN_DAILY_USD_CEILING", DEFAULT_DAILY_USD_CEILING);
  const monthCap = ceiling("GEN_MONTHLY_USD_CEILING", DEFAULT_MONTHLY_USD_CEILING);
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
      return { exceeded: true, reason: `Daily provider spend ceiling (${dayCap}$) reached` };
    }
    if (monthCap != null && spendCache.month >= monthCap) {
      return { exceeded: true, reason: `Monthly provider spend ceiling (${monthCap}$) reached` };
    }
    return { exceeded: false };
  } catch (e) {
    console.error("[spend-guard] ceiling so'rovi xatosi:", e);
    // FAZA 2 (H7) — DB xato'da CHEGARA USTIDA fail-closed: agar oxirgi ma'lum (cached) sarf
    // allaqachon shift'ning CEILING_FAIL_CLOSED_FRACTION ulushidan oshib turgan bo'lsa va biz
    // yangilay olmasak — bloklaymiz (runaway bill'ni ko'r-ko'rona o'tkazib yubormaymiz). Chegaradan
    // pastda (yoki cache yo'q) fail-OPEN (transient blip haqiqiy foydalanuvchini bloklamasin).
    if (spendCache) {
      if (dayCap != null && spendCache.day >= dayCap * CEILING_FAIL_CLOSED_FRACTION)
        return { exceeded: true, reason: "Daily spend ceiling check unavailable while near the limit — blocked (fail-closed)" };
      if (monthCap != null && spendCache.month >= monthCap * CEILING_FAIL_CLOSED_FRACTION)
        return { exceeded: true, reason: "Monthly spend ceiling check unavailable while near the limit — blocked (fail-closed)" };
    }
    return { exceeded: false };
  }
}
