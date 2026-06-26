# SESSION REPORT — 2026-06-26 — Video yaratish tool (Seedance 2.0 Fast)

## Bajarildi

1. **gen-models.ts:** `GenModel` tipiga `videoSettings` deskriptori qo'shildi. Seedance 2.0 Fast modeli (id:3101, provider:fal, falModel:bytedance/seedance-2.0/fast/image-to-video, perSec:{480p:8,720p:12}, autoSec:5) qo'shildi.
2. **gen-models.ts:** `resolveVideoParams` — "auto" davomiylik → `videoSettings.duration.autoSec` (narx hisoblash). `computeGenCost` — `perSec[res] × duration` formulasi (videoSettings bor bo'lsa).
3. **fal.ts:** `falSubmit` → `opts.maxPolls` parametri (video uchun 150 poll ≈ 280s). `falVideo()` funksiyasi: Seedance queue submit + poll + CDN download.
4. **gen-processor.ts:** `falVideo` import. `runFalVideo()` funksiyasi (referenceUrl → start kadr, referenceEndUrl → end kadr, materializeRefUrl). `provider==='fal'` → `runFalVideo`, aks holda `runVideo`.
5. **Plugin:** `.axvg` CSS scope (frames, fbox, vwrap, video, vacts, aud-toggle). `<section id="v-vidgen">` (start/end kadrlar, prompt, sozlamalar, sheets). vgScript IIFE (model yuklanishi, kadr upload, enhance, cost, poll, video player, AE import). AI_CATS → `dest:'vidgen'` (soon:true olib tashlandi).

## Natija

Backend tsc TOZA. vgScript syntax TOZA (20411 b). `dest:'vidgen'` ulandi — launcher chiqadi. API PUSH kerak (Render): Seedance model (3101) + FAL_KEY env.

## KUTILMOQDA

Render deploy (FAL_KEY env) + AE plugin qayta o'rnatish (`bash install-cep.sh`) + end-to-end test (kadr yuklash → gen → video player → AE import).
