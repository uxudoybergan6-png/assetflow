import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ── P4 — STOCK SUV BELGISI assetlari (YAGONA MANBA) ──────────────────────────
// Suv belgisi fayllari `apps/api/assets/` da SAQLANADI (src EMAS): `tsc` src'dagi
// PNG'ni dist'ga KO'CHIRMAYDI, lekin Dockerfile `COPY . .` bilan butun repo'ni
// (apps/api/assets ham) image'ga oladi. Runtime yo'l = dist/lib'dan ikki bo'g'in
// yuqoriga (template-files.ts UPLOADS_ROOT naqshi bilan bir xil). Klientda EMAS —
// server tomonda ffmpeg overlay bilan qo'yiladi (klient-side suv belgisi osongina
// aylanib o'tiladi — P23 GAP1/P4). BITTA joydan o'qiladi: shu ikki konstanta.
const __wmDir = path.dirname(fileURLToPath(import.meta.url));
export const WATERMARK_PNG = path.join(__wmDir, "../../assets/watermark.png");
export const WATERMARK_STING = path.join(__wmDir, "../../assets/watermark-sting.mp3");
/** Suv belgisi rasmi runtime'da mavjudmi (yo'q → suv belgili derivativ YARATILMAYDI —
 *  toza previewni OMMAVIY qilib qo'ymaslik uchun; asl fayl baribir pack'da xavfsiz). */
export function watermarkAssetAvailable(): boolean {
  try {
    return fs.existsSync(WATERMARK_PNG);
  } catch {
    return false;
  }
}

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

/**
 * P1 (step 30) — AI vision uchun bitta kadr chiqaradi (`tsSec` nuqtasidan). `source`
 * lokal fayl YOKI http(s) URL (katta videoni yuklamasdan — ffmpeg seek range bilan).
 * ~640px, JPEG. Xato → false (AI fallback name'ga o'tadi, ingest bloklanmaydi). */
export async function extractFrameAt(
  source: string,
  outPath: string,
  tsSec: number
): Promise<boolean> {
  const isUrl = /^https?:\/\//i.test(source);
  if (!isUrl && !fs.existsSync(source)) return false;
  try {
    await runFfmpeg(
      [
        "-y",
        "-threads", "1",
        "-ss", Math.max(0, tsSec).toFixed(3),
        "-i", source,
        "-frames:v", "1",
        "-vf", "scale=-2:'min(640,ih)'",
        "-q:v", "4",
        outPath,
      ],
      { timeout: 60_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {
      /* */
    }
    return false;
  }
}

// P9 — manba alfa kanaliga egami (JPEG shaffoflikni yo'qotadi; fallback PNG kerak bo'lsa aniqlaymiz)
const ALPHA_PIX_FMTS = new Set([
  "rgba", "bgra", "argb", "abgr", "rgba64be", "rgba64le", "bgra64be", "bgra64le",
  "yuva420p", "yuva422p", "yuva444p", "yuva420p9be", "yuva420p9le", "yuva444p10be",
  "yuva444p10le", "ya8", "ya16be", "ya16le", "gbrap", "gbrap10be", "gbrap10le", "pal8",
]);
async function probeHasAlpha(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", filePath],
      { timeout: 20_000 }
    );
    return ALPHA_PIX_FMTS.has(stdout.trim());
  } catch {
    return false;
  }
}

// uzun chekkani 1280 ga cheklaydi (landshaft → kenglik, portret → balandlik); ikkinchisi -2 (juft son)
const DISPLAY_SCALE = "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'";

async function tryEncodeDisplay(inputPath: string, outPath: string, codecArgs: string[]): Promise<boolean> {
  try {
    await runFfmpeg(["-y", "-threads", "1", "-i", inputPath, "-vf", DISPLAY_SCALE, "-frames:v", "1", ...codecArgs, outPath], { timeout: 45_000 });
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

/**
 * P9 — karta grid'i uchun "display" derivativ: ~1280px UZUN chekka, YUQORI sifat.
 *  Retina kartada aniq (2×) rasm; 512px thumb kichik/list uchun qoladi.
 *  Format tanlash (chidamli — ffmpeg build'ida libwebp bo'lmasligi mumkin):
 *    1) WebP (libwebp) — alfa saqlanadi, kichik. AGAR encoder yo'q → fallback:
 *    2) alfa bor manba → PNG (alfa saqlanadi), 3) aks holda JPEG q2 (yuqori sifat).
 *  outBasePath = kengaytmasiz yo'l; chiqish <outBasePath>.<ext> ga yoziladi.
 *  Qaytaradi: { path, ext, contentType } yoki null (thumb/asl fallback).
 *  ffmpeg semaphore ostida (tryEncodeDisplay → runFfmpeg).
 */
export async function makeImageDisplayFile(
  inputPath: string,
  outBasePath: string
): Promise<{ path: string; ext: string; contentType: string } | null> {
  if (!fs.existsSync(inputPath)) return null;
  // 1) WebP (alfani avtomat kodlaydi — pix_fmt MAJBURLANMAYDI)
  const webpPath = outBasePath + ".webp";
  if (await tryEncodeDisplay(inputPath, webpPath, ["-c:v", "libwebp", "-quality", "82", "-compression_level", "4"])) {
    return { path: webpPath, ext: "webp", contentType: "image/webp" };
  }
  // 2/3) libwebp yo'q — alfaga qarab PNG yoki JPEG
  const hasAlpha = await probeHasAlpha(inputPath);
  if (hasAlpha) {
    const pngPath = outBasePath + ".png";
    if (await tryEncodeDisplay(inputPath, pngPath, ["-c:v", "png"])) {
      return { path: pngPath, ext: "png", contentType: "image/png" };
    }
  }
  const jpgPath = outBasePath + ".jpg";
  if (await tryEncodeDisplay(inputPath, jpgPath, ["-c:v", "mjpeg", "-q:v", "2"])) {
    return { path: jpgPath, ext: "jpg", contentType: "image/jpeg" };
  }
  return null;
}

/**
 * P9.2 — generatsiya videosi uchun 720p HOVER-preview transcode'i, ALOHIDA faylga
 *  (in-place EMAS — asl fayl saqlanadi, lightbox/download asl'ni ishlatadi).
 *  optimizePreviewForStreaming shablonlar uchun (o'z ustiga yozadi) — gen'da
 *  asl'ni yo'qotmaslik uchun bu variant kerak. 720p, H.264 CRF 28, 30fps, ovozsiz,
 *  +faststart. ffmpeg semaphore ostida. Xato: false (hover asl'ga fallback qiladi).
 */
export async function makeVideoPreviewFile(
  inputPath: string,
  outPath: string
): Promise<boolean> {
  if (!fs.existsSync(inputPath)) return false;
  try {
    await runFfmpeg(
      [
        "-y", "-threads", "1",
        "-i", inputPath,
        "-vf", "scale=-2:'min(720,ih)'",
        "-r", "30",
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-an",
        "-movflags", "+faststart",
        outPath,
      ],
      { timeout: 300_000 }
    );
    return fs.existsSync(outPath);
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
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

// ── P1 (step 30) — TO'LIQ ffprobe SPEC (fayl-o'zidan, hech qachon taxmin emas) ──
export type MediaSpec = {
  width: number | null;
  height: number | null;
  durationSec: number | null;
  fps: number | null;
  hasAlpha: boolean | null;
  videoCodec: string | null;
  audioCodec: string | null;
  audioBitrate: number | null;
  sampleRate: number | null;
  orient: "horizontal" | "vertical" | "square" | null;
};

/** Alfa-qodir piksel formatlari (ffprobe pix_fmt) — .mov ProRes 4444 / QT RLE / webm VP9. */
const SPEC_ALPHA_PIX_FMTS = new Set([
  "yuva420p", "yuva422p", "yuva444p", "yuva420p10le", "yuva444p10le",
  "rgba", "argb", "abgr", "bgra", "ya8", "ya16le", "gbrap", "gbrap10le", "gbrap12le",
]);

/**
 * Bitta media faylning to'liq specini o'qiydi (video/rasm/audio). `source` lokal fayl
 * yo'li YOKI http(s) URL (katta videoni yuklab OLMASDAN — ffprobe range-so'rovlar bilan
 * o'qiydi). ffprobe JSON — hech narsa taxmin qilinmaydi; o'qib bo'lmasa mos maydon null.
 * HECH QACHON throw qilmaydi (ingest bloklanmasin) — xatoda hamma maydon null. */
export async function probeMediaSpec(source: string): Promise<MediaSpec> {
  const empty: MediaSpec = {
    width: null, height: null, durationSec: null, fps: null, hasAlpha: null,
    videoCodec: null, audioCodec: null, audioBitrate: null, sampleRate: null, orient: null,
  };
  const isUrl = /^https?:\/\//i.test(source);
  if (!isUrl && !fs.existsSync(source)) return empty;
  const filePath = source;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate:format=duration,bit_rate",
        "-of", "json",
        filePath,
      ],
      { timeout: 45_000 }
    );
    const j = JSON.parse(stdout) as {
      streams?: Array<Record<string, unknown>>;
      format?: Record<string, unknown>;
    };
    const streams = j.streams || [];
    const v = streams.find((s) => s.codec_type === "video");
    const a = streams.find((s) => s.codec_type === "audio");
    const out: MediaSpec = { ...empty };

    if (v) {
      const w = Number(v.width), h = Number(v.height);
      if (w > 0 && h > 0) {
        out.width = w;
        out.height = h;
        out.orient = w > h * 1.1 ? "horizontal" : h > w * 1.1 ? "vertical" : "square";
      }
      out.videoCodec = typeof v.codec_name === "string" ? v.codec_name : null;
      // fps "30000/1001" → 29.97
      const fr = /^(\d+)\/(\d+)$/.exec(String(v.r_frame_rate || ""));
      if (fr && Number(fr[2]) > 0) out.fps = round2(Number(fr[1]) / Number(fr[2]));
      else if (Number(v.r_frame_rate) > 0) out.fps = round2(Number(v.r_frame_rate));
      const pf = String(v.pix_fmt || "").toLowerCase();
      if (pf) out.hasAlpha = SPEC_ALPHA_PIX_FMTS.has(pf);
    }
    if (a) {
      out.audioCodec = typeof a.codec_name === "string" ? a.codec_name : null;
      const sr = Number(a.sample_rate);
      if (sr > 0) out.sampleRate = sr;
      const abr = Number(a.bit_rate) || Number(j.format?.bit_rate);
      if (abr > 0) out.audioBitrate = Math.round(abr);
    }
    const dur = Number(j.format?.duration) || Number(v?.duration) || Number(a?.duration);
    if (Number.isFinite(dur) && dur > 0) out.durationSec = round2(dur);
    // Still rasm (png/mjpeg/webp/bmp/gif) — ffprobe soxta fps (25) beradi → null.
    if (out.videoCodec && /^(png|mjpeg|webp|bmp|gif|tiff)$/i.test(out.videoCodec)) out.fps = null;
    return out;
  } catch {
    return empty;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * P1.10 — LOOPED taxmini (heuristik; EGA QARORI: algoritm taxmin qilsin). Birinchi va
 * OXIRGI kadrni ALOHIDA fayl sifatida chiqarib (-ss input-seek — ishonchli), difference
 * blend + signalstats YAVG (o'rtacha yorqinlik farqi 0..255) hisoblaydi; chegaradan past
 * → seamless loop. `source` lokal fayl yoki URL. HECH QACHON throw QILMAYDI / uploadni
 * to'xtatmaydi — xato/aniqlanmasa null (P1.10). MUHIM: heuristik, ba'zan xato — admin
 * edit wizardda tuzatishi mumkin. Chegara ehtiyotkor (past false-positive): faqat juda
 * o'xshash kadrlar loop deb belgilanadi.
 */
export async function detectLoopedFromVideo(
  source: string,
  durationSec: number | null
): Promise<boolean | null> {
  const isUrl = /^https?:\/\//i.test(source);
  if (!isUrl && !fs.existsSync(source)) return null;
  const dur = Number(durationSec);
  if (!Number.isFinite(dur) || dur < 0.6) return null; // juda qisqa → ishonchsiz
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_loop_"));
  try {
    const first = path.join(tmpDir, "first.jpg");
    const last = path.join(tmpDir, "last.jpg");
    const okA = await extractFrameAt(source, first, 0.05);
    const okB = await extractFrameAt(source, last, Math.max(0.1, dur - 0.06));
    if (!okA || !okB) return null;
    // Ikki ALOHIDA rasm kirishi → toza difference blend (in-graph double-trim ishonchsiz edi).
    const { stdout, stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-v", "info",
        "-i", first,
        "-i", last,
        "-filter_complex",
        "[0:v]scale=64:64,format=gray[a];[1:v]scale=64:64,format=gray[b];" +
          "[a][b]blend=all_mode=difference,signalstats,metadata=print:file=-[out]",
        "-map", "[out]", "-f", "null", "-",
      ],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 }
    ).catch((e: unknown) => {
      const err = e as { stdout?: string; stderr?: string };
      return { stdout: err.stdout || "", stderr: err.stderr || "" };
    });
    const blob = String(stdout || "") + "\n" + String(stderr || "");
    const m = /lavfi\.signalstats\.YAVG=([0-9.]+)/i.exec(blob);
    if (!m) return null;
    const yavg = Number(m[1]);
    if (!Number.isFinite(yavg)) return null;
    // Ehtiyot chegara: YAVG < 5/255 (~2%) → seamless loop. Yuqori = false-positive kam.
    return yavg < 5;
  } catch {
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
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

/**
 * P1.9 / P4 (step 33) — audio (Music/SFX) uchun WAVEFORM thumb (grid karta rasmi).
 * Audio'da vizual media yo'q → showwavespic bilan to'lqin shakli chiziladi. Xato → false
 * (karta gradient bilan chiqadi, ingest bloklanmaydi). Suv belgisi shart emas (waveform
 * asl audio'ni oshkor qilmaydi — faqat amplituda shakli).
 */
export async function makeAudioWaveformThumb(
  inputPath: string,
  outPath: string
): Promise<boolean> {
  if (!fs.existsSync(inputPath)) return false;
  try {
    await runFfmpeg(
      [
        "-y", "-threads", "1",
        "-i", inputPath,
        "-filter_complex",
        "showwavespic=s=1280x400:colors=#8b5cf6|#a78bfa:split_channels=0",
        "-frames:v", "1",
        outPath,
      ],
      { timeout: 60_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

// ── P1 (owner 2026-07-14) — STOCK TOZA PAST-RES preview quvurlari ────────────
// Suv belgisi (logo/sting) OLIB TASHLANDI. DRM endi = REZOLYUTSIYA/BITRATE: preview
// toza lekin ataylab past-res; to'liq sifat asl FAQAT private `pack` da qoladi. Video
// uchun `makeVideoPreviewFile` (720p, ovozsiz) qayta ishlatiladi.

/** STOCK rasm previewi/thumbi — TOZA, uzun chekka ≤maxLong, o'rtacha sifat (q:v 5).
 *  Suv belgisi yo'q; past-res DRM. Xato → false. */
export async function downscaleImageToPreview(
  inputPath: string,
  outPath: string,
  maxLong = 1280
): Promise<boolean> {
  if (!fs.existsSync(inputPath)) return false;
  const scale = `scale='if(gt(iw,ih),min(${maxLong},iw),-2)':'if(gt(iw,ih),-2,min(${maxLong},ih))'`;
  try {
    await runFfmpeg(
      ["-y", "-threads", "1", "-i", inputPath, "-vf", scale, "-frames:v", "1", "-q:v", "5", outPath],
      { timeout: 45_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

/** STOCK audio previewi — TOZA (sting YO'Q) lekin KAMAYTIRILGAN bitrate (96k stereo).
 *  Past-res DRM; to'liq sifat asl pack'da. Xato → false. */
export async function downscaleAudioToPreview(
  inputPath: string,
  outPath: string
): Promise<boolean> {
  if (!fs.existsSync(inputPath)) return false;
  try {
    await runFfmpeg(
      [
        "-y", "-threads", "1",
        "-i", inputPath,
        "-vn",
        "-ar", "44100",
        "-ac", "2",
        "-c:a", "libmp3lame",
        "-b:a", "96k",
        outPath,
      ],
      { timeout: 180_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

// ── P4 — STOCK SUV BELGISI ffmpeg quvurlari (DORMANT — endi chaqirilmaydi) ─────
// Hammasi shu fayldagi `runFfmpeg` semaphore'i ostida (yangi quvur/semaphore YO'Q —
// P4 talabi). Suv belgisi = markazda, yarim-shaffof `WATERMARK_PNG` overlay'i,
// `scale2ref` bilan asos kengligining ~40% ga o'lchanadi (nisbat saqlanadi). Manba
// (pack.*) HECH QACHON bu yerga tushmaydi — faqat suv belgili preview/thumb
// derivativlari yaratiladi; asl toza fayl pack'da (private, gated) qoladi (P4.1).
const WM_OVERLAY_VIDEO =
  "[0:v]scale=-2:'min(720,ih)'[base];" +
  "[1:v]format=rgba,colorchannelmixer=aa=0.55[wmc];" +
  "[wmc][base]scale2ref=w='main_w*0.40':h='main_w*0.40*ih/iw'[wm][base2];" +
  "[base2][wm]overlay=(W-w)/2:(H-h)/2[o]";
const WM_OVERLAY_IMAGE =
  "[1:v]format=rgba,colorchannelmixer=aa=0.60[wmc];" +
  "[wmc][0:v]scale2ref=w='main_w*0.40':h='main_w*0.40*ih/iw'[wm][base];" +
  "[base][wm]overlay=(W-w)/2:(H-h)/2[o]";

/**
 * P4 — STOCK video previewi: 720p ga kichraytiradi + markaziy suv belgisi overlay'i
 * + H.264 CRF28, 30fps, ovozsiz, +faststart. `outPath` ALOHIDA fayl (asl saqlanadi).
 * Suv belgisi rasmi bo'lmasa (watermarkAssetAvailable=false) → false (toza previewni
 * OMMAVIY qilib qo'ymaymiz). Preview ataylab past-sifat — bu esa (logotipdan ko'ra)
 * asosiy himoya (P4.7). Video shablonlar (kind='template') bu yo'ldan O'TMAYDI.
 */
export async function watermarkVideoToPreview(
  inputPath: string,
  outPath: string
): Promise<boolean> {
  if (!fs.existsSync(inputPath) || !watermarkAssetAvailable()) return false;
  try {
    await runFfmpeg(
      [
        "-y", "-threads", "1",
        "-i", inputPath,
        "-i", WATERMARK_PNG,
        "-filter_complex", WM_OVERLAY_VIDEO,
        "-map", "[o]",
        "-r", "30",
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-an",
        "-movflags", "+faststart",
        outPath,
      ],
      { timeout: 300_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

/**
 * P4 — STOCK rasm (photo/graphics) previewi/thumbi: markaziy suv belgisi overlay'i.
 * `maxLong` berilsa uzun chekka shu piksel bilan cheklanadi (thumb = kichik, preview =
 * kattaroq). JPEG q=4 (~preview-grade). Asl toza rasm pack'da qoladi.
 */
export async function watermarkImageFile(
  inputPath: string,
  outPath: string,
  maxLong?: number
): Promise<boolean> {
  if (!fs.existsSync(inputPath) || !watermarkAssetAvailable()) return false;
  const scalePre =
    maxLong && maxLong > 0
      ? `[0:v]scale='if(gt(iw,ih),min(${maxLong},iw),-2)':'if(gt(iw,ih),-2,min(${maxLong},ih))'[s0];`
      : "";
  const imgInput = scalePre ? "[s0]" : "[0:v]";
  const fc =
    scalePre +
    "[1:v]format=rgba,colorchannelmixer=aa=0.60[wmc];" +
    `[wmc]${imgInput}scale2ref=w='main_w*0.40':h='main_w*0.40*ih/iw'[wm][base];` +
    "[base][wm]overlay=(W-w)/2:(H-h)/2[o]";
  try {
    await runFfmpeg(
      [
        "-y", "-threads", "1",
        "-i", inputPath,
        "-i", WATERMARK_PNG,
        "-filter_complex", maxLong && maxLong > 0 ? fc : WM_OVERLAY_IMAGE,
        "-map", "[o]",
        "-frames:v", "1",
        "-q:v", "4",
        outPath,
      ],
      { timeout: 45_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}

/**
 * P4 — STOCK audio (music/sfx) previewi: eshitiladigan "sting" tegini har ~12s
 * qo'shadi (Envato/Artlist uslubi) + bitrate'ni kamaytiradi. Sting = WATERMARK_STING
 * (12s slotga sukut bilan to'ldirilib, davomiylik bo'ylab takrorlanadi). Asl toza
 * audio pack'da qoladi. Sting fayli yo'q bo'lsa → false (toza previewni bermaymiz).
 */
export async function watermarkAudioToPreview(
  inputPath: string,
  outPath: string
): Promise<boolean> {
  if (!fs.existsSync(inputPath) || !fs.existsSync(WATERMARK_STING)) return false;
  try {
    await runFfmpeg(
      [
        "-y", "-threads", "1",
        "-i", inputPath,
        "-i", WATERMARK_STING,
        // sting: 12s slotga sukut bilan cho'ziladi, cheksiz loop, manba davomiyligiga kesiladi;
        // amix manba (og'irlik 1) + sting (0.55) — normalize=0 (manba balandligi tushmaydi).
        "-filter_complex",
        "[1:a]apad=whole_dur=12,aloop=loop=-1:size=2000000000[stg];" +
          "[0:a][stg]amix=inputs=2:duration=first:weights='1 0.55':normalize=0[a]",
        "-map", "[a]",
        "-ar", "44100",
        "-ac", "2",
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        outPath,
      ],
      { timeout: 180_000 }
    );
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
  } catch {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { /* */ }
    return false;
  }
}
