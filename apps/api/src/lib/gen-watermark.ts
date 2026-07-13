import fs from "fs";
import os from "os";
import path from "path";
import { isS3Configured, uploadFileToS3, downloadS3ToFile } from "./s3.js";
import { isPublicReadKey } from "./public-keys.js";
import {
  watermarkVideoToPreview,
  watermarkImageFile,
  watermarkAudioToPreview,
  watermarkAssetAvailable,
} from "./optimize-preview.js";
import { captureException } from "./sentry.js";

/**
 * P4 (14b) — AI GENERATSIYA SUV BELGISI (owner qarori 2026-07-13, A varianti).
 *
 * FREE reja foydalanuvchisi O'Z generatsiyasini YUKLAB OLGANDA / IMPORT qilganda suv belgili
 * fayl olishi kerak (narx sahifasi va'dasi: Free = "Watermarked export", Pro = "watermark-free").
 * Bu modul TOZA gen bufer'idan (yoki asl kalitdan) SUV BELGILI derivativ yaratadi — step-14
 * STOCK suv belgisi ffmpeg dvigatelini (`optimize-preview.ts`) QAYTA ishlatadi (yangi quvur YO'Q).
 *
 * 🔴 XAVFSIZLIK:
 *  - Chiqish kaliti `gen/<uid>/<id>-<ts>-wm.<ext>` — `isPublicReadKey` uni OMMAVIY qilmaydi
 *    (gen public suffikslari faqat -thumb/-poster/-preview/-disp) → private qoladi, CDN 403 beradi.
 *    Shu bois FREE'ga ham FAQAT qisqa muddatli SIGNED havola orqali beriladi (shaxsiy kontent).
 *  - TOZA asl (`gen/<uid>/<id>-<ts>.<ext>`) TEGILMAYDI — private/gated qoladi; pullik reja oladi.
 *  - Best-effort: suv belgisi asseti yo'q / ffmpeg xato → null. Chaqiruvchi (`hydrateGenAssets`)
 *    null'da TOZA asl'ni FREE'ga BERMAYDI — kichik display derivativ fallback'ga tushadi (4K toza
 *    hech qachon chiqmaydi).
 */

export type GenWmKind = "image" | "video" | "audio";

/** gen mode → suv belgisi turi. voice/music/sfx → audio (sting tegi); video → video (720p+wm); qolgan → image. */
export function wmKindForMode(mode: string | null | undefined): GenWmKind {
  if (mode === "video") return "video";
  if (mode === "voice" || mode === "music" || mode === "sfx") return "audio";
  return "image";
}

/** GenAsset.type (130=image,120=audio,140=video) → suv belgisi turi (backfill uchun). */
export function wmKindForAssetType(type: number): GenWmKind {
  if (type === 140) return "video";
  if (type === 120) return "audio";
  return "image";
}

/** resultKey → suv belgili derivativ kaliti (`<base>-wm.<ext>`). Asl kengaytma o'rniga wm chiqishi
 *  kengaytmasi ishlatiladi (video=mp4, audio=mp3, image=jpg). */
function wmKeyFor(resultKey: string, ext: string): string {
  const base = resultKey.replace(/\.[a-z0-9]+$/i, "");
  return `${base}-wm.${ext}`;
}

/**
 * Lokal fayl (`srcPath`, toza asl) → suv belgili derivativ → GCS'ga yuklaydi. Kalitni qaytaradi
 * yoki null (asset yo'q / ffmpeg xato). Barcha ffmpeg step-14 semaphore'i ostida ishlaydi.
 */
async function watermarkLocalToKey(
  srcPath: string,
  resultKey: string,
  kind: GenWmKind
): Promise<string | null> {
  if (!fs.existsSync(srcPath) || !watermarkAssetAvailable()) return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "genwm-out-"));
  try {
    let out: string;
    let ext: string;
    let contentType: string;
    if (kind === "video") {
      ext = "mp4"; contentType = "video/mp4";
      out = path.join(tmpDir, "wm.mp4");
      if (!(await watermarkVideoToPreview(srcPath, out))) return null;
    } else if (kind === "audio") {
      ext = "mp3"; contentType = "audio/mpeg";
      out = path.join(tmpDir, "wm.mp3");
      if (!(await watermarkAudioToPreview(srcPath, out))) return null;
    } else {
      ext = "jpg"; contentType = "image/jpeg";
      out = path.join(tmpDir, "wm.jpg");
      // maxLong BERILMAYDI → asl o'lchamda (suv belgisi = himoya, past-res emas).
      if (!(await watermarkImageFile(srcPath, out))) return null;
    }
    const key = wmKeyFor(resultKey, ext);
    // 🔴 Guard: chiqish kaliti public allow-list'ga tushib qolmasin (aks holda CDN'da ochilardi).
    if (isPublicReadKey(key)) {
      console.error(`[gen-wm] MANTIQ XATOSI — wm kaliti public bo'lib qoldi (${key}); yuklanmadi`);
      return null;
    }
    await uploadFileToS3(out, key, contentType);
    return key;
  } catch (e) {
    captureException(e, { area: "gen-watermark", resultKey });
    console.error(`[gen-wm] xato (${resultKey}):`, e);
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  }
}

/**
 * Gen buferidan (gen-processor scope'ida bor → qayta yuklab olinmaydi) suv belgili derivativ.
 * Muvaffaqiyatda wm kalitini, aks holda null qaytaradi (best-effort — gen oqimini BUZMAYDI).
 */
export async function makeGenWatermarkFromBuffer(
  resultKey: string | null,
  buf: Buffer,
  mode: string | null | undefined
): Promise<string | null> {
  if (!resultKey || !isS3Configured() || !watermarkAssetAvailable()) return null;
  const kind = wmKindForMode(mode);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "genwm-src-"));
  try {
    const srcExt = (resultKey.match(/\.([a-z0-9]+)$/i) || [])[1] ||
      (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "png");
    const src = path.join(tmpDir, `src.${srcExt}`);
    fs.writeFileSync(src, buf);
    return await watermarkLocalToKey(src, resultKey, kind);
  } catch (e) {
    captureException(e, { area: "gen-watermark-buf", resultKey });
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  }
}

/**
 * Asl kalitni GCS'dan yuklab olib suv belgili derivativ yaratadi (backfill uchun — eski
 * qatorlarda bufer yo'q). Kalitni yoki null qaytaradi.
 */
export async function makeGenWatermarkFromKey(
  resultKey: string,
  kind: GenWmKind
): Promise<string | null> {
  if (!isS3Configured() || !watermarkAssetAvailable()) return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "genwm-dl-"));
  try {
    const srcExt = (resultKey.match(/\.([a-z0-9]+)$/i) || [])[1] ||
      (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "png");
    const src = path.join(tmpDir, `src.${srcExt}`);
    await downloadS3ToFile(resultKey, src);
    return await watermarkLocalToKey(src, resultKey, kind);
  } catch (e) {
    captureException(e, { area: "gen-watermark-key", resultKey });
    console.error(`[gen-wm] backfill xato (${resultKey}):`, e);
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  }
}
