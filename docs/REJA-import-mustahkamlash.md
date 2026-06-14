# REJA — AE import'ni mustahkamlash (Higgsfield tahlilidan)

**Holat:** tahlil + reja. KOD YOZILMAGAN. Tasdiqdan keyin qo'llanadi.
**Manba:** `/Library/Application Support/Adobe/CEP/extensions/ai.higgsfield.cep/jsx/index.js` (92KB, o'qildi).
**Sana:** 2026-06-15

---

## 0) Eng muhim ogohlantirish

Higgsfield jsx **PPRO + AEFT** ikkalasiga (manifest `HostList`). Fayl ikkala host API'sini
bundle qiladi va `getAppNameSafely()` orqali dispatch: `host["ai.higgsfield.cep"] = aeft|ppro`.

- **Yuqoridagi live-link funksiyalar (qator 53–487) — PREMIERE** (`sequence`, `trackItem`,
  `projectItem`, `importFiles`). AE'ga **ko'chmaydi**.
- **Bizga kerakli AEFT branch** (qator ~1499–2664): `CompItem`, `layers`, `ImportOptions`,
  `FootageItem`, `renderQueue`. Faqat shuni o'rganamiz.

---

## 1) Higgsfield AE import nega ishonchli

### a) Core: `importFootageFromPath` (q.2026)
```
File(mediaPath).exists  → tekshiradi
new ImportOptions(file)
if (io.canImportAs(ImportAsType.FOOTAGE)) io.importAs = ImportAsType.FOOTAGE;   // ← GUARD
app.project.importFile(io)
return { ok, reason, item }
```
**Kalit:** `canImportAs(FOOTAGE)` guard — AE format'ni qabul qila olishini OLDIN tekshiradi,
keyin import qiladi. Bizning `importAssetToProject` bu guard'siz (`importAs` umuman o'rnatilmaydi).

### b) "Input doesn't seem to be a PNG" ning ASL sababi
UI bundle (`main-*.cjs`) faylni **content-type bo'yicha** saqlaydi: bundle ichida
`image/png`, `image/jpeg`, `image/webp`, `video/mp4`, `audio/mpeg`, `audio/wav` + `getExtension`/
`fileExtension`/`contentType` (22 marta) mavjud. Ya'ni javob JPEG bo'lsa `.jpg`, PNG bo'lsa `.png`.
AE hech qachon "`.png` deb nomlangan, aslida JPEG" faylni ko'rmaydi → libpng xatosi chiqmaydi.

> **Bizdagi bug:** `aiImportResult` hardcoded `ext='.png'`; backend ham DOIM `ai/img/.../<ts>.png`
> + `image/png` (flux aslida JPEG qaytarishi mumkin). Mos kelmaslik → "Input doesn't seem to be a PNG".

### c) Structured natija + undo + papka
- Har funksiya `{ ok, reason, ... }` qaytaradi → UI aniq sabab ko'rsatadi.
- `beginUndoGroup` / `endUndoGroup` (finally) bilan o'ralgan.
- `getOrCreateHiggsfieldFolder` — natijalar alohida Project papkaga (tartib).
- Destination routing: `insertionBin | selectedFolder | higgsfieldBin | activeSequence |
  replaceSelectedLayer`. `activeSequence` → `addItemToActiveComp`: `layer.startTime =
  activeComp.time` (playhead'ga), `isItemAddableToComp` (hasVideo||hasAudio) guard bilan.

## 2) Timeline live-link (AEFT)

- `getActiveTimelineVideoReference()` (q.1843) → active comp → tanlangan AV layer manbasining
  **fayl yo'li** (`getMediaPathFromItem`: `FootageItem.mainSource.file.fsName`) + `mediaType`.
- `getActiveTimelineClipDetails()` (q.1964) → tanlangan layer'ning **trim oralig'i** (in/out
  comp vaqtini source vaqtiga aylantiradi; stretch va timeRemap hisobga olinadi).
- `exportSourceRangeToTempFile(src,in,out,preset,out)` (q.2569) → **render-asosli trim**:
  vaqtinchalik trim comp → renderQueue.items.add → H.264 output template (`trim.epr`) →
  temp .mp4 ga render → yo'l qaytaradi. Mavjud RQ item'larni suspend/restore qiladi,
  dialoglarni bostiradi, finally'da tozalaydi.
- Ya'ni "Timeline'dan" = tanlangan klipni **AI uchun INPUT** sifatida olish (reference yoki
  trim-eksport), katalog import EMAS.

## 3) AssetFlow'da hozirgi holat (taqqoslash)

| Joy | Higgsfield | AssetFlow (hozir) |
|---|---|---|
| Import opt | `canImportAs(FOOTAGE)` guard + `importAs` | guard yo'q, `importAs` o'rnatilmaydi |
| Fayl ext | content-type'dan | **hardcoded `.png`/`.mp3`** ← bug |
| Backend ext | (server real format) | DOIM `.png` + `image/png` |
| Natija | `{ok,reason}` struct | `"ok:"/"error:"` string |
| Comp'ga qo'shish | playhead'da layer | yo'q (faqat Project import) |
| Timeline'dan | reference + trim render | "tez orada" |

---

## REJA (tasdiqdan keyin)

### A. Backend — real format aniqlash (`apps/api`)
- `workers-ai.ts`/`ai.ts`: image buffer magic-bytes bilan format aniqlash
  (PNG `89504E47`, JPEG `FFD8FF`, WebP `RIFF…WEBP`, GIF) → to'g'ri kengaytma + content-type bilan
  R2'ga yozish (`.png`/`.jpg`/`.webp`). Audio: mp3 (`ID3`/`FFFB`) vs wav (`RIFF…WAVE`).
- Javobga `contentType` + `ext` qo'shish → frontend to'g'ri nomlaydi.

### B. host.jsx `importMediaFromPath` — mustahkamlash (Higgsfield naqshi)
- File exists → `new ImportOptions(file)` → **`if(io.canImportAs(ImportAsType.FOOTAGE)) io.importAs=FOOTAGE`** → `importFile`.
- "AssetFlow AI" papkasiga joylash (getOrCreate), undo group (finally).
- Ixtiyoriy: active comp bo'lsa playhead'ga layer qo'shish (`isItemAddableToComp` guard).
- Hozirgi `"ok:"/"error:"` kontraktini saqlash (frontend o'zgarmasin) yoki JSON'ga o'tish.

### C. Frontend `aiDownloadToTemp` — ext'ni real formatdan
- Backend bergan `ext`/`contentType`'dan temp fayl nomi (hardcoded EMAS). `data:` uchun
  `data:<mime>;base64,` dan mime ajratish. Zaxira: yuklab olgach magic-byte sniff → kerak bo'lsa rename.

### D. "Timeline'dan import" — Higgsfield naqshi bilan ("tez orada" o'rniga)
- **MVP:** AE jsx `getActiveTimelineVideoReference()` (faqat AEFT branch) → tanlangan layer
  manbasining yo'li+nomi → composer'da "reference" sifatida ko'rsatish (AI input).
- **2-faza:** `exportSourceRangeToTempFile` (trim render) — H.264 output template kerak;
  AE template mavjudligi har xil → fallback kerak (og'irroq, keyinroq).

### Ustuvorlik
1. **B + C + A (format)** — "PNG xatosi" yo'qoladi, import ishonchli (past risk, yuqori qiymat).
2. **D-MVP** — Timeline reference (o'rta).
3. **D-2faza** — trim render eksport (yuqori, keyin).

> Eslatma: bizning maqsad **AI natijani AE'ga import** (Higgsfield ham shu). Trim-eksport
> faqat "tanlangan klipni AI'ga yuborish" kerak bo'lsa zarur — hozircha 2-fazaga.
