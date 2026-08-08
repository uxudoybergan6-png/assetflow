import type { GenModel } from "./gen-models.js";
import {
  getRefKind,
  getReferenceMode,
  modelAcceptsReference,
  modelSupportsEndFrame,
} from "./gen-models.js";

export type GenParamErrorCode =
  | "PARAM_NOT_SUPPORTED"
  | "PARAM_INVALID"
  | "REFERENCE_REQUIRED"
  | "REFERENCE_NOT_SUPPORTED"
  | "REFERENCE_LIMIT_EXCEEDED"
  | "REFERENCE_FORMAT_NOT_SUPPORTED"
  | "REFERENCE_FILE_TOO_LARGE"
  | "REFERENCE_TOTAL_TOO_LARGE"
  | "END_FRAME_NOT_SUPPORTED"
  | "END_FRAME_REQUIRES_START"
  | "AUDIO_REFERENCE_REQUIRES_VISUAL";

export type GenParamError = {
  code: GenParamErrorCode;
  field: string;
  message: string;
};

export type ReferenceModality = "image" | "video" | "audio";
export type ReferenceManifest = {
  startUrl: string | null;
  endUrl: string | null;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  savedReferenceIds: string[];
  total: number;
};

export type NormalizedGenParams = {
  ok: boolean;
  canonicalParams: Record<string, unknown>;
  pricedParams: Record<string, unknown>;
  referenceManifest: ReferenceManifest;
  errors: GenParamError[];
};

export type SavedReferenceMeta = {
  id: string;
  kind: string;
  contentType: string | null;
  sizeBytes: number | null;
  url?: string | null;
};

const REFERENCE_KEYS = new Set([
  "referenceUrl",
  "referenceUrls",
  "referenceEndUrl",
  "imageUrls",
  "videoUrls",
  "audioUrls",
  "savedReferenceIds",
  "styleReference",
  "structureReference",
]);

const CLIENT_PARAM_KEYS = new Set([
  "aspectRatio",
  "quality",
  "count",
  "resolution",
  "duration",
  "audio",
  "bitrateMode",
  "voice",
  "factor",
  "sourceKey",
  "sourceUrl",
  "topazModel",
  ...REFERENCE_KEYS,
]);

function push(
  errors: GenParamError[],
  code: GenParamErrorCode,
  field: string,
  message: string
): void {
  errors.push({ code, field, message });
}

function uniqueStrings(value: unknown, field: string, errors: GenParamError[]): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    push(errors, "PARAM_INVALID", field, `${field} must be an array`);
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      push(errors, "PARAM_INVALID", field, `${field} must contain non-empty strings`);
      continue;
    }
    const clean = item.trim();
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

function scalarString(value: unknown, field: string, errors: GenParamError[]): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    push(errors, "PARAM_INVALID", field, `${field} must be a non-empty string`);
    return null;
  }
  return value.trim();
}

function optionString(
  raw: unknown,
  options: string[] | undefined,
  fallback: string | undefined,
  field: string,
  errors: GenParamError[]
): string | undefined {
  const list = options?.filter(Boolean) ?? [];
  if (!list.length) return undefined;
  if (raw == null || raw === "") return fallback && list.includes(fallback) ? fallback : list[0];
  const requested = String(raw);
  const exact = list.find((v) => v === requested);
  const insensitive = list.find((v) => v.toLowerCase() === requested.toLowerCase());
  if (!exact && !insensitive) {
    push(errors, "PARAM_INVALID", field, `${field} is not supported by this model`);
    return fallback && list.includes(fallback) ? fallback : list[0];
  }
  const selected = exact ?? insensitive!;
  return selected.toLowerCase() === "auto" ? "auto" : selected;
}

function optionNumber(
  raw: unknown,
  options: number[] | undefined,
  fallback: number | undefined,
  field: string,
  errors: GenParamError[]
): number | undefined {
  const list = options ?? [];
  if (!list.length) return undefined;
  if (raw == null || raw === "") return fallback != null && list.includes(fallback) ? fallback : list[0];
  const requested = Number(raw);
  if (!Number.isFinite(requested) || !list.includes(requested)) {
    push(errors, "PARAM_INVALID", field, `${field} is not supported by this model`);
    return fallback != null && list.includes(fallback) ? fallback : list[0];
  }
  return requested;
}

function mediaExtension(url: string): string | null {
  const data = /^data:([^;,]+)/i.exec(url);
  if (data) return data[1].split("/")[1]?.toLowerCase().replace("jpeg", "jpg") ?? null;
  try {
    const path = new URL(url).pathname;
    const match = /\.([a-z0-9]{2,5})$/i.exec(path);
    return match ? match[1].toLowerCase().replace("jpeg", "jpg") : null;
  } catch {
    return null;
  }
}

function checkKnownUrlFormats(
  model: GenModel,
  modality: ReferenceModality,
  urls: string[],
  errors: GenParamError[]
): void {
  const allowed = model.mediaRefFormats?.[modality]?.map((x) => x.toLowerCase().replace("jpeg", "jpg"));
  if (!allowed?.length) return;
  for (const url of urls) {
    const ext = mediaExtension(url);
    // Signed/provider URLs may intentionally have no extension; SavedReference metadata performs
    // the authoritative MIME check later. A known extension, however, must be valid now.
    if (ext && !allowed.includes(ext)) {
      push(
        errors,
        "REFERENCE_FORMAT_NOT_SUPPORTED",
        `${modality}Urls`,
        `${ext.toUpperCase()} ${modality} reference is not supported by ${model.label}`
      );
    }
  }
}

function referenceManifestFrom(raw: Record<string, unknown>, errors: GenParamError[]): ReferenceManifest {
  const startUrl = scalarString(raw.referenceUrl, "referenceUrl", errors);
  const endUrl = scalarString(raw.referenceEndUrl, "referenceEndUrl", errors);
  const scalarImageRefs = [
    ...uniqueStrings(raw.referenceUrls, "referenceUrls", errors),
    ...[scalarString(raw.styleReference, "styleReference", errors)].filter((x): x is string => !!x),
    ...[scalarString(raw.structureReference, "structureReference", errors)].filter((x): x is string => !!x),
  ];
  const imageUrls = Array.from(
    new Set([
      ...scalarImageRefs,
      ...uniqueStrings(raw.imageUrls, "imageUrls", errors),
    ])
  );
  const videoUrls = uniqueStrings(raw.videoUrls, "videoUrls", errors);
  const audioUrls = uniqueStrings(raw.audioUrls, "audioUrls", errors);
  const savedReferenceIds = uniqueStrings(raw.savedReferenceIds, "savedReferenceIds", errors);
  const allUrls = new Set<string>([
    ...(startUrl ? [startUrl] : []),
    ...(endUrl ? [endUrl] : []),
    ...imageUrls,
    ...videoUrls,
    ...audioUrls,
  ]);
  return {
    startUrl,
    endUrl,
    imageUrls,
    videoUrls,
    audioUrls,
    savedReferenceIds,
    total: allUrls.size,
  };
}

/**
 * Quote va /gen uchun bitta pure canonical validator.
 * Provider runner ortiqcha/unsupported reference'ni `slice()` qilib jim tashlashiga yo'l qo'ymaydi.
 */
export function normalizeAndValidateGenParams(
  model: GenModel,
  rawParams: Record<string, unknown> | null | undefined
): NormalizedGenParams {
  const raw = rawParams && typeof rawParams === "object" ? rawParams : {};
  const errors: GenParamError[] = [];
  for (const key of Object.keys(raw)) {
    if (!CLIENT_PARAM_KEYS.has(key)) {
      push(errors, "PARAM_NOT_SUPPORTED", key, `Unsupported parameter: ${key}`);
    }
  }

  const refs = referenceManifestFrom(raw, errors);
  const canonical: Record<string, unknown> = {};

  if (model.opType) {
    for (const key of [
      "factor",
      "sourceKey",
      "sourceUrl",
      "topazModel",
      "quality",
      // video-upscale quote va submit oldidan server tomonidan derivatsiya qilinadi.
      // Ikkala endpoint ham aynan shu kanonik qiymatlarni hash/pricingga berishi kerak.
      "resolution",
      "duration",
    ] as const) {
      if (raw[key] != null) canonical[key] = raw[key];
    }
  } else if (model.mode === "image") {
    const aspects = model.imgSettings?.aspect.options ?? model.aspects;
    const aspectDef = model.imgSettings?.aspect.def ?? aspects?.[0];
    const aspect = optionString(raw.aspectRatio, aspects, aspectDef, "aspectRatio", errors);
    if (aspect != null) canonical.aspectRatio = aspect;

    const counts = model.imgSettings?.num ?? model.count ?? [1];
    const count = optionNumber(raw.count, counts, counts[0], "count", errors);
    if (count != null) canonical.count = count;

    const qualityOptions = model.imgSettings?.quality?.options ?? model.resolutions;
    const qualityDef = model.imgSettings?.quality?.def ?? qualityOptions?.[0];
    if (qualityOptions?.length) {
      const quality = optionString(raw.quality, qualityOptions, qualityDef, "quality", errors);
      if (quality != null) canonical.quality = quality;
    } else if (raw.quality != null) {
      push(errors, "PARAM_NOT_SUPPORTED", "quality", "quality is not supported by this model");
    }
  } else if (model.mode === "video") {
    const vs = model.videoSettings;
    const aspects = vs?.aspect.options ?? model.aspects;
    const aspect = optionString(raw.aspectRatio, aspects, vs?.aspect.def ?? aspects?.[0], "aspectRatio", errors);
    if (aspect != null) canonical.aspectRatio = aspect;

    const resolutions = vs?.resolution.options ?? model.resolutions;
    const resolution = optionString(raw.resolution, resolutions, vs?.resolution.def ?? resolutions?.[0], "resolution", errors);
    if (resolution != null) canonical.resolution = resolution;

    const durationOptions = vs?.duration.options ?? model.durations?.map(String);
    const durationRaw = raw.duration == null ? vs?.duration.def ?? durationOptions?.[0] : raw.duration;
    const duration = optionString(durationRaw, durationOptions, String(vs?.duration.def ?? durationOptions?.[0] ?? ""), "duration", errors);
    if (duration != null) canonical.duration = /^\d+$/.test(duration) ? Number(duration) : duration;

    const audioSupported = (vs?.audio ?? model.audio) === true;
    const audioLocked = vs?.audioLocked === true;
    if (raw.audio != null) {
      if (!audioSupported || audioLocked || typeof raw.audio !== "boolean") {
        push(errors, "PARAM_NOT_SUPPORTED", "audio", "audio setting is not available for this model");
      } else {
        canonical.audio = raw.audio;
      }
    }

    if (vs?.bitrate) {
      const bitrate = optionString(raw.bitrateMode, vs.bitrate.options, vs.bitrate.def, "bitrateMode", errors);
      if (bitrate != null) canonical.bitrateMode = bitrate;
    } else if (raw.bitrateMode != null) {
      push(errors, "PARAM_NOT_SUPPORTED", "bitrateMode", "bitrateMode is not supported by this model");
    }
  } else if (model.mode === "voice" || model.mode === "music") {
    const voices = model.voices?.map((v) => v.id) ?? [];
    const voice = optionString(raw.voice, voices, voices[0], "voice", errors);
    if (voice != null) canonical.voice = voice;
  } else if (model.mode === "sfx") {
    const duration = optionNumber(raw.duration, model.durations, model.durations?.[0], "duration", errors);
    if (duration != null) canonical.duration = duration;
  }

  const hasAnyReference = refs.total > 0 || refs.savedReferenceIds.length > 0;
  const acceptsReference = modelAcceptsReference(model);
  const refKind = getRefKind(model);

  if (refs.endUrl && !modelSupportsEndFrame(model)) {
    push(errors, "END_FRAME_NOT_SUPPORTED", "referenceEndUrl", `${model.label} does not support an end frame`);
  }
  if (refs.endUrl && !refs.startUrl) {
    push(errors, "END_FRAME_REQUIRES_START", "referenceEndUrl", "End frame requires a start frame");
  }
  if (hasAnyReference && !acceptsReference) {
    push(errors, "REFERENCE_NOT_SUPPORTED", "references", `${model.label} does not accept references`);
  }

  const imageReferenceUrls = Array.from(
    new Set([
      ...(model.mode === "image" && refs.startUrl ? [refs.startUrl] : []),
      ...refs.imageUrls,
      ...(model.mode === "image" && raw.referenceUrls == null && refs.startUrl ? [refs.startUrl] : []),
    ])
  );
  const maxImageRefs = typeof model.maxRefs === "number" ? model.maxRefs : null;
  if (maxImageRefs != null && imageReferenceUrls.length > maxImageRefs) {
    push(errors, "REFERENCE_LIMIT_EXCEEDED", "referenceUrls", `${model.label} accepts at most ${maxImageRefs} image references`);
  }

  if (model.refMode === "required") {
    const requiredPresent =
      model.mode === "image"
        ? imageReferenceUrls.length > 0 || !!refs.startUrl
        : !!refs.startUrl || refs.imageUrls.length > 0 || refs.videoUrls.length > 0;
    if (!requiredPresent) {
      push(errors, "REFERENCE_REQUIRED", "references", `${model.label} requires a reference`);
    }
  }

  if (refKind === "frames" && (refs.imageUrls.length || refs.videoUrls.length || refs.audioUrls.length)) {
    push(errors, "REFERENCE_NOT_SUPPORTED", "mediaRefs", `${model.label} accepts start/end frames, not media reference arrays`);
  }
  if (refKind === "image" && (refs.videoUrls.length || refs.audioUrls.length || refs.endUrl)) {
    push(errors, "REFERENCE_NOT_SUPPORTED", "mediaRefs", `${model.label} accepts image references only`);
  }
  if (refKind !== "media-refs" && refKind !== "frames" && model.mode === "video" && refs.endUrl) {
    push(errors, "END_FRAME_NOT_SUPPORTED", "referenceEndUrl", `${model.label} does not support an end frame`);
  }

  if (model.mediaRefs) {
    const imageCount = refs.imageUrls.length + (refs.startUrl ? 1 : 0) + (refs.endUrl ? 1 : 0);
    const counts = { image: imageCount, video: refs.videoUrls.length, audio: refs.audioUrls.length };
    for (const modality of ["image", "video", "audio"] as const) {
      if (counts[modality] > model.mediaRefs[modality]) {
        push(
          errors,
          "REFERENCE_LIMIT_EXCEEDED",
          `${modality}Urls`,
          `${model.label} accepts at most ${model.mediaRefs[modality]} ${modality} references`
        );
      }
    }
    const total = counts.image + counts.video + counts.audio;
    if (total > model.mediaRefs.total) {
      push(errors, "REFERENCE_LIMIT_EXCEEDED", "references", `${model.label} accepts at most ${model.mediaRefs.total} total references`);
    }
    if (counts.audio > 0 && counts.image + counts.video === 0) {
      push(errors, "AUDIO_REFERENCE_REQUIRES_VISUAL", "audioUrls", "Audio reference requires at least one image or video reference");
    }
  } else if (refs.videoUrls.length || refs.audioUrls.length || (refs.imageUrls.length && model.mode === "video" && refKind !== "media-refs")) {
    push(errors, "REFERENCE_NOT_SUPPORTED", "mediaRefs", `${model.label} does not accept multimodal references`);
  }

  checkKnownUrlFormats(model, "image", [...refs.imageUrls, ...(refs.startUrl ? [refs.startUrl] : []), ...(refs.endUrl ? [refs.endUrl] : [])], errors);
  checkKnownUrlFormats(model, "video", refs.videoUrls, errors);
  checkKnownUrlFormats(model, "audio", refs.audioUrls, errors);

  if (refs.startUrl) canonical.referenceUrl = refs.startUrl;
  if (raw.referenceUrls != null) {
    const referenceUrls = uniqueStrings(raw.referenceUrls, "referenceUrls", []);
    if (referenceUrls.length) canonical.referenceUrls = referenceUrls;
  }
  if (refs.endUrl) canonical.referenceEndUrl = refs.endUrl;
  if (raw.imageUrls != null) {
    const imageUrls = uniqueStrings(raw.imageUrls, "imageUrls", []);
    if (imageUrls.length) canonical.imageUrls = imageUrls;
  }
  if (refs.videoUrls.length) canonical.videoUrls = refs.videoUrls;
  if (refs.audioUrls.length) canonical.audioUrls = refs.audioUrls;
  if (refs.savedReferenceIds.length) canonical.savedReferenceIds = refs.savedReferenceIds;
  for (const key of ["styleReference", "structureReference"] as const) {
    if (typeof raw[key] === "string" && raw[key]) canonical[key] = raw[key];
  }

  // Quote javobidagi `pricedParams` /gen'ga aynan qaytariladi. Reference'larni bu nusxadan
  // olib tashlash mumkin emas: aks holda klient canonical paramsni ishlatganda input yo'qoladi
  // va imzolangan reference-manifest hash mos kelmaydi.
  const pricedParams = { ...canonical };

  return {
    ok: errors.length === 0,
    canonicalParams: canonical,
    pricedParams,
    referenceManifest: refs,
    errors,
  };
}

function formatFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const subtype = contentType.split("/")[1]?.split(";")[0]?.toLowerCase();
  if (!subtype) return null;
  const aliases: Record<string, string> = {
    jpeg: "jpg",
    quicktime: "mov",
    mpeg: "mp3",
    "x-wav": "wav",
    wave: "wav",
  };
  return aliases[subtype] || subtype;
}

/** SavedReference ownership querydan keyingi model-aware MIME/size gate. */
export function validateSavedReferenceMetadata(model: GenModel, refs: SavedReferenceMeta[]): GenParamError[] {
  const errors: GenParamError[] = [];
  const totals: Record<ReferenceModality, number> = { image: 0, video: 0, audio: 0 };
  for (const ref of refs) {
    const modality: ReferenceModality = ref.kind === "video" ? "video" : ref.kind === "audio" ? "audio" : "image";
    const bytes = Number(ref.sizeBytes) || 0;
    totals[modality] += bytes;
    const max = model.mediaRefMaxBytes?.[modality];
    if (max && bytes > max) {
      push(errors, "REFERENCE_FILE_TOO_LARGE", ref.id, `${modality} reference exceeds this model's file-size limit`);
    }
    const allowed = model.mediaRefFormats?.[modality]?.map((x) => x.toLowerCase().replace("jpeg", "jpg"));
    const format = formatFromContentType(ref.contentType) ?? (ref.url ? mediaExtension(ref.url) : null);
    if (allowed?.length && format && !allowed.includes(format)) {
      push(errors, "REFERENCE_FORMAT_NOT_SUPPORTED", ref.id, `${format.toUpperCase()} ${modality} reference is not supported by ${model.label}`);
    }
  }
  for (const modality of ["image", "video", "audio"] as const) {
    const maxTotal = model.mediaRefMaxTotalBytes?.[modality];
    if (maxTotal && totals[modality] > maxTotal) {
      push(errors, "REFERENCE_TOTAL_TOO_LARGE", modality, `${modality} references exceed this model's total-size limit`);
    }
  }
  return errors;
}
