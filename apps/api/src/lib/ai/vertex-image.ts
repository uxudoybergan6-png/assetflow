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
  if (!clients[loc]) clients[loc] = new GoogleGenAI({ vertexai: true, project: PROJECT, location: loc });
  return clients[loc];
}

const isImagen = (modelId: string): boolean => modelId.startsWith("imagen");
const cleanAspect = (a?: string): string | undefined =>
  !a || a.toLowerCase() === "auto" ? undefined : a;
// Sifat/o'lcham — faqat Gemini/Imagen qo'llaydigan qiymatlar (1K/2K/4K). Boshqa (0.5K, low/high) → default.
const cleanSize = (s?: string): string | undefined =>
  s && ["1K", "2K", "4K"].includes(s) ? s : undefined;

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
    const ar = cleanAspect(opts.aspectRatio);
    const sz = cleanSize(opts.imageSize);
    if (isImagen(modelId)) {
      const r = await client.models.generateImages({
        model: modelId,
        prompt,
        config: { numberOfImages: 1, aspectRatio: ar, ...(sz ? { imageSize: sz } : {}) },
      });
      const b64 = r.generatedImages?.[0]?.image?.imageBytes;
      if (!b64) return { ok: false, error: "Imagen: rasm qaytmadi (xavfsizlik filtri bo'lishi mumkin)" };
      return { ok: true, data: Buffer.from(b64, "base64") };
    }
    // Nano Banana (gemini image) — aspectRatio + imageSize imageConfig orqali (SDK ImageConfig)
    const imageConfig = { ...(ar ? { aspectRatio: ar } : {}), ...(sz ? { imageSize: sz } : {}) };
    const r = await client.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseModalities: ["IMAGE"], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
    });
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) return { ok: false, error: "Nano Banana: rasm qaytmadi" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex rasm xatosi" };
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
    if (!urls.length) return { ok: false, error: "Referens rasm yo'q" };
    // Barcha referenslarni inline (base64) ga — TARTIB saqlanadi (@imgN mapping).
    const inlines = await Promise.all(urls.map((u) => refToInline(u)));
    const reqParts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> = [];
    for (const inl of inlines) {
      if (!inl) return { ok: false, error: "Referens rasm yuklanmadi" };
      reqParts.push({ inlineData: { data: inl.data, mimeType: inl.mimeType } });
    }
    reqParts.push({ text: prompt });
    const ar = cleanAspect(opts.aspectRatio);
    const sz = cleanSize(opts.imageSize);
    const imageConfig = { ...(ar ? { aspectRatio: ar } : {}), ...(sz ? { imageSize: sz } : {}) };
    const r = await getClient(locationFor(modelId)).models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: reqParts }],
      config: { responseModalities: ["IMAGE"], ...(Object.keys(imageConfig).length ? { imageConfig } : {}) },
    });
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) return { ok: false, error: "Nano Banana Edit: rasm qaytmadi" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex rasm-edit xatosi" };
  }
}
