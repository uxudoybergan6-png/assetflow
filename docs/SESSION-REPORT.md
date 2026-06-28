# SESSION REPORT — 2026-06-28 — Seedance 2 R2V capability alignment

- Seedance 2 R2V hujjatlari tahlil qilindi va model deskriptori docs bilan yaqinlashtirildi.
- R2V uchun davomiyliklar `13s` va `14s` qo‘shildi.
- Yangi capability qo‘shildi: `bitrate_mode` (`standard` / `high`) — plugin UI va backend fal payloadga ulandi.
- `end_user_id` endi backenddan fal so‘roviga uzatiladi.
- Referens limitlari aniqlashtirildi: rasm `30MB/file`, audio `15MB/file`, video referenslar jami `50MB`.
- R2V uchun ruxsat etilgan formatlar toraytirildi: image `jpg/jpeg/png/webp`, video `mp4/mov`, audio `mp3/wav`.
- Video referens ishlatilsa narx hisobida modelning `0.6x` chegirma logikasi qo‘shildi.
- Video tool `Prompt yaxshilash` endi tanlangan model va image referenslar kontekstini yuboradi.
- Tekshiruv: `npm run build -w apps/api` OK, plugin script parse `OK 15`.
