# FIX PROMPTS — BATCH 8 · AE plugin redesign (match the web / BATCH6 design system)

> Goal: the AE CEP plugin (`plugins/after-effects-cep/AssetFlow_Plugin.html`) gets the SAME
> look & feel as the redesigned web platform (BATCH6: 3 themes noir/neon/cold, Space Grotesk/
> Inter/JetBrains Mono, Higgsfield-style composer). Flow: mockup first → USER approves →
> then port prompts. Copy ONE prompt per Claude Code run.

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