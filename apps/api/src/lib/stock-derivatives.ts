import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "@creative-tools/database";
import {
  isS3Configured,
  resolveS3AssetKey,
  s3KeysForAsset,
  downloadS3ToFile,
  uploadFileToS3,
  deleteS3Objects,
  s3ObjectExists,
} from "./s3.js";
import {
  makeVideoPreviewFile,
  downscaleImageToPreview,
  downscaleAudioToPreview,
  extractVideoPosterFrame,
  makeAudioWaveformThumb,
} from "./optimize-preview.js";
import { syncTemplateAssetKeys } from "./asset-state.js";
import { captureException } from "./sentry.js";

/**
 * 🔴 P1 (owner qarori 2026-07-14) — STOCK TOZA PAST-RES derivativlar.
 *
 * kind='stock' item uchun TOZA pack'dan (asl fayl) SUV BELGISIZ lekin ATAYLAB PAST-RES
 * preview (+ thumb) derivativlarini yaratadi va `templates/<id>/preview.*` / `thumb.*`
 * kalitlariga yozadi. Bu kalitlar `isPublicReadKey` allow-list'ida OMMAVIY (CDN). DRM
 * endi = REZOLYUTSIYA/BITRATE (logo/sting EMAS): video ≤720p, rasm ≤1280px o'rtacha sifat,
 * audio 96k. Pack (to'liq sifat asl) TEGILMAYDI: u private/gated qoladi (pullik yuklab
 * olishda `guardDownloadable` beradi; Free limitdan keyin consumeDownload 403). Preview
 * HECH QACHON pack'ning to'liq nusxasi emas — u alohida past-res derivativ.
 *
 * 🔴 LEAK himoyasi: yozishdan keyin BOSHQA kengaytmali sibling kalitlar (masalan eski
 * `thumb.png`, `preview.mov`) O'CHIRILADI — aks holda eski (ehtimol to'liq sifat) nusxa
 * public URL bilan sizib chiqadi.
 *
 * Video shablonlar (kind='template') bu funksiyaga KELMAYDI — chaqiruvchi kind
 * tekshiradi va funksiya ham qayta tekshiradi. Idempotent (backfill/qayta-ingest).
 */
export async function generateStockWatermarkedDerivatives(id: string): Promise<boolean> {
  if (!isS3Configured()) return false;
  const row = await prisma.contributorTemplate.findUnique({
    where: { id },
    select: { id: true, kind: true, stockType: true },
  });
  // Faqat stock — template'ning preview'iga (render) tegmaymiz.
  if (!row || row.kind !== "stock") return false;
  const packKey = await resolveS3AssetKey(id, "pack");
  if (!packKey) {
    console.warn(`[stock-wm] pack (toza asl) topilmadi — ${id}`);
    return false;
  }
  // P1 (step 30) — yangi taksonomiya stockType'larini derivativ SINFIGA bog'laymiz:
  // graphics→photo (rasm overlay), motion-graphics→video (video overlay), music/sfx→audio sting.
  // Eski qiymatlar (video/photo/music/sfx) o'zgarmaydi; noma'lum → ext'dan taxmin.
  const stockType = derivativeKindForStockType(row.stockType, packKey);

  let tmpDir: string | null = null;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_wm_"));
    const packExt = path.extname(packKey) || "";
    const srcPath = path.join(tmpDir, `pack${packExt}`);
    await downloadS3ToFile(packKey, srcPath);

    const ensure: string[] = [];
    if (stockType === "video") {
      const prev = path.join(tmpDir, "preview.mp4");
      // TOZA 720p preview (suv belgisiz) — makeVideoPreviewFile (ovozsiz, CRF28).
      if (!(await makeVideoPreviewFile(srcPath, prev))) throw new Error("video preview failed");
      const previewKey = `templates/${id}/preview.mp4`;
      await uploadFileToS3(prev, previewKey, "video/mp4");
      ensure.push(previewKey);
      // Poster thumb past-res preview'DAN — grid karta rasmi (toza).
      const poster = path.join(tmpDir, "thumb.jpg");
      if (await extractVideoPosterFrame(prev, poster)) {
        const thumbKey = `templates/${id}/thumb.jpg`;
        await uploadFileToS3(poster, thumbKey, "image/jpeg");
        ensure.push(thumbKey);
      }
    } else if (stockType === "photo") {
      // Photo previewi rasm — `preview` kaliti faqat video kengaytmalarini hal qiladi,
      // shu bois photo'da display = `thumb` (grid ham, katta ko'rinish ham). TOZA ≤1280px.
      const thumbKey = `templates/${id}/thumb.jpg`;
      const th = path.join(tmpDir, "thumb.jpg");
      if (!(await downscaleImageToPreview(srcPath, th, 1280))) throw new Error("image preview failed");
      await uploadFileToS3(th, thumbKey, "image/jpeg");
      ensure.push(thumbKey);
    } else if (stockType === "music" || stockType === "sfx") {
      // TOZA past-bitrate (96k) preview (sting YO'Q). Asl to'liq sifat pack'da qoladi.
      const previewKey = `templates/${id}/preview.mp3`;
      const prev = path.join(tmpDir, "preview.mp3");
      if (!(await downscaleAudioToPreview(srcPath, prev))) throw new Error("audio preview failed");
      await uploadFileToS3(prev, previewKey, "audio/mpeg");
      ensure.push(previewKey);
      // P1.9 — waveform thumb (grid karta rasmi; audio'da vizual media yo'q). Xato → o'tkazamiz.
      const wf = path.join(tmpDir, "thumb.jpg");
      if (await makeAudioWaveformThumb(srcPath, wf)) {
        const thumbKey = `templates/${id}/thumb.jpg`;
        await uploadFileToS3(wf, thumbKey, "image/jpeg");
        ensure.push(thumbKey);
      }
    } else {
      console.warn(`[stock-wm] noma'lum stockType (${id}): ${String(stockType)}`);
      return false;
    }

    // 🔴 LEAK himoyasi — yozilgan kalitdan BOSHQA kengaytmali toza preview/thumb
    // sibling'larini o'chiramiz (aks holda toza nusxa public URL bilan chiqadi).
    const remove = await staleCleanSiblings(id, ensure);
    if (remove.length) {
      try {
        await deleteS3Objects(remove);
      } catch (e) {
        console.warn(`[stock-wm] toza sibling o'chirish xato (${id}):`, e);
      }
    }
    await syncTemplateAssetKeys(id, { ensure, remove });
    console.log(`[stock-wm] ${id} (${stockType}) suv belgili derivativ: ${ensure.join(", ")}${remove.length ? ` | toza sibling o'chirildi: ${remove.join(", ")}` : ""}`);
    return true;
  } catch (e) {
    console.error(`[stock-wm] xato (${id}):`, e);
    captureException(e, { area: "stock-watermark", templateId: id });
    return false;
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* */
      }
    }
  }
}

/** preview/thumb prefikslaridagi — yozilgan kalitlardan boshqa — mavjud sibling'lar
 *  (eski/toza nusxalar). Bulardan hech biri pack EMAS (preview/thumb key ro'yxatlari
 *  pack kalitlarini o'z ichiga olmaydi) → asl pack xavfsiz qoladi. */
async function staleCleanSiblings(id: string, wroteKeys: string[]): Promise<string[]> {
  const wrote = new Set(wroteKeys);
  const candidates = [...s3KeysForAsset(id, "preview"), ...s3KeysForAsset(id, "thumb")];
  const stale: string[] = [];
  for (const key of candidates) {
    if (wrote.has(key)) continue;
    if (await s3ObjectExists(key)) stale.push(key);
  }
  return stale;
}

/** Yangi/eski stockType → derivativ sinfi (video|photo|music|sfx). Noma'lum → ext'dan. */
function derivativeKindForStockType(stockType: string | null | undefined, packKey: string): string {
  switch (String(stockType || "")) {
    case "motion-graphics":
    case "video":
      return "video";
    case "graphics":
    case "photo":
      return "photo";
    case "music":
      return "music";
    case "sfx":
      return "sfx";
    default:
      return inferStockTypeFromExt(packKey);
  }
}

function inferStockTypeFromExt(key: string): string {
  const ext = (key.split(".").pop() || "").toLowerCase();
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "photo";
  if (["mp3", "wav", "aiff", "aac", "m4a", "ogg"].includes(ext)) return "music";
  return "";
}

/** Fire-and-forget varianti (fon; javobni bloklamaydi). ⚠️ Cloud Run javobdan keyin
 *  CPU'ni throttle qiladi — shu bois AWAITED chaqiruv afzal (backfill/ingest worker).
 *  Bu variant faqat allaqachon uzoq-yashovchi jarayon ichida ishlatilsin. */
export function generateStockDerivativesInBackground(id: string): void {
  generateStockWatermarkedDerivatives(id).catch((e) =>
    console.error(`[stock-wm] fon xato (${id}):`, e)
  );
}
