import fs from "fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
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
