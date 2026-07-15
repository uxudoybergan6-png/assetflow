# V2 BAJARISH — MEDIUM (o'rta) — 2026-07-14

> MUAMMOLAR V2 (P1–P24) qayta tartiblandi. Bu fayl — O'RTA og'irlikdagi 9 ta ish.
> Har promptning TO'LIQ matni: `docs/MUAMMOLAR V2-2026-07-13.md` (mos P bo'limida).
> Qoidalar: bittalab ishlat, orada `/clear`. PUSH faqat EGA qiladi.
> Hammasi **Sonnet 5** uchun mo'ljallangan (kunlik ish oti).

## BAJARISH TARTIBI (tavsiya)

| # | Blok | Muammo | Model | Bog'liqlik / eslatma |
|---|------|--------|-------|----------------------|
| 1 | A | **P6 — Web refresh buglari** (/stock ensureBrowse yo'q; jim o'lish → Retry; auth retry; warm-up ping; gen-poll audit) | Sonnet 5 | P5 (High C) bilan BIR VAQTDA ishlatma; undan keyin afzal |
| 2 | B | **P21 — Ikonka-shrift qorovuli** (Phosphor yuklanmasa retry; □ o'rniga neytral; inventar hisobot) | Sonnet 5 | P7 (Easy) preload bilan kesishadi — dedup qilinadi |
| 3 | C | **P14 — Popover/dropdown yopilishi** (tashqi bosish + Esc, hamma joyda; plugin ham) | Sonnet 5 | P15/P19 Esc-qatlamlari bunga moslashadi — OLDIN ishlatilgani ma'qul |
| 4 | D | **P19 — "Use ▾" menyu noto'g'ri joyda** (multicol ichida abs-pos → fixed; scroll'da yopilish) | Sonnet 5 | P14'dan keyin (Esc bir qatlam qoidasi) |
| 5 | E | **P15 — Kompozer katta prompt'da shishishi** (200px cap + ichki scroll + ⤢; plugin 140px) | Sonnet 5 | P14'dan keyin (Esc expand'ni yig'adi) |
| 6 | F | **P18 — Qora referens kartalari + preset-chip model-gate** (birinchi kadr preview; Seedance'ga cheklash) | Sonnet 5 | P24 (High H) SHU gate'ga tayanadi — P24'dan OLDIN majburiy |
| 7 | G | **P12 — Model pin/unpin + parametrlar eslab qolinishi** (prompt saqlanmaydi; plugin prefs) | Sonnet 5 | Mustaqil |
| 8 | H | **P13 — Model brend ikonkalari** (server metadata + inline SVG; noto'g'ri logo taqiqlangan) 🔴 gen-models diff-tekshiruv | Sonnet 5 | Mustaqil; narx satrlari bayt-bayt tekshiriladi |
| 9 | I | **P2 — Narx matnini to'g'rilash** (4K/watermark endi Pro afzalligi emas; "X of 15 left"; CMS + plugin) | Sonnet 5 | P1 (High A) qaroriga mos — P1'dan keyin ishlatilgani to'g'ri |

## AUDIT QO'SHIMCHASI (2026-07-14, DIREKTOR-AUDIT-V2 fayliga qara — P25–P34)

| # | Blok | Muammo | Model | Eslatma |
|---|------|--------|-------|---------|
| 10 | J | **P26 — To'lov UX teshiklari** (tugma disable, checkout-qaytish, niyat saqlash, idempotency) 🔴 | Sonnet 5 (server dedup kerak bo'lsa Fable) | LAUNCH'dan oldin SHART |
| 11 | K | **P29 — Admin yolg'on boshqaruvlari** (block-sabab, approve-notify, stub tugmalar, double-submit) | Sonnet 5 | P4 (Easy A) dan keyin |
| 12 | L | **P30 — Gen o'chirish tasdiqsiz + jim skeletonlar** | Sonnet 5 | P6 (A) uslubi bilan mos |
| 13 | M | **P31 — Modal a11y** (Esc/focus/scroll-lock/Enter) | Sonnet 5 | P14 (C) dan keyin |
| 14 | N | **P33 — Ishonch UI** (soxta "Sardor" social proof, placeholder javonlar, favorites server-sync, sana format, 9px matn) | Sonnet 5 | Istalgan payt |

## Eslatmalar

- **P2 CMS tuzog'i:** CMS'da saqlangan matn kod defaultini bosib ketadi — IKKALASI ham
  yangilanishi shart (prompt ichida bor).
- **P18 → P24 tartibi muhim:** plugin va webdagi SD2-EDIT-PRESETS nusxalari sinxron
  qolishi kerak.
