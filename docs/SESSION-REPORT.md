# Sessiya hisoboti — 2026-07-11 (HOTFIX: Cloud Run boot crash, deploy #70)

**Muammo:** BATCH4 push'idan keyin deploy startup probe'da yiqildi. Ildiz sabab:
`gen-models-validate.ts` runtime ro'yxatlari eskirgan — BATCH4 qo'shgan `image-upscale`
(1015), `video-upscale` (3201) feature va `google-tts` (2002) provider FEATURES/PROVIDERS
Set'larida yo'q edi → `validateGenModelsOrThrow()` (index.ts) `app.listen`'dan OLDIN throw
→ protsess o'ldi → `/health` probe javobsiz. TS build o'tgan (type union yangilangan,
runtime Set'lar emas). `google-tts.ts` TOZA chiqdi (REST + lazy auth, dep mavjud) — taxmin
qilingan SDK/env sababi emas.

**Tuzatish (money-zone TEGILMAGAN):** (1) validator ro'yxatlari + featureByMode'ga 3 qiymat;
(2) `apps/api` build = `tsc && node dist/lib/gen-models-validate.js` — katalog drifti endi
lokal/CI/Docker buildda aniq xabar bilan yiqiladi; (3) gen-models.ts union'lariga eslatma.

**Isbot:** pre-fix validator aynan 3 xatoni berdi; post-fix `✓ 41 entry, 0 muammo`;
`node dist/index.js` (NODE_ENV=production) → `/livez` 200, `/health` 200 (db:ok, storage:ok).
**Kutilmoqda:** USER push → deploy o'tadi → Admin → Pricing → "Apply target margin" (2.0×);
migratsiya YO'Q; AE jonli test (BATCH4 hisoboti: docs/FIX-PROMPTS-BATCH4-2026-07-10.md).
