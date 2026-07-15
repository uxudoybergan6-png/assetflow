# DIREKTOR AUDIT V2 — 2026-07-14 (katta radius: server + web + studio + plugin)

> Ega topshirig'i: "men topa olmagan muammolarni ham top". 4 ta chuqur tekshiruv o'tkazildi
> (API server · web platforma · admin/contributor studio · AE plugin). Quyida P1–P24'da
> YO'Q, YANGI topilmalar — 10 blokka (P25–P34) guruhlangan, og'irligi bilan.
> Har blok uchun PROMPT SEED bor — rejalashtirilganda to'liq self-contained promptga
> aylantiriladi (GLOBAL RULES header + validation bilan).
>
> ✅ TOZA CHIQQAN JOYLAR (auditchilar alohida tekshirdi): kredit consume/refund atomik va
> idempotent; webhook imzolari (LS/Stripe/fal) to'g'ri; IDOR himoyasi to'liq (projects,
> messages, gens, templates); studio'da esc() intizomi yaxshi; plugin download quvuri
> (.part→rename, cancel, redirect-limit) mustahkam; evalScript'lar JSON.stringify bilan.

---

## 🔴 P25 — Sessiya tugaganda holat TO'LIQ tozalanmaydi — keyingi foydalanuvchiga sizadi (WEB, CRITICAL)

- `ff-auth-expired` handler (platform/index.html:18470-18477) faqat 5 ta kalitni tozalaydi;
  `logout()` (:19451) esa ~27 tani. Qoladi: refImages/refVideos/refAudios/refStart/EndUrl,
  sessions, sessGens, projects, projOpen, curSessId, plan, downloadsMonth.
- `_afterLoginSuccess` (:19361) ham refImages/selModel/genModels'ni tozalamaydi; `gens` eski
  akkauntdan qolishi mumkin (loadHistory jim yiqilsa) (:19354-19365).
- Umumiy kompyuterda keyingi kirgan odam avvalgi foydalanuvchining referens rasmlari/holatini
  ko'radi — maxfiylik muammosi.
- **PROMPT SEED:** bitta `resetUserState()` yarat (27-kalit ro'yxati bir joyda), logout /
  auth-expired / login-success uchaласи shu funksiyani chaqirsin; P12 (prefs per-user) bilan
  mos. Plugin parity: plugin logout ham prefs/state to'liq tozalashini tekshir.
- **Model:** Sonnet 5. **Og'irlik:** HIGH (xavf yuqori, diff kichik).

## 🔴 P26 — To'lov UX teshiklari: ikki marta checkout, qaytishda jim, niyat yo'qoladi (WEB, HIGH)

- Pay tugmalari busy/disabled holatsiz (`onBuyCredits`/`onChoosePlan` :21497-21516; markup
  :16209/:17097/:17378) — sekin tarmoqda 2-3 bosish = 2-3 ta Lemon Squeezy sessiya;
  checkout POST'da idempotency key YO'Q (gen'da bor).
- Checkout'dan qaytganda hech narsa yo'q: faqat `?verified=1` ishlanadi (:18539) —
  to'lov muvaffaqiyati toast/kvitansiyasiz, balans tasodifan yangilanadi.
- Logged-out foydalanuvchi paket tanlasa → auth'ga yo'naladi, login'dan keyin dashboard —
  tanlangan paket unutiladi (:21497-21505, :21507).
- **PROMPT SEED:** tugma disable+spinner (await davomida); `?checkout=success` qaytishini
  ishlash (toast + refreshCredits + ledger ko'rsatish); auth'dan keyin saqlangan niyatga
  qaytish (sessionStorage `ff_intent`); checkout chaqiruviga idempotencyKey (server LS
  checkout dedup qo'llasa). 🔴 pul-tutash — narx/kredit qiymatlariga tegilmaydi.
- **Model:** Sonnet 5 (server dedup kerak bo'lsa Fable Medium). **Og'irlik:** HIGH.

## 🔴 P27 — Server barqarorligi: provayder timeout'lari yo'q → gen-pool qulflanadi; OOM yo'llari (API, HIGH)

- openrouter.ts:55,438,449; elevenlabs.ts:32; vertex*.ts, google-tts.ts, workers-ai.ts —
  fetch'larda AbortSignal/timeout YO'Q (fal/byteplus/magnific'da bor). Osilgan ulanish
  `genActive` slotini soatlab band qiladi → butun generatsiya navbati to'xtaydi.
- gen-processor.ts:103-163,429 — 4K video buferi ham xotirada, ham tmpfs'da — kichik Cloud
  Run instansida OOM/crash yo'li.
- index.ts:202-205 — `express.json({limit:"150mb"})` ref-upload/describe'da — bir nechta
  parallel katta so'rov OOM qiladi (40/min IP limit yetarli emas).
- fal-webhook.ts:136-144 — har webhook 500 ta video-yozuvni xotirada skan qiladi; eski job
  jim `matched:false` bo'ladi.
- **PROMPT SEED:** barcha provayder fetch'lariga yagona timeout-o'ram (masalan 120s abort +
  finally'da slot bo'shatish kafolati); katta buferlarni stream/tmp-only qilish; ref-upload
  limitini presigned-PUT yo'liga ko'proq surish (mavjud refUploadUrl bor!); fal-webhook
  requestId→genId indeksli qidiruv. 🔴 pul-zona: refund oqimiga tegilmaydi, faqat transport.
- **Model:** Fable 5 (Medium). **Og'irlik:** HIGH.

## 🔴 P28 — Plugin WINDOWS'da ishlamaydi + 2 ta lokal buyruq-in'ektsiya (PLUGIN, HIGH)

- catalog.js:521,640,659,1189 + local-store.js:546 — zip ochish `unzip` binariga bog'liq —
  Windows'da PATH'da yo'q → HAR QANDAY zip import Windows'da o'ladi. Manifest esa Windows'ni
  taqiqlamaydi.
- manifest AEFT [18.0,99.9] vs 96 ta `?.`/`??` ishlatilishi — AE 2021 (CEF74) parse qila
  olmaydi → bo'sh panel. Minimal hostni AE 2022+ ga ko'tarish YOKI transpile.
- account.js:391-396 — `openExternal` shell-string (`open "<url>"`) — URL ichidagi `$(...)`
  bajarilib ketadi (server-trust RCE vektori). execFile/argv'ga o'tkazish.
- local-store.js:534,546 — fayl nomi sanitizer `$ \` ( ) ;` ni o'tkazadi → execSync'da lokal
  in'ektsiya. execFile + to'liq sanitize.
- catalog.js:868,1164 — sha256 tekshiruvi TODO bo'sh — buzuq pack 95% hajmda "yaroqli".
- install-cep.sh — eski com.assetflow o'chirilmaydi (dublikat panel); backup fail jim.
- catalog.js:67 — settings yo'li macOS'ga qattiq yozilgan (Windows'da bogus papka).
- **PROMPT SEED:** cross-platform unzip (yauzl kabi kutubxona yoki PowerShell Expand-Archive
  fallback); execFile'ga o'tish; sha256'ni to'ldirish (server pack hash beradi — catalog'ga
  qo'shish serverda); ✅ EGA QARORI (so'rovnoma 2026-07-14): minimal host **AE 2022+** —
  manifest ko'tariladi, transpile YO'Q; installer legacy tozalash. Jonli Windows testi kerak.
- **Model:** Fable 5 (Medium-High). **Og'irlik:** HIGH.

## P29 — Admin "yolg'on gapiradigan" boshqaruvlar (STUDIO, HIGH)

- Block sababi ("Reason for blocking *") o'qilmaydi — audit-logga tushmaydi (admin-views2:870-895).
- Approve'dagi "Send approval message" checkbox hech narsa yubormaydi (:657 vs :663-681).
- All-Templates: soxta paginatsiya "1/1" + o'lik checkboxlar (:85-91, :67); Filter/CSV/
  "Add category"/moderation-rule toggle'lar — faqat toast yoki browser-only "Save" (:35-36,
  :105, :347, :465-478).
- Double-submit guard yo'q: broadcast/DM/reply/saveEditMeta/doBlock (:958,923,831,634,882,975)
  — ikki bosish = ikki broadcast.
- tName(id) null-guard'siz — stale onclick TypeError (:614). Unread badge boot vs view
  boshqacha sanaydi (index:272 vs views2:201). Toast double-escape (`Tom &amp; Jerry`).
- Yashirin XSS: admin-views.js:208-213 esc'siz timeline — hozir soya (dashboard bosib
  ketadi), lekin yuk tartibi o'zgarsa stored-XSS. O'chirish yoki esc.
- **PROMPT SEED:** block-reason va approve-notify'ni API'ga ulash (server maydonlarini
  tekshir — bo'lmasa additive qo'shish), stub'larni yo ishlaydigan qilish yo "coming soon"
  belgilash bilan disable, double-submit guard'lar, tName guard, unread formulani
  birlashtirish, toast escape bir joyda, soya timeline'ni esc qilish.
- **Model:** Sonnet 5. **Og'irlik:** MEDIUM-HIGH (hajmli, lekin aniq).

## P30 — Destruktiv amallar himoyasi + jim skeletonlar (WEB, HIGH)

- Gen o'chirish TASDIQSIZ (lightbox trash :17520, Use▾ delete :21725, delActive :21761) —
  kredit to'langan asset bir bosishda yo'qoladi. (Session delete'da confirm bor, project'da
  2-bosqich bor — eng qimmati himoyasiz.)
- loadSessions/loadProjects catch{} → abadiy skeleton (:19205, :19222). refreshCredits/
  loadPluginMe/loadExploreSubs jim (:19008-19032). downloadTemplate url'siz javobda jim
  (:20357-20372).
- **PROMPT SEED:** gen delete = 2-bosqich pattern (project'dagi kabi); loaded-flag +
  xato-holat + retry barcha ro'yxat yuklovchilarda (P6 uslubi); download fallback toast.
- **Model:** Sonnet 5. **Og'irlik:** MEDIUM.

## P31 — Modal a11y va boshqaruv izchilligi (WEB, MEDIUM)

- showCredits/showDelete/nameModal: Esc yopmaydi (:18506 ro'yxatida yo'q), focus-trap yo'q,
  body scroll qulfi yo'q, role="dialog" yo'q (:17366,:17392,:17410).
- delete-account inputda Enter ishlamaydi (:17401); session bulk-delete native confirm()
  (:21600) — uslub aralash.
- Project delete "yana bos" holati 3.5s jim o'chadi — countdown ko'rsatkichsiz (:19253).
- **PROMPT SEED:** bitta modal-helper (esc/focus/scroll-lock/aria), Enter-submit, native
  confirm'larni ichki patternga almashtirish, armed-state indikator. P14 bilan moslash.
- **Model:** Sonnet 5. **Og'irlik:** MEDIUM.

## P32 — Server hardening mayda to'plami (API, MEDIUM)

- Rate-limit in-memory per-instance (login 10/min × N instans) + per-account lockout yo'q
  (middleware/rate-limit.ts:97-122; auth.ts:71-87). reset-password/verify-email'da maxsus
  limiter yo'q (:452,:489).
- CORS: CORS_ORIGIN bo'sh/`*` bo'lsa istalgan origin + credentials — prod'da faqat warning
  (index.ts:80-97) → hard-fail qilish.
- monthStart() lokal TZ (plugin-profile.ts:127-142) — oylik reset chegarasi instansga bog'liq
  → UTC'ga mixlash (🔴 qiymatlar emas, faqat chegara hisobi — ehtiyot).
- Register: User+Subscription tranzaksiyasiz (auth.ts:134-146). Avatar mimetype sniff yo'q
  (:717-747). LS signature length-guard (lemonsqueezy.ts:263-271 RangeError→500).
  plugin.ts:391-404 scene-key sanitize izchilligi.
- **PROMPT SEED:** har biri kichik, bitta promptga sig'adi; monthStart o'zgarishi 🔴 —
  reset chegarasi siljishini bir martalik izohlash (deploy paytiga qarab).
- **Model:** Fable 5 (Medium) — monthStart/limiter pul-tutash. **Og'irlik:** MEDIUM.

## P33 — Ishonch va halollik UI'da (WEB, MEDIUM)

- SOXTA social proof: "Just now: Sardor upgraded to Pro" hardcode (:21363) — olib tashlash
  yoki real eventga ulash. (Landing "5000+" bilan bir xil kasallik — P11.4.)
- "Model of the week", kolleksiya javonlari, "downloads/7d" — placeholder ma'lumot real
  ko'rinishda (:17946,:20731,:16447,:21040,:21206). Favorites localStorage-only — qurilma
  almashsa yo'qoladi (:17946) → serverga sync (plugin favorites sync bor! web'ga ham).
- Sana/vaqt hamma joyda xom UTC slice (studio ham: contributor-views:1519, admin-views2:286).
- 9px/8.5px matnlar (:15859,:14622) — o'qib bo'lmaydi.
- **PROMPT SEED:** soxta kontentni olib tashlash/realga ulash; favorites server-sync
  (mavjud plugin endpointidan); lokal sana formatlash helper; tipografiya minimal 10px.
- **Model:** Sonnet 5. **Og'irlik:** MEDIUM.

## P34 — Build/deploy va mayda tozalashlar (STUDIO/BUILD, LOW)

- prepare-cf-pages.mjs: CSS cache-bust YO'Q (faqat js) — deploy'dan keyin 5 min stale CSS
  (:103-139); js/styles 3 nusxa ko'chiriladi, _redirects baribir /js/'ga yo'naltiradi
  (:41-55 vs :146-153) — o'lik vazn.
- Studio: markThreadRead har tanlashda (redundant audit yozuvlari) (views2:257); javob
  yozilgach thread ro'yxati qayta tartiblanmaydi (:983-986); broadcast "N contributors"
  lokal hisob vs server res.sent nomuvofiq (:950); areaChart flat-series NaN (ui.js:143);
  toast stack cap yo'q (ui.js:83-95); modal vs jadval tugma tizimlari aralash.
- Plugin: import extract papkalari cheksiz o'sadi (catalog:635, local-store:544) — auto-prune;
  admin panel manifestda --disable-web-security (:59) — eslatma.
- Web: mention dropdown innerHTML url-quote-escape'gina (:19887) — esc-helper joriy qilish;
  "Video yaratish" o'zbekcha string (:18098,18139,18145 — P16 sweep'ga qo'shildi).
- **PROMPT SEED:** bitta "housekeeping" prompt — har bandi kichik, xavfsiz.
- **Model:** Sonnet 5. **Og'irlik:** EASY.

---

## TAVSIYA TARTIB (yangi bloklar, mavjud HIGH/MEDIUM/EASY fayllarga qo'shimcha)

1. **P25** (maxfiylik, kichik diff) — darhol, EASY faylga qo'shsa ham bo'ladi.
2. **P27** (gen-pool qulflanishi) — HIGH ro'yxatiga, P17'dan keyin.
3. **P26** (to'lov UX) — HIGH/MEDIUM chegarasida, launch'dan oldin SHART.
4. **P28** (Windows + in'ektsiya) — HIGH; Windows testi bilan. 👉 EGA QARORI: AE 2022+ minimal hostmi?
5. **P29, P30** — MEDIUM ro'yxatiga.
6. **P31, P32, P33** — MEDIUM oxiriga.
7. **P34** — EASY oxiriga.

*Auditchilar tasdiqlagan kuchli tomonlar hujjat boshida — ular regressiyadan qo'riqlanadi.*
