# Sessiya hisoboti — FIX-PROMPTS partiyasi (16/16 ✅) · 2026-07-09

**Vazifa:** `docs/FIX-PROMPTS-2026-07-09.md` — 16 muammo, execution order bo'yicha, har biri o'z commit(lar)i bilan. PUSH QILINMAGAN — foydalanuvchi push qiladi.

**Bajarildi (tartibda):**
- **P7 storage:** sizeBytes ildiz sabab (2026-07-05'dan eski qatorlar null) → hydrate lazy self-heal + idempotent backfill lib + admin `GET/POST /api/admin/maintenance/gen-sizebytes[/backfill]` + dev skript. Dev DB'da tekshirildi.
- **P14 admin email:** `notifyAdminNewUser` 3 yaratish nuqtasida (register/Google web/Google plugin); E2E: create→1 xabar, login→0.
- **P13 download nomi:** backend `genDownloadName` prompt'dan (Content-Disposition); plagin `afGenDlName` + downloadUrl passthrough.
- **P3 R2V:** plagin video Fast-only (toggle/media-sect/handler'lar o'chdi, media-refs modellar filtrlanadi).
- **P8 per-model UX (KATTA):** `docs/GEN-MODEL-MATRIX.md` (13 model, 3 parallel audit-agent); backend klamplar (audio/maxRefs/Omni total/voice) — money-zone BYTE-FOR-BYTE; web to'liq model-driven ref tizimi (yuklash, start/end kadr, Omni/R2V media-refs, audio/bitrate/Auto, required gate); plagin YANGI Voice/SFX tool (v-audgen). Headless + dry-run payload + 8 quote stsenariysi tekshirildi.
- **P10 add-a-model:** `gen-models-validate.ts` startup guard + `check:models` CLI; UI provider-allowlist/tool.multi hardcode'lar olib tashlandi; `docs/ADD-A-MODEL.md`.
- **P1 Sessions+Projects (plagin):** 4 view + afProjectPicker/afNameModal + Add-to-project hamma gen ctx + katalog detali + mockup.
- **P2 karta amallari:** Copy prompt ikkala yuzada (CEP execCommand fallback), hover-label tooltip'lar, paritet.
- **P4 thumbnails:** rasm gen ~512px real thumb (ffmpeg, thumbKey) + eager load (web 6 / plagin 4 karta).
- **P9 shablon download:** plagin detalda pack hajmi; ekstraksiya papkasi SHABLON NOMI bilan (`unzipDirName`).
- **P6 bulk sessiya:** `DELETE /gen/sessions/:id` (GCS tozalash+cascade+owner 404) + web multi-select/bulk bar (jonli tekshirildi).
- **P12 auto-grow** (240px, ikkala yuza) · **P5 pills** (sc-interp qo'sh kontur ildizi, `>` selektor) · **P17 toast** (yuqorida ixcham karta, tur-ikonka).
- **P11 update tizimi:** PluginRelease model+migratsiya, `GET /api/plugin/version` (semver/mandatory — jonli tekshirildi), in-panel updater (checksum, cp -R, graceful fallback), admin Releases bo'limi, `docs/PLUGIN-UPDATE-CHAIN.md`.
- **P16 integratsiya:** plagin `afRefreshAll` + ↻ HAR view'da (8 header), ikkala yuzada focus-refresh (20s throttle), in-flight dedupe.

**Kutilmoqda:** push (foydalanuvchi) → Cloud Run deploy + `migrate:deploy` (plugin_release) + CF Pages; AE'da plagin jonli testi (install-cep har safar yangilangan); production'da P7 backfill endpointini bir marta chaqirish. P15 (Landing CMS) alohida sessiyada bajarildi (pastda).

---

# Sessiya hisoboti — TO'LIQ marketing-sayt CMS · 2026-07-09

**Vazifa:** FIXPROMPT SITECMSFULL — landing CMS'ni butun marketing saytga kengaytirish: landing barcha bo'limlari + pricing + plugin sahifalari, bo'lim show/hide + reorder, admin editor kengaytmasi, admin/umumiy JS cache-bust.

**Qilindi (4 commit, oldingi 4 ustiga):**
- Config: `landing-config.ts` blob kengaydi — showcase/aiPromo(kartalar+typing)/pluginPromo/pricingTeaser/faqSection/finalCta/footer + `landingSections` (tartib+ko'rinish) + pricingPage/pluginPage + plans DISPLAY nusxasi. Migratsiya KERAK EMAS (JSON blob). Zod + element-darajali merge; defaultlar = joriy kontent.
- Platforma: barcha marketing matn/bo'limlar bindinglarda; landing main = `ffl-mainflex` (flex order → reorder, display:none → hide; min-width:0 marquee-overflow tuzatildi); pricing/plugin sahifalar + footer config'dan; plans copy markazlashgan (checkout/key/pop kodda).
- Admin: Website tab 5 sub-tab (Hero & theme · Landing sections · Pricing · Plugin · Footer); ↑/↓ reorder + show/hide toggle; generik data-ws kollektor — tab almashsa tahrir yo'qolmaydi, Save hammasini bitta PUT'da; preview'da bo'lim-tartib lentasi.
- Build: `prepare-cf-pages.mjs` endi BARCHA dist HTML'lardagi js/*.js (jamlangan 61 havola, /studio/js va /admin/js shakllari ham) kontent-hash `?v=` bilan chiqaradi.

**Tekshirildi (headless):** defaultlar 1:1; cross-tab edit→Save→landing/pricing/plugin aks etadi; hide (pluginPromo display:none), reorder (FAQ hero'dan keyin), Reset; 401/403; app UI (auth ekrani) default theme'da qoladi (marketing cyan/Georgia bo'lganda ham); API build'da landing xatosi 0 (109 pre-existing prisma-drift xato muhitniki).

**Kutilmoqda:** push (foydalanuvchi), CF Pages + Render deploy. Prod migratsiya kerak emas.
