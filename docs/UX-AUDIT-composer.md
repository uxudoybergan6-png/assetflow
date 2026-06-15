# Composer UX/UI audit — kamchiliklar + tuzatishlar

*Manba: jonli plagin skrinshoti (video gen muvaffaqiyatli) + AI sahifa kodi. 2026-06-15.*
*Holat: funksiya ISHLAYDI ✅, lekin UX sayqal talab qiladi. Foydalanuvchi shikoyati: (1) prompt tahrirlash qiyin, (2) gen'dan keyin holat chalkash.*

---

## 🔴 P0 — ASOSIY (foydalanuvchi aniq shikoyat qildi)

### 1. Prompt textarea — o'qish/tahrirlash qiyin
**Muammo (skrinshotdan):**
- Shrift juda katta (~16px) → uzun prompt 3 qatorda sig'maydi, o'qib bo'lmaydi.
- Enhance tugma (✦, yashil) **scrollbar bilan ustma-ust** tushgan — vizual nuqson.
- Textarea past, uzun prompt uchun ichki scroll → tahrirlash noqulay.

**Tuzatish:**
- Prompt shrifti **13–14px**, `line-height: 1.5`, qulay o'qiladigan.
- Textarea **auto-grow** (matn ko'paysa balandlashadi, masalan 2–8 qator), yoki `min-height` kattaroq + toza scroll.
- Enhance (✦) tugmasini scrollbar'dan ajrat — pastki-o'ng burchakka qo'y yoki textarea ostiga alohida qator.
- `padding` etarli, fokusda chegara (focus ring).

### 2. Generatsiyadan keyingi holat — chalkash
**Muammo:** gen tugagach composer to'ldirilgan holda qoladi, natija **pastda** paydo bo'ladi → foydalanuvchi scroll qilishi kerak, natija va composer aralash.

**Tuzatish:**
- Natija **aniq, prominent** ko'rsatilsin: gen tugagach natija **composer tepasiga** yoki alohida "natija paneli"ga chiqsin (Artlist'dagidek markazda).
- Composer "filled" holatdan chiqsin: prompt saqlanadi, lekin natija ustun bo'ladi.
- Natija ostida aniq amallar: **AE'ga import · Yana (regenerate) · Tahrirlash · Saqlash/sevimli**.
- Gen holati aniq: `Navbatda → Generatsiya qilinmoqda (progress/spinner + matn) → Tayyor`. Video ~daqiqalar olgani uchun **progress indikator** majburiy.

---

## 🟠 P1 — LAYOUT / BO'SH JOY

### 3. Shablonlar karuseli AI rejimда juda ko'p joy egallaydi
**Muammo:** tepadagi "Shablonlar" banneri katta vertikal joy oladi, composer pastga suriladi.
**Tuzatish:** AI rejimida banner **yig'iladigan** (collapse) yoki kichrayadigan bo'lsin; yoki AI panel alohida to'liq ekran. Foydalanuvchi AI bilan ishlaganда shablon banneri chalg'itmasin.

### 4. Natija video juda katta + scroll
**Muammo:** natija pleyeri ekranni to'ldiradi, ko'p scroll.
**Tuzatish:** natija o'lchamini cheklash (max-height), yoki bir nechta natija = **grid**. Aspect ratio'ga moslab (vertikal video → tor).

### 5. Vertikal ritm / zichlik
**Tuzatish:** bo'limlar orasidagi bo'shliqlar muvozanatli; composer va natija aniq ajralgan kartalar.

---

## 🟡 P2 — TARIX / FUNKSIONAL

### 6. Generatsiya tarixi YO'Q (ko'rinmaydi)
**Muammo:** har natija pastda paydo bo'ladi, oldingilari yo'qoladi. Backend'da `StudioGenHistory` + `/gen/sessions/:id/generations` bor, lekin UI'da ko'rinmaydi.
**Tuzatish:** chap/past panelда **tarix grid** (Artlist'dagidek) — har natija thumbnail, bosilganda qayta ko'rish/import. Qayta ishlatish: natijani input qilib olish.

### 7. "Yana generatsiya" / "tahrirlash" oson bo'lsin
**Tuzatish:** natijadан keyin promptni o'zgartirib qayta generatsiya bir bosishda. Hozir composer'ga qaytish noqulay.

---

## 🟢 P3 — MAYDA SAYQAL

8. **Settings label** ("16:9 · 720p · 5s · 🔇") — audio belgisi kichik/noaniq; "Audio o'chiq/yoniq" aniqroq ko'rsatilsin.
9. **"Timeline'dan" tugma** — holati noaniq (bosilganmi/yo'qmi). Faol holatда vizual feedback.
10. **"Shablon uchun" / "Qo'shish"** tugmalari — vazifasi tooltip bilan aniq bo'lsin.
11. **Enhance tugma** ishlaganда holati (loading) ko'rsatilsin.
12. **Bo'sh holat** ("prompt yozing") — Artlist'dagi "Type an idea to get started" kabi chiroyli bo'sh holat.

---

## TUZATISH TARTIBI (ustuvorlik)
1. **P0-1** Prompt textarea (shrift/auto-grow/enhance joyi) — eng tez foyda
2. **P0-2** Gen'dan keyingi holat (natija prominent + progress + amallar)
3. **P1-3,4,5** Layout (banner collapse, natija o'lcham, ritm)
4. **P2-6,7** Tarix grid + qayta-gen
5. **P3** Mayda sayqal

---

## CLAUDE CODE PROMPTI (P0 — eng muhim, avval shu)

```
Composer UX sayqal — P0 (foydalanuvchi shikoyati). Reja: docs/UX-AUDIT-composer.md.
Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html #aiPage. Faqat CSS+JS, funksiya ishlaydi — buzma.

1. PROMPT TEXTAREA (#aiPrompt):
   - shrift 13-14px, line-height 1.5, o'qiladigan.
   - auto-grow: matnga qarab balandlashsin (min ~2 qator, max ~8 qator), keyin toza scroll.
   - Enhance tugma (✦) scrollbar bilan ustma-ust TUSHMASIN — joyini o'zgartir (textarea pastki-o'ng yoki alohida).
   - fokusda chegara (focus ring).

2. GEN'DAN KEYINGI HOLAT:
   - Natija (rasm/video/audio) PROMINENT ko'rsatilsin — composer tepasida yoki natija paneli, scroll'siz ko'rinsin.
   - Gen holati aniq: Navbatda → Generatsiya qilinmoqda (spinner/progress + matn) → Tayyor.
     Video ~daqiqa olgani uchun progress indikator MAJBURIY (aiPollJob holatini ko'rsat).
   - Natija ostida amallar: AE'ga import · Yana (regenerate, o'sha params) · Tahrirlash (composer'ga qaytish).

Dizayn: dark/glass, tokens.css, o'zbekcha. Funksiya/param oqimini O'ZGARTIRMA.
Tekshiruv: node --check inline JS; install-cep; AE'da prompt tahrirlash + gen holati + natija ko'rinishi.
Tugagach commit+push yoki to'xta.
```

(P1–P3 keyingi promptlarda — P0 tasdiqlangach.)

---

*Audit: skrinshot + kod, 2026-06-15. Funksiya ishlaydi; bu faqat UX sayqal.*
