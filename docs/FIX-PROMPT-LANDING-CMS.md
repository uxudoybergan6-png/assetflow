# FrameFlow — Standalone Prompt: Admin "Website / Landing" editor (CMS)

> Pulled out of FIX-PROMPTS-2026-07-09.md because it is large and mostly self-contained (landing
> + admin + a new backend config). Run it on its own. Same global rules apply: money-zone
> untouchable; additive migrations only; English UI, Uzbek code comments; commit in logical
> chunks with clear messages, NO `Co-Authored-By`; do NOT push (the user pushes).

## Admin: a "Website / Landing" editor (CMS) to fully edit the landing (content, media, colors, fonts)

**Context.** The public landing (getframeflow.app) has empty gradient placeholder cards in the
hero mockup, and everything on it is hardcoded. Add a NEW admin tab/feature to edit the landing
FULLY: hero text, the preview-mockup cards (fill them with real media), the stats row, nav/CTA
labels, and THEME (accent color, fonts) — so the admin can customize the whole landing without
code. This is a structured landing CMS. (Analyzed — anchors below.)

> SCOPE NOTE: deliver a STRUCTURED CMS that gives full control over the landing's CONTENT +
> THEME via well-defined fields (text, media, colors, fonts, stats, labels) — NOT an arbitrary
> pixel-level page-builder (that's a much larger separate effort). Cover every visible landing
> element with an editable field.

**Exact anchors (analyzed):**
- Landing markup + CSS live in `packages/assetflow-studio/platform/index.html`, class prefix
  `ffl-` (~line 14423+): the hero (headline "Templates, AI video and audio — one creative space",
  sub, "NEW · AI Video 2.0" badge, "Start for free"/"Browse templates" CTAs), the "FrameFlow — AI
  Studio" preview MOCKUP with gradient placeholder cards, and the stats row (10,000+ / 4 / 6 / 14
  days). All hardcoded.
- NO `LandingConfig`/`SiteConfig` exists in the backend — add one.
- Admin panel: `packages/assetflow-studio/admin/index.html` uses `route("<view>")` (e.g.
  `route("contributors")` ~160, `route("settings")` ~282) — add `route("website")`.

**Step 0 — Inventory the editable landing elements.** List every editable region of the `ffl-`
landing: hero headline/subhead/badge, the CTA + nav labels, each preview-mockup card (its
media/gradient + label), the stats (value + caption ×4), and theme tokens (accent color, font
family). This is the CMS schema.

**Step 1 — Backend: LandingConfig.** Add a `LandingConfig` (a single config row or a JSON blob;
additive migration) holding all the inventoried fields with sensible defaults = the CURRENT
content (so nothing changes until edited). Add: admin GET/PUT (owner/admin-guarded) to read/update
it, media upload for the preview cards (reuse the existing upload/storage), and a PUBLIC GET that
the landing fetches.

**Step 2 — Landing reads from config.** Replace the hardcoded `ffl-` hero/cards/stats/labels with
values from the LandingConfig (public GET), including THEME (accent color + font applied via CSS
variables). The empty gradient cards now render the admin-set media (or fall back to a gradient
if none). Keep the landing fast (config is small; cache sensibly).

**Step 3 — Admin "Website" tab + editor.** Add a new `route("website")` tab with a full editor:
text fields for hero/labels/stats, media upload for each preview card, an accent-color picker, a
font selector (from a curated, self-hostable set), and Save. Provide a live/preview and a "reset
to defaults". Owner/admin-guarded.

**Step 4 — Verify.** Admin (headless): edit hero text, upload media into the empty cards, change
the accent color + font, edit stats → Save → the public landing reflects all of it; reset works.
Confirm defaults = current content when unedited. `npm run build -w apps/api`; run the additive
migration on a dev DB. Screenshot the admin editor + the updated landing.

**Constraints.** Money-zone untouched. Additive migration. `platform/index.html` is the CF Pages
direct source (landing lives here — editing the landing here is intended for THIS problem); admin
source = `admin/` (studio:sync). Fonts must be self-hostable (no CDN dependency on the real
landing). Minimal, structured diff.

**When finished:** commit in logical chunks (LandingConfig model + endpoints; landing reads
config; admin Website editor — clear messages, no Co-Authored-By); do NOT push. Summary: the CMS
schema, how the landing became config-driven, and the admin editor (with the color/font/media
controls).

**Model:** Fable 5 (+Extra) — backend config + landing refactor + admin editor UI.
