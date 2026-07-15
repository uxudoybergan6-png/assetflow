# V2 BAJARISH — HIGH (og'ir) — 2026-07-14

> MUAMMOLAR V2 (P1–P24) qayta tartiblandi. Bu fayl — ENG OG'IR 9 ta ish.
> Har promptning TO'LIQ matni: `docs/MUAMMOLAR V2-2026-07-13.md` (mos P bo'limida).
> Qoidalar: bittalab ishlat, orada `/clear`. PUSH faqat EGA qiladi. Har prompt o'z GLOBAL
> RULES blokini olib yuradi. 🔴 = pul-tutash — natijani ledger bilan tekshir.

> ✅✅ **HIGH-1 TO'PLAMI BAJARILDI (2026-07-14, 5/5):** P1·P9·P17·P20·P23 — combined bir
> urinishda (`docs/V2-HIGH-1-COMBINED-PROMPT-2026-07-14.md`), 5 commit (push YO'Q).
> 🔴 LEDGER TASDIQLANDI: enhance 1-klik×5-retry = 1 debit; 5-klik = 5 debit. Backfill 2 skript
> (clean-previews, ai-audio-type — DRY_RUN, EGA ishga tushiradi). API build toza, plugin
> node --check + install-cep OK. Ega PNG berilmadi (eslatma — kerak bo'lsa keyin).
> ✅✅ **HIGH-2 TO'PLAMI BAJARILDI (2026-07-14, 4/4):** P5·P11·P27·P32 — combined bir urinishda
> (`docs/V2-HIGH-2-COMBINED-PROMPT-2026-07-14.md`), 4 commit (push YO'Q). API build toza.
> 🔎 TOPILMA P11: sc-if/sc-for runtime aslida REACT (keyed reconcile) — blok dublikatsiyasi
> KOD BUG EMAS edi; haqiqiy sabab = 4-5 assetli katalog + qayta-approve dublikatlar → 4 bir xil
> javon. Fix = shelf dedup + <8 assetда faqat "Recommended". P27: 6 provayder fetch'ga timeout
> + 15-daq slot xavfsizlik to'ri (refund oqimi buzilmadi). P32: CORS prod hard-fail · monthStart
> UTC (🔴 deploy'da chegara 1 marta siljiydi) · register atomik · avatar magic-byte · limiterlar.
> 🔴 QOLDIQ REPORT: in-memory rate-limit per-instance = miqyos cheki (shared store, launch'dan keyin).
> 👉 QOLDI: **JONLI-TEST** (P22·P24·P35·P28 — AE/Windows, ega ishtiroki, birma-bir).

## BAJARISH TARTIBI (qat'iy — bog'liqliklar bor)

| # | Blok | Muammo | Model | Nega shu tartib |
|---|------|--------|-------|-----------------|
| 1 | A | **P1 — Watermark qayta ishlash** (AI gen toza; stock preview toza+past-rez; PNG almashish; backfill) 🔴 | Fable 5 (Medium) | hydrateGenAssets'ni birinchi bo'lib O'ZGARTIRADI — P9/P22 shunga tayanadi |
| 2 | B | **P9 — Gen media CDN URL'lar** (1 soatlik imzo → barqaror CDN; qorayish/miltillash ildizi; backfill) 🔴 | Fable 5 (Medium) | P1'dan KEYIN (bir funksiya); P22/P23 shunga tayanadi |
| 3 | C | **P5 — Sekin boot** (admin/contributor paint-first + parallel; admin to'liq katalogni yuklamaydi; refreshAfterReview) | Fable 5 (Medium) | Mustaqil, lekin P6 (Medium fayl) bilan BIR VAQTDA ishlatma |
| 4 | D | **P11 — Dashboard sc-if runtime dublikatsiyasi** + javon dedup + kichik-katalog rejimi | Fable 5 (Medium) | Runtime tuzatish boshqa UI ishlaridan oldin foydali |
| 5 | E | **P17 — Generate/Enhance "Can't reach the server"** (quote retry; enhance idempotency — kredit 1 marta) 🔴 | Fable 5 (Medium) | Mustaqil; ledger-test majburiy |
| 6 | F | **P20 — AI audio → Sound Effects/Music** (nashr quvuri + haqiqiy audio player + backfill) | Fable 5 (Medium) | Mustaqil; P21 (Medium) tofu-fix bilan kesishadi — ketma-ket |
| 7 | G | **P23 — Poll-tick miltillash** (gen kartalari 3-4 sek qayta chizilishi; plugin toast bezagi) | Fable 5 (Medium) | P9'dan KEYIN (miltillashning ikkinchi yarmi) |
| 8 | H | **P24 — Plugin video modellari ochilsin** (Seedance/Omni; kompozer frames↔media-refs) 🔴 jonli test | Fable 5 (Medium) | P18 (Medium) chip-gate bilan mos bo'lishi shart — P18'dan keyin afzal |
| 9 | I | **P22 — 🔴 PLUGIN KRITIK: qora media + o'lgan tugmalar** (jonli CEP diagnostika) | Fable 5 (High) | ENG OXIRIDA: P1+P9 ko'p qismini o'zi hal qilishi mumkin |

## AUDIT QO'SHIMCHASI (2026-07-14, DIREKTOR-AUDIT-V2 fayliga qara — P25–P34)

| # | Blok | Muammo | Model | Tartib |
|---|------|--------|-------|--------|
| 10 | J | **P27 — Provayder timeout'lari yo'q → gen-pool qulflanadi; OOM yo'llari** 🔴 | Fable 5 (Medium) | P17 (E) dan keyin |
| 11 | K | **P28 — Plugin Windows'da ishlamaydi + 2 lokal in'ektsiya + AE 2022+ manifest** (✅ ega qarori: AE 2022+) | Fable 5 (Medium-High) | P22 (I) dan keyin — plagin barqaror bo'lgach |
| 12 | L | **P32 — Server hardening to'plami** (rate-limit, CORS hard-fail, monthStart UTC 🔴, register tranzaksiya) | Fable 5 (Medium) | Istalgan payt; monthStart deploy-eslatmasi bilan |
| 13 | M | **P35 — Plugin pack AE'da ochilmasligi (footage-fallback) + zip'dan preview/thumb strip** 🔴 download-hisob | Fable 5 (Medium) | Jonli AE test; P22 (I) bilan bir kunda qulay |

## Eslatmalar

- **P1 ochiq savollari — ✅ HAL QILINDI (so'rovnoma 2026-07-14):** sting olib tashlanadi,
  AI Stock preview toza+past-rez. Prompt V2 faylida yangilangan.
- **P22 jonli sessiya:** ega AE'ni ochib, CEP debug konsolini Code ko'rsatmasi bo'yicha
  birga tekshiradi. ⚠️ KO'LAM OSHIRILDI (2026-07-14): "tugmalar o'lishi" butun panel bo'ylab
  juda tez-tez — STEP 3'ga global xato-himoya qatlami qo'shildi (window.onerror + bo'lim
  chegaralari + o'zini-tekshirish). Eganing AE versiyasi tekshiriladi — AE 2021 bo'lsa
  P28'ga eskalatsiya.
- 🔴 P1/P9/P17/P24'da pul invarianti: har testda CreditLedger'da yechimlar soni to'g'ri
  ekanini tasdiqlash SHART.
