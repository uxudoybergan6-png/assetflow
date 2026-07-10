/**
 * AUTO-MARJA (BATCH4 #3) — kredit narxni provider narxidan AVTOMATIK hisoblaydi:
 *
 *   kredit = ceil( providerUsd × marginTarget ÷ creditUsdValue )   — har tier alohida.
 *
 * MONEY-ZONE'GA TEGMAYDI: narx FAQAT mavjud upsertModelPricing/updatePricingConfig yo'li
 * bilan yoziladi (imzolangan cost-quote DB-narxini o'zi oladi). computeGenCost/HMAC/
 * consume/refund/creditUsdValue O'ZGARMAYDI. Provider narx manbai — provider-cost.ts
 * jadvallari (tasdiqlangan qiymatlar bilan yangilangan).
 *
 * PINNED modellar: narxi MAHSULOT qarori bilan qo'lda belgilangan (auto-apply chetlab
 * o'tadi, per-row "auto" bilan xohlasa baribir qo'llasa bo'ladi). Hozircha: 1015 Imagen
 * Upscale — provider narxi ($0.003) juda past, 2× formula ✦1 berardi; BATCH4 #1 qarori
 * x2=4/x4=8 (bir xil o'lchamdagi generatsiyadan oshmaydigan premium narx) saqlanadi.
 */
import type { GenModel } from "./gen-models.js";
import { GEN_MODELS } from "./gen-models.js";
import {
  IMAGE_USD_PER_UNIT,
  VIDEO_USD_PER_SEC,
  VIDEO_USD_FLAT,
  FLAT_USD,
  estimateProviderUsd,
} from "./provider-cost.js";
import {
  getPricingConfig,
  upsertModelPricing,
  type PricingPatch,
  type ModelPricingRow,
} from "./model-pricing.js";

/** Narxi qo'lda pin'langan modellar — global auto-apply TEGMAYDI (sabab yuqorida). */
export const PINNED_MODEL_IDS = new Set<number>([1015]);

function ceilCredits(usd: number, margin: number, creditUsd: number): number {
  return Math.max(1, Math.ceil((usd * margin) / creditUsd));
}

export type AutoDerived = {
  modelId: number;
  label: string;
  mode: string;
  pinned: boolean;
  /** Har tier: provider USD → kredit (image: tier/rasm; video: tier kredit/soniya). */
  tiers: Array<{ key: string; providerUsd: number; credits: number }>;
  patch: PricingPatch | null; // null → narx jadvali yo'q (derivatsiya qilinmadi)
};

/** Bitta model uchun 2×-derivatsiya (yozmasdan) — admin preview + apply ikkalasiga. */
export function deriveAutoPricing(
  model: GenModel,
  marginTarget: number,
  creditUsd: number
): AutoDerived {
  const out: AutoDerived = {
    modelId: model.id,
    label: model.label,
    mode: model.mode,
    pinned: PINNED_MODEL_IDS.has(model.id),
    tiers: [],
    patch: null,
  };
  if (model.mode === "image") {
    const table = IMAGE_USD_PER_UNIT[model.id];
    if (!table) return out;
    const qualityCost: Record<string, number> = {};
    for (const [tier, usd] of Object.entries(table)) {
      const credits = ceilCredits(usd, marginTarget, creditUsd);
      qualityCost[tier] = credits;
      out.tiers.push({ key: tier, providerUsd: usd, credits });
    }
    // Bazaviy `cost` = default tier (imgSettings.def) yoki birinchi tier.
    const def = model.imgSettings?.quality?.def;
    const base = def != null && qualityCost[def] != null ? qualityCost[def] : Object.values(qualityCost)[0];
    out.patch = {
      cost: base,
      qualityCost: Object.keys(qualityCost).length > 1 ? qualityCost : null,
      estCostUsd: estimateProviderUsd(model, {}),
    };
    return out;
  }
  if (model.mode === "video") {
    if (model.pricing === "per-generation") {
      const flat = VIDEO_USD_FLAT[model.id];
      if (typeof flat !== "number") return out;
      const credits = ceilCredits(flat, marginTarget, creditUsd);
      out.tiers.push({ key: "per-gen", providerUsd: flat, credits });
      out.patch = { cost: credits, estCostUsd: flat };
      return out;
    }
    const table = VIDEO_USD_PER_SEC[model.id];
    if (!table) return out;
    const videoPerSec: Record<string, number> = {};
    for (const [res, usd] of Object.entries(table)) {
      const credits = ceilCredits(usd, marginTarget, creditUsd);
      videoPerSec[res] = credits;
      out.tiers.push({ key: res, providerUsd: usd, credits });
    }
    const def = model.videoSettings?.resolution?.def;
    const base = def != null && videoPerSec[def] != null ? videoPerSec[def] : Object.values(videoPerSec)[0];
    out.patch = { cost: base, videoPerSec, estCostUsd: estimateProviderUsd(model, {}) };
    return out;
  }
  // voice / sfx / music — sobit
  const flat = FLAT_USD[model.id];
  if (typeof flat !== "number") return out;
  const credits = ceilCredits(flat, marginTarget, creditUsd);
  out.tiers.push({ key: "per-gen", providerUsd: flat, credits });
  out.patch = { cost: credits, estCostUsd: flat };
  return out;
}

export type AutoApplyReport = {
  marginTarget: number;
  creditUsdValue: number;
  applied: Array<AutoDerived & { row: ModelPricingRow }>;
  skippedPinned: AutoDerived[];
  skippedNoCost: Array<{ modelId: number; label: string }>;
};

/**
 * "Apply target margin" — BARCHA katalog-enabled modellar bo'yicha derivatsiya + yozish.
 * Pinned modellar chetlab o'tiladi (ro'yxatda ko'rsatiladi); narx jadvali yo'q model flag'lanadi.
 */
export async function applyAutoMarginAll(updatedBy?: string | null): Promise<AutoApplyReport> {
  const { creditUsdValue, marginTarget } = await getPricingConfig();
  const report: AutoApplyReport = {
    marginTarget,
    creditUsdValue,
    applied: [],
    skippedPinned: [],
    skippedNoCost: [],
  };
  for (const model of GEN_MODELS) {
    if (model.enabled === false) continue; // faqat katalog-enabled (o'chirilganlar zaxira)
    const d = deriveAutoPricing(model, marginTarget, creditUsdValue);
    if (d.pinned) {
      report.skippedPinned.push(d);
      continue;
    }
    if (!d.patch) {
      report.skippedNoCost.push({ modelId: model.id, label: model.label });
      continue;
    }
    const row = await upsertModelPricing(model.id, d.patch, updatedBy ?? null);
    report.applied.push({ ...d, row });
  }
  return report;
}
