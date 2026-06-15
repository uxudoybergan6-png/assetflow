import { prisma } from "@creative-tools/database";
import {
  isS3Configured,
  uploadBufferToS3,
  getSignedDownloadUrl,
} from "./s3.js";
import { detectMediaFormat } from "./ai/workers-ai.js";
import {
  orImage,
  orImageEdit,
  orSpeech,
  orVideoCreate,
  orVideoStatus,
  orDownload,
} from "./ai/openrouter.js";
import { getModelById } from "./gen-models.js";
import { refundAiCredits } from "./plugin-profile.js";

// GenAsset.type — Artlist uslubidagi raqamli tur kodlari (ichki konventsiya).
const ASSET_TYPE = { image: 130, audio: 120, video: 140 } as const;

function tsName() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bufer → R2 (signed URL) yoki lokal dev'da data-URL. {url, key}. */
async function persist(
  userId: string,
  genId: string,
  buf: Buffer,
  ext: string,
  contentType: string
): Promise<{ url: string; key: string | null }> {
  const key = `gen/${userId}/${genId}-${tsName()}.${ext}`;
  if (isS3Configured()) {
    await uploadBufferToS3(buf, key, contentType);
    return { url: await getSignedDownloadUrl(key, 3600), key };
  }
  return { url: `data:${contentType};base64,${buf.toString("base64")}`, key: null };
}

/** Video oqimi: OpenRouter async job → poll → yuklab olish (maks ~5 daqiqa). */
async function runVideo(
  feature: string,
  key: string,
  prompt: string,
  params: Record<string, unknown>
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  const resolution = typeof params.resolution === "string" ? params.resolution : "1080p";
  const aspectRatio = typeof params.aspectRatio === "string" ? params.aspectRatio : "16:9";
  const opts: Parameters<typeof orVideoCreate>[1] = { prompt, resolution, aspectRatio };
  if (refUrl) {
    if (feature === "image-to-video") {
      opts.frameImages = [{ url: refUrl, frameType: "first_frame" }];
    } else {
      opts.references = [refUrl];
    }
  }
  const created = await orVideoCreate(key, opts);
  if (!created.ok) return { ok: false, error: created.error };

  // Poll (5s × 60 = ~5 daqiqa)
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const st = await orVideoStatus(created.data.id);
    if (!st.ok) continue; // vaqtinchalik — davom
    if (st.data.status === "completed") {
      const url = st.data.urls[0];
      if (!url) return { ok: false, error: "Video URL qaytmadi" };
      const dl = await orDownload(url);
      if (!dl.ok) return { ok: false, error: dl.error };
      return { ok: true, buf: dl.data };
    }
    if (st.data.status === "failed") return { ok: false, error: "Video generatsiya muvaffaqiyatsiz" };
  }
  return { ok: false, error: "Video vaqt tugadi (timeout)" };
}

/**
 * queued Generation'ni qayta ishlaydi — model.feature bo'yicha OpenRouter'ga marshrutlaydi:
 * text-to-image / image-edit → sync; text-to-speech → audio; text/image-to-video → async poll.
 * Natija R2'ga → GenAsset → status=done. Xato → status=failed + KREDIT QAYTARILADI.
 */
export async function processGeneration(genId: string): Promise<void> {
  const gen = await prisma.generation.findUnique({ where: { id: genId } });
  if (!gen || gen.status !== "queued") return;

  const fail = async (reason: string) => {
    await prisma.generation.update({
      where: { id: genId },
      data: { status: "failed", error: reason.slice(0, 480) },
    });
    await refundAiCredits(gen.userId, gen.cost);
  };

  try {
    await prisma.generation.update({ where: { id: genId }, data: { status: "running" } });
    const model = getModelById(gen.modelId);
    if (!model) return void (await fail("Noma'lum model"));

    const params = (gen.params ?? {}) as Record<string, unknown>;
    const aspectRatio = typeof params.aspectRatio === "string" ? params.aspectRatio : null;
    const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;

    if (model.feature === "text-to-image" || model.feature === "image-edit") {
      const out =
        model.feature === "image-edit" && refUrl
          ? await orImageEdit(model.key, gen.prompt, refUrl)
          : await orImage(model.key, gen.prompt);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "png", contentType: "image/png" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.image, url, resultKey: key, thumbUrl: url, aspectRatio },
      });
    } else if (model.feature === "text-to-speech") {
      const voice = typeof params.voice === "string" ? params.voice : "";
      const out = await orSpeech(model.key, gen.prompt, voice);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key },
      });
    } else if (model.feature === "text-to-video" || model.feature === "image-to-video") {
      const out = await runVideo(model.feature, model.key, gen.prompt, params);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.buf, { ext: "mp4", contentType: "video/mp4" });
      const { url, key } = await persist(gen.userId, genId, out.buf, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.video, url, resultKey: key, thumbUrl: url, aspectRatio },
      });
    } else {
      return void (await fail(`Qo'llab-quvvatlanmaydigan tur: ${model.feature}`));
    }

    await prisma.generation.update({ where: { id: genId }, data: { status: "done" } });
  } catch (e) {
    await fail(e instanceof Error ? e.message : String(e));
  }
}

/** Fon rejimida ishga tushirish — POST /gen javobini bloklamaydi. */
export function processGenerationInBackground(genId: string): void {
  void processGeneration(genId).catch((e) => {
    console.error(`[studio-gen] processor xato (${genId}):`, e);
  });
}
