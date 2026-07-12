# BATCH6 — Web platforma redizayni (Higgsfield-ilhom) · DIZAYN BRIF

> Manba: USER so'rovnomasi (2026-07-12, Direktor o'tkazdi). BATCH5 to'liq yopilgach boshlanadi.
> Huquqiy chegara: Higgsfield = ILHOM (naqsh/kayfiyat), 1:1 nusxa/asset ko'chirish EMAS.
> `docs/HIGGSFIELD-ANALYSIS.md` — texnik naqsh tahlili (faza-1 manbasi) shu brifga xizmat qiladi.

## So'rovnoma natijalari (USER)

| Savol | Javob |
|-------|-------|
| Hozirgi palitra (qora + lime) | **UMUMAN yoqmaydi** — butunlay yangilansin |
| Yoqmaydigan qatlamlar | Tipografiya · joylashuv/zichlik · karta-komponent uslubi · jonsizlik (animatsiya yo'q) — **hammasi** |
| Higgsfield'dan olinadigani | Premium kayfiyat · vizual galereya-feed · kompozer UX · presets/effekt vitrinasi — **hammasi** |
| Qamrov | **Butun web platforma** (landing + templates + AI Studio + akkaunt). Plagin — keyin |
| Yangi accent | USER'ga **3 ta palitra-mockup** ko'rsatiladi (Direktor tayyorlaydi), u tanlaydi |
| Tipografiya | **Direktor taklif qiladi** (Higgsfield tahliliga tayanib) |
| Vaqt | **BATCH5 yopilgach** (#7, #6, push+deploy, E2E dan keyin) |

## ⚡ USER QARORI (2026-07-12): 3 TEMA HAMMA JOYDA

Redizayn yakuniy foydalanuvchiga **3 temani tanlash imkoni bilan** chiqadi (noir / neon / cold)
— butun sayt bo'ylab (landing ham, Studio ham), plagindagi 3-tema naqshiga o'xshash:
`html[data-theme]` + localStorage + tema-tanlagich (header/settings). Direktor ogohlantirdi
(brend tarqoqlik + 3× QA yuki) — USER ongli tanladi. Oqibatlar:
- Butun redizayn TOKEN-FIRST bo'ladi: rang/soya faqat CSS var orqali, hardcode TAQIQ (aks
  holda tema-leak); har redizayn-prompt 3 temada skrinshot-tekshiruv talab qiladi.
- ✅ **DEFAULT = A · NOIR PREMIUM** (USER tanlovi, 2026-07-12). B (neon) va C (cold) —
  foydalanuvchi tanlovida. Brend-asset/OG/marketing — noir'da.

## Direktor keyingi qadamlari (BATCH5 yopilgach)

1. Higgsfield'ni qayta tahlil (HIGGSFIELD-ANALYSIS.md yangilash: web sahifa naqshlari bo'yicha).
2. **3 ta palitra-mockup** (HTML preview): (a) neytral-premium (kontent-urg'u), (b) sovuq accent,
   (c) issiq accent — har biri yangi tipografiya taklifi bilan. USER tanlaydi.
3. Tanlangan yo'nalish → to'liq token-spec (rang/shrift/radius/spacing/soya/motion) +
   sahifa-naqsh spec (landing, templates, AI Studio galereya-feed, kompozer, presets vitrina).
4. BATCH6 prompt seriyasi: tokenlar → nav/skelet → landing → templates → AI Studio → akkaunt.
   Har prompt alohida commit; CF Pages preview bilan USER tasdiqlaydi.

## Higgsfield naqsh-tahlili (USER skrinshotlari, 2026-07-12 — Direktor)

**1. Bosh sahifa (feed-first):** tepada promo-strip (neon, taymer bilan) → hero-karusel kartalar →
apps/feature reyka → katta "billboard" seksiya (TV-ramkada video) → ZICH masonry video-feed
(har seksiya oxirida "View all →") → tematik bloklar: Viral Presets (tab + masonry), rasm-poster
grid, banner-kartalar (glow effekt), Marketing/Seedance seksiyalari. Deyarli matn yo'q — KONTENT
o'zi sotadi. FrameFlow'da buni template + gen-namunalar feed'i bilan qilamiz.

**2. Mega-menyu (nav dropdown):** 2 ustun — chapda FEATURES (ikonka + nom + 1 qator izoh,
TOP/NEW badge), o'ngda MODELS (ikonka + nom + izoh + TOP/NEW/PREMIUM badge). Bizning tools +
models katalogiga aynan mos struktura.

**3. Kompozer (pastga qadalgan, suzuvchi):** yumaloq konteyner, ichida: [+] biriktirish ·
placeholder "Describe the scene you imagine" · pastda chip-qator: model-pill (ikonka+nom+chevron) ·
aspect-chip (shakl-ikonka + "3:4") · sifat-chip (♦1K) · nusxa-stepper (− 1/4 +) · Draw tugma ·
o'ngda KATTA neon Generate (✦narx ichida). Promo-strip kompozer USTIDA alohida.

**4. Model dropdown:** qidiruv maydoni + "Featured models" sarlavha + qator: ikonka, nom, badge,
1-qator izoh, tanlanganda ✓. **5. Aspect dropdown:** vertikal ro'yxat, har nisbatga SHAKL ikonkasi
(portret/landshaft konturi) + ✓. **6. Sifat dropdown:** 1K/2K/4K, premium tier'да "Premium" badge.
**7. Draw-to-Edit:** to'liq kanvas-overlay, tepada rejim tablari (Sketch/Draw to Video/Draw to
Edit), pastda chizish toolbar + undo/redo + "Generate Image ✦2"; o'ngda nisbat/o'chirish/info.

**Muhim kuzatuv (rang ironiyasi):** Higgsfield'ning o'zi ham QORA fon + NEON sariq-yashil
(chartreuse) accent ishlatadi — ya'ni USER'ga yoqmagani lime rangining o'zi emas, UMUMIY IJRO
(tipografiya, zichlik, komponent sifati, jonsizlik). Palitra-mockuplardan bittasi ataylab
"Higgsfield-ruh neon" bo'ladi — USER solishtirib ko'rsin.

- Money-zone va backend'ga tegilmaydi — bu SOF frontend davra.
- `platform/index.html` = CF Pages to'g'ridan manba; landing (`ffl-`) allaqachon CMS'dan.
- Har bosqich USER skrinshot-tasdig'i bilan (katta redizayn regressiz bo'lmaydi — bo'lim-bo'lim).
