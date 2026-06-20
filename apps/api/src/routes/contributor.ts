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
  deleteTemplateAssets,
  resolveS3AssetKey,
  downloadS3ToFile,
  deleteS3Objects,
} from "../lib/s3.js";
import { optimizePreviewForStreaming } from "../lib/optimize-preview.js";
import { extractMogrtsFromZip, type MogrtScene } from "../lib/mogrt-extract.js";
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
      ? "Shabloningiz tasdiqlandi ✓"
      : "Shabloningiz qayta ko'rib chiqishni talab qiladi";
    const body = approved
      ? `<p style="font-size:13px;line-height:1.6"><b>${templateName}</b> tasdiqlandi va endi AE Browse katalogida ko'rinadi.</p>`
      : `<p style="font-size:13px;line-height:1.6"><b>${templateName}</b> hozircha tasdiqlanmadi.</p>${
          note
            ? `<p style="font-size:12px;color:#bbb;background:#222;border-radius:8px;padding:10px;margin-top:8px">Izoh: ${note.replace(/</g, "&lt;")}</p>`
            : ""
        }`;
    await sendEmail({
      to: user.email,
      subject: `AssetFlow — ${title}`,
      html: renderEmailLayout(
        title,
        `${body}<a href="${studioUrl}" style="display:inline-block;margin-top:14px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Studio'ni ochish</a>`
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
    res.status(400).json({ error: "Noto'g'ri shablon identifikatori" });
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
          "After Effects → AssetFlow Contributor panelida shablon yuklang. Tasdiqlangandan keyin Browse panelda ko‘rinadi.",
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
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
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
    recent: await Promise.all(recent.map(withAssetFlags)),
  });
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

  res.json({ items: await Promise.all(items.map(withAssetFlags)) });
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
    else cb(new Error(`ASSET_TYPE:${file.fieldname}:${ext || "kengaytmasiz"}`));
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
        res.status(404).json({ error: "Shablon topilmadi", stage });
        return;
      }

      // 1) Pack ZIP manbasi: avval disk, bo'lmasa R2'dan tmp'ga yuklab ol
      stage = "locate-pack";
      setUploadProgress(id, {
        stage: "download",
        pct: 5,
        message: "Pack joylashuvi aniqlanmoqda…",
      });
      let zipPath: string | null = null;
      const diskPack = findAssetPath(id, "pack");
      if (diskPack && path.extname(diskPack).toLowerCase() === ".zip") {
        zipPath = diskPack;
      } else if (isS3Configured()) {
        const packKey = await resolveS3AssetKey(id, "pack");
        if (!packKey) {
          fail(404, "Pack fayli R2 yoki diskda topilmadi");
          return;
        }
        // .aep/.mogrt yakka fayldan sahna ajratib bo'lmaydi — faqat ZIP
        if (/\.(aep|mogrt)$/i.test(packKey)) {
          fail(
            400,
            `Pack ZIP emas (${packKey.split("/").pop()}) — re-extract faqat .zip pack uchun`
          );
          return;
        }
        stage = "download";
        setUploadProgress(id, {
          stage: "download",
          pct: 15,
          message: "Pack R2'dan yuklab olinmoqda…",
        });
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_reextract_"));
        zipPath = path.join(tmpDir, "pack.zip");
        await downloadS3ToFile(packKey, zipPath);
      }
      if (!zipPath) {
        fail(404, "Pack fayli topilmadi (disk/R2)");
        return;
      }

      // 2) ZIP'dan .mogrt sahnalarni ajratib R2 ga yoz (per-scene progress)
      stage = "extract";
      setUploadProgress(id, {
        stage: "extract",
        pct: 40,
        message: "ZIP ochilmoqda, sahnalar tayyorlanmoqda…",
      });
      const scenesOut = await storeMogrtScenesFromZip(
        id,
        zipPath,
        (done, total) => {
          setUploadProgress(id, {
            stage: "extract",
            pct: 40 + Math.floor((done / total) * 50),
            message: `Sahna ${done}/${total} tayyorlanmoqda…`,
          });
        }
      );

      if (scenesOut.length === 0) {
        // Xato emas — pack ichida .mogrt bo'lmasligi mumkin (.aep pack)
        setUploadProgress(id, {
          stage: "done",
          pct: 100,
          message: "Pack ichida .mogrt sahna topilmadi",
          done: true,
        });
        res.json({
          ok: true,
          scenes: 0,
          message: "Pack ichida .mogrt sahna topilmadi",
        });
        return;
      }

      // 3) metaJson.scenes ni yangilash
      stage = "db";
      setUploadProgress(id, {
        stage: "db",
        pct: 95,
        message: "Sahnalar bazaga yozilmoqda…",
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
        message: `Tayyor — ${scenesOut.length} sahna (${withMogrt} ta .mogrt)`,
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
      fail(500, e instanceof Error ? e.message : "Kutilmagan xato");
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
        res.status(404).json({ error: "Shablon topilmadi" });
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
        res.status(404).json({ error: "Preview fayli topilmadi (disk/R2)" });
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
        .json({ error: e instanceof Error ? e.message : "Kutilmagan xato" });
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
      try {
        fs.copyFileSync(th.path, path.join(scenesDirPath, fileName));
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
      let diskSaved = false;
      let r2Saved = false;
      try {
        fs.copyFileSync(m.path, path.join(ensureMogrtDir(id), fileName));
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
        }
      }
      // #13: dangling mogrtKey'ning oldini olish. Render disk ephemeral —
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
    message: "Fayl qabul qilinmoqda…",
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
        `Fayl juda katta — maksimal 3 GB${field ? ` (${field})` : ""}. Pack hajmini kichraytirib qayta yuklang.`
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
        `"${f}" uchun ${ext} fayl qabul qilinmaydi — ruxsat etilgan: ${list}`
      );
      return;
    }
    console.error("[upload-assets] multer xato:", err);
    fail(400, "Fayl yuklashda xato — qayta urinib ko'ring");
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
        kind: z.enum(["thumb", "preview"]),
        fileName: z.string().min(1).max(300),
        contentType: z.string().min(1).max(120),
      })
    )
    .min(1)
    .max(2),
});
contributorRouter.post(
  "/templates/:id/upload-url",
  requireAuth,
  requireContributorOrAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Shablon topilmadi" });
      return;
    }
    if (req.user!.role !== "ADMIN" && existing.contributorId !== req.user!.userId) {
      res.status(403).json({ error: "Ruxsat yo‘q" });
      return;
    }
    if (!isS3Configured()) {
      res.status(503).json({ error: "Bulut xotirasi sozlanmagan" });
      return;
    }
    const p = uploadUrlSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
      return;
    }
    const uploads = [];
    for (const f of p.data.files) {
      const ext = path.extname(f.fileName).toLowerCase();
      const allowed = ASSET_UPLOAD_EXTS[f.kind] || [];
      if (!allowed.includes(ext)) {
        res.status(400).json({
          error: `"${f.kind}" uchun ${ext || "fayl"} qabul qilinmaydi — ruxsat: ${allowed.join(", ")}`,
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
      res.status(404).json({ error: "Shablon topilmadi" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Ruxsat yo‘q" });
      return;
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const pack = files?.pack?.[0];
    const preview = files?.preview?.[0];
    const thumb = files?.thumb?.[0];

    if (preview?.path) {
      await optimizePreviewForStreaming(preview.path);
    }

    // S3/R2 ga sync (cloud deployment). Pack — fail-closed: bulutga yozilmasa
    // diskdagi nusxa o'chiriladi va aniq xato qaytadi (Render diski vaqtinchalik,
    // jim o'tilsa pack keyinroq g'oyib bo'ladi).
    if (isS3Configured()) {
      setUploadProgress(id, {
        stage: "sync",
        pct: 82,
        message: "Bulut xotirasiga saqlanmoqda…",
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
          if (kind === "pack") {
            try {
              fs.rmSync(file.path, { force: true });
            } catch {}
            const errText =
              "Pack faylni bulut xotirasiga yozib bo'lmadi — bir ozdan so'ng qayta urinib ko'ring";
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
        }
      }
    }

    // Pack muvaffaqiyatli saqlangandan keyingina DB ga nom/hajm yoziladi
    setUploadProgress(id, {
      stage: "db",
      pct: 88,
      message: "Ma'lumotlar bazasiga yozilmoqda…",
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
        message: "ZIP ochilmoqda, sahnalar tayyorlanmoqda…",
      });
      try {
        const scenesOut = await storeMogrtScenesFromZip(
          id,
          pack.path,
          (done, total) => {
            setUploadProgress(id, {
              stage: "extract",
              pct: 91 + Math.floor((done / total) * 6),
              message: `Sahna ${done}/${total} tayyorlanmoqda…`,
            });
          }
        );
        if (scenesOut.length > 0) {
          setUploadProgress(id, {
            stage: "db",
            pct: 98,
            message: "Sahnalar bazaga yozilmoqda…",
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
      message: "Tayyor!",
      done: true,
    });
    res.json({
      ok: true,
      uploaded: {
        thumb: !!thumb,
        preview: !!preview,
        pack: !!pack,
      },
    });
    } catch (e) {
      console.error("[upload-assets] kutilmagan xato:", e);
      const errText = "Yuklashda kutilmagan xato — qayta urinib ko'ring";
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
      res.status(404).json({ error: "Shablon topilmadi" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Ruxsat yo‘q" });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    // Scene preview'larni S3/R2 ga sync
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
        }
      }
    }

    res.json({
      ok: true,
      count: files.length,
      keys: files.map((f) => sceneKey(f.fieldname)),
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
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
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
      res.status(404).json({ error: "Shablon topilmadi" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Ruxsat yo‘q" });
      return;
    }

    const parsed = templateBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
      return;
    }
    const d = parsed.data;
    // scenes va metaJson Prisma modelida to'g'ridan field emas —
    // ularni ...d spread'dan ajratib, metaJson ichiga yig'amiz
    const { scenes: _scenes, metaJson: _metaJson, ...directFields } = d;
    // `published` faqat ADMIN uchun — contributor o'zgartira olmaydi
    if (req.user!.role !== "ADMIN") {
      delete (directFields as Record<string, unknown>).published;
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
      res.status(404).json({ error: "Shablon topilmadi" });
      return;
    }
    if (
      req.user!.role !== "ADMIN" &&
      existing.contributorId !== req.user!.userId
    ) {
      res.status(403).json({ error: "Ruxsat yo‘q" });
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

contributorRouter.post(
  "/templates/:id/review",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
      return;
    }
    const id = String(req.params.id);
    const { action, note, published } = parsed.data;

    try {
      const template = await prisma.contributorTemplate.update({
        where: { id },
        data: {
          reviewStatus:
            action === "approve"
              ? TemplateReviewStatus.APPROVED
              : TemplateReviewStatus.REJECTED,
          reviewNote: note ?? null,
          reviewedById: req.user!.userId,
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
          senderId: req.user!.userId,
          body: noteText,
          subjectPrefix: hard ? "Hard reject" : "Soft reject",
        });
      } else if (action === "approve") {
        await postTemplateModerationMessage({
          contributorId: template.contributorId,
          templateId: template.id,
          templateName: template.name,
          senderId: req.user!.userId,
          body: noteText || "Shablon tasdiqlandi — AE Browse katalogida ko'rinadi.",
          subjectPrefix: "Tasdiqlandi",
        });
      }

      const hard =
        noteText.toLowerCase().includes("[hard]") ||
        noteText.toLowerCase().includes("hard reject");
      await writeAuditLog({
        actorId: req.user!.userId,
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

      res.json(template);
    } catch (e: any) {
      // Most common: stale JWT userId after demo clear → FK violation.
      const msg = String(e?.message || "");
      if (msg.includes("ContributorTemplate_reviewedById_fkey")) {
        res.status(401).json({ error: "Session expired" });
        return;
      }
      throw e;
    }
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

contributorRouter.delete(
  "/templates/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.contributorTemplate.findUnique({ where: { id } });

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
        error: "R2 fayllarini o'chirishda xato. Shablon o'chirilmadi — qayta urinib ko'ring.",
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

    // 3) DB yozuvi.
    await prisma.contributorTemplate.delete({ where: { id } });
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
      res.status(400).json({ error: "blocked (boolean) kerak" });
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
      error: "Contributor hisobi bloklangan",
      code: "CONTRIBUTOR_BLOCKED",
    });
    return false;
  }
  return true;
}
