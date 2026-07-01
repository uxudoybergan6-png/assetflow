// Google Vertex AI (Veo video) adapter — ADC orqali (Cloud Run'da biriktirilgan
// service account, lokalda `gcloud auth application-default login`). API KEY YO'Q —
// org policy API key yaratishni bloklagani uchun shu yo'l tanlangan.
//
// DIQQAT: bu adapter Google'ning @google/genai SDK type deklaratsiyalaridan
// (node_modules/@google/genai@2.10.0, 2026-07) o'qib yozilgan — usul nomlari va
// parametr shakllari HAQIQIY .d.ts fayldan tasdiqlangan. Lekin fal.ts'dan farqli
// o'laroq HALI HAQIQIY $300 kredit hisobida sinovdan o'tkazilmagan (bu muhitda
// gcloud/tarmoq yo'q) — ishga tushirishdan oldin bitta kichik video bilan qo'lda
// smoke-test SHART.
import { GoogleGenAI, type GenerateVideosOperation } from "@google/genai";
import type { OrResult } from "./openrouter.js";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
// Video natijasi shu GCS bucket'ga yoziladi — mavjud AWS_S3_BUCKET (GCS, S3-moslik
// orqali allaqachon ulangan) qayta ishlatiladi, alohida bucket kerak emas.
const OUTPUT_BUCKET = process.env.AWS_S3_BUCKET ?? "";

export function isVertexConfigured(): boolean {
  return Boolean(PROJECT && OUTPUT_BUCKET);
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION });
  return client;
}

export type VertexVideoJob = { operationName: string };

/** Video generatsiya boshlaydi (Veo, predictLongRunning). Referens — boshlang'ich kadr (base64). */
export async function vertexSubmitVideo(
  modelId: string,
  prompt: string,
  opts: {
    imageBase64?: string;
    imageMimeType?: string;
    aspectRatio?: string;
    durationSeconds?: number;
    generateAudio?: boolean;
    resolution?: string;
  }
): Promise<OrResult<VertexVideoJob>> {
  if (!isVertexConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const op = await getClient().models.generateVideos({
      model: modelId,
      prompt,
      image: opts.imageBase64
        ? { imageBytes: opts.imageBase64, mimeType: opts.imageMimeType || "image/png" }
        : undefined,
      config: {
        aspectRatio: opts.aspectRatio,
        durationSeconds: opts.durationSeconds,
        generateAudio: opts.generateAudio,
        resolution: opts.resolution,
        outputGcsUri: `gs://${OUTPUT_BUCKET}/vertex-video-tmp/`,
      },
    });
    if (!op.name) return { ok: false, error: "Vertex: operation name qaytmadi" };
    return { ok: true, data: { operationName: op.name } };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex submit xatosi" };
  }
}

export type VertexPollResult =
  | { state: "pending" }
  | { state: "completed"; gcsUri: string }
  | { state: "error"; error: string };

/** Operatsiya holatini so'raydi (bir marta) — gen-processor loop'ida chaqiriladi.
 * Operatsiya ob'ekti process qayta ishga tushgach ham davom etishi uchun faqat
 * `name`dan tiklanadi (SDK operatsiyani to'liq class deb kutadi — shu sabab cast). */
export async function vertexPollVideo(job: VertexVideoJob): Promise<OrResult<VertexPollResult>> {
  if (!isVertexConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const resumedOp = { name: job.operationName } as GenerateVideosOperation;
    const op = await getClient().operations.getVideosOperation({ operation: resumedOp });
    if (!op.done) return { ok: true, data: { state: "pending" } };
    if (op.error) {
      const msg = typeof op.error.message === "string" ? op.error.message : "Vertex video generatsiya xatosi";
      return { ok: true, data: { state: "error", error: msg } };
    }
    const uri = op.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) return { ok: true, data: { state: "error", error: "Vertex: video URI topilmadi" } };
    return { ok: true, data: { state: "completed", gcsUri: uri } };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex poll xatosi" };
  }
}

/** gs://bucket/path/file.mp4 → path/file.mp4 (bizning bucket bilan bir xil bo'lishi kutiladi). */
export function vertexGcsUriToKey(gcsUri: string): string {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(gcsUri);
  if (!m) return "";
  if (m[1] !== OUTPUT_BUCKET) return ""; // kutilmagan bucket — xato aniqroq bo'lsin
  return m[2];
}
