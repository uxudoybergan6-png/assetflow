# AssetFlow — Tuzatish rejasi (Fix Roadmap)

*Manba: full-audit-2026-06-19 (57 agent, 34 tasdiqlangan topilma). Tartib: bog'liqlik + ta'sir bo'yicha.*

---

## Bosqichlar haqida qisqacha

Tuzatishlar 5 bosqichga bo'lingan. Tartib tasodifiy emas:

1. **Bosqich 0 — Poydevor**: avval xavfsizlik to'ri (CI + test). Busiz har tuzatish yangi bug keltirishi mumkin.
2. **Bosqich 1 — Pul qatlami**: eng katta biznes ta'siri (daromad oqishi).
3. **Bosqich 2 — Xavfsizlik**: admin egallash + auth teshiklari.
4. **Bosqich 3 — Barqarorlik**: race condition, cache, webhook.
5. **Bosqich 4 — Tozalash**: o'lik kod, hujjat, masshtab.

Belgilar: 🔴 kritik · 🟠 high · 🟡 medium · ⚪ low
Mehnat: S (kichik, <1 soat) · M (o'rta, yarim kun) · L (katta, 1+ kun)

---

## BOSQICH 0 — Poydevor (avval shu)

| # | Muammo | Fayl | Belgi | Mehnat | Nega avval |
|---|--------|------|-------|--------|------------|
| 7 | Build/test/lint CI yo'q; Prisma migrate gate'siz prodga | `render.yaml:6` (`keepalive.yml` 2026-07-03 da o'chirildi — Cloud Run min-instances 1 kerak qilmadi) | 🟠 | M | Boshqa hamma tuzatishni xavfsiz qiladi. Regressiya ushlanadi. |

**Natija:** PR'da `tsc + lint + verify-*` ishlaydigan CI; migratsiya alohida gated qadamda + Neon snapshot. Shundan keyin qolgan ishlar xavfsiz.

---

## BOSQICH 1 — Pul qatlami (eng katta biznes ta'siri)

| # | Muammo | Fayl | Belgi | Mehnat |
|---|--------|------|-------|--------|
| 1 | **Paywall chetlab o'tiladi** — limit server tomonda majburlanmaydi | `plugin.ts:239-243,470-494`, `plugin-profile.ts:163-223`, `assetflow-catalog.js:815-947` | 🔴 | M |
| 3 | PRO obuna tugasa downgrade bo'lmaydi | `stripe.ts:89-110`, `plugin-profile.ts:79-117` | 🟠 | M |
| 4 | `/gen/describe` + `/gen/prompt/enhance` kreditsiz pulli AI | `studio-gen.ts:298-423` | 🟠 | S |
| 12 | `currentPeriodEnd` doim null (Stripe v18); self-serve PRO fail-open | `stripe.ts:23-27`, `plugin-profile.ts:87-91` | 🟡 | S |
| 16 | Stripe webhook idempotency yo'q (dublikat ishlov) | `stripe.ts:54-116` | 🟡 | M |

**Asosiy g'oya (#1):** yuklab olish/import hisoblagichi **gated action'ning atomik yon-ta'siri** bo'lsin — fayl berishdan OLDIN `updateMany({where: downloadsMonth < limit, data: increment})`; agar `count===0` → 403. `/usage/*` faqat analitika qilib qoldiriladi.

---

## BOSQICH 2 — Xavfsizlik (admin egallash + auth)

| # | Muammo | Fayl | Belgi | Mehnat |
|---|--------|------|-------|--------|
| 2 | 2 ta Stored-XSS → admin egallash | `admin-views.js:283,285,296`, `admin-subscribers.js:181-240,593` | 🟠 | S |
| 5 | Bloklangan akkaunt token'i ishlayveradi; reset/block token'ni bekor qilmaydi | `auth.ts:21-75,190-218`, `plugin.ts:377-383` | 🟠 | M |
| 14 | `req.params.id` sanitatsiyasiz fayl yo'liga (path traversal) | `contributor.ts:345-353`, `template-files.ts:16-24` | 🟡 | S |
| 17 | JWT localStorage'da; global 401 ishlovi yo'q | `login.html:195`, `studio-api.js:66-72` | ⚪ | S |

**#2 eslatma:** `admin-views2.js` allaqachon to'g'ri `esc()` ishlatadi — shu naqshni boshqa ikki faylga ko'chirib, server tomonda ham sanitatsiya qo'shamiz. Diqqat: tuzatgandan keyin `npm run studio:sync` shart.

---

## BOSQICH 3 — Barqarorlik (race, cache, ma'lumot)

| # | Muammo | Fayl | Belgi | Mehnat |
|---|--------|------|-------|--------|
| 6 | Versiyasiz R2 kalit + 1-yillik immutable cache + hash'siz Studio JS | `s3.ts:42,90-100`, `prepare-cf-pages.mjs:66-78` | 🟠 | M |
| 11 | Hisoblagich atomik emas (TOCTOU); qidiruv O(N) in-memory | `plugin-profile.ts:48-57,180-223`, `ai.ts:220-238` | 🟡 | M |
| 13 | Katalog (List) vs serve (Head) qarama-qarshi; dangling metaJson | `catalog-map.ts:139-169`, `serve-asset.ts:20-35`, `contributor.ts:682-713` | 🟡 | M |
| 15 | Inline sinxron ffmpeg transcode, cap'siz | `contributor.ts:613,881`, `optimize-preview.ts:40-72` | 🟡 | L |

---

## BOSQICH 4 — Tozalash (o'lik kod, hujjat, masshtab)

| # | Muammo | Fayl | Belgi | Mehnat |
|---|--------|------|-------|--------|
| 8 | Premiere UXP — noto'g'ri katalogga ulangan tashlandiq prototip | `premiere-uxp/src/api.ts:50-67` | 🟠 | M |
| 9 | Studio JS ~190 ta commit qilingan dublikat, drift bo'lgan | `sync-to-web.mjs`, `prepare-vercel.mjs`, `apps/web/public/studio/**` | 🟡 | M |
| 10 | apps/web + eski Asset route'lari o'lik, noto'g'ri brendlangan | `apps/web/src/**`, `assets.ts`, `admin.ts:37-77`, `packages/shared` | 🟡 | M |
| 18 | `CLAUDE.md` AI tizimni eslamaydi; reja-doc'lar joriy holat deb o'qiladi | `CLAUDE.md`, `docs/**` | ⚪ | S |

---

## Rad etilgan da'volar (VAQT SARFLAMA)

- **ZipSlip** (`mogrt-extract.ts`) — `unzip` o'zi himoyalaydi. Faqat defense-in-depth.
- **Embedding o'lcham nomuvofiqligi** — bugun bir xil model, faol bug emas.
- **Ochiq CORS** — auth faqat Bearer-token, exploit emas, konfig gigiyenasi.

---

## Tavsiya etilgan ish tartibi

```
Bosqich 0  →  #7 (CI)                    [poydevor]
Bosqich 1  →  #1 → #3 → #4 → #12 → #16   [pul]
Bosqich 2  →  #2 → #5 → #14 → #17        [xavfsizlik]
Bosqich 3  →  #6 → #13 → #11 → #15       [barqarorlik]
Bosqich 4  →  #10 → #9 → #8 → #18        [tozalash]
```

Har bandni alohida Claude Code promti qilib beraman. Bittasini tuzatib, test qilib, tasdiqlab, keyin keyingisiga o'tamiz — bir vaqtda ko'p narsani aralashtirmaymiz.

*Yangilangan: 2026-06-19*
