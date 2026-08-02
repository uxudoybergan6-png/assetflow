# FAZA 0 — Premiere Pro UXP imkoniyat spike'i (natija)

**Sana:** 2026-08-02
**Host:** Adobe Premiere Pro **26.2.2 (Build 3)** · macOS 15 (Darwin 25.5.0)
**Spike plagin:** `plugins/premiere-uxp/spike/` (`com.frameflow.premiere.spike` v0.0.1, manifest v5)
**Xom hisobot:** [spike-report-raw.md](../plugins/premiere-uxp/spike/natija/spike-report-raw.md) — 43 probe, **43 OK, 0 FAIL, 0 SKIP**
**Test loyihasi:** `~/Documents/Adobe/Premiere Pro/26.0/FF-UXP-Spike.prproj` · ketma-ketlik "FF Spike Seq" (3 video trek)

---

## G0 verdikt: ✅ O'TDI — FAZA 1 ga o'tish mumkin

Rejadagi barcha kritik imkoniyatlar (auth · katalog · yuklab olish · `.mogrt` timeline'ga qo'yish · EG'ga
o'rnatish · media import) **jonli Premiere ichida tasdiqlandi**. Bloklovchi texnik to'siq topilmadi.
Ikkita **dizayn cheklovi** aniqlandi (CSS Grid yo'q, TextDecoder yo'q) — ikkalasi ham workaround bilan yopiladi.

Yagona qolgan launch riski **texnik emas, kontentga oid**: production `GET /api/plugin/catalog?app=pr`
hozir **0 element** qaytaradi. Bu FAZA 2 emas, kontent/moderatsiya vazifasi.

---

## 1. Muhit va o'rnatish

| # | Band | Natija | Tafsilot / workaround |
|---|------|--------|----------------------|
| 1.1 | UDT'siz dev o'rnatish | **ISHLADI** | Papkani `~/Library/Application Support/Adobe/UXP/Plugins/External/<id>_<ver>/` ga nusxalash + `PluginsInfo/v1/premierepro.json` ga `$localPlugins/External/...` yozuvi. Skript: `scripts/install-uxp-dev.mjs` |
| 1.2 | Registr qachon o'qiladi | **CHEKLOV** | Faqat **Premiere ishga tushganda**. Panelni yopib-ochish JS'ni qayta yuklamaydi → har iteratsiyada **to'liq restart shart**. Bu dev tsiklning eng qimmat qismi |
| 1.3 | Manifest ikonkalari | **ISHLADI** | Manifestda `"icons/ff23.png"`, diskda `ff23@1x.png` + `ff23@2x.png`. Generator: `scripts/make-icons.mjs` (tashqi kutubxonasiz PNG) |
| 1.4 | `manifestVersion: 5`, `host.minVersion 25.6.0` | **ISHLADI** | 26.2.2 da muammosiz yuklandi |
| 1.5 | `require('premierepro')` | **ISHLADI** | 61 ta top-level sinf: Project, Sequence, SequenceEditor, Exporter, TickTime, Utils, ProjectUtils, SequenceUtils, Metadata, Markers, EncoderManager, … |
| 1.6 | Node modullari | **YO'Q (kutilgan)** | `child_process`, `zlib`, npm — yo'q. `fs`, `os`, `path` — **bor**. → **`.zip`/`.mogrt` ochish serverda qolishi SHART** |

## 2. JS runtime globals

| Band | Natija | Tafsilot |
|------|--------|---------|
| Bor | **ISHLADI** | `fetch`, `WebSocket`, `IntersectionObserver`, `FormData`, `Blob`, `URL`, `URLSearchParams`, `AbortController`, `crypto`, `localStorage`, `requestAnimationFrame`, `ResizeObserver` |
| **Yo'q** | **ISHLAMADI** | `TextDecoder`, `TextEncoder`, `MutationObserver`, `structuredClone` |
| Workaround | — | Qo'lda `utf8Decode(Uint8Array)` (surrogat juftlar bilan) — spike'da yozildi, FAZA 1 da `lib/bytes.js` ga ko'chiriladi. `MutationObserver` o'rniga aniq re-render chaqiruvi |

## 3. CSS / layout — **eng muhim cheklov**

| Band | Natija | Tafsilot |
|------|--------|---------|
| Xossalarni **qabul qilish** | **ISHLADI** | `grid`, `gap`, `transform`, `transition`, `animation`, `box-shadow`, `z-index`, `object-fit`, `aspect-ratio`, `position:fixed\|sticky\|absolute`, `filter`, `backdrop-filter`, `text-overflow`, `letter-spacing` — hammasi read-back'da saqlanadi |
| **`display:flex` + `flex-wrap`** | **✅ ISHLAYDI** | 300px host, 4×100px bola → o'lchandi `0,0 \| 100,0 \| 200,0 \| 0,100` (to'g'ri 3+1 wrap) |
| **`display:grid`** | **❌ ISHLAMAYDI** | Bolalar joylashtirilmadi — hammasi `0,0`. Xossa qabul qilinadi, lekin layout dvigateli uni bajarmaydi |
| **`gap`** | **❌ TA'SIR QILMAYDI** | `flex+gap:20px` ↔ `flex` o'lchovi **bayt-bir-xil** |
| `display:block` | **o'lchab bo'lmadi** | Bolalar rect'i `0,0` — faqat flex bolalar real koordinata beradi |
| `calc()` / CSS `var()` | **ISHLADI** | `var(--ff-lime)` → computed `#C8F24C` |
| `::before` / `:hover` / `:nth-child` | **ISHLADI** | Selektorlar qo'llanadi |
| `@font-face` (remote woff2) | **ISHLADI** | `fonts.gstatic.com` manifest allowlist'ida bo'lsa yuklanadi |
| `offsetLeft` / `offsetTop` | **ISHLAMAYDI** | Har doim `0`. O'lchash uchun **faqat `getBoundingClientRect()`** |
| `window.innerWidth/Height` | **ISHLAMAYDI** | `undefined`. Panel o'lchami → `document.body.clientWidth/clientHeight` |
| Layout vaqti | **CHEKLOV** | `appendChild` dan keyin layout **darhol emas** — o'lchashdan oldin 1–2 `requestAnimationFrame` kutish shart |

> **FAZA 2 uchun majburiy qaror:** katalog to'ri **`display:flex; flex-wrap: wrap`** + bolalarga
> `margin` bilan quriladi. **CSS Grid va `gap` ishlatilmaydi.** Bu `CLAUDE.md` dagi "column-count TAQIQ,
> qator tartibi saqlansin" qoidasiga mos — flex-wrap DOM qator tartibini buzmaydi.

## 4. Tarmoq

| Band | Natija | Tafsilot |
|------|--------|---------|
| `fetch` GET JSON (`api.getframeflow.app`) | **ISHLADI** | status 200, 13 element |
| Allowlist tashqarisidagi domen | **ISHLADI (to'g'ri bloklandi)** | `https://example.com/` → *"Permission denied to the url … Manifest entry not found"*. → **Har bir domen manifestda bo'lishi shart** |
| Streaming `fetch` + `reader` | **ISHLADI** | 35 chunk, jami 72395 bayt = `content-length` |
| **Chunk turi** | **TUZOQ** | Chunk = **`ArrayBuffer`** (`.byteLength=1360`, **`.length=undefined`**). `chunk.length` bilan progress hisoblash → `NaN` → buzuq fayl. → `toU8()` normalizatsiya majburiy |
| Binar yuklash → fayl butunligi | **ISHLADI** | `write(buf, {format: binary})` → qayta o'qishda 72395=72395, magic `FF D8 FF` ✓ |
| `FormData` multipart | **QISMAN** | Konstruktor bor; jonli multipart POST FAZA 1 da sinaladi |
| `shell.openExternal` | **ISHLADI** | Mavjud → Google device-code oqimi uchun brauzer ochish mumkin |

## 5. Fayl tizimi

| Band | Natija | Tafsilot |
|------|--------|---------|
| `plugin-data:/` yozish + `nativePath` | **ISHLADI** | Doimiy saqlash. `nativePath` → host API'lar talab qiladigan absolut yo'l |
| `plugin-temp:/` papka yaratish | **ISHLADI** | **Idempotent emas:** ikkinchi chaqiruv *"A Folder with given name exists"* → avval `getEntryWithUrl`, keyin `createEntryWithUrl` |
| `localStorage` | **ISHLADI** | — |
| `uxp.storage.secureStorage` | **ISHLADI** | Yozish/o'qish ✓. **Qaytish turi `Uint8Array`** → `utf8Decode` shart. → **token shu yerda saqlanadi**, `localStorage` da emas |
| `localFileSystem: "fullAccess"` | **ISHLADI** | `file:` sxemasi ochiladi — EG papkasiga kirish uchun shart |

## 6. Media

| Band | Natija | Tafsilot |
|------|--------|---------|
| `<video>` remote https MP4 | **ISHLADI** | 1280×720, dur 30.034s, `play()` OK |
| `<img>` remote https | **ISHLADI** | 1280×720 yuklandi |
| `IntersectionObserver` (lazy) | **ISHLADI** | Mavjud → katalog lazy-load qilinadi |
| **Panel o'lchamsiz bo'lsa** | **TUZOQ** | `body 0×0` holatida `<video>`/`<img>` **yuklanmaydi** (timeout). Real layout paydo bo'lgach ishlaydi. → Media faqat ko'rinadigan panelda yuklansin |

## 7. Host API — Premiere DOM (hammasi jonli tasdiqlandi)

| Band | Natija | Tafsilot |
|------|--------|---------|
| `Project.getActiveProject()` | **ISHLADI** | name + path; 25 metod |
| `project.getActiveSequence()` | **ISHLADI** | "FF Spike Seq"; `getVideoTrackCount`, `getPlayerPosition`, `setSelection`, … |
| `TickTime` | **ISHLADI** | `TIME_ZERO`, `createWithSeconds`, `createWithFrameAndFrameRate`, `createWithTicks` |
| `SequenceEditor.getEditor()` | **ISHLADI** | `insertMogrtFromPath`, `insertMogrtFromLibrary`, `createAddItemAction`, `createOverwriteItemAction`, `createInsertProjectItemAction`, … |
| `getInstalledMogrtPath()` | **ISHLADI** | `~/Library/Application Support/Adobe/Common/Motion Graphics Templates/` (14 element, 4 `.mogrt`) |
| **EG papkasiga yozish huquqi** | **✅ ISHLADI** | Yozildi + o'qildi + o'chirildi → **"Essential Graphics'ga o'rnatish" amali mumkin** |
| **`insertMogrtFromPath()` — EG yo'lidan** | **✅ ISHLADI** | 1 trackItem qaytdi |
| **`insertMogrtFromPath()` — ixtiyoriy `plugin-temp` yo'lidan** | **✅ ISHLADI** | 7.078 MB yuklab olingan `.mogrt` V2 trekka qo'yildi → **EG'ga o'rnatmasdan ham import qilinadi** |
| `project.importFiles()` | **ISHLADI** | `→ true`; media bin'ga tushdi |
| `lockedAccess` + `executeTransaction` | **QISMAN** | `lockedAccess` chaqirildi, `videoTrackCount=3`. Transaction bajarilmadi (`getVideoTrack` async → callback ichida sync ishlatib bo'lmaydi). **26.3 da `create*Action` faqat `lockedAccess` ichida bo'lishi shart** → FAZA 3 da to'g'ri naqsh yoziladi |
| `importSequences()` | **QISMAN** | Mavjud (arity 0); `Guid[]` talab qiladi → jonli `.prproj` sinovi FAZA 3 |
| **`Exporter.exportSequenceFrame()`** | **ISHLADI** | **jpg 8 KB · png 23 KB · tga 921 KB · dpx 929 KB · tif 924 KB** ✓ · **`.bmp` va kengaytmasiz → "File Format is not supported"** |
| Export **asinxronligi** | **TUZOQ** | `true` qaytaradi, lekin fayl **~1 s keyin** diskda paydo bo'ladi. Darhol `getEntry` → "fayl yo'q". → **o'lcham barqarorlashguncha poll qilish shart** (spike'dagi `waitForFile`) |

## 8. Tema

| Band | Natija | Tafsilot |
|------|--------|---------|
| `document.theme.getCurrent()` | **ISHLADI** | `"darkest"` |
| `document.theme.onUpdated` | **ISHLADI** | Listener qo'shsa bo'ladi → tema o'zgarganda token yangilanadi |

---

## FAZA 1+ ga o'tadigan majburiy qarorlar

1. **Layout = flex-wrap + margin.** CSS Grid va `gap` ISHLATILMAYDI (§3).
2. **`toU8()` + qo'lda `utf8Decode()`** umumiy `lib/bytes.js` ga (§2, §4).
3. **Token `secureStorage`da** (`Uint8Array` → decode), `localStorage` faqat UI holati uchun (§5).
4. **O'lchash faqat `getBoundingClientRect()`, 2×rAF dan keyin**; panel o'lchami `document.body.clientWidth` (§3).
5. **`.zip`/`.mogrt` ochish serverda** — UXP'da `zlib` yo'q (§1.6).
6. **Streaming progress `byteLength` bo'yicha**, `length` bo'yicha emas (§4).
7. **`plugin-temp` papkasi idempotent yaratilsin** (§5).
8. **Export → fayl paydo bo'lishini poll qilish**, `true` ga ishonmaslik (§7).
9. **Har bir tashqi domen manifest allowlist'ida** bo'lishi shart (§4).
10. **Import ikki yo'l bilan mumkin:** (a) `plugin-temp` dan to'g'ridan-to'g'ri timeline'ga,
    (b) EG papkasiga o'rnatib doimiy qilish. **Ikkalasi ham FAZA 3 da beriladi.**
11. **Dev tsikl:** har o'zgarishdan keyin `install-uxp-dev.mjs` + **Premiere to'liq restart**.

## Ochiq (texnik bo'lmagan) risk

`GET /api/plugin/catalog?app=pr` production'da **0 element**. Plagin texnik jihatdan tayyor bo'lsa ham,
`app=pr` kontenti bo'lmasa launch qilib bo'lmaydi — bu moderatsiya/kontent yo'nalishi vazifasi.
