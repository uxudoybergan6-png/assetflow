# FrameFlow Premiere CEP — production audit (2026-08-04)

> Scope: `plugins/after-effects-cep/` dagi AEFT + PPRO dual-host CEP 1.2.0,
> umumiy katalog/AI/publish UI, Premiere ExtendScript adapteri, API host kanali,
> storage va release paketi. Bu audit statik kod, mavjud avtomatik testlar va
> Premiere scripting kontrakti asosida bajarildi. Computer Use ishlatilmadi.

## 1. Yakuniy hukm

Arxitektura yo'nalishi to'g'ri: Premiere UXP repaint/CSS porti o'rniga AE bilan bir xil
`AssetFlow_Plugin.html` va CSS'ni CEP ichida ishlatish UI parity uchun eng qisqa yo'l.
Lekin **joriy 1.2.0 production-ready emas**. Mavjud `18 checks passed` testi faqat
adapter funksiyalarini mock muhitda chaqiradi; panel → download/extract → host →
Premiere zanjirini tekshirmaydi va asosiy P0 uzilishlarini yashiradi.

Qabul holati:

- UI renderer/parity arxitekturasi: **PASS (kodda bitta manba)**.
- Auth, API, Sessions/Projects va writable data arxitekturasi: **PASS, host metadata qarzi bor**.
- MOGRT timeline import: **FAIL — panel MOGRT'ni hostgacha `.aep`ga aylantiradi**.
- `.prproj` import: **FAIL — ZIP tanimaydi, to'g'ridan yo'l media import API'sini ishlatadi**.
- Media/AI result import: **PARTIAL — adapter bor, vaqt/track kontrakti jonli isbotlanmagan**.
- Remove from project: **FAIL — UI chaqiradi, Premiere adapterida funksiya yo'q**.
- Premiere-native copy/UX: **FAIL — ko'p user-facing matnlar AE/comp/restart AE deydi**.
- Publish from Premiere: **FAIL/PARTIAL — active frame, saved-state va Windows ZIP muammolari**.
- Package strukturasi: **PASS (unsigned QA); signed release yo'q**.
- Premiere ichidagi real smoke: **NOT TESTED — foydalanuvchi Computer Use'ni taqiqlagan**.

## 2. Tasdiqlangan kuchli tomonlar

1. `CSXS/manifest.xml` bitta panelni `AEFT + PPRO` hostlariga e'lon qiladi va
   `jsx/host-bootstrap.jsx` hostga qarab `host.jsx` yoki `host-premiere.jsx` yuklaydi.
2. HTML/CSS/network/auth/AI/Sessions/Projects kodi bitta fayl zanjiri; UXP `ported/`
   daraxti runtime manba emas. Shu sabab UXP'dagi oval/hourglass repaint nuqsoni CEP'ga
   ko'chirilmaydi.
3. Katalog va featured so'rovlari `app=ae|pr` yuboradi; API app-neutral stockni ham
   qabul qiladi.
4. Contributor Studio Premiere uchun `.mogrt`, `.prproj`, `.zip` qabul qiladi;
   server storage `.prproj`ni taniydi.
5. `assetflow-local-store.js` yozuvlarni extension papkasiga emas,
   `AssetFlowSecret.settingsDir()/assetflow-data` ga saqlaydi va legacy datani
   overwrite qilmasdan migratsiya qiladi.
6. Customer paket admin kodini chiqarmaydi; package-security 59/59, marketplace QA
   preflight 67/67 va responsive kontrakt PASS.
7. Premiere adapter media, bundle, Project/Timeline reference, in/out va frame eksport
   uchun boshlang'ich ko'prik beradi.

## 3. P0 — relizni bloklaydigan topilmalar

### P0.1 — MOGRT paneldan Premiere'ga MOGRT bo'lib bormaydi

Dalil:

- `assetflow-catalog.js:771` `extractMogrtFileToAep()` yaratadi.
- `extractMogrtItem()` shu funksiyani qaytaradi.
- `downloadSceneMogrt()` yuklangan `.mogrt`ni `.aep`ga aylantiradi.
- `downloadPackToTemp()` ZIP ichidagi bitta `.mogrt`ni ham `.aep`ga aylantiradi.
- `AssetFlow_Plugin.html:5814-5828` qaytgan yo'lni `importSingleSceneFromAep()`ga beradi.

Natija: `host-premiere.jsx`dagi `ffPrImportMogrt()` kodi real katalog oqimida deyarli
yetib kelmaydi. Test esa `importTemplateProject('/tmp/template.mogrt')`ni to'g'ridan
chaqirib, aynan transport qatlamidagi xatoni chetlab o'tadi.

Talab: host-aware pack resolver. AEFT uchun hozirgi MOGRT→AEP yo'li saqlansin;
PPRO uchun `.mogrt` native fayl yo'li saqlansin. ZIP ichidagi 1/ko'p MOGRT ham native
yo'llar bilan picker/timeline oqimiga kirsin.

### P0.2 — `Sequence.importMGT()` vaqt parametri noto'g'ri

`host-premiere.jsx:153` `seq.importMGT(f.fsName, pos, 0, 0)` deb `Time` obyektini
uzatadi. Premiere scripting kontrakti `time` uchun **ticks string** talab qiladi.
To'g'ri kandidat: `String(seq.getPlayerPosition().ticks)`; bu real Premiere probe bilan
tasdiqlanishi shart.

### P0.3 — `.prproj` zanjiri to'liq emas

- ZIP parser faqat `.aep` va `.mogrt` qidiradi; `.prproj`li ZIP invalid yoki footage
  bundle sifatida noto'g'ri talqin qilinadi.
- To'g'ridan `.prproj` `ffPrImportOne()` → `Project.importFiles()`ga tushadi.
  Rasmiy kontraktda `importFiles()` media uchun, loyiha sequence importi uchun esa
  `Project.importSequences(path, sequenceIDs)` berilgan.
- Sequence ID'larni qanday olish, qaysilarini tanlash va konflikt nomlari bo'yicha
  halol UX yo'q.

Talab: avval mini-probe. Ishonchli sequence import qurilsa — tanlash dialogi + target
bin + konflikt siyosati. API yetarli bo'lmasa — `.prproj`ni yuklab, Finder/Explorer'da
ochish va aniq manual import ko'rsatmasi; hech qachon soxta success emas.

### P0.4 — “Remove from project” Premiere'da yo'q

`AssetFlow_Plugin.html:7242` `removeImportedTemplate()`ni chaqiradi, lekin
`host-premiere.jsx` bu funksiyani e'lon qilmaydi. Bundan tashqari Premiere import
javoblari barqaror item/node ID qaytarmaydi (`folderId:0`), shuning uchun aniq rollback
ham qurilmagan.

Talab: har import natijasida barqaror ProjectItem/node ID'lar va yaratilgan timeline
item izi qaytsin; delete faqat FrameFlow yaratgan aniq ID'larni olib tashlasin. Nom
bo'yicha keng o'chirish taqiqlanadi.

### P0.5 — avtomatik test production zanjirini isbotlamaydi

`test-premiere-cep-host.mjs`ning mock'i:

- MOGRT'ni panel transportisiz adapterga bevosita beradi;
- `importMGT()` Time obyektini qabul qiladigan soxta implementatsiya ishlatadi;
- `.prproj`, ZIP, multi-MOGRT, delete/rollback, app analytics va host copy'ni tekshirmaydi;
- Premiere ExtendScript/CEP runtime'ini ishga tushirmaydi.

Talab: pure contract test + fixture ZIP test + host-call parity scanner + qo'lda Premiere
smoke checklist. “18/18 PASS” yakuniy DoD bo'la olmaydi.

### P0.6 — CEP support muddati release riskidir

Adobe Premiere sahifasi CEP panel qurishni hanuz ko'rsatadi, lekin Premiere scripting
qo'llanmasi ExtendScript integratsiyalari 2026-yil sentabrgacha qo'llab-quvvatlanishini
aytadi. Hozirgi sana 2026-08-04: CEP qisqa muddatli production yo'li sifatida ishlatilishi
mumkin, lekin uzoq muddatli qo'llab-quvvatlash kafolati deb sotilmasin.

Talab: README/listing/QA matrixda aniq supported Premiere versiyalari; CEP sunset
riski va keyingi migratsiya yo'nalishi alohida yozilsin. Bu audit UXP'ga hozir qaytishni
buyurmaydi; avval CEP parityni ishlaydigan holga keltiradi.

## 4. P1 — katta funksional va UX topilmalari

### P1.1 — oddiy media timeline insert kontrakti zaif

`ffPrImportOne()` `track.insertClip(item, pos)` chaqiradi. Rasmiy Track kontrakti
ticks string va video/audio track indekslarini ko'rsatadi. Mock test ikki argumentli
chaqiruvni ataylab qabul qiladi. Real host uchun `Sequence.insertClip` yoki to'liq
Track signaturasi tanlanib, video-only/audio-only/AV kliplar alohida sinovdan o'tsin.

### P1.2 — track/undo/conflict siyosati yo'q

MOGRT doim `0,0`, media doim birinchi trackka tushadi. Locked/targeted track, mavjud
klipni surish/ustiga tushish, audio-video routing, bir undo qadam va partial failure
aniqlanmagan. Success `clip !== false`ga tenglashtirilgan.

### P1.3 — host analytics uzatilmaydi

- Catalog/featured `app=pr` yuboradi — yaxshi.
- `/usage/download` va `/usage/import` body/headerda `app`/`X-FF-App` yo'q.
- pack/mogrt download headerlarida ham `X-FF-App` yo'q.
- `/api/plugin/version` so'rovida `app=pr` yo'q, shuning uchun Premiere AE release
  kanalini olishi mumkin.
- heartbeat `aeVersion:'After Effects'` yuboradi.
- log source `ae_plugin`, “AE Browse panel loaded” hardcoded.

Talab: bitta `AF_TEMPLATE_APP`/host header helper barcha katalog, usage, download,
heartbeat, log va updater chaqiruvlariga tatbiq qilinsin. Server limit/pul matematikasi
o'zgarmaydi; bu faqat routing va analytics.

### P1.4 — Premiere UI semantikasi AE bo'lib qolgan

Shared renderer vizual parity beradi, lekin matn parity emas. User-facing misollar:

- `<title>FrameFlow — After Effects`;
- “Make After Effects move faster”;
- “After Effects template”, “composition”, “Comp/Bin”;
- “Items from the AE project”, “AE Project items”;
- “Import to AE”, “AE import”;
- “Only works inside After Effects”;
- update modal “restart After Effects”;
- error/toastlarda “AE did not respond”, “Error removing from AE”.

Talab: bitta host-copy dictionary (`project`, `timeline`, `sequence`, restart matni,
import CTA) va DOM boot patch yoki template helper. AE ko'rinishi/matni regressiyasiz,
Premiere'da user-facing `After Effects`, `AE Project`, `composition`, `Comp` qolmasin
(faqat Adobe mahsulot taksonomiyasi yoki AE-format tushuntirishi bo'lsa ruxsat).

### P1.5 — Publisher Premiere parity emas

- `refreshProjectPanel()` `p.path || p.documentID`ni `projectFile` deb oladi; unsaved
  document ID disk yo'li emas, ammo `saved:true` bo'lishi mumkin.
- barcha sequence'lar sun'iy “Sequences” papkasiga yoziladi; real bin hierarchy yo'q.
- `renderSceneStillFrames(cfg)` cfg/selected sequence'larni e'tiborsiz qoldirib, faqat
  aktiv CTI frame'ini bir marta eksport qiladi; width/height/fps/duration = 0.
- `buildPackZip()` system `zip` CLI'ga bog'liq; Windows'da kafolatlanmagan.
- `.prproj` pack nomi/metadata va preview-per-sequence kontrakti aniq emas.

Talab: yoki Premiere Publisher to'liq production parity bilan qurilsin, yoki PPRO'da
UI yashirilib Studio'ga yo'naltirilsin. Yarim ishlaydigan Publish ko'rsatilmasin.

### P1.6 — storage event target faqat AEFT

`assetflow-local-store.js:96` `CSEvent(..., 'AEFT')` yuboradi. Bir vaqtda AE+PR panel
ochiq bo'lsa Premiere disk meta yangilanishini darhol olmasligi mumkin. Target host-aware
bo'lsin yoki ikkala hostga xavfsiz dispatch qilinsin. Fayl lock va atomik write saqlansin.

## 5. P2 — barqarorlik, xavfsizlik va release qarzlari

1. `exportTimelineFrame()` hujjatlashtirilmagan QE DOM'ga tayanadi. QE yo'q/format xato
   holatida aniq fallback va capability result bo'lsin; “ok” taxmin qilinmasin.
2. Har import yangi `FrameFlow` bin yaratadi; reuse/dedup siyosati yo'q.
3. `ffPrWalk()` nodeId bo'lmasa nomni `seen` kaliti qiladi; bir xil nomli assetlardan
   biri yo'qolishi mumkin.
4. `importFootageBundle()` faqat `importFiles !== false`ni tekshiradi; qaysi fayl real
   import bo'lganini ID bilan qaytarmaydi.
5. Keychain service nomi “FrameFlow AE Plugin”. Umumiy token ataylab bo'lsa nom
   host-neutral qilinsin va backward-compatible migratsiya bo'lsin.
6. `plugins/after-effects-cep/package.json` versiyasi 0.1.0, bundle/UI esa 1.2.0.
   Release metadatasi bitta manbaga keltirilsin.
7. Unsigned ZIP/PKG QA artefakti tarqatiladigan signed release emas. Adobe/Apple/Windows
   imzo kredensiallari bo'lmasa bu ochiq yozilsin.
8. Marketplace preflight dinamik bootstrap sabab `host.jsx`/`host-premiere.jsx`ni
   “runtime referensi yo'q” deb info beradi; package list ularni kiritsa ham bootstrap
   dependency test bilan aniq mahkamlanishi kerak.

## 6. Kerakli test va isbot matritsasi

### Avtomatik (Computer Usesiz)

1. AEFT/PPRO bootstrap selection unit test.
2. Host-call inventory: shared UI chaqirgan har funksiya ikkala adapterda mavjud yoki
   host capability bilan UI'da o'chirilgan.
3. Fixture pack resolver:
   - AEFT: `.mogrt` → `.aep`;
   - PPRO: `.mogrt` → `.mogrt`;
   - PPRO ZIP: 1 MOGRT, ko'p MOGRT, `.prproj`, footage-only;
   - traversal/corrupt/empty ZIP fail-closed.
4. `importMGT` ticks-string va media insert signature testlari real API kontraktiga mos.
5. PPRO'da updater/usage/download/heartbeat/log `app=pr` yoki `X-FF-App: pr` yuboradi.
6. User-facing host-copy scanner (PPRO copy render snapshotida AE-only iboralar yo'q).
7. Delete/rollback ID-only kontrakti va nom bo'yicha begona item o'chmasligi.
8. Windows-safe ZIP publisher yoki PPRO Publisher capability gate.
9. Package-security, marketplace preflight, responsive, updater security va API build.
10. AE regression: MOGRT→AEP, template import, AI import, publisher va `?app=ae` saqlanadi.

### Qo'lda Premiere (foydalanuvchi bajaradi)

Computer Use taqiqlangan. Codex ilovani bosmaydi, ochmaydi/yopmaydi va UI screenshot
olmaydi. Codex aniq checklist va diagnostika buyruqlarini beradi; foydalanuvchi natija,
log yoki screenshotni qaytaradi.

Majburiy smoke:

1. Restart → Window → Extensions → FrameFlow; UXP Plugins ostida FrameFlow yo'q.
2. Login saqlanishi; AE bilan bitta account/session zanjiri.
3. Home, Catalog, AI Tools, Sessions, Projects va Settings resize 320/380/600px.
4. Native PR `.mogrt` → CTI playhead, aniq track, bitta undo.
5. `.prproj` → real sequence import yoki halol documented fallback.
6. Video/image/audio/SFX/LUT import; cancel va network error.
7. AI image/video/audio generate → gallery → Project/Timeline import.
8. File, Project item, Timeline clip va current-frame reference.
9. Downloaded item remove faqat FrameFlow yaratgan itemlarni o'chiradi.
10. Update check PR kanalini ko'radi; copy Premiere Pro deydi.
11. Premiere restartdan keyin token, favorites, Sessions va Projects saqlanadi.
12. AE parallel smoke: login/catalog/AI/import buzilmagan.

## 7. Definition of Done

“Tayyor” faqat quyidagida aytiladi:

- P0 topilmalar yopilgan va yangi regressiya testlari qizil→yashil isbotlangan;
- P1 host copy/analytics/publisher qarorlari yopilgan;
- barcha avtomatik testlar PASS;
- foydalanuvchi qo'lda Premiere smoke checklistni tasdiqlagan;
- AE smoke regressiyasiz;
- signed release bo'lmasa “unsigned QA only” deb aniq yozilgan;
- `docs/PROJECT-STATUS.md` va `docs/SESSION-REPORT.md` haqiqatga mos.

## 8. Rasmiy API manbalari

- Premiere developer portal (CEP va UXP yo'llari):
  https://developer.adobe.com/premiere-pro/
- Premiere ExtendScript support holati:
  https://ppro-scripting.docsforadobe.dev/
- `Project.importFiles()` va `Project.importSequences()`:
  https://ppro-scripting.docsforadobe.dev/general/project/
- `Sequence.importMGT()` va `getPlayerPosition()`:
  https://ppro-scripting.docsforadobe.dev/sequence/sequence/
- `Track.insertClip()`:
  https://ppro-scripting.docsforadobe.dev/sequence/track/

