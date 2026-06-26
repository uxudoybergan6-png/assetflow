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
  provider?: "openrouter" | "freepik" | "elevenlabs" | "magnific" | "fal";
  falModel?: string; // provider=fal: queue.fal.run/<slug> (masalan openai/gpt-image-2/edit)
  qualityCost?: Record<string, number>; // image: bir rasm narxi quality bo'yicha (low/medium/high/auto) — qualityCost ustun
  magnificModel?: string; // GEN_PROVIDER=magnific da Mystic model (realism/super_real/fluid...)
  magnificTool?: string; // dedicated Magnific tool endpoint slug (image-upscaler, image-relight, ...) — provider=magnific only
  magnificOnly?: boolean; // true → faqat GEN_PROVIDER=magnific'да ishlaydi (openrouter ekvivalenti yo'q)
  feature: GenFeature;
  cost: number; // image/voice: sobit; video: soniya boshiga kredit
  referenceMode?: ReferenceMode; // reference rasm qo'llashi (default mode'dan kelib chiqadi)
  refMode?: "none" | "optional" | "required"; // frontend model-aware: referens majburiymi
  maxRefs?: number; // referens chegarasi (schemada yo'q bo'lsa frontend 10 deb oladi)
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

  // ── MODEL-AWARE sozlama deskriptori (image): UI chiplar + fal input + cost SHUNDAN o'qiladi ──
  // Har model param NOMLARINI o'zi e'lon qiladi (gpt: image_size/quality; nano: aspect_ratio/resolution).
  // Bo'lmasa — eski flat fieldlar (aspects/resolutions/qualityCost/count) ishlatiladi (orqaga moslik).
  imgSettings?: {
    aspect: { param: "image_size" | "aspect_ratio"; options: string[]; map?: Record<string, string>; def?: string };
    // quality yo'q = tekis narx (model.cost × count); 2-chip UI'da yashiriladi.
    quality?: { label: string; param: "quality" | "resolution"; options: string[]; def: string; cost: Record<string, number> };
    num: number[];
  };
  noNumParam?: boolean; // true → falImage num_images YUBORILMAYDI (Flux, Seedream kabi)
  outputFormat?: string; // fal output_format override (default 'png'); 'jpeg' Flux uchun

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
  // GPT Image 2 Edit (fal.ai) — rasmni prompt bilan tahrirlash; narx quality bo'yicha (per-rasm).
  {
    id: 1102,
    mode: "image",
    key: "openai/gpt-image-2/edit",
    label: "GPT Image 2 Edit",
    provider: "fal",
    falModel: "openai/gpt-image-2/edit",
    feature: "image-edit",
    cost: 6, // fallback (medium); qualityCost ustun
    qualityCost: { low: 3, medium: 6, high: 12, auto: 12 },
    referenceMode: "image-edit",
    refMode: "required", // GPT Image 2 Edit — referens MAJBURIY (frontend shu metadata'dan o'qiydi)
    maxRefs: 10,
    inputs: ["image-ref"],
    aspects: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16"],
    resolutions: ["low", "medium", "high", "auto"], // quality opsiyalar
    count: [1, 2, 3, 4],
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "image_size",
        options: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16"],
        map: { Auto: "auto", "1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9" },
        def: "Auto",
      },
      quality: { label: "Sifat", param: "quality", options: ["low", "medium", "high", "auto"], def: "high", cost: { low: 3, medium: 6, high: 12, auto: 12 } },
      num: [1, 2, 3, 4],
    },
  },
  {
    id: 1103,
    mode: "image",
    key: "openai/gpt-image-2",
    label: "GPT Image 2",
    provider: "fal",
    falModel: "openai/gpt-image-2",
    feature: "text-to-image", // REFERENSSIZ (gpt-image-2/edit'dan farqi)
    cost: 12, // fallback (high); qualityCost ustun
    qualityCost: { low: 3, medium: 6, high: 12, auto: 12 },
    referenceMode: "none", // text-to-image — REFERENS YO'Q (getReferenceMode 'none' → guard/route to'g'ri)
    refMode: "none", // frontend: referens bo'limi (＋Referens/ogohlantirish/@dropdown) yashirin
    maxRefs: 0,
    aspects: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16"],
    resolutions: ["low", "medium", "high", "auto"],
    count: [1, 2, 3, 4],
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "image_size",
        options: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16"],
        map: { Auto: "auto", "1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9" },
        def: "Auto",
      },
      quality: { label: "Sifat", param: "quality", options: ["low", "medium", "high", "auto"], def: "high", cost: { low: 3, medium: 6, high: 12, auto: 12 } },
      num: [1, 2, 3, 4],
    },
  },
  {
    id: 1104,
    mode: "image",
    key: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2 Edit",
    provider: "fal",
    falModel: "fal-ai/nano-banana-2/edit",
    feature: "image-edit",
    cost: 8, // fallback (1K); imgSettings.quality.cost ustun
    qualityCost: { "0.5K": 6, "1K": 8, "2K": 12, "4K": 16 },
    referenceMode: "image-edit",
    refMode: "required", // referens MAJBURIY
    maxRefs: 10,
    inputs: ["image-ref"],
    aspects: ["Auto", "1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "5:4", "4:5", "21:9"],
    resolutions: ["0.5K", "1K", "2K", "4K"],
    count: [1, 2, 3, 4],
    imgModalities: ["image"],
    imgSettings: {
      // aspect_ratio: ratio string o'zini-o'zi (Auto→auto); map'да bo'lmagani identity
      aspect: {
        param: "aspect_ratio",
        options: ["Auto", "1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "5:4", "4:5", "21:9"],
        map: { Auto: "auto" },
        def: "Auto",
      },
      quality: { label: "Resolution", param: "resolution", options: ["0.5K", "1K", "2K", "4K"], def: "1K", cost: { "0.5K": 6, "1K": 8, "2K": 12, "4K": 16 } },
      num: [1, 2, 3, 4],
    },
  },

  {
    id: 1105,
    mode: "image",
    key: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    provider: "fal",
    falModel: "fal-ai/nano-banana-2",
    feature: "text-to-image",
    cost: 8, // fallback (1K); imgSettings.quality.cost ustun
    qualityCost: { "0.5K": 6, "1K": 8, "2K": 12, "4K": 16 },
    referenceMode: "none",
    refMode: "none", // referens SHART EMAS (text-to-image)
    maxRefs: 0,
    inputs: [],
    aspects: ["Auto", "1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "5:4", "4:5", "21:9"],
    resolutions: ["0.5K", "1K", "2K", "4K"],
    count: [1, 2, 3, 4],
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "aspect_ratio",
        options: ["Auto", "1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "5:4", "4:5", "21:9"],
        map: { Auto: "auto" },
        def: "Auto",
      },
      quality: { label: "Resolution", param: "resolution", options: ["0.5K", "1K", "2K", "4K"], def: "1K", cost: { "0.5K": 6, "1K": 8, "2K": 12, "4K": 16 } },
      num: [1, 2, 3, 4],
    },
  },

  {
    id: 1106,
    mode: "image",
    key: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream V4.5 Edit",
    provider: "fal",
    falModel: "fal-ai/bytedance/seedream/v4.5/edit",
    feature: "image-edit",
    cost: 4, // tekis narx/rasm (× count); quality chip yo'q
    referenceMode: "image-edit",
    refMode: "required",
    maxRefs: 10,
    inputs: ["image-ref"],
    aspects: ["Auto 2K", "Auto 4K", "1:1", "4:3", "3:4", "16:9", "9:16"],
    count: [1, 2, 3, 4, 5, 6],
    imgModalities: ["image"],
    imgSettings: {
      // image_size enum (fal): Auto 2K/4K → auto_2K/auto_4K; nisbatlar → fal enumlari.
      aspect: {
        param: "image_size",
        options: ["Auto 2K", "Auto 4K", "1:1", "4:3", "3:4", "16:9", "9:16"],
        map: {
          "Auto 2K": "auto_2K",
          "Auto 4K": "auto_4K",
          "1:1": "square_hd",
          "4:3": "landscape_4_3",
          "3:4": "portrait_4_3",
          "16:9": "landscape_16_9",
          "9:16": "portrait_16_9",
        },
        def: "Auto 2K",
      },
      // quality YO'Q — tekis narx (cost=4/rasm); 2-chip UI'da yashirin.
      num: [1, 2, 3, 4, 5, 6],
    },
  },

  {
    id: 1107,
    mode: "image",
    key: "fal-ai/flux-2-pro",
    label: "Flux 2 Pro",
    provider: "fal",
    falModel: "fal-ai/flux-2-pro",
    feature: "text-to-image",
    cost: 4,
    referenceMode: "none",
    refMode: "none",
    maxRefs: 0,
    inputs: [],
    count: [1, 2, 3, 4],
    noNumParam: true,
    outputFormat: "jpeg",
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "image_size",
        options: ["1:1", "4:3", "3:4", "16:9", "9:16", "Kvadrat"],
        map: { "1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9", Kvadrat: "square" },
        def: "4:3",
      },
      num: [1, 2, 3, 4],
    },
  },
  {
    id: 1108,
    mode: "image",
    key: "fal-ai/flux-2-pro/edit",
    label: "Flux 2 Pro Edit",
    provider: "fal",
    falModel: "fal-ai/flux-2-pro/edit",
    feature: "image-edit",
    cost: 4,
    referenceMode: "image-edit",
    refMode: "required",
    maxRefs: 4,
    inputs: ["image-ref"],
    count: [1, 2, 3, 4],
    noNumParam: true,
    outputFormat: "jpeg",
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "image_size",
        options: ["Auto", "1:1", "4:3", "3:4", "16:9", "9:16"],
        map: { Auto: "auto", "1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9" },
        def: "Auto",
      },
      num: [1, 2, 3, 4],
    },
  },

  // ── MAGNIFIC DEDICATED TOOLS (faqat GEN_PROVIDER=magnific; manba rasm yeydi, image-edit refMode) ──
  {
    id: 1201, mode: "image", key: "magnific/image-upscaler", label: "Magnific Upscaler",
    feature: "image-edit", cost: 12, magnificTool: "image-upscaler", magnificOnly: true,
    referenceMode: "image-edit", inputs: ["image-ref"], resolutions: IMG_QUALITY,
  },
  {
    id: 1202, mode: "image", key: "magnific/image-relight", label: "Magnific Relight",
    feature: "image-edit", cost: 8, magnificTool: "image-relight", magnificOnly: true,
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1203, mode: "image", key: "magnific/image-change-camera", label: "Magnific Change Camera",
    feature: "image-edit", cost: 8, magnificTool: "image-change-camera", magnificOnly: true,
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1204, mode: "image", key: "magnific/skin-enhancer", label: "Magnific Skin Enhancer",
    feature: "image-edit", cost: 5, magnificTool: "skin-enhancer/flexible", magnificOnly: true,
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1205, mode: "image", key: "magnific/image-expand", label: "Magnific Image Extender",
    feature: "image-edit", cost: 6, magnificTool: "image-expand/flux-pro", magnificOnly: true,
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1206, mode: "image", key: "magnific/remove-background", label: "Magnific Remove BG",
    feature: "image-edit", cost: 3, magnificTool: "beta/remove-background", magnificOnly: true,
    referenceMode: "image-edit", inputs: ["image-ref"],
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
  if (genProvider() === "magnific" && model.provider !== "fal") return 1;
  const list = model.count && model.count.length ? model.count : [1];
  const req = Number(params.count);
  if (Number.isFinite(req) && list.includes(req)) return req;
  return list[0];
}

/** Rasm bir dona narxi — qualityCost bor bo'lsa quality bo'yicha, aks holda sobit cost. */
export function imageUnitCost(model: GenModel, params: Record<string, unknown>): number {
  // MODEL-AWARE: narx model deskriptoridagi quality.cost'dan (gpt: quality, nano: resolution).
  // imgSettings bo'lmasa — eski flat qualityCost (orqaga moslik). params.quality = tanlangan option (normalizatsiyalangan nom).
  const s = model.imgSettings?.quality;
  const cost = (s && s.cost) || model.qualityCost;
  if (cost) {
    const q = typeof params.quality === "string" ? params.quality : "";
    const allowed =
      s && s.options && s.options.length
        ? s.options
        : model.resolutions && model.resolutions.length
          ? model.resolutions
          : Object.keys(cost);
    const fallback =
      s && s.def && cost[s.def] != null ? s.def : allowed.includes("medium") ? "medium" : allowed[0];
    const key = allowed.includes(q) && cost[q] != null ? q : fallback;
    const c = cost[key];
    if (Number.isFinite(c)) return c;
  }
  return model.cost;
}

/** Generatsiya narxi. Video: cost(/s) × duration. Rasm: bir-dona(quality) × count. Boshqa: sobit cost. */
export function computeGenCost(model: GenModel, params: Record<string, unknown>): number {
  if (model.mode === "video") {
    return model.cost * resolveVideoParams(model, params).duration;
  }
  if (model.mode === "image") {
    return imageUnitCost(model, params) * resolveImageCount(model, params);
  }
  return model.cost;
}
