# SESSION REPORT — 2026-07-01 — AE plugin: FAST tag + kadr-N badge (mockup parity davomi)

Oldingi "100% rang/shrift parity" sessiyasidan qolgan 2 ta ataylab keyinga qoldirilgan item bajarildi.

- **Qo'shildi:** Video gen KADRLAR bo'limida `.lbl` qatoriga model-aware "FAST" pill (`#vgKadrTag`, faqat `refKind==='frames'` bo'lganda `applyVgMeta()` orqali ko'rinadi) — mockup `sec_11`dagi rang/shrift bilan bir xil (`rgba(124,196,255,...)`, `var(--blue)`, IBM Plex Mono).
- **Qo'shildi:** To'ldirilgan frame-box'larga (`renderFbox`) "kadr 1"/"kadr 2" mono badge overlay (`.fbtag`, `var(--acc)`/`var(--acc-ink)`) — mockup bilan bir xil pozitsiya (bottom-left).
- Ikkalasi ham faqat qo'shimcha (CSS + bitta `<span>`/ID) — mavjud model/refKind mantig'iga tegilmadi. Brauzer preview'da qiymatlar `getComputedStyle` orqali mockup bilan bir xil ekani tasdiqlandi (real model-list fetch lokal preview'da `localhost:4000` yo'qligi sababli ishlamaydi — CEP host'da haqiqiy oqim ishlaydi).
- **Tekshirildi va TEGILMADI:** orqaga qaytish tugmasi (`.crumb .bk`, boxed "‹" dizayni) mockup'dagi borderless "‹ AI Tools" link'dan farq qiladi — LEKIN bu farq faqat ESKI/legacy `v-genvideo`/`v-genimage` ekranlarida (qisman reachable — masalan Edit image → "→Video" tugmasi orqali). Joriy asosiy oqim (`v-vidgen`/`v-imggen`) allaqachon mockup bilan bir xil compact header'ga ega (screenshot bilan tasdiqlandi). Bu — avvalgi audit'da ("o'lik UI avlodlari") qayd etilgan legacy tozalash masalasi, alohida qaror talab qiladi — shu sabab TEGILMADI.

**Kutilmoqda:** foydalanuvchi legacy `.crumb` ekranlarini (genvideo/genimage/editvideo va h.k.) tozalash/yangilashni xohlasa — alohida vazifa sifatida ko'rib chiqish kerak. Commit `7c365c4` mahalliy, push kerak (oldingi `d308a9b`/`5486b11` bilan birga).
