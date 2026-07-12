# MUAMMOLAR · PART 2 of 2 — PRODUCT: AI STUDIO · COMPOSER · CATALOG · CONTENT PIPELINE
### FrameFlow (web + After Effects plugin) · 2026-07-12 · Director's work order

> **This is PART 2 of 2.** **Do not start it until PART 1 (`MUAMMOLAR-1-POYDEVOR-PUL-MIQYOS.md`)
> is complete.** Part 1 fixes the server region, the CDN, the DB indexes, the double-charge, the
> loss-making prices and the server-side catalog. Building this UI work on top of the old
> foundation means rebuilding it.
>
> **Assumed done (from Part 1):** stable public asset URLs (`CDN_BASE_URL`) · server-side catalog
> filtering + a **detail endpoint** · idempotent `POST /gen` · measured provider costs · the
> watermark pipeline · error tracking.
>
> Each problem below is a **self-contained prompt** for Claude Code. **Run them in the order given
> in §EXECUTION ORDER — not in P-number order.** The `P<n>` ids are permanent anchors.
>
> Workflow: copy ONE step → run it → `/clear` → next step. **The owner pushes; Code never pushes.**

---

## GLOBAL RULES (apply to every step)

- **🔴 MONEY ZONE IS FROZEN.** Never change credit consume/refund, the signed cost-quote / HMAC
  (`lib/gen-quote.ts`, `gen-models.ts` `computeGenCost` / `imageUnitCost`, `plugin-profile.ts`) or
  any credit *value*. UI, gates, caps and tracking **around** them are allowed. If a fix seems to
  require changing the math → **STOP and flag.**
- Migrations must be **additive only** (new tables/columns; nothing destructive).
- **English UI text; Uzbek code comments.** Minimal, tight diff outside the declared scope.
- **Studio source of truth:** edit ROOT `packages/assetflow-studio/js|styles|admin|contributor`,
  then run `npm run studio:sync`. NEVER edit the `studio/`, `admin/js` build artifacts.
  `packages/assetflow-studio/platform/index.html` is edited **directly** (CF Pages source).
- ⚠️ **BATCH6 conflict:** another workstream is redesigning `platform/index.html` — its **Prompt #4
  is AI Studio + Dashboard**, i.e. *exactly the screens in Phase 3 below*. **Before every
  ⚠️BATCH6-marked step, check whether BATCH6 #4 has landed**; if the working tree is dirty, stop and
  report instead of merging blindly.
- Verify with `node --check` (JS) / `npm run build -w apps/api` (TS) before committing.
- When finished: (a) commit with a clear, concise message (**no `Co-Authored-By`**); **do NOT push**.
  (b) write a short summary.

### 🔴 THIS PRODUCT IS TWO CLIENTS: WEB **AND** THE AFTER EFFECTS PLUGIN

The plugin (`plugins/after-effects-cep/`) ships a **hand-synced copy** of the same composer, the
same model picker and the same catalog — **every composer bug in this file exists twice.**

- Every step carries a **SCOPE** line: `API` · `WEB` · `PLUGIN` · `ADMIN`.
  A step marked `PLUGIN` is **not done** until the plugin change is made and verified.
- Plugin constraints: **no internet-loaded assets** (self-host fonts, inline SVG) · the panel is
  **~380–450 px wide** — a composer row that "just fits" at 920 px will **not** fit there (this is
  why the single-settings-chip pattern in P16 is mandatory, not cosmetic) · after editing run
  `bash plugins/after-effects-cep/scripts/install-cep.sh` (the user restarts AE) · validate with
  `node --check` + a DOM/handler check.
- Known plugin debt catalogued here: **P2.PLUGIN** (three inconsistent label maps) ·
  **P5.2** (cannot import raw stock media — a listed-but-unimportable asset) ·
  **P12.2 / P13.6 / P14.6 / P15.4 / P16.2 / P20.5 / P22.5** (composer parity) ·
  **P4.3** (import must pull the clean pack, never the watermarked preview).
- **A fix that lands only on the web is incomplete and will be rejected.**

---

## EXECUTION ORDER — PART 2

### PHASE 3 — AI STUDIO / COMPOSER *(the order here matters more than anywhere else)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **23** | **Stop the global re-render** — the scroll handler, the fake 380 ms progress bar, the 3.4 s tip timer and `_rvSafety` all call `setState` and re-render the **entire app** · and **render media as real `<img>`/`<video>`, not CSS backgrounds** | P10 | WEB (⚠️BATCH6) | 🔒 **DO THIS FIRST.** It is also the cause of the caret jumps in the prompt and the reason undo (step 28) cannot survive. |
| **24** | **Media quality pass — ONE step:** 1280 px display derivative (WebP, **alpha preserved**) · `srcset` · 720p hover preview · **lightbox rebuild** (true aspect ratio, large viewer, prompt/details panel) · **card surface & elevation** (3 themes, tokens only) | **P9 + P11 + P17** | WEB·PLUGIN (⚠️BATCH6) | 🔒 after 23. **These four problems touch the same ~30 lines. Do them as ONE step**, or the same code is rewritten four times. |
| **25** | **Reference POOL + parallel generations — ONE step:** references become **model-independent** (never deleted on model switch — dimmed, with the reason; tokens **never renumbered**) · slot UI (`@start` / `@end` / `@img1…`) · several generations at once, each with its own card and progress | **P13 + P20** | WEB·PLUGIN | 🔒 **before 26–28.** Every remaining composer step depends on this state model. |
| **26** | **Composer chrome** — ONE settings chip (`⚙ 16:9 / 720p / 5 Sec ▾`) opening a grouped popover · `＋` reference-kind menu (hidden per model caps) · **pinned `COST + Generate` that can never wrap** · icons instead of raw text | P16 | WEB·PLUGIN | 🔒 after 25. **Mandatory for the plugin** (narrow panel). |
| **27** | **Generate button: disable BEFORE the click when credits are short** (reactive signed quote; no post-click rejection) · same for "start frame required" etc. | P22 | WEB·PLUGIN | 🔒 must ship **with** step 25 — with parallel jobs the balance goes stale, which would reintroduce the exact bug. |
| **28** | **Composer input — ONE step:** drag & drop (external files **and** dragging a generated card) · paste (incl. screenshots) · multi-file · **✕ on a mention pill** (removes the mention, keeps the reference — **never renumber**) · **Clear** · **Ctrl/Cmd+Z undo (incl. the reference pool)** | **P14 + P12 + P15** | WEB·PLUGIN | 🔒 after 23 + 25. |
| **29** | **Credits screen** — the real `CreditLedger` (**refunds finally visible**) · Spent / Refunded / Net totals · row → open that generation · downloads history | P21 | WEB·PLUGIN | 🔒 after Part 1 step 7 — this makes any double-charge **customer-visible**. |
| **29a** | **"Enhance" must SEE the references** — today the client never sends them, so the assistant rewrites the prompt **blind** and invents what `@Image 1…6` contain. The API already accepts `image_urls`. Add: real vision, intent understanding (Uzbek/Russian → fluent English), mention-integrity validation, preview + undo. | P28 | WEB·API·PLUGIN | 🔒 after 25 (the reference pool is what gets sent). **One missing argument is the whole bug.** |
| **29b** | **Fix the logout on `#landing`** — reproduce, name the 401 source, and stop clearing the session on non-token 401s | P29 | WEB·API | 🔒 depends on **Part 1 step 13**. If step 13 landed, this is mostly verification. |
| **29c** | **Provider content rejections** — Enhance must be **faithful, not embellishing** · warn **before** spending credits · on rejection: honest error (not a ✓ icon), the real reason, a **guaranteed refund**, and a **"try a model whose policy allows it"** suggestion · log rejections | P30 | **WEB·PLUGIN·API — all 4 modes** | 🔒 after 29a. ⚠️ **Read the DIRECTOR'S RULING in P30 first: nothing in this step may be designed to evade a provider's safety filter.** |

### PHASE 4 — CONTENT PIPELINE *(build the shelves, then fill them)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **30** | **Contributor upload rebuild** — bulk-only · the 5-category taxonomy · **a second, raw-file ingest pipeline** (today ingest is `.zip`-only and rejects everything else) · ffprobe spec extraction · AI metadata **at ingest** · multi-orientation | P1 | WEB·API·PLUGIN | The big one. 🔒 needs Part 1 (scale + cost caps). |
| **31** | **Catalog naming + routing** — "Stock Catalog" · correct type labels · **a real deep link per asset** (`/stock/<type>/<slug>-<id>`) · **OG link previews with the image** (CF Pages Function) · context-aware filters per category | P2 | WEB·API·PLUGIN (⚠️BATCH6) | 🔒 needs Part 1 step 16 (detail endpoint) + step 3 (stable thumb URLs for `og:image` — otherwise the preview image silently breaks). |
| **32** | **Admin moderation at scale · semantic search for the new kinds · plugin import for raw media** | P5.2–P5.4 | ADMIN·API·PLUGIN | Without these, bulk content is unreviewable, unfindable and un-importable. |
| **33** | **Stock + AI-Stock watermarking** (previews) **and the audible tag** for Music / SFX | P4 | API | Extends Part 1 step 14's pipeline. **The preview and the original must be two distinct objects** — otherwise the clean file leaks publicly and the watermark is theatre. |
| **34** | **AI Stock chain** — "Add to Explore" on a generation → admin queue → published in the AI Stock category | P3 | WEB·API·PLUGIN | **The fastest way to fill an empty catalog — it needs no contributors at all.** |
| **35** | **Then: ingest content (50 → 500 → the rest) and launch.** | P5.8 | — | The catalog holds **one** published template while the landing page says "5 000+". |

### Model guidance
- **Fable 5 (High)** — steps 23, 24, 25, 30, 31, 34 (multi-layer, cross-client, state-model work).
- **Opus 4.8** — steps 27, 29, 32, 33, 35.
- **Sonnet 5** — steps 26, 28 (well-scoped, single-surface — but still two clients).

### Deferred
P2.0b (OG image aspect ratio for vertical assets) · P26.3 / P26.7 (Studio seats, pool floor) ·
P5.6 (contributor content-theft / pHash detection).

---

# P10 — Cards and the lightbox flash into a colored gradient by themselves

## Owner's report

Clicking a card — or just leaving the page alone — makes the card/lightbox briefly turn into a
coloured gradient and "flicker", then the image comes back.

## Director's code analysis — reproduced from the code, cause is certain

**1. The media is painted as a CSS `background-image` layered ON TOP OF a gradient.**
`platform/index.html:19419`:

```js
const media = (url, h) => url
  ? "url('" + url + "') center/cover no-repeat, " + this.grad(h)   // image over gradient
  : this.grad(h);                                                   // gradient only
```

`grad(h)` (`:18195`) is the `radial-gradient(...)` the owner is seeing. The lightbox uses the
same helper (`:19874` → `g: media(...)`), and the cards bind it to an inline `style`.
**Whenever that `style` string is re-applied, the browser repaints the gradient layer first and
the image after it decodes → a visible gradient flash.** With a real `<img>` the browser keeps
the previously painted frame; with a CSS background it does not.

**2. 🔴 The whole app re-renders constantly — for cosmetic reasons.**

The platform is a **hand-rolled, React-like renderer in one file**: any `setState` re-renders
the **entire tree**. Cosmetic state (a hint counter, the scroll position, a fake progress bar)
lives in the **same state object** as the data — so a cosmetic tick costs a full re-render of
every card, every image, and the chip-editor. Three offenders, in order of damage:

| Where | Frequency | What it is for |
|---|---|---|
| `:17994` `this._onScroll = () => this.setState({ scrollP, scrollY })` | **every scroll event** (passive, but *not* rAF-throttled) | a scroll-progress value |
| `:18024` `this._genAnimT = setInterval(..., 380)` | **~2.6×/second while generating** | a **fake** progress bar (the server reports no real %) |
| `:17996` `this._tipT = setInterval(..., 3400)` | every 3.4 s | a rotating hint line — used in exactly ONE place (`tipText`, `:20080`) |
| `:18010` `_rvSafety` `setInterval(..., 1100)` | every 1.1 s | a `querySelectorAll` sweep over the DOM |

Each re-render rewrites every card's inline `style` — which contains `url(...)` (see #1) — so
**every image repaints**. That is the "it flickers on its own" (the 3.4 s cycle), the flicker
**while scrolling** (the scroll handler), and the flicker **while generating** (380 ms).

**This is the single biggest client-side performance bug in the app**, and it also explains the
caret jumps in the prompt editor and why undo cannot survive (P15.1) — the editor is rebuilt
underneath the user several times a second.

**3. The URLs are not stable, so the browser cannot even reuse its cache.** Asset URLs are
**signed** (P8 #5 / P7 #1: `CDN_BASE_URL` is empty) and carry a `?v=<epoch>` cache-bust
(`catalog-map.ts`). If a re-render produces a *different* URL string for the same image, the
browser treats it as a new resource and **re-downloads it** — guaranteeing the flash instead of
merely risking it.

**4. `va-skel` shimmer amplifies it.** `:19753` — the card gets the skeleton class **whenever a
thumb URL exists** (`t.thumbUrl ? ' va-skel' : ''`), not only while it is actually loading, so
the shimmering "loading" animation plays under every repaint.

## Required fix

1. **Render media as a real `<img>` / `<video>` element with a stable `src`** — not as a CSS
   `background-image`. Keep the gradient only as a **placeholder behind** the element (visible
   until the first load), never as a layer that reappears on re-render. This alone removes the
   flash.
2. **Cosmetic state must never trigger a global re-render.** Fix all four:
   - **scroll** (`:17994`) — do not put `scrollY`/`scrollP` in app state at all. Write it to a
     CSS variable / a single DOM node inside a `requestAnimationFrame`, or drive it with CSS
     (`animation-timeline: scroll()`); at minimum, rAF-throttle **and** bail out when the value
     has not changed meaningfully.
   - **fake generation progress** (`:18024`) — update that one progress element directly
     (`el.style.width = …`) instead of `setState` at 380 ms. Better: ask the API for real
     progress and drive the bar from the poll it already runs.
   - **rotating tip** (`:17996`) — update only its own text node, or do it in pure CSS.
   - **`_rvSafety`** (`:18010`) — the `IntersectionObserver` above it already does this job;
     the 1.1 s `querySelectorAll` sweep is a belt-and-braces fallback that should be removed or
     made event-driven.
   **Rule to state in the code:** nothing that is purely visual may live in the global state
   object.
3. **If the renderer must re-apply attributes, make it diff them**: never rewrite `style` /
   `src` when the value is unchanged (a string compare before assignment is enough).
4. **Stabilise asset URLs** — this is P7 #1 (turn on `CDN_BASE_URL`) plus a cache-bust key that
   only changes when the asset actually changes (`updatedAt`), not per request.
5. **Apply `va-skel` only while loading** — remove the class on the `load` event, not
   permanently.

**Acceptance:** open AI Studio and do nothing for 60 s — no card may flicker. Open the lightbox
on a slow connection — the previous frame or a static placeholder stays visible; the coloured
gradient never appears over an image that is already loaded.

## Note

This is the same root cause family as **P9** (media handled as thumbnails/backgrounds rather
than as first-class images) and it is fixed by the same CDN work in **P7 #1**. Sequence P7 #1
before P9/P10 so the URL stability is already in place.

---


# P9 — Generation cards look compressed: the grid renders a 512 px, medium-quality JPEG

## Owner's report

In AI Studio the generation cards (image / video / audio) look compressed. They should be shown
in their real quality, not squeezed.

## Director's code analysis — the owner is right

- **The card image is a 512 px, `-q:v 5` JPEG.** `lib/optimize-preview.ts:127–137`
  (`makeImageThumbFile`): `scale='min(512,iw)':-2`, `-frames:v 1`, **`-q:v 5`** (mjpeg quality
  5 ≈ mediocre). The gen pipeline calls it for every image (`gen-processor.ts:105`,
  `makeImageThumb`) and uses `extractVideoPosterFrame` for video posters.
- **The client renders that 512 px file in the card.** `platform/index.html:18451` →
  `thumb: asset.thumbUrl || (type === 'image' ? asset.url : null)`, and the masonry card binds
  `imgSrc: t.thumbUrl` (`:19754`).
- In the owner's screenshot the cards are ~350–500 CSS px wide. On a 2× (Retina) display that
  needs **~700–1 000 real pixels**. A 512 px mjpeg-q5 image upscaled into that box is
  **visibly soft, with JPEG artefacts** — exactly what the owner sees.
- The **lightbox uses the original** (`:17185` → `lb.url`), which is why the full view looks
  right and the card does not. The inconsistency is the tell.

## Hidden problems

- **P9.1 — 🔴 Transparency is destroyed.** `makeImageThumbFile` writes **JPEG**, which has no
  alpha channel. Any generation with a transparent background (logo, overlay, sticker, PNG/WebP
  output) gets a **black or white background** in the card while the original is transparent.
  Silent data loss in the preview layer.
- **P9.2 — Video cards hover-play the FULL original file.** The card sets
  `<video src="{{ g.vidSrc }}">` (`:16246`) — for generations there is **no 720p preview
  transcode** (unlike templates, which go through `optimizePreviewForStreaming`). So hovering a
  4K generation streams the full-weight file. Quality is fine; **bandwidth is not** — and this
  directly fights P6/P7.
- **P9.3 — No `srcset` / DPR awareness anywhere.** One fixed-size image is served to a 1× laptop
  and a 3× display alike.

## What to do (director's recommendation — read before implementing)

The owner's literal request — "show the original, uncompressed" — would put 27 full-size 4K
assets in one masonry grid: tens of megabytes per page load. That **directly contradicts P6/P7**
(the scale/performance work) and would make AI Studio slower than the catalog it is meant to
feed. The correct fix is not "no compression", it is **a display-grade derivative instead of a
thumbnail-grade one**:

1. **Add a `display` derivative** alongside the existing 512 px thumb:
   **~1280 px on the long edge, high quality** (mjpeg `-q:v 2`, or better: **WebP/AVIF**, which
   also solves P9.1 because it keeps alpha). Keep 512 px for small/list contexts.
2. **Preserve alpha**: if the source has an alpha channel, the derivative must be **WebP/PNG**,
   never JPEG. Detect it with ffprobe (`pix_fmt`) — the same check P1.10 needs for stock.
3. **Serve `srcset`** (512 / 1280 / original) so a Retina display gets the 2× file and a small
   card does not download the big one.
4. **Video**: generate a **720p preview** for hover playback (reuse
   `optimizePreviewForStreaming`, already written and already behind the ffmpeg semaphore), and
   keep the original for the lightbox and for download.
5. **Backfill** existing generations (the owner has 27; the fix must also run for old rows or
   his library still looks soft).
6. **Never let the card fall back to the raw original** — `index.html:18451` currently does
   exactly that when `thumbUrl` is missing (`type === 'image' ? asset.url : null`). That is why
   *some* cards look sharp and others do not: the ones with no thumb are showing the full file.
   Make the fallback the `display` derivative.

**Acceptance:** on a 2× display, a generation card must be visually indistinguishable from the
lightbox image at card size; a transparent generation must show as transparent in the card; and
the page weight of the AI Studio grid must not grow more than ~2× (measure before/after).

---


# P11 — The lightbox is tiny, crops every image into a blurry 1:1 square, and has no detail panel

## Owner's report

Clicking a card opens a small viewer. Images are worse than videos: a **4:3** generation is shown
as a **blurry 1:1 square**. It should open like the reference (Higgsfield): a large viewer, the
asset at its **true aspect ratio**, with the prompt and the technical details beside it.

## Director's code analysis — three separate bugs stacked in one component

`packages/assetflow-studio/platform/index.html:17180–17200` (the lightbox) and `:19874` (its
view model):

**1. The viewer is capped at 620 px.** `:17180` → `style="width:100%;max-width:620px"`. On a
2 560 px screen the asset gets 620 px. That is the "why is it so small".

**2. The aspect ratio is HARD-CODED, not read from the asset.** `:19874`:

```js
asp: lbRaw.type === 'video' ? '16 / 9'
   : (lbRaw.type === 'audio' || lbRaw.type === 'sfx') ? '16 / 7'
   : '1 / 1'                       // ← every image is forced square
```

and the frame is `aspect-ratio: {{ lb.asp }}`. So a 4:3 or 3:4 or 9:16 image is **forced into a
square**, and a vertical 9:16 video is letterboxed inside a 16:9 box. The real ratio is
available — `Generation.params` already stores `aspectRatio` (`schema.prisma:453`) — it is
simply never used here.

**3. 🔴 For images there is no `<img>` element at all.** Look at the markup: `<video>` and
`<audio>` are real elements (with `object-fit: contain` — correct), but an **image is painted as
the container's CSS background**: `background: {{ lb.g }}`, where
`g = media(lbRaw.thumb || lbRaw.url)` (`:19874`) → `url(...) center/**cover**`.
Consequences, all three visible in the owner's screenshot:
- it uses **`thumb` first** — the **512 px, q5 JPEG** (P9) — so the full-size original is never
  shown even though it is available in `lbRaw.url`;
- **`cover`** *crops* the image to fill the square frame — parts of the picture are cut off;
- upscaled 512 px → **blurry**.

This is why video looks acceptable and images look bad: video got a real element, images did not.

## Required rebuild (reference: the owner's Higgsfield screenshots)

1. **Real `<img>` element, `object-fit: contain`, `src` = the ORIGINAL (or the 1280 px display
   derivative from P9) — never the 512 px thumb.** Keep the thumb only as a `poster`/blur-up
   placeholder while the full image decodes.
2. **True aspect ratio.** Take it from the asset (`Generation.params.aspectRatio`, or the
   image's natural `width/height`, or new stored `width`/`height` columns — same additive
   columns P1.11 needs). **Never hard-code an aspect for the media frame.** A 9:16 video must
   open tall; a 4:3 image must open 4:3.
3. **A large viewer, not a 620 px modal.** Full-viewport overlay: the media fits the available
   space (`max-height: 90vh`, `max-width: calc(100vw - panel)`), scaled down to fit, **never
   upscaled beyond its natural size** (an upscaled image is a blurry image).
4. **Right-hand detail panel** (the reference layout): author · **prompt** (with Copy and
   "See all") · **DETAILS**: Model · Quality · Size (`1280×720`) · Created. Below: the actions
   that already exist — Download · Project · Reference · Upscale · Delete — plus Share (P2's
   canonical deep link).
5. **Keyboard + navigation:** `Esc` closes, `←/→` moves to the previous/next generation in the
   grid. A viewer you must close and re-open for each item is the main reason the current one
   feels cramped.

## Hidden problems

- **P11.1 — `cover` vs `contain` is a silent content bug, not a style choice.** With `cover`,
  the user is shown a **cropped** picture and has no way to know. Any place using
  `center/cover` on a generation must be re-checked — the grid cards use the same `media()`
  helper (`:19419`).
- **P11.2 — `Generation` has no `width`/`height` columns.** Only `params` JSON
  (`schema.prisma:453`), which holds what was *requested*, not necessarily what the provider
  *returned* (models silently adjust dimensions). Store the **actual** probed `width`/`height`
  at generation time (ffprobe is already in the pipeline) — the reference panel's
  `Size: 1280×720` row needs a trustworthy source, and P9's `srcset` needs it too.
- **P11.3 — Same root cause as P9 and P10.** All three come from media being handled as a CSS
  background/thumbnail instead of a first-class element. **Fix them as one piece of work** —
  P9 (display derivative), P10 (real `<img>`, no gradient flash), P11 (viewer, true aspect).
  Doing them separately means touching the same 30 lines three times.

---


# P17 — Generation cards and session rows blend into the background — no surface, no border, no elevation

## Owner's report

The generation cards merge into the page background and look bad — they need to be **lifted off
the background**. The **session list in the left sidebar** has the same problem.

## Director's code analysis

- **The result card has no surface at all.** `platform/index.html:15090` →
  `.va-rc { cursor:pointer; position:relative; min-width:0 }` — **no `background`, no `border`,
  no `box-shadow`, no padding**. The media element (`.va-media`, `:15025`) is placed directly on
  the page background (`body { background: var(--th-bg) }`, `:14222` → `#0a0a0b` in NOIR).
  A dark image on a near-black page therefore has **no edge** — exactly the owner's complaint.
- The thumb (`.va-thumb`, `:15003`) only sets `border-radius: 12px` — a rounded rectangle with
  nothing behind it.
- Same story for the sidebar session rows and the `.va-sess` tiles (`:15369–15371`): only a
  radius and an `outline` on the selected item.

## What to build

1. **Give the card a real surface.** Card container = `background: var(--surface)` +
   `border: 1px solid` a hairline token + `border-radius` + a soft `box-shadow` for elevation,
   with the media inset inside it. The image must sit **on** a card, not float on the page.
2. **A visible hover state:** lift (`translateY(-2px)`), stronger shadow, brighter hairline —
   so the card reads as an object you can act on.
3. **Sidebar sessions:** each row gets a subtle surface + hairline (or at minimum a hover
   surface and a clear selected state). "My Library" is already boxed — the session rows below
   it are not, which is why the sidebar looks unfinished.
4. **A separator for dark media.** For a very dark image, a hairline alone is not enough — add a
   faint inner ring (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.06)`) on the media itself so
   the edge is visible even when the picture is black.

## Hidden problems (do not skip these)

- **P17.1 — 🔴 THREE THEMES. Hardcoded colours are a defect.** The platform ships **noir /
  neon / cold** (`:14225`, `:14232`, `:14239`), each with its own `--th-surface`,
  `--th-surface-2`, `--th-surface-3`. The BATCH6 rule is explicit: **token-first; a hardcoded
  colour is a defect, and every change is checked in all 3 themes.** Use
  `var(--surface)` / `var(--surface2)` / the hairline tokens (`:14340`) — never a literal hex.
  The card must look correct in **all three** themes; verify with screenshots in each.
- **P17.2 — ⚠️ FILE CONFLICT with the BATCH6 redesign workstream.** `platform/index.html` is
  being actively redesigned by the other director (`docs/FIX-PROMPTS-BATCH6-2026-07-12.md` —
  Prompt #4 is **AI Studio + Dashboard**, i.e. *these exact cards*). Doing P17 blindly means
  two people restyling the same component. **Before running this: check whether BATCH6 Prompt #4
  has already landed** — if it has, re-verify whether the problem still exists; if it has not,
  this fix must be handed to that workstream or explicitly coordinated. Do not merge blindly.
- **P17.3 — Fix it together with P9/P10/P11.** Those three rebuild exactly this component (the
  media goes from a CSS background to a real `<img>`). Restyling the card first and then
  rewriting its internals means doing the same work twice. **Sequence: P10 → P9 → P11 → P17**,
  or do them as one piece.
- **P17.4 — The catalog cards use the same class.** `.va-rc` is shared with the Templates
  catalog (P2 §Deep links renders `va-rc` cards too). Changing it changes the marketplace grid
  as well — which is probably desirable, but it must be checked, not discovered.

---


# P13 — 🔴 Switching models DESTROYS the references — the prompt keeps dangling @mentions

## Owner's report

Nano Banana 2 Lite accepts up to ~10 references. Other models accept fewer — or none at all.
Today, switching model **silently deletes** the references:

- Switch Image → **Veo 3.1** (no references): the thumbnails at the top **vanish**, but the
  `@Image 1…5` pills **stay in the prompt** → the chain is broken.
- Then switch to **Gemini Omni** (which *does* accept 3 images + 2 videos): too late — the
  references are already gone.
- Go back to Image: **still gone.** The prompt still mentions them.
- And when a model accepts *fewer* refs than the user has attached (9 images → a model that
  takes 3): what happens to the other 6? Today: **deleted.**

## Director's code analysis — this is by design, and the design is wrong

`platform/index.html:20526–20546` (`pickModel`):

```js
if (mMode !== this.toolModelKey(tool)) { Object.assign(upd, this.refResetPatch()); }  // mode change → WIPE ALL
else {
  if (catMode === 'image') { upd.refImages = nc.kind === 'image' ? st.refImages.slice(0, nc.max) : []; }  // clamp = DELETE
  else if (catMode === 'video') {
    if (nc.kind === 'frames') { upd.refImages = []; upd.refVideos = []; upd.refAudios = []; }             // Veo → WIPE
    else if (nc.kind === 'media') {
      upd.refImages = st.refImages.slice(0, nc.lim.image || 0);   // clamp = DELETE
      upd.refVideos = st.refVideos.slice(0, nc.lim.video || 0);
      ...
```

`refResetPatch()` (`:19062`) empties **every** reference slot. And crucially: **`aiPrompt` is
never touched here** — so the `@imgN` pills survive while the images they point to are gone.
That is the exact "chain broken" state the owner describes. Note the contrast with `removeRef`
(`:20375`), which *does* clean the prompt when the user deletes a reference deliberately: the
codebase already knows references and mentions must stay consistent — it just does not apply
that rule on model switch.

## The fix — references must be a MODEL-INDEPENDENT POOL

**Principle: a model change is a change of *what gets sent*, never a change of *what the user
has*.** Only the user deletes references (the ✕ / Clear from P12).

1. **One reference pool = the source of truth.** Replace the four parallel arrays
   (`refImages`, `refVideos`, `refAudios`, `refStartUrl`/`refEndUrl`) as *state* with a single
   ordered pool, e.g. `refPool: [{ id, kind:'image'|'video'|'audio', url, role:'ref'|'start'|'end' }]`.
   Nothing in `pickModel` may remove an item from the pool. (The existing arrays can remain as a
   *derived* view so the rest of the UI keeps working — a minimal-diff path.)
2. **The model caps produce a PROJECTION, not a deletion — expressed as SLOTS.**
   *(The owner supplied the reference UX for this — build exactly this.)*

   The reference bar is **not a generic pile of thumbnails**. It is the set of **slots the
   current model declares**:

   ```
   Seedance 2.0 →  [＋] [ 🖼 @start · Start Frame ▾ ] [ 🖼 @end · End Frame ▾ ]   (+ image/video/audio refs)
   Gemini Omni  →  [＋] [ 🖼 @start · Start Frame ▾ ] [ 🖼 @end · End Frame ▾ ]
                                                       ↑ DIMMED / DISABLED — Omni does not accept an end frame
   ```

   Rules:
   - Each slot has a **stable token** (`@start`, `@end`, `@img1…`, `@vid1…`, `@aud1…`) that the
     prompt can mention. The token never changes meaning.
   - Switching model **re-projects the slots**: a slot the new model does not support becomes
     **visibly disabled (dimmed), NOT removed**, and **the media inside it is preserved**.
     Switching back re-enables it with its content intact. *(Owner's example: Seedance → Omni,
     the End Frame slot greys out because Omni takes no end frame; nothing is deleted.)*
   - A disabled slot states **why** on hover ("Gemini Omni doesn't accept an end frame").
   - Over-limit items (9 images attached, model takes 3) render **dimmed** with
     *"not sent — this model uses 3 images"*.
   - **Mutually-exclusive capabilities are model-declared too.** (Owner: on Seedance, media in
     the start/end frame slots means image references are not offered.) The `＋` menu must only
     offer the kinds the current model can actually accept **given what is already attached** —
     never offer something that will be silently dropped.
   - Only **active** slots are sent to the API.
3. **Numbering is bound to the POOL, never to the active subset.** `@Image 4` must keep meaning
   pool item 4 across every model switch. **Never renumber on a model change** — renumbering
   would silently re-point every mention at a different picture. (Renumbering stays only in
   `removeRef`, where the user really did delete something.)
4. **Switching back restores everything** — because nothing was deleted. This is the whole point
   of the request.
5. **Generate: send only `active`.** If the prompt mentions an inactive reference, do not fail
   silently: show a pre-flight notice — *“@Image 4, @Image 5 will be ignored by Gemini Omni
   (max 3 images).”* — and let the user proceed or switch model.
6. **Make the cost of a model switch visible BEFORE it happens.** The model picker should show
   each model's reference capability (*“no references” / “3 images, 2 videos” / “up to 10
   images”*), and switching to a model that cannot use the attached references should say so
   (a toast/inline note), not do it quietly.

## Hidden problems

- **P13.1 — Model switch also silently resets other settings.** `:20546` →
  `upd.aiAudio = null; upd.aiBitrate = '';` and the aspect gets clamped elsewhere (`:18647`).
  Same disease: the user's choices are destroyed instead of being re-projected. Preserve them
  where the new model supports them; reset only what is genuinely unsupported, and say so.
- **P13.2 — `refResetPatch()` is used in four places** (`useGenAsRef` `:19083`,
  `useGenAsUpscale` `:19107`, `pickModel` `:20531`, `refClearIfModeChanged` `:19742`). Two of
  them (`Use → as reference`, `Use → Upscale`) *intentionally* start a fresh composition — those
  may keep resetting. `pickModel` and `refClearIfModeChanged` must **stop** resetting. Do not
  "fix" all four with one blind change.
- **P13.3 — Start/End frames are a role, not a separate list.** Seedance keeps them, Veo uses
  them as its *only* reference mechanism, Omni ignores them. In the pool they are items with
  `role: 'start' | 'end'`; the projection decides whether they are sent. BATCH5 #5 already
  preserves them for Seedance (`:20539–20541`) — that special case disappears naturally once the
  pool exists.
- **P13.4 — The server must stay strict.** The client sends only `active`, but the API must keep
  rejecting/ignoring references beyond a model's limits (never trust the client). Verify
  `apps/api/src/routes/studio-gen.ts` still validates ref counts per model after this change.
- **P13.5 — The signed cost quote may depend on the reference set.** Changing which references
  are active must refresh the quote through the existing path. **Do not compute or adjust any
  price on the client. Money zone — read-only.**
- **P13.6 — 🔴 The plugin has the same composer and the same bug.** `plugins/after-effects-cep/`
  ships the same model picker + reference chips (BATCH5 #6, hand-synced). Fix both, or the AE
  users keep losing their references.

**Acceptance:** attach 9 images → switch to Veo 3.1 → thumbnails remain (dimmed, "not used by
this model"), prompt pills intact → switch to Gemini Omni → the first 3 images light up as
active, 4–9 stay dimmed with a reason → switch back to Nano Banana → all 9 active again.
**Nothing was ever lost, and no mention ever changed meaning.**

---


# P20 — You must WAIT for one generation to finish before starting the next (web + plugin)

## Owner's report

After pressing Generate, you cannot start another generation until the first one finishes.
This is very bad — a user should be able to fire several generations and let them run.

## Director's code analysis — the limit is CLIENT-SIDE and artificial

- `platform/index.html:18767` → **`generate() { … if (this.state.generating) return; … }`** — a
  single boolean lock on the whole composer.
- `pollJob(jobId)` (`:18806`) starts with **`clearTimeout(this._pt)`** — there is **one** poll
  timer, so the client can only track **one** job at a time. Starting a second job would silently
  orphan the first.
- The fake progress animation (`syncGenAnim`, `:18021`) is likewise **global**
  (`state.generating`, `state.genProgress`) — one bar for the whole app.
- **The server does not impose this.** `POST /api/studio/gen` (`apps/api/src/routes/studio-gen.ts:1006`)
  has **no per-user concurrency check** — no "you already have a running job" guard anywhere.
  Jobs are created `queued` and picked up by the processor.
  → **The API can already run several generations per user in parallel. The UI is the only thing
  stopping it.**

## What to build

1. **Replace the boolean with a list.** `state.generating: bool` → `state.activeJobs: [{ id,
   sessionId, mode, model, cost, startedAt, progress }]`. `generate()` no longer returns early;
   it appends a job.
2. **Poll all active jobs.** Replace the single `this._pt` timer with one poller that ticks over
   every active job (or a timer per job id). Each job's `done`/`failed` handling stays exactly as
   it is now — just per job, not per app.
3. **A pending card per job, in the grid.** The result grid already has a pending tile style
   (`.ffm-res.pend` / `.ffa-res.pend` — breathing border). Show one placeholder card per running
   job **at the top of the grid**, each with its own progress and a cancel/dismiss action. The
   user sees their queue.
4. **Per-job progress, not a global bar.** `syncGenAnim` becomes per-job (and per P10, it must
   not `setState` at 380 ms globally — update the specific card's node).
5. **A sane concurrency cap** — e.g. **3–5 concurrent jobs per user**, enforced **on the server**
   (the client cap is a courtesy, not a guarantee). Over the cap → the job is **queued**, not
   rejected; show it as "Queued" in the grid.
6. **The composer stays usable while jobs run.** Prompt, references and model must remain
   editable — firing job #2 must not disturb job #1's state (this is another reason the
   reference pool of P13 matters: today the composer state IS the job state).

## Hidden problems

- **P20.1 — 🔴 Credits: five parallel jobs = five charges, and the balance check must be
  server-side.** The client checks `q.price > this.state.credits` (`:18778`) against a **local**
  balance that will be stale once several jobs are in flight. The server already consumes
  atomically — make sure it **rejects** (before consuming) when the balance is insufficient, and
  that the client shows "not enough credits" rather than firing a job that dies.
  **Money zone: do not change any credit value or the consume/refund logic — only the
  concurrency/UI around it.**
- **P20.2 — Provider rate limits and cost blow-up.** With no cap, an impatient user can queue 20
  videos in ten seconds — provider rate limits, `spend-guard.ts` caps, and the owner's bill all
  hit at once. The per-user cap (#5) is not optional.
- **P20.3 — Server-side processing concurrency.** Cloud Run runs with `--cpu 1 --max-instances 2`
  (P6/P7). Many parallel `processGeneration` calls on one instance will contend — most of the
  time they are just awaiting the provider (fine), but any local ffmpeg step is behind the
  **`FFMPEG_MAX_CONCURRENCY = 1`** semaphore. Verify the queue drains sensibly before advertising
  parallel generation.
- **P20.4 — Interaction with P18's idempotency.** Each job needs its **own** idempotency key —
  reusing one key across parallel jobs would collapse them into a single generation.
- **P20.5 — 🔴 The plugin has the same lock.** `plugins/after-effects-cep/` mirrors this
  single-flight design. Fix both, or AE users still wait (global plugin rule).
- **P20.6 — Session semantics.** Several jobs finishing into the same session must not fight over
  `activeGenId` / the visible result. Newest-first ordering, and the "active" result should not
  jump under the user's cursor while they are looking at another card.

---


# P22 — Generate is rejected AFTER the click when credits are short — it must be disabled BEFORE

## Owner's request

If the user does not have enough credits, the generation is rejected **after** they press
Generate. That must not happen: when credits are insufficient the **Generate button must be
disabled (greyed out, unclickable)**.

## Director's code analysis

`platform/index.html:18767–18779` — the current order is exactly what the owner describes:

```js
if (this.state.generating) return;
…
this.setState({ generating: true });                 // ① UI already says "generating"
const q = await FFAPI.quote(model.id, tool.mode, params);   // ② ask the server for the price
if (q.price > this.state.credits) {                  // ③ …only now check the balance
  this.setState({ generating: false, showCredits: true });  // ④ cancel + throw a modal at the user
  return;
}
```

The user clicks → the app *starts* → then aborts and shows a top-up modal. Meanwhile the composer
**already displays `COST ✦ 48`** before the click — so the price is known **in advance**. The
check is simply in the wrong place.

## What to build

1. **Fetch the signed quote reactively, not at click time.** Whenever the model / params /
   references change, debounce (~250 ms) and refresh the quote (`/gen/cost-quote`). Store
   `{ price, signature, pricedParams }` in state. This is what already feeds the `COST ✦ N` chip —
   make it authoritative.
2. **Derive the button state from it:**
   - `price <= balance` → **Generate** enabled.
   - `price > balance` → **Generate disabled** (greyed, `cursor: not-allowed`, `aria-disabled`),
     with a clear label next to it: **“Not enough credits · ✦ 48 needed, ✦ 12 left”** and a
     **Top up** button right there. No modal, no wasted click.
   - quote still loading → button shows a spinner / is temporarily disabled — **never** enabled
     with an unknown price.
3. **Same treatment for the other pre-flight gates** that today only appear as a toast *after* the
   click (`:18769–18771`): "this model requires a start frame", "this model requires a reference
   image". The button must be disabled with the reason shown, not fire and fail.
4. **`generate()` then just sends the already-signed quote** — no quote round-trip at click time.
   The generation starts instantly (this also removes one cross-Atlantic round trip, see P8).

## Hidden problems

- **P22.1 — 🔴 The SERVER must still enforce the balance. Do not remove any server-side check.**
  Disabling a button is a UX nicety, not a security control. The server's atomic
  `consumeAiCredits` (money zone) stays exactly as it is. If a client ever sends a request it
  cannot afford, the server must still refuse. **Never compute or trust a price on the client** —
  the client only *displays* the server-signed quote.
- **P22.2 — The balance goes stale with parallel jobs (P20).** Once several generations can run at
  once (P20), `state.credits` is out of date the moment job #1 is in flight. The button must
  compare against **balance − (credits already committed to in-flight jobs)**, or the user will
  fire job #3 and have it rejected by the server anyway — reintroducing exactly the bug we are
  fixing. **Do P20 and P22 together, or P22's promise breaks the moment P20 ships.**
- **P22.3 — Video price depends on duration** ("video is billed per second of output"), so the
  quote must refresh when the duration/resolution chips change — which is precisely the settings
  popover from P16. Wire the refresh to every setting that affects price.
- **P22.4 — Plan gates are not credit gates.** A Pro-only model on a Free plan is a *different*
  refusal ("upgrade to Pro"), not "top up credits". Show the correct one; today both end up as a
  post-click surprise.
- **P22.5 — The plugin has the same post-click rejection.** Same fix, same rules (global plugin
  rule).

---


# P16 — Composer chrome: the settings row overflows (Generate falls to its own line) and the labels are raw text

## Owner's report

- Some models expose **many settings**, so the settings row wraps and the **Generate button drops
  to the next line** — the composer looks broken and cramped.
- The reference chips run into each other / collide.
- The labels are **plain text** and look bad — `References: up to 9 images, 3 videos, 3 audio…`,
  `BALANCE ✦ 889 · video is billed per second of output`, `COST ✦ 48`, `Top up`,
  `MY LIBRARY · 27 GENERATIONS`, the `IMAGE` / `VIDEO` corner tags. **Replace them with proper,
  attractive icons/components** — raw text lines look unfinished.

## Director's code analysis

- `platform/index.html:15360` →
  `.va-dockrow { display:flex; align-items:center; gap:8px; margin-top:10px; **flex-wrap:wrap** }`
  with a `.sp { flex:1 }` spacer (`:15366`), inside a dock capped at
  `width: min(920px, calc(100% - 48px))` (`:15340`).
  With **Seedance 2.0** the row holds: mode · model · aspect · resolution · duration · audio ·
  bitrate · Enhance · COST · **Generate** — ~10 items. `flex-wrap` simply pushes the last ones
  onto a second line, and because the spacer collapses, **Generate ends up alone on the left**.
  This is not a styling accident — the row has **no overflow strategy at all**.
- With **Gemini Omni** it fits; with Seedance it does not. So the composer's layout quality
  depends on which model is selected — the exact thing a layout must not do.

## What to build

1. **A right-hand action cluster that NEVER wraps.** `COST ✦ N` + `Generate` sit in a
   `flex-shrink: 0` group pinned to the right of the row. Generate must be in the same place
   for every model.
2. **🎯 TARGET LAYOUT — the owner supplied a reference (Dreamina/Higgsfield-style composer).
   Build exactly this pattern; it solves the overflow structurally, not cosmetically:**

   ```
   ┌───────────────────────────────────────────────────────────────────────────┐
   │  [＋]  [🖼 Start Frame]  [🖼 End Frame]            ← reference row          │
   │                                                                           │
   │  Use @ to mention your images, videos or audio…   ← prompt (chip-editor)  │
   │                                                                           │
   │  [▶ Video ▾] │ [📊 Seedance 2.0 ▾] │ [⚙ 16:9 / 720p / 5 Sec ▾] │ [Toggle] │
   │                                                    [ COST ✦ 48 ] [Generate]│
   └───────────────────────────────────────────────────────────────────────────┘
   ```

   - **ONE settings chip, not seven.** Every per-model setting (aspect · resolution · duration ·
     audio · bitrate · anything a future model adds) collapses into a **single chip whose label
     is the current summary** — `16:9 / 720p / 5 Sec ▾`. Clicking it opens **one grouped
     popover**: `Resolution` (480p · 720p · 1080p · 4K) · `Duration` (4/5/6/7 sec · *View All*) ·
     `Audio` (toggle + ⓘ) · `Aspect Ratio` (16:9 · 9:16 · 4:3 · 3:4 · 1:1, **with little shape
     glyphs** · *View All*). Rows the current model does not support are simply **not rendered**.
   - **Result: the bottom row is FIXED at 3–4 elements** — mode · model · settings · (optional
     toggle) — plus the pinned `COST + Generate` cluster. A model with 8 settings and a model
     with 2 produce the **same** layout. Nothing can ever wrap again. This removes the need for a
     `ResizeObserver` overflow hack.
   - **The `＋` button opens a reference-kind menu** (as in the reference):
     `Start & End Frame` · `Image Reference` · `Video Reference` · `Audio File` — each with an
     icon, and each **hidden when the current model does not accept that kind** (P13 caps).
   - **`Start Frame` / `End Frame` are their own slots** on the reference row when the model
     supports frames — not buried inside the ＋ menu. Empty slot = a labelled button
     (`🖼 Start Frame`); filled slot = thumbnail + token + label + `▾` menu
     (`@start · Start Frame ▾`), per the owner's reference.
   - **The slot row is the P13 projection made visible** — see P13 §2. This is the same feature
     seen from the UI side; implement it once.

3. **Icon-first everywhere.** The project already ships **Phosphor icons** (`ph ph-*`) — use
   them. `icon + value`, never a sentence: mode (play) · model (chart) · settings (sliders) ·
   aspect ratio shown as **a little frame glyph** per ratio (as in the reference) · audio as a
   real **toggle**, not a text chip.
4. **Turn the raw text lines into components:**
   - `References: up to 9 images, 3 videos, 3 audio…` → a compact **icon row**
     (`🖼 ×9  🎬 ×3  🎵 ×3`) with the full sentence as a tooltip. It should also show
     **used / allowed** (`3/9`) — which the P13 pool makes trivial and genuinely useful.
   - `BALANCE ✦ 889 · video is billed per second of output` → a **balance pill** (coin icon +
     number) with the billing note behind an `ⓘ` tooltip.
   - `COST ✦ 48` → a proper cost chip, visually tied to the Generate button.
   - `Top up` → a real button with a `+` icon.
   - `MY LIBRARY · 27 GENERATIONS` → a header with an icon and a count badge.
   - The `IMAGE` / `VIDEO` corner tags on cards → **icon badges** (photo / film-strip glyph),
     not uppercase words.
5. **Reference chips must never overlap.** The reference bar (`.va-axrefs`, `:15567`) already has
   `flex-wrap: wrap` — with 9 references + the `＋` button they collide/overflow. Give it a
   fixed height with **horizontal scroll** (and a subtle fade at the edges), or a "+4 more"
   overflow chip. The bar must not grow taller than one row and push the prompt down.

## Hidden problems

- **P16.1 — Do this AFTER P13, or do it twice.** The reference bar must render **active** and
  **inactive** references (P13) and the `used/allowed` counter. Building the new chrome first
  and then bolting the pool state onto it means rewriting the same markup twice.
- **P16.2 — The plugin composer is much narrower.** The AE CEP panel is often ~380–450 px wide,
  so a row that barely fits at 920 px is hopeless there. The **single-settings-chip** pattern is
  what makes the plugin composer possible at all — it is **mandatory** there, not optional.
  Design the popover once and use it in both (the plugin popover may need to open upward /
  full-panel).
- **P16.5 — Settings must survive a model switch (P13.1).** With one combined chip the summary
  label is derived from state — if `pickModel` keeps nulling `aiAudio` / `aiBitrate` / clamping
  the aspect, the chip's label will visibly "reset itself" every time the user changes model.
  P13.1 must be fixed for this chip to behave.
- **P16.6 — The summary label must not lie.** `16:9 / 720p / 5 Sec` is only truthful if those are
  the values that will actually be sent. When a model forces a value (e.g. Omni forces audio on,
  or a model supports only one resolution), the chip must show the **effective** value, and the
  popover row must be marked as locked with the reason — never show a user-chosen value that the
  backend will silently override.
- **P16.3 — Possible text-merge bug, please verify.** In the owner's screenshots the prompt tail
  reads `…etiroz qilayotgan emotsiya**ushbu** sigaret va yonidagi…` — two fragments joined with
  **no space**. If that is not a typo, the chip-editor's serialization (`getValue`, `:17275`) is
  concatenating a text node and a following fragment without the separator. Reproduce by typing
  after a pill, then re-rendering. Related to the P10 re-render / P15 undo work — check it in the
  same pass.
- **P16.4 — `Audio: On 🔒`** shows a lock for Gemini Omni (audio forced on) but reads as a
  disabled setting. Make forced/locked settings visually distinct from user-changeable ones, and
  put the reason in a tooltip ("this model always generates audio").

---


# P14 — Composer: add references by DRAG & DROP and by PASTE (today: neither works)

## Owner's request

Adding a reference must be possible by **dragging it into the composer with the mouse** (called
out as very important) and by **copy-pasting it into the composer**.

## Director's code analysis — the current flow is worse than it looks

- **The only way to add a reference is the `＋` menu → a hidden file input** (`addRefFile`,
  `platform/index.html:19209`). And that input has **no `multiple`** — `inp.files[0]`
  (`:19215`) takes **one file per click**. Attaching 9 images today = opening the menu, picking
  a kind, choosing a source, and selecting a file — **nine times**.
- **The composer's paste handler exists but ignores images.** `:17397–17402` reads
  `clipboardData.getData('text/plain')` and returns early if there is no text —
  `clipboardData.files` / image items are **never looked at**. So pasting a screenshot does
  nothing at all.
- **There is no drop handler on the composer** (no `dragover` / `drop` listeners anywhere near
  it). Dropping a file on the page just makes the browser open it.
- The **upload plumbing already exists and is good** — `addRefFile` uploads ≤20 MB as a data-URL
  (`FFAPI.refUpload`) and >20 MB via a presigned PUT (`FFAPI.refUploadUrl`), with a 100 MB cap.
  **Reuse it. Do not write a second upload path.**

## What to build

1. **Drag & drop onto the composer — from BOTH sources (owner: both must work).** The whole
   composer (reference bar + prompt area) is a drop target. `dragover` → highlight the drop
   zone; `drop` → resolve the payload:

   **(a) EXTERNAL — from outside the app** (Finder/Explorer, the desktop, another app):
   `e.dataTransfer.files` → upload through the existing `addRefFile` pipeline (data-URL ≤20 MB /
   presigned PUT above), then add to the reference pool (P13).

   **(b) INTERNAL — from a generated card inside AI Studio / My Library:** the generation is
   **already on the server** — there is nothing to upload. Mark the gen cards
   `draggable="true"`, put the generation id in `dataTransfer` (a custom type, e.g.
   `application/x-frameflow-gen`, plus a `text/plain` fallback), and on drop resolve it through
   the existing **`addRefFromLibrary`** (`:19122`) — which already fetches a fresh signed URL via
   `FFAPI.genGet`. **Do not re-upload a generation that already exists**, and do not use the
   card's (possibly expired, thumbnail-sized) display URL as the reference.

   The drop handler must distinguish the two by inspecting `dataTransfer.types` **before**
   reading `files`.
2. **Paste.** Extend the existing paste listener: before the text branch, check
   `clipboardData.files` / `clipboardData.items` for `image/*`, `video/*`, `audio/*` — if present,
   upload them as references. Keep the current text/plain behaviour untouched when the clipboard
   holds only text. A pasted screenshot has no filename — synthesize one.
3. **Accept MULTIPLE files at once** — for drop, for paste, and add `multiple` to the file input
   in `addRefFile`. Uploads run sequentially with per-file progress; a failure on file 3 must not
   discard files 1–2.
4. **Route by MIME, not by which slot the user happened to open**: `image/*` → image ref,
   `video/*` → video ref, `audio/*` → audio ref.
5. **Every generated card is a drag source.** Not just My Library — the main AI Studio result
   grid, the session results, and the lightbox image. Give the user a visible affordance
   (`cursor: grab`, a subtle lift on drag) so the gesture is discoverable, and a drag preview
   (the thumbnail) instead of the browser's default ghost.
6. **Where does the item land?** Dropping/pasting **onto the prompt text** should add the
   reference **and insert its `@Image N` pill at the caret** — that is the user's intent when
   they drop it *into the sentence*. Dropping onto the **reference bar** only adds the reference,
   with no pill. Implement both.

## Hidden problems

- **P14.1 — This DEPENDS on P13 (the reference pool).** Dropping 10 images while a 3-image model
  is selected must not throw 7 of them away. Without P13, drag & drop just makes it easier for
  the user to lose work. **Sequence P13 first.**
- **P14.2 — `refBusy` blocks the whole composer.** `addRefFile` sets a single global
  `refBusy` flag (`:19210`, `:19219`) — with multi-file upload the user would be locked out for
  the whole batch. Track per-item state and show each thumbnail uploading (skeleton → ready),
  the way the bulk upload page does.
- **P14.3 — Dropping a file the current model cannot use.** Do not reject it and do not silently
  drop it: add it to the pool, mark it inactive with the reason (P13 §2).
- **P14.4 — Dragging/pasting an image FROM ANOTHER BROWSER TAB gives a URL, not a file.**
  Dragging an `<img>` out of another tab produces `text/uri-list` / `text/html` in
  `dataTransfer` — **no `files` entry** — and copying an image from a web page often yields
  `text/plain` = the URL. So "from outside" has two flavours and only one of them is a real
  file. Decide: (a) ignore URL payloads (they land as plain text in the prompt — today's
  behaviour), or (b) detect an image URL and **fetch it server-side** (never client-side: CORS
  will block it, and a client-side fetch of an arbitrary user-supplied URL is an SSRF-shaped
  footgun; a server fetch needs its own allow-list / size cap / content-type check).
  **Default to (a)** unless the owner asks for (b) — but say so in the UI ("drop the file, or
  save the image first"), otherwise the user will think drag & drop is broken.
- **P14.5 — Guardrails.** Enforce the existing 100 MB per-file cap on the drop/paste paths too,
  reject unsupported MIME types with a clear toast, and de-duplicate (dropping the same file
  twice should not create two identical references).
- **P14.6 — The plugin.** The AE plugin has the same composer. CEP can accept OS file drops, so
  drag & drop should work there too; paste support in CEP is more limited — implement what the
  runtime allows and state clearly what it does not. Do not leave the plugin composer as the
  only place where you still have to click through a menu.

---


# P12 — Composer: remove a mention pill from the prompt (hover ✕), and a Clear button

## Owner's request (new feature, not a bug)

1. Hovering an `@Image N` **mention pill inside the prompt text** shows an **✕ in its corner**;
   clicking it removes **that mention from the prompt only**. The **reference thumbnail at the
   top of the composer must stay** (this is the whole point — today the only way to get rid of a
   mention is to delete the reference itself).
2. Add a **Clear** button in the corner of the composer. Pressing it clears **both** the prompt
   text **and** the references.

## Director's code analysis

- The composer prompt is a **contenteditable chip-editor**, not a textarea (BATCH5 #6):
  `installChipEditor()` (`platform/index.html:17926`, re-mounted in `componentDidUpdate`
  `:18015`). Pills are atomic nodes with class `mchip` (`isPill`, `:17261`; `makePill`,
  `:17262`), serialized back to the `@imgN` / `@videoN` / `@audioN` token text (`:17275`,
  `:18894`).
- The **reference chips above the prompt** are a separate list (`refChipsView`, `:19659`) and
  each already has an ✕ → `removeRef` (`:20375`).
- **`removeRef` already does the *opposite* of what is now being asked** (`:20379–20387`): when a
  reference is deleted it **strips that token from the prompt AND renumbers the remaining
  mentions** (`@img3` → `@img2`, …) so no dangling mention survives. That behaviour is correct
  and must be preserved — the new feature must not disturb it.

## What to build

**A. ✕ on the mention pill (prompt-only removal)**

- On hover of an `.mchip` pill, reveal a small ✕ in its corner (CSS only — no re-render).
- Click → **remove the pill node from the editor and re-serialize** `aiPrompt` through the
  existing serialization path. **Do NOT touch `refImages` / `refVideos` / `refAudios`, and do
  NOT renumber anything** — the references are unchanged, so `@img1 @img2 @img3` keep their
  meaning. (Renumbering here would silently re-point every remaining mention at the wrong
  image — this is the one way to get this feature badly wrong.)
- The pill lives inside a `contenteditable`. Use `mousedown` + `preventDefault` so the click
  does not move the caret or blur the editor, remove the node, then fire the same input/sync
  handler the editor already uses. Verify the browser undo (`⌘Z`) still behaves.

**B. Clear button (corner of the composer)**

- Clears: prompt text, **all** references (`refImages`, `refVideos`, `refAudios`,
  `refStartUrl`, `refEndUrl`), and any derived state that hangs off them (cost quote / enhance
  chip / preset chips).
- Only enabled when there is something to clear.
- Because this destroys a long prompt in one click: either a **confirm** or an **undo toast**
  ("Cleared · Undo"). The owner has 5-image, multi-sentence prompts — losing one to a misclick
  is a real cost.

## Hidden problems

- **P12.1 — An orphaned reference is still sent to the model.** After removing the mention but
  keeping the reference, the composer holds an image that the prompt never mentions. Image-edit
  models (Nano Banana, Seedream) are given **all attached inputs**, whether or not the prompt
  names them — so the user will pay for and receive a result influenced by an image they thought
  they had "removed". **Decide and make it visible:** either (a) dim/mark unreferenced thumbnails
  ("not used in prompt") and still send them, or (b) do not send unreferenced images. **This is a
  cost/credit-affecting behaviour — do not change what is sent without the owner's decision.**
  Do NOT touch the credit/cost-quote code path itself (money zone).
- **P12.2 — 🔴 The plugin has the SAME composer.** BATCH5 #6 shipped the chip-editor in **both**
  the web and the AE plugin (kept in sync by hand). Per the global rule, the ✕-on-pill and the
  Clear button must land in `plugins/after-effects-cep/` as well, or the two composers diverge
  again. Grep the plugin for `mchip` / `installChipEditor` and mirror the change.
- **P12.3 — Cost quote must be re-issued after a Clear.** The signed cost quote is tied to the
  request contents; clearing the composer must invalidate/refresh it rather than leaving a stale
  quote in state. Read-only interaction with the money zone: refresh the quote through the
  existing path, never recompute a price client-side.

---


# P15 — Composer: Ctrl/Cmd+Z (undo/redo) does not work in the prompt editor

## Owner's request

Add undo (⌘Z / Ctrl+Z) to the prompt composer.

## Director's code analysis — native undo is impossible here; it must be built

The prompt is a **custom contenteditable chip-editor** (`installChipEditor`,
`platform/index.html:17250–17420`). It **mutates the DOM directly** and intercepts the keys that
would normally feed the browser's undo stack:

- `setValue()` (`:17302`) → `el.textContent = ''; el.appendChild(buildFragment(text))` —
  **wipes and rebuilds the entire editor**;
- `insertFragAtCaret()` (`:17326–17329`) → `r.deleteContents(); r.insertNode(frag)`;
- Enter (`:17367–17375`), paste (`:17397`), cut (`:17395`) and Backspace-on-a-pill (`:17381` →
  `p.parentNode.removeChild(p)`) all call **`preventDefault()`** and do the edit themselves.

A browser only maintains its undo stack for edits **it** performed. Direct DOM mutation
(`appendChild` / `removeChild` / `insertNode`, and especially `textContent = ''`) **destroys it**.
So ⌘Z today does nothing — or restores a corrupted state. **Native undo cannot be recovered
here; a history has to be implemented in the editor.**

## What to build

1. **A snapshot history inside the chip-editor.** The editor already has a canonical serialized
   form — `getValue()` returns the token text (`@img1 …`) and `setValue()` rebuilds the DOM from
   it (`:17275`, `:17302`). So a history entry is cheap: `{ text: getValue(), caret: <offset> }`.
   Keep an `undo[]` / `redo[]` pair, capped (e.g. 100 entries).
2. **Coalesce typing, snapshot discrete operations.** Plain typing groups into ~400–600 ms
   chunks (or on word boundaries) so ⌘Z does not undo one letter at a time. Every discrete
   operation pushes **its own single entry**: insert a mention pill · delete a pill (P12) ·
   paste · drop a reference (P14) · **Clear** (P12) · a reference removal that rewrites the
   prompt (`removeRef`, `:20375`).
3. **Key handling.** In the editor's existing `keydown` listener: `⌘Z` / `Ctrl+Z` → undo;
   `⌘⇧Z` / `Ctrl+Y` → redo. `preventDefault()` so the browser does not also try.
4. **Restore = `setValue(entry.text)` + restore the caret + fire the existing input/sync path**
   so `aiPrompt` state stays consistent. Restoring must **not** push a new history entry.
5. **Clear (P12) must be undoable** — that satisfies P12's "confirm or undo" requirement with no
   extra UI: ⌘Z brings the prompt back.

## Hidden problems

- **P15.1 — 🔴 The 3.4 s global re-render will fight the history.** P10 found
  `setInterval(() => this.setState(...), 3400)` (`:17996`), and `componentDidUpdate` re-runs
  `installChipEditor()` on **every** render (`:18015`). If that path re-assigns `el.value`, it
  calls `setValue()` → **the editor's DOM is rebuilt underneath the user**. That already risks
  caret jumps while typing; with a history it would also corrupt or reset it. **Fix P10 first
  (or at minimum make `installChipEditor` a no-op when the editor is mounted and its serialized
  value is unchanged) — otherwise undo will be flaky in a way that is very hard to debug.**
- **P15.2 — Undo must cover the reference pool, not just the text.** If ⌘Z restores a prompt that
  mentions `@Image 4` but the reference was removed in the meantime, the chain breaks again
  (P13's failure mode). Either (a) include the reference pool in the snapshot (recommended — the
  pool is a small array of URLs), or (b) restrict undo to text-only edits and explicitly
  document that reference add/remove is not undoable. **(a) is the honest answer** given the
  owner's workflow (5–9 references per prompt).
- **P15.3 — Snapshot the serialized text, never the raw HTML.** The pills are rebuilt from the
  token text; storing `innerHTML` would resurrect stale nodes and detached listeners.
- **P15.4 — The plugin.** Same chip-editor, same missing undo. Mirror it (global plugin rule).

---


# P21 — Account → Credits: add a TOTAL SPENT counter, and let the user open the generation from each row

## Owner's request

In **Account → Subscription & credits**:
1. Add a function that **totals all the credits the user has spent**.
2. From the **Credit activity** list, let the user **open/see the generation** that each row refers to.

## Director's code analysis — 🔴 the "Credit activity" table is NOT the credit ledger

`platform/index.html:19879`:

```js
const creditHistoryView = this.state.gens.filter(g => g.cost > 0).slice(0, 12).map(g => ({ … amt: '−' + g.cost … }));
```

It is built from **`state.gens`** — the generations currently loaded in the browser — and merely
*rendered* to look like a ledger. The real ledger exists in the DB (`CreditLedger`:
`schema.prisma:547` — `userId`, `generationId`, `delta`, `reason` (`consume` | `refund`),
`balanceAfter`, `createdAt`) and is **not used by this screen at all**. Consequences:

- **🔴 REFUNDS ARE INVISIBLE.** A failed generation is refunded (`refundAiCredits`), but this
  table still shows the **charge** and never the refund. **The user sees money taken and never
  given back** — they will conclude they were robbed. This alone is worth fixing regardless of
  the owner's request.
- **Top-ups / credit purchases are invisible** — only generations appear.
- Only the **last 12 loaded** generations are listed; it is not history, it is a fragment.
- **Therefore a "total spent" computed from this data would be WRONG.** The requested feature
  cannot be built on this source.
- `downloadHistoryView = []` and `hasDownloads = false` are **hard-coded** (`:19881–19882`) —
  that is why the panel says "Download history is coming soon" while the count is live.

## What to build

1. **A real ledger endpoint.** `GET /api/studio/credits/ledger?cursor=…` returning paginated
   `CreditLedger` rows joined with the generation (id, mode, model label, prompt excerpt, thumb),
   plus the aggregates:
   - **`totalSpent`** = `SUM(-delta) WHERE reason = 'consume'`
   - **`totalRefunded`** = `SUM(delta) WHERE reason = 'refund'`
   - **`netSpent`** = `totalSpent − totalRefunded`  ← this is the honest "credits spent" number
   - **`totalPurchased`** (top-ups) — from the billing side
   **Read-only aggregation. Do NOT touch consume/refund logic or any credit value (money zone).**
2. **Show the total in the Credits card**: `Spent: ✦ 1,240 · Refunded: ✦ 96 · Net: ✦ 1,144`.
   Showing the refunded amount is the point — it is what proves to the user that failures cost
   them nothing.
3. **Render the ledger, not the generations list.** Each row: type icon · label · date ·
   **signed amount** (red for `consume`, **green for `refund`**) · balance after.
4. **Row → open the generation.** `CreditLedger.generationId` already exists and is indexed
   (`schema.prisma:557`). Clicking a row opens that generation in the lightbox (P11) — or shows
   "this generation was deleted / refunded" when it has no asset. Add a thumbnail to each row.
5. **Filters:** All · Spent · Refunded · Purchased. And a date range if it is cheap.
6. **Pagination.** The list must not be capped at 12 — the ledger will grow.

## Hidden problems

- **P21.1 — Deleted generations.** A user can delete a generation; the ledger row survives (no FK
  — see the comment at `schema.prisma:683`). The row must degrade gracefully ("generation
  deleted"), not 404 or crash.
- **P21.2 — This exposes P18/P19 to the user.** Once refunds and duplicate charges are visible,
  any double-charge (P18) becomes **customer-visible**. Ship the P18 idempotency fix and the P18.1
  ledger audit **before or with** this, not after.
- **P21.3 — The plugin shows credits too.** The AE plugin has a balance/credits view; the same
  totals should be available there (global plugin rule). At minimum it must not contradict the web.
- **P21.4 — Downloads history is a stub.** `hasDownloads = false` is hard-coded while the monthly
  count is real — the panel promises something that does not exist. The data **does** exist
  (`DownloadEvent`, used by `realTemplateCounts` / earnings). Either implement it in the same pass
  or remove the "coming soon" panel; a half-built panel in the paying-customer screen looks worse
  than no panel.
- **P21.5 — A −344 credit video charge is visible in the owner's own screenshot.** Nothing to fix
  here, but the totals will make large charges obvious to users — make sure each row names the
  **model and the duration** it was billed for (video is billed per second), or the support
  questions start.

---


# P1 — Contributor upload flow is wrong: bulk must be the ONLY path, organized by category

## Owner's report (consolidated — this section is the FINAL, binding spec)

Single-template upload is useless — a contributor with 10 assets has no time to fill a 3-step
form 10 times. The upload page must be **bulk-only and category-driven**.

### CANONICAL TAXONOMY (binding · single source of truth for upload, catalog, admin, plugin)

```
1. Video Templates      kind=template  templateType=video-templates
   └─ app sub-step: After Effects · Premiere Pro · Apple Motion · DaVinci Resolve
   └─ UPLOAD FORMAT: .zip  (one zip = one template: project file + preview image/video)

2. LUTs                 kind=template  templateType=luts
   └─ UPLOAD FORMAT: RAW files, no zip  (.cube · .3dl · .look)

3. Stock                kind=stock
   ├─ Graphics          stockType=graphics         RAW: .jpg .jpeg .png .webp .svg
   ├─ Motion Graphics   stockType=motion-graphics  RAW: .mp4 .mov (alpha → .mov/ProRes)
   ├─ Music             stockType=music            RAW: .wav .mp3 .aiff
   └─ Sound Effects     stockType=sfx              RAW: .wav .aiff .mp3
   └─ UPLOAD FORMAT: RAW files, NO ZIP. Contributor selects e.g. Motion Graphics and drops
      10 raw video files at once.

4. AI Stock             — NOT uploaded by contributors. Filled from platform users'
                          generations via an Explore-submission chain → see P3.
```

Notes on the DB mapping (verified in `packages/database/prisma/schema.prisma:289–293`):
`kind`, `stockType`, `templateType` are plain `String` columns with defaults — **new values
are additive and need no enum migration.** `stockType` today documents `video|music|sfx|photo`;
`graphics` and `motion-graphics` are **added**. Do not delete the old values.

### Flow

1. Contributor opens **Upload** (bulk is the only mode — see P1.7 about the edit wizard).
2. Picks a **top-level category** (Video Templates / LUTs / Stock).
3. `Video Templates` → second step: the four host apps. `Stock` → second step: Graphics /
   Motion Graphics / Music / Sound Effects. `LUTs` → no second step.
4. The dropzone's accepted extensions and its copy **change with the selection** (a Music
   dropzone must not say ".zip files"). Contributor drops **many files at once**.
5. Everything goes to moderation. **Admin multi-selects and approves them all at once**
   (bulk approve already exists — `admin-views.js` `bulkAction()`).
6. **The algorithm derives the technical spec from the FILE ITSELF** (not from the name) and
   the **AI writes Description + Tags + Category**.

### Required metadata per asset

**A. Algorithmic (from the file, via ffprobe — must be exact, never invented):**

| Field | Video (Motion Graphics) | Image (Graphics) | Audio (Music/SFX) | LUT |
|---|---|---|---|---|
| Length / duration | ✅ `0:30` | — | ✅ | — |
| Resolution | ✅ `3840 × 2160` | ✅ | — | — |
| File size | ✅ `37.6 MB` | ✅ | ✅ | ✅ |
| Frame rate | ✅ `30 fps` | — | — | — |
| Alpha channel | ✅ `Yes/No` | ✅ (PNG/WebP) | — | — |
| Looped | ✅ `Yes/No` (see P1.10) | — | — | — |
| Video encoding | ✅ `H.264` | — | — | — |
| Audio codec / bitrate / sample rate | — | — | ✅ | — |
| Orientation | ✅ `Horizontal` | ✅ | — | — |

(The reference layout the owner supplied — Length / Resolution / File Size / Frame Rate /
Alpha Channel / Looped / Video Encoding / Orientation — is the spec list to render on the
asset detail page.)

**B. AI (internal, no user credits — same policy as `template-metadata.ts`):**

- **Video**: extract the **first frame and a middle frame**, send BOTH to the vision model →
  `Description` + `Tags` + `Category` (from the category list of the chosen top-level type).
- **Image**: send the image itself.
- **Audio**: no vision — derive from the file name + duration; tags from the name keywords.
  (If the name is meaningless the fallback applies; admin can fix it in the edit wizard.)
- **Video Templates (.zip)**: keep the existing behaviour — zip file name (+ preview image if
  present), see P1.4/P1.5.

**C. Defaults & name overrides (zip templates):** `Resolution` defaults to **1080p**,
`Orientation` defaults to **Landscape 16:9**; if the zip *name* states otherwise (`4K`,
`vertical`, `vertical and horizontal`) the name **wins** — see P1.5 / P1.6.

## Director's code analysis (root cause + hidden problems)

**What exists today**

- UI: `packages/assetflow-studio/js/contributor-views.js`
  - `uploadModeTabs()` (~line 597) — `Single template` | `Bulk upload (.zip)` segmented tabs,
    `UP_MODE` default = `"single"`.
  - `kindPickerCard()` + `PRODUCT_KIND_GROUPS` (~line 320) — the 3-step single wizard's product
    picker (Template: ae/pr/motion/resolve · Stock: video/music/sfx/photo).
  - `renderBulkUpload()` (~line 604) — a **flat** drop-zone: `.zip` only, no category choice,
    no sub-type, sends everything to one ingest endpoint.
- API: `apps/api/src/routes/contributor.ts` → `ingestOneZip()` (line ~1725) and
  `POST /ingest` (line ~2054).
- Metadata AI: `apps/api/src/lib/ai/template-metadata.ts` — `generateTemplateMetadata()`.
- Zip parsing: `apps/api/src/lib/ingest-zip.ts`; app detection: `apps/api/src/lib/apps.ts`.
- Admin bulk approve: **already implemented** (`admin-views.js` `bulkAction()` →
  `StudioApi.bulkReview`, `approve-free` / `approve-pro`) — step 5 needs no work.

**Hidden problems the owner did not mention (all confirmed in code):**

- **P1.1 — Bulk ingest HARD-REJECTS anything that is not an AE/Pr/Motion/Resolve project.**
  `ingestOneZip()` (line ~1751): if `zip.pack` is null → permanent reject
  `"No supported project file (.aep/.mogrt/.motn/.drfx…) found inside the zip"`.
  Pack extensions come from `apps.ts` `APP_CONFIG` (`.aep/.aet/.ffx`, `.mogrt/.prproj`,
  `.motn/.moti`, `.drfx/.dra/.setting`). **A LUTs zip (`.cube`, `.3dl`, `.look`) or a
  Graphics zip (`.png/.psd/.ai/.svg/.mogrt-less`) is rejected today.** So the owner's
  `Graphics` and `LUTs` bulk categories are impossible without extending pack detection.
  This is a **blocker**, not a nice-to-have.

- **P1.2 — Bulk ingest never writes `kind` / `templateType` / `stockType`.**
  `prisma.contributorTemplate.create()` (line ~1861) writes `templateApp` but NOT the
  BATCH3 taxonomy columns. Result: every bulk-ingested item lands with the schema default
  (`kind: "template"`, `templateType` default) → catalog type-pills and filters on the web
  and in the plugin **misclassify every bulk upload**. The new category picker must be
  passed through the ingest request and persisted.

- **P1.3 — The AI does NOT generate a Description.**
  `template-metadata.ts` returns only `{ title, cat, catLabel, tags }`. The system prompt
  asks for exactly `title` / `category` / `tags`. The owner explicitly wants `Description`.
  `ContributorTemplate.desc` stays empty on every bulk upload today.

- **P1.4 — Metadata AI runs on OpenRouter, which is being retired.**
  `template-metadata.ts` uses `isOpenRouterConfigured()` + `orChatJsonVision()` with
  `google/gemini-2.5-flash`. Project status says the model catalog now has **0 enabled
  OpenRouter models** (moved to Vertex / BytePlus). If `OPENROUTER_API_KEY` is unset in
  production, `generateTemplateMetadata()` **silently returns the fallback** →
  every bulk template becomes `"Uncategorized"` + generic filler tags. The owner would see
  "the AI isn't writing categories" and never know why. **Must be verified and, if unset,
  repointed to a live provider (Vertex Gemini) — keeping the internal, no-credit path.**

- **P1.5 — Resolution/Orientation are derived from PIXELS, never from the file name.**
  `ingestOneZip()` lines ~1837–1853: `probeMediaDimensions()` on the preview image/video →
  `orient` (horizontal/vertical/square) and `res` = `4k` if `max(w,h) >= 2000` else `1080p`.
  There is **no file-name parsing at all**. Also: the preview of a 4K template is often a
  1080p compressed MP4 → the item is filed as 1080p even though the project is 4K. The
  owner's rule (name wins, otherwise default 1080p + Landscape) is the correct fix.

- **P1.6 — "vertical and horizontal" cannot be stored.** `ContributorTemplate.orient` is a
  single string (`horizontal` | `vertical` | `square`). A template that ships BOTH
  orientations has no representation in the DB, the catalog filter, or the plugin.
  **Decision required from the owner** (see Open questions).

- **P1.7 — The single wizard is ALSO the edit screen.** `openEditTemplate()` (~line 640)
  sets `UP_EDIT_ID` and calls `route('upload')` — it reuses the same 3-step wizard. If the
  "Single template" tab is deleted outright, **editing an existing template breaks**. The
  wizard must be KEPT as the edit-only surface; only the *upload entry point* becomes bulk.
  Same for `admin` fix-ups of AI-written metadata.

- **P1.9 — 🔴 THE BIGGEST ONE: there is NO raw-file ingest path. The entire ingest pipeline is
  zip-only.** `ingestOneZip()` rejects anything that is not a `.zip` (line ~1733) and then
  rejects any zip without a project file (line ~1751). `bulkAddFiles()` on the client filters
  to `/\.zip$/i` (line ~433). The owner's Stock and LUTs flows send **raw .mp4 / .wav / .png /
  .cube files** — none of that exists today. This is not a tweak; it is a **second ingest
  pipeline** (`ingestOneAsset()`) beside the zip one:
  - client: category-aware `accept` list + validation (no more hard-coded `.zip`);
  - upload: reuse the existing presigned-URL path to `incoming/<contributorId>/…` (already
    used by the zip bulk flow — do NOT invent a new upload mechanism);
  - server: for a raw asset, the file **is** the pack (no unzip, no project-file check),
    `packHash` = sha256 of the file (dedup + malware scan keep working unchanged);
  - the preview/thumb: for video → generate a poster frame; for image → the file itself
    (downscaled); for audio → a waveform or a static placeholder + the audio file as preview.
    **Decide once and document it — an asset with no thumbnail is invisible in the catalog.**

- **P1.10 — Several of the requested spec fields cannot be read reliably. Do not fake them.**
  - **`Looped: Yes/No` is NOT stored in any container.** **OWNER DECISION: infer it
    algorithmically.** Implementation: extract the first and the last frame, compare them
    (e.g. downscale both to a small size and compute a perceptual/pixel difference); below a
    tuned threshold → `looped: true`. Requirements: run it **once at ingest** and store the
    result in the new `looped` column (never recompute at render); it must **never block or
    fail the upload** — on any error store `null` and simply omit the row from the spec list.
    Note honestly in the code comment that this is a heuristic and will sometimes be wrong;
    the admin can override it in the edit wizard.
  - **`Alpha channel`**: H.264/MP4 **cannot carry alpha**. Only `.mov` (ProRes 4444 / QT RLE)
    and `.webm` (VP9) can. If Motion Graphics accepts only `.mp4`, `Alpha` is always `No` and
    the field is pointless — so the accepted list for Motion Graphics **must include `.mov`**,
    and ffprobe must read the pixel format (`yuva420p`, `rgba`, `argb`, ProRes 4444) to answer
    honestly.
  - **File size** must be the stored object's size, taken after upload — not the browser's
    reported size (they differ after any transcode).
  - **`ffprobe` must actually be available in the API runtime.** The code already calls
    `probeMediaDimensions()`, so a probe binary exists — **confirm it ships in the Cloud Run
    image** before relying on it for eight fields; if it is missing, ingest silently degrades
    to defaults and every asset shows `1080p / Horizontal`.

- **P1.11 — DB columns for the spec list do not exist.** `ContributorTemplate` has `orient`,
  `res`, `fileSize` — but no `durationSec`, `width`, `height`, `fps`, `hasAlpha`, `looped`,
  `videoCodec`, `audioCodec`, `sampleRate`. The detail page cannot render the owner's spec
  list without them. **Additive migration required** (nullable columns; old rows keep NULL and
  the UI simply omits empty rows). No destructive change, no money-zone table touched.

- **P1.12 — Metadata runs AT INGEST (owner decision, 2026-07-12).** Not at approval. The admin
  must see a finished card — thumbnail, title, category, description, tags, full spec list —
  and approve (or fix) it with full information. **Approval stays a pure status flip**, so
  bulk-approving 50 items is instant and cannot time out on Cloud Run. The moderation queue UI
  must therefore render the AI-written metadata and the extracted spec for every pending item,
  and the admin edit wizard must be able to correct any of it before/after approval.

- **P1.13 — Cost/abuse control on the AI metadata path.** Every uploaded file triggers a vision
  call (2 frames per video). A contributor dropping 500 files fires 500+ calls with no rate
  limit and no cap — an internal, uncapped, unbilled path. Add a per-contributor daily ceiling
  and a global kill-switch env; on exceed, fall back to name-derived metadata instead of
  failing the upload.

- **P1.PLUGIN — the AE plugin browses by these same four types.** `assetflow-catalog.js`
  and the plugin's nav tabs group the catalog by `nav`/type. Because bulk ingest never writes
  `templateType` (P1.2), **every bulk-uploaded asset lands in the wrong plugin tab too** —
  not just on the web. Fixing P1.2 fixes both, but the plugin's tab labels must be corrected
  as well (see P2.PLUGIN).

- **P1.8 — AI category list is flat and not scoped to the chosen top-level.**
  `TEMPLATE_CATEGORIES` in `template-metadata.ts` mixes everything (titles, transitions,
  luts, mockups, logos…). Once the contributor has declared `LUTs`, the AI must not be free
  to answer `"transitions"`. The category list must be **filtered by the selected
  `templateType`** before it is put in the prompt.

## OWNER DECISIONS (2026-07-12 — binding)

1. **Multi-orientation → SUPPORTED.** Add an **additive** `orientations String[]` column to
   `ContributorTemplate` (keep the existing single `orient` column populated with the primary
   value for backwards compatibility — catalog, plugin and filters must not regress).
   `"vertical and horizontal"` in the zip name → `orientations: ["horizontal","vertical"]`,
   `orient: "horizontal"`. Catalog/plugin show a combined badge.
2. **AI input = ZIP FILE NAME ONLY.** Do NOT add vision/readme parsing in this prompt. If the
   name is meaningless → safe fallback (`Uncategorized` + keyword tags) and the admin fixes it
   in the edit wizard. (Keep the existing optional preview-image path in the code, but it is
   not a requirement of this fix.)
3. **TAXONOMY — FINAL (2026-07-12). This supersedes every earlier taxonomy note in this file,
   including the "5 pills incl. AI Stock" and the "Stock deferred" versions.**
   Top level = **Video Templates · LUTs · Stock · AI Stock** (see the canonical block at the
   top of P1). `Stock` is contributor-uploaded RAW files with four sub-types
   (Graphics / Motion Graphics / Music / Sound Effects). `LUTs` is its own top-level category.
   **`AI Stock` is NOT a contributor upload category** — it is filled by platform users'
   generations through an Explore-submission chain (**P3**), and therefore does **not** appear
   in the contributor upload picker at all.

4. **EVERY ASSET MUST LAND IN ITS OWN CATEGORY — this must be verified end-to-end, not assumed.**
   Owner's explicit requirement: what the contributor picks at upload is where the asset shows
   up, and the `AI Stock` category contains **only** `kind: "stock"` items — nothing else, and
   no stock item leaking into the template pills.
   **Verified bug (root cause):** `packages/assetflow-studio/platform/index.html` **never reads
   `kind` at all** — the catalog filters purely on `type` (`templateType`), and the API's
   `catalog-map.ts` (lines ~252–255) defaults `type` to `"video-templates"` when it is unset.
   Therefore **every stock asset currently falls into the "Video Templates" pill**. Combined
   with P1.2 (ingest never writes `kind`/`templateType`), the taxonomy is broken on both ends.
   Required proof before this prompt is called done — a real end-to-end run for EACH of the
   five categories:
   `contributor upload → admin approve → web catalog pill → plugin tab`
   — the asset must appear in its own category and **in no other**.

---


# P2 — Catalog naming + ROUTING: "Stock Catalog", correct type labels, and a real deep-link per asset

> Scope note: naming, per-type routes and per-asset deep links are ALL the same router in the
> same file. They are one prompt on purpose — splitting them would mean two prompts editing
> `go()` / `openDetail()` / the hash parser at the same time, which would conflict.

## Owner's report

On `getframeflow.app/#templates`:

- The **nav item "Templates" must read "Stock Catalog"** — everywhere (top nav, mega-menu,
  sidebar, mobile bottom nav, breadcrumb, footer links, page hero).
- The filter pill **"Templates" must read "Video Templates"**.
- The filter pill **"Motion" must read "Motion Graphics"**.
- (`Graphics` and `LUTs` are already correct.)
- The **route must become `/stock`**, and selecting a type pill must produce a nested route.
  **The catalog pills must mirror the canonical taxonomy in P1 — four top-level pills:**

  ```
  /stock/video-templates                Video Templates   (kind=template, templateType=video-templates)
  /stock/luts                           LUTs              (kind=template, templateType=luts)
  /stock/stock                → NO. Use:
  /stock/graphics                       Stock › Graphics          (kind=stock, stockType=graphics)
  /stock/motion-graphics                Stock › Motion Graphics   (kind=stock, stockType=motion-graphics)
  /stock/music                          Stock › Music             (kind=stock, stockType=music)
  /stock/sound-effects                  Stock › Sound Effects     (kind=stock, stockType=sfx)
  /stock/ai-stock                       AI Stock                  (see P3)
  /stock/ai-stock/image | /video        AI Stock sub-filters
  ```

  i.e. the `Stock` pill expands into its four sub-pills (a second pill row, like the owner's
  contributor picker), so no route ever reads `/stock/stock`.
- A template pill must show **only** `kind === "template"` rows; a stock pill only
  `kind === "stock"` rows with the matching `stockType`. Today `kind` is never read by the
  catalog at all — see P1 §4 for the root cause.
- **Every single asset must have its OWN link** — a template, a motion-graphics item, a
  graphic, a LUT. Today there is only the one generic catalog URL.
- **A shared link MUST show the asset's image** in the link preview (Telegram, Twitter/X,
  Slack, iMessage, WhatsApp, Facebook) — the owner requires this explicitly.

### ⚠️ DECISION REVISED (supersedes the earlier hash-route decision)

An earlier decision in this document said the routes would be **hash** routes (`#stock/...`).
**That decision is CANCELLED.** Reason — hard technical fact, not a preference:

> The URL fragment (everything after `#`) is **never sent to the server**. Crawlers and link
> unfurlers (Telegram, Twitter, Slack, Google) therefore cannot see `#stock/<slug>`; every
> shared link would resolve to the same site-root HTML with the same generic preview.
> **Per-asset link previews are impossible with hash routing.**

Binding URL shape — **real paths, no `#`**:

```
/stock                                                     catalog
/stock/<templateType>                                      catalog, type pill preselected
/stock/<templateType>/<slug>-<shortId>                     asset detail
e.g. /stock/video-templates/football-championship-logo-reveal-a1b2c3
```

`<slug>` is decorative (derived from the name); `<shortId>` is authoritative. Old
`#templates` and `/templates` URLs must 301/redirect to `/stock`.

### The filter toolbar must be CONTEXT-AWARE (owner requirement)

The toolbar (`Categories` · `All apps` · `Free / Pro` · `16:9` `9:16` `1:1` · `HD` `4K`) is
**hard-coded and identical for every category** — verified:

- `fOrientView` (line ~19798) → always `['16:9','9:16','1:1']`
- `fQualView`  (line ~19799) → always `['HD','4K']`
- `fAppsView`  (line ~19788) → always the full `appOptions` (Ae/Pr/Mn/Dr)
- `fGranView`  (line ~19790) → always the full flat `granularCats` list
- the master filter predicate is one long chain on line ~19772

Consequences today: selecting **LUTs** still offers an "After Effects / Premiere" app filter;
a **music** asset can be filtered by `4K` and `16:9`; the `Categories` dropdown offers
"Lower Thirds" and "Transitions" while browsing LUTs. Any of these produce a guaranteed
**0 results** dead end.

**Required:** the sub-categories and the filter set must be **derived from the selected
top-level category**. Implement as ONE declarative config object keyed by the five slugs — no
`if/else` scattered through the render.

**The taxonomy below is BINDING for v1** (owner-approved 2026-07-12: "write it yourself, we
can change it later"). It supersedes the flat `granularCats` list and the flat
`TEMPLATE_CATEGORIES` array in `apps/api/src/lib/ai/template-metadata.ts` — **both must be
rebuilt from this one source** so the contributor picker (P1), the AI metadata generator
(P1.8), the catalog filters and the plugin all agree.

```
VIDEO TEMPLATES   filters: Category · App(Ae/Pr/Mn/Dr) · Free-Pro · Aspect · Resolution
  intros · openers · titles · logo-reveal · slideshows · promo ·
  broadcast-packages · wedding · corporate · lower-thirds · transitions ·
  text-animations · infographics

LUTS              filters: Category · Free-Pro          (no App, no Aspect, no Resolution)
  cinematic · film-emulation · log-conversion · vintage-retro ·
  black-and-white · teal-and-orange · moody

STOCK › GRAPHICS         filters: Category · Free-Pro · Orientation · Resolution
  social-media · logos · mockups · infographics · backgrounds ·
  posters-flyers · thumbnails · textures · abstract

STOCK › MOTION GRAPHICS  filters: Category · Free-Pro · Aspect · Resolution · Alpha · Loop · FPS
  overlays · transitions · elements · backgrounds · light-leaks ·
  particles · lower-thirds · animated-icons · abstract

STOCK › MUSIC            filters: Category(genre) · Free-Pro · Duration · Mood · BPM
  cinematic · corporate · upbeat · ambient · hip-hop · rock ·
  electronic · acoustic · holiday

STOCK › SOUND EFFECTS    filters: Category · Free-Pro · Duration
  whooshes · impacts · risers · ui-clicks · foley · nature ·
  ambience · cinematic-hits

AI STOCK          filters: Type(Image|Video) · Category · Free-Pro · Aspect · Resolution
  abstract · nature · people · business · technology ·
  food · travel · sports · backgrounds
```

⚠️ `Mood` / `BPM` / `Duration` for audio and `Alpha` / `Loop` / `FPS` for motion graphics
depend on the new spec columns (P1.11). If a column is not populated, **hide that filter** —
never render a filter that can only return 0 results.

Migration note: existing rows carry old `cat` values (e.g. `uncategorized`, `logo-reveal`).
Do **not** delete or rewrite them — map unknown/legacy `cat` values to an `Other` bucket in
the UI so nothing disappears from the catalog. Additive only.

Rules for the implementation:

- A filter that does not apply to the current category is **not rendered** (not disabled, not
  greyed — absent). The toolbar changes shape as the pill changes.
- Switching the top-level pill **resets** any now-inapplicable selection, so a stale `4K`
  from Video Templates cannot silently zero out the LUTs list.
- The sub-category list per top-level type must come from ONE source shared with the
  contributor upload picker (P1) and the AI metadata category list (P1.8). Three different
  category lists for the same taxonomy is exactly the bug we already have.
- `AI Stock` sub-filters `Image` / `Video` map to the existing `stockType` values — note the
  DB value for images is **`photo`**, not `image`. Map label→value once, in the config object;
  **do not rename the DB value**.
- Deep-linkable: a sub-filter selection should be reflected in the URL where it makes sense
  (e.g. `/stock/ai-stock/video`), consistent with the routing section above.

## Director's code analysis

All in `packages/assetflow-studio/platform/index.html` (this file is edited DIRECTLY — it is
the CF Pages source; there is no build step for it).

- **Truncated pill labels — line ~17565:** `fixedCats = ['All', 'Templates', 'Motion',
  'Graphics', 'LUTs']`. The *stored* values are fine; only the display strings are wrong.
- **Two label↔slug mappers must stay in sync — lines ~18165, ~18177, ~18181:**
  - `pillTypes = { Templates: 'video-templates', Motion: 'motion-graphics', Graphics:
    'graphics', LUTs: 'luts' }`
  - `bandToType()` (~18177) and `typeToBand()` (~18181) hard-code the same short strings.
  - Also the keyword classifier at ~18160 returns the literal `'Motion'` / `'Templates'`.
  **Renaming the display labels without updating all four call sites silently breaks the
  catalog filter (0 results).** Best fix: make `fixedCats` a list of `{ value, label }`
  objects (or derive labels from a single `TEMPLATE_TYPES`-style map) so the label exists in
  exactly ONE place — do not scatter new string literals.
- **Nav label comes from the CMS, not from a literal — line ~17637:**
  `nav: { templates: 'Templates', … }` is the landing-config default, rendered as
  `{{ lcNavTemplates }}` (lines ~15738, ~15750). Changing only the literal in the file will be
  **overwritten by whatever is stored in the CMS/landing config** for existing environments.
  The fix must update BOTH the in-code default AND the persisted landing config (see
  `apps/api/src/routes/landing.ts`) — otherwise production keeps showing "Templates".
- **Other places that say "Templates" and must become "Stock Catalog"** (verified line numbers):
  ~15719 mega-menu (`Template marketplace`), ~16116 breadcrumb, ~16999 mobile bottom nav,
  ~17608 footer `Product` column, ~17716 footer links, ~17860 sidebar item, ~16420 the hero
  `<h2>Templates that cut<br>your edit time.</h2>`.
  Proposed hero copy (CMS-editable, owner may override): **“A stock catalog that cuts your
  edit time.”**
- **Routing — `go('templates')` / `goTemplates` / `isTemplates` / `data-screen="templates"`**
  (~16999, ~20149, ~20183). Requirements:
  - Primary route becomes `#stock`; `#templates` must **redirect** to `#stock` (old links,
    emails, the plugin's "open web" links and any SEO/OG references must not 404).
  - Nested route `#stock/<templateType>` must (a) be produced when a type pill is clicked,
    (b) be parsed on cold load / refresh / back-button so the pill is pre-selected.
  - The template DETAIL route must keep working from the nested route.
  - Grep the whole repo for `#templates` before finishing — it also appears in the plugin
    (`plugins/after-effects-cep/`) and in email templates.

### Deep links — what is broken today (verified)

- **`openDetail` (line ~20582) does NOT touch the URL** — it is a pure
  `this.setState({ detail: t })`. The detail view is invisible to the router.
  Consequences, all reproducible today:
  - the detail page **cannot be shared or bookmarked**;
  - the browser **Back button exits the whole catalog** instead of closing the detail;
  - **Google cannot index a single asset** — for a marketplace this is fatal;
  - **`shareTpl` (line ~20484) copies `window.location.href`, i.e. the generic `#templates`
    URL for every template.** The code even carries the admission:
    `// TODO(FF): per-shablon deep-link route kelganda shu URL almashadi`. Every "Share"
    click a user has ever made sent someone to the catalog root.
- **Required behaviour (client — `platform/index.html`)**
  - `go()` (line ~17903) currently hard-codes `const url = '#' + screen`. It must build a
    **path** for the stock routes. Keep the other screens working exactly as they do now —
    the app already understands path deep-links (`pathScreen`, line ~17937), so prefer paths
    consistently, but **do not regress `/login`, `/account`, `/aistudio`, `/projects`**.
  - `openDetail` pushes `/stock/<templateType>/<slug>-<shortId>` through the existing `go()`
    history helper — do NOT add a second history mechanism.
  - `closeDetail` / Back pops back to `/stock/<templateType>`, keeping the selected pill and
    the scroll position.
  - Cold load / refresh / pasted deep link resolves the asset **before** first paint: parse
    the path, take the `<shortId>` suffix as the source of truth. **A 404 state must exist**:
    unknown / unpublished / deleted id → a clean "Asset not found" screen linking back to
    `/stock`. Never a blank page, never a crash.
  - If the slug in the URL no longer matches the asset's current name → `replaceState` to the
    canonical URL (do NOT 404; the owner may rename assets).
  - `shareTpl` (line ~20484) copies the **canonical absolute deep link**, not
    `window.location.href`. Delete its `TODO(FF)` comment when done.
  - Exactly ONE pair of helpers — `assetPath(t)` / `parseAssetPath(pathname)` — used by every
    caller (catalog card, Recommended, Trending, breadcrumb, share, plugin links).
  - `<shortId>`: a stable, collision-safe suffix of the existing `ContributorTemplate.id`
    (cuid). Choose one derivation, document it in a comment, never duplicate the logic.

- **Required behaviour (hosting — link previews / OG tags)**
  - Add a Cloudflare Pages Function for the stock routes, e.g. `functions/stock/[[path]].js`.
    A Pages Function layer **already exists** (`functions/_middleware.js` — host router), so
    this is an addition, not a new hosting model.
  - The Function must:
    1. serve the SPA shell (`env.ASSETS.fetch` of the platform `index.html`) for every
       `/stock/*` request — this also provides the SPA fallback these paths need (note:
       `_redirects` generated by `packages/assetflow-studio/scripts/prepare-cf-pages.mjs`,
       line ~145, has **no `/*` catch-all** today, so `/stock/...` would 404 on a hard refresh
       without this);
    2. for an **asset** path, fetch that asset's public metadata from the API and inject, via
       `HTMLRewriter`, the real `<title>`, `<meta name="description">`, `og:title`,
       `og:description`, **`og:image` (the asset thumbnail URL)**, `og:type`, `og:url`,
       `twitter:card=summary_large_image`, `twitter:image`, and `<link rel="canonical">`;
    3. cache the injected HTML at the edge (e.g. `Cache-Control: public, max-age=300,
       s-maxage=3600`) so crawlers do not hammer the API;
    4. degrade safely: if the API call fails or the asset is unknown, serve the plain shell
       with the site's default OG tags — **never 500, never block the page**.
  - **API — a public single-asset endpoint is needed.** Today the catalog is
    `GET /api/plugin/catalog` (list, `APPROVED` + `published: true`). Add a read-only public
    endpoint (e.g. `GET /api/public/asset/:id`) returning `{ name, desc, thumbUrl, templateType,
    cat, orient, res, app, pro }` for **published assets only** — unpublished/pending assets
    must 404 (do not leak the moderation queue). No auth, no credits, no money-zone code.
  - **CSP:** `img-src` in `_headers` (same `prepare-cf-pages.mjs` file) must allow the
    thumbnail origin (GCS is already allowed). `og:image` must be an **absolute** URL.
  - Verify with the real unfurlers before declaring done: Telegram, Twitter/X Card Validator,
    Slack, and `curl -A "Twitterbot" https://getframeflow.app/stock/...` → the response HTML
    must contain the per-asset `og:image`.

## Hidden problems

- **P2.0 — The thumbnail must be a real, public, absolute image URL.** Catalog thumbs are
  served through the API, which **redirects to a signed GCS URL**
  (`apps/api/src/lib/serve-asset.ts`). Signed URLs **expire** — an `og:image` pointing at an
  expired signature shows a broken preview, and some unfurlers cache the redirect target, not
  the redirect. Before wiring `og:image`, confirm what the thumb endpoint returns and, if it
  is a short-lived signed URL, either (a) point `og:image` at the stable API endpoint that
  performs the redirect (most unfurlers follow one redirect — TEST it), or (b) make thumbs
  publicly readable on GCS with a stable URL. **This is the single most likely reason the
  preview image silently fails to appear — do not skip it.**
- **P2.0b — Preview image aspect ratio.** `twitter:card=summary_large_image` and Telegram
  expect roughly 1.91:1 / ≥600px wide. A vertical (9:16) template's thumb will be cropped or
  rejected. Acceptable for now (the thumb is shown as-is), but do not be surprised by it.
- **P2.1 — Naming must match P1.** The contributor bulk picker (P1) and the public catalog
  must show the SAME four labels. If P1 ships `Templates` while P2 ships `Video Templates`,
  contributors and buyers see two different taxonomies for the same data. Single source of
  truth: `TEMPLATE_TYPES` (`packages/assetflow-studio/js/data.js`) →
  `video-templates: "Video Templates"`, `motion-graphics: "Motion Graphics"`,
  `graphics: "Graphics"`, `luts: "LUTs"` — these labels are ALREADY correct there; the
  platform page invented its own short ones. **Reuse, do not re-invent.**
- **P2.2 — Two different meanings of the word "stock" now coexist. Do not conflate them.**
  - the **page** `/stock` = "Stock Catalog" = the whole marketplace (all five pills);
  - the **pill** `/stock/ai-stock` = "AI Stock" = only `kind: "stock"` rows in the DB.

  Do NOT rename the DB column or the `kind` values — the DB stays `template | stock`. This is
  a **UI-label layer only**. Put a comment at `fixedCats` stating exactly this, or the next
  person will "helpfully" rename something and break the catalog.
- **P2.PLUGIN — the AE plugin has THREE different, mutually inconsistent label maps.**
  Verified:
  - `plugins/after-effects-cep/assetflow-catalog.js:352` →
    `{ video: "Video Templates", motion: "Motion", graphics: "Graphics", luts: "LUTs" }`
  - `plugins/after-effects-cep/AssetFlow_Plugin.html:5094` → `NAV_LABELS =
    { video: 'Templates', motion: 'Motion Videos', graphics: 'Graphics', luts: 'LUTs' }`
  - `plugins/after-effects-cep/AssetFlow_Plugin.html:7040` → `HM_NAVLBL =
    { video: 'Templates', motion: 'Motion', graphics: 'Graphics', luts: 'LUTs' }`

  So the SAME type is called **"Video Templates"**, **"Templates"**, **"Motion Videos"** and
  **"Motion"** depending on which screen of the plugin the user is on. Consolidate to the
  binding labels (`Video Templates` / `Motion Graphics` / `Graphics` / `LUTs`) in **one**
  map inside the plugin, and have every screen read from it. Also: the plugin's browse panel
  is where users land after "Open in After Effects" — any web link the plugin opens must
  point at the new `/stock/...` URLs, not `#templates`.

- **P2.3 — ⚠️ FILE CONFLICT: `platform/index.html` is being actively rewritten by the BATCH6
  redesign workstream** (`docs/FIX-PROMPTS-BATCH6-2026-07-12.md`, Prompt #4 onwards, plus
  ~180 uncommitted lines already in the working tree). Doing P2 as a big edit will collide.
  **Constraint for Code: P2 must be a text/label/route change only — do NOT touch layout,
  CSS, tokens or component structure.** Run it when the tree is clean; if BATCH6 has
  uncommitted changes, stop and report instead of merging blindly.
- **P2.4 — The `1 results` count is real.** The catalog genuinely holds ONE published
  template while the landing claims "5000+". Not this prompt's job, but renaming the page to
  "Stock Catalog" makes the emptiness more visible, not less. (Tracked as the project's
  standing content blocker.)

---


# P3 — AI Stock: the "share a generation to Explore" chain does not exist at all

## Owner's report

The `AI Stock` catalog category is **not** filled by contributors. It is filled by the
platform's own users:

1. A user generates an image / video / audio in **AI Studio**.
2. On the generation card there is a new button — **"Add to Explore"** (submit my generation).
3. Pressing it sends that generated asset to the **admin** moderation queue.
4. The admin approves it (bulk approve, same queue).
5. It appears publicly in the **AI Stock** category.

**This whole chain — button, submission, admin queue entry, publishing — does not exist. The
UI/UX for it has to be designed and built.**

## Director's analysis

- Generations live in the `Generation` model and are private to the user; the catalog reads
  `ContributorTemplate` (`approvedCatalogWhere` in `apps/api/src/lib/catalog-map.ts`). These
  are **two different tables** — there is no path from one to the other today. That bridge is
  the core of this prompt.
- **Two possible designs — pick ONE and state it:**
  - **(a) Promote into `ContributorTemplate`** on submission (`kind: "stock"`, a new
    `stockType`/`source: "ai"` marker, `reviewStatus: PENDING_REVIEW`), copying the generated
    file into the normal asset storage layout. **Recommended** — the entire moderation, bulk
    approve, catalog, download, earnings, DMCA and audit machinery then works unchanged.
  - **(b) A separate `ExploreSubmission` table** with its own queue and its own catalog union.
    Cleaner data model, but it duplicates moderation + catalog + download logic. Only choose
    this if (a) is shown to be impossible.
- **The generated file must be COPIED, not linked.** A generation's stored object can be
  deleted by retention/cleanup or by the user; a published catalog asset that points at it
  would 404. Copy to the canonical asset key on submission.

## Hidden problems (all must be handled — these are the ones that bite later)

- **P3.1 — Rights and licensing.** A user is about to make an AI generation **publicly
  downloadable by everyone**. Required: an explicit attestation checkbox at submission (reuse
  `RIGHTS_ATTEST_TEXT` / `rightsAcceptedAt` / `rightsTermsVersion` — the contributor flow
  already has it), plus a decision on **who owns / who may sell it**, and whether the provider's
  terms (BytePlus/Vertex/fal) even permit redistribution of outputs. **Flag to the owner —
  do not silently publish user generations.**
- **P3.2 — Free or paid? Earnings?** Is an AI Stock item Free for everyone, or Pro-gated?
  Does the submitting user earn anything (the contributor payout machinery exists —
  `lib/earnings.ts`)? Undecided → **owner decision required**. Do NOT touch any credit or
  payout value while wiring this (money zone).
- **P3.3 — Moderation is now mandatory, not optional.** Public user-generated content is an
  NSFW/IP/abuse surface. `MODERATION_API_KEY` / `MODERATION_MODERATE_OUTPUTS` already exist in
  the env checklist — the submission path must run output moderation **before** it can reach
  the queue, and the admin queue must show the generation prompt alongside the asset.
- **P3.4 — Duplicate spam.** The same prompt run 50 times gives 50 near-identical assets. The
  existing `packHash` dedup only catches byte-identical files. At minimum: one submission per
  generation (idempotent), a per-user daily submission cap, and a "already submitted" state on
  the card.
- **P3.5 — The prompt is metadata.** For an AI asset the generation prompt + model is the best
  possible source for Title / Description / Tags — far better than a file name. Reuse the AI
  metadata path (P1) but feed it the prompt. Also decide: **is the prompt shown publicly?**
  (Most AI stock sites show it. It may leak whatever the user typed — sanitize/moderate it.)
- **P3.6 — Where does "Explore" live?** The owner says "Explore", the catalog pill is
  "AI Stock". These must be the same place or the user will not find their submission.
  Recommend: the button says "Add to Explore", and it lands in `/stock/ai-stock`. Also give
  the user a way to see the status of their submission (pending / approved / rejected) —
  otherwise it vanishes silently.
- **P3.7 — Plugin.** The AE plugin also shows generations. Once this exists, the plugin's
  generation cards need the same button (see the global plugin rule).

---



---

# P28 — 🔴 "Enhance" rewrites the prompt BLIND — it never sees the reference images

## Owner's report

"I built the **Enhance** button to work like an assistant, but I don't think it does. The assistant
must understand **what the user wrote**, **the references they attached**, and **what the user
actually wants** — and then rewrite a perfect English prompt. Understanding the user's intent is
the important part."

## Director's code analysis — the owner is right, and the cause is one missing argument

**The API already supports vision.** `apps/api/src/routes/studio-gen.ts:1352–1425`
(`POST /gen/prompt/enhance`):

```ts
image_urls: z.array(z.string().min(8)).max(10).optional(),   // :1363  ← accepted
…
const refUrls = publicUrls(p.data.image_urls || p.data.references);   // ← resolved and used
```

**The web client never sends them.** `platform/index.html:19007`:

```js
const r = await FFAPI.enhance(prompt, tool.mode, model ? model.id : undefined);
//                            ^prompt  ^mode      ^modelId      ← NO references
```

→ The "assistant" has **never seen `@Image 1…6`**. It rewrites the sentence from the *text alone*
and **invents** what the pictures contain — *"a woman with long dark hair"*, *"the distinctive
sunglasses"* — plausible guesses that may have nothing to do with the actual images. That is
exactly what the owner is sensing. **The vision path exists; the client simply does not use it.**

Secondary: the system prompt only instructs the model to *"preserve any @img/@image/@video/@audio
references verbatim"* (`:1412`) — i.e. it treats mentions as **strings to keep**, not as **images to
look at**.

## What to build

1. **Send the references.** Pass the current reference pool (P13) to `FFAPI.enhance` →
   `image_urls` (and video/audio refs where the provider supports them). The endpoint already
   accepts up to 10.
   ⚠️ Send **fresh, resolvable URLs** — the same trap as P14.1: a card's display URL may be a
   thumbnail or an expired signed URL. Use the same path the generation itself uses.
2. **Make the system prompt an ACTUAL assistant.** It must:
   - **look at each attached image** and describe what is really in it;
   - map every `@Image N` mention to **that** image's real content;
   - infer the user's **intent** — the input may be in **Uzbek, Russian or broken English** (the
     owner's own prompts are Uzbek). The output must be **fluent, precise English**;
   - keep the `@imgN` / `@videoN` / `@audioN` tokens **verbatim and correctly numbered** (they are
     the model's binding to the references — renaming or renumbering them silently breaks the
     generation, cf. P13);
   - respect the target model's context (aspect / duration / audio) **without writing settings into
     the prompt text** (`:1403–1405` already forbids this — keep it).
3. **Show the user what changed.** Enhance currently replaces the prompt in place. Offer a
   **preview/diff with Undo** — the owner's prompts are long and multi-reference; a silent
   overwrite of a good prompt is a real loss. (Once P15 lands, ⌘Z covers this — until then, a
   preview.)
4. **Handle the no-reference case** — with no images attached, enhance must still work (text-only),
   exactly as today.

## Hidden problems

- **P28.1 — 🔴 The user is CHARGED for enhance (`✦1`) and the result is guesswork.** `consumeAiCredits`
  runs on this path (`:1430`). Today the user pays a credit for a rewrite based on images the model
  never saw. Fixing the vision path is therefore also a fairness fix. **Money zone: do not change
  the enhance cost — only make it worth paying for.**
- **P28.2 — Vision costs more than text.** Sending 6 images to the enhancer is a heavier call than a
  text rewrite. Confirm the enhance model is vision-capable and check the cost against P24's
  measured numbers; cap the number of images sent (the endpoint already caps at 10).
- **P28.3 — Mention renumbering is a silent corruption risk.** If the LLM returns `@Image 3` where
  the user wrote `@Image 5`, the generation uses the **wrong picture** and the user cannot tell.
  **Validate the returned prompt**: every mention in the output must exist in the input and point at
  the same pool index — if not, reject the rewrite and keep the original (do not "fix" it silently).
- **P28.4 — The plugin has the same button and the same omission.** Same fix (global plugin rule).

---

# P29 — The user gets logged out on the landing page

## Owner's report

On `getframeflow.app/#landing` the user is dropped out of their session.

## Director's analysis

The mechanism is already documented in **Part 1, P8 #4**: `ff-api.js` clears the session on **any**
`401`, from **any** endpoint — `clearSession()` + a `ff-auth-expired` event
(`platform/index.html:17956` listens for it and tears down the session state). A permission-shaped
401, a stale request fired before the token is restored from `localStorage`, or a redeploy with a
different `JWT_SECRET` will all log the user out — and the landing screen is where a booting app
fires its first requests.

**This prompt is the reproduction + the fix on the landing path specifically:**

1. **Reproduce and identify the source.** Log which request returns the 401 on `#landing`
   (endpoint, whether a token was attached, the server's reason). Do not guess — the cause must be
   named before it is fixed.
2. **Apply the Part 1 fix here:** only clear the session when the server says the **token itself** is
   expired/invalid (a distinguishable `code`, e.g. `TOKEN_EXPIRED`), never on a permission error.
3. **Do not fire authenticated requests before the session is restored** from `localStorage` on boot
   (the cold-load path at `:17926–17960` restores the token *and* kicks off data loads — check the
   ordering).
4. **Public screens must not require auth.** The landing/pricing/plugin screens must render fully
   for a logged-out visitor **and** must not knock a logged-in user out.

⚠️ **Depends on Part 1, step 13** (`TOKEN_EXPIRED` vs `FORBIDDEN`). If step 13 has already landed,
this step is mostly reproduction + verification.

---

# P30 — Enhanced prompts get REJECTED by the provider ("no image was returned") — and the failure is invisible

> **SCOPE: the whole product — web + plugin, image + video + audio.** The owner flagged this
> explicitly. Every fix below applies to all four generation modes and both clients.

## Owner's report

"When I write the prompt myself in Uzbek, the generation works. When I run it through **Enhance**,
it fails — the model returns nothing (*'Nano Banana Edit: no image was returned'*). Enhance is
writing words and phrases that are not allowed."

## Director's analysis — what is actually happening

The owner's Uzbek prompt describes a scene the provider's safety system does not flag (it is not
reading Uzbek as explicit intent). **Enhance faithfully renders that intent into precise English** —
*"a **lit cigarette** in her mouth"*, *"being **kissed** on the cheek"* — and **Google's content
filter rejects it**. Enhance is not corrupting the prompt; it is stating the intent clearly, and the
provider says no to that.

## 🔴 DIRECTOR'S RULING — read this before writing any code

**We will NOT build anything whose purpose is to get content past a provider's safety filter.**
Not softened wording chosen to evade classifiers, not prompt obfuscation, not "say it in a language
the filter doesn't read". Reasons, in business terms:

- It **violates the terms of service** of Google/Vertex, BytePlus and fal.
- The penalty is **account termination without warning** — the Vertex account, the ModelArk pack,
  the whole generation stack. **The entire product stops in one day.**
- The owner would be betting the company on one feature.

**Any prompt in this document that appears to ask for filter evasion is to be refused and flagged.**

What we build instead: a system that is **honest, predictable and does not waste the user's
credits.** Four parts.

## 1 — Enhance must be FAITHFUL, not embellishing

Today's system prompt asks for a rich cinematic rewrite, so it **adds detail the user never
requested** (`lit`, `between her lips`, `being kissed on the cheek`) — and that added detail is what
gets rejected.

- Enhance must **express the user's intent**, not decorate it. No new physical actions, no new
  props, no added intensity that the user did not write.
- Prefer **neutral, descriptive phrasing** over dramatised phrasing — because it is more faithful,
  not because it evades anything.
- Keep the existing rules: `@imgN` / `@videoN` / `@audioN` tokens verbatim and correctly numbered
  (P28.3); no settings written into the prompt text.

## 2 — Warn BEFORE the credits are spent

- Run the existing moderation path (`MODERATION_API_KEY`, `moderateGeneratedOutput`'s input-side
  sibling) on the **final prompt**, **before** `consumeAiCredits`.
- If it is likely to be rejected by the selected model, say so **in the composer**:
  *"This prompt may be refused by Nano Banana (Google). You will not be charged if it is."*
- **The user must never pay to discover that a provider said no.** (This is also P19 §3: moderate
  early, not after the provider has been paid.)

## 3 — When the provider DOES reject: say why, refund, and show it properly

- **The current toast is broken:** *"Nano Banana Edit: no image was returned"* is shown with a
  **✓ success icon** (owner's screenshot). It is an **error** — icon, colour and wording must say so.
- **Surface the real reason.** Providers return a rejection reason/category — pass it through
  instead of the generic "no image was returned". The user cannot fix what they cannot see.
- **Guarantee the refund and show it.** The refund path exists (`refundAiCredits`) — verify it fires
  on a provider content rejection (this is a *provider* refusal, not a crash), and show
  *"✦2 refunded"* in the toast. **Money zone: use the existing refund path; change no values.**

## 4 — Offer a different MODEL (this is the legitimate answer)

Providers have **different, published content policies**. Choosing a provider whose policy permits
the content is not evasion — it is using the right tool.

- On a content rejection, offer: *"Nano Banana (Google) refused this. **Try Seedream 5.0 Pro
  (BytePlus)?**"* — one click re-runs the same prompt on a model whose policy allows it.
- Requires a per-model **policy-strictness hint** in the model catalog (`gen-models.ts`,
  read-only field) so the suggestion is informed rather than random.
- If **no** enabled model permits the content, say so plainly and stop. Do not keep charging the
  user to find out.

## Hidden problems

- **P30.1 — Enhance itself can be refused.** The enhancer is an LLM with its own policy. If it
  refuses to rewrite the prompt, the user must get a clear message and **their enhance credit back**
  — not a silent failure or a mangled prompt.
- **P30.2 — This is not only an image problem.** Video (Veo/Seedance/Omni), voice and SFX providers
  all have content policies. Every mode needs the same pre-flight warning, the same honest error and
  the same refund. **Verify all four.**
- **P30.3 — The plugin shows the same toast.** Same error surface, same fix (global plugin rule).
- **P30.4 — Repeated rejections must be rate-limited.** A user hammering a blocked prompt costs the
  owner nothing per attempt today (refunded), but it *does* cost provider quota and it is exactly
  the "refund-farming" pattern flagged in P19.2 / P23.1. Cap the number of moderation-blocked
  attempts per user per day.
- **P30.5 — Log rejections.** Store the provider, the model, the rejection category and the count.
  Without this the owner cannot tell whether 2 % or 40 % of his users are hitting a wall — and
  cannot decide which providers are actually usable for his audience.

---

# CLOSING — PART 2

**Problem intake is CLOSED** (owner, 2026-07-12). New issues go into a new file — this document is
a work order, not a notebook.

Three things that break this plan if ignored:
1. **Order.** 23 → 24 → 25 → 26/27/28 is a strict chain. Building the composer chrome or drag-and-
   drop before the reference pool means writing them twice; doing any of it before the re-render
   fix means debugging ghosts.
2. **The plugin.** Every composer step exists twice. `PLUGIN` scope is not optional.
3. **The money zone.** UI and gates: allowed. The credit math: **frozen.**

**The standing blocker:** the shelves get built in steps 30–34. **Step 35 fills them.** Everything
before that is preparation.
