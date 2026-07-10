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

/**
 * Videoning birinchi kadridan poster JPG chiqaradi (FAZA 2 #8 — CEP'da <video>
 * birinchi-kadr renderi ishonchsiz, haqiqiy poster rasm kerak). Max 720p,
 * sifat q=4 (~50-150KB). Muvaffaqiyat: true; xato: false (gen oqimini buzmaydi).
 */
/** P4 — rasm faylidan ~512px kichik JPG thumbnail (karta grid'lari uchun).
 *  Kichik rasm (≤512px) bo'lsa ham qayta siqiladi (jpg q5) — 4K PNG →~30-60KB.
 *  ffmpeg semaphore ostida (sharp dependency YO'Q — mavjud ffmpeg ishlatiladi). */
export async function makeImageThumbFile(
  inputPath: string,
  outPath: string
): Promise<boolean> {
  if (!fs.existsSync(inputPath)) return false;
  try {
    await runFfmpeg(
      ["-y", "-threads", "1", "-i", inputPath, "-vf", "scale='min(512,iw)':-2", "-frames:v", "1", "-q:v", "5", outPath],
      { timeout: 30_000 }
    );
    return fs.existsSync(outPath);
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

export async function extractVideoPosterFrame(
  videoPath: string,
  posterPath: string
): Promise<boolean> {
  if (!fs.existsSync(videoPath)) return false;
  try {
    await runFfmpeg(
      [
        "-y",
        "-threads", "1",
        "-ss", "0.1",
        "-i", videoPath,
        "-frames:v", "1",
        "-vf", "scale=-2:'min(720,ih)'",
        "-q:v", "4",
        posterPath,
      ],
      { timeout: 60_000 }
    );
    return fs.existsSync(posterPath);
  } catch {
    try {
      if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
    } catch {
      /* */
    }
    return false;
  }
}

type VideoRefPreset = {
  scaleExpr: string;
  fps: string;
  crf: string;
  preset: string;
};

async function transcodeVideoReferencePass(
  inputPath: string,
  outputPath: string,
  clip: { startSec?: number; endSec?: number } | null,
  preset: VideoRefPreset
): Promise<void> {
  const args = ["-y", "-threads", "1"];
  const startSec = Number(clip?.startSec);
  const endSec = Number(clip?.endSec);
  if (Number.isFinite(startSec) && startSec > 0) args.push("-ss", startSec.toFixed(3));
  args.push("-i", inputPath);
  if (Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
    args.push("-t", Math.max(0.1, endSec - startSec).toFixed(3));
  }
  args.push(
    "-vf",
    `${preset.scaleExpr},fps=${preset.fps}`,
    "-c:v",
    "libx264",
    "-crf",
    preset.crf,
    "-preset",
    preset.preset,
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    outputPath
  );
  await runFfmpeg(args, { timeout: 300_000 });
}

/**
 * Video referensni modelga qulay klipga aylantiradi:
 *  - ixtiyoriy start/end oralig'i
 *  - 720p→480p fallback
 *  - 12fps→10fps fallback
 *  - audio olib tashlanadi
 * Natija shu filePath ustiga qayta yoziladi.
 */
export async function optimizeVideoReferenceForUpload(
  filePath: string,
  clip?: { startSec?: number; endSec?: number }
): Promise<boolean> {
  if (!fs.existsSync(filePath)) return false;
  const tmp = `${filePath}.refopt.mp4`;
  const presets: VideoRefPreset[] = [
    { scaleExpr: "scale=-2:'min(720,ih)'", fps: "12", crf: "30", preset: "veryfast" },
    { scaleExpr: "scale=-2:'min(480,ih)'", fps: "10", crf: "34", preset: "veryfast" },
  ];
  for (const preset of presets) {
    try {
      await transcodeVideoReferencePass(filePath, tmp, clip || null, preset);
      fs.renameSync(tmp, filePath);
      return true;
    } catch {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        /* */
      }
    }
  }
  return false;
}

/**
 * Rasm yoki video faylning piksel o'lchamini (width/height) qaytaradi —
 * ffprobe orqali (ffmpeg apt paketi bilan birga keladi, alohida rasm
 * kutubxonasi kerak emas). Ingest'da orientatsiya avtomat aniqlash uchun
 * ishlatiladi (KONTENT-QUVURI-SXEMA.md §6). Topilmasa/xato bo'lsa null.
 */
export async function probeMediaDimensions(
  filePath: string
): Promise<{ width: number; height: number } | null> {
  if (!fs.existsSync(filePath)) return null;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0",
        filePath,
      ],
      { timeout: 30_000 }
    );
    const match = /^(\d+)x(\d+)/.exec(stdout.trim());
    if (!match) return null;
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}

/**
 * BATCH4 #2 — video METAsi (o'lcham + davomiylik + fps) URL'dan (signed GCS) — ffprobe http
 * kirishni range-so'rovlar bilan o'qiydi (to'liq yuklab olinmaydi). Video-upscale narx
 * derivatsiyasi uchun: chiqish tier = manba o'lcham × faktor; billing soniya = ceil(duration).
 * Xato/topilmasa null (chaqiruvchi aniq xato beradi — kredit yechilmaydi).
 */
export async function probeVideoMetaUrl(
  url: string
): Promise<{ width: number; height: number; durationSec: number; fps: number } | null> {
  if (!/^https?:\/\//i.test(String(url || ""))) return null;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration",
        "-show_entries", "format=duration",
        "-of", "json",
        url,
      ],
      { timeout: 45_000 }
    );
    const j = JSON.parse(stdout) as {
      streams?: Array<{ width?: number; height?: number; r_frame_rate?: string; duration?: string }>;
      format?: { duration?: string };
    };
    const s = j.streams?.[0];
    const width = Number(s?.width), height = Number(s?.height);
    if (!width || !height) return null;
    // fps "30000/1001" ko'rinishida
    let fps = 30;
    const fr = /^(\d+)\/(\d+)$/.exec(String(s?.r_frame_rate || ""));
    if (fr && Number(fr[2]) > 0) fps = Number(fr[1]) / Number(fr[2]);
    else if (Number(s?.r_frame_rate) > 0) fps = Number(s?.r_frame_rate);
    const durationSec = Number(s?.duration) || Number(j.format?.duration) || 0;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
    return { width, height, durationSec, fps: Number.isFinite(fps) && fps > 0 ? fps : 30 };
  } catch {
    return null;
  }
}

/**
 * Video ichidan audio referens chiqaradi:
 *  - ixtiyoriy start/end oralig'i
 *  - mono, 24kHz, mp3
 *  - kichikroq bitrate, referens uchun yetarli
 * Audio stream bo'lmasa yoki ffmpeg xato bersa false qaytaradi.
 */
export async function extractAudioReferenceForUpload(
  inputPath: string,
  outputPath: string,
  clip?: { startSec?: number; endSec?: number }
): Promise<boolean> {
  if (!fs.existsSync(inputPath)) return false;
  const args = ["-y", "-threads", "1"];
  const startSec = Number(clip?.startSec);
  const endSec = Number(clip?.endSec);
  if (Number.isFinite(startSec) && startSec > 0) args.push("-ss", startSec.toFixed(3));
  args.push("-i", inputPath);
  if (Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
    args.push("-t", Math.max(0.1, endSec - startSec).toFixed(3));
  }
  args.push(
    "-vn",
    "-ac",
    "1",
    "-ar",
    "24000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "96k",
    outputPath
  );
  try {
    await runFfmpeg(args, { timeout: 180_000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch {
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {
      /* */
    }
    return false;
  }
}
