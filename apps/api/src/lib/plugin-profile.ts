import {
  AiGenerationStatus,
  AiGenerationType,
  PluginAccountStatus,
  PluginPlanTier,
  SubscriptionStatus,
  Prisma,
  prisma,
} from "@creative-tools/database";
import crypto from "crypto";
import { isEmailConfigured } from "./email.js";
import { avatarPublicUrl } from "./app-urls.js";
import { writeCreditLedger } from "./ledger.js";

const FREE_DOWNLOAD_LIMIT = 15;
const FREE_IMPORT_LIMIT = 10;
const DOWNLOAD_IDEMPOTENCY_TTL_MS = 15 * 60_000;
const TOPUP_CONSUME_ALLOCATION_REASON = "consume_topup_allocation";

export type CreditRefundPlan = {
  applied: number;
  topupApplied: number;
};

/**
 * Refund oylik ulushdan oshib tekin kredit yaratmaydi, ammo aynan shu consume
 * paytida sarflangan pullik top-up qismini albatta tiklaydi. `topupConsumed`
 * consume transactionida oldingi/yangi tracker farqidan olinadi.
 */
export function creditRefundPlan(input: {
  cost: number;
  currentBalance: number;
  currentTopup: number;
  monthlyAllotment: number;
  topupConsumed?: number | null;
}): CreditRefundPlan {
  const cost = Number.isFinite(input.cost) ? Math.max(0, Math.floor(input.cost)) : 0;
  const currentBalance = Number.isFinite(input.currentBalance)
    ? Math.max(0, Math.floor(input.currentBalance))
    : 0;
  const currentTopup = Number.isFinite(input.currentTopup)
    ? Math.max(0, Math.floor(input.currentTopup))
    : 0;
  const monthlyAllotment = Number.isFinite(input.monthlyAllotment)
    ? Math.max(0, Math.floor(input.monthlyAllotment))
    : 0;
  const topupConsumed = Math.min(
    cost,
    Number.isFinite(input.topupConsumed)
      ? Math.max(0, Math.floor(input.topupConsumed as number))
      : 0
  );
  // `baseCeiling` eski-oy refundining yangi oylik ulush ustiga tekin kredit
  // qo'shishini to'sadi. Pullik top-up reversal esa shu ceiling USTIGA qo'shiladi.
  const baseCeiling = Math.max(monthlyAllotment + currentTopup, currentBalance);
  const applied = Math.max(0, Math.min(cost, baseCeiling + topupConsumed - currentBalance));
  return { applied, topupApplied: Math.min(topupConsumed, applied) };
}

export function importReservationReplayDecision(
  existing: { status: string; expiresAt: Date },
  now = new Date()
): "replay" | "expired" | "terminal" {
  if (existing.status !== "reserved") return "terminal";
  return existing.expiresAt < now ? "expired" : "replay";
}

export function downloadClaimReplayDecision(
  prior: { userId: string; reason: string; generationId: string | null; createdAt: Date } | null,
  expected: { userId: string; assetMarker: string | null },
  nowMs = Date.now()
): "replay" | "expired" | "conflict" {
  if (
    prior?.userId !== expected.userId ||
    prior.reason !== "download_claim" ||
    prior.generationId !== expected.assetMarker
  ) return "conflict";
  return nowMs - prior.createdAt.getTime() <= DOWNLOAD_IDEMPOTENCY_TTL_MS ? "replay" : "expired";
}

/**
 * FAZA 4 (D) — plan o'zgarishi hodisasi (churn/conversion metrikalari).
 * BEST-EFFORT (writeCreditLedger naqshi): xato plan setter'ni BLOKLAMAYDI.
 */
export async function recordPlanChange(
  userId: string,
  fromPlan: PluginPlanTier,
  toPlan: PluginPlanTier,
  source: "billing" | "stripe" | "manual"
): Promise<void> {
  if (fromPlan === toPlan) return;
  try {
    await prisma.planChangeEvent.create({
      data: { userId, fromPlan: String(fromPlan), toPlan: String(toPlan), source },
    });
  } catch (e) {
    console.error("recordPlanChange", e);
  }
}

/** Oylik AI kredit ulushi — har oy boshida shu qiymatga tiklanadi.
 *  FAZA 2 #13: STATIK FALLBACK — haqiqiy qiymat DB (PlanConfig) keshidan. */
export const AI_MONTHLY_CREDITS = {
  [PluginPlanTier.FREE]: 50,
  [PluginPlanTier.PRO]: 1000,
  // P27 D2 — Studio 6000 → 3000 (og'ir tarifda ~2× marja). ⚠️ Bu STATIK FALLBACK; jonli grant
  // PlanConfig DB qatoridan keladi — owner admin'da STUDIO aiMonthlyCredits'ni 3000 qilishi SHART.
  [PluginPlanTier.STUDIO]: 3000,
} as const;

// ── FAZA 2 #13 — PlanConfig DB keshi ────────────────────────────────────────
// Limitlar admin tomonidan DB'da boshqariladi; bu sync o'quvchilar (money-zone
// consume oqimlari signaturasi o'zgarmasin) uchun 60s TTL in-memory kesh.
// DB'da qator bo'lmasa / o'qib bo'lmasa — statik konstantalar (seed bilan teng,
// xatti-harakat o'zgarmaydi).
type PlanCfgRow = {
  label: string;
  aiMonthlyCredits: number;
  downloadLimit: number | null;
  importLimit: number | null;
  maxResolution: string;
};
const planCfgCache = new Map<PluginPlanTier, PlanCfgRow>();
let planCfgFetchedAt = 0;
const PLAN_CFG_TTL_MS = 60_000;

/** Keshni yangilaydi (TTL o'tgan bo'lsa). force=true — admin tahriridan keyin darhol. */
export async function refreshPlanConfigCache(force = false): Promise<void> {
  if (!force && Date.now() - planCfgFetchedAt < PLAN_CFG_TTL_MS) return;
  try {
    const rows = await prisma.planConfig.findMany();
    for (const r of rows) {
      planCfgCache.set(r.plan, {
        label: r.label,
        aiMonthlyCredits: r.aiMonthlyCredits,
        downloadLimit: r.downloadLimit,
        importLimit: r.importLimit,
        maxResolution: r.maxResolution,
      });
    }
    planCfgFetchedAt = Date.now();
  } catch (e) {
    // DB xatosi — statik fallback ishlashda davom etadi (fail-open emas:
    // qiymatlar bugungi konstantalar bilan bir xil).
    console.warn("[plan-config] kesh yangilash xatosi:", e);
  }
}

function planCfg(plan: PluginPlanTier): PlanCfgRow | null {
  // Fire-and-forget yangilash — sync o'quvchini bloklamaydi; birinchi chaqiruv
  // statik qiymat bilan javob beradi (seed bilan teng), keyingilari DB qiymati.
  void refreshPlanConfigCache();
  return planCfgCache.get(plan) ?? null;
}

export function aiMonthlyAllotment(plan: PluginPlanTier) {
  const cfg = planCfg(plan);
  if (cfg && Number.isFinite(cfg.aiMonthlyCredits) && cfg.aiMonthlyCredits >= 0) {
    return cfg.aiMonthlyCredits;
  }
  return AI_MONTHLY_CREDITS[plan] ?? AI_MONTHLY_CREDITS[PluginPlanTier.FREE];
}

/** Pullik (obunali) tarifmi? FREE emas => PRO yoki STUDIO. Template-tier
    gate'lari (Pro shablonlar) uchun: PRO va STUDIO ikkalasi ham ochiq. */
export function isPaidPlan(plan: PluginPlanTier) {
  return plan !== PluginPlanTier.FREE;
}

export function planLimits(plan: PluginPlanTier) {
  // FAZA 2 #13 — DB (PlanConfig) qiymati birinchi; yo'q bo'lsa statik default
  // (seed bilan teng). downloadLimit=null → cheksiz.
  const cfg = planCfg(plan);
  const key = plan === PluginPlanTier.STUDIO ? ("studio" as const)
    : plan === PluginPlanTier.PRO ? ("pro" as const)
    : ("free" as const);
  const staticDefaults =
    plan === PluginPlanTier.FREE
      ? { label: "Free", downloadLimit: FREE_DOWNLOAD_LIMIT as number | null, importLimit: FREE_IMPORT_LIMIT as number | null, maxResolution: "1080p" }
      : { label: plan === PluginPlanTier.STUDIO ? "Studio" : "Pro", downloadLimit: null as number | null, importLimit: null as number | null, maxResolution: "4K" };
  const downloadLimit = cfg ? cfg.downloadLimit : staticDefaults.downloadLimit;
  const importLimit = cfg ? cfg.importLimit : staticDefaults.importLimit;
  return {
    plan: key,
    label: cfg?.label || staticDefaults.label,
    unlimitedDownloads: downloadLimit == null,
    unlimitedImports: importLimit == null,
    downloadLimit,
    importLimit,
    // §E (P2) — ⚠️ LEGACY, ENDI GATE EMAS: hech qanday kod yuklab olishni bu qiymat bilan
    // cheklamaydi (Free ham istalgan o'lchamda yuklaydi). Faqat admin PlanConfig'da saqlanib
    // turadi (migratsiyasiz olib bo'lmaydi); foydalanuvchi UI'sida "1080p vs 4K" farqi sifatida
    // KO'RSATILMASLIGI kerak — Free↔Pro yagona farqi = oylik yuklab olishlar + kreditlar.
    maxResolution: cfg?.maxResolution || staticDefaults.maxResolution,
  };
}

function monthStart(d = new Date()) {
  // P32 #2 — monthStart UTC: avval local-TZ edi → oylik reset chegarasi instance/timezone
  // bo'yicha siljirdi. UTC'ga qadab qo'ydik. Bu CHEGARA HISOBI (kredit QIYMATI emas) — reset
  // MANTIG'I o'zgarmaydi; faqat deploy paytida chegara BIR MARTA siljiydi (owner xabardor).
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function resetMonthIfNeeded(userId: string) {
  // ATOMIK: guard WHERE'da (monthResetAt < oy boshi). Avvalgi find->check->update
  // TOCTOU oynasini yopadi — parallel so'rovlarda faqat BITTA reset o'tadi
  // (count===0 bo'lsa hech narsa qilinmaydi). consumeDownload kabi (#1 naqsh).
  // Semantika o'zgarmaydi: downloadsMonth + (P21) importsMonth tiklanadi (aiCredits
  // emas — u consumeAiCredits ichida alohida reset bo'ladi).
  const start = monthStart();
  await prisma.pluginProfile.updateMany({
    where: { userId, monthResetAt: { lt: start } },
    data: { downloadsMonth: 0, importsMonth: 0, monthResetAt: start },
  });
}

/**
 * Oy o'tgan BARCHA profil uchun downloadsMonth'ni bitta atomik so'rovda tiklaydi.
 * `resetMonthIfNeeded` bilan aynan bir semantika (bir xil guard, bir xil data) —
 * lekin ro'yxat endpointlarida har foydalanuvchi uchun alohida so'rov (N+1)
 * o'rniga BITTA `updateMany`. Ixtiyoriy `userIds` bilan doirasini cheklash mumkin.
 */
export async function resetExpiredPluginMonths(userIds?: string[]): Promise<void> {
  const start = monthStart();
  await prisma.pluginProfile.updateMany({
    where: {
      monthResetAt: { lt: start },
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    data: { downloadsMonth: 0, importsMonth: 0, monthResetAt: start },
  });
}

export async function ensurePluginProfile(userId: string) {
  // Money decision oldidan DB PlanConfig birinchi marta ham await qilinadi.
  await refreshPlanConfigCache();
  await resetMonthIfNeeded(userId);
  // `create` ANIQ aiCredits/aiCreditsResetAt beradi — faqat ustun DEFAULT'iga
  // TAYANMAYDI (schema.prisma'dagi @default(50) bilan AI_MONTHLY_CREDITS.FREE
  // qiymati kelajakda bir-biridan uzoqlashsa, yangi foydalanuvchi 0/eski
  // ulush bilan qolib ketmasin — yagona haqiqat manbai shu funksiya).
  return prisma.pluginProfile.upsert({
    where: { userId },
    create: {
      userId,
      aiCredits: aiMonthlyAllotment(PluginPlanTier.FREE),
      aiCreditsResetAt: monthStart(),
    },
    update: {},
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          emailVerified: true,
          subscription: true,
        },
      },
    },
  });
}

export async function subscriptionIsPro(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return (
    sub?.status === SubscriptionStatus.ACTIVE ||
    sub?.status === SubscriptionStatus.TRIALING
  );
}

export function proSwitchAllowed(hasStripePro: boolean) {
  // Stripe orqali haqiqiy PRO obuna — har doim ruxsat. (Webhook #3 va admin
  // override bunga aloqasiz: ular proSwitchAllowed'dan o'tmaydi.)
  if (hasStripePro) return true;
  // Self-serve PRO (Stripe'siz) FAQAT aniq flag bilan ochiladi — fail-CLOSED.
  // Flag yo'q/false → PRO BERILMAYDI (NODE_ENV'ga TAYANMAYMIZ; deploy env'da "false").
  return process.env.PLUGIN_ALLOW_PRO_WITHOUT_STRIPE === "true";
}

export async function setPluginPlan(userId: string, plan: PluginPlanTier) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status === PluginAccountStatus.BLOCKED) {
    return { ok: false as const, error: "Account is blocked" };
  }
  if (profile.status === PluginAccountStatus.REMOVED) {
    return { ok: false as const, error: "Account is deleted" };
  }

  if (plan === PluginPlanTier.PRO) {
    // B1 (#9) dan keyin bu tekshiruv LS obunalarini ham ko'radi (Subscription qatori
    // provider="lemonsqueezy" bilan yoziladi) — LS mijozi endi PRO'ga qaytara oladi.
    const stripePro = await subscriptionIsPro(userId);
    if (!proSwitchAllowed(stripePro)) {
      return {
        ok: false as const,
        error: "PRO requires a Stripe subscription (or admin approval)",
      };
    }
  }

  // B2 (audit #10) — faol pullik obuna bo'lsa QO'LDA FREE'ga tushirishga yo'l qo'ymaymiz:
  // plan tushadi, lekin provayder pul olishda davom etadi. Bekor qilish — billing portali.
  if (plan === PluginPlanTier.FREE && profile.plan !== PluginPlanTier.FREE) {
    const activeSub = await prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, provider: true },
    });
    const stillPaid =
      activeSub?.status === SubscriptionStatus.ACTIVE ||
      activeSub?.status === SubscriptionStatus.TRIALING;
    if (stillPaid) {
      return {
        ok: false as const,
        error:
          "Obunangiz faol — bekor qilish uchun hisob sahifasidagi \"Obunani boshqarish\" bo'limiga o'ting.",
        code: "SUBSCRIPTION_ACTIVE" as const,
      };
    }
  }

  const updated = await prisma.pluginProfile.update({
    where: { userId },
    data: { plan },
  });
  await recordPlanChange(userId, profile.plan, plan, "manual");
  return { ok: true as const, profile: updated };
}

/**
 * Webhook-driven plan sinxronizatsiyasi: PluginProfile.plan'ni Stripe obuna
 * holatining YAGONA haqiqat manbai sifatida moslashtiradi. isActive=true
 * (ACTIVE/TRIALING) → PRO, aks holda (canceled/past_due/unpaid/...) → FREE.
 * Shu sabab obuna tugagach/bekor qilingach PRO abadiy qolmaydi.
 *
 * Self-upgrade gate'i (proSwitchAllowed) bu yerda QO'LLANMAYDI — webhook
 * Stripe'ning avtoritativ signali. Idempotent: bir xil event qayta kelsa
 * natija o'zgarmaydi. BLOCKED/REMOVED hisoblar uchun ham plan tozalanadi
 * (hisob statusi alohida — bu yerda faqat plan + AI kredit ulushiga tegamiz).
 * (To'liq event-id dedup #16'da, currentPeriodEnd #12'da hal qilinadi.)
 */
export async function syncPluginPlanFromStripe(userId: string, isActive: boolean) {
  const profile = await ensurePluginProfile(userId);
  const plan = isActive ? PluginPlanTier.PRO : PluginPlanTier.FREE;
  const data: { plan: PluginPlanTier; aiCredits?: number } = { plan };

  // FREE'ga tushganda PRO'ning ortiqcha AI kreditini FREE ulushiga cheklaymiz
  // (minimal teg — keyingi oylik reset baribir FREE darajasiga tushiradi).
  // Bosqich 4 #5: sotib olingan TOP-UP saqlanadi — cap = FREE allotment + top-up.
  if (!isActive) {
    const freeAllot = aiMonthlyAllotment(PluginPlanTier.FREE) + profile.aiCreditsTopup;
    if (profile.aiCredits > freeAllot) data.aiCredits = freeAllot;
  }

  await prisma.pluginProfile.update({ where: { userId }, data });
  await recordPlanChange(userId, profile.plan, plan, "stripe");
  return { plan };
}

/**
 * Lemon Squeezy (MoR) webhook-driven, PLAN-AWARE plan setter — obuna faol
 * bo'lganda sotib olingan variant → PRO/STUDIO plan. syncPluginPlanFromStripe'ning
 * plan-aware kengaytmasi (u faqat PRO/FREE'ni bilardi).
 *
 * Semantika:
 *   • PRO/STUDIO (faol) va plan HAQIQATAN o'zgarganda → darhol shu planning oylik
 *     AI ulushiga kirish beriladi (aiCredits < allotment bo'lsa allotment'ga
 *     to'ldiriladi; mavjud balansni/topup'ni KAMAYTIRMAYDI). Plan o'zgarmagan
 *     takror update'larda (karta yangilash, spam) kredit TEGILMAYDI — bepul
 *     to'ldirish (allotment leak) bo'lmaydi. Oylik tsikl (aiCreditsResetAt)
 *     o'zgarmaydi: recurring refill mavjud consumeAiCredits reset mantig'ida.
 *   • FREE (bekor/muddat tugadi) → syncPluginPlanFromStripe(false) kabi FREE
 *     ulushiga cheklaydi (lapse). Topup'lar ham FREE ulushiga tushadi (Stripe
 *     lapse mantig'ini AYNAN takrorlaydi).
 *
 * Idempotent: qayta chaqiruv natijani o'zgartirmaydi. Webhook-layer event-id
 * dedup'i literal retry'larni to'sadi; bu funksiya genuine-but-spurious
 * update'larga qo'shimcha himoya beradi.
 */
export async function applyBillingPlan(
  userId: string,
  plan: PluginPlanTier,
  // B4 (audit #12) — joriy billing davri kaliti (LS `renews_at` / Stripe davr oxiri).
  // Berilsa: kredit to'ldirish faqat kalit O'ZGARGANDA bo'ladi → pause→resume
  // (bir xil davr) to'lovsiz reset bermaydi. Berilmasa — eski xatti-harakat.
  opts: { periodKey?: string | null } = {}
) {
  const profile = await ensurePluginProfile(userId);
  const changingPlan = profile.plan !== plan;
  const data: {
    plan: PluginPlanTier;
    aiCredits?: number;
    billingPeriodKey?: string | null;
  } = { plan };

  const periodKey = opts.periodKey ?? null;
  // Yangi billing davrimi? Kalit berilmagan bo'lsa (Stripe/eski chaqiruvlar) — HA deb qaraymiz.
  const newPeriod = !periodKey || profile.billingPeriodKey !== periodKey;

  // Bosqich 4 #5: sotib olingan TOP-UP har plan o'zgarishida saqlanadi.
  if (plan === PluginPlanTier.FREE) {
    const freeAllot = aiMonthlyAllotment(PluginPlanTier.FREE) + profile.aiCreditsTopup;
    if (profile.aiCredits > freeAllot) data.aiCredits = freeAllot;
  } else if (changingPlan && newPeriod) {
    const allot = aiMonthlyAllotment(plan) + profile.aiCreditsTopup;
    if (profile.aiCredits < allot) data.aiCredits = allot;
  }
  if (periodKey && plan !== PluginPlanTier.FREE) data.billingPeriodKey = periodKey;

  await prisma.pluginProfile.update({ where: { userId }, data });
  await recordPlanChange(userId, profile.plan, plan, "billing");
  return { plan, changed: changingPlan };
}

/**
 * Kredit-paket TOP-UP (Lemon Squeezy order_created) — ADDITIVE grant. Oylik
 * reset EMAS: mavjud balansga QO'SHILADI va oylik ulushdan (allotment) OSHISHI
 * MUMKIN (paket = qo'shimcha kredit, har planda). Idempotentlik webhook-layer'da
 * order/event dedup bilan ta'minlanadi (bu funksiya faqat grant qiladi — retry
 * himoyasini chaqiruvchi qiladi). CreditLedger'ga reason="topup" yoziladi.
 *
 * Bosqich 4 #5 (TUZATILDI): aiCredits VA aiCreditsTopup ikkalasi ham oshiriladi.
 * Endi oylik reset (consumeAiCredits) balansni `allotment + aiCreditsTopup` ga
 * tiklaydi — sarflanmagan top-up kreditlar oy oxirida YO'QOLMAYDI (carry-over).
 */
export async function grantAiCreditsTopup(
  userId: string,
  amount: number,
  opts: { reason?: string; sourceKey?: string | null } = {}
) {
  if (!Number.isFinite(amount) || amount <= 0) return { balance: null as number | null };
  await ensurePluginProfile(userId);
  const delta = Math.floor(amount);
  const reason = opts.reason ?? "topup";
  // B3 (#11) — sourceKey berilgan bo'lsa grant CLAIM-FIRST: bir order bir marta.
  // Webhook layer'idagi dedup buzilsa/qayta yetkazilsa ham kredit 2× berilmaydi.
  if (opts.sourceKey) {
    const sourceKey = opts.sourceKey;
    try {
      return await prisma.$transaction(async (tx) => {
        // Ledger claim va balans increment BITTA transaction: oradagi xato claimni
        // yetim qoldirmaydi, provider retry grantni qayta bajarishi mumkin.
        await tx.creditLedger.create({
          data: { userId, delta, reason, sourceKey },
        });
        const updated = await tx.pluginProfile.update({
          where: { userId },
          data: { aiCredits: { increment: delta }, aiCreditsTopup: { increment: delta } },
          select: { aiCredits: true },
        });
        await tx.creditLedger.update({
          where: { sourceKey },
          data: { balanceAfter: updated.aiCredits },
        });
        return { balance: updated.aiCredits };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        console.warn("[credits] topup allaqachon berilgan, o'tkazib yuborildi:", opts.sourceKey);
        return { balance: null as number | null, duplicate: true as const };
      }
      throw e;
    }
  }
  const updated = await prisma.pluginProfile.update({
    where: { userId },
    data: {
      aiCredits: { increment: delta },
      aiCreditsTopup: { increment: delta },
    },
    select: { aiCredits: true },
  });
  await writeCreditLedger({
    userId,
    delta,
    reason,
    balanceAfter: updated.aiCredits,
  });
  return { balance: updated.aiCredits };
}

/**
 * FAZA 4 (B) — kredit-paket REFUND clawback: sotib olingan, hali SARFLANMAGAN
 * top-up kreditlarni qaytarib oladi. Qoidalar:
 *   • FAQAT top-up ulushidan (aiCreditsTopup) — bepul oylik ulushga (allotment)
 *     HECH QACHON tegmaydi (claw <= aiCreditsTopup).
 *   • HECH QACHON manfiy emas — atomik updateMany WHERE gte guard (consumeAiCredits
 *     naqshi); parallel sarf bilan race'da guard yutqazsa qisqa retry.
 *   • Idempotentlik CHAQIRUVCHIDA: webhook claim-first dedup (bir refund hodisasi
 *     bir marta ishlanadi) — grantAiCreditsTopup bilan bir xil shartnoma.
 * MAVJUD atomik consume/refund mantig'iga TEGILMAGAN — bu alohida qo'shimcha funksiya.
 */
export async function clawbackTopupCredits(
  userId: string,
  amount: number
): Promise<{ clawed: number }> {
  const want = Math.floor(amount);
  if (!Number.isFinite(want) || want <= 0) return { clawed: 0 };
  for (let attempt = 0; attempt < 3; attempt++) {
    const prof = await prisma.pluginProfile.findUnique({
      where: { userId },
      select: { aiCredits: true, aiCreditsTopup: true },
    });
    if (!prof) return { clawed: 0 };
    const claw = Math.min(want, prof.aiCreditsTopup, prof.aiCredits);
    if (claw <= 0) return { clawed: 0 }; // sarflab bo'lingan — qaytarib olinmaydi
    const res = await prisma.pluginProfile.updateMany({
      where: { userId, aiCredits: { gte: claw }, aiCreditsTopup: { gte: claw } },
      data: { aiCredits: { decrement: claw }, aiCreditsTopup: { decrement: claw } },
    });
    if (res.count === 1) {
      const after = await prisma.pluginProfile.findUnique({
        where: { userId },
        select: { aiCredits: true },
      });
      await writeCreditLedger({
        userId,
        delta: -claw,
        reason: "clawback",
        balanceAfter: after?.aiCredits ?? null,
      });
      return { clawed: claw };
    }
    // guard yutqazdi (parallel consume balansni o'zgartirdi) → qayta o'qib urinamiz
  }
  return { clawed: 0 };
}

/**
 * Bir martalik reconciliation: barcha PluginProfile'larni joriy Stripe obuna
 * holatiga moslashtiradi (webhook o'tkazib yuborilgan/eski holatlar uchun).
 * `npm run reconcile:plans` orqali chaqiriladi.
 */
export async function reconcilePluginPlans() {
  const profiles = await prisma.pluginProfile.findMany({
    select: { userId: true, plan: true },
  });
  let changed = 0;
  let skipped = 0;
  for (const p of profiles) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: p.userId },
      select: { status: true, provider: true },
    });
    // B5 (audit #45) — FAIL-SAFE: bu skript FAQAT Stripe qatorlarini bilardi.
    // Stripe'siz (LS / admin granti / obuna qatori yo'q) pullik hisobni FREE'ga
    // tushirib yuborardi. Endi: provider "stripe" bo'lmasa yoki qator yo'q bo'lsa —
    // TEGMAYMIZ (LS holatini o'z webhook'i boshqaradi).
    if (!sub || sub.provider !== "stripe") {
      if (p.plan !== PluginPlanTier.FREE) skipped++;
      continue;
    }
    const isActive =
      sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.TRIALING;
    // STUDIO — PRO'dan yuqori tarif; faol obunada uni PRO'ga "tuzatib" tushirmaymiz.
    if (isActive && p.plan === PluginPlanTier.STUDIO) continue;
    const target = isActive ? PluginPlanTier.PRO : PluginPlanTier.FREE;
    if (p.plan !== target) {
      await syncPluginPlanFromStripe(p.userId, isActive);
      changed++;
    }
  }
  return { total: profiles.length, changed, skipped };
}

export function serializePluginUser(
  profile: Awaited<ReturnType<typeof ensurePluginProfile>>
) {
  const base = planLimits(profile.plan);
  const limits = {
    ...base,
    downloadLimit: profile.downloadLimitOverride ?? base.downloadLimit,
    importLimit: profile.importLimitOverride ?? base.importLimit,
    unlimitedDownloads: profile.downloadLimitOverride == null ? base.unlimitedDownloads : false,
    unlimitedImports: profile.importLimitOverride == null ? base.unlimitedImports : false,
  };
  const sub = profile.user.subscription;
  const stripeActive =
    sub?.status === SubscriptionStatus.ACTIVE ||
    sub?.status === SubscriptionStatus.TRIALING;

  return {
    id: profile.user.id,
    email: profile.user.email,
    name: profile.user.name,
    avatarUrl: avatarPublicUrl(profile.user.id, profile.user.image),
    role: profile.user.role,
    plan: profile.plan.toLowerCase(),
    planLabel: limits.label,
    status: profile.status.toLowerCase(),
    downloadsTotal: profile.downloadsTotal,
    downloadsMonth: profile.downloadsMonth,
    importsTotal: profile.importsTotal,
    importsMonth: profile.importsMonth, // P21: oylik import hisoblagichi (limit shu bo'yicha)
    aiCredits: profile.aiCredits,
    aiCreditsMonthly: aiMonthlyAllotment(profile.plan),
    aiCreditsTopup: profile.aiCreditsTopup, // Bosqich 4 #5: sotib olingan carry-over top-up
    limits,
    stripeSubscriptionActive: stripeActive,
    stripeStatus: sub?.status ?? null,
    lastSeenAt: profile.lastSeenAt?.toISOString() ?? null,
    deviceLabel: profile.deviceLabel,
    aeVersion: profile.aeVersion,
  };
}

/**
 * Yuklab olishni ATOMIK hisoblaydi + Free/Pro limitni server tomonda MAJBURLAYDI.
 * Pack/MOGRT download route'i baytlarni berishdan (302 redirect'dan) OLDIN shu
 * funksiyani chaqiradi: limit ichida bo'lsa hisoblagichni atomik oshiradi, aks
 * holda fayl berilmaydi (LIMIT_REACHED). `updateMany` `downloadsMonth < limit`
 * sharti bilan ishlagani uchun parallel so'rovlarda TOCTOU race bo'lmaydi
 * (`consumeAiCredits` kabi), va klient ixtiyoriy /usage call'ni tashlab ketsa
 * ham limit ishlaydi — localStorage'dagi tarif bilan chetlab o'tib bo'lmaydi.
 */
export async function consumeDownload(
  userId: string,
  opts: { sourceKey?: string; assetKey?: string } = {}
) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  }
  const limits = planLimits(profile.plan);
  const effectiveLimit = profile.downloadLimitOverride ?? limits.downloadLimit;

  // Kvota bir mantiqiy TEMPLATE access urinishiga tegishli: MOGRT yetkazilishi hash/network
  // sabab tugamasa, ayni requestId bilan pack fallback shu template uchun replay bo'ladi.
  // Har yangi click/import attempt yangi UUID yuborishi shart; boshqa template reuse — conflict.
  const assetMarker = opts.assetKey ? `download:${opts.assetKey}` : null;
  try {
    return await prisma.$transaction(async (tx) => {
      // Atomik: faqat oylik limit ichida bo'lsa oshiradi (race-safe guard WHERE'da).
      // Cheksiz rejada ham hisob yuritiladi, faqat WHERE limit sharti yo'q.
      const res = await tx.pluginProfile.updateMany({
        where: {
          userId,
          status: PluginAccountStatus.ACTIVE,
          ...(effectiveLimit === null ? {} : { downloadsMonth: { lt: effectiveLimit } }),
        },
        data: {
          downloadsTotal: { increment: 1 },
          downloadsMonth: { increment: 1 },
          lastSeenAt: new Date(),
        },
      });
      if (res.count === 0) {
        return {
          ok: false as const,
          error: "Monthly download limit reached — upgrade to Pro",
          code: "LIMIT_REACHED" as const,
        };
      }
      // GET javobi yo'qolib klient qayta urilganda profil incrementi va shu unique
      // claim BIR transactionda rollback bo'ladi. CreditLedger bu yerda faqat mavjud
      // global unique sourceKey registri sifatida ishlaydi; delta=0 kredit emas.
      if (opts.sourceKey) {
        await tx.creditLedger.create({
          data: {
            userId,
            generationId: assetMarker,
            delta: 0,
            reason: "download_claim",
            sourceKey: opts.sourceKey,
          },
        });
      }
      return { ok: true as const, idempotentReplay: false as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002" || !opts.sourceKey) throw e;
    const prior = await prisma.creditLedger.findUnique({ where: { sourceKey: opts.sourceKey } });
    const replayDecision = downloadClaimReplayDecision(prior, { userId, assetMarker });
    if (replayDecision === "replay") {
      return { ok: true as const, idempotentReplay: true as const };
    }
    if (replayDecision === "expired") return {
      ok: false as const,
      error: "This download retry key has expired — start a new download",
      code: "IDEMPOTENCY_EXPIRED" as const,
    };
    return {
      ok: false as const,
      error: "Idempotency key was already used for a different download",
      code: "IDEMPOTENCY_CONFLICT" as const,
    };
  }
}

/**
 * Importni ATOMIK hisoblaydi + import limitini MAJBURLAYDI. Plagin AE ga
 * import qilishdan OLDIN /usage/import orqali shu funksiyani chaqiradi
 * (kesh'langan qayta-import ham — fayl lokal bo'lsa ham gate'dan o'tadi);
 * limit tugagan bo'lsa LIMIT_REACHED qaytadi va import bloklanadi.
 *
 * P21 (money-zone limit — 2026-07-10): import limiti endi OYLIK `importsMonth`
 * bo'yicha (downloadsMonth kabi, monthResetAt'da reset) — eski `importsTotal`
 * (umrlik, hech qachon reset bo'lmaydigan) hisoblagich admin limitini bir martalik
 * umrlik-cap'ga aylantirib foydalanuvchini abadiy bloklagan edi. `importsTotal`
 * umrlik STATISTIKA uchun oshirilishda davom etadi. Atomik naqsh (guard WHERE'da,
 * count===0 → LIMIT_REACHED) BAYT-BAYT saqlangan: faqat guard O'QIYDIGAN maydon
 * (importsTotal → importsMonth) o'zgardi + importsMonth increment qo'shildi.
 */
export async function consumeImport(userId: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  }
  const limits = planLimits(profile.plan);
  const effectiveLimit = profile.importLimitOverride ?? limits.importLimit;

  if (effectiveLimit === null) {
    await prisma.pluginProfile.update({
      where: { userId },
      data: { importsTotal: { increment: 1 }, importsMonth: { increment: 1 }, lastSeenAt: new Date() },
    });
    return { ok: true as const };
  }

  const res = await prisma.pluginProfile.updateMany({
    where: {
      userId,
      status: PluginAccountStatus.ACTIVE,
      importsMonth: { lt: effectiveLimit },
    },
    data: { importsTotal: { increment: 1 }, importsMonth: { increment: 1 }, lastSeenAt: new Date() },
  });
  if (res.count === 0) {
    return {
      ok: false as const,
      error: "Monthly import limit reached — upgrade to Pro",
      code: "LIMIT_REACHED",
    };
  }
  return { ok: true as const };
}

export function importReservationIdFor(userId: string, requestKey: string): string {
  return `ir_${crypto.createHash("sha256").update(`${userId}:${requestKey}`).digest("hex").slice(0, 36)}`;
}

export async function reserveImport(
  userId: string,
  templateId?: string,
  opts: { requestKey?: string } = {}
) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) return { ok: false as const, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  const effectiveLimit = profile.importLimitOverride ?? planLimits(profile.plan).importLimit;
  // Schema migratsiyasiz cross-instance idempotency: requestKey'dan barqaror primary key.
  // Bir xil retry aynan shu ImportReservation qatorini topadi, yangi slot yaratilmaydi.
  const reservationId = opts.requestKey
    ? importReservationIdFor(userId, opts.requestKey)
    : undefined;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`import:${userId}`}))`;
    if (reservationId) {
      const existing = await tx.importReservation.findUnique({ where: { id: reservationId } });
      if (existing) {
        if (existing.userId !== userId || (existing.templateId || null) !== (templateId || null)) {
          return { ok: false as const, error: "Idempotency key was already used for a different import", code: "IDEMPOTENCY_CONFLICT" as const };
        }
        const replayDecision = importReservationReplayDecision(existing);
        if (replayDecision === "expired") {
          const expiredReplay = await tx.importReservation.updateMany({
            where: { id: existing.id, userId, status: "reserved" },
            data: { status: "expired" },
          });
          if (expiredReplay.count) {
            await tx.$executeRaw`UPDATE "PluginProfile" SET "importsTotal"=GREATEST(0,"importsTotal"-1), "importsMonth"=GREATEST(0,"importsMonth"-1) WHERE "userId"=${userId}`;
          }
          return {
            ok: false as const,
            error: "This import reservation expired — start a new import",
            code: "RESERVATION_REPLAY_TERMINAL" as const,
          };
        }
        if (replayDecision === "replay") {
          return {
            ok: true as const,
            reservationId: existing.id,
            expiresAt: existing.expiresAt,
            idempotentReplay: true as const,
          };
        }
        return {
          ok: false as const,
          error: "This import attempt has already finished — start a new import with a new request key",
          code: "RESERVATION_REPLAY_TERMINAL" as const,
        };
      }
    }
    const expired = await tx.importReservation.updateMany({
      where: { userId, status: "reserved", expiresAt: { lt: new Date() } },
      data: { status: "expired" },
    });
    if (expired.count) {
      await tx.$executeRaw`UPDATE "PluginProfile" SET "importsTotal"=GREATEST(0,"importsTotal"-${expired.count}), "importsMonth"=GREATEST(0,"importsMonth"-${expired.count}) WHERE "userId"=${userId}`;
    }
    const claimed = effectiveLimit === null
      ? await tx.pluginProfile.updateMany({ where: { userId, status: PluginAccountStatus.ACTIVE }, data: { importsTotal: { increment: 1 }, importsMonth: { increment: 1 }, lastSeenAt: new Date() } })
      : await tx.pluginProfile.updateMany({ where: { userId, status: PluginAccountStatus.ACTIVE, importsMonth: { lt: effectiveLimit } }, data: { importsTotal: { increment: 1 }, importsMonth: { increment: 1 }, lastSeenAt: new Date() } });
    if (!claimed.count) return { ok: false as const, error: "Monthly import limit reached — upgrade to Pro", code: "LIMIT_REACHED" };
    const row = await tx.importReservation.create({
      data: {
        ...(reservationId ? { id: reservationId } : {}),
        userId,
        templateId: templateId || null,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return { ok: true as const, reservationId: row.id, expiresAt: row.expiresAt, idempotentReplay: false as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function finishImportReservation(userId: string, reservationId: string, commit: boolean) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`import:${userId}`}))`;
    const current = await tx.importReservation.findFirst({
      where: { id: reservationId, userId },
      select: { status: true, expiresAt: true, templateId: true },
    });
    if (current?.status === "reserved" && current.expiresAt < new Date()) {
      const expired = await tx.importReservation.updateMany({
        where: { id: reservationId, userId, status: "reserved" },
        data: { status: "expired" },
      });
      if (expired.count) {
        await tx.$executeRaw`UPDATE "PluginProfile" SET "importsTotal"=GREATEST(0,"importsTotal"-1), "importsMonth"=GREATEST(0,"importsMonth"-1) WHERE "userId"=${userId}`;
      }
      return { ok: false, duplicate: false, templateId: current.templateId };
    }
    const changed = await tx.importReservation.updateMany({
      where: { id: reservationId, userId, status: "reserved" },
      data: { status: commit ? "committed" : "cancelled" },
    });
    if (!changed.count) {
      const row = await tx.importReservation.findFirst({ where: { id: reservationId, userId }, select: { status: true, templateId: true } });
      return { ok: row?.status === (commit ? "committed" : "cancelled"), duplicate: true, templateId: row?.templateId };
    }
    if (!commit) {
      await tx.$executeRaw`UPDATE "PluginProfile" SET "importsTotal"=GREATEST(0,"importsTotal"-1), "importsMonth"=GREATEST(0,"importsMonth"-1) WHERE "userId"=${userId}`;
    }
    const row = await tx.importReservation.findUnique({ where: { id: reservationId }, select: { templateId: true } });
    return { ok: true, duplicate: false, templateId: row?.templateId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * AI kredit-gate — har AI generatsiyadan OLDIN chaqiriladi. Server tomonda:
 *   1) oylik reset (aiCreditsResetAt < oy boshi bo'lsa plan ulushiga tiklash),
 *   2) ATOMIK kamaytirish — `updateMany` `aiCredits >= cost` sharti bilan, shu
 *      sabab parallel so'rovlarda balans manfiyga tushmaydi (race-safe).
 * Frontend hech qachon kredit hisobini boshqarmaydi.
 */
export async function consumeAiCredits(
  userId: string,
  cost: number,
  opts: {
    generationId?: string;
    /** Cross-instance idempotency claim (CreditLedger.sourceKey @unique). */
    sourceKey?: string;
    /** Optional durable assist record, created atomically with the charge. */
    operation?: {
      id: string;
      requestHash: string;
      type?: AiGenerationType;
    };
  } = {}
) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  }

  const operationGenerationId = opts.generationId || opts.operation?.id || null;
  const topupAllocationSourceKey = opts.sourceKey
    ? `${opts.sourceKey}:topup-allocation`
    : opts.generationId
      ? `gen:${opts.generationId}:topup-allocation`
      : null;

  const readTopupAllocation = async (): Promise<number> => {
    const marker = topupAllocationSourceKey
      ? await prisma.creditLedger.findUnique({ where: { sourceKey: topupAllocationSourceKey } })
      : operationGenerationId
        ? await prisma.creditLedger.findFirst({
            where: {
              userId,
              generationId: operationGenerationId,
              reason: TOPUP_CONSUME_ALLOCATION_REASON,
            },
          })
        : null;
    return marker?.userId === userId &&
      marker.reason === TOPUP_CONSUME_ALLOCATION_REASON &&
      marker.delta === 0
      ? Math.max(0, marker.balanceAfter ?? 0)
      : 0;
  };

  /** Unique sourceKey yutqazilganda oldingi claim aynan shu so'rovniki ekanini tekshiradi. */
  const idempotentReplay = async (expectedDelta: number) => {
    if (!opts.sourceKey) return null;
    const [prior, operation, fresh, topupConsumed] = await Promise.all([
      prisma.creditLedger.findUnique({ where: { sourceKey: opts.sourceKey } }),
      opts.operation
        ? prisma.aiGeneration.findUnique({ where: { id: opts.operation.id } })
        : Promise.resolve(null),
      prisma.pluginProfile.findUnique({ where: { userId }, select: { aiCredits: true } }),
      readTopupAllocation(),
    ]);
    const operationMatches = !opts.operation || (
      operation?.userId === userId &&
      operation.prompt === `assist:v1:${opts.operation.requestHash}`
    );
    if (
      prior?.userId === userId &&
      prior.reason === "consume" &&
      prior.delta === expectedDelta &&
      prior.generationId === operationGenerationId &&
      operationMatches
    ) {
      return {
        ok: true as const,
        remaining: fresh?.aiCredits ?? profile.aiCredits,
        topupConsumed,
        idempotentReplay: true as const,
      };
    }
    return {
      ok: false as const,
      error: "Idempotency key was already used for a different AI request",
      code: "IDEMPOTENCY_CONFLICT" as const,
      remaining: fresh?.aiCredits ?? profile.aiCredits,
    };
  };

  // ADMIN — cheksiz (ega erkin test qiladi); kredit kamaymaydi. sourceKey bo'lsa
  // provider xarajati ham 2× ketmasligi uchun delta=0 claim + assist row yoziladi.
  if (profile.user.role === "ADMIN") {
    if (!opts.sourceKey) return { ok: true as const, remaining: profile.aiCredits, topupConsumed: 0 };
    try {
      await prisma.$transaction(async (tx) => {
        await tx.creditLedger.create({
          data: {
            userId,
            generationId: operationGenerationId,
            delta: 0,
            reason: "consume",
            balanceAfter: profile.aiCredits,
            sourceKey: opts.sourceKey,
          },
        });
        if (opts.operation) {
          await tx.aiGeneration.create({
            data: {
              id: opts.operation.id,
              userId,
              type: opts.operation.type ?? AiGenerationType.SEARCH,
              prompt: `assist:v1:${opts.operation.requestHash}`,
              credits: 0,
              status: AiGenerationStatus.PENDING,
            },
          });
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { ok: true as const, remaining: profile.aiCredits, topupConsumed: 0, idempotentReplay: false as const };
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
      return (await idempotentReplay(0))!;
    }
  }

  // Email-verify gate — tasdiqlanmagan hisoblar AI kredit ISHLATOLMAYDI (bot
  // bepul-kredit abuzasini to'sadi). FAIL-CLOSED PRODUCTIONДА (Bosqich 1 #5):
  //   • dev → faqat email sozlangan bo'lsa (RESEND_API_KEY) majburlanadi (fail-open);
  //   • production → email sozlanmagan bo'lsa ham tasdiq TALAB qilinadi (fail-closed).
  // ⚠️ Productionда RESEND sozlanmasa yangi (tasdiqlanmagan) hisoblar kredit ishlatolmaydi.
  // Mavjud hisoblar migratsiyada grandfather qilingan (emailVerified backfill) → bloklanmaydi.
  const requireEmailVerify = isEmailConfigured() || process.env.NODE_ENV === "production";
  if (requireEmailVerify && !profile.user.emailVerified) {
    return {
      ok: false as const,
      error: "Please verify your email — click the link sent to your inbox (or resend it).",
      code: "EMAIL_NOT_VERIFIED",
    };
  }

  // Oylik reset — balansni o'qishdan OLDIN.
  // Bosqich 4 #5: reset balansni allotment + QOLGAN TOP-UP ga tiklaydi (avval faqat
  // allotment edi → sotib olingan sarflanmagan top-up yo'qolardi). aiCreditsTopup
  // (top-up ulushi tracker'i) o'zgarmaydi — u reset'da SAQLANADI.
  //
  // ⚠️ M1 (audit #5): reset ATOMIK bo'lishi SHART. Avval shartsiz absolyut yozuv edi
  // (`update` + `aiCredits: allotment + topup`) → oy boshida N ta parallel so'rov har biri
  // balansni to'liq ulushga qaytarardi (sarflanganini ham) → bepul kredit ZARB qilinadi.
  // Naqsh `resetMonthIfNeeded` (139-qator) bilan bir xil: guard WHERE'da, count===0 bo'lsa
  // reset boshqa so'rov tomonidan allaqachon bajarilgan → balansni QAYTA o'qiymiz.
  const start = monthStart();
  let available = profile.aiCredits;
  if (profile.aiCreditsResetAt < start) {
    const reset = await prisma.$queryRaw<Array<{ aiCredits: number }>>(Prisma.sql`
      UPDATE "PluginProfile"
      SET "aiCredits" = CASE "plan"::text
            WHEN 'PRO' THEN ${aiMonthlyAllotment(PluginPlanTier.PRO)}
            WHEN 'STUDIO' THEN ${aiMonthlyAllotment(PluginPlanTier.STUDIO)}
            ELSE ${aiMonthlyAllotment(PluginPlanTier.FREE)}
          END + "aiCreditsTopup",
          "aiCreditsResetAt" = ${start},
          "updatedAt" = NOW()
      WHERE "userId" = ${userId} AND "aiCreditsResetAt" < ${start}
      RETURNING "aiCredits"
    `);
    if (reset.length > 0) {
      available = reset[0].aiCredits;
    } else {
      // Boshqa parallel so'rov reset qildi → haqiqiy balansni qayta o'qi (eski
      // `profile.aiCredits` reset'dan OLDINGI qiymat, ishlatib bo'lmaydi).
      const fresh = await prisma.pluginProfile.findUnique({
        where: { userId },
        select: { aiCredits: true },
      });
      available = fresh?.aiCredits ?? profile.aiCredits;
    }
  }

  if (available < cost) {
    return {
      ok: false as const,
      error: "AI credits exhausted — wait for next month or upgrade to Pro",
      code: "AI_CREDITS_EXHAUSTED",
      remaining: available,
    };
  }

  // Kredit va top-up tracker BIR SQL statementda kamayadi/clamp bo'ladi. Parallel
  // consume/reset/topup stale balans bilan absolute write qila olmaydi.
  // Balans kamayishi va audit ledger BIR transaction: process aynan shu ikki yozuv
  // orasida o'lsa ham "yechildi, lekin izi yo'q" holati yuz bermaydi. generationId
  // reservation bilan bog'lansa stale reservation aniq refund qilinadi.
  let consumedResult: { aiCredits: number; topupConsumed: number } | null;
  try {
    consumedResult = await prisma.$transaction(async (tx) => {
      const consumed = await tx.$queryRaw<Array<{ aiCredits: number; topupConsumed: number }>>(Prisma.sql`
        WITH locked_profile AS (
          SELECT "userId", "aiCreditsTopup"
          FROM "PluginProfile"
          WHERE "userId" = ${userId} AND "aiCredits" >= ${cost}
          FOR UPDATE
        ), updated AS (
          UPDATE "PluginProfile" AS profile
          SET "aiCredits" = profile."aiCredits" - ${cost},
              "aiCreditsTopup" = LEAST(profile."aiCreditsTopup", profile."aiCredits" - ${cost}),
              "lastSeenAt" = NOW(),
              "updatedAt" = NOW()
          FROM locked_profile
          WHERE profile."userId" = locked_profile."userId"
          RETURNING profile."aiCredits", profile."aiCreditsTopup", locked_profile."aiCreditsTopup" AS "topupBefore"
        )
        SELECT "aiCredits",
               GREATEST(0, "topupBefore" - "aiCreditsTopup")::int AS "topupConsumed"
        FROM updated
      `);
      if (consumed.length === 0) return null;
      await tx.creditLedger.create({
        data: {
          userId,
          generationId: operationGenerationId,
          delta: -cost,
          reason: "consume",
          balanceAfter: consumed[0].aiCredits,
          sourceKey: opts.sourceKey || null,
        },
      });
      if (consumed[0].topupConsumed > 0 && operationGenerationId) {
        await tx.creditLedger.create({
          data: {
            userId,
            generationId: operationGenerationId,
            // Internal allocation marker: delta=0, `balanceAfter` top-updan aynan
            // qancha sarflanganini saqlaydi. Foydalanuvchi kredit tarixiga kirmaydi.
            delta: 0,
            reason: TOPUP_CONSUME_ALLOCATION_REASON,
            balanceAfter: consumed[0].topupConsumed,
            sourceKey: topupAllocationSourceKey,
          },
        });
      }
      if (opts.operation) {
        await tx.aiGeneration.create({
          data: {
            id: opts.operation.id,
            userId,
            type: opts.operation.type ?? AiGenerationType.SEARCH,
            prompt: `assist:v1:${opts.operation.requestHash}`,
            credits: cost,
            status: AiGenerationStatus.PENDING,
          },
        });
      }
      return consumed[0];
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    // Unique claim xatosi BUTUN transactionni, jumladan balans decrementini rollback qiladi.
    if ((e as { code?: string })?.code !== "P2002" || !opts.sourceKey) throw e;
    return (await idempotentReplay(-cost))!;
  }
  if (consumedResult == null) {
    return {
      ok: false as const,
      error: "AI credits exhausted — wait for next month or upgrade to Pro",
      code: "AI_CREDITS_EXHAUSTED",
      remaining: available,
    };
  }

  return {
    ok: true as const,
    remaining: consumedResult.aiCredits,
    topupConsumed: consumedResult.topupConsumed,
    idempotentReplay: false as const,
  };
}

/**
 * M6 (audit #40) — faol generatsiya SLOTINI atomik band qiladi.
 *
 * Ilgari `/gen` `count()` → `create()` qilardi (check-then-act): bir vaqtda kelgan N so'rov
 * hammasi bir xil `activeCount` ni ko'rib limitdan o'tib ketardi. Endi naqsh `consumeDownload`
 * bilan bir xil — guard WHERE ichida, `count === 0` → rad.
 *
 * DRIFT O'ZINI TUZATADI: hisoblagich (kutilmagan crash/qo'lda DB tahriri tufayli) haqiqatdan
 * yuqori bo'lib qolsa foydalanuvchi abadiy bloklanardi. Shu sabab claim rad etilganda
 * `Generation` jadvalidagi HAQIQIY faol sonni o'qiymiz: hisoblagich yuqori bo'lsa to'g'rilaymiz
 * va BIR marta qayta urinamiz.
 */
export async function claimGenerationSlot(
  userId: string,
  max: number
): Promise<{ ok: true } | { ok: false; active: number }> {
  const tryClaim = () =>
    prisma.pluginProfile.updateMany({
      where: { userId, activeGenerations: { lt: max } },
      data: { activeGenerations: { increment: 1 } },
    });

  let res = await tryClaim();
  if (res.count > 0) return { ok: true };

  // Rad etildi — hisoblagich haqiqatga mos keladimi? (drift rekonsiliatsiyasi)
  const real = await prisma.generation.count({
    where: { userId, status: { in: ["queued", "running"] } },
  });
  const prof = await prisma.pluginProfile.findUnique({
    where: { userId },
    select: { activeGenerations: true },
  });
  const counter = prof?.activeGenerations ?? 0;
  if (counter > real) {
    console.warn(
      `[gen-slots] hisoblagich drifti tuzatildi: user=${userId} counter=${counter} real=${real}`
    );
    await prisma.pluginProfile.updateMany({
      where: { userId, activeGenerations: counter },
      data: { activeGenerations: real },
    });
    res = await tryClaim();
    if (res.count > 0) return { ok: true };
  }
  return { ok: false, active: Math.max(real, counter) };
}

/** M6 — slotni bo'shatadi (terminal holat yoki `create` xatosidan keyin). 0 dan pastga tushmaydi. */
export async function releaseGenerationSlot(userId: string): Promise<void> {
  await prisma.pluginProfile
    .updateMany({
      where: { userId, activeGenerations: { gt: 0 } },
      data: { activeGenerations: { decrement: 1 } },
    })
    .catch((e) => console.error("[gen-slots] release xato:", e));
}

/** Refund so'rovi ledger'da shu generation uchun yechilgan summadan oshmasin. */
export function ledgerBackedGenerationRefund(
  requestedCost: number,
  consumeDeltaSum: number | null | undefined
): number {
  const requested = Number.isFinite(requestedCost) ? Math.max(0, Math.floor(requestedCost)) : 0;
  const charged = Number.isFinite(consumeDeltaSum)
    ? Math.max(0, -Math.floor(consumeDeltaSum as number))
    : 0;
  return Math.min(requested, charged);
}

export function shouldUpdateGenerationRefundState(opts: {
  generationId?: string;
  consumeSourceKey?: string;
}): boolean {
  return Boolean(opts.generationId && !opts.consumeSourceKey);
}

export async function writeGenerationRefundState(
  db: {
    generation: {
      update(args: {
        where: { id: string };
        data: { refundStatus: string; refundApplied: number };
      }): Promise<unknown>;
    };
  },
  opts: { generationId?: string; consumeSourceKey?: string },
  applied: number
): Promise<boolean> {
  if (!shouldUpdateGenerationRefundState(opts)) return false;
  await db.generation.update({
    where: { id: opts.generationId! },
    data: { refundStatus: "applied", refundApplied: applied },
  });
  return true;
}

/**
 * Provayder xato bersa sarflangan kreditni qaytaradi (foydalanuvchi bekorga to'lamasin).
 *
 * (#2.3) IKKI himoya:
 *   1) Oy-chegarasi leak'ni to'sish: refund balansni oylik ulushdan (allotment) OSHIRMAYDI —
 *      oy reset'idan keyin eski failed gen refund'i tekin kredit "yaratmasin". Lekin mavjud
 *      (admin top-up) balansni ham KAMAYTIRMAYDI.
 *   2) Idempotent (generationId berilsa): bir gen faqat BIR marta refund qilinadi — atomik
 *      `refunded=false → true` claim; claim yutmasa kredit qaytarilmaydi (double-refund guard).
 *
 * ADMIN consume paytida kredit kamaytirmaydi (cheksiz) → refund ham QILMASLIK kerak (simmetriya).
 */
export async function refundAiCredits(
  userId: string,
  cost: number,
  opts: {
    generationId?: string;
    /** Refund ledger claim (unique); cross-instance retry uchun. */
    sourceKey?: string;
    /** Refund faqat shu consume claim haqiqatan debit qilgan summagacha. */
    consumeSourceKey?: string;
    /** Kalitsiz legacy sinxron oqim uchun consume natijasidagi pullik top-up ulushi. */
    topupConsumed?: number;
  } = {}
): Promise<number | null> {
  if (cost <= 0) return null;
  try {
    return await prisma.$transaction(async (tx) => {
    const prof = await tx.pluginProfile.findUnique({
      where: { userId },
      include: { user: { select: { role: true } } },
    });
    if (!prof || prof.user.role === "ADMIN") return prof?.aiCredits ?? null;

    let topupConsumed = Number.isFinite(opts.topupConsumed)
      ? Math.max(0, Math.floor(opts.topupConsumed as number))
      : 0;
    if (opts.consumeSourceKey) {
      const consume = await tx.creditLedger.findUnique({ where: { sourceKey: opts.consumeSourceKey } });
      const refundableCost = consume?.userId === userId && consume.reason === "consume"
        ? ledgerBackedGenerationRefund(cost, consume.delta)
        : 0;
      // ADMIN delta=0 yoki claim topilmagan bo'lsa kredit yaratilmaydi.
      if (refundableCost <= 0) return prof.aiCredits;
      cost = refundableCost;
      if (opts.topupConsumed == null) {
        const allocation = await tx.creditLedger.findUnique({
          where: { sourceKey: `${opts.consumeSourceKey}:topup-allocation` },
        });
        topupConsumed = allocation?.userId === userId &&
          allocation.reason === TOPUP_CONSUME_ALLOCATION_REASON &&
          allocation.generationId === (opts.generationId ?? null) &&
          allocation.delta === 0
          ? Math.max(0, allocation.balanceAfter ?? 0)
          : 0;
      }
    } else if (opts.generationId) {
      // Refund faqat shu generation uchun HAQIQATAN ledger'da yechilgan kreditdan
      // chiqishi mumkin. Reservation daily-cap/storage/slot/insufficient-credit sabab
      // consume'dan oldin `failed` bo'lgan bo'lsa, cost>0 bo'lsa ham kredit YARATILMAYDI.
      const charged = await tx.creditLedger.aggregate({
        where: {
          generationId: opts.generationId,
          userId,
          reason: "consume",
          delta: { lt: 0 },
        },
        _sum: { delta: true },
      });
      const refundableCost = ledgerBackedGenerationRefund(cost, charged._sum.delta);
      if (refundableCost <= 0) {
        await tx.generation.updateMany({
          where: { id: opts.generationId, userId, refunded: false },
          data: { refundStatus: "not_required", refundApplied: 0 },
        });
        return prof.aiCredits;
      }
      cost = refundableCost;
      if (opts.topupConsumed == null) {
        const allocation = await tx.creditLedger.aggregate({
          where: {
            generationId: opts.generationId,
            userId,
            reason: TOPUP_CONSUME_ALLOCATION_REASON,
            delta: 0,
          },
          _sum: { balanceAfter: true },
        });
        topupConsumed = Math.max(0, allocation._sum.balanceAfter ?? 0);
      }
      const claim = await tx.generation.updateMany({
        where: { id: opts.generationId, userId, refunded: false },
        data: { refunded: true, refundStatus: "pending" },
      });
      if (claim.count === 0) return prof.aiCredits;
    }

    const allot = aiMonthlyAllotment(prof.plan);
    const refundPlan = creditRefundPlan({
      cost,
      currentBalance: prof.aiCredits,
      currentTopup: prof.aiCreditsTopup,
      monthlyAllotment: allot,
      topupConsumed,
    });
    const { applied, topupApplied } = refundPlan;
    const after = applied > 0
      ? await tx.pluginProfile.update({
          where: { userId },
          data: {
            aiCredits: { increment: applied },
            ...(topupApplied > 0 ? { aiCreditsTopup: { increment: topupApplied } } : {}),
          },
          select: { aiCredits: true },
        })
      : { aiCredits: prof.aiCredits };

    await tx.creditLedger.create({
      data: {
        userId,
        generationId: opts.generationId ?? null,
        delta: applied,
        reason: "refund",
        balanceAfter: after.aiCredits,
        sourceKey: opts.sourceKey ?? (opts.generationId ? `gen:${opts.generationId}:refund` : null),
      },
    });
    // consumeSourceKey = AiGeneration assist operatsiyasi bo'lishi mumkin; uning ID'si
    // Generation jadvalida YO'Q. Faqat haqiqiy Studio Generation refund state'ini yangilaymiz.
    await writeGenerationRefundState(tx, opts, applied);
    if (applied < cost) {
      console.warn(`[credits] refund capped: user=${userId} requested=${cost} credited=${applied} gen=${opts.generationId ?? "-"}`);
    }
    return after.aiCredits;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002" || !opts.sourceKey) throw e;
    const [prior, consume] = await Promise.all([
      prisma.creditLedger.findUnique({ where: { sourceKey: opts.sourceKey } }),
      opts.consumeSourceKey
        ? prisma.creditLedger.findUnique({ where: { sourceKey: opts.consumeSourceKey } })
        : Promise.resolve(null),
    ]);
    const consumeBound = !opts.consumeSourceKey || (
      consume?.userId === userId &&
      consume.reason === "consume" &&
      consume.generationId === (opts.generationId ?? null) &&
      consume.delta <= 0
    );
    if (
      prior?.userId !== userId ||
      prior.reason !== "refund" ||
      prior.generationId !== (opts.generationId ?? null) ||
      prior.delta < 0 ||
      !consumeBound
    ) throw e;
    const profile = await prisma.pluginProfile.findUnique({ where: { userId }, select: { aiCredits: true } });
    return profile?.aiCredits ?? null;
  }
}

export function formatLastSeen(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Hozir";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} daq oldin`;
  if (diff < 86_400_000) return "Bugun";
  return d.toLocaleDateString("uz-UZ");
}

export function mapSubscriberRow(
  profile: Awaited<ReturnType<typeof ensurePluginProfile>> & {
    user: { email: string; name: string | null };
  },
  tokenOk: boolean
) {
  const limits = planLimits(profile.plan);
  return {
    id: profile.userId,
    name: profile.user.name || profile.user.email.split("@")[0],
    email: profile.user.email,
    status: profile.status.toLowerCase(),
    plan: limits.label,
    downloads: profile.downloadsTotal,
    downloadsMonth: profile.downloadsMonth,
    imports: profile.importsTotal,
    tokenOk,
    lastSeen: formatLastSeen(profile.lastSeenAt),
    lastSeenAt: profile.lastSeenAt ? new Date(profile.lastSeenAt).toISOString() : null,
    // Audit §C (P1) — YAGONA onlayn predikati (oxirgi 60 daqiqa): UI regex bilan
    // humanized labelni parse qilmasin (u "Hozir"ni tushirib qoldirardi).
    online: !!profile.lastSeenAt && Date.now() - new Date(profile.lastSeenAt).getTime() < 3_600_000,
    device: profile.deviceLabel || "—",
    ae: profile.aeVersion || "—",
    downloadLimit: limits.downloadLimit,
    unlimitedDownloads: limits.unlimitedDownloads,
    downloadLimitOverride: profile.downloadLimitOverride ?? null,
    importLimitOverride: profile.importLimitOverride ?? null,
    aiCredits: profile.aiCredits,
    aiCreditsMonthly: aiMonthlyAllotment(profile.plan),
  };
}
