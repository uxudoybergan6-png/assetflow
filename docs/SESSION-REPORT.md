# Session report — 2026-08-03 (Premiere UXP: produkt-audit + prod system prompt)

- **Yangi audit:** `docs/PREMIERE-UXP-PROD-AUDIT-2026-08-03.md` — butun zanjir
  (Contributor→ingest→katalog→panel→import→AI→reliz→ops) 12-zveno matritsasi.
  Kritik topilmalar: prod `?app=pr` = 0 kontent (launch gate); `.prproj` import yo'li
  umuman qurilmagan; AI ref yuklash o'lik (`window.cep.fs` shim'lanmagan, AE:12552 gate);
  contributor UI'da `.prproj` qabul kengaytmasi yo'q; migratsiya prod'ga qo'llanmagan.
- **Yangi prompt:** `docs/PREMIERE-UXP-PROD-SYSTEM-PROMPT.md` — P0 (qora repaint,
  Google E2E, indexedDB, dev-gating) → P1 (kontent zanjiri) → P2 (mogrt+prproj import)
  → P3 (AI Tools + cep-fs shim) → P4 (reliz) → P5 (ops); har faza DoD bilan;
  15 o'lchangan gotcha jamlandi.
- Jonli o'lchov: qora tana repaint nosozligi — DOM SOG'LOM (`homeGuest display=block`,
  `accountSheet display=none`, xato 0) → davo `repaintKick` (P0.1).
- KUTILMOQDA: P0 ijrosi (birinchi — repaint fix); migratsiya→prod; birinchi pr shablon.
