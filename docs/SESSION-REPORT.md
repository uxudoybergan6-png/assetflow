# SESSION REPORT — 2026-06-25 — Gen tezligi: 100% audit + xavfsiz optimizatsiya

## AUDIT — latency manbalari (Yaratish bosilgandan natija ko'rinishигача)
| Bosqich | Qayer | OLDIN | Muammo | O'ZGARISH | Taxminiy tejamkorlik |
|---|---|---|---|---|---|
| Pre-flight (1-bosish) | plagin `genClick` | cost-quote → session KETMA-KET | 2 RTT serial | `Promise.all([cost-quote, ensureSession])` | ~1 RTT (issiq: 0; sovuq: ~0.5-1s) |
| Server fal poll | `fal.ts falSubmit` | HAR poll oldidan `sleep(1500)` (1-chisi ham) | 1.5s granularlik + pre-sleep | ramp `600/1200/2000ms` (window ~200s) | ~0.8-1.5s/gen (tez rasm) |
| **Ko'p rasm (count>1)** | `gen-processor` count loop | **SERIAL** N× (har biri to'liq fal round-trip) | count=4 → 4× sekin | **chegaralangan parallel** (`mapLimit`, IMG_CONCURRENCY=2) | count=4: ~32s→~16s (**~2×**); count=1: 0 |
| Referens materialize | `gen-processor` | SERIAL for-loop | odatda no-op (plagin R2 URL yuboradi) | parallel `Promise.all` (TARTIB saqlanadi) | ~0 (ko'p data-URI'да bir necha s) |
| Plagin poll discovery | plagin `poll` | har `3000ms` | tugagach ≤3s kechikish | ramp `1000→1800ms` (cap 140≈247s) | ~1-1.5s discovery |
| Render cold-start | infra | uxlab qolsa ~30-60s | 1-so'rov instance'ni uyg'otadi | **TAVSIYA** (keep-warm ping / instance upgrade) — kod yo'q | ~30-60s (idle holatда) |
| fal queue + model exec | fal/model | qaytarib bo'lmaydi | model ishlash vaqti | — (floor) | — |
| Direct `fal.run` (sync) | docs | — | docs: "reliability past" | **TEGILMADI** (rad etildi) | — |
| reconcile `/gen`'da | `studio-gen.ts` | `await` (refund-before-charge) | ~ms (kredit xavfsizligi) | **QOLDIRILDI** (kredit > ~50-300ms) | — |

**Net:** count=1 (eng keng tarqalgan): ~2-3s tezroq (poll ramp + parallel preflight). count=4: ~16s tezroq (~2×). Cold-start: tavsiya.

## XAVFSIZLIK (real oqim/kredit/refund BUZILMADI)
- **Adversarial workflow** (3 mustaqil reviewer): parallel count loop kredit/refund/timeout/@imgN-order invariantlarini SAQLAYDI — qisman-xatoда STRICTLY SAFER (orphan asset YO'Q vs eski). 2 reviewer **OOM blocker** topdi (cheklanmagan `Promise.all` N buferni RAMда → GEN_CONCURRENCY OOM himoyasini buzadi) → **`mapLimit` (limit 2) bilan tuzatildi**: peak xotira = limit×GEN_CONCURRENCY, 429 burst ham cheklangan.
- Mantiq: timeout sentinel tekshiruvi BIRINCHI → timeout aralash bo'lsa ham refund YO'Q; haqiqiy xato → `fail()` BIR MARTA (to'liq refund) + 0 DB asset; hammasi OK → assetlar TARTIBDA.

## TEKSHIRUV
- `npm run build -w apps/api` — **tsc TOZA**. Plagin 6 `<script>` blok `new Function` — **0 xato**.
- **Node izolyatsiya testi** (mapLimit + slot-mantiq): tartib+concurrency-bound (peak≤2), all-ok→3 asset, real-fail→1 refund+0 asset, timeout(+fail aralash)→refund yo'q, count=8/limit=2→peak 2 — **6/6 PASS**.
- **Headless** (preview brauzer, mock API): real gen oqimi ISHLAYDI — `cost-quote`+`sessions` ikkalasi parallel (Promise.all), /gen→poll(ramp)→natija, busy spinner tozalandi.
- ENV: `GEN_IMG_CONCURRENCY` (default 2) bilan sozlanadi. FAL_KEY o'zgarmadi.
- KUTILMOQDA: backend **PUSH** (Render deploy) → AE'da real tezlik o'lchash.
