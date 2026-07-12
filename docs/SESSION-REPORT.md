# Sessiya hisoboti — 2026-07-13 (MUAMMOLAR-2 · qadam 25 = P13 + P20)

Nima qilindi (WEB + PLUGIN + API — pul zonasi TEGILMADI):
- **P13 — Referens hovuzi model-mustaqil.** `pickModel`/`setModel`/`switchVgModel` endi referenslardan
  HECH NARSA o'chirmaydi. Model faqat PROYEKSIYA: `projectRefs` (web) / `vgActiveFlags`+`igActiveRefLimit`
  (plagin) qaysi referens FAOL (yuboriladi) ekanini belgilaydi; nofaollari XIRA holda TURADI (hover'da
  sabab), @raqamlash qayta raqamlanmaydi, orqaga qaytsa hammasi qaytadi. `buildParams`/`genClick` faqat
  faollarini yuboradi. Generate oldidan nofaol @eslatma bo'lsa ogohlantiradi. Model picker'da referens
  imkoniyati ko'rinadi. (Restore/Upscale/Clear ataylab-reset yo'llari saqlandi.)
- **P20 — Parallel generatsiya (web).** `state.generating` → `state.activeJobs[]`; per-job poll taymer +
  per-job pending karta + per-job progress; kompozer ochiq qoladi; balans komitilgan kreditlarni hisobga
  oladi. Plaginda parallel allaqachon bor edi (MAX_JOBS 5/3).
- **API:** `POST /gen` ga per-user parallel cheklov (queued+running ≥ `MAX_ACTIVE_GENERATIONS`=5 → 429,
  consume'dan OLDIN). consume/refund/quote/HMAC TEGILMADI.
- Tekshirildi: `npm run build -w apps/api` ✓; ikkala mijoz konsol xatosisiz yuklandi; P13 acceptance
  (9 rasm → Veo → Omni → Nano; video start/end kadr) real KOD ajratib olinib node testda o'tdi ✓✓.

Men NIMANI jonli tekshirishim kerak:
- AE plaginida (install-cep bajarildi, AE qayta ishga tushdi): 9 rasm biriktir → modelni referenssiz/kam-limitli
  modelga o'zgartir → thumbnaillar XIRA holda TURSIN → qaytsang qaytsin; video start+end kadr → start-only modelga
  o't → end kadr xira, saqlangan.
- Web AI Studio (login kerak): bir vaqtda 2-3 gen ishga tushir → har biri o'z pending kartasi + progressi;
  kompozer ochiq; model almashganda referens yo'qolmaydi.

Kutilmoqda: git push → deploy; `MAX_ACTIVE_GENERATIONS` env (ixtiyoriy).
