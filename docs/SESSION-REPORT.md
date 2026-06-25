# SESSION REPORT — 2026-06-25 — "Rasm yaratish" (model-aware) + ko'p-referens + @imgN

## BACKEND (apps/api — tsc TOZA, lokal)
1. **gen-models.ts:** har modelга `refMode` ('none'|'optional'|'required') + `maxRefs`. gpt-image-2/edit:
   refMode='required', maxRefs=10. /gen/models javobida qaytadi → frontend model-aware (hardcode emas).
2. **studio-gen.ts:** `POST /gen/ref-upload` (data-URI → R2 **public** URL; kredit yo'q) — plagin har referensни
   darhol yuklaydi (spinner). `/gen`да refMode='required' guard (referenssiz → 400, KREDITDAN OLDIN).
   Ko'p referens (`referenceUrls`) imzoga (genParamsHash) ALLAQACHON kiradi → soni+tartibi bog'langan.
3. **fal.ts:** `@img<N>` → "image N" mapping (image_urls tartibiga mos: @img1=image_urls[0]).
   gen-processor: referenslar AYNAN TARTIBDA R2 public URL → image_urls.
4. **host.jsx:** `exportTimelineFrame()` — faol comp joriy kadri → PNG (saveFrameToPng).

## PLAGIN (AssetFlow_Plugin.html — `.axig` scope, SVG ikona)
- §0: eski "Rasm tahrirlash" (v-imgedit/.axie/axIE) TO'LIQ olindi.
- §B: "Rasm yaratish" (tool-image.html 1:1). MODEL tanaда (header'da emas). REFERENS MODEL-AWARE:
  required→"*"+ogohlantirish; thumbnaillar @img1/@img2…(× → qayta raqamlash); upload spinner (ref-upload);
  tile bosish → @imgN promptga (kursorga). ＋ menyu: Fayl/Project(listProjectFootage)/Timeline(exportTimelineFrame).
  Sozlamalar O'lcham/Sifat/Soni bitta qator → narx. Yaratish disabled: prompt<2 || (required && ref yo'q) || ref yuklanmoqda.
- REAL: cost-quote → /gen (referenceUrls @img tartibда) → poll → natija. ✨=/gen/prompt/enhance. Kredit real.

## Tekshiruv
- tsc TOZA · plagin JS 5 blok 0 xato. Brauzer (mock): model-aware (*/warn), file upload→spinner→@img1, tile→token,
  ×→renumber, settings ✦24=high×2, enhance, Yaratish → cost-quote(referenceUrl=R2 URL)→sessions→/gen→poll→natija ✓.
  Project/Timeline = csInterface (lexical, brauzerда mock bo'lmaydi) → kod-inspeksiya (axProbe naqshi). install OK.

## TUZATISH(2) — UCHALA referens manba AE'da ishlamadi
- Sabab: 3 manба ham `readDataUrl(path)` ga keladi. Oldingi fix bare `require('fs')` ishlatardi — bu CEP panelда
  ishonchli EMAS (tayanган `require('path')` ~5772 = DORMANT kod, AE'да hech qachon ishlamagan). `require` topilmadi →
  `cep.fs.readFile(Base64)` fallback → AE'да binary rasm uchun `err!==0` → null → "o'qib bo'lmadi". Timeline'да
  qo'shimcha: `exportTimelineFrame` `app.project.activeItem` ишлатарди — CEP panel fokusda bo'lsa null.
- Tuzatish: **`nodeRequire()`** — `require` + **CEP `cep_node.require`** (+ window variantlari) → Node `fs`ni ISHONCHLI
  oladi → `readFileSync(path).toString('base64')` (bo'shliq/maxsus belgili path ham). cep.fs fallback saqlandi.
  host.jsx `exportTimelineFrame`: `app.activeViewer.setActive()` + birinchi-comp fallback (panel fokus). hostCall raw
  natija + `{ok:false,reason}` qaytaradi. Har bosqич ANIQ log/toast (showOpenDialog path, host raw, read `_why` sabab).
- node 0 xato · host.jsx balans OK · brauzer file-source regressiyasiz (@img1) · install OK.

## TUZATISH(3) — file:// path normalizatsiya (referens o'qish)
- Sabab: showOpenDialog `file:///Users/.../x.jpg` qaytaradi; Node fs & cep.fs ODDIY yo'l kutadi → ENOENT/err=3.
- Tuzatish: `toFsPath()` (file:// strip + decodeURIComponent %20→bo'shliq) — readDataUrl Node fs VA cep.fs ikkalasi
  normalizatsiya qilingan `fp` ishlatadi. 3 manба ham shu yo'ldan o'tadi (host fsName/file:// ham normalizatsiya).
- Tekshiruv: node 0 xato; `file:///Users/usmonov/Desktop/lage.jpg`→`/Users/usmonov/Desktop/lage.jpg` ✓; `%20`→bo'shliq ✓; brauzer: readFile NORMALIZED path oladi → @img1. install OK.

## Kutilmoqda — **PUSH** (backend Render deploy, FAL_KEY) → AE'da real sinash. Push YO'Q (qoidaga ko'ra).
