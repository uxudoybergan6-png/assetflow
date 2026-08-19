import crypto from "crypto";
import type { GenModel } from "./gen-models.js";
import { GEN_MODELS } from "./gen-models.js";
import { isOpenRouterConfigured } from "./ai/openrouter.js";
import { isElevenLabsConfigured } from "./ai/elevenlabs.js";
import { isFalConfigured } from "./ai/fal.js";
import { isByteplusConfigured } from "./ai/byteplus.js";
import { isKlingConfigured } from "./ai/kling.js";
import { isTopazConfigured } from "./ai/topaz.js";
import { isVertexConfigured } from "./ai/vertex.js";
import { isVertexOmniConfigured } from "./ai/vertex-omni.js";
import { isVertexImageConfigured } from "./ai/vertex-image.js";
import { isGoogleTtsConfigured } from "./ai/google-tts.js";
import { isMagnificConfigured } from "./ai/magnific.js";

export type GenProvider = NonNullable<GenModel["provider"]>;
export type ProviderConfiguration = Record<GenProvider, boolean>;

type RuntimeProviderBlock = {
  until: number;
  reason: string;
};

// Env'da kalit borligi provayder amalda ishlayotganini anglatmaydi: kalit bekor
// qilingan, ADC IAM olib tashlangan yoki obuna tugagan bo'lishi mumkin. Processor
// aniq auth/config xatosini ko'rgach shu instansda qisqa circuit ochadi; keyingi
// quote/gen so'rovlari yana kredit band qilib, aynan bir xil xatoga yugurmaydi.
const runtimeProviderBlocks = new Map<GenProvider, RuntimeProviderBlock>();
const PROVIDER_BLOCK_MS = Math.max(
  30_000,
  Number(process.env.GEN_PROVIDER_BLOCK_MS) || 2 * 60_000
);

/** Faqat aniq, retry bilan tuzalmaydigan provider auth/config xatosini circuit'ga oladi. */
export function noteProviderFailure(provider: GenModel["provider"], error: unknown): boolean {
  if (!provider) return false;
  const raw = error instanceof Error ? error.message : String(error || "");
  const permanent =
    /_NOT_CONFIGURED\b|provider not available|UNAUTHENTICATED|PERMISSION_DENIED|\bHTTP\s*401\b|\b401\b.{0,40}(?:unauthorized|auth)|(?:invalid|missing|expired).{0,32}(?:api[- ]?key|token|credential)|(?:api[- ]?key|token|credential).{0,32}(?:invalid|missing|expired)/i.test(
      raw
    );
  if (!permanent) return false;
  runtimeProviderBlocks.set(provider, {
    until: Date.now() + PROVIDER_BLOCK_MS,
    reason: "Model provider authentication or configuration is temporarily unavailable",
  });
  return true;
}

/** Muvaffaqiyatli provider natijasi eski runtime circuit'ni darhol yopadi. */
export function noteProviderSuccess(provider: GenModel["provider"]): void {
  if (provider) runtimeProviderBlocks.delete(provider);
}

function runtimeProviderBlock(provider: GenProvider): RuntimeProviderBlock | null {
  const block = runtimeProviderBlocks.get(provider);
  if (!block) return null;
  if (block.until <= Date.now()) {
    runtimeProviderBlocks.delete(provider);
    return null;
  }
  return block;
}

/**
 * Provider konfiguratsiyasining yagona, secret bermaydigan snapshot'i.
 * Yangi provider GenModel union'iga qo'shilsa bu Record compile-time xato beradi.
 */
export function providerConfigurationSnapshot(): ProviderConfiguration {
  return {
    openrouter: isOpenRouterConfigured(),
    freepik: Boolean(process.env.FREEPIK_API_KEY?.trim()),
    elevenlabs: isElevenLabsConfigured(),
    magnific: isMagnificConfigured(),
    fal: isFalConfigured(),
    vertex: isVertexConfigured(),
    "vertex-omni": isVertexOmniConfigured(),
    "vertex-image": isVertexImageConfigured(),
    "google-tts": isGoogleTtsConfigured(),
    byteplus: isByteplusConfigured(),
    kling: isKlingConfigured(),
    topaz: isTopazConfigured(),
  };
}

export type ModelAvailability = {
  available: boolean;
  provider: GenProvider | null;
  unavailableCode:
    | "PROVIDER_NOT_CONFIGURED"
    | "PROVIDER_UNAVAILABLE"
    | "MODEL_DISABLED"
    | "PROVIDER_UNDECLARED"
    | null;
  unavailableReason: string | null;
};

/**
 * Katalog, quote va generation aynan shu resolverni ishlatadi.
 * `provider` berilmagan legacy entry fail-closed: yangi model provider'ini unutib qo'yish
 * OpenRouter'ga tasodifan tushmaydi. Joriy provider-siz entrylarning barchasi disabled.
 */
export function resolveModelAvailability(
  model: GenModel | undefined,
  configured: ProviderConfiguration = providerConfigurationSnapshot()
): ModelAvailability {
  if (!model || model.enabled === false) {
    return {
      available: false,
      provider: model?.provider ?? null,
      unavailableCode: "MODEL_DISABLED",
      unavailableReason: "Model is currently disabled",
    };
  }
  if (!model.provider) {
    return {
      available: false,
      provider: null,
      unavailableCode: "PROVIDER_UNDECLARED",
      unavailableReason: "Model provider is not declared",
    };
  }
  if (!configured[model.provider]) {
    return {
      available: false,
      provider: model.provider,
      unavailableCode: "PROVIDER_NOT_CONFIGURED",
      unavailableReason: "Model provider is temporarily unavailable",
    };
  }
  const runtimeBlock = runtimeProviderBlock(model.provider);
  if (runtimeBlock) {
    return {
      available: false,
      provider: model.provider,
      unavailableCode: "PROVIDER_UNAVAILABLE",
      unavailableReason: runtimeBlock.reason,
    };
  }
  return {
    available: true,
    provider: model.provider,
    unavailableCode: null,
    unavailableReason: null,
  };
}

export function isProviderConfigured(
  provider: GenModel["provider"],
  configured: ProviderConfiguration = providerConfigurationSnapshot()
): boolean {
  return provider ? configured[provider] === true : false;
}

/** Safe deploy/catalog fingerprint; credential yoki narx override qiymatlarini ochmaydi. */
export function genCatalogVersion(models: GenModel[] = GEN_MODELS): string {
  const deploy =
    process.env.K_REVISION?.trim() ||
    process.env.RENDER_GIT_COMMIT?.trim() ||
    process.env.SOURCE_VERSION?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    "local";
  const catalog = models
    .map((m) => [
      m.id,
      m.mode,
      m.key,
      m.provider ?? "",
      m.enabled !== false,
      m.opType ?? "",
      m.cost,
      m.pricing ?? "",
      m.qualityCost ?? m.imgSettings?.quality?.cost ?? null,
      m.videoSettings?.resolution?.perSec ?? null,
    ])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const digest = crypto.createHash("sha256").update(JSON.stringify(catalog)).digest("hex").slice(0, 12);
  return `${deploy.slice(0, 12)}-${digest}`;
}
