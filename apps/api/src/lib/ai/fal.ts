// fal.ai adapter — queue submit/poll + R2-friendly output. Manba: docs/FAL-DOCS-CORE.md.
// Auth: header `Authorization: Key $FAL_KEY` (Bearer EMAS). Kalit env'dan, hech qachon log/clientga.
// Kontrakt: gen-processor `OrResult<Buffer>` kutadi (magnific.ts naqshi). Timeout = FAL_TIMEOUT sentinel
// (gen-processor refund qilmaydi — reconcile hal qiladi).
import type { OrResult } from "./openrouter.js";

const QUEUE_BASE = "https://queue.fal.run";
const KEY = process.env.FAL_KEY ?? ""; // bir marta, modul darajasida
const OPENROUTER_TEXT_MODEL = "google/gemini-2.5-flash";
const OPENROUTER_VISION_MODEL = "google/gemini-2.5-flash";
const FAL_VIDEO_UNDERSTANDING_MODEL = "fal-ai/video-understanding";
const NEMOTRON_AUDIO_MODEL = "nvidia/nemotron-3-nano-omni/audio";

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
export type FalQueueJob = {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
};
export type FalPollStepResult =
  | { state: "pending" }
  | { state: "completed"; data: unknown };

/**
 * Queue submit + status_url'ni COMPLETED gacha poll + response_url → output obyekt.
 * Timeout (job hali IN_PROGRESS) → FAL_TIMEOUT sentinel (refund YO'Q — magnific naqshi).
 * opts.maxPolls — video uchun modelga qarab oshiriladi (uzoqroq jobs erta yiqilmasin).
 */
export async function falSubmitJob(
  modelId: string,
  input: Record<string, unknown>,
  opts?: { webhookUrl?: string }
): Promise<OrResult<FalQueueJob>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const url = new URL(`${QUEUE_BASE}/${modelId}`);
  if (opts?.webhookUrl) url.searchParams.set("fal_webhook", opts.webhookUrl);
  let sub: Response;
  try {
    sub = await fetch(url, {
      method: "POST",
      headers: falHeaders(),
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "fal: could not connect to submit" };
  }
  if (!sub.ok) return { ok: false, error: await errText(sub), status: sub.status };
  const sj = (await safeJson(sub)) as FalSubmitResp | null;
  const statusUrl = sj?.status_url;
  const responseUrl = sj?.response_url;
  if (!statusUrl || !responseUrl || !sj?.request_id) {
    return { ok: false, error: "fal: status_url was not returned" };
  }
  return {
    ok: true,
    data: {
      requestId: sj.request_id,
      statusUrl,
      responseUrl,
    },
  };
}

export async function falPollJob(
  job: FalQueueJob,
  opts?: { maxPolls?: number }
): Promise<OrResult<unknown>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const maxPolls = opts?.maxPolls ?? MAX_POLLS;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollDelayMs(i));
    const step = await falPollStep(job);
    if (!step.ok) return step;
    if (step.data.state === "completed") return { ok: true, data: step.data.data };
  }
  return { ok: false, error: "FAL_TIMEOUT: job still running — no refund" };
}

export async function falPollStep(
  job: FalQueueJob
): Promise<OrResult<FalPollStepResult>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  let st: Response;
  try {
    st = await fetch(job.statusUrl, { headers: falHeaders() });
  } catch {
    return { ok: true, data: { state: "pending" } }; // transient tarmoq tebranishi
  }
  if (!st.ok) {
    if (st.status === 429 || st.status >= 500) {
      return { ok: true, data: { state: "pending" } }; // vaqtinchalik holat
    }
    return { ok: false, error: await errText(st), status: st.status };
  }
  const sd = (await safeJson(st)) as FalStatus | null;
  const status = sd?.status;
  if (typeof sd?.error === "string" && sd.error.trim()) {
    return { ok: false, error: sd.error.trim() };
  }
  if (status !== "COMPLETED") return { ok: true, data: { state: "pending" } };
  let rr: Response;
  try {
    rr = await fetch(job.responseUrl, { headers: falHeaders() });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "fal: could not connect for the result" };
  }
  if (!rr.ok) return { ok: false, error: await errText(rr), status: rr.status };
  const out = await safeJson(rr);
  if (out == null) return { ok: false, error: "fal: empty result" };
  return { ok: true, data: { state: "completed", data: out } };
}

async function falSubmit(
  modelId: string,
  input: Record<string, unknown>,
  opts?: { maxPolls?: number; onJob?: (job: FalQueueJob) => void | Promise<void> }
): Promise<OrResult<unknown>> {
  const sub = await falSubmitJob(modelId, input);
  if (!sub.ok) return sub;
  // P19.1 — queue jobi (requestId/statusUrl/responseUrl) chaqiruvchiga beriladi: DB'ga saqlab,
  // jarayon o'lsa reconcile provayderdan so'raydi / natijani responseUrl'dan qayta oladi (resume).
  if (opts?.onJob) {
    try {
      await opts.onJob(sub.data);
    } catch {
      /* best-effort — saqlash muvaffaqiyatsiz bo'lsa gen buzilmaydi, faqat resume yo'qoladi */
    }
  }
  return falPollJob(sub.data, opts);
}

const SYNC_BASE = "https://fal.run"; // SYNC — natijani to'g'ridan-to'g'ri qaytaradi (queue submit+poll YO'Q)
/** fal SYNC chaqiruv — tez modellar (LLM/vision/understanding) uchun: navbat ortig'isiz darrov javob. */
async function falRun(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs = 90000
): Promise<OrResult<unknown>> {
  if (!isFalConfigured()) return NOT_CONFIGURED;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${SYNC_BASE}/${modelId}`, {
      method: "POST",
      headers: falHeaders(),
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "fal: sync connection failed" };
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const out = await safeJson(res);
  if (out == null) return { ok: false, error: "fal: empty result" };
  return { ok: true, data: out };
}
/** Avval SYNC (tez); muvaffaqiyatsiz bo'lsa QUEUE'ga qaytadi — har holda 100% fal'da. */
async function falRunOrQueue(
  modelId: string,
  input: Record<string, unknown>
): Promise<OrResult<unknown>> {
  const r = await falRun(modelId, input);
  if (r.ok) return r;
  return falSubmit(modelId, input);
}

/**
 * fal video natija URL'ini Buffer'ga yuklaydi. gen-processor model-aware extractFalVideoUrl bilan
 * javobdan URL'ni topib shu yerga beradi. Eski qo'lda-yozilgan falVideo/falRefVideo dublikatlari
 * OLIB TASHLANDI (B9) — endi generic buildFalVideoInput + processor oqimi ishlatiladi.
 */
export async function falVideoUrlToBuffer(url: string): Promise<OrResult<Buffer>> {
  if (!url) return { ok: false, error: "fal: video URL not found" };
  return falDownload(url);
}

// fal CDN natija URL'ini Buffer'ga yuklaydi (caller R2'ga persist qiladi).
async function falDownload(url: string): Promise<OrResult<Buffer>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `fal download HTTP ${res.status}`, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? { ok: true, data: buf } : { ok: false, error: "fal: empty result" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "fal download error" };
  }
}

export async function falVideoResultToBuffer(data: unknown): Promise<OrResult<Buffer>> {
  const box = data as { video?: { url?: string } | string; url?: string };
  const url =
    typeof box?.video === "string"
      ? box.video
      : box?.video?.url || box?.url;
  if (!url) return { ok: false, error: "fal: video URL not found" };
  return falDownload(url);
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
  opts?: { imageUrls?: string[]; aspect?: string | null; quality?: string | null; settings?: FalImageSettings; noNumParam?: boolean; outputFormat?: string; onJob?: (job: FalQueueJob) => void | Promise<void> }
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
  const r = await falSubmit(modelKey, input, { onJob: opts?.onJob });
  if (!r.ok) return r;
  return falImageResultToBuffer(r.data);
}

/**
 * P19.1 — fal RASM natijasidan (queue response yoki poll data) rasm URL'ini topib Buffer'ga
 * yuklaydi. Resume yo'lida (`gen-processor` saqlangan job'ni qayta poll qilgach) ishlatiladi:
 * provayder allaqachon to'langan → responseUrl'dagi natijani QAYTA olib saqlaymiz (qayta to'lov YO'Q).
 */
export async function falImageResultToBuffer(data: unknown): Promise<OrResult<Buffer>> {
  const box = data as { images?: { url?: string }[]; image?: { url?: string } };
  const url = box?.images?.[0]?.url || box?.image?.url;
  if (!url) return { ok: false, error: "fal: result image not found" };
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
    audioUrls?: string[];
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
  const auds = (opts?.audioUrls || []).filter(
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
  // P30 §1 (Director ruling) — FILTER-EVASION euphemism ro'yxati OLIB TASHLANDI (dormant fal enhance
  // ham). Faqat faithfulness: foydalanuvchi AYTMAGAN ochiqlik/sexual/keskinlikni QO'SHMA (evasion emas).
  const safetyHint =
    " Faithfulness: foydalanuvchi so'ramagan yalang'ochlik, sexual/erotik iboralar yoki tana-ochilishi tafsilotini QO'SHMA; ortiqcha rekvizit, harakat yoki keskinlik bilan bezama. Neytral, tavsifiy til ishlat; kiyim, harakat, kamera va atmosfera sahnani olib borsin.";
  const modelContext = opts?.modelContext ? ` ${opts.modelContext}` : "";
  const pickText = (data: unknown): string => {
    if (typeof data === "string") return data.trim();
    if (!data || typeof data !== "object") return "";
    const box = data as {
      output?: unknown;
      text?: unknown;
      response?: unknown;
      message?: unknown;
      content?: unknown;
    };
    for (const v of [box.output, box.text, box.response, box.message, box.content]) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const notes: string[] = [];

  // TEZLIK: rasm + har video + har audio tahlili PARALLEL (ketma-ket emas) va SYNC fal (queue+poll'siz).
  const imgTask: Promise<OrResult<unknown>> | null = refs.length
    ? falRunOrQueue("openrouter/router/vision", {
        image_urls: refs,
        prompt: text,
        model: OPENROUTER_VISION_MODEL,
        system_prompt:
          `${role} Referens rasmlar tartibda: 1-rasm=@img1, 2-rasm=@img2, ... ` +
          `Foydalanuvchi matni bilan birga rasmlarni tahlil qil va faqat prompt uchun foydali kuzatuvlarni yoz. ` +
          "Subyekt, kompozitsiya, uslub, material, rang, yorug'lik, fon, kayfiyat va muhim vizual cheklovlarni qisqa paragrafda qaytar. " +
          `KIRISH TILINI saqla.${tokenHint}${safetyHint}${modelContext} Faqat tahlil yoz, final prompt yozma.`,
        temperature: 0.4,
        max_tokens: 350,
      })
    : null;
  const vidTasks = vids.map((v) =>
    falRunOrQueue(FAL_VIDEO_UNDERSTANDING_MODEL, {
      video_url: v,
      prompt:
        "Analyze this video reference for an AI generation prompt. Describe only the useful prompt cues: " +
        "subject, action, camera movement, framing, speed, pacing, transitions, environment, lighting, mood, texture, and notable motion details. " +
        "Return one concise paragraph in the same language as the user's request if possible.",
      detailed_analysis: true,
    })
  );
  const audTasks = auds.map((a) =>
    falRunOrQueue(NEMOTRON_AUDIO_MODEL, {
      prompt:
        "Analyze this audio reference for an AI generation prompt. " +
        "Describe only the useful prompt cues: mood, rhythm, pacing, intensity, instruments or sound design, ambience, and any spoken content. " +
        "Return one concise paragraph in the same language as the user's request if possible.",
      system_prompt:
        "You analyze an audio clip and return only concise prompt-useful observations. No markdown. No bullet list. No reasoning trace.",
      reasoning_mode: "no_think",
      max_tokens: 220,
      temperature: 0.3,
      top_p: 0.9,
      audio_url: a,
    })
  );
  const [imgRes, vidResults, audResults] = await Promise.all([
    imgTask ?? Promise.resolve(null),
    Promise.all(vidTasks),
    Promise.all(audTasks),
  ]);
  if (imgRes) {
    if (!imgRes.ok) return imgRes;
    const note = pickText(imgRes.data);
    if (!note) return { ok: false, error: "fal: image enhance returned an empty response" };
    notes.push(`Image reference analysis:\n${note}`);
  }
  if (vids.length) {
    const videoNotes: string[] = [];
    for (let i = 0; i < vidResults.length; i++) {
      const vr = vidResults[i];
      if (!vr.ok) return vr;
      const note = pickText(vr.data);
      if (!note) return { ok: false, error: "fal: video enhance returned an empty response" };
      videoNotes.push(`@video${i + 1}: ${note}`);
    }
    notes.push(`Video reference analysis:\n${videoNotes.join("\n")}`);
  }
  if (auds.length) {
    const audioNotes: string[] = [];
    for (let i = 0; i < audResults.length; i++) {
      const ar = audResults[i];
      if (!ar.ok) return ar;
      const note = pickText(ar.data);
      if (!note) return { ok: false, error: "fal: audio enhance returned an empty response" };
      audioNotes.push(`@audio${i + 1}: ${note}`);
    }
    notes.push(`Audio reference analysis:\n${audioNotes.join("\n")}`);
  }

  const promptText = notes.length ? `${text}\n\n${notes.join("\n\n")}` : text;
  console.log(
    `[fal] enhance UNIVERSAL — images=${refs.length} videos=${vids.length} audios=${auds.length}`
  );
  const r = await falRunOrQueue("openrouter/router", {
    prompt: promptText,
    model: OPENROUTER_TEXT_MODEL,
    system_prompt:
      `${role} ${detailHint} Foydalanuvchi matni va berilgan reference analysis bloklarini birlashtirib, ` +
      `bitta yakuniy, ishlatishga tayyor ${mode} prompt yoz. Agar analysis bloklarida ziddiyat bo'lsa, foydalanuvchi matnini ustun qo'y, ` +
      "qolganini esa mos ravishda uyg'unlashtir. Referenslar haqida alohida izoh yozma, faqat final prompt yoz. " +
      `KIRISH TILINI saqla.${tokenHint}${safetyHint}${modelContext} Faqat yakuniy promptni qaytar, izohsiz.`,
    temperature: 0.7,
    max_tokens: 600,
  });
  if (!r.ok) return r;
  const out = pickText(r.data);
  if (!out) return { ok: false, error: "fal: empty response" };
  return { ok: true, data: out };
}
