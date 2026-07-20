// Kling AI DIRECT-API adapter — Kling 3.0 oilasi (video: t2v/i2v/turbo/omni + image: 3.0/3.0-omni).
// YAGONA manba: /Users/usmonov/Projects/kling Ai/*.txt (R4_02). fal.ai orqali EMAS — to'g'ridan-to'g'ri
// (fal marja yo'q, BytePlus direct-migration qarori kabi). Kontrakt byteplus.ts naqshi: OrResult,
// submit/poll-step ajratilgan, xato matnida API kalit HECH QACHON sizmaydi.
//
// API mexanikasi (TASDIQLANGAN docs):
//  - Base: https://api-singapore.klingai.com · Auth: `Authorization: Bearer <KLING_API_KEY>`
//  - Envelope: { code, message, request_id, data } — code===0 muvaffaqiyat, aks holda xato (Error Codes).
//  - Video submit: POST /text-to-video/kling-3.0 | /image-to-video/kling-3.0[-turbo] | /omni-video/
//    kling-3.0-omni → data.id (task). Poll: GET /tasks?task_ids=<id> → data[].status
//    (submitted|processing|succeeded|failed) + data[].outputs[] (type video → url).
//  - Image submit: POST /v1/images/generations (model_name kling-v3) | /v1/images/omni-image
//    (model_name kling-v3-omni) → data.task_id. Poll: GET .../{id} → data.task_status
//    (submitted|processing|succeed|failed) + data.task_result.images[].url. ⚠️ image status = "succeed"!
//  - Natija URL 30 KUN amal qiladi → darhol o'z storage'imizga ko'chirish SHART (caller qiladi).
import type { OrResult } from "./openrouter.js";
import type { GenModel, ResolvedVideoParams, VideoRefUrls } from "../gen-models.js";

const KEY = process.env.KLING_API_KEY ?? ""; // modul darajasida bir marta (byteplus naqshi)
const BASE = (process.env.KLING_API_BASE?.trim() || "https://api-singapore.klingai.com").replace(
  /\/+$/,
  ""
);

export function isKlingConfigured(): boolean {
  return Boolean(KEY);
}
const NOT_CONFIGURED: OrResult<never> = { ok: false, error: "KLING_NOT_CONFIGURED" };

/** Timeout sentinel — gen-processor BYTEPLUS_TIMEOUT bilan BIR XIL ko'radi (refund YO'Q, reconcile hal qiladi). */
export const KLING_TIMEOUT_ERROR = "KLING_TIMEOUT: job still running — no refund";
/** Rate/concurrency sentinel (Kling 1302/1303) — FAILURE EMAS (refund yo'q), job queued'da qoladi. */
export const KLING_RATE_LIMITED_ERROR =
  "KLING_RATE_LIMITED: provider concurrency/rate limit — job stays queued";

function klHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type KlingEnvelope = { code?: number; message?: string; data?: unknown };
async function safeEnvelope(res: Response): Promise<KlingEnvelope | null> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t) as KlingEnvelope;
  } catch {
    return null;
  }
}

/** Kling service-code → toza xato (API kalit/headerlar HECH QACHON chiqmaydi). */
function mapKlingCode(code: number | undefined, message?: string): string {
  const msg = (message || "").trim();
  if (code === 1102 || code === 1103) {
    return "kling: model not available (resource pack exhausted/expired or model not authorized)";
  }
  if (code === 1100 || code === 1101) return "kling: account issue (abnormal status or arrears)";
  if (typeof code === "number" && code >= 1000 && code <= 1004) return "kling: authentication failed";
  if (code === 1301) return "content policy — the model's safety filter rejected this request";
  if (code === 1302 || code === 1303) return KLING_RATE_LIMITED_ERROR;
  return msg ? `kling: ${msg}` : `kling: request failed (code ${code ?? "?"})`;
}
/** Rate-limit kodi (retryable) — submit backoff qaroriга. */
function isKlingRateLimited(code: number | undefined): boolean {
  return code === 1302 || code === 1303;
}

// ── VIDEO ────────────────────────────────────────────────────────────────────
export type KlingVideoKind = "video30" | "turbo" | "omni-video";
export type KlingPollStepResult =
  | { state: "pending" }
  | { state: "completed"; data: { videoUrl: string } };

/** Kling faqat 720p/1080p/4k qabul qiladi; auto/480p → eng yaqin ruxsat etilgan tier'ga. */
function klingResolution(res: string): string {
  const r = String(res || "").toLowerCase();
  if (r === "1080p" || r === "4k") return r;
  return "720p"; // 480p/auto/720p → 720p (Kling 480p'ni qo'llamaydi)
}
/** t2v/omni aspect — faqat 16:9|9:16|1:1; auto/boshqa → 16:9 (docs default). i2v'да aspect YUBORILMAYDI. */
function klingAspect(aspect: string): string {
  const a = String(aspect || "").toLowerCase();
  return a === "9:16" || a === "1:1" ? a : "16:9";
}
function klingDuration(d: number): number {
  return Math.min(15, Math.max(3, Math.round(d || 5)));
}

/**
 * Video task body'sini MODEL DEKLARATSIYASIDAN quradi. video30: start-frame bo'lsa i2v (contents[]),
 * bo'lmasa t2v (prompt+settings). turbo: doim i2v (first_frame SHART). omni: contents[] (prompt +
 * first/last frame + refer_image + feature_video). watermark HAR DOIM false.
 * @returns { path, body } — submit yuboradi.
 */
export function buildKlingVideoRequest(
  model: GenModel,
  prompt: string,
  resolved: ResolvedVideoParams,
  refs: VideoRefUrls
): { path: string; body: Record<string, unknown> } {
  const kind: KlingVideoKind = (model.klingKind as KlingVideoKind) || "video30";
  const arr = (a?: string[]) =>
    Array.isArray(a) ? a.filter((u) => typeof u === "string" && u.length > 0) : [];
  const resolution = klingResolution(resolved.resolution);
  const duration = klingDuration(resolved.duration);
  const options = { watermark_info: { enabled: false } };
  const audioNative = resolved.generateAudio ? "native" : "off";

  if (kind === "omni-video") {
    const contents: Record<string, unknown>[] = [{ type: "prompt", text: prompt }];
    if (refs.startUrl) contents.push({ type: "first_frame", url: refs.startUrl });
    if (model.endFrame && refs.endUrl) contents.push({ type: "last_frame", url: refs.endUrl });
    for (const u of arr(refs.imageUrls)) contents.push({ type: "refer_image", url: u });
    const vids = arr(refs.videoUrls).slice(0, 1); // Omni: maks 1 referens video
    for (const u of vids) contents.push({ type: "feature_video", url: u });
    // feature_video bilan native audio qo'llanmaydi → audio "off"; aspect faqat frame/video yo'q bo'lsa.
    const hasFrameOrVideo = Boolean(refs.startUrl) || vids.length > 0;
    const settings: Record<string, unknown> = {
      multi_shot: false,
      resolution,
      duration,
      audio: vids.length ? "off" : audioNative,
    };
    if (!hasFrameOrVideo) settings.aspect_ratio = klingAspect(resolved.aspectRatio);
    return { path: "/omni-video/kling-3.0-omni", body: { contents, settings, options } };
  }

  if (kind === "turbo") {
    // Turbo — image-to-video, first_frame SHART, native audio (audio param yo'q).
    const contents: Record<string, unknown>[] = [{ type: "prompt", text: prompt }];
    if (refs.startUrl) contents.push({ type: "first_frame", url: refs.startUrl });
    return {
      path: "/image-to-video/kling-3.0-turbo",
      body: { contents, settings: { resolution, duration }, options },
    };
  }

  // video30 — start-frame bo'lsa i2v, aks holda t2v.
  if (refs.startUrl) {
    const contents: Record<string, unknown>[] = [
      { type: "prompt", text: prompt },
      { type: "first_frame", url: refs.startUrl },
    ];
    if (model.endFrame && refs.endUrl) contents.push({ type: "last_frame", url: refs.endUrl });
    return {
      path: "/image-to-video/kling-3.0",
      body: { contents, settings: { multi_shot: false, resolution, duration, audio: audioNative }, options },
    };
  }
  return {
    path: "/text-to-video/kling-3.0",
    body: {
      prompt,
      settings: {
        multi_shot: false,
        resolution,
        aspect_ratio: klingAspect(resolved.aspectRatio),
        duration,
        audio: audioNative,
      },
      options,
    },
  };
}

/** Video task yaratish. 1302/1303 → backoff retry (~95s); baribir limit → RATE_LIMITED sentinel. */
export async function klingSubmitVideo(
  path: string,
  body: Record<string, unknown>
): Promise<OrResult<{ taskId: string }>> {
  if (!isKlingConfigured()) return NOT_CONFIGURED;
  const backoffMs = [0, 5000, 10000, 20000, 30000, 30000];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt]) await sleep(backoffMs[attempt]);
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { method: "POST", headers: klHeaders(), body: JSON.stringify(body) });
    } catch (e) {
      return { ok: false, error: (e as Error).message || "kling: could not connect to submit" };
    }
    const env = await safeEnvelope(res);
    const code = env?.code;
    if (code === 0) {
      const id = (env?.data as { id?: string } | undefined)?.id;
      if (!id) return { ok: false, error: "kling: task id was not returned" };
      return { ok: true, data: { taskId: id } };
    }
    if (isKlingRateLimited(code)) continue; // retryable — keyingi backoff
    return { ok: false, error: mapKlingCode(code, env?.message), status: res.status };
  }
  return { ok: false, error: KLING_RATE_LIMITED_ERROR };
}

type KlingTaskOutput = { type?: string; url?: string };
type KlingTaskRow = { status?: string; message?: string; outputs?: KlingTaskOutput[] };

/** Bitta video poll qadami. GET /tasks?task_ids= → data[] massiv (byteplus poll-step naqshi). */
export async function klingPollVideoStep(taskId: string): Promise<OrResult<KlingPollStepResult>> {
  if (!isKlingConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${BASE}/tasks?task_ids=${encodeURIComponent(taskId)}`, { headers: klHeaders() });
  } catch {
    return { ok: true, data: { state: "pending" } }; // transient tarmoq tebranishi
  }
  if (res.status === 429 || res.status >= 500) return { ok: true, data: { state: "pending" } };
  const env = await safeEnvelope(res);
  if (env?.code !== 0) return { ok: false, error: mapKlingCode(env?.code, env?.message), status: res.status };
  const rows = Array.isArray(env?.data) ? (env!.data as KlingTaskRow[]) : [];
  const row = rows[0];
  const status = String(row?.status || "").toLowerCase();
  if (status === "succeeded") {
    const video = (row?.outputs || []).find((o) => o.type === "video" && o.url);
    if (!video?.url) return { ok: false, error: "kling: video URL not found" };
    return { ok: true, data: { state: "completed", data: { videoUrl: video.url } } };
  }
  if (status === "failed") {
    return { ok: false, error: mapKlingCode(undefined, row?.message || "kling: generation failed") };
  }
  return { ok: true, data: { state: "pending" } }; // submitted|processing|(empty)
}

// ── IMAGE (self-contained: submit → poll → download; byteplusImage naqshi, lekin ASYNC task) ──
export type KlingImageParams = {
  prompt: string;
  imageUrls?: string[]; // referens rasmlar (PUBLIC URL / http) — image-to-image
  resolution?: string; // "1K"|"2K"|"4K" (adapter lowercase qiladi)
  aspect?: string; // "16:9"... (auto → tashlanadi)
};
type KlingImageKind = "image" | "omni-image";

function klingImageResolution(res?: string): string {
  const r = String(res || "1k").toLowerCase();
  return r === "2k" || r === "4k" ? r : "1k";
}
function klingImageAspect(aspect?: string): string | undefined {
  const a = String(aspect || "").toLowerCase();
  const ok = ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"];
  return ok.includes(a) ? a : undefined; // noma'lum/auto → yubormaymiz (Kling o'zi tanlaydi)
}

async function klingDownloadUrl(url: string, kind: string): Promise<OrResult<Buffer>> {
  if (!url) return { ok: false, error: `kling: ${kind} URL not found` };
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `kling download HTTP ${res.status}`, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { ok: true, data: buf } : { ok: false, error: "kling: empty result" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "kling download error" };
  }
}

/** byteplusVideoUrlToBuffer ekvivalenti (video natija — caller darhol storage'ga persist qiladi). */
export async function klingVideoUrlToBuffer(url: string): Promise<OrResult<Buffer>> {
  return klingDownloadUrl(url, "video");
}

/**
 * Kling rasm generatsiyasi — bitta rasm chiqishi (n=1; count>1 caller mapLimit bilan). Submit → poll →
 * download. image: /v1/images/generations (model_name kling-v3, single `image` ref). omni-image:
 * /v1/images/omni-image (model_name kling-v3-omni, `image_list`). ⚠️ image poll status "succeed".
 */
export async function klingImage(
  model: GenModel,
  p: KlingImageParams
): Promise<OrResult<Buffer[]>> {
  if (!isKlingConfigured()) return NOT_CONFIGURED;
  const kind: KlingImageKind = model.klingKind === "omni-image" ? "omni-image" : "image";
  const resolution = klingImageResolution(p.resolution);
  const aspect = klingImageAspect(p.aspect);
  const refs = (p.imageUrls || []).filter((u) => typeof u === "string" && u.length > 0);

  const submitPath = kind === "omni-image" ? "/v1/images/omni-image" : "/v1/images/generations";
  const body: Record<string, unknown> = {
    model_name: kind === "omni-image" ? "kling-v3-omni" : "kling-v3",
    prompt: p.prompt,
    resolution,
    n: 1,
    watermark_info: { enabled: false }, // ⚠️ BIZDA HAR DOIM false
  };
  if (aspect) body.aspect_ratio = aspect;
  if (refs.length) {
    if (kind === "omni-image") body.image_list = refs.map((u) => ({ image: u }));
    else body.image = refs[0]; // base image gen: bitta referens rasm
  }

  // Submit (1302/1303 → qisqa backoff).
  let taskId = "";
  const backoffMs = [0, 3000, 6000];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt]) await sleep(backoffMs[attempt]);
    let res: Response;
    try {
      res = await fetch(`${BASE}${submitPath}`, { method: "POST", headers: klHeaders(), body: JSON.stringify(body) });
    } catch (e) {
      return { ok: false, error: (e as Error).message || "kling: could not connect to image endpoint" };
    }
    const env = await safeEnvelope(res);
    if (env?.code === 0) {
      taskId = (env?.data as { task_id?: string } | undefined)?.task_id || "";
      break;
    }
    if (isKlingRateLimited(env?.code)) continue;
    return { ok: false, error: mapKlingCode(env?.code, env?.message), status: res.status };
  }
  if (!taskId) return { ok: false, error: "kling: image rate limit — please try again shortly" };

  // Poll (GET .../{id}); status "succeed" (video "succeeded"'dan farqli!).
  const queryPath = kind === "omni-image" ? "/v1/images/omni-image/" : "/v1/images/generations/";
  for (let i = 0; i < 100; i++) {
    await sleep(i < 4 ? 1500 : 3000); // ~5 daqiqagacha
    let res: Response;
    try {
      res = await fetch(`${BASE}${queryPath}${encodeURIComponent(taskId)}`, { headers: klHeaders() });
    } catch {
      continue; // transient
    }
    if (res.status === 429 || res.status >= 500) continue;
    const env = await safeEnvelope(res);
    if (env?.code !== 0) return { ok: false, error: mapKlingCode(env?.code, env?.message), status: res.status };
    const data = env?.data as
      | { task_status?: string; task_status_msg?: string; task_result?: { images?: { url?: string }[] } }
      | undefined;
    const st = String(data?.task_status || "").toLowerCase();
    if (st === "succeed" || st === "succeeded") {
      const images = data?.task_result?.images || [];
      const bufs: Buffer[] = [];
      for (const im of images) {
        if (im?.url) {
          const dl = await klingDownloadUrl(im.url, "image");
          if (!dl.ok) return dl;
          bufs.push(dl.data);
        }
      }
      if (!bufs.length) return { ok: false, error: "kling: image URL not found" };
      return { ok: true, data: bufs };
    }
    if (st === "failed") {
      return { ok: false, error: mapKlingCode(undefined, data?.task_status_msg || "kling: image generation failed") };
    }
  }
  return { ok: false, error: "kling: image generation timed out" };
}
