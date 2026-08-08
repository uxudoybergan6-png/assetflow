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
  unavailableCode: "PROVIDER_NOT_CONFIGURED" | "MODEL_DISABLED" | "PROVIDER_UNDECLARED" | null;
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
    process.env.RENDER_GIT_COMMIT?.trim() ||
    process.env.SOURCE_VERSION?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    "local";
  const catalog = models
    .map((m) => [m.id, m.mode, m.key, m.provider ?? "", m.enabled !== false, m.opType ?? ""])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const digest = crypto.createHash("sha256").update(JSON.stringify(catalog)).digest("hex").slice(0, 12);
  return `${deploy.slice(0, 12)}-${digest}`;
}
