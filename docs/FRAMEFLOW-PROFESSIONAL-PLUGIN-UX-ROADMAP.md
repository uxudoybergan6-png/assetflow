# FrameFlow Professional Plugin vNext — Ultra master-roadmap

> Sana: 2026-08-08
> Status: bajarish spetsifikatsiyasi; bu hujjat implementatsiya, release yoki production holatini bildirmaydi.
> Scope: AE va Premiere uchun bitta shared CEP mahsuloti, Adobe host adapterlari, Web behavioral parity, API kontraktlari, packaging va rollout.
> Benchmark: lokal o‘rnatilgan Higgsfield CEP `1.0.46`; faqat clean-room UX naqshlari.
> Haqiqat manbai: kod va `docs/PROJECT-STATUS.md`. Ushbu hujjat ular o‘rnini bosmaydi.

## 0. Executive hukm

FrameFlow professional darajaga bitta katta UI patch bilan emas, **strangler migration** orqali chiqadi:

1. Auth, signed quote, kredit/refund, reference va Adobe import kontraktlari muzlatiladi.
2. 19 ming qatorli monolit ostidan router, state, generation va host adapterlari vizual o‘zgarishsiz ajratiladi.
3. Hozirgi ikki quote/ikki state generation oqimi bitta canonical `GenerationGateway`ga aylantiriladi.
4. Yangi shell va ekranlar route-by-route, mode-by-mode feature flag ostida ko‘chiriladi.
5. Eski oqim yangi oqim ikki ketma-ket release va 7 kunlik 100% rolloutda sog‘lom ishlamaguncha o‘chirilmaydi.

Bu tartib o‘zgarmaydi. Home’ni avval chiroyli qilish, keyin arxitekturani tuzatish — pul, reference, session va AE/Premiere oqimlarini buzish xavfi sabab taqiqlanadi.

### Eng muhim P0 masalalar

- Yangi Create facade hozir canonical engine emas: u quote olib, keyin legacy Generate’ni bosadi va ikkinchi quote paydo bo‘lishi mumkin.
- Legacy Image/Video/Audio `/gen`ga har doim `quote.pricedParams`ni qaytarmaydi.
- `afJobStore` account-scoped emas; prompt/reference/session metadata account almashganda aralashish xavfi bor.
- Ikki navigation tizimi va noaniq enter/leave lifecycle timer/listener ownershipini buzadi.
- Real visual, accessibility va performance QA yo‘q; amaldagi responsive test asosan string/CSS contractidir.
- Premiere companion uchun Adobe-tasdiqlangan single-install yo‘li Marketplace release blockeridir.
- Telemetry markaziy redaction va AE/PPRO host aniqligiga ega emas.

## 1. Yakuniy product maqsadi

FrameFlow — bitta yaxlit professional creative workspace:

- **Home** — oxirgi ishni davom ettirish va kerakli toolni topish.
- **Create** — Image, Video va Audio oilalarida bitta feed + bitta composer.
- **Browse** — Adobe’ga import qilinadigan tasdiqlangan assetlar katalogi.
- **Activity** — barcha aktiv job, download va importlarning global holati.
- **Library** — `Generations` va `Downloads`ning yagona media kutubxonasi.
- **Sessions** — prompt/generation tarixini aynan shared composer bilan davom ettirish.
- **Projects** — generation va marketplace assetlarini loyiha bo‘yicha yig‘ish.
- **Account** — identity, workspace, plan, kredit, settings, update, help va diagnostics.

### Product natija metrikalari

- Home card → canonical tayyor workspace: **1 activation**.
- Recent result → session: **1 click**.
- Result → xavfsiz per-host default mavjud bo‘lsa import: **1 activation**; default bo‘lmasa picker bilan **2 activation**.
- Library/Sessions/Projects: Work menu orqali har primary view’dan **ko‘pi bilan 2 activation**.
- Visible dead CTA, demo production data va fake pricing: **0**.
- Normal generation transaction → **bitta accepted quote**; bir idempotency key → `/gen`: **ko‘pi bilan 1**.
- Kredit/quote/refund discrepancy: **0**.
- AE va Premiere shared DOM/controller drift: **0**.

## 2. Tekshirilgan boshlang‘ich holat

### 2.1 FrameFlow `1.2.0`

- `AssetFlow_Plugin.html`: **19,344 qator**, taxminan **1.35 MB**.
- Inline va legacy qatlamlarda taxminan **375** `addEventListener`, **13** `setInterval`, **31** `localStorage` ishlatilishi mavjud.
- 11 asosiy view: launcher, session picker, image, video, audio, sessions, session, projects, project, history, settings.
- Ikki navigation tizimi va uchta generation engine/job poller yonma-yon yashaydi.
- `frameflow-create-workspace.js` yaxshi state facade, lekin hali real submit engine emas.
- `assetflow-account.js`, secret store, shared session persistence va device auth professional va saqlanadi.
- Signed quote → atomic credit → processor → success/refund zanjiri kuchli va o‘zgarmas invariant.
- AE va PPRO bir HTML/CSS/controller ishlatadi; faqat host adapter/UXP fallback farqlanadi.
- Mavjud `tokens.css` va `ff-components.css` yangi design system uchun asos; qaytadan parallel token tizimi yaratilmaydi.

### 2.2 Higgsfield `1.0.46` benchmarki

Clean-room olinadigan interaction naqshlari:

- `Last generations` + `New` karta;
- category tabs, pin va responsive 2/3/4/5-column tool grid;
- compact task card: icon, title, bir qator description, state badge;
- full-screen contextual tool header;
- Image/Video/Audio family switcher;
- list/grid generation feed va sticky composer;
- capability-driven settings;
- result kartasida context action/import;
- accessible menu/dialog/popover xatti-harakati;
- explicit loading, error, retry, disabled va reduced-motion states;
- provider availability, version/update va host/workspace status.

Ko‘chirilmaydi:

- source, sourcemap `sourcesContent`, asset, logo, ikonka, rang palitrasi yoki copy;
- proprietary endpoint, auth, pricing, token storage yoki analytics;
- remote marketing banner, Supercomputer, MCP yoki personal-app marketplace;
- placeholder route/cardlar va hover-only critical actions;
- global user-independent localStorage pin;
- 1 soniyalik debug polling;
- generation route’da navigatsiyani butunlay yo‘qotish.

Clean-room evidence gate:

- implementation ticketlariga faqat observable task, state va interaction talabi kiradi;
- competitor source-map, class name, copy, asset va endpoint ticket/kodga kirmaydi;
- har V2 element provenance manifestida `existing FrameFlow`, `FrameFlow product requirement` yoki
  `generic observed behavior` sifatida manbalashtiriladi;
- competitor research materiali production source/package’dan tashqarida saqlanadi;
- target screenshot original FrameFlow mockupidan;
- release oldidan mustaqil similarity/provenance review PASS.

## 3. O‘zgarmas xavfsizlik va product invariantlari

Quyidagilar redesign predmeti emas:

1. AE va Premiere bitta shared auth/session token ishlatadi.
2. Token secure store formati va legacy migration siyosati o‘zgarmaydi.
3. Network/offline xatoda token o‘chirilmaydi; faqat authoritative invalid-token logout qiladi.
4. Google plugin login: plugin click → browser auto-open → Google account → AE/PR auto-connect.
5. Manual request code va email/password faqat `Having trouble?` ichida qoladi.
6. Access token, refresh token, poll token, signed URL va quote signature URL/DOM/log/telemetryga chiqmaydi.
7. Model/tool availability server-authoritative va fail-closed.
8. `/gen.params` canonical `costQuote.pricedParams`ga teng bo‘ladi.
9. Quote model, params va reference manifest hashiga bog‘liq; ularning o‘zgarishi quote’ni stale qiladi.
10. Kredit atomik yechiladi; server-authoritative failure/cancel refund siyosati saqlanadi.
11. Reference ownership, MIME, hajm, TTL, role va required-reference serverda qayta tekshiriladi.
12. Catalog faqat `APPROVED + published`; `hasPack:false` importni bloklaydi.
13. AE/PPRO faqat shared UI/controller ishlatadi; host farqi adapterda.
14. UI capability bo‘lmagan host amalini ko‘rsatmaydi; soxta parity va’da qilinmaydi.
15. Adobe ilovalari avtomatik ochilmaydi, yopilmaydi yoki restart qilinmaydi.

## 4. Scope va non-goals

### Scope

- shared CEP shell va barcha ko‘rinadigan ekranlar;
- generation domain, job/session/reference state va host command adapterlari;
- Home, Create, tools, Activity, Library, Sessions, Projects, Browse va Account;
- Web Create behavioral parity;
- responsive, accessibility, performance va telemetry/privacy;
- package, installer, Marketplace, staged rollout va rollback.

### Birinchi release non-goals

- React/Vue/Svelte yoki boshqa frameworkga birdan rewrite;
- bundler/manifest/runtimeni UI redesign bilan bir vaqtda almashtirish;
- auth yoki secure-store redesign;
- backend money flow’ni qayta ixtiro qilish;
- provider kontrakti yo‘q toolni aktiv ko‘rsatish;
- Higgsfield visual assetlarini pixel-copy qilish;
- AE’da ishlaydigan funksiyani PPRO capability’siz ko‘rsatish;
- Web va CEP’ni bitta DOMga majburan birlashtirish — parity contract orqali saqlanadi.

## 5. Keep / Refactor / Replace / Remove qaror matritsasi

| Qatlam | Qaror | Aniq yo‘nalish |
|---|---|---|
| Shared AE/PR auth va secret store | **KEEP** | Black box controller sifatida adapter ortida qoladi |
| Device login va session persistence | **KEEP** | UI wrapper yangilanadi, protokol o‘zgarmaydi |
| Signed quote/credit/refund backend | **KEEP** | `GenerationGateway` undan canonical foydalanadi |
| Reference security backend | **KEEP** | UI role/limitlarni capability asosida ko‘rsatadi |
| AE/PPRO JSX va UXP bridge | **KEEP** | `HostCommands` orqali normalize qilinadi |
| `tokens.css`, `ff-components.css` | **REFACTOR** | duplicate token/primitive deprecate qilinadi |
| `frameflow-create-workspace.js` | **REFACTOR** | facade’dan real canonical Create controllerga |
| Navigation/view lifecycle | **REPLACE** | bitta route registry + enter/leave/restore |
| Uch generation engine | **REPLACE** | bitta `GenerationGateway` |
| Uch job poller | **REPLACE** | bitta account-scoped `JobRegistry` |
| Global host-copy MutationObserver | **REPLACE LATE** | host-neutral copy registry; legacy migratsiya tugaguncha saqlanadi |
| Home’dagi katta AI shelves/model carousel | **REMOVE** | Continue row + compact tool registry grid |
| `FHOME_DEMO_VIDEO_TEMPLATES` | **REMOVE** | real data yoki honest empty state |
| “Footage” motion-graphics aliasi | **REMOVE** | canonical taxonomy |
| Majburiy session picker | **REMOVE** | active session yoki new draftni darhol ochish |
| `<div onclick>` va hover-only critical action | **REMOVE** | semantic button/link va keyboard parity |
| Unscoped `af_active_jobs` | **REMOVE AFTER MIGRATION** | server-verified account-scoped registry |
| Legacy router/CSS/engines | **REMOVE LAST** | ikki release + 7 kun sog‘lom 100% rolloutdan keyin |

## 6. Target information architecture

```text
Global shell
├── Home
├── Create
├── Browse
├── Activity overlay
├── Work menu
│   ├── Library
│   │   ├── Generations
│   │   └── Downloads
│   ├── Sessions
│   └── Projects
└── Account sheet
    ├── Identity / workspace
    ├── Plan / credits
    ├── Settings
    ├── Update / Help
    └── Diagnostics / Logout
```

### Canonical terminologiya

| Ma’no | Visible nom | Taqiqlangan duplicate |
|---|---|---|
| AI natijalari | Generations | History, My Library |
| Yuklangan template/assetlar | Downloads | Downloaded, Cached |
| Ikkalasi | Library | alohida parallel Library ekranlari |
| Prompt davomiy oqimi | Sessions | Chats, Conversations |
| Asset kolleksiyasi | Projects | Collections |
| Aktiv fon ishlari | Activity | Jobs, Queue alohida ekrani |
| Audio generation tool | Sound Effects | SFX, Sound FX visible copy’da |
| FrameFlow kolleksiyasi | Projects | Collections, Adobe Project bilan aralash label |
| Adobe source/destination | Adobe Project | Projects deb qisqartirish |

UI copy hozirgi public til — English — bilan izchil qoladi; internal hujjat O‘zbekcha bo‘lishi mumkin.

## 7. Global UX qonunlari

1. Bitta ma’no uchun bitta nom, bitta action owner va bitta route.
2. Har view’da bitta dominant vazifa; secondary actionlar progressive disclosure’da.
3. Visible action ishlaydi yoki aniq sabab bilan disabled; `Coming soon` toast dead-end emas.
4. Guest va authenticated foydalanuvchi bir IA’ni ko‘radi; protected action login gate ochadi.
5. Loading, empty, offline, partial, blocked va retryable error bir-biridan farq qiladi.
6. Error copy haqiqiy keyingi amalni aytadi; hamma xato `Session expired` bo‘lmaydi.
7. Pulga ta’sir qiladigan action oldidan cost va readiness aniq.
8. Primary action keyboard, mouse va Adobe host orqali bir xil natija beradi.
9. Critical control horizontal scroll yoki hover ichida yo‘qolmaydi.
10. Modallar focus trap, Escape, outside-click policy va triggerga focus return bilan bir xil.
11. Host capability yo‘q action render qilinmaydi; faqat real fallback bo‘lsa ko‘rsatiladi.
12. Offline/cache holati halol ko‘rsatiladi; stale data fresh deb berilmaydi.

## 8. Visual va interaction system

### 8.1 Brend yo‘nalishi

- FrameFlow’ning Space Grotesk / Inter / JetBrains Mono typografik tizimi saqlanadi.
- Mavjud noir/neon/cold tokenlari konsolidatsiya qilinadi; yangi parallel palette yaratilmaydi.
- Wave 0’da canonical production theme soni muzlatiladi. Uch tema public qolsa, uchalasi ham to‘liq QA’dan o‘tadi; aks holda qolgan theme selectorlari public UI’dan olinadi.
- Bir xil radius, elevation, border va motion scale barcha sirtlarda ishlaydi.
- Emoji ikonka ishlatilmaydi; bitta original SVG icon registry.

### 8.2 Minimal o‘lchamlar

- Body/action matni: **kamida 12px**.
- Card title: **13–14px**.
- Metadata/helper: **10–11px**.
- Primary click target: **kamida 32×32px**.
- Secondary icon target: **kamida 28×28px**; accessibility minimumi hech qachon 24×24 dan past emas.
- Focus ring UI foniga nisbatan kamida **3:1**.
- Oddiy matn contrasti **4.5:1**, katta matn/UI **3:1**.

### 8.3 Primitive’lar

- button: primary, secondary, ghost, icon, destructive;
- segmented nav, tabs va family switcher;
- compact tool card, media/result card, list row;
- input, textarea, search, select, chip, stepper;
- tooltip, menu, popover, sheet, dialog;
- badge, cost chip, host status, activity indicator;
- skeleton, empty state, inline error, toast;
- source/reference tile, import destination picker.

Har primitive statesi: default, hover, focus-visible, active, selected, loading, disabled va error.

### 8.4 CSS qoidalari

- V2 CSS faqat `[data-ff-shell="v2"]` ostida scoped.
- V2’da global `.view`, `.card`, `.btn`, `.sheet` kabi collision-prone selector yo‘q.
- Yangi inline `style`, inline event handler va `!important` faqat yozma waiver bilan.
- Existing token/primitive mapping tugamasdan yangi one-off rang/radius/shadow qo‘shilmaydi.
- 320px dan 1000px gacha page-level overflow yo‘q.

## 9. Target arxitektura

### 9.1 Qatlamlar

```text
UI v2
  ↓ intents
View lifecycle + Router + Copy registry
  ↓ commands/selectors
Domain stores
  ├── GenerationGateway
  ├── ReferenceStore
  ├── JobRegistry
  ├── ActivityRegistry
  ├── ImportGateway
  ├── ModelStore
  └── EntityCache (sessions/projects/library)
  ↓ normalized clients
API clients                         HostCommands
  ↓                                  ↓
FrameFlow API                 AE JSX / PPRO JSX → UXP bridge fallback
```

UI token, signature, raw signed URL, mailbox yoki provider-specific requestni bilmaydi.

### 9.2 Tavsiya etilgan modul chegaralari

```text
app/
  bootstrap.js
  feature-flags.js
  bootloader.js
  shell/
    router.js
    view-lifecycle.js
    render-barrier.js
    copy-registry.js
  api/
    account-adapter.js
    http-client.js
    gen-client.js
    catalog-client.js
    sessions-client.js
    projects-client.js
  state/
    account-scope.js
    model-store.js
    job-registry.js
    download-registry.js
    activity-registry.js
    entity-cache.js
  domain/generation/
    generation-gateway.js
    quote-machine.js
    reference-store.js
    session-coordinator.js
    generation-errors.js
  domain/import/
    import-gateway.js
    import-errors.js
  observability/
    safe-log.js
    redactor.js
    metrics.js
  host/
    runtime-adapter.js
    commands.js
    capabilities.js
    import-destinations.js
  ui/v2/
    shell.js
    home.js
    create.js
    activity.js
    library.js
    sessions.js
    projects.js
    browse.js
    account.js
```

Birinchi siklda eski CEF muhitiga mos IIFE namespace yoki amaldagi build bilan browser-compatible bundle ishlatiladi. Framework migration alohida kelajak qarori.

### 9.3 Canonical generation state machine

```text
draft
→ validating
→ quoting
→ quote_ready
→ submitting
→ queued
→ processing
→ completed | failed | canceled | refund_pending | refunded
```

Qat’iy gate’lar:

- bir revision uchun bitta active quote request;
- kech kelgan quote response revision mos bo‘lmasa tashlanadi;
- model/params/reference/session intent o‘zgarsa quote stale;
- normal transaction aynan bitta accepted quote ishlatadi;
- submit paytida accepted ready quote bo‘lsa yangi quote so‘ralmaydi;
- expiry yoki price change yangi transaction/revision ochadi va user intentini qayta tasdiqlatadi;
- re-quote hech qachon `/gen`ni avtomatik qayta submit qilmaydi;
- submit double-click bitta idempotency key;
- noaniq network natijasida retry ayni idempotency keyni saqlaydi;
- `/gen.params` deep-equal `quote.pricedParams`;
- `BAD_QUOTE`/`PRICE_CHANGED` kredit yechmasdan re-quote;
- signature faqat ephemeral memoryda, DOM/localStorage/logda emas;
- client JWT/signature decode qilib expiry taxmin qilmaydi;
- imkon bo‘lsa API additive `expiresAt` qaytaradi, aks holda safe re-quote.

### 9.4 Account-scoped state va async epoch

- `AccountScope` har login/account change’da monotonic epoch beradi.
- Har async request/poll/upload commit oldidan `{scope, epoch}`ni qayta tekshiradi; eski javob tashlanadi.
- Barcha yangi kalitlar install-salted, tashqaridan accountni aniqlab bo‘lmaydigan `ff.v2.<scope>.*` namespace’da.
- Job, session, project, pin, view preference va draft account-scoped.
- Raw prompt, signed URL va raw reference URL client local persistence/log/telemetry’da saqlanmaydi.
- User tasdiqlagan prompt authorized server Session tarixida amaldagi retention/privacy contracti bilan saqlanishi mumkin.
- Legacy `af_active_jobs` faqat server ayni userga tegishli deb tasdiqlagan IDlar uchun copy-on-read migratsiya qilinadi.
- Legacy keydagi prompt, params, raw/signed reference URL migration vaqtida darhol scrub qilinadi.
- Rollback active jobni server history orqali tiklaydi; maxfiy legacy cachedan foydalanmaydi.
- Logout/account-change barcha user-scoped cache, object URL, poll va pointerlarni invalidatsiya qiladi.
- Eski kalitda faqat safe minimal metadata ikki release rollback oynasida qolishi mumkin.

### 9.5 Router va lifecycle

Har route:

```text
register → enter(context) → render → refresh/restore → leave → dispose
```

- Timer/listener/object URL owneri aniq.
- Job kuzatuvi view lifecycle’dan mustaqil `JobRegistry`ga tegishli.
- PPRO paint workaround `renderBarrier()` host hookida, komponentlarda emas.
- Unknown route safe Home fallback qiladi va sanitized error code yozadi.
- V1 legacy view’lar migratsiya davomida compatibility outlet orqali ochiladi.
- `shellV2=false`: legacy router yagona DOM owner; adapter faqat event tarjima qiladi.
- `shellV2=true`: V2 router shell owner; legacy router faqat compatibility outlet ichida.
- Har transitionda `enter/leave/dispose` aynan bir marta; route epoch mos bo‘lmagan async render tashlanadi.
- Bir vaqtda faqat bitta primary view visible va focusable.

### 9.6 Host adapter

UI faqat normalized command ishlatadi:

- `getSelection()`
- `captureCurrentFrame()`
- `importMedia({ operationId, ... })`
- `importTemplate({ operationId, ... })`
- `reconcileImport(operationId)`
- `insertAtPlayhead()`
- `getProjectContext()`
- `removeCreatedItemByStableId()`

Effective host capability quyidagi kesishma:

```text
local tested allowlist
∩ runtime capability
∩ remote disable/kill-switch
```

Remote server yangi host amalini enable qila olmaydi. UI’dan raw `afEvalScript` chaqirig‘i 0; faqat
allowlisted `HostCommands`. Mutating import/insert/remove timeoutdan keyin avtomatik retry qilinmaydi.
UXP bridge protocol version/capability handshake hamda normalized success/partial/error schema beradi.
Premiere’da unsupported action yashiriladi yoki fail-closed; `EvalScript error` → authenticated UXP
mailbox fallback UI’dan yashiriladi.

Mutating import command `operationId`ni qabul qiladi va created itemga host-safe stable marker bog‘laydi.
Adapter `reconcileImport(operationId)` orqali success + stable ID, not-found yoki unknown outcome qaytaradi.
Host cheklovi sabab aniq reconciliation imkonsiz bo‘lsa state `unknown_outcome`; avtomatik retry bloklanadi
va userga duplicate xavfi bilan manual recovery ko‘rsatiladi.

### 9.7 Feature flag va rollback

Route/mode flaglari:

- `shellV2`
- `homeV2`
- `createImageV2`
- `createVideoV2`
- `createAudioV2`
- `toolsV2`
- `workSurfacesV2`
- `browseV2`
- `accountV2`
- `generationDomainV2.image`
- `generationDomainV2.video`
- `generationDomainV2.audio`
- `generationDomainV2.tools`

Qoidalar:

- dual-stack rolloutda embedded default `off`; legacy-free artifactda embedded V2 default `on`;
- deterministic account/install cohort;
- embedded trust root bilan verified signed config, schema/build compatibility va atomic last-known-good;
- config `configRevision`, `issuedAt`, `notBefore`, `expiresAt` va `keyId`ga ega;
- client highest-accepted revisionni saqlaydi; eski valid config replay qilinmaydi;
- clock-skew bound aniq; key rotation/revocation embedded root imzolagan keyset orqali;
- config rollback faqat yuqoriroq yangi revision bilan;
- precedence: embedded/build hard-off → signed emergency disable → compatible live cohort config →
  unexpired config LKG → build-generation embedded default;
- app bootida V2 renderdan oldin bounded config refresh; config timeout/offline/corrupt/expired bo‘lsa
  build-generation embedded default ishlaydi: dual-stack `off → frozen V1`, legacy-free `on → current V2`;
- cache max-age va LKG TTL config schema’da majburiy; expired config V2’ni yoqmaydi;
- online active client config’ni **≤15 daqiqada** yangilaydi; offline client uchun propagation va’dasi yo‘q;
- config publish RBAC, dual approval va immutable audit log bilan;
- signed cohort config faqat build-local allowlistdagi V2 route/domainni enable qila oladi;
- emergency config disable-only va barcha cohort configdan ustun; legacy-free buildda subfeature/route’ni
  o‘chiradi yoki main shellni previous V2-LKG/recoveryga tushiradi;
- remote config host capability, money yoki security policy’ni hech qachon enable qila olmaydi;
- enable, disable, expired-LKG, replay va emergency-disable precedence testlari majburiy;
- flag money/security invariantini chetlab o‘tmaydi;
- backend rollout davomida v1 va v2 requestlarni additive contract bilan qabul qiladi;
- rollback DB downgrade, auth migration rollback yoki companion update talab qilmaydi.
- Generation domain flag transaction boshida bir marta olinadi va terminal state’gacha pin qilinadi.
- Bitta transactionda V2 quote + legacy `/gen` kabi split-stack taqiqlanadi.
- Active jobni ayni JS runtime’da legacy va V2 poller bir vaqtda kuzatmaydi.
- AE va PR parallel runtime’lari server jobni alohida o‘qishi mumkin; global single-poller va’da qilinmaydi.
- Dual-stack drill V2→V1, legacy-free drill current V2→previous V2-LKG/recovery paytida active
  job/session/prefs yo‘qolmasligini release oldidan isbotlaydi.

### 9.8 Mustaqil bootloader

Bootloader V2 bundle’dan mustaqil va minimal:

- build-generation-aware embedded default: dual-stackda off, legacy-free’da V2 on;
- schema/build-compatible config validation;
- atomic last-known-good cache va TTL;
- boot watchdog/error boundary;
- current bundle missing/parse/load/render errorida build generationiga mos frozen V1 yoki V2-LKG/recovery;
- config offline/corrupt/missing/expired/timeout holatida embedded default; bundle failure yoki explicit
  signed emergency targetda V1/V2-LKG/recovery testlari;
- kill-switch configini bounded intervalda yangilash.

Migratsiya/dual-stack davrida fallback target — frozen V1 bundle. Legacy olib tashlashdan oldin
bootloader permanent minimal recovery shell va oldingi signed V2-LKG bundle’ga o‘tadi. Recovery shell
main bundle’dan mustaqil: safe auth restore status, active-job-loss yo‘qligi, Retry, Diagnostics va
Update’ni beradi, lekin generation/import kabi mutating money actionni bajarmaydi. Har release oldingi
verified V2’ni LKG sifatida aylantiradi; fallback infratuzilmasi hech qachon o‘chirilmaydi.

Signed cohort config faqat build allowlistidagi V2 sirtini yoqishi mumkin; emergency config faqat
o‘chiradi. Hech bir remote config host capability, money yoki security policy’ni kengaytirmaydi.

## 10. Screen contracts

### 10.1 Global shell

- Chap: FrameFlow logo → Home.
- Markaz: `Home · Create · Browse`.
- O‘ng: Activity, host/Live Link, kredit/plan, avatar.
- Work menu: Library, Sessions, Projects — har primary view’dan ko‘pi bilan ikki activation.
- Header barcha view’da bir xil balandlik va ownershipga ega.
- Tor panelda label overflow menyuga o‘tadi, critical state yo‘qolmaydi.
- Global header doim birinchi qatlam; Create/tool context header uning ostidagi ikkinchi qatlam.
- Context Back oldingi valid route’ga qaytadi; direct deep-linkda Home fallback qiladi.
- Dirty draftda Back/global nav oldidan `Stay` yoki `Discard draft` confirmation; generate jobni bekor qilmaydi.
- 320px collapse priority: logo mark → primary route → Activity → overflow; cost/host error hech qachon yashirilmaydi.
- Create va tool view’da global navigation visible/focusable qoladi.

### 10.2 Home

Tartib:

1. Global header.
2. Ixtiyoriy slim announcement; remote xato bo‘lsa joy qoldirmasdan yo‘qoladi.
3. `Continue working`: `+ New`, active job, oxirgi 4 result, recent session.
4. `All · New · Generate · Edit · Enhance · Audio · Adobe`.
5. Account-scoped pinned tools.
6. Capability-driven responsive tool grid.
7. Bitta compact `Discover assets → Browse`.

Olib tashlanadi: featured model carousel, demo videos, fake Footage shelf, katta marketplace shelves va 210px minimumli to‘rtta AI card.

Home acceptance:

- 320px: 2 ustun; 560px: 3; 800px+: 4–5.
- 600×650 first viewportda Continue va birinchi tool row ko‘rinadi.
- Initial boot’da preview video download **0**; media lazy, video `preload=none`.
- Guest bir xil IA; protected action auth gate.
- Registry toolni provider + model capability + host + plan bo‘yicha faollashtiradi.
- Continue priority: active joblar newest-first, keyin explicit recent session, keyin unique recent results.
- Compact row maksimal `+ New + 2 active + 4 result + 1 session`; ortig‘i keyboard-accessible `View all`ga.
- Ayni result/session duplicate bo‘lsa bir marta ko‘rsatiladi; skeleton joylashuvni sakratmaydi.
- Hard-unsupported local host capability, security-disabled yoki emergency-killed tool render qilinmaydi;
  stale pin safe scrub qilinadi.
- Temporary unavailable provider/offline/auth/plan tool disabled card bo‘lib qolishi mumkin: reason,
  recovery action va `Unpin`; remote server hard-unsupported actionni aktivlashtira olmaydi.

### 10.3 Create

- Context header: Back + `Image · Video · Audio`.
- Voiceover va Sound Effects `Audio` oilasida aniq sub-mode.
- Yuqorida list/grid job feed; pastda sticky shared composer.
- New va existing session aynan bitta DOM/controller/presentation.
- Mandatory session picker yo‘q; quyidagi deterministik entry/draft siyosati ishlaydi.
- Composer: reference, prompt, model, capability settings, Enhance, cost, Generate.
- Sticky composer oxirgi resultni yopmaydi.
- Narrow viewportda model detail yo‘qolmaydi; row expansion yoki sheet.
- Model o‘zgarsa invalid setting/reference aniq ko‘rsatiladi.
- Prompt auto-grow va expanded state layoutni buzmaydi.
- Readiness holatlari: prompt missing, reference missing, quote loading/stale, provider unavailable, credit insufficient, auth required.

Deterministik entry/draft siyosati:

- Primary `Create` joriy accountning shu runtime’dagi dirty/active Create state’iga qaytadi; u bo‘lmasa yangi blank draft ochadi.
- Recent session yoki `/sessions/:id` aynan o‘sha server Sessionni shared Create DOM’da ochadi.
- `+ New` blank draft yaratadi; dirty unsent prompt/reference bo‘lsa confirmation talab qiladi.
- Route almashishda draft faqat memoryda qoladi; raw prompt/reference URL client localStorage’da saqlanmaydi.
- Restart/crashdan faqat authorized server Session va server job tiklanadi; unsent raw prompt tiklanadi deb va’da qilinmaydi.
- Logout/account switch in-memory prompt/reference/object URLni invalidatsiya qiladi.
- Navigation, reload, crash, logout va account-switch journey testlari bu siyosatni tasdiqlaydi.

### 10.4 Reference system

Sources:

- File;
- Adobe Project panel;
- Timeline/current frame;
- Library.

Roles:

- image reference;
- start image;
- end image;
- video reference;
- audio reference.

Acceptance:

- model capability, count, MIME, hajm va required/optional holat uploaddan oldin ko‘rinadi;
- duplicate, stale, expired va ownership errorlari alohida;
- audio-without-visual va unsupported role client/serverda fail-closed;
- reference o‘zgarishi quote’ni darhol stale qiladi;
- mention va reference tartibi bir state’dan;
- signed URL persistent storage/telemetryga chiqmaydi.

### 10.5 Enhance

- Promptni ma’nosini o‘zgartirmasdan aniqlashtiradi; user original/preview/diffni ko‘radi.
- Accept, Replace va Undo mavjud; auto-replace yo‘q.
- Mode/model/reference konteksti yuboriladi, lekin token/path/raw signed URL yuborilmaydi.
- Empty, too-long, policy, auth, rate-limit, provider va network xatolari alohida.
- Credit/cap siyosati server-authoritative va UI’da oldindan ko‘rsatiladi.

### 10.6 Tool workspaces

Canonical route ownership:

| Intent | Canonical route/presentation |
|---|---|
| Generate Image | Create → Image |
| Generate Video | Create → Video |
| Voiceover | Create → Audio → Voiceover |
| Sound Effects | Create → Audio → Sound Effects |
| Open session | `/sessions/:id` → aynan shared Create DOM/controller |
| Open model card | Create deep-link, model preselected after capability check |
| Transform operation | `/tools/:operation` alohida tool workspace |

Home generator kartalari alohida duplicate generator sahifa yaratmaydi; canonical Create mode’ga deep-link
qiladi. DOM/controller identity va single-route-owner regression testi bu qoidani tasdiqlaydi.

Yagona skeleton:

```text
Back + Tool + host/source status
Source preview / Replace / Remove
Tool-specific controls
Optional instruction
Cost + primary action
Processing
Result + valid context actions + import destination
```

Canonical Create generation mode’lari: Image Generate, Video Generate, Voiceover va Sound Effects.
Ular Tool workspace skeletini takrorlamaydi.

Birinchi transform-workspace wave’i faqat real enabled backend bilan: Image Upscale va Video Upscale.
RemoveBG/Reframe/Motion/Relight va boshqa transform faqat provider, model, quote va QA kontrakti tayyor
bo‘lganda `/tools/:operation` sifatida active bo‘ladi.

Import destination contract:

- User logical default destinationni account × host × media type kesimida explicit tanlaydi.
- Faqat destination kind saqlanadi; project path, bin ID yoki timeline selection persistent default emas.
- Har import oldidan local allowlist, runtime capability va joriy project context qayta validatsiya qilinadi.
- Primary `Import` faqat validated non-ambiguous defaultda bir activation; yonidagi split action picker ochadi.
- Default yo‘q/invalid yoki action replace/destructive/ambiguous bo‘lsa picker majburiy, KPI ikki activation.
- Host/context o‘zgarsa default jimgina boshqa destinationga ketmaydi; reason bilan pickerga tushadi.
- Selected public host destination matrix default, invalidation, account isolation va keyboard oqimini testlaydi.

### 10.7 Activity

- Global overlay; active joblar birinchi.
- Real stage/progress va operationga mos action.
- Restartdan server-authoritative recovery.
- Terminal state’da poll to‘xtaydi.
- Bitta job uchun har JS runtime’da bitta poll owner.
- Download/import ham shu activity modeliga ulanadi.
- Dialog focus trap, Escape va focus return bilan.

Typed activity matrix:

| Type | State | Ruxsat etilgan action |
|---|---|---|
| Generation | quoting/queued/processing | Open session; Cancel faqat backend `cancellable=true` bo‘lsa |
| Generation | failed/refunded | Details; user tasdig‘i bilan yangi quote + yangi transaction orqali Retry |
| Download | queued/downloading/failed | Cancel capability bo‘lsa; safe range-resume yoki Retry |
| Import | running/failed/completed | Open destination; stable operation ID bilan deduplicated Retry |

Cancel/refund server acknowledgment olinmaguncha terminal deb ko‘rsatilmaydi. Import retry user assetini
duplicate qilmaydi. Har type o‘z progress, timeout, cancel va retry contract testiga ega.

`ActivityRegistry` read-only projection/index: generation statusining owneri `JobRegistry`, standalone
downloadniki `DownloadRegistry`, import transactionniki `ImportGateway`. Activity statusni copy qilib
ikkinchi mutable truth yaratmaydi; actionni tegishli ownerga dispatch qiladi. `ImportGateway`
`download → hash/pack verify → host mutation → stable created ID → reconciliation`ning yagona owneri.
Bir user intent bitta operation ID oladi. Host timeout noaniq bo‘lsa avval stable ID/project holati bilan
reconciliation qilinadi; blind retry 0. Retry duplicate item yaratmaydi, success created stable IDni
qaytaradi, removal faqat shu IDga ishlaydi. Reconciliation `unknown_outcome` qaytarsa retry bloklanadi.

### 10.8 Library

- `Generations | Downloads`.
- Search, media filter, sort, grid/list va cursor pagination.
- Multi-select, preview, import, download, add-to-project va delete.
- Large list bounded/virtual rendering.
- Signed media URL kerak bo‘lsa refresh qilinadi, doimiy saqlanmaydi.
- Real empty, offline, partial va error state.

Destructive fe’llar birlashtirilmaydi:

- `Remove download` faqat lokal/cache nusxani olib tashlaydi; server generation va project link qoladi.
- `Remove from project` faqat membershipni o‘chiradi; source asset qoladi.
- `Delete generation` faqat server soft-delete/trash contracti, linked session/project impact preview va undo/restore mavjud bo‘lsa ko‘rsatiladi.
- Backend contract yo‘q bo‘lsa destructive action yashiriladi; UI o‘zi cascade taxmin qilmaydi.
- Offline destructive bulk action queue qilinmaydi; reconnectdan keyin user qayta tasdiqlaydi.
- Bulk confirmation aniq count/scope ko‘rsatadi; active session/project reference buzilmasligi regression testda.

### 10.9 Sessions va Projects

- Work menu’dan global ochiladi.
- Session = results + aynan shared Create composer.
- Stale/invalid quote restore qilinmaydi.
- Project generation va marketplace assetini birga saqlaydi.
- Rename/delete/bulk amallar semantic button va keyboard-accessible confirmation bilan.
- Session delete active pointer va dangling job linklarini xavfsiz tozalaydi.
- Boshqa account IDsi UI orqali ochilmaydi.
- List → detail → Back search/filter/sort/cursor/scroll holatini tiklaydi.
- Search debounced va stale response route/account epoch bilan tashlanadi.
- Loading, honest empty, partial, offline-cache, forbidden, not-found va retryable error alohida.
- Multi-select/bulk/destructive flow scope va effect preview bilan; cancel fokusni boshlang‘ich elementga qaytaradi.

### 10.10 Browse

Canonical taxonomy:

- Video Templates
- Motion Graphics
- Graphics
- Footage
- Music
- Sound Effects
- LUTs

Universal search, filter, detail, compatibility, `hasPack`, preview va destination picker bitta oqim. Footage motion-graphics aliasi emas. Import global Activity’da ko‘rinadi. Removal faqat FrameFlow yaratgan stable IDlarni o‘chiradi; userning bir xil nomli bin/fayliga tegmaydi.

Browse list → detail → Back query/filter/sort/page/scrollni tiklaydi. Search debounced va cancellable;
kech response eski queryni render qilmaydi. Preview default autoplay qilmaydi, reduced-motion va bandwidth
preference’ni hurmat qiladi. Loading, empty, partial, offline-cache, catalog error, missing pack va
incompatible host state’lari alohida recovery actionga ega.

### 10.11 Account, Settings, Update va Diagnostics

- Identity/workspace, server-driven plan va kredit.
- Non-functional billing CTA yashiriladi yoki aniq disabled.
- Theme, motion, analytics preference va host defaults.
- Shared auth controller faqat UI adapter ortida; login/logout siyosati o‘zgarmaydi.
- Update rozilik bilan; mandatory update alohida, halol state.
- Diagnostics avtomatik sanitize qiladi; token, email, prompt, local path, signed URL va raw request yo‘q.
- Version, host, build SHA, API environment va capability summary ko‘rsatiladi.

### 10.12 Auth va guest states

- `restoring`, `signed_out`, `device_waiting`, `authenticated`, `offline_cached`, `blocked` alohida.
- Normal Google oqimi 4-qadamli manual jarayonga aylanmaydi.
- `Having trouble?` ichida manual code va email/password qoladi.
- AE’da login Premiere’da ko‘rinadi va aksincha.
- 401 invalid token bir marta logout; 429/503/network/plan-limit 403 logout qilmaydi.

Guest surface matrix:

- Home tool grid va Browse taxonomy real public metadata bilan ko‘rinadi; sample/fake result yo‘q.
- Continue, pins, credits, Activity, Library, Sessions va Projects honest locked/empty state ko‘rsatadi.
- Protected action login sheet ochadi va successful authdan keyin original safe return-targetga qaytadi.
- Prompt/reference raw qiymati auth redirect orqali URL yoki telemetryga chiqmaydi.
- Login cancel oldingi guest route/fokusni tiklaydi; boshqa account login qilsa oldingi in-memory draft olinmaydi.

## 11. Web parity va CMS chegarasi

**Create composer uchun talab 1:1 visual va interaction parity.** Bir xil viewport, theme, mode,
model va state’da Web hamda CEP quyidagilarda aynan bir design contractni bajaradi:

- control tartibi, label, icon va state copy;
- token, typography, spacing, radius, border va action hierarchy;
- prompt auto-grow/expand, reference picker, model picker va settings xatti-harakati;
- Enhance, cost, readiness, Generate va status joylashuvi;
- keyboard, focus, dialog/popover va responsive breakpointlar;
- loading, empty, blocked, error, processing va result holatlari.

Hostga xos `Project`, `Timeline`, `Current frame` va Adobe import control CEP’da capability asosida
ko‘rinadi; Web’da ularning yo‘qligi parity xatosi emas. Global Web shell va CEP shell Adobe host
cheklovlari sabab bir xil DOM bo‘lishi shart emas, ammo shared Create sirtida kutilmagan screenshot
farqi **0** bo‘ladi. Har ruxsat etilgan farq nomlangan allowlist va sababga ega.

Behavior contract ham aynan bir xil:

- enabled model va operation IDlari;
- default model va capability;
- canonical params va reference role/limitlar;
- quote cost/expiry/readiness;
- Enhance semantics;
- generate error taxonomy;
- session/result state;
- auth/account isolation.

Shared parity fixture bitta mode/model/reference/state matritsasini Web va CEP’ga beradi; DOM semantic
role, visible copy, enabled/disabled state, serialized request va screenshot natijalarini yonma-yon
tekshiradi. Bir sirt alohida hardcoded default yoki model ro‘yxatini saqlamaydi.

CMS faqat announcement, label, description, help link, thumbnail va display orderni boshqaradi. CMS hech qachon provider availability, model params, cost, plan gate, security policy yoki host capability haqiqat manbai bo‘lmaydi. Remote copy faqat `textContent`/sanitized allowlisted URL orqali render qilinadi.

Node-enabled CEP remote-content hostile fixtures bilan testlanadi:

- HTML/script/event-handler payload;
- `javascript:`, `file:`, SVG/data URL va protocol-relative URL;
- allowlisted domendan redirect orqali chiqish;
- malformed/oversized URL va Unicode spoof;
- catalog/CMS/API fieldidagi secret-canary.

Natija: script execution, local-file read, unsafe navigation va secret sink **0**. Canary console, local
log queue, Sentry breadcrumb, offline telemetry queue, server log va diagnostics exportning barchasida
qidiriladi.

## 12. Execution dependency graph

```text
Wave 0 Contract freeze + baseline
  ↓
Wave 1 Mechanical extraction (visual diff 0)
  ↓
Wave 2 Canonical domain layer
  ↓
Wave 3 V2 shell + primitives
  ├── Wave 4 Home
  └── Wave 5 Create mode-by-mode
          ↓
      Wave 6 Activity/Library/Sessions/Projects
          ↓
      Wave 7 Browse/Account/Updater
          ↓
      Wave 8 Hardening + staged rollout
          ↓
      Wave 9 Legacy removal
```

Wave 4 va 5 shell tayyor bo‘lgach parallel rivojlanishi mumkin, lekin Create production rollouti Wave 2 canonical gateway’siz boshlanmaydi.

## 13. Wave 0 — Truth, contract freeze va baseline

### Deliverables

- Higgsfield `1.0.46` clean-room screenshot/behavior inventory; proprietary source ishlatilmaydi.
- FrameFlow barcha route/DOM/action/network/timer/listener inventari.
- Auth, quote, generate, reference, job, session, catalog/import kontrakt jadvallari.
- AE/PPRO capability va import destination matrix.
- PPRO companion feasibility qarori: Adobe-approved single-install/update/uninstall isboti; aks holda
  public artifact AE-only, PPRO esa alohida private-beta channel.
- `/gen/models` va operation availability snapshot.
- Canonical terminology va IA sign-off.
- Public theme soni sign-off: bitta theme yoki barcha exposed theme to‘liq release matrixida.
- Real browser harness: viewport, screenshot, keyboard va axe.
- CEP performance/memory baseline.
- V2 feature flags default off.
- Demo/fake production content inventari va removal list.

### Exit gate

- API build va mavjud critical plugin testlari green.
- Wave 0 selected public flavor da’vo qilgan hostlarda staging login → restart → catalog → cheapest
  generate → import smoke PASS; private PPRO beta evidence public AE-only promotionni bloklamaydi.
- Current network trace saqlangan; har action request soni ma’lum.
- Clean-room provenance manifesti va original FrameFlow mockup baseline’i mavjud.
- Competitor behavior inventory faqat observable tasklarga cheklangan; source-map/class/copy/asset/endpoint ticketlarga kirmaydi.
- Pre-release similarity review usuli va reviewer sign-off’i belgilangan.
- PPRO single-install clean install/upgrade feasibility natijasi product scope’ni muzlatgan.
- AE-only tanlansa PPRO HostList, bridge/companion, Web/updater copy va Marketplace claim removal planiga ega.
- Baseline screenshot, a11y, perf va package evidence immutable CI artifactda.
- Production/staging/local API drift aniq hujjatlashtirilgan.

### Rollback

Kod behaviori o‘zgarmaydi; faqat test, inventory va default-off flag. Gate o‘tmasa Wave 1 boshlanmaydi.

## 14. Wave 1 — Mechanical extraction, visual diff 0

### Deliverables

- Inline business scriptlar yuklanish tartibini saqlab tashqi modullarga ajratiladi.
- Barcha registry/modullar yuklangach explicit `bootstrap()`.
- Router/lifecycle compatibility adapter.
- Host copy registry skeleti; legacy MutationObserver hali saqlanadi.
- V2 CSS containment va primitive mapping.
- Timer/listener/object URL instrumentation.
- V2’dan mustaqil bootloader va paket ichidagi frozen V1 entrypoint.
- `observability/safe-log`, `redactor` va typed metrics boundary.

### Exit gate

- V2 flag off xulqi oldingi release bilan teng.
- Har amal network request soni baseline’dan oshmaydi.
- Legacy DOM ID, host copy va selected public flavor host smoke PASS.
- Script execution-order trace, CSP va package file-inclusion PASS; duplicate initialization 0.
- Syntax error, missing module, render throw, corrupt flag cache, offline boot va timeoutda frozen V1 restartsiz ochiladi.
- Prompt/path/token/signature/signed-URL canary safe-logdan chiqmaydi.
- 50 view transitiondan keyin qo‘shimcha timer/listener/object URL **0**.
- Screenshot unexpected diff **0**.
- Main HTML kamayish trendiga kiradi; inline business logic yangi qo‘shilmaydi.

### Rollback

Bootloader paket ichidagi frozen V1 entrypointni tanlaydi. Agar package inclusion/CSP bunga yo‘l
bermasa Wave 1 merge qilinmaydi; fallback faqat old signed paketga bog‘lanib qolishi qabul qilinmaydi.

## 15. Wave 2 — Canonical domain layer

### Deliverables

- `GenerationGateway`.
- Mavjud `AssetFlowAccount.request` ustidagi auth-preserving `AccountAdapter`.
- Pre-auth transportdan ajratilgan authenticated `HttpClient/GenClient`.
- Monotonic account scope/epoch.
- Revision-aware `QuoteMachine`.
- Yagona `ReferenceStore`.
- Account-scoped `JobRegistry`.
- Server-derived `ModelStore`.
- `SessionCoordinator`.
- Normalized `HostCommands` va capability registry.
- Sessions/projects `EntityCache`.
- Typed, redacted error taxonomy.

### Majburiy dependency tartibi

```text
AssetFlowAccount adapter + account epoch
→ authenticated HttpClient/GenClient
→ ModelStore + ReferenceStore + SessionCoordinator
→ QuoteMachine
→ GenerationGateway
→ JobRegistry registration/recovery
→ legacy UI adapter
```

Transport refresh va authoritative logout siyosatini faqat mavjud account controller orqali oladi.
Pre-auth device request alohida va Authorization’siz. `/gen`, upload va host mutation noaniq timeoutdan
keyin blind-retry qilinmaydi. Gateway global `studioPost` yoki to‘g‘ridan-to‘g‘ri `fetch` ishlatmaydi.

### Exit gate

- Normal transaction bitta accepted quote ishlatadi; bir idempotency key uchun ko‘pi bilan bitta generation.
- `/gen.params === quote.pricedParams` deep equality barcha mode/model fixture’da.
- Double-click, stale quote, late response va retry regression PASS.
- Normal success, expired quote, price change, `/gen` timeout va double-click trace-testlari PASS.
- A account requesti kechiktirilib B accountga o‘tilganda A javobi B store/DOM/telemetryga 0 yozadi.
- Generation domain flag quote→submit→poll stackini atomik tanlaydi; split-stack 0.
- Rollback quoting/submitting/processing paytida job IDni yo‘qotmasdan testlangan.
- Reference ownership/MIME/size/TTL/role requiredness client/server parity PASS.
- Account change cached job/reference/sessionni darhol izolyatsiya qiladi.
- Signature/token/signed URL barcha persistence va telemetryda 0; raw prompt client-local/log/telemetryda 0.
- User-confirmed prompt authorized server Sessionga yozilishi va faqat o‘sha accountga qaytishi positive testda PASS.
- Legacy UI gateway orqali ishlay oladi; yangi UI hali shart emas.

### Rollback

Pinned end-to-end generation-domain flag keyingi transactionni legacy engine’ga qaytaradi; boshlangan
transaction stack almashtirmaydi. Auth key/storage va backend schema rollback talab qilmaydi.

## 16. Wave 3 — V2 shell, navigation va primitives

### Deliverables

- Bitta global shell va route registry.
- Home/Create/Browse primary nav.
- Work menu, Activity trigger va Account sheet.
- Accessible primitive’lar va original icon registry.
- Host-neutral copy registry.
- Auth/global state boundary.
- Reduced motion va keyboard navigation.

### Exit gate

- Duplicate visible navigation/name yo‘q.
- `<div onclick>` V2 sirtlarda **0**.
- Focus-visible, modal trap/Escape/return va ARIA state PASS.
- 320×400 dan 1000×900 gacha shell overflow/clipping **0**.
- Dual-host flavor’da AE va PPRO shared DOM/controller inventory hash teng; host adapter farqi allowlistda.
- AE-only flavor’da PPRO HostList/bridge/copy/update/Marketplace reference absence testlari PASS.
- V2 shell failure flag orqali restart talab qilmasdan legacy shellga qaytadi.

## 17. Wave 4 — Home

### Deliverables

- Continue working row.
- Capability-driven category/pin/tool grid.
- Guest parity va login gates.
- Single compact Browse discovery block.
- Demo, fake Footage va old shelves removal.
- Legacy responsive test V1 flagga scoped; `FHOME_DEMO_VIDEO_TEMPLATES` assertion shu wave’da retire qilinadi.
- V2 Home authority — real browser layout/screenshot/keyboard suite.

### Exit gate

- Home initial video download 0; lazy image/media.
- 600×650 first viewportda Continue + birinchi tool row.
- Tool click to ready composer 1 click.
- Disabled/hidden tool sababi capability registry bilan mos.
- Account pin isolation PASS.
- Browser screenshot/axe/keyboard/perf green barcha exposed theme/state core matrix’da.

## 18. Wave 5 — Create convergence, mode-by-mode

Rollout tartibi:

1. Image
2. Video
3. Voiceover/Sound Effects
4. Tool operations/upscale

Har mode alohida flag ostida.

### Deliverables

- New va existing session uchun bitta feed/composer.
- Session picker interstitial removal.
- Real ReferenceStore wiring.
- Model/settings/Enhance/cost/generate canonical gatewayga.
- Job/result/import oqimi.
- Live Link source selection host adapter orqali.

### Har mode exit gate

- Controller legacy Generate tugmasini bosmaydi.
- Bitta quote/bitta generation invariantlari PASS.
- Result aynan davom ettirilgan sessionga tushadi.
- Restartdan active job server orqali tiklanadi.
- Model switch invalid params/reference’ni halol ko‘rsatadi.
- Cost, primary action va critical control barcha viewportda reachable.
- Web/CEP/API params/reference/error parity PASS.
- Cheapest real provider canary va refund evidence PASS.
- Flag off bo‘lsa legacy mode ishlaydi.

Barcha enabled mode gate’dan o‘tmaguncha legacy engine olib tashlanmaydi.

## 19. Wave 6 — Activity, Library, Sessions va Projects

### Deliverables

- Bitta global Activity va adaptive poll.
- `JobRegistry`, `DownloadRegistry` va `ImportGateway` ustidagi read-only typed `ActivityRegistry` projection.
- `Library → Generations | Downloads`.
- Shared composer bilan Sessions.
- Generation + marketplace asset Projects.
- Account-scoped cache, cursor pagination va signed URL refresh.

### Exit gate

- Bitta job = har JS runtime’da bitta poll owner; AE va PR runtime’lari alohida kuzatishi mumkin.
- Hidden view autoplay/polling 0, global job monitoring bundan mustasno va bounded.
- Logout/account-change user cache va active pointerlarni tozalaydi.
- Signed URL persistent storage’da 0.
- Session/project delete dangling state qoldirmaydi.
- Other-account ID access UI/API’da fail-closed.
- 1,000 item fixture bounded render va memory budget ichida.

## 20. Wave 7 — Browse, Account, Settings va Updater

### Deliverables

- Canonical taxonomy/search/filter/detail/import.
- Global Activity bilan download/import.
- Capability-based import destination.
- Download/verify/host mutation/reconciliation uchun canonical `ImportGateway`.
- Account/settings/help/update/diagnostics V2 wrapper.
- Marketplace support copy va host claimsni real test matrixga moslash.

### Exit gate

- `APPROVED + published` va `hasPack` gate PASS.
- Selected public flavor host dependency/undo/import qoidalari saqlanadi.
- Dual-host flavor’da PPRO `.mogrt/.prproj/footage` va CEP→UXP fallback smoke PASS.
- AE-only flavor’da PPRO HostList/bridge/copy/update/Marketplace absence testlari PASS.
- Bir import intent = bir operation ID; ambiguous timeout reconciliation qiladi, blind retry 0.
- Retry duplicate yaratmaydi; stable created ID va ID-only removal PASS.
- Auth/session regression to‘liq PASS.
- Diagnostics secret canary’ni chiqarmaydi.
- Non-functional CTA va fake pricing 0.
- Update Later/mandatory/no-installer states halol ishlaydi.

## 21. Wave 8 — Hardening, packaging va staged rollout

### Deliverables

- Full real-browser visual/a11y/perf suite CI’da.
- Typed allowlist telemetry + client/server redaction.
- Correct AE/PPRO host attribution.
- Privacy policy: telemetry, retention, Sentry/subprocessor va opt-out.
- Canonical manifest asosida source→stage→archive→installed SHA-256 parity.
- Signed package verification va installer QA.
- Wave 0’da tanlangan dual-host yoki AE-only flavor uchun final signed evidence.
- Marketplace metadata va evidence package.
- Remote cohort/kill switch.
- Signed-config precedence va ≤15 daqiqalik online propagation drill.

### Exit gate

- Security/privacy violation 0.
- Accessibility, performance, package va manual Adobe matrices green.
- Signed ZXP/installer verification evidence mavjud.
- PPRO single-install tasdiqlangan; aks holda public claim AE-only qilib toraytirilgan.
- Production read-only smoke va capped provider canary green.
- P0/P1 support issue 0.

## 22. Wave 9 — Legacy removal

Faqat V2 ikki ketma-ket release va 100% rolloutdan keyin kamida 7 kun sog‘lom bo‘lsa:

- Create controller → legacy click bridge;
- uchta eski generation engine/poller;
- eski router va session picker;
- global host-copy MutationObserver;
- legacy CSS va unscoped job store;
- compatibility outlet va **V1-specific** fallback flags

olib tashlanadi.

Permanent bootloader, minimal recovery shell, signed config verification, emergency disable va rotating
previous-V2 LKG fallback olib tashlanmaydi. Legacy removal alohida release candidate hisoblanadi:

1. V1 traffigi 0 bo‘lgach V2 default-on + recovery shell/LKG fallback candidate.
2. V1 kodi olib tashlangan internal → dogfood → 5% → 25% → 50% → 100% rollout.
3. Har bosqich §31 gate’lariga bo‘ysunadi; fallback target faqat previous signed V2-LKG yoki recovery shell.
4. 100% legacy-free build kamida 7 kun sog‘lom soakdan keyin final deb belgilanadi.

### Final gate

- `AssetFlow_Plugin.html` faqat shell markup va ordered entrypointlar; inline business logic 0.
- V1 fallbackga real trafik ehtiyoji 0.
- Main V2 bundle syntax/load/render failure’da recovery shell yoki previous V2-LKG restartsiz ochiladi.
- Emergency route/tool disable active job/session/prefsni yo‘qotmaydi; legacy-free propagation drill PASS.
- Barcha automated + selected public flavor host manual + installer + Marketplace testlar green.
- Rollback uchun old signed release va user-data compatibility saqlangan.

## 23. State fixture matritsasi

Har muhim sirt quyidagilarni test fixture bilan ko‘rsatadi:

- signed out;
- auth restoring;
- FREE va PRO;
- zero/low/sufficient credit;
- online/offline/reconnecting;
- loading/empty/partial/error;
- provider unavailable/rate-limited;
- quote loading/stale/expired/price-changed;
- required reference missing/invalid/expired;
- queued/processing/completed/failed/canceled/refunding/refunded;
- unsupported host/capability;
- update available/mandatory/installer missing.

Fixture production data emas; QA-only deterministik adapter orqali ishlaydi va release paketiga dev panel sifatida kirmaydi.

## 24. Automated QA matritsasi

| Qatlam | Har PR | Nightly | Release |
|---|---:|---:|---:|
| Build, syntax, diff, model invariant | ✓ | ✓ | ✓ |
| Shell/Home/Create/Activity/Library/Sessions/Projects/Browse/Account/Updater behavior | ✓ | ✓ | ✓ |
| Web↔CEP↔API model/params/reference parity | ✓ | ✓ | ✓ |
| Auth/session/account isolation/device flow | ✓ | ✓ | ✓ |
| Selected flavor host adapter/import/stable-ID; AE-only PPRO-absence | ✓ | ✓ | ✓ |
| Real browser responsive/keyboard/state | core | full | full |
| Screenshot visual regression | changed | full | full |
| Accessibility automation/manual | core | full | full + selected-platform screen reader |
| Leak/performance budget | smoke | full | full |
| Package/updater/installer/Marketplace mutation | ✓ | ✓ | ✓ |
| Hostile CMS/catalog/API content va secret sinks | ✓ | ✓ | ✓ |
| Source→installed full-tree hash | — | local | ✓ |
| Production read-only API/catalog/quote | — | scheduled | ✓ |
| Real provider canary, capped account | — | optional | ✓ |
| Selected public flavor native host manual smoke | — | — | ✓ |

### CI’ga majburiy ulanadigan mavjud testlar

- `npm run test:plugin-create`
- `npm run test:plugin-responsive` — legacy static contract sifatida, V2 authority emas
- Premiere host va integration suites
- `node plugins/after-effects-cep/scripts/test-frameflow-session-persistence.mjs`
- Web Create init/parity va Studio session-policy
- Work surfaces list→detail→Back, search restore, destructive flow, import va auth return-target tests
- device auth/UI security tests
- Gen client/params/reference/provider security tests
- hostile remote-content fixtures va all-sink canary redaction
- `npm run test:plugin-package`
- `npm run test:plugin-installers`
- `npm run test:plugin-updater`
- Marketplace preflight/mutation tests
- `npm run build -w apps/api`

Bitta `qa:plugin` aggregate target critical testlarni bir xil tartibda CI va lokal release preflight’da yuritadi.

## 25. Real browser visual matrix

Core viewportlar:

- 320×400
- 320×600
- 380×600
- 380×720
- 600×650
- 600×900
- 1000×900

Wave 0’da exposed production theme’larning har biri guest/auth va asosiy modal/composer state’larida.
Nondeterministic vaqt/media mask qilinadi.

Machine-readable visual manifest har route × state × theme × viewport kombinatsiyasini `core/full/changed`
taglari bilan belgilaydi. Pixel tolerance, dynamic mask va browser/font/OS baseline versionlangan allowlistda;
baseline o‘zgarishini surface owner va QA approver imzolaydi.

Qabul:

- page overflow 0;
- text clip/overlap 0;
- modal viewport ichida;
- sticky composer contentni yopmaydi;
- model/reference/cost/primary action reachable;
- screenshot unexpected diff 0;
- target baseline original FrameFlow clean-room mockup, competitor screenshot emas.

## 26. Accessibility Definition of Done

- WCAG 2.2 AA target.
- Automated yoki manual topilgan barcha WCAG A/AA violation 0; vaqtinchalik waiver faqat owner, sabab va expiry bilan.
- To‘liq keyboard oqimi va mantiqiy tab order.
- Focus-visible, dialog trap, Escape va focus return.
- Icon tugmalarda accessible name.
- `aria-selected/expanded/pressed/live/busy/disabled` real state bilan mos.
- Oddiy matn 4.5:1; katta matn/UI/focus 3:1.
- Status faqat rangga bog‘liq emas.
- `prefers-reduced-motion` animation/autoplayni kamaytiradi.
- Hit target kamida 24×24, product primary targetlar yuqoridagi kattaroq minimumda.
- 200% text zoom/scaling va platform high-contrast/forced-colors’da content/action yo‘qolmaydi.
- Essential cost, error, host va readiness metadata kamida 12px; 10–11px faqat non-essential caption.
- Actual CEP live status, quote error, Activity progress va dialog announcementlari screen readerga yetadi.
- macOS VoiceOver critical flows: Home→Create→Generate→Import, Browse→Import, Activity cancel/refund,
  Library multi-select/destructive confirmation va Account/Auth.
- Windows support public bo‘lsa NVDA critical-flow smoke ham release gate.

## 27. Performance va reliability budget

Phase 0 real CEP baseline’dan keyin release ceiling:

- local shell first usable p95: **≤1.5s**;
- view switch p95: **≤200ms**;
- click/key feedback p95: **≤100ms**;
- odatiy interaction’da >50ms long task: **0** yoki yozma waiver;
- 50 enter/leave’dan keyin qo‘shimcha timer/listener/object URL: **0**;
- retained memory growth: **≤10 MB**;
- Home initial preview video download: **0**;
- hidden autoplay/poll: **0**;
- large Library bounded/virtual rendering;
- shipped payload baseline’dan >5% oshsa explicit review;
- production paketda sourcemap, `sourcesContent`, `.debug`, dev panel va secret: **0**.

Measurement protocol har budget uchun start/end performance mark, cold/warm holat, sample count, OS,
hardware, AE/PR exact version, panel size, network profile va build SHAni yozadi. Memory test forced GC
mavjud bo‘lsa bir xil protocol, bo‘lmasa bir xil idle window/heap proxy bilan; natijalar aralashtirilmaydi.
PR smoke regressiyani topadi, nightly/release statistik p95ni beradi. Har waiver owner, sabab, impact va
expiryga ega; muddati o‘tgan waiver buildni bloklaydi.

PR smoke har changed core cell uchun kamida `n=10`; release p95 har selected OS × host × cold/warm
cell uchun kamida `n=100`; leak/memory cycle kamida `n=20`. Absolute ceiling bilan birga stable
baseline’ga nisbatan >10% regressiya reviewni bloklaydi. Ikki release batch p95’i >10% farq qilsa run
noisy deb root-cause qilinadi, natija tanlab olinmaydi. Reject faqat oldindan belgilangan OS sleep,
Adobe indexing/crash yoki network-profile violation sababida; rejected run ≤10%, aks holda cell invalid.

## 28. Telemetry va privacy contract

Faqat typed allowlist:

- `boot_started`, `shell_usable`, `session_end`/next-boot unclean marker;
- `auth_restore_attempt/result` va `cross_host_session_visible`;
- `view_opened` va `flag_exposure`;
- `quote_attempt/result`, `generation_intent/start/server_complete/result_visible/terminal`;
- `restart_recovery_attempt/result`;
- `import_attempt/result`;
- view/tool/model ID, safe error code va duration bucket;
- host (`AEFT`/`PPRO`), plugin/build version va rollout cohort.

Correlation faqat tasodifiy per-launch session ID bilan; account/email/promptdan hosil qilinmaydi va
launchlar orasida tracking ID sifatida saqlanmaydi. Safe local unclean marker faqat build, host,
cohort va per-launch IDni saqlaydi.

Server-complete → client-visible reconciliation uchun server bergan random, user ma’lumotidan hosil
qilinmagan opaque operation telemetry ID ishlatilishi mumkin. U faqat shu generation/recovery metric
chainidagi server-complete, result-visible va restart-recovery eventlarini bog‘laydi; account yoki boshqa
product eventlarga ulanmaydi. Raw job/account ID emas va faqat metric retention oynasida saqlanadi.

Hech qachon:

- prompt yoki enhanced prompt;
- reference URL/blob/path/filename;
- email yoki account display name;
- token/Authorization/poll secret;
- quote signature;
- signed URL;
- raw exception/request/response body.

Client va serverda ikki qatlamli redaction + canary-secret negative test. PPRO host serverda to‘g‘ri saqlanadi. Non-essential product analytics uchun opt-out, essential diagnostics uchun aniq izoh. Privacy policy retention, deletion/export, Sentry/subprocessor va lawful basisni ko‘rsatadi. Sourcemap faqat private upload; paket ichida emas.

Privacy release gate:

- har event uchun purpose, lawful basis, field schema va retention kunlari;
- analytics opt-out offline queue’ni darhol tozalaydi va keyingi non-essential eventni bloklaydi;
- export/deletion SLA va automated purge/DSR integration testi;
- essential diagnostics va optional product analytics alohida consent/preference;
- barcha telemetry sinklarda canary negative test.

## 29. Packaging va Marketplace gate

- Faqat ikki halol release flavor: **dual-host** (`AEFT+PPRO` va tasdiqlangan companion install) yoki
  **AE-only** (PPRO HostList, bridge/companion, Web copy, updater va Marketplace claimdan butunlay olib tashlangan).
- Private PPRO beta alohida manifest/package/update channel, aniq beta copy va expiryga ega; auth,
  money, privacy va package-security gate’lari GA bilan teng, lekin uning UX smoke’i AE-only GA
  promotionini bloklamaydi va Marketplace’da PPRO support deb ko‘rsatilmaydi.
- Source → stage → archive → installed tree canonical install-manifest orqali har file SHA-256 parity.
- Signature/container metadata uchun explicit exclude; build-stamp uchun versionlangan normalization schema.
- Installed tree’da allowlisted prefs/cache’dan boshqa ortiqcha fayl yo‘q.
- Clean install, upgrade, rollback va uninstall user-data siyosati testlangan.
- ZXP signature verification va signer/certificate validity evidence.
- macOS: Developer ID Installer, notarization, staple, Gatekeeper va clean-machine install.
- Windows: Authenticode SHA-256, trusted timestamp va clean-VM install/uninstall.
- Supported-host manifest: `OS × architecture × AE/PR × Adobe major/min/latest × clean/upgrade` har cell evidence bilan.
- Bir cell testlanmasa public HostList/support copy toraytiriladi; `[22.0,99.9]` sinov o‘rnini bosmaydi.
- PPRO UXP companion bitta Adobe-tasdiqlangan install/update/uninstall yo‘liga ega; bo‘lmasa AE-only artifact.
- Marketplace title, description, screenshots, privacy/terms/support URL, test account va updater channel to‘liq.
- Release manifest: version, git SHA, size, SHA-256, signing identity, build/CI run ID.
- SBOM, dependency/license inventory, CVE report, build provenance va evidence retention muddati mavjud.
- Known-exploited yoki critical production dependency CVE 0; high faqat Security owner, mitigation va
  expiry’li waiver bilan. Direct va transitive dependencylar bir xil scan scope’da.
- License denylist/allowlist siyosati avtomatik; unknown yoki taqiqlangan license release’ni bloklaydi.
- Upgrade matrix previous GA va oldest-supported direct-upgrade versiyasidan clean data/prefs migrationni
  alohida isbotlaydi.

## 30. Native Adobe manual smoke

Har run dalili: tester, UTC vaqt, commit/build, OS, Adobe exact version, panel size/theme, account va sanitized screenshot/log. Quyidagi oqimlar selected public flavor hostlarida; dual-host bandlari AE-only GA promotionini bloklamaydi va uning o‘rniga PPRO-absence package testi ishlaydi.

1. Clean install → launch → Google/device login → restart persistence.
2. Home/Create/Browse/Library/Activity/Sessions/Projects/Account.
3. 320→1000 live resize, exposed barcha theme.
4. Image/video/voice/Sound Effects’dan bittadan eng arzon real generation.
5. File, Project, Timeline/current-frame va Library reference.
6. Quote/kredit bir marta; staging fault-injection’da debitdan keyingi failure va aynan bir refund.
7. Result download/import: selected host destinationlari; dual-hostda AE comp/project va PR Project/Timeline.
8. MOGRT, footage/audio/LUT va `.prproj` supported flow yoki halol fallback.
9. Remove faqat FrameFlow yaratgan stable IDni o‘chiradi.
10. Offline/reconnect, API 401/429/5xx va provider unavailable.
11. Update prompt, Later, mandatory va installer-missing.
12. Dual-hostda AE va PR parallel login/state; biri ikkinchisini logout qilmaydi.
13. Quit/reopen’dan active job/session recovery.
14. Upgrade va uninstall user-data policy.

Refund smoke production providerini ataylab buzmaydi. Faqat stagingdagi audit-logli, productionda mavjud
bo‘lmagan fault-injection debitdan keyin deterministik failure yaratadi. Evidence oldingi/keyingi ledger,
aynan bitta refund va retry idempotency’ni ko‘rsatadi. Production canary success-only, capped account va
minimal-cost operation bilan.

Windows real Adobe smoke bo‘lmasa Windows support public release’da chiqarilmaydi yoki aniq beta deb belgilanadi.

## 31. Staged rollout va kill-switch

| Bosqich | Minimal dalil | Kuzatuv |
|---|---:|---:|
| Internal, default off | 20 to‘liq task session, P0/P1=0 | ichki sign-off |
| Dogfood | 5 real account | 48 soat |
| Beta 5% | 50 session | 48 soat |
| 25% | 100 session | 72 soat |
| 50% | 200 session | 72 soat |
| 100% | barcha eligible account | 7 kun |

### O‘lchanadigan gate spetsifikatsiyasi

| Metric | Numerator / denominator | Timeout/exclusion | Promotion sharti |
|---|---|---|---|
| Boot failure | `boot_started` ichida `shell_usable` kelmagan / barcha compatible boot | 10s; user appni oldin yopsa excluded | n≥1000, 95% upper bound <0.5% |
| Crash-free | fatal/unclean marker yo‘q eligible session / `shell_usable` session | ≥30s session; controlled update/restart excluded | n≥1000, 95% Wilson lower bound ≥99.5% |
| Auth restore | authenticated yoki explicit safe offline state / tokenli restore attempt | 10s; authoritative invalid token alohida | n≥300; baseline’dan >2pp yomon emas, token-loss 0 |
| Import success | success terminal / host commandgacha yetgan attempt | user cancel excluded; 120s timeout failure | n≥300, 95% lower bound ≥98% |
| Generation start | server job ID olgan / user-confirmed generation intent | user cancel excluded; 60s timeout failure | n≥300; stable baseline’dan >2pp yomon emas |
| Result delivery | to‘g‘ri account/sessionga attached va client-visible / charged server-completed job | active clientda 60s; yopiq bo‘lsa keyingi eligible restore’da 10s | lost charged job 0; har violation auto-pause |
| Restart recovery | registryda qayta ko‘ringan / oldingi runtime tugaganda active yoki unseen terminal job | shell usable’dan 10s | lost job 0 |
| Credit integrity | ledger debit-refund-final mos / charged transaction | exclusion yo‘q | discrepancy 0 |

Baseline — oldingi stable release’ning bir xil host/OS va imkon qadar bir xil mode/model mixidagi oxirgi
7 kunlik oynasi. Data/QA owner event schema va queryni versionlaydi; Release owner promotionni imzolaydi.
Internal, dogfood va 5% sample statistik gate uchun kichik bo‘lsa, **observed P0/P1, blank shell, lost
job va credit discrepancy 0** absolute gate ishlaydi. Rate promotion uchun minimum denominator yetmasa
bosqich uzaytiriladi; kichik sample’da 99.5% da’vo qilinmaydi.

Har bosqich product gate:

- crash-free session ≥99.5%;
- blank-shell/boot failure <0.5%;
- import success ≥98%, user cancel tashqari;
- quote/generation-start baseline’dan >2 foiz punkt yomonlashmaydi;
- credit/quote/refund discrepancy 0;
- shell p95 ≤1.5s, view switch ≤200ms;
- security/privacy violation 0;
- yangi P0/P1 support issue 0.

Gate buzilsa rollout avtomatik pause, incident triage va affected flag rollback. Money/security server logic flag bilan o‘chirilmaydi.
Provider-failed/refunded job Result delivery denominatoriga kirmaydi; u Credit integrity va refund
metricida alohida hisoblanadi. Dual-host flavor’da restart persistence va cross-host session visibility
baseline’dan yomonlashsa promotion pause qilinadi.

## 32. Release evidence paketi

Har candidate uchun immutable CI artifact:

```text
dist/qa/<version>/<git-sha>/
├── manifest.json
├── junit-and-test-summary/
├── screenshots-and-diffs/
├── axe/
├── performance/
├── sanitized-network-and-errors/
├── web-cep-api-parity/
├── host-capability-and-dom-inventory/
├── source-stage-archive-installed-hashes/
├── sbom-license-cve-and-provenance/
├── signatures-and-installer-verification/
├── adobe-manual-smoke/
├── production-readonly-smoke/
├── provider-canary-and-refund/
├── rollout-exposure-metrics-and-decisions/
└── marketplace-preflight/
```

Root manifest butun evidence tree hashini, CI identity/signature, retention expiry va artifact access
policy’ni saqlaydi. `PROJECT-STATUS.md`dagi PASS soni dalilning o‘zi emas; har xulosa artifact link/hash
bilan tasdiqlanadi.

Immutable candidate artifact rollout paytida o‘zgartirilmaydi. Uning root hashiga bog‘langan alohida
append-only signed rollout chain har stage uchun config revision, eligible/exposed denominator, metric
query versioni, confidence hisoblari, kill-switch drill, incident/waiverlar, promotion/pause/rollback
qarori, owner va UTC vaqtni saqlaydi. Har report oldingi report hashini oladi; final 7 kunlik closeout
chainni imzolaydi. Legacy-free rollout pre-removal V2 rolloutdan alohida evidence chain.

## 33. Risk register

| Risk | Daraja | Mitigation |
|---|---|---|
| Double quote/double state Create ichiga qotib qolishi | P0 | Wave 2 gateway UI’dan oldin |
| `pricedParams` o‘rniga original params | P0 | deep-equality contract test |
| Accountlar orasida job/reference metadata aralashishi | P0 | account-scoped registry + server verification |
| PPRO companion single-install yo‘q | P0 | Adobe-approved path yoki AE-only listing |
| Real visual/a11y/perf regression yo‘q | P0 | Wave 0 harness, har wave gate |
| Recent critical testlar CI’da emas | P0 | `qa:plugin` aggregate |
| Auth “cleanup” session policy’ni buzadi | P0 | auth controller black box invariant |
| 19k qator monolit change radiusi | P1 | visual-diff-zero mechanical extraction |
| Global CSS V1/V2 collision | P1 | strict V2 containment |
| PPRO render barrier/UXP fallback unutiladi | P1 | normalized HostCommands + native smoke |
| Raw telemetry/privacy leak | P1 | typed schema + dual redaction + canary |
| Production local koddan orqada | P1 | version drift gate before canary |
| Marketplace claims real QA’dan keng | P1 | tested host matrix only |
| Legacy fallback abadiy qoladi | P1 | explicit Wave 9 removal criteria |

## 34. Birinchi bajariladigan 30 task

1. Current route/action/network/timer inventoryni machine-readable faylga chiqarish.
2. Higgsfield `1.0.46` clean-room behavior matrixini muzlatish.
3. FrameFlow provenance manifest va original mockup baseline yaratish.
4. Canonical terminology, IA, public theme soni va product sign-off.
5. API/CEP/Web auth+model+reference+quote+session contract snapshot.
6. AE/PPRO capability/import matrix va PPRO single-install feasibility qarori.
7. Existing critical testlarni `qa:plugin` targetga yig‘ish.
8. Real browser viewport/screenshot manifest va harness.
9. axe, keyboard, screen-reader announcement smoke.
10. Timer/listener/object URL va performance instrumentation.
11. Safe-log, redactor, typed metrics va all-sink canary tests.
12. Signed feature-config schema, cohort, LKG, kill-switch va independent bootloader.
13. V2 CSS containment, existing token mapping va accessible primitives.
14. Inline scriptlarni visual-diff-zero frozen V1/modul bloklariga ajratish.
15. Explicit bootstrap va single-owner router lifecycle adapter.
16. Existing `AssetFlowAccount.request` ustida `AccountAdapter` + monotonic epoch.
17. Pre-authdan ajratilgan authenticated `HttpClient/GenClient`.
18. Normalized allowlisted `HostCommands` va UXP protocol handshake.
19. `ModelStore`ni `/gen/models` va operationsga bog‘lash.
20. `ReferenceStore`ni immutable revision state manbaiga aylantirish.
21. `SessionCoordinator` va account-scoped entity rules.
22. Revision-aware `QuoteMachine` va replacement-quote trace tests.
23. `GenerationGateway` va `pricedParams`/idempotency invariantlari.
24. `JobRegistry` registration/recovery va safe legacy cache scrub.
25. Legacy Image mode’ni end-to-end domain flag orqali gatewayga ulash.
26. V2 shell/primitivesni default-off yaratish.
27. Home V2 registry/Continue/gridni real data bilan yaratish.
28. Create Image V2’ni gatewayga to‘g‘ridan ulash.
29. Web/CEP parity, hostile-content, a11y/perf/package gatesni green qilish.
30. Internal-only AE/PR smoke va immutable evidence artifactni chiqarish.

16→17→19/20/21→22→23→24→25 canonical generation critical pathi qat’iy. Host adapter, visual
harness va shell foundation faqat o‘z dependency/gate’lari tayyor bo‘lsa parallel branchlarda yurishi
mumkin; biror parallel ish auth/money/reference critical pathini chetlab o‘tmaydi.

## 35. Yakuniy Definition of Done

FrameFlow redesign **tayyor** deb faqat quyidagilarning barchasi bajarilganda aytiladi:

- Barcha primary/secondary ekranlar bitta IA, design system va lifecycle’da.
- Demo/fake content, dead CTA, duplicate nom/navigation va production placeholder 0.
- New/existing session bitta Create DOM/controller/presentation.
- Bitta canonical generation/reference/job state; double quote/state yo‘q.
- Signed quote, priced params, credit/refund, auth va account isolation regression 0.
- Dual-host flavor’da AE/PPRO shared DOM/controller; AE-only flavor’da public artifact/copy’da PPRO 0.
- Web/CEP/API enabled model, params, reference va error parity green.
- 320×400–1000×900 real visual matrix green.
- WCAG 2.2 AA target, keyboard va supported-platform screen-reader matrix green.
- Performance/leak budget green.
- Typed redacted telemetry va updated privacy contract green.
- Full-tree package parity, signature, installer va Marketplace preflight green.
- Wave 0 selected public flavor da’vo qilgan native host matrix green; private beta alohida non-GA evidence.
- Pre-removal V2 va keyingi legacy-free artifactning alohida 100% rollout/7 kunlik soak’i sog‘lom; P0/P1 issue 0.
- Legacy engine/router/CSS xavfsiz olib tashlangan.
- Production deploy versiyasi local/release SHA bilan mos.

Shundan oldin “Higgsfield darajasida”, “professional”, “AE/Premiere parity” yoki “production-ready” degan status berilmaydi.
