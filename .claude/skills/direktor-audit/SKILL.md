---
name: direktor-audit
description: FrameFlow muammolarini direktor nazari bilan audit qilish. Foydalanuvchi muammoni birin-ketin aytganda ishlatiladi — har bandni kodda tekshirish, yashirin bog'liq muammolarni topish, mustaqil ravishda qo'shimcha muammo aniqlash va natijani `docs/DIREKTOR-AUDIT-<sana>.md` ga yozish. Trigger: "muammo", "audit qil", "buni tekshir", "yana nima bor", yoki foydalanuvchi ketma-ket muammo sanay boshlaganda. Tuzatish YOZMAYDI — faqat ro'yxat.
---

# Direktor audit

Foydalanuvchi (loyiha egasi) muammolarni birin-ketin aytadi. Sen ularni audit qilasan,
atrofidagi ko'rilmagan muammolarni topasan, direktor sifatida mustaqil topilmalar
qo'shasan va MD faylga yozasan.

## Asosiy qoida

**Kod = haqiqat manbai.** Foydalanuvchi aytgan muammo tavsifi — gipoteza, tasdiq emas.
Har bandni faylni o'qib tekshir. Grep natijasi yetarli emas — bog'liq zanjirni o'qi.

## 0-qadam: Kirish normalizatsiyasi

Foydalanuvchi muammoni ko'pincha oddiy, tartibsiz tilda aytadi ("bosilmayapti", "chiqmayapti",
"noto'g'ri"). Auditni boshlashdan oldin buni o'zing tuzilgan shaklga o'tkaz — foydalanuvchidan
qayta so'ramay, kontekstdan (loyiha bilimi + oldingi xabarlar) to'ldir:

- **Nima:** qaysi amal/ekran/tugma
- **Qayerda:** web / plagin / admin / contributor studio
- **Kutilgan vs. haqiqiy:** nima bo'lishi kerak edi, nima bo'ldi
- **Aniq bo'lmasa:** taxminni yoz va davom et — "taxmin: X ekranidagi Y tugmasi" — audit
  natijasida taxmin noto'g'ri chiqsa, 5-qadamda tuzatiladi. Auditni ushlab turmaydi.

Bu ichki qadam — foydalanuvchiga qayta savol sifatida ko'rsatilmaydi, faqat MD banddagi
**"Egasi aytdi"** qatoridan keyin **"Tushunilgan sifatida"** qatorida yoziladi.

## 🗂 To'plash rejimi (default)

**Sabab:** har muammoni darhol to'liq audit qilish (kod o'qish + jonli tekshiruv) vaqt oladi va
suhbatni sekinlashtiradi. Shuning uchun endi **default — avval to'plash, keyin ketma-ket
to'liq audit**. Parallel/subagent audit ATAYLAB ishlatilmaydi — limit ko'p yeydi (har subagent
faylni qaytadan o'qiydi); ketma-ket (bitta kontekstda) eng kam limit sarflaydi.

**To'plash bosqichi** — foydalanuvchi muammo aytganda:
- Faqat **yengil qayd** qil: Egasi aytdi (so'zma-so'z) + 0-qadam normalizatsiya (Nima/Qayerda/
  Kutilgan-vs-haqiqiy, taxmin bilan). **Fayl o'qima, grep qilma, brauzer tekshirma.**
- Navbatga qo'sh: `Q1`, `Q2`, ... (vaqtinchalik ID, hali `docs/DIREKTOR-AUDIT-<sana>.md`ga
  yozilmaydi — faqat javobda qisqa tasdiqlab qo'y: "Qayd etildi — Q3. Keyingisi?").
- Har qaydda 7a (shu sessiya ichida takror) yuzaki tekshiruvi qilinadi (so'z shaklidan emas,
  taxminiy ildizdan) — aniq takror ko'rinsa darhol aytib qo'y, aks holda audit bosqichida
  aniqlanadi.

**Trigger — audit boshlash:** foydalanuvchi "hammasi shu", "tugadi", "boshla", "audit qil"
kabi signal bersa (yoki mavzu butunlay o'zgarsa) — navbatdagi barcha `Q`larni **ketma-ket**
(bitta-bittalab, parallel emas) to'liq 9-qadamli auditdan o'tkaz, har birini `D<N>` sifatida
`docs/DIREKTOR-AUDIT-<sana>.md`ga yoz. Navbat tugagach bo'shatiladi.

**Istisno:** foydalanuvchi bitta muammoni aytib darhol "tekshir"/"audit qil" desa yoki faqat
bitta muammo bo'lsa — navbatga qo'ymay, shu zahoti to'liq audit qilinadi (to'plash uchun
kutish shart emas).

## 9 qadam

Har muammo shu tartibda o'tadi:

### 1. Audit
Kodda tekshir: haqiqatan bormi, qaysi fayl:qator, ildiz sabab nima.
Foydalanuvchi ko'rgan simptom bilan ildiz sabab ko'pincha boshqa joyda bo'ladi.

### 2. Yashirin atrof
Shu **ildizdan** chiqadigan boshqa bandlar. Savol: "bu xato yana qayerda takrorlanadi?"
Odatiy naqsh — bir xil bug web + plagin + admin uchtasida ham bor.

### 3. Direktor nazari
O'sha zonada mustaqil qidir. Doimiy tekshiriladigan o'qlar:
- 💰 pul (kredit yechish, refund, quote imzosi, marja, hovuz)
- 🔗 zanjir (upload → moderatsiya → katalog → plagin import)
- 🔒 xavfsizlik (auth yo'q endpoint, IDOR, sizib chiquvchi maydon)
- 📈 miqyos (N+1, paginatsiyasiz `findMany`, katta JSON javob, OOM)
- 👤 UX (yolg'on muvaffaqiyat xabari, o'lik tugma, dev matni prod'da)

### 4. MD faylga yozish
`docs/DIREKTOR-AUDIT-<YYYY-MM-DD>.md`. Format pastda.

### 5. Soxta topilma filtri
Muammo tasdiqlanmasa — **ochiq yoz**: "tasdiqlanmadi; aslida sabab X".
Ro'yxatni shishirma. Auditda eng qimmat xato — yo'q joyga band yozish.

### 6. 💰 Pul bayrog'i
Kredit/quote/refund/marjaga tegadigan har band `💰 PUL` deb belgilanadi va
**"web + plagin ikkalasida bir vaqtda"** eslatmasi qo'shiladi.
Bir tomonlama tuzatish = real zarar. Imzolangan-quote va atomik-guard naqshiga TEGMA.

### 7. Takror tekshiruvi
Ikki bosqichda tekshir — foydalanuvchi bir muammoni ikki marta (boshqacha so'z bilan) aytishi
tabiiy holat, buni ushlash shart:

**7a. Shu sessiya ichida** — avval joriy `docs/DIREKTOR-AUDIT-<sana>.md` faylidagi mavjud
D-bandlar bilan solishtir (ildiz sabab va fayl:qator bo'yicha, so'z shakli emas). Bir xil bo'lsa:
- YANGI ID ochma
- Mavjud bandga qayt: `**Takror eslatildi:** ha — D3 bilan bir xil (foydalanuvchi 2 marta aytdi)`
- Agar yangi tafsilot qo'shsa (masalan aniqroq qayerda), o'sha bandning "Egasi aytdi" qatoriga qo'shib qo'y, ID o'zgarmaydi

**7b. Tashqi manbalar bilan** — `docs/TUZATISH-MASTER-ROYXAT.md` va
`~/.claude/projects/-Users-usmonov-Projects-creative-tools-saas/memory/MEMORY.md` bilan solishtir:
- `[YANGI]`
- `[MASTER'da bor: M3]`
- `[REGRESS — avval tuzatilgan]` ← eng muhimi; sabab boshqa, qayta tekshir

### 8. Tuzatish YO'Q
Faqat ro'yxat. Kodga tegish alohida buyruq bilan.
Sabab: ro'yxat to'liq bo'lmaguncha tuzatish tartibi noto'g'ri chiqadi — bir band ikkinchisini bekor qiladi.

### 9. "Nima buziladi"
Har band oxirida oqibat: **pul / mijoz / ma'lumot / kosmetik**.
Daraja shundan chiqadi, his-tuyg'udan emas.

## Daraja

| Daraja | Ma'no |
|---|---|
| **P0** | Bozorga chiqishni bloklaydi yoki hozir pul yo'qotmoqda |
| **P1** | Mijoz ko'radi / ma'lumot xavf ostida / shu hafta |
| **P2** | Sifat, shu oy |
| **P3** | Kosmetik / keyinroq |

## Kim tuzatadi

- **CC** — kod/konfiguratsiya, repo ichida
- **EGA** — akkaunt, sertifikat, parol, pul, tashqi xizmat, yurist

## MD format

```markdown
# Direktor audit — <sana>

**Manba:** foydalanuvchi hisoboti + kod tekshiruvi
**Holat:** faqat ro'yxat, tuzatish boshlanmagan

---

## D1 · <qisqa sarlavha>  ·  P1 · 💰 PUL · [YANGI]

**Egasi aytdi:** <foydalanuvchi so'zi bilan, oddiy tildagicha>
**Tushunilgan sifatida:** <normalizatsiya: nima/qayerda/kutilgan vs haqiqiy — taxmin bo'lsa "taxmin:" bilan>
**Takror eslatildi:** yo'q / ha — D<N> bilan bir xil, shu yerga qo'shildi
**Kodda tasdiq:** ✅ tasdiqlandi / ❌ tasdiqlanmadi / ⚠️ qisman
**Ildiz sabab:** <bir jumla>
**Fayl:** `apps/api/src/routes/x.ts:120`
**Nima buziladi:** <pul/mijoz/ma'lumot/kosmetik + aniq oqibat>
**Kim:** CC

### Yashirin atrof
- **D1.1** — <bir ildizdan chiqqan band> · `fayl:qator` · P2
- **D1.2** — ...

### Direktor topilmasi
- **D1.a** — <mustaqil topilgan> · `fayl:qator` · P1 · 💰 PUL
```

Oxirida yig'ma jadval: ID · daraja · zona · kim · holat.

## Loyiha konteksti

- Haqiqat manbai: kod + `docs/PROJECT-STATUS.md`. `docs/REJA-*` = kelajak rejasi, bajarilgan deb o'qima.
- Studio manba fayllari: `packages/assetflow-studio/js/` va `styles/` — `studio/js/`, `admin/js/` build artefakti.
- Pul yadrosi: `lib/plugin-profile.ts`, `lib/gen-models.ts`, `routes/studio-gen.ts`.
- Zanjir: `routes/contributor.ts` → admin approve → `lib/catalog-map.ts` → `routes/plugin.ts` → `plugins/after-effects-cep/`.

## Sessiya oxirida

`docs/SESSION-REPORT.md` ni almashtir (maks 15 qator): nima auditga tushdi, nechta band,
nechtasi tasdiqlanmadi, keyingi qadam.
