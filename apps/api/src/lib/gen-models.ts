/**
 * Studio Gen model katalogi (Artlist uslubi — raqamli ID). `key` = OpenRouter model ID;
 * `feature` 1c processor'da to'g'ri OpenRouter funksiyasini tanlash uchun:
 *   text-to-image | image-edit | text-to-speech | text-to-video | image-to-video.
 *
 * KREDIT XAVFSIZLIGI: bu ro'yxatdagi HAR key OpenRouter /api/v1/models/<key>/endpoints
 * bilan JONLI tasdiqlangan (2026-06-18). Jonli bo'lmagan model bu yerga qo'shilmaydi.
 * Vaqtincha o'chirish kerak bo'lsa — `enabled:false` (generatsiya 400, kredit yechilmaydi).
 *
 * OpenRouter model tekshiruvi: /api/v1/models ro'yxati TO'LIQ EMAS (rasm-gen/TTS/embedding
 * ko'rsatmaydi). Avtoritativ tekshiruv — per-model /api/v1/models/<key>/endpoints (status=0).
 * Barcha ID'lar 2026-06-18'da tasdiqlangan.
 *
 * Video capabilities (durations/resolutions/aspects) OpenRouter /api/v1/videos/models
 * avtoritativ ro'yxatidan olingan — processor shularga qarab param'ni klamplaydi (ortiqcha
 * yoki qo'llab-quvvatlanmaydigan qiymat yuborilmaydi).
 *
 * NARX: video `cost` = SONIYA boshiga kredit → umumiy narx = cost × duration (computeGenCost).
 * Boshqa rejimlarda `cost` = generatsiya boshiga sobit kredit.
 */
import { genProvider } from "./ai/magnific.js";

export type GenFeature =
  | "text-to-image"
  | "image-edit"
  | "text-to-speech"
  | "text-to-video"
  | "image-to-video"
  | "text-to-sfx";

/**
 * Model reference rasmni QANDAY ishlatadi (gen-processor router + UI affordance):
 *   none       — reference qabul qilmaydi (text→audio/embedding, yoki faqat text2img).
 *   image-edit — instruct edit: reference + ko'rsatma ("qishki faslga almashtir") → orImageEdit.
 *   image-ref  — style/subject reference (alohida format bo'lsa; hozircha image-edit bilan bir xil yo'l).
 *   video-ref  — video model boshlang'ich kadr/reference rasm (input_references).
 * Qiymat /api/v1/models/<key>/endpoints input_modalities bilan tasdiqlangan (2026-06-18):
 * barcha rasm modellari image kiritadi → image-edit; barcha video → video-ref; kokoro/SFX → none.
 */
export type ReferenceMode = "none" | "image-edit" | "image-ref" | "video-ref";

export type GenModel = {
  id: number;
  mode: "image" | "voice" | "video" | "music" | "sfx";
  key: string; // OpenRouter model ID (yoki provider-ichki kalit)
  label: string;
  provider?: "openrouter" | "freepik" | "elevenlabs" | "magnific";
  magnificModel?: string; // GEN_PROVIDER=magnific da Mystic model (realism/super_real/fluid...)
  feature: GenFeature;
  cost: number; // image/voice: sobit; video: soniya boshiga kredit
  referenceMode?: ReferenceMode; // reference rasm qo'llashi (default mode'dan kelib chiqadi)
  endFrame?: boolean; // video: last_frame (End kadr) qo'llaydimi — /videos/models supported_frame_images bilan tasdiqlangan (2026-06-18)
  isDefault?: boolean;
  enabled?: boolean; // false → generatsiya bloklanadi (kredit yechilmaydi)

  // ── Composer kontrollar (UI keyin shulardan dinamik render qiladi) ──
  inputs?: ("image-ref" | "start-end-frame" | "video-ref" | "audio-file" | "mention")[];
  aspects?: string[]; // ["16:9","9:16","1:1"]
  resolutions?: string[]; // video: ["720p","1080p"] | image (quality): ["1K","2K","4K"]
  durations?: number[]; // video soniya: [4,6,8]
  count?: number[]; // image: [1,2,3,4]
  audio?: boolean; // video native audio qo'llaydimi (generate_audio)
  imgModalities?: string[]; // rasm: chat/completions modalities (Flux=["image"], Gemini=["image","text"])

  // voice modeli uchun:
  voices?: { id: string; label: string }[];
  languages?: string[];
  effects?: string[];
};

const IMG_QUALITY = ["1K", "2K", "4K"]; // OpenRouter image_config.image_size qiymatlari
const IMG_ASPECTS = ["1:1", "2:3", "3:2", "3:4", "16:9", "4:3", "4:5", "5:4", "9:16", "21:9"];
const KOKORO_VOICES = [
  { id: "af_bella", label: "Bella" },
  { id: "af_nova", label: "Nova" },
  { id: "af_sarah", label: "Sarah" },
  { id: "am_adam", label: "Adam" },
  { id: "am_onyx", label: "Onyx" },
  { id: "bf_emma", label: "Emma" },
];

export const GEN_MODELS: GenModel[] = [
  // ── RASM (text-to-image) — chat/completions + modalities ──
  {
    id: 1001,
    mode: "image",
    key: "google/gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
    feature: "text-to-image",
    cost: 5,
    magnificModel: "realism",
    referenceMode: "image-edit", // Gemini — instruct edit (image input tasdiqlangan)
    isDefault: true,
    inputs: ["image-ref"],
    aspects: IMG_ASPECTS,
    resolutions: IMG_QUALITY,
    count: [1, 2, 3, 4],
    imgModalities: ["image", "text"],
  },
  {
    id: 1002,
    mode: "image",
    key: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    feature: "text-to-image",
    cost: 8,
    magnificModel: "super_real",
    referenceMode: "image-edit", // Gemini Pro — instruct edit
    inputs: ["image-ref"],
    aspects: IMG_ASPECTS,
    resolutions: IMG_QUALITY,
    count: [1, 2, 3, 4],
    imgModalities: ["image", "text"],
  },
  {
    id: 1003,
    mode: "image",
    key: "bytedance-seed/seedream-4.5",
    label: "Seedream 4.5",
    feature: "text-to-image",
    cost: 7,
    magnificModel: "fluid",
    referenceMode: "image-edit", // Seedream — image input + edit qo'llaydi
    inputs: ["image-ref"],
    aspects: IMG_ASPECTS,
    resolutions: IMG_QUALITY,
    count: [1, 2, 3, 4],
    imgModalities: ["image"], // chiqishi faqat image (OpenRouter endpoints)
  },
  {
    id: 1004,
    mode: "image",
    key: "black-forest-labs/flux.2-pro",
    label: "Flux 2.0 Pro",
    feature: "text-to-image",
    cost: 8,
    referenceMode: "image-edit", // Flux.2 pro — image input (ref/edit) qo'llaydi
    aspects: IMG_ASPECTS,
    resolutions: IMG_QUALITY,
    count: [1, 2, 3, 4],
    imgModalities: ["image"], // Flux uchun "text" shart emas
  },
  {
    id: 1005,
    mode: "image",
    key: "x-ai/grok-imagine-image-quality",
    label: "Grok Imagine",
    feature: "text-to-image",
    cost: 6,
    referenceMode: "image-edit", // Grok image — image input (i2i) qo'llaydi
    aspects: IMG_ASPECTS,
    resolutions: ["1K", "2K"],
    count: [1, 2, 3, 4],
    imgModalities: ["image"], // chiqishi faqat image (OpenRouter endpoints)
  },
  // ── RASM EDIT (reference / "rangini o'zgartir") ──
  {
    id: 1101,
    mode: "image",
    key: "google/gemini-3.1-flash-image-preview",
    label: "Gemini Edit (reference)",
    feature: "image-edit",
    cost: 6,
    referenceMode: "image-edit",
    inputs: ["image-ref"],
    aspects: IMG_ASPECTS,
    imgModalities: ["image", "text"],
  },

  // ── OVOZ (TTS) ──
  {
    id: 2001,
    mode: "voice",
    key: "hexgrad/kokoro-82m",
    label: "Kokoro TTS",
    feature: "text-to-speech",
    cost: 3,
    referenceMode: "none", // text→speech (input_modalities=[text])
    isDefault: true,
    voices: KOKORO_VOICES,
    languages: ["English"],
  },

  // ── SFX (ElevenLabs sound-generation; sync, RAW mp3) ──
  {
    id: 4001,
    mode: "sfx",
    key: "elevenlabs/sound-effects",
    label: "ElevenLabs SFX",
    provider: "elevenlabs",
    feature: "text-to-sfx",
    cost: 4,
    referenceMode: "none", // text→audio
    isDefault: true,
    durations: [3, 5, 10],
  },

  // ── VIDEO (POST /videos → poll). cost = soniya boshiga kredit ──
  {
    id: 3001,
    mode: "video",
    key: "google/veo-3.1-lite",
    label: "Veo 3.1 Lite",
    feature: "text-to-video",
    cost: 10, // /s
    referenceMode: "video-ref", // boshlang'ich kadr/reference rasm — G3
    endFrame: true, // Veo: first_frame + last_frame (/videos/models 2026-06-18)
    isDefault: true,
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    durations: [4, 6, 8],
    audio: true,
    inputs: ["image-ref"],
  },
  {
    id: 3002,
    mode: "video",
    key: "google/veo-3.1-fast",
    label: "Veo 3.1 Fast",
    feature: "text-to-video",
    cost: 20,
    referenceMode: "video-ref",
    endFrame: true,
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p", "4K"],
    durations: [4, 6, 8],
    audio: true,
    inputs: ["image-ref"],
  },
  {
    id: 3003,
    mode: "video",
    key: "google/veo-3.1",
    label: "Veo 3.1",
    feature: "text-to-video",
    cost: 40,
    referenceMode: "video-ref",
    endFrame: true,
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p", "4K"],
    durations: [4, 6, 8],
    audio: true,
    inputs: ["image-ref"],
  },
  {
    id: 3004,
    mode: "video",
    key: "kwaivgi/kling-v3.0-std",
    label: "Kling v3.0",
    feature: "image-to-video",
    cost: 12,
    referenceMode: "video-ref",
    endFrame: true,
    aspects: ["16:9", "9:16", "1:1"],
    resolutions: ["720p"],
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    audio: true,
    inputs: ["start-end-frame"],
  },
  {
    id: 3005,
    mode: "video",
    key: "kwaivgi/kling-v3.0-pro",
    label: "Kling v3.0 Pro",
    feature: "image-to-video",
    cost: 18,
    referenceMode: "video-ref",
    endFrame: true,
    aspects: ["16:9", "9:16", "1:1"],
    resolutions: ["720p"],
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    audio: true,
    inputs: ["start-end-frame"],
  },
  {
    id: 3006,
    mode: "video",
    key: "bytedance/seedance-2.0",
    label: "Seedance 2.0",
    feature: "image-to-video",
    cost: 10,
    referenceMode: "video-ref",
    endFrame: true,
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"],
    resolutions: ["480p", "720p", "1080p"],
    durations: [4, 5, 6, 7, 8, 9, 10],
    audio: true,
    inputs: ["start-end-frame", "image-ref", "video-ref", "audio-file", "mention"],
  },
  {
    id: 3007,
    mode: "video",
    key: "alibaba/wan-2.6",
    label: "Wan 2.6",
    feature: "image-to-video",
    cost: 12,
    referenceMode: "video-ref",
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    durations: [5, 10],
    audio: true,
    inputs: ["start-end-frame"],
  },
];

// Semantik qidiruv uchun embedding modeli (katalogda emas — ichki ishlatiladi).
export const EMBED_MODEL = "qwen/qwen3-embedding-4b";

export function getModelsByMode(mode: string): GenModel[] {
  return GEN_MODELS.filter((m) => m.mode === mode && m.enabled !== false);
}

export function getModelById(id: number): GenModel | undefined {
  return GEN_MODELS.find((m) => m.id === id);
}

/** Model generatsiyaga ruxsat berilganmi (registrda bor + enabled). */
export function isModelEnabled(model: GenModel | undefined): model is GenModel {
  return Boolean(model && model.enabled !== false);
}

/** Reference rejimi — deklaratsiya bo'lmasa mode'dan default (eski modellar uchun ham xavfsiz). */
export function getReferenceMode(model: GenModel): ReferenceMode {
  if (model.referenceMode) return model.referenceMode;
  if (model.mode === "image") return "image-edit";
  if (model.mode === "video") return "video-ref";
  return "none";
}

/** Model reference rasm qabul qiladimi (none → qabul qilmaydi). */
export function modelAcceptsReference(model: GenModel): boolean {
  return getReferenceMode(model) !== "none";
}

/** Video model End kadr (last_frame) qo'llaydimi (/videos/models bilan tasdiqlangan). */
export function modelSupportsEndFrame(model: GenModel): boolean {
  return model.mode === "video" && model.endFrame === true;
}

/** Berilgan mode uchun reference qo'llaydigan birinchi enabled model (UI/xato tavsiyasi uchun). */
export function firstReferenceModel(mode: string): GenModel | undefined {
  return GEN_MODELS.find(
    (m) => m.mode === mode && m.enabled !== false && modelAcceptsReference(m)
  );
}

function pickStr(list: string[] | undefined, requested: unknown, prefer: string[]): string {
  const opts = list && list.length ? list : prefer;
  const req = typeof requested === "string" ? requested : "";
  if (req && opts.includes(req)) return req;
  for (const p of prefer) if (opts.includes(p)) return p;
  return opts[0];
}

function pickNum(list: number[] | undefined, requested: unknown, prefer: number[]): number {
  const opts = list && list.length ? list : prefer;
  const req = Number(requested);
  if (Number.isFinite(req) && opts.includes(req)) return req;
  for (const p of prefer) if (opts.includes(p)) return p;
  return opts[0];
}

export type ResolvedVideoParams = {
  duration: number;
  resolution: string;
  aspectRatio: string;
  generateAudio: boolean;
};

/**
 * So'rov param'larini modelning QO'LLAB-QUVVATLAGAN qiymatlariga klamplaydi (param gigiyenasi).
 * Qo'llab-quvvatlanmaydigan duration/resolution/aspect → eng yaqin yaroqliga tushadi (API xato
 * bermasin, kredit behuda ketmasin). cost-quote VA processor BIR XIL natija beradi.
 */
export function resolveVideoParams(
  model: GenModel,
  params: Record<string, unknown>
): ResolvedVideoParams {
  return {
    duration: pickNum(model.durations, params.duration, [5, 6, 4]),
    resolution: pickStr(model.resolutions, params.resolution, ["1080p", "720p"]),
    aspectRatio: pickStr(model.aspects, params.aspectRatio, ["16:9", "9:16"]),
    generateAudio:
      typeof params.audio === "boolean" ? params.audio : Boolean(model.audio),
  };
}

/** So'ralgan rasm sonini model qo'llaganiga klamplaydi (default 1). */
export function resolveImageCount(model: GenModel, params: Record<string, unknown>): number {
  // QB-3: Magnific MVP'da count=1 ga qotirilgan (Mystic 1 natija/task; count>1 = N parallel task →
  // qisman fail bo'lsa COGS zarari). cost-quote ham, /gen ham shu yo'l → narx izchil (1×cost).
  if (genProvider() === "magnific") return 1;
  const list = model.count && model.count.length ? model.count : [1];
  const req = Number(params.count);
  if (Number.isFinite(req) && list.includes(req)) return req;
  return list[0];
}

/** Generatsiya narxi. Video: cost(/s) × duration. Rasm: cost × count. Boshqa: sobit cost. */
export function computeGenCost(model: GenModel, params: Record<string, unknown>): number {
  if (model.mode === "video") {
    return model.cost * resolveVideoParams(model, params).duration;
  }
  if (model.mode === "image") {
    return model.cost * resolveImageCount(model, params);
  }
  return model.cost;
}
