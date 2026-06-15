import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { consumeAiCredits, ensurePluginProfile } from "../lib/plugin-profile.js";
import { isOpenRouterConfigured, orChat } from "../lib/ai/openrouter.js";
import { isElevenLabsConfigured } from "../lib/ai/elevenlabs.js";
import { isS3Configured, getSignedDownloadUrl, deleteS3Objects } from "../lib/s3.js";
import {
  GEN_MODELS,
  getModelsByMode,
  getModelById,
  isModelEnabled,
  computeGenCost,
} from "../lib/gen-models.js";
import { signCostQuote, verifyCostQuote, genParamsHash } from "../lib/gen-quote.js";
import {
  processGenerationInBackground,
  reconcileStuckGenerations,
} from "../lib/gen-processor.js";

export const studioGenRouter = Router();

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

/** GET /credits — kredit balansi. */
studioGenRouter.get("/credits", async (req: Request, res: Response) => {
  // Qotib qolgan job'larni tiklash → yo'qolган kredit qaytadi (panel ochilганда).
  await reconcileStuckGenerations(req.user!.userId).catch(() => {});
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
    res.json({ items, page, perPage, total, hasMore: page * perPage < total });
  }
);

/** GET /gen/history — foydalanuvchining BARCHA tugagan gen'lari (sessiyalardan qat'i nazar). */
studioGenRouter.get("/gen/history", async (req: Request, res: Response) => {
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));
  const items = await prisma.generation.findMany({
    where: { userId: req.user!.userId, status: "done" },
    include: { assets: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  // Signed URL eskiradi — har asset uchun yangidan imzolaymiz.
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
  res.json({ items });
});

/** GET /gen/models?mode= — model katalog. */
studioGenRouter.get("/gen/models", (req: Request, res: Response) => {
  const mode = req.query.mode ? String(req.query.mode) : undefined;
  res.json({
    models: mode ? getModelsByMode(mode) : GEN_MODELS,
    configured: isOpenRouterConfigured(),
  });
});

/** POST /gen/cost-quote — imzolangan narx (klient narxni soxtalashtira olmaydi). */
const quoteSchema = z.object({
  modelId: z.number().int(),
  mode: z.enum(GEN_MODES),
  params: z.record(z.any()).optional(),
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

/** POST /gen — imzoni tekshiradi → kredit zaxira → queued Generation → {jobId}. */
const genSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum(GEN_MODES),
  prompt: z.string().trim().min(2, "Prompt juda qisqa").max(5000, "Prompt juda uzun (maks 5000 belgi)"),
  modelId: z.number().int(),
  params: z.record(z.any()).optional(),
  price: z.number().int().nonnegative(),
  costQuoteSignature: z.string().min(10),
});
studioGenRouter.post("/gen", async (req: Request, res: Response) => {
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
  // Provayder-asosli sozlama tekshiruvi (sfx → ElevenLabs; aks holda OpenRouter).
  const configured =
    model.provider === "elevenlabs" ? isElevenLabsConfigured() : isOpenRouterConfigured();
  if (!configured) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
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

  // Fon rejimida bajariladi (OpenRouter → R2 → GenAsset → status); frontend polling qiladi.
  processGenerationInBackground(gen.id);
  res.status(202).json({ jobId: gen.id, status: gen.status, creditsLeft: gate.remaining });
});

/** POST /gen/prompt/enhance — promptni OpenRouter (text) bilan boyitadi (kreditsiz). */
const enhanceSchema = z.object({
  prompt: z.string().trim().min(2).max(5000),
  mode: z.enum(GEN_MODES).optional(),
});
studioGenRouter.post("/gen/prompt/enhance", async (req: Request, res: Response) => {
  if (!isOpenRouterConfigured()) {
    res.status(503).json({ error: "AI sozlanmagan", code: "AI_NOT_CONFIGURED" });
    return;
  }
  const p = enhanceSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const mode = p.data.mode || "image";
  const instruction =
    `You enrich a short ${mode} generation prompt into a vivid, detailed prompt. ` +
    `Return ONLY the improved prompt, no preamble, one paragraph.`;
  const out = await orChat(
    "openai/gpt-4o-mini",
    `${instruction}\n\nPrompt: ${p.data.prompt}`
  );
  if (!out.ok) {
    res.status(502).json({ error: out.error });
    return;
  }
  res.json({ prompt: out.data.trim() });
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
  // Signed URL 1 soatda eskiradi — resultKey bo'lsa har so'rovda yangidan imzolaymiz.
  if (isS3Configured()) {
    for (const a of gen.assets) {
      if (a.resultKey) {
        const fresh = await getSignedDownloadUrl(a.resultKey, 3600);
        a.url = fresh;
        if (a.thumbUrl) a.thumbUrl = fresh;
      }
    }
  }
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
