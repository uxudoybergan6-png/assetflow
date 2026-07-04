# Sessiya hisoboti — 2026-07-04 — AI Tools jonli-test tuzatishlari (5 ta)

**Nima qilindi:** AE jonli testidan keyingi 5 fix, har biri alohida commit (push yo'q):
1. d0d4fa2 — KREDIT TARIXI qatorlari: tur ikon + title + muted vaqt + o'ngda rangli
   summa (− qizil / + lime), hover, scroll quti.
2. dbb050e — Video kartalarda real preview: afVideoThumb(poster) + preload=auto/canplay;
   afGallery + TARIX strip posterisiz video uchun <video> birinchi kadr (qora tile fix).
3. 439e989 — Lightbox: media dominant (lbmedia flex:1), meta+Import zich tagida, ≤980px.
4. 3e8815d — Sozlama picker'lari bottom-sheet EMAS — pill yonida popover (.sheet.pop,
   positionPopover tiklandi); video pill'lar per-pill popover; qora chiziq artefakti yo'q.
5. 79d7f83 — Video tool rasm tool bilan bir xil karta tuzilishi (flat compose bekor,
   Fast|R2V toggle karta ichida, PROMPT/SOZLAMALAR/SO'NGGI lbl); b7 birlashgan sheet o'chdi.

**Eslatma:** b7 bottom-sheet spetsi ATAYIN bekor qilindi — jonli test UX qarori.
**Tekshiruv:** cep-plugin-preview 380/900px — handler/kredit/gen mantiq saqlangan, yangi xato yo'q.
**Kutilmoqda:** AE ichida jonli qayta-test + push (foydalanuvchi).
