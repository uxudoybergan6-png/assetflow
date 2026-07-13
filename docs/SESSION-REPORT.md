# SESSION REPORT — P1 #3 (CDN, Block E) · per-object public, NOT bucket-wide

**Bajarildi (API), PUSH QILINMADI. Bucket-wide `allUsers` BERILMADI (pack-leak oldi olindi).**

- `lib/s3.ts`: `isPublicReadKey()` — YAGONA allow-list (thumb/preview/scenes + gen display
  derivativlari `-thumb/-poster/-preview/-disp`). `aclFor()` → 3 upload funksiyaga ulandi; ACL FAQAT
  `CDN_BASE_URL` set bo'lganda beriladi (uniform bucket'ga ACL yuborilmaydi → upload buzilmaydi).
- `getPublicOrSignedUrl()`: CDN'da ham PRIVATE kalitlar SIGNED qoladi → gen asl/refs provayderga
  yetadi, LEAK bo'lmaydi. Pack/mogrt DOIM gated route → 5-daq signed (o'zgarmadi).
- `scripts/backfill-public-acl.ts` — mavjud obyektlarga public-read (faqat allow-list; dry-run default).
- `cloudrun-env.yaml`: `CDN_BASE_URL=https://storage.googleapis.com/assetflow-assets-2026`
  (gitignored → owner `gh secret set CLOUDRUN_ENV_YAML`). CSP `_headers` allaqachon GCS'ni ruxsat etadi.

**Isbot (jonli bucket, 201 obyekt):** dry-run → 51 public / 150 private; pack.zip · gen asl · gen-refs
HAMMASI private. curl HOZIR: pack.zip=403 ✅ gen-original=403 ✅ gen-refs=403 ✅ (money-critical isbot
o'tdi). thumb/preview/display=403 hozir (bucket hali uniform) → owner qadamidan keyin 200.

**Kutilmoqda (owner):** bucket fine-grained (UBLA lock 2026-09-28gача OCHIQ) + PAP=inherited →
backfill `--apply` → `gh secret` + deploy → to'liq isbot. WEB/PLUGIN KOD O'ZGARMAYDI (thumbUrl kontrakti
bir xil; plagin expired-thumb qora-karta bug'i ham tuzaladi).
