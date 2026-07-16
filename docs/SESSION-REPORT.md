# Sessiya hisoboti — 2026-07-16 (#R1-FIX, jonli AE buzilishi)

**Nima qilindi:** #R1 dan keyingi jonli AE buzilishi (AI Studio "prompt yo'q, hammasi aralash") tuzatildi.
Harness TO'G'RI qurildi: cep-mode + real router (sidebar→launcher→tool), 320/420/600 × 820/620/500, joyida (detach YO'Q).

**Ildiz sabab (2 ta):**
1. Balandlik zanjiri: `.scroll-area`(bounded) → `#aiPage`/`.axroot`/`.app` hammasi `height:auto` — `.scroll` kontent bilan cheksiz o'sadi, stage ichki scroll qilmaydi, dock pinlanmaydi; real recents bilan composer 1.5+ ekran pastga tushardi. QA overlay'da 100vh bounded edi — shu sabab o'tib ketgan.
2. `.chipedit` uslublari eski `.axig .pbox` scope'ida — yangi dockda `.pbox` yo'q → prompt 22px ko'rinmas chiziq, placeholder chiqmasdi. Bonus: `.gensend .costtag{display:none}` narxni yashirgan edi (qaytarildi).

**Tuzatish (21 satr):** `#aiPage.axws-tool` + `.axroot` + `.app` `height:100%` (JS: axwsAfterView #aiPage'ga ham klass qo'yadi); `.scroll` overflow:hidden→auto (himoya); `.axws-promptwrap .chipedit/chipwrap/chipexp` uslublari; costtag ko'rinadigan qilindi.

**Tekshirildi (joyida):** imggen/vidgen/audgen × 320/420/600 × 820/620/500, bo'sh + 12-karta stage, 3 tema — prompt ko'rinadi+fokuslanadi, refs/pill/Enhance/cost+Generate/balans OK; tall=dock pin, ≤560=butun workspace scroll. Home/Katalog/Settings ta'sirsiz. Console 0 xato, node --check 7/7, install-cep.sh ✓ (AE to'liq restart kerak).
