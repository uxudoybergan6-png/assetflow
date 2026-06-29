import { Router } from "express";
import type { Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { consumeAiCredits, refundAiCredits, ensurePluginProfile } from "../lib/plugin-profile.js";
import { isOpenRouterConfigured, orChatSys, orImageToPrompt } from "../lib/ai/openrouter.js";
import { isElevenLabsConfigured } from "../lib/ai/elevenlabs.js";
import { isFalConfigured, falEnhancePrompt } from "../lib/ai/fal.js";
import {
  optimizeVideoReferenceForUpload,
  extractAudioReferenceForUpload,
} from "../lib/optimize-preview.js";
import {
  isS3Configured,
  getSignedDownloadUrl,
  deleteS3Objects,
  uploadBufferToS3,
  getPublicOrSignedUrl,
  getS3ObjectMeta,
} from "../lib/s3.js";
import {
  GEN_MODELS,
  getModelsByMode,
  getModelById,
  isModelEnabled,
  computeGenCost,
  getReferenceMode,
  modelAcceptsReference,
  firstReferenceModel,
  getRefKind,
} from "../lib/gen-models.js";
import { signCostQuote, verifyCostQuote, genParamsHash } from "../lib/gen-quote.js";
import {
  processGenerationInBackground,
  reconcileStuckGenerations,
} from "../lib/gen-processor.js";
import { preflightSafetyCheck } from "../lib/preflight-safety.js";

export const studioGenRouter = Router();

async function hydrateGenAssets<T extends { assets: Array<{ resultKey: string | null; url: string; thumbUrl: string | null }> }>(
  holder: T
): Promise<T> {
  if (!isS3Configured()) return holder;
  for (const a of holder.assets) {
    if (!a.resultKey) continue;
    const fresh = await getSignedDownloadUrl(a.resultKey, 3600);
    a.url = fresh;
    if (a.thumbUrl) a.thumbUrl = fresh;
    const meta = await getS3ObjectMeta(a.resultKey);
    (a as typeof a & { sizeBytes?: number | null; contentType?: string | null }).sizeBytes = meta.sizeBytes;
    (a as typeof a & { sizeBytes?: number | null; contentType?: string | null }).contentType = meta.contentType;
  }
  return holder;
}

studioGenRouter.use(
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 40,
    keyPrefix: "studio-gen",
    message: "Juda ko'p so'rov — bir daqiqadan keyin qayta urinib ko'ring",
  })
);

const GEN_MODES = ["image", "voice", "video", "music", "sfx"] as const;

// ── AI-helper (describe/enhance) narx + abuza nazorati ───────────────────────
// Bu ikki endpoint pulli model chaqiradi (gpt-4o-mini / gemini-2.5-flash vision),
// shu sabab /gen kabi consumeAiCredits bilan himoyalanadi. Narxlar /gen jadvaliga
// nisbatan arzon (helper), lekin vision (rasm/video) matn-onlydan QIMMATROQ.
const ENHANCE_COST_BASE = 1;     // faqat text
const ENHANCE_COST_IMAGE = 1;    // rasm referens tahlili
const ENHANCE_COST_VIDEO = 2;    // video referens tahlili
const ENHANCE_COST_AUDIO = 1;    // audio referens tahlili
const DESCRIBE_IMAGE_COST = 2;   // gemini-2.5-flash vision (rasm)
const DESCRIBE_VIDEO_COST = 3;   // + haqiqiy video input (og'irroq, ehtimoliy 2-inference)
const SAVED_REF_TTL_MS = 60 * 60 * 1000; // 1 soat
const SAVED_REF_MAX_LIST = 24;

// Per-user kunlik cap (per-IP rate-limit'dan TASHQARI) — bitta hisob (admin/owner
// ham) orqali kunlik portlashni to'sadi. In-memory/single-instance (mavjud
// rate-limit falsafasiga mos); kredit tizimi asosiy oylik cheklov bo'lib qoladi.
const HELPER_DAILY_CAP = 80;
const helperDayHits = new Map<string, { day: number; count: number }>();
function withinDailyCap(userId: string): boolean {
  const day = Math.floor(Date.now() / 86_400_000); // UTC kun raqami
  const cur = helperDayHits.get(userId);
  if (!cur || cur.day !== day) {
    helperDayHits.set(userId, { day, count: 1 });
    return true;
  }
  if (cur.count >= HELPER_DAILY_CAP) return false;
  cur.count++;
  return true;
}

/** Minimal spend log (Render konsoliga). TODO: alohida AiSpendLog modeli (#3 audit). */
function logAiSpend(userId: string, op: string, cost: number, model: string) {
  console.log(`[ai-spend] user=${userId} op=${op} cost=${cost} model=${model}`);
}

function publicUrls(list?: string[]): string[] {
  return (list || []).filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u));
}

function computeEnhanceCost(input: {
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
}): { cost: number; hasImage: boolean; hasVideo: boolean; hasAudio: boolean } {
  const hasImage = publicUrls(input.imageUrls).length > 0;
  const hasVideo = publicUrls(input.videoUrls).length > 0;
  const hasAudio = publicUrls(input.audioUrls).length > 0;
  return {
    hasImage,
    hasVideo,
    hasAudio,
    cost:
      ENHANCE_COST_BASE +
      (hasImage ? ENHANCE_COST_IMAGE : 0) +
      (hasVideo ? ENHANCE_COST_VIDEO : 0) +
      (hasAudio ? ENHANCE_COST_AUDIO : 0),
  };
}

function savedReferenceKind(contentType: string): "image" | "video" | "audio" {
  if (/^video\//i.test(contentType)) return "video";
  if (/^audio\//i.test(contentType)) return "audio";
  return "image";
}

function savedReferenceExpiry(base = new Date()): Date {
  return new Date(base.getTime() + SAVED_REF_TTL_MS);
}

async function hydrateSavedReferences<
  T extends Array<{ resultKey: string | null; url: string; thumbUrl: string | null }>
>(items: T): Promise<T> {
  if (!isS3Configured()) return items;
  for (const item of items) {
    if (!item.resultKey) continue;
    const fresh = await getSignedDownloadUrl(item.resultKey, 3600);
    item.url = fresh;
    if (item.thumbUrl) item.thumbUrl = fresh;
  }
  return items;
}

async function cleanupExpiredSavedReferences(userId?: string): Promise<number> {
  const expired = await prisma.savedReference.findMany({
    where: {
      expiresAt: { lte: new Date() },
      ...(userId ? { userId } : {}),
    },
    take: 200,
  });
  if (!expired.length) return 0;
  const keys = expired
    .map((r) => r.resultKey)
    .filter((k): k is string => typeof k === "string" && k.length > 0);
  if (keys.length) {
    try {
      await deleteS3Objects(keys);
    } catch (e) {
      console.error("[studio-gen] saved refs cleanup R2 xato:", e);
    }
  }
  await prisma.savedReference.deleteMany({
    where: { id: { in: expired.map((r) => r.id) } },
  });
  return expired.length;
}

async function createSavedReference(input: {
  userId: string;
  url: string;
  resultKey: string;
  contentType: string;
  sizeBytes: number;
  thumbUrl?: string | null;
}): Promise<{
  id: string;
  expiresAt: string;
}> {
  const row = await prisma.savedReference.create({
    data: {
      userId: input.userId,
      kind: savedReferenceKind(input.contentType),
      url: input.url,
      resultKey: input.resultKey,
      thumbUrl: input.thumbUrl ?? null,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      expiresAt: savedReferenceExpiry(),
    },
    select: { id: true, expiresAt: true },
  });
  return { id: row.id, expiresAt: row.expiresAt.toISOString() };
}

async function touchSavedReferences(
  userId: string,
  input: { ids?: string[]; urls?: string[] },
  generationId: string
): Promise<void> {
  const validIds = Array.from(new Set((input.ids || []).filter((u) => typeof u === "string" && u.length > 7)));
  const validUrls = Array.from(new Set((input.urls || []).filter((u) => typeof u === "string" && u.length > 7)));
  if (!validIds.length && !validUrls.length) return;
  const now = new Date();
  await prisma.savedReference.updateMany({
    where: {
      userId,
      OR: [
        ...(validIds.length ? [{ id: { in: validIds } }] : []),
        ...(validUrls.length ? [{ url: { in: validUrls } }] : []),
      ],
    },
    data: {
      generationId,
      lastUsedAt: now,
      expiresAt: savedReferenceExpiry(now),
    },
  });
}

const savedRefCleanupTimer = setInterval(() => {
  cleanupExpiredSavedReferences().catch((e) => {
    console.error("[studio-gen] saved refs cleanup xato:", e);
  });
}, 15 * 60 * 1000);
if (typeof savedRefCleanupTimer.unref === "function") savedRefCleanupTimer.unref();

/** GET /credits — kredit balansi. */
studioGenRouter.get("/credits", async (req: Request, res: Response) => {
  // Qotib qolgan job'larni tiklash → yo'qolган kredit qaytadi (panel ochilганда).
  await reconcileStuckGenerations(req.user!.userId).catch(() => {});
  await cleanupExpiredSavedReferences(req.user!.userId).catch(() => {});
  const profile = await ensurePluginProfile(req.user!.userId);
  res.json({ aiCredits: profile.aiCredits, plan: profile.plan.toLowerCase() });
});

/** GET /gen/health — AI sozlamalari holati (faqat boolean — kalitlar QAYTARILMAYDI). */
studioGenRouter.get("/gen/health", (_req: Request, res: Response) => {
  res.json({
    openrouter: isOpenRouterConfigured(),
    s3: isS3Configured(),
    freepik: Boolean(process.env.FREEPIK_API_KEY),
    elevenlabs: isElevenLabsConfigured(),
  });
});

/** POST /gen/sessions — yangi ish maydoni (session). */
const sessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  mode: z.enum(GEN_MODES).optional(),
});
studioGenRouter.post("/gen/sessions", async (req: Request, res: Response) => {
  const p = sessionSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const session = await prisma.genSession.create({
    data: {
      userId: req.user!.userId,
      title: p.data.title ?? null,
      mode: p.data.mode ?? "image",
    },
  });
  res.status(201).json(session);
});

/** GET /gen/sessions/:id/generations — sessiya tarixi (paginatsiya + status filtri). */
studioGenRouter.get(
  "/gen/sessions/:id/generations",
  async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const session = await prisma.genSession.findUnique({ where: { id } });
    if (!session || session.userId !== req.user!.userId) {
      res.status(404).json({ error: "Session topilmadi" });
      return;
    }
    const perPage = Math.min(50, Math.max(1, Number(req.query.perPage) || 25));
    const page = Math.max(1, Number(req.query.cursor) || 1);
    const status = req.query.status ? String(req.query.status) : undefined;
    const where = { sessionId: id, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      prisma.generation.findMany({
        where,
        include: { assets: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.generation.count({ where }),
    ]);
    // Signed URL 1 soatda eskiradi — /gen/:jobId va /gen/history kabi qayta imzolaymiz
    // (aks holda tarix grid'idagi thumb/asset'lar 403 bo'ladi).
    if (isS3Configured()) {
      for (const g of items) {
        for (const a of g.assets) {
          if (a.resultKey) {
            const fresh = await getSignedDownloadUrl(a.resultKey, 3600);
            a.url = fresh;
            if (a.thumbUrl) a.thumbUrl = fresh;
          }
        }
      }
    }
    res.json({ items, page, perPage, total, hasMore: page * perPage < total });
  }
);

/** GET /gen/history — foydalanuvchining BARCHA tugagan gen'lari (sessiyalardan qat'i nazar). */
studioGenRouter.get("/gen/history", async (req: Request, res: Response) => {
  await cleanupExpiredSavedReferences(req.user!.userId).catch(() => {});
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));
  // ?mode=video → faqat shu turdagi gen'lar (video tool So'nggi gridi rasm gen'larni tortmasin).
  const modeRaw = req.query.mode ? String(req.query.mode) : "";
  const mode = (GEN_MODES as readonly string[]).includes(modeRaw) ? modeRaw : "";
  const items = await prisma.generation.findMany({
    where: { userId: req.user!.userId, status: "done", ...(mode ? { mode } : {}) },
    include: { assets: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  // Signed URL eskiradi — har asset uchun yangidan imzolaymiz.
  if (isS3Configured()) {
    for (const g of items) await hydrateGenAssets(g);
  }
  res.json({ items });
});

/** GET /gen/references — vaqtinchalik saved references (1 soat TTL). */
studioGenRouter.get("/gen/references", async (req: Request, res: Response) => {
  await cleanupExpiredSavedReferences(req.user!.userId).catch(() => {});
  const limit = Math.min(SAVED_REF_MAX_LIST, Math.max(1, Number(req.query.limit) || 12));
  const items = await prisma.savedReference.findMany({
    where: { userId: req.user!.userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  await hydrateSavedReferences(items);
  res.json({
    items: items.map((it) => ({
      id: it.id,
      kind: it.kind,
      url: it.url,
      thumbUrl: it.thumbUrl,
      contentType: it.contentType,
      sizeBytes: it.sizeBytes,
      expiresAt: it.expiresAt,
      generationId: it.generationId,
    })),
    ttlMs: SAVED_REF_TTL_MS,
  });
});

/** DELETE /gen/references/:id — saved reference'ni qo'lda o'chirish. */
studioGenRouter.delete("/gen/references/:id", async (req: Request, res: Response) => {
  const row = await prisma.savedReference.findUnique({ where: { id: String(req.params.id) } });
  if (!row || row.userId !== req.user!.userId) {
    res.status(404).json({ error: "Referens topilmadi" });
    return;
  }
  if (row.resultKey) {
    try {
      await deleteS3Objects([row.resultKey]);
    } catch (e) {
      console.error("[studio-gen] saved ref delete R2 xato:", e);
    }
  }
  await prisma.savedReference.delete({ where: { id: row.id } });
  res.json({ ok: true });
});

/** GET /gen/models?mode= — model katalog. */
studioGenRouter.get("/gen/models", (req: Request, res: Response) => {
  const mode = req.query.mode ? String(req.query.mode) : undefined;
  const base = mode ? getModelsByMode(mode) : GEN_MODELS;
  res.json({
    // refKind'ni HAR modelga qo'shamiz (So'nggi-grid "Referens" model-aware bo'lishi uchun).
    models: base.map((m) => ({ ...m, refKind: getRefKind(m) })),
    configured: isOpenRouterConfigured(),
  });
});

// params hajmi cheklanadi — z.record(z.any()) cheksiz; ulkan obyekt DB'ga yoziladi + har quote/gen'da
// hash qilinadi (DoS/storage-amplifikatsiya). Haqiqiy params (sozlama + referens URL'lar) ≪16KB.
const boundedParams = z
  .record(z.any())
  .refine((p) => {
    try { return JSON.stringify(p).length <= 16384; } catch { return false; }
  }, "params juda katta")
  .optional();

/** POST /gen/cost-quote — imzolangan narx (klient narxni soxtalashtira olmaydi). */
const quoteSchema = z.object({
  modelId: z.number().int(),
  mode: z.enum(GEN_MODES),
  params: boundedParams,
});

const preflightSchema = z.object({
  mode: z.enum(GEN_MODES),
  prompt: z.string().trim().min(2).max(5000),
  modelId: z.number().int().optional(),
  params: boundedParams.optional(),
});
studioGenRouter.post("/gen/cost-quote", (req: Request, res: Response) => {
  const p = quoteSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const model = getModelById(p.data.modelId);
  if (!isModelEnabled(model) || model.mode !== p.data.mode) {
    res.status(400).json({ error: "Noma'lum yoki o'chirilgan model" });
    return;
  }
  const params = (p.data.params ?? {}) as Record<string, unknown>;
  const price = computeGenCost(model, params); // video: cost(/s) × duration; boshqa: sobit
  const ph = genParamsHash(model.id, model.mode, params);
  const signature = signCostQuote({ modelId: model.id, mode: model.mode, price, ph });
  res.json({ modelId: model.id, price, signature, feature: model.feature });
});

/** POST /gen/preflight-safety — yuborishdan oldin tezkor safety tekshiruv. */
studioGenRouter.post("/gen/preflight-safety", async (req: Request, res: Response) => {
  const p = preflightSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const model = p.data.modelId ? getModelById(p.data.modelId) : null;
  const result = preflightSafetyCheck({
    mode: p.data.mode,
    prompt: p.data.prompt,
    params: (p.data.params ?? {}) as Record<string, unknown>,
    modelLabel: model?.label,
  });
  res.json(result);
});

/** POST /gen/ref-upload — referens rasm (data-URI) → R2 public URL. Plagin har referens qo'shganda
 *  darhol yuklaydi (spinner), so'ng /gen ga URL'lar TARTIBDA uzatiladi (image_urls). Kredit yechmaydi. */
const refUploadSchema = z.object({ dataUrl: z.string().min(16) });
const MAX_REF_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_REF_TARGET_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_REF_TARGET_BYTES = 15 * 1024 * 1024;
const refUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REF_UPLOAD_BYTES },
});
studioGenRouter.post("/gen/ref-upload", async (req: Request, res: Response) => {
  if (!isS3Configured()) {
    res.status(503).json({ error: "Saqlash sozlanmagan", code: "S3_NOT_CONFIGURED" });
    return;
  }
  await cleanupExpiredSavedReferences(req.user!.userId).catch(() => {});
  try {
    await new Promise<void>((resolve, reject) => {
      refUpload.single("file")(req as Parameters<ReturnType<typeof refUpload.single>>[0], res as Parameters<ReturnType<typeof refUpload.single>>[1], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Referens juda katta — 100MB dan kichikroq fayl tanlang", code: "PAYLOAD_TOO_LARGE" });
      return;
    }
    res.status(400).json({ error: "Referens faylini qabul qilib bo'lmadi" });
    return;
  }

  let contentType = "image/png";
  let buf: Buffer | null = null;
  const clipStartSec =
    typeof req.body?.clipStartSec === "string" ? Number(req.body.clipStartSec) : undefined;
  const clipEndSec =
    typeof req.body?.clipEndSec === "string" ? Number(req.body.clipEndSec) : undefined;
  const clipEnabled =
    req.body?.clipMode === "part" ||
    (Number.isFinite(clipStartSec) && Number.isFinite(clipEndSec) && (clipEndSec as number) > (clipStartSec as number));
  const extractAudioRef =
    req.body?.extractAudioRef === "1" ||
    req.body?.extractAudioRef === "true" ||
    req.body?.extractAudioRef === true;

  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
  if (uploadedFile?.buffer?.length) {
    contentType = uploadedFile.mimetype || contentType;
    buf = uploadedFile.buffer;
  } else {
    const p = refUploadSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
      return;
    }
    const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(p.data.dataUrl);
    if (!m) {
      res.status(400).json({ error: "data-URI yoki multipart fayl kerak" });
      return;
    }
    contentType = m[1] || contentType;
    buf = Buffer.from(m[2], "base64");
  }

  // R2V ko'p-modal: rasm + video + ovoz referens qabul qilinadi (Seedance R2V). Boshqa modellar faqat rasm yuboradi.
  if (!/^(image|video|audio)\//.test(contentType)) {
    res.status(400).json({ error: "Faqat rasm/video/ovoz referens qabul qilinadi" });
    return;
  }
  if (!buf?.length || buf.length > MAX_REF_UPLOAD_BYTES) {
    res.status(400).json({ error: "Referens bo'sh yoki juda katta (maks 100MB)" });
    return;
  }
  let audioRef:
    | {
        id: string;
        url: string;
        bytes: number;
        contentType: string;
        expiresAt: string;
      }
    | undefined;
  let audioError: string | undefined;
  if (/^video\//.test(contentType) && uploadedFile?.buffer?.length) {
    let tmpDir: string | null = null;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_vref_"));
      const ext = path.extname(uploadedFile.originalname || "") || ".mp4";
      const sourcePath = path.join(tmpDir, `source${ext}`);
      const localPath = path.join(tmpDir, `ref${ext}`);
      fs.writeFileSync(sourcePath, uploadedFile.buffer);
      fs.copyFileSync(sourcePath, localPath);
      const optimized = await optimizeVideoReferenceForUpload(
        localPath,
        clipEnabled ? { startSec: clipStartSec, endSec: clipEndSec } : undefined
      );
      if (!optimized) {
        res.status(500).json({ error: "Video referens serverda optimizatsiya qilinmadi" });
        return;
      }
      const out = fs.readFileSync(localPath);
      if (!out.length) {
        res.status(500).json({ error: "Video referens optimizatsiyadan keyin bo'sh qoldi" });
        return;
      }
      if (out.length > MAX_VIDEO_REF_TARGET_BYTES) {
        res.status(413).json({
          error: "Video referens optimizatsiyadan keyin ham 50MB dan katta — qisqaroq joy tanlang",
          code: "VIDEO_REF_STILL_TOO_LARGE",
        });
        return;
      }
      buf = out;
      contentType = "video/mp4";
      if (extractAudioRef) {
        const audioPath = path.join(tmpDir, "ref-audio.mp3");
        const audioOk = await extractAudioReferenceForUpload(
          sourcePath,
          audioPath,
          clipEnabled ? { startSec: clipStartSec, endSec: clipEndSec } : undefined
        );
        if (audioOk) {
          const audioBuf = fs.readFileSync(audioPath);
          if (audioBuf.length > 0 && audioBuf.length <= MAX_AUDIO_REF_TARGET_BYTES) {
            const audioKey = `gen-refs/${req.user!.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
            await uploadBufferToS3(audioBuf, audioKey, "audio/mpeg");
            const audioUrl = await getPublicOrSignedUrl(audioKey, 7200);
            const audioSaved = await createSavedReference({
              userId: req.user!.userId,
              url: audioUrl,
              resultKey: audioKey,
              contentType: "audio/mpeg",
              sizeBytes: audioBuf.length,
            });
            audioRef = {
              id: audioSaved.id,
              url: audioUrl,
              bytes: audioBuf.length,
              contentType: "audio/mpeg",
              expiresAt: audioSaved.expiresAt,
            };
          } else if (audioBuf.length > MAX_AUDIO_REF_TARGET_BYTES) {
            audioError = "Video ichidagi audio referens 15MB limitdan oshdi";
          } else {
            audioError = "Video ichidan audio olinmadi";
          }
        } else {
          audioError = "Videoda ishlatiladigan audio topilmadi yoki ajratib bo'lmadi";
        }
      }
    } finally {
      if (tmpDir) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          /* */
        }
      }
    }
  }
  const EXT: Record<string, string> = {
    "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/aac": "aac",
  };
  const ext =
    EXT[contentType] ||
    (contentType.startsWith("video/") ? "mp4" : contentType.startsWith("audio/") ? "mp3" : "png");
  const key = `gen-refs/${req.user!.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await uploadBufferToS3(buf, key, contentType);
  const url = await getPublicOrSignedUrl(key, 7200); // PUBLIC (fal auth'siz yuklab oladi)
  const saved = await createSavedReference({
    userId: req.user!.userId,
    url,
    resultKey: key,
    contentType,
    sizeBytes: buf.length,
    thumbUrl: contentType.startsWith("image/") ? url : null,
  });
  res.json({ id: saved.id, url, bytes: buf.length, contentType, expiresAt: saved.expiresAt, audioRef, audioError });
});

/** POST /gen — imzoni tekshiradi → kredit zaxira → queued Generation → {jobId}. */
const genSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum(GEN_MODES),
  prompt: z.string().trim().min(2, "Prompt juda qisqa").max(5000, "Prompt juda uzun (maks 5000 belgi)"),
  modelId: z.number().int(),
  params: boundedParams,
  price: z.number().int().nonnegative(),
  costQuoteSignature: z.string().min(10),
});
studioGenRouter.post("/gen", async (req: Request, res: Response) => {
  await cleanupExpiredSavedReferences(req.user!.userId).catch(() => {});
  const p = genSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const { sessionId, mode, prompt, modelId, price, costQuoteSignature } = p.data;
  const params = (p.data.params ?? {}) as Record<string, unknown>;

  // Qotib qolgan oldingi job'larni tiklash (yangi gen'dan oldin yo'qolган kredit qaytadi).
  await reconcileStuckGenerations(req.user!.userId).catch(() => {});

  const session = await prisma.genSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== req.user!.userId) {
    res.status(404).json({ error: "Session topilmadi" });
    return;
  }
  // Model JONLILIK guard — generatsiyadan OLDIN (kredit yechilmasin).
  const model = getModelById(modelId);
  if (!isModelEnabled(model) || model.mode !== mode) {
    res.status(400).json({ error: "Noma'lum yoki o'chirilgan model" });
    return;
  }
  // Provayder-asosli sozlama tekshiruvi (sfx → ElevenLabs; fal → FAL_KEY; aks holda OpenRouter).
  const configured =
    model.provider === "elevenlabs"
      ? isElevenLabsConfigured()
      : model.provider === "fal"
        ? isFalConfigured()
        : isOpenRouterConfigured();
  if (!configured) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }

  // Reference validatsiyasi (G2) — KREDITDAN OLDIN. Reference biriktirilgan, lekin model
  // qabul qilmasa: aniq xato + qo'llaydigan model tavsiyasi (kredit yechilmaydi).
  const refList = Array.isArray(params.referenceUrls) ? params.referenceUrls : [];
  const hasRef =
    (typeof params.referenceUrl === "string" && params.referenceUrl.length > 0) || refList.length > 0;
  // refMode='required' — referenssiz gen bloklanadi (KREDITDAN OLDIN; aniq xato).
  if (model.refMode === "required" && !hasRef) {
    res.status(400).json({
      error: `«${model.label}» uchun referens majburiy — kamida 1 ta rasm qo'shing`,
      code: "REFERENCE_REQUIRED",
    });
    return;
  }
  if (hasRef && !modelAcceptsReference(model)) {
    const rec = firstReferenceModel(mode);
    res.status(400).json({
      error: rec
        ? `«${model.label}» reference qabul qilmaydi — «${rec.label}» modelini tanlang`
        : `«${model.label}» reference qabul qilmaydi`,
      code: "REFERENCE_NOT_SUPPORTED",
      referenceMode: getReferenceMode(model),
      recommendedModelId: rec?.id ?? null,
    });
    return;
  }

  const preflight = preflightSafetyCheck({
    mode,
    prompt,
    params,
    modelLabel: model.label,
  });
  if (preflight.blocked) {
    res.status(400).json({
      error: preflight.reason || "Prompt safety tekshiruvdan o'tmadi",
      code: "PREFLIGHT_BLOCKED",
      severity: preflight.severity,
      suggestions: preflight.suggestions,
    });
    return;
  }

  // Imzolangan narxni tekshir — klient `price`ni soxtalashtira olmaydi (blueprint §7.3).
  const ph = genParamsHash(modelId, mode, params);
  const v = verifyCostQuote(costQuoteSignature, { modelId, mode, price, ph });
  if (!v.ok) {
    res.status(400).json({ error: v.reason || "Narx imzosi yaroqsiz", code: "BAD_QUOTE" });
    return;
  }

  // Kredit zaxiraga olinadi (atomik). failed bo'lsa 1c qaytaradi.
  const gate = await consumeAiCredits(req.user!.userId, price);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }

  const gen = await prisma.generation.create({
    data: {
      sessionId,
      userId: req.user!.userId,
      mode,
      prompt,
      modelId,
      params: params as object,
      status: "queued",
      cost: price,
    },
  });

  const refUrls = Array.from(
    new Set(
      [
        typeof params.referenceUrl === "string" ? params.referenceUrl : "",
        typeof params.referenceEndUrl === "string" ? params.referenceEndUrl : "",
        ...(Array.isArray(params.referenceUrls) ? params.referenceUrls : []),
        ...(Array.isArray(params.imageUrls) ? params.imageUrls : []),
        ...(Array.isArray(params.videoUrls) ? params.videoUrls : []),
        ...(Array.isArray(params.audioUrls) ? params.audioUrls : []),
      ].filter((u): u is string => typeof u === "string" && u.length > 7)
    )
  );
  const savedRefIds = Array.from(
    new Set(
      (Array.isArray(params.savedReferenceIds) ? params.savedReferenceIds : []).filter(
        (id): id is string => typeof id === "string" && id.length > 7
      )
    )
  );
  await touchSavedReferences(req.user!.userId, { ids: savedRefIds, urls: refUrls }, gen.id).catch(() => {});

  // Fon rejimida bajariladi (OpenRouter → R2 → GenAsset → status); frontend polling qiladi.
  processGenerationInBackground(gen.id);
  res.status(202).json({ jobId: gen.id, status: gen.status, creditsLeft: gate.remaining });
});

/**
 * POST /gen/prompt/enhance — promptni OpenRouter/fal bilan boyitadi (dinamik kredit + kunlik cap).
 *  format:"text" → bitta boy paragraf; format:"json" → strukturalangan prompt sxemasi.
 *  modelId berilsa — tanlangan model konteksti (duration/aspect/audio) promptga moslanadi.
 */
const ENHANCE_PROMPT_MAX = 1999;
const enhanceSchema = z.object({
  prompt: z.string().trim().min(2).max(5000),
  mode: z.enum(GEN_MODES).optional(),
  modelId: z.number().int().optional(),
  format: z.enum(["text", "json"]).optional(),
  // VISION enhance — referens rasm PUBLIC URL'lari (@img tartibida: [0]=@img1). Ixtiyoriy.
  image_urls: z.array(z.string().min(8)).max(10).optional(),
  // VIDEO enhance — referens video PUBLIC URL'lari (@video tartibida: [0]=@video1). Ixtiyoriy.
  video_urls: z.array(z.string().min(8)).max(10).optional(),
  // AUDIO enhance — referens audio PUBLIC URL'lari (@audio tartibida: [0]=@audio1). Ixtiyoriy.
  audio_urls: z.array(z.string().min(8)).max(10).optional(),
  references: z.array(z.string().min(8)).max(10).optional(),
});

/** Rejimga qarab JSON prompt sxemasi (LLM shu shaklda qaytaradi). */
function enhanceJsonSchema(mode: string): string {
  if (mode === "voice") {
    return `{"prompt": string (the spoken script, cleaned), "tone": string, "pace": string, "emphasis": string}`;
  }
  if (mode === "sfx") {
    return `{"prompt": string, "sound": string, "environment": string, "intensity": string, "duration_hint": string}`;
  }
  // image | video | music → kinematografik sxema (Magnific uslubi)
  return (
    `{"prompt": string, "subject": string, "environment": string, "style": string, ` +
    `"lighting": string, "camera": {"angle": string, "distance": string, "depth_of_field": string, "focus": string}, ` +
    `"composition": {"framing": string, "foreground": string, "background": string, "negative_space": string}, ` +
    `"mood": string, "color_palette": string[], "technical": {"render_type": string}}`
  );
}

studioGenRouter.post("/gen/prompt/enhance", async (req: Request, res: Response) => {
  // text → fal (openrouter/router); json (describe) → OpenRouter. Ikkalasidan biri sozlangan bo'lsa OK.
  if (!isFalConfigured() && !isOpenRouterConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const p = enhanceSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const mode = p.data.mode || "image";
  const format = p.data.format || "text";

  // Model-aware kontekst (Magnific `extra_params` uslubi — promptni tanlangan modelga moslaydi).
  const model = p.data.modelId ? getModelById(p.data.modelId) : undefined;
  const ctxParts: string[] = [];
  if (model) {
    ctxParts.push(`target model: ${model.label}`);
    if (model.durations?.length) ctxParts.push(`duration options (sec): ${model.durations.join(", ")}`);
    if (model.aspects?.length) ctxParts.push(`aspect ratios: ${model.aspects.join(", ")}`);
    if (model.resolutions?.length) ctxParts.push(`resolution/quality: ${model.resolutions.join(", ")}`);
    if (typeof model.audio === "boolean") ctxParts.push(`native audio: ${model.audio ? "yes" : "no"}`);
  }
  const ctx = ctxParts.length
    ? `\nGeneration context — tailor the prompt to it: ${ctxParts.join("; ")}.`
    : "";
  const keepRefs =
    " Preserve any @img / @image / @video / @audio references verbatim (do not rename or remove them).";
  // Abuza nazorati + kredit (pulli gpt-4o-mini chaqiruvi) — /gen naqshi.
  if (!withinDailyCap(req.user!.userId)) {
    res.status(429).json({
      error: "Kunlik AI-yordam limiti tugadi — ertaga qayta urinib ko'ring",
      code: "DAILY_CAP_REACHED",
    });
    return;
  }
  const refUrls = publicUrls(p.data.image_urls || p.data.references);
  const videoRefUrls = publicUrls(p.data.video_urls);
  const audioRefUrls = publicUrls(p.data.audio_urls);
  const enhanceCost = computeEnhanceCost({
    imageUrls: refUrls,
    videoUrls: videoRefUrls,
    audioUrls: audioRefUrls,
  });
  const gate = await consumeAiCredits(req.user!.userId, enhanceCost.cost);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }
  const spendModels = [
    enhanceCost.hasImage ? "openrouter/router/vision" : "",
    enhanceCost.hasVideo ? "fal-ai/video-understanding" : "",
    enhanceCost.hasAudio ? "nvidia/nemotron-3-nano-omni/audio" : "",
    "openrouter/router",
  ].filter(Boolean);
  const spendModel = Array.from(new Set(spendModels)).join(" + ");
  logAiSpend(req.user!.userId, "enhance", enhanceCost.cost, spendModel);

  if (format === "json") {
    let ideaForJson = p.data.prompt;
    if (refUrls.length || videoRefUrls.length || audioRefUrls.length) {
      const enhanced = await falEnhancePrompt(p.data.prompt, {
        imageUrls: refUrls.length ? refUrls : undefined,
        videoUrls: videoRefUrls.length ? videoRefUrls : undefined,
        audioUrls: audioRefUrls.length ? audioRefUrls : undefined,
        mode,
        modelContext: ctx.replace(/^\s+/, ""),
      });
      if (!enhanced.ok) {
        await refundAiCredits(req.user!.userId, enhanceCost.cost);
        res.status(502).json({ error: enhanced.error });
        return;
      }
      ideaForJson = enhanced.data.trim();
    }
    const system =
      `You are an expert ${mode} prompt engineer for AI generation. Rewrite the user's idea into a ` +
      `rich, production-quality prompt and return it ONLY as a JSON object matching exactly this schema:\n` +
      `${enhanceJsonSchema(mode)}\n` +
      `Be concrete and cinematic. No markdown, no commentary. The "prompt" field must be a ` +
      `self-contained paragraph under ${ENHANCE_PROMPT_MAX} characters.${keepRefs}${ctx}`;
    const out = await orChatSys("openai/gpt-4o-mini", system, `Idea: ${ideaForJson}`, true);
    if (!out.ok) {
      await refundAiCredits(req.user!.userId, enhanceCost.cost);
      res.status(502).json({ error: out.error });
      return;
    }
    let json: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(out.data) as unknown;
      if (parsed && typeof parsed === "object") json = parsed as Record<string, unknown>;
    } catch {
      /* ignore — pastda 502 */
    }
    if (!json) {
      await refundAiCredits(req.user!.userId, enhanceCost.cost);
      res.status(502).json({ error: "JSON prompt olinmadi — qayta urinib ko'ring" });
      return;
    }
    const promptStr = typeof json.prompt === "string" ? json.prompt : p.data.prompt;
    res.json({ prompt: promptStr, json, creditsLeft: gate.remaining, creditsCharged: enhanceCost.cost });
    return;
  }

  // text — universal multimodal oqim: image/video/audio avval tahlil qilinadi, keyin final prompt yig'iladi.
  const out = await falEnhancePrompt(p.data.prompt, {
    imageUrls: refUrls.length ? refUrls : undefined,
    videoUrls: videoRefUrls.length ? videoRefUrls : undefined,
    audioUrls: audioRefUrls.length ? audioRefUrls : undefined,
    mode,
    modelContext: ctx.replace(/^\s+/, ""),
  });
  if (!out.ok) {
    await refundAiCredits(req.user!.userId, enhanceCost.cost);
    res.status(502).json({ error: out.error });
    return;
  }
  res.json({ prompt: out.data.trim(), creditsLeft: gate.remaining, creditsCharged: enhanceCost.cost });
});

/**
 * POST /gen/describe — Image/Video-to-Prompt (REVERSE): rasm yoki video kadr(lar)dan
 * generatsiya prompti yozadi (rasm 2 / video 3 kredit + kunlik cap). Vision model: gemini-2.5-flash
 * (/endpoints tasdiqlangan: image+video input, text out — 2026-06-18). Video → frontend
 * 1-3 kadr ajratadi va shu kadrlar yuboriladi (harakat ham tavsiflanadi).
 * Auth + rate-limit (40/min) router'dan meros; max 3 rasm + max_tokens 400 — uzunlik cheklovi.
 */
const VISION_MODEL = "google/gemini-2.5-flash";
const describeSchema = z.object({
  images: z.array(z.string().min(8)).min(1).max(8), // data-URI yoki URL (video kadr fallback)
  kind: z.enum(["image", "video"]).optional(),
  durationSec: z.number().positive().max(600).optional(), // video TIMELINE oralig'i
  frameTimes: z.array(z.number().nonnegative()).max(8).optional(), // har kadr vaqt belgisi (soniya)
  videoUrl: z.string().min(8).max(16_000_000).optional(), // H1: HAQIQIY video (base64 data-URL/URL)
});
studioGenRouter.post("/gen/describe", async (req: Request, res: Response) => {
  if (!isOpenRouterConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const p = describeSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  // Uzunlik cheklovi — har rasm ~1024px JPEG (frontend downscale). 1.4MB string ≈ ~1MB rasm.
  if (p.data.images.some((s) => s.length > 1_400_000)) {
    res.status(413).json({ error: "Reference rasm juda katta — kichikroq kadr tanlang" });
    return;
  }
  const kind = p.data.kind || "image";
  // Vision narxi matn-onlydan (enhance) yuqori; haqiqiy video input qimmatroq.
  const hasVideo = kind === "video" && typeof p.data.videoUrl === "string" && p.data.videoUrl.length > 0;
  const cost = hasVideo ? DESCRIBE_VIDEO_COST : DESCRIBE_IMAGE_COST;

  // Abuza nazorati + kredit (pulli gemini-2.5-flash vision) — /gen naqshi.
  if (!withinDailyCap(req.user!.userId)) {
    res.status(429).json({
      error: "Kunlik AI-yordam limiti tugadi — ertaga qayta urinib ko'ring",
      code: "DAILY_CAP_REACHED",
    });
    return;
  }
  const gate = await consumeAiCredits(req.user!.userId, cost);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }
  logAiSpend(req.user!.userId, "describe", cost, VISION_MODEL);

  // H1: video bo'lsa AVVAL haqiqiy videoni yuboramiz (gemini-2.5-flash video input).
  // Xato/rad bo'lsa — kadr (8-frame) FALLBACK (G5.2) bilan qayta urinamiz.
  let out = await orImageToPrompt(
    VISION_MODEL,
    p.data.images,
    kind,
    p.data.durationSec,
    p.data.frameTimes,
    kind === "video" ? p.data.videoUrl : undefined
  );
  if (!out.ok && kind === "video" && p.data.videoUrl && p.data.images.length) {
    out = await orImageToPrompt(
      VISION_MODEL,
      p.data.images,
      kind,
      p.data.durationSec,
      p.data.frameTimes
    );
  }
  if (!out.ok) {
    await refundAiCredits(req.user!.userId, cost);
    res.status(502).json({ error: out.error });
    return;
  }
  res.json({ prompt: out.data });
});

/** GET /gen/:jobId — job holati (polling). MUHIM: aniq yo'llardan KEYIN ro'yxatdan o'tadi. */
studioGenRouter.get("/gen/:jobId", async (req: Request, res: Response) => {
  const gen = await prisma.generation.findUnique({
    where: { id: String(req.params.jobId) },
    include: { assets: true },
  });
  if (!gen || gen.userId !== req.user!.userId) {
    res.status(404).json({ error: "Generatsiya topilmadi" });
    return;
  }
  if (gen.status === "queued" || gen.status === "running") {
    processGenerationInBackground(gen.id);
  }
  // Signed URL 1 soatda eskiradi — resultKey bo'lsa har so'rovda yangidan imzolaymiz.
  await hydrateGenAssets(gen);
  res.json(gen);
});

/** DELETE /gen/:jobId — gen natijani o'chiradi (R2 obyektlari ham). Faqat egasi. */
studioGenRouter.delete("/gen/:jobId", async (req: Request, res: Response) => {
  const gen = await prisma.generation.findUnique({
    where: { id: String(req.params.jobId) },
    include: { assets: true },
  });
  if (!gen || gen.userId !== req.user!.userId) {
    res.status(404).json({ error: "Generatsiya topilmadi" });
    return;
  }
  // Avval R2'dan asset fayllarni o'chiramiz (resultKey bor bo'lsa).
  const keys = gen.assets
    .map((a) => a.resultKey)
    .filter((k): k is string => typeof k === "string" && k.length > 0);
  let r2deleted = 0;
  if (keys.length) {
    try {
      r2deleted = await deleteS3Objects(keys);
    } catch (e) {
      console.error("[studio-gen] R2 delete xato:", e);
    }
  }
  // So'ng DB: assets → generation (FK tartibi).
  await prisma.genAsset.deleteMany({ where: { generationId: gen.id } });
  await prisma.generation.delete({ where: { id: gen.id } });
  res.json({ ok: true, r2deleted });
});
