# SESSION REPORT — 2026-06-15 — Studio Gen / 1b: API endpointlar ✅

## 1b — routes/studio-gen.ts (Express, blueprint §5.2), `/api/studio` ga ulandi
- `GET  /credits` — kredit balansi {aiCredits, plan}.
- `POST /gen/sessions` — yangi session (mode, title).
- `GET  /gen/sessions/:id/generations?cursor=&perPage=&status=` — tarix (ownership, paginatsiya, filtr).
- `GET  /gen/models?mode=` — model katalog (lib/gen-models.ts: Flux Schnell/SDXL/MeloTTS).
- `POST /gen/cost-quote` → {price, signature(JWT 15m), feature} — imzolangan narx.
- `POST /gen` — imzo + (modelId,price,paramsHash) tekshiradi → kredit ATOMIK zaxira →
  queued Generation → 202 {jobId, status, creditsLeft}. (Workers AI bajarish = 1c TODO.)
- `POST /gen/prompt/enhance` — Workers AI text bilan promptni boyitadi (kreditsiz).
- `GET  /gen/:jobId` — job holati (aniq yo'llardan KEYIN — :jobId tutib qolmasin).
- requireAuth + rate-limit (40/min). Yangi lib: gen-models.ts, gen-quote.ts.

## Xavfsizlik (blueprint §7.3)
gen-quote.ts: `signCostQuote`/`verifyCostQuote` — narx JWT bilan imzolanadi, generate'da
modelId+price+mode+paramsHash mos kelishi tekshiriladi. Klient `price`ni soxtalashtira olmaydi.

## Tekshirildi (lokal, build + curl)
- /credits → {aiCredits:50,plan:free}; /gen/models?mode=image → 2 model; /gen/sessions → id;
  /gen/cost-quote → {price:5, signature} ✅
- /gen (CF yo'q) → 503 AI_NOT_CONFIGURED ✅
- Imzo unit: toza→ok; soxta narx→rad; soxta model→rad ✅
- `tsc -p apps/api` EXIT 0 ✅

## Holat
1b tugadi. Keyingi: 1c — Workers AI'ni generate oqimiga ulash (job processor → R2 → assets →
status; failed→kredit qaytarish).
