# fal.ai — Integratsiya eslatmalari (faza 2 backend uchun)

> Manba: fal.ai/docs (Model APIs), foydalanuvchi ko'chirgan + tekshirilgan. 2026-06.
> Bog'liq: `docs/FAL-AI-CATALOG.md` (model→endpoint→narx→verdict), `docs/AI-PROVIDER-DECISION.md`.
> Maqsad: `apps/api/src/lib/ai/fal.ts` adapter qurishда ishlatiladigan API mexanikasi.

## 1. Chaqirish naqshi (universal)
- Har model = HTTP endpoint. **JSON yuborasan → JSON qaytadi (media CDN URL bilan)**.
- Magnific bilan bir xil shakl → mavjud adapter naqshi to'g'ridan mos keladi.

## 2. 4 chaqirish usuli
| Usul | Ta'rif | Bizга |
|---|---|---|
| Direct (`run`) | Sinxron HTTP `fal.run`, natija darrov | Tez/oddiy tool (remove-bg kabi sinxron) |
| Subscribe | Navbat ostida, avto-poll, sinxron his | — |
| **Async (`submit`)** ⭐ | Yubor → poll YOKI webhook | **Production tavsiya** — gen-processor naqshimiz |
| Streaming / realtime | LLM token / <100ms WebSocket | KERAK EMAS |

→ Biz **submit (async) + poll/webhook** ishlatamiz (mavjud arxitekturaга mos).

## 3. Endpoint + Auth
- Queue endpoint: `https://queue.fal.run/<model-id>`  (masalan `fal-ai/nano-banana-2`)
- Sinxron: `https://fal.run/<model-id>`
- Header: `Authorization: Key $FAL_KEY`
- ❗ `FAL_KEY` — **server tomon**, Render env'da (xuddi `MAGNIFIC_API_KEY` kabi). Plaginга/commit'ga/chatga CHIQMAYDI.

## 4. Output → R2
- Javob: media **CDN URL** + metadata (o'lcham, seed).
- Magnific'дagidek: natijani darrov **R2'ga yuklab** olib signed/public URL beramiz (`getPublicOrSignedUrl`).

## 5. Webhook (poll o'rniga)
- Async `submit` da `webhook_url` berish mumkin → fal tugaганда chaqiradi.
- Sekin gen'lar (video) uchun poll-timeout muammosини hал qiladi. API public (Render URL bor).
- Imzo tekshiruvini docs/Webhooks sahifasидан olish kerak (faza 2'да).

## 6. Ovoz/audio modellari (yangi tool'lar uchun — tasdiqlangan)
- **TTS** (Lip-sync ovozи): Chatterbox · MiniMax Speech-02 · Dia (voice-clone)
- **SFX** (Video→SFX): Beatoven SFX · (+ mmaudio video→audio katalogда)
- **Music**: Beatoven · ElevenLabs Music

## 7. Param kashf qilish
- Har model sahifasида **Playground** + input/output schema + narx + tayyor kod.
- `Model API Reference` — aniq parametrlar (Claude Code katalog tuzганda shundan oldi).
- Faza 2'да har model uchun schema'ни WebFetch bilan tasdiqlash.

## 8. Adapter rejasi (qisqa)
- `apps/api/src/lib/ai/fal.ts` (magnific.ts yonida) — `submitAndPoll`, `falImage`, `falVideo`, `falTool`, `falDownload`.
- `gen-models.ts` → `provider:"fal"`, `falModel`, `priceUnit`.
- `gen-processor.ts` → `genProvider()==='fal'` shoxи.
- Kredit/cost-quote/guard/pgvector — TEGILMAYDI.

## 9. Aniq model ID'lari (docs'дан, endpoint yo'li = `<model-id>`)
**Rasm (gen + edit):**
- `fal-ai/nano-banana-2` · `fal-ai/nano-banana-pro` · `fal-ai/nano-banana-2/edit`
- `fal-ai/flux-2-flex` · `fal-ai/flux-pro/kontext` (edit)
- `fal-ai/recraft/v4/pro/text-to-image`

**Video:**
- `fal-ai/veo3.1` (audioli premium) · `fal-ai/sora-2/text-to-video` (+`/pro`)
- `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`
- `fal-ai/kling-video/o3/standard/image-to-video` (start+end frame)
- `fal-ai/ltx-2-19b/image-to-video` (audioli)

**Ovoz/audio (yangi tool'lar):**
- TTS: `fal-ai/chatterbox/text-to-speech` · `fal-ai/minimax/speech-02-hd` · `fal-ai/dia-tts/voice-clone`
- SFX: `fal-ai/beatoven/sound-effect-generation`
- Music: `fal-ai/beatoven/music-generation` · `fal-ai/elevenlabs/music`

> ⚠️ Bular docs'дa ko'rsatilgan namunalar — faza 2'да `FAL-AI-CATALOG.md` verdict bilan
> solishtirib, har biriни Playground/schema bilan tasdiqlash. Narx/param o'zgarishi mumkin.

## 10. Foydali index
- **`https://fal.ai/docs/llms.txt`** — to'liq docs index (faza 2'да Claude Code shundan boshlasin).
- Model gallery: `https://fal.ai/models` · Explore: `https://fal.ai/explore`

---
*Yangilanadi: faza 2 boshlаганда (webhook imzo + har model aniq schema).*
