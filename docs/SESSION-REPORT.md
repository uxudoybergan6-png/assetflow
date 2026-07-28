# Sessiya hisoboti — 2026-07-28

**Vazifa:** Seedance 2.0 Mini (BytePlus, id 3103) web + AE plagingacha E2E ulanganini TASDIQLASH; haqiqiy uzilish topilsa yopish.

**Natija: 6/6 PASS — kodda uzilish YO'Q, tuzatish talab qilinmadi (hech narsa o'zgartirilmadi).**
- Katalog: `gen-models.ts:1393` id 3103 `enabled:true`, `byteplusModel: dreamina-seedance-2-0-mini-260615` — rasmiy docs (`Model list.txt`, 480p/720p, 4–15s, multimodal ref + i2v) bilan mos. Runtime `getModelsByMode("video")` → 3103 QAYTARADI (11 ta model, tasdiqlandi `tsx` bilan).
- Dispatch: `gen-processor.ts:1709` `provider==="byteplus"` → `runByteplusVideo` → `buildByteplusVideoBody` (`model.byteplusModel`, mediaRefs/endFrame/resolution/duration deskriptordan) — Mini uchun maxsus shart YO'Q. Boot validator `byteplus` ni PROVIDERS + VIDEO_DISPATCH da qamraydi va har byteplus modeli uchun body self-test bajaradi.
- Narx: `provider-cost.ts:79` 3103 {480p 0.032, 720p 0.071}; runtime `estimateProviderUsd` 480p/4s=$0.128, 720p/15s=$1.065 (null EMAS). Marja 480p ≈4.7×, 720p ≈3.2× (target 2×). `assert-pricing-floors` = SOTUV kanallari poli, per-model emas → Mini'ga ta'sirsiz.
- Web: `platform/index.html` `loadModels()` → `FFAPI.models(mode)` = `/api/studio/gen/models?mode=video`; yagona filtr `enabled!==false` + `video-upscale` ajratish. Hardcoded whitelist/dedup YO'Q.
- Plagin: `AssetFlow_Plugin.html:14429` `ensureVgMeta()` shu endpointdan; SC_19 whitelist QAYTMAGAN (faqat `video-upscale` chetlanadi); `renderVgModelSheet` TO'LIQ ro'yxatni chizadi (slice yo'q). O'rnatilgan CEP (`com.frameflow`, 23-iyul) = manba bilan bayt-bir-xil.
- Deploy: `deploy-cloudrun.yml` oxirgi 8 run "success"; eng so'nggi 2026-07-26, headSha `7f7a010` = joriy HEAD → prod Mini commit'idan (f74c7ee, 07-20) YANGIROQ. **Deploy KERAK EMAS.**

**Topilgan 2 haqiqiy nuqta (uzilish emas, ma'lumot uchun):**
1. Web "RECOMMENDED FOR VIDEO" tez-tanlov faqat 4 ta model ko'rsatadi (`modelPickList.slice(0,4)`) → 10 ta yoqilgan video modeldan Mini u yerga tushmaydi; to'liq "All models" modalida BOR. Bu dizayn, xato emas — Mini'ni tez-tanlovda ko'rish uchun uni **pin** qilish kifoya (pinlangan model birinchi chiqadi).
2. Aloqasiz: 1020 "Seedream 5.0 Lite" va 1022 "Seedream 4.5" `provider-cost` yozuvisiz (`findEnabledModelsWithoutCost`) → marja hisobida $0.5 default. Pul zonasi — TEGILMADI, egasi qaroriga qoldirildi.

**Sizning qo'lingizda qolgan yagona jonli qadam — BytePlus konsol aktivatsiyasi:**
`.env` va `cloudrun-env.yaml` dagi `BYTEPLUS_API_KEY` **bir xil** (sha256 fingerprint `ab0afcfcc1f9`) → lokal probe = prod tekshiruvi. Ishga tushiring: `node scripts/probe-byteplus-model.mjs dreamina-seedance-2-0-mini-260615 480p 4` (~$0.13). HTTP 200 + taskId = AKTIV; `ModelNotOpen`/403 → BytePlus konsoli → ModelArk → region `ark+ap-southeast-1` → Model list → `dreamina-seedance-2-0-mini` → **Activate/Enable**.
