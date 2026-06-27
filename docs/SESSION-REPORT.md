# SESSION REPORT — 2026-06-27 — Video R2V model (ko'p-modal referens)

Yangi 2-video model: `bytedance/seedance-2.0/reference-to-video` (@Image/@Video/@Audio). Video tool referens hududi MODEL-AWARE.

## Backend
1. **gen-models.ts:** model id 3102 (Seedance 2.0 R2V), feature `reference-to-video`, refKind `media-refs`, `mediaRefs{image:9,video:3,audio:3,total:12}`, videoSettings resolution[480/720/1080/4k] perSec{8/15/34/60}, refMode `optional`. `GenFeature` + `getRefKind` + refKind tip kengaytirildi. Fast (3101) o'zgarmadi.
2. **fal.ts:** `falRefVideo` — image_urls/video_urls/audio_urls (bo'sh ro'yxat yuborilmaydi) + prompt/resolution/duration/aspect/generate_audio; poll uzun (maxPolls=250 ≈480s); video.url → R2.
3. **gen-processor.ts:** `runFalRefVideo` — refs R2 public URL'ga (tartibda), schema invariant (audio→kamida 1 image/video; jami≤total), `reference-to-video` routing. Kredit perSec×dur, atomik consume/refund guard TEGILMADI.
4. **studio-gen.ts:** ref-upload endi image/video/audio qabul qiladi (to'g'ri ext/content-type).

## Plagin (vgScript)
5. Model picker REAL: 2 model (/gen/models dinamik), `switchVgModel` → sozlama+UI yangilanadi, resolution model'dan klamp.
6. refKind-aware referens: `frames`→Kadrlar (mavjud) ↔ `media-refs`→[＋Rasm ＋Video ＋Ovoz] + thumbnaillar (@Image1/@Video1/@Audio1, tur belgisi, × o'chirish, limit) + @ mention dropdown. Referens IXTIYORIY.
7. `mime()` video/audio content-type; ref-upload mavjud readDataUrl/showOpenDialog qayta ishlatildi. genVgClick refKind-aware params (frames=referenceUrl; media-refs=imageUrls/videoUrls/audioUrls).

## Tekshiruv (brauzer harness, REAL funksiyalar)
`tsc` 0 xato, 7 inline script 0 xato, console 0 xato. Model switch Fast↔R2V → UI flip ✓; 4 ref (@Image1/2,@Video1,@Audio1) + refMeta 4/12 ✓; genVgClick → imageUrls:2/videoUrls:1/audioUrls:1, modelId 3102, frame param yo'q ✓; @ mention ✓; resolution 480/720/1080/4k, cost ✦300@4k/✦75@720p ✓; Fast'ga qaytsa frames UI + 4k→720p klamp + disabled (kadr yo'q) ✓. Image gen/kredit regressiyasiz.

## KUTILMOQDA
Render API redeploy (R2V model + ref-upload + falRefVideo) + AE install-cep.sh: referenssiz prompt→video; rasm+video+audio referens→video. FAL_KEY env.
