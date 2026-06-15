/**
 * Studio Gen model katalogi (Artlist uslubi — raqamli ID). `key` = OpenRouter model ID;
 * `feature` 1c processor'da to'g'ri OpenRouter funksiyasini tanlash uchun:
 *   text-to-image | image-edit | text-to-speech | text-to-video | image-to-video.
 * `cost` — kredit narxi (imzolangan cost-quote shu narxni biriktiradi).
 * Model ID'lar env orqali ham almashtirilishi mumkin (AI_MODEL_* yo'q — to'g'ridan key).
 */
export type GenModel = {
  id: number;
  mode: "image" | "voice" | "video" | "music";
  key: string; // OpenRouter model ID
  label: string;
  feature:
    | "text-to-image"
    | "image-edit"
    | "text-to-speech"
    | "text-to-video"
    | "image-to-video";
  cost: number;
  isDefault?: boolean;
};

export const GEN_MODELS: GenModel[] = [
  // ── Rasm (text-to-image) ──
  {
    id: 1001,
    mode: "image",
    key: "google/gemini-3.1-flash-image-preview",
    label: "Gemini Flash Image",
    feature: "text-to-image",
    cost: 5,
    isDefault: true,
  },
  {
    id: 1002,
    mode: "image",
    key: "black-forest-labs/flux.2-pro",
    label: "Flux 2 Pro",
    feature: "text-to-image",
    cost: 8,
  },
  // ── Rasm EDIT (reference / "rangini o'zgartir") ──
  {
    id: 1101,
    mode: "image",
    key: "google/gemini-3.1-flash-image-preview",
    label: "Gemini Edit (reference)",
    feature: "image-edit",
    cost: 6,
  },
  // ── Ovoz (TTS) ──
  {
    id: 2001,
    mode: "voice",
    key: "hexgrad/kokoro-82m",
    label: "Kokoro TTS",
    feature: "text-to-speech",
    cost: 3,
    isDefault: true,
  },
  // ── Video (Kling / Veo) ──
  {
    id: 3001,
    mode: "video",
    key: "kwaivgi/kling-v3.0-std",
    label: "Kling v3.0 Standard",
    feature: "image-to-video",
    cost: 60,
    isDefault: true,
  },
  {
    id: 3002,
    mode: "video",
    key: "kwaivgi/kling-v3.0-pro",
    label: "Kling v3.0 Pro",
    feature: "image-to-video",
    cost: 120,
  },
  {
    id: 3003,
    mode: "video",
    key: "google/veo-3.1",
    label: "Veo 3.1",
    feature: "text-to-video",
    cost: 150,
  },
];

// Semantik qidiruv uchun embedding modeli (katalogda emas — ichki ishlatiladi).
export const EMBED_MODEL = "qwen/qwen3-embedding-4b";

export function getModelsByMode(mode: string): GenModel[] {
  return GEN_MODELS.filter((m) => m.mode === mode);
}

export function getModelById(id: number): GenModel | undefined {
  return GEN_MODELS.find((m) => m.id === id);
}
