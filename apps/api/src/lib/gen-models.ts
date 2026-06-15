import { AI_MODELS } from "./ai/workers-ai.js";

/**
 * Studio Gen model katalogi (Artlist uslubi — raqamli ID). Har model Workers AI `key`'iga
 * map qilinadi; `feature` 1c'da to'g'ri funksiyani tanlash uchun (text-to-image / text-to-speech).
 * `cost` — kredit narxi (imzolangan cost-quote shu narxni biriktiradi).
 */
export type GenModel = {
  id: number;
  mode: "image" | "voice" | "video" | "music";
  key: string; // Workers AI model ID (@cf/...)
  label: string;
  feature: string; // text-to-image | text-to-speech | ...
  cost: number;
  isDefault?: boolean;
};

export const GEN_MODELS: GenModel[] = [
  {
    id: 1001,
    mode: "image",
    key: AI_MODELS.image,
    label: "Flux Schnell",
    feature: "text-to-image",
    cost: 5,
    isDefault: true,
  },
  {
    id: 1002,
    mode: "image",
    key: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    label: "SDXL",
    feature: "text-to-image",
    cost: 6,
  },
  {
    id: 2001,
    mode: "voice",
    key: AI_MODELS.tts,
    label: "MeloTTS",
    feature: "text-to-speech",
    cost: 3,
    isDefault: true,
  },
];

export function getModelsByMode(mode: string): GenModel[] {
  return GEN_MODELS.filter((m) => m.mode === mode);
}

export function getModelById(id: number): GenModel | undefined {
  return GEN_MODELS.find((m) => m.id === id);
}
