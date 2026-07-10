/**
 * Provider USD cost estimator (Bosqich 1 #1 — MARJA POYDEVORI).
 *
 * Har generatsiya provayderga qancha REAL dollar turishini TAXMIN qiladi. Bu qiymat
 * `ProviderSpend.estimatedCostUsd`ga yoziladi (best-effort) — keyin marja hisobi
 * (kredit daromadi ÷ provider USD) va spend kill-switch (Bosqich 1 #2) shundan foydalanadi.
 *
 * MANBA: docs/AI-API-AUDIT.md + gen-models.ts izohlaridagi provider narxlari (Google Vertex,
 * fal Seedance, ElevenLabs, OpenRouter). Qiymatlar TAXMINIY — Bosqich 3 "narx dvigateli"
 * (admin-managed pricing + oylik billing reconciliation) ularni real invoice bilan aniqlaydi.
 *
 * Bu MODUL PUL ZONASIGA TEGMAYDI: consume/refund, cost-quote, atomik kredit — hech biri bunga
 * bog'liq emas. Estimator xato bersa yoki noma'lum model bo'lsa `null` qaytaradi (yozuv null bo'ladi,
 * foydalanuvchi geni bloklanmaydi).
 */
import type { GenModel } from "./gen-models.js";
import { GEN_MODELS, resolveVideoParams, resolveImageCount } from "./gen-models.js";

/**
 * FAZA 2 (H8) — noma'lum/narx-jadvalisiz model uchun KONSERVATIV default USD. Ilgari null
 * qaytardik → ProviderSpend.estimatedCostUsd null bo'lib global ceiling'да HISOBGA OLINMASdi
 * (under-count). Endi har model non-null (overestimate → ceiling ertaroq ishlaydi = fail-safe).
 * Aniq narx qo'shilishi kerak bo'lgan modellar startup check (findEnabledModelsWithoutCost) bilan
 * flag qilinadi.
 */
export const DEFAULT_PROVIDER_USD = 0.5;

/** Rasm: model id → sifat(1K/2K/4K...) bo'yicha bir-dona provider USD (TAXMINIY). */
const IMAGE_USD_PER_UNIT: Record<number, Record<string, number>> = {
  1010: { "1K": 0.04, "2K": 0.06, "4K": 0.12 }, // Nano Banana 2 (Gemini Flash Image)
  1013: { "1K": 0.02 }, // Nano Banana 2 Lite
  1014: { "1K": 0.1, "2K": 0.15, "4K": 0.24 }, // Nano Banana Pro (premium)
  1011: { "1K": 0.04, "2K": 0.06 }, // Imagen 4
  1012: { "1K": 0.06, "2K": 0.08 }, // Imagen 4 Ultra
  1015: { x2: 0.003, x4: 0.003 }, // Imagen Upscale (imagegeneration@002) — $0.003/rasm (USER-tasdiqlangan 2026-07)
};

/** Video (per-second): model id → resolution bo'yicha soniya USD (TAXMINIY). */
const VIDEO_USD_PER_SEC: Record<number, Record<string, number>> = {
  3001: { "720p": 0.04 }, // Veo 3.1 Lite (~$0.03-0.05/s)
  3002: { "720p": 0.1, "1080p": 0.1 }, // Veo 3.1 Fast (~$0.10/s)
  3003: { "720p": 0.38, "1080p": 0.38 }, // Veo 3.1 (~$0.35-0.40/s)
  3101: { "480p": 0.03, "720p": 0.05 }, // Seedance 2.0 Fast (fal)
  3102: { "480p": 0.03, "720p": 0.05, "1080p": 0.11, "4k": 0.2 }, // Seedance 2.0 R2V (fal)
};

/** Video (per-generation): model id → sobit USD (TAXMINIY). */
const VIDEO_USD_FLAT: Record<number, number> = {
  3010: 1.0, // Gemini Omni Flash — har chaqiruv ~10s ≈ $1.00
};

/** Boshqa rejimlar (ovoz/sfx): model id → sobit USD (TAXMINIY). */
const FLAT_USD: Record<number, number> = {
  2001: 0.005, // Kokoro TTS (OpenRouter, arzon OSS) — o'chirilgan (BATCH4 #4)
  2002: 0.03, // Chirp 3 HD — worst-case maxChars=1000 × $0.00003/belgi (odatda ancha kam)
  4001: 0.08, // ElevenLabs SFX (sound-generation)
};

/** imageUnitCost'dagi kabi tanlangan sifat kalitini aniqlaydi (1K/2K/4K...). */
function imageQualityKey(model: GenModel, params: Record<string, unknown>): string | undefined {
  const s = model.imgSettings?.quality;
  const options =
    s?.options && s.options.length
      ? s.options
      : model.resolutions && model.resolutions.length
        ? model.resolutions
        : [];
  const q = typeof params.quality === "string" ? params.quality : "";
  if (options.includes(q)) return q;
  return s?.def ?? options[0];
}

/**
 * Generatsiyaning taxminiy provider USD narxi. Noma'lum model/rejim → null.
 * Video: per-generation → sobit; per-second → USD/s × duration. Rasm: bir-dona × count.
 */
export function estimateProviderUsd(
  model: GenModel,
  params: Record<string, unknown>
): number | null {
  try {
    // FAZA 2 (H8): jadval topilmasa null EMAS, DEFAULT_PROVIDER_USD (ceiling under-count'ni yopadi).
    if (model.mode === "video") {
      if (model.pricing === "per-generation") {
        const flat = VIDEO_USD_FLAT[model.id];
        return typeof flat === "number" ? round4(flat) : round4(DEFAULT_PROVIDER_USD);
      }
      const table = VIDEO_USD_PER_SEC[model.id];
      if (!table) return round4(DEFAULT_PROVIDER_USD);
      const vp = resolveVideoParams(model, params);
      const perSec = table[vp.resolution] ?? table[Object.keys(table)[0]];
      if (typeof perSec !== "number") return round4(DEFAULT_PROVIDER_USD);
      return round4(perSec * vp.duration);
    }
    if (model.mode === "image") {
      const table = IMAGE_USD_PER_UNIT[model.id];
      if (!table) return round4(DEFAULT_PROVIDER_USD);
      const key = imageQualityKey(model, params);
      const unit = (key && table[key]) ?? table[Object.keys(table)[0]];
      if (typeof unit !== "number") return round4(DEFAULT_PROVIDER_USD);
      return round4(unit * resolveImageCount(model, params));
    }
    const flat = FLAT_USD[model.id];
    return typeof flat === "number" ? round4(flat) : round4(DEFAULT_PROVIDER_USD);
  } catch {
    return null;
  }
}

/** Model uchun ANIQ narx jadvali bormi (DEFAULT_PROVIDER_USD'ga tushmaydimi)? */
function hasProviderCostEntry(model: GenModel): boolean {
  if (model.mode === "video") {
    return model.pricing === "per-generation"
      ? typeof VIDEO_USD_FLAT[model.id] === "number"
      : !!VIDEO_USD_PER_SEC[model.id];
  }
  if (model.mode === "image") return !!IMAGE_USD_PER_UNIT[model.id];
  return typeof FLAT_USD[model.id] === "number";
}

/**
 * FAZA 2 (H8) — startup completeness check: ENABLED bo'lib aniq provider narx jadvalisiz
 * (ceiling'да default'ga tushadigan) modellar ro'yxati. Bo'sh bo'lsa — hammasi narxlangan.
 * index.ts validateEnv buni ogohlantirish sifatida chiqaradi (narx qo'shish kerakligini bildiradi).
 */
export function findEnabledModelsWithoutCost(): { id: number; name: string; mode: string }[] {
  return GEN_MODELS.filter((m) => m.enabled && !hasProviderCostEntry(m)).map((m) => ({
    id: m.id,
    name: m.label,
    mode: m.mode,
  }));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
