# SESSION-REPORT — R4 round (R4_05 · R4_06 · R4_08 · R4_04) 2026-07-20

**4 commit (push YO'Q), har task alohida. Build PASS · boot pricing-floor PASS · money-zone TEGILMAGAN.**

- **R4_05** (d5a5eb6) — o'lchangan (measured) provider xarajatini marja/pricing hisobiga uladi.
  measured-cost.ts: `getMeasuredProviderUsd` (median), `resolveProviderUsd` (measured→table→estimate,
  safety qoidasi). BytePlus rasm `usage.total_tokens` → measured USD (gen-processor). **Lite/4.5 margin
  BEFORE −229% ($0.50 fail-safe) → AFTER +54% ($0.0705 measured)**. Control Nano Banana 2 cost-quote 4→4.
  ⚠️ Rasm token→USD RASMIY EMAS (Pro 1K token=$0.0176 vs konsol $0.045) → measured RASMDA faqat
  jadvalsiz modelда (Lite/4.5) ishlatiladi, tasdiqlangan jadvalni PASAYTIRMAYDI; VIDEO to'liq ishonchli.
- **R4_06** (fd4a7ef) — Pricing panelда measured badge ("measured (N)"/"table"/"estimate"), per-model
  **Measure cost** tugmasi (POST /pricing/measure-cost — BytePlus probe), **Measure all missing**,
  "cost rose — review" chip + confirm-gated bulk apply. Admin UI'da JONLI tekshirildi (console toza).
- **R4_08** (65331b5) — kartada **Use ▾ → Upscale** (bir-bosishlik Topaz): plagin + web. Yangi GET
  /gen/ops (yoqilgan op'lar); imzolangan quote → gen → poll → refund-on-fail. **FIX: /gen config gate'da
  "topaz" yo'q edi → 503 bo'lardi (endi ishlaydi).** Real Gigapixel upscale E2E PASS (✦11, R2'ga).
- **R4_04** (4520fcb) — Google real-yuz rad etilishi (restricted individuals/Responsible AI) endi XOM
  JSON emas, TOZA rejection oqimi: backend "realface" kategoriya + toza sabab + real-yuz QO'LLAYDIGAN
  taklif (**Omni Flash → Seedance 2.0 Fast**); klient friendlyError/errMsg xom "Omni 400: {…}" ni bloklaydi.
  Control (bad-params 400, non-Google) over-match qilmaydi.

**Bir-bosishlik Topaz (yoqilgan):** Upscale Image (Gigapixel 5002) · Upscale Video 2×/4× (Proteus 5001).
Remove BG (5003) hali YO'Q (subscription).

**OWNER ACTIONS:**
1. Topaz "Matting / Background Removal" entitlement → 5003 enabled:true (kod tayyor).
2. Seedream rasm ANIQ narxi uchun REAL BytePlus invoice bilan token→USD stavkasini tasdiqlang (yoki
   Lite/4.5 ga tasdiqlangan statik narx qo'shing) — hozir measured ($0.07) owner aytgan diapazonда.
3. Measure cost FAQAT BytePlus (token usage); boshqa provayderlar jadvaldan narxlanadi.
