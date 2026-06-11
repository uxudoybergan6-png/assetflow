# AssetFlow — loyiha doirasi (Scope)

> Yangilangan: 2026-06-05. Joriy holat: ~60% tayyor (`docs/LAUNCH-PLAN.md`).
> Eslatma: dastlabki reja Premiere Pro UXP'dan boshlangan edi, lekin loyiha
> **After Effects CEP** marketplace'iga aylandi. Premiere hozircha doiradan tashqarida.

## Mahsulot

**AssetFlow** — Adobe After Effects uchun shablon marketplace.
Contributor yuklaydi → Admin moderatsiya qiladi → AE plugin katalogida chiqadi →
obunachi Free/Pro limitlar bilan import qiladi.

## Tayyor (ishlaydi)

- **AE CEP plugin** — Browse katalog, login, Free/Pro, filter, pack import (`.aep`)
- **Contributor Studio** — shablon yuklash (thumb, preview, pack `.zip`/`.aep`), submit
- **Admin panel** — moderatsiya (approve/reject, published), obunachilar, analitika, audit log
- **Backend API** — auth, katalog, upload, usage, messaging (Render)
- **DB** — Neon PostgreSQL + Prisma
- **Fayl saqlash** — Cloudflare R2 + CDN
- **Deploy** — API (Render) + Studio/Admin (Vercel) onlayn

## MVP launch uchun qolgan (ustuvor)

1. **ZXP tarqatish** — plugin imzolash + paketlash (eng katta bloker)
2. **Stripe** — Free/Pro to'lov oqimi (kod bor, env + webhook kerak)
3. **Email** — Resend ulangan, domen tasdiqlash + kalit kerak

To'liq ro'yxat: `docs/LAUNCH-PLAN.md` (6 bo'lim — tarqatish, to'lov,
xavfsizlik, email, infra, huquqiy/QA).

## Doiradan tashqari (hozircha)

- **Premiere Pro UXP plugin** — kelajakda, agar AE muvaffaqiyatli bo'lsa
- Contributor payout (daromad ulushi) — to'lov ishlagandan keyin
- GDPR/legal hujjatlar — launchgacha

## Inson ishi (AI qilmaydi)

- Professional shablon kontenti (haqiqiy `.aep`'lar)
- Stripe / Cloudflare / Adobe Exchange hisob sozlash va nashr
- ZXP imzolash sertifikati (self-signed yoki tijorat)
