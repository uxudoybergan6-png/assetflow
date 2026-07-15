import {
  PluginAccountStatus,
  PluginPlanTier,
  SubscriptionStatus,
  prisma,
} from "@creative-tools/database";
import { isEmailConfigured } from "./email.js";
import { avatarPublicUrl } from "./app-urls.js";
import { writeCreditLedger } from "./ledger.js";

const FREE_DOWNLOAD_LIMIT = 15;
const FREE_IMPORT_LIMIT = 10;

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
  planCfgFetchedAt = Date.now();
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
  // Flag yo'q/false → PRO BERILMAYDI (NODE_ENV'ga TAYANMAYMIZ; render.yaml'da "false").
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
    const stripePro = await subscriptionIsPro(userId);
    if (!proSwitchAllowed(stripePro)) {
      return {
        ok: false as const,
        error: "PRO requires a Stripe subscription (or admin approval)",
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
export async function applyBillingPlan(userId: string, plan: PluginPlanTier) {
  const profile = await ensurePluginProfile(userId);
  const changingPlan = profile.plan !== plan;
  const data: { plan: PluginPlanTier; aiCredits?: number } = { plan };

  // Bosqich 4 #5: sotib olingan TOP-UP har plan o'zgarishida saqlanadi.
  if (plan === PluginPlanTier.FREE) {
    const freeAllot = aiMonthlyAllotment(PluginPlanTier.FREE) + profile.aiCreditsTopup;
    if (profile.aiCredits > freeAllot) data.aiCredits = freeAllot;
  } else if (changingPlan) {
    const allot = aiMonthlyAllotment(plan) + profile.aiCreditsTopup;
    if (profile.aiCredits < allot) data.aiCredits = allot;
  }

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
  opts: { reason?: string } = {}
) {
  if (!Number.isFinite(amount) || amount <= 0) return { balance: null as number | null };
  await ensurePluginProfile(userId);
  const updated = await prisma.pluginProfile.update({
    where: { userId },
    data: {
      aiCredits: { increment: Math.floor(amount) },
      aiCreditsTopup: { increment: Math.floor(amount) },
    },
    select: { aiCredits: true },
  });
  await writeCreditLedger({
    userId,
    delta: Math.floor(amount),
    reason: opts.reason ?? "topup",
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
  for (const p of profiles) {
    const isActive = await subscriptionIsPro(p.userId);
    const target = isActive ? PluginPlanTier.PRO : PluginPlanTier.FREE;
    if (p.plan !== target) {
      await syncPluginPlanFromStripe(p.userId, isActive);
      changed++;
    }
  }
  return { total: profiles.length, changed };
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
export async function consumeDownload(userId: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  }
  const limits = planLimits(profile.plan);
  const effectiveLimit = profile.downloadLimitOverride ?? limits.downloadLimit;

  // Cheksiz (Pro yoki admin override = null) — hisob yuritamiz, lekin to'smaymiz.
  if (effectiveLimit === null) {
    await prisma.pluginProfile.update({
      where: { userId },
      data: {
        downloadsTotal: { increment: 1 },
        downloadsMonth: { increment: 1 },
        lastSeenAt: new Date(),
      },
    });
    return { ok: true as const };
  }

  // Atomik: faqat oylik limit ichida bo'lsa oshiradi (race-safe guard WHERE'da).
  const res = await prisma.pluginProfile.updateMany({
    where: {
      userId,
      status: PluginAccountStatus.ACTIVE,
      downloadsMonth: { lt: effectiveLimit },
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
      code: "LIMIT_REACHED",
    };
  }
  return { ok: true as const };
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

/**
 * AI kredit-gate — har AI generatsiyadan OLDIN chaqiriladi. Server tomonda:
 *   1) oylik reset (aiCreditsResetAt < oy boshi bo'lsa plan ulushiga tiklash),
 *   2) ATOMIK kamaytirish — `updateMany` `aiCredits >= cost` sharti bilan, shu
 *      sabab parallel so'rovlarda balans manfiyga tushmaydi (race-safe).
 * Frontend hech qachon kredit hisobini boshqarmaydi.
 */
export async function consumeAiCredits(userId: string, cost: number) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  }

  // ADMIN — cheksiz (ega erkin test qiladi); kredit kamaymaydi.
  if (profile.user.role === "ADMIN") {
    return { ok: true as const, remaining: profile.aiCredits };
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
  const start = monthStart();
  let available = profile.aiCredits;
  if (profile.aiCreditsResetAt < start) {
    const reset = await prisma.pluginProfile.update({
      where: { userId },
      data: {
        aiCredits: aiMonthlyAllotment(profile.plan) + profile.aiCreditsTopup,
        aiCreditsResetAt: start,
      },
    });
    available = reset.aiCredits;
  }

  if (available < cost) {
    return {
      ok: false as const,
      error: "AI credits exhausted — wait for next month or upgrade to Pro",
      code: "AI_CREDITS_EXHAUSTED",
      remaining: available,
    };
  }

  // Atomik: faqat balans yetarli bo'lsa kamaytiradi
  const res = await prisma.pluginProfile.updateMany({
    where: { userId, aiCredits: { gte: cost } },
    data: { aiCredits: { decrement: cost }, lastSeenAt: new Date() },
  });
  if (res.count === 0) {
    return {
      ok: false as const,
      error: "AI credits exhausted — wait for next month or upgrade to Pro",
      code: "AI_CREDITS_EXHAUSTED",
      remaining: available,
    };
  }

  // Bosqich 4 #5: top-up tracker'ni yangi balansga clamp (allotment AVVAL sarflanadi;
  // balans top-up chizig'idan pastga tushsagina top-up ulushi kamayadi). Bu tracker
  // MONEY-GATE emas (atomik gate yuqorida aiCredits ustida) — best-effort follow-up.
  const newBalance = available - cost;
  if (profile.aiCreditsTopup > newBalance) {
    await prisma.pluginProfile
      .updateMany({ where: { userId }, data: { aiCreditsTopup: Math.max(0, newBalance) } })
      .catch(() => {});
  }

  // Moliyaviy izi (#2.6) — atomik kamaytirishdan KEYIN, best-effort (bloklamaydi).
  await writeCreditLedger({
    userId,
    delta: -cost,
    reason: "consume",
    balanceAfter: available - cost,
  });

  return { ok: true as const, remaining: available - cost };
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
  opts: { generationId?: string } = {}
) {
  if (cost <= 0) return;
  const prof = await prisma.pluginProfile.findUnique({
    where: { userId },
    include: { user: { select: { role: true } } },
  });
  if (!prof || prof.user.role === "ADMIN") return;

  // Idempotent per-generation: faqat hali refund qilinmagan gen refund qilinadi (atomik claim).
  if (opts.generationId) {
    const claim = await prisma.generation.updateMany({
      where: { id: opts.generationId, refunded: false },
      data: { refunded: true },
    });
    if (claim.count === 0) return; // allaqachon refund qilingan → qayta refund YO'Q
  }

  // Oy-chegarasi cap: refund allotment + TOP-UP dan oshirmaydi (Bosqich 4 #5 — top-up'dan
  // moliyalangan gen refund'i allotment'gacha qirqilmasin), lekin mavjud balansni kamaytirmaydi.
  // Refund faqat aiCredits'ni oshiradi → invariant (aiCreditsTopup <= aiCredits) saqlanadi.
  const allot = aiMonthlyAllotment(prof.plan);
  const ceiling = Math.max(allot + prof.aiCreditsTopup, prof.aiCredits);
  const newBalance = Math.min(prof.aiCredits + cost, ceiling);
  const credited = newBalance - prof.aiCredits;
  if (credited > 0) {
    // updateMany → profil yo'q bo'lsa no-op (update P2025 throw EMAS).
    await prisma.pluginProfile.updateMany({
      where: { userId },
      data: { aiCredits: newBalance },
    });
  }
  // Moliyaviy izi (#2.6) — haqiqiy qaytarilgan miqdor (cap tufayli cost'dan kam bo'lishi mumkin).
  await writeCreditLedger({
    userId,
    generationId: opts.generationId ?? null,
    delta: credited,
    reason: "refund",
    balanceAfter: newBalance,
  });
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
