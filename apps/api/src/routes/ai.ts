import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  AiGenerationStatus,
  AiGenerationType,
  prisma,
} from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { consumeAiCredits, refundAiCredits } from "../lib/plugin-profile.js";
import {
  isAiConfigured,
  aiGenerateImage,
  aiGenerateSpeech,
  aiEmbed,
  detectMediaFormat,
} from "../lib/ai/workers-ai.js";
import {
  isS3Configured,
  uploadBufferToS3,
  getSignedDownloadUrl,
} from "../lib/s3.js";
import { backfillEmbeddings, cosineSimilarity } from "../lib/ai/embed-templates.js";
import { TemplateReviewStatus } from "@creative-tools/database";

export const aiRouter = Router();

/** Kredit narxi har tool uchun (server-tomonda — frontend o'zgartira olmaydi). */
export const AI_COST = {
  image: 5,
  voiceover: 3,
  sfx: 4,
  search: 1,
} as const;
type AiToolKey = keyof typeof AI_COST;

// AI qimmat provayder — har foydalanuvchi (IP) uchun rate-limit
aiRouter.use(
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 20,
    keyPrefix: "plugin-ai",
    message: "Juda ko'p AI so'rovi — bir daqiqadan keyin qayta urinib ko'ring",
  })
);

/** Natijani saqlash: R2 bo'lsa signed URL, aks holda (lokal dev) data URL. */
async function persistResult(
  buf: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (isS3Configured()) {
    await uploadBufferToS3(buf, key, contentType);
    return getSignedDownloadUrl(key, 3600);
  }
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function tsName() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** POST /estimate — kredit narxi (kalit shart emas, faqat auth). */
aiRouter.post("/estimate", (req: Request, res: Response) => {
  const type = String(req.body?.type || "").toLowerCase() as AiToolKey;
  const credits = AI_COST[type];
  if (credits === undefined) {
    res.status(400).json({ error: "Noma'lum AI tool turi" });
    return;
  }
  res.json({ type, credits, configured: isAiConfigured() });
});

const imageSchema = z.object({
  prompt: z.string().trim().min(3, "Prompt juda qisqa").max(2000),
});

/** POST /image — Text-to-Image → R2 → signed URL. */
aiRouter.post("/image", async (req: Request, res: Response) => {
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const parsed = imageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const { prompt } = parsed.data;
  const userId = req.user!.userId;
  const cost = AI_COST.image;

  const gate = await consumeAiCredits(userId, cost);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }

  const out = await aiGenerateImage(prompt);
  if (!out.ok) {
    await refundAiCredits(userId, cost);
    await prisma.aiGeneration.create({
      data: { userId, type: AiGenerationType.IMAGE, prompt, credits: 0, status: AiGenerationStatus.FAILED },
    });
    res.status(502).json({ error: out.error });
    return;
  }

  // Haqiqiy format magic-byte'dan (flux JPEG/PNG qaytarishi mumkin) — kengaytma+CT mos bo'lsin.
  const fmt = detectMediaFormat(out.data, { ext: "png", contentType: "image/png" });
  const key = `ai/img/${userId}/${tsName()}.${fmt.ext}`;
  const url = await persistResult(out.data, key, fmt.contentType);
  await prisma.aiGeneration.create({
    data: {
      userId,
      type: AiGenerationType.IMAGE,
      prompt,
      resultKey: isS3Configured() ? key : null,
      credits: cost,
      status: AiGenerationStatus.DONE,
    },
  });
  res.json({ url, ext: fmt.ext, contentType: fmt.contentType, creditsLeft: gate.remaining });
});

const voiceSchema = z.object({
  text: z.string().trim().min(2, "Matn juda qisqa").max(5000),
  lang: z.string().trim().max(12).optional(),
});

/** POST /voiceover — Text-to-Speech → R2 → signed URL. */
aiRouter.post("/voiceover", async (req: Request, res: Response) => {
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const parsed = voiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const { text, lang } = parsed.data;
  const userId = req.user!.userId;
  const cost = AI_COST.voiceover;

  const gate = await consumeAiCredits(userId, cost);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }

  const out = await aiGenerateSpeech(text, lang || "en");
  if (!out.ok) {
    await refundAiCredits(userId, cost);
    await prisma.aiGeneration.create({
      data: { userId, type: AiGenerationType.VOICEOVER, prompt: text, credits: 0, status: AiGenerationStatus.FAILED },
    });
    res.status(502).json({ error: out.error });
    return;
  }

  const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
  const key = `ai/voice/${userId}/${tsName()}.${fmt.ext}`;
  const url = await persistResult(out.data, key, fmt.contentType);
  await prisma.aiGeneration.create({
    data: {
      userId,
      type: AiGenerationType.VOICEOVER,
      prompt: text,
      resultKey: isS3Configured() ? key : null,
      credits: cost,
      status: AiGenerationStatus.DONE,
    },
  });
  res.json({ url, ext: fmt.ext, contentType: fmt.contentType, creditsLeft: gate.remaining });
});

const searchSchema = z.object({
  query: z.string().trim().min(2, "So'rov juda qisqa").max(500),
});

const SEARCH_TOP_N = 12;

/**
 * POST /search — semantik katalog qidiruv. Query → embedding → katalogdagi
 * shablon embeddinglari bilan cosine similarity → eng mos top-N (ranked).
 * Embedding'i yo'q shablonlar tashlab ketiladi (reindex kerak).
 */
aiRouter.post("/search", async (req: Request, res: Response) => {
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const { query } = parsed.data;
  const userId = req.user!.userId;
  const cost = AI_COST.search;

  const gate = await consumeAiCredits(userId, cost);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }

  const out = await aiEmbed(query);
  if (!out.ok) {
    await refundAiCredits(userId, cost);
    res.status(502).json({ error: out.error });
    return;
  }
  const qvec = out.data;

  const rows = await prisma.contributorTemplate.findMany({
    where: {
      reviewStatus: TemplateReviewStatus.APPROVED,
      published: true,
    },
    select: { id: true, name: true, catLabel: true, nav: true, embedding: true },
  });

  const results = rows
    .filter((r) => Array.isArray(r.embedding) && (r.embedding as number[]).length > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      catLabel: r.catLabel,
      nav: r.nav,
      score: cosineSimilarity(qvec, r.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_TOP_N);

  const indexed = rows.filter((r) => Array.isArray(r.embedding)).length;

  await prisma.aiGeneration.create({
    data: { userId, type: AiGenerationType.SEARCH, prompt: query, credits: cost, status: AiGenerationStatus.DONE },
  });
  res.json({
    query,
    embeddingDims: qvec.length,
    indexed,
    total: rows.length,
    results,
    creditsLeft: gate.remaining,
  });
});

/**
 * POST /reindex — APPROVED+published shablonlarga embedding backfill (ADMIN).
 * body.force=true → barchasini qayta hisoblaydi.
 */
aiRouter.post("/reindex", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Admin huquqi kerak" });
    return;
  }
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const force = req.body?.force === true;
  const r = await backfillEmbeddings({ force });
  res.json({ ok: true, ...r });
});
