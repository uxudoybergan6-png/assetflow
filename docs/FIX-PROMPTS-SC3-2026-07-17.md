# FIX-PROMPTS-SC3 — Round 3 (owner dictation, 2026-07-17)

Third round — tasks **SC_41 … SC_53**. Numbering CONTINUES the global sequence so no ID
ever collides: round 1 = SC_01–24 (`docs/FIX-PROMPTS-SC-2026-07-16.md`, DONE), round 2 =
SC_25–40 (`docs/FIX-PROMPTS-SC2-2026-07-17.md`, DONE). Only the tasks in THIS file are
open. Execution order is at the end of the file.

---

## GLOBAL RULES (apply to EVERY prompt below)

- **MONEY ZONE IS BYTE-FOR-BYTE FROZEN:** credit consume/refund, signed cost-quote and
  HMAC (`apps/api/src/lib/gen-quote.ts`, `gen-models.ts` cost functions,
  `plugin-profile.ts`), webhook idempotency, every credit VALUE and price display.
  If a change would touch these → STOP and flag in the summary.
- **PLUGIN UI CONSTITUTION (owner-approved, binding on every UI change):**
  (1) one chrome — a single top bar; no second full-width bar;
  (2) card face = media + kind glyph; captions/actions revealed on hover/focus;
  (3) zone budget — max ~5 always-visible interactive controls per zone; the rest
      behind one ⋯/disclosure;
  (4) progressive disclosure — functionality is NEVER removed, only relocated;
  (5) theme tokens only, one spacing scale (no hardcoded colors);
  (6) price/credit displays are always visible.
- **Migrations additive only. English UI; Uzbek code comments.**
- **Studio source rule:** edit ROOT `packages/assetflow-studio/js|styles` (+ admin/,
  contributor/ source) then `npm run studio:sync`; `platform/index.html` = direct CF
  Pages source. NEVER edit `studio/`, `admin/` artifacts. Landing (`ffl-`) off-limits.
- **Plugin:** `plugins/after-effects-cep/AssetFlow_Plugin.html` (~1MB, 7 inline
  scripts): validate with `node --check`; keep ids/handlers bound; after edits run
  `bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 themes via var(--…).
- **Default scope: BOTH plugin and web** unless the problem says otherwise.
- **Minimal, narrow diff.** Each prompt self-contained (`/clear` between runs).
- **When finished:** (a) commit with a clear concise message (no Co-Authored-By); do
  NOT push. (b) write a short summary.

---

## SC_41 — Composer breaks when the panel is narrowed; the new-session empty state is
## overloaded (tires the user)

**Problem (owner report + 3 screenshots, narrow ~780px vs wide).**
1. NARROW PANEL — the composer falls apart: the REFERENCES block explodes into stacked
   rows (label + counters "Image 0/9 · Video 0/3 · Audio 0/3", three +Image/+Video/
   +Audio buttons, then a full limits sentence "Max 9 image(s) ≤30MB · 3 video(s) total
   ≤50MB · 3 audio · total 12"); the FRAMES block, the long placeholder, and the
   control chips then wrap into many rows, so the composer eats most of the panel and
   pushes the feed off-screen. On the wide panel the same content sits in a tidy few
   rows — the narrow layout has no discipline.
2. NEW SESSION EMPTY STATE — too much: a big "Start with your idea" hero + subtitle +
   three suggestion chips, and then a SECOND empty block ("Recent / No generations yet
   / Type a prompt below — results will appear here"). Two competing empty states on
   one screen. The owner: this is not needed in a new session, it tires the user.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Primary
target: plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline
scripts; node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. Also check
packages/assetflow-studio/platform/index.html (web) for the same empty-state
duplication and apply part B there if present. 3 themes via var(--…) tokens.
Money guard: Generate cost tag / Enhance ✦1 stay visible and unchanged.
UI constitution applies (one chrome · zone budget ≤5 visible controls · progressive
disclosure — nothing removed, only relocated · tokens only).

PART A — composer at narrow widths (the composer must never dominate the panel):
1. REFERENCES block: replace the three separate +Image/+Video/+Audio buttons, the
   counter line and the limits sentence with ONE compact control: a single "+" (add
   reference) button that opens a small menu (Image · Video · Audio) — or a single
   segmented control at wide widths if that reads better; the counters collapse into a
   tiny badge on the button ("2/12" style, shown only when ≥1 reference exists); the
   limits sentence moves into the button's title tooltip and/or appears only as a
   transient notice when a limit is hit (the limit-notice pill already exists — reuse).
2. FRAMES block (video modes): at narrow widths it becomes one row of two compact
   slots (Start / End) with icon+label, not two large dashed boxes stacked with
   captions; keep drag/drop and click-to-add behaviour identical.
3. PLACEHOLDER: shorten to one line ("Describe the motion… @ for references"); the
   long "(@Image1 / @Video1 / @Audio1)" explainer moves to the @-menu/tooltip.
4. HARD BUDGET: at ≤560px the whole composer occupies at most ~45% of panel height in
   its collapsed state; the feed always keeps ≥50%. Control chips follow the existing
   narrow rules (max 3 rows; Generate never clipped, cost visible). If content still
   overflows, the FRAMES/REFERENCES section collapses behind a single "Inputs ⌄"
   disclosure that expands over the feed — never pushing Generate out of view.
5. The expand/collapse chevron already on the composer keeps working and its state
   persists per tool.

PART B — DELETE the new-session empty-state screens entirely (owner's explicit
instruction: "bular umuman kerak emas o'chirib tashla"), both apps:
Remove ALL of it from the empty (0-generation) session state:
  - the hero block: ✦ icon, "Start with your idea" title, the subtitle ("Add a start
    frame, describe the motion, and Sparky animates it into a clip." / the image-tool
    equivalent), and the three suggestion chips (Slow dolly-in… / Slow-motion coffee
    pour / Orbital camera around product);
  - the second empty block: the "Recent" header row (Select · All →) while empty, the
    ✦ circle, "No generations yet", "Type a prompt below — results will appear here",
    and the ↓ arrow.
An empty session shows NOTHING in the feed area — just the plain background between
the session header and the composer. No placeholder art, no copy, no chips.
Delete the markup, their CSS, and the JS that renders/toggles them (guard any shared
render paths so nothing throws when the empty branch is gone). Once the session has
≥1 item, the normal "Recent" header + grid renders exactly as today. Apply the same
deletion on the web wherever these empty-state blocks exist.

QA: plugin widths 320/420/560/780/1200 × 3 themes: composer collapsed height within
budget, feed visible, references/frames flows work (add image ref, add start frame,
hit a limit → notice); a NEW session shows an empty feed area with zero placeholder
content (no hero, no chips, no "No generations yet"); the first generation restores
the normal "Recent" header + grid; no console errors from the removed branches;
node --check; install-cep.sh; web spot-check; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Fable 5 (High). Composer is the core surface; narrow-width discipline +
empty-state consolidation.

> ⚠️ **SC_41 PART A IS SUPERSEDED BY SC_42** (owner re-reported the composer as still
> messy). Run SC_41 for PART B only (delete the empty-state screens), then SC_42 for
> the full composer rebuild. If SC_41 has already run, SC_42 rebuilds on top of it.

---

## SC_42 — Composer full rebuild to an exact anatomy (Director's specification)

**Problem (owner report, repeated + screenshot).** The prompt composer is still
disorderly. Previous rounds tightened pieces of it; the owner still reads it as a mess.
Root issue: it is a stack of independent blocks (FRAMES box · REFERENCES box with its
own label/counters/limits sentence · long placeholder · two rows of chips · footnote)
each with its own label style and spacing — 5 competing zones, ~7 lines tall, no
hierarchy. **Director's decision: stop patching; rebuild the composer to one exact
anatomy, defined below, identical in plugin and web.**

**THE ANATOMY (build exactly this — three rows, nothing else):**

```
┌──────────────────────────────────────────────────────────────┐
│ [+]  <prompt textarea — 1 line, grows to max 4>          [⌃] │   ROW 1
│ ⟨attachment strip: only when items exist — thumbs w/ ✕⟩       │   (conditional)
│ [Video ⌄] [Seedance 2.0 ⌄] [480p·Auto ⌄] [♪ ⌄]   [✨1] [↺] [ Generate ✦32 ] │ ROW 2
└──────────────────────────────────────────────────────────────┘
   ≈1–2 min · refunded on error            (ROW 3: one quiet line, only while relevant)
```

- **Row 1:** `[+]` add-input button (menu: Start frame · End frame · Image · Video ·
  Audio — frames only for modes that support them, per the model capability map);
  textarea; collapse chevron. NO "FRAMES" box, NO "REFERENCES" label, NO counters line,
  NO limits sentence in the resting state.
- **Attachment strip (conditional):** appears ONLY when the user has added something —
  a single horizontal row of small thumbs, each with its role badge (START / END /
  @Image1 / @Video1 / @Audio1) and a ✕. This replaces both the FRAMES boxes and the
  REFERENCES buttons visually; adding happens through `[+]`, drag&drop onto the
  composer, and paste — all three must keep working.
- **Row 2:** the control chips (mode · model · output · audio) left, then Enhance ·
  Clear · Generate right. Generate always last, never clipped, cost tag always visible.
- **Row 3:** the single quiet line (time estimate · refund note). Nothing else.
- **Limits** ("Max 9 images ≤30MB…") live ONLY in the `[+]` menu's tooltip and in the
  transient notice pill when a limit is hit.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (all three tools: image, video, audio;
node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`) and
packages/assetflow-studio/platform/index.html (web composer — same anatomy). 3 themes
via var(--…) tokens. 🔴 Money guard: Enhance ✦1 and the Generate cost tag keep their
exact values and stay visible at all times; no cost logic changes.

GOAL: rebuild the composer to the EXACT anatomy specified by the Director (three rows
+ a conditional attachment strip). This is a STRUCTURAL rebuild of the composer's
markup/CSS, NOT a behaviour change: every existing capability must survive and keep
its handlers — add reference (button, drag&drop, paste), start/end frames, @ mentions
and their pill rewriting, model/output/audio pickers, Enhance, Clear, Generate with
its credit gate, collapse/expand, undo, per-model control visibility (the capability
map from the earlier per-model work stays authoritative).

ANATOMY (build exactly):
ROW 1: [+] add-input button · prompt textarea (1 line resting, auto-grows to max 4
  lines, then scrolls) · collapse chevron.
  The [+] opens a compact menu whose items come from the ACTIVE MODEL's capability
  map: "Start frame", "End frame" (only if supported), "Image", "Video", "Audio"
  (only the reference kinds that model accepts). Item disabled + reason tooltip when
  a per-kind limit is reached. The full limits text lives in this menu's tooltip.
ATTACHMENT STRIP (rendered only when ≥1 input exists): one horizontal row of compact
  thumbs; each thumb shows a role badge (START / END / @Image1 / @Video1 / @Audio1 —
  reuse the existing mention numbering EXACTLY; numbering must never be reassigned)
  and a ✕ to remove; horizontal scroll if many; audio items show a small waveform/
  note glyph instead of a thumb.
ROW 2: control chips (mode · model · output · audio toggle — only those the model
  supports) on the left; Enhance ✦1 · Clear · Generate (with cost) on the right.
  Narrow widths: chips compact/icon-only per the existing chip rules; Generate is
  never clipped and never leaves the visible area; max 2 chip rows at 320px.
ROW 3: the single quiet meta line (time estimate · "credits refunded on error") —
  only when it applies.
DELETE from the resting composer: the "FRAMES" label + two dashed frame boxes, the
  "REFERENCES" label, the "Image 0/9 · Video 0/3 · Audio 0/3" counter line, the
  "Max 9 image(s) ≤30MB · 3 video(s) total ≤50MB · 3 audio · total 12" sentence, and
  the long "(@Image1 / @Video1 / @Audio1)" placeholder tail (placeholder becomes one
  short line, e.g. "Describe the shot… @ for references").
BUDGET: resting composer ≤ ~30% of panel height at 560px and ≤ ~40% at 320px; the feed
  keeps the rest. Verify by measurement, state the numbers in the summary.

CONSTITUTION: one chrome, tokens only, progressive disclosure (nothing removed — the
[+] menu and the strip are where the deleted UI's functionality now lives), zone
budget ≤5 always-visible controls per zone, prices always visible.

🔴 PER-MODEL UX IS PART OF THIS TASK (owner's explicit requirement): the composer's
UX CHANGES per AI model — the anatomy is fixed, but what appears inside it is driven
by the ACTIVE MODEL's capability map (built in the earlier per-model work; if it is
missing or incomplete, rebuild/extend it from GET /api/studio/gen/models +
apps/api/src/lib/gen-models.ts + docs/GEN-MODEL-MATRIX.md, and the backend's own
validation is the final authority). Rules:
  - `[+]` menu items = exactly the inputs that model accepts (start/end frame,
    image/video/audio refs) with that model's own per-kind limits.
  - Row-2 chips = exactly that model's supported controls (output ratios/resolutions/
    durations, audio toggle, quality/negative/seed if any) with that model's allowed
    values and defaults; unsupported controls are ABSENT, not disabled-noise.
  - Switching models re-renders the composer: now-invalid inputs/values drop with one
    transient notice; still-valid ones survive.
  - The payload sent to /gen/cost-quote and POST /gen carries exactly that model's
    fields — no leftovers from a previously selected model.

QA — EVERY MODEL, not a sample (this is the owner's requirement "hamma modelga qo'yib
uxni tekshirsin"): enumerate every ENABLED model from the live catalog and, for EACH
one, in BOTH apps: select it → verify the [+] menu items, chips, allowed values and
defaults match its capabilities → add the inputs it supports → check the attachment
strip badges/numbering → confirm the built payload passes /gen/cost-quote against the
local API (reuse/extend the existing verify-gen-payloads script so this is automated,
and run it) → confirm the Generate cost tag renders. Produce a PER-MODEL TABLE:
model → inputs offered → controls offered → quote PASS/FAIL → notes.
Also: model-switch matrix (switch A→B for several pairs incl. video↔image models) —
invalid state cleared, no stale fields in the payload.
Plus the layout QA: each tool × plugin widths 320/420/560/900 × 3 themes and web
(~390px + desktop): drag&drop and paste still add; hit a limit → menu item disabled +
notice pill; Enhance/Clear/Generate work; collapse/expand persists; undo works.
node --check; install-cep.sh; web console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary including the measured composer heights, the
capability-survival checklist (old element → new home), and the PER-MODEL TABLE.
```

**Model:** Fable 5 (High / Extra). Structural rebuild of the app's most important
surface with a strict no-loss constraint.

---

## SC_43 — Reference capacity must be shown by ICONS, not sentences — and never twice

**Problem (owner report + screenshots).** The composer states reference capacity in
TEXT, in TWO places at once, which is illogical and distracting:
- top-right: "Image 0/3 · Video 0/2"
- under the buttons: "Max 3 image(s) · 2 video(s) · total 3"
- plus the placeholder tail "(@Image1 / @Video1 / @Audio1)".
The owner: these texts must not be in the prompt chat at all; how many references a
model accepts must be communicated with clear, beautiful ICONS — and never duplicated.

**Director's specification (refines SC_42's `[+]` control — build exactly this):**
A single **capacity indicator** sits on/next to the `[+]` button: one small icon per
reference kind the ACTIVE MODEL accepts (🖼 image · ▶ video · ♪ audio — use the app's
existing inline-SVG icon set, not emoji), each with a tiny numeric badge showing
used/limit ONLY as digits (e.g. `🖼 0/3  ▶ 0/2`). Kinds the model does not accept are
absent entirely. Rules:
- Icons render in a single compact row, ~16-18px, token colors; the badge dims when
  0 used and highlights when full.
- Hover/long-press title tooltip carries the wordy detail ("Up to 3 images, ≤30MB
  each") — the ONLY place that sentence may exist.
- When a limit is hit: the icon turns to the "full" state + the existing transient
  notice pill fires. No permanent sentence anywhere.
- Exactly ONE instance of this indicator in the composer. The "REFERENCES" label, the
  "Image 0/3 · Video 0/2" line, the "Max 3 image(s)…" line and the placeholder's
  "(@Image1 / @Video1 / @Audio1)" tail are all DELETED.
- Identical in plugin and web.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (all three tools; node --check; install-cep.sh after edits) and
packages/assetflow-studio/platform/index.html. 3 themes via var(--…) tokens. Money
guard: Enhance/Generate cost tags untouched and visible.

CONTEXT: the composer currently prints reference capacity as text in two places
("Image 0/3 · Video 0/2" top-right AND "Max 3 image(s) · 2 video(s) · total 3" under
the buttons) plus a placeholder tail "(@Image1 / @Video1 / @Audio1)".

BUILD — one icon-based capacity indicator (Director spec):
1. DELETE all three text occurrences (both apps): the "REFERENCES" label row with its
   counters, the "Max …" limits sentence, and the placeholder tail (placeholder
   becomes one short line, e.g. "Describe the shot… @ for references").
2. ADD a single capacity indicator attached to the add-input `[+]` control: one
   compact icon per reference kind the ACTIVE model accepts, each with a digits-only
   badge `used/limit`; ~16-18px; existing inline-SVG icon style; theme tokens only;
   unsupported kinds not rendered at all. Dim at 0 used, accent/full state at limit.
3. The verbose limit text exists ONLY in that control's title tooltip; on limit-hit
   the existing notice pill fires. Nowhere else.
4. Exactly one instance per composer — grep both files afterwards to prove no second
   capacity display survives anywhere (include the grep in the summary).
5. The indicator is driven by the ACTIVE MODEL's capability map (per-model limits) and
   updates live as references are added/removed and when the model changes.

QA: for each tool and several models with DIFFERENT reference limits (e.g. a model
with images only, one with image+video, one with none): icons match the model, badges
count correctly on add/remove, full state + notice fire at the limit, tooltip carries
the wording, zero capacity text anywhere; plugin 320/420/560/900 × 3 themes; web
(~390px + desktop); node --check; install-cep.sh; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary.
```

**Model:** Sonnet 5 (run AFTER SC_42, which owns the composer's structure).

---

## SC_44 — Opening a gen card flashes BLACK before the media appears (plugin + web)

**Problem (owner report).** Clicking a generation card to open it (lightbox/detail)
shows a black frame first, then the media fades/pops in. The transition should be
seamless — the user should never see a black flash.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (node --check; install-cep.sh after edits) and
packages/assetflow-studio/platform/index.html. 3 themes via var(--…) tokens.
Presentation only — no data-flow or action changes.

PROBLEM: opening a generation card (viewer/lightbox/detail) paints a BLACK stage
first; the media appears only after it loads, so the user sees a black flash on every
open. Happens in both apps, for images and videos.

DIAGNOSE then FIX (root cause, not a delay hack):
1. Find the viewer open path in each app. Typical causes to check: the overlay's stage
   has an opaque black background painted before any media element exists; the viewer
   loads the FULL-RESOLUTION original instead of reusing the already-cached thumbnail/
   display derivative; the <img>/<video> is created empty then src-assigned, giving an
   empty box; a fade-in animation starting from an empty black stage; video showing no
   poster until the first frame decodes.
2. Fix so the media is visible IMMEDIATELY on open:
   - Reuse the card's ALREADY-LOADED thumbnail/display derivative as an instant
     backdrop (it is in cache — zero network), then swap to the full-size asset when
     it finishes decoding (`img.decode()` / `onload`, or video `poster` + `loadeddata`)
     with a short cross-fade (≤150ms) so the swap is invisible.
   - The stage background uses the theme surface token (not pure black) and never
     shows before media: no empty black frame at any point.
   - Videos: set `poster` to the item's poster/thumb derivative and `preload="metadata"`
     so the first paint is the poster, not black.
3. If a full-size asset fails to load, keep the thumbnail visible and show the standard
   error affordance — never fall back to a black rectangle.
4. Same approach in both apps; also check other places a gen item opens (My Library,
   session feed, project view, stock AI-stock items) so no path keeps the old
   behaviour.

QA: open image and video gens from every entry point in both apps, on a throttled
connection (DevTools Slow 3G) — record/inspect the first painted frame: it must be the
thumbnail, never black; swap to full-size is unnoticeable; error case keeps the thumb;
3 themes; plugin 320/900 widths; node --check; install-cep.sh; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
root cause per app.
```

**Model:** Sonnet 5. Focused perceived-performance fix.

---

## SC_45 — My Library grid wastes space (huge gaps between mixed-aspect cards); the Use
## button must sit INSIDE the card, not below it

**Problem (owner report + My Library screenshot).** With native aspect ratios in play
(9:16 portraits next to 16:9 landscapes), the grid leaves enormous empty gaps — a row's
height is set by its tallest card and the shorter ones leave dead black space beneath.
Additionally the "Use ▾" button renders BELOW each card in its own strip, which is what
creates part of the gap and looks detached. Owner: pack the cards with no wasted space,
and put Use INSIDE the card.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (My Library + session feeds; node --check; install-cep.sh after
edits) and packages/assetflow-studio/platform/index.html (same surfaces). 3 themes via
var(--…) tokens. UI constitution applies (card face = media; actions revealed on
hover/focus; tokens only). Money guard: none here.

TWO CHANGES:

1. MASONRY PACKING — no wasted space:
   The grid currently uses equal-height rows, so mixed aspect ratios (9:16 next to
   16:9) leave large empty areas. Replace with a masonry/column-packed layout that
   keeps each item's NATIVE aspect ratio (established earlier — do not crop):
   - CSS-first: use CSS multi-column (`column-count`/`column-width` + `break-inside:
     avoid`) or a small JS column-balancer if ordering matters. Choose ONE and note
     why in the summary; avoid heavy libraries.
   - Column count follows the established width rules (320px = 1-2, 420 = 2, 600 = 2-3,
     900+ = 3-4, ultra-wide keeps adding columns); consistent gutter from the spacing
     scale, equal horizontal/vertical.
   - Reading order stays newest-first and understandable; if CSS columns break the
     order unacceptably, use the JS balancer that assigns items to the shortest column
     in order.
   - Must work with the existing lazy-load/virtualization and with items whose aspect
     is unknown until load (reserve space from the payload's width/height; fallback
     16:9 then reflow once known — no layout jump loops).
   - Audio cards keep their fixed compact height and participate in the packing.

2. USE BUTTON INSIDE THE CARD:
   Move the "Use ▾" control from the strip BELOW the card into the card itself —
   bottom-right corner, overlaid on the media with a subtle scrim/backdrop so it stays
   legible on any image; revealed on hover/focus per the constitution (always visible
   on touch/no-hover contexts). Delete the below-card strip and reclaim its height.
   The menu anchoring behaviour established earlier (opens over the card, flips at
   edges, closes on Esc/outside) must keep working from the new position. Same for
   audio cards (Use inside the card's own row).

QA: both apps with a mixed set (9:16, 16:9, 1:1, 4:5, audio): no dead gaps — measure
column fill; native aspects preserved; Use opens the correct item's menu from inside
the card at every column position incl. edges; hover/focus reveal works, keyboard
reachable; lazy-loading and scrolling stay smooth with 100+ items; plugin
320/420/600/900/1600 × 3 themes; web ~390px + desktop; node --check; install-cep.sh;
console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary (state
which packing approach you chose and why).
```

**Model:** Fable 5 (Medium). Layout engine change + action relocation across two apps.

---

## SC_46 — Opening a session flashes the EMPTY state before the items load

**Problem (owner report + session picker screenshot).** Tapping a session in the picker
first shows an empty session (empty feed / "0 generations"-looking state), and only
then the session's items appear. The empty state must never be shown while items are
still loading — the user should see a loading state, then content.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (session picker → workspace; node --check; install-cep.sh after
edits) and packages/assetflow-studio/platform/index.html (same pattern if present).
3 themes via var(--…) tokens. Presentation/state-machine only — no data changes.

PROBLEM: selecting a session renders the workspace in its EMPTY state first (because
the feed array is empty until the per-session fetch resolves), then swaps to the real
items. The empty branch is being used as the default for "not loaded yet".

FIX — a proper three-state machine for the session feed (and any surface with the same
bug):
1. States: LOADING (fetch in flight or not started) · READY-EMPTY (fetch resolved,
   zero items) · READY-ITEMS. The EMPTY branch may render ONLY after a successful
   fetch returned zero items — never as the initial/default state.
2. On session open: enter LOADING immediately and render skeleton cards sized to the
   grid (reuse the established skeleton recipe); the header's "N generations" meta
   shows the count already known from the picker row (do not flash 0) — if unknown,
   render a neutral placeholder, not "0".
3. Show the picker's known thumbnail/count instantly where possible so the transition
   feels continuous.
4. Also verify: switching between sessions never flashes the previous session's items
   nor the empty state (stale-response guard from the earlier session-scoping work must
   still hold); error → the standard error state with Retry (not empty).
5. Note: a genuinely NEW session (0 items, nothing to fetch) renders the empty feed
   area per the current design — no skeletons, no flash.

QA: with throttling (Slow 3G): open sessions with 1, 5 and 18 items — first paint is
skeletons + correct count, never the empty state; switch A→B→A rapidly — no cross-
contamination, no empty flash; error injection shows Retry; new session shows the
plain empty area instantly; plugin 320/900 × 3 themes; web spot-check; node --check;
install-cep.sh; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary.
```

**Model:** Sonnet 5. State-machine fix with clear acceptance criteria.

---

## SC_47 — Voice tool: the whole voice list is dumped on screen — it must open on demand

**Problem (owner report + Voice over screenshot).** The audio tool prints the entire
voice catalog as ~18 always-visible pills (4 rows), plus a "Settings"/"Voice" label
block and a long explainer line ("Voice: type the text — it will be read aloud in a
natural voice. Up to 1000 characters per generation."). It dominates the panel. Owner:
the voice settings must appear when clicked, not sit open.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (audio tool: Voice over / Sound FX; node --check; install-cep.sh
after edits) and packages/assetflow-studio/platform/index.html (same audio composer if
it has this layout). 3 themes via var(--…) tokens. 🔴 Money guard: the model/cost
display ("Chirp 3 HD · ✦4"), Enhance ✦1 and Generate cost stay exactly as they are and
remain visible. UI constitution applies (zone budget, progressive disclosure —
functionality relocated, never removed).

CHANGE — voice selection becomes an on-demand picker:
1. Replace the always-open voice pill grid with ONE compact chip in the composer's
   control row: `[🔊 Aoede — EN·GB ⌄]` (icon + current voice name, ellipsis at narrow
   widths, full value in title tooltip). It sits with the other control chips, obeying
   the established chip rules.
2. Clicking it opens a picker (reuse the existing model-sheet/popover mechanism in each
   app — do NOT build a new component): searchable list of all voices, grouped or
   labelled by language, with gender tag; current voice checked; selecting closes and
   updates the chip. Keyboard: Esc closes, arrows navigate if the reused component
   already supports it.
3. If a voice PREVIEW capability already exists, keep it inside the picker; do not add
   one if it does not exist.
4. DELETE the "Settings" and "Voice" label rows and the explainer line ("Voice: type
   the text — it will be read aloud in a natural voice. Up to 1000 characters per
   generation."). The character limit moves into the textarea's counter/placeholder
   behaviour: show a small counter only when the user approaches the limit (e.g.
   ≥80%), and the existing notice pill when exceeded.
5. Sound FX tab: check it for the same pattern (dumped settings / explainer lines) and
   apply the same treatment — its own settings behind one chip, no permanent explainer.
6. Selected voice must persist per the existing preference mechanism and be sent in the
   payload exactly as today (verify the request is unchanged with a quote/gen call).

QA: audio tool in both apps × 3 themes × plugin 320/420/900: composer height drops
substantially (state before/after in the summary); chip shows the current voice; picker
opens/searches/selects/closes; payload identical to before for the same voice (compare
a cost-quote request before/after); character-limit behaviour works; Sound FX tab
checked; node --check; install-cep.sh; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary.
```

**Model:** Sonnet 5. Contained disclosure change reusing existing popover machinery.

---

## SC_48 — Two logos stacked: the sub-view header repeats the brand mark (and the
## avatar/refresh) already in the top bar

**Problem (owner report + My Library screenshot).** The global top bar shows the ⚡ logo
+ "FrameFlow" + refresh + credits + avatar. Directly beneath it, the My Library sub-
header shows the ⚡ logo AGAIN, plus its own refresh icon and its own avatar. Two logos,
duplicated controls, two chrome bars — a violation of the UI constitution (one chrome).

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (node --check; install-cep.sh after edits) and
packages/assetflow-studio/platform/index.html (check for the same duplication).
3 themes via var(--…) tokens. UI CONSTITUTION rule 1 (one chrome) is the point of this
task. Money guard: the credit chip stays in the top bar, untouched.

PROBLEM: sub-view headers (My Library shown in the screenshot; check every sub-view:
session picker, workspace, template detail, Projects, Sessions, settings) render their
own chrome — brand logo, refresh, avatar — duplicating the persistent top bar.

FIX:
1. Sub-view headers keep ONLY: back button (←) + the view title (+ view-specific meta
   like counts). Remove the duplicated brand logo, refresh icon and avatar from EVERY
   sub-view header.
2. If a sub-view's refresh is functionally distinct from the top bar's global refresh,
   do NOT drop the capability: fold it into that view's ⋯ menu (per the constitution)
   and say so in the summary; if it is the same refresh, just remove it (top bar owns
   it). Verify the top-bar refresh actually refreshes the currently open sub-view — if
   it doesn't, wire it (that is the point of a single global refresh).
3. The avatar/Account is owned by the top bar only.
4. Result: exactly ONE logo and ONE avatar visible on any screen — grep/inspect to
   prove no other sub-view still renders them (list the audited views in the summary).
5. Reclaim the vertical space freed by the slimmer sub-header.

QA: walk every sub-view in both apps × 3 themes × plugin 320/420/900: one logo, one
avatar, one refresh; back button works everywhere; top-bar refresh refreshes the open
view; nothing else lost (⋯ mapping listed); node --check; install-cep.sh; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
audited-view list.
```

**Model:** Sonnet 5. Chrome de-duplication with a capability-preservation check.

---

## SC_49 — Remove Favorites entirely — Projects already covers it (one concept, not two)

**Problem (owner report + ★ button screenshot).** The app has BOTH a Favorites/star
feature and Projects. They are two mechanisms for the same job (saving things for
later). Owner's decision: **delete Favorites; Projects stays.**

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (node --check; install-cep.sh after edits),
packages/assetflow-studio/platform/index.html, and apps/api (only as described in
step 4). 3 themes via var(--…) tokens. Money guard: nothing here touches credits.

GOAL: remove the Favorites concept from the product; Projects is the single way users
save/organize items.

STEPS:
1. INVENTORY first (report it): every Favorites touchpoint — the ★ button on template
   detail and any cards, favorites filters/tabs/views, "favorited" badges, sort-by-
   favorites options, any Favorites entry in menus/Account, plugin AND web; plus the
   client code, CSS and strings behind them.
2. DATA CHECK before deleting: does the backend store favorites (a table/column/route)?
   If YES, check whether any user data exists. Then:
   - Remove the CLIENT UI and its calls in this task.
   - Leave the backend table/routes IN PLACE but unreferenced (do not drop data or run
     a destructive migration); note in the summary that a later cleanup migration is an
     owner decision. If a route becomes fully unused, say so — do not delete it here.
3. MIGRATION PATH for users: if favorites data exists, do NOT silently strand it —
   propose (in the summary, do not build) a one-off "Favorites → a project named
   'Favorites'" import the owner can approve later. If the data is empty/trivial,
   state that and skip.
4. Wherever the ★ sat (e.g. template detail's action row), the space is reclaimed —
   do not replace it with another control; the existing "Add to project" affordance
   remains the save action. Verify "Add to project" is present and working on every
   surface that previously offered ★ (template detail, gen cards' Use ▾ menu) — if a
   surface had ★ but no project action, ADD the existing add-to-project action there
   so no save capability is lost.
5. Purge dead CSS/strings/handlers; grep both files afterwards for favorite/fav/star
   remnants and include the grep in the summary (ignore unrelated uses of "star" in
   icons used elsewhere).

QA: both apps × 3 themes: no ★ anywhere, no favorites filters/views; add-to-project
works on every surface that previously had ★; nothing throws (removed handlers
guarded); plugin 320/900; node --check; install-cep.sh; web console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
inventory, the backend-data finding, and the proposed migration note.
```

**Model:** Sonnet 5. Feature removal with a data-safety check.

---

## SC_50 — Home is thin (hero + recent + templates): make it a rich, attractive,
## multi-function start screen (Director's structure decision)

**Problem (owner report + Home screenshot).** Home only offers templates and gen cards.
The owner wants it beautiful, engaging and multi-functional — with attractive cards —
and asked the Director to decide the structure.

**Director's decision — Home = 6 zones, in this order. Every zone is driven by REAL
data; a zone with no data is HIDDEN (never faked, never an empty placeholder):**

1. **Hero — prompt-first.** Keep the CMS hero (media + copy), but add the single most
   valuable interaction: a one-line prompt input inside the hero ("Describe your next
   shot…"). Typing + Enter (or the ✦ button) opens AI Tools with that prompt
   pre-filled in a NEW session. The two existing CTAs stay as secondary buttons.
2. **Jump back in** — recent generations (exists today; keep).
3. **Continue a session** — the user's most recent sessions as compact cards (thumb,
   name, N generations, updated-ago) → opens that session directly. Real session data.
4. **Explore** — a row of curated AI Stock items (the "Add to Explore" pipeline already
   feeds an admin-approved pool). Inspiration + a clear action per card: "Use as
   reference" / open in AI Tools. This is the attractive, discovery-driven zone.
5. **Browse by category** — 6 compact tiles for the catalog kinds (Video Templates ·
   Motion Graphics · Graphics · LUTs · Music · SFX), each with a real item count and a
   thumbnail collage from that category → opens the catalog pre-filtered.
6. **Fresh for your next cut** — the template shelf (exists today; keep) + Browse all.

**Rules:** the UI constitution applies (card face = media, actions on hover, ≤5
always-visible controls per zone, tokens only, no mono-caps labels). Every section
heading is CMS-editable via the existing plugin content-config (extend it additively).
Order is fixed; zones hide when empty; Home still fills the panel height at any size
and packs without dead space.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Primary target: plugins/after-effects-cep/
AssetFlow_Plugin.html (Home = the .fhome surface; node --check; install-cep.sh after
edits). Secondary: packages/assetflow-studio/platform/index.html — apply the same
zones on the web dashboard where the equivalent data exists (report what you did).
Backend read-only unless step 5 requires an additive field: apps/api/src/routes/
studio-gen.ts (sessions), the catalog/AI-Stock routes, apps/api/src/lib/
plugin-content-config.ts (CMS). 3 themes via var(--…) tokens. 🔴 Money guard: the
hero's live model/price chip keeps coming from the model catalog; no cost logic
changes.

BUILD Home as SIX zones, in this exact order, all fed by REAL endpoints; a zone with
no data renders NOTHING (no placeholder, no fake items):

1. HERO (keep the existing CMS hero: media, kicker, title, sub, live model chip) +
   NEW: a single-line prompt input inside the hero ("Describe your next shot…") with a
   ✦ submit; Enter or ✦ → open AI Tools, create/enter a NEW session for the default
   mode and pre-fill the composer with that text (reuse the existing new-session and
   composer-fill paths; do NOT auto-generate or spend credits — the user still presses
   Generate). The two existing CTAs remain as secondary buttons.
2. JUMP BACK IN — recent generations (exists; keep, restyled to the current card
   recipe: media face, Use ▾ inside the card on hover).
3. CONTINUE A SESSION — up to 6 recent sessions from the sessions endpoint: thumb of
   the latest item, session display name (the derived/renamed title logic), "N
   generations · updated-ago"; click → open that session directly (reuse the picker's
   open path).
4. EXPLORE — curated AI Stock items from the existing Explore/AI-Stock source (find the
   endpoint the Stock Catalog's AI Stock section uses); horizontal row of media cards;
   per-card action on hover: open the item, plus "Use as reference" if that capability
   exists for the current tool (reuse existing handlers only).
5. BROWSE BY CATEGORY — 6 tiles (Video Templates · Motion Graphics · Graphics · LUTs ·
   Music · SFX) built from the catalog's category counts (use the existing catalog
   endpoint's counts/facets; if counts are not exposed, either derive them from an
   existing lightweight call or omit the number — do NOT invent numbers and do NOT add
   6 separate requests). Each tile: small thumbnail collage from that category (reuse
   already-fetched items where possible) + label + count → opens the catalog
   pre-filtered to that category.
6. FRESH FOR YOUR NEXT CUT — the existing template shelf + Browse all (keep).

ALSO:
- CMS: extend the plugin content-config schema ADDITIVELY with the new section
  headings (continue-sessions, explore, categories) so admins can edit them; defaults
  = the strings you ship. Update the admin Plugin CMS editor accordingly (ROOT source
  + `npm run studio:sync`).
- Performance: Home must not fire a request storm — batch/reuse existing fetches
  (models, history, sessions, catalog) and keep the established throttles; lazy-load
  media below the fold; measure and report the request count on a cold Home load.
- Layout: full-height fill and no dead gaps at 320-2500px; zones separated by the
  spacing scale; horizontal rows scroll with edge fades (per the established pill/row
  pattern).

QA: plugin 320/420/900/1600 × 3 themes × states: brand-new user (no gens, no sessions
→ those zones hidden, Home still looks complete), returning user (all zones), offline
(cached/empty degradation, no black voids); hero prompt → lands in AI Tools with the
text pre-filled in a NEW session and NO credits spent; every card/tile navigates
correctly; request count reported; node --check; install-cep.sh; web console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
per-zone data source, the cold-load request count, and what you applied on the web.
```

**Model:** Fable 5 (High). New surface composition wired to several existing data
sources + CMS extension.

---

## SC_51 — Motion system: tasteful, modern micro-animations (Director's verdict + spec)

**Owner question.** Can cards and functions animate on interaction — modern and
tasteful, not childish? **Director's verdict: YES, but only as a disciplined motion
SYSTEM, never decorative.** Motion must answer "what just happened / where did it go".
Constraints: the plugin runs inside AE's CEF — heavy effects cost AE performance; the
panel HTML is ~1MB with long lists, so animations must be GPU-cheap and never run on
scroll-heavy paths.

**THE MOTION LAWS (binding; any deviation = defect):**
1. **Only `transform` and `opacity`** animate. Never width/height/top/left/box-shadow/
   filter/blur on interaction paths.
2. **Durations:** hover/press feedback 80–120ms · panel/menu/sheet enter 150–200ms,
   exit 120ms · view transitions ≤200ms. Nothing longer, anywhere.
3. **Easing:** `cubic-bezier(.2,.8,.2,1)` (decelerate) for enter, `ease-in` for exit.
   **No bounce, no spring, no elastic, no rotation-for-fun, no color-cycling.**
4. **Distance is small:** translate ≤8px, scale between .97 and 1.02. Nothing flies
   across the screen.
5. **Origin-anchored:** menus/popovers/sheets scale-fade FROM their trigger; a card
   opening into a viewer grows from the card's position (shared-element feel using the
   card's already-loaded thumbnail — pairs with the "no black flash" fix).
6. **Lists stagger cheaply or not at all:** at most 6 items, 20ms apart, only on first
   paint of a section — never on scroll, never on re-render, never with virtualization.
7. **Respect `prefers-reduced-motion: reduce`** → all of the above collapse to instant
   opacity swaps. Ship this from day one.
8. **Never animate:** prices/credit numbers, error states, anything that would delay a
   user action. Motion never gates interaction — clicks work mid-animation.
9. **Budget:** no more than 2 animated properties per element, no infinite loops except
   a single existing progress indicator; measure — no interaction may drop below 60fps
   in the plugin.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (node --check; install-cep.sh after edits) and
packages/assetflow-studio/platform/index.html. 3 themes via var(--…) tokens. Money
guard: credit/cost displays never animate and never move.

GOAL: introduce ONE shared motion system across both apps, per the Director's motion
laws (quoted below), and apply it to the interaction points listed. This is polish —
no behaviour, routing or data changes.

MOTION LAWS (binding):
- animate ONLY transform/opacity; durations: hover/press 80-120ms, enter 150-200ms,
  exit 120ms, view transitions ≤200ms; easing cubic-bezier(.2,.8,.2,1) in / ease-in
  out; NO bounce/spring/elastic/rotation/color-cycling; translate ≤8px, scale .97-1.02;
  menus/sheets animate FROM their trigger's origin; list stagger max 6 items × 20ms,
  first paint only, never during scroll or with virtualization; full
  `prefers-reduced-motion: reduce` support (instant opacity swaps); never animate
  prices/errors; motion never blocks clicks; ≤2 animated properties per element; keep
  60fps in the plugin.

IMPLEMENTATION:
1. Define tokens in each app's CSS: --mo-fast/--mo-enter/--mo-exit durations and
   --mo-ease-in/--mo-ease-out, plus a `@media (prefers-reduced-motion: reduce)` block
   that neutralizes them. All animations reference these tokens — no ad-hoc numbers.
2. Apply to exactly these interaction points (nothing else in this task):
   a. Cards (gen cards, template cards, category tiles, session rows): hover = scale
      1.01 + hover-controls fade in; press = scale .99. No shadow animation.
   b. Card → viewer/detail open: origin-anchored grow from the card using its cached
      thumbnail; close reverses to the card's position. Pairs with the no-black-flash
      work — if that task has not landed, implement the thumbnail-first paint here.
   c. Menus/popovers/sheets (Use ▾, model picker, voice picker, Account sheet, ⋯
      menus): scale .97→1 + fade from the trigger origin; exit faster.
   d. View/tab switches (Home ⇄ AI ⇄ Stock, sub-view push/pop): 150ms fade + ≤8px
      slide in the navigation direction; back reverses it.
   e. New items arriving in a feed (a finished generation): fade + 6px rise, single
      item only — never re-animate the whole list.
   f. Toasts/notice pills: rise 8px + fade in, fade out.
   g. Buttons: press scale .98 (Generate included — but its cost tag must not move).
3. Audit and REMOVE any existing animation that violates the laws (long durations,
   layout-property transitions, bouncy easings) — list them in the summary.

QA: plugin — record/step through each interaction at 320/900 widths × 3 themes; verify
with DevTools Performance that interactions stay ~60fps and no layout thrash (paint/
layout counts) on the card grid with 100+ items; verify `prefers-reduced-motion`
disables everything; confirm clicks work during animations; web — same checks on
desktop and ~390px; node --check; install-cep.sh; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary listing
each animated interaction, the tokens, removed violations, and the fps measurement.
```

**Model:** Fable 5 (Medium). Systemic polish with hard performance constraints.

---

## SC_52 — Admin-curated "New" and "Top" template rails on Home, gently auto-scrolling
## (full chain: admin → API → plugin + web) + Director's revised Home order

**Problem/request (owner).** Home (plugin AND web) must show **newly released templates**
and **top templates** as animated, continuously moving rails. **The ADMIN decides which
templates appear in each rail.** The whole chain must actually work. The Director must
also decide where these sit on Home so it stays beautiful and easy to use.

**Director's revised Home order (supersedes SC_50's zone list; SC_50's other zones keep
their specs):**

1. **Hero** — prompt-first (SC_50 zone 1).
2. **New releases** — admin-curated rail, auto-scrolling → replaces the generic "Fresh
   for your next cut" shelf (the shelf is DELETED; this rail is its curated successor).
3. **Jump back in** — recent generations (hidden for new users).
4. **Continue a session** — recent sessions (hidden for new users).
5. **Top templates** — admin-curated rail, auto-scrolling in the OPPOSITE direction
   (visual rhythm, and it reads as a different list).
6. **Explore** — curated AI Stock (SC_50 zone 4).
7. **Browse by category** — 6 tiles (SC_50 zone 5), closing the page as the "go wider"
   exit.

Rationale: a returning user sees personal zones (3, 4) high up; a brand-new user — for
whom 3 and 4 are hidden — still gets a full, attractive page: hero → New → Top →
Explore → Categories. Two rails are far apart so the page never looks like a slot
machine.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Full chain across: apps/api (content-config lib +
admin/public routes), packages/assetflow-studio/js/admin-plugin-cms.js (+ any admin
Website/Plugin CMS view registration; edit ROOT source then `npm run studio:sync`),
plugins/after-effects-cep/AssetFlow_Plugin.html (Home; node --check; install-cep.sh
after edits), packages/assetflow-studio/platform/index.html (web Home/dashboard).
3 themes via var(--…) tokens. 🔴 Money guard: no pricing/credit logic touched; PRO/FREE
badges on cards keep their existing meaning.

GOAL: admin-curated "New releases" and "Top templates" rails on Home in BOTH apps,
continuously auto-scrolling, driven end-to-end by admin selection.

1. BACKEND (additive):
   - Extend the plugin content-config (apps/api/src/lib/plugin-content-config.ts)
     ADDITIVELY with two curated lists, e.g.
     `home.rails: { newReleases: { title: string, templateIds: string[] },
                    topTemplates: { title: string, templateIds: string[] } }`
     (cap each list at ~12 ids; ids only — never denormalized template data).
   - Public read: the existing GET /api/plugin/content-config carries them (same 60s
     cache). The clients resolve ids against the CATALOG endpoint they already use —
     do NOT add a new template-fetch route if the catalog endpoint can return a set of
     ids (check it; if it cannot, add a minimal additive query param, e.g. `?ids=`, to
     the existing catalog route — nothing else).
   - Resolution rules: ids that no longer exist / are unpublished are silently skipped;
     if a whole list resolves empty, the client hides that rail.
   - Also check whether the WEB reads this config today; if the web uses a different
     config source, wire it to the same public endpoint so both apps share one truth.
2. ADMIN UI (Plugin CMS view): a "Home rails" section with two pickers (New releases,
   Top templates): search templates by title, add → ordered list with drag-to-reorder
   (or up/down buttons if drag is not already available in this admin), remove, live
   thumbnails, count/limit indicator; plus an editable rail title each. Save via the
   existing PUT; Reset via the existing DELETE.
3. CLIENTS — the rail component (identical recipe in both apps):
   - Horizontal rail of template cards (the established card recipe: media face, title,
     FREE/PRO badge, no contributor name), auto-scrolling CONTINUOUSLY and slowly
     (marquee: ~20-40s per full loop; New = left, Top = right), seamlessly looping by
     duplicating the item set.
   - MOTION DISCIPLINE (this rail is the ONE sanctioned continuous animation; it must
     obey the rest): animate with `transform: translate3d` only; PAUSE on hover/focus,
     while a menu/sheet is open, when the rail is scrolled by the user, when the
     document/panel is hidden (visibilitychange) or the rail is off-screen
     (IntersectionObserver); `prefers-reduced-motion: reduce` → NO auto-scroll at all,
     it becomes a normal manually-scrollable row.
   - Manual interaction always wins: drag/wheel scrolling works; clicking a card opens
     the template detail (existing path).
   - Fewer items than fill the width → no looping animation, just a static row.
4. Home order (Director's decision): hero → New releases rail → Jump back in →
   Continue a session → Top templates rail → Explore → Browse by category. DELETE the
   old generic "Fresh for your next cut" shelf (the New rail replaces it). Zones with
   no data stay hidden.
5. Performance: the rails must not degrade the plugin — measure fps with both rails
   running plus a populated Home; lazy-load rail media; ensure no layout thrash (the
   marquee must be a pure transform on a container).

QA: end-to-end on the local stack — admin picks 5 templates for New and 5 for Top →
save → curl the public config → both clients show exactly those, in that order, with
the admin's titles; unpublish one template → it disappears from the rail without
breaking it; empty list → rail hidden; rails pause on hover/menu-open/hidden panel;
reduced-motion → static; click → detail; plugin 320/420/900/1600 × 3 themes; new-user
state (personal zones hidden) still looks complete; fps + request count reported;
node --check; studio:sync; install-cep.sh; web console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
chain verification steps and the measured fps/request count.
```

**Model:** Fable 5 (High). Full-chain feature: schema + admin UI + two clients + a
performance-sensitive animation.

---

## SC_53 — Web Stock Catalog wastes both side margins on wide screens (Director's
## container decision)

**Problem (owner report + web catalog screenshot at ~2600px).** The catalog content
sits in a narrow centered column (~1250px) with large empty margins left and right; the
grid stays at 4 columns no matter how wide the display is.

**Director's decision — two different container rules, applied consistently:**
- **Reading blocks stay centered and capped**: the hero headline, the search field and
  any prose keep a max-width (~720-820px) — a full-width headline or a 2500px-wide
  search box reads worse, not better.
- **Content grids go fluid**: the filter bar and the card grid span the full container
  (page padding only, `clamp(16px, 3vw, 40px)`), and the grid ADDS COLUMNS as space
  allows — never wider cards, never dead margins. Cap the column count only where cards
  would become smaller than the readable minimum.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Target: packages/assetflow-studio/platform/
index.html (web Stock Catalog + any other page using the same content container: AI
Stock, search results, dashboard grids). Do NOT touch landing (ffl-), admin/ or
contributor/. Also verify the plugin catalog already follows the fluid rule (it was
made full-panel earlier) — no plugin changes unless it regressed. 3 themes via
var(--…) tokens. Money guard: none here.

PROBLEM: on wide displays (1900-2600px+) the catalog is a ~1250px centered column with
huge empty side margins; the grid stays at 4 columns.

FIX (Director's container rules):
1. Page container becomes fluid: width 100% with horizontal padding
   `clamp(16px, 3vw, 40px)`; remove the fixed centered max-width from the catalog
   page's content wrapper (keep the sticky/filter bar aligned to the same padding).
2. Reading blocks keep a cap: hero eyebrow/headline and the search input stay centered
   with max-width ~720-820px (search may be a touch wider, ≤900px). They must not
   stretch across an ultra-wide screen.
3. Grid: `grid-template-columns: repeat(auto-fill, minmax(<min>, 1fr))` with min ≈
   240-260px so columns increase naturally: ~1280px = 4, ~1600px = 5, ~2000px = 6-7,
   2600px = 8ish. Add a sane upper bound only if cards would drop below the readable
   minimum (state your chosen numbers in the summary). Gutters from the spacing scale,
   equal horizontal/vertical.
4. Category pills / filter row: same fluid padding, horizontal scroll with edge fades
   at narrow widths (established pattern) — never clipped mid-word.
5. Check the pages sharing this container (AI Stock, search results, template detail,
   dashboard/library grids on web) so the whole app feels consistent — list what you
   changed.

QA: web at 1280/1600/1920/2200/2600 and ~390px/768px × 3 themes: no dead side margins
beyond the padding, column counts as specified, cards never distorted, hero/search
still centered and readable, filters aligned, virtualization/lazy-load unaffected with
100+ items; console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
chosen min column width and resulting column counts.
```

**Model:** Sonnet 5. Contained container/grid decision applied consistently.

---

## SC_54 — Composer controls must stay ONE row at EVERY panel width (no wrapping, no
## broken labels/icons)

**Problem (owner report + screenshot).** The composer's controls currently split across
two rows (mode/model/output/audio on one line, Enhance/Clear/Generate on the next) and
the arrangement changes as the panel is resized. Owner requirement: **regardless of how
large or small the plugin panel is, the settings and actions stay on ONE single row**,
and the labels/icons must never break, clip or distort.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Targets: plugins/after-effects-cep/
AssetFlow_Plugin.html (all three tools: image, video, audio — the composer control row;
node --check; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`) and
packages/assetflow-studio/platform/index.html (same rule where its composer has the
same row). 3 themes via var(--…) tokens. 🔴 Money guard: the Generate cost tag and
Enhance ✦1 keep their exact values and stay fully visible at EVERY width — they are
never truncated, never hidden, never moved off-row.

REQUIREMENT: the composer's control row is ALWAYS exactly ONE row, at every panel width
from 320px to 2500px and while the AE panel is being dragged/resized live. It must never
wrap to a second line, never overflow horizontally, and no label or icon may clip,
break mid-word, squash or distort.

IMPLEMENT a deterministic compaction ladder (CSS-first; JS only for measuring if
unavoidable). The row contains, in order: mode · model · output · audio · Enhance ·
Clear · Generate(+cost). As available width shrinks, degrade in THIS priority order —
each step applies only when the previous is not enough:
  step 0 (wide): all chips with full labels.
  step 1: drop secondary label words (e.g. "480p · Auto" stays, "AUDIO Off" → toggle +
          short label).
  step 2: model chip truncates its NAME with ellipsis (min ~8 visible chars) — the
          chevron and icon never clip; full value in the title tooltip.
  step 3: Clear → icon-only (tooltip keeps the word).
  step 4: mode chip → icon-only; audio → toggle only.
  step 5: Enhance → icon + ✦1 (word dropped, credit stays).
  step 6 (narrowest): output chip → icon + value only.
NEVER degraded: Generate — it always shows its label + cost tag in full.
Rules: `flex-wrap: nowrap` on the row; each chip `min-width:0` with its own
`text-overflow: ellipsis` on the LABEL span only (icons/badges/chevrons are
`flex-shrink:0`); no horizontal scrollbar; hit areas stay ≥24px at every step; no
layout jump when a step triggers (transition only per the motion tokens).
Implement the steps with container-driven CSS (container queries if supported in this
CEF build — verify; otherwise width breakpoints on the composer wrapper, or a single
ResizeObserver that sets a `data-compact="0..6"` attribute on the row). If you use
ResizeObserver, debounce ~100ms and hook it into the existing live-resize handler
rather than adding a second listener.

QA (must be continuous, not just at breakpoints): drag-resize the panel from 320 →
2500px and back on EACH tool × 3 themes, with a LONG model name selected (e.g. "Gemini
Omni Flash (Google Cloud)") and audio ON: the control row is always exactly one row
(assert `offsetHeight` stays within one row's height and `scrollWidth <= clientWidth`
at ~30 sampled widths — automate this check and paste the results); no clipped icons,
no broken words, Generate + cost always fully visible; tooltips carry the full values;
node --check; install-cep.sh; web spot-check (~390px → desktop); console clean.

Finish: commit (clear message, no Co-Authored-By), do NOT push, short summary with the
sampled-width assertion output and the compaction ladder as implemented.
```

**Model:** Fable 5 (Medium). Deterministic responsive rule with automated verification.

---

## SC_56 — Plugin finishing + full self-audit before live AE testing

**Purpose.** Close the remaining PLUGIN-side gaps from earlier tasks and do a systematic
self-audit of every plugin surface, so the owner's live After Effects test starts from a
known-clean state. Three parts: (A) finish the deferred plugin pieces, (B) audit +
fix every surface/handler, (C) produce a live-AE test checklist.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Primary target: plugins/after-effects-cep/
AssetFlow_Plugin.html (~1.15MB, 7 inline scripts). Rules: validate every edited inline
script with node --check; keep all ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 themes (noir/neon/cold) via
var(--…) tokens. Local stack for QA: `npm run studio` (API :4000) + a signed-in seed
user (user@assetflow.uz / user123). Backend read-only unless a part explicitly needs an
additive field. 🔴 MONEY GUARD: no changes to credit/cost/quote/HMAC/webhook logic or
any price VALUE. UI CONSTITUTION binding: one chrome · card face = media, actions on
hover/focus · ≤5 always-visible controls per zone (rest behind ⋯) · progressive
disclosure (nothing removed, only relocated) · theme tokens only · prices always
visible.

Work the three PARTS in order. Commit after EACH part (3 commits), no push. If a part
is blocked, record it and continue.

PART A — finish the deferred plugin pieces (from SC_50 / SC_52 / the ⋯ overflow idea):
1. Home "Explore" zone: add the curated AI-Stock row on the plugin Home between
   Continue-a-session and Browse-by-category (find the endpoint the Stock Catalog's
   "AI Stock" section already uses; reuse it — no new route). Card face = media, hover
   action "Use as reference" only if that handler exists for the current tool; hide the
   whole zone if the source is empty. Fits the full-height/masonry Home rules.
2. Home category counts: the "Browse by category" tiles show REAL counts from the
   existing catalog facets/counts; if counts are not exposed, omit the number (do NOT
   invent) and do NOT add 6 requests — reuse one call.
3. CMS-editable Home section headings: the new plugin Home sections (continue-sessions,
   explore, categories) read their titles from the plugin content-config if present
   (the schema was extended earlier — verify; if a heading field is missing, add it
   ADDITIVELY to apps/api/src/lib/plugin-content-config.ts + the admin editor, ROOT
   source + `npm run studio:sync`). Empty → ship default string.
4. Composer overflow ⋯ (finishing SC_54/SC_55): at the narrowest widths, any control
   that no longer fits the single row must NOT be clipped/hidden — it collapses into a
   single "⋯" settings button placed just left of Enhance, opening a popover (reuse the
   existing popover mechanism) that holds the SAME live controls (same handlers/state,
   not copies), with full labels/values. Collapse priority: output & audio first, then
   mode, then model; Generate(+cost) and Enhance ✦1 never collapse, never clip. Every
   control reachable at every width — either in the row or in the ⋯ popover.

PART B — full plugin self-audit (fix what you find; this is the core value):
Walk EVERY logged-in surface and verify each interactive element's handler is bound and
fires, at plugin widths 320/420/900 × 3 themes. Surfaces: top bar (seg Home/AI/Stock,
credit chip → top-up, avatar → Account), Home (all zones + rails + hero prompt),
AI Tools launcher, session picker (+ New session, open, rename), each gen workspace
(image/video/audio: [+] menu, attachment strip, all composer chips + pickers, Enhance,
Clear, Generate, collapse), gen cards (open = no black flash, Use ▾ menu = all 7
actions), My Library (filters, masonry, Use-inside), Stock Catalog (search, category
pills, filters, card → detail, Import), template detail (Import, Add to project),
Projects (select + bulk delete), Account sheet (plan, theme switch, download folder,
Sessions/Projects entries, Sign out), guest/login.
For EACH surface produce a row in an audit table: surface → controls checked → PASS /
FIXED(root cause) / BLOCKED(needs live AE or backend). Fix every dead click, console
error, broken layout, off-token color, clipped/overflowing text you find. Confirm:
node --check clean on all 7 scripts; browser console clean on every surface; no
duplicate chrome; no favorites remnants; no upscale remnants; no "History" remnants.

PART C — deliver a LIVE-AE test checklist (docs, no code):
Write docs/PLUGIN-LIVE-AE-CHECKLIST.md — a concrete, ordered checklist the owner runs
inside real After Effects after Cmd+Q relaunch: install, sign in, each nav tab, resize
the panel small↔large (one-row composer + full-panel fill), create a session, generate
one cheap item per mode (image/video/audio) and confirm it appears + the completion
toast, open a gen and Import to AE (the ONLY step that truly needs AE — confirm the
comp/footage lands), Use ▾ each action, import one Stock template into AE, theme
switch, sign out/in. For each step: what to click, what "pass" looks like, and what to
screenshot if it fails. Mark which steps were already verified in browser cep-mode vs
which are AE-only.

DELIVERABLE (summary): PART A per-item result, PART B audit table, PART C file path,
and a single "plugin readiness" verdict line (what is green, what still needs live AE
or deploy).
```

**Model:** Fable 5 (High). Finishing pass + systematic audit across the whole plugin.

---

## SC_57 — Seedance/BytePlus: diagnose the generation FAILURE + add the remaining
## BytePlus models (backend + both clients + plugin)

**Problem (owner report + 2 screenshots).**
1. Generating through Seedance (BytePlus) FAILS: the history shows a Seedance 2.0 job
   "Failed · 50 cr · Refunded" for the same prompt where Gemini Omni succeeded — so
   Seedance specifically is broken. Diagnose and fix the real cause.
2. The BytePlus/ModelArk console has more ACTIVATED models than the app exposes
   (screenshot: Dola-Seedream-5.0-pro, Dreamina-Seedance-2.0, Dreamina-Seedance-2.0-fast,
   Dola-Seedream-5.0-lite, ByteDance-Seedream-4.5, …). Read the BytePlus docs fully,
   analyze every BytePlus model, and add the missing ones — correctly wired end to end,
   visible in web AND plugin.

**⚠️ This task is MONEY-ZONE ADJACENT.** Adding a new model introduces NEW price values
(allowed) but must NOT touch the FROZEN logic (existing consume/refund, cost-quote HMAC,
computeGenCost/imageUnitCost bodies, webhook idempotency, or any EXISTING model's price).
New prices follow the project's margin rule and the boot cost-assertion.

### Prompt for Claude Code

```
Repo ~/Projects/creative-tools-saas. Scope: apps/api (BytePlus adapter + model catalog
+ studio-gen route), plugins/after-effects-cep/AssetFlow_Plugin.html (node --check;
install-cep.sh after edits), packages/assetflow-studio/platform/index.html (web).
Local stack: `npm run studio` (API :4000). 🔴 MONEY GUARD: do NOT modify credit
consume/refund, the signed cost-quote/HMAC (lib/gen-quote.ts), the bodies of
computeGenCost/imageUnitCost, webhook idempotency, or any EXISTING model's price value.
Adding NEW models with NEW prices is allowed but each new price MUST follow the repo's
margin rule and pass the boot cost-assertion (a channel sold below cost must refuse to
boot — verify it still holds).

TRUTH SOURCES (read fully; do NOT guess BytePlus behavior):
- docs/BYTEPLUS-DOCS-MODELS.md (per-model exact schema: param names, input format,
  output shape, pricing)
- docs/BYTEPLUS-ANALYSIS.md
- docs/FAL-AI-CATALOG.md / docs/GEN-MODEL-MATRIX.md (KEEP/REPLACE/ADD verdicts + matrix)
- apps/api/src/lib/ai/byteplus.ts (the adapter — how requests/responses are built)
- apps/api/src/lib/gen-models.ts (existing Seedance/Seedream entries: seedream-5-0-260128,
  dola-seedream-5-0-pro-260628, dreamina-seedance-2-0-*)
- apps/api/src/routes/studio-gen.ts (POST /gen + /gen/cost-quote validation + how jobs
  run and how failures/refunds are recorded)
- apps/api/src/lib/gen-processor.ts (job processing)
If the repo docs lack a specific field for a NEW model, you MAY fetch the official
BytePlus/ModelArk docs for THAT field only — but the repo docs remain authoritative
where they exist.

PART 1 — DIAGNOSE THE SEEDANCE FAILURE FIRST (highest priority; a real refund is
happening):
Reproduce a Seedance 2.0 video generation against the local API (or trace the code path
end to end) and find why it FAILS while other providers succeed. Check, in order: the
byteplus.ts request payload built for Seedance (param names/format vs
BYTEPLUS-DOCS-MODELS.md — e.g. duration string vs number, aspect/resolution keys, i2v
frame keys), the ModelArk model ID/region/endpoint, auth header (`Authorization: Key`),
the queue/submit + poll handling, the response parsing (CDN URL → GCS), and any timeout.
Fix the ROOT cause so Seedance completes. Confirm the refund path still fires correctly
ONLY on genuine failure (do not break refund). Do NOT alter credit math — only the
request/response correctness. State the exact root cause in the summary.

PART 2 — ADD THE REMAINING BYTEPLUS MODELS:
1. Enumerate every BytePlus model that is ACTIVATED in the console/docs but NOT yet in
   gen-models.ts (from the screenshot at least: Dreamina-Seedance-2.0-fast,
   Dola-Seedream-5.0-lite, ByteDance-Seedream-4.5; plus any others the docs list).
   Produce a table: model → mode(image/video) → docs schema ref → activation/prepay
   requirement → verdict (ADD now / needs prepay-pack / skip + reason).
2. For each ADD: create the gen-models.ts entry using the EXACT schema from
   BYTEPLUS-DOCS-MODELS.md (byteplusModel ID, mode, referenceMode, supported aspects/
   resolutions/durations, frame support, param mapping) and the adapter path in
   byteplus.ts (extend the adapter only if a new model needs a param the adapter
   doesn't build — additive, no change to existing model handling). Price each new
   model from its official BytePlus cost via the repo's margin rule; set enabled:true
   ONLY for models whose price is confirmed and whose activation needs no missing
   prepay pack — otherwise enabled:false with a clear comment (a disabled catalog entry
   must not be sellable). Never sell a channel below cost (boot-assertion).
3. Wire visibility: the new models appear in the model picker in BOTH web and plugin
   (same catalog source — no client hardcoding), with correct per-model composer
   controls (SC_42 capability map picks them up automatically if the entry is complete;
   verify).
4. Verification: extend and run the per-model payload script
   (verify-gen-payloads.mjs) so EVERY enabled model — old and new — builds a valid
   payload that passes /gen/cost-quote against the local API. Then do ONE real cheap
   generation per newly-enabled model if activation allows (image models are cheap);
   for video, at minimum confirm Seedance 2.0 now SUCCEEDS end to end. Paste the
   per-model PASS/FAIL table.

RULES: additive only; `npm run build -w apps/api` passes; if a model needs a prepay
pack the owner hasn't bought, leave it enabled:false and list it as an owner action —
do NOT hack the client. node --check the plugin; install-cep.sh; web console clean.

DELIVERABLE (summary): the Seedance root cause + fix; the added-models table with prices
and enabled state; the per-model verification table; and any owner actions (prepay
packs, region/keys).
```

**Model:** Fable 5 (High / Extra). Provider-integration debugging + catalog extension
next to the money zone — maximum care, docs-grounded.

---

# MASTER EXECUTION ORDER — ROUND 3 (Director's ordering, 2026-07-17)

One prompt per fresh Code session (`/clear`). In-group order is binding.

**Group A — structure & removals first (later polish must sit on the final markup):**
1. **SC_41 — PART B ONLY** (delete the new-session empty-state screens; PART A is
   superseded by SC_42 — do not run it)
2. **SC_49** (remove Favorites — do the deletions before anything restyles those rows)
3. **SC_48** (one chrome: kill duplicate logo/avatar/refresh in sub-views)
4. **SC_47** (voice picker on demand)

**Group B — composer rebuild (the core surface):**
5. **SC_42** (exact anatomy + per-model UX + all-model verification)
6. **SC_43** (icon capacity indicator — refines SC_42's `[+]`, must run after it)

**Group C — data/state correctness:**
7. **SC_46** (session open: loading state, never flash empty)
8. **SC_44** (gen card open: no black flash — thumbnail-first paint)

**Group D — Home & catalog composition:**
9. **SC_50** (Home: 6 zones, real data, CMS headings)
10. **SC_52** (admin-curated New/Top rails + Director's revised Home order — supersedes
    SC_50's zone list; run right after SC_50)
11. **SC_45** (My Library masonry packing + Use inside the card)
12. **SC_53** (web catalog fluid container + column growth)

**Group E — motion last (animates the FINAL structure):**
13. **SC_51** (motion system; its card→viewer transition pairs with SC_44 — if SC_44
    landed, extend it rather than reimplement)

**Notes for Code:** SC_42 supersedes SC_41 PART A · SC_52 supersedes SC_50's zone
ordering · SC_43 depends on SC_42 · SC_51 runs last so it animates final markup.

**Owner deploy checkpoints:** after Group B (plugin install + AE ⌘Q live check) · after
Group D (push + API deploy + CF Pages, since SC_50/SC_52 extend the CMS schema and admin
UI + a possible additive catalog `?ids=` param) · final: full AE E2E.
