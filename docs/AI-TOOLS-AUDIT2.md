# AI Tools — 100% chuqur audit (2026-06-27)

Metod: 3 parallel adversarial subagent (backend/fal/kredit · image-gen frontend · video-gen+launcher+header+umumiy komponent) + asosiy invariant (kredit/refund/overlay) mustaqil tasdiq. Qamrov: launcher, Image gen, Video gen, umumiy `afRecent`/`#afLightbox`/`afVideoThumb`, header, Sozlama, backend (`fal.ts`/`gen-processor.ts`/`studio-gen.ts`/`gen-models.ts`/`plugin-profile.ts`/`gen-quote.ts`).

## BLOKER
Yo'q. (Subagent "lightbox unstyled BLOKER" deb belgiladi — **FALSE POSITIVE**: `#afLightbox{position:fixed;inset:0…}` CSS bor (`:2629`), computed-style bilan to'liq-ekran tasdiqlangan. Agent `.axig .lightbox` blokini ko'rib `#afLightbox` blokini o'tkazib yuborgan.)

## JIDDIY — TUZATILDI
| # | Joy | Sabab | Tuzatish |
|---|-----|-------|----------|
| 1 | `plugin-profile.ts:361` | **Kredit asimmetriyasi:** `consumeAiCredits` ADMIN'дан kredit kamaytirmaydi (cheksiz), lekin `refundAiCredits` shartsiz `increment` → har muvaffaqiyatsiz genда admin balansiga kredit "yaratiladi" | Refund'da role tekshiruvi: ADMIN yoki profil yo'q → no-op; `update`→`updateMany` (P2025 throw yo'q) |
| 2 | `studio-gen.ts:201,268` | **Cheksiz `params`** (`z.record(z.any())`) → ulkan obyekt DB'ga + har quote/gen'da hash (DoS/storage) | `boundedParams` (JSON ≤16KB) — `/gen` va `/gen/cost-quote` |
| 3 | `AssetFlow_Plugin.html` `go()`/vgScript | **Video teardown YO'Q:** `axIGTeardown` bor, `axVGTeardown` yo'q → view almashganда video poll/prog timer + inline pleyer ovozi davom etadi (leak) | `teardownVg` (joblarni bekor, timer tozalash, `vgVideo` pause, lightbox yopish) + `window.axVGTeardown` + `go()`да chaqiriladi |
| 4 | `:3112,:3492,:8835` | **Stale demo `606`** kredit (balTop/balSet hardcoded + `syncBal`) — history/settings'да real yuklanmaguncha 606 ko'rinadi | `syncBal` real `aiCredReal()` (yoki `—`); HTML default `—`. `bal()` (raqam) faqat eski estimate uchun qoladi |
| 5 | `:3232,:3344,:10668` | **O'lik `#igLightbox`/`#vgLightbox`** DOM + dead Esc/close wiring (umumiy `#afLightbox`'ga ko'chgan) — chalkashlik (#FALSE-POSITIVE sababi) | Ikkala o'lik lightbox DOM + vgScript wiring olib tashlandi (`vgRefSlotSheet` saqlandi) |

## KICHIK — TUZATILDI
- `:3288,:3290` Video So'nggi `☑/✕` emoji → SVG (image tool bilan bir xil, CEF88 ishonchli).

## Adversarial tasdiq (mustaqil tekshirildi — SOLID)
- **Kredit consume 1×:** atomik `updateMany where aiCredits>=cost` (`plugin-profile.ts:344`); concurrent multi-gen race-safe (balans manfiy bo'lmaydi).
- **Refund 1× faqat real xato:** `updateMany` status-flip `count>0` gate (`gen-processor.ts`) double-refund'ni yopadi; **TIMEOUT→refund yo'q** (sentinel `return` fail()dan oldin); cancel = DELETE (refund yo'q). Admin asimmetriyasi #1da tuzatildi.
- **Video narx gamed emas:** `computeGenCost=perSec[res]×dur` (auto→autoSec); narx `/gen/cost-quote`da imzolanadi + `/gen`da `ph` qayta hisoblab tekshiriladi; audio narxga ta'sir qilmaydi.
- **FAL_KEY sizmaydi:** faqat `Authorization` header; log/`errText`/`res.json`да yo'q (`fal.ts`).
- **XSS:** karta title/prompt `textContent`; model label sanitize qilingan innerHTML. ref-upload `data:image/*` + ≤25MB; DELETE/GET ownership (`userId`) tekshiradi; history `mode` whitelist.
- **Overlay:** `#afLightbox` `position:fixed;inset:0` to'liq-ekran markaz (computed 885×1100); ajdodlarда `transform/contain/filter` yo'q → viewportга chiqadi; ✕/Esc/backdrop yopadi; amallar TUGMA; hover preview muted; karta bosish → video ovoz bilan.

## Qolgan KICHIK (ro'yxat — tuzatilmadi, past xavf)
- `fal.ts:31` `errText` body double-read hardening (typed timeout sentinel tavsiya `{timeout:true}` `FAL_TIMEOUT` string-prefix o'rniga).
- `gen-processor.ts` refund status-flip bilan bitta `$transaction`да emas (crash-oyna juda tor).
- Image: dastlabki chip narx flash (`✦12` static vs `✦4`); `gensend.busy` spinner ishlatilmaydi; klient `cost()` server signed `price`dan farq (faqat displey); ko'p-fayl `readFileSync` UI muzlashi (spinner yo'q).
- Video: `vgResSeg` ikki marta `buildPills` (chalkash); frame `×` re-pick `:hover` guard mo'rt; o'lik `VG_RC_*` SVG var (shared-card refactordan keyin).
- Sozlama: demo toggle'lar (empty/low/error) real foydalanuvchiga keraksiz — olib tashlash tavsiya.

## Tekshiruv
`npm run build -w apps/api` 0 xato. Plagin 7 inline script 0 xato. Headless: lightbox to'liq-ekran video o'ynaydi (image+video); hover preview muted; teardown inline pleyerни pause + timer tozalaydi; kredit `—`/real (606 EMAS); ikkala tool umumiy `afRecent.card`/`afLightbox`. Console 0 xato.
