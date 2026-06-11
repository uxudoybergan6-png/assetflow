# Sessiya hisoboti — 2026-06-11 (2-to'lqin)

**Nima qilindi** — har biri alohida commit (push yo'q):
- `8e34bea` — Search (⌕) tugmasi qidiruvni ishga tushiradi (`runSearch()`).
- `b30b780` — `selectedDropMode`: drop zone tanlovi footer Download'ga ham ta'sir qiladi (default `project`).
- `b099a5e` — `host.jsx`: root papka `parentFolder == null` orqali aniqlanadi (`app.project.rootFolder` identity o'rniga).
- `effbdc1` — `assetflow-catalog.js` redirect: http/https moduli har URL'da qayta tanlanadi, nisbiy `Location` yechiladi.
- `bddf185` — Import papkasi endi shablon title'i (`pack.displayName`), `__srv_<id>` displeyga chiqmaydi; AE'da nom band bo'lsa " (2)" suffiks (`uniqueRootFolderLabel`). Ichki packKey mantig'iga tegilmadi — `data.folder` orqali `downloadedMeta`/o'chirish mosligi saqlangan.

**Topildi:** `packLabel` chaqiruvchilardan packs kaliti (`__srv_<id>`) bo'lib kelardi; `pack.name` fallback server pack'larda yo'q. Toast'larda ham `packName` (`__srv_…`) ko'rinadi — hali tuzatilmagan (kichik, keyinga).

**Tegilmagan:** `assetflow-account.js` checkout, Admin `.mov→.mp4` `avconvert`.

**Test:** foydalanuvchi AE'da tekshirdi — papka nomi, " (2)" suffiks, search, timeline mode, yuklab olish, login hammasi ishladi. HANDOFF.md yangilandi (hal bo'lganlar + 3 ochiq band). Push foydalanuvchi tomonidan.
