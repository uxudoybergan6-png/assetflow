# Sessiya hisoboti — 2026-07-07 · AE plagin: 3 ta Mister Horse import mexanizmi porti

**Qilindi (COMPOSER-MECHANISM-ANALYSIS.md build order, 3 alohida commit, additiv, money-zone'ga tegilmadi):**
1. **Avto-masshtab** (`jsx/host.jsx`, a565c72): `afComputeFitScale` (sof, test qilingan) + `afScaleLayerToComp`
   (faqat `ADBE Scale`, kontent bounds = `sourceRectAtTime`, 0/NaN/Inf guard + clamp, throw yo'q) +
   `afAutoscaleSelection`; `addSceneCompToTimeline` ichida contain fit, import undo guruhida.
2. **Ishonchli yuklab olish/unzip** (`assetflow-catalog.js`, fe9f0f5): atomik temp→rename, streaming sha256
   (record + `opts.expectedSha256` tekshiruvi + sidecar), `cacheValid` (idempotent, hash-aware), unzip
   robustlik (bo'sh-extract guard + status toast). Kutilgan hash katalog maydonisiz — TODO(FF) qoldirildi.
3. **Oddiy joylash + self-tag** (`jsx/host.jsx`, 6caa5be): tanlangan layer = nishon (inPoint + moveBefore),
   aks holda playhead; placeholder OLIB TASHLANMAYDI (native replace emas). `afTagImportedLayer`/
   `afIsFrameFlowItem` (comment+marker+label). Import+joylash+masshtab+tag BITTA Undo'da.

**Tekshirildi:** scratch node testlar (fit math + sha256 + atomik rename), REAL `downloadUrlToFile` integ-test,
`node --check` ikkala fayl, undo-guruh o'ralishi kod bo'yicha tasdiqlandi.

**Kutilmoqda (jonli AE + install-cep.sh + AE restart):** har xil shablonlarda avto-masshtab (ayniqsa qisman
kontent/lower-third — fit hint kerak), tanlangan-layer vs playhead joylash, download/unzip progress ko'rinishi.
