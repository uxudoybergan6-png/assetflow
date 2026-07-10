# FrameFlow platform redesign — MIX direction (Higgsfield × Artlist), 2026-07-10

> BATCH4 #3 deliverable. Mockup: `packages/assetflow-studio/platform/_platform-redesign-mix-mockup.html`.
> Inspiration ONLY — not a 1:1 copy of either site. FrameFlow identity (lime `#C2F04A` on deep dark) stays.

## 1) What we saw (live study, 2026-07-10, Claude-in-Chrome)

### higgsfield.ai — "cinematic, generation-forward drama"
- True-black canvas, **lime accent** (close to ours) + hot-pink NEW/TRENDING micro-badges.
- **Billboard strip** on home: large editorial media cards (campaign covers) with small bold caption + one-liner under each — news/launches as media, not text.
- **Tool launcher cards**: compact dark panels — icon, name, one-liner, right-aligned type chip (Image/Video), NEW badge. 2 rows × 3–4 cols.
- **Cinema moment**: full-bleed video inside a device/CRT frame, huge condensed uppercase display type over it, one pill CTA. Pure drama, one per page.
- **Community masonry**: pure media tiles, tight gaps, no chrome — the work is the design.
- Generation surface: mostly-empty dark canvas + **bottom-docked composer** (chips: model, ratio; lime Generate) — same paradigm we already have.
- Cards carry usage stats (views · credits) in tiny mono.

### artlist.io — "clean, media-first catalog density"
- Near-black but softer (#0B–#11 panels), **warm yellow** used sparingly (logo, one glossy pill CTA, tiny badges).
- **Segmented pill center-nav** (Home / AI Toolkit / Stock Catalog / Studio).
- Home = stacked media rows, each: small bold sentence-case header + "Explore all →" link; twin autoplay hero cards; AI-tool cards with a **mini-UI mock embedded in the media** (composer drawn inside the thumbnail).
- **Catalog** (footage / video-templates): left category rail; **filter dropdown pills row** + right "Sort by Staff Picks"; **pure-media masonry** — badges (NEW / Made With AI) tiny in the corner; **hover reveals chrome** (title bottom-left, download/favorite/menu icons right edge, "Available Software" chip top-right).
- Music rows: artwork card + play overlay + genre chips; charts as waveform tables.
- One **editorial serif display** statement per page (huge, centered) for contrast against the sans UI.

## 2) Our weaknesses being fixed (grounded in platform/index.html, line-cited)
- `body{background:#06080B}` flat void (L14217), `.va-app` adds no background of its own (L14873) — while the marketing screens DO get aurora/mesh (`ffl-aur`, `ffm-mesh`). The logged-in app is the only place with zero ambience.
- `.va-axwork` AI Studio canvas is a flat `var(--bg)` box (L15293) with a 4%-opacity dot grid (L15347); the first-run hero (L15487) centers a small mascot in a `calc(100vh−102px)` void.
- One generic dashed `.va-empty` box (L14983) is reused verbatim for Dashboard/Templates/Projects empty states (L16086/16312/16786) — no differentiated visual weight.
- `.va-fbar` filter bar (L15135) = one dense row of identical 11.5px pills; no grouping, sort and count get no hierarchy.
- Card system duplicated: live `.va-rc` (L14988) vs fully dead `.va-tc` (L14975); dead legacy `ffa-st-*`/`ffa-app` AI-studio CSS (~L14642–14860) with zero markup.
- Token sprawl: three overlapping variable layers on `.ff` (L14224 base, L14298 ffm rename, L14873 app override) and three unrelated type scales (`va-hi` 31px / `ffm-d*` / `ffl-d64`).
- Scope leakage: Account/Projects use marketing `ffm-btn` instead of `va-btn` (L16684, 16744…).

## 3) The MIX — rules used in the mockup
**Formula: Higgsfield's cinematic drama for MOMENTS + Artlist's calm media density for SURFACES, on FrameFlow lime/dark.**

1. **Ambience (from BATCH4 #1/#2):** app-wide `A + D` combo — aurora lime/indigo bloom top + film grain + darker bottom falloff. Content never sits on flat #06080B again. Static (no anim), reduced-motion safe.
2. **Type scale:** keep Hanken Grotesk; add a display tier (800, -0.03em, 26–44px) for screen titles & billboard headlines; IBM Plex Mono stays for kickers/meta/stats (10–11px, letter-spaced uppercase). One serif-style editorial moment is NOT adopted — mono-kicker + heavy grotesk is our voice.
3. **Nav:** keep our top-nav shell but as a **floating glass bar** (blur + hairline), center links as segmented pills (Artlist), credits pill + avatar right (ours).
4. **Home:** (a) **billboard hero** — one cinematic media card (featured template/campaign) with display type + dual CTA, side stack of 2 smaller billboards (Higgsfield strip, calmed); (b) **AI tool launcher row** — 4 compact cards with icon, name, one-liner, type chip + NEW badge (Higgsfield) but with media strip inside (Artlist mini-UI hint); (c) **Trending templates** media row with "Explore all →"; (d) **Recent generations** strip (user's own media = the decor).
5. **Templates:** Artlist catalog grammar — sticky filter row (category pills + app/orientation dropdown pills + right sort), **masonry of pure-media tiles** (aspect-true), corner badges (AEP/MOGRT, PRO, app icons), **hover chrome**: title + meta bottom gradient, Preview/Import actions right, lime ring. Density over emptiness; grid ends with a "load more" media ghost row, not a void.
6. **AI Studio:** Higgsfield generation surface, FrameFlow money-zone untouched — results canvas fills with a **session media grid** (empty state = example wall ghost tiles + one-line hint, never a dead void); **bottom-docked glass composer** (unchanged paradigm): chips = MODE · model · ratio · count · credit cost, lime Generate; left session rail (ours) as icon rail with tooltips.
7. **Cards:** radius 14–16px, hairline `rgba(255,255,255,.08)` borders, hover = translateY(-2px) + lime hairline + shadow bloom; badges tiny mono uppercase; stats in mono (views · credits like Higgsfield).
8. **Motion:** 160–220ms ease-out hovers; billboard has a slow Ken-Burns on its media (paused under `prefers-reduced-motion`); nothing else animates ambiently.
9. **Color discipline:** lime ONLY for primary action, active state, live/positive stats; indigo/teal live in the ambience and media placeholders; pink is NOT adopted (Higgsfield's, not ours).

## 4) What was deliberately NOT copied
- Higgsfield's pink badges, dense mega-nav, CRT device frame, contest promos.
- Artlist's serif display face, yellow glossy CTA, left catalog rail (our catalog keeps top filters; rail doesn't fit a 5-screen app), music/waveform surfaces.
- No images, copy, or assets from either site — all mockup media are original CSS-gradient stand-ins.

## 5) If approved → real-app port plan (follow-up prompt)
- CSS scope `rx-` in the mockup maps onto the LIVE `va-` system (confirmed by code recon): shell/nav → `.va-nav`, Home → `.va-hero/.va-qa/.va-sh*` zone, Templates → `.va-cathero/.va-fbar/.va-mas/.va-rc`, AI Studio → `.va-axwork/.va-axrail/.va-axstage/.va-dock` (composer bindings `va-set` chips, `axQuote` cost, `genBtnCls` — money zone untouched; class-additive restyle only).
- NOT `ffa-st-*` — that whole block (~L14642–14860) is dead CSS; the port should delete it, plus dead `.va-tc`, rather than extend them. `ffa-menu/pop/field/auth*` sub-set is live — don't touch.
- Ambience = one layer pair on `.va-app` (A+D from `_app-bg-variants-mockup.html`); consolidate to the existing `.ff .va-app` token override block (no 4th token layer).
- Adopt ONE type scale (the mockup's: display 30–44 / h2 21 / body 13.5 / mono meta 9.5–11) across app screens.
- Port order: shell+ambience → Templates → Home → AI Studio → Projects/Account (swap `ffm-btn` leakage to `va-btn` on the way).
