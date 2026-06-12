# SESSION-REPORT — 2026-06-12 (.mogrt pack support, testdan o'tdi)

**Natija:** ZIP ichida papka nomi ixtiyoriy bo'lgan .mogrt pack to'liq ishlaydi. AE'da 6 ta sahna kartasi video preview bilan chiqdi, tanlangan element import qilindi — test o'tdi.

**O'zgarishlar:**
- `assetflow-catalog.js` — `listEntriesInZip(child, zipPath, ext)`: `unzip -Z1` bilan ZIP entry yo'llari kengaytma bo'yicha filterlanadi (papka nomi muhim emas; `__MACOSX/` va `._*` chiqariladi). ZIP ochilishdan OLDIN entry ro'yxati olinadi, keyin `path.join(dir, entry)` bilan disk yo'liga aylantiriladi. `findAllFilesByExtInDir` fallback sifatida qoladi. `mogrtItemsFromDir`: har `.mogrt` ichidan `thumb.png`/`thumb.mp4` `__af_thumbs/<slug>/` ga bir marta chiqaradi. `extractMogrtFileToAep`: slug+ts unikal papka, `aegraphic` nested-ZIP yoki RIFX ikkala holat.
- `AssetFlow_Plugin.html` — `mogrtScenesFromItems`: har element sahna kartasiga `thumb.mp4` (video) yoki `thumb.png` (image) preview bilan; `applyMogrtItems`; `openPack` keshdan sync yuklaydi. `scene.mogrtPath` → `extractMogrtItem` → import. Picker ochilganda detal yopilmaydi.
- `AssetFlow_Admin.html` — `mogrtToAepIn`/`aegraphicToAepIn` helperlar; pack ochilganda `.mogrt` topilsa `.aep` ga o'girib AE'da ko'rsatadi.
- `contributor-views.js` (3 nusxa) — upload `.mogrt` YOKI `.zip` (ichida `.mogrt`).
- `s3.ts`, `template-files.ts` — pack kengaytmalariga `.mogrt`.

**Tekshirildi:** `node --check` + inline-script parse toza; real kesh (6 mogrt, `cmq9sowil...`) bilan integratsion test — 6/6 element video preview bilan, ZIP-branch throw to'g'ri, extract RIFX `.aep` + comp nomi; AE'da jonli import muvaffaqiyatli; studio:sync + install-cep.sh bajarildi.

**Kutilmoqda:** Render/Vercel deploy (push qilingan); 3b server-side scene extract API'da (R2 ga thumb.mp4 — alohida vazifa).
