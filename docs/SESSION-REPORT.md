# SESSION REPORT — 2026-06-30 — Video poydevor: model-aware refactor (B1–B18)

Maqsad: yangi video model qo'shishni "bitta deklarativ entry" qilish. Invariant: Seedance 1:1 saqlandi.

Backend (gen-models.ts, gen-processor.ts, fal.ts) — tasdiqlandi (tsc ✓ + backward-compat 10/10 byte-identical):
- **B1** `videoInput` descriptor + generic `buildFalVideoInput` (imgSettings/falImage naqshi) → fal kalitlari modeldan.
- **B2** text-to-video: `videoRequiresStartFrame`; i2v kadr majburiy, t2v emas.
- **B3** `pricing:'per-generation'` → `computeGenCost` + frontend `cost()` shunga qarab.
- **B5** `extractFalVideoUrl` (model `outputPaths`) — boshqa javob shaklini ham o'qiydi.
- **B6** 3001–3007 (non-fal Veo/Kling/Wan) `enabled:false` (kredit yemaydi).
- **B9** o'lik `falVideo`/`falRefVideo` (99 qator) olib tashlandi; `falVideoUrlToBuffer`.
- **B15** audio ixtiyoriy (audioKey), **B16** duration string/number.

Frontend (AssetFlow_Plugin.html — node ✓, AE jonli test kutiladi):
- **B11** model ikonkasi brenddan (avval har modelда "BD"). **B12** neytral default'lar (Seedance/0-12 sizmaydi). **B4** noma'lum refKind→'none' (t2v submit bo'ladi). **B17** model-switch confirm umumiy.

Deferred (kerak bo'lmaguncha): **B7** extra-param UI (seed/negative_prompt), **B8** dispatch-table (t2v marshrut allaqachon ishlaydi), **B10** quote-hash (ataylab: videoUrls hashда — chegirma-gaming oldini oladi), **B13/B14/B18** (LOW). Kutilmoqda: push + AE test. Endi Kling/Veo/Wan/t2v ≈ bitta entry bilan qo'shiladi.
