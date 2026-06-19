# SESSION REPORT — 2026-06-19 — Dropdown collision-fix (menyular kesilmasin)

## Muammo
Settings/model dropdown yuqoriga ochilib (sof-CSS `bottom:100%`) panel TEPASIDAN oshib kesilardi — birinchi qatorlar ko'rinmasdi (skrinshot: Seedream qatori yo'q). Barcha `.ai-menu` popoverlariga taalluqli.

## Yechim (JS — `aiPositionMenu`, `aiRenderMenus` ichida ochilganda chaqiriladi)
1. **Flip:** trigger `getBoundingClientRect` + `window.innerHeight` bilan tepa/past bo'sh joyni o'lchaydi — ko'proq joy qayerda bo'lsa o'sha yo'nalishga ochadi (tepada joy yetmasa pastga).
2. **Dynamic max-height:** `min(tanlangan_yo'nalish_joyi, 56vh, 360px)` + `overflow-y:auto` — menyu uzun bo'lsa ICHIDA scroll, HAMMA variant yetib boriladi, hech narsa kesilmaydi.
3. **Clamp:** menyu tanlangan yo'nalishdan ochilgani uchun chet (tepa yoki past) viewport ichida qoladi. Gorizontal: o'ng chetdan oshsa `right:0` ga o'tadi (tor panel).
4. **Past panel/tor panel:** vh/vw kichik bo'lsa max-height/clamp mos kichrayadi (simulyatsiya: vh=360 → maxH=202 + scroll).
- Barcha composer dropdownlari (media/model/settings/ref/desc) bir xil `previousElementSibling` (trigger) bilan joylanadi.

## Tekshirildi
- Parse: 2 blok, 0 xato. Pozitsiya math simulyatsiya: trigger tepada→DOWN, o'rtada/pastda→UP, past panel→clamp+scroll — hammasi to'g'ri.
- All-models modal (overlay, max-height 86vh+scroll) va kichik karta menyulari (.ai-h-menu, 2-4 qator) — past xavf, tegmadi.
- Oqim BUZILMADI. 3 tema. CEP'ga ko'chirildi (AE qo'zg'atilmadi). studio:sync shart emas.

## Holat
- Deploy talab qilmaydi (faqat plugin). AE'da reload — eng baland menyu (settings) trigger tepada/o'rtada/pastda bo'lsa ham barcha variant ko'rinishini tasdiqlash.
