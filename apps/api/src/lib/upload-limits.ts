/**
 * Multipart (multer) parser cheklovlari — YAGONA MANBA.
 *
 * Nega alohida modul: bu qiymatlar xavfsizlik yuzasi, shuning uchun ular DB/Prisma'siz
 * import qilinadigan toza modulda turadi va `scripts/test-upload-limits.mjs` AYNAN shu
 * obyektlarni (nusxasini emas) haqiqiy multer bilan ishga tushirib tekshiradi.
 *
 * Xavfsizlik konteksti — GHSA-72gw-mp4g-v24j (multer <2.2.0 chuqur nested maydon nomi DoS):
 * multer 2.2.0 himoyani QO'SHDI, lekin u OPT-IN — `limits.fieldNestingDepth` berilmasa
 * `a[b][c][d]…` nomi hamon `append-field`da cheksiz nest qilinadi. Advisory ham aynan
 * "upgrade to 2.2.0 AND configure limits.fieldNestingDepth" deydi.
 *
 * Shuningdek `busboy`ning multipart parseri uchun `fields`/`parts` DEFAULT = Infinity va
 * multipart'da `fieldNameSize` UMUMAN qo'llanmaydi — shuning uchun bu yerda ular aniq
 * chekланган.
 *
 * MUHIM: `files`/`fields`/`parts` qiymatlari mahsulot talabidir (160 sahna fayli) — ular
 * PASAYTIRILMAYDI. `fileSize` esa #61 (T5.4) da HAQIQIY platforma tomiga tenglashtirildi:
 * Cloud Run so'rov tanasi 32MiB, undan katta multipart multer'ga umuman yetib bormaydi.
 * Katta fayllar (pack) presigned PUT bilan to'g'ridan bulutga ketadi.
 */

import type { Options } from "multer";

type MulterLimits = NonNullable<Options["limits"]>;

/**
 * Loyihada BIRORTA klient bracket-notatsiyali maydon nomi yubormaydi (hammasi tekis:
 * `thumb`, `preview`, `pack`, `avatar`, `file`, `clipMode`, slug'lashtirilgan sahna kalitlari).
 * 1 = bitta daraja zaxira (`a[b]`), cheksiz nest esa rad etiladi (LIMIT_FIELD_NESTING).
 */
export const MAX_FIELD_NESTING_DEPTH = 1;

/** POST /api/studio/gen/ref-upload — referens fayl (multipart yoki dataUrl/srcKey/srcUrl). */
export const MAX_REF_UPLOAD_BYTES = 100 * 1024 * 1024;

/** POST /api/auth/avatar — 5MB, bitta `avatar` fayli, matn maydon o'qilmaydi. */
export const AVATAR_UPLOAD_LIMITS: MulterLimits = {
  fileSize: 5 * 1024 * 1024,
  files: 1,
  fields: 4,
  parts: 6,
  fieldNestingDepth: MAX_FIELD_NESTING_DEPTH,
};

/**
 * POST /api/studio/gen/ref-upload — 1 fayl + kichik matn maydonlar
 * (clipMode, clipStartSec, clipEndSec, extractAudioRef, srcKey, srcUrl).
 */
export const GEN_REF_UPLOAD_LIMITS: MulterLimits = {
  fileSize: MAX_REF_UPLOAD_BYTES,
  files: 1,
  fields: 16,
  parts: 20,
  fieldNestingDepth: MAX_FIELD_NESTING_DEPTH,
};

/**
 * Cloud Run HTTP/1 so'rov tanasi qattiq **32 MiB** bilan cheklangan — bu bizning
 * sozlamamiz emas, platforma limiti (undan katta multipart hech qachon multer'ga
 * yetib bormaydi, ingress 413 qaytaradi). Shuning uchun multipart yo'llari shu
 * ostida turadi; KATTA fayllar (pack, sahna videosi) presigned PUT bilan
 * TO'G'RIDAN bulutga ketadi (`/templates/:id/upload-url` → `/pack-uploaded`).
 */
export const CLOUD_RUN_REQUEST_LIMIT_BYTES = 32 * 1024 * 1024;

/**
 * POST /api/contributor/templates/:id/assets — thumb + preview + pack (har biri maxCount 1).
 * #61 (T5.4): ilgari 3300MB e'lon qilinardi ("3GB UI limiti"), lekin Cloud Run'da
 * 32MB'dan katta tana HECH QACHON kelmaydi — limit yolg'on xavfsizlik hissi berardi va
 * xato faqat ingress 413'ida ko'rinardi. Endi haqiqiy platforma tomiga tenglashtirildi.
 * Katta pack yo'li: presigned PUT (studio-api.js `uploadAssets`, plagin publish oqimi).
 */
export const TEMPLATE_ASSET_UPLOAD_LIMITS: MulterLimits = {
  fileSize: CLOUD_RUN_REQUEST_LIMIT_BYTES,
  files: 3,
  fields: 8,
  parts: 16,
  fieldNestingDepth: MAX_FIELD_NESTING_DEPTH,
};

/**
 * POST /api/contributor/templates/:id/scene-previews — `.any()`, sahna thumb/video fayllari.
 * 160 fayl ish oqimi O'ZGARMAYDI; `parts` = 160 fayl + matn maydon zaxirasi.
 * #61: per-fayl 512MB ham Cloud Run tomidan yuqori edi (butun so'rov 32MB) →
 * platforma limitiga tenglashtirildi. Sahna thumb'lari bir necha MB, ish oqimi tegilmagan.
 */
export const SCENE_PREVIEW_UPLOAD_LIMITS: MulterLimits = {
  fileSize: CLOUD_RUN_REQUEST_LIMIT_BYTES,
  files: 160,
  fields: 8,
  parts: 180,
  fieldNestingDepth: MAX_FIELD_NESTING_DEPTH,
};
