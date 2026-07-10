# FrameFlow — Fix Prompts BATCH 2 (21 problems)

> A batch of 21 independent fixes, numbered P1–P21. They are NOT meant to be executed in numeric
> order — follow the **EXECUTION ORDER** below, which groups them by area and shared files so you
> never edit the same file in two conflicting passes and dependencies are respected. Read a
> problem's own "Exact anchors / Root cause" block before touching code — every one was analyzed
> against the real source (file:line given).

## GLOBAL RULES (apply to EVERY problem)

- **Money-zone:** never change credit consume/refund AMOUNTS, the signed cost-quote/HMAC
  (`lib/gen-quote.ts`, `computeGenCost`/`imageUnitCost` in `gen-models.ts`, `consumeAiCredits`/
  `refundAiCredits`/`consumeDownload`/`consumeImport` in `plugin-profile.ts`), or webhook
  idempotency. Where a money/limit problem (P1, P20, P21) changes a TRIGGER, SCHEDULE, COUNTER
  FIELD, or CLIENT REACTION, it must PRESERVE the enforcement math/atomic pattern byte-for-byte and
  diff-prove it.
- **Migrations additive-only** (P21 adds a counter); prove they apply on a dev DB.
- **English UI**; Uzbek code comments per convention.
- **Build pipeline:** `platform/index.html` = CF Pages direct source; admin + shared `js/` =
  Studio source → edit ROOT `js/`/`admin/` then `npm run studio:sync`; never edit build
  artifacts. The site-CMS work already added a content-hash `?v=` cache-bust to admin/shared JS in
  `scripts/prepare-cf-pages.mjs` — ensure any NEW admin js is covered by it.
- **Plugin builds:** after ANY plugin change, `node --check` the HTML/JS and reinstall via
  `bash plugins/after-effects-cep/scripts/install-cep.sh` + AE restart.
- **Minimal, scoped diffs.** Reuse existing helpers/endpoints. Don't regress prior work.
- **Each problem:** commit in logical chunks, clear messages, **no `Co-Authored-By`**; do **NOT**
  push (the user pushes). End with a short summary (root cause + what changed + verification).

## EXECUTION ORDER (do phases top-to-bottom; within a phase, in the order listed)

**PHASE 1 — 🔴 CRITICAL money & auth (backend + plugin auth; do FIRST, one at a time, max care):**
1. **P1** — refund credits on a failed generation (backend `gen-processor.ts`). Isolated.
2. **P21** — download/import limit chain: admin-set limit is authority, import counter → monthly
   (backend `plugin-profile.ts` + additive migration + plugin limit sheet).
3. **P20** — never auto-sign-out on a limit; only 401/`ACCOUNT_BLOCKED` signs out (plugin
   `assetflow-account.js` + `assetflow-catalog.js` + error map). Do right after P21 (same limit/auth
   area).

**PHASE 2 — Backend & admin (separate files from Phase 1):**
4. **P19** — template ingest picks the real preview video, not `Help.mp4` (backend `ingest-zip.ts`).
5. **P2** — admin per-user generation activity (backend `admin.ts` + admin UI).
6. **P3** — admin one-click "Recompute storage" button (admin UI only).

**PHASE 3 — Plugin `AssetFlow_Plugin.html` (ALL edit the same file → do sequentially in this order):**
7. **P16** — fix the clipped Regenerate icon (one-line, safest first).
8. **P10** — remove the "Publish a template" contributor section.
9. **P9** — fix the header "Catalog" toggle.
10. **P7** — fix "Copy prompt".
11. **P8** — Pro upgrade → Lemon Squeezy checkout.
12. **P5 + P6 + P14 TOGETHER** — real aspect-ratio gen cards + Session/Projects layout + HISTORY
    strip (they share the aspect approach — one coordinated pass).
13. **P15** — History/My Library cards get the full action toolbar (depends on P7).
14. **P11** — multi-select + bulk delete for Sessions/Projects.
15. **P4** — silence technical/URL toasts (do late; may touch messages other problems added).

**PHASE 4 — Web `platform/index.html` (all edit the same file → sequential):**
16. **P17** — AI Studio gen cards too big (`.va-axgrid` column-width).
17. **P18** — Regenerate loads the prompt+refs into the composer (don't auto-generate).
18. **P13** — reference / @mention parity vs Artlist (web + plugin).

**PHASE 5 — cross-surface (web + plugin):**
19. **P12** — Image/Video/Audio mode toggle stopped switching (diagnose web &/or plugin, fix both).

> Note on cross-references in the text below: mentions of "the previous batch" / "PARTIYA 5" refer to
> ALREADY-MERGED work (Sessions, Projects, Add-to-project, per-model composer, the toast redesign) —
> those are DONE; keep them working, don't rebuild them. Cross-refs to "P5/P7/P16 etc." mean THIS
> batch's problems by the numbers above.

---

## PROBLEM 1 — 🔴 CRITICAL: credits NOT refunded when a generation fails (money-zone)

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

## PROBLEM 2 — Admin: per-user generation activity (see everything a user generated, incl. failures)

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
`admin/` + `js/` (studio:sync; ensure the cache-bust covers new admin js).

**Constraints.** Read-only (no mutation of user data). Money-zone untouched. Additive. Reuse
`hydrateGenAssets` + existing admin patterns. Minimal diff.

**When finished:** commit (backend endpoint; admin UI — clear messages, no Co-Authored-By); do
NOT push. Summary: the endpoint shape and the admin Generations view.

**Model:** Fable 5 (+Extra) — backend endpoint + admin detail UI (Sonnet 5 acceptable if scoped).

---

## PROBLEM 3 — Admin: one-click "Recompute storage" button (no terminal needed)

**Context.** The P7 storage backfill endpoint (`POST /api/admin/maintenance/gen-sizebytes/
backfill`, and its GET status counterpart) exists but has NO admin UI — an admin would have to
call it via curl. Add a one-click button so the admin can recompute old generations' storage
sizes from the panel. Backend endpoint already exists (admin-guarded). Admin UI only.

**Exact anchors:** the maintenance endpoints are already in `apps/api/src/routes/admin.ts`
(`/admin/maintenance/gen-sizebytes[/backfill]` from PROBLEM 7). Admin UI: `packages/assetflow-
studio/admin/` + `js/` (StudioApi in `js/studio-api.js`).

**Step 1 — StudioApi method.** Add `recomputeStorage()` (POST to the backfill endpoint) and,
optionally, a status GET, to `studio-api.js`.

**Step 2 — Admin button.** In the admin Settings view (or the Subscribers view header), add a
"Recompute storage" button that calls `recomputeStorage()`, shows a loading state, then a toast
with the result (e.g. "N rows updated"). Admin-guarded (endpoint already is). On-brand styling.

**Step 3 — Verify.** Admin (headless): click the button → the endpoint is called, a result toast
shows. Confirm the shared-js cache-bust covers the changed admin js. `npm run build -w apps/api`.

**Constraints.** Money-zone untouched (storage accounting only, no credit change). Additive.
Reuse existing admin UI patterns. Minimal diff.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the button +
what it triggers.

**Model:** Sonnet 5 — small admin button wiring.

---

## PROBLEM 4 — Plugin: don't show technical/URL toasts to users (run silently in the background)

**Context.** The plugin pops technical, developer-facing toasts that expose internal API URLs
and raw jargon — e.g. "Server catalog is empty — has the admin approved anything? API:
https://api.getframeflow.app" and "Failed to fetch". End users must NEVER see internal URLs, raw
errors, or admin-speak. These operations should run in the BACKGROUND (silently, with console-only
logging + retry); any message that IS shown must be short, human-friendly, and contain NO internal
URL / no raw error. Plugin only. (Analyzed — anchors below.)

**Exact anchors (analyzed) — `plugins/after-effects-cep/`:**
- `AssetFlow_Plugin.html:6927` + `:6930` — the "Server catalog is empty — has the admin approved
  anything? API: <url>" toast (exposes the API URL + dev jargon).
- `AssetFlow_Plugin.html:8058` + `:8079` — "Failed to fetch" toasts (raw network error).
- `assetflow-catalog.js:360` — another "API: <url>" message.
- Leave the API BASE config alone (`assetflow-catalog.js:8`, `AssetFlow_Plugin.html:8812`) — that's
  configuration, not a toast.

**Step 1 — Audit.** Find every plugin toast / user-facing message that contains: an internal URL
(`api.getframeflow.app` / any http(s) link), a raw error ("Failed to fetch", stack traces), or
developer/admin jargon ("has the admin approved anything"). List them.

**Step 2 — Empty catalog = silent + clean empty state.** An empty catalog is a NORMAL state (no
templates published yet). Do NOT pop a toast for it — just render the catalog's clean empty state
(e.g. "No templates yet"), with NO API URL and NO admin-speak. Log any diagnostic to console only.

**Step 3 — Network/fetch errors = background retry + friendly message.** For fetch failures, log
the technical detail to `console` only and retry in the background; if the user must be told,
show a SHORT friendly toast like "Couldn't reach the server — retrying…" — never the raw error or
the URL. The connection strip / status indicator can reflect state without a technical toast.

**Step 4 — General rule.** User-facing toasts must be human-friendly: no internal URLs, no raw
error strings, no admin/dev jargon. All technical detail goes to `console.log` (dev only). Keep
the redesigned toast component (PROBLEM 17 of the previous batch) — just clean the CONTENT/triggers.

**Step 5 — Verify.** `node --check`; trigger the empty-catalog path and a fetch failure → confirm
no URL/jargon toast appears (empty state + console log instead), and any shown message is clean.
Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff (message content +
triggers; keep the toast component). Don't suppress genuinely user-actionable messages — just
strip technical/URL content and silence normal-state noise.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: which toasts
were silenced/cleaned and the new user-facing wording.

**Model:** Sonnet 5 — targeted plugin message cleanup, exact anchors given.

---

## PROBLEM 5 — Plugin: gen result cards should use the media's REAL aspect ratio (not forced 1:1)

**Context.** In the plugin, the AI gen RESULT cards (the RECENT/history grid) are all forced to
1:1 (square), but the actual generations have different aspect ratios — a 16:9 video, a 9:16
portrait, etc. Make each gen card show its media's REAL aspect ratio, in a nice, compact layout
(the web already does this per PROBLEM 4 of the previous batch — mirror it in the plugin). Plugin
only. (Analyzed — anchors below.)

**Exact anchors (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- Result card CSS `.rc` (line 2971): `...aspect-ratio:1/1;...` — this FORCES every gen card
  square. Also line ~2153 has an `aspect-ratio:1/1`.
- The result card is built in `resultCard(it, ctx)` (~9207); the RECENT grid renders these.
- The gen item's aspect should come from its `params.aspectRatio` (the web's `mapGen`/`genMediaOf`
  captured this in PROBLEM 4). Check the plugin's `mapGen` — capture the gen's aspect ratio if not
  already present.

**Step 1 — Capture the real aspect.** In the plugin's `mapGen` (or wherever gen items are built),
capture each gen's aspect ratio from `params.aspectRatio` (fallback: derive from the media, else
1:1). Normalize to a CSS-usable ratio (e.g. "16 / 9", "9 / 16", "1 / 1").

**Step 2 — Apply per-card aspect.** In `resultCard`, set the card's `aspect-ratio` INLINE from the
gen's real ratio instead of the hardcoded `.rc { aspect-ratio:1/1 }`. Remove/override the forced
1/1 so video cards render 16:9, portraits 9:16, etc. Media still `object-fit:cover` (or `contain`
if you prefer no crop — pick the tidier look).

**Step 3 — Compact masonry layout.** Because aspects now vary, lay the RECENT grid out compactly —
a masonry (CSS columns) or an aspect-aware 2-column grid — so cards of different heights pack
neatly with no big gaps, at the plugin's narrow width. Keep it clean and compact (match the web's
masonry feel from PROBLEM 4).

**Step 4 — Verify.** `node --check`; render the RECENT grid with mixed gens (16:9 video, 1:1
image, 9:16 portrait) → each card shows its true aspect, the grid packs compactly with no big
gaps, and it looks tidy at the narrow panel width. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff. Keep the card's actions
(Import/Regenerate/Copy prompt/etc. from the previous batch) working; just change the shape/layout.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: how the real
aspect is captured + applied, and the compact layout change.

**Model:** Sonnet 5 — targeted plugin card aspect + layout, exact anchors given.

---

## PROBLEM 6 — Plugin: Session view + Projects cards look broken/ugly (fix the layout)

**Context.** In the plugin, the SESSION view's generation cards are stretched into full-width thin
banners (wrong aspect), and the PROJECTS cards show a broken 2×2 cover grid with empty dark cells
when a project has fewer than 4 items. Both look broken. Make them clean and compact. Plugin only —
this polishes the Sessions+Projects UI shipped in the already-merged PARTIYA 5. (Analyzed — anchors
below; do together with P5 + P14, shared aspect approach.)

**Exact anchors (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html` (the `.axsp` block):**
- Project card cover: `.axsp .sp-card .cv` (line 3127) = `height:84px; display:grid;
  grid-template-columns:repeat(2,1fr); gap:1px` + `.cv i` (3128) — a fixed 2×2 grid, so a project
  with 1 item shows 1 filled cell + 3 empty dark cells (the "broken" look).
- Projects list grid: `.axsp .sp-grid` (3124) = 2 columns.
- Session view generations: rendered stretched full-width (thin banners) — they should use a
  compact, aspect-aware grid like the RECENT grid (see PROBLEM 5), not full-width single-column.

**Step 1 — Fix the Projects card cover.** Make the cover adapt to the item count instead of a rigid
2×2 with empty cells: 1 item → one full cover image; 2 items → 2-up; 3-4 items → a filled 2×2;
never render empty dark placeholder cells. Keep it a tidy fixed-height cover. If a project is
empty, show a subtle neutral cover (not broken grid cells).

**Step 2 — Fix the Session view gen layout.** Render the session's generations in the SAME compact,
aspect-aware grid used for RECENT (PROBLEM 5) — real aspect ratios (16:9 / 1:1 / 9:16), 2-column /
masonry, no full-width stretching/squishing. Reuse `resultCard` + the shared grid so it's
consistent with the RECENT/history view.

**Step 3 — Verify.** `node --check`; open a session with mixed-aspect gens → cards show real
aspect, compact, not stretched; open Projects with a 1-item project → cover is a clean single
image (no empty cells), and a 4-item project → filled 2×2. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff. Reuse the shared card/
grid components; keep Sessions/Projects functionality (open, rename, delete, add-to-project) intact.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the adaptive
project cover + the session gen grid fix.

**Model:** Sonnet 5 — targeted `.axsp` layout fixes (do together with PROBLEM 5).

---

## PROBLEM 7 — Plugin: "Copy prompt" button doesn't work

**Context.** The "Copy prompt" button on gen result cards does nothing / never copies in the plugin.
Root cause is a broken return value + an unreliable clipboard path in the CEP webview. Plugin only.
(Analyzed — exact root cause + anchors below.)

**Root cause (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- `afCopyText(text)` (line 8464): on the `navigator.clipboard.writeText` path it copies async, shows
  its OWN 'Copied' toast, then `return;` — returning **`undefined`**. It returns nothing in the
  fallback path either. So the function's return value is ALWAYS falsy.
- The callers rely on that return value:
  - card button (line 9467): `if(window.afCopyText(it.prompt)){ showToast('Prompt copied') } else {
    showToast('Copy failed') }` → since the return is always undefined, it ALWAYS hits "Copy
    failed" (and double-toasts with afCopyText's own toast).
  - lightbox button (line 9427): same `if(window.afCopyText(it.prompt))...` pattern.
- Also: in the CEP webview (loaded from `file://`, not a secure context), `navigator.clipboard`
  is often unavailable or blocked, so it should rely on the synchronous `execCommand` fallback
  (`afCopyFallback`, line 8474).

**Step 1 — Fix `afCopyText` to be reliable + return a real boolean.** Rework it so it actually
copies in CEP and RETURNS true/false: in the CEP webview prefer the SYNCHRONOUS
`execCommand('copy')` hidden-textarea path (it returns a real result and works in the file://
context); use `navigator.clipboard` only when genuinely available (secure context) and treat it as
best-effort. Make the function show EXACTLY ONE toast (or none) — pick a single source of truth for
the "Copied/Copy failed" toast; don't let both `afCopyText` and the caller toast.

**Step 2 — Fix the callers.** Update the card (9467) and lightbox (9427) handlers so they don't
rely on a broken return and don't double-toast: either call `afCopyText(it.prompt)` and let IT own
the toast, or use the corrected boolean return for a single toast. Keep `e.stopPropagation()`.

**Step 3 — Verify.** `node --check`; in the AE plugin, click "Copy prompt" on an image gen and a
video gen → the prompt is actually on the clipboard (paste to confirm) and exactly ONE clean
"Copied" toast shows; no "Copy failed" on success; no double toast. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff. `afCopyText` is used by
other copy actions too (e.g. the Google device link ~9270) — keep those working; make the fix
general so every copy action reports correctly.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the return-value
+ CEP-clipboard fix and the caller/toast cleanup.

**Model:** Sonnet 5 — targeted clipboard fix, exact root cause given.

---

## PROBLEM 8 — Plugin: "Pro" upgrade doesn't work → open the Lemon Squeezy checkout in the browser

**Context.** In the plugin, clicking "Pro" shows "Payments aren't available yet — contact an admin"
instead of opening the payment page. Root cause: the plugin's Pro checkout still calls the OLD
STRIPE endpoint (which is not configured — the app uses Lemon Squeezy now), so it errors with
`STRIPE_NOT_CONFIGURED`. Fix: route the Pro button through the SAME Lemon Squeezy checkout the
credit top-up already uses, opening the browser. Plugin only (backend already supports it).
(Analyzed — exact root cause + anchors below.)

**Root cause (analyzed):**
- Plugin `AssetFlow_Plugin.html`: `startProCheckout` (~lines 8680-8708) calls the old Stripe path
  and, on `STRIPE_NOT_CONFIGURED` (~8700-8701), shows "Payments aren't available yet — contact an
  admin". The `onPro` handlers (~5216/5228) call it.
- The WORKING pattern is right below: `startCreditTopup` (~8713-8729) does
  `studioPost('/api/billing/checkout', {credits})` → gets `d.url` (Lemon Squeezy hosted checkout)
  → `AssetFlowAccount.openExternal(d.url)` → "Complete payment in your browser, then Refresh".
- Backend `apps/api/src/routes/billing.ts` `POST /checkout` (line 31) ALREADY accepts
  `{ plan: "pro" | "studio" }` (subscription via `findSubscriptionVariant`, ~61-85) in addition to
  `{ credits }` — so a Pro checkout URL is available; the plugin just isn't calling it.

**Step 1 — Rewrite `startProCheckout` to use Lemon Squeezy.** Mirror `startCreditTopup`: call
`studioPost('/api/billing/checkout', { plan: 'pro' })`, take `d.url`, and open it with
`AssetFlowAccount.openExternal(d.url)` (the same reliable open path). Show "Complete payment in
your browser, then click Refresh". Remove the old Stripe call and the `STRIPE_NOT_CONFIGURED`
branch; handle `BILLING_NOT_CONFIGURED`/`VARIANT_NOT_FOUND` with a clean message (no internal URL,
per PROBLEM 4). Require sign-in first (as `startCreditTopup` does).

**Step 2 — Studio plan (if exposed).** If the plugin also offers a "Studio" plan button, wire it
the same way with `{ plan: 'studio' }`.

**Step 3 — Verify.** `node --check`; in the AE plugin, click "Pro" while signed in → the browser
opens the Lemon Squeezy Pro checkout (correct product/price, $19/mo); after paying, "Refresh"
updates the plan. No "Payments aren't available" on the happy path. Reinstall via `install-cep.sh`.

**Constraints.** MONEY-ZONE: do NOT touch the webhook / plan-granting / credit logic — only fix the
client to call the correct checkout ENDPOINT and open the URL. Plugin only, no CDN. Minimal diff.
Keep `startCreditTopup` working.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the Stripe→
Lemon Squeezy checkout switch for the Pro button and confirmation the browser opens the checkout.

**Model:** Sonnet 5 — targeted plugin checkout-endpoint fix, exact root cause given.

---

## PROBLEM 9 — Plugin: the top "Catalog" toggle doesn't work (can't switch back from AI Tools)

**Context.** In the plugin header, the "Catalog | AI Tools" segmented toggle can switch TO AI Tools
but clicking "Catalog" does nothing — you can't get back to the catalog. Root cause: the Catalog
segment has NO click handler. Plugin only. (Analyzed — exact root cause + anchors below.)

**Root cause (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- The header toggle (`#afPillarSeg`, ~line 3798-3801):
  - "AI Tools" = `<button ... onclick="afNavTab('ai')">AI Tools</button>` (line 3800) — works.
  - "Catalog" = `<span class="ff-seg__item is-on" id="afSegKatalog" ...>Catalog</span>` (line 3799)
    — a `<span>` with **NO onclick** → clicking it does nothing.
- `afNavTab(tab)` (line 5631) does `document.querySelector('.env-side-link[data-nav="'+tab+'"]')
  .click()`. The catalog nav links are `[data-nav="video|motion|graphics|luts"]` (via
  `switchNavFromSidebar`); there is NO `[data-nav="catalog"]`, so even `afNavTab('catalog')` would
  find nothing. AI Tools is a separate page (`aiPage`) shown by the AI path.

**Step 1 — Give the Catalog toggle a working handler.** Add an onclick to the Catalog segment
(`#afSegKatalog`, line 3799) that returns to the catalog view. Make `afNavTab` handle `'catalog'`
(or add a small `goCatalog()`): HIDE the AI page (`aiPage`) and SHOW the catalog by clicking the
currently-active (or default `[data-nav="video"]` Templates) catalog nav link so the catalog
renders. Symmetric with how `afNavTab('ai')` shows the AI page.

**Step 2 — Fix the toggle active state.** Update the segment's `is-on` / `aria-selected` on both
`#afSegKatalog` and `#afSegAi` when switching, so the active pill reflects the current view in both
directions. (Consider making Catalog a `<button>` too for consistency/accessibility.)

**Step 3 — Verify.** `node --check`; in the AE plugin, from AI Tools click "Catalog" → the catalog
view shows (AI page hidden), the "Catalog" pill is active; click "AI Tools" → back to AI, its pill
active. Both directions work repeatedly. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff. Don't break the existing
catalog nav (`switchNavFromSidebar`) or the AI page.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the missing
Catalog handler + the `afNavTab('catalog')` path and the toggle-state fix.

**Model:** Sonnet 5 — targeted plugin nav toggle fix, exact root cause given.

---

## PROBLEM 10 — Plugin: remove the "Publish a template" (CONTRIBUTOR) section from the Account sheet

**Context.** The plugin's Account sheet has a CONTRIBUTOR section with a "Publish a template"
button. Publishing is a web/studio contributor flow — the plugin doesn't need it. Remove it.
Plugin only. (Analyzed — anchors below.)

**Exact anchors (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- The Account-sheet CONTRIBUTOR block + "Publish a template" button: ~lines 4804-4809 (the
  `CONTRIBUTOR` label + the button with `onclick="openPublish…"` / "Publish a template"). There's
  also a publish page/handler (`openPublish`, ~4948, and a section ~8167).

**Step 1 — Remove the section.** Delete the CONTRIBUTOR block + the "Publish a template" button
from the Account sheet (~4804-4809) so it no longer renders. Make sure removing it leaves no gap /
dangling label in the Account sheet layout.

**Step 2 — Clean up dead code.** If `openPublish` and the publish page/sheet (~4948 / 8167) are
ONLY reachable from that button and nothing else uses them, remove them too (or leave them dormant
if that's cleaner/lower-risk — but no dangling references / JS errors). Do NOT remove anything the
web/studio contributor flow relies on — this is plugin-only.

**Step 3 — Verify.** `node --check`; open the Account sheet → no CONTRIBUTOR / "Publish a template"
section, layout intact, no console errors. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: what was
removed and any dead code cleaned up.

**Model:** Sonnet 5 — small plugin removal, exact anchors given.

---

## PROBLEM 11 — Plugin: multi-select + bulk delete for Sessions and Projects (delete contents too)

**Context.** In the plugin, add a "Select" mode to pick multiple Sessions or Projects and delete
them in bulk. Deleting a session/project must remove everything inside it, in BOTH the plugin (UI
refresh) and the backend (data). The backend delete endpoints already exist; the plugin needs the
multi-select + bulk-delete UI. Plugin only (reuses backend). (Analyzed — anchors below.)

**Exact anchors (analyzed):**
- Backend (already exists, reuse): `DELETE /api/studio/gen/sessions/:id` (`studio-gen.ts:460`) —
  owner-scoped, and deleting a session CASCADE-deletes its generations (`Generation.session
  onDelete: Cascade`) + cleans assets. `DELETE /api/studio/projects/:id` (from PARTIYA 5) deletes
  the project + its `ProjectItem` links.
- Plugin `AssetFlow_Plugin.html` (`.axsp` Sessions/Projects lists): single-delete exists via
  `.sp-act` buttons (~lines 3121-3123, 4433). There is NO multi-select for sessions/projects yet.
  (The catalog/gen grid already has a "Select" pattern — reuse its idiom.)

**Step 1 — Select mode + bulk bar (plugin).** Add a "Select" toggle on the Sessions list and the
Projects list that turns rows/cards into selectable (checkbox) items. Track selected ids; show a
bulk action bar ("N selected · Delete · Cancel") when ≥1 is selected. Keep normal open-on-click
when NOT in select mode.

**Step 2 — Bulk delete (with confirmation).** "Delete" opens a confirm dialog warning about the
data loss, then calls the existing endpoints for each selected item:
- Session → `DELETE /gen/sessions/:id` (cascades its generations — they're gone from the plugin
  and the backend).
- Project → `DELETE /projects/:id` (deletes the project + its item associations).
- ⚠️ SEMANTICS to state clearly in the confirm text: deleting a SESSION deletes its generations
  permanently; deleting a PROJECT removes the project and its groupings — the underlying gens that
  also live in "My Library"/other projects are NOT destroyed by a project delete (only the
  project). Keep this behavior (don't destroy shared gens on project delete). Data-loss action →
  confirmation mandatory.

**Step 3 — Refresh after delete (plugin + backend consistency).** After deleting, refresh the
Sessions/Projects lists AND My Library (reuse the existing sync/afRefreshAll helper from prior work)
so the plugin reflects the backend immediately. Handle the current-session case (if the open
session was deleted, go back to the list).

**Step 4 — Verify.** `node --check`; in the plugin: enter Select on Sessions, pick 2, Delete →
confirm → they + their gens disappear (list + My Library update), backend rows gone. Same for
Projects (project + associations gone; the underlying gens still in My Library). Owner-scoping via
the endpoints (404 for others). Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched (deleting gens does NOT refund credits — already consumed;
consistent with the web). Plugin only, no CDN. Reuse existing backend endpoints + the catalog
select idiom. Minimal diff.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the select +
bulk-delete UI, the exact delete semantics (session cascade vs project associations), and the
refresh.

**Model:** Sonnet 5 — plugin multi-select UI over existing backend deletes.

---

## PROBLEM 12 — Mode toggle (Image / Video / Audio) stopped switching — diagnose + fix

**Context.** The AI composer's mode toggle (Image / Video / Audio) no longer switches when clicked
— clicking a mode does nothing. Diagnose which surface (web AI Studio and/or plugin) is affected
and fix it. Likely a regression from recent BATCH work. (Analyzed — candidate anchors below; Code
must confirm the exact broken one.)

**Candidate anchors (analyzed):**
- Web `packages/assetflow-studio/platform/index.html`: the composer mode pill uses `onPickTool` /
  `aiToolsView` (~line 16477) with `data-tool` items; check that the pill's click handler still
  switches mode and reconfigures the composer.
- Plugin `AssetFlow_Plugin.html`: `setMode(...)` (~lines 10312/10320/10329/10379/10396) drives the
  image/video/audio mode; check the segmented toggle's buttons still call it and that `setMode`
  still updates the active mode + reconfigures model/settings.
- (Note: `onMode` at ~16543/16546 is the model-modal search/filter, NOT the mode toggle — don't
  confuse them.)

**Step 1 — Reproduce + pin the surface.** In a headless browser (web) and by reading the plugin
markup/handlers, click each mode (Image/Video/Audio) and confirm whether the mode actually changes
(model list, settings, cost, reference controls update). Identify the exact broken surface(s) and
the root cause (handler not wired / renamed id / state not updating / a regression from
Sessions/Projects or the workspace-entry rework).

**Step 2 — Fix.** Restore the mode toggle so each option switches the active mode and reconfigures
the composer (model + settings + references + cost), on the affected surface(s). Keep it
catalog-driven (per the previous batch's per-model work).

**Step 3 — Verify.** Web (headless): click Image → Video → Audio → each reconfigures the composer
correctly; run a cheap generation in one mode to confirm end-to-end. Plugin: `node --check` +
confirm the toggle switches modes; reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched (cost-quote/consume unchanged). Minimal diff. Don't regress
the per-model composer (previous batch PROBLEM 8) or the workspace entry.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: which surface
was broken, the root cause, and the fix.

**Model:** Sonnet 5 — targeted mode-toggle regression fix (Fable 5 if it spans both surfaces).

---

## PROBLEM 13 — Reference / @mention system: close the gaps vs Artlist (web + plugin)

**Context.** FrameFlow's reference-adding is weaker than Artlist's. Artlist's @mentions are
first-class atomic chips bound to the asset (typo-proof, cascade-deleted when the reference is
removed); FrameFlow uses a PLAIN textarea where `@img1` is just editable TEXT that can dangle. Close
the high-value gaps on both surfaces. (Analyzed vs an Artlist inspection — anchors + gaps below.)

**Current state (analyzed):**
- Prompt is a plain `<textarea>`: web `platform/index.html:16474` (`aiPrompt`/`setPrompt`), plugin
  `AssetFlow_Plugin.html:4066` (`#igPrompt`) / `:4206` (`#vgPrompt`).
- FrameFlow already has: reference CHIPS (web `refChip` ~16465/18760-18784), an @mention dropdown
  ("Type @", plugin `igMention`/`vgMention` ~4064/4205), per-model `refKind`/`maxRefs` gating +
  media-refs limits (from the previous batch's PROBLEM 8), and media-ref counters in the plugin.
- Gaps vs Artlist: (a) mentions are plain TEXT, not atomic chips → dangling/typo-prone; (b) removing
  a reference does NOT strip its `@mentions` from the prompt (they dangle); (c) @-autocomplete
  parity between web and plugin is uneven; (d) no "why is this disabled" messaging for
  mutually-exclusive refs (video-ref vs start/end frame); (e) no per-model reference "Features"
  hints in the model picker.

**Step 1 — Cascade-delete + orphan handling (both surfaces, HIGH VALUE).** When a reference chip is
REMOVED, automatically strip every matching `@imgN`/`@vidN`/`@audioN` token from the prompt text so
no mention dangles. Before generate, validate that each `@mention` in the prompt maps to an existing
reference; strip/flag orphans (a mention to a removed ref) so the provider never gets a broken
reference. Renumber consistently if a middle reference is removed (or keep stable ids — pick one and
be consistent so mentions stay correct).

**Step 2 — @-autocomplete parity (web ↔ plugin).** Ensure typing `@` in the prompt opens the
reference autocomplete on BOTH surfaces (the plugin has "Type @"; bring the same to the web if
missing), inserting the correct `@imgN`/`@vidN`/`@audioN` token. Keep it a textarea-based
implementation (no need for a full rich editor) — just a reliable insert + the cascade-delete above.

**Step 3 — Live counters + mutual-exclusivity messaging.** Show live reference counters (e.g.
"Images 2/9 · Videos 0/3") where refs are added, on both surfaces (the plugin has this — mirror to
the web). When a reference type is disabled because another is active (e.g. adding a Video Reference
disables Start/End Frame), show a short reason ("Remove the video reference to use Start/End Frame")
instead of a silent disabled state — matching the per-model `refKind` rules from the previous batch.

**Step 4 (OPTIONAL / bigger) — atomic mention chips.** If feasible without a large rewrite, upgrade
the prompt so inserted `@mentions` render as atomic, non-editable chips bound to the reference id
(Artlist-style) instead of plain text. This is a STRETCH — do Steps 1-3 first (they deliver most of
the value); only attempt this if it doesn't destabilize the composer. Flag if it's too large and
leave it out.

**Verify.** Web (headless) + plugin (`node --check`): add refs, @mention them, remove a referenced
chip → its mentions vanish from the prompt (no dangling); `@` autocomplete works on both; counters
update; the video-ref/start-end exclusivity shows a reason; generate sends only valid references.
Confirm per-model gating (PROBLEM 8) still holds. Money-zone untouched (cost-quote/consume unchanged).
Reinstall the plugin via `install-cep.sh`.

**Constraints.** Money-zone untouched. Reuse the existing chips/mention/refKind system — don't
rebuild the reference backend. Web `index.html` direct source; plugin no CDN. Keep web + plugin
consistent.

**When finished:** commit in logical chunks (cascade-delete/orphan; autocomplete parity; counters/
messaging; optional chips — clear messages, no Co-Authored-By); do NOT push. Summary: the gaps
closed and whether the atomic-chip stretch was done.

**Model:** Fable 5 (+Extra) — cross-surface reference UX; the optional atomic-chip step is the large part.

---

## PROBLEM 14 — Plugin: make the AI Tools "HISTORY" strip look nice (it's small/ugly)

**Context.** On the plugin's AI Tools page, the "HISTORY" strip (row of recent gens at the bottom)
looks small and cramped — tiny forced-square thumbnails, and it's clipped so you can't see more.
Make it look polished. Plugin only. (Analyzed — anchors below; related to PROBLEM 5's aspect fix.)

**Exact anchors (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- `.axroot .ai-hist-strip` (line 2619): `display:flex; gap:8px; overflow:hidden` — a flex row that
  CLIPS overflow (you can't reach items beyond the edge).
- `.axroot .ai-hist-strip .ht` (line 2620): `width:74px; height:74px` — fixed small SQUARE
  thumbnails (forced 1:1, same issue as PROBLEM 5). `.ht svg` (2621) is the play badge.
- Markup: `>HISTORY<` + `ai-hist-strip` (~lines 4009-4010), with an "All →" link (`ai-hist-all`
  ~2617).

**Step 1 — Make it scrollable, not clipped.** Change `.ai-hist-strip` to `overflow-x:auto`
(horizontal scroll) with a clean thin scrollbar (or edge fade) so ALL recent gens are reachable,
not cut off.

**Step 2 — Bigger, aspect-aware, tidy thumbnails.** Increase the thumbnail size and use each gen's
REAL aspect ratio (16:9 video, 9:16 portrait, 1:1) instead of forced 74×74 squares — consistent
with PROBLEM 5. Add subtle polish: rounded corners, a type badge (Image/Video/Audio) and/or play
icon for video, a gentle hover (scale/az) and cursor. Keep it compact but attractive, and readable
at the plugin's narrow width.

**Step 3 — Verify.** `node --check`; the HISTORY strip shows larger, real-aspect thumbnails, scrolls
horizontally to reveal all items, looks polished, and clicking a thumb still opens it (lightbox/
detail). Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff. Keep the "All →" link and
click behavior. Do together with PROBLEM 5 (shared aspect approach) if convenient.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the HISTORY strip
restyle (scroll + aspect + polish).

**Model:** Sonnet 5 — targeted plugin HISTORY strip restyle, exact anchors given.

---

## PROBLEM 15 — Plugin: History / My Library cards should have the FULL action toolbar

**Context.** On the plugin's History (My Library) grid, the gen cards don't show all the actions —
the same hover toolbar the RECENT/session cards have (Import to AE, Add to project, Use as
reference, Regenerate, Copy prompt, Delete) should appear on the History cards too. Plugin only.
(Analyzed — root cause below.)

**Root cause (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- `card(it, ctx)` (line 9435) builds the full action row `.racts` (~9460-9470), but each button is
  CONDITIONAL on a ctx handler: Import (`ctx.onImport`), Add to project (`ctx.onAddProject`), Use
  as reference (`ctx.refAllowed`/`ctx.onRef`), Regenerate (`ctx.onRestore` + `it.prompt`), Copy
  prompt (`it.prompt`), Delete (`ctx.onDelete`).
- The History renderer `renderHistory` (~9533/9675/9817) passes a REDUCED ctx (missing some
  handlers like `onAddProject` / `onRestore` / `onImport` / `refAllowed`), so those buttons don't
  render on History cards.

**Step 1 — Pass the full ctx in `renderHistory`.** Give the History/My Library card `ctx` ALL the
handlers the RECENT/session views use: `onImport`, `onAddProject`, `onRestore` (regenerate),
`onRef`/`refAllowed`, `onDelete`, and ensure `it.prompt` is present (for Copy prompt + Regenerate).
Reuse the exact same ctx builder the RECENT/session grids use so the toolbar is identical.

**Step 2 — Keep it consistent.** The action set + icons + behavior on History cards must match the
RECENT/session cards (single source of truth). Selection mode (the `.rcb` checkbox / Select) should
still work for bulk actions.

**Step 3 — Verify.** `node --check`; open History/My Library → each card's hover toolbar shows the
full set (Import, Add to project, Use as reference where applicable, Regenerate, Copy prompt,
Delete), each works, and it matches the RECENT/session cards. Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. Minimal diff — reuse the existing
`card()` + ctx; don't duplicate. Depends on P7 (Copy prompt fix) + the Add-to-project flow (from the
already-merged PARTIYA 5) being present — keep them working.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the History ctx
now passes all handlers so the full toolbar shows.

**Model:** Sonnet 5 — targeted History ctx fix, exact root cause given.

---

## PROBLEM 16 — Plugin: the Regenerate (↩) icon is clipped/cut off everywhere

**Context.** The Regenerate/restore icon (the circular-arrow used on gen cards and the lightbox)
renders CUT OFF — its arc is clipped. It appears everywhere the icon is used. Root cause: the SVG
path draws outside its viewBox. Plugin only. (Analyzed — exact root cause + anchor below.)

**Root cause (analyzed) — `plugins/after-effects-cep/AssetFlow_Plugin.html`:**
- `IC.rst` (line 9319): `rst:'<svg width="13" height="13" viewBox="0 0 24 24" ...><path d="M3 2v6h6"
  /><path d="M3 8a9 9 0 1 0 2.6-5.7L3 8"/></svg>'`. The second path is a radius-9 arc that extends
  BEYOND the 24×24 viewBox, so it's clipped at the viewBox edge → the icon looks cut off. This
  `IC.rst` is reused everywhere (all Regenerate buttons), so the clipping shows everywhere.

**Step 1 — Replace with a properly-fitting refresh/rotate icon.** Swap the `IC.rst` SVG for a clean
"rotate-ccw / refresh" icon whose path stays fully inside the 24×24 viewBox (e.g. the standard
Feather rotate-ccw: `<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
/>`, or the refresh-cw equivalent), keeping the same 13×13 render size, stroke-width, and
line-cap/join so it matches the other icons. Since `IC.rst` is a single definition, fixing it once
corrects every Regenerate button.

**Step 2 — Verify.** `node --check`; the Regenerate icon renders fully (no clipped arc) on gen
cards and in the lightbox, everywhere it's used, and stays crisp/centered in its 25×25 button.
Reinstall via `install-cep.sh`.

**Constraints.** Money-zone untouched. Plugin only, no CDN. One-line icon swap — minimal diff.
Don't change the button behavior.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the fixed icon
path.

**Model:** Sonnet 5 — one-line icon fix, exact root cause given.

---

## PROBLEM 17 — Web: AI Studio gen cards are too big

**Context.** On the web AI Studio, the generation result cards (Visuals / My Library grid) are too
large. Root cause: the masonry uses a fixed 3-column layout, and since the AI Studio is now
full-width (workspace-first entry), 3 columns across a wide viewport makes each card huge. Web
only. (Analyzed — anchor below.)

**Exact anchors (analyzed) — `packages/assetflow-studio/platform/index.html`:**
- `.va-axgrid { columns:3; column-gap:14px }` (line 15356) — the AI Studio visuals/My-Library
  masonry uses a FIXED 3 columns. On the full-width AI Studio, that's ~big cards.
- `.va-axgrid { columns:2; column-gap:9px }` (line 15495) — the narrow/mobile override.

**Step 1 — Use width-based columns, not a fixed count.** Change `.va-axgrid` (15356) from
`columns:3` to a `column-width`-based masonry (e.g. `column-width:220px` — tune ~200-240px) so the
number of columns adapts to the available width and each card stays a reasonable size on wide
screens. Keep the narrow/mobile override sensible (2 columns is fine on narrow widths, or let
column-width handle it).

**Step 2 — Verify.** Web (headless Chrome) at ~1280px and wider: AI Studio gen cards are a
comfortable, not-oversized size; the grid fills the width with more, smaller columns; no overflow;
still looks tidy at 390px. Screenshot before/after.

**Constraints.** Money-zone untouched. Web only (`platform/index.html` direct source). Minimal diff
(mostly the `.va-axgrid` rule). Don't regress the aspect-aware media from the previous batch.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the column-width
change and the resulting card size.

**Model:** Sonnet 5 — small web grid sizing fix, exact anchor given.

---

## PROBLEM 18 — Web: Regenerate fires a new gen instantly; it should load the prompt into the composer

**Context.** In the web AI Studio, clicking Regenerate (the ↻ on a gen tile, and "Regenerate" in
the Use ▾ menu) immediately starts a brand-new generation. That's wrong: it silently spends credits
and gives the user no chance to review/edit. Instead, Regenerate must LOAD the source gen's prompt
(and its settings) into the bottom composer/chat so the prompt appears in the composer and the user
can review, tweak, and press Generate themselves. (Analyzed — exact root cause + anchors below.)

**Exact root cause (analyzed) — `packages/assetflow-studio/platform/index.html`:**
- `axTileRegen: (e) => { e.stopPropagation(); this.generate(); }` (line 19383) — the tile ↻ button
  calls `this.generate()` immediately.
- `axMenuRegen: (e) => { e.stopPropagation(); this.setState({ useMenuOpen:false }); this.generate(); }`
  (line 19373) — the menu item does the same.
- The gen object DOES carry what's needed: `activeGenRaw.prompt` is already read for Copy-prompt
  (`axHasPrompt`, ~19375-19378), and gens store `modelId` (~17913/18192/18198) + gen params.
- There's already a clean "prefill the composer" precedent: `doEnhance()` (~18239) sets
  `this.setState({ aiPrompt: r.prompt })` — Regenerate should prefill the composer the same way,
  and NOT call generate().

**Step 1 — Make Regenerate prefill the composer instead of generating.** Rewrite BOTH `axTileRegen`
(19383) and `axMenuRegen` (19373) so that, given the source gen (for the tile handler, resolve the
gen from the clicked tile via its `[data-id]` → look it up in the gens list, same way `onGridTile`
at 19368 resolves `wsGens.find(x => x.id === id)`; for the menu handler use `activeGenRaw`), they:
(a) set `aiPrompt` to that gen's `prompt`; (b) restore the gen's settings where available —
tool/mode, model (`modelId`), aspect, duration, resolution/quality, and references (start/end frame,
refs) — into the composer state so the composer reflects how it was generated; (c) close any open
menu; (d) scroll to / focus the composer prompt textarea so the prompt is visibly there; and (e) do
NOT call `this.generate()`. Show a light toast like "Loaded into composer — edit and Generate".

**Step 2 — FULL-FIDELITY restore (model + settings + references/frames).** Regenerate must bring
the gen back EXACTLY as it was made — same model, same settings, AND any reference image / start &
end frame / media-refs it used must REAPPEAR in the composer (the ref thumbnails/chips and the
"+ Start frame" / "+ End frame" slots must show the original media again), not just the text prompt.
Mechanics:
- The composer holds references in state as `refImages` (image-edit / media-refs images),
  `refStartUrl` (video start frame), `refEndUrl` (video end frame), `refVideos`, `refAudios`, plus
  `aiAudio` / `aiBitrate` (state defined ~17028-17036). `buildParams(tool, model)` (~18177) turns
  that state INTO the gen `params`. Restore is the INVERSE: read the source gen's stored `params`
  (+ `modelId` + `prompt`) and map them BACK onto that composer state.
- The tile/menu gen object may not carry full `params` — fetch the full record first via
  `FFAPI.genGet(id)` (the same call `downloadGenAsset` already uses ~18255) to get `prompt`,
  `modelId`, and `params` (referenceUrl → `refStartUrl`, referenceEndUrl → `refEndUrl`, the image
  refs → `refImages`, media-ref video/audio → `refVideos`/`refAudios`, aspect/duration/resolution/
  quality → the matching composer selectors, audio/bitrate → `aiAudio`/`aiBitrate`).
- Select the gen's ORIGINAL model (`modelId`) via the existing model-pick path, then apply the
  restored settings through the existing param-clamp/validation (the AI-settings work) so an invalid
  combo is never set. Respect each model's ref capability (`gcaps` at ~18285: frames vs media-refs
  vs image) when re-attaching refs.
- If the original model is disabled/unavailable, still load the prompt + as many settings as valid
  on the fallback model and toast that the original model isn't available; if a referenced asset URL
  is gone, skip that ref gracefully (don't crash) and note it.

**Step 3 — Plugin consistency check.** Verify the AE plugin's Regenerate (the `IC.rst` button
path / onRestore) also LOADS the prompt into its composer rather than auto-firing a generation; if
it auto-generates, apply the same "prefill, don't generate" fix there. (If it already prefills,
leave it.)

**Step 4 — Verify.** Web (headless), test THREE gens: (a) a plain text→image gen, (b) an
image-edit / image-ref gen, and (c) a video gen made with a start frame (and end frame if used).
Click the tile ↻ and the Use ▾ → Regenerate on each → the composer prompt fills with that gen's
prompt, the ORIGINAL model is re-selected, aspect/duration/resolution/quality match the original,
AND the reference image / start & end frames / media-refs REAPPEAR in the composer (thumbnails +
frame slots populated). The composer is focused/scrolled into view, and NO generation starts / NO
credits are spent until the user presses Generate. Confirm an unavailable-model or missing-ref gen
still loads the prompt gracefully. Screenshot the filled composer showing the restored reference.

**Constraints.** Money-zone untouched — this REMOVES an unwanted generate call, it must not change
consume/quote/refund or `generate()` internals; it only stops auto-invoking generate and prefills
state. Web is `platform/index.html` (direct source); plugin fix (if needed) in
`AssetFlow_Plugin.html`. Minimal diff — mostly the two handlers.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the two
rewritten handlers + whether the plugin needed the same fix.

**Model:** Sonnet 5 — targeted handler rewrite, exact root cause + prefill precedent given.

---

## PROBLEM 19 — Template ingest picks the WRONG video as the preview (Help.mp4 instead of Preview Video.mp4)

**Context.** A template zip can contain several videos — e.g. `Preview Video.mp4` (the real
preview) AND `Help.mp4` (a tutorial/help clip), plus a `(Footage)` folder. Right now ingest grabs
the FIRST video it sees, so `Help.mp4` can become the catalog preview video instead of
`Preview Video.mp4`. The picker must choose the actual preview and never use the help/tutorial clip.
(Analyzed — exact root cause + anchor below.)

**Exact root cause (analyzed) — `apps/api/src/lib/ingest-zip.ts`:**
- In the central-directory scan (~lines 314-323), the classifier is FIRST-MATCH:
  `else if (!image && IMAGE_EXTS.includes(ext)) { image = {entry, ext}; }` and
  `else if (!video && VIDEO_EXTS.includes(ext)) { video = {entry, ext}; }`. The `!video` / `!image`
  guard means whichever media entry is encountered first (in zip order) wins — there's no
  preference for a file named "Preview Video" and no exclusion of "Help". So `Help.mp4` (or any
  footage clip) can be selected as the preview.
- The result is returned in `zip.on("end")` (~line 326) as `{ pack, image, video, ... }`.

**Step 1 — Score candidates instead of first-match.** Change the scan so it COLLECTS all image
candidates and all video candidates (small arrays of `{entry, ext, name}` — names only, no
extraction), then in `zip.on("end")` PICK THE BEST by score rather than the first:
- Strongly PREFER a basename matching `/preview/i` (best: video basename matching both preview and
  video, e.g. `/preview[ _-]*video|video[ _-]*preview/i`; image basename matching
  `/preview[ _-]*image|preview/i`).
- DEMOTE/EXCLUDE non-preview clips: basename matching `/\b(help|tutorial|instruction|guide|readme|howto|how[ _-]to)\b/i` — never pick these as the preview unless there is literally no other
  candidate (and even then, prefer to leave the preview empty over using a help clip — pick the
  ranking that best matches the user's intent: a help video must NOT silently become the preview).
- DEMOTE anything inside a `(Footage)` / footage / assets subfolder (those are project sources, not
  the preview).
- Keep the existing pack pick (`PACK_EXT_APP`) unchanged.

**Step 2 — Keep it streaming-safe.** Collecting candidate *metadata* (name/ext/entry ref) for a few
media files is cheap and doesn't break the ranged-read design (no early extraction). Only the single
chosen image/video entry is streamed later, exactly as today. Respect the existing entry/junk
filters (`isJunkEntry`, `__MACOSX`, `.DS_Store`).

**Step 3 — Verify.** Add/adjust a unit-style check (or a scripted zip) with the exact layout from
the report: `(Footage)/…`, `Football Championship Logo Reveal 2026 24.x.aep`, `Help.mp4`,
`Preview Image.jpg`, `Preview Video.mp4` — assert the ingest picks `Preview Video.mp4` (NOT
`Help.mp4`) as the video and `Preview Image.jpg` as the image, regardless of zip entry order. Also
test a zip where the help clip appears BEFORE the preview, and a zip with only `Help.mp4` (assert it
is not chosen as preview / preview stays empty). `npm run build -w apps/api`.

**Constraints.** Money-zone untouched. Backend only (`ingest-zip.ts`). Additive, minimal diff — a
scoring pick in place of first-match. Don't change the pack/app detection or the security limits.
Note in the summary that already-ingested templates that got the wrong preview aren't retroactively
fixed (they'd need a re-ingest / re-upload).

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the scoring
rules and the verified pick.

**Model:** Sonnet 5 — contained backend picker fix, exact root cause given.

---

## PROBLEM 20 — 🔴 Plugin auto-signs-out on the download limit; only an admin block should ever sign a user out

**Context.** When a Free user hits the monthly download limit, the plugin LOGS THEM OUT with
"Session expired — please sign in again" instead of showing the limit / "Upgrade to Pro" modal. Two
bugs: (1) the plugin must NEVER auto-sign-out on a limit (or any non-auth) response — it should only
sign out on a genuine expired/invalid token OR when the ADMIN has blocked the account; (2) as a
downstream symptom, a user who still has quota (e.g. 7/15) then can't import at all, because the
token was wrongly cleared by an earlier non-auth 403. Analyzed — exact root cause + the backend's
real status/code contract below.

**Backend contract (analyzed — do NOT change it, the codes already exist) —
`apps/api/src/routes/plugin.ts` + `apps/api/src/lib/plugin-profile.ts`:**
- Download/import limit reached → HTTP **403** with `code: "LIMIT_REACHED"` (pack gate ~354 returns
  `gate.code` from `consumeDownload`; `/usage/import` ~898; plugin-profile.ts ~449/492/533).
- Admin-blocked account → HTTP **403** `code: "ACCOUNT_BLOCKED"` (e.g. `/me` ~806); inactive →
  `code: "ACCOUNT_INACTIVE"` (~457/508).
- Per-template Pro required → HTTP **402** `code: "PRO_REQUIRED"` (~342).
- Genuine invalid/expired token → HTTP **401**.
So **403 is overloaded** — limit, blocked, and inactive all use 403, distinguished only by `code`.

**Exact root cause (analyzed) — `plugins/after-effects-cep/assetflow-account.js`:**
- `handleAuthFailure(status, hadToken)` (~line 51): `if ((status === 401 || status === 403) &&
  hadToken) { clearToken(); … dispatch 'assetflow:session-expired'; }`. It clears the token and
  fires the sign-out modal on ANY 401 **or 403**, with no regard for `code`. So a 403
  `LIMIT_REACHED` (limit) wrongly signs the user out.
- It's called blindly from `request()` (~line 204: `handleAuthFailure(res.status, !!t)`) and from
  `assetflow-catalog.js` `fetchCatalogPage` (~142) — neither passes the error `code`.

**Step 1 — Make sign-out depend on the CODE, not just the status.** Change `handleAuthFailure` to
receive the parsed error `code` (add a 3rd arg, e.g. `handleAuthFailure(status, hadToken, code)`).
Sign out (clearToken + `session-expired`) ONLY when the failure is genuine auth-invalidation:
`status === 401` OR (`status === 403` AND `code === "ACCOUNT_BLOCKED"` or `"ACCOUNT_INACTIVE"`). For
every other 403 (`LIMIT_REACHED`, `PRO_REQUIRED`, unpublished, generic forbidden) it must NOT clear
the token and NOT fire session-expired — just let the error propagate to the caller. Update both
call sites (`request()` ~204 and `fetchCatalogPage` ~142) to pass `data?.code` (the parsed body's
code). Keep the existing `sessionEstablished` / boot-guard behavior.

**Step 2 — Route the limit response to the limit modal, not "Session expired".** In the plugin's
error mapping, a 403 `LIMIT_REACHED` (download or import) must show the existing "Monthly download
limit reached / Upgrade to Pro" modal (`AssetFlow_Plugin.html` ~4915-4940), and `PRO_REQUIRED` its
Pro modal — NOT the session-expired path. Fix the greedy branch in `afMapError`
(`AssetFlow_Plugin.html` ~8081) that maps ANY text containing "401"/"403"/"forbidden" to "Session
expired": it must first honor the specific business codes (LIMIT_REACHED → limit message,
PRO_REQUIRED → Pro message, ACCOUNT_BLOCKED → "Your account was blocked — contact support") and only
fall through to "Session expired" for a genuine 401/expired token. The download path
(`assetflow-catalog.js` ~1072 re-throwing 401/403) should carry the `code`/`status` through so the
caller can branch.

**Step 3 — Fix "has quota but can't import".** With Step 1 in place, a user under the limit no
longer gets their token cleared by a stray non-auth 403, so import should work again. VERIFY the
import/download path end-to-end for an under-limit user (7/15): the pack downloads and imports with
NO sign-out and NO false "Session expired". If any catalog/heartbeat/usage call still returns a
non-auth 403 that used to clear the token, confirm it now no longer signs the user out.

**Step 4 — Verify.** Reinstall via `install-cep.sh`, restart AE. Simulate/confirm: (a) at the
download limit (15/15) → the "Monthly download limit reached · Upgrade to Pro" modal shows and the
user STAYS signed in (token intact); (b) under the limit (7/15) → import succeeds, no sign-out; (c)
admin blocks the account (403 ACCOUNT_BLOCKED) → the user IS signed out with a clear "account
blocked" message; (d) a genuinely expired token (401) → session-expired modal as before. Add a small
unit check on `handleAuthFailure(status, hadToken, code)` for each case. `node --check` the plugin;
build the API if any TS reads changed (none expected — backend is only being READ here).

**Constraints.** MONEY-ZONE / limit-enforcement untouched: `consumeDownload` / `consumeImport` /
quote / refund and all backend gates stay byte-for-byte — this only changes the CLIENT's REACTION to
the responses (whether to clear the token) and error copy. Plugin + `assetflow-account.js` +
`assetflow-catalog.js` only; no backend logic change (codes already exist). Minimal diff.

**When finished:** commit (clear message, no Co-Authored-By); do NOT push. Summary: the code-aware
`handleAuthFailure`, the limit/pro/blocked routing, and the verified matrix (limit=stay,
blocked=sign-out).

**Model:** Opus 4.8 — auth/session-sensitive correctness (never wrongly log out), CRITICAL; exact
anchors + backend code contract given.

---

## PROBLEM 21 — 🔴 Download/import limit chain: user has download quota but can't import (hidden lifetime import cap); make the ADMIN-configured limit the sole authority

**Context.** A user with download quota left (7/15 this month) still can't import a template. Root
cause (traced end-to-end): a single Import consumes TWO different limits, and the import one is a
LIFETIME counter that never resets, so it silently blocks the user even though the visible monthly
download quota is fine — and the modal then mislabels it as "Monthly download limit reached." Per the
owner's decision: the ADMIN-configured limit must be the single source of truth, and a user within
the admin's limit must actually be able to import. (Analyzed — exact chain + anchors below.)

**The chain (analyzed):**
1. Plugin Import → `AssetFlowCatalog.downloadPackToTemp(...)` → backend pack route → `consumeDownload`
   (MONTHLY: `downloadsMonth < downloadLimit`, reset each month). User: 7/15 → passes.
2. Then plugin → `AssetFlowAccount.recordImport()` → `/usage/import` → `consumeImport`
   (**LIFETIME**: `importsTotal < importLimit`, NEVER reset). User `importsTotal = 10` = the Free
   default → **fails with 403 LIMIT_REACHED** → plugin `openLimitSheet()` shows "Monthly download
   limit reached" (wrong reason).

**Exact anchors:**
- `apps/api/src/lib/plugin-profile.ts`: `FREE_DOWNLOAD_LIMIT = 15` (~line 10), `FREE_IMPORT_LIMIT = 10`
  (~line 11); `consumeDownload` (~453) uses monthly `downloadsMonth`; `consumeImport` (~500) uses
  LIFETIME `importsTotal`; `resetMonthIfNeeded` resets `downloadsMonth` ONLY; `planLimits` (~101)
  reads admin `PlanConfig` first, else the static fallbacks; per-user `downloadLimitOverride` /
  `importLimitOverride` (`profile.importLimitOverride ?? limits.importLimit`).
- `apps/api/src/routes/admin.ts`: `PlanConfig` GET/PUT (~140-189, `downloadLimit`/`importLimit`) +
  per-user overrides (~349-366). Admin UI: `packages/assetflow-studio/js/admin-plans.js` (~19-47).
- Plugin: import flow `if(e&&e.status===403){ openLimitSheet(); }` (`AssetFlow_Plugin.html` ~5253 &
  ~5326) and the `recordImport` catch (~5266/5330); the limit-sheet copy "Monthly download limit"
  (~4915-4940).

**Step 1 — Admin config is the SOLE authority.** Verify (and fix if not) that `consumeDownload` /
`consumeImport` enforce EXACTLY the admin-configured limit: per-user override
(`download/importLimitOverride`) if set, else the plan's `PlanConfig` value, else the static fallback
ONLY when no admin config row exists. The hardcoded `FREE_IMPORT_LIMIT`/`FREE_DOWNLOAD_LIMIT` must be
a last-resort default, never overriding an admin value. Confirm admin edits (PlanConfig + per-user
override) take effect promptly (mind the 60s planCfg cache — acceptable, but note it).

**Step 2 — Fix the import counter so the admin's limit actually WORKS (recurring, not a permanent
lifetime lock).** The bug that blocks the user is that `importLimit` is checked against the
never-resetting `importsTotal`, so the admin's number becomes a one-time lifetime allowance that
permanently locks users. Make the import limit a RECURRING MONTHLY allowance parallel to downloads:
add (additive migration) an `importsMonth` counter (+ reuse the existing month-reset), switch
`consumeImport`'s atomic guard to `importsMonth < effectiveLimit`, and have `resetMonthIfNeeded`
reset `importsMonth` alongside `downloadsMonth`. Keep `importsTotal` incrementing for lifetime stats
(don't remove it). This immediately unblocks the stuck user (importsMonth starts at 0) and makes the
admin's configured import limit behave like a real per-month limit. NOTE: if the owner actually wants
a true never-reset lifetime import cap instead, this is the one place to flip — flag it in the
summary so they can choose.
> ⚠️ MONEY-ZONE: `consumeImport`/`consumeDownload` are enforcement. PRESERVE the atomic
> `updateMany` race-safe guard pattern EXACTLY (guard in WHERE, count===0 → LIMIT_REACHED). You are
> only changing WHICH counter field the guard reads and adding its monthly reset — diff-prove the
> atomicity and that enforcement is NOT weakened (a user at/over the limit is still blocked).

**Step 3 — Correct the limit modal reason + surface both quotas.** The limit sheet must state the
ACTUAL reason and number: download-limit case → "Monthly download limit reached — N/N"; import-limit
case → "Monthly import limit reached — N/N" (distinguish by which call 403'd / the response context).
In the plugin Account panel, surface the import quota too (it already shows "Total: 7 · Imports: 10")
so the binding limit is visible, not hidden. Reuse the admin-set numbers from `/me` limits.

**Step 4 — Verify the WHOLE chain.** With a dev DB: (a) user under both limits → download + import
succeed, template imports into AE, no false block; (b) user at the monthly download limit → download
sheet with correct copy, stays signed in (ties to PROBLEM 20); (c) user at the monthly import limit →
import sheet with correct "import" copy; (d) admin lowers/raises the PlanConfig import limit or sets a
per-user `importLimitOverride` → the new limit is what's enforced on the next import; (e) month
rollover → both `downloadsMonth` and `importsMonth` reset. `npm run build -w apps/api`; run the
additive migration on a dev DB; `node --check` the plugin. Prove the money-zone diff.

**Constraints.** Additive migration only (`importsMonth` + its reset marker; default 0). Money-zone:
preserve the atomic enforcement pattern byte-for-pattern; only the read field + monthly reset change,
diff-proven. Admin-config remains the single authority. Plugin copy/UI in `AssetFlow_Plugin.html`;
backend in `plugin-profile.ts` (+ `database` schema/migration). Minimal diff.

**When finished:** commit in logical chunks (schema+migration; consumeImport monthly; admin-authority
verify; plugin sheet copy — clear messages, no Co-Authored-By); do NOT push. Summary: the traced
chain, the import-counter change (monthly vs the old lifetime), proof admin config is authoritative,
and the money-zone diff proof. Flag the lifetime-vs-monthly choice for the owner.

**Model:** Opus 4.8 — money-zone limit enforcement + schema migration, CRITICAL; exact chain +
anchors given.
