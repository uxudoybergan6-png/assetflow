# FrameFlow × Higgsfield × Magnific — to‘liq UX/UI, mahsulot va bozor auditi

> Sana: 2026-08-02  
> Audit turi: jonli mahsulot walkthrough + FrameFlow production API + joriy repo kodi  
> Raqiblar: [Higgsfield](https://higgsfield.ai/), [Magnific](https://www.magnific.com/app)  
> FrameFlow: [getframeflow.app](https://getframeflow.app/) · [Stock](https://getframeflow.app/stock)

## 1. Qisqa hukm

FrameFlow bozorda joy olishi mumkin, lekin **“yana bitta hamma narsali AI generator”** bo‘lib emas. Higgsfield model, preset, kino-vizual va community bo‘yicha; Magnific esa stock, tool breadth, project, collaboration va node-workflow bo‘yicha ancha oldinda. Ularning kengligini qisqa muddatda takrorlash iqtisodiy ham, mahsulot jihatidan ham noto‘g‘ri.

FrameFlow uchun yutadigan pozitsiya:

> **Motion designer uchun asset-to-timeline workspace: tayyor template yoki stock toping, AI bilan kerakli media yarating, natijani loyihada boshqaring va After Effects timeline’iga uzilishsiz olib kiring.**

FrameFlow’ning real aktivlari bor:

- web AI Studio, 22 ta yoqilgan model: 10 image, 10 video, 1 voice, 1 SFX;
- signed quote → atomik kredit → xatoda refund oqimi;
- session, My Library va individual Projects;
- Contributor → Admin moderatsiya → katalog supply-side zanjiri;
- After Effects katalog/import/AI paneli va installer/updater texnik quvuri;
- semantik qidiruv, Free/Pro darvozalari va model-level margin boshqaruvi.

Asosiy muammo — bu qismlar hali bitta kuchli **ish jarayoni** sifatida ko‘rinmaydi. Production katalogi atigi 13 item, installer e’lon qilinmagan, natija lineage va “keyingi amal” zanjiri sayoz, tool discovery kuchsiz, ayrim UX xatolari ishonchni tushiradi.

### Strategik formula

FrameFlow Higgsfield’dan **discovery + presets + public breakdown**, Magnific’dan **tool launcher + creation detail + downstream actions + project traceability**, o‘zidan esa **AE-native import + contributor marketplace + predictable credit guard**ni birlashtirishi kerak.

## 2. Audit metodikasi va cheklovlar

Tekshirildi:

- Higgsfield home, Image, Video, Adobe plugin, Community/public project, Canvas, MCP va pricing yuzalari;
- Magnific app home, All tools, Image/Video Generator, creation detail, Image Editor asset picker, Spaces va pricing/docs;
- FrameFlow jonli home, AI Studio, My Library/sessionlar, model picker, Stock, asset detail va production API;
- FrameFlow kodi: model katalogi, studio-gen, Projects, katalog, plugin, installer/release va landing konfiguratsiyasi.

Ballar 1–10 oralig‘ida **yo‘nalish beruvchi mahsulot bahosi**, avtomatik QA yoki moliyaviy due diligence emas. Raqib pricing/promolari vaqt va regionga qarab o‘zgarishi mumkin. “Credit” birliklari platformalar orasida teng emas; xom kredit sonini to‘g‘ridan-to‘g‘ri solishtirish mumkin emas.

## 3. Uch mahsulotning asl pozitsiyasi

| Mahsulot | Foydalanuvchi ongidagi roli | Kuchli growth loop | Asosiy moat |
|---|---|---|---|
| Higgsfield | Cinematic AI creation va viral effektlar laboratoriyasi | Preset/community → recreate → generation → public project | Brend, model/preset breadth, community, creator culture, Adobe integration |
| Magnific | To‘liq creative operating system | Stock/tool → creation → Use action → Project/Space → team reuse | 250M+ stock, ko‘p tool, Spaces, Projects, team/enterprise, API/MCP |
| FrameFlow hozir | Templates + AI Studio + AE plugin kombinatsiyasi | Hali to‘liq yopilmagan | Contributor supply + AE import + AI + server-side credit safety |
| FrameFlow kerak | Motion-production OS | Discover/create → project → refine → AE timeline → reuse/share | AE-first workflow, curated compatible assets, budget-aware lineage |

## 4. Yo‘nalish beruvchi scorecard

| Yo‘nalish | FrameFlow | Higgsfield | Magnific | Izoh |
|---|---:|---:|---:|---|
| Pozitsiya aniqligi | 7 | 9 | 9 | FrameFlow va’dasi yaxshi, lekin mahsulot chuqurligi va katalog hajmi hali va’daga yetmaydi |
| Vizual farqlanish | 8 | 10 | 8 | FrameFlow acid-lime/noir o‘ziga xos; Higgsfield eng kuchli cinematic spectacle |
| Tool/model discovery | 5 | 10 | 10 | FrameFlow picker bor, lekin task-based launcher va global qidiruv zaif |
| AI model breadth | 7 | 10 | 9 | FrameFlow 22 active model bilan yomon emas; micro-tool breadth yetishmaydi |
| Generatsiya UX | 6 | 9 | 9 | Composer yaxshi, lekin session rail, overlay va model picker density muammolari bor |
| Natijani qayta ishlatish | 4 | 8 | 10 | Magnific “Use image/video” graphi benchmark |
| Projects/workflow | 5 | 8 | 10 | FrameFlow Projects bor, lekin lineage, comments, workflow va team yo‘q |
| Community/learning | 2 | 10 | 8 | FrameFlow’da Academy/public project/remix loop yo‘q |
| Stock/katalog qiymati | 3 | 6 | 10 | FrameFlow productionda 13 item; Magnific bu yerda miqyosli ustun |
| Adobe ichidagi qiymat | 8 potensial / 3 tarqatilgan | 10 | 7 | FrameFlow texnik poydevori kuchli, lekin installer `not_published` |
| Team/enterprise | 3 | 8 | 10 | FrameFlow Studio rejasi hozir asosan ko‘proq kredit |
| Ishonch/release tayyorligi | 5 | 9 | 9 | Prod sog‘lom, lekin plugin relizi, kontent va ayrim op readiness muammolari bor |

## 5. Foydalanuvchi journey taqqoslash

| Bosqich | Higgsfield | Magnific | FrameFlow | FrameFlow uchun ish |
|---|---|---|---|---|
| 1. Ilhom topish | Viral presets, community, Originals, contest | What’s new, use cases, Academy, stock | Recommended cards, landing presets | Haqiqiy preset va public project feed |
| 2. Tool topish | Image/Video mega-menu, task cards, model ro‘yxati | All tools modal, category tabs, search, pin | Image/Video/Voice/SFX, tor model picker | Task launcher + search + pin/recent |
| 3. Boshlash | Modelga mos empty state va example | Bir xil tool shell, Academy tab | Katta bo‘sh canvas + composer | Example/preset/“from timeline” start |
| 4. Sozlash | Capability chips, refs, duration, sound, resolution | Model + refs + settings, bir xil layout | Ko‘p kerakli controls bor | Picker/readiness/ETA/price hierarchy yaxshilansin |
| 5. Kutish | History va how-it-works yonma-yon | Creations barcha tool’da doim ko‘rinadi | Job/session polling va My Library | Composer overlayni qisqartirish, persistent job center |
| 6. Natijani ko‘rish | Project/generation breakdown | Kuchli creation detail modal | Lightbox va basic actions | Bitta canonical creation detail |
| 7. Keyingi amal | Recreate/reference/project | Use as style/ref, variations, camera, upscale, video, 3D, Designer | Download/project/share, ayrim op | Conditional “Use” action graph |
| 8. Tashkil qilish | Projects/Canvas/community | Projects/Spaces/library/team | Sessions + Projects | Project-first navigation, lineage va versions |
| 9. Ishga olib kirish | Adobe timeline, MCP | Plugins/API/MCP/export | AE import | Plugin reliz, auto-load, drag/drop, background job |
| 10. Qaytish | Community, contests, Academy, presets | Stock, Academy, team workspaces | Recent sessions/recommendations | Weekly drops, collections, learn/remix loop |

## 6. Higgsfield UX/UI auditi

### 6.1 Nima juda kuchli

1. **Kuchli vizual brend.** Qora fon, acid-lime signal, katta cinematic media, siqilgan uppercase display shrift va harakatli hero — “premium AI cinema” hissini darhol beradi.
2. **Discovery mahsulotning o‘zi.** Home faqat marketing sahifa emas: yangi model, public project, preset, Academy, contest, Originals va plugin’ga olib kiruvchi doimiy launch surface.
3. **Task-first mega-menu.** “Create Image”dan tashqari Relight, Inpaint, Upscale, Face/Character Swap, Camera, UGC, Reframe, Motion Control kabi ishlar alohida nom va izoh bilan topiladi.
4. **Model chooser ma’lumotli.** Search, Featured/All models, brand icon, New/Exclusive badge, resolution, duration va sound capability’lari ko‘rinadi.
5. **Preset — activation engine.** 250+ kamera/VFX presetlari foydalanuvchini “promptni nima yozaman?” muammosidan chiqaradi.
6. **Public project — growth va ta’lim bir joyda.** Foydalanuvchi yakuniy video bilan birga assetlar, brief, prompts, pipeline, model stack, generatsiya/credit/statistikani ko‘ra oladi va recreate qiladi.
7. **Adobe page isbot bilan sotadi.** Installer qadamlari, before/after, har feature uchun demo, timeline’ga to‘g‘ridan tushish, testimonial, pricing, FAQ va blog bir sahifada.
8. **Community loop.** Public/private project, real-time co-generation, chat/call, likes/comments/recreate va public feed generatsiyani ijtimoiy obyektga aylantiradi.
9. **Canvas va MCP kelajakni ko‘rsatadi.** Bir martalik generator emas, model/prompt/reference’larni workflow’ga ulaydigan platforma sifatida ko‘rinadi.

Rasmiy sahifalar: [Higgsfield home/community](https://higgsfield.ai/), [Video](https://higgsfield.ai/ai/video), [Adobe plugin](https://higgsfield.ai/plugins/after-effects), [Canvas](https://higgsfield.ai/canvas-intro), [MCP](https://higgsfield.ai/mcp), [Collaborative projects](https://higgsfield.ai/blog/higgsfield-chat-social-network).

### 6.2 FrameFlow nimani olishi kerak

- Landing’ni statik feature ro‘yxatidan **jonli discovery feed**ga aylantirish.
- Model emas, vazifa bilan nomlangan launcher: Create Image, Animate Image, Reframe, Remove BG, Upscale, SFX for Scene, Voiceover, Template Search.
- Capability-rich model modal: search, favorites/recent, price, ETA, refs, sound, max duration, resolution, provider status.
- Prompt example emas, **one-click runnable preset**; preset model/settings/prompt/reference slotlarini oldindan to‘ldirsin.
- Public project breakdown: final output, shot/assets, prompt/settings, model stack, lineage, creator, remix.
- Plugin sahifasida texnik va’dani emas, 3–5 aniq jobni before/after va timeline demo bilan ko‘rsatish.
- Academy mini-format: 3 daqiqalik “template → AI asset → AE timeline” darslari.
- Contest/challenge’ni faqat product loop tayyor bo‘lgach ishga tushirish.

### 6.3 Ko‘r-ko‘rona olinmasin

- Higgsfield’ning o‘ta ko‘p global nav elementini aynan ko‘chirish — FrameFlow’da kognitiv yuk beradi.
- Har joyda auto-play va og‘ir media — performance va accessibility zarar ko‘radi.
- “Supercomputer/agent/app builder”ni core workflow tayyor bo‘lmasdan qurish.
- Preset nomi, media, ikon, typography yoki ranglarni 1:1 klonlash; interaction pattern olinadi, trade dress emas.

### 6.4 Higgsfield’dagi yashirin imkoniyat: narx intizomi

Jonli public 3:22 loyiha sahifasi 13,491 generatsiya, 937,489 credit va 141.6 GB ko‘rsatdi; commentlarda xarajat bo‘yicha kuchli norozilik bor. Bu FrameFlow uchun muhim wedge:

- Project budget va per-shot limit;
- qimmat batchdan oldin approval;
- “estimated total / spent / approved asset cost / discarded generation cost”;
- auto stop-loss va low-cost draft → high-quality final ikki bosqich;
- client estimate eksporti.

FrameFlow signed cost-quote poydevori tufayli buni raqiblardan ishonchliroq qura oladi. Misol: [Higgsfield 4K Blockbuster Breakdown](https://higgsfield.ai/@adilinthewild/projects/4k-blockbuster-breakdown).

## 7. Magnific UX/UI auditi

### 7.1 Nima juda kuchli

1. **Creative OS sifatida tartibli.** Global rail, tool panel va Creations yuzasi ko‘p tool’da bir xil; foydalanuvchi har safar yangi interfeys o‘rganmaydi.
2. **All tools launcher.** Image, Video, Audio, Spaces, Design, 3D, Flows, Connections; search va pin bilan juda katta katalog boshqariladi.
3. **Calm visual system.** Off-white neutral, yumshoq gray panels va category accent’lar zich mahsulotni qo‘rqitmaydi.
4. **Creations doim ko‘rinadi.** Image’dan Video’ga o‘tganda ham oldingi natijalar o‘sha yon panelda — context yo‘qolmaydi.
5. **Creation detail benchmark.** Yagona media stage, thumbnail strip, Details/Comments, prompt, settings chips, references, delete/favorite/save/download va downstream actions.
6. **“Use image/video” graph.** Recreate, style/reference, variations, change camera, upscale, skin, 3D, Designer yoki video — natija ishning oxiri emas, keyingi input.
7. **Integrated asset picker.** History, Uploads, Project, search/favorite’dan asset tanlanadi; qayta upload qilish shart emas.
8. **Spaces.** Node canvas, templates/flows, history, credit/asset traceability, collaboration va reproducible workflow.
9. **Project/team chuqurligi.** Shared credit pool, comments, mentions, specific-member share, usage reporting, SSO va enterprise controls.
10. **Pricing output bilan tushuntiriladi.** Xom creditdan tashqari taxminiy image/video soni, rollover, unlimited models, concurrency va license ko‘rsatiladi.

Rasmiy sahifalar: [Magnific creative platform](https://www.magnific.com/), [Help Center](https://www.magnific.com/no/ai/docs), [Plans](https://www.magnific.com/pricing-teams), [API/business](https://www.magnific.com/in/api).

### 7.2 FrameFlow nimani olishi kerak

- Bitta **Create launcher**: search, category, pinned, recent, short description.
- Web generatorlar uchun yagona shell: Tool settings | Canvas/Creations | optional Detail drawer.
- Bitta canonical `CreationDetail`, lightbox va alohida action popoverlar o‘rniga.
- Type-aware Use menu va asset lineage.
- History/Uploads/My Library/Project’dan universal asset picker.
- Projects’ni yashirin avatar menyusidan global IA’ga ko‘tarish.
- Avval **Flow-lite**: shot board yoki chained action history; to‘liq infinite node canvas keyin.
- Project-level credit/asset history va budget.
- Team plan faqat real shared projects/credits/comments tayyor bo‘lgach.

### 7.3 Ko‘r-ko‘rona olinmasin

- 3D, Design Editor va 30+ micro-toolni birdan qurish — FrameFlow pozitsiyasini eritadi.
- Magnific off-white vizualini ko‘chirish; FrameFlow’ning noir/lime identifikatsiyasi saqlansin.
- 250M stock bilan miqyosda olishish; FrameFlow **AE-compatible curated depth** bilan yutsin.
- To‘liq Spaces kloni; avval motion project uchun shot/asset/action graph yetarli.

## 8. FrameFlow’ning hozirgi kuchli tomonlari

### 8.1 Mahsulot

- “Templates + AI + After Effects” kombinatsiyasi tushunarli va haqiqiy user jobga yaqin.
- Web va plugin bitta account/credit/library g‘oyasiga ega.
- Sessions + My Library + Projects allaqachon mavjud.
- Multi-reference image/video, start/end frame, audio refs va 4Kgacha variantlar modelga qarab qo‘llanadi.
- Prompt enhance/describe, signed quote, refund va provider adapters texnik jihatdan yetuk.
- Stock/template detail sahifasi metadata, related, collection, project, share va download/open CTA bilan yaxshi asosga ega.

### 8.2 Biznes va operatsiya

- Contributor/moderation supply zanjiri raqiblardan farqli o‘z marketplace’ini qurishga imkon beradi.
- Model-level provider cost va target margin boshqaruvi unit economics uchun kuchli poydevor.
- Free/Pro download va project limitlari serverda majburlanadi.
- Cloud Run/Neon/GCS health hozir `db:ok`, `storage:ok`.
- Katalogdagi 13 itemning barchasida pack bor; import qilinmaydigan “fake card” emas.

### 8.3 Dizayn

- Acid-lime/noir brend professional motion audience’ga mos.
- Landing cinematic editorial ritmga ega.
- Composer va card systems bir mahsulot oilasiga o‘xshaydi.
- 3 theme tizimi shaxsiylashtirish beradi.

## 9. FrameFlow’ning aniq kamchiliklari

### 9.1 P0 — ishonch va release

1. **Plugin amalda tarqatilmagan.** Prod version endpoint `installerStatus:"not_published"`; marketingda plugin CTA bor, lekin foydalanuvchi asosiy differensiatorni ololmaydi.
2. **Topaz readiness mismatch.** Production `/gen/ops` Upscale Video va Upscale Image’ni qaytaradi, ammo prod key yo‘qligi aniqlangan; bosilganda fail bo‘lishi mumkin. Lokal working tree’da configured-provider filtri yozilgan — test, commit va deploy kerak.
3. **Katalog zichligi juda past.** 13 item: 5 template, 5 motion graphics, 2 SFX, 1 graphics. LUT/Music va boshqa pill’lar bo‘sh.
4. **Bir katalog itemda preview yo‘q.** Barcha listingda media proof bir xil emas.
5. **Production UX xatolari.** Raw `{{ }}` media URL so‘rovlari, CSS columns grid, lightbox double-layer/oversize, audio detail/player, app logo semantikasi va model picker truncation ishonchni tushiradi.

### 9.2 P1 — information architecture

1. Global app navigatsiyasi Home/AI Tools/Stock bilan cheklangan; Projects va Library top-level mahsulot sifatida yetarli ko‘rinmaydi.
2. AI Studio “session/chat-first”; Magnific kabi task/project-first emas.
3. Chap session rail ko‘p vertikal joy oladi, uzoq ro‘yxat contextni bosadi.
4. Composer natijalar ustiga katta qatlam bo‘lib tushadi; canvasning foydali maydoni kamayadi.
5. Create tool’lari task cards/search/pin/recent bilan topilmaydi.
6. Image/Video/Voice/SFX — texnik mode nomi; foydalanuvchi joblari (Animate, Reframe, Remove BG, Voiceover for clip) yetarli ajratilmagan.

### 9.3 P1 — natija va workflow

1. Natija detail’da prompt/settings/references/lineage/versions to‘liq emas.
2. “Use” menu conditional action graph emas; bir natijadan keyingi ish yo‘li sayoz.
3. Parent-child generation lineage yo‘q yoki UI’da ko‘rinmaydi.
4. Project itemlari bor, lekin comments, versioning, shot structure, budget va collaboration yo‘q.
5. Asset picker oqimi My Library/Upload/Project bo‘yicha yagona component emas.
6. Session ichida tool almashganda natija “yo‘qolgandek” tuyuladigan filtr kodi bo‘lgan; lokal D7 tuzatishi mavjud, productionga chiqmagan.
7. Generation pin/favorite/compare kabi review amallari yetishmaydi.

### 9.4 P1 — stock va supply

1. Bo‘sh category tablar mahsulotni tugallanmagan ko‘rsatadi.
2. Category count yo‘q; foydalanuvchi qayerda kontent borligini bilmaydi.
3. CSS columns vizual tartibni buzadi va keyboard/read order column-first bo‘ladi.
4. Audio waveform/player grid va detail’da first-class emas.
5. After Effects/Premiere/Motion belgisi rang nuqta va qisqa harfga tushib qolgan.
6. Preview, FPS, duration, plugin compatibility va app version metadata doim bir xil emas.
7. “Similar” faqat metadata bo‘yicha; visual/semantic similarity UX kuchaytirilishi kerak.

### 9.5 P2 — growth va moat

1. Public creator profile va project breakdown yo‘q.
2. Academy/use-case content yo‘q.
3. Real runnable presets va remix loop yo‘q.
4. Contributor payout/creator reputation hali to‘liq emas.
5. Team shared credits/projects/comments yo‘q.
6. Public API/MCP va workflow template ekotizimi yo‘q.

## 10. Master feature matrix

Belgilar: ✅ kuchli/real · ◐ qisman/cheklangan · ⏳ placeholder yoki reliz qilinmagan · — yo‘q.

| Funksiya | FrameFlow | Higgsfield | Magnific | FrameFlow qarori |
|---|---:|---:|---:|---|
| Global tool search/launcher | ◐ | ✅ | ✅ | P1 qurish |
| Tool pin/recent | ◐ model pin | ◐ | ✅ | Model + tool pin birlashtirish |
| Image generation | ✅ | ✅ | ✅ | Saqlash, UXni yaxshilash |
| Video generation | ✅ | ✅ | ✅ | AE workflow bilan farqlash |
| Multi-image references | ✅ | ✅ | ✅ | Lineage ko‘rsatish |
| Start/end frame | ✅ | ✅ | ✅ | Shot workflowga ulash |
| Video/audio references | ✅ ayrim model | ✅ | ✅ | Capability chip bilan ochiq qilish |
| Voice generation | ✅ 1 active | ✅ | ✅ | Voice preview va role presets |
| SFX generation | ✅ 1 active | ✅ | ✅ | Timeline-aware SFXni kuchaytirish |
| Music generation | — | ✅ | ✅ | P3 yoki partner; hozir shart emas |
| Prompt enhance/describe | ✅ | ✅ | ✅ | Narx va lineage ochiq ko‘rinsin |
| Upscale | ⏳ prod readiness | ✅ | ✅ | P0 key/readiness; P1 before-after |
| Remove background | ⏳/disabled | ✅ | ✅ | Entitlementdan keyin |
| Reframe | ⏳ plugin UX | ✅ | ✅ | AE uchun yuqori prioritet |
| Relight/change camera/inpaint | —/dormant | ✅ | ✅ | Faqat talab yuqori bo‘lsa P2 |
| Lip sync/motion/restyle/draw | ⏳ | ✅ | ✅ | Placeholder emas, backend tayyor bo‘lganda ochish |
| Unified Creations library | ✅ | ✅ | ✅ | Filter/search/detailni kuchaytirish |
| Canonical creation detail | ◐ | ◐ | ✅ | P1 benchmark |
| Downstream Use action graph | ◐ | ✅ | ✅ | P1 asosiy feature |
| Asset lineage | — | ✅ | ✅ | P1 data model + UI |
| Projects | ✅ individual | ✅ | ✅ | Global IA + shot/budget |
| Node canvas/flows | — | ✅ | ✅ | To‘liq klon emas; Flow-lite P2/P3 |
| Comments/collaboration | — | ✅ | ✅ | Team talabidan keyin |
| Public project/remix | — | ✅ | ◐ | P2 growth loop |
| Academy/use cases | — | ✅ | ✅ | P2 content engine |
| Preset marketplace | ◐ landing | ✅ | ✅ templates/flows | P1 runnable presets |
| Stock/template catalog | ◐ 13 item | ◐ | ✅ | Curated AE depth bilan yutish |
| Contributor/moderation | ✅ | ✅ creator programs | ✅ stock ecosystem | Kuchli moat sifatida invest |
| Adobe plugin | ⏳ code bor | ✅ | ✅ plugin | P0 reliz |
| Direct timeline/project import | ✅ code | ✅ | ◐ | E2E isbot va demo |
| Native installer/updater | ✅ code, e’lon yo‘q | ✅ | ✅ | P0 sign/publish |
| Shared team credits | — | ✅ | ✅ | P3 Team |
| API/MCP | — public | ✅ | ✅ | Product-market fitdan keyin |
| Model cost/margin control | ✅ internal | ◐ | ✅ enterprise analytics | Budget UXga aylantirish |

## 11. Tavsiya etilgan information architecture

### Web

```text
Home
Create
  ├─ Image
  ├─ Video
  ├─ Audio
  └─ Edit / Enhance
Stock
Projects
Library
Learn / Explore        (P2)
Plugin
Account / Credits
```

`Create` bosilganda All tools drawer:

- qidiruv;
- Pinned, Recent, Recommended;
- Generate: Image, Video, Voice, SFX;
- Transform: Animate, Upscale, Remove BG, Reframe;
- From current asset: faqat mos actions;
- badge: New/Beta/Pro/Unavailable;
- bir qator description, expected input, from-price va ETA.

### After Effects panel

Tor panel uchun global IA yanada ixcham:

```text
Home · Stock · Create · Library · Account
```

- Projects Library ichida filter yoki header selector bo‘lsin;
- active comp/timeline reference doim ko‘rinadigan “Use current comp/frame/clip” karta bo‘lsin;
- long session list default ekran bo‘lmasin;
- background jobs yuqori status center’da turib, panel route almashsa yo‘qolmasin.

## 12. Tavsiya etilgan AI Studio UX

### 12.1 Layout

- 72px global rail yoki 220px collapsible nav;
- 320–360px tool settings panel;
- qolgan joy Creations/canvas;
- optional 360px detail drawer;
- composer sticky, lekin media ustiga 200px yopishmasin; collapse/resize bo‘lsin.

### 12.2 Empty state

Katta bo‘sh grid o‘rniga:

- 3–5 real preset;
- “Use active AE frame/clip”;
- upload yoki My Library;
- 30–60 soniyalik How it works;
- model-specific example prompt;
- low-cost draft default.

### 12.3 Model picker

Kamida 520px kenglik:

- search;
- Recommended / Pinned / Recent / All;
- brand icon + to‘liq nom;
- capability chips: refs, start/end, video/audio input, native sound, resolution, duration;
- `from ✦X`, pricing type, ETA, policy strictness;
- provider readiness: Available/Degraded/Unavailable;
- nima uchun model tavsiya qilinganini qisqa izoh.

### 12.4 Result grid

- CSS Grid yoki row-order saqlovchi verified masonry;
- virtualized/paginated media;
- date group, mode, model, project, favorite, status filter;
- image/video/audio uchun alohida card treatment;
- audio waveform + play/pause + duration;
- hover actions: Use, Project, Download, Favorite, More;
- generating tile progress/ETA bilan o‘sha joyda qoladi.

## 13. Canonical Creation Detail — eng muhim P1

Lightboxni quyidagi universal obyektga almashtirish:

### Chap sahna

- bitta asosiy image/video/audio;
- zoom/fit/fullscreen;
- video controls yoki audio waveform;
- multi-output thumbnail strip;
- before/after slider (edit/upscale/remove BG uchun);
- Similar outputs.

### O‘ng panel

Tabs:

- Details;
- Comments (Team keyin);
- History/Lineage.

Details:

- prompt va copy;
- model/version/provider;
- barcha settings chips;
- input references;
- cost, runtime, output size;
- project/session;
- created date/status;
- license/provenance.

### Type-aware `Use` menyusi

Image:

- Use as reference;
- Use as style;
- Recreate/Variations;
- Edit/Inpaint;
- Animate to video;
- Upscale;
- Remove BG;
- Extend/Relight/Change Camera — backend tayyor bo‘lsa;
- Add to Project;
- Import to AE.

Video:

- Use as reference;
- Extend/Restyle;
- Reframe;
- Upscale;
- Generate matching SFX;
- Add to Project;
- Import to AE timeline.

Audio:

- Add to current comp;
- Create variation;
- Trim/extend;
- Use as video reference;
- Add to Project;
- Download.

Muhim qoida: action faqat backend `enabled && providerConfigured && inputCompatible` bo‘lsa ko‘rinadi.

## 14. Lineage va project data modeli

FrameFlow natijani fayl emas, **creation graph node** sifatida saqlashi kerak.

Minimal maydonlar:

- `rootGenerationId`;
- `parentGenerationId`;
- `operation` (`generate`, `variation`, `edit`, `animate`, `upscale`, `removebg`, `reframe`, `sfx-match`);
- input asset/reference ID’lari va slot roli;
- model ID + model version;
- prompt + normalized settings snapshot;
- quote/cost/provider actual cost;
- status/refund/retry lineage;
- output assets + hashes;
- project/shot ID;
- privacy/share state.

Project v2:

- Project → Shots/Boards → Creations;
- shot status: Draft / Review / Approved;
- pinned hero/selected take;
- per-shot va project budget;
- spent vs approved-output cost;
- notes/comments keyin;
- export/import history.

Bu full Magnific Spaces klonidan kichik, lekin motion designer uchun ancha aniq.

## 15. Stock/catalog auditi va kontent rejasi

### Hozirgi production

- jami 13 item;
- 5 template;
- 5 motion graphics;
- 2 SFX;
- 1 graphics;
- 12 previewli, 1 previewsiz;
- barcha 13 pack mavjud;
- LUT va Music bo‘sh.

### Darhol UX qoidalari

- count ko‘rsatish: `Motion Graphics · 5`;
- 0 item category’ni hide yoki disabled + “Coming when X assets”;
- filter kombinatsiyasida natija bo‘lmasa “Clear filters” va yaqin category tavsiyasi;
- video hover preview, audio inline waveform;
- app logo/nom/version aniq;
- license va compatibility yuqorida;
- semantic/visual similar;
- desktopda row-order saqlovchi grid.

### Kontent quality gate

Har listing uchun majburiy:

- hero thumb;
- video/audio preview;
- app + minimum version;
- resolution, FPS, duration, aspect;
- file/pack format va size;
- font/plugin dependency;
- commercial license;
- 8–15 yaxshi tag + embedding;
- import smoke-test;
- contributor identity va moderation status.

### Zichlik mezoni

- public category ochilishi: kamida 12 item;
- ishonchli browse hissi: category boshiga 30+ sifatli item;
- 90 kunlik MVP supply maqsadi: 250+ curated compatible asset;
- haftalik 10–20 yangi approval va 2 curated collection;
- 80%+ listingda real preview, keyin 95%+.

Magnific bilan “millionlab asset” sonida emas, **har asset AE workflow’da ishlashi** bilan raqobat qilish kerak.

## 16. After Effects plugin strategiyasi

FrameFlow’ning eng katta differensiatori shu, lekin marketing emas, haqiqiy distribution bo‘lishi kerak.

### P0 ship gate

- signed/notarized macOS va Authenticode Windows installer;
- version endpointda real release;
- clean install → login → catalog sync → pack import E2E;
- AI generate → background complete → Project panel/timeline import E2E;
- updater/migration/uninstall isboti;
- offline/error/retry copy;
- website download CTA faqat real artifact bo‘lsa.

### Higgsfield’dan olinadigan plugin jobs

- current frame/clip/comp’ni one-click reference;
- resultni AE Project panel va faol comp/timeline’ga qo‘yish;
- Reframe;
- Remove BG;
- Upscale;
- Draw/Edit;
- generation panel yopilsa ham backgroundda davom etishi;
- drag/drop va local cache;
- before/after va progress.

### FrameFlow’ning o‘ziga xosligi

- template katalog va AI bir panelda;
- template ichiga AI-generated image/video/audio assetni replace qilish;
- comp markers/work area’dan SFX cue plan;
- project budget va generation lineage;
- contributor template’ning to‘liq compatible pack importi.

## 17. Landing, growth va community

### Landing yangi tartibi

1. Aniq hero: “Find or generate the asset. Put it on your AE timeline.”
2. 45–60 soniyalik real workflow demo.
3. Runnable presets.
4. Curated stock/templates.
5. Public project breakdown.
6. Plugin before/after va 3-step install.
7. Pricing output-equivalent bilan.
8. Academy/use case.
9. Creator/contributor CTA.

### Community MVP

To‘liq social network shart emas. Avval:

- public/private project switch;
- creator profile;
- final output + selected assets;
- prompt/settings/model stack;
- lineage;
- Remix/Recreate;
- like/save/share;
- moderation/report;
- comments keyin.

### Creator supply loop

```text
Contributor upload → moderation → catalog → download/import data
→ top creator/profile → payout/reward → ko‘proq sifatli upload
```

Reputation signal:

- approval rate;
- successful imports;
- save/download-to-view ratio;
- refund/support complaint;
- freshness;
- user rating keyin.

## 18. Pricing va monetizatsiya auditi

### FrameFlow hozir

- Free: $0, 50 credit/mo, 15 download, 1 project;
- Pro: $19, 1,000 credit/mo, unlimited download/project, AE plugin;
- Studio: $59, 3,000 credit/mo, Pro bilan deyarli bir xil boshqa benefits.

### Muammolar

1. `1,000 credits` foydalanuvchiga natija sonini tushuntirmaydi.
2. Studio rejasi 3× creditdan tashqari yetarli professional sabab bermaydi.
3. Concurrency, queue priority, rollover, top-up, team, license va support SLA aniq emas.
4. Plugin e’lon qilinmagan paytda Pro’ning asosiy benefit’i bajarilmagan.

### Tavsiya

- Har plan’da 3–4 benchmark: “~X Nano Banana 2 1K images”, “~Y Veo Lite 8s videos”, “~Z voiceovers”.
- Model/duration calculator.
- Top-up va spent history.
- Rollover yoki kamida renewal oldidan clear warning.
- Pro: plugin, unlimited download, higher concurrency, core workflows.
- Studio: priority queue, 4–8 parallel jobs, project budgets, batch presets, commercial workflow support.
- Team keyin: seats, shared credits, shared projects, comments, spend caps, usage report.
- Unlimited faqat fair-use va COGS isbotidan keyin.

Magnific xom kreditga qo‘shimcha output equivalents, rollover, concurrency va commercial rights ko‘rsatadi; Higgsfield esa model allowances va parallel generation bilan tierlarni farqlaydi. FrameFlow ham raw-credit comparisondan chiqishi kerak.

## 19. Trust, safety va operatsiya

### Model readiness kontrakti

UI model/actionni faqat quyidagida ko‘rsatsin:

```text
catalog.enabled
AND provider configured
AND entitlement available
AND current health not hard-down
AND input compatible
```

Endpoint har model uchun qaytarsin:

- `available`;
- `degraded`;
- `reasonCode`;
- `etaSec` va measured flag;
- `priceFrom`;
- input/capability;
- fallback model.

### User trust

- generatsiyadan oldin exact quote;
- timeout/refund status history;
- source/model/settings lineage;
- license va data training policy;
- content moderation/review;
- public status page;
- provenance/C2PA yo‘nalishi;
- support trace ID.

### Performance/accessibility

- reduced-motion;
- autoplay faqat viewport va muted;
- keyboard-order row-first;
- focus trap/escape modal;
- visible labels/ARIA;
- responsive composer;
- lazy media va poster;
- raw template bindings networkga chiqmasin.

## 20. Nima qurilmasin — hozircha

- To‘liq 3D suite;
- generic design editor;
- full Figma-like infinite canvas;
- Supercomputer/app builder kloni;
- product usage yetarli bo‘lmasdan public API/MCP;
- backend yo‘q 10 ta “Coming soon” tool;
- millionlab generic stock bilan raqam poygasi;
- community feed, agar recreate/lineage loop yo‘q bo‘lsa.

## 21. Ustuvor roadmap

### P0 — 0–14 kun: ishonch va ship

1. Lokal D4/D7 va `/gen/ops` configured-provider fixlarini test → commit → deploy.
2. Plugin signing credentials/installer release; version endpoint real artifact qaytarsin.
3. AE E2E: login, sync, template import, AI generate/import, updater.
4. Raw binding requests, stock grid, lightbox, audio player va app logosini tuzatish.
5. Bo‘sh categorylarni hide/count; 1 previewsiz itemni to‘ldirish.
6. Provider/model readiness va friendly error copy.

Exit criteria:

- installer success ≥95%;
- katalog import success ≥97%;
- AI job terminal outcome/recovery ≥97%;
- UI’da configured bo‘lmagan action 0;
- browser console/raw-binding network xatosi 0.

### P1 — 15–45 kun: core workflow

1. Create launcher + tool search/pin/recent.
2. Model picker redesign.
3. Canonical Creation Detail.
4. Type-aware Use action graph.
5. Universal asset picker.
6. Projects va Library global nav.
7. Generation favorite/pin/compare.
8. Project budget v1.
9. 100+ quality assetga chiqish, real weekly collections.

### P2 — 46–90 kun: moat va growth

1. 250+ curated assets, 6 category’da minimal density.
2. Runnable presets va weekly drops.
3. Public project breakdown + Recreate/Remix alpha.
4. Creator profile va contributor reputation.
5. Academy mini-lessons.
6. Shot board / Flow-lite + lineage/history.
7. Pricing output equivalents va Studio differentiation.

### P3 — 3–6 oy: collaboration va platform

1. Team shared projects/credits/comments/spend caps.
2. Workflow templates va batch apps.
3. Node canvas faqat Flow-lite talab isbotlansa.
4. Public API/MCP faqat integrator talabi bo‘lsa.
5. Premiere/Resolve kengayishi faqat AE retention kuchli bo‘lsa.

## 22. KPI va north-star

### North-star

> **Haftalik AE loyihasiga muvaffaqiyatli olib kirilgan va ishlatilgan FrameFlow assetlari.**

Raw generations north-star emas: ko‘p gen katta qiymat bermasligi va COGSni oshirishi mumkin.

### Funnel

- landing → signup;
- signup → first successful asset;
- first asset → Project yoki AE import;
- plugin download → install → login → first import;
- search → asset open → download/import;
- result → downstream Use action;
- week-1/week-4 return.

### Sifat

- generation success/refund rate per model;
- p50/p95 ETA accuracy;
- import success per app/version;
- zero-result search rate;
- category preview coverage;
- downstream reuse rate;
- approved output cost / total generation cost;
- support tickets per 100 active users.

### Supply va revenue

- contributor submit → approval time;
- approval rate va successful-import rate;
- free → paid;
- paid retention/churn;
- gross margin per model/tool;
- Studio plan attach rate;
- credit breakage va top-up rate.

## 23. Go-to-market hukmi

### FrameFlow yuta oladigan segment

- After Effects ishlatadigan freelance motion designers;
- kichik post-production va social-video studiyalar;
- template, overlay, SFX, voice va AI shotni bir loyihada ishlatadigan creatorlar;
- ko‘p sayt va download/upload orasida yurishni istamaydigan editorlar.

### Yutolmaydigan front — hozir

- “barcha creative AI ishlar uchun eng katta platforma”;
- 3D/design/stock breadth bo‘yicha Magnific;
- viral model/preset/community miqyosi bo‘yicha Higgsfield;
- enterprise collaboration va API breadth.

### Bozor sharti

FrameFlow joy oladi, agar 90 kun ichida quyidagi to‘rtta haqiqat ko‘rinsa:

1. Plugin haqiqatan install va import qiladi.
2. Katalog browse qilishga arziydigan zichlikka yetadi.
3. Natija bir marta yuklab olinadigan fayl emas, Project/Use/Lineage orqali qayta ishlatiladi.
4. “AE’ga olib kirish + budget nazorati” raqiblardan aniq tezroq va tushunarli bo‘ladi.

Shunda FrameFlow Higgsfield yoki Magnificning kichik nusxasi emas, **motion-production uchun torroq, tezroq va byudjetni biladigan operating layer** bo‘ladi.

## 24. Yakuniy prioritet formulasi

```text
Avval: ship + trust + content density
Keyin: creation detail + Use graph + Projects/lineage
So‘ng: presets + public breakdown + creator loop
Oxirida: team + flows + API/MCP
```

Eng katta mahsulot qarori: **model sonini ko‘paytirish emas, mavjud natijani ish jarayoniga aylantirish.** FrameFlow’ning bozordagi o‘rni aynan shu yerda.

