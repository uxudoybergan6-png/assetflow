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
 * MUHIM: `fileSize` va `files` qiymatlari mahsulot talabidir (3GB pack, 512MB sahna videosi,
 * 160 sahna fayli) — ular PASAYTIRILMAYDI.
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
 * POST /api/contributor/templates/:id/assets — thumb + preview + pack (har biri maxCount 1).
 * fileSize 3300MB = UI limiti 3GB + multipart overhead zaxirasi (O'ZGARMAYDI).
 */
export const TEMPLATE_ASSET_UPLOAD_LIMITS: MulterLimits = {
  fileSize: 3300 * 1024 * 1024,
  files: 3,
  fields: 8,
  parts: 16,
  fieldNestingDepth: MAX_FIELD_NESTING_DEPTH,
};

/**
 * POST /api/contributor/templates/:id/scene-previews — `.any()`, sahna thumb/video fayllari.
 * 512MB × 160 fayl ish oqimi O'ZGARMAYDI; `parts` = 160 fayl + matn maydon zaxirasi.
 */
export const SCENE_PREVIEW_UPLOAD_LIMITS: MulterLimits = {
  fileSize: 512 * 1024 * 1024,
  files: 160,
  fields: 8,
  parts: 180,
  fieldNestingDepth: MAX_FIELD_NESTING_DEPTH,
};
