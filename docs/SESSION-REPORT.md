# SESSION REPORT — 2026-06-29 — Durable video resume groundwork

- Video gen oqimi mustahkamlandi: provider job holati endi `Generation.params.__providerJob` ichida saqlanadi.
- OpenRouter video job ID ham, fal video `requestId/statusUrl/responseUrl` ham DB’da yozilib qoladi.
- Server restart bo‘lsa `queued` joblar va provider holati bor `running` video joblar avtomatik qayta navbatga olinadi.
- `/api/studio/gen/:jobId` polling endpointi ham resume trigger bo‘ldi; foydalanuvchi kutayotgan paytda job yana ushlanadi.
- Seedance Fast va R2V timeoutlari timeout bo‘lsa darrov `failed` qilinmaydi; `running` holatda qolib keyin resume qilinadi.
- Durable resume uchun local queue dedupe qo‘shildi; bitta job bir process ichida ikki marta parallel yurmaydi.
- Oldingi quick stabilization saqlandi: `480p`, `Auto≈4s`, `audio default off`, parallel referens materializatsiyasi.
- Hali qolgan katta qadam: fal webhook bilan push-complete oqimiga o‘tish (hozircha DB-resume + repoll).
- Tekshiruv: `npm run build -w apps/api` OK.
- Tekshiruv: plugin inline script parse `OK 15`.
