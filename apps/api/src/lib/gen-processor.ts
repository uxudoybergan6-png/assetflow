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
import { getModelById, resolveVideoParams, resolveImageCount } from "./gen-models.js";
import type { GenModel } from "./gen-models.js";
import { elSoundEffects } from "./ai/elevenlabs.js";
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
  model: GenModel,
  prompt: string,
  params: Record<string, unknown>
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const refUrl = typeof params.referenceUrl === "string" ? params.referenceUrl : null;
  // Param gigiyenasi: model qo'llaydigan qiymatlarga klamp (ortiqcha yuborilmaydi).
  const v = resolveVideoParams(model, params);
  const opts: Parameters<typeof orVideoCreate>[1] = {
    prompt,
    resolution: v.resolution,
    aspectRatio: v.aspectRatio,
    duration: v.duration,
    generateAudio: v.generateAudio,
  };
  if (refUrl) {
    if (model.feature === "image-to-video") {
      opts.frameImages = [{ url: refUrl, frameType: "first_frame" }];
    } else {
      opts.references = [refUrl];
    }
  }
  const created = await orVideoCreate(model.key, opts);
  if (!created.ok) return { ok: false, error: created.error };

  // Poll (3s × 100 = ~5 daqiqa) — granularlik 5s→3s, tayyor bo'lishini tezroq aniqlaydi.
  // Birinchi tekshiruvni 2s'da (qisqa video tezroq topilsin), keyin 3s.
  await sleep(2000);
  for (let i = 0; i < 100; i++) {
    const st = await orVideoStatus(created.data.id);
    if (st.ok) {
      if (st.data.status === "completed") {
        const url = st.data.urls[0];
        if (!url) return { ok: false, error: "Video URL qaytmadi" };
        const dl = await orDownload(url);
        if (!dl.ok) return { ok: false, error: dl.error };
        return { ok: true, buf: dl.data };
      }
      if (st.data.status === "failed") return { ok: false, error: "Video generatsiya muvaffaqiyatsiz" };
    }
    await sleep(3000); // keyingi tekshiruvgacha
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
      // image_config — NATIVE o'lcham/nisbat (promptga qo'shilmaydi).
      const quality = typeof params.quality === "string" ? params.quality : null;
      const imageConfig: { aspect_ratio?: string; image_size?: string } = {};
      if (aspectRatio) imageConfig.aspect_ratio = aspectRatio;
      if (quality) imageConfig.image_size = quality;
      // count > 1 → N marta generatsiya, har biri alohida GenAsset (narx base×N).
      // Bittasi xato bo'lsa — butun batch fail + to'liq refund (foydalanuvchi yo hammasini oladi, yo hech narsa to'lamaydi).
      const count = resolveImageCount(model, params);
      for (let i = 0; i < count; i++) {
        const out =
          model.feature === "image-edit" && refUrl
            ? await orImageEdit(model.key, gen.prompt, refUrl, model.imgModalities, imageConfig)
            : await orImage(model.key, gen.prompt, model.imgModalities, imageConfig);
        if (!out.ok) return void (await fail(out.error));
        const fmt = detectMediaFormat(out.data, { ext: "png", contentType: "image/png" });
        const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
        await prisma.genAsset.create({
          data: { generationId: genId, type: ASSET_TYPE.image, url, resultKey: key, thumbUrl: url, aspectRatio },
        });
      }
    } else if (model.feature === "text-to-speech") {
      // Kokoro voice MAJBURIY (bo'sh → "expected string" xatosi). Yo'q/bo'sh bo'lsa
      // tasdiqlangan default voice'ga tushamiz — audio doim chiqsin (jonli test bilan tekshirilgan).
      const voice =
        typeof params.voice === "string" && params.voice ? params.voice : "af_bella";
      const out = await orSpeech(model.key, gen.prompt, voice);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key },
      });
    } else if (model.feature === "text-to-sfx") {
      // ElevenLabs SFX (sync, RAW mp3). duration ixtiyoriy (0.5–22s).
      const dur =
        typeof params.duration === "number"
          ? params.duration
          : typeof params.duration === "string"
            ? Number(params.duration)
            : undefined;
      const out = await elSoundEffects(gen.prompt, dur);
      if (!out.ok) return void (await fail(out.error));
      const fmt = detectMediaFormat(out.data, { ext: "mp3", contentType: "audio/mpeg" });
      const { url, key } = await persist(gen.userId, genId, out.data, fmt.ext, fmt.contentType);
      await prisma.genAsset.create({
        data: { generationId: genId, type: ASSET_TYPE.audio, url, resultKey: key },
      });
    } else if (model.feature === "text-to-video" || model.feature === "image-to-video") {
      const out = await runVideo(model, gen.prompt, params);
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

/**
 * Qotib qolgan generatsiyalarni tiklaydi (Render restart fon jarayonni o'ldirsa job "running"da
 * qoladi → kredit qaytmaydi). Belgilangan vaqtdan oshган queued/running → failed + refund.
 * /credits va POST /gen'da chaqiriladi — foydalanuvchi keyingi amalida yo'qolган krediti qaytadi.
 */
const STUCK_MS = 10 * 60 * 1000; // 10 daqiqa (video backend poll'i ~5 daq — 2× zaxira)
export async function reconcileStuckGenerations(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_MS);
  const stuck = await prisma.generation.findMany({
    where: { userId, status: { in: ["queued", "running"] }, createdAt: { lt: cutoff } },
  });
  for (const g of stuck) {
    // Atomik: faqat hali queued/running bo'lsa failed qilamiz (haqiqatan tugagan job'ga tegmaslik).
    const upd = await prisma.generation.updateMany({
      where: { id: g.id, status: { in: ["queued", "running"] } },
      data: { status: "failed", error: "Vaqt tugadi (avtomatik tiklash) — kredit qaytarildi" },
    });
    if (upd.count > 0) await refundAiCredits(g.userId, g.cost);
  }
  return stuck.length;
}

/**
 * Fon rejimida ishga tushirish — POST /gen javobini bloklamaydi.
 * CONCURRENCY CHEKLOVI: bir vaqtda faqat N gen ishlaydi (video/rasm buferlari RAM'ni to'ldirib
 * OOM qilmasin — Render kichik instance). Ortiqchasi navbatda kutadi (status="queued").
 */
const GEN_CONCURRENCY = Math.max(1, Number(process.env.GEN_CONCURRENCY) || 2);
let genActive = 0;
const genWaiting: string[] = [];
function genRunNext(): void {
  if (genActive >= GEN_CONCURRENCY) return;
  const genId = genWaiting.shift();
  if (!genId) return;
  genActive++;
  processGeneration(genId)
    .catch((e) => console.error(`[studio-gen] processor xato (${genId}):`, e))
    .finally(() => {
      genActive--;
      genRunNext();
    });
}
export function processGenerationInBackground(genId: string): void {
  genWaiting.push(genId);
  genRunNext();
}
