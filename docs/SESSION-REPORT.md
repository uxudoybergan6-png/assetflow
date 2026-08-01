# Sessiya hisoboti — 2026-08-01 · Yagona vizual muharrir (Sayt + Plagin)

**Nima qilindi:** Admin "Website" va "Plugin CMS" bitta vizual muharrirga o'tdi (`admin-website.js`,
`WS_SURF` = site | plugin): bosib tanlash, joyida matn tahriri, surish (drag + o'q tugmalari),
kattalashtirish/kichraytirish, rang/oraliq/soya/radius, desktop va mobil uchun alohida qatlam,
undo/redo. Plagin yuzasida REAL AE paneli same-origin iframe'da ochiladi — `prepare-cf-pages.mjs`
uni `dist/admin/plugin-preview/` ga ko'chiradi (lokalda `dev-admin-server.mjs` mount qiladi).
Bildirishnomalar (`notices[]` — banner/toast/modal, guest/user, sana oralig'i) web + plaginda.

**Topildi (tuzatildi):** (1) preview iframe yo'li NISBIY edi → `admin.getframeflow.app` da 404;
root-absolut qilindi. (2) Plagindagi 5-daqiqalik `afCmsFetch` va localStorage keshi muharrirdagi
SAQLANMAGAN draft'ni jimgina o'chirardi — `?ffcms=1` da ikkalasi ham o'chirildi; xuddi shu poyga
platformada (`loadLandingConfig`) ham bor edi, bir xil tuzatildi. (3) Preview'da soxta AE oynasi,
QA saxnasi va "Session expired" toast'lari chiqardi — bekor qilindi. (4) Lokalda sayt yuzasi
ochilmasdi (`:8975` ni hech kim eshitmasdi) — `dev-studio-server.mjs` endi platformani o'sha portda beradi.

**Isbot:** admin'da tanlash→toolbar→`{fontSize:27,fontWeight:900,textAlign:center,scale:1.05}` jonli
qo'llandi ✓; drag → `offsetX/Y 42/25` ✓; API build ✓ · public-copy 137/137 ✓ · panel-responsive ✓.
**Kutilmoqda:** push + CF Pages deploy (admin `plugin-preview/` bilan), AE ichida `uiStyles` tekshiruvi.
