import fs from "fs";
import path from "path";
import type { Readable } from "stream";
import yazl from "yazl";
import type { Request, Response } from "express";
import { prisma } from "@creative-tools/database";
import { findAssetPath, type TemplateAssetKind } from "./template-files.js";
import {
  sanitizeFileBaseName,
  copyZipExcluding,
  type RangedZipSource,
} from "./ingest-zip.js";
import {
  getPublicOrSignedUrl,
  getSignedDownloadUrl,
  getS3ObjectMeta,
  isS3Configured,
  resolveS3AssetKey,
  s3ObjectExists,
  createS3RangeStream,
  readS3ObjectRange,
  uploadStreamToS3,
  deleteS3Objects,
} from "./s3.js";

const MIME: Record<TemplateAssetKind, string> = {
  thumb: "image/jpeg",
  preview: "video/mp4",
  pack: "application/octet-stream",
};

/**
 * Raw `.aep` pack'ni (KONTENT-QUVURI-SXEMA.md §9 — har dastur o'z tabiiy
 * formatida saqlanadi, cross-app aylantirish yo'q) shablon nomidagi `.zip`ga
 * o'raydi — plagin va veb ikkalasi ham bitta bir xil `.zip`ni oladi (plagin
 * o'zi ochadi/import qiladi, veb foydalanuvchi o'zi ochadi). Natija
 * `templates/{id}/pack.dl.zip`da KESHLANADI — qayta so'rovlar qayta
 * yuklab-zip qilishni talab qilmaydi. `.aep` qayta yuklansa (pack-uploaded)
 * bu kesh o'chiriladi — pastga qarang.
 *
 * ⚠️ QA-FIX #7: bu yo'l FAQAT yakka `.aep` yuklangan (asset'siz) pack'lar uchun —
 * o'rash hech narsani tashlab yubormaydi, chunki .aep'ning o'zi to'liq kontent.
 * Zip bo'lib kelgan pack'lar (ingest ham endi asl zipni butunligicha
 * `templates/{id}/pack.zip` sifatida saqlaydi) bu yerdan O'TMAYDI — pastdagi
 * `/\.aep$/` sharti tufayli bayt-bir-xil xizmat qilinadi. Ingest'da zip'dan
 * faqat .aep'ni ajratib saqlashni QAYTA joriy qilma — footage/audio yo'qoladi.
 */
async function getOrBuildAepDownloadZip(
  templateId: string,
  aepKey: string
): Promise<string> {
  const cacheKey = `templates/${templateId}/pack.dl.zip`;
  if (await s3ObjectExists(cacheKey)) return cacheKey;
  // FAZA 5 (A3): TO'LIQ STREAMING — ilgari .aep tmpfs'ga (Cloud Run /tmp = RAM)
  // yuklab olinib, zip ham tmpfs'ga yozilardi (~2× pack hajmi RAM). Endi:
  // S3 GET stream → yazl (streaming deflate) → multipart PUT stream. Cho'qqi
  // xotira multipart bufferlari (~32MB) bilan chegaralanadi, pack hajmidan
  // qat'i nazar. Gate/limit mantiqqa ALOQASI YO'Q — faqat qurish usuli o'zgardi.
  const meta = await getS3ObjectMeta(aepKey);
  if (meta.sizeBytes == null) {
    throw new Error(`Pack not found in cloud storage: ${aepKey}`);
  }
  const src = createS3RangeStream(aepKey, 0, meta.sizeBytes);
  const zipfile = new yazl.ZipFile();
  // Manba stream xatosi yazl chiqishida ham ko'rinsin — upload aniq yiqilsin.
  src.on("error", (e) => (zipfile.outputStream as unknown as Readable).destroy(e));
  zipfile.addReadStream(src, path.basename(aepKey));
  zipfile.end();
  try {
    await uploadStreamToS3(
      zipfile.outputStream as Readable,
      cacheKey,
      "application/zip"
    );
  } finally {
    if (!src.destroyed) src.destroy();
  }
  return cacheKey;
}

/** metaJson.packJunkEntries'ni xavfsiz string[] sifatida o'qish. */
function readPackJunkEntries(metaJson: unknown): string[] {
  if (!metaJson || typeof metaJson !== "object") return [];
  const v = (metaJson as Record<string, unknown>).packJunkEntries;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/**
 * P35 — zip pack'ning YUKLAB-OLISH nusxasini quradi/keshlaydi: asl `pack.zip`
 * minus ingest'da yozilgan `packJunkEntries` (muallif qo'shgan preview/thumbnail
 * marketing fayllari + OS axlati). Asl pack.zip TEGILMAYDI (private, byte-bir-xil
 * saqlanadi). Natija `templates/{id}/pack.dl.zip`da keshlanadi — AYNAN raw-.aep
 * o'rami bilan bir xil kesh kaliti (pack IKKALASI bo'la olmaydi: .aep YOKI .zip),
 * shu bois re-upload'dagi kesh-invalidatsiya (contributor.ts) shu yo'lni ham qoplaydi.
 * STREAMING: yauzl ranged read → yazl write → uploadStreamToS3 (cho'qqi xotira
 * getOrBuildAepDownloadZip bilan bir xil intizom, pack hajmidan mustaqil).
 */
async function getOrBuildFilteredPackZip(
  templateId: string,
  zipKey: string,
  junkEntries: string[]
): Promise<string> {
  const cacheKey = `templates/${templateId}/pack.dl.zip`;
  if (await s3ObjectExists(cacheKey)) return cacheKey;
  const meta = await getS3ObjectMeta(zipKey);
  if (meta.sizeBytes == null) {
    throw new Error(`Pack not found in cloud storage: ${zipKey}`);
  }
  const exclude = new Set<string>();
  for (const e of junkEntries) {
    if (!e) continue;
    exclude.add(e);
    exclude.add(e.replace(/\\/g, "/"));
  }
  const source: RangedZipSource = {
    size: meta.sizeBytes,
    read: (s, e) => readS3ObjectRange(zipKey, s, e),
    stream: (s, e) => createS3RangeStream(zipKey, s, e),
  };
  const zipfile = new yazl.ZipFile();
  const outStream = zipfile.outputStream as unknown as Readable;
  const uploadP = uploadStreamToS3(outStream, cacheKey, "application/zip");
  try {
    await copyZipExcluding(source, exclude, zipfile);
    await uploadP;
  } catch (e) {
    // Yarim yozilgan kesh keyingi so'rovga chala fayl bermasin — uzib, tozalaymiz.
    if (!outStream.destroyed) outStream.destroy();
    await uploadP.catch(() => {});
    await deleteS3Objects([cacheKey]).catch(() => {});
    throw e;
  }
  return cacheKey;
}

/** Brauzer video uchun Range (206) va CORS expose */
export async function serveTemplateAsset(
  req: Request,
  res: Response,
  templateId: string,
  kind: TemplateAssetKind
) {
  const s3Key = await resolveS3AssetKey(templateId, kind);
  if (s3Key) {
    let downloadKey = s3Key;
    let filename: string | undefined;
    if (kind === "pack") {
      // FAZA 5 (C3): Content-Disposition fayl nomi ENDI HAR DOIM shablon nomi.
      // P35: metaJson ham kerak — zip pack'dan marketing fayllarni chiqarish uchun.
      const template = await prisma.contributorTemplate.findUnique({
        where: { id: templateId },
        select: { name: true, metaJson: true },
      });
      if (/\.aep$/i.test(s3Key)) {
        // Raw .aep — mijoz (plagin/veb) .zip kutadi; plagin o'zi ochadi (unzip)
        // → .aep'ni AE loyihasiga import qiladi.
        downloadKey = await getOrBuildAepDownloadZip(templateId, s3Key);
      } else if (/\.zip$/i.test(s3Key)) {
        // P35 — muallif zipga qo'shgan preview/thumbnail marketing fayllarini
        // yuklab-olish nusxasidan olib tashlaymiz. Qurish yiqilsa — ASL zipni
        // xizmat qilamiz (yuklab olishni HECH QACHON bloklamaymiz).
        const junk = readPackJunkEntries(template?.metaJson);
        if (junk.length) {
          try {
            downloadKey = await getOrBuildFilteredPackZip(templateId, s3Key, junk);
          } catch (e) {
            console.error(
              "[serve-asset] filtered pack build failed, serving original:",
              templateId,
              e
            );
            downloadKey = s3Key;
          }
        }
      }
      const ext = path.extname(downloadKey).toLowerCase() || ".zip";
      filename = `${sanitizeFileBaseName(template?.name || "template")}${ext}`;
    }
    // Pack — qimmatli (pullik) asset: qisqa muddatli signed URL (5 daqiqa),
    // shunda redirect URL'i ulashib bo'lmaydi. Thumb/preview — CDN bo'lsa public,
    // aks holda (private GCS bucket) signed URL — plain public URL 403 berardi (#1).
    const url =
      kind === "pack"
        ? await getSignedDownloadUrl(downloadKey, 300, filename)
        : await getPublicOrSignedUrl(downloadKey, 3600);
    // ?json=1 — web platforma uchun: brauzer fetch redirect'ni GCS'ga CORS'siz
    // kuzata olmaydi, shu sabab signed URL JSON'da qaytadi va klient unga
    // to'g'ridan (navigatsiya/anchor) o'tadi — navigatsiya CORS'ga tushmaydi.
    if (req.query.json === "1") {
      res.json({ url });
      return;
    }
    res.redirect(302, url);
    return;
  }

  // Bulut sozlangan bo'lsa — diskka umuman tushmaymiz (Cloud Run diski
  // ephemeral, "muvaqqat mavjud" fayl chalg'ituvchi bo'lardi). Disk fallback
  // faqat S3 sozlanmagan lokal dev muhitida ishlaydi.
  if (isS3Configured()) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filePath = findAssetPath(templateId, kind);
  if (!filePath) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  let contentType = MIME[kind];
  if (kind === "thumb" && ext === ".png") contentType = "image/png";
  if (kind === "thumb" && ext === ".webp") contentType = "image/webp";
  if (kind === "preview" && ext === ".mov") contentType = "video/quicktime";
  if (kind === "preview" && ext === ".webm") contentType = "video/webm";

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range, Accept-Ranges, Content-Length, Content-Type"
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=3600");

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        res.end();
        return;
      }
      const chunk = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", String(chunk));
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.setHeader("Content-Length", String(fileSize));
  fs.createReadStream(filePath).pipe(res);
}
