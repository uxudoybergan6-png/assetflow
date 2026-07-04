# LEGAL-TODO — huquqshunos bilan yakunlanadigan qarorlar

> **Maqsad:** Bosqich 2 #3 (huquqiy hujjatlar) ni joriy KOD holatiga moslab yozdik
> (Stripe, FREE/PRO). Lekin bir nechta band **biznes/huquqiy qaror** talab qiladi va
> uni **egasi + huquqshunos** hal qilishi kerak. Bu fayl aynan nimani hal qilish
> kerakligini va qaysi hujjat bo'limlari har bir qarorga bog'liqligini ro'yxatlaydi.
>
> Hujjatlardagi tegishli joylar `<!-- ⚠️ HUQUQIY-TODO... -->` HTML-comment'lari bilan
> belgilangan (foydalanuvchiga ko'rinmaydi). Qaror qabul qilingач, placeholder matnni
> haqiqiy jumla bilan almashtiring va bu faylni yangilang.

Manba fayllar (MANBA — bu yerga edit qiling, `dist/` build artefakti):
- `packages/assetflow-studio/platform/terms.html`
- `packages/assetflow-studio/platform/privacy.html`
- `packages/assetflow-studio/platform/refund.html`

---

## 1. Merchant of Record (MoR) — kim va soliqni kim ushlaydi? ⚠️ ENG MUHIM

**Joriy kod holati:** to'lovlar **Stripe** orqali (`apps/api/src/lib/stripe.ts`,
`apps/api/src/routes/stripe.ts`). Stripe — to'lov **protsessori**, u odatda MoR EMAS va
QQS/soliqni avtomatik ushlab bermaydi (Paddle/LemonSqueezy kabi MoR'lardan farqli).

**Hal qilinishi kerak:**
- MoR kim bo'ladi? Variantlar:
  - (a) Haqiqiy MoR (masalan Paddle / LemonSqueezy) — ular soliq/QQSni o'z zimmasiga oladi;
  - (b) Mahalliy to'lov (Payme / Click, UZS) + soliqni **o'zimiz** hisoblash/deklaratsiya;
  - (c) Stripe + soliqni o'zimiz (Stripe Tax yoki qo'lda) hisoblash.
- Har variant uchun: ro'yxatdan o'tish yurisdiksiyasi, soliq raqami, invoice talablari.

**Bog'liq hujjat bo'limlari:**
- `terms.html` → §3 "Obuna va to'lovlar" (hozir Stripe deb yozilgan + neytral MoR/soliq eslatmasi).
- `privacy.html` → §1 va §4 (to'lov protsessori "hozircha Stripe").
- `refund.html` → kirish qatori ("to'lov protsessori (hozircha Stripe)").

> ⚠️ Hozircha hech qaerda "Paddle soliqni hal qiladi" DEB YOZMANG — bu kod bilan mos emas.

---

## 2. VAT / soliq — maqsadli bozor

**Hal qilinishi kerak:**
- Asosiy bozor(lar): O'zbekiston (UZS) va/yoki xalqaro (USD)?
- QQS/sotuv solig'i qo'llaniladimi, kim hisoblaydi (MoR yoki biz)?
- Narxlar solig'i ichiga oladimi (tax-inclusive) yoki ustiga qo'shiladimi?

**Bog'liq hujjat bo'limlari:**
- `terms.html` → §3 (soliq eslatmasi placeholder).
- `refund.html` → summalar soliqli/soliqsiz qaytariladimi.

---

## 3. Qaytarish siyosati — MoR shartlariga moslash

**Joriy holat:** `refund.html` 14 kunlik qaytarish yozilgan (umumiy, ehtiyotkor).

**Hal qilinishi kerak:**
- 14 kun muddati tanlangan MoR/to'lov provayderi va mahalliy iste'molchi qonuni bilan mosmi?
- "Kreditlarning muhim qismi sarflangan" chegarasi aniq ta'riflansinmi (masalan >20%)?

**Bog'liq hujjat bo'limlari:**
- `refund.html` → "Obuna (Pro)" bo'limi.

---

## 4. 'Studio' tarifi — sotiladimi?

**Joriy kod holati:** backend faqat **FREE** va **PRO** ni amalga oshiradi
(`PluginPlanTier` enum: FREE|PRO). "Studio" — marketing sahifasida ko'rsatilgan, lekin
backend'da YO'Q.

**Hal qilinishi kerak:** Studio tarifi ishga tushiriladimi? Bo'lsa — narx, kreditlar, limit.

**Bog'liq hujjat bo'limlari:**
- `terms.html` → §3/§4 (hozir faqat "Pro" deb yozilgan).
- `refund.html` → "Obuna" bo'limi (Studio qo'shilsa faollashtiriladi).

---

## 5. Kredit paketlari (bir martalik top-up) — sotiladimi?

**Joriy kod holati:** bir martalik kredit paketi **sotib olish oqimi YO'Q** — faqat
tarifga kiritilgan **oylik** kredit. Marketing sahifasida paketlar ko'rsatilgan.

**Hal qilinishi kerak:** kredit paketlari ishga tushiriladimi? Bo'lsa — amal qilish
muddati, qaytarish sharti, sarflangач qaytmasligi.

**Bog'liq hujjat bo'limlari:**
- `terms.html` → §4 "Kreditlar" (paketlar shartli/placeholder).
- `refund.html` → "Kredit paketlari" bo'limi (butunlay shartli).

---

## Yakunlash tartibi (tavsiya)

1. MoR/soliq qarorini qabul qiling (1 + 2) — bu qolganini belgilaydi.
2. `terms.html` §3 + `privacy.html` §4 + `refund.html` kirishini yangilang (Stripe/MoR jumlasi).
3. Studio/kredit-paketlar ishga tushsa (4, 5) — tegishli bo'limlarni faollashtiring.
4. Barcha `<!-- ⚠️ HUQUQIY-TODO... -->` comment'larini o'chiring (hal bo'lgach).
5. Iste'molchi/maxfiylik qonuni (masalan O'zbekiston PDD, GDPR agar EU) bo'yicha huquqshunosdan
   yakuniy tekshiruv oling.

*Yaratilgan: 2026-07-04 — Bosqich 2 #4.*
