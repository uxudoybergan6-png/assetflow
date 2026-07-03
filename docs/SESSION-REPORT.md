# SESSION REPORT — 2026-07-03 — Rol bo'yicha login segregatsiyasi (platforma)

## MUAMMO
Foydalanuvchi so'radi: USER/CONTRIBUTOR/ADMIN bir-birining login sahifasidan kira olmasin.
Tekshiruv natijasi: `login.html` (Studio/Contributor) va `admin-login.html` allaqachon
mos kelmagan rolni rad etardi (xato xabar + logout), lekin **platforma**
(`platform/index.html`, getframeflow.app) hech qanday rol tekshiruvi qilmasdi — CONTRIBUTOR
yoki ADMIN hisobi bilan ham kirib, USER dashboard/AI Studio'dan foydalanish mumkin edi.

## TUZATILDI
- `platform/index.html` `_afterLoginSuccess(r, msg)` — login/register/Google javobida
  `r.user.role !== 'USER'` bo'lsa: sessiya tozalanadi, `authErr` bilan rad javobi ko'rsatiladi,
  dashboard'ga o'tkazilmaydi (login.html'dagi bir xil naqsh).
- `componentDidMount()` — localStorage'da saqlangan eski sessiya CONTRIBUTOR/ADMIN role
  bo'lsa avtomatik tozalanadi (himoya: eski/qo'lda kiritilgan token qolib ketgan holat).
- `login.html` (USER rad etadi) va `admin-login.html` (non-ADMIN rad etadi) — o'zgarishsiz,
  ular allaqachon to'g'ri edi.

## TEKSHIRILDI (platform-preview)
- Stale CONTRIBUTOR sessiya bilan `#dashboard`ga kirishga urinish → sessiya tozalanib
  `#auth`ga tushdi.
- Mock login javobi `role:'CONTRIBUTOR'` bilan submit qilinganda — aniq xato xabari
  ko'rsatildi, sessiya saqlanmadi (`ff_token`/`ff_user` bo'sh qoldi), dashboard ochilmadi.
- Mock `role:'USER'` bilan — regressiya yo'q, to'g'ridan-to'g'ri dashboard ochildi.
- `git diff --stat` — faqat `platform/index.html` (14 qo'shildi/2 o'chdi).

## KUTILMOQDA
1. Deploy → productionda haqiqiy uchta rol (USER/CONTRIBUTOR/ADMIN) bilan qayta tekshirish.
