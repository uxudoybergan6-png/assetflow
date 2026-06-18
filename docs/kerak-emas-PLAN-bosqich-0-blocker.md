# 0-bosqich — Blocker tuzatishlar (implementatsiya rejasi)

*Manba: AssetFlow Texnik Strategiya + Dizayn hisoboti (2026-06-13). Kod tahlilida tasdiqlangan.*
*Holat: REJA — tasdiqdan keyin kod yoziladi.*

Ikkala hisobot ham bir xil "0-bosqich = blocker" deydi: bularsiz na o'rnatish, na to'g'ri daromad ishlaydi. Ikki vazifa, ikkalasi ham kichik diff, kam risk.

---

## ⚠️ HANDOFF.md bilan solishtiruv (2026-06-14 holati)

HANDOFF.md ko'rsatadiki, bu rejaning bir qismi allaqachon bajarilgan:

| Vazifa | HANDOFF holati | Bu rejada qoladi |
|---|---|---|
| **A — Stripe bypass** | 🔴 OCHIQ — HANDOFF'ning #1 ustuvori (qator 409) | ✅ To'liq dolzarb |
| **B — ZXP build/sign** | 🟢 BAJARILGAN — `build-zxp.sh` mavjud (commit `6a7057a`, qator 254/393) | ⚠️ Faqat **AE'da test** qoladi, yangi yozish yo'q |
| **CORS/URL** | 🟡 QISMAN — klient fayllar `pages.dev`ga ko'chgan (qator 403), lekin `render.yaml` hali eski `vercel.app` | ⚠️ Faqat `render.yaml` + Render dashboard tekshiruvi |

**Xulosa:** bu bosqichda real yangi ish — faqat **Vazifa A**. B va CORS — tekshirish/tasdiqlash.

---

## Vazifa A — Stripe-bypass'ni yopish (KRITIK, ~10 daqiqa)

### Muammo (kodda tasdiqlangan)
- `render.yaml:37` → `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE: "true"` (production'da).
- `apps/api/src/lib/plugin-profile.ts:79` → `proSwitchAllowed()` shu flagni o'qiydi va har kimga PRO beradi.
- Natija: hozir istalgan foydalanuvchi `PATCH /plan` bilan bepul PRO oladi.

### O'zgartirishlar
1. **`render.yaml`** — flag qiymatini `"false"` qilish (yoki butunlay olib tashlash).
   ```yaml
   - key: PLUGIN_ALLOW_PRO_WITHOUT_STRIPE
     value: "false"
   ```
2. **`apps/api/src/lib/plugin-profile.ts:79`** — kod-darajasida himoya: flag faqat `NODE_ENV !== "production"` bo'lganda ishlasin. Shunda kelajakda kimdir flagni adashib `true` qo'ysa ham, production'da PRO sirib chiqmaydi.
   ```ts
   if (process.env.PLUGIN_ALLOW_PRO_WITHOUT_STRIPE === "true" &&
       process.env.NODE_ENV !== "production") return true;
   ```
3. **Render dashboard** — agar env var u yerda alohida o'rnatilgan bo'lsa, `render.yaml` deploy yetarli emas; dashboard'dan ham `false` qilish kerak (qo'lda, men eslatib turaman).

### Tekshirish
- `proSwitchAllowed(false)` production'da `false` qaytarishini unit-test bilan tasdiqlash.
- Deploydan keyin: oddiy hisob bilan `PATCH /api/plugin/profile/plan` → `402`/rad kutiladi.

### Risk
Past. Yagona ta'sir — test uchun "bepul PRO" yo'qoladi. Agar demo kerak bo'lsa, lokal `.env`da `NODE_ENV != production` allaqachon ruxsat beradi.

### To'lov provayderi (alohida qaror — bu rejaga bog'liq emas)
HANDOFF (qator 414) Stripe o'rniga **LemonSqueezy**'ni ko'rib chiqyapti (soddaroq). Muhim: flag'ni `NODE_ENV`-himoyali qilish **provayderga bog'liq emas** — Stripe ham, LemonSqueezy ham bo'ladimi, buni hozir qilsa bo'ladi. "Haqiqiy checkout" ulanishi keyin, alohida vazifa.

---

## Vazifa B — ZXP build + imzolash quvuri (✅ ASOSAN BAJARILGAN — faqat test)

> **Yangilanish:** `build-zxp.sh` allaqachon mavjud (HANDOFF qator 254/393, commit `6a7057a`) — ZXPSignCmd auto-detect, self-signed sertifikat, stage + imzolash bor. Quyidagi reja **tarixiy/ma'lumot uchun** qoldirildi; real qoladigan ish — pastdagi "Qolgan ish".

### Muammo (kodda tasdiqlangan)
- CEP plagin xom HTML/JS/JSX; `package.json` build "kerak emas" deydi.
- Faqat `scripts/install-cep.sh` bor — bu **dev-only** (PlayerDebugMode talab qiladi, fayllarni qo'lda ko'chiradi).
- Imzolangan ZXP yo'q → **oxirgi foydalanuvchi plaginni o'rnata olmaydi**. Bu raqobat emas, oddiy distribusiya blokeri.

### Yondashuv: minimal yo'l (ZXPSignCmd + self-signed .p12)
Hisobot Bolt CEP migratsiyasini tavsiya qiladi, lekin u 1-3 haftalik katta ish. 0-bosqich uchun **minimal yo'l** to'g'ri: mavjud xom fayllarni o'zgartirmasdan imzolangan ZXP chiqaramiz. Bolt CEP'ni keyin (1-bosqichda) alohida ko'rib chiqamiz.

### Yangi fayllar
1. **`plugins/after-effects-cep/scripts/build-zxp.sh`** — quvur:
   - `dist/` papkaga kerakli fayllarni yig'ish (`CSXS/manifest.xml`, `*.html`, `assetflow-*.js`, `js/`, `jsx/`) — `.debug` va dev artefaktlarsiz.
   - Self-signed sertifikat yo'q bo'lsa yaratish: `ZXPSignCmd -selfSignedCert ...` → `cert.p12`.
   - Imzolash: `ZXPSignCmd -sign ./dist ./AssetFlow.zxp cert.p12 <pass>`.
   - Natija: `plugins/after-effects-cep/AssetFlow.zxp`.
2. **`plugins/after-effects-cep/scripts/.gitignore`** (yoki root'ga qator) — `*.p12`, `*.zxp`, `dist/` ni git'dan chiqarish (sertifikat/parol commit qilinmasin).
3. **`plugins/after-effects-cep/package.json`** — `"build": "bash scripts/build-zxp.sh"` skripti qo'shish (hozirgi echo o'rniga).

### Production manifest tuzatishi (B bilan birga)
- `CSXS/manifest.xml` — Admin extension'da `--disable-web-security` bor. Imzolangan/tarqatiladigan buildda buni **olib tashlash** kerak (dizayn hisoboti ham flagga olgan). Brauzer Admin baribir ishonchliroq.
- `.debug` faylni ZXP ichiga **qo'shmaslik** (faqat dev).

### Ehtiyojlar (foydalanuvchidan)
- `ZXPSignCmd` (Adobe) — macOS'ga o'rnatilishi kerak. O'rnatilmagan bo'lsa, skript aniq xabar berib, yuklab olish havolasini ko'rsatadi.
- Sertifikat paroli — `.env`dan yoki interaktiv so'raladi (commit qilinmaydi).

### Tekshirish
- `bash scripts/build-zxp.sh` → `AssetFlow.zxp` hosil bo'lishi.
- `unzip -l AssetFlow.zxp` → `META-INF/signatures.xml` borligi (imzo isboti).
- (Qo'lda, AE'siz tekshirib bo'lmaydi) — ZXP installer / `aescripts` bilan o'rnatish foydalanuvchi tomonidan.

### Risk
O'rta. Asosiy bog'liqlik — `ZXPSignCmd` mavjudligi (men buni avtomatlashtira olmayman, lekin skript uni tekshiradi). Self-signed sertifikat foydalanuvchida "noma'lum nashriyot" ogohlantirishi beradi — bu normal, keyin haqiqiy sertifikat sotib olinadi.

### ✅ Qolgan ish (faqat shu)
1. `bash plugins/after-effects-cep/scripts/build-zxp.sh` ishga tushirib `.zxp` hosil bo'lishini ko'rish.
2. `.zxp`ni AE'da (yoki ZXP-installer bilan) o'rnatib, panel ochilishini tasdiqlash.
3. (Ixtiyoriy) Admin extension'dan `--disable-web-security` olib tashlanganini tekshirish.

---

## Vazifa C — CORS/URL holatini tasdiqlash (tekshirish, ~15 daq)

HANDOFF (qator 403) klient fayllarni `assetflow-20j.pages.dev`ga ko'chirган, lekin `render.yaml`da `CORS_ORIGIN`/`ADMIN_URL` hali `assetflow-studio-one.vercel.app`.

### Qadamlar
1. **Render dashboard**'da `CORS_ORIGIN`/`ADMIN_URL` haqiqiy qiymatini ko'rish — ehtimol u yerda `pages.dev`ga override qilingan (shunda muammo yo'q).
2. Agar dashboard ham eski bo'lsa → `render.yaml` + dashboard'ni `assetflow-20j.pages.dev`ga moslash.
3. CORS handler allaqachon vergulli-ro'yxat va wildcard'ni qo'llaydi (HANDOFF qator 276) — kerak bo'lsa ikkala domenni qo'shsa bo'ladi.

### Risk
Past. Faqat konfiguratsiya; kod tegmaydi.

---

## Taklif qilinadigan ketma-ketlik (yangilangan)
1. **Vazifa A** (10 daq, kritik, real yangi ish) — darhol.
2. **Vazifa C** (15 daq, tekshirish) — CORS holatini tasdiqlash.
3. **Vazifa B qolgan ish** (test) — `build-zxp.sh`ni ishga tushirib AE'da sinash.
4. Hammasidan keyin `docs/SESSION-REPORT.md`ni yangilash.

AI Tools (3-bosqich) hali ochiq — poydevor (0+1) mustahkamlangach qaytamiz.
