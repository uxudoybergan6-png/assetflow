# Mister Horse Composer — mexanizm-tahlili (FAQAT MEXANIZM, UI EMAS)

**Maqsad:** Mister Horse'ning ikkita CEP kengaytmasi qanday ishlashini (host qatlami,
native ko'prik, fayl/disk, import/joylash, masshtab, undo, panel↔host ma'lumot oqimi)
teskari-tahlil qilish va har bir mexanizmni FrameFlow plaginimizdagi ekvivalentga
xaritalash. Bu **read-only** tahlil — MH kodini o'zgartirmadik, ko'chirmadik; faqat
mexanizmni va simvol nomlarini dalil sifatida keltiramiz.

**Tahlil qilingan nusxalar:**
- **PRIMARY (AE):** `~/Library/Application Support/Adobe/CEP/extensions/com.misterhorse.AnimationComposer` (v4.1.0)
  - + native motor: `~/Library/Application Support/Adobe/Common/Plug-ins/7.0/MediaCore/MisterHorse/AnimationComposer4/AnimationComposer4.plugin`
- **SECONDARY (Premiere):** `/Library/Application Support/Adobe/CEP/extensions/com.misterhorse.PremiereComposer`
  - + native ko'prik: `support_files/MHPC_ExternalObjectBundle.bundle`, `MHPC_NativeHelper.app`, `MediaCore/.../PremiereComposer/MHPC_Importer.bundle`

---

## 0. ⚠️ ENG MUHIM ARXITEKTURA TOPILMASI (avval buni o'qing)

**AE Animation Composer ExtendScript kengaytmasi EMAS.** U — **native C++ AEGP plagin**
(`AnimationComposer4.plugin`, `Info.plist: CFBundlePackageType = AEgx`, `CFBundleSignature = FXTC`),
JUCE freymvorki + `libwebsockets` bilan qurilgan. CEP paneli import/joylash/masshtab/undo
uchun **evalScript ISHLATMAYDI** — u localhost'da ishlaydigan **WebSocket JSON-RPC serveriga**
ulanadi va butun ish AEGP SDK orqali native kodda bajariladi.

**Dalil (CONFIRMED):**
- `AnimationComposer4.plugin/Contents/Info.plist` → `CFBundlePackageType = AEgx` (AE General Plugin).
- Native binardagi satrlar: `AEGP Comp Suite`, `AEGP Item Suite`, `AEGP Footage Suite`,
  `AEGP File Import Manager Suite`, `AEGP Dynamic Stream Suite`, `AEGP Marker Suite`,
  `AEGP Keyframe Suite`, `MH8Composer2AC12CompImporter`, `JsonApi::WebSocketResponseMessage`.
- Panel↔native transport: `browser.bundle.js` ichida
  `new WebSocket("ws://localhost:<port>/api?class=<id>", "api.ac.misterhorse.com")`.
- **Port kashfi (juda muhim naqsh):** panel host yo'lidan port fayl nomini hisoblaydi:
  - `hash = sha256( getSystemPath(HOST_APPLICATION) ).slice(0,8)` (Windows'da `/`→`\`)
  - port fayli: `~/Library/Application Support/MisterHorse/AnimationComposer4/api_<hash8>`
  - biz diskda topdik: `api_64b09027` → mazmuni `{"port": 56008}`.
  - `lsof -iTCP:56008 -sTCP:LISTEN` → **After Effects** protsessining o'zi tinglaydi
    (native AEGP plagin AE ichida server ochgan). Tasdiqlangan.
- `mh-browser-aeft.jsx` (host skript) FAQAT ikki ish qiladi: `registerPlugin("mh_ac", ...)`
  va `enumerateFonts()` (chunki `app.fonts` faqat ExtendScript'da bor). Import/joylash yo'q.

**Premiere Composer esa klassik ExtendScript naqsh:** `loader_mhac.jsx` +
`new ExternalObject('lib:.../MHPC_ExternalObjectBundle.bundle')` + `MHPC_NativeHelper.app`
+ node `adm-zip`. Barcha joylash/masshtab QE DOM va ExtendScript'da.

**FrameFlow uchun xulosa:** FrameFlow — sof ExtendScript (`host.jsx`) + CEP Node.js plagin.
Native AEGP yo'lini takrorlash = kompilyatsiya qilingan C++ plagin, kod-imzo, notarizatsiya
(katta ish, bu vazifa doirasidan tashqari). Shuning uchun **amaliy manba — Premiere
naqshi** (ExtendScript-drayverli joylash/masshtab/undo + Node.js `child_process`/unzip
yuklab olish uchun). AE native yo'lini "ishonchlilik uchun oltin standart" sifatida qayd
etamiz (nega MH aynan shuni tanlaganini quyida tushuntiramiz), lekin FrameFlow ekvivalenti
ExtendScript qatlamida quriladi.

---

## 1. Xulosa jadvali

| # | Mexanizm | MH simvol / fayl (dalil) | FrameFlow ekvivalenti | Tegiladigan fayl | Ustuvorlik | Ishonch |
|---|----------|--------------------------|-----------------------|------------------|-----------|---------|
| 1 | **Nishonga joylash** (placeholder→almashtirish) | PR: `setFromMHBricks`, `removePlaceholderBricks`, `importMGT`, `getPlayerPosition` (`loader_mhac.jsx`). AE: RPC `Editor.addPrecomp`/`addMogrt`/`addCompInAep`/`addFootageFile`; `CompImporter`, `MogrtInsertTask` (native) | Aktiv comp → tanlangan layer/null placeholder → uning `index`/`inPoint`/`transform.position` o'qi → `importFile` → o'sha slotga `layers.add` | `host.jsx` (`importAssetToProject`, `importMediaFromPath` kengaytirish) | **1 (top)** | Confirmed (PR) / native-inference (AE) |
| 2 | **Avto-masshtab** | AE: `// MISTER HORSE - AUTOSCALE RIG` ifoda `ADBE Scale`da (`sourceRectAtTime`). PR: `ensureCorrectMogrtScale`, `scaleClipsToFit`, `duplicateMogrtWithSize` | `scale = comp o'lchami / manba o'lchami` → `layer.property("ADBE Scale").setValue([sx,sy])`; ixtiyoriy `sourceRectAtTime` fit | `host.jsx` (yangi `afScaleLayerToComp`) | **2 (top)** | Confirmed |
| 3 | **Native yuklab olish/unzip ko'prigi** | PR: `cep_node.require("adm-zip")`, `require("child_process").exec`, `MHPC_NativeHelper.app`, `require("fs")`. AE: native downloader (Product Manager) | Node `require("fs")` yuklab olish + `child.execFileSync("unzip", ...)` (allaqachon bor), streaming download + progress; katta fayl uchun Product-Manager uslubidagi tashqi jarayon | `assetflow-catalog.js` (`extractMogrtFileToAep`, `downloadDir` kengaytirish) | **3 (top)** | Confirmed |
| 4 | **Lokal kutubxona indeksi** | PR: `cep_node.require("fast-readdir").freaddirSync`; adm-zip'dan `definition.json`/`thumb.png`. AE: native `ContentManager`, `Content.getItemTree`, `.mhitemdata` | Node `fs.readdirSync` bilan `downloadDir` indeksi + metadata cache (JSON); `disk-bridge` handle store | `assetflow-catalog.js` + `assetflow-plugin-disk-bridge.js` | 4 | Confirmed |
| 5 | **O'z assetini tanish (self-tag)** | AE: yashirin marker parametri `zzzzzzzzzzzzzzz_ACPrecompMarker` (Marker Suite); `$$AC_PARENT_STREAM_NAME$$`. PR: `isMHClip` = `/mister horse/i` nom-regex + MGT matn xossasi; `name + ' by Mister Horse'` | Import qilingan comp/layer'ga marker (yashirin param) yoki nom-suffiks yoki `comment`/label rangi qo'yish; regex bilan tanish | `host.jsx` (yangi `afTagImportedLayer`/`afIsFrameFlowItem`) | 5 | Confirmed |
| 6 | **Undo guruhlash** | AE: RPC `startUndoGroup`/`endUndoGroup` + `undoGroupId` (native `juce::UndoManager`). PR: `$.mhac.undoGroups.start/end` | `app.beginUndoGroup(...)`/`app.endUndoGroup()` — import+joylash+masshtab+tag BITTA guruhda (allaqachon bor, kengaytirish) | `host.jsx` | 6 | Confirmed |
| 7 | **Davomiylik / trim** | PR: `mogrtMeta.maxDur` → `setClipOutPoint`. AE: `IN`/`OUT`/`CUT` marker + time-remap ifodalari (`EditablePrecomp::Duration`) | comp `duration` / marker → `layer.outPoint`; ixtiyoriy time-remap | `host.jsx` | 7 | Confirmed |
| 8 | **Import'dan keyin tahrirlanadigan parametrlar** | AE: `CompImporter::addEssentialProperties`, `essentialProperty(i)`, `$$AC_PARENT_STREAM_NAME$$`; RPC `Editor.setPropertyValue`. PR: `getMogrtInfo`, `getAeGraphicParams`, `mogrtApplyLastUsedFont` | Essential Graphics stream'lar (`comp.essentialProperty`) yoki effekt controllari orqali matn/rang/shrift o'qish-yozish | `host.jsx` (yangi `afGetEditableParams`/`afSetParam`) | 8 | Confirmed (mexanizm) |

---

## 2. Mexanizmlar bo'yicha batafsil

### Ustuvorlik tartibi (aniq)
1. **Nishonga joylash** (top — eng chuqur)
2. **Avto-masshtab** (top)
3. **Native yuklab olish/unzip ko'prigi** (top — deep-dive quyida, 3-bo'lim)
Qolganlari (4–8) qisqaroq, lekin har biri (a) QANDAY ISHLAYDI + (b) FRAMEFLOW EKVIVALENTI bilan.

---

### 1) NISHONGA JOYLASH (placeholder → almashtirish) — TOP

**(a) MH'da qanday ishlaydi**

*Premiere (CONFIRMED, `loader_mhac.jsx` o'qildi):*
Naqsh — "placeholder brick'ni topib, o'sha aniq slotga import qilish":
- `setFromMHBricks()` (L683) barcha video/audio treklarni skanlaydi, nomi `/\.mhbricks$/i`
  ga mos klipni topadi va `[track, clip]` indekslarini `self.video`/`self.audio`ga yozadi.
- `replacePlaceholderWithMogrt()` (L801): `getVideo(0)`dan `vTrack`, `aTrack`, `time = vclip.start`
  ni oladi → `removePlaceholderBricks()` (L853) placeholder'ni `qe.project.undo()` bilan
  o'chiradi (va agar trek yo'qolsa `addTracks` bilan qayta tiklaydi) → `importMGT(path, time, vTrack, aTrack)`
  aynan o'sha vaqt/trekka MOGRT joylaydi.
- Playhead varianti: `safeInsertMogrt()`/`safeInsertFootage()` `app.project.activeSequence.getPlayerPosition()`
  dan vaqt oladi, `getOrCreateFreeTracks(time, len, ...)` (L1129) bo'sh trek topadi/yaratadi,
  keyin `insertClip(item, time, vTrack, aTrack)`.
- Noto'g'ri joyga tashlashni tekshirish: `checkForWrongBricksPlacement()` (L1262) — agar
  `.mhbricks` proyekt panelida qolgan bo'lsa, foydalanuvchini ogohlantirib undo qiladi.

*AE (native, CONFIRMED simvollar):* Import RPC metodlari native kodda:
`Editor.addPrecomp`, `Editor.addMogrt`, `Editor.addCompInAep`, `Editor.addFootageFile`,
`Editor.addResolveComp`, `Editor.addSound`, `Editor.replaceMediaWithSelectedItem`. Ishni
`MH::Composer::AC::CompImporter` va `LayerSelectionEditorTasks::MogrtInsertTask` /
`FootageFileInsertTask` bajaradi — nomidan ko'rinib turibdiki, **joylash "tanlangan layer"
(LayerSelection) atrofida** aylanadi, panel Add tugmasi tanlangan layer/playhead kontekstini
native tomonga uzatadi. Aniq target-resolution (tanlangan layer indeksi vs playhead vs null
placeholder) kompilyatsiya qilingan kodda — **UNCONFIRMED**, jonli AE tekshiruvi kerak (5-bo'lim).

**(b) FrameFlow ekvivalenti**

FrameFlow allaqachon `importAssetToProject` (L1802) va `importMediaFromPath` (L1834) ga ega;
oxirgisi aktiv comp bo'lsa `active.layers.add(item)` + `layer.startTime = active.time` qiladi.
Nishonga joylashni to'liq qilish uchun **placeholder/null-based slot** o'qishni qo'shamiz:

```javascript
// host.jsx — yangi funksiya
function afPlaceAtTarget(filePath) {
  var comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) return afFail("No comp open");
  app.beginUndoGroup("FrameFlow Place");           // (mexanizm 6)
  // 1. Nishonni aniqlash: tanlangan layer > null/solid placeholder > playhead
  var target = null, insertTime = comp.time, insertIndex = 1;
  var sel = comp.selectedLayers;
  if (sel && sel.length) {
    target = sel[0];
    insertTime  = target.inPoint;                  // placeholder inPoint (mexanizm 1)
    insertIndex = target.index;                     // xuddi shu stacking slot
    // ixtiyoriy: target.transform.position ni saqlab, yangi layerga ko'chirish
  }
  // 2. Import (aep→PROJECT, footage→FOOTAGE)
  var io = new ImportOptions(new File(filePath));
  var item = app.project.importFile(io);
  // 3. O'sha slotga qo'yish
  var layer = comp.layers.add(item);
  layer.startTime = insertTime;
  if (target) {
    layer.moveBefore(target);                        // insertIndex slotiga
    // placeholder pozitsiyasini meros qilish:
    try { layer.transform.position.setValue(target.transform.position.value); } catch(e){}
    target.remove();                                 // placeholder'ni olib tashlash (removePlaceholderBricks ekvivalenti)
  }
  afTagImportedLayer(layer);                          // (mexanizm 5)
  app.endUndoGroup();
  return JSON.stringify({ ok:true, layer: layer.name });
}
```

Kengaytirish nuqtasi: mavjud `importMediaFromPath` allaqachon `layers.add` + `startTime` qiladi
(L1867-1868) — unga `selectedLayers[0]` dan `index`/`inPoint`/`position` merosini va placeholder
o'chirishni qo'shsak, MH "brick replace" naqshining AE ekvivalenti bo'ladi. `.aep` uchun
mavjud `resolveImportedSceneComp`/`addSceneCompToTimeline` (L1061, L1162) allaqachon
comp'ni topib timeline'ga qo'yadi — o'sha yo'lga slot-merosini ulash kifoya.

---

### 2) AVTO-MASSHTAB — TOP

**(a) MH'da qanday ishlaydi**

*AE (CONFIRMED — ifoda matni binardan to'liq olindi):* Masshtab **bir martalik set emas,
balki `ADBE Scale`ga ulangan IFODA (expression rig)**: `// MISTER HORSE - AUTOSCALE RIG`.
Mag'zi — nishon layer kontentini manba layer bounds'iga moslash:
```
var srcRect = srcLayer.sourceRectAtTime(srcLayer.sourceTime(srcTime));
var myRect  = thisLayer.sourceRectAtTime(thisLayer.sourceTime(myTime));
autoWidth  = 100*(srcRect.width  + horizPad*2)/myRect.width;
autoHeight = 100*(srcRect.height + vertPad*2)/myRect.height;
res = [autoWidth, autoHeight, 100];
```
`Autoscale Source Layer` (Layer Control effekt), `Autoscale Horizontal/Vertical Padding`
(Slider), `Autoscale Fixed Width/Height`, `Freeze Time` (Checkbox) — controllar orqali
sozlanadi. Alohida `- ANCHORPOINT FIX` rig anchor point'ni `sourceRectAtTime`dan qayta
markazlaydi. Bu — **kontent-o'lchamli (text-box) autoscale**, comp-rezolyutsiyasiga emas,
manba klip bounds'iga moslashadi.

*Premiere (CONFIRMED):* Ikki alohida naqsh:
- `duplicateMogrtWithSize(srcPath, dstPath, seqW, seqH)` (native ExternalObject) — MOGRT'ni
  ketma-ketlik o'lchamiga **import'dan OLDIN** qayta yozadi.
- `ensureCorrectMogrtScale()` (L1017) — MGT klipning `AE.ADBE Motion` Scale'ini 100% ga
  qaytaradi (MOGRT o'z ichida to'g'ri o'lchamga ega bo'lgani uchun).
- `scaleClipsToFit()` (L935) — oddiy footage uchun: `targetScaleX = seqWidth/clipWidth`,
  `targetScaleY = seqHeight/clipHeight`, `cover = max(x,y)`, `contain = min(x,y)` va
  `AE.ADBE Motion` Scale'ga `(cover/contain)*100` yozadi.

**(b) FrameFlow ekvivalenti**

Ikki daraja taklif qilamiz:

*Oddiy (comp-rezolyutsiyaga fit) — MH Premiere `scaleClipsToFit` ekvivalenti:*
```javascript
// host.jsx
function afScaleLayerToComp(layer, comp, mode /* "cover"|"contain" */) {
  var r  = layer.sourceRectAtTime(comp.time, false);   // source bounds
  var sw = layer.source ? layer.source.width  : r.width;
  var sh = layer.source ? layer.source.height : r.height;
  if (!sw || !sh) return;
  var sx = comp.width / sw, sy = comp.height / sh;
  var s  = (mode === "contain") ? Math.min(sx,sy) : Math.max(sx,sy);
  layer.property("ADBE Transform Group").property("ADBE Scale")
       .setValue([s*100, s*100]);
}
```

*Kuchli (kontent-bounds fit, MH AE rig ekvivalenti):* agar dinamik (matn o'lchami o'zgarganda
qayta hisoblanadigan) masshtab kerak bo'lsa, `ADBE Scale`ga MH'nikiga o'xshash `sourceRectAtTime`
ifodasini `.expression = "..."` bilan yozamiz. Statik import uchun oddiy variant yetarli;
FrameFlow'da statik templatelar ustun bo'lgani uchun **oddiy variantni birinchi qilamiz**.
Bu import undo-guruhi ichida (mexanizm 6), `afPlaceAtTarget`dan keyin chaqiriladi.

---

### 3) NATIVE YUKLAB OLISH / UNZIP KO'PRIGI — TOP · DEEP-DIVE

Bu — bizning **"hasPack"/katta-fayl** muammomizga javob. Uch qatlamli tahlil.

**(a.1) AE native ko'prigi (arxitektura, CONFIRMED)**

AE Composer yuklab olishni CEP panelida QILMAYDI. Uni alohida **Mister Horse Product Manager**
ilovasi bajaradi (`/Applications/Mister Horse Product Manager.app`, `Locations.dat`da qayd).
Product Manager fayllarni `~/Library/Application Support/MisterHorse/ProductManager/Products/<id>/`
ga yuklaydi (`Product.mhprodmeta` binar indeks + `Items/`, `Assets/`, `SupportItems/*.mhitemdata`).
Native AEGP plagin (`AnimationComposer4.plugin`) diskdagi shu tayyor kutubxonani o'qiydi va AE'ga
import qiladi — ya'ni **yuklab olish import'dan butunlay ajratilgan** (jarayon chegarasi bilan).
`Content.checkForUpdates`/`ProductManager.checkForUpdates` RPC yangilanishni tekshiradi.
Bu AE Composer'ning ishonchlilik siri: og'ir I/O ExtendScript main-thread'idan tashqarida,
mustaqil ilovada.

**(a.2) Premiere native ko'prigi (CONFIRMED — kod o'qildi)**

Premiere aniqroq ko'rinadigan node/native zanjirini ishlatadi:
- **adm-zip (node):** `cep_node.require("adm-zip")` — MOGRT (`.mogrt` = ZIP) ni panelda
  ochib, `readAsText("definition.json")` va `readFile("thumb.png")` bilan metadata/thumbnail
  chiqaradi (offline, tez). Dalil: `browser_app.bundle.js`.
- **child_process (node):** `require("child_process").exec` — (1) `MHPC_NativeHelper.app`ni
  `--cmd=mhfontgen --params=<base64 JSON>` bilan chaqirib animatsion-shrift MOGRT generatsiya
  qiladi (og'ir ish native ilovada, ExtendScript'dan tashqarida); (2) reveal-in-finder/explorer.
- **ExternalObject (ExtendScript native lib):** `new ExternalObject('lib:.../MHPC_ExternalObjectBundle.bundle')`
  — `getMogrtInfo`, `getAeGraphicParams`, `duplicateMogrtWithSize`, `enumerateFonts`, `pickColor`,
  `normalizeString` kabi C++ funksiyalarni ExtendScript ichidan sinxron chaqiradi
  (`self.mhExtObj.doCommand(...)`). Bu — ExtendScript ↔ native ko'prik.
- **MediaCore importer:** `MHPC_Importer.bundle` — Premiere'ga `.mhbricks`/MOGRT'ni tushunadigan
  maxsus importer plaginini beradi.
- **NativeHelper naqshi:** panel `runJSXFunction("$.mhac.getNativeHelperPath")` bilan ilova
  yo'lini oladi, so'ng `child_process.exec('"<path>" --cmd=... --params=<base64>')`, chiqishni
  fayldan o'qiydi (`ERROR_MISSING_OUTPUT_FILE`). Ya'ni: **parametrni base64-JSON qilib CLI
  argument sifatida uzatish, natijani chiqish faylidan olish.**

**(b) FrameFlow ekvivalenti**

FrameFlow allaqachon to'g'ri asosga ega — buni tasdiqladik:
- `assetflow-catalog.js`: `require("fs")` bilan `downloadDir` yaratish/yozish (L64-131),
  `child.execFileSync("unzip", ["-o", mogrtPath, "-d", dir])` bilan MOGRT/pack ochish
  (`extractMogrtFileToAep`, L507-534), va ichki `.aegraphic` (ZIP) uchun PK-magic
  (`0x50 0x4b`) tekshiruvi bilan qayta unzip (L524-534). `unzip -Z1` bilan entry-list (L397).

Ya'ni MH'ning `adm-zip` node moduli o'rniga biz **system `unzip`ni `execFileSync`** bilan
ishlatamiz — bir xil natija, qo'shimcha bog'liqliksiz. Kengaytirish rejasi:

```javascript
// assetflow-catalog.js — hozirgi execFileSync'ni streaming + progress'ga ko'tarish
// 1. Yuklab olish: fetch stream → fs.createWriteStream (progress event), sha256 tekshirish
// 2. Atomik: temp faylga yoz, tugagach rename (yarim-fayl importdan saqlanadi)
// 3. Unzip: mavjud execFileSync("unzip", ...) (allaqachon bor) — TEGMA, ishlaydi
// 4. Katta/uzoq ish uchun (MH NativeHelper ekvivalenti): child_process.spawn bilan
//    detached unzip + poll, ExtendScript main-thread'ni bloklamaslik uchun.
```

**MH'dan olinadigan asosiy saboq (ishonchlilik uchun):** og'ir download/unzip HECH QACHON
ExtendScript ichida qilinmaydi — u Node.js (CEP) yoki tashqi jarayonda bo'ladi, so'ng
faqat TAYYOR lokal fayl yo'li `evalScript`/`importFile`ga uzatiladi. FrameFlow shu chegarani
allaqachon hurmat qiladi (catalog.js Node, host.jsx faqat `importFile`) — buni buzmaslik kerak.
Yaxshilash: (1) atomik yozish (temp→rename), (2) sha256 yaxlitlik tekshiruvi, (3) progress
hodisasi, (4) `spawn` bilan uzoq unzip'ni bloklamaslik.

---

### 4) LOKAL KUTUBXONA INDEKSI

**(a)** *Premiere:* `cep_node.require("fast-readdir").freaddirSync(dir)` — diskdagi paketlarni
tez indeks qiladi (native readdir, sinxron). Har MOGRT metadatasi adm-zip orqali `definition.json`
dan o'qiladi va cache'lanadi. *AE (native):* `ContentManager` klassi + `Content.getItemTree`,
`Content.getThumbnail`, `Content.getFavoriteItems`, `Content.addFolderToUserLibrary` RPC;
`.mhitemdata`/`Product.mhprodmeta` binar indekslar; `ItemThumbnailManager` bilan lazy thumbnail.

**(b) FrameFlow:** `assetflow-catalog.js` `downloadDir` ni `fs.readdirSync` bilan indekslashi
va har paketning metadatasini (comp nomi `definition.json`dan — allaqachon `rememberMogrtCompName`
L467 bor) JSON cache faylga yozishi mumkin. `assetflow-plugin-disk-bridge.js` allaqachon
File System Access handle store (`putBlob`/`getBlob`/`getBlobUrl`, L134-190) bilan blob-lokal
saqlashni beradi — buni "downloaded packs" ro'yxati + oxirgi-o'zgarish vaqti bilan kengaytirib,
offline/tez katalog qilamiz. Yangi node bog'liqlik shart emas.

---

### 5) O'Z ASSETINI TANISH (SELF-TAG)

**(a)** *AE (CONFIRMED):* ikki mexanizm. (1) **Yashirin marker parametri** — MH o'z precomp'lariga
`zzzzzzzzzzzzzzz_ACPrecompMarker` nomli marker parametri (protected region) qo'yadi; time-remap
ifodalari `m.parameters.hasOwnProperty('zzzz..._ACPrecompMarker')` bilan FAQAT o'z markerlarini
filtrlaydi (`z` prefiks — ro'yxat oxirida, ko'rinmas). (2) `$$AC_PARENT_STREAM_NAME$$` —
Essential-property nomlanish placeholder'i. *Premiere (CONFIRMED):* `isMHClip()` (L1358) =
klip nomi `/mister horse/i` ga mos YOKI MGT matn xossasi (`AE.ADBE Text`) "mister horse"
saqlaydi; import'da `insertedClip.name = insertedClip.name + ' by Mister Horse'` (L842).

**(b) FrameFlow:**
```javascript
// host.jsx
var FF_TAG = "FrameFlow";
function afTagImportedLayer(layer) {
  try {                                   // marker orqali (barqaror, ko'rinmas)
    var mv = new MarkerValue(FF_TAG);
    layer.property("ADBE Marker").setValueAtTime(layer.inPoint, mv);
  } catch(e) {}
  layer.comment = FF_TAG;                 // yoki comment/label — oddiy va tez
  layer.label = 9;                        // rang-yorliq (ixtiyoriy vizual belgi)
}
function afIsFrameFlowItem(layer) {
  try { if (layer.comment && layer.comment.indexOf(FF_TAG) >= 0) return true; } catch(e){}
  return /frameflow/i.test(layer.name || "");
}
```
Comp darajasida: import qilingan root papkani nomlash (FrameFlow allaqachon `renameImportRootForComp`
L1120 / `uniqueRootFolderLabel` L1110 qiladi) — bu ham self-tag vazifasini bajaradi.

---

### 6) UNDO GURUHLASH

**(a)** *AE:* RPC `startUndoGroup`/`endUndoGroup` + `undoGroupId` (native `juce::UndoManager`;
`TransitionShifter.startUndoGroup`/`endUndoGroup` ham). *Premiere:* `$.mhac.undoGroups.start()`
/ `.end()` importning boshi-oxirini o'raydi (L813-850) — placeholder-o'chirish + import +
masshtab BITTA undo qadamda; `preventRedo` (L1283) noto'g'ri holatni tozalaydi.

**(b) FrameFlow:** `app.beginUndoGroup(...)`/`app.endUndoGroup()` allaqachon ishlatilyapti
(`"AssetFlow Import"` L1807, `"AssetFlow AI Import"` L1846, `"AssetFlow Import Scene"` L1280,
`"AssetFlow Remove Template"` L1411). **Muhim naqsh:** yangi import+joylash+masshtab+tag
ketma-ketligini BITTA `beginUndoGroup("FrameFlow Place")` … `endUndoGroup()` ichiga o'rash
(yuqoridagi `afPlaceAtTarget` shunday). Diqqat: ES3 try/finally return'ni yutishi mumkin —
FrameFlow allaqachon buni biladi (L1843-1846 izoh): natijani o'zgaruvchiga yig'ib, `endUndoGroup`
ni alohida chaqirib, oxirida bitta `return`. Bu naqshni saqlash SHART.

---

### 7) DAVOMIYLIK / TRIM

**(a)** *Premiere (CONFIRMED):* `getMogrtInfo`dan `mogrtMeta.maxDur` o'qib, `setClipOutPoint(clip, maxDur)`
(L1549) klip out-nuqtasini cheklaydi. *AE (CONFIRMED):* `IN`/`OUT`/`CUT` comment markerlari +
time-remap ifodalari (`EditablePrecomp::Duration`, `DurationWithoutTransitions`) — trim va
o'tish (transition) vaqtini marker-juftliklaridan hisoblaydi.

**(b) FrameFlow:** import qilingan layer uchun `layer.outPoint = layer.inPoint + wantedDur`
yoki comp `duration`ga moslash. Agar templatening IN/OUT markerlari bo'lsa, FrameFlow allaqachon
marker o'qish/yozish infratuzilmasiga ega (`readPreviewMarkerSegments` L546, `createPreviewSceneMarkers`
L599, `comp.markerProperty`) — o'shani layer-trim uchun qayta ishlatamiz.

---

### 8) IMPORT'DAN KEYIN TAHRIRLANADIGAN PARAMETRLAR (matn/rang/shrift)

**(a)** *AE (CONFIRMED):* native `CompImporter::addEssentialProperties(comp, ...)` import'da
comp'ning kerakli stream'larini Essential Graphics'ga chiqaradi; `essentialProperty(i)` bilan
indekslanadi; `$$AC_PARENT_STREAM_NAME$$` nom-shabloni. RPC `Editor.setPropertyValue`,
`Editor.getPropertyValues`, `Editor.callPropertyAction`, `Editor.showColorPicker`,
`Editor.saveNewPaletteForProperty` — panel EG parametrlarini o'qiydi/yozadi. *Premiere:*
`getAeGraphicParams(path)`, `getMogrtInfo(path)` (ExternalObject), `mogrtApplyLastUsedFont`
(L1693) — MGT komponent xossalaridagi `"fontEditValue":[...]` JSON'ni topib shriftni yozadi.

**(b) FrameFlow:** After Effects ExtendScript'da Essential Graphics API mavjud:
```javascript
// host.jsx — o'qish
function afGetEditableParams(comp) {
  var out = [], ep = comp.essentialProperty;      // CompItem.essentialProperty (AE 15+)
  // yoki: comp.motionGraphicsTemplateControllerCount / getMotionGraphicsTemplateControllerName
  for (var i = 1; i <= comp.numLayers; i++) {
    var lay = comp.layer(i);
    // Matn: lay.property("ADBE Text>...").property("ADBE Text Document")
    // Rang: effekt "ADBE Color Control"; Shrift: TextDocument.font
  }
  return JSON.stringify(out);
}
// yozish: textProp.setValue(new TextDocument(...)), colorControl.setValue([r,g,b]),
//         td.font = "PostScriptName" (TextDocument.font)
```
FrameFlow uchun eng amaliy yo'l: import qilingan comp'ning **Essential Graphics** stream'larini
`comp.essentialProperty` orqali o'qib, panelga chiqarish va `setValue` bilan qaytarish
(MH AE aynan shu API'ni ishlatadi). Agar template EG'siz bo'lsa — layer effekt-controllari
(Slider/Color/Checkbox) va `TextDocument` (matn/shrift/rang) orqali to'g'ridan-to'g'ri.

---

## 3. Native ko'prik deep-dive (mexanizm 3 kengaytmasi)

Yuqorida 3(a.1)/3(a.2)/3(b) berildi. Bu yerda **arxitektura solishtiruvi** va FrameFlow
qarori:

| Qatlam | AE Composer (native) | Premiere Composer (ExtendScript) | FrameFlow (hozir / reja) |
|--------|----------------------|----------------------------------|--------------------------|
| Panel↔host transport | **WebSocket JSON-RPC** (`ws://localhost:<port>/api`, subproto `api.ac.misterhorse.com`); port `api_<sha256(hostPath)[:8]>` faylidan | `evalScript` + `ExternalObject.doCommand` (sinxron) | `evalScript` (host.jsx) — TEGMA |
| Host-side motor | native C++ AEGP plagin (`AEgx`, AEGP SDK, JUCE) | ExtendScript `loader_mhac.jsx` + QE DOM | ExtendScript `host.jsx` |
| Native yordamchi | Product Manager.app (download) + Importer.bundle | `MHPC_NativeHelper.app` + `MHPC_ExternalObjectBundle.bundle` | — (kerak emas) |
| Zip/unzip | native (Product Manager) | node `adm-zip` | **system `unzip` via `execFileSync`** (bor) |
| Katalog indeks | native `ContentManager` | node `fast-readdir` | node `fs.readdirSync` (reja) |

**Nega MH AE'da native yo'lni tanladi (va biz nega tanlamaymiz):** native AEGP + WebSocket
ExtendScript'ning main-thread bloklanishi, ES3 til cheklovlari, va katta proyektlarda
sekinlikdan qutqaradi — lekin kompilyatsiya, kod-imzo (`FXTC`/Developer ID), notarizatsiya
va har AE versiyasiga SDK-moslik talab qiladi. FrameFlow uchun bu nomutanosib. **Amaliy
FrameFlow ko'prigi:** og'ir I/O ni CEP Node.js'da (`fs`, `child_process`, `unzip`) qilish
+ faqat tayyor fayl yo'lini `host.jsx`ga uzatish — biz allaqachon shunday qilyapmiz, uni
atomik-yozish, sha256, progress, va `spawn`-detached unzip bilan mustahkamlash yetarli.

---

## 4. Build order (top-3 ni FrameFlow'ga kiritish — minimal, additiv, past-xavf)

Har PR mustaqil, mavjud kontraktlarni buzmaydi (money-zone'ga tegmaydi):

- **PR-1 — Undo-o'ralgan joylash slotlari (mexanizm 1 + 6, past xavf).**
  `host.jsx`ga `afPlaceAtTarget(filePath)` qo'shish: aktiv comp + `selectedLayers[0]`
  placeholder'dan `index`/`inPoint`/`position` merosi, so'ng `layers.add` + `moveBefore`
  + placeholder `remove`, bitta `beginUndoGroup`/`endUndoGroup` ichida. Mavjud
  `importMediaFromPath` (L1834) ni TEGMASDAN, uning yoniga qo'shiladi. Frontend eski yo'lni
  saqlaydi, yangi tugma yangi funksiyani chaqiradi.

- **PR-2 — Avto-masshtab (mexanizm 2, past xavf).**
  `host.jsx`ga `afScaleLayerToComp(layer, comp, mode)` (oddiy cover/contain). `afPlaceAtTarget`
  oxirida, undo-guruh ichida chaqiriladi. Faqat `ADBE Scale.setValue` — qaytariladigan,
  xavfsiz. (Dinamik `sourceRectAtTime` ifoda-rig — keyingi ixtiyoriy bosqich.)

- **PR-3 — Yuklab olish/unzip mustahkamlash (mexanizm 3, o'rta xavf, faqat catalog.js).**
  `assetflow-catalog.js`: download'ni atomik (temp→rename) + sha256 + progress hodisasi qilish;
  mavjud `execFileSync("unzip", ...)` (L515) ni saqlash, uzoq unzip uchun `spawn` opsiyasi.
  `host.jsx`ga tegmaydi — import kontrakti (`importAssetToProject`) o'zgarmaydi.

So'ng ixtiyoriy: PR-4 self-tag (mexanizm 5), PR-5 trim (7), PR-6 EG-params (8), PR-7 lokal
indeks cache (4). Har biri additiv.

---

## 5. Tasdiqlanmagan / jonli AE tekshiruvi kerak

1. **AE aniq joylash-nishoni resolyutsiyasi** (mexanizm 1) — `Editor.addPrecomp`/`addMogrt`
   tanlangan layer indeksiga, playhead'ga, yoki maxsus null/solid placeholder'ga
   joylashtiradimi? Logika kompilyatsiya qilingan C++'da (`CompImporter`, `MogrtInsertTask`),
   diskdan o'qib bo'lmaydi. **UNCONFIRMED** — jonli AE'da Add bosib, natijani kuzatish kerak.
2. **AE avto-masshtab qamrovi** — RIG ifodasi text-box autoscale uchun (manba-bounds).
   Oddiy footage/precomp import'da comp-rezolyutsiyaga fit ham qilinadimi (Premiere
   `scaleClipsToFit` ekvivalenti), yoki faqat ADBE Scale=100% (`ensureCorrectMogrtScale`
   naqshi)? Native, **UNCONFIRMED**.
3. **AE marker self-tag tafsiloti** — `zzzz..._ACPrecompMarker` parametri protected-region
   sifatida saqlanadimi (ExtendScript `MarkerValue`da bunday yashirin param API'si cheklangan).
   FrameFlow'da comment/label bilan almashtirsak yetarli, lekin aniq MH usuli **UNCONFIRMED**.
4. **AE EG-parametr chiqarish** — `addEssentialProperties` qaysi stream'larni avtomatik
   EG'ga chiqaradi (matn/rang/shrift) — native qaror. FrameFlow `comp.essentialProperty`
   API'si versiya-bog'liq (AE 15+); mavjud template'larimizda EG bo'l-bo'lmasligini jonli
   tekshirish kerak. **UNCONFIRMED**.
5. **Port-fayl naqshi FrameFlow'ga tegishli emas** — biz WebSocket ishlatmaymiz, lekin
   `api_<hash>` naqshi (host yo'lidan deterministik port) — agar kelajakda FrameFlow native
   yordamchi qo'shsa, foydali referens. Hozir **N/A**.

---

*Yozildi: 2026-07-07. Manba: MH kengaytmalarining STATIK (read-only) tahlili — kod
o'zgartirilmadi/ko'chirilmadi; faqat simvol nomlari dalil sifatida. FrameFlow ekvivalentlari
mavjud `host.jsx`/`assetflow-catalog.js`/`assetflow-plugin-disk-bridge.js` ustiga quriladi.*
