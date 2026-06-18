# Artlist AI Toolkit — to'liq model xaritasi + AssetFlow uchun moslashtirilgan katalog

*Manba: toolkit.artlist.io jonli tahlili (Claude in Chrome, 2026-06-15) — har rejimning model ro'yxati va sozlamalari.*
*Maqsad: Artlist qaysi modellarni ishlatishini aniqlab, AssetFlow'da o'sha modellarni (va UI/UX'ni) ko'chirish.*

---

## 1. ARTLIST QAYSI MODELLARNI ISHLATADI (jonli yig'ilgan)

### 1.1 IMAGE (rasm) — 31 model, "All Models" katalogi
Nano Banana Pro, **Nano Banana 2**, Nano Banana, Seedream 5.0, Seedream 4.5, GPT Image 2,
GPT Image 1.5, **Flux 2.0 Pro**, Flux 2.0, Flux 2.0 Turbo, Flux 2.0 Flash, Imagen 4.0,
Imagen 4.0 Ultra, Ideogram v3, Krea 2, Grok Imagine, Wan 2.7 Pro, ImagineArt 2.0, Hunyuan V3,
Z-Image Turbo, Kling 3.0, Kling O3, Artlist Original 1.0. *(va yana ~8 ta)*
- **Sozlamalar:** Aspect Ratio (1:1, 2:3, 3:2, 3:4, 16:9 + View All), Quality (512px/1k/2k/4k), Number of Images (1–5).

### 1.2 VIDEO — 31 model
**Kling:** 3.0, O3, 3.0 Motion Control, O3 Video Edit, 2.6 Pro, 2.5 Turbo Pro, 2.1, 1.6.
**Veo:** 3.1, 3.1 Lite, 3.1 Fast, 3.1 Extend Video.
**Seedance:** 2.0, 2.0 Fast, 1.5 Pro, 1.0 Pro Fast.
**Boshqa:** Wan 2.7, Wan 2.6, Hailuo 2.3, Hailuo 2.3 Pro, LTX 2.3 Pro, Grok Imagine, Grok Imagine 1.5, Happy Horse 1.0.
- **Sozlamalar:** Duration (5s / 10s), Resolution (standard=720p / pro=1080p), Aspect Ratio (auto, 16:9, 9:16, 1:1). Reference rasm (image-to-video).

### 1.3 MUSIC (musiqa) — 2 model
**Lyria 3 Pro** (≈300 kredit), **Lyria 3** (≈150 kredit) — Google Lyria.
- **Sozlamalar:** Duration, Genre, Mood, Theme, Tempo (har biri "Auto" bo'lishi mumkin), song_type (generated_lyrics).

### 1.4 VOICEOVER (ovoz) — alohida sahifa (/voice-over-generator)
Artlist o'z ovoz kutubxonasi (ElevenLabs-asosli) — TTS + voice tanlash.

---

## 2. ENG MUHIM TUSHUNCHA

**Artlist bu modellarning HECH BIRINI o'zi yaratmaydi.** Hammasi tashqi modellar:
Google (Nano Banana=Gemini Image, Imagen, Veo, Lyria), BFL (Flux), ByteDance (Seedream, Seedance),
Kuaishou (Kling), Alibaba (Wan), MiniMax (Hailuo), Lightricks (LTX), xAI (Grok), OpenAI (GPT Image).

→ Artlist shunchaki **agregator** — model provayderlariga API orqali ulanadi va ustiga UI + kredit qo'yadi.
**AssetFlow ham AYNAN shu modellarga ulanadi** — agregatorlar (OpenRouter / Freepik / fal.ai) orqali. Ya'ni Artlist katalogini ko'chirish mumkin.

---

## 3. MODEL → PROVAYDER xaritasi (AssetFlow qayerdan oladi)

| Artlist modeli | Asl provayder | AssetFlow qayerdan oladi |
|---|---|---|
| Nano Banana (2/Pro) | Google Gemini Image | **OpenRouter** ✅ (allaqachon) / Freepik |
| Flux 2.0 (Pro/Turbo/Flash) | BFL | OpenRouter ✅ / Freepik / fal.ai |
| Seedream 4.5/5.0 | ByteDance | Freepik / fal.ai |
| Imagen 4.0 | Google | Freepik / fal.ai / Vertex |
| GPT Image | OpenAI | OpenRouter (mavjudligini tekshir) / fal.ai |
| Kling (3.0/2.6/2.5...) | Kuaishou | **OpenRouter** ✅ / Freepik / fal.ai |
| Veo 3.1 | Google | **OpenRouter** ✅ / Freepik / fal.ai |
| Seedance 2.0 | ByteDance | Freepik / fal.ai |
| Wan 2.6/2.7 | Alibaba | Freepik / fal.ai |
| Hailuo 2.3 | MiniMax | Freepik / fal.ai |
| LTX 2.3 | Lightricks | fal.ai / Freepik |
| Lyria 3 (music) | Google | Freepik (music-generation) |
| SFX | ElevenLabs | Freepik (sound-effects) |
| Voiceover | ElevenLabs | Freepik (voice) / OpenRouter TTS (kokoro) |

**Xulosa:** Bitta provayder Artlist'ning butun kengligini bersa — bu **Freepik** (image+video+music+SFX+voice+upscale, bitta kalit, async+webhook). OpenRouter image/video/embeddings/TTS uchun allaqachon ulangan. fal.ai — eng yangi video modellari uchun zaxira.

---

## 4. ASSETFLOW UCHUN TAVSIYA ETILGAN KATALOG (Artlist'ga mos, lekin ixcham)

Hammasini (31+31) ko'chirish shart emas — har kategoriyada **eng yaxshi 3-4 model** yetarli, keyin kengaytiriladi. Artlist'dagidek "All Models" submenu keyin qo'shiladi.

### Rasm (provider: OpenRouter bor, Freepik kengaytiradi)
- Nano Banana 2 (tez, default) — OpenRouter `google/gemini-...-image`
- Flux 2.0 Pro (sifat) — OpenRouter `black-forest-labs/flux.2-pro`
- Seedream 4.5 / Imagen 4.0 (Freepik) — keyin
- **Sozlamalar:** Aspect (1:1,2:3,3:2,3:4,16:9,9:16), Quality (1k/2k/4k), Count (1–4)

### Video (provider: OpenRouter bor, Freepik/fal kengaytiradi)
- Veo 3.1 (t2v, default) — OpenRouter `google/veo-3.1`
- Kling 3.0 (i2v) — OpenRouter `kwaivgi/kling-v3.0-std/pro`
- Seedance 2.0 / Wan 2.7 (Freepik/fal) — keyin
- **Sozlamalar:** Duration (5s/10s), Resolution (720p/1080p), Aspect (16:9/9:16/1:1), Reference (i2v)

### Ovoz/TTS (provider: OpenRouter)
- Kokoro TTS (`hexgrad/kokoro-82m`) yoki Gemini Flash TTS (`google/gemini-3.1-flash-tts-preview`)
- ⚠️ OpenAI gpt-4o-mini-tts OpenRouter'da jonli emas — kokoro/gemini ishlat

### SFX + Music (provider: Freepik — keyin, kalit kelganda)
- SFX: Freepik `/v1/ai/sound-effects`
- Music: Freepik `/v1/ai/music-generation` (Lyria/ElevenLabs)

---

## 5. UI/UX — Artlist composer naqshi (barcha rejim uchun YAGONA shell)

Artlist'da bitta composer hamma rejimga xizmat qiladi — faqat sozlamalar o'zgaradi. Plagin ham shunday bo'lsin (`STUDIO-GEN-IMAGE-composer.md` da rasm uchun batafsil):

```
[▦ Standard] [💬 Agent]                                  [⌄ collapse]
[+]  [🖼 Reference ✕]
Prompt textarea…                                              [✦ Enhance]
[Mode ⌄] | [Model ⌄] | [Settings ⌄] |          [cost kredit]  [ Generate ]
```
- **Mode:** Rasm / Video / Ovoz / SFX / Musiqa (URL/state bilan).
- **Model dropdown:** kategoriya modellari + "All Models ›" (keyin).
- **Settings (mode'ga qarab):**
  - Rasm → Aspect / Quality / Count
  - Video → Duration / Resolution / Aspect / Reference
  - Ovoz → Voice
  - Musiqa → Duration / Genre / Mood / Tempo
- **Cost** Generate tugmasida (model+settings'dan, imzolangan quote).
- **Chap/past:** generatsiya tarixi grid.
- **Dizayn:** dark/glass karta (Artlist uslubi), lekin AssetFlow brendi + `tokens.css`.

---

## 6. STRATEGIK QAROR (foydalanuvchi)

Artlist darajasidagi katalog uchun **provayder qo'shish kerak**:

| Yo'l | Nima beradi | Xarajat/ish |
|---|---|---|
| **A — Hozirgi (OpenRouter)** | Rasm + Video + TTS (cheklangan model) | Bepul, allaqachon ulangan |
| **B — Freepik qo'shish (tavsiya)** | Image+Video+Music+SFX+Voice, bitta kalit, Artlist kengligi | Freepik kaliti + kredit |
| **C — fal.ai qo'shish** | Eng yangi video (Seedance 2.0, LTX...) | fal kaliti + kredit |

**Tavsiya:** avval **OpenRouter bilan asosiy katalogni to'liq ishlat** (rasm/video/ovoz — Bosqich 2-3), keyin **Freepik** qo'shib Artlist kengligiga yet (SFX/music/ko'p model — Bosqich 4+). `ProviderAdapter` interfeysi bilan (`createJob`/`parseWebhook`) — model registrida `provider` maydoni qaysi adapterga yo'naltiradi.

---

## 7. KEYINGI QADAM (Claude Code)
1. **Hozirgi yo'nalishni tugat:** Bosqich 2 (TTS — kokoro'ga o'tkazildi), Bosqich 3 (video UI).
2. **Model registrini kengaytir** (`gen-models.ts`): yuqoridagi ixcham katalog (rasm 2-3, video 2-3), `provider` maydoni bilan.
3. **Composer'ni Artlist naqshiga keltir** (`STUDIO-GEN-IMAGE-composer.md` §3-4) — settings mode'ga qarab.
4. **Freepik adapter** (Bosqich 4) — SFX/music/qo'shimcha modellar (kalit kelganda).
5. **"All Models" submenu** — keyin (v2), katalog kengayganda.

*Jonli tahlil: Claude in Chrome, 2026-06-15. Faqat ochiq frontend model nomlari kuzatildi.*
