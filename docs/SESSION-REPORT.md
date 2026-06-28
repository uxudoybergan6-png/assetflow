# SESSION REPORT — 2026-06-28 — Video tool hardening before new model

- Video tool oqimi qayta tekshirildi: 2 model ishlaydi, lekin yangi model qo‘shishdan oldin universal bo‘lmagan joylar ajratib olindi.
- Backend `/gen/history` va `/gen/:jobId` endi asset `sizeBytes` va `contentType` metadata bilan qaytadi.
- Shu metadata sabab So‘nggi genlardan video/audio natijani referens sifatida qo‘shishda limit tekshiruvi aniq ishlaydi.
- Plugin video/audio referensni uploaddan oldin o‘zi tekshiradi: video `2–15s`, audio `<=15s`, video referens rezolyutsiyasi `480p–720p`.
- R2V provider’ning `50MB` video referens cheklovi foydalanuvchiga aniq xabar bilan ko‘rsatiladi.
- Video progress label endi hardcoded emas, tanlangan model nomini ko‘rsatadi.
- Prompt yaxshilash endi tanlangan model capability contextini AI’ga uzatadi va `@img/@image/@video/@audio` tokenlarini saqlashga majbur qiladi.
- Video tool endi `refKind='none'` modelini ham ko‘tara oladi: referenssiz `text-to-video` oqimi uchun kadr majburiy emas.
- Video referensli `Prompt yaxshilash` uchun `openrouter/router/video` ulandi va production uchun `google/gemini-2.5-pro` tanlandi.
- Tekshiruv: `npm run build -w apps/api` OK.
- Tekshiruv: plugin script parse `OK 7`.
- Qolgan asosiy cheklov: video tool hali to‘liq schema-driven emas; noodatiy yangi per-model settinglar uchun qo‘shimcha UI branch kerak bo‘ladi.
