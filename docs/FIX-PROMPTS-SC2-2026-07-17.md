# FIX-PROMPTS-SC2 — Round 2 (owner dictation, 2026-07-17)

Continuation of `docs/FIX-PROMPTS-SC-2026-07-16.md` (round 1, SC_01–SC_24, all done).
Numbering continues at SC_25. Problems are appended as reported; final ordering happens
after the round ends. Round-1 state is LANDED in the working tree — prompts here build
on that code.

---

## GLOBAL RULES (apply to EVERY prompt below)

- **MONEY ZONE IS BYTE-FOR-BYTE FROZEN:** credit consume/refund, signed cost-quote and
  HMAC (`apps/api/src/lib/gen-quote.ts`, `gen-models.ts` cost functions,
  `plugin-profile.ts`), webhook idempotency, every credit VALUE and price display value.
  If a change would touch these → STOP and flag in the summary.
- **Migrations additive only.** **English UI; Uzbek code comments.**
- **Studio source rule:** edit ROOT `packages/assetflow-studio/js|styles` (+ admin/,
  contributor/ source) then `npm run studio:sync`; `platform/index.html` = direct CF
  Pages source. NEVER edit `studio/`, `admin/` artifacts. Landing (`ffl-`) off-limits.
- **Plugin:** `plugins/after-effects-cep/AssetFlow_Plugin.html` (~1MB, 7 inline
  scripts): validate with `node --check` extraction; keep ids/handlers bound; after
  edits run `bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 CSS themes
  (noir/neon/cold) via var(--…) tokens — no hardcoded colors.
- **Default scope: check BOTH plugin and web** (`platform/index.html`) unless the
  problem says otherwise.
- **Minimal, narrow diff.** Each prompt self-contained (`/clear` between runs).
- **When finished:** (a) commit with a clear concise message (no Co-Authored-By); do
  NOT push. (b) write a short summary.

---

## SC_25 — Narrow plugin panel breaks the UX (responsive collapse audit + fix)

**Problem (owner report + narrow-panel screenshot, ~560px and below).** When the panel
is narrowed, the UX falls apart. Visible in the screenshot:
- Top bar: the credit chip (✦ 380 PRO) is CLIPPED/overlapped by the neighboring
  control; elements collide instead of compacting.
- Workspace toolbar row: too many icons cramped; an avatar appears BOTH in the top bar
  and again in the workspace toolbar row (duplicate).
- Audio gen cards: the "Use ▾" button OVERLAPS the card's title text ("A ci…", "Eme…" —
  title rendered under the button).
- Composer: chips stack into many rows (mode/model row, out/audio row, Enhance/Clear
  row, Generate row) eating huge vertical space; spacing collapses unevenly.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Primary
target: plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline
scripts; validate edited inline scripts via node --check; keep ids/handlers bound;
after edits run `bash plugins/after-effects-cep/scripts/install-cep.sh`. Secondary:
packages/assetflow-studio/platform/index.html (web ~390px mobile — verify the shared
patterns; fix if the same defect exists). 3 CSS themes via var(--…) tokens. Money
guard: credit/cost values and their visibility must survive at every width.

GOAL: the plugin must remain clean and usable at NARROW panel widths. AE users dock
panels at 300-500px routinely. Fix the reported breakages and sweep for siblings.

REPORTED BREAKAGES (reproduce at ~560px, ~420px, ~320px):
1. TOP BAR collision: the credit chip gets clipped/overlapped by the adjacent control.
   The top bar (logo · seg Home/AI/Stock · credit chip · avatar) must degrade
   gracefully: seg labels already shorten at narrow widths; ensure the credit chip
   NEVER clips (it may compact to "✦380" without the PRO pill below ~380px; plan pill
   returns at wider sizes) and nothing overlaps. Use flex min-width/shrink rules, not
   absolute positioning.
2. DUPLICATE AVATAR: the workspace toolbar row shows its own avatar while the top bar
   already has one. Remove the workspace-row avatar (top-bar avatar is canonical —
   verify its Account-sheet handler still covers the flows the removed one had).
3. WORKSPACE TOOLBAR overflow: the row (back · Visuals/Audio filter · expand · refresh
   · grid-toggle · settings) must fit 320px: icon-only buttons at fixed 28-32px, tighter
   gaps, and if still overflowing, the least-used controls collapse into a single "⋯"
   overflow menu (reuse an existing popover/menu mechanism — do not build a new one).
4. AUDIO CARD overlap: the Use ▾ button sits ON TOP of the title text. Fix the audio
   card's internal layout so title/meta and the Use button never overlap at any card
   width (button in a fixed corner with the text area padded around it, or button in a
   footer row — follow the audio-card design introduced in round 1, SC_16).
5. COMPOSER stacking: at narrow widths the chips currently wrap into 4+ loose rows.
   Define an intentional narrow layout: row 1 = textarea; row 2 = mode + model + out
   (compact/icon forms per the round-1 chip rules); row 3 = Enhance · Clear · Generate
   (Generate full-width-right, never clipped, cost tag visible). Max 3 control rows at
   320px, tight consistent gaps; the "≈ 1-2 min · credits refunded on error" line stays
   one quiet line.

SWEEP: after fixing the reported five, walk every logged-in surface at 320/420/560
(Home, Catalog grid+detail, My Library, session picker, workspace incl. video mode
frames row, Account sheet) and fix any other overlap/clip/overflow you find — list
each finding → fix in the summary table. CSS-first; JS only where a container must
change; NO behaviour changes.

QA: matrix 320/420/560 × 3 themes × the surfaces above — zero overlaps/clips (screenshot
or DOM-measure the previously broken spots: credit chip box vs neighbor, audio card
title vs Use button); node --check; install-cep.sh; web ~390px spot-check; console
clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Fable 5 (Medium). Responsive sweep across every plugin surface.

---

## SC_26 — Plugin does not use the actual panel size — content renders smaller than
## the panel (narrow centered island on wide panels)

**Problem (owner report + wide-panel screenshot, ~2460px).** With the panel opened
LARGE, the plugin UI does not scale to it: the workspace (session header, feed,
composer) sits as a narrow centered column (~900px) with huge dead black margins on
both sides. The plugin must render at the panel's real size — whatever size the user
opens, the UI fills it.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target:
plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
node --check validation; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 CSS themes via var(--…)
tokens. Money guard: cost/credit displays unchanged.

PROBLEM: on large panels (1200-2500px wide) the gen workspace renders as a narrow
centered island (~900px max-width) with massive dead margins; other views may share the
same cap. AE users run the panel full-screen on wide monitors — the UI must scale.

INVESTIGATE: find the width constraints (max-width/fixed width on the workspace
container, feed, composer, session header — grep the .axws / workspace containers and
any global content max-width). Map which views are capped: gen workspace, Home,
Catalog, My Library, session picker, detail.

FIX — full-panel layout policy (all logged-in views):
1. Containers stretch to the panel width with sane CONTENT behavior (no 2500px text
   lines): the container fills; inner content scales by adding COLUMNS/density, not by
   stretching single elements absurdly:
   - Feed/grids (workspace results, My Library, catalog, home shelf): auto-fill
     columns keep working up to wide panels (4-6+ columns at 1600-2500px with the
     established min card widths). Verify the round-1 grid rules extend rather than cap.
   - Composer: grows with the panel up to a comfortable max (~1100-1200px) and stays
     CENTERED relative to the feed area at ultra-wide — a composer wider than that
     harms typing UX; this is the ONE element allowed a max-width. Frames row scales
     with it.
   - Session header row: full width, controls pinned to its edges (no floating island).
   - Home hero/sections: already full-height design from round 1 — verify hero and
     sections use the full width at 1200-2500px (hero media scales, grids add columns).
2. Remove dead side margins: page padding stays modest (16-24px), everything else is
   usable space.
3. Nothing may OVERLAP or stretch broken at ultra-wide (media keeps aspect; buttons
   keep natural size).

QA: widths 900/1200/1600/2200/2500 × heights 620/900/1200 × 3 themes across: gen
workspace (feed columns grow, composer capped-centered, header edge-pinned), Home,
Catalog, My Library, session picker, template detail — no dead side voids beyond
padding, no stretched/distorted elements; then narrow sanity 320/420 (must not regress
the narrow-panel work); node --check; install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary listing each view's old cap → new behavior.
```

**Model:** Fable 5 (Medium). Layout-system change across all views; regression risk at
both extremes.

---

## SC_27 — Plugin composer = web composer (full functional parity) + PER-MODEL UX:
## every model's own controls, 100% correct payloads to the API

**Problem (owner report + frames-pane screenshot).**
1. The plugin's composer works poorly functionally — it must be made IDENTICAL in
   behaviour to the web composer (same capabilities, same flows).
2. CRITICAL: every AI model has its OWN distinct features — they are not alike. ALL
   models must be checked one by one, each model gets its own correct UX (only the
   controls that model supports), and it must work 100%: the data sent to the API must
   be exactly right for each model.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   node --check; keep ids/handlers bound; after edits run
   `bash plugins/after-effects-cep/scripts/install-cep.sh`.
2. packages/assetflow-studio/platform/index.html — web composer is the REFERENCE
   implementation; only touch it where a per-model bug exists there too.
3. READ-ONLY truth sources for model capabilities (do NOT re-research the internet):
   apps/api/src/lib/gen-models.ts (the catalog: modes, params, caps) ·
   docs/GEN-MODEL-MATRIX.md · docs/BYTEPLUS-DOCS-MODELS.md · docs/FAL-DOCS-MODELS.md ·
   apps/api/src/routes/studio-gen.ts (what POST /gen and /gen/cost-quote actually
   accept/validate per model).

🔴 MONEY GUARD: no changes to gen-quote/cost functions, credit values, consume/refund.
Correct PAYLOADS are the goal; pricing code is untouchable.

PART A — composer functional parity (plugin ← web):
Inventory the WEB composer's full behaviour: reference add ([+], drag&drop, paste),
@ mention pills + rewriting, start/end frame slots, mode switch, model picker, output
(aspect/resolution/duration) controls, AUDIO toggle, Enhance, Clear, undo (⌘Z),
disabled-Generate-when-insufficient-credits, in-flight state. Then bring the PLUGIN
composer to the SAME functional set — reuse the plugin's existing implementations where
they exist and fix/port what is missing or broken. List web-capability → plugin-status
(had it / fixed / ported) in the summary. CEP constraints apply (no external network;
file pickers must use the plugin's existing file/bridge mechanisms — check how
references are added today in the plugin).

PART B — per-model UX driven by the capability matrix:
1. Build ONE client-side capability map derived from the model catalog response
   (GET /api/studio/gen/models) — the API already exposes per-model params/caps (check
   the exact shape in studio-gen.ts / gen-models.ts; if a needed cap is in the catalog
   file but not in the API response, extend the API RESPONSE only — additive field, no
   pricing changes). Cross-check each model against docs/GEN-MODEL-MATRIX.md +
   provider docs above. Capabilities include (per model): supports start frame / end
   frame / both · reference image count limits · aspect ratios list · resolutions ·
   durations · audio on/off support · edit/inpaint presets · negative prompt · seed —
   whatever the catalog + backend validation actually support.
2. Composer controls RENDER FROM THE MAP for the selected model, both apps: unsupported
   controls are hidden (not disabled-noise); switching models re-renders controls and
   drops now-invalid values with a small transient notice (reuse the round-1 composer
   notice pill); defaults come from the catalog.
3. PAYLOAD CORRECTNESS: for each model, the request built for /gen/cost-quote and
   POST /gen must contain exactly the fields that model accepts (correct names/enums
   per the backend validation — the backend is the source of truth; where backend and
   docs disagree, follow the backend and note it). No silently dropped user choices:
   if the user set something, it is either sent or visibly invalid.
4. VERIFICATION — per enabled model (this is the owner's "100%" requirement):
   - Automated: write a standalone node script (scripts/ or apps/api/scripts/) that
     pulls the live local catalog and, for EVERY enabled model, builds a representative
     payload via the same client logic rules and calls /gen/cost-quote against the
     LOCAL dev API — expect 200 (or documented 4xx for intentionally invalid combos).
     Print a model-by-model PASS/FAIL table; include it in the summary.
   - Manual/live: one real cheap generation per MODE (image/video/audio) through the
     plugin in cep-mode emulation against the local API to prove the full path.
5. If any model's backend validation rejects what the catalog/docs claim it supports —
   do NOT hack the client around it; record it in the summary table as a backend
   finding (owner decides later).

QA: model-switch matrix in both apps (every enabled model per mode: controls match the
map, tooltips/values readable, cost tag updates); parity checklist from PART A all
green in the plugin; verification table all-PASS or explained; 3 themes; plugin
320/420/900 widths; node --check; install-cep.sh; web console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary with BOTH tables (parity + per-model verification).
```

**Model:** Fable 5 (High / Extra). The deepest task of the round — capability matrix +
payload correctness across every model.

---

## SC_28 — Sessions & Projects are clutter in the top bar — move them into the Account
## sheet

**Problem (owner report + screenshots).** The top bar now carries "Sessions" and
"Projects" buttons next to the seg — the owner says these two are EXCESS there. They
must be moved into the Account sheet (the avatar panel). Top bar keeps only: logo · seg
(Home · AI Tools · Stock Catalog) · refresh · credit chip · avatar.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (node --check; install-cep.sh after
edits) and packages/assetflow-studio/platform/index.html (web) — apply in BOTH if both
have the top-bar Sessions/Projects entries (they were added in a recent task; grep the
top bar for Sessions/Projects buttons). 3 themes via var(--…) tokens.

CHANGE:
1. REMOVE the Sessions and Projects buttons from the top bar (markup+CSS+their wiring
   there). The top bar keeps: logo · centered seg (Home · AI Tools · Stock Catalog) ·
   right cluster (refresh · credit chip · avatar). Center stability rule from the
   earlier top-bar work must hold after removal (seg stays pixel-centered).
2. ADD compact entries INSIDE the Account sheet: a small "WORKSPACE" group above the
   plan section with two rows — "Sessions" (list icon) and "Projects" (folder icon) —
   navigating to the SAME existing views the top-bar buttons used (reuse the exact
   handlers), then closing the sheet. Follow the Account sheet's existing compact row
   style (post-compact-pass look); English labels.
3. The views themselves and every other route to them (e.g. the in-tool session picker)
   stay untouched.

QA: both apps — top bar clean (no Sessions/Projects), seg still pixel-centered at
320/420/900 and web widths; Account sheet → Sessions and → Projects both navigate
correctly and close the sheet; 3 themes; node --check; install-cep.sh; web console
clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Sonnet 5. Small navigation relocation with existing handlers.

---

## SC_29 — Sessions are functionally broken: New session does nothing, every session
## shows the SAME feed, Visuals/Audio filter leaks audio into Visuals

**Problem (owner report + screenshots).**
1. "+ New session" does not work at all (no new session created / not entered).
2. Opening DIFFERENT sessions from the picker shows the IDENTICAL set of gen cards —
   the feed is not scoped to the selected session (a session named "New session · Jul
   16 · 1 generation" opens with 12 generations visible).
3. The workspace filter says "Visuals 12 / Audio 0" with Visuals active — yet AUDIO
   cards (SFX/VOICE) are visibly present in the feed, and the Audio count is 0 despite
   audio items existing. Filter and counts are wrong.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Primary
target: plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline
scripts; node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. Check the web
(packages/assetflow-studio/platform/index.html) for the same three defects and fix
there too if present. Backend is read-only context: apps/api/src/routes/studio-gen.ts
(sessions + history endpoints — check what session scoping the API supports, e.g.
sessionId filter on /gen/history and session create response shape).

THREE BUGS — find root causes, then fix:

1. "+ New session" dead: trace the button handler in the session picker → does it call
   the session-create path (POST /api/studio/gen/sessions or local create)? Typical
   suspects: handler not bound after the picker was introduced, create succeeding but
   navigation into the workspace missing, or response shape mismatch. Fix so: click →
   session created → workspace opens EMPTY (0 generations) with the new session
   active → generating writes into THAT session.

2. Feed not session-scoped: the workspace feed apparently renders the global history
   regardless of the chosen session. Find how the feed queries items (history fetch +
   render) and scope it to the ACTIVE session: if the API supports a sessionId filter,
   use it; otherwise filter client-side by the item's session field (check the history
   item payload for sessionId — if items carry none, investigate how sessions associate
   items server-side in studio-gen.ts and use that key). Session meta (name, count in
   the header "image · N generations") must reflect the ACTIVE session, not the global
   total. Picker counts ("1 generations") and the opened feed must agree.

3. Visuals/Audio filter + counts: the toggle shows counts from one list while the feed
   renders another. Fix both: counts computed from the ACTIVE session's items by kind
   (visual = image+video; audio = voice+sfx+music), and the active filter actually
   filters the feed (Visuals → no audio cards; Audio → only audio). Investigate why
   audio items were counted 0 (kind field mismatch — check the item payload's
   type/kind values against the filter's expectations; the same mismatch probably
   explains audio leaking through the Visuals filter).

Regression guard: generating from the workspace must append to the active session and
update counts live; the background-completion path (toast → View) must land in the
correct session; My Library (all items) remains unscoped.

QA (plugin, cep-mode emulation with local API + seed user): create session A → empty
feed → generate/mock 1 image → count 1; open session B → only B's items; picker counts
match opened feeds; audio items → Audio tab only, counts correct; "+ New session"
twice in a row works; web spot-check of all three; 3 themes; node --check;
install-cep.sh; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary with the three root causes.
```

**Model:** Fable 5 (High). Data-scoping bugs — root-cause work, not styling.

---

## SC_30 — Use ▾ menu: EVERY action must be verified working and fixed (Import to AE,
## Add to project, Add to Explore, Use as reference, Regenerate, Copy prompt, Delete)

**Problem (owner report + menu screenshot).** The gen-card Use ▾ menu now carries the
full action set — but the owner wants every single action VERIFIED end-to-end and fixed
where broken, in the plugin and the web equivalents.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (node --check; install-cep.sh after
edits) and packages/assetflow-studio/platform/index.html (web menu has: Edit image,
Generate video from image, Add to project, Add to Explore, Download, Regenerate, Copy
prompt, Delete). Backend read-only context: apps/api/src/routes/studio-gen.ts,
projects.ts (what delete/project/explore endpoints exist and expect). Local dev stack
for live verification (npm run studio / API :4000, seed user). 🔴 Money guard: no
credit/pricing logic changes; Regenerate must reuse the EXISTING regenerate path
(which quotes/charges as designed) — do not alter its cost behaviour.

TASK: for EACH menu action, per media kind (image / video / audio), in BOTH apps:
trace handler → verify against the local API → fix what is broken → prove it.

Plugin menu actions and expected behaviour:
1. Import to AE — runs the existing import path (disk bridge/ExtendScript). In cep-mode
   emulation the AE call can't complete: verify to the LAST verifiable step (file
   downloaded to the download folder, ExtendScript invocation attempted with correct
   args) and mark "needs live AE confirm" in the report; the download+args part must
   work for image, video AND audio kinds.
2. Add to project — project picker/add flow completes; item appears in the project
   (verify via projects API/view); works for all kinds.
3. Add to Explore — the existing explore-submission path (admin-moderated); verify the
   API call succeeds and the pending state is reflected (button/toast), no duplicate
   submissions on double-click.
4. Use as reference — inserts the item into the composer as a reference (correct
   composer mode: image→image refs; video/audio only if the composer supports them as
   refs — if unsupported for a kind, the menu must NOT show the action for that kind).
   Verify the reference pill appears and the payload includes it.
5. Regenerate — reopens/re-runs with the same prompt+settings via the existing path;
   verify a new job starts (mock/cheap live) and lands in the same session.
6. Copy prompt — clipboard contains the FULL original prompt (CEP clipboard API — test
   in cep-mode; web: navigator.clipboard with fallback); toast confirms.
7. Delete — confirm step exists, item deleted via API, disappears from feed AND My
   Library, counts update; storage meta (Account "STORAGE — AI RESULTS") reflects it
   after refresh.
Web: same sweep for its menu items (incl. Edit image / Generate video from image —
must land in the correct tool with the item preloaded; Download — file downloads).

RULES: broken action → fix at the root (handler, payload, endpoint mismatch), do not
hide. Action impossible for a kind → menu hides it for that kind (no dead items). No
new endpoints; if a backend gap blocks an action, report it instead of hacking.

DELIVERABLE: a verification matrix in the summary — rows = actions, columns = kinds ×
(plugin/web), each cell PASS / FIXED(root cause) / N-A(hidden) / BLOCKED(backend gap).

QA: run the matrix live against the local stack; double-click/spam-click safety on all
actions; menu closes after action; 3 themes spot-check; node --check; install-cep.sh;
web console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary with the matrix.
```

**Model:** Fable 5 (High). Seven actions × three kinds × two apps — verification-heavy.

---

## SC_31 — Stock template detail: broken UX, content huddles at the top — must FILL the
## opened panel

**Problem (owner report + tall-panel screenshot, ~2550×2556).** Opening a template from
the Stock catalog shows a broken layout: the two-column detail (media + info) occupies
only the TOP band of the panel; below it is a massive empty black void (~70% of the
panel). Like the rest of the plugin, the detail must fill the panel it is opened in.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target:
plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. Check the web template detail
(packages/assetflow-studio/platform/index.html) for the same defect at tall viewports;
fix with the same approach if present. 3 themes via var(--…) tokens.

PROBLEM: the template detail view uses a two-column layout (media left, info right)
that is TOP-ANCHORED with intrinsic heights — on tall panels ~70% of the vertical space
below is dead black. The detail must compose to the panel height like the Home surface
does (full-height policy).

FIX — full-height detail composition:
1. The detail container becomes a min-height:100% column (inside its existing scroll
   context — short panels still scroll).
2. Media scales UP with available height: the preview area may grow (16:9 kept, capped
   by width) so the player is large on big panels; the play overlay and duration badge
   scale sanely.
3. The info column (title, meta, tags, description, Import + actions) gets vertical
   breathing room via the spacing scale — NOT stretched text; the Import block stays
   visually anchored near the media (top-aligned info is fine when the column is
   shorter than the media).
4. "Similar templates" becomes the height sink: on tall panels it expands from a single
   strip into a multi-row grid (reuse the catalog's card grid recipe and card size) so
   the remaining space fills with useful content; short panels keep the single strip.
5. Bottom padding modest (24-32px) — no dominant void at any size.

QA: detail at 900/1200/2500 widths × 620/900/1400/2500 heights × 3 themes — media
large, similar-grid fills tall panels, void ≤ ~10% of panel height with ≥4 similar
items; narrow 320-420px single-column detail unaffected; import/play/favorite handlers
intact; node --check; install-cep.sh; web tall-viewport spot-check; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Sonnet 5. Scoped full-height layout fix following the established policy.

---

## SC_32 — Plugin CMS "doesn't work" — diagnose and fix the FULL chain (editor → save →
## media → public config → plugin apply)

**Problem (owner report + admin screenshot).** The owner reports the Plugin CMS is not
working. Symptoms visible/likely: the Home hero BACKGROUND MEDIA preview in the admin
editor renders as a BROKEN image (classic CDN 403 symptom — the Cloudflare worker
allowlist redeploy is an owner deploy step that may not have happened yet); beyond
that, edits may not be reaching the plugin. The whole chain must be verified and every
code bug fixed.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Scope:
packages/assetflow-studio/js/admin-plugin-cms.js (+ its admin view registration; edit
ROOT source then `npm run studio:sync`) · apps/api (plugin-content-config lib/routes,
admin upload-url, public-keys) · plugins/after-effects-cep/AssetFlow_Plugin.html (CMS
loader/applier; node --check; install-cep.sh after edits). Local stack: npm run studio
(API :4000, admin :3001) + seed admin (admin@assetflow.uz/admin123). Money guard: none
of this touches credit logic — keep it that way.

GOAL: the owner says "Plugin CMS doesn't work". Diagnose the ENTIRE chain link by link
against the local stack, fix every CODE defect found, and clearly separate DEPLOY
issues (owner actions) from code bugs in the summary.

CHAIN CHECKS (in order):
1. EDITOR LOAD: admin → Plugin CMS view loads GET /api/admin/plugin-content-config
   (config+defaults render into the form)?
2. SAVE: edit a text field → Save & publish → PUT succeeds (200, audit row) → GET
   returns the saved value → RELOAD the editor shows it (no silent revert)? Check the
   editor sends the section-level partial correctly (zod rejections surfaced to the
   admin as visible errors, not silent failures).
3. MEDIA UPLOAD: Upload media → POST /api/admin/upload-url (folder site/plugin,
   contentType allowed) → presigned PUT → publicUrl stored in config → PREVIEW renders.
   The screenshot shows a BROKEN preview image: reproduce locally. Distinguish:
   (a) locally S3 not configured → mock mode: the editor must handle mock/missing
       storage gracefully (clear "storage not configured" note, not a broken img);
   (b) in prod the URL 403s because the CDN worker was not redeployed with the new
       allowlist — VERIFY isPublicReadKey('site/plugin/<ts>-x.jpg') returns true in
       the current code, and state clearly in the summary that the worker redeploy
       (wrangler deploy in workers/cdn-proxy) is a pending OWNER step if so;
   (c) an actual key/URL construction bug in the editor or upload route — fix it.
   Also: broken preview must show a fallback state (icon + "media unreachable") rather
   than a raw broken <img>.
4. PUBLIC CONFIG: GET /api/plugin/content-config returns the saved config (merged,
   60s cache) — curl it after a save.
5. PLUGIN APPLY: with the local API, the plugin (browser cep-mode) picks up the change
   on boot and within the 5-min refresh; text fields apply; hero media applies with
   the mediaMode rules; broken media URL degrades gracefully (no broken art).
6. RESET: Reset to defaults works and the plugin returns to built-in copy.

FIX every code defect found at its root. Do NOT paper over a deploy gap in code —
report it. If everything in code is correct and the failures are purely
deploy/environment (worker not redeployed, prod migration not run, S3 envs), say
exactly that with the owner's action list.

QA: full happy path on the local stack recorded step-by-step in the summary (edit →
save → curl public → plugin shows it), plus the failure-mode handling (mock storage,
broken media URL, zod rejection surfaced); node --check; studio:sync; install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary: root causes table — CODE BUG (fixed) vs OWNER DEPLOY
STEP (pending).
```

**Model:** Fable 5 (Medium). Chain diagnosis across admin/API/plugin.

---

## SC_33 — Audio preview is a mess — redesign it; identical look in plugin and web

**Problem (owner report + screenshot: Stock Catalog → AI Stock → audio detail).** The
audio preview is awful:
- Clashing off-system colors: lime play button + lime progress on a purple waveform
  (old lime accent leaking through, not theme tokens).
- A stray waveform FRAGMENT renders outside the player, clipped at the left edge of
  the container (overflow/duplicate canvas bug).
- The player floats as a small strip inside a huge empty bordered box — dead space all
  around.
- Overall it looks nothing like the rest of the design system. It must be fixed and
  look THE SAME in the plugin and on the web.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
packages/assetflow-studio/platform/index.html (web audio detail — the screenshot
surface) and plugins/after-effects-cep/AssetFlow_Plugin.html (its audio detail/preview
equivalents; node --check; install-cep.sh after edits). 3 themes via var(--…) tokens.

FIX — one shared audio-player recipe (align with the audio-card design introduced in
round 1):
1. COLORS: all player colors from theme tokens (accent, surface, border) — kill every
   hardcoded lime/purple literal in the audio player (grep the player's CSS/JS for hex
   literals). Waveform = quiet neutral token; played-progress = accent token; play
   button = standard accent button recipe. Correct in all 3 themes.
2. OVERFLOW BUG: find why a waveform fragment renders OUTSIDE the player container
   (duplicate canvas/svg, absolute element escaping, or width math using the wrong
   parent) and fix at the root; container gets overflow guard.
3. LAYOUT: the detail composes like other details (full-height policy): kind chip
   (SFX/VOICE/MUSIC), title, duration; a substantial waveform player row (play/pause,
   seek on waveform click if already supported, elapsed/total); metadata/tags/
   description below; the action block (Import/Download/etc. — whatever this surface
   already has) in its standard place. NO giant empty bordered void — the box fits its
   content; on tall viewports use the standard height-sink (e.g. similar/related items)
   rather than emptiness.
4. PARITY: plugin and web render visually identically (same structure, spacing recipe,
   tokens). Reuse — do not fork two implementations if a shared structure is feasible
   per file.
5. Playback behaviour unchanged (existing audio element/logic); only presentation and
   the overflow root cause.

QA: audio detail on web (desktop/~390px) and plugin (320/420/900) × 3 themes: no
off-token colors (grep proof: no new hex literals; old ones removed), no stray
fragment, no dead void; play/pause/seek work; side-by-side screenshot comparison
plugin vs web included in QA notes; node --check; install-cep.sh; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Sonnet 5. Scoped player redesign + one overflow root cause.

---

## SC_34 — Projects: add select-mode + bulk delete (plugin AND web)

**Problem (owner report + Projects screenshot).** There is no way to select multiple
projects and delete them (the grid is full of empty "test uchun" projects). Add a
select-and-delete function in both apps.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
packages/assetflow-studio/platform/index.html (web Projects view — the screenshot
surface) and plugins/after-effects-cep/AssetFlow_Plugin.html (plugin Projects view;
node --check; install-cep.sh after edits). Backend read-only first: apps/api/src/
routes/projects.ts — check what delete endpoints exist (single DELETE per project?
bulk?). Do NOT add new endpoints if single-delete exists — loop client-side with
Promise batching. If NO delete endpoint exists at all, add a minimal DELETE
/api/studio/projects/:id (auth-scoped to the owner, audit-consistent with the file's
conventions) — additive only.

SEMANTICS (verify in schema/routes before wiring): deleting a PROJECT removes the
collection/grouping only — the generations/templates inside are NOT deleted from My
Library/storage. Confirm this is how the backend behaves; if the backend cascades
item deletion, STOP and report instead of shipping destructive bulk delete.

BUILD (same UX both apps, reuse each app's existing select-mode pattern — the gen feed
already has a "Select" mode; follow it):
1. "Select" toggle on the Projects view header → cards get checkboxes/selection rings;
   tap toggles; "N selected" counter; Select all / Clear.
2. Delete action (danger style) with a REAL confirm step ("Delete N projects? Items
   inside stay in your library." — confirm/cancel); spam-click safe; progress state
   while deleting; per-item failure tolerated (continue others, report count).
3. Grid updates live after deletion; empty state appears if all gone; single-project
   delete also available in each card's existing menu/affordance if one exists (add to
   it, don't invent a new per-card menu).
4. Exit select mode restores normal card click (open project).

QA: both apps — select 3 incl. a non-empty project → confirm → grid updates; cancel
path; select-all; failure injection (one 404) → others still delete + notice; verify
in My Library that items from a deleted project still exist; 3 themes; plugin
320/420/900; node --check; install-cep.sh; API build passes if backend touched;
console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary (state which delete endpoint path you used/added and
confirm non-cascade semantics).
```

**Model:** Sonnet 5 (Fable 5 if a backend endpoint must be added).

---

## SC_35 — Plugin must adapt LIVE to AE panel resizing (real-AE screenshot evidence)

**Problem (owner report + real AE screenshot, panel ~870px).** As the user resizes the
plugin panel inside After Effects, the UI must continuously adapt by itself. The live
screenshot shows it currently does not:
- Top bar: the credit chip renders glitched/overlapping the icon next to it
  ("✦□380" collision).
- Category pill row is CLIPPED mid-word at the left edge ("emplates") — no proper
  overflow handling.
- A bottom technical status bar is visible: "● Server connected · 2026-07-17 03:33 ·
  896156b" (build hash!) — end users must not see this.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target:
plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 themes via var(--…) tokens.

GOAL: continuous, live responsiveness while the AE panel is resized + three concrete
defects from a real-AE screenshot at ~870px width.

TASK 1 — LIVE resize adaptation:
Audit how the layout responds to panel resizes: CSS media queries respond live, but
find any JS-computed layout (column math, width caches, chart/canvas sizing, chip
label modes, virtualized lists) that only runs on load/navigation. Wire those to a
debounced resize handler (single shared listener, ~100ms debounce) so EVERY surface
re-adapts while dragging the panel edge: top bar label modes, grids' column counts,
composer row modes, workspace layout. No layout thrash (verify no loops).

TASK 2 — top-bar chip collision at mid widths (~800-900px): the credit chip overlaps
the adjacent icon button. Fix the top bar's flex/shrink rules at MID widths too (the
narrow-width rules exist; the mid-range is broken). The bar must be collision-free at
EVERY width from 320 to 2500 — test continuously, not just at breakpoints.

TASK 3 — category pill row: never clip mid-word. Make it a horizontal scroll strip
with edge fade masks (and drag/wheel scroll), active pill kept in view; or wrap to two
lines if that is the established pattern elsewhere — pick ONE consistent with the
design system and apply wherever pill rows exist (catalog categories, any others).

TASK 4 — remove the bottom technical status bar ("Server connected · timestamp ·
build hash") from all user-facing surfaces. Relocate its info into the Account sheet
as a small quiet footer line (server status dot + version/hash) — diagnostics belong
there. Reclaim the freed bottom space; nothing else may dock there.

QA: in-browser cep-mode — DRAG-resize continuously 320→2500px on Home/Catalog/AI
workspace/My Library: everything adapts live, zero collisions/clips at any
intermediate width (record spot checks at 320/420/560/720/870/1200/1600/2200);
status bar gone everywhere, info present in Account; 3 themes; node --check;
install-cep.sh (owner will confirm live in AE).

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Fable 5 (Medium). Live-resize wiring across all surfaces + mid-width fixes.

---

## SC_36 — The plugin feels overloaded — simplicity pass via progressive disclosure
## (Director's hierarchy rules)

**Problem (owner report + screenshot).** The overall plugin environment is bloated and
not simple: too much information and too many functions visible at once — it tires the
user. **Director's decision: a progressive-disclosure pass — media and the primary
action stay visible; everything secondary appears on demand.**

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Primary
target: plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline
scripts; node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. Web
(platform/index.html): apply rule 2 (card faces) if its cards match; otherwise plugin
only. 3 themes via var(--…) tokens. Money guard: cost/credit displays stay visible
where they already are (Generate cost tag, credit chip) — simplification never hides
prices.

DIRECTOR'S HIERARCHY RULES (apply exactly; this is presentation/disclosure only — NO
functionality may be removed, only relocated behind one interaction):

1. ONE chrome level per screen: the global top bar is the only full-width bar. The
   workspace's second bar collapses to a single SLIM sub-row: back · session name ·
   tiny meta — plus at most TWO controls (Visuals/Audio filter, and one "⋯" menu
   holding the rest: expand/zoom, refresh, grid toggle, settings). Everything currently
   in that row must remain reachable via the ⋯ menu (map old → new in the summary).
   No duplicate avatar anywhere (top bar owns it).
2. CARD FACE = MEDIA: gen cards show media + a small kind glyph only. The prompt
   caption and the Use ▾ button appear on HOVER/FOCUS (CEP has mouse hover; also show
   them when the card has keyboard focus). Audio cards (no media) keep their compact
   info row but Use ▾ still hover-revealed. My Library and workspace feed both.
3. SECTION ROWS are quiet: one row per section — heading left, at most two quiet
   actions right (e.g. Select · All →); no mono-caps, standard heading style.
4. COMPOSER stays as designed in this round's earlier work (it is already the primary
   zone) — do not double-simplify it; just verify it reads as ONE calm block under
   the feed.
5. BUDGET RULE for every screen: no more than ~5 always-visible interactive controls
   per zone (top bar · content · composer). Walk EVERY surface of the plugin — Home,
   Catalog grid + template detail, My Library, gen workspace (all 3 modes), session
   picker, Projects, Account sheet, settings, guest/login — with this budget; anything
   over budget goes behind the zone's single ⋯/disclosure. List every relocation in
   the summary. (Owner confirmed the overload exists EVERYWHERE in the plugin — no
   surface is exempt.)
6. Transitions instant and subtle (opacity/translate ≤120ms); no layout shift when
   hover controls appear (overlay, not push).

QA: every surface at 320/420/900 × 3 themes: visibly calmer face, hover/focus reveals
work (keyboard too), nothing lost (old control → new location table complete), no
hidden prices; node --check; install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary with the relocation table.
```

**Model:** Fable 5 (High). Judgment-heavy simplification with a strict no-loss
constraint.

---

# DIRECTOR-FOUND PROBLEMS (round-2 final review — owner did not report these)

## SC_37 — Search is unverified: catalog search (plugin) and ⌘K (web) end-to-end

**Problem (Director finding).** Search sits on every catalog surface but no task has
ever verified it: does the plugin "Search templates…" box actually query the
server-side search (round 1 of the project moved filtering server-side), debounce,
show result counts, handle empty results, and reset cleanly? Web ⌘K likewise (it
claims to search "templates, generations").

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (node --check; install-cep.sh) + packages/assetflow-studio/
platform/index.html. Backend read-only: catalog search params in apps/api (plugin.ts /
public catalog routes). Local stack for live checks.

VERIFY → FIX, both apps: (1) typing queries the SERVER search param (not a client
filter over the loaded page), debounced ~300ms, race-safe (stale responses discarded);
(2) result count + active-category interplay correct (search within category vs global
— follow the API's semantics and make the UI say which); (3) empty-results state per
the standard empty recipe with a clear "Clear search" action; (4) clearing restores
the normal grid (no stuck filters); (5) web ⌘K: opens, searches BOTH templates and the
user's generations if the backend supports it — otherwise scope the placeholder text
honestly; keyboard navigation works; (6) plugin: search box behavior at narrow widths
(collapses to icon → expands) consistent with the constitution.
Deliverable: behavior verified/fixed list per app. QA live against local API with 6+
templates; 3 themes; node --check; install-cep.sh; console clean.
Finish: commit (no Co-Authored-By), no push; short summary.
```

**Model:** Sonnet 5.

---

## SC_38 — Guest/login screens and auth flows: never audited in either round

**Problem (Director finding).** Every task so far assumed a logged-in user. The guest
screen, sign-in (email/password), Google/device-code flow, error states (wrong
password, expired token, offline) and the logged-out top bar have never been checked
against the new design system or the constitution.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (guest #homeGuest, sign-in sheet, device-code flow; node
--check; install-cep.sh) + packages/assetflow-studio/platform/index.html (in-app auth
views). Backend read-only: auth routes. Local stack + seed users.

AUDIT → FIX: (1) full flows work locally: email+password login/logout (plugin+web),
plugin device-code/Google path to the last locally-verifiable step; (2) error states
per the standard recipe (wrong password, network fail, expired session →
TOKEN_EXPIRED handling re-prompts login without losing state); (3) guest screens
follow the current design system + UI constitution (tokens, compact, no stale copy —
the CMS guest fields from round 1 must actually apply); (4) logged-out top bar: no
dead credit chip/avatar (hidden or replaced with Sign in per existing pattern); (5)
post-login the user lands where they were headed (or Home), and the CMS/config/model
fetches fire once (no thundering repeats — check the boot sequence). No auth logic
changes server-side. Deliverable: flow checklist with pass/fixed per item.
QA: 3 themes; plugin 320/420/900; node --check; install-cep.sh; console clean.
Finish: commit (no Co-Authored-By), no push; short summary.
```

**Model:** Fable 5 (Medium). Auth-adjacent — care over cleverness.

---

## SC_39 — Dead-code purge: two rounds of removals left orphans in a 1MB file

**Problem (Director finding).** Rounds 1–2 deleted many features/surfaces (upscale,
History, launcher subtabs, chip-strip, bottom bars, start cards, intermediate tool
screen…). Orphan CSS blocks, unused functions, dead ids and stale strings are still
sitting in the 1MB plugin file (and some in the web file) — weight, confusion, and
false grep-positives for every future task.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (node --check; install-cep.sh) + packages/assetflow-studio/
platform/index.html. THIS TASK REMOVES ONLY PROVABLY DEAD CODE — zero behaviour
change.

METHOD (conservative): (1) inventory candidates — CSS selectors with no matching DOM
and no JS constructor (grep both directions), functions never referenced (check ALL 7
inline scripts + inline on* attributes before deleting), ids referenced nowhere,
known-retired blocks (old .b8 home, .fhome-card start-cards CSS if orphaned, upscale
remnants, history strip, chip-strip, launcher subtab CSS, bottom-bar CSS, v-aicat);
(2) for each candidate: prove deadness (two greps quoted in a worklist), then delete;
UNSURE → keep and list; (3) never touch: money-zone code, ExtendScript/jsx bridge,
anything referenced from CSXS/manifest or install scripts, feature-flagged paths that
are merely disabled (upscale catalog entries server-side stay as-is).
Deliverable: worklist (removed: selector/function → proof; kept-unsure list) + before/
after file sizes.
QA: full smoke of every surface after purge (nav, generate mock, import path, account,
auth) at 420/900 × 3 themes; node --check all scripts; install-cep.sh; web console
clean.
Finish: commit (no Co-Authored-By), no push; short summary with size delta.
```

**Model:** Fable 5 (Medium). Deletion discipline; proof before removal.

---

## SC_40 — Sessions can't be renamed — auto-names need a manual override

**Problem (Director finding).** Round-2 work gave sessions clean derived names, but
users still can't NAME a session ("Client X promo"). The backend already stores a
title (the web used to send raw prompts as titles), so rename is cheap and makes the
session picker actually navigable.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (session picker; node --check; install-cep.sh) +
packages/assetflow-studio/platform/index.html (its session lists). Backend: check
apps/api/src/routes/studio-gen.ts sessions routes — if a title/name field is writable
(PATCH/PUT exists), use it; if only create-time title exists, add a minimal
auth-scoped PATCH /gen/sessions/:id {title} (additive, owner-only, length-capped,
audit-consistent). No other backend changes.

BUILD (both apps): ✎ rename affordance on session rows (picker + web lists) → inline
input (prefilled with current display name) → save on Enter/blur, Esc cancels; empty
input reverts to the derived auto-name (store null); optimistic update + error
rollback; renamed title wins over auto-naming everywhere (picker, workspace header,
web). Constitution: the ✎ appears on hover/focus, not always-visible.
QA: rename/clear/cancel paths both apps; long titles capped gracefully; derived-name
fallback intact for untouched sessions; API build passes if touched; 3 themes; node
--check; install-cep.sh.
Finish: commit (no Co-Authored-By), no push; short summary (state which endpoint path
you used/added).
```

**Model:** Sonnet 5 (Fable 5 if the PATCH endpoint must be added).

---

# MASTER EXECUTION ORDER — ROUND 2 (Director's final ordering, 2026-07-17)

One prompt per fresh Code session (`/clear`). Groups by dependency; in-group order is
binding.

**Group A — Functional correctness first (stable data before layout/polish):**
1. SC_29 (sessions core: new/scoping/filter) → 2. SC_40 (session rename — builds on
stable sessions) → 3. SC_30 (Use ▾ actions matrix) → 4. SC_34 (Projects bulk delete)
→ 5. SC_37 (search) → 6. SC_32 (Plugin CMS chain diagnosis — ALSO surfaces pending
owner deploy steps early) → 7. SC_38 (guest/login audit).

**Group B — The deep one:** 8. SC_27 (composer parity + per-model UX + payload
verification). After Group A so sessions/actions are stable under its QA.

**Group C — Layout system:** 9. SC_26 (full-panel scaling) → 10. SC_31 (detail
full-height) → 11. SC_33 (audio preview redesign) → 12. SC_25 (narrow-width breakage)
→ 13. SC_35 (LIVE resize + mid-width collisions + tech-bar removal — the continuous
320→2500 net over everything before it).

**Group D — Final passes (strictly last):** 14. SC_36 (constitution/simplicity pass
over the FINAL structure) → 15. SC_39 (dead-code purge — after every removal/change
has landed).

**Reconciliation notes:**
- SC_28 (Sessions/Projects → Account sheet) merged into Group A ordering: run it
  between SC_40 and SC_30 (it's pure relocation; keeps nav stable for later QA) —
  final sequence: SC_29 → SC_40 → SC_28 → SC_30 → SC_34 → SC_37 → SC_32 → SC_38.
- SC_25 vs SC_35: SC_25 fixes discrete narrow widths; SC_35 then guarantees the
  continuous range and live adaptation. Keep both, in that order.
- SC_36's ⋯-menu consolidation happens AFTER SC_35 removed the tech bar and SC_28
  moved Sessions/Projects — so the budget count applies to the final control set.
- SC_39 runs absolutely last; its "kept-unsure" list feeds the next round.

**Owner deploy checkpoints:** ⚠️ FIRST — confirm the round-1 steps are done (push ·
API deploy · `wrangler deploy` in workers/cdn-proxy · prod migration
`plugin_content_config`): SC_32 will verify and report. Then after Group A: push +
deploy + live AE spot-check. Final: full E2E in real AE (resize drag, CMS edit → 5
min, one gen per mode with per-model controls, import, rename, bulk delete, search,
sign-out/in).
