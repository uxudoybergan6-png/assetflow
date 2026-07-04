# Sessiya hisoboti — 2026-07-04 — AI tools: model-aware boshqaruvlar + 2 UI fix

**Nima qilindi:** 3 fix, har biri alohida commit (push yo'q):
1. 879b4a2 — Popover ortidagi "shisha panel" ILDIZI topildi: `.axig .sheet` hit-layer eski
   `.axroot .sheet`dan 440px max-width + 0.45 box-shadow meros olardi — 440px'dan KENG panelda
   qora soya ustuni ko'rinardi (392px'da viewport tashqarisida, shu sabab avval topilmagan). Endi
   width:auto/max-width:none/box-shadow:none — popover toza karta, tashqi-click to'liq enda ishlaydi.
2. 8760303 — Video tool prompt ichidagi takror ＋Referens olib tashlandi (Fast+R2V); rasm tooldagi qoldi.
3. 14d14cf — QAT'IY model-aware: vgCapsFor/igModelRefOk — refKind/maxRefs/endFrame/videoInput.imageRequired
   (faqat /gen/models maydonlari, API o'zgarmadi). End-kadr faqat endFrame modelda; +Rasm/+Video/+Ovoz
   har biri limit>0 bo'lsa; Fast|R2V toggle faqat model qo'llagan rejim (t2v'da yashirin); model
   almashganda yaroqli kadr/ref SAQLANADI, mos kelmagani tasdiq bilan o'chadi; rasm t2i (maxRefs 0,
   Imagen 4) ＋Referens butunlay yashirin; maxRefs kichrayganda ref trim.

**Tekshiruv:** stub /gen/models (frames S+E · frames start-only · media-refs · pure t2v/t2i · maxRefs 1)
bilan 392/900px — har model faqat o'z boshqaruvlarini ko'rsatadi; gen/cost-quote/param builder shakllari
(frames/media/t2v/rasm) stub bilan aynan tekshirildi; 0 konsol xato. **Kutilmoqda:** AE jonli test + push.
