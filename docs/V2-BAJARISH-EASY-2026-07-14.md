# V2 BAJARISH — EASY (yengil) — 2026-07-14

> ✅✅ **BAJARILDI — 8/8 bo'lim (2026-07-14).** Combined prompt bir urinishda tugadi.
> Commitlar (PUSH YO'Q): A=7922b9a · B=6f13ff4 · C=41cc7ca · D=055161f · E=e70bc50 ·
> F=cc3c18c · G(🔴 maxfiylik)=ad6379d · H=530f4f9.
> Boshida BATCH6 #6 (Pricing/Plugin porti, 6 platforma fayli) alohida checkpoint qilindi
> (commit 1d9c729) — V2-EASY toza ustidan tushdi.
> Topilma: H-6 ("Recent activity" timeline) o'lik kod ekan (admin-dashboard.js overview'ni
> qayta belgilaydi) — patch emas, o'chirildi. Barchasi node --check + studio:sync + CEP
> reinstall + smoke-test (toast cap, mention XSS, thread reorder) o'tdi.
> 👉 KEYINGI: USER PUSH → HIGH bloki (P1'dan). Eslatma: SESSION-REPORT.md parallel sessiya
> (BytePlus notes) egallagan — ustiga yozilmadi.
>
> ⚡ (Tarix) EGA QARORI: barcha EASY ishlar BITTA sessiyada —
> `docs/V2-EASY-COMBINED-PROMPT-2026-07-14.md` (8 bo'lim A–H).

> MUAMMOLAR V2 (P1–P24) qayta tartiblandi. Bu fayl — YENGIL 6 ta ish (diagnoz aniq,
> diff kichik, xavf past). Har promptning TO'LIQ matni:
> `docs/MUAMMOLAR V2-2026-07-13.md` (mos P bo'limida).
> Qoidalar: bittalab ishlat, orada `/clear`. PUSH faqat EGA qiladi.
> Hammasi **Sonnet 5** uchun.

## BAJARISH TARTIBI (tavsiya — istalgan tartibda ham bo'ladi)

| # | Blok | Muammo | Model | Eslatma |
|---|------|--------|-------|---------|
| 1 | A | **P4 — Admin panel `'" />` bug'i** (renderThumb onerror portlashi; bulk-bar hint; bulk reject confirm) | Sonnet 5 | ENG BIRINCHI — admin hozir ishlatib bo'lmaydigan holatda; bitta qator hammasini buzgan |
| 2 | B | **P3 — Contributor upload tugagach qotib qolishi** (success-karta; qayta kirishda tozalash; dashboard CTA) | Sonnet 5 | Pluginda contributor upload yo'q — Code tasdiqlaydi |
| 3 | C | **P7 — Avatar zaxira ko'rinishi** (plugin bo'sh doira bug'i; 302 kesh 30 min; admin font preload) | Sonnet 5 | P21 (Medium B) bilan kesishadi — preload dedup |
| 4 | D | **P8 — Karta tur-belgilari** (hamma narsa "Ae" emas — Motion/LUT/Music/SFX/AI jadvali; plugin ham) | Sonnet 5 | Displey-only; filtrlraga tegilmaydi |
| 5 | E | **P10 — Hover-preview poster qaytishi** (mouse ketganda video qotib qolmasin) | Sonnet 5 | P9 (High B) dan keyin kesh arzon — lekin mustaqil ham ishlaydi |
| 6 | F | **P16 — Lightbox kattaroq + burchak belgisi + "Rasm yaratish" o'zbekcha matn tozalash** | Sonnet 5 | Repo bo'ylab o'zbekcha UI-matn sweep hisobot bilan |

## AUDIT QO'SHIMCHASI (2026-07-14, DIREKTOR-AUDIT-V2 fayliga qara — P25–P34)

| # | Blok | Muammo | Model | Eslatma |
|---|------|--------|-------|---------|
| 7 | G | **P25 — Sessiya tugaganda holat sizishi** (bitta resetUserState(); maxfiylik!) 🔴 xavf yuqori, diff kichik | Sonnet 5 | P4 dan keyin DARHOL — eng tez daromadli fix |
| 8 | H | **P34 — Housekeeping** (CSS cache-bust, 3-nusxa js, toast cap, mention esc, temp-papka prune) | Sonnet 5 | Eng oxirida |

## Eslatma

Bu fayldagi ishlar mustaqil — kutish shart emas, High/Medium bloklar orasida "bo'sh
o'rinlarda" ishlatsa bo'ladi. Faqat bitta Code sessiyada bitta prompt qoidasi saqlanadi.
P25 istisno: maxfiylik xavfi bo'lgani uchun navbatni kutmasin.
