import {
  PluginAccountStatus,
  PluginPlanTier,
  SubscriptionStatus,
  prisma,
} from "@creative-tools/database";

const FREE_DOWNLOAD_LIMIT = 15;
const FREE_IMPORT_LIMIT = 10;

/** Oylik AI kredit ulushi — har oy boshida shu qiymatga tiklanadi. */
export const AI_MONTHLY_CREDITS = {
  [PluginPlanTier.FREE]: 50,
  [PluginPlanTier.PRO]: 1000,
} as const;

export function aiMonthlyAllotment(plan: PluginPlanTier) {
  return AI_MONTHLY_CREDITS[plan] ?? AI_MONTHLY_CREDITS[PluginPlanTier.FREE];
}

export function planLimits(plan: PluginPlanTier) {
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
  const profile = await prisma.pluginProfile.findUnique({ where: { userId } });
  if (!profile) return;
  const start = monthStart();
  if (profile.monthResetAt >= start) return;
  await prisma.pluginProfile.update({
    where: { userId },
    data: { downloadsMonth: 0, monthResetAt: start },
  });
}

export async function ensurePluginProfile(userId: string) {
  await resetMonthIfNeeded(userId);
  return prisma.pluginProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
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
  if (hasStripePro) return true;
  if (process.env.PLUGIN_ALLOW_PRO_WITHOUT_STRIPE === "true" && process.env.NODE_ENV !== "production") return true;
  return process.env.NODE_ENV !== "production";
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
    limits,
    stripeSubscriptionActive: stripeActive,
    stripeStatus: sub?.status ?? null,
    lastSeenAt: profile.lastSeenAt?.toISOString() ?? null,
    deviceLabel: profile.deviceLabel,
    aeVersion: profile.aeVersion,
  };
}

/**
 * Yuklab olishdan OLDIN limit tekshiruvi (increment QILMAYDI — haqiqiy
 * hisoblash /usage/download orqali bo'ladi). Pack/MOGRT download route'i
 * shu gate orqali Free/Pro limitni server tomonda majburlaydi —
 * localStorage'dagi tarif bilan chetlab o'tib bo'lmaydi.
 */
export async function checkDownloadAllowed(userId: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Hisob faol emas", code: "ACCOUNT_INACTIVE" };
  }
  const limits = planLimits(profile.plan);
  const effectiveDownloadLimit = profile.downloadLimitOverride ?? limits.downloadLimit;
  if (effectiveDownloadLimit !== null && profile.downloadsMonth >= effectiveDownloadLimit) {
    return {
      ok: false as const,
      error: "Oylik yuklab olish limiti tugadi — Pro tarifga o'ting",
      code: "LIMIT_REACHED",
    };
  }
  return { ok: true as const };
}

export async function recordPluginDownload(userId: string, templateId?: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Hisob faol emas" };
  }
  const limits = planLimits(profile.plan);
  const effectiveDownloadLimit = profile.downloadLimitOverride ?? limits.downloadLimit;
  if (effectiveDownloadLimit !== null && profile.downloadsMonth >= effectiveDownloadLimit) {
    return { ok: false as const, error: "Oylik yuklab olish limiti tugadi" };
  }

  const updated = await prisma.pluginProfile.update({
    where: { userId },
    data: {
      downloadsTotal: { increment: 1 },
      downloadsMonth: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });

  return { ok: true as const, profile: updated, templateId };
}

export async function recordPluginImport(userId: string, templateId?: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Hisob faol emas" };
  }
  const limits = planLimits(profile.plan);
  const effectiveImportLimit = profile.importLimitOverride ?? limits.importLimit;
  if (effectiveImportLimit !== null && profile.importsTotal >= effectiveImportLimit) {
    return { ok: false as const, error: "Import limiti tugadi" };
  }

  const updated = await prisma.pluginProfile.update({
    where: { userId },
    data: {
      importsTotal: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });

  return { ok: true as const, profile: updated, templateId };
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

  // Oylik reset — balansni o'qishdan OLDIN
  const start = monthStart();
  let available = profile.aiCredits;
  if (profile.aiCreditsResetAt < start) {
    const reset = await prisma.pluginProfile.update({
      where: { userId },
      data: { aiCredits: aiMonthlyAllotment(profile.plan), aiCreditsResetAt: start },
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

  return { ok: true as const, remaining: available - cost };
}

/** Provayder xato bersa sarflangan kreditni qaytaradi (foydalanuvchi bekorga to'lamasin). */
export async function refundAiCredits(userId: string, cost: number) {
  if (cost <= 0) return;
  await prisma.pluginProfile.update({
    where: { userId },
    data: { aiCredits: { increment: cost } },
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
