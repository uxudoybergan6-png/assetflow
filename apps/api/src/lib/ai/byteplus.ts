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
 * @-mention referens tokenlarini BytePlus "Image n"/"Video n"/"Audio n" dialektiga aylantiradi.
 *
 * BytePlus qoidasi: "n" — content massividagi O'SHA TUR asseti orasidagi 1-based tartib raqami,
 * `first_frame`/`last_frame` rollarini HAM sanaydi. Bizning `@img1` esa "birinchi REFERENS rasm"
 * degani — shu bois start/end kadr bo'lsa `@img1` "Image 2" (yoki 3) bo'lishi kerak. Offset =
 * referens rasmlardan OLDIN content'ga qo'yiladigan image_url yozuvlari soni (0/1/2).
 *
 * Sof funksiya (I/O yo'q) — build-time dry-run bilan test qilinadi. Foydalanuvchilar `@vid2`/`@aud1`
 * qisqa shakllarini ham yozadi → ularni ham qabul qilamiz (case-insensitive, `@` chap chegara).
 * Mos referens bo'lmagan token (masalan `@img9`) zararsiz raqam bilan qoladi — crash YO'Q.
 */
export type MentionCounts = { imageOffset: number; videoOffset: number; audioOffset: number };
export function rewriteMentionTokens(prompt: string, counts: MentionCounts): string {
  const io = Math.max(0, Math.trunc(counts.imageOffset || 0));
  const vo = Math.max(0, Math.trunc(counts.videoOffset || 0));
  const ao = Math.max(0, Math.trunc(counts.audioOffset || 0));
  return String(prompt)
    .replace(/@(?:image|img)(\d+)/gi, (_m, n: string) => `Image ${Number(n) + io}`)
    .replace(/@(?:video|vid)(\d+)/gi, (_m, n: string) => `Video ${Number(n) + vo}`)
    .replace(/@(?:audio|aud)(\d+)/gi, (_m, n: string) => `Audio ${Number(n) + ao}`);
}

/**
 * Mention-dialekt build-time dry-run testi — gen-models-validate CLI'dan chaqiriladi.
 * Xato topilsa satrlar ro'yxatini qaytaradi (bo'sh = OK). Har case: [prompt, counts, kutilgan].
 */
export function mentionTokenSelfTest(): string[] {
  const Z: MentionCounts = { imageOffset: 0, videoOffset: 0, audioOffset: 0 };
  const F1: MentionCounts = { imageOffset: 1, videoOffset: 0, audioOffset: 0 }; // start-frame bor
  const F2: MentionCounts = { imageOffset: 2, videoOffset: 0, audioOffset: 0 }; // start+end frame
  const cases: Array<[string, MentionCounts, string]> = [
    ["Use @img1 here", Z, "Use Image 1 here"], // oddiy
    ["@IMG1 and @Image2", Z, "Image 1 and Image 2"], // aralash reg (case-insensitive)
    ["look at @img1,", Z, "look at Image 1,"], // yondosh tinish belgisi
    ["ref @img12 now", Z, "ref Image 12 now"], // ko'p raqamli
    ["@img9 missing", Z, "Image 9 missing"], // mos ref yo'q → zararsiz qoladi
    ["@img1 with start", F1, "Image 2 with start"], // start-frame offset
    ["@img1 and @img2", F2, "Image 3 and Image 4"], // start+end frame offset (2)
    ["@vid2 and @aud1", Z, "Video 2 and Audio 1"], // video+audio qisqa shakl birga
    ["@video1 + @audio1", Z, "Video 1 + Audio 1"], // to'liq shakl
    ["@vid1 unshifted", F2, "Video 1 unshifted"], // video offset yo'q (kadr-rol video yo'q)
    ["no tokens at all", Z, "no tokens at all"], // token yo'q → o'zgarmaydi
    ["email me@x.com", Z, "email me@x.com"], // @word raqamsiz → tegilmaydi
  ];
  const fails: string[] = [];
  for (const [inp, counts, want] of cases) {
    const got = rewriteMentionTokens(inp, counts);
    if (got !== want) fails.push(`rewriteMentionTokens("${inp}") = "${got}" (kutilgan "${want}")`);
  }
  return fails;
}

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
  const arr = (a?: string[]) =>
    Array.isArray(a) ? a.filter((u) => typeof u === "string" && u.length > 0) : [];
  // Kadr-rolli rasmlar referens rasmlardan OLDIN chiqadi → @imgN raqamini surib qo'yadi.
  const frameImages: Record<string, unknown>[] = [];
  if (refs.startUrl) {
    frameImages.push({ type: "image_url", image_url: { url: refs.startUrl }, role: "first_frame" });
  }
  if (model.endFrame && refs.endUrl) {
    frameImages.push({ type: "image_url", image_url: { url: refs.endUrl }, role: "last_frame" });
  }
  // Offsetlarni builder'ning O'ZIDAN sanaymiz (taxmin qilmaymiz): bugun faqat rasmda kadr-rol bor,
  // video/audio uchun referensdan oldin hech narsa yo'q → 0. Kelajakda kadr-rol qo'shilsa shu yerga.
  const counts: MentionCounts = { imageOffset: frameImages.length, videoOffset: 0, audioOffset: 0 };
  const text = rewriteMentionTokens(String(prompt), counts);
  const content: Record<string, unknown>[] = [{ type: "text", text }, ...frameImages];
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
  // Docs enum: queued | running | succeeded | failed | expired. `expired` (execution_expires_after,
  // 48h) ilgari e'tiborsiz qolib poll abadiy pending qaytarardi → faqat reconciler 20 daq+ kutib
  // hal qilardi. Endi failed sifatida map qilamiz (haqiqiy tugash → refund yo'li to'g'ri ishlaydi).
  if (status === "failed" || status === "cancelled" || status === "expired") {
    const code = j?.error?.code || "";
    const msg = j?.error?.message || "";
    const text =
      [code, msg].filter(Boolean).join(": ") ||
      (status === "expired" ? "byteplus: task expired before completion" : "byteplus: generation failed");
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

// Rasmiy nisbat→piksel jadvali (docs/BYTEPLUS-DOCS-MODELS.md §8) — aspect nazorati uchun
// `size` sifatida ANIQ piksel yuboriladi ("2048x2048"); jadvalda yo'q kombinatsiya → tier
// string fallback (hech qachon piksel taxmin qilinmaydi). Kalit: byteplusModel → tier → nisbat.
const SEEDREAM_PIXEL_SIZES: Record<string, Record<string, Record<string, string>>> = {
  // Dola-Seedream 5.0 Pro
  "dola-seedream-5-0-pro-260628": {
    "1K": {
      "1:1": "1024x1024", "4:3": "1152x864", "3:4": "864x1152", "16:9": "1424x800",
      "9:16": "800x1424", "3:2": "1248x832", "2:3": "832x1248", "21:9": "1568x672",
    },
    "2K": {
      "1:1": "2048x2048", "4:3": "2368x1776", "3:4": "1776x2368", "16:9": "2816x1584",
      "9:16": "1584x2816", "3:2": "2496x1664", "2:3": "1664x2496", "21:9": "3136x1344",
    },
  },
  // Seedream 5.0 Lite
  "seedream-5-0-260128": {
    "2K": {
      "1:1": "2048x2048", "4:3": "2304x1728", "3:4": "1728x2304", "16:9": "2848x1600",
      "9:16": "1600x2848", "3:2": "2496x1664", "2:3": "1664x2496", "21:9": "3136x1344",
    },
    "4K": {
      "1:1": "4096x4096", "4:3": "4704x3520", "3:4": "3520x4704", "16:9": "5504x3040",
      "9:16": "3040x5504", "3:2": "4992x3328", "2:3": "3328x4992", "21:9": "6240x2656",
    },
  },
};
// SC_57: Seedream 4.5 (2K/4K) Lite bilan bir xil nisbat→piksel jadvalini qabul qiladi (jonli
// tekshirildi 2026-07-20: 2K/4K har nisbat OK) — takrorlamasdan qayta ishlatamiz.
SEEDREAM_PIXEL_SIZES["seedream-4-5-251128"] = SEEDREAM_PIXEL_SIZES["seedream-5-0-260128"];

// SC_57: bu modellar `output_format` param'ini QABUL QILMAYDI (400 InvalidParameter) — 5.0 Pro/Lite
// qabul qiladi, Seedream 4.5 esa yo'q. byteplusImage shu modellar uchun output_format'ni tashlaydi.
const SEEDREAM_NO_OUTPUT_FORMAT = new Set<string>(["seedream-4-5-251128"]);

/**
 * (model, tier, nisbat) → yuboriladigan `size` qiymati. Nisbat berilgan va jadvalda mavjud
 * bo'lsa aniq piksel; aks holda tier string o'zgarishsiz. Sof funksiya — build-time test.
 */
export function seedreamSize(model: string, tier?: string, aspect?: string): string | undefined {
  if (aspect && tier) {
    const px = SEEDREAM_PIXEL_SIZES[model]?.[tier]?.[aspect];
    if (px) return px;
  }
  return tier;
}

/** Seedream nisbat→piksel build-time dry-run testi (mentionTokenSelfTest naqshi; bo'sh = OK). */
export function seedreamSizeSelfTest(): string[] {
  const cases: Array<[string, string | undefined, string | undefined, string | undefined]> = [
    ["dola-seedream-5-0-pro-260628", "1K", "16:9", "1424x800"], // Pro 1K 16:9
    ["seedream-5-0-260128", "4K", "21:9", "6240x2656"], // Lite 4K 21:9
    ["seedream-5-0-260128", "2K", "1:1", "2048x2048"],
    ["dola-seedream-5-0-pro-260628", "2K", "9:16", "1584x2816"],
    ["dola-seedream-5-0-pro-260628", "1K", undefined, "1K"], // nisbatsiz → tier
    ["dola-seedream-5-0-pro-260628", "1K", "Auto", "1K"], // noma'lum kombinatsiya → tier fallback
    ["dola-seedream-5-0-pro-260628", "4K", "16:9", "4K"], // Pro'da 4K tier yo'q → tier fallback
    ["boshqa-model", "2K", "16:9", "2K"], // jadvalda yo'q model → tier fallback
    ["seedream-5-0-260128", undefined, "16:9", undefined], // tier'siz → undefined (body'ga qo'shilmaydi)
  ];
  const fails: string[] = [];
  for (const [m, t, a, want] of cases) {
    const got = seedreamSize(m, t, a);
    if (got !== want) fails.push(`seedreamSize("${m}","${t}","${a}") = "${got}" (kutilgan "${want}")`);
  }
  return fails;
}

export type ByteplusImageParams = {
  prompt: string;
  imageUrls?: string[]; // referens rasmlar (PUBLIC URL) — Seedream ko'p-referens qo'llaydi
  size?: string; // tier: "1K" | "2K" | "4K" (model qo'llasa)
  aspect?: string; // nisbat ("16:9" ...) — tier bilan birga aniq piksel size'ga aylanadi (§8 jadval)
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
    response_format: "url",
    watermark: false, // ⚠️ BIZDA HAR DOIM false
  };
  if (!SEEDREAM_NO_OUTPUT_FORMAT.has(model)) body.output_format = "png"; // 4.5 bu param'ni rad etadi
  const refs = (p.imageUrls || []).filter((u) => typeof u === "string" && u.length > 0);
  if (refs.length) body.image = refs.length === 1 ? refs[0] : refs; // string | string[] (docs §8)
  const size = seedreamSize(model, p.size, p.aspect); // nisbat bo'lsa aniq piksel, aks holda tier
  if (size) body.size = size;
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
