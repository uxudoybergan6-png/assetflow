# AssetFlow uchun AI API tahlili — eng arzon + qulay (2026-06)

Maqsad: AssetFlow plagini uchun 3 ta AI ish holatiga eng yaxshi **narx + qulaylik** balansli provayder tanlash:

1. **Matn (LLM)** — shablon avtomatik tavsif + teg generatsiyasi
2. **Rasm (image gen)** — thumbnail/preview generatsiyasi
3. **Moderatsiya/vision** — yuklangan kontentni tekshirish

> Narxlar USD, 2026-yil iyun holati. Aniq raqamlarni ishlatishdan oldin har provayderning rasmiy sahifasidan tasdiqlang (narxlar tez o'zgaradi).

---

## TL;DR — yakuniy tavsiya

| Vazifa | Eng yaxshi tanlov | Narx | Nega |
|--------|-------------------|------|------|
| **Matn (teg/tavsif)** | **Google Gemini 2.5 Flash-Lite** | $0.10 / $0.40 (1M tok) | Eng arzon + haqiqiy bepul tier (karta yo'q, 1000 so'rov/kun) |
| **Rasm (preview)** | **Gemini 2.5 Flash Image ("Nano Banana")** boshlash uchun; **fal.ai FLUX schnell** masshtabda | 500 rasm/kun bepul; keyin ~$0.039; FLUX ~$0.003/rasm | Bepulда boshlanadi, masshtabda eng arzon |
| **Moderatsiya** | **OpenAI Moderation API** (`omni-moderation-latest`) | **Bepul ($0)** | Matn + rasm bitta chaqiruvda, cheksiz bepul |

**Strategik tavsiya:** Bitta **`openai` Node SDK** ishlatib, faqat `baseURL` + `apiKey` ni almashtirib turing. Deyarli barcha provayderlar OpenAI-mos (Anthropic'dan tashqari). Bu sizga bitta integratsiya bilan provayderlarni erkin almashtirish imkonini beradi.

---

## 1. Matn (LLM) — teg va tavsif generatsiyasi

| Provider | Model | Input $/1M | Output $/1M | Bepul tier | OpenAI-mos? |
|----------|-------|-----------|------------|-----------|-------------|
| **Google** | Gemini 2.5 Flash-Lite | **$0.10** | **$0.40** | ✅ Kuchli: 1000 so'rov/kun, karta yo'q | ✅ |
| OpenAI | gpt-4.1-nano | $0.10 | $0.40 | ❌ (trial bekor qilingan) | ✅ (native) |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | ❌ | ✅ |
| **DeepSeek** | deepseek-chat (V3) | $0.14 | $0.28 | ❌ (5M token trial) | ✅ |
| **Mistral** | Ministral 3B | $0.04 | $0.04 | ✅ rate-limited | ✅ |
| **Groq** | Llama 3.1 8B | $0.05 | $0.08 | ✅ 1000 so'rov/kun | ✅ (eng tez) |
| **OpenRouter** | `:free` modellar (DeepSeek V3, Qwen3, Llama) | **$0** | **$0** | ✅ ~200 so'rov/kun, karta yo'q | ✅ |
| Anthropic | Claude Haiku 4.5 | $1.00 | $5.00 | ~$5 kredit | ⚠️ qisman (prod uchun emas) |

**G'olib:** **Gemini 2.5 Flash-Lite** — eng past narx + eng saxiy bepul tier. Output ko'p kerak bo'lsa **DeepSeek V3** ($0.28 output) ham juda foydali. Tezlik muhim bo'lsa **Groq**.

---

## 2. Rasm generatsiyasi — thumbnail/preview

| Provider | Model | Narx/rasm (1024²) | Bepul | Izoh |
|----------|-------|-------------------|-------|------|
| **Google** | Gemini 2.5 Flash Image (Nano Banana) | ~$0.039 | ✅ **500 rasm/kun bepul** | Eng yaxshi bepul start |
| **fal.ai** | FLUX.1 [schnell] | **~$0.003** | trial | Masshtabda eng arzon, tez |
| Google | Imagen 4 Fast | $0.02 | ❌ | Eng arzon rasmiy Google |
| fal.ai | FLUX.1 [dev] | ~$0.025 | trial | Yuqori sifat |
| OpenAI | GPT Image 1 Mini | $0.005 | $5 kredit | Eng arzon OpenAI |
| Black Forest Labs | FLUX 2 Pro | $0.03 | ❌ | Eng yangi FLUX |
| Stability AI | SD3.5 Medium | $0.035 | 25 kredit | Open model |

**G'olib:** Boshlash uchun **Gemini Nano Banana** (500 rasm/kun bepul). Hajm oshganda **fal.ai FLUX schnell** (~$3 / 1000 rasm). ⚠️ OpenAI GPT Image 1 ni qurmang — 2026-10-23 da deprecate bo'ladi (GPT Image 1.5/2 ishlating).

---

## 3. Moderatsiya / vision — yuklangan kontent

| Provider | Servis | Narx | Bepul | Izoh |
|----------|--------|------|-------|------|
| **OpenAI** | Moderation API (`omni-moderation-latest`) | **Bepul $0** | ✅ Cheksiz | **Matn + rasm** bitta chaqiruvda. Eng yaxshi default |
| Google | Cloud Vision SafeSearch | $1.50 / 1000 rasm | 1000/oy bepul | Faqat rasm |
| AWS | Rekognition DetectModerationLabels | $0.001 / rasm | cheklangan | Faqat rasm, IAM kerak |
| Google | Gemini 2.5 Flash-Lite (vision) | ~$0.00013/rasm | ✅ | Custom-policy uchun arzon |
| Sightengine | Image+text moderation | $29/oy = 10k | 500/kun bepul | Freemium |
| Open-source | NudeNet + content-checker | Bepul (compute) | — | Self-host, to'lovsiz |

**G'olib:** **OpenAI Moderation API** — bepul, matn va rasmni birga tekshiradi, sozlash juda oson. Birinchi moderatsiya bosqichi uchun ideal.

---

## Sozlash qulayligi (developer experience)

- **Bitta SDK strategiyasi:** `openai` Node SDK + har provayder uchun `{ baseURL, apiKey, model }` konfig. 9 dan 8 provayder shunday ishlaydi.
- **Karta talab qilmaydigan bepul tier:** Google Gemini (AI Studio) va Groq — eng kuchli.
- **Katta signup kredit:** Together AI ($100), DeepSeek (5M token), Mistral startup ($30k gacha).
- **Provayder abstraktsiyasi:** OpenRouter — bitta kalit, ko'p model, avtomatik fallback.
- **Ehtiyot bo'ling:** DeepSeek (geo/compliance cheklovlari — Xitoy provayderi), Fireworks ($1 kredit + 10 RPM cheklov).

---

## AssetFlow uchun amaliy reja

**Tavsiya etilgan stack (eng arzon + qulay):**

1. **Matn:** Google Gemini 2.5 Flash-Lite — bepul tierda boshlang, kerak bo'lsa pullik ($0.10/$0.40).
2. **Rasm:** Gemini Nano Banana (500/kun bepul) → hajm oshsa fal.ai FLUX schnell.
3. **Moderatsiya:** OpenAI Moderation API (bepul).
4. **Backup/fallback:** OpenRouter bitta kalit orqali bir nechta modelni almashtirish uchun.

Bu kombinatsiya bilan kichik hajmda **deyarli $0** xarajat, o'sishda ham eng past narxlardan biri bo'ladi.

---

## Manbalar (asosiy rasmiy sahifalar)

- OpenAI: https://openai.com/api/pricing/ · Moderation: https://platform.openai.com/docs/models/omni-moderation-latest
- Google Gemini: https://ai.google.dev/gemini-api/docs/pricing · Nano Banana: https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/
- DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
- Groq: https://groq.com/pricing
- OpenRouter: https://openrouter.ai/pricing · bepul modellar: https://openrouter.ai/collections/free-models
- Together AI: https://www.together.ai/pricing
- Mistral: https://mistral.ai/pricing/
- fal.ai FLUX: https://fal.ai/models/fal-ai/flux/schnell
- Stability AI: https://platform.stability.ai/pricing
- Google Cloud Vision: https://cloud.google.com/vision/pricing
- AWS Rekognition: https://aws.amazon.com/rekognition/pricing/

*Tahlil: deep-research skili, 25+ manba, 5 burchak. Yangilangan: 2026-06-19*
