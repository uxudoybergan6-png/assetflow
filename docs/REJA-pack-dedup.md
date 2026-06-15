# REJA — pack.zip dublikati / "to'liq pack" strategiyasi (tahlil + tavsiya)

**Holat:** tahlil. KOD YOZILMAGAN. Tasdiqdan keyin implementatsiya.
**Sana:** 2026-06-14

---

## ✅ QAROR: Variant 1 (2026-06-14)

**pack.zip DOIM saqlanadi. Stream-zip endpoint qo'shilMAYDI. Kod o'zgarmaydi.**

Sabab: egress'ni asraydi (Render 5GB cap = kam resurs) — pack/per-scene .mogrt
hozir 302 signed R2 orqali, Render egress 0. Stream-zip buni qaytarardi. R2 storage
arzon va hozir muammo emas, A-turidagi zip↔mogrt/ dublikati — ongli, to'g'ri savdo.
Faqat keyinchalik R2 storage haqiqiy bottleneck bo'lsa, sof A turi uchun qayta ko'riladi.

---

## 1) Upload / extract oqimi — NIMA ajratiladi, zip'da NIMA qoladi

Manba: `apps/api/src/lib/mogrt-extract.ts`, `apps/api/src/routes/contributor.ts`
(`storeMogrtScenesFromZip`, upload route ~797, re-extract route ~490).

Pack ZIP yuklangach (`extractMogrtsFromZip`):

1. `unzip -Z1` bilan zip ichidagi **faqat `.mogrt`** entry'lar ro'yxatlanadi
   (`__MACOSX`, `._` axlati filtrlanadi).
2. Har `.mogrt` uchun:
   - `.mogrt` faylning o'zi → `templates/<id>/mogrt/<slug>.mogrt` (disk + R2).
   - `.mogrt` ichidan `definition.json` (nom) + `thumb.png`/`thumb.mp4` →
     `templates/<id>/scenes/<slug>.png|.mp4` (disk + R2).
3. `metaJson.scenes` yangilanadi (slug, previewKey, mogrtKey).
4. **Asl `pack.zip` R2'da o'zgarishsiz saqlanadi** (`templates/<id>/pack.zip`),
   DB'ga `fileName`/`fileSize` yoziladi.

**MUHIM:** ekstrakt `.mogrt` dan boshqa HECH NIMANI olmaydi. Zip ichidagi
`.aep` loyiha fayli, `footage/` media, shriftlar, README — **hech qachon
ajratilmaydi**, faqat pack.zip ichida qoladi.

## 2) "To'liq pack" = faqat mogrt/scenes yig'indisimi?

**YO'Q — packlar bir xil emas.** Hal qiluvchi dalil plugin import oqimida
(`plugins/after-effects-cep/assetflow-catalog.js:899-928`):

> Zip ochilgach **avval `.aep` qidiriladi** (`findAepInDir`) → topilsa o'sha
> import qilinadi. **Faqat `.aep` bo'lmasa** `.mogrt`'larga tushadi.

Demak ikki xil pack mavjud:

| Tur | Zip ichida | Ekstrakt natijasi | Import yo'li |
|-----|-----------|-------------------|--------------|
| **A — mogrt-only** | faqat `.mogrt` fayllar | mogrt/ + scenes/ TO'LIQ | .mogrt import |
| **B — .aep pack** | `.aep` + footage (+ ehtimol .mogrt) | mogrt/scenes QISMAN yoki BO'SH | **.aep import** |

- **A turi:** `mogrt/` papkasi zip ichidagi har `.mogrt`'ning nusxasi →
  zip va mogrt/ **dublikat**. mogrt/ dan zipni qayta yig'ish mumkin (funksional).
- **B turi:** `.aep` va footage **hech qayerga ajratilmagan** → pack.zip ularning
  **yagona nusxasi**. Zip o'chirilsa, asosiy import yo'li (.aep) **buziladi**.

Server pack turini oldindan kafolatlay olmaydi (kontributor xohlaganini yuklaydi).

## 3) Agar pack FAQAT mogrt/scenes bo'lsa — reja (FAQAT A turi)

Stream-zip endpoint `mogrt/` ni on-demand zip qilib berardi, downloadAll shunga
ulanardi, pack.zip R2'dan o'chirilardi.

## 4) Agar zip'da qo'shimcha fayllar bo'lsa — zip saqlanadi (B turi)

`.aep`/footage'ni qayta yarata olmaymiz → zip o'chirib bo'lmaydi. A turida
zip↔mogrt/ dublikati muqarrar.

---

## ⚠️ Egress regressiyasi — eng muhim e'tibor

`/docs/SESSION-REPORT` dagi tuzatish maqsadi: **Render egress = 0** (hamma asset
to'g'ridan R2 / signed R2 URL orqali, Render orqali stream EMAS). Hozir:
- pack.zip yuklab olish → 302 **signed R2** URL → Render egress 0.
- per-scene `.mogrt` (M2) → 302 R2 → Render egress 0.

**Stream-zip endpoint MAJBURAN baytlarni Render orqali o'tkazadi** (bir nechta
R2 obyektni bitta zip oqimiga yig'ish — 302 redirect mumkin emas). Ya'ni 3-banddagi
reja har "to'liq pack" yuklab olishini Render egress'iga qaytaradi — biz hozirgina
bartaraf etgan aynan o'sha xarajat. Resurs ustuvorligi: **Render egress = kam/cheklangan
(5GB cap), R2 storage = arzon/keng.** Dublikat — to'g'ri tanlov: kam resursni asraydi.

R2 storage hozircha muammo sifatida ko'rsatilmagan (faqat Render bandwidth tugagandi).
Demak bu dedup — profilaktik, va u eng muhim metrikani (egress) buzadi.

---

## Xulosa

- Packlar **aralash**: A (mogrt-only, dublikat bor) va B (.aep+footage, yagona nusxa zip).
- Server turlarni kafolatlay olmaydi → **umumiy holatda pack.zip o'chirib bo'lmaydi** (4-band).
- A turida ham stream-zip reja egress'ni qaytaradi (regressiya) — storage'ni egress'ga almashtiradi,
  bu noto'g'ri savdo (egress = kam resurs).

## Tavsiya — **Variant 1 (konservativ): pack.zip DOIM saqlansin**

- Hech narsa o'chirilmaydi, stream-zip qo'shilmaydi. Egress = 0 saqlanadi.
- A turidagi dublikatni hujjatlash (CLAUDE.md / bu fayl) — bilib turilgan, ataylab qilingan savdo.
- Agar keyinchalik **R2 storage** haqiqiy muammoga aylansa, faqat shunda:
  upload'da zip tarkibini aniqlash (`.aep`/media bormi?) → **faqat sof A turi** uchun
  zipni o'chirib, stream-zip'ga o'tish (egress narxini ongli qabul qilgan holda).
  Hozir tavsiya etilmaydi.

**Keyingi qadam:** tasdiqlang — Variant 1 (faqat hujjatlash, kod o'zgarmaydi) yoki
shartli optimizatsiya (A turi uchun stream-zip, egress savdosi bilan)?
