# FrameFlow AI model zanjiri — katta audit

> Sana: 2026-08-07  
> Scope: Web platforma + bitta umumiy AE/PR CEP panel + Studio Gen API + model katalogi +
> reference/start/end frame + quote/kredit + provider adapter + session/history + host import.  
> Usul: kod auditi, lokal avtomatik testlar va production'ga faqat o'qish/quote so'rovlari.
> Real generatsiya chaqirilmadi va kredit sarflanmadi.

## Qisqa hukm

Asosiy generatsiya zanjiri mavjud va ko'p himoya qatlamlari to'g'ri ishlaydi, lekin uni hozircha
"barcha model va barcha reference kombinatsiyasi production-ready" deb bo'lmaydi. Eng katta
muammo — model katalogi provider mavjudligini hisobga olmaydi: production'da Kling provider
sozlanmagan bo'lsa ham Kling modellari UI'ga chiqadi, quote oladi va faqat Generate bosilganda
`AI_NOT_CONFIGURED` bilan to'xtaydi. Kredit yechilmaydi, ammo foydalanuvchi uchun model o'lik.

Ikkinchi katta muammo — API reference qoidalarining yagona, model-aware validatori yo'q.
Klientlar start/end va media-reference qoidalarini yaxshi ushlaydi, lekin server faqat
`referenceUrl`/`referenceUrls`ning bir qismini tekshiradi. `imageUrls`, `videoUrls`, `audioUrls`,
unsupported end-frame, limit va formatlar markaziy tarzda kreditdan oldin qat'iy tekshirilmaydi.

## Tekshirilgan haqiqiy zanjir

```text
Web platforma ─┐
               ├─ model metadata → params → cost-quote → preflight → /gen → job polling
AE/PR CEP ─────┘                                      │
                                                      ├─ Vertex / BytePlus / Kling / fal
                                                      ├─ Google TTS / ElevenLabs
                                                      └─ R2 result + session/history
                                                               │
                                                               └─ AE/PR host import
```

- Web manba: `packages/assetflow-studio/platform/index.html` + `platform/ff-api.js`.
- AE va Premiere: aynan bitta CEP panel — `plugins/after-effects-cep/AssetFlow_Plugin.html`.
- Yangi Create controller: `frameflow-create-workspace.js`; u real yuborishni legacy/canonical
  composerga delegatsiya qiladi.
- API: `apps/api/src/routes/studio-gen.ts`.
- Katalog/narx: `apps/api/src/lib/gen-models.ts`.
- Provider dispatch: `apps/api/src/lib/gen-processor.ts` va `apps/api/src/lib/ai/*`.
- Premiere host import: `jsx/host-premiere.jsx`; AE host yo'li shu CEP'dagi mavjud adapterlar.

## Isbotlangan ishlaydigan qismlar

1. **Model katalog build guard'i ishlaydi.** 51 entry, 24 enabled (operatsiyalar bilan),
   22 generativ model; katalog validatori 0 issue bilan o'tdi.
2. **Narx himoyasi bor.** Server-signed quote, alohida `COST_QUOTE_SECRET`, 15 daqiqalik imzo,
   server-side reprice, DB enabled gate va idempotency ishlatiladi.
3. **Kredit xavfsizligi bor.** Provider/config/model/session/quote tekshiruvlari kreditdan oldin;
   create/provider xatolarida refund va stuck-job reconciliation mavjud.
4. **Image reference oqimi mavjud.** Web va CEP `referenceUrl` + `referenceUrls` yuboradi;
   processor reference mode bo'yicha Vertex/BytePlus/Kling/fal yo'liga o'tadi.
5. **Video start/end oqimi mavjud.** Web va CEP end-frame'ni faqat start-frame va model capability
   mavjud bo'lsa yuboradi; Vertex/BytePlus/Kling/fal adapterlari end-frame'ni model metadata bilan
   provider payloadiga qo'shadi.
6. **Multimodal reference oqimi mavjud.** Web va CEP `imageUrls`, `videoUrls`, `audioUrls` yuboradi;
   BytePlus/Kling/fal/Vertex Omni runnerlari ularni materialize qiladi.
7. **Reference storage himoyasi mavjud.** Upload user-prefiksli R2 key ishlatadi, `srcKey/srcUrl`
   egaligi tekshiriladi, storage quota va multipart limitlar bor, eskirgan signed URL qayta imzolanadi.
8. **Session/auth isolation mavjud.** Web token o'lsa state, refs, sessions, projects va polling
   tozalanadi; CEP token invalidation va session-expired UI'ga ega.
9. **AE/PR UI bir manba.** Ikkala host bir xil HTML/CSS/controller ishlatadi; farq faqat host bridge.
10. **Host import testlari yashil.** Premiere host va integration contractlari o'tdi.

## Production snapshot (2026-08-07)

- `https://getframeflow.app` → `200`.
- Yangi login tokeni bilan production Studio Gen endpointlari ishladi.
- Provider health: OpenRouter, R2, ElevenLabs, fal, BytePlus ishlayapti; Kling ishlamayapti;
  Freepik ham sozlanmagan. Google providerlari katalog/quote orqali javob berdi.
- Production katalog: 19 generativ model (image 9, video 8, voice 1, SFX 1).
- 19 modelning default va rich-reference quote kombinatsiyalari: 38/38 PASS.
- Production'da Kling o'chirilgan bo'lsa ham 1030, 1031 va 3008 katalogda ko'rinadi.
- Lokal generativ katalog 22 model; production'da 1020, 3004 va 3005 yo'q. Bu DB override yoki
  deploy/config drift bo'lishi mumkin; release manifest bilan tushuntirilmagan.
- Lokal o'rnatilgan CEP source bilan bir xil; `AssetFlow_Plugin.html` farqi faqat installer build
  stampi. Lekin o'rnatmadagi oldingi sessiya tokeni endi invalid — qayta login talab qilinadi.

## Topilmalar

### P1-01 — Ko'rinadigan, lekin ishlamaydigan provider modellari

`GET /gen/models` DB-enabled modellarni qaytaradi, ammo `isProviderConfigured()` bilan filtrlamaydi.
`POST /gen` esa shu provider guard'ini ishlatib 503 qaytaradi. `/gen/ops` allaqachon to'g'ri
naqshni ishlatadi: enabled **va** configured bo'lmasa op'ni bermaydi.

**Ta'sir:** model tanlanadi, sozlama va quote ishlaydi, Generate esa ishlamaydi.  
**Fix:** katalogda unavailable modelni yashirish yoki `available:false/reason` bilan disabled
ko'rsatish; web va CEP bir xil qoida ishlatsin. Quote ham unavailable provider uchun imzo bermasin.

### P1-02 — Reference validatsiyasi barcha reference kanallarini qamramaydi

`POST /gen` dagi `hasRef` faqat `referenceUrl` va `referenceUrls`ni ko'radi. Quyidagilar shu
capability gate'ga kirmaydi:

- `referenceEndUrl`;
- `imageUrls`;
- `videoUrls`;
- `audioUrls`;
- `savedReferenceIds`.

Natijada unsupported modelga multimodal ref yuborish, kelajakdagi required media-ref modelini
noto'g'ri baholash yoki unknown paramsni jim qabul qilish mumkin. Hozirgi UI buni ko'p holatda
to'sadi, lekin API klientga ishonmasligi kerak.

### P1-03 — Unsupported end-frame jim tashlab yuboriladi

API faqat `modelSupportsEndFrame(model) && !start` holatini rad etadi. `endFrame:false` modelga
`referenceEndUrl` yuborilsa alohida `END_FRAME_NOT_SUPPORTED` yo'q; processor uni odatda indamay
ishlatmaydi. Tampered/stale klient foydalanuvchisi end-frame kutib, end-framesiz natijaga to'lashi
mumkin.

### P1-04 — Model limit/formatlari serverda yagona pre-charge gate emas

`mediaRefs`, `mediaRefFormats`, `mediaRefMaxBytes`, `mediaRefMaxTotalBytes` metadata mavjud, lekin
`/gen` ularni yagona validator bilan tekshirmaydi. Provider runnerlari ko'pincha limitdan ortiq
arrayni `slice()` qiladi. Ortiqcha reference jim yo'qoladi; format/hajm xatosi esa kechroq
providerda chiqishi mumkin.

### P1-05 — Quote va Generate bir xil validatsiya darvozasidan o'tmaydi

`/gen/cost-quote` model enabled va narxni tekshiradi, lekin:

- provider mavjudligini;
- required reference'ni;
- unsupported reference/end-frame'ni;
- model-specific setting/reference schema'ni

tekshirmaydi. Shu sabab quote PASS bo'lishi Generate PASS degani emas. Joriy 38/38 quote testi
provider yoki final payload ishlashini isbotlamaydi.

### P1-06 — Web va CEP payload quruvchilari takrorlangan

Web va CEP metadata asosida o'xshash payload yaratadi, lekin ikki alohida katta implementatsiya.
CEP ichida ham yangi Create controller draftni canonical/legacy composerga DOM click bilan
delegatsiya qiladi. Bu hozir ishlaydi, ammo model qo'shilganda uch joydan biri yangilanmay qolishi
mumkin. Mavjud testlar to'liq actual web-builder ↔ CEP-builder ↔ API canonical payload snapshotini
har model uchun solishtirmaydi.

### P1-07 — Production katalog/version driftiga release gate yo'q

Lokal generativ katalog 22, production 19. DB pricing orqali modelni ataylab o'chirish mumkin,
lekin API javobida katalog versiyasi, deploy SHA, disable sababi yoki provider availability
manifesti yo'q. Operator qaysi farq ataylab, qaysi farq noto'g'ri deploy ekanini tez ajrata olmaydi.

### P2-01 — `configured` maydoni multi-provider haqiqatini bermaydi

`/gen/models` top-level `configured` qiymatini faqat OpenRouter orqali hisoblaydi. Tizim esa
Vertex, BytePlus, Kling, fal, ElevenLabs va Google TTS ishlatadi. Maydon noto'g'ri talqin qilinishi
mumkin; per-model/per-provider availability kerak.

### P2-02 — Provider switch default'i fail-open

`isProviderConfigured()` tanilmagan yoki unutib qo'yilgan provider uchun OpenRouter holatiga
qaytadi. Yangi provider/type qo'shilib switch yangilanmasa, model xato ravishda configured deb
baholanishi mumkin. Exhaustive switch va noma'lum provider uchun `false` kerak.

### P2-03 — Model validator capability invariantlarini yetarli tekshirmaydi

Startup validator narx, option va dispatchning ko'p qismini tekshiradi, ammo quyidagilar uchun
qat'iy invariantlar yo'q:

- `referenceMode` ↔ `refMode` ↔ `refKind`;
- `endFrame` ↔ provider input descriptor;
- required start-frame ↔ UI metadata;
- `mediaRefs.total` va modality limitlarining izchilligi;
- har enabled model uchun default/max/negative canonical payload.

### P2-04 — Params sxemasi juda umumiy

`boundedParams` — 16KB bilan cheklangan `z.record(z.any())`. Bu DoS hajmini kamaytiradi, ammo
unknown key/type va modelga aloqasiz settinglarni qabul qiladi. Ular DB'ga tushadi yoki providerda
jim ignor qilinadi. Model-aware discriminated/canonical schema kerak.

### P2-05 — Quote reference hash qoidasi asimmetrik va murakkab

`referenceUrl`, `referenceUrls`, `referenceEndUrl` hashdan chiqariladi, lekin multimodal
`imageUrls/videoUrls/audioUrls` chiqarilmaydi. Bu narxga ta'sir qilmaydigan reference kanallari
uchun turli xulq beradi. Klient reference'ni quote'dan keyin o'zgartirsa bir yo'lda imzo ishlaydi,
boshqa yo'lda `BAD_QUOTE` chiqadi. Canonical priced params va unpriced reference manifestini
aniq ajratish kerak.

### P2-06 — Lokal CEP sessiyasi eskirgan

O'rnatilgan panel tokeni production tomonidan `TOKEN_INVALID` deb rad etildi. Yangi login ishladi.
Bu kod regressiyasi isbotlanmadi, ammo release/smoke jarayonida "cold boot with stale token →
guest/login → state cleanup → fresh login" alohida test bo'lishi kerak.

### P2-07 — Real provider payload canary yo'q

Quote testlari kredit sarflamaydi va juda foydali, lekin provider adapter schema o'zgarganini
ushlamaydi. Hozir real generation canary qilinmadi. Mock provider contractlari va owner tasdiqlagan
kichik budjetli staging canary kerak; production krediti jim sarflanmasin.

## Avtomatik tekshiruv natijalari

- API build + model validator: PASS.
- Pricing normalization: PASS.
- Web inline JavaScript syntax/public copy: 137/137 PASS.
- CEP Create controller: 10/10 PASS.
- CEP responsive: 103/103 PASS.
- Premiere CEP host: 18/18 PASS.
- Premiere CEP integration: 19/19 PASS.
- Reference multipart/upload limits: PASS.
- Public/private storage key policy: 21/21 PASS.
- Production quote matrix: 38/38 PASS (faqat quote; generation emas).
- `git diff --check`: PASS.

## Yakuniy release hukmi

**Hozirgi holat:** asosiy kod zanjiri kuchli, lekin P1-01…P1-07 yopilmaguncha va model-aware
negative contract testlari qo'shilmaguncha "barcha model/reference/start/end kombinatsiyasi to'liq
ulangan" degan hukm berilmaydi. Eng avval provider availability va yagona server-side param/reference
validatori tuzatilishi kerak. Keyin web va CEP actual payloadlari bitta model fixture matritsasida
API canonical payload bilan tengligi isbotlanadi.

