# Session Report — 2026-06-13 (Re-extract endpoint — NOT committed, test kutilmoqda)

## Nima qilindi
- **Re-extract endpoint** (HANDOFF item 4, HIGH): `POST /api/contributor/admin/templates/:id/re-extract` — faqat admin (`requireAuth + requireAdmin`).
  - Pack ZIP'ni disk yoki R2'dan tmpdir'ga yuklaydi (`downloadS3ToFile` — yangi, stream, `lib/s3.ts`).
  - `.mogrt` sahnalarni qayta ajratib `scenes/{slug}.mp4|png` (previewKey) + `mogrt/{slug}.mogrt` (mogrtKey) R2'ga yozadi, `metaJson.scenes` yangilaydi.
  - Progress: mavjud `GET .../templates/:id/upload-progress` SSE (per-`.mogrt`); `download` bosqichi qo'shildi.
  - Xatoda `{error, stage}` JSON + SSE `[stage]` prefiks (req 7).
  - Upload route bilan baham `storeMogrtScenesFromZip()` helper (kod duplikatsiyasi yo'q).
  - Fayllar: `routes/contributor.ts`, `lib/s3.ts`, `lib/upload-progress.ts`. Build ✅.

## Nima topildi
- Lokal DB ↔ R2 ↔ production katalog ID'lari MOS EMAS: lokal `APPROVED` (cmpw*/cmpx*) R2'da yo'q; productionda boshqa 4 ta (cmqb7kifm, cmqb0pkuq, cmqasb661, cmqb5ng0v).
- `cmqb7kifm` (Cosmic): R2'da 23 scene fayli bor, `metaJson.scenes` bo'sh. `cmqasb661` (Liquid): scenes bor, previewKey yo'q. `cmqb5ng0v`: R2'da fayl yo'q.
- Root `.env` AWS kalitlari bo'sh edi → lokal `isS3Configured()` false (item 11). R2 kalitlari root `.env`ga yozildi.

## Nima kutilmoqda
- Test (API restart kerak — env): `cmqb7kifm000tp3209ljb1r1h` + `cmqasb661000xlx217qfuj6z5`. Commit qilinmagan.
