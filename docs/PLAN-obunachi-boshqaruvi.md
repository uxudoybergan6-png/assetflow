# Obunachi boshqaruvi — professional admin (implementatsiya rejasi)

*Manba: foydalanuvchi so'rovi (AE Plugin obunachilari sahifasi). Kodda tasdiqlangan.*
*Holat: REJA. Qarorlar: soft+hard o'chirish · global Free limit (Tariflar sahifasida).*

Maqsad: admin obunachilarni professional boshqarsin — reja (Free/Pro), bloklash, chiqarish, butunlay o'chirish, va Free limitini global sozlash.

---

## Kod holati (tasdiqlangan)

| Imkoniyat | Backend | UI | Holat |
|---|---|---|---|
| Reja Free↔Pro | ✅ `PATCH /plugin-subscribers/:userId {plan}` | 🔴 yo'q | UI ulash |
| Bloklash/blokdan chiqarish | ✅ `{status: blocked/active}` (token o'chadi) | 🔴 yo'q | UI ulash |
| Chiqarish (soft remove) | ✅ `{status: removed}` | 🔴 yo'q | UI ulash |
| **Butunlay o'chirish (hard)** | 🔴 yo'q | 🔴 yo'q | Yangi backend + UI |
| **Global Free limit** | 🔴 hardcoded (`FREE_DOWNLOAD_LIMIT=15`) | 🔴 yo'q | Settings + UI |

Fayllar: backend `apps/api/src/routes/admin.ts`, `apps/api/src/lib/plugin-profile.ts`; UI `packages/assetflow-studio/studio/js/admin-subscribers.js`, `admin-plans.js`, `studio-api.js`.

---

## Qism A — Qator amallari (backend tayyor, faqat UI) — BIRINCHI

Har obunachi qatoriga amal menyusi (⋮) yoki tugmalar:
- **Reja:** Free ↔ Pro almashtirish.
- **Bloklash / Blokdan chiqarish** (status toggle) — tasdiq dialogi.
- **Chiqarish** (soft remove) — tasdiq dialogi.

Ish: `studio-api.js`ga `updateSubscriber(userId, {status?, plan?})` (PATCH); `admin-subscribers.js`ga qator amallari + tasdiq + ro'yxat yangilash. Mavjud dizayn-tizimiga mos (sahifa allaqachon sayqalli). **Eng tez yutuq — backend tayyor.**

---

## Qism B — Butunlay o'chirish (hard delete) — yangi backend

- **Backend:** `DELETE /api/admin/plugin-subscribers/:userId` (`requireAuth`+`requireAdmin`):
  - `PluginToken` + plugin usage yozuvlari + `PluginProfile` o'chiriladi.
  - **`User` qatori O'CHIRILMAYDI** (foydalanuvchi contributor ham bo'lishi mumkin — boshqa bog'lanishlar buzilmasin). Faqat plugin obuna ma'lumoti.
  - 204 qaytaradi; audit log yoziladi (`StudioAuditLog`).
- **UI:** "Butunlay o'chirish" amali — **ikki bosqichli tasdiq** (email yozdirish yoki double-confirm), qizil/danger uslub. Menyu ostida, tasodifan bosilmaydigan joyda.
- `studio-api.js`: `deleteSubscriber(userId)`.

> Eslatma: soft-remove (Qism A) odatda yetarli. Hard delete — faqat GDPR/test tozalash uchun. Shuning uchun himoyalangan (ikki tasdiq + audit).

---

## Qism C — Per-user limit override (obunachi profili sahifasida) ⟵ YANGILANDI

> **Qaror o'zgardi (2026-06-14):** avval "global limit" tanlangan edi; foydalanuvchi profil sahifasini ko'rib, **har bir obunachiga alohida** limit qo'yishni xohladi. Demak per-user override.

Hozir `planLimits()` `FREE_DOWNLOAD_LIMIT=15`/`FREE_IMPORT_LIMIT=10` konstantalari. Per-user override:

- **Prisma migratsiya:** `PluginProfile`ga `downloadLimitOverride Int?` + `importLimitOverride Int?` (null = reja default). Migration.
- **`plugin-profile.ts`:** `checkDownloadAllowed`/`recordPluginDownload` profildagi override'ni ishlatsin: `profile.downloadLimitOverride ?? planLimits(plan).downloadLimit`. (Import uchun ham.)
- **Backend:** `PATCH /plugin-subscribers/:userId` schema'siga `downloadLimitOverride`/`importLimitOverride` (nullable int) qo'shish.
- **UI (obunachi profili, `admin-subscribers.js`):**
  - "Tariflarni tahrirlash" havolasini (239-qator, hozir `route('plans')`) → **shu obunachi uchun limit-tahrirlash modali**ga almashtirish.
  - Modal: joriy limit ko'rsatiladi, yangi qiymat kiritiladi (yoki "reja defaultiga qaytarish"), saqlash → PATCH.
  - **Reja almashtirish** (Free↔Pro) ham profil sahifasida bo'lsin (hozir faqat ro'yxat ⋮ menyusida).

> Per-user override Pro/Free rejadan ustun. Override `null` bo'lsa — reja default (15/10 yoki cheksiz). Server gating (`checkDownloadAllowed`) o'zgarmaydi, faqat limit manbasi override'ni hisobga oladi.

---

## Qism D — Profil sahifasini to'liq boshqaruv markaziga aylantirish

Foydalanuvchi profil sahifasida hammasini bir joyda xohlaydi:
- ✅ Bloklash / Blokdan chiqarish (bor)
- ✅ Chiqarib tashlash — soft remove (bor)
- 🔴 Reja Free↔Pro (qo'shish — Qism C bilan)
- 🔴 Limit override (qo'shish — Qism C)
- 🔴 Butunlay o'chirish — hard delete (Qism B)

Natija: profil sahifasi — bitta obunachi ustidan to'liq nazorat paneli.

---

## Ketma-ketlik
1. **Qism A** (UI, backend tayyor) — eng tez, darhol qiymat.
2. **Qism B** (hard delete) — yangi backend + himoyalangan UI.
3. **Qism C** (global limit) — settings + Tariflar UI + migration.

Har qism alohida commit + test. Server-side gating (`checkDownloadAllowed`) o'zgarmaydi — faqat limit qiymati manbasiz emas, sozlamadan keladi.
