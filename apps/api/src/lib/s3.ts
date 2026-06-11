import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
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
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      }
    : undefined,
});

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

/** R2 da pack/preview/thumb turli kengaytma bilan saqlanishi mumkin */
export function s3KeysForAsset(templateId: string, kind: TemplateAssetKind): string[] {
  const base = `templates/${templateId}/${kind}`;
  if (kind === "pack") {
    return [base, `${base}.zip`, `${base}.aep`];
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

/** Lokal disk + R2/S3 — preview/thumb/pack mavjudligi */
export async function templateAssetFlags(templateId: string) {
  const kinds: TemplateAssetKind[] = ["thumb", "preview", "pack"];
  const assets: Record<TemplateAssetKind, boolean> = {
    thumb: !!findAssetPath(templateId, "thumb"),
    preview: !!findAssetPath(templateId, "preview"),
    pack: !!findAssetPath(templateId, "pack"),
  };
  if (isS3Configured()) {
    await Promise.all(
      kinds.map(async (kind) => {
        if (!assets[kind]) {
          if (await resolveS3AssetKey(templateId, kind)) assets[kind] = true;
        }
      })
    );
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

/** Yuklashda R2 kalit — kengaytma saqlanadi (pack.zip / preview.mp4) */
export function s3UploadKeyForFile(
  templateId: string,
  kind: TemplateAssetKind,
  localPath: string
): string {
  const ext = path.extname(localPath).toLowerCase();
  const allowed =
    kind === "pack"
      ? [".zip", ".aep"]
      : kind === "preview"
        ? [".mp4", ".mov", ".webm"]
        : [".jpg", ".jpeg", ".png", ".webp"];
  const useExt = allowed.includes(ext) ? ext : "";
  return `templates/${templateId}/${kind}${useExt}`;
}

/** Lokal faylni S3/R2 ga yuklash */
export async function uploadFileToS3(
  localPath: string,
  s3Key: string,
  contentType: string
): Promise<string> {
  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(s3Key);
}

/** Buffer'ni S3/R2 ga yuklash */
export async function uploadBufferToS3(
  buffer: Buffer,
  s3Key: string,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return getPublicUrl(s3Key);
}
