import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
  type NextFunction,
} from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { z } from "zod";
import {
  prisma,
  Prisma,
  TemplateReviewStatus,
  UserRole,
} from "@creative-tools/database";

function asMetaJson(meta: Record<string, unknown>): Prisma.InputJsonValue {
  return meta as Prisma.InputJsonValue;
}
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireContributorOrAdmin } from "../middleware/contributor.js";
import {
  ensureTemplateDir,
  ensureScenesDir,
  ensureMogrtDir,
  findAssetPath,
  sceneKey,
  templateDir,
} from "../lib/template-files.js";
import {
  isS3Configured,
  uploadFileToS3,
  templateAssetFlags,
  s3UploadKeyForFile,
  getSignedUploadUrl,
  getS3ObjectMeta,
  deleteTemplateAssets,
  resolveS3AssetKey,
  downloadS3ToFile,
  deleteS3Objects,
} from "../lib/s3.js";
import { optimizePreviewForStreaming, probeMediaDimensions } from "../lib/optimize-preview.js";
import { transcodePreviewInBackground } from "../lib/transcode-preview.js";
import { extractMogrtsFromZip, type MogrtScene } from "../lib/mogrt-extract.js";
import { extractIngestZip, sanitizeFileBaseName } from "../lib/ingest-zip.js";
import { generateTemplateMetadata } from "../lib/ai/template-metadata.js";
import {
  setUploadProgress,
  getUploadProgress,
  subscribeUploadProgress,
} from "../lib/upload-progress.js";
import { postTemplateModerationMessage } from "../lib/studio-messages.js";
import { writeAuditLog } from "../lib/audit-log.js";
import { embedTemplateInBackground } from "../lib/ai/embed-templates.js";
import { sendEmail, renderEmailLayout } from "../lib/email.js";
import { getWebUrl } from "../lib/app-urls.js";
import { scanFileHash, type MalwareScanResult } from "../lib/malware-scan.js";
import { realTemplateCounts, applyRealCounts } from "../lib/download-events.js";
import {
  getContributorEarningsSummary,
  recordContributorPayout,
  payoutPerDownloadCents,
} from "../lib/earnings.js";
import crypto from "crypto";

/** Moderatsiya natijasini contributor'ga email qiladi (xato bo'lsa jim o'tadi) */
async function notifyContributorReview(
  contributorId: string,
  templateName: string,
  approved: boolean,
  note: string
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: contributorId },
      select: { email: true, name: true },
    });
    if (!user?.email) return;
    const studioUrl = `${getWebUrl()}/studio/contributor/`;
    const title = approved
      ? "Your template was approved ✓"
      : "Your template needs another look";
    const body = approved
      ? `<p style="font-size:13px;line-height:1.6"><b>${templateName}</b> has been approved and is now visible in the AE Browse catalog.</p>`
      : `<p style="font-size:13px;line-height:1.6"><b>${templateName}</b> was not approved this time.</p>${
          note
            ? `<p style="font-size:12px;color:#bbb;background:#222;border-radius:8px;padding:10px;margin-top:8px">Note: ${note.replace(/</g, "&lt;")}</p>`
            : ""
        }`;
    await sendEmail({
      to: user.email,
      subject: `FrameFlow — ${title}`,
      html: renderEmailLayout(
        title,
        `${body}<a href="${studioUrl}" style="display:inline-block;margin-top:14px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Open Studio</a>`
      ),
    });
  } catch (e) {
    console.warn("[contributor] review email xato:", e);
  }
}

async function withAssetFlags<T extends { id: string }>(row: T) {
  return {
    ...row,
    assets: await templateAssetFlags(row.id),
  };
}

export const contributorRouter = Router();

/**
 * #14 Path traversal himoyasi — :id (templateId) Prisma cuid() shaklida
 * bo'lishi shart. Bu guard multer diskStorage (destination/filename) va
 * fs operatsiyalaridan OLDIN, ownership tekshiruvidan ham oldin ishlaydi,
 * shuning uchun "../", "/", "." kabi belgilar fayl yo'liga umuman tushmaydi.
 * cuid: 'c' + kichik harf/raqam (masalan cmpzpnnyq0001oc1gzla3mzi5).
 */
const TEMPLATE_ID_RE = /^c[a-z0-9]{20,30}$/;
contributorRouter.param("id", (req, res, next, id) => {
  if (typeof id !== "string" || !TEMPLATE_ID_RE.test(id)) {
    res.status(400).json({ error: "Invalid template identifier" });
    return;
  }
  next();
});

const SETTINGS_ID = "platform";

const DEFAULT_CATEGORIES = [
  { value: "intros", label: "Intros" },
  { value: "logos", label: "Logos" },
  { value: "mockups", label: "Mockups" },
];

async function getOrCreateSettings() {
  let row = await prisma.contributorPlatformSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row) {
    row = await prisma.contributorPlatformSettings.create({
      data: {
        id: SETTINGS_ID,
        categoriesJson: DEFAULT_CATEGORIES,
        contributorInstructions:
          "Upload your template in the FrameFlow Contributor panel for After Effects. Once approved, it will appear in the Browse panel.",
      },
    });
  }
  return row;
}

const settingsPatchSchema = z.object({
  apiBaseUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  requireApproval: z.boolean().optional(),
  defaultNav: z.string().optional(),
  defaultRes: z.string().optional(),
  defaultOrient: z.string().optional(),
  categoriesJson: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  contributorInstructions: z.string().optional().nullable(),
});

const templateBodySchema = z.object({
  externalId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  nav: z.string().max(60).optional(),
  cat: z.string().min(1).max(80),
  catLabel: z.string().min(1).max(120),
  orient: z.string().max(40).optional(),
  res: z.string().max(40).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  icon: z.string().optional(),
  bg: z.string().optional(),
  templateApp: z.string().optional(),
  metaJson: z.record(z.unknown()).optional(),
  fileName: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  scenes: z.array(z.unknown()).optional(),
  // Faqat ADMIN o'zgartira oladi (handler'da himoyalangan)
  published: z.boolean().optional(),
  isPro: z.boolean().optional(), // per-shablon tier (PRO/FREE) — faqat ADMIN
});

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
  published: z.boolean().optional(),
});

/** PATCH'da scenes massivi yangilanganda — server boyitgan per-scene kalitlar
 *  (previewKey, mogrtKey, preview, previewKind, thumb) yangi manifestda
 *  bo'lmasa eski qiymatdan saqlanadi. Kalit: previewKey | aeComp | n. */
const SCENE_SERVER_KEYS = [
  "previewKey",
  "mogrtKey",
  "preview",
  "previewKind",
  "thumb",
] as const;

function sceneIdent(s: Record<string, unknown>): string {
  return String(s.previewKey || s.aeComp || s.n || "").toLowerCase();
}

function mergeSceneMeta(existingScenes: unknown[], incomingScenes: unknown[]): unknown[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const e of existingScenes) {
    if (e && typeof e === "object") {
      const k = sceneIdent(e as Record<string, unknown>);
      if (k) byKey.set(k, e as Record<string, unknown>);
    }
  }
  return incomingScenes.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const s = { ...(raw as Record<string, unknown>) };
    const prev = byKey.get(sceneIdent(s));
    if (!prev) return s;
    for (const key of SCENE_SERVER_KEYS) {
      const cur = s[key];
      if ((cur === undefined || cur === null || cur === "") && prev[key] != null) {
        s[key] = prev[key];
      }
    }
    return s;
  });
}

contributorRouter.get("/settings", requireAuth, async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json({
    ...settings,
    categories: settings.categoriesJson,
  });
});

contributorRouter.patch(
  "/settings",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = settingsPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      return;
    }
    const data = parsed.data;
    const settings = await prisma.contributorPlatformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        categoriesJson: data.categoriesJson ?? DEFAULT_CATEGORIES,
        ...data,
      },
      update: data,
    });
    res.json({ ...settings, categories: settings.categoriesJson });
  }
);

contributorRouter.get("/admin/overview", requireAuth, requireAdmin, async (_req, res) => {
  const [users, byStatus, pending, recent] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.CONTRIBUTOR },
          { contributorTemplates: { some: {} } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        contributorBlockedAt: true,
        _count: { select: { contributorTemplates: true } },
      },
      orderBy: { email: "asc" },
    }),
    prisma.contributorTemplate.groupBy({
      by: ["reviewStatus"],
      _count: { _all: true },
    }),
    prisma.contributorTemplate.count({
      where: { reviewStatus: TemplateReviewStatus.PENDING_REVIEW },
    }),
    prisma.contributorTemplate.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: {
        contributor: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    byStatus.map((r) => [r.reviewStatus, r._count._all])
  ) as Record<string, number>;

  res.json({
    contributors: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      templateCount: u._count.contributorTemplates,
      status: u.contributorBlockedAt ? "blocked" : "active",
    })),
    stats: {
      totalTemplates: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      pending,
      approved: statusCounts.APPROVED ?? 0,
      rejected: statusCounts.REJECTED ?? 0,
      draft: statusCounts.DRAFT ?? 0,
    },
    recent: await (async () => {
      const rows = await Promise.all(recent.map(withAssetFlags));
      const counts = await realTemplateCounts(rows.map((r) => r.id));
      return rows.map((r) => applyRealCounts(r, counts));
    })(),
  });
});

/** Bosqich 4 #3 — Contributor "daromadim": o'z earning balansi + so'nggi payoutlar. */
contributorRouter.get("/earnings", requireAuth, async (req, res) => {
  const summary = await getContributorEarningsSummary(req.user!.userId);
  const payouts = await prisma.contributorPayout.findMany({
    where: { contributorId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json({ ...summary, payouts });
});

/** Bosqich 4 #3 — Admin: barcha contributor'lar earning balansi (payout UI uchun). */
contributorRouter.get("/admin/earnings", requireAuth, requireAdmin, async (_req, res) => {
  const grouped = await prisma.contributorEarning.groupBy({
    by: ["contributorId"],
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const unpaid = await prisma.contributorEarning.groupBy({
    by: ["contributorId"],
    where: { payoutId: null },
    _sum: { amountCents: true },
  });
  const unpaidMap = new Map(unpaid.map((r) => [r.contributorId, r._sum.amountCents ?? 0]));
  const ids = grouped.map((g) => g.contributorId);
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json({
    perDownloadCents: payoutPerDownloadCents(),
    contributors: grouped.map((g) => ({
      contributorId: g.contributorId,
      email: userMap.get(g.contributorId)?.email ?? null,
      name: userMap.get(g.contributorId)?.name ?? null,
      totalEarnedCents: g._sum.amountCents ?? 0,
      balanceCents: Math.max(0, unpaidMap.get(g.contributorId) ?? 0),
      earningEvents: g._count._all,
    })),
  });
});

/** Bosqich 4 #3 — Admin: contributor'ga payout yozadi (to'lanmagan earninglarni bog'laydi). */
const payoutSchema = z.object({
  contributorId: z.string().min(1),
  method: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
});
contributorRouter.post("/admin/payouts", requireAuth, requireAdmin, async (req, res) => {
  const parsed = payoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payout data" });
    return;
  }
  const result = await recordContributorPayout({
    contributorId: parsed.data.contributorId,
    method: parsed.data.method,
    reference: parsed.data.reference,
    note: parsed.data.note,
    createdById: req.user!.userId,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await writeAuditLog({
    actorId: req.user!.userId,
    action: "contributor.payout.create",
    targetType: "contributor",
    targetId: parsed.data.contributorId,
    detail: `Payout ${(result.payout.amountCents / 100).toFixed(2)} ${result.payout.currency}`,
    meta: { payoutId: result.payout.id, linkedEarnings: result.linkedEarnings },
  });
  res.json({ ok: true, payout: result.payout, linkedEarnings: result.linkedEarnings });
});

contributorRouter.get("/templates", requireAuth, async (req, res) => {
  const user = req.user!;
  const status = req.query.status as TemplateReviewStatus | undefined;
  const scope = req.query.scope as string | undefined;
  const contributorId = req.query.contributorId as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();

  const where: {
    contributorId?: string;
    reviewStatus?: TemplateReviewStatus;
    name?: { contains: string; mode: "insensitive" };
  } = {};

  if (user.role === "ADMIN" && scope === "all") {
    if (status) where.reviewStatus = status;
    if (contributorId) where.contributorId = contributorId;
    if (search) where.name = { contains: search, mode: "insensitive" };
  } else if (user.role === "ADMIN" && scope === "moderation") {
    where.reviewStatus = status ?? TemplateReviewStatus.PENDING_REVIEW;
  } else if (user.role === "ADMIN" && !req.query.mine) {
    where.reviewStatus = status ?? TemplateReviewStatus.PENDING_REVIEW;
  } else {
    where.contributorId = user.userId;
    if (status) where.reviewStatus = status;
  }

  const items = await prisma.contributorTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      contributor: { select: { id: true, email: true, name: true } },
    },
  });

  // Bosqich 4 #1: download/import sonini REAL hodisalardan olamiz (forgeable Int emas).
  const rows = await Promise.all(items.map(withAssetFlags));
  const counts = await realTemplateCounts(rows.map((r) => r.id));
  res.json({ items: rows.map((r) => applyRealCounts(r, counts)) });
});

/** Har maydon uchun ruxsat etilgan kengaytmalar (server-side validatsiya) */
const ASSET_UPLOAD_EXTS: Record<string, string[]> = {
  thumb: [".jpg", ".jpeg", ".png", ".webp"],
  preview: [".mp4", ".mov", ".webm"],
  pack: [".aep", ".zip", ".mogrt"],
};

const uploadAssets = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = String(req.params.id);
      cb(null, ensureTemplateDir(id));
    },
    filename: (req, file, cb) => {
      const kind = file.fieldname as "thumb" | "preview" | "pack";
      const ext = path.extname(file.originalname) || ".bin";
      cb(null, `${kind}${ext}`);
    },
  }),
  // UI limiti 3 GB + texnik zaxira (multipart overhead)
  limits: { fileSize: 3300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ASSET_UPLOAD_EXTS[file.fieldname];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed && allowed.includes(ext)) cb(null, true);
    else cb(new Error(`ASSET_TYPE:${file.fieldname}:${ext || "no extension"}`));
  },
});

const uploadAssetsFields = uploadAssets.fields([
  { name: "thumb", maxCount: 1 },
  { name: "preview", maxCount: 1 },
  { name: "pack", maxCount: 1 },
]);

/**
 * Multer xatolarini tushunarli JSON ga aylantiradi va xato maydonning chala
 * yozilgan faylini o'chiradi — aks holda truncated pack diskda qolib,
 * katalogda hasPack:true bo'lib AE importni buzadi (production'da kuzatilgan).
 */
/**
 * SSE — upload bosqichlari real vaqtda (Studio progress bar).
 * Auth: templateId cuid'ning o'zi capability (EventSource header yubora olmaydi);
 * faqat bosqich/foiz/xabar uzatiladi, fayl ma'lumoti emas.
 */
contributorRouter.get("/templates/:id/upload-progress", (req, res) => {
  const id = String(req.params.id);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (p: ReturnType<typeof getUploadProgress>) => {
    if (!p) return;
    res.write(
      `data: ${JSON.stringify({
        stage: p.stage,
        pct: p.pct,
        message: p.message,
        error: p.error,
        done: p.done,
      })}\n\n`
    );
  };

  send(getUploadProgress(id));
  const unsub = subscribeUploadProgress(id, send);
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(ping);
    unsub();
  });
});

/**
 * Re-extract — eski shablonni QAYTA UPLOAD qilmasdan tuzatish (faqat admin).
 * Pack ZIP'ni disk yoki R2'dan oladi, .mogrt sahnalarni qayta ajratadi, scene
 * preview (mp4/png) + yakka .mogrt fayllarni R2 ga yozadi va metaJson.scenes
 * (slug, previewKey, mogrtKey) ni yangilaydi. Progress mavjud upload-progress
 * SSE (GET .../templates/:id/upload-progress) orqali oqadi. Xatoda qaysi
 * bosqichda ekani (stage) JSON'da ham, SSE error xabarida ham qaytadi.
 */
contributorRouter.post(
  "/admin/templates/:id/re-extract",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    let stage = "init";
    let tmpDir: string | null = null;
    const fail = (status: number, errText: string) => {
      setUploadProgress(id, {
        stage: "error",
        pct: 0,
        message: "",
        error: `[${stage}] ${errText}`,
        done: true,
      });
      if (!res.headersSent) res.status(status).json({ error: errText, stage });
    };
    try {
      stage = "lookup";
      const existing = await prisma.contributorTemplate.findUnique({
        where: { id },
      });
      if (!existing) {
        res.status(404).json({ error: "Template not found", stage });
        return;
      }

      // 1) Pack ZIP manbasi: avval disk, bo'lmasa R2'dan tmp'ga yuklab ol
      stage = "locate-pack";
      setUploadProgress(id, {
        stage: "download",
        pct: 5,
        message: "Locating pack…",
      });
      let zipPath: string | null = null;
      const diskPack = findAssetPath(id, "pack");
      if (diskPack && path.extname(diskPack).toLowerCase() === ".zip") {
        zipPath = diskPack;
      } else if (isS3Configured()) {
        const packKey = await resolveS3AssetKey(id, "pack");
        if (!packKey) {
          fail(404, "Pack file not found on R2 or disk");
          return;
        }
        // .aep/.mogrt yakka fayldan sahna ajratib bo'lmaydi — faqat ZIP
        if (/\.(aep|mogrt)$/i.test(packKey)) {
          fail(
            400,
            `Pack is not a ZIP (${packKey.split("/").pop()}) — re-extract only works for .zip packs`
          );
          return;
        }
        stage = "download";
        setUploadProgress(id, {
          stage: "download",
          pct: 15,
          message: "Downloading pack from R2…",
        });
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_reextract_"));
        zipPath = path.join(tmpDir, "pack.zip");
        await downloadS3ToFile(packKey, zipPath);
      }
      if (!zipPath) {
        fail(404, "Pack file not found (disk/R2)");
        return;
      }

      // 2) ZIP'dan .mogrt sahnalarni ajratib R2 ga yoz (per-scene progress)
      stage = "extract";
      setUploadProgress(id, {
        stage: "extract",
        pct: 40,
        message: "Unpacking ZIP, preparing scenes…",
      });
      const scenesOut = await storeMogrtScenesFromZip(
        id,
        zipPath,
        (done, total) => {
          setUploadProgress(id, {
            stage: "extract",
            pct: 40 + Math.floor((done / total) * 50),
            message: `Preparing scene ${done}/${total}…`,
          });
        }
      );

      if (scenesOut.length === 0) {
        // Xato emas — pack ichida .mogrt bo'lmasligi mumkin (.aep pack)
        setUploadProgress(id, {
          stage: "done",
          pct: 100,
          message: "No .mogrt scenes found inside the pack",
          done: true,
        });
        res.json({
          ok: true,
          scenes: 0,
          message: "No .mogrt scenes found inside the pack",
        });
        return;
      }

      // 3) metaJson.scenes ni yangilash
      stage = "db";
      setUploadProgress(id, {
        stage: "db",
        pct: 95,
        message: "Saving scenes to the database…",
      });
      const existingMeta = (existing.metaJson ?? {}) as Record<string, unknown>;
      await prisma.contributorTemplate.update({
        where: { id },
        data: { metaJson: asMetaJson({ ...existingMeta, scenes: scenesOut }) },
      });

      const withMogrt = scenesOut.filter(
        (s) => (s as { mogrtKey?: string }).mogrtKey
      ).length;
      setUploadProgress(id, {
        stage: "done",
        pct: 100,
        message: `Done — ${scenesOut.length} scene(s) (${withMogrt} with .mogrt)`,
        done: true,
      });
      res.json({
        ok: true,
        scenes: scenesOut.length,
        withMogrt,
        sceneList: scenesOut.map((s) => ({
          slug: s.slug,
          previewKey: s.previewKey,
          mogrtKey: (s as { mogrtKey?: string }).mogrtKey ?? null,
        })),
      });
    } catch (e) {
      console.error(`[re-extract] xato (stage=${stage}):`, e);
      fail(500, e instanceof Error ? e.message : "Unexpected error");
    } finally {
      if (tmpDir) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }
  }
);

/**
 * Re-transcode preview — eski/katta (250MB · 4K) previewlarni 720p H.264 ga
 * QAYTA siqadi (faqat admin). optimizePreviewForStreaming tuzatishi faqat YANGI
 * uploadlarga tushgan — eski previewlar hali katta. Bu route mavjud previewni
 * R2'dan (yoki diskdan) oladi, optimizePreviewForStreaming bilan transcode qiladi
 * va R2 ga `preview.mp4` sifatida qayta yozadi; eski katta nusxa boshqa kalitda
 * bo'lsa (preview.mov/.webm) o'chiriladi. Per-template; bulk uchun
 * scripts/retranscode-previews.mjs ketma-ket chaqiradi.
 */
contributorRouter.post(
  "/admin/templates/:id/re-transcode-preview",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    let tmpDir: string | null = null;
    try {
      const existing = await prisma.contributorTemplate.findUnique({
        where: { id },
      });
      if (!existing) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      // Orfan tozalash uchun mavjud R2 kalitini aniqlab olamiz (disk manba bo'lsa ham)
      const srcKey = isS3Configured()
        ? await resolveS3AssetKey(id, "preview")
        : null;

      // Manba: avval disk (lokalda mavjud bo'lsa), bo'lmasa R2'dan tmp'ga yuklab ol
      let localPath: string | null = null;
      const diskPreview = findAssetPath(id, "preview");
      if (diskPreview) {
        localPath = diskPreview;
      } else if (srcKey) {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_retx_"));
        const ext = path.extname(srcKey) || ".mp4";
        localPath = path.join(tmpDir, `preview${ext}`);
        await downloadS3ToFile(srcKey, localPath);
      }
      if (!localPath) {
        res.status(404).json({ error: "Preview file not found (disk/R2)" });
        return;
      }

      const beforeBytes = fs.statSync(localPath).size;
      const transcoded = await optimizePreviewForStreaming(localPath);
      const afterBytes = fs.statSync(localPath).size;

      // R2 ga qayta yoz — content endi H.264 mp4, shuning uchun kalit preview.mp4
      let uploaded = false;
      let removedOldKey = false;
      if (isS3Configured()) {
        const destKey = `templates/${id}/preview.mp4`;
        await uploadFileToS3(localPath, destKey, "video/mp4");
        uploaded = true;
        if (srcKey && srcKey !== destKey) {
          removedOldKey = (await deleteS3Objects([srcKey])) > 0;
        }
      }

      res.json({
        ok: true,
        transcoded, // false → faststart-only fallback (ffmpeg transcode amalga oshmadi)
        uploaded,
        beforeBytes,
        afterBytes,
        savedBytes: Math.max(0, beforeBytes - afterBytes),
        removedOldKey,
      });
    } catch (e) {
      console.error("[re-transcode-preview] xato:", e);
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : "Unexpected error" });
    } finally {
      if (tmpDir) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }
  }
);

/**
 * Pack ZIP'dan .mogrt sahnalarni ajratib, har sahnaning thumb preview'i va
 * yakka .mogrt faylini disk + R2 ga saqlaydi. Yangilangan sahna ro'yxatini
 * (saqlangan .mogrt'lar uchun mogrtKey bilan) qaytaradi — metaJson'ni
 * chaqiruvchi yozadi. Upload va re-extract route'lari baham ko'radi.
 * onScene har .mogrt yuklashda chaqiriladi (progress uchun).
 */
async function storeMogrtScenesFromZip(
  id: string,
  zipPath: string,
  onScene?: (done: number, total: number) => void
): Promise<Array<MogrtScene & { mogrtKey?: string }>> {
  const { scenes, thumbs, mogrts, cleanup } = await extractMogrtsFromZip(zipPath);
  try {
    if (scenes.length === 0) return [];
    const scenesDirPath = ensureScenesDir(id);
    for (const th of thumbs) {
      const fileName = `${th.previewKey}${th.ext}`;
      const destPath = path.join(scenesDirPath, fileName);
      try {
        fs.copyFileSync(th.path, destPath);
      } catch (e) {
        console.warn(`[mogrt-extract] thumb disk copy xato (${fileName}):`, e);
      }
      if (isS3Configured()) {
        try {
          await uploadFileToS3(
            th.path,
            `templates/${id}/scenes/${fileName}`,
            th.contentType
          );
        } catch (e) {
          console.error(`[mogrt-extract] thumb R2 upload xato (${fileName}):`, e);
          // Fail-closed: bulutga yozilmagan nusxa diskda qolmasin (Cloud Run
          // diski ephemeral — disk-only fayl serve qilinmaydi, faqat chalkashtiradi).
          try {
            fs.rmSync(destPath, { force: true });
          } catch {}
        }
      }
    }
    // Har .mogrt alohida saqlanadi (disk + R2) — sahna tanlanganda
    // butun ZIP o'rniga faqat shu fayl yuklab olinadi (M2)
    const savedMogrtSlugs = new Set<string>();
    for (let mi = 0; mi < mogrts.length; mi++) {
      const m = mogrts[mi];
      onScene?.(mi + 1, mogrts.length);
      const fileName = `${m.slug}.mogrt`;
      const destPath = path.join(ensureMogrtDir(id), fileName);
      let diskSaved = false;
      let r2Saved = false;
      try {
        fs.copyFileSync(m.path, destPath);
        diskSaved = true;
      } catch (e) {
        console.warn(`[mogrt-extract] mogrt disk copy xato (${fileName}):`, e);
      }
      if (isS3Configured()) {
        try {
          await uploadFileToS3(
            m.path,
            `templates/${id}/mogrt/${fileName}`,
            "application/octet-stream"
          );
          r2Saved = true;
        } catch (e) {
          console.error(`[mogrt-extract] mogrt R2 upload xato (${fileName}):`, e);
          // Fail-closed: bulutga yozilmagan nusxa diskda qolmasin.
          if (diskSaved) {
            try {
              fs.rmSync(destPath, { force: true });
            } catch {}
          }
        }
      }
      // #13: dangling mogrtKey'ning oldini olish. Cloud Run diski ephemeral —
      // R2 sozlangan bo'lsa sahna faqat R2 upload MUVAFFAQ bo'lgandagina
      // import qilinadi. Shu bois S3 bor bo'lsa mogrtKey'ni faqat r2Saved
      // bo'lsa yozamiz (disk copy xato yutilmaydi, lekin u yetarli emas).
      // S3 yo'q (dev) — eski xulq: disk copy yetarli.
      const saved = isS3Configured() ? r2Saved : diskSaved;
      if (saved) savedMogrtSlugs.add(m.slug);
    }
    return scenes.map((s) =>
      savedMogrtSlugs.has(s.slug) ? { ...s, mogrtKey: s.slug } : s
    );
  } finally {
    cleanup();
  }
}

function handleAssetsUpload(
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
) {
  setUploadProgress(String(req.params.id), {
    stage: "receive",
    pct: 0,
    message: "Receiving file…",
  });
  uploadAssetsFields(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const e = err as { code?: string; field?: string; message?: string };
    const msg = String(e.message || "");
    const field =
      e.field || (msg.startsWith("ASSET_TYPE:") ? msg.split(":")[1] : "");
    if (field) {
      try {
        const dir = templateDir(String(req.params.id));
        if (fs.existsSync(dir)) {
          for (const name of fs.readdirSync(dir)) {
            if (name.startsWith(`${field}.`)) {
              try {
                fs.rmSync(path.join(dir, name), { force: true });
              } catch {}
            }
          }
        }
      } catch {}
    }
    const fail = (status: number, errorText: string) => {
      setUploadProgress(String(req.params.id), {
        stage: "receive",
        pct: 0,
        message: "",
        error: errorText,
        done: true,
      });
      res.status(status).json({ error: errorText });
    };
    if (e.code === "LIMIT_FILE_SIZE") {
      fail(
        413,
        `File is too large — maximum 3 GB${field ? ` (${field})` : ""}. Reduce the pack size and re-upload.`
      );
      return;
    }
    if (msg.startsWith("ASSET_TYPE:")) {
      const parts = msg.split(":");
      const f = parts[1];
      const ext = parts[2];
      const list = (ASSET_UPLOAD_EXTS[f] || []).join(", ");
      fail(
        400,
        `"${f}" does not accept ${ext} files — allowed: ${list}`
      );
      return;
    }
    console.error("[upload-assets] multer xato:", err);
    fail(400, "File upload failed — please try again");
  });
}

/**
 * POST /templates/:id/upload-url — thumb/preview uchun presigned PUT URL (to'g'ridan R2).
 * Brauzer faylni R2'ga to'g'ridan yuklaydi → Render fayl baytlariga tegmaydi (OOM oldini olish).
 * Pack alohida /assets orqali (server sahna ekstraktsiyasi qiladi).
 */
const uploadUrlSchema = z.object({
  files: z
    .array(
      z.object({
        kind: z.enum(["thumb", "preview", "pack"]),
        fileName: z.string().min(1).max(300),
        contentType: z.string().min(1).max(120),
      })
    )
    .min(1)
    .max(3),
});
contributorRouter.post(
  "/templates/:id/upload-url",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (req.user!.role !== "ADMIN" && existing.contributorId !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    if (!isS3Configured()) {
      res.status(503).json({ error: "Cloud storage is not configured" });
      return;
    }
    const p = uploadUrlSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
      return;
    }
    const uploads = [];
    for (const f of p.data.files) {
      const ext = path.extname(f.fileName).toLowerCase();
      const allowed = ASSET_UPLOAD_EXTS[f.kind] || [];
      if (!allowed.includes(ext)) {
        res.status(400).json({
          error: `"${f.kind}" does not accept ${ext || "this file type"} — allowed: ${allowed.join(", ")}`,
        });
        return;
      }
      const key = s3UploadKeyForFile(id, f.kind, f.fileName);
      const url = await getSignedUploadUrl(key, f.contentType, 1800);
      uploads.push({ kind: f.kind, key, url, contentType: f.contentType });
    }
    res.json({ uploads });
  }
);

/**
 * POST /templates/:id/preview-uploaded — presigned-PUT yo'li (brauzer → R2 to'g'ridan)
 * tugaganini bildiruvchi SIGNAL. Bu yo'lda preview server'ga kelmaydi, shu bois
 * transcode INLINE bajarilmaydi (#15 — o'lik transcode). Frontend preview PUT'i
 * tugagach shu endpoint'ni chaqiradi; biz status='pending' qo'yib FON transcode'ni
 * (transcodePreviewInBackground) otamiz — R2'dan preview olib, 720p H.264 ga siqib,
 * preview.mp4 sifatida qayta yozadi. Javob darrov qaytadi (transcode'ni kutmaydi).
 */
contributorRouter.post(
  "/templates/:id/preview-uploaded",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (req.user!.role !== "ADMIN" && existing.contributorId !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    await prisma.contributorTemplate.update({
      where: { id },
      data: { previewTranscodeStatus: "pending", previewTranscodeError: null },
    });
    transcodePreviewInBackground(id); // fon — javobni bloklamaydi
    res.json({ ok: true, previewTranscodeStatus: "pending" });
  }
);

/** Fayl sha256 (hex) — stream (GB pack ham RAM'ni to'ldirmaydi). */
function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Skan verdikti → packScanStatus mapping (Bosqich 2 #2). SOF funksiya (I/O YO'Q).
 * Upload-path (fon quvuri) VA approve-path (on-demand lazy-resolve) IKKALASI shu funksiyani
 * ishlatadi — mapping bir joyda bo'lib, ikki yo'l bir xil qaror qabul qiladi.
 */
function classifyPackScan(
  scan: MalwareScanResult,
  dup: { id: string; contributorId: string } | null,
  contributorId: string,
  prod: boolean
): { scanStatus: string; detail: string; quarantine: boolean; userError: string | null } {
  if (dup && dup.contributorId !== contributorId) {
    return {
      scanStatus: "duplicate",
      quarantine: true,
      detail: `Same pack as another contributor's template (${dup.id}) — anti-theft`,
      userError: "This pack already exists as another template — publishing blocked.",
    };
  }
  if (scan.verdict === "malicious") {
    return {
      scanStatus: "malicious",
      quarantine: true,
      detail: scan.detail,
      userError: "Pack failed the security check (malware detected) — publishing blocked.",
    };
  }
  if (scan.verdict === "unknown" && prod) {
    // Fail-closed: prodda noma'lum/skan qilib bo'lmaydigan → karantin, admin ko'rib chiqadi.
    return {
      scanStatus: "quarantined",
      quarantine: true,
      detail: scan.detail,
      userError: "Pack security check is pending — an admin will review it.",
    };
  }
  return {
    scanStatus: "clean",
    quarantine: false,
    detail: dup ? `Clean (your own earlier copy: ${dup.id})` : scan.detail,
    userError: null,
  };
}

type PackScanResolution = {
  scanStatus: string;
  detail: string;
  quarantine: boolean;
  userError: string | null;
  hash: string;
  scan: MalwareScanResult;
  dup: { id: string; contributorId: string } | null;
  /** Yuklab olingan pack'ning tmp yo'li — chaqiruvchi (masalan sahna ekstraktsiyasi) ishlatishi mumkin. */
  packPath: string;
  /** tmp'ni tozalaydi — chaqiruvchi HAR HOLDA (finally) chaqirishi SHART. */
  cleanup: () => void;
};

/**
 * Pack xavfsizlik quvurini bajaradi (Bosqich 2 #2): bulutdan tmp'ga yuklab
 * (1) sha256 hash → dedup, (2) malware skan (VirusTotal), (3) classify → DB'ga
 * packScanStatus/detail yozadi (+ karantin bo'lsa audit + published=false). Ekstraktsiya
 * va SSE progress'ni O'ZI qilMAYDI — chaqiruvchi hal qiladi (upload-path sahna ajratadi,
 * approve-path faqat statusni yangilaydi). tmp faylni SAQLAYDI — chaqiruvchi `cleanup()`
 * ni chaqirishi SHART.
 */
async function resolvePackScan(
  id: string,
  packKey: string,
  contributorId: string,
  onProgress?: (p: Parameters<typeof setUploadProgress>[1]) => void
): Promise<PackScanResolution> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_pack_"));
  const cleanup = () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  };
  try {
    const ext = path.extname(packKey) || ".bin";
    const packPath = path.join(tmpDir, `pack${ext}`);
    onProgress?.({ stage: "download", pct: 12, message: "Downloading pack…" });
    await downloadS3ToFile(packKey, packPath);

    // 1) Content-hash → dedup (boshqa contributor bir xil pack = anti-theft; o'zi = warn).
    onProgress?.({ stage: "scan", pct: 22, message: "Running security check…" });
    const hash = await sha256File(packPath);
    const dup = await prisma.contributorTemplate.findFirst({
      where: { packHash: hash, id: { not: id } },
      select: { id: true, contributorId: true },
    });

    // 2) Malware skan (hash-asosli). Sozlanmagan → dev clean / prod unknown.
    const scan = await scanFileHash(hash);

    // 3) Verdikt → status (sof mapping, upload/approve umumiy).
    const prod = process.env.NODE_ENV === "production";
    const cls = classifyPackScan(scan, dup, contributorId, prod);

    await prisma.contributorTemplate.update({
      where: { id },
      data: {
        packHash: hash,
        packScanStatus: cls.scanStatus,
        packScanDetail: cls.detail.slice(0, 480),
        ...(cls.quarantine ? { published: false } : {}),
      },
    });

    if (cls.quarantine) {
      await writeAuditLog({
        actorId: contributorId,
        action: "template.pack_quarantined",
        targetType: "template",
        targetId: id,
        detail: cls.detail,
        meta: { scanStatus: cls.scanStatus, hash, malicious: scan.malicious ?? null, duplicateOf: dup?.id ?? null },
      });
    }

    return { ...cls, hash, scan, dup, packPath, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}

/**
 * Pack yuklangач xavfsizlik + ekstraktsiya quvuri (Bosqich 2 #2). `resolvePackScan` bilan
 * skan/status'ni hal qiladi; TOZA + .zip bo'lsa sahnalarni ajratadi; KARANTIN bo'lsa to'xtaydi.
 *
 * ⚠️ CLOUD RUN TUZOG'I: bu funksiya HTTP javobi (res.json) YUBORILGACH fon rejimida (fire-and-
 * forget) chaqirilMASLIGI kerak — Cloud Run javobdan keyin CPU'ni ~0 ga throttle qiladi, shu
 * bois fon task muzlaydi/o'ladi va packScanStatus abadiy "pending" qolib approve bloklanadi.
 * Shu sabab /pack-uploaded uni javobdan OLDIN `await` qiladi. Fire-and-forget'ni QAYTA joriy
 * qilma. (Approve-path'da lazy-resolve — quyida — zaxira himoya.)
 */
async function processPackInBackground(
  id: string,
  packKey: string,
  contributorId: string,
  isZip: boolean
): Promise<void> {
  let resolution: PackScanResolution | null = null;
  try {
    resolution = await resolvePackScan(id, packKey, contributorId, (p) => setUploadProgress(id, p));

    if (resolution.quarantine) {
      setUploadProgress(id, {
        stage: "error",
        pct: 0,
        message: "",
        error: resolution.userError || "Pack was quarantined.",
        done: true,
      });
      return; // ekstraktsiya YO'Q — karantin.
    }

    // TOZA → .zip bo'lsa sahnalarni ajrat (.aep/.mogrt yakka fayldan ajratilmaydi).
    if (isZip) {
      const scenesOut = await storeMogrtScenesFromZip(id, resolution.packPath, (done, total) => {
        setUploadProgress(id, {
          stage: "extract",
          pct: 40 + Math.floor((done / total) * 55),
          message: `Preparing scene ${done}/${total}…`,
        });
      });
      if (scenesOut.length > 0) {
        const fresh = await prisma.contributorTemplate.findUnique({ where: { id } });
        const existingMeta = (fresh?.metaJson ?? {}) as Record<string, unknown>;
        await prisma.contributorTemplate.update({
          where: { id },
          data: { metaJson: asMetaJson({ ...existingMeta, scenes: scenesOut }) },
        });
      }
      setUploadProgress(id, {
        stage: "done",
        pct: 100,
        message: scenesOut.length ? `Done — ${scenesOut.length} scene(s)` : "Done!",
        done: true,
      });
    } else {
      setUploadProgress(id, { stage: "done", pct: 100, message: "Done!", done: true });
    }
  } catch (e) {
    console.error("[pack-uploaded] xavfsizlik/ekstraktsiya xato:", e);
    setUploadProgress(id, {
      stage: "error",
      pct: 0,
      message: "",
      error: e instanceof Error ? e.message : "Error processing the pack",
      done: true,
    });
  } finally {
    resolution?.cleanup();
  }
}

/**
 * POST /templates/:id/pack-uploaded — pack presigned-PUT (brauzer → bulut to'g'ridan)
 * tugaganini bildiruvchi SIGNAL. Cloud Run 32MB so'rov limiti katta AE pack'larni
 * (100MB–GB) multer orqali qabul qila olmagani uchun pack ham thumb/preview kabi
 * presigned PUT bilan to'g'ridan bulutga yuklanadi. Bu endpoint fayl bulutda
 * borligini tasdiqlaydi (HeadObject), DB'ga nom/hajm yozadi va .zip bo'lsa FON
 * rejimida .mogrt sahnalarni ajratadi (javobni bloklamaydi).
 */
const packUploadedSchema = z.object({
  fileName: z.string().min(1).max(300),
});
contributorRouter.post(
  "/templates/:id/pack-uploaded",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (req.user!.role !== "ADMIN" && existing.contributorId !== req.user!.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    const p = packUploadedSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
      return;
    }
    if (!isS3Configured()) {
      res.status(503).json({ error: "Cloud storage is not configured" });
      return;
    }
    const ext = path.extname(p.data.fileName).toLowerCase();
    if (!(ASSET_UPLOAD_EXTS.pack || []).includes(ext)) {
      res.status(400).json({
        error: `Pack does not accept ${ext || "this file type"} — allowed: ${ASSET_UPLOAD_EXTS.pack.join(", ")}`,
      });
      return;
    }
    // Presigned PUT `s3UploadKeyForFile(id, "pack", fileName)` kaliti bilan yozdi —
    // aynan shu kalitni tekshiramiz (klient uploadga bergan fileName bilan mos).
    const packKey = s3UploadKeyForFile(id, "pack", p.data.fileName);
    const meta = await getS3ObjectMeta(packKey);
    if (meta.sizeBytes == null) {
      res
        .status(404)
        .json({ error: "Pack not found in cloud storage — please re-upload" });
      return;
    }
    // Yangi pack yuklandi → skan holatini reset (eski 'clean' qolib ketmasin).
    await prisma.contributorTemplate.update({
      where: { id },
      data: {
        fileName: p.data.fileName,
        fileSize: meta.sizeBytes,
        packHash: null,
        packScanStatus: "pending",
        packScanDetail: null,
      },
    });
    // Eski .aep→.zip kesh (serve-asset.ts) endi ESKI mazmunga ishora qiladi —
    // o'chiramiz, keyingi yuklab olishda yangi .aep'dan qayta quriladi.
    await deleteS3Objects([`templates/${id}/pack.dl.zip`]).catch(() => {});
    // Xavfsizlik quvuri (hash dedup + malware skan) → TOZA bo'lsa .zip sahnalarni ajratadi.
    // ⚠️ Cloud Run javobdan keyin CPU'ni throttle qiladi — fire-and-forget fon task muzlab,
    // packScanStatus abadiy "pending" qolardi (approve bloklanardi). Shu bois skan+status'ni
    // javobdan OLDIN SINXRON `await` qilamiz: status hech qachon "pending" qolmaydi.
    // TRADEOFF: juda katta pack (100MB+) download+hash so'rovni cho'zadi — Cloud Run request
    // timeout (default 300s, max 3600s) odatda yetarli; agar timeout bo'lsa status "pending"
    // qolib, approve-vaqtidagi lazy-resolve yoki admin "Clear pack" tugmasi zaxira himoya.
    const isZip = /\.zip$/i.test(packKey);
    setUploadProgress(id, {
      stage: "scan",
      pct: 5,
      message: "Pack received, running security check…",
    });
    await processPackInBackground(id, packKey, existing.contributorId, isZip);
    res.json({ ok: true, extracting: isZip, scanning: false });
  }
);

/* ────────────────────────────────────────────────────────────────────────
 * Cloud ingest (FAZA 2) — muallif ziplarni `incoming/{contributorId}/`ga
 * to'g'ridan yuklaydi (presigned PUT), so'ng /ingest ularni ochib, skan qilib,
 * "pending" shablonga aylantiradi. KONTENT-QUVURI-SXEMA.md §4-5.
 * ──────────────────────────────────────────────────────────────────────── */

function mimeForExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * POST /incoming/upload-url — ziplarni `incoming/{contributorId}/{fileName}.zip`
 * kalitiga to'g'ridan yuklash uchun presigned PUT (brauzer → bulut to'g'ridan,
 * /templates/:id/upload-url bilan bir xil naqsh). Kalit DETERMINISTIK (contributorId
 * + tozalangan fayl nomi, timestamp YO'Q) — shu bois bir xil nomdagi zip qayta
 * yuklansa avvalgisi ustiga yoziladi va /ingest qayta chaqirilsa ham idempotent qoladi.
 */
const incomingUploadUrlSchema = z.object({
  files: z.array(z.object({ fileName: z.string().min(1).max(200) })).min(1).max(50),
});
contributorRouter.post(
  "/incoming/upload-url",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    if (!isS3Configured()) {
      res.status(503).json({ error: "Cloud storage is not configured" });
      return;
    }
    const p = incomingUploadUrlSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
      return;
    }
    const contributorId = req.user!.userId;
    const uploads = [];
    for (const f of p.data.files) {
      if (!/\.zip$/i.test(f.fileName)) {
        res.status(400).json({ error: `"${f.fileName}" is not a .zip file` });
        return;
      }
      const safeName = sanitizeFileBaseName(f.fileName.replace(/\.zip$/i, ""));
      const key = `incoming/${contributorId}/${safeName}.zip`;
      const url = await getSignedUploadUrl(key, "application/zip", 1800);
      uploads.push({ fileName: f.fileName, key, url });
    }
    res.json({ uploads });
  }
);

type IngestItemResult = {
  key: string;
  ok: boolean;
  id?: string;
  reason?: string;
};

/**
 * Bitta incoming zipni "pending" shablonga aylantiradi (KONTENT-QUVURI-SXEMA.md §5):
 * yuklab olish → ochish → pack topish → skan+dedup (classifyPackScan — mavjud siyosat
 * bilan bir xil) → ContributorTemplate yaratish (PENDING_REVIEW) → asset'larni
 * kanonik kalitlarga yuklash → preview fon transcode → o'lcham→orient/res →
 * asl zipni o'chirish. Har xatoda throw QILMAYDI — natija obyektini qaytaradi, shu
 * bois chaqiruvchi (POST /ingest) bitta yomon zip uchun butun partiyani to'xtatmaydi.
 */
async function ingestOneZip(contributorId: string, key: string): Promise<IngestItemResult> {
  if (!key.startsWith(`incoming/${contributorId}/`)) {
    return { key, ok: false, reason: "File does not belong to this contributor" };
  }
  if (!/\.zip$/i.test(key)) {
    return { key, ok: false, reason: "Not a .zip file" };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_ingest_"));
  try {
    const meta = await getS3ObjectMeta(key);
    if (meta.sizeBytes == null) {
      return { key, ok: false, reason: "File not found in cloud storage" };
    }
    const zipLocalPath = path.join(tmpDir, "incoming.zip");
    await downloadS3ToFile(key, zipLocalPath);

    const extracted = await extractIngestZip(zipLocalPath, path.join(tmpDir, "extracted"));
    if (!extracted.packPath || !extracted.packExt) {
      return { key, ok: false, reason: "No .aep/.mogrt project file found inside the zip" };
    }

    // Skan + anti-theft dedup — chiqarilgan pack (.aep) hashi ustida, mavjud
    // upload-yo'li (resolvePackScan) bilan bir xil siyosat (classifyPackScan).
    const hash = await sha256File(extracted.packPath);
    const dup = await prisma.contributorTemplate.findFirst({
      where: { packHash: hash },
      select: { id: true, contributorId: true },
    });
    const scan = await scanFileHash(hash);
    const prod = process.env.NODE_ENV === "production";
    const cls = classifyPackScan(scan, dup, contributorId, prod);
    if (cls.scanStatus === "malicious") {
      await deleteS3Objects([key]).catch(() => {});
      return { key, ok: false, reason: cls.userError || "Malicious file detected" };
    }

    const settings = await getOrCreateSettings();
    // FAZA 3 (KONTENT-QUVURI-SXEMA.md §6) — AI zip nomidan (+ preview rasmidan) nom /
    // kategoriya (kanonik ro'yxatdan) / 20 teg yozadi. INTERNAL metadata: kredit yo'li
    // ISHLATILMAYDI. AI xato bersa fail-safe fallback qaytadi — ingest bloklanmaydi.
    const aiMeta = await generateTemplateMetadata({
      zipFileName: key,
      imagePath: extracted.imagePath,
    });
    const title = aiMeta.title;

    let dims: { width: number; height: number } | null = null;
    if (extracted.imagePath) dims = await probeMediaDimensions(extracted.imagePath);
    if (!dims && extracted.videoPath) dims = await probeMediaDimensions(extracted.videoPath);
    const orient = !dims
      ? settings.defaultOrient || "horizontal"
      : dims.width > dims.height * 1.1
        ? "horizontal"
        : dims.height > dims.width * 1.1
          ? "vertical"
          : "square";
    const res = dims && Math.max(dims.width, dims.height) >= 2000 ? "4k" : "1080p";

    const flags: string[] = [];
    if (!extracted.imagePath) flags.push("Missing preview image");
    if (!extracted.videoPath) flags.push("Missing preview video");

    let template;
    try {
      template = await prisma.contributorTemplate.create({
        data: {
          contributorId,
          externalId: key,
          name: title,
          nav: settings.defaultNav || "video",
          cat: aiMeta.cat,
          catLabel: aiMeta.catLabel,
          tags: aiMeta.tags,
          orient,
          res,
          templateApp: extracted.templateApp,
          reviewStatus: TemplateReviewStatus.PENDING_REVIEW,
          published: false,
          reviewNote: flags.length ? `⚠ ${flags.join("; ")}` : null,
          packHash: hash,
          packScanStatus: cls.scanStatus,
          packScanDetail: cls.detail.slice(0, 480),
        },
      });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        return { key, ok: false, reason: "Already ingested" };
      }
      throw e;
    }

    const packKey = s3UploadKeyForFile(template.id, "pack", extracted.packPath);
    await uploadFileToS3(extracted.packPath, packKey, "application/octet-stream");
    let fileSize: number | null = null;
    try {
      fileSize = fs.statSync(extracted.packPath).size;
    } catch {}

    if (extracted.imagePath) {
      const thumbKey = s3UploadKeyForFile(template.id, "thumb", extracted.imagePath);
      await uploadFileToS3(extracted.imagePath, thumbKey, mimeForExt(extracted.imagePath));
    }
    if (extracted.videoPath) {
      const previewKey = s3UploadKeyForFile(template.id, "preview", extracted.videoPath);
      await uploadFileToS3(extracted.videoPath, previewKey, mimeForExt(extracted.videoPath));
      await prisma.contributorTemplate.update({
        where: { id: template.id },
        data: { previewTranscodeStatus: "pending" },
      });
      transcodePreviewInBackground(template.id); // fon — mavjud /preview-uploaded konvensiyasi
    }

    await prisma.contributorTemplate.update({
      where: { id: template.id },
      data: { fileName: path.basename(extracted.packPath), fileSize },
    });

    await deleteS3Objects([key]).catch(() => {});

    if (cls.quarantine) {
      await writeAuditLog({
        actorId: contributorId,
        action: "template.pack_quarantined",
        targetType: "template",
        targetId: template.id,
        detail: cls.detail,
        meta: { scanStatus: cls.scanStatus, hash, duplicateOf: dup?.id ?? null },
      });
    }
    await writeAuditLog({
      actorId: contributorId,
      action: "template.ingested",
      targetType: "template",
      targetId: template.id,
      detail: `${title} (${key})`,
    });

    return { key, ok: true, id: template.id };
  } catch (e) {
    console.error("[ingest] xato:", key, e);
    return { key, ok: false, reason: e instanceof Error ? e.message : "Unexpected error" };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * POST /ingest — yuklangan incoming zip kalitlarini "pending" shablonlarga aylantiradi.
 * Har biri SINXRON (await) ishlanadi — Cloud Run javobdan keyin CPU'ni throttle qiladi,
 * shu bois fire-and-forget bu yerda ham QAYTA joriy qilinMAYDI (xuddi /pack-uploaded kabi).
 */
const ingestSchema = z.object({
  keys: z.array(z.string().min(1).max(500)).min(1).max(50),
});
contributorRouter.post(
  "/ingest",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    if (!isS3Configured()) {
      res.status(503).json({ error: "Cloud storage is not configured" });
      return;
    }
    const p = ingestSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.issues[0]?.message || "Invalid request" });
      return;
    }
    const contributorId = req.user!.userId;
    const results: IngestItemResult[] = [];
    for (const key of p.data.keys) {
      results.push(await ingestOneZip(contributorId, key));
    }
    res.json({ results });
  }
);

contributorRouter.post(
  "/templates/:id/assets",
  requireAuth,
  requireContributorOrAdmin,
  handleAssetsUpload,
  async (req, res) => {
    try {
    const id = String(req.params.id);
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    const existing = await prisma.contributorTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const pack = files?.pack?.[0];
    const preview = files?.preview?.[0];
    const thumb = files?.thumb?.[0];

    // (A) Multipart yo'li — preview shu yerda kelsa INLINE transcode (mavjud xulq,
    // #15 semaphore ostida, OZGARTIRILMAYDI). Holatni 'done' deb belgilaymiz
    // (presigned-PUT yo'lidagi (B) fon transcode bilan bir xil status maydoni).
    if (preview?.path) {
      await optimizePreviewForStreaming(preview.path);
      try {
        await prisma.contributorTemplate.update({
          where: { id },
          data: { previewTranscodeStatus: "done", previewTranscodeError: null },
        });
      } catch {}
    }

    // S3/R2 ga sync (cloud deployment) — TO'LIQ fail-closed: bulutga
    // yozilmasa diskdagi nusxa o'chiriladi (Cloud Run diski ephemeral,
    // jim o'tilsa fayl keyinroq g'oyib bo'ladi va hech qachon serve
    // qilinmaydi — shu bois disk-only holat saqlanmaydi). Pack uchun
    // butun so'rov 502 bilan to'xtaydi; thumb/preview uchun yuklash
    // davom etadi, lekin muvaffaqiyatsiz bo'lgan kind javobda false
    // qaytariladi (frontend qayta urinishi mumkin).
    const cloudSyncFailed = new Set<string>();
    if (isS3Configured()) {
      setUploadProgress(id, {
        stage: "sync",
        pct: 82,
        message: "Saving to cloud storage…",
      });
      const mimeMap: Record<string, string> = {
        thumb: "image/jpeg",
        preview: "video/mp4",
        pack: "application/octet-stream",
      };
      for (const [kind, file] of [["thumb", thumb], ["preview", preview], ["pack", pack]] as const) {
        if (!file?.path) continue;
        try {
          await uploadFileToS3(
            file.path,
            s3UploadKeyForFile(id, kind, file.path),
            mimeMap[kind]
          );
        } catch (s3Err) {
          console.error(`S3 upload error (${kind}):`, s3Err);
          try {
            fs.rmSync(file.path, { force: true });
          } catch {}
          if (kind === "pack") {
            const errText =
              "Could not save the pack file to cloud storage — please try again shortly";
            setUploadProgress(id, {
              stage: "sync",
              pct: 84,
              message: "",
              error: errText,
              done: true,
            });
            res.status(502).json({ error: errText });
            return;
          }
          cloudSyncFailed.add(kind);
        }
      }
    }

    // Pack muvaffaqiyatli saqlangandan keyingina DB ga nom/hajm yoziladi
    setUploadProgress(id, {
      stage: "db",
      pct: 88,
      message: "Saving to the database…",
    });
    const update: { fileName?: string; fileSize?: number } = {};
    if (pack) {
      update.fileName = pack.originalname;
      update.fileSize = pack.size;
    }
    if (Object.keys(update).length) {
      await prisma.contributorTemplate.update({ where: { id }, data: update });
    }

    // ZIP pack bo'lsa — .mogrt sahna nomlari + thumb preview'lar (disk + R2)
    if (pack?.path && path.extname(pack.path).toLowerCase() === ".zip") {
      setUploadProgress(id, {
        stage: "extract",
        pct: 90,
        message: "Unpacking ZIP, preparing scenes…",
      });
      try {
        const scenesOut = await storeMogrtScenesFromZip(
          id,
          pack.path,
          (done, total) => {
            setUploadProgress(id, {
              stage: "extract",
              pct: 91 + Math.floor((done / total) * 6),
              message: `Preparing scene ${done}/${total}…`,
            });
          }
        );
        if (scenesOut.length > 0) {
          setUploadProgress(id, {
            stage: "db",
            pct: 98,
            message: "Saving scenes to the database…",
          });
          const existingMeta = (existing.metaJson ?? {}) as Record<string, unknown>;
          await prisma.contributorTemplate.update({
            where: { id },
            data: { metaJson: asMetaJson({ ...existingMeta, scenes: scenesOut }) },
          });
        }
      } catch (mogrtErr) {
        console.warn("[mogrt-extract] xato:", mogrtErr);
      }
    }

    setUploadProgress(id, {
      stage: "done",
      pct: 100,
      message: "Done!",
      done: true,
    });
    res.json({
      ok: true,
      uploaded: {
        thumb: !!thumb && !cloudSyncFailed.has("thumb"),
        preview: !!preview && !cloudSyncFailed.has("preview"),
        pack: !!pack,
      },
    });
    } catch (e) {
      console.error("[upload-assets] kutilmagan xato:", e);
      const errText = "Unexpected error during upload — please try again";
      setUploadProgress(String(req.params.id), {
        stage: "error",
        pct: 0,
        message: "",
        error: errText,
        done: true,
      });
      if (!res.headersSent) {
        res.status(500).json({ error: errText });
      }
    }
  }
);

/** Per-scene preview fayllar (PNG thumbnail + MOV/MP4 video) — fieldname = scene kaliti */
const uploadScenePreviews = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, ensureScenesDir(String(req.params.id)));
    },
    filename: (_req, file, cb) => {
      const key = sceneKey(file.fieldname);
      // Fayl kengaytmasini saqlash (PNG thumbnail yoki MP4/MOV video)
      const origExt = path.extname(file.originalname).toLowerCase();
      const allowedExts = [".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".webm"];
      const ext = allowedExts.includes(origExt) ? origExt : ".png";
      cb(null, `${key}${ext}`);
    },
  }),
  limits: { fileSize: 512 * 1024 * 1024, files: 160 }, // video uchun katta limit
});

contributorRouter.post(
  "/templates/:id/scene-previews",
  requireAuth,
  requireContributorOrAdmin,
  uploadScenePreviews.any(),
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const failedKeys = new Set<string>();

    // Scene preview'larni S3/R2 ga sync — fail-closed: bulutga yozilmasa
    // diskdagi nusxa o'chiriladi (Cloud Run diski ephemeral, disk-only
    // fayl hech qachon serve qilinmaydi).
    if (isS3Configured() && files.length) {
      for (const f of files) {
        try {
          const ext = path.extname(f.filename).toLowerCase();
          const ct = ext === ".mp4" ? "video/mp4" :
                     ext === ".mov" ? "video/quicktime" :
                     ext === ".webm" ? "video/webm" : "image/png";
          await uploadFileToS3(f.path, `templates/${id}/scenes/${f.filename}`, ct);
        } catch (s3Err) {
          console.error("Scene S3 upload error:", s3Err);
          failedKeys.add(sceneKey(f.fieldname));
          try {
            fs.rmSync(f.path, { force: true });
          } catch {}
        }
      }
    }

    const okFiles = files.filter((f) => !failedKeys.has(sceneKey(f.fieldname)));
    res.json({
      ok: failedKeys.size === 0,
      count: okFiles.length,
      keys: okFiles.map((f) => sceneKey(f.fieldname)),
      ...(failedKeys.size ? { failed: Array.from(failedKeys) } : {}),
    });
  }
);

contributorRouter.post(
  "/templates",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    const parsed = templateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      return;
    }
    const d = parsed.data;
    const meta = {
      ...(d.metaJson ?? {}),
      ...(d.scenes ? { scenes: d.scenes } : {}),
    };

    const settings = await getOrCreateSettings();
    const initialStatus = settings.requireApproval
      ? TemplateReviewStatus.DRAFT
      : TemplateReviewStatus.APPROVED;

    const template = await prisma.contributorTemplate.create({
      data: {
        contributorId: req.user!.userId,
        externalId: d.externalId ?? null,
        name: d.name,
        description: d.description ?? "",
        nav: d.nav ?? settings.defaultNav,
        cat: d.cat,
        catLabel: d.catLabel,
        orient: d.orient ?? settings.defaultOrient,
        res: d.res ?? settings.defaultRes,
        tags: d.tags ?? [],
        icon: d.icon ?? "✦",
        bg: d.bg ?? "",
        templateApp: d.templateApp ?? "ae",
        metaJson: asMetaJson(meta),
        fileName: d.fileName ?? null,
        fileSize: d.fileSize ?? null,
        reviewStatus: initialStatus,
        published: !settings.requireApproval,
      },
    });

    // Auto-approve (moderatsiya o'chiq) — semantik qidiruv uchun embedding (fon).
    if (template.reviewStatus === TemplateReviewStatus.APPROVED && template.published) {
      embedTemplateInBackground(template.id);
    }

    res.status(201).json(template);
  }
);

contributorRouter.patch(
  "/templates/:id",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    const existing = await prisma.contributorTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const parsed = templateBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      return;
    }
    const d = parsed.data;
    // scenes va metaJson Prisma modelida to'g'ridan field emas —
    // ularni ...d spread'dan ajratib, metaJson ichiga yig'amiz
    const { scenes: _scenes, metaJson: _metaJson, ...directFields } = d;
    // `published` va `isPro` (tier) faqat ADMIN uchun — contributor o'zgartira olmaydi
    if (req.user!.role !== "ADMIN") {
      delete (directFields as Record<string, unknown>).published;
      delete (directFields as Record<string, unknown>).isPro;
    }

    const existingMetaObj = (existing.metaJson ?? {}) as Record<string, unknown>;
    const mergedScenes = d.scenes
      ? mergeSceneMeta(
          Array.isArray(existingMetaObj.scenes)
            ? (existingMetaObj.scenes as unknown[])
            : [],
          d.scenes as unknown[]
        )
      : undefined;
    const meta =
      d.metaJson || d.scenes
        ? {
            ...existingMetaObj,
            ...(d.metaJson ?? {}),
            ...(mergedScenes ? { scenes: mergedScenes } : {}),
          }
        : undefined;

    const template = await prisma.contributorTemplate.update({
      where: { id },
      data: {
        ...directFields,
        ...(meta !== undefined ? { metaJson: asMetaJson(meta as Record<string, unknown>) } : {}),
        externalId: d.externalId === undefined ? undefined : d.externalId,
      },
    });
    res.json(template);
  }
);

contributorRouter.post(
  "/templates/:id/submit",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    if (
      req.user!.role === UserRole.CONTRIBUTOR &&
      !(await assertContributorNotBlocked(req.user!.userId, res))
    ) {
      return;
    }
    const existing = await prisma.contributorTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const template = await prisma.contributorTemplate.update({
      where: { id },
      data: {
        reviewStatus: TemplateReviewStatus.PENDING_REVIEW,
        published: false,
        reviewNote: null,
      },
    });
    res.json(template);
  }
);

type ReviewOutcome =
  | { ok: true; template: Awaited<ReturnType<typeof prisma.contributorTemplate.update>> }
  | { ok: false; status: number; error: string; code?: string; packScanStatus?: string };

/**
 * Bitta shablonni approve/reject qiladi (karantin gate + embedding + moderatsiya xabari +
 * audit + email). /templates/:id/review (yakka) va /admin/templates/bulk (ommaviy) shundan
 * foydalanadi — mantiq bir joyda. Kutilmagan xatoni THROW qiladi (yakka yo'l 500, bulk yo'li
 * per-item try/catch bilan ushlaydi); ma'lum holatlar (karantin, stale session) ok:false.
 */
async function reviewOneTemplate(
  id: string,
  action: "approve" | "reject",
  opts: { note?: string; published?: boolean },
  adminId: string
): Promise<ReviewOutcome> {
  const { note, published } = opts;

  // Karantin gate (Bosqich 2 #2): malware/dedup karantinидаги pack TASDIQLANMAYDI/NASHR
  // ETILMAYDI. Reject bloklanmaydi (admin baribir rad qila oladi).
  if (action === "approve") {
      let pre = await prisma.contributorTemplate.findUnique({
        where: { id },
        select: { packScanStatus: true, fileName: true, contributorId: true },
      });
      // FIX (Cloud Run): fon skan javobdan keyin muzlab, status "pending" qolib qolishi mumkin.
      // Shu holda skanni SHU YERDA (on-demand, sinxron) hal qilamiz — approve fon bajarilishiga
      // bog'liq bo'lmaydi. Skan o'zi xato bersa FAIL-SAFE: status "pending" qoladi (quyidagi
      // gate 409 beradi), admin "Clear pack" bilan qo'lda hal qiladi. So'rov crash BO'LMAYDI.
      if (pre?.packScanStatus === "pending" && pre.fileName && isS3Configured()) {
        try {
          const packKey = s3UploadKeyForFile(id, "pack", pre.fileName);
          const meta = await getS3ObjectMeta(packKey);
          if (meta.sizeBytes != null) {
            const r = await resolvePackScan(id, packKey, pre.contributorId);
            r.cleanup();
            pre = await prisma.contributorTemplate.findUnique({
              where: { id },
              select: { packScanStatus: true, fileName: true, contributorId: true },
            });
          }
        } catch (e) {
          console.error("[review] on-demand pack scan failed:", e);
          // pre "pending" qoladi → quyidagi gate 409 (Clear pack tavsiyasi bilan).
        }
      }
      const s = pre?.packScanStatus;
      if (s === "malicious" || s === "quarantined" || s === "duplicate" || s === "pending") {
        return {
          ok: false,
          status: 409,
          error:
            s === "duplicate"
              ? "Pack was flagged as a duplicate (dedup) — cannot be approved"
              : s === "malicious"
                ? "Pack was flagged as malicious by the malware scan — cannot be approved"
                : s === "pending"
                  ? "Pack security check could not be completed — use “Clear pack (security)” to review and unblock"
                  : "Pack security check is pending (quarantined) — needs admin review",
          code: "PACK_QUARANTINED",
          packScanStatus: s,
        };
      }
    }

    try {
      const template = await prisma.contributorTemplate.update({
        where: { id },
        data: {
          reviewStatus:
            action === "approve"
              ? TemplateReviewStatus.APPROVED
              : TemplateReviewStatus.REJECTED,
          reviewNote: note ?? null,
          reviewedById: adminId,
          reviewedAt: new Date(),
          published:
            action === "approve" ? (published ?? true) : false,
        },
      });

      // Tasdiqlangach — semantik qidiruv uchun embedding (fon, bloklamaydi).
      if (action === "approve" && template.published) {
        embedTemplateInBackground(template.id);
      }

      const noteText = (note ?? "").trim();
      if (action === "reject" && noteText) {
        const hard =
          noteText.toLowerCase().includes("[hard]") ||
          noteText.toLowerCase().includes("hard reject");
        await postTemplateModerationMessage({
          contributorId: template.contributorId,
          templateId: template.id,
          templateName: template.name,
          senderId: adminId,
          body: noteText,
          subjectPrefix: hard ? "Hard reject" : "Soft reject",
        });
      } else if (action === "approve") {
        await postTemplateModerationMessage({
          contributorId: template.contributorId,
          templateId: template.id,
          templateName: template.name,
          senderId: adminId,
          body: noteText || "Template approved — now visible in the AE Browse catalog.",
          subjectPrefix: "Approved",
        });
      }

      const hard =
        noteText.toLowerCase().includes("[hard]") ||
        noteText.toLowerCase().includes("hard reject");
      await writeAuditLog({
        actorId: adminId,
        action:
          action === "approve"
            ? "approve"
            : hard
              ? "hard_reject"
              : "soft_reject",
        targetType: "template",
        targetId: template.id,
        detail: `${template.name}${noteText ? ": " + noteText : ""}`,
      });

      // Contributor'ga email bildirishnoma (bloklamasdan)
      void notifyContributorReview(
        template.contributorId,
        template.name,
        action === "approve",
        noteText
      );

      return { ok: true, template };
    } catch (e: any) {
      // Most common: stale JWT userId after demo clear → FK violation.
      const msg = String(e?.message || "");
      if (msg.includes("ContributorTemplate_reviewedById_fkey")) {
        return { ok: false, status: 401, error: "Session expired" };
      }
      throw e;
    }
}

contributorRouter.post(
  "/templates/:id/review",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      return;
    }
    const id = String(req.params.id);
    const { action, note, published } = parsed.data;
    const outcome = await reviewOneTemplate(id, action, { note, published }, req.user!.userId);
    if (!outcome.ok) {
      const body: Record<string, unknown> = { error: outcome.error };
      if (outcome.code) body.code = outcome.code;
      if (outcome.packScanStatus) body.packScanStatus = outcome.packScanStatus;
      res.status(outcome.status).json(body);
      return;
    }
    res.json(outcome.template);
  }
);

/**
 * KARANTINni qo'lda tozalaydi (bitta shablon) — /admin/templates/:id/pack-clear (yakka)
 * va /admin/templates/bulk (ommaviy) shundan foydalanadi. TASDIQLANGAN "malicious"/"duplicate"
 * TOZALANMAYDI (o'chirib qayta yuklash kerak).
 */
async function clearPackOne(
  id: string,
  adminId: string
): Promise<
  | { ok: true; template: Awaited<ReturnType<typeof prisma.contributorTemplate.update>> }
  | { ok: false; status: number; error: string; code?: string; packScanStatus?: string }
> {
  const existing = await prisma.contributorTemplate.findUnique({
    where: { id },
    select: { name: true, packScanStatus: true },
  });
  if (!existing) {
    return { ok: false, status: 404, error: "Template not found" };
  }
  const s = existing.packScanStatus;
  if (s === "malicious" || s === "duplicate") {
    return {
      ok: false,
      status: 409,
      error: "A confirmed malicious/duplicate pack cannot be cleared manually — delete and re-upload",
      code: "PACK_HARD_BLOCKED",
      packScanStatus: s ?? undefined,
    };
  }
  const template = await prisma.contributorTemplate.update({
    where: { id },
    data: { packScanStatus: "clean", packScanDetail: "Manually reviewed and cleared by admin" },
  });
  await writeAuditLog({
    actorId: adminId,
    action: "template.pack_cleared",
    targetType: "template",
    targetId: id,
    detail: `${existing.name} (previous status: ${s ?? "null"})`,
  });
  return { ok: true, template };
}

/**
 * POST /admin/templates/bulk — OMMAVIY moderatsiya (KONTENT-QUVURI-SXEMA.md §7).
 * Bir necha pending shablonga birdan: approve (+ Free/Pro), reject, yoki clear-pack (xavfsizlik).
 * Har element ALOHIDA ishlanadi (server tomon loop) — bitta yomon element butun partiyani
 * to'xtatmaydi; har biriga per-item natija qaytadi. Karantin gate saqlanadi (approve'dan oldin
 * kerak bo'lsa clear-pack). MONEY-ZONE tegilmaydi — Free/Pro oddiy maydon.
 */
const bulkReviewSchema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(200),
  action: z.enum(["approve", "reject", "clear-pack"]),
  note: z.string().max(2000).optional(),
  published: z.boolean().optional(),
  // Free/Pro: per-shablon `isPro` maydoni (mavjud admin PATCH bilan bir xil). Bu ODDIY maydon —
  // kredit/quote/consume pul dvigeteli EMAS (MONEY-ZONE tegilmaydi).
  isPro: z.boolean().optional(),
});
contributorRouter.post(
  "/admin/templates/bulk",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = bulkReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      return;
    }
    const { ids, action, note, published, isPro } = parsed.data;
    const adminId = req.user!.userId;
    const results: Array<{ id: string; ok: boolean; error?: string; code?: string }> = [];

    for (const id of ids) {
      try {
        if (action === "clear-pack") {
          const out = await clearPackOne(id, adminId);
          results.push(out.ok ? { id, ok: true } : { id, ok: false, error: out.error, code: out.code });
          continue;
        }
        const out = await reviewOneTemplate(id, action, { note, published }, adminId);
        if (!out.ok) {
          results.push({ id, ok: false, error: out.error, code: out.code });
          continue;
        }
        // Free/Pro belgisi — approve bilan bir amalda (oddiy maydon, kredit dvigeteli EMAS).
        if (action === "approve" && typeof isPro === "boolean") {
          await prisma.contributorTemplate.update({ where: { id }, data: { isPro } });
        }
        results.push({ id, ok: true });
      } catch (e) {
        console.error("[bulk] item failed:", id, e);
        results.push({ id, ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    await writeAuditLog({
      actorId: adminId,
      action: `bulk.${action}`,
      targetType: "template",
      targetId: ids[0],
      detail: `Bulk ${action}: ${okCount}/${ids.length} succeeded`,
    });
    res.json({ results, okCount, total: ids.length });
  }
);

contributorRouter.get("/catalog", async (_req, res) => {
  const items = await prisma.contributorTemplate.findMany({
    where: {
      reviewStatus: TemplateReviewStatus.APPROVED,
      published: true,
    },
    orderBy: { updatedAt: "desc" },
    select: {
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
    },
  });
  res.json({ items });
});

/** CEP sync: bulk upsert from local meta.json shape */
contributorRouter.post(
  "/sync",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const packs = z.array(templateBodySchema).safeParse(req.body?.packs);
    if (!packs.success) {
      res.status(400).json({ error: packs.error.flatten() });
      return;
    }
    const settings = await getOrCreateSettings();
    let created = 0;
    let updated = 0;

    for (const d of packs.data) {
      const meta = { ...(d.metaJson ?? {}), ...(d.scenes ? { scenes: d.scenes } : {}) };
      const externalId = d.externalId ?? undefined;
      if (!externalId) continue;

      const existing = await prisma.contributorTemplate.findUnique({
        where: {
          contributorId_externalId: {
            contributorId: req.user!.userId,
            externalId,
          },
        },
      });

      if (existing) {
        await prisma.contributorTemplate.update({
          where: { id: existing.id },
          data: {
            name: d.name,
            description: d.description ?? "",
            nav: d.nav ?? settings.defaultNav,
            cat: d.cat,
            catLabel: d.catLabel,
            orient: d.orient ?? settings.defaultOrient,
            res: d.res ?? settings.defaultRes,
            tags: d.tags ?? [],
            metaJson: asMetaJson(meta),
            fileName: d.fileName ?? null,
            fileSize: d.fileSize ?? null,
          },
        });
        updated++;
      } else {
        await prisma.contributorTemplate.create({
          data: {
            contributorId: req.user!.userId,
            externalId,
            name: d.name,
            description: d.description ?? "",
            nav: d.nav ?? settings.defaultNav,
            cat: d.cat,
            catLabel: d.catLabel,
            orient: d.orient ?? settings.defaultOrient,
            res: d.res ?? settings.defaultRes,
            tags: d.tags ?? [],
            icon: d.icon ?? "✦",
            bg: d.bg ?? "",
            templateApp: d.templateApp ?? "ae",
            metaJson: asMetaJson(meta),
            fileName: d.fileName ?? null,
            fileSize: d.fileSize ?? null,
            reviewStatus: TemplateReviewStatus.DRAFT,
            published: false,
          },
        });
        created++;
      }
    }

    res.json({ ok: true, created, updated });
  }
);

/**
 * POST /admin/templates/:id/pack-clear — KARANTINni qo'lda ko'rib chiqib TOZALASH (Bosqich 2 #2).
 * Faqat NOANIQ karantin ("quarantined"/"unknown"/"pending") uchun — prodda malware skaner
 * sozlanmagan yoki VirusTotal'da avval ko'rilmagan fayl. Admin qo'lda tekshirgach "clean" qiladi.
 * TASDIQLANGAN "malicious"/"duplicate" TOZALANMAYDI (o'chirib qayta yuklash kerak).
 */
contributorRouter.post(
  "/admin/templates/:id/pack-clear",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const out = await clearPackOne(id, req.user!.userId);
    if (!out.ok) {
      const body: Record<string, unknown> = { error: out.error };
      if (out.code) body.code = out.code;
      if (out.packScanStatus) body.packScanStatus = out.packScanStatus;
      res.status(out.status).json(body);
      return;
    }
    res.json(out.template);
  }
);

/**
 * POST /admin/templates/:id/takedown — DMCA/huquqiy da'voga javob (Bosqich 2 #2).
 * Shablonni katalogdan/serve'dan olib tashlaydi (takedownAt + published=false), sababни
 * yozadi. Fayllar O'CHIRILMAYDI (dalil sifatida saqlanadi) — /restore bilan qaytariladi.
 */
const takedownSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
contributorRouter.post(
  "/admin/templates/:id/takedown",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = takedownSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "A reason is required (min 3 characters)" });
      return;
    }
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const template = await prisma.contributorTemplate.update({
      where: { id },
      data: {
        takedownAt: new Date(),
        takedownReason: parsed.data.reason,
        takedownById: req.user!.userId,
        published: false,
      },
    });
    await writeAuditLog({
      actorId: req.user!.userId,
      action: "template.takedown",
      targetType: "template",
      targetId: id,
      detail: `${existing.name}: ${parsed.data.reason}`,
    });
    res.json(template);
  }
);

/** POST /admin/templates/:id/restore — takedown'ni bekor qiladi (qayta nashr QILMAYDI —
 *  admin alohida /review approve bilan nashr etadi). */
contributorRouter.post(
  "/admin/templates/:id/restore",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const template = await prisma.contributorTemplate.update({
      where: { id },
      data: { takedownAt: null, takedownReason: null, takedownById: null },
    });
    await writeAuditLog({
      actorId: req.user!.userId,
      action: "template.takedown_restore",
      targetType: "template",
      targetId: id,
      detail: existing.name,
    });
    res.json(template);
  }
);

contributorRouter.delete(
  "/templates/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });

    // Idempotent: DB'da yo'q bo'lsa ham (takroriy delete / yarim tugagan oldingi
    // urinish) qolgan bulut fayllarini best-effort tozalab 204 qaytaramiz —
    // avval prisma.delete P2025 bilan 500 berardi.
    if (!existing) {
      await deleteTemplateAssets(id).catch(() => {});
      return res.status(204).send();
    }

    // 1) R2/S3 fayllarini avval tozalaymiz. Bu tashqi bog'liqlik va yagona xato
    //    nuqtasi. Agar bu yerda xato bo'lsa, DB delete'ni DAVOM ETTIRMAYMIZ:
    //    DB yozuvi o'chsa, templateId yo'qoladi va orphan fayllarni keyin
    //    tozalashning iloji qolmaydi (publik CDN'da abadiy "leak"). Shu sabab
    //    "fail-closed" — 502 qaytaramiz, admin qayta urinishi mumkin, shablon
    //    DB'da saqlanib qoladi (tiklanadigan holatda).
    try {
      await deleteTemplateAssets(id);
    } catch (err) {
      console.error(`[template_delete] R2 tozalash xatosi (id=${id}):`, err);
      return res.status(502).json({
        error: "Error deleting R2 files. Template was not deleted — please try again.",
      });
    }

    // 2) Lokal disk — best-effort. Render'da disk ephemeral, xato bo'lsa ham
    //    shablonni o'chirishni bloklamaymiz (faqat log).
    try {
      const dir = templateDir(id);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[template_delete] Lokal disk tozalash xatosi (id=${id}):`, err);
    }

    // 3) DB yozuvi + yetim sevimlilar (#17 modeli FK-siz — qo'lda tozalanadi).
    await prisma.contributorTemplate.delete({ where: { id } });
    await prisma.userTemplateFavorite.deleteMany({ where: { templateId: id } }).catch(() => {});
    await writeAuditLog({
      actorId: req.user!.userId,
      action: "template_delete",
      targetType: "template",
      targetId: id,
      detail: existing?.name ?? id,
    });
    res.status(204).send();
  }
);

contributorRouter.patch(
  "/users/:id/role",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const role = z.nativeEnum(UserRole).safeParse(req.body?.role);
    if (!role.success) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { role: role.data },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json(user);
  }
);

contributorRouter.patch(
  "/users/:userId/status",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const blocked = z.boolean().safeParse(req.body?.blocked);
    if (!blocked.success) {
      res.status(400).json({ error: "blocked (boolean) is required" });
      return;
    }
    const user = await prisma.user.update({
      where: { id: String(req.params.userId) },
      data: {
        contributorBlockedAt: blocked.data ? new Date() : null,
        // Blok qilinganda eski JWT'larni bekor qilamiz (unblock'da o'zgarmaydi).
        ...(blocked.data ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        contributorBlockedAt: true,
      },
    });
    if (blocked.data) {
      await prisma.pluginToken.deleteMany({ where: { userId: user.id } });
    }
    await writeAuditLog({
      actorId: req.user!.userId,
      action: blocked.data ? "block" : "unblock",
      targetType: "contributor",
      targetId: user.id,
      detail: user.email,
    });

    res.json({
      ...user,
      status: user.contributorBlockedAt ? "blocked" : "active",
    });
  }
);

async function assertContributorNotBlocked(userId: string, res: ExpressResponse) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { contributorBlockedAt: true, role: true },
  });
  if (u?.contributorBlockedAt && u.role === UserRole.CONTRIBUTOR) {
    res.status(403).json({
      error: "Contributor account is blocked",
      code: "CONTRIBUTOR_BLOCKED",
    });
    return false;
  }
  return true;
}
