# Higgsfield AI Tools — chuqur tahlil + AssetFlow uchun "kuchliroq" reja

*Manba: o'rnatilgan CEP `ai.higgsfield.cep` v1.0.14 — bundle + source-map (630 modul, 129 app fayl) tahlilidan.*
*Maqsad: Higgsfield AI tools'ini tushunib, AssetFlow'ga undan kuchliroq versiyasini qurish.*

---

## ⚠️ HANDOFF.md bilan solishtiruv (2026-06-14 holati)

HANDOFF ko'rsatadiki, AI bo'yicha **hech narsa qilinmagan** (qator 413: to'liq OCHIQ) — bu greenfield. Lekin Higgsfield naqshlarini qurish uchun kerakli poydevor AssetFlow'da allaqachon mavjud:

| Higgsfield naqshi (§4) | AssetFlow poydevori — HANDOFF holati | Xulosa |
|---|---|---|
| Job + status polling | 🟢 SSE progress bor (qator 351) — **polling'dan yaxshiroq** | Naqshni SSE bilan olamiz, ustun |
| Natijani R2'ga + import | 🟢 R2 stream-upload (OOM-fix, 3GB) bor (qator 279) | Tayyor |
| Cost-before-generate | 🟢 Subscription gate (`checkDownloadAllowed`) bor (qator 303) | Kredit-narx shu naqshga quriladi |
| Timeline live-link import | 🟡 `host.jsx` + `evalScript` watchdog bor (qator 405), lekin live-link YO'Q | `evalJSX` (2-bosqich) + yangi host fn kerak |
| Model registri | 🔴 YO'Q | `ai.ts` + config (3-bosqich) |
| Credits/balance | 🟡 PluginProfile bor, `aiCredits` YO'Q | Prisma migratsiya (3-bosqich) |

**To'lov bilan bog'liqlik:** HANDOFF (qator 414) Stripe o'rniga **LemonSqueezy**'ni ko'rib chiqyapti. AI kredit-asosli bo'lgani uchun, kredit sotib olish oqimi tanlangan provayderga ulanadi — lekin AI *mantig'i* (gate, generatsiya) provayderdan mustaqil quriladi.

**Xulosa:** "kuchliroq AI" uchun qayta yozish yo'q — poydevor (SSE, R2, auth, gate) tayyor. Bu reja `docs/PLAN-bosqich-3-ai-tools.md` bilan to'liq mos.

---

## 1. Higgsfield AI tools aslida nima (haqiqiy kod)

Bu "bitta generatsiya tugmasi" emas — to'liq AI generatsiya studiyasi. Source-map'dagi `src/js/lib/creative-apps/` butun tizimni ochadi.

### Asosiy bo'limlar (navigatsiya tab'lari)
`main/routes/`: **Image · Video · Cinema Studio · Edit** (+ Reframe, Draw-to-Video, Upscale, Enhance).

### Model katalogi — 24 ta AI model (har biri alohida config fayl)
`config/models/`: `flux_2`, `flux_kontext`, `nano_banana` (+`_2`, `_flash`), `seedream_v4_5`, `seedream_v5_lite`, `grok_image`, `kling_omni_image`, `openai_hazel` (+`_mini`), `imagegen_2_0`, `wan2_2_image`, `z_image`, `text2image_gpt`, `soul_*` (cast/location/cinematic/cinema-studio), `cinematic_studio_*`, `image_auto` (avtomatik tanlash). Video uchun Kling 3.0, Topaz upscale.

### Arxitektura naqshlari (eng muhimi — biz o'rganishimiz kerak)
1. **Job-asosli async generatsiya**: `create-job` → poll `job-details` (status: `pending → queued → processing → completed/failed/nsfw`). TanStack Query polling. AssetFlow SSE shunga mos keladi.
2. **Generatsiyadan OLDIN narx ko'rsatish**: `estimate-job-cost` + `send-button-with-cost-tooltip` — foydalanuvchi tugmani bosishdan oldin necha kredit ketishini ko'radi. **Ajoyib UX**, bizda bo'lishi shart.
3. **Timeline live-link (eng kuchli funksiya)**: `jsx/index.js` host PPRO/AEFT timeline'ni o'qiydi — `getTimelineSelectionLiveLinkReference`, `getActiveTimelineVideoReference`, `exportSourceRangeToTempFile`. Ya'ni: timeline'da klip tanlaysiz → o'sha klipni AI'ga **reference** sifatida beradi (reframe/edit/draw-to-video). Matn prompt emas, haqiqiy timeline kontenti.
4. **Reference media upload**: `upload-reference-media` — rasm yuklab, generatsiyaga asos qilish.
5. **Workspaces** (multi-tenant): `workspaces/select` — jamoa/ish-makonlari.
6. **Credits/balance**: `/balance`, `credits.ts` util. NSFW filtri (15 ref).
7. **GrowthBook flags**: yangi modellar (cinema studio) feature-flag bilan rollout.

### API
Baza `fnf.higgsfield.ai`: `/jobs`, `/jobs/cost`, `/jobs/topaz-video/cost`, `/balance`, `/workspaces`, `/workspaces/select`. Auth: Clerk OAuth (PKCE). Monitoring: Sentry + Amplitude.

---

## 2. Higgsfield NIMADA kuchli (ochiq tan olamiz)

| Kuch | Nega |
|---|---|
| 24 model + video gen | Yillab provayder integratsiyasi; biz buni tezda yeta olmaymiz |
| Timeline live-link | Host'da chuqur PPRO/AEFT integratsiya — klipni reference qiladi |
| Cost-before-generate | Shaffof narx; ishonch |
| Job-polling yetukligi | nsfw/failed/queued holatlari to'g'ri boshqariladi |
| image_auto | Model tanlashni avtomatlashtiradi (foydalanuvchi o'ylamaydi) |

**Halol xulosa:** xom generatsiya kengligida (24 model, video) Higgsfield bilan "ko'proq model" bo'yicha bellashish — yutqazadigan o'yin. Ular yillar sarflagan.

---

## 3. AssetFlow QAYERDA kuchliroq bo'la oladi (Higgsfield'da YO'Q)

Higgsfield — sof generator. **Katalogi yo'q, contributor yo'q, moderatsiya yo'q.** AssetFlow'da bularning hammasi bor. "Kuchliroq AI" = ko'proq model emas, balki **AI'ni AssetFlow'ning noyob aktivlari bilan bog'lash**:

### Differensiatsiya 1 — Template-grounded AI (Higgsfield mutlaqo qila olmaydi)
Higgsfield noldan generatsiya qiladi. AssetFlow'da **moderatsiyalangan shablon katalogi** bor. Demak AI shablon-asosli bo'la oladi:
- **"Shu shablon uchun" generatsiya** — tanlangan .aep shabloniga mos ovoz/SFX/rasm/matn.
- **Placeholder auto-fill** — shablondagi matn/logo joylariga AI bilan kontent.
- **Semantik katalog qidiruv** — "kosmik intro" → katalogdan mos shablonlar (embeddings). Higgsfield'da qidiriladigan katalog yo'q.

### Differensiatsiya 2 — Contributor-side AI (Higgsfield'da contributor yo'q)
- Yuklashda **auto-tagging**, **auto-thumbnail/preview**, **auto-tavsif**. Marketplace sifatini oshiradi.

### Differensiatsiya 3 — Higgsfield'ning eng yaxshi naqshlarini O'ZLASHTIRISH
Raqobat uchun emas, paritet uchun:
- Job-asosli async + cost-before-generate + timeline live-link import + ko'p-provayderli model registri.

**Pozitsiya:** "Higgsfield generatsiya qiladi; AssetFlow esa generatsiya + tayyor shablon bozori + AI ularni bog'laydi." Bu ularning kuchini chetlab o'tadi.

---

## 4. AssetFlow AI Tools — "kuchliroq" arxitektura (3-bosqich rejasini kengaytiradi)

`docs/PLAN-bosqich-3-ai-tools.md` poydevorini saqlab, Higgsfield'dan quyidagilarni qo'shamiz:

### 4.1 Job-asosli model (SSE bilan birga)
- Prisma `AiGeneration`ga `status` (PENDING/QUEUED/PROCESSING/DONE/FAILED) + `cost` + `provider` + `modelId`.
- `POST /api/plugin/ai/job` → job yaratadi → SSE (mavjud `upload-progress` pattern) bilan status uzatadi → natija R2 → import.
- Higgsfield'ning polling o'rniga bizda **SSE** bor — bu ulardan yaxshiroq (realtime).

### 4.2 Cost-before-generate
- `POST /api/plugin/ai/estimate` → `{ credits, ok }`. Tugmada tooltip: "≈ 28 kredit". Higgsfield UX naqshi.

### 4.3 Model registri (ko'p-provayder, kengayadigan)
- `apps/api/src/lib/ai/models/` — har model config (provider, narx-formula, params). `image_auto`dek "avto" tanlash.
- Boshlanishi: ElevenLabs (ovoz/SFX), fal.ai Flux (rasm), OpenAI (embeddings/matn). Keyin qo'shiladi.

### 4.4 Timeline live-link (Higgsfield'ning killer funksiyasi — biz ham qo'shamiz)
- `host.jsx`ga: tanlangan comp/layer'ni reference sifatida eksport (`exportSourceRangeToTempFile` ekvivalenti) → AI'ga yuborish.
- Bu AE-side; `evalJSX` (2-bosqich) ustiga quriladi.

### 4.5 Template-grounded endpointlar (BIZNING differensiatsiya)
- `POST /api/plugin/ai/search` — semantik katalog qidiruv (3a).
- `POST /api/plugin/ai/for-template/:id` — shablon konteksti bilan ovoz/SFX/rasm.
- Contributor: submit oqimida auto-tag/auto-preview.

---

## 5. Realistik yo'l xaritasi (kuchliroq = aqlliroq, ko'proq emas)

| Bosqich | Nima | Higgsfield bilan munosabat |
|---|---|---|
| 3a | Semantik qidiruv + auto-tagging | **Ustun** (ularda katalog yo'q) |
| 3b | Ovoz/SFX (ElevenLabs) + cost-estimate + job/SSE | Paritet + SSE bilan yaxshiroq |
| 3c | Template-grounded generatsiya (rasm/matn shablon uchun) | **Ustun** (noyob) |
| 3d | Timeline live-link reference | Paritet (ularning killer naqshi) |
| 4 | Ko'p model registri, video (fal.ai/Kling proxy) | Paritetga intilish, ehtiyotkor |

---

## 6. Strategik qaror (foydalanuvchi hal qiladi)

Ikki yo'l bor, ikkalasi ham haqiqiy:

**A) Bellashuv (head-to-head)** — 24 modelga proxy, video gen, Higgsfield'ni xom kuchda quvish. Qimmat (provayder xarajati), sekin, ularning maydonida o'ynash.

**B) Differensiatsiya (tavsiya)** — Higgsfield'ning eng yaxshi NAQSHLARINI olib (job, cost-estimate, live-link), lekin AssetFlow'ning katalog+contributor+moderatsiya ustunligi bilan **template-grounded AI** qurish. Arzonroq, mudofaa qilinadigan, noyob.

> Mening tavsiyam: **B**. "Ko'proq model" emas, "aqlliroq, bozorga bog'langan AI". Higgsfield generatsiya qiladi; AssetFlow generatsiya qiladi VA tayyor shablonlar bozori bilan bog'laydi — bu ularda yo'q.

---

## ✅ QABUL QILINGAN QAROR (2026-06-14)

**Strategiya: B — Differensiatsiya.** Higgsfield bilan xom generatsiyada bellashilmaydi.
Yo'l: ularning naqshlarini (job/SSE, cost-estimate, timeline live-link) o'zlashtirib,
AssetFlow'ning katalog + contributor + moderatsiya ustunligi bilan **template-grounded AI** qurish.

**Birinchi o'zlashtiriladigan naqsh: hali tanlanmagan** (cost-estimate / live-link / job+SSE).
3-bosqich kodidan oldin hal qilinadi. `docs/PLAN-bosqich-3-ai-tools.md` shu strategiyaga
mos — §4 (Higgsfield naqshlari) va template-grounded endpointlar shu qarorni aks ettiradi.
