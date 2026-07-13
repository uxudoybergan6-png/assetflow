import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { PassThrough, Readable } from "stream";
import type { SdkStreamMixin } from "@smithy/types";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
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
  // R2 → false (virtual-host); GCS S3-mosligi → S3_FORCE_PATH_STYLE=true (path-style ishonchliroq)
  ...(endpoint ? { endpoint, forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "false") === "true" } : {}),
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
  // CDN_BASE_URL bo'sh bo'lsa — S3_ENDPOINT'dan (masalan GCS S3-mos
  // https://storage.googleapis.com) path-style public URL yasaymiz. Bu GCS/R2
  // uchun to'g'ri; ilgari region="auto" bilan o'lik AWS host qaytardi
  // (<bucket>.s3.auto.amazonaws.com) → barcha thumb/preview buzilardi.
  if (endpoint && bucket) {
    return `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${key}`;
  }
  // Haqiqiy AWS S3 (endpoint yo'q, region belgilangan) — virtual-host URL.
  if (bucket && region && region !== "auto") {
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
  return `/placeholder/${key}`;
}

/**
 * 🔴 OMMAVIY ("ko'rsatish") obyektlar allow-list'i — YAGONA HAQIQAT MANBAI.
 *
 * Hamma fayl BITTA bucket'da (thumb, preview, pack.zip, mogrt, gen asl, refs…).
 * Bucket'ni butunlay ochiq qilish (allUsers → Object Viewer) BARCHA PULLIK
 * pack/mogrt'ni bepul qilib qo'yadi — pack yo'li oldindan ma'lum
 * (templates/<id>/pack.zip), ID esa katalogda ochiq. Shu bois OCHIQLIK
 * OBYEKT DARAJASIDA, faqat shu naqshlarga MOS kalitlarga beriladi.
 *
 * Chaqiruvchi HECH QANDAY "public qil" bayrog'i uzatmaydi — qaror faqat KALIT
 * bo'yicha, aynan shu joyda. (Bucket "fine-grained" rejimida bo'lishi shart —
 * uniform bucket-level access EMAS.)
 *
 * OMMAVIY (true):
 *   templates/<id>/thumb[.ext]     — shablon karta rasmi
 *   templates/<id>/preview[.ext]   — shablon hover preview
 *   templates/<id>/scenes/**       — sahna preview/thumb
 *   gen/<uid>/*-thumb.jpg          — gen rasm/video thumb (derivativ)
 *   gen/<uid>/*-poster.jpg         — gen video poster (derivativ)
 *   gen/<uid>/*-preview.mp4        — gen video hover-preview (derivativ)
 *   gen/<uid>/*-disp.<ext>         — gen rasm 1280px display (derivativ)
 *
 * HECH QACHON OMMAVIY (false → private qoladi):
 *   templates/<id>/pack.*  ·  templates/<id>/mogrt/*      🔴 PULLIK
 *   gen/<uid>/<id>-<ts>.<ext>  — generatsiya ASL fayli (suffikssiz; tsName
 *                                raqamli, shu bois hech qachon -thumb/-disp… bilan tugamaydi)
 *   gen-refs/*  ·  gen-ref-src/*  — foydalanuvchi referenslari/manba (shaxsiy)
 *   avatars/*  ·  incoming/*  ·  templates/<id>/pack.dl.zip  ·  qolgan HAMMASI
 */
export function isPublicReadKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  // Shablon: thumb/preview ANIQ segment — pack.*/pack.dl.zip'ga TEGMAYDI.
  if (/^templates\/[^/]+\/(thumb|preview)(\.[A-Za-z0-9]+)?$/.test(key)) return true;
  // Shablon sahna fayllari (preview/thumb) — scenes/ ostidagi hammasi.
  if (/^templates\/[^/]+\/scenes\/.+$/.test(key)) return true;
  // Generatsiya KO'RSATISH derivativlari (asl fayl EMAS). Asl fayl
  // `gen/<uid>/<id>-<ts>.<ext>` bu suffikslar bilan TUGAMAYDI → private qoladi.
  if (/^gen\/[^/]+\/.+-(thumb\.jpg|poster\.jpg|preview\.mp4|disp\.[A-Za-z0-9]+)$/.test(key))
    return true;
  return false;
}

/**
 * Yuklash paytida qo'llanadigan ACL — faqat allow-list kalitlari `public-read`
 * (GCS S3-mos interop `x-amz-acl` ni `publicRead` predefined ACL'ga xaritalaydi;
 * R2/AWS ham `public-read` cannedni qo'llaydi). Aks holda undefined → obyekt
 * private (bucket default). Chaqiruvchi bu qarorni O'ZGARTIRA olmaydi.
 *
 * 🔴 ACL FAQAT CDN yoqilganda (CDN_BASE_URL set) beriladi — ya'ni biz haqiqatan
 * public serv qilayotganimizda. Sabab: GCS bucket UNIFORM bucket-level access'da
 * bo'lsa obyekt-ACL so'rovini RAD etadi (PutObject xato). CDN o'chiq holatda
 * (joriy prod, bucket hali uniform) ACL umuman yuborilmaydi → upload buzilmaydi,
 * xulq bugungidek. Ega bucket'ni fine-grained + public-access-prevention=inherited
 * qilib, so'ng CDN_BASE_URL'ni o'rnatgach — ACL avtomat faollashadi
 * (getPublicOrSignedUrl ham aynan shu shart bilan public URL'ga o'tadi).
 */
function aclFor(key: string): "public-read" | undefined {
  return cdnBase && isPublicReadKey(key) ? "public-read" : undefined;
}

/** Bizning GCS bucket URL'idan (public/signed/CDN) obyekt KEY'ini ajratadi. Boshqa host → null.
 *  Vertex Omni video input `gs://` talab qiladi — shu key'dan gs:// yasaladi. */
export function gcsKeyFromUrl(url: string): string | null {
  if (!bucket) return null;
  if (cdnBase && url.startsWith(cdnBase.replace(/\/$/, "") + "/"))
    return decodeURIComponent(url.slice(cdnBase.replace(/\/$/, "").length + 1).split("?")[0]);
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace(/^\//, ""));
    // https://storage.googleapis.com/<bucket>/<key>  (GCS S3-mos)
    if (u.hostname === "storage.googleapis.com" && path.startsWith(bucket + "/")) return path.slice(bucket.length + 1);
    // https://<bucket>.storage.googleapis.com/<key>
    if (u.hostname === `${bucket}.storage.googleapis.com`) return path;
    // https://<bucket>.s3.<region>.amazonaws.com/<key>
    if (u.hostname.startsWith(`${bucket}.s3.`)) return path;
    return null;
  } catch {
    return null;
  }
}

/** Bizning bucket'dagi obyekt uchun gs:// URI (Omni video input). Boshqa manba → null. */
export function gcsUriFromUrl(url: string): string | null {
  const key = gcsKeyFromUrl(url);
  return key ? `gs://${bucket}/${key}` : null;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
  filename?: string
): Promise<string> {
  if (!bucket) {
    return getPublicUrl(key);
  }
  // filename berilsa → Content-Disposition: attachment (brauzer inline ochish
  // o'rniga faylni yuklab oladi). Kross-origin imzolangan URL'da <a download>
  // atributi e'tiborsiz qoldiriladi, shu sabab disposition serverdan kelishi shart.
  const safeName = filename ? filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) : "";
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(safeName ? { ResponseContentDisposition: `attachment; filename="${safeName}"` } : {}),
  });
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
  // 🔴 CDN yoqilgan bo'lsa ham FAQAT ommaviy allow-list kalitlari toza public
  // URL oladi. Private obyektlar (gen asl fayli, gen-refs/audio — tashqi
  // provayder yuklab oladigan manbalar) uchun signed URL qaytadi: obyekt
  // private qoladi (403 to'g'ridan), lekin imzo bilan provayder/mijoz kira
  // oladi. Aks holda CDN yoqilishi bu private manbalarni ochib qo'yardi (leak)
  // yoki (agar ochilmasa) provayder yuklab olishini buzardi.
  if (cdnBase && isPublicReadKey(key)) return getPublicUrl(key);
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

/**
 * Yengil ulanish tekshiruvi (/health readiness uchun — Bosqich 1 #6). HeadBucket bilan
 * bucket'ga TEKKIZAMIZ. 403/401 (ruxsat cheklangan, lekin xizmat javob berdi) → REACHABLE (true) —
 * false-negative bermaslik uchun. Faqat tarmoq/ulanish/5xx xatosi → down (false).
 */
export async function checkS3Health(): Promise<boolean> {
  if (!isS3Configured()) return false;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 403 || status === 401) return true; // xizmat javob berdi → ulanish bor
    return false;
  }
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
    // Stock S1 — pack endi barcha template app formatlari + stock media kengaytmalarida
    // saqlanishi mumkin (eski tartib saqlangan — mavjud kalitlar avval topiladi).
    return [
      base, `${base}.mogrt`, `${base}.zip`, `${base}.aep`,
      `${base}.aet`, `${base}.ffx`, `${base}.prproj`, `${base}.motn`, `${base}.moti`,
      `${base}.drfx`, `${base}.dra`, `${base}.setting`,
      `${base}.mp4`, `${base}.mov`, `${base}.wav`, `${base}.mp3`, `${base}.aiff`,
      `${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`,
    ];
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
  knownS3Keys?: Set<string>,
  // FAZA 5 (A2): kalitlar DB keshidan (mutatsiya paytida yozilgan — authoritative)
  // kelganda pack HeadObject re-tasdiq KERAK EMAS (confirmPack:false) — listing
  // to'liq tarmoqsiz bo'ladi. Live List'dan kelganda eski xulq saqlanadi (true).
  opts?: { confirmPack?: boolean }
) {
  const kinds: TemplateAssetKind[] = ["thumb", "preview", "pack"];
  // Bulut sozlangan bo'lsa diskni umuman tekshirmaymiz — serve-asset endi
  // bulutda topilmagan faylni diskdan bermaydi, shu bois disk-only mavjudlik
  // "hasPack: true" deb noto'g'ri reklama qilinmasligi kerak.
  const assets: Record<TemplateAssetKind, boolean> = isS3Configured()
    ? { thumb: false, preview: false, pack: false }
    : {
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
      if (assets.pack && (opts?.confirmPack ?? true)) {
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
        ACL: aclFor(s3Key), // ko'rsatish assetlari public-read; pack/private — undefined
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
  if (!res.Body) throw new Error(`R2 object is empty or not found: ${key}`);
  await pipeline(res.Body as Readable, fs.createWriteStream(destPath));
}

/**
 * Ranged GET → Buffer. KICHIK bo'laklar uchun (zip EOCD/markaziy katalog).
 * end EXCLUSIVE. Server Range'ni qo'llamasa (butun obyekt yoki noto'g'ri hajm
 * qaytsa) ANIQ xato otadi — jim to'liq-yuklab-olishga QAYTMAYDI (streaming
 * ingest'ning xotira maqsadi buzilmasin).
 */
export async function readS3ObjectRange(
  key: string,
  start: number,
  endExclusive: number
): Promise<Buffer> {
  const expected = endExclusive - start;
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=${start}-${endExclusive - 1}`,
    })
  );
  if (!res.Body) throw new Error(`R2 object is empty or not found: ${key}`);
  const bytes = await (res.Body as Readable & SdkStreamMixin).transformToByteArray();
  const buf = Buffer.from(bytes);
  if (buf.length !== expected) {
    throw new Error(
      `Ranged read not honored for ${key}: requested ${expected}B [${start},${endExclusive}), got ${buf.length}B`
    );
  }
  return buf;
}

/**
 * Ranged GET → stream (zip entry baytlarini bufersiz o'qish uchun). end EXCLUSIVE.
 * Range qo'llanmagani aniqlansa stream xato bilan yopiladi (fallback YO'Q).
 */
export function createS3RangeStream(
  key: string,
  start: number,
  endExclusive: number
): Readable {
  const out = new PassThrough();
  const expected = endExclusive - start;
  s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=${start}-${endExclusive - 1}`,
    })
  )
    .then((res) => {
      const body = res.Body as Readable | undefined;
      if (!body) {
        out.destroy(new Error(`R2 object is empty or not found: ${key}`));
        return;
      }
      if (out.destroyed) {
        body.destroy();
        return;
      }
      if (typeof res.ContentLength === "number" && res.ContentLength !== expected) {
        body.destroy();
        out.destroy(
          new Error(
            `Ranged read not honored for ${key}: requested ${expected}B, server sent ${res.ContentLength}B`
          )
        );
        return;
      }
      body.on("error", (e) => out.destroy(e));
      out.on("close", () => {
        if (!body.destroyed) body.destroy();
      });
      body.pipe(out);
    })
    .catch((e) => out.destroy(e instanceof Error ? e : new Error(String(e))));
  return out;
}

/**
 * Readable stream'ni S3/R2 ga MULTIPART orqali yuklash — uploadFileToS3'ning
 * stream varianti (zip entry → bucket, disk/xotiraga to'liq olinmasdan).
 * Cho'qqi xotira ≈ 8MB×4 = 32MB, stream hajmidan qat'i nazar.
 */
export async function uploadStreamToS3(
  body: Readable,
  s3Key: string,
  contentType: string,
  cacheControl: string = ASSET_CACHE_CONTROL
): Promise<string> {
  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
        ACL: aclFor(s3Key), // ko'rsatish assetlari public-read; pack/private — undefined
      },
      partSize: 8 * 1024 * 1024,
      queueSize: 4,
      leavePartsOnError: false, // xatoda yarim bo'laklar tozalanadi
    });
    await upload.done();
  } catch (err) {
    console.error(`[s3] uploadStreamToS3 muvaffaqiyatsiz — key=${s3Key}:`, err);
    body.destroy();
    throw err;
  }
  return getPublicUrl(s3Key);
}

/** R2/S3 obyektni to'g'ridan-to'g'ri xotiraga (Buffer) yuklab oladi — kichik fayllar uchun. */
export async function downloadS3ToBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`R2 object is empty or not found: ${key}`);
  const bytes = await (res.Body as Readable & SdkStreamMixin).transformToByteArray();
  return Buffer.from(bytes);
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
      ACL: aclFor(s3Key), // ko'rsatish assetlari public-read; pack/private — undefined
    })
  );
  return getPublicUrl(s3Key);
}
