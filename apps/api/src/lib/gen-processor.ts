import { prisma } from "@creative-tools/database";
import {
  isS3Configured,
  uploadBufferToS3,
  getSignedDownloadUrl,
} from "./s3.js";
import {
  aiGenerateImage,
  aiGenerateSpeech,
  detectMediaFormat,
} from "./ai/workers-ai.js";
import { getModelById } from "./gen-models.js";
import { refundAiCredits } from "./plugin-profile.js";

// GenAsset.type — Artlist uslubidagi raqamli tur kodlari (ichki konventsiya).
const ASSET_TYPE = { image: 130, audio: 120, video: 140 } as const;

function tsName() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** Bufer → R2 (signed URL) yoki lokal dev'da data-URL. {url, key} qaytaradi. */
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

/**
 * queued Generation'ni qayta ishlaydi: model turiga qarab Workers AI chaqiradi →
 * natijani R2'ga yozadi → GenAsset yaratadi → status=done. Xato bo'lsa status=failed +
 * KREDIT QAYTARILADI (yo'qolmasin). Best-effort, bloklamaydi (fire-and-forget).
 */
export async function processGeneration(genId: string): Promise<void> {
  const gen = await prisma.generation.findUnique({ where: { id: genId } });
  if (!gen || gen.status !== "queued") return;

  const fail = async (reason: string) => {
    await prisma.generation.update({
      where: { id: genId },
      data: { status: "failed", error: reason.slice(0, 480) },
    });
    await refundAiCredits(gen.userId, gen.cost); // kredit qaytariladi
  };

  try {
    await prisma.generation.update({ where: { id: genId }, data: { status: "running" } });

    const model = getModelById(gen.modelId);
    if (!model) return void (await fail("Noma'lum model"));

    const params = (gen.params ?? {}) as Record<string, unknown>;
    const aspectRatio =
      typeof params.aspectRatio === "string" ? params.aspectRatio : null;

    if (model.feature === "text-to-image") {
      const out = await aiGenerateImage(gen.prompt, model.key);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "png", contentType: "image/png" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: {
          generationId: genId,
          type: ASSET_TYPE.image,
          url,
          resultKey: key,
          thumbUrl: url,
          aspectRatio,
        },
      });
    } else if (model.feature === "text-to-speech") {
      const lang = typeof params.lang === "string" ? params.lang : "en";
      const out = await aiGenerateSpeech(gen.prompt, lang, model.key);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key },
      });
    } else {
      return void (await fail(`Qo'llab-quvvatlanmaydigan model turi: ${model.feature}`));
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
