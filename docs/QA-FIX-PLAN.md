# FrameFlow — QA Fix Plan (jonli QA + Artlist o'rganish → 16 muammo, partiyalarga)

*2026-07-09 · USER jonli QA (16 muammo) + Direktor jonli QA + Artlist AI Toolkit o'rganish. Deploy jonli (eng yangi kod).*

## ⭐ Artlist shimoliy-yulduzi (dizayn andozasi)
Haqiqiy media (gradient placeholder EMAS) · masonry grid · to'liq ekran · inline video/audio play (hover/bosish) ·
bottom-docked composer · sessions sidebar + My Library + New Session · result "Use ▾" menyu · model settings inline (2-bosqich picker + per-model params).

## 16 muammo (USER jonli QA)
1. Web template detail — video ko'rinmaydi/o'ynamaydi, audio ham chiqsin.
2. Platforma login admin/contributor'ni bloklaydi — ular ham user sifatida platformadan foydalanishi kerak (juda qattiq).
3. Web AI Studio — gen videolar qora/o'ynamaydi, audio yo'q, "Jump back in" kartalar gradient.
4. Web — brauzer "orqaga" ishlamaydi, saytdan chiqib ketadi (SPA routing/history). + QA: `#account` deep-link Home ko'rsatadi.
5. Admin web juda sekin ochiladi.
6. Admin + Contributor'da ham "orqaga" ishlamaydi (#4 bilan bir ildiz).
7. ⭐ Shablon yuklaganda faqat `pack.aep` keladi — assetlar (footage mp4, Sound) kelmaydi → AE "15 files missing". To'liq paket kerak. PLAGINDA HAM.
8. Plagindan "Publish a template" olib tashlash — kerak emas.
9. Web Templates filtri → "Templates · Motion · Graphics · LUTs" (belgilangan set).
10. Web filtr tugmalari chiroyli pill dizaynда (plagindek).
11. Web AI Studio to'liq ekran (full-width).
12. AI Studio session modeli (Sessions + New Session + Library) — Artlistdek.
13. Projects bo'limi ishlamaydi → vazifa: gen+shablonni to'plamlarga yig'ish; struktura + haqiqiy data.
14. Web kartalar bo'm-bo'sh (gradient) → haqiqiy media (Home Featured/Recent, tool kartalar).
15. Plagin gen-result tugma iconlari tushunarsiz → aniqroq icon/label.
16. ⭐ AI model sozlamalari buzuq — reference/start/end kadr har model uchun noaniq → noto'g'ri gen + kredit isrofi. Web + plagin.

## Partiyalar (har biri bitta Code prompt · ketma-ket, chunki bir xil fayllar · ⚠️ pul-zona ehtiyot)

### PARTIYA 1 — Shablon to'liq paketi 🔴 KRITIK (#7) ✅ TUGADI (commit 7a39752 backend + 329090f plagin, push YO'Q)
Ingest contributor zipining **BUTUN paketini** saqlasin (.aep + footage + audio + papkalar), faqat .aep emas. Download (web+plagin)
to'liq paketni bersin (AE'da "files missing" bo'lmasin). Plagin import to'liq paketni ochsin. Backend + plagin.
> TUB SABAB: ingestOneZip faqat 1-`.aep`ni ajratib `pack.aep` qilib saqlar, asl zipni O'CHIRARDI (footage/audio yo'qolardi);
> serve .aep'dan zip qurardi. FIX: butun asl zip `templates/{id}/pack.zip` ga (streaming copy, hash-verify) → serve byte-for-byte
> → plagin cache `.assetflow_pack_size` marker bilan invalidatsiya + unzip timeout 600s. Test: 5-fayl zip (footage/audio/subfolder)
> to'liq keldi, AE relative linklar hal bo'ldi. ⚠️ Eski buzuq ingest o'tgan shablonlar TUZALMAYDI (asl zip o'chgan) → qayta yuklash.
> ⚠️ Pre-existing (alohida): .zip↔bare .aep almashtirilsa eski sibling key download'da yutadi (task chip qoldirildi). USER: PUSH +
> Cloud Run deploy + CEP reinstall.

### PARTIYA 2 — AI model sozlamalari to'g'riligi 🔴 PUL-ZONA (#16) ✅ TUGADI (3 commit main: backend+web+report, push YO'Q)
Har enabled model uchun reference/start-frame/end-frame/aspect/res/duration → provider maydoniga to'g'ri mapping (web + plagin).
Per-model chuqur audit + fix. consume/quote/refund mantiqiga TEGMA. (Avvalgi AI-API-AUDIT'ni joriy kodda qayta.)
> ENABLED to'plam = faqat Google Vertex (image 1010-1014 + video Veo 3001-3003 + Omni 3010) + Kokoro TTS 2001 +
> ElevenLabs SFX 4001. Barcha fal image/video (1102-1110, 3101/3102, Kling/Wan) + Magnific = enabled:false (kredit
> sarflamaydi). 2 REAL mismatch topildi+tuzatildi: (1) web buildParams image aspect model.aspects'ga CLAMP qilinmasdi
> (video clamp qilardi) + pickModel aiSize reset qilmasdi → 21:9 tanlab Imagen'ga o'tsa → fail+kredit isrof. (2) backend
> gen-processor image yo'li Imagen'ga 4K yubora olardi (Imagen max 2K) → fail. Ikkalasi clamp qilindi; stored aspect
> effektiv qiymatga moslandi. Plagin (image setModel + video applyModelSettings) ALLAQACHON to'g'ri — tegilmadi.
> PUL-ZONA (gen-quote HMAC, computeGenCost/imageUnitCost, consume/refund) BAYT-BAYT o'zgarmagan (git-verified).
> Tekshiruv: mapping dry-run (real gen EMAS — kredit tejash). USER: PUSH → Cloud Run deploy.

### PARTIYA 3 — Web yadro: routing + layout + filtr + login (#4,#6,#11,#9,#10,#2) ✅ TUGADI (5 commit main, push YO'Q)
SPA history/back-button + hash deep-link (barcha portallar) · AI Studio full-width · Templates filtri belgilangan set + pill
dizayn · platforma admin/contributor'ni ham user sifatida qabul qilsin (blokni yumshatish). Asosan platform/index.html.
> FIX1 routing (3 portal): go()/route() replaceState→pushState + popstate listener + boot hash o'qish → Back/Forward app
> ichida, #account deep-link Account (Home emas), logged-out deep-link→signin. FIX2 login: _afterLoginSuccess + session
> restore'dan `role!=='USER'` bloki olindi → admin/contributor platformaga user sifatida kiradi (portal access saqlanadi).
> FIX3 AI Studio full-width: .va-main:has(.va-axwork/.va-tools){max-width:none} (faqat AI Studio; boshqa ekran cap saqlanadi).
> FIX4 Templates 4 pill (Templates·Motion·Graphics·LUTs) plagin-uslub lime active; catBucket() classifier (keyword). Regressiya
> tuzatildi: openShelfCat/openColCat raw category → catBucket orqali. ⚠️ catBucket keyword heuristik — real katalog kategoriya
> stringlari ma'lum bo'lgach sozlash kerak. Manba fayllar: platform/index.html (direct), admin/ + contributor/index.html
> (source, studio:sync artefakt gitignore). USER: PUSH → CF Pages deploy → 3 portalda back-button + login sinov.

### PARTIYA 4 — Web media/kartalar/playback (#1,#3,#14) ✅ TUGADI (3 commit main: f18b9ad+df4adad+83d6fea, push YO'Q)
Haqiqiy media kartalar (masonry, gradient EMAS) — Home Featured/Recent, katalog, gen · video/audio inline play + poster (qora yo'q) ·
template detail video+audio. Artlist andozasi. platform/index.html.
> TUB SABAB (#1,#3): dc-runtime `controls=""`/`muted=""`/`playsinline=""` ni React'ga BO'SH-SATR prop beradi → falsy →
> React atributni tashlaydi → videolar qora quti (controlsiz/postersiz). FIX: controls="{{ true }}" (chin boolean),
> poster=thumb, preload=metadata (poster'siz gen 1-kadr chizadi), detail'dan muted olindi (audio eshitiladi), bo'sh poster
> ''→null. Har surface real maydonga ulandi: Home Recent/AI picker=asset.thumbUrl/url, katalog masonry=thumbUrl+hover
> previewUrl(lazy), AI Studio grid=params.aspectRatio real nisbat, audio row=haqiqiy play toggle. Skeleton-shimmer;
> gradient faqat URL chindan yo'q bo'lsa (Featured models=model katalogda rasm yo'q → gradient qoldi). Tekshiruv: stub-harness
> (ffmpeg real mp4/jpg/mp3) before=qora quti→after=controls+kadrlar; masonry 1280/390; bo'sh holat crash yo'q; landing tegilmagan.
> Pul-zona tegilmadi. USER: PUSH → CF deploy → production'da real gen bilan ko'rish.

### PARTIYA 5 — AI Studio session modeli + Projects (#12,#13) ✅ TUGADI (4 commit: ee58a9b schema+migr, 1eb153a backend, 6a6d086 UI, d523e8d report; push YO'Q)
Sessions (New Session + per-session gen + My Library) Artlistdek · Projects funktsional (gen+shablon to'plami, Add to project,
detail grid, haqiqiy data). Backend + platform.
> STEP0: GenSession bor edi lekin ko'rinmasdi (rail /gen/history=hammasini ko'rsatardi); Projects=hardcoded 4-karta "coming
> soon". QURILDI: Schema ADDITIVE — Project(id,ownerId,name) + ProjectItem(projectId,kind:'gen'|'template',refId,unique→idempotent;
> polymorphic refId FK yo'q → o'chgan manba read'da filtrlanadi). Migratsiya 20260709100000_projects lokal dev DB'ga migrate:deploy
> bilan toza qo'llandi. Backend: GET/PATCH /gen/sessions (rename+cover) + yangi projects.ts (list/create/get/rename/delete/add/remove
> item, owner-scoped, cross-user 404). Sessions UI: rail=real sessions list (+New session, My Library=barcha gen, rename), 1 aktiv
> session (lazy, promptdan avto-nom); mobil=chip. Projects UI: real kartalar (2x2 cover), create/rename/2-step delete, detail masonry
> (gen+shablon real media, per-card remove), "Add to project" (Use▾/lightbox/template detail → picker+create). Pul-zona TEGILMADI;
> api build toza. ⚠️2 eslatma: (1) shablon-engine data: URI'ni ';'da kesadi → lokal seed cover gradient, PROD=signed https (deploydan
> keyin jonli tekshir). (2) DEPLOY TARTIBI: migrate:deploy → keyin yangi API kod (Cloud Run deploy shuni qiladi). USER: PUSH.

### PARTIYA 6 — Plagin + admin polish (#8,#15,#5)
Plagindan "Publish a template" olib tashlash · gen-result tugma iconlari aniq/label · admin web tezligini optimallashtirish
(paginatsiya/N+1 jonli tekshirish).

## Ustuvorlik: 1 (kritik) → 2 (pul) → 3 (web yadro) → 4 (media) → 5 (session/projects) → 6 (polish).
⚠️ Ko'pi bir xil fayllarga (platform/index.html, contributor.ts) tegadi → KETMA-KET. Har partiya alohida commit. Pul-zona minimal diff.
