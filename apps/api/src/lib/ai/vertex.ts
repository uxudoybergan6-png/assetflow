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
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import type { OrResult } from "./openrouter.js";

// Fallback: env yo'qolsa ham ishlasin (GitHub Actions deploy CLOUDRUN_ENV_YAML secret'ida Google
// var'lar yo'qligi sabab qayta-qayta tushib qolardi → VERTEX_NOT_CONFIGURED). Loyiha ID maxfiy
// emas (deploy-cloudrun.sh/.yml'da ochiq). 2026-07-01.
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "project-289028d3-984c-4d84-bd4";
// VIDEO alohida GCP loyihaga yo'naltirilishi mumkin (foydalanuvchining 2-$300 krediti) — Veo/Omni
// GOOGLE_CLOUD_PROJECT_VIDEO'ni ishlatadi, rasm esa asosiy loyihada qoladi. Yo'q bo'lsa → asosiy.
// Cloud Run service account 2-loyihada roles/aiplatform.user olishi SHART. 2026-07-01.
const VIDEO_PROJECT = process.env.GOOGLE_CLOUD_PROJECT_VIDEO || PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
// Video natijasi shu GCS bucket'ga yoziladi — mavjud AWS_S3_BUCKET (GCS, S3-moslik
// orqali allaqachon ulangan) qayta ishlatiladi, alohida bucket kerak emas. (1-loyiha bucket'i;
// service account 2-loyihadan bo'lsa ham bucket'ga yozish huquqi bor.)
const OUTPUT_BUCKET = process.env.AWS_S3_BUCKET ?? "";

export function isVertexConfigured(): boolean {
  return Boolean(VIDEO_PROJECT && OUTPUT_BUCKET);
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  // P27 — SDK HTTP chaqiruvlariga timeout (ms): osilib gen-slotni band qilmasin. Video submit/
  // poll operatsiyalari uzoq bo'lishi mumkin — generous 10 daq, ammo ALWAYS bounded.
  if (!client) client = new GoogleGenAI({ vertexai: true, project: VIDEO_PROJECT, location: LOCATION, httpOptions: { timeout: 10 * 60 * 1000 } });
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
    endImageBase64?: string; // YAKUNIY kadr (last_frame) — FAQAT start image bilan (SDK: i2v)
    endImageMimeType?: string;
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
        // YAKUNIY kadr interpolatsiya (SDK GenerateVideosConfig.lastFrame). "Only supported for i2v" —
        // start image ham berilishi shart (runVertexVideo guard qiladi).
        lastFrame: opts.endImageBase64
          ? { imageBytes: opts.endImageBase64, mimeType: opts.endImageMimeType || "image/png" }
          : undefined,
        outputGcsUri: `gs://${OUTPUT_BUCKET}/vertex-video-tmp/`,
      },
    });
    if (!op.name) return { ok: false, error: "Vertex: operation name was not returned" };
    return { ok: true, data: { operationName: op.name } };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex submit error" };
  }
}

export type VertexPollResult =
  | { state: "pending" }
  | { state: "completed"; gcsUri: string }
  | { state: "error"; error: string };

/** Operatsiya holatini so'raydi (bir marta) — gen-processor loop'ida chaqiriladi.
 * Operatsiya ob'ekti process qayta ishga tushgach ham davom etishi uchun faqat
 * `name`dan tiklanadi. SDK `getVideosOperation` uzatilgan obyektда `_fromAPIResponse`
 * metodini chaqiradi, shu sabab HAQIQIY class nusxasi shart (oddiy cast EMAS —
 * cast productionda "operation._fromAPIResponse is not a function" beradi; smoke-test
 * 2026-07-01 bu tuzatilgan nusxa bilan uchidan-uchiga ishladi). */
export async function vertexPollVideo(job: VertexVideoJob): Promise<OrResult<VertexPollResult>> {
  if (!isVertexConfigured()) return { ok: false, error: "VERTEX_NOT_CONFIGURED" };
  try {
    const resumedOp = Object.assign(new GenerateVideosOperation(), { name: job.operationName });
    const op = await getClient().operations.getVideosOperation({ operation: resumedOp });
    if (!op.done) return { ok: true, data: { state: "pending" } };
    if (op.error) {
      const msg = typeof op.error.message === "string" ? op.error.message : "Vertex video generation error";
      return { ok: true, data: { state: "error", error: msg } };
    }
    const uri = op.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) return { ok: true, data: { state: "error", error: "Vertex: video URI not found" } };
    return { ok: true, data: { state: "completed", gcsUri: uri } };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Vertex poll error" };
  }
}

/** gs://bucket/path/file.mp4 → path/file.mp4 (bizning bucket bilan bir xil bo'lishi kutiladi). */
export function vertexGcsUriToKey(gcsUri: string): string {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(gcsUri);
  if (!m) return "";
  if (m[1] !== OUTPUT_BUCKET) return ""; // kutilmagan bucket — xato aniqroq bo'lsin
  return m[2];
}
