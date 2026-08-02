/**
 * R4_05 — O'LCHANGAN (measured) provider xarajati → marja/narx POYDEVORINI o'z-o'zidan
 * kalibrlaydi. Muammo: statik `provider-cost.ts` jadvalisiz modellar (Seedream Lite 1020,
 * 4.5 1022) `DEFAULT_PROVIDER_USD=0.5` fail-safe'ga tushib panelda −229% marja ko'rsatardi.
 * Tizim ALLAQACHON real xarajatni o'lchaydi (`ProviderSpend.measuredCostUsd`, confidence
 * "measured" — BytePlus token→USD, ledger.ts). Bu modul o'sha o'lchangan qiymatni marja
 * DISPLAY va "Apply target margin" hisobiga ULAYDI — kod tahriri/deploy'siz, har yangi model.
 *
 * 🔴 PUL ZONASIGA TEGMAYDI: bu FAQAT xarajat BAZASINI (display + apply-margin kirishi) o'zgartiradi.
 * consume/refund, cost-quote imzosi (gen-quote.ts), computeGenCost/imageUnitCost, creditUsdValue —
 * HECH BIRI o'zgarmaydi. Boot pricing-floor (assert-pricing-floors.ts) kanal iqtisodini tekshiradi
 * (provider xarajatiga bog'liq emas) → o'zgarishsiz o'tadi.
 *
 * XAVFSIZLIK QOIDASI (safety rule): o'lchangan qiymat xarajat bazasini ERKIN pasaytirishi mumkin
 * (marja yaxshilanadi, obunachi narxi arzonlashadi, marja maqsadi saqlanadi). Lekin o'lchangan
 * qiymat joriy bazadan YUQORI bo'lsa — JIMGINA ko'tarilmaydi: displayда ogohlantirish ko'rsatiladi
 * (`needsConfirm`), Apply-margin uni faqat ADMIN aniq tasdiqlagach (allowRaise) qabul qiladi —
 * shunda xarajat sakrashi obunachi narxini jimgina oshirib yubormaydi.
 */
import { prisma } from "@creative-tools/database";
import type { GenModel } from "./gen-models.js";
import { getModelById, resolveImageCount, resolveVideoParams } from "./gen-models.js";
import {
  estimateProviderUsd,
  hasProviderCostEntry,
  DEFAULT_PROVIDER_USD,
} from "./provider-cost.js";

// Median uchun so'nggi N namuna (per model). Kichik N → yaqin o'zgarishga sezgir; median outlier'ni yumshatadi.
const RECENT_SAMPLES = 7;
// Apply-margin o'lchangan qiymatni QABUL QILISHI uchun min namuna. Token o'lchovi deterministik
// (byteplus token count barqaror) → 1 namuna ham ishonchli; median + plauziblik cheki qo'shimcha himoya.
export const MEASURED_SAMPLE_MIN = 1;
// "Yuqori ishonch" chegarasi (badge/telemetriya uchun) — 3+ namuna.
export const MEASURED_CONFIDENT = 3;
const EPS = 1e-6;

export type MeasuredCost = {
  /** Normalized cost: $/image, $/second or $/generation. */
  usd: number;
  samples: number;
  unit: "image" | "second" | "generation" | "character";
  tier: string | null;
};

function measurementSpec(model: GenModel): { unit: MeasuredCost["unit"]; tier: string | null } {
  if (model.mode === "image") {
    return {
      unit: "image",
      tier: model.imgSettings?.quality?.def ?? model.resolutions?.[0] ?? null,
    };
  }
  if (model.mode === "video" && model.pricing !== "per-generation") {
    return {
      unit: "second",
      tier: model.videoSettings?.resolution?.def ?? model.resolutions?.[0] ?? null,
    };
  }
  return { unit: "generation", tier: null };
}

function measuredUnitForParams(
  model: GenModel,
  params: Record<string, unknown>,
  measured: MeasuredCost,
  currentStaticUnitUsd: number
): number {
  if (!measured.tier) return measured.usd;
  const measuredTierParams =
    model.mode === "image"
      ? { ...params, quality: measured.tier, count: 1, num_images: 1 }
      : { ...params, resolution: measured.tier };
  const measuredTierTotal = estimateProviderUsd(model, measuredTierParams) ?? 0;
  const measuredTierStaticUnit = staticUnitForParams(model, measuredTierParams, measuredTierTotal);
  if (!(measuredTierStaticUnit > 0) || !(currentStaticUnitUsd > 0)) return measured.usd;
  return round4(measured.usd * (currentStaticUnitUsd / measuredTierStaticUnit));
}

function measuredTotalForParams(
  model: GenModel,
  params: Record<string, unknown>,
  unitUsd: number
): number {
  if (model.mode === "image") return round4(unitUsd * resolveImageCount(model, params));
  if (model.mode === "video" && model.pricing !== "per-generation") {
    return round4(unitUsd * resolveVideoParams(model, params).duration);
  }
  return round4(unitUsd);
}

function staticUnitForParams(
  model: GenModel,
  params: Record<string, unknown>,
  totalUsd: number
): number {
  if (model.mode === "image") return round4(totalUsd / Math.max(1, resolveImageCount(model, params)));
  if (model.mode === "video" && model.pricing !== "per-generation") {
    return round4(totalUsd / Math.max(1, resolveVideoParams(model, params).duration));
  }
  return round4(totalUsd);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

/**
 * Bitta model uchun NORMALIZED o'lchangan xarajat: default tier + pricing unit bir xil bo'lgan
 * so'nggi N namunaning medianasi. Eski total-only yozuvlar ataylab olinmaydi.
 */
export async function getMeasuredProviderUsd(
  modelId: number,
  limit = RECENT_SAMPLES
): Promise<MeasuredCost | null> {
  const model = getModelById(modelId);
  if (!model) return null;
  const spec = measurementSpec(model);
  try {
    const rows = await prisma.providerSpend.findMany({
      where: {
        modelId,
        confidence: "measured",
        measuredUnitCostUsd: { gt: 0 },
        measuredUnit: spec.unit,
        measurementTier: spec.tier,
      },
      select: { measuredUnitCostUsd: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const vals = rows
      .map((r) => Number(r.measuredUnitCostUsd))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (!vals.length) return null;
    return { usd: round4(median(vals)), samples: vals.length, unit: spec.unit, tier: spec.tier };
  } catch (e) {
    console.error("getMeasuredProviderUsd", e);
    return null;
  }
}

/**
 * BATCH — barcha modellar uchun o'lchangan xarajat (bitta so'rov, JS'da per-model N kesish).
 * Admin GET /pricing panelida har qatorда per-model so'rovni oldini oladi.
 */
export async function getMeasuredProviderUsdMap(
  limit = RECENT_SAMPLES
): Promise<Map<number, MeasuredCost>> {
  const out = new Map<number, MeasuredCost>();
  try {
    const rows = await prisma.providerSpend.findMany({
      where: { confidence: "measured", measuredUnitCostUsd: { gt: 0 }, modelId: { not: null } },
      select: { modelId: true, measuredUnitCostUsd: true, measuredUnit: true, measurementTier: true },
      orderBy: { createdAt: "desc" },
    });
    const byModel = new Map<number, number[]>();
    for (const r of rows) {
      const id = r.modelId as number;
      const model = getModelById(id);
      if (!model) continue;
      const spec = measurementSpec(model);
      if (r.measuredUnit !== spec.unit || (r.measurementTier ?? null) !== spec.tier) continue;
      const arr = byModel.get(id) ?? [];
      if (arr.length < limit) {
        const v = Number(r.measuredUnitCostUsd);
        if (Number.isFinite(v) && v > 0) arr.push(v);
        byModel.set(id, arr);
      }
    }
    for (const [id, vals] of byModel) {
      const sorted = vals.slice().sort((a, b) => a - b);
      if (sorted.length) {
        const model = getModelById(id);
        if (!model) continue;
        const spec = measurementSpec(model);
        out.set(id, { usd: round4(median(sorted)), samples: sorted.length, unit: spec.unit, tier: spec.tier });
      }
    }
  } catch (e) {
    console.error("getMeasuredProviderUsdMap", e);
  }
  return out;
}

export type ProviderCostSource = "measured" | "table" | "estimate";

export type ResolvedProviderCost = {
  /** Yechilgan (ishlatiladigan) provider USD — safety qoidasidan keyingi baza. */
  usd: number;
  /** Same cost normalized to the model's pricing unit. */
  unitUsd: number;
  unit: MeasuredCost["unit"];
  tier: string | null;
  /** estimateProviderUsd (statik jadval yoki DEFAULT fail-safe) — (b)/(c) fallback. */
  staticUsd: number;
  staticUnitUsd: number;
  /** So'nggi o'lchangan median (yo'q → null) — display/ogohlantirish uchun har doim beriladi. */
  measuredUsd: number | null;
  samples: number;
  source: ProviderCostSource;
  /** true → o'lchangan xarajat joriy bazadan YUQORI (xarajat oshgan) va hali tasdiqlanmagan. */
  needsConfirm: boolean;
};

/**
 * SYNC yadro: model + oldindan olingan measured qiymat → yechilgan xarajat.
 * Tartib: (a) measured (namuna ≥ MEASURED_SAMPLE_MIN, safety qoidasi) → (b) statik jadval →
 * (c) DEFAULT_PROVIDER_USD. `opts.allowRaise` = measured baza YUQORI bo'lsa ham qabul qilinsin
 * (admin aniq tasdiqlagan — apply-margin confirm yo'li).
 */
export function computeResolvedProviderCost(
  model: GenModel,
  params: Record<string, unknown>,
  measured: MeasuredCost | null,
  opts?: { allowRaise?: boolean }
): ResolvedProviderCost {
  const staticUsd = estimateProviderUsd(model, params) ?? DEFAULT_PROVIDER_USD;
  const spec = measurementSpec(model);
  const staticUnitUsd = staticUnitForParams(model, params, staticUsd);
  const hasTable = hasProviderCostEntry(model);
  const fallbackSource: ProviderCostSource = hasTable ? "table" : "estimate";

  // ⚠️ ISHONCH: VIDEO token→USD ($4.30/1M, BATCH5 real invoice bilan TASDIQLANGAN) → measured'ga
  // to'liq ishonamiz. IMAGE token→USD esa TASDIQLANMAGAN: Seedream rasm FLAT per-tier billing qilinadi
  // (token = piksel/hisob metrikasi, dollar emas — jonli tekshiruv 2026-07-20: Pro 1K=4096tok bo'lsa ham
  // konsol $0.045, token×rate=$0.0176 ≈ 2.5× past). Shu sabab RASM uchun token-measured'ni FAQAT statik
  // jadvali YO'Q modelda (Seedream Lite/4.5 → $0.5 fail-safe'dan qutulish; owner aytgan ~$0.045-0.09'ga
  // mos) ishlatamiz; jadvali BOR rasm modelda (Pro) measured JADVALNI PASAYTIRMAYDI (underprice xavfi).
  const trustMeasured = model.mode !== "image" || !hasTable;

  if (trustMeasured && measured && measured.samples >= MEASURED_SAMPLE_MIN && measured.usd > 0) {
    const measuredUnitUsd = measuredUnitForParams(model, params, measured, staticUnitUsd);
    const measuredTotalUsd = measuredTotalForParams(model, params, measuredUnitUsd);
    const rose = measuredUnitUsd > staticUnitUsd + EPS;
    if (!rose || opts?.allowRaise) {
      // Pasaytiradi (yoki teng) → ERKIN qabul; yoki admin ko'tarishni tasdiqlagan.
      return {
        usd: measuredTotalUsd,
        unitUsd: measuredUnitUsd,
        unit: measured.unit,
        tier: spec.tier,
        staticUsd,
        staticUnitUsd,
        measuredUsd: measured.usd,
        samples: measured.samples,
        source: "measured",
        needsConfirm: false,
      };
    }
    // O'lchangan YUQORI + tasdiq yo'q → baza statik qoladi, lekin ogohlantirish uchun measured beriladi.
    return {
      usd: staticUsd,
      unitUsd: staticUnitUsd,
      unit: spec.unit,
      tier: spec.tier,
      staticUsd,
      staticUnitUsd,
      measuredUsd: measured.usd,
      samples: measured.samples,
      source: fallbackSource,
      needsConfirm: true,
    };
  }

  return {
    usd: staticUsd,
    unitUsd: staticUnitUsd,
    unit: spec.unit,
    tier: spec.tier,
    staticUsd,
    staticUnitUsd,
    measuredUsd: measured?.usd ?? null,
    samples: measured?.samples ?? 0,
    source: fallbackSource,
    needsConfirm: false,
  };
}

/**
 * ASYNC qulaylik: measured'ni DB'dan oladi (yoki opts.measured berilsa uni ishlatadi) va
 * yechilgan xarajatni qaytaradi. Panel + apply-margin ikkalasi SHUNI ishlatadi.
 */
export async function resolveProviderUsd(
  model: GenModel,
  params: Record<string, unknown> = {},
  opts?: { allowRaise?: boolean; measured?: MeasuredCost | null }
): Promise<ResolvedProviderCost> {
  const measured =
    opts && "measured" in opts ? (opts.measured ?? null) : await getMeasuredProviderUsd(model.id);
  return computeResolvedProviderCost(model, params, measured, { allowRaise: opts?.allowRaise });
}
