# SESSION REPORT — 2026-07-03 — verify-email redirect fix (admin login leak)

## MUAMMO
Foydalanuvchi skrinshot bilan ko'rsatdi: emailni tasdiqlagan oddiy USER (plugin obunachi)
tasdiqlash havolasidan keyin `getframeflow.app/login.html?verified=1`ga tushib qolardi —
bu **Studio/Contributor/Admin login sahifasi**, platforma emas. U yerda "Admin uchun: SQL
da UPDATE User SET role='ADMIN'" degan xavfli hint + Contributor→Admin oqimi ko'rinadi —
oddiy foydalanuvchiga umuman tegishli emas va xavfsizlik nuqtai nazaridan yomon.

## SABAB
`verify-email.html:78` muvaffaqiyatli tasdiqlashdan keyin har doim `/login.html?verified=1`ga
hardcoded redirect qilardi — foydalanuvchi roli (USER/CONTRIBUTOR/ADMIN) tekshirilmasdi.

## TUZATILDI
- `apps/api/src/routes/auth.ts` — `POST /verify-email` javobiga `role: user.role` qo'shildi.
- `verify-email.html` — endi `role`ga qarab: CONTRIBUTOR/ADMIN → `/login.html?verified=1`
  (Studio, o'zgarmadi), oddiy USER → `/?verified=1` (platforma root).
- `platform/index.html` `componentDidMount()` — `?verified=1` query'ni o'qiydi, URL'dan
  tozalaydi, toast ko'rsatadi va login qilmagan bo'lsa `auth` ekraniga o'tkazadi.

## TEKSHIRILDI
- `npm run build -w apps/api` — toza.
- platform-preview: `/?verified=1` ochilganda to'g'ridan-to'g'ri `#auth` ekraniga tushdi,
  query param URL'dan tozalandi, konsol toza.
- `git diff --stat` — faqat 3 fayl (`auth.ts`, `verify-email.html`, `platform/index.html`).

## KUTILMOQDA
1. Deploy (API + CF Pages) → productionda haqiqiy tasdiqlash email havolasi bilan sinash.
