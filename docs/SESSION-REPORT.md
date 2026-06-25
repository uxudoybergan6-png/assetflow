# SESSION REPORT — 2026-06-26 — Tanlov menyulari pastki-bar → BOSILGAN JOYДА popover

- **MUAMMO:** sheet'lar (model/o'lcham/sifat/soni, +Referens manba) `fixed` bilan ko'rinadigan viewport PASTIДА bottom-bar bo'lib ochilardi — keng AE panelда bosilgan chipdan uzoq tushardi (foydalanuvchi: "o'sha bosgan joyida ochilishi kerak").
- **TUZATISH:** `.axig .sheet` → endi yengil backdrop (tashqi-click ushlovchi); `.sheetc` → **POPOVER** (`position:fixed`, JS `positionPopover` bilan bosilgan chipга bog'lanadi: chip OSTIДА, joy yetmasa USTIДА; viewport ichида clamp; kenglik ~chip eni 240-380px). `openSheet(id,anchorEl)` — har opener clicked elementни uzatadi (igModelSeg/igArSeg/igQSeg/igNSeg, +Referens→igRefAdd). Backdrop/Esc/tanlov mantiqи O'ZGARMADI.
- Eslatma: `docs/AI-TOOL-UI-STANDARD.md` "pastdan sheet" deydi — bu tool uchun foydalanuvchi so'rovi bilan popover'ga o'tildi (lightbox markazда qoldi).
- **TEKSHIRUV:** plagin 6 `<script>` `new Function` — 0 xato. Headless (700px panel): Model/O'lcham/Soni popover chip OSTIДА (top≈chipBottom+6), pastki-bar emas, viewport ichида clamp — o'lchov + screenshot; pill tanlash→tanlandi+yopildi, backdrop+Esc yopadi. Backend tegilmadi.
- KUTILMOQDA: AE install-cep → real ko'rinish.
