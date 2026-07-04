import {
  PluginAccountStatus,
  PluginPlanTier,
  SubscriptionStatus,
  prisma,
} from "@creative-tools/database";
import { isEmailConfigured } from "./email.js";
import { writeCreditLedger } from "./ledger.js";

const FREE_DOWNLOAD_LIMIT = 15;
const FREE_IMPORT_LIMIT = 10;

/** Oylik AI kredit ulushi — har oy boshida shu qiymatga tiklanadi. */
export const AI_MONTHLY_CREDITS = {
  [PluginPlanTier.FREE]: 50,
  [PluginPlanTier.PRO]: 1000,
  [PluginPlanTier.STUDIO]: 6000,
} as const;

export function aiMonthlyAllotment(plan: PluginPlanTier) {
  return AI_MONTHLY_CREDITS[plan] ?? AI_MONTHLY_CREDITS[PluginPlanTier.FREE];
}

/** Pullik (obunali) tarifmi? FREE emas => PRO yoki STUDIO. Template-tier
    gate'lari (Pro shablonlar) uchun: PRO va STUDIO ikkalasi ham ochiq. */
export function isPaidPlan(plan: PluginPlanTier) {
  return plan !== PluginPlanTier.FREE;
}

export function planLimits(plan: PluginPlanTier) {
  if (plan === PluginPlanTier.STUDIO) {
    return {
      plan: "studio" as const,
      label: "Studio",
      unlimitedDownloads: true,
      unlimitedImports: true,
      downloadLimit: null,
      importLimit: null,
      maxResolution: "4K",
    };
  }
  if (plan === PluginPlanTier.PRO) {
    return {
      plan: "pro" as const,
      label: "Pro",
      unlimitedDownloads: true,
      unlimitedImports: true,
      downloadLimit: null,
      importLimit: null,
      maxResolution: "4K",
    };
  }
  return {
    plan: "free" as const,
    label: "Free",
    unlimitedDownloads: false,
    unlimitedImports: false,
    downloadLimit: FREE_DOWNLOAD_LIMIT,
    importLimit: FREE_IMPORT_LIMIT,
    maxResolution: "1080p",
  };
}

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function resetMonthIfNeeded(userId: string) {
  // ATOMIK: guard WHERE'da (monthResetAt < oy boshi). Avvalgi find->check->update
  // TOCTOU oynasini yopadi — parallel so'rovlarda faqat BITTA reset o'tadi
  // (count===0 bo'lsa hech narsa qilinmaydi). consumeDownload kabi (#1 naqsh).
  // Semantika o'zgarmaydi: faqat downloadsMonth tiklanadi (aiCredits emas —
  // u consumeAiCredits ichida alohida reset bo'ladi).
  const start = monthStart();
  await prisma.pluginProfile.updateMany({
    where: { userId, monthResetAt: { lt: start } },
    data: { downloadsMonth: 0, monthResetAt: start },
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
    return { ok: false as const, error: "Hisob bloklangan" };
  }
  if (profile.status === PluginAccountStatus.REMOVED) {
    return { ok: false as const, error: "Hisob o‘chirilgan" };
  }

  if (plan === PluginPlanTier.PRO) {
    const stripePro = await subscriptionIsPro(userId);
    if (!proSwitchAllowed(stripePro)) {
      return {
        ok: false as const,
        error: "PRO uchun Stripe obunasi kerak (yoki admin tasdiqlashi)",
      };
    }
  }

  const updated = await prisma.pluginProfile.update({
    where: { userId },
    data: { plan },
  });
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
    role: profile.user.role,
    plan: profile.plan.toLowerCase(),
    planLabel: limits.label,
    status: profile.status.toLowerCase(),
    downloadsTotal: profile.downloadsTotal,
    downloadsMonth: profile.downloadsMonth,
    importsTotal: profile.importsTotal,
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
    return { ok: false as const, error: "Hisob faol emas", code: "ACCOUNT_INACTIVE" };
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
      error: "Oylik yuklab olish limiti tugadi — Pro tarifga o'ting",
      code: "LIMIT_REACHED",
    };
  }
  return { ok: true as const };
}

/**
 * Importni ATOMIK hisoblaydi + import limitini MAJBURLAYDI. Plagin AE ga
 * import qilishdan OLDIN /usage/import orqali shu funksiyani chaqiradi
 * (kesh'langan qayta-import ham — fayl lokal bo'lsa ham gate'dan o'tadi);
 * limit tugagan bo'lsa LIMIT_REACHED qaytadi va import bloklanadi. Import
 * limiti `importsTotal` (umrlik) bo'yicha — mavjud semantika saqlanadi.
 */
export async function consumeImport(userId: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Hisob faol emas", code: "ACCOUNT_INACTIVE" };
  }
  const limits = planLimits(profile.plan);
  const effectiveLimit = profile.importLimitOverride ?? limits.importLimit;

  if (effectiveLimit === null) {
    await prisma.pluginProfile.update({
      where: { userId },
      data: { importsTotal: { increment: 1 }, lastSeenAt: new Date() },
    });
    return { ok: true as const };
  }

  const res = await prisma.pluginProfile.updateMany({
    where: {
      userId,
      status: PluginAccountStatus.ACTIVE,
      importsTotal: { lt: effectiveLimit },
    },
    data: { importsTotal: { increment: 1 }, lastSeenAt: new Date() },
  });
  if (res.count === 0) {
    return {
      ok: false as const,
      error: "Import limiti tugadi — Pro tarifga o'ting",
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
    return { ok: false as const, error: "Hisob faol emas", code: "ACCOUNT_INACTIVE" };
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
      error: "Emailingizni tasdiqlang — pochtangizga yuborilgan havolani bosing (yoki qayta yuboring).",
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
      error: "AI kreditlari tugadi — keyingi oyni kuting yoki Pro tarifga o'ting",
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
      error: "AI kreditlari tugadi — keyingi oyni kuting yoki Pro tarifga o'ting",
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
