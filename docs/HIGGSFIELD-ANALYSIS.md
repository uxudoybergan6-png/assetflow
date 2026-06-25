# Higgsfield CEP — kod darajasidagi tahlil (AssetFlow AI Tools uchun)

> **Maqsad:** Higgsfield AE/Premiere CEP plaginini KOD darajasida o'rganib, AssetFlow "AI Tools"
> tab uchun **O'XSHASH (1:1 EMAS)** struktura qurish bo'yicha reja chiqarish.
> **Bu faqat tahlil bosqichi** — hech qanday kod o'zgartirilmadi/implement qilinmadi.

## Manba va metod
- **Manba (faqat o'qildi):** `/Library/Application Support/Adobe/CEP/extensions/ai.higgsfield.cep`
  — `ExtensionBundleName=Higgsfield`, `v1.0.17`, Panel `600×650`, Host **AEFT + PPRO**, CSXS 9.0,
  CEF `--enable-nodejs --mixed-context`.
- **Metod:** Bundle minified, lekin Vite sourcemap (`.cjs.map`) `sourcesContent` bilan kelgan —
  undan **133 ta toza TS/React manba fayli** tiklandi. Minified ExtendScript host (`jsx/index.js`)
  dan **25 ta funksiya** brace-match bilan ajratildi. Tahlil 6 domen + 1 moslash agenti bilan
  parallel bajarildi. **Manba kodi repoga nusxalanmadi** (vaqtinchalik `/tmp` da, tahlildan keyin tashlanadi).
- **Maxfiylik:** topilgan API key / token / secret / Sentry DSN / OAuth `client_id` / parol —
  **REDAKT qilindi**, bu hujjatga YOZILMADI. Faqat mexanizm umumiy tasvirlangan.

## Stek (qisqa)
React 19 + **Bolt-CEP** (`vite-cep-plugin`) + `HashRouter` + **TanStack Query** (butun server-state) +
**OAuth 2.0 / PKCE** (Clerk IdP, browser-redirect) + **GrowthBook** (feature-flag) + Sentry + Amplitude.
JS↔ExtendScript ko'prik: **`evalES`/`evalTS`** (tiplangan, namespace-skoplangan `csi.evalScript` wrapper).
Dual-host: bitta panel AE va Premiere'da ishlaydi (`getAdobeHostAppId()` runtime'da aniqlaydi).

## Mundarija
1. [Fayl xaritasi, framework va build](#1-fayl-xaritasi-framework-va-build)
2. [Navigatsiya va routing](#2-navigatsiya-va-routing)
3. [Apps launcher va model config](#3-apps-launcher-va-model-config)
4. [⭐ Project-panel media auto-load (to'liq zanjir)](#4--project-panel-media-auto-load-toliq-zanjir)
5. [Natija import (AE/Premiere)](#5-natija-import-aepremiere)
6. [Context-actions (media yuklangach)](#6-context-actions-media-yuklangač)
7. [Prompt bar va kontrollar](#7-prompt-bar-va-kontrollar)
8. [Auth va history](#8-auth-va-history-umumiy-secretsiz)
9. [API naqshi](#9-api-naqshi-secretsiz)
10. [⭐ AssetFlow'ga qanday moslaymiz (+ jsx reja + risklar)](#10-assetflowga-qanday-moslaymiz)
11. [⭐ Tool → Endpoint → Model jadvali ("tool=UX, model=API")](#11--tool--endpoint--model-jadvali-tool--ux-model--api--kod-bilan-tasdiqlandi)

---

## 1. Fayl xaritasi, framework va build

**Yagona panel, ko'p manba.** Garchi `src/js` da yuzlab fayl bo'lsa-da, bu BITTA WebView/CEP panel ("Higgsfield", `mainPath: ./main/index.html`). `cep.config.ts` da faqat bitta `panels[]` element bor. Ko'p "route" (video/image/edit/cinema-studio va h.k.) — bu alohida panellar emas, balki React Router ichidagi yo'llar; barchasi shu yagona panel ichida render bo'ladi. Host AEFT + PPRO, lekin baribir bitta panel ikkala dasturda ham ishlaydi (`getAdobeHostAppId()` runtime'da qaysi host ekanini aniqlaydi).

**Daraxt xaritasi:**

| Yo'l | Roli |
|------|------|
| `main/main.tsx` | Entry: analytics + Sentry init, `initBolt()` (jsx host yuklash), so'ng `#app` ga React mount. |
| `main/app.tsx` | Provayderlar piramidasi (QueryClient → GrowthBook → Auth → gate'lar) + `HashRouter` route jadvali; Premiere timeline'ni 1s interval bilan poll qiluvchi debug logger. |
| `main/routes/` | Sahifalar: `video`, `image`, `cinema-studio`, `edit` (+ draw-to-edit/reframe/remove-bg/upscale), `kling-motion-control`, `secondary-view` (Library/Nodes), `layout` (header+tab+outlet). |
| `main/components/` | UI: `navigation-tabs`, `view-switcher`, `auth-gate`, `workspace-selection-gate`, `header-actions`, `send-button-with-cost-tooltip`, `update-button`. |
| `lib/utils/` | `bolt.ts` (CEP↔JSX ko'prik), `cep.ts` (host ID, klaviatura/drop patch), `env.ts` (Vite env validatsiya). |
| `lib/cep/` | Vendor SDK: `csinterface.js`, `vulcan.js` (cross-app messaging), `node.ts` (Node modullarini `require` bilan o'rash). |
| `lib/creative-apps/` | Domen yadrosi: `api/` (job yaratish, cost estimate, balans, workspace, reference upload), `config/models|video-models` (har bir AI model alohida fayl — Veo, Kling, Seedance, Flux, Nano-Banana, Soul va h.k.), `hooks/` + `queries/` (react-query qatlami), `utils/` (kredit/o'lcham/import). |
| `lib/auth/` | OAuth (PKCE-ko'rinish) oqimi: `auth.ts`, `config.ts`, success/error HTML shablonlar, `use-auth`/`use-user-info`. |
| `lib/updater/` | O'z-o'zini yangilash: manifest olish, versiya solishtirish, installer yuklash. |
| `lib/growthbook/` | Feature-flag (cinema-studio, draw-to-video, edit-video on/off). |
| `lib/analytics/` | Amplitude — route va user sync trackerlar. |
| `lib/sentry.ts`, `sentry-error-boundary.tsx` | Xato kuzatuvi va React error boundary. |
| `lib/components/bg-sync.tsx` | Panel fonini Adobe theme rangiga moslash. |
| `lib/query-client.ts` | Yagona TanStack Query klient. |

**Framework steki:** React 19 + `react-router-dom` (`HashRouter`, CEP file:// uchun zarur) + `@tanstack/react-query` (barcha server holati shu orqali) + `@growthbook/growthbook-react` (feature-flag) + Sentry (error boundary) + Amplitude (analytics) + React-Spectrum izlari (`enableSpectrum` PointerEvent patch) + Tailwind utility klasslar. **`bolt.ts` ko'prigi** — bu Bolt-CEP ramkasining yadrosi: `evalES` (namespace'ga skoplangan xom evalScript) va `evalTS` (tiplangan, host funksiya nomi + JSON-serialized argumentlar bilan chaqiruvchi, host xatosini ushlab `reject` qiluvchi wrapper). Qo'shimcha: `listenTS`/`dispatchTS` (PlugPlug ExternalObject orqali CEP↔JSX event), Vulcan orqali cross-app xabar. Host funksiyalar `host["ai.higgsfield.cep"].<fn>(...)` namespace ostida chaqiriladi.

**Build/bundle:** `vite` + `vite-cep-plugin` (cep.config.ts'dan manifest.xml hamda ZXP'ni generatsiya qiladi; `extensionManifestVersion 6.0`, `requiredRuntimeVersion 9.0`, CEF flaglar `--enable-nodejs --mixed-context`). JS bundle CJS chiqishi + sourcemap (`build.sourceMap: true`, `sourcesContent` bilan — shuning uchun toza TS tiklangan). JSX/ExtendScript host kodi ALOHIDA bundlanadi va `jsx/index.js` sifatida yetkaziladi (`jsxBin: "off"` — ya'ni jsxbin emas, oddiy JS; `initBolt()` runtime'da uni `evalFile` bilan yuklaydi). ZXP imzo DigiCert/Apple TSA bilan, parol env (`ZXP_PASSWORD`) orqali — manba'da default placeholder bor, REDAKT qilindi, real secret yo'q. Panel o'lchami `600x650` (config'dagi tashqi `width/height 500/550` — eskirgan, `panels[0]` ustun). API bazasi va OAuth endpointlari `import.meta.env` (VITE_*) orqali kiritiladi va `env.ts` da majburiy tekshiriladi.

**AssetFlow uchun nimasi muhim:** Higgsfield bizning kelajakdagi AE plugin arxitekturasi uchun deyarrli ideal referens: yagona React panel + Bolt-CEP `evalTS` tiplangan ko'prik orqali host (AE/PPRO) operatsiyalari (footage import, layer source almashtirish, render-queue boshqaruvi — `_jsx_functions/` da ko'rinadigan import oqimlari) bajariladi, butun server-holati TanStack Query bilan boshqariladi, kredit/cost estimatsiya generatsiyadan oldin signed-quote sifatida olinadi — bu bizning mavjud `cost-quote → atomik kredit → refund` oqimimizga to'g'ridan-to'g'ri mos. Eng amaliy o'rinlar: (1) `evalES`/`evalTS` namespace-skoplangan ko'prik naqshi — bizning AE Browse + Studio Gen ni bitta panelga birlashtirish uchun; (2) GrowthBook-asosli feature-gating (model/funksiyalarni runtime'da yoqish) bizning Free/Pro va "tez orada" funksiyalar uchun; (3) HashRouter + per-model config fayllar naqshi — har bir AI modelni alohida deklarativ fayl sifatida saqlash bizning `gen-models.ts` katalogini kengaytirishda namuna bo'ladi; (4) o'z-o'zini yangilash (updater manifest) — CEP'ni qo'lda qayta-o'rnatishsiz tarqatish uchun.

---

## 2. Navigatsiya va routing

**Router tanlovi — HashRouter (`react-router-dom` v6).** `app.tsx` da `AppRoutes` butun route daraxtini bitta `<HashRouter>` ichiga o'raydi (memory yoki BrowserRouter emas). Bu CEP/CEF muhitida `file://` orqali yuklangan SPA uchun to'g'ri tanlov — URL `index.html#/video` ko'rinishida bo'ladi, server-side rewrite shart emas. Faqat bitta CEP panel mavjud (`cep.config.ts` → `panels: [{ name: "main", mainPath: "./main/index.html" }]`, AEFT + PPRO host); ya'ni "secondary-view" alohida CEP oyna emas — u shunchaki hash-route (pastda).

**Route daraxti** (`app.tsx`, hammasi bitta `<Layout>` parent ostida, `index` → `Navigate to="video"`):
- `/video` (`VideoRoute`), `/generate` (`ImageGenerationRoute`), `/home` (`ImageRoute` = start/launcher ekran), `/cinema-studio` (feature-flag bilan himoyalangan — o'chiq bo'lsa `/video` ga redirect), `/motion-control` (`KlingMotionControlRoute`), `/edit` + `/draw-to-edit` + `/reframe` + `/remove-bg` + `/upscale` (hammasi bitta `edit.tsx` eksportlari), va `/library` + `/nodes` (ikkalasi ham `SecondaryViewRoute` — hozircha faqat sarlavha ko'rsatadigan placeholder/stub view).

**Tab navigatsiya (ikki bosqichli, NavLink/Link asosida).** Ikkita alohida tab komponenti bor: (1) `navigation-tabs.tsx` — `react-router` `NavLink` bilan Video/Image (`/video` ↔ `/generate`) o'tkazadi, `isActive` ni avtomatik pill-stil bilan ko'rsatadi. (2) `view-switcher.tsx` — yuqori darajadagi "mode" almashtirgich (Generate / Edit / Library / Nodes), `Link` + `useLocation().pathname` bilan active holatni o'zi hisoblaydi (`generate` uchun `/`, `/generate`, `/video` ni faol deb biladi). `cinema-studio.tsx` esa route ichida o'z lokal `CinemaStudioTabs` (Video/Image) `useState` bilan boshqaradi — bu router state EMAS, faqat komponent state, va `key={mode}` orqali `GenerationWorkspace` ni mode o'zgarganda qayta mount qiladi.

**Launcher → tool → back oqimi.** `Layout` `useLocation().pathname` ni tekshirib, "generation" route'larda (`/video`, `/generate`, `/edit`, `/upscale` va h.k.) header'ni **yashiradi** (to'liq ekran tool); faqat `/library`/`/nodes` kabi secondary route'larda pastki/yuqori header (Logo + `ViewSwitcher` + `HeaderActions`) ko'rinadi. "Back" tugmasi yo'q — qaytish imperativ `navigate("/video")` orqali amalga oshiriladi: `edit.tsx` da bir nechta yopish/bekor qilish nuqtalari (`onClose`, modal yopilishi) `navigate("/video")` chaqiradi, `kling-motion-control.tsx` ham shunday. Demak default "uy" — `/video`. Cross-route ma'lumot uzatish `location.state` orqali: image/edit route'lari `/edit` ga `state: { videoAsset, requestedAction }` bilan navigatsiya qiladi, qabul qiluvchi `getRouteVideoAsset(location.state)` bilan o'qiydi.

**State/routing qayerda saqlanadi (qatlamlarga ajratilgan).**
- *Routing/URL state*: HashRouter hash'da (`#/...`) — hozirgi sahifa va `location.state` (vaqtinchalik, navigatsiya orasida uzatiladigan `videoAsset`).
- *Server/cache state*: `@tanstack/react-query` (`queryClient`, `QueryClientProvider`) — kreditlar (`useBalance`), user (`useCreativeAppsUser`/`useUserInfo`), job ro'yxati/detallari, workspace'lar. Host-tomondan (ExtendScript) keladigan `mainPanelRouteChanged` event'i (`listenTS`) bir vaqtning o'zida `queryClient.invalidateQueries(["creative-apps","jobs"])` + `navigate(event.path)` qiladi — ya'ni Premiere/AE host kodi panel route'ini majburiy almashtira oladi.
- *Auth/feature context*: `AuthProvider` (React context, `useAuth`) va `GrowthBookProvider` (feature-flag, `useIsCinemaStudioEnabled` kabi) butun daraxtni o'raydi.
- *Lokal komponent state*: `useState` (masalan cinema-studio mode, edit form sozlamalari).
- *Persistent on-disk state*: `draw-to-edit-view.ts` — Draw-to-Edit panel holatini `localStorage` (`higgsfield.drawToEdit.panelState`) VA home katalogdagi `.higgsfield-draw-to-edit-<appId>.json` fayliga yozadi (`csi.getApplicationID()` bilan host'ga bog'langan), `dispatchTS("drawToEditViewStateChanged")` bilan boshqa kontekstga signal beradi — bu CEP panel qayta yuklanganda holatni tiklash uchun.

**Gate'lar oqimni qanday boshqaradi (ketma-ket "darvozalar").** `app.tsx` da provider'lardan keyin oqim qat'iy ierarxik: `AuthProvider → AuthGate → WorkspaceSelectionGate → AppRoutes`. `AuthGate` uch holatni ekran sifatida render qiladi: `isInitializing` ("Restoring session..." loader), `!isAuthenticated` (brauzerda OAuth login tugmasi — `login()` browser oqimini ochadi), aks holda `children`. Router umuman mount BO'LMAYDI auth bo'lmaguncha. Undan keyin `WorkspaceSelectionGate` `useCreativeAppsUser` xatosini tekshiradi: agar xato `isWorkspaceSelectionRequiredError` bo'lsa (ya'ni server bir nechta workspace qaytarsa va tanlov kerak), butun app o'rniga workspace-tanlash ekranini ko'rsatadi va `useSelectWorkspace` mutation bilan tanlovni serverga yuboradi; xato bo'lmasa shaffof tarzda `children` ni o'tkazadi. Demak routing'ga yetib borishdan oldin ikkita majburiy shart: autentifikatsiya + workspace tanlangan bo'lishi.

**Bizning AE plagin bilan tafovut.** Bizning AssetFlow AE paneli — bitta statik HTML + JS (`assetflow-catalog.js`, tab-asosli `nav: video` kabi ko'rinishlar), DOM'ni qo'lda almashtirish va prefs/`localStorage` da oddiy holat saqlash bilan ishlaydi; rasmiy router, server-cache qatlami yoki deklarativ gate yo'q. Higgsfield esa to'liq React SPA — HashRouter bilan deklarativ route daraxti, react-query bilan server-state keshi, React context bilan auth/feature-flag, va render-bloklovchi gate'lar (auth → workspace) zanjirini ishlatadi; navigatsiya `<Link>/<NavLink>` + imperativ `navigate()` orqali, hatto host (ExtendScript) ham `mainPanelRouteChanged` event'i bilan panel route'ini boshqara oladi — bizning bitta-HTML, tab-toggle yondashuviga nisbatan ancha boy, ko'p qatlamli arxitektura.

---

## 3. Apps launcher va model config

**Konfig-asoslimi yoki hardcoded?** — **Toza konfig-asosli registry.** Har bir model alohida fayl (`config/models/*.ts`, `config/video-models/*.ts`) sifatida saqlanadi va `models.ts`/`video-models.ts` ularni Vite'ning `import.meta.glob("./models/*.ts", { eager: true })` mexanizmi orqali avtomatik yig'adi. Yig'ilgan natija — `Record<string, ModelConfig>` ko'rinishidagi ikkita Map: `modelConfigs` (image) va `videoModelConfigs` (video). Kalit = fayl nomidan olingan model `id` (masalan `nano_banana_2`). Har modul `name`, `schema`, `uiSchema`, `resolvePayload` eksport qiladi; registry yig'ishda `id`, `jobSetType` (default = filename) va display-name qo'shiladi. Image ro'yxati `IMAGE_MODEL_ORDER` massivi bo'yicha tartiblanadi (ro'yxatda yo'q modellar oxiriga, alifbo bo'yicha). Yangi model qo'shish = yangi `.ts` fayl tashlash, hech qanday markaziy ro'yxatni qo'lda tahrirlash shart emas (faqat tartib/exclude ro'yxatlari ixtiyoriy).

**Bitta model config sxemasi (maydonlar — `ModelModule`/`ModelConfig` interfeysi + JSON-Schema ichki maydonlari):**
- `id` / `jobSetType` — registry kaliti va backend job turi (display-name `model-display-names.ts` Record orqali mapping qilinadi: `jobSetType` → ko'rinadigan nom, ba'zan model-variant bo'yicha alohida nom).
- `name` (displayName), `schema` (RJSF `RJSFSchema`), `uiSchema` (RJSF widget konfiguratsiyasi: textarea/select/radio/range/stepper).
- **Inputlar** — `schema.properties` ichida: `prompt` (matn, ba'zan `maxLength`); referens-rasmlar `input_image` (yakka) yoki `input_images` (massiv) yoki video uchun `medias` massivi `role` enum bilan (`start_image`/`end_image`/`image`/`video`/`audio` — ya'ni start-end frame qo'llab-quvvatlash shu yerda); har element `{id, type}`.
- **Aspect ratio variantlari** — `aspect_ratio` enum (har model o'z to'plamiga ega, masalan nano_banana 5 ta, kling_omni 9 ta + `auto`).
- **Resolution / quality / duration** — `resolution` (`1k`/`2k`/`4k` yoki `480p/720p/1080p`), `quality`, `duration` (video, soniyada, `minimum`/`maximum` yoki enum), `mode`, `genre`, `model` (sub-versiya: `schnell/dev/pro` yoki `veo-3-1-fast/preview`), `batch_size`, `seed`, `steps`/`cfg`, `sound`/`generate_audio`.
- **Narx (credits) hisobi maydonda EMAS** — model fayllarida `cost`/`credits`/`price` umuman yo'q. Narxni **backend** belgilaydi: ixtiyoriy `resolveCostEstimatePayload` (faqat cinema-studio modellarida bor) yoki oddiy `resolvePayload` natijasi `estimate-job-cost` API (`useJobCost` hooki, `/creative-apps/...` cost endpoint) ga yuboriladi va kreditlar `useBalance`/`SendButtonWithCostTooltip` orqali ko'rsatiladi.
- **Tool oilasi** — alohida maydon emas, balki *qaysi Record'ga tegishliligi* bilan aniqlanadi: `videoModelConfigs` → video, `modelConfigs` → image (`use-create-job.ts`ning `getJobMediaType` shu mantiqdan foydalanadi; `reframe`/`sam_3_video`/`topaz_video`/`kling3_0_motion_control` esa qattiq video deb belgilangan). `resolvePayload(formData)` esa form qiymatlarini backend payload'iga (width/height ni aspect+resolution'dan hisoblab) o'giradi.

**Karta → tool yo'li (routing + gate'lar):** Router (`app.tsx`) sobit yo'llarga ega — `/generate` (Image), `/video`, `/cinema-studio`, `/motion-control`, `/edit`, `/reframe`, `/remove-bg`, `/upscale`, `/draw-to-edit`. Bitta umumiy `GenerationWorkspace` komponenti `jobType` ("image"/"video") va `excludedModelIds`/`modelIds` props'lari bilan qayta ishlatiladi: u `allConfigsByJobType` (mos Record) ni `excludedModelIds`/`modelIds` bo'yicha `Object.entries(...).filter(...)` qilib model-grid (`modelOptions`) yasaydi. `image.tsx` `DEFAULT_IMAGE_EXCLUDED_MODEL_IDS`, `video.tsx` `DEFAULT_VIDEO_EXCLUDED_MODEL_IDS` (cinema-studio modellarini umumiy grid'dan chiqaradi). **Gate'lar ikki xil:** (1) **GrowthBook** feature-flaglar — `useIsCinemaStudioEnabled`, `useIsDrawToVideoEnabled`, `useIsEditVideoEnabled` apps-launcher kartalari va route'larni ko'rsatish/yashirishni boshqaradi (`shouldShowStartAppItem`, Cinema-Studio route faqat flag yoqilganda render bo'ladi). (2) **Plan-asosli gate** — `seedance-access.ts`: `isSeedanceStandardBlockedForPlan(modelId, planType)` `seedance_2_0` modelini `free/basic/starter` planlar uchun bloklaydi va "Upgrade your plan" xabarini ko'rsatadi (image va edit route'larda submit oldidan tekshiriladi). Referens limitlari ham model-ID bo'yicha `REFERENCE_LIMIT_BY_MODEL_ID` Record'da.

**AssetFlow `gen-models.ts` bilan o'xshashlik:** Ikkala loyiha ham model-katalog naqshidan foydalanadi, lekin masshtab va manba farq qiladi. AssetFlow'da `lib/gen-models.ts` — **server-side** yagona katalog bo'lib, narxni o'zi hisoblaydi (`computeGenCost`, video uchun soniya/kredit) va imzolangan `cost-quote` → atomik kredit yechish oqimini ta'minlaydi; ya'ni narx-mantiq client-da. Higgsfield'da esa katalog **client-side** (CEP UI ichida) va deklarativ: har model faqat RJSF schema + `resolvePayload` ni e'lon qiladi, narx/kredit to'liq backend zimmasida (model fayllarida hech qanday cost yo'q). Higgsfield registry'si fayl-per-model + glob-auto-discovery bilan ancha modulyar (~24 image, ~15 video model), AssetFlow'niki bitta markazlashgan ro'yxat. Umumiy g'oya bir xil — "model tanlovi → jobSetType/model-id → backend job", lekin Higgsfield narx-hisobini serverga ko'chirgan, AssetFlow esa client-tomonida imzolab serverda tekshiradi.

---

## 4. ⭐ Project-panel media auto-load (to'liq zanjir)

Bu zanjir ikki host uchun mavjud: **PPro** funksiyalari `_jsx_functions/` da, **AE** ekvivalentlari minified `jsx/index.js` da. JS tomon (React) bir xil — host nomi `getAdobeHostAppId()` (`csi.getApplicationID()`) orqali aniqlanadi, lekin chaqiriladigan ExtendScript funksiya nomlari ikkala hostda **bir xil** (`getLiveLinkReference`, `getActiveTimelineClipDetails`, `exportSourceRangeToTempFile`, `importMediaFromPath`), faqat ichki implementatsiya farq qiladi. Bu Higgsfield'ning "Live-Link" konsepti: panel host'da **tanlangan/playhead ostidagi** media'ni avtomatik o'qib, generatsiyaga reference qiladi.

### (a) Panel host TANLOVINI qanday biladi
JS → host ko'prigi `evalTS("funcName", ...args)` (`lib/utils/bolt.ts`): argumentlar `JSON.stringify` qilinadi, `csi.evalScript(...)` orqali namespacelangan global funksiya (`host["ai.higgsfield.cep"].funcName(...)`) chaqiriladi, natija `JSON.stringify(res)` bo'lib qaytadi, JS tomonda `JSON.parse`. Xato bo'lsa `e` obyekti qaytadi.

Markaziy entry — `getLiveLinkReference()`. U `app.isDocumentOpen()` ni tekshiradi, so'ng **uch manbani ketma-ket** sinaydi (birinchi non-null g'olib):
1. **Timeline selection** — tanlangan layer/clip.
2. **Project-panel selection** — Project panelda tanlangan footage.
3. **Timeline playhead** — playhead ostidagi layer/clip.

**AE tomon (`jsx/index.js`):**
- `getActiveComp()` → `app.project.activeItem`, agar `instanceof CompItem` bo'lsa qaytaradi.
- Timeline selection: `activeComp.selectedLayers` massivini aylanadi → har `layer.source` ni footage refga aylantiradi.
- Project-panel selection: `app.project.selection` (yoki `FolderItem` tekshiruvi `getSelectedProjectFolder` da), tanlangan `FootageItem`.
- Playhead: `activeComp.layer(i)` ni `1..numLayers` aylanadi, `layer.activeAtTime(activeComp.time)` bilan playhead ostidagilarni filterlaydi.
- Video-only variant (`getActiveTimelineVideoReference` ekvivalenti `getTimelineVideoLiveLinkReferenceFromComp`) avval selection, keyin playhead video layerni qaytaradi.

**PPro tomon (`_jsx_functions/`):**
- `getActiveTimelineVideoReference` → `app.project.activeSequence` → `getTimelineVideoLiveLinkReferenceFromSequence`.
- `getProjectPanelLiveLinkReference` → `app.getProjectViewIDs()` ni aylanadi, har view uchun `app.getProjectViewSelection(viewID)`, har tanlangan item uchun `getProjectItemLiveLinkReference(item, "project")`.
- `getActiveTimelineClipDetails` → `activeSequence` dan `findActiveTimelineVideoClip`, `clip.projectItem.getMediaPath()`, `clip.inPoint/outPoint`.

Har bir reference standart shaklda qaytadi: `{ name, mediaPath, source: "timeline"|"project", mediaType: "Video"|"Audio" }`.

### (b) Fayl yo'li / freym qanday olinadi
**Fayl yo'li (asosiy yo'l):**
- AE: `getMediaPathFromItem(item)` → `item instanceof FootageItem` bo'lsa `item.file || item.mainSource.file`, so'ng `sourceFile.fsName`. Ya'ni **diskdagi haqiqiy yo'l** olinadi — qayta yuklab olish/eksport YO'Q (agar footage diskda mavjud bo'lsa).
- PPro: `projectItem.getMediaPath()`.

**Trim/eksport (faqat timeline-da clip TRIMMED bo'lsa):**
JS `getActiveTimelineClipDetails()` ni chaqiradi; agar `isTrimmed === true` va `mediaType==="video"` bo'lsa, `renderTimelineClipToTempFile()` (`lib/utils/timeline-trim.ts`) → `evalTS("exportSourceRangeToTempFile", srcPath, inSec, outSec, presetPath, outputPath)`. Output yo'li `os.tmpdir()` da `higgsfield-trim-<base>-<inMs>-<outMs>.mp4`; agar allaqachon mavjud bo'lsa qayta render qilinmaydi (cache).

- **AE eksport (render queue)** `exportSourceRangeToTempFile`:
  1. `project.renderQueue.rendering` band bo'lsa rad etadi.
  2. `getTrimSourceItem` bilan source footage'ni topadi/import qiladi.
  3. **`suspendExistingRenderQueueItems(renderQueue)`** — barcha mavjud RQ item'larning `item.render` qiymatini saqlab, `false` ga o'rnatadi (foydalanuvchining navbatini buzmaslik uchun).
  4. `createTrimExportComp` — vaqtinchalik comp yaratadi (`project.items.addComp`, source o'lchami/fps/pixelAspect bilan), source layer `startTime = -inPoint`, `inPoint=0`, `outPoint=duration` (faqat trim oralig'i).
  5. `renderQueue.items.add(trimComp)`, `timeSpanStart=0`, `timeSpanDuration`, `render=true`.
  6. `configureTrimOutputModule` — `outputModule(1)`, `getH264OutputTemplate` (template ro'yxatidan "H.264" ni nom yoki substring bilan topadi), `applyTemplate`, `outputModule.file = new File(outputPath)`.
  7. `app.beginSuppressDialogs()` → `renderQueue.render()` → fayl mavjudligini tekshirish.
  8. **`finally`**: `endSuppressDialogs(false)`, RQ item'ni o'chiradi, trim comp'ni o'chiradi, import qilingan vaqtinchalik source'ni o'chiradi, va **`restoreRenderQueueItems`** bilan saqlangan `render` flag'larni tiklaydi.
- **PPro eksport** ekvivalenti `createNewSequenceFromClips` + `setInPoint/setOutPoint` + `exportSequence.exportAsMediaDirect(outputPath, presetPath, workAreaInToOut=1)`, oxirida `app.project.activeSequence` ni tiklaydi.

### (c) Media UI'ga + API'ga qanday uzatiladi
1. Host'dan kelgan reference (`mediaPath`) `createLiveLinkReferenceCandidate` orqali UI "reference asset" ga aylanadi (slotlarga joylanadi).
2. **Preview** uchun: kichik fayllar (`< REFERENCE_PREVIEW_MAX_BYTES`) `getLocalFileDataUrl` bilan `fs.readFileSync` → `data:<mime>;base64,...` ko'rinishida UI'da ko'rsatiladi; video uchun `URL.createObjectURL(Blob)`. **Bu faqat preview** — API'ga emas.
3. **Generatsiyaga yuborishda** (`uploadReferenceAssets` → `upload-reference-media.ts`): fayl yana `fs.readFileSync` → `new Uint8Array(buffer)` body sifatida. Oqim **base64 EMAS, balki signed-URL upload**:
   - `POST /creative-apps/uploads?type=...` (yoki IP-check kerak bo'lsa `POST /media/batch` / `POST /video`) → `{ upload_url }` qaytadi.
   - `PUT upload_url` (R2/S3-style presigned) bilan binar body yuklanadi.
   - `POST .../confirm` (yoki `/media/{id}/upload`, `/video/{id}/upload`) — IP/NSFW check.
   - Natija `{ id, type: "media_input"|"video_input"|"audio_input", url }`. Generatsiya jobiga **`media.id` + `media.type`** uzatiladi (`getUploadedReferenceData`), ya'ni **`image_url`/inline base64 emas — yuklangan media `id`**. (base64 data-URL faqat lokal preview uchun ishlatiladi.)

### (d) EVENT-driven mi yoki ON-DEMAND mi
**Ikkalasi ham, lekin asosan POLLING:**
- **Live-Link auto-load = poll.** `image.tsx` `useEffect` ichida `isLiveLinkEnabled` bo'lsa `window.setInterval(syncLiveLinkReference, 1000)` — **har 1 soniyada** `getLiveLinkReference` chaqiradi. Agar yangi `reference.mediaPath` oldingidan farq qilsa (`liveLinkMediaPathRef`), reference asset slotga avtomatik qo'shiladi. AE event tinglash YO'Q — bu pollingdir.
- **On-demand:** drag-and-drop paytida `captureHostDropReference` / `getHostDropReferenceCandidates` — host'dan drop boshlanganda bir marta o'qiydi (trim ham shu yerda baholanadi).
- Yagona haqiqiy event listener — `bg-sync.tsx`: `subscribeBackgroundColor` → `csi.addEventListener("com.adobe.csxs.events.ThemeColorChanged", ...)`. Bu faqat panel fon rangini host temasiga moslaydi, media bilan aloqasi yo'q.

### (e) ⭐ ISHLATILGAN ANIQ AE SCRIPTING API'LAR (qayta ishlatamiz)
- `app.project` / `app.project.activeItem` — joriy faol comp/item.
- `activeItem instanceof CompItem` — faol element comp ekanini tekshirish.
- `app.project.selection` — Project panelda tanlangan itemlar massivi.
- `comp.selectedLayers` — timeline'da tanlangan layerlar.
- `comp.layer(i)` / `comp.numLayers` — layerlar bo'ylab iteratsiya.
- `layer.activeAtTime(comp.time)` — layer playhead vaqtida ko'rinadimi (playhead detection).
- `layer.source` — layerning footage manbai.
- `item instanceof FootageItem` / `FolderItem` / `CompItem` — item turini ajratish.
- `footage.file` / `footage.mainSource.file` → `.fsName` — diskdagi mutlaq yo'l.
- `item.hasVideo` / `item.hasAudio` — media turini aniqlash.
- `new ImportOptions(new File(path))` + `canImportAs(ImportAsType.FOOTAGE)` + `importAs` — import sozlamasi.
- `app.project.importFile(importOptions)` — footage import.
- `comp.layers.add(item[, duration])` + `layer.startTime/inPoint/outPoint` — comp'ga layer qo'shish.
- `layer.replaceSource(item, false)` — tanlangan layer manbasini almashtirish.
- `project.items.addComp(name, w, h, pixelAspect, duration, frameRate)` — yangi comp.
- `project.items.addFolder(name)` / `project.rootFolder` / `item.parentFolder` — folder boshqaruvi (Higgsfield bin).
- `project.renderQueue` / `.rendering` / `.items.add(comp)` / `.render()` — render queue.
- `rqItem.timeSpanStart/timeSpanDuration/render` + `rqItem.outputModule(1)` + `outputModule.templates/applyTemplate/file` — RQ item + output module (H.264 trim eksport).
- `app.beginSuppressDialogs()` / `app.endSuppressDialogs(false)` — render paytida dialog bostirish.
- `app.beginUndoGroup(name)` / `app.endUndoGroup()` — import/o'zgarishlarni bitta undo bloki qilish.
- `layer.setTrackMatte(maskLayer, TrackMatteType.LUMA)` (yoki fallback `layer.trackMatteType`) — track matte.
- `comp.openInViewer()` — natija compni ochish.

---

## 5. Natija import (AE/Premiere)

Generatsiya tugagach (`job.status === "completed"`), natija URL'i (`result_url` yoki rasm uchun `min_result_url`) host'ga **fayl sifatida** import qilinadi. Tugma ("Import") yoki host'ga drag-drop orqali ishga tushadi (`use-job-media-import.ts`).

**1. URL → disk (cache).** `image-import.ts` → `prepareJobMediaImportFile(job)`:
- `getJobMediaImportSourceUrl` URL'ni tanlaydi (video → `result_url`; rasm → `result_url ?? min_result_url`).
- `cacheMediaToDisk`: cache yo'li `~/Downloads/Higgsfield/<jobId>-<sha1(url)[:10]><ext>`. Agar mavjud bo'lsa qayta yuklamaydi. Aks holda `fetch(url)` → `arrayBuffer` → `fs.writeFileSync`.
- **Extension aniqlash:** URL pathname'dan (`.mp4/.mov/.png/.jpg...`), yoki `content-type`/buffer headeridan. Video default `.mp4`, rasm default `.png`.
- **SVG maxsus holat:** PPro'da SVG import qilinmagani uchun `<canvas>` orqali PNG'ga rasterizatsiya qilinadi (`rasterizeSvgToPngBuffer`, max 4096px); AE'da SVG o'zича qoladi.
- Promise'lar `mediaFilePathPromisesByKey` da deduplicatsiya qilinadi (bir media ikki marta yuklanmaydi).

**2. Disk → host.** `useJobMediaImport.importToHiggsfieldBin()` → `evalTS("importMediaFromPath", mediaFilePath, "higgsfieldBin")`. Drag uchun esa CEP native drag: `dataTransfer.setData("com.adobe.cep.dnd.file.0", filePath)` (+ `text/plain`), host clipni o'zi qabul qiladi.

**3. AE import (`importMediaFromPath`, minified host):**
- `app.beginUndoGroup("Import Higgsfield media")` ichida.
- `importFootageFromPath(path)` → `new ImportOptions(File)`, `canImportAs(ImportAsType.FOOTAGE)` → `app.project.importFile(opts)`.
- `destination` argumentiga qarab dispatcher:
  - `"higgsfieldBin"` → `moveItemToHiggsfieldFolder`: root'da "Higgsfield" nomli folderni topadi yoki `project.items.addFolder("Higgsfield")`, `item.parentFolder` ni unga o'rnatadi.
  - `"selectedFolder"` → `moveItemToSelectedFolder` (`project.selection` dagi `FolderItem`).
  - `"activeSequence"` → `addItemToActiveComp`: `getActiveComp().layers.add(item)`, `layer.startTime = comp.time` (playhead'da).
  - `"replaceSelectedLayer"` → `replaceSelectedLayerSource`: tanlangan, `replaceSource` metodiga ega layerga `layer.replaceSource(item, false)`.
- `app.endUndoGroup()` (finally).

**4. PPro import (`_jsx_functions/importMediaFromPath`):**
- `app.project.importFiles([path], true, targetBin, false)`, so'ng `getImportedProjectItem(path)` bilan topiladi.
- `destination === "activeSequence"` bo'lsa `validateActiveSequenceForInsertion` (sequence + ≥1 video track) → `insertProjectItemAtPlayhead`: `activeSequence.videoTracks[0]`, `getPlayerPosition().ticks` da `insertClip`, muvaffaqiyatsiz bo'lsa `overwriteClip` fallback.
- Folder helperlari: `moveItemToHiggsfieldFolder` (PPro bin), `moveItemToSelectedFolder`.

**5. Remove-BG (track matte) — eng murakkab oqim:**
JS `isRemoveBackgroundMaskJob(job)` (job_set_type `sam_3_video`) bo'lsa, `prepareRemoveBackgroundMaskImportFiles` ikki video tayyorlaydi: **source** (`result_url` yoki ichki job'dan `jobDetails` orqali) va **mask** (`params.mask.url`).

- **AE (`importRemoveBackgroundMaskFromPath`):** ikkala footage'ni import → Higgsfield folderga → `getOrCreateRemoveBackgroundComp` (faol comp bor bo'lsa o'sha, yo'q bo'lsa source o'lchamida yangi "<name> Matte" comp) → `addRemoveBackgroundMaskToComp`: source va mask layerlarni qo'shadi, `applyLumaTrackMatte` → `sourceLayer.setTrackMatte(maskLayer, TrackMatteType.LUMA)` (fallback `trackMatteType = LUMA`), layerlarni "Remove BG"/"Alpha Mask" deb nomlaydi → `comp.openInViewer()`.
- **AE `nestMatteCompIntoActiveComp(matteComp)`:** agar boshqa faol comp bo'lsa, matte comp'ni unga `activeComp.layers.add(matteComp)` bilan nestlaydi, `layer.startTime = activeComp.time`.
- **PPro (`importRemoveBackgroundMaskAsNestedSequence` / `...FromPath`):** ikki rejim — (1) **drop ustida** (`existingClipOnly`): timeline'da source clip topilsa (`findUnmaskedSourceClip`), ustiga V2 track yaratib mask'ni qo'yadi (`insertProjectItemOnVideoTrack`), `copyMotionProperties` bilan transform'ni ko'chiradi, `applyTrackMatteKey` (Track Matte Key effekti) qo'llaydi. (2) **auto**: source+mask'ni alohida **nested sequence** ga yig'adi (`createNewSequenceFromClips`, ichida V1/V2 + Track Matte Key), keyin nested sequence'ni timeline'ga playhead'da yoki drop qilingan clip o'rniga qo'yadi (`removeTrackItemAndLinked` + `insertProjectItemOnVideoTrack`).

**6. Analytics:** har import/drag `trackAnalyticsEvent(MediaImported / MediaImportFailed / MediaDragStarted)` bilan `destination`, `job_set_type`, `media_type`, `trigger: "button"|"drag"` bilan loglanadi.

**Tegishli fayllar (absolute):**
- `/tmp/hf-analysis/_jsx_functions/` — barcha PPro host funksiyalari (yuqorida nomlangan).
- `/Library/Application Support/Adobe/CEP/extensions/ai.higgsfield.cep/jsx/index.js` (qatorlar ~1500–2664) — AE host implementatsiyasi (live-link, trim render-queue eksport, import, remove-BG track matte).
- `/tmp/hf-analysis/src/js/lib/utils/bolt.ts` — `evalTS`/`evalES` ko'prigi.
- `/tmp/hf-analysis/src/js/lib/utils/timeline-trim.ts` — trim eksport JS o'rami.
- `/tmp/hf-analysis/src/js/lib/creative-apps/utils/image-import.ts` — URL→disk cache + remove-BG fayl tayyorlash.
- `/tmp/hf-analysis/src/js/lib/creative-apps/hooks/use-job-media-import.ts` — import/drag holat mashinasi.
- `/tmp/hf-analysis/src/js/lib/creative-apps/api/upload-reference-media.ts` — reference signed-URL upload + IP/NSFW check.
- `/tmp/hf-analysis/src/js/main/routes/image.tsx` (~970, 1430–1570, 3709–3767, 6071–6134) — Live-Link 1s polling, reference→upload, trim-on-drop integratsiyasi.

---

## 6. Context-actions (media yuklangач)

**Ikki xil "harakat" konteksti bor — qanday ko'rsatilishi joyiga bog'liq:**

**A) Bosh ekran "Start App" kartalari** (`image.tsx`, `START_APP_ITEMS`, ~722–810). Statik massiv: har element `id` (`draw-to-video` / `edit-video` / `reframe-video` / `upscale-video` / `cinema-studio`), `to` (route, masalan `/reframe`, `/upscale`), `Icon`, `description`, `isNew`. Ular `shouldShowStartAppItem()` orqali filtrlanadi (faqat Cinema Studio flagга qarab ko'rinish/yashirinish hal qilinadi), so'ng `StartAppCard` bilan render. Karta darajasида GrowthBook flaglari ishlatiladi: `useIsDrawToVideoEnabled()` va `useIsEditVideoEnabled()` `false` bo'lsa — karta o'chiriladi (`isDisabled`) va "Soon" rozetka chiqadi (NEW o'rniga). Ya'ni feature flag harakatni butunlay olib tashlamaydi, balki disable + "Soon" qiladi.

**B) Media tanlangач "Edit Action Pills"** (`edit.tsx`, `EditActionPills` ~3764–3807). Bu — videoni edit ekraniga olgandan keyingi asosiy context-action UI. Faqat `videoAsset !== undefined && activeAction === null` bo'lganda ko'rinadi (~3678). To'rt pill: **Draw to video**, **Reframe**, **Remove BG**, **Upscale**. Ularning har biri `onClick` orqali `onActiveActionChange("reframe"|"upscale"|...)` chaqirib state'ni `activeAction`ga o'rnatadi, so'ng "Action Sheet" ochiladi. Draw-to-video pill `isDrawToVideoEnabled` flagга bog'langan: `false` bo'lsa `disabled` + "Soon" badge. Boshqa uchtasi har doim ko'rinadi.

**Harakat turi `EditAction = "reframe" | "remove-bg" | "upscale"` tipi bilan boshqariladi.** Reframe va Upscale uchun maxsus route'lar mavjud (`ReframeRoute`/`UpscaleRoute` — `EditRoute`ни `initialAction` bilan o'raydi). Route state orqali ham harakat uzatilishi mumkin: `getRouteRequestedAction()` route state'dan `requestedAction`ни o'qib validatsiya qiladi.

**Media turига qarab filtrlash:** bu edit oqimi to'liq **video-markazli** (barcha pill'lar `videoAsset` borligini talab qiladi; `isVideoPath()` helperi mavjud). Rasm vs video ajratish `use-create-job.ts` ichidagi `getJobMediaType()` da ham bor: `videoModelConfigs`da bo'lsa "video", `modelConfigs`da bo'lsa "image", aks holda `reframe`/`sam_3_video`/`topaz_video`/`kling3_0_motion_control` "video" deb belgilanadi. AssetFlow uchun analogiya — media turiga qarab ruxsat etilgan harakatlar ro'yxatini cheklash; HF buni model katalogining qaysi guruhda turishi bilan, alohida statik massiv emas, hal qiladi.

**Ulanish:** har harakat o'z payload-quruvchisi orqali API'ga ketadi (maydon nomlari naqshi, qiymatsiz):
- Reframe → `createReframeParams()` → `{aspect_ratio, medias:[{role:"video", data}]}`, `jobSetType:"reframe"` → `create-reframe-job.ts` (`/creative-apps/chain/reframe`, `client_meta.source` bilan).
- Remove BG → `{prompt, apply_mask:false, medias:[...]}`.
- Upscale → `createUpscaleParams()` → `{input_video, resolution, frame_interpolation:null, folder_id:null}`, `jobSetType:"topaz_video"` (alohida cost-endpoint `/topaz-video/cost`).
- Draw to video → avval video va sketch alohida `uploadReferenceMedia` bilan yuklanadi, so'ng `createDrawToVideoJob()` → `{prompt, video:{id,type:"video_input"}, sketch:{id,type:"media_input"}, timestamp, folder_id}` → `/creative-apps/chain/draw-to-video`.

Cost-estimate ham harakat turига qarab yo'naltiriladi: `estimate-job-cost.ts`да `draw_to_video`/`reframe` → `/chain/cost` (`chain_type` bilan), `topaz_video` → `/topaz-video/cost`, qolganlar → `/jobs/cost`.

## 7. Prompt bar va kontrollar

**State butunlay komponent ichidagi React `useState` (store/RHF yo'q).** Asosiy generator state'i (`image.tsx` ~3439):
- `prompt` (`useState("")`) — textarea matni.
- `activeModelId` — tanlangan model; haqiqiy `selectedModelId` `configsByJobType`да mavjudligi tekshirilib, yo'q bo'lsa birinchi modelга tushadi.
- `settingsByModelId` — `Record<modelId, Record<key,string>>`: har model uchun alohida aspect/quality/duration tanlovlari saqlanadi (model almashganда yo'qolmaydi).
- `referenceAssets`, `isUploadingReferences`, `viewMode` va h.k.

**Kontrollar (aspect ratio / duration / resolution / quality) hardcode emas — model JSON-schema'sidan generatsiya qilinadi.** `getPromptSettingControls(config, settings)` model `config.schema.properties`ни aylanib, `prompt`dan boshqa har bir kalit uchun: variantlar (`getSettingOptions` — enum qiymatlari + label'lar), joriy qiymat (`getSettingValue` — saqlangan tanlov yoki schema `default` yoki birinchi variant)ни qaytaradi. Faqat 2+ variantli kalitlargina ko'rsatiladi. Render: prompt bar pastidagi qatorга model `PromptSettingSelect` + har bir setting uchun bitta `PromptSettingSelect` (aspect_ratio, duration, quality kabilarга maxsus ikona/uslub beriladi — `getPromptSettingIcon`/`getPromptSettingClassName`). O'zgartirish `handleSettingChange()` orqali `settingsByModelId`ga yoziladi (+ analytics `SettingsChanged`). Dimension lug'ati (`utils/dimensions.ts`) aspect_ratio×quality (720p/1080p) → konkret width/height map qiladi (fallback 1024×1024).

**Payload qurish (maydon nomlari naqshi):** form-data → model `resolvePayload()`. `getDefaultFormData(config, prompt)` schema `default`larini yig'adi (aspect_ratio yo'q bo'lsa `DEFAULT_ASPECT_RATIO` qo'yiladi), `getPromptSettingsFormData()` foydalanuvchi tanlovlarini ustiga qo'yadi, so'ng `activeConfig.resolvePayload(formData)` modelга xos yakuniy payload chiqaradi. Yuborish bir xil konvert ichида: `{job_set_type, params}` (`create-job.ts` → `POST /creative-apps/jobs`; `reframe` esa alohida route'ga qayta yo'naltiriladi). Reference media bo'lsa, avval yuklanadi va `applyReferenceMediaPayload()` slot'larга map qiladi. `model`, `aspect_ratio`, `duration`, `input_images`/`medias`/`input_image` kabi maydonlar analytics'да o'qiladi (`getJobAnalyticsProperties`).

**Cost-estimate oqimi → tugma narx tooltip:** `costQueryParams` = `{jobSetType, params: getCostEstimateParams(config, settings)}`. `getCostEstimateParams` xuddi generatsiya kabi form-data quradi (lekin `COST_ESTIMATE_PROMPT` plate-holder bilan), `resolveCostEstimatePayload ?? resolvePayload` chaqiradi va `seed`ни o'chiradi. `useJobCost(costQueryParams)` (react-query, `enabled` faqat auth+jobSetType bo'lganда, `retry:false`) → `estimateJobCost` → `{credits, credits_exact}`. Natija `formatCredits(data.credits)` orqali `creditCostText`ga aylanadi (yuklanayotганда `"--"`), va `SendButtonWithCostTooltip`ning tooltip popup'iдa AI-token ikonasi bilan ko'rsatiladi. Settings o'zgarsa params o'zgarib, narx avtomatik qayta hisoblanadi.

**"Send" tugma (disable shartlari):** `canSubmit` =
`activeConfig` mavjud **&&** `prompt.trim().length > 0` **&&** `!createJobMutation.isPending` **&&** `!isUploadingReferences` **&&** `referenceIpCheckBlocker === null` **&&** `seedanceAttachmentDurationError === null`.
Bu `SendButtonWithCostTooltip`га `isSubmitBlocked={!canSubmit}` sifatida uzatiladi; bloklanганда tugma `opacity-45`/`cursor-not-allowed`, `onClick` `preventDefault` qiladi (lekin u `type="submit"`, ya'ni forma submit'i blokda to'xtaydi). `isPending`да spinner. Yuborish `handleGenerate()` (Enter, Shift'siz — `onSubmit`) — plan-cheklov tekshiruvi (`isSeedanceStandardBlockedForPlan` → upgrade toast), IP-check, attachment duration validatsiyalari ham bor.

**Muhim farq AssetFlow'dan:** HF'da "Send"да balans (`useBalance`) bilan cost'ni solishtirish **yo'q** — balans faqat header'да ko'rsatiladi (`balanceLabel`), yetarsizlikни server qaytaradi (`422 → ValidationError`, yoki `GenerationFailed` toast). AssetFlow esa imzolangan `cost-quote` → atomik kredit yechish → refund oqimini ishlatadi; HF cost-estimate'ni faqat tooltip ko'rsatuvchi (advisory) sifatida ishlatadi, atomik blok server tomonда.

**AssetFlow composer bilan o'xshashlik (qisqa):** ikkalasi ham prompt + model picker + aspect/quality/duration tanlovi + cost-quote ko'rsatadigan bitta pastki composer barга ega. HF kontrollarни model JSON-schema'sidan dinamik generatsiya qiladi (AssetFlow `gen-models.ts` statik katalogiga nisbatan moslashuvchanroq); cost-estimate ikkalasiga ham bor, lekin AssetFlow kreditни client-flow'да imzolab atomik yechadi, HF esa server-side enforcement'ga tayanadi.

---

## 8. Auth va history (umumiy, secret'siz)

**Auth oqimi (OAuth 2.0 Authorization Code + PKCE, browser redirect):**
- Login `login()` orqali boshlanadi (`auth.ts`). Mexanizm — **PKCE bilan OAuth Authorization Code**: `crypto.randomBytes(48)` dan `code_verifier`, undan SHA-256 → base64url `code_challenge` (`code_challenge_method=S256`). CSRF himoyasi uchun `crypto.randomBytes(16)` dan `state` generatsiya qilinadi va callback'da qat'iy solishtiriladi (mos kelmasa "CSRF" xatosi).
- **Browser redirect + lokal callback server:** plagin `127.0.0.1` da Node `http` server ko'taradi (port pool `45239–45248` ichidan birinchi bo'shini tanlaydi — pool Clerk allowlist'iga moslangan, ya'ni IdP — **Clerk**). Auth URL brauzerda ochiladi (`openLinkInBrowser`), foydalanuvchi login qilgach IdP `http://localhost:<port>/callback?code=...&state=...` ga qaytaradi. Server `code`/`state`/`error` ni o'qiydi, muvaffaqiyat/xato HTML sahifa qaytaradi va `focusApp()` bilan Adobe ilovasini old planga oladi (macOS'da `osascript`, Windows'da `powershell AppActivate`). Login uchun timeout 5 daqiqa; bir vaqtda faqat bitta aktiv server/login (`activeLoginPromise`, `closeActiveServer`).
- **Token almashinuvi:** `code` + `code_verifier` token endpoint'ga `application/x-www-form-urlencoded` POST bilan yuboriladi (`grant_type=authorization_code`). Javobdan `access_token`, `id_token`, `refresh_token`, `expires_in`, `scope` olinadi; `expiresAt = Date.now() + expires_in*1000` hisoblanadi. Scope: `email offline_access openid profile` (offline_access → refresh token).
- **Token saqlash (storage):** birламchи — **diskdagi fayl**: `os.homedir()/.higgsfield-auth-<appId>.json` (`fs.writeFileSync`, JSON). Agar `fs` bo'lmasa (CEP'siz/preview muhit) **fallback `localStorage`** kaliti `hf_auth_token`. Ya'ni token CEP secure storage emas, oddiy uy-katalogidagi plain-text JSON faylda turadi (ahamiyatli: bu xavfsizlik nuqtai nazaridan diqqatga sazovor — fayl shifrlanmagan).
- **Token yangilash:** `getValidAccessToken()` token muddatini `sessionBufferMs=30s` zaxira bilan tekshiradi; muddati o'tgan bo'lsa va `refresh_token` bo'lsa `grant_type=refresh_token` bilan jim yangilaydi va qayta saqlaydi; muvaffaqiyatsiz bo'lsa `clearToken()` (faylни va localStorage'ni o'chiradi). Logout — `clearToken()` + Amplitude/Sentry user reset.
- **Token qanday yuboriladi:** API chaqiruvlarida `Authorization: Bearer <token>` header naqshi (qiymat keltirilmadi). Diqqat: ko'p endpointlar (`jobs`, `balance`, `user`, `workspaces`) `token.idToken` ni yuboradi (hooks'da `token?.idToken`), faqat OAuth `userinfo` chaqiruvi `accessToken` ishlatadi — ya'ni backend uchun **id_token** asosiy identifikator.
- **AuthProvider** (`auth-provider.tsx`): React Context orqali `token/isAuthenticated/isLoggingIn/isInitializing/error` va `login/logout/getValidToken` beradi; mount'da saqlangan tokenni yuklab, kerak bo'lsa refresh qiladi. `VITE_AUTH_BYPASS==="true"` bo'lsa soxta `preview-access-token` bilan auth'ni butunlay aylanib o'tadigan **preview bypass** rejimi bor (faqat dev/preview uchun).

**History (job ro'yxati):**
- `useJobList(type)` — `@tanstack/react-query` **`useInfiniteQuery`** bilan cursor-paginatsiya (`next_cursor`, sahifa hajmi 20). `type` = `image | video | text`.
- **Polling adaptiv:** ro'yxatda ishlayotgan (pending) job bo'lsa `refetchInterval=3000ms`, aks holda `30000ms`; `staleTime=10s`. Pending aniqlash `isPendingJob` orqali.
- **Job holatlari:** `waiting | queued | in_progress | completed | failed | nsfw | canceled`. Bitta job detali `useJobDetail(jobId)` — pending statuslar (`waiting/queued/in_progress`) uchun har `2000ms` poll qiladi, terminal holatda polling to'xtaydi (`false`). Natija `result_url` / `min_result_url` maydonlaridan ko'rsatiladi.
- **Balance** alohida `useBalance` — har `60s` refetch (`credits`, `subscription_plan_type`).

## 9. API naqshi (secret'siz)

- **Base URL:** `VITE_API_BASE_URL` env'dan (`creative-apps/api/config.ts`), domen REDAKT. Barcha yo'llar `<base>/creative-apps/...` prefiksi ostida.
- **Endpoint strukturasi (yo'l shakllari):**
  - `POST /creative-apps/jobs` — job yaratish (body: `{ job_set_type, params }`), javob — `string[]` (job ID'lar massivi, bir so'rovda bir necha job).
  - `GET /creative-apps/jobs?type=&size=&cursor=` — history (cursor paginatsiya, `{ items, next_cursor }`).
  - `GET /creative-apps/jobs/{id}` — bitta job detali (status/result_url).
  - `GET /creative-apps/balance` — `{ email, credits, subscription_plan_type }`.
  - `GET /creative-apps/user` — `{ plan_type }`.
  - `GET /creative-apps/workspaces`, `POST /creative-apps/workspaces/select` (body `{ workspace_id }`).
  - Grep'da ko'ringan qo'shimchalar: `/jobs/cost` (narx estimatsiya), `/chain/cost|draw|reframe`, `/jobs/topaz`, `/kling`, `/uploads` (referens media yuklash).
  - OAuth `userinfo` endpoint'i alohida IdP domenida (API base emas).
- **ASYNC oqim (create → poll):** `createJob()` → server `job_id[]` qaytaradi → frontend har bir id uchun `GET /jobs/{id}` ni react-query bilan **poll** qiladi (2s interval), `completed`/`failed` kabi terminal holatga yetguncha. Webhook **yo'q** — sof client-side polling. Reframe kabi maxsus turlar alohida funksiyaga (`createReframeJob`, `/chain/reframe`) yo'naltiriladi.
- **Xato modeli (`api-errors.ts`):**
  - `422` → `ValidationError` (FastAPI uslubidagi `detail[].msg` massividan xabarlar yig'iladi, dublikatlar olib tashlanadi).
  - `409` + `detail.error_type === "workspace_selection_required"` → maxsus `WorkspaceSelectionRequiredError` (ichida tanlanadigan `workspaces` ro'yxati) — UI workspace tanlash modalini ko'rsatadi.
  - Umumiy xato xabari `detail` (string yoki `{text|message|error}`), yoki top-level `message`/`error` dan ajratib olinadi (`readApiErrorMessage`); aks holda `"... failed: <status>"` fallback. Backend **FastAPI** uslubli (`detail` konvensiyasi).
- **Workspaces / multi-tenant:** foydalanuvchi bir nechta workspace'ga (`private`/`shared`, rol `owner/admin/member`, har birida alohida `plan_type` va `credits`) tegishli bo'lishi mumkin. Aktiv workspace `is_selected` bilan belgilanadi; agar tanlanmagan bo'lsa server `409` qaytaradi va frontend `select` chaqiruvi bilan kontekst o'rnatadi. Ya'ni kreditlar va plan **workspace darajasida** (per-tenant).
- **React Query infratuzilmasi:** global `queryClient` minimal default konfiguratsiya bilan; har resurs uchun `queryOptions`/`infiniteQueryOptions` fabrikalar (`job-list`, `job-detail`, `balance`, `user`, `workspaces`), queryKey'ga `idToken` kiritilgan (token o'zgarsa kesh izolyatsiyalanadi).

**AssetFlow API bilan o'xshashlik (qisqa):** Higgsfield naqshi AssetFlow Studio Gen oqimiga juda yaqin — ikkalasi ham async **create-job → job_id → poll job-details** modelidan foydalanadi va `Authorization: Bearer <token>` header bilan ishlaydi. AssetFlow'da plugin tokeni (`/api/plugin/login`) + `POST /api/studio/gen` (signed `cost-quote` → atomik kredit yechish → muvaffaqiyatsizlikda refund) → `GET /gen/:jobId` poll, va kredit balansi `/api/studio/credits` orqali; Higgsfield'da esa narx `/jobs/cost`, balans `/creative-apps/balance`, kredit **workspace darajasida**. Asosiy farqlar: (1) Higgsfield real OAuth/PKCE + Clerk IdP va browser-redirect ishlatadi, AssetFlow esa o'z email/parol plugin-login tokeni; (2) Higgsfield'da multi-tenant **workspace** tushunchasi va `409 workspace_selection_required` modeli bor, AssetFlow'da bu yo'q (bitta plugin profil/kredit); (3) Higgsfield polling adaptiv (pending 2–3s, idle 30–60s) react-query bilan, AssetFlow ham `/gen/:jobId` poll qiladi. Kredit-himoya: AssetFlow signed cost-quote + refund naqshini ishlatadi, Higgsfield narxni `/jobs/cost`/`/chain/cost` orqali oldindan estimatsiya qiladi.

---

## 10. AssetFlow'ga qanday moslaymiz

### MAP — har Higgsfield naqsh → bizning adaptatsiya (1:1 EMAS)

| Higgsfield naqsh | Bizда hozir nima bor | Moslash (nima quramiz / o'zgartiramiz) |
|---|---|---|
| **Launcher / routing** — React HashRouter + `/video,/generate,/edit,/reframe…`, render-bloklovchi gate'lar | Bitta statik `AssetFlow_Plugin.html` (7690 qator), tab-toggle `nav` + `af_ai.*` global state, router/gate yo'q | Router QURMAYMIZ. Mavjud "AI Tools" tab ichida **launcher home** view (Apps grid + so'nggi generatsiyalar) + **tool view** (preview + context-chips + composer) o'rtasida DOM-toggle qo'shamiz (`mfWirePane`/`mfPaneGen` naqshi allaqachon bor — uni "tool" tanlovchi sifatida kengaytiramiz). "Back" = `navigate("/video")` o'rniga `af_ai.tool=null` + qayta render. Tasdiqlangan mockup aynan shu ikki-view modelini ko'rsatadi. |
| **Model config** — fayl-per-model + Vite glob, RJSF schema, narx serverда | `gen-models.ts` — bitta markazlashgan `GEN_MODELS[]` massiv, har modelда `inputs/aspects/resolutions/durations/count` + `magnificTool` + `computeGenCost` (narx CLIENT-da imzolanadi) | KO'CHIRMAYMIZ glob/RJSF'ga. Bizning markaziy massiv yetarli va xavfsizroq (kredit client-flow). Faqat **launcher "Apps" grid'ini `GEN_MODELS` dan generatsiya** qilamiz (HF `START_APP_ITEMS` o'rniga modeldan derive): primary 2 (Image/Video Generate), qolgani context-tool sifatida. `magnificOnly`/`enabled:false` → "Tez orada"/"Soon" badge (HF GrowthBook-disable naqshi → bizда oddiy flag). |
| **Prompt + controls** — composer model JSON-schema'дан dinamik, settings-per-model | Bizда composer kontrol-metadata `gen-models.ts` (aspects/resolutions/durations/count) da; `af_ai` state | Mockup composer (`promptbar` + `ctrls`) allaqachon bu maydonlardan o'qiydi. HF'даги **`settingsByModelId`** (model almashganда tanlov saqlanadi) naqshini `af_ai` ga qo'shamiz — hozir bitta global tanlov. Send-disable shartlari (prompt bo'sh / upload davom etmoqda) HF `canSubmit` bilan bir xil. |
| **Cost** — `/jobs/cost` advisory tooltip, atomik blok serverда | Imzolangan `cost-quote → atomik consume → refund` (`gen-processor.ts`, `computeGenCost`) — KUCHLIROQ | TEGMAYMIZ. HF'дан faqat **cost-tooltip UX** (send tugmasi yonida narx ko'rsatish) olamiz. Bizning imzolangan-quote oqimi ustun — `cost-quote` endpoint allaqachon bor, faqat UI tooltipга ulaymiz. |
| **⭐ Project-panel auto-load** | `aiPickRef('project'/'timeline')` + host.jsx `getSelectedProjectReference`/`getActiveTimelineVideoReference` BOR (ON-DEMAND, manba fayl yo'lini qaytaradi) | HF'нинг 1s polling **Live-Link** yo'q. Mavjud on-demand'ni **auto-load** ga aylantiramiz (pastda qadamli reja). Trim-export render-queue YO'Q — birinchi bosqichда to'liq fayl yo'lini ishlatamiz (oddiyroq, xavfsizroq). |
| **Natija import** — URL→tmp→`importMediaFromPath` + bin/activeSequence/replaceLayer destination'lar | `aiImportMedia` → tmp → `importMediaFromPath` BOR; host.jsx import + aktiv compга layer qo'shadi (playhead'ga) | Asosiy oqim TAYYOR. HF'дан **destination tanlovi** (bin / aktiv comp / replace-selected-layer) qo'shamiz — hozir faqat "aktiv comp bo'lsa qo'sh" mantiqи bor. `replaceSource` host.jsx'дa hali YO'Q → qo'shsa bo'ladi (ixtiyoriy). |
| **Auth / history** — OAuth/PKCE + Clerk + multi-workspace, react-query infinite history | Plugin token (`/api/plugin/login`), bitta profil/kredit, `GET /gen/history` poll | TEGMAYMIZ. OAuth/workspace KERAK EMAS (bizning model — email/parol plugin token, bitta kredit-hisob). HF'дан faqat **history-strip UX** (launcher'даги "so'nggi generatsiyalar" lentasi) olamiz — `GET /gen/history` allaqachon bor. |
| **API async/poll** — create→job_id→poll, adaptiv interval | `POST /gen → genId → GET /gen/:jobId` poll; `gen-processor` background + reconcile | Bir xil model — TEGMAYMIZ. |

### ⭐ PROJECT-PANEL AUTO-LOAD — bizга aniq nima kerak (qadamli reja)

Grep natijasi: **host.jsx'да asosi BOR** — `getSelectedProjectReference()` (`app.project.selection` + `FootageItem` + `file.fsName`), `getActiveTimelineVideoReference()` (`activeItem instanceof CompItem` + `selectedLayers` + `afLayerSourcePath`), import tomonда `importMediaFromPath` (`new ImportOptions(File)` → `canImportAs(FOOTAGE)` → `importFile` → aktiv compга `layers.add` + `startTime=time`). Front: `aiFetchRef(src)` evalScript IIFE ko'prigi (`$.evalFile(host.jsx); return fn()`). YO'Q: `getProjectViewIDs` (bu faqat **PPro** — biz AE, kerak emas), trim render-queue eksport (`exportSourceRangeToTempFile`), 1s polling, `replaceSource`.

Qadamlar:
1. **Auto-load trigger (event yo'q — poll).** HF AE'да event tinglamaydi, `setInterval(1000)` ishlatadi. Biz ham: tool-view ochilганда `setInterval` bilan **mavjud** `getSelectedProjectReference`/`getActiveTimelineVideoReference` ni 1s'да chaqiramiz; `mediaPath` o'zgарса (oxirgisini `af_ai.liveLinkPath` da saqlab) reference slotга avtomatik biriktiramiz. Tool-view yopilganда `clearInterval`. **Yangi host funksiya shart emas** — mavjudlari yetarli.
2. **Birlashtirilgan entry (ixtiyoriy).** HF'нинг `getLiveLinkReference()` (timeline→project→playhead ketma-ketlik) naqshini host.jsx'да yangi funksiya sifatida qo'shsak bo'ladi: avval `selectedLayers`, keyin `app.project.selection`, keyin `layer.activeAtTime(comp.time)` (playhead) — barchаси allaqachon ishlatadigan API'lar (`activeItem`, `selectedLayers`, `project.selection`, `mainSource.file.fsName`). Bu ON-DEMAND `aiPickRef` ni ham boyitadi.
3. **Preview.** Kichik fayl uchun `cep.fs.readFile` → data-URL (HF `getLocalFileDataUrl` naqshi) bilan mockup'даги `.preview` blokига ko'rsatamiz. Faqat preview — backendга data-URI YUBORMAYMIZ.
4. **Trim — keyinга.** HF render-queue trim-eksporti (`addComp` + `renderQueue.add/render` + H.264 template + `suspendExistingRenderQueueItems`) MURAKKAB va render-navbatга tegadi. MVP'да butun fayl yo'lini yuboramiz; trim faqat keyinги iteratsiya.

### BACKEND moslik (reference upload → magnific.ts + gen-processor)

HF reference'ni **signed-URL upload → `media.id`** sifatida yuboradi. Bizда boshqacha, lekin allaqachon mos:
- Front auto-load faqat **fayl yo'lini** oladi → kichik bo'lsa data-URI sifatida `params.referenceUrl` ga qo'yiladi (mavjud oqim).
- `gen-processor.materializeRefUrl()` data-URI'ни R2'ga yuklab **signed URL** beradi (video/Veo/Kling tashqaridан oladi) — HF'нинг signed-URL upload bilan funksional ekvivalent.
- `magnific.ts`: `magnificImageEdit` reference'ni `style_reference` (base64) sifatida, `magnificTool` manba rasmni `image`/`video` (base64) sifatida yuboradi — `getReferenceMode` router (`image-edit`/`video-ref`) allaqachon to'g'ri marshrutlaydi.
- **Remove-BG saboq (muhim):** `magnificRemoveBg` PUBLIC URL (so'rov-satrисiz, `.png` bilan tugaydigan `getPublicOrSignedUrl`) talab qiladi — presigned `X-Amz-*` URL Magnific downloaderини adashtiradi. Auto-load orqali kelган har qanday yangi tool (HF "Remove BG" context-chip) shu public-URL yo'lини ishlatishi shart, signed EMAS. Bu allaqachon `gen-processor`да kodlangan — yangi tool qo'shganда buni qaytarmaslik kerak.

### Tasdiqlangan mockup'ga ishora (`higgsfield-style-ai-tools.html`)

Mockup uch view'да HF naqshларини allaqachon ko'rsatadi: **Scene 1** launcher (hero + so'nggi-generatsiyalar strip + Apps grid, primary 2 model), **Scene 2** auto-load (`srcnote` "Project paneldan tanlandi" + preview + context-chips + composer), **Scene 3** context-actions (natija tayyor → 6 rasm-tool chip). Ya'ni launcher↔tool toggle, auto-load banner, context-chips, composer-controls — **dizayn tayyor**. Hали kodда YO'Q: (a) launcher/tool DOM-toggle, (b) 1s auto-load polling, (c) per-model settings saqlash, (d) cost-tooltip ulanishи, (e) destination-picker import. Mockup ataylab "1:1 EMAS" deb belgilangan — yashil aksent, o'zbekcha, mavjud nav saqlanган.

### RISK / EHTIYOT (qisqa ro'yxat)

- **20 guard hook (bayt-ba-bayt):** yangi kod guard-token funksiyaларiга (audit #4 — `/gen/describe`, `/gen/enhance` kredit/cap himoyasi) TEGMASIN. Bundle-bayt invariant buzilmasin.
- **Kredit / paywall / auth:** imzolangан `cost-quote → atomik consume → refund` oqimи o'zgarmasin. Auto-load faqat UI/reference — kredit yo'lига tegmaydi. Free/Pro gate va `magnificOnly`/`enabled:false` bloklari saqlanсин (kredit yechilmaydigan 400 yo'li).
- **pgvector / embedding:** Workers AI `bge-m3` semantik qidiruv qatlami TEGILMAYDI (`gen-processor`да embedding yo'q — alohida `ai.ts`).
- **ExtendScript AE-only:** HF tahlilидаги `getProjectViewIDs`, `exportAsMediaDirect`, Track-Matte-Key, nested-sequence — bularning hammаси **PPro**. Biz FAQAT AE: `app.project.activeItem`/`selectedLayers`/`project.selection`/`importFile`/`layers.add`/`replaceSource` ishlatamiz. PPro yo'llарини nusxa olmaslik.
- **TIMEOUT ≠ refund sentinel:** `MAGNIFIC_TIMEOUT` (job hали IN_PROGRESS) refund qilmaydi — reconcile (10 daq) hal qiladi. Yangi tool qo'shганда bu sentinel mantiqи buzilmasin.

**Tegishli fayllar (absolute):**
- `/Users/usmonov/Projects/creative-tools-saas/plugins/after-effects-cep/jsx/host.jsx` — `getSelectedProjectReference` (~1963), `getActiveTimelineVideoReference` (~1913), `importMediaFromPath` (1834), `afLayerSourcePath` (~1898). Auto-load polling + birlashtirilган live-link funksiyа shu yerга qo'shiladi.
- `/Users/usmonov/Projects/creative-tools-saas/plugins/after-effects-cep/AssetFlow_Plugin.html` — `aiFetchRef`/`aiAttachRef` (5283/5304), `aiImportMedia` (6521), `mfWirePane`/`mfPaneGen` (4946/4954). Launcher↔tool toggle, 1s polling, cost-tooltip shu yerда.
- `/Users/usmonov/Projects/creative-tools-saas/apps/api/src/lib/gen-models.ts` — Apps grid'ни derive qiladigan manba katalog.
- `/Users/usmonov/Projects/creative-tools-saas/apps/api/src/lib/gen-processor.ts` — `materializeRefUrl` (55), remove-bg public-URL yo'li (225-238).
- `/Users/usmonov/Projects/creative-tools-saas/apps/api/src/lib/ai/magnific.ts` — `magnificImageEdit`/`magnificTool`/`magnificRemoveBg` reference formatlari.
- `/Users/usmonov/Projects/creative-tools-saas/design-preview/higgsfield-style-ai-tools.html` — tasdiqlangan 3-view mockup (launcher / auto-load / context-actions).

---

## 11. ⭐ Tool → Endpoint → Model jadvali ("tool = UX, model = API" — kod bilan tasdiqlandi)

**VERDIKT: GIPOTEZA TASDIQLANDI.** Kod dalili:
- `createJob(idToken, jobSetType, params)` (`api/create-job.ts`) — **BITTA generic endpoint** `POST /creative-apps/jobs`, tanasi `{ job_set_type, params }`. `model` faqat `params` ichidagi maydon. Yagona istisno — ko'p-bosqichli "chain" toollar: `reframe` → `/chain/reframe`, `draw-to-video` → `/chain/draw-to-video`.
- `getJobMediaType(jobSetType)` (`use-create-job.ts`) media turini (image/video) faqat jobSetType qaysi registr (modelConfigs/videoModelConfigs)da borligidan aniqlaydi — bu **UI mantiqi**, API marshruti emas.
- Client'dagi model "katalogi" — faqat **LABEL + RJSF SCHEMA** (`config/models/*.ts` fayl nomi = `job_set_type`; `model-display-names.ts` = dropdown matni). Hech qanday model-LOGIKA yoki provayder-SDK client'da YO'Q.

**Client qayerga boradi? → FAQAT Higgsfield'ning O'Z backend'iga.** Bundle'ga bake bo'lgan (build-time Vite) hostlar — barchasi `*.higgsfield.ai`: `fnf.higgsfield.ai` (API base = `VITE_API_BASE_URL`; "FNF" prefiksi `model-display-names.ts` kodida ham), `clerk.higgsfield.ai` (OAuth/Clerk), `hf-adobe-updates.higgsfield.ai` (updater), `cms/static.higgsfield.ai` (kontent). **fal.ai / Replicate / OpenAI / Google / Stability — client'da MUTLAQO YO'Q** (grep: 0 natija; `creative-apps`da qattiq-kodlangan tashqi POST yo'q). Ya'ni **model bozori 100% SERVER-DA** — client `job_set_type` + `params` yuboradi, backend (fnf) haqiqiy provayderni o'zi tanlaydi/chaqiradi. Reference media ham backend bergan presigned `upload_url` ga PUT qilinadi → keyin `{id, type}` job'ga uzatiladi (bu ham 3rd-party emas).

### Tool → Endpoint (asosiy parametrlar)

| Tool (UX) | HTTP | Endpoint | `job_set_type` / asosiy params |
|---|---|---|---|
| **Image Generate** | POST | `/creative-apps/jobs` | `job_set_type=<image model id>` · `{prompt, model?, aspect_ratio, resolution/quality, input_image(s)?}` |
| **Video Generate** | POST | `/creative-apps/jobs` | `job_set_type=<video model id>` · `{prompt, model?, aspect_ratio, duration, medias?(start/end frame)}` |
| **Remove BG** | POST | `/creative-apps/jobs` | `job_set_type="sam_3_video"` · `{prompt, apply_mask, medias:[video]}` |
| **Upscale (video)** | POST | `/creative-apps/jobs` | `job_set_type="topaz_video"` · `{input_video, resolution, frame_interpolation, folder_id}` |
| **Kling Motion Control** | POST | `/creative-apps/jobs` | `job_set_type="kling3_0_motion_control"` · presetlar ← `GET /creative-apps/kling-motion-control/presets` |
| **Cinema Studio** (image/video) | POST | `/creative-apps/jobs` | `job_set_type="cinematic_studio_*"` (image/2_5/soul_cast/soul_location/video/video_3_5) |
| **Reframe** | POST | `/creative-apps/chain/reframe` | `{params:{aspect_ratio, medias:[video]}, client_meta}` (jobSetType `"reframe"`) |
| **Draw to Video** | POST | `/creative-apps/chain/draw-to-video` | `{params:{prompt, video:{id,type:video_input}, sketch:{id,type:media_input}, timestamp, folder_id}, client_meta:{feature:draw_to_video}}` |
| *Job poll* | GET | `/creative-apps/jobs/{id}` | 2s interval; terminal: completed/failed/nsfw/canceled |
| *History* | GET | `/creative-apps/jobs?type=&cursor=` | cursor paginatsiya (infinite query) |
| *Cost (default)* | POST | `/creative-apps/jobs/cost` | `{job_set_type, params}` |
| *Cost (upscale)* | POST | `/creative-apps/jobs/topaz-video/cost` | `topaz_video` |
| *Cost (chain)* | POST | `/creative-apps/chain/cost` | `{chain_type: "draw_to_video"\|"reframe"}` |
| *Reference upload* | POST→PUT | `/creative-apps/uploads` (+ `/media/batch`, `/video` IP-check) | backend `upload_url` → PUT binary → `{id, type}` |
| *Balance* | GET | `/creative-apps/balance` | `{credits, subscription_plan_type}` |

> ❗ Maxfiylik: yo'l-shakllari va model nomlari (yuqorida) maxfiy emas; `Authorization: Bearer <token>` **qiymati** va env-kalitlar bu hujjatga yozilmagan.

### Client model katalogi (dropdown label'lari: `job_set_type` → ko'rinadigan nom)

**Image (24 model):** `nano_banana` "Nano Banana" · `nano_banana_2` "Nano Banana Pro" · `nano_banana_flash` "Nano Banana 2" · `flux_2` "FLUX.2 Pro" · `flux_kontext` "Flux Kontext Max" · `seedream_v4_5` "Seedream 4.5" · `seedream_v5_lite` "Seedream 5.0 lite" · `recraft_v4_1` "Recraft V4.1" · `grok_image` "Grok Imagine" · `kling_omni_image` "Kling O1" · `wan2_2_image` "WAN 2.2" · `z_image` "Z-Image" · `text2image_gpt` "GPT Image" · `text2image_soul_v2` "Higgsfield Soul 2.0" · `openai_hazel` "GPT Image 1.5" · `openai_hazel_mini` "GPT Image 1.5 Mini" · `imagegen_2_0` "GPT Image 2" · `image_auto` "Auto" · `cinematic_studio_image` "Cinematic Cameras" · `cinematic_studio_2_5` "Cinema Studio Image 2.5" · `cinematic_studio_soul_cast` "AI Cast" · `cinematic_studio_soul_location` "Cinematic Locations" · `soul_cinema_studio` "Soul Cinema" · `soul_cinematic`/`soul_location`.

**Video (15 model):** `seedance_2_0` "Seedance 2.0" · `seedance_2_0_fast` "Seedance 2.0 Fast" · `kling2_6` "Kling 2.6" · `kling3_0` "Kling 3.0" · `kling3_0_turbo` "Kling 3.0 Turbo" · `veo3_1` "Google Veo 3.1" · `veo3_1_lite` "Veo 3.1 Lite" · `minimax_hailuo` "Minimax Hailuo" · `grok_video` "Grok Imagine" · `wan2_6` "Wan 2.6" · `wan2_7` "Wan 2.7" · `marketing_studio_video` "Marketing Studio" · `cinematic_studio_video`/`_v2`/`_3_5` "Cinema Studio Video (3.5)".

**Ikki qatlamli model:** (1) `job_set_type` = asosiy model (yuqoridagi ro'yxat), (2) `params.model` = SUB-variant (`veo-3-1-fast`/`veo-3-1-preview`, `seedance_2_0_fast`, `minimax-2.3`/`-fast` — `FNF_MODEL_DISPLAY_NAMES_BY_MODEL_ID`da). Ikkisi ham faqat label/param; API marshruti BIR XIL (`/creative-apps/jobs`).

### AssetFlow uchun saboq

Bu naqsh bizning arxitekturani **tasdiqlaydi**: AssetFlow'da ham `job_set_type` analogi = `gen-models.ts` model `id`; bitta `POST /api/studio/gen` barcha modellar uchun; model faqat katalog yozuvi (haqiqiy provayder serverda — `magnific.ts`/`openrouter`). "tool=UX, model=API" — bizning "AI Tools tab → tool chip → `modelId` → `/gen`" bilan **bir xil falsafa**. Asosiy farq: HF chain-toollar (reframe/draw-to-video) uchun alohida `/chain/*` endpoint ishlatadi; bizda esa hammasi `magnificTool` slug orqali bitta `/gen` dan o'tadi (soddaroq, yaxshiroq). Demak launcher Apps grid'ini shu naqsh bo'yicha quramiz: **tool (UX guruh) → bitta yoki bir nechta model (`modelId`) → bitta gen endpoint** — UI guruhlaydi, backend marshrutlaydi.

---

## Xulosa (1 paragraf)

Higgsfield — bizning kelajakdagi AE plagin yo'nalishimiz uchun deyarli ideal referens: **yagona React
panel** + **Bolt-CEP tiplangan ko'prik** orqali host operatsiyalari, **TanStack Query** bilan server-state,
va **generatsiyadan oldin cost-estimate**. Lekin biz uni **1:1 ko'chirmaymiz** — bizning arxitekturamiz
ayrim joylarda **kuchliroq** (imzolangan `cost-quote → atomik kredit → refund`) va **soddaroq** (bitta
plugin-token, OAuth/workspace yo'q; faqat AE — Premiere yo'llarini olmaymiz). Eng qimmatli o'zlashtiriladigan
naqshlar: **(1)** launcher↔tool ikki-view toggle, **(2)** ⭐ project-panel **auto-load** (1s polling —
mavjud `getSelectedProjectReference`/`getActiveTimelineVideoReference` host funksiyalari ustida, **yangi jsx
shart emas**), **(3)** per-model settings saqlash, **(4)** cost-tooltip UX, **(5)** import destination-picker.
Batafsil reja va risklar — §10.

*Tahlil bosqichi tugadi. Implement qilinmadi. Keyingi qadam: §10 rejasini tasdiqlash → komponent-komponent qurish.*
