# Sessiya hisoboti — Admin "Website / Landing" CMS · 2026-07-09

**Vazifa:** FIXPROMPT (standalone) — landing'ni to'liq tahrirlaydigan struktur CMS: hero, mockup kartalar (media), stats, nav/CTA yorliqlari, theme (accent+font).

**Qilindi (3 commit):**
- Backend: `LandingConfig` (id=1, JSON blob, ADDITIVE migratsiya) + `lib/landing-config.ts` (defaultlar = joriy kontent, zod, bo'lim-darajali merge, 30s kesh); ommaviy `GET /api/landing/config` (60s HTTP kesh); admin `GET/PUT/DELETE /api/admin/landing-config` (requireAdmin+audit); upload whitelist'ga `landing` folder.
- Landing (`platform/index.html`): hero/nav/mockup/stats/theme bindinglarga o'tdi — `FFAPI.landingConfig()` + localStorage kesh; kartalar admin media (rasm/video) yoki gradient fallback; custom accent HEX → CSS var override (faqat marketing ekranlar, app UI default qoladi); font — self-hosted to'plam (Hanken/System/Plex Mono/Georgia).
- Admin: `route("website")` + `js/admin-website.js` — matn maydonlari, karta media upload (presigned PUT), accent swatch/picker/HEX, font tanlovi, jonli preview, Save & publish, Reset to defaults.

**Tekshirildi (lokal Postgres + headless Chromium):** default landing 1:1 o'zgarmagan (skrinshot); admin edit→Save→landing hammasi aks etadi (matn, cyan/amber accent, IBM Plex Mono, karta media, stats count-up 55,000+); Reset server+editor'da defaultga qaytardi; 401/403 guardlar; pricing ekrani regressiyasiz. Pul zonasiga tegilmagan.

**Kutilmoqda:** push (foydalanuvchi qiladi), Render deploy + prod `migrate:deploy`, R2'da real media upload sinovi. Eslatma: bu konteynerda `npm run build -w apps/api` 109 ta OLDINDAN mavjud xato beradi (prisma ^6.8.2→6.19.3 drift) — landing fayllarida xato YO'Q.
