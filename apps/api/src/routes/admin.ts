import { Router } from "express";
import { z } from "zod";
import {
  PluginAccountStatus,
  PluginPlanTier,
  UserRole,
  prisma,
  Prisma,
} from "@creative-tools/database";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  ensurePluginProfile,
  mapSubscriberRow,
  resetExpiredPluginMonths,
  refreshPlanConfigCache,
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
import {
  payoutPerDownloadCents,
  payoutMode,
  contributorPoolShare,
  computePoolForMonth,
} from "../lib/earnings.js";
import { revenueSummary, netSubscriptionRevenueCents } from "../lib/revenue.js";
import {
  runMonthlyReconciliation,
  recordProviderInvoice,
  listProviderInvoices,
} from "../lib/pricing-reconcile.js";
import {
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
  getLandingConfig,
  saveLandingConfig,
  resetLandingConfig,
} from "../lib/landing-config.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// FAZA 2 (L5) — folder whitelist + fileName sanitizatsiya: aks holda `folder`/`fileName`
// bevosita S3 kalitiga interpolatsiya qilinib, path-traversal (`../`) yoki ixtiyoriy kalit
// injeksiyasi (boshqa prefiksga yozish) mumkin edi.
const ALLOWED_UPLOAD_FOLDERS = new Set(["assets", "thumbs", "previews", "banners", "misc", "landing"]);
function safeUploadFolder(f?: string): string {
  const v = (f ?? "assets").trim();
  return ALLOWED_UPLOAD_FOLDERS.has(v) ? v : "assets";
}
function safeUploadFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file"; // basename (yo'l qismlarini tashla)
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 200);
  return cleaned || "file";
}

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

  const key = `${safeUploadFolder(folder)}/${Date.now()}-${safeUploadFileName(fileName)}`;

  if (!isS3Configured()) {
    res.json({
      uploadUrl: null,
      key,
      publicUrl: getPublicUrl(key),
      mock: true,
      message: "S3 not configured — set AWS_* env vars for production uploads",
    });
    return;
  }

  const uploadUrl = await getSignedUploadUrl(key, contentType);
  res.json({ uploadUrl, key, publicUrl: getPublicUrl(key) });
});

// ── Landing CMS (admin "Website" tab) ────────────────────────────────────────
// Faqat o'qish/yozish konfiguratsiya — pul mantig'iga aloqasi yo'q. Ommaviy
// o'qish /api/landing/config (routes/landing.ts) da; bu yerdagilar admin-guarded.

/** GET /api/admin/landing-config — merged config + defaultlar (editor "reset" ko'rsatishi uchun). */
adminRouter.get("/landing-config", async (_req, res) => {
  const { config, updatedAt } = await getLandingConfig();
  res.json({ config, updatedAt, defaults: DEFAULT_LANDING_CONFIG });
});

/** PUT /api/admin/landing-config — qisman patch (bo'lim-darajada merge) + audit. */
adminRouter.put("/landing-config", async (req, res) => {
  const parsed = landingConfigSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid landing config", detail: parsed.error.flatten() });
    return;
  }
  const config = await saveLandingConfig(parsed.data, req.user?.userId ?? null);
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "landing_config.update",
    targetType: "landingConfig",
    targetId: "singleton",
    detail: JSON.stringify(Object.keys(parsed.data)).slice(0, 200),
  });
  res.json({ config });
});

/** DELETE /api/admin/landing-config — defaultlarga (joriy hardcoded kontent) qaytarish. */
adminRouter.delete("/landing-config", async (req, res) => {
  const config = await resetLandingConfig();
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "landing_config.reset",
    targetType: "landingConfig",
    targetId: "singleton",
  });
  res.json({ config });
});

// ── FAZA 2 #13 — Tarif limitlari (PlanConfig, DB) ───────────────────────────
/** GET /api/admin/plan-config — 3 tarif konfiguratsiyasi (DB). */
adminRouter.get("/plan-config", async (_req, res) => {
  const rows = await prisma.planConfig.findMany({ orderBy: { plan: "asc" } });
  res.json({ items: rows });
});

const planConfigSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  aiMonthlyCredits: z.number().int().min(0).max(1_000_000).optional(),
  downloadLimit: z.number().int().min(1).max(999_999).nullable().optional(),
  importLimit: z.number().int().min(0).max(999_999).nullable().optional(),
  maxResolution: z.string().min(1).max(20).optional(),
  priceMonthlyCents: z.number().int().min(0).nullable().optional(),
  priceYearlyCents: z.number().int().min(0).nullable().optional(),
  lsVariantMonthly: z.string().max(64).nullable().optional(),
  lsVariantYearly: z.string().max(64).nullable().optional(),
});

/** PUT /api/admin/plan-config/:plan — limit/label/narx-display tahriri.
 *  Kredit consume/refund mantig'iga TEGMAYDI — faqat qiymat manbai. */
adminRouter.put("/plan-config/:plan", async (req, res) => {
  const planRaw = String(req.params.plan || "").toUpperCase();
  const plan = z.nativeEnum(PluginPlanTier).safeParse(planRaw);
  if (!plan.success) {
    res.status(400).json({ error: "Unknown plan (FREE | PRO | STUDIO)" });
    return;
  }
  const body = planConfigSchema.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "Invalid plan config", detail: body.error.flatten() });
    return;
  }
  const row = await prisma.planConfig.upsert({
    where: { plan: plan.data },
    create: {
      plan: plan.data,
      label: body.data.label ?? plan.data,
      aiMonthlyCredits: body.data.aiMonthlyCredits ?? 0,
      downloadLimit: body.data.downloadLimit ?? null,
      importLimit: body.data.importLimit ?? null,
      maxResolution: body.data.maxResolution ?? "1080p",
      priceMonthlyCents: body.data.priceMonthlyCents ?? null,
      priceYearlyCents: body.data.priceYearlyCents ?? null,
      lsVariantMonthly: body.data.lsVariantMonthly ?? null,
      lsVariantYearly: body.data.lsVariantYearly ?? null,
    },
    update: body.data,
  });
  await refreshPlanConfigCache(true); // enforce darhol yangi qiymatni ko'rsin
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "plan_config_update",
    targetType: "plan",
    targetId: plan.data,
    detail: JSON.stringify(body.data).slice(0, 500),
  });
  res.json(row);
});

// (Eski soddalashtirilgan GET /users va PATCH /users/:id/role bu yerdan olib
// tashlandi — FAZA 6b to'liq (guard+audit) versiyalari fayl oxirida.)

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
          image: true,
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

  const [agg, byPlan, byStatus, total, weekActive, dayActive, eventDownloads, eventImports] =
    await Promise.all([
      prisma.pluginProfile.aggregate({
        _sum: {
          downloadsTotal: true,
          downloadsMonth: true,
          importsTotal: true,
        },
      }),
      // FAZA 5 (C6): Free/Pro hisobi REMOVED profillarni chiqarib tashlaydi —
      // Subscribers sahifasi bilan bir xil (ilgari Overview kattaroq ko'rsatardi).
      prisma.pluginProfile.groupBy({
        by: ["plan"],
        where: { status: { not: PluginAccountStatus.REMOVED } },
        _count: { _all: true },
      }),
      prisma.pluginProfile.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.pluginProfile.count(),
      prisma.pluginProfile.count({ where: { lastSeenAt: { gte: weekAgo } } }),
      prisma.pluginProfile.count({ where: { lastSeenAt: { gte: dayAgo } } }),
      // FAZA 5 (C6): per-shablon jadval bilan BIR MANBA — TemplateDownloadEvent
      // (unique user·template hodisalar). PluginProfile.downloadsTotal esa har
      // qayta yuklab olishni sanaydi — ikkalasi additive qaytadi.
      prisma.templateDownloadEvent.count({ where: { kind: "download" } }),
      prisma.templateDownloadEvent.count({ where: { kind: "import" } }),
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
      // FAZA 5 (C6) — additive: per-shablon jadval bilan mos keladigan hodisa hisobi
      eventDownloadsTotal: eventDownloads,
      eventImportsTotal: eventImports,
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
  // FAZA 4 (A) — REAL daromad (RevenueEvent). MRR = joriy oy obuna net tushumi;
  // month berilsa o'sha oy. Kredit-qiymat proxy (aggregate) AI-marja tahlili uchun QOLADI.
  const mrrRange = range.since ? range : monthRange(new Date().toISOString().slice(0, 7));
  const [config, margins, providers, unpaid, revenue, mrrCents, poolBaseCents] = await Promise.all([
    getPricingConfig(),
    computeMargins(range),
    spendByProvider(range),
    prisma.contributorEarning.aggregate({ where: { payoutId: null }, _sum: { amountCents: true } }),
    revenueSummary(range),
    // MRR = joriy (yoki so'ralgan) oy obuna NET tushumi, obuna refundlari AYIRILGAN.
    netSubscriptionRevenueCents(mrrRange),
    // Pool bazasi — tanlangan davr uchun (obuna net − obuna refundlari).
    netSubscriptionRevenueCents(range),
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
    // FAZA 4 (A) — REAL daromad (RevenueEvent'dan, kredit-qiymat proxy EMAS).
    revenue,
    mrrCents,
    // FAZA 4 (C/D) — pool knob ko'rsatkichi uchun (obuna net − obuna refundlari).
    poolBaseCents,
    payoutMode: payoutMode(),
    poolShare: contributorPoolShare(),
  });
});

// ── FAZA 4 (C) — revenue-share POOL payout hisoblash (pul KO'CHIRILMAYDI) ────
const poolMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");

/** GET /api/admin/payout/pool?month=YYYY-MM — pool taqsimoti PREVIEW (yozmaydi). */
adminRouter.get("/payout/pool", async (req, res) => {
  const parsed = poolMonth.safeParse(String(req.query.month ?? ""));
  if (!parsed.success) {
    res.status(400).json({ error: "month must be YYYY-MM" });
    return;
  }
  const result = await computePoolForMonth(parsed.data);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

/** POST /api/admin/payout/pool { month, recompute? } — pool qatorlarini YOZADI
 *  (ContributorEarning kind="pool", davr+contributor idempotent). recompute=true →
 *  to'lanmagan pool qatorlari qayta hisoblanadi (payout'ga bog'langanlar tegilmaydi). */
adminRouter.post("/payout/pool", async (req, res) => {
  const body = z
    .object({ month: poolMonth, recompute: z.boolean().optional() })
    .safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const result = await computePoolForMonth(body.data.month, {
    persist: true,
    recompute: body.data.recompute,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "payout.pool.compute",
    targetType: "payoutPool",
    targetId: body.data.month,
    meta: {
      poolCents: result.poolCents,
      contributors: result.contributors.length,
      written: result.written,
      recompute: !!body.data.recompute,
    },
  });
  res.json(result);
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

// ── FAZA 4 (D) — biznes metrikalari: churn / conversion / ARPU / LTV ────────
// PlanChangeEvent + RevenueEvent'dan BASIC hisob-kitob. FAQAT O'QISH.
// TODO: chuqurroq kohort tahlili (signup-oy bo'yicha retention, plan-daraja LTV).
/** GET /api/admin/metrics[?month=YYYY-MM] — plan harakati + asosiy iqtisod metrikalari. */
adminRouter.get("/metrics", async (req, res) => {
  const month = req.query.month
    ? String(req.query.month)
    : new Date().toISOString().slice(0, 7);
  const range = monthRange(month);
  if (!range.since || !range.until) {
    res.status(400).json({ error: "month must be YYYY-MM" });
    return;
  }
  const { since, until } = range;
  const inPeriod = { gte: since, lt: until };
  const [plans, upgrades, downgrades, upgradesSince, downgradesSince, revenue, dunning, recent] =
    await Promise.all([
      prisma.pluginProfile.groupBy({
        by: ["plan"],
        where: { status: PluginAccountStatus.ACTIVE },
        _count: { _all: true },
      }),
      prisma.planChangeEvent.count({
        where: { createdAt: inPeriod, fromPlan: "FREE", toPlan: { not: "FREE" } },
      }),
      prisma.planChangeEvent.count({
        where: { createdAt: inPeriod, fromPlan: { not: "FREE" }, toPlan: "FREE" },
      }),
      // davr boshidan HOZIRGACHA (payingAtStart rekonstruksiyasi uchun)
      prisma.planChangeEvent.count({
        where: { createdAt: { gte: since }, fromPlan: "FREE", toPlan: { not: "FREE" } },
      }),
      prisma.planChangeEvent.count({
        where: { createdAt: { gte: since }, fromPlan: { not: "FREE" }, toPlan: "FREE" },
      }),
      revenueSummary(range),
      prisma.pluginProfile.count({ where: { billingIssue: { not: null } } }),
      prisma.planChangeEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
  const planCounts: Record<string, number> = {};
  for (const p of plans) planCounts[String(p.plan)] = p._count._all;
  const payingNow = Object.entries(planCounts)
    .filter(([k]) => k !== "FREE")
    .reduce((a, [, n]) => a + n, 0);
  const freeNow = planCounts.FREE ?? 0;
  // payingAtStart ≈ hozirgi paying − (davr boshidan beri net o'zgarish).
  const payingAtStart = Math.max(0, payingNow - upgradesSince + downgradesSince);
  const churnPct = payingAtStart > 0 ? Math.round((downgrades / payingAtStart) * 1000) / 10 : null;
  const conversionPct =
    freeNow + upgrades > 0 ? Math.round((upgrades / (freeNow + upgrades)) * 1000) / 10 : null;
  const arpuCents = payingNow > 0 ? Math.round(revenue.netCents / payingNow) : null;
  const ltvCents =
    arpuCents != null && churnPct != null && churnPct > 0
      ? Math.round(arpuCents / (churnPct / 100))
      : null;
  // Recent plan-change qatorlariga user email (ko'rsatish uchun).
  const uids = [...new Set(recent.map((r) => r.userId))];
  const users = uids.length
    ? await prisma.user.findMany({
        where: { id: { in: uids } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const um = new Map(users.map((u) => [u.id, u]));
  res.json({
    month,
    plans: planCounts,
    payingNow,
    freeNow,
    payingAtStart,
    upgrades,
    downgrades,
    churnPct,
    conversionPct,
    arpuCents,
    ltvCents,
    dunningCount: dunning,
    revenue,
    recentChanges: recent.map((r) => ({
      at: r.createdAt.toISOString(),
      userName: um.get(r.userId)?.name ?? null,
      userEmail: um.get(r.userId)?.email ?? null,
      fromPlan: r.fromPlan,
      toPlan: r.toPlan,
      source: r.source,
    })),
  });
});

// ── FAZA 6b — Foydalanuvchi rollari boshqaruvi (qo'lda SQL o'rniga) ─────────
// Hammasi adminRouter.use(requireAuth, requireAdmin) ostida. Rol o'zgarishi
// darhol amal qiladi: requireAuth har so'rovda rolni DB'dan qayta o'qiydi,
// shu bois token bekor qilish shart emas. Har o'zgarish audit-log'ga yoziladi.

/** GET /api/admin/users — ro'yxat (qidiruv, rol filtri, pending contributor so'rovlari). */
adminRouter.get("/users", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const roleRaw = String(req.query.role ?? "").toUpperCase();
  const roleFilter = (Object.values(UserRole) as string[]).includes(roleRaw)
    ? (roleRaw as UserRole)
    : undefined;
  const pendingOnly = req.query.pending === "1";

  const where: Prisma.UserWhereInput = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(pendingOnly
      ? { role: UserRole.USER, contributorRequestedAt: { not: null } }
      : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, pendingCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
        contributorBlockedAt: true,
        contributorRequestedAt: true,
      },
    }),
    prisma.user.count({
      where: { role: UserRole.USER, contributorRequestedAt: { not: null } },
    }),
  ]);

  res.json({
    items: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      emailVerified: !!u.emailVerified,
      blocked: !!u.contributorBlockedAt,
      contributorRequestedAt: u.contributorRequestedAt,
    })),
    pendingCount,
  });
});

const setRoleSchema = z.object({ role: z.nativeEnum(UserRole) });

/** PATCH /api/admin/users/:id/role — rol berish/olish (USER|CONTRIBUTOR|ADMIN). */
adminRouter.patch("/users/:id/role", async (req, res) => {
  const parsed = setRoleSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "role must be USER | CONTRIBUTOR | ADMIN" });
    return;
  }
  const newRole = parsed.data.role;

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === newRole) {
    res.status(400).json({ error: `User already has the ${newRole} role` });
    return;
  }

  // Oxirgi admin himoyasi — tekshiruv+yozish bitta tranzaksiyada (parallel
  // demote poygasi 0 ta admin qoldirmasin).
  const updated = await prisma.$transaction(async (tx) => {
    if (target.role === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
      const admins = await tx.user.count({ where: { role: UserRole.ADMIN } });
      if (admins <= 1) return null;
    }
    return tx.user.update({
      where: { id: target.id },
      // Rol o'zgardi → pending contributor so'rovi (bo'lsa) yopiladi.
      data: { role: newRole, contributorRequestedAt: null },
    });
  });
  if (!updated) {
    res.status(409).json({ error: "Cannot remove the last remaining admin" });
    return;
  }

  await writeAuditLog({
    actorId: req.user!.userId,
    action: "user.role_change",
    targetType: "user",
    targetId: target.id,
    detail: `${target.email}: ${target.role} → ${newRole}`,
    meta: { oldRole: target.role, newRole },
  });

  res.json({
    item: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
  });
});

/** DELETE /api/admin/users/:id/contributor-request — pending so'rovni rad etish. */
adminRouter.delete("/users/:id/contributor-request", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!target.contributorRequestedAt) {
    res.status(400).json({ error: "No pending contributor request" });
    return;
  }
  await prisma.user.update({
    where: { id: target.id },
    data: { contributorRequestedAt: null },
  });
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "user.contributor_request_dismissed",
    targetType: "user",
    targetId: target.id,
    detail: target.email,
  });
  res.json({ ok: true });
});
