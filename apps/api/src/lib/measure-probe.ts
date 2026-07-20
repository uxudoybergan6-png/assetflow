/**
 * R4_06 — Admin "Measure cost" probasi. Model'ni ENG ARZON tier'da BIR MARTA real generatsiya
 * qilib, provayder qaytargan usage (token)dan real USD xarajatini o'lchaydi va uni measured
 * ProviderSpend qatori sifatida yozadi (R4_05 resolveProviderUsd shundan o'qiydi → panel + apply-margin
 * o'z-o'zidan kalibrlaydi). Admin aniq bosadi (tasdiq dialogi bilan) — kredit YECHILMAYDI (bu
 * subscriber oqimi emas, to'g'ridan provayder chaqiruvi); faqat provayderda kichik pul sarflanadi.
 *
 * 🔴 PUL ZONASIGA TEGMAYDI: consume/refund/cost-quote/HMAC/computeGenCost — hech biri chaqirilmaydi.
 * Faqat provayder adapteri + measured ProviderSpend yozuvi (analitika).
 *
 * QO'LLAB-QUVVATLASH: BytePlus (Seedream rasm + Seedance video) — usage.total_tokens qaytaradi
 * (billing token bilan). Boshqa provayderlar per-gen token xarajat signalini bermaydi → UNSUPPORTED.
 */
import { prisma } from "@creative-tools/database";
import { getModelById, resolveVideoParams, type GenModel } from "./gen-models.js";
import {
  byteplusImage,
  byteplusSubmitVideoTask,
  byteplusPollStep,
  buildByteplusVideoBody,
  isByteplusConfigured,
} from "./ai/byteplus.js";
import { byteplusTokensToUsd } from "./ledger.js";
import { getMeasuredProviderUsd } from "./measured-cost.js";

export type MeasureProbeResult = {
  ok: boolean;
  code?: "UNSUPPORTED" | "NOT_CONFIGURED" | "DISABLED" | "PROVIDER_ERROR" | "NO_USAGE";
  modelId: number;
  label: string;
  provider: string;
  usd?: number; // shu probaning o'lchangan xarajati
  tokens?: number;
  tier?: string;
  samples?: number; // yozgandan keyingi jami measured namunalar (median panel uchun)
  measuredUsd?: number | null; // yangilangan median (getMeasuredProviderUsd)
  error?: string;
};

const PROBE_PROMPT = "a small red apple on a plain white background, product photo";

function lowestImageTier(model: GenModel): string | undefined {
  const opts = model.imgSettings?.quality?.options ?? model.resolutions ?? [];
  return opts.length ? opts[0] : undefined; // katalog tartibi: eng past tier birinchi
}
function lowestVideoRes(model: GenModel): string | undefined {
  const opts = model.videoSettings?.resolution?.options ?? model.resolutions ?? [];
  return opts.length ? opts[0] : undefined;
}
function shortestDuration(model: GenModel): number {
  const ds = (model.durations ?? []).filter((n) => Number.isFinite(n) && n > 0);
  return ds.length ? Math.min(...ds) : 4;
}

/** Measured ProviderSpend qatorini to'g'ridan yozadi (proba — generationId yo'q). */
async function writeProbeMeasured(model: GenModel, usd: number): Promise<void> {
  await prisma.providerSpend.create({
    data: {
      generationId: null,
      provider: model.provider ?? "byteplus",
      modelId: model.id,
      mode: model.mode,
      credits: null,
      estimatedCostUsd: usd,
      measuredCostUsd: usd,
      confidence: "measured",
    },
  });
}

/**
 * Bitta model uchun cost proba. BytePlus rasm/video'ni eng past tier'da chaqiradi, usage'dan
 * USD o'lchaydi va measured qator yozadi. Xato bo'lsa hech nima yozmaydi (best-effort).
 */
export async function probeModelCost(modelId: number): Promise<MeasureProbeResult> {
  const model = getModelById(modelId);
  if (!model) return { ok: false, code: "UNSUPPORTED", modelId, label: `model ${modelId}`, provider: "?", error: "Unknown model" };
  const base = { modelId, label: model.label, provider: model.provider ?? "?" };
  if (model.enabled === false) return { ok: false, code: "DISABLED", ...base, error: "Model is disabled" };
  if (model.provider !== "byteplus")
    return {
      ok: false,
      code: "UNSUPPORTED",
      ...base,
      error: "Measure-cost probe supports BytePlus models only (they return per-gen token usage). Other providers must be priced from their table.",
    };
  if (!isByteplusConfigured()) return { ok: false, code: "NOT_CONFIGURED", ...base, error: "BYTEPLUS_API_KEY missing" };

  try {
    if (model.mode === "image") {
      const tier = lowestImageTier(model);
      const r = await byteplusImage(model.byteplusModel ?? model.key, {
        prompt: PROBE_PROMPT,
        size: tier,
      });
      if (!r.ok) return { ok: false, code: "PROVIDER_ERROR", ...base, tier, error: r.error };
      const tokens = Number(r.usage?.total_tokens) || 0;
      const usd = byteplusTokensToUsd(tokens);
      if (!(usd > 0)) return { ok: false, code: "NO_USAGE", ...base, tier, error: "Provider returned no usable token usage" };
      await writeProbeMeasured(model, usd);
      const agg = await getMeasuredProviderUsd(model.id);
      return { ok: true, ...base, usd, tokens, tier, samples: agg?.samples ?? 1, measuredUsd: agg?.usd ?? usd };
    }

    if (model.mode === "video") {
      const resolution = lowestVideoRes(model);
      const duration = shortestDuration(model);
      const vp = resolveVideoParams(model, { resolution, duration: String(duration), audio: false });
      const body = buildByteplusVideoBody(model, PROBE_PROMPT, vp, {});
      const sub = await byteplusSubmitVideoTask(model.byteplusModel ?? model.key, body);
      if (!sub.ok) return { ok: false, code: "PROVIDER_ERROR", ...base, tier: resolution, error: sub.error };
      const taskId = sub.data.taskId;
      // Poll to completion — usage faqat completed'da keladi. ~5 daq cheklov (proba kichik/qisqa).
      for (let i = 0; i < 60; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        const step = await byteplusPollStep(taskId);
        if (!step.ok) return { ok: false, code: "PROVIDER_ERROR", ...base, tier: resolution, error: step.error };
        if (step.data.state === "completed") {
          const tokens = Number(step.data.data.usage?.total_tokens) || 0;
          const usd = byteplusTokensToUsd(tokens);
          if (!(usd > 0)) return { ok: false, code: "NO_USAGE", ...base, tier: resolution, error: "Provider returned no usable token usage" };
          await writeProbeMeasured(model, usd);
          const agg = await getMeasuredProviderUsd(model.id);
          return { ok: true, ...base, usd, tokens, tier: resolution, samples: agg?.samples ?? 1, measuredUsd: agg?.usd ?? usd };
        }
      }
      return { ok: false, code: "PROVIDER_ERROR", ...base, tier: resolution, error: "Probe timed out waiting for the video job" };
    }

    return { ok: false, code: "UNSUPPORTED", ...base, error: `Measure-cost is not supported for mode "${model.mode}"` };
  } catch (e) {
    return { ok: false, code: "PROVIDER_ERROR", ...base, error: (e as Error).message || "Probe failed" };
  }
}
