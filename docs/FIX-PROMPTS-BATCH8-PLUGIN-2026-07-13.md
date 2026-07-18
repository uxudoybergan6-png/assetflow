# FIX PROMPTS — BATCH 8 · AE plugin redesign (match the web / BATCH6 design system)

> Goal: the AE CEP plugin (`plugins/after-effects-cep/AssetFlow_Plugin.html`) gets the SAME
> look & feel as the redesigned web platform (BATCH6: 3 themes noir/neon/cold, Space Grotesk/
> Inter/JetBrains Mono, Higgsfield-style composer). Flow: mockup first → USER approves →
> then port prompts. Copy ONE prompt per Claude Code run.

---

## 🛑 STOP — THE PLUGIN'S FUNCTIONALITY WAS REBUILT (owner decision, 2026-07-13)

A parallel workstream (the `MUAMMOLAR` A→J blocks) **rewrote the plugin's composer, catalog and
import logic in production**. This batch is now **SKIN ONLY**.

**Already LIVE in the plugin (do NOT redesign away, do NOT "simplify"):**
- **ONE `⚙` settings sheet** (was: 4 separate sheets). Mandatory — the panel is too narrow for the
  old row.
- **Reference slots** (`@start` / `@end` / `@imgN`) that **survive a model switch** — dimmed with a
  reason, never deleted. **`@N` numbering is bound to the pool and is NEVER renumbered.**
- Parallel generations (5 image / 3 video) · Generate **disabled before the click** when credits are
  short · pill ✕ · **⌘Z undo** · Finder file drop.
- **Music + Sound Effects tabs** · raw-media import (`.mp4/.wav/.png`) · LUT download+reveal.
- **Server-side catalog** (filter/search/sort/paginate) + **list virtualization** (5 000 cards froze AE).
- "Add to Explore" on generation cards (AI Stock) · honest provider-rejection toasts + refund notice.
- Watermark: Free plan gets watermarked files, paid plans get the clean original — **server-enforced**.

### 🔴 BINDING SCOPE (owner: option B) — ⚠️ SUPERSEDED 2026-07-16

> **OWNER DECISION 2026-07-16 (after live AE test of the skin port): option B is REVOKED.**
> New scope: **STRUCTURAL 1:1 with the corrected mockup** (`docs/mockups/batch8-plugin/`),
> **BEHAVIOUR PRESERVED**. Markup/layout is rebuilt to mockup anatomy; the underlying logic
> (endpoints, credit math, job lifecycle, reference pool, undo, drops) is rewired to the new
> DOM but NOT rewritten. Executed as Prompt #R1 (AI Studio) + Prompt #R2 (everything else),
> live AE test between them. The feature-survival list below still applies in full.

**~~BATCH8 = VISUAL SKIN ONLY.~~** Tokens, typography, spacing, colours, hover/focus states, iconography,
3 themes. ~~**Structure and behaviour stay exactly as shipped.**~~ (superseded — see above)

**A mockup that removes/merges/renames any of the features above is WRONG — fix the mockup, not the
plugin.** If a port prompt would change behaviour → **STOP and ask the owner.**

Three things that look like bugs but are deliberate — do NOT "fix" them:
1. Reference `@N` numbering is never renumbered on model switch.
2. Dimmed (inactive) references are kept on purpose — they are not dead UI.
3. Any prompt-softening / filter-evasion layer is **forbidden** (removed on purpose — it violated
   Google/BytePlus ToS and risked account termination).

Context: `docs/MUAMMOLAR-2-MAHSULOT.md` (P13, P16, P20, P22, P30) · `docs/DIREKTOR-HANDOFF.md` §5.

---

## GLOBAL RULES (include with every prompt)

- FRONTEND/DESIGN only. Never touch `apps/api`, credit values, or backend files. Mockup
  prompts must not modify the production plugin or platform.
- **DESIGN SOURCE = the BATCH6 system:** tokens/typography/components as shipped in
  `packages/assetflow-studio/platform/index.html` (3 themes) and `docs/mockups/batch6/`.
  The plugin mockup must look like the SAME product as the web.
- **CEP CONSTRAINTS ARE LAW:** AE has NO internet (fonts must be self-host/system — in the
  mockup you may inline/system-fallback, but note the port plan); panel is NARROW and
  resizable (design for 320 / 420 / 600px widths); embedded Chromium is older than desktop
  Chrome — avoid bleeding-edge CSS (`:has` ok to avoid; no container queries; test-safe
  flex/grid only); everything in ONE self-contained file philosophy.
- English UI text; Uzbek code comments. When finished: commit (no Co-Authored-By), do NOT
  push, write a short summary.

---

## Prompt #0-R — REDO: web-only design, plugin used ONLY as a feature checklist

**Why a redo (USER feedback 2026-07-13):** the first mockup leaned on the current plugin's
structure/visuals. That is wrong. **The current plugin UI is NOT a design reference — you are
FORBIDDEN from using its markup, CSS, layout, pane structure, or visual patterns as design
input.** Rebuild `docs/mockups/batch8-plugin/` from scratch.

**Rules of engagement:**
1. **DO NOT OPEN ANY PLUGIN FILE. AT ALL.** `plugins/after-effects-cep/**` is off-limits for
   this prompt — no reading, no grepping, zero influence. The required FEATURE SET is given
   here, complete, by the Director; build the mockup from THIS list only:
   - Auth: email/password login · Google device-code flow (code display + "waiting" state) ·
     logged-in account chip with plan + credits ✦.
   - Browse: template catalog (search, category pills, video-templates focus), template card
     (thumb, duration, Free/PRO, Ae chip), template detail, Download & Import into AE with
     progress bar, disabled-import state when pack is unavailable, ↻ Sync.
   - AI tools (subscriber, credit-based): tool launcher; Image compose (model, aspect,
     quality, ×count, refs strip, prompt with @mention pill + dropdown, Enhance ✦1, ✦cost +
     Generate); Video compose (model, resolution, duration, audio toggle, start/end frame
     slots, refs, edit-preset chips Replace/Edit/Inpaint); Voiceover (voice pick, text);
     SFX (prompt, duration); Video/Image Upscale (source pick, factor); result view (poster,
     Import to AE / Save, ✦cost + model label).
   - My Library: past generations grid, filter by type, bulk select + delete, empty state.
   - Settings: theme picker (3 themes), account info, API status row, sign out.
   - System states: offline/API unreachable · low credits + Top up · moderation-refund error
     ("real human face…") · update-available banner · success/error toasts · loading skeletons.
   - CONCEPT (badge it): Seedance 2.0 multimodal refs pane (web-only today).
2. **DESIGN SOURCE = THE WEB, PERIOD.** The mockup must look like the BATCH6 web app
   (`platform/index.html` after prompts #1-#4 + `docs/mockups/batch6/`) compressed into a
   narrow panel: the web's dashboard-style quick actions, the web's docked composer with chip
   row and accent Generate, the web's result cards with mono ✦cost labels, the web's model
   picker rows, the web's dropdown/modal/toast styles, the web's type scale (adapted down),
   the SAME 3 theme tokens verbatim. If a screen exists on the web (Studio panes, library,
   credit top-up, model picker), the plugin version is a NARROW variant of that exact design
   — layout adapts (single column, tighter spacing), the language does not change.
3. For each mockup pane, mentally ask: "does this look like a shrunk web screen?" If it looks
   like the old plugin — defect, redo it.

Everything else (deliverable format, chrome with theme/width switcher, real model names+costs
from `apps/api/src/lib/gen-models.ts` READ-ONLY, CEP constraints, quality bar, commit rules)
is inherited from the spec below — EXCEPT its "PHASE 1 PLUGIN INVENTORY", which is REPLACED by
the feature list above (plugin files stay unopened).

---

## Prompt #0.5 — Mockup gap-fix + short-height audit (run AFTER #0-R is done)

> Status: #0-R shipped (`docs/mockups/batch8-plugin/index.html`, 25 panes, 3 themes × 3 widths,
> hash deep-links). Director review 2026-07-15 found it strong but with gaps.
> **OWNER DECISION (2026-07-15): Dashboard B ("Visual / creative launchpad") is the DEFAULT Home.**

Work ONLY inside `docs/mockups/batch8-plugin/` (zero-build, single file philosophy stays).
Include the GLOBAL RULES above. Do not touch production plugin/platform/backend files.

**1. Lock the Home decision.**
- `dashboard-b` stays the default pane (it already is in `state.pane`); keep it first in nav.
- Rename nav entry for pane `dashboard` to "Dashboard A · Archived" and add a small `ARCHIVE`
  badge inside that pane's hero so nobody ports it by mistake. Do NOT delete it (reference).

**2. New pane: `browse-progate` (group: Browse).**
Free user taps a PRO template. State-card in the web language: PRO badge + template poster
(reuse `.detail-poster` + `.art-*`), copy like "This is a Pro template. Your plan: FREE.",
primary CTA "Upgrade on the web ↗" (plugin has NO checkout — CTA opens the browser; note this
in a `.notice`), secondary "Back to catalog" (`data-go="browse-catalog"`). Mirror the web's
inline gate tone — honest, no dark patterns.

**3. New pane: `ai-progress` (group: AI Studio).**
The most-seen real state is missing: generation running. Same `ai-workspace` chrome, result
grid with THREE card states side by side: (a) RUNNING — poster area with animated shimmer +
progress % + elapsed time + model/✦cost label + "Cancel" button; (b) QUEUED — dimmed card,
"Queued · starts automatically"; (c) DONE — normal result card for contrast. Composer stays
usable underneath (parallel generations are real: 5 image / 3 video). Add a `.notice` line:
"You can keep working — generations continue in the background." Do NOT invent refund copy on
Cancel (money-zone) — button + toast "Cancel requested" is enough for the mockup.

**4. Panel HEIGHT presets + audit (the panel is resizable in AE, mockup is locked to 820).**
- Add a "Panel height" segmented control (820 / 620 / 500) next to the width control, wired
  like width (`data-height`, hash param `height`, size readout "W × H").
- Audit EVERY pane at 320×500 and 420×500 (worst cases). Required outcomes: the AI composer
  dock remains reachable (it may scroll with content — but must not overflow the panel or
  clip its Generate button); `dashboard-b` hero shrinks at height ≤620 (add
  `.panel[data-height="500"]`-style rules: hero ~200px, action cards min-height down);
  auth card fits 500px without clipping; state-cards center without cut-off. Fix what breaks
  with height-scoped rules only — do not regress 820.

**5. Popover polish.** Close any open `.ai-popover` / model modal on outside click and on
Escape (ES5 only: `document.addEventListener("click"/"keydown")` — no bleeding-edge APIs).

**6. 1:1 WEB PARITY PASS (OWNER DEMAND, 2026-07-15 — hard requirement).**
The plugin must read as a 1:1 narrow variant of the web, not "inspired by" it. Use the
side-by-side tool `docs/mockups/batch8-plugin/compare.html` (web BATCH6 left, plugin right)
and go through EVERY pair it lists. For each pair, compare component by component against
the web source (`docs/mockups/batch6/` + `platform/index.html`): type scale & letter-spacing,
button/pill/chip shapes, composer dock anatomy (refs strip → prompt → settings row → cost +
Generate), model-picker row anatomy (icon · name · ✦price), result-card anatomy, badge and
mono-label styling, toast styling, empty-state tone. Rule: if an element exists on the web,
the plugin version must be the SAME element adapted only in width/spacing — different shape,
different hierarchy or different wording is a DEFECT: fix the plugin mockup to match the web.
Layout may reflow (single column, tighter paddings); the visual language may not diverge.
Deliver a parity table in the summary: pair → checked components → deviations found → fixed.

**7. Quality bar.** New panes token-first, leak-free in all 3 themes; no console errors.
Verify: 2 new panes × 3 themes × (420×820, 320×500) + dashboard-b at 3 heights + the full
compare.html pair list after parity fixes.
Commit only `docs/mockups/batch8-plugin/` (no Co-Authored-By), do NOT push, short summary
with the checked screenshot list.

---

## Prompt #0.6 — Parity source correction (mini-fix, run after #0.5 / commit ecc1364)

**Root cause.** #0.5's parity pass treated the BATCH6 mockup (`docs/mockups/batch6/`) as
truth. But the SHIPPED web (`packages/assetflow-studio/platform/index.html`) intentionally
diverged from that mockup in places. **NEW BINDING RULE for all BATCH8 work: when the BATCH6
mockup and `platform/index.html` disagree, PRODUCTION (`platform/index.html`) WINS.**
Director verified production values below — do not re-derive them from the batch6 mockup.

Work ONLY in `docs/mockups/batch8-plugin/index.html`. Revert 3 of #0.5's parity changes to
the production values (keep everything else from #0.5, including the preset-chips row —
production has it):

1. **Enhance label:** "Improve" → **"Enhance · ✦1"** everywhere it was relabelled (all
   composers), busy/toast copy back to "Enhance…"-style. Production:
   `enhBusy ? 'Enhancing…' : 'Enhance · ✦1'`.
2. **Model modal:** header back to **"Choose a model"**, search placeholder back to
   **"Search models…"** (drop "MODEL LIBRARY / Choose the engine for this idea." and
   "Search all live models…").
3. **Composer setting buttons:** back to **pill shape (border-radius:999px)** for `.ai-set`
   (production `.va-set` is 999px, height 34px); restore `.ai-generate` radius to its
   pre-#0.5 value.

Quick re-verify: ai-image composer + model modal in noir/neon at 420. No other changes.
When finished: commit only `docs/mockups/batch8-plugin/` (no Co-Authored-By), do NOT push,
2-line summary.

---

## Prompt #0 (asl spec — #0-R bilan birga o'qiladi; PHASE 1 bekor, #0-R ro'yxati amal qiladi)

**Goal.** Build a from-scratch mockup `docs/mockups/batch8-plugin/index.html` (self-contained,
double-click opens) showing the ENTIRE plugin rebuilt in the web's BATCH6 design language —
every pane, every state, 3 themes, 3 panel widths. The current plugin UX/visuals are
considered fully replaceable; do NOT carry over its look — only its FUNCTIONS.

**PHASE 1 — PLUGIN INVENTORY (mandatory, before any mockup code).**
Read `plugins/after-effects-cep/AssetFlow_Plugin.html` (+ `assetflow-catalog.js`,
`css/tokens.css`, jsx bridge touchpoints) and enumerate EVERY pane/view/state the plugin has
today: login (incl. Google device-code flow), Browse/catalog (tabs, search, filters, sync),
template cards + import flow (download progress, hasPack gating), AI tools launcher and each
tool pane (image, video i2v/frames, voice, SFX, upscale — incl. BATCH5 chip editor/@mention
dropdown, preset chips, refs strip), My Library, settings (incl. current 3-theme picker),
toasts/errors/empty states, plugin-update/version notice, PROBLEM 3 note (media-refs models
web-only today). Also list JSX/host interactions that constrain UI (import button states,
progress events). Output the inventory as a table (real pane/state → mockup section id) in
the summary AND as an HTML comment in the mockup.

**PHASE 2 — WEB DESIGN ANALYSIS.** Read the BATCH6 token block + components in
`platform/index.html` (and `docs/mockups/batch6/screens.css`) and extract the reusable design
vocabulary: the 3 theme token sets, type scale, chip/pill/button/card/dropdown/modal styles,
composer dock pattern, result-card pattern, mention-pill/preset-chip styling. The plugin
mockup must reuse these tokens VERBATIM (adapted spacing for narrow widths).

**PHASE 3 — MOCKUP.** `docs/mockups/batch8-plugin/index.html` (+ optional screens.css/js in
the same folder, zero-build):
1. **Chrome:** fixed control bar — theme switcher (A noir / B neon / C cold), panel-width
   presets (320 / 420 / 600), pane navigator grouped (Auth · Browse · AI Tools · Library ·
   Settings · States). Content renders inside a "panel frame" sized to the chosen width so
   the user judges the REAL plugin proportions.
2. **Every inventoried pane rebuilt in web language:** compact top bar (logo mark, credits
   ✦, sync, avatar) → Browse (search, category pills, template cards adapted to narrow
   column, import CTA + progress states, hasPack-blocked card state) → template detail →
   AI launcher (tool grid like the web quick-actions) → each tool pane with the docked
   composer (model pill, aspect/quality/duration chips, ✦cost, accent Generate; chip-editor
   prompt area with a mention pill example; preset chips on video) → My Library (result
   cards, bulk select) → Settings (theme picker in new style, account, API status) →
   Auth (login, device-code) → States (offline/API-unreachable, low credits + top-up,
   moderation error, update-available, empty browse, import success toast).
3. **Real content:** real enabled model names + ✦costs from `gen-models.ts` (read-only);
   real plugin feature set (PROBLEM 3: show Seedance 2.0 pane as a "coming to plugin"
   concept section, clearly badged CONCEPT — the rest must be today's real functions).
4. **Quality bar = BATCH6 mockup level:** hover states, spacing rhythm, mono labels,
   no unstyled elements, no console errors, all 3 themes leak-free at all 3 widths.
5. Commit only `docs/mockups/batch8-plugin/`; do NOT push. Summary: inventory table +
   excluded list + screenshots list (pane × theme × width spot-checks).

**Out of scope:** touching the real plugin, platform, backend; new features beyond CONCEPT
sections; AE host.jsx changes.

---

## Prompt #1 — PORT 1/2: mockup correction + token foundation + chrome + Dashboard B + Auth

> Owner consolidation decision (2026-07-15): the port ships in TWO prompts. #0.6 is folded
> into this prompt as STEP 0. Model: Fable 5 (High).

**MISSION.** Port the approved BATCH8 mockup design (`docs/mockups/batch8-plugin/index.html`,
commit ecc1364 + the STEP 0 corrections) into the REAL plugin
(`plugins/after-effects-cep/AssetFlow_Plugin.html` + `css/tokens.css`, `css/styles.css`,
`css/ff-components.css`). **SKIN ONLY** — this batch restyles; it does not rewrite logic.

**BINDING CONSTRAINTS (violations = defect):**
- SKIN ONLY: JS behaviour, API calls, credit math, handlers, pane switching logic stay
  byte-identical in effect. You may add classes/markup for presentation and a new Home pane
  (approved), but no logic rewrites. If a styling change would require behaviour change —
  STOP and flag.
- MONEY-ZONE untouchable: credit consume/refund, cost-quote, any ✦ values shown come from
  existing runtime data — never hardcode new numbers.
- Features that MUST survive visually intact (production decisions — do not "simplify"):
  ONE ⚙ settings sheet · reference slots that dim (never delete) on model switch · @N
  numbering NEVER renumbered · parallel generations (5 img / 3 vid) · Generate pre-disabled
  when credits short · pill ✕ · ⌘Z undo · Finder file drop · Music + SFX tabs · raw-media
  import · LUT download · server-side catalog + virtualization · "Add to Explore" ·
  honest rejection toasts + refund notice.
- PRODUCTION WINS: where the batch6 mockup and `packages/assetflow-studio/platform/index.html`
  disagree, production wins ("Enhance · ✦1", "Choose a model", "Search models…", pill-shaped
  composer setting buttons).
- CEP LAW: NO network assets — fonts only from `plugins/after-effects-cep/css/fonts/`
  (bundle Space Grotesk / Inter / JetBrains Mono woff2 there if missing); inline SVG only;
  ES-level and CSS must run on AE 2022+ embedded Chromium (no :has, no container queries);
  panel resizable — design for 320/420/600 widths AND ≥500px heights.
- English UI text; Uzbek code comments. Minimal diff per file.

**STEP 0 — mockup correction (in `docs/mockups/batch8-plugin/index.html` first):**
(a) "Improve" → "Enhance · ✦1" everywhere (busy copy "Enhancing…"); (b) model modal header
→ "Choose a model", search placeholder → "Search models…"; (c) `.ai-set` back to
border-radius:999px pills (production `.va-set`: 999px, height 34px), `.ai-generate` radius
back to pre-#0.5 value. The corrected mockup is then the design source of record.

**STEP 1 — token + type foundation in the plugin.** Replace/extend `css/tokens.css` with the
3-theme token layer (noir/neon/cold) exactly as in the corrected mockup `.panel[data-theme]`
blocks (values are identical to production `--th-*`). Theme attribute on the plugin root;
persist choice in existing prefs/localStorage mechanism (reuse the plugin's current theme
persistence if present — do not invent a new storage system). Type: Space Grotesk (display),
Inter (body), JetBrains Mono (labels) from local fonts. Restyle global primitives to mockup
spec: buttons (primary grad/secondary/ghost/danger), pills, chips, badges, inputs, notices,
toasts, skeletons, scrollbars.

**STEP 2 — app chrome.** Top bar per mockup `app-bar`: brand mark + context label, account
chip (plan · ✦ balance, live values), avatar. Navigation restyled per mockup (structure/
order of existing panes unchanged).

**STEP 3 — Dashboard B Home (approved new pane, presentation-only).** Port mockup pane
`dashboard-b`: greeting topline + balance chip, media hero (use real catalog/gen data the
plugin already has; static gradient fallback), two action cards (AI Studio / Stock Catalog)
navigating to EXISTING panes, "Fresh for your next cut" shelf fed by the existing catalog
data path (no new API). It becomes the default post-login pane; height ≤620 shrink rules
from the mockup apply.

**STEP 4 — Auth skin.** Login, Google device-code, signed-in account per mockup panes
(auth-login / auth-device / auth-account). Flows and endpoints untouched.

**VERIFY.** `node --check` on every touched satellite .js; DOM/handler smoke check per repo
convention; 3 themes × 320/420/600 × heights 820/500 on: login, device-code, dashboard-b,
one catalog pane (untouched panes must not visually break from the new primitives — spot-fix
regressions). `bash plugins/after-effects-cep/scripts/install-cep.sh` at the end (USER
restarts AE for live test).

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) short summary: what was ported, regressions found/fixed, what remains for PORT 2/2.

---

## Prompt #2 — PORT 2/2: Browse + AI Studio + Library/Settings/States + final QA

> Run AFTER Prompt #1 is committed and USER has seen it live in AE. Model: Fable 5 (High).

**MISSION.** Finish the skin port of `plugins/after-effects-cep/AssetFlow_Plugin.html` using
the corrected mockup (`docs/mockups/batch8-plugin/index.html`) as design source of record.
Same BINDING CONSTRAINTS as Prompt #1 (SKIN ONLY · money-zone untouchable · feature-survival
list · production wins · CEP law · English UI / Uzbek comments) — re-read them in
`docs/FIX-PROMPTS-BATCH8-PLUGIN-2026-07-13.md` Prompt #1 block before starting.

**STEP 1 — Browse surfaces.** Catalog (search box, ↻ Sync, category pills, template cards:
thumb/duration/FREE-PRO badge/Ae chip, virtualized list keeps working), template detail
(poster, spec grid, tag pills, import CTA), import progress card, pack-unavailable state,
Pro-gate state per mockup `browse-progate` (CTA opens web — reuse existing openWebAdmin/
browser-open mechanism).

**STEP 2 — AI Studio.** Composer dock per corrected mockup: refs strip (dimmed-slot styling
preserved!), @mention pill styling, preset chips, prompt area, pill setting buttons
(mode/model/output popovers), "Enhance · ✦1", cost + accent Generate, balance strip +
Top up. All 5 modes (image/video/upscale/voice/SFX) + edit-preset chips on video. Progress
states per mockup `ai-progress` (running shimmer/queued/done) mapped onto the EXISTING job
lifecycle events; result cards (Save / Use / Import to AE) per mockup `ai-result`. Model
modal: "Choose a model" + "Search models…", rows icon·name·✦price from live model catalog.

**STEP 3 — Library, Settings, States.** My Library grid + bulk select + empty state;
Settings: 3-theme picker cards (wired to Prompt #1 persistence), account block, API status,
sign out; system states: offline, low credits + top up, moderation-refund, update banner,
toasts, loading skeletons — all per mockup panes.

**STEP 4 — FINAL QA (blocking).** (a) Feature checklist: walk the survival list from
Prompt #1 and confirm each is present and functional-looking in the new skin. (b) 3 themes ×
320/420/600 × heights 820/500 across ALL panes; no token leaks, no clipped Generate, no
unstyled remnants of the old skin. (c) `node --check` on touched .js; DOM/handler smoke
check. (d) `bash plugins/after-effects-cep/scripts/install-cep.sh`.

When finished: (a) commit (no Co-Authored-By); do NOT push. (b) summary: QA checklist
results table + anything deferred, so the USER can run the live AE test (login + ↻ Sync +
one generation + one import).

---

## Prompt #3 — Post-port polish: model-sheet search + app-bar anatomy (deferred items)

> Run after PORT 2/2 (34636f6). Model: Fable 5 (Medium). Owner sanctioned ONE small
> behaviour addition (model search filter); everything else stays SKIN ONLY.

**File:** `plugins/after-effects-cep/AssetFlow_Plugin.html` only.
**Binding constraints:** same as PORT 1/2 block above (money-zone untouchable · feature
survival list · production wins · CEP law: ES5-safe, no network, AE 2022+ · English UI /
Uzbek comments · minimal diff).

**TASK 1 — Model sheet search (sanctioned behaviour addition).**
The image + video model sheets (compact `.sheet.pop` popovers) get a search input at the
top per the mockup's `.ai-model-search`: placeholder **"Search models…"**. Client-side
only: case-insensitive substring filter on the EXISTING model row names as the user types;
non-matching rows `display:none`; all rows restored when cleared or when the sheet reopens.
Zero matches → one muted line "No models found". Do NOT touch row markup, selection
handlers, model ordering, pricing labels, or how the sheet opens/closes (Escape/outside
click keep working). No new API calls.

**TASK 2 — App-bar anatomy per mockup (presentation-only restructure).**
Restructure the existing top bar to the mockup `app-bar` anatomy: brand mark + two-line
brand copy (product name + CONTEXT LABEL in mono caps showing the active pane, e.g.
"STOCK CATALOG · VIDEO" / "AI STUDIO" / "MY LIBRARY") + account chip (plan · ✦ balance) +
avatar. Rules: (a) KEEP the existing functional nav segment (Catalog/AI) — restyle it as
mockup-style pills, do not remove it; (b) preserve every existing element id and handler
the JS relies on (credit sync ids like `#hdrCred`, plan hooks, avatar/account handlers) —
move nodes, don't recreate them; (c) the context label is wired to the EXISTING pane-switch
code path (read current pane state where it already changes — presentation only, no new
routing); (d) works at 320/420/600 widths (320: hide avatar like the mockup, ellipsize the
context label).

**VERIFY.** 3 themes × 320/420/600 (+ one 500-height pass): app-bar intact on every pane,
credit/plan values still live-update, model search filters and restores, Escape still
closes sheets; extract inline `<script>` blocks → `node --check` all OK; zero console
errors; `bash plugins/after-effects-cep/scripts/install-cep.sh`.

When finished: (a) commit (no Co-Authored-By), do NOT push. (b) 5-line summary.

---

## Prompt #R1 — STRUCTURAL 1:1: AI Studio rebuilt to mockup anatomy (behaviour preserved)

> Owner decision 2026-07-16: skin-only scope REVOKED. The live AE test showed the old pane
> structure (launcher page, PROMPT/SETTINGS cards, per-mode header) — the owner requires
> STRUCTURAL 1:1 with the mockup. Model: Fable 5 (High/Extra). Run in a fresh session.

**MISSION.** Rebuild the AI Studio surface of
`plugins/after-effects-cep/AssetFlow_Plugin.html` to the EXACT anatomy of the corrected
mockup (`docs/mockups/batch8-plugin/index.html`, panes ai-image / ai-video / ai-voice /
ai-sfx / ai-upscale / ai-result): the old launcher page ("AI Tools" cards + Tools/Sessions/
Projects tabs) and the old card-stack composer are REPLACED by the mockup's workspace:

1. **Session strip** (top): ＋ New · My Library · session buttons — fed by the EXISTING
   sessions data/handlers (old Sessions tab content maps here). Projects functionality must
   remain reachable (map it into the strip or a pill — flag your choice in the summary).
2. **Viewbar:** Visuals/Audio tabs with counts · session meta · grid density toggle.
3. **Stage:** result grid (existing result/job cards rendered in mockup card anatomy:
   media, hover actions Save / Use ⌄ / Import to AE, info line MODEL · SPEC · ✦COST);
   empty state = mockup's Sparky hero + suggestion chips; running/queued states per the
   mockup ai-progress card language, driven by the EXISTING job lifecycle events.
4. **Docked composer** (bottom, always present in the workspace): refs strip (＋ add,
   thumbs, dimmed-slot styling and @N numbering EXACTLY as shipped — never renumber),
   ref meta line, edit-preset chips (video), prompt area (the shipped BATCH5 chip editor
   with @mention pills MOVES here — do not reimplement it), expand toggle, settings row =
   mode pill (Image/Video/Upscale/Voice/SFX popover — replaces the old per-mode header
   segment), model pill (with the #P3 search), output pill (existing ⚙ sheet content),
   "Enhance · ✦1", cost + accent Generate (pre-disable on low credits preserved),
   balance strip + Top up.

**BEHAVIOUR PRESERVED (hard):** all handlers, endpoints, credit math, cost preview, quota
gating, parallel generations (5 img / 3 vid), ⌘Z undo, Finder drop, paste, Add to Explore,
import-to-AE, refund toasts — rewired to the new DOM, not rewritten. Feature-survival list
from the Prompt #1 block applies in full. If any mockup element has no existing behaviour
behind it, style it as the mockup but wire it to the closest existing function — never
invent new API calls. Money-zone untouchable.

**CEP LAW:** ES5-safe, no network assets, AE 2022+ Chromium, fluid panel — verify
320/420/600 widths and 500px height (Generate must never clip).

**VERIFY.** Feature checklist table (every survival-list item → where it lives in the new
anatomy → works). 3 themes × 3 widths × 820/500 heights on all 5 modes + result/empty/
running states. Extract inline `<script>` blocks → `node --check`. Zero console errors.
`bash plugins/after-effects-cep/scripts/install-cep.sh`.
Commit (no Co-Authored-By), do NOT push. Summary: mapping table (old structure → new) +
anything you had to leave for #R2.

---

## Prompt #R1-FIX — LIVE AE BREAKAGE after #R1 (4e15e04): workspace invisible/broken

> USER live report (2026-07-16): after #R1, in REAL After Effects the AI Studio is broken —
> "the prompt chat is completely missing, everything is a mess". Director root-cause
> hypothesis: #R1's QA was INVALID — the panel column was 0-width in the browser preview,
> so QA was done on `#aiPage` DETACHED to a body overlay, never in its real layout position.
> The new `.axroot.axws-tool > .app > .scroll{overflow:hidden;min-height:0}` chain likely
> collapses/clips the whole workspace when the real ancestor height chain
> (html→body→#aiPage→.axroot→.app→.scroll) differs from the overlay hack.

**MANDATE.**
1. REPRODUCE PROPERLY FIRST (no overlay hacks, no detaching): serve the plugin, add
   `cep-mode` to body exactly as real CEP does, give the window a realistic panel size
   (420×820 and 340×640), navigate the REAL router path a signed-out AND mock signed-in
   user takes to the image view. The workspace must be verified IN PLACE. If the panel
   column is 0-width in the harness, FIX THE HARNESS (size the column), don't detach nodes.
2. Diagnose why the composer/prompt is invisible in place: inspect computed height/overflow
   of every ancestor in the chain; find where height collapses.
3. FIX with minimal CSS/JS changes (height chain made explicit; avoid `overflow:hidden` on
   shared `.scroll` unless the chain guarantees a bounded height; keep the ≤560px
   whole-scroll fallback). All #R1 behaviour/ids stay.
4. If the root cause cannot be fixed confidently, `git revert 4e15e04` cleanly, reinstall,
   and report — a working old-structure plugin beats a broken new one.

**VERIFY (in place, no detach):** image/video/audio views at 320/420/600 × 820/620/500,
3 themes, signed-out and mock signed-in; prompt editor visible and focusable, refs strip,
mode/model/output pills, Enhance, cost+Generate, balance strip all visible; other pages
(Home/Catalog/Library/Settings) unaffected. `node --check` all inline scripts; zero console
errors; `install-cep.sh`. Commit (no Co-Authored-By), do NOT push. Summary: root cause →
fix (or revert) + in-place screenshots list.

---

## Prompt #H1 — TAB-BY-TAB REBUILD · 1: HOME (Director's design spec; old plugin UI is NOT a reference)

> STRATEGY CHANGE (owner, 2026-07-16): the plugin is rebuilt TAB BY TAB from the Director's
> design spec. The current plugin's visual patterns are FORBIDDEN as design input. USER
> reviews each tab live before the next one starts. #R2 is frozen. Model: Fable 5 (High).
> Full prompt text lives in the Director chat; spec summary: fresh `.fhome`-scoped Home pane
> per the corrected mockup `dashboard-b` anatomy (topline greeting+balance · media hero with
> live model chip + 2 CTAs · 2 action cards · Fresh shelf from real catalog) wired to
> existing data (greeting/plan/credits/catalog/nav), IN-PLACE QA mandatory (no overlay
> hacks), 3 themes × 320/420/600 × 820/620/500.

---

## Prompt #R2 — STRUCTURAL 1:1: remaining surfaces (FROZEN — strategy changed to tab-by-tab)

**MISSION.** Finish structural 1:1 of `plugins/after-effects-cep/AssetFlow_Plugin.html`
with the corrected mockup for everything outside the AI workspace: Browse (catalog toolbar/
cards/detail/import-progress/pack-unavailable/pro-gate exactly per mockup panes), My
Library (grid, filter pills, bulk bar, empty state), Settings page (theme cards, account
block, API status, sign out), system states (offline, low credits, moderation refund,
update banner, toasts, skeletons), auth panes (login / device-code / account) — each to
mockup anatomy, behaviour preserved, same binding constraints as #R1 (re-read that block).
Also remove any dead remnants of the old launcher/header structure left after #R1.

**VERIFY.** Same bar as #R1 (themes × widths × heights, node --check, zero console errors,
install-cep.sh) + full feature-survival walk + a final pass of
`docs/mockups/batch8-plugin/compare.html` pair list confirming structural parity.
Commit (no Co-Authored-By), do NOT push. Summary: parity table + deferred list.