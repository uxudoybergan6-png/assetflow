# Sessiya hisoboti — 2026-07-31 (dizayn fix-kampaniya: D3)

**Oldingi:** D0 (Neon kvota, a8f92c5), D1 (a11y, 2941809), D2 (CEP Admin, e1b0733) yopilgan.

**BATCH D3 — auth oqim birligi (9/13).** 10 fayl: `auth.ts`, `login.html`, `admin-login.html`,
`reset-password.html`, `verify-email.html`, `device.html`, `design-system.html`, `hub.html`,
`styles/app.css`, `platform/index.html`.
(1) **Yo'naltirish** — `POST /reset-password` javobiga `role` qo'shildi; reset/verify sahifalarida
`authDest(role)`: USER→`/` (platforma), CONTRIBUTOR→`/studio/login.html`, ADMIN→`/admin/login.html`;
4 ta "orqaga" havolasi ham `/`ga (ilgari hammasi Contributor Studio = USER uchun berk yo'l).
(2) **Qobiq birligi** — 3 standalone sahifada `light` tema hurmat qilinadi (FOUC skript + `[data-theme=light]`
token bloki + cycle `noir→neon→cold→light`), yagona brand-mark SVG, `device` divider 8→10.5px.
(3) **Turnstile cap** — `login.html` va SPA `renderTurnstile` da cheksiz retry → 25×200ms + inline
yo'riqnoma banneri (`role=status`), submit xabari ham moslashtirildi (CF skriptini 404 qilib tekshirildi).
(4) **Double-submit** — SPA `doAuth` boshida busy-guard + `disabled="{{ authBusy }}"` + `.ffm-btn:disabled`
uslubi (3× klik → 1 `register`). (5) **Copy** — "PostgreSQL" xabari neytral; 2FA yo'li haqiqiy `<a>`
(DOM, innerHTML emas); `?verified=1` ikki login sahifasida success-banner (`.auth-ok`, `replaceState`
bilan tozalanadi, light temada 5.03:1). (6) Parol toggle: register×2, reset×2, device×1.
(7) SPA registerga Terms/Privacy rozilik qatori. (8) `design-system.html` xom `${…}` bloki script-render'ga,
swatch hex jonli `getComputedStyle`dan (tema kuzatuvchisi bilan). **#13** shu batch'da: o'lik auth CSS +
hub soxta ✓ pill (endi lokalda haqiqiy ping, productionda ko'rsatilmaydi).
**#3/#6/#7** D1'da bajarilgan → "no change needed". Pul zonasi tegilmagan; `build -w apps/api` yashil.
**Yangi topildi** (audit §6): N1 light temada `--green/--red` matn kontrasti, N2 `.ffm-btn:disabled`, N3 `dist/`.

**Keyingi qadam:** D4 (Contributor Studio) → D5–D9. Egasi: Neon upgrade / 1-avg reset, keyin 8 migratsiya.
