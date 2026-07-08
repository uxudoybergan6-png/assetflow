# Sessiya hisoboti — 2026-07-08

**Vazifa:** FAZA 6b — streaming ingest (zip hech qachon butunligicha yuklab olinmaydi).

**Qilindi:**
- `s3.ts`: `readS3ObjectRange`, `createS3RangeStream` (ranged GET, fallback'siz), `uploadStreamToS3` (multipart stream, ~32MB cho'qqi).
- `ingest-zip.ts`: `openStreamingIngestZip` — EOCD/zip64 parse + markaziy katalog xotira keshi (cap 32MB) + yauzl `fromRandomAccessReader`; BARCHA FAZA 6a guardlar (entry soni EOCD'da oldindan, zip-slip, hajm capi, nisbat) katalogda — entry baytlaridan OLDIN. Eski disk-ekstraksiya olib tashlandi.
- `contributor.ts` ingest: pack 2-o'tish (hash→dedup, keyin stream-upload + hash qayta-tekshiruv), preview rasm/video kichik bo'lsa lokal (AI+ffprobe, cap 64MB env `INGEST_LOCAL_PROBE_MAX_BYTES`), aks holda faqat stream. Kompensatsiya/duplicate/statuslar TEGILMAGAN.

**Tekshirildi:** 762MB zip → cho'qqi RSS 167MB (eski yo'l ~1.5GB+); bayt-bir-xillik (pack/rasm/video hash); zip-slip/ratio-bomb/5000+entry/oversize/notzip rad; zip64+koment zip o'tdi; JONLI GCS ranged GET + bucket→bucket entry upload bayt-bir-xil. `npm run build -w apps/api` yashil.

**Kutilmoqda:** push + Cloud Run deploy; **4Gi xotira bump ENDI SHART EMAS** (default 512Mi–1Gi yetadi, zip hajmidan mustaqil); 900s timeout katta ziplar uchun hali foydali (pack 2 marta stream qilinadi).
