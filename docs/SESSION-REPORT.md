# SESSION REPORT — 2026-06-29 — preflight safety check qo‘shildi

- fal webhook + resume oqimi saqlandi; video joblar serverga tugagach push qilinadi.
- Qo‘shimcha topilma: foydalanuvchi ko‘p kutgan holatlarning bir qismi safety blok bo‘lib, oldin faqat oxirida bilinardi.
- Yangi backend helper qo‘shildi: `preflight-safety.ts` — prompt va referensli holat uchun tezkor safety heuristic.
- Yangi endpoint: `POST /api/studio/gen/preflight-safety`.
- `POST /api/studio/gen` ichiga ham shu guard qo‘shildi; bloklansa kredit yechilmasdan oldin to‘xtaydi.
- Video tool Generate bosishidan oldin endi preflight endpoint’ni chaqiradi.
- Yuqori xavf holatida job umuman yuborilmaydi; foydalanuvchi darrov tushunarli ogohlantirish oladi.
- O‘rta xavf holatida warning chiqadi, lekin ishni davom ettirish mumkin.
- Oldingi video poll uzaytirilgani ham saqlanib qoldi.
- Tekshiruv: `npm run build -w apps/api` OK, plugin script parse `OK 7`.
