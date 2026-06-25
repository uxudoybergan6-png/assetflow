# SESSION REPORT — 2026-06-26 — AI Tools chuqur audit (ultracode/adversarial) + bloker tuzatishlar

- Metod: 24-agentli audit (7 o'lcham) + kredit/refund, xavfsizlik, overlay invariantlari mustaqil adversarial tasdiq. To'liq hisobot: `docs/AI-TOOLS-AUDIT.md`.
- **BLOKER tuzatildi — double-refund/bepul-gen race** (`gen-processor.ts`): `fail()`/`done` UNGUARDED edi vs atomik `reconcile` → 10 daq'dan oshган job double refund yoki failed→done. Tuzatish: ikkalasi atomik `updateMany where status IN[queued,running]`/`=running`, refund faqat count>0. Node race test 6/6 PASS.
- **BLOKER tuzatildi — timer/network leak** (plagin): tooldan chiqsa poll/progress timerlari tozalanmasdi. `teardownGen()` (`window.axIGTeardown`) — `go()`+`openHistory`'да. Headless: navigate → poll TO'XTAYDI.
- **Jiddiy tuzatildi:** cancel YOLG'ON "kredit yechilmadi" → `submitted` flag → "Orqa fonда davom etadi"; enhance kredit chip stale → endpoint `creditsLeft` + `setCreditChip`; JWT_SECRET zaif guard → `WEAK_SECRETS`+`<32` prod-blok (auth/cost-quote bir xil kalit). Headless/tsc tasdiq.
- **Past/minor tuzatildi:** `genParamsHash` `referenceUrls` strip (latent BAD_QUOTE); `falEnhancePrompt` tolerant parse; batch download CEP toast-spam → 1 toast.
- **Invariantlar (tasdiq):** kredit/refund HOLDS (tuzatishdan keyin), xavfsizlik HOLDS (FAL_KEY sizmaydi, XSS eskeyplangan), overlay HOLDS. Qoldiq: count>1 qisman-xатoда orphan R2 (storage, kredit-to'g'ri).
- **Yangi model hukmi: QISMAN** — backend katalog generic+tayyor; LIVE imggen UI bitta modelга hardcode (`:9300` filter → picker kerak) + fal adapter image-edit'ga xos (generic kerak) + gen-processor routing image blokiда. Qadamlar `AI-TOOLS-AUDIT.md`да.
- TEKSHIRUV: `npm run build -w apps/api` TOZA; plagin 6 blok 0 xato. KUTILMOQDA: backend PUSH (Render) + install-cep.
