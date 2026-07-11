# FrameFlow — Launch-Tayyorlik Registri (to'liq proaktiv audit)

*2026-07-08 · Direktor · butun mahsulot bo'ylab 7 audit (miqyos · download/limit · visibility · red-team×3 ·
biznes · operatsion · legal · product). Bu — "chain ishlaydi"дan "haqiqiy, qonuniy, boshqariladigan, firibgarlikка
chidamli BIZNES"gача bo'lган bo'shliqlar xaritasi. Har biri kod bilan tasdiqlanган (taxmin emas).*

Aloqador: docs/THREAT-REGISTER.md (xavfsizlik/abuse) · docs/HARDENING-FAZALAR.md (HF-1..6) · docs/KONTENT-QUVURI-SXEMA.md.

---

## 🔴 LAUNCH-BLOKERLAR (ommага chiqishдан oldин ALBATTA)

### Pul-KIRISH accounting — YO'Q (eng katta biznes-teshiк)
- **Haqiqiy obuna puli HECH QAYERDA yozilmaydi.** LS webhook to'lov summаsини (total/tax) o'qimaydi; Payment/Order/Revenue
  modeli yo'q. "Revenue" hamma joyда = kredit×qiymat proksi. Platforma o'z yalpi daромадини BILMAYDI. (lemonsqueezy.ts:70-104, schema)
- Credit-pack daromadi ham yozilmaydi. MRR = client-side taxmin (faqat Pro, Studio yo'q).
- **Refund / chargeback / dunning YO'Q** — LS refund kreditni qaytarib olmaydi, planni tushurmaydi. (lemonsqueezy.ts switch)

### Xavfsizlik / abuse (THREAT-REGISTER to'liq)
- **Earning farming** (self/qayta/tasdiqsiz download → cheksiz payout Pro'да). **Malware-scan bypass** (/assets skansiz→null gate'дан o'tadi).
  **pending/null pack download bo'ladi.** **Katalog unauth+paginatsiyasiz+S3-fanout DoS.** **Contributor route rate-limit yo'q.**
  **COST_QUOTE_SECRET→JWT fallback.** **Self-serve CONTRIBUTOR** (register asContributor→approval bypass). **Legacy role endpoint** (last-admin/audit yo'q).

### Operatsion — ma'lumот yo'qotish xavfи
- **Backup ISHLAMAYAPTI** (workflow bor lekin BACKUP_GCS_BUCKET/IAM sozlanmagan) + **bucket versioning YO'Q** → bucket o'lса asset qaytmaydi.
- **Sentry NO-OP** (paket o'rnatilmagan, DSN yo'q) → prod xatolarини UMUMAN ko'rmaysan. **Alerting yo'q.**
- **Live sirlar** cloudrun-env.yaml'да ochiq (JWT/DB/API kalitlar) → ROTATE + Secret Manager.

### Huquqiy
- **Terms/Privacy/Refund "Stripe" deydi, kod Lemon Squeezy (MoR).** VAT/MoR nomuvofiq → qonuniy risk. (terms.html:37, privacy.html:33)
- **Contributor rights attestation YO'Q** — upload'да "bu mening ishим, tarqatishga haqim bor" checkbox yo'q. Pullik katalogга kafolatsiz uchinchi-tomon kontent.
- **Rebrand yarim:** CEP bundle-id hali `com.assetflow.demo` + plagin/studio **hardcoded eski backend URL**lar (getframeflow.app o'rniga eski run.app). ⚠️ Jonli tasdiq kerak.

---

## 🟡 MUHIM (launchга yaqin, lekin kritik emas)

### Pul-CHIQISH (payout)
- **Payout IJROSI yo'q** — faqat qarz-balans yoziladi, bank/Payoneer/Payme API yo'q, admin qo'лда tashqarида to'laydi.
- **Payout formula placeholder** — qat'iy $0.10/download (owner TODO), biz kelishган **revenue-share (net 50%)** emas.
- **Reconciliation:** provayder-xarajат recon bor; obuna daromади vs LS-settlement recon YO'Q.

### Operatsion reliability
- **transcode/embed reconciler yo'q** — restart'да "pending"да qotadi (gen-processor esa mustahkam). Health Cloud Run rollout'ни himoyalamaydi. Global rate-limit/WAF yo'q. Notification bo'shliqlari (welcome/payment email yo'q, ADMIN_NOTIFY_EMAIL o'rnatilган lekin ISHLATILMAYDI → admin yangi upload'дан xabarsiz). DKIM/SPF tasdiqlanmaган (aks holда email yetkazilmaydi).

### Miqyos (= HF-4)
- Katalог+admin paginatsiya+N+1, streaming download, bulk-approve async, CDN_BASE_URL prod.

### Metrikалар
- Churn / retention / conversion(free→pro) / LTV / ARPU — YO'Q (faqat headcount).

### Ko'rinish
- Contributor karантин/dublikatни ko'rmaydi (o'lik "Pending"). Contributor earnings UI yo'q. Web-detail video qora.

### Huquqiy/compliance
- **Account deletion / data export YO'Q** (GDPR — privacy va'да beradi, kod bajarmaydi). Cookie consent yo'q. DMCA public policy yo'q (takedown endpoint bor). Moderation ML key yo'q bo'lса fail-open (prod'да MODERATION_API_KEY + VIRUSTOTAL o'rnatilганини tasdiqla).

---

## 🟢 POLISH
- i18n nomuvofiq (UI ingliz, legal o'zbek — birini tanla). Search in-process cosine (5000'да sekinlashadi — vector index kerak).
  "Coming soon" placeholder tool'lar user'ga ko'rinadi. FAQ/help/onboarding guide yo'q. Web download nomi, ".zip" yorlig'i, plagin o'lik sahna kodi, admin count nomuvofiqliklari.

---

## ✅ HAQIQATAN MUSTAHKAM (tegma)
Auth/tokenVersion revocation · IDOR yopiq · 3 webhook imzo+idempotent · kredit spend atomik + refund idempotent ·
download/limit atomik fail-closed · gen-processor (atomic claim+resume+stuck-reconciler+provider-job persist) ·
zip-bomb/slip streaming guard · SSRF allowlist · malware+CSAM/deepfake preflight FAIL-CLOSED prod · migration-gated deploy ·
--no-cpu-throttling+min-instances-1 · real /health+/livez · presign scoping · AI Studio core flow · display-rebrand.

---

## 5 FAZA (barcha muammolar — sohaviy, ustuvorlik bo'yicha)

### FAZA 1 — Huquqiy / Compliance 🔴 ✅ TUGADI (5 commit 71ef842/b104436/11249af/b730806/3e28c57, push YO'Q, pul-zonasi tegilmagan)
BAJARILDI: (A) legal HTML Stripe→Lemon Squeezy MoR + FREE/PRO/STUDIO+pack moslandi + LEGAL-TODO rewrite. (B) rights
attestation majburiy checkbox 3 upload yo'lida + server capture (rightsAcceptedAt/version, additiv migr) + signup Terms link.
(C) GDPR POST /users/export + DELETE /account (anonimizatsiya, tokenVersion, unpublish, moliya saqlanadi, last-admin himoya,
audit) + platform UI. (D) DMCA public dmca.html + POST /dmca/report→InfringementReport + admin resolve. (E) moderation prod
image fail-closed (MODERATION_FAIL_OPEN escape) + boot banner + PROD-ENV-CHECKLIST.md.
⚠️ YURIST KO'RIGI kerak (LEGAL-TODO'da): MoR/soliq jurisdiksiya · refund shartlari · account-delete policy · DMCA agent · i18n til.
⚠️ QOLDIQ (F2'ga): server-side attestation'siz submit'ni RAD ETMAYDI (faqat client + capture) → server enforce qo'shilsin.
⚠️ USER: migrate:deploy (3 migr) · deploy · prod env (MODERATION_API_KEY+VIRUSTOTAL+COST_QUOTE_SECRET+CORS+RESEND+BACKUP+SENTRY) ·
dmca@getframeflow.app mailbox · install-cep.sh + AE publish test.

### FAZA 1 (asl reja) — Huquqiy / Compliance 🔴 (arzon, tez, katta huquqiy risk)
Terms/Privacy/Refund → Lemon Squeezy MoR'ga moslash (Stripe olib tashlash) · upload'da contributor **rights attestation**
checkbox ("bu mening ishim, tarqatishga haqim bor") · **account deletion + data export** (GDPR) · DMCA public policy sahifa ·
cookie/consent · moderation env checklist (MODERATION_API_KEY + VIRUSTOTAL prod'da o'rnatilsin, fail-closed).

### FAZA 2 — Xavfsizlik / Abuse hardening 🔴 ✅ TUGADI (6 commit 7d9ce87/d59294d/b054bb5/3f45d9d/dc913ab/61f7d9d, push YO'Q, pul-zona guard-only)
BAJARILDI: (A) earning: @@unique(userId,templateId,kind)+skipDuplicates + self-exclusion + email-verify gate + admin-skip +
pack/mogrt rate-limit (download LIMIT o'zgarmagan). (B) /assets endi skan qiladi (disk fayl, re-download yo'q, quarantine→
extraction skip+unpublish); download+approve gate null/pending FAIL-CLOSED; approve legacy-null'ni on-demand skanlaydi. (C)
COST_QUOTE_SECRET prod JWT-fallback OLIB TASHLANDI→FATAL; gen+helper cap DailyUsageCounter DB (restart/multi-instance safe);
ceiling default-ON + fail-closed >90%; enabled model default USD + startup check; ref-upload storage quota. (D) register→USER;
legacy role endpoint o'chdi; multer ownership-before-write. (E) SSE ratelimit+cap; /logs ratelimit; upload-url sanitize. (F)
attestation server-enforce (RIGHTS_REQUIRED). 2 additiv migr (download_event_dedup, daily_usage_counter). // TODO(M5) multi-acc.
⚠️⚠️ USER DEPLOY: (1) COST_QUOTE_SECRET prod'da JWT'dan FARQLI o'rnatilsin AKS HOLDA API BOOT BO'LMAYDI (H6 fail-closed).
(2) PACK-SCAN BACKFILL: eski packScanStatus=null shablonlar endi download'da 409 → deploy'dan keyin re-scan (admin Clear pack)
aks holda katalog yuklanmaydi. (3) migrate:deploy (2 migr, dedup DELETE prod DB'da tekshir). ⚠️ QOLDIQ: attestation client+server OK.
Earning farming guards (self/dedup/ratelimit/email-gate + admin-skip) · malware-scan gate (/assets skan, pending/null
fail-closed, auto-approve gate) · COST_QUOTE_SECRET fatal · gen cap persistent + ceiling default/to'liq · ref-upload quota ·
self-serve CONTRIBUTOR→approval · legacy role endpoint o'chir · multer ownership · SSE/logs auth · rate-limit poydevor.

### FAZA 3 — Operatsion tayyorlik 🔴/🟡 ✅ TUGADI (6 commit 514bd67/e18b5f2/d3a8fca/5865e2a/0c411f1, push YO'Q, pul-zonasi tegilmagan)
BAJARILDI: (A) @sentry/node REAL dep, DSN bor→init, yo'q→no-op; captureException gen-processor/ingest/transcode/fal-webhook +
errorHandler. (B) template-reconcile.ts: transcode >30daq pending→re-run, embedding'siz APPROVED→re-embed (startup+10daq timer).
(C) helmet (CEP file:// + CDN saqlangan) + global per-IP 600/min (/health,/livez mustasno). (D) --startup-probe /health +
--liveness-probe /livez (2 deploy yo'l) + ROLLBACK-RUNBOOK.md. (E) notify.ts: welcome + LS to'lov emaillari (dedup) +
ADMIN_NOTIFY_EMAIL nihoyat ishlatiladi (submit + ingest batch). Hammasi best-effort. Lokal tekshirildi.
⚠️ USER INFRA: (1) SENTRY_DSN prod env (paket commit qilingan). (2) backup bucket + BACKUP_GCS_BUCKET + IAM + asset bucket
OBJECT VERSIONING (DR-RUNBOOK §5). (3) sirlarni ROTATE + Secret Manager. (4) Resend DKIM/SPF getframeflow.app + ADMIN_NOTIFY_EMAIL.
⚠️ JONLI: 1-deploy'da startup-probe /health 200 bersin (yiqilsa deploy yiqiladi=to'g'ri); real SENTRY_DSN xato tushsin; email oqim.
Sentry install+DSN+alerting · backup ISHLASIN (BACKUP_GCS_BUCKET+IAM) + bucket versioning + restore drill · sir rotatsiya +
Secret Manager · health-gated Cloud Run rollout + rollback runbook · transcode/embed reconciler · global rate-limit/WAF/helmet ·
notification bo'shliqlari (welcome/payment/ADMIN_NOTIFY email + DKIM/SPF).

### FAZA 4 — Pul-moliya: kirish + payout + metrikalar 🔴/🟡 ✅ TUGADI (5 commit 001f1e6/c51519a/adce173/9a4cee9, push YO'Q, atomik kredit-mantiq tegilmagan)
BAJARILDI: (A) RevenueEvent model + LS webhook to'lov summasini yozadi (subscription_payment_success invoice'idan obuna,
order'dan kredit-pack; double-count yo'q); /admin/finance real gross/net/tax/per-plan/MRR. (B) order_refunded/refunded→
manfiy RevenueEvent + obuna refund→FREE + kredit-pack refund→sarflanmagan topup clawback (atomik gte, hech qachon manfiy,
bepul ulush tegilmaydi, partial proportsional); dunning payment_failed→billingIssue; chargeback flag; refund email; idempotent.
(C) POOL payout: pool=(net obuna−AI xarajat)×poolShare, legitim download ulushi (Faza 2 gate), davr+contributor idempotent,
recompute faqat to'lanmagan; ijro QO'LDA. (D) PlanChangeEvent + /admin/metrics (churn/conversion/ARPU/LTV basic) + Finance
what-if slider + Payouts pool panel + Business metrics ekran. 4 additiv migr. Lokal E2E imzolangan webhook bilan PASS.
⚠️ CONFIG QAROR (USER, prod env): PAYOUT_MODE default=**pool** (flat stavkani ALMASHTIRADI! eski=per_download; oy o'rtasida
almashtirma) · CONTRIBUTOR_POOL_SHARE default=0.50 (net'ning ulushi). ⚠️ USER: push→migrate:deploy (4 migr)→PAYOUT_MODE/
POOL_SHARE qaror→real LS webhook (*_usd payload maydon taxminini tasdiqla). TODO: yillik MRR normalizatsiya, chuqur kohort.
Haqiqiy obuna daromadini yozish (LS to'lov summasi → Revenue/Order model) · MRR/gross/net/per-plan · refund/chargeback/dunning
handling · settlement reconciliation · **revenue-share payout** (net 50%, download-ulush, farm-chidamli) + admin **jonli iqtisod**
ekran + payout ijro · churn/retention/conversion/LTV/ARPU metrikalar.

### FAZA 5 — Miqyos + Rebrand + Product/UX polish 🟡/🟢 ✅ TUGADI (16 commit main, push YO'Q, gate'lar tegilmagan)
BAJARILDI: (A) Scale: /catalog + /contributor/templates take+cursor paginatsiya (3 klient sahifalaydi); N+1 fix
assetKeysJson ustuni (asset-state.ts, listing S3'ga CHIQMAYDI) + backfill script + assets-uploaded signal; streaming
.aep→.zip download (~32MB cap); ingest semafor (INGEST_CONCURRENCY=2); search allaqachon pgvector, in-memory fallback
2000 cap+TODO. (B) Rebrand: bundle-id com.frameflow (reinstall shart); barcha URL→api/admin.getframeflow.app (eski→STALE
auto-fix); host.jsx dialog/label/email/npm nom. i18n TODO (USER qaror=INGLIZ→follow-up). (C) UX: contributor scan-badge +
earnings karta; web-detail poster (qora yo'q) + download shablon-nomli; 278 qator o'lik sahna-import o'chdi; "COMING SOON"
yashirildi; admin count kelishtirildi; platform/help.html FAQ+guidelines. API build green, node --check, studio:sync.
⚠️⚠️ USER DEPLOY TARTIBI MUHIM: (1) migrate:deploy AVVAL (yangi kod assetKeysJson so'raydi — ustunsiz katalog YIQILADI) →
(2) API deploy → (3) backfill: node apps/api/dist/scripts/backfill-asset-keys.js. (4) install-cep.sh reinstall (bundle-id).
(5) support@getframeflow.app mailbox. FOLLOW-UP: legal+o'zbek UI → INGLIZ (kichik, alohida).

## ⭐ HOLAT (2026-07-11, Direktor jonli tekshiruvi): BARCHA 5 FAZA TUGADI va **PUSH+DEPLOY BO'LGAN** —
git 0 ahead; prod `/health` ok; BATCH3 maydonlari (`kind`/`stockType`) katalogda jonli → migratsiyalar qo'llangan;
`COST_QUOTE_SECRET` o'rnatilgan (API boot fakti). **QOLDI:** (a) prod env tasdig'i — SENTRY_DSN · BACKUP_GCS_BUCKET+
versioning · MODERATION_API_KEY · VIRUSTOTAL · LS LIVE (tashqaridan tekshirib bo'lmaydi); (b) Admin → Pricing
"Apply target margin" bosilganini tasdiqlash; (c) AE plagin jonli E2E; (d) 🔴 **KONTENT: prod katalogda FAQAT 1
published shablon, landing "5000+" deydi** — eng katta amaliy bloker; (e) yurist ko'rigi (LEGAL-TODO).

### FAZA 5 (asl reja) — Miqyos + Rebrand + Product/UX polish 🟡/🟢
Miqyos: katalog+admin paginatsiya + N+1 (S3 flag→DB) + streaming .aep download + ingest concurrency + CDN + search vector-index.
Rebrand: bundle-id (com.assetflow→frameflow) + hardcoded legacy URL + i18n qaror (UI vs legal bir tilda). Ko'rinish/UX (=HF-6):
contributor scan-badge + earnings UI + web-detail poster + coming-soon cleanup + FAQ/help + o'lik kod + admin count moslash.

**Tavsiya etilgan tartib:** 1 (huquqiy, arzon+kritik) → 3 (ops-dataloss, arzon+xavfli) → 2 (abuse) → 4 (moliya) → 5 (miqyos/polish).
**Parallel:** faqat UI-only (Faza 5 frontend) backend fazasi bilan; qolganlar bir xil backend fayllarga tegadi → ketma-ket.
**⚠️ Ko'pi PUL-ZONA/xavfsizlik — minimal diff, mavjud atomik mantiqni buzmaslik, jonli test.**
