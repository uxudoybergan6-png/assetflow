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

// DIQQAT: yangi feature/provider qiymati qo'shsang gen-models-validate.ts'dagi
// FEATURES/PROVIDERS/featureByMode runtime ro'yxatlariga HAM qo'sh — aks holda
// server boot'da yiqiladi (validator startup gate; build ham endi shuni tekshiradi).
export type GenFeature =
  | "text-to-image"
  | "image-edit"
  | "image-upscale"
  | "text-to-speech"
  | "text-to-video"
  | "image-to-video"
  | "reference-to-video"
  | "video-upscale"
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
  provider?: "openrouter" | "freepik" | "elevenlabs" | "magnific" | "fal" | "vertex" | "vertex-omni" | "vertex-image" | "google-tts";
  falModel?: string; // provider=fal: queue.fal.run/<slug> (masalan openai/gpt-image-2/edit)
  qualityCost?: Record<string, number>; // image: bir rasm narxi quality bo'yicha (low/medium/high/auto) — qualityCost ustun
  magnificModel?: string; // GEN_PROVIDER=magnific da Mystic model (realism/super_real/fluid...)
  magnificTool?: string; // dedicated Magnific tool endpoint slug (image-upscaler, image-relight, ...) — provider=magnific only
  magnificOnly?: boolean; // true → faqat GEN_PROVIDER=magnific'да ishlaydi (openrouter ekvivalenti yo'q)
  feature: GenFeature;
  cost: number; // image/voice: sobit; video: soniya boshiga kredit
  referenceMode?: ReferenceMode; // reference rasm qo'llashi (default mode'dan kelib chiqadi)
  refMode?: "none" | "optional" | "required"; // frontend model-aware: referens majburiymi
  // So'nggi-grid "Referens" tugmasi model-aware turi (deklaratsiya bo'lmasa getRefKind derive qiladi):
  //  frames=Boshlang'ich/Yakuniy IMAGE kadr (i2v) · image=@imgN ref-strip · video/imagevideo=video/rasm ref
  //  media-refs=ko'p modal @Image/@Video/@Audio (reference-to-video) · none=referens yo'q
  refKind?: "frames" | "image" | "video" | "imagevideo" | "media-refs" | "none";
  maxRefs?: number; // referens chegarasi (schemada yo'q bo'lsa frontend 10 deb oladi)
  // Ko'p-modal referens limitlari (refKind 'media-refs'): image/video/audio alohida + jami.
  mediaRefs?: { image: number; video: number; audio: number; total: number };
  // Provider ichki media input limiti. Masalan, ayrim R2V modellar video referensni 50MB gacha qabul qiladi.
  mediaRefMaxBytes?: { image?: number; video?: number; audio?: number };
  // Ayrim modellar ayrim modality uchun jami hajm limiti qo'yadi (masalan, video referenslar jami 50MB).
  mediaRefMaxTotalBytes?: { image?: number; video?: number; audio?: number };
  // Fayl formatlari modelga qarab toraytirilishi mumkin (masalan, R2V video: MP4/MOV).
  mediaRefFormats?: { image?: string[]; video?: string[]; audio?: string[] };
  // Video referens bo'lsa ayrim model arzonroq tarif qo'llaydi (fal Seedance R2V docs: ×0.6).
  videoInputPerSecMultiplier?: number;
  brand?: string; // model egasi: "openai" | "google" | "bytedance" | "bfl"
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

  // ── MODEL-AWARE sozlama deskriptori (fal video): UI chiplar + fal input + cost SHUNDAN o'qiladi ──
  videoSettings?: {
    aspect: { options: string[]; def: string };
    resolution: { options: string[]; def: string; perSec: Record<string, number> }; // kredit/soniya
    duration: { options: string[]; def: string; autoSec: number }; // "Auto" + raqamlar (string[])
    audio: boolean;
    audioDefault?: boolean;
    // true → ovoz MODEL xususiyati (o'chirib bo'lmaydi) — UI toggle qulflanadi (Omni: API'da audio parametri YO'Q,
    // adapter ham yubormaydi; ilgari toggle yolg'on ishlagan — foydalanuvchi "audiosiz" tanlasa ham audio chiqardi).
    audioLocked?: boolean;
    // true → VIDEO referens biriktirilганда nisbat API tomonidan e'tiborga olinmaydi (Omni: video input
    // bilan response_format yuborilsa 400 — adapter tashlab yuboradi) — UI nisbat chipini qulflab tushuntiradi.
    aspectIgnoredWithVideoRef?: boolean;
    bitrate?: { options: string[]; def: string };
  };

  // ── MODEL-AWARE fal VIDEO input deskriptori (imgSettings'ning video ekvivalenti) ──
  // Har video model fal `input` KALITLARINI o'zi e'lon qiladi → buildFalVideoInput SHUNDAN quradi.
  // Bo'lmasa: Seedance default kalitlari ishlatiladi (orqaga moslik — eski xatti-harakat saqlanadi).
  videoInput?: {
    startFrameKey?: string; // i2v boshlang'ich kadr → fal kaliti (Seedance: image_url)
    endFrameKey?: string; // yakuniy kadr → fal kaliti (Seedance: end_image_url; model.endFrame bilan birga)
    imageRefsKey?: string; // ko'p-modal rasm massivi → fal kaliti (R2V: image_urls)
    videoRefsKey?: string; // ko'p-modal video massivi (R2V: video_urls)
    audioRefsKey?: string; // ko'p-modal audio massivi (R2V: audio_urls)
    imageRequired?: boolean; // i2v: boshlang'ich kadr majburiymi (Fast: true; t2v: false/undefined)
    resolutionKey?: string; // 'resolution' | undefined=yuborilmaydi
    durationKey?: string; // 'duration'
    durationFormat?: "string" | "number"; // Seedance string; ayrim modellar number
    aspectKey?: string; // 'aspect_ratio'
    audioKey?: string; // 'generate_audio' | undefined=yuborilmaydi (audiosiz model — B15)
    bitrateKey?: string; // 'bitrate_mode'
    injectUserIdKey?: string; // bu kalitga end-user id yoziladi (R2V: end_user_id)
    staticInput?: Record<string, unknown>; // doimiy qo'shimcha kalitlar
    outputPaths?: string[]; // natija URL yo'llari (default ['video.url','video','url'])
  };
  pricing?: "per-second" | "per-generation"; // video narx rejimi (default per-second)

  // voice modeli uchun:
  voices?: { id: string; label: string }[];
  languages?: string[];
  effects?: string[];
  // BATCH4 #4 — voice: per-belgi narxli provayder (Chirp $0.00003/belgi) uchun QAT'IY matn cap.
  // Flat kredit shu cap'dagi worst-case narxdan ≥2× marja bilan tanlanadi; route /gen prompt
  // uzunligini KREDIT YECHISHDAN OLDIN tekshiradi (money-zone formulaga tegilmaydi).
  maxChars?: number;
};

const IMG_QUALITY = ["1K", "2K", "4K"]; // OpenRouter image_config.image_size qiymatlari
const IMG_ASPECTS = ["1:1", "2:3", "3:2", "3:4", "16:9", "4:3", "4:5", "5:4", "9:16", "21:9"];
// Google Vertex rasm — model QO'LLAYDIGAN aniq nisbatlar (SDK/hujjat bilan tasdiqlangan 2026-07-01):
// Imagen 4/Ultra faqat 5 ta; Nano Banana (Gemini image ImageConfig) 8 ta (4:5, 5:4 YO'Q).
const IMAGEN_ASPECTS = ["1:1", "3:4", "4:3", "16:9", "9:16"];
const NANO_ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16", "21:9"];
const KOKORO_VOICES = [
  { id: "af_bella", label: "Bella" },
  { id: "af_nova", label: "Nova" },
  { id: "af_sarah", label: "Sarah" },
  { id: "am_adam", label: "Adam" },
  { id: "am_onyx", label: "Onyx" },
  { id: "bf_emma", label: "Emma" },
];
// BATCH4 #4 — Google Chirp 3 HD ovozlari (Cloud Text-to-Speech). Nomlash naqshi:
// <locale>-Chirp3-HD-<Persona>; adapter locale'ni nomdan o'zi oladi. 8 en-US persona
// (4 ayol + 4 erkak) + asosiy lokalizatsiyalar bittadan persona bilan.
const CHIRP3_VOICES = [
  { id: "en-US-Chirp3-HD-Aoede", label: "Aoede — EN·US (F)" },
  { id: "en-US-Chirp3-HD-Kore", label: "Kore — EN·US (F)" },
  { id: "en-US-Chirp3-HD-Leda", label: "Leda — EN·US (F)" },
  { id: "en-US-Chirp3-HD-Zephyr", label: "Zephyr — EN·US (F)" },
  { id: "en-US-Chirp3-HD-Puck", label: "Puck — EN·US (M)" },
  { id: "en-US-Chirp3-HD-Charon", label: "Charon — EN·US (M)" },
  { id: "en-US-Chirp3-HD-Fenrir", label: "Fenrir — EN·US (M)" },
  { id: "en-US-Chirp3-HD-Orus", label: "Orus — EN·US (M)" },
  { id: "en-GB-Chirp3-HD-Aoede", label: "Aoede — EN·GB (F)" },
  { id: "de-DE-Chirp3-HD-Aoede", label: "Aoede — Deutsch (F)" },
  { id: "es-ES-Chirp3-HD-Puck", label: "Puck — Español (M)" },
  { id: "fr-FR-Chirp3-HD-Aoede", label: "Aoede — Français (F)" },
  { id: "it-IT-Chirp3-HD-Kore", label: "Kore — Italiano (F)" },
  { id: "hi-IN-Chirp3-HD-Puck", label: "Puck — हिन्दी (M)" },
  { id: "ja-JP-Chirp3-HD-Aoede", label: "Aoede — 日本語 (F)" },
  { id: "ko-KR-Chirp3-HD-Kore", label: "Kore — 한국어 (F)" },
  { id: "pt-BR-Chirp3-HD-Aoede", label: "Aoede — Português·BR (F)" },
  { id: "ru-RU-Chirp3-HD-Charon", label: "Charon — Русский (M)" },
];

export const GEN_MODELS: GenModel[] = [
  // ── RASM — GOOGLE TO'G'RIDAN-TO'G'RI (Vertex Imagen/Nano Banana; fal/openrouter EMAS) ──
  // 2026-07-01 smoke-test o'tdi (Imagen 4 & Nano Banana 1024x1024). Foydalanuvchi qarori: "to'liq Google".
  {
    id: 1010,
    mode: "image",
    key: "gemini-3.1-flash-image", // Nano Banana 2 — Vertex to'g'ridan-to'g'ri (GLOBAL region; adapter locationFor)
    label: "Nano Banana 2",
    provider: "vertex-image",
    enabled: true, // 2026-07-01 jonli sinov: t2i+edit, nisbat(16:9→2752×1536), 1K/2K/4K(4096²), global region
    feature: "text-to-image",
    cost: 4, // fallback (1K); imgSettings.quality.cost / qualityCost ustun
    qualityCost: { "1K": 4, "2K": 8, "4K": 16 }, // sifat oshgan sari narx (4K=16MP, sekin ~51s)
    isDefault: true,
    referenceMode: "image-edit", // referens bo'lsa Gemini image edit (rasm tahrirlash/birlashtirish)
    inputs: ["image-ref"],
    maxRefs: 10, // Gemini bir necha rasmni birlashtiradi (@img1..@img10). maxRefs YO'Q bo'lsa plagin 0 deb bloklaydi!
    aspects: NANO_ASPECTS, // 8 nisbat (SDK ImageConfig; adapter imageConfig.aspectRatio yuboradi)
    resolutions: ["1K", "2K", "4K"], // fallback; imgSettings.quality "Sifat" selektorini ko'rsatadi
    count: [1, 2, 3, 4],
    // imgSettings — plagin "Sifat" selektorini FAQAT quality bo'lsa ko'rsatadi (hasQuality=!!ql). fal naqshi.
    imgSettings: {
      aspect: { param: "aspect_ratio", options: NANO_ASPECTS, def: "1:1" },
      quality: { label: "Quality", param: "quality", options: ["1K", "2K", "4K"], def: "1K", cost: { "1K": 4, "2K": 8, "4K": 16 } },
      num: [1, 2, 3, 4],
    },
    imgModalities: ["image", "text"],
  },
  {
    id: 1013,
    mode: "image",
    key: "gemini-3.1-flash-lite-image", // Nano Banana 2 Lite — GLOBAL (jonli sinov: tez, ~200KB, faqat 1K)
    label: "Nano Banana 2 Lite",
    provider: "vertex-image",
    enabled: true, // 2026-07-01 jonli sinov: t2i+edit, 8 nisbat, 1K (2K=400 xato → faqat 1K)
    feature: "text-to-image",
    cost: 2, // eng arzon (lite, tez ~5s, kichik rasm). Sifat selektori YO'Q (faqat 1K) → tekis narx
    referenceMode: "image-edit",
    inputs: ["image-ref"],
    maxRefs: 10,
    aspects: NANO_ASPECTS, // 8 nisbat (Gemini image)
    resolutions: ["1K"], // FAQAT 1K (2K=400 — jonli sinov 2026-07-01); deklaratsiyasiz plagin oldingi model qiymatini yuborardi
    count: [1, 2, 3, 4],
    imgModalities: ["image", "text"],
  },
  {
    id: 1014,
    mode: "image",
    key: "gemini-3-pro-image", // Nano Banana Pro — GLOBAL (jonli sinov: 6.7MB, 26s@2K, premium)
    label: "Nano Banana Pro",
    provider: "vertex-image",
    enabled: true, // 2026-07-01 jonli sinov: t2i+edit, 8 nisbat, 2K ishladi (4K e2e'da tasdiqlanadi)
    feature: "text-to-image",
    cost: 8, // fallback (1K); premium (eng yuqori sifat, sekin)
    qualityCost: { "1K": 8, "2K": 14, "4K": 24 }, // TAXMINIY — premium tier
    referenceMode: "image-edit",
    inputs: ["image-ref"],
    maxRefs: 10,
    aspects: NANO_ASPECTS,
    resolutions: ["1K", "2K", "4K"],
    count: [1, 2, 3, 4],
    imgSettings: {
      aspect: { param: "aspect_ratio", options: NANO_ASPECTS, def: "1:1" },
      quality: { label: "Quality", param: "quality", options: ["1K", "2K", "4K"], def: "1K", cost: { "1K": 8, "2K": 14, "4K": 24 } },
      num: [1, 2, 3, 4],
    },
    imgModalities: ["image", "text"],
  },
  {
    id: 1011,
    mode: "image",
    key: "imagen-4.0-generate-001", // Imagen 4 — foto-realistik (jonli sinov: 6.4MB@2K, us-central1)
    label: "Imagen 4",
    provider: "vertex-image",
    enabled: true, // 2026-07-01 jonli sinov: t2i, 5 nisbat, 1K/2K
    feature: "text-to-image",
    cost: 4, // fallback (1K); qualityCost ustun
    qualityCost: { "1K": 4, "2K": 6 },
    referenceMode: "none", // Imagen t2i ONLY (referens/edit YO'Q) → plagin referens UI'ni yashiradi
    aspects: IMAGEN_ASPECTS, // Imagen faqat 5 nisbat
    resolutions: ["1K", "2K"], // Imagen 4 max 2K
    count: [1, 2, 3, 4], // adapter har chaqiruvda numberOfImages:1 → processor count marta
    imgSettings: {
      aspect: { param: "aspect_ratio", options: IMAGEN_ASPECTS, def: "1:1" },
      quality: { label: "Quality", param: "quality", options: ["1K", "2K"], def: "1K", cost: { "1K": 4, "2K": 6 } },
      num: [1, 2, 3, 4],
    },
    imgModalities: ["image"],
  },
  {
    id: 1012,
    mode: "image",
    key: "imagen-4.0-ultra-generate-001", // Imagen 4 Ultra — premium (jonli sinov: 6.9MB@2K)
    label: "Imagen 4 Ultra",
    provider: "vertex-image",
    enabled: true, // 2026-07-01 jonli sinov: t2i, 5 nisbat, 1K/2K
    feature: "text-to-image",
    cost: 6, // fallback (1K); premium
    qualityCost: { "1K": 6, "2K": 10 },
    referenceMode: "none",
    aspects: IMAGEN_ASPECTS,
    resolutions: ["1K", "2K"],
    count: [1, 2, 3, 4],
    imgSettings: {
      aspect: { param: "aspect_ratio", options: IMAGEN_ASPECTS, def: "1:1" },
      quality: { label: "Quality", param: "quality", options: ["1K", "2K"], def: "1K", cost: { "1K": 6, "2K": 10 } },
      num: [1, 2, 3, 4],
    },
    imgModalities: ["image"],
  },
  // ── RASM UPSCALE (BATCH4 #1) — Vertex Imagen imagegeneration@002 mode:"upscale" (GA, allowlist'siz).
  // Narx: provider $0.003/rasm (USER-tasdiqlangan, 2026-07) — x2→2K=4kr, x4→4K=8kr (imgSettings.quality
  // orqali MAVJUD imageUnitCost yo'lidan o'qiladi; formula O'ZGARMAGAN). Prompt ishlatilmaydi (manba
  // rasm + faktor yetarli); referens MAJBURIY (manba rasm) — maxRefs 1.
  {
    id: 1015,
    mode: "image",
    key: "imagegeneration@002", // Imagen 1/2 upscale endpoint (us-central1)
    label: "Imagen Upscale",
    brand: "google",
    provider: "vertex-image",
    enabled: true,
    feature: "image-upscale",
    cost: 4, // fallback (x2); imgSettings.quality.cost ustun
    qualityCost: { x2: 4, x4: 8 },
    referenceMode: "image-ref", // manba rasm (edit emas — prompt o'qilmaydi)
    refMode: "required",
    refKind: "image",
    maxRefs: 1,
    inputs: ["image-ref"],
    aspects: ["Auto"], // nisbat manba rasmdan — UI chip yashirin (1 option)
    resolutions: ["x2", "x4"],
    count: [1],
    imgSettings: {
      aspect: { param: "aspect_ratio", options: ["Auto"], map: { Auto: "auto" }, def: "Auto" },
      quality: { label: "Factor", param: "quality", options: ["x2", "x4"], def: "x2", cost: { x2: 4, x4: 8 } },
      num: [1],
    },
  },

  // ── RASM (text-to-image) — ESKI fal/openrouter avlod: to'liq-Google qaroriga ko'ra HAMMASI enabled:false ──
  {
    id: 1001,
    enabled: false, // to'liq-Google (2026-07-01): fal/openrouter rasm o'chirildi
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
    enabled: false, // to'liq-Google (2026-07-01)
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
    enabled: false, // to'liq-Google (2026-07-01)
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
    enabled: false, // to'liq-Google (2026-07-01)
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
    enabled: false, // to'liq-Google (2026-07-01)
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
    enabled: false, // to'liq-Google (2026-07-01)
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
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "openai/gpt-image-2/edit",
    label: "GPT Image 2 Edit",
    brand: "openai",
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
      quality: { label: "Quality", param: "quality", options: ["low", "medium", "high", "auto"], def: "high", cost: { low: 3, medium: 6, high: 12, auto: 12 } },
      num: [1, 2, 3, 4],
    },
  },
  {
    id: 1103,
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "openai/gpt-image-2",
    label: "GPT Image 2",
    brand: "openai",
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
      quality: { label: "Quality", param: "quality", options: ["low", "medium", "high", "auto"], def: "high", cost: { low: 3, medium: 6, high: 12, auto: 12 } },
      num: [1, 2, 3, 4],
    },
  },
  {
    id: 1104,
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2 Edit",
    brand: "google",
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
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    brand: "google",
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
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream V4.5 Edit",
    brand: "bytedance",
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
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/flux-2-pro",
    label: "Flux 2 Pro",
    brand: "bfl",
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
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/flux-2-pro/edit",
    label: "Flux 2 Pro Edit",
    brand: "bfl",
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

  // Seedream V5 Lite t2i — referenssiz, image_size(auto_2K/3K/4K + nisbatlar), 1-6 soni, tekis narx 4kr.
  {
    id: 1109,
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    label: "Seedream V5 Lite",
    brand: "bytedance",
    provider: "fal",
    falModel: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    feature: "text-to-image",
    cost: 4,
    referenceMode: "none",
    refMode: "none",
    maxRefs: 0,
    inputs: [],
    count: [1, 2, 3, 4, 5, 6],
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "image_size",
        options: ["Auto 2K", "Auto 3K", "Auto 4K", "1:1", "4:3", "3:4", "16:9", "9:16"],
        map: {
          "Auto 2K": "auto_2K",
          "Auto 3K": "auto_3K",
          "Auto 4K": "auto_4K",
          "1:1": "square_hd",
          "4:3": "landscape_4_3",
          "3:4": "portrait_4_3",
          "16:9": "landscape_16_9",
          "9:16": "portrait_16_9",
        },
        def: "Auto 2K",
      },
      // quality YO'Q — tekis narx (cost=4/rasm × count); 2-chip UI'da yashirin.
      num: [1, 2, 3, 4, 5, 6],
    },
  },
  // Seedream V5 Lite edit — referens MAJBURIY (≤10), image_size, 1-6 soni, tekis narx 4kr.
  {
    id: 1110,
    enabled: false, // to'liq-Google (2026-07-01)
    mode: "image",
    key: "fal-ai/bytedance/seedream/v5/lite/edit",
    label: "Seedream V5 Lite Edit",
    brand: "bytedance",
    provider: "fal",
    falModel: "fal-ai/bytedance/seedream/v5/lite/edit",
    feature: "image-edit",
    cost: 4,
    referenceMode: "image-edit",
    refMode: "required",
    maxRefs: 10,
    inputs: ["image-ref"],
    count: [1, 2, 3, 4, 5, 6],
    imgModalities: ["image"],
    imgSettings: {
      aspect: {
        param: "image_size",
        options: ["Auto 2K", "Auto 3K", "Auto 4K", "1:1", "4:3", "3:4", "16:9", "9:16"],
        map: {
          "Auto 2K": "auto_2K",
          "Auto 3K": "auto_3K",
          "Auto 4K": "auto_4K",
          "1:1": "square_hd",
          "4:3": "landscape_4_3",
          "3:4": "portrait_4_3",
          "16:9": "landscape_16_9",
          "9:16": "portrait_16_9",
        },
        def: "Auto 2K",
      },
      // quality YO'Q — tekis narx (cost=4/rasm × count); 2-chip UI'da yashirin.
      num: [1, 2, 3, 4, 5, 6],
    },
  },

  // ── MAGNIFIC DEDICATED TOOLS (faqat GEN_PROVIDER=magnific; manba rasm yeydi, image-edit refMode) ──
  {
    id: 1201, mode: "image", key: "magnific/image-upscaler", label: "Magnific Upscaler",
    feature: "image-edit", cost: 12, magnificTool: "image-upscaler", magnificOnly: true, enabled: false, // B6: GEN_PROVIDER=magnific dormant — katalogdan yashirin + gen bloklangan (charge-then-fail oldini olish)
    referenceMode: "image-edit", inputs: ["image-ref"], resolutions: IMG_QUALITY,
  },
  {
    id: 1202, mode: "image", key: "magnific/image-relight", label: "Magnific Relight",
    feature: "image-edit", cost: 8, magnificTool: "image-relight", magnificOnly: true, enabled: false, // B6: GEN_PROVIDER=magnific dormant — katalogdan yashirin + gen bloklangan (charge-then-fail oldini olish)
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1203, mode: "image", key: "magnific/image-change-camera", label: "Magnific Change Camera",
    feature: "image-edit", cost: 8, magnificTool: "image-change-camera", magnificOnly: true, enabled: false, // B6: GEN_PROVIDER=magnific dormant — katalogdan yashirin + gen bloklangan (charge-then-fail oldini olish)
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1204, mode: "image", key: "magnific/skin-enhancer", label: "Magnific Skin Enhancer",
    feature: "image-edit", cost: 5, magnificTool: "skin-enhancer/flexible", magnificOnly: true, enabled: false, // B6: GEN_PROVIDER=magnific dormant — katalogdan yashirin + gen bloklangan (charge-then-fail oldini olish)
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1205, mode: "image", key: "magnific/image-expand", label: "Magnific Image Extender",
    feature: "image-edit", cost: 6, magnificTool: "image-expand/flux-pro", magnificOnly: true, enabled: false, // B6: GEN_PROVIDER=magnific dormant — katalogdan yashirin + gen bloklangan (charge-then-fail oldini olish)
    referenceMode: "image-edit", inputs: ["image-ref"],
  },
  {
    id: 1206, mode: "image", key: "magnific/remove-background", label: "Magnific Remove BG",
    feature: "image-edit", cost: 3, magnificTool: "beta/remove-background", magnificOnly: true, enabled: false, // B6: GEN_PROVIDER=magnific dormant — katalogdan yashirin + gen bloklangan (charge-then-fail oldini olish)
    referenceMode: "image-edit", inputs: ["image-ref"],
  },

  // ── OVOZ (TTS) ──
  // BATCH4 #4 — Chirp 3 HD (Google Cloud Text-to-Speech): Kokoro/OpenRouter o'rniga.
  // Narx: provider $0.00003/belgi → maxChars=1000 cap'da worst-case $0.03; flat 4 kredit
  // ($0.076) = cap'da ham ≥2.5× marja. Uzun matn: route /gen KREDITDAN OLDIN 400 qaytaradi.
  {
    id: 2002,
    mode: "voice",
    key: "chirp3-hd",
    label: "Chirp 3 HD",
    brand: "google",
    provider: "google-tts",
    enabled: true,
    feature: "text-to-speech",
    cost: 4,
    maxChars: 1000,
    referenceMode: "none",
    isDefault: true,
    voices: CHIRP3_VOICES,
    languages: ["English (US/GB)", "Deutsch", "Español", "Français", "Italiano", "हिन्दी", "日本語", "한국어", "Português (BR)", "Русский"],
  },
  {
    id: 2001,
    mode: "voice",
    key: "hexgrad/kokoro-82m",
    label: "Kokoro TTS",
    enabled: false, // BATCH4 #4 — OpenRouter o'chirildi (ovoz endi Chirp 3 HD / Google)
    feature: "text-to-speech",
    cost: 3,
    referenceMode: "none", // text→speech (input_modalities=[text])
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
    key: "veo-3.1-lite-generate-001", // Veo 3.1 Lite — foydalanuvchi havolasi bilan tasdiqlangan ID
    label: "Veo 3.1 Lite",
    provider: "vertex", // to'g'ridan-to'g'ri Vertex → VIDEO_PROJECT (2-$300)
    enabled: true, // 2026-07-01 yoqildi (video → 2-loyiha). Lite: arzon/tez tier.
    feature: "text-to-video",
    cost: 3, // /s — Lite eng arzon (Google ~$0.03-0.05/s)
    referenceMode: "video-ref", // ixtiyoriy boshlang'ich kadr (image-to-video)
    endFrame: true, // Veo last_frame qo'llaydi (SDK GenerateVideosConfig.lastFrame) — start+end kadr interpolatsiya
    isDefault: true,
    aspects: ["16:9", "9:16"],
    resolutions: ["720p"], // Lite — 720p
    durations: [4, 6, 8],
    audio: false, // MVP qaror (Google blog: 3 tier ham native audio — imkoniyat cheklovi emas)
    inputs: ["image-ref"],
    // videoSettings — video pane sozlamalarni SHUNDAN o'qiydi (aks holda 480p/Auto default). Veo narxi
    // soniyaga, resolution'dan mustaqil → perSec teng (billing o'zgarmaydi: computeGenCost perSec[res]).
    videoSettings: {
      aspect: { options: ["16:9", "9:16"], def: "16:9" },
      resolution: { options: ["720p"], def: "720p", perSec: { "720p": 3 } },
      duration: { options: ["4", "6", "8"], def: "8", autoSec: 8 },
      audio: false,
    },
  },
  {
    id: 3002,
    mode: "video",
    key: "veo-3.1-fast-generate-001", // Vertex Model Garden model ID (tasdiqlangan — real ishlaydigan kod namunasidan)
    label: "Veo 3.1 Fast (Google Cloud)",
    provider: "vertex", // TO'G'RIDAN-TO'G'RI Vertex AI (fal.ai orqali EMAS) — foydalanuvchining o'z GCP krediti
    enabled: true, // 2026-07-01 yoqildi (video → 2-loyiha). Smoke-test o'tgan (submit→poll→GCS→S3).
    feature: "text-to-video",
    // Google narxi ~$0.10/s (audiosiz). 8 kredit/s (~1 kredit≈$0.012-0.015 taxmini bilan deyarli
    // teppa-teng) — foydalanuvchi qarori bilan shu narxda qoldirildi (foyda kam, keyin oshirish mumkin).
    cost: 8,
    referenceMode: "video-ref", // ixtiyoriy boshlang'ich kadr (Veo sof matndan ham video yasaydi)
    endFrame: true, // Veo last_frame qo'llaydi (SDK) — start+end kadr
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    durations: [4, 6, 8],
    audio: false, // MVP qaror (audio-qodir, lekin default o'chiq)
    inputs: ["image-ref"],
    // videoSettings — 1080p'ni UI'da OCHADI (avval erishib bo'lmasdi). perSec teng (billing o'zgarmaydi).
    videoSettings: {
      aspect: { options: ["16:9", "9:16"], def: "16:9" },
      resolution: { options: ["720p", "1080p"], def: "720p", perSec: { "720p": 8, "1080p": 8 } },
      duration: { options: ["4", "6", "8"], def: "8", autoSec: 8 },
      audio: false,
    },
  },
  {
    id: 3010,
    mode: "video",
    key: "gemini-omni-flash-preview", // Vertex Interactions API (global) — jonli probe tasdiqladi
    label: "Gemini Omni Flash (Google Cloud)",
    provider: "vertex-omni", // SINXRON Interactions API (Veo submit/poll'дан farqli) — har chaqiruv pul oladi
    enabled: true, // 2026-07-01 yoqildi (video → 2-loyiha). Sinov: 1280x720, 10s, audio.
    feature: "text-to-video", // rasm referens bo'lsa image-to-video sifatida ishlaydi (runVertexOmniVideo ichida)
    // NARX QAT'IY (per-generation): har gen ~10s = ~$1.00. 80 kredit FLAT (soniyaga ko'paytirilmaydi).
    pricing: "per-generation",
    cost: 80,
    // KO'P-MODAL referens: RASM (image-to-video/subject) + VIDEO (reference-to-video/editing).
    // Video Vertex Omni'ga gs:// yoki inline base64 uzatiladi (workflow 2026-07-01 jonli tasdiqladi).
    refKind: "media-refs",
    referenceMode: "video-ref",
    endFrame: false,
    mediaRefs: { image: 3, video: 2, audio: 0, total: 3 },
    mediaRefFormats: { image: ["png", "jpg", "jpeg", "webp"], video: ["mp4", "mov", "webm"] },
    aspects: ["16:9", "9:16"],
    resolutions: ["720p"],
    durations: [10],
    audio: true,
    inputs: ["image-ref", "video-ref"],
    // videoSettings deskriptor — video pane sozlamalarni SHUNDAN o'qiydi (aks holda 480p/Auto default).
    // Omni REAL imkoniyatlari (adapter vertex-omni.ts + jonli sinov 2026-07-01): 720p QAT'IY, ~10s QAT'IY,
    // audio DOIM (API'da o'chirish parametri yo'q), nisbat FAQAT video-referenssiz ishlaydi.
    videoSettings: {
      aspect: { options: ["16:9", "9:16"], def: "16:9" },
      resolution: { options: ["720p"], def: "720p", perSec: { "720p": 80 } },
      duration: { options: ["10"], def: "10", autoSec: 10 },
      audio: true,
      audioDefault: true,
      audioLocked: true, // toggle YOLG'ON ishlagan (audio baribir chiqadi) — endi UI qulflab halol ko'rsatadi
      aspectIgnoredWithVideoRef: true, // video ref bilan response_format yuborilmaydi (400) — nisbat model ixtiyorida
    },
  },
  {
    id: 3003,
    mode: "video",
    key: "veo-3.1-generate-001", // Veo 3.1 (Standard) — foydalanuvchi havolasi bilan tasdiqlangan ID
    label: "Veo 3.1",
    provider: "vertex", // to'g'ridan-to'g'ri Vertex → VIDEO_PROJECT (2-$300)
    enabled: true, // 2026-07-01 yoqildi (video → 2-loyiha). Standard: eng yuqori sifat.
    feature: "text-to-video",
    cost: 30, // /s — premium (Google ~$0.35-0.40/s)
    referenceMode: "video-ref",
    endFrame: true, // Veo last_frame qo'llaydi (SDK) — start+end kadr
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    durations: [4, 6, 8],
    audio: true,
    inputs: ["image-ref"],
    // videoSettings — 1080p ochiladi; audioDefault:true (Standard audio-qodir). perSec teng (billing o'zgarmaydi).
    videoSettings: {
      aspect: { options: ["16:9", "9:16"], def: "16:9" },
      resolution: { options: ["720p", "1080p"], def: "720p", perSec: { "720p": 30, "1080p": 30 } },
      duration: { options: ["4", "6", "8"], def: "8", autoSec: 8 },
      audio: true,
      audioDefault: true,
    },
  },
  {
    id: 3004,
    mode: "video",
    key: "kwaivgi/kling-v3.0-std",
    label: "Kling v3.0",
    enabled: false, // B6: fal'ga ulanmagan
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
    enabled: false, // B6: fal'ga ulanmagan
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
    enabled: false, // B6: fal'ga ulanmagan (fal varianti: 3101/3102)
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
    enabled: false, // B6: fal'ga ulanmagan
    feature: "image-to-video",
    cost: 12,
    referenceMode: "video-ref",
    aspects: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    durations: [5, 10],
    audio: true,
    inputs: ["start-end-frame"],
  },
  {
    id: 3101,
    mode: "video",
    key: "bytedance/seedance-2.0/fast/image-to-video",
    label: "Seedance 2.0 Fast",
    brand: "bytedance",
    provider: "fal",
    falModel: "bytedance/seedance-2.0/fast/image-to-video",
    feature: "image-to-video",
    cost: 12,
    referenceMode: "video-ref",
    refMode: "required",
    maxRefs: 1,
    endFrame: true,
    refKind: "frames", // So'nggi-grid: RASM karta → Boshlang'ich/Yakuniy kadr; VIDEO karta → faqat Import
    inputs: ["start-end-frame"],
    aspects: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    resolutions: ["480p", "720p"],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
    audio: true,
    videoSettings: {
      aspect: { options: ["Auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], def: "Auto" },
      resolution: {
        options: ["480p", "720p"],
        def: "480p",
        perSec: { "480p": 8, "720p": 12 },
      },
      duration: {
        options: ["Auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "15"],
        def: "Auto",
        autoSec: 4,
      },
      audio: true,
      audioDefault: false,
    },
  },
  // ── VIDEO UPSCALE (BATCH4 #2) — fal.ai Topaz `fal-ai/topaz/upscale/video` (video-to-video).
  // NARX: fal $/s CHIQISH videoga, tier'li: ≤720p $0.01/s · ≤1080p $0.02/s · >1080p $0.08/s
  // (60fps chiqish ×2 — derivatsiya billing-soniyani ikkilaydi, stavka emas). Kredit/s (2×,
  // $0.019/kr): 720p=ceil(0.02/0.019)=2 · 1080p=ceil(0.04/0.019)=3 · 4k=ceil(0.16/0.019)=9.
  // Chiqish tier = manba o'lcham × faktor — SERVER cost-quote'da ffprobe bilan aniqlaydi va
  // params.resolution/duration'ni O'ZI yozadi (lib/video-upscale.ts) → MAVJUD computeGenCost
  // perSec[res]×duration formulasi O'ZGARISHSIZ ishlaydi. Referens oqimi YO'Q (maxsus manba:
  // params.sourceKey — o'z gen natijasi yoki yuklangan video). Topaz "Gaia 2" (mograph, ×0.5)
  // v1'da OCHILMAGAN — kerak bo'lsa alohida (yarim-stavkali) katalog entry sifatida qo'shiladi.
  {
    id: 3201,
    mode: "video",
    key: "fal-ai/topaz/upscale/video",
    label: "Video Upscale (Topaz)",
    brand: "topaz",
    provider: "fal",
    falModel: "fal-ai/topaz/upscale/video",
    enabled: true,
    feature: "video-upscale",
    cost: 2, // fallback = ≤720p kredit/soniya; videoSettings.perSec ustun
    referenceMode: "none",
    refMode: "none",
    refKind: "none",
    maxRefs: 0,
    aspects: ["auto"], // nisbat manbadan — o'zgarmaydi
    resolutions: ["720p", "1080p", "4k"], // CHIQISH tier'lari (server derive qiladi)
    durations: Array.from({ length: 300 }, (_, i) => i + 1), // billing soniya 1..300 (server yozadi)
    audio: false,
    videoSettings: {
      aspect: { options: ["Auto"], def: "Auto" },
      resolution: { options: ["720p", "1080p", "4k"], def: "720p", perSec: { "720p": 2, "1080p": 3, "4k": 9 } },
      duration: { options: ["Auto"], def: "Auto", autoSec: 5 }, // ishlatilmaydi — server aniq soniya yozadi
      audio: false,
    },
  },

  // Seedance 2.0 R2V — ko'p-modal referens (image≤9 + video≤3 + audio≤3, jami≤12, IXTIYORIY) + prompt.
  // @Image/@Video/@Audio prompt'да o'zicha qoladi (model tushunadi). Narx soniyaga, resolutionга qarab.
  {
    id: 3102,
    mode: "video",
    key: "bytedance/seedance-2.0/reference-to-video",
    label: "Seedance 2.0 R2V",
    brand: "bytedance",
    provider: "fal",
    falModel: "bytedance/seedance-2.0/reference-to-video",
    feature: "reference-to-video",
    cost: 15,
    referenceMode: "video-ref",
    refMode: "optional", // referenssiz ham ishlaydi (faqat prompt)
    refKind: "media-refs",
    mediaRefs: { image: 9, video: 3, audio: 3, total: 12 },
    mediaRefMaxBytes: { image: 30 * 1024 * 1024, audio: 15 * 1024 * 1024 },
    mediaRefMaxTotalBytes: { video: 50 * 1024 * 1024 },
    mediaRefFormats: {
      image: ["jpg", "jpeg", "png", "webp"],
      video: ["mp4", "mov"],
      audio: ["mp3", "wav"],
    },
    videoInputPerSecMultiplier: 0.6,
    inputs: ["image-ref", "video-ref", "audio-file"],
    aspects: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    resolutions: ["480p", "720p", "1080p", "4k"],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    audio: true,
    videoSettings: {
      aspect: { options: ["Auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], def: "Auto" },
      resolution: {
        options: ["480p", "720p", "1080p", "4k"],
        def: "480p",
        perSec: { "480p": 8, "720p": 15, "1080p": 34, "4k": 60 },
      },
      duration: {
        options: ["Auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
        def: "Auto",
        autoSec: 4,
      },
      audio: true,
      audioDefault: false,
      bitrate: { options: ["standard", "high"], def: "standard" },
    },
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

/**
 * So'nggi-grid "Referens" tugmasi uchun model-aware tur. Deklaratsiya (refKind) bo'lmasa
 * mode + referenceMode'dan derive qilinadi (eski modellar uchun ham xavfsiz):
 *  - video + ref qabul qiladi (endFrame/start-end-frame/image-ref/video-ref) → "frames" (start/end IMAGE)
 *  - video + referenssiz (t2v) → "none"
 *  - image + edit → "image" (@imgN ref-strip) · image + referenssiz (t2i) → "none"
 */
export function getRefKind(
  model: GenModel
): "frames" | "image" | "video" | "imagevideo" | "media-refs" | "none" {
  if (model.refKind) return model.refKind;
  const rm = getReferenceMode(model);
  if (model.mode === "video") {
    if (rm === "none") return "none";
    const inp = model.inputs || [];
    if (model.endFrame || inp.includes("start-end-frame") || inp.includes("image-ref")) return "frames";
    return rm === "video-ref" ? "frames" : "none";
  }
  if (model.mode === "image") return rm === "none" ? "none" : "image";
  return "none";
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
  bitrateMode?: string;
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
  // "auto" davomiylik → videoSettings.duration.autoSec (narx hisoblash uchun)
  const durParam = params.duration;
  const durStr = String(durParam ?? "").toLowerCase();
  const isAuto = durStr === "auto" || durStr === "";
  const duration =
    isAuto && model.videoSettings?.duration?.autoSec
      ? model.videoSettings.duration.autoSec
      : pickNum(model.durations, durParam, [5, 6, 4]);
  return {
    duration,
    resolution: pickStr(model.resolutions, params.resolution, ["720p", "1080p"]),
    aspectRatio: pickStr(model.aspects, params.aspectRatio, ["auto", "16:9", "9:16"]),
    // P8 C1: model audio QO'LLAMASA (videoSettings.audio/audio=false) client true yubora
    // olmaydi — Veo Lite/Fast'da audio-on so'rab audio-off narxida olish yopildi.
    // (Narx hisobiga ta'sir yo'q — computeGenCost generateAudio'ni ishlatmaydi.)
    generateAudio:
      (model.videoSettings?.audio ?? model.audio ?? false) === false
        ? false
        : typeof params.audio === "boolean"
          ? params.audio
          : typeof model.videoSettings?.audioDefault === "boolean"
            ? model.videoSettings.audioDefault
            : Boolean(model.audio),
    bitrateMode: model.videoSettings?.bitrate
      ? pickStr(model.videoSettings.bitrate.options, params.bitrateMode, [model.videoSettings.bitrate.def, "standard"])
      : undefined,
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

/** Generatsiya narxi. Video: perSec[res] × duration (videoSettings bo'lsa), aks holda cost × duration. Rasm: bir-dona(quality) × count. Boshqa: sobit cost. */
export function computeGenCost(model: GenModel, params: Record<string, unknown>): number {
  if (model.mode === "video") {
    const vp = resolveVideoParams(model, params);
    // PRICING (B3): per-generation → resolution/duration'dan QAT'I NAZAR sobit cost.
    if (model.pricing === "per-generation") return model.cost;
    const perSec = model.videoSettings?.resolution?.perSec;
    let ratePerSec = perSec ? (perSec[vp.resolution] ?? model.cost) : model.cost;
    const hasVideoInputs =
      Array.isArray(params.videoUrls) &&
      params.videoUrls.some((x) => typeof x === "string" && x.length > 0);
    if (hasVideoInputs && model.videoInputPerSecMultiplier && model.videoInputPerSecMultiplier > 0) {
      ratePerSec = Math.max(1, Math.round(ratePerSec * model.videoInputPerSecMultiplier));
    }
    return ratePerSec * vp.duration;
  }
  if (model.mode === "image") {
    return imageUnitCost(model, params) * resolveImageCount(model, params);
  }
  return model.cost;
}

// Seedance default fal video input kalitlari (videoInput deklaratsiya bo'lmasa — orqaga moslik).
const SEEDANCE_FRAMES_INPUT: NonNullable<GenModel["videoInput"]> = {
  startFrameKey: "image_url",
  endFrameKey: "end_image_url",
  imageRequired: true,
  resolutionKey: "resolution",
  durationKey: "duration",
  durationFormat: "string",
  aspectKey: "aspect_ratio",
  audioKey: "generate_audio",
};
const SEEDANCE_REF_INPUT: NonNullable<GenModel["videoInput"]> = {
  imageRefsKey: "image_urls",
  videoRefsKey: "video_urls",
  audioRefsKey: "audio_urls",
  resolutionKey: "resolution",
  durationKey: "duration",
  durationFormat: "string",
  aspectKey: "aspect_ratio",
  audioKey: "generate_audio",
  bitrateKey: "bitrate_mode",
  injectUserIdKey: "end_user_id",
};

/** Model'ning fal-video input deskriptorini qaytaradi (deklaratsiya bo'lmasa Seedance default'i feature bo'yicha). */
export function videoInputDescriptor(model: GenModel): NonNullable<GenModel["videoInput"]> {
  if (model.videoInput) return model.videoInput;
  return model.feature === "reference-to-video" ? SEEDANCE_REF_INPUT : SEEDANCE_FRAMES_INPUT;
}

export type VideoRefUrls = {
  startUrl?: string;
  endUrl?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
};

/**
 * fal VIDEO input obyektini MODEL DEKLARATSIYASIDAN quradi (imgSettings/falImage naqshi).
 * Seedance modellari uchun natija eski qo'lda yozilgan input bilan AYNAN bir xil (orqaga moslik).
 * Yangi model faqat videoInput kalitlarini e'lon qiladi — kod o'zgarmaydi.
 */
export function buildFalVideoInput(
  model: GenModel,
  prompt: string,
  resolved: ResolvedVideoParams,
  refs: VideoRefUrls,
  userId?: string
): Record<string, unknown> {
  const d = videoInputDescriptor(model);
  const input: Record<string, unknown> = { prompt: String(prompt) };
  if (d.startFrameKey && refs.startUrl) input[d.startFrameKey] = refs.startUrl;
  if (d.endFrameKey && model.endFrame && refs.endUrl) input[d.endFrameKey] = refs.endUrl;
  const arr = (a?: string[]) => (Array.isArray(a) ? a.filter((u) => typeof u === "string" && u.length > 0) : []);
  const imgs = arr(refs.imageUrls), vids = arr(refs.videoUrls), auds = arr(refs.audioUrls);
  if (d.imageRefsKey && imgs.length) input[d.imageRefsKey] = imgs;
  if (d.videoRefsKey && vids.length) input[d.videoRefsKey] = vids;
  if (d.audioRefsKey && auds.length) input[d.audioRefsKey] = auds;
  if (d.resolutionKey) input[d.resolutionKey] = resolved.resolution;
  if (d.durationKey)
    input[d.durationKey] = d.durationFormat === "number" ? resolved.duration : String(resolved.duration);
  if (d.aspectKey) input[d.aspectKey] = resolved.aspectRatio === "auto" ? "auto" : resolved.aspectRatio;
  if (d.audioKey) input[d.audioKey] = resolved.generateAudio;
  if (d.bitrateKey && resolved.bitrateMode) input[d.bitrateKey] = resolved.bitrateMode;
  if (d.injectUserIdKey && userId) input[d.injectUserIdKey] = userId;
  if (d.staticInput) Object.assign(input, d.staticInput);
  return input;
}

/** Model i2v boshlang'ich kadrni MAJBUR qiladimi (t2v → false). */
export function videoRequiresStartFrame(model: GenModel): boolean {
  return videoInputDescriptor(model).imageRequired === true;
}

/** fal video natija javobidan URL'ni model deklaratsiyasidagi yo'llar bo'yicha topadi (B5). */
export function extractFalVideoUrl(model: GenModel, data: unknown): string {
  const paths = videoInputDescriptor(model).outputPaths || ["video.url", "video", "url"];
  const root = data as Record<string, unknown>;
  for (const p of paths) {
    let cur: unknown = root;
    for (const seg of p.split(".")) {
      if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur) return cur;
  }
  return "";
}
