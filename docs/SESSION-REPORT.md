# SESSION-REPORT — SC_28 (2026-07-17)

**Vazifa:** top-bar'dagi Sessions/Projects entrylarini Account sheet'ga ko'chirish.

- Plagin (AssetFlow_Plugin.html): top-bar'dan .af-tb-sp Sessions/Projects tugmalari va
  CSS (ghost tugma + 519px media) olib tashlandi; seg markazi 3-ustun grid'da qoldi.
  Account sheet'ga PLAN ustida "WORKSPACE" guruhi qo'shildi — 2 ta acs-row (Sessions/
  Projects, list/folder ikonlar) → closeAccountSheet() + mavjud afOpenAiSub yo'li;
  faqat login bo'lganda ko'rinadi (refreshAccountUi).
- Web (platform/index.html): top-bar .va-tbsp Projects entry + CSS + projTopCls wiring
  olib tashlandi; Projects avatar-menyu qatorida qoladi (SC_12), Sessions AI Studio rail'da.
- QA: node --check 7+4 inline skript OK; brauzer spot-check — .af-tb-sp=0, WORKSPACE 2 qator,
  seg markazi delta <0.01px (to'liq va 320px kenglikda); install-cep.sh bajarildi.
- Kutilmoqda: egadan jonli AE testi (Account sheet → Sessions/Projects, 3 tema);
  AE Cmd+Q qayta ochish (install paytida AE yopilmagan).
