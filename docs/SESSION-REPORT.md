# SESSION REPORT — 2026-06-15 — 2a tuzatish: Timeline reference aniq sabab ✅

Muammo: "Timeline reference olinmadi" generic — sabab ko'rinmasdi (host throw → evalScript
bo'sh → frontend generic fallback).

## host.jsx getActiveTimelineVideoReference
- BUTUN tana `try/catch` ichida — endi hech qachon throw qilmaydi (ichki xato ham JSON reason).
- Har holatga ANIQ sabab:
  - activeItem CompItem emas → "Kompozitsiya ochiq emas — Timeline'ni oching"
  - selectedLayers bo'sh → "Layer tanlanmagan — Timeline'da klip tanlang"
  - `L.source` yo'q (matn/shakl/kamera/yorug'lik) → "footage emas (matn/shakl/kamera)"
  - `source` precomp (CompItem) → "precomp — footage klip tanlang"
  - `source instanceof FootageItem` lekin fayl yo'q (solid/placeholder) → "Footage faylsiz"
  - ✅ FootageItem + fayl → {ok:true, name, mediaPath, mediaType}
- Birinchi tanlangan layer'ning sababi qaytariladi; diagnostika: compName, selectedCount.

## Frontend aiTimelineRef
- Host reason'ni to'g'ridan toast'da ko'rsatadi. Parse fail/bo'sh bo'lsa raw (qisqartirilgan)
  yoki "Host javob bermadi" — debug uchun. `console.log('[ai:timeline-ref] host →', raw)`.

## Tekshirildi
- host.jsx + HTML inline JS `node --check` TOZA ✅
- `install-cep.sh` o'rnatdi; reason variantlari (8) installed host.jsx'da ✅

## Holat
2a tuzatildi — AE'da test: turli holatlar (comp yo'q / layer yo'q / matn layer / footage)
aniq sabab qaytaradi; footage layer → reference chip. Keyingi: 3a (ko'p-model selektor).
