# Sessiya hisoboti — MUAMMOLAR-2 qadam 29 / 29a / 29b (2026-07-13)

**Bajarildi (API + web + plagin), PUSH QILINMADI. Money-zona TEGILMADI.**

- **29 (P21) KREDITLAR EKRANI** — API `GET /credits/ledger` (HAQIQIY CreditLedger, keyset paginatsiya + Spent/Refunded/Net/Purchased, gen-boyitilgan, o'chirilgan-gen xavfsiz) + `GET /downloads` (real). Web Account: totals + filtr + imzoli summa (yechim QIZIL/refund YASHIL) + balans + thumb + qator→lightbox + Load more; real Downloads panel. Plagin `renderLedger` real ledger'dan + totals. READ-ONLY.
- **29a (P28) ENHANCE RASMLARNI KO'RADI** — web/plagin enhance referens poolni yuboradi (rasm/video/audio + start/end frames); API mention-butunlik validatsiya (renumber/ixtiro → RAD ET, asl qoladi, `mentionMismatch`); FAITHFUL system prompt (P30 §1). **Filter-evasion OLIB TASHLANDI** (`softenPromptForSafety` o'chirildi, safetyHint euphemism→faithfulness). Undo=chip-editor ⌘Z.
- **29b (P29) LANDING LOGOUT** — sabab: KODSIZ (yoki ruxsat) 401 ff-api.js'da `!code401` fallback bilan session'ni tozalardi. Tuzatish: endi FAQAT aniq token-o'lim kodlari (TOKEN_EXPIRED/INVALID/REVOKED/NO_TOKEN) tozalaydi; kodsiz/ruxsat/2FA 401 = oddiy xato. Server allaqachon kod yuboradi (step 13). Boot tartibi + ochiq ekranlar tasdiqlandi.

**Tekshirilgan:** API build (validator gate) + mention 8/8; web boot toza (compiles+logicBound, 0 konsol xato); 401-mantiq jonli tasdiq (kodsiz/ruxsat→saqlanadi, token-o'lim→tozalanadi). **Kutilmoqda:** push→deploy; jonli auth-li ekranlar + AE test. **Keyingi:** 29c (P30 provayder rad etishlari).
