import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { consumeAiCredits, refundAiCredits, ensurePluginProfile } from "../lib/plugin-profile.js";
import { isOpenRouterConfigured, orChatSys, orImageToPrompt } from "../lib/ai/openrouter.js";
import { isElevenLabsConfigured } from "../lib/ai/elevenlabs.js";
import { isFalConfigured, falEnhancePrompt } from "../lib/ai/fal.js";
import {
  isS3Configured,
  getSignedDownloadUrl,
  deleteS3Objects,
  uploadBufferToS3,
  getPublicOrSignedUrl,
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

// ── AI-helper (describe/enhance) narx + abuza nazorati ───────────────────────
// Bu ikki endpoint pulli model chaqiradi (gpt-4o-mini / gemini-2.5-flash vision),
// shu sabab /gen kabi consumeAiCredits bilan himoyalanadi. Narxlar /gen jadvaliga
// nisbatan arzon (helper), lekin vision (rasm/video) matn-onlydan QIMMATROQ.
const ENHANCE_COST = 1;          // gpt-4o-mini matn/JSON — bitta chaqiruv
const DESCRIBE_IMAGE_COST = 2;   // gemini-2.5-flash vision (rasm)
const DESCRIBE_VIDEO_COST = 3;   // + haqiqiy video input (og'irroq, ehtimoliy 2-inference)

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

/** POST /gen/ref-upload — referens rasm (data-URI) → R2 public URL. Plagin har referens qo'shganda
 *  darhol yuklaydi (spinner), so'ng /gen ga URL'lar TARTIBDA uzatiladi (image_urls). Kredit yechmaydi. */
const refUploadSchema = z.object({ dataUrl: z.string().min(16) });
studioGenRouter.post("/gen/ref-upload", async (req: Request, res: Response) => {
  if (!isS3Configured()) {
    res.status(503).json({ error: "Saqlash sozlanmagan", code: "S3_NOT_CONFIGURED" });
    return;
  }
  const p = refUploadSchema.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.issues[0]?.message || "Noto'g'ri so'rov" });
    return;
  }
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(p.data.dataUrl);
  if (!m) {
    res.status(400).json({ error: "data-URI (base64 rasm) kerak" });
    return;
  }
  const contentType = m[1] || "image/png";
  if (!/^image\//.test(contentType)) {
    res.status(400).json({ error: "Faqat rasm referens qabul qilinadi" });
    return;
  }
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > 25 * 1024 * 1024) {
    res.status(400).json({ error: "Rasm bo'sh yoki juda katta (maks 25MB)" });
    return;
  }
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : "png";
  const key = `gen-refs/${req.user!.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await uploadBufferToS3(buf, key, contentType);
  const url = await getPublicOrSignedUrl(key, 7200); // PUBLIC (fal auth'siz yuklab oladi)
  res.json({ url });
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

/**
 * POST /gen/prompt/enhance — promptni OpenRouter bilan boyitadi (1 kredit + kunlik cap).
 *  format:"text" → bitta boy paragraf; format:"json" → strukturalangan prompt sxemasi.
 *  modelId berilsa — tanlangan model konteksti (duration/aspect/audio) promptga moslanadi.
 */
const ENHANCE_PROMPT_MAX = 1999;
const enhanceSchema = z.object({
  prompt: z.string().trim().min(2).max(5000),
  mode: z.enum(GEN_MODES).optional(),
  modelId: z.number().int().optional(),
  format: z.enum(["text", "json"]).optional(),
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
    " Preserve any @img / @image references verbatim (do not rename or remove them).";

  // Abuza nazorati + kredit (pulli gpt-4o-mini chaqiruvi) — /gen naqshi.
  if (!withinDailyCap(req.user!.userId)) {
    res.status(429).json({
      error: "Kunlik AI-yordam limiti tugadi — ertaga qayta urinib ko'ring",
      code: "DAILY_CAP_REACHED",
    });
    return;
  }
  const gate = await consumeAiCredits(req.user!.userId, ENHANCE_COST);
  if (!gate.ok) {
    res.status(402).json({ error: gate.error, code: gate.code, remaining: gate.remaining });
    return;
  }
  logAiSpend(req.user!.userId, "enhance", ENHANCE_COST, "openai/gpt-4o-mini");

  if (format === "json") {
    const system =
      `You are an expert ${mode} prompt engineer for AI generation. Rewrite the user's idea into a ` +
      `rich, production-quality prompt and return it ONLY as a JSON object matching exactly this schema:\n` +
      `${enhanceJsonSchema(mode)}\n` +
      `Be concrete and cinematic. No markdown, no commentary. The "prompt" field must be a ` +
      `self-contained paragraph under ${ENHANCE_PROMPT_MAX} characters.${keepRefs}${ctx}`;
    const out = await orChatSys("openai/gpt-4o-mini", system, `Idea: ${p.data.prompt}`, true);
    if (!out.ok) {
      await refundAiCredits(req.user!.userId, ENHANCE_COST);
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
      await refundAiCredits(req.user!.userId, ENHANCE_COST);
      res.status(502).json({ error: "JSON prompt olinmadi — qayta urinib ko'ring" });
      return;
    }
    const promptStr = typeof json.prompt === "string" ? json.prompt : p.data.prompt;
    res.json({ prompt: promptStr, json });
    return;
  }

  // text — fal openrouter/router (Gemini 2.5 Flash); kirish tilini saqlaydi, faqat yakuniy prompt.
  const out = await falEnhancePrompt(p.data.prompt);
  if (!out.ok) {
    await refundAiCredits(req.user!.userId, ENHANCE_COST);
    res.status(502).json({ error: out.error });
    return;
  }
  res.json({ prompt: out.data.trim() });
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
