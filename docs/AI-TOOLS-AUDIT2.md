# AI Tools audit #2 — So'nggi grid / lightbox / karta amallari (2026-06-27)

Qamrov: Image (igScript) + Video (vgScript) tool — So'nggi grid, lightbox, karta hover amallari, model-aware Referens, hover preview. Umumiy komponent: `window.afRecent` (card/openLightbox) + `#afLightbox` + `afVideoThumb`.

## Topilgan + tuzatilgan

| # | Joy | Sabab | Tuzatish | Holat |
|---|-----|-------|----------|-------|
| 1 | **Lightbox layout BUZUQ** (video kichik yuqori-chap, amallar oddiy matn, markazda emas) | `#afLightbox` `.axroot` ichida (`.axig` EMAS), lekin lightbox CSS faqat `.axig .lightbox*` skopида → hech qaysi qoida qo'llanmagan | Maxsus `#afLightbox{...}` + `.lbinner/video/img/audio/.lba/.lx` CSS qo'shildi (id-skop, `.axroot`dan var meros). To'liq overlay `position:fixed;inset:0`, markaz, dim backdrop, TUGMA amallar, ✕ yuqori-o'ng | ✅ |
| 2 | **Hover preview yo'q** | karta video faqat 1-kadr (statik) | `afRecent.card` video: `mouseenter`→`muted` autoplay, `mouseleave`→pause+`currentTime=0.1` (ovozsiz) | ✅ |
| 3 | **Lightbox video ovozsiz/placeholder** | eski igScript statik kamera-ikona | `openLightbox` video→`<video controls>` + `muted=false` + `play()` (user-gesture → ovoz bilan) | ✅ |
| 4 | Karta amallari joyi | (audit) lightbox amallari matn edi (#1), karta `.racts` tugmalari `.axig` skopида — TO'G'RI | #1 tuzatgach lightbox ham tugma; karta amallari ishlaydi | ✅ |

## Tekshirilgan — BUZUQ EMAS (regressiyasiz)
- **Containing-block:** `#afLightbox` ajdodlari (.axroot/#aiPage/.scroll-area/.env-content/body) `transform/filter/contain` YO'Q → fixed viewportга chiqadi (prod to'g'ri). `.view.on{animation:fade}` — `.app` ichida (lightbox ajdodi emas).
- **Model-aware Referens:** igScript `refAllowed`=image+refMode≠none→addRefReady(@imgN); vgScript=frames→rasm karta→Boshlang'ich/Yakuniy menyu; video/ovoz→yashirin. ✅
- **Karta amallari** (Import/Referens/Yuklab/O'chirish) ikkala toolда tugma, `addEventListener`, ochmasdan ishlaydi. ✅
- **Hover preview:** enter→played+muted, leave→paused+reset (headless tasdiq). ✅
- **Gen oqimi / kredit / refund / multi-gen / navigatsiya / header / kadr-referens upload (hostCall):** TEGILMADI. ✅
- Syntax: 7 inline script 0 xato. Console: 0 xato.

## Eslatma
Eski `#igLightbox`/`#vgLightbox` DOM + vgScript eski lightbox-wiring — o'lik, zararsiz (alohida id, hech qachon `.on` bo'lmaydi), minimal-diff uchun qoldirildi.
