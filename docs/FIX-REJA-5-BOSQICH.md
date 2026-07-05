# FrameFlow — YAGONA tuzatish rejasi (5 bosqich, konsolidatsiyalangan)

> Manba: `docs/SYSTEM-CHAIN-AUDIT.md` (Code auditi) + Direktor mustaqil 4-agent tekshiruvi +
> eski `docs/AUDIT-2026-07-02.md` Faza 3/4/5 QOLGAN itemlari (shu yerga jamlandi — eski auditga
> qaytish shart emas).
> Biznes model: obuna+kredit top-up (hybrid) · gen marja ~2x · contributor payout 50% ·
> storage tarif bo'yicha ~3GB+ · miqyos yuzlab (o'sishga tayyor) · admin hammasini ko'radi.
>
> QOIDA: pul mantig'i ehtiyot bilan; migratsiya additive; har fix alohida commit; push QILMA.
> Zanjir "quvuri" (upload→approve→publish→catalog→download) ISHLAYDI — buzmaymiz.

## Eski Faza holati (tahlil)
- Faza 1 ✅ · Faza 2 ✅ (bajarilgan).
- Faza 3 (scale/security) ❌ QOLGAN → 1 va 5-bosqichga singdirildi.
- Faza 4 (UX/halollik) 🟡 asosan BAJARILDI redesign ichida: soxta statistika ✅, mobil filter ✅,
  huquqiy linklar footer ✅. Qoldiq (admin settings backend, cold-start skeleton) → 5-bosqich.
- Faza 5 (polish/rebrand/to'lov) ❌ QOLGAN → to'lov 3-bosqich, download tracking 4-bosqich,
  rebrand+polish 5-bosqich.

---

## BOSQICH 1 — Himoya · ko'rinuvchanlik · xavfsizlik (P0, arzon, DARROV)
**Maqsad:** tizim o'zini himoya qilsin, xarajat/xato ko'rinsin, aldab tekin/PRO olib bo'lmasin.
1. Provider USD cost yozish — `studio-gen.ts:929` `estimatedCostUsd` → margin hisoblanadigan bo'ladi.
2. Global spend kill-switch + /gen kunlik cap (hozir faqat helper'da HELPER_DAILY_CAP).
3. PRO-without-Stripe backdoor yopish (`PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false` majburiy).
4. JWT_SECRET ajratish — auth vs cost-quote imzo (sizsa cheksiz bepul gen forge).
5. Anti-abuse fail-CLOSED (Turnstile + email-verify env yo'q bo'lsa hozir OCHIQ).
6. Monitoring: Sentry + real `/health` (Prisma/S3, SELECT 1). *(eski Faza 3.3)*
7. **SSRF himoya** — markaziy fetchSafe (faqat data-URI + bizning GCS; private IP blok; redirect:error).
   *(eski Faza 3.2 — vertex-enhance.ts:86, gen-processor.ts:547/635)*
8. Backup/DR — Neon snapshot + R2/GCS versioning + tiklash runbook.
9. Email deliverability — verified domen + DKIM/SPF (hozir sandbox `onboarding@resend.dev`). *(eski Faza 5.5)*

---

## BOSQICH 2 — Huquq · moderatsiya (P0 legal/safety)
**Maqsad:** jinoiy/huquqiy xatarni yopish.
1. Kontent moderatsiya — rasm/referens/natija klassifikator; CSAM to'g'ri blok; deepfake WARN→BLOK.
2. Upload xavfsizligi — .zip/.aep malware skan + hash dedup + DMCA/takedown.
3. Huquqiy hujjat fix — Paddle/Stripe/Studio/credit-pack nomuvofiqlik (terms/privacy/refund) haqiqatga
   moslash yoki real MoR; o'zbekcha tarjima. *(eski Faza 4.2 qoldiq)*
4. VAT/soliq strategiyasi (huquqshunos bilan).

---

## BOSQICH 3 — Daromad: to'lov + narx (revenue)
**Maqsad:** haqiqiy pul oqishi, ~2x marja (hozir daromad 0).
1. Mahalliy to'lov — Payme + Click (UZS). *(eski Faza 5.4 "Paddle" o'rniga mahalliy)*
2. Kredit top-up oqimi (hybrid — hozir top-up umuman yo'q).
3. Studio tarifi — backend FREE|PRO|STUDIO real (yoki UI'dan olib tashlash).
4. Narxni ~2x'ga sozlash — real kredit $0.019, modellar ~1.3-1.5x (ZARAR EMAS, 2x'dan past).
   Cost yozilgach (1.1) real marjani ko'rib video rate biroz oshirish.
5. Gen download Content-Disposition:attachment. *(eski Faza 5.4)*

---

## BOSQICH 4 — Zanjir yaxlitligi + payout (chain integrity)
**Maqsad:** contributor pulini olsin, statistika ishonchli, storage nazorati.
1. Real download tracking — `Download`/`TemplateDownloadEvent` (schemada bor, HECH QAYERDA yaratilmaydi,
   o'lik) atomik event; contributor soni forgeable Int'dan emas real'dan. *(eski Faza 5.2)*
2. Ikki template tizimini birlashtirish (Asset vs ContributorTemplate).
3. Payout/Earnings modeli — 50% ulush (hozir o'lik UI stub); contributor "daromadim"; admin payout.
4. Storage kvota + privacy — tarif bo'yicha GB (Free ~3GB, Pro/Studio ko'proq) + enforcement +
   gen faqat egasiga + retention.

---

## BOSQICH 5 — Admin nazorati · miqyos · polish/rebrand (dashboards + scale + finish)
**Maqsad:** to'liq nazorat + yuzlab→minglab tayyor + yakuniy tozalash.
### Admin/nazorat
1. Moliya dashboard — daromad/xarajat/marja/payout (hozir yo'q).
2. Har user gen sarfi + margin ko'rinishi.
3. To'liq faoliyat jurnali — user gen/download/import (hozir faqat admin amallari).
4. Contributor earnings dashboard.
5. Admin Sozlamalar real backend (soxta CSV/xabar/blok tugmalari). *(eski Faza 4.4)*
### Miqyos/ishonchlilik *(eski Faza 3)*
6. Neon POOLED endpoint (pgbouncer) + directUrl + Cloud Run concurrency 20-40. *(3.1)*
7. admin/plugin-subscribers N+1 + genAsset sizeBytes saqlab HeadObject yo'q qilish. *(3.4)*
8. Deploy xavfsizligi: --no-traffic --tag candidate + smoke gate + rollback; Secret Manager. *(3.5)*
9. Redis rate-limit (hozir in-memory/IP) + migration_lock.toml. *(5.5)*
10. pollJob backstop: max davomiylik + xato cap → UI qulflanmaydi. *(3.6)*
11. Catalog cold-start skeleton + loadModels retry. *(eski Faza 4.3)*
### Rebrand/polish *(eski Faza 5)*
12. Plagin rebrand: manifest.xml com.frameflow.panel; 7 faylda PROD_API=api.getframeflow.app;
    build-zxp.sh; imzolangan .zxp; ichki AssetFlow*→FrameFlow (texnik qarz). *(5.1)*
13. Domen izchilligi: admin/contributor meta-tag → api.getframeflow.app. *(5.3)*
14. Voice model Google TTS yoki "tez orada". *(5.5)*

---

## BAJARILGAN (eski Faza 4 — takrorlamang)
✅ Soxta statistika/testimonial olib tashlandi (Landing redesign, Bosqich 2 marketing).
✅ Mobil UX: filter drawer + responsive header (plagin+platforma redesign).
✅ Huquqiy linklar footer'da tirik (terms/privacy/refund).

## Tartib mantig'i
1→2 (himoya+huquq, arzon, xatar yopiladi) → 3 (daromad, busiz biznes yo'q) → 4 (zanjir+payout) →
5 (nazorat+scale+finish). Har bosqich ichi alohida Code promptlari (Direktordan so'ra).
