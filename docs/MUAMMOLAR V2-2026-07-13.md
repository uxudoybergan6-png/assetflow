# MUAMMOLAR V2 — 2026-07-13 (post A→J · owner live testing)

> Owner-reported issues found during live testing after the A→J work order shipped.
> Each item is a self-contained Claude Code prompt. Numbering is NOT final — it will be
> re-ordered into blocks once the owner says "muammolar tugadi".

## GLOBAL RULES (include with every prompt)

- **🔴 MONEY ZONE IS FROZEN.** Never change credit consume/refund, the signed cost-quote / HMAC
  (`lib/gen-quote.ts`, `gen-models.ts` `computeGenCost`/`imageUnitCost`, `plugin-profile.ts`), or
  any credit *value*. UI, gates, watermark placement and download routing **around** them are
  allowed. If a fix seems to require the math → STOP and flag.
- Migrations **additive only**.
- **English UI text; Uzbek code comments.** Minimal, tight diff.
- **Studio source of truth:** edit ROOT `packages/assetflow-studio/js|styles|admin|contributor`,
  then `npm run studio:sync`. NEVER edit build artifacts. `platform/index.html` is edited directly.
- ⚠️ **BATCH6/8 redesign is a PARALLEL workstream.** If `platform/index.html` or the plugin has
  uncommitted BATCH changes, stop and report instead of merging blindly.
- **THE PLUGIN IS PART OF EVERY FIX.** Web + AE CEP plugin. A fix that lands only on the web is
  incomplete. Plugin: no internet-loaded assets; after edits run `install-cep.sh`; validate with
  `node --check` + a DOM/handler check.
- 🔴 **OWNER DIRECTIVE (2026-07-14): every reported problem OCCURS IN THE PLUGIN TOO, in
  parallel.** Do not treat the plugin as a "verify only" afterthought. For EVERY problem
  (P1…Pn and all future ones): (a) actively REPRODUCE the same symptom in
  `plugins/after-effects-cep/` (grep the equivalent code path — catalog, boot, avatars,
  badges, error states); (b) if the plugin lacks the surface entirely (e.g. contributor
  upload), state that explicitly in the summary; (c) otherwise FIX it in the same prompt with
  the same acceptance criteria as the web. A summary without a plugin verdict is incomplete.
- 🔴 **DO NOT reintroduce `softenPromptForSafety` or any provider-filter-evasion layer** (removed
  on purpose — violates Google/BytePlus ToS). **DO NOT loosen `isPublicReadKey()`** (leaks paid
  packs). **DO NOT renumber reference `@N` tokens on model switch.**
- When finished: commit (no Co-Authored-By), do NOT push, write a short summary.

---

# P1 — Watermark: wrong placement + wrong rules (owner's decisions REVISE the F/14b build)

## Owner's report

- Replace the watermark with **the owner's new PNG**, placed **nicely** (size, position, opacity).
- The watermark must appear **ONLY** when a **Free-plan** user tries to download **via a side
  channel** (browser dev-tools, direct URL — not the normal gated download).
- **AI generations (the user's own gen): NEVER watermarked** — generating costs credits, so the
  user already paid. This applies even on the Free plan, as long as they have credits.
- **Stock previews (card, lightbox): CLEAN, not watermarked** — "it must not sit there looking
  ugly everywhere."
- Stock watermark shows **only** when a Free user has **exhausted their monthly download limit**
  and then grabs the file **by a side channel**.

## 🔴 Owner decisions (binding, 2026-07-13) — these REVISE the earlier F/14b watermark model

| Surface | F/14b (old) | **V2 (new)** |
|---|---|---|
| AI generation download (Free) | watermarked | **CLEAN — never watermarked** (credits = payment) |
| AI generation download (Paid) | clean | clean |
| Stock preview (card/lightbox) | watermarked, public | **CLEAN** (see the low-res guard below) |
| Stock download, Free, within limit | clean | clean |
| Stock download, Free, limit exhausted | (blocked by `consumeDownload`) | **watermarked if grabbed by side channel** |
| Stock download, Paid | clean | clean |
| Watermark PNG | `apps/api/assets/watermark.png` (auto-generated) | **owner's new PNG** |

## Director's code analysis

- **AI-gen watermark exists and must be REMOVED** (owner decision #2). `gen-processor.ts` writes a
  `watermarkKey` for image/audio/video (`:1344`, `:1391`, `:1408`, `:1455`); `hydrateGenAssets`
  (`studio-gen.ts`) serves it to Free viewers. **Delete this path** — Free users get the clean
  original of their own generations. Keep the `GenAsset.watermarkKey` column (additive; just stop
  populating/serving it) to avoid a destructive migration.
- **Stock preview is public and currently watermarked.** `isPublicReadKey()` allows
  `templates/<id>/preview` and `thumb` (served via `cdn.getframeflow.app`).
  `generateStockWatermarkedDerivatives()` (`stock-derivatives.ts`) burns the watermark into that
  public preview. Owner wants it CLEAN.
- 🔴 **THE CONFLICT (must be solved, not ignored):** if the public preview is CLEAN, then "the side
  channel" the owner wants to watermark **is that very preview URL** — and it would be clean. The
  watermark would then *never* appear. **A clean, full-quality public preview = the paid asset
  given away.**

## 🎯 Director's solution — CLEAN but LOW-RES preview + watermark on the ungated download path

The real protection is **resolution/bitrate, not the logo** (this was already noted as P4.7).

1. **Public preview (card/lightbox) = CLEAN + deliberately LOW quality.**
   - Video: 720p max, capped bitrate. Image: downscaled (e.g. ≤1280px long edge), moderate
     quality. Audio: reduced bitrate.
   - Looks good on screen (owner's "not ugly"), but a screen-grab/direct-URL pull is **useless for
     professional work** — that is the actual DRM.
   - No visible logo on the preview.
2. **The clean, FULL-QUALITY original stays PRIVATE** (`pack`, auth-gated — `isPublicReadKey` never
   exposes it; do not change that).
3. **Gated download (`GET /assets/:id/pack`, `consumeDownload`):**
   - Paid plan → clean full-quality original.
   - Free, within monthly limit → clean full-quality original.
   - Free, **limit exhausted** → today it's a hard `403`. Owner's intent: instead of only blocking,
     if the user still obtains the file **by a side channel**, that file carries the watermark.
     **Decision needed on exactly which behaviour** — see Open question 1.
4. **AI generations:** always clean on download (remove the Free watermark). The AI-gen preview
   derivatives (thumb/display) already exist and stay clean.

## Owner's new PNG

- Owner will upload a new watermark PNG. Replace `apps/api/assets/watermark.png` with it.
- **Nice placement:** centered or lower-third, ~15–25% opacity, scaled relative to the media
  (e.g. width ≈ 30–40% of the frame), never pixelated, never covering the whole frame.
- One source of truth for the asset (already the case). The audio sting
  (`apps/api/assets/watermark-sting.mp3`) — keep or replace per owner (Open question 2).

## Hidden problems

- **P1.1 — Backfill.** Existing stock previews are watermarked (F build) and existing AI gens have
  `watermarkKey` set. A one-off script must: (a) re-generate stock previews CLEAN + low-res,
  (b) leave AI-gen originals clean (just stop serving `watermarkKey`). Old watermarked preview
  objects must be overwritten, not left behind.
- **P1.2 — 🔴 `isPublicReadKey` interaction.** The low-res clean preview is still the object served
  at `templates/<id>/preview` (public). The FULL-quality original must NOT be public. Verify the
  full-res file is stored under a private key (`pack`) and never under `preview`/`thumb`. This is
  the P4.1 trap from the original doc — do not let "preview" become the full original.
- **P1.3 — The plugin shows previews and downloads packs too.** Same rules: plugin preview = clean
  low-res; plugin import of a stock asset pulls the gated full-quality pack (clean within limit).
  Verify the plugin import path does not accidentally pull the public preview.
- **P1.4 — "Side channel" is hard to define technically.** A public URL is a public URL. Realistic
  scope: (a) the gated download endpoint returns watermarked bytes for over-limit Free users
  instead of a 403, and (b) the public preview is low-res so grabbing it is low-value. True
  dev-tools interception of the private signed pack URL is not really a "Free user" path (they'd
  need a valid signed URL, which the gate controls). Keep the model honest — don't promise
  watermarking of paths that can't be reached.
- **P1.5 — Audio.** Audio has no visual watermark; the sting tag is the equivalent. Apply the same
  rule: clean preview (reduced bitrate), sting only on the over-limit side-channel path.

## ✅ OWNER DECISION (2026-07-13) — this SIMPLIFIES the whole feature

**Free user, monthly download limit exhausted, normal Download button → HARD BLOCK**
("limit reached — upgrade to Pro"). Today's `consumeDownload` 403 behaviour is kept.

**Consequence — the watermark model collapses to almost nothing:**

Because the gated download is a **hard block** past the limit (not a watermarked download), and
the public preview is **clean but low-res**, there is **no remaining path that needs a burned-in
watermark**:
- AI generations → clean (removed).
- Stock preview → clean + low-res (DRM = resolution, not a logo).
- Stock download within limit → clean full quality.
- Stock download past limit → blocked entirely.

**So the actual work is:**
1. **REMOVE the AI-gen watermark** (stop writing/serving `watermarkKey`).
2. **Make stock previews CLEAN** (regenerate without the burned-in logo) **but keep them LOW-RES**
   (720p video / downscaled image / reduced-bitrate audio) so the public preview is not a usable
   substitute for the paid original.
3. **Keep the full-quality original PRIVATE** and gated (already the case — verify).
4. Replace the watermark PNG with the owner's file **only for the one remaining place it is still
   used** — see P1.6.

## P1.6 — Where does the watermark PNG still get used at all?

After the above, the burned-in watermark is used in **very few (maybe zero) places**. Before
replacing the PNG, the implementer must **enumerate every remaining caller** of the watermark
engine and confirm with the owner where a visible watermark should still appear. Candidates:
- **AI Stock** (P3 originals — user-submitted generations published to the public catalog): the
  owner may still want these watermarked in preview since they are fully public. **Decision needed.**
- Nowhere else, if previews are clean-low-res.

If it turns out the watermark PNG is used **nowhere**, still store the owner's PNG in
`apps/api/assets/` for future use, and note that the engine is dormant.

## Open questions for the owner — ✅ ANSWERED (survey 2026-07-14)

2. **Audio sting** — ✅ REMOVED. Previews are protected by reduced bitrate only (DRM =
   quality). Keep `watermark-sting.mp3` on disk as dormant asset; no code path uses it.
3. **AI Stock previews** — ✅ CLEAN + LOW-RES, same rule as all other stock. The watermark
   engine therefore has ZERO remaining callers (P1.6 resolved: store the owner's PNG in
   `apps/api/assets/` for future use; engine dormant).

---

# P2 — Free plan: no 4K gate. Free downloads ANYTHING within the monthly limit. (Owner revised)

## ✅ OWNER DECISION (2026-07-13, revised)

**Free users download whatever they want — 4K included — up to their monthly download limit.**
Once the limit is exhausted, downloads are blocked entirely (P1's decision A). **There is NO
resolution gate.** The Free↔Pro difference is the **download COUNT + credits**, not resolution.

So the owner's first phrasing ("tell them they can't get 4K") is superseded: nobody is blocked
from 4K by resolution — they're blocked by **running out of monthly downloads**.

## 🔴 Director's flag — this makes the pricing copy WRONG, and weakens Pro

Two consequences the owner must confirm:

1. **The pricing page currently lies.** It says **Pro: "4K, watermark-free downloads"** and Free:
   "up to 1080p" (`platform/index.html:18105`, `:18118`, `landing-config`). With this decision:
   - Free **does** get 4K (within the limit).
   - Watermark is gone for everyone (P1).
   → So **"4K" and "watermark-free" are no longer Pro benefits.** The pricing copy must be rewritten
     or it is false advertising (same problem as the removed "API access").

2. **What is left to distinguish Pro from Free?** After this + P1, the only differences are:
   - Free: 50 credits/mo · **15 downloads/mo**
   - Pro: 1 000 credits/mo · **unlimited downloads**
   - Studio: 3 000 credits/mo · unlimited downloads · seats

   That may be enough (credits are the real product), but **the owner should decide consciously** —
   this is a weaker Pro than the pricing page implies.

## What to build

1. **Do NOT build a 4K resolution gate.** (Owner decision — Free gets any resolution within limit.)
2. **Rewrite the pricing / plan copy** so it matches reality:
   - Remove "4K" and "watermark-free" as Pro-only benefits (they're universal now).
   - Frame the difference as **downloads/month** (Free 15 → Pro/Studio unlimited) + **credits**.
   - Update: pricing page, plan cards, FAQ ("What's included in Free"), CMS landing config, and the
     plugin's plan copy. ⚠️ CMS-stored copy overrides code defaults — update BOTH (same trap as the
     "Stock Catalog" rename).
3. **Tell the Free user their download standing BEFORE they hit the wall** (the salvageable part of
   the owner's original request):
   - On the asset detail + download button: **"X of 15 downloads left this month."**
   - When exhausted: the button is disabled/relabelled **"Monthly limit reached — Upgrade to Pro"**
     (pre-flight, no post-click 403 surprise — mirror the P22 pattern).
   - Same on the plugin.

## Hidden problems

- **P2.1 — The `maxResolution` profile field (`plugin-profile.ts:112`) is now dead/misleading.**
  Nothing enforces it and the plan no longer restricts resolution. Either remove it or repurpose it
  — but do not leave a field that implies a gate that doesn't exist.
- **P2.2 — Server still enforces the count limit (keep it).** `consumeDownload` (Free = 15/mo) is
  the real gate and stays exactly as is. Money zone — do not change the limit value here; only the
  UI messaging and the pricing copy.
- **P2.3 — AI generations are separate.** A Free user generating 4K in AI Studio is a **credit**
  matter (they pay credits), never a download-limit matter. Keep distinct.
- **P2.4 — Verify there was never a hidden 1080p-only serve path.** Confirm Free users already
  receive the full-resolution pack today (they do — no gate exists), so "Free now gets 4K" is not
  actually a new capability, just an honest description. No backfill needed.

## Superseded

The earlier P2 (build a 4K gate + block Free from 4K) is **cancelled** by the owner's revised
decision above. Do not build a resolution gate.

---

*(More problems will be appended below as the owner reports them.)*

---

# P3 — Contributor bulk upload: after "Sent to moderation" the screen just sits there (stale state)

## Owner's report

After a contributor uploads assets and they all reach "✓ Sent to moderation", the upload screen
stays exactly as-is — finished rows, full green bars, checked rights box, disabled buttons. It
looks stuck. Even when coming back to the page later, the same finished list is still there.

## Director's code analysis (root cause confirmed)

File: `packages/assetflow-studio/js/contributor-views.js` (ROOT source — edit here, then
`npm run studio:sync`).

1. **No completion state.** `startBulkIngest()` (`:566`) ends with `finally { BULK_RUNNING=false;
   renderUpload(); }` — it re-renders the *same* file list. Done rows stay, `BULK_RIGHTS` stays
   checked, "Upload & process" goes disabled (no queued files), "Clear finished" is the only live
   control. There is no success panel, no "what happens next", no CTA to My templates. The only
   feedback is a transient toast.
2. **Hidden bug — stale state on re-entry.** The sidebar "New upload" nav item calls the generic
   `route('upload')` (`contributor/index.html:124`), and the dashboard buttons call
   `route('upload')` directly (`contributor-dashboard.js:134`, `:157`). None of these reset the
   module state. Only the header "+ New upload" button calls `startNewUpload()` (`:429`), which
   does reset `BULK_FILES`/`BULK_RIGHTS`. So navigating away and back via sidebar shows the old
   finished list forever (matches the owner's "it's still like that when I come back").
3. `bulkClearFinished()` (`:481`) exists and works — the fix should reuse it, not duplicate logic.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Contributor Studio is a static SPA.
SOURCE OF TRUTH: edit ROOT packages/assetflow-studio/js/contributor-views.js and
packages/assetflow-studio/js/contributor-dashboard.js, then run `npm run studio:sync`.
NEVER edit build artifacts (studio/js, admin/js, contributor build output).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: do not touch credit consume/refund, cost-quote/HMAC
  (lib/gen-quote.ts, gen-models.ts, plugin-profile.ts) or any credit value.
- English UI text; Uzbek code comments. Minimal, tight diff. Migrations: none needed here.
- Do NOT loosen isPublicReadKey(). Do NOT reintroduce softenPromptForSafety.
- ⚠️ If platform/index.html or the plugin has uncommitted BATCH6/8 changes, stop and report
  instead of merging blindly (this fix should not need to touch either).
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

PROBLEM
packages/assetflow-studio/js/contributor-views.js — bulk upload (BULK_* state, ~lines 416–676).
After startBulkIngest() completes, the finally block just re-renders the same list: all rows
show "✓ Sent to moderation", the rights checkbox stays checked, "Upload & process" is disabled.
No success state, no next step. Worse, the sidebar nav "New upload" calls the generic
route('upload') (contributor/index.html:124) and contributor-dashboard.js:134 & :157 call
route('upload') directly — none of them reset BULK_FILES, so the stale finished list reappears
every time the user returns to the Upload view. Only the header "+ New upload" button calls
startNewUpload() which resets state.

FIX (two parts)

1. Success panel after a completed batch (contributor-views.js):
   - Add a module flag, e.g. let BULK_SUMMARY = null; // {done, dup, err} yoki null
   - In startBulkIngest(), after the ingest calls and count computation, when the run finishes
     and there are no remaining 'queued' files, set BULK_SUMMARY = { done: doneCount,
     dup: dupCount, err: errCount } (only if doneCount > 0; if everything failed keep the
     current behaviour — rows with errors stay actionable).
   - In renderBulkUpload(), when BULK_SUMMARY is set and !BULK_RUNNING, render INSTEAD of the
     dropzone+rows+footer a success card:
       ✓ icon + "N asset(s) sent to moderation"
       small dim line: "They'll appear in My templates with a Pending review status. You'll be
       notified once they're approved."
       If dup/err counts are non-zero, show one small amber/red line each (e.g. "2 duplicates
       skipped", "1 failed — see below") and KEEP the duplicate/error rows rendered under the
       card (reuse bulkRenderRow) so the user can inspect/remove them.
       Two buttons: [View my templates] → route('templates')  and
       [Upload more] → clears done+duplicate rows (reuse bulkClearFinished logic), sets
       BULK_SUMMARY = null, keeps BULK_CAT, resets BULK_RIGHTS = false (rights are attested
       per batch), then renderUpload().
   - Keep the existing toasts.

2. Stale-state reset on re-entry:
   - In window.afterRender.upload (contributor-views.js:994) — before renderUpload(), if
     !BULK_RUNNING and BULK_SUMMARY is set OR every file is done/duplicate, perform the same
     cleanup as "Upload more" above (clear finished rows, BULK_SUMMARY = null, BULK_RIGHTS =
     false). Queued and error rows must survive navigation (user may have staged files).
   - contributor-dashboard.js:134 and :157: change route('upload') → startNewUpload() so the
     dashboard CTAs always open a fresh upload (startNewUpload is already on window).
   - Do NOT change the generic nav renderer in contributor/index.html — the afterRender hook
     covers the sidebar path.

GUARDRAILS
- BULK_RUNNING must fully gate the cleanup: navigating away and back MID-UPLOAD must show the
  live progress list untouched (bulkUpdateRow relies on bulk-row-<i> ids — renderBulkUpload
  already re-creates them from BULK_FILES, so a re-render during running is safe; do not
  reorder BULK_FILES).
- Do not touch StudioApi.bulkIngestZips / bulkIngestAssets or the rights payload
  (rightsAccepted / RIGHTS_TERMS_VERSION) — UI only.
- The single-template EDIT wizard (UP_MODE 'single', openEditTemplate) must be unaffected.

PLUGIN CHECK (required by global rules)
plugins/after-effects-cep/ has NO contributor upload surface (it is subscriber Browse + AI
Studio only). Verify by grepping the plugin for bulk-ingest/upload-to-moderation calls; expect
none, and state this in the summary. No plugin change expected.

VALIDATION
- node --check packages/assetflow-studio/js/contributor-views.js (and contributor-dashboard.js)
- npm run studio:sync
- Manual: (a) upload 2 files → success card, View my templates routes correctly; (b) Upload
  more → clean dropzone, same category, rights unchecked; (c) sidebar Overview → New upload
  after a finished batch → clean screen; (d) mix of 1 done + 1 duplicate + 1 error → card shows
  counts, dup/err rows remain removable; (e) mid-upload navigation keeps live progress.
```

**Model:** Sonnet 5 (bitta UI fayl + kichik dashboard o'zgarishi, aniq diagnoz berilgan).

## Hidden problems (folded into the prompt)

- **P3.1** — Dashboard CTAs (`contributor-dashboard.js:134`, `:157`) bypass `startNewUpload()`.
- **P3.2** — Rights attestation (`BULK_RIGHTS`) silently persists across batches; per-batch
  re-confirmation is legally cleaner and matches the reset in `startNewUpload()`.
- **P3.3** — Mid-upload navigation must NOT clear live progress (guarded by `BULK_RUNNING`).

---

# P4 — Admin panel looks destroyed: `'" />` text everywhere, broken layout, moderation "unusable"

## Owner's report

Admin panel moderation UX is terrible and confusing — assets from contributors don't display
nicely, stray `'" />` text appears next to thumbnails, the Overview approval queue shows giant
stacked buttons for one item and tiny inline buttons for others, and the Moderation page layout
is completely scattered (cards overlapping, detail panel floating over the list). Owner wants:
simple, clean admin UX + the ability to bulk Clear pack / Approve / Reject many items at once.

## Director's code analysis (root cause confirmed — this is a BUG, not a design problem)

**One line destroys every admin surface:** `packages/assetflow-studio/js/studio-media.js:90`
(`StudioMedia.renderThumb`):

```js
return `<img src="${src}" alt="" style="${box}" onerror="this.outerHTML='${thumbArt(t.grad || "g1", t.dur || "", size).replace(/'/g, "\\'")}'" />`;
```

`thumbArt()` (admin-views.js:26) returns multi-line HTML full of **double quotes and `>`**:
`<div class="thumb g1 grain" style="...">…`. Only single quotes are escaped. Injected into the
double-quoted `onerror="…"` attribute, the browser parses it as:

1. The first `"` inside `class="thumb` **terminates the onerror attribute** at parse time.
2. The next `>` **closes the `<img>` tag** mid-string.
3. The rest of thumbArt's markup becomes **real DOM elements** (a `height:100%` div + play
   button injected into the row — this is the "giant stacked buttons" effect in Overview).
4. The trailing `'" />` renders as **visible text** — exactly what the screenshots show.

This fires wherever a template has a thumb asset (`hasAsset(t,'thumb')`), i.e. **every row**
since the ingest pipeline now always generates thumbs. Affected surfaces: admin Overview
approval queue (`admin-dashboard.js:29 qthumbHtml` → `renderThumb('lg')`), Moderation queue
list (`admin-views.js:317 adxModThumb`), All-templates tables (`admin-views2.js:68`, `:182`),
and any contributor/plugin surface calling `StudioMedia.renderThumb`.

**Key finding on the UX request:** the Moderation page ALREADY has everything the owner asked
for — checkboxes, "Select all", and a bulk bar with **Approve·Free / Approve·Pro / Reject /
Clear pack** wired to a single server call (`bulkAction()` admin-views.js:593 →
`StudioApi.bulkReview`). The owner has never seen it working because the broken markup
destroys the page before the bulk bar is usable. Fix the bug first; add only light UX polish.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Admin Console is a static SPA.
SOURCE OF TRUTH: edit ROOT packages/assetflow-studio/js/*.js, then `npm run studio:sync`.
NEVER edit build artifacts (studio/, admin/ output dirs).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: do not touch credit consume/refund, cost-quote/HMAC
  (lib/gen-quote.ts, gen-models.ts, plugin-profile.ts) or any credit value.
- English UI text; Uzbek code comments. Minimal, tight diff. No migrations.
- Do NOT loosen isPublicReadKey(). Do NOT reintroduce softenPromptForSafety.
- ⚠️ If platform/index.html or the plugin has uncommitted BATCH6/8 changes, stop and report
  instead of merging blindly.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

BUG (fix first — this alone repairs most of the "bad UX")
packages/assetflow-studio/js/studio-media.js, renderThumb(), line ~90:
  <img ... onerror="this.outerHTML='${thumbArt(...).replace(/'/g,"\\'")}'" />
thumbArt() (defined in admin-views.js:26) returns HTML containing double quotes and '>'.
Only single quotes are escaped, so the double-quoted onerror attribute is terminated early at
parse time: the <img> tag closes mid-string, thumbArt's markup leaks into the DOM as real
elements, and the trailing '" /> renders as visible text. This corrupts EVERY admin row that
has a thumb asset (Overview approval queue, Moderation list, All-templates tables) and any
other portal using StudioMedia.renderThumb.

FIX 1 — safe thumbnail fallback (studio-media.js only):
Replace the onerror-injects-HTML pattern with a wrapper + hide-on-error:
  if (t.id && hasAsset(t, "thumb")) {
    const src = escapeAttr(t.thumbUrl || assetUrl(t.id, "thumb"));
    // Uzbek comment: onerror ichiga HTML kiritish taqiqlangan — atribut buziladi (P4 bug)
    return `<span class="thumb ${escapeAttr(t.grad || "g1")} grain" style="display:block;width:${w};height:${h};border-radius:var(--r-sm);overflow:hidden">` +
           `<img src="${src}" alt="" style="${box}" loading="lazy" onerror="this.style.display='none'" /></span>`;
  }
The gradient span behind the image IS the fallback — when the img errors it hides and the
gradient shows. Do not call thumbArt() from studio-media.js at all (it also removes a hidden
cross-file dependency: studio-media.js silently depended on admin-views.js's thumbArt, which
does not exist on non-admin portals — renderThumb would throw ReferenceError in onerror there).
Keep the video-preview branch and everything else unchanged.

FIX 2 — audit for the same pattern anywhere else:
Grep the whole repo (packages/assetflow-studio/js, packages/assetflow-studio/platform/
index.html, plugins/after-effects-cep/) for: onerror=, outerHTML=, insertAdjacentHTML inside
template literals that interpolate other HTML-producing functions into ATTRIBUTE values.
Fix any instance with the same wrapper/hide technique. Report each location found in the
summary (even if already safe).

FIX 3 — light UX polish on moderation (AFTER the bug fix, keep it small):
a) Overview approval queue rows (admin-dashboard.js adminModRow): after Fix 1 the rows render
   inline correctly — verify; constrain .adx-qthumb so a missing/slow thumb can never stretch
   the row (fixed width/height + overflow:hidden in the existing class if not already).
b) Moderation page (admin-views.js renderModeration): the bulk bar currently appears only
   after the first checkbox is ticked — admins don't discover it. When items.length > 0 and
   nothing is checked, show a subtle hint row in its place: "Tip: select items (or Select all)
   to bulk Approve / Reject / Clear pack." Same position, no layout shift when it swaps to
   the real bulk bar.
c) Bulk reject is destructive and currently fires with zero confirmation (bulkAction sends
   note "Bulk reject"). Add a confirm step for 'reject' only: reuse the existing modal/confirm
   pattern used by modSoftReject in admin-views2.js if present, else a plain confirm() with
   the count ("Reject N templates?"). Do NOT add confirmation to approve/clear-pack (owner
   wants speed).
d) Do not redesign anything else. No new CSS files; reuse existing adx-* classes.

PLUGIN CHECK (required by global rules)
plugins/after-effects-cep/ — grep for renderThumb / onerror-with-inline-HTML usage. The AE
plugin bundles its own catalog rendering; if it contains the same onerror pattern, apply the
same fix there, run bash plugins/after-effects-cep/scripts/install-cep.sh, and validate with
node --check on edited JS. If the pattern is absent, state so in the summary.

VALIDATION
- node --check on every edited js file; npm run studio:sync.
- Manual: (a) admin Overview — approval queue rows compact, no '" /> text, thumbs or gradient
  fallback visible; (b) Moderation — two-pane layout intact, select all → bulk bar appears,
  bulk approve-free on 2 items succeeds via one bulkReview call; (c) kill a thumb URL (dev
  tools offline) → gradient fallback, layout intact; (d) contributor portal My templates and
  plugin catalog still render thumbs correctly (shared studio-media.js).
```

**Model:** Sonnet 5 (aniq diagnoz + bitta asosiy fayl; audit grep mexanik).

## Hidden problems (folded into the prompt)

- **P4.1** — `studio-media.js` (shared by ALL portals) silently depends on admin-only
  `thumbArt()` inside the onerror string — on contributor/plugin portals a failed thumb would
  throw `ReferenceError`. Removed by Fix 1.
- **P4.2** — Same injection pattern may exist elsewhere (platform/index.html, plugin HTML) —
  Fix 2 audits repo-wide.
- **P4.3** — Bulk reject had no confirmation (mass destructive action, one mis-click).
- **P4.4** — Bulk bar is invisible until first selection — discoverability (owner believed the
  feature didn't exist).

---

# P5 — Every portal boots slowly on refresh (admin blank screen, contributor, web, plugin)

## Owner's report

Refreshing the Admin console shows an empty shell (logo + topbar, NO nav items, NO content) for
a long time before anything appears. Same sluggish first load in Contributor Studio, the web
app, and the AE plugin.

## Director's code analysis (two layers — client boot design + infra cold start)

### Layer 1 — client: nothing renders until 6+ SEQUENTIAL API calls finish

**Admin** (`packages/assetflow-studio/admin/index.html:267 bootAdmin`):
`await StudioTemplates.init("admin")` → which internally awaits **in series**
(`studio-templates.js:275`): `loadForAdmin()` → `loadAdminContributors()` →
`loadPluginAnalytics()` → `loadAuditLogs()`; then bootAdmin continues with
`await listMessageThreads()` → `await listAdminUsers()`. Only after ALL of that does it call
`renderNav()` + `route(...)`. That's **6+ sequential round trips before the first paint** —
the screenshot's empty nav/content is exactly this window. Worse, `loadForAdmin()` calls
`listAllTemplatePages("scope=all")` (`studio-templates.js:107`) which pages through the ENTIRE
template catalog 100-at-a-time at boot — with 5 000 assets that is ~50 extra sequential
requests (the A→J server-side-catalog fix covered web+plugin Browse, but the ADMIN boot still
has a load-all-pages loop).

**Contributor** (`contributor/index.html:175 bootContributor`): same pattern —
`await StudioTemplates.init("contributor")` (pages through scope=mine) then
`await listMessageThreads()` before the first `renderNav()`/`route()`.

**Also:** `refreshAfterReview()` (`studio-templates.js:301`) re-runs 4 sequential full loads
after EVERY approve/reject — this is why each moderation decision feels slow too.

**Plugin** (`AssetFlow_Plugin.html:9486 bootPlugin`): already mostly paint-first (Home renders
before the catalog await) — verify `AssetFlow.init()` / `hydrateBlobUrls` don't block first
paint, but the plugin's slowness is mainly Layer 2.

### Layer 2 — infra: cold start (owner action, not code)

API = Cloud Run (scale-to-zero → cold start) + Neon Postgres free tier (compute auto-suspends
when idle → first query pays a multi-second resume). First request after idle pays BOTH.
No code fix — mitigations are an owner decision: Neon Launch plan (already flagged in the
handoff as a launch blocker) and/or Cloud Run `min-instances=1` (small monthly cost).
The client fix below makes the wait FEEL instant (skeletons), but the data itself cannot
arrive faster than the infra wakes.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Static SPAs (admin, contributor) + AE CEP
plugin. SOURCE OF TRUTH: edit ROOT packages/assetflow-studio/* sources, then
`npm run studio:sync`. NEVER edit build artifacts.

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: do not touch credit consume/refund, cost-quote/HMAC
  (lib/gen-quote.ts, gen-models.ts, plugin-profile.ts) or any credit value.
- English UI text; Uzbek code comments. Minimal, tight diff. No migrations.
- Do NOT loosen isPublicReadKey(). Do NOT reintroduce softenPromptForSafety.
- ⚠️ If platform/index.html or the plugin has uncommitted BATCH6/8 changes, stop and report.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

PROBLEM
All portals block their FIRST PAINT on a chain of sequential API calls:
- admin/index.html:267 bootAdmin: await StudioTemplates.init("admin") [which itself awaits
  loadForAdmin → loadAdminContributors → loadPluginAnalytics → loadAuditLogs in series,
  studio-templates.js:275] then await listMessageThreads() then await listAdminUsers(),
  and only THEN renderNav() + route(). 6+ serial round trips; on API/DB cold start the admin
  shows an empty shell for many seconds.
- loadForAdmin() → listAllTemplatePages("scope=all") (studio-templates.js:107) pages the WHOLE
  catalog 100/request at boot — O(N) requests as content grows.
- contributor/index.html:175 bootContributor: same serial pattern (init then
  listMessageThreads then first render).
- studio-templates.js:301 refreshAfterReview: 4 serial full reloads after every
  approve/reject — each moderation decision re-downloads everything.

FIX 1 — paint first, load after (admin + contributor):
Restructure both boot functions to:
  a) renderNav() + route(bootView) IMMEDIATELY (before any network call). Views already have
     skeleton helpers (adxSkelList in admin; check contributor equivalents) and their
     afterRender hooks already tolerate empty TEMPLATES — verify and keep skeletons visible
     while data is empty.
  b) Then fire the data loads in PARALLEL with Promise.allSettled:
     admin: [templates load (see Fix 2), loadAdminContributors(), loadPluginAnalytics(),
     loadAuditLogs(), listMessageThreads(), listAdminUsers()].
     contributor: [loadForContributor(), listMessageThreads()].
  c) When each settles, update what it affects: after the batch settles call renderNav() and
     re-render the CURRENT view once (route(CURRENT, null, true) or the view's render fn) —
     do NOT re-render per-promise (avoid 6 re-paints), one consolidated re-render after
     allSettled is enough, plus an early re-render when the templates load settles (it is the
     one the user is waiting for).
  d) Preserve the ADMIN_REQUIRE_2FA gate exactly: the sessionStorage check + route("settings")
     redirect must still run BEFORE the deep-link route decision (it needs no API data — keep
     it in the synchronous part).
  e) Preserve deep-link behaviour (location.hash → boot view) and the popstate handler.

FIX 2 — stop paging the whole catalog at admin boot:
In bootAdmin's parallel batch, replace the full loadForAdmin() with
loadModerationOnly() (studio-templates.js:135 — pending queue only, 1-2 requests; it is what
Overview and the Moderation default tab actually need). Load the FULL list lazily: the views
that need all templates (All templates table, Soft/All moderation filters — setModFilter
already calls loadForAdmin for soft/all) trigger loadForAdmin() on first entry. Add a simple
module flag (e.g. _fullCatalogLoaded) so repeated navigation doesn't re-page; refreshAfterReview
resets it. Verify: templates table view's afterRender calls loadForAdmin when the flag is
false; in-memory search over TEMPLATES keeps working once loaded.

FIX 3 — refreshAfterReview parallelize + slim:
Run its loads with Promise.allSettled instead of 4 sequential awaits, and use
loadModerationOnly() + loadAdminContributors() as the default post-review refresh (analytics
and audit logs do NOT need refreshing on every decision — refresh them only in the audit/
analytics views' afterRender). Keep the syncRejectReasons() call.

FIX 4 — plugin (part of every fix):
plugins/after-effects-cep/AssetFlow_Plugin.html bootPlugin (~:9486) already paints Home before
the catalog await. Verify with a timing pass: (a) nothing before the first render() awaits
network (AssetFlow.init / Local().init / hydrateBlobUrls must be local-only — if any hits the
network, move it after first paint); (b) refreshAccountFromApi and syncFavoritesFromServer stay
non-blocking (they already are — keep); (c) catalog skeleton state (catalogLoadState 'loading')
renders immediately. Fix only what violates paint-first; keep the diff tiny. After edits:
bash plugins/after-effects-cep/scripts/install-cep.sh and node --check on edited js.

DO NOT
- Do not add spinners that block interaction; skeletons only.
- Do not change API endpoints or server code in this prompt.
- Do not touch platform/index.html (web app boot is a separate BATCH6 surface; report if you
  find the same pattern there, but leave it).

VALIDATION
- node --check on every edited file; npm run studio:sync.
- Manual with devtools Network throttled to "Slow 3G": admin refresh → nav + skeletons visible
  <1s, data fills in as responses land; contributor same; approve/reject a template → decision
  toast fast, queue updates without a full 4-call reload stall.
- Deep-link test: /admin/#moderation refresh opens Moderation directly (with skeleton), 2FA
  setup gate still redirects to settings when sessionStorage flag set.
```

**Model:** Fable 5 (Medium) — boot tartibi nozik (2FA gate, deep-link, lazy katalog bayrog'i),
3 sirt (admin, contributor, plugin) kesishadi. Kvota tejash kerak bo'lsa: Opus 4.8.

## Hidden problems (folded into the prompt)

- **P5.1** — Admin boot pages the ENTIRE catalog (`listAllTemplatePages scope=all`) — O(N)
  requests at startup; the A→J server-side catalog fix never covered the admin boot path.
- **P5.2** — `refreshAfterReview` does 4 serial full reloads after EVERY approve/reject —
  moderation decisions feel slow independent of boot.
- **P5.3** — Infra cold start (Cloud Run scale-to-zero + Neon free-tier auto-suspend) is the
  other half of the slowness. NOT fixable in code. 👉 EGA QARORI: Neon Launch rejasi (handoffda
  allaqachon launch-bloker) va/yoki Cloud Run `min-instances=1` (oyiga kichik xarajat).
- **P5.4** — Web app (`platform/index.html`) may share the same boot pattern — out of scope
  here (BATCH6 parallel workstream); implementer reports findings without touching it.

---

# P6 — Web breaks on refresh: /stock stuck on "Hanging the template wall…", login says
# "Can't reach the server", sometimes the whole site dies (ERR_QUIC_PROTOCOL_ERROR)

## Owner's report

Refreshing /stock (and other tabs) leaves the catalog stuck on the loader with "0+ results".
Sometimes login shows "Can't reach the server — check your connection". Sometimes the whole
site won't open at all (Chrome: ERR_QUIC_PROTOCOL_ERROR). Also happens while generating.
Owner asks for a large-scale audit.

## Director's code analysis — THREE separate layers, each with its own cause

### Layer A — 🎯 EXACT BUG: /stock refresh never starts the catalog load

`platform/index.html` boot deep-link, the `/stock` (no asset) branch (`:18490`):

```js
this.setState({ screen: 'templates', fCat: stockLoc.pill, aiStockKind: stockLoc.sub || 'All' });
this._syncStockUrl();          // ← ensureBrowse() YO'Q!
```

Every other path into the templates screen calls `ensureBrowse()` (go('templates') :18409,
popstate :18528, asset deep-link :18077, even the catch fallback :18494) — **only the main
boot branch for a hard refresh on /stock forgot it**. `state.browse` stays null →
`browseInitLoading = (!this.state.browse) || …` (`:20990`) is **true forever** → the
"Hanging the template wall…" loader + "0+ results" never resolves. Exactly the screenshot.

### Layer B — silent dead-ends when a request fails (no retry, no error UI)

- `loadBrowse` catch (`:18947`): sets `loading:false, done:true` — grid silently gives up with
  no error message and NO retry; `ensureBrowse()` won't reload because the key matches.
- `loadCatalog` catch (`:18892`): silently marks `catalogReady:true` — Home shelves stay empty.
- `ff-api.js` is good (idempotent GETs retried 4× with backoff, 20s/attempt timeout) — but
  **login/register/google are POSTs → 1 attempt, 20s**. Cloud Run + Neon cold start regularly
  exceeds 20s → the FIRST login after idle fails with "Can't reach the server" even though the
  server was just waking up. These auth calls are safe to retry (no money side effects).
- Nothing warms the API: the user pays the full cold start at the worst moment (login click /
  first catalog paint).

### Layer C — ERR_QUIC_PROTOCOL_ERROR (infra/edge, NOT app code)

Chrome ↔ Cloudflare edge HTTP/3 (QUIC) negotiation failure on `getframeflow.app`. App code
never sees it. Typical causes: ISP/middlebox interference with UDP/QUIC (common in the region)
or transient CF edge issues. 👉 EGA QADAMI: Cloudflare dashboard → zone **Network → HTTP/3
(with QUIC) → OFF** — brauzer HTTP/2 ga tushadi, xato yo'qoladi (tezlik farqi sezilmaydi).
Kod o'zgarishi YO'Q. (Cold-start qismi esa P5.3 qarori: Neon Launch + min-instances.)

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web platform SPA =
packages/assetflow-studio/platform/index.html (edited DIRECTLY — it is the CF Pages source)
+ platform/ff-api.js. AE plugin = plugins/after-effects-cep/.

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: do not touch credit consume/refund, cost-quote/HMAC
  (lib/gen-quote.ts, gen-models.ts, plugin-profile.ts) or any credit value. The gen POST
  idempotency-key retry design in ff-api.js (P18) must stay byte-identical.
- English UI text; Uzbek code comments. Minimal, tight diff. No migrations.
- ⚠️ platform/index.html is ALSO being reworked by the parallel BATCH6 redesign. If there are
  uncommitted BATCH6 changes in the working tree, STOP and report instead of merging blindly.
- Do NOT loosen isPublicReadKey(). Do NOT reintroduce softenPromptForSafety.
- When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push.
  (b) write a short summary.

FIX A — /stock hard-refresh never loads the catalog (one-line class bug):
platform/index.html ~:18490, the boot deep-link branch for /stock WITHOUT an asset segment:
  this.setState({ screen: 'templates', fCat: stockLoc.pill, aiStockKind: stockLoc.sub || 'All' });
  this._syncStockUrl();
Add the missing this.ensureBrowse() after _syncStockUrl() (mirror the popstate branch
~:18527). Verify by refreshing /stock, /stock/video-templates, /stock/<type>/<slug>-<id>
(asset path already calls ensureBrowse in loadStockAsset).

FIX B — no silent dead-ends: error state + Retry for the browse grid:
1. loadBrowse catch (~:18947): instead of {loading:false, done:true}, set
   {loading:false, done:false, error:true, key:''} (empty key so ensureBrowse() will retry on
   next entry). Keep items already loaded.
2. In the templates grid template (~:16715 area), when browse.error && !items.length render a
   small error block instead of the loader: "Couldn't load the catalog." + [Try again] button
   calling loadBrowse(true). When error && items.length, show a slim inline "Couldn't load
   more — Retry" row (pattern already exists for catalogLoadingMore).
3. loadCatalog catch (~:18892): set a _catalogErr flag and retry ONCE automatically after 5s
   (cold start usually resolves); Home shelves already tolerate empty catalog.
Wire the flags through the same sc- template data object where catalogLoading/browseHasMore
are passed (~:21774-21780).

FIX C — auth calls must survive cold start:
ff-api.js: login/register/google/forgot/resendVerification are POSTs → 1 attempt, 20s. They
are read-only w.r.t. money and safe to retry. Pass { idempotent: true, timeout: 30000 } for
these five calls ONLY (server-side they are rate-limited by IP, 4 client attempts is fine).
DO NOT touch checkout/gen/any other POST.

FIX D — warm-up ping:
On platform boot (constructor/bootData, fire-and-forget, no await):
  FFAPI.req('/health', { auth: false, timeout: 8000 }).catch(()=>{})
so Cloud Run + Neon wake while the user is still reading the page. Verify /health exists in
apps/api (it does — used by deploy checks) and is cheap (no auth, touches db lightly).

FIX E — audit (report + tiny fixes only):
1. Gen flow on refresh: refresh mid-generation → does the job reappear and resume polling
   (loadHistory/loadSessions + activeJobs restore)? If a running job is orphaned client-side
   (never re-polled), fix by re-attaching poll timers for status:'running' items on boot.
2. Grep platform/index.html for other await-then-silent-catch patterns on boot-critical loads
   (loadModels, loadPluginMe, refreshCredits, loadProjects) — each should either retry once or
   surface a non-blocking toast, never a permanent dead-end. Fix only cheap ones; list the rest.
3. Report (do not fix): any other screen that renders a loader from a state flag with no
   error/timeout escape hatch.

PLUGIN CHECK (required by global rules)
plugins/after-effects-cep/: the plugin catalog already has catalogLoadState='error' + Retry
(AssetFlow_Plugin.html bootPlugin) — verify the Retry button actually calls refreshBrowse and
recovers after a failed cold start (simulate by pointing env at an unreachable API). Check
assetflow-client.js request layer for a cold-start timeout shorter than 20s; align if needed.
If changes made: bash plugins/after-effects-cep/scripts/install-cep.sh + node --check.

OUT OF SCOPE (owner infra actions — do not attempt in code):
- ERR_QUIC_PROTOCOL_ERROR: Cloudflare zone Network → disable HTTP/3/QUIC (owner does this in
  the CF dashboard).
- Cold start elimination: Neon Launch plan / Cloud Run min-instances=1 (owner decision, P5.3).

VALIDATION
- Refresh /stock with warm API → grid loads; with devtools "Offline" → error block + Try again
  works after going online.
- Login with devtools throttled → no instant "Can't reach the server" before ~60s of retries.
- node --check on ff-api.js (and any edited plugin js). No studio:sync needed for platform/
  (direct source) — but run it if any packages/assetflow-studio/js file was touched.
```

**Model:** Sonnet 5 — diagnoz aniq (bitta yo'qolgan qator + kichik retry qatlamlari). Agar
FIX E auditida gen-poll tiklash murakkab chiqsa, o'sha qismini alohida Fable 5 promptiga ajrat.

## Hidden problems (folded into the prompt)

- **P6.1** — `loadBrowse`/`loadCatalog` failures are silent dead-ends (no error UI, no retry;
  `ensureBrowse` sees a matching key and never reloads).
- **P6.2** — Auth POSTs get 1 attempt × 20s — guaranteed to lose against a 20s+ cold start.
- **P6.3** — No warm-up ping: the user's first click always pays the full cold start.
- **P6.4** — Refresh mid-generation may orphan the client-side poll (audited in FIX E).
- **P6.5** — QUIC/HTTP3 edge failures look like "the site is dead" but never reach app code —
  owner disables HTTP/3 on the Cloudflare zone (dashboard, not code).
  ✅ DONE (2026-07-14): owner disabled HTTP/3 (with QUIC) via Speed → Settings → Protocol
  Optimization. ✅ "Always Use HTTPS" enabled by owner (2026-07-14).
- **P6.6 — ORDERING:** run AFTER P5 is merged if both touch shared boot ideas; P5 explicitly
  does not touch platform/index.html, so there is no file conflict, but both prompts must not
  run simultaneously in two Code sessions.

---

# P7 — Icons and user avatars randomly disappear (web, plugin, admin)

## Owner's report

Sometimes icons vanish everywhere (web + plugin), the user's profile picture disappears too,
and the whole site behaves strangely.

## Director's code analysis

**Primary suspected cause — the network/edge layer (P6.5), already mitigated today.**
Intermittent QUIC/HTTP3 failures didn't only kill full page loads — they silently failed
SUBRESOURCE loads: icon font files, avatar redirects, thumbs. When a font/image request dies,
the page renders but icons/avatars are blank → "everything looks weird". HTTP/3 was disabled
on 2026-07-14; expect this to mostly stop. The items below are REAL hardening gaps that make
such blips visible instead of gracefully recovered.

**Per-surface icon reality check:**
- Web platform: icons are an INLINE SVG sprite (`<use href="#i-…">`) — cannot disappear;
  only text fonts (self-hosted woff2, relative path) can fail → layout looks odd but icons stay.
- Admin: icons are the **Phosphor icon FONT** (self-hosted `/assets/fonts/*.woff2`,
  `font-display:block`, `styles/admin.css:49-55`). If a font file request fails, EVERY admin
  icon renders blank for the whole session — matches "icons gone everywhere" in admin. (Also
  note: the P4 markup-explosion bug makes admin look broken independently — both must land.)
- Plugin: no icon font (inline markup) — the plugin symptom is avatars, not icons.

**Avatar — real bugs found:**
1. Avatar URL is `https://api.getframeflow.app/api/auth/avatar/<userId>` → **every render hits
   the API** (Cloud Run + Prisma + GCS sign + 302). Cold API or a network blip = broken avatar.
   The 302 carries `Cache-Control: private, max-age=300` (auth.ts:767) — only 5 min of shelter.
2. **Plugin `afApplyAvatar` (AssetFlow_Plugin.html:8967-8980) has NO failure fallback and even
   DESTROYS the fallback**: it does `acc.textContent=''` then sets `background-image` — if the
   image fails to load, the avatar is an EMPTY circle (the initial letter was just wiped).
   CSS background-image failures are silent (no onerror).
3. Web/studio surfaces render avatar `<img>`/background without an initials fallback either
   (verify each: platform account chip, studio sidebar user-chip, admin topbar).

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Surfaces: web platform
(packages/assetflow-studio/platform/index.html — direct source), studio SPAs
(packages/assetflow-studio/js|styles ROOT sources + npm run studio:sync), AE plugin
(plugins/after-effects-cep/, no internet assets, install-cep.sh after edits).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN (credit consume/refund, cost-quote/HMAC, credit values).
- 🔴 Do NOT loosen isPublicReadKey() — do NOT move avatars into the CDN worker allow-list in
  this prompt (flag it as an option in the summary instead; owner decides).
- English UI text; Uzbek code comments. Minimal diff. No migrations.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or the plugin → stop and report.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — plugin avatar fallback (the empty-circle bug):
plugins/after-effects-cep/AssetFlow_Plugin.html, afApplyAvatar (~:8967):
Never clear the initial before the image is KNOWN to load. Preload pattern:
  const img = new Image();
  img.onload  = () => { /* set background-image on acc + .ai-ava/.hd-ava/.af-tb-ava */ };
  img.onerror = () => { /* leave/restore initials fallback (textContent=initial, bg='') */ };
  img.src = url;
Keep the cache-bust (__afAvaBust) behaviour. Initials must also be the immediate state while
loading. node --check + install-cep.sh after edit.

FIX 2 — web + studio avatar fallback:
Find every avatar render on: platform account chip / account screen (platform/index.html),
studio sidebar user-chip (contributor + admin shells), admin topbar. For <img> avatars add
onerror="this.style.display='none'" over an initials block that sits behind the image (same
wrapper technique as P4 Fix 1); for background-image avatars use the Image() preload pattern
from Fix 1. One tiny shared helper per codebase is fine; do not redesign the chips.

FIX 3 — avatar endpoint cacheability (small server change, apps/api/src/routes/auth.ts:751):
The signed URL TTL is 3600s but the redirect is cached only 300s. Set
Cache-Control: private, max-age=1800 on the 302 (half the sign TTL — safe margin), so a warm
browser stops re-hitting the API on every render. Do NOT make it public; do NOT touch the
upload route. (This is not the money zone.)

FIX 4 — admin icon font resilience (styles/admin.css + admin/index.html shell):
Add <link rel="preload" as="font" type="font/woff2" crossorigin> for the three Phosphor woff2
files in the admin shell <head> so the fonts load early and failures surface in devtools.
Keep font-display:block (icon fonts must not swap). Report (don't fix) if the deployed
/assets/fonts/ path 404s in the CF Pages build script (scripts/prepare-cf-pages.mjs copies).

VALIDATION
- Plugin: devtools offline → avatar shows initial letter (not empty circle); online → photo.
- Web/studio: block api.getframeflow.app in devtools → initials everywhere, no broken-img
  glyphs; unblock + reload → photos return.
- node --check on all edited js; npm run studio:sync for studio sources.
```

**Model:** Sonnet 5 (kichik, aniq nishonlar; server o'zgarishi bitta header).

## Hidden problems (folded into the prompt)

- **P7.1** — Plugin `afApplyAvatar` wipes the initials THEN sets a bg image that can silently
  fail → guaranteed empty avatar on any network blip.
- **P7.2** — Avatar 302 cached only 5 min while the signed URL lives 60 min — every render
  window hits the cold-startable API.
- **P7.3** — Admin is the only surface on an icon FONT (Phosphor); one failed font fetch
  blanks every icon for the session. Web is immune (inline sprite) — long-term option:
  migrate admin to the same inline sprite (BATCH8 candidate, not this prompt).
  ⚠️ CORRECTED by P21 (2026-07-14): the WEB platform ALSO self-hosts Phosphor fonts (105+
  `.ph` usages) — it is NOT immune. See P21 for the watchdog fix.
- **P7.4** — Root trigger was almost certainly the QUIC edge failures (P6.5, disabled
  2026-07-14). If symptoms persist after a few days, re-open with fresh devtools evidence.

---

# P8 — Catalog cards show "Ae" for EVERYTHING (Motion Graphics, AI Stock, Music…) — needs
# a type-aware badge per category

## Owner's report

In the Stock Catalog every card carries the same "● Ae" badge — AE templates, Motion Graphics
and AI Stock all look identical. Each category needs its own icon/badge.

## Director's code analysis

The badge is the **application** label, and everything falls back to After Effects:

- **Web** (`platform/index.html` `mapCatalogItems` ~:18963):
  `a: APP_L[it.templateApp] || 'Ae', ac: APP_C[it.templateApp] || '#b794f6'` — stock items
  (motion-graphics, graphics, luts, music, sfx, ai-stock) have no meaningful `templateApp`,
  so they ALL render "● Ae". Card markup: `<span class="sub"><i style="background:{{ t.ac }}">
  </i>{{ t.a }}</span>` (5 places: :16571, :16600, :16628, :16656, :16735).
- **Plugin** (`AssetFlow_Plugin.html` `ffAppInfo` :5108): unknown/empty app → `FF_APPS.ae`,
  used on cards (:7212) and detail (:5204, :5531, :5967). Same wrong "Ae" for stock.
- The server catalog already returns `type` (templateType), `kind`, `stockType` on every item
  (BATCH3 S1 — verified live), and the web already maps `type` (:18979). The data is there;
  only the badge logic ignores it.
- Admin already solves this correctly with `kindTypeLabel()` — reuse the concept, not the code.

**Badge design (approved defaults — implementer follows this table):**

| templateType | Badge label | Dot color |
|---|---|---|
| video-templates | app label as today (Ae/Pr/Mn/Dr from templateApp) | app color as today |
| motion-graphics | Motion | #5CC8B0 |
| graphics | Graphic | #7CC4FF |
| luts | LUT | #FFB27C |
| music | Music | #F0907F |
| sfx | SFX | #E5C07B |
| ai-stock | AI | #C2F04A |

Rationale: the app badge only means something for project-file templates (which app opens
it); for raw-media stock the TYPE is the identity.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Surfaces: web platform
(packages/assetflow-studio/platform/index.html — direct CF Pages source) + AE plugin
(plugins/after-effects-cep/AssetFlow_Plugin.html, no internet assets).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN (credit consume/refund, cost-quote/HMAC, credit values).
- English UI text; Uzbek code comments. Minimal, tight diff. No migrations, no server changes
  (the catalog already returns type/kind/stockType).
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or the plugin → stop and report.
- Do NOT loosen isPublicReadKey(). Do NOT renumber @N reference tokens.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM
Catalog cards show the APPLICATION badge ("● Ae") for every item because stock types have no
templateApp and both clients fall back to AE:
- Web: mapCatalogItems (platform/index.html ~:18963) → a/ac from APP_L/APP_C with 'Ae' fallback.
- Plugin: ffAppInfo (AssetFlow_Plugin.html :5108) → FF_APPS.ae fallback; used at :7212 card
  renderer and detail views :5204/:5531/:5967.
Server items carry type (templateType) / kind / stockType — use them.

FIX — type-aware badge, one table, both clients:
Badge table (label + dot color):
  video-templates → keep today's app badge (Ae/Pr/Mn/Dr + app color from templateApp)
  motion-graphics → 'Motion'  #5CC8B0
  graphics        → 'Graphic' #7CC4FF
  luts            → 'LUT'     #FFB27C
  music           → 'Music'   #F0907F
  sfx             → 'SFX'     #E5C07B
  ai-stock        → 'AI'      #C2F04A

1. WEB: in mapCatalogItems compute a/ac via a small helper typeBadge(it): if
   (it.type || 'video-templates') === 'video-templates' → current APP_L/APP_C logic; else the
   table above. No template markup changes needed (cards read t.a/t.ac already). Check the
   DETAIL view + lightbox meta line for a hardcoded app label and route it through the same
   helper. Also check the '9:16/1:1/16:9' + '4K/HD' chips are untouched.
2. PLUGIN: add the same mapping next to FF_APPS (mirror comment "server apps.ts + web
   typeBadge bilan mos"). Where cards/detail call ffAppInfo, first branch on the item's
   templateType/nav: stock types use the type badge; video-templates keep ffAppInfo. NOTE:
   the plugin already has NAV_LABELS (:5096) — reuse those keys; keep the existing
   LUTs→DaVinci hint ONLY inside the video-templates/app branch (ffAppInfo :5112) so it no
   longer hijacks LUT stock items.
3. CONSISTENCY: same label casing and colors in both clients (token-first: if the plugin/web
   has theme tokens for these hues, use the token var with the hex as fallback).
4. Filters must NOT change — this is display-only. Do not touch _browseParams/pillTypes.

VALIDATION
- Web /stock: All pill → AE template shows "Ae", motion graphics shows "Motion", AI stock
  shows "AI" (lime dot). Detail page badge matches the card.
- Plugin Browse: same items same badges; video template import flow unchanged.
- node --check on edited plugin js (if any .js touched); install-cep.sh; no studio:sync needed
  unless packages/assetflow-studio/js was touched.
```

**Model:** Sonnet 5 (displey-mantiq, ikki fayl, jadval berilgan).

## Hidden problems (folded into the prompt)

- **P8.1** — Plugin's `ffAppInfo` LUTs→DaVinci hint (:5112) currently hijacks LUT STOCK items
  into an app badge; after the fix it must only apply to actual project-file templates.
- **P8.2** — Detail views (web detail/lightbox, plugin detail :5204/:5531/:5967) repeat the
  app label independently of the card — all routed through the same helper or they'll drift.
- **P8.3** — Filters/pills use separate server params (`pillTypes`/`_browseParams`) — display
  fix must not touch them.

---

# P9 — AI Studio gen cards: gradient flash on every refresh + cards spontaneously go
# black/blank after a while (owner reported this before; V1 never captured it)

## Owner's report

1. On page refresh, ALL gen cards (My Library grid, session sidebar thumbs, Projects tab
   cards) flash as empty gradients for a moment, then the images appear.
2. From time to time, with the tab just sitting open, gen cards LOSE their images and turn
   dark/blank on their own.
3. This was reported earlier but the previous director never added it to the V1 doc — treat
   it as new, with the cause pinned down precisely.

## Director's code analysis (cause confirmed in code)

**The single root cause: gen display images use 1-HOUR signed GCS URLs instead of the stable
CDN, so they expire in the open tab and defeat the browser cache on every refresh.**

- `hydrateGenAssets` (`apps/api/src/routes/studio-gen.ts:128`):
  `const sign = (key, name) => getSignedDownloadUrl(key, 3600, name)` — and lines 136-140 sign
  `displayUrl` / `previewUrl` / `thumbUrl` (the DISPLAY derivatives) with that same 1-hour
  signed URL.
- But those very derivatives are ALREADY in the public CDN allow-list
  (`lib/public-keys.ts:42`): `gen/<uid>/*-thumb.jpg`, `*-poster.jpg`, `*-preview.mp4`,
  `*-disp.<ext>` are served by `cdn.getframeflow.app` (Worker). The stock CATALOG already uses
  `getPublicOrSignedUrl()` (`catalog-map.ts`) and therefore gets stable CDN URLs — the gen
  pipeline never got the same treatment.

**Why this produces BOTH symptoms:**

1. **Spontaneous blackening:** signed URL dies after 60 min. Any re-render, lazy-load,
   virtualization re-mount, or hover-preview after that hits an expired URL → image request
   403s silently → card falls back to its gradient/dark base. The window-focus refetch
   (`bootData` focus listener) only helps when focus is LOST and regained; a tab that stays
   focused (user working >1h) expires in place.
2. **Gradient flash on refresh:** every `loadHistory`/`loadSessions` response carries NEW
   signed URLs (different query signature each time) → the browser cache can NEVER be used →
   every refresh re-downloads every image from GCS → cards sit as gradients until each image
   arrives (worse on cold start). Stable CDN URLs are cacheable → warm refresh paints
   instantly from cache.

**Secondary finding (old sessions stuck as gradients even after loading):** gens created
BEFORE the derivative pipeline have `thumbKey`/`displayKey` = null; `hydrateGenAssets:140`
now intentionally returns `thumbUrl: null` for them (no clean-original fallback — owner's
plan-gate decision). Those cards will stay gradient FOREVER until derivatives are backfilled.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Server: apps/api (Express+Prisma+GCS).
Web: packages/assetflow-studio/platform/index.html (direct source). Plugin:
plugins/after-effects-cep/ (AI Studio surface exists for USER role).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN (credit consume/refund, cost-quote/HMAC, credit values).
- 🔴 hydrateGenAssets PLAN GATE (paid=clean original / free=watermark-or-small-derivative,
  invariants 1-3 in its doc comment) MUST NOT CHANGE — this prompt only changes WHICH URL
  SCHEME serves the DISPLAY derivatives (thumb/display/preview/poster). url/downloadUrl logic
  stays byte-identical.
- 🔴 Do NOT loosen isPublicReadKey() — gen display derivatives are ALREADY allow-listed
  (public-keys.ts:42); you are consuming the existing list, not extending it.
- English UI text; Uzbek code comments. Minimal diff. Migrations: none.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): reproduce & fix each symptom in the plugin too, or
  state explicitly why the surface doesn't exist there.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — serve gen DISPLAY derivatives via the stable CDN (server):
apps/api/src/routes/studio-gen.ts hydrateGenAssets (~:122-181):
Lines 136-140 currently sign displayUrl/previewUrl/thumbUrl with
getSignedDownloadUrl(key, 3600). Change ONLY these display-derivative signings to
getPublicOrSignedUrl(key, 3600) (already imported at :42). Effect: allow-listed derivative
keys return a stable https://cdn.getframeflow.app/<key> URL (cacheable, never expires);
non-allow-listed keys keep falling back to signed URLs automatically. DO NOT change:
- the paid/free plan gate for a.url / downloadUrl (original + watermark stay SIGNED/private),
- the FREE small-derivative fallback branch (:157-160) — it serves a derivative AS THE MAIN
  url; that url may now come back public via getPublicOrSignedUrl — verify this is acceptable
  by checking the FREE invariant: it must never expose resultKey. It doesn't (smallKey is a
  derivative). Keep watermarkKey signing as-is (watermark files are NOT in the allow-list).
Also check projects.ts (it reuses hydrateGenAssets per its comment) and the sessions list
endpoint — both should inherit the fix automatically; verify no other code path signs
thumbKey/displayKey/previewKey/posterKey with getSignedDownloadUrl directly (grep).

FIX 2 — instant paint on refresh (web client):
platform/index.html: cache the last history/sessions/projects payloads in sessionStorage
(key per user id; cap ~200KB, JSON). On boot, if cache exists render it IMMEDIATELY, then
loadHistory/loadSessions/loadProjects refresh in the background and overwrite. With FIX 1 the
cached CDN image URLs remain valid, so cards paint instantly from browser cache instead of
flashing gradients. Invalidate the cache on ff-auth-expired and on logout.

FIX 3 — image failure must not look like "the card died" (web client):
Gen card media (grid, session sidebar thumb, lightbox poster) should get a lightweight
onerror retry-once (re-request without cache) then a small "media unavailable" overlay instead
of silently showing the gradient. Reuse one helper; do not redesign cards.

FIX 4 — old gens without derivatives (report + optional backfill):
Count GenAssets where resultKey != null AND thumbKey IS NULL AND displayKey IS NULL (SQL via
prisma). Report the count in the summary. If a derivative-generation utility already exists in
gen-processor.ts, add a small idempotent script scripts/backfill-gen-derivatives.mjs (batch,
resumable, dry-run flag) but DO NOT run it against prod — the owner runs it manually.

PLUGIN CHECK (required):
The AE plugin's AI Studio (USER role) renders gen history/results from the same endpoints —
verify its cards get the CDN URLs after FIX 1 (no client change should be needed), and add
the same onerror fallback if its gallery lacks one. NOTE the plugin has NO internet-loaded
STATIC assets rule — CDN media URLs from the API are fine (same as today's signed GCS URLs).
node --check + install-cep.sh if the plugin is edited.

ORDERING NOTE (director): P1 (watermark rework) will ALSO edit hydrateGenAssets. If P1 has
already landed, adapt line numbers; if not, keep this diff minimal so P1 rebases cleanly.

VALIDATION
- Fresh gen → card image URL host is cdn.getframeflow.app (derivative) while Download URL is
  a signed storage URL (paid) / watermark-or-derivative (free) — plan gate intact.
- Leave the tab open >60 min (or mock: set sign TTL to 60s locally) → cards DO NOT blacken.
- Refresh: cards paint instantly from sessionStorage + browser cache; no gradient flash on a
  warm reload.
- Old gen without derivatives: card shows the "media unavailable" state, not an eternal
  gradient; backfill script dry-run lists it.
```

**Model:** Fable 5 (Medium) — hydrateGenAssets pul-darvozasiga tutash (plan gate invariantlari
buzilmasligi kerak) + server/klient/plagin kesishmasi. Kvota tejash: Opus 4.8.

## Hidden problems (folded into the prompt)

- **P9.1** — Signed-URL churn defeats the browser cache on EVERY load — the flash is a
  bandwidth bug too (every refresh re-downloads every gen image from GCS; CDN fixes cost).
- **P9.2** — Old gens (pre-derivative pipeline) have null thumb/display keys → permanent
  gradient; needs a one-off backfill (script provided, owner runs).
- **P9.3** — Focus-refetch only fires on regained focus; a continuously focused tab expires
  in place (root cause of "o'zidan o'zi qorayadi").
- **P9.4** — `hydrateGenAssets` is shared with projects.ts and sessions — fix once, verify
  all three consumers.
- **P9.5** — ORDERING: P1 watermark rework edits the same function — coordinate (P1 first is
  cleaner; if P9 lands first, keep the diff surgical).

---

# P10 — Catalog hover-preview video: on mouse-leave the video freezes on a frame instead of
# returning to the poster image

## Owner's report

Hovering a template card starts the preview video (good). Moving the mouse away, the card
stays FROZEN on whatever video frame it stopped at — it should return to the preview image
(poster). Some cards (e.g. "Fast Light Leaks Logo Intro") end up looking like a dark/blank
card because the video's first frame is dark.

## Director's code analysis

`platform/index.html` `installMediaFx()` (`:18672-18691`):

```js
host.addEventListener('mouseleave', () => {
  try { vid.pause(); vid.currentTime = 0; } catch (e) {}
});
```

Once a `<video>` element has loaded data, the `poster` attribute is NEVER shown again —
`pause() + currentTime=0` displays **frame 0 of the video**, not the poster image. For clips
whose first frame is black (logo intros, light leaks), the card looks dead. This is standard
HTMLMediaElement behaviour: the only ways to get the poster back are (a) `load()` (resets the
element to its initial state) or (b) an `<img>` poster overlay.

Ten card templates use `video.va-hovplay` (grid/shelves/related: :16392, :16498, :16560,
:16589, :16617, :16645, :16724, :16864, :17259) in two variants: catalog cards use lazy
`data-src` (src set on first hover), gen cards use direct `src=`.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web platform:
packages/assetflow-studio/platform/index.html (direct CF Pages source). Plugin:
plugins/after-effects-cep/ (Browse cards also hover-play previews — parity required).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes.
- English UI text; Uzbek code comments. Minimal diff.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): reproduce & fix the same symptom in the plugin, or state
  explicitly that the surface doesn't exist there.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM
platform/index.html installMediaFx() :18685-18688 — mouseleave does pause()+currentTime=0.
A <video> that has loaded data never shows its poster again; the card freezes on video frame
0 (dark for many clips). Owner wants: mouse leaves → poster image returns.

FIX (web):
In the mouseleave handler, reset the element so the poster re-renders:
  try {
    vid.pause();
    // Uzbek comment: poster qaytishi uchun elementni boshlang'ich holatga qaytaramiz
    if (vid.getAttribute('data-src')) vid.removeAttribute('src'); // lazy variant
    vid.load(); // src bo'lsa ham load() posterni qaytaradi (buffer bekor bo'ladi — kesh arzon)
  } catch (e) {}
Notes:
- data-src variant: mouseenter already re-sets src on next hover (:18680-18681) — verified.
- direct-src variant (gen cards): keep src, load() alone restores the poster.
- Preview URLs are CDN/long-cache (catalog) so a re-hover re-fetch hits browser cache — no
  meaningful bandwidth cost. After P9 lands, gen previews are CDN too.
- Guard against races: if the user re-enters within the same tick, the mouseenter handler
  runs after load() — play() after setting src handles it; test rapid in/out hovering.
- Also verify the audio hover/lightbox paths are untouched, and that the detail page's main
  player (studio-preview-video / player-bar) is NOT affected (installMediaFx only binds
  .va-hovplay).

PLUGIN CHECK (required):
The AE plugin Browse grid also hover-plays previews (grep the plugin for hover play/pause on
card video elements — e.g. mouseenter/mouseleave + video in AssetFlow_Plugin.html /
assetflow-catalog.js). If it has the same pause-without-poster behaviour, apply the same
load() reset; validate node --check + install-cep.sh. If the plugin uses static thumbs only
(no hover video), state that in the summary.

VALIDATION
- Hover a video card → plays; leave → poster image returns (not a frozen/dark frame).
- Rapid hover in/out 5× → no stuck black card, no console errors.
- Scroll a virtualized list (item reuse) → posters correct after reuse.
- Detail page player unaffected; audio cards unaffected.
```

**Model:** Sonnet 5 (bitta handler + plagin pariteti; xatti-harakat aniq belgilangan).

## Hidden problems (folded into the prompt)

- **P10.1** — Two variants of the same card video (lazy `data-src` vs direct `src`) need
  slightly different resets — one shared handler must cover both.
- **P10.2** — `load()` aborts buffering; safe only because preview URLs are long-cache CDN
  (catalog now, gens after P9). Re-hover cost ≈ 0.
- **P10.3** — Virtualized/reused list items: the mouseenter handler already re-checks
  `data-src` per hover; the fix must not break that.

---

# P11 — Dashboard (#dashboard) is a mess: "Trending this week" renders as tall stacked
# duplicates; every shelf shows the same 4 assets

## Owner's report

The home dashboard looks chaotic and ugly. "Trending this week" shows each card repeated
~9 times in tall vertical stacks. Needs fixing.

## Director's code analysis

**Two independent problems compound here:**

### A) The Trending shelf block is DUPLICATED in the DOM (render bug, not data)

Source markup is correct: ONE `va-shwrap` → ONE horizontal `va-sh` flex row (max 10 cards,
`:16581-16608`), CSS `.va-sh{display:flex;overflow-x:auto}` `.va-sh .va-rc{width:296px}`
(`:15132-15134`) — a single row that scrolls. It CANNOT legally render as vertical stacks.

Screenshot evidence: the right-edge shelf arrow (`va-sharrow`) appears once PER STACKED ROW —
i.e. the DOM contains ~9 copies of the whole `va-shwrap` block stacked vertically, each
showing its first ~4 cards (PW, CP, PW, WC — hence identical columns). The custom `sc-if`/
`sc-for` template runtime is APPENDING a fresh copy of the shelf on re-renders instead of
replacing it (likely when `hasTrend`/`shelvesLoading` flips or on repeated setState passes
during boot). The neighbouring shelves ("Overlays essentials", "New this week") escaped this
time, which fits a conditional-block (`sc-if`) diffing bug rather than a data problem —
`shelfTrend` itself is a clean `slice(0,10)` (`:21207`).

⚠️ Deployed site may lag the repo (unpushed commits) — the implementer must reproduce against
the CURRENT source first; if it doesn't reproduce locally, diff against the deployed bundle
before concluding.

### B) Content scarcity + duplicates make every shelf identical (data/UX)

The catalog currently has ~4-5 unique assets, some approved MULTIPLE times (same "Plastic
Wrap Overlay" uploaded repeatedly — visible in the moderation queue earlier). Result:
"Recommended", "Trending", "Overlays essentials", "New this week" are four near-identical
rows of the same 4 thumbnails — ugly even without the render bug.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web platform:
packages/assetflow-studio/platform/index.html (direct CF Pages source; contains a custom
sc-if/sc-for template runtime). Plugin: plugins/after-effects-cep/ (Home shelves exist there
too — parity required).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations. English UI; Uzbek code comments. Minimal diff.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): reproduce & fix in the plugin too, or state why the
  surface doesn't exist.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM A — Trending shelf DOM duplication (primary bug):
Live #dashboard renders ~9 stacked copies of the ENTIRE "Trending this week" va-shwrap block
(evidence: one va-sharrow per stacked row). Source markup/CSS are correct single-row
(index.html :16581-16608, CSS :15131-15134). Suspect the sc-if/sc-for runtime appends instead
of replacing when a conditional block re-evaluates (hasTrend/shelvesLoading flip during boot:
skeleton → shelves, plus focus-refetch loadCatalog re-render).
STEPS:
1. Reproduce: load #dashboard with a real (or seeded) catalog; force multiple re-renders
   (toggle catalogReady, call loadCatalog twice, window focus events). Inspect DOM: count
   .va-shwrap under the Trending section.
2. Find the diff bug in the sc-if / sc-for implementation (search the inline runtime for how
   conditional placeholders reconcile children). Fix the RECONCILIATION (replace, don't
   append). Keep the fix generic — the same bug likely affects other sc-if blocks (Recommended
   :16554-16576 wraps in sc-if too).
3. If it does NOT reproduce from source, build/diff against the deployed bundle (the repo may
   be ahead of prod) and state clearly whether the fix is "already fixed, needs push" or a
   real bug. Do not guess.

PROBLEM B — shelves look identical with a tiny catalog (UX):
index.html :21203-21220 (recTemplates/shelfTrend/shelfCat/shelfNew slices):
1. DEDUP each shelf by normalized (name + contributor) so re-uploaded copies of the same
   asset appear once per shelf (keep newest).
2. SMALL-CATALOG MODE: compute uniqueCount over the deduped catalog; if < 8, render ONLY
   "Recommended for you" (up to 8 cards) and HIDE Trending/Category/New shelves entirely —
   four identical rows of 4 thumbnails is worse than one honest row. Add an Uzbek code
   comment explaining the threshold.
3. Do NOT change the catalog API or the browse grid.

PLUGIN CHECK (required):
The AE plugin Home also renders shelves from the same catalog. Verify: (a) does its shelf
renderer duplicate blocks on re-render (same evidence test)? (b) apply the same dedup +
small-catalog collapse to its Home shelves if it slices client-side. node --check +
install-cep.sh if edited.

VALIDATION
- #dashboard with catalog of 4-5 items (some duplicated names): ONE Recommended row, no
  Trending/New sections, no stacked duplicates after 5 forced re-renders + 3 focus events.
- Seed >8 unique items locally: all shelves return, each deduped, single va-shwrap each.
- Browse grid (/stock) unaffected; detail related-row unaffected.
```

**Model:** Fable 5 (Medium) — sc-if/sc-for runtime'dagi reconciliation bug'ini topish kerak
(18k-qatorli faylda maxsus framework); B qismi oson lekin A diagnostika talab qiladi.

## Hidden problems (folded into the prompt)

- **P11.1** — The sc-if append-instead-of-replace bug (if confirmed) is LATENT ON EVERY
  CONDITIONAL BLOCK — fixing only Trending would leave time-bombs; the fix must be in the
  runtime's reconciliation.
- **P11.2** — Catalog contains duplicate APPROVED copies of the same asset (contributor
  re-uploads) — admin-side reality; shelf dedup treats the symptom. 👉 EGA ESLATMASI: katalogni
  to'ldirishda bir xil faylni qayta-qayta approve qilmang — P4 bulk-moderatsiya bilan
  dublikatlarni rad eting (server "duplicate" skani faqat BOSHQA contributor'dan ayni faylni
  ushlaydi).
- **P11.3** — Deployed bundle may lag the repo (unpushed commits) — reproduction must
  distinguish "already fixed, push it" from "live bug".
- **P11.4** — 🔴 LAUNCH BLOCKER reminder (handoff): landing claims "5000+ templates" while the
  catalog has ~5 — the dashboard will keep looking empty/ugly until content lands, no matter
  what code does.

---

# P12 — FEATURE: pin/unpin gen models in the model picker + persist last-used composer
# parameters across refresh (web + plugin). Prompt text is NOT persisted.

## Owner's request

1. In the AI Studio model picker: let the user PIN a model (and unpin it). Pinned models rise
   to the top of the picker.
2. After a page refresh, the user's LAST-CHOSEN composer parameters must be restored — model,
   aspect/resolution, settings — but NOT the prompt text.
3. Both web AND plugin.

## Director's code analysis

- Web (`platform/index.html`): selection lives in ephemeral state — `selModel` (per-mode map,
  `:17951`, chosen via `pickModel` rows `:16992/:17047`, resolved `:19496`), plus composer
  params (`aiSize` aspect/res, `aiTool`, enhance toggle). All lost on refresh; `selModel`
  reset on logout (`:19451`, `:19480`). Nothing is persisted today.
- Model list comes from the server (`genModels`, `GET /gen/models`) — a persisted choice may
  reference a model that was later disabled; restore MUST validate against the live list and
  fall back to the default (money-safe: the cost-quote flow re-prices whatever is selected,
  so persistence cannot corrupt pricing).
- Plugin already has a prefs mechanism (`loadUserPrefs()` in `AssetFlow_Plugin.html`) — extend
  it rather than inventing a second store.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (direct source). Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html (has
loadUserPrefs / prefs persistence already).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: model choice feeds the signed cost-quote flow — persistence must
  NEVER bypass or cache quotes/prices. Restore selection only; the existing quote flow
  re-prices as usual. Do not touch gen-quote/gen-models/computeGenCost.
- English UI text; Uzbek code comments. Minimal diff. No migrations, no server changes.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): implement in BOTH clients in this one prompt.
- Do NOT renumber @N reference tokens; do NOT touch the reference pool.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FEATURE 1 — pin/unpin models (both clients):
- Storage: localStorage key `ff_gen_pins:<userId>` = { <mode>: [modelId, …] } (plugin: same
  shape inside its existing prefs object).
- Picker UI: a small pin icon on each model row (right side, before/next to the price).
  Click toggles pin WITHOUT selecting the model (stopPropagation). Pinned models sort to the
  top of their mode's list (pinned order = pin time, newest first), with a subtle "pinned"
  divider or icon state. Unpin = same icon toggled.
- Pins referencing models no longer in the server list are silently dropped on load.
- Web picker locations: model rows :16992 and :17047 (both render paths share pickModel —
  add one shared pin handler). Plugin: the BATCH5/6 model picker in AssetFlow_Plugin.html —
  find its row renderer and add the same control (inline SVG icon, no internet assets).

FEATURE 2 — persist last-used composer params (both clients):
- Storage: localStorage `ff_gen_prefs:<userId>` = { selModel: {mode→modelId},
  aiSize/aspect+resolution per mode, aiTool (last tool), enhance on/off, and the plugin's
  equivalent chips }. EXCLUDE: prompt text, reference images/videos/audios, session id.
- Save: debounced (300ms) on every relevant setState change (hook into pickModel, size/aspect
  pickers, tool switch, enhance toggle) — one tiny helper, not scattered writes.
- Restore: on boot AFTER genModels load — validate each saved modelId against the live list
  (per mode); invalid → default (list[0]) exactly as today. Restore aspect/res through the
  SAME clamp logic pickModel uses (:19507 comment — aspect must be clamped to what the model
  supports; reuse, don't duplicate).
- Logout / account delete (:19451, :19480): clear both keys for that user.
- ff-auth-expired: keep the keys (same user will log back in).

VALIDATION
- Pick model B, 9:16, 2K, Enhance off → refresh → composer shows model B, 9:16, 2K, Enhance
  off, EMPTY prompt. Cost chip re-quotes normally.
- Pin 2 models → they float to top with pin state; unpin works; refresh keeps pins; disable a
  pinned model server-side (admin toggle) → pin silently dropped, no crash.
- Second user on same browser gets independent pins/prefs (per-userId keys).
- Plugin: same flows inside AE (CEP localStorage works); node --check + install-cep.sh.
```

**Model:** Sonnet 5 — aniq belgilangan klient-tomonlama feature; pul-oqimiga tegmaydi
(faqat tanlovni eslab qoladi, narx har doim qaytadan hisoblanadi).

## Hidden problems (folded into the prompt)

- **P12.1** — Persisted model may be disabled/removed later — restore must validate against
  the live `genModels` list (money-safe fallback to default).
- **P12.2** — Aspect/resolution restore must go through the existing per-model clamp
  (`:19507`) or an unsupported combo could reach the quote call.
- **P12.3** — Per-user scoping: shared computers must not leak pins/prefs between accounts;
  logout clears, auth-expiry does not.

---

# P13 — FEATURE: every gen model shows its own PROVIDER BRAND icon in the model picker
# (mandatory, web + plugin)

## Owner's request

Like the reference screenshot (competitor picker: Google "G" next to Nano Banana, OpenAI mark
next to GPT Image, Kling/Seedream/Krea marks…): every model in OUR picker must display its
own brand icon instead of the current generic type icon (image/video/mic tile). Mandatory.
Web AND plugin.

## Director's code analysis

- Today both pickers render a generic MODE icon per row (image/video/voice/sfx tile) — no
  brand identity. Model rows: web `platform/index.html` :16992 (composer quick list) and
  :17047 ("Choose a model" sheet); plugin has its own picker (BATCH5/6 model picker in
  `AssetFlow_Plugin.html`).
- Model catalog lives server-side (`apps/api/src/lib/gen-models.ts`, served via
  `GET /api/studio/gen/models`). 🔴 Money rule freezes its COST MATH
  (`computeGenCost`/`imageUnitCost`) — adding a display-only metadata field is allowed
  ("UI around them allowed").
- Brand ≠ provider-transport: models arrive via OpenRouter/Vertex/BytePlus/fal, but the icon
  must reflect the model FAMILY the user recognizes: Nano Banana/Imagen/Veo/Chirp → Google;
  GPT Image → OpenAI; Seedream/Seedance → Dreamina (ByteDance); Kling → Kling; ElevenLabs →
  ElevenLabs; Topaz → Topaz; Krea → Krea; unknown → current generic tile (fallback).
- ⚠️ Plugin constraint: NO internet-loaded assets — icons must be INLINE SVG in both clients.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Server: apps/api/src/lib/gen-models.ts
(model catalog; GET /api/studio/gen/models). Web: packages/assetflow-studio/platform/
index.html (direct source). Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html
(inline assets only).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: in gen-models.ts you may ONLY add a display metadata field to
  entries — computeGenCost/imageUnitCost/credit values byte-identical. If anything forces a
  cost-line diff → STOP and flag.
- English UI text; Uzbek code comments. Minimal diff. No migrations.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): both clients in this one prompt.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FEATURE — per-model brand icon:
1. SERVER (single source of truth): add an optional `brand` field to each model entry in
   gen-models.ts (pure metadata next to name/label — far from cost lines). Values (enum
   string): 'google' (Nano Banana*, Imagen*, Veo*, Chirp*, Gemini*), 'openai' (GPT Image*),
   'dreamina' (Seedream*, Seedance*), 'kling' (Kling*), 'elevenlabs' (ElevenLabs*/SFX/voice
   models from that provider), 'topaz' (Topaz upscale), 'krea', 'artlist' if present.
   Anything unmapped → omit the field. Include `brand` in the /gen/models response mapping
   (check the route serializer includes new fields).
2. ICON SET (both clients, INLINE SVG): one shared sprite of small monochrome brand marks
   (~20px tile, currentColor). Accuracy rule: use a faithful simplified mark where it can be
   drawn precisely (Google "G", OpenAI knot); where a logo cannot be reproduced accurately,
   use a clean LETTERMARK tile (brand initial, rounded square, brand accent color) — do NOT
   ship a wrong/mangled logo. Fallback (no brand): keep today's mode tile.
3. WEB: render the brand icon at the left of each model row in BOTH pickers (:16992 quick
   list, :17047 sheet) and in the composer's collapsed model chip (the "⊞ Nano Banana 2"
   chip) so the identity carries through. Keep row layout/height unchanged.
4. PLUGIN: same icons inline in its picker rows + collapsed chip. No external requests
   (verify: no <img src="http…">, only inline <svg>). node --check + install-cep.sh.
5. THEMING: icons must work in all 3 themes (token-first: currentColor / theme vars; the
   lettermark accent may use the brand color hex with sufficient contrast on dark).

VALIDATION
- Web picker: every model row shows a brand mark or lettermark; unknown model falls back to
  mode tile; search/filter rows keep icons.
- /gen/models response includes brand; costs in the response byte-identical to before
  (diff the JSON minus the new field).
- Plugin picker matches web branding; AE offline (no network) still renders icons.
- 3 themes: icons legible in noir/neon/cold.
```

**Model:** Sonnet 5 (metadata + inline SVG + ikki klient UI; pul-satrlariga tegilmaydi).

## Hidden problems (folded into the prompt)

- **P13.1** — Brand must map by MODEL FAMILY, not transport provider (OpenRouter/Vertex/
  BytePlus are plumbing, not identity).
- **P13.2** — Wrong/mangled logos are worse than lettermarks — accuracy rule forces lettermark
  fallback instead of hallucinated SVG paths.
- **P13.3** — Plugin's no-internet-assets rule: sprite must be inline in the single HTML file.
- **P13.4** — gen-models.ts is money-adjacent: the diff must be provably display-only (cost
  lines byte-identical) — validation includes a response diff.

---

# P14 — All popovers/dropdowns must close on OUTSIDE CLICK and ESC, everywhere (web + plugin)

## Owner's report

Any open panel (model list, settings chip, filters…) currently forces the user to go BACK to
the same chip to close it. Required, globally: after picking an option, or clicking any empty
space, or pressing Esc — the open panel closes. Everywhere, web and plugin.

## Director's code analysis

`platform/index.html`:

- **No global outside-click handler exists at all** (no `document`-level click listener in
  the app) — that's why panels feel "sticky".
- **Esc handler is partial** (`:18506-18512`): covers only `megaOpen`, `lightbox`,
  `refLibPick`, `chipPop`. NOT covered: `modelOpen` (composer quick model list — the one in
  the owner's screenshot), `modelModalOpen` (Choose-a-model sheet), `fbarPop` (catalog filter
  popovers), `sortOpen`, `useMenuOpen`, `appMenuOpen`, `avatarOpen`, `navOpen`.
- Pick-to-close mostly works already (`onSize`/`onCount`/`pickModel` etc. set
  `chipPop:null`/`modelOpen:false`) — EXCEPT multi-select filter popovers which intentionally
  stay open during multi-tick (`:21766` comment) — those still need outside-click/Esc.
- Screen change (`go()` `:18400`) already resets flags — the gap is purely outside-click+Esc.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (direct source; custom sc- template runtime, popover state flags in this.state).
Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html (composer chips/popovers of its own).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes. English UI; Uzbek code comments.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): both clients in this one prompt.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM
Popovers only close by re-clicking their trigger. No document-level outside-click handler
exists; the Esc handler (:18506-18512) covers only megaOpen/lightbox/refLibPick/chipPop.
Uncovered flags: modelOpen, modelModalOpen, fbarPop, sortOpen, useMenuOpen, appMenuOpen,
avatarOpen, navOpen.

FIX (web) — one mechanism, all popovers:
1. Define ONE list of "light popover" flags + their close patch:
   POPS = { chipPop:null, modelOpen:false, fbarPop:null, sortOpen:false, useMenuOpen:false,
            appMenuOpen:false, avatarOpen:false, refSrcK:null }
   (modelModalOpen and lightbox are MODALS — Esc yes, outside-click only on their existing
   backdrop; navOpen/megaOpen keep current behaviour + Esc.)
2. OUTSIDE CLICK: add a single document 'mousedown' listener (capture) installed once at
   boot: if no popover flag is truthy → no-op (cheap). Otherwise, if the event target is NOT
   inside an element marked data-pop-root, setState(POPS). Then mark every popover panel AND
   its trigger chip with data-pop-root in the markup (composer chips, model quick list,
   filter bar labels, sort dropdown, avatar/app menus). Interactions INSIDE a panel (e.g.
   multi-select ticks) keep working — they're inside data-pop-root.
3. ESC: extend the existing keydown handler (:18506) — before its current checks, if any
   POPS flag is truthy: close them all + refSrcK, and return. Keep the existing
   megaOpen→lightbox→refLibPick→chipPop order after that. modelModalOpen: add Esc-close
   (returning before lightbox handling).
4. PICK-TO-CLOSE: single-select handlers already close (onSize/onCount/pickModel…) — verify
   each popover's option handlers include the close patch; fix any stragglers. Multi-select
   filter popovers (fApps/fCats :21766-21769) INTENTIONALLY stay open on tick — keep that,
   outside-click/Esc now covers closing them.
5. Do not break: stop()/stopPropagation patterns inside panels; text inputs inside popovers
   (search field in model sheet) — mousedown inside them is within data-pop-root, safe.

PLUGIN (required):
The AE plugin composer has its own chips/popovers (BATCH5 ⚙ settings chip, model picker,
edit-preset chips). Apply the same trio there: outside-click (document mousedown +
data-pop-root), Esc, pick-to-close. Reuse its existing state/flags — do not redesign.
node --check + install-cep.sh.

VALIDATION (web + plugin)
- Open model quick list → click empty canvas → closes. → reopen → Esc → closes.
- Filter popover (multi-select): tick 2 apps (stays open) → click outside → closes, filters
  applied.
- Sort dropdown, avatar menu, app menu, ⚙ chip: same trio.
- Choose-a-model sheet: Esc closes; backdrop click closes (existing behaviour intact).
- Esc with a popover open does NOT also close the lightbox behind it (priority: popover
  first, one Esc = one layer).
- Typing in the model-sheet search unaffected.
```

**Model:** Sonnet 5 (bitta mexanizm + bayroqlar ro'yxati aniq berilgan).

## Hidden problems (folded into the prompt)

- **P14.1** — Esc must peel ONE layer per press (popover → then modal → then lightbox), not
  nuke everything at once.
- **P14.2** — Multi-select popovers must stay open during in-panel ticks (existing intent,
  `:21766`) — outside-click/Esc is the close path, not tick.
- **P14.3** — mousedown-capture chosen over click so panels close before another control
  swallows the event; inputs inside panels are protected via data-pop-root.

---

# P15 — Composer balloons to full screen on long prompts (web + plugin)

## Owner's report

When the user writes/pastes a large prompt, the AI Studio composer grows until it covers the
whole screen (screenshot: an Enhance-produced prompt fills ~90% of the viewport, hiding the
gallery). Cap it.

## Director's code analysis

- Plain-textarea path: `afSizePromptTa()` (`platform/index.html:19797`) auto-grows to
  `min(scrollHeight, 60vh)` — 60% of the screen for the TEXTAREA ALONE; plus refs strip,
  chips row and balance row, the dock swallows the viewport. (A stale comment at `:21847`
  says "max-height 240px CSS'da" — code and comment disagree; the live cap is 60vh.)
- Chip-editor path (BATCH5 `#6`, `installChipEditor` `:19809`): contenteditable div sized
  purely by CSS min/max-height (`:19800` skips JS sizing) — its CSS max must be found and
  aligned; the screenshot (chips active) shows it's effectively unbounded or near-60vh too.
- Enhance regularly produces 300+ word prompts (`:19956` sets aiPrompt then re-sizes) — this
  is the common trigger, not an edge case.
- Plugin: the same BATCH5 chip-editor was ported to the AE composer (kept in sync via the
  SD2-EDIT-PRESETS marker) — same ballooning there in a much smaller panel.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (direct source; composer = .va-dock, two editor variants: plain textarea .prompt
and contenteditable .prompt.chipedit from BATCH5 #6). Plugin:
plugins/after-effects-cep/AssetFlow_Plugin.html (same chip-editor pattern, SD2-EDIT-PRESETS
sync marker).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes. English UI; Uzbek code comments.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): both clients in this one prompt.
- 🔴 Do NOT renumber @N reference tokens; chip-editor pill DOM / ⌘Z undo behaviour must be
  preserved exactly.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM
Composer editor grows with content up to 60vh (afSizePromptTa :19797-19804, CAP =
innerHeight*0.6) and the chip-editor variant's CSS max-height is similarly oversized —
a long/Enhanced prompt makes the dock cover the screen. Comment at :21847 claims a 240px CSS
cap that no longer matches the code.

FIX (web):
1. New cap: editor max-height ≈ 200px (~8 lines) with internal overflow-y:auto.
   - afSizePromptTa: CAP = 200 (const, Uzbek comment); when content exceeds cap, keep the
     caret visible (after programmatic sets — Enhance/restore/chip — scroll editor to TOP so
     the user sees the beginning; while TYPING, browser default keeps caret in view).
   - Chip-editor CSS: set the same max-height + overflow-y:auto on .prompt.chipedit; verify
     pill wrapping and the @mention dropdown positioning still work when scrolled (mention
     popup must anchor to the caret/viewport, not clip inside the scroll container — test).
2. EXPAND toggle: small ⤢ button in the dock's top-right (visible ONLY when content is
   taller than the cap): toggles the editor to 60vh ("expanded") and back. State is
   transient (not persisted). Esc collapses expanded mode first (integrates with P14's
   one-layer-per-Esc if both land; otherwise plain).
3. The dock's OTHER rows (refs strip, chips, balance) unchanged; total dock must never
   exceed ~70vh even expanded.
4. Update the stale :21847 comment to match reality.

PLUGIN (required):
Same cap + internal scroll + expand toggle on the AE composer's chip-editor (its panel is
~narrower — cap ≈ 140px there). Keep SD2-EDIT-PRESETS sync marker comments intact.
node --check + install-cep.sh.

VALIDATION
- Paste a 500-word prompt: editor stops at cap, scrolls internally, gallery stays visible;
  ⤢ appears, expands to 60vh, collapses back; Esc collapses expanded mode.
- Enhance a prompt (programmatic set): editor shows the TOP of the new text, not the tail.
- Chip pills + @mention dropdown work inside the scrolled editor (add 3 refs, type @ at the
  bottom of a long prompt → dropdown visible, not clipped).
- ⌘Z undo checkpoints unaffected; Generate flow unaffected.
- Plugin: same checks inside AE at panel width ~360px.
```

**Model:** Sonnet 5 (CSS/sizing + kichik toggle; chip-editor atrofida ehtiyotkorlik talab
qilinadi lekin diagnoz aniq).

## Hidden problems (folded into the prompt)

- **P15.1** — Code (60vh) and comment (240px) disagree — the comment fossilized an older cap;
  both get fixed together.
- **P15.2** — Two editor variants (textarea vs chip-editor) size by different mechanisms
  (JS vs CSS) — capping only one leaves the bug alive in the other.
- **P15.3** — @mention dropdown inside a now-scrollable container can clip — must anchor
  outside the scroll clip.
- **P15.4** — After programmatic sets (Enhance) the user must land at the TOP of the text;
  after typing, at the caret.

---

# P16 — Gen lightbox media too small + clunky "IMAGE/VIDEO" corner tag (web + plugin)

## Owner's report

1. Clicking a gen card opens the lightbox but the image/video is displayed too small — make
   it noticeably bigger.
2. The "▣ IMAGE" tag sitting on the media corner (both on grid cards and in the lightbox)
   looks bad — remove it or make it pretty.

## Director's code analysis

- Lightbox CSS (`platform/index.html:15636-15666`): `.va-lb-shell{max-width:1400px}` with a
  fixed 328px side panel + `.va-lb-stage{padding:24px}` → on any modern display the media is
  capped around ~1000px wide, floating in a large dark scrim (screenshot: a 2752×1536 image
  shown at ~⅓ of its glory). Plenty of headroom: scrim padding 3vw, shell could take ~96vw.
- The corner tag is `.va-lb-tag` (`:15644`) in the lightbox and a similar mono-text chip on
  grid cards — black rounded box with "IMAGE"/"VIDEO" text; redundant in the lightbox (the
  details panel already lists type/model/size).
- 🔴 Bonus violation found in the screenshot: the lightbox sub-line shows **"Rasm yaratish ·
  1 / 9" — Uzbek UI text**, violating the English-UI rule (probably a missed string from the
  translation pass). Must be fixed in the same touch.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (direct source; lightbox = .va-lb-* CSS :15636-15666 + its markup/data mapping).
Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html (AI gallery has its own
lightbox/detail — parity required).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes. English UI; Uzbek code comments.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → stop and report.
- 🔴 PLUGIN PARITY (owner directive): both clients in this one prompt.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — bigger lightbox media (web):
.va-lb-shell (:15639): max-width:1400px → min(96vw, 1880px); keep max-height:94vh.
.va-lb-stage (:15640): padding 24px → 12px.
.va-lb-el (:15641): max-height 88vh → 90vh.
Keep the 328px panel width; on narrow screens the existing column layout (:15665-15666)
stays. Verify ←/→ arrows and the ✕ button don't overlap media at the new size, portrait
(9:16) media doesn't overflow, and the audio variant (.va-lb-aud) still centers.

FIX 2 — corner type tag (web):
a) LIGHTBOX: remove the .va-lb-tag overlay entirely — the details panel already carries the
   type; the media should be clean.
b) GRID CARDS: replace the text chip with a compact icon-only badge: 22×22px rounded tile,
   rgba(0,0,0,.45) + blur, centered mono icon (image / play glyph from the existing inline
   sprite), top-left, no text. Keep NEW/FREE/4K badges as they are. One CSS class, all card
   variants (library grid, session strip, projects).

FIX 3 — stray Uzbek UI string:
The lightbox author sub-line renders "Rasm yaratish · 1 / 9". Locate the mapping (grep
"Rasm yaratish" / the sub-line builder) and replace with English ("Image generation",
"Video generation", etc. by mode). Grep the WHOLE platform + studio js for any other
lingering Uzbek UI literals (arizalar: "yaratish", "yuklab", "sozlamalar"…) and fix any
found in USER-FACING strings (code comments stay Uzbek). Report the list.

PLUGIN (required):
Apply the same three fixes to the plugin's gen gallery/lightbox: bigger media area within
the panel constraints, icon-only type badge, no Uzbek UI strings. node --check +
install-cep.sh.

VALIDATION
- 16:9, 9:16, 1:1 and audio gens in the lightbox: media visibly larger, no overlap with
  arrows/✕, panel intact; type tag gone.
- Grid cards: compact icon badge, all 3 themes legible.
- grep -i "rasm yaratish" returns nothing in UI strings; other Uzbek literals reported/fixed.
- Plugin: same checks in AE.
```

**Model:** Sonnet 5 (CSS o'lchamlar + belgi + matn tozalash; xavfsiz, aniq).

## Hidden problems (folded into the prompt)

- **P16.1** — 🔴 "Rasm yaratish" — Uzbek UI text leaked into production (English-UI rule);
  the prompt includes a repo-wide sweep for more leaked literals.
- **P16.2** — Portrait media at the new size can collide with nav arrows — explicit check.
- **P16.3** — The type tag exists in TWO variants (card chip + lightbox overlay) — fixing one
  and not the other would keep the ugliness half-alive.

---

# P17 — "Can't reach the server" toast on Generate / Enhance (sometimes)

## Owner's report

Occasionally pressing Generate or Enhance pops "Can't reach the server — check your
connection" and the action dies.

## Director's code analysis

The toast is ff-api.js's `NETWORK` error (thrown after timeout/connection failure). Per-call
reality:

| Call | Retry today | Why it still fails |
|---|---|---|
| `POST /gen` (Generate) | ✅ 4 attempts w/ Idempotency-Key (P18 dedup — safe) | total window ~90s can still lose to a deep cold start; and the PRECEDING quote call is the weak link |
| `POST /gen/cost-quote` | ❌ 1 attempt, 20s | pure computation+signing, NO side effects — safe to retry but never marked idempotent; Generate dies here before /gen is even called |
| `POST /gen/prompt/enhance` | ❌ 1 attempt, 20s | 🔴 CONSUMES CREDITS (`consumeAiCredits`, studio-gen.ts:1671) with NO idempotency support — the client MUST NOT blindly retry (double charge). Needs the /gen-style Idempotency-Key dedup server-side FIRST |

Root latency source is the Cloud Run + Neon cold start (P5.3 owner decision still pending);
the client work here is about surviving it safely.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Server: apps/api/src/routes/studio-gen.ts.
Client: packages/assetflow-studio/platform/ff-api.js + platform/index.html. Plugin:
plugins/after-effects-cep/ (its AI calls go through its own client — parity below).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: consumeAiCredits/refundAiCredits internals, computeEnhanceCost
  values, cost-quote HMAC — byte-identical. You may add an idempotency GATE AROUND the
  enhance route (dedup cache before consume) — that is a gate, not math. If unsure → STOP
  and flag.
- English UI text; Uzbek code comments. Minimal diff. Migrations: none (see cache note).
- ⚠️ Uncommitted BATCH6/8 changes in touched files → stop and report.
- 🔴 PLUGIN PARITY (owner directive): plugin AI calls get the same safety.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — cost-quote becomes retryable (client only):
ff-api.js quote(): pass { idempotent: true } (it's a pure compute+sign endpoint — verify by
reading the route: no DB writes / no credit consume; state that verification in the summary).
This alone fixes most "Generate dies" cases (the quote was the first cold-start victim).

FIX 2 — enhance idempotency (server first, then client retry):
a) SERVER: replicate the existing /gen Idempotency-Key pattern (P18) for
   POST /gen/prompt/enhance: read the Idempotency-Key header; keep a short-lived dedup
   record (reuse the SAME mechanism/storage /gen uses — find it in studio-gen.ts; do NOT
   invent a second store or a new table). First request: normal flow (cap check → consume →
   Vertex call) with the response cached under the key (TTL ~10 min). Retry with same key:
   return the cached response WITHOUT consuming credits again. In-flight duplicate: 409 or
   wait — mirror whatever /gen does.
b) CLIENT (web ff-api.js enhance()): generate a per-attempt-set idempotencyKey (uuid, same
   pattern as gen() :210-214) and pass { idempotencyKey } so req() retries safely (4
   attempts). The key is per user-click — a NEW click gets a NEW key.
c) 🔴 Validate the money invariant: with the dedup in place, N retries of one click consume
   credits EXACTLY once (test: kill the connection after the server consumed but before the
   client got the response → client retries → cached response, ledger shows ONE debit).

FIX 3 — toast becomes actionable (web):
Where Generate/Enhance catch NETWORK (the toast site in platform/index.html — grep
"Can't reach the server" mapping :18866 and its callers), show the toast WITH a Retry
action that re-invokes the SAME operation (same idempotencyKey for enhance retry-of-failed;
quote/gen flows re-run normally). Keep the existing "won't be charged if refused" note
behaviour intact.

PLUGIN (required):
The plugin's AI client (its own request layer) calls the same endpoints: give its enhance
call the same idempotencyKey + retry, and its quote call idempotent retry. If the plugin
lacks a retry mechanism entirely, add the minimal backoff copy of ff-api.js req() semantics
for THESE TWO calls only. node --check + install-cep.sh.

VALIDATION
- Throttle to Slow 3G + cold API: press Enhance → spinner survives ~60s+, ONE credit debit
  in the ledger, prompt arrives; Generate: quote retries, gen proceeds, one job, one charge.
- Kill network entirely: toast appears WITH Retry; Retry after reconnect succeeds without a
  second debit (enhance) / without a duplicate job (gen).
- Ledger audit before/after 5 forced-retry enhances: exactly 5 debits.
```

**Model:** Fable 5 (Medium) — kredit-yechish atrofidagi idempotency darvozasi; pul invarianti
testi majburiy. Kvota tejash: Opus 4.8 (Sonnet EMAS — bu pul-tutash).

## Hidden problems (folded into the prompt)

- **P17.1** — 🔴 Enhance retry without server dedup = double credit charge — the reason this
  wasn't just "add retry" one-liner.
- **P17.2** — Generate usually dies at the QUOTE step (never marked retryable), not at /gen —
  the visible toast blamed the wrong call.
- **P17.3** — The dead-end toast (no Retry action) forces the user to re-do work manually.
- **P17.4** — Underlying latency = cold start; P5.3 owner decision (Neon Launch /
  min-instances) remains the real cure — this prompt is the safety net.

---

# P18 — Reference tiles show a black box (no preview) + Seedream edit-preset chips leak onto
# Gemini Omni Flash

## Owner's report

1. Importing a reference video (or image) into the composer shows a BLACK tile — no visible
   preview of what was attached (screenshot: "@vid…" on a black square).
2. On Gemini Omni Flash, three preset chips appear — "Replace subject", "Edit objects",
   "Inpaint / Fix" — they don't belong there; remove them for this model.

## Director's code analysis

1. **Black video ref tile is BY DESIGN (a lazy design):** `platform/index.html:19826` —
   `video: (this.state.refVideos || []).map(() => null), // poster yo'q → glyph` and `:19865`
   `thumb: null, glyph: '▶'`. Video references deliberately get NO thumbnail — just a glyph
   that renders as a near-black tile. Image refs use their URL — which can ALSO go black when
   the signed URL behind an older "Use ▾" pick has expired (P9 family).
2. **Preset chips gate is model-blind:** `:16972` — "Video-edit preset chips — only when ≥1
   VIDEO reference attached (SD2-EDIT-PRESETS)". The ONLY condition is "a video ref exists";
   the chips were built for the Seedream/Seedance (Dreamina) edit flow (BATCH5 #4) but appear
   for ANY model with a video ref — including Gemini Omni Flash, where their templates
   (`Replace the <subject> in @video1 with the one from @img1…` `:17572-17574`) target a
   different model's semantics.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (direct source). Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html — it
carries the SAME preset chips ("SD2-EDIT-PRESETS v1 — sync manually with plugin" marker
:17570) and its own composer ref tiles. BOTH clients in this prompt.

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes required (see FIX 1 note).
- English UI text; Uzbek code comments. Minimal diff.
- 🔴 Do NOT renumber @N reference tokens; the reference POOL semantics (P13 projection,
  :20027-20045) must be untouched — this is display + chip-gating only.
- ⚠️ Uncommitted BATCH6/8 changes in touched files → stop and report.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — real previews on reference tiles (web):
a) VIDEO refs: replace the null-poster/glyph tile with a real first-frame preview:
   <video muted playsinline preload="metadata" src="<refUrl>"> inside the tile (metadata
   preload renders frame 0; ~no bandwidth). Keep the small ▶ glyph OVERLAY so type is clear.
   Where the code hardcodes null posters (:19826 undo-snapshot thumbs, :19865 mention list
   'thumb: null, glyph ▶') — give the mention dropdown the same video-frame thumb when cheap,
   else keep glyph (mention list may stay glyph-only; the COMPOSER TILE must show the frame).
b) IMAGE refs: add onerror fallback on the tile img (expired signed URL → show glyph + amber
   ring instead of a silent black box). NOTE: P9 (CDN URLs) fixes expiry at the root; this is
   the belt-and-braces display fallback.
c) Tile label ("@vid…") stays; ✕ remove stays; drag/paste flows untouched.

FIX 2 — gate the edit-preset chips by MODEL (web):
The chips block (:16972 markup; templates :17570-17574) currently shows when ≥1 video ref
exists. Add a model condition: show ONLY when the SELECTED model is the Seedream/Seedance
(Dreamina) edit-capable family the presets were written for (identify by model id prefix in
the live genModels list — e.g. seedance/dreamina ids; do NOT hardcode display names).
Gemini Omni Flash and all other video models: chips hidden. Keep the ref-attached condition
AND'ed. Update the SD2-EDIT-PRESETS comment to document the gate.

PLUGIN (required):
Same two fixes in the AE composer: its ref tiles (video preview frame + image onerror
fallback) and its SD2-EDIT-PRESETS chips get the same model gate (the marker comment says
the two copies are synced manually — keep both copies identical and note the sync in both).
node --check + install-cep.sh.

VALIDATION
- Attach a video ref (upload + "Use ▾" from a video gen): tile shows the first frame + ▶
  overlay, ✕ works, @Video 1 pill unaffected.
- Attach an image ref with a deliberately broken URL: glyph+amber fallback, no black box.
- Seedance 2.0 + video ref → chips visible; Gemini Omni Flash + video ref → chips GONE;
  chip insert still writes the template into the prompt on Seedance.
- @mention integrity: tokens unchanged, no renumbering (type a prompt with @video1, switch
  models, verify pill intact).
- Plugin: same checks in AE.
```

**Model:** Sonnet 5 (ikkala fix ham displey/gating; pool semantikasiga tegilmaydi).

## Hidden problems (folded into the prompt)

- **P18.1** — The black tile was a deliberate shortcut (`poster yo'q → glyph`) that reads as
  a bug to users; video metadata preload gives a free first-frame poster.
- **P18.2** — Image ref tiles can also go black via expired signed URLs — root-fixed by P9,
  display-fallback here.
- **P18.3** — The preset chips exist in TWO manually-synced copies (web + plugin marker
  SD2-EDIT-PRESETS) — gating only the web copy would desync them.

---

# P19 — "Use ▾" menu opens in the WRONG PLACE (next to another card / split across columns)

## Owner's report

Pressing "Use ▾" on a gen card opens the menu somewhere else — anchored to a different card,
sometimes even torn in two (the "Edit image" row under the right card, the rest of the menu
at the top of the neighbouring column).

## Director's code analysis (root cause confirmed)

The gallery is a **CSS multi-column masonry**: `.va-axgrid{columns:340px}` (`:15625`), cells
`.va-axcell{position:relative;break-inside:avoid}` (`:15627`). The Use menu is an
**absolutely-positioned dropdown INSIDE a multicol cell**:
`.va-axmenu{position:absolute;left:9px;top:calc(100% - 4px);…}` (`:15683`), markup inside the
cell (`:16877-16895`).

Absolutely-positioned descendants of a CSS multi-column container are a known rendering trap:
the containing block spans columns, so the browser may place (or fragment) the popup into a
DIFFERENT column box — exactly the "menu next to another card / split in two" the owner sees.
The codebase already knows the cure: the MOBILE media query switches the same menu to
`position:fixed` (`:15836`). Desktop needs the same escape from the multicol context.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (direct source; gallery .va-axgrid = CSS multicol; Use menu .va-axmenu inside
.va-axcell, state useMenuOpen + activeGenId, menuOpen computed :20687). Plugin:
plugins/after-effects-cep/ (its gallery/library cards have an equivalent menu — parity).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes. English UI; Uzbek code comments.
- ⚠️ Uncommitted BATCH6/8 changes in touched files → stop and report.
- 🔴 PLUGIN PARITY (owner directive): both clients in this one prompt.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM
.va-axmenu (:15683) is position:absolute inside a CSS multicol cell — Chrome positions/
fragments abs-pos descendants of multicol into other column boxes → the menu renders next to
the wrong card or splits across columns. Mobile already avoids this with position:fixed
(:15836).

FIX (web) — anchor the menu to the trigger with fixed positioning (desktop too):
1. In toggleUseMenu, capture the trigger rect:
   const r = e.currentTarget.getBoundingClientRect();
   store { x: r.left, y: r.bottom, up: r.bottom > innerHeight - 420 } (approx menu height)
   in state alongside useMenuOpen.
2. Render .va-axmenu with position:fixed; left/top from the stored rect (clamped to the
   viewport: left = min(x, innerWidth - 258); if `up`, open ABOVE the trigger:
   top = r.top - menuHeight). Apply via inline style bound in the template (the sc- runtime
   already binds style strings elsewhere — follow that pattern).
3. Close the menu on scroll/resize while open (one listener added when opening, removed on
   close) — a fixed menu must not float away from its card.
4. Keep the existing backdrop (.ffa-popbd :17030) and closeUseMenu wiring; keep all menu
   items/handlers byte-identical. Keep the mobile fixed-sheet behaviour (:15836) — guard the
   new coords so the mobile media query still wins (or apply coords only at >640px).
5. Remove/neutralize the now-unused absolute coords in .va-axmenu desktop CSS.

PLUGIN CHECK (required):
The AE plugin's result cards / My Library have their own card menu. Test whether its
container is also CSS-columns (grep columns: in the plugin styles) and whether its menu is
abs-pos inside a cell. Same symptom → same fixed-position fix. If its layout is flex/grid
(no multicol), state that and leave it.

VALIDATION
- Open Use ▾ on cards in EVERY column, top and bottom rows: menu appears attached to ITS
  trigger, never in another column, never split.
- Near the viewport bottom: menu flips upward, fully visible.
- Scroll while open → closes. Backdrop click closes. All items work (Edit image handoff,
  i2v, Upscale x2/x4, Add to project, Delete).
- Compact grid view (va-axgrid.compact) + narrow window (2-column) + mobile sheet: correct.
```

**Model:** Sonnet 5 (aniq diagnoz, bitta pozitsiyalash mexanizmi).

## Hidden problems (folded into the prompt)

- **P19.1** — The mobile breakpoint already fixed this bug months ago (`position:fixed`
  :15836) — desktop just never got the same treatment.
- **P19.2** — A fixed-position menu detaches from its card on scroll — must close on
  scroll/resize.
- **P19.3** — Near-viewport-bottom cards need the menu to flip upward or it clips.

---

# P20 — AI-generated SFX/Music published to Explore must land in Sound Effects / Music
# (not AI Stock) + audio player must show REAL playback (not a static picture)

## Owner's report

1. When a user sends a generated sound effect to Explore and admin approves it, the asset
   must appear under **Sound Effects** — not under AI Stock. Music likewise → **Music**.
2. When music/SFX plays, the player must genuinely track playback (live waveform/progress),
   not a static waveform image with a detached native audio bar.

## Director's code analysis

1. **Categorization — half done server-side:** `apps/api/src/lib/explore-submit.ts`
   `classifyMode()` already maps sfx→`stockType:'sfx'`, voice/music→`'music'` (`:60-63`) —
   but BOTH publish sites hardcode **`templateType: "ai-stock"`** (`:144`, `:217`), and the
   catalog pills filter by templateType → all AI audio lands in the AI Stock pill with
   category "Uncategorized" (screenshot 1). Dependencies to respect when changing it:
   - "my submissions" listing queries `templateType: "ai-stock"` (`:297`) — would lose audio
     items after the change;
   - AI metadata generation uses `typeKey: "ai-stock"` (`:187`) → AI Stock categories, hence
     "Uncategorized" for audio (sfx/music taxonomies never consulted);
   - the AI badge / admin prompt display rely on `templateType==='ai-stock'` or
     `meta.aiSource==='ai'` — meta.aiSource survives as the AI marker.
2. **Audio player is a static picture:** catalog detail (screenshot 3) renders a waveform
   IMAGE + a separate native `<audio controls>` bar — the waveform never moves; the AI Studio
   audio lightbox (screenshot 2) is the same plus **tofu □ icons**: the audio branch uses
   Phosphor `<i class="ph …">` glyphs (`.va-lb-aud>i` CSS `:15643`) but the PLATFORM NEVER
   LOADS the Phosphor font (admin-only asset) → every icon renders as □. (Same family as
   P7.3 but this instance is a hard bug on web.)
3. **Nonsense audio metadata:** detail page shows Application "After Effects", Orientation
   "Landscape · 16:9", Resolution "HD" and an "Open in After Effects" button for an MP3 —
   meaningless for audio.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Server: apps/api/src/lib/explore-submit.ts,
catalog serialization lib/catalog-map.ts. Web: packages/assetflow-studio/platform/index.html.
Plugin: plugins/after-effects-cep/ (Browse shows SFX/Music categories + plays previews).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. Migrations: NONE (all fields exist). English UI; Uzbek comments.
- Do NOT loosen isPublicReadKey().
- ⚠️ Uncommitted BATCH6/8 changes in touched files → stop and report.
- 🔴 PLUGIN PARITY (owner directive): both clients in this one prompt.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — publish AI audio into native pills (server):
explore-submit.ts:
a) At both publish sites (:144, :217): templateType = 'sfx' for sfx mode, 'music' for
   voice/music modes; image/video KEEP 'ai-stock' (owner asked audio only). stockType stays
   as classifyMode returns. Keep meta.aiSource='ai' (verify it is set; it is the AI marker).
b) "My submissions" query (:297): templateType in ['ai-stock','sfx','music'] AND
   meta.aiSource='ai' (or equivalent JSON filter) so audio submissions remain visible.
c) Metadata typeKey (:187): pass 'sfx'/'music' for audio so AI categorization uses the AUDIO
   taxonomies (categories like Alarms/Ambient/… from UPLOAD_TAXONOMY) — kills
   "Uncategorized".
d) Verify admin moderation still shows the AI GENERATION PROMPT box for these items
   (admin-views checks aiSource — confirm) and the AI badge on web cards keys off aiSource,
   not templateType (adjust the card badge condition if it checked templateType only).
e) BACKFILL: one idempotent script scripts/backfill-ai-audio-type.mjs — UPDATE existing
   published AI audio (templateType='ai-stock' AND stockType in ('sfx','music')) →
   templateType='sfx'|'music'. Dry-run flag; owner runs manually.

FIX 2 — real audio player (web):
One lightweight shared player (waveform + live progress + seek), used in BOTH the catalog
audio detail and the AI Studio audio lightbox/cards:
- Keep the existing waveform image as the base layer; add a progress layer (same image,
  accent color, clip-path/width driven by audio 'timeupdate') + a playhead line; click/drag
  on the waveform seeks (offsetX/width * duration).
- Custom play/pause button + time "0:04 / 0:10" (mono font); REMOVE the visible native
  <audio controls> (keep the hidden <audio> element as the engine).
- If an item has NO waveform image, draw a simple static bars placeholder — progress overlay
  still works.
FIX 2b — tofu icons: the audio lightbox/branch uses Phosphor <i class="ph …"> but the
platform never loads that font (□ squares). Replace every ph-icon in platform/index.html
audio surfaces with the existing INLINE SVG sprite icons (#i-play etc.). Grep the whole
platform file for class="ph and fix all instances (report count).

FIX 3 — audio-relevant detail metadata (web):
On the catalog detail for audio assets: hide Application / Orientation / Resolution rows and
the "Open in After Effects" button; show Duration (from ffprobe spec if present) and Format
(.mp3 pack) instead. Non-audio assets unchanged.

PLUGIN (required):
Plugin Browse: verify SFX/Music AI items now appear under their nav sections (catalog comes
from the server — should be automatic; test). Give the plugin's audio preview the same
progress+seek treatment IF it currently uses a static image + bare audio tag (check; if it
already has a functional player, state so). node --check + install-cep.sh.

VALIDATION
- Generate SFX → Add to Explore → approve as admin → asset appears under Sound Effects pill
  (and NOT under AI Stock), with a real category, AI badge intact, admin prompt box intact.
- My submissions list still shows it (status Published).
- Backfill dry-run lists the two existing alarm SFX items; run against local DB moves them.
- Audio detail: waveform fills with accent color as it plays; click halfway → seeks; no
  native controls bar; no □ icons anywhere (grep class="ph in platform = 0 in audio paths).
- Audio detail shows Duration/Format; no Orientation/Resolution/AE button.
- Plugin: SFX under Sound Effects nav, preview plays with progress.
```

**Model:** Fable 5 (Medium) — nashr-quvuri (taksonomiya, so'rovlar, backfill) + ikki klient;
xato kategoriyalash katalog ma'lumotini buzadi. Kvota tejash: Opus 4.8.

## Hidden problems (folded into the prompt)

- **P20.1** — `templateType` change breaks the "my submissions" query and possibly the AI
  badge/prompt-box conditions — all three dependencies handled together.
- **P20.2** — Audio metadata generation used AI-Stock categories → "Uncategorized" forever;
  audio taxonomies must feed the categorizer.
- **P20.3** — 🔴 Web platform uses Phosphor `ph` icon classes in the audio lightbox WITHOUT
  loading the font → guaranteed □ tofu (the font is an admin-only asset). Inline sprite is
  the platform standard.
  ⚠️ CORRECTED by P21 (2026-07-14): the platform DOES load Phosphor (self-hosted, :349) —
  the tofu is a FAILED FONT FETCH with no retry, not a missing font-face. FIX 2b (sprite
  migration in audio paths) stays valid as partial hardening.
- **P20.4** — Existing published AI audio needs a backfill or it stays stranded in AI Stock.
- **P20.5** — Audio details showed video-centric fields (16:9 / HD / Open in AE) — nonsense
  data that erodes trust in the catalog.

---

# P21 — Session-wide □ tofu icons on the WEB platform (fresh evidence) — Phosphor icon font
# fails to load and never retries. ⚠️ CORRECTS P7.3 / P20.3.

## Owner's report (with screenshots)

"Look — the icons disappear by themselves": avatar menu (Account/Downloads/Plugin/Sign out),
"New session", "My Library", the gen lightbox (VIDEO tag, nav arrows, every button icon) —
ALL render as □ squares for the whole session.

## Director's code analysis — corrected diagnosis

**Correction to earlier notes:** P7.3 claimed "web is immune (inline sprite)" and P20.3
claimed "the platform never loads the Phosphor font". Both were WRONG in part: the platform
**self-hosts Phosphor icon FONTS and uses them widely**:

- `platform/index.html:349-368` — `@font-face "Phosphor"` (`assets/fonts/da49f4d4.woff2`,
  `font-display:block`) + `.ph{font-family:"Phosphor"!important}`;
- `:4975` `"Phosphor-Bold"`, `:9600` `"Phosphor-Fill"` — three separate woff2 files;
- **105+ `class="ph …"` usages** across the platform (menus, lightbox, chips) — alongside
  the inline `#i-…` sprite used elsewhere. Two icon systems coexist.

**Failure mode:** one failed woff2 fetch (network blip, edge hiccup, aborted load) →
`font-display:block` shows nothing, then the fallback font's □ tofu — and the browser NEVER
retries a failed font for the session. That is precisely "icons vanish by themselves and
stay gone until reload". Admin has the same construction (P7.4 preload helps but doesn't
retry). The audio-lightbox tofu in P20 (FIX 2b) is this same failure surfacing — P20's
"replace ph with sprite in audio paths" remains valid as a partial migration.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (self-hosted Phosphor @font-face :349, :4975, :9600; .ph usages ~105). Admin
shell: packages/assetflow-studio/styles/admin.css (:49-55) + admin/index.html. Contributor
shell: check for ph usage (likely sprite-only — verify). Plugin: plugins/after-effects-cep/
(NO icon font — verify with grep, state in summary).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. No migrations, no server changes. English UI; Uzbek code comments.
- ⚠️ Uncommitted BATCH6/8 changes in touched files → stop and report.
- 🔴 PLUGIN PARITY: verify + state (icon font absent there).
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

PROBLEM
Self-hosted Phosphor icon fonts (font-display:block) have NO retry: one failed woff2 fetch =
□ tofu on every .ph icon for the entire session (owner screenshots: avatar menu, sidebar,
lightbox). Browsers do not re-attempt a failed font load.

FIX 1 — preload (web + admin):
<link rel="preload" as="font" type="font/woff2" crossorigin href="assets/fonts/<each
Phosphor woff2>"> in the platform <head> and the admin shell (if P7's prompt already added
admin preloads, keep them — dedup).

FIX 2 — font watchdog with retry (web + admin, one small script used by both):
On boot (after DOMContentLoaded), for each family ('Phosphor','Phosphor-Bold',
'Phosphor-Fill'):
  document.fonts.load('1em ' + family).then(list => { if (!list.length) retry(family); })
retry(family): create a new FontFace(family, 'url(<file>?r=<n>)'), load(), add to
document.fonts on success; up to 3 attempts with 2s/5s/10s backoff. On final failure: log
via AssetFlowLog.error('icon font failed', …) so it shows in System logs, and add class
'ff-iconfont-dead' on <html> — CSS rule makes .ph render a neutral middle dot (·) via
::before content override instead of tofu (visibly degraded but not broken-looking).
Uzbek comment explaining why (brauzer o'zi retry qilmaydi).

FIX 3 — inventory for the real cure (report only):
Count .ph usages per file (platform, admin js templates). Report the number and the top 10
most user-visible spots. NOTE in the summary: full migration to the inline #i- sprite is the
durable fix — recommended as a BATCH8 work item, NOT done in this prompt.

DOC CORRECTION (same commit):
In docs/MUAMMOLAR V2-2026-07-13.md: P7.3 and P20.3 carry a correction note pointing to P21
(this section already states it — just verify consistency, do not rewrite history).

VALIDATION
- Devtools → block assets/fonts/da49f4d4.woff2 → reload: watchdog retries (see network log),
  after unblocking mid-retry the icons appear WITHOUT a manual reload.
- Block permanently: after 3 attempts, html.ff-iconfont-dead set, .ph shows · not □, error
  logged.
- Normal load: no behaviour change, fonts via preload (network waterfall shows early fetch).
- Admin shell: same checks. Plugin: grep confirms no icon font (state in summary).
```

**Model:** Sonnet 5 (kichik watchdog + preload; diagnoz to'liq berilgan).

## Hidden problems (folded into the prompt)

- **P21.1** — TWO icon systems coexist on the platform (inline sprite + 3 Phosphor fonts) —
  the fonts are the fragile half; full sprite migration = BATCH8 candidate (inventory
  included).
- **P21.2** — Browsers never retry failed font loads — without a watchdog, one blip = broken
  session (root of "o'zidan o'zi yo'qoladi").
- **P21.3** — P7.3 / P20.3 contained a wrong assumption ("web immune") — corrected here;
  P20 FIX 2b (audio paths → sprite) stays valid as partial migration.

---

# P22 — 🔴 PLUGIN CRITICAL: AI results (images/videos/audio) render BLACK in the AE plugin;
# buttons/functions randomly die. "The plugin barely works."

## Owner's report

In the AE plugin, generated media doesn't display at all — gallery cards and the lightbox are
black (screenshots: image lightbox black, video shows 00:00/00:00 with no source), and
buttons/functions stop working on their own. Web shows the same gens fine.

## Director's code analysis — strong suspects (static), live debug required

The plugin maps gallery items as `url: a.url || ''` (`AssetFlow_Plugin.html:10788`, `:10335`,
`:7301`, `:14338`) from `GET /gen/history`. Cross-referencing the server's
`hydrateGenAssets` (P1/14b watermark build):

1. **Suspect A — empty `url` for FREE users (owner IS on Free plan):** for FREE viewers the
   server serves `watermarkKey`→signed, else small derivative, else **`a.url = thumbUrl || ""`**
   (studio-gen.ts:163). Old gens (no watermark, no derivatives) → `url:''` → black media,
   00:00 video. If the recent watermark pipeline fails silently in prod for video/audio,
   even NEW gens hit this branch. Web looks fine because its GRID uses displayUrl/srcset —
   the plugin leans on `a.url` everywhere.
2. **Suspect B — 1-hour signed URLs + plugin-side gallery cache** (`load()` CACHE with
   FRESH_MS `:10802`): stale URLs within a session → media dies mid-session. P9 (CDN
   derivative URLs) largely cures this — ORDERING: run P1+P9 BEFORE this prompt.
3. **Suspect C — "buttons die" = an uncaught JS exception killing listeners.** The BATCH5/6
   web→plugin ports may have introduced syntax/APIs newer than the CEP Chromium runtime, or a
   render error mid-flow (e.g. on the empty-url items) breaks subsequent handlers.
4. No CSP meta in the plugin (checked) — CSP is NOT the blocker.

## Code prompt (self-contained — run in Claude Code; REQUIRES live CEP debugging with owner)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Plugin: plugins/after-effects-cep/
(AssetFlow_Plugin.html ~792KB single file; install via scripts/install-cep.sh; CEP remote
debug available — check .debug file / manifest for the debug port, then open
http://localhost:<port> in Chrome while AE runs). Server: apps/api/src/routes/studio-gen.ts
(hydrateGenAssets). The OWNER will operate AE and report what you ask for.

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. hydrateGenAssets plan-gate invariants (P9 rules) unchanged.
- English UI; Uzbek code comments. Minimal diff. ⚠️ BATCH8 uncommitted changes → stop/report.
- ORDERING: P1 (watermark removal) and P9 (CDN derivative URLs) should land FIRST — they
  remove suspects A(partly)/B. Re-test after they land before deep-diving.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary WITH the
  confirmed root cause(s) stated explicitly.

STEP 1 — capture ground truth (CEP debug console):
a) Open the panel's remote devtools. Reproduce: open My Library / gallery, open a lightbox,
   click until a button "dies". Record EVERY console error (stack traces) and the failing
   network requests (URL, status) for media loads.
b) In console, dump the gallery items: their url/thumb/display/preview values. Classify:
   empty strings? expired signed URLs (403)? valid-but-unrendered?
c) Note the CEP/Chromium version (navigator.userAgent) — needed for STEP 3.

STEP 2 — fix media display (per findings, likely all three):
a) EMPTY-URL items (Suspect A): plugin VIEWING must prefer derivatives like the web:
   thumb/display for images, previewUrl/poster for video, url only as last resort AND for
   import/download (plan gate). Items with truly no media → explicit "Media unavailable"
   tile (not black). Uzbek comment referencing studio-gen.ts:163 fallback.
b) If prod GenAssets show watermarkKey=null on NEW Free gens (ask the owner to run one test
   gen; check the API response in the panel network tab): flag it in the summary as a
   SERVER watermark-pipeline failure — do not fix the pipeline here (P1 deletes it anyway);
   the derivative-first display from (a) already covers viewing.
c) STALE cache (Suspect B): on gallery open, if CACHE age > 10 min → refetch (drop FRESH_MS
   gate for reopen); after P9 the URLs are stable CDN so this is cheap insurance.

STEP 3 — fix the dying buttons (Suspect C) — SCOPE RAISED (owner, 2026-07-14: "juda ko'p
bo'lmoqda" — buttons/settings/UX die all over the panel, not just the gallery):
a) For every console error captured in STEP 1: fix the throwing code.
b) Syntax compatibility: the plugin has 96+ `?.`/`??` occurrences (audit/P28). Owner decided
   AE 2022+ (CEF88 — these parse fine there), BUT verify the owner's ACTUAL AE version in
   STEP 1c; if he runs AE 2021, that alone explains whole-panel death — escalate to P28.
c) GLOBAL RESILIENCE LAYER (new, mandatory):
   - window.onerror + window.onunhandledrejection → AssetFlowLog.error (stack) + a throttled
     toast ("Something went wrong — the panel kept running") so failures become VISIBLE
     instead of silently killing listeners.
   - Every top-level delegation/router handler (tools launcher, settings, account sheet,
     catalog, AI panes) gets a try/catch boundary — one section's exception must never kill
     another section's buttons.
   - Gallery render keeps its per-item try/catch (as before).
   - Cheap self-check after any caught exception: verify document-level delegation is still
     bound; re-bind if lost.
d) Summary must list the top distinct exceptions from a 15-minute owner session and which
   fix addressed each.

VALIDATION (with the owner in AE)
- Fresh gen (image/video/sfx) on Free plan: gallery card + lightbox show media; video plays
  with real duration; audio plays.
- Old gens (pre-derivative): "Media unavailable" tile, NOT black; import/download behave per
  plan gate.
- 30-minute session: media stays visible (no mid-session death); zero console errors on a
  full click-through (tabs, select mode, zoom, import, delete, restore).
- node --check + install-cep.sh; state the confirmed root causes in the summary.
```

**Model:** Fable 5 (High) — jonli CEP diagnostika + server-klient kesishma + eski Chromium
moslik masalasi. Bu promptni P1 va P9'dan KEYIN ishlating.

## Hidden problems (folded into the prompt)

- **P22.1** — Plugin viewing leans on `a.url` (plan-gated, can be EMPTY for Free) while web
  uses derivatives — architectural drift between the two clients.
- **P22.2** — Possible silent prod failure of the watermark pipeline (watermarkKey null on
  new Free gens) — diagnosis included; P1 removes the pipeline anyway.
- **P22.3** — One bad gallery item can kill every handler (no per-item error isolation).
- **P22.4** — CEP Chromium is older than web Chrome — modern JS from BATCH ports may not
  parse/run there; node --check cannot catch it.
- **P22.5** — ORDERING: P1 + P9 first; they may resolve most of the visible blackness, and
  P22 then fixes what remains (buttons, isolation, compat).

---

# P23 — Gen cards flicker/redraw themselves every 3-4 seconds (web + plugin) + plugin
# toasts/notification banners look ugly

## Owner's report

1. Gen cards keep re-rendering by themselves every few seconds: the gradient placeholder
   flashes, then the media redraws on top — repeatedly, on BOTH web and plugin (worst while
   a generation is running).
2. Plugin notifications/banners look ugly everywhere (toasts, helper banners like the Voice
   pane instruction).

## Director's code analysis

1. **Flicker = poll-tick full re-render.** While a job runs, the client polls
   `GET /gen/:jobId` every ~3s (`_pollT` timers, web `:19790`; plugin `:11697`). Each tick
   calls setState → the custom sc- runtime re-renders the gallery region and RECREATES the
   `<img>/<video>` nodes → paint gap shows the gradient base, then media re-decodes → the
   "every 3-4 seconds" flash. Two aggravators: (a) signed-URL churn re-downloads media on
   re-render (P9 fixes: stable CDN URLs + browser cache); (b) the A→J work stopped the
   scroll/timer global re-renders, but POLL ticks still re-render the whole grid. The
   pending-card markup already carries `data-jid` (`:16846`) — targeted updates are possible
   exactly like the contributor upload rows (P3 pattern: `bulkUpdateRow`).
2. **Plugin toasts:** functional but unstyled relative to the web (raw rectangles, no
   type-colors/icon/radius/stacking) — a cosmetic unification pass.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Web: packages/assetflow-studio/platform/
index.html (poll timers _pollT ~:19760-19793; pending cards data-jid :16846; gallery
sc-for :16860). Plugin: plugins/after-effects-cep/AssetFlow_Plugin.html (job poll :11697,
recent strip/gallery renders; toast implementation — grep showToast).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN (poll cadence/charging untouched — this is rendering only).
- English UI; Uzbek code comments. Minimal diff. ⚠️ BATCH6/8 uncommitted → stop/report.
- 🔴 PLUGIN PARITY: both clients in this one prompt.
- ORDERING: P9 (stable CDN URLs) ideally first — it removes the re-download half of the
  flash; this prompt removes the re-render half.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — poll ticks must NOT re-render the gallery (web):
In the job poll tick: while status is running/queued, DO NOT setState for progress. Update
the pending card in place via DOM (querySelector('[data-jid="'+id+'"]') → update pct/status
text/progress bar — mirror the contributor bulkUpdateRow pattern). Only when the job
COMPLETES or FAILS: one setState that inserts the finished item / error state (full render
once — acceptable). Keep _clearPollTimers semantics. If OTHER periodic setState sources
re-render the grid while idle (verify: credits refresh? focus refetch? sessions poll?), list
them in the summary and, when trivial, gate them the same way (only setState when data
actually changed — compare a small signature before calling setState).
FIX 1b — media node stability: in the gallery templates, ensure identical items don't get
new src strings between renders (after P9 the URLs are stable — verify no cache-bust query
is appended per render). The loadedSet/va-skel logic must keep a re-rendered already-loaded
item WITHOUT its skeleton class (verify; fix if the id set is dropped on re-render).

FIX 2 — plugin: same discipline (AssetFlow_Plugin.html):
The job poll (:11697 onwards) and the recent-strip updates must update ONLY the pending
tile's DOM until done; single full refresh on completion. Verify with a running gen that the
other cards' <img>/<video> elements are NOT recreated (devtools: element identity persists).

FIX 3 — plugin toast/banner polish:
Restyle the plugin toast to match the web pattern: fixed bottom-center stack, 12px radius,
type colors (info/success/warn/error) + small inline SVG icon, max-width, auto-dismiss with
slide/fade, max 3 stacked (older collapse). Instructional banners (e.g. the Voice pane
helper) get the standard info-banner look (muted background, icon, tight typography) —
reuse existing plugin CSS variables/themes; no internet assets. Keep showToast() signature
unchanged (call sites untouched).

VALIDATION
- Web: start a 30s+ video gen → pending card's progress updates smoothly; OTHER cards never
  flash (devtools: their <img> nodes keep identity across the whole run); completion inserts
  the result once.
- Idle for 2 minutes on the gallery: zero re-renders (no gradient flashes).
- Plugin: same two checks in AE; toasts look consistent in all types; helper banners match.
- node --check + install-cep.sh.
```

**Model:** Fable 5 (Medium) — poll→targeted-DOM refactor ikkala klientda, tugash oqimini
buzmaslik kerak. Kvota tejash: Opus 4.8.

## Hidden problems (folded into the prompt)

- **P23.1** — The A→J "global re-render stopped" fix missed the POLL path — timers were
  fixed, polls weren't.
- **P23.2** — Signed-URL churn (P9) and node recreation (this) are two halves of one flash;
  fixing only one leaves a subtler flicker.
- **P23.3** — Idle-time re-renders may also come from credits/focus/session refreshers —
  audited and signature-gated in the same pass.
- **P23.4** — Plugin toast call sites are everywhere — restyle must keep the showToast()
  API identical.

---

# P24 — Plugin video gen shows only the 3 Veo models — Seedance 2.0 / Gemini Omni Flash
# hidden (OWNER DECISION: open them in the plugin)

## Owner's report

In the plugin's Video tool the model picker lists only Veo 3.1 Lite / Fast / 3.1 — the other
video models (visible on web) don't appear at all.

## Director's code analysis

This is the deliberate **PROBLEM 3** gate from BATCH5, now revoked by the owner. The filter:
`AssetFlow_Plugin.html:12691` (`ensureVgMeta`):

```js
var fal=((r&&r.models)||[]).filter(function(x){ return x&&x.mode==='video'
  && x.refKind!=='media-refs' && x.feature!=='reference-to-video'
  && x.feature!=='video-upscale'; });
```

Seedance 2.0 and Gemini Omni Flash are `media-refs`/R2V models → filtered out; Veo models are
`refKind='frames'` → shown. The comments (`:12686-12689`) document the old decision ("R2V
web'da qoladi"). Important: BATCH5 ALREADY ported much of the media-refs infrastructure to
the plugin (mref pool, `vgPruneMrefFor` handles `caps.kind==='media-refs'` `:12706-12711`,
pill editor, mention tokens) — the runway exists; the gate just blocks the models.
`video-upscale` stays excluded (it's a card action, not a composer model — BATCH4 #2).
The "More video models coming in the future" hint box (`:4388 vgMHint`) also needs updating.

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Plugin:
plugins/after-effects-cep/AssetFlow_Plugin.html (video composer 'vg' section; model load
ensureVgMeta :12680; media-refs infra from BATCH5: mref pool, vgPruneMrefFor :12706, pill
editor, rewriteMentionTokens). Server model catalog is the source of truth (enabled flags).
OWNER DECISION (2026-07-14): media-refs / reference-to-video video models are now ALLOWED in
the plugin (revokes BATCH5 "PROBLEM 3" web-only gate).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN: cost-quote/HMAC flow untouched — the plugin already quotes+signs
  per generate; new models ride the same path.
- English UI; Uzbek code comments. Minimal diff. ⚠️ BATCH8 uncommitted changes → stop/report.
- 🔴 Do NOT renumber @N tokens; reference-pool semantics preserved.
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX — open media-refs video models in the plugin composer:
1. ensureVgMeta filter (:12691): remove the refKind!=='media-refs' and
   feature!=='reference-to-video' conditions. KEEP feature!=='video-upscale' (card action,
   not composer). Update the Uzbek comments (:12686-12689) to record the owner's 2026-07-14
   reversal of PROBLEM 3.
2. Composer capability wiring: when the selected model is media-refs (Seedance 2.0 / Omni),
   the FRAMES row (Start/End add-frame) must swap to the media-refs UI (mref pool with per-
   type limits from model caps — vgPruneMrefFor already computes this; verify the pane
   renders image/video/audio slots per caps.limits and the FAST frames UI hides). When a
   frames model (Veo) is selected — current UI unchanged. Model switch between kinds: prune
   refs via existing vgPruneMrefFor + rewritePromptTokens (never renumber — the P13 pool
   rules).
3. Aspect/duration/resolution chips: ensure per-model params render from the model
   descriptor for the new models (Seedance's res/duration options differ from Veo — the
   descriptors come from /gen/models; do not hardcode).
4. vgMHint box (:4388 "More video models coming in the future"): remove it or repurpose to
   show only when the server returns ≤3 video models.
5. SD2-EDIT-PRESETS chips: with Seedance selectable in the plugin, the preset chips' model
   gate from P18 now MATCHES in the plugin too — verify both copies stay in sync.

VALIDATION (live, with owner — costs credits; use the CHEAPEST params)
- Picker lists Veo ×3 + Seedance 2.0 + Gemini Omni Flash (+ anything else server-enabled),
  each with correct price chip.
- Seedance 2.0 selected: media-refs pane appears (frames UI hidden); attach 1 image ref →
  @img1 pill; generate at 480p/4s (cheapest) → job completes, result renders, ONE charge at
  the quoted price (ledger check).
- Veo 3.1 Lite still works exactly as before (frames UI, start-frame flow).
- Switch Seedance→Veo→Seedance: refs pruned per caps, tokens never renumbered, no dead
  buttons.
- node --check + install-cep.sh.
```

**Model:** Fable 5 (Medium) — plagin kompozerining ikki rejimini (frames ↔ media-refs)
almashtirish + jonli pullik test. Kvota tejash: Opus 4.8.

## Hidden problems (folded into the prompt)

- **P24.1** — The composer must SWITCH UI modes per model kind (frames vs media-refs) — the
  infra exists (BATCH5) but the swap path was never exercised in the plugin.
- **P24.2** — Model descriptors (res/duration) differ per model — hardcoded Veo assumptions
  would silently mis-quote Seedance params (quote/HMAC would reject — still, UI must send
  valid params).
- **P24.3** — The "more models coming" hint becomes a lie once models appear — condition it.
- **P24.4** — P18's preset-chip gate and this change interact (Seedance now valid in plugin)
  — both copies of SD2-EDIT-PRESETS must agree.

---

# P35 — Plugin downloads a pack but can't OPEN it in AE + delivered ZIPs leak the
# contributor's preview/thumbnail media to buyers

## Owner's report

1. In the plugin, a template (e.g. "Fast Light Leaks Transitions Bundle", 277MB zip)
   downloads fine but never opens in AE.
2. When a user downloads a template (web or plugin), the marketing files the contributor
   bundled inside the zip (preview video / thumbnail images) must NOT reach the user.

## Director's code analysis

1. **Plugin import supports ONLY `.aep`/`.mogrt` packs.** `assetflow-catalog.js:1206-1221`:
   after extraction it looks for `.aep`, then `.mogrt`; otherwise throws "No .aep or .mogrt
   found inside the ZIP." A transitions/overlay bundle whose zip contains only FOOTAGE
   (mp4/mov clips) — exactly what the raw-file ingest pipeline now produces and what
   contributors upload as bundles — can never open. The error may also not be surfaced
   ("downloads but nothing happens").
2. **Delivered zips are byte-identical to the upload** (`serve-asset.ts:35-40` explicitly
   serves zip packs unmodified; the `pack.dl.zip` cache is ONLY used to wrap raw `.aep`).
   So preview.mp4/thumbnail.jpg the contributor left inside ship to every buyer.
3. **Precise strip list exists at ingest:** `ingest-zip.ts` already IDENTIFIES which zip
   entries it used as preview/thumb — recording those entry names at ingest gives an exact,
   guess-free filter (never risks deleting real footage the .aep references).

## Code prompt (self-contained — run in Claude Code)

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). Server: apps/api/src/lib/serve-asset.ts
(zip packs byte-identical; getOrBuildAepDownloadZip caches templates/<id>/pack.dl.zip via
yazl streaming — reuse this machinery), apps/api/src/lib/ingest-zip.ts (picks preview/thumb
entries from the upload), contributor.ts:1608 (pack.dl.zip cache invalidation on re-upload).
Plugin: plugins/after-effects-cep/assetflow-catalog.js (zip import :1176-1222, .aep/.mogrt
only; aiImportMedia exists for footage import), AssetFlow_Plugin.html (recordImport flow).

GLOBAL RULES
- 🔴 MONEY ZONE IS FROZEN. consumeDownload/limit values untouched — download counting must
  remain exactly ONE count per successful user action.
- 🔴 Do NOT loosen isPublicReadKey() (pack.dl.zip stays private — it already is).
- ⚠️ HEED the warning at serve-asset.ts:35-40: do NOT strip at INGEST and do NOT extract
  .aep-only — footage inside the zip is required content. Filtering happens on a SEPARATE
  cached download copy, by an exact entry list, never by guessing.
- English UI; Uzbek code comments. Migrations: none (metaJson additive field).
- 🔴 PLUGIN PARITY + live AE test with the owner (this very bundle).
- When finished: (a) commit (no Co-Authored-By); do NOT push. (b) short summary.

FIX 1 — plugin: footage-bundle import fallback (assetflow-catalog.js):
After extraction, when NO .aep and NO .mogrt found (:1206-1221), instead of throwing:
a) Collect importable media in the extracted dir: .mp4/.mov/.webm/.mp3/.wav/.png/.jpg/.jpeg
   (+ .cube if LUT packs reach this path — align with existing LUT guidance if any).
b) If ≥1 media file: import ALL into the AE project as FOOTAGE via the existing ExtendScript
   import path (reuse aiImportMedia/host.jsx mechanism), grouped into a bin named after the
   template, one progress toast ("Importing 15 items…"). recordImport fires ONCE for the
   whole action (verify the counting call site — not per file).
c) Zero media: keep the explicit error and ALWAYS surface it as a toast (verify the caller
   doesn't swallow — owner saw "nothing happens").
d) Skip junk during collection: __MACOSX/, .DS_Store, and entries matching the server's
   stripped list (old cached extractions may still contain them).

FIX 2 — server: strip contributor marketing files from the DOWNLOAD copy:
a) INGEST (ingest-zip.ts): record zip entry paths chosen as preview/thumb (plus obvious
   junk: __MACOSX/*, .DS_Store, root-level preview.*/thumbnail.*/screenshot.*) into
   metaJson.packJunkEntries (additive). Do NOT modify the stored original pack.zip.
b) SERVE (serve-asset.ts pack branch): for zip packs with non-empty packJunkEntries,
   build-and-cache templates/<id>/pack.dl.zip = original minus those entries (streaming:
   yauzl read → yazl write → uploadStreamToS3, same memory discipline as
   getOrBuildAepDownloadZip). Serve the filtered copy; on build failure fall back to the
   original (log, never block downloads). Empty list → serve original (no rebuild).
c) Cache invalidation: re-upload already deletes pack.dl.zip (contributor.ts:1608) — verify
   it covers this new usage.
d) BACKFILL: scripts/backfill-pack-junk.mjs — re-scan existing published packs with the
   same detector to populate packJunkEntries (dry-run flag; owner runs). Purge stale
   pack.dl.zip for affected ids.

VALIDATION (live with owner)
- This exact bundle: plugin Import → clips appear in an AE bin named after the template;
  download count +1 (not +15).
- An .aep-based template opens exactly as before; .mogrt flow untouched.
- Web download of the bundle: zip lacks preview/thumbnail entries (diff entry lists) but
  ALL transition clips remain.
- Free plan past limit: still hard 403 (consumeDownload untouched).
- node --check + install-cep.sh; backfill dry-run lists affected templates.
```

**Model:** Fable 5 (Medium) — server streaming-zip filtri + plagin import-fallback + jonli
AE test; download-hisob atrofida ehtiyot. Kvota tejash: Opus 4.8.

## Hidden problems (folded into the prompt)

- **P35.1** — Content pipeline now produces footage-only packs, but the plugin importer
  still assumes the .aep-era world — architectural drift.
- **P35.2** — Import failure was silent ("nothing happens") — error surfacing is part of
  the fix.
- **P35.3** — Stripping must use the EXACT ingest-recorded entry list — pattern-guessing on
  arbitrary contributor zips risks deleting referenced footage (the serve-asset.ts:35-40
  warning exists for this reason).
- **P35.4** — recordImport must count ONE action even when importing 15 clips.
- **P35.5** — Existing published packs need the backfill or they keep leaking previews.

---

*(More problems will be appended below as the owner reports them.)*
