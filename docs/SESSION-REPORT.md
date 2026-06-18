# SESSION REPORT — 2026-06-19 — G4: Reference kiritish sodda — Timeline / Project

## Bajarildi
- **host.jsx**: yangi `getSelectedProjectReference()` — Project panelda tanlangan birinchi footage (rasm/video) manba fayl yo'lini qaytaradi. `getActiveTimelineVideoReference` naqshiga mos (atomik `$.evalFile`, qo'lda JSON `{ok,name,mediaPath,mediaType,kind,source:"project"}`). Tanlanmagan/precomp/papka/solid → tushunarli reason.
- **Frontend** (`AssetFlow_Plugin.html`):
  - "Rasm reference" tugmasi endi kichik MENYU ochadi (mavjud `af_ai.open`/`aiRenderMenus` tizimiga `ref` qo'shildi): «Timeline'dan» / «Project'dan».
  - `aiTimelineRef` → umumiy `aiAttachRef(src)` ga refaktor; `aiProjectRef`/`aiPickRef` qo'shildi. Ikkala manba bir xil `af_ai.reference` chip'ini beradi (manba yorlig'i: Timeline/Project reference).
  - `aiReferenceDataUri` (G1/G3) ikkala manba uchun ishlaydi (rasm yoki video kadr) — o'zgartirish shart emas.
  - G2 affordance: model `none` bo'lsa tugma disabled + ochiq ref menyu yopiladi (`aiUpdateRefAffordance`).
  - CSS: `.ai-refmenu` (mavjud `.ai-menu`/`.mr-ico` token'lari — 3 tema mos) + chevron.

## Tekshirildi
- Plugin inline parse: 2 blok, 0 xato. host.jsx `new Function` syntax OK. HTML+jsx CEP'ga ko'chirildi (AE qo'zg'atilmadi). Studio static UI tegmadi → studio:sync shart emas.

## Kutilmoqda
- G5: image/video-to-prompt (reverse — rasm/video'dan prompt, vision model /endpoints bilan tasdiqlanadi).
