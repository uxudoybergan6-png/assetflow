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

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

export function isVertexImageConfigured(): boolean {
  return Boolean(PROJECT);
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });
  return client;
}

const isImagen = (modelId: string): boolean => modelId.startsWith("imagen");
const cleanAspect = (a?: string): string | undefined =>
  !a || a.toLowerCase() === "auto" ? undefined : a;

async function refToInline(refUrl: string): Promise<{ data: string; mimeType: string } | null> {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(refUrl);
  if (m) return { data: m[2], mimeType: m[1] || "image/png" };
  const res = await fetch(refUrl);
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mimeType: ct };
}

/** Matndan rasm (Imagen yoki Nano Banana). Bitta rasm qaytaradi — count'ni chaqiruvchi (gen-processor) boshqaradi. */
export async function vertexImage(
  modelId: string,
  prompt: string,
  opts: { aspectRatio?: string }
): Promise<OrResult<Buffer>> {
  if (!isVertexImageConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    if (isImagen(modelId)) {
      const r = await getClient().models.generateImages({
        model: modelId,
        prompt,
        config: { numberOfImages: 1, aspectRatio: cleanAspect(opts.aspectRatio) },
      });
      const b64 = r.generatedImages?.[0]?.image?.imageBytes;
      if (!b64) return { ok: false, error: "Imagen: rasm qaytmadi (xavfsizlik filtri bo'lishi mumkin)" };
      return { ok: true, data: Buffer.from(b64, "base64") };
    }
    // Nano Banana (gemini image)
    const r = await getClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseModalities: ["IMAGE"] },
    });
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) return { ok: false, error: "Nano Banana: rasm qaytmadi" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex rasm xatosi" };
  }
}

/** Referens rasm bilan tahrirlash (Nano Banana / Gemini image). Imagen edit BU YO'LDA EMAS (t2i only). */
export async function vertexImageEdit(
  modelId: string,
  prompt: string,
  refUrl: string,
  _opts: { aspectRatio?: string }
): Promise<OrResult<Buffer>> {
  if (!isVertexImageConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const inline = await refToInline(refUrl);
    if (!inline) return { ok: false, error: "Referens rasm yuklanmadi" };
    const r = await getClient().models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: inline.data, mimeType: inline.mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: { responseModalities: ["IMAGE"] },
    });
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) return { ok: false, error: "Nano Banana Edit: rasm qaytmadi" };
    return { ok: true, data: Buffer.from(b64, "base64") };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex rasm-edit xatosi" };
  }
}
