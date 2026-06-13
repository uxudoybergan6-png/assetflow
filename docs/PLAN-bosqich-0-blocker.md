# 0-bosqich — Blocker tuzatishlar (implementatsiya rejasi)

*Manba: AssetFlow Texnik Strategiya + Dizayn hisoboti (2026-06-13). Kod tahlilida tasdiqlangan.*
*Holat: REJA — tasdiqdan keyin kod yoziladi.*

Ikkala hisobot ham bir xil "0-bosqich = blocker" deydi: bularsiz na o'rnatish, na to'g'ri daromad ishlaydi. Ikki vazifa, ikkalasi ham kichik diff, kam risk.

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

---

## Vazifa B — ZXP build + imzolash quvuri (BLOCKER, ~yarim kun)

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

---

## Yo'l bo'yidagi kuzatuv (0-bosqich emas, lekin qayd)
- `render.yaml`da `CORS_ORIGIN`/`ADMIN_URL` → `assetflow-studio-one.vercel.app`, lekin `CLAUDE.md` Studio'ni `assetflow-20j.pages.dev` (CF Pages) deydi. **Ikkisi mos kelmaydi** — deploy paytida CORS xatosi berishi mumkin. Blocker'dan keyin tekshirish kerak.

---

## Taklif qilinadigan ketma-ketlik
1. **Vazifa A** (10 daq, kritik) — darhol.
2. **Vazifa B** (yarim kun) — keyin.
3. Har ikkisidan keyin `docs/SESSION-REPORT.md`ni yangilash.

AI Tools (3-bosqich) hali ochiq — poydevor (0+1) mustahkamlangach qaytamiz.
