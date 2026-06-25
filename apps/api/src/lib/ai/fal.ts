// fal.ai adapter — queue submit/poll + R2-friendly output. Manba: docs/FAL-DOCS-CORE.md.
// Auth: header `Authorization: Key $FAL_KEY` (Bearer EMAS). Kalit env'dan, hech qachon log/clientga.
// Kontrakt: gen-processor `OrResult<Buffer>` kutadi (magnific.ts naqshi). Timeout = FAL_TIMEOUT sentinel
// (gen-processor refund qilmaydi — reconcile hal qiladi).
import type { OrResult } from "./openrouter.js";

const QUEUE_BASE = "https://queue.fal.run";
const KEY = process.env.FAL_KEY ?? ""; // bir marta, modul darajasida

export function isFalConfigured(): boolean {
  return Boolean(KEY);
}
const NOT_CONFIGURED: OrResult<never> = { ok: false, error: "FAL_NOT_CONFIGURED" };

function falHeaders(): Record<string, string> {
  return { Authorization: `Key ${KEY}`, "Content-Type": "application/json" };
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
// Provider xabarini chiqaramiz; xato bo'lsa faqat status — HECH QACHON kalit/headerlar emas.
async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      detail?: string | { msg?: string }[];
      error?: string;
      message?: string;
    };
    if (typeof j?.detail === "string") return j.detail;
    if (Array.isArray(j?.detail) && j.detail[0]?.msg) return String(j.detail[0].msg);
    if (typeof j?.error === "string") return j.error;
    if (typeof j?.message === "string") return j.message;
  } catch {
    /* ignore */
  }
  return `fal HTTP ${res.status}`;
}

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 100; // ~150s (rasm/LLM jobs uchun yetarli; background, HTTP'ni bloklamaydi)

type FalSubmitResp = { request_id?: string; status_url?: string; response_url?: string };
type FalStatus = { status?: string; error?: string };

/**
 * Queue submit + status_url'ni COMPLETED gacha poll + response_url → output obyekt.
 * Timeout (job hali IN_PROGRESS) → FAL_TIMEOUT sentinel (refund YO'Q — magnific naqshi).
 */
async function falSubmit(modelId: string, input: Record<string, unknown>): Promise<OrResult<unknown>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  let sub: Response;
  try {
    sub = await fetch(`${QUEUE_BASE}/${modelId}`, {
      method: "POST",
      headers: falHeaders(),
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "fal submit ulanmadi" };
  }
  if (!sub.ok) return { ok: false, error: await errText(sub), status: sub.status };
  const sj = (await safeJson(sub)) as FalSubmitResp | null;
  const statusUrl = sj?.status_url;
  const responseUrl = sj?.response_url;
  if (!statusUrl || !responseUrl) return { ok: false, error: "fal: status_url qaytmadi" };

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    let st: Response;
    try {
      st = await fetch(statusUrl, { headers: falHeaders() });
    } catch {
      continue; // tarmoq tebranishi — poll davom etadi
    }
    if (!st.ok) {
      if (st.status === 429 || st.status >= 500) continue; // transient → poll davom
      return { ok: false, error: await errText(st), status: st.status };
    }
    const sd = (await safeJson(st)) as FalStatus | null;
    const status = sd?.status;
    if (status === "COMPLETED") {
      let rr: Response;
      try {
        rr = await fetch(responseUrl, { headers: falHeaders() });
      } catch (e) {
        return { ok: false, error: (e as Error).message || "fal natija ulanmadi" };
      }
      if (!rr.ok) return { ok: false, error: await errText(rr), status: rr.status };
      const out = await safeJson(rr);
      if (out == null) return { ok: false, error: "fal: bo'sh natija" };
      return { ok: true, data: out };
    }
    // IN_QUEUE / IN_PROGRESS → poll davom
  }
  return { ok: false, error: "FAL_TIMEOUT: job hali ishlamoqda — refund yo'q" };
}

// fal CDN natija URL'ini Buffer'ga yuklaydi (caller R2'ga persist qiladi).
async function falDownload(url: string): Promise<OrResult<Buffer>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `fal yuklab olish HTTP ${res.status}`, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { ok: true, data: buf } : { ok: false, error: "fal bo'sh natija" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "fal yuklab olish xatosi" };
  }
}

// UI nisbat → fal image_size enum.
const AR_TO_SIZE: Record<string, string> = {
  Auto: "auto",
  auto: "auto",
  "1:1": "square_hd",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};
const QUALITIES = ["auto", "low", "medium", "high"];

/**
 * GPT Image 2 Edit (image-to-image). `imageUrls` PUBLIC bo'lishi shart (caller R2'ga
 * materializatsiya qiladi — private/auth URL fal'da `file_download_error` beradi).
 * Bitta chaqiruv = bitta rasm (num_images:1); gen-processor count marta loop qiladi.
 */
export async function falImageEdit(
  modelKey: string,
  prompt: string,
  imageUrls: string[],
  opts?: { aspect?: string | null; quality?: string | null }
): Promise<OrResult<Buffer>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  if (!imageUrls.length) return { ok: false, error: "fal: tahrirlash uchun rasm yo'q" };
  const aspect = opts?.aspect || "";
  const q = (opts?.quality || "high").toLowerCase();
  // @img<N> → "image N" (image_urls tartibiga mos: @img1 = image_urls[0]). Model shu ko'rinishni tushunadi.
  const mappedPrompt = String(prompt).replace(/@img(\d+)/gi, (_m, n) => `image ${n}`);
  const input: Record<string, unknown> = {
    prompt: mappedPrompt,
    image_urls: imageUrls,
    image_size: AR_TO_SIZE[aspect] || "auto",
    quality: QUALITIES.includes(q) ? q : "high",
    num_images: 1,
    output_format: "png",
  };
  const r = await falSubmit(modelKey, input);
  if (!r.ok) return r;
  const data = r.data as { images?: { url?: string }[]; image?: { url?: string } };
  const url = data?.images?.[0]?.url || data?.image?.url;
  if (!url) return { ok: false, error: "fal: natija rasm topilmadi" };
  return falDownload(url);
}

/**
 * Promptни yaxshilash — fal openrouter/router (Gemini 2.5 Flash). KIRISH TILINI saqlaydi,
 * faqat yakuniy promptни qaytaradi. MODEL-AWARE:
 *  - `imageUrls` berilsa (referens bor) → VISION yo'li (`openrouter/router/vision`): rasmlarni
 *    ham KO'RIB prompt yozadi. image_urls @img tartibida (image_urls[0] = @img1) — PUBLIC bo'lishi shart.
 *  - aks holda → matn yo'li (`openrouter/router`), o'zgarishsiz.
 */
export async function falEnhancePrompt(
  text: string,
  imageUrls?: string[]
): Promise<OrResult<string>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const refs = (imageUrls || []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
  );

  let modelId: string;
  let input: Record<string, unknown>;
  if (refs.length > 0) {
    // VISION — referens rasmlarni tahlil qilib prompt yozadi.
    modelId = "openrouter/router/vision";
    input = {
      image_urls: refs, // @img tartibida: image_urls[0] = @img1
      prompt: text,
      model: "google/gemini-2.5-flash",
      system_prompt:
        "Sen tasvir tahrir/yaratish uchun prompt muhandisisan. Referens rasmlar tartibда: " +
        "1-rasm=@img1, 2-rasm=@img2, ... Foydalanuvchi ko'rsatmasi va rasmlarni tahlil qilib, " +
        "BITTA boy, aniq prompt yoz (rasmlardagini tushunib, @imgN ni to'g'ri ishlat). " +
        "KIRISH TILINI saqla. Faqat yakuniy promptni qaytar, izohsiz.",
      temperature: 0.6,
      max_tokens: 500,
    };
    console.log(`[fal] enhance VISION — ${refs.length} referens (openrouter/router/vision)`);
  } else {
    // TEXT — referens yo'q (hozirgi yo'l).
    modelId = "openrouter/router";
    input = {
      prompt: text,
      model: "google/gemini-2.5-flash",
      system_prompt:
        "Sen tasvir generatsiyasi uchun prompt muhandisisan. Qisqa g'oyani bitta boy, " +
        "tafsilotli promptga aylantir (kompozitsiya, yorug'lik, uslub, detal). KIRISH TILINI " +
        "saqla. Faqat yakuniy promptni qaytar, izohsiz.",
      temperature: 0.7,
      max_tokens: 400,
    };
    console.log("[fal] enhance TEXT (openrouter/router)");
  }

  const r = await falSubmit(modelId, input);
  if (!r.ok) return r;
  const data = r.data as { output?: string };
  const out = typeof data?.output === "string" ? data.output.trim() : "";
  if (!out) return { ok: false, error: "fal: bo'sh javob" };
  return { ok: true, data: out };
}
