# SESSION REPORT — 2026-07-02 — Faza E: platforma real API'ga ulandi

Master-reja: `~/.claude/plans/sleepy-beaming-lobster.md`. A+D+domenlar bajarilgan edi; bu sessiya = **Faza E**.

## QILINDI
- **`platform/ff-api.js`** (yangi): window.FFAPI klienti — baseUrl auto (localhost→:4000, prod→api.getframeflow.app, meta override), Bearer, 3x retry, global 401→`ff-auth-expired`.
- **`platform/index.html`**: mock → real API. Auth ekran (login/register/forgot, `#auth`), token `localStorage.ff_token`, app-ekranlar gating (`go()`), hash deep-link (`_hashApplied` — entryScreen prop bilan poyga tuzatildi). Dashboard (real ism/kredit/gens/katalog), Marketplace (`/api/plugin/catalog`, thumb, dinamik kategoriya filtri), Detail (real desc/tag/preview-video/download), AI Studio (model katalogi `/gen/models`dan, model-aware chiplar: aspect/quality/resolution/voice/duration, `cost-quote`→`gen`→poll, enhance, delete, yuklab olish), Account (PATCH name, plan, kredit tarixi gen'lardan), logout. Media teglar `preload="none"` (parse-vaqti literal `{{ }}` fetch oldini oladi).
- **Backend**: `serve-asset.ts` pack `?json=1` → `{url}` JSON (web fetch redirect'ni GCS'ga CORS'siz kuzata olmaydi; klient signed URL'ga anchor-navigatsiya qiladi).
- **Halol UX**: kredit sotib olish → "Paddle tez orada" toast (soxta balans YO'Q); yuklamalar tarixi "tez orada" (Faza C); referens yuklash "tez orada".
- **Lokal tekshiruv o'tdi** (localhost:8975 + :4000): login→dashboard→AI Studio (Nano Banana 2, =4 kredit quote, yetarli emas→modal)→marketplace (4 real shablon)→detail→account→logout. Lokal DB migratsiyasi tuzatildi (pgvector stub `--applied`), lokal CORS'ga :8975 qo'shildi (.env, gitignored).

## DEPLOY MEXANIZMI (aniqlandi)
- API deploy = **GitHub Actions** (`.github/workflows/deploy-cloudrun.yml`): main'ga `apps/api/**` push → docker build → Artifact Registry → Cloud Run (WIF, kalitsiz). Qo'lda `gcloud builds submit` ISHLAMAYDI (push retry-xato — ma'lum muammo, kerak ham emas).
- **`CLOUDRUN_ENV_YAML` GitHub secret yangilandi** (02.07 17:05) — eski (01.07) qiymat push'da bugungi domen/CORS env'ini orqaga qaytargan bo'lardi.

## KUTILMOQDA
- **User push** → bir vaqtda: CF Pages (platforma frontend) + GitHub Actions (API `?json=1` + yangi env) deploy bo'ladi.
- Production sinovi push'dan keyin: getframeflow.app login → AI Studio real gen (user@assetflow.uz, 4181 kredit) → pack download (katalog hozir bo'sh — shablon publish kerak).
- Resend DNS, Secret Manager (risk #6), Faza B/C/F/G.
