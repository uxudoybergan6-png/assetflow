// Google Vertex AI — rasm (Imagen + Nano Banana/Gemini image) adapter, TO'G'RIDAN-TO'G'RI.
// ADC orqali (Cloud Run service account / lokal `gcloud auth application-default login`).
// fal.ai orqali EMAS — Google'ning o'z modeli uchun ustama to'lamaslik uchun.
//
// Sxema 2026-07-01 jonli smoke-test bilan tasdiqlandi (Imagen 4 1024x1024, Nano Banana 1024x1024):
//  - Imagen*:  client.models.generateImages → generatedImages[0].image.imageBytes (base64)
//  - Nano Banana (gemini-*-image): client.models.generateContent (responseModalities:["IMAGE"])
//      → candidates[0].content.parts[].inlineData.data (base64)
import { GoogleGenAI } from "@google/genai";
import type { OrResult } from "./openrouter.js";
import { fetchSafe } from "../fetch-safe.js";

// Fallback (2026-07-01): GitHub Actions deploy env secret'ida Google var yo'qligi sabab
// VERTEX_NOT_CONFIGURED qayta-qayta chiqardi. Loyiha ID maxfiy emas (deploy config'da ochiq).
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

export function isVertexImageConfigured(): boolean {
  return Boolean(PROJECT);
}

// Region model'ga bog'liq (jonli sinov 2026-07-01): yangi Gemini 3.x image modellar FAQAT
// `global`da (us-central1 → 404); Imagen va gemini-2.5 esa us-central1'da. Shu sabab per-location client.
function locationFor(modelId: string): string {
  return modelId.startsWith("gemini-3") ? "global" : LOCATION;
}
const clients: Record<string, GoogleGenAI> = {};
function getClient(loc: string): GoogleGenAI {
  // P27 — SDK HTTP timeout (ms): rasm gen/upscale osilib gen-slotni band qilmasin (3 daq bounded).
  if (!clients[loc]) clients[loc] = new GoogleGenAI({ vertexai: true, project: PROJECT, location: loc, httpOptions: { timeout: 3 * 60 * 1000 } });
  return clients[loc];
}

const isImagen = (modelId: string): boolean => modelId.startsWith("imagen");
const cleanAspect = (a?: string): string | undefined =>
  !a || a.toLowerCase() === "auto" ? undefined : a;
// Sifat/o'lcham — faqat Gemini/Imagen qo'llaydigan qiymatlar (1K/2K/4K). Boshqa (0.5K, low/high) → default.
const cleanSize = (s?: string): string | undefined =>
  s && ["1K", "2K", "4K"].includes(s) ? s : undefined;

type VertexImageResult = OrResult<Buffer> & { retryable?: boolean };

function vertexErrorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error || "Vertex image error");
  }
}

/** Google SDK quota/transient xatolari foydalanuvchi kontenti rad etilgani EMAS. */
export function isRetryableVertexImageError(error: unknown): boolean {
  const raw = vertexErrorText(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota (?:exceeded|exhausted)|rate.?limit|\b500\b|\b502\b|\b503\b|\b504\b|UNAVAILABLE|DEADLINE_EXCEEDED|ETIMEDOUT|ECONNRESET|socket hang up|network/i.test(raw);
}

function responseTextParts(response: unknown): string[] {
  const root = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const promptFeedback = root.promptFeedback && typeof root.promptFeedback === "object"
    ? (root.promptFeedback as Record<string, unknown>)
    : {};
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const first = candidates[0] && typeof candidates[0] === "object"
    ? (candidates[0] as Record<string, unknown>)
    : {};
  const content = first.content && typeof first.content === "object"
    ? (first.content as Record<string, unknown>)
    : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const values: unknown[] = [promptFeedback.blockReason, first.finishReason, first.finishMessage];
  for (const part of parts) {
    if (part && typeof part === "object") values.push((part as Record<string, unknown>).text);
  }
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

/**
 * Gemini image javobida rasm bo'lmasa haqiqiy sababni saqlaydi. Faqat aniq SAFETY/
 * BLOCKLIST signali kontent rad etilishi; sababsiz bo'sh javob transient hisoblanib bir marta
 * qayta uriniladi. Shunda harmless prompt quota/SDK bo'sh javobi sabab "content rejected"
 * deb noto'g'ri tasniflanmaydi.
 */
export function extractVertexImageResponse(response: unknown, label = "Vertex image"): VertexImageResult {
  const root = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const generated = Array.isArray(root.generatedImages) ? root.generatedImages : [];
  const generatedFirst = generated[0] && typeof generated[0] === "object"
    ? (generated[0] as Record<string, unknown>)
    : {};
  const generatedImage = generatedFirst.image && typeof generatedFirst.image === "object"
    ? (generatedFirst.image as Record<string, unknown>)
    : {};
  if (typeof generatedImage.imageBytes === "string" && generatedImage.imageBytes.length > 0)
    return { ok: true, data: Buffer.from(generatedImage.imageBytes, "base64") };
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const first = candidates[0] && typeof candidates[0] === "object"
    ? (candidates[0] as Record<string, unknown>)
    : {};
  const content = first.content && typeof first.content === "object"
    ? (first.content as Record<string, unknown>)
    : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const inline = (part as Record<string, unknown>).inlineData;
    if (!inline || typeof inline !== "object") continue;
    const data = (inline as Record<string, unknown>).data;
    if (typeof data === "string" && data.length > 0)
      return { ok: true, data: Buffer.from(data, "base64") };
  }
  const details = responseTextParts(response);
  const detail = details.join(" · ").slice(0, 300);
  if (/SAFETY|BLOCKLIST|PROHIBITED_CONTENT|RECITATION|content polic|responsible ai/i.test(detail)) {
    return {
      ok: false,
      error: `${label}: content policy blocked the image${detail ? ` (${detail})` : ""}`,
      retryable: false,
    };
  }
  return {
    ok: false,
    error: `${label}: empty image response${detail ? ` (${detail})` : ""}`,
    retryable: true,
  };
}

async function runVertexImageRequest(
  request: () => Promise<unknown>,
  label: string
): Promise<VertexImageResult> {
  const maxAttempts = 3;
  let last: VertexImageResult = { ok: false, error: `${label}: request failed` };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await request();
      last = extractVertexImageResponse(response, label);
      if (last.ok || !last.retryable) return last;
    } catch (error) {
      const message = vertexErrorText(error);
      const retryable = isRetryableVertexImageError(error);
      last = { ok: false, error: message || `${label}: request failed`, retryable };
      if (!retryable) return last;
    }
    if (attempt + 1 < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
  }
  return last;
}

export function buildVertexImageTextRequest(
  modelId: string,
  prompt: string,
  opts: { aspectRatio?: string; imageSize?: string }
) {
  const ar = cleanAspect(opts.aspectRatio);
  const sz = cleanSize(opts.imageSize);
  if (isImagen(modelId)) {
    return {
      kind: "imagen" as const,
      request: {
        model: modelId,
        prompt,
        config: { numberOfImages: 1, aspectRatio: ar, ...(sz ? { imageSize: sz } : {}) },
      },
    };
  }
  const imageConfig = { ...(ar ? { aspectRatio: ar } : {}), ...(sz ? { imageSize: sz } : {}) };
  return {
    kind: "gemini" as const,
    request: {
      model: modelId,
      contents: prompt,
      config: { responseModalities: ["IMAGE"], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
    },
  };
}

export function buildVertexImageEditRequest(
  modelId: string,
  prompt: string,
  inlines: Array<{ data: string; mimeType: string }>,
  opts: { aspectRatio?: string; imageSize?: string }
) {
  const reqParts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = inlines.map(
    (inl) => ({ inlineData: { data: inl.data, mimeType: inl.mimeType } })
  );
  reqParts.push({ text: prompt });
  const ar = cleanAspect(opts.aspectRatio);
  const sz = cleanSize(opts.imageSize);
  const imageConfig = { ...(ar ? { aspectRatio: ar } : {}), ...(sz ? { imageSize: sz } : {}) };
  return {
    model: modelId,
    contents: [{ role: "user", parts: reqParts }],
    config: { responseModalities: ["IMAGE"], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
  };
}

async function refToInline(refUrl: string): Promise<{ data: string; mimeType: string } | null> {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(refUrl);
  if (m) return { data: m[2], mimeType: m[1] || "image/png" };
  let res: Response;
  try {
    res = await fetchSafe(refUrl); // SSRF: faqat bizning bucket/data-URI
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mimeType: ct };
}

/** Matndan rasm (Imagen yoki Nano Banana). Bitta rasm qaytaradi — count'ni chaqiruvchi (gen-processor) boshqaradi. */
export async function vertexImage(
  modelId: string,
  prompt: string,
  opts: { aspectRatio?: string; imageSize?: string }
): Promise<OrResult<Buffer>> {
  if (!isVertexImageConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const client = getClient(locationFor(modelId));
    const built = buildVertexImageTextRequest(modelId, prompt, opts);
    if (built.kind === "imagen") {
      return await runVertexImageRequest(
        () => client.models.generateImages(built.request),
        "Imagen"
      );
    }
    // Nano Banana (gemini image) — aspectRatio + imageSize imageConfig orqali (SDK ImageConfig)
    return await runVertexImageRequest(
      () => client.models.generateContent(built.request),
      "Nano Banana"
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex image error" };
  }
}

/** Rasm UPSCALE (BATCH4 #1) — imagegeneration@002 `mode:"upscale"` (SDK models.upscaleImage →
 * :predict + upscaleConfig). Manba rasm data-URI yoki bizning bucket URL; prompt YO'Q.
 * factor "x2" (→2K) | "x4" (→4K). Bitta rasm qaytaradi — count doim 1 (katalog num:[1]). */
export async function vertexImageUpscale(
  modelId: string,
  refUrl: string,
  factor: "x2" | "x4"
): Promise<OrResult<Buffer>> {
  if (!isVertexImageConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const inl = await refToInline(refUrl);
    if (!inl) return { ok: false, error: "Source image failed to load" };
    const r = await getClient(locationFor(modelId)).models.upscaleImage({
      model: modelId,
      image: { imageBytes: inl.data, mimeType: inl.mimeType },
      upscaleFactor: factor,
      config: { includeRaiReason: true },
    });
    const b64 = r.generatedImages?.[0]?.image?.imageBytes;
    if (!b64) return { ok: false, error: "Upscale: no image was returned (may have been blocked by the safety filter)" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex upscale error" };
  }
}

/** Referens rasm(lar) bilan tahrirlash (Nano Banana / Gemini image). BIR YOKI KO'P referens
 * (Gemini bir necha rasmni birlashtira oladi — @img1/@img2). Imagen edit BU YO'LDA EMAS (t2i only). */
export async function vertexImageEdit(
  modelId: string,
  prompt: string,
  refUrls: string | string[],
  opts: { aspectRatio?: string; imageSize?: string }
): Promise<OrResult<Buffer>> {
  if (!isVertexImageConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const urls = (Array.isArray(refUrls) ? refUrls : [refUrls]).filter((u) => typeof u === "string" && u.length > 0);
    if (!urls.length) return { ok: false, error: "No reference image" };
    // Barcha referenslarni inline (base64) ga — TARTIB saqlanadi (@imgN mapping).
    const inlines = await Promise.all(urls.map((u) => refToInline(u)));
    const ready: Array<{ data: string; mimeType: string }> = [];
    for (const inl of inlines) {
      if (!inl) return { ok: false, error: "Reference image failed to load" };
      ready.push({ data: inl.data, mimeType: inl.mimeType });
    }
    return await runVertexImageRequest(
      () => getClient(locationFor(modelId)).models.generateContent(
        buildVertexImageEditRequest(modelId, prompt, ready, opts)
      ),
      "Nano Banana Edit"
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex image-edit error" };
  }
}
