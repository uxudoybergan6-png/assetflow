# FrameFlow — Fix Prompts BATCH3 (2026-07-10, live testing)

> One document. Each problem is a COMPLETE, self-contained, ordered prompt for Claude Code.
> Execute top to bottom, one at a time; each ends with its own commit. The USER reviews the
> result (screenshot / summary) after each. DO NOT PUSH — the USER pushes.

## ▶ HOW TO RUN (Claude Code — read this first)
Work through EVERY problem below **in the EXECUTION ORDER**, one at a time, autonomously:
1. Obey the **GLOBAL RULES** for every problem (money-zone byte-for-byte, additive migrations, English UI,
   Studio source→`studio:sync`, plugin→`install-cep.sh`, minimal diff).
2. Do ONE problem fully → **commit** it with a clear message (**no `Co-Authored-By`**) → write a 2–3 line
   summary → then move to the NEXT problem. **DO NOT PUSH** (the USER pushes).
3. Respect dependencies: **#10 before #3**, **#5 before #8**. The `platform/index.html` problems
   (#3, #6, #7, #1, #5, #8) edit different regions of the SAME file — do them sequentially in order and
   re-read the file before each so you don't regress the previous edit.
4. **STOP and ask ONLY if** a change would require touching the money-zone (credit/quote/HMAC/webhook),
   or a migration can't be additive, or a prompt's assumption doesn't match the actual code. Otherwise
   keep going to the end.
5. After the last problem, print a final checklist: each problem → commit hash + one-line result + any
   items the USER must do (push, `migrate:deploy`, `install-cep.sh`, live-verify #3 after #10 deploys).

## GLOBAL RULES (apply to EVERY problem — do not break)

- **Money-zone is untouchable:** credit consume/refund, the signed cost-quote and its HMAC
  (`lib/gen-quote.ts`, `computeGenCost`/`imageUnitCost` in `gen-models.ts`, `plugin-profile.ts`),
  webhook idempotency, or any credit VALUE — never change them. If a fix would touch these, STOP
  and flag it.
- **Migrations are additive only** (new table/column; never breaking). Use the project's
  `migrate:deploy` flow; test the migration on the local/dev DB.
- **English UI**; code comments in Uzbek (project convention).
- **Build pipeline:** `packages/assetflow-studio/platform/index.html` = the Cloudflare Pages DIRECT
  source (edit it directly). Admin + shared `js/`/`styles/` = Studio SOURCE — edit the ROOT
  `packages/assetflow-studio/js|styles` (plus `admin/`, `contributor/` source), then run
  `npm run studio:sync`; never edit the `studio/`/`admin/` build artifacts. Do not touch the landing
  (`ffl-`) styles.
- **Plugin:** `plugins/after-effects-cep/` — After Effects has no internet (self-host fonts, inline
  SVG). After editing, run `bash plugins/after-effects-cep/scripts/install-cep.sh` (the USER restarts
  AE). AE isn't automatable — verify with `node --check` + a DOM/handler check + a precise behavior
  description.
- **Minimal, narrow diff.** Reuse the existing component/endpoint. Don't regress prior work.
- **Each problem:** commit in logical chunks with a clear message, **NO `Co-Authored-By`**; DO NOT
  PUSH. End with a short summary (root cause, what changed, verification).

---

## EXECUTION ORDER
(Numbers in [#] are STABLE IDs = the section headers below. Run in THIS sequence — grouped by
dependency + file so Code isn't confused. #4 was merged into #3.)

**Contributor / templates:**
1. **[#10] (Stock S1)** Contributor upload → Motion-Elements kind-picker + data model (`kind`/`stockType`/
   `templateType`) + granular alignment. FOUNDATION — provides `t.type` for #3. Model: **Fable 5 (+Extra)**.
2. **[#11] Audit §D** Contributor upload/chain fixes (templateApp mislabel, orient/res reset, rights dead-end, …). Model: **Fable 5 (+Extra)**.
3. **[#3]** Web Templates filtering — pills by `templateType` + Envato-style filter bar. Needs #10. Model: **Fable 5 (+Extra)**.
4. **[#12] Audit §B** Web Templates/catalog fixes (premature empty, name-only search, sort, poster, …). After #3, same file. Model: **Fable 5 (+Extra)**.

**Admin:**
5. **[#2]** Admin subscriber profile — view + download a subscriber's generations. Model: **Sonnet 5**.
6. **[#14] Audit §C** Admin fixes (message no-op, stale moderation tabs, count drift, block-endpoint security, …). Model: **Fable 5 (+Extra)**.

**Web AI Studio (all `platform/index.html` — strictly sequential):**
7. **[#6]** Enlarge results tiles + Full/Compact view toggle. Model: **Fable 5 (+Extra)**.
8. **[#7]** Composer compact + centered (floating). Model: **Sonnet 5**.
9. **[#1]** Prompt input grows into a large Artlist-style panel. Model: **Sonnet 5**.
10. **[#5]** Reference add UX → single "+" typed menu. Model: **Fable 5 (+Extra)**.
11. **[#8]** Add "My Library" as a reference source. Needs #5. Model: **Fable 5 (+Extra)**.
12. **[#13] Audit §A** AI Studio fixes (dead lightbox Reference, pollJob hang, expiry stuck, …). After the group, same file. Model: **Fable 5 (+Extra)**.

**Plugin:**
13. **[#9]** Plugin AI Studio — add "My Library" as a reference source (AE). Model: **Fable 5 (+Extra)**.

⚠️ **Same-file caution:** #3, #12, #6, #7, #1, #5, #8, #13 all edit `platform/index.html` (different
regions) — run ONE AT A TIME in the order above, re-reading the file before each. #11/#14 also touch
backend + admin sources (`studio:sync` after ROOT `js/` edits). Audit detail: `docs/DIREKTOR-AUDIT-2026-07-10.md`.

---

## 1 — Web AI Studio: enlarge the prompt input (composer textarea)

**Report:** On the web, the AI Studio composer prompt field is too small — with a long prompt the text
is clipped, only ~2 lines show and the top scrolls out of view. It happens especially after clicking
**Enhance** (a long polished prompt is inserted). **Target UX = Artlist:** when the prompt is long, the
composer should expand into a large panel that shows the ENTIRE prompt at once (grow up to ~60vh, then
scroll), with the controls row (mode/model/aspect/Enhance/Generate) staying docked at the bottom — not a
small 2-line box.

**Director's investigation (already grounded in the code — Code should trust this, not re-discover):**
- The live composer is `.va-dock` in `platform/index.html`; the prompt element is
  `<textarea … class="prompt">` at **~line 16476**.
- Its CSS is `.ff .va-dock .prompt` at **~line 15193**: currently `min-height:40px; max-height:240px;
  resize:none; line-height:1.5; font-size:13.5px` → the 40px min is only ~2 lines.
- An auto-grow handler already exists — `setPrompt` at **~line 19524**:
  `ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight,240)+'px'`. It fires **only on the
  textarea's `oninput`** (user typing).
- **ROOT CAUSE:** when the prompt is set **programmatically** the height is never recomputed, so a long
  value stays clamped at min-height and the top is clipped. Programmatic setters include: **Enhance**
  result (`setState({ aiPrompt: r.prompt })`, ~line 18250), **chip** insert (`onChip`, ~line 19456),
  **suggestion** insert (`onSuggest`, ~line 19439), and **gen/session restore** (`aiPrompt: g.prompt`,
  ~line 18349). The screenshot (a long *enhanced* prompt clipped to ~2 lines) matches this exactly.
- NOTE: the `.ffa-st-*` CSS block (~lines 14778–14859) is an older/dead mockup and is NOT the live
  composer — do **not** edit it.

**Model:** Sonnet 5 (small, single file, CSS + a small JS resize helper).

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Edit only `packages/assetflow-studio/platform/index.html` (the
> Cloudflare Pages web-app source — do NOT edit `studio/`/`admin/` build artifacts, and do NOT touch the
> landing `ffl-` styles). The app renders via the in-repo "dc-runtime" templating (React-like). The AI
> Studio screen has a bottom-docked composer `.va-dock` whose prompt input is
> `<textarea … class="prompt">` (~line 16476). Its CSS is `.ff .va-dock .prompt` (~line 15193):
> `min-height:40px; max-height:240px; resize:none`. An auto-grow handler `setPrompt` (~line 19524) runs
> `ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight,240)+'px'` but **only on the
> textarea's `oninput`** (user typing).
>
> **PROBLEM & ROOT CAUSE.** The field is too small by default (min-height 40px ≈ 2 lines), and — the real
> bug — when the prompt is set **programmatically** the height is never recomputed, so long values stay
> clamped and the top is clipped. Programmatic setters: Enhance result (`setState({ aiPrompt: r.prompt })`,
> ~line 18250), chip insert (`onChip`, ~line 19456), suggestion insert (`onSuggest`, ~line 19439), and
> gen/session restore (`aiPrompt: g.prompt`, ~line 18349).
>
> **TASK — make the composer expand like Artlist (large panel showing the whole prompt).**
> 1. In `.ff .va-dock .prompt` (~line 15193): raise `min-height` from 40px to **~92px** (comfortable
>    ~4–5 lines by default) and raise `max-height` from 240px to **~60vh** (Artlist-style large panel);
>    add `overflow-y:auto` so text past the cap scrolls inside the field (never clipped at the top). Keep
>    `resize:none`, the font, line-height, colors, and the transparent background unchanged. The docked
>    `.va-dock` container must be allowed to grow taller with the textarea (it grows upward from the
>    bottom); ensure it never exceeds the viewport — if needed, cap the whole dock at ~`calc(100vh - Npx)`
>    and let the textarea take the remaining space, so the controls row and BALANCE line always stay
>    visible and the prompt scrolls internally.
> 2. Add ONE small resize helper (e.g. `afSizePromptTa()`) that finds `document.querySelector('.va-dock
>    .prompt')` and sets `el.style.height='auto'; el.style.height=Math.min(el.scrollHeight, CAP)+'px'`,
>    where **`CAP = Math.round(window.innerHeight * 0.6)`** (matches the CSS 60vh, viewport-relative so it
>    stays Artlist-large on desktop but bounded on small screens). The codebase already uses the
>    `setTimeout(()=>{ …querySelector('.va-dock .prompt')… }, 60)` pattern (see ~lines 18332 and 18380) —
>    reuse that exact pattern to call the helper **after re-render** for every programmatic change:
>    Enhance result, `onChip`, `onSuggest`, and gen/session restore. Do not add a second input handler —
>    extend/keep the existing `setPrompt`.
> 3. Update the existing `setPrompt` (~line 19524): replace the hardcoded `240` cap with the same
>    viewport-relative `CAP` so the typing path and the programmatic path agree with the CSS 60vh.
> 4. Responsive: in the mobile media block where `.va-dock` becomes static (~line 15500), give
>    `.va-dock .prompt` a `min-height` (~72px) and `max-height` ~50vh so a long prompt is still fully
>    readable while the Generate button stays reachable above the keyboard.
>
> **CONSTRAINTS.**
> - MONEY-ZONE UNTOUCHED: do NOT modify generation, cost-quote, credit consume/refund, computeGenCost,
>   or any pricing/HMAC logic. This is a pure UI (CSS + textarea auto-size) change.
> - English UI. Minimal, narrow diff. Edit only `platform/index.html`. Do NOT touch the dead `.ffa-st-*`
>   CSS (~lines 14778–14859) or the landing `ffl-` styles.
>
> **VERIFY.** Screenshots at 1280px and 390px. Confirm: (a) the composer shows ~4–5 lines by default;
> (b) typing/pasting a long prompt expands the composer into a large Artlist-style panel showing the
> whole prompt, up to ~60vh, then scrolls internally; (c) **clicking Enhance** (or inserting a
> suggestion/chip) so a long prompt is set programmatically expands the panel to fit — no top clipping
> (this is the key regression); (d) Generate / COST / BALANCE stay visible and clickable and the composer
> stays docked even when expanded (never off-screen); (e) no console errors. Compare against the Artlist
> reference (a large expanded prompt panel).
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 2 — Admin subscriber profile: view + download a subscriber's generations

**Report:** In the admin panel, on a subscriber's profile the "Generations" list shows the images/videos
the user generated, but clicking one opens a broken/empty modal (broken-image icon), and there is no way
to download the media.

**Director's investigation (grounded in the code — Code should trust this, not re-discover):**
- Admin UI source: `packages/assetflow-studio/js/admin-subscribers.js` (ROOT = SOURCE; the `admin/js/`
  and `studio/js/` copies are build artifacts — after editing run `npm run studio:sync`).
  - `subGenCard(g)` (~line 238): `const a = g.assets[0]; isVideo = a && a.type === "video";` and the
    thumb's onclick calls `subGenPreview(a.url, isVideo)`.
  - `subGenPreview(url, isVideo)` (~line 255): opens a modal with `<video src=url controls>` when
    isVideo else `<img src=url>`, and only a "Close" button.
- Backend: `GET /api/admin/users/:id/generations` in `apps/api/src/routes/admin.ts` (~line 773). It calls
  `hydrateGenAssets(g)` and then maps `assets: g.assets.map(a => ({ type: a.type, url: a.url,
  thumbUrl: a.thumbUrl }))` (~line 806).
- `hydrateGenAssets` (in `apps/api/src/routes/studio-gen.ts` ~line 96) signs `a.url` (inline, 1h) and
  ALSO computes `aa.downloadUrl` = a signed URL with `Content-Disposition: attachment` (~line 134).
- **`GenAsset.type` is a NUMERIC code** — `const ASSET_TYPE = { image: 130, audio: 120, video: 140 }`
  (`apps/api/src/lib/gen-processor.ts` ~line 54). The DB stores 130/120/140, not the strings
  "image"/"video"/"audio".
- **ROOT CAUSE #1 (broken media):** the admin UI checks `a.type === "video"`, but `a.type` is `140`
  (a number). So `isVideo` is ALWAYS false → a video is rendered as `<img src=<mp4>>` → broken image
  (exactly the screenshot: a Veo video gen). Audio assets (120) aren't handled at all.
- **ROOT CAUSE #2 (no download):** the admin endpoint drops the already-computed `downloadUrl`, and the
  modal has no download control.

**Model:** Sonnet 5 (small, backend response mapping + admin JS; then `studio:sync`).

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Two files:
> - Backend: `apps/api/src/routes/admin.ts`, route `GET /api/admin/users/:id/generations` (~line 773).
>   It already runs `hydrateGenAssets(g)` (from `apps/api/src/routes/studio-gen.ts`), which signs
>   `a.url` and computes `a.downloadUrl` (signed with `Content-Disposition: attachment`). The response
>   maps `assets: g.assets.map(a => ({ type: a.type, url: a.url, thumbUrl: a.thumbUrl }))` (~line 806).
> - Admin UI SOURCE: `packages/assetflow-studio/js/admin-subscribers.js` (edit the ROOT copy, then run
>   `npm run studio:sync`; do NOT edit `admin/js/` or `studio/js/` artifacts). Functions `subGenCard`
>   (~line 238) and `subGenPreview` (~line 255).
>
> **ROOT CAUSE.** `GenAsset.type` is a numeric code — `{ image: 130, audio: 120, video: 140 }`
> (`apps/api/src/lib/gen-processor.ts` ~line 54). The admin UI checks `a.type === "video"` (a string),
> which is never true, so videos render inside `<img>` and break. Also the endpoint doesn't return the
> `downloadUrl` that `hydrateGenAssets` already computes, so there's no way to download.
>
> **TASK.**
> 1. Backend (`admin.ts`, the generations mapping ~line 806): for each asset, return a normalized
>    string `kind` of `"image" | "video" | "audio"` derived from the numeric type (140→video, 120→audio,
>    else→image), and include `downloadUrl: (a as any).downloadUrl ?? a.url`. Keep `url` and `thumbUrl`.
>    This is read-only and additive — do NOT change `hydrateGenAssets`, credit/refund, cost, or any
>    money logic.
> 2. Admin UI `subGenCard` (`js/admin-subscribers.js`): stop using `a.type === "video"`. Use the new
>    `kind` (`const kind = a && a.kind; const isVideo = kind === 'video'; const isAudio = kind ===
>    'audio';`). Pass the media info to the preview — call `subGenPreview(a.url, kind, a.downloadUrl)`
>    (escape the args). Keep the existing thumbnail rendering.
> 3. `subGenPreview(url, kind, downloadUrl)`: render by kind —
>    - `video` → `<video src controls autoplay style="width:100%;border-radius:10px">`,
>    - `audio` → `<audio src controls autoplay style="width:100%">`,
>    - else → `<img src style="width:100%;border-radius:10px" onerror="…show 'Preview unavailable — use
>      Open in new tab'…">`.
>    Add a footer with, in addition to Close: a **Download** control — an anchor
>    `<a class="btn btn-primary" href="${esc(downloadUrl||url)}" target="_blank" rel="noopener" download>Download</a>`
>    (the backend downloadUrl already forces attachment) — and an **Open in new tab** ghost link to
>    `url` as a fallback if inline embedding fails.
> 4. Run `npm run studio:sync` so the change propagates to the `admin/` (and `studio/`) build artifacts.
>
> **CONSTRAINTS.**
> - MONEY-ZONE UNTOUCHED: do NOT modify `hydrateGenAssets`, credit consume/refund, cost, quote/HMAC, or
>   any pricing logic. This is a read-only response field + UI rendering change.
> - English UI. Minimal, narrow diff. Additive backend field (`kind`, `downloadUrl`); don't remove `url`
>   / `thumbUrl` / `type`. Edit the ROOT `js/admin-subscribers.js`, never the build artifacts.
>
> **VERIFY.** `node --check` the edited JS. Confirm the built `admin/js/admin-subscribers.js` matches
> after `studio:sync`. Describe the expected behavior on a subscriber profile: a **video** generation
> opens and plays in the modal (no broken image), an **image** opens as an image, **audio** opens in an
> `<audio>` player, and each has a working **Download** button (saves the file) plus **Open in new tab**.
> Show the before/after of the `admin.ts` assets mapping and the `subGenCard`/`subGenPreview` diff.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 3 — Web Templates: fix pill filtering (by `templateType`) + add an Envato-Elements-style filter bar (MERGED #3+#4)

**Report:** Two related fixes on the web Templates page, in ONE prompt (same file, same feature — combined
so Code isn't confused): (a) the top pills (Templates · Motion · Graphics · LUTs) misclassify — clicking
**Templates** shows "0 results" even though a template exists; (b) the filter bar is thin — add richer,
Envato-Elements-style filtering (Categories multi-select, Applications Supported multi-select, Resolution,
Sort). Keep the 4 pills. **Depends on S1 (#10)** which adds `t.type` + aligned granular categories — run
AFTER #10.

**Director's investigation (grounded in the code — trust this):**
- Pills: `fCatsView` → `onFCat` set `this.state.fCat` (Templates|Motion|Graphics|LUTs) (`platform/index.html`
  `.va-catchips` ~line 16239). The filter (`filtered`, ~line 18862) narrows by `this.catBucket(t) ===
  this.state.fCat`. `catBucket` (~line 17687) is a keyword regex whose Motion branch matches `reveal`, so a
  "Logo Reveal" template is mislabeled Motion → the Templates pill shows 0. **S1 (#10) adds the explicit
  broad `t.type`** (`video-templates`|`motion-graphics`|`graphics`|`luts`) — filter by that instead.
- Filter bar `.va-fbar` (~line 16242): App single-select (`fApp` All/Ae/Pr/Mn/Dr), Plan (`fPlan`), Orientation
  chips (`fOrient`), Resolution chips (`fQual` HD/4K), results count, Sort (`toggleSort`/`pickSort`).
  Filtering is CLIENT-SIDE over loaded items with fields `t.a` (app), `t.c` (granular category), `t.type`
  (from S1), `t.pro`, `t.ori`, `t.qual`, `t.n`. No backend change needed.
- Granular truth: `TEMPLATE_CATEGORIES` (`apps/api/src/lib/ai/template-metadata.ts`, 14 real + Uncategorized).
  Apps (F5, `apps/api/src/lib/apps.ts`): After Effects, Premiere Pro, Apple Motion, DaVinci Resolve — NO
  Final Cut Pro.

**Model:** Fable 5 (+Extra) — pill logic + multi-part filter-bar UI + state refactor, single file.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Edit only `packages/assetflow-studio/platform/index.html` (do not touch
> `studio/`/`admin/` artifacts or landing `ffl-`). The Templates page has 4 top pills
> (`fCatsView`/`onFCat`/`fCat`) and a filter bar `.va-fbar` (~line 16242); filtering is client-side in
> `filtered` (~line 18862) over items with `t.a` (app Ae/Pr/Mn/Dr), `t.c` (granular category), `t.type`
> (broad type from S1: `video-templates`|`motion-graphics`|`graphics`|`luts`), `t.pro`, `t.ori`, `t.qual`
> (HD/4K), `t.n`. Currently pills use the `catBucket` keyword heuristic (~line 17687) which mis-buckets
> "Logo Reveal". **This runs AFTER S1 (#10)**, which provides `t.type` and aligned granular categories.
>
> **PART A — pills filter by `t.type` (not keyword guessing).** Map the 4 pills 1:1: Templates→
> `video-templates`, Motion→`motion-graphics`, Graphics→`graphics`, LUTs→`luts`. Change the pill predicate
> in `filtered` to match `typeOf(t) === <pill's type>` where `typeOf(t) = t.type || mapCategoryToType(t.c)
> || keywordFallback(t)` (legacy fallback so nothing disappears). Legacy map: `luts`←LUTs; `graphics`←
> Infographics/Social Media/Logos/Mockups/Backgrounds; `motion-graphics`←Titles/Lower Thirds/Transitions/
> Intros/Openers/Overlays/Slideshows; `video-templates`←everything else (Logo Reveal, Uncategorized,
> unknown). Keep pill markup/labels unchanged; default first load shows the full catalog.
>
> **PART B — Envato-Elements-style filter bar (client-side, keep it in FrameFlow's `.va-fbar`/`.va-fpop`
> lime style; inspired, not a 1:1 copy).**
> 1. **Categories (multi-select):** a dropdown listing the granular `TEMPLATE_CATEGORIES` (mirror the 14
>    labels client-side, exclude "Uncategorized"), checkbox rows; filter items where `t.c` matches any
>    selected label (case-insensitive). Empty = no narrowing. Active-count badge + "Clear" row.
> 2. **Applications Supported (multi-select):** convert the single-select App dropdown into a multi-select
>    (After Effects, Premiere Pro, Apple Motion, DaVinci Resolve → `t.a` Ae/Pr/Mn/Dr). Empty = all. NO Final Cut Pro.
> 3. **Resolution:** keep HD/4K (dropdown or chips) wired to `t.qual`. **Sort:** keep existing.
> 4. **State/logic:** convert `fApp`→`fApps: []`, add `fCats: []`; update `filtered`: app-match =
>    `!fApps.length || fApps.includes(t.a)`, category-match = `!fCats.length || fCats.includes(norm(t.c))`.
>    Keep plan/orient/qual/search predicates. Update `resetFilters` to clear the new sets; show "Clear all"
>    when any filter is active. Pills (Part A) and the Categories multi-select COMPOSE (pill = broad type,
>    Categories = granular) — both remain visible and functional.
> 5. Responsive at 1280 + 390 (dropdowns don't overflow; mobile = full-width sheets per the existing pattern).
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED. English UI. Client-side only (no backend/catalog change). Minimal,
> contained diff in `platform/index.html`. Don't regress Plan/Orientation/Sort/search or the masonry grid.
> Don't touch landing `ffl-`.
>
> **VERIFY.** Screenshots 1280/390: (a) clicking **Templates** shows the "Football Championship Logo Reveal"
> template (not 0), the other pills bucket correctly; (b) the Categories multi-select, Applications Supported
> multi-select, Resolution and Sort all work; selecting a category narrows results and "N results" updates;
> multiple apps compose (OR within apps, AND across filter types); "Clear all" resets; pills still work; no
> console errors, no overflow.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 5 — Web AI Studio: rebuild the "add reference" UX to the Artlist pattern

**Report:** The current reference-adding UX in the AI Studio composer is confusing — it shows several
always-visible dashed buttons ("+ Image", "+ Video", "+ Start frame", …). **Inspired by Artlist (NOT a
1:1 copy):** a single circular **"+"** button that opens a small typed menu (rows: **Start & End Frame ·
Image Reference · Video Reference · Audio File**), showing only the options the current model supports;
added references appear as clean chips (thumbnail + remove) next to the "+". IMPORTANT: take inspiration
from the pattern only — keep FrameFlow's OWN design identity (lime accent, dark tokens, existing
components); do not clone Artlist's exact colors/pixels. (Reference screenshots provided; the Artlist AI
Studio is behind login — do NOT try to log into Artlist.)

**Director's investigation (grounded in the code — trust this):**
- The refs row is `.va-axrefs` in `platform/index.html` (~line 16465). It renders `refChipsView`
  (already-added refs, as chips with thumb + remove `removeRef`) then `refAddsView` (the dashed
  `.va-axrefadd` add buttons) then a `refHint`. Add buttons call `addRefK` → `this.addRefFile(k)`.
- `refAddsView`/`refChipsView` are built ~lines 18810–18830 from the model's ref capabilities
  `rCaps` (computed by the ref-capability logic ~line 18281). `rCaps.kind` is one of:
  - `'image'` — image-edit refs up to `rCaps.max` (`k='img'`),
  - `'frames'` — `k='start'` (`rCaps.startRequired` may be true) and `k='end'`,
  - `'media-refs'` — `k='img'|'vid'|'aud'` each up to `rCaps.lim.image|video|audio`,
  - `'none'` — no refs.
- `showRefs = aiIsCanvas && rCaps.kind !== 'none'` (~line 19395). There is an existing popover pattern
  in the same dock — `ffa-pop` styling + a toggle handler (`toggleChip`/`popMode`/`popModel`) used by the
  mode/model dropdowns — reuse it for the "+" menu.
- IMPORTANT: `addRefFile(k)` (upload) and the param-building that maps refs to provider fields
  (`referenceUrl`/`referenceUrls`/start/end — money-zone-adjacent) must NOT change. Only the ADD
  affordance (dashed buttons → "+" menu) and chip styling change.

**Model:** Fable 5 (+Extra) — UX-fidelity restructure (new popover menu + chip restyle), single file.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Edit only `packages/assetflow-studio/platform/index.html` (do not touch
> `studio/`/`admin/` artifacts or landing `ffl-`). In the AI Studio composer, the references row is
> `.va-axrefs` (~line 16465): it renders `refChipsView` (added refs as chips + `removeRef`), then
> `refAddsView` (dashed `.va-axrefadd` buttons → `addRefK` → `this.addRefFile(k)`), then `refHint`. These
> view arrays are built ~lines 18810–18830 from the model capability object `rCaps` (kind =
> `image` | `frames` | `media-refs` | `none`; `rCaps.max`, `rCaps.startRequired`, `rCaps.lim.{image,
> video,audio}`). The dock already has a popover pattern (`ffa-pop` + `toggleChip`/`popMode`) used by the
> mode/model dropdowns.
>
> **GOAL — take inspiration from the Artlist reference UX (NOT a 1:1 clone).** Replace the row of dashed
> add-buttons with a SINGLE circular "+" button that opens a typed menu; keep added refs as clean chips
> beside it. Use FrameFlow's own design tokens (lime accent, existing `ffa-pop`/hairline styles) — do not
> copy Artlist's exact colors or spacing pixel-for-pixel.
>
> **TASK.**
> 1. In `.va-axrefs`, render the added-reference chips (`refChipsView`) as before but restyle them to the
>    Artlist look: a rounded chip with a small thumbnail/icon + a short label + an ✕ remove (keep
>    `removeRef` and the existing data-k/data-i wiring). Labels: image→"Image Reference", start→"Start
>    frame", end→"End frame", vid→"Video Reference", aud→"Audio File".
> 2. Replace the inline `refAddsView` dashed buttons with ONE circular **"+"** trigger button at the start
>    of the row (~44px, dashed→solid hairline, lime hover). Clicking it opens a small dark rounded popover
>    menu (reuse `ffa-pop` styling + a new `popRef` toggle state that closes on outside click like the
>    existing dropdowns).
> 3. The menu lists ONLY the add-actions available for the current model — derive them from the SAME
>    capability logic that currently produces `refAddsView` (do not change `rCaps`; just render the
>    available actions as menu rows instead of inline buttons). Each row = icon + label:
>    - `frames` model → "Start frame" (append "· required" when `startRequired`) and "End frame"
>      (grouped under a small "Start & End Frame" caption, matching Artlist).
>    - `image` model → "Image Reference" (hide the row when `refImages.length >= rCaps.max`).
>    - `media-refs` model → "Image Reference", "Video Reference", "Audio File" — show each only while
>      under its `rCaps.lim` limit.
>    Selecting a row calls the SAME `this.addRefFile(k)` with the correct `k` (`img`/`start`/`end`/`vid`/
>    `aud`) and closes the menu.
> 4. Move the "References: up to N images, M videos" text into the menu as a small caption (or keep it as
>    a subtle hint under the row). Keep the `refBusy` "Uploading…" state.
> 5. Visual + responsive: match the composer's lime/hairline design tokens; the "+" and menu must look
>    like the Artlist screenshots. At 1280px the menu is an anchored popover; at ≤820px/390px it may be a
>    full-width sheet consistent with the current mobile dock pattern. No overflow.
>
> **CONSTRAINTS.**
> - MONEY-ZONE UNTOUCHED: do NOT modify `addRefFile` upload logic, `rCaps` capability computation, the
>   ref→param mapping (`referenceUrl`/`referenceUrls`/start/end), cost-quote, credits, or generation. This
>   is purely the ADD-affordance UI (dashed buttons → "+" menu) and chip restyle.
> - English UI. Minimal, contained diff in `platform/index.html`. Reuse existing handlers/state
>   (`addRefFile`, `removeRef`, `ffa-pop`, the toggle pattern). Don't touch dead `.ffa-st-*` CSS or landing.
>
> **VERIFY.** Screenshots at 1280px and 390px for each capability kind: (a) an **image-edit** model — "+"
> menu shows "Image Reference"; adding one shows a chip; the option disappears at max. (b) a **frames/
> video** model — "+" menu shows Start frame (required where applicable) + End frame. (c) a **media-refs**
> model — "+" menu shows Image/Video/Audio, each hidden when its limit is reached. Confirm selecting a row
> opens the file picker and the uploaded ref becomes a chip; remove works; the menu closes on outside
> click; it visually matches the Artlist reference; no console errors; cost/Generate unaffected.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 6 — Web AI Studio: results canvas feels empty; enlarge tiles + add Full/Compact view toggle

**Report:** The AI Studio results canvas looks poor — a single generated result shows as a small tile in
the top-left with a huge empty black area, while a reference tool (Artlist) fills the canvas with large,
immersive result tiles and offers a **Full view / Compact view** toggle (a grid-density button). Take
inspiration from that (NOT a 1:1 copy — keep FrameFlow's lime/dark identity): make the result tiles
larger/immersive so they fill the canvas, and add a Full/Compact view toggle.

**Director's investigation (grounded in the code — trust this):**
- The results canvas is `.va-axwork` (`platform/index.html` CSS ~line 15290; markup ~line 16300). Its
  header is `.va-axhead` (~line 16335) with the Visuals/Audio segment + a `margin-left:auto` spacer +
  `.smeta` session meta on the right — a natural spot for a view-toggle button.
- Results render into `.va-axgrid` (~line 16377). Its CSS (~line 15358) is a CSS-columns masonry:
  `columns:220px; column-gap:14px` (mobile `columns:2`, ~line 15497). **ROOT CAUSE of the empty feel:**
  fixed 220px columns make tiles small; with few results the canvas is mostly empty.
- Result cards use `.va-axcell` / `.va-axres` inside the grid (~line 16378+). The Visuals/Audio view is
  driven by `aiMediaView` state; segment handler `onMediaView` (~line 19422).

**Model:** Fable 5 (+Extra) — visual/UX polish + a small view-state toggle, single file.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Edit only `packages/assetflow-studio/platform/index.html`. The AI
> Studio results canvas is `.va-axwork` (CSS ~line 15290); header `.va-axhead` (~line 16335, has a
> `margin-left:auto` spacer then `.smeta`); results grid `.va-axgrid` (CSS ~line 15358:
> `columns:220px; column-gap:14px`; mobile `columns:2` ~line 15497); cards `.va-axcell`/`.va-axres`
> (~line 16377+). View state = `aiMediaView`; segment handler `onMediaView` (~line 19422).
>
> **GOAL (inspired by Artlist, NOT a 1:1 clone — keep FrameFlow's lime/dark tokens).** Make results fill
> the canvas with larger, immersive tiles, and add a Full/Compact view toggle.
>
> **TASK.**
> 1. **Bigger default tiles:** change `.va-axgrid` so results are larger and fill the width better — e.g.
>    raise the default column width (Full view ≈ `columns:340px`) so a few results read as an immersive
>    grid, not tiny thumbnails. Keep the CSS-columns masonry approach and the existing card markup/tokens.
> 2. **Full / Compact view toggle:** add a small icon button (grid icon) in `.va-axhead` on the right
>    (near `.smeta`), with an accessible tooltip/title that reads "Full view" or "Compact view" depending
>    on the current state. It toggles a new state field `axGridView` ('full' | 'compact'):
>    - `full` → large tiles (`columns:~340px`),
>    - `compact` → denser tiles (`columns:~200px`).
>    Apply by toggling a class on `.va-axgrid` (e.g. `.va-axgrid.compact`). Persist the choice in
>    `localStorage` (this is the real web app — localStorage is fine) and restore it on load; default =
>    `full`.
> 3. **Empty state:** when a view has few results, the layout should still look intentional (tiles align
>    top-left and read as a grid). Do NOT stretch a single tile to full width; just ensure the larger tile
>    size + comfortable gaps make the canvas feel populated. (Keep the existing first-run hero
>    `.va-axhero` for the zero-results case — don't change it.)
> 4. Responsive: keep the mobile grid usable (`columns:2`); the toggle may be hidden on narrow screens
>    (≤820px) if it doesn't fit.
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED (no gen/credit/quote/cost logic). English UI. Minimal, contained
> diff in `platform/index.html`. Reuse the existing `.va-axcell`/`.va-axres` card markup and design
> tokens; take inspiration from Artlist's density toggle but use FrameFlow's own styling (lime accent,
> hairline). Don't touch dead `.ffa-st-*` CSS or the landing `ffl-`.
>
> **VERIFY.** Screenshots at 1280px and 390px: (a) with a few results, the canvas now reads as an
> immersive grid of large tiles (not one tiny card in a sea of black); (b) the Full/Compact toggle
> switches tile density and its tooltip/label updates; (c) the choice persists across reload
> (localStorage); (d) mobile still shows a usable 2-col grid; (e) the first-run hero and Visuals/Audio
> tabs still work; no console errors; generation/cost unaffected.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 7 — Web AI Studio: make the composer compact + centered (not full-width)

**Report:** The AI Studio composer stretches edge-to-edge across the whole bottom of the screen, which
looks heavy and ugly. Inspired by Artlist (NOT 1:1): the composer should be a **compact, centered,
floating** panel with a contained max-width — not full width. Keep FrameFlow's own lime/dark glass style.

**Director's investigation (grounded in the code — trust this):**
- The composer is `.va-dock` (`platform/index.html` CSS ~line 15192):
  `position:absolute; left:24px; right:24px; bottom:18px; border-radius:20px; …` → because it pins both
  `left:24` and `right:24`, it spans nearly the full width. **ROOT CAUSE of the "heavy" look.**
- There's a mid-width tweak (~line 15246, `.va-dock{margin:…}`) and a mobile rule (~line 15500,
  `.va-dock{position:static; …}`) — leave mobile full-width/static (correct on small screens).
- This composes with problems #1 (prompt grows taller) and #5 (refs "+" menu) — only the horizontal
  width/centering changes here; do not undo those.

**Model:** Sonnet 5 (small, single-file CSS change).

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Edit only `packages/assetflow-studio/platform/index.html`. The AI
> Studio composer is `.va-dock` (CSS ~line 15192): currently
> `position:absolute; left:24px; right:24px; bottom:18px; …`, so it spans nearly the full width. A mobile
> rule (~line 15500) makes it `position:static` — leave that as-is.
>
> **PROBLEM.** The composer looks heavy because it stretches edge-to-edge. Make it a compact, centered,
> floating panel (inspired by Artlist, but keep FrameFlow's own lime/dark glass tokens — do NOT copy
> Artlist's exact styling).
>
> **TASK.**
> 1. In the desktop `.va-dock` rule (~line 15192): instead of pinning `left:24px; right:24px`, center it
>    with a contained max-width. E.g. keep `position:absolute; bottom:18px;` but set
>    `left:0; right:0; margin-inline:auto; width:min(920px, calc(100% - 48px));` (pick a max-width around
>    880–960px that feels balanced). Keep the rounded corners, glass background, border, and shadow.
> 2. Ensure the centered dock still floats above the canvas and doesn't overlap the results grid — verify
>    the results area's bottom padding still clears the (now-centered) dock; adjust only if needed.
> 3. Keep it compatible with problem #1 (the prompt textarea still grows vertically up to ~60vh) and
>    problem #5 (the refs "+" menu) — only the horizontal width/centering changes.
> 4. Leave the mobile rule (~line 15500, `position:static`) full-width as-is (correct on narrow screens).
>    Check the mid-width breakpoint (~line 15246) still looks right with the new centering.
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED (pure CSS layout). English UI. Minimal, single-file diff. Take
> inspiration from Artlist's compact composer but use FrameFlow's existing tokens — no pixel/colour copy.
> Don't touch the dead `.ffa-st-*` CSS or the landing `ffl-`.
>
> **VERIFY.** Screenshots at 1280px and 390px: (a) on desktop the composer is a compact, centered,
> floating panel with clear margin on both sides (not edge-to-edge); (b) it still sits above the canvas
> and nothing overlaps; (c) the prompt still grows tall for long prompts (#1) and the refs control (#5)
> still work; (d) mobile composer is unchanged (full-width/static); no console errors.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 8 — Web AI Studio: add "My Library" as a reference source (not only Upload)

**Report:** When adding a reference in the web composer you can only Upload a file. Like Artlist (Upload /
My Library), add a second source: pick a reference from **My Library** (your own generated images/videos/
audio). Inspired by Artlist, keep FrameFlow's identity. (Builds on problem #5's "+" reference menu.)

**Director's investigation (grounded in the code — trust this):**
- Reference upload today: `addRefFile(k)` (`platform/index.html` ~line 18384) opens a file picker,
  uploads, and sets the ref slot with the returned signed `r.url` (k ∈ img/start/end/vid/aud →
  `refImages`/`refStartUrl`/`refEndUrl`/`refVideos`/`refAudios`).
- "My Library" data already exists in state: `state.gens` = all the user's generations (the rail's
  `axOpenLibrary` sets `viewSess:null` to show them). Each gen has an id + asset(s).
- A mechanism to use a generation as a reference ALREADY exists (~lines 18315–18328): `FFAPI.genGet(id)`
  returns the gen with a signed asset `url`, which is then written into `refImages`/etc. Reuse it. This is
  money-zone-safe (the cost-quote HMAC strips reference params — refs never change the signed price).

**Model:** Fable 5 (+Extra) — new picker UI + wiring, single file.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Edit only `packages/assetflow-studio/platform/index.html`. In the AI
> Studio composer, references are added via `addRefFile(k)` (~line 18384) which uploads a file and sets
> `refImages`/`refStartUrl`/`refEndUrl`/`refVideos`/`refAudios` with a signed URL. Problem #5 turns the
> add affordance into a single "+" menu. The user's own generations are in `state.gens` (My Library); a
> generation's signed asset URL is obtained via `FFAPI.genGet(id)` (see the existing gen→reference path
> ~lines 18315–18328). The cost-quote HMAC ignores reference params (adding a ref never changes price).
>
> **GOAL — add a "My Library" reference source (inspired by Artlist, not a 1:1 copy).** For each reference
> type, the "+" menu (from #5) should offer TWO sources: **Upload** (existing `addRefFile(k)`) and **My
> Library** (pick from `state.gens`).
>
> **TASK.**
> 1. In the reference "+" menu, for each available reference action (image / start / end / video / audio),
>    present two choices: "Upload" and "My Library" (either two rows, or a submenu — keep it clean and
>    consistent with FrameFlow's `ffa-pop` styling).
> 2. "My Library" opens a picker (reuse an existing modal/lightbox/popover pattern) listing `state.gens`
>    filtered to the reference type: image refs (img/start/end) → image generations; video ref (vid) →
>    video generations; audio ref (aud) → audio generations. Show a thumbnail + a short label per item;
>    handle the empty case ("No generations yet — generate something first").
> 3. On selecting a library item, resolve its signed asset URL via `FFAPI.genGet(id)` (reuse the existing
>    ~line 18315–18328 logic) and set the correct ref slot for `k` — exactly like `addRefFile` does after
>    an upload (`refImages.concat`, `refStartUrl`, `refEndUrl`, `refVideos.concat`, `refAudios.concat`).
>    Respect the same per-model caps (`rCaps.max` / `rCaps.lim`). Show the "Reference added" toast; close
>    the picker.
> 4. Keep the existing Upload path unchanged.
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED: do NOT change the ref→param mapping, cost-quote/HMAC, credits, or
> generation — only add a new SOURCE for the same ref slots. English UI. Minimal, contained diff in
> `platform/index.html`. Reuse `state.gens`, `FFAPI.genGet`, and existing modal/popover styling. Don't
> touch dead `.ffa-st-*` CSS or landing `ffl-`.
>
> **VERIFY.** Screenshots at 1280px and 390px: the "+" menu shows Upload + My Library for the current
> model; "My Library" lists the user's generations filtered by type with thumbnails; selecting one adds it
> as a reference chip (same as an upload); per-model caps still enforced; empty state handled; no console
> errors; cost/Generate unaffected.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 9 — Plugin AI Studio: add "My Library" as a reference source (AE)

**Report:** In the After Effects plugin, the reference source menu offers Upload file / From Project panel
/ From Timeline — but not **My Library** (your own generations). Add a "My Library" source like Artlist /
like the web (#8), so users can pick a previously generated asset as a reference. Inspired by Artlist,
keep FrameFlow's identity.

**Director's investigation (grounded in the code — trust this):**
- Plugin file: `plugins/after-effects-cep/AssetFlow_Plugin.html` (single-file CEP panel; AE has no
  internet — self-host fonts, inline SVG).
- The image reference source sheet is `#igAddSheet` (~line 4147): rows `#igSrcFile` (Upload file),
  `#igSrcProj` (From Project panel), `#igSrcTl` (From Timeline). The video generator has its own source
  sheet (`#vgSrcTitle` / the `+ Reference` sheet ~line 4278).
- The plugin already has a My Library / generations concept (~line 4467 "My Library · All generations")
  and a working "Use as reference" action from the library/lightbox (`onRef` / `refAllowed` ~lines
  9522/9569). Reuse that mechanism to turn a selected generation into a reference.

**Model:** Fable 5 (+Extra) — plugin UI + wiring; AE not automatable.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo, After Effects CEP plugin
> `plugins/after-effects-cep/AssetFlow_Plugin.html` (single file; no internet in AE — inline SVG,
> self-hosted fonts). The image reference source sheet is `#igAddSheet` (~line 4147) with rows
> `#igSrcFile` / `#igSrcProj` / `#igSrcTl`. The video generator has an analogous "+ Reference" source
> sheet (`#vgSrcTitle`, ~line 4278). The plugin already loads the user's generations ("My Library · All
> generations", ~line 4467) and already supports "Use as reference" from the library/lightbox via the
> `onRef`/`refAllowed` callbacks (~lines 9522/9569).
>
> **GOAL — add a "My Library" source to the reference source sheets (inspired by Artlist, not 1:1).**
>
> **TASK.**
> 1. Add a new "My Library" row to the image reference source sheet `#igAddSheet` (alongside Upload file /
>    From Project panel / From Timeline), and to the video generator's reference source sheet — matching
>    the existing `.opt` row styling (icon + title + small subtitle + chevron).
> 2. Selecting "My Library" opens a picker listing the user's generations filtered to the reference type
>    (images for image refs, videos for video refs, audio for audio refs). Reuse the existing library/
>    lightbox rendering + `refAllowed` filter so only valid items are selectable. Show thumbnails; handle
>    the empty case.
> 3. On selecting an item, use the EXISTING "Use as reference" path (`onRef`) to attach that generation's
>    asset as the reference — do not build a new upload; the generated asset already has a usable URL.
>    Respect the model's reference rules/caps already enforced in the plugin.
> 4. Keep Upload file / From Project / From Timeline unchanged.
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED: do NOT change credit consume/refund, cost estimate/quote, or the
> generation call — only add a new reference SOURCE that reuses the existing `onRef` mechanism. English UI;
> Uzbek code comments. Inline SVG only (no external assets). Minimal, contained diff. Reuse the existing
> library/lightbox + `onRef`/`refAllowed`. After editing, run
> `bash plugins/after-effects-cep/scripts/install-cep.sh`.
>
> **VERIFY.** `node --check` any extracted JS if applicable; confirm the panel parses. Since AE isn't
> automatable, describe precisely: opening the image (and video) reference source sheet now shows a "My
> Library" row; selecting it lists the user's generations filtered by type; picking one attaches it as a
> reference via the existing `onRef` path; caps/rules still enforced; Upload/Project/Timeline still work.
> Note that the USER must run `install-cep.sh` + restart AE to test live.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

## 10 (Stock Phase S1) — Contributor upload: Motion-Elements-style kind-picker (Template + Stock) + data-model foundation

**Report:** Redesign the contributor "Add product" upload so it starts with a Motion-Elements-style
grouped **kind picker** — **Stock** (Video · Music · Sound FX · Photo) and **Template** (After Effects ·
Premiere Pro · Apple Motion · DaVinci Resolve). The selection drives the product **kind/subtype/app**, the
**accepted file formats**, and which Step-1 fields show. Templates also get an explicit broad **Type**
(Video Templates / Motion Graphics / Graphics / LUTs = the 4 web pills) plus the granular Category aligned
to the real taxonomy. This is **Phase S1** of the Stock expansion — see `docs/STOCK-EXPANSION-PLAN.md`
(S2 stock ingest, S3 web stock catalog, S4 plugin stock, S5 licensing/payout, S6 API stock follow later).
Inspired by Motion Elements, NOT a 1:1 copy — keep FrameFlow's lime/dark identity.

**Director's investigation (grounded in the code — trust this):**
- Upload wizard: `js/contributor-views.js` `renderUpload()` (~line 764) — 3 steps (Basic info / Media
  files / Submit). Step 1 (~line 779): name, Description, Category (`#upCat` from `CATS`), Section (`#upNav`
  video/social/corp), Orientation, Resolution, Tags. Step 2 (~line 789): Preview video, Thumbnail, and
  "Project file (.mogrt or .zip)" with a HARD-CODED `accept=".mogrt,.zip"`. There is NO app picker — the
  app is inferred from the pack extension (F5 `apps/api/src/lib/apps.ts`: `.aep`→ae, `.mogrt`→pr, `.motn`
  →motion, `.drfx`→resolve).
- Schema `ContributorTemplate` (`packages/database/prisma/schema.prisma` ~line 273): has `templateApp`
  (ae/pr/motion/resolve), `cat`+`catLabel` (granular), `nav`, `metaJson`. **No `kind`, no `stockType`, no
  broad `templateType`.**
- Granular `CATS` (`js/data.js` ~line 4) ≠ backend truth `TEMPLATE_CATEGORIES`
  (`apps/api/src/lib/ai/template-metadata.ts` ~line 22). Catalog items built in
  `apps/api/src/lib/catalog-map.ts`. Web pills guessed by `catBucket` (`platform/index.html` ~line 17687).
- Data-model + formats + phases are specified in `docs/STOCK-EXPANSION-PLAN.md` — follow it.
- **Run S1 (#10) BEFORE #3/#4** (they read the new `templateType`/aligned categories).

**Model:** Fable 5 (+Extra) — DB migration + upload UI redesign + backend accept + admin; commit in logical chunks.

**Code prompt (one-shot):**

> **CONTEXT.** FrameFlow monorepo. Read `docs/STOCK-EXPANSION-PLAN.md` first (data model, formats, phases).
> The contributor upload wizard is `renderUpload()` in `js/contributor-views.js` (~line 764): Step 1
> (~line 779) has Category (`#upCat` from `CATS` in `js/data.js` ~line 4), Section (`#upNav`), Orientation,
> Resolution, Tags; Step 2 (~line 789) has Preview/Thumbnail + a project file input hard-coded
> `accept=".mogrt,.zip"`. App is inferred from the pack extension (`apps/api/src/lib/apps.ts`). Schema
> `ContributorTemplate` (`packages/database/prisma/schema.prisma` ~line 273) has `templateApp`,
> `cat`/`catLabel`, `nav`, `metaJson` — no `kind`/`stockType`/`templateType`. Catalog built in
> `catalog-map.ts`; web pills guessed by `catBucket` (`platform/index.html` ~line 17687). This is Stock
> Phase S1 — S2+ (stock ingest, catalog, plugin) come later, so here a stock product just needs to be
> CREATED (PENDING) with its media file stored; full stock processing/surfacing is out of scope.
>
> **GOAL.** A Motion-Elements-style kind picker at the top of upload (Stock + Template) that drives
> kind/subtype/app + accepted formats + Step-1 fields; add the additive data-model columns; fold in the
> broad Type + granular-category alignment for templates. Inspired by Motion Elements, NOT 1:1 — use
> FrameFlow's own lime/dark tokens.
>
> **TASK (commit in logical chunks).**
> A. **Data model (additive migration, per the plan doc).** On `ContributorTemplate` add:
>    `kind String @default("template")` (`template`|`stock`), `stockType String?`
>    (`video`|`music`|`sfx`|`photo`), `templateType String @default("video-templates")`
>    (`video-templates`|`motion-graphics`|`graphics`|`luts`). Additive Prisma migration; test on dev DB.
> B. **Upload kind-picker (Step 0 / top of Step 1).** Add a grouped card picker: **Stock** column (Video,
>    Music, Sound FX, Photo) and **Template** column (After Effects, Premiere Pro, Apple Motion, DaVinci
>    Resolve). Selecting a card sets `kind` + (`stockType` OR `templateApp`) and shows the accepted formats
>    inline (Motion-Elements-style caption), from the plan doc's format table. Match FrameFlow's design
>    tokens (not Motion Elements' colors).
> C. **Adapt the form to the selection.** Template → show broad **Type** (Video Templates / Motion Graphics
>    / Graphics / LUTs), granular **Category** (aligned `CATS`), Section, Orientation, Resolution, Tags;
>    Step 2 project-file `accept` = the app's extensions (aep/ffx/zip, mogrt/zip, motn/zip, drfx/setting/
>    zip). Stock → show a stock Category/Tags (+ Orientation/Resolution where meaningful); Step 2 accepts
>    the stock media file per type (video mp4/mov, music wav/mp3/aiff, sfx wav/aiff, photo jpg/png/webp) —
>    the media file IS the product (no separate "pack"). Keep the wizard's Save-draft/steps working.
> D. **Backend accept + store.** The contributor upload/submit endpoint accepts & persists `kind`,
>    `stockType`, `templateApp`, `templateType` (validate against the canonical values). A **stock** submit
>    creates a `ContributorTemplate` row with `kind='stock'`, its `stockType`, and its uploaded media file
>    stored (reuse the existing presigned-upload/storage path), status PENDING. Full stock preview/scan/AI
>    = S2 (leave clear `// TODO(S2)` hooks; do not block the create).
> E. **Align granular categories.** Replace `CATS` in `js/data.js` to mirror `TEMPLATE_CATEGORIES` exactly
>    (exclude "Uncategorized"), with a sync comment. Add kind/Type fields to admin edit (`admin-views2.js`)
>    + moderation (`admin-views.js`). Then `npm run studio:sync`.
> F. **Expose in catalog.** In `catalog-map.ts` include `kind`, `stockType`, and the broad `type` on each
>    item so #3/#4 and future stock surfaces can read them.
>
> **CONSTRAINTS.** MONEY-ZONE UNTOUCHED. Migration ADDITIVE only. Behaviour-preserving: existing template
> uploads keep working end-to-end; legacy rows default to `kind='template'`/`templateType='video-templates'`
> and still display. Inspired by Motion Elements but use FrameFlow tokens (no pixel/colour copy). English
> UI; Uzbek code comments. Edit ROOT `js/` sources then `studio:sync`; never edit build artifacts. Don't
> touch landing `ffl-`.
>
> **VERIFY.** Screenshots 1280/390: (a) upload opens with the grouped kind picker (Stock + Template) in
> FrameFlow styling; (b) selecting **After Effects** shows accept `aep/ffx/zip` and the template fields
> (Type + granular Category); selecting **Music** shows accept `wav/mp3/aiff` and stock fields; (c) a full
> **template** upload still works end-to-end and appears under its Type pill on the web; (d) a **stock**
> upload (e.g. Music) creates a PENDING product with the media file stored (even though it's not yet
> surfaced — that's S2/S3); (e) migration applies cleanly on dev DB; `t.kind`/`t.stockType`/`t.type` present
> on catalog items; `studio:sync` updated artifacts; no console errors. USER must push + `migrate:deploy`.
>
> When finished: (a) commit with a clear concise message (no Co-Authored-By); do NOT push. (b) write a
> short summary.

---

# ── DIRECTOR-AUDIT BUNDLES (2026-07-10) ──
> These four bundles implement the proactive-audit findings in **`docs/DIREKTOR-AUDIT-2026-07-10.md`** —
> every finding there is grounded with `file:line` + root cause + suggested fix. For each bundle: fix ALL
> listed findings (P1 first, then P2), **commit per logical group** (do NOT push), obey the GLOBAL RULES,
> and treat items marked "money flag" as VERIFY-ONLY (do not alter signed-price / credit / HMAC logic).

## 11 — Contributor upload + chain: audit fixes (see audit doc §D)

**Model:** Fable 5 (+Extra). Files: `js/contributor-views.js`, `apps/api/src/routes/contributor.ts`,
`apps/api/src/lib/apps.ts` / `ingest-zip.ts`. (Runs after #10 / S1; same upload area — sequential.)

> Implement ALL of §D in `docs/DIREKTOR-AUDIT-2026-07-10.md`. Highlights (grounded there):
> - **P1** Wizard/direct upload never sets `templateApp` → non-bulk templates mislabeled "ae"
>   (`contributor-views.js:866-879` → `contributor.ts:2398`; `/pack-uploaded` 1465-1474; `/assets` 2142-2159).
>   Fix: derive via `appForPackExt(ext)` (fallback `ae`) and persist, or send from the wizard.
> - **P1** Orientation/Resolution selects have no `selected` binding → silently reset to Landscape/4K on
>   step-back/edit (`contributor-views.js:784-785`). Fix: reflect `UP_DRAFT.orient`/`res` in `<option selected>`.
> - **P1** Rights-attestation dead-end — draft saved before rights can never be submitted from list/drawer
>   (`contributor.ts:2527-2533`; checkbox only on wizard Step 3). Fix: surface rights on list/drawer submit.
> - **P2** Edit→submit forces re-uploading the whole pack (`contributor-views.js:492`, `561-570`) — treat an
>   existing server pack as satisfying. **P2** `previewTranscodeStatus` stuck "pending" forever
>   (`contributor.ts:1139/1924`). **P2** `/api/contributor/catalog` missing `takedownAt:null`
>   (`contributor.ts:2843-2870`). **P2** bulk keys clobber on sanitized-name collision
>   (`contributor.ts:1558-1559`). **P2** auto-approve publishes before pack scan (`contributor.ts:2369-2403`).
> Edit ROOT `js/` then `npm run studio:sync`. MONEY-ZONE untouched; migrations additive if any.
> When finished: commit per logical group (no Co-Authored-By); do NOT push; short summary.

## 12 — Web Templates + catalog: audit fixes (see audit doc §B)

**Model:** Fable 5 (+Extra). File: `packages/assetflow-studio/platform/index.html` (+ `catalog-map.ts` for
the classification/timestamp items). ⚠️ Same file as #3 — run AFTER #3, re-read the file first.

> Implement ALL of §B in the audit doc. Highlights:
> - **P1** Premature "Nothing found" during progressive load (`:17731/:19471/:19474`) — add a
>   `catalogFullyLoaded` flag; empty state only after `nextCursor===null`; keep a "loading more" indicator.
> - **P1** Search matches ONLY the name (`:18862`) — also test `t.c`, `t.tags`, `t.desc` (and author).
> - **P2** Related/collection use a different taxonomy than the pills (`:18896-18897`) — group by the same
>   bucket. **P2** "Most relevant" sort no-op/mislabeled (`:18863-18867`). **P2** resolution→quality brittle
>   (`:17743`). **P2** NEW/Newest use upload not publish time (`:18858/:18865`). **P2** empty `<video poster>`
>   on grid cards (`:16267`). **P2 money-flag** web download burns quota before delivery
>   (`plugin.ts:352`+`serve-asset.ts:113-115`) — VERIFY only. **P2** unbounded catalog + non-virtualized
>   masonry (`:17725-17734/:16263`) — batch-append + cap/virtualize. **P2** 24h signed display URLs on
>   non-CDN path (`catalog-map.ts:25`).
> MONEY-ZONE untouched. When finished: commit per logical group (no Co-Authored-By); do NOT push; short summary.

## 13 — Web AI Studio: audit fixes (see audit doc §A)

**Model:** Fable 5 (+Extra). File: `packages/assetflow-studio/platform/index.html`. ⚠️ Same file as the AI
Studio composer group (#1/#5/#6/#7/#8) — run AFTER them, re-read the file first.

> Implement ALL of §A in the audit doc. Highlights:
> - **P1** Lightbox "Reference" is a dead "coming soon" stub (`:16961/:19566`) — wire to `useGenAsRef`, hide
>   for non-image. **P1** `pollJob` never gives up → "Generating…" hangs forever (`:18211-18239`) — add
>   elapsed/attempt cap + retry toast. **P1** "Enhance" burns credits with no cost/gate (`:18241-18255`) —
>   surface ✦ price / balance gate in UI (money-zone: UI only, don't change the charge).
> - **P2** My Library count capped at 40 & mislabeled (`:17808`). **P2** grid/lightbox signed URLs expire in
>   place (`:18936/:18588`). **P2** restore re-injects stale ref URLs → doomed paid run (`:18368-18372`) —
>   re-sign on restore. **P2** session-expiry mid-gen spams toasts + stuck busy (`:17493-17497/:18211`) —
>   clear poll timer + `generating:false`. **P2** finished gen hijacks `activeGenId` across sessions
>   (`:18219-18223`). **P2** models-load failure → permanent "Loading…" no retry (`:17789-17803`). **P2**
>   `useGenAsRef` silently swaps model (`:18311`) — toast it. **P2** lightbox no Esc / no alt (`:16945-16962`).
>   **P2 money-flag** stale-session retry reuses `costQuoteSignature` (`:18197-18201`) — VERIFY server-side only.
> MONEY-ZONE untouched. When finished: commit per logical group (no Co-Authored-By); do NOT push; short summary.

## 14 — Admin panel: audit fixes (see audit doc §C)

**Model:** Fable 5 (+Extra). Files: `js/admin-subscribers.js`, `admin-views.js`, `admin-views2.js`,
`admin-plans.js`, `studio-templates.js`, `data.js`; `apps/api/src/routes/admin.ts`, `contributor.ts`.
Edit ROOT `js/` then `npm run studio:sync`.

> Implement ALL of §C in the audit doc. Highlights:
> - **P1** "Message subscriber" is a silent no-op (`admin-subscribers.js:551-567`) — wire a real endpoint or
>   relabel/remove. **P1** Moderation "Soft/All" tabs render stale/empty (`admin-views.js:257-273/501-510`) —
>   load `scope=all` for those filters. **P1** Active/Online counts drift between two sources
>   (`admin.ts:238-246` vs `:276-278`) — unify/namespace. **P1** "Online" filter regex omits most-recent +
>   count≠rows + wrong label (`admin-subscribers.js:84-87`, `admin.ts:246`, `plugin-profile.ts:702-704`) —
>   one shared predicate + correct label.
> - **P2 security** contributor-block endpoint can logout a peer admin + 500 on missing
>   (`contributor.ts:3104-3131`) — restrict to CONTRIBUTOR, 404 on missing, block self/peer-admin. **P2**
>   list usage cell ignores `downloadLimitOverride` (`admin-subscribers.js:111-122`). **P2** admin plan change
>   emits no `PlanChangeEvent` (`admin.ts:355-398`). **P2** credit-spend differs across screens
>   (`admin.ts:709-714` vs `:810-829`). **P2** plan "Active" toggle never persists (`admin-plans.js:159-168`).
>   **P2** reject reason not enforced / category discarded (`admin-views2.js:683-722`). **P2** "New only"
>   redundant with Pending (`studio-templates.js:56`). **P2** STUDIO tier missing from plan counts
>   (`admin.ts:286-289`). **P2** post-approval edits bypass re-moderation (`contributor.ts:2444-2493`).
> MONEY-ZONE untouched; migrations additive if any (PlanChangeEvent already exists). When finished: commit per
> logical group (no Co-Authored-By); do NOT push; short summary.

---
