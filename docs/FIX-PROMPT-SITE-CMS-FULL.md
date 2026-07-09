# FrameFlow — Standalone Prompt: FULL marketing-site CMS (extend the landing CMS to the whole site)

> Builds ON TOP of the already-merged Landing CMS (`LandingConfig` + admin "Website" tab +
> `admin-website.js` + `/api/(admin/)landing-config`). GOAL: let the admin edit the WHOLE
> marketing site — every section of the landing PLUS the pricing page and the plugin page —
> content, media, colors, fonts, and section show/hide (and reorder where sensible). Same global
> rules: money-zone untouchable; additive migrations only; English UI, Uzbek code comments; commit
> in logical chunks, NO `Co-Authored-By`; do NOT push (user pushes).

## SCOPE — what is editable vs not (read first)
- ✅ EDITABLE (marketing/content pages): the LANDING (all sections, not just hero/stats/mockup),
  the PRICING page, and the PLUGIN page. Every text, media, label, color, font; plus per-section
  SHOW/HIDE and, where it makes sense, REORDER.
- ❌ NOT editable (functional app — leave alone): AI Studio, catalog/templates browsing, account,
  projects, admin console. These are software features, not CMS content.
- ❌ OUT OF SCOPE: an arbitrary drag-drop page builder that lets the admin invent brand-new
  sections/blocks/layouts (Webflow-style). Cover every EXISTING section with structured fields;
  do NOT build a freeform block engine.

## Anchors (analyzed / from the built CMS)
- Config: `apps/api/src/lib/landing-config.ts` (defaults + zod + cache) → GET `/api/landing/config`
  (public), `GET/PUT/DELETE /api/admin/landing-config` (admin). Extend this (rename to a broader
  `SiteConfig` if cleaner, or add `pricing`/`plugin`/extra landing sections to the existing blob —
  additive migration; defaults = current content so nothing changes until edited).
- Landing markup: `packages/assetflow-studio/platform/index.html`, `ffl-` prefix (~14423+) — the
  hero/mockup/stats already read the config; the REMAINING sections below the fold are still
  hardcoded.
- Pricing + Plugin pages: also in `platform/index.html` (the `Pricing` and `Plugin` nav routes) —
  currently hardcoded.
- Admin editor: `packages/assetflow-studio/js/admin-website.js` (the "Website" tab) + StudioApi
  `getLandingConfig/saveLandingConfig/resetLandingConfig`. Extend this editor.
- Admin/shared JS cache-bust: make sure `studio-api.js` + `admin-*.js` get the same content-hash
  `?v=` cache-bust that `ff-api.js` has (via `scripts/prepare-cf-pages.mjs`) — otherwise new
  editor code won't load after deploy (this already caused an "undefined is not a function").

**Step 0 — Inventory EVERY marketing section.** List every section of: (a) the LANDING top-to-
bottom (hero, mockup, stats — done — PLUS all below-fold sections: feature blocks, how-it-works,
logos/social proof, pricing teaser, testimonials, FAQ, final CTA, footer, etc.), (b) the PRICING
page (plan cards, prices, feature lists, FAQ, CTAs), (c) the PLUGIN page (all its content). For
each section record its editable fields (text, media, labels, links) + whether show/hide and
reorder apply. This is the extended CMS schema.

**Step 1 — Extend the config.** Grow `landing-config.ts` (or a new `site-config.ts`) to cover all
inventoried sections across landing + pricing + plugin, with defaults = current content, zod
validation, section-level merge. Additive migration. Public GET serves it; admin GET/PUT/DELETE
edits it. Reuse the media-upload flow for any new media fields.

**Step 2 — Make the pages read the config.** Replace ALL remaining hardcoded content in the
landing (below-fold sections), the pricing page, and the plugin page with config-driven bindings.
Honor per-section SHOW/HIDE (a hidden section doesn't render) and section ORDER where enabled.
Keep the app UI (AI Studio/catalog/account) on the default theme + untouched.

**Step 3 — Extend the admin editor.** In the "Website" tab, add editor groups for EVERY section
(landing below-fold, pricing, plugin) — text fields, media upload, per-section show/hide toggle,
reorder (drag or up/down) where enabled, plus the existing theme/hero/nav/stats. Keep the live
preview working and extend it to reflect the new sections (at least the landing). Keep Save &
publish + Reset to defaults. Consider tabs/accordions in the editor so it stays usable (it's now
a big form).

**Step 4 — Cache-bust the admin/shared JS** (fold in the fix): inject the content-hash `?v=` into
`studio-api.js` + `admin-*.js` (and contributor shared js) references in `prepare-cf-pages.mjs`,
matching the ff-api.js approach, so editor updates always load post-deploy.

**Step 5 — Verify.** Admin (headless): edit sections across landing + pricing + plugin (text,
media, show/hide, reorder, theme) → Save → each public page reflects it; hidden sections
disappear; reorder applies; Reset restores originals; defaults = current content when unedited;
unauth/non-admin blocked (401/403). App UI unaffected. Run the additive migration on a dev DB;
`npm run build -w apps/api`; confirm dist admin HTML has hashed `?v=` on its scripts. Screenshot
the extended editor + an edited landing/pricing/plugin page.

**Constraints.** Money-zone untouched (pricing PAGE copy/labels are editable, but do NOT change
the actual billing/credit logic or real plan enforcement — this edits DISPLAY content only, not
what a plan grants). Additive. `platform/index.html` CF direct source; admin source = `admin/` +
`js/` (studio:sync). Self-hostable fonts (no CDN on the real pages). Keep it maintainable — no
freeform block engine.

**When finished:** commit in logical chunks (config extend; pages read config; admin editor
extend; cache-bust — clear messages, no Co-Authored-By); do NOT push. Summary: the full section
inventory, what became config-driven, the extended editor (show/hide/reorder), and the cache-bust.

**Model:** Fable 5 (+Extra) — large: multi-page config + refactor + a big admin editor.
