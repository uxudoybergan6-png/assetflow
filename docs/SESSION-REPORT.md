# SESSION REPORT — 2026-07-01 — Gen-progress UX: So'nggi grid ichida karta (0-100%) + 20 daqiqa

Foydalanuvchi so'rovi: gen progressi yuqorida sanаb turmasin; pastdagi So'nggi grid kartasida 0-100% aniq sanasin; kutmasdan yana gen; kutish 20 daqiqa (rasm+video).

## O'zgarishlar (rasm + video panel)
- **YUQORI progress ro'yxati OLIB TASHLANDI** (renderJobs/renderVgJobs endi bo'sh — igProg/vgProg ko'rinmaydi).
- **Har gen So'nggi grid tepasiga "pending" karta** bo'lib qo'shiladi: spinner + 0-100% shkala + prompt + Bekor. Vaqt-asosli silliq shkala (97*(1-e^(-t/45)) rasm, /90 video).
- **Done bo'lganda pending karta O'SHA JOYDA natijaga aylanadi** (url/id/thumb bilan) — sakramaydi. count>1 → qolgan rasmlar ham qatorga qo'shiladi.
- **Non-blocking**: foydalanuvchi kutmasdan yana gen qiladi (MAX_JOBS parallel), har biri alohida pending karta.
- **Umumiy komponent**: `afRecent.pendingCard()` + `afRecent.updatePending()` (rasm+video birga ishlatadi). CSS `.rc-pend`.

## Timeout (20 daqiqa)
- Rasm UI: POLL_CAP 340→**670** (~20 daqiqa). Video UI: VG_POLL_CAP 420 (~39 daq, backend cheklaydi).
- Backend `stuckTimeoutMs`: hammasi (rasm+video) **20 daqiqa**.

## Tekshiruv
- 7 inline skript sintaksis-toza (node --check). CEP reinstall + backend deploy. AE'da real sinash foydalanuvchida (CEP).

## Foydalanuvchiga
- AE'ni Cmd+Q qayta oching. Rasm/Video: gen boshlanganda pastda karta 0→100% sanaydi, tugaganda rasm/video bo'ladi; yuqorida darrov yana gen qilsa bo'ladi.
