# Sessiya hisoboti — 2026-07-08 (FAZA 1: Legal / Compliance)

**5 commit (A–E), har soha alohida. Push QILINMADI.**

1. **1a** `71ef842` — terms/privacy/refund: "Stripe" → **Lemon Squeezy (MoR, VAT/soliqni o'zi ushlaydi)**; Pro/Studio + kredit paketlari REAL deb tuzatildi; LEGAL-TODO qayta yozildi ("needs lawyer review" markerlar).
2. **1b** `b104436` — Contributor **rights attestation**: majburiy checkbox har upload yo'lida (plagin + studio single+bulk) submit'ni bloklaydi; backend qayd etadi (`ContributorTemplate.rightsAcceptedAt/Version`, additive migration); login "I agree" → Terms link.
3. **1c** `11249af` — GDPR: `POST /api/users/export` (o'z ma'lumoti JSON) + `DELETE /api/account` (typed confirm → PII anonim, tokenVersion++, plugin token/session/OAuth o'chirish, PluginProfile=REMOVED, shablon unpublish, moliyaviy saqlanadi, oxirgi admin himoya, audit; `User.deletedAt` migration); platforma "Data & privacy" karta + delete modal.
4. **1d** `b730806` — DMCA: public `platform/dmca.html` policy + report form; `InfringementReport` model + `/api/dmca/report` (public) + admin list/resolve; actual takedown = mavjud endpoint.
5. **1e** `3e28c57` — Moderatsiya prod'da rasm inputi uchun **fail-closed** (API xato / REQUIRE_IMAGE_VERIFICATION) + boot banner; `docs/PROD-ENV-CHECKLIST.md`.

**Tekshirildi:** tsc + `npm run build -w apps/api` yashil; legal HTML'da "Stripe" yo'q; platforma SPA + dmca.html preview'da render + form gating ishladi.

**Kutilmoqda:** `migrate:deploy` (3 migration: rights, deletedAt, InfringementReport), Render/Cloud Run deploy, `MODERATION_API_KEY`+`VIRUSTOTAL` prod env, AE plagin jonli test, huquqshunos tekshiruvi (LEGAL-TODO).
