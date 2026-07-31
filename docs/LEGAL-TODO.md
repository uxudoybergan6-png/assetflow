# LEGAL-TODO — huquqshunos bilan yakunlanadigan qarorlar

> **Maqsad:** Huquqiy hujjatlar (terms/privacy/refund) joriy KOD holatiga faktik jihatdan
> moslandi. Quyidagi bandlar esa **biznes/huquqiy qaror** talab qiladi va uni **egasi +
> huquqshunos** hal qilishi kerak. Bu fayl aynan nimani hal qilish kerakligini ro'yxatlaydi.
>
> ⚠️ **#119 (L5) — 2026-07-31:** belgilar ilgari ochiq sahifalarning HTML manbasida
> `<!-- ⚠️ needs lawyer review ... -->` izohlari sifatida turardi. "Foydalanuvchiga ko'rinmaydi"
> degani ochiq emas degani EMAS: izohlar mijoz brauzeriga yetkazilardi va "View source" qilgan
> har kim (yoki skreyper/LLM) kompaniya o'z huquqiy hujjatlariga ishonmasligini o'qiy olardi —
> nizoda bevosita mijoz foydasiga dalil. Izohlar **olib tashlandi**, matni quyida.
> **Ochiq HTML'ga qayta yozmang** — shu faylga yozing.

**Yangilangan: 2026-07-08** — faktik holat quyidagi KOD manbalariga tekshirildi:
- To'lov: `apps/api/src/lib/lemonsqueezy.ts`, `apps/api/src/routes/billing.ts` (FAOL yo'l = Lemon Squeezy).
- Tariflar: `PluginPlanTier` enum = **FREE | PRO | STUDIO** (`packages/database/prisma/schema.prisma`).
- Kredit paketlari: `billing.ts` `credits` checkout + `lemonsqueezy.ts` `classifyVariant` "N Credits" + `PluginProfile.aiCreditsTopup` (oylik reset'da saqlanadi).

Manba fayllar (MANBA — bu yerga edit qiling, `dist/` build artefakti; `platform/` to'g'ridan serv qilinadi):
- `packages/assetflow-studio/platform/terms.html`
- `packages/assetflow-studio/platform/privacy.html`
- `packages/assetflow-studio/platform/refund.html`
- `packages/assetflow-studio/platform/dmca.html`
- `packages/assetflow-studio/platform/help.html`

### Sahifa-ba-sahifa ochiq bandlar (HTML izohlaridan ko'chirildi — #119)

| Sahifa | Yakunlanmagan band |
|---|---|
| `terms.html` (umumiy) | Aniq soliq yurisdiksiyalari, isteʼmolchi huquqi, yakuniy so'zlashuv |
| `terms.html` §3 | MoR/soliq: Lemon Squeezy VAT/sales tax'ni o'zi hisoblaydi (`lemonsqueezy.ts`, `billing.ts`); yurisdiksiya + invoice talablari |
| `terms.html` §4 | Kredit paketi amal qilish muddati / qaytarish sharti (`aiCreditsTopup` reset'da saqlanadi) |
| `privacy.html` | Protsessorlar ro'yxati + saqlash (retention) bandlari |
| `refund.html` | 14 kunlik oyna, "substantial portion" chegarasi, mahalliy isteʼmolchi huquqi |
| `refund.html` (paketlar) | "Ishlatilmagan" chegarasi va paket qaytarish shartlari |
| `dmca.html` | Tayinlangan agent kontakti; notice/counter-notice tartibi; O'zbekiston + DMCA 17 U.S.C. §512 muvofiqligi (hozirgi matn — umumiy ramka) |
| `help.html` | Operatsion (huquqiy emas): `support@getframeflow.app` pochta qutisi sozlanganini tasdiqlash (C7). Contributor'lar uchun Studio Messages allaqachon ishlaydi |

⚠️ **Marketingda taqiq:** aniq "14-day money-back guarantee" iborasi ommaviy marketing matnida
ISHLATILMAYDI (shart yakunlanmagan) — `scripts/verify-public-copy.mjs` buni qadab qo'ygan.

---

## ✅ Kodga moslashtirilgan (faktik holat — bajarildi)

- **To'lov protsessori/MoR:** hamma joyda "Stripe" → **Lemon Squeezy** ga o'zgartirildi. Lemon
  Squeezy — Merchant of Record: QQS/sotuv solig'ini O'ZI hisoblab, ushlab, to'laydi. (Bu MoR
  ta'rifi — faktik, `lemonsqueezy.ts` doc-comment bilan mos.)
- **Tariflar:** terms §3 endi **Pro va Studio** ni tilga oladi; refund "Obuna (Pro / Studio)".
- **Kredit paketlari:** terms §4 va refund "Kredit paketlari" endi ular MAVJUD deb yozadi (oldingi
  "kodda YO'Q" da'vosi noto'g'ri edi).

---

## ⚠️ Huquqshunos hal qiladigan ochiq qarorlar

### 1. Soliq yurisdiksiyasi / invoice talablari
Lemon Squeezy MoR sifatida QQS/sotuv solig'ini ushlaydi — lekin **qaysi hududlarga sotamiz**,
invoice/kvitansiya talablari, va O'zbekiston (agar UZS sotuv bo'lsa) soliq deklaratsiyasi
qanday — huquqshunos aniqlasin.
- Bog'liq: `terms.html` §3, `privacy.html` §4.

### 2. Qaytarish muddati va iste'molchi qonuni
`refund.html` 14 kun + "kiritilgan kreditlarning muhim qismi sarflanmagan" chegarasi ehtiyotkor
umumiy matn. Buni **Lemon Squeezy xaridor shartlari** va **maqsadli bozor iste'molchi qonuni**
bilan moslashtiring; "muhim qism" ni aniq foizga (masalan >20%) aylantirish kerakmi — qaror qiling.
- Bog'liq: `refund.html` "Obuna (Pro / Studio)", "Kredit paketlari".

### 3. Kredit-paket amal qilish muddati / qaytarish
Sotib olingan top-up kreditlar oylik reset'da **saqlanadi** (kuymaydi — `aiCreditsTopup`
invariant). Amal qilish muddati (agar bo'lsa) va qaytarish sharti (sarflana boshlagach
qaytmaydi) huquqiy jihatdan tasdiqlansin.
- Bog'liq: `terms.html` §4, `refund.html` "Kredit paketlari".

### 4. Til (i18n) nomuvofiqligi
Huquqiy hujjatlar **o'zbekcha**, ilova UI **inglizcha**. Huquqshunos bilan: yakuniy huquqiy
til qaysi bozorga (UZ/EN) mo'ljallanganini hal qiling; kerak bo'lsa ikkala tilda saqlang.

### 5. Yakuniy tekshiruv
Iste'molchi/maxfiylik qonuni (O'zbekiston PDD va/yoki GDPR agar EU foydalanuvchilari bor)
bo'yicha huquqshunosdan yakuniy tekshiruv oling. GDPR self-serve **eksport/o'chirish** endi
kodda mavjud (`POST /api/users/export`, `DELETE /api/account`) — siyosat matnini shunga
moslang. DMCA public policy sahifasi qo'shildi (`platform/dmca.html`).

---

## Yakunlash tartibi (tavsiya)

1. MoR soliq yurisdiksiyasini tasdiqlang (1) — bu invoice/soliq matnini belgilaydi.
2. Qaytarish shartlarini Lemon Squeezy + iste'molchi qonuni bilan moslang (2, 3).
3. Til qarorini qabul qiling (4).
4. Hal bo'lgan bandni yuqoridagi jadvaldan o'chiring (HTML'da izoh YO'Q — #119).
5. Huquqshunosdan yakuniy tekshiruv (5).

*Dastlab: 2026-07-04 (Bosqich 2) · Yangilandi: 2026-07-08 (FAZA 1 — kodga moslash + GDPR + DMCA)
· 2026-07-31 (BATCH 11 / #119 — ochiq HTML'dan lawyer-review izohlari olindi).*
