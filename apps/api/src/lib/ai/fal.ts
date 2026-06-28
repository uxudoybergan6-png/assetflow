// fal.ai adapter — queue submit/poll + R2-friendly output. Manba: docs/FAL-DOCS-CORE.md.
// Auth: header `Authorization: Key $FAL_KEY` (Bearer EMAS). Kalit env'dan, hech qachon log/clientga.
// Kontrakt: gen-processor `OrResult<Buffer>` kutadi (magnific.ts naqshi). Timeout = FAL_TIMEOUT sentinel
// (gen-processor refund qilmaydi — reconcile hal qiladi).
import type { OrResult } from "./openrouter.js";

const QUEUE_BASE = "https://queue.fal.run";
const KEY = process.env.FAL_KEY ?? ""; // bir marta, modul darajasida
const OPENROUTER_TEXT_MODEL = "google/gemini-2.5-flash";
const OPENROUTER_VISION_MODEL = "google/gemini-2.5-flash";
// Video analyze uchun "eng kuchli + preview emas" variantni olamiz — production barqarorroq.
const OPENROUTER_VIDEO_MODEL = "google/gemini-2.5-pro";

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

// Poll RAMP: dastlabki tekshiruvlar TEZ (tez rasm/LLM jobs ~5-12s'da tugaydi → kichik granularlik =
// natija tezroq topiladi), keyin uzunroq (status API'ni ortiqcha urmaslik). COMPLETED/timeout mantig'i
// o'zgarmaydi — faqat kutish oralig'i. Window ≈ 200s (oldingi ~150s'dan keng; video-ref edit ham sig'adi).
const MAX_POLLS = 110;
function pollDelayMs(i: number): number {
  return i < 6 ? 600 : i < 20 ? 1200 : 2000; // 6×600 + 14×1200 + 90×2000 ≈ 200s
}

type FalSubmitResp = { request_id?: string; status_url?: string; response_url?: string };
type FalStatus = { status?: string; error?: string };

/**
 * Queue submit + status_url'ni COMPLETED gacha poll + response_url → output obyekt.
 * Timeout (job hali IN_PROGRESS) → FAL_TIMEOUT sentinel (refund YO'Q — magnific naqshi).
 * opts.maxPolls — video uchun MAX_POLLS=150 (~280s) ishlatiladi.
 */
async function falSubmit(
  modelId: string,
  input: Record<string, unknown>,
  opts?: { maxPolls?: number }
): Promise<OrResult<unknown>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const maxPolls = opts?.maxPolls ?? MAX_POLLS;
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

  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollDelayMs(i));
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

/**
 * Seedance 2.0 Fast image-to-video. imageUrl = start kadr (R2 public URL). endImageUrl ixtiyoriy.
 * maxPolls=150 (~280s) — video generatsiya uzoqroq davom etadi.
 */
export async function falVideo(
  modelKey: string,
  prompt: string,
  imageUrl: string,
  opts?: {
    endImageUrl?: string;
    resolution?: string;
    duration?: string | number;
    aspectRatio?: string;
    generateAudio?: boolean;
  }
): Promise<OrResult<Buffer>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const dur = opts?.duration;
  const durVal =
    dur == null || String(dur).toLowerCase() === "auto" ? "auto" : String(dur);
  const arRaw = opts?.aspectRatio ?? "auto";
  const arVal = arRaw.toLowerCase() === "auto" ? "auto" : arRaw;
  const input: Record<string, unknown> = {
    prompt: String(prompt),
    image_url: imageUrl,
    resolution: opts?.resolution ?? "720p",
    duration: durVal,
    aspect_ratio: arVal,
    generate_audio: opts?.generateAudio ?? true,
  };
  if (opts?.endImageUrl) input.end_image_url = opts.endImageUrl;
  try {
    console.log(
      `[fal] video i2v → ${modelKey} res=${input.resolution} dur=${input.duration} ar=${input.aspect_ratio} audio=${input.generate_audio}`
    );
  } catch {
    /* ignore */
  }
  const r = await falSubmit(modelKey, input, { maxPolls: 150 });
  if (!r.ok) return r;
  const data = r.data as { video?: { url?: string } };
  const url = data?.video?.url;
  if (!url) return { ok: false, error: "fal: video URL topilmadi" };
  return falDownload(url);
}

/**
 * Seedance 2.0 reference-to-video — ko'p-modal referens. image_urls(≤9)/video_urls(≤3)/audio_urls(≤3)
 * R2 PUBLIC URL'lar (caller materializatsiya qiladi); bo'sh ro'yxat yuborilmaydi. @Image/@Video/@Audio
 * prompt'da o'zicha qoladi (model tushunadi). Poll uzun (maxPolls=250 ≈ 480s — R2V uzoq davom etadi).
 */
export async function falRefVideo(
  modelKey: string,
  prompt: string,
  opts: {
    imageUrls?: string[];
    videoUrls?: string[];
    audioUrls?: string[];
    resolution?: string;
    duration?: string | number;
    aspectRatio?: string;
    generateAudio?: boolean;
    bitrateMode?: string;
    endUserId?: string;
  }
): Promise<OrResult<Buffer>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const dur = opts.duration;
  const durVal = dur == null || String(dur).toLowerCase() === "auto" ? "auto" : String(dur);
  const arRaw = opts.aspectRatio ?? "auto";
  const arVal = arRaw.toLowerCase() === "auto" ? "auto" : arRaw;
  const clean = (a?: string[]) =>
    (a || []).filter((u): u is string => typeof u === "string" && u.length > 0);
  const imgs = clean(opts.imageUrls);
  const vids = clean(opts.videoUrls);
  const auds = clean(opts.audioUrls);
  const input: Record<string, unknown> = {
    prompt: String(prompt),
    resolution: opts.resolution ?? "720p",
    duration: durVal,
    aspect_ratio: arVal,
    generate_audio: opts.generateAudio ?? true,
  };
  if (typeof opts.bitrateMode === "string" && opts.bitrateMode) input.bitrate_mode = opts.bitrateMode;
  if (typeof opts.endUserId === "string" && opts.endUserId) input.end_user_id = opts.endUserId;
  if (imgs.length) input.image_urls = imgs; // bo'sh ro'yxat YUBORILMAYDI
  if (vids.length) input.video_urls = vids;
  if (auds.length) input.audio_urls = auds;
  try {
    console.log(
      `[fal] ref2video → ${modelKey} imgs=${imgs.length} vids=${vids.length} auds=${auds.length} res=${input.resolution} dur=${input.duration} ar=${input.aspect_ratio} audio=${input.generate_audio}`
    );
  } catch {
    /* ignore */
  }
  const r = await falSubmit(modelKey, input, { maxPolls: 250 });
  if (!r.ok) return r;
  const data = r.data as { video?: { url?: string } };
  const url = data?.video?.url;
  if (!url) return { ok: false, error: "fal: video URL topilmadi" };
  return falDownload(url);
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

/** Model-aware image sozlama deskriptori (gen-models.imgSettings'дан keladi). */
export type FalImageSettings = {
  aspect?: { param: string; map?: Record<string, string>; def?: string };
  quality?: { param: string; options?: string[]; def?: string };
};

/**
 * GENERIC fal image gen (text-to-image VA image-edit), MODEL-AWARE. `modelKey` = endpoint (falModel).
 * Input param NOMLARI `opts.settings` deskriptoridan: gpt → image_size/quality; nano → aspect_ratio/resolution.
 *  - imageUrls BO'SH → t2i (image_urls yuborilmaydi). bor → edit + @imgN→"image N".
 * imageUrls PUBLIC bo'lishi shart (caller R2'ga materializatsiya qiladi). Bitta chaqiruv = bitta rasm.
 * settings yo'q → eski xulq (image_size enum AR_TO_SIZE + quality enum). Submit/poll/R2/timeout o'zgarmaydi.
 */
export async function falImage(
  modelKey: string,
  prompt: string,
  opts?: { imageUrls?: string[]; aspect?: string | null; quality?: string | null; settings?: FalImageSettings; noNumParam?: boolean; outputFormat?: string }
): Promise<OrResult<Buffer>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const imageUrls = (opts?.imageUrls || []).filter(
    (u): u is string => typeof u === "string" && u.length > 0
  );
  const aspectLabel = opts?.aspect || "";
  const qRaw = (opts?.quality || "").toString();
  const s = opts?.settings;
  // aspect: deskriptor param + map (yo'q → eski image_size enum)
  const aspectParam = (s && s.aspect && s.aspect.param) || "image_size";
  const aspectVal =
    s && s.aspect
      ? (s.aspect.map && s.aspect.map[aspectLabel]) || aspectLabel || s.aspect.def || "auto"
      : AR_TO_SIZE[aspectLabel] || "auto";
  // quality: deskriptor param + value. settings bor lekin quality yo'q → param YUBORILMAYDI (seedream naqshi).
  const hasQuality = !s || !!s.quality; // settings yo'q → eski xulq (param yuboriladi)
  const qualityParam = (s && s.quality && s.quality.param) || "quality";
  const qOpts = s && s.quality && s.quality.options;
  const qualityVal =
    qOpts && qOpts.length
      ? qOpts.indexOf(qRaw) >= 0
        ? qRaw
        : (s && s.quality && s.quality.def) || qOpts[0]
      : QUALITIES.includes(qRaw.toLowerCase())
        ? qRaw.toLowerCase()
        : "high";
  const outFmt = opts?.outputFormat || "png";
  const input: Record<string, unknown> = {
    // edit: @img<N> → "image N" (image_urls tartibiga mos). t2i: referenssiz → mapping shart emas.
    prompt: imageUrls.length
      ? String(prompt).replace(/@img(\d+)/gi, (_m, n) => `image ${n}`)
      : String(prompt),
    [aspectParam]: aspectVal,
    output_format: outFmt,
  };
  if (!opts?.noNumParam) input.num_images = 1; // Flux/Seedream kabi modellar num_images qabul qilmaydi
  if (hasQuality) input[qualityParam] = qualityVal; // quality yo'q model → param tushirilmaydi
  if (imageUrls.length) input.image_urls = imageUrls; // edit-only
  try {
    console.log(
      `[fal] image ${imageUrls.length ? "edit(" + imageUrls.length + " ref)" : "t2i"} → ${modelKey} ${aspectParam}=${aspectVal}${hasQuality ? " " + qualityParam + "=" + qualityVal : " (no-quality)"} fmt=${outFmt}${opts?.noNumParam ? " no-num" : ""}`
    );
  } catch {
    /* ignore */
  }
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
  opts?: {
    imageUrls?: string[];
    videoUrls?: string[];
    mode?: string;
    modelContext?: string;
  }
): Promise<OrResult<string>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const refs = (opts?.imageUrls || []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
  );
  const vids = (opts?.videoUrls || []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
  );
  const mode = String(opts?.mode || "image").toLowerCase() === "video" ? "video" : "image";
  const role =
    mode === "video"
      ? "Sen video generatsiyasi uchun prompt muhandisisan."
      : "Sen tasvir generatsiyasi uchun prompt muhandisisan.";
  const detailHint =
    mode === "video"
      ? "Qisqa g'oyani bitta boy, aniq video promptga aylantir (subyekt, kamera harakati, kompozitsiya, yorug'lik, atmosfera, detal)."
      : "Qisqa g'oyani bitta boy, tafsilotli promptga aylantir (kompozitsiya, yorug'lik, uslub, detal).";
  const tokenHint =
    " @img/@image/@video/@audio tokenlarini bo'lsa XUDDI O'ZICHA saqla, nomini o'zgartirma va olib tashlama.";
  const modelContext = opts?.modelContext ? ` ${opts.modelContext}` : "";

  let modelId: string;
  let input: Record<string, unknown>;
  if (vids.length > 0) {
    modelId = "openrouter/router/video";
    input = {
      video_urls: vids,
      prompt: text,
      model: OPENROUTER_VIDEO_MODEL,
      system_prompt:
        `${role} Referens videolar tartibда: ` +
        "1-video=@video1, 2-video=@video2, ... Foydalanuvchi ko'rsatmasi va videolardagi " +
        `harakat, kamera, ritm va sahna o'zgarishini tahlil qilib, BITTA boy, aniq ${mode} prompt yoz. ` +
        `KIRISH TILINI saqla.${tokenHint}${modelContext} Faqat yakuniy promptni qaytar, izohsiz.`,
      temperature: 0.6,
      max_tokens: 600,
    };
    console.log(`[fal] enhance VIDEO — ${vids.length} referens (openrouter/router/video)`);
  } else if (refs.length > 0) {
    // VISION — referens rasmlarni tahlil qilib prompt yozadi.
    modelId = "openrouter/router/vision";
    input = {
      image_urls: refs, // @img tartibida: image_urls[0] = @img1
      prompt: text,
      model: OPENROUTER_VISION_MODEL,
      system_prompt:
        `${role} Referens rasmlar tartibда: ` +
        "1-rasm=@img1, 2-rasm=@img2, ... Foydalanuvchi ko'rsatmasi va rasmlarni tahlil qilib, " +
        `BITTA boy, aniq ${mode} prompt yoz (rasmlardagini tushunib, @imgN ni to'g'ri ishlat). ` +
        `KIRISH TILINI saqla.${tokenHint}${modelContext} Faqat yakuniy promptni qaytar, izohsiz.`,
      temperature: 0.6,
      max_tokens: 500,
    };
    console.log(`[fal] enhance VISION — ${refs.length} referens (openrouter/router/vision)`);
  } else {
    // TEXT — referens yo'q (hozirgi yo'l).
    modelId = "openrouter/router";
    input = {
      prompt: text,
      model: OPENROUTER_TEXT_MODEL,
      system_prompt:
        `${role} ${detailHint} KIRISH TILINI saqla.${tokenHint}${modelContext} ` +
        "Faqat yakuniy promptni qaytar, izohsiz.",
      temperature: 0.7,
      max_tokens: 400,
    };
    console.log("[fal] enhance TEXT (openrouter/router)");
  }

  const r = await falSubmit(modelId, input);
  if (!r.ok) return r;
  // openrouter/router javob shakli rasman tasdiqlanmagan → bir nechta mumkin maydonni TOLERANT o'qiymiz
  // (output | text | response | message | content), yoki data o'zi string bo'lsa.
  const data = r.data as
    | { output?: unknown; text?: unknown; response?: unknown; message?: unknown; content?: unknown }
    | string;
  const pick = (...vals: unknown[]) => {
    for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
    return "";
  };
  const out =
    typeof data === "string"
      ? data.trim()
      : pick(data?.output, data?.text, data?.response, data?.message, data?.content);
  if (!out) return { ok: false, error: "fal: bo'sh javob" };
  return { ok: true, data: out };
}
