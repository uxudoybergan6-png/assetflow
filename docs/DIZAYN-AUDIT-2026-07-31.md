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

### D0 natijasi (2026-07-31, fix-kampaniya)

- **P0-1 — ROOT CAUSE TUZATILDI (kod).** Kvota tugashining haqiqiy sababi `minScale=1` emas, **fon
  timerlarining qat'iy intervali** edi: `savedRefCleanupTimer` **har 2 daqiqada**, gen resume **har
  30 sekundda** DB so'rovi yuborardi. Neon compute ~5 daqiqa TO'LIQ jimlikdan keyin suspend bo'ladi
  → hech kim mahsulotdan foydalanmasa ham compute 24/7 hisoblanardi. Yechim: yangi
  `apps/api/src/lib/idle-timer.ts` (`startAdaptiveTimer`) — pass ish topsa baza interval, ketma-ket
  bo'sh passlarda kechikish 1 soatgacha ikkilanadi, yangi ish `nudge()` bilan darhol bazaga tushadi.
  Qo'llanildi: gen resume (30s), global gen reconcile (10 daq), saved-ref cleanup (2 daq),
  template-reconcile (10 daq). **Pul zonasi tegilmagan** — refund kechikishi aktiv/nudge holatida
  ilgarigidek (`cutoff + baza interval`); orqaga chekinish FAQAT non-terminal gen NOL bo'lganda.
- **Cloud Run `minScale=0` — RAD ETILDI (qaror).** `--no-cpu-throttling --min-instances 1` saqlanadi:
  minScale=0 bo'lsa fon gen/ingest ishlari sovuq startlar orasida yo'qoladi (memory: "Cloud Run
  fire-and-forget" tuzog'i). DB uyqusi endi timer darajasida hal qilingan.
- **Egasi tomonidan:** Neon plan upgrade yoki 1-avgust kvota reseti; `db:"ok"` bo'lgach 8 kutayotgan
  migratsiya (`npm run migrate:deploy -w @creative-tools/database`).
- **P0-2 — NO CHANGE NEEDED.** Jonli `getframeflow.app` qayta tekshirildi (2026-07-31): `<html lang="en">`,
  `meta name="description"`, canonical va 5 ta OG/twitter tegi BOR. CF Pages deploy yetib kelgan.
- **P0-3 — NO CHANGE NEEDED (kodda), egasi qarori.** `assetflow-20j.pages.dev` endi AYNAN shu
  kontentni beradi (dev-xabar yo'q) va `canonical` `getframeflow.app`ga ishlaydi → SEO dublikat
  yopilgan. Host-asosidagi redirect CF Pages `_redirects`da mumkin emas; egasi CF panelida
  pages.dev subdomenini o'chirsin yoki redirect rule qo'ysin.

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

---

## 6 · BATCH davomida topilgan yangi findinglar (scope'ga qo'shilmagan)

**N1 (P2, `styles/app.css`) — yorug' temada FILL tokenlari matn uchun AA'dan o'tmaydi.**
`[data-theme="light"]` bloki faqat `--bg-*`, `--line*`, `--tx-*`, `--violet*` va `*-dim`/`*-line`
tuslarini almashtiradi; `--green/--red/--yellow/--orange/--blue/--gray` esa qorong'i fonda
TO'LDIRISH uchun tanlangan qiymatlarda qoladi. Oq/tus fon ustida matn sifatida ishlatilganda
kontrast 2–3:1 ga tushadi (o'lchandi: `--green` ~1.9:1, `--red` ~3:1). D3'da faqat ikki auth
banneri (`.auth-ok`, `.auth-error`) nishonli tuzatildi; qolgan iste'molchilar — status badge'lar,
`.btn-success` matni, trend strelkalari, contributor/admin jadval holat nuqtalari — tekshirilmagan.
**Tavsiya:** `light` blokiga alohida `--green-ink/--red-ink/...` "matn" tokenlari kiritib, badge/matn
iste'molchilarini ularga o'tkazish (D6 dizayn-tizim birlashtirishida).

**N2 (P3, `platform/index.html`) — `.ffm-btn` da `:disabled` uslubi yo'q edi.**
`disabled="{{ ... }}"` bindinglari mavjud (Explore submit, `:17803`) lekin tugma bosiladigandek
ko'rinardi. D3'da `.ffm-btn/.ffm-btn2:disabled` (opacity .55 + not-allowed + hover:none) qo'shildi —
boshqa SPA tugma sinflarida (`va-*`, `ffa-*`) shu tekshiruv o'tkazilmagan.

**N3 (P3, `dist/`) — `packages/assetflow-studio/dist/` eskirgan artefakt.**
`studio:sync`/`prepare-vercel.mjs` bu papkani QAYTA YOZMAYDI (faqat CF Pages build yozadi), shuning
uchun grep natijalarida o'chirilgan CSS (masalan `.auth-back`) tirik ko'rinadi va auditni chalg'itadi.

**N4 (P3, `styles/app.css` — N1 ning bir ko'rinishi) — `.avatar-brand` bosh harflari yorug' temada 3.7:1.**
D4'da avatar gradienti tokenlarga o'tkazildi (hardcode binafsha ketdi), lekin yorug' temada
`--violet-bright` = `#0d9488` va oq `--on-accent` bilan kontrast 3.73:1 (qorong'i uchida 5.45:1) —
11px qalin matn uchun AA (4.5:1) dan past. Eski hardcode gradient ham shunga yaqin edi (4.37:1),
ya'ni regressiya emas; bosh harflar yonida ism matni ham ko'rinadi. **Tavsiya:** N1 bilan birga D6'da
yorug' tema uchun bir pog'ona to'q "ink" varianti.

**N5 (P3, `platform/index.html:15712`) — `.va-rejbanner` markazlashuvi kirish animatsiyasi davomida buziladi.**
D5 (#17) toastda o'lchangan naqsh: `transform:translateX(-50%)` bilan markazlashgan `position:fixed`
element `animation:ffRise` (from `translateY(12px)`) ni oladi — animatsiya transform'ni butunlay
yozadi, shuning uchun ~250 ms davomida element ekran markazidan chapga (`left:50%` nuqtasiga)
sirg'aladi. Toastda markazlash `translate:-50% 0` xossasiga o'tkazilib tuzatildi (ikkisi qo'shiladi);
`.va-rejbanner` da AYNI defekt qoldi (P30 banneri, kamdan-kam chiqadi). **Tavsiya:** D6'da bir xil
almashtirish (`transform:translateX(-50%)` → `translate:-50% 0`). → **D6'da TUZATILDI** (`:15409`).

**N6 (P2, `platform/index.html` — sinf: hodisa-delegatsiya) — element `load` hodisasi `window`ga chiqmaydi.**
DOM spetsifikatsiyasiga ko'ra element `load` hodisasining tarqalish yo'lida Window YO'Q (`window.onload`
bilan aralashmasligi uchun istisno) — brauzerda o'lchandi: `<img>` uchun `document` capture listener
ishlaydi, `window` capture listener HECH QACHON chaqirilmaydi (`error` va `loadedmetadata` esa ikkalasida
ham ishlaydi). D5 (#18) da media skeleton listeneri `document`ga ko'chirildi. Boshqa sirtlar (plagin,
contributor studio) grep bilan tekshirildi — bu naqsh boshqa joyda YO'Q, ya'ni faqat shu bitta joy
zararlangan edi. Yozib qo'yildi: kelajakda media delegatsiyasi yozilganda `document` ishlatilsin.

**N7 (P3, admin JS) — xom `alert()` va `prompt()` hali qoldi.**
D6 (#12) barcha `confirm()` chaqiruvlarini `afConfirm` modaliga o'tkazdi (0 ta xom `confirm(` qoldi),
lekin `js/admin-releases.js` dagi xabar `alert()` lari va `js/admin-business.js:62` dagi `prompt()`
(marja qiymatini so'rash) OT'ning tizim dialogini chiqaradi: konsol identiteti yo'q, fokus qaytishi
boshqarilmaydi, matn tarjima qilinmaydi. **Tavsiya:** `alert()` → `toast()` (allaqachon bor),
`prompt()` → kichik `openModal` input formasi. Auditda sanalmagan, D6'da topildi.

**N8 (P3, admin JS) — status ranglari hali inline hex.**
D6 (#15) faqat aksent (lime) va kul-rang matn shkalasini tokenlashtirdi. Holat ranglari — `#FF6B5E`
(xato), `#FFB27C` (ogohlantirish), `#7CC4FF` (tanlangan), `#DCE7C8` — admin JS'ida hamon xom yozilgan,
holbuki `admin.css .adx-app` da `--red/--amber/--select` tokenlari MAVJUD. Aksent kabi kritik emas
(`portal-admin` ularni almashtirmaydi), lekin bo'lajak yorug' tema uchun ayni to'siq (N1 bilan bir sinf).

**N9 (P3, `platform/index.html:17640`, `:20571`) — JS ichidagi glif konstantalari.**
`const GLYPH = { image:'⊞', video:'▶', audio:'♪' }` va mention chip `glyph:'▶'` — D6 (#16) da
sanalgan to'rt belgidan (`⬇↻⧉🗑`) tashqari, shu sababli tegilmadi. Ular thumbnail placeholder va
chip ikonasi sifatida ishlatiladi; `⊞`/`♪` OT'ga qarab har xil kenglikda chiqadi. **Tavsiya:** sprayt
(`i-img`/`i-vid`/`i-wave` allaqachon bor) yoki Phosphor sinfiga o'tkazish.

---

## 7 · Qarorlar (BATCH ichida qabul qilingan, kod bilan tasdiqlangan)

**Q1 (D6 #15) — Brend lime yagona etalon: `#d8ff3e` (+ `#baf02c` ikkilamchi, `#0a0d02` on-accent).**
Manba: `plugins/after-effects-cep/css/tokens.css` neon `--accent`/`--accent-2` = platforma
`--th-accent`. Tortildi: studio `app.css --violet/--violet-bright` (#82c341/#a3e635 →
#baf02c/#d8ff3e, inline `rgba(163,230,53,…)` glowlar ham) va admin `admin.css --lime/--lime2/
--onlime/--glow/--limedim` + 10 `admin-*.js` faylidagi inline `#C2F04A/#9CD62B/#0E1400`
(#d8ff3e/#baf02c/#0a0d02). Barcha fill'lar qorong'i matn (`--on-accent`/`--onlime`) bilan
juftlashgan — yorqinroq lime kontrastni FAQAT yaxshilaydi. TEGILMAGAN: yorug' tema bloklari
(`app.css:123`, `:971`, `:137`) — ular ataylab to'qroq, AA uchun (audit N1/N4 shu haqda).

**Q2 (D6 #15) — aksent alfalari `color-mix` bilan tokenlashtiriladi, xom `rgba()` bilan emas.**
Fokus halqasi kabi joylarda aniq alfa (.5 border, .12 shadow) kerak, lekin rang tokendan kelishi shart.
`rgba(216,255,62,.5)` ni saqlab qolish tokenni chetlab o'tadi; yangi `--lime-50` turkumini kiritish esa
token soni portlashiga olib keladi. Tanlangan: `color-mix(in srgb,var(--lime) 50%,transparent)` — alfa
saqlanadi, rang `body.portal-admin` amber almashtirishini kuzatadi. Brauzerda o'lchandi (:3001):
`.adx-app` ichida xom `rgb(216,255,62)` = **0 ta** element, `--lime` = `#FFB000` (amber identitet).

**Q3 (D6 #15) — `--text2:#B7C0CE` YANGI token sifatida kiritildi.**
2-darajali matn admin JS'ida 41 joyda tokensiz hardcode edi (`--text`/`--muted` orasidagi pog'ona).
Tokenlashtirilgan jami: 200 kul-rang + 60 lime inline qiymat, 11 faylda. **Istisno** (ataylab xom
qoldirildi): `js/admin-website.js:32/:176/:179` — bular public-sayt CMS *ma'lumoti* (aksent preset
katalogi, sozlangan aksent fallback'i, kontrast hisoblash natijasi) va API'ga yuboriladi, konsolning
o'z UI rangi emas; tokenga aylantirilsa saytga `var(--lime)` matni ketardi.

**Q4 (D6 #17) — o'lik self-hosted shrift qatlami (319 qator, 35 `@font-face`) o'chirildi.**
`platform/index.html` da 'Hanken Grotesk' (20) + 'IBM Plex Mono' (15) e'lon qilingan edi; barcha
iste'molchi `var(--sans)`/`var(--mono)` ga o'tgach bu familylar hech qanday font-stack'da qolmadi.
Brauzerda tasdiqlandi (:8975 reload'dan keyin): Hanken iste'molchi **0**, Plex **0**, uch token ham
hal bo'ladi. `.woff2` FAYLLARI O'CHIRILMADI — `styles/admin.css` ayni yo'llardan self-host qiladi
(shu sabab dizayn-tizim 09-jadvalida admin qatori hamon 'Hanken Grotesk' ko'rsatadi — bu haqiqat,
sirtlar orasidagi real farq; uni birlashtirish D6 ko'lamida emas edi).

**Q5 (D6 #12) — `afConfirm` promise qaytaradi, callback qabul qilmaydi.**
8 ta chaqiruv joyi allaqachon `async` edi, shuning uchun `if (!(await afConfirm({…}))) return;`
naqshi xom `if (!confirm(…)) return;` semantikasini AYNAN saqlaydi — funksiyalarni ikkiga bo'lish
kerak emas. Bekor qilishning HAR yo'li `false` bilan hal bo'ladi (brauzerda o'lchandi: Cancel tugmasi,
Esc, scrim bosish, ustiga boshqa modal ochilishi) — `closeModal()` ichidagi yagona nuqtada.
Matn `afConfirm` ichida bir marta escape qilinadi (`toast()` konventsiyasi).

**Q6 (D6 #12) — `--r-xl` O'CHIRILDI (18px ga o'zgartirilmadi).**
Iste'molchisi 0 ta edi; 16px qiymati o'z izohidagi "6/10/14" skalasiga ham, platformadagi
`--th-r-xl:18px` ga ham qarshi turib skala haqida yolg'on ma'lumot berardi. O'lik tokenni to'g'ri
qiymat bilan saqlab qolish = hech kim tekshirmagan yana bitta da'vo.

**Q7 (D6 #16) — ikon almashtirish menyudan tashqariga chiqarildi.**
Finding #16 dalili `.va-axmi` menyusi edi, lekin AYNI to'rt glif (`⬇↻⧉🗑`) bir xil ekranda yana
3 joyda: sessiya bulk paneli (`:16791/:16792`), loyihalar bulk paneli (`:17242`) va karta amal
paneli `↻` (`:16875`). Yarim-Phosphor ekran qoldirish findingni yopmagan bo'lardi, shuning uchun
hammasi tuzatildi. Karta panelida Phosphor EMAS, sprayt (`i-refresh` yangi simvoli) ishlatildi —
yonidagi `i-down` ham sprayt, ikki ikon tizimi bir panelda shtrix qalinligida farq qilardi.
Yo'l brauzerda sinaldi (bbox 16×16 yoy + 4×4 uchi). Qolgan gliflar → N9.
