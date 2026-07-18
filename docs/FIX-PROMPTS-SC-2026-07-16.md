# FIX-PROMPTS-SC — Plugin Content CMS + related findings (2026-07-16)

Batch of self-contained Claude Code prompts. Run each prompt in a FRESH Claude Code
session (`/clear` between prompts). Execution order:
**SC_01 → SC_02 → SC_03 → SC_07 → SC_04** (dependency chain) · **SC_05** independent ·
**SC_06 SUPERSEDED — merged into SC_07, do not run separately.**

> **v2 (2026-07-16, owner report: Home bottom void + triple entry points):** Home is
> restructured by new SC_07 (start cards removed, recent-works strip added, multi-row
> shelf). SC_01 / SC_03 / SC_04 updated accordingly (`home.cards` removed from the CMS
> schema). SC_07 must run BEFORE SC_04.
> **v3:** owner requirement added to SC_07 — Home must FILL the panel height with large,
> generous cards (scaling hero + big tiles), never half-empty.
> **v4 (microcopy purge, owner report):** distracting micro-texts get removed or replaced
> per a Director rulebook — new **SC_08** (plugin-wide pass) + **SC_09** (web platform
> pass). SC_01/SC_03/SC_04 lose the aiLauncher `sub` field (that line is deleted);
> SC_05 v2 = one-line model names + "LIVE" badge removed; SC_07 shelf cards lose the
> "AFTER EFFECTS · 1080P" meta row. Order: SC_08 runs AFTER SC_05 and SC_07.

---

## GLOBAL RULES (apply to EVERY prompt below — do not violate)

- **MONEY ZONE IS BYTE-FOR-BYTE FROZEN:** credit consume/refund, signed cost-quote and its
  HMAC (`apps/api/src/lib/gen-quote.ts`, `gen-models.ts` `computeGenCost`/`imageUnitCost`,
  `plugin-profile.ts`), webhook idempotency, every credit VALUE. If a change would touch
  these → STOP and flag it in your summary instead.
- **Migrations are additive only** (new table/column; nothing breaking). `migrate:deploy` flow.
- **English UI copy; code comments in Uzbek.**
- **Studio source rule:** edit ROOT `packages/assetflow-studio/js|styles` (+ `admin/`,
  `contributor/` source), then run `npm run studio:sync`. NEVER edit `studio/`, `admin/`
  build artifacts. `platform/index.html` is direct CF Pages source. Do not touch landing
  (`ffl-`) unless the prompt says so.
- **Plugin:** after editing `plugins/after-effects-cep/AssetFlow_Plugin.html`, run
  `bash plugins/after-effects-cep/scripts/install-cep.sh` (user restarts AE). No external
  internet inside AE besides our API/CDN (fonts self-hosted, inline SVG). Validate all
  inline scripts with `node --check` extraction and verify DOM ids/handlers still bound.
- **Minimal, narrow diff.** Reuse existing patterns; do not regress. Each prompt is
  self-contained — do not assume context from other prompts.
- **When finished:** (a) commit with a clear concise message (no Co-Authored-By); do NOT
  push. (b) write a short summary.

---

## SC_01 — Backend: `PluginContentConfig` (admin-editable plugin copy + media), API routes

**Problem.** All marketing copy and background media in the AE plugin (Home hero, the two
"Start your next project" cards, section headings, guest screen, AI Tools launcher) are
hardcoded in `plugins/after-effects-cep/AssetFlow_Plugin.html`. The owner wants admins to
edit texts and upload background image/video from the admin web panel, with changes
propagating automatically to every user's plugin. No backend exists for this yet.

**Existing pattern to mirror (do not reinvent).** The public landing already has exactly
this machinery: single-row JSON blob `model LandingConfig` (`packages/database/prisma/
schema.prisma`, ~line 904) · defaults + zod schema + deep-merge in
`apps/api/src/lib/landing-config.ts` · public cached read `GET /api/landing/config`
(`apps/api/src/routes/landing.ts`) · admin GET/PUT/DELETE with audit in
`apps/api/src/routes/admin.ts` (~lines 107–145).

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Express API
lives in apps/api, Prisma schema in packages/database/prisma/schema.prisma.

GOAL: create an admin-editable "plugin content config" (texts + background media URLs for
the After Effects plugin UI), mirroring the existing Landing CMS machinery 1:1.

STUDY FIRST (read before writing):
- packages/database/prisma/schema.prisma → model LandingConfig (~line 904)
- apps/api/src/lib/landing-config.ts → interface + DEFAULTS + zod schema + deep-merge
- apps/api/src/routes/landing.ts → public cached GET
- apps/api/src/routes/admin.ts (~lines 107–145) → admin GET/PUT/DELETE + audit calls
- apps/api/src/routes/public.ts → check whether unauthenticated plugin-facing routes
  belong here; pick the same mounting style the codebase already uses for landing.

BUILD:
1. Prisma: new single-row model PluginContentConfig (id Int @id @default(1), data Json,
   updatedAt DateTime @updatedAt) — additive migration named plugin_content_config.
   Do not touch any existing model.
2. New apps/api/src/lib/plugin-content-config.ts with a typed interface, zod schema,
   DEFAULTS and deep-merge, following landing-config.ts conventions. DEFAULTS must equal
   the CURRENT hardcoded plugin copy exactly, so an untouched config renders the plugin
   pixel-identical. Schema (all strings length-capped ~200, arrays fixed-length):

   home: {
     hero: {
       kicker: "Your next frame",
       title: "Make something worth replaying.",
       sub: "Generate a key visual or start from a production-ready After Effects template.",
       ctaPrimary: "✦ Open AI Studio",
       ctaSecondary: "Open Stock Catalog",
       mediaUrl: "", mediaType: "" | "image" | "video",
       mediaMode: "auto" | "media-first"   // default "auto"
     },
     // v2: NO home.cards — the "Start your next project" cards are being REMOVED from
     // the plugin Home by a parallel redesign task (they duplicated the hero CTAs).
     // Do not model them.
     sections: { recent: "Jump back in", shelf: "Fresh for your next cut",
                 browseAll: "Browse all →" }
   },
   guest: {
     title: "Make After Effects\nmove faster.",   // \n = line break position
     sub: "Drop-in templates and AI generation —\nright inside your panel, synced with the web.",
     features: [ up to 3 { title, sub } — copy the current strings from
                 AssetFlow_Plugin.html #homeGuest block (~line 4215+) verbatim ]
   },
   aiLauncher: {
     title: "AI Tools",
     // v4: NO `sub` field — the "Prompt → result → import directly into AE" explainer
     // line is being DELETED from the plugin (microcopy purge). Do not model it.
     cards: [ 3 items for image/video/audio categories:
       { title: "", desc: "", mediaUrl: "", mediaType: "" }   // empty = plugin keeps its
                                                              // built-in text/live models
     ]
   }

   HARD GUARD: the schema must contain NO credit/price numbers and NO model pricing
   fields. Live price chips in the plugin (hero model chip, "FROM ✦N" badges) come from
   /api/studio/gen/models and stay out of CMS control. Note this in a comment.
3. Public read route: GET /api/plugin/content-config — NO auth (the plugin guest screen
   needs it before login). Return { config, updatedAt } with Cache-Control
   "public, max-age=60", exactly like GET /api/landing/config. Mount it wherever
   unauthenticated routes live (landing.ts style or public.ts — follow existing style;
   ensure it is NOT behind the plugin token middleware).
4. Admin routes in apps/api/src/routes/admin.ts, mirroring the landing-config trio:
   GET /api/admin/plugin-content-config  → { config, updatedAt, defaults }
   PUT /api/admin/plugin-content-config  → zod-validated section-level partial merge + audit
     (action "plugin_content.update", targetType "pluginContentConfig")
   DELETE /api/admin/plugin-content-config → reset to defaults + audit ("plugin_content.reset")
5. npm run build -w apps/api must pass. Generate the migration file via the repo's usual
   prisma flow (do NOT run against production; additive only).

OUT OF SCOPE: no admin UI, no plugin changes, no changes to public-keys.ts (separate task).

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (Medium). Backend + migration + schema design.

---

## SC_02 — Media pipeline: CDN allowlist for admin CMS media (fixes latent `landing/` 403 bug)

**Problem (found during this investigation — affects production TODAY).** Admin "Website"
CMS uploads landing mockup media to GCS keys `landing/<ts>-<file>` via
`POST /api/admin/upload-url` and stores the returned `publicUrl`
(`packages/assetflow-studio/js/admin-website.js` ~lines 503–530). But
`isPublicReadKey()` (`apps/api/src/lib/public-keys.ts`) has NO rule for `landing/` →
the Cloudflare CDN worker returns **403** for every such URL. Any media an admin uploads
in the Website editor is silently broken. The new plugin CMS (SC_01/SC_03/SC_04) needs the
same pipeline, so both are fixed here with one narrow, security-reviewed change.

**⚠️ SECURITY-SENSITIVE:** `isPublicReadKey` is the single allowlist protecting paid packs
(`templates/<id>/pack.*`, `mogrt/*`, gen originals). The diff must be surgical.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas).

CONTEXT: one private GCS bucket holds everything (paid packs AND public display assets).
Public display assets are served by a Cloudflare Worker CDN proxy (workers/cdn-proxy)
that allows keys strictly via isPublicReadKey() in apps/api/src/lib/public-keys.ts —
a pure, dependency-free file imported by BOTH the API and the Worker (single source).
Admin uploads use POST /api/admin/upload-url (apps/api/src/routes/admin.ts, ~lines
62–105): folder whitelist ALLOWED_UPLOAD_FOLDERS → key `${folder}/${Date.now()}-${safeName}`,
response includes publicUrl = CDN_BASE_URL/key (apps/api/src/lib/s3.ts getPublicUrl).

BUG: the admin Website CMS stores publicUrl for keys under landing/ (see
packages/assetflow-studio/js/admin-website.js ~503–530), but isPublicReadKey() never
returns true for landing/* → the CDN worker 403s all admin-uploaded landing media.

TASKS:
1. In apps/api/src/lib/public-keys.ts add EXACTLY two new allow rules, nothing else:
     /^landing\/[^/]+$/          → true   (flat keys only, no subpaths)
     /^site\/plugin\/[^/]+$/     → true   (flat keys only)
   Keep every existing rule byte-identical. Update the header comment block: document that
   these two prefixes are written ONLY by admin presigned uploads (folder whitelist in
   admin.ts) and must never receive paid content.
2. In apps/api/src/routes/admin.ts add "site/plugin" to ALLOWED_UPLOAD_FOLDERS (the Set
   whitelist makes traversal impossible; safeUploadFileName already strips path parts —
   verify and state this in the summary).
3. In the same upload-url handler: when folder is "landing" or "site/plugin", accept only
   contentType matching /^image\//, "video/mp4" or "video/webm"; otherwise 400. Other
   folders keep current behaviour.
4. Tests: find how apps/api runs unit tests (vitest/jest/none). Add or extend a small test
   for isPublicReadKey with this matrix, and paste the results into your summary:
     STILL false: templates/x/pack.zip · templates/x/pack.dl.zip · templates/x/mogrt/a ·
                  gen/u/123-456.png · gen-refs/a · gen-ref-src/a · avatars/a · incoming/a ·
                  landing/a/b.jpg · site/plugin/a/b.mp4 · site/a.jpg · landing/
     NOW true:   landing/1712-hero.jpg · site/plugin/1712-bg.mp4
   If no test infra exists, add a tiny standalone script under apps/api (node-runnable)
   and run it.
5. npm run build -w apps/api must pass.

DEPLOY NOTE for the summary (user actions, not yours): the Cloudflare Worker imports this
same file relatively — the OWNER must redeploy the worker (wrangler deploy in
workers/cdn-proxy) AND the API for the change to take effect. Previously uploaded
landing/* URLs start working immediately after — no data migration needed.

DO NOT touch: any other rule in public-keys.ts, s3.ts signing logic, money-zone files.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (High). Small diff, but it guards paid-content leakage — highest care.

---

## SC_03 — Admin UI: "Plugin CMS" editor section

**Problem.** Admins have no UI to edit plugin content. SC_01 provides the API; this adds
the editor. The existing Website (landing CMS) editor is the exact UX pattern to clone.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Admin static
UI SOURCE lives at packages/assetflow-studio/js (ROOT source). The admin/js copies are
BUILD ARTIFACTS — never edit them; after editing source run `npm run studio:sync`.

CONTEXT: the "Website" tab editor packages/assetflow-studio/js/admin-website.js (~596
lines) is the pattern: loads GET /api/admin/landing-config ({config, updatedAt, defaults}),
renders section forms, uploads media via POST /api/admin/upload-url → presigned PUT →
stores publicUrl in config (~lines 503–530), saves via PUT, resets via DELETE. Find where
the Website tab is registered in admin navigation (grep admin-views.js /
admin-dashboard.js / the admin index.html) and clone that registration.

BACKEND (already exists — verify with curl/read routes): 
  GET/PUT/DELETE /api/admin/plugin-content-config  (config + defaults; section-level merge)
  Upload folder for this feature: "site/plugin" (accepts image/*, video/mp4, video/webm).

BUILD: new source file packages/assetflow-studio/js/admin-plugin-cms.js + nav entry
"Plugin CMS", following admin-website.js conventions (same helpers, same styling classes,
English labels). Form groups:
1. Home hero — kicker, title, sub, ctaPrimary, ctaSecondary text inputs (maxlength from
   zod caps); background media uploader (image OR video) with preview (img / muted looping
   video) + Remove button (clears mediaUrl/mediaType); mediaMode select:
   "auto (user's last generation wins)" | "media-first (this media always shows)".
2. Section headings — recent / shelf / browseAll. (NOTE: there is NO start-cards group —
   the schema has no home.cards; the plugin's "Start your next project" cards are being
   removed by a parallel redesign.)
3. Guest screen — title (textarea, \n kept), sub, features[3] title+sub.
4. AI launcher — title + 3 category cards (Image/Video/Audio): title, desc, media.
   (No `sub` field — that explainer line was deleted from the plugin.) Empty field =
   plugin uses its built-in text — say so in a helper hint.
Save button does a section-level PUT (like Website), Reset-to-defaults with confirm does
DELETE. Dirty-state indicator. Reuse existing toast/error helpers.

QA: run local dev (npm run studio) or static-serve check: form loads defaults, edits
round-trip, media preview works, no console errors. Then run `npm run studio:sync`.

OUT OF SCOPE: plugin-side rendering; landing Website editor behaviour must not change.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Form UI cloning an existing in-repo pattern.

---

## SC_04 — Plugin: fetch + apply CMS config (texts, hero/card background image-video)

**Problem.** The plugin renders hardcoded copy and a static/gen-thumbnail hero. It must
consume the config from SC_01 so every admin edit reaches all users automatically, with
safe fallbacks (offline, broken media, absent endpoint).

**Exact surfaces in `plugins/after-effects-cep/AssetFlow_Plugin.html`:** logged-in Home
`.fhome` markup ~4174–4212 (hero kicker/h1/sub/CTA buttons; two `.fhome-card`; `.fhome-sechd`
headings; `#homeBArt` hero art) · guest `#homeGuest` ~4215+ · AI launcher lead `~4283–4290`
(`.ai-launch-t`, `.ai-launch-sub`) · `AI_CATS` cards ~11118–11131 rendered into `#aiCatGrid`
~11143 · hero-art + live pricing logic ~7586–7650 (`fhomeFetchModels`, `homeBArt` = last gen
thumb else gradient; `homeBModel`/`fhomeAiBadge` = live `/gen/models` prices — DO NOT alter
pricing).

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target file:
plugins/after-effects-cep/AssetFlow_Plugin.html — a single ~1MB CEP panel HTML with 7
inline scripts. Rules: validate every edited inline script by extracting to node --check;
keep all existing ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. The panel runs inside After
Effects with network access ONLY to our API (window config in assetflow-env.js) and CDN
(cdn.getframeflow.app — already used for catalog thumbs/previews; <video> already works
in this CEP build, 11 existing usages).

BACKEND (already live in code): GET {API}/api/plugin/content-config → { config, updatedAt },
no auth, Cache-Control 60s. Read apps/api/src/lib/plugin-content-config.ts for the exact
shape + defaults (defaults == current hardcoded plugin copy).

SURFACES: a prior redesign task (SC_07) has ALREADY restructured Home — .fhome now
contains: greet row → hero (kicker/h1/.fhome-sub/CTA buttons, #homeBArt) → "Jump back in"
recent-generations strip → multi-row template shelf. The old "Start your next project"
cards NO LONGER EXIST — do not look for them. Locate elements by id/class (line numbers
have shifted): .fhome block, guest #homeGuest, AI launcher .ai-launch-t/.ai-launch-sub,
AI_CATS array → #aiCatGrid render. Hero art + live pricing (fhomeFetchModels,
renderHomeHero): homeBArt shows the
user's last generation thumbnail else a static gradient; homeBModel and fhomeAiBadge show
LIVE prices from /api/studio/gen/models (fhomeFetchModels, 5-min throttle).

TASKS:
1. Config loader: fetch GET {API}/api/plugin/content-config on panel boot and refresh in
   the background every 5 minutes (mirror the fhomeFetchModels throttle pattern; also
   re-apply after login). Persist the last good config JSON in the plugin's existing local
   storage mechanism (see assetflow-local-store.js / localStorage usage patterns in this
   file) and apply the cached copy synchronously on boot so offline/slow-network renders
   are instant and identical to the last seen state. Absent endpoint / fetch error →
   silently keep current copy (today's behaviour).
2. Apply texts via textContent ONLY (never innerHTML for CMS strings — XSS hygiene even
   though the source is admin). Empty/missing field → keep the built-in string. Fields:
   hero kicker/title/sub/cta labels; section headings (recent/shelf/browseAll); guest
   title/sub/features (title/sub support a \n line-break split); AI launcher title;
   AI_CATS card title/desc overrides when set. (No start cards and no launcher sub
   line — both were removed by prior tasks.)
3. Hero background media: if config.home.hero.mediaUrl is set, render inside #homeBArt —
   image → cover <img>; video → <video muted loop autoplay playsinline> with error
   fallback (on error/unsupported codec remove the element → existing gradient/thumb path
   shows). Precedence by mediaMode: "media-first" → admin media always wins;
   "auto" → admin media only when the user has NO last-gen thumbnail (preserve today's
   behaviour when unset). The live model chip (homeBModel) and hero copy render ABOVE the
   media (check z-index/scrim; add a scrim div if text contrast needs it).
4. Card backgrounds: AI launcher category cards with mediaUrl render the media as a
   cover layer UNDER the existing text/glow, with a scrim to keep text legible in all
   3 themes.
5. QA (in-place, cep-mode + browser): 3 themes (noir/neon/cold) × widths 320/420/600 ×
   heights 820/620/500; matrix: no config (offline) → pixel-identical to today · config
   with only texts · config with image hero · config with video hero · broken mediaUrl →
   graceful fallback. node --check on all edited inline scripts. Run install-cep.sh.

DO NOT touch: pricing/credit logic, fhomeFetchModels pricing fields, homeGo navigation,
catalog/shelf data flow, money-zone files.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (High). Single huge file, layered fallbacks, easy to regress.

---

## SC_05 (v2) — Plugin: AI launcher cards — live model names, compact card, no "LIVE" noise

**Problem (found during investigation + owner microcopy report).** `AI_CATS`
(~11118–11131) hardcodes model names — "Nano Banana 2 · Pro / Imagen 4", "Veo 3.1 /
Seedance 2.0", "Chirp 3 HD / ElevenLabs SFX" — rendered as a TWO-line mono list, plus an
always-on "● LIVE" status row on every card. Stale-data risk (owner renames/disables
models in admin → cards lie) + visual noise (always-true status says nothing; two-line
mono lists bloat the cards). The plugin ALREADY fetches the live model catalog
(`/api/studio/gen/models`) for Home pricing.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target file:
plugins/after-effects-cep/AssetFlow_Plugin.html (CEP panel, 7 inline scripts; validate
edits with node --check; then run bash plugins/after-effects-cep/scripts/install-cep.sh).

CONTEXT: AI_CATS array (~lines 11118-11131) renders the AI Tools launcher category cards
(#aiCatGrid, render fn ~11143) with HARDCODED model name strings ("Nano Banana 2 · Pro",
"Imagen 4", "Veo 3.1", "Seedance 2.0", "Chirp 3 HD", "ElevenLabs SFX") in both `models`
(card face) and `tools[].sub`. The panel already fetches the live model catalog: see
fhomeFetchModels (~7586-7650) hitting GET {API}/api/studio/gen/models?mode=image with a
5-minute throttle and a module-level cache (__fhomeModels).

TASK: derive the launcher card model lines from the LIVE enabled model list instead of
hardcoded strings.
1. Extend the existing cached fetch (do NOT add a duplicate request loop): fetch the
   models list per mode (image/video/audio — check the API's mode/kind parameter in
   apps/api/src/routes/studio-gen.ts GET /gen/models to get the exact query shape) and
   cache display names per category alongside the existing price cache, same throttle.
2. For each AI_CATS category: card model line = top 2 enabled model display names joined
   with " · " (audio: prefer one voice + one SFX model if distinguishable from the API
   response; otherwise first two), rendered on ONE line (replace the current two-line
   <br> layout; ellipsis overflow). tools[].sub likewise (single line).
3. DELETE the always-on "● LIVE" status row from the launcher category cards (markup/
   render + its CSS). Do NOT build any health/status UI in its place — status may only
   appear if an exceptional (offline/degraded) state is ALREADY modeled in this file.
   Tighten the card's vertical padding so the removed rows make the cards compact, not
   hollow.
4. Fallback: until the fetch resolves, or on error, keep the current hardcoded strings
   (leave them in AI_CATS as defaults) — the card must never render empty.
5. If a CMS override exists (config.aiLauncher.cards[i].desc from the plugin content
   config — check if that loader is present in this file yet), the CMS value wins over
   the live-derived line. If the CMS loader is not in the file yet, skip this gracefully.
6. Keep AI_CATS structure, dest routing, icons, glow untouched. QA: launcher renders in
   all 3 themes, offline shows defaults, node --check passes, run install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Contained wiring task with an existing pattern.

---

## SC_06 — ⛔ SUPERSEDED (2026-07-16 v2) — merged into SC_07, do NOT run

> The Home redesign (SC_07) rebuilds the same markup region and includes this dedup as
> its step 5. Running both would conflict. Kept for history only.

**Problem (visible in owner's screenshot; also flagged in the 2026-07-16 live audit as
"balans 2x").** The Home header `#homeHd` shows `✦ <balance> <PLAN>` (`.hd-cred`, line
~4164) and immediately below it the `.fhome-top` greet row repeats `<PLAN> ✦ <balance>`
(`.fhome-bal`, line ~4177). Same data twice within ~40px — noise, and two different
orderings of the same chip.

**Director's decision:** the header chip stays (it is canonical and opens the Account
sheet); the greet-row duplicate is removed; the greeting takes the full row width.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target file:
plugins/after-effects-cep/AssetFlow_Plugin.html (CEP panel; validate inline-script edits
with node --check; then run bash plugins/after-effects-cep/scripts/install-cep.sh).

CONTEXT: logged-in Home shows the plan+credit balance TWICE: (a) header .hd-cred inside
#homeHd (~line 4164: ✦ #homeCredVal + .hd-plan[data-hdplan]) — this one opens the Account
sheet and is canonical; (b) the .fhome-top greet row (~line 4177):
<div class="fhome-bal"><span data-hdplan>FREE</span><strong>✦ <span id="homeBBal">—</span></strong></div>.

TASK: remove the duplicate (b).
1. Delete the .fhome-bal node from the .fhome-top markup; let .fhome-greet take the full
   row (adjust the .fhome-top flex CSS if it assumed two children).
2. Find every JS reference to homeBBal (renderHome and any balance-update paths) and
   remove/neutralize them WITHOUT breaking the shared update helpers: note that plan
   updates target ALL [data-hdplan] nodes (setHeaderPlan-style loop) — removing one node
   is safe, but homeBBal getElementById calls must not throw; delete the writes or guard
   them, whichever is the smaller diff.
3. Confirm the header .hd-cred still updates balance+plan after login and after a
   generation (search for where homeCredVal is written).
4. QA: 3 themes × widths 320/420/600 — greet row aligned, no leftover gap; node --check
   on edited scripts; run install-cep.sh.

Scope: this exact duplication only. Do not restyle the header or greet typography.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Small precise removal.

---

## SC_07 — Plugin Home redesign: kill duplicate entry points, fill the dead void (v2)

**Problem (owner report + screenshot, 2026-07-16).** Two structural defects on the
logged-in Home:
1. **Triple entry points.** One screen offers AI Studio three ways (hero "✦ Open AI
   Studio" + "Create with AI." card + nav) and Stock Catalog three ways (hero button +
   "Start from a template." card + "Browse all →"/shelf). The "Start your next project"
   cards are pure duplicates of the hero CTAs — noise, no new information.
2. **Dead void below the shelf.** Content ends after one 4-card shelf row; on tall panels
   the lower half of Home is empty black.

**Root cause vs approved IA.** The approved Home structure (owner survey, 2026-07-16) is
**banner + recent works + template shelf**. The current build shipped banner + duplicate
start cards + single-row shelf — the "recent works" section is missing entirely, and the
duplicates took its place. Data for recent works already exists in the file: `__homeGen`
fetches `/api/studio/gen/history?limit=8` (60s throttle) but keeps only the first item.

**Director's design decision (build exactly this):** greet row (greeting only) → hero
banner (its two CTAs become the ONLY primary entries) → **"Jump back in"** strip (last
up-to-6 generations) → **"Fresh for your next cut"** multi-row grid (up to 12 items +
Browse-all ghost card). Start cards + their heading are deleted. Greet-row balance
duplicate is deleted (old SC_06). **Owner requirement (v3): Home must fill the panel
height — never half-empty — using LARGE, generous cards**: the layout scales up (taller
hero, big media tiles, airy gaps) instead of leaving black void. Airy density is the
approved style direction (2026-07-16 survey: "HAVODOR — katta bo'shliq, yirik element").

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target file:
plugins/after-effects-cep/AssetFlow_Plugin.html — single ~1MB CEP panel HTML, 7 inline
scripts. Rules: validate every edited inline script via node --check extraction; keep
existing ids/handlers working; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. Panel runs inside After Effects;
network only to our API + cdn.getframeflow.app. 3 themes exist (noir/neon/cold) via CSS
tokens — never hardcode colors, use var(--…) tokens already present in the .fhome CSS.

CURRENT LOGGED-IN HOME (.fhome namespace, markup ~lines 4174-4212; CSS in the same file;
JS ~7586-7830): greet row (.fhome-top: #homeGreet + .fhome-bal balance) → hero
(.fhome-hero: #homeBArt art, #homeBModel live chip, kicker/h1/.fhome-sub, two CTA buttons
onclick homeGo('ai')/homeGo('video')) → "Start your next project" heading + .fhome-cards
(two buttons: "Create with AI." with #fhomeAiBadge, "Start from a template.") →
"Fresh for your next cut" heading + .fhome-shelf #homeGrid (single row, 4 items,
render fn ~7815). Recent-gen data: __homeGen (~7679) fetches
GET /api/studio/gen/history?limit=8 with 60s throttle but stores ONLY the first item
(.it) — used for the hero art background (renderHomeHero ~7604). Header #homeHd
(~4160-4166) already shows balance+plan (.hd-cred → Account sheet).

REDESIGN — build exactly this structure (approved IA: banner + recent works + shelf):

1. DELETE the "Start your next project" section: the .fhome-sechd heading and the whole
   .fhome-cards block (both cards). Keep homeGo intact (hero CTAs still use it). Remove
   or neutralize #fhomeAiBadge writes in renderHomeHero (element is gone — writes must
   not throw; the hero chip #homeBModel keeps showing the live featured-model price, so
   live pricing stays visible on Home). Remove now-orphaned .fhome-card CSS or leave it
   clearly commented as retired — prefer removal if it is not referenced elsewhere.

2. DELETE the greet-row balance duplicate: remove .fhome-bal (plan + ✦ #homeBBal) from
   .fhome-top — the header .hd-cred is canonical. Guard/remove all homeBBal JS writes so
   nothing throws. #homeGreet takes the full row (adjust .fhome-top layout). Restyle the
   greeting from uppercase letter-spaced mono microtext to normal sentence case
   ("Good evening, Khudoybergan" — existing name logic), regular font, slightly larger —
   it is a greeting, not a system label.

3. NEW "Jump back in" strip between hero and shelf (hidden entirely when user has no
   generations — no empty placeholder):
   - Extend __homeGen to keep the fetched LIST (e.g. .items = up to 8 normalized entries)
     alongside the existing .it (keep .it working — hero art depends on it).
   - Render up to 6 cards in a horizontal strip (.fhome-recent): thumbnail (thumb/poster
     from the history payload; video items get a small ▶ glyph overlay), one-line meta
     (model name or kind), relative time (reuse an existing time-ago helper if the file
     has one; otherwise a tiny local one).
   - Click → homeGo('ai') then open the history view (the launcher has data-go="history"
     wiring — find the existing navigation helper for it and call the same path; if
     deep-linking to a specific item is not already supported, just landing on history
     is enough — do NOT build new routing).
   - Section heading "Jump back in" via .fhome-sechd, same style as the shelf heading.
4. SHELF becomes a multi-row grid of LARGE cards: #homeGrid CSS → grid,
   grid-template-columns: repeat(auto-fill, minmax(~240px, 1fr)) (320px panel = 1 big
   column, ~420px = 1-2, 600px = 2, wide = 3-4); 16:9 media area, roomy title/meta
   padding; raise the catalog fetch limit for Home to 12 (find where the shelf data is
   requested ~7815 and its current limit); append a final "Browse all →" ghost card
   (same homeGo('video') action) styled as a subtle outline card. Keep skeleton-loading
   behaviour (render a full row of skeletons at the new card size).
   Card anatomy (microcopy purge): media with compact overlaid chips (FREE/PRO + a
   resolution/4K chip if the catalog payload has it) + ONE title line below (ellipsis).
   DELETE the "AFTER EFFECTS · 1080P" mono meta row — "After Effects" is redundant on an
   all-AE shelf; resolution lives on the thumb chip. No other text under the card.
5. FULL-HEIGHT layout — the owner's hard requirement: Home must never look half-empty.
   - Make the Home content column a min-height:100% flex column inside its existing
     scroll container (find how #homeMain scrolls; keep scrolling for short panels).
   - Hero scales with the panel: height ≈ clamp(260px, 38% of panel height, 460px) —
     tall panels get a big cinematic banner, short panels (≤560px) keep today's compact
     hero. Hero copy/CTA sizes step up on tall panels (one clamp() step, no new
     breakpoint system).
   - "Jump back in" tiles are LARGE (thumb ≈ 150-170px tall on ≥420px widths), airy
     16-20px gaps.
   - Remaining slack distributes into section gaps (flex-grow on the gaps between
     sections or margin scale), NOT into a void after the last section; bottom padding
     24-32px.
   - Acceptance: at 420×820, 600×820 and 600×1000 with 6 recent items + ≥8 shelf items,
     empty space below the last section ≤ ~10% of panel height. With few items (new
     user: 0 recent, 3 templates) the scaled-up hero + large cards must still fill ≥80%
     of an 820px panel.

DO NOT touch: hero markup/copy besides the badge cleanup, homeGo navigation semantics,
fhomeFetchModels pricing logic, catalog/shelf card click-through (openPack path), any
money-zone file. No new API endpoints — only existing history + catalog calls.

QA (in-place, browser cep-mode emulation + real sizes): 3 themes × widths 320/420/600 ×
heights 820/620/500; states: 0 generations (strip hidden) · 1 · 6+ generations; shelf
with 0 (section hidden, existing behaviour) / 3 / 12 items; offline boot → no throws,
layout intact; node --check on all edited inline scripts; run install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (High). Structural markup+CSS+JS surgery in the 1MB panel file.

---

## SC_08 — Plugin-wide microcopy purge (compact pass, Director rulebook)

**Problem (owner report, 2026-07-16).** The plugin is littered with small distracting
texts: mono uppercase micro-labels, explainer sublines that restate the obvious, and
always-true status badges. Owner directive: remove the noise; use a modern, design-fit
icon ONLY where it communicates instantly; where neither text nor icon is needed —
nothing. Overall: compact.

**Division of labour (avoid conflicts):** Home `.fhome` internals → SC_07 · AI launcher
category cards (model lines + LIVE) → SC_05 · this task = everything else in the plugin,
audit-driven.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target file:
plugins/after-effects-cep/AssetFlow_Plugin.html — single ~1MB CEP panel, 7 inline
scripts, 3 CSS themes (noir/neon/cold) via var(--…) tokens. Rules: validate edited
inline scripts via node --check; keep ids/handlers working; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`.

GOAL: a plugin-wide "microcopy purge" — remove small distracting texts per the rulebook
below, making surfaces compact. This is a copy/markup/CSS pass; NO behaviour changes.

RULEBOOK (apply mechanically; when in doubt, flag in summary instead of guessing):
(a) Meta text repeated identically on every item of a list (adds zero differentiation)
    → DELETE the text row; genuinely differentiating data (resolution, duration, count)
    becomes a compact chip overlaid on the item's media, not a text line.
(b) Explainer sublines that restate what the UI already shows → DELETE.
(c) Always-true status badges ("● LIVE" style) → DELETE; a status indicator may exist
    ONLY for an exceptional state (offline/error) that the code already models. Do not
    build new status logic.
(d) Icons: replace text with an icon ONLY when the meaning is instant (▶ play, image/
    video kind, ⚙ settings). Use the file's existing inline-SVG icon style (stroke
    width, size) — no emoji, no new icon font. If the information itself is unnecessary,
    remove it entirely (no icon either).
(e) Reclaim the freed vertical space (tighten paddings/margins) — compact, but never
    shrink interactive hit areas below ~24px.
(f) NEVER remove: pricing/credit chips (✦ costs, plan badges, cost tags on Generate
    buttons), legal/consent texts, error/empty-state messages, Account sheet content.

KNOWN INVENTORY (start here, verified locations):
1. AI launcher explainer line .ai-launch-sub "Prompt → result → import directly into AE"
   (~line 4290) → DELETE element + CSS + any JS references. (The plugin content-config
   CMS schema has no field for it — nothing else depends on it.)
2. Launcher "HISTORY" mono-caps section label (~4300) → keep the section, but make the
   label consistent with other section headings' case/size (it may stay if it matches
   the design system; decide by comparing with sibling headings and note the decision).

AUDIT (the bulk of the task): inventory ALL remaining micro-text instances by searching
the panel's CSS for uppercase/letter-spacing/≤11px label classes and the markup for
mono-caps strings; walk every logged-in surface (Catalog, template detail, Library,
Settings, AI history/sessions/projects, import flows, toasts). Classify each instance
against the rulebook and apply. EXCLUDE regions owned by parallel tasks: everything
inside .fhome (Home) and the AI launcher category cards (#aiCatGrid model lines/LIVE).

DELIVERABLE in your summary: a table — element/selector → what it said → decision
(deleted / icon / chip / kept + why, rule letter). Flag anything ambiguous instead of
deleting it.

QA: 3 themes × widths 320/420/600; spot-check each edited surface; no layout collapse
where rows were removed; node --check all edited inline scripts; run install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (Medium). Judgment-heavy sweep across a 1MB file — needs discipline.

---

## SC_09 — Web platform: same microcopy purge (app surfaces)

**Problem.** The same noise exists on the web app (owner screenshots include web AI Tools:
"Prompt → result → import directly into AE" subline, two-line mono model lists +
"● LIVE" on tool cards, "AFTER EFFECTS · 1080P" meta rows on catalog cards).

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Target:
packages/assetflow-studio/platform/index.html — the DIRECT source for the CF Pages web
app (edit it directly; no sync step). DO NOT touch landing sections/pages (ffl- prefixed
markup/files) — landing copy is CMS-managed marketing and out of scope. Do not touch
admin/ or contributor/ surfaces. 3 themes (noir/neon/cold) via var(--…) tokens.

GOAL: microcopy purge on the web APP surfaces (dashboard, stock catalog, AI tools/studio,
library/projects) — remove small distracting texts, compact result. Copy/markup/CSS pass
only; NO behaviour changes.

RULEBOOK — identical to the plugin pass:
(a) per-item meta text that never differs (e.g. "AFTER EFFECTS · 1080P" under every
    catalog card) → delete the row; differentiating data (resolution/duration) → compact
    chip overlaid on the card media.
(b) explainer sublines restating the obvious (e.g. the AI Tools page subline
    "Prompt → result → import directly into AE") → delete.
(c) always-true "● LIVE" badges on AI tool cards → delete (status only for exceptional
    states already modeled in code); if the tool cards list model names in a two-line
    mono block, collapse to ONE line — and if the page already has live model data in
    scope, use it; do NOT add new fetches.
(d) icon only where meaning is instant, matching the existing inline-SVG style;
    unnecessary info → nothing at all.
(e) reclaim freed space (compact paddings); hit areas ≥ 24px.
(f) NEVER remove: pricing/credit chips and cost tags, plan badges, legal/consent, error
    and empty-state messages.

PROCESS: inventory ALL app-surface micro-texts (uppercase/letter-spacing/≤11px label
CSS + mono-caps strings), classify per rulebook, apply, and produce the same
decision table in your summary. Flag ambiguous cases instead of deleting.

QA: all 3 themes × mobile (~390px) / tablet / desktop widths; affected pages render
without layout collapse; browser console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Same rulebook, smaller surface, direct-source file.

---

## Execution + deploy checklist (owner)

1. SC_01 → SC_02 (then: push → API deploy → `wrangler deploy` in `workers/cdn-proxy`).
2. SC_03 (push → CF Pages).
3. SC_07 (Home redesign) → live AE check → SC_04 (CMS wiring) → SC_05 → SC_08
   (microcopy purge last among plugin tasks — one install-cep + AE ⌘Q restart covers
   SC_04/05/08 together if preferred). SC_06 — skip (superseded).
4. SC_09 (web purge) any time — independent of the plugin chain (push → CF Pages).
5. Live E2E: admin edits hero text + uploads a video → within ~5 min the plugin Home
   shows it (config cache 60s + plugin 5-min refresh) without reinstalling the plugin.

---

# COLLECTED PROBLEMS (owner dictation round, 2026-07-16 — appended as reported;
# final ordering/grouping happens after the round ends)

## SC_10 — GLOBAL compact pass: every surface of plugin AND web (example: Account sheet)

**Problem (owner report + Account sheet screenshot).** The compactness/micro-noise
problem is not limited to Home or the AI launcher — it exists EVERYWHERE in both the
plugin and the web app. Example shown: the Account sheet — oversized vertical rhythm
(each block is a tall card with big paddings), mono-caps micro labels ("THIS MONTH —
DOWNLOADS", "STORAGE — AI RESULTS", "PLAN", "THEME", "DOWNLOAD FOLDER"), stacked
full-width rows (Manage subscription, folder row, Choose folder/Default/Save, Sign out)
eating a full screen of height. Owner directive: make it ALL compact.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts.
   Validate edited inline scripts via node --check; keep every id/handler bound; after
   edits run `bash plugins/after-effects-cep/scripts/install-cep.sh`.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (edit directly). DO NOT touch landing (ffl- prefixed) markup/pages, admin/ or
   contributor/ surfaces.
Both use 3 CSS themes (noir/neon/cold) via var(--…) tokens — never hardcode colors.

GOAL: a GLOBAL compactness pass over every user-facing surface in BOTH files (Account
sheet, settings, modals/sheets, library, catalog detail, sessions/projects, history,
import flows, toasts — everything you find). Visual/CSS/markup pass only; NO behaviour,
routing, or data changes.

COMPACT RULES:
(1) Vertical rhythm: cut oversized paddings/margins/gaps roughly 30-40% where blocks are
    obviously airy beyond function (e.g. tall stat cards with one line of content).
    Target: a sheet like Account fits in ~60-70% of its current height without feeling
    cramped. Interactive hit areas stay ≥ 24px (buttons visually slimmer is fine).
(2) Section micro-labels (mono uppercase letter-spaced, e.g. "THIS MONTH — DOWNLOADS",
    "STORAGE — AI RESULTS", "PLAN", "THEME", "DOWNLOAD FOLDER"): keep the grouping but
    make labels smaller/quieter and pull them tight to their content — one consistent
    section-label style reused everywhere (pick the tightest existing token-based style;
    do not invent a new type scale).
(3) Merge rows that carry little info: e.g. in Account, the downloads bar + "Total: 16 ·
    Imports: 23" meta can be one compact row; storage likewise (label, slim progress,
    value on one line). Stat cards become slim rows, not tall cards.
(4) Side-by-side where space allows: theme picker tiles, plan cards, and button rows
    (Choose folder / Default / Save) should sit compactly in one row on wider layouts
    and wrap gracefully at narrow plugin widths (320px = single column).
(5) Redundant helper sentences under controls (e.g. "Template files (.aep + footage) are
    saved to this folder.", "Pro is active — unlimited downloads and pack files.") →
    shorten to a few words or fold into the control's own label/tooltip-title attr; keep
    the information reachable, drop the paragraph feel.
(6) NEVER remove or shrink: pricing/credit values, plan badges, quota numbers
    (16/Unlimited, 274 MB/5 GB), legal/consent, error & empty states, Sign out.
    Money-related displays stay byte-identical in MEANING (styling may compact).
(7) Consistency: apply the same spacing scale to sibling surfaces in both files — the
    plugin Account sheet and the web account/settings must feel like one system.

SCOPE NOTE: Home (.fhome) and the AI launcher category cards are being reworked by
parallel tasks — skip their internals; everything else is yours.

DELIVERABLE in summary: per-surface list (surface → what was tightened → approx height
saved). Flag anything you deliberately left airy and why.

QA: plugin — 3 themes × widths 320/420/600 × heights 500/620/820, Account sheet + every
edited surface opens with no clipped/overlapping controls; node --check all edited
inline scripts; run install-cep.sh. Web — 3 themes × ~390px/tablet/desktop, console
clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (Medium). Broad two-file CSS/markup sweep — needs restraint and
consistency.

---

## SC_11 — Credit chip click must open the credit PURCHASE (top-up) flow — web AND plugin

**Problem (owner report).** Clicking the header credit balance chip (✦ 380 · PRO) should
take the user to buying credits (the existing "Top up credits" screen with packs
✦500/$5 · ✦1,500/$12 · ✦5,000/$35). Today the chip opens other things (in the plugin it
opens the Account sheet). Applies to BOTH the web app and the plugin.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (edit directly; do NOT touch landing ffl- markup, admin/ or contributor/).
2. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   validate edits via node --check; after edits run
   `bash plugins/after-effects-cep/scripts/install-cep.sh`.

GOAL: clicking the header credit-balance chip opens the credit PURCHASE (top-up) flow
directly — in both apps. UI navigation change ONLY: reuse the EXISTING top-up/checkout
flow; do NOT touch pricing, credit values, checkout logic, or any money-zone code
(gen-quote/gen-models/plugin-profile/webhooks are off-limits).

INVESTIGATE FIRST:
- WEB: find the existing credit purchase UI — the "CREDIT BALANCE … Top up credits"
  panel with the ✦500/$5 · ✦1,500/$12 · ✦5,000/$35 pack cards (grep "Top up" /
  "CREDIT BALANCE" in platform/index.html) and how it is opened (modal? account/credits
  view? Lemon Squeezy checkout links?). Then find the header credit chip element(s) and
  their current click handler.
- PLUGIN: the header credit chip (.hd-cred / #homeCred and the AI-view equivalents
  #aiLeadCredL etc.) currently calls openAccountSheet(). Find whether the plugin already
  has a top-up path (Account sheet button, openWebAdmin()-style external link to the web
  billing/credits page, or an in-panel credits view).

CHANGE:
1. WEB: every header credit chip click → open the top-up purchase UI directly (the pack
   picker), not a generic account page. If the top-up UI lives inside a larger
   account/credits view, open that view pre-scrolled/focused on the top-up section.
2. PLUGIN: credit chip click → the fastest existing route to purchasing credits:
   - if an in-panel top-up/credits view exists → open it;
   - otherwise open the web top-up page in the system browser using the plugin's
     existing external-open helper (openWebAdmin()-style; find and reuse it), pointing
     at the web app's credits/top-up destination.
   The avatar button keeps opening the Account sheet (account access must not be lost);
   only the CREDIT CHIP changes destination. Apply to every credit chip instance in the
   panel (Home header, AI views' aiLeadCred*, any others — grep the shared class).
3. Keep tooltips/titles truthful (e.g. "Buy credits") on the chips you rewire.

QA: web — chip click from dashboard/catalog/AI pages lands on the pack picker, 3 themes,
console clean. Plugin — chip click from Home and AI views; logged-out state does nothing
harmful (guard if user==null: fall back to current behaviour); node --check; run
install-cep.sh.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Navigation rewiring over existing flows; money logic untouched.

---

## SC_12 — Top-center segmented nav: 3 tabs (Home · AI Tools · Stock Catalog), always
## centered, position NEVER moves between sections — web AND plugin

**Problem (owner report + AI Tools screenshot).** The header's center segmented control
currently shows only "Catalog | AI Tools", the buttons don't work reliably, and the
control is not stable: it exists on some views, missing/different on others, and its
position shifts when switching sections. Owner requirements:
1. The segmented control must have THREE tabs: **Home · AI Tools · Stock Catalog**.
2. Each tab must actually navigate correctly.
3. The control sits in the horizontal CENTER of the top bar and its position must be
   IDENTICAL on every section — switching sections must not move or hide it.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (edit directly; do NOT touch landing ffl- markup, admin/ or contributor/).
2. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   validate edited inline scripts via node --check; keep ids/handlers bound; after edits
   run `bash plugins/after-effects-cep/scripts/install-cep.sh`.
Both use 3 CSS themes (noir/neon/cold) via var(--…) tokens — no hardcoded colors.

GOAL: one consistent top-bar segmented navigation with exactly three tabs —
"Home · AI Tools · Stock Catalog" — horizontally centered, pixel-stable across ALL
app sections, with correct navigation and correct active state.

INVESTIGATE FIRST (both files):
- Find every top-bar/header variant. Known symptoms: an .ai-seg segmented control with
  "Catalog | AI Tools" exists on AI views; the Home header has no segmented control;
  other views may have their own headers. In the plugin, grep .ai-seg / .ff-seg /
  afNavTab / homeGo / switchNavFromSidebar to map the navigation helpers that already
  switch sections (Home, AI launcher, catalog). In the web app, find the equivalent
  header nav and section-switching functions.
- Identify why current seg buttons misbehave (dead handlers, wrong data-go targets,
  view-scoped headers replacing each other).

CHANGE (same design in both files):
1. The top bar on EVERY logged-in section renders the same segmented control with three
   items: Home · AI Tools · Stock Catalog. Wire each to the EXISTING navigation helpers
   (do not invent new routing): Home → main/home view; AI Tools → AI launcher/workspace;
   Stock Catalog → catalog view.
2. Active state: the segment matching the current section is highlighted; updates on
   every navigation (including navigations triggered elsewhere — hero CTAs, cards,
   sidebar), not only on seg clicks.
3. Layout stability: the seg is centered with a symmetric grid/flex (left cluster: logo;
   center: seg; right cluster: credits+avatar) — use a 3-column grid (1fr auto 1fr) or
   equivalent so the CENTER NEVER shifts when left/right content width varies between
   sections. One shared header instance (or byte-identical markup+CSS on every view) —
   switching sections must produce zero visual jump of the seg (same y-position, same
   x-center). If multiple per-view headers exist and unifying them into one persistent
   header is a small, safe change — do it; if it requires restructuring beyond the
   header, keep per-view headers but make their seg markup/CSS byte-identical.
4. Narrow plugin widths (320px): the three labels must fit — compact label style or
   short labels (Home · AI · Stock) below ~360px; still centered.
5. Keep the right-side credit chip/avatar behaviour intact (a parallel task rewires the
   chip's click — do not change chip handlers here; just preserve them).
6. ALWAYS PRESENT, NEVER DISAPPEARS (owner addition): the top bar with the seg stays
   pinned at the top on EVERY logged-in screen — including template detail, tool
   workspaces, sessions/projects/history, settings, and any sub-view — and remains
   visible while scrolling (sticky/fixed at top; content scrolls under it). No view may
   replace or hide it (sheets/modals overlaying temporarily are fine; full views are
   not). Guest/login screens are the only exception.

QA: both apps — from each of the three sections click through all seg tabs (9 paths),
active state correct; take/inspect the header on each section and confirm the seg's
position is identical (no jump); 3 themes; plugin widths 320/420/600 (node --check +
install-cep.sh); web ~390px/desktop, console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (Medium). Cross-view header unification in two codebases — regression-prone.

---

## SC_13 — Remove the bottom user/Import bar in Stock Catalog (and everywhere else)

**Problem (owner report + catalog screenshot).** The Stock Catalog view in the plugin
has a fixed bottom bar: avatar + "KHudoybergan / Pro · 16 downloads" on the left and an
"Import" button on the right. Owner: this bar is not needed at all — remove it, and it
must not appear on any other section either.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   validate edited inline scripts via node --check; keep remaining ids/handlers bound;
   after edits run `bash plugins/after-effects-cep/scripts/install-cep.sh`.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (check whether the same bottom bar pattern exists there; if not, no web change).
   Do NOT touch landing ffl- markup, admin/ or contributor/.

GOAL: delete the persistent bottom bar (user avatar + name + "Pro · N downloads" +
"Import" button) from the Stock Catalog view AND any other view that renders it. It
must not exist anywhere in either app.

INVESTIGATE FIRST:
1. In the plugin, locate the bottom bar markup/CSS/JS (grep for the "downloads" counter
   rendering, the bar's Import button handler, and fixed-bottom bar containers). Map
   every view that shows it.
2. CRITICAL — understand what the bar's "Import" button does before deleting: if it
   imports the currently selected/downloaded template, confirm the same action is
   reachable elsewhere (each card already has Re-import; the template detail view has
   its own import/download action). If you find ANY state where the bottom bar's Import
   is the ONLY path to that action, do not silently drop the capability — move/merge the
   action into the card/detail flow that already exists, and explain the move in your
   summary. Do NOT redesign the import flow itself.
3. Check what listens to the bar (resize/layout offsets: content bottom-padding sized to
   the bar height, scroll containers, height presets) and clean those up so no dead gap
   remains at the bottom.

CHANGE:
1. Remove the bar's markup, its CSS, and its JS wiring (render/update calls, the
   downloads-counter updates that target it). Guard any shared helpers so nothing
   throws (e.g. functions that also update the Account sheet's download counter must
   keep working — only the bar's DOM targets disappear).
2. Remove equivalent bars on any other views found in step 1 (the owner wants it gone
   globally).
3. Reclaim the freed space: content areas extend to the bottom edge cleanly.
4. Web: apply the same removal only if the same bar pattern exists.

QA: plugin — Catalog, template detail, Home, AI views at widths 320/420/600 × heights
500/620/820: no bottom bar anywhere, no dead bottom gap, import still works from card
Re-import and detail view (do one full import path in cep-mode emulation if live AE is
unavailable); node --check all edited inline scripts; run install-cep.sh. Web — affected
pages render clean, console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Careful removal with capability preservation check.

---

## SC_14 — Stock catalog cards: no Re-import button, no contributor name, cards must
## stand out from the background; template detail must be LARGE (panel-fitting)

**Problem (owner report + 2 screenshots).** Four defects in the Stock Catalog:
1. Every card carries a full-width "↺ Re-import" button — unnecessary: the user opens
   the template detail and downloads/imports from there anyway.
2. Cards visually melt into the page background (same dark surface, weak separation) —
   each card must read as a distinct card.
3. Cards show the contributor name ("Logo Reveal · KHudoybergan") — the contributor name
   must NOT be shown on cards.
4. Clicking a card opens the template detail as a small centered column (~60% of the
   panel is empty black margin) — the detail must be LARGE, using the plugin panel's
   width properly.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   validate edited inline scripts via node --check; keep ids/handlers bound; after edits
   run `bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 CSS themes
   (noir/neon/cold) via var(--…) tokens — no hardcoded colors.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app: check whether the same catalog-card patterns exist there and apply the SAME
   changes where they do. Do NOT touch landing ffl- markup, admin/ or contributor/.

GOAL — four changes to the Stock Catalog experience:

1. REMOVE the per-card "Re-import" button from catalog cards (markup + CSS + its JS
   wiring). Import/download stays available in the template DETAIL view (verify the
   detail's Import path still works before deleting; also check the "Downloaded" state
   logic — the downloaded badge on the thumb stays, only the button row goes). If any
   other card variant (search results, similar-templates strips, Library) renders the
   same button, remove it there too — card click → detail is the single flow.

2. CARD SEPARATION: cards must stand out from the page background in all 3 themes.
   Use the design system's existing card tokens (surface var one step lighter/darker
   than the page bg, subtle 1px border token, existing radius scale, gentle hover lift
   already used elsewhere in the app — find a well-separated card elsewhere in the file
   and reuse its exact surface/border/hover recipe). No new colors.

3. REMOVE the contributor name from cards: the meta line "Category · ContributorName"
   becomes just "Category". Do this wherever catalog-style cards render a contributor
   name (catalog grid, similar-templates strip, search results). Do NOT remove
   contributor data from API payloads or the detail view logic — this is card display
   only. If the detail view shows the contributor, leave the detail as is.

4. TEMPLATE DETAIL — LARGE, panel-fitting layout (plugin): the detail currently renders
   as a narrow centered column with huge empty margins. Rework its layout container so
   it uses the panel properly at every width:
   - ≤ ~500px wide: single column, media full-width (edge padding 12-16px), content
     below.
   - Wider panels (600px+): media scales to fill the available width (16:9, large),
     meta/tags/description/actions use the full content width; optionally a two-column
     arrangement (media left, info right) if the existing markup allows it WITHOUT
     restructuring the DOM order — CSS-first approach.
   - The Import button, badges, tags, "Similar templates" strip all scale with the new
     width. No behaviour changes — same handlers, same data.
   Web: only apply if the web detail suffers the same cramped pattern; otherwise leave.

QA: plugin — catalog grid + detail at widths 320/420/600/900 × 3 themes: cards clearly
separated, no Re-import buttons, no contributor names, detail media large with no dead
side margins; full flow card → detail → Import works; node --check; install-cep.sh.
Web — same checks where changes applied; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (Medium). Catalog card + detail layout rework across two files.

---

## SC_15 — Kill "HISTORY" (plugin + web): ONE place — "My Library"; large 2-row grid;
## gen cards keep NATIVE aspect ratio everywhere; compact top-bar entry next to the seg

**Problem (owner report + AI Tools screenshot).**
1. AI Tools has a "HISTORY" section (mono-caps label + one-row strip + "All →" history
   view) in the plugin and on the web. The HISTORY concept must be REMOVED — there must
   be only ONE place for the user's generated works: **My Library**.
2. My Library's cards must look beautiful and LARGE — laid out in TWO rows (not one
   strip row) — a proper attractive grid.
3. Generation result cards are being forced into 1:1 squares here — ugly. Gen cards must
   render at their OWN (native) aspect ratio always, everywhere they appear.
4. My Library must also get a spot at the TOP, next to the SC_12 global seg
   (Home · AI Tools · Stock Catalog) — but compact: the top bar must not get stuffed;
   the plugin must not feel overloaded.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   validate edited inline scripts via node --check; keep ids/handlers bound; after edits
   run `bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 CSS themes via
   var(--…) tokens.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app; apply the same concept where the same patterns exist. No landing (ffl-),
   admin/, contributor/ changes.

CONTEXT: the AI Tools launcher shows a "HISTORY" mono-caps label + horizontal one-row
strip (#aiHistSec / #aiHistStrip in the plugin) + an "All →" link to a history view;
gen history data comes from GET /api/studio/gen/history (KEEP the endpoint usage — this
is a UI consolidation, not a data change). A "My Library" concept already exists in the
plugin (grep "My Library" / library view) — investigate what it currently shows.

GOAL — consolidate to ONE user-works surface named "My Library":

1. REMOVE the "HISTORY" section from the AI Tools launcher (label, strip, "All →") in
   both apps, and remove/redirect every other entry point named "History" (e.g. the
   clock icon button in the AI Tools header, data-go="history" wirings): they either
   disappear or navigate to My Library instead — no surface named "History" remains
   anywhere. The underlying history VIEW/data logic becomes My Library's content source:
   rename/merge rather than delete data plumbing. Nothing the user generated may become
   unreachable — every item previously visible in History must be visible in My Library.
2. MY LIBRARY — beautiful large grid: the user's generated works (and whatever the
   existing My Library already held — merge, don't lose) rendered as a grid of LARGE
   cards spanning TWO rows visually at typical widths (i.e. a real multi-row grid, not a
   single strip; at 420px ≈ 2 columns, 600px+ ≈ 3, week narrow 320px = 1-2). Reuse the
   app's card surface/border/hover tokens so it looks consistent and premium.
3. NATIVE ASPECT RATIO: generation result cards must render media at its OWN aspect
   ratio (16:9, 9:16, 1:1, 4:5 — whatever the item is) — never force-crop to 1:1 —
   EVERYWHERE gen items render (My Library grid, any strips, session/project item
   thumbnails, web equivalents). Use the aspect data from the gen item payload
   (width/height or aspect field — check the history item shape); fallback 16:9 when
   unknown. In a multi-column grid use a masonry-like or row-height-capped approach
   with object-fit: contain/cover chosen so media is NOT distorted and NOT cropped to a
   different shape (letterbox on a token surface is acceptable). Keep it simple — CSS
   first, no new libraries.
4. TOP-BAR ENTRY (OWNER CORRECTION — it is NOT "Library" that goes to the top):
   **Sessions and Projects** move to the top bar, next to the global seg
   (Home · AI Tools · Stock Catalog), as COMPACT entries; and the local
   "Tools | Sessions | Projects" sub-tab row is REMOVED from the AI Tools view
   entirely. Wire the top-bar Sessions/Projects entries to the same existing
   navigation targets the old sub-tabs used (data-go="sessions"/"projects" paths —
   reuse, don't rebuild). "Tools" needs no entry — the global "AI Tools" segment
   already lands there. My Library lives INSIDE the AI Tools surface (it replaced
   HISTORY, step 1-2) — no top-bar Library entry.
   HARD CONSTRAINT from the owner: everything stays compact — the top bar must not
   overflow or wrap; at narrow plugin widths (~320-420px) render Sessions/Projects as
   icon-only buttons with title tooltips; wider panels may show short text labels.
5. Only the History concept and the AI Tools sub-tab row die; Sessions/Projects
   VIEWS and behaviour stay untouched — they are just reached from the top bar now.

QA: plugin — AI Tools launcher (no HISTORY anywhere), My Library grid at widths
320/420/600/900 × 3 themes: large cards, ≥2 visual rows with content, native aspect
ratios verified with a mixed set (16:9 video, 9:16, 1:1, 4:5); every old History entry
point now lands in My Library; top bar clean at 320px; node --check; install-cep.sh.
Web — same concept verified where applied; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (High). View consolidation + navigation rewiring + grid/aspect
engine — regression-prone.

---

## SC_16 — Gen cards in My Library: native aspect, ONE action button (web-style menu),
## menu opens ON the card, decent audio card — plugin AND web

**Problem (owner report + 4 screenshots).**
1. In the plugin's My Library every gen card is forced to 1:1 — cards must render at
   the generation's OWN size/aspect ratio.
2. Under every card in the plugin sits a permanent ugly row of 6 action icons
   (download / add-to-project / explore / regenerate / copy / delete). It must work
   like the web: actions hidden until the user presses ONE button (the "Use ▾" style
   button) which reveals the full action menu (Edit image, Generate video from image,
   Add to project, Add to Explore, Download, Regenerate, Copy prompt, Delete,
   Upscale x2/x4, Make variations…).
3. The web has its own bug here: the Use-menu must appear ONLY when Use is pressed, and
   it must open ON/OVER that gen card — currently it opens far away from the card
   (screenshot shows the menu detached at the top-left of the page, nowhere near the
   clicked card).
4. The audio/sound gen card is an ugly empty dark box with a tiny note icon — it needs
   a proper, intentional design.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   validate edited inline scripts via node --check; keep ids/handlers bound; after
   edits run `bash plugins/after-effects-cep/scripts/install-cep.sh`. 3 CSS themes via
   var(--…) tokens.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app. No landing (ffl-), admin/, contributor/ changes.

CONTEXT: gen result cards (user's generated works — My Library / library / history
grids). The WEB version has the correct action model: a single "Use ▾" button on the
card opens a rich context menu (Edit image · Generate video from image · Add to
project · Add to Explore · Download · Regenerate · Copy prompt · Delete · Upscale
x2→2K ✦4 / x4→4K ✦8 · Make variations). The PLUGIN instead shows a permanent 6-icon
strip under every card. Find both implementations (grep the plugin for the 6-icon
action row under gen cards; grep the web for the Use menu / its positioning logic).

TASKS:

1. PLUGIN — native aspect: gen cards render media at the generation's own aspect ratio
   (from the item payload width/height/aspect — check the shape; fallback 16:9), never
   force-cropped to 1:1. No distortion; letterboxing on a token surface is fine.

2. PLUGIN — one-button action model: remove the permanent 6-icon strip under gen cards.
   Each card gets the web-style single "Use ▾" button (plus the small download/refresh
   shortcuts ONLY if the web card has them) that opens the SAME action menu as the web,
   with every action currently available in the plugin strip preserved in the menu
   (download, add to project, add to Explore, regenerate, copy prompt, delete — plus
   Edit image / Generate video from image / Upscale entries IF those actions already
   exist in the plugin; do NOT invent new capabilities, and do NOT drop existing ones —
   map strip icon → menu item 1:1 and list the mapping in your summary). Menu items
   with credit costs (Upscale ✦4/✦8) keep their exact cost tags — money display
   unchanged.

3. BOTH — menu positioning: the action menu opens anchored ON/OVER the clicked card
   (dropdown from the Use button, flipping up/left near viewport edges so it never
   clips), NOT at a detached fixed position. Fix the web's current detached placement
   (menu appears top-left of the page). One shared approach per file: anchor to the
   button's getBoundingClientRect with edge flipping; close on outside click / Esc /
   scroll. Menu only ever appears on explicit Use click — never on hover or load.

4. BOTH — audio gen card design: replace the empty dark box with an intentional compact
   audio card: token surface + kind chip (VOICE/SFX), a simple static waveform motif
   (inline SVG, theme token stroke — reuse the app's icon style), play/pause control
   wired to the EXISTING audio playback path (find how audio gens play today — reuse),
   duration + title/prompt one-liner (ellipsis). Same Use ▾ action button as other
   cards. Aspect: audio cards use a fixed compact height (not 1:1, not towering).

QA: plugin — My Library with mixed items (16:9, 9:16, 1:1, 4:5, audio): native aspects,
no icon strips, Use menu opens over the card at widths 320/420/600 (edge cards flip
correctly), every old action reachable through the menu, one audio playback works;
3 themes; node --check; install-cep.sh. Web — Use menu anchors to the card on catalog-
sized and narrow (~390px) layouts, opens only on click, closes on Esc/outside; audio
card looks intentional; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (High). Action-model unification + popover anchoring in two
codebases; capability-loss risk.

---

## SC_17 — AI Tools: launcher card opens the generator DIRECTLY (kill the intermediate
## tools screen); Upscale video & Upscale image removed ENTIRELY (UI + code)

**Problem (owner report + screenshots).**
1. Clicking "Generate video" / "Generate image" on the AI Tools launcher does NOT open
   the generator — it opens an intermediate category screen ("VIDEO TOOLS" list with
   "Generate video" and "Upscale video" rows). Owner: clicking the launcher card must
   land DIRECTLY in the generation workspace; the intermediate tools-cards screen must
   not open at all.
2. Upscale video and Upscale image must be removed COMPLETELY — from UX, UI and code —
   they don't work anyway ("baribir ishlamayapti").

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   node --check validation; after edits run
   `bash plugins/after-effects-cep/scripts/install-cep.sh`.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (no landing ffl-, admin/, contributor/ changes).
3. Backend ONLY as narrowly scoped in TASK 3 below (apps/api).

🔴 MONEY-ZONE GUARD (absolute): do NOT modify credit consume/refund logic, the signed
cost-quote/HMAC (lib/gen-quote.ts), computeGenCost/imageUnitCost implementations, webhook
idempotency, or ANY credit price value of any remaining model. Removing upscale means
deleting/disabling its ENTRIES and UI, not editing shared money functions. If a removal
would force an edit inside those functions — STOP and flag it in the summary instead.

TASK 1 — direct tool opening (plugin; verify web too):
The AI Tools launcher category cards (AI_CATS → #aiCatGrid) currently navigate to an
intermediate category screen (#v-aicat, aiOpenCat(), "VIDEO TOOLS" list). Change: card
click opens the generator workspace DIRECTLY — image → imggen view, video → vidgen,
audio → audgen (the same dest values the intermediate list used). Remove the
intermediate screen if nothing else needs it after this change (check all navigations
into #v-aicat / aiOpenCat; the back-buttons inside tool views must return to the
launcher, not the dead screen). On the web, check whether the same intermediate step
exists; if it does, apply the same direct opening.

TASK 2 — remove Upscale from ALL client UI/code (both files):
- Entry points: "Upscale video" / "Upscale image" rows in the (now removed) category
  lists; Upscale items in gen-card action menus (Upscale x2→2K ✦4 / x4→4K ✦8) on web
  and plugin; any ↗ upscale shortcut buttons on video/image cards; any upscale-mode
  states inside the image/video tools (grep: upscale, Upscale, isUp — e.g. the
  'Upscale image' Generate-button text swap, upscale composer modes/source-pickers).
- Delete the client-side upscale request/flow code, CSS, and strings. Guard remaining
  code so nothing references removed functions/DOM (node --check + manual grep for
  every removed identifier).
- HISTORY items of past upscale jobs must still render harmlessly as normal media
  items (no crash on kind/mode "upscale" data) — verify with a mocked history item.

TASK 3 — backend, narrow scope (apps/api):
- In the gen model catalog (lib/gen-models.ts), remove or hard-disable
  (enabled:false + clearly commented) the upscale model entries (video: fal Topaz;
  image: the Vertex upscale entries). Do NOT touch any other entry's fields or any
  shared pricing function bodies.
- POST /gen (and cost-quote) must cleanly reject new upscale job requests for the
  removed entries with a clear 4xx error (this should already fall out of the disabled
  catalog — verify, don't hand-roll new validation if the existing gate covers it).
- Leave webhook/refund handling for any in-flight or historical upscale jobs intact so
  nothing 500s. npm run build -w apps/api must pass.

QA: plugin — launcher card → generator opens in ONE click for image/video/audio; no
intermediate screen reachable; zero "upscale" strings in user-facing UI (grep proof);
gen-card menus have no upscale items; mocked historical upscale item renders; 3 themes ×
320/420/600; node --check; install-cep.sh. Web — same checks; console clean. API —
build passes; cost-quote for a disabled upscale model returns a clean error.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary listing every removed entry point.
```

**Model:** Fable 5 (High). Cross-stack feature removal brushing against the money zone —
maximum care.

---

## SC_18 — Gen workspace restructure: session picker FIRST, no session chip-strip on
## top, decluttered workspace (Director's structure decision)

**Problem (owner report + workspace screenshots).** The image/video gen workspace is
chaotic: too many confusing labels, and the top chip-strip (+ New · My Library ·
Projects · Session 1 · Session 2 · long prompt-named chips…) is a mess — sessions do not
belong there. Owner asked the Director to decide the structure.

**Director's structure decision (build exactly this, plugin):**
1. Clicking a gen tool (image or video) opens a **SESSION PICKER** first: the user
   chooses "continue an existing session" or "+ New session"; only then the gen
   workspace opens with that session loaded. (This supersedes any earlier "open the
   workspace directly" behaviour — the picker IS the landing step. Exception: user has
   ZERO sessions for that mode → auto-create one and enter the workspace directly, no
   empty picker.)
2. The workspace TOP loses the session chip-strip entirely (+ New / My Library /
   Projects / Session chips all gone — My Library and Projects already have their own
   homes). The workspace header becomes ONE clean row: back button (→ session picker),
   session name (inline-renamable if rename already exists), tiny meta (mode · N
   generations), and the existing essential controls only.
3. Workspace label noise is cut per the established rulebook (compact).

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Main target:
plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
node --check validation; keep ids/handlers bound; after edits run
`bash plugins/after-effects-cep/scripts/install-cep.sh`. Secondary:
packages/assetflow-studio/platform/index.html (web) — see final task. 3 CSS themes via
var(--…) tokens.

CONTEXT: the plugin gen workspace (image/video/audio tools; .axws workspace anatomy)
currently renders a horizontal session chip-strip at the top (+ New · My Library ·
Projects · Session 1 · Session 2 · prompt-named session chips, overflowing) above a
sub-row ("Visuals 12 / Audio 0", "SESSION · 12 GENERATIONS / Updated · Video mode",
zoom 2×/1×, refresh/history/settings icons). Sessions data/logic already exists
(session create/switch/list — find the existing session store and strip renderer; also
GET /api/studio/gen/sessions usage). This is a RESTRUCTURE of navigation and chrome —
generation logic, session data, and money paths must not change.

BUILD:

1. SESSION PICKER (new lightweight view per gen mode, shown when a gen tool is opened):
   - List that mode's sessions, most recent first: each row/card = thumbnail (latest
     item), session name, "N generations", updated-ago. Tap → open workspace with that
     session (reuse the existing session-switch code path).
   - Primary button "+ New session" → creates a session (existing create path) and
     enters the workspace.
   - ZERO sessions for that mode → skip the picker: auto-create and enter directly.
   - Compact, token-styled, works at 320-900px; no new API endpoints.

2. WORKSPACE CHROME:
   - DELETE the session chip-strip from the workspace top (markup+CSS+render JS). The
     strip's other entries (My Library, Projects, + New) must NOT reappear here —
     those have their own homes elsewhere.
   - New single header row: back (→ session picker for that mode), session name
     (inline rename ONLY if a rename capability already exists — do not build one),
     tiny "mode · N generations" meta, and the already-existing essential controls
     (Visuals/Audio filter if that tool has audio results, refresh, settings). Zoom
     2×/1× becomes one compact icon toggle.
   - Session switching happens ONLY via back → picker (single mental model).

3. WORKSPACE DECLUTTER (rulebook: delete restating explainers; compact always-visible
   meta; never touch pricing/credit displays):
   - "RECENT" mono label → align with the app's standard section-heading style.
   - "Select / ALL →" → compact.
   - Bottom "BALANCE ✦ 380 · + Top up" row → DELETE (the persistent top-bar credit
     chip already shows balance; Generate button keeps its cost tag — cost display
     unchanged).
   - "Fast: Add a start frame, optionally pick an end frame, then write a prompt…"
     explainer sentence → delete; put a short hint as the frames' placeholder/title
     instead.
   - "≈ 1-2 min · credits refunded on error" → keep the reassurance but as a single
     small quiet line under Generate (it carries real information — do not delete).
   Do NOT change composer functionality (model/out/enhance/clear/generate, @ mentions,
   frames) — visual/structural only.

4. WEB (packages/assetflow-studio/platform/index.html): check whether the web gen
   workspace has the same overflowing session chip-strip pattern; if yes, apply the
   same top-row cleanup (web may keep its own session navigation layout if it is
   structurally different — do NOT force the plugin picker onto the web in this task;
   report what you found instead).

QA: plugin — flows: tool open → picker → continue session / new session / zero-session
auto-skip; back returns to picker; generate one mocked/queued item still renders into
the session (cep-mode emulation ok); chip-strip gone; balance row gone; 3 themes ×
widths 320/420/600/900 × heights 500/620/820; node --check; install-cep.sh. Web —
findings reported or same cleanup applied; console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Fable 5 (High). Navigation restructure inside the most complex plugin
surface.

---

## SC_19 — Composer (prompt chat) compact redesign; reference hint → icon + limit
## notification; plugin must show ALL models; model PIN works, pinned model FIRST

**Problem (owner report + screenshots).**
1. The composer ("prompt chat") — THE most important element — looks off and messy; it
   must be restructured into a compact, design-fitting form.
2. The helper micro-texts must go: "0 / 10 reference Optional — add images to edit or
   combine · type @ to mention." — replace with a beautiful compact ICON affordance;
   and when the user hits the reference LIMIT, show a beautiful icon-led notification
   inside the composer (instead of permanently printing the rule).
3. The plugin does not show ALL AI models (model sheet lists only a few — e.g. video
   shows only Veo variants); web and plugin must show the same full enabled catalog.
4. Model PIN (the 📍 icon in the model sheet) must work correctly in BOTH apps: pinned
   model appears FIRST in the model list, and when opening the model/settings picker
   the pinned model is the first thing shown.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   node --check validation; keep ids/handlers bound; after edits run
   `bash plugins/after-effects-cep/scripts/install-cep.sh`.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (no landing ffl-, admin/, contributor/ changes).
3 CSS themes via var(--…) tokens. 🔴 Money guard: composer pricing displays (Enhance
✦1, Generate cost tag, model ✦ prices) keep exact values; no changes to cost logic.

TASK 1 — composer compact restructure (both apps, same system):
The composer currently stacks: [+] button on its own row · a mono helper line
("0 / 10 reference Optional — add images to edit or combine · type @ to mention.") ·
textarea · a chips row (mode / MODEL / OUT / Enhance / Clear / Generate) · a BALANCE
row. Restructure into a tight, modern block:
- Row 1: textarea (placeholder carries the "what should we create" hint — keep it
  short), with the [+] add-reference button docked INSIDE the composer's left edge and
  the collapse/expand control where it already is.
- Row 2: the control chips (mode · model · output · Enhance ✦1 · Clear · Generate with
  cost tag) — one row, wrapping gracefully at narrow widths; Generate never wraps out
  of reach (reuse the app's existing no-wrap Generate rule if present).
- DELETE the standalone helper line and the composer BALANCE row if a persistent
  header credit chip exists in that app (check; if the plugin workspace has no visible
  balance after removal, keep a minimal ✦ balance INSIDE row 2's right edge).
  Spacing tight (rulebook compact), same recipe both apps.

TASK 2 — reference hint → icon + limit notification (both apps):
- Replace the permanent "0 / 10 reference …" text with a compact icon+counter chip on
  the [+] button (e.g. small "3/10" badge appearing only when ≥1 reference added; title
  tooltip carries the full explanation "Add images to edit or combine · type @ to
  mention").
- When the user hits the reference limit (10th added, or tries to add beyond), show a
  transient, icon-led notice INSIDE the composer (token-styled toast/inline pill, e.g.
  ⚠ "Reference limit reached — 10/10", auto-dismiss ~3s). Reuse an existing toast/pill
  mechanism if the file has one. The @ mention behaviour itself is untouched.

TASK 3 — plugin shows ALL models:
Investigate why the plugin model sheet lists fewer models than the web for the same
mode (compare both clients' fetch of GET /api/studio/gen/models — query params, mode/
kind filtering, enabled filtering, any hardcoded whitelist/slice/limit in the plugin
model-sheet renderer). Fix so the plugin lists EXACTLY the same enabled model set as
the web (same source of truth), including each model's ✦ price and provider label.
Client-side fix only — do NOT touch the API or the model catalog. If the difference
turns out to be server-driven (different responses for the same user), STOP that part
and report the finding instead of changing the API.

TASK 4 — model pin works; pinned model FIRST (both apps):
- Find the existing pin control (📍 in the model sheet) and its persistence (localStorage/
  prefs/server?). Make it actually work end-to-end: toggling pin persists; the pinned
  model sorts to POSITION 1 in the model list; when the model picker/settings opens,
  the pinned model is the first visible item (scroll position at top). Pinned state
  survives reload (and in the plugin, panel restart).
- If pin persistence exists but is broken, fix it where it lives; if it does not exist
  at all, implement it client-side per app (localStorage key per mode) — same behaviour
  both apps. The pinned model does NOT change the default/selected model logic — it
  only affects ordering (unless a "pinned = preselected" behaviour already exists;
  preserve existing semantics and report which it is).

QA: both apps — composer renders compact at plugin widths 320/420/600 and web
~390px/desktop, 3 themes; helper line gone, icon+counter appears with 1+ refs, limit
notice fires at 10; plugin model sheet lists the full enabled set (compare counts with
web side-by-side, list them in the summary); pin toggle persists and pinned model is
first in both apps; Generate/Enhance cost tags unchanged; node --check; install-cep.sh;
web console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary (include the model-count comparison and what pin persistence
you found).
```

**Model:** Fable 5 (High). Composer is the core surface + a data-visibility bug +
cross-app pin behaviour.

---

## SC_20 — Composer chips: truncated model/output values ("MODEL Na…", "OUT 1:…") —
## broken UX, must be readable and compact

**Problem (owner report + screenshot).** In the composer's control row the chip values
are uselessly truncated: "MODEL Na…" (model name unreadable), "OUT 1:…" (output ratio
unreadable). The user cannot see which model or output is selected. Untidy, broken UX —
fix and make compact. (Both apps — check web and plugin.)

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Two targets:
1. plugins/after-effects-cep/AssetFlow_Plugin.html — ~1MB CEP panel, 7 inline scripts;
   node --check validation; after edits run
   `bash plugins/after-effects-cep/scripts/install-cep.sh`.
2. packages/assetflow-studio/platform/index.html — DIRECT CF Pages source for the web
   app (no landing ffl-, admin/, contributor/ changes).
3 CSS themes via var(--…) tokens. Money guard: Enhance ✦1 / Generate cost tags keep
exact values and stay visible.

CONTEXT: the composer control row renders selector chips: mode (Image/Video), MODEL
(selected model name), OUT (aspect/resolution summary), Enhance ✦1, Clear, Generate.
The MODEL and OUT chips truncate their values to a few characters ("Na…", "1:…") even
when row space is available. Find the chip renderer + CSS (max-width/ellipsis rules)
in both files.

FIX — readable AND compact chips:
1. Chips size to their CONTENT up to a sane cap: the selected model shows its display
   name in full for typical names ("Nano Banana 2", "Veo 3.1 Lite"); OUT shows the
   actual value ("1:1", "16:9 · 720p") — these are short strings; the current
   truncation is a CSS bug (fixed tiny max-width), not a space necessity. Remove the
   premature ellipsis; keep a generous cap (~160-180px) with ellipsis only beyond it.
2. Drop the redundant "MODEL"/"OUT" prefix micro-labels if the value is self-evident
   with its icon (model chip gets a small model/grid icon, OUT keeps its ratio value —
   follow the established microcopy rulebook: no noise, but never hide the VALUE).
   Every chip gets a title tooltip with the full value.
3. Priority under tight width (composer must fit 320px plugin panels): Generate (with
   cost) and Enhance NEVER shrink; mode chip may become icon-only; MODEL chip truncates
   gracefully (start of name always visible, ≥8 chars); OUT never truncates (it is
   tiny); Clear may become icon-only. Row wraps to 2 lines as a last resort with
   Generate last-right — never clipped or hidden.
4. Same recipe in both apps; verify against the parallel composer-restructure work if
   its markup is already in place (this task is about the CHIP content/width behaviour
   regardless of surrounding layout).

QA: both apps — with a long model name selected and a 9:16 · 1080p output: chips
readable at web desktop/~390px and plugin 600/420/320 widths; tooltips show full
values; Generate+cost always fully visible; 3 themes; node --check; install-cep.sh;
web console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
(b) write a short summary.
```

**Model:** Sonnet 5. Contained chip layout/CSS fix with clear acceptance rules.

---

# DIRECTOR-FOUND PROBLEMS (added during the final review — owner did not report these)

## SC_21 — Background generation + completion notification (approved-IA gap)

**Problem (Director finding).** The approved plugin structure (owner survey 2026-07-16)
requires: "generation runs in the BACKGROUND — the user roams freely and gets a message
when it finishes." No SC covers this. Today the user effectively babysits the workspace;
leaving mid-generation gives no signal when the result is ready (or failed/refunded).

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (primary; node --check; install-cep.sh
after edits) and packages/assetflow-studio/platform/index.html (web — verify/align).
3 themes via var(--…) tokens. Money guard: no changes to job/credit logic — this is
presentation over the EXISTING job polling.

CONTEXT: gen jobs are created via POST /api/studio/gen and polled (find the existing
poller — gen progress cards already render in-session). The user must be able to
navigate to ANY section during a generation and be notified on completion.

BUILD (plugin; mirror on web if missing there):
1. Ensure the existing job poller keeps running while the user navigates away from the
   workspace (it must not be torn down with the view; if it is, lift it to a global
   scope — smallest possible change).
2. Global progress affordance: while ≥1 job is running, show a small animated dot/badge
   on the top-bar "AI Tools" segment (count if >1). Token-styled, subtle.
3. Completion: icon-led toast (reuse the app's toast mechanism if present): success →
   thumbnail + "Generation ready" + View action (navigates to that session/item);
   failure → quiet toast "Generation failed — credits refunded" (wording matches the
   EXISTING refund semantics; do not promise refunds in cases the backend doesn't
   refund — check how failures are surfaced today and reuse those strings/paths).
4. If the user is already looking at the session when it finishes, no toast — the card
   updating in place is enough (avoid double-signal).
5. No OS-level notifications; in-panel/in-page only. No new endpoints.

QA: start a generation (or mock the poller states), navigate Home/Catalog/Library —
badge visible; completion fires toast with working View; failure path shows refund
toast; already-in-session case shows no toast; 3 themes; plugin 320/420/600;
node --check; install-cep.sh; web console clean.

When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT
push. (b) write a short summary.
```

**Model:** Fable 5 (Medium). Poller lifecycle — subtle regression risk.

---

## SC_22 — Session auto-naming: raw prompt text as session name is ugly

**Problem (Director finding, visible in owner's screenshots).** Sessions are named with
the full raw prompt ("A neon product shot on wet asphalt", "the woman ar…") — long,
untidy, unreadable in lists. With the session picker becoming the entry point, names
matter.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (node --check; install-cep.sh) and
packages/assetflow-studio/platform/index.html (web). Client-side unless the sessions
API already has a name field — investigate GET/POST /api/studio/gen/sessions first
(apps/api/src/routes/studio-gen.ts) — do NOT add new API fields if none exist; derive
display names client-side in that case.

RULE (same both apps):
1. Display name for a session = its explicit name if the user set one; otherwise a
   derived title: first ~4 meaningful words of the first prompt (strip @mentions and
   punctuation, Title Case, ellipsis beyond ~28 chars); if no prompt yet → "New session
   · <Mon D>".
2. Apply everywhere sessions are listed (session picker, any session lists on web,
   chips if any remain). Full prompt stays available as tooltip/subtitle where space
   allows.
3. If a rename capability exists, it wins and is preserved; do not build rename if
   absent.

QA: sessions with long prompts, @mentions, empty sessions — names clean in picker and
web lists; 3 themes; node --check; install-cep.sh; web console clean.

When finished: (a) commit + short summary (no Co-Authored-By, no push).
```

**Model:** Sonnet 5. Small display-logic change.

---

## SC_23 — Loading, empty and error states: black screens and dead waits

**Problem (Director finding; flagged in the 2026-07-16 live audit).** Several surfaces
load as a plain black screen (Library load = black; feeds pop in with no skeleton), and
error states are inconsistent or absent (failed loads leave blank areas with no retry).

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (node --check; install-cep.sh) and
packages/assetflow-studio/platform/index.html (web). 3 themes via var(--…) tokens.
Presentation only — no data-flow changes.

GOAL: every async surface gets three consistent states, reusing ONE shared recipe per
app (some surfaces already have skeletons — find the best existing skeleton/empty/error
pattern in each file and standardize on it):
1. LOADING: token-styled skeleton cards matching the surface's card size (never a black
   void; skeleton count ≈ one visible row/screen).
2. EMPTY: compact icon + one short line (+ one action button where an obvious action
   exists, e.g. empty library → "Generate something" → AI Tools). No paragraphs.
3. ERROR: compact icon + one line + Retry button wired to the surface's existing
   loader. Offline in the plugin must never render a blank section.
Apply to: My Library / library grids, catalog grid + detail, session picker/lists,
sessions feed, home shelf and recent strip if theirs are missing, web equivalents.
INVENTORY first, then apply; list surface → state coverage in the summary.

QA: throttle/mock each state per surface (loading/empty/error/offline), 3 themes,
plugin 320/420/600; node --check; install-cep.sh; web console clean.

When finished: (a) commit + short summary (no Co-Authored-By, no push).
```

**Model:** Fable 5 (Medium). Wide but mechanical sweep; consistency is the point.

---

## SC_24 — Catalog grid density: wrong column counts at narrow widths

**Problem (Director finding; 2026-07-16 live audit: 3 columns at 340px).** The plugin
catalog grid squeezes too many columns into narrow panels (cards become unreadable
thumbnails), and at wide sizes the density/card size jumps inconsistently vs the rest
of the app.

### Prompt for Claude Code

```
You are working in the FrameFlow monorepo (~/Projects/creative-tools-saas). Targets:
plugins/after-effects-cep/AssetFlow_Plugin.html (node --check; install-cep.sh) and
packages/assetflow-studio/platform/index.html (web — verify only, fix if same defect).

CONTEXT: the plugin catalog grid (template cards; find the grid CSS + any JS column
math) renders ~3 columns at ~340px panel width — cards are far too small. A consistent
min card width rule is needed, aligned with the large-card direction used elsewhere.

FIX: grid-template-columns: repeat(auto-fill, minmax(<min>, 1fr)) with min ≈ 220-240px
→ 320px panel = 1 column, ~500px = 2, ~740px = 3, wide = 4+. Remove/align any JS that
forces column counts. Media stays 16:9; virtualization (if present) must keep working
with the new row heights — verify with 100+ items. Web: check its catalog for the same
defect at ~390px; fix with the same rule if present.

QA: plugin catalog at 320/340/420/600/900 — column counts as above, no sub-200px cards;
scroll performance fine with a large list; 3 themes; node --check; install-cep.sh; web
verified; console clean.

When finished: (a) commit + short summary (no Co-Authored-By, no push).
```

**Model:** Sonnet 5. Focused grid CSS fix.

---

# MASTER EXECUTION ORDER (Director's final ordering, 2026-07-17)

Run one prompt per fresh Claude Code session (`/clear` between). Order groups by
dependency and file proximity; within a group, order is binding.

**Group A — Backend + CMS chain (API/admin first):**
1. SC_01 (PluginContentConfig backend) → 2. SC_02 (CDN allowlist — after it: push, API
deploy, `wrangler deploy` in workers/cdn-proxy) → 3. SC_03 (admin Plugin CMS editor).

**Group B — Global chrome (both apps; before surface work so later tasks build on the
stable top bar):**
4. SC_12 (3-tab centered persistent seg) → 5. SC_15 (History→My Library; Sessions/
Projects to top bar) → 6. SC_11 (credit chip → top-up) → 7. SC_13 (bottom bar removal).

**Group C — Plugin Home:**
8. SC_07 (Home redesign: recent strip, large cards, full height) → 9. SC_04 (plugin CMS
wiring — AFTER SC_07, binds to the new markup) → 10. SC_05 (launcher cards: live model
names, no LIVE).

**Group D — Catalog:**
11. SC_14 (cards + large detail) → 12. SC_24 (grid density).

**Group E — AI / gen surfaces (heaviest chain):**
13. SC_17 (direct open + upscale removal — upscale dies BEFORE menus are rebuilt) →
14. SC_18 (session picker + workspace restructure; its picker supersedes SC_17's
"direct" landing — SC_18 text already says so) → 15. SC_22 (session auto-names — picker
depends on readable names) → 16. SC_19 (composer restructure + ref icon + all models +
pin) → 17. SC_20 (chip truncation — after SC_19's composer layout) → 18. SC_16 (My
Library cards: native aspect, Use-menu, audio card — after SC_17 so no upscale items
resurface; its "include Upscale IF exists" clause is then naturally false) →
19. SC_21 (background gen + notifications).

**Group F — Polish sweeps (LAST, so they don't get overwritten by structural work):**
20. SC_10 (global compact pass) → 21. SC_08 (plugin microcopy purge) → 22. SC_09 (web
microcopy purge) → 23. SC_23 (loading/empty/error states — final consistency net).

**Skipped:** SC_06 (superseded by SC_07).

**Reconciliation notes (Director decisions where SCs touch each other):**
- SC_15 vs SC_18: top-bar "Sessions" = global sessions overview; the in-tool session
  PICKER (SC_18) is the per-tool entry step. Both exist; workspace-internal switching
  goes back→picker only.
- SC_16 vs SC_17: order 17-before-16 makes SC_16's conditional upscale menu items a
  no-op. If run out of order, re-run SC_17's grep QA.
- SC_08/SC_09/SC_10 sweeps run last by design; their "EXCLUDE regions owned by parallel
  tasks" clauses stop applying once those tasks have landed — the sweep then covers the
  final markup.
- Plugin installs: Groups C–F each end with install-cep.sh; a single AE ⌘Q restart per
  group is enough for live checks.

**Owner deploy checkpoints:** after Group A (API + worker + Pages) · after Group B/C
(Pages + plugin restart) · final E2E: admin edits hero text + uploads video → appears in
all plugins within ~5 min without reinstall; one full gen → notification; one template
import.
