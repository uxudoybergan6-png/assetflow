# SESSION-REPORT — Bosqich 2 (huquq · moderatsiya)

**Sana:** 2026-07-04 · **Ko'lam:** legal/safety backend + hujjat. Har item alohida commit, push YO'Q.

**Nima qilindi:**
1. **Moderatsiya** — `lib/moderation.ts` (env omni-moderation: matn+referens+chiqish). CSAM endi
   nozik-yosh + ISTALGAN tana/jinsiy/ich-kiyim signalида BLOK; deepfake/real-shaxs WARN→HARD BLOK.
   /gen: moderatsiya KREDITDAN OLDIN → bloklangan gen'ga charge yo'q + audit log.
2. **Upload xavfsizligi** — VirusTotal hash-skan + sha256 dedup (anti-theft) + DMCA takedown
   (+restore) + admin pack-clear. Karantin: approve 409, serve 451, katalogdan olib tashlash.
   Migration additive (packHash/packScanStatus/takedown*).
3. **Legal hujjat** — terms/privacy/refund o'zbekchaga; Paddle→Stripe (kod haqiqati); Studio tarifi
   va kredit-paketlar shartli + FLAG (backend'da yo'q); MoR/soliq neytral placeholder.
4. **docs/LEGAL-TODO.md** — egasi+huquqshunos qarorlari (MoR/VAT/Studio/credit-pack).

**Manual qadam:** `MODERATION_API_KEY` (ML no-op'siz), `VIRUSTOTAL_API_KEY` (prodda pack karantin),
`migrate:deploy`. Ixtiyoriy `MODERATION_MODERATE_OUTPUTS=true`.

**Tekshirildi:** preflight 11/11 (CSAM/deepfake/gore/sexual BLOK; footballer/sunset/kids-clothed PASS);
`npm run build -w apps/api` yashil. Pul mantiqi (consume/refund) TEGILMADI — bloklar charge'dan oldin.
