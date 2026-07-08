# Admin 2FA (TOTP) — qo'llanma

Admin hisoblari uchun authenticator-app asosidagi ikki bosqichli kirish (TOTP,
RFC 6238). Faqat **ADMIN** roliga tegishli — USER/CONTRIBUTOR loginlari o'zgarmagan.

## Qanday ishlaydi

1. **Enrol** (Admin Console → Settings → *Two-factor authentication*):
   `POST /api/auth/2fa/setup` yangi sir + QR + **10 ta backup kod** qaytaradi
   (kodlar FAQAT bir marta ko'rsatiladi). Authenticator'dagi joriy kod bilan
   `POST /api/auth/2fa/enable` — shundan keyin 2FA majburiy.
2. **Login** ikki bosqichli bo'ladi: parol to'g'ri bo'lsa API to'liq JWT o'rniga
   `{ twoFactorRequired: true, pendingToken }` (5 daqiqalik, sessiya sifatida
   ISHLAMAYDI — alohida secret bilan imzolangan) qaytaradi. So'ng
   `POST /api/auth/2fa/verify { pendingToken, code }` — TOTP yoki backup kod.
   Kod bosqichi 5 urinish/daqiqa bilan cheklangan (429).
3. **Backup kod** (`XXXX-XXXX`) bir martalik — ishlatilgach o'chadi (audit log
   yozuvi bilan). Qolgan soni Settings'da ko'rinadi.
4. **O'chirish**: `POST /api/auth/2fa/disable` — joriy TOTP yoki backup kod shart.
5. **Google login ham chetlab o'tolmaydi**: 2FA yoqilgan admin Google bilan kirsa
   ham kod bosqichi talab qilinadi. AE plagin logini (`/api/plugin/login`,
   `/api/plugin/device/confirm-password`) `totpCode` maydonini talab qiladi;
   plagindagi Google device-code oqimi 2FA'li admin uchun rad etiladi
   (web Admin Console ishlatilsin).

## Saqlash

- `User.totpSecret` — AES-256-GCM shifrlangan (kalit: `TOTP_ENC_KEY` env, berilmasa
  `JWT_SECRET`dan sha256). `TOTP_ENC_KEY`ni keyin o'zgartirsangiz mavjud sirlar
  ochilmay qoladi — adminlar qayta enrol qilishi kerak bo'ladi.
- `User.totpBackupCodes` — sha256 hash'lar (ochiq kod saqlanmaydi).

## ADMIN_REQUIRE_2FA (default: OFF)

`ADMIN_REQUIRE_2FA=true` bo'lsa 2FA yozilmagan admin:

- login qila OLADI (aks holda enrol qilib bo'lmasdi), javobda
  `twoFactorSetupRequired: true` keladi va konsol to'g'ridan Settings'dagi
  setup'ga olib boradi;
- lekin BARCHA admin-endpointlar (`requireAdmin`) `403 TWO_FA_SETUP_REQUIRED`
  qaytaradi — ya'ni konsol enrol tugaguncha amalda qulflangan;
- `/api/auth/2fa/*` ochiq qoladi (enrol shu yerdan).

⚠️ **Lockout'dan saqlanish**: flag'ni yoqishdan OLDIN har bir admin 2FA'ni enrol
qilib olsin. Flag OFF holatda 2FA ixtiyoriy, lekin yoqilgan hisoblarda baribir majburiy.

Agar admin qurilma va backup kodlarini birdan yo'qotsa — DB orqali qayta tiklash:
`UPDATE "User" SET "totpEnabled"=false, "totpSecret"=NULL, "totpBackupCodes"='{}' WHERE email='<admin>';`
