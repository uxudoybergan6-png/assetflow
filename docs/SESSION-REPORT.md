# SESSION REPORT — MUAMMOLAR-1 steps 20 + 21 + 22 (2026-07-14)

**Bajarildi (3 commit, push EMAS): sybil himoya + pool asosi (D3) + foyda paneli + perf o'lchov.**

**Step 20 — sybil + pool + kredit muddati (D3/D5):**
- `TemplateDownloadEvent`ga ip/ipPrefix/userAgent/asn (ADDITIVE) — 3 download/import route'da yozildi (web+plagin bir xil route → plagin qamrovi avtomatik).
- `lib/sybil.ts` (FAQAT O'QISH): eksklyuzivlik + IP-subnet tarmoq + hisob-yosh yaqinligi + yangi-hisob signallari → xavf bali + sabab. Pul matematikasiga TEGMAYDI (majburiy qo'lda ko'rib chiqish).
- D3: `contributorPoolShare` 0.50→0.30 (ega qarori); pool bazasidan INFRA ayiriladi (yangi `InfraCost` jadval, admin kiritadi); manfiy pool → 0 ga qisiladi + ogohlantirish. Payout HOLD (30 kun) held/payable sifatida ko'rsatiladi.
- Admin: `/sybil`, `/infra-cost` endpointlar; Payouts'da "Trust & safety" paneli.

**D5 TEKSHIRUV NATIJASI:** kreditlar ALLAQACHON to'g'ri — reja krediti oy oxirida KUYADI (consumeAiCredits reset), sotib olingan top-up SAQLANADI va `aiCreditsTopup` ustunida ALOHIDA kuzatiladi. P26.2 "haqiqiy xato" ALLAQACHON tuzatilgan (clawback shu ustunni ishlatadi). O'zgartirish KERAK EMAS — faqat hisobot.

**Step 21 — foyda paneli:** `lib/profit.ts` + `/profit` + yangi admin "Profit" ekran: daromad − AI − LS − infra − contributor = foyda; bepul kredit = CAC (daromad emas); zararli modellar qizil; confidence; tannarxdan-past kanal banneri.

**Step 22 — perf (RAQAM):** katalog 50→500→5000: javob hajmi FLAT 38.2KB/sahifa, list TTFB p50 ~5ms, filtr/qidiruv <10ms, 50 parallel 50/50 ok, RSS +42MB (100× data). `docs/PERF-BASELINE.md`. Topilma: qidiruv indekssiz ILIKE (5ms@5000 lekin chiziqli — ~15-25k'dan keyin pg_trgm); asosiy production xarajat = Atlantika DB kechikishi (Frankfurt ko'chishigача).

**Tekshirildi (lokal API+DB):** sybil fixture ball 100 (4 signal), infra/pool/profit endpoint + admin ekranlar jonli render, perf 3 bosqich o'lchandi. Money zone (consume/refund/HMAC/computeGenCost) TEGILMADI. Migratsiya additive.

⚠️ **Kutilmoqda:** git push + deploy + `migrate:deploy` (sybil_infra_tracking) → productionda live verify.
