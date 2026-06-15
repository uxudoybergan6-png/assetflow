# SESSION REPORT — 2026-06-15 — 2a tuzatish: stale host.jsx (evalScript bo'sh) ✅

Muammo: "Host javob bermadi (evalScript bo'sh)" — import ishlaydi, lekin yangi
`getActiveTimelineVideoReference` topilmaydi.

## Sabab
host.jsx manifest `ScriptPath` orqali extension START'da bir marta yuklanadi. `reloadHostScript()`
boot'da chaqiriladi, lekin panel reinstall'dan keyin QAYTA yuklanmasa, engine xotirasida ESKI
host.jsx qoladi — eski funksiyalar (importMediaFromPath) ishlaydi, 2a'dagi YANGI funksiya yo'q →
evalScript bo'sh → frontend "Host javob bermadi".

## Tuzatish — frontend aiTimelineRef
- Chaqirishdan OLDIN `await reloadHostScript()` — host.jsx'ni majburan qayta yuklaydi
  (panel reload shart emas).
- evalScript ifodasi guard bilan: `typeof getActiveTimelineVideoReference==="function" ? ...()
  : JSON.stringify({ok:false,reason:"host.jsx eski yuklangan — AE qayta ishga tushiring"})`.
  Endi har doim parseable JSON keladi (bo'sh emas) — funksiya yo'q bo'lsa ham aniq sabab.

## Tekshirildi
- HTML inline JS `node --check` TOZA ✅
- `install-cep.sh` o'rnatdi; guard ifoda installed html'da ✅

## Holat
2a tuzatildi (2-urinish) — AE'da test: "Timeline'dan" reload qilib funksiyani topadi;
footage layer → reference, aks holda aniq sabab. Keyingi: 3a (ko'p-model selektor).
