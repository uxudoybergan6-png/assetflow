# Sessiya hisoboti — 2026-07-08

**Vazifa:** FAZA 6a — Ingest hardening: zip safety + katta fayl + duplicate + retention.

**Qilindi:**
- `ingest-zip.ts`: zip-bomb (5 GiB cap / ratio>1000 / 5000 entry, env sozlanadi) + zip-slip guard (yauzl parse xatolari ham tasniflanadi), stream-only, faqat kerakli entry'lar; `IngestZipError` = doimiy rad.
- `ingestOneZip`: asset saqlash+finalize kompensatsiyali blok — yiqilsa shablon+asset o'chadi, incoming zip retry uchun qoladi ("No files" yarim shablon endi imkonsiz); pack GCS hajmi lokal bilan solishtiriladi (fileSize=finalize markeri); yarim-yaratilgan prior retry'da qayta ingest (endi "Already ingested" maskalamaydi).
- Duplicate (C): o'z packHash mavjud → `status:"duplicate"` + duplicateOf, ikkinchi nusxa yo'q; cross-contributor anti-theft karantin o'zgarmagan. Doimiy radlarda zip o'chadi + `template.ingest_rejected` audit.
- Per-zip `status: created|duplicate|failed` (additive); Studio UI: duplicate = amber ⊘ alohida holat + toast.
- `docs/INFRA-INGEST-RETENTION.md`: GCS lifecycle (incoming/ >7 kun) + Cloud Run 4Gi/900s (USER qadamlar; /tmp=tmpfs, cho'qqi ≈2× zip).

**Tekshirildi:** slip/abs/bomb/oversize/entry-count zip'lar toza rad (temp tashqarisiga yozuv yo'q) ✓ · valid zip pack+img+vid ekstrakt ✓ · api build ✓. Money-zone tegilmadi.

**Kutilmoqda (live):** deploy → 753MB zip retry (Cloud Run memory/timeout USER qadamidan keyin), duplicate re-upload UI'da ⊘, lifecycle qoidasi qo'llash. Push qilinmadi.
