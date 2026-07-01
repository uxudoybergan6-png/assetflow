# SESSION REPORT — 2026-07-01 — Nano Banana 2 (Gemini 3.1 Flash Image) plaginga ulandi

Barcha qo'shilgan modellar vaqtincha o'chirilgach (toza qayta-qo'shish), foydalanuvchi tanlovi bilan BIRINCHI model — Nano Banana 2 — to'liq spec bilan ulandi.

## Nano Banana 2 (id 1010) — JONLI ✅
- **Model:** `gemini-3.1-flash-image` (Model Garden'da "Nano Banana 2" — 2.5'dan yangi/kuchli).
- **MUHIM region:** yangi Gemini 3.x image FAQAT `global`da (us-central1 → 404). Adapter `locationFor()` bilan model'ga qarab region tanlaydi.
- **Imkoniyatlar (jonli sinov):** t2i + referens-tahrir; 8 nisbat (16:9→2752×1536 ✓); o'lcham 1K/2K/4K (4K→4096² 16MP, ~51s).
- **UI:** Model + Nisbat(8) + **Sifat(1K/2K/4K)** + Soni(1-4) + Referens. Sifat selektori uchun `imgSettings.quality` SHART (plagin `hasQuality=!!ql`) — qo'shildi.
- **Narx:** 1K=4, 2K=8, 4K=16 kredit (qualityCost + imgSettings.quality.cost).
- **Adapter:** `vertexImage`/`vertexImageEdit` endi imageSize (imageConfig.imageSize) yuboradi; gen-processor quality→imageSize uzatadi.
- **Tekshiruv:** built adapter (global+2K) ✅; e2e prod (katalog, narx 1K=4/2K=8, gen→GCS) ✅. Deploy: cloudrun-env.yaml bilan (env qayta tasdiqlandi).

## Holat
- Rasm tab'da FAQAT Nano Banana 2 (default). Imagen 4/Ultra, Veo Fast, Omni Flash — hali `enabled:false` (birin-ketin qo'shiladi).
- Foydalanuvchi plaginda AI Tools → Rasm ni qayta ochib sinaydi (CEP qayta o'rnatish shart emas — o'zgarish katalogda, API orqali keladi).

## Keyingi
- Nano Banana 2 tasdiqlangach → keyingi model (Imagen 4 yoki Veo). Veo uchun model-card spec kerak (davomiylik/1080p/audio).
