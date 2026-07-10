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

/** Rasm: model id → sifat(1K/2K/4K...) bo'yicha bir-dona provider USD.
 *  BATCH4 #3 — bazaviy tier'lar RASMIY sahifadan USER-tasdiqlangan (2026-07); yuqori
 *  tier'lar (2K/4K) hali TAXMINIY (rasmiy per-tier narx e'lon qilinmagan) — konservativ. */
export const IMAGE_USD_PER_UNIT: Record<number, Record<string, number>> = {
  1010: { "1K": 0.04, "2K": 0.06, "4K": 0.12 }, // Nano Banana 2 — 1K $0.040 ✅; 2K/4K taxminiy
  1013: { "1K": 0.02 }, // Nano Banana 2 Lite — $0.020 ✅
  1014: { "1K": 0.1, "2K": 0.15, "4K": 0.24 }, // Nano Banana Pro — 1K $0.100 ✅; 2K/4K taxminiy
  1011: { "1K": 0.04, "2K": 0.06 }, // Imagen 4 — 1K $0.040 ✅; 2K taxminiy
  1012: { "1K": 0.06, "2K": 0.08 }, // Imagen 4 Ultra — 1K $0.060 ✅; 2K taxminiy
  1015: { x2: 0.003, x4: 0.003 }, // Imagen Upscale (imagegeneration@002) — $0.003/rasm ✅
};

/** Video (per-second): model id → resolution bo'yicha soniya USD.
 *  BATCH4 #3 — Veo/Omni/Topaz/Seedance 720p·1080p USER-tasdiqlangan (2026-07). Seedance 480p
 *  va R2V 4k tier'lari PIKSEL-nisbatda masshtablangan taxmin (fal token-narxi ∝ piksel):
 *  480p≈0.445×720p; 4k≈4×1080p — 4k og'ir ishlatishdan oldin fal sahifasida qayta tasdiqlansin. */
export const VIDEO_USD_PER_SEC: Record<number, Record<string, number>> = {
  3001: { "720p": 0.03 }, // Veo 3.1 Lite ✅ (720p, audiosiz)
  3002: { "720p": 0.08, "1080p": 0.1 }, // Veo 3.1 Fast ✅ (audiosiz)
  3003: { "720p": 0.4, "1080p": 0.4 }, // Veo 3.1 Standard ✅ (audio bilan)
  3101: { "480p": 0.108, "720p": 0.2419 }, // Seedance 2.0 Fast — 720p ✅; 480p scaled
  3102: { "480p": 0.135, "720p": 0.3034, "1080p": 0.682, "4k": 2.728 }, // Seedance R2V — 720p/1080p ✅; 480p/4k scaled
  // Topaz video upscale (fal, RASMIY tarif ✅): $/s CHIQISH bo'yicha; 60fps ×2 billing
  // duration'ga kiritilgan (derive), shu sabab bu jadval sof tier stavkasi.
  3201: { "720p": 0.01, "1080p": 0.02, "4k": 0.08 },
};

/** Video (per-generation): model id → sobit USD. */
export const VIDEO_USD_FLAT: Record<number, number> = {
  3010: 1.0, // Gemini Omni Flash ✅ — har chaqiruv ~10s ≈ $1.00
};

/** Boshqa rejimlar (ovoz/sfx): model id → sobit USD. */
export const FLAT_USD: Record<number, number> = {
  2001: 0.005, // Kokoro TTS (OpenRouter, arzon OSS) — o'chirilgan (BATCH4 #4)
  2002: 0.03, // Chirp 3 HD ✅ — worst-case maxChars=1000 × $0.00003/belgi
  // ElevenLabs SFX — rasmiy docs ✅: 40 EL-kredit/soniya; bizning max 10s = 400 EL-kredit
  // ≈ $0.088 (Creator $22/100k). Flat kredit worst-case'ga langarlangan (Chirp naqshi).
  4001: 0.088,
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
