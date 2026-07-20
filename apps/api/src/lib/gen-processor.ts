import { prisma } from "@creative-tools/database";
import {
  isS3Configured,
  uploadBufferToS3,
  getSignedDownloadUrl,
  getPublicOrSignedUrl,
  downloadS3ToBuffer,
  gcsKeyFromUrl,
  deleteGenObjectsByPrefix,
} from "./s3.js";
import { detectMediaFormat } from "./ai/workers-ai.js";
import { enforceStorageRetention } from "./storage-quota.js";
import { byteplusTokensToUsd, recordMeasuredProviderCost } from "./ledger.js"; // P24 — o'lchangan token→USD
import {
  extractVideoPosterFrame,
  makeImageThumbFile,
  makeImageDisplayFile,
  makeVideoPreviewFile,
  probeMediaDimensions,
  probeVideoMetaUrl, // R4_07 — Topaz video upscale chiqish geometriyasi (manba meta × faktor)
} from "./optimize-preview.js";
import fs from "fs";
import os from "os";
import path from "path";
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
  falPollJob,
  falImageResultToBuffer,
  falSubmitJob,
  falVideoUrlToBuffer,
  type FalQueueJob,
  type FalImageSettings,
} from "./ai/fal.js";
import {
  buildByteplusVideoBody,
  byteplusImage,
  byteplusPollStep,
  byteplusSubmitVideoTask,
  byteplusVideoUrlToBuffer,
  withByteplusVideoSlot,
  BYTEPLUS_INPUT_MODERATION_PREFIX,
  BYTEPLUS_TIMEOUT_ERROR,
} from "./ai/byteplus.js";
import {
  buildKlingVideoRequest,
  klingImage,
  klingPollVideoStep,
  klingSubmitVideo,
  klingVideoUrlToBuffer,
  KLING_TIMEOUT_ERROR,
} from "./ai/kling.js";
import {
  // R4_03 foundation + R4_07 enabled ops (Proteus video / Gigapixel + RemoveBG image).
  topazSubmitImageEnhance,
  topazPollImageStep,
  topazImageDownload,
  topazCreateVideoRequest,
  topazAcceptVideoRequest,
  topazPollVideoStep,
  topazVideoUrlToBuffer,
  TOPAZ_TIMEOUT_ERROR,
  type TopazImageEndpoint,
} from "./ai/topaz.js";
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
import { vertexImage, vertexImageEdit, vertexImageUpscale } from "./ai/vertex-image.js";
import { googleTtsSynthesize } from "./ai/google-tts.js";
import { refundAiCredits } from "./plugin-profile.js";
import { fetchSafe } from "./fetch-safe.js";
import { moderateContent, moderateOutputsEnabled } from "./moderation.js";
import { writeAuditLog } from "./audit-log.js";
import { classifyGenRejection } from "./gen-rejection.js";
import { noteBlockedAttempt } from "./spend-guard.js";
import { captureException } from "./sentry.js";

// GenAsset.type — Artlist uslubidagi raqamli tur kodlari (ichki konventsiya).
const ASSET_TYPE = { image: 130, audio: 120, video: 140 } as const;

function tsName() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/**
 * FAZA 2 #8 — video gen uchun HAQIQIY poster (birinchi kadr JPG). CEP CEF'da
 * <video> birinchi-kadr renderi ishonchsiz → kartalar qora edi. Best-effort:
 * xato bo'lsa gen oqimini buzmaydi (thumbKey=null, klient video-fallback).
 */
type VideoAssetDerivs = {
  thumbKey: string | null;
  thumbUrl: string | null;
  previewKey: string | null; // P9.2 — 720p hover-preview (asl fayl saqlanadi)
  width: number | null;
  height: number | null;
};
async function makeVideoPoster(
  videoKey: string | null,
  buf: Buffer
): Promise<VideoAssetDerivs> {
  const none: VideoAssetDerivs = { thumbKey: null, thumbUrl: null, previewKey: null, width: null, height: null };
  if (!videoKey || !isS3Configured()) return none;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "genposter-"));
  const vidPath = path.join(tmpDir, "in.mp4");
  const imgPath = path.join(tmpDir, "poster.jpg");
  const prevPath = path.join(tmpDir, "preview.mp4");
  const base = videoKey.replace(/\.[a-z0-9]+$/i, "");
  const out: VideoAssetDerivs = { ...none };
  try {
    fs.writeFileSync(vidPath, buf);
    // P11.2 — asl (provider qaytargan) o'lchamni saqlaymiz (lightbox "Size" qatori uchun ishonchli manba)
    const dim = await probeMediaDimensions(vidPath);
    if (dim) { out.width = dim.width; out.height = dim.height; }
    const okPoster = await extractVideoPosterFrame(vidPath, imgPath);
    if (okPoster) {
      const thumbKey = base + "-poster.jpg";
      await uploadBufferToS3(fs.readFileSync(imgPath), thumbKey, "image/jpeg");
      out.thumbKey = thumbKey;
      out.thumbUrl = await getSignedDownloadUrl(thumbKey, 3600);
    }
    // P9.2 — 720p hover-preview (best-effort; xato bo'lsa hover asl'ga tushadi)
    const okPrev = await makeVideoPreviewFile(vidPath, prevPath);
    if (okPrev) {
      const previewKey = base + "-preview.mp4";
      await uploadBufferToS3(fs.readFileSync(prevPath), previewKey, "video/mp4");
      out.previewKey = previewKey;
    }
    return out;
  } catch (e) {
    console.error("[gen] video poster/preview xato (e'tiborsiz):", e);
    return out;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* */
    }
  }
}
/** P4 — rasm gen uchun HAQIQIY kichik thumbnail (~512px jpg). Oldin thumbUrl = to'liq
 *  rasm URL edi → har karta 1K/2K/4K faylni yuklab olardi (sekin grid). Best-effort:
 *  xatoda {null,null} — karta to'liq rasmga tushadi (eski xatti-harakat). */
type ImageAssetDerivs = {
  thumbKey: string | null;
  thumbUrl: string | null;
  displayKey: string | null; // P9 — 1280px WebP (Retina karta + alfa)
  width: number | null;
  height: number | null;
};
async function makeImageThumb(
  imageKey: string | null,
  buf: Buffer
): Promise<ImageAssetDerivs> {
  const none: ImageAssetDerivs = { thumbKey: null, thumbUrl: null, displayKey: null, width: null, height: null };
  if (!imageKey || !isS3Configured()) return none;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "genthumb-"));
  const inPath = path.join(tmpDir, "in.img");
  const outPath = path.join(tmpDir, "thumb.jpg");
  const dispBase = path.join(tmpDir, "disp");
  const base = imageKey.replace(/\.[a-z0-9]+$/i, "");
  const out: ImageAssetDerivs = { ...none };
  try {
    fs.writeFileSync(inPath, buf);
    // P11.2 — asl piksellar (srcset "1280×720" qatori + srcset kengligi uchun ishonchli manba)
    const dim = await probeMediaDimensions(inPath);
    if (dim) { out.width = dim.width; out.height = dim.height; }
    const okThumb = await makeImageThumbFile(inPath, outPath);
    if (okThumb) {
      const thumbKey = base + "-thumb.jpg";
      await uploadBufferToS3(fs.readFileSync(outPath), thumbKey, "image/jpeg");
      out.thumbKey = thumbKey;
      out.thumbUrl = await getSignedDownloadUrl(thumbKey, 3600);
    }
    // P9 — 1280px display derivativ (WebP; libwebp yo'q bo'lsa PNG/JPEG — xatoda thumb/asl fallback)
    const disp = await makeImageDisplayFile(inPath, dispBase);
    if (disp) {
      const displayKey = base + "-disp." + disp.ext;
      await uploadBufferToS3(fs.readFileSync(disp.path), displayKey, disp.contentType);
      out.displayKey = displayKey;
    }
    return out;
  } catch (e) {
    console.error("[gen] image thumb/display xato (e'tiborsiz):", e);
    return out;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* */
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeGenerationError(message: string): string {
  const raw = String(message || "");
  // BytePlus input moderation — sentinel prefiksni klientga ko'rsatmaymiz, faqat amaliy xabar qoladi.
  if (raw.startsWith(BYTEPLUS_INPUT_MODERATION_PREFIX)) {
    return raw.slice(BYTEPLUS_INPUT_MODERATION_PREFIX.length).trim();
  }
  // P30 §3 — HALOL xato, "soften the prompt" (evasion maslahati) OLIB TASHLANDI. Klient
  // (/gen/:jobId rejection) refund summasi + "boshqa model'da urinib ko'ring" taklifini qo'shadi.
  if (
    /output video has sensitive content|sensitive content|nsfw|sexual|nudity|content policy|safety system/i.test(raw)
  ) {
    return "The model's content safety filter rejected this request.";
  }
  return raw;
}

type StoredProviderJob =
  | { provider: "openrouter-video"; jobId: string; submittedAt: string }
  | ({ provider: "fal-video" | "fal-ref-video"; submittedAt: string } & FalQueueJob)
  // P19.1 — fal RASM jobi ham qayta-ulanadigan (resumable): provayder natijani yetkazgan,
  // biz saqlay olmagan bo'lsak, responseUrl'dan qayta olib saqlaymiz (qayta to'lov YO'Q).
  | ({ provider: "fal-image"; submittedAt: string } & FalQueueJob)
  | { provider: "byteplus-video"; taskId: string; submittedAt: string }
  | { provider: "kling-video"; taskId: string; submittedAt: string }
  // R4_03 PHASE 0 — Topaz resume kalitlari (dormant; hozircha yozilmaydi, R4_04'da ishlatiladi).
  | { provider: "topaz-image"; processId: string; submittedAt: string }
  | { provider: "topaz-video"; requestId: string; submittedAt: string }
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
    (provider === "fal-video" || provider === "fal-ref-video" || provider === "fal-image") &&
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
  if (provider === "byteplus-video" && typeof job.taskId === "string" && job.taskId) {
    return {
      provider,
      taskId: job.taskId,
      submittedAt: typeof job.submittedAt === "string" ? job.submittedAt : new Date().toISOString(),
    };
  }
  if (provider === "kling-video" && typeof job.taskId === "string" && job.taskId) {
    return {
      provider,
      taskId: job.taskId,
      submittedAt: typeof job.submittedAt === "string" ? job.submittedAt : new Date().toISOString(),
    };
  }
  if (provider === "topaz-image" && typeof job.processId === "string" && job.processId) {
    return {
      provider,
      processId: job.processId,
      submittedAt: typeof job.submittedAt === "string" ? job.submittedAt : new Date().toISOString(),
    };
  }
  if (provider === "topaz-video" && typeof job.requestId === "string" && job.requestId) {
    return {
      provider,
      requestId: job.requestId,
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
      return { ok: false, error: hook.error || hook.payloadError || "fal webhook error" };
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
    return { ok: false, error: finalHook.error || finalHook.payloadError || "fal webhook error" };
  }
  if (finalHook?.status === "OK") return { ok: true, data: finalHook.payload };
  return { ok: false, error: "FAL_TIMEOUT: job still running — no refund" };
}

function isResumableRunningGeneration(gen: {
  mode: string;
  status: string;
  params: unknown;
}): boolean {
  if (gen.status !== "running" || !gen.params || typeof gen.params !== "object") return false;
  const params = gen.params as Record<string, unknown>;
  if (gen.mode === "video") return Boolean(readProviderJob(params) || readProviderWebhook(params));
  // P19.1 — fal RASM jobi saqlangan bo'lsa rasm ham qayta-ulanadigan (resume). Boshqa rasm
  // provayderlari (byteplus/vertex-image) sinxron — job saqlanmaydi → resume yo'q (mavjud xatti-harakat).
  if (gen.mode === "image") {
    const job = readProviderJob(params);
    return Boolean(job && job.provider === "fal-image");
  }
  return false;
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
): Promise<{ url: string; key: string | null; sizeBytes: number }> {
  const key = `gen/${userId}/${genId}-${tsName()}.${ext}`;
  const sizeBytes = buf.length; // Bosqich 4 #4: storage kvota hisobi uchun
  if (isS3Configured()) {
    // Privacy (Bosqich 4 #4): assetlar `gen/<userId>/...` ostida, public ACL'siz
    // saqlanadi; faqat qisqa muddatli signed URL bilan beriladi (serve/download
    // route'lari egalikni tekshiradi: gen.userId !== req.user.userId → 404).
    await uploadBufferToS3(buf, key, contentType);
    return { url: await getSignedDownloadUrl(key, 3600), key, sizeBytes };
  }
  return { url: `data:${contentType};base64,${buf.toString("base64")}`, key: null, sizeBytes };
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
        if (!url) return { ok: false, error: "No video URL was returned" };
        const dl = await orDownload(url);
        if (!dl.ok) return { ok: false, error: dl.error };
        return { ok: true, buf: dl.data };
      }
      if (st.data.status === "failed") return { ok: false, error: "Video generation failed" };
    }
    await sleep(3000); // keyingi tekshiruvgacha
  }
  return { ok: false, error: "OPENROUTER_TIMEOUT: job still running — no refund" };
}

/** fal video natija javobidan URL'ni model deklaratsiyasi bo'yicha topib (B5) Buffer'ga yuklaydi. */
async function falVideoOut(
  model: GenModel,
  data: unknown
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const url = extractFalVideoUrl(model, data);
  if (!url) return { ok: false, error: "fal: video URL not found" };
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
    return { ok: false, error: "A start frame (referenceUrl) is required for video" };
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
    return { ok: false, error: savedHook.error || savedHook.payloadError || "fal webhook error" };
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
 * BATCH4 #2 — fal.ai Topaz video upscale (`fal-ai/topaz/upscale/video`). Manba = params.sourceKey
 * (route derivatsiyasi yozgan, egalik tekshirilgan). Narx allaqachon imzolangan quote'da
 * (perSec[tier] × billed soniya) — bu yerda faqat ish bajariladi. Webhook + poll + resume
 * naqshi runFalVideo bilan bir xil ('fal-video' provider-job qayta ishlatiladi).
 */
async function runFalVideoUpscale(
  model: GenModel,
  params: Record<string, unknown>,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const sourceKey = typeof params.sourceKey === "string" ? params.sourceKey : "";
  if (!sourceKey) return { ok: false, error: "Source video not found (sourceKey)" };
  const factor = Number(params.factor) === 4 ? 4 : 2;
  const savedHook = readProviderWebhook(params);
  if (savedHook?.status === "ERROR") {
    return { ok: false, error: savedHook.error || savedHook.payloadError || "fal webhook error" };
  }
  if (savedHook?.status === "OK") {
    return falVideoOut(model, savedHook.payload);
  }
  const saved = readProviderJob(params);
  let job: FalQueueJob;
  if (saved?.provider === "fal-video") {
    job = { requestId: saved.requestId, statusUrl: saved.statusUrl, responseUrl: saved.responseUrl };
  } else {
    // fal manbani TASHQARIDAN yuklab oladi — public/signed URL (2 soat; Topaz uzun ishlashi mumkin).
    const videoUrl = await getPublicOrSignedUrl(sourceKey, 7200);
    const input: Record<string, unknown> = {
      video_url: videoUrl,
      upscale_factor: factor,
      model: "Proteus", // universal default (Gaia 2 v1'da ochilmagan — narx tier'i Proteus bo'yicha)
    };
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
  // Topaz uzoq video/4K'da sekin — keng poll oynasi (R2V bilan teng, ~10 daq).
  const out = await waitForFalResult(genId, job, 360);
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
    return { ok: false, error: "An audio reference requires at least 1 image or video reference" };
  }
  if (imageUrls.length + videoUrls.length + audioUrls.length > lim.total) {
    return { ok: false, error: `Total references must be ≤${lim.total}` };
  }
  const v = resolveVideoParams(model, params);
  // B1: fal input model deklaratsiyasidan (Seedance R2V uchun natija eski bilan AYNAN bir xil).
  const input = buildFalVideoInput(model, prompt, v, { imageUrls, videoUrls, audioUrls }, userId);
  const savedHook = readProviderWebhook(params);
  if (savedHook?.status === "ERROR") {
    return { ok: false, error: savedHook.error || savedHook.payloadError || "fal webhook error" };
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
          error: "Video reference is too large — Seedance R2V currently does not accept video references over 50MB",
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
        error: "Video reference is too large — Seedance R2V currently does not accept video references over 50MB",
      };
    }
    return { ok: false, error: out.error };
  }
  return falVideoOut(model, out.data);
}

// BytePlus poll ramp — docs tavsiyasi (5–10s interval; 600ms fal rampi status API'ni ortiqcha uradi).
// 3×2s + 9×5s + qolgani 10s. maxPolls=100 → oyna ≈ 15.5 daqiqa (15s video/4k ham sig'adi,
// reconcile cutoff'i 20 daqiqadan kichik qoladi).
function byteplusWaitMs(i: number): number {
  return i < 3 ? 2000 : i < 12 ? 5000 : 10000;
}

/**
 * BATCH5 — BytePlus ModelArk Seedance video (3101 i2v Fast + 3102 r2v). fal'dagi ikkita runner'ning
 * provider-aware birlashmasi: i2v kadrlar (referenceUrl/referenceEndUrl) HAM ko'p-modal referens
 * (imageUrls/videoUrls/audioUrls) bitta content massiviga tushadi. Webhook YO'Q (v1 polling-only);
 * taskId persist qilinadi — server restart poll'ni davom ettiradi (FalQueueJob naqshi). Butun task
 * semafor slotida (Individual account: parallel 3 / 4k 1).
 */
async function runByteplusVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  const refEndUrl = typeof params.referenceEndUrl === "string" ? params.referenceEndUrl : null;
  if (!refUrl && videoRequiresStartFrame(model)) {
    return { ok: false, error: "A start frame (referenceUrl) is required for video" };
  }
  const matAll = async (val: unknown): Promise<string[]> => {
    const list = Array.isArray(val)
      ? (val as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    return Promise.all(list.map((u) => materializeRefUrl(userId, genId, u)));
  };
  const lim = model.mediaRefs ?? { image: 9, video: 3, audio: 3, total: 12 };
  const [startUrl, endUrl, imageUrlsRaw, videoUrlsRaw, audioUrlsRaw] = await Promise.all([
    refUrl ? materializeRefUrl(userId, genId, refUrl) : Promise.resolve(undefined),
    refEndUrl && model.endFrame
      ? materializeRefUrl(userId, genId, refEndUrl)
      : Promise.resolve(undefined),
    matAll(params.imageUrls),
    matAll(params.videoUrls),
    matAll(params.audioUrls),
  ]);
  const imageUrls = imageUrlsRaw.slice(0, lim.image);
  const videoUrls = videoUrlsRaw.slice(0, lim.video);
  const audioUrls = audioUrlsRaw.slice(0, lim.audio);
  // Schema (docs §3): "text+audio" / "faqat audio" qo'llanmaydi — audio bo'lsa kamida 1 rasm/video.
  if (audioUrls.length && !startUrl && imageUrls.length + videoUrls.length === 0) {
    return { ok: false, error: "An audio reference requires at least 1 image or video reference" };
  }
  if (imageUrls.length + videoUrls.length + audioUrls.length > lim.total) {
    return { ok: false, error: `Total references must be ≤${lim.total}` };
  }
  const v = resolveVideoParams(model, params);
  const body = buildByteplusVideoBody(model, prompt, v, {
    startUrl,
    endUrl,
    imageUrls,
    videoUrls,
    audioUrls,
  });
  const is4k = v.resolution === "4k";
  return withByteplusVideoSlot(is4k, async () => {
    const saved = readProviderJob(params);
    let taskId: string;
    if (saved?.provider === "byteplus-video") {
      taskId = saved.taskId; // restart'dan keyin resume — qayta submit YO'Q
    } else {
      const sub = await byteplusSubmitVideoTask(model.byteplusModel ?? model.key, body);
      if (!sub.ok) return { ok: false, error: sub.error };
      taskId = sub.data.taskId;
      console.log(`[byteplus] task yaratildi — model=${model.id} ${v.resolution}/${v.duration}s task=${taskId}`);
      await persistProviderJob(genId, params, {
        provider: "byteplus-video",
        taskId,
        submittedAt: new Date().toISOString(),
      });
    }
    for (let i = 0; i < 100; i++) {
      await sleep(byteplusWaitMs(i));
      const step = await byteplusPollStep(taskId);
      if (!step.ok) return { ok: false, error: step.error };
      if (step.data.state === "completed") {
        const { videoUrl, usage } = step.data.data;
        // P24 Tier 2 — BytePlus real token sarfini O'LCHANGAN USD sifatida ProviderSpend'ga yozamiz
        // (estimator gen yaratilishida yozgan; bu measured bilan yangilaydi). Analitika — money zone emas.
        if (usage) {
          const usd = byteplusTokensToUsd(usage.total_tokens);
          console.log(
            `[byteplus] task=${taskId} usage total_tokens=${usage.total_tokens ?? "?"} → measured $${usd.toFixed(4)}`
          );
          if (usd > 0) await recordMeasuredProviderCost(genId, usd);
        }
        const dl = await byteplusVideoUrlToBuffer(videoUrl);
        if (!dl.ok) return { ok: false, error: dl.error };
        return { ok: true, buf: dl.data };
      }
    }
    return { ok: false, error: BYTEPLUS_TIMEOUT_ERROR };
  });
}

// ── KLING (R4_02) — DIRECT API video runner. byteplus runner naqshi: submit → persist (taskId) →
//    poll → download. Webhook YO'Q (polling-only); server restart poll'ni davom ettiradi (resume).
//    In-process semafor (Kling concurrency 1303 sentinel bilan birga) — hammasini bitta slotда emas.
const KLING_VIDEO_CONCURRENCY = (() => {
  const v = Number(process.env.KLING_VIDEO_CONCURRENCY);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 3;
})();
let klActive = 0;
const klWaiters: Array<() => void> = [];
async function withKlingVideoSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (klActive >= KLING_VIDEO_CONCURRENCY) await new Promise<void>((r) => klWaiters.push(r));
  klActive++;
  try {
    return await fn();
  } finally {
    klActive--;
    const w = klWaiters.splice(0, klWaiters.length);
    for (const r of w) r();
  }
}
function klingWaitMs(i: number): number {
  return i < 3 ? 3000 : i < 15 ? 6000 : 10000; // video ~5-10 daqiqagacha (120 iteratsiya)
}

/**
 * Kling video (t2v/i2v/turbo/omni) — provider === "kling". Kadr referens (referenceUrl/End) HAM
 * ko'p-modal referens (imageUrls/videoUrls) buildKlingVideoRequest orqali to'g'ri endpoint+body'ga
 * tushadi. Referens URL'lar materializeRefUrl bilan provider-fetchable public/signed URL'ga aylanadi
 * (byteplus naqshi). refund faqat HAQIQIY fail'da (timeout/rate-limit sentinel refund QILMAYDI).
 */
async function runKlingVideo(
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>,
  userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  const refEndUrl = typeof params.referenceEndUrl === "string" ? params.referenceEndUrl : null;
  if (!refUrl && videoRequiresStartFrame(model)) {
    return { ok: false, error: "A start frame (referenceUrl) is required for video" };
  }
  const matAll = async (val: unknown): Promise<string[]> => {
    const list = Array.isArray(val)
      ? (val as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    return Promise.all(list.map((u) => materializeRefUrl(userId, genId, u)));
  };
  const lim = model.mediaRefs ?? { image: 0, video: 0, audio: 0, total: 0 };
  const [startUrl, endUrl, imageUrlsRaw, videoUrlsRaw] = await Promise.all([
    refUrl ? materializeRefUrl(userId, genId, refUrl) : Promise.resolve(undefined),
    refEndUrl && model.endFrame ? materializeRefUrl(userId, genId, refEndUrl) : Promise.resolve(undefined),
    matAll(params.imageUrls),
    matAll(params.videoUrls),
  ]);
  const imageUrls = imageUrlsRaw.slice(0, lim.image);
  const videoUrls = videoUrlsRaw.slice(0, lim.video);
  const v = resolveVideoParams(model, params);
  const { path, body } = buildKlingVideoRequest(model, prompt, v, {
    startUrl,
    endUrl,
    imageUrls,
    videoUrls,
  });
  return withKlingVideoSlot(async () => {
    const saved = readProviderJob(params);
    let taskId: string;
    if (saved?.provider === "kling-video") {
      taskId = saved.taskId; // restart'dan keyin resume — qayta submit YO'Q
    } else {
      const sub = await klingSubmitVideo(path, body);
      if (!sub.ok) return { ok: false, error: sub.error };
      taskId = sub.data.taskId;
      console.log(`[kling] task yaratildi — model=${model.id} ${v.resolution}/${v.duration}s task=${taskId}`);
      await persistProviderJob(genId, params, {
        provider: "kling-video",
        taskId,
        submittedAt: new Date().toISOString(),
      });
    }
    for (let i = 0; i < 120; i++) {
      await sleep(klingWaitMs(i));
      const step = await klingPollVideoStep(taskId);
      if (!step.ok) return { ok: false, error: step.error };
      if (step.data.state === "completed") {
        const dl = await klingVideoUrlToBuffer(step.data.data.videoUrl);
        if (!dl.ok) return { ok: false, error: dl.error };
        return { ok: true, buf: dl.data };
      }
    }
    return { ok: false, error: KLING_TIMEOUT_ERROR };
  });
}

// ── TOPAZ (R4_03) — PHASE 0 DORMANT runnerlar. ⚠️ HOZIRCHA HECH QANDAY katalog model provider
//    "topaz" EMAS → bu ikki funksiya normal oqimda CHAQIRILMAYDI (switch'ga ulangan, kompilyatsiya
//    qilinadi, lekin hit bo'lmaydi). R4_04 modellarni (Proteus video / Gigapixel rasm) yoqadi.
//    byteplus runner naqshi: submit → persist → poll → download. Money-zone TEGILMAGAN.
async function runTopazImage(
  model: GenModel,
  params: Record<string, unknown>,
  genId: string
): Promise<OrResult<Buffer>> {
  const sourceUrl =
    typeof params.sourceUrl === "string"
      ? params.sourceUrl
      : typeof params.referenceUrl === "string"
        ? params.referenceUrl
        : "";
  if (!sourceUrl) return { ok: false, error: "A source image is required for Topaz enhance" };
  const saved = readProviderJob(params);
  let processId: string;
  if (saved?.provider === "topaz-image") {
    processId = saved.processId;
  } else {
    // R4_07 — endpoint/model/output model DEKLARATSIYASIDAN (topazEndpoint/topazModel/
    // topazOutputFormat): Gigapixel → enhance+"Standard V2"+png · RemoveBG → matting+"RemoveBG"+
    // (format YO'Q → default RGBA). params.topazModel override (kelajakda UI).
    const sub = await topazSubmitImageEnhance({
      sourceUrl,
      endpoint: (model.topazEndpoint as TopazImageEndpoint | undefined) || "enhance",
      model: model.topazModel || (typeof params.topazModel === "string" ? params.topazModel : "Standard V2"),
      outputFormat: model.topazOutputFormat, // undefined → adapter output_format yubormaydi (RemoveBG)
    });
    if (!sub.ok) return { ok: false, error: sub.error };
    processId = sub.data.processId;
    await persistProviderJob(genId, params, {
      provider: "topaz-image",
      processId,
      submittedAt: new Date().toISOString(),
    });
  }
  for (let i = 0; i < 120; i++) {
    await sleep(byteplusWaitMs(i));
    const step = await topazPollImageStep(processId);
    if (!step.ok) return { ok: false, error: step.error };
    if (step.data.state === "completed") return topazImageDownload(processId);
  }
  return { ok: false, error: TOPAZ_TIMEOUT_ERROR };
}

async function runTopazVideo(
  model: GenModel,
  _prompt: string,
  params: Record<string, unknown>,
  _userId: string,
  genId: string
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const saved = readProviderJob(params);
  let requestId: string;
  if (saved?.provider === "topaz-video") {
    requestId = saved.requestId;
  } else {
    // R4_07 — manba = params.sourceKey (o'z gen/upload; cost-quote canonicalize qiladi). Bizning R2/GCS
    // presigned URL S3-mos → Topaz tashqi manba sifatida O'ZI yuklab oladi (re-upload SHART EMAS).
    let sourceUrl = typeof params.sourceUrl === "string" ? params.sourceUrl : "";
    const sourceKey = typeof params.sourceKey === "string" ? params.sourceKey : "";
    if (!sourceUrl && sourceKey) {
      try { sourceUrl = await getSignedDownloadUrl(sourceKey, 3600); } catch { /* pastda tekshiriladi */ }
    }
    if (!sourceUrl) return { ok: false, error: "A source video is required for Topaz upscale" };
    // Chiqish geometriyasi manba metasi × faktor'dan (Proteus upscale nisbatni saqlaydi).
    const meta = await probeVideoMetaUrl(sourceUrl);
    const factor = Number(params.factor) === 4 ? 4 : 2;
    const output: Record<string, unknown> = meta
      ? {
          resolution: { width: meta.width * factor, height: meta.height * factor },
          frameRate: meta.fps || 30,
          audioCodec: "AAC",
          audioTransfer: "Copy",
          videoEncoder: "H265",
          videoProfile: "Main",
          dynamicCompressionLevel: "High",
          container: "mp4",
        }
      : {};
    const create = await topazCreateVideoRequest({
      source: {
        container: "mp4",
        ...(meta ? { duration: meta.durationSec, frameRate: meta.fps, resolution: { width: meta.width, height: meta.height } } : {}),
        external: { provider: "s3", presignedUrl: sourceUrl },
      },
      filters: [{ model: model.topazModel || (typeof params.topazModel === "string" ? params.topazModel : "prob-4"), auto: "Auto" }],
      output,
    });
    if (!create.ok) return { ok: false, error: create.error };
    requestId = create.data.requestId;
    const accept = await topazAcceptVideoRequest(requestId);
    if (!accept.ok) return { ok: false, error: accept.error };
    // Tashqi manba → Topaz o'zi yuklab oladi (urls bo'lsa ham PUT shart emas); bo'lmasa lifecycle davom etadi.
    await persistProviderJob(genId, params, {
      provider: "topaz-video",
      requestId,
      submittedAt: new Date().toISOString(),
    });
  }
  for (let i = 0; i < 180; i++) {
    await sleep(byteplusWaitMs(i));
    const step = await topazPollVideoStep(requestId);
    if (!step.ok) return { ok: false, error: step.error };
    if (step.data.state === "completed") {
      const dl = await topazVideoUrlToBuffer(step.data.data.videoUrl);
      if (!dl.ok) return { ok: false, error: dl.error };
      return { ok: true, buf: dl.data };
    }
  }
  return { ok: false, error: TOPAZ_TIMEOUT_ERROR };
}

/** data:URI yoki http(s) URL'ni Vertex kutgan inline base64 rasmga aylantiradi. */
async function refUrlToInlineImage(
  refUrl: string
): Promise<{ data: string; mimeType: string } | null> {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(refUrl);
  if (m) return { data: m[2], mimeType: m[1] || "image/jpeg" };
  let res: Response;
  try {
    res = await fetchSafe(refUrl); // SSRF: faqat bizning bucket/data-URI
  } catch {
    return null;
  }
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
    if (!key) return { ok: false, error: `Vertex: unexpected GCS location — ${poll.data.gcsUri}` };
    const buf = await downloadS3ToBuffer(key);
    return { ok: true, buf };
  }
  return { ok: false, error: "VERTEX_TIMEOUT: job still running — no refund" };
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
      const res = await fetchSafe(url); // SSRF: bizning bucket bo'lmasa throw → catch → null
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

  // P8 C2: mediaRefs.total ham enforce qilinadi (oldin img≤3 + vid≤2 = 5 ketishi mumkin edi).
  const cappedImages = imageRefs.slice(0, lim.image);
  const totalCap = typeof lim.total === "number" && lim.total > 0 ? lim.total : lim.image + lim.video;
  const cappedVideos = videoRefs.slice(0, Math.max(0, Math.min(lim.video, totalCap - cappedImages.length)));
  const inlines = (await Promise.all(cappedImages.map((u) => refUrlToInlineImage(u)))).filter(
    (x): x is { data: string; mimeType: string } => !!x
  );
  const vids = (await Promise.all(cappedVideos.map((u) => videoRefToOmniInput(u)))).filter(
    (x): x is { gsUri?: string; data?: string } => !!x
  );
  if (cappedVideos.length && vids.length < cappedVideos.length)
    return { ok: false, error: "Video reference is too large or failed to upload (needs gs:// or ≤15MB)" };

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
/**
 * P19.1/P19.5 — fal RASM generatsiyasi RESUME bilan (video `runFalVideo` naqshi bilan bir xil).
 * fal queue jobi (`requestId/statusUrl/responseUrl`) `__providerJob`ga saqlanadi. Agar jarayon
 * o'lsa (Cloud Run restart) natija YO'QOLMAYDI:
 *   1) `settleStuckGeneration` refunddan OLDIN shu job'ni provayderdan so'raydi (probe);
 *   2) 30s resume-jadval processGeneration'ni qayta uradi → biz saqlangan job'ni QAYTA poll qilib
 *      responseUrl'dagi natijani olamiz — QAYTA SUBMIT / QAYTA TO'LOV YO'Q (provayder allaqachon
 *      to'langan; foydalanuvchi to'lagan narsasini oladi).
 * FAQAT count===1'da ishlaydi (bitta `__providerJob` sloti bor; count>1 bir nechta parallel job =
 * mavjud xatti-harakat, resume YO'Q → qisman tugash + qayta to'lovdan xoli). Money-zone: bu yerda
 * kredit/quote/refund YO'Q — faqat yetkazish yo'li.
 */
async function runFalImage(
  modelId: string,
  prompt: string,
  opts: {
    imageUrls?: string[];
    aspect?: string | null;
    quality?: string | null;
    settings?: FalImageSettings;
    noNumParam?: boolean;
    outputFormat?: string;
  },
  params: Record<string, unknown>,
  genId: string
): Promise<OrResult<Buffer>> {
  const saved = readProviderJob(params);
  if (saved?.provider === "fal-image") {
    // RESUME — provayder allaqachon to'langan: natijani QAYTA olamiz (submit YO'Q).
    const step = await falPollStep({
      requestId: saved.requestId,
      statusUrl: saved.statusUrl,
      responseUrl: saved.responseUrl,
    });
    if (!step.ok) return step; // provayder ANIQ yiqildi/rad etdi → fail+refund (mavjud yo'l)
    if (step.data.state !== "completed")
      // hali ishlayapti → FAL_TIMEOUT sentinel: "running" qoladi, KREDIT QAYTMAYDI (reconcile/resume hal qiladi)
      return { ok: false, error: "FAL_TIMEOUT: job still running — no refund" };
    return falImageResultToBuffer(step.data.data);
  }
  // Yangi topshiriq — job'ni DARHOL saqlaymiz (onJob), so'ng falImage ichki poll qiladi. Jarayon
  // poll paytida o'lsa job saqlangan → yuqoridagi resume yo'li tiklaydi.
  return falImage(modelId, prompt, {
    ...opts,
    onJob: (job) =>
      persistProviderJob(genId, params, {
        provider: "fal-image",
        requestId: job.requestId,
        statusUrl: job.statusUrl,
        responseUrl: job.responseUrl,
        submittedAt: new Date().toISOString(),
      }),
  });
}
/**
 * Chiqish moderatsiyasi (Bosqich 2 #1, env-gated MODERATION_MODERATE_OUTPUTS) — generatsiya
 * NATIJASIDAGI rasm assetlarini ML klassifikatorga yuboradi. Og'ir kategoriya aniqlansa
 * assetlar o'chiriladi va Error otiladi → processGeneration catch → fail()=failed+refund
 * (bloklangan gen'ga charge qolmaydi). Video/audio bu API'da tekshirilmaydi. API xatosi →
 * fail-open (input moderatsiya allaqachon og'ir kategoriyalarni gate qilgan). Best-effort.
 */
async function moderateGeneratedOutput(gen: {
  id: string;
  userId: string;
  mode: string;
  modelId: number;
}): Promise<void> {
  if (!moderateOutputsEnabled()) return;
  let result;
  try {
    const assets = await prisma.genAsset.findMany({
      where: { generationId: gen.id, type: ASSET_TYPE.image },
      select: { url: true },
    });
    const urls = assets
      .map((a) => a.url)
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u));
    if (!urls.length) return;
    result = await moderateContent({ imageUrls: urls });
  } catch (e) {
    console.warn("[moderation] output check xato — fail-open:", e instanceof Error ? e.message : e);
    return;
  }
  if (!result.blocked) return;
  await prisma.genAsset.deleteMany({ where: { generationId: gen.id } });
  await writeAuditLog({
    actorId: gen.userId,
    action: "moderation.blocked",
    targetType: "generation",
    targetId: gen.id,
    detail: result.reason || "output moderation blocked",
    meta: { layer: "ml-output", categories: result.categories, severity: result.severity, mode: gen.mode, modelId: gen.modelId },
  });
  throw new Error(`MODERATION_OUTPUT_BLOCKED: ${result.reason || "output did not pass moderation"}`);
}

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
    if (upd.count > 0) {
      await refundAiCredits(gen.userId, gen.cost, { generationId: genId });
      // P19.6 — YETIM FAYL: provayder yetkazgan bo'lishi mumkin (case C / moderation-block: asset
      // yaratilib keyin o'chirilgan) — bu obyektlar hech ko'rsatilmaydi, ammo omborni band qiladi.
      // Terminal refunddan KEYIN prefiks bo'yicha tozalaymiz. Best-effort — gen'ni bloklamaydi.
      await deleteGenObjectsByPrefix(gen.userId, genId).catch((e) =>
        console.warn(`[studio-gen] P19.6 yetim fayl tozalash xato (${genId}):`, e instanceof Error ? e.message : e)
      );
      // P30.5 — provayder KONTENT rad etsa: LOGGA yoz (provayder/model/kategoriya/son) + P30.4
      // rate-limit sanog'i (refund-farming). Tasnif ASL xato matnidan (normalize'dan oldingi signal).
      const model = getModelById(gen.modelId);
      const rej = classifyGenRejection(reason, { provider: model?.provider });
      if (rej.isContent) {
        await writeAuditLog({
          actorId: gen.userId,
          action: "provider.content_rejected",
          targetType: "generation",
          targetId: genId,
          detail: (rej.raw || rej.reason).slice(0, 240), // audit: ASL provayder matni (toza sabab emas)
          meta: { provider: model?.provider || null, modelId: gen.modelId, mode: gen.mode, category: rej.category },
        }).catch(() => {});
        await noteBlockedAttempt(gen.userId).catch(() => {});
      }
    }
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
    if (!model) return void (await fail("Unknown model"));

    const params = (gen.params ?? {}) as Record<string, unknown>;
    const aspectRatio = typeof params.aspectRatio === "string" ? params.aspectRatio : null;
    const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;

    if (
      model.feature === "text-to-image" ||
      model.feature === "image-edit" ||
      model.feature === "image-upscale"
    ) {
      // image_config — NATIVE o'lcham/nisbat (promptga qo'shilmaydi).
      const quality = typeof params.quality === "string" ? params.quality : null;
      // PARAM GIGIYENASI (rasm) — video resolveVideoParams kabi, faqat model QO'LLAYDIGAN nisbat/
      // o'lchamni provayderga yuboramiz. Klient eski/yaroqsiz qiymat yuborsa (masalan Imagen'ga 21:9
      // yoki 4K) provayder 400 bermasin / kredit behuda ketmasin. NARXGA TA'SIR QILMAYDI: nisbat narx
      // formulasida umuman yo'q; o'lcham narxini computeGenCost/imageUnitCost RAW params.quality'dan
      // (image_size'dan EMAS) hisoblaydi va yaroqsiz qiymatда o'zi def tier'ga tushadi → yuborilgan
      // tier bilan olingan narx izchil qoladi.
      const imgAspect =
        aspectRatio && model.aspects && model.aspects.length
          ? model.aspects.includes(aspectRatio)
            ? aspectRatio
            : model.aspects[0]
          : aspectRatio;
      const imgSize =
        quality && model.resolutions && model.resolutions.length && !model.resolutions.includes(quality)
          ? null // yaroqsiz o'lcham → yubormaymiz (adapter model default'iga tushadi)
          : quality;
      const imageConfig: { aspect_ratio?: string; image_size?: string } = {};
      if (imgAspect) imageConfig.aspect_ratio = imgAspect;
      if (imgSize) imageConfig.image_size = imgSize;
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
      const useByteplusImg = model.provider === "byteplus"; // Seedream (ModelArk, sinxron /images/generations)
      const useKlingImg = model.provider === "kling"; // R4_02 — Kling Image 3.0 (direct API, async task)
      const useTopazImg = model.provider === "topaz"; // R4_03 PHASE 0 — dormant (hech qanday model yo'q)
      const mModel = model.magnificModel ?? "realism";
      // Dedicated Magnific tool (upscale/relight/camera/skin/extend/removebg) — manba rasm yeydi.
      // Faqat provider=magnific; openrouter'да ekvivalent yo'q → aniq xato (UI "Tez orada" qoladi).
      const mfTool = model.magnificTool;
      if (mfTool && !useMagnific) return void (await fail("This tool is Magnific-only (GEN_PROVIDER=magnific)"));
      if (mfTool && !refUrl) return void (await fail("A source image is required — select an AE comp or layer"));
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
      // byteplus (Seedream) ham referensni PUBLIC URL sifatida oladi — fal bilan bir xil yo'l;
      // farqi: Seedream'da referens IXTIYORIY (refMode 'optional') — bo'sh bo'lsa sof t2i.
      const falNeedsRef = (useFal || useByteplusImg || useKlingImg) && refMode !== "none"; // edit modeli referens talab qiladi; t2i — yo'q
      if (falNeedsRef) {
        // P8 C3: fal yo'lida ham maxRefs server-side kesiladi.
        const falRefCap = typeof model.maxRefs === "number" && model.maxRefs > 0 ? model.maxRefs : undefined;
        const rawRefs: string[] = (
          Array.isArray(params.referenceUrls)
            ? (params.referenceUrls as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
            : refUrl
              ? [refUrl]
              : []
        ).slice(0, falRefCap);
        if (!rawRefs.length && !((useByteplusImg || useKlingImg) && model.refMode !== "required"))
          return void (await fail("An image is required for editing — upload one via ＋"));
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
      // P8 C3: katalog maxRefs endi SERVER'da ham kesiladi (oldin faqat UI cheklardi).
      const refCap = typeof model.maxRefs === "number" && model.maxRefs > 0 ? model.maxRefs : Infinity;
      const vertexRefUrls: string[] = (
        Array.isArray(params.referenceUrls)
          ? (params.referenceUrls as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
          : refUrl
            ? [refUrl]
            : []
      ).slice(0, refCap === Infinity ? undefined : refCap);
      // BATCH4 #1 — upscale: manba rasm MAJBURIY (route refMode gate ham bor; bu ikkinchi to'siq).
      const isUpscale = model.feature === "image-upscale";
      if (isUpscale && !vertexRefUrls.length)
        return void (await fail("A source image is required for upscaling"));
      const upFactor: "x2" | "x4" = params.quality === "x4" ? "x4" : "x2"; // imageUnitCost def bilan mos (x2)
      // R4_05 — BytePlus (Seedream) rasm token sarfini job bo'yicha yig'amiz (count>1 = N chaqiruv);
      // job tugagach token→USD measured xarajat sifatida yoziladi (flat-price rasm o'lchovi). Analitika.
      let byteplusImageTokens = 0;
      const genOne = (): Promise<OrResult<Buffer>> =>
        useTopazImg
          ? runTopazImage(model, params, genId) // R4_03 PHASE 0 — dormant (never hit; no topaz model)
          : useKlingImg
          ? // R4_02 — Kling Image (async task; bitta rasm/chaqiruv, count>1 = mapLimit N ta alohida).
            klingImage(model, {
              prompt: gen.prompt,
              imageUrls: falImageUrls,
              resolution: imageConfig.image_size,
              aspect: imageConfig.aspect_ratio,
            }).then(
              (r): OrResult<Buffer> =>
                r.ok
                  ? r.data[0]
                    ? { ok: true, data: r.data[0] }
                    : { ok: false, error: "kling: empty result" }
                  : r
            )
          : useByteplusImg
          ? // Seedream — sinxron, bitta rasm/chaqiruv (count>1 = mapLimit N ta alohida chaqiruv).
            // size: tier + nisbat → adapter §8 jadvaldan aniq piksel tanlaydi (nisbat narxga ta'sir qilmaydi).
            byteplusImage(model.byteplusModel ?? model.key, {
              prompt: gen.prompt,
              imageUrls: falImageUrls,
              size: imageConfig.image_size,
              aspect: imageConfig.aspect_ratio,
            }).then(
              (r): OrResult<Buffer> => {
                if (r.ok) byteplusImageTokens += Number(r.usage?.total_tokens) || 0; // R4_05 measured
                return r.ok
                  ? r.data[0]
                    ? { ok: true, data: r.data[0] }
                    : { ok: false, error: "byteplus: empty result" }
                  : r;
              }
            )
          : useVertexImg
          ? isUpscale
            ? vertexImageUpscale(model.key, vertexRefUrls[0], upFactor)
            : useEdit
            ? vertexImageEdit(model.key, gen.prompt, vertexRefUrls, { aspectRatio: imageConfig.aspect_ratio, imageSize: imageConfig.image_size })
            : vertexImage(model.key, gen.prompt, { aspectRatio: imageConfig.aspect_ratio, imageSize: imageConfig.image_size })
          : useFal
          ? // P19.1: count===1 → RESUME bilan (job saqlanadi, jarayon o'lsa responseUrl'dan qayta olinadi).
            // count>1 → bir nechta parallel job (bitta slot sig'maydi) → mavjud, resume-siz yo'l.
            count === 1
            ? runFalImage(model.falModel ?? model.key, gen.prompt, { imageUrls: falImageUrls, aspect: aspectRatio, quality, settings: model.imgSettings, noNumParam: model.noNumParam, outputFormat: model.outputFormat }, params, genId)
            : falImage(model.falModel ?? model.key, gen.prompt, { imageUrls: falImageUrls, aspect: aspectRatio, quality, settings: model.imgSettings, noNumParam: model.noNumParam, outputFormat: model.outputFormat })
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
      type Slot = { ok: true; url: string; key: string | null; sizeBytes: number; thumbKey: string | null; thumbUrl: string | null; displayKey: string | null; width: number | null; height: number | null } | { ok: false; error: string };
      const slots = await mapLimit<Slot>(count, IMG_CONCURRENCY, async (): Promise<Slot> => {
        const out = await genOne();
        if (!out.ok) return { ok: false, error: out.error };
        const fmt = detectMediaFormat(out.data, { ext: "png", contentType: "image/png" });
        const p = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
        // P4/P9: bufer scope'da ekan thumb (512) + display (1280 WebP) + o'lcham — grid tez + Retina aniq.
        const th = await makeImageThumb(p.key, out.data);
        // P1 (owner 2026-07-14): AI-gen HECH QACHON suv belgilanmaydi (kredit = to'lov). watermarkKey yozilmaydi.
        return { ok: true, url: p.url, key: p.key, sizeBytes: p.sizeBytes, thumbKey: th.thumbKey, thumbUrl: th.thumbUrl, displayKey: th.displayKey, width: th.width, height: th.height };
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
          // aspectRatio = EFEKTIV (klamplangan) nisbat — thumbnail ramka nisbati generatsiya bilan mos bo'lsin.
          // P4: thumbUrl endi HAQIQIY kichik thumb (bo'lmasa to'liq rasm — eski xatti-harakat).
          // P9: displayKey (1280 WebP) + width/height (haqiqiy piksellar) qo'shildi.
          // P1 (owner 2026-07-14): AI-gen HECH QACHON suv belgilanmaydi (kredit = to'lov). watermarkKey yozilmaydi.
          data: { generationId: genId, type: ASSET_TYPE.image, url: s.url, resultKey: s.key, thumbUrl: s.thumbUrl ?? s.url, thumbKey: s.thumbKey, displayKey: s.displayKey, width: s.width, height: s.height, aspectRatio: imgAspect, sizeBytes: s.sizeBytes },
        });
      }
      // R4_05 — BytePlus rasm real token sarfini O'LCHANGAN USD sifatida ProviderSpend'ga yozamiz
      // (video token o'lchovining rasm ekvivalenti; billing token bilan — jonli tasdiqlangan). Best-effort,
      // ANALITIKA: kredit/refund matematikasiga TEGMAYDI. Bu measured qiymat resolveProviderUsd orqali
      // marja panel + apply-margin'ni Seedream Lite/4.5 uchun $0.5 fail-safe'dan haqiqiy ~$0.07'ga kalibrlaydi.
      if (useByteplusImg && byteplusImageTokens > 0) {
        const usd = byteplusTokensToUsd(byteplusImageTokens);
        console.log(
          `[byteplus] image job=${genId} total_tokens=${byteplusImageTokens} → measured $${usd.toFixed(4)}`
        );
        if (usd > 0) await recordMeasuredProviderCost(genId, usd);
      }
      // P19.1 — muvaffaqiyatli tugadi: saqlangan fal-image job'ni tozalaymiz (no-op agar yo'q) →
      // reconcile/resume endi bu (done) gen'ga tegmaydi.
      await clearProviderJob(genId);
    } else if (model.feature === "text-to-speech") {
      // Voice MAJBURIY (bo'sh → "expected string" xatosi). P8 C6: katalog `voices`
      // ro'yxatiga qarshi VALIDATSIYA — noma'lum voice → birinchi katalog voice.
      const requestedVoice = typeof params.voice === "string" ? params.voice : "";
      const knownVoices = Array.isArray(model.voices) ? model.voices.map((v) => v.id) : [];
      const voice = knownVoices.includes(requestedVoice)
        ? requestedVoice
        : knownVoices[0] || "af_bella";
      // BATCH4 #4 — provider'ga qarab: google-tts (Chirp 3 HD) yoki eski OpenRouter yo'li.
      // maxChars himoya kamari: route /gen kreditdan OLDIN 400 qaytaradi; bu yerda defensiv kesim
      // (narx flat — kesim foydalanuvchini ORTIQCHA to'lashdan emas, bizni ortiqcha sarfdan saqlaydi).
      const speechText =
        typeof model.maxChars === "number" && model.maxChars > 0
          ? gen.prompt.slice(0, model.maxChars)
          : gen.prompt;
      const out =
        model.provider === "google-tts"
          ? await googleTtsSynthesize(voice, speechText)
          : await orSpeech(model.key, speechText, voice);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key, sizeBytes } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      // P1 (owner 2026-07-14): AI-gen HECH QACHON suv belgilanmaydi (kredit = to'lov). watermarkKey yozilmaydi.
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key, sizeBytes },
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
      const { url, key, sizeBytes } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      // P1 (owner 2026-07-14): AI-gen HECH QACHON suv belgilanmaydi (kredit = to'lov). watermarkKey yozilmaydi.
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key, sizeBytes },
      });
    } else if (
      model.feature === "text-to-video" ||
      model.feature === "image-to-video" ||
      model.feature === "reference-to-video" ||
      model.feature === "video-upscale"
    ) {
      const out =
        model.provider === "kling"
          ? await runKlingVideo(model, gen.prompt, params, gen.userId, genId) // R4_02 — Kling 3.0 (direct)
          : model.provider === "topaz"
          ? await runTopazVideo(model, gen.prompt, params, gen.userId, genId) // R4_03 PHASE 0 — dormant
          : model.provider === "byteplus"
          ? await runByteplusVideo(model, gen.prompt, params, gen.userId, genId) // BATCH5 — Seedance (i2v + r2v)
          : model.feature === "video-upscale"
          ? await runFalVideoUpscale(model, params, genId) // BATCH4 #2 — Topaz (manba sourceKey)
          : model.feature === "reference-to-video"
          ? await runFalRefVideo(model, gen.prompt, params, gen.userId, genId) // R2V — ko'p-modal referens
          : model.provider === "fal"
            ? await runFalVideo(model, gen.prompt, params, gen.userId, genId)
            : model.provider === "vertex"
              ? await runVertexVideo(model, gen.prompt, params, gen.userId, genId)
              : model.provider === "vertex-omni"
                ? await runVertexOmniVideo(model, gen.prompt, params, gen.userId, genId)
                : await runVideo(model, gen.prompt, params, gen.userId, genId);
      // BytePlus rate-limit (backoff ham yetmadi): FAILURE EMAS — refund yo'q, job queued'ga qaytadi;
      // resume jadvali (30s) qayta uradi, 20-daq reconcile cutoff'i baribir chegaralaydi.
      if (!out.ok && (out.error.startsWith("BYTEPLUS_RATE_LIMITED") || out.error.startsWith("KLING_RATE_LIMITED"))) {
        await prisma.generation.updateMany({
          where: { id: genId, status: "running" },
          data: { status: "queued" },
        });
        return;
      }
      if (
        !out.ok &&
        (out.error.startsWith("FAL_TIMEOUT") ||
          out.error.startsWith("BYTEPLUS_TIMEOUT") ||
          out.error.startsWith("KLING_TIMEOUT") ||
          out.error.startsWith("TOPAZ_TIMEOUT") ||
          out.error.startsWith("OPENROUTER_TIMEOUT") ||
          out.error.startsWith("VERTEX_TIMEOUT"))
      ) {
        return;
      }
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.buf, { ext: "mp4", contentType: "video/mp4" });
      const { url, key, sizeBytes } = await persist(gen.userId, genId, out.buf, fmt.ext, fmt.contentType);
      const poster = await makeVideoPoster(key, out.buf);
      // P1 (owner 2026-07-14): AI-gen HECH QACHON suv belgilanmaydi (kredit = to'lov). watermarkKey yozilmaydi.
      await prisma.genAsset.create({
        // P9.2: previewKey (720p hover) + width/height qo'shildi.
        data: { generationId: genId, type: ASSET_TYPE.video, url, resultKey: key, thumbUrl: poster.thumbUrl ?? url, thumbKey: poster.thumbKey, previewKey: poster.previewKey, width: poster.width, height: poster.height, aspectRatio, sizeBytes },
      });
      await clearProviderJob(genId);
    } else {
      return void (await fail(`Unsupported type: ${model.feature}`));
    }

    // Chiqish moderatsiyasi (env-gated) — done'dan OLDIN. Og'ir kategoriya → throw → catch → fail+refund.
    await moderateGeneratedOutput({ id: genId, userId: gen.userId, mode: gen.mode, modelId: gen.modelId });

    // ATOMIK: faqat hali running bo'lsa done qil. Agar reconcile (10 daq) jobni failed+refund qilған
    // bo'lsa → count=0 → failed→done QILMAYMIZ (refund saqlanadi; assetlar history'да ko'rinmaydi —
    // "bepul gen" oldini olamiz). Double-refund race fix (audit 2026-06-26).
    await prisma.generation.updateMany({ where: { id: genId, status: "running" }, data: { status: "done" } });

    // Storage retention (Bosqich 4 #4) — yangi asset joylashgach kvotadan oshsa, eng
    // eski o'z assetlarni o'chirib joy bo'shatadi (best-effort; genni buzmaydi).
    enforceStorageRetention(gen.userId).catch((e) => console.error("enforceStorageRetention", e));
  } catch (e) {
    // Sentry (FAZA 3 A) — gen-processor asosiy async entrypoint: provider/moderatsiya/storage
    // xatolari kontekst bilan yuboriladi (DSN yo'q → no-op).
    captureException(e, { area: "gen-processor", genId });
    await fail(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Qotib qolgan generatsiyalarni tiklaydi (Render/Cloud Run restart fon jarayonni o'ldirsa job
 * "running"da qoladi). ASK-TRIGGER = 20 daqiqa (owner qarori 2026-07-01 — TEGMA). P19.5 (Direktor
 * qarori, majburiy): 20 daqiqada REFUND QILMAYMIZ — avval PROVAYDERDAN SO'RAYMIZ (job raqami
 * `__providerJob`da saqlangan). Provayder "ishlayapti/tayyor" desa → refund YO'Q (30s resume-jadval
 * uni haydaydi/yetkazadi); "yiqildim" desa YOKI qattiq shift (hard ceiling) o'tsa → SHUNDAGINA
 * fail+refund. /credits + POST /gen (per-user) va global fon jadvali chaqiradi.
 */
function stuckTimeoutMs(g: { mode: string; modelId: number }): number {
  // ASK-TRIGGER (refund EMAS) — owner so'rovi (2026-07-01): 20 daqiqa. P19.5 keyin provayderdan so'raydi.
  return 20 * 60 * 1000;
}

// P19.5 — QATTIQ SHIFT (hard ceiling): provayder umuman javob bermasa (probe har safar unreachable)
// ish abadiy osilmasin. Bundan oshsa provayder "ishlayapti" desa ham fail+refund. Bu GUESS emas —
// BACKSTOP: shuning uchun har model uchun KUTILGAN davomiylikdan ANCHA kengroq (hali ishlаётган
// jobni noto'g'ri refund qilmaslik uchun). Per-model (6s Seedance ≠ uzun videoning Topaz upscale'i):
// rasm/audio tez → 1 soat; video → 2 soat; video-upscale (Topaz, uzun 4K) → 4 soat.
const HOUR_MS = 60 * 60 * 1000;
function hardCeilingMs(model: GenModel | null | undefined): number {
  switch (model?.feature) {
    case "video-upscale":
      return 4 * HOUR_MS;
    case "text-to-video":
    case "image-to-video":
    case "reference-to-video":
      return 2 * HOUR_MS;
    case "text-to-speech":
    case "text-to-sfx":
    case "text-to-image":
    case "image-edit":
    case "image-upscale":
      return 1 * HOUR_MS;
    default:
      return 2 * HOUR_MS;
  }
}

/** Provayderga topshirilгan payt (ms) — job.submittedAt bo'lsa undan, aks holda gen.createdAt. */
function providerJobStartMs(job: StoredProviderJob | null, createdAt: Date): number {
  const s = job && typeof (job as { submittedAt?: string }).submittedAt === "string"
    ? Date.parse((job as { submittedAt?: string }).submittedAt as string)
    : NaN;
  return Number.isFinite(s) ? s : createdAt.getTime();
}

/**
 * P19.5 — provayderdan job holatini SO'RAYDI (refund qarorIDAN OLDIN). Video jobs va (P19.1)
 * fal-image jobs uchun. Qaytaradi:
 *   "alive"       — hali ishlayapti YOKI tayyor (yetkazish resume yo'lida) → REFUND YO'Q
 *   "failed"      — provayder ANIQ yiqilibdi/rad etibdi → refund
 *   "unreachable" — provayderga so'rov o'tmadi (transient) → refund YO'Q, keyingi tsiklда qayta so'raymiz
 * Money-zone: bu FAQAT o'qish/so'rov; kredit matematikasiga TEGMAYDI.
 */
async function probeProviderJob(job: StoredProviderJob): Promise<"alive" | "failed" | "unreachable"> {
  try {
    if (job.provider === "fal-video" || job.provider === "fal-ref-video" || job.provider === "fal-image") {
      // falPollStep: ok:true (pending|completed) = alive; transient(429/5xx/throw) ham pending; ok:false = failed.
      const r = await falPollStep({ requestId: job.requestId, statusUrl: job.statusUrl, responseUrl: job.responseUrl });
      return r.ok ? "alive" : "failed";
    }
    if (job.provider === "byteplus-video") {
      const r = await byteplusPollStep(job.taskId);
      return r.ok ? "alive" : "failed";
    }
    if (job.provider === "vertex-video") {
      const r = await vertexPollVideo({ operationName: job.operationName });
      if (!r.ok) return "unreachable"; // SDK istisnosi — transient bo'lishi mumkin
      return r.data.state === "error" ? "failed" : "alive";
    }
    if (job.provider === "openrouter-video") {
      const r = await orVideoStatus(job.jobId);
      if (!r.ok) return "unreachable";
      const s = (r.data.status || "").toLowerCase();
      return /fail|error|cancel|reject/.test(s) ? "failed" : "alive";
    }
  } catch {
    return "unreachable";
  }
  return "unreachable";
}

/**
 * P19.5 — SOF (side-effect'siz) refund QARORI. `settleStuckGeneration` provayderdan so'ragach shuni
 * chaqiradi. Bu yerda kredit/DB YO'Q → birlik-testlarda to'liq isbotlanadi (money-zone qaror izchilligi).
 * Direktor qarori (majburiy):
 *   still running / done / javobsiz (ceiling ichida) → refund YO'Q (kutamiz, resume yetkazadi)
 *   provayder ANIQ yiqildi                          → refund (provider failure)
 *   qattiq shift (hard ceiling) o'tdi               → refund (provayder abadiy javob bermasa backstop)
 *   job umuman yo'q (sinxron/eski)                  → refund (mavjud xatti-harakat)
 */
function decideStuckRefund(input: {
  hasJob: boolean;
  withinCeiling: boolean;
  probe: "alive" | "failed" | "unreachable" | null; // faqat (hasJob && withinCeiling) da so'raladi
}): { refund: boolean; reason: string } {
  if (!input.hasJob) return { refund: true, reason: "Timed out (auto-recovered) — credits refunded" };
  if (!input.withinCeiling) return { refund: true, reason: "Timed out past hard limit — credits refunded" };
  if (input.probe === "failed") return { refund: true, reason: "Provider reported failure — credits refunded" };
  // "alive" (ishlayapti/tayyor) yoki "unreachable" (transient) → kutamiz, refund YO'Q.
  return { refund: false, reason: "" };
}

/**
 * P19.5 — bitta qotган gen uchun QAROR: provayderdan so'rab, so'ng (kerak bo'lsa) atomik fail+refund.
 * 🔴 MONEY ZONE: atomik guard (`updateMany ... where status in (queued,running)` + count>0 → refund)
 * BAYT-BAYT saqlangan (audit 2026-06-26). Provayder-tekshiruvi FAQAT refund QARORIDAN OLDIN qo'shildi.
 * Qaytaradi: "refunded" | "skipped".
 *   - job bor + ceiling ichida + provayder "yiqilmagan" → SKIP (refund yo'q; resume-jadval haydaydi).
 *   - job yo'q / provayder failed / ceiling o'tgan → fail+refund (mavjud xatti-harakat).
 */
async function settleStuckGeneration(g: {
  id: string;
  userId: string;
  cost: number;
  modelId: number;
  createdAt: Date;
  params: unknown;
}): Promise<"refunded" | "skipped"> {
  const params =
    g.params && typeof g.params === "object" ? (g.params as Record<string, unknown>) : {};
  const job = readProviderJob(params);
  const model = getModelById(g.modelId);
  const withinCeiling = Date.now() - providerJobStartMs(job, g.createdAt) < hardCeilingMs(model);

  // Provayderdan FAQAT (job bor + ceiling ichida) so'raymiz — aks holda so'rovga hojat yo'q.
  const probe = job && withinCeiling ? await probeProviderJob(job) : null;
  const decision = decideStuckRefund({ hasJob: !!job, withinCeiling, probe });
  if (!decision.refund) {
    // Provayder tugatmagan/hali ishlayapti/javob bermadi → PUL QAYTARMAYMIZ (sekin 4K video
    // nosozlik EMAS). 30s resume-jadval (resumePendingGenerations) uni haydaydi/yetkazadi.
    console.log(`[studio-gen] P19.5 provayder-tekshiruvi: gen ${g.id} (${job?.provider}) → ${probe} → REFUND YO'Q, kutamiz`);
    return "skipped";
  }
  const reason = decision.reason;

  // 🔴 Atomik fail+refund — MAVJUD naqsh, O'ZGARMAYDI (double-refund race fix, audit 2026-06-26).
  const upd = await prisma.generation.updateMany({
    where: { id: g.id, status: { in: ["queued", "running"] } },
    data: { status: "failed", error: reason },
  });
  if (upd.count > 0) {
    await refundAiCredits(g.userId, g.cost, { generationId: g.id });
    // P19.6 — YETIM FAYL: provayder yetkazib, biz saqlagan bo'lsak-da gen refund bo'ldi → hech
    // ko'rsatilmaydigan obyektlar omborni band qiladi. Terminal refunddan KEYIN prefiks bo'yicha
    // tozalaymiz (resume tugadi — status=failed). Best-effort.
    await deleteGenObjectsByPrefix(g.userId, g.id).catch((e) =>
      console.warn(`[studio-gen] P19.6 yetim fayl tozalash xato (${g.id}):`, e instanceof Error ? e.message : e)
    );
    return "refunded";
  }
  return "skipped";
}

export async function reconcileStuckGenerations(userId: string): Promise<number> {
  const stuck = await prisma.generation.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
  });
  for (const g of stuck) {
    const cutoff = new Date(Date.now() - stuckTimeoutMs(g));
    if (g.createdAt >= cutoff) continue;
    // P19.5 — provayderdan so'rab, so'ng (kerak bo'lsa) atomik fail+refund.
    await settleStuckGeneration(g);
  }
  return stuck.length;
}

/**
 * P1 (money-zone refund TRIGGER — 2026-07-10): stuck gen refund'ini foydalanuvchi panelni QAYTA
 * ochishiga bog'lamay, FON JADVALIDA hal qiladi. Yuqoridagi `reconcileStuckGenerations` faqat
 * /credits + POST /gen'da (ya'ni panel ochilganda, per-user) ishlaydi. Bu GLOBAL variant BARCHA
 * userlarning cutoff'dan oshган queued/running genlarini ko'rib chiqadi. P19.5: avval provayderdan
 * so'raydi (settleStuckGeneration), atomik naqsh BAYT-BAYT bir xil — money math o'zgarmaydi.
 */
export async function reconcileAllStuckGenerations(): Promise<number> {
  const stuck = await prisma.generation.findMany({
    where: { status: { in: ["queued", "running"] } },
    select: { id: true, userId: true, cost: true, mode: true, modelId: true, createdAt: true, params: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  let refunded = 0;
  for (const g of stuck) {
    const cutoff = new Date(Date.now() - stuckTimeoutMs(g));
    if (g.createdAt >= cutoff) continue;
    const outcome = await settleStuckGeneration(g);
    if (outcome === "refunded") refunded++;
  }
  if (refunded > 0) console.log(`[studio-gen] P1 reconcile: ${refunded} qotган gen fail+refund qilindi`);
  return refunded;
}

/**
 * P1 backfill (bir martalik, startup'da): ALLAQACHON failed bo'lган lekin refund QILINMAGAN
 * (refunded=false, cost>0) genlar — eski edge/timeout tufayli kredit qaytmaган bo'lsa — idempotent
 * refund qilinadi. `refundAiCredits`ning atomik `refunded=false→true` claim'i double-refund'ni
 * to'sadi (admin/ cost<=0 → o'zi no-op). Yo'qolган kreditlarni affected userlarga qaytaradi.
 */
export async function backfillUnrefundedFailures(): Promise<number> {
  const failed = await prisma.generation.findMany({
    where: { status: "failed", refunded: false, cost: { gt: 0 } },
    select: { id: true, userId: true, cost: true },
    take: 1000,
  });
  for (const g of failed) {
    await refundAiCredits(g.userId, g.cost, { generationId: g.id });
  }
  if (failed.length) console.log(`[studio-gen] P1 backfill: ${failed.length} refund-siz failed gen ko'rib chiqildi (idempotent refund)`);
  return failed.length;
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
// P27 FIX2 — SLOT-RELEASE XAVFSIZLIK KAMARI: agar biror provayder fetch FIX1 timeout'idan
// qochsa ham (masalan AbortSignal qo'yilmagan yangi yo'l), job abadiy osilib slotni band
// qilmasin. Katta wall-clock (15 daq — har normal jobdan uzun) dan oshsa slotni MAJBURAN
// bo'shatamiz. Pul: majburan bo'shatilgan job MAVJUD fail+refund yo'lidan o'tadi
// (settleStuckGeneration — provayder-probe + atomik fail+refund), jim tashlanmaydi.
const GEN_SLOT_HARD_MS = 15 * 60 * 1000;
async function forceSettleGeneration(genId: string): Promise<void> {
  const g = await prisma.generation.findUnique({
    where: { id: genId },
    select: { id: true, userId: true, cost: true, modelId: true, createdAt: true, params: true },
  });
  if (!g) return;
  // settleStuckGeneration atomik updateMany (queued/running→failed) bilan o'zi guard qiladi —
  // allaqachon terminal bo'lsa count=0 → refund yo'q (double-refund yo'q, "bepul gen" yo'q).
  await settleStuckGeneration(g);
}
function genRunNext(): void {
  if (genActive >= GEN_CONCURRENCY) return;
  const genId = genWaiting.shift();
  if (!genId) return;
  genWaitingSet.delete(genId);
  genActiveSet.add(genId);
  genActive++;
  let released = false;
  const release = () => {
    if (released) return; // ikki marta bo'shatmaslik (guard + finally poygasidan himoya)
    released = true;
    genActive--;
    genActiveSet.delete(genId);
    genRunNext();
  };
  const guard = setTimeout(() => {
    console.error(`[studio-gen] slot majburan bo'shatildi (${genId}) — ${GEN_SLOT_HARD_MS}ms wall-clock oshdi`);
    captureException(new Error(`gen slot force-release: ${genId}`), { area: "gen-processor.forceRelease", genId });
    forceSettleGeneration(genId).catch((e) =>
      console.error(`[studio-gen] force-settle xato (${genId}):`, e instanceof Error ? e.message : e)
    );
    release();
  }, GEN_SLOT_HARD_MS);
  if (typeof (guard as { unref?: () => void }).unref === "function") (guard as { unref: () => void }).unref();
  processGeneration(genId)
    .catch((e) => {
      console.error(`[studio-gen] processor xato (${genId}):`, e);
      captureException(e, { area: "gen-processor.runNext", genId });
    })
    .finally(() => {
      clearTimeout(guard);
      release();
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

// P1: stuck gen refund'i endi panel ochilishiga bog'liq EMAS — global reconcile FON JADVALIDA.
// Har o'tishda cutoff'dan (20 daq) oshган queued/running genlar fail+refund bo'ladi →
// foydalanuvchi panelni qayta ochmasa ham krediti bounded vaqtda (cutoff + interval) qaytadi.
// Interval env orqali sozlanadi (default 10 daq). Neon compute-soatlarini tejash uchun uzoq
// tanlangan: cutoff (20 daq) yonida 10 daq detektsiya kechikishi ahamiyatsiz, lekin bo'sh
// bazani soatiga 60 marta emas 6 marta uyg'otadi.
const GEN_RECONCILE_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.GEN_RECONCILE_INTERVAL_MS) || 600_000,
);
const genReconcileTimer = setInterval(() => {
  reconcileAllStuckGenerations().catch((e) => {
    console.error("[studio-gen] global reconcile xato:", e);
  });
}, GEN_RECONCILE_INTERVAL_MS);
if (typeof genReconcileTimer.unref === "function") genReconcileTimer.unref();
// Startup: bir martalik backfill (eski refund-siz failed genlar) + darhol bir global reconcile.
setTimeout(() => {
  backfillUnrefundedFailures().catch((e) => console.error("[studio-gen] P1 backfill xato:", e));
  reconcileAllStuckGenerations().catch((e) => console.error("[studio-gen] initial reconcile xato:", e));
}, 2000);

// ─────────────────────────────────────────────────────────────────────────────
// P19.5 — BIRLIK-TEST seami (money-zone qaror izchilligi + resume yetkazish yo'li).
// Ishlab chiqarish mantig'iga TA'SIR QILMAYDI: faqat SOF/REAL funksiyalarni tashqariga ochadi
// (isbot: docs/ P19 proof skripti). Atomik refund guard settleStuckGeneration ichida qoladi.
export const __p19Testing = {
  decideStuckRefund,
  probeProviderJob,
  runFalImage,
  readProviderJob,
  hardCeilingMs,
  providerJobStartMs,
} as const;
