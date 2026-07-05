# FrameFlow — MASTER tuzatish rejasi (7 bosqich)

> Bu — yagona, konsolidatsiyalangan reja. `FIX-REJA-5-BOSQICH.md`ni (biznes 5 faza) +
> admin panel to'liq redesign + admin-managed pricing + narx-drift monitoring'ni birlashtiradi.
> Manba: SYSTEM-CHAIN-AUDIT.md + Direktor 4-agent tekshiruvi + AUDIT-2026-07-02 qolgan Faza 3/5.
>
> Biznes model: obuna+kredit top-up (hybrid) · gen marja ~2x · contributor payout 50% ·
> storage tarif bo'yicha ~3GB+ · miqyos yuzlab (o'sishga tayyor) · admin hammasini ko'radi.
> QATLAM QOIDASI: BACKEND (data/mantiq) = 1-4 & 7; ADMIN UI (ko'rinish) = 5-6. Ular ulanadi.
> Pul zonasi ehtiyot · migratsiya additive · har fix alohida commit · push QILMA · no Co-Authored-By.
> Zanjir "quvuri" (upload→approve→publish→catalog→download) ISHLAYDI — buzmaymiz.

═══════════════════════════════════════════════════════════════════
## BOSQICH 1 — Himoya · ko'rinuvchanlik · xavfsizlik  (P0 backend, arzon, DARROV)
Maqsad: tizim o'zini himoya qilsin, xarajat/xato ko'rinsin, aldab tekin/PRO olib bo'lmasin.
1. Provider USD cost yozish (studio-gen.ts:929 estimatedCostUsd) — MARJA POYDEVORI.
2. Global spend kill-switch + /gen kunlik cap.
3. PRO-without-Stripe backdoor yopish (PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false).
4. JWT_SECRET ajratish (COST_QUOTE_SECRET) — forge oldini olish.
5. Anti-abuse fail-CLOSED (Turnstile + email-verify, prod).
6. Monitoring: Sentry + real /health (SELECT 1 + S3). *(eski Faza 3.3)*
7. SSRF himoya: markaziy fetchSafe. *(eski Faza 3.2)*
8. Backup/DR: Neon snapshot + GCS versioning + DR-RUNBOOK.md.
9. Email deliverability: verified domen + DKIM/SPF. *(eski Faza 5.5)*

## BOSQICH 2 — Huquq · moderatsiya  (P0 legal/safety backend)
Maqsad: jinoiy/huquqiy xatarni yopish.
1. Kontent moderatsiya: rasm/referens/natija klassifikator; CSAM/deepfake to'g'ri BLOK.
2. Upload xavfsizligi: .zip/.aep malware skan + hash dedup + DMCA.
3. Huquqiy hujjat fix: Paddle/Stripe/Studio/credit-pack nomuvofiqlik + o'zbekcha. *(eski Faza 4.2)*
4. VAT/soliq strategiyasi (huquqshunos bilan).

## BOSQICH 3 — Daromad: to'lov · NARX DVIGATELI · monitoring  (revenue backend)
Maqsad: haqiqiy pul oqishi, ~2x marja, narx o'zgarishini SEZISH.
1. Mahalliy to'lov: Payme + Click (UZS). *(hozir faqat Stripe/USD, kalitlar bo'sh)*
2. Kredit top-up oqimi (hybrid).
3. Studio tarifi backend real (FREE|PRO|STUDIO).
4. **NARX DVIGATELI (admin-managed pricing — BACKEND):** ModelPricing DB jadvali; katalog+
   cost-quote bazadan o'qiydi (statik fayl seed); har model kredit narxi DB'da; marja hisobi
   (daromad ÷ real cost); ~2x uchun sozlash. Kredit qiymati ($0.019) sozlanadigan. UI qatlami=Bosqich 6.
5. **NARX-DRIFT MONITORING:** oylik billing reconciliation (real GCP/fal invoice vs tizim taxmini) +
   marja maqsaddan (<1.8x) tushsa avtomat ALERT (email/Slack). "Narx oshsa qanday sezaman" — javob.
6. Gen download Content-Disposition:attachment. *(eski Faza 5.4)*

## BOSQICH 4 — Zanjir yaxlitligi · payout · storage  (chain integrity backend)
Maqsad: contributor pulini olsin, statistika ishonchli, storage nazorati.
1. Real download tracking: Download modeli (schemada bor, O'LIK) atomik event; forgeable Int emas.
2. Ikki template tizimini birlashtirish (Asset vs ContributorTemplate).
3. Payout/Earnings modeli: 50% ulush (hozir o'lik stub) — har download→contributor ledger.
4. Storage kvota + privacy: tarif GB (Free ~3GB+) + enforcement + gen faqat egasiga + retention.

═══════════════════════════════════════════════════════════════════
## BOSQICH 5 — ADMIN REDESIGN: mockup + mavjud ekranlar  (UI)
Maqsad: "rasvo" admin panelni plagin/platforma kabi noldan kuchli redesign.
Usul: MOCKUP avval (barcha admin ekran, FrameFlow dizayn tizimi) → user tasdiqlaydi → 1:1 port.
Manba: packages/assetflow-studio/admin/ (index.html + js/admin-*.js) + styles.
1. Admin MOCKUP (barcha ekran: mavjud + yangi biznes) + design-system + yagona nav. USER TASDIG'I.
2. Mavjud ekranlarni 1:1 port (mantiq saqlab): Dashboard · Shablon moderatsiya · Contributor ·
   Obunachi · Tarif · Xabar · Audit/Log · Analytics · Sozlama.
3. Sozlama real backend (soxta CSV/xabar/blok tugmalari). *(eski Faza 4.4)*

## BOSQICH 6 — ADMIN BIZNES MARKAZI: yangi ekranlar + backend ulanishi  (UI↔backend)
Maqsad: audit talab qilgan admin biznes-funksiyalari (1-4 backendiga ulanadi).
1. **Moliya dashboard** — daromad/provider xarajat/marja/payout (real vaqt).
2. **Narx boshqaruvi (UI)** — model jadvali: provider cost · kredit narxi · marja(rang) · tahrir;
   Bosqich 3 narx dvigateliga ulanadi. Real cost vs belgilangan narx yonma-yon.
3. **Contributor payout (UI)** — earnings ko'rinishi + to'lov (Bosqich 4.3 backend).
4. **Har user gen sarfi** — kim qancha kredit/gen + margin (Bosqich 1.1 real cost).
5. **To'liq faoliyat jurnali** — user gen/download/import (hozir faqat admin amallari).

═══════════════════════════════════════════════════════════════════
## BOSQICH 7 — Miqyos · polish · rebrand  (scale + finish)
Maqsad: yuzlab→minglab tayyor + yakuniy tozalash.
1. Neon POOLED (pgbouncer) + directUrl + Cloud Run concurrency. *(eski Faza 3.1)*
2. N+1 + genAsset sizeBytes. *(3.4)* · pollJob backstop *(3.6)* · catalog cold-start skeleton *(4.3)*
3. Redis rate-limit (hozir in-memory/IP) + migration_lock.toml. *(5.5)*
4. Deploy xavfsizligi: canary/rollback + Secret Manager. *(3.5)*
5. Plagin rebrand: manifest com.frameflow.panel; PROD_API=api.getframeflow.app; imzolangan .zxp;
   ichki AssetFlow*→FrameFlow (texnik qarz). *(5.1)* · domen meta-tag *(5.3)* · voice model *(5.5)*

═══════════════════════════════════════════════════════════════════
## BAJARILGAN (takrorlamang)
✅ Plagin + Platforma to'liq redesign (1:1, responsive). ✅ AI Studio composer bottom-docked fix.
✅ Faza 1-2 (launch-bloker + pul-teshigi). ✅ API-correctness audit (9 PASS·4 FIXED). ✅ Landing compact.
✅ Soxta social proof/testimonial olib tashlandi · mobil filter drawer · huquqiy linklar footer *(eski Faza 4.1/4.5/4.2-links)*.

## TARTIB MANTIG'I
Backend poydevor (1→4: himoya→huquq→daromad→zanjir) → Admin UI (5 reskin, 6 biznes markaz backendga ulanadi) →
Miqyos+finish (7). Admin UI backenddan KEYIN (real ma'lumot ko'rsatishi uchun); mockup (5.1) parallel boshlansa bo'ladi.
Har bosqich ichi alohida Code promptlari (Direktordan so'ra).
