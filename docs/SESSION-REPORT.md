# Sessiya hisoboti — MUAMMOLAR-2 qadam 29 / 29a / 29b / 29c (2026-07-13)

**Bajarildi (API + web + plagin), PUSH QILINMADI. 🔴 Money-zona (consume/refund/qiymatlar) TEGILMADI.**

- **29 (P21) KREDITLAR EKRANI** — API `GET /credits/ledger` (HAQIQIY CreditLedger, keyset paginatsiya + Spent/Refunded/Net/Purchased) + `GET /downloads`. Web Account: totals + filtr + imzoli summa (yechim QIZIL/refund YASHIL) + balans + thumb + qator→lightbox + Load more; real Downloads. Plagin `renderLedger` real ledger'dan + totals.
- **29a (P28) ENHANCE RASMLARNI KO'RADI** — web/plagin enhance referens pool yuboradi; API mention-butunlik (renumber/ixtiro→RAD, `mentionMismatch`); FAITHFUL prompt. **Filter-evasion OLIB TASHLANDI** (`softenPromptForSafety` o'chdi, safetyHint→faithfulness).
- **29b (P29) LANDING LOGOUT** — ff-api.js endi FAQAT token-o'lim kodlarida (TOKEN_EXPIRED/INVALID/REVOKED/NO_TOKEN) session'ni tozalaydi; kodsiz/ruxsat/2FA 401 = oddiy xato (avval `!code401` fallback logout qilardi).
- **29c (P30) PROVAYDER RAD ETISHLARI** — 🔴 Director ruling: EVASION QURILMADI. `policyStrictness` katalog maydoni + `suggestLenientAlternative` (rasm→Seedream, video→Seedance; yo'q bo'lsa halol aytiladi). Web toast TIPGA ega (rad=✕ QIZIL, ✓ EMAS) + rad banneri (halol sabab + ✦N qaytarildi + "Try <model>"). Plagin: empty-done guard + failed→`handleGenRejection` (afConfirm boshqa-model) + honest `friendlyError`. §2 "qattiq siyosat, rad etilsa hisobdan yechilmaydi" ogohlantirishi (web+plagin). Rad etishlar LOGGA (`provider.content_rejected`) + kunlik blok-cap (refund-farming). Refund mavjud yo'l orqali (qiymat o'zgarmadi).

**Tekshirilgan:** API build + validator; mention 8/8 + policy/rejection 12/13 (1 test-taxmin xato edi, kod to'g'ri); web boot toza (compiles+logicBound, 0 konsol xato); banner/toast VM alohida test. **Kutilmoqda:** push→deploy; jonli auth-li web + AE `install-cep.sh` test.
