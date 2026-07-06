# Sessiya hisoboti — 2026-07-06 (Device-code sign-in: web device.html email/parol yo'li + poll + guest toast)

**Muammo:** Plagin oqimni boshlaydi (link+kod+"Browser opened"), lekin user KIRA OLMASDI.

**Root cause (brauzerda tasdiqlangan):** `packages/assetflow-studio/device.html` (getframeflow.app/device.html
→ CF 308 → /device, kod saqlanadi, sahifa 200) FAQAT Google GIS tugmasini ko'rsatardi. Google yangi
domenda ishlamasa/user tugatolmasa — muqobil yo'q → tiqilib qolardi. Backend (start→confirm→poll) va DB
sog' edi (run.app va api.getframeflow.app bir xil DB — cross-base poll test bilan tasdiqlandi).

**Tuzatishlar (additive):**
1. API `apps/api/src/routes/plugin.ts`: yangi `POST /api/plugin/device/confirm-password` (email+parol,
   /login bilan bir xil bcrypt; pul mantig'i TEGILMADI). tsc toza.
2. `device.html`: email+parol formasi + "or" + Google (GIS yuklanmasa ~5s'da jimgina yashiriladi).
   Ikkala yo'l ham `showConfirmed()` → "✓ Confirmed". Intro matn yangilandi.
3. Plagin `assetflow-account.js`: `sessionEstablished` — "Session expired" toast/modal FAQAT haqiqiy
   (fetchMe/login/device-confirm bilan bir marta tasdiqlangan) sessiya tugaganda. Bootdagi eskirgan
   token 401'i mehmon uchun JIMGINA tozalanadi (PART 3).

**Jonli test (lokal API+studio, brauzer):** start→confirm-password(user123)→200→poll→confirmed+token+user.
Noto'g'ri parol→401. Sahifa 3 yo'lni ham render qiladi. Backend zanjiri to'liq ishladi.

**Kutilmoqda:** API DEPLOY (endpoint hali productionda yo'q) + CF Pages deploy (device.html) + AE test.
Google GIS getframeflow.app origin'i Google Console'da avtorizatsiya qilinganini tekshirish tavsiya.
