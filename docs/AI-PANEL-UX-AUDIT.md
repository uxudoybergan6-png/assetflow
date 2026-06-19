# AI Tools panel — UX audit (magnific bilan yonma-yon, 2026-06-19)

*Usul: magnific video generator Claude in Chrome'da jonli (kompakt composer reference) + AssetFlow `AssetFlow_Plugin.html` kod (CSS/HTML) tahlili + foydalanuvchi skrinshot kuzatuvlari.*

## Magnific reference (kompakt)
- Hero YO'Q — panel to'g'ridan **MODEL** bo'limidan boshlanadi.
- Tartib: MODEL → REFERENCES (Start/End kataklar) → SHOTS → [davomiylik·aspect·🔊] → Generate.
- Zichlik: bo'lim yorliqlari kichik uppercase, oraliqlar ~8px, kontrollar ~36px balandlik, padding ~12px.
- Dropdownlar trigger'ga yopishgan, panel ichida.

## Topilgan kamchiliklar (AssetFlow)

### Yuqori ta'sir (foydalanuvchi ko'rsatgan)
1. **Hero "Nima yaratamiz?"** (`.ai-launch` padding 30px+22px + h1 fs-title + p) — ~80–100px vertikal joy behuda. Magnific'da yo'q. → **Olib tashlash**, composer to'g'ridan boshlanadi.
2. **Dropdown anchoring** (`.ai-menu`): `bottom:calc(100%+8px)` yuqoriga ochiladi, **max-height yo'q** → balandda (model menu = "Barcha modellar" + N qator chiplar) panel tepasiga uzilib suzadi. `min-width:230px` lekin **max-width yo'q** → tor panelda chetdan oshadi. `z-index:20`.
   → max-height + overflow-y:auto, max-width (panelga sig'sin), z-index oshirish. media/model/setting/ref/desc dropdownlari bir xil.
3. **Composer zichligi**: `.ai-composer padding:16px`, `.ai-comp-ctrls margin-top:14px`, `.ai-sec-label margin:10px..6px`, `.ai-refbar.cells-mode margin-top:10px`, textarea `min-height:48px` — bo'sh joy ko'p, magnific'dan loose. → padding 13px, ctrls margin 9px, sec-label 7px/4px, textarea min 44px.
4. **Model qatorlari "Reference"/"Start" takrori** (`aiModelChipList` birinchi chip bir mode'dagi BARCHA modellarda bir xil) — farqlovchi emas. → Dropdown qatorlarida reference chipini olib, **rezolyutsiya·davomiylik·🔊·narx** (farqlovchi) qoldirish. Reference chip collapsed-xulosa + All-models modalda qoladi (u yerda informatив).
5. **Ovoz tarix kartalari** (`.ai-h-audio` — yalang'och mikrofon tekis fonda): chiroyli emas. → to'lqin ikona + gradient fon (3 tema), nom metada'da.

### Polish (audit'da topilgan)
6. `.ai-refbar.cells-mode` Reference yorlig'i "Reference" → magnific "REFERENCES" uslubi (uppercase, `aiRenderRefBar` allaqachon `.ai-sec-label`).
7. Bo'sh thumb holatlari (`.ai-h-ph`, audio) — bir xil gradient/ikona tili bo'lsin.
8. Dropdown `.ai-menu` chiplar zichligi — model qatori 2 qatorga cho'zilmasin (chip soni kamaytirilgani bilan hal bo'ladi, #4).
9. Z-index izchillik: dropdown 20 / hist menu 30 / modal 200 — dropdownni ≥40 ga ko'tarish (natija/karta ustida turishi uchun).

## Tuzatish rejasi (ADIM 1)
- HTML: `#aiLaunch` olib tashlash.
- CSS: `.ai-menu` (anchoring/max-height/max-width/z-index), composer zichligi, `.ai-h-audio` (gradient+wave).
- JS: `aiModelChipList(m, forRow)` — dropdown qatorida reference chipsiz.
- 3 tema (token CSS), responsive (~320px–keng), oqim (G1–G5) BUZILMAYDI, parse toza.
