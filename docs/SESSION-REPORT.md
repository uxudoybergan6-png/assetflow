# SESSION REPORT — 2026-06-13 (kech-5) — Render OOM (512MB) fix

## Nima qilindi
Render'da katta pack yuklashda `Ran out of memory (used over 512MB)` → instance qayta ishga tushardi. Pipeline auditi: multer=diskStorage, unzip=tashqi jarayon, ffmpeg=tashqi — hammasi disk/stream. **Asl sabab: AWS SDK v3 checksum.**

## Asl sabab
AWS SDK v3 (`@aws-sdk/client-s3` 3.1057.0) default `requestChecksumCalculation="when_supported"` — `PutObjectCommand` stream body ustidan CRC32 ni OLDINDAN hisoblaydi. Cloudflare R2 stream-trailer checksumni ishonchli qo'llamagani uchun SDK **butun faylni xotiraga yig'adi** → 300MB+ pack 512MB ni yorib o'tadi.

## Yechim — apps/api/src/lib/s3.ts
- **S3Client**: `requestChecksumCalculation: "WHEN_REQUIRED"` + `responseChecksumValidation: "WHEN_REQUIRED"` (proaktiv checksum buffering o'chadi; R2 uchun Cloudflare tavsiyasi).
- **uploadFileToS3**: `PutObjectCommand` → `@aws-sdk/lib-storage` `Upload` (multipart). `partSize=8MB`, `queueSize=4` → cho'qqi xotira ≈ 32MB (fayl 3GB bo'lsa ham). `leavePartsOnError:false`.
- **package.json**: `@aws-sdk/lib-storage ^3.1068.0` qo'shildi.

## Tekshirildi
- `npm run build -w apps/api` → EXIT 0 (Upload tiplari + checksum config OK).

## OOM sabab EMAS (latent)
- `mogrt-extract.ts` `execFileSync` — sinxron `unzip` event-loop'ni 60s gacha bloklaydi → `/health` javob bermaydi (Render unhealthy deb restart qilishi mumkin). Xotira emas; keyinroq async `execFile` ga o'tkazish tavsiya.

## DIQQAT
- Commit qilingan, **push KUTILMOQDA** (foydalanuvchi qiladi).
- Render Metrics: katta pack yuklab, xotira 512MB ostida qolishini kuzating.
- 3GB fayl + sekin uplink → proxy timeout bo'lishi mumkin (OOM emas, alohida masala).
