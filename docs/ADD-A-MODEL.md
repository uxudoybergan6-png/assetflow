# ADD A MODEL — yangi AI model qo'shish qo'llanmasi (PROBLEM 10)

> Yangi model = `apps/api/src/lib/gen-models.ts` dagi `GEN_MODELS` massiviga BITTA entry.
> UI (web `platform/index.html` + AE plagin) TO'LIQ katalog-driven — to'g'ri entry
> qo'shilsa ikkala yuzada ham kerakli kontrollar AVTOMATIK chiqadi, UI kodi o'zgarmaydi.
> Validator (`gen-models-validate.ts`) noto'g'ri entry bilan serverni KO'TARMAYDI.

## Tez yo'l (mavjud provider bilan)

1. `GEN_MODELS`ga entry qo'shing (pastdagi shablonlardan nusxa oling).
2. `npm run build -w apps/api && npm run check:models -w apps/api` — validator 0 muammo
   ko'rsatishi shart (muammo bo'lsa model id + maydon nomi bilan aniq xato chiqadi).
3. Serverni ishga tushiring — `GET /api/studio/gen/models?mode=<mode>` javobida ko'ring.
4. UI'ni tekshiring (kredit sarflamasdan): web AI Studio'da model picker'da tanlang —
   chip'lar (aspect/quality/count/resolution/duration/audio/bitrate) va referens paneli
   (multi-ref / start+end kadr / media-refs) entry maydonlaridan quriladi.
5. Dry-run payload (kredit sarflamaydi): `POST /api/studio/gen/cost-quote` to'g'ri narx
   qaytarishini tekshiring; fal video uchun `buildFalVideoInput` natijasini script bilan
   ko'ring (pastda "Kreditsiz test").
6. Jonli test EN ARZON sozlamada (1K rasm / eng qisqa duration); VIDEO jonli testdan saqlaning.

## Qaysi maydon nimani boshqaradi (UI mapping)

| Katalog maydoni | Web + plagin UI | Provider'ga boradigan param |
|---|---|---|
| `aspects` / `imgSettings.aspect` | Ratio chip | `params.aspectRatio` |
| `imgSettings.quality {options,def,cost}` | Quality chip (+narx) | `params.quality` |
| `imgSettings.num` / `count` | Count chip (rasm) | `params.count` |
| `resolutions` / `videoSettings.resolution {options,def,perSec}` | Resolution chip | `params.resolution` |
| `durations` / `videoSettings.duration {options,def,autoSec}` | Duration chip ('Auto' bilan) | `params.duration` |
| `videoSettings.audio` + `audioDefault` + `audioLocked` | Audio toggle (locked=🔒) | `params.audio` |
| `videoSettings.bitrate {options,def}` | Bitrate chip | `params.bitrateMode` |
| `refMode` (`none`/`optional`/`required`) + `maxRefs` | Rasm: ＋Reference (maxRefs gacha); required → Generate gate | `params.referenceUrl(+s)` |
| `refKind:'frames'` (+`endFrame`) | Video: Start (+End) kadr slotlari | `params.referenceUrl`, `params.referenceEndUrl` |
| `refKind:'media-refs'` + `mediaRefs {image,video,audio,total}` | Video: ＋Image/＋Video/＋Audio (limitgacha) | `params.imageUrls/videoUrls/audioUrls` |
| `voices [{id,label}]` | Voice picker (TTS) | `params.voice` |
| `isDefault: true` | Rejimning default modeli | — |
| `enabled: false` | UI'da ko'rinmaydi (server filtrlaydi) | — |

## Narx maydonlari (money-zone bilan bog'lanish)

- Rasm: `imgSettings.quality.cost` (tier→kredit) yoki flat `cost`; `count` ko'paytiriladi.
- Video: `videoSettings.resolution.perSec` (res→kredit/soniya) × duration; `pricing:"per-generation"` bo'lsa flat `cost`.
- Voice/SFX: flat `cost`.
- `videoInputPerSecMultiplier` — video-referens chegirmasi (R2V ×0.6).
- ❗ `computeGenCost`/`imageUnitCost`/quote-HMAC'ga TEGMAYSIZ — yangi entry faqat o'z narx
  maydonlarini keltiradi; `provider-cost.ts`ga PROVIDER tannarxini ham qo'shing (spend ceiling).
- DB override: admin `/api/admin/pricing` orqali narxni keyin o'zgartira oladi (ModelPricing).

## Provider adapter kontrakti

Dispatch: `gen-processor.ts` model.provider + model.feature bo'yicha:

| provider/feature | adapter | eslatma |
|---|---|---|
| `vertex-image` (image) | `ai/vertex-image.ts` | aspect→imageConfig.aspectRatio, quality→imageSize, ref'lar inlineData |
| `fal` (image) | `ai/fal.ts falImage` | imgSettings.aspect.param/map bilan `image_size`/`aspect_ratio` |
| `fal` (image-to-video) | `runFalVideo` + `buildFalVideoInput` | `videoInput` deskriptori (yo'q bo'lsa SEEDANCE defaults) |
| `fal` (reference-to-video) | `runFalRefVideo` | mediaRefs limitlari server'da kesiladi |
| `vertex` (text-to-video) | `runVertexVideo` → `vertexSubmitVideo` | image/lastFrame/aspect/durationSeconds/generateAudio/resolution |
| `vertex-omni` (video) | `runVertexOmniVideo` | sinxron; duration/res API'da yo'q; video ref bo'lsa aspect yuborilmaydi |
| *(yo'q)* voice | `orSpeech` (OpenRouter) | `voices` validatsiya qilinadi |
| `elevenlabs` sfx | `elSoundEffects` | duration 0.5-22s klamp |

**Yangi PROVIDER qo'shish** = (1) `GenModel.provider` union'iga tur qo'shish, (2)
`gen-processor.ts`da dispatch branch + adapter (`ai/<provider>.ts`) yozish, (3)
`gen-models-validate.ts` dagi `VIDEO_DISPATCH`/`IMAGE_DISPATCH` to'plamiga qo'shish
(aks holda validator "dispatch branch yo'q" deb yiqitadi — ATAYIN, unutmaslik uchun),
(4) refund/timeout semantikasi: adapter `{ok:false,error}` qaytarsin; TIMEOUT sentinel
(`<PROVIDER>_TIMEOUT:`) refundsiz "running" qoldiradi (reconcile hal qiladi).

## Copy-paste shablonlar

### Rasm (fal misoli)

```ts
{
  id: 1XXX, mode: "image", key: "vendor/model-slug", label: "Model nomi",
  provider: "fal", falModel: "vendor/model-slug", enabled: false, // avval false — dry-run'dan keyin yoqing
  feature: "text-to-image", // referens qabul qilsa: "image-edit" + referenceMode/refMode/maxRefs
  cost: 4, refMode: "optional", maxRefs: 4,
  aspects: ["1:1", "16:9", "9:16"], resolutions: ["1K", "2K"], count: [1, 2, 3, 4],
  imgSettings: {
    aspect: { param: "aspect_ratio", options: ["1:1", "16:9", "9:16"], def: "1:1" },
    quality: { label: "Quality", param: "quality", options: ["1K", "2K"], def: "1K", cost: { "1K": 4, "2K": 8 } },
    num: [1, 2, 3, 4],
  },
}
```

### Video (fal i2v misoli)

```ts
{
  id: 3XXX, mode: "video", key: "vendor/model/image-to-video", label: "Model nomi",
  provider: "fal", falModel: "vendor/model/image-to-video", enabled: false,
  feature: "image-to-video", // t2v bo'lsa "text-to-video" (+ start ixtiyoriy)
  cost: 8, // fallback perSec
  refMode: "required", maxRefs: 1, refKind: "frames", endFrame: true,
  aspects: ["auto", "16:9", "9:16"], resolutions: ["480p", "720p"], durations: [4, 6, 8],
  audio: true,
  videoSettings: {
    aspect: { options: ["Auto", "16:9", "9:16"], def: "Auto" },
    resolution: { options: ["480p", "720p"], def: "480p", perSec: { "480p": 8, "720p": 12 } },
    duration: { options: ["Auto", "4", "6", "8"], def: "Auto", autoSec: 4 },
    audio: true, audioDefault: false,
  },
  // fal input kalitlari default SEEDANCE bilan mos kelmasa:
  // videoInput: { startFrameKey: "image_url", endFrameKey: "end_image_url", resolutionKey: "resolution",
  //   durationKey: "duration", durationFormat: "string", aspectKey: "aspect_ratio", audioKey: "generate_audio", imageRequired: true },
}
```

### Audio (TTS misoli)

```ts
{
  id: 2XXX, mode: "voice", key: "vendor/tts-model", label: "TTS nomi", enabled: false,
  feature: "text-to-speech", cost: 3, referenceMode: "none",
  voices: [ { id: "voice_a", label: "Alice" }, { id: "voice_b", label: "Bob" } ],
  languages: ["English"],
}
```

## Kreditsiz test retsepti

```bash
npm run build -w apps/api
npm run check:models -w apps/api          # validator (guard-test)
node - <<'JS'                              # provider payload dry-run (jonli chaqiruvsiz)
const gm = await import("./apps/api/dist/lib/gen-models.js");
const m = gm.getModelById(3XXX);
const params = { resolution: "480p", duration: "Auto", aspectRatio: "auto", audio: false };
const v = gm.resolveVideoParams(m, params);
console.log("resolved:", v, "cost:", gm.computeGenCost(m, params));
if (m.provider === "fal") console.log("fal input:", gm.buildFalVideoInput(m, "test", v, { startUrl: "https://x/i.png" }, "u1"));
JS
```

Checklist:
- [ ] `check:models` 0 muammo
- [ ] `cost-quote` to'g'ri narx (kreditsiz)
- [ ] Web picker'da to'g'ri chip'lar/referens paneli
- [ ] Plagin picker'da ham (media-refs video PLAGINDA ko'rinmaydi — PROBLEM 3 sharti)
- [ ] `provider-cost.ts`da tannarx (startup warning yo'qolsin)
- [ ] Jonli test faqat EN ARZON sozlamada → keyin `enabled: true`
