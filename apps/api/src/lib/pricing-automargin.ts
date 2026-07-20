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
import { resolveProviderUsd, type ProviderCostSource } from "./measured-cost.js";
import {
  getPricingConfig,
  upsertModelPricing,
  type PricingPatch,
  type ModelPricingRow,
} from "./model-pricing.js";

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

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

// ── R4_05 — MEASURED-AWARE derivatsiya ───────────────────────────────────────
// Statik jadval o'rniga resolveProviderUsd (measured → statik → default, safety qoidasi bilan).
// Model o'lchangan (measured) xarajatga ega bo'lsa, per-tier narx measured'ga LANGARLANIB, tier
// nisbatlari statik jadval yoki katalog kredit nisbatidan olinadi (measured per-model — tier saqlamaydi).

export type AutoDerivedResolved = AutoDerived & {
  providerCostSource: ProviderCostSource;
  measuredUsd: number | null;
  samples: number;
  needsConfirm: boolean; // measured baza YUQORI + tasdiq yo'q → bulk apply chetlab o'tadi
};

/** Model tier tuzilishi + nisbat manbai (statik USD jadvali > katalog kredit nisbati > yagona tier). */
function tierRatios(
  model: GenModel
): { keys: string[]; def: string; ratio: Record<string, number> } | null {
  if (model.mode === "image") {
    const staticTable = IMAGE_USD_PER_UNIT[model.id];
    const catalog = model.imgSettings?.quality?.cost ?? model.qualityCost ?? null;
    const src = staticTable ?? catalog;
    if (!src) return null;
    const keys = Object.keys(src);
    if (!keys.length) return null;
    const def = model.imgSettings?.quality?.def ?? keys[0];
    return { keys, def: keys.includes(def) ? def : keys[0], ratio: { ...(src as Record<string, number>) } };
  }
  if (model.mode === "video") {
    if (model.pricing === "per-generation") return { keys: ["per-gen"], def: "per-gen", ratio: { "per-gen": 1 } };
    const staticTable = VIDEO_USD_PER_SEC[model.id];
    const catalog = model.videoSettings?.resolution?.perSec ?? null;
    const src = staticTable ?? catalog;
    if (!src) return null;
    const keys = Object.keys(src);
    if (!keys.length) return null;
    const def = model.videoSettings?.resolution?.def ?? keys[0];
    return { keys, def: keys.includes(def) ? def : keys[0], ratio: { ...(src as Record<string, number>) } };
  }
  return { keys: ["per-gen"], def: "per-gen", ratio: { "per-gen": 1 } };
}

/**
 * Measured-aware derivatsiya. resolveProviderUsd manbasi:
 *  - "measured" → per-tier narx measured'ga langarlanib qayta quriladi (tier nisbati tierRatios'dan).
 *  - "table"/"estimate" → MAVJUD statik deriveAutoPricing AYNAN qaytariladi (money-safe: joriy
 *    narxlangan modellar xatti-harakati bayt-bir-xil). needsConfirm=true bo'lsa (measured YUQORI,
 *    tasdiq yo'q) — statik qoladi va bulk apply uni chetlab o'tadi.
 */
export async function deriveAutoPricingResolved(
  model: GenModel,
  marginTarget: number,
  creditUsd: number,
  opts?: { confirm?: boolean }
): Promise<AutoDerivedResolved> {
  const resolved = await resolveProviderUsd(model, {}, { allowRaise: !!opts?.confirm });
  const base = deriveAutoPricing(model, marginTarget, creditUsd);
  const meta = {
    providerCostSource: resolved.source,
    measuredUsd: resolved.measuredUsd,
    samples: resolved.samples,
    needsConfirm: resolved.needsConfirm,
  };
  if (resolved.source !== "measured") return { ...base, ...meta };

  // Measured qabul qilindi → per-tier qayta qurish (measured'ga langar).
  const tiers = tierRatios(model);
  if (!tiers) {
    const credits = ceilCredits(resolved.usd, marginTarget, creditUsd);
    return {
      ...base,
      tiers: [{ key: "per-gen", providerUsd: resolved.usd, credits }],
      patch: { cost: credits, estCostUsd: resolved.usd },
      ...meta,
    };
  }
  const defRatio = tiers.ratio[tiers.def] || 1;
  const outTiers: AutoDerived["tiers"] = [];
  const costMap: Record<string, number> = {};
  for (const k of tiers.keys) {
    const usd = round4((resolved.usd * (tiers.ratio[k] || defRatio)) / defRatio);
    const credits = ceilCredits(usd, marginTarget, creditUsd);
    costMap[k] = credits;
    outTiers.push({ key: k, providerUsd: usd, credits });
  }
  const baseCost = costMap[tiers.def] ?? Object.values(costMap)[0];
  let patch: PricingPatch;
  if (model.mode === "image") {
    patch = { cost: baseCost, qualityCost: tiers.keys.length > 1 ? costMap : null, estCostUsd: resolved.usd };
  } else if (model.mode === "video" && model.pricing !== "per-generation") {
    patch = { cost: baseCost, videoPerSec: costMap, estCostUsd: resolved.usd };
  } else {
    patch = { cost: baseCost, estCostUsd: resolved.usd };
  }
  return { ...base, tiers: outTiers, patch, ...meta };
}

export type AutoApplyReport = {
  marginTarget: number;
  creditUsdValue: number;
  applied: Array<AutoDerivedResolved & { row: ModelPricingRow }>;
  skippedPinned: AutoDerived[];
  skippedNoCost: Array<{ modelId: number; label: string }>;
  // R4_05 — o'lchangan xarajat joriy bazadan YUQORI (needsConfirm) → tasdiqsiz REPRICE qilinmaydi.
  skippedNeedsConfirm: Array<{ modelId: number; label: string; measuredUsd: number | null; staticUsd: number }>;
};

/**
 * "Apply target margin" — BARCHA katalog-enabled modellar bo'yicha derivatsiya + yozish.
 * Pinned modellar chetlab o'tiladi (ro'yxatda ko'rsatiladi); narx jadvali yo'q model flag'lanadi.
 */
export async function applyAutoMarginAll(
  updatedBy?: string | null,
  opts?: { confirmModelIds?: number[] }
): Promise<AutoApplyReport> {
  const { creditUsdValue, marginTarget } = await getPricingConfig();
  const confirmSet = new Set(opts?.confirmModelIds ?? []);
  const report: AutoApplyReport = {
    marginTarget,
    creditUsdValue,
    applied: [],
    skippedPinned: [],
    skippedNoCost: [],
    skippedNeedsConfirm: [],
  };
  for (const model of GEN_MODELS) {
    if (model.enabled === false) continue; // faqat katalog-enabled (o'chirilganlar zaxira)
    // R4_05 — measured-aware (safety qoidasi bilan). Confirm ro'yxatidagi model xarajat ko'tarilishini qabul qiladi.
    const d = await deriveAutoPricingResolved(model, marginTarget, creditUsdValue, {
      confirm: confirmSet.has(model.id),
    });
    if (d.pinned) {
      report.skippedPinned.push(d);
      continue;
    }
    if (d.needsConfirm) {
      // O'lchangan xarajat statik bazadan YUQORI + admin tasdiqlamagan → JIMGINA narx oshirilmaydi.
      report.skippedNeedsConfirm.push({
        modelId: model.id,
        label: model.label,
        measuredUsd: d.measuredUsd,
        staticUsd: estimateProviderUsd(model, {}) ?? 0,
      });
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
