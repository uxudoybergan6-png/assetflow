/**
 * 🔴 OMMAVIY ("ko'rsatish") obyektlar allow-list'i — YAGONA HAQIQAT MANBAI.
 *
 * Bu fayl SOF (hech qanday import/bog'liqlik yo'q) — shu bois HAM API (Node),
 * HAM Cloudflare Worker CDN-proksi (`workers/cdn-proxy`) uni AYNAN bir manbadan
 * ishlatadi (kodni takrorlamaymiz). Worker uni relativ import qiladi:
 *   import { isPublicReadKey } from "../../../apps/api/src/lib/public-keys";
 *
 * NEGA KERAK: hamma fayl BITTA yopiq bucket'da (thumb, preview, pack.zip, mogrt,
 * gen asl, refs…). GCP org-policy per-obyekt public'ni butunlay taqiqlaydi, shu
 * bois bucket YOPIQ qoladi va ko'rsatish assetlari `cdn.getframeflow.app` Worker
 * proksisi orqali beriladi. Worker HAR so'rovda shu funksiyani chaqiradi:
 *   - mos (true)  → GCS'dan SigV4 bilan olib, keshlab beradi
 *   - mos EMAS    → 403, hech qanday bayt bermaydi
 * API tomonda esa `getPublicOrSignedUrl()` shu funksiya bilan public-vs-signed
 * qarorini beradi (private kalitlar CDN yoqilganda ham SIGNED qoladi).
 *
 * OMMAVIY (true):
 *   templates/<id>/thumb[.ext]     — shablon karta rasmi
 *   templates/<id>/preview[.ext]   — shablon hover preview
 *   templates/<id>/scenes/**       — sahna preview/thumb
 *   gen/<uid>/*-thumb.jpg          — gen rasm/video thumb (derivativ)
 *   gen/<uid>/*-poster.jpg         — gen video poster (derivativ)
 *   gen/<uid>/*-preview.mp4        — gen video hover-preview (derivativ)
 *   gen/<uid>/*-disp.<ext>         — gen rasm 1280px display (derivativ)
 *   landing/<file>                 — admin Website CMS media (FAQAT flat, subpath yo'q)
 *   site/plugin/<file>             — admin Plugin CMS media (FAQAT flat, subpath yo'q)
 *
 * landing/ va site/plugin/ prefikslariga YOZISH faqat admin presigned upload
 * orqali bo'ladi (admin.ts ALLOWED_UPLOAD_FOLDERS whitelist + safeUploadFileName
 * basename sanitizatsiyasi) — bu prefikslarga HECH QACHON pullik kontent
 * yozilmasligi shart (aks holda CDN orqali ochiq bo'lib qoladi).
 *
 * HECH QACHON OMMAVIY (false → private qoladi, Worker 403 beradi):
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
  // Admin CMS media — FAQAT flat kalitlar (subpath yo'q): landing/<file> (Website
  // CMS) va site/plugin/<file> (Plugin CMS). Yozish faqat admin presigned upload.
  if (/^landing\/[^/]+$/.test(key)) return true;
  if (/^site\/plugin\/[^/]+$/.test(key)) return true;
  return false;
}
