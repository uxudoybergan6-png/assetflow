# SESSION REPORT — 2026-06-27 — So'nggi grid: umumiy komponent (real lightbox + karta amallari)

## Bajarildi
1. **UMUMIY komponent** `window.afRecent` (main AI script): `card(it,ctx)` + `openLightbox(it,ctx)` + `closeLightbox()`. Rasm tool (igScript) va Video tool (vgScript) AYNAN shuni ishlatadi — kod takrorlanmaydi.
2. **Lightbox REAL media:** video → `<video controls autoplay playsinline>` (statik kamera-ikona placeholder OLIB TASHLANDI), rasm → `<img>`, ovoz → `<audio controls>`. Bitta umumiy `#afLightbox` (.axroot ichida, position:fixed).
3. **Karta hover amallari (ochmasdan):** ⤓ Import (har doim) · ↺ Referens (model-aware) · ⬇ Yuklab (non-CEP) · ✕ O'chirish. Lightbox amallari ham bir xil.
4. **Model-aware Referens (refKind):** har tool `ctx.refAllowed`/`onRef` beradi — igScript: image karta → `addRefReady` (@imgN); vgScript: frames → image karta → Boshlang'ich/Yakuniy menyu; mos kelmasa Referens yashirin (video/ovoz).
5. **afVideoThumb** ham umumiy (video birinchi kadr — qora emas).

## Tekshiruv (brauzer harness, REAL funksiyalar)
7 inline script syntax TOZA. Video tool: 5 karta, video→`<video>` thumb, Referens faqat rasm kartada; lightbox video/img/audio to'g'ri. Image tool: video karta bosish → lightbox `<video controls>` (placeholder EMAS) ✓; hover Import→importMediaCat, Referens→addRefReady ishladi; video/ovoz kartada Referens yo'q. Gen oqimi/kredit/refund/multi-gen — TEGILMADI.

## KUTILMOQDA
AE'da install-cep.sh → real R2 video lightboxда o'ynashi + ikkala toolда karta amallari end-to-end.
