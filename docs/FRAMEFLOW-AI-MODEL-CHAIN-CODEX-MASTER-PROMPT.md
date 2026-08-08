# Codex master prompt — FrameFlow AI model zanjirini production darajada yakunlash

Quyidagi promptni yangi Codex taskiga **to'liq** bering. U audit natijalarini bajariladigan ishga
aylantiradi.

---

Sen `/Users/usmonov/Projects/creative-tools-saas` monorepoda ishlaysan. Vazifa — FrameFlow'ning
**web platformasi va bitta umumiy AE/Premiere CEP panelidagi AI generatsiya zanjirini to'liq
production-ready qilish**. Faqat UI maket emas: model katalogi, model sozlamalari, image reference,
video start/end frame, multimodal reference, upload/storage, quote/kredit, API submit, provider
adapter, polling/refund, session/history va AE/PR importgacha bitta isbotlangan zanjir bo'lsin.

## Mutlaq qoidalar

1. Avval root `AGENTS.md`, `HANDOFF.md`, `docs/PROJECT-STATUS.md` va
   `docs/FRAMEFLOW-AI-MODEL-CHAIN-AUDIT-2026-08-07.md`ni to'liq o'qi.
2. Joriy holat uchun haqiqat manbai: **kod + `docs/PROJECT-STATUS.md`**. Eski reja/audit
   hujjatlarini bajarilgan holat deb qabul qilma.
3. `_to_delete/` ichiga tegma. Dirty worktree'dagi foydalanuvchi o'zgarishlarini saqla.
4. Computer Use ishlatma. Adobe ilovalarini avtomatik ochma, yopma yoki restart qilma.
5. Commit, push, PR va deploy qilma. Real provider generation/kredit sarfini egadan aniq budjetli
   ruxsatsiz chaqirma. Read-only production health/models/quote mumkin; token va secretni logga
   chiqarmagin.
6. Pul zonasini ehtiyot qil: signed quote, server reprice, consume/refund, idempotency va ledger
   semantikasini buzma. Har o'zgarish test bilan isbotlansin.
7. AE va Premiere **bir xil CEP HTML/CSS/JS** ishlatishda davom etsin. Hostga xos farq faqat
   host bridge/import adapterda bo'lsin.
8. Platform source: `packages/assetflow-studio/platform/index.html` va `platform/ff-api.js`.
   CEP source: `plugins/after-effects-cep/`. API source: `apps/api/src/`.
9. Har diagnostika/fix yakunida `docs/SESSION-REPORT.md`ni almashtir; maksimum 15 qator.
10. Ishni chala "tayyor" deb aytma. External blocker bo'lsa aniq dalil, owner action va qolgan
    testni yoz.

## Boshlang'ich audit faktlari — qayta tekshir, taxmin qilma

- Lokal katalog: 51 entry, 24 enabled (op'lar bilan), 22 generativ model.
- Production snapshotda 19 generativ model; lokalga nisbatan 1020, 3004, 3005 yo'q.
- Production provider healthda Kling false bo'lgan, ammo 1030, 1031, 3008 katalogda ko'ringan va
  quote olgan. `/gen` ularni `AI_NOT_CONFIGURED` bilan rad etadi.
- `/gen/models` provider availability bilan filtrlanmaydi; `/gen/ops` esa filtrlanadi.
- `/gen` reference `hasRef` faqat `referenceUrl/referenceUrls`ni ko'radi; media arrays/end-frame
  yagona capability validationga kirmaydi.
- Unsupported `referenceEndUrl` jim ignor qilinishi mumkin.
- `boundedParams` faqat 16KB `z.record(z.any())`; model-aware schema emas.
- Web va CEP payload builderlari takrorlangan; CEP Create controller real composerni DOM click bilan
  delegatsiya qiladi.
- Mavjud quote matrix provider payload yoki real generationni isbotlamaydi.

## Ish tartibi

### 0. Baseline va inventar

1. `git status --short`, `git diff --check` va relevant diffni ko'r. Unrelated faylni o'zgartirma.
2. Quyidagi zanjir uchun inventory jadval yarat:
   `model id → mode → provider → feature → referenceMode/refMode/refKind → limits → settings →
   quote → processor runner → adapter endpoint → output type → web UI → CEP UI → AE/PR import`.
3. Har enabled model uchun default va max param qiymatlarini katalog metadata'dan chiqar.
4. Productionga read-only tekshiruv qil: web HTTP, `/gen/health`, `/gen/models`, `/gen/ops`, quote.
   Provider false bo'lib katalogda available turgan model bo'lsa test FAIL bo'lsin.
5. Lokal code catalog, DB-resolved production catalog va deploy/build fingerprint farqini yoz.

### 1. Yagona server-side model availability

1. `isProviderConfigured`ni alohida eksport qilinadigan, testlanadigan, **exhaustive fail-closed**
   funksiyaga aylantir. Noma'lum/undefined provider faqat aniq OpenRouter semantikasi bo'lsa
   OpenRouterga tushsin; yangi provider unutib qo'yilsa `false`/compile failure bo'lsin.
2. `/gen/models`, `/gen/ops`, `/gen/cost-quote` va `/gen` aynan bitta availability resolverdan
   foydalansin.
3. API model javobiga kamida quyidagilarni qo'sh:
   - `available: boolean`;
   - `unavailableCode/unavailableReason` (secret bermaydigan safe qiymat);
   - `catalogVersion` yoki deploy SHA/build fingerprint;
   - per-provider healthning safe summarysi.
4. UX qarori bitta bo'lsin: unavailable modelni yoki katalogdan yashir, yoki disabled karta va
   tushunarli sabab bilan ko'rsat. Tanlab Generate bosgandan keyin 503 ko'rish holati qolmasin.
5. Web va CEP aynan bir xil availability semantikasini ishlatsin. `configured`ni faqat OpenRouter
   bilan hisoblashni tugat.
6. DB `enabled:false`, provider unavailable va entitlement unavailable sabablarini aralashtirma.

### 2. Yagona canonical model-param/reference validator

API'da bitta pure/testable funksiya yarat (nomi loyiha konventsiyasiga mos bo'lsin):

```text
normalizeAndValidateGenParams(model, rawParams, context)
→ { ok, canonicalParams, pricedParams, referenceManifest, errors[] }
```

Uni **quote, preflight va gen** bir xil ishlatsin. Qoidalar:

1. Mode/modelga tegishli bo'lmagan unknown keylarni rad et yoki qat'iy canonical allow-list bilan
   olib tashla; jim providerga uzatma.
2. Image settings:
   - aspect, quality/resolution, count katalog optionlaridan bo'lsin;
   - count va quality narxi canonical qiymatdan hisoblansin;
   - `referenceMode:none` bo'lsa barcha image reference kanallari rad etilsin;
   - required model kamida bitta haqiqiy image reference talab qilsin;
   - `maxRefs`, format va hajm tekshirilsin.
3. Video settings:
   - aspect, resolution, duration, audio, bitrate katalog optionlaridan canonical bo'lsin;
   - start-frame required/optional metadata provider descriptor bilan izchil bo'lsin;
   - `referenceEndUrl` faqat `endFrame:true` bo'lsa qabul qilinsin;
   - end-frame har doim start-frame bilan bo'lsin;
   - unsupported end uchun kreditdan oldin `END_FRAME_NOT_SUPPORTED` qaytar;
   - `frames`, `media-refs`, `none` kanallari aralashmasi model capability bo'yicha tekshirilsin.
4. Multimodal refs:
   - `imageUrls`, `videoUrls`, `audioUrls`, `referenceUrl`, `referenceEndUrl`,
     `referenceUrls`, `savedReferenceIds`ning barchasi bitta reference manifestga tushsin;
   - modality va total limitlar serverda qat'iy tekshirilsin; `slice()` bilan jim tashlash bo'lmasin;
   - model format/hajm va total-hajm limitlari SavedReference metadata yoki storage metadata orqali
     kreditdan oldin tekshirilsin;
   - audio-only kombinatsiya provider tomonidan qo'llanmasa oldindan aniq xato qaytarsin;
   - duplicate URL/ID canonical dedupe qilinsin, tartib (`@img1` va provider index) saqlansin.
5. Ownership:
   - `savedReferenceIds`ning hammasi shu userga tegishli va mavjud bo'lishi shart;
   - FrameFlow storage URL'i bo'lsa user-prefix/DB ownership tekshirilsin;
   - external URL qo'llab-quvvatlanadimi — aniq policy yoz. Qo'llanmasa rad et; qo'llansa SSRF,
     privacy va provider-fetch risklarini test qil.
6. Quote va gen bir xil canonical paramsdan hash/narx chiqarsin. Narxga ta'sir qilmaydigan reference
   ma'lumotlarini alohida `referenceManifestHash` yoki hujjatlangan unpriced qismga ajrat; scalar va
   multimodal ref kanallari asimmetrik bo'lmasin.
7. Reference yoki capability xatosi quote bosqichidayoq chiqsin; quote PASS → shu canonical payload
   uchun gen pre-credit validation PASS degan invariant bo'lsin.

### 3. Model katalog validatorini kengaytir

`gen-models-validate.ts`ga har enabled model uchun quyidagi invariantlarni qo'sh:

- provider switch va processor dispatch branch mavjud;
- `referenceMode`, `refMode`, `refKind`, `inputs`, `maxRefs`, `mediaRefs` o'zaro izchil;
- required start/reference UI metadata va provider descriptor bilan izchil;
- `endFrame:true` faqat adapter inputida end-frame kaliti/branch mavjud bo'lsa;
- `mediaRefs.total` modality limitlariga mantiqan mos;
- default va max settings canonical validatsiyadan o'tadi;
- no-reference, one-reference, max-reference va mixed-reference payload dry-run o'tadi;
- unsupported reference, end-without-start, unsupported-end, over-limit, wrong-format negative
  dry-run aniq expected code bilan yiqiladi;
- narx 0/NaN/negative bo'lmaydi va quote canonical params bilan bir xil hisoblanadi.

Startup/build bironta enabled model chala bo'lsa fail qilsin.

### 4. Web va CEP payload parity

1. Actual web builder va actual CEP builderni pure/testable funksiyalarga ajrat. UI DOM clicklari
   payload mantiqining yagona yo'li bo'lmasin.
2. CEP yangi Create workspace va mavjud session composer **bitta generation command pipeline**
   ishlatsin. Hidden/legacy UI'ni programmatik bosish o'rniga draft/state canonical commandga
   berilsin. UI ko'rinishi va session UX regress qilmasin.
3. Web va CEP API'dan kelgan metadata bilan ishlasin; model nomi bo'yicha hardcode qilma.
4. Bitta fixture fayli/matrix bilan har enabled model uchun quyidagilarni solishtir:
   - web canonical params;
   - CEP canonical params;
   - API normalized params;
   - expected provider payloadning capability-relevant qismi.
5. Testlar Image, Video, Voiceover, SFX va quyidagi reference holatlarni qamrasin:
   - no ref;
   - single/multi image ref;
   - start only;
   - start + end;
   - media image/video/audio;
   - max limits;
   - old session rehydrate;
   - disabled/disappeared model fallback;
   - sessiondan boshqa mode/modelga o'tish;
   - stale quote va reference quote'dan keyin o'zgargan holat.
6. Web va CEP bir xil error code → bir xil tushunarli UX mapping ishlatsin.

### 5. Provider payload contractlari

Har enabled provider/model oilasi uchun adapter test yoz; real kredit sarflamaydigan mocked HTTP
transport ishlat:

- Vertex Image: text-to-image va image-edit/multi-ref.
- Vertex Video: text-to-video, start, start+end, audio flag.
- Vertex Omni: multimodal image/video/audio.
- BytePlus Image: optional multi-image refs va mention index.
- BytePlus Video: required frame, optional media refs, start+end, mention offset, audio rule.
- Kling Image/Video/Omni: provider configured/unconfigured, frames/media refs.
- fal Image/Video/reference-to-video va op'lar.
- Google TTS voice validation/maxChars.
- ElevenLabs SFX duration.
- Topaz source ownership/canonical derived pricing.

Adapter request body/endpoint snapshotlari provider schema bilan tekshirilsin. Provider response:
success, rejection, rate limit, timeout, restart-resume, malformed output va download failure
holatlari refund/status invariantlari bilan test qilinsin.

### 6. Session, history va reference lifecycle

1. Yangi va eski sessionda prompt chat/composer doim mavjud bo'lsin; session ochilganda prompt,
   model, settings va refs to'g'ri rehydrate bo'lsin.
2. Signed reference URL eskirganda DB/R2 keydan qayta imzolanishini test qil.
3. Saved reference gen bilan bog'langach TTL cleanup uni o'chirmasin; gen o'chirilganda orphan
   obyektlar tozalansin.
4. Account A refs/sessionlari Account B'ga o'tmasin; web va CEP logout/token-expiryda polling,
   refs, projects, active jobs va caches tozalansin.
5. Stale/invalid token cold boot testi qo'sh: sessiya jimgina tozalanadi, login ekrani ishlaydi,
   yangi login bilan model/credits/history qayta yuklanadi; secret logga chiqmaydi.

### 7. Natija va Adobe import zanjiri

1. Image/video/audio result type, extension, MIME, R2 key, poster/thumb va signed URL izchil bo'lsin.
2. CEP result `Use/Import` amallari AE va Premiere uchun bir xil UI'da, host adapter orqali ishlasin.
3. Premiere: Project import, active sequence/timeline insert, frame export/reference va xato mapping.
4. AE: Project import, comp/layer/timeline qo'shish va mavjud regressiya testlari.
5. Importdan oldin fayl mavjudligi, MIME/extension va writable system path tekshirilsin.
6. Adobe'ni avtomatik ochmasdan host mock/integration testlarni kengaytir. Real Adobe smoke tashqi
   talab bo'lsa, aniq qo'lda checklist yoz va uni avtomatik PASS deb ko'rsatma.

### 8. Release/drift observability

1. Safe diagnostics endpoint/reportda deploy SHA, catalog version, DB override count, enabled,
   available, unavailable va provider status bo'lsin; secret yo'q.
2. CI/read-only production audit quyidagida non-zero chiqsin:
   - available model provider false;
   - local/deployed catalog kutilmagan drift;
   - quote canonical validationdan o'tmaydi;
   - web/CEP/API fixture parity farqi;
   - enabled model adapter contracti yo'q.
3. `scripts/verify-gen-payloads.mjs`ni duplicate "o'xshash builder" emas, actual exported builder/
   canonical fixtures bilan ishlat. Quote PASSni generation PASS deb atama.

## Majburiy testlar

Kamida quyidagilarni ishlat va natijani yoz:

```bash
npm run build -w @creative-tools/api
npm run test:pricing -w @creative-tools/api
node apps/api/scripts/test-upload-limits.mjs
node apps/api/scripts/test-public-keys.mjs
node scripts/verify-public-copy.mjs
npm run test:plugin-create
npm run test:plugin-responsive
node plugins/after-effects-cep/scripts/test-premiere-cep-host.mjs
node plugins/after-effects-cep/scripts/test-premiere-cep-integration.mjs
npm run test:plugin-package
git diff --check
```

Bundan tashqari yangi testlar:

1. `all-enabled-model-contract` — har model default/max/negative/reference matrix.
2. `provider-availability-contract` — katalog/quote/gen bir xil truth.
3. `web-cep-api-payload-parity` — actual builders + API canonicalizer.
4. `reference-security-lifecycle` — ownership/TTL/signed URL/type/size/count.
5. `quote-gen-invariant` — quote o'tgan canonical payload genning pre-credit qismidan o'tadi.
6. `provider-adapter-contract` — mocked endpoints/bodies/responses.
7. Read-only production smoke — health/models/ops/quote; generation yo'q.

Salbiy testlar guard haqiqatan ushlashini isbotlasin. Masalan unavailable Kling fixture katalogda
selectable bo'lmasin; unsupported end-frame `END_FRAME_NOT_SUPPORTED`; media limit +1 aniq 400;
boshqa user savedReference ID 403/404; quote'dan keyin priced param o'zgarsa `BAD_QUOTE`.

## Lokal o'rnatma va paket

Kod/testlar yashil bo'lgach:

1. `bash plugins/after-effects-cep/scripts/install-cep.sh` bilan CEP'ni qayta o'rnat.
2. Source va installed runtime fayllarni byte/hash bilan solishtir; installer build stamp farqi
   expected ekanini alohida ko'rsat.
3. AE va Premiere'ni avtomatik restart qilma.
4. Unsigned lokal paketni qayta build/verify qil; signing yoki Marketplace approvalni soxta PASS qilma.

## Definition of Done

Task faqat quyidagilarning hammasi bajarilganda tugaydi:

- provider unavailable model web/CEP'da selectable emas;
- quote va gen bitta canonical availability/param/reference validator ishlatadi;
- reference/start/end/media qoidalari serverda kreditdan oldin qat'iy;
- ortiqcha/unsupported reference jim ignor qilinmaydi;
- barcha enabled model uchun provider adapter contract testi bor;
- actual web va CEP payloadlari API canonical payload bilan fixture matrixda teng;
- yangi va eski sessionlar prompt/model/settings/refsni to'g'ri tiklaydi;
- auth expiry/account isolation ishlaydi;
- AE/PR shared UI saqlangan, host import testlari yashil;
- barcha eski va yangi testlar PASS, `git diff --check` toza;
- production read-only auditda `available model ↔ configured provider` ziddiyati yo'q;
- real kredit sarflanmagan (yoki egasi aniq tasdiqlagan canary budjeti va natijasi yozilgan);
- `docs/PROJECT-STATUS.md` joriy kod holatiga yangilangan;
- `docs/SESSION-REPORT.md` maksimum 15 qatorli yakuniy hisobot;
- yakuniy javobda o'zgargan fayllar, testlar, o'rnatma va haqiqiy tashqi blockerlar aniq yozilgan.

Chala qism qolsa "to'liq tugadi" demagin. Kod bilan tuzatish mumkin bo'lgan ishni hujjatga TODO
qilib tashlab ketma; tashqi credential/provider/Adobe manual smoke blockerigina owner action bo'lsin.

---

