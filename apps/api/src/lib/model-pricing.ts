/**
 * NARX DVIGATELI (Bosqich 3.4) — DB-backed kredit narx MANBAI.
 *
 * Ilgari narx FAQAT gen-models.ts statik katalogidan olinardi. Endi HAQIQAT MANBAI —
 * `ModelPricing` DB jadvali; qator YO'Q bo'lsa statik gen-models.ts qiymatiga QAYTADI
 * (fallback). Seed startup'da statik qiymatlardan create-only upsert bilan to'ldiriladi →
 * narx BUGUNGI bilan AYNAN bir xil (foydalanuvchiga narx o'zgarmaydi).
 *
 * PUL ZONASIGA TEGMAYDI: bu modul faqat narx MANBAINI ko'chiradi. computeGenCost,
 * consume/refund, cost-quote imzosi (signCostQuote/verifyCostQuote) — HECH BIRI o'zgarmaydi.
 * Imzo hal qilingan yakuniy narxni qamrab oladi (DB'dan kelgani ham, statikdan kelgani ham).
 *
 * Ishlash naqshi: cost-quote `resolvePricedModel(model)` bilan model NUSXASINI oladi
 * (cost/qualityCost/videoPerSec DB'dan ustma-ust yozilgan), so'ng MAVJUD computeGenCost'ni
 * shu nusxaga chaqiradi. Barcha param-klamplash mantig'i o'zgarmasdan ishlaydi.
 */
import { prisma, Prisma } from "@creative-tools/database";
import type { GenModel } from "./gen-models.js";
import { GEN_MODELS } from "./gen-models.js";
import { estimateProviderUsd } from "./provider-cost.js";

// Kredit qiymat langari: PRO $19 / 1000 kredit = $0.019/kredit (plugin-profile.ts allotment).
const DEFAULT_CREDIT_USD = 0.019;
const DEFAULT_MARGIN_TARGET = 1.8;

function envNum(name: string, def: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : def;
}

export type ModelPricingRow = {
  modelId: number;
  mode: string;
  label: string | null;
  cost: number;
  pricing: string | null;
  qualityCost: Record<string, number> | null;
  videoPerSec: Record<string, number> | null;
  estCostUsd: number | null;
  enabled: boolean;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: Date;
};

function toNumberMap(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(val);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

function toRow(r: {
  modelId: number;
  mode: string;
  label: string | null;
  cost: number;
  pricing: string | null;
  qualityCost: unknown;
  videoPerSec: unknown;
  estCostUsd: Prisma.Decimal | null;
  enabled: boolean;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}): ModelPricingRow {
  return {
    modelId: r.modelId,
    mode: r.mode,
    label: r.label,
    cost: r.cost,
    pricing: r.pricing,
    qualityCost: toNumberMap(r.qualityCost),
    videoPerSec: toNumberMap(r.videoPerSec),
    estCostUsd: r.estCostUsd == null ? null : Number(r.estCostUsd),
    enabled: r.enabled,
    notes: r.notes,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt,
  };
}

// ── Cache (single-instance; spend-guard naqshi). PATCH invalidatePricingCache() chaqiradi ──
let cache: Map<number, ModelPricingRow> | null = null;
let cacheAt = 0;
const TTL_MS = 15_000;

export function invalidatePricingCache(): void {
  cache = null;
  cacheAt = 0;
}

async function loadCache(): Promise<Map<number, ModelPricingRow>> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  try {
    const rows = await prisma.modelPricing.findMany();
    const map = new Map<number, ModelPricingRow>();
    for (const r of rows) map.set(r.modelId, toRow(r));
    cache = map;
    cacheAt = now;
    return map;
  } catch (e) {
    // DB yiqilsa yoki jadval hali yo'q bo'lsa — statik fallback (bo'sh map → applyRow no-op).
    console.error("[model-pricing] cache yuklashda xato (statik fallback):", e);
    return cache ?? new Map();
  }
}

/**
 * DB narx qatorini model NUSXASIGA ustma-ust yozadi (cost/qualityCost/videoPerSec/pricing).
 * Nested deskriptorlarni ham (imgSettings.quality.cost, videoSettings.resolution.perSec)
 * yangilaydi — chunki imageUnitCost/computeGenCost ularni tekis fielddan USTUN qo'yadi.
 */
function applyRow(model: GenModel, row?: ModelPricingRow): GenModel {
  if (!row) return model;
  const m: GenModel = { ...model, cost: row.cost };
  if (row.pricing === "per-second" || row.pricing === "per-generation") m.pricing = row.pricing;
  if (row.qualityCost) {
    m.qualityCost = row.qualityCost;
    if (m.imgSettings?.quality) {
      m.imgSettings = {
        ...m.imgSettings,
        quality: { ...m.imgSettings.quality, cost: row.qualityCost },
      };
    }
  }
  if (row.videoPerSec && m.videoSettings?.resolution) {
    m.videoSettings = {
      ...m.videoSettings,
      resolution: { ...m.videoSettings.resolution, perSec: row.videoPerSec },
    };
  }
  return m;
}

/** Model uchun DB narxi qo'llangan nusxa (qator yo'q → statik model o'zgarishsiz). */
export async function resolvePricedModel(model: GenModel): Promise<GenModel> {
  const map = await loadCache();
  return applyRow(model, map.get(model.id));
}

/** modelId bo'yicha DB narx qatori (yo'q → null). Admin GET/PATCH uchun. */
export async function getPricingRow(modelId: number): Promise<ModelPricingRow | null> {
  const map = await loadCache();
  return map.get(modelId) ?? null;
}

/** Global narx sozlamasi (singleton) — creditUsdValue + marginTarget. DB yo'q → env/default. */
export async function getPricingConfig(): Promise<{
  creditUsdValue: number;
  marginTarget: number;
}> {
  try {
    const row = await prisma.pricingConfig.findUnique({ where: { id: "singleton" } });
    return {
      creditUsdValue: row ? Number(row.creditUsdValue) : envNum("PRICING_CREDIT_USD_VALUE", DEFAULT_CREDIT_USD),
      marginTarget: row ? Number(row.marginTarget) : envNum("PRICING_MARGIN_TARGET", DEFAULT_MARGIN_TARGET),
    };
  } catch {
    return {
      creditUsdValue: envNum("PRICING_CREDIT_USD_VALUE", DEFAULT_CREDIT_USD),
      marginTarget: envNum("PRICING_MARGIN_TARGET", DEFAULT_MARGIN_TARGET),
    };
  }
}

// ── SEED (startup, create-only) ──────────────────────────────────────────────
/** Statik GenModel'dan seed qatori — narx ta'rifi AYNAN gen-models.ts qiymatlaridan. */
function seedRowFromModel(model: GenModel): Prisma.ModelPricingCreateManyInput {
  const qualityCost = model.imgSettings?.quality?.cost ?? model.qualityCost ?? null;
  const videoPerSec = model.videoSettings?.resolution?.perSec ?? null;
  const pricing = model.pricing ?? (model.mode === "video" ? "per-second" : null);
  const est = estimateProviderUsd(model, {}); // vakil (default param) real USD taxmini
  return {
    modelId: model.id,
    mode: model.mode,
    label: model.label,
    cost: model.cost,
    pricing,
    qualityCost: qualityCost ?? Prisma.DbNull,
    videoPerSec: videoPerSec ?? Prisma.DbNull,
    estCostUsd: est == null ? null : new Prisma.Decimal(est),
    enabled: model.enabled !== false,
  };
}

/**
 * ModelPricing'ni gen-models.ts joriy qiymatlaridan to'ldiradi (IDEMPOTENT, create-only).
 * skipDuplicates → mavjud qatorni (admin tahririni) USTIGA YOZMAYDI. Yangi model qo'shilsa
 * keyingi startup'da uning qatori qo'shiladi. PricingConfig singleton ham yaratiladi.
 */
export async function seedModelPricing(): Promise<{ created: number; total: number }> {
  const data = GEN_MODELS.map(seedRowFromModel);
  const result = await prisma.modelPricing.createMany({ data, skipDuplicates: true });
  await prisma.pricingConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  invalidatePricingCache();
  return { created: result.count, total: data.length };
}
