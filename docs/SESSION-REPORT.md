# SESSION REPORT — 2026-06-29 — Video gen quick stabilization

- Video gen sekinligi va “uzoq kutib oxirida yiqilish” oqimi diagnostika qilindi.
- Seedance Fast va Seedance R2V uchun launch defaultlar yengillashtirildi: `480p`, `Auto≈4s`, `audio default off`.
- Plugin endi model ochilganda og‘ir eski tanlovni ushlab qolmaydi; modelning o‘z defaultlarini qayta qo‘llaydi.
- Backendda `Auto` duration endi providerga ham resolved soniya bo‘lib yuboriladi; oldingi kabi xom `auto` ketmaydi.
- Seedance Fast poll oynasi ~280s dan ~400s ga uzaytirildi; R2V poll oynasi ~480s dan ~700s ga uzaytirildi.
- R2V referens materializatsiyasi parallel qilindi; ko‘p image/video/audio referensda start kechikishi kamaydi.
- Fast start/end frame materializatsiyasi ham parallel qilindi.
- Stuck reconcile video uchun yumshatildi: fal video ~20 daqiqa, boshqa video ~15 daqiqa, non-video ~10 daqiqa.
- Tekshiruv: `npm run build -w apps/api` OK.
- Tekshiruv: plugin inline script parse `OK 15`.
