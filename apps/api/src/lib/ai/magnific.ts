/**
 * Magnific (Freepik) API adapteri — Studio Gen PROVAYDER QATLAMI (OpenRouter o'rniga,
 * `GEN_PROVIDER` env-flag bilan blue-green almashinadi). Kalit: `MAGNIFIC_API_KEY` (server-only,
 * plaginга hech qachon chiqmaydi).
 *
 * Job model (deyarli barcha AI tools): POST create → `{data:{task_id,status}}` →
 * poll `GET /v1/ai/{tool}/{task_id}` → status `CREATED → IN_PROGRESS → COMPLETED → FAILED` →
 * `COMPLETED` da `data.generated[]` (rasm URL) yoki `video_url`. Natija URL vaqtinchalik →
 * darrov Buffer'ga yuklab olinadi (chaqiruvchi R2'ga saqlaydi).
 *
 * MUHIM: bu faqat provayder qatlami. Kredit/quote/job skeleton (consume/refund, cost-quote,
 * gen-processor status mashinasi) va Workers AI embedding TEGILMAYDI — kontrakt `OrResult<Buffer>`
 * (openrouter bilan bir xil) bo'lgani uchun gen-processor ikkala provayderni ham chaqira oladi.
 */
import type { OrResult, OrImageConfig } from "./openrouter.js";

const BASE = "https://api.magnific.com";
const KEY = process.env.MAGNIFIC_API_KEY ?? "";

export function isMagnificConfigured(): boolean {
  return Boolean(KEY);
}

/** Provayder flagi — `magnific` bo'lsa gen Magnific'ga, aks holda OpenRouter (default). */
export function genProvider(): "openrouter" | "magnific" {
  return process.env.GEN_PROVIDER === "magnific" ? "magnific" : "openrouter";
}

const NOT_CONFIGURED: OrResult<never> = {
  ok: false,
  error: "MAGNIFIC_NOT_CONFIGURED",
};

function mgHeaders(): Record<string, string> {
  return { "x-magnific-api-key": KEY, "Content-Type": "application/json" };
}
function mgPost(path: string, body: unknown): Promise<Response> {
  return fetch(BASE + path, { method: "POST", headers: mgHeaders(), body: JSON.stringify(body) });
}
function mgGet(path: string): Promise<Response> {
  return fetch(BASE + path, { headers: { "x-magnific-api-key": KEY } });
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Xato xabari — `{message}` yoki RFC-7807 `{message,invalid_params}` yoki HTTP holati. */
async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string; error?: string };
    if (typeof j?.message === "string") return j.message;
    if (typeof j?.error === "string") return j.error;
  } catch {
    /* ignore */
  }
  return `Magnific HTTP ${res.status}`;
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

// aspect_ratio remap — AssetFlow ("16:9") → Magnific enum ("widescreen_16_9").
const ASPECT_MAP: Record<string, string> = {
  "1:1": "square_1_1",
  "16:9": "widescreen_16_9",
  "9:16": "social_story_9_16",
  "4:3": "traditional_4_3",
  "3:4": "social_post_4_5",
  "3:2": "standard_3_2",
  "2:3": "portrait_2_3",
};
function mapAspectRatio(a?: string): string | undefined {
  if (!a) return undefined;
  return ASPECT_MAP[a];
}
// quality "1K"/"2K"/"4K" → resolution "1k"/"2k"/"4k" (default 2k).
function mapResolution(q?: string): "1k" | "2k" | "4k" {
  const s = (q ?? "").toLowerCase();
  if (s === "1k") return "1k";
  if (s === "4k") return "4k";
  return "2k";
}

// ── Job submit → poll → birinchi natija URL ────────────────────────────────
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100; // ~5 daqiqa
const MAX_SUBMIT_RETRY = 2;

type MgTask = { data?: { task_id?: string; status?: string } };
type MgPollData = { status?: string; generated?: string[]; video_url?: string };

async function submitAndPoll(
  tool: string,
  body: Record<string, unknown>
): Promise<OrResult<string>> {
  if (!isMagnificConfigured()) return NOT_CONFIGURED;
  // SUBMIT — 503/429 da eksponensial backoff (reference §7 tavsiyasi).
  let taskId = "";
  for (let attempt = 0; attempt <= MAX_SUBMIT_RETRY; attempt++) {
    const res = await mgPost(`/v1/ai/${tool}`, body);
    if (res.ok) {
      const j = (await safeJson(res)) as MgTask | null;
      taskId = j?.data?.task_id ?? "";
      if (taskId) break;
      return { ok: false, error: "Magnific task_id qaytarmadi" };
    }
    if ((res.status === 503 || res.status === 429) && attempt < MAX_SUBMIT_RETRY) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    return { ok: false, error: await errText(res), status: res.status };
  }
  if (!taskId) return { ok: false, error: "Magnific task yaratilmadi" };
  // POLL — COMPLETED/FAILED'gacha; transient (429/5xx) da poll davom etadi.
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const res = await mgGet(`/v1/ai/${tool}/${taskId}`);
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) continue;
      return { ok: false, error: await errText(res), status: res.status };
    }
    const j = (await safeJson(res)) as ({ data?: MgPollData } & MgPollData) | null;
    const d = (j?.data ?? j ?? {}) as MgPollData;
    if (d.status === "COMPLETED") {
      const url = (d.generated && d.generated[0]) || d.video_url;
      if (typeof url === "string" && url) return { ok: true, data: url };
      return { ok: false, error: "Magnific natija URL topilmadi" };
    }
    if (d.status === "FAILED") {
      return { ok: false, error: "Magnific generatsiya muvaffaqiyatsiz (FAILED)" };
    }
    // CREATED / IN_PROGRESS → poll davom etadi
  }
  return { ok: false, error: "Magnific poll timeout — natija olinmadi" };
}

/** Natija URL'ini Buffer'ga yuklab oladi (chaqiruvchi R2'ga saqlaydi). */
async function mgDownload(url: string): Promise<OrResult<Buffer>> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `Magnific yuklab olish HTTP ${res.status}`, status: res.status };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { ok: true, data: buf } : { ok: false, error: "Magnific bo'sh natija" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Magnific yuklab olish xatosi" };
  }
}

/** data-URI yoki HTTPS URL → base64 (Magnific reference 'byte' format). */
async function toBase64(u: string): Promise<string | null> {
  const i = u.indexOf("base64,");
  if (i >= 0) return u.slice(i + 7);
  if (/^https?:\/\//i.test(u)) {
    try {
      const res = await fetch(u);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer()).toString("base64");
    } catch {
      return null;
    }
  }
  return u; // allaqachon toza base64 bo'lishi mumkin
}

// ── Dedicated Magnific tools (upscale/relight/camera/skin/extend/removebg/video) ──
// submitAndPoll generic; har tool faqat manba-rasm (base64) + o'z params'ini qo'shadi.
// MUHIM: quyidagi non-image param nomlari web-UI'дан olingan (taxminiy) — birinchi jonli
// chaqiruvда (canary) aniq schema tasdiqlanishi kerak (maydon mos kelmasa 400).
function mfNum(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function mfStr(v: unknown, d: string): string {
  return typeof v === "string" && v ? v : d;
}

/** Tool slug (versiya/model segmentisiz) → non-image body params. */
function mfToolBody(slug: string, params: Record<string, unknown>): Record<string, unknown> {
  if (slug.startsWith("image-upscaler")) {
    return {
      scale_factor: mfStr(params.scale_factor, "2x"),
      optimized_for: mfStr(params.optimized_for, "standard"),
      creativity: mfNum(params.creativity, -3),
      hdr: mfNum(params.hdr, 0),
      resemblance: mfNum(params.resemblance, 3),
      fractality: mfNum(params.fractality, 0),
      engine: mfStr(params.engine, "automatic"),
      ...(typeof params.prompt === "string" && params.prompt ? { prompt: stripMentions(params.prompt) } : {}),
    };
  }
  if (slug.startsWith("image-relight")) {
    return {
      rotate: mfNum(params.rotate, 0),
      elevation: mfNum(params.elevation, 0),
      intensity: mfNum(params.intensity, 5),
      light_color: mfStr(params.light_color, "white"),
    };
  }
  if (slug.startsWith("image-change-camera")) {
    return {
      rotate: mfNum(params.rotate, 45),
      vertical: mfNum(params.vertical, 0),
      zoom: mfStr(params.zoom, "initial"),
    };
  }
  if (slug.startsWith("skin-enhancer")) {
    return {
      optimized_for: mfStr(params.optimized_for, "enhance_skin"),
      sharpen: mfNum(params.sharpen, 0),
      smart_grain: mfNum(params.smart_grain, 2),
    };
  }
  if (slug.startsWith("image-expand")) {
    return {
      ...(params.width ? { width: mfNum(params.width, 0) } : {}),
      ...(params.height ? { height: mfNum(params.height, 0) } : {}),
      ...(typeof params.prompt === "string" && params.prompt ? { prompt: stripMentions(params.prompt) } : {}),
    };
  }
  if (slug.startsWith("video-upscaler")) {
    return {
      resolution: mfStr(params.resolution, "1440p"),
      fps_boost: Boolean(params.fps_boost),
      turbo: Boolean(params.turbo),
    };
  }
  // beta/remove-background — parametrsiz; boshqalar default bo'sh.
  return {};
}

/**
 * Generic dedicated tool — manba rasm/video (base64) + tool params → natija Buffer.
 * Kontrakt `OrResult<Buffer>` (gen-processor ikkala provayderni bir xil chaqiradi).
 * `inputKey` = "image" (default) yoki "video" (video-upscaler).
 */
export async function magnificTool(
  toolSlug: string,
  refUrl: string,
  params: Record<string, unknown>
): Promise<OrResult<Buffer>> {
  if (!isMagnificConfigured()) return NOT_CONFIGURED;
  const b64 = await toBase64(refUrl);
  if (!b64) return { ok: false, error: "Manba rasm o'qilmadi" };
  const inputKey = toolSlug.startsWith("video-upscaler") ? "video" : "image";
  const body: Record<string, unknown> = { [inputKey]: b64, ...mfToolBody(toolSlug, params) };
  const r = await submitAndPoll(toolSlug, body);
  if (!r.ok) return r;
  return mgDownload(r.data);
}

/**
 * Mystic AssetFlow '@mention' (reference) sintaksisini bilmaydi — prompt'даги "@img"/"@image 1"
 * tokenlarni "character name" deb o'qiydi → "Invalid character name". Reference rasm allaqachon
 * `style_reference`/`structure_reference` orqali yuboriladi (prompt matniда EMAS), shuning uchun
 * Mystic'ga yuborishдан OLDIN @mention'larни olib tashlaymiz.
 */
function stripMentions(p: string): string {
  return (p || "")
    .replace(/@[\w-]+(?:\s+\d+)?/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Mystic — text-to-image. `orImage` kontraktiga mos (`OrResult<Buffer>`). */
export async function magnificImage(
  mysticModel: string,
  prompt: string,
  _modalities?: string[],
  imageConfig?: OrImageConfig
): Promise<OrResult<Buffer>> {
  if (!isMagnificConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = {
    prompt: stripMentions(prompt),
    model: mysticModel || "realism",
    resolution: mapResolution(imageConfig?.image_size),
    filter_nsfw: true, // Magnific majburiy default
  };
  const ar = mapAspectRatio(imageConfig?.aspect_ratio);
  if (ar) body.aspect_ratio = ar;
  const r = await submitAndPoll("mystic", body);
  if (!r.ok) return r;
  return mgDownload(r.data);
}

/** Mystic image-edit — reference (data-URI/URL) `style_reference` sifatida. `orImageEdit` kontrakti. */
export async function magnificImageEdit(
  mysticModel: string,
  prompt: string,
  refImageUrl: string,
  _modalities?: string[],
  imageConfig?: OrImageConfig
): Promise<OrResult<Buffer>> {
  if (!isMagnificConfigured()) return NOT_CONFIGURED;
  const styleRef = await toBase64(refImageUrl);
  if (!styleRef) return { ok: false, error: "Reference rasm o'qilmadi" };
  const body: Record<string, unknown> = {
    prompt: stripMentions(prompt),
    model: mysticModel || "realism",
    resolution: mapResolution(imageConfig?.image_size),
    style_reference: styleRef,
    filter_nsfw: true,
  };
  const ar = mapAspectRatio(imageConfig?.aspect_ratio);
  if (ar) body.aspect_ratio = ar;
  const r = await submitAndPoll("mystic", body);
  if (!r.ok) return r;
  return mgDownload(r.data);
}
