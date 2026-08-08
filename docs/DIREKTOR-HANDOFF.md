# DIREKTOR-HANDOFF — FrameFlow direktori uchun doimiy daftar

> Bu hujjat yangi Codex/kod-agent sessiyasiga loyihaning yo'nalishi, qat'iy qoidalari,
> bajarilgan asosiy ishlar va joriy holatini tez beradi. Batafsil texnik tarixning yagona
> kod-tasdiqlangan manbai — `docs/PROJECT-STATUS.md`; oxirgi ish — `docs/SESSION-REPORT.md`.
> Yangi holat kelganda eski holat almashtiriladi: daftar tarix bilan cheksiz uzaytirilmaydi.

---

## 1. Direktor roli va ishlash usuli

- Foydalanuvchi bilan sodda o'zbekcha gaplash; texnik atamalarni faqat zarur joyda ishlat.
- Muammo yoki g'oyani avval kod, log, API va mavjud hujjatlar bilan tekshir; taxminni fakt sifatida yozma.
- Foydalanuvchi tuzatishni so'rasa, faqat prompt yozib to'xtama: kodni tuzat, tekshir va lokal plaginlarni yangila.
- Foydalanuvchi alohida Codex prompt so'rasa, u inglizcha, self-contained va bir martada yakunlashga yetarli bo'lsin.
- Aytilmagan, lekin bir xil radiusdagi regressiyalarni ham tekshir; pul va ma'lumot xavfsizligini ustun qo'y.
- Commit, push, deploy, Adobe restart yoki release paketini foydalanuvchi alohida so'ramasa qilma.
- Computer Use ishlatma. Repo, terminal, statik/browser test va foydalanuvchi screenshotlaridan foydalan.

### Har kod ishining minimal oqimi

1. `docs/PROJECT-STATUS.md`, tegishli kod va mavjud testlarni o'qi.
2. Ildiz sababni top; foydalanuvchining boshqa o'zgarishlarini saqla.
3. Minimal, umumiy yechim qil; AE va Premiere uchun alohida UI fork yaratma.
4. Tegishli avtomatik testlar va `git diff --check`ni o'tkaz.
5. Plagin o'zgarsa ZIP/PKG yaratmasdan umumiy CEP'ni `AF_SKIP_AE=1` bilan lokal o'rnat.
6. `docs/SESSION-REPORT.md`ni 15 qatordan oshirmay joriy natija bilan almashtir.

### Codex Spark bilan ishlash qoidasi

- Spark faqat kichik va fokuslangan ishga beriladi: bitta taskda CSS, markup, handler yoki testdan bittasi.
- Katta monolit fayl to'liq o'qilmaydi; `rg` bilan marker topilib, faqat kerakli kichik diapazon bir marta o'qiladi.
- Eski taskning to'liq tarixi yangi taskga ko'chirilmaydi; qisqa handoff va joriy working tree yetarli.
- Prompt ixcham bo'ladi, bir qoida takrorlanmaydi; Spark 5–10 daqiqalik auditdan keyin amaliy patchga o'tadi.
- `Extra High` kontekst hajmini oshirmaydi; ortiqcha izlanish va takroriy o'qish kontekstni tezroq sarflashi mumkin.
- Katta arxitektura auditi, ko'p faylli migratsiya va yakuniy integratsiya kuchliroq modelga beriladi.
- Spark natijasi mustaqil diff va test auditisiz commit qilinmaydi.
- Kontekst tugasa, yangi task diskdagi o'zgarishlarni saqlab, qisqa handoff orqali davom etadi.
- `_to_delete/`, foydalanuvchi o'zgarishlari va boshqa tasklarning ochiq difflari saqlanadi.

---

## 2. Loyiha va haqiqiy arxitektura

**FrameFlow** — Contributor → Admin moderatsiya → Web/AE/Premiere katalog va AI Studio zanjiri.

- Repo: `/Users/usmonov/Projects/creative-tools-saas`
- API: `https://api.getframeflow.app` — Cloud Run
- Web: `https://getframeflow.app` — manba `packages/assetflow-studio/platform/`
- Admin: `https://admin.getframeflow.app`
- Storage: GCS; DB: Neon Postgres; AI: provider adapterlari; to'lov: Lemon Squeezy
- Umumiy CEP: `plugins/after-effects-cep/`, bundle `com.frameflow`, AEFT + PPRO
- Premiere host: ko'rinmas `com.frameflow.premiere.host` UXP companion; UI emas, faqat native host bridge

Asosiy mahsulot oqimi: contributor asset yuklaydi → admin approve/publish qiladi → katalogda chiqadi →
foydalanuvchi AE yoki Premiere'ga import qiladi. AI oqimi: model/settings/reference → server-signed quote →
atomik kredit → provider job → natija/session → xatoda refund.

---

## 3. Qat'iy qoidalar

- **Pul zonasi:** kredit qiymati, consume/refund, signed quote/HMAC, webhook idempotency va
  `computeGenCost` bir tomonlama o'zgartirilmaydi. Narx faqat server `ModelPricing` manbasidan keladi.
- **AI validatsiya:** quote va generate aynan bir canonical param/reference kontraktidan foydalanadi;
  reference o'zgarsa eski quote rad etiladi; provider mavjudligi fail-closed.
- **DB:** migratsiya faqat additive va kod deployidan oldin/bilan birga qo'llanadi.
- **Studio manba:** root `packages/assetflow-studio/js|styles`, `admin/`, `contributor/` va
  `platform/index.html`; build artefaktlarini qo'lda tahrirlama. Kerak bo'lsa `npm run studio:sync`.
- **Shared UI:** AE va Premiere mutlaqo bir xil CEP DOM/CSS/controllerdan foydalanadi.
  Host farqi faqat adapter/bridge qatlamida bo'ladi.
- **Responsive:** funksiya panel torayganda o'chmaydi va ikkinchi qatorga tushmaydi; kerak bo'lsa
  lokal gorizontal scroll, ellipsis va progressive disclosure ishlatiladi.
- **Plugin UI:** bitta top bar; media-first kartalar; doimiy boshqaruvlar ixcham; ortiqchasi menyuda;
  spacing/theme tokenlari yagona; kredit/narx yashirilmaydi.
- Artlist/Higgsfield — kompozitsiya va UX ilhomi, 1:1 kod/asset/piksel nusxasi emas.
- Public UI English; maxfiy token, signed URL yoki credential log/test natijasiga chiqmaydi.
- Releasegacha har o'zgarishda ZIP/PKG yaratma; lokal CEP'ni yangila, Adobe'ni avtomatik boshqarma.

---

## 4. Bajarilgan asosiy ishlar

### Platforma, CMS va katalog

- Contributor upload → Admin approve/reject/publish → Web/plugin catalog → import zanjiri qurilgan.
- CMS v2 va yagona vizual muharrir: inline text, move/resize, media slot, announcement,
  media library va version history; model narxi CMS'dan ajratilgan.
- Production Cloud Run/GCS/Neon/custom-domain topologiyasiga ko'chirilgan; eski Render/CF manbalari tarix.
- Catalog asset flaglari, storage keylari, auth, audit, messaging va subscriber boshqaruvi ulangan.

### Web va Home UX

- Home professional discovery tartibiga o'tgan: Search → AI tools → Featured models → Footage →
  Sessions → Music/LUT → vaqtinchalik Video Templates.
- AI tool, model va footage carousel'lari responsive, snap/arrow/dot boshqaruvli; tor panelda buzilmaydi.
- Artlist generator oqimi tahlil qilinib, katta prompt zonasi, progressive disclosure va searchable
  model modal naqshi FrameFlow Create'ga moslashtirilgan.
- Keraksiz `Explore featured assets`, `Recent creations` va takroriy Home SFX javonlari olib tashlangan.

### AE + Premiere yagona plagin

- AE va Premiere bitta `AssetFlow_Plugin.html`, CSS, auth, catalog, Home, Create, Sessions va Projects UI'ni ishlatadi.
- Premiere uchun media/MOGRT/PRPROJ import, Project footage, Timeline/current frame, work area va reveal host adapterlari bor.
- Premiere CEP scripting regressiyasi uchun authenticated local mailbox asosidagi ko'rinmas UXP companion qo'shilgan;
  arbitrary JS eval yo'q, secret/protocol/size tekshiruvi fail-closed.
- Plugin writable ma'lumotlari extension ichidan `Application Support/AssetFlow/assetflow-data`ga ko'chirilgan.

### Create, session va Activity

- Image, Video, Voiceover va SFX uchun yagona responsive composer ishlaydi.
- Katta prompt-usti mode tablari olib tashlangan; mode/model/settings prompt pastidagi ixcham boshqaruvlarda.
- Yangi session pastki dockda, eski session natijalaridan keyingi sticky dockda aynan bir composer ko'chib ishlaydi.
- Eski session ID saqlanadi; prompt chat va generatsiya aynan shu sessionni davom ettiradi.
- File/Project/Timeline/current-frame/Library reference pickerlar, Enhance, Clear, Generate va server quote saqlangan.
- Activity history, active job recovery, cancel, retry, open-session va account-scoped persistence ulangan.

### AI model va reference zanjiri

- 51 katalog entrydan 24 enabled model uchun provider availability yagona fail-closed resolverda.
- 24/24 enabled adapter request contracti va Web/AE/PR/API parity matritsasi tekshirilgan.
- Barcha Image/Video/Voice/SFX params, start/end frame va image/video/audio/saved reference turlari
  quote hamda creditdan oldin canonical validator orqali tekshiriladi.
- Signed quote canonical priced params va reference manifest hashiga bog'langan; stale quote ishlamaydi.
- Reference ownership, storage prefix, MIME, hajm/son limitlari, signed URL refresh/TTL va orphan cleanup qoplangan.

### AE + Premiere + Web auth/session — 2026-08-08

- AE va Premiere bir xil qurilmadagi bitta shared credential sessiyasidan foydalanadi; hostlar bir-birini
  hisobdan chiqarmaydi, boshqa qurilma sessiyalari ham mustaqil yashaydi.
- Token migratsiyasi rollback-safe: yangi shared secret yozilishi va darhol aynan o'sha qiymat qayta
  o'qilishi tasdiqlanmaguncha eski AE/Premiere credentiallari o'chirilmaydi.
- Generic network/401/403 holatlari tokenni jimgina tozalamaydi; faqat serverning authoritative auth
  kodi credentialni bekor qiladi. FormData yo'q CEP runtime ham request oqimini buzmaydi.
- Restart sessiyani saqlaydi; renewal joriy installation uchun ishlaydi; logout faqat joriy installationni
  revoke qiladi; web logout desktop plugin sessiyalarini o'chirmaydi.
- Webdagi sun'iy 12-soatlik local expiry olib tashlangan; sessiya muddati backend token authority bilan belgilanadi.
- Eski `/apply-ae-prefs` orqali credential yozish oqimi bekor qilingan.
- Google device login soddalashtirildi: plugin `Continue with Google` bosilganda browserga bir martalik
  request avtomatik o'tadi, account tanlangach AE/Premiere o'zi ulanadi. Normal oqimda kod ko'chirish
  yoki email/parol kiritish yo'q; ular faqat `Having trouble?` ichidagi fallback.
- Google login ildiz sababi: Adobe CEP tashqi brauzerga o'tishda URL `#fragment`ini yo'qotishi mumkin.
  Device request endi query orqali uzatiladi; eski fragment faqat backward-compatible fallback.
- Xavfsizlik saqlangan: browser URL'ida access token yoki maxfiy pollToken yo'q; bir martalik requestId
  va HMAC state ishlatiladi.
- Auth/session behavioral testlari, device security testi va API build PASS; shared CEP lokal yangilangan.
- Auth/session hardeningning katta qismi `afdc275` commitida. Google query-handoff source va regressiya
  testlari yakunlangan; rollout holati GitHub Cloud Run run'i va public device sahifasi bilan tasdiqlanadi.

### Oxirgi responsive tuzatishlar — 2026-08-07

- Eski va yangi session composer boshqaruvlari barcha kenglikda bitta qatorda qoladi.
- Mode/model/output elastik qisqaradi; juda tor panelda ichki gorizontal scroll bor, funksiya yo'qolmaydi.
- Enhance/Clear/Generate bitta amal guruhi; Clear ikonasi kesilmaydigan 14px SVG.
- Video reference tartibi `+ → START → END → media refs`; image reference ham nowrap/scroll.
- Lokal umumiy `com.frameflow` AE va Premiere uchun yangilangan; Adobe avtomatik ochilmagan.

---

## 5. Joriy holat — 2026-08-08

Kod va avtomatik QA darajasida AE/PR shared CEP, unified Create/session, Premiere bridge, AI model/reference
hardening va shared auth/session persistence yakunlangan. Google one-click device handoff lokal kodda
tuzatilgan, testlangan, Studio sync va umumiy CEP install bajarilgan. Kuchga kirishi uchun Adobe ilovalarini
foydalanuvchi to'liq qayta ochadi.

**Working tree qoidasi:** `_to_delete/` foydalanuvchining untracked papkasi — tegma, stage/commit qilma.

**Production tekshiruvi:** API/Web rollout muvaffaqiyatli CI/deploy run'i va public endpoint bilan tekshiriladi;
Adobe ichidagi haqiqiy Google account tanlash E2E oqimi foydalanuvchi tomonidan qo'lda tasdiqlanadi.
**Release cheklovi:** signed ZXP sertifikati, Adobe owner metadata/portal approval, companion single-install qarori,
clean-profile install/update/uninstall va AE+Premiere ichidagi qo'lda smoke-test bajarilmaguncha Marketplace-ready emas.

---

## 6. Hujjatlar xaritasi

- `docs/PROJECT-STATUS.md` — barcha kod-tasdiqlangan tarix va joriy holatning yagona haqiqat manbai.
- `docs/SESSION-REPORT.md` — eng oxirgi o'zgarish va QA natijasi.
- `docs/FRAMEFLOW-AI-MODEL-CHAIN-AUDIT-2026-08-07.md` — model/reference/API audit.
- `docs/FRAMEFLOW-AI-MODEL-CHAIN-IMPLEMENTATION-2026-08-07.md` — bajarilgan hardening.
- `docs/FRAMEFLOW-AI-MODEL-CHAIN-CODEX-MASTER-PROMPT.md` — AI zanjiri uchun master topshiriq.
- `docs/PREMIERE-CEP-PROD-AUDIT-2026-08-04.md` — Premiere CEP audit.
- `docs/PREMIERE-CEP-PROD-SYSTEM-PROMPT.md` — dual-host CEP production topshirig'i.
- `docs/RELEASE-ARCHITECTURE.md`, `docs/MARKETPLACE-SUBMISSION.md` — release va Adobe topshirish.
- `docs/LAUNCH-READINESS.md`, `docs/THREAT-REGISTER.md`, `docs/HARDENING-FAZALAR.md` — xavfsizlik/release nazorati.
- `docs/FAL-*.md`, `docs/HIGGSFIELD-ANALYSIS.md` — provider va UX texnik referenslari.

Eski `FIX-PROMPTS-*`, `REJA-*` va sana bilan nomlangan `DIREKTOR-AUDIT-*` fayllari tarixiy material;
joriy vazifa yoki holat deb qabul qilinmaydi.
