// Google Vertex AI — Gemini Omni Flash (Interactions API) adapter.
// Veo'DAN FARQLI: bu SINXRON (submit→poll EMAS) — bitta POST video qaytaradi va
// har chaqiruvda pul oladi. Auth ADC orqali (Cloud Run service account / lokal
// `gcloud auth application-default login`) — API key YO'Q.
//
// Sxema 2026-07-01 da jonli probe + rasmiy hujjatdan (ai.google.dev/.../omni) tasdiqlangan:
//   POST .../locations/global/interactions
//   { model, input, response_format:{type:"video",aspect_ratio} }
//   input: matn (text-to-video) YOKI [{type:"image",data,mime_type},{type:"text",text}] (image-to-video)
//   javob: steps[] → {type:"model_output"} → content[] → {type:"video", data(base64) | uri}
import { GoogleAuth } from "google-auth-library";
import type { OrResult } from "./openrouter.js";

// Fallback (2026-07-01): GitHub Actions deploy env secret'ida Google var yo'qligi sabab
// VERTEX_NOT_CONFIGURED qayta-qayta chiqardi. Loyiha ID maxfiy emas (deploy config'da ochiq).
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4";
// VIDEO alohida loyihaga (2-$300) yo'naltirilishi mumkin — [[vertex.ts]] bilan bir xil VIDEO_PROJECT.
const VIDEO_PROJECT = process.env.GOOGLE_CLOUD_PROJECT_VIDEO || PROJECT;
const OMNI_ENDPOINT = `https://aiplatform.googleapis.com/v1beta1/projects/${VIDEO_PROJECT}/locations/global/interactions`;

export function isVertexOmniConfigured(): boolean {
  return Boolean(VIDEO_PROJECT);
}

let auth: GoogleAuth | null = null;
async function getToken(): Promise<string> {
  if (!auth) auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("Omni: ADC access token olinmadi");
  return t.token;
}

type OmniContent = { type?: string; data?: string; uri?: string; mime_type?: string };
type OmniStep = { type?: string; content?: OmniContent[] };

/** Gemini Omni Flash bilan video generatsiya (sinxron). Referens rasm IXTIYORIY (image-to-video). */
export async function omniGenerateVideo(
  modelId: string,
  prompt: string,
  opts: { imageBase64?: string; imageMimeType?: string; aspectRatio?: string }
): Promise<OrResult<Buffer>> {
  if (!isVertexOmniConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const token = await getToken();
    const input = opts.imageBase64
      ? [
          { type: "image", data: opts.imageBase64, mime_type: opts.imageMimeType || "image/png" },
          { type: "text", text: prompt },
        ]
      : prompt;
    const body: Record<string, unknown> = { model: modelId, input };
    if (opts.aspectRatio) body.response_format = { type: "video", aspect_ratio: opts.aspectRatio };

    const res = await fetch(OMNI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-user-project": VIDEO_PROJECT,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Omni ${res.status}: ${text.slice(0, 300)}`, status: res.status };

    const json = JSON.parse(text) as { steps?: OmniStep[]; status?: string };
    const steps = Array.isArray(json.steps) ? json.steps : [];
    let vid: OmniContent | null = null;
    for (const s of steps) {
      if (s?.type !== "model_output" || !Array.isArray(s.content)) continue;
      const found = s.content.find((c) => c?.type === "video");
      if (found) { vid = found; break; }
    }
    if (!vid) return { ok: false, error: "Omni: javobda video topilmadi" };

    if (vid.data) return { ok: true, data: Buffer.from(vid.data, "base64") };
    if (vid.uri) {
      // Katta video (>4MB) uri bilan keladi — bir xil ADC token bilan yuklab olamiz.
      const dl = await fetch(vid.uri, {
        headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT },
      });
      if (!dl.ok) return { ok: false, error: `Omni video yuklab olinmadi: ${dl.status}` };
      return { ok: true, data: Buffer.from(await dl.arrayBuffer()) };
    }
    return { ok: false, error: "Omni: video data/uri yo'q" };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Omni xatosi" };
  }
}
