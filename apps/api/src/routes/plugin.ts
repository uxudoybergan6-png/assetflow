import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  PluginAccountStatus,
  PluginPlanTier,
  TemplateReviewStatus,
  Prisma,
  prisma,
} from "@creative-tools/database";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { isS3Configured, getPublicOrSignedUrl, getSignedDownloadUrl, s3ObjectExists } from "../lib/s3.js";
import { getAdminUrl, getPublicApiUrl, getWebUrl } from "../lib/app-urls.js";
import { verifyGoogleIdTokenAndUpsertUser } from "../lib/google-auth.js";
import { sendWelcomeEmail, notifyAdminNewUser } from "../lib/notify.js";
import { decryptTotpSecret, looksLikeBackupCode, verifyTotpCode } from "../lib/twofa.js";
import {
  ensurePluginProfile,
  consumeDownload,
  consumeImport,
  serializePluginUser,
  setPluginPlan,
  isPaidPlan,
} from "../lib/plugin-profile.js";
import { approvedCatalogWhere, mapCatalogItem, mapCatalogCard } from "../lib/catalog-map.js";
import { recordTemplateDownloadEvent } from "../lib/download-events.js";
import {
  type TemplateAssetKind,
  findScenePreview,
  findMogrtFile,
  sceneKey,
  sceneFileIsVideo,
} from "../lib/template-files.js";
import { serveTemplateAsset } from "../lib/serve-asset.js";

export const pluginRouter = Router();

/** Brute-force'dan himoya: login uchun qattiq limit */
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "plugin-login",
  message: "Too many attempts — please try again in 1 minute",
});

/** Usage/heartbeat: abuse'ni cheklash, lekin normal ishlashga xalal bermaslik */
const usageLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyPrefix: "plugin-usage",
});

/** Device-code poll: har 3s so'raladi, loginLimiter juda qattiq bo'lardi */
const deviceStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "plugin-device-poll",
});

/** FAZA 2 (H1/H5) — pack/mogrt yuklab olish throttle: skriptli earning-farming va
 *  S3 xarajat portlashini to'sadi (normal foydalanish uchun keng — 60/daqiqa/IP). */
const downloadLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "plugin-download",
  message: "Too many downloads — please slow down and try again shortly",
});

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;

function apiPublicBase(req: { protocol: string; get: (h: string) => string | undefined }) {
  return getPublicApiUrl(req);
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
  kind: true, // Stock S1 — mahsulot turi maydonlari (katalog itemlarida expose qilinadi)
  stockType: true,
  templateType: true,
  metaJson: true,
  fileName: true,
  fileSize: true,
  isPro: true,
  contributor: { select: { name: true, email: true } },
  createdAt: true,
  updatedAt: true,
  reviewedAt: true, // §B — publishedAt proksisi

  assetKeysJson: true, // FAZA 5 (A2) — S3 kalitlar keshi (listing S3'siz)
} as const;

/** P1 #16 — SLIM ro'yxat SELECT: CATALOG_SELECT dan `metaJson`ni chiqarib tashlaydi.
 *  metaJson (sahnalar) ba'zan katta JSON — ro'yxatda hech qachon o'qilmaydi (karta
 *  uni ko'rsatmaydi). Sahnalar DETAL endpointida (mapCatalogItem). Bu DB o'qish va
 *  transfer hajmini kamaytiradi. */
const CATALOG_CARD_SELECT = (() => {
  const { metaJson, ...rest } = CATALOG_SELECT;
  void metaJson;
  return rest;
})();

/** FAZA 5 (§8, §11) — ixtiyoriy `?app=<kod>` filtri: har dastur faqat o'zini ko'radi
 *  (AE plagin `?app=ae` yuboradi). Param yo'q bo'lsa bugungidek hamma dasturni qaytaradi;
 *  bo'lsa approvedCatalogWhere ustiga templateApp predikati qo'shiladi (semantika buzilmaydi). */
function catalogWhere(appParam: unknown) {
  const code = typeof appParam === "string" ? appParam.trim().toLowerCase() : "";
  if (!code) return approvedCatalogWhere;
  return { ...approvedCatalogWhere, templateApp: code };
}

// ─────────────────────────────────────────────────────────────────────────────
// P1 #15 — SERVER-SIDE KATALOG: filtr · qidiruv · saralash · sahifalash.
// Ilgari IKKALA klient (web + plagin) BUTUN katalogni yuklab olib brauzerda
// filtrlardi (P5.1) → 5000 assetda birinchi sahifa ichidan qidirish + AE muzlashi.
// Endi filtr/qidiruv/saralash SERVER tomonda (approvedCatalogWhere ustiga additive
// predikatlar), indekslar (4-qadam: ct_pub_rev_* ) ishlatiladi. Param'siz so'rov
// bugungidek: approvedCatalogWhere + updatedAt desc.
// ─────────────────────────────────────────────────────────────────────────────

/** Vergul bilan ajratilgan ko'p qiymatni tozalangan (lowercase) massivga aylantiradi. */
function csvParam(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/** Orient tokeni → DB enum: web '16:9'/'9:16'/'1:1' YOKI xom qiymat qabul qilinadi. */
function orientValue(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "all") return null;
  if (s === "16:9" || s === "horizontal" || s === "landscape") return "horizontal";
  if (s === "9:16" || s === "vertical" || s === "portrait") return "vertical";
  if (s === "1:1" || s === "square") return "square";
  return null;
}

// 4K sifat qatori: `res` matnida shulardan bittasi bo'lsa 4K deb hisoblanadi
// (klient mapCatalogItems dagi /4k|uhd|2160|4096|8k|4320/ regex bilan bir xil mantiq).
const RES_4K_TOKENS = ["4k", "uhd", "2160", "4096", "8k", "4320"];
function resWhere(v: unknown): Prisma.ContributorTemplateWhereInput | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "all") return null;
  const is4k: Prisma.ContributorTemplateWhereInput = {
    OR: RES_4K_TOKENS.map((t) => ({ res: { contains: t, mode: "insensitive" as const } })),
  };
  if (s === "4k") return is4k;
  if (s === "hd" || s === "2k") return { NOT: is4k };
  return null;
}

/** Katalog `where` — approvedCatalogWhere + ixtiyoriy filtrlar (hammasi additive).
 *  Qo'llab-quvvatlanadigan param: app, templateType, cat, pro, orient, res(qual), q. */
function buildCatalogWhere(query: Request["query"]): Prisma.ContributorTemplateWhereInput {
  const and: Prisma.ContributorTemplateWhereInput[] = [];

  // app (single yoki csv) — templateApp. AE plagin `?app=ae` yuboradi.
  const apps = csvParam(query.app);
  if (apps.length === 1) and.push({ templateApp: apps[0] });
  else if (apps.length > 1) and.push({ templateApp: { in: apps } });

  // templateType — keng tur pill (video-templates | motion-graphics | graphics | luts)
  const types = csvParam(query.templateType);
  if (types.length) and.push({ templateType: { in: types } });

  // cat — granular kategoriya. Web `catLabel` ('Lower Thirds') yuboradi, plagin `cat`
  // slug ('lower-thirds') yuboradi → ikkalasiga ham case-insensitive mos kelamiz.
  const cats = csvParam(query.cat);
  if (cats.length)
    and.push({
      OR: cats.flatMap((c) => [
        { cat: { equals: c, mode: "insensitive" as const } },
        { catLabel: { equals: c, mode: "insensitive" as const } },
      ]),
    });

  // pro — isPro (pro=1|pro / free=0)
  if (typeof query.pro === "string" && query.pro !== "" && query.pro.toLowerCase() !== "all") {
    const p = query.pro.toLowerCase();
    and.push({ isPro: p === "1" || p === "pro" || p === "true" });
  }

  // orient — 16:9 / 9:16 / 1:1
  const ori = orientValue(query.orient);
  if (ori) and.push({ orient: ori });

  // res / qual — 4K vs HD
  const rf = resWhere(query.res ?? query.qual);
  if (rf) and.push(rf);

  // q — qidiruv: nom + tavsif + kategoriya yorlig'i + aniq teg (butun baza bo'yicha)
  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { catLabel: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
      ],
    });
  }

  return and.length ? { ...approvedCatalogWhere, AND: and } : approvedCatalogWhere;
}

/** Saralash → cursor-mos orderBy (oxiri id tiebreaker — barqaror kursor). */
function catalogOrderBy(sort: unknown): Prisma.ContributorTemplateOrderByWithRelationInput[] {
  const s = typeof sort === "string" ? sort.trim().toLowerCase() : "";
  if (s === "az") return [{ name: "asc" }, { id: "asc" }];
  if (s === "za") return [{ name: "desc" }, { id: "desc" }];
  if (s === "new")
    return [{ reviewedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }];
  // default / 'mos' / featured — bugungi tartib (updatedAt desc)
  return [{ updatedAt: "desc" }, { id: "desc" }];
}

/** FAZA 5 (A1) — katalog pagination chegaralari. Default 100: bugungi kichik katalog
 *  bitta sahifaga sig'adi (xulq o'zgarmaydi), 5000 ta shablonda esa bitta so'rov
 *  DB/JSON/xotirani portlatmaydi. Klientlar nextCursor bilan sahifalab oladi. */
const CATALOG_DEFAULT_TAKE = 100;
const CATALOG_MAX_TAKE = 200;

function parseTake(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return CATALOG_DEFAULT_TAKE;
  return Math.min(Math.max(Math.floor(n), 1), CATALOG_MAX_TAKE);
}

/** Browse panel — tasdiqlangan shablonlar (server).
 *  FAZA 5 (A1): take+cursor pagination (backward-compatible — param'siz birinchi
 *  sahifa, javobga additive `nextCursor` qo'shiladi; null = oxirgi sahifa). */
// ── P11 — plagin versiya tekshiruvi (OMMAVIY; panel yuklanganda chaqiriladi) ──
// Ikki kanalli yangilanish: (1) model/tool/narx = server-driven (/gen/models, katalog)
// — reliz KERAK EMAS; (2) plagin KODI = shu kanal (PluginRelease → in-panel updater).
function semverParts(v: string): number[] {
  return String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
}
function semverLt(a: string, b: string): boolean {
  const pa = semverParts(a), pb = semverParts(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}
pluginRouter.get("/version", async (req: Request, res: Response) => {
  const current = typeof req.query.current === "string" ? req.query.current : "";
  const latest = await prisma.pluginRelease.findFirst({ orderBy: { publishedAt: "desc" } });
  if (!latest) {
    res.json({ latest: null, updateAvailable: false, mandatory: false });
    return;
  }
  const updateAvailable = !!current && semverLt(current, latest.version);
  // Majburiy: reliz mandatory deb belgilangan YOKI klient minSupportedVersion'dan past
  const mandatory =
    updateAvailable &&
    (latest.mandatory || (!!latest.minSupportedVersion && !!current && semverLt(current, latest.minSupportedVersion)));
  let downloadUrl: string | null = null;
  if (latest.downloadKey && isS3Configured()) {
    try {
      downloadUrl = await getSignedDownloadUrl(latest.downloadKey, 3600, `frameflow-plugin-${latest.version}.zip`);
    } catch {
      downloadUrl = null;
    }
  }
  res.json({
    latest: {
      version: latest.version,
      releaseNotes: latest.releaseNotes || "",
      publishedAt: latest.publishedAt,
      checksum: latest.checksum || null,
    },
    updateAvailable,
    mandatory,
    downloadUrl,
  });
});

pluginRouter.get("/catalog", async (req: Request, res: Response) => {
  const base = apiPublicBase(req);
  const take = parseTake(req.query.take);
  const cursor =
    typeof req.query.cursor === "string" && req.query.cursor ? req.query.cursor : undefined;
  // take+1 — keyingi sahifa borligini bilish uchun; id ikkilamchi tartib kaliti
  // (updatedAt unique emas — cursor barqaror bo'lishi shart).
  // P1 #16 — SLIM select (metaJson yo'q) + karta mapper: har qator uchun sahna
  // storage round-trip'i qilinmaydi, javob order-of-magnitude kichikroq.
  const items = await prisma.contributorTemplate.findMany({
    where: buildCatalogWhere(req.query),
    orderBy: catalogOrderBy(req.query.sort),
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: CATALOG_CARD_SELECT,
  });
  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  const body = {
    items: await Promise.all(page.map((t) => mapCatalogCard(t, base))),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
  // P1 #17 — EDGE KESH: E bo'lagida CDN yoqilgach URL'lar imzosiz va barqaror →
  // javob keshlanishi mumkin. Cache-Control (brauzer 60s, edge 300s) + ETag:
  // ko'p katalog ochilishi bazaga UMUMAN bormaydi. Katalog ommaviy (auth:false,
  // per-user ma'lumot yo'q) → public kesh xavfsiz. Har filtr/sahifa alohida URL =
  // alohida kesh kaliti. If-None-Match mos kelsa 304 (nol body).
  const serialized = JSON.stringify(body);
  const etag = `W/"${crypto.createHash("sha1").update(serialized).digest("base64url")}"`;
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.setHeader("ETag", etag);
  res.setHeader("Vary", "Accept-Encoding");
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  res.type("application/json").send(serialized);
});

/** P1 #16 — DETAL endpoint: bitta shablonning to'liq ma'lumoti (enriched sahnalar +
 *  metaJson). Ro'yxat (SLIM karta) sahnalarni bermaydi — plagin pack ochilganda va
 *  P2 deep-link shundan oladi. OMMAVIY (katalog kabi auth:false). */
pluginRouter.get("/catalog/:id", async (req: Request, res: Response) => {
  const base = apiPublicBase(req);
  const id = String(req.params.id);
  if (!/^[a-z0-9]+$/i.test(id)) {
    res.status(400).json({ error: "Bad id" });
    return;
  }
  const t = await prisma.contributorTemplate.findFirst({
    where: { ...approvedCatalogWhere, id },
    select: CATALOG_SELECT,
  });
  if (!t) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await mapCatalogItem(t, base));
});

/** Browse notice-bar — eng yangi tasdiqlangan shablonlar */
pluginRouter.get("/featured", async (req: Request, res: Response) => {
  const base = apiPublicBase(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 12);
  const items = await prisma.contributorTemplate.findMany({
    where: catalogWhere(req.query.app),
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: CATALOG_SELECT,
  });
  res.json({
    items: await Promise.all(items.map((t) => mapCatalogItem(t, base))),
  });
});

/** Per-scene preview — rasm (PNG/JPG) yoki video (MP4/MOV), Range qo'llab-quvvatlanadi */
pluginRouter.get("/assets/:templateId/scene/:key", async (req: Request, res: Response) => {
  const templateId = String(req.params.templateId);
  const key = String(req.params.key);

  if (isS3Configured()) {
    const candidates = [
      `templates/${templateId}/scenes/${key}`,
      `templates/${templateId}/scenes/${key}.mp4`,
      `templates/${templateId}/scenes/${key}.mov`,
      `templates/${templateId}/scenes/${key}.png`,
      `templates/${templateId}/scenes/${key}.jpg`,
      `templates/${templateId}/scenes/${key}.jpeg`,
      `templates/${templateId}/scenes/${key}.webp`,
    ];
    for (const s3Key of candidates) {
      if (await s3ObjectExists(s3Key)) {
        res.redirect(302, await getPublicOrSignedUrl(s3Key, 3600));
        return;
      }
    }
    // Bulut sozlangan — diskka tushmaymiz (Cloud Run diski ephemeral).
    res.status(404).json({ error: "Scene preview not found" });
    return;
  }

  const filePath = findScenePreview(templateId, key);
  if (!filePath) {
    res.status(404).json({ error: "Scene preview not found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
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

/** Pack/MOGRT yuklab olishdan oldin: published + Free/Pro limit gate.
    Admin nashr etilmagan packni ham (review uchun) yuklay oladi va limitsiz. */
async function guardDownloadable(
  req: Request,
  res: Response,
  templateId: string
): Promise<boolean> {
  if (!/^[a-z0-9]+$/i.test(templateId)) {
    res.status(400).json({ error: "Invalid template ID" });
    return false;
  }
  // Takedown/karantin — HAMMAGA (admin ham) serve bloklanadi (huquqiy/xavfsizlik, fail-closed).
  const legal = await prisma.contributorTemplate.findUnique({
    where: { id: templateId },
    select: { takedownAt: true, packScanStatus: true },
  });
  if (legal?.takedownAt) {
    res.status(451).json({ error: "This template was removed for legal reasons", code: "TAKEDOWN" });
    return false;
  }
  const scanStatus = legal?.packScanStatus;
  if (scanStatus === "malicious" || scanStatus === "quarantined" || scanStatus === "duplicate") {
    res.status(451).json({ error: "This template was blocked by a security check", code: "PACK_QUARANTINED" });
    return false;
  }
  // FAZA 2 (H2/H3) — skan tugamagan/hech chaqirilmagan pack (null|pending) FAIL-CLOSED:
  // skanланмаган (ehtimoliy zararli) packni HECH KIMGA (admin ham) serve qilmaymiz.
  if (legal && (scanStatus == null || scanStatus === "pending")) {
    res.status(409).json({
      error: "This pack has not passed the security check yet — please try again shortly",
      code: "PACK_SCAN_PENDING",
    });
    return false;
  }
  if (req.user?.role === "ADMIN") return true;
  const tpl = await prisma.contributorTemplate.findUnique({
    where: { id: templateId },
    select: { reviewStatus: true, published: true, isPro: true },
  });
  if (
    !tpl ||
    tpl.reviewStatus !== TemplateReviewStatus.APPROVED ||
    !tpl.published
  ) {
    res.status(404).json({ error: "Pack not found or not published" });
    return false;
  }
  // (#2.5) Server-tomon PRO tier gate — baytlar/redirect'dan OLDIN (fail-closed).
  // Per-shablon PRO (isPro=true) + FREE foydalanuvchi → 402 PRO_REQUIRED. ADMIN yuqorida
  // chetlab o'tgan. Bu Free/Pro download SANOQ limitidan ALOHIDA qo'shimcha tier gate'i.
  if (tpl.isPro) {
    const profile = await ensurePluginProfile(req.user!.userId);
    // PRO va STUDIO ikkalasi ham Pro shablonlarni ochadi (faqat FREE bloklanadi).
    if (!isPaidPlan(profile.plan)) {
      res.status(402).json({
        error: "This template requires the Pro plan — upgrade to Pro",
        code: "PRO_REQUIRED",
      });
      return false;
    }
  }
  // Limitni baytlarni berishdan OLDIN ATOMIK majburlaymiz: consumeDownload
  // hisoblagichni shu yerda oshiradi, shu sabab klient ixtiyoriy
  // /usage/download call'ni tashlab ketsa ham limit chetlab o'tilmaydi.
  const gate = await consumeDownload(req.user!.userId);
  if (!gate.ok) {
    res.status(403).json({ error: gate.error, code: gate.code });
    return false;
  }
  return true;
}

/** M2: tanlangan sahnaning yakka .mogrt fayli — butun ZIP'siz yuklab olish */
pluginRouter.get("/assets/:templateId/mogrt/:slug", downloadLimiter, requireAuth, async (req: Request, res: Response) => {
  const templateId = String(req.params.templateId);
  if (!(await guardDownloadable(req, res, templateId))) return;
  // Bosqich 4 #1: yakka MOGRT ham yuklab olish hodisasi (non-blocking).
  // (M7) ADMIN consumeDownload'ni chetlab o'tadi → earning YOZILMAYDI.
  void recordTemplateDownloadEvent({ templateId, userId: req.user!.userId, kind: "download", source: "plugin", earn: req.user!.role !== "ADMIN" });
  const slug = sceneKey(String(req.params.slug));

  if (isS3Configured()) {
    const s3Key = `templates/${templateId}/mogrt/${slug}.mogrt`;
    if (await s3ObjectExists(s3Key)) {
      // MOGRT — pullik/gated asset (pack qatori): DOIM qisqa muddatli signed URL,
      // CDN public URL emas — redirect havolasi ulashib bo'lmasin.
      res.redirect(302, await getSignedDownloadUrl(s3Key, 300));
      return;
    }
    // Bulut sozlangan — diskka tushmaymiz (Cloud Run diski ephemeral).
    res.status(404).json({ error: "MOGRT file not found" });
    return;
  }

  const filePath = findMogrtFile(templateId, slug);
  if (!filePath) {
    res.status(404).json({ error: "MOGRT file not found" });
    return;
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}.mogrt"`);
  res.setHeader("Content-Length", String(fs.statSync(filePath).size));
  fs.createReadStream(filePath).pipe(res);
});

/** Pack yuklab olish — auth + published + Free/Pro limit gate (generic
    route'dan OLDIN ro'yxatdan o'tadi, shu sabab "pack" shu yerga tushadi). */
pluginRouter.get("/assets/:templateId/pack", downloadLimiter, requireAuth, async (req: Request, res: Response) => {
  const templateId = String(req.params.templateId);
  if (!(await guardDownloadable(req, res, templateId))) return;
  // Bosqich 4 #1: REAL yuklab olish hodisasi (non-blocking — fayl berishni to'smaydi).
  // (M7) ADMIN consumeDownload'ni chetlab o'tadi → earning YOZILMAYDI.
  void recordTemplateDownloadEvent({ templateId, userId: req.user!.userId, kind: "download", source: "plugin", earn: req.user!.role !== "ADMIN" });
  await serveTemplateAsset(req, res, templateId, "pack");
});

/** Thumb/preview — ochiq (katalog ko'rinishi uchun, img/video src auth yubora
    olmaydi). Pack bu yerga tushmaydi (yuqorida gate'langan). */
pluginRouter.get("/assets/:templateId/:kind", async (req: Request, res: Response) => {
  const kind = req.params.kind as TemplateAssetKind;
  if (!["thumb", "preview"].includes(kind)) {
    res.status(400).json({ error: "Invalid type" });
    return;
  }
  await serveTemplateAsset(req, res, String(req.params.templateId), kind);
});

function cepPrefsPath() {
  return path.join(
    os.homedir(),
    "Library/Application Support/Adobe/CEP/extensions/com.frameflow/assetflow-data/prefs.json"
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
pluginRouter.get("/validate", requireAuth, async (req: Request, res: Response) => {
  res.json({
    ok: true,
    userId: req.user!.userId,
    email: req.user!.email,
    role: req.user!.role,
  });
});

pluginRouter.post("/token", requireAuth, async (req: Request, res: Response) => {
  const token = await ensurePluginToken(req.user!.userId, false);
  const row = await prisma.pluginToken.findFirst({
    where: { userId: req.user!.userId, token },
  });
  res.json({ token, expiresAt: row?.expiresAt?.toISOString() ?? null });
});

/** Dashboard → AE: prefs.json ga cloud ulanishni yozish (plugin formasiz) */
pluginRouter.post("/apply-ae-prefs", requireAuth, async (req: Request, res: Response) => {
  const apiBaseUrl = (
    (req.body?.apiBaseUrl as string) || getPublicApiUrl(req)
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

pluginRouter.get("/subscription", requireAuth, async (req: Request, res: Response) => {
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

// ── FAZA 2 #17 — Sevimlilar: plagin↔web bitta hisob ostida umumiy ──────────
/** GET /api/plugin/favorites — foydalanuvchining sevimli shablon id'lari. */
pluginRouter.get("/favorites", requireAuth, async (req: Request, res: Response) => {
  const rows = await prisma.userTemplateFavorite.findMany({
    where: { userId: req.user!.userId },
    select: { templateId: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json({ items: rows.map((r) => r.templateId) });
});

/** POST /api/plugin/favorites {templateId, on} — idempotent qo'shish/olib tashlash. */
pluginRouter.post("/favorites", requireAuth, async (req: Request, res: Response) => {
  const templateId = String(req.body?.templateId ?? "").trim();
  const on = Boolean(req.body?.on);
  if (!/^[a-z0-9]+$/i.test(templateId)) {
    res.status(400).json({ error: "Invalid template ID" });
    return;
  }
  if (on) {
    await prisma.userTemplateFavorite.upsert({
      where: { userId_templateId: { userId: req.user!.userId, templateId } },
      create: { userId: req.user!.userId, templateId },
      update: {},
    });
  } else {
    await prisma.userTemplateFavorite.deleteMany({
      where: { userId: req.user!.userId, templateId },
    });
  }
  res.json({ ok: true, on });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // ADMIN hisobida TOTP 2FA yoqilgan bo'lsa majburiy (oddiy USER'ga tegmaydi).
  totpCode: z.string().min(4).max(16).optional(),
});

/** ADMIN + 2FA yoqilgan: plagin login ham TOTP'siz o'tmasin (bypass yopiq).
 *  true = davom etsin; false = javob yozildi. Backup kod bu yerda QABUL
 *  QILINMAYDI (bir martalik kodlar faqat web /2fa/verify orqali sarflanadi). */
async function checkPluginAdminTotp(
  user: { role: string; totpEnabled: boolean; totpSecret: string | null },
  totpCode: string | undefined,
  res: Response
): Promise<boolean> {
  if (user.role !== "ADMIN" || !user.totpEnabled) return true;
  const secret = user.totpSecret ? decryptTotpSecret(user.totpSecret) : null;
  if (
    totpCode &&
    !looksLikeBackupCode(totpCode) &&
    secret &&
    (await verifyTotpCode(totpCode, secret))
  ) {
    return true;
  }
  res.status(401).json({
    error: totpCode
      ? "Incorrect 2FA code"
      : "This admin account requires a 2FA code — add totpCode, or use the web Admin Console",
    code: "TWO_FA_REQUIRED",
  });
  return false;
}

/** AE panel — email/parol → plugin token */
pluginRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { subscription: true },
  });

  if (!user?.passwordHash) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  if (!(await checkPluginAdminTotp(user, parsed.data.totpCode, res))) return;

  const profile = await ensurePluginProfile(user.id);

  if (profile.status === PluginAccountStatus.BLOCKED) {
    res.status(403).json({ error: "Account is blocked — contact an admin" });
    return;
  }

  const token = await ensurePluginToken(user.id, true);

  res.json({
    token,
    user: serializePluginUser(profile),
    apiBaseUrl: getPublicApiUrl(req),
    adminUrl: getAdminUrl(),
  });
});

// ── Google bilan kirish (device-code oqimi) ─────────────────────────────────
// CEP paneli GIS'ni to'g'ridan-to'g'ri ocha olmaydi (embedded webview bloklanadi)
// — shu sabab plagin bir martalik kod oladi, tizim brauzerida device.html
// ochiladi, u yerda Google orqali tasdiqlangach plagin pollik qilib token oladi.

/** 1) Plagin: bir martalik kod so'raydi */
pluginRouter.post("/device/start", loginLimiter, async (_req: Request, res: Response) => {
  await prisma.pluginDeviceCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const code = crypto.randomBytes(4).toString("hex");
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);
  await prisma.pluginDeviceCode.create({ data: { code, expiresAt } });

  res.json({
    code,
    verificationUrl: `${getWebUrl()}/device.html?code=${code}`,
    expiresIn: DEVICE_CODE_TTL_MS / 1000,
  });
});

const deviceConfirmSchema = z.object({
  code: z.string().min(1),
  credential: z.string().min(10),
});

/** 2) Brauzer (device.html): Google ID token'ni koda bog'laydi */
pluginRouter.post("/device/confirm", loginLimiter, async (req: Request, res: Response) => {
  const parsed = deviceConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }

  const row = await prisma.pluginDeviceCode.findUnique({ where: { code: parsed.data.code } });
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  if (row.expiresAt < new Date()) {
    await prisma.pluginDeviceCode.delete({ where: { id: row.id } });
    res.status(410).json({ error: "Code has expired — please try again from the plugin" });
    return;
  }
  if (row.status !== "pending") {
    res.status(409).json({ error: "Code has already been used" });
    return;
  }

  const result = await verifyGoogleIdTokenAndUpsertUser(parsed.data.credential);
  if (!result.ok) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    res.status(result.status).json({ error: result.error, ...(result.code ? { code: result.code } : {}) });
    return;
  }
  const user = result.user;

  // FAZA 3 (E) — plagin device-code oqimi orqali YANGI Google hisob: welcome email.
  if (result.isNew) {
    sendWelcomeEmail(user.email, user.name);
    // PROBLEM 14 — faqat YANGI hisob yaratilganda (returning-login'da emas).
    notifyAdminNewUser({ email: user.email, name: user.name, source: "google-plugin" });
  }

  // ADMIN + 2FA: device-code oqimida TOTP yig'ib bo'lmaydi — bypass ochiq
  // qolmasin, aniq xabar bilan rad etiladi (web Admin Console'dan kirilsin).
  if (user.role === "ADMIN" && user.totpEnabled) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    res.status(401).json({
      error: "This admin account has 2FA enabled — sign in with email + password + code, or use the web Admin Console",
      code: "TWO_FA_REQUIRED",
    });
    return;
  }

  const profile = await ensurePluginProfile(user.id);
  if (profile.status === PluginAccountStatus.BLOCKED) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    res.status(403).json({ error: "Account is blocked — contact an admin" });
    return;
  }

  const pluginToken = await ensurePluginToken(user.id, true);
  await prisma.pluginDeviceCode.update({
    where: { id: row.id },
    data: { status: "confirmed", userId: user.id, pluginToken },
  });

  res.json({ ok: true, email: user.email });
});

const devicePasswordSchema = z.object({
  code: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().min(4).max(16).optional(),
});

/** 2b) Brauzer (device.html): email+parol bilan koda bog'laydi (Google muqobili).
 *  Google GIS mavjud bo'lmagan/bloklangan holatda ham foydalanuvchi kira oladi.
 *  Autentifikatsiya /login bilan bir xil (bcrypt), pul mantig'i o'zgarmaydi. */
pluginRouter.post("/device/confirm-password", loginLimiter, async (req: Request, res: Response) => {
  const parsed = devicePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const row = await prisma.pluginDeviceCode.findUnique({ where: { code: parsed.data.code } });
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  if (row.expiresAt < new Date()) {
    await prisma.pluginDeviceCode.delete({ where: { id: row.id } });
    res.status(410).json({ error: "Code has expired — please try again from the plugin" });
    return;
  }
  if (row.status !== "pending") {
    res.status(409).json({ error: "Code has already been used" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect email or password" });
    return;
  }

  if (!(await checkPluginAdminTotp(user, parsed.data.totpCode, res))) return;

  const profile = await ensurePluginProfile(user.id);
  if (profile.status === PluginAccountStatus.BLOCKED) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    res.status(403).json({ error: "Account is blocked — contact an admin" });
    return;
  }

  const pluginToken = await ensurePluginToken(user.id, true);
  await prisma.pluginDeviceCode.update({
    where: { id: row.id },
    data: { status: "confirmed", userId: user.id, pluginToken },
  });

  res.json({ ok: true, email: user.email });
});

/** 3) Plagin: kod holatini pollik qiladi */
pluginRouter.get("/device/poll", deviceStatusLimiter, async (req: Request, res: Response) => {
  const code = String(req.query.code || "");
  const row = code ? await prisma.pluginDeviceCode.findUnique({ where: { code } }) : null;

  if (!row || row.expiresAt < new Date()) {
    if (row) await prisma.pluginDeviceCode.delete({ where: { id: row.id } });
    res.json({ status: "expired" });
    return;
  }

  if (row.status === "denied") {
    await prisma.pluginDeviceCode.delete({ where: { id: row.id } });
    res.json({ status: "denied" });
    return;
  }

  if (row.status === "confirmed" && row.userId && row.pluginToken) {
    const profile = await ensurePluginProfile(row.userId);
    await prisma.pluginDeviceCode.delete({ where: { id: row.id } });
    res.json({
      status: "confirmed",
      token: row.pluginToken,
      user: serializePluginUser(profile),
      apiBaseUrl: getPublicApiUrl(req),
      adminUrl: getAdminUrl(),
    });
    return;
  }

  res.json({ status: "pending" });
});

/** Joriy foydalanuvchi + tarif + limitlar */
pluginRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const profile = await ensurePluginProfile(req.user!.userId);
  if (profile.status === PluginAccountStatus.BLOCKED) {
    res.status(403).json({ error: "Account is blocked", code: "ACCOUNT_BLOCKED" });
    return;
  }
  res.json({
    user: serializePluginUser(profile),
    apiBaseUrl: getPublicApiUrl(req),
    adminUrl: getAdminUrl(),
  });
});

const heartbeatSchema = z.object({
  deviceLabel: z.string().max(120).optional(),
  aeVersion: z.string().max(60).optional(),
});

pluginRouter.post("/heartbeat", usageLimiter, requireAuth, async (req: Request, res: Response) => {
  const body = heartbeatSchema.safeParse(req.body);
  const profile = await ensurePluginProfile(req.user!.userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    res.status(403).json({ error: "Account is not active" });
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

pluginRouter.patch("/plan", requireAuth, async (req: Request, res: Response) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "plan: free or pro" });
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

/** Per-shablon hisoblagich — contributor dashboard statistikasi uchun.
    Shablon topilmasa (o'chirilgan/noto'g'ri id) jim o'tadi. */
async function bumpTemplateCounter(
  templateId: string | undefined,
  field: "downloadsCount" | "importsCount"
) {
  if (!templateId) return;
  try {
    await prisma.contributorTemplate.update({
      where: { id: templateId },
      data: { [field]: { increment: 1 } },
    });
  } catch {}
}

/** Analitika-only: yuklab olish limiti endi pack route'da (consumeDownload)
    ATOMIK majburlanadi. Bu endpoint faqat per-shablon analitika hisoblagichini
    oshiradi va UI uchun yangilangan profilni qaytaradi (limitni boshqarmaydi). */
pluginRouter.post("/usage/download", usageLimiter, requireAuth, async (req: Request, res: Response) => {
  const parsed = usageSchema.safeParse(req.body);
  const templateId = parsed.success ? parsed.data.templateId : undefined;
  await bumpTemplateCounter(templateId, "downloadsCount");
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});

/** Import gate: plagin AE ga import qilishdan OLDIN chaqiradi (kesh'langan
    qayta-import ham). consumeImport import limitini ATOMIK majburlaydi —
    limit tugasa 403 (LIMIT_REACHED) qaytadi va klient importni bekor qiladi. */
pluginRouter.post("/usage/import", usageLimiter, requireAuth, async (req: Request, res: Response) => {
  const parsed = usageSchema.safeParse(req.body);
  const templateId = parsed.success ? parsed.data.templateId : undefined;
  const result = await consumeImport(req.user!.userId);
  if (!result.ok) {
    res.status(403).json({ error: result.error, code: result.code });
    return;
  }
  await bumpTemplateCounter(templateId, "importsCount");
  // Bosqich 4 #1: REAL import hodisasi (non-blocking).
  void recordTemplateDownloadEvent({ templateId, userId: req.user!.userId, kind: "import", source: "plugin" });
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});
