# SESSION-REPORT — 0 AI kredit bug (yangi FREE foydalanuvchi)

**Sana:** 2026-07-04 · **Ko'lam:** pul-zonasi, minimal diff, 2 alohida commit.

**Topilgan sabab:** `ensurePluginProfile` (apps/api/src/lib/plugin-profile.ts:63)
yangi profil yaratganda `aiCredits`ni ANIQ bermay, faqat DB ustun DEFAULT'iga
(`@default(50)`) tayangan edi — bu ustun default kod ichidagi yagona haqiqat
manbai `AI_MONTHLY_CREDITS.FREE` (=50) bilan hech qanday dasturiy bog'liqlikka ega
emas. Lokal DB/migratsiyada hozircha ikkalasi ham 50 — jonli bug shu holatda
REPRODUCE bo'lmadi, lekin ikki qiymat kelajakda (konstanta o'zgarsa, migratsiya
unutilsa) osongina uzoqlashib, aynan shu simptomni (0 kredit) beradi.

**Tuzatish (b3b7d87):** `upsert`ning `create` shoxobchasi endi
`aiCredits: aiMonthlyAllotment(FREE)` va `aiCreditsResetAt: monthStart()`ni ANIQ
beradi. `update: {}` tegilmagan — mavjud foydalanuvchi balansi buzilmaydi.
Consume/refund matematikasi, signed cost-quote, ADMIN cheksiz yo'l — TEGILMADI.

**Backfill (ae732fd):** `scripts/backfill-free-credits.mjs`
(`npm run backfill:free-credits`, DRY_RUN=1 default) — FREE + aiCredits=0 +
CreditLedger'da hech qanday yozuv yo'q + ledger migratsiyasidan (2026-07-03)
KEYIN yaratilgan profillarni 50ga tiklaydi. Ledger faoliyati bor (legitim sarf)
yoki ledgerdan oldingi profillar TEGILMAYDI — qo'lda tekshirish ro'yxatida chiqadi.

**Tekshirildi:** `tsc` build toza; lokal Postgres'da 3 stsenariy (bug qurboni /
legit sarflab bo'lgan / ledgerdan oldingi profil) qo'lda seed qilindi — script
faqat bug qurbonini backfill qildi, qolgan ikkitasiga tegmadi. To'liq dev-stack
E2E (register→credits) preview muhitidagi mavjud PORT konflikti tufayli
o'tkazilmadi (mening o'zgarishimga aloqasiz, oldindan mavjud muammo).

**Kutilmoqda:** foydalanuvchi productionда avval `DRY_RUN=1 npm run
backfill:free-credits` bilan hisobotni ko'radi, keyin `DRY_RUN=0` bilan bajaradi.
Push QILINMADI.
