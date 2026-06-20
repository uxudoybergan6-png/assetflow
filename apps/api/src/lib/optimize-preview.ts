import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Global ffmpeg concurrency cap (semaphore). 512MB Render instance'da bir
 * nechta parallel 4K transcode RAM'ni to'yintirib OOM (jarayon o'limi) keltiradi.
 * Default 1 — bir vaqtda faqat bitta ffmpeg ishlaydi; FFMPEG_MAX_CONCURRENCY
 * env bilan 2 gacha oshirilishi mumkin (kuchliroq instance'da). Qolgan
 * chaqiruvlar FIFO navbatda kutadi.
 */
const FFMPEG_MAX_CONCURRENCY = Math.max(
  1,
  Math.min(2, Number(process.env.FFMPEG_MAX_CONCURRENCY) || 1)
);
let ffmpegActive = 0;
const ffmpegQueue: Array<() => void> = [];

function acquireFfmpegSlot(): Promise<void> {
  if (ffmpegActive < FFMPEG_MAX_CONCURRENCY) {
    ffmpegActive++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    ffmpegQueue.push(() => {
      ffmpegActive++;
      resolve();
    });
  });
}

function releaseFfmpegSlot(): void {
  ffmpegActive--;
  const next = ffmpegQueue.shift();
  if (next) next();
}

/** ffmpeg'ni global concurrency cap ostida ishga tushiradi (slot olib-qaytaradi). */
async function runFfmpeg(
  args: string[],
  opts: { timeout: number }
): Promise<void> {
  await acquireFfmpegSlot();
  try {
    await execFileAsync("ffmpeg", args, opts);
  } finally {
    releaseFfmpegSlot();
  }
}

/** Faqat moov atomini boshiga ko'chiradi (o'lcham kamaymaydi) — transcode
 *  muvaffaqiyatsiz bo'lsa zaxira yo'l sifatida ishlatiladi. */
async function faststartOnly(filePath: string): Promise<boolean> {
  const tmp = `${filePath}.faststart.mp4`;
  try {
    await runFfmpeg(
      ["-y", "-threads", "1", "-i", filePath, "-c", "copy", "-movflags", "+faststart", tmp],
      { timeout: 120_000 }
    );
    fs.renameSync(tmp, filePath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* */
    }
    return false;
  }
}

/**
 * Preview videoni HAQIQIY transcode qiladi — katalog ko'rinishi uchun yengil
 * faylga (250MB 4K → ~3-8MB). Bu FAQAT preview/thumb uchun; pack.zip (asl
 * fayllar) hech qachon shu yerga tushmaydi.
 *  - max 720p balandlik (scale=-2:720 — kenglik avtomatik, juft son)
 *  - H.264, CRF 28, preset fast
 *  - 30fps cap, +faststart (moov boshda → brauzer darrov ijro etadi)
 *  - audio OLIB TASHLANADI (-an) — preview'da ovoz shart emas
 * Xato bo'lsa (masalan kodek/ffmpeg muammosi) faststart-only fallback'ga
 * tushadi, shunda hech bo'lmasa stream qilinadigan fayl qoladi.
 */
export async function optimizePreviewForStreaming(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) return false;
  const tmp = `${filePath}.opt.mp4`;
  try {
    await runFfmpeg(
      [
        "-y",
        "-threads", "1",                  // bitta core — barcha core'larni egallamasin
        "-i", filePath,
        "-vf", "scale=-2:'min(720,ih)'", // 720p dan baland bo'lsa kichraytiradi
        "-r", "30",                       // 30fps cap
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",            // keng brauzer mosligi
        "-an",                            // ovozsiz
        "-movflags", "+faststart",
        tmp,
      ],
      { timeout: 300_000 } // 4K transcode uzoq cho'zilishi mumkin
    );
    fs.renameSync(tmp, filePath);
    return true;
  } catch {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* */
    }
    // Transcode muvaffaqiyatsiz — eski xatti-harakat (faqat faststart) saqlanadi.
    return faststartOnly(filePath);
  }
}
