# MUAMMOLAR V1 — 2026-07-12 · FrameFlow (web + AE plugin)

> 27 problems, analyzed by the Director against the code. Each is a **self-contained prompt** for
> Claude Code. **Run them in the ORDER given in §EXECUTION ORDER below — not in P-number order.**
> The `P<n>` ids are permanent anchors (cross-references throughout the document rely on them);
> the **execution order is the numbered list in §EXECUTION ORDER.**
>
> Workflow: copy ONE step → run it in Claude Code → `/clear` → next step. The owner pushes.

## GLOBAL RULES (include with every prompt)

- **MONEY ZONE IS FROZEN.** Never touch credit consume/refund, the signed cost-quote / HMAC
  (`lib/gen-quote.ts`, `gen-models.ts` `computeGenCost`/`imageUnitCost`, `plugin-profile.ts`) or any
  credit value. Adding gates, caps, idempotency, tracking and UI around them is allowed. If a fix
  seems to require changing the math → **STOP and flag.**
- Migrations must be **additive only** (new tables/columns; nothing destructive).
- **English UI text; Uzbek code comments.** Minimal, tight diff outside the declared scope.
- **Studio source of truth:** edit ROOT `packages/assetflow-studio/js|styles|admin|contributor`,
  then run `npm run studio:sync`. NEVER edit the `studio/`, `admin/js` build artifacts.
  `packages/assetflow-studio/platform/index.html` is edited **directly** (CF Pages source).
- ⚠️ **BATCH6 conflict:** another workstream is redesigning `platform/index.html`
  (`docs/FIX-PROMPTS-BATCH6-2026-07-12.md`, Prompt #4 = AI Studio + Dashboard). Before any step
  that touches that file, **check whether BATCH6 #4 has landed**; if the working tree is dirty,
  stop and report instead of merging blindly. Affected steps are marked **⚠️BATCH6**.

### 🔴 THIS PRODUCT IS TWO CLIENTS: WEB **AND** THE AFTER EFFECTS PLUGIN

Every problem in this document affects **both** unless the scope line says otherwise. The plugin
(`plugins/after-effects-cep/`) is a **hand-synced copy** of the same composer, the same model
picker, the same catalog, the same API client — so **every bug in this file exists twice.**

**Rules:**
- Each step below carries a **SCOPE** line: `API` · `WEB` · `PLUGIN` · `ADMIN`. A step marked
  `PLUGIN` is **not done** until the plugin change is made and verified.
- Before finishing any step, **grep the plugin** for the strings/labels/routes/fields you changed
  and apply the equivalent change.
- Plugin constraints: **no internet-loaded assets** (self-host fonts, inline SVG) · the panel is
  **~380–450 px wide** (layouts that "just fit" at 920 px will not fit) · after editing run
  `bash plugins/after-effects-cep/scripts/install-cep.sh` and the user restarts AE · validate with
  `node --check` + a DOM/handler check.
- Known plugin-specific debt already catalogued: **P2.PLUGIN** (three inconsistent label maps),
  **P5.2** (cannot import raw stock media), **P12.2 / P13.6 / P14.6 / P15.4 / P16.2 / P20.5 /
  P22.5** (composer parity), **P18.2** (no retry/idempotency in the plugin API client),
  **P4.3** (import must pull the clean pack, never the watermarked preview).
- **A fix that lands only on the web is incomplete and will be rejected.**

- Verify with `node --check` (JS) / `npm run build -w apps/api` (TS) before committing.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

---

## EXECUTION ORDER (this is the order to run them in)

**Why this order:** the money bugs are bleeding *now*; the performance work must land *before*
5 000 assets arrive; the composer work must land *after* the re-render fix, or every step gets
rewritten. Dependencies are strict where marked 🔒.

### PHASE 0 — SEE, THEN FIX THE FOUNDATION *(config/infra · hours, not days)*

| # | Do | Source | Scope | Why first |
|---|---|---|---|---|
| **1** | **Turn on error tracking + metrics** (Sentry DSN, Cloud Run 5xx / latency alerts) | P8.1 | API | Everything below is currently diagnosed by *feel*. Make it a number **first**, so the fixes can be proven. |
| **2** | **Move the DB into the API's region** (Cloud Run `europe-west1` ↔ Neon `us-east-1`) + **use the Neon pooled connection string** | P8 #1–#2 | API | **~100 ms of Atlantic latency on every SQL query.** Biggest single win in the document; a config change. |
| **3** | **Turn on `CDN_BASE_URL`** (thumbs/previews become stable public URLs) | P7 #1 | API·WEB·PLUGIN | Kills ~10 000 presigns per catalog load, makes responses cacheable, **and fixes the expiring-thumbnail + gradient-flash failure modes (P8 #5, P10 #3)**. |
| **4** | **Add the DB indexes** for the new filter columns | P6 #6 / P7 #4 | API | Additive migration. Required before server-side filtering. |
| **5** | **Raise Cloud Run `max-instances`** (from 2) | P7 #9 / P8 #6 | API | Two instances is a demo. Do it **after** 2–4 so you are not paying to serve an inefficiency. |

### PHASE 1 — STOP THE BLEEDING *(money · do before anyone else uses the product)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **6** | **AUDIT the ledger for double charges** (run the SQL, report the result, refund via the existing refund path) | P18.1 | API | **Read-only first.** Tells you whether this already cost you money. |
| **7** | **Idempotency key on `POST /gen`** + stop retrying non-idempotent POSTs + move `cleanup`/`reconcile` off the request path | P18 | API·WEB·PLUGIN | Fixes the double-charge **and** the "Can't reach the server" message. 🔒 needs step 2. |
| **8** | **Ask the provider before refunding** (20-min timeout becomes "check", not "refund") + **resumable image jobs** + record `ProviderSpend` on failure | P19 / P19.5 | API | Converts most of your silent provider losses into delivered results. |
| **9** | **MEASURE the real provider cost** (BytePlus token capture · GCP billing export · confidence field · admin pricing table) | P24 | API·ADMIN | 🔒 **Everything in step 10 depends on this number.** |
| **10** | **Apply the pricing decisions D1–D2, D4** (packs $5→250 / $12→600 / $35→1800 · Studio $59→3 000 · delete "Priority generation" / "API access" / "Priority render queue") + startup assertion "no channel sells below cost" | P27 | WEB·API·ADMIN | 🔒 after 9. Stops the loss-making packs. |
| **11** | **Margin input UI** (accept 1.5 / `1,5`, live preview, warn below 1.0×) | P25 | ADMIN | 🔒 after 9 — never tune a margin on a guessed cost. |
| **12** | **Verify the 3 open security questions and report** (unverified-email generation · Pro-model server gate · Free storage quota), then fix what is open | P23 GAP2 / P23.4 / P23.6 | API | Report before coding. |
| **13** | **Session security**: distinguish `TOKEN_EXPIRED` from `FORBIDDEN` (stop nuking sessions on any 401) · add token revocation / "log out everywhere" | P8 #4 / P23 GAP3 | API·WEB·PLUGIN | |
| **14** | **BUILD THE WATERMARK** (server-side, Free plan) — the only real Free↔Pro differentiator, currently **advertised but absent** | P23 GAP1 / P4 | API | Makes Pro worth buying. |
| **15** | **Generate button: disable when credits are short** (pre-flight quote, no post-click rejection) | P22 | WEB·PLUGIN | 🔒 pairs with step 24 (parallel jobs) — do them together or the promise breaks. |

### PHASE 2 — MAKE IT SURVIVE 5 000 ASSETS *(before any content ingest)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **16** | **Server-side catalog: filter · search · sort · paginate** — and **delete the "fetch all pages" loops in BOTH clients** | P7 #2–#3 / P5.1 | API·WEB·PLUGIN | 🔒 needs 3+4. **The single biggest architectural debt.** |
| **17** | **Slim the list payload** (cards only; scenes/description move to a detail endpoint) + ingest writes `assetKeysJson` | P7 #5 | API | Also gives P2 its detail endpoint. |
| **18** | **Cache the catalog response at the edge** (`Cache-Control` + `ETag`) | P7 #6 | API | 🔒 only possible after 3. |
| **19** | **Plugin list virtualization** (render only visible cards) | P7 #7 | PLUGIN | 5 000 DOM cards inside CEP will freeze AE regardless of API speed. |
| **20** | **Resumable bulk-ingest worker** (queue · retry · progress · own Cloud Run job) | P6 #4 / P7 #8 | API | 5 000 clips ≈ 42–83 h of serialized ffmpeg. Must not compete with user traffic. |
| **21** | **Measure with 50 → 500 assets, record the numbers, then scale** | P7 #10 / P6.6 | — | Mandatory. Do **not** import 5 000 as the first test. |

### PHASE 3 — AI STUDIO / COMPOSER *(the order here matters more than anywhere else)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **22** | **Stop the global re-render** (scroll handler · fake 380 ms progress · 3.4 s tip timer · `_rvSafety`) and **render media as real `<img>`/`<video>`, not CSS backgrounds** | P10 | WEB (⚠️BATCH6) | 🔒 **FIRST.** It also causes the caret jumps and makes undo impossible (P15.1). |
| **23** | **Media quality pass**: 1280 px display derivative (WebP, alpha preserved) · `srcset` · 720p hover preview · **lightbox rebuild** (true aspect ratio, large viewer, prompt/details panel) · **card surface/elevation** | P9 + P11 + P17 | WEB·PLUGIN (⚠️BATCH6) | 🔒 after 22. **These four touch the same 30 lines — do them as ONE step**, or you rewrite it four times. |
| **24** | **Reference POOL + parallel generations**: references become model-independent (dimmed, never deleted, tokens never renumbered) · slot UI · several jobs at once with per-job cards | P13 + P20 | WEB·PLUGIN | 🔒 **before 25–27.** Everything in the composer depends on this state model. |
| **25** | **Composer chrome**: ONE settings chip (`16:9 / 720p / 5 Sec ▾`) opening a grouped popover · `＋` reference-kind menu · pinned `COST + Generate` · icons instead of raw text | P16 | WEB·PLUGIN | 🔒 after 24. Mandatory for the plugin (narrow panel). |
| **26** | **Composer input**: drag & drop (external files **and** generated cards) · paste · multi-file · pill ✕ · Clear · **Ctrl/Cmd+Z undo** | P14 + P12 + P15 | WEB·PLUGIN | 🔒 after 22 + 24. |
| **27** | **Credits screen**: real ledger (refunds visible!) · total spent / refunded / net · row → open the generation · downloads history | P21 | WEB·PLUGIN | 🔒 after 7 — it makes any double-charge customer-visible. |

### PHASE 4 — CONTENT PIPELINE *(the shelves — build them last, fill them first)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **28** | **Contributor upload rebuild**: bulk-only · 5-category taxonomy · **raw-file ingest (a second pipeline)** · spec extraction (ffprobe) · AI metadata at ingest · multi-orientation | P1 | WEB·API·PLUGIN | The big one. 🔒 needs 16–20 (scale) and 9 (cost caps). |
| **29** | **Catalog naming + routing**: "Stock Catalog" · correct type labels · **per-asset deep links** (`/stock/<type>/<slug>-<id>`) · **OG link previews** (CF Pages Function) · context-aware filters | P2 | WEB·API·PLUGIN (⚠️BATCH6) | 🔒 needs 17 (detail endpoint) + 3 (stable thumb URLs for `og:image`). |
| **30** | **Admin moderation at scale** + **semantic search for the new kinds** + **plugin import for raw media** | P5.2–P5.4 | ADMIN·API·PLUGIN | Without these, bulk content is unreviewable, unfindable and un-importable. |
| **31** | **Stock watermarking + audible audio tag** (previews) | P4 | API | Extends step 14's pipeline to stock/AI-Stock. |
| **32** | **AI Stock chain**: "Add to Explore" on a generation → admin queue → published in AI Stock | P3 | WEB·API·PLUGIN | **Fastest way to fill an empty catalog — it needs no contributors.** |
| **33** | **Contributor payouts**: pool base = revenue − AI − infra, share 30 % · **sybil defences** · credit expiry (D3/D5) | P27 D3/D5 + P26.4 | API·ADMIN | 🔒 **Do not enable payouts before the sybil defences.** |
| **34** | **Profit dashboard** (revenue − AI − payouts − infra = profit, per month/plan/channel) | P26.8 | ADMIN | The screen that answers "am I making money?" in five seconds. |
| **35** | **Then: ingest content (50 → 500 → the rest) and launch.** | P5.8 | — | |

### Deferred / decide later
- **P26.3** Studio "5 seats" priced as one account · **P26.7** the pool can go negative (no floor) ·
  **P23.5** device/seat limits · **P23.7** chargeback velocity limits · **P2.0b** OG aspect ratio ·
  **P5.6/P26.4** contributor content-theft (pHash) detection.

---

# P1 — Contributor upload flow is wrong: bulk must be the ONLY path, organized by category

## Owner's report (consolidated — this section is the FINAL, binding spec)

Single-template upload is useless — a contributor with 10 assets has no time to fill a 3-step
form 10 times. The upload page must be **bulk-only and category-driven**.

### CANONICAL TAXONOMY (binding · single source of truth for upload, catalog, admin, plugin)

```
1. Video Templates      kind=template  templateType=video-templates
   └─ app sub-step: After Effects · Premiere Pro · Apple Motion · DaVinci Resolve
   └─ UPLOAD FORMAT: .zip  (one zip = one template: project file + preview image/video)

2. LUTs                 kind=template  templateType=luts
   └─ UPLOAD FORMAT: RAW files, no zip  (.cube · .3dl · .look)

3. Stock                kind=stock
   ├─ Graphics          stockType=graphics         RAW: .jpg .jpeg .png .webp .svg
   ├─ Motion Graphics   stockType=motion-graphics  RAW: .mp4 .mov (alpha → .mov/ProRes)
   ├─ Music             stockType=music            RAW: .wav .mp3 .aiff
   └─ Sound Effects     stockType=sfx              RAW: .wav .aiff .mp3
   └─ UPLOAD FORMAT: RAW files, NO ZIP. Contributor selects e.g. Motion Graphics and drops
      10 raw video files at once.

4. AI Stock             — NOT uploaded by contributors. Filled from platform users'
                          generations via an Explore-submission chain → see P3.
```

Notes on the DB mapping (verified in `packages/database/prisma/schema.prisma:289–293`):
`kind`, `stockType`, `templateType` are plain `String` columns with defaults — **new values
are additive and need no enum migration.** `stockType` today documents `video|music|sfx|photo`;
`graphics` and `motion-graphics` are **added**. Do not delete the old values.

### Flow

1. Contributor opens **Upload** (bulk is the only mode — see P1.7 about the edit wizard).
2. Picks a **top-level category** (Video Templates / LUTs / Stock).
3. `Video Templates` → second step: the four host apps. `Stock` → second step: Graphics /
   Motion Graphics / Music / Sound Effects. `LUTs` → no second step.
4. The dropzone's accepted extensions and its copy **change with the selection** (a Music
   dropzone must not say ".zip files"). Contributor drops **many files at once**.
5. Everything goes to moderation. **Admin multi-selects and approves them all at once**
   (bulk approve already exists — `admin-views.js` `bulkAction()`).
6. **The algorithm derives the technical spec from the FILE ITSELF** (not from the name) and
   the **AI writes Description + Tags + Category**.

### Required metadata per asset

**A. Algorithmic (from the file, via ffprobe — must be exact, never invented):**

| Field | Video (Motion Graphics) | Image (Graphics) | Audio (Music/SFX) | LUT |
|---|---|---|---|---|
| Length / duration | ✅ `0:30` | — | ✅ | — |
| Resolution | ✅ `3840 × 2160` | ✅ | — | — |
| File size | ✅ `37.6 MB` | ✅ | ✅ | ✅ |
| Frame rate | ✅ `30 fps` | — | — | — |
| Alpha channel | ✅ `Yes/No` | ✅ (PNG/WebP) | — | — |
| Looped | ✅ `Yes/No` (see P1.10) | — | — | — |
| Video encoding | ✅ `H.264` | — | — | — |
| Audio codec / bitrate / sample rate | — | — | ✅ | — |
| Orientation | ✅ `Horizontal` | ✅ | — | — |

(The reference layout the owner supplied — Length / Resolution / File Size / Frame Rate /
Alpha Channel / Looped / Video Encoding / Orientation — is the spec list to render on the
asset detail page.)

**B. AI (internal, no user credits — same policy as `template-metadata.ts`):**

- **Video**: extract the **first frame and a middle frame**, send BOTH to the vision model →
  `Description` + `Tags` + `Category` (from the category list of the chosen top-level type).
- **Image**: send the image itself.
- **Audio**: no vision — derive from the file name + duration; tags from the name keywords.
  (If the name is meaningless the fallback applies; admin can fix it in the edit wizard.)
- **Video Templates (.zip)**: keep the existing behaviour — zip file name (+ preview image if
  present), see P1.4/P1.5.

**C. Defaults & name overrides (zip templates):** `Resolution` defaults to **1080p**,
`Orientation` defaults to **Landscape 16:9**; if the zip *name* states otherwise (`4K`,
`vertical`, `vertical and horizontal`) the name **wins** — see P1.5 / P1.6.

## Director's code analysis (root cause + hidden problems)

**What exists today**

- UI: `packages/assetflow-studio/js/contributor-views.js`
  - `uploadModeTabs()` (~line 597) — `Single template` | `Bulk upload (.zip)` segmented tabs,
    `UP_MODE` default = `"single"`.
  - `kindPickerCard()` + `PRODUCT_KIND_GROUPS` (~line 320) — the 3-step single wizard's product
    picker (Template: ae/pr/motion/resolve · Stock: video/music/sfx/photo).
  - `renderBulkUpload()` (~line 604) — a **flat** drop-zone: `.zip` only, no category choice,
    no sub-type, sends everything to one ingest endpoint.
- API: `apps/api/src/routes/contributor.ts` → `ingestOneZip()` (line ~1725) and
  `POST /ingest` (line ~2054).
- Metadata AI: `apps/api/src/lib/ai/template-metadata.ts` — `generateTemplateMetadata()`.
- Zip parsing: `apps/api/src/lib/ingest-zip.ts`; app detection: `apps/api/src/lib/apps.ts`.
- Admin bulk approve: **already implemented** (`admin-views.js` `bulkAction()` →
  `StudioApi.bulkReview`, `approve-free` / `approve-pro`) — step 5 needs no work.

**Hidden problems the owner did not mention (all confirmed in code):**

- **P1.1 — Bulk ingest HARD-REJECTS anything that is not an AE/Pr/Motion/Resolve project.**
  `ingestOneZip()` (line ~1751): if `zip.pack` is null → permanent reject
  `"No supported project file (.aep/.mogrt/.motn/.drfx…) found inside the zip"`.
  Pack extensions come from `apps.ts` `APP_CONFIG` (`.aep/.aet/.ffx`, `.mogrt/.prproj`,
  `.motn/.moti`, `.drfx/.dra/.setting`). **A LUTs zip (`.cube`, `.3dl`, `.look`) or a
  Graphics zip (`.png/.psd/.ai/.svg/.mogrt-less`) is rejected today.** So the owner's
  `Graphics` and `LUTs` bulk categories are impossible without extending pack detection.
  This is a **blocker**, not a nice-to-have.

- **P1.2 — Bulk ingest never writes `kind` / `templateType` / `stockType`.**
  `prisma.contributorTemplate.create()` (line ~1861) writes `templateApp` but NOT the
  BATCH3 taxonomy columns. Result: every bulk-ingested item lands with the schema default
  (`kind: "template"`, `templateType` default) → catalog type-pills and filters on the web
  and in the plugin **misclassify every bulk upload**. The new category picker must be
  passed through the ingest request and persisted.

- **P1.3 — The AI does NOT generate a Description.**
  `template-metadata.ts` returns only `{ title, cat, catLabel, tags }`. The system prompt
  asks for exactly `title` / `category` / `tags`. The owner explicitly wants `Description`.
  `ContributorTemplate.desc` stays empty on every bulk upload today.

- **P1.4 — Metadata AI runs on OpenRouter, which is being retired.**
  `template-metadata.ts` uses `isOpenRouterConfigured()` + `orChatJsonVision()` with
  `google/gemini-2.5-flash`. Project status says the model catalog now has **0 enabled
  OpenRouter models** (moved to Vertex / BytePlus). If `OPENROUTER_API_KEY` is unset in
  production, `generateTemplateMetadata()` **silently returns the fallback** →
  every bulk template becomes `"Uncategorized"` + generic filler tags. The owner would see
  "the AI isn't writing categories" and never know why. **Must be verified and, if unset,
  repointed to a live provider (Vertex Gemini) — keeping the internal, no-credit path.**

- **P1.5 — Resolution/Orientation are derived from PIXELS, never from the file name.**
  `ingestOneZip()` lines ~1837–1853: `probeMediaDimensions()` on the preview image/video →
  `orient` (horizontal/vertical/square) and `res` = `4k` if `max(w,h) >= 2000` else `1080p`.
  There is **no file-name parsing at all**. Also: the preview of a 4K template is often a
  1080p compressed MP4 → the item is filed as 1080p even though the project is 4K. The
  owner's rule (name wins, otherwise default 1080p + Landscape) is the correct fix.

- **P1.6 — "vertical and horizontal" cannot be stored.** `ContributorTemplate.orient` is a
  single string (`horizontal` | `vertical` | `square`). A template that ships BOTH
  orientations has no representation in the DB, the catalog filter, or the plugin.
  **Decision required from the owner** (see Open questions).

- **P1.7 — The single wizard is ALSO the edit screen.** `openEditTemplate()` (~line 640)
  sets `UP_EDIT_ID` and calls `route('upload')` — it reuses the same 3-step wizard. If the
  "Single template" tab is deleted outright, **editing an existing template breaks**. The
  wizard must be KEPT as the edit-only surface; only the *upload entry point* becomes bulk.
  Same for `admin` fix-ups of AI-written metadata.

- **P1.9 — 🔴 THE BIGGEST ONE: there is NO raw-file ingest path. The entire ingest pipeline is
  zip-only.** `ingestOneZip()` rejects anything that is not a `.zip` (line ~1733) and then
  rejects any zip without a project file (line ~1751). `bulkAddFiles()` on the client filters
  to `/\.zip$/i` (line ~433). The owner's Stock and LUTs flows send **raw .mp4 / .wav / .png /
  .cube files** — none of that exists today. This is not a tweak; it is a **second ingest
  pipeline** (`ingestOneAsset()`) beside the zip one:
  - client: category-aware `accept` list + validation (no more hard-coded `.zip`);
  - upload: reuse the existing presigned-URL path to `incoming/<contributorId>/…` (already
    used by the zip bulk flow — do NOT invent a new upload mechanism);
  - server: for a raw asset, the file **is** the pack (no unzip, no project-file check),
    `packHash` = sha256 of the file (dedup + malware scan keep working unchanged);
  - the preview/thumb: for video → generate a poster frame; for image → the file itself
    (downscaled); for audio → a waveform or a static placeholder + the audio file as preview.
    **Decide once and document it — an asset with no thumbnail is invisible in the catalog.**

- **P1.10 — Several of the requested spec fields cannot be read reliably. Do not fake them.**
  - **`Looped: Yes/No` is NOT stored in any container.** **OWNER DECISION: infer it
    algorithmically.** Implementation: extract the first and the last frame, compare them
    (e.g. downscale both to a small size and compute a perceptual/pixel difference); below a
    tuned threshold → `looped: true`. Requirements: run it **once at ingest** and store the
    result in the new `looped` column (never recompute at render); it must **never block or
    fail the upload** — on any error store `null` and simply omit the row from the spec list.
    Note honestly in the code comment that this is a heuristic and will sometimes be wrong;
    the admin can override it in the edit wizard.
  - **`Alpha channel`**: H.264/MP4 **cannot carry alpha**. Only `.mov` (ProRes 4444 / QT RLE)
    and `.webm` (VP9) can. If Motion Graphics accepts only `.mp4`, `Alpha` is always `No` and
    the field is pointless — so the accepted list for Motion Graphics **must include `.mov`**,
    and ffprobe must read the pixel format (`yuva420p`, `rgba`, `argb`, ProRes 4444) to answer
    honestly.
  - **File size** must be the stored object's size, taken after upload — not the browser's
    reported size (they differ after any transcode).
  - **`ffprobe` must actually be available in the API runtime.** The code already calls
    `probeMediaDimensions()`, so a probe binary exists — **confirm it ships in the Cloud Run
    image** before relying on it for eight fields; if it is missing, ingest silently degrades
    to defaults and every asset shows `1080p / Horizontal`.

- **P1.11 — DB columns for the spec list do not exist.** `ContributorTemplate` has `orient`,
  `res`, `fileSize` — but no `durationSec`, `width`, `height`, `fps`, `hasAlpha`, `looped`,
  `videoCodec`, `audioCodec`, `sampleRate`. The detail page cannot render the owner's spec
  list without them. **Additive migration required** (nullable columns; old rows keep NULL and
  the UI simply omits empty rows). No destructive change, no money-zone table touched.

- **P1.12 — Metadata runs AT INGEST (owner decision, 2026-07-12).** Not at approval. The admin
  must see a finished card — thumbnail, title, category, description, tags, full spec list —
  and approve (or fix) it with full information. **Approval stays a pure status flip**, so
  bulk-approving 50 items is instant and cannot time out on Cloud Run. The moderation queue UI
  must therefore render the AI-written metadata and the extracted spec for every pending item,
  and the admin edit wizard must be able to correct any of it before/after approval.

- **P1.13 — Cost/abuse control on the AI metadata path.** Every uploaded file triggers a vision
  call (2 frames per video). A contributor dropping 500 files fires 500+ calls with no rate
  limit and no cap — an internal, uncapped, unbilled path. Add a per-contributor daily ceiling
  and a global kill-switch env; on exceed, fall back to name-derived metadata instead of
  failing the upload.

- **P1.PLUGIN — the AE plugin browses by these same four types.** `assetflow-catalog.js`
  and the plugin's nav tabs group the catalog by `nav`/type. Because bulk ingest never writes
  `templateType` (P1.2), **every bulk-uploaded asset lands in the wrong plugin tab too** —
  not just on the web. Fixing P1.2 fixes both, but the plugin's tab labels must be corrected
  as well (see P2.PLUGIN).

- **P1.8 — AI category list is flat and not scoped to the chosen top-level.**
  `TEMPLATE_CATEGORIES` in `template-metadata.ts` mixes everything (titles, transitions,
  luts, mockups, logos…). Once the contributor has declared `LUTs`, the AI must not be free
  to answer `"transitions"`. The category list must be **filtered by the selected
  `templateType`** before it is put in the prompt.

## OWNER DECISIONS (2026-07-12 — binding)

1. **Multi-orientation → SUPPORTED.** Add an **additive** `orientations String[]` column to
   `ContributorTemplate` (keep the existing single `orient` column populated with the primary
   value for backwards compatibility — catalog, plugin and filters must not regress).
   `"vertical and horizontal"` in the zip name → `orientations: ["horizontal","vertical"]`,
   `orient: "horizontal"`. Catalog/plugin show a combined badge.
2. **AI input = ZIP FILE NAME ONLY.** Do NOT add vision/readme parsing in this prompt. If the
   name is meaningless → safe fallback (`Uncategorized` + keyword tags) and the admin fixes it
   in the edit wizard. (Keep the existing optional preview-image path in the code, but it is
   not a requirement of this fix.)
3. **TAXONOMY — FINAL (2026-07-12). This supersedes every earlier taxonomy note in this file,
   including the "5 pills incl. AI Stock" and the "Stock deferred" versions.**
   Top level = **Video Templates · LUTs · Stock · AI Stock** (see the canonical block at the
   top of P1). `Stock` is contributor-uploaded RAW files with four sub-types
   (Graphics / Motion Graphics / Music / Sound Effects). `LUTs` is its own top-level category.
   **`AI Stock` is NOT a contributor upload category** — it is filled by platform users'
   generations through an Explore-submission chain (**P3**), and therefore does **not** appear
   in the contributor upload picker at all.

4. **EVERY ASSET MUST LAND IN ITS OWN CATEGORY — this must be verified end-to-end, not assumed.**
   Owner's explicit requirement: what the contributor picks at upload is where the asset shows
   up, and the `AI Stock` category contains **only** `kind: "stock"` items — nothing else, and
   no stock item leaking into the template pills.
   **Verified bug (root cause):** `packages/assetflow-studio/platform/index.html` **never reads
   `kind` at all** — the catalog filters purely on `type` (`templateType`), and the API's
   `catalog-map.ts` (lines ~252–255) defaults `type` to `"video-templates"` when it is unset.
   Therefore **every stock asset currently falls into the "Video Templates" pill**. Combined
   with P1.2 (ingest never writes `kind`/`templateType`), the taxonomy is broken on both ends.
   Required proof before this prompt is called done — a real end-to-end run for EACH of the
   five categories:
   `contributor upload → admin approve → web catalog pill → plugin tab`
   — the asset must appear in its own category and **in no other**.

---

# P2 — Catalog naming + ROUTING: "Stock Catalog", correct type labels, and a real deep-link per asset

> Scope note: naming, per-type routes and per-asset deep links are ALL the same router in the
> same file. They are one prompt on purpose — splitting them would mean two prompts editing
> `go()` / `openDetail()` / the hash parser at the same time, which would conflict.

## Owner's report

On `getframeflow.app/#templates`:

- The **nav item "Templates" must read "Stock Catalog"** — everywhere (top nav, mega-menu,
  sidebar, mobile bottom nav, breadcrumb, footer links, page hero).
- The filter pill **"Templates" must read "Video Templates"**.
- The filter pill **"Motion" must read "Motion Graphics"**.
- (`Graphics` and `LUTs` are already correct.)
- The **route must become `/stock`**, and selecting a type pill must produce a nested route.
  **The catalog pills must mirror the canonical taxonomy in P1 — four top-level pills:**

  ```
  /stock/video-templates                Video Templates   (kind=template, templateType=video-templates)
  /stock/luts                           LUTs              (kind=template, templateType=luts)
  /stock/stock                → NO. Use:
  /stock/graphics                       Stock › Graphics          (kind=stock, stockType=graphics)
  /stock/motion-graphics                Stock › Motion Graphics   (kind=stock, stockType=motion-graphics)
  /stock/music                          Stock › Music             (kind=stock, stockType=music)
  /stock/sound-effects                  Stock › Sound Effects     (kind=stock, stockType=sfx)
  /stock/ai-stock                       AI Stock                  (see P3)
  /stock/ai-stock/image | /video        AI Stock sub-filters
  ```

  i.e. the `Stock` pill expands into its four sub-pills (a second pill row, like the owner's
  contributor picker), so no route ever reads `/stock/stock`.
- A template pill must show **only** `kind === "template"` rows; a stock pill only
  `kind === "stock"` rows with the matching `stockType`. Today `kind` is never read by the
  catalog at all — see P1 §4 for the root cause.
- **Every single asset must have its OWN link** — a template, a motion-graphics item, a
  graphic, a LUT. Today there is only the one generic catalog URL.
- **A shared link MUST show the asset's image** in the link preview (Telegram, Twitter/X,
  Slack, iMessage, WhatsApp, Facebook) — the owner requires this explicitly.

### ⚠️ DECISION REVISED (supersedes the earlier hash-route decision)

An earlier decision in this document said the routes would be **hash** routes (`#stock/...`).
**That decision is CANCELLED.** Reason — hard technical fact, not a preference:

> The URL fragment (everything after `#`) is **never sent to the server**. Crawlers and link
> unfurlers (Telegram, Twitter, Slack, Google) therefore cannot see `#stock/<slug>`; every
> shared link would resolve to the same site-root HTML with the same generic preview.
> **Per-asset link previews are impossible with hash routing.**

Binding URL shape — **real paths, no `#`**:

```
/stock                                                     catalog
/stock/<templateType>                                      catalog, type pill preselected
/stock/<templateType>/<slug>-<shortId>                     asset detail
e.g. /stock/video-templates/football-championship-logo-reveal-a1b2c3
```

`<slug>` is decorative (derived from the name); `<shortId>` is authoritative. Old
`#templates` and `/templates` URLs must 301/redirect to `/stock`.

### The filter toolbar must be CONTEXT-AWARE (owner requirement)

The toolbar (`Categories` · `All apps` · `Free / Pro` · `16:9` `9:16` `1:1` · `HD` `4K`) is
**hard-coded and identical for every category** — verified:

- `fOrientView` (line ~19798) → always `['16:9','9:16','1:1']`
- `fQualView`  (line ~19799) → always `['HD','4K']`
- `fAppsView`  (line ~19788) → always the full `appOptions` (Ae/Pr/Mn/Dr)
- `fGranView`  (line ~19790) → always the full flat `granularCats` list
- the master filter predicate is one long chain on line ~19772

Consequences today: selecting **LUTs** still offers an "After Effects / Premiere" app filter;
a **music** asset can be filtered by `4K` and `16:9`; the `Categories` dropdown offers
"Lower Thirds" and "Transitions" while browsing LUTs. Any of these produce a guaranteed
**0 results** dead end.

**Required:** the sub-categories and the filter set must be **derived from the selected
top-level category**. Implement as ONE declarative config object keyed by the five slugs — no
`if/else` scattered through the render.

**The taxonomy below is BINDING for v1** (owner-approved 2026-07-12: "write it yourself, we
can change it later"). It supersedes the flat `granularCats` list and the flat
`TEMPLATE_CATEGORIES` array in `apps/api/src/lib/ai/template-metadata.ts` — **both must be
rebuilt from this one source** so the contributor picker (P1), the AI metadata generator
(P1.8), the catalog filters and the plugin all agree.

```
VIDEO TEMPLATES   filters: Category · App(Ae/Pr/Mn/Dr) · Free-Pro · Aspect · Resolution
  intros · openers · titles · logo-reveal · slideshows · promo ·
  broadcast-packages · wedding · corporate · lower-thirds · transitions ·
  text-animations · infographics

LUTS              filters: Category · Free-Pro          (no App, no Aspect, no Resolution)
  cinematic · film-emulation · log-conversion · vintage-retro ·
  black-and-white · teal-and-orange · moody

STOCK › GRAPHICS         filters: Category · Free-Pro · Orientation · Resolution
  social-media · logos · mockups · infographics · backgrounds ·
  posters-flyers · thumbnails · textures · abstract

STOCK › MOTION GRAPHICS  filters: Category · Free-Pro · Aspect · Resolution · Alpha · Loop · FPS
  overlays · transitions · elements · backgrounds · light-leaks ·
  particles · lower-thirds · animated-icons · abstract

STOCK › MUSIC            filters: Category(genre) · Free-Pro · Duration · Mood · BPM
  cinematic · corporate · upbeat · ambient · hip-hop · rock ·
  electronic · acoustic · holiday

STOCK › SOUND EFFECTS    filters: Category · Free-Pro · Duration
  whooshes · impacts · risers · ui-clicks · foley · nature ·
  ambience · cinematic-hits

AI STOCK          filters: Type(Image|Video) · Category · Free-Pro · Aspect · Resolution
  abstract · nature · people · business · technology ·
  food · travel · sports · backgrounds
```

⚠️ `Mood` / `BPM` / `Duration` for audio and `Alpha` / `Loop` / `FPS` for motion graphics
depend on the new spec columns (P1.11). If a column is not populated, **hide that filter** —
never render a filter that can only return 0 results.

Migration note: existing rows carry old `cat` values (e.g. `uncategorized`, `logo-reveal`).
Do **not** delete or rewrite them — map unknown/legacy `cat` values to an `Other` bucket in
the UI so nothing disappears from the catalog. Additive only.

Rules for the implementation:

- A filter that does not apply to the current category is **not rendered** (not disabled, not
  greyed — absent). The toolbar changes shape as the pill changes.
- Switching the top-level pill **resets** any now-inapplicable selection, so a stale `4K`
  from Video Templates cannot silently zero out the LUTs list.
- The sub-category list per top-level type must come from ONE source shared with the
  contributor upload picker (P1) and the AI metadata category list (P1.8). Three different
  category lists for the same taxonomy is exactly the bug we already have.
- `AI Stock` sub-filters `Image` / `Video` map to the existing `stockType` values — note the
  DB value for images is **`photo`**, not `image`. Map label→value once, in the config object;
  **do not rename the DB value**.
- Deep-linkable: a sub-filter selection should be reflected in the URL where it makes sense
  (e.g. `/stock/ai-stock/video`), consistent with the routing section above.

## Director's code analysis

All in `packages/assetflow-studio/platform/index.html` (this file is edited DIRECTLY — it is
the CF Pages source; there is no build step for it).

- **Truncated pill labels — line ~17565:** `fixedCats = ['All', 'Templates', 'Motion',
  'Graphics', 'LUTs']`. The *stored* values are fine; only the display strings are wrong.
- **Two label↔slug mappers must stay in sync — lines ~18165, ~18177, ~18181:**
  - `pillTypes = { Templates: 'video-templates', Motion: 'motion-graphics', Graphics:
    'graphics', LUTs: 'luts' }`
  - `bandToType()` (~18177) and `typeToBand()` (~18181) hard-code the same short strings.
  - Also the keyword classifier at ~18160 returns the literal `'Motion'` / `'Templates'`.
  **Renaming the display labels without updating all four call sites silently breaks the
  catalog filter (0 results).** Best fix: make `fixedCats` a list of `{ value, label }`
  objects (or derive labels from a single `TEMPLATE_TYPES`-style map) so the label exists in
  exactly ONE place — do not scatter new string literals.
- **Nav label comes from the CMS, not from a literal — line ~17637:**
  `nav: { templates: 'Templates', … }` is the landing-config default, rendered as
  `{{ lcNavTemplates }}` (lines ~15738, ~15750). Changing only the literal in the file will be
  **overwritten by whatever is stored in the CMS/landing config** for existing environments.
  The fix must update BOTH the in-code default AND the persisted landing config (see
  `apps/api/src/routes/landing.ts`) — otherwise production keeps showing "Templates".
- **Other places that say "Templates" and must become "Stock Catalog"** (verified line numbers):
  ~15719 mega-menu (`Template marketplace`), ~16116 breadcrumb, ~16999 mobile bottom nav,
  ~17608 footer `Product` column, ~17716 footer links, ~17860 sidebar item, ~16420 the hero
  `<h2>Templates that cut<br>your edit time.</h2>`.
  Proposed hero copy (CMS-editable, owner may override): **“A stock catalog that cuts your
  edit time.”**
- **Routing — `go('templates')` / `goTemplates` / `isTemplates` / `data-screen="templates"`**
  (~16999, ~20149, ~20183). Requirements:
  - Primary route becomes `#stock`; `#templates` must **redirect** to `#stock` (old links,
    emails, the plugin's "open web" links and any SEO/OG references must not 404).
  - Nested route `#stock/<templateType>` must (a) be produced when a type pill is clicked,
    (b) be parsed on cold load / refresh / back-button so the pill is pre-selected.
  - The template DETAIL route must keep working from the nested route.
  - Grep the whole repo for `#templates` before finishing — it also appears in the plugin
    (`plugins/after-effects-cep/`) and in email templates.

### Deep links — what is broken today (verified)

- **`openDetail` (line ~20582) does NOT touch the URL** — it is a pure
  `this.setState({ detail: t })`. The detail view is invisible to the router.
  Consequences, all reproducible today:
  - the detail page **cannot be shared or bookmarked**;
  - the browser **Back button exits the whole catalog** instead of closing the detail;
  - **Google cannot index a single asset** — for a marketplace this is fatal;
  - **`shareTpl` (line ~20484) copies `window.location.href`, i.e. the generic `#templates`
    URL for every template.** The code even carries the admission:
    `// TODO(FF): per-shablon deep-link route kelganda shu URL almashadi`. Every "Share"
    click a user has ever made sent someone to the catalog root.
- **Required behaviour (client — `platform/index.html`)**
  - `go()` (line ~17903) currently hard-codes `const url = '#' + screen`. It must build a
    **path** for the stock routes. Keep the other screens working exactly as they do now —
    the app already understands path deep-links (`pathScreen`, line ~17937), so prefer paths
    consistently, but **do not regress `/login`, `/account`, `/aistudio`, `/projects`**.
  - `openDetail` pushes `/stock/<templateType>/<slug>-<shortId>` through the existing `go()`
    history helper — do NOT add a second history mechanism.
  - `closeDetail` / Back pops back to `/stock/<templateType>`, keeping the selected pill and
    the scroll position.
  - Cold load / refresh / pasted deep link resolves the asset **before** first paint: parse
    the path, take the `<shortId>` suffix as the source of truth. **A 404 state must exist**:
    unknown / unpublished / deleted id → a clean "Asset not found" screen linking back to
    `/stock`. Never a blank page, never a crash.
  - If the slug in the URL no longer matches the asset's current name → `replaceState` to the
    canonical URL (do NOT 404; the owner may rename assets).
  - `shareTpl` (line ~20484) copies the **canonical absolute deep link**, not
    `window.location.href`. Delete its `TODO(FF)` comment when done.
  - Exactly ONE pair of helpers — `assetPath(t)` / `parseAssetPath(pathname)` — used by every
    caller (catalog card, Recommended, Trending, breadcrumb, share, plugin links).
  - `<shortId>`: a stable, collision-safe suffix of the existing `ContributorTemplate.id`
    (cuid). Choose one derivation, document it in a comment, never duplicate the logic.

- **Required behaviour (hosting — link previews / OG tags)**
  - Add a Cloudflare Pages Function for the stock routes, e.g. `functions/stock/[[path]].js`.
    A Pages Function layer **already exists** (`functions/_middleware.js` — host router), so
    this is an addition, not a new hosting model.
  - The Function must:
    1. serve the SPA shell (`env.ASSETS.fetch` of the platform `index.html`) for every
       `/stock/*` request — this also provides the SPA fallback these paths need (note:
       `_redirects` generated by `packages/assetflow-studio/scripts/prepare-cf-pages.mjs`,
       line ~145, has **no `/*` catch-all** today, so `/stock/...` would 404 on a hard refresh
       without this);
    2. for an **asset** path, fetch that asset's public metadata from the API and inject, via
       `HTMLRewriter`, the real `<title>`, `<meta name="description">`, `og:title`,
       `og:description`, **`og:image` (the asset thumbnail URL)**, `og:type`, `og:url`,
       `twitter:card=summary_large_image`, `twitter:image`, and `<link rel="canonical">`;
    3. cache the injected HTML at the edge (e.g. `Cache-Control: public, max-age=300,
       s-maxage=3600`) so crawlers do not hammer the API;
    4. degrade safely: if the API call fails or the asset is unknown, serve the plain shell
       with the site's default OG tags — **never 500, never block the page**.
  - **API — a public single-asset endpoint is needed.** Today the catalog is
    `GET /api/plugin/catalog` (list, `APPROVED` + `published: true`). Add a read-only public
    endpoint (e.g. `GET /api/public/asset/:id`) returning `{ name, desc, thumbUrl, templateType,
    cat, orient, res, app, pro }` for **published assets only** — unpublished/pending assets
    must 404 (do not leak the moderation queue). No auth, no credits, no money-zone code.
  - **CSP:** `img-src` in `_headers` (same `prepare-cf-pages.mjs` file) must allow the
    thumbnail origin (GCS is already allowed). `og:image` must be an **absolute** URL.
  - Verify with the real unfurlers before declaring done: Telegram, Twitter/X Card Validator,
    Slack, and `curl -A "Twitterbot" https://getframeflow.app/stock/...` → the response HTML
    must contain the per-asset `og:image`.

## Hidden problems

- **P2.0 — The thumbnail must be a real, public, absolute image URL.** Catalog thumbs are
  served through the API, which **redirects to a signed GCS URL**
  (`apps/api/src/lib/serve-asset.ts`). Signed URLs **expire** — an `og:image` pointing at an
  expired signature shows a broken preview, and some unfurlers cache the redirect target, not
  the redirect. Before wiring `og:image`, confirm what the thumb endpoint returns and, if it
  is a short-lived signed URL, either (a) point `og:image` at the stable API endpoint that
  performs the redirect (most unfurlers follow one redirect — TEST it), or (b) make thumbs
  publicly readable on GCS with a stable URL. **This is the single most likely reason the
  preview image silently fails to appear — do not skip it.**
- **P2.0b — Preview image aspect ratio.** `twitter:card=summary_large_image` and Telegram
  expect roughly 1.91:1 / ≥600px wide. A vertical (9:16) template's thumb will be cropped or
  rejected. Acceptable for now (the thumb is shown as-is), but do not be surprised by it.
- **P2.1 — Naming must match P1.** The contributor bulk picker (P1) and the public catalog
  must show the SAME four labels. If P1 ships `Templates` while P2 ships `Video Templates`,
  contributors and buyers see two different taxonomies for the same data. Single source of
  truth: `TEMPLATE_TYPES` (`packages/assetflow-studio/js/data.js`) →
  `video-templates: "Video Templates"`, `motion-graphics: "Motion Graphics"`,
  `graphics: "Graphics"`, `luts: "LUTs"` — these labels are ALREADY correct there; the
  platform page invented its own short ones. **Reuse, do not re-invent.**
- **P2.2 — Two different meanings of the word "stock" now coexist. Do not conflate them.**
  - the **page** `/stock` = "Stock Catalog" = the whole marketplace (all five pills);
  - the **pill** `/stock/ai-stock` = "AI Stock" = only `kind: "stock"` rows in the DB.

  Do NOT rename the DB column or the `kind` values — the DB stays `template | stock`. This is
  a **UI-label layer only**. Put a comment at `fixedCats` stating exactly this, or the next
  person will "helpfully" rename something and break the catalog.
- **P2.PLUGIN — the AE plugin has THREE different, mutually inconsistent label maps.**
  Verified:
  - `plugins/after-effects-cep/assetflow-catalog.js:352` →
    `{ video: "Video Templates", motion: "Motion", graphics: "Graphics", luts: "LUTs" }`
  - `plugins/after-effects-cep/AssetFlow_Plugin.html:5094` → `NAV_LABELS =
    { video: 'Templates', motion: 'Motion Videos', graphics: 'Graphics', luts: 'LUTs' }`
  - `plugins/after-effects-cep/AssetFlow_Plugin.html:7040` → `HM_NAVLBL =
    { video: 'Templates', motion: 'Motion', graphics: 'Graphics', luts: 'LUTs' }`

  So the SAME type is called **"Video Templates"**, **"Templates"**, **"Motion Videos"** and
  **"Motion"** depending on which screen of the plugin the user is on. Consolidate to the
  binding labels (`Video Templates` / `Motion Graphics` / `Graphics` / `LUTs`) in **one**
  map inside the plugin, and have every screen read from it. Also: the plugin's browse panel
  is where users land after "Open in After Effects" — any web link the plugin opens must
  point at the new `/stock/...` URLs, not `#templates`.

- **P2.3 — ⚠️ FILE CONFLICT: `platform/index.html` is being actively rewritten by the BATCH6
  redesign workstream** (`docs/FIX-PROMPTS-BATCH6-2026-07-12.md`, Prompt #4 onwards, plus
  ~180 uncommitted lines already in the working tree). Doing P2 as a big edit will collide.
  **Constraint for Code: P2 must be a text/label/route change only — do NOT touch layout,
  CSS, tokens or component structure.** Run it when the tree is clean; if BATCH6 has
  uncommitted changes, stop and report instead of merging blindly.
- **P2.4 — The `1 results` count is real.** The catalog genuinely holds ONE published
  template while the landing claims "5000+". Not this prompt's job, but renaming the page to
  "Stock Catalog" makes the emptiness more visible, not less. (Tracked as the project's
  standing content blocker.)

---

# P3 — AI Stock: the "share a generation to Explore" chain does not exist at all

## Owner's report

The `AI Stock` catalog category is **not** filled by contributors. It is filled by the
platform's own users:

1. A user generates an image / video / audio in **AI Studio**.
2. On the generation card there is a new button — **"Add to Explore"** (submit my generation).
3. Pressing it sends that generated asset to the **admin** moderation queue.
4. The admin approves it (bulk approve, same queue).
5. It appears publicly in the **AI Stock** category.

**This whole chain — button, submission, admin queue entry, publishing — does not exist. The
UI/UX for it has to be designed and built.**

## Director's analysis

- Generations live in the `Generation` model and are private to the user; the catalog reads
  `ContributorTemplate` (`approvedCatalogWhere` in `apps/api/src/lib/catalog-map.ts`). These
  are **two different tables** — there is no path from one to the other today. That bridge is
  the core of this prompt.
- **Two possible designs — pick ONE and state it:**
  - **(a) Promote into `ContributorTemplate`** on submission (`kind: "stock"`, a new
    `stockType`/`source: "ai"` marker, `reviewStatus: PENDING_REVIEW`), copying the generated
    file into the normal asset storage layout. **Recommended** — the entire moderation, bulk
    approve, catalog, download, earnings, DMCA and audit machinery then works unchanged.
  - **(b) A separate `ExploreSubmission` table** with its own queue and its own catalog union.
    Cleaner data model, but it duplicates moderation + catalog + download logic. Only choose
    this if (a) is shown to be impossible.
- **The generated file must be COPIED, not linked.** A generation's stored object can be
  deleted by retention/cleanup or by the user; a published catalog asset that points at it
  would 404. Copy to the canonical asset key on submission.

## Hidden problems (all must be handled — these are the ones that bite later)

- **P3.1 — Rights and licensing.** A user is about to make an AI generation **publicly
  downloadable by everyone**. Required: an explicit attestation checkbox at submission (reuse
  `RIGHTS_ATTEST_TEXT` / `rightsAcceptedAt` / `rightsTermsVersion` — the contributor flow
  already has it), plus a decision on **who owns / who may sell it**, and whether the provider's
  terms (BytePlus/Vertex/fal) even permit redistribution of outputs. **Flag to the owner —
  do not silently publish user generations.**
- **P3.2 — Free or paid? Earnings?** Is an AI Stock item Free for everyone, or Pro-gated?
  Does the submitting user earn anything (the contributor payout machinery exists —
  `lib/earnings.ts`)? Undecided → **owner decision required**. Do NOT touch any credit or
  payout value while wiring this (money zone).
- **P3.3 — Moderation is now mandatory, not optional.** Public user-generated content is an
  NSFW/IP/abuse surface. `MODERATION_API_KEY` / `MODERATION_MODERATE_OUTPUTS` already exist in
  the env checklist — the submission path must run output moderation **before** it can reach
  the queue, and the admin queue must show the generation prompt alongside the asset.
- **P3.4 — Duplicate spam.** The same prompt run 50 times gives 50 near-identical assets. The
  existing `packHash` dedup only catches byte-identical files. At minimum: one submission per
  generation (idempotent), a per-user daily submission cap, and a "already submitted" state on
  the card.
- **P3.5 — The prompt is metadata.** For an AI asset the generation prompt + model is the best
  possible source for Title / Description / Tags — far better than a file name. Reuse the AI
  metadata path (P1) but feed it the prompt. Also decide: **is the prompt shown publicly?**
  (Most AI stock sites show it. It may leak whatever the user typed — sanitize/moderate it.)
- **P3.6 — Where does "Explore" live?** The owner says "Explore", the catalog pill is
  "AI Stock". These must be the same place or the user will not find their submission.
  Recommend: the button says "Add to Explore", and it lands in `/stock/ai-stock`. Also give
  the user a way to see the status of their submission (pending / approved / rejected) —
  otherwise it vanishes silently.
- **P3.7 — Plugin.** The AE plugin also shows generations. Once this exists, the plugin's
  generation cards need the same button (see the global plugin rule).

---

# P4 — Stock previews must be WATERMARKED; only a paying user gets the clean original

## Owner's report

Like Envato: the **preview** of a stock video / image carries a visible FrameFlow watermark.
The **original, clean file** is delivered only when a subscribed user downloads it.
Audio previews get an **audible watermark tag** (Envato/Artlist style).

**Owner decisions (2026-07-12):**

- Watermark scope: **Stock (Graphics + Motion Graphics)** and **AI Stock (P3)**.
  *Video Templates preview videos are NOT watermarked* (owner's choice — their preview is a
  render, not the product).
- Audio (Music / Sound Effects): **audible tag** on the preview — a low, periodic
  "FrameFlow" voice/sting every ~10–15 s. The downloadable original is clean.

## Director's code analysis — the architecture already fits (use it, don't invent)

- **Originals are already auth-gated.** `apps/api/src/routes/plugin.ts:400` — the `pack` route
  runs `requireAuth` + `downloadLimiter`, and `serve-asset.ts` hands out a **5-minute signed
  URL** for packs specifically so the link cannot be reshared.
- **`thumb` / `preview` are deliberately PUBLIC** (`plugin.ts:409` — `img`/`video` tags cannot
  send an auth header). This is exactly the split we need:
  → **`preview` and `thumb` = the WATERMARKED derivative. `pack` = the clean original.**
- **ffmpeg is available in production** — `Dockerfile:9` installs it. There is already a
  preview pipeline (`lib/transcode-preview.ts`, `lib/optimize-preview.ts`) with a **global
  ffmpeg concurrency semaphore** (`FFMPEG_MAX_CONCURRENCY`, default 1) and a
  background-processing helper (`transcodePreviewInBackground`). **Watermarking must go
  through that same semaphore and the same background path** — never on the HTTP request.

## What must be built

1. **At ingest (P1.12 — metadata/derivatives are produced at ingest, not at approval):**
   for every Stock and AI Stock asset, generate the watermarked derivative and store it as the
   `preview` (video/audio) and `thumb` (image) object. The clean file is stored as the `pack`.
2. **Video** (Motion Graphics): ffmpeg overlay of a semi-transparent FrameFlow mark — centered
   or tiled, ~10–20 % opacity — plus a preview-grade downscale/bitrate cap (e.g. 1080p, capped
   CRF) so the preview is not a usable substitute for the product.
3. **Image** (Graphics): same overlay via ffmpeg (no new image library needed).
4. **Audio** (Music / SFX): mix a short branded sting/voice tag over the preview every
   ~10–15 s (ffmpeg `amix`/`adelay`). Keep the preview at a reduced bitrate. The original stays
   clean.
5. **The watermark asset itself** (a transparent PNG + the audio sting) must be committed to
   the repo and referenced from one place — not regenerated per call.
6. **Backfill**: existing published rows must get watermarked derivatives too (a one-off
   script). Today there is one published template, so this is cheap — but write the script,
   because AI Stock will arrive in volume.

## Hidden problems (these are where this silently fails)

- **P4.1 — 🔴 If the raw stock file is used AS the preview, the original leaks publicly.** In
  the new raw-file ingest (P1.9) the natural shortcut is "the uploaded .mp4 is both the pack
  and the preview". That would publish the clean original at a public URL and **the watermark
  becomes theatre**. The pack object and the preview object must be **two distinct keys**, and
  the preview key must never be a copy of the original. State this explicitly in the ingest
  code with a comment.
- **P4.2 — 🔴 P2's `og:image` must use the WATERMARKED thumb.** The link-preview work (P2)
  points `og:image` at the asset thumbnail. If that thumb is the clean original, every shared
  link hands out an unwatermarked full asset to anyone. Cross-check when both land.
- **P4.3 — The plugin browses previews too.** The AE plugin's catalog shows `preview`/`thumb`
  from the same endpoints — so it will show the watermarked version automatically (correct).
  But **plugin IMPORT must pull the `pack`** (clean, auth-gated), not the preview. Verify:
  `plugins/after-effects-cep/assetflow-catalog.js` — if any import path ever falls back to the
  preview URL, the user gets a watermarked asset in their timeline. That is a shipping-level
  bug; check it explicitly.
- **P4.4 — Free plan vs. Pro.** "Only a subscriber gets the original" must be reconciled with
  the existing gate: assets have a `pro` flag and Free users may download Free assets today
  (`isFreePlan` + `dRaw.pro` — the inline Pro gate shipped in BATCH6 Prompt #3). **Do not
  invent a new paywall.** Clarify with the owner if the rule is now "clean original = paid
  plans only, regardless of the Free/Pro flag on the asset" — that would change the Free tier's
  meaning. Until confirmed: preview is watermarked for everyone; **download follows the
  existing plan gate unchanged.** Do NOT touch credit/plan logic (money zone).
- **P4.5 — ffmpeg throughput.** `FFMPEG_MAX_CONCURRENCY` defaults to **1**. A contributor
  dropping 10 × 4K/30 s clips means ten serialized transcodes — minutes of work. It MUST run in
  the background (the ingest HTTP response returns immediately, the item shows
  `processing → ready`), and Cloud Run's request timeout must not be the limiter. Also budget
  the cost: watermarking is CPU-heavy and Cloud Run bills CPU-seconds.
- **P4.6 — Storage doubles.** Every stock asset now stores original + watermarked preview
  (+ thumb). Factor it into the GCS lifecycle rules.
- **P4.7 — A watermark is not DRM.** Anyone can screen-record the preview. Keep the preview
  deliberately lower-resolution/bitrate — that, not the logo, is the real protection.

---

# P5 — DIRECTOR-RAISED: gaps in the chain the owner has not reported yet

Not reported by the owner — found by auditing the full chain
(*upload → moderation → catalog → download → plugin*) against the P1–P4 plan. Each of these
**breaks a P1–P4 feature once real volume arrives**. They are listed in the order they will
hurt.

- **P5.1 — 🔴 The web catalog filters CLIENT-SIDE over a paginated API. With volume it will
  show wrong results.** `GET /api/plugin/catalog` (`apps/api/src/routes/plugin.ts:180`) is
  **cursor-paginated** (`take` + `nextCursor`). The platform holds `this.state.catalog` and
  filters/sorts/searches it **in the browser** (`platform/index.html:19772`). Today that is
  invisible — there is **one** published asset. The moment the catalog holds hundreds of stock
  items, "LUTs" or a search will only match **within the first page**, and the user sees an
  almost-empty category with no way to know why. **Filtering, search, sorting and the type
  pills must move SERVER-SIDE** (`kind`, `templateType`, `stockType`, `cat`, `app`, `pro`,
  `orient`, `res`, `q`, plus proper pagination / infinite scroll). This is the single biggest
  architectural debt in the P1–P4 plan and it must land **before** bulk stock ingest, not
  after — otherwise the catalog silently lies.

- **P5.2 — 🔴 The AE plugin cannot import the new asset kinds.** `plugins/after-effects-cep/
  jsx/*.jsx` branches on the extension (`if (ext === "aep")`, `.mogrt` path). A stock **.mp4 /
  .wav / .png / .cube** has no import behaviour — the Browse panel will list assets it cannot
  place. Required: import raw media into the project/comp (`app.project.importFile` +
  place into the active comp), audio onto an audio layer, LUT via a Lumetri/color preset (or,
  if that is not feasible in AE, **hide LUTs from the plugin** rather than shipping a dead
  button). Decide per kind; a listed-but-unimportable asset is a bug report waiting to happen.

- **P5.3 — Semantic search will not see the new assets.** `lib/ai/embed-templates.ts` embeds
  templates for `/api/plugin/ai/search`. Stock, LUTs and AI Stock rows must be embedded too
  (the AI-written description + tags from P1 are exactly the text to embed), and the backfill
  must be run once. Otherwise the plugin's AI search finds only templates and the owner
  concludes "search is broken".

- **P5.4 — The moderation queue does not scale to bulk stock.** Bulk approve exists
  (`admin-views.js` `bulkAction()`), but the queue is template-shaped: no filter by
  contributor / category / kind, no audio player, no video scrubbing, and the metadata editor
  is the contributor's template wizard (P1.7). Reviewing 200 raw clips in that UI is not
  possible. Needs: queue filters, an inline preview player, "select all in this category",
  and a per-kind metadata editor. **Direct consequence of P1 — the owner's own step 5.**

- **P5.5 — Downloads, plan limits and contributor earnings now apply to stock.** Every stock
  item becomes downloadable, counts against the Free/Pro download limits, and generates a
  contributor earning (`lib/earnings.ts`, `recordTemplateDownloadEvent`). Questions the owner
  must answer before launch: does a stock download consume the same monthly quota as a
  template? Does the contributor earn the same per download (a 3-second SFX vs a full AE
  project)? **Money zone — plan it, do not improvise it in a fix prompt.**

- **P5.6 — Content theft is not detectable.** Dedup is `packHash` (byte-identical only) and the
  malware scan is a hash lookup — a contributor can re-upload stolen Envato/Artgrid footage and
  nothing stops it. The owner's own reference screenshot in this file is a watermarked Envato
  frame, which is exactly the material that will be uploaded. Minimum viable: a perceptual hash
  (pHash) on the first frame / image, checked against the existing library, plus a
  visible-watermark detector on submission ("this file appears to carry another vendor's
  watermark → reject"). At least log it for the admin.

- **P5.7 — The upload limit is per file, and 3 GB is generous.** Raw 4K stock at 3 GB × many
  files × many contributors → GCS bill and Cloud Run egress. Set a **per-kind** size ceiling
  (a .wav SFX does not need 3 GB) and a per-contributor daily volume cap. The `incoming/`
  bucket already has a 7-day lifecycle in the env checklist — verify it is actually applied.

- **P5.8 — The store is still empty (standing blocker).** One published asset; the landing says
  "5000+". P1–P4 build the shelves; they do not put anything on them. **P3 (AI Stock) is the
  fastest way to fill the catalog** — it needs no contributors at all. Worth sequencing first
  for that reason alone.

---

# P6 — 🔴 SCALE: the platform will NOT survive 5 000 assets. Load-bearing fixes before ingest.

## Owner's question

"I have ~5 000 assets ready. If I upload them, will the web/plugin choke? Will the server fall
over as users grow?"

## Director's verdict: **yes, it breaks — and not in a subtle way.** Verified in code:

**1. 🔴 Both clients download the ENTIRE catalog on every load.**
- Web: `platform/index.html:18215–18230` — a `for (p = 0; p < MAX_PAGES=100; p++)` loop that
  keeps following `nextCursor` until the catalog is exhausted, concatenating everything into
  `this.state.catalog`.
- Plugin: `assetflow-catalog.js:164–175` — the identical loop, `MAX_PAGES = 100`.
- Page size default = 100 (`plugin.ts:121`, max 200).
→ **5 000 assets = ~50 sequential HTTP round-trips per client, per catalog load**, and a
  50 000-item-deep JSON payload in browser memory. Then the browser renders and filters all of
  it (`index.html:19772`). In the CEP plugin (a single ~800 KB HTML page, Chromium-embedded)
  this will visibly freeze After Effects.

**2. 🔴 `CDN_BASE_URL` is EMPTY in production** (`cloudrun-env.yaml:24` → `CDN_BASE_URL: ""`).
`getPublicOrSignedUrl()` (`s3.ts:118`) therefore takes the **signed-URL branch for every asset
URL**. `mapCatalogItem()` signs **thumb + preview (+ every scene thumb/preview)** per row.
→ For a full 5 000-asset catalog fetch that is **10 000+ presign operations per client, per
load** — pure CPU on a **1-vCPU** Cloud Run instance. And because signed URLs expire (24 h,
`DISPLAY_URL_TTL`), the responses **cannot be cached at the edge** and the web app *re-fetches
the whole catalog on window focus* to refresh them.
**Fix: set `CDN_BASE_URL` and serve thumbs/previews as stable public URLs.** This single change
removes the signing cost, makes catalog responses cacheable, and offloads image/video bandwidth
to the CDN. It is the highest-leverage fix in this document.

**3. 🔴 Cloud Run is sized for a demo:** `deploy-cloudrun.sh:47–48` →
`--cpu 1 --memory 1Gi --max-instances 2 --timeout 600`.
**Two instances, one core each.** With 50 requests per user just to open the catalog, a
handful of concurrent users saturates it. Raise `max-instances`, and only then talk about
"more users".

**4. 🔴 Ingesting 5 000 files will take days, not hours.** `optimize-preview.ts` enforces a
**global ffmpeg semaphore, default `FFMPEG_MAX_CONCURRENCY = 1`** — every transcode, every
watermark (P4), every probe is serialized on one core. At a conservative 30–60 s per clip,
**5 000 clips ≈ 42–83 hours of continuous CPU**, on an instance that is also serving traffic,
with `--timeout 600`. Add ~10 000 AI vision calls (2 frames per video, P1) on top.
→ Bulk ingest **must be a separate, resumable background worker** (its own Cloud Run job /
queue), not the request path. It must survive restarts, retry per item, and report progress.
Do not attempt 5 000 files through the current path.

**5. Per-item storage calls.** `mapCatalogItem()` calls `listTemplateS3Keys(t.id)` when the
`assetKeysJson` cache is missing (`asset-state.ts`) — that is **one GCS LIST per asset**. The
cache exists (good), but the new raw-file ingest (P1.9) **must populate `assetKeysJson` at
write time**, or the first full catalog load fires 5 000 LIST calls.

**6. Missing DB indexes for the new filters.** `schema.prisma` indexes
`reviewStatus`, `published`, `[reviewStatus, published, updatedAt]`, `packHash`,
`contributorId`, `takedownAt` — but **nothing on `kind`, `templateType`, `stockType`, `cat`,
`templateApp`, `orient`, `res`**. The moment server-side filtering lands (P5.1), every filtered
query is a sequential scan. **Additive indexes required** — at minimum a composite
`[published, reviewStatus, kind, templateType]` and `[published, reviewStatus, stockType]`.

## What must be built (in this order — this is the launch-blocking sequence)

1. **Set `CDN_BASE_URL`** + make thumbs/previews public, stable, cacheable URLs. (Config +
   verify `_headers`/CSP `img-src` allows the CDN host.)
2. **Server-side catalog: filter, search, sort, paginate.** Delete the "fetch all pages"
   loops in BOTH clients (web + plugin) — the client requests **one page at a time** with the
   active filters, and appends on scroll ("Load more" / infinite scroll). This is P5.1; with
   5 000 assets it is no longer debt, it is a **blocker**.
3. **Add the DB indexes** for the filter columns (additive migration).
4. **A resumable bulk-ingest worker** (queue + retries + progress), with `FFMPEG_MAX_CONCURRENCY`
   and instance sizing tuned deliberately — ingest must not compete with user traffic.
5. **Plugin list virtualization** (render only visible cards) — 5 000 DOM cards inside CEP is
   not viable regardless of how fast the API becomes.
6. **Only then** raise Cloud Run `max-instances` and load-test: N concurrent users × catalog
   open, with realistic thumbnails.

## Hidden problems

- **P6.1 — The 5 000 assets have to physically get there.** At ~50 MB average that is ~250 GB
  of upload through the browser to `incoming/`, then copied to permanent storage, then
  watermarked (P4) → **a second full copy**. Plan the GCS bill, the `incoming/` 7-day lifecycle,
  and a resumable uploader (a dropped connection at file 4 800 must not restart the batch).
- **P6.2 — 10 000 AI vision calls.** Two frames per video (P1). Rate limits, retries, and cost.
  The per-contributor cap in P1.13 must not lock the owner out of his own bulk import — give
  the admin/owner path a separate ceiling.
- **P6.3 — Embeddings backfill** (P5.3): 5 000 embedding calls, chunked and resumable.
- **P6.4 — The moderation queue with 5 000 pending items.** Bulk approve currently posts every
  id in one request (`StudioApi.bulkReview`). "Select all" over 5 000 rows will time out or
  blow the request body. Needs chunking + a server-side "approve by filter" action.
- **P6.5 — Neon connection limits.** A background ingest worker + the API + parallel requests
  can exhaust the Postgres connection pool. Confirm the pooled connection string is used.
- **P6.6 — Do not import 5 000 assets into production as the first test.** Import 50, measure
  (catalog TTFB, plugin sync time, ffmpeg queue depth, Cloud Run CPU), then scale up. The
  measurement is part of the work, not an afterthought.

---

# P7 — PERFORMANCE PLAN: exactly what to change so web + plugin stay fast at 5 000+ assets

> Owner is time-pressured and wants to launch. This is the **ordered, minimal** engineering
> plan. P6 says *what breaks*; **P7 says what to do, in what order, and what each fix buys.**
> Items 1–6 are the **launch-blocking set**. Items 7–10 are the "grows with you" set.
>
> Already fine — do NOT redo these: thumbnails are generated as **512 px JPG**, previews are
> transcoded to **720p** (`lib/optimize-preview.ts:124`, `:94`). Image weight is not the problem.

## The launch-blocking six

**1. Turn on the CDN. (config; hours)**
`cloudrun-env.yaml:24` → `CDN_BASE_URL: ""`. Empty ⇒ `getPublicOrSignedUrl()` (`s3.ts:118`)
signs **every** thumb/preview URL, per row, per request.
Set `CDN_BASE_URL`, make the thumb/preview objects publicly readable, verify `img-src` /
`media-src` in `_headers` (`prepare-cf-pages.mjs`) allows the CDN host.
**Buys:** removes ~2 presigns per row (10 000+ per full catalog load), makes URLs stable and
**browser/edge-cacheable**, moves all image/video bandwidth off Cloud Run, and removes the
"signed URLs expired → refetch the whole catalog on focus" behaviour in the web app.
*Highest leverage change in this entire document.*

**2. Kill the "download the whole catalog" loops. (both clients; 1–2 days)**
- `platform/index.html:18215–18230` — `for (p = 0; p < MAX_PAGES=100; p++)` following
  `nextCursor` until exhausted.
- `assetflow-catalog.js:164–175` — the same loop in the plugin.
Replace with **one page at a time**: 24–48 items, `Load more` / infinite scroll.
**Buys:** first paint stops depending on catalog size. 5 000 assets → one request, not fifty.

**3. Move filtering, search and sorting to the server. (API + both clients; 2–3 days)**
Today the browser filters the array it holds (`index.html:19772`). Add query params to
`GET /api/plugin/catalog`: `kind`, `templateType`, `stockType`, `cat`, `app`, `pro`, `orient`,
`res`, `q`, `sort`, plus the existing cursor.
**Buys:** correctness *and* speed — without this, paginated + client-filtered = a category that
looks empty because the matches were on page 7. (This is P5.1; at 5 000 assets it is a blocker,
not debt.)

**4. Add the DB indexes. (additive migration; hours)**
Nothing indexes `kind` / `templateType` / `stockType` / `cat` / `templateApp`. Add composite
indexes covering the filtered queries, e.g.
`[published, reviewStatus, kind, templateType, updatedAt]` and
`[published, reviewStatus, stockType, updatedAt]`.
**Buys:** filtered queries stay on an index instead of scanning the table.

**5. Slim the list payload — and stop doing storage work per row. (API; 1 day)**
`CATALOG_SELECT` (`plugin.ts:80`) ships `metaJson`, `description`, full `tags`, contributor
object… and `mapCatalogItem()` runs `enrichScenesAsync()` **per row** (resolving every scene's
thumb/preview in storage) plus `listTemplateS3Keys()` when `assetKeysJson` is not cached.
- List endpoint returns only what a **card** needs: id, name, type/kind, thumb URL, pro flag,
  app, duration/res badge.
- Everything else (scenes, description, spec list, tags) moves to a **detail endpoint**
  (`GET /api/plugin/catalog/:id`) — which P2's deep links need anyway.
- The new raw-file ingest (P1.9) **must write `assetKeysJson`** so no LIST call is ever needed
  at read time.
**Buys:** an order-of-magnitude smaller response and no per-row storage round-trips.

**6. Cache the catalog response at the edge. (API; hours — only possible after #1)**
The catalog route sets **no `Cache-Control`** today (compare `plugin.ts:260`, which does).
Once URLs are no longer signed, add `Cache-Control: public, max-age=60, s-maxage=300` + `ETag`
to the list endpoint.
**Buys:** most catalog opens never reach the database. This is what makes "more users" cheap.

## The "grows with you" four

**7. Plugin list virtualization. (1–2 days)**
Even with paging, CEP renders every card into one ~800 KB HTML page. Render only the visible
window (windowed list / IntersectionObserver), keep thumbs `loading="lazy"`, and only load a
preview video **on hover**, never eagerly.

**8. Bulk ingest as a separate, resumable worker. (2–3 days — see P6 §4)**
`FFMPEG_MAX_CONCURRENCY` defaults to **1**; 5 000 clips ≈ 42–83 h of serialized CPU. Run ingest
as its own Cloud Run **job** (not the API service), with a queue, per-item retry, resume after
restart, and progress. **Ingest must never compete with user traffic for CPU.**

**9. Right-size Cloud Run. (config; hours)**
`deploy-cloudrun.sh:47–48` → `--cpu 1 --memory 1Gi --max-instances 2`. Two instances is a demo.
After #1–#6 the per-request cost collapses, so raise `max-instances` (e.g. 10) and consider
`--cpu 2`. Do this **after** the fixes, not instead of them — otherwise you are paying to
serve an inefficiency.

**10. Measure, then scale. (mandatory)**
Import **50** assets → measure catalog TTFB, payload size, plugin sync time, ffmpeg queue depth,
Cloud Run CPU. Then **500**. Only then 5 000. Record the numbers in `docs/`; without them
"is it fast?" has no answer. Load-test N concurrent users opening the catalog cold.

## Realistic launch advice (director's opinion)

You are late to market, so the temptation is to upload 5 000 assets and fix performance later.
**That order fails**: with today's code a 5 000-item catalog makes the web app and the plugin
unusable, and the first users see a frozen product — the damage is not recoverable with a later
fix. The dependency is strict: **#1–#6 (roughly one to two weeks) → import 500 → verify →
import the rest.** #1, #4 and #6 alone are hours of work and remove most of the cost.

A launch does not need 5 000 assets visible. **500 good assets with a fast catalog beats 5 000
with a frozen one**, and the remaining 4 500 can stream in behind the scenes once the ingest
worker (#8) exists.

---

# P8 — 🔴 "It randomly disconnects / sometimes just stops working" — root causes found

## Owner's report

Both the web app and the plugin sometimes drop the session by themselves, and sometimes simply
stop working.

## Root cause #1 — 🔴 THE DATABASE IS ON ANOTHER CONTINENT

- Cloud Run region: **`europe-west1`** (Belgium) — `deploy-cloudrun.sh:8`.
- Neon Postgres host: **`ep-shy-cake-apnzkowv.c-7.us-east-1.aws.neon.tech`** (N. Virginia) —
  `cloudrun-env.yaml:2`.

**Every single SQL query crosses the Atlantic: ~90–110 ms round-trip.** An endpoint that runs
5–10 queries pays **half a second to a second in pure network latency**, before any work. Under
load, or on any endpoint that queries per row, requests pile up, the instance (1 vCPU,
**max-instances 2**) saturates, and requests time out → *"it stopped working"*.

**Fix (highest priority, config-level):** put the database and the API in the **same region**.
Either move Neon to an EU region (`eu-central-1`) or move Cloud Run to `us-east*`. Nothing else
in P6/P7 matters as much per hour of effort — this is a **10–100× latency reduction on every
request**.

## Root cause #2 — 🔴 No connection pooling; Neon auto-suspends

`DATABASE_URL` points at the **direct** compute endpoint. It is **not** the Neon `-pooler`
host and carries **no `pgbouncer=true` / `connection_limit`** parameters.

- Prisma opens its own pool per instance; with a background worker (P6/P7 #8) plus the API,
  Neon's connection limit is reachable → intermittent `too many connections`.
- Neon **auto-suspends an idle compute**. The first request after idle pays a cold DB start —
  and can simply **fail**. This is the classic "works, then randomly doesn't" signature, and it
  matches the owner's report exactly.

**Fix:** use the Neon **pooled** connection string (`...-pooler...`, `?pgbouncer=true&
connection_limit=…&sslmode=require`), set Prisma's `directUrl` for migrations, and disable
auto-suspend (or accept it, but then add retry — see #4).

## Root cause #3 — 🔴 The web client has NO request timeout, and does not retry 5xx

`packages/assetflow-studio/platform/ff-api.js:53–62`:

- plain `fetch` with **no `AbortController`, no timeout** → if Cloud Run stalls, the request
  **hangs forever** and the UI spins until the user reloads. (The plugin does have
  `fetchWithTimeout`, 30 s — `assetflow-catalog.js:40`. The web app does not.)
- the 3-attempt retry loop only catches a **thrown network error**. A Cloud Run cold start,
  instance rotation or deploy returns **502 / 503** — `fetch` resolves, `break` runs, **no
  retry**, the error is shown to the user.

**Fix:** add a timeout (AbortController, ~20 s) **and** retry with backoff on `502/503/504` and
on `429` (respect `Retry-After`) — in **both** clients. Never retry non-idempotent POSTs blindly.

## Root cause #4 — 🔴 ANY 401 nukes the whole session

`ff-api.js:64–67`: on **any** 401 from **any** endpoint, the client calls `clearSession()` and
fires `ff-auth-expired` → the user is logged out mid-work. The JWT itself lives **30 days**
(`apps/api/src/middleware/auth.ts:29`), so genuine expiry is rare — which means these logouts
are being caused by something else:

- a redeploy with a different `JWT_SECRET` invalidates **every** token at once (mass logout);
- a 401 raised for a *permission* reason (not an auth reason) on one endpoint kills the session;
- a race where a request fires before the token is restored from `localStorage`.

**Fix:** only clear the session when the 401 is genuinely an **expired/invalid token** (the API
should return a distinguishable `code`, e.g. `TOKEN_EXPIRED` vs `FORBIDDEN`); everything else
surfaces as a normal error. Log the reason. **There is no refresh-token mechanism at all** — a
30-day JWT is the entire session model; when it dies, the user is simply thrown out. Decide
whether that is acceptable or a refresh flow is needed.

## Root cause #5 — Signed asset URLs expire after 24 h → dead thumbnails

`DISPLAY_URL_TTL = 86400` (`lib/catalog-map.ts:25`) and `CDN_BASE_URL` is empty (P7 #1), so
every thumb/preview URL is a **24-hour signed URL**. The **plugin caches the catalog to disk** —
so a cached catalog older than a day renders **broken/black cards** until a re-sync. The web app
papers over this with a focus-refetch of the entire catalog (expensive — see P6).
**Fix: P7 #1 (turn on the CDN).** Stable public URLs cannot expire.

## Root cause #6 — Two instances, no headroom

`--max-instances 2` (`deploy-cloudrun.sh:47`). During a deploy, a crash, or a traffic spike,
there is nowhere for requests to go → 429/503 → with #3 (no retry) the user sees a dead app.

## Required work (order)

1. **Move the DB into the API's region** (or the API into the DB's). — config, hours, biggest win.
2. **Switch to the Neon pooled connection string** + `directUrl` for migrations.
3. **Web client: request timeout + retry on 502/503/504/429 with backoff.** Same hardening in the
   plugin (it has a timeout; it needs the retry).
4. **Stop nuking the session on every 401** — distinguish expired-token from forbidden.
5. **Turn on `CDN_BASE_URL`** (kills the expiring-thumbnail failure mode too).
6. Raise `max-instances`; add a health-based warmup.
7. Add **error visibility**: `SENTRY_DSN` is in the launch checklist but unset. Right now these
   failures are invisible — the owner is diagnosing from feel. Turn it on **first**, so the fixes
   can be proven, and log DB latency + 5xx rate.

## Hidden problem

- **P8.1 — There is no way to see any of this.** No error tracking, no latency metric, no alert.
  Every conclusion above comes from reading configuration, not from telemetry. Ship Sentry (or
  Cloud Run's own metrics dashboard + log-based alerts) **before** the fixes, so "it randomly
  breaks" becomes a number instead of a feeling.

---

# P9 — Generation cards look compressed: the grid renders a 512 px, medium-quality JPEG

## Owner's report

In AI Studio the generation cards (image / video / audio) look compressed. They should be shown
in their real quality, not squeezed.

## Director's code analysis — the owner is right

- **The card image is a 512 px, `-q:v 5` JPEG.** `lib/optimize-preview.ts:127–137`
  (`makeImageThumbFile`): `scale='min(512,iw)':-2`, `-frames:v 1`, **`-q:v 5`** (mjpeg quality
  5 ≈ mediocre). The gen pipeline calls it for every image (`gen-processor.ts:105`,
  `makeImageThumb`) and uses `extractVideoPosterFrame` for video posters.
- **The client renders that 512 px file in the card.** `platform/index.html:18451` →
  `thumb: asset.thumbUrl || (type === 'image' ? asset.url : null)`, and the masonry card binds
  `imgSrc: t.thumbUrl` (`:19754`).
- In the owner's screenshot the cards are ~350–500 CSS px wide. On a 2× (Retina) display that
  needs **~700–1 000 real pixels**. A 512 px mjpeg-q5 image upscaled into that box is
  **visibly soft, with JPEG artefacts** — exactly what the owner sees.
- The **lightbox uses the original** (`:17185` → `lb.url`), which is why the full view looks
  right and the card does not. The inconsistency is the tell.

## Hidden problems

- **P9.1 — 🔴 Transparency is destroyed.** `makeImageThumbFile` writes **JPEG**, which has no
  alpha channel. Any generation with a transparent background (logo, overlay, sticker, PNG/WebP
  output) gets a **black or white background** in the card while the original is transparent.
  Silent data loss in the preview layer.
- **P9.2 — Video cards hover-play the FULL original file.** The card sets
  `<video src="{{ g.vidSrc }}">` (`:16246`) — for generations there is **no 720p preview
  transcode** (unlike templates, which go through `optimizePreviewForStreaming`). So hovering a
  4K generation streams the full-weight file. Quality is fine; **bandwidth is not** — and this
  directly fights P6/P7.
- **P9.3 — No `srcset` / DPR awareness anywhere.** One fixed-size image is served to a 1× laptop
  and a 3× display alike.

## What to do (director's recommendation — read before implementing)

The owner's literal request — "show the original, uncompressed" — would put 27 full-size 4K
assets in one masonry grid: tens of megabytes per page load. That **directly contradicts P6/P7**
(the scale/performance work) and would make AI Studio slower than the catalog it is meant to
feed. The correct fix is not "no compression", it is **a display-grade derivative instead of a
thumbnail-grade one**:

1. **Add a `display` derivative** alongside the existing 512 px thumb:
   **~1280 px on the long edge, high quality** (mjpeg `-q:v 2`, or better: **WebP/AVIF**, which
   also solves P9.1 because it keeps alpha). Keep 512 px for small/list contexts.
2. **Preserve alpha**: if the source has an alpha channel, the derivative must be **WebP/PNG**,
   never JPEG. Detect it with ffprobe (`pix_fmt`) — the same check P1.10 needs for stock.
3. **Serve `srcset`** (512 / 1280 / original) so a Retina display gets the 2× file and a small
   card does not download the big one.
4. **Video**: generate a **720p preview** for hover playback (reuse
   `optimizePreviewForStreaming`, already written and already behind the ffmpeg semaphore), and
   keep the original for the lightbox and for download.
5. **Backfill** existing generations (the owner has 27; the fix must also run for old rows or
   his library still looks soft).
6. **Never let the card fall back to the raw original** — `index.html:18451` currently does
   exactly that when `thumbUrl` is missing (`type === 'image' ? asset.url : null`). That is why
   *some* cards look sharp and others do not: the ones with no thumb are showing the full file.
   Make the fallback the `display` derivative.

**Acceptance:** on a 2× display, a generation card must be visually indistinguishable from the
lightbox image at card size; a transparent generation must show as transparent in the card; and
the page weight of the AI Studio grid must not grow more than ~2× (measure before/after).

---

# P10 — Cards and the lightbox flash into a colored gradient by themselves

## Owner's report

Clicking a card — or just leaving the page alone — makes the card/lightbox briefly turn into a
coloured gradient and "flicker", then the image comes back.

## Director's code analysis — reproduced from the code, cause is certain

**1. The media is painted as a CSS `background-image` layered ON TOP OF a gradient.**
`platform/index.html:19419`:

```js
const media = (url, h) => url
  ? "url('" + url + "') center/cover no-repeat, " + this.grad(h)   // image over gradient
  : this.grad(h);                                                   // gradient only
```

`grad(h)` (`:18195`) is the `radial-gradient(...)` the owner is seeing. The lightbox uses the
same helper (`:19874` → `g: media(...)`), and the cards bind it to an inline `style`.
**Whenever that `style` string is re-applied, the browser repaints the gradient layer first and
the image after it decodes → a visible gradient flash.** With a real `<img>` the browser keeps
the previously painted frame; with a CSS background it does not.

**2. 🔴 The whole app re-renders constantly — for cosmetic reasons.**

The platform is a **hand-rolled, React-like renderer in one file**: any `setState` re-renders
the **entire tree**. Cosmetic state (a hint counter, the scroll position, a fake progress bar)
lives in the **same state object** as the data — so a cosmetic tick costs a full re-render of
every card, every image, and the chip-editor. Three offenders, in order of damage:

| Where | Frequency | What it is for |
|---|---|---|
| `:17994` `this._onScroll = () => this.setState({ scrollP, scrollY })` | **every scroll event** (passive, but *not* rAF-throttled) | a scroll-progress value |
| `:18024` `this._genAnimT = setInterval(..., 380)` | **~2.6×/second while generating** | a **fake** progress bar (the server reports no real %) |
| `:17996` `this._tipT = setInterval(..., 3400)` | every 3.4 s | a rotating hint line — used in exactly ONE place (`tipText`, `:20080`) |
| `:18010` `_rvSafety` `setInterval(..., 1100)` | every 1.1 s | a `querySelectorAll` sweep over the DOM |

Each re-render rewrites every card's inline `style` — which contains `url(...)` (see #1) — so
**every image repaints**. That is the "it flickers on its own" (the 3.4 s cycle), the flicker
**while scrolling** (the scroll handler), and the flicker **while generating** (380 ms).

**This is the single biggest client-side performance bug in the app**, and it also explains the
caret jumps in the prompt editor and why undo cannot survive (P15.1) — the editor is rebuilt
underneath the user several times a second.

**3. The URLs are not stable, so the browser cannot even reuse its cache.** Asset URLs are
**signed** (P8 #5 / P7 #1: `CDN_BASE_URL` is empty) and carry a `?v=<epoch>` cache-bust
(`catalog-map.ts`). If a re-render produces a *different* URL string for the same image, the
browser treats it as a new resource and **re-downloads it** — guaranteeing the flash instead of
merely risking it.

**4. `va-skel` shimmer amplifies it.** `:19753` — the card gets the skeleton class **whenever a
thumb URL exists** (`t.thumbUrl ? ' va-skel' : ''`), not only while it is actually loading, so
the shimmering "loading" animation plays under every repaint.

## Required fix

1. **Render media as a real `<img>` / `<video>` element with a stable `src`** — not as a CSS
   `background-image`. Keep the gradient only as a **placeholder behind** the element (visible
   until the first load), never as a layer that reappears on re-render. This alone removes the
   flash.
2. **Cosmetic state must never trigger a global re-render.** Fix all four:
   - **scroll** (`:17994`) — do not put `scrollY`/`scrollP` in app state at all. Write it to a
     CSS variable / a single DOM node inside a `requestAnimationFrame`, or drive it with CSS
     (`animation-timeline: scroll()`); at minimum, rAF-throttle **and** bail out when the value
     has not changed meaningfully.
   - **fake generation progress** (`:18024`) — update that one progress element directly
     (`el.style.width = …`) instead of `setState` at 380 ms. Better: ask the API for real
     progress and drive the bar from the poll it already runs.
   - **rotating tip** (`:17996`) — update only its own text node, or do it in pure CSS.
   - **`_rvSafety`** (`:18010`) — the `IntersectionObserver` above it already does this job;
     the 1.1 s `querySelectorAll` sweep is a belt-and-braces fallback that should be removed or
     made event-driven.
   **Rule to state in the code:** nothing that is purely visual may live in the global state
   object.
3. **If the renderer must re-apply attributes, make it diff them**: never rewrite `style` /
   `src` when the value is unchanged (a string compare before assignment is enough).
4. **Stabilise asset URLs** — this is P7 #1 (turn on `CDN_BASE_URL`) plus a cache-bust key that
   only changes when the asset actually changes (`updatedAt`), not per request.
5. **Apply `va-skel` only while loading** — remove the class on the `load` event, not
   permanently.

**Acceptance:** open AI Studio and do nothing for 60 s — no card may flicker. Open the lightbox
on a slow connection — the previous frame or a static placeholder stays visible; the coloured
gradient never appears over an image that is already loaded.

## Note

This is the same root cause family as **P9** (media handled as thumbnails/backgrounds rather
than as first-class images) and it is fixed by the same CDN work in **P7 #1**. Sequence P7 #1
before P9/P10 so the URL stability is already in place.

---

# P11 — The lightbox is tiny, crops every image into a blurry 1:1 square, and has no detail panel

## Owner's report

Clicking a card opens a small viewer. Images are worse than videos: a **4:3** generation is shown
as a **blurry 1:1 square**. It should open like the reference (Higgsfield): a large viewer, the
asset at its **true aspect ratio**, with the prompt and the technical details beside it.

## Director's code analysis — three separate bugs stacked in one component

`packages/assetflow-studio/platform/index.html:17180–17200` (the lightbox) and `:19874` (its
view model):

**1. The viewer is capped at 620 px.** `:17180` → `style="width:100%;max-width:620px"`. On a
2 560 px screen the asset gets 620 px. That is the "why is it so small".

**2. The aspect ratio is HARD-CODED, not read from the asset.** `:19874`:

```js
asp: lbRaw.type === 'video' ? '16 / 9'
   : (lbRaw.type === 'audio' || lbRaw.type === 'sfx') ? '16 / 7'
   : '1 / 1'                       // ← every image is forced square
```

and the frame is `aspect-ratio: {{ lb.asp }}`. So a 4:3 or 3:4 or 9:16 image is **forced into a
square**, and a vertical 9:16 video is letterboxed inside a 16:9 box. The real ratio is
available — `Generation.params` already stores `aspectRatio` (`schema.prisma:453`) — it is
simply never used here.

**3. 🔴 For images there is no `<img>` element at all.** Look at the markup: `<video>` and
`<audio>` are real elements (with `object-fit: contain` — correct), but an **image is painted as
the container's CSS background**: `background: {{ lb.g }}`, where
`g = media(lbRaw.thumb || lbRaw.url)` (`:19874`) → `url(...) center/**cover**`.
Consequences, all three visible in the owner's screenshot:
- it uses **`thumb` first** — the **512 px, q5 JPEG** (P9) — so the full-size original is never
  shown even though it is available in `lbRaw.url`;
- **`cover`** *crops* the image to fill the square frame — parts of the picture are cut off;
- upscaled 512 px → **blurry**.

This is why video looks acceptable and images look bad: video got a real element, images did not.

## Required rebuild (reference: the owner's Higgsfield screenshots)

1. **Real `<img>` element, `object-fit: contain`, `src` = the ORIGINAL (or the 1280 px display
   derivative from P9) — never the 512 px thumb.** Keep the thumb only as a `poster`/blur-up
   placeholder while the full image decodes.
2. **True aspect ratio.** Take it from the asset (`Generation.params.aspectRatio`, or the
   image's natural `width/height`, or new stored `width`/`height` columns — same additive
   columns P1.11 needs). **Never hard-code an aspect for the media frame.** A 9:16 video must
   open tall; a 4:3 image must open 4:3.
3. **A large viewer, not a 620 px modal.** Full-viewport overlay: the media fits the available
   space (`max-height: 90vh`, `max-width: calc(100vw - panel)`), scaled down to fit, **never
   upscaled beyond its natural size** (an upscaled image is a blurry image).
4. **Right-hand detail panel** (the reference layout): author · **prompt** (with Copy and
   "See all") · **DETAILS**: Model · Quality · Size (`1280×720`) · Created. Below: the actions
   that already exist — Download · Project · Reference · Upscale · Delete — plus Share (P2's
   canonical deep link).
5. **Keyboard + navigation:** `Esc` closes, `←/→` moves to the previous/next generation in the
   grid. A viewer you must close and re-open for each item is the main reason the current one
   feels cramped.

## Hidden problems

- **P11.1 — `cover` vs `contain` is a silent content bug, not a style choice.** With `cover`,
  the user is shown a **cropped** picture and has no way to know. Any place using
  `center/cover` on a generation must be re-checked — the grid cards use the same `media()`
  helper (`:19419`).
- **P11.2 — `Generation` has no `width`/`height` columns.** Only `params` JSON
  (`schema.prisma:453`), which holds what was *requested*, not necessarily what the provider
  *returned* (models silently adjust dimensions). Store the **actual** probed `width`/`height`
  at generation time (ffprobe is already in the pipeline) — the reference panel's
  `Size: 1280×720` row needs a trustworthy source, and P9's `srcset` needs it too.
- **P11.3 — Same root cause as P9 and P10.** All three come from media being handled as a CSS
  background/thumbnail instead of a first-class element. **Fix them as one piece of work** —
  P9 (display derivative), P10 (real `<img>`, no gradient flash), P11 (viewer, true aspect).
  Doing them separately means touching the same 30 lines three times.

---

# P12 — Composer: remove a mention pill from the prompt (hover ✕), and a Clear button

## Owner's request (new feature, not a bug)

1. Hovering an `@Image N` **mention pill inside the prompt text** shows an **✕ in its corner**;
   clicking it removes **that mention from the prompt only**. The **reference thumbnail at the
   top of the composer must stay** (this is the whole point — today the only way to get rid of a
   mention is to delete the reference itself).
2. Add a **Clear** button in the corner of the composer. Pressing it clears **both** the prompt
   text **and** the references.

## Director's code analysis

- The composer prompt is a **contenteditable chip-editor**, not a textarea (BATCH5 #6):
  `installChipEditor()` (`platform/index.html:17926`, re-mounted in `componentDidUpdate`
  `:18015`). Pills are atomic nodes with class `mchip` (`isPill`, `:17261`; `makePill`,
  `:17262`), serialized back to the `@imgN` / `@videoN` / `@audioN` token text (`:17275`,
  `:18894`).
- The **reference chips above the prompt** are a separate list (`refChipsView`, `:19659`) and
  each already has an ✕ → `removeRef` (`:20375`).
- **`removeRef` already does the *opposite* of what is now being asked** (`:20379–20387`): when a
  reference is deleted it **strips that token from the prompt AND renumbers the remaining
  mentions** (`@img3` → `@img2`, …) so no dangling mention survives. That behaviour is correct
  and must be preserved — the new feature must not disturb it.

## What to build

**A. ✕ on the mention pill (prompt-only removal)**

- On hover of an `.mchip` pill, reveal a small ✕ in its corner (CSS only — no re-render).
- Click → **remove the pill node from the editor and re-serialize** `aiPrompt` through the
  existing serialization path. **Do NOT touch `refImages` / `refVideos` / `refAudios`, and do
  NOT renumber anything** — the references are unchanged, so `@img1 @img2 @img3` keep their
  meaning. (Renumbering here would silently re-point every remaining mention at the wrong
  image — this is the one way to get this feature badly wrong.)
- The pill lives inside a `contenteditable`. Use `mousedown` + `preventDefault` so the click
  does not move the caret or blur the editor, remove the node, then fire the same input/sync
  handler the editor already uses. Verify the browser undo (`⌘Z`) still behaves.

**B. Clear button (corner of the composer)**

- Clears: prompt text, **all** references (`refImages`, `refVideos`, `refAudios`,
  `refStartUrl`, `refEndUrl`), and any derived state that hangs off them (cost quote / enhance
  chip / preset chips).
- Only enabled when there is something to clear.
- Because this destroys a long prompt in one click: either a **confirm** or an **undo toast**
  ("Cleared · Undo"). The owner has 5-image, multi-sentence prompts — losing one to a misclick
  is a real cost.

## Hidden problems

- **P12.1 — An orphaned reference is still sent to the model.** After removing the mention but
  keeping the reference, the composer holds an image that the prompt never mentions. Image-edit
  models (Nano Banana, Seedream) are given **all attached inputs**, whether or not the prompt
  names them — so the user will pay for and receive a result influenced by an image they thought
  they had "removed". **Decide and make it visible:** either (a) dim/mark unreferenced thumbnails
  ("not used in prompt") and still send them, or (b) do not send unreferenced images. **This is a
  cost/credit-affecting behaviour — do not change what is sent without the owner's decision.**
  Do NOT touch the credit/cost-quote code path itself (money zone).
- **P12.2 — 🔴 The plugin has the SAME composer.** BATCH5 #6 shipped the chip-editor in **both**
  the web and the AE plugin (kept in sync by hand). Per the global rule, the ✕-on-pill and the
  Clear button must land in `plugins/after-effects-cep/` as well, or the two composers diverge
  again. Grep the plugin for `mchip` / `installChipEditor` and mirror the change.
- **P12.3 — Cost quote must be re-issued after a Clear.** The signed cost quote is tied to the
  request contents; clearing the composer must invalidate/refresh it rather than leaving a stale
  quote in state. Read-only interaction with the money zone: refresh the quote through the
  existing path, never recompute a price client-side.

---

# P13 — 🔴 Switching models DESTROYS the references — the prompt keeps dangling @mentions

## Owner's report

Nano Banana 2 Lite accepts up to ~10 references. Other models accept fewer — or none at all.
Today, switching model **silently deletes** the references:

- Switch Image → **Veo 3.1** (no references): the thumbnails at the top **vanish**, but the
  `@Image 1…5` pills **stay in the prompt** → the chain is broken.
- Then switch to **Gemini Omni** (which *does* accept 3 images + 2 videos): too late — the
  references are already gone.
- Go back to Image: **still gone.** The prompt still mentions them.
- And when a model accepts *fewer* refs than the user has attached (9 images → a model that
  takes 3): what happens to the other 6? Today: **deleted.**

## Director's code analysis — this is by design, and the design is wrong

`platform/index.html:20526–20546` (`pickModel`):

```js
if (mMode !== this.toolModelKey(tool)) { Object.assign(upd, this.refResetPatch()); }  // mode change → WIPE ALL
else {
  if (catMode === 'image') { upd.refImages = nc.kind === 'image' ? st.refImages.slice(0, nc.max) : []; }  // clamp = DELETE
  else if (catMode === 'video') {
    if (nc.kind === 'frames') { upd.refImages = []; upd.refVideos = []; upd.refAudios = []; }             // Veo → WIPE
    else if (nc.kind === 'media') {
      upd.refImages = st.refImages.slice(0, nc.lim.image || 0);   // clamp = DELETE
      upd.refVideos = st.refVideos.slice(0, nc.lim.video || 0);
      ...
```

`refResetPatch()` (`:19062`) empties **every** reference slot. And crucially: **`aiPrompt` is
never touched here** — so the `@imgN` pills survive while the images they point to are gone.
That is the exact "chain broken" state the owner describes. Note the contrast with `removeRef`
(`:20375`), which *does* clean the prompt when the user deletes a reference deliberately: the
codebase already knows references and mentions must stay consistent — it just does not apply
that rule on model switch.

## The fix — references must be a MODEL-INDEPENDENT POOL

**Principle: a model change is a change of *what gets sent*, never a change of *what the user
has*.** Only the user deletes references (the ✕ / Clear from P12).

1. **One reference pool = the source of truth.** Replace the four parallel arrays
   (`refImages`, `refVideos`, `refAudios`, `refStartUrl`/`refEndUrl`) as *state* with a single
   ordered pool, e.g. `refPool: [{ id, kind:'image'|'video'|'audio', url, role:'ref'|'start'|'end' }]`.
   Nothing in `pickModel` may remove an item from the pool. (The existing arrays can remain as a
   *derived* view so the rest of the UI keeps working — a minimal-diff path.)
2. **The model caps produce a PROJECTION, not a deletion — expressed as SLOTS.**
   *(The owner supplied the reference UX for this — build exactly this.)*

   The reference bar is **not a generic pile of thumbnails**. It is the set of **slots the
   current model declares**:

   ```
   Seedance 2.0 →  [＋] [ 🖼 @start · Start Frame ▾ ] [ 🖼 @end · End Frame ▾ ]   (+ image/video/audio refs)
   Gemini Omni  →  [＋] [ 🖼 @start · Start Frame ▾ ] [ 🖼 @end · End Frame ▾ ]
                                                       ↑ DIMMED / DISABLED — Omni does not accept an end frame
   ```

   Rules:
   - Each slot has a **stable token** (`@start`, `@end`, `@img1…`, `@vid1…`, `@aud1…`) that the
     prompt can mention. The token never changes meaning.
   - Switching model **re-projects the slots**: a slot the new model does not support becomes
     **visibly disabled (dimmed), NOT removed**, and **the media inside it is preserved**.
     Switching back re-enables it with its content intact. *(Owner's example: Seedance → Omni,
     the End Frame slot greys out because Omni takes no end frame; nothing is deleted.)*
   - A disabled slot states **why** on hover ("Gemini Omni doesn't accept an end frame").
   - Over-limit items (9 images attached, model takes 3) render **dimmed** with
     *"not sent — this model uses 3 images"*.
   - **Mutually-exclusive capabilities are model-declared too.** (Owner: on Seedance, media in
     the start/end frame slots means image references are not offered.) The `＋` menu must only
     offer the kinds the current model can actually accept **given what is already attached** —
     never offer something that will be silently dropped.
   - Only **active** slots are sent to the API.
3. **Numbering is bound to the POOL, never to the active subset.** `@Image 4` must keep meaning
   pool item 4 across every model switch. **Never renumber on a model change** — renumbering
   would silently re-point every mention at a different picture. (Renumbering stays only in
   `removeRef`, where the user really did delete something.)
4. **Switching back restores everything** — because nothing was deleted. This is the whole point
   of the request.
5. **Generate: send only `active`.** If the prompt mentions an inactive reference, do not fail
   silently: show a pre-flight notice — *“@Image 4, @Image 5 will be ignored by Gemini Omni
   (max 3 images).”* — and let the user proceed or switch model.
6. **Make the cost of a model switch visible BEFORE it happens.** The model picker should show
   each model's reference capability (*“no references” / “3 images, 2 videos” / “up to 10
   images”*), and switching to a model that cannot use the attached references should say so
   (a toast/inline note), not do it quietly.

## Hidden problems

- **P13.1 — Model switch also silently resets other settings.** `:20546` →
  `upd.aiAudio = null; upd.aiBitrate = '';` and the aspect gets clamped elsewhere (`:18647`).
  Same disease: the user's choices are destroyed instead of being re-projected. Preserve them
  where the new model supports them; reset only what is genuinely unsupported, and say so.
- **P13.2 — `refResetPatch()` is used in four places** (`useGenAsRef` `:19083`,
  `useGenAsUpscale` `:19107`, `pickModel` `:20531`, `refClearIfModeChanged` `:19742`). Two of
  them (`Use → as reference`, `Use → Upscale`) *intentionally* start a fresh composition — those
  may keep resetting. `pickModel` and `refClearIfModeChanged` must **stop** resetting. Do not
  "fix" all four with one blind change.
- **P13.3 — Start/End frames are a role, not a separate list.** Seedance keeps them, Veo uses
  them as its *only* reference mechanism, Omni ignores them. In the pool they are items with
  `role: 'start' | 'end'`; the projection decides whether they are sent. BATCH5 #5 already
  preserves them for Seedance (`:20539–20541`) — that special case disappears naturally once the
  pool exists.
- **P13.4 — The server must stay strict.** The client sends only `active`, but the API must keep
  rejecting/ignoring references beyond a model's limits (never trust the client). Verify
  `apps/api/src/routes/studio-gen.ts` still validates ref counts per model after this change.
- **P13.5 — The signed cost quote may depend on the reference set.** Changing which references
  are active must refresh the quote through the existing path. **Do not compute or adjust any
  price on the client. Money zone — read-only.**
- **P13.6 — 🔴 The plugin has the same composer and the same bug.** `plugins/after-effects-cep/`
  ships the same model picker + reference chips (BATCH5 #6, hand-synced). Fix both, or the AE
  users keep losing their references.

**Acceptance:** attach 9 images → switch to Veo 3.1 → thumbnails remain (dimmed, "not used by
this model"), prompt pills intact → switch to Gemini Omni → the first 3 images light up as
active, 4–9 stay dimmed with a reason → switch back to Nano Banana → all 9 active again.
**Nothing was ever lost, and no mention ever changed meaning.**

---

# P14 — Composer: add references by DRAG & DROP and by PASTE (today: neither works)

## Owner's request

Adding a reference must be possible by **dragging it into the composer with the mouse** (called
out as very important) and by **copy-pasting it into the composer**.

## Director's code analysis — the current flow is worse than it looks

- **The only way to add a reference is the `＋` menu → a hidden file input** (`addRefFile`,
  `platform/index.html:19209`). And that input has **no `multiple`** — `inp.files[0]`
  (`:19215`) takes **one file per click**. Attaching 9 images today = opening the menu, picking
  a kind, choosing a source, and selecting a file — **nine times**.
- **The composer's paste handler exists but ignores images.** `:17397–17402` reads
  `clipboardData.getData('text/plain')` and returns early if there is no text —
  `clipboardData.files` / image items are **never looked at**. So pasting a screenshot does
  nothing at all.
- **There is no drop handler on the composer** (no `dragover` / `drop` listeners anywhere near
  it). Dropping a file on the page just makes the browser open it.
- The **upload plumbing already exists and is good** — `addRefFile` uploads ≤20 MB as a data-URL
  (`FFAPI.refUpload`) and >20 MB via a presigned PUT (`FFAPI.refUploadUrl`), with a 100 MB cap.
  **Reuse it. Do not write a second upload path.**

## What to build

1. **Drag & drop onto the composer — from BOTH sources (owner: both must work).** The whole
   composer (reference bar + prompt area) is a drop target. `dragover` → highlight the drop
   zone; `drop` → resolve the payload:

   **(a) EXTERNAL — from outside the app** (Finder/Explorer, the desktop, another app):
   `e.dataTransfer.files` → upload through the existing `addRefFile` pipeline (data-URL ≤20 MB /
   presigned PUT above), then add to the reference pool (P13).

   **(b) INTERNAL — from a generated card inside AI Studio / My Library:** the generation is
   **already on the server** — there is nothing to upload. Mark the gen cards
   `draggable="true"`, put the generation id in `dataTransfer` (a custom type, e.g.
   `application/x-frameflow-gen`, plus a `text/plain` fallback), and on drop resolve it through
   the existing **`addRefFromLibrary`** (`:19122`) — which already fetches a fresh signed URL via
   `FFAPI.genGet`. **Do not re-upload a generation that already exists**, and do not use the
   card's (possibly expired, thumbnail-sized) display URL as the reference.

   The drop handler must distinguish the two by inspecting `dataTransfer.types` **before**
   reading `files`.
2. **Paste.** Extend the existing paste listener: before the text branch, check
   `clipboardData.files` / `clipboardData.items` for `image/*`, `video/*`, `audio/*` — if present,
   upload them as references. Keep the current text/plain behaviour untouched when the clipboard
   holds only text. A pasted screenshot has no filename — synthesize one.
3. **Accept MULTIPLE files at once** — for drop, for paste, and add `multiple` to the file input
   in `addRefFile`. Uploads run sequentially with per-file progress; a failure on file 3 must not
   discard files 1–2.
4. **Route by MIME, not by which slot the user happened to open**: `image/*` → image ref,
   `video/*` → video ref, `audio/*` → audio ref.
5. **Every generated card is a drag source.** Not just My Library — the main AI Studio result
   grid, the session results, and the lightbox image. Give the user a visible affordance
   (`cursor: grab`, a subtle lift on drag) so the gesture is discoverable, and a drag preview
   (the thumbnail) instead of the browser's default ghost.
6. **Where does the item land?** Dropping/pasting **onto the prompt text** should add the
   reference **and insert its `@Image N` pill at the caret** — that is the user's intent when
   they drop it *into the sentence*. Dropping onto the **reference bar** only adds the reference,
   with no pill. Implement both.

## Hidden problems

- **P14.1 — This DEPENDS on P13 (the reference pool).** Dropping 10 images while a 3-image model
  is selected must not throw 7 of them away. Without P13, drag & drop just makes it easier for
  the user to lose work. **Sequence P13 first.**
- **P14.2 — `refBusy` blocks the whole composer.** `addRefFile` sets a single global
  `refBusy` flag (`:19210`, `:19219`) — with multi-file upload the user would be locked out for
  the whole batch. Track per-item state and show each thumbnail uploading (skeleton → ready),
  the way the bulk upload page does.
- **P14.3 — Dropping a file the current model cannot use.** Do not reject it and do not silently
  drop it: add it to the pool, mark it inactive with the reason (P13 §2).
- **P14.4 — Dragging/pasting an image FROM ANOTHER BROWSER TAB gives a URL, not a file.**
  Dragging an `<img>` out of another tab produces `text/uri-list` / `text/html` in
  `dataTransfer` — **no `files` entry** — and copying an image from a web page often yields
  `text/plain` = the URL. So "from outside" has two flavours and only one of them is a real
  file. Decide: (a) ignore URL payloads (they land as plain text in the prompt — today's
  behaviour), or (b) detect an image URL and **fetch it server-side** (never client-side: CORS
  will block it, and a client-side fetch of an arbitrary user-supplied URL is an SSRF-shaped
  footgun; a server fetch needs its own allow-list / size cap / content-type check).
  **Default to (a)** unless the owner asks for (b) — but say so in the UI ("drop the file, or
  save the image first"), otherwise the user will think drag & drop is broken.
- **P14.5 — Guardrails.** Enforce the existing 100 MB per-file cap on the drop/paste paths too,
  reject unsupported MIME types with a clear toast, and de-duplicate (dropping the same file
  twice should not create two identical references).
- **P14.6 — The plugin.** The AE plugin has the same composer. CEP can accept OS file drops, so
  drag & drop should work there too; paste support in CEP is more limited — implement what the
  runtime allows and state clearly what it does not. Do not leave the plugin composer as the
  only place where you still have to click through a menu.

---

# P15 — Composer: Ctrl/Cmd+Z (undo/redo) does not work in the prompt editor

## Owner's request

Add undo (⌘Z / Ctrl+Z) to the prompt composer.

## Director's code analysis — native undo is impossible here; it must be built

The prompt is a **custom contenteditable chip-editor** (`installChipEditor`,
`platform/index.html:17250–17420`). It **mutates the DOM directly** and intercepts the keys that
would normally feed the browser's undo stack:

- `setValue()` (`:17302`) → `el.textContent = ''; el.appendChild(buildFragment(text))` —
  **wipes and rebuilds the entire editor**;
- `insertFragAtCaret()` (`:17326–17329`) → `r.deleteContents(); r.insertNode(frag)`;
- Enter (`:17367–17375`), paste (`:17397`), cut (`:17395`) and Backspace-on-a-pill (`:17381` →
  `p.parentNode.removeChild(p)`) all call **`preventDefault()`** and do the edit themselves.

A browser only maintains its undo stack for edits **it** performed. Direct DOM mutation
(`appendChild` / `removeChild` / `insertNode`, and especially `textContent = ''`) **destroys it**.
So ⌘Z today does nothing — or restores a corrupted state. **Native undo cannot be recovered
here; a history has to be implemented in the editor.**

## What to build

1. **A snapshot history inside the chip-editor.** The editor already has a canonical serialized
   form — `getValue()` returns the token text (`@img1 …`) and `setValue()` rebuilds the DOM from
   it (`:17275`, `:17302`). So a history entry is cheap: `{ text: getValue(), caret: <offset> }`.
   Keep an `undo[]` / `redo[]` pair, capped (e.g. 100 entries).
2. **Coalesce typing, snapshot discrete operations.** Plain typing groups into ~400–600 ms
   chunks (or on word boundaries) so ⌘Z does not undo one letter at a time. Every discrete
   operation pushes **its own single entry**: insert a mention pill · delete a pill (P12) ·
   paste · drop a reference (P14) · **Clear** (P12) · a reference removal that rewrites the
   prompt (`removeRef`, `:20375`).
3. **Key handling.** In the editor's existing `keydown` listener: `⌘Z` / `Ctrl+Z` → undo;
   `⌘⇧Z` / `Ctrl+Y` → redo. `preventDefault()` so the browser does not also try.
4. **Restore = `setValue(entry.text)` + restore the caret + fire the existing input/sync path**
   so `aiPrompt` state stays consistent. Restoring must **not** push a new history entry.
5. **Clear (P12) must be undoable** — that satisfies P12's "confirm or undo" requirement with no
   extra UI: ⌘Z brings the prompt back.

## Hidden problems

- **P15.1 — 🔴 The 3.4 s global re-render will fight the history.** P10 found
  `setInterval(() => this.setState(...), 3400)` (`:17996`), and `componentDidUpdate` re-runs
  `installChipEditor()` on **every** render (`:18015`). If that path re-assigns `el.value`, it
  calls `setValue()` → **the editor's DOM is rebuilt underneath the user**. That already risks
  caret jumps while typing; with a history it would also corrupt or reset it. **Fix P10 first
  (or at minimum make `installChipEditor` a no-op when the editor is mounted and its serialized
  value is unchanged) — otherwise undo will be flaky in a way that is very hard to debug.**
- **P15.2 — Undo must cover the reference pool, not just the text.** If ⌘Z restores a prompt that
  mentions `@Image 4` but the reference was removed in the meantime, the chain breaks again
  (P13's failure mode). Either (a) include the reference pool in the snapshot (recommended — the
  pool is a small array of URLs), or (b) restrict undo to text-only edits and explicitly
  document that reference add/remove is not undoable. **(a) is the honest answer** given the
  owner's workflow (5–9 references per prompt).
- **P15.3 — Snapshot the serialized text, never the raw HTML.** The pills are rebuilt from the
  token text; storing `innerHTML` would resurrect stale nodes and detached listeners.
- **P15.4 — The plugin.** Same chip-editor, same missing undo. Mirror it (global plugin rule).

---

# P16 — Composer chrome: the settings row overflows (Generate falls to its own line) and the labels are raw text

## Owner's report

- Some models expose **many settings**, so the settings row wraps and the **Generate button drops
  to the next line** — the composer looks broken and cramped.
- The reference chips run into each other / collide.
- The labels are **plain text** and look bad — `References: up to 9 images, 3 videos, 3 audio…`,
  `BALANCE ✦ 889 · video is billed per second of output`, `COST ✦ 48`, `Top up`,
  `MY LIBRARY · 27 GENERATIONS`, the `IMAGE` / `VIDEO` corner tags. **Replace them with proper,
  attractive icons/components** — raw text lines look unfinished.

## Director's code analysis

- `platform/index.html:15360` →
  `.va-dockrow { display:flex; align-items:center; gap:8px; margin-top:10px; **flex-wrap:wrap** }`
  with a `.sp { flex:1 }` spacer (`:15366`), inside a dock capped at
  `width: min(920px, calc(100% - 48px))` (`:15340`).
  With **Seedance 2.0** the row holds: mode · model · aspect · resolution · duration · audio ·
  bitrate · Enhance · COST · **Generate** — ~10 items. `flex-wrap` simply pushes the last ones
  onto a second line, and because the spacer collapses, **Generate ends up alone on the left**.
  This is not a styling accident — the row has **no overflow strategy at all**.
- With **Gemini Omni** it fits; with Seedance it does not. So the composer's layout quality
  depends on which model is selected — the exact thing a layout must not do.

## What to build

1. **A right-hand action cluster that NEVER wraps.** `COST ✦ N` + `Generate` sit in a
   `flex-shrink: 0` group pinned to the right of the row. Generate must be in the same place
   for every model.
2. **🎯 TARGET LAYOUT — the owner supplied a reference (Dreamina/Higgsfield-style composer).
   Build exactly this pattern; it solves the overflow structurally, not cosmetically:**

   ```
   ┌───────────────────────────────────────────────────────────────────────────┐
   │  [＋]  [🖼 Start Frame]  [🖼 End Frame]            ← reference row          │
   │                                                                           │
   │  Use @ to mention your images, videos or audio…   ← prompt (chip-editor)  │
   │                                                                           │
   │  [▶ Video ▾] │ [📊 Seedance 2.0 ▾] │ [⚙ 16:9 / 720p / 5 Sec ▾] │ [Toggle] │
   │                                                    [ COST ✦ 48 ] [Generate]│
   └───────────────────────────────────────────────────────────────────────────┘
   ```

   - **ONE settings chip, not seven.** Every per-model setting (aspect · resolution · duration ·
     audio · bitrate · anything a future model adds) collapses into a **single chip whose label
     is the current summary** — `16:9 / 720p / 5 Sec ▾`. Clicking it opens **one grouped
     popover**: `Resolution` (480p · 720p · 1080p · 4K) · `Duration` (4/5/6/7 sec · *View All*) ·
     `Audio` (toggle + ⓘ) · `Aspect Ratio` (16:9 · 9:16 · 4:3 · 3:4 · 1:1, **with little shape
     glyphs** · *View All*). Rows the current model does not support are simply **not rendered**.
   - **Result: the bottom row is FIXED at 3–4 elements** — mode · model · settings · (optional
     toggle) — plus the pinned `COST + Generate` cluster. A model with 8 settings and a model
     with 2 produce the **same** layout. Nothing can ever wrap again. This removes the need for a
     `ResizeObserver` overflow hack.
   - **The `＋` button opens a reference-kind menu** (as in the reference):
     `Start & End Frame` · `Image Reference` · `Video Reference` · `Audio File` — each with an
     icon, and each **hidden when the current model does not accept that kind** (P13 caps).
   - **`Start Frame` / `End Frame` are their own slots** on the reference row when the model
     supports frames — not buried inside the ＋ menu. Empty slot = a labelled button
     (`🖼 Start Frame`); filled slot = thumbnail + token + label + `▾` menu
     (`@start · Start Frame ▾`), per the owner's reference.
   - **The slot row is the P13 projection made visible** — see P13 §2. This is the same feature
     seen from the UI side; implement it once.

3. **Icon-first everywhere.** The project already ships **Phosphor icons** (`ph ph-*`) — use
   them. `icon + value`, never a sentence: mode (play) · model (chart) · settings (sliders) ·
   aspect ratio shown as **a little frame glyph** per ratio (as in the reference) · audio as a
   real **toggle**, not a text chip.
4. **Turn the raw text lines into components:**
   - `References: up to 9 images, 3 videos, 3 audio…` → a compact **icon row**
     (`🖼 ×9  🎬 ×3  🎵 ×3`) with the full sentence as a tooltip. It should also show
     **used / allowed** (`3/9`) — which the P13 pool makes trivial and genuinely useful.
   - `BALANCE ✦ 889 · video is billed per second of output` → a **balance pill** (coin icon +
     number) with the billing note behind an `ⓘ` tooltip.
   - `COST ✦ 48` → a proper cost chip, visually tied to the Generate button.
   - `Top up` → a real button with a `+` icon.
   - `MY LIBRARY · 27 GENERATIONS` → a header with an icon and a count badge.
   - The `IMAGE` / `VIDEO` corner tags on cards → **icon badges** (photo / film-strip glyph),
     not uppercase words.
5. **Reference chips must never overlap.** The reference bar (`.va-axrefs`, `:15567`) already has
   `flex-wrap: wrap` — with 9 references + the `＋` button they collide/overflow. Give it a
   fixed height with **horizontal scroll** (and a subtle fade at the edges), or a "+4 more"
   overflow chip. The bar must not grow taller than one row and push the prompt down.

## Hidden problems

- **P16.1 — Do this AFTER P13, or do it twice.** The reference bar must render **active** and
  **inactive** references (P13) and the `used/allowed` counter. Building the new chrome first
  and then bolting the pool state onto it means rewriting the same markup twice.
- **P16.2 — The plugin composer is much narrower.** The AE CEP panel is often ~380–450 px wide,
  so a row that barely fits at 920 px is hopeless there. The **single-settings-chip** pattern is
  what makes the plugin composer possible at all — it is **mandatory** there, not optional.
  Design the popover once and use it in both (the plugin popover may need to open upward /
  full-panel).
- **P16.5 — Settings must survive a model switch (P13.1).** With one combined chip the summary
  label is derived from state — if `pickModel` keeps nulling `aiAudio` / `aiBitrate` / clamping
  the aspect, the chip's label will visibly "reset itself" every time the user changes model.
  P13.1 must be fixed for this chip to behave.
- **P16.6 — The summary label must not lie.** `16:9 / 720p / 5 Sec` is only truthful if those are
  the values that will actually be sent. When a model forces a value (e.g. Omni forces audio on,
  or a model supports only one resolution), the chip must show the **effective** value, and the
  popover row must be marked as locked with the reason — never show a user-chosen value that the
  backend will silently override.
- **P16.3 — Possible text-merge bug, please verify.** In the owner's screenshots the prompt tail
  reads `…etiroz qilayotgan emotsiya**ushbu** sigaret va yonidagi…` — two fragments joined with
  **no space**. If that is not a typo, the chip-editor's serialization (`getValue`, `:17275`) is
  concatenating a text node and a following fragment without the separator. Reproduce by typing
  after a pill, then re-rendering. Related to the P10 re-render / P15 undo work — check it in the
  same pass.
- **P16.4 — `Audio: On 🔒`** shows a lock for Gemini Omni (audio forced on) but reads as a
  disabled setting. Make forced/locked settings visually distinct from user-changeable ones, and
  put the reason in a tooltip ("this model always generates audio").

---

# P17 — Generation cards and session rows blend into the background — no surface, no border, no elevation

## Owner's report

The generation cards merge into the page background and look bad — they need to be **lifted off
the background**. The **session list in the left sidebar** has the same problem.

## Director's code analysis

- **The result card has no surface at all.** `platform/index.html:15090` →
  `.va-rc { cursor:pointer; position:relative; min-width:0 }` — **no `background`, no `border`,
  no `box-shadow`, no padding**. The media element (`.va-media`, `:15025`) is placed directly on
  the page background (`body { background: var(--th-bg) }`, `:14222` → `#0a0a0b` in NOIR).
  A dark image on a near-black page therefore has **no edge** — exactly the owner's complaint.
- The thumb (`.va-thumb`, `:15003`) only sets `border-radius: 12px` — a rounded rectangle with
  nothing behind it.
- Same story for the sidebar session rows and the `.va-sess` tiles (`:15369–15371`): only a
  radius and an `outline` on the selected item.

## What to build

1. **Give the card a real surface.** Card container = `background: var(--surface)` +
   `border: 1px solid` a hairline token + `border-radius` + a soft `box-shadow` for elevation,
   with the media inset inside it. The image must sit **on** a card, not float on the page.
2. **A visible hover state:** lift (`translateY(-2px)`), stronger shadow, brighter hairline —
   so the card reads as an object you can act on.
3. **Sidebar sessions:** each row gets a subtle surface + hairline (or at minimum a hover
   surface and a clear selected state). "My Library" is already boxed — the session rows below
   it are not, which is why the sidebar looks unfinished.
4. **A separator for dark media.** For a very dark image, a hairline alone is not enough — add a
   faint inner ring (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.06)`) on the media itself so
   the edge is visible even when the picture is black.

## Hidden problems (do not skip these)

- **P17.1 — 🔴 THREE THEMES. Hardcoded colours are a defect.** The platform ships **noir /
  neon / cold** (`:14225`, `:14232`, `:14239`), each with its own `--th-surface`,
  `--th-surface-2`, `--th-surface-3`. The BATCH6 rule is explicit: **token-first; a hardcoded
  colour is a defect, and every change is checked in all 3 themes.** Use
  `var(--surface)` / `var(--surface2)` / the hairline tokens (`:14340`) — never a literal hex.
  The card must look correct in **all three** themes; verify with screenshots in each.
- **P17.2 — ⚠️ FILE CONFLICT with the BATCH6 redesign workstream.** `platform/index.html` is
  being actively redesigned by the other director (`docs/FIX-PROMPTS-BATCH6-2026-07-12.md` —
  Prompt #4 is **AI Studio + Dashboard**, i.e. *these exact cards*). Doing P17 blindly means
  two people restyling the same component. **Before running this: check whether BATCH6 Prompt #4
  has already landed** — if it has, re-verify whether the problem still exists; if it has not,
  this fix must be handed to that workstream or explicitly coordinated. Do not merge blindly.
- **P17.3 — Fix it together with P9/P10/P11.** Those three rebuild exactly this component (the
  media goes from a CSS background to a real `<img>`). Restyling the card first and then
  rewriting its internals means doing the same work twice. **Sequence: P10 → P9 → P11 → P17**,
  or do them as one piece.
- **P17.4 — The catalog cards use the same class.** `.va-rc` is shared with the Templates
  catalog (P2 §Deep links renders `va-rc` cards too). Changing it changes the marketplace grid
  as well — which is probably desirable, but it must be checked, not discovered.

---

# P18 — 🔴 "Can't reach the server — check your connection" while generating (and it can DOUBLE-CHARGE)

## Owner's report

While generating, the app sometimes shows **"Can't reach the server — check your connection"**.

## Where the message comes from

`platform/index.html:18197–18199`:

```js
errMsg(e) {
  if (e && e.message === 'NETWORK') return "Can't reach the server — check your connection";
  ...
```

`NETWORK` is thrown by `ff-api.js req()` (`:53–62`) **only after 3 failed `fetch` attempts** —
i.e. the request never got an HTTP response at all (connection refused / reset / DNS / CORS
failure). It surfaces on the `POST /api/studio/gen` call (`index.html:18799–18800`), not on the
poll (`pollJob`, `:18806`, fails silently and retries).

## Why it happens — three compounding causes (all verified)

1. **`POST /gen` is slow before it even starts working.** `apps/api/src/routes/studio-gen.ts:1006`:
   ```
   await cleanupExpiredSavedReferences(...)   // DB
   await reconcileStuckGenerations(...)       // DB (+ storage) — reconciles previous stuck jobs
   await prisma.genSession.findUnique(...)    // DB
   … model checks · cost-quote verify · credit consume (transaction) · create job
   ```
   Every one of those is a **cross-Atlantic DB round trip** (P8: Cloud Run in `europe-west1`,
   Neon in `us-east-1` — ~100 ms each). The request that is supposed to "just create a job" can
   take **seconds**.
2. **The retry policy cannot survive a Cloud Run cold start.** `ff-api.js` retries 3× with
   ~1.2 s / 2.4 s backoff — it gives up after **~4 seconds**. A Cloud Run instance boot can take
   far longer (the startup probe alone allows up to ~170 s: `deploy-cloudrun.sh:49`), and
   `--max-instances 2` means a second concurrent user can trigger exactly that boot.
   → the connection is refused, all 3 attempts fail inside 4 s, and the user gets **"Can't reach
   the server"** even though the service is coming up.
3. **There is no request timeout at all** (P8 #3) — so the other failure mode is the opposite:
   the request hangs and the UI spins forever.

## 🔴 The dangerous part: a lost response can DOUBLE-CHARGE the user

- `ff-api.js req()` retries **every** request on a network throw — **including `POST`**
  (`:53–62` has no method check).
- `POST /gen` has **no idempotency key** — `genSchema` (`studio-gen.ts:997–1005`) is
  `{ sessionId, mode, prompt, modelId, params, price, costQuoteSignature }`. Nothing identifies
  "this is the same request I already sent."

**So:** if the server *receives* the request, consumes credits and creates the job, but the
**response is lost** (connection reset, instance recycled mid-response), the client's `fetch`
throws → **it retries → a second job is created and credits are consumed a second time.**
The user sees "Can't reach the server" **and has been charged twice**.

This is consistent with the owner's report (the error appears *during generation*, i.e. exactly
when a request is in flight and instances are under load).

## Required fixes

1. **Never blindly retry a non-idempotent POST.** In `ff-api.js`, restrict the automatic retry
   to `GET`/idempotent calls, **or** gate it behind an idempotency key (below). This alone stops
   the double-charge.
2. **Add an idempotency key to `POST /gen`** (additive, no credit value changes): the client
   generates a UUID per *attempt to create a job* and sends it; the server stores it (unique
   index) and, on a repeat, **returns the existing job instead of creating a new one and
   charging again**. ⚠️ **MONEY ZONE — do not touch credit amounts, `computeGenCost`, the signed
   cost-quote or its HMAC.** Adding an idempotency record around the existing consume path is
   allowed; changing any credit value is not. If the implementation seems to require touching the
   quote signature, **STOP and flag.**
3. **Make `POST /gen` fast.** Move `cleanupExpiredSavedReferences` and
   `reconcileStuckGenerations` **off the request path** (a background sweep / a cron, or run them
   after the response is sent). The user's generate click must not pay for other jobs' garbage
   collection.
4. **Fix the transport (P8):** request timeout (~20 s), retry with exponential backoff on
   `502/503/504/429` (honour `Retry-After`), and a longer, more patient retry window so a Cloud
   Run cold start is survived instead of reported as a dead network.
5. **Fix the honesty of the message.** "Check your connection" blames the user's Wi-Fi for what
   is usually a server cold start. If the request may have gone through, say so and **verify**:
   before showing an error, re-check the session's jobs (the client already knows the session id)
   — if a job was in fact created, attach to it and poll instead of showing a failure.
6. **Raise `max-instances`** (P7 #9) so a second user does not force a cold start.

## Hidden problems

- **P18.1 — 🔴 AUDIT THE LEDGER FIRST — this is a task for Code, not for the owner.**
  Before writing any fix, **run this check against production and report the result**:

  ```sql
  -- Same user + same prompt + same model, created twice within 2 minutes = a retried POST /gen
  SELECT a.id AS gen_1, b.id AS gen_2, a."createdAt", b."createdAt",
         a.cost, a."modelId", left(a.prompt, 60) AS prompt
  FROM "Generation" a
  JOIN "Generation" b
    ON a."userId" = b."userId" AND a.prompt = b.prompt AND a."modelId" = b."modelId"
   AND a.id < b.id AND b."createdAt" - a."createdAt" < interval '2 minutes'
  ORDER BY a."createdAt" DESC;

  -- And the matching double charges
  SELECT "createdAt", delta, reason, "generationId", "balanceAfter"
  FROM "CreditLedger" WHERE reason = 'consume' ORDER BY "createdAt" DESC LIMIT 100;
  ```

  If rows come back, the double-charge is **real, not theoretical**: state how many times it
  happened and how many credits were lost, then refund them through the existing refund path
  (`refundAiCredits`) — **never by editing balances by hand.**
  The `reconcileStuckGenerations` function exists precisely because jobs get stuck, so this class
  of failure is **already known to the codebase**.
- **P18.2 — The plugin has the same client.** `plugins/after-effects-cep/assetflow-client.js`
  does its own fetching with a 30 s timeout but (per P8) **no 5xx retry** and no idempotency
  either. Same double-charge exposure. Fix both.
- **P18.3 — `pollJob` gives up after 8 consecutive failures / 12 minutes** (`:18806–18815`) and
  says *"Lost track of this job — it may still finish"*. With a slow API that message will start
  appearing for **successful** generations. It should resume polling on `visibilitychange`/focus
  rather than abandoning the job.

---

# P19 — Who pays when a generation fails? (The user is refunded. The OWNER can silently eat the provider cost.)

## Owner's question

"If a user presses Generate and the server errors, the user gets their credits back — fine. But
what happens to **my** money? Am I charged by the provider? What are the options?"

## Director's analysis — three cases, only one of them costs money

Verified in `apps/api/src/lib/gen-processor.ts`:

- `fail()` (`:995–1006`) sets `status = failed` and calls `refundAiCredits(...)` **atomically**
  (`updateMany` guarded, so a double refund is impossible — audit 2026-06-26).
  → **The user is always made whole.** That part is correct and must not be touched (money zone).

| Case | What happened | User credits | **Owner's real money** |
|---|---|---|---|
| **A** | Failure **before** the provider is called (validation, DB, cold start, network, invalid quote) | refunded ✅ | **nothing paid** ✅ |
| **B** | The **provider itself** errors / rejects | refunded ✅ | usually nothing — but **not guaranteed** (BytePlus bills tokens; some providers bill started jobs) ⚠️ |
| **C** | 🔴 The provider **produced the asset** (money already spent) and **our side** then failed — GCS upload error, output moderation block (`MODERATION_OUTPUT_BLOCKED`, `:986`), instance killed mid-processing, DB write failure | refunded ✅ | **PAID. Pure loss.** ❌ |

**Case C is the only real leak** — and it is invisible today.

**What already exists (do not rebuild):**
- **Video generations are resumable.** `isResumableRunningGeneration()` (`:311–321`) +
  `__providerJob` / provider webhook stored in `params` (`:166`, `:213`) → if the server dies
  while a *video* is running, it **re-attaches to the provider's existing job instead of paying
  for a new one.** Good. **This does NOT exist for images.**
- `writeProviderSpend()` (`lib/ledger.ts:35`) records provider cost per generation.
- `spend-guard.ts` caps total provider spend.

## Options (cheapest first — ordered by value per hour of work)

1. **Never fail what has already been paid for — RESUME instead.** Extend the video resume
   mechanism (`__providerJob`) to **image** generations. If the provider returned a result and
   only *our* storage/DB step failed, retry **fetching and saving that same result** (with
   backoff) instead of marking the job failed. The provider is paid once; the user gets what they
   paid for. **This converts most of case C into a success — it is the single highest-value fix.**
2. **Retry the delivery step, not the generation step.** Download-from-provider → upload-to-GCS
   must have its own retry/backoff and must not be the thing that throws the whole job away.
3. **Moderate the PROMPT before spending, not the OUTPUT after.** Output moderation
   (`MODERATION_OUTPUT_BLOCKED`) fires **after** the provider has been paid — every block is a
   direct loss. Pre-moderating the prompt is nearly free. Keep output moderation as a backstop,
   but it should be rare. (Do not weaken moderation — move most of it earlier.)
4. **Make the loss VISIBLE.** Today there is no way to answer "how much did I pay for
   generations that were refunded?". Add an admin metric that joins `ProviderSpend` with refunded
   `Generation` rows: **"paid to provider but refunded to user"** — per day, per model, in USD.
   Without this number, every discussion of this problem is guesswork. **Ensure `ProviderSpend`
   is written even when the generation later fails** — otherwise the loss is not even recorded.
5. **Price it in.** A 1–3 % failure loss is normal for this business; the credit price already
   carries a margin (BATCH4 "Apply 2× margin"). Once #4 exists and the real number is known, the
   margin can absorb it — that may be **cheaper than engineering it to zero**. Do not change any
   credit value without the owner's explicit decision (money zone).
6. **Verify case B per provider.** Confirm in each provider's billing docs whether a failed /
   rejected job is billed (BytePlus token accounting, Vertex, fal, ElevenLabs). Record the answer
   in `docs/` — right now it is an assumption.

## Hidden problems

- **P19.1 — P18's double-charge doubles this too.** A retried `POST /gen` creates a second job →
  the **provider is called twice** → the owner pays twice, while the user is only charged once
  (or twice, then refunded once). Fixing P18's idempotency fixes both sides.
- **P19.2 — Refund-farming.** If output moderation refunds the user, a user could generate
  policy-violating content repeatedly at **zero cost to themselves and full cost to the owner**.
  Add a per-user counter of moderation-blocked generations and a threshold (throttle / stop
  refunding after N blocks / suspend). **Owner decision required** — do not change refund
  behaviour without it.
- **P19.3 — `reconcileStuckGenerations` refunds stuck jobs** (`:1336`, `:1366`, `:1387`). If a
  job is stuck but the provider **did** deliver, that is a refund **and** a paid asset. The
  resume path (#1) must run **before** the reconciler gives up.

- **P19.4 — Owner's follow-up question: "the client dies but the API keeps generating — what
  then?" ANSWER (verified — the code handles it correctly, do NOT 'fix' it):**
  - A client disconnect (browser closed, plugin crashed, network dropped) **refunds nothing**.
    `pollJob` simply gives up client-side ("Lost track of this job — it may still finish") and
    the server finishes the job → the asset lands in **My Library**. User paid, user got the
    asset. ✅ Correct.
  - If the job runs longer than **20 minutes** (`stuckTimeoutMs`, `:1320–1323`), the reconciler
    marks it `failed` and **refunds**. If the provider then delivers at minute 21:
    `status: "done"` is written with `updateMany({ where: { id, status: "running" } })`
    (`:1302`) → **count = 0 → it is NOT flipped to done**. The fal webhook likewise ignores an
    already-terminal job (`fal-webhook.ts:156`). ✅ **A user can never get both the refund and the
    asset.** This guard is deliberate (audit 2026-06-26) — **money zone, do not touch.**
  - **The cost lands on the OWNER**: the provider was paid, the asset is discarded, the user was
    refunded. This is exactly case **C**.

- **P19.5 — 🔴 The 20-minute cutoff GUESSES instead of ASKING the provider. — DIRECTOR'S DECISION
  (binding): DO NOT simply raise the timeout.**

  The owner asked whether raising the 20-minute limit would fix this. **It would not — it would
  make it worse.** A job overruns for one of two reasons:
  1. the provider really is slow (long 4K video, provider queue) → a longer timeout helps;
  2. **nothing is driving the job any more** — the Cloud Run instance was recycled/restarted
     (`--max-instances 2`, see P8/P18), so the DB says `running` while **no process is working
     on it**. A longer timeout does not help here at all: it only makes the user wait 60 minutes
     instead of 20 for a refund they were always going to get. Given this deployment, case 2 is
     the likely-common one.

  **Decision — the timeout becomes a TRIGGER TO ASK, not a trigger to refund:**

  ```
  20 min elapsed (keep this number)
        └─► ask the provider about this job (the id is already stored: `__providerJob`, :166/:213)
              ├─ still running → EXTEND, do not refund   (a slow video is not a failure)
              ├─ done          → FETCH the result and COMPLETE the job
              │                   (the provider is already paid — deliver what was paid for)
              └─ failed/unknown → fail + refund  (only now)
  ```

  Plus a **hard ceiling** (e.g. 2 h) so a provider that never answers cannot leave a job hanging
  for ever, and **per-model expected durations** so the check interval is sensible (a 6 s
  Seedance clip and a Topaz upscale of a long video are not the same job).

  Video jobs are already resumable (`isResumableRunningGeneration`, `:311`) — this reuses that
  mechanism rather than inventing one. Keep the atomic guards (`updateMany … where status in
  (queued,running)`) exactly as they are; **only add the provider check before the refund
  decision.** Money math unchanged — money zone.

- **P19.6 — Orphaned files.** When a generation is refunded but the provider had already
  delivered, the asset may already be in GCS — never shown, never deleted, **still billed as
  storage**. Add a cleanup (or, better, deliver it per P19.5). Also count these in the
  "paid but refunded" metric (#4).

---

# P20 — You must WAIT for one generation to finish before starting the next (web + plugin)

## Owner's report

After pressing Generate, you cannot start another generation until the first one finishes.
This is very bad — a user should be able to fire several generations and let them run.

## Director's code analysis — the limit is CLIENT-SIDE and artificial

- `platform/index.html:18767` → **`generate() { … if (this.state.generating) return; … }`** — a
  single boolean lock on the whole composer.
- `pollJob(jobId)` (`:18806`) starts with **`clearTimeout(this._pt)`** — there is **one** poll
  timer, so the client can only track **one** job at a time. Starting a second job would silently
  orphan the first.
- The fake progress animation (`syncGenAnim`, `:18021`) is likewise **global**
  (`state.generating`, `state.genProgress`) — one bar for the whole app.
- **The server does not impose this.** `POST /api/studio/gen` (`apps/api/src/routes/studio-gen.ts:1006`)
  has **no per-user concurrency check** — no "you already have a running job" guard anywhere.
  Jobs are created `queued` and picked up by the processor.
  → **The API can already run several generations per user in parallel. The UI is the only thing
  stopping it.**

## What to build

1. **Replace the boolean with a list.** `state.generating: bool` → `state.activeJobs: [{ id,
   sessionId, mode, model, cost, startedAt, progress }]`. `generate()` no longer returns early;
   it appends a job.
2. **Poll all active jobs.** Replace the single `this._pt` timer with one poller that ticks over
   every active job (or a timer per job id). Each job's `done`/`failed` handling stays exactly as
   it is now — just per job, not per app.
3. **A pending card per job, in the grid.** The result grid already has a pending tile style
   (`.ffm-res.pend` / `.ffa-res.pend` — breathing border). Show one placeholder card per running
   job **at the top of the grid**, each with its own progress and a cancel/dismiss action. The
   user sees their queue.
4. **Per-job progress, not a global bar.** `syncGenAnim` becomes per-job (and per P10, it must
   not `setState` at 380 ms globally — update the specific card's node).
5. **A sane concurrency cap** — e.g. **3–5 concurrent jobs per user**, enforced **on the server**
   (the client cap is a courtesy, not a guarantee). Over the cap → the job is **queued**, not
   rejected; show it as "Queued" in the grid.
6. **The composer stays usable while jobs run.** Prompt, references and model must remain
   editable — firing job #2 must not disturb job #1's state (this is another reason the
   reference pool of P13 matters: today the composer state IS the job state).

## Hidden problems

- **P20.1 — 🔴 Credits: five parallel jobs = five charges, and the balance check must be
  server-side.** The client checks `q.price > this.state.credits` (`:18778`) against a **local**
  balance that will be stale once several jobs are in flight. The server already consumes
  atomically — make sure it **rejects** (before consuming) when the balance is insufficient, and
  that the client shows "not enough credits" rather than firing a job that dies.
  **Money zone: do not change any credit value or the consume/refund logic — only the
  concurrency/UI around it.**
- **P20.2 — Provider rate limits and cost blow-up.** With no cap, an impatient user can queue 20
  videos in ten seconds — provider rate limits, `spend-guard.ts` caps, and the owner's bill all
  hit at once. The per-user cap (#5) is not optional.
- **P20.3 — Server-side processing concurrency.** Cloud Run runs with `--cpu 1 --max-instances 2`
  (P6/P7). Many parallel `processGeneration` calls on one instance will contend — most of the
  time they are just awaiting the provider (fine), but any local ffmpeg step is behind the
  **`FFMPEG_MAX_CONCURRENCY = 1`** semaphore. Verify the queue drains sensibly before advertising
  parallel generation.
- **P20.4 — Interaction with P18's idempotency.** Each job needs its **own** idempotency key —
  reusing one key across parallel jobs would collapse them into a single generation.
- **P20.5 — 🔴 The plugin has the same lock.** `plugins/after-effects-cep/` mirrors this
  single-flight design. Fix both, or AE users still wait (global plugin rule).
- **P20.6 — Session semantics.** Several jobs finishing into the same session must not fight over
  `activeGenId` / the visible result. Newest-first ordering, and the "active" result should not
  jump under the user's cursor while they are looking at another card.

---

# P21 — Account → Credits: add a TOTAL SPENT counter, and let the user open the generation from each row

## Owner's request

In **Account → Subscription & credits**:
1. Add a function that **totals all the credits the user has spent**.
2. From the **Credit activity** list, let the user **open/see the generation** that each row refers to.

## Director's code analysis — 🔴 the "Credit activity" table is NOT the credit ledger

`platform/index.html:19879`:

```js
const creditHistoryView = this.state.gens.filter(g => g.cost > 0).slice(0, 12).map(g => ({ … amt: '−' + g.cost … }));
```

It is built from **`state.gens`** — the generations currently loaded in the browser — and merely
*rendered* to look like a ledger. The real ledger exists in the DB (`CreditLedger`:
`schema.prisma:547` — `userId`, `generationId`, `delta`, `reason` (`consume` | `refund`),
`balanceAfter`, `createdAt`) and is **not used by this screen at all**. Consequences:

- **🔴 REFUNDS ARE INVISIBLE.** A failed generation is refunded (`refundAiCredits`), but this
  table still shows the **charge** and never the refund. **The user sees money taken and never
  given back** — they will conclude they were robbed. This alone is worth fixing regardless of
  the owner's request.
- **Top-ups / credit purchases are invisible** — only generations appear.
- Only the **last 12 loaded** generations are listed; it is not history, it is a fragment.
- **Therefore a "total spent" computed from this data would be WRONG.** The requested feature
  cannot be built on this source.
- `downloadHistoryView = []` and `hasDownloads = false` are **hard-coded** (`:19881–19882`) —
  that is why the panel says "Download history is coming soon" while the count is live.

## What to build

1. **A real ledger endpoint.** `GET /api/studio/credits/ledger?cursor=…` returning paginated
   `CreditLedger` rows joined with the generation (id, mode, model label, prompt excerpt, thumb),
   plus the aggregates:
   - **`totalSpent`** = `SUM(-delta) WHERE reason = 'consume'`
   - **`totalRefunded`** = `SUM(delta) WHERE reason = 'refund'`
   - **`netSpent`** = `totalSpent − totalRefunded`  ← this is the honest "credits spent" number
   - **`totalPurchased`** (top-ups) — from the billing side
   **Read-only aggregation. Do NOT touch consume/refund logic or any credit value (money zone).**
2. **Show the total in the Credits card**: `Spent: ✦ 1,240 · Refunded: ✦ 96 · Net: ✦ 1,144`.
   Showing the refunded amount is the point — it is what proves to the user that failures cost
   them nothing.
3. **Render the ledger, not the generations list.** Each row: type icon · label · date ·
   **signed amount** (red for `consume`, **green for `refund`**) · balance after.
4. **Row → open the generation.** `CreditLedger.generationId` already exists and is indexed
   (`schema.prisma:557`). Clicking a row opens that generation in the lightbox (P11) — or shows
   "this generation was deleted / refunded" when it has no asset. Add a thumbnail to each row.
5. **Filters:** All · Spent · Refunded · Purchased. And a date range if it is cheap.
6. **Pagination.** The list must not be capped at 12 — the ledger will grow.

## Hidden problems

- **P21.1 — Deleted generations.** A user can delete a generation; the ledger row survives (no FK
  — see the comment at `schema.prisma:683`). The row must degrade gracefully ("generation
  deleted"), not 404 or crash.
- **P21.2 — This exposes P18/P19 to the user.** Once refunds and duplicate charges are visible,
  any double-charge (P18) becomes **customer-visible**. Ship the P18 idempotency fix and the P18.1
  ledger audit **before or with** this, not after.
- **P21.3 — The plugin shows credits too.** The AE plugin has a balance/credits view; the same
  totals should be available there (global plugin rule). At minimum it must not contradict the web.
- **P21.4 — Downloads history is a stub.** `hasDownloads = false` is hard-coded while the monthly
  count is real — the panel promises something that does not exist. The data **does** exist
  (`DownloadEvent`, used by `realTemplateCounts` / earnings). Either implement it in the same pass
  or remove the "coming soon" panel; a half-built panel in the paying-customer screen looks worse
  than no panel.
- **P21.5 — A −344 credit video charge is visible in the owner's own screenshot.** Nothing to fix
  here, but the totals will make large charges obvious to users — make sure each row names the
  **model and the duration** it was billed for (video is billed per second), or the support
  questions start.

---

# P22 — Generate is rejected AFTER the click when credits are short — it must be disabled BEFORE

## Owner's request

If the user does not have enough credits, the generation is rejected **after** they press
Generate. That must not happen: when credits are insufficient the **Generate button must be
disabled (greyed out, unclickable)**.

## Director's code analysis

`platform/index.html:18767–18779` — the current order is exactly what the owner describes:

```js
if (this.state.generating) return;
…
this.setState({ generating: true });                 // ① UI already says "generating"
const q = await FFAPI.quote(model.id, tool.mode, params);   // ② ask the server for the price
if (q.price > this.state.credits) {                  // ③ …only now check the balance
  this.setState({ generating: false, showCredits: true });  // ④ cancel + throw a modal at the user
  return;
}
```

The user clicks → the app *starts* → then aborts and shows a top-up modal. Meanwhile the composer
**already displays `COST ✦ 48`** before the click — so the price is known **in advance**. The
check is simply in the wrong place.

## What to build

1. **Fetch the signed quote reactively, not at click time.** Whenever the model / params /
   references change, debounce (~250 ms) and refresh the quote (`/gen/cost-quote`). Store
   `{ price, signature, pricedParams }` in state. This is what already feeds the `COST ✦ N` chip —
   make it authoritative.
2. **Derive the button state from it:**
   - `price <= balance` → **Generate** enabled.
   - `price > balance` → **Generate disabled** (greyed, `cursor: not-allowed`, `aria-disabled`),
     with a clear label next to it: **“Not enough credits · ✦ 48 needed, ✦ 12 left”** and a
     **Top up** button right there. No modal, no wasted click.
   - quote still loading → button shows a spinner / is temporarily disabled — **never** enabled
     with an unknown price.
3. **Same treatment for the other pre-flight gates** that today only appear as a toast *after* the
   click (`:18769–18771`): "this model requires a start frame", "this model requires a reference
   image". The button must be disabled with the reason shown, not fire and fail.
4. **`generate()` then just sends the already-signed quote** — no quote round-trip at click time.
   The generation starts instantly (this also removes one cross-Atlantic round trip, see P8).

## Hidden problems

- **P22.1 — 🔴 The SERVER must still enforce the balance. Do not remove any server-side check.**
  Disabling a button is a UX nicety, not a security control. The server's atomic
  `consumeAiCredits` (money zone) stays exactly as it is. If a client ever sends a request it
  cannot afford, the server must still refuse. **Never compute or trust a price on the client** —
  the client only *displays* the server-signed quote.
- **P22.2 — The balance goes stale with parallel jobs (P20).** Once several generations can run at
  once (P20), `state.credits` is out of date the moment job #1 is in flight. The button must
  compare against **balance − (credits already committed to in-flight jobs)**, or the user will
  fire job #3 and have it rejected by the server anyway — reintroducing exactly the bug we are
  fixing. **Do P20 and P22 together, or P22's promise breaks the moment P20 ships.**
- **P22.3 — Video price depends on duration** ("video is billed per second of output"), so the
  quote must refresh when the duration/resolution chips change — which is precisely the settings
  popover from P16. Wire the refresh to every setting that affects price.
- **P22.4 — Plan gates are not credit gates.** A Pro-only model on a Free plan is a *different*
  refusal ("upgrade to Pro"), not "top up credits". Show the correct one; today both end up as a
  post-click surprise.
- **P22.5 — The plugin has the same post-click rejection.** Same fix, same rules (global plugin
  rule).

---

# P23 — MONEY & ABUSE AUDIT: how a user can steal credits, assets or Pro access (and what is already safe)

## Owner's request

"Find every way a user could cheat me: get credits without paying, force a fake error to get a
refund, top up with fake credits, break in without paying, steal credits or AI, download Pro
templates on a Free account — and find the ones I haven't thought of."

## ✅ ALREADY SAFE — verified in code. **Do NOT 'improve' these; they are money-zone.**

| Attack | Why it fails |
|---|---|
| **Forge the price** (send `price: 1` for a 344-credit video) | The quote is a **signed JWT** (`lib/gen-quote.ts:67`) over `{modelId, mode, price, paramsHash}`, 15-min TTL; `POST /gen` recomputes `genParamsHash` and calls `verifyCostQuote` **before** consuming (`studio-gen.ts:1199–1204`) → `BAD_QUOTE`. |
| **Delete the generation to get a refund** | `DELETE /gen/:jobId` (`:1578`) deletes assets — it **never refunds**. |
| **Double refund** | `refundAiCredits` claims atomically (`refunded=false→true`); `fail()` / reconcile use guarded `updateMany` (`gen-processor.ts:1000`, `:1332`). |
| **Refund *and* keep the asset** | `status:"done"` is written with `where: { status: "running" }` (`:1302`) — after a refund the job is `failed`, so `count = 0` and the asset is never shown. The fal webhook ignores terminal jobs (`fal-webhook.ts:156`). |
| **Free user downloads a Pro template** | `guardDownloadable()` (`plugin.ts:318–362`) — server-side, **before any bytes**: published check → `isPro && !isPaidPlan(profile.plan)` → **402 PRO_REQUIRED** → then an **atomic** `consumeDownload()` limit (Free = 15/mo). Both `/pack` and `/mogrt/:slug` go through it. Packs are served only as **5-minute signed URLs**, never public CDN links. |
| **Fake a top-up / replay the payment webhook** | Lemon Squeezy webhook: **HMAC signature verified** (`lemonsqueezy.ts:344–346`) + **claim-first idempotency** + unique `sourceKey`. |
| **Buy credits, then charge back** | `handleOrderRefunded` (`:127–139`): negative `RevenueEvent`, **claws back unspent top-up credits**, downgrades the subscription to FREE. |
| **Blow up the owner's provider bill** | Per-user **daily gen cap** (`withinGenDailyCap`), **global spend ceiling** (`checkGlobalSpendCeiling`), **kill switch** (`isGenKillSwitchOn`) — all checked before credits are consumed. |
| **Brute-force login / spam register** | `authLimiter` / `forgotLimiter` / `twofaLimiter` (`auth.ts:71–87`) + **Turnstile** on register (`:118`). |
| **Upload a malicious pack** | Malware scan is **fail-closed** — an unscanned/pending pack is served to **nobody, not even an admin** (`plugin.ts:318–325`). |

**Conclusion: the obvious attacks are closed.** The real holes are elsewhere.

## 🔴 GAP 1 — THE WATERMARK DOES NOT EXIST. Free users get clean exports today.

- The Free plan **advertises** "Watermarked export" (`lib/landing-config.ts:223`, `:224`) and the
  FAQ says Pro unlocks "**watermark-free** 4K export" (`:192`).
- **There is no watermark code in the API at all.** A repo-wide grep for `watermark` in
  `apps/api/src` returns **nothing** outside that marketing copy.
- → A Free user generates and downloads a **clean, unwatermarked** asset. The single most
  important thing separating Free from Pro **is not implemented**.
- This is simultaneously: **a revenue hole** (why pay for Pro?) and **false advertising** (you are
  charging for the removal of something you never add).

**Fix:** implement the export watermark server-side (never in the client — a client-side
watermark is trivially bypassed), applied on download/export for FREE plans, using the same
ffmpeg pipeline as P4. Then Free/Pro finally means something. **Decide with the owner:** does the
watermark apply to AI generations, template exports, or both? (P4 covers stock previews — this is
a different surface: the user's *own* paid-for output.)

## 🔴 GAP 2 — Free-credit farming with disposable accounts

- Every account gets **50 credits/month** (`landing-config.ts:223`), reset by
  `resetMonthIfNeeded` (`plugin-profile.ts:160`).
- Register is protected by **Turnstile** and creates the user with `emailVerified: false`
  (`auth.ts:177`).
- ⚠️ **VERIFY FIRST:** does `POST /gen` (or `requireAuth`) refuse an **unverified** account?
  `emailVerified` is checked at `auth.ts:514` but **not** in `middleware/auth.ts` and **not** in
  `studio-gen.ts`. **If an unverified account can generate, the farm is: script → 100 throwaway
  emails → 5 000 free credits.** Confirm and report before changing anything.
- Even with verification, 10 Gmail aliases = 500 credits/month.

**Fixes (choose with the owner):** require `emailVerified` before **any** credit spend ·
block disposable-email domains · rate-limit registrations per IP/ASN/device fingerprint ·
lower the free monthly grant · require a card (via LS) for anything above a small trial ·
alert on N accounts from one IP.

## 🔴 GAP 3 — Session security: a 30-day token in `localStorage`, with no way to revoke it

- `createToken` (`middleware/auth.ts:29`) → `jwt.sign(..., { expiresIn: "30d" })`.
- The web app stores it in **`localStorage`** (`ff-api.js:15`, `getToken`).
- The CSP **must keep `'unsafe-inline'`** (documented in `prepare-cf-pages.mjs`) because the UI
  relies on 168+ inline handlers → **an XSS anywhere = the attacker reads `localStorage` and owns
  the account (and its credits) for 30 days.**
- **There is no refresh token, no revocation list, no "sign out of all devices"**, and (verify)
  probably no invalidation on password change. A leaked token cannot be killed except by rotating
  `JWT_SECRET`, which logs out **everyone**.
- The **plugin** stores the token in **plaintext** on disk (`prefs.json` under the CEP extension
  folder) — anyone with file access to the machine has the account.

**Fixes:** shorter access token + refresh token · a server-side session/`tokenVersion` column so
password change / "log out everywhere" invalidates existing tokens · consider `httpOnly` cookies
for the web (removes the XSS-steals-the-token class entirely) · at minimum, add revocation.

## Other gaps (ordered by likelihood of costing money)

- **P23.1 — Refund-farming through moderation** (see P19.2). Output moderation refunds the user
  while the provider has **already been paid** → a user can burn the owner's money at zero cost to
  themselves. Cap moderation-blocked generations per user; after N, stop refunding / suspend.
- **P23.2 — The double-charge (P18) is the mirror image.** Not the user cheating the owner — the
  owner cheating the user by accident. It becomes customer-visible the moment P21 ships.
- **P23.3 — The global spend ceiling is a DoS vector.** One user (or a farm from GAP 2) can
  exhaust `checkGlobalSpendCeiling` and every other user gets `503 SPEND_CEILING_REACHED`. Add a
  **per-user** share of the ceiling so one account cannot deny service to all.
- **P23.4 — Pro-only MODELS: verify the server-side gate.** `POST /gen` checks
  `isModelEnabled(model)` (`studio-gen.ts:1026`) but **does it check the user's plan?** Templates
  have a Pro gate; models may not. If a Free user can call a Pro-tier model by sending its
  `modelId` directly (the quote endpoint will happily sign it), that is a paid feature given away.
  **Verify and, if missing, gate it exactly like `guardDownloadable` does.**
- **P23.5 — Account sharing.** One Pro subscription used by a whole studio. `device.html` +
  `device-confirm` exist — verify whether there is an actual **device/session limit** per plan, or
  just a confirmation screen. Without a limit, Pro is a group purchase.
- **P23.6 — Storage abuse.** `ref-upload` accepts up to **150 MB** bodies
  (`index.ts:169`). `getUserUsedBytes` exists (a quota is computed) — **verify it is actually
  enforced for FREE users**, or free accounts become free cloud storage.
- **P23.7 — Chargeback after spending.** The clawback only recovers **unspent** credits. A
  fraudster buys 5 000 credits, spends them all, then disputes the charge → the owner eats the
  full provider cost. Lemon Squeezy is the Merchant of Record (it absorbs much of the card fraud
  risk), but the **provider spend is already gone**. Mitigate: hold new-account top-ups behind a
  small velocity limit (e.g. a first-purchase spend cap for 24 h), and suspend the account on a
  dispute event.
- **P23.8 — Contributor payout fraud.** A contributor can inflate their own downloads (self-
  downloads / bot accounts) to farm payouts. `recordTemplateDownloadEvent` dedups per
  `(user, template, kind)` — verify **self-downloads are excluded** and add a per-IP/account
  anomaly check before any payout runs. (Payout is not live yet — fix it before it is.)
- **P23.9 — Preview quality as a paywall bypass.** Once stock ships (P4), if the watermarked
  preview is high-resolution, users will simply screen-record it. Keep previews deliberately
  lower-resolution — the resolution, not the logo, is the real protection.

## Rules for whoever implements this

- **Every fix here is READ-ONLY with respect to credit math.** Adding gates, caps, verification,
  revocation and watermarking is allowed. Changing any credit value, `computeGenCost`,
  `imageUnitCost`, the quote HMAC, or the consume/refund logic is **NOT**. If a fix seems to need
  it → **STOP and flag.**
- **Start by VERIFYING the three items marked "verify"** (unverified-email generation · Pro-model
  gate · Free storage quota) and **report the findings before writing any code.** Two of them may
  already be safe; one of them is probably not.

---

# P24 — Model prices: the owner does not trust the numbers. Stop hunting prices — MEASURE them.

## Owner's request

"I can't find the real prices of the AI models, or I'm getting them wrong. I need a director's
conclusion on how to enter accurate prices — I'm not going to go hunting for each model's price,
and I don't trust the ones that are in there now."

## Director's finding: the owner is right to distrust them — and the machinery to fix it already exists

**What is already built (do not rebuild — USE it):**

| Piece | File | What it does |
|---|---|---|
| Per-model provider cost in USD | `apps/api/src/lib/provider-cost.ts` | `IMAGE_USD_PER_UNIT`, video per-second tables, `estimateProviderUsd()` |
| Spend record per generation | `lib/ledger.ts` → `ProviderSpend.estimatedCostUsd` | what we *think* each generation cost |
| **Real invoice entry** | `ProviderInvoice` (`schema.prisma:619`) — `provider` · `periodMonth` · `actualUsd` | the **ground truth**, entered by an admin |
| Monthly reconciliation + margin alert | `lib/pricing-reconcile.ts` | revenue vs estimate vs **real invoice** → margin drift → email/webhook alert |
| Per-model margin | `lib/model-margin.ts` | credits earned ÷ USD spent, per model |
| Retail pricing engine | `lib/model-pricing.ts` | `creditUsdValue` (anchor $0.019) + `marginTarget` (2.0) + "Apply target margin" |
| Missing-price detector | `provider-cost.ts:144` `findEnabledModelsWithoutCost()` | flags enabled models with no cost entry |

**Why the distrust is justified — the code says so itself:**

- `provider-cost.ts:8–10`: *"Values are ESTIMATES — Stage 3 (the pricing engine + monthly billing
  reconciliation) will pin them down against the real invoice."* That reconciliation has **never
  been run against a real invoice.**
- `IMAGE_USD_PER_UNIT` (`:31`) mixes **confirmed** and **guessed** numbers in the same table, with
  the difference recorded only in a **code comment**:
  `1010: { "1K": 0.04 ✅, "2K": 0.06 taxminiy, "4K": 0.12 taxminiy }`.
  **Every 2K/4K tier is a guess.** Those are exactly the expensive ones.
- `DEFAULT_PROVIDER_USD = 0.5` is a deliberate over-estimate for unknown models.
- This has **already cost money**: the project's own status notes record that **Seedance 4K was
  being sold at a loss** until the margin was re-applied.

## 🎯 Director's conclusion — the method (do this, do not go price-hunting)

**Principle: a price you looked up is a rumour. A price the provider invoiced you is a fact.**

**Step 1 — Make the confidence EXPLICIT (stop hiding it in comments).**
Turn every cost entry into a structured record:
```ts
{ usd: 0.06, unit: "per image @2K", confidence: "official" | "measured" | "estimated",
  sourceUrl: "https://…", checkedAt: "2026-07-12" }
```
Rules: `official` = the provider's own pricing page (never a blog, never an aggregator, never an
LLM's memory) · `measured` = derived from a real invoice · `estimated` = a guess, and it must be
**conservative (over-, never under-estimate)**.

**Step 2 — CALIBRATE with a controlled run (this is the part that replaces price-hunting).**
For each `enabled` model × each tier the product actually sells (1K/2K/4K, each duration):
1. run **N identical generations** (N = 3–5) in a dedicated calibration session;
2. record everything the provider tells you at call time (BytePlus **returns token counts** — the
   BATCH5 test already proved the token→USD formula matches);
3. at the end of the billing period, enter the **real invoice** into `ProviderInvoice`;
4. `pricing-reconcile.ts` then divides the real invoice by the recorded usage → **the true USD per
   unit, per model.** Write it back as `confidence: "measured"`.
This is a **one-evening job for the whole catalog**, and it is the only number that is not a guess.

**Step 3 — Guardrails so an unknown price can never lose money.**
- **Never enable a model whose cost is `estimated` at a margin below target.** Extend the existing
  startup check (`findEnabledModelsWithoutCost`) to also fail/flag on
  `confidence === "estimated" && margin < marginTarget`.
- Keep the conservative over-estimate as the default — an over-estimate makes you *charge more*
  and trips the spend ceiling earlier; an under-estimate makes you *sell at a loss*. Asymmetric
  risk → always round **up** while unsure.
- Run `runMonthlyReconciliation()` on a schedule (it exists) and **actually read the alert.**

**Step 4 — Make it visible in Admin.** A Pricing table with one row per enabled model:
`credits charged · est. USD · **measured USD** · margin (×) · confidence · source · last verified`.
Colour: **red = estimated**, **amber = margin < target**, green = measured & healthy.
The owner should be able to answer "am I losing money on any model?" **in five seconds**, without
opening a file.

**Step 5 — Re-verify on a cadence.** Provider prices change. `checkedAt` older than 90 days →
the row goes amber. The reconciliation already detects drift *after* it costs money; the
`checkedAt` staleness flag catches it *before*.

## 🤖 AUTOMATION — the owner should not be typing invoice numbers at all (owner asked: "can this be automatic?")

Answer: **yes, for the two providers that matter.** Three tiers:

**Tier 1 — Google / Vertex → FULLY AUTOMATIC.**
Enable **Cloud Billing export to BigQuery** (free, standard GCP feature): GCP writes daily,
**per-SKU** cost rows. A nightly job queries it and writes the real USD into `ProviderInvoice` /
back into the per-model `measured` cost. **Zero human input.** This is the single biggest cost
line (Vertex images, Veo/Omni video, Chirp TTS) — automate it first.

**Tier 2 — BytePlus (Seedance / Seedream) → EXACT, no invoice needed.**
BytePlus **returns the token count in every response** — the BATCH5 live test already captured it
(`40,594 tokens` for a 480p/4s clip) and confirmed the formula matches. The token→USD rate is
known ($4.30 / 1M, the purchased pack). So:
`tokens × rate = the exact USD for THAT generation`
→ write it into `ProviderSpend.estimatedCostUsd` as **`confidence: "measured"`** at call time.
No monthly reconciliation required for this provider at all. **Make sure the adapter actually
records the returned token count** — if it is being discarded, that is a one-line fix with a large
payoff.

**Tier 3 — fal / ElevenLabs → check for a usage API; else 1 number per month.**
Verify whether each exposes a usage/billing endpoint. If not, the fallback is the owner entering
**one number per provider per month** into `ProviderInvoice` (the table and the admin path already
exist). Two minutes, once a month — acceptable.

**Result:** the owner's recurring task drops from *"look up every model's price"* to
**nothing** for Google and BytePlus, and *"paste one number"* for the small providers. The Admin
pricing table (Step 4) then shows measured, invoice-backed margins — not guesses.

## Hidden problems

- **P24.0 — Verify the BytePlus token count is being stored.** If `lib/ai/byteplus.ts` receives the
  usage/token field but does not persist it into `ProviderSpend`, Tier 2 above is not actually
  measuring anything. **Check this first — it is the cheapest accurate number in the whole system.**
- **P24.1 — 🔴 `ProviderSpend.estimatedCostUsd` is the input to the SPEND CEILING.** If the
  estimates are wrong, the global kill-switch fires at the wrong threshold — either too late
  (over-spend) or too early (`503` for everyone, see P23.3). The ceiling is only as trustworthy as
  these numbers.
- **P24.2 — Video is billed per SECOND of output, images per unit — and Seedance/BytePlus bills in
  TOKENS.** A single "USD per model" number cannot express all three. The unit must be part of the
  record (Step 1), and the calibration must cover **each duration/resolution the UI actually
  offers** — not just the default.
- **P24.3 — Reference images cost extra on some providers** (the code notes Seedream charges
  ~$0.003 per input reference beyond the first, and *deliberately excludes it* from the table).
  With P13/P14 making it easy to attach 9 references, that "small" number becomes real. Fold input
  cost into the calibration.
- **P24.4 — The retail anchor ($0.019/credit) is a separate decision from provider cost.** Do not
  let a provider price change silently move the retail price. Provider cost → margin → *proposal*;
  the owner presses **Apply**. That is how the existing "Apply target margin" button already works
  — keep it that way. **MONEY ZONE: nothing here may change a credit value automatically.**
- **P24.5 — Do not ask an LLM (or this document) for current provider prices.** They change, and a
  confidently wrong price is exactly how a model ends up being sold at a loss. Only two sources
  count: **the provider's own pricing page** (with a URL and a date) and **the invoice**.

---

# P25 — Admin → "Apply target margin": the owner cannot set a margin below 2× (e.g. 1.5×)

## Owner's report

The **Apply target margin** control will not let him enter anything below **2** — he wants to set
an arbitrary value, e.g. **1.5×**.

## Director's code analysis

**The server is fine.** `apps/api/src/routes/admin.ts:542`, `:572` →
`marginTarget: z.number().gt(0).max(1000)` — any positive number is accepted. **1.5 would work.**

**The client is the problem.** `packages/assetflow-studio/js/admin-business.js:44–48`:

```js
async function applyMarginAll(){
  const cur = PRICING_DATA ? PRICING_DATA.marginTarget : 2;
  const raw = prompt('Target margin (×) …', String(cur >= 2 ? cur : 2));   // ← forces the prefill to ≥ 2
  const mt = Number(raw);
  if(!(mt>0)){ toast('Error','Enter a positive margin (e.g. 2)','danger'); return; }
```

1. **`cur >= 2 ? cur : 2`** — the value shown is **clamped up to 2** even when the stored margin is
   lower (the comment admits it: *"default 2.0×, even if the DB is still 1.8"*). It reads like a
   minimum. It is not one — it is just a prefill — but the owner cannot tell, and that is a bug in
   itself.
2. **It is a raw browser `prompt()`** — no number input, no step, no decimal hint, no preview.
3. **`Number("1,5")` → `NaN`** → *"Enter a positive margin"*. On a keyboard/locale where the
   decimal separator is a **comma**, entering `1,5` is rejected with a message that explains
   nothing. **This is very likely what the owner actually hit.**

## What to build

1. **Replace the `prompt()` with a real modal** in the Admin pricing panel:
   - a proper number input (`step="0.1"`, sensible bounds), prefilled with the **actual current
     margin** — never clamped up;
   - accept both `1.5` and `1,5` (normalize the comma before `Number()`);
   - inline validation with a useful message.
2. **Show a live preview before applying.** The modal lists what the new price of each enabled
   model would become: `Seedance 2.0 · 48 → 36 credits`, `Nano Banana Lite · 2 → 2` … plus the
   count of pinned models that will be skipped. The owner presses **Apply** on a table, not on
   faith. Prices can go **down** as well as up (the current prompt text says so — nobody reads it).
3. **Warn, do not block, below 1.0×.** A margin below `1.0` means **selling below provider cost**.
   Allow it (the owner may want a loss-leader), but require an explicit confirmation:
   *"At 0.8× you will LOSE money on every generation. Continue?"*
4. **Show the resulting margin per model afterwards** (ties into P24's Admin pricing table):
   red if the model ends up under water.

## Hidden problems

- **P25.1 — 🔴 The margin is only as good as the provider cost (P24).** Setting 1.5× on a provider
  cost that is a **guess** does not give a 1.5× margin — it gives an unknown one. **P24 (measure
  the real cost) must land before the owner tunes the margin down**, or he will lower prices onto
  numbers that were already wrong. *A lower margin on a wrong cost is exactly how Seedance 4K ended
  up being sold at a loss.*
- **P25.2 — Money zone.** `applyMarginAll` **writes real credit prices for every enabled model**.
  The formula (`ceil(provider cost × margin ÷ credit value)`) and the pinned-model skip logic must
  not change — this prompt only fixes the **input UI and the preview**. Do not touch
  `computeGenCost`, `imageUnitCost`, the quote HMAC, or the consume/refund path. If a change seems
  to require it → **STOP and flag.**
- **P25.3 — Pinned models are silently skipped.** The toast mentions them after the fact. The
  preview (#2) must show them **before**, with the reason ("product-priced — not derived from
  margin"), or the owner will think the margin was applied everywhere when it was not.
- **P25.4 — There is no undo.** Applying a margin rewrites every enabled model's price at once. Add
  an audit entry (the audit log already exists) and, ideally, a "revert to previous prices" action —
  a mistyped margin currently has no way back except retyping the old one.

---

# P26 — 🔴 UNIT ECONOMICS: Studio and the credit packs SELL CREDITS BELOW COST. Full chain audit.

## Owner's question

"Check the whole chain: **Contributor → Admin → user subscription money**. These are all guessed
prices. Pro is $19 for 1 000 credits — what is one credit actually worth? How much of that $19
goes to the contributor, how much to the AI providers? **Am I running at a loss?** And if a
contributor signs up on a second account and downloads their own templates non-stop — what
happens? Find the problems I haven't thought of."

## The numbers (all read from the code — not guessed)

- **Credit anchor:** `DEFAULT_CREDIT_USD = 0.019` (`lib/model-pricing.ts:23`) — literally derived
  as *"PRO $19 / 1 000 credits"*.
- **Margin target:** `DEFAULT_MARGIN_TARGET = 2.0` (`:26`).
- **Model price formula:** `credits = ceil(providerUSD × margin ÷ creditUsdValue)`.
  → **by construction, one credit is meant to cost the owner `$0.019 / 2 = $0.0095` in provider spend.**
- **Plans** (`lib/landing-config.ts:222–232`): Free $0/50 · **Pro $19/1 000** · **Studio $59/6 000**.
- **Credit packs** (`platform/index.html:17851–17855`): **500 = $5 · 1 500 = $12 · 5 000 = $35**.
- **Contributor payout** (`lib/earnings.ts`): `PAYOUT_MODE = "pool"` (default),
  `CONTRIBUTOR_POOL_SHARE = 0.50` → **pool = (net subscription revenue − AI provider spend) × 50 %**,
  split by each contributor's share of legitimate downloads.

## 🔴 Finding 1 — Every channel except Pro sells credits at or below cost

Revenue per credit vs the $0.0095 it costs to serve:

| Channel | Price | $ / credit | **Effective margin** | Verdict |
|---|---|---|---|---|
| **Pro** | $19 / 1 000 | **$0.0190** | **2.00×** | ✅ as designed |
| **Studio** | $59 / 6 000 | **$0.0098** | **1.03×** | ⚠️ **zero profit** |
| Pack 500 | $5 | **$0.0100** | 1.05× | ⚠️ ~zero profit |
| **Pack 1 500** | $12 | **$0.0080** | **0.84×** | 🔴 **LOSS** |
| **Pack 5 000** | $35 | **$0.0070** | **0.74×** | 🔴 **LOSS** |

**And this is BEFORE the Lemon Squeezy MoR fee (~5 % + $0.50).** After it:

| Channel | Net revenue | $ / credit (net) | Margin | Loss if fully spent |
|---|---|---|---|---|
| Pro $19 | ~$17.55 | $0.0176 | 1.85× | — |
| **Studio $59** | ~$55.55 | $0.0093 | **0.97×** | 🔴 **−$1 per cycle** |
| **Pack 5 000 $35** | ~$32.75 | $0.0066 | **0.69×** | 🔴 **≈ −$15 per pack** |

**A user who buys the $35 pack and spends it all costs the owner ~$47 in provider bills.**
The biggest, most attractive pack is the **most loss-making** one. The "save 20 %" label on the
$12 pack is literally a discount into a loss.

> Why it has not exploded yet: **breakage** — most users never spend all their credits. The
> business is currently profitable *because customers under-use it*. That is not a strategy; it is
> a bet against your own product succeeding.

## 🔴 Finding 2 — The $19 is being asked to pay for THREE things, but was priced for one

The anchor was set as `$19 ÷ 1 000 credits`, i.e. **100 % of the subscription price is allocated to
AI credits**. But that same $19 must also fund:

1. **AI provider spend** — $9.50 if fully used (at 2×);
2. **Contributor payouts** — `(net revenue − AI spend) × 50 %`;
3. **Infrastructure** — Cloud Run, Neon, **storage and egress** (see Finding 3);
4. the owner's actual profit.

Worked example, Pro, fully used:
```
$19.00  price
−$1.45  Lemon Squeezy (MoR fee)          → $17.55 net
−$9.50  AI providers (1 000 × $0.0095)   → $8.05
−$4.03  contributor pool (50 % of $8.05) → $4.02 left
−  ???  infra + egress + failed-gen losses (P19) + support
```
**The owner's margin on a fully-engaged Pro user is ~$4 — before infrastructure.** On Studio and on
credit packs it is **negative**.

**Fix:** the credit anchor must be **revenue allocated to AI ÷ credits granted**, not
**price ÷ credits**. E.g. allocate 60 % of Pro to AI → anchor `$11.40 / 1 000 = $0.0114`; then
1 000 credits cost $5.70 to serve and the remaining $11.85 funds contributors, infra and profit.
Then **re-derive every model price** (the "Apply target margin" engine already does this — P25).
**MONEY ZONE: the owner decides the anchor and presses Apply. Nothing changes automatically.**

## 🔴 Finding 3 — Template downloads have a bandwidth cost that appears NOWHERE in the model

- Pro advertises **"All 10 000+ templates"** and Free allows 15 downloads/month.
- Packs are large — the bulk uploader's per-file cap is **3 GB** (P5.7), and the one real template
  in production is **110 MB**.
- **GCS egress is roughly $0.08–0.12 / GB.** A Pro user downloading 100 packs × 300 MB = **30 GB
  ≈ $2.40–3.60** — i.e. **most or all of the ~$4 that was left**.
- **Nothing in the pricing model accounts for this.** `ProviderSpend` tracks AI cost only; egress is
  invisible.
- The pool payout is computed on `(revenue − AI spend)` — **egress is not subtracted**, so
  contributors are paid out of money that will later be spent on bandwidth.

**Fix:** subtract infra/egress from the pool base, and add a downloads-per-month cap on Pro (even a
generous one — "unlimited" with 3 GB packs is an unbounded liability), or serve packs through a CDN
with cheaper egress (P7 #1 — the CDN also fixes this).

## 🔴 Finding 4 — Contributor self-dealing (the owner's exact question)

**What is already defended** (`lib/download-events.ts:80–95`):
- **Self-exclusion:** downloading your own template earns you nothing (`input.userId !== ev.contributorId`).
- **Dedup:** unique `(user, template, kind)` — the same user downloading the same template 500 times
  earns **one** event, not 500.
- **Email-verify gate:** `downloaderMayEarn()` — an unverified account cannot generate earnings.
- **Admins excluded.**

**What is NOT defended — the sybil attack the owner is describing:**
- A contributor creates **50 verified throwaway accounts** (same weakness as P23 GAP 2 — free email
  addresses are unlimited), and each downloads each of their 100 templates **once**.
  → 5 000 perfectly "legitimate" download events → a large share of the pool.
- In **pool mode** this does not cost the owner more money directly (the pool is a fixed share) —
  it **steals from the honest contributors**, which destroys the supply side. In `per_download` mode
  (`$0.10/download`, `earnings.ts:26`) it would cost the owner **$500 in cash**.

**Fixes:** device/IP/ASN clustering on download events · a payout hold period + manual review above a
threshold · flag contributors whose downloads come from accounts created within N days of each other
or that download *only* their templates · require a payment method / KYC before payout · keep
`PAYOUT_MODE = pool` (never enable `per_download` without these defences).

## Problems the owner has not thought of (director-raised)

- **P26.1 — Credits are granted monthly; are they capped or do they roll over?** If unused credits
  accumulate, a user can bank 12 months of credits and then spend them **all at once** — at which
  point the loss-making pricing above becomes a real, simultaneous bill. Verify `resetMonthIfNeeded`
  (`plugin-profile.ts:160`): a **reset** (expiring) is safe; a **top-up** (rolling) is a liability.
  **This determines whether the breakage assumption above holds at all.**
- **P26.2 — Purchased (top-up) credits must not expire, plan credits should.** Mixing them in one
  `aiCredits` integer means you cannot tell them apart — and the chargeback clawback
  (`lemonsqueezy.ts:129`) can only claw back "unspent top-up credits", which is undecidable if the
  two are pooled. **Verify: are they tracked separately? If not, that is a real accounting bug.**
- **P26.3 — Studio's "5 seats" is priced as one account.** $59 / 6 000 credits shared by 5 people =
  the worst margin in the table, used by the heaviest users. Either raise the price, lower the
  credits, or price per seat.
- **P26.4 — "Priority generation" / "Priority render queue" are sold but not implemented.** There is
  no priority queue in `gen-processor.ts`. Same class of problem as the missing watermark (P23 GAP 1):
  **paid features that do not exist.** Either build them or remove them from the pricing page.
- **P26.5 — "API access" (Studio) does not exist.** There is no public API. Same issue.
- **P26.6 — Free plan cost is real:** 50 credits × $0.0095 = **$0.475/month of provider spend per
  free account**, plus storage. With the sybil weakness (P23 GAP 2) this is a direct, unbounded
  drain. Consider: fewer free credits, or credits that require email verification + one-time
  verification.
- **P26.7 — The pool can go NEGATIVE.** `pool = (net revenue − AI spend) × 0.5`. In a month where AI
  spend exceeds subscription revenue (entirely possible given Findings 1–3), the pool is ≤ 0 and
  **contributors earn nothing that month**. There is no floor. That is a supply-side death spiral —
  the contributors leave exactly when you need content most. Decide a minimum guaranteed pool.
- **P26.8 — Nothing tells the owner any of this in real time.** There is no dashboard showing
  *revenue − AI spend − payouts − infra = profit*, per month, per plan, per channel. `model-margin.ts`
  and `pricing-reconcile.ts` compute pieces of it. **Assemble them into one Admin screen** —
  otherwise the next pricing decision will be made the same way this one was: by guessing.

## What to do (director's recommendation, in order)

1. **Do P24 first** (measure the real provider cost). Every number above depends on the $0.0095
   assumption, which is itself derived from *estimated* provider prices. **If the estimates are low,
   the losses are worse than this table says.**
2. **Immediately re-price the credit packs and Studio** so that `$/credit ≥ anchor` — or accept a
   deliberate, quantified loss-leader. **The $35 pack as it stands is a machine for losing money.**
3. **Re-anchor the credit value** (Finding 2) so the subscription funds AI + contributors + infra,
   not AI alone.
4. **Subtract infra/egress from the pool base** and cap Pro downloads (Finding 3).
5. **Ship the sybil defences** before enabling payouts (Finding 4) — payouts are not live yet, which
   is the only reason this has not cost money already.
6. **Build the profit dashboard** (P26.8) — one screen, updated monthly, that answers "am I making
   money?" without a spreadsheet.

**MONEY ZONE:** every number here is a **decision for the owner**. Code may compute, propose, and
alert — it must **never** change a price, a credit value, a margin, or a payout rate on its own.

---

# P27 — OWNER'S PRICING DECISIONS (binding) — stop selling below cost

> These are **decisions**, not analysis. The analysis is P26; the measurement is P24.
> Approved by the owner on **2026-07-12**. Implement exactly as written.
> ⚠️ **MONEY ZONE:** these change *product prices and grants*. They do **NOT** change
> `computeGenCost`, `imageUnitCost`, the signed cost-quote / HMAC, or the consume/refund path.
> If any of these edits appears to require touching those → **STOP and flag.**

## D1 — Credit packs: keep the price, cut the credits ✅ APPROVED

`packages/assetflow-studio/platform/index.html:17851–17855` (`creditPacks`) — and the matching
**Lemon Squeezy variants must be updated to the same numbers** (`findCreditVariant` maps by credit
amount, `lib/lemonsqueezy.ts:187`), or checkout will break.

| Now (loss-making) | → | **New** | $/credit |
|---|---|---|---|
| $5 → 500 | → | **$5 → 250** | $0.020 ✅ |
| $12 → 1 500 ("save 20 %") | → | **$12 → 600** | $0.020 ✅ |
| $35 → 5 000 | → | **$35 → 1 800** | $0.019 ✅ |

Remove the misleading **"save 20 %"** label (a pack must never be cheaper per credit than the
subscription — that inversion is what caused the loss). Update the copy in **both** the pricing page
and the Account → Credits panel (`creditPacksAcc`).

## D2 — Studio plan: $59 → **3 000 credits** (was 6 000) ✅ APPROVED

`lib/landing-config.ts:232`. Restores a ~2× margin on the heaviest-usage plan.
Update the landing copy, the plan config, and the Lemon Squeezy variant.
Also update the **credit allotment** granted on subscription (`plugin-profile.ts` — the plan →
credits mapping), or the page and the grant will disagree.

## D3 — Contributor pool: **30 %**, and infra/egress comes out of the base first ✅ APPROVED

`lib/earnings.ts:50` → `contributorPoolShare()` default **0.50 → 0.30**
(`CONTRIBUTOR_POOL_SHARE` env stays the override).

And the pool **base** changes (`earnings.ts:117–125`):

```
OLD:  pool = (net subscription revenue − AI provider spend)          × 0.50
NEW:  pool = (net subscription revenue − AI provider spend − INFRA)  × 0.30
```

`INFRA` = storage + **egress** + compute for the period. Today egress is **not tracked at all**
(P26 Finding 3) — so this needs an infra-cost input (start with a monthly admin-entered figure, in
the same place as `ProviderInvoice`; automate later alongside P24's GCP billing export).
**Reason:** today contributors are paid out of money that is later spent on bandwidth.

⚠️ `PAYOUT_MODE` stays **`pool`**. Do **not** enable `per_download` (P26 Finding 4).
⚠️ Payouts are **not live** — do not enable them until the sybil defences ship.

## D4 — Remove features that are sold but do not exist ✅ APPROVED ("they aren't needed at all — remove them")

From the pricing page / plan config (`lib/landing-config.ts:227–237`) **delete**:
- **"Priority generation"** (Pro) — there is no priority queue in `gen-processor.ts`.
- **"API access"** (Studio) — there is no public API.
- **"Priority render queue"** (Studio) — same as above.

Also remove any other copy referencing them (FAQ, landing sections, plugin). Do **not** stub them —
the owner's decision is that they are not needed. Everything else on the plans stays.

**Kept, but it MUST be built:** **"Watermarked export"** (Free) / **"4K, watermark-free downloads"**
(Pro). This is the only real Free↔Pro differentiator and it **does not exist in the code**
(P23 GAP 1). Do not delete this line — **implement the watermark** (see P4 for the ffmpeg pipeline).

## D5 — Credit expiry (verify + implement)

- **Plan credits EXPIRE monthly** (reset, not accumulate) — otherwise a user can bank 12 months and
  spend them at once, landing the whole loss in one bill (P26.1).
- **Purchased (top-up) credits do NOT expire**, and must be **tracked separately** from plan credits
  — the chargeback clawback (`lemonsqueezy.ts:129`) already claims to claw back *unspent top-up*
  credits, which is undecidable if both live in one `aiCredits` integer (P26.2).
- **Verify `resetMonthIfNeeded` (`plugin-profile.ts:160`) first and report** what it does today
  before changing anything. **Money zone — additive tracking only.**

## D6 — Order of execution (do not reorder)

```
1. P24  — measure the REAL provider cost      (every number above depends on it)
2. D1–D2 — re-price packs + Studio             (stops the bleeding)
3. D4   — remove non-existent features         (10 minutes, removes legal risk)
4. P4/P23-GAP1 — build the watermark           (makes Pro worth buying)
5. D3 + D5 — pool base + credit expiry
6. Sybil defences → only then enable payouts
7. P26.8 — the profit dashboard                (revenue − AI − payouts − infra = profit)
8. Then: content ingest and launch
```

**Acceptance:** after D1–D2, **no channel sells a credit below `creditUsdValue ÷ marginTarget`**.
Add a startup assertion that fails loudly if any plan or pack violates this — so it can never
regress silently again.

---

# CLOSING NOTES

**Problem intake is CLOSED** (owner, 2026-07-12). 27 problems, ordered into 35 execution steps
above. New issues go into a new file, not this one — this document is now a work order.

## The three things that will break this plan if ignored

1. **Order.** Steps 22 → 23 → 24 → 25/26 are a strict chain. Doing the composer chrome (25) or
   drag-and-drop (26) before the reference pool (24) means writing them twice. Doing any of them
   before the re-render fix (22) means debugging ghosts.
2. **The plugin.** Every composer/catalog/API step exists **twice**. A step whose SCOPE says
   `PLUGIN` and which was only done on the web is **not done**.
3. **The money zone.** Gates, caps, idempotency, tracking, watermarks and UI: allowed.
   `computeGenCost` / `imageUnitCost` / the quote HMAC / consume / refund: **frozen.** Anything
   that seems to require touching them → stop and ask.

## Model guidance for Claude Code

- **Sonnet 5** — single-file, well-scoped work: steps 1, 4, 5, 11, 18, 19, 25, 27, 34.
- **Fable 5 (High)** — multi-layer / cross-client / migration work: steps 7, 8, 9, 16, 20,
  22, 23, 24, 28, 29, 32.
- **Opus 4.8** — when quota matters and the task is analysis-heavy but not sprawling: steps 6, 10,
  12, 13, 14, 21, 30, 33.

## The standing blocker nobody has fixed

The catalog holds **one** published template while the landing page says "5 000+". Steps 28–32
build the shelves; **step 35 fills them.** Everything before that is preparation.
