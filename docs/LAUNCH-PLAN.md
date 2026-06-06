# AssetFlow — Bozorga chiqish rejasi (100%)

*Yangilangan: 2026-06-05 · Holat: ~60% tayyor*

Loyiha mantig'i ishlaydi (upload → moderate → import), lekin **tarqatish, tijorat,
huquqiy va infra** qismlari to'liq emas. Quyida 6 bo'limga bo'lingan ishlar.

---

## 1-BO'LIM — Tarqatish (Distribution) 🔴 ENG MUHIM

Hozir plugin faqat `install-cep.sh` + `PlayerDebugMode 1` bilan ishlaydi (DEV).
Oddiy foydalanuvchi o'rnatolmaydi. Bu — **eng katta bloker**.

- [ ] **ZXP imzolash sertifikati** — `ZXPSignCmd` + self-signed `.p12` (yoki tijorat sertifikat)
- [ ] **ZXP paketlash skripti** — `scripts/build-zxp.sh` (manifestdan versiya, imzolash)
- [ ] **Manifest production ID** — `com.assetflow.demo` → `com.assetflow.plugin`
- [ ] **`.debug` faylni production paketdan chiqarib tashlash**
- [ ] **O'rnatuvchi** — ZXPInstaller yoʻriqnomasi yoki Adobe Exchange listing
- [ ] **Versiyalash** — auto-update tekshiruvi (yangi versiya bormi?)
- [ ] **Windows test** — cross-platform kod yozildi, lekin Windows'da sinalmagan

## 2-BO'LIM — To'lov & Tijorat (Payments) 🔴

Stripe kodi tayyor, lekin uzilishlar bor.

- [ ] **Render env**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY/YEARLY`
- [ ] **Stripe webhook URL** Stripe dashboard'da ro'yxatdan o'tkazish
- [ ] **`PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false`** (production'da)
- [ ] **Plugin Pro tugmasi** — checkout oqimi sinash (brauzer ochiladi → to'lov → webhook)
- [ ] **Narx sahifasi** (pricing) — Free vs Pro taqqoslash
- [ ] **Contributor payout** — daromad ulushi modeli (agar pul to'lansa): `Payout` jadval, Stripe Connect
- [ ] **Soliq/invoice** — Stripe Tax yoki qo'lda

## 3-BO'LIM — Xavfsizlik & Auth 🟠

- [ ] **Render env**: kuchli `JWT_SECRET` (`openssl rand -hex 32`)
- [ ] **Email tasdiqlash** — ro'yxatdan o'tishda (hozir istalgan email)
- [ ] **Rate-limit → Redis** — hozir in-memory (Render restartda nollanadi)
- [ ] **Parol tiklash deploy** — kod tayyor, productionda sinash
- [ ] **Brute-force himoya** — login limiter bor, kuchaytirish
- [ ] **CORS qattiqlashtirish** — hozir hamma originga ruxsat (`index.ts`)
- [ ] **Fayl upload xavfsizligi** — hajm limiti bor, format/malware skani qo'shish

## 4-BO'LIM — Email & Bildirishnomalar 🟠

Infra tayyor (`lib/email.ts`, Resend), kalit kerak.

- [ ] **Render env**: `RESEND_API_KEY`, `EMAIL_FROM` (tasdiqlangan domen)
- [ ] **Domen tasdiqlash** Resend'da (SPF/DKIM)
- [ ] **Email shablonlar**: welcome, parol tiklash ✅, shablon tasdiq/rad ✅, to'lov cheki
- [ ] **Contributor**: "shablon sotildi / yuklab olindi" bildirishnoma
- [ ] **Admin**: "yangi shablon moderatsiyaga keldi" bildirishnoma

## 5-BO'LIM — Infratuzilma & Performance 🟠

- [ ] **Render paid tier** — free cold start (~50s) yo'qotish
- [ ] **CDN_BASE_URL** — R2 public bucket sozlash (to'g'ridan yuklash tezligi)
- [ ] **Sentry** — xato monitoring (API + plugin)
- [ ] **Analytics** — foydalanuvchi xatti-harakati (PostHog/Plausible)
- [ ] **DB indekslar** — katalog/qidiruv tezligi uchun
- [ ] **Katalog keshlash** — server tomonda (Redis/CDN cache)
- [ ] **Backup** — Neon DB avtomatik backup tekshirish

## 6-BO'LIM — Huquqiy & Sifat (QA) 🟡

- [ ] **Terms of Service** + **Privacy Policy** + **EULA**
- [ ] **Kontent litsenziyasi** — contributor kelishuvi, oxirgi foydalanuvchi huquqi
- [ ] **GDPR** — ma'lumotlarni o'chirish, eksport
- [ ] **Avtomatik testlar** — hozir 0 ta (`apps/api` uchun integration testlar)
- [ ] **End-to-end QA** — upload → approve → import (production)
- [ ] **Foydalanuvchi qo'llanmasi** — video/docs (plugin o'rnatish, import)
- [ ] **Onboarding** — birinchi marta kirgan foydalanuvchiga yo'riqnoma

---

## Ustuvorlik (tartib bilan)

| Bosqich | Bo'limlar | Vaqt |
|---------|-----------|------|
| **MVP launch** | 1 (ZXP) + 2 (Stripe env) + 4 (email env) | 1 hafta |
| **Ishonchli** | 3 (xavfsizlik) + 5 (infra) | 1 hafta |
| **To'liq** | 6 (legal/QA) + payout | 2 hafta |

---

## Tavsiya etilgan vositalar / paketlar

- **ZXP**: `ZXPSignCmd` (Adobe), yoki `zxp-sign-plugin` (npm)
- **Email**: Resend (✅ ulangan) — domen tasdiqlash kerak
- **Monitoring**: Sentry (`@sentry/node`)
- **Rate-limit**: `rate-limiter-flexible` + Upstash Redis
- **Analytics**: PostHog (open-source, self-host mumkin)
- **Tests**: Vitest + Supertest (API)
- **Payout**: Stripe Connect
- **CDN**: Cloudflare R2 (✅ bor) — public bucket yoqish

## Performance maslahatlari

1. **Render free → paid** ($7/oy) — cold start yo'qoladi, eng katta UX yutuq
2. **R2 to'g'ridan URL** (✅ qilindi) — pack yuklash Render'ni chetlab o'tadi
3. **Katalog keshlash** — `/api/plugin/catalog` natijasini 60s CDN cache
4. **DB indeks** — `reviewStatus + published` ustiga composite index
5. **Pack kesh** (✅ plugin'da) — qayta yuklamaydi
6. **Preview optimizatsiya** (✅ `optimize-preview.ts`) — streaming MP4
7. **Lazy loading** — katalogda rasm/video lazy yuklash
