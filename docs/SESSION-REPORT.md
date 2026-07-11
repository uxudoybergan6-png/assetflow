# Sessiya hisoboti — 2026-07-12 (BATCH5 Prompt #4: mention dialekt + video-edit presetlar)

**Nima qilindi:**
- `byteplus.ts` → sof `rewriteMentionTokens(prompt, counts)` ajratildi: `@image/@img/@video/@vid/@audio/@aud`
  (case-insensitive, `@` chegara) → "Image/Video/Audio n". KADR OFFSET: start/end kadr bo'lsa `@img1`
  "Image 2"/"Image 3" bo'ladi (offset = referensdan oldingi image_url yozuvlari soni, builder O'ZIDAN
  sanaydi). `buildByteplusVideoBody` yagona chaqiruvchi.
- Build-time test jadvali (`mentionTokenSelfTest`) — 12 case (aralash reg, yondosh tinish, ko'p raqamli,
  mos ref yo'q, start-frame offset, video+audio birga); `gen-models-validate` CLI ishga tushiradi.
- Video-edit preset chiplari (UI-only, ikkala composer): ≥1 VIDEO referens biriktirilganda 3 chip
  ("Replace subject" · "Edit objects" · "Inpaint / Fix") prompt tepasida; bosilsa EN shablon kursorga.
  Plagin `.stag`+`insertVgTok`; web `.va-editpreset`+`insertEditPreset`. Bir xil 3-shablon konstanta
  IKKALA faylda `SD2-EDIT-PRESETS v1` marker izohi bilan (qo'lda sync).

**Nima topildi:** BytePlus "Image n" first_frame/last_frame rollarini HAM sanaydi — eski rewrite offset
qo'ymasdi. Joriy katalog aralashmaydi (3101=kadr, 3102=media-ref) → fix future-proofing, katalog TEGILMADI.

**Tekshirildi:** `npm run build -w apps/api` yashil (validator 0), mention testlari o'tdi; `node --check`
plagin+web OK; dry-run start-frame+@img1 → "Image 2" tasdiqlandi. Money-zone TEGILMADI.
**Kutilmoqda:** push + deploy + AE test. Live sanity O'TKAZILMADI (BYTEPLUS_API_KEY lokalda yo'q, paid pack).
