# FIX-PROMPTS-R4 — Round 4 (owner dictation, 2026-07-20)

Fresh round of problems dictated by the owner, one at a time. For each reported problem
the Director finds that problem AND the related/adjacent problems around it, then writes
a self-contained Code prompt. Tasks numbered **R4_01, R4_02, …** (fresh from the start;
own prefix — never collides with the SC_xx or earlier sequences). Earlier rounds are
DONE and live in `FIX-PROMPTS-SC*`. Default scope for every task: BOTH plugin and web
unless stated. Final ordering after the round ends.

---

## GLOBAL RULES (apply to EVERY prompt below)

- 🔴 **MONEY ZONE FROZEN:** never change credit consume/refund, the signed cost-quote /
  HMAC (`apps/api/src/lib/gen-quote.ts`), the bodies of `computeGenCost`/`imageUnitCost`,
  webhook idempotency, or ANY EXISTING model's price value. Adding a NEW model with a NEW
  price is allowed, but the new price MUST follow the repo's margin rule and the boot
  pricing-floor assertion must still pass (a channel sold below cost refuses to boot).
- **Truth sources (read before changing anything):** `docs/BYTEPLUS-DOCS-MODELS.md`
  (exact per-model schema/pricing), `docs/BYTEPLUS-ANALYSIS.md`, `docs/FAL-*.md`,
  `docs/GEN-MODEL-MATRIX.md`, `apps/api/src/lib/ai/byteplus.ts` (adapter),
  `apps/api/src/lib/gen-models.ts` (catalog), `apps/api/src/routes/studio-gen.ts`
  (validation + job run). Do NOT guess provider behavior; if a field is missing in the
  repo docs you may fetch the official provider doc for THAT field only.
- **Verify against live, not stale:** restart the local API after any gen-models change
  so you test your edit; run `verify-gen-payloads.mjs` (extend it for new models); do
  ONE real cheap generation per newly-enabled model end-to-end.
- **Clients are catalog-driven** (confirmed in SC_57): both web and plugin build their
  model picker + per-model composer controls from `GET /api/studio/gen/models` with no
  hardcoded allow-list, so a complete catalog entry appears in BOTH automatically — no
  plugin/web edits needed unless a new capability isn't in the capability map.
- **Additive only.** `npm run build -w apps/api` must pass. English UI; Uzbek comments.
- **When finished:** commit with a clear concise message (no Co-Authored-By); do NOT
  push. Write a short summary.

---

## R4_01 — Add Seedance 2.0 Mini (BytePlus) — activation-gated

**Problem (owner report + model detail screenshot).** The owner wants Seedance 2.0 Mini
added. In SC_57 it probed as `ModelNotOpen` (not activated). The owner is now on its
detail page — it may have been activated since, or not. Add it correctly, but do NOT
ship it enabled unless it is actually callable.

**Model spec (from the BytePlus detail page):**
- Model ID: `dreamina-seedance-2-0-mini-260615` · mode: video
- Resolution: 720p, 480p · Duration: 4–15s · 24fps
- Task types: multimodality-to-video · video editing · video extension
- Modalities in: Text, Image, Audio, Video → out: Video (multimodal references)

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Scope: apps/api (gen-models.ts catalog + byteplus.ts
adapter if needed). Truth sources: docs/BYTEPLUS-DOCS-MODELS.md, docs/BYTEPLUS-ANALYSIS.md,
apps/api/src/lib/ai/byteplus.ts, and the existing Seedance entries (3102 = Seedance 2.0,
3101 = Seedance 2.0 Fast) as the template. Local stack: `npm run studio` (API :4000).
🔴 MONEY GUARD: no changes to consume/refund, cost-quote/HMAC, computeGenCost/
imageUnitCost bodies, webhook idempotency, or any EXISTING model price. New price follows
the repo margin rule; boot pricing-floor assertion must still pass.

TARGET — Seedance 2.0 Mini:
  ModelArk ID `dreamina-seedance-2-0-mini-260615`, video, resolutions 720p+480p,
  duration 4-15s, 24fps, tasks: multimodality-to-video + video editing + video
  extension, multimodal refs (text/image/audio/video in).

STEP 1 — VERIFY ACTIVATION FIRST (exactly as SC_57 did): submit a minimal raw task to
the BytePlus API with this model ID using the project's key/region.
- Returns `ModelNotOpen` / not-activated → do NOT enable. Add the catalog entry with
  `enabled:false` + comment "activate prepay pack in BytePlus console"; report it as an
  OWNER ACTION; stop before enabling.
- Submits/polls OK → proceed to enable.
STEP 2 — CATALOG ENTRY modeled on 3102/3101: correct byteplusModel ID, mode,
referenceMode, resolutions (720p/480p), duration range 4-15s (note if it differs from
other Seedance entries and honor it), frame/reference support per docs + adapter. Reuse
the existing Seedance adapter path in byteplus.ts; extend ONLY if Mini needs a param the
adapter doesn't build (additive). Price from Mini's official BytePlus cost via the margin
rule (Mini is "cost-effective" → likely cheaper than 3102; use the docs/usage rate, do
not guess). Never below cost.
STEP 3 — VERIFY: extend/run verify-gen-payloads.mjs so Mini (if enabled) passes
/gen/cost-quote (default + rich); if activated, run ONE real 480p/4s gen end-to-end and
confirm it completes. If left disabled, skip the gen check and confirm the catalog still
builds and all OTHER models still PASS.
STEP 4 — confirm the /gen/models endpoint serves Mini for video mode (if enabled); no
plugin/web edits expected (catalog-driven).

RULES: additive only; build passes; restart the API before verifying; do not push.

DELIVERABLE (summary): activation probe result (activated? / ModelNotOpen), the entry
added + price + enabled state, verification result, and any owner action.
```

**Model:** Fable 5 (High). Single-model catalog addition next to the money zone,
activation-gated.

---

## R4_02 — Integrate Kling AI (DIRECT API) — add Kling 3.0 models only (video + image)

**Director's analysis (owner provided the Kling API docs; I read them fully).**
- The repo ALREADY has placeholder Kling v3.0 entries (gen-models.ts ids 3004
  `kwaivgi/kling-v3.0-std`, 3005 `kwaivgi/kling-v3.0-pro`) but they are `enabled:false`
  ("B6: fal'ga ulanmagan") — they were meant to route through fal.ai and were never
  wired. The owner instead supplied the DIRECT Kling API. Mirroring the earlier
  fal→BytePlus direct-migration decision (direct = cheaper, no fal markup), we build a
  DIRECT Kling provider, NOT a fal route.
- Kling is a NEW provider (not BytePlus): new adapter `apps/api/src/lib/ai/kling.ts`,
  new `provider: "kling"` in the gen-models type + gen-processor switch.
- Only Kling 3.0 family (owner: "faqat eski modellari kerak emas"): Kling 3.0,
  3.0 Turbo, 3.0 Omni (video); Kling Image 3.0, Image 3.0 Omni. Skip all ≤2.x.

**Kling API facts (from the docs at `/Users/usmonov/Projects/kling Ai/`):**
- Domain: `https://api-singapore.klingai.com` · Auth header:
  `Authorization: Bearer <API_KEY>` (simple API key; JWT is legacy-only — use the API
  key). New key/secret env needed.
- Async: submit → poll. Query: `GET /tasks?task_ids=<id>` (or `external_task_ids=`) →
  `data[].status` ∈ submitted/processing/succeeded/failed, `data[].outputs[].url`
  (video/image); results expire after 30 days → must copy to our storage (GCS/R2).
- VIDEO (per-second billing, like Seedance):
  - Text-to-video: `POST /text-to-video/kling-3.0`, body `{prompt, settings:{multi_shot,
    audio:"native"|"off", resolution:"720p"|"1080p"|"4k", aspect_ratio:"16:9"|"9:16"|
    "1:1", duration:3..15}, options:{callback_url, external_task_id, watermark_info:
    {enabled:false}}}`.
  - Image-to-video: `POST /image-to-video/kling-3.0`, body `{contents:[{type:"prompt",
    text}, {type:"first_frame", url}, {type:"last_frame", url}, {type:"element",
    element_id,id}], settings:{...}, options:{...}}`.
  - Turbo: `POST /image-to-video/kling-3.0-turbo` (native audio; check the Turbo doc for
    its exact settings).
  - Omni video (with video input): see "Kling 3.0 & 3.0 Omni Omni Video Generation.txt"
    for its endpoint/params.
- IMAGE (per-image billing, like Seedream): `POST /v1/images/generations`, body
  `{model_name:"kling-v3", prompt, negative_prompt?, image?, image_reference?:"subject"|
  "face", resolution:"1k"|"2k", n:1..9, aspect_ratio:(16:9/9:16/1:1/4:3/3:4/3:2/2:3/
  21:9)}`; Image 3.0 Omni adds 4k. Query result via its own GET (see image doc).
- PRICING (USD, from the docs — feed the margin rule; do NOT hardcode credits, compute
  via the repo rule):
  - Kling 3.0 video: 720p $0.084/s · 1080p $0.112/s · 4k $0.42/s (no audio);
    +audio(no voice ctrl) 720p $0.126/s · 1080p $0.168/s.
  - Kling 3.0 Turbo (native audio): 720p $0.112/s · 1080p $0.14/s.
  - Kling 3.0 Omni: no-video-in/no-audio 720p $0.084/s · 1080p $0.112/s · 4k $0.42/s;
    with audio / with video-input tiers higher (see the video pricing table).
  - Kling Image 3.0 / 3.0 Omni: 1k/2k $0.028/image; Omni 4k $0.056/image.
- Error codes: 1000-1004 auth, 1102 resource-pack exhausted (prepaid), 1103 model not
  authorized, 1200/1201 bad params, 1301 content policy, 1302/1303 rate/concurrency.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. This is a NEW-PROVIDER integration (Kling AI,
direct API) that is MONEY-ZONE ADJACENT. Scope: apps/api (new adapter + gen-models
catalog + gen-processor provider path + env), and verify clients pick it up (they are
catalog-driven). 🔴 MONEY GUARD: do NOT modify credit consume/refund, cost-quote/HMAC
(lib/gen-quote.ts), the bodies of computeGenCost/imageUnitCost, webhook idempotency, or
any EXISTING model price. New models get new prices via the repo margin rule; the boot
pricing-floor assertion must still pass.

TRUTH SOURCES — read FULLY before coding (owner's Kling docs on this machine):
  /Users/usmonov/Projects/kling Ai/Authentication.txt
  /Users/usmonov/Projects/kling Ai/Basic APIs Pricing Video.txt
  /Users/usmonov/Projects/kling Ai/Basic APIs Pricing Image.txt
  /Users/usmonov/Projects/kling Ai/Kling 3.0 & 3.0 Omni Text to Video.txt
  /Users/usmonov/Projects/kling Ai/Kling 3.0 & 3.0 Omni Image to Video.txt
  /Users/usmonov/Projects/kling Ai/Kling 3.0 Turbo.txt
  /Users/usmonov/Projects/kling Ai/Kling 3.0 & 3.0 Omni Omni Video Generation.txt
  /Users/usmonov/Projects/kling Ai/Kling Image 3.0 & 3.0 Omni image Generation.txt
  /Users/usmonov/Projects/kling Ai/Kling Image 3.0 & 3.0 Omni Omni Image Generation.txt
  /Users/usmonov/Projects/kling Ai/Error Codes.txt
  /Users/usmonov/Projects/kling Ai/Callback Protocol.txt
  /Users/usmonov/Projects/kling Ai/Concurrency Rules.txt
Also read as the integration template: apps/api/src/lib/ai/byteplus.ts (submit/poll/
url→storage pattern), apps/api/src/lib/gen-processor.ts (provider switch, resume,
byteplus-video path), apps/api/src/lib/gen-models.ts (existing kling placeholders
3004/3005 = fal route, disabled — and the Seedance per-second + Seedream per-image cost
patterns), apps/api/src/routes/studio-gen.ts (validation + job run), and how
CDN/GCS/R2 copy works for provider result URLs.

SCOPE — ONLY the Kling 3.0 family (skip all ≤2.x):
  video: Kling 3.0 (t2v + i2v), Kling 3.0 Turbo (i2v, native audio), Kling 3.0 Omni
         (video incl. video-input); image: Kling Image 3.0, Kling Image 3.0 Omni.

BUILD:
1. NEW ADAPTER apps/api/src/lib/ai/kling.ts (model on byteplus.ts): base
   https://api-singapore.klingai.com, header Authorization: Bearer <KLING_API_KEY>;
   functions to submit t2v / i2v / omni-video / image, a poll step against
   GET /tasks?task_ids= (and the image GET), map Kling status→our status (submitted/
   processing → running; succeeded → done; failed → failed with the message), and copy
   the result URL (30-day expiry!) into our storage exactly like the byteplus path
   (klingVideoUrlToBuffer / image equivalent). Map Kling error codes to clean failures
   (1102/1103 → provider-not-available; 1301 → content policy; 1302/1303 → rate/retry).
   Send our reference frames as URLs the way the existing video-ref pipeline already
   produces provider-fetchable URLs (reuse optimizeVideoReferenceForUpload / the
   frame-key flow). Build request bodies EXACTLY per the docs (video: settings.audio/
   resolution/aspect_ratio/duration + contents[] for i2v; image: model_name:"kling-v3"
   + resolution/n/aspect_ratio).
2. TYPES/CATALOG: add provider "kling" to the gen-models provider union; add a
   klingModel/klingPath field if needed (t2v vs i2v vs image endpoints differ). Replace
   the disabled fal placeholders (3004/3005) with real DIRECT-Kling entries, and add the
   rest of the 3.0 family. Each entry: correct mode, feature, referenceMode, aspects,
   resolutions (video 720p/1080p/4k where the model allows; image 1k/2k, Omni +4k),
   durations (3-15s video), audio flag, frame/element support per the docs. PRICE each
   from the USD figures via the repo margin rule (video is per-SECOND like Seedance →
   reuse that cost path; image per-image like Seedream). enabled:true ONLY for models
   whose key is present and that a live probe confirms callable — otherwise enabled:false
   with a clear comment + OWNER ACTION (buy/activate the Kling resource pack).
3. PROVIDER PATH in gen-processor.ts: add the "kling-video" / "kling-image" branches
   (submit, poll/resume, url→storage) alongside the byteplus-video branch — same
   lifecycle, refund on genuine failure only. Do NOT alter credit math.
4. ENV: add KLING_API_KEY (+ region note) to the env example files and the config
   loader; the adapter must fail-closed clearly if the key is missing (model disabled,
   not a crash).

VERIFY:
- If a KLING_API_KEY is available in the local env, do a live activation probe (submit a
  minimal t2v task) to confirm the account/models are open (like SC_57 did for BytePlus).
  Enable only what the probe confirms; otherwise ship enabled:false + owner action.
- Extend and run verify-gen-payloads.mjs so every ENABLED model (incl. any enabled Kling
  ones) passes /gen/cost-quote (default + rich). For enabled Kling models with a key, run
  ONE real cheap generation each (image + a 720p/short video) end-to-end and confirm it
  completes and the result is copied to our storage.
- Confirm the /gen/models endpoint serves the new Kling models and that BOTH clients
  (web + plugin) show them with correct per-model composer controls (catalog-driven; no
  client edits expected — if the capability map misses a Kling-only control, note it).

RULES: additive only; `npm run build -w apps/api` passes; restart the API before
verifying; node --check the plugin only if you touch it (you shouldn't); do not push.

DELIVERABLE (summary): the adapter + provider-path overview; the Kling models table
(id, endpoint, mode, price, enabled/disabled + why); the activation-probe result; the
per-model verification table; env/owner actions (KLING_API_KEY, resource pack).
```

**Model:** Fable 5 (High / Extra). New provider integration next to the money zone —
docs-grounded, activation-gated, big surface.

---

## R4_03 — Topaz provider FOUNDATION (phase 0): adapter + provider wiring + env, NO
## models enabled, NO UI yet

**Director's decision.** Bring Topaz Labs (upscale/enhance) into the codebase as a new
provider FIRST — the base client, provider registration, env, and result-to-storage
copy — verified with a live probe, but WITHOUT enabling any catalog model or touching
any UI. This mirrors the BytePlus "Bosqich 0" approach: land a tested foundation, then
add models + UI in later phases (R4_04+). Keeps the risky money-zone-adjacent surface
small and reviewable.

**Truth sources (now IN-REPO):** `docs/TOPAZ-API-NOTES.md` (curated), `docs/topaz/
image-yaml-feb-2026.yaml` + `docs/topaz/video-12-25-updated.yaml` (OpenAPI), `docs/topaz/
model-selection.md`, `docs/topaz/quickstart.md`. Full set on the owner's machine at
`/Users/usmonov/Projects/Topaz/`.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. This is PHASE 0 of a new-provider integration
(Topaz Labs enhance/upscale). Scope: apps/api ONLY — a new adapter, provider
registration, env, and result→storage. Do NOT add/enable any gen-models catalog entry,
do NOT touch any UI (plugin or web), do NOT wire cost-quote/pricing for Topaz models yet
(that is a later phase). 🔴 MONEY GUARD: do not modify credit consume/refund, cost-quote/
HMAC, computeGenCost/imageUnitCost, webhook idempotency, or any existing price. This
phase adds an isolated, unused-by-users adapter + plumbing.

READ FIRST (in-repo truth sources): docs/TOPAZ-API-NOTES.md, docs/topaz/
image-yaml-feb-2026.yaml, docs/topaz/video-12-25-updated.yaml, docs/topaz/
model-selection.md, docs/topaz/quickstart.md. Also read apps/api/src/lib/ai/byteplus.ts
as the integration TEMPLATE (submit → poll → url→storage), apps/api/src/lib/gen-processor.ts
(provider switch, resume, byteplus-video branch), and how S3/R2/GCS presigned URLs and
result copying work today.

BUILD (foundation only):
1. NEW ADAPTER apps/api/src/lib/ai/topaz.ts, modeled on byteplus.ts. Auth header
   X-API-Key. Implement, but do NOT yet hook to any user route:
   - IMAGE: submitImageEnhance(params) → POST {IMAGE_BASE}/enhance/async (or the right
     endpoint per model family) using source_url (our storage URL) + model + output dims;
     pollImageStep(process_id) → GET /status/{id} mapping Pending/Processing→running,
     Completed→done, Failed/Cancelled→failed; download via GET /download/{id} then copy
     the (1-hour-expiry) result into our storage (reuse the byteplus url→buffer→store
     helper). estimateImage() → POST /estimate.
   - VIDEO: submitVideoTask(params) using the STANDARD lifecycle (POST /video/ → returns
     estimate; PATCH /accept → presigned multipart PUT URLs; PUT the source; PATCH
     /complete-upload). For phase 0, the source can be a presigned URL from our storage;
     implement the S3-external path too if simple, else the multipart PUT. pollVideoStep
     (requestId) → GET /video/{id}/status; on complete copy the (24h-expiry) download
     URL into our storage. Also a getSupportedModels() → GET /video/status.
   - Error mapping: Topaz error/HTTP codes → clean failures (401/402/403 →
     provider-not-available; 413 too-large; 429 → retry/backoff). Fail closed clearly if
     TOPAZ_API_KEY is missing.
2. PROVIDER REGISTRATION: add "topaz" to the gen-models provider union type and add
   dormant "topaz-image" / "topaz-video" branches to the gen-processor provider switch
   (submit/poll/resume/url→storage) mirroring the byteplus-video branch — but since no
   catalog model uses provider "topaz" yet, these branches are wired and compile but are
   never hit in normal flow. Do NOT enable any model.
3. ENV: add TOPAZ_API_KEY (+ base URL constants) to the env example files and the config
   loader; adapter reads it; missing key → adapter reports unavailable, no crash.

VERIFY (do not skip — this is the point of phase 0):
- TOPAZ_API_KEY may be in .env; detect the exact key name. If present, run a LIVE PROBE
  with a tiny throwaway asset entirely inside a standalone script (scripts/, node-run):
  (a) image: submit a small public test image to /enhance/async, poll to Completed,
      download, and confirm you can fetch the result and copy it to a temp location;
  (b) video: call GET /video/status to confirm availability + print supportedModels;
      OPTIONALLY run a minimal Proteus job on a tiny clip if cheap and quick — otherwise
      just prove the create→accept→estimate handshake returns a cost estimate (that
      alone validates auth + the standard lifecycle without spending much).
  Print a PASS/FAIL for auth, image round-trip, video handshake, and the live
  supportedModels list. If the key is absent, skip the live calls and say so.
- npm run build -w apps/api must pass. No plugin/web files changed (git diff proves it).

DELIVERABLE (summary): the adapter surface (functions), the provider-switch additions,
env keys added, and the live-probe results (auth PASS/FAIL, image round-trip, video
handshake, supportedModels list). Explicitly confirm: zero catalog models enabled, zero
UI changes, money-zone untouched.
```

**Model:** Fable 5 (High). Foundation adapter + provider wiring, live-probed, no
user-facing surface yet.

> NEXT TOPAZ PHASES (renumbered): R4_07 = catalog models (Proteus video, Gigapixel image,
> RemoveBG) with margin-rule prices + cost-quote wiring + per-model verification; R4_08 =
> one-click "Enhance/Upscale" on gen cards (Use ▾) in plugin + web. (R4_05/R4_06 are the
> self-calibrating pricing feature below.)

---

## R4_04 — Google "restricted individuals / real-face" refusal shows raw JSON instead of
## the clean rejection flow

**Problem (owner report + screenshot).** A Gemini Omni Flash video gen was refused by
Google with "The input could not be submitted. This input contains certain restricted
individuals that violate Google's Responsible AI practices" — and the plugin showed the
RAW provider text ("Omni 400: {error:{message:…}}"). Credits were correctly refunded
(✦106), so money is fine. But this is a real-face/public-figure content block (Google
blocks real/celebrity faces), and it is NOT being routed through the existing clean
rejection flow (`handleGenRejection` → friendly message + "switch to a model with a
different content policy" suggestion). Two gaps:
1. `friendlyError()` (plugin ~line 9670; web equivalent) only matches "sensitive
   content|nsfw|sexual|nudity|content policy|safety system|no image was returned" — it
   does NOT match Google's "restricted individuals" / "Responsible AI practices" /
   "could not be submitted", so the raw JSON leaks to the user.
2. The backend isn't tagging this error as `rejection.isContent` with a real-face reason
   + a sensible fallback model, so `handleGenRejection` never fires.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: apps/api (error classification →
rejection object) + plugins/after-effects-cep/AssetFlow_Plugin.html + packages/
assetflow-studio/platform/index.html (friendly message + rejection flow). 🔴 MONEY
GUARD: refund already works (✦106 refunded correctly) — do NOT change any credit/refund/
quote logic. This is error CLASSIFICATION + MESSAGING only.

CONTEXT: there is already a clean rejection pipeline — backend attaches a `rejection`
object to the /gen/:jobId response (isContent, reason, refunded, provider, modelLabel,
suggestModelId, suggestModelLabel), and the plugin's handleGenRejection() (~line 9662)
shows a friendly toast + an afConfirm offering to switch to a model with a different
content policy. friendlyError() (~line 9670) maps known content-policy phrases to clean
text. The BUG: Google's real-face/public-figure refusal is not recognized, so the raw
"Omni 400: {error:{...}}" string is shown and the clean flow never runs.

FIND the real error strings: Google/Vertex Omni refusal returns messages like "The input
could not be submitted. This input contains certain restricted individuals that violate
Google's Responsible AI practices" and code "invalid_request". Grep the Vertex/Omni
adapter(s) (apps/api/src/lib/ai/vertex*.ts / vertex-omni.ts) and the gen-processor error
handling for where provider errors are captured and turned into the rejection object.

FIX:
1. BACKEND: classify this refusal as a CONTENT rejection (rejection.isContent = true)
   with a clean human reason, e.g. "This image contains a real person or public figure
   that Google's model won't process." Detect via the provider message (case-insensitive
   match on "restricted individuals", "Responsible AI", "could not be submitted" for
   Google/Vertex/Omni providers) — do NOT over-match generic 400s. Set a sensible
   `suggestModel` = a model that ALLOWS real faces (per repo notes, Seedance/BytePlus
   real-face path; pick an ENABLED video model for a video job, image model for an image
   job — reuse whatever suggestion logic already exists, just make sure this case
   produces one). Keep refund behavior exactly as is.
2. CLIENTS (both apps): extend friendlyError()'s content-policy regex to also catch
   "restricted individual(s)", "responsible ai", "could not be submitted" → return a
   clean message like "This model won't process real people/public figures — your
   credits were refunded." Ensure the raw "Omni 400: {…json…}" NEVER reaches the user
   (strip/replace any raw provider JSON in the toast path). Confirm handleGenRejection()
   fires for this case and offers the real-face-friendly fallback (the screenshot's "Try
   Seedance 2.0 Fast" suggestion should come from the backend suggestModel, not be
   hardcoded).
3. Secondary polish (only if trivial and in the same code path): when a model REQUIRES a
   start frame, the "This model needs a start frame — add one above" hint and a content
   refusal should not both scream at once — but do NOT redesign; just make sure the
   content rejection is the primary message. If it's not trivial, leave it and note it.

QA: reproduce with a mocked provider error containing the Google "restricted individuals"
text (unit-level or a forced path) → user sees the clean message + refund note + a
fallback-model offer, never raw JSON; verify a genuinely different 400 (e.g. bad params)
still shows its own correct message (no over-matching); both apps, 3 themes; node --check
the plugin; web console clean; apps/api builds.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
exact match strings added and where the suggestModel comes from.
```

**Model:** Sonnet 5. Error classification + messaging, money untouched.

---

## R4_05 — Self-calibrating provider cost: wire MEASURED cost into margin + Pricing panel
## (fixes the −229% display, no more hand-editing provider-cost.ts)

**Problem + Director's decision (owner report + Pricing screenshot).** Seedream 5.0 Lite
and Seedream 4.5 show provider cost **$0.500** → margin **−229%** (red), because they
have no entry in the static `provider-cost.ts` table so `estimateProviderUsd()` returns
the `DEFAULT_PROVIDER_USD = 0.5` fail-safe. The real cost is ~$0.045–0.09. The root cause
is architectural: provider cost is a HAND-MAINTAINED static table, and the panel +
"Apply target margin" read ONLY that table — even though the system ALREADY measures the
real per-gen cost (`ProviderSpend.measuredCostUsd`, written from BytePlus token usage via
`recordMeasuredProviderCost`, ledger.ts). **Director's decision: connect the existing
measured-cost pipeline to the margin/pricing computation so cost self-calibrates from
real generations — no code edits, no deploy, per new model.** Phase 1 (this task) =
backend wiring + flat-price measurement. Phase 2 (R4_06) = the Pricing-management UI
("Measure cost" button + display).

**Verified code facts:** `ProviderSpend.measuredCostUsd` (Decimal) + `confidence`
("measured"|"estimated"|"official") already populated for video (tokens → USD,
gen-processor.ts ~890). `estimateProviderUsd()` (provider-cost.ts:107) returns
`DEFAULT_PROVIDER_USD` when no table row. `pricing-automargin.ts` reads
`estimateProviderUsd` for Apply-margin. Pricing panel provider-cost column comes from the
same path (admin.ts ~1004).

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Scope: apps/api (provider-cost resolution + a
measured-cost aggregator + flat-price measurement). 🔴 MONEY GUARD — ABSOLUTE: do NOT
change credit consume/refund, cost-quote signing/HMAC (gen-quote.ts), computeGenCost/
imageUnitCost bodies, creditUsdValue, webhook idempotency, or any charged credit VALUE.
This task changes only the COST BASIS used for margin DISPLAY and the "Apply target
margin" computation, plus adds measurement. Apply-margin still writes credit prices the
same way; it just gets a truer cost input. Boot pricing-floor (assert-pricing-floors.ts)
must still pass and must never be weakened.

STUDY: apps/api/src/lib/provider-cost.ts (estimateProviderUsd + DEFAULT_PROVIDER_USD),
pricing-automargin.ts (how Apply-margin derives credits), ledger.ts
(recordMeasuredProviderCost, byteplusTokensToUsd), gen-processor.ts (~890 where video
usage is measured), admin.ts (~1004 pricing rows + ~636 apply-margin route),
ProviderSpend model, and how each provider returns cost signals (byteplus.ts usage;
Kling — check its query result / account-usage doc; Topaz — status `credits` field +
/account/v1/credits/balance).

BUILD:
1. MEASURED-COST AGGREGATOR (new, e.g. lib/measured-cost.ts): given (modelId, tier/
   resolution), read ProviderSpend rows with confidence="measured" for that model and
   return a robust central value (median of the most recent N≈5, per tier where the data
   carries a tier; if tier isn't distinguishable, per model). Return {usd, samples,
   confidence} or null when no measured data.
2. RESOLUTION ORDER — a single resolveProviderUsd(model, opts) used by BOTH the panel
   display and pricing-automargin:
     (a) measured aggregate (if samples ≥ threshold, e.g. ≥1 for a first pass, ≥3 for
         high confidence) — BUT apply a SAFETY RULE: measured may LOWER the cost basis
         freely (improves margin, safe); if measured is HIGHER than the current static/
         set basis, DO NOT auto-raise silently — use the higher value for the DISPLAYED
         margin/warning but require explicit admin confirmation (a flag) before
         Apply-margin adopts a higher cost (so a cost spike can't silently jack up
         subscriber prices). Document this rule in code.
     (b) static provider-cost.ts table.
     (c) DEFAULT_PROVIDER_USD fail-safe.
   estimateProviderUsd stays as the (b)/(c) fallback; the new resolver wraps it.
3. FLAT-PRICE IMAGE MEASUREMENT (Seedream Lite 1020 / 4.5 1022 and any per-image model
   with no token usage): after such a gen, derive real cost. Prefer a usage/billing
   field if the provider returns one; otherwise measure via provider balance delta —
   read the provider's account balance immediately before and after the gen and store
   the difference as measuredCostUsd (confidence "measured"). Reuse recordMeasured
   ProviderCost. Keep it best-effort/analytics — NEVER block or alter the user's gen or
   credit flow if the balance read fails.
4. PANEL DATA: the admin pricing rows (admin.ts) now report providerCostUsd from
   resolveProviderUsd (so Lite/4.5 stop showing the $0.50 fail-safe once ≥1 measurement
   exists) plus fields: measuredUsd, samples, confidence, and needsConfirm (true when
   measured > set basis). Do NOT change the response shape destructively — add fields.
5. APPLY-MARGIN: uses resolveProviderUsd (measured-aware, with the safety rule). Models
   flagged needsConfirm are SKIPPED by a bulk Apply unless an explicit confirm is passed
   — report them in the response so the UI (R4_06) can surface them.

VERIFY (local stack): run one real Seedream Lite gen + one Seedream 4.5 gen → confirm a
measuredCostUsd row is written and resolveProviderUsd returns the real (~$0.05) cost, so
the computed margin flips from −229% to a correct positive value; confirm a video model
(e.g. Seedance) still measures via tokens as before; confirm Apply-margin uses the
measured cost and the boot floor still passes; confirm NO change to any charged credit
value for an unaffected model (diff the cost-quote output before/after for e.g. Nano
Banana 2). `npm run build -w apps/api` passes; restart API before verifying.

DELIVERABLE: the resolver + safety rule, the flat-price measurement approach per
provider, and a before/after of Lite/4.5 margin (−229% → correct). Confirm money-zone
untouched (cost-quote unchanged for a control model).
```

**Model:** Fable 5 (High). Money-zone-adjacent cost-basis rewiring — maximum care.

---

## R4_06 — Pricing management: measured-cost column + per-model "Measure cost" button +
## safe auto-adopt

**Problem/request (owner).** The owner wants Pricing management itself to (a) SHOW the
correct, self-calibrated cost/margin, and (b) let them trigger measurement: "if you can
learn the price by generating once, add that function inside Pricing management." Builds
on R4_05 (backend resolver + measurement).

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Scope: admin Pricing management UI — ROOT source
packages/assetflow-studio/js/ (find the pricing-management view; edit source then
`npm run studio:sync`) + a thin admin API endpoint if needed (apps/api). Depends on
R4_05 (resolveProviderUsd + measured fields in the pricing rows + a measurement path).
🔴 MONEY GUARD: no change to consume/refund/HMAC/credit values; this surfaces the
R4_05 data and triggers measurement — Apply-margin logic itself is unchanged.

BUILD in the Pricing management table:
1. DISPLAY: for each model show provider cost with its source — a small badge:
   "measured (N)" (green, from real gens), "table" (from provider-cost.ts), or
   "estimate $0.50" (amber, fail-safe, no data yet). The margin % uses the resolved
   cost (so Lite/4.5 no longer show a false −229% once measured). When measured > set
   basis (needsConfirm), show an amber "cost rose — review" chip.
2. "MEASURE COST" per-model action (pencil-area or row menu): runs ONE cheap probe
   generation of that model at its lowest tier through the existing gen pipeline (admin-
   initiated, smallest resolution/duration), reads the real deduction (R4_05 measurement),
   writes measuredCostUsd, and refreshes the row live. Show progress + the resulting
   measured $ and new margin. Guard: confirm dialog with the (small) credit/USD it will
   spend; disable while running; handle failure with a clear message (no crash). Add a
   backend endpoint POST /api/admin/pricing/measure-cost {modelId} that performs this
   server-side (reuse the probe/gen path from the R4 verification scripts; admin-guarded;
   audited).
3. "MEASURE ALL MISSING" convenience button: measures every enabled model that currently
   has no measured data (sequential, rate-limit-aware), so the whole table calibrates in
   one action.
4. APPLY-MARGIN interplay: after measuring, "Apply target margin" uses the measured cost
   (per R4_05). Models flagged needsConfirm are listed and require an explicit toggle to
   include in the bulk apply — surface that clearly so a cost spike can't silently raise
   subscriber prices.
5. Keep the existing manual price editing (pencil) working as an override.

QA (local stack, admin user): Lite/4.5 rows show "estimate $0.50" amber + false margin
BEFORE; click "Measure cost" → probe runs → row flips to "measured" + correct positive
margin; "Measure all missing" calibrates the table; Apply-margin then computes from
measured costs and the boot floor still passes; a needsConfirm model is excluded from
bulk apply unless toggled; 3 themes; `npm run studio:sync`; admin API builds; console
clean. Money-zone: a control model's charged credit value is unchanged.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary.
```

**Model:** Fable 5 (Medium). Admin UI + a measure endpoint over the R4_05 backend.

---

## R4_07 — Topaz catalog: register enhance/upscale operations + cost (activation-gated)

**Context.** After R4_03 (foundation) Topaz still doesn't appear anywhere — by design
(no catalog entries, no UI). Topaz is NOT a prompt-to-media generator; it ENHANCES an
existing asset (upscale/denoise/sharpen/bg-remove). So it is registered as enhance
OPERATIONS, priced, and later surfaced as a one-click action on gen/library cards
(R4_08), NOT as a composer model. This task registers the operations + cost + verifies
what's callable; UI is R4_08. Image is currently blocked by a Topaz subscription (probe
returned HTTP 412 "No valid subscription"); video create-handshake worked.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Scope: apps/api (register Topaz enhance operations
in the catalog/pricing layer + cost mapping + activation probe). Builds on R4_03
(topaz.ts adapter + dormant provider branches). Prefer running AFTER R4_05 so Topaz cost
can self-calibrate; if R4_05 isn't landed, use the static cost path. 🔴 MONEY GUARD:
no change to consume/refund/HMAC/credit values/boot floor; new operations get new prices
via the margin rule; a channel below cost must not boot.

TRUTH: docs/TOPAZ-API-NOTES.md + docs/topaz/*.yaml. Topaz billing: IMAGE per output-MP
(Gigapixel 24 MP/credit; RemoveBG in the 24 MP tier), VIDEO per reference (Proteus 4
credits @10s 1080p; scales with resolution/duration). Topaz credit → USD from the
owner's tier (see notes; treat $/Topaz-credit as an env/config value, default the
current tier, so it's adjustable without code).

BUILD:
1. Decide the representation: Topaz ops are "enhance" actions bound to an existing asset,
   not generative models. Add them to the catalog/pricing tables in the way that lets
   the pricing panel show them and cost-quote price them, but marks them as
   operation-type (feature: "upscale"/"enhance") so they do NOT appear in the composer
   model picker. Reuse the existing gen-models shape if it already supports an
   upscale-type entry (there were upscale entries before SC_17 removed them — check the
   git history / current shape); otherwise add a minimal `opType` flag.
   Register at least: Topaz Proteus (video upscale, prob-4, auto), Topaz Gigapixel
   (image upscale, Standard V2), Topaz RemoveBG (image bg-removal).
2. COST: map each op's Topaz-credit cost → USD (tier rate from config) → FrameFlow
   credits via the margin rule. Video cost scales with output resolution + duration
   (per the Topaz table); image with output MP. Price so the boot floor passes; enable
   ONLY ops whose live probe confirms callable.
3. ACTIVATION PROBE (like Seedance/Kling): with TOPAZ_API_KEY, run a real cheap job per
   op — video: a full Proteus job on a tiny clip must COMPLETE end-to-end (not just the
   create handshake) and copy to our storage; image: a Gigapixel + a RemoveBG job.
   - Ops that complete → enabled:true.
   - Ops returning 412 "No valid subscription" (or any not-active error) → enabled:false
     + comment + OWNER ACTION "activate Topaz subscription" (do not fake-enable).
4. cost-quote: ensure a quote can be produced for enabled Topaz ops (they'll be invoked
   by R4_08 against a source asset). No UI in this task.

VERIFY: build passes; probe results table (op → callable? → enabled/disabled); for each
enabled op a real job completes + result in our storage; cost-quote returns for enabled
ops; boot floor passes; NO composer/model-picker change (Topaz ops must not show as
generation models); money-zone control unchanged.

DELIVERABLE: ops registered + prices + enabled state, probe table, and owner actions
(Topaz subscription for image if still 412).
```

**Model:** Fable 5 (High). Operation-type catalog + cost + activation probe, money-adjacent.

> R4_08 (after R4_07): one-click "Enhance/Upscale" affordance on gen + library cards
> (Use ▾ → Upscale 2×/4× video via Proteus, Upscale image via Gigapixel, Remove BG) in
> plugin + web, invoking the enabled Topaz ops with a signed cost-quote + refund on
> failure. This is where Topaz finally becomes visible to users.
