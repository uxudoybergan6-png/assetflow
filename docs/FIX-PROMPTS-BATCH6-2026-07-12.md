# FIX PROMPTS — BATCH 6 · 2026-07-12 · Higgsfield-inspired web redesign

> Brief + survey results: `docs/BATCH6-REDESIGN-BRIEF.md`. Pattern analysis of Higgsfield
> screenshots is in that brief (§ naqsh-tahlili). Copy ONE prompt per Claude Code run.

---

## 🛑 STOP — READ THIS BEFORE PROMPT #6 (owner decision, 2026-07-13)

**A parallel workstream (the `MUAMMOLAR` A→J blocks) rebuilt AI Studio, the composer and the
catalog in production. `docs/mockups/batch6/` is now STALE for those surfaces.**

Production already has, and it is LIVE + owner-verified:

| Surface | Mockup shows | **Production now has** |
|---|---|---|
| Lightbox | small, forced 1:1, no panel | **large viewer, true aspect ratio, prompt/details panel, ←/→ nav** |
| Composer settings | 7 separate chips (wrapped) | **ONE `⚙ 16:9 / 720p / 5 Sec` chip + grouped popover** |
| Reference bar | flat thumbnails | **slot system** (`@start`/`@end`/`@imgN`), dimmed-but-kept on model switch |
| Catalog pills | 4 | **7** (+ Music, Sound Effects, AI Stock) |
| Catalog naming | "Templates" | **"Stock Catalog"** · type labels fixed |
| Filters | static toolbar | **context-aware per category** (LUTs has no App/4K, etc.) |
| Gen cards | CSS-background media | **real `<img>`/`<video>`, srcset, surface + elevation** |
| — | — | **"Add to Explore"** (AI Stock), drag&drop, paste, ⌘Z, Clear, pill ✕ |
| Detail page | hash route, no share | **real path `/stock/<type>/<slug>-<id>`, OG link previews** |

### 🔴 BINDING SCOPE FOR THE REST OF THIS BATCH (owner: option B)

**Prompt #6 (and anything after it) may ONLY touch the pages that were never redesigned:**
`pricing` · `plugin` page · `help/FAQ` · `legal pages` · footer/nav leftovers · remaining
hard-coded `lime` literals **on those pages only**.

**DO NOT TOUCH — these are DONE in the new design and any "mockup parity" edit is a REGRESSION:**
- **AI Studio** (composer, model picker, settings popover, reference slots, gen grid, lightbox,
  history/sessions)
- **Catalog** (`/stock`, pills, filters, detail page, routing, share/OG)
- **Credits screen** (real ledger)
- **The plugin** (see the same warning in `docs/FIX-PROMPTS-BATCH8-PLUGIN-2026-07-13.md`)

If a mockup screen and production disagree on those surfaces, **production wins**. If a prompt
appears to require changing them → **STOP and ask the owner.**

Reference for what was built and why: `docs/MUAMMOLAR-1-POYDEVOR-PUL-MIQYOS.md` +
`docs/MUAMMOLAR-2-MAHSULOT.md` (see also `docs/DIREKTOR-HANDOFF.md` §5).

**Three things that look like bugs but are deliberate — do NOT "fix" them:**
1. `isPublicReadKey()` allow-list (`apps/api/src/lib/public-keys.ts`) — loosening it **leaks every
   paid pack**.
2. Reference `@N` numbering is bound to the pool and is **never renumbered** on model switch —
   renumbering silently re-points every mention at the wrong image.
3. `softenPromptForSafety` (provider-filter evasion) was **found and removed**. Do not reintroduce
   any prompt-softening/euphemism layer — it violates Google/BytePlus ToS.

---

## GLOBAL RULES (include with every prompt)

- This batch is FRONTEND/DESIGN only. Never touch `apps/api`, credit values, or any backend
  file. Mockup prompts must not modify production pages at all.
- ⚠️ **MOCKUP PARITY NO LONGER APPLIES TO AI STUDIO / CATALOG / CREDITS** (see the STOP block
  above). For the remaining pages it still applies:
- **MOCKUP PARITY IS THE ACCEPTANCE BAR (remaining pages only):** `docs/mockups/batch6/` is the
  approved design. Every production prompt must port its sections 1:1 — same layout, spacing,
  type sizes, component styles, hover states — in all 3 themes. Verification MUST include
  side-by-side screenshots (mockup screen vs redesigned production page, same theme, 1280px) for
  each ported section; visible deviations are defects unless caused by REAL content (real
  thumbnails, CMS text lengths, live data) — adapt gracefully to real content, never
  simplify the design.
- English UI text; Uzbek code comments. Minimal diff outside the declared scope.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

---

## Prompt #0 — FULL-SITE palette mockup (3 themes × EVERY user-facing screen & state)

**Goal.** Produce ONE self-contained static mockup file `docs/mockups/batch6/index.html`
(no build step, no framework, opens by double-click) that lets the owner compare THREE design
directions across the ENTIRE user-facing web platform — every page, every major overlay/state,
with REAL FrameFlow content (real nav items, real model names & credit costs, real plan
features) — so the palette decision is made on the complete product, not a sample. This is a
THROWAWAY mockup: static fake interactivity, no production code reuse, no links to the live
app, no external images (CSS gradients/shapes as media placeholders — do NOT copy any
Higgsfield assets).

**PHASE 1 — MANDATORY PLATFORM INVENTORY (before writing any mockup code).**
Analyze the real platform and produce a coverage checklist:
1. Read `packages/assetflow-studio/platform/` — `index.html` (the SPA: enumerate EVERY view/
   route/state it renders: nav structure, landing sections, templates catalog + template
   detail, AI Studio panes (image AND video), sessions/history, projects, account/profile/
   billing/credits views, pricing, download flows, modals, toasts, empty states), plus the
   standalone pages (`login.html`, `help.html`, `terms/privacy/refund/dmca` legal pages, and
   any others present in the directory).
2. Read `apps/api/src/lib/gen-models.ts` (READ-ONLY) and list every `enabled: true` model
   with its REAL label, mode, credit cost and key settings (resolutions/aspects/durations) —
   the mockup's model dropdowns, model chips and cost labels must show THESE real values
   (e.g. Seedance 2.0, Seedream 5.0 Pro, Veo/Omni entries, Video Upscale (Topaz), Nano
   Banana/Imagen image models).
3. Output the inventory as a table at the TOP of your summary AND as an HTML comment at the
   top of the mockup file: real screen/state → mockup section id. NOTHING user-facing may be
   missing; if you consciously exclude something (e.g. admin console — excluded, it is
   internal), list it under "excluded" with a reason.

**PHASE 2 — build the mockup covering the full inventory.** Minimum screen set (expand with
whatever Phase 1 finds beyond this): Home/landing (all sections incl. promo strip, mega-menu
open state, hero, billboard, masonry feed, presets rail, FAQ, footer) · Templates catalog +
template DETAIL view (preview player area, meta, download/Pro gate) · AI Studio IMAGE pane ·
AI Studio VIDEO pane (start/end frame slots, media refs, mention pill, edit-preset chips,
docked composer, model dropdown OPEN, aspect dropdown OPEN, quality dropdown OPEN) ·
generations history/sessions view · projects view · auth (login + register incl. Google
button, Turnstile placeholder) · account (profile, plan/credits, billing) · pricing (3 real
plans w/ real features from the live landing config) · help/FAQ · one legal page template ·
STATES: empty gallery, generating/progress card, error toast, moderation-refund error message
("Reference contains a real human face…"), low-credits + Top up prompt.

**Reference material (read first):** `docs/BATCH6-REDESIGN-BRIEF.md` — survey results (user
dislikes: typography, density, component style, lifelessness; wants: premium mood, gallery
feed, composer UX, presets showcase) and the Higgsfield pattern analysis (feed-first home,
mega-menu, docked composer, model/aspect/quality dropdowns, draw canvas). Also see
`docs/BATCH6-PALETTE-MOCKUPS.html` for the approved starting token values of the 3 palettes.

**Structure.**
1. **Theme system:** all colors/shadows via CSS custom properties on `:root[data-theme]`.
   Three themes, seeded from BATCH6-PALETTE-MOCKUPS.html and refined:
   - `noir` (A · Noir Premium): bg #0A0A0B, surfaces #131316/#1B1B1F, text #FFF/#8F8F97,
     accent = WHITE buttons w/ black text, hairline borders rgba(255,255,255,.09).
   - `neon` (B · Neon Pulse, Higgsfield-mood): bg #050505, surfaces #0D0D0E/#151517,
     accent #D8FF3E (glow shadows rgba(216,255,62,.35)), mono badges, black-on-neon buttons.
   - `cold` (C · Cold Signal): bg #0B0E14, surfaces #10141D/#161B28, accent gradient
     #7C8CFF→#4FD8EB, borders rgba(124,140,255,.18).
   Typography (all themes): Space Grotesk (display/headings), Inter (body), JetBrains Mono
   (technical labels: costs, badges, section eyebrows) — Google Fonts link is fine for the
   mockup. Spacing scale 4/8/12/16/24/32/48/72; radius scale 10/14/18px + pill; motion:
   150-250ms ease transitions, card hover lift + border/glow, button hover states everywhere
   (the current site's "lifelessness" is a listed complaint).
2. **Fixed mockup chrome (not part of the design):** floating control bar with theme
   switcher (A/B/C) and a GROUPED screen navigator (groups: Home · Templates · AI Studio ·
   Account&Auth · Pages · States — each group expands to its screens). Switching updates
   `data-theme` / shows one `<section class="screen">` — plain JS, no deps. Every screen from
   the Phase 1 inventory is reachable here.
3. **Every screen built ONCE and themed purely by variables** (Higgsfield patterns from the
   brief; FrameFlow real content from Phase 1). Dropdown/menu overlays are rendered as static
   open states inside their screens.
4. **Quality bar:** this mockup IS the pitch — spacing generous, hierarchy sharp, hover
   states everywhere, no default-blue links, no unstyled elements. Desktop-first 1280px;
   must not break at 1024px. All text English. No copyrighted images/logos/text from
   Higgsfield — patterns only, FrameFlow naming throughout. Real model names + real ✦costs
   from Phase 1 in every composer/dropdown/result-card.
5. **Deliverable check:** file opens standalone; 3 themes × ALL inventoried screens
   switchable; no console errors. If the single file exceeds practical size, you may split
   into `index.html` + `screens.css` + `screens.js` inside `docs/mockups/batch6/` (still
   zero-build, relative paths). Commit only that folder; do NOT push. Summary MUST include
   the coverage table (real screen → mockup section, + excluded list).

**Out of scope:** touching `platform/index.html` or any production file, responsive/mobile
polish, real data, accessibility audit (basic semantics only), plugin UI.

---

## Prompt #0.5 — adversarial self-audit of the mockup (visual QA pass, fix everything found)

**Context.** `docs/mockups/batch6/` (index.html + screens.css/js) claims 41 screens × 3 themes,
verified content. Claims are not proof. Your job: act as a hostile design reviewer of your own
artifact, find every remaining deficiency VISUALLY, and fix it. Reference bars:
`docs/BATCH6-REDESIGN-BRIEF.md` (survey: typography, air/density, component quality,
liveliness; Higgsfield pattern analysis) and the Phase-1 inventory comment in index.html.

**Method (mandatory, in order).**
1. Serve the mockup locally and step through **every screen in every theme** (41×3) taking
   screenshots of at least: home, dashboard, templates, template-detail, ai-image, ai-video
   (all three open selectors), ai-history, projects, account-billing, login, pricing, plugin,
   help, one legal, and 6 representative `state-*` screens — in EACH theme. Actually LOOK at
   each screenshot; do not grep-only.
2. For each screenshot, score against a fixed checklist and log failures:
   (a) unstyled/browser-default elements; (b) contrast failures (text on gradient tiles,
   muted-on-dark below ~4.5:1 for body text); (c) spacing rhythm breaks (sections tighter than
   the 4/8/…/72 scale, cramped card innards); (d) typography hierarchy (display vs body vs
   mono labels — any screen where everything is one size/weight fails); (e) dead hover (any
   interactive-looking element with no hover/active state); (f) theme leaks (hardcoded colors
   that don't change across A/B/C — grep `#` hex values outside the token block AND verify
   visually); (g) overflow/clipping at 1024/1280/1440; (h) inconsistent components (two
   different button/chip/card styles for the same role on different screens); (i) empty or
   filler-looking areas ("lorem", repeated identical tiles side by side, obviously fake text);
   (j) mockbar overlapping content.
3. Fix EVERYTHING found. Re-screenshot the worst offenders after fixing to confirm.
4. Cross-check completeness once more against the live platform: open
   `packages/assetflow-studio/platform/` sources and confirm no user-facing view/state is
   missing from the navigator (pay attention to small ones: toasts, confirm dialogs, plan-gate
   modal, session-expired, 404). Add any missing as `state-*` sections.
5. Summary MUST list: every defect found (grouped by checklist letter) → fixed; screens added;
   before/after note for the 3 ugliest finds. Commit only `docs/mockups/batch6/`; do NOT push.

**Out of scope:** production files, new design directions (stay within the 3 defined themes),
content changes to real model names/costs (already verified).

---

## Prompt #1 — PRODUCTION: 3-theme token foundation + global chrome (nav/footer) + switcher

**USER DECISIONS (2026-07-12, binding):** the redesign ships with a USER-FACING theme picker —
3 themes everywhere (noir / neon / cold); **default = noir**. Token-first is mandatory: any
hardcoded color outside the token block is a defect.

**Context.** The approved design source is the mockup `docs/mockups/batch6/` (index.html +
screens.css — 46 screens × 3 themes, visually QA'd; commits 916c148/63b46dd). This prompt
starts porting it to PRODUCTION `packages/assetflow-studio/platform/index.html` (CF Pages
DIRECT source — edit in place; landing copy comes from Landing CMS config, do not hardcode
over it). Old identity (lime accent) is being fully replaced. Later prompts will redo each
page section-by-section; THIS prompt lays the foundation so those diffs stay small.

**Task.**
1. **Token layer:** port the mockup's `:root[data-theme="noir|neon|cold"]` custom-property
   blocks (colors, surfaces, borders, shadows/glows, gradient accent, danger via color-mix,
   radius scale, spacing scale, motion durations) into platform/index.html styles. Map the
   EXISTING page styles onto these tokens with a compatibility shim: current lime accent var
   usages resolve to the new theme accent so no page goes broken-unstyled during the
   transition. Delete no page-level CSS yet beyond what the shim replaces.
2. **Typography:** Space Grotesk (display), Inter (body), JetBrains Mono (labels). Check
   `_headers` CSP: Google Fonts host is already allowed (audit #17) — use it; if anything
   blocks, self-host woff2 under platform/assets/fonts (update prepare-cf-pages if asset
   copying needs it). Apply the type scale to base elements (h1-h4, body, mono labels) without
   yet redesigning individual sections.
3. **Global chrome redesign (mockup-accurate):** top nav (logo, nav links, NEW badge style,
   auth/credit area, avatar menu) and footer (4 columns + legal row) restyled to the mockup's
   design in all 3 themes. Mega-menu markup can wait for the Home prompt UNLESS it's cheap to
   port now (your call, flag it).
4. **Theme switcher:** `html[data-theme]`, default `noir`, persisted in localStorage
   (`ff-theme`), instant switch without reload; picker UI in the header (3 swatch dots or
   small menu — mockup style) AND in account settings if a settings view exists. No FOUC:
   inline snippet reads localStorage before first paint.
5. **Verification:** studio:sync not needed for platform/index.html (direct source) — confirm;
   `node --check` on extracted scripts; open the page locally and screenshot nav+footer+one
   content section in ALL 3 themes at 1280px; grep for leftover hardcoded lime/old-accent hex
   outside the token block and report the count (target: 0 in chrome, shim-mapped elsewhere).
   Commit; do NOT push.

**Out of scope:** per-page section redesigns (Home/Templates/Studio come next), plugin,
Contributor/Admin consoles, backend.

---

## Prompt #2 — PRODUCTION: Home/landing full redesign (mockup 1:1) + mega-menu

**Context.** Prompt #1 (commit b216fab) shipped the 3-theme token layer, fonts, nav/footer
chrome and the theme switcher into `packages/assetflow-studio/platform/index.html`. This
prompt ports the mockup's **`home` and `home-mega` screens** (`docs/mockups/batch6/` —
approved design) onto the production landing 1:1. The landing's TEXT comes from Landing CMS
config (`/api/landing/config`, dc-runtime `{{ }}` bindings) — every existing CMS binding key
MUST keep working; you are redesigning the markup/CSS around the same data.

**Task.**
1. **Landing sections, mockup-accurate, in order:** promo strip (thin, dismissible; if no CMS
   field exists for it, gate it behind the existing hero badge fields — do NOT invent new CMS
   keys) → hero (display type, credline) → stats row → billboard section → masonry
   showcase feed (REAL data: keep the existing showcase/catalog source; gradient tiles only as
   loading/fallback) → AI promo cards → viral-presets rail (tab pills + cards; static curated
   content is fine, mark `/* BATCH7: CMS */`) → plugin band → pricing teaser → FAQ →
   final CTA → footer (already themed). Delete each section's old lime-literal CSS as you
   restyle it — the 103 leftover literals in `ffl-*`/landing CSS should drop to ~0 for the
   landing.
2. **Mega-menu (deferred from #1):** hover/click dropdown on nav — 2 columns per mockup
   `home-mega`: Features (icon+title+desc+badges) | Models (real enabled model names from the
   catalog — hardcode a curated list with an Uzbek comment "gen-models bilan sinxron saqla,
   BATCH7'da CMS/endpoint" — do NOT call authed APIs from public landing). Keyboard/Escape
   close, no layout shift, works in all 3 themes.
3. **Liveliness:** scroll-reveal already exists (`data-rv`) — keep; add mockup hover states
   (card lift, play affordance) to all feed/preset cards.
4. **Verification (mockup parity bar):** side-by-side screenshots mockup-home vs production
   landing, per theme (noir/neon/cold), at 1280px — hero, feed, presets, pricing teaser, FAQ,
   footer. Landing lime-literal count report (target ≈0). `node --check` scripts; no console
   errors; CMS-driven texts still render (verify with the real config JSON). Commit; no push.

**Out of scope:** Templates page, AI Studio, auth/account, dashboard, backend, new CMS keys.

---

## Prompt #3 — PRODUCTION: Templates catalog + template detail + Pro gate (mockup 1:1)

**Context.** Prompts #1-#2 (commits b216fab, 50ff85c) shipped the 3-theme foundation and the
new landing. This prompt ports the mockup screens **`templates`, `template-detail`** and the
plan-gate state from `docs/mockups/batch6/` onto the production Templates experience in
`packages/assetflow-studio/platform/index.html`. The catalog is REAL data (public catalog API
with `kind`/`stockType`/type pills from BATCH3, pagination/cursor) — all existing data flows,
filters, search, sort and download logic MUST keep working; you restyle markup/CSS around them.

**Task.**
1. **Catalog page:** filter pill row (categories + kind pills — keep BATCH3 pill semantics),
   search field, sort control; masonry/grid of template cards per mockup (real thumbnail,
   duration badge, Free/PRO chip, host-app chip (Ae), author line, hover lift + play
   affordance on preview-capable cards); pagination/"load more" per existing mechanism styled
   to mockup; honest empty/no-results state (mockup `state-*`).
2. **Template detail:** preview player area (poster + play; keep existing streaming/preview
   logic), title/meta (category, resolution, duration, size, author), tag chips, download CTA
   (Free) / PRO-gated CTA, related/更多 section if it exists today — do not invent new data.
3. **Pro gate:** the plan-gate modal styled per mockup (accent border/glow on Pro, feature
   list, upgrade CTA) — trigger stays the existing logic.
4. **Cleanup:** delete the old lime literals in templates/detail CSS regions (report count
   before→after; target 0 in this scope).
5. **Verification (mockup parity bar):** side-by-side vs mockup `templates` and
   `template-detail` in all 3 themes at 1280px; real catalog data renders (the prod catalog
   currently has ~1 published template — also verify the grid looks intentional with 1 item +
   empty-state, not broken); `node --check`; no console errors; download/Pro-gate flows still
   fire (click-through smoke, no purchase). Commit; no push.

**Out of scope:** AI Studio/app views, dashboard, auth/account, backend/catalog API, pricing
page, new CMS keys.

---

## Prompt #4 — PRODUCTION: AI Studio + Dashboard + Projects (mockup 1:1) — THE BIG ONE

**Context.** Prompts #1-#3 (b216fab, 50ff85c, c3b9cab) shipped tokens/chrome, landing and
Templates. This prompt ports the APP surface from `docs/mockups/batch6/`: screens `dashboard`,
`ai-image`, `ai-video` (incl. the three OPEN selector states), `ai-voice`, `ai-audio`,
`ai-upscale`, `ai-history`, `ai-models` (model picker), `projects`, `project-detail`, and the
studio-related `state-*` screens (generating card, lightbox, add-to-project, reference
library, select-mode bulk bar, empty gallery, low-credits/top-up) onto production
`packages/assetflow-studio/platform/index.html` (`va-` app views).

**⚠️ HARD CONSTRAINT — BATCH5 UX MUST SURVIVE INTACT.** The composers contain recently built
functionality that is NOT allowed to regress:
- the contenteditable chip editor (`ffChipEditor`, SD2-CHIP-EDITOR v1): pill insert via `@`
  dropdown, atomic Backspace delete, renumber on ref delete, Enhance round-trip, serialization
  to plain tokens on Generate. Do NOT restructure its host elements or the mention-dropdown
  singleton — restyle via CSS (and minimal wrapper markup) around them.
- edit-preset chips (Replace subject / Edit objects / Inpaint) shown when a video ref exists;
- start/end frame slots on Seedance 2.0 (media-refs + frames together), aspect/quality/
  duration selectors, ✦cost display, Generate gating, poll/progress updates (focus-guard!).
After restyling, run the BATCH5 smoke checklist (below) before committing.

**Task (in this order, commit in TWO commits if the session gets long: 4a = dashboard +
history + projects + model picker; 4b = composers + states).**
1. **Dashboard (`dashboard`):** welcome header, quick-action cards, recent generations rail,
   credits/plan summary — mockup 1:1, real data bindings kept.
2. **Sessions/History (`ai-history`) & Projects (`projects`, `project-detail`):** gallery
   result cards (model name + ✦cost mono labels, hover action row), session rail, bulk
   select-mode bar, project grids — restyle existing flows, no new data.
3. **Model picker (`ai-models`):** search + featured list rows (icon, name, badge, one-line
   desc, ✓ selected) — style the existing picker modal to mockup; real catalog data.
4. **Composers (`ai-image`, `ai-video` + open selectors, `ai-voice`, `ai-audio`,
   `ai-upscale`):** Higgsfield-style docked composer container, chip row (model pill, aspect,
   quality/resolution, duration, ✦cost), big accent Generate; open-state styling for model/
   aspect/quality dropdowns; refs strip (thumbs, start/end frame slots, add tile); prompt area
   hosts the chip editor UNCHANGED (style only). Gallery/result area per mockup.
5. **States:** generating/progress card, lightbox, add-to-project sheet, reference library,
   empty gallery, low-credits + Top up, error/success toasts — all per mockup, all themed.
6. **Cleanup:** remaining `va-`/app lime literals → 0 in this scope (report before→after).
7. **Verification:**
   (a) mockup parity side-by-sides per screen per theme (1280px);
   (b) **BATCH5 smoke:** type `@` → dropdown → pill inserts; Backspace deletes pill whole;
   delete a ref → pills renumber; Enhance round-trip keeps pills; preset chips insert
   templates; start/end frame slots accept an image; Generate serializes plain tokens (log
   once, redacted); focus-guard still prevents poll-clobber while typing;
   (c) `node --check` all inline scripts; zero console errors; mock API acceptable for data.
   Commit(s); do NOT push.

**Out of scope:** auth/account screens, pricing/plugin/help pages, backend, plugin (AE),
Contributor/Admin, new CMS keys.

---

## Prompt #5 — PRODUCTION: Auth + Account (mockup 1:1, REAL config wins over mockup content)

**Context.** BATCH6 prompts #1-#4 shipped tokens/chrome, landing, Templates, and the app
surface. SINCE the mockup was built, a PARALLEL work stream (MUAMMOLAR A→J, ~40 commits,
deployed) changed real product content: credit packs are now 250/600/1800 (not the mockup's
old packs), Studio plan = 3000 credits, and the fake plan features ("Priority generation",
"API access", "Priority render queue") were DELETED from plans; the Credits screen now renders
the real `CreditLedger` (refunds visible); Free users get watermarked AI exports (Pro clean).
**RULE: mockup = DESIGN source; REAL config/data = CONTENT source. Never resurrect removed
features or old prices from the mockup. If mockup content contradicts live config, live wins.**

**Scope.** Mockup screens `login`, `register`, `forgot`, `reset-password`, `verify-email`,
`state-email-verified`, `state-device-confirm`, `account-profile`, `account-billing`
(plan + credits + ledger), `account-downloads`, `state-session-expired`, avatar menu — onto:
(a) the in-app account views in `packages/assetflow-studio/platform/index.html`, AND
(b) the STANDALONE pages in `packages/assetflow-studio/platform/`: `login.html`,
`reset-password.html`, `verify-email.html`, `device.html` (and register flow wherever it
lives). Standalone pages currently lack the BATCH6 token layer — give each the same 3-theme
token block + FOUC snippet + fonts (small shared copy is fine; mark with a sync comment).

**Task.**
1. **Auth screens (standalone + in-app):** centered auth card per mockup (display heading,
   inputs, primary accent CTA, Google button, Turnstile placeholder untouched functionally),
   consistent across login/register/forgot/reset/verify; device-code screen (code display +
   waiting state) per mockup. All existing form logic/handlers/bindings unchanged.
2. **Account — profile:** header with avatar, name/email fields, security block (password
   change, 2FA if present) — restyle existing functionality only.
3. **Account — plan & credits:** plan card (REAL plan name/price/features from live config),
   credits balance hero ✦, REAL credit packs (250/600/1800) using the mockup's pack-card
   design, `CreditLedger` list restyled (keep refund rows visible — recent feature), watermark
   note for Free if the UI already shows it (do not invent).
4. **Account — downloads:** downloads list per mockup card/table style, existing data.
5. **Avatar menu + session-expired state:** style per mockup; logic unchanged.
6. **Cleanup:** lime literals in auth/account scopes → 0 (report before→after).
7. **Verification:** side-by-side vs mockup per screen per theme (1280px); standalone pages
   get theme switcher parity (at minimum honor saved `ff-theme`); forms still submit (smoke:
   validation errors render, no console errors); `node --check`. Commit; do NOT push.

**Out of scope:** pricing/plugin/help/legal pages (#6), backend, payments logic, plugin,
Contributor/Admin consoles.
