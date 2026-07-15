# Preset tizimi — 100% to'g'ri ishlash rejasi (direktor plani, 2026-07-14)

Printsip: **natijani model beradi (probabilistik), ishonchni TIZIM beradi (deterministik).**
Biz 4 qatlamni 100% qilamiz: (1) ulanish, (2) prompt sifati, (3) pul/xato oqimi, (4) UX.
Model chiqargan natija sifatini esa test-jarayon + arzon preview + refund bilan boshqaramiz.

---

## 1-QATLAM. To'g'ri ulanish — "preset = kod emas, VALIDATSIYALANGAN ma'lumot"

Har preset bitta JSON yozuv, qat'iy sxema bilan:

```jsonc
{
  "id": "cam-earth-zoom-out",
  "category": "video-camera",
  "modelId": 3102,                    // gen-models.ts dagi mavjud model
  "uxTemplate": "card-1-image",       // 4 shablondan biri
  "labels": { "uz": "Earth Zoom Out", "en": "Earth Zoom Out" },
  "promptTemplate": "Camera rapidly pulls back from {subject}...",
  "promptVersion": 3,                 // har o'zgarish yangi versiya
  "params": { "resolution": "720p", "duration": 5, "ratio": "adaptive" },
  "constraints": "no subtitles, no logo, no twin duplicates",
  "exampleAssetUrl": "...",           // kartadagi namuna video
  "enabled": true,                    // per-preset kill-switch
  "minSuccessRate": 0.8               // pastga tushsa avto-ogohlantirish
}
```

**Qoidalar (gen-models-validate naqshi — allaqachon bor):**
- Katalog server startida validatsiya qilinadi: modelId mavjudmi, uxTemplate ro'yxatdami, promptTemplate'dagi {o'zgaruvchilar} uxTemplate inputlariga mosmi. Xato bo'lsa server KO'TARILMAYDI — buzuq preset production'ga chiqa olmaydi.
- Preset promptni FOYDALANUVCHI EMAS, server quradi (client faqat preset id + fayllar yuboradi) — prompt buzilishi/spoofing mumkin emas. Narx allaqachon imzolangan quote bilan himoyalangan ✅.
- Har preset'da `enabled` — muammo chiqsa 1 sekundda o'chiriladi, deploy kerak emas.

## 2-QATLAM. Prompt sifati — "golden test" jarayoni

Hech bir preset testsiz chiqmaydi. Har preset uchun:

1. **Retsept yozish** — Element/ prompt guide formulalari asosida (kamera lug'ati, cheklov bloki, `（）<>{}` sintaksis).
2. **Golden test** — 10 xil turdagi input bilan yugurtiriladi (portret/mahsulot/logo/landshaft/past sifatli rasm...). Arzon rejimda: 480p, 4s — bitta preset testi ~$1-2.
3. **Baholash** — oddiy jadval: natija kutilganidek? subtitle-leak bormi? egizak bugi? uslub buzilishimi? **8/10 dan past — chiqmaydi**, prompt qayta yoziladi (promptVersion++).
4. **Namuna tanlash** — eng yaxshi natija kartaning example videosi bo'ladi (foydalanuvchi nimani kutishni KO'RIB turadi — bu UX'ning yarmi).
5. **Muzlatish** — o'tgan prompt o'zgartirilmaydi; o'zgartirish = yangi versiya = qayta golden test.

Bu ish uchun kichik ichki CLI yetadi: `node scripts/preset-test.mjs cam-earth-zoom-out` — 10 input, natijalar papkaga, ko'z bilan ko'rib baho qo'yiladi. (Kelajakda seed-2-0-mini bilan avto-baholash ham mumkin.)

## 3-QATLAM. Pul va xato oqimi — allaqachon 90% tayyor

Mavjud tizim ✅: imzolangan quote → atomik kredit yechish → xatoda avto-refund → stuck-reconciler → provider-cost ledger. Qo'shimchalar:

- **`expired` status fix** (BYTEPLUS-ANALYSIS topilmasi) — shart.
- **Moderation xatosi odamchasiga:** "Rasmda real yuz bor — bu model qabul qilmaydi. Stilizatsiya qilingan rasm bilan urinib ko'ring" + kredit qaytdi belgisi. Hech qachon "Error 400".
- **Har failed generatsiyada UI'da 3 narsa:** nima bo'ldi (sodda tilda) · kredit qaytdimi (ha/yo'q va nima uchun) · nima qilish kerak (retry/boshqa rasm/support).
- **Draft-first arzon yo'l:** qimmat presetlar (1080p+, uzun) uchun "Avval 480p'da ko'rish — 3 kredit" tugmasi default taklif qilinadi. Foydalanuvchi katta kreditni ko'r-ko'rona kuydirmaydi → ishonch.

## 4-QATLAM. UX — "3 soniya qoidasi"

Foydalanuvchi kartaga qarab 3 soniyada tushunishi kerak: nima chiqadi, nima berishim kerak, qancha turadi.

**Har kartada majburiy 4 element:**
1. Namuna video/rasm (hover'da o'ynaydi) — "nima chiqadi"
2. Nom (o'zbekcha, natija nomi: "Portlash", "Logo ochilishi")
3. Kerakli input belgisi (1 rasm / 2 rasm / matn)
4. Narx kreditda + taxminiy vaqt ("~75 kredit · ~2 daq")

**Generatsiya paytida:** bosqichli status ("Navbatda → Yaratilmoqda → Yuklanmoqda") + real progress-taxmin. Hech qachon jim spinner.

**Natijadan keyin:** Preview → "AE'ga qo'shish" (bitta tugma) → yoqmasa "Qayta urinish" (o'sha seed'siz) yoki "Sozlab qayta" (duration/resolution ochiladi). Advanced sozlamalar DEFAULT YASHIRIN — 90% foydalanuvchi hech qachon ochmaydi.

**Onboarding:** birinchi kirishda 3 ta "bepul sinov" preset (arzon 480p) — foydalanuvchi tizimni xavfsiz his qiladi.

## 5-QATLAM. Chiqarish jarayoni va nazorat

1. **Bosqichli rollout:** ichki test (biz) → 5-10 beta foydalanuvchi (flag bilan) → hammaga. Birinchi to'lqin faqat 10-12 eng ishonchli preset — 45 tasini birdan EMAS.
2. **Telemetriya (per-preset):** muvaffaqiyat %, refund %, retry %, o'rtacha vaqt, ishlatilish soni. Haftalik jadval: qaysi preset yashaydi, qaysi o'chiriladi.
3. **Avto-signal:** preset muvaffaqiyati minSuccessRate'dan tushsa — adminga xabar + zarur bo'lsa enabled=false.
4. **Trend Copy galereyasi kuratsiya bilan:** faqat biz test qilgan trend videolar — foydalanuvchi o'zi yuklagani "tajriba rejimi" deb belgilanadi (kutilma boshqariladi).

## Qabul mezonlari (Definition of Done — har preset uchun)

- [ ] JSON sxema validatsiyadan o'tdi (server boot testi)
- [ ] Golden test ≥ 8/10
- [ ] Namuna video tayyor va kartaga qo'yildi
- [ ] O'zbekcha nom + input belgisi + narx ko'rinadi
- [ ] Moderation/xato xabarlari sodda tilda tekshirildi
- [ ] Telemetriya hodisalari yozilyapti
- [ ] Kill-switch ishlashi tekshirildi

---
*Xulosa: model natijasiga "100%" va'da bermaymiz — buning o'rniga foydalanuvchiga 100% halol tizim beramiz: ko'rib tanlaydi (namuna), arzon sinaydi (draft), xatoda puli qaytadi (refund), har karta chiqishdan oldin 10 marta test qilingan (golden). Higgsfield/Kling ham aynan shu formula bilan ishlaydi.*
