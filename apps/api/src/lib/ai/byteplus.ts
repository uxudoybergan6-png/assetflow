// BytePlus ModelArk adapter — Seedance 2.0 video (async task API). YAGONA manba: docs/BYTEPLUS-DOCS-MODELS.md.
// Auth: `Authorization: Bearer $BYTEPLUS_API_KEY` (fal'ning `Key` sxemasi EMAS).
// Kontrakt fal.ts naqshi: OrResult, submit/poll-step ajratilgan, xato matnida kalit/header sizmaydi.
// Task yaratish: POST {base}/contents/generations/tasks → {id}; poll: GET .../tasks/{id} →
// status queued|running|succeeded|failed; muvaffaqiyatda content.video_url (24 soat!) + usage tokenlar.
import type { OrResult } from "./openrouter.js";
import type { GenModel, ResolvedVideoParams, VideoRefUrls } from "../gen-models.js";

const KEY = process.env.BYTEPLUS_API_KEY ?? ""; // bir marta, modul darajasida (fal naqshi)
const ARK_BASE = (
  process.env.BYTEPLUS_ARK_BASE?.trim() || "https://ark.ap-southeast.bytepluses.com/api/v3"
).replace(/\/+$/, "");

export function isByteplusConfigured(): boolean {
  return Boolean(KEY);
}
const NOT_CONFIGURED: OrResult<never> = { ok: false, error: "BYTEPLUS_NOT_CONFIGURED" };

/** Timeout sentinel — gen-processor FAL_TIMEOUT bilan BIR XIL ko'radi (refund YO'Q, reconcile hal qiladi). */
export const BYTEPLUS_TIMEOUT_ERROR = "BYTEPLUS_TIMEOUT: job still running — no refund";
/** Rate-limit sentinel — backoff tugagach ham 429: FAILURE EMAS (refund yo'q), job queued'da qoladi. */
export const BYTEPLUS_RATE_LIMITED_ERROR =
  "BYTEPLUS_RATE_LIMITED: provider concurrency/rate limit — job stays queued";
/** Input moderation sentinel — real yuzli referens rad etildi → oddiy fail+refund yo'li ishlaydi.
 *  USER QARORI (2026-07-11): fal fallback YO'Q — BytePlus yagona Seedance provayder. */
export const BYTEPLUS_INPUT_MODERATION_PREFIX = "BYTEPLUS_INPUT_MODERATION:";
const INPUT_MODERATION_ERROR =
  `${BYTEPLUS_INPUT_MODERATION_PREFIX} Reference contains a real human face, which this model does not accept. Use face-free or stylized/illustrated references.`;

function bpHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
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

type BpError = { code?: string; message?: string };
// Provider xabarini chiqaramiz; parse bo'lmasa faqat status — HECH QACHON kalit/headerlar emas.
async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: BpError; message?: string };
    const code = j?.error?.code || "";
    const msg = j?.error?.message || j?.message || "";
    if (code || msg) return code && msg ? `${code}: ${msg}` : code || msg;
  } catch {
    /* ignore */
  }
  return `byteplus HTTP ${res.status}`;
}

/** Input moderation (real yuz) xatosini aniqlaydi — OUTPUT sensitive-content'dan farqli ("input" so'zi shart). */
function isInputModerationError(text: string): boolean {
  return /input.{0,40}(sensitive|moderat|risk)|(sensitive|moderat|risk).{0,40}input|real.{0,20}(human\s*)?face|face.{0,40}not\s*(accept|allow|support)/i.test(
    text
  );
}
/** Rate-limit xatolari (HTTP 429 body'siz kelganda ham) — retryable, refund YO'Q. */
function isRateLimitError(text: string): boolean {
  return /rate.?limit|too\s*many\s*request|throttl|concurren|qps|quota\s*exceed/i.test(text);
}
function mapByteplusError(text: string): string {
  if (isInputModerationError(text)) return INPUT_MODERATION_ERROR;
  return text;
}

// ── In-process semafor (INGEST_CONCURRENCY naqshi) — Individual account limitlari:
//    parallel 3 (non-4k) / 1 (4k), 180 RPM. Slot submit'dan natijagacha ushlanadi.
const VIDEO_CONCURRENCY = (() => {
  const v = Number(process.env.BYTEPLUS_VIDEO_CONCURRENCY);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 3;
})();
let bpActive = 0;
let bpActive4k = 0;
const bpWaiters: Array<() => void> = [];
export async function withByteplusVideoSlot<T>(is4k: boolean, fn: () => Promise<T>): Promise<T> {
  while (bpActive >= VIDEO_CONCURRENCY || (is4k && bpActive4k >= 1)) {
    await new Promise<void>((r) => bpWaiters.push(r));
  }
  bpActive++;
  if (is4k) bpActive4k++;
  try {
    return await fn();
  } finally {
    bpActive--;
    if (is4k) bpActive4k--;
    // Hammasini uyg'otamiz — har biri shartni qayta tekshiradi (4k/non-4k aralash navbat xavfsiz).
    const w = bpWaiters.splice(0, bpWaiters.length);
    for (const r of w) r();
  }
}

export type ByteplusUsage = { completion_tokens?: number; total_tokens?: number };
export type ByteplusPollStepResult =
  | { state: "pending" }
  | { state: "completed"; data: { videoUrl: string; usage?: ByteplusUsage } };

/**
 * ModelArk task body'sini MODEL DEKLARATSIYASIDAN quradi (buildFalVideoInput ekvivalenti).
 * content massivi: text + first/last_frame (qat'iy i2v) + reference_image/video/audio (erkin referens).
 * bizning "auto" nisbat → "adaptive"; duration 4–15 int; watermark HAR DOIM false (demo default true!).
 * bitrateMode / end_user_id — BytePlus'da ekvivalent parametr yo'q, jimgina tashlanadi.
 */
export function buildByteplusVideoBody(
  model: GenModel,
  prompt: string,
  resolved: ResolvedVideoParams,
  refs: VideoRefUrls
): Record<string, unknown> {
  // Bizning @Image1/@Video1/@Audio1 UX tokenlari → BytePlus "Image 1" (content'dagi TUR bo'yicha tartib raqami).
  const text = String(prompt)
    .replace(/@image(\d+)/gi, "Image $1")
    .replace(/@img(\d+)/gi, "Image $1")
    .replace(/@video(\d+)/gi, "Video $1")
    .replace(/@audio(\d+)/gi, "Audio $1");
  const content: Record<string, unknown>[] = [{ type: "text", text }];
  if (refs.startUrl) {
    content.push({ type: "image_url", image_url: { url: refs.startUrl }, role: "first_frame" });
  }
  if (model.endFrame && refs.endUrl) {
    content.push({ type: "image_url", image_url: { url: refs.endUrl }, role: "last_frame" });
  }
  const arr = (a?: string[]) =>
    Array.isArray(a) ? a.filter((u) => typeof u === "string" && u.length > 0) : [];
  for (const u of arr(refs.imageUrls)) {
    content.push({ type: "image_url", image_url: { url: u }, role: "reference_image" });
  }
  for (const u of arr(refs.videoUrls)) {
    content.push({ type: "video_url", video_url: { url: u }, role: "reference_video" });
  }
  for (const u of arr(refs.audioUrls)) {
    content.push({ type: "audio_url", audio_url: { url: u }, role: "reference_audio" });
  }
  return {
    content,
    resolution: resolved.resolution,
    ratio: /^auto$/i.test(resolved.aspectRatio) ? "adaptive" : resolved.aspectRatio,
    duration: Math.min(15, Math.max(4, Math.round(resolved.duration))),
    generate_audio: resolved.generateAudio,
    watermark: false, // ⚠️ BIZDA HAR DOIM false (BytePlus demo default true)
  };
}

/**
 * Task yaratish. HTTP 429 / rate-limit kodlari → backoff bilan qayta urinish (jami ~95s);
 * baribir limit bo'lsa BYTEPLUS_RATE_LIMITED sentinel (caller job'ni queued'da saqlaydi, refund YO'Q).
 */
export async function byteplusSubmitVideoTask(
  model: string,
  body: Record<string, unknown>
): Promise<OrResult<{ taskId: string }>> {
  if (!isByteplusConfigured()) return NOT_CONFIGURED;
  const backoffMs = [0, 5000, 10000, 20000, 30000, 30000];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt]) await sleep(backoffMs[attempt]);
    let res: Response;
    try {
      res = await fetch(`${ARK_BASE}/contents/generations/tasks`, {
        method: "POST",
        headers: bpHeaders(),
        body: JSON.stringify({ model, ...body }),
      });
    } catch (e) {
      return { ok: false, error: (e as Error).message || "byteplus: could not connect to submit" };
    }
    if (!res.ok) {
      const msg = await errText(res);
      if (res.status === 429 || isRateLimitError(msg)) continue; // retryable — keyingi backoff
      return { ok: false, error: mapByteplusError(msg), status: res.status };
    }
    const j = (await safeJson(res)) as { id?: string } | null;
    if (!j?.id) return { ok: false, error: "byteplus: task id was not returned" };
    return { ok: true, data: { taskId: j.id } };
  }
  return { ok: false, error: BYTEPLUS_RATE_LIMITED_ERROR };
}

/** Bitta poll qadami — transient tarmoq/429/5xx = pending (fal naqshi); failed → mapped xato. */
export async function byteplusPollStep(taskId: string): Promise<OrResult<ByteplusPollStepResult>> {
  if (!isByteplusConfigured()) return NOT_CONFIGURED;
  let res: Response;
  try {
    res = await fetch(`${ARK_BASE}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
      headers: bpHeaders(),
    });
  } catch {
    return { ok: true, data: { state: "pending" } }; // transient tarmoq tebranishi
  }
  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) {
      return { ok: true, data: { state: "pending" } }; // vaqtinchalik holat
    }
    return { ok: false, error: mapByteplusError(await errText(res)), status: res.status };
  }
  const j = (await safeJson(res)) as {
    status?: string;
    content?: { video_url?: string };
    usage?: ByteplusUsage;
    error?: BpError;
  } | null;
  const status = String(j?.status || "").toLowerCase();
  if (status === "succeeded") {
    const videoUrl = j?.content?.video_url || "";
    if (!videoUrl) return { ok: false, error: "byteplus: video URL not found" };
    return { ok: true, data: { state: "completed", data: { videoUrl, usage: j?.usage } } };
  }
  if (status === "failed" || status === "cancelled") {
    const code = j?.error?.code || "";
    const msg = j?.error?.message || "";
    const text = [code, msg].filter(Boolean).join(": ") || "byteplus: generation failed";
    return { ok: false, error: mapByteplusError(text) };
  }
  return { ok: true, data: { state: "pending" } }; // queued|running
}

/** Natija URL (24 soat amal qiladi!) → Buffer — caller darhol GCS'ga persist qiladi. */
async function byteplusDownloadUrl(url: string, kind: string): Promise<OrResult<Buffer>> {
  if (!url) return { ok: false, error: `byteplus: ${kind} URL not found` };
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `byteplus download HTTP ${res.status}`, status: res.status };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { ok: true, data: buf } : { ok: false, error: "byteplus: empty result" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "byteplus download error" };
  }
}

/** falVideoUrlToBuffer ekvivalenti (video natija). */
export async function byteplusVideoUrlToBuffer(url: string): Promise<OrResult<Buffer>> {
  return byteplusDownloadUrl(url, "video");
}

// ── SEEDREAM (rasm) — SINXRON endpoint: POST {base}/images/generations (OpenAI-images-mos).
// Video task/poll'dan farqli — bitta so'rov natijani darhol qaytaradi (docs §8).
export type ByteplusImageParams = {
  prompt: string;
  imageUrls?: string[]; // referens rasmlar (PUBLIC URL) — Seedream ko'p-referens qo'llaydi
  size?: string; // tier: "1K" | "2K" | "4K" (model qo'llasa)
};

/**
 * Seedream rasm generatsiyasi. v1: bitta rasm chiqishi (sequential_image_generation
 * ISHLATILMAYDI — kelajak faza). 429 → qisqa backoff bilan qayta urinish; baribir limit
 * bo'lsa oddiy xato (sinxron oqim — refund yo'li ishlaydi, video sentinel semantikasi EMAS).
 */
export async function byteplusImage(
  model: string,
  p: ByteplusImageParams
): Promise<OrResult<Buffer[]>> {
  if (!isByteplusConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = {
    model,
    prompt: p.prompt,
    output_format: "png",
    response_format: "url",
    watermark: false, // ⚠️ BIZDA HAR DOIM false
  };
  const refs = (p.imageUrls || []).filter((u) => typeof u === "string" && u.length > 0);
  if (refs.length) body.image = refs.length === 1 ? refs[0] : refs; // string | string[] (docs §8)
  if (p.size) body.size = p.size;
  const backoffMs = [0, 2000, 5000];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt]) await sleep(backoffMs[attempt]);
    let res: Response;
    try {
      res = await fetch(`${ARK_BASE}/images/generations`, {
        method: "POST",
        headers: bpHeaders(),
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, error: (e as Error).message || "byteplus: could not connect to image endpoint" };
    }
    if (!res.ok) {
      const msg = await errText(res);
      if (res.status === 429 || isRateLimitError(msg)) continue; // retryable — keyingi backoff
      return { ok: false, error: mapByteplusError(msg), status: res.status };
    }
    const j = (await safeJson(res)) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      usage?: ByteplusUsage;
    } | null;
    const items = Array.isArray(j?.data) ? j.data : [];
    const bufs: Buffer[] = [];
    for (const it of items) {
      if (it?.url) {
        const dl = await byteplusDownloadUrl(it.url, "image");
        if (!dl.ok) return dl;
        bufs.push(dl.data);
      } else if (it?.b64_json) {
        bufs.push(Buffer.from(it.b64_json, "base64"));
      }
    }
    if (!bufs.length) return { ok: false, error: "byteplus: image URL not found" };
    if (j?.usage) {
      console.log(
        `[byteplus] image usage total_tokens=${j.usage.total_tokens ?? "?"} (model=${model})`
      );
    }
    return { ok: true, data: bufs };
  }
  return { ok: false, error: "byteplus: image rate limit — please try again shortly" };
}
