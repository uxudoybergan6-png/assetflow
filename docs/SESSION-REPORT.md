# Sessiya hisoboti — 2026-08-01 · CMS v2: Web+Plagin 100% admin boshqaruvi

**Nima qilindi:** Sayt CMS (LandingConfig) 9 yangi bo'lim bilan kengaytirildi — hero billboard media,
promo strip (maxsus kalitlar + app ichida), ticker, cinema, presets (4 media-slot), feed (11 media-slot),
mega-menu modellari, webapp Home (heroSub/quick/tokchalar), Katalog sahifa matnlari. Plagin CMS:
e'lon paneli (tone/CTA/dismiss), 6 kategoriya tayli (label+media), prompt placeholder, guest kicker.
Yangi: Media kutubxonasi admin ekrani (`admin-media.js`, GET/DELETE /api/admin/site-media, usedBy),
versiya tarixi (`ContentConfigRevision` jadval + migratsiya + History/Restore UI), upload hardening
(hajm shipi 40/150MB + audit + GIF aniq). Admin Website: 6 tab (yangi App & Catalog), universal
media-slot editor (16 upload nuqtasi), Plugin CMS jonli mini-preview.

**Topildi:** (1) mockup.cards media admin'da yuklansa ham landingda RENDER QILINMASDI (o'lik
heroCardsA/B) — hero billboard yangi heroMedia bilan ulandi; (2) stats.suffix zod max(12) default
"connected workflow"dan kichik — Website saqlash 400 bilan yiqilardi (max 24 qilindi); (3) plagin
CMS'da 2 o'lik binding (shelf/browseAll) editor'dan olib tashlandi.

**Isbot:** API tsc/build ✓ · verify-public-copy 137/137 ✓ · test:plugin-responsive ✓ · lokal jonli:
admin login→Save/Restore/History ✓, plagin bootda e'lon/tayl/dismiss ✓ · CF Pages build ✓.

**VIZUAL MUHARRIR (d07817a):** Website admin endi preview-birinchi — REAL sayt iframe'da
(?ffcms=1), istalgan joy bosiladi → o'ng panel o'sha maydonlarni ochib belgilaydi, yozganda sahifa
DARHOL yangilanadi (draft, saqlashsiz). 46 data-cms nishon; CSP frame-ancestors admin'ga ochildi.
Plugin CMS previewda ham click-to-jump. Isbot: handshake "Live preview connected" ✓, panelga
yozilgan matn iframe'dagi haqiqiy sahifada skrinshotda ko'rindi ✓.
**Topildi:** jonli CDN'da landing/ prefiksi 403 — deploy qilingan cdn-proxy Worker ESKI
(MEDIA UNREACHABLE sababi). public-keys.ts tegildi → push'da deploy-cdn-worker.yml qayta deploy
qiladi (CLOUDFLARE_API_TOKEN/ACCOUNT_ID secretlari shart; bo'lmasa qo'lda `wrangler deploy`).
**Kutilmoqda:** push (migrate-gate + cdn-worker redeploy) → prod smoke.
