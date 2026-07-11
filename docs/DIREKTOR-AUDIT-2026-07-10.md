# FrameFlow — Director Proactive Audit (2026-07-10)

> Deep red-team by 4 parallel agents across Web AI Studio · Web Templates/catalog · Admin · Contributor
> upload/chain. Every finding is grounded in code (file:line + root cause). These are NEW issues, separate
> from BATCH3's 9 known problems. Severity: **P0** broken/data-loss/credit-waste · **P1** clear bug/UX
> failure or wrong numbers · **P2** minor/inconsistency. USER picks which to turn into Code prompts.
> ⚠️ Money-zone items are FLAGS only (verify server-side; do not alter signed-price logic).

---

## A. Web AI Studio (composer / gen / sessions)

- **[P1] Lightbox "Reference" button is a dead "coming soon" stub** — `platform/index.html:16961` + `:19566`
  — `useAsRef` only toasts "coming soon", yet a working `useGenAsRef('edit'|'i2v')` exists; also shown for
  video/voice/SFX where it's meaningless. Fix: wire to `useGenAsRef`, hide for non-image.
- **[P1] "Generating…" can hang forever — `pollJob` never gives up** — `:18211-18239` — `tick()` swallows
  every `genGet` error and reschedules with no max-attempt/deadline; a stuck/404/network job spins forever.
  Fix: add an elapsed/attempt cap that resets `generating` + retry toast.
- **[P1] "Enhance" spends credits with no cost shown / no balance gate** — `:18241-18255`, button `:16528`
  — repeated clicks silently burn credits; no ✦ amount, no confirm. (Money-zone: surface price / gate in
  UI only.)
- **[P2] My Library count capped at 40 and mislabeled as total** — `:17808` (`history(40)`) → `:19340/:19386`
  — users with >40 gens undercount + older results omitted. Fix: paginate or label "recent".
- **[P2] Grid/lightbox media use signed URLs that expire (~1h) while page open** — `:18936/:18588/:17911`
  — thumbnails/playback 403 after an hour. Fix: refresh URL on lightbox open or use CDN URLs.
- **[P2] "Regenerate"/restore re-injects stale reference URLs → doomed paid run** — `:18368-18372` — copies
  stored ref URLs (not fresh); expired refs pass quote, consume credits, provider fails. Fix: re-sign on restore.
- **[P2] Session-expiry mid-gen spams toasts + stuck busy state** — `:17493-17497` + `:18211` — poll keeps
  401-ing, re-dispatching `ff-auth-expired`. Fix: `clearTimeout(_pt)` + `generating:false` on expiry/logout.
- **[P2] Finished gen hijacks `activeGenId` even after navigating to another session** — `:18219-18223` —
  result becomes invisible (falls back to `wsGens[0]`). Fix: only adopt if it's in the visible pool.
- **[P2] Models-load failure → permanent "Loading…", no retry** — `:17789-17803` + `:18569`. Fix: expose a
  load-error state + retry.
- **[P2] `useGenAsRef` silently swaps to a different (differently priced) model** — `:18311` — no notice.
  Fix: toast which model it switched to.
- **[P2] Lightbox has no Escape-to-close / no alt text (a11y)** — `:16945-16962`. Fix: keydown Esc + labels.
- **[P2 · money flag] Stale-session retry reuses the same `costQuoteSignature`** — `:18197-18201` — verify
  server-side that quote replay on retry is idempotent (do not change signing).

## B. Web Templates + catalog + filter + detail + download

- **[P1] Catalog shows "Nothing found" prematurely during progressive load** — `:17731/:19471/:19474` —
  `catalogReady` set on page 1 while later pages still load; empty state flashes for items on later pages
  (>100 templates). Fix: distinct `catalogFullyLoaded` flag; empty state only after `nextCursor===null`.
- **[P1] Marketplace search matches ONLY the template name** — `:18862` — tags/category/description/author
  never searched, so obvious queries return 0. Fix: also test `t.c`, `t.tags`, `t.desc`.
- **[P2] Related / "Part of collection" use a different taxonomy than the pills** — `:18896-18897` vs
  `catBucket` — empty Related sections; previewed count never matches the destination. Fix: group by the
  same bucket.
- **[P2] Unbounded in-memory catalog + full re-render per page + non-virtualized masonry** —
  `:17725-17734/:18862/:16263` — ~O(n²) render at scale (up to 10k items). Fix: append pages without full
  re-render; virtualize/cap the grid.
- **[P2] "Most relevant" sort is a no-op + mislabeled** — `:18863-18867` — default applies no ordering, no
  relevance ranking even with a query. Fix: rank by match or rename.
- **[P2] Resolution→quality classification brittle** — `:17743` — anything not literally "4K" (2160p/UHD/2K/
  8K) → HD, wrong badge + excluded from 4K filter. Fix: normalize or classify by pixel count.
- **[P2] NEW badge + "Newest" use upload time, not publish/approval time** — `:18858/:18865` — long-uploaded
  but just-approved items never get NEW. Fix: surface a publish/approval timestamp.
- **[P2 · money flag] Web download decrements quota before the file is delivered** — `plugin.ts:352` +
  `serve-asset.ts:113-115` ← `:18428-18432` — quota spent on link generation; blocked/cancelled download =
  count lost, no file. Flag; consider not burning quota on link-gen for web.
- **[P2] Grid card `<video poster>` can be empty when preview exists w/o thumbnail** — `:16267` (+ duplicate
  card blocks) — detail hero was hardened, grid cards were not → blank flash. Fix: null-guard + `onerror`.
- **[P2] Cached catalog holds 24h signed display URLs (non-CDN path)** — `catalog-map.ts:25` → `:17731/:17747`
  — tab open past TTL shows broken media. Fix: refetch on focus after staleness (non-CDN only).

## C. Admin panel

- **[P1] "Message subscriber" is a silent no-op** — `admin-subscribers.js:551-567` — Send only toasts "Sent";
  no API call, nothing delivered. Fix: wire a real endpoint or relabel/remove.
- **[P1] Moderation "Soft"/"All" tabs render stale/empty data** — `admin-views.js:257-273/501-510` +
  `studio-templates.js:123-134` — only pending/new reload; landing on Moderation first shows 0 soft/hard.
  Fix: load `scope=all` (or dedicated fetch) for those filters.
- **[P1] "Active"/"Online" subscriber counts drift between two sources** — `admin.ts:238-246` vs `:276-278`
  → `data.js:202-217` — two different definitions overwrite one global; KPI differs by navigation order and
  "Active = using plugin" actually counts account-status. Fix: unify/namespace the stat sources.
- **[P1] "Online" filter regex omits the most-recent users; count ≠ rows; label wrong** —
  `admin-subscribers.js:84-87` + `admin.ts:246` + `plugin-profile.ts:702-704` — excludes "Hozir" (most
  online); badge ≠ list; "last 1 hour" label wrong. Fix: one shared predicate + correct label.
- **[P2] Subscriber-list usage cell ignores per-subscriber limit override** — `admin-subscribers.js:111-122`
  + `data.js:219-225` — list uses plan default not `downloadLimitOverride` (detail view is correct). Fix.
- **[P2] Admin plan changes don't emit `PlanChangeEvent`** — `admin.ts:355-398` vs `:913-945` — churn/
  conversion/ARPU understated; metrics don't reconcile with plan groupBy. Fix: record event (source=admin).
- **[P2] Same user's credit-spend differs across admin screens** — `admin.ts:709-714` (done-only) vs
  `:810-829` (all statuses − refunded); margin skews negative for failed-but-charged. Fix: one definition.
- **[P2] Plan "Active" toggle never persists (+ Studio tier unhandled)** — `admin-plans.js:159-168/36-56` +
  `admin.ts:148-158` — toggle toasts success but no `active` field exists/sent; only free/pro pushed. Fix.
- **[P2] Reject reason not enforced; reject "Category" discarded** — `admin-views2.js:683-722` — empty
  reason → "Rejected by moderation"; soft-reject category never read. Fix: validate + include category.
- **[P2] Moderation "New only" filter is redundant with "Pending"** — `studio-templates.js:56` — every
  pending is "new". Fix: real recency signal or drop.
- **[P2] STUDIO-tier subscribers vanish from plan counts (free+pro < total)** — `admin.ts:286-289` +
  `data.js:178-183/214-215` — STUDIO in neither bucket but listed as Pro. Fix: fold STUDIO into paid.
- **[P2 · security] Contributor block endpoint: no target-role/self guard, 500 on missing** —
  `contributor.ts:3104-3131` — can force-logout a peer admin (tokenVersion bump); unknown id → unhandled
  500. Fix: restrict to CONTRIBUTOR, 404 on missing, block self/peer-admin.
- **[P2] Post-approval metadata edits bypass re-moderation** — `contributor.ts:2444-2493` — owner can edit
  name/desc/tags of a live APPROVED template, stays live without re-review. Fix: revert to PENDING on edit.

## D. Contributor upload + chain

- **[P1] Wizard/direct upload never sets `templateApp` → non-ingest templates mislabeled "After Effects"** —
  `contributor-views.js:866-879` → `contributor.ts:2398` (default "ae"); `/pack-uploaded` (1465-1474) and
  `/assets` (2142-2159) never derive it. Same `.mogrt` = `pr` via bulk but `ae` via wizard → wrong plugin
  badge + `?app=` filter. Fix: `appForPackExt(ext)` in `/pack-uploaded`+`/assets`, or send from wizard.
- **[P1] Orientation & Resolution selects have no `selected` binding → silently reset to Landscape/4K** —
  `contributor-views.js:784-785` — stepping back or editing a Portrait/1080p template flips it on next
  Continue/Submit. Fix: reflect `UP_DRAFT.orient`/`res` in `<option selected>`.
- **[P1] Rights-attestation dead-end: a draft saved before accepting rights can never be submitted from the
  list** — `contributor.ts:2527-2533` requires `rightsAcceptedAt`, but the checkbox is only on wizard Step 3;
  list/drawer "Submit"/"Resubmit" → permanent 400 RIGHTS_REQUIRED. Fix: surface rights on list/drawer submit.
- **[P2] Wizard edit→submit forces re-uploading the entire (≤3 GB) pack** — `contributor-views.js:492` clears
  `files`, `validateUploadPackFile` (561-570) needs a local pack. Fix: treat existing server pack as satisfying.
- **[P2] `previewTranscodeStatus` can stick at "pending" forever (Cloud Run throttle trap)** —
  `contributor.ts:1139/1924` fire-and-forget transcode; "Compressing…" forever + serves un-optimized preview.
  Fix: run under in-request slot or reconciliation sweep.
- **[P2] Public `/api/contributor/catalog` omits the `takedownAt` filter** — `contributor.ts:2843-2870` vs
  `catalog-map.ts:271` — approve-after-takedown-without-restore surfaces a taken-down item here while plugin
  hides it. Fix: add `takedownAt: null` (reuse `approvedCatalogWhere`).
- **[P2] Bulk upload: names sanitizing to the same base clobber each other in R2** — `contributor.ts:1558-1559`
  + `ingest-zip.ts:425-433` — `"My Pack.zip"` and `"My-Pack.zip"` → same key; second overwrites first before
  ingest → one lost. Fix: add a uuid/content discriminator to the incoming key.
- **[P2] Auto-approve mode publishes to catalog before any pack exists/is scanned** — `contributor.ts:2369-2403`
  — `published:true` at create, bypassing the scan gate (download still fail-closes, so not P0). Fix: defer
  `published:true` until a clean scanned pack.

---

## Recommended to fix NOW (Director shortlist — highest value, low risk)
1. **D-P1 templateApp mislabel** (wizard/pack-uploaded/assets) — corrupts app badge + catalog filter (ties into #3/#10).
2. **D-P1 orientation/resolution reset** — silent data corruption on edit.
3. **D-P1 rights-attestation dead-end** — contributors get permanently stuck.
4. **B-P1 search matches name only** + **B-P1 premature "Nothing found"** — core catalog UX.
5. **A-P1 pollJob hang** + **A-P1 dead lightbox "Reference"** — visible AI Studio breakage.
6. **C-P1 message no-op** + **C-P1 moderation soft/all stale** + **C-P1 subscriber count drift**.
7. **C-P2 security: contributor-block peer-admin logout** — small but real permission hole.
