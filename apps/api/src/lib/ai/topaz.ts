// Topaz Labs (enhance/upscale) adapter — R4_03 PHASE 0 FOUNDATION. YAGONA manba: docs/TOPAZ-API-NOTES.md
// + docs/topaz/*.yaml. Kontrakt byteplus.ts naqshi: OrResult, submit/poll-step ajratilgan, xato matnida
// API kalit HECH QACHON sizmaydi. ⚠️ PHASE 0: bu adapter HALI hech qanday user-route yoki katalog
// modelga ULANMAGAN — faqat funksiyalar + provider plumbing (R4_04 modellarni yoqadi). Money-zone TEGILMAGAN.
//
// API mexanikasi (docs-tasdiqlangan):
//  - Auth: HAR chaqiruvda `X-API-Key: <TOPAZ_API_KEY>`. HTTPS only, so'rov ≤500MB (413).
//  - IMAGE (async, multipart): POST {IMAGE_BASE}/enhance/async {source_url|image, model, output_*} →
//    {process_id}; GET /status/{id} → {status Pending|Processing|Completed|Cancelled|Failed, credits};
//    GET /download/{id} → {download_url (1 SOAT!), head_url, expiry}. POST /estimate → {duration, credits}.
//  - VIDEO (async): POST /video/ (BEPUL) → {requestId, estimates:{cost,time}}; PATCH /video/{id}/accept
//    (kredit REZERV) → {uploadId, urls[]}; parts PUT; PATCH /video/{id}/complete-upload/; GET
//    /video/{id}/status → {status, download:{url (24s!), expiresIn}}; GET /video/status → supportedModels.
//  - Natija URL'lari qisqa muddatli (rasm 1s / video 24s), fayllar 7 kun → darhol storage'ga ko'chir.
import type { OrResult } from "./openrouter.js";

const KEY = process.env.TOPAZ_API_KEY ?? ""; // modul darajasida bir marta (byteplus naqshi)
const IMAGE_BASE = (process.env.TOPAZ_IMAGE_BASE?.trim() || "https://api.topazlabs.com/image/v1").replace(/\/+$/, "");
const VIDEO_BASE = (process.env.TOPAZ_VIDEO_BASE?.trim() || "https://api.topazlabs.com").replace(/\/+$/, "");
const ACCOUNT_BASE = (process.env.TOPAZ_ACCOUNT_BASE?.trim() || "https://api.topazlabs.com/account/v1").replace(/\/+$/, "");

export function isTopazConfigured(): boolean {
  return Boolean(KEY);
}
const NOT_CONFIGURED: OrResult<never> = { ok: false, error: "TOPAZ_NOT_CONFIGURED" };

/** Timeout sentinel — gen-processor BYTEPLUS_TIMEOUT bilan bir xil ko'radi (refund YO'Q, reconcile hal qiladi). */
export const TOPAZ_TIMEOUT_ERROR = "TOPAZ_TIMEOUT: job still running — no refund";
/** Rate-limit sentinel (HTTP 429) — retryable, refund YO'Q. */
export const TOPAZ_RATE_LIMITED_ERROR = "TOPAZ_RATE_LIMITED: provider rate limit — job stays queued";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "X-API-Key": KEY, ...(extra || {}) };
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
async function safeJson(res: Response): Promise<unknown | null> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
/** Provider xabarini chiqaramiz; parse bo'lmasa faqat status — HECH QACHON kalit/headerlar emas. */
async function errText(res: Response, prefix: string): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string; error?: string; detail?: string };
    const msg = j?.message || j?.error || j?.detail || "";
    if (msg) return `${prefix}: ${msg}`;
  } catch {
    /* ignore */
  }
  return `${prefix} HTTP ${res.status}`;
}
/** HTTP status → toza xato (docs GOTCHAS): 401/402/403/412 → provider-not-available; 413 too-large;
 *  429 → rate. 412 = "No valid subscription exists" (live probe 2026-07-20 — Topaz obuna talab qiladi). */
function mapHttp(res: Response, prefix: string): string | null {
  if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 412) {
    return "topaz: provider not available (auth/subscription/permission)";
  }
  if (res.status === 413) return "topaz: source file too large (max 500MB)";
  if (res.status === 429) return TOPAZ_RATE_LIMITED_ERROR;
  return null; // caller errText bilan ishlaydi
}

// ── IMAGE ────────────────────────────────────────────────────────────────────
export type TopazImageEndpoint =
  | "enhance" | "enhance-gen" | "sharpen" | "sharpen-gen" | "denoise" | "denoise-gen"
  | "restore-gen" | "lighting" | "matting" | "tool";
export type TopazImageSubmitParams = {
  sourceUrl?: string; // bizning storage URL (Topaz o'zi yuklab oladi) — image bilan al'ternativa
  image?: Buffer; // yoki fayl bufer (jpeg/jpg/png/tiff)
  imageFilename?: string;
  imageContentType?: string;
  model: string; // masalan "Standard V2"
  endpoint?: TopazImageEndpoint; // default "enhance"
  outputWidth?: number;
  outputHeight?: number;
  outputFormat?: "jpeg" | "png" | "tiff";
  cropToFill?: boolean;
  settings?: Record<string, string | number | boolean>; // model-specific (noma'lum kalitlar e'tiborsiz)
};
export type TopazImagePollResult =
  | { state: "pending"; progress?: number }
  | { state: "completed"; credits?: number };

/** POST {IMAGE_BASE}/{endpoint}/async — multipart. → {processId}. */
export async function topazSubmitImageEnhance(
  p: TopazImageSubmitParams
): Promise<OrResult<{ processId: string }>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  const endpoint = p.endpoint || "enhance";
  const form = new FormData();
  form.append("model", p.model);
  if (p.sourceUrl) form.append("source_url", p.sourceUrl);
  else if (p.image) {
    const blob = new Blob([new Uint8Array(p.image)], { type: p.imageContentType || "image/png" });
    form.append("image", blob, p.imageFilename || "source.png");
  } else {
    return { ok: false, error: "topaz: image or source_url is required" };
  }
  if (typeof p.outputWidth === "number") form.append("output_width", String(p.outputWidth));
  if (typeof p.outputHeight === "number") form.append("output_height", String(p.outputHeight));
  if (p.outputFormat) form.append("output_format", p.outputFormat);
  if (typeof p.cropToFill === "boolean") form.append("crop_to_fill", String(p.cropToFill));
  for (const [k, v] of Object.entries(p.settings || {})) form.append(k, String(v));

  let res: Response;
  try {
    res = await fetch(`${IMAGE_BASE}/${endpoint}/async`, { method: "POST", headers: authHeaders(), body: form });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: could not connect to image endpoint" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz image");
    return { ok: false, error: mapped || (await errText(res, "topaz image submit")), status: res.status };
  }
  const j = (await safeJson(res)) as { process_id?: string } | null;
  if (!j?.process_id) return { ok: false, error: "topaz: process_id was not returned" };
  return { ok: true, data: { processId: j.process_id } };
}

/** GET {IMAGE_BASE}/status/{process_id} → bir poll qadami (byteplus poll-step naqshi). */
export async function topazPollImageStep(processId: string): Promise<OrResult<TopazImagePollResult>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${IMAGE_BASE}/status/${encodeURIComponent(processId)}`, { headers: authHeaders() });
  } catch {
    return { ok: true, data: { state: "pending" } }; // transient
  }
  if (res.status === 429 || res.status >= 500) return { ok: true, data: { state: "pending" } };
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz image status");
    return { ok: false, error: mapped || (await errText(res, "topaz image status")), status: res.status };
  }
  const j = (await safeJson(res)) as { status?: string; progress?: number; credits?: number } | null;
  const status = String(j?.status || "");
  if (status === "Completed") return { ok: true, data: { state: "completed", credits: j?.credits } };
  if (status === "Failed" || status === "Cancelled") {
    return { ok: false, error: `topaz image: job ${status.toLowerCase()}` };
  }
  return { ok: true, data: { state: "pending", progress: j?.progress } }; // Pending|Processing
}

/** GET {IMAGE_BASE}/download/{process_id} → download_url (1 SOAT) → Buffer (caller darhol persist qiladi). */
export async function topazImageDownload(processId: string): Promise<OrResult<Buffer>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${IMAGE_BASE}/download/${encodeURIComponent(processId)}`, { headers: authHeaders() });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: image download link error" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz image download");
    return { ok: false, error: mapped || (await errText(res, "topaz image download")), status: res.status };
  }
  const j = (await safeJson(res)) as { download_url?: string } | null;
  const url = j?.download_url || "";
  return url ? topazDownloadUrl(url, "image") : { ok: false, error: "topaz: download_url not found" };
}

export type TopazEstimateParams = {
  inputWidth: number;
  inputHeight: number;
  category?: string; // masalan "Enhance"
  model: string;
  outputWidth?: number;
  outputHeight?: number;
};
/** POST {IMAGE_BASE}/estimate — BEPUL (upload yo'q) → {duration, credits}. Narx ko'rsatish uchun (R4_04). */
export async function topazEstimateImage(
  p: TopazEstimateParams
): Promise<OrResult<{ duration: number; credits: number }>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = {
    input_width: p.inputWidth,
    input_height: p.inputHeight,
    model: p.model,
  };
  if (p.category) body.category = p.category;
  if (typeof p.outputWidth === "number") body.output_width = p.outputWidth;
  if (typeof p.outputHeight === "number") body.output_height = p.outputHeight;
  let res: Response;
  try {
    res = await fetch(`${IMAGE_BASE}/estimate`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: estimate error" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz estimate");
    return { ok: false, error: mapped || (await errText(res, "topaz estimate")), status: res.status };
  }
  const j = (await safeJson(res)) as { duration?: number; credits?: number } | null;
  if (typeof j?.credits !== "number") return { ok: false, error: "topaz: estimate did not return credits" };
  return { ok: true, data: { duration: j.duration ?? 0, credits: j.credits } };
}

// ── VIDEO (standard lifecycle: create → accept → upload → complete-upload → poll → download) ──
export type TopazVideoSource = {
  container: "mp4" | "mov" | "mkv";
  size?: number;
  duration?: number;
  frameCount?: number;
  frameRate?: number;
  resolution?: { width: number; height: number };
  // Tashqi S3-mos manba (bizning R2 presigned URL) — Topaz o'zi yuklab oladi (re-upload SHART EMAS).
  external?: { provider: "s3"; presignedUrl?: string; bucketName?: string; key?: string };
};
export type TopazVideoFilter = { model: string; auto?: "Auto" | "Manual" | "Relative"; [k: string]: unknown };
export type TopazVideoOutput = Record<string, unknown>; // resolution/frameRate/audioCodec/... (R4_04 to'ldiradi)

/** POST /video/ — BEPUL create; kredit sarflamaydi. → {requestId, estimates:{cost:[lo,hi], time:[lo,hi]}}. */
export async function topazCreateVideoRequest(body: {
  source: TopazVideoSource;
  filters: TopazVideoFilter[];
  output: TopazVideoOutput;
}): Promise<OrResult<{ requestId: string; estimates: { cost?: number[]; time?: number[] } }>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${VIDEO_BASE}/video/`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: could not connect to video create" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz video create");
    return { ok: false, error: mapped || (await errText(res, "topaz video create")), status: res.status };
  }
  const j = (await safeJson(res)) as { requestId?: string; estimates?: { cost?: number[]; time?: number[] } } | null;
  if (!j?.requestId) return { ok: false, error: "topaz: requestId was not returned" };
  return { ok: true, data: { requestId: j.requestId, estimates: j.estimates || {} } };
}

/** PATCH /video/{id}/accept — kredit REZERV qiladi. → {uploadId, urls[], message?}. */
export async function topazAcceptVideoRequest(
  requestId: string
): Promise<OrResult<{ uploadId?: string; urls: string[]; message?: string }>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${VIDEO_BASE}/video/${encodeURIComponent(requestId)}/accept`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: video accept error" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz video accept");
    return { ok: false, error: mapped || (await errText(res, "topaz video accept")), status: res.status };
  }
  const j = (await safeJson(res)) as { uploadId?: string; urls?: string[]; message?: string } | null;
  return { ok: true, data: { uploadId: j?.uploadId, urls: Array.isArray(j?.urls) ? j!.urls! : [], message: j?.message } };
}

/** Manba bufer'ni accept qaytargan presigned URL'larga teng bayt-diapazonlarda PUT qiladi → [{partNum,eTag}]. */
export async function topazUploadVideoParts(
  urls: string[],
  buf: Buffer
): Promise<OrResult<Array<{ partNum: number; eTag: string }>>> {
  if (!urls.length) return { ok: false, error: "topaz: no upload URLs" };
  const n = urls.length;
  const partSize = Math.ceil(buf.length / n);
  const results: Array<{ partNum: number; eTag: string }> = [];
  for (let i = 0; i < n; i++) {
    const chunk = buf.subarray(i * partSize, Math.min((i + 1) * partSize, buf.length));
    let res: Response;
    try {
      res = await fetch(urls[i], { method: "PUT", body: new Uint8Array(chunk) });
    } catch (e) {
      return { ok: false, error: (e as Error).message || "topaz: part upload error" };
    }
    if (!res.ok) return { ok: false, error: `topaz: part ${i + 1} upload HTTP ${res.status}` };
    const eTag = (res.headers.get("etag") || "").replace(/"/g, "");
    results.push({ partNum: i + 1, eTag });
  }
  return { ok: true, data: results };
}

/** PATCH /video/{id}/complete-upload/ — upload'ni yakunlaydi (processing boshlanadi). */
export async function topazCompleteVideoUpload(
  requestId: string,
  uploadResults: Array<{ partNum: number; eTag: string }>,
  md5Hash?: string
): Promise<OrResult<true>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = { uploadResults };
  if (md5Hash) body.md5Hash = md5Hash;
  let res: Response;
  try {
    res = await fetch(`${VIDEO_BASE}/video/${encodeURIComponent(requestId)}/complete-upload/`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: complete-upload error" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz complete-upload");
    return { ok: false, error: mapped || (await errText(res, "topaz complete-upload")), status: res.status };
  }
  return { ok: true, data: true };
}

export type TopazVideoPollResult =
  | { state: "pending"; progress?: number }
  | { state: "completed"; data: { videoUrl: string } };
/** GET /video/{id}/status → bir poll qadami. complete → download.url (24s TTL). */
export async function topazPollVideoStep(requestId: string): Promise<OrResult<TopazVideoPollResult>> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${VIDEO_BASE}/video/${encodeURIComponent(requestId)}/status`, { headers: authHeaders() });
  } catch {
    return { ok: true, data: { state: "pending" } }; // transient
  }
  if (res.status === 429 || res.status >= 500) return { ok: true, data: { state: "pending" } };
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz video status");
    return { ok: false, error: mapped || (await errText(res, "topaz video status")), status: res.status };
  }
  const j = (await safeJson(res)) as { status?: string; progress?: number; download?: { url?: string } } | null;
  const status = String(j?.status || "").toLowerCase();
  if (status === "complete") {
    const url = j?.download?.url || "";
    if (!url) return { ok: false, error: "topaz: video download URL not found" };
    return { ok: true, data: { state: "completed", data: { videoUrl: url } } };
  }
  if (status === "failed" || status === "canceled" || status === "canceling") {
    return { ok: false, error: `topaz video: job ${status}` };
  }
  return { ok: true, data: { state: "pending", progress: j?.progress } };
}

/** GET /video/status (system) → {isAvailable, supportedModels[]} — LIVE model ro'yxati (yaml enum'idan ustun). */
export async function topazGetSupportedModels(): Promise<
  OrResult<{ isAvailable: boolean; availabilityMessage?: string; supportedModels: string[] }>
> {
  if (!isTopazConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${VIDEO_BASE}/video/status`, { headers: authHeaders() });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz: video status error" };
  }
  if (!res.ok) {
    const mapped = mapHttp(res, "topaz video system status");
    return { ok: false, error: mapped || (await errText(res, "topaz video system status")), status: res.status };
  }
  const j = (await safeJson(res)) as
    | { isAvailable?: boolean; availabilityMessage?: string; supportedModels?: string[] }
    | null;
  return {
    ok: true,
    data: {
      isAvailable: Boolean(j?.isAvailable),
      availabilityMessage: j?.availabilityMessage,
      supportedModels: Array.isArray(j?.supportedModels) ? j!.supportedModels! : [],
    },
  };
}

/** Natija URL (qisqa TTL) → Buffer — caller darhol storage'ga persist qiladi (byteplus naqshi). */
async function topazDownloadUrl(url: string, kind: string): Promise<OrResult<Buffer>> {
  if (!url) return { ok: false, error: `topaz: ${kind} URL not found` };
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `topaz download HTTP ${res.status}`, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { ok: true, data: buf } : { ok: false, error: "topaz: empty result" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "topaz download error" };
  }
}
/** byteplusVideoUrlToBuffer ekvivalenti (video natija). */
export async function topazVideoUrlToBuffer(url: string): Promise<OrResult<Buffer>> {
  return topazDownloadUrl(url, "video");
}
