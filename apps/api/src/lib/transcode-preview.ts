import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "@creative-tools/database";
import {
  isS3Configured,
  resolveS3AssetKey,
  downloadS3ToFile,
  uploadFileToS3,
  deleteS3Objects,
} from "./s3.js";
import { optimizePreviewForStreaming, watermarkVideoToPreview } from "./optimize-preview.js";
import { syncTemplateAssetKeys } from "./asset-state.js";
import { captureException } from "./sentry.js";

/**
 * #15 (C2) — preview transcode'ni FON rejimida bajaradi (HTTP javobni bloklamaydi).
 * Manba: gen-processor.ts'dagi fire-and-forget namunasi. Presigned-PUT yo'lida
 * (brauzer → R2 to'g'ridan) preview server'ga kelmaydi; shu sabab preview-uploaded
 * signalidan keyin shu funksiya chaqiriladi va R2'dan preview'ni olib, lokal
 * transcode qilib (optimizePreviewForStreaming — #15 ffmpeg semaphore'i ostida),
 * preview.mp4 sifatida R2'ga qayta yozadi. ffmpeg konkurensiyasini optimize-preview
 * o'zining semaphore'i bilan cheklaydi — bu yerda alohida cap kerak emas.
 *
 * Status oqimi (ContributorTemplate.previewTranscodeStatus):
 *   'pending' (endpoint qo'yadi) → 'done' (muvaffaqiyat) | 'failed' (xato).
 * Xato bo'lsa preview'ni O'CHIRMAYMIZ — original (transcode'siz) R2'da qoladi,
 * kamida ko'rinadi (faststart fallback ham optimize-preview ichida).
 */
export async function processPreviewTranscode(id: string): Promise<void> {
  if (!isS3Configured()) {
    // Dev/lokal: R2 yo'q — fon transcode mavjud emas, status'ni done deb belgilaymiz
    // (preview /assets inline yo'li bilan kelishi mumkin).
    await safeStatus(id, "done", null);
    return;
  }
  let tmpDir: string | null = null;
  try {
    const srcKey = await resolveS3AssetKey(id, "preview");
    if (!srcKey) {
      // Preview hali R2'da ko'rinmayapti (eventual consistency) yoki yo'q — failed.
      await safeStatus(id, "failed", "Preview not found on R2");
      return;
    }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_tx_"));
    const ext = path.extname(srcKey) || ".mp4";
    const localPath = path.join(tmpDir, `preview${ext}`);
    await downloadS3ToFile(srcKey, localPath);

    const destKey = `templates/${id}/preview.mp4`;
    // P4 — STOCK video previewiga SUV BELGISI (kind='stock'). Video shablonlar
    // (kind='template') previewi TOZA qoladi (owner qarori — ular render, mahsulot emas).
    const row = await prisma.contributorTemplate.findUnique({
      where: { id },
      select: { kind: true },
    });
    let uploadPath = localPath;
    if (row?.kind === "stock") {
      const wmPath = path.join(tmpDir, "preview.wm.mp4");
      if (await watermarkVideoToPreview(localPath, wmPath)) {
        uploadPath = wmPath;
      } else {
        // 🔴 Suv belgisi muvaffaqiyatsiz — TOZA previewni OMMAVIY qoldirmaymiz.
        // Yuklangan (toza) preview obyektini o'chiramiz va failed belgilaymiz.
        try {
          await deleteS3Objects([srcKey]);
        } catch {
          /* */
        }
        await syncTemplateAssetKeys(id, { remove: [srcKey] });
        await safeStatus(id, "failed", "Stock watermark failed — preview withheld to avoid leaking a clean copy");
        return;
      }
    } else {
      await optimizePreviewForStreaming(localPath); // #15 semaphore ostida (false = faststart-only fallback)
    }
    await uploadFileToS3(uploadPath, destKey, "video/mp4");
    // Eski katta nusxa boshqa kalitda bo'lsa (preview.mov/.webm/kengaytmasiz) — orfan tozalash.
    if (srcKey !== destKey) {
      try {
        await deleteS3Objects([srcKey]);
      } catch (e) {
        console.warn(`[transcode-preview] orfan o'chirish xato (${srcKey}):`, e);
      }
    }
    // FAZA 5 (A2) — kalitlar keshi: preview.mp4 qo'shildi, eski kalit ketdi.
    await syncTemplateAssetKeys(id, {
      ensure: [destKey],
      remove: srcKey !== destKey ? [srcKey] : [],
    });
    await safeStatus(id, "done", null);
  } catch (e) {
    console.error(`[transcode-preview] xato (id=${id}):`, e);
    captureException(e, { area: "transcode-preview", templateId: id });
    await safeStatus(id, "failed", e instanceof Error ? e.message : String(e));
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

async function safeStatus(
  id: string,
  status: "pending" | "done" | "failed",
  error: string | null
): Promise<void> {
  try {
    await prisma.contributorTemplate.update({
      where: { id },
      data: {
        previewTranscodeStatus: status,
        previewTranscodeError: error ? error.slice(0, 480) : null,
      },
    });
  } catch (e) {
    console.warn(`[transcode-preview] status yozish xato (id=${id}):`, e);
  }
}

/**
 * Fire-and-forget — HTTP javobni bloklamaydi (gen-processor.ts namunasidek).
 * ffmpeg konkurensiyasi optimize-preview semaphore'i bilan cheklangani uchun
 * bu yerda qo'shimcha navbat shart emas: bir vaqtda ko'p chaqiruv kelsa,
 * download'lar parallel, lekin ffmpeg bosqichi FIFO navbatda (1-2 slot) ketadi.
 */
export function transcodePreviewInBackground(id: string): void {
  processPreviewTranscode(id).catch((e) =>
    console.error(`[transcode-preview] fon xato (${id}):`, e)
  );
}
