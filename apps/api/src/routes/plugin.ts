import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PluginAccountStatus, PluginPlanTier, prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { isS3Configured, getPublicUrl } from "../lib/s3.js";
import {
  ensurePluginProfile,
  recordPluginDownload,
  recordPluginImport,
  serializePluginUser,
  setPluginPlan,
} from "../lib/plugin-profile.js";
import { approvedCatalogWhere, mapCatalogItem } from "../lib/catalog-map.js";
import {
  type TemplateAssetKind,
  findScenePreview,
  sceneFileIsVideo,
} from "../lib/template-files.js";
import { serveTemplateAsset } from "../lib/serve-asset.js";

export const pluginRouter = Router();

/** Brute-force'dan himoya: login uchun qattiq limit */
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "plugin-login",
  message: "Juda ko'p urinish — 1 daqiqadan keyin qayta urinib ko'ring",
});

/** Usage/heartbeat: abuse'ni cheklash, lekin normal ishlashga xalal bermaslik */
const usageLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyPrefix: "plugin-usage",
});

function apiPublicBase(req: { protocol: string; get: (h: string) => string | undefined }) {
  const env = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.get("host");
  return `${req.protocol}://${host}`;
}

const CATALOG_SELECT = {
  id: true,
  externalId: true,
  name: true,
  description: true,
  nav: true,
  cat: true,
  catLabel: true,
  orient: true,
  res: true,
  tags: true,
  icon: true,
  bg: true,
  templateApp: true,
  metaJson: true,
  fileName: true,
  fileSize: true,
  updatedAt: true,
} as const;

/** Browse panel — tasdiqlangan shablonlar (server) */
pluginRouter.get("/catalog", async (req, res) => {
  const base = apiPublicBase(req);
  const items = await prisma.contributorTemplate.findMany({
    where: approvedCatalogWhere,
    orderBy: { updatedAt: "desc" },
    select: CATALOG_SELECT,
  });
  res.json({ items: items.map((t) => mapCatalogItem(t, base)) });
});

/** Browse notice-bar — eng yangi tasdiqlangan shablonlar */
pluginRouter.get("/featured", async (req, res) => {
  const base = apiPublicBase(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 12);
  const items = await prisma.contributorTemplate.findMany({
    where: approvedCatalogWhere,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: CATALOG_SELECT,
  });
  res.json({ items: items.map((t) => mapCatalogItem(t, base)) });
});

/** Per-scene preview — rasm (PNG/JPG) yoki video (MP4/MOV), Range qo'llab-quvvatlanadi */
pluginRouter.get("/assets/:templateId/scene/:key", (req, res) => {
  // S3/R2 sozlangan bo'lsa — to'g'ridan redirect
  if (isS3Configured()) {
    const s3Key = `templates/${req.params.templateId}/scenes/${req.params.key}`;
    const url = getPublicUrl(s3Key);
    res.redirect(302, url);
    return;
  }

  const filePath = findScenePreview(
    String(req.params.templateId),
    String(req.params.key)
  );
  if (!filePath) {
    res.status(404).json({ error: "Sahna preview topilmadi" });
    return;
  }

  const ext = require("path").extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".mp4": "video/mp4",
    ".mov": "video/quicktime", ".webm": "video/webm",
  };
  const contentType = mimeMap[ext] || "application/octet-stream";
  const isVideo = sceneFileIsVideo(filePath);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=3600");

  if (isVideo) {
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Range, Accept-Ranges, Content-Length"
    );
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        if (start >= fileSize || end >= fileSize || start > end) {
          res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
          return;
        }
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        res.setHeader("Content-Length", String(end - start + 1));
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
    res.setHeader("Content-Length", String(fileSize));
  }

  fs.createReadStream(filePath).pipe(res);
});

pluginRouter.get("/assets/:templateId/:kind", (req, res) => {
  const kind = req.params.kind as TemplateAssetKind;
  if (!["thumb", "preview", "pack"].includes(kind)) {
    res.status(400).json({ error: "Noto'g'ri tur" });
    return;
  }
  serveTemplateAsset(req, res, String(req.params.templateId), kind);
});

function cepPrefsPath() {
  return path.join(
    os.homedir(),
    "Library/Application Support/Adobe/CEP/extensions/com.assetflow.demo/assetflow-data/prefs.json"
  );
}

async function ensurePluginToken(userId: string, reuseExisting = true) {
  if (reuseExisting) {
    const existing = await prisma.pluginToken.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing.token;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.pluginToken.deleteMany({ where: { userId } });
  await prisma.pluginToken.create({ data: { userId, token, expiresAt } });
  return token;
}

/** CEP panel token tekshiruvi */
pluginRouter.get("/validate", requireAuth, async (req, res) => {
  res.json({
    ok: true,
    userId: req.user!.userId,
    email: req.user!.email,
    role: req.user!.role,
  });
});

pluginRouter.post("/token", requireAuth, async (req, res) => {
  const token = await ensurePluginToken(req.user!.userId, false);
  const row = await prisma.pluginToken.findFirst({
    where: { userId: req.user!.userId, token },
  });
  res.json({ token, expiresAt: row?.expiresAt?.toISOString() ?? null });
});

/** Dashboard → AE: prefs.json ga cloud ulanishni yozish (plugin formasiz) */
pluginRouter.post("/apply-ae-prefs", requireAuth, async (req, res) => {
  const apiBaseUrl = (
    (req.body?.apiBaseUrl as string) ||
    process.env.WEB_URL?.replace(":3000", ":4000") ||
    "http://localhost:4000"
  ).replace(/\/$/, "");

  const pluginToken =
    (req.body?.token as string)?.trim() ||
    (await ensurePluginToken(req.user!.userId, true));

  const prefsPath = cepPrefsPath();
  let prefs: {
    favorites: string[];
    downloaded: string[];
    client: Record<string, unknown>;
  } = { favorites: [], downloaded: [], client: {} };

  try {
    if (fs.existsSync(prefsPath)) {
      prefs = { ...prefs, ...JSON.parse(fs.readFileSync(prefsPath, "utf8")) };
    }
  } catch {
    /* yangi fayl */
  }

  prefs.client = { apiBaseUrl, token: pluginToken };

  fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
  fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), "utf8");

  res.json({
    ok: true,
    prefsPath,
    apiBaseUrl,
    tokenPreview: `${pluginToken.slice(0, 8)}…`,
  });
});

pluginRouter.get("/subscription", requireAuth, async (req, res) => {
  const sub = await prisma.subscription.findUnique({
    where: { userId: req.user!.userId },
  });

  const active = sub?.status === "ACTIVE" || sub?.status === "TRIALING";

  res.json({
    active,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** AE panel — email/parol → plugin token */
pluginRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email va parol kerak" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { subscription: true },
  });

  if (!user?.passwordHash) {
    res.status(401).json({ error: "Login yoki parol noto‘g‘ri" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Login yoki parol noto‘g‘ri" });
    return;
  }

  const token = await ensurePluginToken(user.id, true);
  const profile = await ensurePluginProfile(user.id);

  if (profile.status === PluginAccountStatus.BLOCKED) {
    res.status(403).json({ error: "Hisob bloklangan — admin bilan bog‘laning" });
    return;
  }

  res.json({
    token,
    user: serializePluginUser(profile),
    adminUrl: process.env.ADMIN_URL || "http://localhost:3001/",
  });
});

/** Joriy foydalanuvchi + tarif + limitlar */
pluginRouter.get("/me", requireAuth, async (req, res) => {
  const profile = await ensurePluginProfile(req.user!.userId);
  if (profile.status === PluginAccountStatus.BLOCKED) {
    res.status(403).json({ error: "Hisob bloklangan", code: "ACCOUNT_BLOCKED" });
    return;
  }
  res.json({
    user: serializePluginUser(profile),
    adminUrl: process.env.ADMIN_URL || "http://localhost:3001/",
  });
});

const heartbeatSchema = z.object({
  deviceLabel: z.string().optional(),
  aeVersion: z.string().optional(),
});

pluginRouter.post("/heartbeat", usageLimiter, requireAuth, async (req, res) => {
  const body = heartbeatSchema.safeParse(req.body);
  const profile = await ensurePluginProfile(req.user!.userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    res.status(403).json({ error: "Hisob faol emas" });
    return;
  }
  await prisma.pluginProfile.update({
    where: { userId: req.user!.userId },
    data: {
      lastSeenAt: new Date(),
      deviceLabel: body.success ? body.data.deviceLabel : profile.deviceLabel,
      aeVersion: body.success ? body.data.aeVersion : profile.aeVersion,
    },
  });
  res.json({ ok: true });
});

const planSchema = z.object({
  plan: z.enum(["free", "pro"]),
});

pluginRouter.patch("/plan", requireAuth, async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "plan: free yoki pro" });
    return;
  }
  const tier =
    parsed.data.plan === "pro" ? PluginPlanTier.PRO : PluginPlanTier.FREE;
  const result = await setPluginPlan(req.user!.userId, tier);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});

const usageSchema = z.object({
  templateId: z.string().optional(),
});

pluginRouter.post("/usage/download", usageLimiter, requireAuth, async (req, res) => {
  const parsed = usageSchema.safeParse(req.body);
  const result = await recordPluginDownload(
    req.user!.userId,
    parsed.success ? parsed.data.templateId : undefined
  );
  if (!result.ok) {
    res.status(403).json({ error: result.error });
    return;
  }
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});

pluginRouter.post("/usage/import", usageLimiter, requireAuth, async (req, res) => {
  const parsed = usageSchema.safeParse(req.body);
  const result = await recordPluginImport(
    req.user!.userId,
    parsed.success ? parsed.data.templateId : undefined
  );
  if (!result.ok) {
    res.status(403).json({ error: result.error });
    return;
  }
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});
