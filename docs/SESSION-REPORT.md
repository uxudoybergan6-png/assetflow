# SESSION REPORT — 2026-06-19 — G5.3: "Tasvirdan" format tanlangan MODEL turiga moslashsin

## Muammo
- Describe `kind` MANBA turiga qarab yuborilardi (`isVid=aiIsVidPath(...)`). Foydalanuvchi video manbadan video-format prompt (MOTION/TIMELINE/CAMERA-blur) yaratib, keyin RASM modeliga o'tsa → rasm modeliga video-prompt → qora/xira rasm.

## Tuzatish (frontend)
- **`aiDescribeFrom`**: `kind` endi tanlangan MODELdan — `af_ai.media==='video' ? 'video' : 'image'` (manba turidan emas). Ko'p kadr + motion (`frameTimes`/`durationSec`) FAQAT video model + video manba (`wantMotion`); aks holda 1 kadr → qisqa STYLE/SCENE/SUBJECT/COMPOSITION/LIGHTING/DETAILS. Loading toast format'ga mos ("Video/Rasm prompti tayyorlanmoqda…").
- **`aiGenerate` guard**: rasm model tanlangan, lekin prompt'da `MOTION:/TIMELINE:/ENDING FRAME:/SOUND DESIGN:` bo'lsa → yengil ogohlantirish toast (MAJBURLAMAYDI — generatsiya davom etadi, foydalanuvchi tahrirlay oladi). CAMERA trigger'ga kiritilmadi (rasm promptida ham haqiqiy termin → soxta ogohlantirish bo'lmasin).

## Tekshirildi
- Plugin parse: 2 blok, 0 xato. Backend tegmadi (faqat frontend) → tsc shart emas. CEP'ga ko'chirildi (AE qo'zg'atilmadi). Studio static UI tegmadi → studio:sync shart emas.

## Kutilmoqda
- AE jonli test: rasm model + «Tasvirdan» → qisqa rasm prompt (motion yo'q); video model → to'liq TIMELINE; aralash holatda ogohlantirish toast.
