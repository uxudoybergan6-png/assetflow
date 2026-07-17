# SESSION-REPORT — SC_27 composer parity + per-model payloadlar (2026-07-18)

Nima qilindi: plagin kompozeri web bilan funksional paritetga keltirildi; payloadlar model-aniq.
- Plagin video: media-refs DOM JONLANTIRILDI (vgMediaSect/vgRefGrid/+Image/+Video/+Audio) — Omni 3010 va Seedance 3102 endi plaginda to'liq (limit=0 tur tugmasi yashirin, hisoblagich model-aware).
- Plagin video: paste + OS fayl drop (rasm→kadr/media-ref, video/ovoz→media yo'l); "FAST" nishoni faqat start-majburiy modelda.
- Payload aniqligi: image quality faqat hasQuality; null/bo'sh referens maydonlari yuborilmaydi; audio faqat qo'llaydigan+qulflanmagan modelda; aspect 'Auto'→'auto' (web'da ham — bitta per-model fix).
- Audio pane: Enhance ✦1 + Clear + kredit-gate qo'shildi (web paritet); Chirp maxChars gate allaqachon bor edi.
- Model-switch: yaroqsiz saqlangan sozlamalar default'ga tushganda tranzient xabar (ikkala pane).
- Verifikatsiya: scripts/verify-gen-payloads.mjs — 13 model × 2 variant + 3 negativ = ALL PASS (:4000).
- Jonli: plagin brauzer-QA (:8976→:4001 proxy) — 10 model REAL payload capture, hammasi backend enumlariga aniq mos; REAL gen: image (Lite ✦2) + voice (Chirp ✦4) + video (Veo Lite ✦24) plagin orqali.
- Money-zone TEGILMAGAN (gen-quote/cost/consume/refund o'zgarishsiz; narxlar verifikatsiyada aynan).

QA: node --check 7/7 OK; install-cep.sh OK; 320/420/900 + 3 tema OK; web+plagin konsol toza.
