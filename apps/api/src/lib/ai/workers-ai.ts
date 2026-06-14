/**
 * Cloudflare Workers AI — bitta integratsiya nuqtasi (PLAN-bosqich-3 qarori).
 * Barcha AI tool'lar (rasm / ovoz / qidiruv / matn) shu modul orqali o'tadi;
 * provayder kaliti FAQAT serverda (`CF_AI_TOKEN`), hech qachon panelda emas.
 *
 * API: POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{model}
 *      Authorization: Bearer {CF_AI_TOKEN}
 */

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "";
const CF_AI_TOKEN = process.env.CF_AI_TOKEN ?? "";

/** Model ID'lar env'dan sozlanadi — dashboard "Copy ID" qiymatlari default. */
export const AI_MODELS = {
  image: process.env.AI_MODEL_IMAGE ?? "@cf/black-forest-labs/flux-1-schnell",
  embed: process.env.AI_MODEL_EMBED ?? "@cf/baai/bge-m3",
  text: process.env.AI_MODEL_TEXT ?? "@cf/meta/llama-3.1-8b-instruct",
  tts: process.env.AI_MODEL_TTS ?? "@cf/myshell-ai/melotts",
} as const;

export function isAiConfigured(): boolean {
  return Boolean(CF_ACCOUNT_ID && CF_AI_TOKEN);
}

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type MediaFormat = { ext: string; contentType: string };

/**
 * Bufer magic-byte'laridan haqiqiy media formatni aniqlaydi — kengaytma/Content-Type
 * mos kelishi uchun (AE "Input doesn't seem to be a PNG" xatosi shu nomuvofiqlikdan).
 * Aniqlanmasa `fallback` qaytadi.
 */
export function detectMediaFormat(buf: Buffer, fallback: MediaFormat): MediaFormat {
  if (buf.length < 12) return fallback;
  const b = buf;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { ext: "png", contentType: "image/png" };
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { ext: "jpg", contentType: "image/jpeg" };
  // GIF: "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return { ext: "gif", contentType: "image/gif" };
  const tag0 = b.toString("ascii", 0, 4);
  const tag8 = b.toString("ascii", 8, 12);
  // RIFF konteyner: WEBP (rasm) yoki WAVE (audio)
  if (tag0 === "RIFF") {
    if (tag8 === "WEBP") return { ext: "webp", contentType: "image/webp" };
    if (tag8 === "WAVE") return { ext: "wav", contentType: "audio/wav" };
  }
  // OggS (audio)
  if (tag0 === "OggS") return { ext: "ogg", contentType: "audio/ogg" };
  // MP4/ISO-BMFF: 4–7 baytda "ftyp"
  if (b.toString("ascii", 4, 8) === "ftyp")
    return { ext: "mp4", contentType: "video/mp4" };
  // MP3: "ID3" yoki frame sync FF Ex/Fx
  if (
    (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  )
    return { ext: "mp3", contentType: "audio/mpeg" };
  return fallback;
}

const NOT_CONFIGURED = { ok: false as const, error: "AI_NOT_CONFIGURED" };

/** Workers AI `run` chaqiruvi — javobni xom `Response` sifatida qaytaradi. */
async function runModel(model: string, body: unknown): Promise<Response> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_AI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Xato javobidan o'qiladigan qisqa matn (CF `errors[].message` yoki status). */
async function errorText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { errors?: Array<{ message?: string }> };
    const msg = j?.errors?.map((e) => e.message).filter(Boolean).join("; ");
    if (msg) return msg;
  } catch {
    /* JSON emas */
  }
  return `Workers AI xatosi (HTTP ${res.status})`;
}

/**
 * Text-to-Image (Flux/SDXL). Flux schnell JSON `{ result: { image: <base64> } }`
 * qaytaradi; SDXL kabi modellar to'g'ridan binary PNG qaytarishi mumkin —
 * ikkala holat ham qo'llab-quvvatlanadi. Natija — PNG `Buffer`.
 */
export async function aiGenerateImage(prompt: string): Promise<AiResult<Buffer>> {
  if (!isAiConfigured()) return NOT_CONFIGURED;
  const res = await runModel(AI_MODELS.image, { prompt });
  if (!res.ok) return { ok: false, error: await errorText(res), status: res.status };

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const j = (await res.json()) as { result?: { image?: string } };
    const b64 = j?.result?.image;
    if (!b64) return { ok: false, error: "AI javobida rasm topilmadi" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { ok: false, error: "AI bo'sh rasm qaytardi" };
  return { ok: true, data: buf };
}

/**
 * Text-to-Speech (MeloTTS). JSON `{ result: { audio: <base64 mp3> } }`.
 * Natija — MP3 `Buffer`.
 */
export async function aiGenerateSpeech(
  text: string,
  lang = "en"
): Promise<AiResult<Buffer>> {
  if (!isAiConfigured()) return NOT_CONFIGURED;
  const res = await runModel(AI_MODELS.tts, { prompt: text, lang });
  if (!res.ok) return { ok: false, error: await errorText(res), status: res.status };

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const j = (await res.json()) as { result?: { audio?: string } };
    const b64 = j?.result?.audio;
    if (!b64) return { ok: false, error: "AI javobida audio topilmadi" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { ok: false, error: "AI bo'sh audio qaytardi" };
  return { ok: true, data: buf };
}

/**
 * Embeddings (bge-m3) — semantik qidiruv uchun. JSON
 * `{ result: { data: [[...]] } }`. Natija — bitta matn vektori (number[]).
 */
export async function aiEmbed(text: string): Promise<AiResult<number[]>> {
  if (!isAiConfigured()) return NOT_CONFIGURED;
  const res = await runModel(AI_MODELS.embed, { text: [text] });
  if (!res.ok) return { ok: false, error: await errorText(res), status: res.status };

  const j = (await res.json()) as { result?: { data?: number[][] } };
  const vec = j?.result?.data?.[0];
  if (!Array.isArray(vec)) return { ok: false, error: "AI javobida vektor topilmadi" };
  return { ok: true, data: vec };
}

/** Text generation (Llama) — prompt yordam / auto-tag. Natija — string. */
export async function aiText(prompt: string): Promise<AiResult<string>> {
  if (!isAiConfigured()) return NOT_CONFIGURED;
  const res = await runModel(AI_MODELS.text, { prompt });
  if (!res.ok) return { ok: false, error: await errorText(res), status: res.status };

  const j = (await res.json()) as { result?: { response?: string } };
  const out = j?.result?.response;
  if (typeof out !== "string") return { ok: false, error: "AI javobi bo'sh" };
  return { ok: true, data: out };
}
