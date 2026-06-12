# Session Report — 2026-06-12 (M2 + SSE + Dashboard — COMMITTED & PUSHED)

**M2 ✅ Selective .mogrt download:**
- `mogrt-extract.ts`: `.mogrt` fayllari tmp'dan o'chirilmaydi (cleanup() ga qoldiridi); `mogrts[]` return'da.
- `contributor.ts`: upload paytida har `.mogrt` disk + R2 `templates/{id}/mogrt/{slug}.mogrt` ga; `mogrtKey` DB `metaJson.scenes[].mogrtKey`ga; SSE bosqichlari real vaqtda.
- `catalog-map.ts`: `mogrtKey` → `mogrtUrl` (`/api/plugin/assets/{id}/mogrt/{slug}`).
- `plugin.ts`: `GET /assets/:id/mogrt/:slug` — R2 redirect yoki disk fallback (ZIP route'dan OLDIN).
- `assetflow-catalog.js`: `downloadSceneMogrt()` — `mogrtUrl` bo'lsa faqat shu faylni yuklaydi, kesh bilan.
- `AssetFlow_Plugin.html`: `mogrtUrl` → `downloadSceneMogrt` → ZIP fallback zanjiri.
- `host.jsx`: `app.activeViewer` fallback — Timeline comp ochiq bo'lsa ham `no_dest_comp` xatosi tuzatildi.

**SSE upload progress ✅** — `upload-progress.ts` (in-memory pub/sub, 10min TTL, unref); `GET /api/contributor/templates/:id/upload-progress` (auth: cuid capability); receive→sync(82)→db(88)→extract(90-97)→db(98)→done(100); 413/400/500 xatolar bosqich bilan. Studio: XHR 0-80%, server 80-100%, xato toast'da bosqich nomi.

**Dashboard professional ✅** — migration `template_usage_counters` (downloadsCount, importsCount); bumpTemplateCounter usage route'larida; studio haqiqiy hisoblagichlar; KPI overview, importlar jadvali, admin xabarlar paneli, mobile responsive.

**Cosmic Light Transitions diagnostikasi:** M2 yo'q edi prod'da (push bo'lmagan). R2'da thumb'lar bor (`scenes/*.png|mp4`), lekin `metaJson.scenes` bo'sh — upload timeout (8 min, outer catch yutgan). Tuzatish: deploy + Re-extract endpoint (ayrí vazifa).

**Build/test:** `npm run build -w apps/api` ✓; `node --check` barcha JS ✓; `npm run studio:sync` ✓; migration deploy lokal ✓.

**Keyin:** Re-extract endpoint (Cosmic + M1 retroaktiv), Render deploy + migrate, Stripe, email.
