# FrameFlow — Kontent Quvuri: To'liq Sxema

*Rejalashtirilgan: 2026-07-08 · Direktor + foydalanuvchi bilan birga*

Bu hujjat — shablon qanday yuklanishi, tekshirilishi, katalogga chiqishi va foydalanuvchiga
yetib borishining to'liq rejasi. Qurishga o'tganda yagona manba shu.

---

## 1. Umumiy oqim

```
Muallif → Cloud papka → Server (ochish + skan + AI) → Admin (tasdiq) → Katalog → Plagin / Web → User
```

Muallif shablon yuklaydi, server uni ochib tekshiradi va AI metadata yozadi, admin tasdiqlaydi,
katalogda paydo bo'ladi, foydalanuvchi (plagin yoki web orqali) yuklab oladi.

---

## 2. Asosiy arxitektura qarori — har dastur o'z formatida

Har shablon **bitta dastur** uchun, **tabiiy formatda**:

- After Effects → `.aep`
- Premiere Pro → `.mogrt`
- (kelajakda) DaVinci Resolve → `.drfx`, Apple Motion → `.motn`

Eski "cross-app aylantirish" (mogrt → aep) **butunlay tashlandi** — u tahrirlash boshqaruvlarini,
shriftlarni va Premiere mosligini buzardi, hamda noto'g'ri comp import qilardi. Endi har dastur
o'z formatini oladi → import **toza va tahrirlanadigan**.

Aralash kontent (ba'zi shablon AE, ba'zisi Premiere) — har biri o'z dasturiga boradi.

---

## 3. Shablon = bitta zip

Bitta **zip = bitta shablon = katalogda bitta karta**. Zip ichida:

- Shablon fayli — `.aep` (yoki dasturga mos format)
- **Preview rasm** — poster uchun (majburiy)
- **Preview video** — harakat uchun (ixtiyoriy)

`.aep` **o'zi-yetarli** bo'lishi kerak: tashqi footage yoki bog'lanmagan media qoldirmaslik
(aks holda import'da "missing media" chiqadi). Shrift masalasi alohida hal qilinadi (10-bo'lim).

---

## 4. Muallif qanday yuklaydi

- Muallif contributor sifatida ro'yxatdan o'tadi → tizim unga cloud bucket'da papka ochadi:
  `incoming/muallif-id/`.
- Muallif saytda o'z bo'limiga kiradi va ziplarni **brauzerda sudrab tashlaydi** (drag-drop,
  ko'pini birdan) → ular to'g'ridan uning bucket-papkasiga yoziladi.
- Papka nomi = muallif id, shuning uchun qaysi zip kimniki — har doim aniq.

---

## 5. Server ingest — yuklangandan keyin avtomat

Har yangi zip uchun tizim ketma-ket:

1. Zipni ochadi.
2. **Malware skan** o'tkazadi (xavfsizlik — majburiy, chetlab bo'lmaydi).
3. Preview (rasm + video) ni ajratib, katalog uchun saqlaydi.
4. `.aep` ni yuklab olish uchun saqlaydi.
5. **Asl yuklangan zipni o'chiradi** (hajm ikki baravar oshmasligi uchun).
6. Shablonni **"pending"** holatida admin navbatiga qo'yadi.

Diskda har shablon = `.aep` + preview rasm + preview video. **Dublikat yo'q.**

---

## 6. AI metadata — avtomat

Zip nomidan kelib chiqib AI yozadi:

- **Nom (title)** — aniq, qisqa.
- **Kategoriya** — tayyor ro'yxatdan bittasi (masalan: Titles, Lower Thirds, Transitions,
  Intros, LUTs…). Filtr aynan shu kategoriyalar bo'yicha ishlaydi, shuning uchun erkin emas —
  ro'yxatdan tanlanadi.
- **Teglar** — 20 ta.

**Orientatsiya va o'lcham** (vertikal / kvadrat / keng · 4K / HD) — preview o'lchamidan
**avtomat** aniqlanadi (masalan 1080×1920 = vertikal).

Admin AI matnini tekshirmaydi — ishonadi.

---

## 7. Admin

- Admin **pending** shablonlarni preview bilan ko'radi.
- **Tasdiqlaydi + Free/Pro belgilaydi** — **ommaviy** (ko'pini birdan) **yoki bitta-bitta**.
- Xohlasa, har qanday maydonni (orientatsiya, kategoriya va h.k.) **o'zgartiradi** — yana
  ommaviy yoki individual.
- Tasdiqlangan shablon katalogda paydo bo'ladi.

---

## 8. Katalog + preview ko'rsatish

- Katalogda **rasm = poster** (doim ko'rinadi), **video** hover yoki bosilganda o'ynaydi.
- Rasm har doim bo'lgani uchun **qora-kadr muammosi yo'q**.
- Har dastur faqat **o'z shablonlarini** ko'radi (filtr dastur bo'yicha).

---

## 9. Yuklab olish — Web va Plagin

Ikkalasi ham server'dagi **bir xil `.aep`** ni oladi, **shablon nomidagi `.zip`** ko'rinishida
(on-the-fly zip, fayl nomi tozalangan, masalan `Glossy-3D-Abstract-Shapes.zip`).

- **Web:** "Download" → `.zip` yuklanadi → foydalanuvchi o'zi AE'da ochadi.
  *(Web = ko'rish + yuklab olish.)*
- **Plagin:** xuddi shu `.zip` → plagin **o'zi ochadi (unzip)** → `.aep` ni **to'g'ridan ochiq
  AE loyihasiga import** qiladi. Foydalanuvchi kerakli kompni **AE Project panelidan** o'zi
  tanlaydi. *(Sahna tanlash mexanizmi yo'q — soddalashtirildi.)*

---

## 10. Font hal qiluvchi — plaginda, 3 bosqichli

Import'dan keyin plagin yetishmagan shriftni aniqlaydi va tartib bilan urinadi:

1. **Adobe Fonts** — shablon Adobe Fonts shriftidan foydalansa, Creative Cloud orqali avtomat
   yoqadi.
2. Bo'lmasa → **Google Fonts / ochiq manbadan** nomidan yuklab o'rnatadi.
3. Topilmasa (pullik maxsus shrift) → **ogohlantirish + ro'yxat** (foydalanuvchi qo'lda
   o'rnatadi — bunisi muqarrar).

Ko'p holatda foydalanuvchi hech narsa qilmaydi.

---

## 11. Ko'p-dastur holati

- **After Effects — birinchi.** Plagin bor → to'liq tajriba: yuklab olish + avtomat import +
  font hal qiluvchi.
- **Premiere / DaVinci / Apple Motion** — hozircha **katalog + yuklab olish** (foydalanuvchi
  qo'lda o'rnatadi). Har biriga to'liq in-app tajriba = alohida plagin (kelajak ishi).

---

## 12. Fazalar (qurish rejasi)

> Umumiy tamoyil: avval **bitta** shablonni mukammal ishlat, keyin **mingtani** quy — aks holda
> xatoni 5000 marta takrorlaysan. Har faza bitta yaxlit bo'lak, bir-birining ustiga quriladi.

**Faza 1 — Yadro: AE native import** *(avval, eng muhim)*
Plagin mogrt→aep aylantirishni tashlaydi; `.aep` zipni yuklab, ochib, to'g'ridan AE loyihasiga
import qiladi. Preview poster fix (rasm = poster). 1-2 test shablon bilan boshdan-oxir tasdiq
(yuklash → tasdiq → plaginda import, tahrirlanadigan, to'g'ri).
*Maqsad: bitta shablon AE'da mukammal ishlasin.*

**Faza 2 — Cloud ingest**
Har muallifga bucket-papka (`incoming/muallif-id/`) + brauzer drag-drop yuklovchi. Server: zipni
ochish + malware skan + preview ajratish + `.aep` saqlash + asl zipni o'chirish + "pending".
Yuklab olish = shablon nomidagi on-the-fly zip.
*Maqsad: kontent miqyosda kirsin.*

**Faza 3 — AI metadata + Admin**
AI zip nomidan nom / kategoriya (ro'yxatdan) / 20 teg yozadi. Orientatsiya va o'lcham preview'dan
avtomat. Admin ommaviy yoki bitta-bitta tasdiq + Free/Pro.
*Maqsad: 5000 tani tez kataloglash va tasdiqlash.*

**Faza 4 — Font hal qiluvchi (plagin)**
3 bosqich: Adobe Fonts yoqish → Google Fonts yuklash → ogohlantirish + ro'yxat.
*Maqsad: import qilingan shablon to'g'ri shrift bilan chiqsin.*

**Faza 5 — Ko'p-dastur (multi-app)**
Dastur fayl-kengaytmasidan aniqlanadi; katalog filtri (har dastur faqat o'zini ko'radi); platforma
badge/filtr; per-app kengaytmalar. Premiere / DaVinci = katalog + yuklab olish.
*Maqsad: aralash kontent to'g'ri ajralsin.*

**Faza 6 — Miqyos + qolgan nuqtalar**
Ko'p zip bilan to'liq test. Dublikat aniqlash, muallif ro'yxatdan o'tish oqimi, storage retention.
*Maqsad: 5000 ga tayyor.*

---

## 13. Hali hal qilinmagan (keyingi rejalashtirishga)

- **Dublikat aniqlash** — bir xil shablon ikki marta yuklansa nima bo'ladi.
- **Muallif ro'yxatdan o'tishi** — contributor bo'lish oqimi (hozir qo'lda / SQL).
- **Storage narxi / retention** — 5000+ shablon hajmini rejalashtirish.
- **Preview video majburiymi**, yoki faqat rasm yetarlimi.
- **Premiere native plagin** — qachon va qanday.
