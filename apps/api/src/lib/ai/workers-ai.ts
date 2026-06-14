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
