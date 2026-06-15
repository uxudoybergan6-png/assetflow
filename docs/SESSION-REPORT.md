# SESSION REPORT — 2026-06-15 — Timeline ref ASL sabab: engine'da eski host.jsx ✅

## ASL SABAB (nihoyat aniqlandi)
Panel YANGI xabarni ko'rsatdi ("Host bo'sh javob... AE qayta ishga tushiring") → demak panel
HTML TOZA yuklangan. Lekin:
- `importMediaFromPath` ishlaydi = u ESKI funksiya, AE sessiyasi boshida yuklangan host.jsx'da bor.
- `getActiveTimelineVideoReference` BO'SH = 2a'da qo'shilgan YANGI funksiya — eski engine'da YO'Q.

Manifest `ScriptPath` host.jsx'ni AE START'da BIR MARTA yuklaydi. Panel webview qayta yuklandi,
lekin ExtendScript ENGINE eski host.jsx'ni saqlab qoldi (AE to'liq restart bo'lmagan/quit fail).
Shuning uchun eski funksiya ishlaydi, yangisi yo'q.

## Tuzatish
`aiTimelineRef` named-call'dan OLDIN `await reloadHostScript()` — `$.evalFile(host.jsx)` bilan
engine'ga JORIY host.jsx'ni AE restartisiz qayta yuklaydi. Keyin
`evalScript('getActiveTimelineVideoReference()')` (importMediaFromPath bilan IDENTIK) ishlaydi.
Log: `reloaded=<bool> | raw=... | len=...`.

## Tekshirildi
- HTML inline JS `node --check` TOZA ✅; reloadHostScript mavjud (1) ✅
- `install-cep.sh` → Build: 2026-06-15 11:38 · 6bb0190 ✅

## Holat / TEST
"Timeline'dan" bosing. DevTools (http://localhost:8098) Console: `[ai:timeline-ref] reloaded=true
| raw={...}` kutilmoqda. reloaded=true + JSON raw → ishladi. reloaded=false → evalFile yo'li
xato (log'da ko'ramiz). Keyingi: 3a.
