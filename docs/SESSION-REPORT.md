# SESSION REPORT — 2026-07-13
- Vazifa: MUAMMOLAR-1 Block G (SCALE) — 15/16/17/18 (server-side katalog). 4 commit, PUSH YO'Q.
- #15 (API·WEB·PLUGIN): server-side filtr/qidiruv/saralash/sahifalash. GET /api/plugin/catalog ga
  app/templateType/cat/pro/orient/res/q/sort + take/cursor (buildCatalogWhere + catalogOrderBy,
  4-qadam indekslari). IKKALA klientdagi "hamma sahifani yuklab ol" sikli O'CHIRILDI.
- #16 (API): SLIM ro'yxat (mapCatalogCard, metaJson yo'q, scene-enrich yo'q) + detal endpoint
  GET /api/plugin/catalog/:id (mapCatalogItem). Plagin sahnalarni openPack'da detaldan lazy oladi.
- #17 (API): Cache-Control public,max-age=60,s-maxage=300 + ETag + 304 (E'dagi CDN barqaror URL).
- WEB: server-driven browse quvuri (state.browse), infinite scroll + Load more; Home javonlari
  1-sahifadan. PLUGIN: refreshBrowse/loadMoreBrowse + getFiltered server pass-through + grid
  VIRTUALIZATSIYASI (faqat ko'rinadigan kartalar + spacer; #18). res filtri 2K/4K/5K guruhlari.
- Money-zone TEGILMADI. Isbot: lokal 500-asset API — API 26/26 assertion (filtr BUTUN baza bo'yicha
  to'g'ri, ETag→304, slim/detail). WEB brauzerda: ochilish 2 so'rov, q="zqxwv42"→7, LUTs→faqat LUTs,
  Load more 48→96. PLUGIN brauzerda: 48 karta, load-more 48→125, virtualizatsiya DOM 14-22 karta+spacer.
- Kutilmoqda (foydalanuvchi): git push + Cloud Run deploy; AE'da jonli test (install-cep bajarildi).
