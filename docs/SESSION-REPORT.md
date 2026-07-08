# Sessiya hisoboti — QA-FIX #16 (AI model settings → provider mapping)

**Nima qilindi:** Enabled modellar bo'yicha per-model param→provayder audit. Faqat
Google (Vertex Imagen/Nano/Veo/Omni) + Kokoro(TTS) + ElevenLabs(SFX) yoqilgan; fal
rasm/video va Magnific hammasi `enabled:false`.

**Topilgan mos-kelmaslik (tuzatildi):**
1. Web `buildParams` (rasm) — `aspectRatio` model.aspects'ga klamplanmasdi (video branch
   klamplaydi); pickModel `aiSize`'ni resetlamaydi → stale 21:9 Imagen'ga o'tib gen yiqilardi.
2. Backend `gen-processor` (rasm) — nisbat/o'lcham model qo'llamaydigan qiymat bilan
   provayderga borardi (Imagen'ga 4K/21:9). Endi model.aspects/resolutions'ga klamp.

**Tekshirilgan (to'g'ri, tegilmadi):** plagin rasm+video (setModel/applyModelSettings
def'ga reset + model-aware pickerlar), web video (buildParams klamp), Veo/Omni/TTS/SFX
mapping, referens exposure (guard'lar joyida).

**MONEY-ZONE TEGILMAGAN:** gen-quote.ts (HMAC), computeGenCost/imageUnitCost, kredit
consume/refund — hech biri o'zgarmadi (git bilan tasdiqlandi). Dry-run: charge==delivered tier.

**Holat:** 2 commit (backend + web), push qilinmadi. `npm run build -w apps/api` yashil.
