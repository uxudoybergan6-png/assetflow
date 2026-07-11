# FrameFlow — Fix Prompts BATCH4 (2026-07-10, post-launch polish)

> One document. Each problem is a COMPLETE, self-contained prompt for Claude Code. Execute in the
> EXECUTION ORDER, one at a time; each ends with its own commit (no `Co-Authored-By`). **DO NOT PUSH** —
> the USER pushes. USER reviews after each.

## ▶ HOW TO RUN (Claude Code — read this first)
Work through EVERY problem in the EXECUTION ORDER, one at a time, autonomously:
1. Obey the **GLOBAL RULES** for every problem.
2. Do ONE problem fully → **commit** with a clear message (**no `Co-Authored-By`**) → write a 2–3 line
   summary → move to the NEXT. **DO NOT PUSH** (the USER pushes).
3. **All 4 are 🔴 money-zone.** You set PRICES only via the existing `upsertModelPricing` / `updatePricingConfig`
   path and add models via the catalog — you NEVER change `computeGenCost`/`imageUnitCost`, the cost-quote
   HMAC, consume/refund, or `creditUsdValue`. Print every new price WITH its arithmetic and confirm it is
   ABOVE provider cost.
4. **STOP and ask ONLY if** a change would require touching the money-zone core (HMAC/consume/refund/formula),
   a migration can't be additive, or a prompt's assumption doesn't match the code. Otherwise keep going.
5. After the last problem, print a final checklist: each problem → commit hash + one-line result + what the
   USER must do (push, `migrate:deploy`, `install-cep.sh`, set `FAL_KEY`, enable Cloud Text-to-Speech API,
   confirm the spend ceiling).

## GLOBAL RULES (apply to EVERY problem)
- **Money-zone untouchable:** credit consume/refund, cost-quote/HMAC (`lib/gen-quote.ts`, `computeGenCost`/
  `imageUnitCost`, `plugin-profile.ts`), webhook idempotency, any credit VALUE — never change. Flag & stop if a fix needs it.
- **Migrations additive only.** **English UI**; Uzbek code comments.
- **Build:** `platform/index.html` = CF Pages DIRECT source. Admin/shared `js`/`styles` = edit ROOT then `npm run studio:sync`; never edit `studio/`/`admin/` artifacts. Don't touch landing `ffl-`.
- **Plugin:** edit → `install-cep.sh`; AE has no internet (inline SVG, self-host fonts).
- **Reference = INSPIRATION, not a 1:1 copy** — keep FrameFlow's lime/dark identity.
- Minimal, contained diff. Reuse existing components. Don't regress.

## EXECUTION ORDER
> Run in THIS sequence. Logic: **add all new models first** (image-upscale, TTS, video-upscale), then do the
> **pricing pass LAST** so ONE 2× pass covers the whole final catalog (no double-pricing, no catalog conflict).
> `[#N]` = the STABLE section number below (sections are in a different numeric order — follow this run order).

1. **[#1] 🔴** Add **IMAGE Upscale** (Vertex `imagegeneration@002`, x2/x4) — tool + per-card action, web + plugin. Sets its own 2× price. Model: **Fable 5 (+Extra / High)**.
2. **[#4] 🔴** Replace **OpenRouter** voice (Kokoro) with **Google Chirp 3 HD** TTS; disable ALL OpenRouter models. (SFX stays ElevenLabs.) Model: **Fable 5 (+Extra / High)**.
3. **[#2] 🔴** Add **VIDEO Upscale** via **fal.ai** `topaz/upscale/video` — build the fal adapter; USER sets `FAL_KEY`. Model: **Fable 5 (+Extra / High)**.
4. **[#3] 🔴 (LAST)** Pricing engine — correct provider costs + **auto-margin (2×) one-click apply over the FULL catalog** (now incl. the 3 new models) + **Enabled-only** view + confirm the spend ceiling. Model: **Fable 5 (+Extra / High)**.

⚠️ **Same-file caution:** [#1], [#4], [#2] all edit the catalog (`gen-models.ts`) + `platform/index.html` +
the plugin — do them ONE AT A TIME in the order above and RE-READ each file before editing so you don't
regress the previous change. [#3] runs last and edits the pricing libs + admin page + provider costs.

> (Design mockup tasks removed per USER — the mockups + `docs/PLATFORM-REDESIGN-MIX-2026-07-10.md` remain committed for later.)

---

## 1 — 🔴 MONEY-ZONE — Add IMAGE Upscale (Vertex `imagegeneration@002`) as a tool + per-card action (web + plugin)

**Report:** Like Higgsfield's result menu (Use ▾ → **Upscale**), add the ability to **upscale a generated
image card directly** (x2 → 2K / x4 → 4K) from the result card, in the web AND the AE plugin, plus a
standalone **Upscale** tool in the AI Studio. Provider = **Google Vertex Imagen** (`imagegeneration@002`,
GA — no allowlist). Write the **settings, functions, and credit price EXACTLY** — this is money-zone.
(VIDEO upscale is a separate later prompt, #2, via fal.ai — out of scope here.)

**Director's investigation (grounded — trust this):**
- Model catalog: `apps/api/src/lib/gen-models.ts` (`GEN_MODELS`). Each model has `id`, `mode`, `cost`
  (image = fixed credits per image; per-quality cost maps), etc. Examples (image): Nano Banana 2 (1010)
  `quality.cost {1K:4, 2K:8, 4K:16}`; Imagen (1011) `{1K:4, 2K:6}`; Imagen premium (1012) `{1K:6, 2K:10}`.
- Cost/credit flow (**MONEY-ZONE — do NOT change**): `computeGenCost`/`imageUnitCost` (`gen-models.ts`),
  signed `cost-quote`+HMAC (`lib/gen-quote.ts`), atomic consume/refund (`plugin-profile.ts`), webhook
  idempotency. New tools = ADD a catalog entry with the correct `cost`; the flow quotes/consumes/refunds
  automatically. Do NOT alter the formula, HMAC, or consume/refund.
- Vertex adapter already wired: `apps/api/src/lib/ai/vertex-image.ts` (Imagen) — same auth/region/project
  (`GOOGLE_CLOUD_PROJECT`). Upscale = same `…/publishers/google/models/imagegeneration@002:predict` call
  with `parameters:{mode:"upscale", upscaleConfig:{upscaleFactor:"x2"|"x4"}}`, `instances:[{image:{...}}]`.
  Doc: docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-upscale-api.
- Result-card menu: web has "Use ▾" + lightbox (BATCH3 #5/#8/#13); plugin has a result menu — add
  "Upscale" as a sibling action.

**Model:** Fable 5 (+Extra / High) — money-zone backend + adapter + web + plugin. Commit per logical group.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Add an **image Upscale** capability for generated image results, as
> (a) a per-card action ("Use ▾ → Upscale", x2 → 2K / x4 → 4K) and (b) a standalone AI Studio tool — in
> BOTH the web (`platform/index.html`) and the AE plugin (`plugins/after-effects-cep/AssetFlow_Plugin.html`),
> powered by Google Vertex Imagen. Models live in `apps/api/src/lib/gen-models.ts` (`GEN_MODELS`); cost
> flows through `computeGenCost`/`imageUnitCost` → signed `cost-quote`+HMAC (`lib/gen-quote.ts`) → atomic
> consume/refund (`plugin-profile.ts`). Vertex adapter: `ai/vertex-image.ts`. Endpoint: Imagen upscale
> `imagegeneration@002:predict` with `parameters.mode="upscale"`, `upscaleConfig.upscaleFactor` "x2"/"x4",
> `instances:[{image:{ bytesBase64Encoded | gcsUri }}]`. (VIDEO upscale is NOT in this task — that's #2 via fal.)
>
> **🔴 MONEY-ZONE — READ TWICE.** Do NOT change `computeGenCost`/`imageUnitCost` formulas, the cost-quote
> signing/HMAC, consume/refund, or any existing credit VALUE. You ONLY ADD a new catalog entry (with the
> correct `cost`) + adapter routing + UI. If anything forces a change to the pricing formula or signing,
> STOP and flag.
>
> **PRICING — derive EXACTLY from the project's OWN constants (do not hardcode a guessed rate).**
> 1. `USD_PER_CREDIT` = Pro plan price ÷ Pro credit allotment (read from `js/data.js` / `plugin-profile.ts`
>    / plan config — resolve the 1000-vs-1500 credit question from the CODE, whichever it actually grants).
> 2. Target margin = the same the existing image models use (Nano/Imagen tiers) — ~1.3–1.5× provider cost.
> 3. **CONFIRMED official Vertex price (2026-07, USER-verified on the Imagen pricing page):**
>    **`imagegeneration@002` (Imagen 1/2) Upscaling to 2K/4K = $0.003 per image.** (For reference, the newer
>    **Imagen 4 upscale = $0.06/image** — better quality; use `imagegeneration@002` for now.)
> 4. **Set FIXED credits per factor: x2 → 2K = `4` credits, x4 → 4K = `8` credits.** These are far above the
>    $0.003 provider cost (huge margin) and consistent with existing image tiers (Imagen gen 2K=6, Nano
>    4K=16 → upscale ≤ a same-size generation). At the project's `USD_PER_CREDIT` (read it from the code;
>    ~$0.019) that's 4cr≈$0.076 / 8cr≈$0.152 vs $0.003 cost = ~25–50× margin — safe. State the final prices +
>    `USD_PER_CREDIT` in your summary; never price below provider cost.
>
> **TASK (commit per logical group).**
> A. **Backend catalog + cost.** Add one image-upscale catalog entry (`mode:"image"`, provider vertex,
>    `enabled:true`) with a factor setting x2 (→2K) / x4 (→4K) mapped to fixed per-factor credits from
>    PRICING. Reuse the existing image cost path (`imageUnitCost`/quality.cost pattern) — do NOT special-case
>    the formula.
> B. **Backend adapter + job.** Route it in `vertex-image.ts` to `imagegeneration@002:predict` with
>    `mode:"upscale"` + `upscaleConfig.upscaleFactor`. Input = the source generation's image (reuse the
>    existing signed-asset / gen→input mechanism; also allow an uploaded image). Store + return output like
>    other image gens. Refund on failure via the EXISTING path (unchanged).
> C. **Web UI.** Add **Upscale** to the image result card "Use ▾" menu + lightbox (x2/x4) and as a
>    standalone tool in the AI Studio composer (pick an image result or upload → choose factor → show ✦ cost
>    from the signed quote → Generate). Reuse the existing quote→consume→poll→refund flow.
>    `platform/index.html` (+ `studio:sync` if any shared `js/`).
> D. **Plugin UI.** Add the same **Upscale** action to the AE plugin image result menu + as a tool (x2/x4),
>    reusing the plugin's existing gen/credit/quote flow. Inline SVG; then
>    `bash plugins/after-effects-cep/scripts/install-cep.sh`.
> E. Show the ✦ cost clearly BEFORE confirm (from the signed quote) and gate on balance.
>
> **CONSTRAINTS.** MONEY-ZONE flow byte-for-byte unchanged (only a new catalog entry + adapter routing +
> UI). Migrations additive only (likely none). English UI; Uzbek comments. Don't touch landing `ffl-`.
> Confirm the Imagen upscale model ID/params + the per-image price against live docs before shipping numbers.
> IMAGE ONLY — do not add video upscale here.
>
> **VERIFY.** (1) Print `USD_PER_CREDIT`, the margin, and the FINAL credit prices for x2 and x4 WITH the
> arithmetic. (2) Show `computeGenCost` returns those exact numbers and the cost-quote/consume/refund path
> is unchanged (git-diff the money-zone files = no logic change). (3) Web + plugin: Upscale appears on image
> cards + as a tool, shows ✦ cost; dry validation (no real spend unless USER opts in). USER must push +
> `install-cep.sh`.
>
> When finished: (a) commit per logical group (no Co-Authored-By); do NOT push. (b) summary with the exact
> prices + derivation.

---

## 2 — 🔴 MONEY-ZONE (AFTER #1) — Add VIDEO Upscale via fal.ai Topaz (`fal-ai/topaz/upscale/video`)

**Report:** Add video Upscale (on a generated OR uploaded video) as a per-card action + standalone tool,
web + plugin, using **fal.ai Topaz** (industry-standard, deterministic per-second price, Commercial/resell
✅). Chosen over Veo (which is private-preview/allowlist). **Requires building a minimal fal adapter first**
(no `fal.ts` yet). USER provides `FAL_KEY`.

**Director's investigation (EXACT — from the official fal Topaz API, USER-provided):**
- **fal adapter does NOT exist** (`apps/api/src/lib/ai/fal*.ts` absent). Build a minimal one per
  `docs/FAL-DOCS-CORE.md`: queue submit → poll status → fetch result, download → store in R2 like other gens.
- **Model ID:** `fal-ai/topaz/upscale/video` · category video-to-video.
- **Endpoint (queue):** `POST https://queue.fal.run/fal-ai/topaz/upscale/video` → status `GET
  https://queue.fal.run/fal-ai/topaz/upscale/video/requests/{request_id}/status` → result `GET
  .../requests/{request_id}`. **Auth header:** `Authorization: Key $FAL_KEY`.
- **Input:** `video_url` (required); `model` (default `"Proteus"` — best for most; `"Gaia 2"` = animation/
  motion-graphics at 2×, **costs HALF**); `upscale_factor` (float 1–4, default 2); `target_fps` (16–60 →
  enables frame interpolation); optional `compression`/`noise`/`halo`/`grain`/`recover_detail`/`H264_output`.
- **Output:** `{ "video": { "url", "file_size?", "content_type?" } }` (upscaled MP4).
- **PRICING (EXACT, per second of OUTPUT video):** **$0.01/s** for output ≤720p · **$0.02/s** for 720p→1080p
  · **$0.08/s** for >1080p. **Price ×2 for 60fps output.** **`Gaia 2` model = ×0.5.** Tier is set by the
  OUTPUT resolution = source_res × `upscale_factor`.
- Money-zone flow unchanged (add catalog entry + adapter + UI only), same discipline as #1.

**Model:** Fable 5 (+Extra / High). **Do AFTER #1.** Commit per logical group.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Add **video Upscale** via fal.ai Topaz. NO fal adapter exists
> (`apps/api/src/lib/ai/fal.ts` absent) — build a minimal one per `docs/FAL-DOCS-CORE.md`: auth header
> `Authorization: Key $FAL_KEY`, `POST https://queue.fal.run/fal-ai/topaz/upscale/video`, poll
> `.../requests/{id}/status`, fetch `.../requests/{id}` → `output.video.url` → download → store in R2 like
> other gens. Money-zone flow (`computeGenCost` → cost-quote/HMAC → consume/refund) is UNCHANGED — you ONLY
> add a catalog entry + the fal adapter + UI.
>
> **Model & params:** `fal-ai/topaz/upscale/video`. Input: `video_url` (source gen's video or uploaded),
> `upscale_factor` (2 or 4 — expose these two), `model` default `"Proteus"` (optionally offer `"Gaia 2"` for
> motion-graphics = half price). Output `{video:{url}}`.
>
> **🔴 MONEY-ZONE — EXACT PRICING.** fal Topaz price = per second of OUTPUT video, resolution-tiered:
> **$0.01/s ≤720p · $0.02/s 720→1080p · $0.08/s >1080p; ×2 if 60fps output; ×0.5 if model=Gaia 2.** The tier
> is decided by OUTPUT resolution = source resolution × `upscale_factor`. Add a `video-upscale` catalog entry
> (`mode:"video"`, provider `fal`, `enabled:true`) whose cost is **resolution-tiered credits per second**.
> Compute the credit/s at each tier = round-up( tier_USD × margin ÷ `USD_PER_CREDIT` ), where `USD_PER_CREDIT`
> and the ~1.3–1.5× margin are read from the project's own constants (as in #1). The signed **cost-quote must
> compute the tier server-side** from the source video's resolution × upscale_factor (× fps × Gaia factor) ×
> duration — deterministic, so the user sees the exact ✦ cost before consuming. `computeGenCost` already does
> video = cost/s × duration; the resolution-tier selection is a SMALL ADDITIVE extension to the catalog entry
> (a tier→rate map), NOT a change to the formula/HMAC/consume/refund. If it can't be additive, STOP and flag.
> **State the final credit/s for each tier (≤720p / 1080p / >1080p, and the 60fps + Gaia variants) WITH the
> arithmetic.** Sanity guide only (confirm from real constants): at ~$0.019/cr, 1.5×: ≤720p ≈ 1 cr/s, 1080p ≈
> 2 cr/s, >1080p ≈ 6–7 cr/s (×2 for 60fps).
>
> **TASK (commit per logical group).** A. Minimal fal adapter (auth/submit/poll/download→R2) + env `FAL_KEY`
> (document it; USER sets it; if missing → model behaves like `enabled:false`, no charge). B. `video-upscale`
> catalog entry with the tiered per-second cost + the tier-selection logic in the quote. C. Adapter routes to
> `fal-ai/topaz/upscale/video` with `video_url` + `upscale_factor` (+ `model`). D. Web UI: **Upscale** on
> video result cards ("Use ▾") + as a tool (choose 2×/4×, optional Gaia-2 for motion; show the ✦ cost from
> the signed quote before Generate). E. Plugin UI: same on video cards + tool; `install-cep.sh`. F. Refund on
> failure via the existing path. G. Store the source video's resolution+duration if not already available so
> the quote can compute the tier (reuse existing gen metadata where possible).
>
> **CONSTRAINTS.** MONEY-ZONE byte-for-byte unchanged (new catalog entry + tier map + fal adapter + UI only;
> no change to the HMAC/consume/refund/formula). English UI; Uzbek comments. USER sets `FAL_KEY`.
>
> **VERIFY.** Print the final credit/s for each tier + the arithmetic; show a worked example (e.g. a 6s 1080p
> output → exact ✦ cost); show `computeGenCost` output + an unchanged money-zone git-diff; web+plugin Upscale
> on video cards with the ✦ cost shown pre-consume; note `FAL_KEY` the USER must set. Commit per group; do NOT push.

---

## 3 — 🔴 MONEY-ZONE — Pricing engine: correct provider costs + auto-margin (2×) + Enabled-only view

**Report:** Three linked improvements to the admin **Pricing management** so pricing is correct, simple, and
self-maintaining: **(a)** set each enabled model's real **provider cost** (`estCostUsd`) from the confirmed
Google/fal prices; **(b)** an **auto-margin** action — set a global **target margin = 2×** and one click
**derives every enabled model's credit price = ceil(providerCost × margin ÷ creditUsdValue)** (so the admin
never hand-calculates, and can't silently lose money); **(c)** default the table to **Enabled-only** (hide
the disabled `openrouter`/`fal` backups that show scary negative margins). This fixes the under-priced
models automatically (Nano Banana Pro, Veo 3.1 Standard, Gemini Omni) instead of manual edits.

**Director's investigation (grounded — trust this):**
- The pricing plumbing already EXISTS: `apps/api/src/lib/model-pricing.ts` (`ModelPricing` DB rows —
  per-model `cost`/`qualityCost`/`videoPerSec`/**`estCostUsd`**; `PricingConfig` singleton —
  **`creditUsdValue`** $0.019 + **`marginTarget`** default 1.8; `upsertModelPricing`, `updatePricingConfig`,
  `listPricingView`); `lib/model-margin.ts` (`computeMargins` → per-model margin + `belowTarget` flag);
  `lib/provider-cost.ts` (`estimateProviderUsd`). Admin page = `js/admin-business.js` (Pricing management),
  backed by admin.ts pricing GET/PATCH. The cost-quote already SIGNS the resolved price (DB or static) — so
  changing the stored price via `upsertModelPricing` is the SAFE, intended path; `computeGenCost`/HMAC/
  consume/refund are NOT altered.
- **CONFIRMED provider costs (USER-verified on official pricing pages, 2026-07):**
  - Image (per image): Nano Banana 2 **$0.040** · Nano Banana 2 Lite **$0.020** · Nano Banana Pro **$0.100**
    · Imagen 4 **$0.040** · Imagen 4 Ultra **$0.060** · image-upscale (`imagegeneration@002`) **$0.003**.
  - Video (per second, at FrameFlow's actual config): Veo 3.1 Lite (720p, no audio) **$0.03/s** · Veo 3.1
    Fast (no audio) 720p **$0.08/s**, 1080p **$0.10/s** · Veo 3.1 Standard (**audio**, 720p/1080p) **$0.40/s**
    · Gemini Omni Flash (720p + audio video output) **$0.10/s** (≈ $1.00 per 10 s gen).
  - Voice/SFX: Kokoro TTS (OpenRouter) is being replaced in #4; ElevenLabs SFX is cheap (confirm on the page).
  - **fal Seedance (video, USER-verified — KEEP these):** Seedance 2.0 Fast 720p **$0.2419/s**; Seedance 2.0
    R2V 720p **$0.3034/s**, 1080p **$0.682/s**, and **×0.6 when a video input is provided** (720p+video-input
    ≈ $0.1814/s). fal video cost is resolution + video-input dependent (like Topaz) — set per-resolution.
    NOTE: the current admin shows these UNDER-costed ($0.200) but OVER-priced on credits (48/60 cr/s ≈ 3.7×);
    at 2× they get CHEAPER (Fast 720p ≈ 26/s, R2V 720p ≈ 32/s) — no loss, just more competitive.
- At 2× ($0.019/cr) the derived prices: Nano Pro 8→**11**, Veo Fast 1080p 8→**11** (720p stays 8), Veo 3.1
  Standard 30→**42**, Gemini Omni 80→**~105** (or perSec 11/s), Seedance Fast 48→**26/s**, Seedance R2V
  60→**32/s** (720p). The rest already ~2×.
- **SAFETY NET (already built):** `apps/api/src/lib/spend-guard.ts` enforces a GLOBAL provider-USD spend
  ceiling + daily cap (kill-switch) BEFORE consuming credits. So even if a price is ever wrong, total loss
  is bounded by the ceiling. Confirm it's enabled + set to a sensible value (the USER's Google credit budget).

**Model:** Fable 5 (+Extra / High) — money-zone pricing engine + admin UI. Commit per logical group.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Pricing plumbing already exists: `apps/api/src/lib/model-pricing.ts`
> (`ModelPricing` rows with `cost`/`qualityCost`/`videoPerSec`/`estCostUsd`; `PricingConfig` singleton
> `creditUsdValue`=$0.019 + `marginTarget`=1.8; helpers `upsertModelPricing`, `updatePricingConfig`,
> `listPricingView`, `seedModelPricing`), `lib/model-margin.ts` (`computeMargins` + `belowTarget`),
> `lib/provider-cost.ts` (`estimateProviderUsd`). Admin UI = `js/admin-business.js` (Pricing management),
> backed by the admin.ts pricing GET/PATCH endpoints. The signed cost-quote uses the RESOLVED price (DB
> overlay or static), so setting prices via `upsertModelPricing` is the intended, safe path.
>
> **🔴 MONEY-ZONE.** Do NOT change `computeGenCost`/`imageUnitCost`, the cost-quote signing/HMAC,
> consume/refund, or `creditUsdValue`. You set PRICES only through the existing `upsertModelPricing` /
> `updatePricingConfig` path. Every new price MUST be printed with arithmetic and be ABOVE provider cost.
>
> **TASK (commit per logical group).**
> A. **Set target margin = 2.0** via `updatePricingConfig` (from 1.8). Keep `creditUsdValue` = $0.019.
> B. **Set each enabled model's `estCostUsd` (provider cost)** to the CONFIRMED values above
>    (`upsertModelPricing` `estCostUsd`). For video, set the per-resolution real cost in the model's
>    `videoPerSec`-equivalent reasoning (Veo Fast 720p $0.08 / 1080p $0.10; Veo Std audio $0.40; Veo Lite
>    $0.03; Omni $0.10/s). Image models: the per-image `estCostUsd` above.
> C. **Auto-margin apply.** Add a backend helper + admin action "Apply target margin" that, for each ENABLED
>    model, computes the credit price = `ceil(estCostUsd × marginTarget ÷ creditUsdValue)` and writes it via
>    `upsertModelPricing`:
>    - image → `qualityCost`/`cost` per quality tier (derive from per-image cost);
>    - video → `videoPerSec` per resolution = `ceil(costPerSec[res] × margin ÷ creditUsdValue)` (so Veo Fast
>      720p=8, 1080p=11; Veo Std=42; Veo Lite=3; Omni≈11/s or flat ~105/10s — match the model's pricing mode).
>    Expose it as a button on the Pricing page (global "Apply 2× margin to all enabled" + a per-row "auto"
>    quick-set). After applying, the page's live margin should read ~2× for every enabled model.
> D. **Enabled-only default view** on the Pricing page (`js/admin-business.js`): default shows only enabled
>    models; a "Show all" toggle reveals disabled `openrouter`/`fal` backups, dimmed with a "Disabled" badge
>    and NO red negative margin (show "—"/"not charged"). Keep the per-row edit (pencil) + credit-value
>    control. Then `npm run studio:sync`.
> E. Keep `computeMargins`/`belowTarget` working so the page still flags any model that later drifts below 2×.
>
> **CONSTRAINTS.** MONEY-ZONE: prices set ONLY via `upsertModelPricing`/`updatePricingConfig`; no change to
> computeGenCost/HMAC/consume/refund/creditUsdValue. Additive migrations only (schema already has the fields).
> English UI; Uzbek comments. Edit ROOT `js/` then `studio:sync`; don't touch landing `ffl-`.
>
> **VERIFY.** Print, for every ENABLED model: provider cost → derived credit price WITH the arithmetic → live
> margin (should be ≥ ~2×, none below provider cost). Screenshot the Pricing page: enabled-only default,
> "Apply 2× margin" sets all margins to ~2× (Nano Pro 11, Veo Std 42, Omni ~105…), "Show all" reveals dimmed
> disabled rows. Confirm a git-diff shows NO change to computeGenCost/HMAC/consume/refund. USER must push +
> `migrate:deploy` (if any).
>
> When finished: (a) commit per logical group (no Co-Authored-By); do NOT push. (b) summary with the final
> per-model prices + arithmetic.

---

## 4 — 🔴 MONEY-ZONE — Replace OpenRouter voice (Kokoro) with Google Chirp 3 HD TTS; disable OpenRouter

**Report:** Move fully to Google: replace the only enabled OpenRouter model — **Kokoro TTS** (Voice) — with
**Google Chirp 3 HD** (Google Cloud Text-to-Speech, HD voices, many languages). Disable all remaining
OpenRouter models (image backups, already `enabled:false` — clean them). **SFX stays ElevenLabs** (Google
has no text-to-SFX; Lyria is music, not SFX). Higher voice quality + one provider (Google) for image/video/
voice.

**Director's investigation (grounded — trust this):**
- Voice model: `gen-models.ts` id **2001** Kokoro TTS, key `hexgrad/kokoro-82m`, no `provider` → defaults to
  **openrouter**, `cost:3`, `voices: KOKORO_VOICES`. It's the only ENABLED OpenRouter model. Other OpenRouter
  entries are `enabled:false` backups.
- SFX: id **4001** ElevenLabs SFX, `provider:"elevenlabs"` — KEEP (not OpenRouter).
- Google replacement: **Chirp 3 HD** via Google Cloud Text-to-Speech (`texttospeech.googleapis.com` /
  Vertex) — same GCP project/auth as the other Vertex models. **Price = $0.00003 / character ($30 / 1M
  chars); 1M chars/month free.** Supports many HD voices + languages; no SSML/pitch on Chirp 3 HD.
- Pricing is per-CHARACTER (new dimension) — a flat per-gen credit is unsafe for long text. Use a
  character-based price (or a flat credit with a character cap) so long voiceovers can't be sold below cost.

**Model:** Fable 5 (+Extra / High) — new Google TTS adapter + catalog + pricing + UI. Commit per logical group.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Replace the Voice model. Current: `gen-models.ts` id 2001 "Kokoro TTS"
> (key `hexgrad/kokoro-82m`, provider defaults to openrouter, cost 3, `KOKORO_VOICES`). SFX id 4001
> ElevenLabs stays. Add **Google Chirp 3 HD** via Google Cloud Text-to-Speech (`texttospeech.googleapis.com`;
> auth via the existing GCP service account / `GOOGLE_CLOUD_PROJECT`, same as `ai/vertex-*.ts`). Price =
> **$0.00003/char ($30/1M chars)**. Money-zone flow (cost-quote/HMAC/consume/refund) unchanged — you add a
> catalog entry + adapter + pricing via the existing `upsertModelPricing` path.
>
> **TASK (commit per logical group).**
> A. **Adapter.** Add `apps/api/src/lib/ai/google-tts.ts` calling Google Cloud Text-to-Speech
>    (`text:synthesize`, voice = a Chirp 3 HD voice, `audioConfig` mp3), returning audio stored in R2 like
>    other gens. Reuse the existing GCP auth/project. Map a set of Chirp 3 HD voices (+ languages) to the
>    model's `voices`.
> B. **Catalog.** Add a `mode:"voice"` model "Chirp 3 HD" (provider `vertex`/`google-tts`, `enabled:true`,
>    `isDefault:true` for voice), routed to the new adapter. Move `KOKORO_VOICES` → Chirp voices.
> C. **Disable OpenRouter.** Set Kokoro TTS (2001) `enabled:false`, and ensure ALL `provider:"openrouter"`
>    models are `enabled:false`. Voice default → Chirp 3 HD.
> D. **Pricing (money-zone, via `upsertModelPricing`).** Chirp 3 HD is per-character. Set a credit price that
>    holds ≥2× margin: e.g. charge per N characters — credits = `ceil(chars × $0.00003 × 2 ÷ $0.019)` — OR a
>    flat per-gen credit with a hard character cap so it can never be sold below cost (state which you chose +
>    the arithmetic; a ~1000-char voiceover ≈ $0.03 → ~3–4 credits at 2×). Record `estCostUsd`.
> E. **UI.** Web (`platform/index.html`) + plugin voice tool: show Chirp 3 HD + its voices, and the ✦ cost
>    from the signed quote. `studio:sync` for shared `js/`; `install-cep.sh` for the plugin.
>
> **CONSTRAINTS.** MONEY-ZONE: no change to computeGenCost/HMAC/consume/refund; prices via `upsertModelPricing`.
> SFX (ElevenLabs) untouched. English UI; Uzbek comments. Additive migrations only. USER sets any needed env
> (e.g. Cloud TTS enabled on the GCP project — note it). Don't touch landing `ffl-`.
>
> **VERIFY.** A voiceover generates via Chirp 3 HD (describe a live/dry test), stored + played back; Kokoro +
> all OpenRouter models are disabled (no longer selectable / no charge); the ✦ cost shows and holds ≥2×
> margin with the arithmetic; SFX still works via ElevenLabs; no money-logic git-diff. USER must enable Cloud
> Text-to-Speech API on the GCP project + push/deploy + `install-cep.sh`.
>
> When finished: (a) commit per logical group (no Co-Authored-By); do NOT push. (b) summary with the voice
> price + arithmetic + the GCP API the USER must enable.

---
