# Sessiya hisoboti — 2026-07-11 (BATCH5 Prompt #2: Seedream rasm BytePlus'da)

**Nima qilindi:**
- `byteplus.ts` → `byteplusImage()` (sinxron `POST /images/generations`, url→Buffer, 429 backoff, watermark:false, usage log).
- Katalog: 1020 Seedream 5.0 Lite (2K/4K, ref≤14, `enabled:false` — narx tasdiqlanmagan) va 1021 Seedream 5.0 Pro (1K/2K, ref≤10, `enabled:true`). Vertex rasm modellari TEGILMAGAN.
- `gen-processor` rasm dispatch'iga byteplus branch (referens=fal public-URL yo'li, Seedream'da ixtiyoriy); validator `IMAGE_DISPATCH`+byteplusModel check; `provider-cost` 1021 = 1K $0.045 / 2K $0.09 (konsol-tasdiq); 1020 ataylab yo'q → DEFAULT_PROVIDER_USD.

**Jonli test (real API):** Lite 2K — OK 32s (16384 token); Pro 1K — OK 115s (4056 token); natija GCS'ga yuklandi (`gen/live-test/...`). Rasm sifati tekshirildi.

**Kutilmoqda:**
- Lite rasmiy narxi (konsol/invoice) → provider-cost qatori + yoqish.
- Push + Cloud Run deploy; AE plagin/webda Pro'ni Vertex bilan solishtirish.
- Kelajak: sequential/batch, interactive editing (Draw), Seedream→Seedance trusted-chain.
