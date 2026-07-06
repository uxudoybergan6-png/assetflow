# Sessiya hisoboti — 2026-07-06 (PHASE 4 2/2: Home redesign Variant A + umumiy header)

**Ish:** plagin HOME → Variant A "Editorial Studio" (_home-redesign-mockup 1:1) + #10/#11 umumiy header, jonli ma'lumot bilan.

- Home: vaqtga mos salomlashuv (real ism), 2 pillar karta (Templates→katalog real soni, AI Tools→launcher),
  "Continue where you left off" — real oxirgi import (`downloadedMeta.at` muhri qo'shildi) + oxirgi gen (`/api/studio/gen/history`),
  Re-import→downloadAll / Import→aiImportMedia / lightbox=afRecent; Recommended 2×2 (mavjud hm-card 1:1); kredit nudge (✦N→~videolar).
- Guest: taklif + real Sign in / Google device-code (g2 sheet), real katalog peek (blur+lock), FREE PLAN footer.
- Header hamma ekranda: lime chaqmoq=Home (chuqur ekranlarda ‹ back yonida, ai-hdr ixcham 24px), o'ngda kredit+plan chip+avatar(ring)=Hisob;
  guest → bitta "Sign in" pill (afHdrSyncAll, bir xil geometriya). goHome endi lib-mode'dan ham chiqadi.
- Tekshirildi (brauzer 380px cep-mode, skrinshotlar): guest/logged Home, katalog/launcher/imggen/lib headerlari, Home-dan-har-yerdan,
  hisob sheet ochilishi, resume tugmalari real handlerlarga, 0 konsol xato. Preview'da tarmoq yopiq — hisob/gen STUB (render yo'llari real).
- Kutilmoqda: `bash plugins/after-effects-cep/scripts/install-cep.sh` + AE restart, real AE'da jonli test. Push YO'Q (user o'zi).
