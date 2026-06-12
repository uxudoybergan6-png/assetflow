import { Router, type Response as ExpressResponse } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
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
  findAssetPath,
  sceneKey,
  templateDir,
} from "../lib/template-files.js";
import {
  isS3Configured,
  uploadFileToS3,
  templateAssetFlags,
  s3UploadKeyForFile,
  deleteTemplateAssets,
} from "../lib/s3.js";
import { optimizePreviewForStreaming } from "../lib/optimize-preview.js";
import { extractMogrtsFromZip } from "../lib/mogrt-extract.js";
import { postTemplateModerationMessage } from "../lib/studio-messages.js";
import { writeAuditLog } from "../lib/audit-log.js";
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
  name: z.string().min(1),
  description: z.string().optional(),
  nav: z.string().optional(),
  cat: z.string().min(1),
  catLabel: z.string().min(1),
  orient: z.string().optional(),
  res: z.string().optional(),
  tags: z.array(z.string()).optional(),
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
      res.status(400).json({ error: parsed.error.flatten() });
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
  limits: { fileSize: 520 * 1024 * 1024 },
});

contributorRouter.post(
  "/templates/:id/assets",
  requireAuth,
  requireContributorOrAdmin,
  uploadAssets.fields([
    { name: "thumb", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "pack", maxCount: 1 },
  ]),
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
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const pack = files?.pack?.[0];
    const preview = files?.preview?.[0];
    const thumb = files?.thumb?.[0];

    if (preview?.path) {
      await optimizePreviewForStreaming(preview.path);
    }

    const update: { fileName?: string; fileSize?: number } = {};
    if (pack) {
      update.fileName = pack.originalname;
      update.fileSize = pack.size;
    }
    if (Object.keys(update).length) {
      await prisma.contributorTemplate.update({ where: { id }, data: update });
    }

    // S3/R2 ga sync qilish (cloud deployment)
    if (isS3Configured()) {
      const mimeMap: Record<string, string> = {
        thumb: "image/jpeg",
        preview: "video/mp4",
        pack: "application/octet-stream",
      };
      for (const [kind, file] of [["thumb", thumb], ["preview", preview], ["pack", pack]] as const) {
        if (file?.path) {
          try {
            await uploadFileToS3(
              file.path,
              s3UploadKeyForFile(id, kind, file.path),
              mimeMap[kind]
            );
          } catch (s3Err) {
            console.error(`S3 upload error (${kind}):`, s3Err);
          }
        }
      }
    }

    // ZIP pack bo'lsa — .mogrt sahna nomlari + thumb preview'lar (disk + R2)
    if (pack?.path && path.extname(pack.path).toLowerCase() === ".zip") {
      try {
        const { scenes, thumbs, cleanup } = await extractMogrtsFromZip(pack.path);
        try {
          if (scenes.length > 0) {
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
            const existingMeta = (existing.metaJson ?? {}) as Record<string, unknown>;
            await prisma.contributorTemplate.update({
              where: { id },
              data: { metaJson: asMetaJson({ ...existingMeta, scenes }) },
            });
          }
        } finally {
          cleanup();
        }
      } catch (mogrtErr) {
        console.warn("[mogrt-extract] xato:", mogrtErr);
      }
    }

    res.json({
      ok: true,
      uploaded: {
        thumb: !!thumb,
        preview: !!preview,
        pack: !!pack,
      },
    });
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
      res.status(400).json({ error: parsed.error.flatten() });
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
      res.status(400).json({ error: parsed.error.flatten() });
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

    const meta =
      d.metaJson || d.scenes
        ? {
            ...(existing.metaJson as object),
            ...(d.metaJson ?? {}),
            ...(d.scenes ? { scenes: d.scenes } : {}),
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
      res.status(400).json({ error: parsed.error.flatten() });
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
      data: { contributorBlockedAt: blocked.data ? new Date() : null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        contributorBlockedAt: true,
      },
    });
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
