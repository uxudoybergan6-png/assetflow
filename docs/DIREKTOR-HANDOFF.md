# DIREKTOR-HANDOFF — Loyiha Direktori davom-kiti

> Yangi chatda davom etish uchun: bu faylni Claude'ga bering + pastdagi ROL bo'limini qo'ying, so'ng "shu joydan davom et" deng.

## ROL (Claude'ga qayta beriladi)

Sen — foydalanuvchi (o'zbek) bilan Claude Code o'rtasidagi "Loyiha Direktori"sisan.
Vazifang: kod yozish EMAS. Foydalanuvchining o'zbekcha xom g'oyasini Claude Code
uchun TO'LIQ INGLIZ tilidagi, self-contained, one-shot bajariladigan promptga
aylantirasan (nima qilish, qaysi fayl, chegaralar, kutilgan natija, noaniqlikda
qanday qaror). Har prompt oxiriga: "When finished: (a) commit with a clear concise
message (no Co-Authored-By); do NOT push. (b) write a short summary." Model tanla:
oddiy/kichik/aniq (CSS, joylashuv, bitta fayl) → SONNET 5 (arzon kunlik ish uchun
FAQAT Sonnet 5, Haiku EMAS); murakkab/ko'p qatlamli/migratsiya/refactor → OPUS yoki
FABLE 5. ⚠️ MODEL YANGILANISH (2026-07-04, benchmark bilan tasdiqlangan): FABLE 5
kodlashда eng kuchli — SWE-Bench Pro 80.3% (Opus 4.8 = 69.2%), murakkab/uzun
vazifalarда ustunligi kattaroq. Kamchiligi: kvotani ~2x tez yeydi (Fable $50 vs
Opus $25 / 1M token). Katta/murakkab plagin va backend ishlariga FABLE 5 (+ "Extra"/
"High" effort) tavsiya; oddiyга Sonnet 5. Kvota tejash kerak bo'lsa → Opus 4.8 yoki
Fable 5 "Medium".
Code natijasini
foydalanuvchiga O'ZBEK tilida, sodda (texnik bo'lmagan odam tushunadigan) qilib
tushuntir. Foydalanuvchi bilan doim o'zbekcha; faqat Code prompti inglizcha.

## LOYIHA

- FrameFlow (eski nom AssetFlow). Repo: `~/Projects/creative-tools-saas`.
- AE shablon marketplace + AI generatsiya studiyasi.
- Infra (haqiqiy): Cloud Run API (`api.getframeflow.app`) + GCS + Vertex AI +
  Neon PG + CF Pages (`getframeflow.app`). Batafsil: `docs/PROJECT-STATUS.md §-1`.
- Plagin: `plugins/after-effects-cep/AssetFlow_Plugin.html` (~792KB, bitta fayl).
  Plagin server deploy'ga KIRMAYDI — AE ichiga `install-cep.sh` bilan o'rnatiladi.

## HOZIRGI KATTA ISH: Plagin redesign (mockupdan 1:1)

Dizayn manbai (yagona haqiqat): `packages/assetflow-studio/platform/_frameflow-redesign-mockup.html`
— 32 panelli flow board. Zonalar:
- z-home: 1b (Home) · z-rasm: 1d (Rasm) · z-found: f1-f4 (tokens/tipografiya)
- z-a: a1-a7 (Katalog) · z-b: b1-b12 (AI Tools) · z-g: g1-g3 (Hisob)

### 1:1 ko'chirish USULI (nega ilgari buzilardi → yechim)
1. "O'xshat" EMAS — "verbatim ko'chir": mockupdagi aniq hex/px/radius/gap so'zma-so'z,
   tokenlashtirmasdan.
2. Bitta ekran/holat bir promptda (hammasi birdan = 1:1 buziladi).
3. Shrift LOKAL (CDN emas) — AE ichida internet/CSP yo'q. (Home'da qilindi.)
4. RESPONSIVE majburiy: kartalarga aspect-ratio (fixed height emas) +
   grid `repeat(auto-fill,minmax(Wpx,1fr))`. Tor (~380px)=mockup 1:1, keng=ko'p ustun.
5. Tekshiruv: Code headless Chrome bilan 380px VA ~900px skrinshot olib solishtirsin.

### PROGRESS
- [x] Home (1b) — 1:1 + lokal shrift + responsive. AE'da ishlaydi. (commit f5b0a30, 5804e9f)
- [x] Katalog a1 (grid) — REBUILD qilindi (eski struktura a1'dan farq qilardi) → 1:1
      + responsive (aspect 171/96, auto-fill minmax166). 380px/900px tasdiqlangan.
      (commit e7c5b71). Eslatma: pastdagi .foot account bar + #afFtr connection strip
      a1'da yo'q — ular Account/connection doirasi, qoldirildi (Home'da ham bor).
      USER O'ZGARISHI: grid header (.af-cathead) son+sort markazda (a1'da chap/o'ng
      edi) — "BARCHA SHABLONLAR · N · MOS ⌄" markazda guruh. (commit 3703999)
      USER O'ZGARISHI #2: chip qatori (.af-tabs Shablonlar/Motion/Graphics/LUTs) ham
      markazda (a1'da chapda edi). Ikki qator izchil markazda. (commit 0accdd3)
- [x] Katalog a2 (filtr) — REBUILD: ichki panel → bottom-sheet (a2). #filterSheet
      qo'shildi, #filterPanel olib tashlandi (#envScope carrier qoldi). Barcha filtr
      mantig'i saqlangan (selectCategory/selectOrientFilter/selectResFilter/
      toggleCatalogAi/selectSort/clearAllFilters). Ochish=filter btn, yopish=backdrop/
      apply/Esc. 380px 1:1 + 900px (440px markazda). (commit 3c1f8c3)
- [x] Katalog a3 (shablon detail) — 1:1 (commit c6de64c)
- [x] Katalog a4 (import oqimi: progress + success toast + MOGRT multi-select sheet) (bc297b4)
- [x] Katalog a5 (limit holatlari: Free oylik limit + PRO qulf sheet'lari; server 402/403) (2dec697)
- [x] Katalog a6 (Kutubxonam: Sevimli grid + Yuklab olingan qator + segment) (28a12e0)
- [x] Katalog a7 (holatlar: cold-start · xato · bo'sh natija) (ae651ce) → PILLAR A TUGADI
- [x] AI Tools b1–b12 (butun Pillar B) — 1:1, 10 commit + 2 tuzatish sweep (post-live-test):
      glass panel, in-place popover sozlamalar (bottom-sheet EMAS), model-aware boshqaruv
      (refKind/maxRefs/endFrame/imageRequired), video=rasm tool, kredit tarixi UI, video
      poster, lightbox katta, ikkilangan referens olib tashlandi, home filter bug, tarix
      karta→lightbox. QAROR: hech qayerda bottom-slide yo'q — kichik=popover, katta=markaziy modal.
- [x] Hisob g1–g3 (Hisob/login/publish) — hammasi MARKAZIY modal (bottom-sheet emas),
      1:1 reskin, mantiq saqlangan (setTheme/AF_THEMES, plan, folder, login/logout,
      Google, publishScan/publishGo, barcha field id'lar). g1→ea031c5 (parallel commit
      ichiga tushib ketdi), g2→0a2d38c, g3→7181005 (height min(640px,92vh)).
      ⚠️ PARALLEL SESSIYA ogohlantirishi: ayni faylda (AssetFlow_Plugin.html) bir vaqtda
      2 sessiya ishladi — g1 boshqa committer'ning commit'iga tushib ketdi (rewrite
      QILINMADI — unpushed + faol committer bilan xavfli). ⇒ PLAGIN DIZAYNI TUGADI.
- [ ] Rasm (1d) — VAR·B variatsiya; AI Tools rasm-tool'i qurilgani uchun QAMRALGAN deb o'tkazildi
- [ ] Poydevor f1-f4 (tokens/components) — kerak bo'lsa oraliqda
- [x] API-CORRECTNESS AUDIT — 13 enabled model tekshirildi → 9 PASS · 4 FIXED · 1 NEEDS-CONF.
      Hisobot: docs/AI-API-AUDIT.md. 4 commit (push YO'Q, build toza).
      ENG MUHIM FIX (ea031c5): Veo — faqat end-frame + gen bosilsa processor uni jimgina
      tashlab, user to'liq to'lab end'siz t2v olardi (PUL LEAK) → endi /gen kreditdan OLDIN
      400 END_FRAME_REQUIRES_START, plagin ham bloklaydi.
      FIX (88bf250): Nano Banana 2 Lite resolutions:["1K"] qo'shildi (quality meros bug).
      Seedance 3101/3102 aslida ENABLED (fal dormant emas — jonli zaxira).
      NEEDS-CONF: Kokoro TTS (OpenRouter key jonliligi statik tasdiqlanmaydi), Nano Pro narx
      "TAXMINIY" (pul zonasi — tegilmadi). API o'zgardi → PUSH + Cloud Run deploy KUTILMOQDA.
- [ ] PLATFORMA (web) REDESIGN — 5 bosqich (Faza 4 UX shu ichiga singadi)
      Manba: docs/DESIGN-PROMPT-PLATFORM.md (SPEC — rendered mockup EMAS). Joriy:
      platform/index.html (16283 qator), 9 ekran: landing/pricing/plugin/auth/
      dashboard/templates/aistudio/account/projects + privacy/terms/refund.
      "1:1" = bir xil dizayn TIZIMI (token/shrift/komponent plagin bilan aynan), web-native
      layout (380px panel EMAS). Studio manba: root js/+styles/ ga edit, so'ng studio:sync!
      · [x] Bosqich 1: rendered mockup TAYYOR — platform/_platform-redesign-mockup.html
        (~1890 qator, 27 freym, 9 ekran + desktop/tablet/mobile, design-system sheet,
        yagona nav, §5 IA muammolar dizaynda hal). Plagin tokenlari aynan. index.html/
        ff-api.js/build TEGILMAGAN. (commit 9d3ea7a) → USER TASDIG'INI KUTMOQDA.
      · [x] Bosqich 2: Marketing PORT QILINDI real index.html'ga (1:1 mockupdan). Landing/
        Pricing/Plugin + marketing top-nav (frost-on-scroll + mobil drawer) + footer (real
        legal). IA fix: Blog+Hujjatlar o'lik link olib tashlandi, soxta social proof→real stats.
        CSS `ffm-` scoped, template runtime/routing/ff-api saqlangan. index.html = CF Pages
        to'g'ridan (prepare-cf-pages copyDir platform→dist). 1280/960/390 tasdiqlangan.
        (commit f8ba6d0) ⚠️ index.html = REAL sayt → push CF Pages deploy qiladi.
        USER TWEAK: landing (home) ~30% vertikal compact qilindi (hero 64→44, bo'lim
        72→50, shrift/layout tegilmagan; pricing/plugin o'zgarmagan). (commit 4fbde97)
        USER: landing "iddiy" tuyuldi → BOY landing mockup yasaldi platform/_landing-rich-mockup.html
        (2 hero: A=jonli AI Studio media-hero [tavsiya], B=kinematik aurora-sahna; to'liq boy landing A'da:
        aurora-mesh, 64px hero, count-up stat, marquee showcase, 3D-tilt kartalar, nafas-glow CTA; brend
        tokenlar 1:1, prefers-reduced-motion). (commit 9da61ad). USER TANLADI: Variant B.
        [x] BOY LANDING PORT QILINDI real index.html'ga (Variant B "Kinematik sahna", ffl- scoped):
        Hero B (aurora/mesh + dot-grid, 6 suzuvchi karta parallax + gen-holat, vignette, clamp-64px hero,
        cta-glow, marquee), stats count-up jonli, showcase 2-qator marquee (cattab filtr real), AI Studio
        tilt+glow, plagin 3D panel, narx lime-glow, FAQ akkordeon, CTA glow. Bindinglar saqlangan (jonli
        tasdiq). ffm- footer/nav tegilmagan, ff-api/app ekran/pricing/plugin O'ZGARMAGAN. prefers-reduced-
        motion ishlaydi. (commit dfe6a84) ⚠️ index.html=REAL sayt → push CF Pages deploy.
      · [x] Bosqich 3: Auth (login/register/forgot/verify — split composition) + Dashboard +
        YAGONA APP SIDEBAR (ffa- scoped: sidebar + mobil drawer + bottom tab-bar + avatar
        dropdown+logout, collapse 64px). Auth mantiq saqlangan (FFAPI login/register/forgot/
        Google #ffGoogleBtn/Turnstile #ffTurnstileWidget/verify gate). 1280/960/390 tasdiqlangan.
        (commit e5cf0ad) App CSS = ffa- scope (marketing ffm-, hech nima to'qnashmaydi).
      · [x] Bosqich 4: Templates marketplace (filtr rail + wide grid + split detail modal) +
        Projects (Loyihalar mosaic). IA FIX: Orientatsiya/Sifat filtrlari REAL ulandi
        (loadCatalog ori/qual/ar normalize → filtered() predicate), mobil filter drawer
        (filterDrawerOpen, live-filter + "N natijani ko'rsatish"). Sort real ishlaydi. Katalog/
        download/search mantiq saqlangan. ffa- scope. 1280/960/390 tasdiqlangan. (commit a2a4b5d)
      · [x] Bosqich 5: AI Studio (3-panel: tool rail/composer/canvas; rasm/video/ovoz/SFX,
        model-aware labeled settings, cost clarity ✦N, pending-glow, lightbox) + Account
        (4 tab: Profil/Obuna/Kreditlar/Yuklamalar — §5 IA fix). Gen flow (cost-quote/consume/
        refund/poll) + account bindings saqlangan. ffa- scope. 1280/960/390 tasdiqlangan.
        (commit 4347d92) ⇒ PLATFORMA REDESIGN TO'LIQ TUGADI 🎉
        USER FIX: AI Studio composer Bosqich 5'da mockupdan chetlagan edi (tik vertikal panel)
        → BOTTOM-DOCKED composer'ga qayta qurildi (tepada gorizontal tab + pastda frosted
        docked bar + sozlama CHIP→popover; Ovoz ai3 list qoldi). ffa-st- scope. (commit 0ece114)
      ⇒ PLAGIN + PLATFORMA redesign IKKALASI TUGADI. Keyingi: FIX-REJA-5-BOSQICH (biznes/zanjir).
- [ ] Backend fazalar (mustaqil): Faza 3 (SSRF, N+1, deploy xavfsizligi),
      Faza 5 backend (Paddle, rebrend). Batafsil: `docs/AUDIT-2026-07-02.md`.

## SYSTEM-CHAIN-AUDIT (docs/SYSTEM-CHAIN-AUDIT.md — branch claude/frameflow-system-audit-fcx6rw, commit 2394d0c)
Biznes model (user qarori): obuna+kredit top-up (hybrid) · gen marja ~2x provider · contributor
payout 50% · storage tarif bo'yicha ~3GB+ · miqyos yuzlab (o'sishga tayyor) · admin hammasini ko'radi.
> Tahlil xulosasi: "plumbing" (upload→approve→publish→catalog→serve, kredit gate, webhook) real va
> asosan to'g'ri, LEKIN atrofidagi BIZNES yo'q (pul olish, marja, payout, huquq, DR).
ENG QO'RQINCHLI P0 (blind spots — user so'ramagan):
1. TO'LOV: faqat Stripe (USD, obuna-only, kalitlar bo'sh=OFF). Payme/Click/Uzcard/UZS YO'Q → O'zbekistonda
   pul olib bo'lmaydi → daromad strukturaviy 0. Local rail noldan qurilishi kerak.
2. HUQUQ/SOLIQ: Terms/Privacy "Paddle merchant-of-record" deydi, kod=Stripe (MoR emas) → VAT SIZNING
   javobgarligingiz, huquqiy hujjat noto'g'ri entity'ga ishora.
3. KONTENT MODERATSIYA ~yo'q → jinoiy javobgarlik. Faqat keyword match. CSAM tor holatda, deepfake faqat
   warn. Yuklangan .zip/.aep skanlanmaydi (malware), dedup/DMCA yo'q.
4. RUNAWAY BILL tormozi yo'q: global spend cap/kill-switch/gen daily-cap YO'Q. Turnstile+email-verify
   env yo'q bo'lsa FAIL-OPEN. Bitta multi-account farm cheksiz Vertex/fal hisob.
5. MOLIYAVIY KO'RLIK: financial dashboard yo'q; ProviderSpend.estimatedCostUsd hech yozilmaydi
   (studio-gen.ts:929) → marja hisoblanmaydi; Payout/Earnings model YO'Q → 50% payout o'lik UI stub.
6. BACKUP/DR yo'q (Neon/bucket o'lsa hammasi yo'qoladi). OBSERVABILITY yo'q (Sentry yo'q, /health soxta).
MISPRICING (TUZATILDI — Direktor mustaqil 4-agent tekshiruvi): Code "har gen zarar" dedi (kredit
~$0.0065 taxmini bilan), LEKIN u narx SOXTA/mavjud emas pack'dan — real kredit qiymati = PRO $19/1000cr
= $0.019/kredit (data.js:53 + plugin-profile.ts:16). $0.019'da Nano Banana 2 / Veo 3.1 / Omni PROFITABLE
(~1.3-1.5x), ZARAR EMAS — lekin 2x maqsaddan PAST, va cost yozilmagani uchun margin KO'RINMAYDI. Fix:
estimatedCostUsd yozish (studio-gen.ts:929) + ~2x uchun narxni biroz oshirish. Modellar kalibr $0.012-0.015.
YANGI topildi (Code aytmagan): (a) PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true (.env.cloud.example) → to'lovsiz
PRO berish mumkin; (b) Studio tarif UI'da bor, backend faqat FREE|PRO ('studio'→Pro normalize); (c) JWT_SECRET
auth VA cost-quote imzo uchun bir xil → sizsa cheksiz bepul gen forge; (d) Download model schema'da bor lekin
HECH QAYERDA yaratilmaydi (o'lik) → contributor download soni forgeable ContributorTemplate Int counter'dan.
Contributor approve/reject email KODI bor (notifyContributorReview) — lekin sandbox sender = yetkazilmaydi.
PHASE 0 ROADMAP (qon to'xtatish): ①provider USD cost yozish ②zararli Vertex video reprice/disable
③global spend kill-switch+daily cap ④real moderatsiya klassifikator ⑤Payme/Click ⑥Paddle/Stripe huquq
fix ⑦DB/R2 backup+runbook ⑧Sentry+real /health ⑨email-verify fail-CLOSED. Keyin: chain accounting
(download count forgeable, pack presigned) → financial dashboard → payout → storage quota → scale.
⚠️ Audit doc BRANCH'da (main'da emas) — kerak bo'lsa main'ga olib chiqish/merge kerak.

## ⭐ MASTER REJA: docs/FIX-REJA-MASTER.md (7 bosqich — yagona, ustun)
Biznes+admin+narx+monitoring hammasi shu yerda. Qatlam: BACKEND=1-4&7, ADMIN UI=5-6.
1 Himoya/xavfsizlik · 2 Huquq/moderatsiya · 3 Daromad+narx dvigateli+monitoring · 4 Zanjir+payout+storage
· 5 Admin redesign (mockup+mavjud ekran) · 6 Admin biznes markaz (moliya/narx UI/payout/sarf — backendga ulanadi)
[~] BOSQICH 5.1 ADMIN MOCKUP TAYYOR — admin/_admin-redesign-mockup.html (21 freym, dizayn-system +
  mavjud 10 ekran (Overview/Moderatsiya/Shablonlar/Contributor+detal/Obunachi+detal/Tarif/Xabar/Analitika/
  Sozlama/Log+Audit) + YANGI biznes markaz (Moliya dashboard/Narx boshqaruvi margin%/Har-user sarf/Contributor
  payout=download soni→qo'lda/Faoliyat jurnali) + responsive. Plagin tokenlari aynan. admin/index.html TEGILMAGAN.
  (commit d2f7193) → TASDIQLANDI.
[x] BOSQICH 5a PORT BAJARILDI (3 commit main'da, push YO'Q, jonli API bilan tasdiqlangan):
  admin SHELL (styles/admin.css adx- prefix; 4-guruh sidebar + topbar; lokal shrift+Phosphor, CDN yo'q) +
  Dashboard (e1: stat+moderatsiya preview+recent) + Moderatsiya (e2: 2-panel+decision, approve/reject jonli
  ishlaydi). Mantiq saqlangan. Manba tasdiqlangan (admin/index.html+root js/+styles/=MANBA, studio:sync).
  BUG FIX: modRejectConfirm reject-sababni tashlardi; loadModerationOnly soft-reject'ni yo'qotardi. Biznes
  nav = "Tez orada" (5b/6). (commit 52071ec shell, 12605cf dash, 2cf5616 mod).
  QOLGAN: 5b (Shablonlar/Contributor/Obunachi) · 5c (Tarif/Xabar/Analitika/Sozlama/Log) · Biznes ekranlar (Bosqich 6).
· 7 Miqyos+polish+rebrand. (FIX-REJA-5-BOSQICH.md — eski, shu masterga singdirilgan.)
Narx boshqaruvi = DVIGATEL(3.4) backend + SAHIFA(6.2) UI. Monitoring=3.5.
TO'LOV QARORI (Bosqich 3.1 — Payme/Click O'RNIGA): xalqaro = LEMON SQUEEZY (MoR — soliq/VAT o'zi hal
qiladi, huquqiy muammoni yopadi). Payout → Khamkorbank UZ TO'G'RIDAN (Farg'ona filiali, KHKKUZ22XXX;
Payoneer shart emas). Store: getframeflow.lemonsqueezy.com, USD, TEST MODE, identity IN REVIEW.
Mahsulotlar: Pro $19/mo YARATILDI(published) · qolgan (Studio $59/mo + 500/$5,1500/$12,5000/$35 credit
packs) — YARATILMOQDA. Model: Free(app default)·Pro·Studio; obuna=cheksiz shablon+AI kredit; pack=extra kredit.
[x] LS TO'LOV INTEGRATSIYA BAJARILDI (5 commit main'da, push YO'Q, build toza, pul mantig'i tegilmagan):
  STUDIO tarifi REAL (enum + migratsiya 20260705120000; allotment FREE50/PRO1000/STUDIO6000; Pro-template
  gate isPaidPlan bilan tuzatildi) · lib/lemonsqueezy.ts (client+variant discovery+sig verify) · POST /api/
  billing/checkout · POST /api/lemonsqueezy/webhook (raw body, HMAC-SHA256, WebhookEvent idempotent, exactly-once
  topup grant) · frontend tugmalar (FFAPI.checkout, data-amt/data-plan) ulandi.
  ⚠️ USER QADAM: (1) mahsulotlar tugat (Studio+3 pack, nom "Pro/Studio/N Credits") (2) LS dashboard→Webhooks
  qo'sh: URL https://api.getframeflow.app/api/lemonsqueezy/webhook, event: subscription_* + order_created →
  signing secret ol (3) env: LEMONSQUEEZY_STORE_ID + LEMONSQUEEZY_WEBHOOK_SECRET + gh secret set + push.
  ⚠️ HAL QILINISHI KERAK: (a) Pro kredit — marketing 1,500 der, backend 1,000 (qaysi to'g'ri? user qaror);
  (b) oylik reset top-up kreditni O'CHIRADI (pack sotib olgan user oy oxirida qo'shimcha kreditni yo'qotadi)
  — hybrid model uchun TUZATISH kerak (reset = allotment+leftover-topup bo'lsin).
  Narx dvigateli (A guruh) hali qilinmagan (parallel, hisob kutmaydi).
[x] BOSQICH 4 BAJARILDI (5 commit main'da, push YO'Q, build toza, pul mantig'i tegilmagan):
  #1 TemplateDownloadEvent (real atomik download/import event; contributor stats forgeable Int emas real'dan;
  legacy Int fallback birinchi event'gacha) · #2 konsolidatsiya: Asset+Download O'LIK→DEPRECATED, /users/
  downloads real event'ga qayta ulandi, ContributorTemplate=yagona manba · #3 ContributorEarning+Payout
  (idempotent downloadEventId unique) + endpointlar (/contributor/earnings, admin/earnings, admin/payouts) ·
  #4 GenAsset.sizeBytes + storage quota (FREE3GB/PRO50GB/STUDIO200GB) + /gen 413 charge'dan oldin + retention
  + privacy (owner-only, signed URL) · #5 aiCreditsTopup tracker — oylik reset endi allotment+qolgan-topup
  (pack kredit YO'QOLMAYDI). 4 additive migratsiya (push'da auto).
  USER QAROR (hal qilindi, env'da): (a) PAYOUT — CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS=0 → avtomat $ YO'Q;
  faqat download sanaladi, admin qo'lda hisoblab tarqatadi (hozircha). Admin uchun per-contributor download
  ko'rinishi = admin redesign (Bosqich 6)da chiroyli qilinadi. (b) STORAGE — FREE1/PRO5/STUDIO20 GB (env).
[x] BOSQICH 1 BAJARILDI (10 commit main'da, push YO'Q, build toza, pul mantig'i tegilmagan):
  1 provider-cost.ts (estimatedCostUsd yoziladi) · 2 spend-guard.ts (kill-switch+USD ceiling+daily cap,
  consume'dan OLDIN) · 3 backdoor=false · 4 COST_QUOTE_SECRET (JWT fallback) · 5 turnstile+email prod
  fail-closed · 6 sentry.ts + real /health(SELECT1+HeadBucket) + /livez · 7 fetch-safe.ts SSRF (4 fetch) ·
  8 db-backup.mjs + workflow + DR-RUNBOOK.md · 9 email prod EMAIL_FROM warning. Migratsiya YO'Q (ustun bor edi).
  /gen tartib: kill→ceiling→quote-verify→daily-cap→consume (hammasi charge'dan oldin).
  ⚠️ USER TASHQI QADAM (prod): COST_QUOTE_SECRET o'rnat · PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false ·
  TURNSTILE + RESEND sozla (aks holda prod'da register/kredit BLOK — fail-closed!) · SENTRY_DSN + npm i
  @sentry/node · Resend domen+DKIM/SPF+EMAIL_FROM · backup bucket + versioning + BACKUP_GCS_BUCKET var.
[x] YANGI-USER 0-KREDIT bug: HAL — deploy'dan keyin jonli test: yangi user 50 kredit oladi + rasm gen
    ishladi (2026-07-04). Fix (b3b7d87):
  ensurePluginProfile create branch endi aiCredits=aiMonthlyAllotment(FREE)+aiCreditsResetAt=monthStart
  (app konstanta = yagona manba). Backfill skript (ae732fd, npm run backfill:free-credits, DRY_RUN=1
  default) — faqat haqiqiy bug-qurbon (FREE·0·ledger yo'q·createdAt>ledger-migr) topiladi. ⚠️ LEKIN Code
  lokalda bug'ni QAYTA HOSIL QILOLMADI (schema default=50 mos) → jonli 0 sababi BOSHQA bo'lishi mumkin
  (web account kredit manbai profil init qilmaydimi?). PUSH+DEPLOY'dan keyin QAYTA TEST: yangi user 50
  oladimi? Yo'q bo'lsa — chuqurroq qidiruv kerak. Backfill DRY_RUN→real bilan joriy 0-userlar tuzatiladi.
[x] BOSQICH 2 BAJARILDI (6 commit main'da, push YO'Q, build+db green, pul mantig'i tegilmagan):
  1 moderation.ts (ML klassifikator prompt+ref+output; CSAM/deepfake HARD BLOCK; charge'dan oldin) +
  preflight-safety fix · 2 malware-scan.ts (VirusTotal hash) + pack pipeline (hash→dedup→scan) + DMCA
  takedown (admin routes) + guardDownloadable 451 + approve gate 409 · 3 legal docs o'zbekcha, Paddle→Stripe
  reality, Studio/credit-pack shartli, MoR/VAT placeholder · 4 docs/LEGAL-TODO.md.
  ⚠️ MIGRATSIYA: 20260704120000_upload_safety_takedown (6 nullable ustun + 2 index) — push'da auto.
  ⚠️ USER TASHQI: MODERATION_API_KEY (yo'q=keyword-only) · VIRUSTOTAL_API_KEY (yo'q=prod pack upload
  QUARANTINE — contributorlar bloklanishi mumkin! admin pack-clear bilan ochiladi) · MODERATION_MODERATE_OUTPUTS.
  HUQUQIY-TODO: MoR/VAT/refund/Studio+credit-pack qarori — user+huquqshunos (docs/LEGAL-TODO.md).

## ⭐⭐ 2026-07-05 — ENG SO'NGGI HOLAT (YANGI HISOBDA SHUNDAN DAVOM ET)
> Foydalanuvchi 2-hisobga (Max) o'tdi. Desktop LOKAL Code (AE + skrinshot + unpushed kod ko'radi).

### TUGAGAN / JONLI
✅ Bosqich 1 (xavfsizlik) + 2 (huquq/moderatsiya) — jonli. ✅ Bosqich 4 (download event/payout/storage/topup-fix).
✅ To'lov: LEMON SQUEEZY integratsiya (checkout+webhook+STUDIO tarif) — deployed TEST mode. ✅ Kredit bug fix
(yangi user 50). ✅ Admin 5a (shell+Dashboard+Moderatsiya port). ✅ BOY LANDING Variant B port (index.html).
ENV TO'LIQ (cloudrun-env.yaml): VirusTotal, COST_QUOTE_SECRET, LS API/STORE_ID=424428/WEBHOOK_SECRET,
STORAGE Free1/Pro5/Studio20 GB, CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS=0 (payout=qo'lda), Turnstile/Resend/
PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false — hammasi to'g'ri.

### KUTAYOTGAN PROMPTLAR (berilgan, ishlatilmagan bo'lishi mumkin)
- NARX DVIGATELI + monitoring (Opus) — ModelPricing DB, cost DB'dan, margin, admin /api/admin/pricing
  endpointlar, margin-alert + reconciliation. = QOLGAN Bosqich 1.
- Landing Variant A hero toggle (?hero=a/?hero=b, Fable 5) — user A'ni ham sinamoqchi; g'olibni qoldiramiz.

### QOLGAN ISHLAR — 3 KONSOLIDATSIYALANGAN BOSQICH (maksimal birlashtirilgan)
1. PUL DVIGATELI (backend): narx dvigateli + monitoring [prompt berilgan, Opus].
2. ADMIN TO'LIQ (UI): mavjud ekran port (5b Shablon/Contributor/Obunachi + 5c Tarif/Xabar/Analitika/Sozlama/Log)
   + yangi biznes ekran + backend ulash (Moliya dashboard/Narx UI↔dvigatel/payout=download soni/sarf/faoliyat).
   Manba: admin/_admin-redesign-mockup.html. adx- scope. admin/index.html+root js/+styles/=MANBA, studio:sync.
3. YAKUNIY: miqyos (Neon pooling/N+1/Redis/deploy-safety) + rebrand (AssetFlow→FrameFlow/manifest/domen) +
   polish (Content-Disposition/voice/skeleton) + landing A-vs-B g'olib yakunlash.

### OPERATSION (kichik)
- Pro narx = $19 (HAL: LS $19; marketing $24 edi — fix kerak agar $19 desa). To'lovni JONLI TEST (test karta).
- LS jonli pulga: identity "In Review" → tasdiqlangach → LIVE kalitlar. PUSH: landing+admin 5a+narx (commit'lar unpushed).
- BIZNES MANTIQ: Pro $19 = 1000 AI kredit (qimmat, cheklangan) + cheksiz shablon (arzon). Marja hozir ~1.3-1.5x
  (2x'dan past) → narx dvigateli tuzatadi. Contributor payout = faqat download soni, admin qo'lda tarqatadi.

## AUDIT FAZALARI HOLATI (docs/AUDIT-2026-07-02.md)
- Faza 1 (launch-blokerlar): ✅ TO'LIQ (pack presigned, CDN fix, migrate gate,
  admin XSS, forgot-pw, abuse).
- Faza 2 (pul-yo'qotish): ✅ TO'LIQ (2.2 author, 2.3 refund cap+idempotent,
  2.4 admin audit, 2.5 PRO gate 402, 2.6 CreditLedger+ProviderSpend). Migratsiya
  `20260703140000_faza2_ledger_refund` — deploy'da avtomat qo'llanadi.
- Faza 3/4/5: hali qilinmagan (4 dizaynga singadi).

## KONVENSIYALAR (buzma)
- Studio: faqat root `js/`+`styles/` edit; artefakt qayta yoziladi.
- Migratsiya faqat additive. `Co-Authored-By` YOZMA (deploy bloklaydi).
- Commit qil, push QILMA — foydalanuvchi GitHub Desktop'dan o'zi push qiladi.
- Foydalanuvchi HAR Code vazifasidan keyin Code chatini /clear qiladi → har prompt
  self-contained bo'lsin.
- Plagin dizayn ishi = LOKAL Code (AE test kerak). Test kerakmas backend = brauzer
  Code (claude.ai/code) ham bo'ladi, lekin faqat push qilingan kodni ko'radi.

## OCHIQ ESLATMALAR
- Un-pushed lokal commitlar yig'ilishi mumkin — qulay paytda push (plagin deploy
  bo'lmaydi, lekin Faza 2 API/CF deploy bo'ladi → push'dan keyin smoke-test).
- Panel yuqori-chapida hali "AssetFlow" yozuvi (AE extension nomi, CSXS manifest)
  — rebrend Faza 5'da.

---

## 2026-07-04 — SESSIYA HOLATI (yangi hisobда SHUNDAN DAVOM ET)

> Foydalanuvchi yangi hisobga (Max tarif) o'tdi. Desktop (lokal) Code'ni Max hisobiga
> login qilib, hamma ishни shu yerда davom ettirish tavsiya etildi (desktop kuchliroq:
> AE test + skrinshot + push qilinmagan lokal kodни ko'radi). Brauzer Code faqat
> push qilingan kodni ko'radi va AE/dizayn qila olmaydi.

### Qayerdamiz (qisqa)
- ✅ TUGADI: Home + Katalog a1–a7 (Pillar A) + AI Tools b1–b12 (Pillar B) + 2 tuzatish sweep.
- 👉 KEYINGI: **Hisob g1–g3** (dizayn yakuni, LOKAL Code — AE kerak). Prompt pastda.
- ⏳ KEYIN: **API-correctness audit** (backend, pul-zonasi). Prompt pastda. Brauzer Code'да ham bo'ladi.
- Barcha commitlar LOKAL, PUSH QILINMAGAN. Push CF Pages+API deploy'ни ishga tushiradi
  (CSP fix jonli bo'ladi — yaxshi) → push'дан keyin `/health` + `/api/plugin/catalog` smoke-test.

### Ochiq eslatmalar (bu sessiyada aniqlangan)
- Infra HAQIQATi: faol AI modellar VERTEX'да (Imagen, Nano Banana, Veo, Gemini Omni),
  fal ZAXIRA/dormant. fal hujjatlari repoда (docs/FAL-DOCS-*). Vertex uchun haqiqat =
  adapter kodi (apps/api/src/lib/ai/vertex-*.ts).
- Bottom-sheet QARORI: foydalanuvchi pastdan chiqadigan menyu/sozlamani YOMON KO'RADI.
  Hamma joyда: kichik menyu/picker = anchored popover (.sheet.pop + positionPopover),
  katta panel (Katalog filtri, MOGRT, limit/PRO, hisob, publish, trim) = MARKAZIY modal.
  Bottom-slide idiomi butunlay olib tashlangan. Mockup g3'ни ham bottom-sheet EMAS,
  markaziy modal ичida qilish kerak.
- GCS bucket CORS qo'llangan (upload ishlaydi). infra/gcs-cors.json + infra/GCS-CORS.md.

### TAYYOR PROMPT 1 — Hisob g1+g2+g3 (dizayn yakuni, LOKAL Code, Fable 5 + Extra)
> Mockup: _frameflow-redesign-mockup.html g1 (~1708), g2 (~1787), g3 (~1816).
> Mavjud: #accountSheet (openAccountSheet ~4273), #lrOverlay + login (~4261),
> #publishSheet (openPublish ~4502, publishScan/#pubName/#pubCat/#pubTags/#pubDesc).
> Vazifa: g1/g2/g3 ni mockupга 1:1 reskin, MANTIQNI SAQLAB (login/logout/plan/folder/
> theme/publish scan-scene-meta). g3 = MARKAZIY modal (bottom-sheet emas, FIX H bilan).
> Har ekran alohida commit. Verbatim hex/px, inline-SVG, lokal shrift, CDN yo'q, 380/900px
> tekshiruv (cep-plugin-preview harness). MAVZU (theme) uchun: mavjud theme engine bo'lsa
> ulang, bo'lmasa Standart faol + qolgani // TODO. Oxiriga standart commit/summary satri.

### TAYYOR PROMPT 2 — API-correctness audit (backend, Fable 5 + Extra)
> Fayllar: gen-models.ts, studio-gen.ts, gen-quote.ts, gen-processor.ts,
> ai/vertex-image.ts, ai/vertex-omni.ts, ai/vertex.ts, ai/fal.ts + plagin param builder.
> Haqiqat manbai: fal → docs/FAL-DOCS-MODELS.md; Vertex → adapter kodi (+Google docs kerak bo'lsa).
> Vazifa: HAR enabled:true model uchun per-model matritsa (docs/AI-API-AUDIT.md) — refKind/
> maxRefs/endFrame/imageRequired/aspect/res/duration/cost → provider API maydoniga to'g'ri
> mapping. Plugin→/gen→gen-processor→adapter→provider yo'lini kuzatib, har param to'g'ri
> ketishini tasdiqla. Katalog caps'lari real kontraktga mos emasligini FLAG + FIX (endFrame
> yolg'on, refKind noto'g'ri, res/aspect provider rad etadi, kalitlar mos emas). Frames/refs
> upload → provider o'qiy oladigan shakl (gs://, image_url) ekanini tekshir. PUL-ZONASI:
> consume/refund/cost-quote/webhook idempotency mantig'iga TEGMA; additive/minimal diff;
> jonli API chaqirma (statik audit). Riskli/noaniq = "needs confirmation". Har model
> PASS/FIXED/NEEDS-CONFIRMATION verdikti. Faqat AE'да jonli tasdiqlanadiganларни alohida
> ro'yxatga chiqar. Har fix alohida commit. Oxiriga standart commit/summary satri.

> Batafsil to'liq prompt matnlari kerak bo'lsa — Direktordan "g1-g3 promptини ber" yoki
> "API-audit promptини ber" deb so'ra; yuqoridagi qisqartma yetarli bo'lmasa qayta tuzadi.
