/**
 * P9 / P9.2 — MAVJUD (eski) generatsiyalar uchun display/preview derivativlarini
 *  backfill qiladi. Yangi gen'lar bularni yaratish payti oladi (gen-processor);
 *  bu esa katalog bo'shligini ("eski 27 gen soft ko'rinadi") tuzatadi.
 *
 *  - Rasm (type=130): displayKey (1280 WebP) + width/height yo'q qatorlar.
 *  - Video (type=140): previewKey (720p) + (istasa poster) + width/height yo'q qatorlar.
 *
 *  Idempotent: faqat resultKey bor VA (displayKey/previewKey null YOKI width null)
 *  qatorlar. Kredit/billing'ga ALOQASIZ. CDN'ga bog'liq EMAS (signed URL serve).
 */
import { prisma } from "@creative-tools/database";
import fs from "fs";
import os from "os";
import path from "path";
import {
  isS3Configured,
  uploadBufferToS3,
  downloadS3ToBuffer,
} from "./s3.js";
import {
  makeImageDisplayFile,
  makeVideoPreviewFile,
  extractVideoPosterFrame,
  probeMediaDimensions,
} from "./optimize-preview.js";

const ASSET_TYPE = { image: 130, video: 140 } as const;

export type BackfillResult = {
  dryRun: boolean;
  scanned: number;
  displayMade: number;
  previewMade: number;
  posterMade: number;
  dimsFilled: number;
  skipped: number;
  failed: number;
  remaining: number;
};

function baseKey(resultKey: string): string {
  return resultKey.replace(/\.[a-z0-9]+$/i, "");
}

/** Bitta rasm asset uchun display (+dims). Yozadi/qaytaradi qaysi maydonlar to'ldi. */
async function backfillImage(
  a: { id: string; resultKey: string; displayKey: string | null; width: number | null; height: number | null },
  dryRun: boolean
): Promise<{ display: boolean; dims: boolean }> {
  const need = { display: !a.displayKey, dims: a.width == null || a.height == null };
  if (!need.display && !need.dims) return { display: false, dims: false };
  const buf = await downloadS3ToBuffer(a.resultKey);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bfimg-"));
  const inPath = path.join(tmpDir, "in.img");
  const dispBase = path.join(tmpDir, "disp");
  const data: { displayKey?: string; width?: number; height?: number } = {};
  try {
    fs.writeFileSync(inPath, buf);
    if (need.dims) {
      const dim = await probeMediaDimensions(inPath);
      if (dim) { data.width = dim.width; data.height = dim.height; }
    }
    if (need.display) {
      const base = baseKey(a.resultKey);
      const disp = await makeImageDisplayFile(inPath, dispBase);
      if (disp) {
        const displayKey = base + "-disp." + disp.ext;
        await uploadBufferToS3(fs.readFileSync(disp.path), displayKey, disp.contentType);
        data.displayKey = displayKey;
      }
    }
    if (!dryRun && Object.keys(data).length) {
      await prisma.genAsset.update({ where: { id: a.id }, data });
    }
    return { display: !!data.displayKey, dims: data.width != null };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  }
}

/** Bitta video asset uchun preview (+poster agar yo'q +dims). */
async function backfillVideo(
  a: { id: string; resultKey: string; previewKey: string | null; thumbKey: string | null; width: number | null; height: number | null },
  dryRun: boolean
): Promise<{ preview: boolean; poster: boolean; dims: boolean }> {
  const need = {
    preview: !a.previewKey,
    poster: !a.thumbKey,
    dims: a.width == null || a.height == null,
  };
  if (!need.preview && !need.poster && !need.dims) return { preview: false, poster: false, dims: false };
  const buf = await downloadS3ToBuffer(a.resultKey);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bfvid-"));
  const vidPath = path.join(tmpDir, "in.mp4");
  const prevPath = path.join(tmpDir, "preview.mp4");
  const postPath = path.join(tmpDir, "poster.jpg");
  const base = baseKey(a.resultKey);
  const data: { previewKey?: string; thumbKey?: string; width?: number; height?: number } = {};
  try {
    fs.writeFileSync(vidPath, buf);
    if (need.dims) {
      const dim = await probeMediaDimensions(vidPath);
      if (dim) { data.width = dim.width; data.height = dim.height; }
    }
    if (need.poster) {
      const ok = await extractVideoPosterFrame(vidPath, postPath);
      if (ok) {
        const thumbKey = base + "-poster.jpg";
        await uploadBufferToS3(fs.readFileSync(postPath), thumbKey, "image/jpeg");
        data.thumbKey = thumbKey;
      }
    }
    if (need.preview) {
      const ok = await makeVideoPreviewFile(vidPath, prevPath);
      if (ok) {
        const previewKey = base + "-preview.mp4";
        await uploadBufferToS3(fs.readFileSync(prevPath), previewKey, "video/mp4");
        data.previewKey = previewKey;
      }
    }
    if (!dryRun && Object.keys(data).length) {
      await prisma.genAsset.update({ where: { id: a.id }, data });
    }
    return { preview: !!data.previewKey, poster: !!data.thumbKey, dims: data.width != null };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  }
}

/** Diagnoz: nechta rasm/video derivativ backfill talab qiladi (yozmaydi). */
export async function diagnoseDerivatives(): Promise<{
  images: { total: number; needDisplay: number; needDims: number };
  videos: { total: number; needPreview: number; needDims: number };
}> {
  const [imgTotal, imgNeedDisplay, imgNeedDims, vidTotal, vidNeedPreview, vidNeedDims] = await Promise.all([
    prisma.genAsset.count({ where: { type: ASSET_TYPE.image, resultKey: { not: null } } }),
    prisma.genAsset.count({ where: { type: ASSET_TYPE.image, resultKey: { not: null }, displayKey: null } }),
    prisma.genAsset.count({ where: { type: ASSET_TYPE.image, resultKey: { not: null }, width: null } }),
    prisma.genAsset.count({ where: { type: ASSET_TYPE.video, resultKey: { not: null } } }),
    prisma.genAsset.count({ where: { type: ASSET_TYPE.video, resultKey: { not: null }, previewKey: null } }),
    prisma.genAsset.count({ where: { type: ASSET_TYPE.video, resultKey: { not: null }, width: null } }),
  ]);
  return {
    images: { total: imgTotal, needDisplay: imgNeedDisplay, needDims: imgNeedDims },
    videos: { total: vidTotal, needPreview: vidNeedPreview, needDims: vidNeedDims },
  };
}

/**
 * Backfill'ni ishga tushiradi. Ketma-ket (ffmpeg semaphore baribir 1-2 slot),
 * best-effort — bitta asset xatosi butun ishni to'xtatmaydi.
 */
export async function backfillDerivatives(opts: { limit?: number; dryRun?: boolean } = {}): Promise<BackfillResult> {
  const dryRun = opts.dryRun !== false; // default DRY
  const limit = Math.max(1, opts.limit || 2000);
  const res: BackfillResult = { dryRun, scanned: 0, displayMade: 0, previewMade: 0, posterMade: 0, dimsFilled: 0, skipped: 0, failed: 0, remaining: 0 };
  if (!isS3Configured()) return res;

  const images = await prisma.genAsset.findMany({
    where: { type: ASSET_TYPE.image, resultKey: { not: null }, OR: [{ displayKey: null }, { width: null }] },
    select: { id: true, resultKey: true, displayKey: true, width: true, height: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  const videos = await prisma.genAsset.findMany({
    where: { type: ASSET_TYPE.video, resultKey: { not: null }, OR: [{ previewKey: null }, { width: null }] },
    select: { id: true, resultKey: true, previewKey: true, thumbKey: true, width: true, height: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  for (const a of images) {
    res.scanned++;
    try {
      const r = await backfillImage(a as { id: string; resultKey: string; displayKey: string | null; width: number | null; height: number | null }, dryRun);
      if (r.display) res.displayMade++;
      if (r.dims) res.dimsFilled++;
      if (!r.display && !r.dims) res.skipped++;
    } catch (e) {
      res.failed++;
      console.error(`[backfill-deriv] image ${a.id} xato:`, e instanceof Error ? e.message : e);
    }
  }
  for (const a of videos) {
    res.scanned++;
    try {
      const r = await backfillVideo(a as { id: string; resultKey: string; previewKey: string | null; thumbKey: string | null; width: number | null; height: number | null }, dryRun);
      if (r.preview) res.previewMade++;
      if (r.poster) res.posterMade++;
      if (r.dims) res.dimsFilled++;
      if (!r.preview && !r.poster && !r.dims) res.skipped++;
    } catch (e) {
      res.failed++;
      console.error(`[backfill-deriv] video ${a.id} xato:`, e instanceof Error ? e.message : e);
    }
  }

  const after = await diagnoseDerivatives();
  res.remaining = after.images.needDisplay + after.videos.needPreview;
  return res;
}
