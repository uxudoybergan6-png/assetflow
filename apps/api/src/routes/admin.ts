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
  resetExpiredPluginMonths,
} from "../lib/plugin-profile.js";
import {
  getSignedUploadUrl,
  getPublicUrl,
  isS3Configured,
} from "../lib/s3.js";
import { writeAuditLog } from "../lib/audit-log.js";
import { getModelById } from "../lib/gen-models.js";
import {
  getPricingConfig,
  listPricingView,
  upsertModelPricing,
  updatePricingConfig,
} from "../lib/model-pricing.js";
import { computeMargins, spendByProvider } from "../lib/model-margin.js";
import { payoutPerDownloadCents } from "../lib/earnings.js";
import {
  runMonthlyReconciliation,
  recordProviderInvoice,
  listProviderInvoices,
} from "../lib/pricing-reconcile.js";

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
  // N+1 tuzatish: avval har obunachi uchun `ensurePluginProfile` (oy-reset +
  // upsert + qayta o'qish) alohida chaqirilardi (~3N so'rov). Endi: BITTA batched
  // oy-reset + BITTA boyitilgan findMany. Semantika bir xil — reset atomik va
  // profil oldindan mavjud (upsert no-op edi). Reset findMany'dan OLDIN bajariladi,
  // shu sabab qaytgan downloadsMonth reset'dan keyingi qiymatni aks ettiradi.
  await resetExpiredPluginMonths();
  const profiles = await prisma.pluginProfile.findMany({
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
    orderBy: { lastSeenAt: "desc" },
  });

  const userIds = profiles.map((p) => p.userId);
  const tokens = await prisma.pluginToken.findMany({
    where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  const tokenOk = new Set(tokens.map((t) => t.userId));

  const items = profiles.map((row) => mapSubscriberRow(row, tokenOk.has(row.userId)));

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
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
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

// ── NARX DVIGATELI — admin narx boshqaruvi (Bosqich 3.4, backend) ────────────
// Admin-only (adminRouter.use requireAuth+requireAdmin), audited. Pul mantig'iga
// (consume/refund/imzo) TEGMAYDI — faqat ModelPricing manba qatorini yozadi.

/** GET /api/admin/pricing — har model: joriy kredit narx + real USD + marja + bayroq. */
adminRouter.get("/pricing", async (req, res) => {
  const [config, view, margins] = await Promise.all([
    getPricingConfig(),
    listPricingView(),
    computeMargins(),
  ]);
  const marginById = new Map(margins.models.map((m) => [m.modelId, m]));
  const models = view.map((v) => ({
    ...v,
    margin: marginById.get(v.modelId) ?? null,
    belowTarget: marginById.get(v.modelId)?.belowTarget ?? false,
    missingCost: marginById.get(v.modelId)?.missingCost ?? true,
  }));
  res.json({
    creditUsdValue: config.creditUsdValue,
    marginTarget: config.marginTarget,
    aggregate: margins.aggregate,
    flaggedCount: margins.flagged.length,
    models,
  });
});

// Narx map (quality/resolution → kredit): kalit qisqa, qiymat butun ≥ 1 (narx buzilmasin).
const creditMap = z.record(z.string().min(1).max(24), z.number().int().min(1).max(100000));
const pricingPatchSchema = z
  .object({
    cost: z.number().int().min(1).max(100000).optional(), // 0/manfiy narx TAQIQ (tekin/buzilgan gen)
    pricing: z.enum(["per-second", "per-generation"]).nullable().optional(),
    qualityCost: creditMap.nullable().optional(),
    videoPerSec: creditMap.nullable().optional(),
    estCostUsd: z.number().min(0).max(100000).nullable().optional(),
    enabled: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "At least one field is required");

const pricingConfigSchema = z
  .object({
    // creditUsdValue: 1 kredit necha $ (0 dan katta, aqlli chegara).
    creditUsdValue: z.number().gt(0).max(100).optional(),
    marginTarget: z.number().gt(0).max(1000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "At least one field is required");

/** PATCH /api/admin/pricing/config — global creditUsdValue / marginTarget.
 *  MUHIM: `/pricing/:modelId` dan OLDIN ro'yxatdan o'tsin — aks holda "config" modelId
 *  sifatida ushlanadi (NaN → 400) va bu yo'l hech qachon ishlamaydi. */
adminRouter.patch("/pricing/config", async (req, res) => {
  const parsed = pricingConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const config = await updatePricingConfig(parsed.data, req.user?.userId ?? null);
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.config.update",
    targetType: "pricingConfig",
    targetId: "singleton",
    meta: parsed.data as Record<string, unknown>,
  });
  res.json({ config });
});

/** PATCH /api/admin/pricing/:modelId — model kredit narxini yangilaydi (audit + cache bust). */
adminRouter.patch("/pricing/:modelId", async (req, res) => {
  const modelId = Number(req.params.modelId);
  if (!Number.isInteger(modelId)) {
    res.status(400).json({ error: "Invalid modelId" });
    return;
  }
  if (!getModelById(modelId)) {
    res.status(404).json({ error: "Unknown model" });
    return;
  }
  const parsed = pricingPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const row = await upsertModelPricing(modelId, parsed.data, req.user?.userId ?? null);
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.model.update",
    targetType: "modelPricing",
    targetId: String(modelId),
    meta: parsed.data as Record<string, unknown>,
  });
  // Yangi narxni namunaviy so'rov bilan qaytaramiz (admin darhol ko'radi).
  const view = (await listPricingView()).find((v) => v.modelId === modelId) ?? null;
  res.json({ row, view });
});

// ── NARX-DRIFT MONITORING (Bosqich 3.5) — reconciliation + real invoice ──────

const monthQuery = z.string().regex(/^\d{4}-\d{2}$/);

/** GET /api/admin/pricing/reconcile?month=YYYY-MM[&dry=1] — oylik reconciliation (on-demand).
 *  Marja maqsaddan past bo'lsa alert yuboradi (dry=1 → yubormaydi, faqat hisob-kitob). */
adminRouter.get("/pricing/reconcile", async (req, res) => {
  const monthRaw = req.query.month ? String(req.query.month) : undefined;
  if (monthRaw && !monthQuery.safeParse(monthRaw).success) {
    res.status(400).json({ error: "month must be in YYYY-MM format" });
    return;
  }
  const dry = req.query.dry === "1" || req.query.dry === "true";
  const report = await runMonthlyReconciliation({ month: monthRaw, sendAlert: !dry });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.reconcile",
    targetType: "pricingReconcile",
    targetId: report.month,
    meta: { belowTarget: report.belowTarget, alertSent: report.alert.sent, dry },
  });
  res.json({ report });
});

/** GET /api/admin/pricing/invoices?month= — kiritilgan real provider invoice'lar. */
adminRouter.get("/pricing/invoices", async (req, res) => {
  const monthRaw = req.query.month ? String(req.query.month) : undefined;
  if (monthRaw && !monthQuery.safeParse(monthRaw).success) {
    res.status(400).json({ error: "month must be in YYYY-MM format" });
    return;
  }
  res.json({ invoices: await listProviderInvoices(monthRaw) });
});

const invoiceSchema = z.object({
  provider: z.string().trim().min(1).max(64),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
  actualUsd: z.number().min(0).max(10_000_000),
  note: z.string().max(2000).nullable().optional(),
});

/** POST /api/admin/pricing/invoice — real oylik provider invoice USD kiritadi (drift solishtirish). */
adminRouter.post("/pricing/invoice", async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  await recordProviderInvoice({ ...parsed.data, createdById: req.user?.userId ?? null });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.invoice.record",
    targetType: "providerInvoice",
    targetId: `${parsed.data.provider}:${parsed.data.periodMonth}`,
    meta: parsed.data as Record<string, unknown>,
  });
  res.json({ ok: true });
});

// ── BIZNES MARKAZ — admin-only READ agregatlari (Bosqich 5 biznes ekranlari) ──
// Hammasi requireAuth+requireAdmin ostida, FAQAT O'QISH. Pul mutatsiyasiga
// (consume/refund/imzo/pricing-write) TEGMAYDI — mavjud lib funksiyalarini o'raydi.

/** Berilgan oy (YYYY-MM) → [since, until) oraliq. Noto'g'ri bo'lsa null. */
function monthRange(month?: string): { since?: Date; until?: Date } {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return {};
  const [y, m] = month.split("-").map(Number);
  const since = new Date(Date.UTC(y, m - 1, 1));
  const until = new Date(Date.UTC(y, m, 1));
  return { since, until };
}

/** GET /api/admin/finance[?month=YYYY-MM] — daromad vs provayder xarajati + margin + payout. */
adminRouter.get("/finance", async (req, res) => {
  const range = monthRange(req.query.month ? String(req.query.month) : undefined);
  const [config, margins, providers, unpaid] = await Promise.all([
    getPricingConfig(),
    computeMargins(range),
    spendByProvider(range),
    prisma.contributorEarning.aggregate({ where: { payoutId: null }, _sum: { amountCents: true } }),
  ]);
  const creditUsd = config.creditUsdValue;
  const providerRows = providers
    .map((p) => {
      const revenueUsd = Math.round(p.credits * creditUsd * 100) / 100;
      const margin = p.estimatedUsd > 0 ? Math.round((revenueUsd / p.estimatedUsd) * 100) / 100 : null;
      return { ...p, revenueUsd, margin };
    })
    .sort((a, b) => b.estimatedUsd - a.estimatedUsd);
  res.json({
    creditUsdValue: creditUsd,
    marginTarget: config.marginTarget,
    aggregate: margins.aggregate,
    providers: providerRows,
    payoutPendingCents: Math.max(0, unpaid._sum.amountCents ?? 0),
    perDownloadCents: payoutPerDownloadCents(),
  });
});

/** GET /api/admin/gen-spend[?month=YYYY-MM] — per-user AI gen sarfi (Generation × ProviderSpend). */
adminRouter.get("/gen-spend", async (req, res) => {
  const { since, until } = monthRange(req.query.month ? String(req.query.month) : undefined);
  const createdAt = since || until ? { ...(since ? { gte: since } : {}), ...(until ? { lt: until } : {}) } : undefined;
  const config = await getPricingConfig();
  const gens = await prisma.generation.findMany({
    where: createdAt ? { createdAt } : {},
    select: { id: true, userId: true, cost: true, status: true },
  });
  const genUser = new Map<string, string>();
  const perUser = new Map<string, { gens: number; credits: number; costUsd: number }>();
  for (const g of gens) {
    genUser.set(g.id, g.userId);
    const u = perUser.get(g.userId) ?? { gens: 0, credits: 0, costUsd: 0 };
    if (g.status === "done") { u.gens += 1; u.credits += g.cost ?? 0; }
    perUser.set(g.userId, u);
  }
  const genIds = [...genUser.keys()];
  if (genIds.length) {
    const spends = await prisma.providerSpend.findMany({
      where: { generationId: { in: genIds }, estimatedCostUsd: { not: null } },
      select: { generationId: true, estimatedCostUsd: true },
    });
    for (const s of spends) {
      const uid = s.generationId ? genUser.get(s.generationId) : undefined;
      if (!uid) continue;
      const u = perUser.get(uid);
      if (u) u.costUsd += Number(s.estimatedCostUsd ?? 0);
    }
  }
  const ids = [...perUser.keys()];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, name: true, pluginProfile: { select: { plan: true, aiCredits: true } } },
      })
    : [];
  const umap = new Map(users.map((u) => [u.id, u]));
  const rows = ids
    .map((id) => {
      const u = perUser.get(id)!;
      const info = umap.get(id);
      const revenueUsd = Math.round(u.credits * config.creditUsdValue * 100) / 100;
      const costUsd = Math.round(u.costUsd * 100) / 100;
      const margin = revenueUsd > 0 ? Math.round(((revenueUsd - costUsd) / revenueUsd) * 100) : null;
      return {
        userId: id,
        name: info?.name ?? null,
        email: info?.email ?? null,
        plan: info?.pluginProfile?.plan ?? "FREE",
        creditsRemaining: info?.pluginProfile?.aiCredits ?? null,
        gens: u.gens,
        creditsSpent: u.credits,
        providerCostUsd: costUsd,
        marginPct: margin,
      };
    })
    .sort((a, b) => b.creditsSpent - a.creditsSpent)
    .slice(0, 100);
  const totals = rows.reduce(
    (acc, r) => {
      acc.gens += r.gens;
      acc.credits += r.creditsSpent;
      acc.costUsd += r.providerCostUsd;
      if (r.marginPct != null && r.marginPct < 0) acc.negative += 1;
      return acc;
    },
    { gens: 0, credits: 0, costUsd: 0, negative: 0 }
  );
  res.json({ creditUsdValue: config.creditUsdValue, rows, totals });
});

/** GET /api/admin/activity[?type=gen|download|import&limit=] — birlashgan foydalanuvchi faoliyati oqimi. */
adminRouter.get("/activity", async (req, res) => {
  const type = String(req.query.type || "all");
  const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 80));
  const wantGen = type === "all" || type === "gen";
  const wantDl = type === "all" || type === "download" || type === "import";
  const [gens, dls] = await Promise.all([
    wantGen
      ? prisma.generation.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { id: true, userId: true, mode: true, modelId: true, params: true, cost: true, category: true, createdAt: true, user: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
    wantDl
      ? prisma.templateDownloadEvent.findMany({
          where: type === "import" ? { kind: "import" } : type === "download" ? { kind: "download" } : {},
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { id: true, userId: true, templateId: true, kind: true, source: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  // Yuklab olish hodisalari uchun user + shablon nomlarini to'ldiramiz.
  const dlUserIds = [...new Set(dls.map((d) => d.userId))];
  const tplIds = [...new Set(dls.map((d) => d.templateId))];
  const [dlUsers, tpls] = await Promise.all([
    dlUserIds.length ? prisma.user.findMany({ where: { id: { in: dlUserIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    tplIds.length ? prisma.contributorTemplate.findMany({ where: { id: { in: tplIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const um = new Map(dlUsers.map((u) => [u.id, u]));
  const tm = new Map(tpls.map((t) => [t.id, t.name]));
  const genItems = gens.map((g) => {
    const model = getModelById(g.modelId);
    const p = (g.params ?? {}) as Record<string, unknown>;
    const bits = [model?.label ?? `model ${g.modelId}`, p.aspectRatio, p.duration ? `${p.duration}s` : null].filter(Boolean);
    return {
      id: g.id,
      at: g.createdAt.toISOString(),
      userName: g.user?.name ?? null,
      userEmail: g.user?.email ?? null,
      event: "gen" as const,
      mode: g.mode,
      detail: bits.join(" · "),
      source: "plugin",
      credits: g.cost ?? 0,
    };
  });
  const dlItems = dls.map((d) => {
    const u = um.get(d.userId);
    return {
      id: d.id,
      at: d.createdAt.toISOString(),
      userName: u?.name ?? null,
      userEmail: u?.email ?? null,
      event: d.kind === "import" ? ("import" as const) : ("download" as const),
      mode: null,
      detail: tm.get(d.templateId) ?? d.templateId,
      source: d.source,
      credits: 0,
    };
  });
  const items = [...genItems, ...dlItems].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
  res.json({ items });
});
