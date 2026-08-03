# Session report — 2026-08-04 (Premiere UXP 0.1.4)

- Premiere 26.2.2 jonli QA: Home, AI launcher, Image, Video, Audio va Stock render PASS.
- Tool→launcher→tool siklidagi qora kadr sababi `axws-tool` flex zanjirini o‘chirib-yoqish edi; UXP’da layout endi AI ichida saqlanadi.
- Global click repaint olib tashlandi; MutationObserver yoki `offsetHeight`/`innerWidth`ga tayanilmaydi.
- Dinamik AI kartalariga throttled mousedown+click qo‘shildi; UXP session picker yangi workspace’ga to‘g‘ridan kiradi.
- `getSystemPath`/secret store yoziladigan UXP DataFolder’dan foydalanadi; login to‘liq restartdan keyin saqlandi.
- Model picker narxi va enabled holati DB ModelPricing bilan quote/gen narxiga tenglashtirildi.
- Stock detail Import CTA matni ko‘rinadi; SFX va video Project panelga import qilindi.
- Raw media muvaffaqiyat sentinellari endi yolg‘on `Import error: unknown` chiqarmaydi.
- Port multi-column CSS’ni olib tashlaydi; session/recent/gallery UXP-safe flex-wrap ishlatadi.
- Host-shim, API build (51 model/24 enabled), release-contract 110/110 va diff-check PASS.
- 0.1.4 CCX yakuniy byte-verify/hash va production deploy/release publish — keyingi qadam.
