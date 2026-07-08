# PROD-ENV-CHECKLIST — production muhit o'zgaruvchilari va fail-open/closed xatti-harakati

*2026-07-08 · FAZA 1e. Bu ro'yxat har o'zgaruvchining PROD'da bo'lishi shartligini va
bo'lmaganда tizim NIMA qilishini (fail-open = jimgina o'tkazadi / fail-closed = bloklaydi)
aniqlaydi. Kod haqiqati — `apps/api/src/index.ts` (boot env-check) + tegishli `lib/*`.*

Boot'da `apps/api/src/index.ts` allaqachon `[env] Ogohlantirishlar` ro'yxatini chiqaradi va
zaif `JWT_SECRET`'da FATAL exit qiladi. Quyidagi jadval to'liq holatni beradi.

## 🔴 Xavfsizlik / to'lov — MAJBURIY

| Env | Yo'q bo'lsa xatti-harakat | Talab |
|-----|--------------------------|-------|
| `JWT_SECRET` | **FATAL** — zaif/<32 belgi bo'lsa prod'da server to'xtaydi | ≥32 tasodifiy (`openssl rand -hex 32`) |
| `COST_QUOTE_SECRET` | **fail-open** — `JWT_SECRET`'ga qaytadi (ogohlantirish). JWT sizsa soxta arzon quote → tekin AI | Alohida tasodifiy qiymat (Faza 2'da FATAL bo'ladi) |
| `CORS_ORIGIN` | **fail-open** — `*` (barcha originlar). Ogohlantirish chiqadi | Aniq URL ro'yxati (vergul bilan) |
| `LEMONSQUEEZY_API_KEY` / `LEMONSQUEEZY_STORE_ID` / `LEMONSQUEEZY_WEBHOOK_SECRET` | Billing 503 (`BILLING_NOT_CONFIGURED`) — to'lov o'chiq; webhook imzosi tekshirilmaydi | To'lov yoqilsa uchalasi shart |
| `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE` | Default `false` (xavfsiz). `true` bo'lsa PRO PULSIZ beriladi | Prod'da `false` |
| `TURNSTILE_SECRET_KEY` (+ frontend site-key) | **fail-closed** prod'da — bot-himoya so'rovlari rad etiladi (Turnstile widget shart) | Prod'da SOZLANSIN (aks holda ro'yxatdan o'tish/parol-reset bloklanadi) |

## 🟠 Kontent xavfsizligi — moderatsiya + malware

| Env | Yo'q bo'lsa xatti-harakat | Talab |
|-----|--------------------------|-------|
| `MODERATION_API_KEY` | ML moderatsiya **no-op**. Matn kalit-so'z (preflight) baribir og'ir kategoriyalarni FAIL-CLOSED bloklaydi, lekin RASM piksellari ML bilan tekshirilmaydi. **Prod'da boot BANNER ogohlantirishi** (`moderationStartupWarning`) | Prod'da SOZLANSIN |
| `MODERATION_REQUIRE_IMAGE_VERIFICATION` | Default OFF. `true` → sozlanmaganda ham prod'da rasm inputli generatsiya **FAIL-CLOSED** bloklanadi | Ixtiyoriy — qat'iy rejim uchun `true` |
| `MODERATION_FAIL_OPEN` | Default OFF. Prod'da moderatsiya API xatosi + rasm inputi → **FAIL-CLOSED** (bloklanadi). `true` = ataylab fail-open | Odatda o'rnatilmaydi (fail-closed qoladi) |
| `MODERATION_MODERATE_OUTPUTS` | Default OFF → generatsiya **NATIJALARI** hech qachon moderatsiya qilinmaydi (faqat input) | Natijalar ham tekshirilsin desangiz `true` |
| `MODERATION_STRICT` | Default OFF → faqat og'ir kategoriya bloklanadi | Qattiqroq kerak bo'lsa `true` (istalgan flag bloklaydi) |
| `VIRUSTOTAL_API_KEY` | Malware skani faqat **hash/dedup** (mavjud yomon fayllar karantin), yangi/noma'lum fayl chuqur tahlil qilinmaydi | Prod'da SOZLANSIN (boot ogohlantirishi qo'shildi) |

> **Fail-closed moderatsiya mantiqi** (`apps/api/src/lib/moderation.ts`): prod + rasm inputi +
> ML tekshiruvi imkonsiz (API xato yoki `REQUIRE_IMAGE_VERIFICATION` bilan sozlanmagan) →
> `blocked:true` (`unverified-image`). Malware-skan fail-closed naqshiga mos.

## 🟡 Ishonchlilik / operatsion

| Env | Yo'q bo'lsa xatti-harakat | Talab |
|-----|--------------------------|-------|
| `RESEND_API_KEY` | Email yuborilmaydi (tasdiqlash/parol-reset/bildirishnoma) — havola log'ga yoziladi | Prod'da SHART (email-verify gate uchun) |
| `EMAIL_FROM` | `resend.dev` sandbox bo'lsa xatlar real userlarga YETMAYDI (DKIM/SPF) | Tasdiqlangan domendan (`no-reply@getframeflow.app`) |
| `SENTRY_DSN` | Xato-kuzatuv **no-op** — prod xatolari ko'rinmaydi | Prod'da SOZLANSIN |
| `BACKUP_GCS_BUCKET` | DB backup GCS'ga yuklanmaydi (ma'lumot yo'qotish xavfi) — boot ogohlantirishi qo'shildi | Prod'da SHART + bucket versioning + IAM |
| `ADMIN_NOTIFY_EMAIL` | Admin yangi upload/hodisadan email olmaydi | Ixtiyoriy (tavsiya) |

## ☁️ Infratuzilma (allaqachon sozlangan — tasdiqlang)

`DATABASE_URL`, R2/GCS (`AWS_*`, `S3_ENDPOINT`, `CDN_BASE_URL`), `API_PUBLIC_URL`, `WEB_URL`,
`GOOGLE_CLIENT_ID`, AI provayder kalitlari (`FAL_KEY`, Vertex, `ELEVENLABS_API_KEY`).

---

## Launch oldidan minimal PROD tekshiruvi

1. `JWT_SECRET` va `COST_QUOTE_SECRET` — alohida, kuchli, tasodifiy.
2. `MODERATION_API_KEY` + `VIRUSTOTAL_API_KEY` — SOZLANGAN (boot banner/ogohlantirishlari yo'q).
3. `MODERATION_MODERATE_OUTPUTS=true` (video/audio natijalar ham tekshirilsin, agar kerak).
4. `CORS_ORIGIN` — aniq URL ro'yxati (`*` emas).
5. `RESEND_API_KEY` + tasdiqlangan `EMAIL_FROM`; `TURNSTILE_SECRET_KEY` + site-key.
6. `BACKUP_GCS_BUCKET` + versioning + IAM; `SENTRY_DSN`.
7. Boot loglarida `[env] Ogohlantirishlar` bo'sh bo'lsin (yoki har biri ongli qaror).
