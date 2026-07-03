import { prisma } from "@creative-tools/database";
import {
  isS3Configured,
  uploadBufferToS3,
  getSignedDownloadUrl,
  getPublicOrSignedUrl,
  downloadS3ToBuffer,
  gcsKeyFromUrl,
} from "./s3.js";
import { detectMediaFormat } from "./ai/workers-ai.js";
import {
  orImage,
  orImageEdit,
  orSpeech,
  orVideoCreate,
  orVideoStatus,
  orDownload,
} from "./ai/openrouter.js";
import { magnificImage, magnificImageEdit, magnificTool, magnificRemoveBg, genProvider } from "./ai/magnific.js";
import {
  falImage,
  falPollStep,
  falSubmitJob,
  falVideoUrlToBuffer,
  type FalQueueJob,
} from "./ai/fal.js";
import {
  getModelById,
  resolveVideoParams,
  resolveImageCount,
  getReferenceMode,
  buildFalVideoInput,
  videoRequiresStartFrame,
  extractFalVideoUrl,
} from "./gen-models.js";
import type { GenModel } from "./gen-models.js";
import type { OrResult } from "./ai/openrouter.js";
import { elSoundEffects } from "./ai/elevenlabs.js";
import { vertexSubmitVideo, vertexPollVideo, vertexGcsUriToKey } from "./ai/vertex.js";
import { omniGenerateVideo } from "./ai/vertex-omni.js";
import { vertexImage, vertexImageEdit } from "./ai/vertex-image.js";
import { refundAiCredits } from "./plugin-profile.js";

// GenAsset.type — Artlist uslubidagi raqamli tur kodlari (ichki konventsiya).
const ASSET_TYPE = { image: 130, audio: 120, video: 140 } as const;

function tsName() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeGenerationError(message: string): string {
  const raw = String(message || "");
  if (
    /output video has sensitive content|sensitive content|nsfw|sexual|nudity|content policy|safety system/i.test(raw)
  ) {
    return "Video xavfsizlik filtri sabab bloklandi — promptni yumshating yoki kiyim/pozani kamroq ochiq tasvirlab qayta urinib ko‘ring";
  }
  return raw;
}

type StoredProviderJob =
  | { provider: "openrouter-video"; jobId: string; submittedAt: string }
  | ({ provider: "fal-video" | "fal-ref-video"; submittedAt: string } & FalQueueJob)
  | { provider: "vertex-video"; operationName: string; submittedAt: string };
type StoredProviderWebhook = {
  provider: "fal";
  requestId: string;
  status: "OK" | "ERROR";
  payload?: unknown;
  error?: string;
  payloadError?: string;
  receivedAt: string;
};

function readProviderJob(params: Record<string, unknown>): StoredProviderJob | null {
  const raw = params.__providerJob;
  if (!raw || typeof raw !== "object") return null;
  const job = raw as Record<string, unknown>;
  const provider = String(job.provider || "");
  if (provider === "openrouter-video" && typeof job.jobId === "string" && job.jobId) {
    return {
      provider,
      jobId: job.jobId,
      submittedAt: typeof job.submittedAt === "string" ? job.submittedAt : new Date().toISOString(),
    };
  }
  if (
    (provider === "fal-video" || provider === "fal-ref-video") &&
    typeof job.requestId === "string" &&
    typeof job.statusUrl === "string" &&
    typeof job.responseUrl === "string"
  ) {
    return {
      provider,
      requestId: job.requestId,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
      submittedAt: typeof job.submittedAt === "string" ? job.submittedAt : new Date().toISOString(),
    };
  }
  if (provider === "vertex-video" && typeof job.operationName === "string" && job.operationName) {
    return {
      provider,
      operationName: job.operationName,
      submittedAt: typeof job.submittedAt === "string" ? job.submittedAt : new Date().toISOString(),
    };
  }
  return null;
}

async function persistProviderJob(
  genId: string,
  params: Record<string, unknown>,
  job: StoredProviderJob | null
): Promise<void> {
  if (job) params.__providerJob = job;
  else delete params.__providerJob;
  await prisma.generation.update({
    where: { id: genId },
    data: { params: params as object },
  });
}

function readProviderWebhook(params: Record<string, unknown>): StoredProviderWebhook | null {
  const raw = params.__providerWebhook;
  if (!raw || typeof raw !== "object") return null;
  const box = raw as Record<string, unknown>;
  const status = String(box.status || "");
  const requestId = String(box.requestId || "");
  if ((status !== "OK" && status !== "ERROR") || !requestId) return null;
  return {
    provider: "fal",
    requestId,
    status,
    payload: box.payload,
    error: typeof box.error === "string" ? box.error : undefined,
    payloadError: typeof box.payloadError === "string" ? box.payloadError : undefined,
    receivedAt:
      typeof box.receivedAt === "string" ? box.receivedAt : new Date().toISOString(),
  };
}

async function persistProviderWebhook(
  genId: string,
  params: Record<string, unknown>,
  hook: StoredProviderWebhook | null
): Promise<void> {
  if (hook) params.__providerWebhook = hook;
  else delete params.__providerWebhook;
  await prisma.generation.update({
    where: { id: genId },
    data: { params: params as object },
  });
}

async function clearProviderJob(genId: string): Promise<void> {
  const gen = await prisma.generation.findUnique({
    where: { id: genId },
    select: { params: true },
  });
  const params =
    gen?.params && typeof gen.params === "object"
      ? ({ ...(gen.params as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  if (!readProviderJob(params)) return;
  await persistProviderJob(genId, params, null);
}

function falWebhookUrl(): string {
  const base = process.env.API_PUBLIC_URL?.trim();
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/api/studio/gen/fal-webhook`;
}

function falWaitMs(i: number): number {
  return i < 6 ? 600 : i < 20 ? 1200 : 2000;
}

async function readProviderWebhookFresh(genId: string): Promise<StoredProviderWebhook | null> {
  const gen = await prisma.generation.findUnique({
    where: { id: genId },
    select: { params: true },
  });
  if (!gen?.params || typeof gen.params !== "object") return null;
  return readProviderWebhook(gen.params as Record<string, unknown>);
}

async function waitForFalResult(
  genId: string,
  job: FalQueueJob,
  maxPolls: number
): Promise<OrResult<unknown>> {
  for (let i = 0; i < maxPolls; i++) {
    const hook = await readProviderWebhookFresh(genId);
    if (hook?.status === "ERROR") {
      return { ok: false, error: hook.error || hook.payloadError || "fal webhook xatosi" };
    }
    if (hook?.status === "OK") {
      return { ok: true, data: hook.payload };
    }
    await sleep(falWaitMs(i));
    const step = await falPollStep(job);
    if (!step.ok) return step;
    if (step.data.state === "completed") return { ok: true, data: step.data.data };
  }
  const finalHook = await readProviderWebhookFresh(genId);
  if (finalHook?.status === "ERROR") {
    return { ok: false, error: finalHook.error || finalHook.payloadError || "fal webhook xatosi" };
  }
  if (finalHook?.status === "OK") return { ok: true, data: finalHook.payload };
  return { ok: false, error: "FAL_TIMEOUT: job hali ishlamoqda — refund yo'q" };
}

function isResumableRunningGeneration(gen: {
  mode: string;
  status: string;
  params: unknown;
}): boolean {
  if (gen.status !== "running" || gen.mode !== "video" || !gen.params || typeof gen.params !== "object") {
    return false;
  }
  const params = gen.params as Record<string, unknown>;
  return Boolean(readProviderJob(params) || readProviderWebhook(params));
}

/**
 * CHEGARALANGAN parallel — n ta task'ni eng ko'pi `limit` ta bir vaqtda bajaradi, natija TARTIBDA.
 * Cheklanmagan Promise.all OOM xavfi tug'diradi (har task rasm buferini RAM'da ushlaydi; GEN_CONCURRENCY
 * faqat GENERATSIYALARNI cheklaydi, gen ICHIDAGI rasm sonini emas). Limit bilan peak xotira = limit ta bufer.
 */
async function mapLimit<R>(n: number, limit: number, fn: (i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(n);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < n) {
      const i = next++;
      results[i] = await fn(i); // bufer fn ichida persist'dan keyin scope'dan chiqadi → xotira ozod
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, n)) }, () => worker()));
  return results;
}
// Gen ICHIDAGI rasm parallelligi (count>1) — kichik Render instance'да xotira/429 burst'ni cheklash uchun.
const IMG_CONCURRENCY = Math.max(1, Number(process.env.GEN_IMG_CONCURRENCY) || 2);

/** Bufer → R2 (signed URL) yoki lokal dev'da data-URL. {url, key}. */
async function persist(
  userId: string,
  genId: string,
  buf: Buffer,
  ext: string,
  contentType: string
): Promise<{ url: string; key: string | null }> {
  const key = `gen/${userId}/${genId}-${tsName()}.${ext}`;
  if (isS3Configured()) {
    await uploadBufferToS3(buf, key, contentType);
    return { url: await getSignedDownloadUrl(key, 3600), key };
  }
  return { url: `data:${contentType};base64,${buf.toString("base64")}`, key: null };
}

/**
 * Video reference rasmni provayder OLA OLADIGAN URL'ga aylantiradi. Veo/Kling kabi
 * video provayderlar frame rasmni TASHQARIDAN yuklab oladi — data-URI'ni qabul
 * qilmasligi mumkin. Shu bois data-URI bo'lsa R2'ga yuklab signed URL (2 soat —
 * video async) qaytaramiz. Allaqachon http(s) URL bo'lsa — o'zini qaytaradi.
 */
async function materializeRefUrl(
  userId: string,
  genId: string,
  refUrl: string
): Promise<string> {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(refUrl);
  if (!m) return refUrl; // allaqachon URL
  if (!isS3Configured()) return refUrl; // dev fallback
  const contentType = m[1] || "image/jpeg";
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const buf = Buffer.from(m[2], "base64");
  const key = `gen-refs/${userId}/${genId}-${tsName()}.${ext}`;
  await uploadBufferToS3(buf, key, contentType);
  return getSignedDownloadUrl(key, 7200);
}

/**
 * H2 — strukturali "Tasvirdan" promptini (STYLE:/SCENE:/SUBJECT:/MOTION:/CAMERA:/TIMELINE:/
 * ENDING FRAME:/SOUND DESIGN:) VIDEO model uchun ixcham tabiiy tavsifga aylantiradi.
 * STYLE+SCENE+SUBJECT+MOTION+CAMERA qiymatlari olinadi; per-soniya TIMELINE (chalkash),
 * ENDING FRAME (End reference qoplaydi), SOUND DESIGN (audio) tashlanadi. Strukturali
 * bo'lmasa — o'zini qaytaradi (oddiy prompt o'zgarmaydi).
 */
export function flattenVideoPrompt(prompt: string): string {
  const text = String(prompt || "").trim();
  const KNOWN = [
    "STYLE", "SCENE", "SUBJECT", "MOTION", "CAMERA",
    "TIMELINE", "ENDING FRAME", "SOUND DESIGN", "COMPOSITION", "LIGHTING", "DETAILS",
  ];
  const labelAlt = KNOWN.map((l) => l.replace(/ /g, "\\s+")).join("|");
  const re = new RegExp("(?:^|\\n)\\s*(" + labelAlt + ")\\s*:", "gi");
  const found: { key: string; after: number; idx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)))
    found.push({ key: m[1].toUpperCase().replace(/\s+/g, " "), after: re.lastIndex, idx: m.index });
  if (found.length < 2) return text; // strukturali emas → o'zgarmaydi
  const sections: Record<string, string> = {};
  for (let i = 0; i < found.length; i++) {
    const end = i + 1 < found.length ? found[i + 1].idx : text.length;
    const val = text.slice(found[i].after, end).trim().replace(/\s+/g, " ");
    if (val) sections[found[i].key] = val;
  }
  const picked = ["STYLE", "SCENE", "SUBJECT", "MOTION", "CAMERA"]
    .map((k) => sections[k])
    .filter(Boolean);
  if (!picked.length) return text;
  return picked.join(". ").replace(/\.\s*\./g, ".").slice(0, 1800);
}

/** Video oqimi: OpenRouter async job → poll → yuklab olish (maks ~5 daqiqa). */
async function runVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  const refEndUrl = typeof params.referenceEndUrl === "string" ? params.referenceEndUrl : null;
  // Param gigiyenasi: model qo'llaydigan qiymatlarga klamp (ortiqcha yuborilmaydi).
  const v = resolveVideoParams(model, params);
  const opts: Parameters<typeof orVideoCreate>[1] = {
    // H2: strukturali "Tasvirdan" qolipi (STYLE:/TIMELINE:/...) video model uchun META-tavsif —
    // generatsiyaga ixcham tabiiy prompt yuboramiz (STYLE+SCENE+SUBJECT+MOTION+CAMERA).
    prompt: flattenVideoPrompt(prompt),
    resolution: v.resolution,
    aspectRatio: v.aspectRatio,
    duration: v.duration,
    generateAudio: v.generateAudio,
  };
  // ROUTER (G3): reference rasm → BOSHLANG'ICH KADR (first_frame). /videos/models
  // tekshiruvi (2026-06-18): barcha 7 video modeli `frame_images:[first_frame]` qo'llaydi,
  // `input_references` ni HECH BIRI qo'llamaydi — shuning uchun feature'dan qat'i nazar
  // first_frame ishlatamiz. data-URI → R2 hosted URL (provayder tashqaridan oladi).
  if (refUrl && getReferenceMode(model) === "video-ref") {
    const hosted = await materializeRefUrl(userId, genId, refUrl);
    const frames: NonNullable<typeof opts.frameImages> = [
      { url: hosted, frameType: "first_frame" },
    ];
    // End kadr — FAQAT model last_frame qo'llasa (gen-models.endFrame, /videos/models tasdiqlangan).
    if (refEndUrl && model.endFrame) {
      const hostedEnd = await materializeRefUrl(userId, genId, refEndUrl);
      frames.push({ url: hostedEnd, frameType: "last_frame" });
    }
    opts.frameImages = frames;
  }
  const saved = readProviderJob(params);
  let remoteId = saved?.provider === "openrouter-video" ? saved.jobId : "";
  if (!remoteId) {
    const created = await orVideoCreate(model.key, opts);
    if (!created.ok) return { ok: false, error: created.error };
    remoteId = created.data.id;
    await persistProviderJob(genId, params, {
      provider: "openrouter-video",
      jobId: remoteId,
      submittedAt: new Date().toISOString(),
    });
  }

  // Poll (3s × 100 = ~5 daqiqa) — granularlik 5s→3s, tayyor bo'lishini tezroq aniqlaydi.
  // Birinchi tekshiruvni 2s'da (qisqa video tezroq topilsin), keyin 3s.
  await sleep(2000);
  for (let i = 0; i < 100; i++) {
    const st = await orVideoStatus(remoteId);
    if (st.ok) {
      if (st.data.status === "completed") {
        const url = st.data.urls[0];
        if (!url) return { ok: false, error: "Video URL qaytmadi" };
        const dl = await orDownload(url);
        if (!dl.ok) return { ok: false, error: dl.error };
        return { ok: true, buf: dl.data };
      }
      if (st.data.status === "failed") return { ok: false, error: "Video generatsiya muvaffaqiyatsiz" };
    }
    await sleep(3000); // keyingi tekshiruvgacha
  }
  return { ok: false, error: "OPENROUTER_TIMEOUT: job hali ishlamoqda — refund yo'q" };
}

/** fal video natija javobidan URL'ni model deklaratsiyasi bo'yicha topib (B5) Buffer'ga yuklaydi. */
async function falVideoOut(
  model: GenModel,
  data: unknown
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const url = extractFalVideoUrl(model, data);
  if (!url) return { ok: false, error: "fal: video URL topilmadi" };
  const dl = await falVideoUrlToBuffer(url);
  if (!dl.ok) return { ok: false, error: dl.error };
  return { ok: true, buf: dl.data };
}

/** fal.ai video (Seedance 2.0 Fast). referenceUrl = start kadr, referenceEndUrl = end kadr (ixtiyoriy). */
async function runFalVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  const refEndUrl = typeof params.referenceEndUrl === "string" ? params.referenceEndUrl : null;
  // B2: t2v modellar (videoInput.imageRequired emas) kadrsiz ishlaydi; i2v majbur qiladi.
  if (!refUrl && videoRequiresStartFrame(model))
    return { ok: false, error: "Video uchun boshlang'ich kadr (referenceUrl) talab qilinadi" };
  const [startUrl, endUrl] = await Promise.all([
    refUrl ? materializeRefUrl(userId, genId, refUrl) : Promise.resolve(undefined),
    refEndUrl && model.endFrame
      ? materializeRefUrl(userId, genId, refEndUrl)
      : Promise.resolve(undefined),
  ]);
  const v = resolveVideoParams(model, params);
  // B1: fal input model deklaratsiyasidan quriladi (Seedance uchun natija eski bilan AYNAN bir xil).
  const input = buildFalVideoInput(model, prompt, v, { startUrl, endUrl }, userId);
  const savedHook = readProviderWebhook(params);
  if (savedHook?.status === "ERROR") {
    return { ok: false, error: savedHook.error || savedHook.payloadError || "fal webhook xatosi" };
  }
  if (savedHook?.status === "OK") {
    return falVideoOut(model, savedHook.payload);
  }
  const saved = readProviderJob(params);
  let job: FalQueueJob;
  if (saved?.provider === "fal-video") {
    job = { requestId: saved.requestId, statusUrl: saved.statusUrl, responseUrl: saved.responseUrl };
  } else {
    const sub = await falSubmitJob(model.falModel ?? model.key, input, {
      webhookUrl: falWebhookUrl() || undefined,
    });
    if (!sub.ok) return { ok: false, error: sub.error };
    job = sub.data;
    await persistProviderJob(genId, params, {
      provider: "fal-video",
      requestId: job.requestId,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
      submittedAt: new Date().toISOString(),
    });
  }
  const out = await waitForFalResult(genId, job, 210);
  if (!out.ok) return { ok: false, error: out.error };
  return falVideoOut(model, out.data);
}

/**
 * fal.ai reference-to-video (Seedance 2.0 R2V). Ko'p-modal referens: params.imageUrls/videoUrls/audioUrls
 * (data-URI yoki URL) → R2 public URL, TARTIBDA. Referens IXTIYORIY (referenssiz ham ishlaydi).
 * Schema invariant: audio bo'lsa kamida 1 image/video; jami ≤12.
 */
async function runFalRefVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const matAll = async (val: unknown): Promise<string[]> => {
    const list = Array.isArray(val)
      ? (val as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    return Promise.all(list.map((u) => materializeRefUrl(userId, genId, u)));
  };
  const lim = model.mediaRefs ?? { image: 9, video: 3, audio: 3, total: 12 };
  const [imageUrlsRaw, videoUrlsRaw, audioUrlsRaw] = await Promise.all([
    matAll(params.imageUrls),
    matAll(params.videoUrls),
    matAll(params.audioUrls),
  ]);
  const imageUrls = imageUrlsRaw.slice(0, lim.image);
  const videoUrls = videoUrlsRaw.slice(0, lim.video);
  const audioUrls = audioUrlsRaw.slice(0, lim.audio);
  // Schema: audio bo'lsa kamida 1 image/video kerak.
  if (audioUrls.length && imageUrls.length + videoUrls.length === 0) {
    return { ok: false, error: "Audio referens uchun kamida 1 rasm yoki video referens kerak" };
  }
  if (imageUrls.length + videoUrls.length + audioUrls.length > lim.total) {
    return { ok: false, error: `Jami referens ≤${lim.total}` };
  }
  const v = resolveVideoParams(model, params);
  // B1: fal input model deklaratsiyasidan (Seedance R2V uchun natija eski bilan AYNAN bir xil).
  const input = buildFalVideoInput(model, prompt, v, { imageUrls, videoUrls, audioUrls }, userId);
  const savedHook = readProviderWebhook(params);
  if (savedHook?.status === "ERROR") {
    return { ok: false, error: savedHook.error || savedHook.payloadError || "fal webhook xatosi" };
  }
  if (savedHook?.status === "OK") {
    return falVideoOut(model, savedHook.payload);
  }
  const saved = readProviderJob(params);
  let job: FalQueueJob;
  if (saved?.provider === "fal-ref-video") {
    job = { requestId: saved.requestId, statusUrl: saved.statusUrl, responseUrl: saved.responseUrl };
  } else {
    const sub = await falSubmitJob(model.falModel ?? model.key, input, {
      webhookUrl: falWebhookUrl() || undefined,
    });
    if (!sub.ok) {
      if (/maximum allowed size of 52428800 bytes|file size exceeds the maximum allowed size/i.test(String(sub.error || ""))) {
        return {
          ok: false,
          error: "Video referens juda katta — Seedance R2V hozir 50MB dan katta video referensni qabul qilmaydi",
        };
      }
      return { ok: false, error: sub.error };
    }
    job = sub.data;
    await persistProviderJob(genId, params, {
      provider: "fal-ref-video",
      requestId: job.requestId,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
      submittedAt: new Date().toISOString(),
    });
  }
  const out = await waitForFalResult(genId, job, 360);
  if (!out.ok) {
    if (/maximum allowed size of 52428800 bytes|file size exceeds the maximum allowed size/i.test(String(out.error || ""))) {
      return {
        ok: false,
        error: "Video referens juda katta — Seedance R2V hozir 50MB dan katta video referensni qabul qilmaydi",
      };
    }
    return { ok: false, error: out.error };
  }
  return falVideoOut(model, out.data);
}

/** data:URI yoki http(s) URL'ni Vertex kutgan inline base64 rasmga aylantiradi. */
async function refUrlToInlineImage(
  refUrl: string
): Promise<{ data: string; mimeType: string } | null> {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(refUrl);
  if (m) return { data: m[2], mimeType: m[1] || "image/jpeg" };
  const res = await fetch(refUrl);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mimeType: contentType };
}

/**
 * Google Vertex AI (Veo) — TO'G'RIDAN-TO'G'RI (fal.ai orqali EMAS, foydalanuvchining
 * o'z GCP krediti sarflanadi). Uzun operatsiya: submit → poll → natija shu bucket'dagi
 * GCS obyektidan (mavjud S3-moslik client orqali) yuklanadi. Referens rasm IXTIYORIY —
 * Veo sof matn promptidan ham video yasay oladi.
 */
async function runVertexVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  // YAKUNIY kadr faqat endFrame:true modelda o'qiladi (Veo last_frame).
  const refEndUrl =
    model.endFrame && typeof params.referenceEndUrl === "string" ? params.referenceEndUrl : null;
  const v = resolveVideoParams(model, params);
  const saved = readProviderJob(params);
  let job: { operationName: string };
  if (saved?.provider === "vertex-video") {
    job = { operationName: saved.operationName };
  } else {
    const inline = refUrl ? await refUrlToInlineImage(refUrl) : null;
    const inlineEnd = refEndUrl ? await refUrlToInlineImage(refEndUrl) : null;
    // SDK: lastFrame faqat i2v'da (start image SHART) → start kadrsiz end kadr YUBORILMAYDI (400 + kredit sarfini oldini oladi).
    const endData = inline ? inlineEnd?.data : undefined;
    const sub = await vertexSubmitVideo(model.key, prompt, {
      imageBase64: inline?.data,
      imageMimeType: inline?.mimeType,
      endImageBase64: endData,
      endImageMimeType: endData ? inlineEnd?.mimeType : undefined,
      aspectRatio: v.aspectRatio,
      durationSeconds: v.duration,
      generateAudio: v.generateAudio,
      resolution: v.resolution,
    });
    if (!sub.ok) return { ok: false, error: sub.error };
    job = sub.data;
    await persistProviderJob(genId, params, {
      provider: "vertex-video",
      operationName: job.operationName,
      submittedAt: new Date().toISOString(),
    });
  }
  for (let i = 0; i < 90; i++) {
    await sleep(falWaitMs(i));
    const poll = await vertexPollVideo(job);
    if (!poll.ok) return { ok: false, error: poll.error };
    if (poll.data.state === "pending") continue;
    if (poll.data.state === "error") return { ok: false, error: poll.data.error };
    const key = vertexGcsUriToKey(poll.data.gcsUri);
    if (!key) return { ok: false, error: `Vertex: kutilmagan GCS manzil — ${poll.data.gcsUri}` };
    const buf = await downloadS3ToBuffer(key);
    return { ok: true, buf };
  }
  return { ok: false, error: "VERTEX_TIMEOUT: job hali ishlamoqda — refund yo'q" };
}

/**
 * Gemini Omni Flash (Vertex Interactions API) — SINXRON. Veo'дан farqli submit/poll YO'Q:
 * bitta chaqiruv videoni (Buffer) darrov qaytaradi. Referens rasm IXTIYORIY (image-to-video).
 * Sinxron bo'lgani uchun provider-job persist qilinmaydi — xato bo'lsa oddiy fail+refund.
 */
const OMNI_INLINE_VIDEO_MAX = 15 * 1024 * 1024; // ~15MB gacha inline base64; kattasi gs:// SHART

/** Video referens URL → Omni video input INLINE base64 (≤15MB). MUHIM: gs:// cross-loyiha ishlamaydi
 *  (Omni VIDEO_PROJECT'da, bucket boshqa loyihada) → gs:// EMAS, videoni yuklab base64 qilamiz. Bu
 *  loyihaga bog'liq emas. Katta video (>15MB) uchun same-project GCS bucket kerak (hozircha yo'q). */
async function videoRefToOmniInput(url: string): Promise<{ data?: string } | null> {
  const m = /^data:[^;]+;base64,([\s\S]*)$/.exec(url);
  if (m) {
    const buf = Buffer.from(m[2], "base64");
    return buf.length <= OMNI_INLINE_VIDEO_MAX ? { data: m[2] } : null;
  }
  // bizning bucket → S3'dan yuklab; tashqi → fetch
  const key = gcsKeyFromUrl(url);
  let buf: Buffer;
  try {
    if (key) buf = await downloadS3ToBuffer(key);
    else {
      const res = await fetch(url);
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    }
  } catch {
    return null;
  }
  if (buf.length > OMNI_INLINE_VIDEO_MAX) return null; // katta → same-project GCS kerak (yo'q)
  return { data: buf.toString("base64") };
}

async function runVertexOmniVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  _userId: string,
  _genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const v = resolveVideoParams(model, params);
  const lim = model.mediaRefs ?? { image: 3, video: 2, audio: 0, total: 3 };
  // Media-refs: rasm (image-to-video/subject) + VIDEO (reference-to-video/editing). Frames (referenceUrl/End)
  // ham rasm sifatida qo'shiladi (orqaga moslik). TARTIB saqlanadi.
  const imageRefs: string[] = [];
  if (typeof params.referenceUrl === "string" && params.referenceUrl) imageRefs.push(params.referenceUrl);
  if (typeof params.referenceEndUrl === "string" && params.referenceEndUrl) imageRefs.push(params.referenceEndUrl);
  if (Array.isArray(params.imageUrls))
    for (const u of params.imageUrls) if (typeof u === "string" && u && !imageRefs.includes(u)) imageRefs.push(u);
  const videoRefs: string[] = Array.isArray(params.videoUrls)
    ? (params.videoUrls as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  const inlines = (await Promise.all(imageRefs.slice(0, lim.image).map((u) => refUrlToInlineImage(u)))).filter(
    (x): x is { data: string; mimeType: string } => !!x
  );
  const vids = (await Promise.all(videoRefs.slice(0, lim.video).map((u) => videoRefToOmniInput(u)))).filter(
    (x): x is { gsUri?: string; data?: string } => !!x
  );
  if (videoRefs.length && vids.length < videoRefs.length)
    return { ok: false, error: "Video referens juda katta yoki yuklanmadi (gs:// yoki ≤15MB kerak)" };

  const out = await omniGenerateVideo(model.key, prompt, {
    images: inlines.map((i) => ({ data: i.data, mimeType: i.mimeType })),
    videos: vids,
    aspectRatio: v.aspectRatio,
  });
  if (!out.ok) return { ok: false, error: out.error };
  return { ok: true, buf: out.data };
}

/**
 * queued Generation'ni qayta ishlaydi — model.feature bo'yicha OpenRouter'ga marshrutlaydi:
 * text-to-image / image-edit → sync; text-to-speech → audio; text/image-to-video → async poll.
 * Natija R2'ga → GenAsset → status=done. Xato → status=failed + KREDIT QAYTARILADI.
 */
export async function processGeneration(genId: string): Promise<void> {
  const gen = await prisma.generation.findUnique({ where: { id: genId } });
  if (!gen) return;
  const canResume = isResumableRunningGeneration(gen);
  if (gen.status !== "queued" && !canResume) return;

  const fail = async (reason: string) => {
    const safeReason = normalizeGenerationError(reason).slice(0, 480);
    // ATOMIK: faqat hali queued/running bo'lsa failed qil + refund. Agar reconcileStuckGenerations
    // (yoki boshqa yo'l) jobni ALLAQACHON terminal qilган bo'lsa → updateMany count=0 → IKKINCHI marta
    // refund QILMAYMIZ. reconcile naqshi (double-refund race fix — audit 2026-06-26).
    const upd = await prisma.generation.updateMany({
      where: { id: genId, status: { in: ["queued", "running"] } },
      data: { status: "failed", error: safeReason },
    });
    await clearProviderJob(genId);
    if (upd.count > 0) await refundAiCredits(gen.userId, gen.cost, { generationId: genId });
  };

  try {
    if (gen.status === "queued") {
      const claimed = await prisma.generation.updateMany({
        where: { id: genId, status: "queued" },
        data: { status: "running" },
      });
      if (claimed.count === 0) return;
    }
    const model = getModelById(gen.modelId);
    if (!model) return void (await fail("Noma'lum model"));

    const params = (gen.params ?? {}) as Record<string, unknown>;
    const aspectRatio = typeof params.aspectRatio === "string" ? params.aspectRatio : null;
    const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;

    if (model.feature === "text-to-image" || model.feature === "image-edit") {
      // image_config — NATIVE o'lcham/nisbat (promptga qo'shilmaydi).
      const quality = typeof params.quality === "string" ? params.quality : null;
      const imageConfig: { aspect_ratio?: string; image_size?: string } = {};
      if (aspectRatio) imageConfig.aspect_ratio = aspectRatio;
      if (quality) imageConfig.image_size = quality;
      // count > 1 → N marta generatsiya, har biri alohida GenAsset (narx base×N).
      // Bittasi xato bo'lsa — butun batch fail + to'liq refund (foydalanuvchi yo hammasini oladi, yo hech narsa to'lamaydi).
      const count = resolveImageCount(model, params);
      // ROUTER (G2): reference'ni model.referenceMode bo'yicha marshrutlaymiz — `feature`ga
      // emas. Shu tufayli "text-to-image" feature'li, lekin image-edit qo'llaydigan modellar
      // (Nano Banana 2 va h.k.) reference bilan orImageEdit'ga to'g'ri tushadi.
      const refMode = getReferenceMode(model);
      const useEdit =
        !!refUrl && (refMode === "image-edit" || refMode === "image-ref");
      // PROVAYDER (P1): GEN_PROVIDER=magnific bo'lsa rasm gen/edit Mystic'ga; aks holda OpenRouter.
      // Kontrakt OrResult<Buffer> bir xil → persist/fail/refund skeleton o'zgarmaydi.
      const useMagnific = genProvider() === "magnific";
      const useFal = model.provider === "fal"; // openai/gpt-image-2/edit (image-edit)
      const useVertexImg = model.provider === "vertex-image"; // Imagen/Nano Banana — Google to'g'ridan-to'g'ri
      const mModel = model.magnificModel ?? "realism";
      // Dedicated Magnific tool (upscale/relight/camera/skin/extend/removebg) — manba rasm yeydi.
      // Faqat provider=magnific; openrouter'да ekvivalent yo'q → aniq xato (UI "Tez orada" qoladi).
      const mfTool = model.magnificTool;
      if (mfTool && !useMagnific) return void (await fail("Bu tool faqat Magnific'да (GEN_PROVIDER=magnific)"));
      if (mfTool && !refUrl) return void (await fail("Manba rasm kerak — AE komp yoki layer tanlang"));
      // Remove BG SINXRON + image_url (PUBLIC URL) talab qiladi (base64 EMAS — docs tasdiqlandi).
      // ❗ MUHIM: Magnific serveri AUTH'siz yuklab olishi shart. presigned URL (uzun `X-Amz-*`
      // query + ".png" bilan tugamaydi) Magnific downloaderini adashtiradi → "Failed to download
      // the image". Shu bois manba data-URI'ni R2'ga yuklab TOZA public URL beramiz (CDN_BASE_URL /
      // r2.dev — so'rov-satrisiz, ".png" bilan tugaydi). Public R2 (pub-*.r2.dev) butun bucket ochiq.
      const mfRemoveBg = mfTool === "beta/remove-background";
      let mfRbgUrl = "";
      if (mfRemoveBg) {
        const u = refUrl as string;
        if (u.startsWith("data:") && isS3Configured()) {
          const sbuf = Buffer.from(u.split("base64,")[1] || "", "base64");
          const sf = detectMediaFormat(sbuf, { ext: "png", contentType: "image/png" });
          const skey = `gen-refs/${gen.userId}/${genId}-${tsName()}.${sf.ext}`;
          await uploadBufferToS3(sbuf, skey, sf.contentType);
          mfRbgUrl = await getPublicOrSignedUrl(skey, 3600);
        } else {
          mfRbgUrl = u; // allaqachon http URL (yoki dev fallback — data-URI'ни Magnific ololmaydi)
        }
        // Render log: bu URL'ni AUTH'siz `curl` bilan ochib ko'ring — 200 qaytmasa Magnific ham ololmaydi.
        console.log(`[gen] remove-bg image_url → ${mfRbgUrl}`);
      }
      // FAL image-edit: input rasm(lar) fal'ga PUBLIC URL bo'lib uzatiladi (data-URI/private auth
      // → file_download_error). data-URI'ni R2'ga yuklab TOZA public URL beramiz (remove-bg naqshi).
      // t2i (referenceMode 'none') → referens YO'Q: falImageUrls bo'sh qoladi (falImage image_urls yubormaydi).
      let falImageUrls: string[] = [];
      const falNeedsRef = useFal && refMode !== "none"; // edit modeli referens talab qiladi; t2i — yo'q
      if (falNeedsRef) {
        const rawRefs: string[] = Array.isArray(params.referenceUrls)
          ? (params.referenceUrls as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
          : refUrl
            ? [refUrl]
            : [];
        if (!rawRefs.length) return void (await fail("Tahrirlash uchun rasm kerak — ＋ orqali yuklang"));
        // PARALLEL — referenslar bir vaqtда R2'ga (odatda plagin allaqachon public R2 URL yuboradi → no-op).
        // Promise.all TARTIBNI saqlaydi → @imgN→image_urls[N-1] mapping buzilmaydi.
        falImageUrls = await Promise.all(
          rawRefs.map(async (ru) => {
            if (ru.startsWith("data:") && isS3Configured()) {
              const sbuf = Buffer.from(ru.split("base64,")[1] || "", "base64");
              const sf = detectMediaFormat(sbuf, { ext: "png", contentType: "image/png" });
              const skey = `gen-refs/${gen.userId}/${genId}-${tsName()}.${sf.ext}`;
              await uploadBufferToS3(sbuf, skey, sf.contentType);
              return getPublicOrSignedUrl(skey, 7200);
            }
            return ru;
          })
        );
      }
      // count>1 → CHEGARALANGAN parallel (oldin serial: N× sekin). genOne() bitta rasm yaratadi
      // (loop-body holatsiz — har task bir xil argument). Har task: yaratish → persist (bufer scope'dan
      // chiqadi → xotira ozod). mapLimit eng ko'pi IMG_CONCURRENCY ta bir vaqtda → tezlik + cheklangan
      // xotira/429 (kichik Render instance). Natija TARTIBDA (slots[i]) → @imgN/asset tartibi saqlanadi.
      // Vertex edit uchun BARCHA referenslar (Gemini ko'p rasmni birlashtiradi) — TARTIB saqlanadi.
      const vertexRefUrls: string[] = Array.isArray(params.referenceUrls)
        ? (params.referenceUrls as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
        : refUrl
          ? [refUrl]
          : [];
      const genOne = (): Promise<OrResult<Buffer>> =>
        useVertexImg
          ? useEdit
            ? vertexImageEdit(model.key, gen.prompt, vertexRefUrls, { aspectRatio: imageConfig.aspect_ratio, imageSize: imageConfig.image_size })
            : vertexImage(model.key, gen.prompt, { aspectRatio: imageConfig.aspect_ratio, imageSize: imageConfig.image_size })
          : useFal
          ? falImage(model.falModel ?? model.key, gen.prompt, { imageUrls: falImageUrls, aspect: aspectRatio, quality, settings: model.imgSettings, noNumParam: model.noNumParam, outputFormat: model.outputFormat })
          : mfRemoveBg
          ? magnificRemoveBg(mfRbgUrl)
          : mfTool
          ? magnificTool(mfTool, refUrl as string, params)
          : useEdit
            ? useMagnific
              ? magnificImageEdit(mModel, gen.prompt, refUrl as string, model.imgModalities, imageConfig)
              : orImageEdit(model.key, gen.prompt, refUrl as string, model.imgModalities, imageConfig)
            : useMagnific
              ? magnificImage(mModel, gen.prompt, model.imgModalities, imageConfig)
              : orImage(model.key, gen.prompt, model.imgModalities, imageConfig);
      type Slot = { ok: true; url: string; key: string | null } | { ok: false; error: string };
      const slots = await mapLimit<Slot>(count, IMG_CONCURRENCY, async (): Promise<Slot> => {
        const out = await genOne();
        if (!out.ok) return { ok: false, error: out.error };
        const fmt = detectMediaFormat(out.data, { ext: "png", contentType: "image/png" });
        const p = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
        return { ok: true, url: p.url, key: p.key };
      });
      // ❗ TIMEOUT ≠ REFUND: birortasi poll-timeout sentinel bo'lsa → "running" qoldiramiz, KREDIT
      // QAYTARMAYMIZ (reconcile 10 daq hal qiladi). Tekshiruv refund/asset YARATISHDAN OLDIN.
      if (slots.some((s) => !s.ok && (s.error.startsWith("FAL_TIMEOUT") || s.error.startsWith("MAGNIFIC_TIMEOUT"))))
        return;
      // Haqiqiy xato (birortasi) → to'liq refund BIR MARTA + HECH QANDAY DB asset (all-or-nothing).
      const firstErr = slots.find((s) => !s.ok);
      if (firstErr && !firstErr.ok) return void (await fail(firstErr.error));
      // Hammasi OK → assetlar TARTIBDA yaratiladi.
      for (const s of slots) {
        if (!s.ok) continue;
        await prisma.genAsset.create({
          data: { generationId: genId, type: ASSET_TYPE.image, url: s.url, resultKey: s.key, thumbUrl: s.url, aspectRatio },
        });
      }
    } else if (model.feature === "text-to-speech") {
      // Kokoro voice MAJBURIY (bo'sh → "expected string" xatosi). Yo'q/bo'sh bo'lsa
      // tasdiqlangan default voice'ga tushamiz — audio doim chiqsin (jonli test bilan tekshirilgan).
      const voice =
        typeof params.voice === "string" && params.voice ? params.voice : "af_bella";
      const out = await orSpeech(model.key, gen.prompt, voice);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key },
      });
    } else if (model.feature === "text-to-sfx") {
      // ElevenLabs SFX (sync, RAW mp3). duration ixtiyoriy (0.5–22s).
      const dur =
        typeof params.duration === "number"
          ? params.duration
          : typeof params.duration === "string"
            ? Number(params.duration)
            : undefined;
      const out = await elSoundEffects(gen.prompt, dur);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key },
      });
    } else if (
      model.feature === "text-to-video" ||
      model.feature === "image-to-video" ||
      model.feature === "reference-to-video"
    ) {
      const out =
        model.feature === "reference-to-video"
          ? await runFalRefVideo(model, gen.prompt, params, gen.userId, genId) // R2V — ko'p-modal referens
          : model.provider === "fal"
            ? await runFalVideo(model, gen.prompt, params, gen.userId, genId)
            : model.provider === "vertex"
              ? await runVertexVideo(model, gen.prompt, params, gen.userId, genId)
              : model.provider === "vertex-omni"
                ? await runVertexOmniVideo(model, gen.prompt, params, gen.userId, genId)
                : await runVideo(model, gen.prompt, params, gen.userId, genId);
      if (
        !out.ok &&
        (out.error.startsWith("FAL_TIMEOUT") ||
          out.error.startsWith("OPENROUTER_TIMEOUT") ||
          out.error.startsWith("VERTEX_TIMEOUT"))
      ) {
        return;
      }
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.buf, { ext: "mp4", contentType: "video/mp4" });
      const { url, key } = await persist(gen.userId, genId, out.buf, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.video, url, resultKey: key, thumbUrl: url, aspectRatio },
      });
      await clearProviderJob(genId);
    } else {
      return void (await fail(`Qo'llab-quvvatlanmaydigan tur: ${model.feature}`));
    }

    // ATOMIK: faqat hali running bo'lsa done qil. Agar reconcile (10 daq) jobni failed+refund qilган
    // bo'lsa → count=0 → failed→done QILMAYMIZ (refund saqlanadi; assetlar history'да ko'rinmaydi —
    // "bepul gen" oldini olamiz). Double-refund race fix (audit 2026-06-26).
    await prisma.generation.updateMany({ where: { id: genId, status: "running" }, data: { status: "done" } });
  } catch (e) {
    await fail(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Qotib qolgan generatsiyalarni tiklaydi (Render restart fon jarayonni o'ldirsa job "running"da
 * qoladi → kredit qaytmaydi). Belgilangan vaqtdan oshган queued/running → failed + refund.
 * /credits va POST /gen'da chaqiriladi — foydalanuvchi keyingi amalida yo'qolган krediti qaytadi.
 */
function stuckTimeoutMs(g: { mode: string; modelId: number }): number {
  // Foydalanuvchi so'rovi (2026-07-01): kutish 20 daqiqa — sekin 4K/Pro rasm ham, video ham.
  return 20 * 60 * 1000;
}
export async function reconcileStuckGenerations(userId: string): Promise<number> {
  const stuck = await prisma.generation.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
  });
  for (const g of stuck) {
    const cutoff = new Date(Date.now() - stuckTimeoutMs(g));
    if (g.createdAt >= cutoff) continue;
    // Atomik: faqat hali queued/running bo'lsa failed qilamiz (haqiqatan tugagan job'ga tegmaslik).
    const upd = await prisma.generation.updateMany({
      where: { id: g.id, status: { in: ["queued", "running"] } },
      data: { status: "failed", error: "Vaqt tugadi (avtomatik tiklash) — kredit qaytarildi" },
    });
    if (upd.count > 0) await refundAiCredits(g.userId, g.cost, { generationId: g.id });
  }
  return stuck.length;
}

/**
 * Fon rejimida ishga tushirish — POST /gen javobini bloklamaydi.
 * CONCURRENCY CHEKLOVI: bir vaqtda faqat N gen ishlaydi (video/rasm buferlari RAM'ni to'ldirib
 * OOM qilmasin — Render kichik instance). Ortiqchasi navbatda kutadi (status="queued").
 */
const GEN_CONCURRENCY = Math.max(1, Number(process.env.GEN_CONCURRENCY) || 2);
let genActive = 0;
const genWaiting: string[] = [];
const genWaitingSet = new Set<string>();
const genActiveSet = new Set<string>();
function genRunNext(): void {
  if (genActive >= GEN_CONCURRENCY) return;
  const genId = genWaiting.shift();
  if (!genId) return;
  genWaitingSet.delete(genId);
  genActiveSet.add(genId);
  genActive++;
  processGeneration(genId)
    .catch((e) => console.error(`[studio-gen] processor xato (${genId}):`, e))
    .finally(() => {
      genActive--;
      genActiveSet.delete(genId);
      genRunNext();
    });
}
export function processGenerationInBackground(genId: string): void {
  if (genWaitingSet.has(genId) || genActiveSet.has(genId)) return;
  genWaiting.push(genId);
  genWaitingSet.add(genId);
  genRunNext();
}

async function resumePendingGenerations(): Promise<void> {
  const pending = await prisma.generation.findMany({
    where: { status: { in: ["queued", "running"] } },
    select: { id: true, mode: true, status: true, params: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  for (const gen of pending) {
    if (gen.status === "queued" || isResumableRunningGeneration(gen)) {
      processGenerationInBackground(gen.id);
    }
  }
}

const genResumeTimer = setInterval(() => {
  resumePendingGenerations().catch((e) => {
    console.error("[studio-gen] pending resume xato:", e);
  });
}, 30_000);
if (typeof genResumeTimer.unref === "function") genResumeTimer.unref();
setTimeout(() => {
  resumePendingGenerations().catch((e) => {
    console.error("[studio-gen] initial resume xato:", e);
  });
}, 1000);
