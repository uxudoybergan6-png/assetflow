# Sessiya hisoboti — MUAMMOLAR-2 qadam 29 (P21) (2026-07-13)

**Bajarildi (API + web `platform/index.html`/`ff-api.js` + plagin `AssetFlow_Plugin.html`), PUSH QILINMADI:**

- **29 (P21) — KREDITLAR EKRANI.** Ilgari "Credit activity" `state.gens`'dan yasalardi → QAYTARILGAN KREDITLAR KO'RINMASDI. Endi:
  - **API** (`studio-gen.ts`): `GET /credits/ledger?cursor=&filter=` — HAQIQIY `CreditLedger` (consume/refund/topup/clawback), keyset paginatsiya + agregatlar (Spent/Refunded/Net/Purchased); har qator bog'langan gen bilan boyitiladi (mode/model/prompt/thumb/holat), o'chirilgan gen `{deleted:true}` (crash yo'q). `GET /downloads` — REAL `TemplateDownloadEvent` (panel endi "coming soon" stub emas). READ-ONLY, money-zona TEGILMADI.
  - **Web**: `FFAPI.creditLedger`/`downloads`; Account→Subscription&credits: totals (Spent·Refunded YASHIL·Net·Purchased) + filter chiplar (All/Spent/Refunded/Purchased) + qatorlar (tur ikonkasi/thumb · IMZOLI summa: yechim QIZIL, refund YASHIL · balans) · qator→gen lightbox'da (eski gen id bilan tortiladi, o'chirilgan=halol xabar) · "Load more"; Downloads tab real ro'yxat.
  - **Plagin**: `renderLedger` endi `/credits/ledger`'dan (refunds ko'rinadi) + Spent/Refunded/Net totals header.

**Tekshirilgan:** `npm run build -w apps/api` (OK), node inline-syntax (web+plagin, 0 xato), web boot toza (landing/handlerlar renderVals ishladi — brauzer smoke test). **Kutilmoqda:** push→deploy; jonli auth-li kreditlar ekrani + AE test.
