import { Router } from "express";
import { z } from "zod";
import {
  PluginAccountStatus,
  PluginPlanTier,
  prisma,
} from "@creative-tools/database";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  ensurePluginProfile,
  mapSubscriberRow,
} from "../lib/plugin-profile.js";
import {
  getSignedUploadUrl,
  getPublicUrl,
  isS3Configured,
} from "../lib/s3.js";
import { writeAuditLog } from "../lib/audit-log.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.post("/upload-url", async (req, res) => {
  const { fileName, contentType, folder } = req.body as {
    fileName?: string;
    contentType?: string;
    folder?: string;
  };

  if (!fileName || !contentType) {
    res.status(400).json({ error: "fileName and contentType required" });
    return;
  }

  if (!isS3Configured()) {
    const key = `${folder ?? "assets"}/${Date.now()}-${fileName}`;
    res.json({
      uploadUrl: null,
      key,
      publicUrl: getPublicUrl(key),
      mock: true,
      message: "S3 not configured — set AWS_* env vars for production uploads",
    });
    return;
  }

  const key = `${folder ?? "assets"}/${Date.now()}-${fileName}`;
  const uploadUrl = await getSignedUploadUrl(key, contentType);
  res.json({ uploadUrl, key, publicUrl: getPublicUrl(key) });
});

adminRouter.get("/users", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = 20;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscription: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);
  res.json({ items, total, page, pageSize });
});

adminRouter.patch("/users/:id/role", async (req, res) => {
  const role = req.body.role === "ADMIN" ? "ADMIN" : "USER";
  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { role },
  });
  res.json({ id: user.id, role: user.role });
});

/** AE Browse obunachilari — haqiqiy DB */
adminRouter.get("/plugin-subscribers", async (_req, res) => {
  const profiles = await prisma.pluginProfile.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const userIds = profiles.map((p) => p.userId);
  const tokens = await prisma.pluginToken.findMany({
    where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  const tokenOk = new Set(tokens.map((t) => t.userId));

  const items = await Promise.all(
    profiles.map(async (row) => {
      const full = await ensurePluginProfile(row.userId);
      return mapSubscriberRow(full, tokenOk.has(row.userId));
    })
  );

  const active = items.filter((s) => s.status === "active");
  res.json({
    items,
    stats: {
      total: items.length,
      active: active.length,
      blocked: items.filter((s) => s.status === "blocked").length,
      removed: items.filter((s) => s.status === "removed").length,
      online: active.filter((s) => /Hozir|daq|Bugun/i.test(s.lastSeen)).length,
      totalDownloads: items.reduce((a, s) => a + s.downloads, 0),
      free: items.filter((s) => s.plan === "Free" && s.status !== "removed").length,
      pro: items.filter((s) => s.plan === "Pro" && s.status !== "removed").length,
    },
  });
});

/** AE Browse — agregat analitika (dashboard kartochkalari uchun) */
adminRouter.get("/plugin-analytics", async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [agg, byPlan, byStatus, total, weekActive, dayActive] =
    await Promise.all([
      prisma.pluginProfile.aggregate({
        _sum: {
          downloadsTotal: true,
          downloadsMonth: true,
          importsTotal: true,
        },
      }),
      prisma.pluginProfile.groupBy({ by: ["plan"], _count: { _all: true } }),
      prisma.pluginProfile.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.pluginProfile.count(),
      prisma.pluginProfile.count({ where: { lastSeenAt: { gte: weekAgo } } }),
      prisma.pluginProfile.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    ]);

  const planCounts: Record<string, number> = { free: 0, pro: 0 };
  byPlan.forEach((g) => {
    planCounts[g.plan.toLowerCase()] = g._count._all;
  });

  const statusCounts: Record<string, number> = {
    active: 0,
    blocked: 0,
    removed: 0,
  };
  byStatus.forEach((g) => {
    statusCounts[g.status.toLowerCase()] = g._count._all;
  });

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const auditRows = await prisma.studioAuditLog.findMany({
    where: { createdAt: { gte: since30 } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const activityByDay = Array.from({ length: 30 }, () => 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  for (const row of auditRows) {
    const d = new Date(row.createdAt);
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((todayStart.getTime() - d.getTime()) / dayMs);
    if (idx >= 0 && idx < 30) activityByDay[29 - idx]++;
  }

  const reviewed = await prisma.contributorTemplate.groupBy({
    by: ["reviewStatus"],
    _count: { _all: true },
  });
  const approved = reviewed.find((r) => r.reviewStatus === "APPROVED")?._count._all ?? 0;
  const rejected = reviewed.find((r) => r.reviewStatus === "REJECTED")?._count._all ?? 0;
  const decided = approved + rejected;
  const approvalRatePct = decided ? Math.round((approved / decided) * 100) : null;

  res.json({
    subscribers: {
      total,
      activeLast7d: weekActive,
      activeLast24h: dayActive,
      byPlan: planCounts,
      byStatus: statusCounts,
    },
    usage: {
      downloadsTotal: agg._sum.downloadsTotal ?? 0,
      downloadsThisMonth: agg._sum.downloadsMonth ?? 0,
      importsTotal: agg._sum.importsTotal ?? 0,
    },
    activityByDay,
    approvalRatePct,
  });
});

const subPatchSchema = z.object({
  status: z.enum(["active", "blocked", "removed"]).optional(),
  plan: z.enum(["free", "pro"]).optional(),
  downloadLimitOverride: z.number().int().nonnegative().nullable().optional(),
  importLimitOverride: z.number().int().nonnegative().nullable().optional(),
  aiCredits: z.number().int().nonnegative().optional(),
});

adminRouter.patch("/plugin-subscribers/:userId", async (req, res) => {
  const userId = String(req.params.userId);
  const parsed = subPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
    return;
  }

  await ensurePluginProfile(userId);
  const data: {
    status?: PluginAccountStatus;
    plan?: PluginPlanTier;
    downloadLimitOverride?: number | null;
    importLimitOverride?: number | null;
    aiCredits?: number;
    aiCreditsResetAt?: Date;
  } = {};

  if (parsed.data.status) {
    data.status =
      parsed.data.status === "blocked"
        ? PluginAccountStatus.BLOCKED
        : parsed.data.status === "removed"
          ? PluginAccountStatus.REMOVED
          : PluginAccountStatus.ACTIVE;
  }
  if (parsed.data.plan) {
    data.plan =
      parsed.data.plan === "pro" ? PluginPlanTier.PRO : PluginPlanTier.FREE;
  }
  if ("downloadLimitOverride" in parsed.data) {
    data.downloadLimitOverride = parsed.data.downloadLimitOverride ?? null;
  }
  if ("importLimitOverride" in parsed.data) {
    data.importLimitOverride = parsed.data.importLimitOverride ?? null;
  }
  if (typeof parsed.data.aiCredits === "number") {
    // Admin AI kreditni belgilaydi; reset sanasini hozirgi oyga qo'yamiz —
    // shu oy ichida avtomatik oylik reset bu qiymatni qayta yozib yubormasin.
    data.aiCredits = parsed.data.aiCredits;
    data.aiCreditsResetAt = new Date();
  }

  await prisma.pluginProfile.update({ where: { userId }, data });

  if (data.status === PluginAccountStatus.BLOCKED || data.status === PluginAccountStatus.REMOVED) {
    // Plugin tokenlarni o'chiramiz + JWT'ni bekor qilish uchun tokenVersion oshiramiz.
    await prisma.pluginToken.deleteMany({ where: { userId } });
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  // Audit izi (#2.4) — admin obunachi amallari (faqat so'rovda kelgan maydonlar).
  const changed: Record<string, unknown> = {};
  if (parsed.data.status) changed.status = parsed.data.status;
  if (parsed.data.plan) changed.plan = parsed.data.plan;
  if ("downloadLimitOverride" in parsed.data)
    changed.downloadLimitOverride = parsed.data.downloadLimitOverride ?? null;
  if ("importLimitOverride" in parsed.data)
    changed.importLimitOverride = parsed.data.importLimitOverride ?? null;
  if (typeof parsed.data.aiCredits === "number") changed.aiCredits = parsed.data.aiCredits;
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "plugin-subscriber.update",
    targetType: "pluginSubscriber",
    targetId: userId,
    meta: changed,
  });

  const full = await ensurePluginProfile(userId);
  const token = await prisma.pluginToken.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
  });

  res.json({ item: mapSubscriberRow(full, !!token) });
});
