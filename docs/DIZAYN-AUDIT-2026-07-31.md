# FrameFlow — To'liq dizayn/UX/UI auditi (2026-07-31)

**Qamrov:** AE plagin (Home/Browse, AI Tools, CEP Admin) · Web platforma (Landing/Marketing, Katalog/Detal, AI Studio) · Contributor Studio · Admin panel (adx-) · Auth qobiq (7 sahifa) · Ko'ndalang dizayn-tizim.
**Usul:** 10 sirt bo'yicha parallel dizayn-agent auditi (kod darajasida, fayl:qator dalil bilan) + jonli production tekshiruvi (getframeflow.app) + kritik findinglar qo'lda spot-verify (6/6 tasdiqlandi).
**Natija:** 67 finding — 2×P0 (jonli production), 19×P1, 27×P2, 19×P3. To'liq reyestr (dalil + fix matni bilan): `docs/DIZAYN-AUDIT-FINDINGS.json`.
**Tuzatish rejasi:** `docs/DIZAYN-FIX-SYSTEM-PROMPT.md` (Claude Code'ga tayyor system prompt, D0–D8 batchlar).

---

## 0 · JONLI PRODUCTION (P0 — dizayndan oldin)

| # | Muammo | Dalil |
|---|--------|-------|
| P0-1 | **API DB down** — butun mahsulot ishlamayapti. Root cause aniqlangan: **Neon bepul tarif compute-kvotasi tugagan** (SESSION-REPORT 2026-07-31) | `https://api.getframeflow.app/health` → `{"status":"degraded","checks":{"db":"down","storage":"ok"}}`; `GET /api/plugin/catalog` → 500 `{"error":"Server error"}` |
| P0-2 | **Frontend deploy eskirgan** — manbada bor SEO/OG bloki (BATCH 11) productionda yo'q | Jonli `getframeflow.app` root HTML'da `meta description`/OG teglar yo'q, `<html lang="">` bo'sh; manba `platform/index.html:2,16-20`da hammasi bor. CF Pages redeploy kerak |
| P0-3 | Eski `assetflow-20j.pages.dev` domenida login `StudioApi.isLocalApi()` true deb bilib foydalanuvchiga **"npm run dev:api"** dev-xabarini ko'rsatadi | Jonli tekshirildi; `login.html:195` faqat local uchun mo'ljallangan tarmoq. Eski domen → yangi domenga redirect qilinishi yoki o'chirilishi kerak |

---

## 1 · P1 findinglar (professional taassurotni buzadi) — 17 ta

### AE plagin — CEP Admin (`plugins/after-effects-cep/AssetFlow_Admin.html`)
1. **Eski lime (#82c341) hardcode + tema desync** — panel `data-theme` qo'ymaydi (noir default, `--accent:#fff`), lekin 11 joyda eski yashil gradient/border/focus-ring qolgan → bitta ekranda ikki aksent tizimi. (`:13,:20,:36,:118,:269,:319`; `tokens.css:79 --green:var(--accent)`) ✅spot-verified
2. **Toast `white-space:nowrap`** — eng uzun (eng muhim) tarmoq-xato xabari 360–420px panelda ikki tomondan kesiladi. (`:263`) ✅spot-verified
3. **Batch render himoyasiz** — render paytida overlay-click modal yopadi, folder o'zgartirish `scanState.scenes`ni almashtirib try tashqarisida TypeError → `_renderAllBusy` abadiy qulf. (`:521,:2439-2457,:529`)
4. **Xato matnlari escHtml'siz innerHTML'da** — CEP'da Node ruxsati bor, server xatosi/fayl nomi orqali XSS→RCE vektori; faylning o'z qoidasi (:1049) buzilgan. (`:985,:2194,:2684,:1836-1841`)

### AE plagin — AI Tools (`AssetFlow_Plugin.html`)
5. **Kompozer promptida (chipedit) fokus ko'rinmaydi** — `outline:none`, focus qoidasi yo'q; asosiy kirish maydoni klaviaturada ko'rinmas. (`:3513`; eski `.pbox:focus-within` no-op `:2599`) ✅spot-verified

### Contributor Studio
6. **`.msg` klass to'qnashuvi** — auth `.msg` (markazlash) chat xabar bubllarini buzadi. (`styles/app.css:859` vs `:1106`) ✅spot-verified
7. **Boot'da soxta "No templates" empty state** — skeleton yo'q, ma'lumot kelguncha "hech narsa yo'q" ko'rinadi. (`js/contributor-views.js:211`)
8. **Rights-attestation checkbox klaviaturadan ishlamaydi** — upload klaviatura foydalanuvchisi uchun bloklanadi.

### Auth qobiq
9. **Bitta oqim ichida 3 dizayn-tizim** — login (app.css, teal, frame-mark) → reset/verify/device (BATCH6 standalone, noir/neon/cold, ϟ mark); light-tema foydalanuvchisi majburan qorong'i sahifaga tushadi (`theme.js` 'light' → standalone FOUC 'noir'ga majburlaydi).
10. **Reset/verify USER'ni Contributor Studio loginiga yuboradi** — `reset-password.html:147 location.href='login.html'` + `_redirects` 301 → `/studio/login.html`; oddiy obunachi "Request contributor access" bilan tugaydi. ✅spot-verified
11. **Custom div-checkbox'lar (terms/remember) klaviaturasiz** — `role="checkbox"+tabindex` bor, keydown yo'q → Sign up klaviaturada imkonsiz. (`login.html:124,211`)
12. **Turnstile yuklanmasa register boshi berk** — cheksiz retry, cap yo'q, "Please complete the bot check" lekin widget ko'rinmaydi. (`login.html:223,383`; `platform/index.html:20218`)

### Web platforma
13. **Top-nav qidiruvda fokus ko'rinmaydi** (katalog asosiy kirish nuqtasi).
14. **"Loyihadan olib tashlash" tasdiqsiz qaytarilmas DELETE** — ilovaning o'z "armed 2-klik" naqshi (SC_34) chetlab o'tilgan; mobil'da 26px tugma doim ko'rinadi. (`platform/index.html:20087-20094,15811-15814`)

### Ko'ndalang dizayn-tizim
15. **Uch xil "lime"** — plagin/platforma `#d8ff3e`, studio `#a3e635`, admin `#C2F04A`; izohlar "AE plagin bilan AYNAN" deb yolg'on da'vo qiladi. (`tokens.css:117`, `app.css:34`, `admin.css:125`) ✅spot-verified
16. **Bitta menyuda Phosphor + xom unicode aralash** (`.va-axmi`: `ph-folder-plus` vs ⬇↻⧉🗑). (`platform/index.html:17171-17177`)
17. **Uch shrift-tizimi bitta ilovada** — body Inter, `.va-btn`/`.va-setopt` Hanken Grotesk, `.ffa-shead` IBM Plex Mono. (`platform/index.html:14313,15108,15613,14857`) · **confirm() vs temalangan modal drift** — `admin-plugin-cms.js:281`, `admin-releases.js:130,153`, `admin-website.js:566`, `admin-business.js:68,81,106,127` native confirm; `admin-views2.js:950` esa openModal.

---

## 2 · P2 findinglar (28) — qisqa ro'yxat

**CEP Admin:** approve'dan keyin detail yopiladi (kontekst yo'qoladi); Esc hech qaysi modalni yopmaydi; focus-visible/aria-label = 0, 26–30px hit-targetlar; eskirgan yorliqlar ("Find scenes", "Render cold start").
**AI Tools (plagin):** lowcred/warn banner hardcoded ranglar (3 temaga mos emas); rx/fbx/del 15–16px hit-target.
**Home/Browse (plagin):** limit-sheet/pub/pd3 zonalarida hardcoded oq hairline'lar + `#DCE3ED/#E7ECF3` matn + eski binafsha mockup gradienti (`#2A1E49,#6C3FA8`, `:1441`) + `#12101c` hero fon — neon/cold temalarning rangli borderlariga mos kelmaydi. (Browse holatlari — a7 loading/error/empty — namunali qurilgan ✓)
**Contributor:** qo'ng'iroqchada doimiy qizil nuqta; drawer 2 so'rovni kutib ochiladi; "Fix and resubmit" hech narsa tuzatmay yuboradi; div+onclick qatorlar; mobile Messages 640px qutida; xato toast 3.2s; o'lik eski Overview (~100 qator).
**Auth:** SPA double-submit; 8px labellar; standalone sahifalarda fokus yo'q; pw-toggle faqat sign-in'da; dev jargon ("Set it to ADMIN in PostgreSQL" `admin-login.html:248` ✅); design-system.html buzilgan `${...}` render + eski token qiymatlari; SPA registerda Terms yo'q.
**Platforma:** skeleton-shimmer hech qachon o'chmaydi (`el.closest('.va-axres')` doim null, `:18943-18948`); rel4 grid 4dan kam elementda bo'sh kataklar; va-toast o'lik selektor + inline hardcode.
**Dizayn-tizim:** 4 mustaqil tugma implementatsiyasi (36/44/38px, radius har xil); DS hujjati faqat studio'ni qamraydi.
**Marketing:** faqat `templates` haqiqiy path oladi — pricing/plugin `/#hash` (ulashib/indekslab bo'lmaydi, `:18760`); `document.title` marshrutda yangilanmaydi; og:image yo'q (hujjatlangan qaror — brend rasm asset kerak).

## 3 · P3 findinglar (20) — qisqa

CEP Admin: o'lik CSS avlodi, stats jim xato, 360px breakpoint yo'q. AI Tools: EN-copy siyosati hujjatlanmagan; lowcred 3× nusxa; `.crumb` o'lik; bulk-del `#ff5e5e`. Contributor: reject sabab tooltip'siz; "Overview" vs "Dashboard"; binafsha avatar gradient; beforeunload yo'q. Auth: ?verified=1 iste'mol qilinmaydi; hub soxta ✓ pill; o'lik auth CSS; device kod guruhlash/inputmode. Platforma: mobil tab "Catalog" nomi; `.va-tc` o'lik; karta title atributi yo'q. DS: `--r-xl` 16 vs 18px; AssetFlow_*.html fayl/global nomlar eski brend. Admin: empty-state'larda inline `#B7C0CE/#8A93A3` kulranglar tokensiz.

---

## 4 · Yaxshi qurilgan joylar (regressiya qilmaslik)

- Plagin Browse a7 holat tizimi (skeleton + "server is waking up" + retry + filter-aware empty) — etalon.
- Web AI Studio xato/refund oqimi: halol rad banneri + "✦N refunded" + model taklifi (P30) — etalon.
- Admin adx- empty-state'lar hamma jadvalda bor; huquqiy sahifalar (BATCH 11) SEO bilan tartibda.
- Plagin 3-tema token arxitekturasi (tokens.css) puxta — muammo faqat unga o'tmagan orollarda.

## 5 · Qamrov eslatmasi

10 sirtdan 6 tasi agentlar tomonidan to'liq, 4 tasi (plugin-home-browse, landing-marketing, platform-ai-studio, admin-panel) qo'lda nishonli auditdan o'tdi (sessiya limitlari sabab agentlar qotgan). Bu 4 sirtda qamrov ~70% — keyingi chuqurlashtirish `DIZAYN-FIX-SYSTEM-PROMPT.md` D9 bandida.
