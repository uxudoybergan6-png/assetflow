# Image + Video modellar — eng arzon manba (2026-06)

So'ralgan modellar uchun **eng arzon olish joyi**. Narxlar USD, 2026-iyun. ⚠️ = ishonchsiz/tez o'zgaruvchan, ishlatishdan oldin rasmiy sahifadan tasdiqlang. Aggregator narxlari (EvoLink, Kie.ai, PiAPI, PoYo) ko'pincha vendorning o'z marketing sahifasidan olingan.

---

## 🖼️ IMAGE modellar

| Model | Eng arzon manba | Narx/rasm | Bepul tier | Izoh |
|-------|-----------------|-----------|-----------|------|
| **Nano Banana** (Gemini 2.5 Flash Image) | **Google AI Studio** (to'g'ridan) | **$0.039** | ✅ **~500 rasm/kun bepul** | Aggregatorlar ham $0.039, lekin faqat Google'da bepul tier bor. Aggregator shart emas |
| **Nano Banana 2** (Gemini 3.1 Flash Image) | **Google Batch API** (async) | **$0.022** | ⚠️ kam/yo'q | Real-time kerak bo'lsa: Google sync **$0.067** (1K) yoki EvoLink ⚠️ ~$0.054 |
| **Nano Banana Pro** (Gemini 3 Pro Image) | **Google Batch API** (async, 2K) | **$0.067** | ❌ API bepul tier yo'q | Real-time: **Kie.ai $0.09** (1-2K) — Google sync $0.134 va fal.ai $0.15 dan arzon |
| **GPT-5.4 Image 2** (GPT Image 2) | **OpenAI** (yoki OpenRouter, bir xil) | **~$0.006** low / $0.053 med / $0.211 high | $5 API kredit; ChatGPT web ~3-10 rasm/3soat | Token asosida — narx sifat/o'lchamga bog'liq. fal.ai faqat low-da raqobatbardosh |
| **Seedream 4.5** (ByteDance) | **EvoLink** ⚠️ | **$0.03** | BytePlus yangi hisob krediti | Standart $0.04 (BytePlus / OpenRouter / fal.ai). Seedream 5.0 Lite $0.035 ham bor |
| **FLUX.1 [schnell]** | **fal.ai / DeepInfra** | **~$0.003** | self-host bepul (Apache-2.0) | Eng arzon FLUX. O'z serverda bepul |
| **FLUX.2 [dev]** | **fal.ai** | **$0.012** | self-host bepul | Eng arzon zamonaviy FLUX. Replicate ~$0.025 |
| **FLUX.2 [pro]** | **BFL direct** (bfl.ai) | **~$0.03** (1MP) | ❌ | fal.ai $0.031, Replicate $0.055. Megapixel-tier |
| **FLUX 1.1 [pro]** | hamma joyda bir xil | **$0.04** | ❌ | BFL = fal.ai = Replicate = Together |

### Image xulosasi
- **Google modellari (Nano Banana oilasi)** → **to'g'ridan Google AI Studio/Vertex** eng arzon. Nano Banana 2/Pro uchun **Batch API** (async, 24 soat) eng past narx; real-time kerak bo'lsa Pro uchun **Kie.ai**.
- **GPT Image 2** → **OpenAI direct** (OpenRouter ham bir xil narx).
- **Seedream 4.5** → standart $0.04, EvoLink ⚠️ $0.03.
- **FLUX** → **fal.ai** eng arzon hostlangan (schnell $0.003, FLUX.2 dev $0.012); pro uchun **BFL direct**. Open modellarni o'z serverda bepul.

---

## 🎬 VIDEO modellar

Narxlar 5-soniyalik klip uchun (taxminiy; ko'p manba soniya/kredit beradi). Bu segment juda o'zgaruvchan.

| Model | Eng arzon manba | Narx (5s) | Bepul tier | Izoh |
|-------|-----------------|-----------|-----------|------|
| **Kling 2.6** (Kuaishou) | **PiAPI** | **~$0.20** (720p, audiosiz, standard) | signup kredit | Pro mode ~$0.33. fal.ai ~$0.35 (rasmiy-sifat). 1080p + audio narxni ~2x oshiradi |
| **Kling 3.0** | fal.ai / EvoLink | ⚠️ ~$0.38-0.84 | — | Narxlar qarama-qarshi; $0.075-0.168/s ishonchli. "$0.029/s" eski/promo |
| **Seedance 2.0** (ByteDance) | **PoYo** ($0.04/s) | **~$0.20** | Volcengine **5M token bepul** (~16×15s) | "Fast" tier ⚠️ ~$0.11/5s. Volcengine Pro ~$0.70/5s. BytePlus dev 2M token bepul |
| **Veo 3.1** (Google, Standard+audio 1080p) | **Google Gemini API / Vertex** | **~$2.00** ($0.40/s) | ❌ (AI Studio ~100 kredit/oy) | fal.ai ham $0.40/s. Replicate ~$0.75/s — qimmat |
| **Veo 3.1 Fast** (audio) | **Google / fal.ai / Kie.ai** | **~$0.75** ($0.15/s) | $300 GCP yangi hisob krediti | Eng arzon audioli Veo |
| **Veo 3.1 Lite** (audiosiz, 720p) | **Vertex AI** | ⚠️ **~$0.15-0.25** ($0.03-0.05/s) | $300 GCP kredit | Eng arzon Veo, lekin audiosiz + past sifat |
| **RunwayML Gen-4.5** (1080p) | **Runway API** (to'g'ridan) | **~$1.25** ($0.25/s) | web trial (API'da emas) | ⚠️ API 2026-yanvar'dan **Enterprise-only** bo'lishi mumkin — sotuvchi bilan tasdiqlang. Aggregatorlarda yo'q |
| **Runway Gen-4 Turbo** (1080p) | **Runway API** | **~$0.25** ($0.05/s) | — | Eng arzon Runway varianti, past sifat |

### Video xulosasi
- **Kling** → **PiAPI** eng arzon (2.6 standard ~$0.20/5s). fal.ai ishonchliroq, biroz qimmat.
- **Seedance 2.0** → **PoYo** (~$0.20/5s), yoki Volcengine'ning saxiy bepul triali (5M token) bilan boshlang. ⚠️ Ba'zi aggregatorlarda hali to'liq ishga tushmagan bo'lishi mumkin.
- **Veo** → **to'g'ridan Google** (Gemini API/Vertex) eng arzon va ishonchli. Audio kerak bo'lmasa Lite tier eng past.
- **Runway Gen-4.5** → faqat **Runway direct** (aggregatorlar qayta hostlamaydi); API Enterprise-gated bo'lishi mumkin. Arzonroq variant Gen-4 Turbo.

---

## 🎯 Umumiy strategiya (AssetFlow uchun)

1. **Google modellari (Nano Banana, Veo)** — har doim **to'g'ridan Google AI Studio/Vertex**'dan oling. Eng arzon + bepul tierlar shu yerda. Bitta Google kaliti ikkalasini qoplaydi.
2. **OpenAI (GPT Image 2)** — to'g'ridan OpenAI yoki OpenRouter (bir xil narx).
3. **Ko'p model bitta joyda (FLUX, Seedream, Kling, Seedance)** — **fal.ai** eng qulay yagona platforma: bitta kalit, OpenAI-uslubidagi API, ko'pincha eng arzon yoki yaqin. Reklama qilingan eng past narxlar uchun **Kie.ai / PiAPI / PoYo / EvoLink** kabi resellerlar ⚠️ — ishonchliligini avval sinab ko'ring.
4. **Open modellar (FLUX schnell/dev)** — hajm katta bo'lsa o'z serverda bepul host qilish eng arzon.

**Amaliy tavsiya:** 2 ta asosiy hisob yeting — **Google AI Studio** (Nano Banana + Veo) va **fal.ai** (FLUX + Seedream + Kling + Seedance). Bu ikkisi so'ralgan modellarning deyarli barchasini eng arzon yoki eng qulay narxda qoplaydi. Reseller (Kie.ai/PiAPI/PoYo) faqat oxirgi 10-30% tejash kerak bo'lsa va ishonch hosil qilganingizdan keyin.

---

## Manbalar (asosiy)

**Image:** Google https://ai.google.dev/gemini-api/docs/pricing · fal.ai https://fal.ai · BFL https://bfl.ai/pricing · OpenAI https://openai.com/api/pricing/ · OpenRouter https://openrouter.ai · BytePlus ModelArk https://www.byteplus.com/en/product/modelark · Kie.ai https://kie.ai/nano-banana-pro · pricepertoken https://pricepertoken.com/image

**Video:** PiAPI https://piapi.ai/kling-2-6 · fal.ai Veo https://fal.ai/models/fal-ai/veo3 · Kie.ai Veo https://kie.ai/v3-api-pricing · Runway https://docs.dev.runwayml.com/guides/pricing/ · BytePlus Seedance https://docs.byteplus.com/en/docs/ModelArk/1544106 · PoYo https://poyo.ai/hub · Veo pricing https://www.veo3ai.io/blog/veo-3-pricing-2026

*Tahlil: deep-research skili, 50+ manba, 5 parallel burchak. Yangilangan: 2026-06-19. Aggregator narxlari indikativ — production'dan oldin rasmiy sahifadan tasdiqlang.*
