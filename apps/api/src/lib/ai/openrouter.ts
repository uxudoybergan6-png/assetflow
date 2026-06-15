/**
 * OpenRouter — yagona unified API (Workers AI o'rniga Studio Gen uchun).
 * Docs (2026-06): chat /chat/completions (OpenAI-compat), image=modalities, video=async /videos,
 * embeddings /embeddings, speech=audio modality. Kalit: OPENROUTER_API_KEY.
 */
const BASE = "https://openrouter.ai/api/v1";
const KEY = process.env.OPENROUTER_API_KEY ?? "";
const REFERER = process.env.API_PUBLIC_URL ?? "https://assetflow-rqbq.onrender.com";

export function isOpenRouterConfigured(): boolean {
  return Boolean(KEY);
}

function orHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": REFERER,
    "X-Title": "AssetFlow",
  };
}

export type OrResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

const NOT_CONFIGURED: OrResult<never> = {
  ok: false,
  error: "OPENROUTER_NOT_CONFIGURED",
};

async function errText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    if (typeof j?.error === "string") return j.error;
    if (j?.error?.message) return j.error.message;
  } catch {
    /* ignore */
  }
  return `OpenRouter HTTP ${res.status}`;
}

/** Javobni xavfsiz JSON'ga o'giradi — bo'sh/buzuq bo'lsa null (raw "Unexpected end of JSON" o'rniga). */
async function safeJson(res: Response): Promise<unknown | null> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function orPost(path: string, body: unknown): Promise<Response> {
  return fetch(BASE + path, {
    method: "POST",
    headers: orHeaders(),
    body: JSON.stringify(body),
  });
}

/** `data:<mime>;base64,XXX` yoki toza base64 → Buffer. */
function dataUrlToBuffer(u: string): Buffer | null {
  const i = u.indexOf("base64,");
  const b64 = i >= 0 ? u.slice(i + 7) : u;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

// ── Matn (enhance / prompt yordam) — OpenAI-compatible chat ─────────────────
export async function orChat(model: string, prompt: string): Promise<OrResult<string>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const res = await orPost("/chat/completions", {
    model,
    messages: [{ role: "user", content: prompt }],
  });
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const txt = j?.choices?.[0]?.message?.content;
  if (typeof txt !== "string") return { ok: false, error: "Javobda matn topilmadi" };
  return { ok: true, data: txt };
}

// ── Rasm generatsiya — /chat/completions + modalities:["image","text"] ──────
type OrImageJson = {
  choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
};
function extractImage(j: OrImageJson): Buffer | null {
  const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  return url ? dataUrlToBuffer(url) : null;
}

// Rasm o'lcham/nisbat — NATIVE (image_config), promptga qo'shilmaydi.
export type OrImageConfig = { aspect_ratio?: string; image_size?: string };

export async function orImage(
  model: string,
  prompt: string,
  modalities: string[] = ["image", "text"],
  imageConfig?: OrImageConfig
): Promise<OrResult<Buffer>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    modalities,
  };
  if (imageConfig && Object.keys(imageConfig).length) body.image_config = imageConfig;
  // Bo'sh/transient javobga bardosh: 2 marta urinamiz, raw JSON xatosi o'rniga aniq xabar.
  let lastErr = "Rasm olinmadi";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await orPost("/chat/completions", body);
    if (!res.ok) {
      lastErr = await errText(res);
      if (attempt === 0 && (res.status >= 500 || res.status === 429)) continue;
      return { ok: false, error: lastErr, status: res.status };
    }
    const j = await safeJson(res);
    if (!j) {
      lastErr = "Model bu so'rovga javob qaytarmadi — qayta urinib ko'ring yoki boshqa model tanlang";
      if (attempt === 0) continue;
      return { ok: false, error: lastErr };
    }
    const buf = extractImage(j as OrImageJson);
    if (buf) return { ok: true, data: buf };
    // Ko'pincha: video tavsifi (ovoz/kamera/harakat) rasm modeliga berilган → rasm chiqmaydi.
    lastErr = "Model rasm qaytarmadi — prompt rasmга mos emasligi mumkin (video tavsifi bo'lsa Video rejimini tanlang)";
    if (attempt === 0) continue;
  }
  return { ok: false, error: lastErr };
}

/** Rasm EDIT (reference + ko'rsatma — "rangini o'zgartir"). refImageUrl = URL yoki data-URL. */
export async function orImageEdit(
  model: string,
  prompt: string,
  refImageUrl: string,
  modalities: string[] = ["image", "text"],
  imageConfig?: OrImageConfig
): Promise<OrResult<Buffer>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: refImageUrl } },
        ],
      },
    ],
    modalities,
  };
  if (imageConfig && Object.keys(imageConfig).length) body.image_config = imageConfig;
  let lastErr = "Tahrirlangan rasm olinmadi";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await orPost("/chat/completions", body);
    if (!res.ok) {
      lastErr = await errText(res);
      if (attempt === 0 && (res.status >= 500 || res.status === 429)) continue;
      return { ok: false, error: lastErr, status: res.status };
    }
    const j = await safeJson(res);
    if (!j) {
      lastErr = "Model bu so'rovga javob qaytarmadi — qayta urinib ko'ring yoki boshqa model tanlang";
      if (attempt === 0) continue;
      return { ok: false, error: lastErr };
    }
    const buf = extractImage(j as OrImageJson);
    if (buf) return { ok: true, data: buf };
    lastErr = "Model tahrirlangan rasm qaytarmadi — qayta urinib ko'ring";
    if (attempt === 0) continue;
  }
  return { ok: false, error: lastErr };
}

// ── Speech (TTS) — POST /audio/speech (OpenAI-mos, RAW bayt qaytaradi, JSON EMAS) ──
export async function orSpeech(
  model: string,
  text: string,
  voice = ""
): Promise<OrResult<Buffer>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  // voice IXTIYORIY: bo'sh bo'lsa body'dan tushiramiz → model default ovoz ishlatadi
  // (voice id noto'g'ri bo'lsa ham audio chiqsin — xavfsizlik).
  const body: Record<string, unknown> = { model, input: text, response_format: "mp3" };
  if (voice) body.voice = voice;
  const res = await orPost("/audio/speech", body);
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const buf = Buffer.from(await res.arrayBuffer()); // RAW audio — JSON EMAS
  if (!buf.length) return { ok: false, error: "Bo'sh audio" };
  return { ok: true, data: buf };
}

// ── Embeddings — /embeddings (OpenAI-compatible) ────────────────────────────
export async function orEmbed(model: string, text: string): Promise<OrResult<number[]>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const res = await orPost("/embeddings", { model, input: text });
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const j = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vec = j?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) return { ok: false, error: "Javobda vektor topilmadi" };
  return { ok: true, data: vec };
}

// ── Video — async: POST /videos → poll GET /videos/:id ──────────────────────
export type OrVideoFrame = {
  url: string;
  frameType?: "first_frame" | "last_frame";
};
export type OrVideoOpts = {
  prompt: string;
  resolution?: string; // "1080p"
  aspectRatio?: string; // "16:9"
  duration?: number; // soniya (model qo'llaydigan qiymat)
  generateAudio?: boolean; // native audio (model qo'llasa)
  frameImages?: OrVideoFrame[]; // image-to-video (first/last frame)
  references?: string[]; // reference-to-video (uslub)
};

export async function orVideoCreate(
  model: string,
  opts: OrVideoOpts
): Promise<OrResult<{ id: string; status: string }>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const body: Record<string, unknown> = { model, prompt: opts.prompt };
  if (opts.resolution) body.resolution = opts.resolution;
  if (opts.aspectRatio) body.aspect_ratio = opts.aspectRatio;
  if (typeof opts.duration === "number") body.duration = opts.duration;
  if (typeof opts.generateAudio === "boolean") body.generate_audio = opts.generateAudio;
  if (opts.frameImages?.length) {
    body.frame_images = opts.frameImages.map((f) => ({
      type: "image_url",
      image_url: { url: f.url },
      ...(f.frameType ? { frame_type: f.frameType } : {}),
    }));
  }
  if (opts.references?.length) {
    body.input_references = opts.references.map((url) => ({
      type: "image_url",
      image_url: { url },
    }));
  }
  const res = await orPost("/videos", body);
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const j = (await res.json()) as { id?: string; status?: string };
  if (!j?.id) return { ok: false, error: "Video job ID qaytmadi" };
  return { ok: true, data: { id: j.id, status: j.status || "pending" } };
}

export async function orVideoStatus(
  id: string
): Promise<OrResult<{ status: string; urls: string[] }>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const res = await fetch(`${BASE}/videos/${encodeURIComponent(id)}`, {
    headers: orHeaders(),
  });
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const j = (await res.json()) as { status?: string; unsigned_urls?: string[] };
  return { ok: true, data: { status: j?.status || "pending", urls: j?.unsigned_urls || [] } };
}

/** OpenRouter video content URL'idan baytlarni yuklab oladi (Bearer auth bilan). */
export async function orDownload(url: string): Promise<OrResult<Buffer>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { ok: false, error: "Bo'sh video" };
  return { ok: true, data: buf };
}
