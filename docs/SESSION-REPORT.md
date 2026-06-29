# SESSION REPORT — 2026-06-29 — Temporary saved references

- Video referens upload oqimi saqlanib qoldi, lekin endi yuklangan rasm/video/audio referenslar “temporary saved references” sifatida 1 soatga yoziladi.
- Backendga `SavedReference` modeli qo‘shildi: user, type, R2 key, size, expiry va oxirgi ishlatilgan vaqt saqlanadi.
- `/api/studio/gen/references` qo‘shildi: plagin vaqtinchalik saved referenslarni olib ko‘rsata oladi.
- `/api/studio/gen/references/:id` qo‘shildi: saved referensni qo‘lda ham o‘chirish mumkin.
- Expiry tugagan saved referenslar server tomonidan avtomatik tozalanadi; upload/gen/credits/history oqimlarida ham opportunistic cleanup bor.
- Referens qayta ishlatilsa uning TTL’i yangilanadi; shuning uchun foydalanuvchi oxirgi daqiqada tanlagan referens birdan yo‘qolib qolmaydi.
- Plugin video tool ichida `Saved references` bo‘limi qo‘shildi: shu yerdan referensni qayta bosib tanlash mumkin.
- Saved referens kartalari tur badge’i, qolgan vaqt va qo‘lda o‘chirish tugmasi bilan chiqadi.
- Saved referens o‘chirilsa joriy prompt/referens listida soya bo‘lib qolmasligi uchun inline referensdan ham olib tashlanadi.
- Tekshiruv: `npm run generate -w @creative-tools/database` OK.
- Tekshiruv: `npm run build -w @creative-tools/database` OK.
- Tekshiruv: `npm run build -w apps/api` OK.
