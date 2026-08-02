# Premiere Pro UXP plagin — Direktor auditi (2026-08-02)

> **Maqsad:** FrameFlow'ni Premiere Pro ichiga UXP plagin sifatida olib kirish yo'lini
> har tomonlama baholash: texnik reallik, kodbaza tayyorligi, risklar, hisob-kitob.
> **Metod:** kod tahlili (jonli grep/read) + Adobe rasmiy hujjatlari (AdobeDocs/uxp-premiere-pro
> repo, 2026-avgust holati) + jonli production API tekshiruvi. Taxmin YO'Q — har muhim
> da'vo manba bilan.
>
> Juft hujjat: **`docs/PREMIERE-UXP-SYSTEM-PROMPT.md`** — implementatsiya uchun Claude Code
> system prompti (shu audit xulosalari asosida).

---

## 0. Xulosa (TL;DR)

**Verdikt: YASHIL — UXP plagin qilish mumkin va to'g'ri tanlov.** Barcha kritik API'lar
mavjud va tekshirildi: `.mogrt`ni to'g'ridan-to'g'ri timeline'ga qo'yish
(`SequenceEditor.insertMogrtFromPath`), media import (`Project.importFiles`), kadr eksporti
(`Exporter.exportSequenceFrame` — AI ref uchun), `<video>` preview, WebSocket/fetch/streaming,
secureStorage. CEP'dagi eng katta texnik xavf (client-side unzip) bizga umuman kerak emas —
server allaqachon pack ichidan har `.mogrt`ni alohida ajratib saqlaydi (selective download).

**Eng katta 3 risk (texnik emas!):**

| # | Risk | Holat |
|---|------|-------|
| 1 | **Bo'sh katalog** — productionda `app=pr` shablonlar soni: **0** (jonli tekshirildi) | Plagin mukammal bo'lsa ham o'lik tug'iladi. Kontent-sprint MAJBURIY (launch'gacha ≥100 pr shablon) |
| 2 | **UI qayta qurish** — UXP'da CSS Grid/transform/animation/box-shadow YO'Q; 18k-satrli AE paneli 1:1 ko'chmaydi | UI qayta yoziladi (logika modullari ko'chadi); baho ~4-5 hafta UI+import |
| 3 | **Windows QA** — Premiere auditoriyasining ko'pchiligi Windows; bizning test infra mac-og'ir | QA matritsaga Windows majburiy kiradi |

**Minimal versiya:** Premiere Pro 25.6+ (UXP rasmiy reliz), real target 26.x (2026 standart).
**Distributsiya:** `.ccx` (imzo KERAK EMAS — ZXP'dan farqli), o'z saytimizdan + keyin CC Marketplace
(ikkita ALOHIDA plugin ID bilan — pastda §8.3).
**MVP hajmi:** ~5–7 hafta (1 dasturchi ekvivalenti), fazalar §9.

---

## 1. Manbalar (tekshirilgan)

- Kod: `apps/api/src/lib/apps.ts`, `mogrt-extract.ts`, `ingest-zip.ts`, `catalog-map.ts`,
  `plugin-release-contract.ts`, `apps/api/src/routes/plugin.ts`, `contributor.ts`,
  `plugins/after-effects-cep/*` (manifest, katalog, zip, host.jsx).
- Adobe rasmiy: `github.com/AdobeDocs/uxp-premiere-pro` (classes/*, changelog, manifest,
  recipes: network/filesystem/external-process/css), `AdobeDocs/uxp-premiere-pro-samples`
  (premiere-api, metadata-handler, oauth-workflow-sample).
- developer.adobe.com/premiere-pro/uxp — reference; blog.developer.adobe.com (2026-04:
  UXP Hybrid Premiere 26.2); hyperbrew.co "UXP Plugins in Premiere 2026" (CEP migratsiya).
- Jonli: `GET https://api.getframeflow.app/api/plugin/catalog?app=pr` → `{"items":[]}`.

---

## 2. Joriy kodbaza: nima TAYYOR, nima YO'Q

### 2.1 Backend — ~80% tayyor (bu kutilmagan yaxshi yangilik)

| Qism | Holat | Dalil |
|------|-------|-------|
| Ko'p-dastur konfiguratsiyasi | ✅ TAYYOR | `apps.ts`: `pr = { packExts: [".mogrt", ".prproj"] }` kanonik |
| Katalog `?app=pr` filtri | ✅ TAYYOR | `plugin.ts:251-254` — single/CSV `templateApp` predikati; AE plagin `?app=ae` yuboradi, klient zaxira filtri ham bor (`AssetFlow_Plugin.html:6537`) |
| DB | ✅ TAYYOR | `templateApp @default("ae")` + `ct_pub_rev_app_upd_idx` indeks |
| Ingest: app avto-aniqlash | ✅ TAYYOR | `contributor.ts:1749` — pack kengaytmasidan (`.mogrt`→pr) |
| **Mogrt selective saqlash** | ✅ TAYYOR | `mogrt-extract.ts` — zip ichidan HAR `.mogrt`ni alohida chiqarib R2/GCS'ga saqlaydi + `definition.json` nom + thumb.png/mp4. **Plagin klient tomonda zip ochmaydi** — bu eng katta texnik soddalashtirish |
| Auth (email + Google device-code) | ✅ TAYYOR | `POST /api/plugin/login`; device-code oqimi AE CEP uchun qurilgan — app-agnostik |
| Kredit / AI / gen endpointlar | ✅ TAYYOR | `/api/studio/*` app-agnostik; `Exporter.exportSequenceFrame` bilan "joriy kadr → AI ref" Premiere'da ham ishlaydi |
| Reliz kontrakti | 🟡 KENGAYTIRISH | `plugin-release-contract.ts` — platforma installer (.pkg/.exe/.msi) + SHA-256. Premiere uchun yangi artefakt turi `.ccx` + `app=pr` reliz kanali kerak |
| Analytics | 🟡 KENGAYTIRISH | download-events/plugin-analytics'da app o'lchovi yo'q (AE implicit) |

### 2.2 AE CEP paneli — logika ko'chadi, UI ko'chmaydi

| Qism | UXP'ga ko'chishi | Sabab |
|------|------------------|-------|
| `AssetFlow_Plugin.html` (18 033 satr monolit) | ❌ 1:1 ko'chmaydi | CSS Grid/animation/transform/box-shadow UXP'da yo'q (§4.3); CSInterface/Node chaqiriqlar |
| `assetflow-catalog.js` (1 713) | 🟡 ~70% | fetch-asosli, lekin disk-bridge/CEP bog'lamlari ajratiladi |
| `assetflow-zip.js` (295, sof Node fs/zlib) | ❌ KERAK EMAS | Selective mogrt download zip ochishni bekor qiladi (§5.2) |
| `jsx/host.jsx` (3 223, ExtendScript) | ❌ | O'rniga `require('premierepro')` DOM (async) |
| `assetflow-env.js`, client, log, storage-api | ✅ ~80% | Sof JS; `localStorage`→UXP storage adapteri |
| CSS tokenlar (noir + lime) | 🟡 qiymatlar ko'chadi | Ammo UXP subset'ida qayta yoziladi (flex-only, soya/gradientsiz) |
| Auth oqimlari (device-code, prefs) | ✅ server tayyor | `shell.openExternal` bilan brauzer ochish |

### 2.3 Rejalardagi bo'shliq

`docs/KONTENT-QUVURI-SXEMA.md` §11: «Premiere / DaVinci — hozircha katalog + yuklab olish…
**Premiere native plagin — qachon va qanday** (ochiq savol)». Ushbu audit o'sha savolga javob.

---

## 3. Premiere UXP — versiya xronologiyasi (Adobe changelog, tekshirilgan)

| Versiya | Sana | Voqea |
|---------|------|-------|
| 25.2 | 2024-12-04 | UXP birinchi ommaviy **beta** |
| 25.6 | 2025 o'rtasi | **UXP rasmiy relizi** ("approaching parity with CEP/ExtendScript"); distribution hujjatlari |
| 26.0 | 2025 kuz | Premiere 2026 — UXP **standart relizda** |
| 26.2 | 2026-04 | **UXP Hybrid** (C++ `.uxpaddon`) qo'llab-quvvatlash |
| 26.3 | 2026 | **Breaking:** `Sequence.setSelection` endi sinxron; `create*Action` MAJBURIY `project.lockedAccess()` ichida; `@adobe/eslint-plugin-premierepro` chiqdi |

**CEP taqdiri:** CEP hali ishlaydi, Adobe "yana bir necha yil" deydi, rasmiy o'lim sanasi
e'lon qilinmagan (HyperBrew tahlili ham shuni tasdiqlaydi). Lekin yo'nalish aniq — yangi
qurilish UXP'da bo'lishi kerak.

**Dev talablar:** UDT (UXP Developer Tool) 2.2+, Premiere'da `Settings → Plugins →
Enable developer mode`, manifest v5.

---

## 4. Texnik imkoniyatlar matritsasi (bizga kerakli har funksiya)

### 4.1 Host API (`require('premierepro')`) — hammasi async, Promise qaytaradi

| Bizga kerak | UXP API | Holat |
|-------------|---------|-------|
| .mogrt'ni timeline'ga qo'yish | `SequenceEditor.insertMogrtFromPath(path, time, vTrack, aTrack)` | ✅ BOR |
| .mogrt'ni EG panelga o'rnatish | `SequenceEditor.getInstalledMogrtPath()` — lokal mogrt papka yo'li | ✅ BOR (papkaga fs bilan nusxa) |
| Media import (video/audio/rasm/AI gen) | `Project.importFiles(paths[], suppressUI, targetBin, asNumberedStills)` | ✅ BOR |
| .prproj'dan sequence import | `Project.importSequences(projPath, seqIds[])` | ✅ BOR (seqId ro'yxatini olish — spike'da tekshiriladi) |
| .aep comp import | `Project.importAEComps` / `importAllAEComps` | ✅ BOR (kutilmagan bonus) |
| Klipni timeline'ga qo'yish | `SequenceEditor.createInsertProjectItemAction` / `createOverwriteItemAction` (+ `lockedAccess`+`executeTransaction`) | ✅ BOR |
| Joriy kadr → AI ref | `Exporter.exportSequenceFrame(seq, time, name, dir, w, h)` — png/jpg/tif/… (25.6+) | ✅ BOR |
| Preview'ni Source Monitor'da ochish | `SourceMonitor.openFilePath(path)` | ✅ BOR |
| Playhead pozitsiyasi | `Sequence.getPlayerPosition/setPlayerPosition` | ✅ BOR |
| Bin yaratish / tanlov | `Project.getRootItem`, `FolderItem`, `ProjectUtils.getSelection` | ✅ BOR |
| Undo-to'g'ri amallar | `project.lockedAccess(() => executeTransaction(...))` — 26.3'dan MAJBURIY naqsh | ✅ BOR (qoida) |
| Loyiha hodisalari | EventManager, ProjectEvent, OperationCompleteEvent | ✅ BOR |
| AME render | EncoderManager (26.3: launchEncoder, startBatchEncode) | ✅ BOR (kelajak) |

**Timeline'ga drag&drop** — YO'Q (community so'rovda). Yechim: "Add to timeline" tugmasi
(AE panelimiz ham tugma-asosli — UX farqi minimal).

### 4.2 UXP runtime (panel muhiti)

| Bizga kerak | Holat | Izoh |
|-------------|-------|------|
| `fetch` / XHR / **WebSocket** | ✅ | Manifest `requiredPermissions.network.domains` allowlist (wildcard mumkin). Brauzer CORS YO'Q — R2/GCS CORS azoblari tugaydi |
| Streaming (ReadableStream) | ✅ | Katta pack'ni diskka oqim bilan yozish |
| `<video>` element | ✅ | src=https URL, play/pause/currentTime/preload/muted/seeked. Docs namunasi mp4/h264 — bizning preview formatimiz |
| `<img>` + lazy | ✅ | IntersectionObserver BOR |
| Fayl tizimi | ✅ | `localFileSystem` perm: `plugin` (sandbox `plugin-data:/` — **nativePath BOR**, ya'ni absolute yo'lni `insertMogrtFromPath`ga berish mumkin), `request`, `fullAccess`. `fs` posix-uslub moduli ham bor |
| Brauzer ochish (auth) | ✅ | `shell.openExternal` + `launchProcess` perm — device-code oqimi mos |
| Token saqlash | ✅ | `secureStorage` (key-value-storage) + localStorage |
| Tema | ✅ | `document.theme.getCurrent()` + `onUpdated` (Light/Dark/Darkest) |
| WebView | ✅ | `WebviewPermission` + `<webview src>` + postMessage bridge (§6 Variant B) |
| Clipboard, Blob/ImageBlob, crypto.getRandomValues | ✅ | — |
| Node.js (child_process, zlib, require npm) | ❌ | UXP'da Node YO'Q. Zip ochish kerak bo'lsa — sof JS (fflate vendor). Asosiy oqimda KERAK EMAS (§5.2) |
| FormData multipart upload | 🟡 spike | Bor bo'lishi kerak; bo'lmasa presigned PUT (loyihada allaqachon bor — 32MB ref oqimi) |
| @font-face (woff2 brend shriftlar) | 🟡 spike | UXP shrift qo'llab-quvvatlashi cheklangan; fallback — tizim shriftlari |

### 4.3 UI qatlami — ENG KATTA CHEKLOV (CSS subset)

Adobe hujjatlaridagi rasmiy ro'yxat (`reference-css/styles/`) bo'yicha:

**BOR:** flexbox (to'liq), block/inline-block, position top/left/right/bottom, margin/padding,
border (+radius), background (color/image/size), color/opacity/visibility, font-family/size/
style/weight, letter-spacing, text-align/overflow, white-space, overflow-x/y, width/height/
min/max, media queries (width/height/prefers-color-scheme), pseudo-class'lar (hover, focus,
nth-child…), CSS variables + calc().

**YO'Q (hujjatlashtirilmagan = yo'q deb hisobla):** `display: grid` (rasman: faqat
none/inline/block/inline-block/flex/inline-flex), `transform`, `transition`, `animation`,
`box-shadow`, `gap` (flex'da ham — margin bilan), `z-index`, `line-height`, `object-fit`,
`aspect-ratio`, gradientlar (spike'da tekshir), `backdrop-filter`, pseudo-element
`::before/::after`, `position: fixed/sticky`.

**Xulosa:** AE panelining vizual tili (soya, gradient, hover-transform, grid-masonry) UXP'da
qayta talqin qilinadi: **flat noir + lime**, flexbox ustun-qator, JS-boshqaruvli holatlar.
CLAUDE.md'dagi "CSS Grid ishlatilsin" qoidasi UXP kontekstida "flex-based row-order layout"
deb o'qiladi (row-first DOM tartibi saqlanadi — asl maqsad shu edi).

---

## 5. Arxitektura qarorlari

### 5.1 Panel arxitekturasi — 3 variant

| Variant | Tavsif | + | − | Verdikt |
|---------|--------|---|---|---------|
| **A. Sof UXP (vanilla)** | UI to'liq UXP HTML/CSS subset, logika modul JS | Eng barqaror; Adobe review'ga eng mos; offline-chidamli; loyiha konventsiyasiga mos (vanilla, build'siz) | UI qayta yoziladi | ✅ **TAVSIYA** |
| B. WebView thin-shell | Panel = `<webview>` ichida hosted web UI, UXP faqat ko'prik (postMessage: import, fs) | Web UI erkinligi (grid/animation), tez iteratsiya | Qo'shimcha runtime (Win'da WebView2), offline holati murakkab, review'da savollar, postMessage kechikish, CSP/CORS qaytadi | 🟡 B-plan (agar A'da UI unumdorligi yetmasa) |
| C. CEP port (Premiere CEP 12) | AE panelini HostList'ga PPRO qo'shib moslash | ~85% kod reuse, eng tez MVP | O'layotgan platforma; ZXP imzo; CCD o'rnatish yo'q; 1–2 yilda baribir UXP'ga ko'chish = ikki marta pul | ❌ rad (foydalanuvchi talabi ham UXP) |

### 5.2 Import oqimi — zip MUAMMOSI YO'Q (kutilmagan soddalik)

Eng katta texnik xavf deb kutilgani — klientda 700MB zip ochish (UXP'da Node/zlib yo'q).
**Kerak emas:** `mogrt-extract.ts` allaqachon ingest paytida pack zip ichidan har `.mogrt`ni
ALOHIDA fayl sifatida R2/GCS'ga saqlaydi (selective download AE oqimi uchun qurilgan).

**Asosiy oqim (MVP):**
1. Katalogda sahna/shablon tanlanadi → server presigned URL beradi (mavjud endpoint).
2. Plagin `.mogrt`ni `plugin-data:/downloads/`ga oqim bilan yozadi (streaming fetch).
3. `insertMogrtFromPath(nativePath, playhead, vTrack, aTrack)` — timeline'ga tushadi
   (yoki `getInstalledMogrtPath()` papkasiga nusxa — Essential Graphics panelida chiqadi;
   ikkalasini ham beramiz: "Add to timeline" / "Install to Essential Graphics").
4. `download-events` telemetriya (mavjud endpoint).

**To'liq pack (zip) oqimi:** panel ichida OCHILMAYDI — foydalanuvchi tanlagan papkaga
yuklab beriladi (`localFileSystem.getFolder` picker) + `shell.openPath` bilan ko'rsatiladi.
Foydalanuvchi Premiere'da o'zi ochadi (prproj'lar odatda baribir qo'lda ochiladi).
Sof-JS unzip (fflate) — faqat keyingi faza, kichik packlar uchun (<100MB gate bilan).

**.prproj oqimi:** `Project.importSequences` yoki `importFiles` — spike'da qaysi biri
prproj uchun to'g'ri ishlashini empirik tasdiqlash (spike ro'yxati §9 FAZA 0).

### 5.3 "Faqat Premiere shablonlari ko'rinadi" — qatlamlar

1. **Server:** katalog so'rovi `?app=pr` (mavjud filtr; `plugin.ts:251`).
2. **Klient zaxira:** AE panelidagi kabi `templateApp !== 'pr'` bo'lsa chiqarmaslik
   (AE'da `'ae'` uchun xuddi shu naqsh — `AssetFlow_Plugin.html:6537`).
3. **Legacy tuzoq:** `templateApp` default `"ae"` — eski/AE shablonlar pr katalogiga
   sizib O'TMAYDI (default ae bo'lgani uchun xavfsiz). LUTs/music/sfx kabi app-agnostik
   kontent turlari uchun esa QAROR kerak (§10 Q3): ular `templateApp="ae"` bilan yotibdi —
   pr katalogida ko'rsatish uchun server filtrga `luts/music/sfx → app-neutral` istisno
   qo'shiladi (aks holda pr plaginda LUT/musiqa bo'limi bo'm-bo'sh bo'ladi).

### 5.4 Reliz / yangilanish

- **Paket:** `.ccx` (oddiy zip; **imzo/timestamp KERAK EMAS** — ZXP'dan farq); CC Desktop
  ikki-klik o'rnatadi. UPIA/ExManCmd davri tugagan.
- **O'z kanalimiz:** mavjud `GET /api/plugin/version` kontraktiga `app=pr` kanali +
  `ccx` artefakt turi (SHA-256 + halol `installerStatus` naqshi aynan ko'chadi).
  Panel yangilanishni tekshiradi → download sahifa `shell.openExternal`.
- **CC Marketplace (keyin):** Adobe review (test-hisob berish MAJBURIY; brauzer-login
  abandoned holatni ushlashi shart; tashqi app ishga tushirish TAQIQ — faqat brauzer).
- **MUHIM tuzoq:** Marketplace va mustaqil kanal uchun **IKKITA ALOHIDA plugin ID**
  (Adobe rasmiy tavsiyasi): bitta ID bo'lsa, CCD mustaqil o'rnatishni "Marketplace'da
  sotib olinmagan" deb RAD ETADI. Build flavor tizimi (package-flavors.mjs naqshi) ikki
  ID'li ikki .ccx chiqaradi.

---

## 6. Foydalanuvchi o'ylamagan jihatlar (so'ralgan bo'lim)

1. **Bo'sh katalog = o'lik launch.** `app=pr` hozir 0 ta (jonli tasdiqlangan). Plagindan
   oldin KONTENT keladi: AE shablonlarning mogrt-eksport dasturi (AE'da EGP orqali .mogrt
   qilib qayta eksport — ko'p AE shablonlar mos), contributor'larga pr-call, admin bulk
   import. Maqsad: launch'da ≥100, ideal 300+.
2. **CSS Grid taqiqning teskarisi:** loyiha qoidasi "column-count taqiq, CSS Grid ishlat" —
   UXP'da Grid YO'Q. Yangi qoida: flex row-wrap + qo'lda 2-ustun balans (row-first DOM saqlanadi).
3. **`gap`, `box-shadow`, `transform`, `animation` yo'qligi** — brend "shisha-panel"
   estetikasi flat'ga tushadi; dizayn tokenlarini UXP-profilga ajratish kerak.
4. **26.3 breaking-naqsh:** har `create*Action` FAQAT `project.lockedAccess()` ichida —
   boshdan shu qoidada yozilmasa, 26.3'da sinadi. `@adobe/eslint-plugin-premierepro` ulash.
5. **Ikki plugin ID talabi** (Marketplace vs mustaqil) — §5.4. Buni bilmasdan bitta ID bilan
   chiqsak, keyin Marketplace'ga kirganda mustaqil foydalanuvchilarning o'rnatishlari sinadi.
6. **Windows birinchi navbatda:** Premiere bozori Windows-og'ir; hozirgi skriptlar
   (install-cep.sh) mac-sentrik. UXP+CCD buni yengillashtiradi (cross-platform .ccx),
   lekin QA/yo'l-ayirmalar (path separator, disk harfi) Windows'da sinovdan o'tishi shart.
   Yaxshi tomoni: `assetflow-zip.js` Windows darsini allaqachon o'rgangan (audit #2).
7. **Preview kodeklari:** `<video>` UXP'da tizim dekoderiga tayanadi — barcha previewlar
   H.264 MP4 bo'lishi standartlashtirilgan (transcode-preview.ts) — mos. HEVC/VP9 preview
   yubormaslik kerak.
8. **Bir vaqtda bitta video preview:** UXP Chromium emas — 20 ta `<video>` DOM'da og'ir.
   Naqsh: poster `<img>` + hover'da YAGONA faol video instansiya (AE paneldagi afVideoThumb
   intizomi saqlanadi).
9. **Panel dastlabki yuklanish UX:** UXP panel AE CEP'dan tezroq ochiladi (engil runtime) —
   lekin katalog birinchi so'rovi baribir tarmoq; skeleton + kesh (oxirgi katalog sahifasi
   localStorage'da) — offline'da halol "offline" holat.
10. **Auth brauzer-qaytish:** UXP panelga deep-link qaytish YO'Q (protokol handler
    ro'yxatdan o'tkazish imkoni cheklangan) — device-code polling oqimimiz (AE'da ishlab
    turgan) aynan to'g'ri naqsh; "abandoned login"ni Adobe review talab qiladi (bizda bor).
11. **LUT/Music/SFX app-agnostik savol** — §10 Q3 (aks holda pr katalog yarim-bo'sh).
12. **AI Studio'da "Add to Project"** Premiere'da YANADA kuchli: gen natija
    `importFiles`+`createInsertProjectItemAction` bilan to'g'ri timeline'ga tushadi
    (AE'da bunday to'g'ridan-to'g'ri emas edi). Bu marketing farqlovchi bo'ladi.
13. **exportSequenceFrame o'lchov erkinligi** (w/h param) — AI ref uchun keraklicha
    kichraytirib eksport = tezroq upload, kredit/limit foydasi.
14. **Beta-kanal drift:** Premiere Beta'da API'lar oldinroq/boshqacha — CI/QA faqat stable
    versiyaga qadalsin; beta faqat razvedka.
15. **Adobe trademark:** listing nomida "for Adobe Premiere Pro" qoidalari; brand asset
    ishlatish uchun 2 haftalik ruxsat jarayoni — launch jadvalga kiritish.
16. **Hybrid C++ (26.2+) hozircha KERAK EMAS** — lekin kelajakda lokal video prevyu
    dekodlash/watermark kabi og'ir ishlar uchun eshik ochiq (marketplace'da 3 arxitektura
    binari talab qilinadi: mac arm64/x64 + win x64).
17. **Bir akkaunt — ikki plagin:** sessiya/limit hisoblagichlar user-darajada; AE+PR
    parallel ochiq bo'lsa double-count bo'lmasligi uchun download/limit dedup'i server
    tomonda allaqachon user-key'da — OK. Lekin analytics'da `app` o'lchovisiz ikkalasi
    aralashadi (§7 A3).
18. **Free-tier suv belgisi va gating** aynan ko'chadi (server-side entitlement) — plagin
    hech qanday yangi pul-mantiq yozmaydi (pul zonasi TEGILMAYDI qoidasi kuchda).

---

## 7. Risklar registri

| ID | Risk | Ehtimol | Ta'sir | Mitigatsiya |
|----|------|---------|--------|-------------|
| R1 | Katalogda pr kontent yo'q | **Sodir bo'lgan** | Halokatli | Kontent-sprint launch gate: ≥100 shablon; AE→mogrt eksport dasturi |
| R2 | UXP CSS subset UI sifatini tushiradi | Yuqori | O'rta | UXP dizayn-profil (flat noir+lime); spike'da vizual prototip; B-plan WebView |
| R3 | `importSequences`/prproj xatti-harakati kutilmagan | O'rta | O'rta | FAZA 0 spike; MVP mogrt-first, prproj = "papkaga yuklab berish" fallback |
| R4 | 26.3+ breaking o'zgarishlar davom etadi | O'rta | O'rta | eslint-plugin-premierepro; changelog kuzatuvi; API wrapper qatlam (bitta joyda tuzatiladi) |
| R5 | Windows'da fayl-yo'l/FS farqlari | O'rta | O'rta | QA matritsada Win majburiy; nativePath faqat API'dan olinadi (qo'lda yasalmaydi) |
| R6 | Marketplace review rad (login/tashqi xizmat) | Past-o'rta | Past (o'z kanal bor) | Test-hisob, abandoned-login UX, faqat brauzer ochish; mustaqil kanal birinchi |
| R7 | @font-face ishlamasa brend shrift yo'q | O'rta | Past | Tizim shrift fallback stack; spike tekshiradi |
| R8 | `<video>` unumdorligi (ko'p karta) | O'rta | O'rta | Bitta faol video; IntersectionObserver; poster-first |
| R9 | FormData yo'q/xato | Past | Past | Presigned PUT allaqachon bor (32MB oqimi) |
| R10 | CEP↔UXP ikki panelni parallel boqish xarajati | — | — | Premiere uchun CEP QILINMAYDI (Variant C rad) — faqat AE'da CEP qoladi |

---

## 8. Biznes hisob-kitob

### 8.1 Nima uchun arziydi
- Premiere auditoriyasi AE'dan katta (video-montaj asosiy bozor); mogrt — sotib olinadigan
  eng ommabop shablon formati.
- Backend 80% tayyor: xarajatning katta qismi allaqachon to'langan (multi-app FAZA 5,
  mogrt-extract, auth, kredit, AI).
- UXP'da erta kirish = CEP raqobatchilar ko'chguncha pozitsiya (HyperBrew: "migration clock").

### 8.2 Xarajat (1 dasturchi ekvivalenti, taxmin)
| Faza | Ish | Baho |
|------|-----|------|
| 0 | Texnik spike (§9) | 3–5 kun |
| 1 | Skeleton+auth+reliz kanali | 1 hafta |
| 2 | Browse katalog UI | 1.5–2 hafta |
| 3 | Import quvuri | 1–1.5 hafta |
| 4 | QA (mac+win) + beta + polish | 1–2 hafta |
| — | **MVP jami** | **~5–7 hafta** |
| 5 | AI Studio port | +2–3 hafta (MVP'dan keyin) |
| — | Kontent-sprint (parallel, dev emas) | egasi/kontent jamoasi |

### 8.3 Distributsiya strategiyasi
1. **1-bosqich:** o'z sayt — `.ccx` yuklab olish (mustaqil ID), plugin ichida version-check.
   Narx: $0, nazorat to'liq, bugungi installer oqimiga o'xshash.
2. **2-bosqich:** CC Marketplace listing (ALOHIDA ID) — organik discovery. Review 1–3 hafta;
   plagin o'zi bepul (obuna saytda) — reviewga test-hisob.
3. Enterprise kanal (keyin, agar B2B so'rov kelsa).

### 8.4 Go/No-Go darvozalari
- **G0 (spike'dan keyin):** insertMogrtFromPath + importFiles + exportSequenceFrame + video
  element 25.6 va 26.x'da mac+win'da ishladi → davom. Aks holda Variant B/C qayta ko'rish.
- **G1 (launch oldidan):** katalogda ≥100 published pr shablon YO'Q bo'lsa — launch
  KECHIKTIRILADI (soft-beta'ga ruxsat).
- **G2 (marketplace oldidan):** mustaqil kanalda 2 hafta stabil + crash/error telemetriya toza.

---

## 9. Faza rejasi (batafsil DoD — system promptda)

- **FAZA 0 — Spike (3–5 kun):** UDT o'rnatish; hello-panel; EMPIRIK tekshirish:
  insertMogrtFromPath (turli fps/track), importFiles (mp4/png/mp3/prproj), importSequences,
  exportSequenceFrame, `<video>` https-mp4, @font-face, FormData, secureStorage, streaming
  fetch→fs, lockedAccess naqshi, panel min-size. Natija: `docs/PREMIERE-UXP-SPIKE-NATIJA.md`.
- **FAZA 1 — Skeleton:** `plugins/premiere-uxp/` vanilla struktura; manifest v5 (network
  domains, localFileSystem=plugin, launchProcess); auth (email+parol, Google device-code,
  secureStorage); tema moslash; version-check + `.ccx` build skript; API'ga `app=pr` reliz
  kanali.
- **FAZA 2 — Browse:** katalog `?app=pr` + kategoriya/qidiruv/filtr/sort/cursor-pagination;
  karta (poster+hover video, Pro badge, muallif); detal ko'rinish; empty/loading/error/offline;
  klaviatura navigatsiya; virtualizatsiya.
- **FAZA 3 — Import:** selective mogrt → playhead'ga insert / EG install; media import;
  to'liq pack → papkaga yuklab berish; progress+cancel; entitlement gate (server); telemetriya.
- **FAZA 4 — QA/Release:** QA matritsa (mac arm64/x64, win x64 × PPro 25.6/26.x); beta guruh;
  crash/log hisobot; docs; mustaqil kanal launch.
- **FAZA 5 — Keyin:** AI Studio port (composer subset → to'liq), Marketplace, Motion/Resolve
  savoli qayta ochiladi.

---

## 10. Ochiq qarorlar (EGA hal qiladi)

| # | Savol | Tavsiyam |
|---|-------|----------|
| Q1 | Minimal Premiere versiyasi: 25.6 yoki 26.0? | **25.6 minVersion**, lekin 26.3 naqshlarida kod (lockedAccess) |
| Q2 | MVP'da AI Studio kiradimi? | Yo'q — Browse+Import birinchi; AI FAZA 5 (lekin arxitektura tayyor tursin) |
| Q3 | LUT/Music/SFX pr katalogida ko'rinsinmi? | Ha — server filtrda app-neutral turlar istisnosi (kichik backend patch) |
| Q4 | Kontent-sprint egasi va jadval? | AE→mogrt eksport + contributor call — launch gate G1 |
| Q5 | Plagin nomi/ID | `com.frameflow.premiere` (mustaqil) + alohida Marketplace ID |
| Q6 | Obuna bitta (AE+PR birga)mi? | Ha — bitta FrameFlow obuna, app-limit ajratilmaydi (soddalik) |

---

## 11. Yakuniy so'z

Texnik yo'l OCHIQ va kutilganidan qulay (selective mogrt + tayyor multi-app backend).
Asosiy xavf kod emas — **kontent va UI-qayta-qurish intizomi**. Spike (FAZA 0) 3–5 kunda
barcha qolgan noaniqlikni yopadi. Implementatsiya uchun system prompt:
`docs/PREMIERE-UXP-SYSTEM-PROMPT.md`.
