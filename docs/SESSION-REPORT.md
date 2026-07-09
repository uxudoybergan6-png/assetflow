# Sessiya hisoboti — FIX-PROMPTS partiyasi · 2026-07-09

## PROBLEM 1 — Plagin Sessions + Projects ✅

- 4 yangi view (v-sessions/v-session/v-projects/v-project) — web terminologiyasi 1:1,
  tor panel: seg qator (launcher: Tools|Sessions|Projects), ro'yxat qatorlari, 2-ustun
  loyiha kartalari (4-cover mozaika); My Library → history view (barcha genlar).
- `afProjectPicker` (markaziy modal: mavjud loyihalar + Create&add) + `afNameModal`
  (yaratish/rename); Add-to-project BARCHA gen ctx'larida (rasm/video/audio/hist/home
  recent kartalar + lightbox) va katalog shablon detalida (pd3AddToProject).
- "New session" → tool sessiya keshlari reset (axIG/VG/AGNewSession hook'lari).
- Backend PARTIYA 5 endpointlari qayta ishlatildi (rebuild YO'Q); studioPatch helper qo'shildi.
- Mockup: `_aitools-sessions-projects-mockup.html` (4 frame). Brauzer smoke-test: view'lar
  ochiladi, picker modal ishlaydi, konsol xatosiz; AE jonli testi kutilmoqda.

## PROBLEM 10 — Add-a-model tizimi ✅

- `gen-models-validate.ts` — har GEN_MODELS entry uchun to'liq validatsiya (id/mode/feature/
  provider-dispatch/aspects/durations/perSec/mediaRefs/voices + narx dry-run); startup'da
  throw (health-gate deployni to'xtatadi) + `npm run check:models -w apps/api` guard-CLI.
  Salbiy test: 11 muammo topdi; ijobiy yangi entry: 0. Joriy katalog: 38 entry, 0 muammo.
- UI hardcode'lar tozalandi: plagin provider allowlist'lari olib tashlandi (katalog-driven,
  P3 media-refs sharti saqlandi); web `tool.multi` → katalog count mavjudligi.
- `docs/ADD-A-MODEL.md` — maydon→UI→provider mapping jadvali, adapter kontrakti, 3 shablon,
  kreditsiz test retsepti, checklist.

## PROBLEM 8 — Per-model gen UX (KATTA) ✅

- `docs/GEN-MODEL-MATRIX.md` — 13 yoqilgan model uchun avtoritativ imkoniyat+mapping jadvali
  (3 parallel kod-audit agenti bilan qurildi), 12 backend mismatch hujjatlandi.
- Backend klamplar: audio capability, Omni total, maxRefs, voice validatsiya (money-zone
  BYTE-FOR-BYTE tegilmagan — narx regressiya testi bilan isbotlandi).
- Web: to'liq model-driven referens tizimi (multi-ref yuklash, start/end kadr, Omni/R2V
  media-refs, audio/bitrate chip, Auto duration, majburiy-ref gate) — headless'da 11 model
  UI holati + 8 cost-quote stsenariysi tekshirildi.
- Plagin: YANGI Voice/SFX tool (v-audgen), audio toggle gating, isDefault, launcher yangilandi.
- Kutilmoqda: push+deploy, AE'da plagin jonli testi.

## PROBLEM 7 — Storage (AI results) kam ko'rsatilishi ✅

- **Ildiz sabab:** `GenAsset.sizeBytes` ustuni 2026-07-05 migratsiyada qo'shilgan —
  undan OLDINGI barcha assetlar (katta videolar ham) `null` → kvota yig'indisida 0.
  Joriy yozish yo'llari (persist → buf.length, image/audio/video) TO'G'RI ishlaydi.
- **Tuzatish:** (1) `hydrateGenAssets` lazy self-heal — HeadObject qilinganda hajm DB'ga
  yoziladi; (2) `lib/backfill-sizebytes.ts` — idempotent backfill (HeadObject + data-URI
  baholash, GenAsset + SavedReference); (3) admin endpointlar:
  `GET /api/admin/maintenance/gen-sizebytes` (diagnoz) va `POST .../backfill` (audit-log
  bilan); (4) `scripts/backfill-genasset-sizebytes.mjs` (DRY_RUN default).
- **Tekshirildi:** dev DB'da 5 null qator → 186 B ×5 to'ldirildi, qayta ishga tushirish 0
  qator (idempotent); `getUserUsedBytes`=930 ✓; build toza; money-zone TEGILMADI.
- **Kutilmoqda:** production deploy'dan keyin admin backfill endpointini ishga tushirish.

## PROBLEM 3 — Plagin video R2V olib tashlandi ✅

- Toggle (.vg-modeseg) + #vgMediaSect markup, vgModelOfKind/_mf/_mr handler'lari,
  +Img/+Vid/+Aud listener'lari, media-refs paste handler'i olib tashlandi; applyVgMeta
  toggle-display bloki tozalandi. ensureVgMeta endi refKind='media-refs'/reference-to-video
  modellarni FILTRLAB tashlaydi (3102 selectable emas). Karta matni "Seedance 2.0 · Fast
  (frame)". Ichki mref funksiyalari guarded/dormant (frames oqimi vgSrcSheet bilan umumiy
  — xavfsiz). JS sintaksis ✓, R2V markup izlari yo'q ✓, install-cep ✓.

## PROBLEM 13 — Download nomi prompt'dan ✅

- Backend: `promptFileBase` (60 belgi, sanitizatsiya, chekka nuqtalar yo'q) + `genDownloadName`
  prompt qabul qiladi → `downloadUrl` Content-Disposition prompt nomi bilan imzolanadi.
  Web o'zgarishsiz (downloadUrl'ga tayanadi). Plagin: `afGenDlName` global + 7 gen-download
  joyi yangilandi + history/recent mapping'lariga `downloadUrl` passthrough. Unit test +
  build + inline-JS sintaksis ✓.

## PROBLEM 14 — Yangi user'da admin email ✅

- `notifyAdminNewUser` (notify.ts, ADMIN_NOTIFY_EMAIL yo'q→no-op, safe fire-and-forget);
  3 yaratish nuqtasiga ulandi: register (web), Google web isNew, Google plugin device-code
  isNew. E2E: register→1 xabar, takroriy login→0, mail xatosi signup'ni buzmaydi ✓.

---

# Sessiya hisoboti — Admin "Website / Landing" CMS · 2026-07-09

**Vazifa:** FIXPROMPT (standalone) — landing'ni to'liq tahrirlaydigan struktur CMS: hero, mockup kartalar (media), stats, nav/CTA yorliqlari, theme (accent+font).

**Qilindi (3 commit):**
- Backend: `LandingConfig` (id=1, JSON blob, ADDITIVE migratsiya) + `lib/landing-config.ts` (defaultlar = joriy kontent, zod, bo'lim-darajali merge, 30s kesh); ommaviy `GET /api/landing/config` (60s HTTP kesh); admin `GET/PUT/DELETE /api/admin/landing-config` (requireAdmin+audit); upload whitelist'ga `landing` folder.
- Landing (`platform/index.html`): hero/nav/mockup/stats/theme bindinglarga o'tdi — `FFAPI.landingConfig()` + localStorage kesh; kartalar admin media (rasm/video) yoki gradient fallback; custom accent HEX → CSS var override (faqat marketing ekranlar, app UI default qoladi); font — self-hosted to'plam (Hanken/System/Plex Mono/Georgia).
- Admin: `route("website")` + `js/admin-website.js` — matn maydonlari, karta media upload (presigned PUT), accent swatch/picker/HEX, font tanlovi, jonli preview, Save & publish, Reset to defaults.

**Tekshirildi (lokal Postgres + headless Chromium):** default landing 1:1 o'zgarmagan (skrinshot); admin edit→Save→landing hammasi aks etadi (matn, cyan/amber accent, IBM Plex Mono, karta media, stats count-up 55,000+); Reset server+editor'da defaultga qaytardi; 401/403 guardlar; pricing ekrani regressiyasiz. Pul zonasiga tegilmagan.

**Kutilmoqda:** push (foydalanuvchi qiladi), Render deploy + prod `migrate:deploy`, R2'da real media upload sinovi. Eslatma: bu konteynerda `npm run build -w apps/api` 109 ta OLDINDAN mavjud xato beradi (prisma ^6.8.2→6.19.3 drift) — landing fayllarida xato YO'Q.
