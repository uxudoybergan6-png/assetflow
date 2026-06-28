import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { findAssetPath, type TemplateAssetKind } from "./template-files.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION ?? "auto";
const bucket = process.env.AWS_S3_BUCKET ?? "";
const cdnBase = process.env.CDN_BASE_URL ?? "";
// Cloudflare R2 uchun: S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
const endpoint = process.env.S3_ENDPOINT ?? undefined;

export const s3 = new S3Client({
  region,
  ...(endpoint ? { endpoint, forcePathStyle: false } : {}),
  // AWS SDK v3 (2025+) default `when_supported` checksumi stream body ustidan
  // CRC32 ni OLDINDAN hisoblaydi — Cloudflare R2 stream-trailer checksumni
  // ishonchli qo'llamagani uchun SDK butun faylni XOTIRAGA yig'adi (512MB OOM).
  // `WHEN_REQUIRED` — faqat zarur bo'lsa; stream chinakam stream bo'lib qoladi.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      }
    : undefined,
});

// Brauzer/CDN keshi — thumb/preview/sahna assetlari deyarli o'zgarmaydi (key
// bo'yicha versiyalangan), shu sabab uzoq immutable kesh egress'ni kamaytiradi.
export const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function getPublicUrl(key: string): string {
  if (cdnBase) return `${cdnBase.replace(/\/$/, "")}/${key}`;
  if (bucket && region) {
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
  return `/placeholder/${key}`;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (!bucket) {
    return getPublicUrl(key);
  }
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Tashqi xizmat (masalan Magnific remove-bg) O'ZI YUKLAB OLADIGAN URL.
 * CDN_BASE_URL bo'lsa — TOZA public URL (so'rov-satrisiz, ".png" bilan tugaydi):
 * uchinchi-tomon downloaderlar buni ishonchli oladi. Presigned URL'ning uzun
 * `X-Amz-*` query-string'i + fayl-kengaytmasiz tugashi ba'zi downloaderlarni
 * adashtiradi → "Failed to download the image". CDN yo'q bo'lsa — presigned GET
 * (signature kirishni kafolatlaydi) zaxira sifatida.
 */
export async function getPublicOrSignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (cdnBase) return getPublicUrl(key);
  return getSignedDownloadUrl(key, expiresIn);
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export function isS3Configured(): boolean {
  return Boolean(bucket && process.env.AWS_ACCESS_KEY_ID);
}

export async function s3ObjectExists(key: string): Promise<boolean> {
  if (!isS3Configured()) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getS3ObjectMeta(
  key: string
): Promise<{ sizeBytes: number | null; contentType: string | null }> {
  if (!isS3Configured()) return { sizeBytes: null, contentType: null };
  try {
    const out = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      sizeBytes: typeof out.ContentLength === "number" ? out.ContentLength : null,
      contentType: typeof out.ContentType === "string" ? out.ContentType : null,
    };
  } catch {
    return { sizeBytes: null, contentType: null };
  }
}

/** R2 da pack/preview/thumb turli kengaytma bilan saqlanishi mumkin */
export function s3KeysForAsset(templateId: string, kind: TemplateAssetKind): string[] {
  const base = `templates/${templateId}/${kind}`;
  if (kind === "pack") {
    return [base, `${base}.mogrt`, `${base}.zip`, `${base}.aep`];
  }
  if (kind === "preview") {
    return [base, `${base}.mp4`, `${base}.mov`, `${base}.webm`];
  }
  return [base, `${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`];
}

export async function resolveS3AssetKey(
  templateId: string,
  kind: TemplateAssetKind
): Promise<string | null> {
  if (!isS3Configured()) return null;
  for (const key of s3KeysForAsset(templateId, kind)) {
    if (await s3ObjectExists(key)) return key;
  }
  return null;
}

/**
 * knownS3Keys to'plamidan asset uchun mavjud birinchi kalitni qaytaradi —
 * HeadObject'siz (tarmoqsiz). Katalogda to'g'ridan CDN public URL qurish uchun
 * ishlatiladi (Render orqali stream qilinmasin → bandwidth = 0).
 */
export function s3AssetKeyFromSet(
  templateId: string,
  kind: TemplateAssetKind,
  knownS3Keys: Set<string>
): string | null {
  for (const key of s3KeysForAsset(templateId, kind)) {
    if (knownS3Keys.has(key)) return key;
  }
  return null;
}

/** Startup diagnostikasi — R2/S3 sozlanganmi va qaysi config mavjud (kalitlarni oshkor qilmasdan). */
export function logS3Diagnostics(): void {
  console.log(
    `[s3] isS3Configured=${isS3Configured()} ` +
      `bucket=${bucket ? "set" : "MISSING"} ` +
      `accessKey=${process.env.AWS_ACCESS_KEY_ID ? "set" : "MISSING"} ` +
      `endpoint=${endpoint ? "set" : "(aws default)"} ` +
      `cdnBase=${cdnBase ? cdnBase : "MISSING (→ Render stream fallback!)"}`
  );
}

/**
 * Bir template uchun barcha S3 kalitlarini bitta ListObjectsV2 da olish.
 * N+1 HeadObject muammosini bartaraf etadi — catalog so'rovida har shablon
 * uchun alohida HeadObject o'rniga bitta List chaqiruvi ishlatiladi.
 */
export async function listTemplateS3Keys(templateId: string): Promise<Set<string>> {
  if (!isS3Configured()) return new Set();
  const prefix = `templates/${templateId}/`;
  const set = new Set<string>();
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) set.add(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
  return set;
}

/** Lokal disk + R2/S3 — preview/thumb/pack mavjudligi.
 *  knownS3Keys berilsa HeadObject chaqirilmaydi (N+1 oldini olish). */
export async function templateAssetFlags(
  templateId: string,
  knownS3Keys?: Set<string>
) {
  const kinds: TemplateAssetKind[] = ["thumb", "preview", "pack"];
  const assets: Record<TemplateAssetKind, boolean> = {
    thumb: !!findAssetPath(templateId, "thumb"),
    preview: !!findAssetPath(templateId, "preview"),
    pack: !!findAssetPath(templateId, "pack"),
  };
  if (isS3Configured()) {
    if (knownS3Keys) {
      for (const kind of kinds) {
        if (!assets[kind]) {
          assets[kind] = s3KeysForAsset(templateId, kind).some((k) =>
            knownS3Keys.has(k)
          );
        }
      }
      // #13: pack — pullik/gated asset. Katalog `hasPack` ListObjectsV2'dan
      // (eventual-consistent) keladi, serve esa HeadObject (resolveS3AssetKey,
      // strongly-consistent) bilan tekshiradi. Just-uploaded/just-deleted pack
      // holatida ular nomuvofiq bo'lib, katalog hasPack:true bersa-da serve 404
      // qaytarishi mumkin. Shu bois pack borligini serve ishlatadigan AYNAN
      // o'sha manbadan — HeadObject'dan qayta tasdiqlaymiz (bitta qo'shimcha
      // HeadObject, faqat List pack borligini ko'rsatgan shablon uchun).
      if (assets.pack) {
        assets.pack = (await resolveS3AssetKey(templateId, "pack")) != null;
      }
    } else {
      await Promise.all(
        kinds.map(async (kind) => {
          if (!assets[kind]) {
            if (await resolveS3AssetKey(templateId, kind)) assets[kind] = true;
          }
        })
      );
    }
  }
  return assets;
}

/**
 * Shablonning R2/S3 dagi BARCHA fayllarini o'chiradi (thumb/preview/pack/scenes).
 * Prefiks ANIQ "templates/{id}/" — oxiridagi "/" tufayli boshqa shablon ID
 * prefikslariga (masalan "templates/{id}-2/") mos kelmaydi, shu bois faqat
 * shu shablonning fayllari o'chadi. ListObjectsV2 pagination bilan, 1000 dan
 * ortiq obyekt bo'lsa ham to'liq aylanadi. O'chirilgan obyektlar sonini qaytaradi.
 */
export async function deleteTemplateAssets(templateId: string): Promise<number> {
  if (!isS3Configured()) return 0;
  const id = String(templateId).trim();
  if (!id) return 0;
  const prefix = `templates/${id}/`;
  let deleted = 0;
  let continuationToken: string | undefined;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    // Himoya: prefiks aniq mosligini qayta tekshiramiz (boshqa kalitlarga tegmaslik).
    const keys = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => typeof k === "string" && k.startsWith(prefix));
    if (keys.length) {
      // ListObjectsV2 sahifada maks 1000 obyekt qaytaradi — DeleteObjects ham
      // maks 1000 kalit oladi, shu bois har sahifa bitta batch.
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        })
      );
      deleted += keys.length;
    }
    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return deleted;
}

/** Berilgan kalitlarni R2'dan o'chiradi (gen natijalarini o'chirish uchun). */
export async function deleteS3Objects(keys: string[]): Promise<number> {
  if (!isS3Configured()) return 0;
  const valid = keys.filter((k): k is string => typeof k === "string" && k.length > 0);
  if (!valid.length) return 0;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: valid.map((Key) => ({ Key })), Quiet: true },
    })
  );
  return valid.length;
}

/** Yuklashda R2 kalit — kengaytma saqlanadi (pack.zip / preview.mp4) */
export function s3UploadKeyForFile(
  templateId: string,
  kind: TemplateAssetKind,
  localPath: string
): string {
  const ext = path.extname(localPath).toLowerCase();
  const allowed =
    kind === "pack"
      ? [".zip", ".aep", ".mogrt"]
      : kind === "preview"
        ? [".mp4", ".mov", ".webm"]
        : [".jpg", ".jpeg", ".png", ".webp"];
  const useExt = allowed.includes(ext) ? ext : "";
  return `templates/${templateId}/${kind}${useExt}`;
}

/**
 * Lokal faylni S3/R2 ga MULTIPART STREAM orqali yuklash — faylni xotiraga
 * to'liq o'qimasdan. lib-storage `Upload` 8MB bo'laklarga bo'lib, bir vaqtda
 * eng ko'pi 4 bo'lakni yuboradi → cho'qqi xotira ≈ 8MB×4 = 32MB, fayl
 * hajmidan (3GB gacha) qat'i nazar. Bu Render 512MB limitidagi OOM ni
 * oldini oladi. Xato bo'lsa aniq log chiqarib, stream'ni yopib, qayta otadi.
 */
export async function uploadFileToS3(
  localPath: string,
  s3Key: string,
  contentType: string,
  cacheControl: string = ASSET_CACHE_CONTROL
): Promise<string> {
  const contentLength = fs.statSync(localPath).size;
  const body = fs.createReadStream(localPath);
  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      },
      partSize: 8 * 1024 * 1024, // 8MB bo'laklar
      queueSize: 4, // bir vaqtda 4 bo'lak → ~32MB cho'qqi
      leavePartsOnError: false, // xatoda yarim bo'laklar tozalanadi
    });
    await upload.done();
  } catch (err) {
    console.error(
      `[s3] uploadFileToS3 muvaffaqiyatsiz — key=${s3Key} size=${contentLength}B src=${localPath}:`,
      err
    );
    body.destroy();
    throw err;
  }
  return getPublicUrl(s3Key);
}

/**
 * R2/S3 obyektni lokal faylga STREAM orqali yuklab oladi (xotiraga to'liq
 * o'qimasdan — katta packlar uchun). destPath papkasi mavjud bo'lishi kerak.
 * Obyekt yo'q yoki body bo'sh bo'lsa aniq xato otadi (yutmaydi).
 */
export async function downloadS3ToFile(
  key: string,
  destPath: string
): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`R2 obyekt bo'sh yoki topilmadi: ${key}`);
  await pipeline(res.Body as Readable, fs.createWriteStream(destPath));
}

/** Buffer'ni S3/R2 ga yuklash */
export async function uploadBufferToS3(
  buffer: Buffer,
  s3Key: string,
  contentType: string,
  cacheControl: string = ASSET_CACHE_CONTROL
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return getPublicUrl(s3Key);
}
