# SESSION REPORT — 2026-06-19 — G2: Model-aware reference (referenceMode router)

## Muhim topilma (G1 ham qisman shu sabab)
- gen-processor router `model.feature === "image-edit" && refUrl` ekan. Lekin "Nano Banana 2" (1001) `feature:"text-to-image"` → reference bo'lsa ham `orImage` (text2img) chaqirilardi. `referenceMode` bo'yicha marshrutlash bilan tuzatildi.

## Bajarildi
- **gen-models.ts**: `ReferenceMode` type (none/image-edit/image-ref/video-ref) + har 13 modelga qiymat. `/endpoints` input_modalities bilan TASDIQLANGAN (2026-06-18): barcha 5 rasm modeli image kiritadi → `image-edit`; 7 video → `video-ref`; kokoro/SFX → `none`. Helperlar: `getReferenceMode`, `modelAcceptsReference`, `firstReferenceModel`.
- **gen-processor.ts**: router endi `getReferenceMode(model)` bo'yicha → `image-edit`/`image-ref` + refUrl → `orImageEdit`, aks holda `orImage`. (`feature`ga emas.)
- **studio-gen.ts** `/gen`: reference biriktirilgan, lekin model `none` → **400 `REFERENCE_NOT_SUPPORTED`** + qo'llaydigan model tavsiyasi, KREDITDAN OLDIN (sarflanmaydi).
- **Plugin** (`AssetFlow_Plugin.html`): `/gen/models` to'liq model (referenceMode bilan) qaytaradi — frontend o'qiydi. `aiRefSupported/aiUpdateRefAffordance` — model tanlanganda reference tugmasi (`#aiRefBtn`) yoqiladi/o'chiriladi, qo'llamasa `#aiRefHint` ("bu model reference qabul qilmaydi" + tavsiya) + mos kelmaydigan ref avtoremoval. `aiTimelineRef` guard.

## Tekshirildi
- tsc toza. Plugin parse: 2 blok, 0 xato. 13 model × referenceMode. Studio static UI tegmadi → studio:sync shart emas. CEP'ga ko'chirildi (AE qo'zg'atilmadi).

## Kutilmoqda
- G3: video reference (video-ref router/format). G4: Project'dan reference. G5: image/video-to-prompt.
