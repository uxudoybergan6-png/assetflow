# SESSION REPORT — 2026-06-18 — G1: Reference nega e'tiborsiz (diagnostika + tuzatish)

## Diagnostika (ildiz sabab)
- Oqim: `aiTimelineRef()` reference'ni `af_ai.reference={path,name,mediaType}` (LOKAL fayl yo'li) qilib oladi va ref bar'da ko'rsatadi — LEKIN:
  - `aiGenParams('rasm')` faqat `{aspectRatio,quality,count}` qaytaradi — reference YO'Q.
  - `/gen` payload `params:aiGenParams(media)` yuboradi → `params.referenceUrl` doim `undefined`.
- Backend ASLIDA TO'G'RI: `gen-processor.ts` `refUrl ? orImageEdit : orImage`; `orImageEdit` Gemini formatini to'g'ri yuboradi (`messages[].content` `image_url:{url}`, URL/data-URL). Reference yetmagani uchun har doim `orImage` (text2img) → "aloqasiz yangi rasm".
- Xulosa: bug 100% FRONTEND — reference hech qachon yuborilmaydi.

## Tuzatish
- **Frontend** (`AssetFlow_Plugin.html`): yangi `aiReferenceDataUri(media)` — reference faylini (rasm yoki video kadr) fs→Blob→objectURL→canvas orqali 1024px JPEG data-URI ga aylantiradi (canvas taint'siz). `aiRunStudioGen` uni `params.referenceUrl` ga qo'shadi (faqat /gen'da, cost-quote'da emas).
- **Backend** (`gen-quote.ts`): `genParamsHash` endi `referenceUrl`ni hashdan chiqaradi — narxga ta'sir qilmaydi, shuning uchun cost-quote (referencesiz) va /gen (reference bilan) bir xil hash → BAD_QUOTE bo'lmaydi.
- **Backend** (`index.ts`): `express.json` limit 100kb→8mb (data-URI reference sig'sin).

## Tekshirildi
- `npm run build -w apps/api` → tsc toza. Plugin inline JS parse: 2 blok, 0 xato. Fayllar CEP'ga ko'chirildi (AE qo'zg'atilmadi).

## Kutilmoqda
- G2: model-aware referenceMode (router). G3: video reference. G4: Project'dan reference. G5: image/video-to-prompt.
