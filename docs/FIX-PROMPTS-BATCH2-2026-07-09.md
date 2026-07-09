# FrameFlow — Fix Prompts BATCH 2 (post-completion) — refund bug + admin per-user gens

> New batch after FIX-PROMPTS-2026-07-09.md (16 problems) was fully completed. Two problems.
> **Do PROBLEM 18 FIRST** — it's a live money bug (credits not refunded on failed generation).

## GLOBAL RULES (apply to both)

- **Money-zone:** never change credit consume/refund AMOUNTS, the signed cost-quote/HMAC
  (`lib/gen-quote.ts`, `computeGenCost`/`imageUnitCost` in `gen-models.ts`, `consumeAiCredits` in
  `plugin-profile.ts`), or webhook idempotency. PROBLEM 18 fixes the refund TRIGGER/scheduling
  only — call `refundAiCredits`, don't change it; prove the math is byte-for-byte unchanged.
- **Migrations additive-only** (if any); prove they apply on a dev DB.
- **English UI**; Uzbek code comments per convention.
- **Build pipeline:** `platform/index.html` = CF Pages direct source; admin + shared `js/` =
  Studio source → edit ROOT `js/`/`admin/` then `npm run studio:sync`; never edit build
  artifacts. The site-CMS work already added a content-hash `?v=` cache-bust to admin/shared JS in
  `scripts/prepare-cf-pages.mjs` — ensure any NEW admin js is covered by it.
- **Minimal, scoped diffs.** Reuse existing helpers/endpoints. Don't regress prior work.
- **Each problem:** commit in logical chunks, clear messages, **no `Co-Authored-By`**; do **NOT**
  push (the user pushes). End with a short summary (root cause + what changed + verification).

## EXECUTION ORDER
1. **PROBLEM 18** — refund on failed gen (CRITICAL money bug) — do this FIRST.
2. **PROBLEM 19** — admin per-user generation activity.

---

## PROBLEM 18 — 🔴 CRITICAL: credits NOT refunded when a generation fails (money-zone)

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

## PROBLEM 19 — Admin: per-user generation activity (see everything a user generated, incl. failures)

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
