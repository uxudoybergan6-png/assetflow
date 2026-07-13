# SESSION REPORT — 2026-07-13
- Vazifa: MUAMMOLAR-1 8-qadam (P19 / P19.5) — "refund oldidan provayderdan so'ra" + resumable RASM jobs.
- P19.5 SETTLE: 20-daq cutoff endi TRIGGER-TO-ASK. `settleStuckGeneration` → `probeProviderJob`
  (fal/byteplus/vertex/openrouter) → decideStuckRefund: alive/unreachable=kut, failed=refund,
  hard-ceiling o'tsa=refund, job-yo'q=refund. Atomik guard (updateMany queued/running + count>0)
  BAYT-BAYT o'zgarmadi; provayder-tekshiruvi faqat refund QARORIDAN OLDIN.
- RESUMABLE IMAGE: fal-image jobi `__providerJob`ga saqlanadi (onJob), jarayon o'lsa `runFalImage`
  responseUrl'dan natijani QAYTA oladi — qayta submit/to'lov YO'Q. Faqat count===1 (bitta slot);
  count>1 mavjud, resume-siz (qayta to'lovdan xoli).
- HARD CEILING per-model: rasm/audio 1s · video 2s · video-upscale 4s (backstop, guess emas).
- P19.6 YETIM FAYL: terminal refunddan keyin `deleteGenObjectsByPrefix(gen/<uid>/<gid>-)` — case C /
  moderation orfan obyektlarini tozalaydi (gen-refs prefiksiga tegmaydi).
- ProviderSpend allaqachon submit'da (fail'da ham) yoziladi — item bajarilgan.
- Money-zone TEGILMADI: refundAiCredits/consumeAiCredits/HMAC/kredit qiymatlari o'zgarmadi.
- Isbot: p19-proof.mjs (real kod + fal fetch stub) — 28/28 pass: done→yetkaz, working→kut, failed→refund,
  resume'da submit=0, ceiling backstop. `npm run build -w apps/api` OK. DB migratsiya SHART EMAS.
- Commit qilindi (main), PUSH QILINMADI. Kutilmoqda: Render deploy + AE jonli test.
