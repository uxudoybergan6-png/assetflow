# AI Provayder qarori — tadqiqot va holat

> **HOLAT: TO'XTATILGAN (paused).** Hozircha provayder olinmaydi/o'zgartirilmaydi.
> Avval foydalanuvchi/daromad yig'iladi, keyin provayder qaroriga qaytiladi.
> Sana: 2026-06-21. Manba: web tadqiqot (fal.ai, Replicate, Magnific, stock API'lar).

## Kontekst
Maqsad edi: zaif Studio Gen AI ni almashtirish + assets (stock) muammosini hal qilish.
Avval Magnific ko'rib chiqildi → 3 ta jiddiy muammo topildi (pastda). Qaror: hozircha to'xtatish.

---

## ⚠️ 3 ta kritik topilma (qaytganda eslab qol)

### 1. Magnific stock'ni QAYTA SOTIB BO'LMAYDI
Magnific Terms of Use: *"not authorized to distribute, resell or rent any Magnific content (or any modification)"* + stock product/library uchun ishlatish taqiqlangan. Ya'ni "stock assets'ni foydalanuvchilarga sotish" modeli Magnific bilan **qonuniy ishlamaydi** (€132 to'lasa ham).

### 2. Magnific Business — resell API uchun emas
Magnific docs: Business = veb-platforma + jamoa hamkorligi; API/resell uchun **Enterprise** kerak. Business noto'g'ri tarif.

### 3. Magnific qimmat + pay-per-use 30-iyunda tugaydi
- Business min **2 seat = €118/oy + soliq = ~€132/oy** (90K kredit SHARED, per-user emas).
- Pay-per-use API 2026-06-30 da o'chadi → faqat Business/Enterprise qoladi.

---

## 💰 Narx solishtiruvi (2026-06)

| Provayder | Rasm | Video (i2v) | Upscale | Oylik min |
|---|---|---|---|---|
| **fal.ai** | $0.025/rasm (FLUX dev), $0.05 (Pro) | $0.07/s (Kling 2.6 Pro) | $0.03/MP (Clarity), $0.004/img (Recraft) | **$0** |
| **Replicate** | $0.003 (schnell), ~$0.03 (dev), ~$0.055 (Pro) | $0.07/s (Kling) | ~$0.002–0.02/img | **$0** |
| **Magnific Business** | ~€132/oy fiks, 90K shared kredit | kredit | kredit | **~€132/oy** |

**Tenglashish:** pay-per-use ~5,000 rasm/oy yoki ~400 video/oy gacha arzonroq.
Erta bosqich (1,000 rasm + 100 video ≈ ~$60/oy) → pay-per-use yarmidan arzon, foydalanuvchisiz oyда $0.

---

## 🚨 Stock resell — hal qilinmagan litsenziya muammosi
Xom stock'ni foydalanuvchilarga qayta sotish **hech bir arzon/bepul API'da ruxsat etilmaydi**:
- **Pexels / Pixabay** — faqat "yangi ish yaratilsa" (xom faylni berib sotish = taqiq).
- **Freepik / Magnific** — butunlay taqiq.
- Xom stock sotish uchun → **redistribution-litsenziyali provayder** (Shutterstock/Getty/Adobe Stock API + sublicense shartnoma) kerak.
- Muqobil: **AI yaratgan assets sotish** (o'z AI natijalaringni sotish odatda OK — faqat model litsenziyasini tekshir: FLUX dev = non-commercial, FLUX Pro/schnell = commercial).

---

## ✅ Qaytganda tavsiya (saqlangan)
1. **AI tools** → fal.ai (asosiy) + Replicate (zaxira), pay-per-use. Magnific OLMA (qimmat, resell uchun noto'g'ri).
2. **Integratsiya rejasi provayder-agnostik** (`GEN_PROVIDER` flag + adapter) — `docs/MAGNIFIC-MIGRATION-PLAN.md` dagi arxitektura fal.ai uchun ham ishlaydi (faqat adapter Magnific o'rniga fal.ai).
3. **Stock** → alohida qaror: redistribution-litsenziyali provayder yoki AI-generated assets yo'li.
4. **Magnific'ga o'tish** faqat hajm ~5,000 rasm/oy yoki ~400 video/oy oshganda + API-eligible tarif (Enterprise) tasdiqlangach.

## Tegishli fayllar
- `docs/MAGNIFIC-API-REFERENCE.md` — Magnific API to'liq texnik reference (kelajakda kerak bo'lsa)
- `docs/MAGNIFIC-MIGRATION-PLAN.md` — provayder-agnostik migratsiya rejasi (adapter naqshi fal.ai uchun qayta ishlatiladi)

## Keyingi qadam (qaytganda)
Foydalanuvchi/daromad yetarli bo'lsa → fal.ai adapteri uchun reja promtini yozish (mavjud migration plan'ni fal.ai'ga moslab). Stock litsenziyasini alohida hal qilish.
