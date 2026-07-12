# FIX PROMPTS — BATCH 5 · 2026-07-11 · Seedance migration fal.ai → BytePlus ModelArk

> Each prompt below is self-contained (user runs `/clear` between prompts). Copy ONE prompt
> (including the GLOBAL RULES block) into Claude Code per run.

## GLOBAL RULES (include with every prompt)

- **MONEY-ZONE IS BYTE-FOR-BYTE FROZEN:** credit consume/refund, signed cost-quote + HMAC
  (`apps/api/src/lib/gen-quote.ts`, `gen-models.ts` `computeGenCost`/`imageUnitCost`,
  `lib/plugin-profile.ts`), webhook idempotency, and EVERY credit VALUE (cost, perSec tables,
  qualityCost) must not change. If a change would touch them → STOP and flag.
- Migrations additive only. English UI text; Uzbek code comments.
- Minimal, narrow diff. Reuse existing patterns. `npm run build -w apps/api` must pass green;
  the build runs `gen-models-validate` — it must report 0 issues.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

---

## Prompt #1 — BytePlus ModelArk adapter + switch Seedance 3101/3102 to it (fal stays for Topaz)

**Context.** This repo is an Express+TS API (`apps/api`) with a credit-based AI generation
pipeline (`apps/api/src/lib/gen-processor.ts`). Video models are declared in
`apps/api/src/lib/gen-models.ts`. Today three models use `provider: "fal"`:

- `3101` Seedance 2.0 Fast (`bytedance/seedance-2.0/fast/image-to-video`)
- `3102` Seedance 2.0 R2V (`bytedance/seedance-2.0/reference-to-video`)
- `3201` Video Upscale Topaz (`fal-ai/topaz/upscale/video`) — **stays on fal, do not touch**

We are moving 3101 and 3102 to BytePlus ModelArk (ByteDance's own cloud — same Seedance models,
~2-3x cheaper). fal remains configured for 3201 only. The fal adapter is
`apps/api/src/lib/ai/fal.ts` — use it as the structural template (OrResult<Buffer> contract,
submit/poll-step separation, error text extraction that never leaks keys, poll ramp).

**Task.**

1. **New adapter `apps/api/src/lib/ai/byteplus.ts`:**
   - Env: `BYTEPLUS_API_KEY` (module-level like fal's `KEY`), optional `BYTEPLUS_ARK_BASE`
     defaulting to `https://ark.ap-southeast.bytepluses.com/api/v3`.
   - `isByteplusConfigured()`, `NOT_CONFIGURED` sentinel `BYTEPLUS_NOT_CONFIGURED`.
   - Auth header: `Authorization: Bearer <key>` (NOT `Key` — that is fal's scheme).
   - Video generation is an async task API:
     - Create: `POST {base}/contents/generations/tasks` with `{ model, content: [...] }` where
       `content` is an array of `{type:"text", text: prompt}` plus
       `{type:"image_url", image_url:{url}}` / `{type:"video_url", video_url:{url}}` entries
       for references. Returns `{ id }` (task id).
     - Poll: `GET {base}/contents/generations/tasks/{id}` → `status` in
       `queued|running|succeeded|failed|cancelled`; on success the result contains the output
       video URL (`content.video_url`) and a `usage` object (token counts).
   - **The exact request/response schema is documented in `docs/BYTEPLUS-DOCS-MODELS.md`
     (verified from the official quickstart package) — READ IT FIRST and treat it as the
     single source of truth.** Confirmed shape: task create body is
     `{ model, content: [{type:"text",text}, {type:"image_url",image_url:{url},role:"reference_image"},
     {type:"video_url",video_url:{url},role:"reference_video"}, {type:"audio_url",...}],
     generate_audio, ratio, duration, watermark }`; poll returns `status`
     (`queued|running|succeeded|failed`) and on success `content.video_url`.
     **ALWAYS send `watermark: false`.** Top-level params are `resolution` ("480p"|"720p"|
     "1080p"|"4k"), `ratio` (map our "auto" → "adaptive"), `duration` (4–15 int),
     `generate_audio`. Model IDs: 3102 → `dreamina-seedance-2-0-260128`,
     3101 → `dreamina-seedance-2-0-fast-260128` (Fast supports 480p/720p ONLY — the catalog
     already matches). Strict first/last-frame i2v uses `role: "first_frame"` / `"last_frame"`;
     free references use `reference_image|reference_video|reference_audio`. If a catalog
     parameter (e.g. `bitrate`) has no BytePlus equivalent, drop it silently with a short Uzbek
     comment.
   - **Rate limits (Individual account): concurrency 3 for non-4k, 1 for 4k, 180 RPM.** Add a
     small in-process semaphore (like INGEST_CONCURRENCY pattern) limiting parallel BytePlus
     video tasks to `BYTEPLUS_VIDEO_CONCURRENCY` (default 3), and treat HTTP 429 / rate-limit
     error codes as retryable-with-backoff, NOT as failure (no refund on 429 — job stays queued).
   - **Real-face input moderation — USER DECISION (2026-07-11): NO fal fallback, BytePlus is
     the ONLY Seedance provider.** BytePlus rejects reference images/videos containing real
     human faces (incl. AI faces from other platforms). When create/poll fails with an
     input-moderation error code, surface a DISTINCT error string
     (`BYTEPLUS_INPUT_MODERATION: ...`) so the normal refund path runs, and make sure the
     client-visible message (English) is actionable, e.g.: "Reference contains a real human
     face, which this model does not accept. Use face-free or stylized/illustrated references."
     Exceptions that DO work (same ModelArk account, ≤30 days, original file): Seedance/Seedream
     5.0 Lite outputs — future Seedream integration will unlock AI-face workflow; out of scope
     here.
   - Export `byteplusSubmitVideoTask(model, input) → OrResult<{taskId}>`,
     `byteplusPollStep(taskId) → OrResult<{state:"pending"}|{state:"completed"; data}>`,
     and a result→Buffer helper mirroring `falVideoUrlToBuffer` (download output URL, size cap
     same as fal's). Also parse and return `usage` tokens when present so the caller can log
     real provider units.
   - Timeout sentinel: `BYTEPLUS_TIMEOUT: job still running — no refund` (same semantics as
     `FAL_TIMEOUT`; gen-processor must treat it the same way — grep how FAL_TIMEOUT is matched
     and extend, do not fork the logic).
2. **`gen-models.ts`:** add `"byteplus"` to the provider union and a `byteplusModel?: string`
   field. Switch entries 3101 and 3102 to `provider: "byteplus"` with the ModelArk model IDs
   for Seedance 2.0 fast i2v and Seedance 2.0 (reference/r2v) — take the exact model IDs from
   the tutorial page above (they look like `dreamina-seedance-2-0-...`; if the console shows a
   different published name, prefer the docs). **Do NOT change `cost`, `videoSettings.perSec`,
   durations, resolutions, refs config — money zone.** Keep `falModel` values in place but
   commented out (one-line Uzbek note: fal zaxira).
   **Set `enabled: false` on 3101 (Fast)** with Uzbek comment "BytePlus Fast pack hali olinmagan
   (2026-07-11) — pack olingach yoqiladi": only the Seedance 2.0 (standard) resource pack is
   purchased so far; an enabled Fast entry would fail at the provider with "no resource pack".
   3102 stays enabled.
   **Rename 3102 `label` from "Seedance 2.0 R2V" → "Seedance 2.0"** (UI text only — the "R2V"
   suffix was fal-era naming; the model is the universal standard tier). Grep the plugin/studio
   sources for any hardcoded "Seedance 2.0 R2V" string and update those too (label is
   catalog-driven, but check for stale hardcodes).
3. **`gen-models-validate.ts`:** add `"byteplus"` to the PROVIDERS set (this file is the
   runtime validator — build fails without it; see BATCH4 hotfix lesson in
   `docs/SESSION-REPORT.md` history).
4. **`gen-processor.ts`:** dispatch `provider === "byteplus"` for video jobs using the same
   persisted-job/resume pattern as fal (`provider:"fal-video"|"fal-ref-video"` variants exist —
   add a `"byteplus-video"` variant). Polling only, no webhook in v1. Persist taskId so a server
   restart resumes polling (mirror how FalQueueJob is persisted). On success record real usage
   tokens into the existing ProviderSpend estimated-cost path if a hook exists; otherwise leave
   the estimator as is.
5. **`provider-cost.ts`:** update `VIDEO_USD_PER_SEC` for 3101/3102 to BytePlus resource-pack
   estimates with an Uzbek comment "BytePlus resource-pack tarifi, birinchi invoice bilan
   tasdiqlansin (2026-07)": per-second USD derived from $/1M-token rates at 24fps
   (tokens/s ≈ width·height·24/1024):
   - 3101 fast i2v (video-input rate $3.3/1M): 480p ≈ 0.032, 720p ≈ 0.071
   - 3102 r2v (video-input rate $4.3/1M): 480p ≈ 0.042, 720p ≈ 0.093, 1080p ≈ 0.209, 4k ≈ 0.836
   These feed the margin estimator and admin auto-margin ONLY — they do not change user credit
   prices by themselves (admin presses "Apply target margin" later). Do not touch 3201 rows.
6. **Config surfacing:** wherever fal's configured-state is exposed (e.g. `/gen/health`,
   startup env checks), add the byteplus equivalent. `.env.example`: add `BYTEPLUS_API_KEY` +
   `BYTEPLUS_ARK_BASE` with one-line comments.
7. **Tests/verification:** `npm run build -w apps/api` green (validator 0 issues). If a real
   `BYTEPLUS_API_KEY` is present in `.env`, run ONE cheap real call: **3102 (Seedance 2.0 —
   the only model with a purchased resource pack)**, text-to-video, 480p, 4s, no audio —
   log task id + usage tokens; otherwise skip live test and say so in the summary.

**Out of scope:** deleting fal.ts / fal-webhook.ts (Topaz + zaxira), Studio/plugin UI changes
(model labels unchanged), any pricing/credit value change, migrations (none needed).

---

## Prompt #2 — Seedream image generation on BytePlus (run AFTER Prompt #1 is committed)

**Context.** Prompt #1 added `apps/api/src/lib/ai/byteplus.ts` (video task API). BytePlus also
hosts Seedream image models on the SAME base URL + API key, but via a SYNCHRONOUS endpoint:
`POST {base}/images/generations` (OpenAI-images-compatible). Schema is fully documented in
`docs/BYTEPLUS-DOCS-MODELS.md` §8 — read it first. Current image models use `provider:
"vertex-image"` — they STAY enabled; Seedream is ADDED alongside (user compares, then decides).

**Task.**
1. Extend `byteplus.ts` with `byteplusImage(model, params) → OrResult<Buffer[]>`:
   - Body: `{ model, prompt, image? (string|string[] refs), size ("1K"/"2K"/"4K" per model),
     output_format:"png", response_format:"url", watermark:false }`. No task/poll — direct
     response `data[].url` → download each to Buffer (reuse the size-capped downloader).
   - v1: single-image output only (`sequential_image_generation` NOT used — future phase).
2. **New catalog entries in `gen-models.ts`** (mode "image", provider "byteplus", NEW ids in the
   10xx range that don't collide; follow the structure of the Vertex image entries):
   - Seedream 5.0 Lite — `seedream-5-0-260128`, quality tiers 2K/4K, refs ≤14 (map to existing
     image-ref mechanism; if catalog imgSettings supports maxRefs, use it).
   - Seedream 5.0 Pro — `dola-seedream-5-0-pro-260628`, tiers 1K/2K, refs ≤10, single output.
   - Set `enabled: false` initially (zaxira) UNLESS `.env` has BYTEPLUS_API_KEY at build-test
     time and provider-cost rows exist — the USER flips them on in admin after price check.
   - `cost`/`qualityCost`: set conservative placeholder credits mirroring the closest Vertex
     tier (e.g. Nano Banana 2), with an Uzbek comment "narx birinchi invoice + Apply margin
     bilan aniqlanadi". This does NOT touch existing models' values (money-zone untouched).
3. **`provider-cost.ts`:** add IMAGE_USD_PER_UNIT rows for the two Seedream ids. Official USD
   prices were NOT in the tutorial — check https://docs.byteplus.com/en/docs/ModelArk/1544106
   and the console model cards; if a price cannot be confirmed, use DEFAULT_PROVIDER_USD
   behavior and flag it in the summary (do NOT guess a low number — overestimate is fail-safe).
4. **Validator:** "byteplus" already added in Prompt #1; ensure image feature mapping passes.
5. Image gen for USER role is exposed through the same catalog to BOTH the AE plugin and the
   web AI Studio automatically — no frontend changes in this prompt (labels come from catalog).
6. Verify: build green, validator 0 issues; if BYTEPLUS_API_KEY present, one real 1K/2K test
   image via Seedream 5.0 Lite (t2i, no refs) — log usage + URL, download to GCS path used by
   gen-processor for image outputs.

**Out of scope:** batch/sequential images, interactive editing (Draw tool), streaming,
disabling Vertex models, trusted-chain wiring (Seedream output → Seedance ref) — all future.

---

## Prompt #4 — mention dialect + video-edit prompt presets (run AFTER Prompt #1 is live-tested)

**Context.** The plugin (`AssetFlow_Plugin.html`) and web AI Studio composers already implement
@-mention refs (`@img1`, `@video1`, `@audio1` tokens, cascade renumber, orphan sanitize; server
preserves order). BytePlus Seedance 2.0 expects prompts to reference assets as **"Image n" /
"Video n" / "Audio n"** — the number is the 1-based order of that asset TYPE in the `content`
array (see docs/BYTEPLUS-DOCS-MODELS.md §3). Marketing UIs show `@Video1` style, but the
official prompt guide uses "Image n"; asset-ID references are NOT supported.

**Verified anchors (Direktor audit, 2026-07-12):**
- Rewrite already exists in `apps/api/src/lib/ai/byteplus.ts` ~lines 118-124 inside the video
  body builder: `@image/@img/@video/@audio(\d+)` → "Image/Video/Audio $1", and the SAME
  function then builds `content` in order: text → `first_frame` image → `last_frame` image →
  `reference_image`* → `reference_video`* → `reference_audio`*.
- Plugin video pane: textarea `#vgPrompt` (line ~4248), mention dropdown `#vgMention`, token
  insert helpers ~lines 11956-11965; image pane tile/tag pattern at ~10711-10723 (`.tag` chips).
- Web composer: `packages/assetflow-studio/platform/index.html` (CF Pages DIRECT source — edit
  in place, studio:sync NOT involved for this file). State: `st.aiPrompt`, `refImages`,
  `refStartUrl/refEndUrl`, `refVideos` (≤3), `refAudios`; ref chips render at ~19155.

**Task.**
1. **NUMBERING BUG AUDIT (the important part).** BytePlus counts "Image n" by the 1-based order
   of `image_url` items in `content` **including `first_frame`/`last_frame` roles** (official
   rule: "the number is the sorting order of the asset among assets of the same type in the
   request body"). Our users' `@img1` means "first REFERENCE image" — so when a start/end frame
   is present, `@img1` must become "Image 2" (or 3), not "Image 1". Fix the rewrite so the
   image-token offset equals the number of image_url entries emitted BEFORE reference images
   (0/1/2 depending on start/end frame). Videos/audios have no such offset today (no frame-role
   video), but compute their numbering from the same builder loop rather than assuming.
   Extract the rewrite+offset into one exported pure function
   `rewriteMentionTokens(prompt, counts)` and make the body builder the only caller. Current
   catalog never mixes frames with media-refs (3101=frames, 3102=media-refs) — the fix is
   future-proofing; do NOT change catalog inputs.
2. **Test table.** Add unit-style cases (follow the existing build-time dry-run pattern used by
   `gen-models-validate.ts` for the byteplus body, or a tiny node test run in build) covering:
   mixed case (@IMG1/@Image2), adjacent punctuation ("@img1,"), multi-digit (@img12), token
   with no matching ref (must degrade harmlessly, no crash), start-frame present → offset
   applied, video+audio tokens together. Also cover `@vid2`/`@aud1` short forms — ADD them to
   the rewrite (case-insensitive, word-boundary) since users type them.
3. **Edit-preset chips (UI-only, both composers):** when ≥1 VIDEO reference is attached
   (plugin: video pane ref state; web: `st.refVideos.length > 0`), render 3 small chips above
   the prompt box: "Replace subject" · "Edit objects" · "Inpaint / Fix". Click inserts an
   English template at cursor (reuse each composer's existing token-insert helper):
   - Replace: `Replace the <subject> in @video1 with the one from @img1. Keep camera movement,
     lighting, background, pacing and all other elements completely unchanged.`
   - Edit objects: `Insert <object> from @img1 into @video1 at <where/when>. Match position,
     scale, perspective, lighting and shadows; keep everything else unchanged.`
   - Inpaint/Fix: `Make <element> in @video1 <desired change>. Do not modify the background,
     lighting, camera motion, or any other element.`
   Style: reuse the existing `.tag`/`.chip` look (plugin `.axig .tag` pattern; web `.chip`),
   accent on hover, no new CSS frameworks. The template strings CANNOT be physically shared
   between plugin and web (plugin is a standalone offline HTML) — define the SAME 3-template
   constant in BOTH files with an identical marker comment
   `/* SD2-EDIT-PRESETS v1 — sync manually with <other file> */` so drift is greppable.
4. Verification: `node --check` on plugin JS (extracted or via existing check flow),
   `npm run build -w apps/api` green, validator 0 issues. If BYTEPLUS_API_KEY present, ONE
   cheap live sanity: 3102, 480p/4s, prompt containing "@img1" WITH a start-frame image
   attached — confirm the outgoing body (log it redacted) shows the offset-corrected "Image"
   numbering. Commit; do NOT push.

**Out of scope:** new tools/panes, Seedream changes, autocomplete redesign, pricing, catalog
input changes.

---

## Prompt #5 — enable start/end frame on Seedance 2.0 (3102)

**Context.** On fal, reference-to-video and first/last-frame i2v were SEPARATE endpoints, so
catalog entry 3102 ("Seedance 2.0", provider byteplus) has `inputs: ["image-ref","video-ref",
"audio-file"]` and no start-end-frame. On BytePlus ONE model (`dreamina-seedance-2-0-260128`)
supports BOTH: strict frames via `role: "first_frame"/"last_frame"` AND multimodal refs — even
mixed (docs/BYTEPLUS-DOCS-MODELS.md §2-3). The adapter already handles frame roles AND the
mention-numbering offset for mixed mode (Prompt #4's `rewriteMentionTokens` + frame-image
offset — verified by build tests). The plugin video pane already has the "As start frame / As
end frame" slot sheet UI (`#vgRefStart`/`#vgRefEnd`, ~line 4391) used by frame-capable models;
web composer has `refStartUrl/refEndUrl` state.

**Task.**
1. `gen-models.ts` 3102: add `"start-end-frame"` to `inputs` and set `endFrame: true` (grep how
   3101 declares frame support — mirror exactly: `refKind` must STAY `"media-refs"`; only the
   frame капability flags are added). **Do NOT touch cost/perSec/durations/resolutions — money
   zone.** If the schema ties frames exclusively to `refKind:"frames"`, extend the type minimally
   so media-refs + frames coexist (adapter already builds both).
2. Verify the full path accepts start/end for 3102: client param → cost-quote params (frames must
   already be part of the quoted params hash for 3101 — same fields, no new pricing) → gen job →
   `buildByteplusVideoBody` (emits first_frame/last_frame; offset shifts @imgN — already tested).
   Fix any spot that gates frames on `refKind === "frames"` instead of a capability flag.
3. UI: plugin video pane + web composer should now OFFER "As start frame / As end frame" for
   3102 uploads (both UIs already render these options for frame-capable models — ensure the
   capability check reads the new flag). No visual redesign.
4. Build green, validator 0 issues (extend the byteplus body dry-run with one mixed case:
   start-frame + 1 image-ref + @img1 → "Image 2"). `node --check` plugin+web. Commit; no push.

**Out of scope:** 3101/Fast re-enable, Seedream, pricing, new UI elements beyond the existing
slot options.

---

## Prompt #6 — Dreamina-style atomic mention chips (rich pill tokens in the prompt editor)

**Context.** Reference UX must match ByteDance's own Dreamina composer: typing `@` opens a
dropdown listing attached references with THUMBNAILS ("Image 1", "Video 1"…); selecting one
inserts an ATOMIC inline pill — small thumbnail + accent-colored label "@Image 1" — into the
prompt; Backspace deletes the whole pill at once; pills are not editable character-by-character.
Today both composers use a plain `<textarea>` with plain-text `@img1` tokens — a textarea
cannot render pills, so this is a contenteditable migration. The SERVER CONTRACT DOES NOT
CHANGE: on submit the editor serializes back to the exact same plain-text `@img1/@video1/
@audio1` tokens (adapter rewrite from BATCH5 #4 stays untouched).

**Anchors.** Plugin (`plugins/after-effects-cep/AssetFlow_Plugin.html`): image pane `#igPrompt`
textarea + `#igMention` dropdown (~4098-4100, JS ~10678-11026: insertToken, igStripMention,
cascade renumber, igSanitizeMentions, tiles at ~10711); video pane `#vgPrompt` + `#vgMention`
(~4247-4248, JS ~11406-11965: vgPromptValue, insertVgTok). Web
(`packages/assetflow-studio/platform/index.html`, CF Pages direct source): `st.aiPrompt`,
refImages/refVideos/refAudios state, chip render ~19155, renumber logic ~19842-19846,
SD2-EDIT-PRESETS constant from #4. Existing behaviors that MUST keep working: auto-grow,
placeholder, Enhance (reads plain-text value; must read serialized value), preset-chip
insertion (#4), orphan sanitize before Generate, cascade renumber when a ref is deleted.

**Task.**
1. **Editor swap, one shared pattern per file.** Replace each prompt `<textarea>` with a
   `contenteditable` div (`role="textbox"`, `aria-multiline="true"`, same styling/min-height/
   placeholder via `:empty::before`). Implement a tiny "chip editor" helper (ONE function set
   per file, reused by image+video panes in the plugin): `getValue()` serializes childNodes →
   plain text where each pill contributes its token (`@img2` etc.); `setValue(text)` parses
   tokens back into pills (used by presets/Enhance/restore); `insertChipAtCaret(ref)`;
   `insertTextAtCaret(str)`.
2. **Pill spec.** `contenteditable="false"` inline span: 16-18px rounded thumbnail (ref preview
   bg-image; icon fallback for audio/video without poster) + label "@Image 1"/"@Video 2"/
   "@Audio 1" in the lime accent (reuse existing accent vars), subtle pill bg. Data attrs:
   `data-kind` (img|video|audio) + `data-n`. Backspace/Delete adjacent to a pill removes the
   WHOLE pill. Arrow keys skip over it. Copy/paste degrades to plain token text (set
   `clipboardData` on copy; on paste, strip HTML → plain text → re-parse tokens to pills).
3. **Dropdown upgrade/creation.** The `@` mention dropdown must show, per attached ref:
   thumbnail, label ("Image 1", "Video 1", "Audio 1"), kind icon — Dreamina style, keyboard
   navigable (↑/↓/Enter/Escape) and click. Selecting inserts a PILL (not text).
   **NOTE: the plugin already has this dropdown (upgrade it); the WEB composer has NONE —
   typing `@` there currently does nothing. CREATE it for web** (image and video panes),
   anchored to the caret, listing current refImages/refVideos/refAudios. Filter-as-you-type
   after `@` is optional; if it exists today, keep it working.
4. **Renumber/delete integration.** When a reference is removed: remove its pill(s) and
   renumber the remaining pills' labels + data-n (replaces the old regex-on-string renumber for
   the editor; keep the string-level functions for serialized values). Orphan sanitize before
   Generate: drop pills whose ref no longer exists.
5. **Robustness.** Typing plain text `@img1` (without the dropdown) must still work — on
   serialize it's already a valid token; optionally "upgrade" it to a pill on blur (nice-to-
   have, skip if risky). Undo/redo: accept browser-default quality, do not build a custom undo
   stack. IME composition must not be broken by pill insertion (guard on compositionstart/end).
   No frameworks — vanilla JS, minimal CSS, both files self-contained (plugin offline).
6. **Do not break:** Enhance round-trip (enhanced text re-set via setValue → tokens become
   pills again), preset chips from #4 (insert via setValue/insertTextAtCaret), validation
   gating on empty prompt, plugin CEP webview compatibility (older Chromium — no modern-only
   APIs like `beforeinput` reliance; test with feature-detection fallbacks).
7. Verify: `node --check` both files; manual test checklist in the summary (type @, pick ref →
   pill; backspace deletes pill; delete ref → pills renumber; Enhance keeps pills; Generate
   sends correct plain tokens — log serialized prompt in dev console once). Commit; no push.

**Out of scope:** server/adapter changes, new ref types, drag-reorder, image pane redesign.

---

## Prompt #7 — Seedream aspect-ratio selector (exact pixel sizes)

**Context.** Catalog entries 1020 (Seedream 5.0 Lite) / 1021 (Seedream 5.0 Pro) currently
expose only a quality tier (1K/2K/4K) — users cannot pick an aspect ratio. BytePlus image API
accepts EITHER `size:"2K"` (tier) OR exact pixels `size:"2048x2048"`. The official
ratio→pixel tables are in docs/BYTEPLUS-DOCS-MODELS.md §8 — treat them as the single source of
truth. Vertex image entries already have an aspect mechanism in `imgSettings` — mirror it.

**Task.**
1. `gen-models.ts` 1020/1021: add the aspect option list `["1:1","4:3","3:4","16:9","9:16",
   "3:2","2:3","21:9"]` (def "1:1") via the same `imgSettings` structure Vertex models use.
   **No cost/qualityCost changes — aspect does not affect price (same tier)."**
2. `byteplus.ts` image builder: when an aspect is provided, send the EXACT pixel `size` from
   the §8 table for (model, tier, aspect); when absent, keep current tier string. Table lives
   as a typed constant in byteplus.ts with an Uzbek comment pointing to §8. Unknown combo →
   fall back to tier string (never guess pixels).
3. Client: verify the existing aspect dropdown UI used by Vertex image models automatically
   appears for 1020/1021 once imgSettings has aspects (catalog-driven); fix gating if it's
   provider-conditional.
4. Validator: extend the byteplus image dry-run with 2 cases (Pro 1K 16:9 → "1424x800";
   Lite 4K 21:9 → "6240x2656"). Build green, validator 0 issues. Commit; no push.

**Out of scope:** batch output, Lite enable flip, pricing, video models.

---

## Prompt #3 — post-verification cleanup (RUN ONLY after 1-2 weeks of stable BytePlus prod use)

**Context.** BytePlus (provider "byteplus") has been serving Seedance 3101/3102 in production
stably; fal remains only for Topaz video upscale (3201).

**Task.**
1. In `gen-models.ts` remove the commented-out `falModel` leftovers on 3101/3102.
2. In `gen-processor.ts` remove the now-unreachable fal-video dispatch branches IF AND ONLY IF
   no enabled model resolves to them (grep enabled entries; 3201 uses a different flow — keep
   everything Topaz needs, including fal submit/poll and `fal-webhook.ts` if Topaz jobs use it).
3. Remove Seedance-specific dead code in `fal.ts` that no live model references (video-ref
   upload helpers etc.) — verify by grep before deleting each export.
4. Update `docs/PROJECT-STATUS.md` §-2 line about providers and `docs/DIREKTOR-HANDOFF.md` §3
   infra row: video = BytePlus ModelArk (Seedance) + fal (Topaz upscale only) + Vertex.
5. Build green, validator 0 issues.
