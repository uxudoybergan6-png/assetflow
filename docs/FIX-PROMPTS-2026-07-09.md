# FrameFlow — Fix Prompts (step-by-step, self-contained)

> One document. Each problem below is a COMPLETE, ordered prompt for Claude Code. Execute them
> top to bottom, one at a time; each ends with its own commit. The user reviews the output
> (screenshots / summary) after each problem. Do NOT push — the user pushes.

## GLOBAL RULES (apply to EVERY problem below — do not violate)

- **Money-zone is untouchable:** never change credit consume/refund, the signed cost-quote or
  its HMAC (`lib/gen-quote.ts`, `computeGenCost`/`imageUnitCost` in `gen-models.ts`,
  `plugin-profile.ts`), webhook idempotency, or any credit VALUE. If a fix would touch these,
  STOP and flag it instead.
- **Migrations are additive-only** (new tables/columns; never destructive). Use the project's
  `migrate:deploy` flow and prove the migration applies on a local/dev DB.
- **English UI**; Uzbek code comments per project convention.
- **Build pipeline:** `packages/assetflow-studio/platform/index.html` is the CF Pages DIRECT
  source (edit directly). Admin + shared `js/`/`styles/` are Studio SOURCE — edit the ROOT
  `packages/assetflow-studio/js|styles` (and `admin/`, `contributor/` source) then run
  `npm run studio:sync`; never edit the `studio/`/`admin/` build artifacts. Do NOT touch the
  landing (`ffl-`).
- **Plugin:** `plugins/after-effects-cep/` — no CDN / no internet in AE (self-host fonts, inline
  SVG). After editing, reinstall via `bash plugins/after-effects-cep/scripts/install-cep.sh`
  (the user restarts AE). AE cannot be automated here — verify by `node --check` on changed
  files, DOM/handler inspection, and clear descriptions of expected behavior.
- **Minimal, scoped diffs.** Reuse existing components/endpoints. Don't regress prior work.
- **Each problem:** commit in logical chunks with clear messages, **no `Co-Authored-By`**; do
  **NOT** push. End with a short summary (root cause if applicable, what changed, verification).

---

## EXECUTION ORDER (run in THIS sequence — dependencies + shared-file order)

Do them top-to-bottom. Problem NUMBERS are stable IDs (not the order). This sequence puts
foundations first, respects dependencies, and keeps edits to the two big files
(`AssetFlow_Plugin.html`, `platform/index.html`) coherent. Commit after each; the user pushes.

| # in order | PROBLEM | why here |
|---|---|---|
| 1 | **PROBLEM 7** — Storage sizeBytes fix + backfill | backend, isolated; feeds the accuracy check in #16 |
| 2 | **PROBLEM 14** — Admin email on new user | backend, fully isolated, small |
| 3 | **PROBLEM 13** — Download filename from prompt | backend `genDownloadName` + web/plugin, small |
| 4 | **PROBLEM 3** — Plugin: remove R2V mode | plugin, small — must precede #8 (its video UX assumes R2V gone on plugin) |
| 5 | **PROBLEM 8** — BIG: per-model gen UX (image/video/audio, web+plugin) | core foundation; #10 and #16 depend on it |
| 6 | **PROBLEM 10** — Add-a-model system (validation + catalog-driven + docs) | depends on #8 |
| 7 | **PROBLEM 1** — Plugin Sessions + Projects | plugin foundation; #2 depends on it |
| 8 | **PROBLEM 2** — Gen-card actions + Copy prompt + parity | depends on #1 (plugin Add-to-project) |
| 9 | **PROBLEM 4** — Gen cards: real thumbnails + eager load | backend+web+plugin; feeds #16 speed |
| 10 | **PROBLEM 9** — Template download: size + all assets + name | backend serve + plugin + web |
| 11 | **PROBLEM 6** — AI Studio session multi-select bulk download/delete | backend DELETE + web |
| 12 | **PROBLEM 12** — Prompt box auto-grow | web + plugin, small |
| 13 | **PROBLEM 5** — Templates pills polish | web, small |
| 14 | **PROBLEM 17** — Plugin toast redesign | plugin, small polish |
| 15 | **PROBLEM 11** — Plugin update system + admin release chain | big but independent; near end |
| 16 | **PROBLEM 16** — Web↔plugin SYNC/SPEED/CONSISTENCY/ACCURACY | INTEGRATION pass — depends on #1,#2,#4,#8; do LAST |

**Split out (run separately, any time):** PROBLEM 15 (Landing CMS) → `docs/FIX-PROMPT-LANDING-CMS.md`.

**Dependency summary:** #3 → #8 → #10 · #1 → #2 · (#1,#2,#4,#8,#7) → #16.
**Money-zone (never touch) applies to all:** #5,#6,#7,#8,#9,#10,#11,#13,#14,#16 are the ones that go
near backend/credits — keep credit consume/refund + cost-quote/HMAC + `computeGenCost` byte-for-byte.

---

## PROBLEM 1 — Plugin: add Sessions + Projects (parity with web)

**Context.** The web platform now has a Sessions model (New session, My Library, sessions list
with covers) and Projects (project cards, project detail showing generations + templates, and
an "Add to project" action on results and catalog items). The AE plugin's AI Tools has NONE of
this, so users get lost/confused when moving web ↔ plugin. Make the plugin consistent with the
web by adding the same concepts, adapted to the plugin's narrow (~500px) panel. The backend is
ALREADY built (PARTIYA 5) — reuse it, do not rebuild it.

Existing backend endpoints to consume:
- `GET /api/studio/gen/sessions` (list, with cover) · `PATCH /api/studio/gen/sessions/:id`
  (rename) · `POST /api/studio/gen/sessions` (create) · gen history is per-session.
- `GET /api/studio/projects` (list, covers) · `POST /api/studio/projects` (create) ·
  `GET /api/studio/projects/:id` (items = gens + templates, resolved media) ·
  `PATCH /api/studio/projects/:id` (rename) · `DELETE /api/studio/projects/:id` ·
  `POST /api/studio/projects/:id/items` `{ kind:'gen'|'template', refId }` ·
  `DELETE /api/studio/projects/:id/items/:itemId`.

**Exact anchors (analyzed) — plugin `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- API client: an `apiBase` + fetch pattern already calls `/api/studio/gen/sessions` (~line
  10166), `/api/studio/gen/cost-quote` (~10500), `/api/studio/gen` (~10506), `/api/studio/gen/
  history`, `/api/studio/credits` (~9039). It does NOT call `/api/studio/projects` yet — add the
  project methods to this SAME client.
- Navigation: the AI Studio view switcher is `axGo('<dest>')` (~lines 3988/4013/4111/4173); there
  is already a "My Library" affordance (~line 4381) and history views that render via
  `resultCard(it, ctx)` (~9212). Hook the new Sessions/My-Library/Projects views into `axGo`.
- Result rendering: reuse `resultCard(it, ctx)` for gens inside sessions/projects/library.
- Web parity source: `packages/assetflow-studio/platform/ff-api.js` defines `sessions()`,
  `session()`, `projects()`, `projectGet()`, `projectCreate()`, `projectRename()`,
  `projectDelete()`, `projectAddItem()`, `projectRemoveItem()` (~lines 135-151), and
  `platform/index.html` implements the web Sessions/Projects UX — MATCH its terminology and flow.

**Step 1 — Study (using the anchors).** Read the plugin's API client, `axGo` nav, and
`resultCard`, and the web `ff-api.js` project/session methods + the web Sessions/Projects UX, so
the plugin uses the SAME terms and endpoints. Add the missing project methods to the plugin's API
client (mirroring `ff-api.js`).

**Step 2 — Design for the narrow panel.** The web's wide left rail won't fit a ~500px plugin
panel. Produce a quick self-contained mockup first
(`plugins/after-effects-cep/_aitools-sessions-projects-mockup.html`, FrameFlow plugin tokens:
dark + lime, local fonts, inline SVG, NO CDN) showing the adapted layout for: AI Tools entry
with sessions access, Sessions list / New session, My Library (all gens), Projects list, Project
detail (gens + templates), the "Add to project" picker, and a narrow-width check. Use a
plugin-appropriate pattern (e.g. a Sessions dropdown/sheet, compact list sections, and a tab or
segmented control to switch AI Tools ↔ Sessions/Library ↔ Projects) rather than a wide rail.
Screenshot the mockup frames.

**Step 3 — Build Sessions into the live plugin.** Implement, matching the mockup: "New session",
"My Library" (aggregates all of the user's generations), and the sessions list (with covers),
wired to the real endpoints above. Selecting a session loads its generations; a new session
starts fresh. Keep the existing composer/gen flow intact.

**Step 4 — Build Projects into the live plugin.** Projects list (cards with real covers),
create/rename/delete, project detail showing the project's generations AND templates with real
media, per-item remove, and an "Add to project" action on generation results (and on catalog
template items) that opens a picker which can also create-and-add a new project. Reuse the
existing `/api/studio/projects` endpoints.

**Step 5 — Fix the stale tool set.** The plugin AI Tools picker shows "Audio · COMING SOON" and
"3D · COMING SOON", but the backend has Voice (Kokoro TTS) + SFX (ElevenLabs) LIVE and no 3D.
Make it honest: Voice/SFX = live and usable; remove the "3D" card (or only keep genuinely-not-
built items as "coming soon"). Keep it consistent with what the web exposes.

**Constraints.** Money-zone untouched (results/credits display only — no billing changes).
Narrow-panel responsive. No CDN (local fonts, inline SVG). Reuse the plugin's existing result/
media rendering. Minimal diff; don't regress the composer, catalog, or import flows.

**Verification.** `node --check` the changed plugin files; verify the new sessions/projects API
calls hit the correct endpoints and the handlers are real (not stubs); confirm terminology
matches the web. Since AE can't be automated, describe exactly what the user will see and do a
best-effort narrow-width render of the markup where possible. Reinstall via `install-cep.sh`.

**When finished:** commit in logical chunks (mockup; API client; Sessions UI; Projects UI; tool-
set fix — clear messages, no Co-Authored-By); do NOT push. Summary: how Sessions + Projects were
adapted to the narrow panel, how it stays consistent with the web, and the tool-set correction.

**Model:** Fable 5 (+Extra) — design + narrow-panel adaptation across multiple plugin views.

---

## PROBLEM 2 — Generated-result card actions: clear icons + labels, add "Copy prompt", plugin↔web parity

**Context.** On a generated-result card, the action icons are unclear to users — in the plugin
a card shows a row of bare icons (download ↓, "+", a circular-arrow ↩, "×") with no labels, so
users don't know what they do. Make the actions self-explanatory, add a "Copy prompt" action,
and make the PLUGIN and WEB result cards expose the SAME set of actions + settings, all working.
This is QA issue #15 plus a copy-prompt addition and cross-surface parity.

**Exact anchors (analyzed):**
- Plugin `plugins/after-effects-cep/AssetFlow_Plugin.html`: the result card is `resultCard(it,
  ctx)` (~line 9212); the action row `ra` (class `racts`) is built with `actBtn(IC.icon, title,
  handler)` — current actions: `IC.imp` "Import to AE" (ctx.onImport), `IC.ref` "Use as
  reference" (ctx.onRef, conditional), `IC.rst` "Regenerate — restore prompt + references"
  (ctx.onRestore, if it.prompt), `IC.dl` "Download" (ctx.onDownload, ONLY when `!ctx.isCEP` — so
  download is hidden inside the plugin, replaced by Import), `IC.x` "Delete" (ctx.onDelete). NO
  Copy-prompt, NO Add-to-project yet. `it.prompt` holds the generation's prompt.
- Web `packages/assetflow-studio/platform/index.html`: the gen result actions use `useMenu`
  (the "Use ▾" menu, ~lines 16489/16974/17164/…) with "Add to project" (~16371/16690/16871/
  17010) and "Regenerate" (~16361/16373) and `projectAddItem` (~17591); download + delete exist.
  NO Copy-prompt yet.

**Step 1 — Audit both action sets.** Using the anchors above, list the plugin `resultCard`
actions vs the web `useMenu`/card actions and decide the COMMON set to expose on both: Import
(plugin) / Download (web), Add to project, Regenerate, Copy prompt, Delete. (Note: "Import to AE"
is plugin-only and "Download" is web-only by design — keep that split, but everything else should
match.)

**Step 2 — Clear, labeled actions (plugin `resultCard`).** In `resultCard`'s `racts` row, make
each `actBtn` UNAMBIGUOUS: keep the icon but ADD a visible text label (or ensure a reliable
tooltip/title) in English — at minimum Import to AE, Use as reference (when applicable),
Regenerate, Delete, plus the two new ones below. Keep the plugin's dark+lime style, local fonts,
inline SVG (no CDN). Group them so they read clearly at the plugin's narrow width (labels may
need a compact/hover treatment given the small card — but the meaning must be obvious).

**Step 3 — Add "Copy prompt" (both surfaces).** Add a **Copy prompt** action that copies THAT
generation's prompt to the clipboard with a "Prompt copied" toast. Plugin: add a new `actBtn`
in `resultCard`'s `racts` using `it.prompt` (already present); for clipboard inside CEP use a
hidden-textarea `document.execCommand('copy')` fallback (navigator.clipboard is unreliable in
CEP). Web: add it to the card/`useMenu` using the gen's prompt + `navigator.clipboard.writeText`.
Guard: only show Copy prompt when a prompt exists.

**Step 4 — Parity + Add to project on the plugin card.** Make the common action set consistent
across both surfaces: Add to project, Regenerate, Copy prompt, Delete (plus Import-to-AE on
plugin / Download on web by design). The web already has Add to project + Regenerate via
`useMenu`; the plugin's `resultCard` is MISSING Add to project — add it (a new `actBtn` calling
the project "Add to project" picker). NOTE: the plugin's Add-to-project depends on PROBLEM 1
(plugin Projects) being in place — do PROBLEM 1 first; if PROBLEM 1 isn't merged yet, wire the
button to the same picker PROBLEM 1 introduces. Keep the web's existing Edit / Generate-video
items; just make the shared set + labels consistent so users recognize them after switching.

**Step 5 — Verify each action works, on BOTH surfaces.**
- Download → downloads the asset (correct file). 
- Add to project → adds to a project (uses `/api/studio/projects/:id/items`). 
- Regenerate → re-runs the SAME generation via the EXISTING signed cost-quote → consume flow
  (money-zone untouched; do NOT alter billing — just trigger the existing generate path).
- Copy prompt → clipboard gets the exact prompt; toast shows. 
- Delete → removes the gen. 
Web: verify in a headless browser. Plugin: `node --check` + confirm handlers are real (not
stubs) and calls hit correct endpoints; describe expected behavior.

**Constraints.** Money-zone untouched (Regenerate reuses the existing quote/consume path with no
changes; Copy/Download/Delete don't touch billing). Minimal diff. Plugin: no CDN; reinstall via
`install-cep.sh`. Web: `platform/index.html` direct source.

**When finished:** commit in logical chunks (plugin actions; copy-prompt; web parity — clear
messages, no Co-Authored-By); do NOT push. Summary: the final action set (with icons+labels),
how Copy prompt works on each surface, and the parity + per-action verification results.

**Model:** Sonnet 5 (icon/label clarity + copy button + cross-surface parity — moderate; use
Fable 5 +Extra only if the web card refactor turns out large).

---

## PROBLEM 3 — Plugin: remove the R2V mode from video generation

**Context.** In the AE plugin's VIDEO composer there is a "Fast | R2V" mode toggle; the
"R2V — references" mode adds a large multi-modal reference block that provides no value here and
only wastes space. Remove the R2V mode entirely, leaving the video composer as Fast-only. Plugin
only (not web) — R2V on the web is unchanged. Single file: `plugins/after-effects-cep/
AssetFlow_Plugin.html`. (Analyzed already — exact anchors below.)

**Exact elements (do not hunt — these are the spots):**
- The mode toggle `div.vg-modeseg` (~line 4134-4139) containing `#vgModeFast` ("Fast — frames",
  default on) and `#vgModeR2V` ("R2V — references").
- The R2V multi-modal section `#vgMediaSect` (~line 4153-4167): "Active references" (`#vgRefMeta`,
  `#vgRefGrid`), the add buttons `#vgAddImg` / `#vgAddVid` / `#vgAddAud`, `#vgRefLimits`, and
  "Saved References" (`#vgSavedWrap` / `#vgSavedMeta` / `#vgSavedGrid`).
- The video tool metadata: the tool card subtitle "Seedance 2.0 · Fast (frame) + R2V
  (multi-modal)" and `models:'Seedance 2.0<br>Fast + R2V'` (~line 9627-9628).
- The JS: `#vgModeR2V` click handler + the mode-switch logic that toggles `#vgFrameSect` vs
  `#vgMediaSect` and the `#vgGuide` text, plus the media-refs handlers (`vgAddImg/Vid/Aud`,
  `vgRefGrid`, saved refs) and anything that applies `refKind='media-refs'` in the video tool.

**Step 1 — Remove the toggle.** Delete the whole `div.vg-modeseg` segment (both `#vgModeFast`
and `#vgModeR2V`) since only one mode remains — a 1-option toggle is pointless. Keep the Fast
frames flow as the default (no toggle needed). Adjust `#vgGuide` to just the Fast guidance
(drop any R2V branch).

**Step 2 — Remove the R2V section.** Delete `#vgMediaSect` (lines ~4153-4167) entirely — the
Active/Saved references block and its + Image/+ Video/+ Audio buttons. Keep `#vgFrameSect` (Start
/ End frames) intact.

**Step 3 — Clean the JS.** Remove the `#vgModeR2V` handler and the Fast↔R2V mode-switch code, and
the now-orphaned media-refs handlers (vgAddImg/vgAddVid/vgAddAud, vgRefGrid/vgRefMeta,
vgSaved*). Ensure no dangling references cause a JS error. The video tool should always run the
Fast (frame → video) path.

**Step 4 — Drop R2V from the video model set.** Remove Seedance R2V (model 3102) from the
plugin's selectable video models so it isn't exposed without its UI, and update the tool card
text to "Seedance 2.0 · Fast (frame)" / `models:'Seedance 2.0<br>Fast'` (~9627-9628). Keep the
Fast (Seedance 3101 image-to-video) path working. Do NOT change billing/cost (money-zone
untouched).

**Step 5 — Verify.** `node --check` the file; confirm the video composer renders Fast-only with
NO "Fast | R2V" toggle and NO references block, no layout gap, and no JS console errors; confirm
a Fast video (start frame + prompt) still configures and generates; confirm R2V is no longer in
the video model picker. Reinstall via `install-cep.sh`.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: exactly what
was removed (toggle, `#vgMediaSect`, JS handlers, model 3102, card text) and confirmation Fast
video still works.

**Model:** Sonnet 5 — targeted plugin removal, exact anchors given.

---

## PROBLEM 4 — Generated cards load slowly / only render on hover (web + plugin)

**Context.** Generated-result cards (AI Studio gens, "Jump back in", My Library, project detail)
appear slowly, and some only render when you hover over them. Fix so cards show a thumbnail
IMMEDIATELY, fast, without needing to scroll/hover. Both surfaces. (Analyzed — root cause below.)

**Root cause (analyzed):**
1. **No real thumbnails.** `apps/api/src/lib/gen-processor.ts` line 953 stores image gen assets
   with `thumbUrl: s.url` — the "thumbnail" is the SAME full-size generated image (1K/2K/4K). So
   every card downloads a large full-res image just to render a small tile → slow. (Check the
   video/audio asset creation nearby too — video gens likely have no real POSTER-frame thumbnail,
   which is why video cards are black until you hover and the video finally loads.)
2. **Lazy everything (frontend).** Web `platform/index.html` gen cards use `<img loading="lazy">`
   (~16027) and video posters/`preload` (~16028, `g.imgSrc`/`g.vidPoster`/`g.vidPre` from
   `genMediaOf`); related/catalog cards use `loading="lazy"` + `data-src` + `preload="none"`
   hover-play (~15922-15923). Plugin `AssetFlow_Plugin.html` `resultCard` (~9207) uses
   `im.loading='lazy'; im.src=(it.thumb||it.url)` — and `it.thumb` is that same full-res url.
   Above-the-fold cards should load eagerly; today they defer.

**Step 1 — Backend: generate REAL small thumbnails.** In `gen-processor.ts`, when creating gen
assets, produce a genuinely small thumbnail and store it as `thumbUrl` (keep the full asset as
`url`): for IMAGES, resize to ~512px (webp/jpg) — reuse `apps/api/src/lib/optimize-preview.ts` /
`sharp` if available; for VIDEOS, extract a poster frame (ffmpeg) and store it as the video
asset's `thumbUrl`/poster so a still shows immediately. Do NOT set `thumbUrl = url` anymore. This
is additive (the `thumbUrl` column already exists) and must NOT change billing/credits
(money-zone untouched) — thumbnailing happens after the paid generation succeeds. If ffmpeg/sharp
isn't available in the runtime, note it and implement the image thumbnail at minimum + a
best-effort video poster.

**Step 2 — Frontend: use the thumb + load visible cards eagerly (web).** In `platform/index.html`
(`genMediaOf` / `dashGensView` and the catalog/related/project media), point card `imgSrc` /
`vidPoster` at the NEW small `thumbUrl`; keep full `url` for the lightbox/detail. Make the first
row / above-the-fold cards load EAGERLY (`loading="eager"` + `fetchpriority="high"` for the
initial visible set) and keep lazy only for far-below cards. Ensure every VIDEO card has a real
`poster` (the new thumb) so a frame shows immediately — the video body may still load on hover.

**Step 3 — Frontend: same for the plugin.** In `resultCard` (`AssetFlow_Plugin.html` ~9207), use
`it.thumb` = the new small thumbnail; drop `loading='lazy'` for the initial visible cards (or use
an eager load) so gens render immediately; ensure video/sfx tiles show their poster/thumb without
hover. Keep hover-play as an enhancement only.

**Step 4 — Verify.** Web (headless Chrome): open AI Studio / Jump back in / a project with
several gens — thumbnails appear immediately (small requests, not multi-MB), video cards show a
poster (not black) with no hover needed; measure that card image requests are the small thumb,
not the full asset. Plugin: `node --check`; confirm cards use the thumb and render without hover;
describe expected behavior. Run `npm run build -w apps/api`.

**Constraints.** Money-zone untouched (thumbnailing is post-success, no credit/quote change).
Additive (no schema change — `thumbUrl` exists). Minimal diff. Plugin: no CDN; reinstall via
`install-cep.sh`. Web: `platform/index.html` direct source.

**When finished:** commit in logical chunks (backend thumbnails; web card loading; plugin card
loading — clear messages, no Co-Authored-By); do NOT push. Summary: the thumbnail generation
added, the eager-load change, and before/after (thumb size vs full-size) on both surfaces.

**Model:** Fable 5 (+Extra) — backend image/video thumbnailing + cross-surface frontend loading.

---

## PROBLEM 5 — Templates category pills look ugly (double/nested outline)

**Context.** On the web Templates page, the category filter pills ("Templates · Motion · Graphics
· LUTs") look ugly — each pill shows a doubled / nested outline (a faint wide rounded box AROUND
an inner pill), not a single clean pill. Fix the rendering and polish the design so each is one
clean pill. Web only. (Analyzed — anchors below.)

**Exact anchors (analyzed) — `packages/assetflow-studio/platform/index.html`:**
- Markup (~line 16204): `<div class="va-catchips"><sc-for list="{{ fCatsView }}" as="x"
  hint-placeholder-count="6"><span data-v="{{ x.v }}" onclick="{{ onFCat }}" class="{{ x.chipCls
  }}">{{ x.v }}</span></sc-for></div>` — flat `<span>` per chip, class is `'on'` or `''`.
- `fixedCats = ['Templates','Motion','Graphics','LUTs']` (~17056); `fCatsView` builds `chipCls`
  (~18386); `onFCat` toggles (~18924).
- CSS (~15119-15124): `.va-catchips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}`;
  `.va-catchips span{padding:8px 16px;border-radius:999px;font-weight:600;font-size:12px;
  color:var(--muted);background:var(--f1);border:1px solid var(--hair2);…}`; `.on` = lime.

**Step 1 — Reproduce + find the real cause.** Render the Templates page in headless Chrome and
inspect the pills' DOM. The doubled/nested outline is almost certainly one of: (a) the template
engine leaving a PLACEHOLDER element behind (note `hint-placeholder-count="6"`) so a skeleton pill
sits behind each real pill, (b) an extra wrapper element around each `<span>`, or (c) a stray
`outline`/`box-shadow`/second border. Identify which it actually is (count the real DOM nodes per
pill; check for leftover placeholder nodes; check computed styles). Report the cause.

**Step 2 — Fix the rendering.** Remove the source of the double outline: if placeholder skeleton
nodes remain, ensure they're replaced/removed once data loads; if there's a redundant wrapper,
flatten it; if it's a stray outline/shadow, remove it — so each pill is a SINGLE element.

**Step 3 — Polish the pill design.** Make the 4 pills look clean and intentional (Artlist/plugin-
clean): consistent height, comfortable horizontal padding relative to text, a subtle idle fill/
border on the dark surface (readable, not near-invisible), a clear hover, and the active pill in
lime (`--lime` bg / `--onlime` text) — matching the app's other pills. Keep them centered and
wrapping. Ensure the idle pills are clearly visible against the page background (the current
`--f1`/`--hair2` combo may be too faint — adjust so they read as real buttons).

**Step 4 — Verify.** Headless Chrome at 1280 + 390: exactly 4 pills, each a single clean pill
(no nested/double outline), idle pills clearly visible, hover + active (lime) states correct,
clicking filters the catalog and toggling the active pill clears it. Screenshot before/after.

**Constraints.** Web only (`platform/index.html` direct source). Money-zone untouched. Minimal,
scoped diff. Don't regress the filter logic (`onFCat`/`catBucket`).

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the real
cause of the double outline, what was removed/flattened, and the polished pill styling.

**Model:** Sonnet 5 — targeted CSS/markup fix with exact anchors.

---

## PROBLEM 6 — AI Studio: multi-select sessions to bulk download or delete

**Context.** In the web AI Studio left rail (Sessions list), let the user SELECT multiple
sessions (checkboxes) and then bulk **Download** or **Delete** them. Today sessions can only be
opened/renamed. Web `packages/assetflow-studio/platform/index.html` + backend
`apps/api/src/routes/studio-gen.ts`. (Analyzed — anchors + a data-loss caution below.)

**Exact anchors (analyzed):**
- Backend session routes in `studio-gen.ts`: GET `/gen/sessions` (~341), POST `/gen/sessions`
  (create), PATCH `/gen/sessions/:id` (rename, ~420), GET `/gen/sessions/:id/generations`
  (~438). There is **NO DELETE** endpoint — add one.
- ⚠️ Schema: `Generation.session GenSession @relation(..., onDelete: Cascade)`
  (`packages/database/prisma/schema.prisma:455`). So deleting a `GenSession` **CASCADE-deletes
  all its Generations** (and their genAsset rows). This is real data loss → require confirmation
  and clean up storage.
- Web sessions rail: CSS `.va-sessrow` (~15304-15312); markup/logic (~18216 / 18769). Sessions
  data in `state.sessions` (`sessionsView`). Web has NO existing multi-select (only the plugin's
  `resultCard` has `rcb`/select) — build it here.
- Reuse the existing single-generation delete path (`DELETE /gen/:id`, ~10734 area / the route in
  studio-gen.ts) for its ASSET cleanup logic (delete GCS objects) so session-delete doesn't leave
  orphaned files.

**Step 1 — Backend: DELETE session endpoint.** Add `DELETE /gen/sessions/:id` in `studio-gen.ts`,
owner-scoped (404 for other users, like the PATCH route). Before/while deleting, clean up the
GCS assets of the session's generations (reuse the same cleanup the single-gen delete uses), then
delete the session (cascade removes the Generation + genAsset rows). Money-zone: do NOT
refund/charge anything — these credits were already spent; just delete data. Return the count
deleted.

**Step 2 — Web: select mode on the sessions rail.** Add a "Select" toggle (and/or long-press /
checkbox affordance) that turns the `.va-sessrow` list into selectable rows with checkboxes.
Track selected session ids in state. Show a bulk action bar (e.g. "N selected · Download ·
Delete · Cancel") when ≥1 is selected. Keep the normal click-to-open behavior when NOT in select
mode.

**Step 3 — Bulk delete (with confirmation).** "Delete" opens a confirm dialog that clearly warns:
"Delete N sessions and all their generations? This cannot be undone." On confirm, call the new
DELETE endpoint for each selected session, then refresh the sessions list + My Library. Data-loss
action → the confirmation is mandatory.

**Step 4 — Bulk download.** "Download" downloads the generations' assets from the selected
sessions. Preferred: a backend endpoint that streams a ZIP of the selected sessions' assets
(reuse existing signed-URL/asset access; name files by session/prompt) so the user gets one file;
if a backend zip is too large a change, fall back to sequential per-asset downloads with a clear
progress indication. Do not block on huge sets — cap/paginate sensibly.

**Step 5 — Verify.** Web (headless Chrome): enter select mode, select 2+ sessions, Download
(получить the zip / files) and Delete (confirm → sessions + their gens gone, list refreshes,
My Library count drops). Confirm owner-scoping (can't delete others' sessions → 404). Confirm no
orphaned GCS assets after delete. Run `npm run build -w apps/api`.

**Constraints.** Money-zone untouched (no credit refund/charge). Additive (no schema change —
cascade already exists). Confirmation required for delete (data loss). Minimal diff. Web
`platform/index.html` direct source.

**When finished:** commit in logical chunks (DELETE endpoint + asset cleanup; select UI; bulk
delete; bulk download — clear messages, no Co-Authored-By); do NOT push. Summary: the new DELETE
endpoint + cleanup, the select/bulk UI, and how download packaging works.

**Model:** Fable 5 (+Extra) — backend delete/cleanup + zip download + web multi-select UI.

---

## PROBLEM 7 — "Storage (AI results)" is wrong (undercounts) — fix + verify the whole web+plugin chain

**Context.** The account "Storage (AI results)" meter is inaccurate: a user with MANY generations
(40, incl. large videos) shows only "6 MB / 1 GB". Real usage is far higher, so almost nothing is
being counted. Fix the storage accounting so it's accurate, and verify the full chain on BOTH web
and plugin. Backend + both surfaces. (Analyzed — anchors + likely root cause below.)

**Exact anchors (analyzed):**
- Storage sum: `apps/api/src/lib/storage-quota.ts:43` `getUserUsedBytes()` = `genAsset._sum
  sizeBytes` (where `generation.userId`) + `savedReference._sum sizeBytes`. Logic is fine — so
  the inputs (`genAsset.sizeBytes`) must be null/0 for most assets.
- `/credits` endpoint (`studio-gen.ts` ~317) returns `storage: { usedBytes, quotaBytes }`; both
  web (`platform/index.html`) and plugin (`AssetFlow_Plugin.html` ~8021/8033) read this to draw
  the "X / Y GB" bar.
- Asset creation records `sizeBytes` in `gen-processor.ts`: image (line 953), audio (966/981),
  video (1011); `persist()` (~297) sets `sizeBytes = buf.length`. LIKELY BUGS: (a) some asset
  types (esp. VIDEO — the biggest) end up with `sizeBytes = 0/null` (e.g. stored by reference /
  the provider returns a URL so `out.buf` isn't the full media), and/or (b) HISTORICAL assets
  were created before `sizeBytes` recording existed → `sizeBytes` is null and counts as 0.

**Step 1 — Diagnose precisely.** Query the DB for this user: how many `genAsset` rows have
`sizeBytes` null or 0, broken down by `type` (image/video/audio). Confirm whether the 6 MB is
because (a) most rows are null/0, and whether it's concentrated in a type (likely video) or in
older rows. Report the finding before fixing.

**Step 2 — Fix recording at creation (all types).** In `gen-processor.ts`, ensure EVERY asset
type records the TRUE stored byte size: image, audio, and especially VIDEO. If a provider returns
a URL and the media is copied CDN→R2 without a local buffer, obtain the real object size (e.g.
from the R2/GCS object metadata / HeadObject on `resultKey`) and store it as `sizeBytes` — do not
leave it 0/null. Verify `persist()` returns the real size for videos.

**Step 3 — Backfill existing assets.** For existing `genAsset` rows with null/0 `sizeBytes` that
DO have a `resultKey` in storage, fetch the real object size (HeadObject) and update `sizeBytes`.
Provide a safe, idempotent backfill (a script or an admin-triggered maintenance route). Rows with
no stored object (data-URI, key=null) can be estimated from the asset or left as-is (note it).

**Step 4 — Verify the whole chain (web + plugin).** After the fix + backfill, `getUserUsedBytes`
should reflect real usage. Confirm `/credits` returns the corrected `usedBytes`, and that BOTH
the web Account "Storage (AI results)" bar and the plugin storage bar show the accurate value.
Also confirm the storage-quota gate (`isStorageOverQuota`, used on ref-upload / gen) still works
with the corrected numbers.

**Constraints.** Do NOT change credit/billing money-zone (storage quota is separate from credit
consume/refund — leave those untouched). Additive (no schema change — `sizeBytes` exists). The
backfill must be safe/idempotent and not touch credits. Minimal diff.

**Step 5 — Confirm.** `npm run build -w apps/api`; run the backfill on a dev DB (or dry-run) and
show before/after totals for a user; screenshot the corrected web storage bar; describe the
plugin's corrected bar. Confirm no credit/billing side effects.

**When finished:** commit in logical chunks (recording fix; backfill; verification — clear
messages, no Co-Authored-By); do NOT push. Summary: the real cause (which asset type / historical
rows were null), the recording fix, the backfill, and the corrected web+plugin storage readout.

**Model:** Fable 5 (+Extra) — backend size accounting + backfill + cross-surface verification.

---

## PROBLEM 8 — BIG: per-model gen UX must be complete + correct + reach each provider (web + plugin, image/video/audio)

**Context (high priority).** Generation models don't fully work: for many models the full,
model-specific capabilities aren't shown or don't work — especially **reference images** and
**start/end frames**, aspect/resolution/duration/count/audio per model. Each model has its OWN
capability set, and FrameFlow uses MULTIPLE providers (Vertex/Google, fal, OpenRouter,
ElevenLabs). Build/verify a genuinely per-model, model-driven UX on BOTH web and plugin, wire
every control to the CORRECT provider field, and verify it reaches the API correctly — for
image, video, AND audio. This is the thorough completion of PARTIYA 2 (#16); do it properly and
100% correct. ⛔ MONEY-ZONE untouchable: do NOT change credit consume/refund, the signed
cost-quote/HMAC, or `computeGenCost`/pricing values (incl. per-sec `perSec`) — only how PARAMS
map to providers and which controls the UI shows.

**Exact anchors (analyzed):**
- Catalog (source of truth) — `apps/api/src/lib/gen-models.ts` already declares rich per-model
  caps: `provider`, `feature`, `refKind` ('image'|'frames'|'media-refs'), `refMode`
  ('required'|'optional'), `maxRefs`, `startFrame`, `endFrame`, `inputs`, `aspects`,
  `resolutions`, `durations`, `audio`, `imgSettings`, `videoSettings` (aspect/resolution/duration/
  audio/bitrate + defaults + per-sec pricing), `mediaRefs` (R2V multi-modal image/video/audio
  limits). E.g. 1010 (Nano image+edit), 1011/1012 (Imagen, no refs), 3001-3003 (Veo t2v, optional
  image ref), 3101 (Seedance i2v: `refKind:'frames'`, `endFrame:true`, start/end frame),
  3102 (Seedance R2V: `refKind:'media-refs'`, multi-modal), 2001 (Kokoro TTS voice), 4001
  (ElevenLabs SFX duration).
- Providers/mapping — `apps/api/src/lib/gen-processor.ts` + `apps/api/src/lib/ai/` (`openrouter.ts`,
  `fal.ts`, `workers-ai.ts`, Vertex path). Authoritative schemas: `docs/FAL-DOCS-MODELS.md`,
  `docs/OPENROUTER-katalog-yakuniy.md`, `docs/AI-API-NOTES.md`.
- Web composer — `platform/index.html`: `buildParams` + the model-driven controls (aspect/qual/
  count/reference from `model.aspects`/`imgSettings`/`videoSettings`/`refKind`).
- Plugin composer — `AssetFlow_Plugin.html`: `applyModelSettings`, `igModelRefOk`/`modelAccepts…`,
  `refKind`, the frames section (`vgFrameSect` start/end) and image-edit refs.
- NOTE: PROBLEM 3 removes the R2V mode from the PLUGIN only — so on the plugin, video = Fast
  (frames) with start/end; R2V multi-modal stays on WEB. Account for that split here.

**Step 0 — Build the authoritative per-model matrix.** For EVERY enabled model (image, video,
audio), from the catalog + the provider docs, produce a table: model id/label/provider/feature ·
supported inputs (text, reference image(s), START frame, END frame, multi-modal refs, audio ref)
· aspects · resolutions · durations · count · audio · AND the EXACT provider API field each maps
to (with value format). Then, for each, record what the WEB UI currently shows/sends and what the
PLUGIN UI currently shows/sends. Mark every GAP (capability not exposed) and every MISMATCH
(wrong/missing provider field). Save this as `docs/GEN-MODEL-MATRIX.md`. Do NOT guess provider
schemas — use the docs.

**Step A — IMAGE models (do fully, then move on).** Make web + plugin render EXACTLY each image
model's real caps from the catalog: text-to-image vs image-EDIT (reference image) — show the
reference/upload ONLY for edit-capable models (Nano 1010/1013/1014), hide for Imagen (1011/1012);
aspect/quality/count from the model. Wire each to the correct provider field (Vertex
`generateContent imageConfig{aspectRatio,imageSize}` / `generateImages{aspectRatio,imageSize,
numberOfImages}` + the image-edit reference input). Fix every gap/mismatch from Step 0. Verify
(below) before moving on.

**Step B — VIDEO models (the main pain: references + start/end frame).** Make web + plugin render
EXACTLY each video model's caps:
- Veo 3001-3003: text-to-video with an OPTIONAL image reference; aspect (16:9/9:16), resolution,
  duration, audio (per model). Map to Vertex `generateVideos config{aspectRatio,durationSeconds,
  resolution,generateAudio,image,lastFrame}`.
- Seedance Fast 3101: START frame + optional END frame (`refKind:'frames'`, `endFrame:true`);
  aspect/resolution/duration/audio. Map to the fal image-to-video fields (start/end frame image
  URLs) per FAL-DOCS-MODELS.md.
- Seedance R2V 3102 (WEB only): multi-modal refs (image≤9/video≤3/audio≤3) per `mediaRefs`; map to
  the fal reference-to-video fields.
Ensure the reference/start-frame/end-frame UI actually uploads and the correct URL(s) reach the
provider (this is where users report it "doesn't work"). Fix every gap/mismatch. Verify before
moving on. (Plugin: Fast only, per PROBLEM 3.)

**Step C — AUDIO models.** TTS (Kokoro 2001): voice + language controls → correct provider fields.
SFX (ElevenLabs 4001): duration → `elSoundEffects(duration)`. Ensure the UI exposes exactly these
and maps correctly. Verify.

**Verification (rigorous, per model, both surfaces).** For EACH enabled model: dry-run
`buildParams` (web) + the plugin param builder + the provider adapter, and print the resulting
provider payload; check it against the model's documented schema (correct field names/enums,
required inputs present, unsupported fields absent, reference/start/end-frame URLs included when
provided). Confirm the UI shows exactly the model's controls on BOTH web and plugin. Do minimal
LIVE checks only where a dry-run can't prove it, using the CHEAPEST model/settings, and NEVER
video (expensive) — the goal is to stop wasted credits, not create them. Confirm the cost-quote
signature path is byte-for-byte unchanged (diff it). Run `npm run build -w apps/api`; `node
--check` the plugin.

**Constraints.** Money-zone untouched (params/UI only). Additive. Keep the UI catalog-DRIVEN so
future model changes stay correct. Do it modality by modality (A→B→C) to avoid breaking
everything at once. English UI. Plugin: no CDN; reinstall via `install-cep.sh`. Web:
`platform/index.html` direct source.

**When finished:** commit in logical chunks (matrix doc; image; video; audio — clear messages,
no Co-Authored-By); do NOT push. Summary: the `GEN-MODEL-MATRIX.md`, every gap/mismatch fixed per
model (UI + provider mapping) on both surfaces, and explicit confirmation the money-zone was
untouched.

**Model:** Opus 4.8 (money-adjacent, rigor + correctness across many models/providers). Fable 5
+Extra acceptable if quota is tight, but keep the money-zone guardrails strict.

---

## PROBLEM 9 — Template download: show pack size (plugin), deliver ALL assets, name output by template name (not ID)

**Context.** Three related template-download issues on web + plugin: (1) the pack ZIP SIZE should
be shown on both surfaces (web already shows "20.1 MB pack"; the plugin detail should too);
(2) downloading a template still yields ONLY `pack.aep` — the assets (footage/audio/folders) are
missing; the user must receive the pack EXACTLY as the contributor uploaded it (PARTIYA 1 fixed
ingest+serve+plugin for the full package, but the user still sees a `pack.aep`-only, ID-named
folder — verify + fix the remaining gap); (3) the downloaded/extracted output must be named by
the TEMPLATE NAME (e.g. "Fast Light Leaks Transitions Bundle"), NOT an ID
(`assetflow_cmrc9j4…_unzipped`). Web + plugin. (Analyzed — anchors below.)

**Exact anchors (analyzed):**
- Plugin extraction/cache folder: `assetflow-catalog.js` uses `assetflow_${templateId}_unzipped`
  (~lines 625, 533, 706) — named by ID. It unzips via `unzip` (~415/538/596). Template `fileSize`
  is available (~5036). PARTIYA 1 added a `.assetflow_pack_size` marker to re-extract when the
  pack changes.
- Web: `platform/index.html` shows pack `fileSize` (~17479/18435) as "20.1 MB pack"; download via
  the serve endpoint. `serve-asset.ts` sets `Content-Disposition` (line 92) — PARTIYA 1 (C3) made
  the download filename the TEMPLATE NAME (verify it actually does).
- Backend pack storage: PARTIYA 1 stores the full original zip as `templates/{id}/pack.zip` and
  serves it byte-for-byte. This template shows a 20.1 MB `.zip pack` — so the full zip (with
  assets) IS stored; the missing-assets symptom is likely a STALE plugin extraction (from before
  the fix) not re-extracting, and/or a naming issue.

**Step 1 — Plugin: show the pack size.** In the plugin's template detail, display the pack size
(from `fileSize`, formatted MB) — matching the web's "20.1 MB pack". Consistent on both surfaces.

**Step 2 — Deliver ALL assets (verify + fix the remaining gap).**

> **CORE PRINCIPLE (non-negotiable):** whatever the contributor uploaded in their pack .zip — the
> EXACT set of files AND the EXACT folder structure — is EXACTLY what the user must download and
> unzip, on both web and plugin. No stripping to `pack.aep`, no rebuilding a zip from the `.aep`,
> no flattening or reordering folders. Contributor's zip in === user's zip out, byte-for-byte
> contents. AE must open the project with every linked footage/audio asset resolving (no "files
> missing").

Verify end-to-end that downloading THIS 20.1 MB template on web AND plugin yields the FULL package
(pack.aep + footage + audio + subfolders), not just `pack.aep`:
- Web: confirm the served download is the full `pack.zip` (20.1 MB), not a rebuilt .aep-only zip.
- Plugin: confirm it downloads the current full zip and RE-EXTRACTS it (the `.assetflow_pack_size`
  marker must invalidate a stale `pack.aep`-only cache from before the fix). If the cache logic
  doesn't refresh when the stored pack differs, fix it so a re-download always yields all assets.
- If a specific template's STORED pack is genuinely `.aep`-only (ingested before PARTIYA 1), note
  that it needs re-upload — but the pipeline itself must deliver everything the stored zip
  contains.

**Step 3 — Name output by template name, not ID.** 
- Plugin: change the extraction folder from `assetflow_${templateId}_unzipped` to a folder named
  after the TEMPLATE NAME (sanitized for the filesystem; keep uniqueness — e.g. append a short id
  suffix only if needed to avoid collisions, but the human-readable name must lead). Update all
  references (~625/533/706 and the cache lookup) consistently so import still finds the files.
- Web: ensure the downloaded .zip filename is the template name (verify `serve-asset.ts`
  Content-Disposition / the client download name).

**Step 4 — Verify.** Web (headless): download the template → the file is named by the template
name and, when unzipped, contains all assets + folders. Plugin: `node --check`; confirm the
extraction folder is named by the template name and contains the full package (not just
pack.aep), and that a re-download refreshes a stale cache. Confirm the plugin detail shows the
pack size. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Additive. Keep the plugin import working (it must still
find `pack.aep` inside the renamed folder). Minimal diff. Web `platform/index.html` direct source;
plugin no CDN.

**When finished:** commit in logical chunks (plugin size display; full-asset delivery + cache
refresh; name-by-template-name — clear messages, no Co-Authored-By); do NOT push. Summary: whether
the missing-assets was a stale cache vs a stored-pack gap, the naming change, and the verified
full-package download on both surfaces.

**Model:** Fable 5 (+Extra) — plugin extraction/naming + serve verification + web.

---

## PROBLEM 10 — Make adding a NEW model safe, catalog-driven, validated, and identical on web + plugin

**Context.** The user plans to add MANY more AI models over time. Adding a model must be a single,
safe, catalog-driven operation: add one entry → it gets the CORRECT model-specific UX
automatically, reaches its provider correctly, and behaves IDENTICALLY and error-free on BOTH web
and plugin — with no per-model hand-wiring and no silent breakage. Build the extensibility +
guardrails + docs layer on top of the per-model correctness from PROBLEM 8. ⛔ MONEY-ZONE
untouchable (don't change `computeGenCost`/cost-quote/consume; validation just ensures new entries
supply valid cost fields). **Do PROBLEM 8 first** (it makes the current models fully
catalog-driven); this problem makes FUTURE additions safe.

**Exact anchors (analyzed):**
- Catalog is typed: `GenModel` type(s) in `apps/api/src/lib/gen-models.ts` (~lines 23-43, 1062,
  1189) + the `GEN_MODELS` array. Rich per-model caps already exist (refKind/refMode/maxRefs/
  startFrame/endFrame/inputs/aspects/resolutions/durations/audio/imgSettings/videoSettings/cost).
- Provider dispatch: `gen-processor.ts` selects the adapter via `model.provider` / `model.feature`
  in `if (provider === "vertex-video" | "fal-video" | "fal-ref-video" | "openrouter-video" | …)`
  branches (~124/132/145/407/482/549/624/849/991). Adding a model with an EXISTING provider needs
  no new branch; a NEW provider needs a new branch + mapping.
- Web composer: `platform/index.html` `buildParams` + model-driven controls. Plugin: `AssetFlow_
  Plugin.html` `applyModelSettings` / refKind / frames.
- GAPS: there is NO runtime validation of `GEN_MODELS` entries, and NO "how to add a model" doc.

**Step 1 — Tighten the model type + add runtime validation.** Make the `GenModel` TypeScript type
strict and complete (every capability field, with clear required vs optional). Add a validator
(run at server startup and/or as a build/test step) that checks EVERY `GEN_MODELS` entry:
required fields present; valid `mode`/`provider`/`feature`/`refKind`; `maxRefs`≥0 consistent with
`refMode`; non-empty `aspects`/`resolutions`/`durations` where the mode needs them;
`imgSettings`/`videoSettings` present for image/video; valid cost/pricing fields
(`cost`/`perSec`); unique `id`. A malformed entry must FAIL LOUDLY (clear error naming the
model + field), never silently break the UI or provider call.

**Step 2 — Make the UX 100% catalog-driven (both surfaces).** Audit the web `buildParams`/controls
and the plugin `applyModelSettings`/controls for ANY remaining hardcoded per-model branches, and
replace them with generic, catalog-driven rendering: the composer must build every control
(reference/start-end frame, aspect, resolution, duration, count, audio, multi-modal refs) purely
from the model's catalog fields — so a brand-new entry renders correctly with ZERO UI code
changes. Web and plugin must derive from the SAME catalog and behave identically.

**Step 3 — Provider adapter contract.** Document + (if needed) formalize the provider→adapter
dispatch so that: adding a model with an existing `provider` = catalog entry only; adding a NEW
`provider` = implement one adapter branch that maps the standard param set → that provider's API.
Keep the mapping in one clear place (`gen-processor.ts` / `ai/`) with a documented interface.

**Step 4 — Write `docs/ADD-A-MODEL.md`.** A step-by-step guide: how to add a model = add a
`GEN_MODELS` entry with all required fields (annotated example for image, video, audio), run the
validator, and verify it (a) renders the right UX on web + plugin, (b) maps to the provider
correctly (dry-run), (c) prices correctly. Include a copy-paste template entry, a checklist, and a
"test without spending credits" (dry-run) recipe. Also document: for a new PROVIDER, add the
adapter branch.

**Step 5 — Add a guard test.** A test that iterates `GEN_MODELS` and asserts each entry: passes
validation, produces a valid provider payload via the mapping (dry-run, no live call), and has the
UI fields the composer needs — so future additions that are malformed are caught automatically.

**Verification.** Add ONE representative NEW test model entry (behind `enabled:false` or in a
test) for image and for video, and confirm it auto-renders the correct controls on web + plugin
and produces a correct dry-run provider payload — with NO UI code changes — then remove/disable
it. Run `npm run build -w apps/api` + the guard test; `node --check` the plugin. Confirm
money-zone (`computeGenCost`/cost-quote) byte-for-byte unchanged.

**Constraints.** Money-zone untouched. Additive. Keep web + plugin deriving from the same catalog.
Minimal diff to existing working models. Plugin no CDN; reinstall via `install-cep.sh`.

**When finished:** commit in logical chunks (type+validator; catalog-driven UI cleanup; adapter
contract/doc; ADD-A-MODEL.md + guard test — clear messages, no Co-Authored-By); do NOT push.
Summary: the validation now enforced, any hardcoded per-model UI removed, the add-a-model doc, and
proof that a new entry auto-works on both surfaces.

**Model:** Fable 5 (+Extra) — architecture + validation + cross-surface + docs. (Opus 4.8 if you
want extra care given the money-adjacent cost fields.)

---

## PROBLEM 11 — Plugin update system: in-plugin update notification + admin release chain

**Context (important).** When a new plugin version ships, the user should get a NICE in-panel
notification and be able to UPDATE right there without leaving the plugin. And the admin needs a
clear, reliable CHAIN to push updates — a new plugin version, or a new model/tool — out to users.
Today there is NO update mechanism at all (no version-check API, no updater UI). Build it. (Analyzed.)

**Key architecture — TWO update channels (make this explicit in the build + docs):**
1. **Server-driven config (models, tools, pricing, catalog)** — already comes from the API
   dynamically (`/gen/models`, catalog). When the admin adds/edits a MODEL or tool config, the
   plugin picks it up on next fetch — NO binary update needed. (This is the catalog-driven system
   from PROBLEM 8/10.) So "admin adds a new model" = instant, no plugin release.
2. **Plugin CODE/binary updates** (new UI, new tool code, fixes) — DO need a released package +
   an in-plugin updater. That's what this problem builds.

**Exact anchors (analyzed):**
- Plugin version lives in `plugins/after-effects-cep/CSXS/manifest.xml` (`ExtensionBundleVersion`).
- NO `/api/plugin/version|latest|update` endpoint exists; NO version-check / updater UI in the
  plugin. Plugin has `--enable-nodejs` (can use `fs`/`child_process` to download + install).
- Admin panel: `packages/assetflow-studio/admin/` (add a "Plugin releases" section).

**Step 1 — Backend: release channel.** Add a `PluginRelease` model (version [semver], downloadUrl
[the packaged extension zip/zxp in storage], releaseNotes, mandatory:boolean/minSupportedVersion,
publishedAt) — additive migration. Add: an ADMIN endpoint to publish a release (upload the package
to storage + create the record, owner/admin-guarded), and a PUBLIC `GET /api/plugin/version`
returning the latest version + releaseNotes + downloadUrl (+ whether the client's version is
below `minSupportedVersion`). Optionally include a checksum for integrity.

**Step 2 — Plugin: version check + nice notification.** On panel load (and periodically), read the
plugin's own version (from the manifest / a version constant) and call `GET /api/plugin/version`.
If a newer version exists, show a NICE in-panel notification (a dismissible banner or a small
modal, FrameFlow dark+lime style, local fonts/inline SVG) with the version + release notes + an
"Update" button. If the update is `mandatory` (client below `minSupportedVersion`), make it a
blocking prompt.

**Step 3 — Plugin: in-place update.** "Update" downloads the release package (from the API/storage,
first-party + user-initiated — verify the source is our API and the checksum if provided), then
installs it: using node `fs`/`child_process`, extract/replace the extension's files in the CEP
extensions dir, then prompt the user to restart AE / reload the panel to finish. Handle failure
GRACEFULLY: if self-install isn't reliable on the user's setup, fall back to opening the download/
install page or showing clear copy-paste install steps — never leave the plugin broken. (Note:
CEP self-update is finicky; prefer robust download+extract+restart-prompt, and a native-helper or
installer fallback if needed. Do not over-promise a seamless silent update.)

**Step 4 — Admin UI: publish a release.** In the admin panel, add a "Plugin releases" section:
upload the new extension package, set version + release notes + mandatory flag, and publish (calls
the Step 1 admin endpoint). Show the release history + current latest.

**Step 5 — Document the chain.** Write `docs/PLUGIN-UPDATE-CHAIN.md`: (a) config/models/tools =
server-driven, instant, no release; (b) plugin code = admin publishes a `PluginRelease` → users
see the in-panel notification → update in place. Include how to cut a release (build the package,
bump `ExtensionBundleVersion`, publish) and the version-check flow.

**Verification.** Backend: `npm run build -w apps/api`; the version endpoint returns latest;
admin publish works (owner-scoped). Plugin: `node --check`; simulate an older local version and
confirm the notification appears with notes + Update; verify the download + install path (or its
graceful fallback) and the AE-restart prompt; confirm a mandatory update blocks. Admin: the
release section publishes and lists releases. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Additive migration. Security: only install first-party,
user-initiated releases from our API (verify source + checksum); do NOT auto-execute untrusted
files. Plugin no CDN. Admin source = `admin/` (studio:sync). Minimal diff.

**When finished:** commit in logical chunks (release model + endpoints; plugin version-check +
notification; plugin updater; admin release UI; PLUGIN-UPDATE-CHAIN.md — clear messages, no
Co-Authored-By); do NOT push. Summary: the two-channel chain, the updater flow + its fallback, and
how the admin publishes a release.

**Model:** Fable 5 (+Extra) — backend release channel + plugin self-update + admin UI + docs.
(Opus 4.8 if you want extra care on the self-update/security path.)

---

## PROBLEM 12 — Prompt box should adapt to long prompts (auto-grow), web + plugin

**Context.** When the user writes a LONG prompt, the composer's prompt box stays small and the
text gets cramped/scrolled in a tiny area — the UX should adapt (the prompt box should grow /
get bigger) so long prompts are comfortable to read and edit. Both web and plugin. (Analyzed —
anchors below.)

**Exact anchors (analyzed):**
- Web `platform/index.html`: composer prompt textarea markup ~16431 `<textarea value="{{ aiPrompt
  }}" oninput="{{ setPrompt }}" class="prompt">`; CSS `.prompt` (line 15183): `min-height:40px;
  max-height:130px; resize:none` — NO auto-grow, capped at 130px so long prompts scroll in a tiny
  box. `setPrompt` is the input handler (~18336 `axPrompt`).
- Plugin `AssetFlow_Plugin.html`: gen prompt textareas `#igPrompt` (~4016) and `#vgPrompt`; the
  gen composer textarea CSS (~line 2738): `min-height:38px; max-height:150px; overflow-y:auto` —
  also small/no smooth auto-grow.

**Step 1 — Web: auto-grow the prompt box.** In the `setPrompt` input handler (and on
mount/prefill), resize the `.prompt` textarea to fit its content: set its height to
`scrollHeight` capped at a comfortable max, then scroll beyond that. Raise `.prompt`'s
`max-height` (e.g. ~130px → ~240px) so typical long prompts are fully visible. The bottom-docked
composer must grow UPWARD gracefully as the prompt grows (no overlap with the canvas / no layout
break); at narrow widths keep it usable.

**Step 2 — Plugin: same auto-grow.** For `#igPrompt` / `#vgPrompt` (and any other gen prompt
textarea), add the same auto-grow on input (height = scrollHeight, capped) and raise the
max-height to a comfortable value so long prompts aren't cramped. Keep the plugin's narrow-panel
layout intact (the composer expands within the panel, scrolls if needed).

**Step 3 — Verify.** Web (headless Chrome): paste a long multi-line prompt — the box grows to show
it (up to the cap) then scrolls; the composer/dock reflows without overlap at 1280 + 390. Plugin:
`node --check`; confirm the prompt textarea grows with content and the panel layout stays intact.
Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Purely UX/layout. Minimal diff. Web `platform/index.html`
direct source; plugin no CDN. Don't regress the composer's other controls or the generate flow.

**When finished:** commit (web; plugin — clear messages, no Co-Authored-By); do NOT push. Summary:
the auto-grow behavior + new max heights on both surfaces and how the dock reflows.

**Model:** Sonnet 5 — targeted auto-grow CSS/JS on both surfaces, exact anchors given.

---

## PROBLEM 13 — Generated download filename should come from the prompt (web + plugin)

**Context.** When a user downloads a generated video/image/audio/etc. (web or plugin), the file
is named generically like `frameflow-video (1).mp4`. It should instead be named from that
generation's PROMPT (sanitized + truncated), e.g. `A mesmerizing slow-motion video of coffee.mp4`.
Applies to all gen types. Backend + both surfaces. (Analyzed — anchors below.)

**Exact anchors (analyzed):**
- Backend: `apps/api/src/routes/studio-gen.ts:72` `genDownloadName(mode, resultKey, contentType)`
  returns `` `frameflow-${mode}.${ext}` `` (line 77). It's used in `hydrateGenAssets` (line 110) to
  sign the `downloadUrl` with `Content-Disposition` (attachment) — that name becomes the saved
  filename. `hydrateGenAssets` receives a `holder` (a Generation) with `mode` + `assets`; the
  Generation has `prompt`. `projects.ts` reuses `hydrateGenAssets` (keep it consistent).
- Web: `packages/assetflow-studio/platform/index.html:17780` builds a `frameflow-` client download
  name.
- Plugin: `plugins/after-effects-cep/AssetFlow_Plugin.html:1904` builds a `frameflow-` client
  download name.

**Step 1 — Backend: name from prompt.** Change `genDownloadName` to accept the generation's prompt
and produce a filename from it: take the first ~40-60 chars of the prompt, sanitize for the
filesystem (strip/replace unsafe chars, collapse whitespace, trim), and append the correct
extension. Fallback to `frameflow-<mode>.<ext>` when the prompt is empty. Pass the prompt into
`hydrateGenAssets` (from the Generation) so line 110 signs the `downloadUrl` with the new name.
Keep it consistent for `projects.ts`'s reuse.

**Step 2 — Web + plugin client names.** Update the web (`index.html:17780`) and plugin
(`AssetFlow_Plugin.html:1904`) client-side download filenames to use the same prompt-derived,
sanitized name (with the same fallback). If the client relies on the backend `downloadUrl`'s
Content-Disposition, ensure it uses that; otherwise apply the same sanitization client-side. Keep
one shared naming rule so web and plugin match.

**Step 3 — Verify.** Web (headless): download an image, a video, and an audio gen → each file is
named from its prompt (sanitized, correct extension), and a prompt-less gen falls back to
`frameflow-<mode>`. Plugin: `node --check`; confirm the plugin download uses the prompt-based
name. Run `npm run build -w apps/api`. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Sanitize safely (no path traversal, no invalid chars, cap
length). Minimal diff. Web `index.html` direct source; plugin no CDN.

**When finished:** commit in logical chunks (backend name; web; plugin — clear messages, no
Co-Authored-By); do NOT push. Summary: the new naming rule + fallback, and confirmation web +
plugin produce matching prompt-based filenames.

**Model:** Sonnet 5 — targeted filename logic across backend + both surfaces, exact anchors given.

---

## PROBLEM 14 — Email the admin when a NEW user signs up (web + plugin) — verify + fix the whole chain

**Context.** When a new user registers/joins via web OR plugin, the admin should get an email
notification. Today the admin is NOT notified on new signups. Add it and verify the full chain.
Backend only. (Analyzed — anchors below.)

**Exact anchors (analyzed):**
- Registration: `apps/api/src/routes/auth.ts` `/register` (~line 70-134) with `prisma.user.create`
  (~134). It already sends a WELCOME email to the new user (`sendEmail` ~54/424, `welcome`
  ~355/514) — so the email infra (Resend) works — but it does NOT notify the admin.
- Email infra: `apps/api/src/lib/notify.ts` has `notifyAdminNewSubmission` (~132-140) using
  `process.env.ADMIN_NOTIFY_EMAIL` + `sendEmail` + a `safe()` wrapper (fire-and-forget). Mirror
  this pattern. `apps/api/src/lib/email.ts` = `sendEmail`. Env `ADMIN_NOTIFY_EMAIL` + `RESEND_API_
  KEY` are set.
- Other new-user creation paths to check: Google OAuth first-login likely AUTO-CREATES a `User`
  (web + plugin device-code Google) — that's also a "new user" and must notify. The plugin has no
  `/plugin/register` (checked) — plugin users are created via the shared auth/OAuth path; verify
  where a `User` row is first created for a plugin sign-up.

**Step 1 — Add `notifyAdminNewUser`.** In `notify.ts`, add a `notifyAdminNewUser({ email, name?,
source })` function mirroring `notifyAdminNewSubmission`: if `ADMIN_NOTIFY_EMAIL` is unset →
no-op; otherwise send an email to the admin with the new user's email/name, the SOURCE (web /
plugin / google), and the timestamp. Fire-and-forget via `safe()` so it never blocks/breaks
signup.

**Step 2 — Call it at EVERY new-User creation site.** Find every place a `User` row is first
created — email/password register (`auth.ts` ~134), Google OAuth first-login auto-create (web
and plugin device-code), and any other path — and call `notifyAdminNewUser` there (only on
CREATE, not on returning-user login). Pass the correct `source`. Ensure it does not fire on
existing-user logins.

**Step 3 — Verify the chain.** Confirm: a fresh email/password signup on web → admin receives the
email; a first-time Google sign-in (web and plugin) that creates a user → admin receives the
email; an existing user logging in → NO email. Confirm `ADMIN_NOTIFY_EMAIL`/Resend are used and
the send is non-blocking (a mail failure must NOT break signup). `npm run build -w apps/api`. If
you can't send real mail in the harness, unit-test/log that `notifyAdminNewUser` is invoked with
the right args on each create path.

**Constraints.** Money-zone untouched. Additive. Non-blocking (safe wrapper) — signup must never
fail because of the admin email. Minimal diff. Don't duplicate the notify on repeat logins.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the new
`notifyAdminNewUser`, every creation site it was wired into (web register, Google first-login,
plugin), and the verified chain.

**Model:** Sonnet 5 — backend email-notify wiring across the user-creation paths, exact anchors.

---

## PROBLEM 15 — MOVED OUT → `docs/FIX-PROMPT-LANDING-CMS.md`

The Admin "Website / Landing" editor (CMS) was pulled into its OWN standalone prompt because it's
large and mostly self-contained. Run it separately: **`docs/FIX-PROMPT-LANDING-CMS.md`**. (Not
part of this MD's execution order.)

---

## PROBLEM 16 — Web ↔ plugin chain: make state SYNC, FAST, CONSISTENT, and ACCURATE (end-to-end)

**Context.** The user's cross-surface experience must be in sync, fast, consistent, and accurate —
right now it isn't (all four). Both surfaces read the SAME account (same DB) but state gets stale,
loads slowly, differs between surfaces, and credit/counts can be wrong. This is the INTEGRATION
pass that ties the surfaces together — it builds on the piece-fixes (plugin Sessions/Projects =
PROBLEM 1, card-action parity = PROBLEM 2, thumbnail speed = PROBLEM 4, per-model correctness =
PROBLEM 8). Do those first where relevant; this ensures the whole chain works together. (Analyzed.)

**Exact anchors (analyzed):**
- Shared source of truth (same for web + plugin): `/api/studio/credits` (credits + plan +
  storage), `/api/studio/gen/history`, `/api/studio/gen/sessions`, `/api/studio/projects` — all
  paginated (`take:`/`cursor` in `studio-gen.ts` ~238/447/456).
- Web refresh: `platform/index.html` has `setInterval` auto-refresh (~17252/17266), `loadHistory`
  (~16570/16624/17143), `pollJob` (~17274), and window `focus` handlers.
- Plugin refresh: `AssetFlow_Plugin.html` has `focus` handlers + a periodic auto-refresh.

**Dimension 1 — SYNC (refresh at the right moments).** Ensure state re-fetches immediately after
EVERY state-changing action on EITHER surface — gen complete, download, delete, top-up/credit
change, session create/rename/delete, project add/remove — not only on the interval. Also
re-fetch on window focus / panel show, so switching web ↔ plugin shows current state right away.
The goal: an action on one surface is reflected on the other by its next focus/refresh, with no
stale window.

**Dimension 1b — the top "sync" (↻) button must NEVER disappear (plugin).** In the plugin, the
top-bar sync/refresh (↻) button (the `.sync` element — CSS ~`AssetFlow_Plugin.html:1924`, markup
~372/1845/1906/2485/3762) currently gets hidden on some tools/views (conditional `display`). Make
it ALWAYS visible on EVERY tool/view (Home, Catalog, AI Studio, every gen tool, Sessions,
Projects, Account) so the user can always manually re-sync. Remove/neutralize the per-view hide
condition; keep it fixed in the header across all screens. (It should trigger the same
refresh-all used in Dimension 1.)

**Dimension 2 — ACCURACY (never show stale credit/counts).** After consume/refund/top-up and after
gen/delete, the credit balance, session counts, My Library count, and storage must reflect the
true current values on BOTH surfaces. Use the loading flags (no hard "✦0" flash), and re-pull
`/credits` + the relevant list after each action. Do NOT change credit MATH (money-zone) — only
the fetch/refresh/display timing.

**Dimension 3 — SPEED.** Keep it fast: sensible poll intervals (not hammering), paginated list
loads, thumbnails from PROBLEM 4 (small images), and avoid redundant/duplicate fetches (dedupe
in-flight requests; don't re-fetch unchanged data). Confirm no N+1 on the history/sessions/
projects endpoints (they already paginate — verify). AI Studio, My Library, and history should
open quickly on both surfaces.

**Dimension 4 — CONSISTENCY.** Both surfaces must render the SAME state from the SAME endpoints and
behave the same (this relies on PROBLEMs 1/2 making the plugin match the web). Audit for any
place where web and plugin diverge in what they show/do for the same account, and reconcile.

**Verification (end-to-end journey, both surfaces).** Simulate/verify: generate on web → it
appears in the plugin's Library after refresh/focus; top up credits on web → plugin credit pill
updates on focus; delete a gen/session on the plugin → web reflects it; credit/count values match
on both after each action; AI Studio/Library load quickly (small thumbs). Web: headless Chrome.
Plugin: `node --check` + describe the refresh points wired. Confirm money-zone (credit math)
unchanged. `npm run build -w apps/api`.

**Constraints.** Money-zone untouched (refresh/display timing only, no credit math change).
Additive. Don't over-poll (battery/API load). Minimal diff. Web `platform/index.html` direct
source; plugin no CDN, reinstall via `install-cep.sh`.

**When finished:** commit in logical chunks (refresh-on-action; refresh-on-focus; speed/dedupe;
consistency reconcile — clear messages, no Co-Authored-By); do NOT push. Summary: the refresh
points added on each surface, the accuracy/speed improvements, and the verified end-to-end
journey.

**Model:** Fable 5 (+Extra) — cross-surface state/sync integration across both codebases.

---

## PROBLEM 17 — Plugin: redesign the toast/notification (compact, clean, well-placed — not the ugly bottom one)

**Context.** The plugin's toast (e.g. "Could not get frame: No active composition — open a comp in
the Timeline") shows up ugly at the bottom-center, wide and clunky in the narrow panel. Move it
to a spot the user clearly sees WITHOUT it blocking content (not the bottom), and make the toast
itself compact, tidy, and nicely designed. Plugin only. (Analyzed — anchors below.)

**Exact anchors (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- Toast CSS `.toast` (~1758-1770): `position:fixed; bottom:28px; left:50%; transform:
  translateX(-50%)…; max-width:min(420px,86vw); text-align:center` — bottom-center, wide.
- `.toast.t-success` (~1773-1781) is ALREADY a nice compact card (width min(340px,86vw),
  left-aligned, radius 10, subtle border, icon + msg + optional mono elapsed). The error/warning/
  info variants (~1782-1784) only re-tint the left border — so non-success toasts stay clunky.
- Toast logic: `toast()` / `showToast` (~3677/4344).

**Step 1 — Reposition.** Move the toast OUT of the bottom-center (where it covers the Generate
button / bottom content). Place it where the user clearly sees it but it doesn't obstruct — e.g.
anchored at the TOP just under the plugin header (top-center or top-right), compact, with a
gentle slide-in. Keep it above the lightbox (z-index preserved).

**Step 2 — Compact + clean design for ALL types.** Apply the nice compact card style (like
`t-success`) to error / warning / info too — a small rounded card (~300-340px, narrow-panel
friendly), with a per-type icon + accent color (error=red, warning=amber, info=accent,
success=lime), a concise message, and auto-dismiss (with the existing elapsed/optional detail).
Consistent, on-brand (dark + lime), local fonts, inline SVG (no CDN). It must read cleanly at the
plugin's narrow width and wrap long messages tidily.

**Step 3 — Verify.** `node --check`; trigger a success, an error (e.g. the "No active composition"
warning), an info toast → each appears in the new position, compact and clean, without covering
the composer/Generate button, and auto-dismisses. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff (mostly `.toast` CSS +
the per-type variants; keep the `toast()`/`showToast` API the same so call sites don't change).

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the new
position and the unified compact toast design across all types.

**Model:** Sonnet 5 — targeted plugin toast CSS/position redesign, exact anchors given.

---

> ─────────────────────────────────────────────────────────────────────
> ## NEW BATCH (2026-07-09, post-completion) — do PROBLEM 18 FIRST (money bug)
> ─────────────────────────────────────────────────────────────────────

## PROBLEM 18 — 🔴 CRITICAL: credits NOT refunded when a generation fails (money-zone)

**Context.** A user tried to generate VIDEO; it failed TWICE, but credits were deducted and NOT
returned. The composer promises "credits refunded on error", so this is a real money bug — every
genuine failure MUST refund the user, reliably and promptly. Backend. ⚠️ MONEY-ZONE: this fixes
the refund TRIGGER; do NOT change credit AMOUNTS, the consume logic, or cost-quote — only make
the refund actually FIRE on failure (idempotent, no double-refund). Verify rigorously.

**Exact anchors (analyzed) — `apps/api/src/lib/gen-processor.ts`:**
- Real error → `fail()` sets `status="failed"` + `refundAiCredits` (~lines 828-831, 1104-1106).
- TIMEOUT sentinels (FAL_TIMEOUT/MAGNIFIC_TIMEOUT) → gen stays `"running"` and is NOT refunded
  immediately; `reconcileStuckGenerations` is meant to refund it later (~lines 985-987, 823-838).
- `reconcileStuckGenerations` runs on the `/credits` fetch (`studio-gen.ts:319`) — i.e. only when
  the panel/credits are polled, and only after ~10 min.
- `refundAiCredits` lives in `apps/api/src/lib/plugin-profile.ts` (money-zone — call it, don't
  change it).

**Step 1 — Diagnose the exact failure mode.** For the user's failed VIDEO gens (Veo/Omni/
Seedance), determine what actually happened: did they end as `status="failed"` (should refund via
fail()) or get stuck `"running"` on a TIMEOUT (refund only via delayed reconcile)? Check whether
`refundAiCredits` was called and whether the `refunded` flag was set. Query the DB for this
user's recent failed/stuck generations and their refund state. Report the root cause before
fixing (e.g. reconcile never ran because the panel wasn't re-polled; or a real-error path missed
the refund; or a double-consume).

**Step 2 — Make failure refunds reliable + prompt.** Ensure EVERY genuine failure refunds the
exact consumed amount, idempotently (guarded by the `refunded` flag so it never double-refunds):
(a) the `fail()` path must always refund; (b) for timeouts that truly failed, make reconcile
robust — run it on a SCHEDULE / background (not only on panel-open) so stuck gens auto-refund
within a bounded time even if the user never re-opens the panel. (A provider webhook or a
periodic job — whichever fits the existing infra.)

**Step 3 — Refund the already-lost credits.** For existing generations that are failed/stuck,
consumed but NOT refunded, run a one-time idempotent reconcile/backfill (reuse the existing
reconcile or an admin maintenance endpoint) so affected users — including this one — get their
credits back. Log what was refunded.

**Step 4 — Verify (money-zone rigor).** Force a generation to FAIL (mock a provider error) →
confirm the exact credits are refunded once (balance returns), the gen shows `failed`, and a
second reconcile does NOT double-refund. Confirm a SUCCESSFUL gen does not refund. Confirm a
timeout path gets reconciled+refunded within the bounded window. Diff the money-zone files
(`gen-quote.ts`, `computeGenCost`, `consumeAiCredits`) to prove they're byte-for-byte unchanged;
only the refund TRIGGER/scheduling changed. `npm run build -w apps/api`.

**When finished:** commit in logical chunks (diagnosis note; reliable-refund + scheduled
reconcile; backfill — clear messages, no Co-Authored-By); do NOT push. Summary: the root cause,
how refunds are now guaranteed, the backfill result, and proof the money math is unchanged.

**Model:** Opus 4.8 — money-zone critical; maximum care + idempotency.

---

## PROBLEM 19 — Admin: per-user generation activity (see everything a user generated, incl. failures)

**Context.** In the admin console, when opening a user/subscriber, the admin should see ALL of
that user's AI generations — what they made, each gen's status (done / FAILED / running), whether
it was refunded, cost, prompt, and the generated media (thumbnails/preview). Read-only admin
view. Backend + admin UI. (Analyzed — anchors below.)

**Exact anchors (analyzed):**
- Admin user detail endpoint: `apps/api/src/routes/admin.ts` `/admin/users/:id` (~1098/1149);
  "Gen spend" section exists (~697) — extend or add a per-user generations endpoint.
- `Generation` model (userId, mode, modelId, status, prompt, cost, refunded, createdAt) +
  `genAsset` (url/thumbUrl) — reuse `hydrateGenAssets` (exported from studio-gen.ts) to sign media.
- Admin UI: `packages/assetflow-studio/admin/` (the subscriber/user detail view) + `js/`.

**Step 1 — Backend: per-user generations endpoint.** Add `GET /api/admin/users/:id/generations`
(admin-guarded, paginated) returning the user's generations with: id, createdAt, mode, model,
status (done/failed/running), refunded (bool), cost (credits), prompt, and signed asset
thumb/url (via `hydrateGenAssets`). Include a small summary (total gens, # failed, # refunded,
total credits spent vs refunded).

**Step 2 — Admin UI: Generations tab in the user detail.** In the subscriber/user detail view,
add a "Generations" section/tab: a list with status badges (green done / red FAILED / amber
running), refund indicator, cost, prompt (truncated), timestamp, and the generated media
thumbnail (click → preview). Show the summary counts at the top. Paginate/scroll for many.

**Step 3 — Verify.** Admin (headless): open a user with generations (incl. a failed one) → the
Generations tab lists them with correct status, refund state, cost, and media thumbnails; failed
gens are clearly marked; summary counts are right. `npm run build -w apps/api`. Admin source =
`admin/` + `js/` (studio:sync; ensure the cache-bust from the site-CMS work covers new admin js).

**Constraints.** Read-only (no mutation of user data). Money-zone untouched. Additive. Reuse
`hydrateGenAssets` + existing admin patterns. Minimal diff.

**When finished:** commit (backend endpoint; admin UI — clear messages, no Co-Authored-By); do
NOT push. Summary: the endpoint shape and the admin Generations view.

**Model:** Fable 5 (+Extra) — backend endpoint + admin detail UI (Sonnet 5 acceptable if scoped).
