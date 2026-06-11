# SESSION-REPORT — 2026-06-11 (.mogrt support qo'shildi)

**Topilma:** .mogrt = ZIP (project.aegraphic + definition.json + thumb). Yangi AE'larda `project.aegraphic` O'ZI ham ZIP (ichida asl RIFX .aep) — ikkala holat qo'llanadi. AE'da dialogsiz mogrt-import API yo'q → extract CEP tomonda (Node unzip, .zip precedenti), host.jsx mavjud .aep yo'li o'zgarmagan.

**O'zgarishlar:**
- `assetflow-catalog.js` — `downloadPackToTemp` mogrt branch: unikal papka `assetflow_mogrt_{id}_{ts}` (har importda yangi — eski importlar footage yo'llari buziladi), nested-zip detect (PK signature), `definition.json` → master comp nomi (`sourceInfoLocalized.en_US.name` || `capsuleName`), `mogrtCompName()` export.
- `AssetFlow_Plugin.html` — import cfg'ga mogrt comp hint (`pushAlt`); `deleteDownloadedTemplate` keshda `.mogrt` + mogrt papkalar tozalanadi.
- `host.jsx` — 2 himoya guard (.mogrt yetib kelsa aniq xabar; import mantig'i tegmagan).
- `template-files.ts`, `s3.ts` — pack kengaytmalariga `.mogrt` (eski .aep/.zip saqlanadi).
- `contributor-views.js` (3 nusxa, MD5 teng) — upload faqat `.mogrt` (accept, validatsiya, matnlar).

**Tekshirildi:** `tsc` toza; `node --check` toza; 2 haqiqiy .mogrt bilan e2e extract testi o'tdi (RIFX .aep + to'g'ri comp nomi chiqdi); studio:sync + install-cep.sh bajarildi.

**Kutilmoqda:** AE ichida jonli import testi (Browse → Sync → mogrt shablonni import); Render deploy (API push qilinmagan); commit yo'q (so'ralmagan).
