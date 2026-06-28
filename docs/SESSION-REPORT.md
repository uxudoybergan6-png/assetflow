# SESSION REPORT — 2026-06-28 — Video ref size clarification

- AssetFlow upload limiti 100MB ekanligi tasdiqlandi: backend referens upload shu limitda qoladi.
- Amaliy xato generatsiya bosqichida chiqayotgani aniqlandi: Seedance R2V provayderi video referensni 50MB dan katta bo‘lsa rad qilmoqda.
- `apps/api/src/lib/gen-models.ts` ichida R2V modeliga `mediaRefMaxBytes.video = 50MB` qo‘shildi.
- Plugin endi lokal fayl yoki Project paneldan video referens tanlanganda shu model limitini oldindan tekshiradi.
- Backend R2V generatsiya xatosi inglizcha raw matndan foydalanuvchi uchun tushunarli o‘zbekcha xabarga aylantirildi.
- `/api/studio/gen/ref-upload` javobi endi `bytes` va `contentType` ham qaytaradi.
- Kutilayotgan natija: 100MB upload bilan chalg‘ish bo‘lmaydi; R2V uchun haqiqiy 50MB video cheklovi aniq ko‘rinadi.
