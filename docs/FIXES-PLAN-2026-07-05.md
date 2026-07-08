# FrameFlow — Muammolar konsolidatsiyasi + ijro rejasi (2026-07-05)

> Manba: (a) foydalanuvchi 22 manual muammo (jonli AE/web test), (b) avtomatik QA-audit
> `docs/PLUGIN-QA-AUDIT.md` (27 topilma: 0 P0 · 1 P1 · 26 P2), (c) Artlist reference (web redesign uchun jamlangan).
>
> IKKI OQIM: **FIX** (bug/UX/backend → to'g'ridan Code prompt) · **DESIGN** (mockup → foydalanuvchi tasdig'i → qurish).
> Konvensiya: commit qil / push QILMA / no Co-Authored-By / pul-zonasi ehtiyot / migratsiya additive.

---

## 5 FAZA (har biri BITTA urinishда bitadi; ketma-ket)

**FAZA 1 — INGLIZ TILI (i18n)** · Fable 5
O'zbek → ingliz: plagin + web + contributor barcha UI matni. Foundational (undan keyingi hammasi ingliz).
→ #24.

**FAZA 2 — BACKEND YADRO (data · sync · billing · pul-zonasi)** · Fable 5 + Extra (pul ehtiyot)
Media chiqsin, plagin↔web sync, o'chirish serverга tarqalsin, kvota, vertex routing, kredit sotib olish, admin plans real.
→ #1, #8, #9 (media) · #17 (chain sync) · #2, #18 (delete→server) · #20 (storage) · #12 (vertex routing+billing bug) · #25 (kredit sotish+balans) · #13 (admin plans real) · #14 (web sessiya).

**FAZA 3 — PLAGIN TUZATISH + SAYQAL** · Fable 5 + Extra
Login, avatar, AI Tools UX, mavzu, kod gigienasi.
→ #3 (login) · #11 (hisob tugma) · #21 (avatar) · #6 (launcher→tool) · #7 (video toggle) · #22 (auto-refresh) · #23 (papka+tozalash) · #19-plagin (modellar re-verify) · #4 (mavzu) · audit (P1 go() + o'lik kod + kosmetik + DEV·DEMO).

**FAZA 4 — PLAGIN HOME REDESIGN** · Fable 5 (mockup → tasdiq → qurish)
→ #5 (Home) + #10 (Home tugma hamma ekranда).

**FAZA 5 — WEB APP REDESIGN (Artlist uslub)** · Fable 5 + Extra (mockup → tasdiq → qurish)
#dashboard'дan keyingi hamma sahifa; landing tegilmaydi; ingliz tilида.
→ #16 (#15 ичida) + #19-web (modellar to'liq, redesigndан keyin).

> Eslatma: Faza 4/5 = dizayn — «mockup → siz tasdiqlaysiz → qurish» (2 qadam, lekin bitta faza).
> Faza 2 eng katta va pul-zonasi — ehtiyot; tugagach jonli smoke-test.

---

## DESIGN oqimi (mockup-first — QURISHDAN oldin tasdiq shart)

- **D1 — Plagin HOME (#5):** chiroyli, jalb qiluvchi landing; undan Shablonlar (Katalog) + AI Tools kirish;
  kredit/reja holati; davom ettirish (so'nggi import + so'nggi gen); tavsiya shablonlar; mehmon onboarding.
  Bilan birga **#10 (Home tugmasi)** + **#11 (Hisob tugmasi)** hamma ekranда. Model: Fable 5.
- **D2 — Web app redesign (#16, #15 shu ичida):** Artlist AI Toolkit uslubида (session rail + kanvas +
  pastki doklangan composer + preset kartalar), FrameFlow brendида. Qamrov: **#dashboard'дan keyingi hamma
  sahifa** (Bosh sahifa/Dashboard · Shablonlar · AI Studio · Loyihalar · Hisob · Plagin). **Landing (#landing)
  TEGILMAYDI.** Reference: Artlist Home + AI Toolkit + Stock Catalog (jamlangan). Model: Fable 5 (Extra).

---

## FIX BATCHlar (tavsiya etilgan tartibда)

### Batch 0 — I18N: O'ZBEK → INGLIZ (foundational) · Fable
- **#24** Plagin + Web + Contributor'дан **o'zbek tilini butunlay olib tashlash → ingliz tili** (barcha UI matni).
  ⚠️ Yangi dizaynlar (D1/D2 mockuplar) ham **INGLIZ tilида** qurilsin (o'zbekcha qurib keyin tarjima QILMA).
  Kod izohlari o'zbek qolishi mumkin; faqat foydalanuvchi ko'radigan matn ingliz.


### Batch 1 — MEDIA & CHAIN (backend, eng og'riqli) · Opus/Fable
- **#1** Katalog: contributor shabloni chiqadi lekin **thumbnail/preview qora** (media yuklanmayapti).
- **#8** AI Tools so'nggi genlar kartalari **qora/bo'sh** (bir xil ildiz).
- **#9** To'liq Tarix sahifasi **"Yuklab bo'lmadi"** — genlar yuklanmaydi (load oqimi buzuq).
- **#17** **Plagin↔Web zanjir** bitta hisob ostida sinxron: plaginда qilingan gen webда (va aksincha);
  kredit/kutubxona/shablon/sevimli umumiy. Shart: plagin login = web login = AYNAN bir User.
- Diagnoz: GCS obyekt ochiq-o'qish / signed-URL / CSP / serve-URL; unified account identity.

### Batch 2 — DELETE & STORAGE (backend) · Opus/Fable
- **#2** Admin shablonni o'chirsa → **GCS bucket fayllari (thumb/preview/pack) ham** o'chsin.
- **#18** User gen o'chirsa → **serverда ham** (GCS media + DB GenAsset + storage kvota bo'shasin).
- **#20** Storage kvota **FREE 1GB / PRO 5GB / STUDIO 20GB** enforce (Bosqich 4 — tasdiqlash) +
  **hisob UI'да ko'rsatish** (X GB / Y GB, plagin + web).

### Batch 3 — VERTEX ROUTING (backend, pul) · Opus
- **#12** Vertex **rasm → rasm GCP loyihasi**, **video → video GCP loyihasi** routing;
  **omni billing bug** (`vertex-omni.ts:93` — video yuklab olish `PROJECT` o'rniga `VIDEO_PROJECT`);
  barcha vertex adapterlar audit (cross-project oqim yo'q). **fal.ts TEGILMAYDI.**
- User config: `GOOGLE_CLOUD_PROJECT_VIDEO` env + service account ikки loyihага ruxsat.

### Batch 4 — AUTH & ACCOUNT (plagin + web) · Fable
- **#3** Plagin login (g2): **email/parol** + **Google device-code** ikkalasi ishlasin (reskin bog'lanishlari).
- **#11** Hisob (avatar) tugmasi **hamma ekranда** (tool ичida yo'qolmasin).
- **#21** **Avatar (profil rasm) yuklash** + almashtirish + plagin/web sinxron.
- **#14** Web login **sessiya persistence** (har safar qayta kirmasin — `.getframeflow.app` HttpOnly cookie / remember-me).

### Batch 5 — PLUGIN AI TOOLS UX + audit kosmetika · Fable
- **#6** Launcher: «Rasm/Video yaratish» → **to'g'ridan tool** (oradagi IMAGE/VIDEO TOOLLAR ekransiz).
- **#7** Video: bitta rejimли modelда **Fast|R2V toggle yashirilsin** (bo'sh joy egallamasin).
- **#22** **Avto-fon yangilanish** + yuqori burchakда **qo'l yangilash tugmasi**.
- **#23** **Yuklab olish papkasi** to'liq (hammasi ko'rsatilgan papkага) + **Tozalash tugmasi** (kesh tozalansa UI ham toza yangilansin, qorayib/error bermasin).
- **#19-plagin** Barcha modellar to'liq ishlasin (model-aware + API) — re-verify.
- **Audit kosmetik:** toast lightbox ustида (F-19), 900px kenglik cheki (F-20), offline banner qoplashi (F-21).

### Batch 6 — PLUGIN THEMES · Fable
- **#4** 3 mavzu (Standart / Liquid Glass / Light Glass) **to'liq va chiroyli** qo'llanishi (butun rang tizimи mavzuга mos).

### Batch 7 — PLUGIN CODE HYGIENE (audit) · Sonnet/Fable
- **P1 (F-01)** `go(id)` `getElementById('v-'+id)` guard.
- O'lik kod tozalash (F-02/F-03 eski AI-tools avlodi + ~25 o'lik funksiya), F-13 keraksiz `/gen/models` so'rovi, F-14 mavjud bo'lmagan id o'qish.
- **DEV·DEMO** toggle'lar production'да yashirilsin.

### Batch 8 — BILLING: ADMIN PLANS + KREDIT SOTIB OLISH · Opus
- **#13** Admin Tariflar **haqiqiy** (hozir brauzer-kesh stub): **limitlar DB-backed + admin-managed + backend enforce**;
  narx = Lemon Squeezy haqiqati bilan izchil (admin display + LS variant).
- **#25** **Kredit sotib olish ishlamaydi** (plagin + web): "Kredit to'ldirish"/paketlar (500/1200/3000) LS checkout'ни
  ochsin (plaginда tashqi brauzер orqali), balans yuklansин (chain/sessiya bilan bog'liq — #17/Batch 1).

### Batch 9 — WEB MODELS (D2 qurilgandan keyin) · Fable
- **#19-web** Webда barcha modellar to'liq (model-aware + API correctness): model/nisbat/sifat/soni/referens/yaxshilash.

---

## Foydalanuvchi config qadamlari (Code emas)
- `GOOGLE_CLOUD_PROJECT_VIDEO` = video loyiha ID + SA cross-project ruxsat (Batch 3).
- Lemon Squeezy webhook/env — allaqачон qisman (Bosqich 3).

## Tavsiya tartib
Batch 1 (media/chain — eng og'riqli) → 2 → 3 → 4 → 5 → 6 → 7 → 8. Design D1/D2 parallel (mockup → tasdiq → qurish). Batch 9 = D2'дан keyin.

---

## HOLAT (2026-07-06)
- **FAZA 1 (ingliz i18n): ✅ TUGADI + PUSH + JONLI.** Commitlar: ba08088 (platform) · b544248 (studio) ·
  980c103 (backend) · 0315ebe (plagin). Web ingliz render, 0 konsol xato. QOLDIQ: `jsx/host.jsx` AE xato
  xabarlari (`Comp topilmadi` +5) → FAZA 3 (plagin)ga qo'shiladi.
- **FAZA 2: 👉 KEYINGI.** Prompt pastda.

---

## FAZA 2 TAYYOR PROMPT (Claude Code'ga bering — Fable 5 + Extra; pul-zonasi)

```
FrameFlow — PHASE 2: backend core (media loading, plugin↔web chain sync, delete propagation, storage, vertex routing, credit purchase, admin plans, web session). Repo: ~/Projects/creative-tools-saas.

MODEL NOTE: Large + MONEY ZONE. Do NOT change credit consume/refund / cost-quote-signing / webhook-idempotency. Additive migrations only. COMMIT PER PART (main, no push, no Co-Authored-By). Diagnose-first where marked.

PART A — MEDIA LOADING (diagnose → fix root) · #1 #8 #9
- #1 Catalog thumb/preview BLACK. Root likely: plain public GCS URL (storage.googleapis.com/<bucket>/<key>) + bucket NOT public-read → 403. Diagnose the real failing request (403/CORS/CSP/expired) in web+plugin, then fix at root: serve thumb/preview via SIGNED URLs (or public CDN) — KEEP pack/.aep PRIVATE.
- #8 Recent-gen cards BLACK. Gens use signed URLs (hydrateGenAssets). Verify EVERY plugin/web render path (recent strip, gallery, lightbox) goes through hydration → fresh signed url; fix stale/unsigned/expired; usable video poster in CEP.
- #9 Full History "Failed to load" — diagnose endpoint/session and fix so gens load.

PART B — PLUGIN↔WEB CHAIN SYNC · #17
One account = one User across plugin (device-code/email) and web (Google/email). Gens/credits/library/downloads/favorites shared both ways. Diagnose account-identity mapping first (same User row?); fix split-identity.

PART C — DELETE PROPAGATION · #2 #18
#2 Admin delete template → delete GCS objects (thumb/preview/pack/scenes) too. #18 User delete gen → GCS media + DB GenAsset + free quota. Owner-only, idempotent.

PART D — STORAGE QUOTA DISPLAY · #20
Verify per-tier quota (FREE 1/PRO 5/STUDIO 20 GB) enforced; expose usage+limit (read-only endpoint if missing); account UI (plugin g1 + web) shows X/Y GB bar.

PART E — VERTEX ROUTING · #12
Image → GOOGLE_CLOUD_PROJECT; video → GOOGLE_CLOUD_PROJECT_VIDEO (fallback main). FIX omni billing bug: vertex-omni.ts ~L93 uses PROJECT for video download → change to VIDEO_PROJECT. Audit vertex-*.ts cross-project. DO NOT touch fal.ts. Note user env: GOOGLE_CLOUD_PROJECT_VIDEO + SA cross-project access.

PART F — CREDIT PURCHASE + BALANCE · #25
Balance shows "—" + top-up broken. Fix balance load (ties to Part B). "Add credits" packs open Lemon Squeezy checkout — plugin via openURLInDefaultBrowser, web via FFAPI.checkout. Verify LS URL + webhook credits right user (do NOT change webhook idempotency/topup).

PART G — ADMIN PLANS REAL · #13
Admin Tariflar = browser-cache stub now. Make plan LIMITS real: DB-backed + admin-editable + backend-enforced (replace aiMonthlyAllotment/downloadLimit constants with DB values, seeded to today's — no visible change). Price = LS's; admin manages display + LS variant. Additive migration; no consume/refund change.

PART H — WEB SESSION · #14
JWT in sessionStorage → cleared on close. Persist: HttpOnly cookie scoped to .getframeflow.app (Secure, SameSite) with existing JWT logic, OR remember-me store. Keep tokenVersion revoke + 401 interceptor. Don't weaken auth.

HARD CONSTRAINTS: money zone untouched (consume/refund/quote/webhook/atomic gate); additive migrations; seed preserves behavior; pack/.aep + private gen media stay PRIVATE (only thumb/preview public/signed); build green (npm run build -w apps/api); studio:sync if studio touched; new UI text in ENGLISH.

VERIFICATION per part (media loads no-403; one-account sync; delete frees GCS+quota; usage endpoint; omni bills VIDEO_PROJECT; packs open checkout + balance loads; plan-limit edit persists+enforces, seed unchanged; session survives reload). Zero console errors; build green.

When finished with EACH part: commit clear concise message (no Co-Authored-By); do NOT push. Final summary: per-part result, diagnosis findings, needs-review, env user must set.
```

