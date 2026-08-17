import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import fs from "fs";
import { z } from "zod";
import path from "path";
import {
  PluginAccountStatus,
  PluginPlanTier,
  TemplateReviewStatus,
  UserRole,
  Prisma,
  prisma,
} from "@creative-tools/database";
import type { Request, Response } from "express";
import { requireAuth, verifyToken, suspensionMessage } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import {
  isS3Configured,
  isCdnPublicMode,
  getPublicOrSignedUrl,
  getSignedDownloadUrl,
  s3ObjectExists,
} from "../lib/s3.js";
import { resolveAssetKeyCached } from "../lib/asset-state.js";
import { getAdminUrl, getPublicApiUrl, getWebUrl } from "../lib/app-urls.js";
import { verifyGoogleIdTokenAndUpsertUser } from "../lib/google-auth.js";
import { getPluginContentConfig } from "../lib/plugin-content-config.js";
import { sendWelcomeEmail, notifyAdminNewUser } from "../lib/notify.js";
import { decryptTotpSecret, looksLikeBackupCode, verifyTotpCode } from "../lib/twofa.js";
import {
  ensurePluginProfile,
  consumeDownload,
  consumeImport,
  reserveImport,
  finishImportReservation,
  serializePluginUser,
  setPluginPlan,
  isPaidPlan,
} from "../lib/plugin-profile.js";
import {
  approvedCatalogWhere,
  catalogStableOrderBy,
  mapCatalogItem,
  mapCatalogCard,
} from "../lib/catalog-map.js";
import { recordTemplateDownloadEvent, downloadAuditFromReq, hostAppFromReq } from "../lib/download-events.js";
import {
  type TemplateAssetKind,
  findAssetPath,
  findScenePreview,
  findMogrtFile,
  sceneKey,
  sceneFileIsVideo,
} from "../lib/template-files.js";
import { serveTemplateAsset } from "../lib/serve-asset.js";
import { APP_NEUTRAL_TYPES } from "../lib/apps.js";
import {
  computePluginVersionResponse,
  resolveInstallerPlatform,
  selectInstallerRow,
  buildInstallerPayload,
  installerExtension,
  installerFileName,
  isManualDownloadRequest,
  resolveLegacyDownloadUrl,
  normalizePluginHost,
  type InstallerContext,
} from "../lib/plugin-release-contract.js";

export const pluginRouter = Router();

const PLUGIN_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PLUGIN_TOKEN_RENEW_BEFORE_MS = 48 * 60 * 60 * 1000;

type PluginTokenRecord = {
  token: string;
  createdAt: Date;
  expiresAt: Date;
};

type PluginTokenRepository = {
  pluginToken: {
    create: (args: {
      data: { userId: string; token: string; expiresAt: Date };
    }) => Promise<PluginTokenRecord>;
    deleteMany: (args: {
      where: {
        userId: string;
        expiresAt?: { lt: Date };
        token?: string;
      };
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { token: string };
      select: {
        createdAt: true;
        expiresAt: true;
      };
    }) => Promise<PluginTokenRecord | null>;
  };
};

function pluginRepo(db: { pluginToken: unknown } = prisma): PluginTokenRepository {
  return db as PluginTokenRepository;
}

export async function cleanupExpiredPluginTokens(
  userId: string,
  db: { pluginToken: unknown } = prisma,
): Promise<void> {
  await pluginRepo(db).pluginToken.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() },
    },
  });
}

function serializePluginToken(row: { createdAt: Date; expiresAt: Date } | null | undefined) {
  if (!row) return null;
  return {
    issuedAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    refreshAt: new Date(row.expiresAt.getTime() - PLUGIN_TOKEN_RENEW_BEFORE_MS).toISOString(),
  };
}

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

/** (#32) Kod yaratish — arzon, lekin cheksiz kod hosil qilish (fishing zaxirasi) to'siladi. */
const deviceStartLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyPrefix: "plugin-device-start",
  message: "Too many attempts — please try again in 1 minute",
});

/** FAZA 2 (H1/H5) — pack/mogrt yuklab olish throttle: skriptli earning-farming va
 *  S3 xarajat portlashini to'sadi (normal foydalanish uchun keng — 60/daqiqa/IP). */
const downloadLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "plugin-download",
  message: "Too many downloads — please slow down and try again shortly",
});

/** Google device sign-in: qisqa yashovchi, bir martalik browser request.
 *  URL'da plugin access/refresh token YO'Q. Browser `requestId + state` oladi,
 *  CEP esa alohida `pollToken` oladi — browser history tokenni o'g'irlay olmaydi. */
const DEVICE_CODE_TTL_MS = 5 * 60 * 1000;
const DEVICE_AUTH_SECRET =
  process.env.DEVICE_AUTH_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-change-me";

function generateDeviceCode(): string {
  return crypto.randomBytes(24).toString("hex"); // 192-bit nonce
}

function normalizeDeviceCode(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
}

function deviceProof(kind: "browser" | "poll", requestId: string): string {
  return crypto
    .createHmac("sha256", DEVICE_AUTH_SECRET)
    .update(`${kind}:${requestId}`)
    .digest("hex");
}

function validDeviceProof(kind: "browser" | "poll", requestId: string, proof: unknown): boolean {
  const expected = deviceProof(kind, requestId);
  const supplied = String(proof ?? "");
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function validBrowserDeviceRequest(requestId: string, state: unknown): boolean {
  if (!/^[0-9a-f]{48}$/.test(requestId)) return false;
  // Oddiy oqim signed state bilan keladi. "Having trouble?" ichidagi qo'lda
  // kiritish 192-bit bir martalik requestId'ning o'ziga tayanadi.
  return state == null || state === "" || validDeviceProof("browser", requestId, state);
}

export function validDevicePollRequest(requestId: string, pollToken: unknown): boolean {
  return /^[0-9a-f]{48}$/.test(requestId) && validDeviceProof("poll", requestId, pollToken);
}

export function createDeviceAuthChallenge(webUrl = getWebUrl()) {
  const requestId = generateDeviceCode();
  const state = deviceProof("browser", requestId);
  const pollToken = deviceProof("poll", requestId);
  const verificationUrl = `${webUrl.replace(/\/$/, "")}/device.html`;
  return {
    requestId,
    state,
    pollToken,
    verificationUrl,
    // CEP -> tizim brauzeri ko'prigi ayrim Adobe hostlarida URL fragmentini
    // tashlab yuboradi. Query bir martalik, 192-bit requestId + HMAC state'ni
    // ishonchli yetkazadi; plugin access/poll tokenlari URL'ga kirmaydi.
    verificationUrlComplete: `${verificationUrl}?request=${encodeURIComponent(requestId)}&state=${encodeURIComponent(state)}`,
  };
}

export function isDeviceRequestExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt <= now;
}

export function deviceRequestCanIssueCredentials(
  status: string,
  expiresAt: Date,
  now = new Date(),
): boolean {
  return status === "confirmed" && !isDeviceRequestExpired(expiresAt, now);
}

function apiPublicBase(req: { protocol: string; get: (h: string) => string | undefined }) {
  return getPublicApiUrl(req);
}

// P2 (step 31) — public.ts (og-preview/deep-link endpoint) ham shu SELECT'ni ishlatadi (drift yo'q).
export const CATALOG_SELECT = {
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
  packHash: true,
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
  // AND ichida — `appPredicate` OR qaytaradi, uni yoyib yuborsak boshqa OR'ni bosib ketardi.
  return { ...approvedCatalogWhere, AND: [appPredicate([code])] };
}

/** `?app=` predikati: SHU dastur YOKI dasturdan mustaqil kontent.
 *  Bo'sh ro'yxat = filtr yo'q. Batafsil sabab: lib/apps.ts `APP_NEUTRAL_TYPES`. */
function appPredicate(apps: string[]): Prisma.ContributorTemplateWhereInput {
  if (!apps.length) return {};
  const own: Prisma.ContributorTemplateWhereInput =
    apps.length === 1 ? { templateApp: apps[0] } : { templateApp: { in: apps } };
  return {
    OR: [
      own,
      // Stock — host loyiha formati emas, xom media (.mp4/.mov/.png/.jpg/
      // .wav/.mp3). Shu bois graphics va motion-graphics ham AE+PR'da bir xil
      // import qilinadi. Ilgari faqat music/sfx o'tar, Premiere katalogi real
      // rasm/video stocklarni sun'iy ravishda yashirardi.
      { kind: "stock" },
      { templateType: { in: [...APP_NEUTRAL_TYPES] } },
      // Eski AI-stock ingest audio turini `templateType=ai-stock`, haqiqiy
      // turini esa `stockType=music|sfx` qilib saqlagan. Faqat templateType'ni
      // tekshirish Premiere katalogidan real musiqa/SFX'ni yashirib qo'yardi.
      { stockType: { in: ["music", "sfx"] } },
    ],
  };
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

// Sifat guruhlari. Web 'HD'/'4K' (2 chelak); plagin '2k'/'4k'/'5k' (3 chelak) yuboradi.
// '4k' = web mapCatalogItems dagi /4k|uhd|2160|4096|8k|4320/ regex bilan bir xil (8K ham
// 4K deb sanaladi — web yorlig'iga mos). '5k' = plagin "5K+" (8K'ni ham qamraydi).
const RES_4K_TOKENS = ["4k", "uhd", "2160", "4096", "8k", "4320"];
const RES_GROUPS: Record<string, string[]> = {
  "4k": RES_4K_TOKENS,
  "5k": ["5k", "6k", "7k", "8k", "4320"],
  "2k": ["2k", "1440", "qhd"],
};
function resContains(tokens: string[]): Prisma.ContributorTemplateWhereInput {
  return { OR: tokens.map((t) => ({ res: { contains: t, mode: "insensitive" as const } })) };
}
function resWhere(v: unknown): Prisma.ContributorTemplateWhereInput | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "all") return null;
  if (s === "hd") return { NOT: resContains(RES_4K_TOKENS) }; // web 'HD' = 4K emas
  if (RES_GROUPS[s]) return resContains(RES_GROUPS[s]);
  return { res: { contains: s, mode: "insensitive" } }; // boshqa aniq token (masalan 1080)
}

/** Katalog `where` — approvedCatalogWhere + ixtiyoriy filtrlar (hammasi additive).
 *  Qo'llab-quvvatlanadigan param: app, templateType, cat, pro, orient, res(qual), q. */
function buildCatalogWhere(query: Request["query"]): Prisma.ContributorTemplateWhereInput {
  const and: Prisma.ContributorTemplateWhereInput[] = [];

  // app (single yoki csv) — templateApp + dasturdan mustaqil turlar.
  // AE plagin `?app=ae`, Premiere UXP paneli `?app=pr` yuboradi.
  const apps = csvParam(query.app);
  if (apps.length) and.push(appPredicate(apps));

  // templateType — BIRLASHGAN pill kaliti (video-templates | luts | graphics |
  // motion-graphics | music | sfx). Har asset O'Z pillida (P1 step 30/32).
  const types = csvParam(query.templateType);
  if (types.length) {
    // Eski AI-stock ingest `templateType=ai-stock`, haqiqiy pill'ni esa
    // `stockType`da saqlagan. Katalog kontrakti tarixiy DB shakliga bog'lanmasin.
    const stockAliases = types.filter((t) => ["graphics", "motion-graphics", "music", "sfx"].includes(t));
    and.push(stockAliases.length
      ? { OR: [{ templateType: { in: types } }, { stockType: { in: stockAliases } }] }
      : { templateType: { in: types } });
  }

  // kind — 'template' | 'stock' (ixtiyoriy — masalan barcha stockni ko'rsatish).
  const kinds = csvParam(query.kind);
  if (kinds.length) and.push({ kind: { in: kinds } });

  // stockType — graphics | motion-graphics | music | sfx (stock sub-turi).
  const stockTypes = csvParam(query.stockType);
  if (stockTypes.length) and.push({ stockType: { in: stockTypes } });

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
  if (s === "new") return [...catalogStableOrderBy];
  // #53 — default / 'mos' / featured: nashr vaqti bo'yicha BARQAROR tartib.
  // (Ilgari `updatedAt desc` edi — har yuklab olish uni ko'tarib paginatsiyani buzardi.)
  return [...catalogStableOrderBy];
}

/** FAZA 5 (A1) — katalog pagination chegaralari. Default 100: bugungi kichik katalog
 *  bitta sahifaga sig'adi (xulq o'zgarmaydi), 5000 ta shablonda esa bitta so'rov
 *  DB/JSON/xotirani portlatmaydi. Klientlar nextCursor bilan sahifalab oladi. */
const CATALOG_DEFAULT_TAKE = 100;
const CATALOG_MAX_TAKE = 200;

/** #55 — imzolangan rejimda ETag "vaqt paqiri" (soniya). Katalog display URL TTL'i
 *  24 soat (catalog-map DISPLAY_URL_TTL) — 6 soatlik paqir 304 bilan qaytariladigan
 *  eng eski javobda ham imzoga kamida 18 soat qoldiradi. */
const CATALOG_SIGNED_ETAG_BUCKET_SEC = 6 * 3600;

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
// — reliz KERAK EMAS; (2) plagin KODI = shu kanal (PluginRelease → in-panel bildirishnoma).
//
// Task 2: javob SO'RALGAN (yoki UA'dan aniqlangan) BITTA allowlist platformasining
// installerini qaytaradi — boshqa platformalar va storage kalitlari ochilmaydi.
// Artefakt yo'q bo'lsa — halol `installerStatus` (jim qolish yo'q).
// Hisob-kitob lib/plugin-release-contract.ts'da (izolyatsiya — scripts/test-plugin-release-contract.mjs).
const INSTALLER_URL_TTL_SEC = 3600;

pluginRouter.get("/version", async (req: Request, res: Response) => {
  const current = typeof req.query.current === "string" ? req.query.current : "";
  const { platform } = resolveInstallerPlatform(req.query.platform, req.headers["user-agent"]);
  // Host kanali: `?app=pr` — Premiere UXP paneli. Param yo'q/noma'lum bo'lsa `ae`
  // (host yubormaydigan mavjud AE paneli bugungidek AE relizlarini oladi).
  const host = normalizePluginHost(req.query.app);
  const latest = await prisma.pluginRelease.findFirst({
    where: { host },
    orderBy: { publishedAt: "desc" },
    include: { installers: true },
  });
  // LEGACY .zxp — FAQAT aniq `manual=1` opt-in bilan (veb sahifadagi qo'lda yuklab olish).
  // Opt-in bo'lmasa havola umuman imzolanmaydi va javobda null bo'ladi: ff10d51'gacha
  // bo'lgan panel `downloadUrl`ni ko'rsa o'z extension papkasi ustiga yozardi — bu kanal
  // shu bilan o'chirilgan (kill switch). Yangi panel bu maydonni ishlatmaydi.
  const manualDownload = isManualDownloadRequest(req.query.manual);
  let downloadUrl: string | null = null;
  if (manualDownload && latest && latest.downloadKey && isS3Configured()) {
    try {
      downloadUrl = await getSignedDownloadUrl(latest.downloadKey, INSTALLER_URL_TTL_SEC, `frameflow-plugin-${latest.version}.zxp`);
    } catch {
      downloadUrl = null;
    }
  }
  // Platformaga xos installer (fail-closed: har bosqichda aniq status).
  let installerCtx: InstallerContext = { platform, installer: null, status: "not_published" };
  if (!platform) {
    installerCtx = { platform: null, installer: null, status: "unsupported_platform" };
  } else if (latest) {
    const row = selectInstallerRow(latest.installers, platform, host);
    if (!row) {
      installerCtx = { platform, installer: null, status: "not_published" };
    } else if (!isS3Configured()) {
      installerCtx = { platform, installer: null, status: "storage_unavailable" };
    } else {
      let payload = null;
      try {
        const ext = installerExtension(row.storageKey) || "bin";
        const url = await getSignedDownloadUrl(
          row.storageKey,
          INSTALLER_URL_TTL_SEC,
          installerFileName(latest.version, platform, ext, host)
        );
        payload = buildInstallerPayload(latest.version, row, url, host);
      } catch {
        payload = null;
      }
      installerCtx = payload
        ? { platform, installer: payload, status: "ok" }
        : { platform, installer: null, status: "storage_unavailable" };
    }
  }
  res.json(
    computePluginVersionResponse(
      current,
      latest,
      resolveLegacyDownloadUrl(req.query.manual, downloadUrl),
      installerCtx
    )
  );
});

// ── Plugin CMS — ommaviy o'qish (auth YO'Q: guest ekran login'dan OLDIN kerak).
// Yozish yo'llari admin routerda (/api/admin/plugin-content-config).
// GET /api/landing/config bilan bir xil uslub: merged config + qisqa kesh.
pluginRouter.get("/content-config", async (_req: Request, res: Response) => {
  const { config, updatedAt } = await getPluginContentConfig();
  res.set("Cache-Control", "public, max-age=60");
  res.json({ config, updatedAt });
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
  //
  // #55 (T3.4) — CDN YO'Q bo'lsa (CDN_BASE_URL o'rnatilmagan) URL'lar IMZOLANGAN:
  //  (a) `s-maxage` bilan umumiy keshga qo'yish mumkin emas — bir mijozning imzosi
  //      boshqasiga tarqaladi va imzo muddati tugagach butun sahifa buziladi →
  //      `private` (faqat brauzer keshi).
  //  (b) imzo query'si HAR javobda o'zgargani uchun ETag ham har safar boshqacha
  //      bo'lardi → 304 hech qachon ishlamasdi. ETag'ni imzo query'sisiz kontentdan
  //      hisoblaymiz; imzo eskirib qolmasligi uchun TTL'ning choragi bo'yicha
  //      "vaqt paqiri" qo'shamiz (paqir almashsa yangi imzolar bilan to'liq javob).
  const serialized = JSON.stringify(body);
  const signedMode = !isCdnPublicMode();
  const etagSource = signedMode
    ? `${serialized.replace(/\?X-Amz-[^"]*/g, "")}|${Math.floor(Date.now() / (CATALOG_SIGNED_ETAG_BUCKET_SEC * 1000))}`
    : serialized;
  const etag = `W/"${crypto.createHash("sha1").update(etagSource).digest("base64url")}"`;
  res.setHeader(
    "Cache-Control",
    signedMode ? "private, max-age=60" : "public, max-age=60, s-maxage=300"
  );
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
    orderBy: catalogStableOrderBy, // #53 — nashr vaqti (hisoblagichdan mustaqil)
    take: limit,
    select: CATALOG_SELECT,
  });
  res.json({
    items: await Promise.all(items.map((t) => mapCatalogItem(t, base))),
  });
});

/** #107 (SEC6) — sahna preview'ini so'ragan odam uni ko'rishga haqlimi.
 *  NASHR ETILGAN + tasdiqlangan shablon → hamma uchun ochiq (<img>/<video> header
 *  yubora olmaydi). Aks holda faqat ADMIN yoki shablon muallifi (Bearer token). */
async function sceneViewerAllowed(req: Request, templateId: string): Promise<boolean> {
  const t = await prisma.contributorTemplate.findUnique({
    where: { id: templateId },
    select: { published: true, reviewStatus: true, contributorId: true },
  });
  if (!t) return false;
  if (t.published && t.reviewStatus === TemplateReviewStatus.APPROVED) return true;
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return false;
  const viewer = await resolveBearerViewer(token);
  if (!viewer) return false;
  return viewer.role === UserRole.ADMIN || viewer.userId === t.contributorId;
}

/** Bearer (plugin token yoki JWT) → {userId, role}; yaroqsiz bo'lsa null. */
async function resolveBearerViewer(
  token: string
): Promise<{ userId: string; role: UserRole } | null> {
  const pluginToken = await prisma.pluginToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, role: true } } },
  });
  if (pluginToken && pluginToken.expiresAt > new Date()) {
    return { userId: pluginToken.user.id, role: pluginToken.user.role };
  }
  const payload = verifyToken(token);
  return payload ? { userId: payload.userId, role: payload.role } : null;
}

/** Sahna faylining S3 kaliti → ko'rsatish URL'i (topilmasa null). */
async function resolveSceneDisplayUrl(templateId: string, key: string): Promise<string | null> {
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
    if (await s3ObjectExists(s3Key)) return await getPublicOrSignedUrl(s3Key, 3600);
  }
  return null;
}

/** #107 — moderatsiya (nashr etilmagan shablon) uchun: <video>/<img> Authorization
 *  yubora olmaydi, shuning uchun admin/muallif avval SHU JSON endpointdan imzolangan
 *  URL oladi va uni to'g'ridan `src` qiladi. */
pluginRouter.get(
  "/assets/:templateId/scene/:key/url",
  requireAuth,
  async (req: Request, res: Response) => {
    const templateId = String(req.params.templateId);
    const key = sceneKey(String(req.params.key));
    if (!/^[a-z0-9_-]+$/i.test(templateId) || !(await sceneViewerAllowed(req, templateId))) {
      res.status(404).json({ error: "Scene preview not found" });
      return;
    }
    const url = isS3Configured() ? await resolveSceneDisplayUrl(templateId, key) : null;
    if (!url) {
      res.status(404).json({ error: "Scene preview not found" });
      return;
    }
    res.json({ url });
  }
);

/** Per-scene preview — rasm (PNG/JPG) yoki video (MP4/MOV), Range qo'llab-quvvatlanadi */
pluginRouter.get("/assets/:templateId/scene/:key", async (req: Request, res: Response) => {
  const templateId = String(req.params.templateId);
  // #107: xom kalit ishlatilmaydi — URL'lar ham sceneKey() bilan yasaladi (idempotent).
  const key = sceneKey(String(req.params.key));

  if (!/^[a-z0-9_-]+$/i.test(templateId) || !(await sceneViewerAllowed(req, templateId))) {
    res.status(404).json({ error: "Scene preview not found" });
    return;
  }

  if (isS3Configured()) {
    const url = await resolveSceneDisplayUrl(templateId, key);
    if (url) {
      res.redirect(302, url);
      return;
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
  templateId: string,
  /**
   * (#44) Asset REAL mavjudmi — kvota yoqilishidan OLDIN tekshiriladi. Fayl
   * yo'q bo'lsa 404 qaytadi va Free foydalanuvchining oylik yuklab olishidan
   * biri bekorga yonmaydi (klient retry bilan 2× yonardi).
   */
  assetExists?: () => Promise<boolean>
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
  // (#44) Kvotani yoqishdan OLDIN fayl bor-yo'qligini tekshiramiz — yo'q asset
  // uchun 404 qaytadi, hisoblagich TEGILMAYDI. Tekshiruvning o'zi yiqilsa
  // (tarmoq/S3 xatosi) yuklab olishni bloklamaymiz — pastdagi serve 404 beradi.
  if (assetExists) {
    let exists = true;
    try {
      exists = await assetExists();
    } catch (e) {
      console.error("[download] asset existence check failed", templateId, e);
    }
    if (!exists) {
      res.status(404).json({ error: "File not found" });
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
  const slug = sceneKey(String(req.params.slug));
  // (#44) kvota yonishidan oldin fayl bor-yo'qligi tekshiriladi.
  const mogrtExists = async () =>
    isS3Configured()
      ? await s3ObjectExists(`templates/${templateId}/mogrt/${slug}.mogrt`)
      : Boolean(findMogrtFile(templateId, slug));
  if (!(await guardDownloadable(req, res, templateId, mogrtExists))) return;
  // Bosqich 4 #1: yakka MOGRT ham yuklab olish hodisasi (#14: await — Cloud Run javobdan keyin CPU'ni throttle qiladi).
  // (M7) ADMIN consumeDownload'ni chetlab o'tadi → earning YOZILMAYDI.
  await recordTemplateDownloadEvent({ templateId, userId: req.user!.userId, kind: "download", source: "plugin", earn: req.user!.role !== "ADMIN", audit: downloadAuditFromReq(req), app: hostAppFromReq(req) });

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
  // (#44) pack REAL mavjudmi — kvota yoqilishidan oldin (S3 kaliti yoki lokal fayl).
  const packExists = async () =>
    isS3Configured()
      ? Boolean(await resolveAssetKeyCached(templateId, "pack"))
      : Boolean(findAssetPath(templateId, "pack"));
  if (!(await guardDownloadable(req, res, templateId, packExists))) return;
  // Bosqich 4 #1: REAL yuklab olish hodisasi (#14: await — fire-and-forget Cloud Run'da yo'qoladi).
  // (M7) ADMIN consumeDownload'ni chetlab o'tadi → earning YOZILMAYDI.
  await recordTemplateDownloadEvent({ templateId, userId: req.user!.userId, kind: "download", source: "plugin", earn: req.user!.role !== "ADMIN", audit: downloadAuditFromReq(req), app: hostAppFromReq(req) });
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
  const templateId = String(req.params.templateId);
  const template = await prisma.contributorTemplate.findUnique({
    where: { id: templateId },
    select: { reviewStatus: true, published: true, takedownAt: true },
  });
  if (template?.takedownAt) {
    res.status(451).json({ error: "This media was removed for legal reasons", code: "TAKEDOWN" });
    return;
  }
  if (!template || template.reviewStatus !== TemplateReviewStatus.APPROVED || !template.published) {
    res.status(404).json({ error: "Media not found or not published" });
    return;
  }
  await serveTemplateAsset(req, res, templateId, kind);
});

export async function ensurePluginToken(
  userId: string,
  reuseExisting = false,
  db: { pluginToken: unknown } = prisma,
) {
  if (reuseExisting) void reuseExisting;
  await cleanupExpiredPluginTokens(userId, db);
  const pluginDb = pluginRepo(db);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + PLUGIN_TOKEN_TTL_MS);
  return pluginDb.pluginToken.create({ data: { userId, token, expiresAt } });
}

export async function revokePluginToken(
  userId: string,
  token: string,
  db: { pluginToken: unknown } = prisma,
) {
  if (!token) return false;
  await pluginRepo(db).pluginToken.deleteMany({
    where: {
      userId,
      token,
    },
  });
  return true;
}

/** CEP panel token tekshiruvi */
pluginRouter.get("/validate", requireAuth, async (req: Request, res: Response) => {
  const pluginToken = req.pluginToken
    ? {
        token: req.pluginToken.token,
        ...serializePluginToken(req.pluginToken),
      }
    : null;
  res.json({
    ok: true,
    userId: req.user!.userId,
    email: req.user!.email,
    role: req.user!.role,
    pluginToken,
  });
});

pluginRouter.post("/token", requireAuth, async (req: Request, res: Response) => {
  const tokenRow = await ensurePluginToken(req.user!.userId, false);
  res.json({
    token: tokenRow.token,
    pluginToken: serializePluginToken(tokenRow),
  });
});

/** Dashboard → AE: prefs.json ga cloud ulanishni yozish (plugin formasiz) */
pluginRouter.post("/apply-ae-prefs", requireAuth, async (req: Request, res: Response) => {
  const apiBaseUrl =
    ((req.body?.apiBaseUrl as string) || getPublicApiUrl(req)).replace(/\/$/, "");

  const incoming = (req.body?.token as string | undefined)?.trim();
  const tokenPreview = (incoming ? incoming : "").slice(0, 8);

  res.json({
    ok: true,
    legacyDisabled: true,
    apiBaseUrl,
    tokenPreview: tokenPreview ? `${tokenPreview}…` : "",
  });
});

pluginRouter.post("/logout", requireAuth, async (req: Request, res: Response) => {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  await revokePluginToken(req.user!.userId, token);

  res.json({ ok: true });
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

  // #95 (A7) — umumiy to'xtatish plaginda ham amal qiladi.
  const suspended = suspensionMessage(user);
  if (suspended) {
    res.status(403).json({ error: suspended, code: "ACCOUNT_SUSPENDED" });
    return;
  }

  const profile = await ensurePluginProfile(user.id);

  if (profile.status !== PluginAccountStatus.ACTIVE) {
    const blocked = profile.status === PluginAccountStatus.BLOCKED;
    res.status(403).json({
      error: blocked ? "Account is blocked — contact an admin" : "Account is not active",
      code: blocked ? "ACCOUNT_BLOCKED" : "ACCOUNT_INACTIVE",
    });
    return;
  }

  const tokenRow = await ensurePluginToken(user.id, false);

  res.json({
    token: tokenRow.token,
    pluginToken: serializePluginToken(tokenRow),
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
pluginRouter.post("/device/start", deviceStartLimiter, async (_req: Request, res: Response) => {
  await prisma.pluginDeviceCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const challenge = createDeviceAuthChallenge();
  const { requestId, pollToken, verificationUrl, verificationUrlComplete } = challenge;
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);
  await prisma.pluginDeviceCode.create({ data: { code: requestId, expiresAt } });

  res.json({
    requestId,
    pollToken,
    verificationUrl,
    verificationUrlComplete,
    // Eski klient nomi — yangi klientlar requestId ishlatadi.
    code: requestId,
    expiresIn: DEVICE_CODE_TTL_MS / 1000,
  });
});

const deviceConfirmSchema = z.object({
  requestId: z.string().min(32).optional(),
  code: z.string().min(32).optional(),
  state: z.string().length(64).optional(),
  credential: z.string().min(10),
}).refine((value) => Boolean(value.requestId || value.code));

function deviceRequestFromBody(body: { requestId?: string; code?: string }): string {
  return normalizeDeviceCode(body.requestId || body.code);
}

export async function claimDeviceLogin(
  rowId: string,
  userId: string,
  pluginToken: string,
  db: { pluginDeviceCode: { updateMany: (args: any) => Promise<{ count: number }> } } = prisma,
): Promise<boolean> {
  const claimed = await db.pluginDeviceCode.updateMany({
    where: { id: rowId, status: "pending", expiresAt: { gt: new Date() } },
    data: { status: "confirmed", userId, pluginToken },
  });
  return claimed.count === 1;
}

/** 2) Brauzer (device.html): Google ID token'ni koda bog'laydi */
pluginRouter.post("/device/confirm", loginLimiter, async (req: Request, res: Response) => {
  const parsed = deviceConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data" });
    return;
  }

  const requestId = deviceRequestFromBody(parsed.data);
  if (!validBrowserDeviceRequest(requestId, parsed.data.state)) {
    res.status(400).json({ error: "This sign-in link is invalid — start again from the plugin" });
    return;
  }
  const row = await prisma.pluginDeviceCode.findUnique({ where: { code: requestId } });
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  if (isDeviceRequestExpired(row.expiresAt)) {
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

  // #95 (A7) — to'xtatilgan hisob device-code oqimida ham rad etiladi.
  const suspended = suspensionMessage(user);
  if (suspended) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    res.status(403).json({ error: suspended, code: "ACCOUNT_SUSPENDED" });
    return;
  }

  const profile = await ensurePluginProfile(user.id);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    const blocked = profile.status === PluginAccountStatus.BLOCKED;
    res.status(403).json({
      error: blocked ? "Account is blocked — contact an admin" : "Account is not active",
      code: blocked ? "ACCOUNT_BLOCKED" : "ACCOUNT_INACTIVE",
    });
    return;
  }

  const pluginToken = await ensurePluginToken(user.id, false);
  if (!(await claimDeviceLogin(row.id, user.id, pluginToken.token))) {
    await revokePluginToken(user.id, pluginToken.token);
    res.status(409).json({ error: "This sign-in request has already been completed" });
    return;
  }

  res.json({ ok: true, email: user.email });
});

const devicePasswordSchema = z.object({
  requestId: z.string().min(32).optional(),
  code: z.string().min(32).optional(),
  state: z.string().length(64).optional(),
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().min(4).max(16).optional(),
}).refine((value) => Boolean(value.requestId || value.code));

/** 2b) Brauzer (device.html): email+parol bilan koda bog'laydi (Google muqobili).
 *  Google GIS mavjud bo'lmagan/bloklangan holatda ham foydalanuvchi kira oladi.
 *  Autentifikatsiya /login bilan bir xil (bcrypt), pul mantig'i o'zgarmaydi. */
pluginRouter.post("/device/confirm-password", loginLimiter, async (req: Request, res: Response) => {
  const parsed = devicePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const requestId = deviceRequestFromBody(parsed.data);
  if (!validBrowserDeviceRequest(requestId, parsed.data.state)) {
    res.status(400).json({ error: "This sign-in link is invalid — start again from the plugin" });
    return;
  }
  const row = await prisma.pluginDeviceCode.findUnique({ where: { code: requestId } });
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  if (isDeviceRequestExpired(row.expiresAt)) {
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

  // #95 (A7) — to'xtatilgan hisob device-code oqimida ham rad etiladi.
  const suspended = suspensionMessage(user);
  if (suspended) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    res.status(403).json({ error: suspended, code: "ACCOUNT_SUSPENDED" });
    return;
  }

  const profile = await ensurePluginProfile(user.id);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    await prisma.pluginDeviceCode.update({ where: { id: row.id }, data: { status: "denied" } });
    const blocked = profile.status === PluginAccountStatus.BLOCKED;
    res.status(403).json({
      error: blocked ? "Account is blocked — contact an admin" : "Account is not active",
      code: blocked ? "ACCOUNT_BLOCKED" : "ACCOUNT_INACTIVE",
    });
    return;
  }

  const pluginToken = await ensurePluginToken(user.id, false);
  if (!(await claimDeviceLogin(row.id, user.id, pluginToken.token))) {
    await revokePluginToken(user.id, pluginToken.token);
    res.status(409).json({ error: "This sign-in request has already been completed" });
    return;
  }

  res.json({ ok: true, email: user.email });
});

const deviceSessionSchema = z.object({
  requestId: z.string().min(32),
  state: z.string().length(64).optional(),
});

/** Brauzerda FrameFlow sessiyasi allaqachon bo'lsa, Google oynasisiz shu hisobni tasdiqlaydi. */
pluginRouter.post("/device/confirm-session", loginLimiter, requireAuth, async (req: Request, res: Response) => {
  const parsed = deviceSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sign-in request" });
    return;
  }
  if (req.pluginToken) {
    res.status(403).json({ error: "A web account session is required", code: "WEB_SESSION_REQUIRED" });
    return;
  }
  const requestId = normalizeDeviceCode(parsed.data.requestId);
  if (!validBrowserDeviceRequest(requestId, parsed.data.state)) {
    res.status(400).json({ error: "This sign-in link is invalid — start again from the plugin" });
    return;
  }
  const row = await prisma.pluginDeviceCode.findUnique({ where: { code: requestId } });
  if (!row || isDeviceRequestExpired(row.expiresAt)) {
    if (row) await prisma.pluginDeviceCode.deleteMany({ where: { id: row.id } });
    res.status(410).json({ error: "Sign-in request expired — start again from the plugin" });
    return;
  }
  if (row.status !== "pending") {
    res.status(409).json({ error: "This sign-in request has already been used" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(401).json({ error: "Session expired", code: "TOKEN_INVALID" });
    return;
  }
  if (user.role === "ADMIN" && user.totpEnabled) {
    res.status(401).json({ error: "This admin account requires email sign-in with its 2FA code", code: "TWO_FA_REQUIRED" });
    return;
  }
  const suspended = suspensionMessage(user);
  if (suspended) {
    res.status(403).json({ error: suspended, code: "ACCOUNT_SUSPENDED" });
    return;
  }
  const profile = await ensurePluginProfile(user.id);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    const blocked = profile.status === PluginAccountStatus.BLOCKED;
    res.status(403).json({
      error: blocked ? "Account is blocked — contact an admin" : "Account is not active",
      code: blocked ? "ACCOUNT_BLOCKED" : "ACCOUNT_INACTIVE",
    });
    return;
  }
  const pluginToken = await ensurePluginToken(user.id, false);
  if (!(await claimDeviceLogin(row.id, user.id, pluginToken.token))) {
    await revokePluginToken(user.id, pluginToken.token);
    res.status(409).json({ error: "This sign-in request has already been completed" });
    return;
  }
  res.json({ ok: true, email: user.email });
});

const devicePollSchema = z.object({
  requestId: z.string().min(32),
  pollToken: z.string().length(64),
});

/** 3) Plagin: holatni URL loglariga sir chiqarmasdan POST bilan poll qiladi. */
pluginRouter.post("/device/poll", deviceStatusLimiter, async (req: Request, res: Response) => {
  const parsed = devicePollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sign-in request" });
    return;
  }
  const requestId = normalizeDeviceCode(parsed.data.requestId);
  if (!validDevicePollRequest(requestId, parsed.data.pollToken)) {
    res.status(403).json({ error: "Invalid sign-in request" });
    return;
  }
  const row = await prisma.pluginDeviceCode.findUnique({ where: { code: requestId } });

  if (!row || isDeviceRequestExpired(row.expiresAt)) {
    if (row) await prisma.pluginDeviceCode.deleteMany({ where: { id: row.id } });
    res.json({ status: "expired" });
    return;
  }

  if (row.status === "denied") {
    await prisma.pluginDeviceCode.deleteMany({ where: { id: row.id } });
    res.json({ status: "denied" });
    return;
  }

  if (deviceRequestCanIssueCredentials(row.status, row.expiresAt) && row.userId && row.pluginToken) {
    const claimed = await prisma.pluginDeviceCode.deleteMany({
      where: { id: row.id, status: "confirmed", pluginToken: row.pluginToken },
    });
    if (claimed.count !== 1) {
      res.json({ status: "expired" });
      return;
    }
    const profile = await ensurePluginProfile(row.userId);
    const tokenRow = await prisma.pluginToken.findUnique({
      where: { token: row.pluginToken },
      select: { createdAt: true, expiresAt: true },
    });
    res.json({
      status: "confirmed",
      token: row.pluginToken,
      pluginToken: tokenRow ? serializePluginToken(tokenRow) : null,
      user: serializePluginUser(profile),
      apiBaseUrl: getPublicApiUrl(req),
      adminUrl: getAdminUrl(),
    });
    return;
  }

  res.json({ status: "pending" });
});

/** Plugin oynasi yopilsa yoki foydalanuvchi Cancel bossa, pending request darhol bekor qilinadi. */
pluginRouter.post("/device/cancel", deviceStatusLimiter, async (req: Request, res: Response) => {
  const parsed = devicePollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sign-in request" });
    return;
  }
  const requestId = normalizeDeviceCode(parsed.data.requestId);
  if (!validDevicePollRequest(requestId, parsed.data.pollToken)) {
    res.status(403).json({ error: "Invalid sign-in request" });
    return;
  }
  await prisma.pluginDeviceCode.updateMany({
    where: { code: requestId, status: "pending", expiresAt: { gt: new Date() } },
    data: { status: "denied" },
  });
  res.json({ ok: true });
});

/** Joriy foydalanuvchi + tarif + limitlar */
pluginRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const profile = await ensurePluginProfile(req.user!.userId);
  if (profile.status !== PluginAccountStatus.ACTIVE) {
    const blocked = profile.status === PluginAccountStatus.BLOCKED;
    res.status(403).json({
      error: blocked ? "Account is blocked" : "Account is not active",
      code: blocked ? "ACCOUNT_BLOCKED" : "ACCOUNT_INACTIVE",
    });
    return;
  }
  res.json({
    user: serializePluginUser(profile),
    pluginToken: req.pluginToken ? serializePluginToken(req.pluginToken) : null,
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
    res.status(403).json({ error: "Account is not active", code: "ACCOUNT_INACTIVE" });
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
    // B2 (#10) — faol obuna bilan FREE'ga tushirish 409 (konflikt), kod bilan.
    const code = (result as { code?: string }).code;
    res.status(code === "SUBSCRIPTION_ACTIVE" ? 409 : 400).json({ error: result.error, code });
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
  if (process.env.NODE_ENV === "production") {
    res.status(410).json({ error: "Use the import reservation flow", code: "IMPORT_RESERVATION_REQUIRED" });
    return;
  }
  const parsed = usageSchema.safeParse(req.body);
  const templateId = parsed.success ? parsed.data.templateId : undefined;
  const result = await consumeImport(req.user!.userId);
  if (!result.ok) {
    res.status(403).json({ error: result.error, code: result.code });
    return;
  }
  await bumpTemplateCounter(templateId, "importsCount");
  // Bosqich 4 #1: REAL import hodisasi (#14: await — Cloud Run javobdan keyin CPU'ni throttle qiladi).
  await recordTemplateDownloadEvent({ templateId, userId: req.user!.userId, kind: "import", source: "plugin", audit: downloadAuditFromReq(req), app: hostAppFromReq(req) });
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});

const importReservationSchema = z.object({ templateId: z.string().optional() });
const importFinishSchema = z.object({ reservationId: z.string().min(8) });

pluginRouter.post("/usage/import/reserve", usageLimiter, requireAuth, async (req, res) => {
  const parsed = importReservationSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });
  const result = await reserveImport(req.user!.userId, parsed.data.templateId);
  if (!result.ok) return void res.status(result.code === "LIMIT_REACHED" ? 403 : 403).json({ error: result.error, code: result.code });
  res.json({ reservationId: result.reservationId, expiresAt: result.expiresAt });
});

pluginRouter.post("/usage/import/commit", usageLimiter, requireAuth, async (req, res) => {
  const parsed = importFinishSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });
  const result = await finishImportReservation(req.user!.userId, parsed.data.reservationId, true);
  if (!result.ok) return void res.status(409).json({ error: "Import reservation is no longer active", code: "RESERVATION_INVALID" });
  if (!result.duplicate) {
    await bumpTemplateCounter(result.templateId || undefined, "importsCount");
    await recordTemplateDownloadEvent({ templateId: result.templateId || undefined, userId: req.user!.userId, kind: "import", source: "plugin", audit: downloadAuditFromReq(req), app: hostAppFromReq(req) });
  }
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ user: serializePluginUser(profile) });
});

pluginRouter.post("/usage/import/cancel", usageLimiter, requireAuth, async (req, res) => {
  const parsed = importFinishSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });
  const result = await finishImportReservation(req.user!.userId, parsed.data.reservationId, false);
  res.json({ ok: result.ok });
});
