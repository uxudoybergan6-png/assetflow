import {
  PluginAccountStatus,
  PluginPlanTier,
  SubscriptionStatus,
  prisma,
} from "@creative-tools/database";

const FREE_DOWNLOAD_LIMIT = 15;
const FREE_IMPORT_LIMIT = 10;

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
  if (process.env.PLUGIN_ALLOW_PRO_WITHOUT_STRIPE === "true") return true;
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
  const limits = planLimits(profile.plan);
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
    limits,
    stripeSubscriptionActive: stripeActive,
    stripeStatus: sub?.status ?? null,
    lastSeenAt: profile.lastSeenAt?.toISOString() ?? null,
    deviceLabel: profile.deviceLabel,
    aeVersion: profile.aeVersion,
  };
}

export async function recordPluginDownload(userId: string, templateId?: string) {
  const profile = await ensurePluginProfile(userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    return { ok: false as const, error: "Hisob faol emas" };
  }
  const limits = planLimits(profile.plan);
  if (!limits.unlimitedDownloads && profile.downloadsMonth >= (limits.downloadLimit ?? 0)) {
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
  if (!limits.unlimitedImports && profile.importsTotal >= (limits.importLimit ?? 0)) {
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
  };
}
