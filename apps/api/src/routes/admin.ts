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
  recordPlanChange,
  refundAiCredits,
} from "../lib/plugin-profile.js";
import {
  getSignedUploadUrl,
  getPublicUrl,
  isS3Configured,
  getS3ObjectMeta,
  sha256OfS3Object,
  listS3ObjectsByPrefix,
  deleteS3Objects,
} from "../lib/s3.js";
import { listContentRevisions, getContentRevision } from "../lib/content-revisions.js";
import { writeAuditLog } from "../lib/audit-log.js";
// #91 (A3) — admin Settings ekrani uchun HAQIQIY limitlar/retention (read-only ko'rsatiladi).
import { CLOUD_RUN_REQUEST_LIMIT_BYTES, MAX_REF_UPLOAD_BYTES } from "../lib/upload-limits.js";
import { DONE_RETENTION_DAYS, INCOMING_RETENTION_DAYS } from "../lib/ingest-worker.js";
import { ASSET_MAX_BYTES } from "./contributor.js";
import { sendEmail, renderEmailLayout } from "../lib/email.js";
import { diagnoseSizeBytes, backfillSizeBytes } from "../lib/backfill-sizebytes.js";
import { getModelById } from "../lib/gen-models.js";
import { hydrateGenAssets } from "./studio-gen.js";
import {
  getPricingConfig,
  listPricingView,
  upsertModelPricing,
  updatePricingConfig,
} from "../lib/model-pricing.js";
import {
  applyAutoMarginAll,
  deriveAutoPricingResolved,
  previewAutoMarginAll,
  PINNED_MODEL_IDS,
} from "../lib/pricing-automargin.js";
import { getMeasuredProviderUsdMap, computeResolvedProviderCost } from "../lib/measured-cost.js";
import { probeModelCost } from "../lib/measure-probe.js";
import { providerCostReference } from "../lib/provider-cost.js";
import { computeMargins, spendByProvider } from "../lib/model-margin.js";
import {
  payoutPerDownloadCents,
  payoutMode,
  contributorPoolShare,
  computePoolForMonth,
} from "../lib/earnings.js";
import { revenueSummary, netSubscriptionRevenueCents } from "../lib/revenue.js";
import { analyzeSybil, payoutHoldDays, sybilFlagScore } from "../lib/sybil.js";
import { getInfraCostForMonth, upsertInfraCost, listInfraCosts } from "../lib/infra-cost.js";
import { computeProfitStatement } from "../lib/profit.js";
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
  replaceLandingConfigBlob,
} from "../lib/landing-config.js";
import {
  DEFAULT_PLUGIN_CONTENT_CONFIG,
  pluginContentConfigSchema,
  getPluginContentConfig,
  savePluginContentConfig,
  resetPluginContentConfig,
  replacePluginContentConfigBlob,
} from "../lib/plugin-content-config.js";
import {
  isZxpReleaseKey,
  validateInstallerInput,
  installerExtension,
  isKnownPluginHost,
  normalizePluginHost,
  HOST_INSTALLER_EXTENSIONS,
  INSTALLER_PLATFORMS,
} from "../lib/plugin-release-contract.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// FAZA 2 (L5) — folder whitelist + fileName sanitizatsiya: aks holda `folder`/`fileName`
// bevosita S3 kalitiga interpolatsiya qilinib, path-traversal (`../`) yoki ixtiyoriy kalit
// injeksiyasi (boshqa prefiksga yozish) mumkin edi.
const ALLOWED_UPLOAD_FOLDERS = new Set(["assets", "thumbs", "previews", "banners", "misc", "landing", "releases", "site/plugin"]); // P11: plagin reliz paketlari; SC_02: Plugin CMS media
// SC_02 — CMS media papkalari faqat rasm/video qabul qiladi (CDN'da ommaviy o'qiladi;
// ixtiyoriy contentType bilan yuklashga yo'l qo'ymaymiz).
const CMS_MEDIA_FOLDERS = new Set(["landing", "site/plugin"]);
const CMS_MEDIA_CONTENT_TYPES = /^image\//;
const CMS_MEDIA_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
function safeUploadFolder(f?: string): string {
  const v = (f ?? "assets").trim();
  return ALLOWED_UPLOAD_FOLDERS.has(v) ? v : "assets";
}
function safeUploadFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file"; // basename (yo'l qismlarini tashla)
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 200);
  return cleaned || "file";
}

// SC_63 — CMS media hajm shipi (advisory: presigned PUT'ni server to'xtata olmaydi,
// lekin URL berishdan OLDIN e'lon qilingan hajm tekshiriladi — ref-upload-url naqshi).
const CMS_MEDIA_MAX_IMAGE_BYTES = 40 * 1024 * 1024; // rasm/GIF — 40MB
const CMS_MEDIA_MAX_VIDEO_BYTES = 150 * 1024 * 1024; // qisqa video loop — 150MB

adminRouter.post("/upload-url", async (req, res) => {
  const { fileName, contentType, folder, sizeBytes } = req.body as {
    fileName?: string;
    contentType?: string;
    folder?: string;
    sizeBytes?: number;
  };

  if (!fileName || !contentType) {
    res.status(400).json({ error: "fileName and contentType required" });
    return;
  }

  const safeFolder = safeUploadFolder(folder);
  // SC_02 — CMS media papkalari (CDN'da ommaviy): faqat image/* (GIF ham shu yerda)
  // yoki mp4/webm video.
  if (
    CMS_MEDIA_FOLDERS.has(safeFolder) &&
    !CMS_MEDIA_CONTENT_TYPES.test(contentType) &&
    !CMS_MEDIA_VIDEO_TYPES.has(contentType)
  ) {
    res.status(400).json({ error: "Only image/* (incl. GIF) or video/mp4|webm allowed for CMS media uploads" });
    return;
  }
  // SC_63 — hajm shipi (agar klient e'lon qilsa)
  if (CMS_MEDIA_FOLDERS.has(safeFolder) && Number.isFinite(sizeBytes) && (sizeBytes as number) > 0) {
    const isVideo = CMS_MEDIA_VIDEO_TYPES.has(contentType);
    const cap = isVideo ? CMS_MEDIA_MAX_VIDEO_BYTES : CMS_MEDIA_MAX_IMAGE_BYTES;
    if ((sizeBytes as number) > cap) {
      res.status(400).json({
        error: `File too large — ${isVideo ? "video" : "image"} CMS media must be under ${Math.round(cap / (1024 * 1024))} MB`,
      });
      return;
    }
  }

  const key = `${safeFolder}/${Date.now()}-${safeUploadFileName(fileName)}`;

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
  // SC_63 — CMS media yuklashlari endi audit'da (ilgari izsiz edi)
  if (CMS_MEDIA_FOLDERS.has(safeFolder)) {
    await writeAuditLog({
      actorId: req.user!.userId,
      action: "site_media.upload_url",
      targetType: "siteMedia",
      targetId: key.slice(0, 180),
      detail: `${contentType}${Number.isFinite(sizeBytes) ? ` · ${sizeBytes} bytes` : ""}`,
    });
  }
  res.json({ uploadUrl, key, publicUrl: getPublicUrl(key) });
});

// ── SC_63 — Sayt media kutubxonasi (CMS'ga yuklangan fayllar) ────────────────
// landing/ + site/plugin/ prefikslari ostidagi obyektlar ro'yxati; har biri uchun
// konfiguratsiyada ishlatilayotgan joylari (usedBy) hisoblanadi — o'chirishdan
// oldin ogohlantirish uchun. Kalitlar FLAT (subpath yo'q) — public-keys bilan mos.
const SITE_MEDIA_PREFIXES = ["landing/", "site/plugin/"] as const;

function siteMediaKindFromKey(key: string): "image" | "video" | "gif" | "other" {
  const ext = (key.split(".").pop() || "").toLowerCase();
  if (ext === "gif") return "gif";
  if (["png", "jpg", "jpeg", "webp", "avif", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  return "other";
}

/** Konfiguratsiya blobi ichidan barcha mediaUrl qiymatlarini yo'li bilan yig'adi. */
function collectMediaUrls(node: unknown, path: string, out: { path: string; url: string }[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectMediaUrls(v, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "mediaUrl" && typeof v === "string" && v) out.push({ path, url: v });
    else collectMediaUrls(v, path ? `${path}.${k}` : k, out);
  }
}

adminRouter.get("/site-media", async (_req, res) => {
  if (!isS3Configured()) {
    res.json({ items: [], configured: false });
    return;
  }
  const [landingList, pluginList, landingCfg, pluginCfg] = await Promise.all([
    listS3ObjectsByPrefix("landing/"),
    listS3ObjectsByPrefix("site/plugin/"),
    getLandingConfig(),
    getPluginContentConfig(),
  ]);
  const used: { path: string; url: string }[] = [];
  collectMediaUrls(landingCfg.config, "website", used);
  collectMediaUrls(pluginCfg.config, "plugin", used);
  const items = landingList
    .concat(pluginList)
    // faqat flat kalitlar (CDN public bo'ladiganlar)
    .filter((o) => /^landing\/[^/]+$/.test(o.key) || /^site\/plugin\/[^/]+$/.test(o.key))
    .map((o) => {
      const usedBy = used.filter((u) => u.url.endsWith("/" + o.key) || u.url === getPublicUrl(o.key)).map((u) => u.path);
      return {
        key: o.key,
        folder: o.key.startsWith("landing/") ? "landing" : "site/plugin",
        publicUrl: getPublicUrl(o.key),
        sizeBytes: o.sizeBytes,
        lastModified: o.lastModified,
        kind: siteMediaKindFromKey(o.key),
        usedBy,
      };
    })
    .sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
  res.json({ items, configured: true });
});

adminRouter.delete("/site-media", async (req, res) => {
  const { key, force } = req.body as { key?: string; force?: boolean };
  if (!key || typeof key !== "string" || !SITE_MEDIA_PREFIXES.some((p) => key.startsWith(p))) {
    res.status(400).json({ error: "key must be under landing/ or site/plugin/" });
    return;
  }
  if (!/^landing\/[^/]+$/.test(key) && !/^site\/plugin\/[^/]+$/.test(key)) {
    res.status(400).json({ error: "Invalid media key" });
    return;
  }
  // Ishlatilayotgan faylni himoya qilamiz (force bilan chetlab o'tish mumkin)
  const [landingCfg, pluginCfg] = await Promise.all([getLandingConfig(), getPluginContentConfig()]);
  const used: { path: string; url: string }[] = [];
  collectMediaUrls(landingCfg.config, "website", used);
  collectMediaUrls(pluginCfg.config, "plugin", used);
  const usedBy = used.filter((u) => u.url.endsWith("/" + key) || u.url === getPublicUrl(key)).map((u) => u.path);
  if (usedBy.length && !force) {
    res.status(409).json({ error: "Media is in use", usedBy });
    return;
  }
  await deleteS3Objects([key]);
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "site_media.delete",
    targetType: "siteMedia",
    targetId: key.slice(0, 180),
    detail: usedBy.length ? `forced · was used by ${usedBy.join(", ")}`.slice(0, 200) : "unused",
  });
  res.json({ ok: true, usedBy });
});

// ── SC_62 — CMS konfiguratsiya versiya tarixi (undo/restore) ─────────────────
adminRouter.get("/content-revisions", async (req, res) => {
  const kind = req.query.kind === "plugin" ? "plugin" : "landing";
  const items = await listContentRevisions(kind);
  res.json({ items, kind });
});

adminRouter.post("/content-revisions/:id/restore", async (req, res) => {
  const rev = await getContentRevision(String(req.params.id || ""));
  if (!rev) {
    res.status(404).json({ error: "Revision not found" });
    return;
  }
  const actor = req.user!.userId;
  const blob = (rev.data && typeof rev.data === "object" ? rev.data : {}) as Record<string, unknown>;
  const config =
    rev.kind === "plugin"
      ? await replacePluginContentConfigBlob(blob, actor)
      : await replaceLandingConfigBlob(blob, actor);
  await writeAuditLog({
    actorId: actor,
    action: rev.kind === "plugin" ? "plugin_content.restore" : "landing_config.restore",
    targetType: rev.kind === "plugin" ? "pluginContentConfig" : "landingConfig",
    targetId: "singleton",
    detail: `revision ${rev.id}`,
  });
  res.json({ config, kind: rev.kind });
});

/**
 * GET /api/admin/platform-config — #91 (A3): HAQIQIY platforma konfiguratsiyasi (READ-ONLY).
 *
 * Ilgari admin "Settings" ekrani tahrirlanadigan maydonlarni ko'rsatardi, ammo hech
 * qayerga saqlamasdi (va qiymatlari ham noto'g'ri edi — masalan "200 MB"). Bu qiymatlar
 * kod/env bilan belgilanadi, shuning uchun ular UI'dan TAHRIRLANMAYDI — faqat ko'rsatiladi.
 */
adminRouter.get("/platform-config", async (_req, res) => {
  res.json({
    platformName: "FrameFlow",
    limits: {
      // Katta fayllar presigned PUT bilan to'g'ridan bulutga ketadi (per-media-sinf shipi).
      assetMaxBytes: ASSET_MAX_BYTES,
      // API orqali (multipart) o'tadigan eng katta so'rov tanasi — Cloud Run platforma limiti.
      requestBodyMaxBytes: CLOUD_RUN_REQUEST_LIMIT_BYTES,
      genRefUploadMaxBytes: MAX_REF_UPLOAD_BYTES,
    },
    retention: {
      ingestJobDays: DONE_RETENTION_DAYS,
      incomingOrphanDays: INCOMING_RETENTION_DAYS,
      genAssetDays: (() => {
        const v = Number(process.env.GEN_ASSET_RETENTION_DAYS);
        return Number.isFinite(v) && v > 0 ? v : 0; // 0 = o'chiq
      })(),
    },
    source: "env + code (not editable from the admin UI)",
  });
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

// ── Plugin CMS (admin "Plugin CMS" tab) — landing-config triosi bilan 1:1 ────
// Faqat matn/media konfiguratsiya — pul mantig'iga aloqasi yo'q (sxemada narx
// maydonlari YO'Q). Ommaviy o'qish /api/plugin/content-config (routes/plugin.ts).

/** GET /api/admin/plugin-content-config — merged config + defaultlar. */
adminRouter.get("/plugin-content-config", async (_req, res) => {
  const { config, updatedAt } = await getPluginContentConfig();
  res.json({ config, updatedAt, defaults: DEFAULT_PLUGIN_CONTENT_CONFIG });
});

/** PUT /api/admin/plugin-content-config — qisman patch (bo'lim-darajada merge) + audit. */
adminRouter.put("/plugin-content-config", async (req, res) => {
  const parsed = pluginContentConfigSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid plugin content config", detail: parsed.error.flatten() });
    return;
  }
  const config = await savePluginContentConfig(parsed.data, req.user?.userId ?? null);
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "plugin_content.update",
    targetType: "pluginContentConfig",
    targetId: "singleton",
    detail: JSON.stringify(Object.keys(parsed.data)).slice(0, 200),
  });
  res.json({ config });
});

/** DELETE /api/admin/plugin-content-config — defaultlarga qaytarish + audit. */
adminRouter.delete("/plugin-content-config", async (req, res) => {
  const config = await resetPluginContentConfig();
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "plugin_content.reset",
    targetType: "pluginContentConfig",
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
  active: z.boolean().optional(), // Audit §C — admin toggle endi saqlanadi (display)
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
      active: body.data.active ?? true,
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
const SUBSCRIBERS_PAGE_MAX = 500;
const SUBSCRIBERS_PAGE_DEFAULT = 200;

adminRouter.get("/plugin-subscribers", async (req, res) => {
  // N+1 tuzatish: avval har obunachi uchun `ensurePluginProfile` (oy-reset +
  // upsert + qayta o'qish) alohida chaqirilardi (~3N so'rov). Endi: BITTA batched
  // oy-reset + BITTA boyitilgan findMany. Semantika bir xil — reset atomik va
  // profil oldindan mavjud (upsert no-op edi). Reset findMany'dan OLDIN bajariladi,
  // shu sabab qaytgan downloadsMonth reset'dan keyingi qiymatni aks ettiradi.
  await resetExpiredPluginMonths();

  // #67 (T5.4) — ilgari findMany paginatsiyasiz edi: 50k obunachida bitta javob
  // o'nlab MB + Neon timeout. Endi take/skip. `stats` esa SAHIFADAN emas, DB
  // agregatidan hisoblanadi — u BUTUN populyatsiya bo'yicha avtoritativ qoladi
  // (studio/js/data.js uni shunday ishlatadi).
  const takeRaw = Number(req.query.take);
  const skipRaw = Number(req.query.skip);
  const take = Number.isFinite(takeRaw) && takeRaw > 0
    ? Math.min(Math.floor(takeRaw), SUBSCRIBERS_PAGE_MAX)
    : SUBSCRIBERS_PAGE_DEFAULT;
  const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

  const hourAgo = new Date(Date.now() - 3_600_000);
  const notRemoved = { status: { not: PluginAccountStatus.REMOVED } };
  const [profiles, total, byStatus, byPlan, sums, onlineCount] = await Promise.all([
    prisma.pluginProfile.findMany({
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
      // `lastSeenAt` null bo'lishi mumkin → id ikkinchi kalit, sahifalar barqaror bo'lsin
      orderBy: [{ lastSeenAt: "desc" }, { userId: "asc" }],
      take,
      skip,
    }),
    prisma.pluginProfile.count(),
    prisma.pluginProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.pluginProfile.groupBy({ by: ["plan"], where: notRemoved, _count: { _all: true } }),
    prisma.pluginProfile.aggregate({ _sum: { downloadsTotal: true } }),
    // Audit §C (P1) — onlayn yagona predikat (oxirgi 60 daqiqa + ACTIVE);
    // avvalgi humanized-label regex "Hozir"ni (eng yaqinlarini) tushirib qoldirardi.
    prisma.pluginProfile.count({
      where: { status: PluginAccountStatus.ACTIVE, lastSeenAt: { gte: hourAgo } },
    }),
  ]);

  const userIds = profiles.map((p) => p.userId);
  const tokens = await prisma.pluginToken.findMany({
    where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  const tokenOk = new Set(tokens.map((t) => t.userId));

  const items = profiles.map((row) => mapSubscriberRow(row, tokenOk.has(row.userId)));

  const statusCount = (s: PluginAccountStatus) =>
    byStatus.find((g) => g.status === s)?._count._all ?? 0;
  const planCount = (p: PluginPlanTier) =>
    byPlan.find((g) => g.plan === p)?._count._all ?? 0;
  const paidCount = planCount(PluginPlanTier.PRO) + planCount(PluginPlanTier.STUDIO);

  res.json({
    items,
    total,
    take,
    skip,
    hasMore: skip + items.length < total,
    stats: {
      total,
      active: statusCount(PluginAccountStatus.ACTIVE),
      blocked: statusCount(PluginAccountStatus.BLOCKED),
      removed: statusCount(PluginAccountStatus.REMOVED),
      online: onlineCount,
      totalDownloads: sums._sum.downloadsTotal ?? 0,
      free: planCount(PluginPlanTier.FREE),
      // Audit §C (P2) — STUDIO ham pullik: free+pro < total bo'lib qolmasin (UI Studio'ni Pro deb ko'rsatadi)
      pro: paidCount,
      studio: planCount(PluginPlanTier.STUDIO),
    },
  });
});

/** AE Browse — agregat analitika (dashboard kartochkalari uchun) */
adminRouter.get("/plugin-analytics", async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [agg, byPlan, byStatus, total, weekActive, dayActive, eventDownloads, eventImports, eventsByAppRows] =
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
      prisma.templateDownloadEvent.groupBy({
        by: ["app", "kind"],
        _count: { _all: true },
      }),
    ]);

  const eventsByApp: Record<string, { downloads: number; imports: number }> = {};
  for (const row of eventsByAppRows) {
    const key = row.app || "unknown";
    const bucket = eventsByApp[key] || (eventsByApp[key] = { downloads: 0, imports: 0 });
    if (row.kind === "download") bucket.downloads = row._count._all;
    if (row.kind === "import") bucket.imports = row._count._all;
  }

  const planCounts: Record<string, number> = { free: 0, pro: 0, studio: 0 };
  byPlan.forEach((g) => {
    planCounts[g.plan.toLowerCase()] = g._count._all;
  });
  // Audit §C (P2) — `paid` = Pro + Studio (frontend free+pro < total chalg'itmasin)
  planCounts.paid = planCounts.pro + planCounts.studio;

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
      // P5 — AE/Premiere host kesimi (null eski klientlar uchun `unknown`).
      eventsByApp,
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

  const preProfile = await ensurePluginProfile(userId);
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

  // Audit §C (P2) — admin plan o'zgarishi ham PlanChangeEvent yozadi (churn/conversion/ARPU
  // metrikalari LS-billing bilan bir manbada bo'lsin). Best-effort — so'rovni bloklamaydi.
  if (data.plan && data.plan !== preProfile.plan) {
    await recordPlanChange(userId, preProfile.plan, data.plan, "manual");
  }

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

/** Audit §C (P1) — "Message subscriber" endi REAL: email yuboradi (Resend) + audit.
 *  Avval frontend faqat toast ko'rsatib hech narsa yubormasdi (silent no-op). */
const subMessageSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});
adminRouter.post("/plugin-subscribers/:userId/message", async (req, res) => {
  const userId = String(req.params.userId);
  const parsed = subMessageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Subject and message are required" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // sendEmail throw qilmaydi — false = yuborilmadi (RESEND_API_KEY yo'q va h.k.).
  // Halol javob qaytaramiz: frontend "sent"ga qarab to'g'ri toast ko'rsatadi.
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sent = await sendEmail({
    to: user.email,
    subject: parsed.data.subject,
    html: renderEmailLayout(
      parsed.data.subject,
      `<p style="font-size:13px;line-height:1.7;white-space:pre-wrap">${esc(parsed.data.message)}</p>
       <p style="font-size:11px;color:#8A93A3;margin-top:16px">— FrameFlow team</p>`
    ),
    text: parsed.data.message,
  });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "plugin-subscriber.message",
    targetType: "pluginSubscriber",
    targetId: userId,
    detail: parsed.data.subject,
    meta: { sent },
  });
  res.json({ ok: true, sent });
});

// ── NARX DVIGATELI — admin narx boshqaruvi (Bosqich 3.4, backend) ────────────
// Admin-only (adminRouter.use requireAuth+requireAdmin), audited. Pul mantig'iga
// (consume/refund/imzo) TEGMAYDI — faqat ModelPricing manba qatorini yozadi.

/** GET /api/admin/pricing — har model: joriy kredit narx + real USD + marja + bayroq. */
adminRouter.get("/pricing", async (req, res) => {
  const [config, view, margins, measuredMap] = await Promise.all([
    getPricingConfig(),
    listPricingView(),
    computeMargins(),
    getMeasuredProviderUsdMap(), // R4_05 — o'lchangan xarajat (bitta so'rov, per-model median)
  ]);
  const marginById = new Map(margins.models.map((m) => [m.modelId, m]));
  const models = view.map((v) => {
    // R4_05 — yechilgan provider xarajati (measured → statik → default). Panel providerCostUsd'ni
    // shundan oladi → Seedream Lite/4.5 ≥1 o'lchovdan keyin $0.5 fail-safe o'rniga real ~$0.07 ko'rsatadi.
    const model = getModelById(v.modelId);
    const resolved = model
      ? computeResolvedProviderCost(model, {}, measuredMap.get(v.modelId) ?? null)
      : null;
    const providerCostUsd = resolved ? resolved.usd : v.estCostUsd;
    const subscriberUsd = v.price.representative * config.creditUsdValue;
    const currentMultiplier =
      providerCostUsd != null && providerCostUsd > 0 ? subscriberUsd / providerCostUsd : null;
    const currentGrossMarginPct =
      currentMultiplier != null ? ((subscriberUsd - providerCostUsd!) / subscriberUsd) * 100 : null;
    const belowTargetCurrent = currentMultiplier != null && currentMultiplier < config.marginTarget;
    const source = resolved?.source ?? "estimate";
    const samples = resolved?.samples ?? 0;
    const healthStatus =
      source === "estimate"
        ? "unknown"
        : resolved?.needsConfirm
          ? "review"
          : belowTargetCurrent
            ? "below-target"
            : source === "measured" && samples < 3
              ? "low-confidence"
              : "healthy";
    return {
      ...v,
      pinned: PINNED_MODEL_IDS.has(v.modelId), // BATCH4 #3 — mahsulot-narxi (auto-apply tegmaydi)
      margin: marginById.get(v.modelId) ?? null,
      belowTarget: belowTargetCurrent,
      missingCost: marginById.get(v.modelId)?.missingCost ?? true,
      // R4_05 additive fields (javob shakli buzilmaydi — mavjud estCostUsd o'z joyida qoladi):
      providerCostUsd,
      providerUnitCostUsd: resolved?.unitUsd ?? providerCostUsd,
      providerCostUnit: resolved?.unit ?? v.price.unit,
      providerCostTier: resolved?.tier ?? v.price.defaultTier,
      providerCostSource: source,
      measuredUsd: resolved ? resolved.measuredUsd : null,
      measuredUnitUsd: resolved ? resolved.measuredUsd : null,
      measuredSamples: samples,
      needsConfirm: resolved ? resolved.needsConfirm : false,
      subscriberUsd,
      currentMultiplier,
      currentGrossMarginPct,
      healthStatus,
      historicalMargin: marginById.get(v.modelId) ?? null,
      costReference: model ? providerCostReference(model) : null,
    };
  });
  const enabledModels = models.filter((m) => m.catalogEnabled !== false);
  const health = {
    total: enabledModels.length,
    verified: enabledModels.filter((m) => m.providerCostSource === "measured" && m.measuredSamples >= 3).length,
    tableBacked: enabledModels.filter((m) => m.providerCostSource === "table").length,
    needsMeasurement: enabledModels.filter((m) => m.providerCostSource === "estimate" && m.provider === "byteplus").length,
    review: enabledModels.filter((m) => m.healthStatus === "review" || m.healthStatus === "below-target").length,
    unknown: enabledModels.filter((m) => m.healthStatus === "unknown").length,
  };
  res.json({
    creditUsdValue: config.creditUsdValue,
    marginTarget: config.marginTarget,
    aggregate: margins.aggregate,
    flaggedCount: margins.flagged.length,
    health,
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
    marginTarget: z.number().min(1).max(1000).optional(),
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

/** BATCH4 #3 — POST /api/admin/pricing/apply-margin: maqsad marjani (ixtiyoriy body bilan)
 *  yangilab, BARCHA enabled model narxini kredit=ceil(providerUsd×margin÷creditUsd) bilan
 *  qayta yozadi (har tier alohida, upsertModelPricing orqali — money-zone o'zgarmaydi).
 *  Pinned modellar (mahsulot-narxi) chetlab o'tiladi va javobda ko'rsatiladi. */
adminRouter.post("/pricing/apply-margin", async (req, res) => {
  const parsed = z
    .object({
      marginTarget: z.number().min(1).max(1000).optional(),
      // R4_05 — o'lchangan xarajat OSHGAN (needsConfirm) modellar ID'lari; faqat shular narx ko'tarilishini qabul qiladi.
      confirmModelIds: z.array(z.number().int()).max(500).optional(),
      modelIds: z.array(z.number().int()).max(500).optional(),
    })
    .safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  if (parsed.data.marginTarget != null) {
    await updatePricingConfig({ marginTarget: parsed.data.marginTarget }, req.user?.userId ?? null);
  }
  const report = await applyAutoMarginAll(req.user?.userId ?? null, {
    confirmModelIds: parsed.data.confirmModelIds,
    modelIds: parsed.data.modelIds,
  });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.margin.apply",
    targetType: "modelPricing",
    targetId: "all-enabled",
    meta: {
      marginTarget: report.marginTarget,
      applied: report.applied.map((a) => ({ id: a.modelId, tiers: a.tiers, src: a.providerCostSource })),
      skippedPinned: report.skippedPinned.map((a) => a.modelId),
      skippedNoCost: report.skippedNoCost,
      skippedNeedsConfirm: report.skippedNeedsConfirm.map((a) => a.modelId),
      confirmModelIds: parsed.data.confirmModelIds ?? [],
      modelIds: parsed.data.modelIds ?? null,
    },
  });
  res.json({ report });
});

/** POST /api/admin/pricing/preview — hech nima yozmasdan tavsiya etilgan tier narxlarini qaytaradi. */
adminRouter.post("/pricing/preview", async (req, res) => {
  const parsed = z
    .object({
      marginTarget: z.number().min(1).max(1000).optional(),
      creditUsdValue: z.number().gt(0).max(100).optional(),
      modelIds: z.array(z.number().int()).max(500).optional(),
      confirmModelIds: z.array(z.number().int()).max(500).optional(),
    })
    .safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const [preview, current] = await Promise.all([
    previewAutoMarginAll(parsed.data),
    listPricingView(),
  ]);
  const currentById = new Map(current.map((m) => [m.modelId, m]));
  const stableMap = (value: Record<string, number> | null | undefined) =>
    value
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : null;
  res.json({
    ...preview,
    models: preview.models.map((m) => {
      const currentPrice = currentById.get(m.modelId)?.price ?? null;
      const proposedMap =
        m.mode === "image"
          ? stableMap(m.patch?.qualityCost)
          : m.mode === "video" && m.providerUnit !== "generation"
            ? stableMap(m.patch?.videoPerSec)
            : null;
      const currentMap =
        m.mode === "image"
          ? stableMap(currentPrice?.qualityCost)
          : m.mode === "video" && m.providerUnit !== "generation"
            ? stableMap(currentPrice?.videoPerSec)
            : null;
      return {
        ...m,
        current: currentPrice,
        // JSONB object key order is not meaningful. Compare sorted tier maps and ignore stale
        // videoPerSec metadata on per-generation models so preview reports real changes only.
        changed:
          m.patch != null &&
          (m.patch.cost !== currentPrice?.cost ||
            JSON.stringify(proposedMap) !== JSON.stringify(currentMap)),
      };
    }),
  });
});

/** R4_06 — POST /api/admin/pricing/measure-cost {modelId}: bitta modelni default tier'da BIR
 *  MARTA real generatsiya qilib, provayder token usage'idan real xarajatni o'lchaydi va measured
 *  ProviderSpend qatori yozadi (R4_05 resolveProviderUsd shundan kalibrlaydi). Admin-guarded +
 *  audited. Kredit YECHILMAYDI (subscriber oqimi emas). MUHIM: /pricing/:modelId dan OLDIN. */
adminRouter.post("/pricing/measure-cost", async (req, res) => {
  const parsed = z.object({ modelId: z.number().int() }).safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const result = await probeModelCost(parsed.data.modelId);
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.cost.measure",
    targetType: "modelPricing",
    targetId: String(parsed.data.modelId),
    meta: {
      ok: result.ok,
      code: result.code ?? null,
      usd: result.usd ?? null,
      unitUsd: result.unitUsd ?? null,
      unit: result.unit ?? null,
      tier: result.tier ?? null,
      tokens: result.tokens ?? null,
    },
  });
  if (!result.ok) {
    const status = result.code === "UNSUPPORTED" ? 400 : result.code === "NOT_CONFIGURED" ? 503 : 502;
    res.status(status).json({ error: result.error || "Measurement failed", code: result.code, result });
    return;
  }
  const view = (await listPricingView()).find((v) => v.modelId === parsed.data.modelId) ?? null;
  res.json({ result, view });
});

/** BATCH4 #3 — POST /api/admin/pricing/:modelId/auto: bitta model uchun auto-marja
 *  (pinned bo'lsa ham — admin aniq shu qatorda bosgan, ongli qaror). */
adminRouter.post("/pricing/:modelId/auto", async (req, res) => {
  const modelId = Number(req.params.modelId);
  const model = Number.isInteger(modelId) ? getModelById(modelId) : undefined;
  if (!model) {
    res.status(404).json({ error: "Unknown model" });
    return;
  }
  const config = await getPricingConfig();
  // R4_05 — bitta qatorli auto ham measured-aware. Admin aniq shu qatorda bosgani = xarajat
  // ko'tarilishini ham TASDIQLAGAN (confirm:true) — ongli qaror; bulk apply'dan farqli.
  const confirm = req.body?.confirm !== false; // default true (aniq admin harakati)
  const d = await deriveAutoPricingResolved(model, config.marginTarget, config.creditUsdValue, { confirm });
  if (!d.patch) {
    res.status(400).json({ error: "No provider cost table for this model — set the price manually", code: "NO_COST_TABLE" });
    return;
  }
  const row = await upsertModelPricing(modelId, d.patch, req.user?.userId ?? null);
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "pricing.margin.apply",
    targetType: "modelPricing",
    targetId: String(modelId),
    meta: { marginTarget: config.marginTarget, tiers: d.tiers, pinnedOverride: d.pinned, src: d.providerCostSource },
  });
  const view = (await listPricingView()).find((v) => v.modelId === modelId) ?? null;
  res.json({ derived: d, row, view });
});

/** PATCH /api/admin/pricing/:modelId — model kredit narxini yangilaydi (audit + cache bust). */
adminRouter.patch("/pricing/:modelId", async (req, res) => {
  const modelId = Number(req.params.modelId);
  if (!Number.isInteger(modelId)) {
    res.status(400).json({ error: "Invalid modelId" });
    return;
  }
  const model = getModelById(modelId);
  if (!model) {
    res.status(404).json({ error: "Unknown model" });
    return;
  }
  const parsed = pricingPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  // Server-side never-below-cost guard. UI warning alone is not a financial control.
  if (
    parsed.data.cost != null ||
    parsed.data.qualityCost != null ||
    parsed.data.videoPerSec != null
  ) {
    const cfg = await getPricingConfig();
    const floor = await deriveAutoPricingResolved(model, 1, cfg.creditUsdValue, { confirm: true });
    const failures: Array<{ tier: string; entered: number; minimum: number }> = [];
    if (parsed.data.cost != null && floor.patch?.cost != null && parsed.data.cost < floor.patch.cost) {
      failures.push({ tier: "default", entered: parsed.data.cost, minimum: floor.patch.cost });
    }
    for (const field of ["qualityCost", "videoPerSec"] as const) {
      const entered = parsed.data[field];
      const minimum = floor.patch?.[field];
      if (!entered || !minimum) continue;
      for (const [tier, value] of Object.entries(entered)) {
        const min = minimum[tier];
        if (min != null && value < min) failures.push({ tier, entered: value, minimum: min });
      }
    }
    if (failures.length) {
      res.status(409).json({
        error: "Price is below measured/provider cost",
        code: "BELOW_PROVIDER_COST",
        failures,
      });
      return;
    }
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
  const monthStr = req.query.month ? String(req.query.month) : undefined;
  const range = monthRange(monthStr);
  // FAZA 4 (A) — REAL daromad (RevenueEvent). MRR = joriy oy obuna net tushumi;
  // month berilsa o'sha oy. Kredit-qiymat proxy (aggregate) AI-marja tahlili uchun QOLADI.
  const mrrRange = range.since ? range : monthRange(new Date().toISOString().slice(0, 7));
  // Step 20 (D3) — pool bazasidan ayiriladigan infra (tanlangan oy; oy yo'q → 0).
  const infraMonth = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : null;
  const [config, margins, providers, unpaid, revenue, mrrCents, poolBaseCents, infra] = await Promise.all([
    getPricingConfig(),
    computeMargins(range),
    spendByProvider(range),
    prisma.contributorEarning.aggregate({ where: { payoutId: null }, _sum: { amountCents: true } }),
    revenueSummary(range),
    // MRR = joriy (yoki so'ralgan) oy obuna NET tushumi, obuna refundlari AYIRILGAN.
    netSubscriptionRevenueCents(mrrRange),
    // Pool bazasi — tanlangan davr uchun (obuna net − obuna refundlari).
    netSubscriptionRevenueCents(range),
    infraMonth ? getInfraCostForMonth(infraMonth) : Promise.resolve(null),
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
    // Step 20 (D3) — infra pool bazasidan ayiriladi (oy tanlangan bo'lsa).
    infraCents: infra ? infra.totalCents : 0,
    infraPresent: infra ? infra.present : false,
    payoutMode: payoutMode(),
    poolShare: contributorPoolShare(),
  });
});

// ── Step 20 (P26.4) — SYBIL / self-dealing tahlili (FAQAT O'QISH) ───────────
/** GET /api/admin/sybil[?sinceDays=90&onlySuspicious=1] — shubhali contributorlar +
 *  sabab + hodisalar. Earning/pool matematikasiga TEGMAYDI — faqat qo'lda ko'rib chiqish. */
adminRouter.get("/sybil", async (req, res) => {
  const sinceDays = req.query.sinceDays ? Number(req.query.sinceDays) : undefined;
  const onlySuspicious = req.query.onlySuspicious === "1" || req.query.onlySuspicious === "true";
  const result = await analyzeSybil({
    sinceDays: Number.isFinite(sinceDays) ? sinceDays : undefined,
    onlySuspicious,
  });
  res.json(result);
});

// ── Step 20 (D3) — INFRA xarajati (pool bazasidan ayiriladi; profit paneliga) ─
/** GET /api/admin/infra-cost — oxirgi oylar infra xarajati (admin kiritgan). */
adminRouter.get("/infra-cost", async (_req, res) => {
  const rows = await listInfraCosts(24);
  res.json({ holdDays: payoutHoldDays(), flagScore: sybilFlagScore(), rows });
});

/** POST /api/admin/infra-cost { periodMonth, storageUsd, egressUsd, computeUsd, note } —
 *  oylik infra xarajatini kiritadi/yangilaydi (ProviderInvoice naqshi). Audit yoziladi. */
adminRouter.post("/infra-cost", async (req, res) => {
  const body = z
    .object({
      periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
      storageUsd: z.number().min(0).optional(),
      egressUsd: z.number().min(0).optional(),
      computeUsd: z.number().min(0).optional(),
      note: z.string().max(300).optional(),
    })
    .safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const row = await upsertInfraCost({ ...body.data, createdById: req.user?.userId ?? null });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "infra.cost.upsert",
    targetType: "infraCost",
    targetId: body.data.periodMonth,
    meta: { storageUsd: body.data.storageUsd, egressUsd: body.data.egressUsd, computeUsd: body.data.computeUsd },
  });
  res.json({ ok: true, row });
});

// ── Step 21 (P26.8) — FOYDA PANELI (revenue − AI − LS − infra − contributor) ─
/** GET /api/admin/profit[?month=YYYY-MM] — bitta ekran foyda hisoboti. FAQAT O'QISH. */
adminRouter.get("/profit", async (req, res) => {
  const month = req.query.month ? String(req.query.month) : undefined;
  const stmt = await computeProfitStatement(month && /^\d{4}-\d{2}$/.test(month) ? month : undefined);
  res.json(stmt);
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
    select: { id: true, userId: true, cost: true, status: true, refunded: true },
  });
  const genUser = new Map<string, string>();
  const perUser = new Map<string, { gens: number; credits: number; costUsd: number }>();
  for (const g of gens) {
    genUser.set(g.id, g.userId);
    const u = perUser.get(g.userId) ?? { gens: 0, credits: 0, costUsd: 0 };
    if (g.status === "done") u.gens += 1;
    // Audit §C (P2) — kredit sarfi endi BIR ta'rif: yechilgan va QAYTARILMAGAN kreditlar
    // (users/:id/generations summary'dagi creditsNet bilan mos). Avval faqat status=done
    // sanardi — failed-lekin-refund-qilinmagan sarf tushib qolib, marja noto'g'ri chiqardi.
    if (!g.refunded) u.credits += g.cost ?? 0;
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

/** P2: GET /api/admin/users/:id/generations[?cursor=&take=] — bitta userning BARCHA AI
 *  generatsiyalari (done/FAILED/running), status + refund + cost + prompt + imzolangan media
 *  thumb/url (hydrateGenAssets). FAQAT O'QISH (mutatsiya yo'q). Sahifalangan (cursor). */
adminRouter.get("/users/:id/generations", async (req, res) => {
  const userId = String(req.params.id);
  const take = Math.min(60, Math.max(10, Number(req.query.take) || 30));
  const cursor = req.query.cursor ? String(req.query.cursor) : null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const gens = await prisma.generation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: take + 1, // +1 → hasMore aniqlash
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, createdAt: true, mode: true, modelId: true, status: true,
      refunded: true, cost: true, prompt: true,
      assets: { select: { id: true, type: true, url: true, resultKey: true, thumbUrl: true, thumbKey: true } },
    },
  });
  const hasMore = gens.length > take;
  const page = hasMore ? gens.slice(0, take) : gens;
  // Media imzolash — /gen/history bilan bir xil (hydrateGenAssets reuse). Xato bitta genni buzmasin.
  // P4 (14b): admin MODERATSIYA ko'rinishi — obunachi kontentini ASL holida ko'rishi kerak
  // (suv belgisiz), shu bois viewerIsPaid=true (ishonchli xodim). Bu obunachining o'z yuklab
  // olishiga TA'SIR QILMAYDI — u FREE bo'lsa o'z sessiyasida baribir suv belgili nusxa oladi.
  await Promise.all(page.map((g) => hydrateGenAssets(g, { viewerIsPaid: true }).catch(() => g)));
  const items = page.map((g) => ({
    id: g.id,
    createdAt: g.createdAt,
    mode: g.mode,
    modelId: g.modelId,
    model: getModelById(g.modelId)?.label ?? String(g.modelId),
    status: g.status, // "done" | "failed" | "running" | "queued"
    refunded: g.refunded,
    cost: g.cost,
    prompt: g.prompt,
    // #2 — GenAsset.type RAQAMLI kod (image=130, audio=120, video=140, gen-processor.ts)
    // — UI string kutib video'ni <img>ga solardi (singan preview). Normalized `kind` +
    // hydrateGenAssets allaqachon hisoblagan downloadUrl (attachment) ADDITIVE qaytariladi.
    assets: g.assets.map((a) => ({
      type: a.type,
      kind: a.type === 140 ? "video" : a.type === 120 ? "audio" : "image",
      url: a.url,
      thumbUrl: a.thumbUrl,
      downloadUrl: (a as { downloadUrl?: string }).downloadUrl ?? a.url,
    })),
  }));

  // Xulosa — BARCHA gens uchun (sahifadan qat'i nazar). Kredit sarfi vs refund.
  const [total, failedCount, refundedAgg, consumedAgg] = await Promise.all([
    prisma.generation.count({ where: { userId } }),
    prisma.generation.count({ where: { userId, status: "failed" } }),
    prisma.generation.aggregate({ where: { userId, refunded: true }, _count: true, _sum: { cost: true } }),
    prisma.generation.aggregate({ where: { userId }, _sum: { cost: true } }),
  ]);
  const creditsConsumed = consumedAgg._sum.cost ?? 0;
  const creditsRefunded = refundedAgg._sum.cost ?? 0;
  res.json({
    items,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    summary: {
      total,
      failed: failedCount,
      refunded: refundedAgg._count,
      creditsConsumed,
      creditsRefunded,
      creditsNet: creditsConsumed - creditsRefunded,
    },
  });
});

/** #137 (A8) — POST /api/admin/users/:id/generations/:genId/refund — bitta generatsiya
 *  uchun QO'LDA kredit qaytarish. Ilgari admin muvaffaqiyatsiz/nuqsonli genni ko'rardi-yu
 *  hech narsa qila olmasdi (refund faqat provayder xatosida avtomatik ishlardi) — obunachi
 *  shikoyat qilsa admin uchun hech qanday yo'l yo'q edi.
 *
 *  Idempotentlik `refundAiCredits`ning atomik `refunded=false→true` claim'idan keladi:
 *  ikki marta bosilsa ikkinchisi 409 qaytaradi, kredit IKKI marta berilmaydi. */
adminRouter.post("/users/:id/generations/:genId/refund", async (req, res) => {
  const userId = String(req.params.id);
  const genId = String(req.params.genId);
  const gen = await prisma.generation.findUnique({
    where: { id: genId },
    select: { id: true, userId: true, cost: true, refunded: true, status: true, modelId: true },
  });
  if (!gen || gen.userId !== userId) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }
  if (gen.refunded) {
    res.status(409).json({ error: "Already refunded", code: "ALREADY_REFUNDED" });
    return;
  }
  if (gen.cost <= 0) {
    res.status(400).json({ error: "Nothing to refund — this generation cost 0 credits" });
    return;
  }
  // Atomik claim ichkarida; claim yutmasa (parallel refund) kredit berilmaydi.
  await refundAiCredits(userId, gen.cost, { generationId: gen.id });
  const after = await prisma.generation.findUnique({
    where: { id: gen.id },
    select: { refunded: true },
  });
  if (!after?.refunded) {
    res.status(409).json({ error: "Already refunded", code: "ALREADY_REFUNDED" });
    return;
  }
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "generation.refund",
    targetType: "generation",
    targetId: gen.id,
    detail: `${gen.cost} cr · ${gen.modelId} · status=${gen.status}`,
  });
  const profile = await prisma.pluginProfile
    .findUnique({ where: { userId }, select: { aiCredits: true } })
    .catch(() => null);
  res.json({ ok: true, refunded: gen.cost, aiCredits: profile?.aiCredits ?? null });
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

// ── P11 — Plagin relizlari (in-panel update kanali) ─────────────────────────
// Oqim: admin paketni /admin/upload-url (folder=releases) presigned PUT bilan yuklaydi,
// so'ng shu endpoint reliz yozuvini yaratadi. GET /api/plugin/version (ommaviy) eng
// so'nggisini qaytaradi — plagin banneri shu bilan ishlaydi.
const releaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be semver: 1.2.3"),
  // FAZA 5 — qaysi host paneli: "ae" (CEP) | "pr" (Premiere UXP). Berilmasa "ae"
  // (mavjud admin UI o'zgarishsiz ishlaydi). Versiya HOST ICHIDA unikal.
  host: z
    .string()
    .refine(isKnownPluginHost, "Host must be ae or pr")
    .optional(),
  // LEGACY .zxp — endi IXTIYORIY (qo'lda yuklab olish sahifasi uchun). Panel uni
  // hech qachon avtomatik o'rnatmaydi; avtomatik yangilanish faqat `installers` bilan.
  key: z
    .string()
    .min(1)
    .refine((k) => k.startsWith("releases/"), "Key must be under releases/")
    .refine(isZxpReleaseKey, "Key must point to a signed .zxp package")
    .optional(),
  releaseNotes: z.string().max(4000).optional(),
  mandatory: z.boolean().optional(),
  minSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional().or(z.literal("").transform(() => undefined)),
  checksum: z.string().max(128).optional(),
  // Task 2 — platformaga xos installerlar (mac .pkg / win .exe|.msi). Har biri uchun
  // SHA-256 MAJBURIY va serverda storage'dan qayta hisoblanadi.
  installers: z
    .array(
      z.object({
        platform: z.string().min(1),
        key: z.string().min(1),
        sha256: z.string().min(1),
      })
    )
    .max(INSTALLER_PLATFORMS.length)
    .optional(),
});

/** Installer artefakti uchun tekshiruv chegarasi (server SHA-256'ni oqim bilan qayta
 *  hisoblaydi — cheklanmagan ish bo'lmasin). */
const MAX_INSTALLER_VERIFY_BYTES = 512 * 1024 * 1024;

adminRouter.get("/plugin-releases", async (_req, res) => {
  const rows = await prisma.pluginRelease.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: { installers: { orderBy: { platform: "asc" } } },
  });
  // storageKey admin javobida ham ochilmaydi (kalitlar UI'ga tushmasin).
  const items = rows.map((r) => ({
    id: r.id,
    host: r.host,
    version: r.version,
    releaseNotes: r.releaseNotes,
    mandatory: r.mandatory,
    minSupportedVersion: r.minSupportedVersion,
    publishedAt: r.publishedAt,
    hasLegacyZxp: !!r.downloadKey,
    installers: r.installers.map((i) => ({
      platform: i.platform,
      ext: installerExtension(i.storageKey),
      sha256: i.sha256,
      sizeBytes: i.sizeBytes,
    })),
  }));
  res.json({ items });
});

adminRouter.post("/plugin-releases", async (req, res) => {
  const p = releaseSchema.safeParse(req.body ?? {});
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Invalid release" });
    return;
  }
  const host = normalizePluginHost(p.data.host);
  const rawInstallers = p.data.installers ?? [];
  if (!p.data.key && rawInstallers.length === 0) {
    const exts = HOST_INSTALLER_EXTENSIONS[host];
    const list = Array.from(new Set([...exts.mac, ...exts.win])).map((e) => "." + e).join(" / ");
    res.status(400).json({ error: `Upload at least one platform installer (${list})` });
    return;
  }
  // 1) Installer kontrakti — platforma allowlist, kengaytma, SHA-256 shakli (fail-closed).
  const validated: { platform: string; key: string; sha256: string }[] = [];
  const seenPlatforms = new Set<string>();
  for (const raw of rawInstallers) {
    const v = validateInstallerInput({ ...raw, host });
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    if (seenPlatforms.has(v.platform)) {
      res.status(400).json({ error: `Duplicate installer for ${v.platform}` });
      return;
    }
    seenPlatforms.add(v.platform);
    validated.push({ platform: v.platform, key: v.key, sha256: v.sha256 });
  }
  // 2) LEGACY .zxp berilgan bo'lsa — storage'da bor bo'lishi shart.
  let legacySize: number | null = null;
  if (p.data.key) {
    const meta = await getS3ObjectMeta(p.data.key);
    if (meta.sizeBytes == null) {
      res.status(400).json({ error: "Package not found in storage — upload it first" });
      return;
    }
    legacySize = meta.sizeBytes;
  }
  // 3) Har installer: storage'da mavjud + SHA-256 SERVERDA qayta hisoblanadi va mos kelishi shart.
  const installerRows: { platform: string; storageKey: string; sha256: string; sizeBytes: number }[] = [];
  for (const inst of validated) {
    const meta = await getS3ObjectMeta(inst.key);
    if (meta.sizeBytes == null || meta.sizeBytes <= 0) {
      res.status(400).json({ error: `Installer for ${inst.platform} not found in storage — upload it first` });
      return;
    }
    if (meta.sizeBytes > MAX_INSTALLER_VERIFY_BYTES) {
      res.status(400).json({ error: `Installer for ${inst.platform} is too large to verify` });
      return;
    }
    let actual: string;
    try {
      actual = await sha256OfS3Object(inst.key, MAX_INSTALLER_VERIFY_BYTES);
    } catch {
      res.status(400).json({ error: `Could not verify the ${inst.platform} installer in storage` });
      return;
    }
    if (actual.toLowerCase() !== inst.sha256) {
      res.status(400).json({ error: `SHA-256 mismatch for the ${inst.platform} installer — re-upload and try again` });
      return;
    }
    installerRows.push({ platform: inst.platform, storageKey: inst.key, sha256: actual.toLowerCase(), sizeBytes: meta.sizeBytes });
  }
  const exists = await prisma.pluginRelease.findUnique({
    where: { host_version: { host, version: p.data.version } },
  });
  if (exists) {
    res.status(409).json({ error: "This version is already published" });
    return;
  }
  const row = await prisma.pluginRelease.create({
    data: {
      host,
      version: p.data.version,
      downloadKey: p.data.key ?? null,
      releaseNotes: p.data.releaseNotes ?? null,
      mandatory: !!p.data.mandatory,
      minSupportedVersion: p.data.minSupportedVersion ?? null,
      checksum: p.data.checksum ?? null,
      createdById: req.user?.userId ?? null,
      installers: { create: installerRows },
    },
    include: { installers: true },
  });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "plugin_release.publish",
    targetType: "pluginRelease",
    targetId: row.version,
    meta: {
      host: row.host,
      sizeBytes: legacySize,
      mandatory: row.mandatory,
      installers: row.installers.map((i) => ({ platform: i.platform, sizeBytes: i.sizeBytes, sha256: i.sha256 })),
    },
  });
  res.status(201).json({
    id: row.id,
    version: row.version,
    mandatory: row.mandatory,
    minSupportedVersion: row.minSupportedVersion,
    publishedAt: row.publishedAt,
    installers: row.installers.map((i) => ({ platform: i.platform, sha256: i.sha256, sizeBytes: i.sizeBytes })),
  });
});

adminRouter.delete("/plugin-releases/:id", async (req, res) => {
  const row = await prisma.pluginRelease.findUnique({ where: { id: String(req.params.id) } });
  if (!row) {
    res.status(404).json({ error: "Release not found" });
    return;
  }
  await prisma.pluginRelease.delete({ where: { id: row.id } });
  await writeAuditLog({
    actorId: req.user?.userId ?? null,
    action: "plugin_release.delete",
    targetType: "pluginRelease",
    targetId: row.version,
  });
  res.json({ ok: true });
});

// ── PROBLEM 7 — Storage sizeBytes diagnostika + backfill (maintenance) ──────
// Tarixiy GenAsset/SavedReference qatorlarida sizeBytes null (ustun 2026-07-05
// da qo'shilgan) → "Storage (AI results)" kam ko'rsatiladi. Bu ikki endpoint
// production'da (Cloud Run ichida — storage HeadObject + prod DB) ishga
// tushiriladi. Kredit/billing'ga ALOQASIZ — faqat storage hisobi ustuni.

/** GET /api/admin/maintenance/gen-sizebytes — faqat o'qish: null/0 taqsimoti. */
adminRouter.get("/maintenance/gen-sizebytes", async (_req, res) => {
  res.json(await diagnoseSizeBytes());
});

const backfillSchema = z.object({
  limit: z.number().int().min(1).max(5000).optional(),
  dryRun: z.boolean().optional(),
});

/** POST /api/admin/maintenance/gen-sizebytes/backfill — idempotent backfill (limit'lab). */
adminRouter.post("/maintenance/gen-sizebytes/backfill", async (req, res) => {
  const parsed = backfillSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const result = await backfillSizeBytes(parsed.data);
  if (!result.dryRun && (result.updated > 0 || result.estimated > 0)) {
    await writeAuditLog({
      actorId: req.user?.userId ?? null,
      action: "maintenance.sizebytes.backfill",
      targetType: "genAsset",
      meta: result as unknown as Record<string, unknown>,
    });
  }
  res.json(result);
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
        // #95 (A7) — umumiy to'xtatish holati (contributor-blokdan ALOHIDA).
        suspendedAt: true,
        suspendedReason: true,
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
      // `blocked` = contributor yuklashi bloklangan (eski maydon, o'z ma'nosida qoldi).
      blocked: !!u.contributorBlockedAt,
      // #95 (A7) — butun hisob to'xtatilgan (kirish umuman yopiq).
      suspended: !!u.suspendedAt,
      suspendedAt: u.suspendedAt,
      suspendedReason: u.suspendedReason,
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

const suspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(300).optional(),
});

/** PATCH /api/admin/users/:id/suspend — UMUMIY hisob to'xtatish/tiklash (#95 / A7).
 *  `contributorBlockedAt` faqat yuklashni to'xtatadi; bu esa hisobning HAR qanday
 *  kirishini (Studio, web, AE plagin) yopadi va ochiq sessiyalarni ham uzadi. */
adminRouter.patch("/users/:id/suspend", async (req, res) => {
  const parsed = suspendSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "suspended must be true or false" });
    return;
  }
  const { suspended } = parsed.data;
  const reason = (parsed.data.reason ?? "").trim().slice(0, 300);

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.id === req.user!.userId) {
    res.status(400).json({ error: "You cannot suspend your own account" });
    return;
  }
  if (!!target.suspendedAt === suspended) {
    res.status(400).json({
      error: suspended ? "Account is already suspended" : "Account is not suspended",
    });
    return;
  }

  if (suspended) {
    // Oxirgi admin himoyasi — rol o'zgarishidagi kabi (0 ta faol admin qolmasin).
    const updated = await prisma.$transaction(async (tx) => {
      if (target.role === UserRole.ADMIN) {
        const activeAdmins = await tx.user.count({
          where: { role: UserRole.ADMIN, suspendedAt: null },
        });
        if (activeAdmins <= 1) return null;
      }
      const u = await tx.user.update({
        where: { id: target.id },
        data: {
          suspendedAt: new Date(),
          suspendedReason: reason || null,
          // Ochiq JWT sessiyalar darhol bekor bo'ladi (requireAuth tokenVersion tekshiradi).
          tokenVersion: { increment: 1 },
        },
      });
      // AE plagin tokenlari JWT emas — alohida o'chiriladi.
      await tx.pluginToken.deleteMany({ where: { userId: target.id } });
      return u;
    });
    if (!updated) {
      res.status(409).json({ error: "Cannot suspend the last remaining admin" });
      return;
    }
  } else {
    await prisma.user.update({
      where: { id: target.id },
      data: { suspendedAt: null, suspendedReason: null },
    });
  }

  await writeAuditLog({
    actorId: req.user!.userId,
    action: suspended ? "user.suspended" : "user.unsuspended",
    targetType: "user",
    targetId: target.id,
    detail: suspended ? `${target.email} to'xtatildi${reason ? `: ${reason}` : ""}` : `${target.email} tiklandi`,
    meta: { suspended, reason: reason || null },
  });

  res.json({ item: { id: target.id, email: target.email, suspended } });
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
