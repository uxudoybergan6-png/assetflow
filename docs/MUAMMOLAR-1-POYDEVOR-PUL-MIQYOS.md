# MUAMMOLAR · PART 1 of 2 — FOUNDATION · MONEY · SCALE
### FrameFlow (web + After Effects plugin) · 2026-07-12 · Director's work order

> **This is PART 1 of 2.** Part 2 (`MUAMMOLAR-2-MAHSULOT.md`) covers AI Studio, the composer and
> the content pipeline. **Part 1 must be completed first** — Part 2's UI work would otherwise be
> built on a slow server, wrong prices and an unmeasured cost base.
>
> Each problem below is a **self-contained prompt** for Claude Code. **Run them in the order given
> in §EXECUTION ORDER — not in P-number order.** The `P<n>` ids are permanent anchors that other
> sections cross-reference.
>
> Workflow: copy ONE step → run it → `/clear` → next step. **The owner pushes; Code never pushes.**

---

---

## 📍 STATUS (updated 2026-07-13 — read this first)

### ✅ DONE (10 commits, pushed, deployed)
1 Sentry access-log · 2 Prisma `directUrl` (code side) · 4 DB indexes · 5 max-instances 2→10 ·
**6 ledger audit — NO double-charge losses found** · 7 idempotency on `POST /gen` (web+plugin) ·
9 BytePlus token capture (core) · 10 pricing D1/D2/D4 + boot floor assertion ·
11 margin input fix · 12 security verify (**found + fixed: presigned upload bypassed the storage
quota**) · 13 session security (a mistyped 2FA code no longer logs you out).
Owner-side done: Lemon Squeezy packs 250/600/1800 · Admin Plans (Pro 1000 / Studio 3000) ·
Website CMS copy in sync.

### 🔴 PENDING — IN THIS ORDER

| # | What | Why it matters | Notes |
|---|---|---|---|
| **DB move** | Neon `us-east-1` → **`eu-central-1` (Frankfurt)** | Cloud Run is in `europe-west1`. **~100 ms of Atlantic latency on every SQL query.** | New project `assetflow-eu` created. Migration in progress. Keep the old DB for a week. |
| **3 (CDN)** | Turn on `CDN_BASE_URL` | Removes ~10 000 signings per catalog load; fixes expiring thumbs + the gradient flash | ⚠️ **READ P7.CDN FIRST — the naive "make the bucket public" LEAKS EVERY PAID PACK.** |
| **8** | 🔴 **Ask the provider before refunding** (P19.5) + **resumable IMAGE jobs** | **The owner's silent money leak:** provider paid → our side failed → asset discarded → user refunded. Owner eats the cost. | **Its own focused session. Model: Fable 5. Money path — no rushing.** Deliberately deferred by Code, approved by the Director. |
| **14** | **Build the watermark** | Advertised on the pricing page, **absent from the code**. The only real Free↔Pro differentiator. | |
| **15–22** | Server-side catalog · slim payload · edge cache · plugin virtualization · bulk-ingest worker · sybil defences · profit dashboard · measure 50→500 | Must land **before** 5 000 assets are imported | |
| **Neon paid plan** | Free tier "scales to zero when inactive" | This is the **second** cause of "it randomly stops working" — the region move does **not** fix it | ~$19/mo. Do it when real users arrive. |
| **Password rotation** | The new Neon password was pasted into a chat | Rotate it in the Neon console after the migration | 1 minute |

---

## 🗺️ THE WHOLE REMAINING ROAD — BLOCKS A → J

> One block = one Claude Code session. **The owner verifies live after each block, then the next
> block starts.** Blocks are ordered by dependency; do not reorder.
> `P1` = this file · `P2` = `MUAMMOLAR-2-MAHSULOT.md`.

| Block | What | Steps | Model | Why here |
|---|---|---|---|---|
| **A** | **AI Studio — media** · stop the global re-render · real `<img>`/`<video>` · 1280 px display derivative · lightbox rebuild (true aspect) · card surface | P2: **23 + 24** | Fable 5 | 👉 **Current.** Everything else in the composer is built on this. |
| **B** | **Reference pool + parallel generations** — references survive a model switch (dimmed, never deleted, tokens never renumbered); several jobs at once | P2: **25** | Fable 5 | 🔒 Every remaining composer step depends on this state model. |
| **C** | **Composer complete** — one settings chip · Generate disabled when credits are short · drag & drop · paste · pill ✕ · Clear · ⌘Z | P2: **26 + 27 + 28** | Opus | 🔒 after B. |
| **D** | **Credits + AI honesty** — real ledger (refunds visible) · **Enhance actually sees the reference images** · landing logout · provider content rejections (warn, refund, suggest a permitted model) | P2: **29 + 29a + 29b + 29c** | Opus | Closes AI Studio. |
| ~~**E**~~ | ✅ **DONE & LIVE (2026-07-13)** — **CDN via a Cloudflare Worker proxy** (`cdn.getframeflow.app`). Per-object public was **impossible**: the GCP org policy (`storage.uniformBucketLevelAccess` + `publicAccessPrevention`) is enforced at project level and `roles/orgpolicy.policyAdmin` is not grantable there. **Plan B is better:** the bucket stays **fully closed**; the Worker gates every request on the same `isPublicReadKey()` allow-list (single source, imported by both API and Worker). Proof test live: thumb/preview/gen-display **200** · pack.zip / mogrt / gen-refs / gen-originals **403** · bucket-direct **403** · Pro pack download still **302 → 5-min signed URL**. | P1: **3** | — | Worker source: `workers/cdn-proxy/`. |
| **F** | 🔴 **MONEY** — build the **watermark** (Free↔Pro differentiator, currently advertised but absent) · **ask the provider before refunding** + resumable image jobs | P1: **14 + 8** | Fable 5 | **Without the watermark there is no reason to buy Pro.** Step 8 is the owner's silent loss. **Money path — its own session, no rushing.** |
| **G** | 🔴 **SCALE** — server-side catalog (filter/search/sort/paginate) · slim list payload + detail endpoint · edge cache · plugin list virtualization | P1: **15 + 16 + 17 + 18** | Fable 5 | 🔒 needs E. **Must land BEFORE content is imported** — otherwise the catalog silently lies and the plugin freezes AE. |
| **H** | **Content pipeline** — resumable bulk-ingest worker · contributor upload rebuild (bulk-only, 5-category taxonomy, **raw-file ingest**, ffprobe spec, AI metadata) · admin moderation at scale · semantic search · plugin import for raw media · stock watermarking | P1: **19** · P2: **30 + 32 + 33** | Fable 5 | 🔒 needs F + G. The biggest block — split it if it gets too large. |
| **I** | **Catalog links + AI Stock** — "Stock Catalog" naming · **a real deep link per asset** · **OG link previews with the image** · context-aware filters · **"Add to Explore" → admin → AI Stock** | P2: **31 + 34** | Fable 5 | 🔒 needs G (detail endpoint) + E (stable thumb URLs for `og:image`). **AI Stock is the fastest way to fill an empty catalog — it needs no contributors.** |
| **J** | **Business + LAUNCH** — sybil defences + payout safety (pool base, 30 %, credit expiry) · profit dashboard · measure 50 → 500 → 5 000 · **then import the content and launch** | P1: **20 + 21 + 22** · P2: **35** | Opus | 🔒 payouts must NOT be enabled before the sybil defences. |

**Owner-side, in parallel (not a Code block):**
Neon → **Launch plan** (🔴 the free 100 compute-hours run out in days — the site dies) ·
switch `DATABASE_URL`/`DIRECT_DATABASE_URL` to Frankfurt + deploy ·
rotate the Neon password · keep the old US DB for one week · plugin reinstall
(`install-cep.sh`) after any PLUGIN-scope block.

**After block D → `MUAMMOLAR-2-MAHSULOT.md` Phase 4 is still blocked until G.**

---

---

## 🔴 OWNER DECISION (2026-07-13) — WATERMARK APPLIES TO **BOTH** SURFACES

There are **two different** watermark surfaces, and they are built in different places:

1. **Stock catalog previews** (P4, Envato-style) — ✅ **BUILT** in block F step 14.
   Applies to `kind: "stock"` only; video **templates** stay clean. *(Note: there is almost no
   stock content yet, so this changes nothing user-visible until block H ships the stock ingest.)*

2. **AI generations** (P23 GAP 1) — 🔴 **STILL OPEN. This is the actual money hole.**
   The pricing page promises **Free: "Watermarked export"** and **Pro: "4K, watermark-free
   downloads"** — but `hydrateGenAssets` (`studio-gen.ts:105`) signs `url`/`downloadUrl` to the
   **clean original** for everyone. **A Free user downloads a clean, unwatermarked 4K AI file
   today.** The single advertised Free↔Pro differentiator does not exist.

**OWNER'S DECISION: option A — implement it.** Do NOT remove the promise from the pricing copy.
A **FREE-plan user downloading their own AI generation gets a WATERMARKED file; paid plans get the
clean original.** See "Block F — step 14b" below.

---

## GLOBAL RULES (apply to every step)

- **🔴 MONEY ZONE IS FROZEN.** Never change credit consume/refund, the signed cost-quote / HMAC
  (`lib/gen-quote.ts`, `gen-models.ts` `computeGenCost` / `imageUnitCost`, `plugin-profile.ts`) or
  any credit *value*. Adding gates, caps, idempotency, tracking, watermarks and UI **around** them
  is allowed. If a fix seems to require changing the math → **STOP and flag.**
- Migrations must be **additive only** (new tables/columns; nothing destructive).
- **English UI text; Uzbek code comments.** Minimal, tight diff outside the declared scope.
- **Studio source of truth:** edit ROOT `packages/assetflow-studio/js|styles|admin|contributor`,
  then run `npm run studio:sync`. NEVER edit the `studio/`, `admin/js` build artifacts.
  `packages/assetflow-studio/platform/index.html` is edited **directly** (CF Pages source).
- ⚠️ **BATCH6 conflict:** another workstream is redesigning `platform/index.html`
  (`docs/FIX-PROMPTS-BATCH6-2026-07-12.md`). Before touching that file, check whether BATCH6 has
  landed; if the working tree is dirty, **stop and report** instead of merging blindly.
- Verify with `node --check` (JS) / `npm run build -w apps/api` (TS) before committing.
- When finished: (a) commit with a clear, concise message (**no `Co-Authored-By`**); **do NOT push**.
  (b) write a short summary.

### 🔴 THIS PRODUCT IS TWO CLIENTS: WEB **AND** THE AFTER EFFECTS PLUGIN

The plugin (`plugins/after-effects-cep/`) is a **hand-synced copy** of the same catalog, the same
API client and the same composer — so **most bugs in this file exist twice.**

- Every step carries a **SCOPE** line: `API` · `WEB` · `PLUGIN` · `ADMIN`.
  A step marked `PLUGIN` is **not done** until the plugin change is made and verified.
- Before finishing a step, **grep the plugin** for the strings/routes/fields you changed.
- Plugin constraints: **no internet-loaded assets** (self-host fonts, inline SVG) · the panel is
  **~380–450 px wide** · after editing run `bash plugins/after-effects-cep/scripts/install-cep.sh`
  (the user restarts AE) · validate with `node --check` + a DOM/handler check.
- **A fix that lands only on the web is incomplete and will be rejected.**

---

## EXECUTION ORDER — PART 1

### PHASE 0 — SEE, THEN FIX THE FOUNDATION *(config/infra · hours, not days)*

| # | Do | Source | Scope | Why |
|---|---|---|---|---|
| **1** | **Turn on error tracking + metrics** (Sentry DSN; Cloud Run 5xx / latency alerts) | P8.1 | API | Everything below is currently diagnosed **by feel**. Make it a number **first**, so the fixes can be proven. |
| **2** | **Move the DB into the API's region** (Cloud Run `europe-west1` ↔ Neon `us-east-1`) **and switch to the Neon pooled connection string** | P8 #1–#2 | API | **~100 ms of Atlantic latency on EVERY SQL query.** Biggest single win in the whole document — and it is a config change. |
| **3** | **Turn on `CDN_BASE_URL`** — thumbs/previews become stable, public, cacheable URLs. ⚠️ **READ P7.CDN BELOW FIRST — a naive "make the bucket public" LEAKS EVERY PAID PACK.** | P7 #1 | API·WEB·PLUGIN | Removes ~10 000 URL signings per catalog load, makes responses cacheable, **and fixes the expiring-thumbnail and gradient-flash failure modes** (P8 #5, P10 #3 in Part 2). |
| **4** | **Add the DB indexes** for the filter columns (`kind`, `templateType`, `stockType`, `cat`, …) | P6 #6 / P7 #4 | API | Additive migration. Required before server-side filtering (step 16). |
| **5** | **Raise Cloud Run `max-instances`** (currently **2**) | P7 #9 / P8 #6 | API | Do this **after** 2–4, so you are not paying to serve an inefficiency. |

### PHASE 1 — STOP THE BLEEDING *(money · do before anyone else uses the product)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **6** | **AUDIT the ledger for double charges** — run the SQL, **report the result**, refund any losses through the existing refund path | P18.1 | API | **Read-only first. Report before writing code.** Tells the owner whether this has already cost him money. |
| **7** | **Idempotency key on `POST /gen`** · stop auto-retrying non-idempotent POSTs · move `cleanup`/`reconcile` off the request path | P18 | API·WEB·PLUGIN | Fixes the **double-charge** *and* the "Can't reach the server" error. 🔒 needs step 2. |
| **8** | **Ask the provider before refunding** (the 20-min timeout becomes a *check*, not a *refund*) · **resumable image jobs** · record `ProviderSpend` even on failure | P19 / P19.5 | API | Converts most silent provider losses into delivered results. |
| **9** | **MEASURE the real provider cost** — capture BytePlus token counts · GCP billing export · add a `confidence` field · Admin pricing table | P24 | API·ADMIN | 🔒 **Every number in step 10 depends on this.** |
| **10** | **Apply the owner's pricing decisions D1–D2, D4** — packs `$5→250` / `$12→600` / `$35→1800` · Studio `$59→3 000` · **delete "Priority generation" / "API access" / "Priority render queue"** · add a startup assertion "no channel sells below cost" | P27 | WEB·API·ADMIN | 🔒 after 9. **Stops the loss-making packs.** |
| **11** | **Margin input UI** — accept `1.5` and `1,5` · live preview of every model's new price · warn (don't block) below 1.0× | P25 | ADMIN | 🔒 after 9 — never tune a margin against a guessed cost. |
| **12** | **Verify 3 security questions and REPORT** — (a) can an unverified email generate? (b) is there a server-side Pro-**model** gate? (c) is the Free storage quota enforced? — then fix what is open | P23 GAP2 / P23.4 / P23.6 | API | **Report before coding.** Two may already be safe; one probably is not. |
| **13** | **Session security** — distinguish `TOKEN_EXPIRED` from `FORBIDDEN` (stop nuking the session on *any* 401) · add token revocation / "log out everywhere" | P8 #4 / P23 GAP3 | API·WEB·PLUGIN | |
| **14** | **BUILD THE WATERMARK** (server-side, Free plan) — advertised on the pricing page, **absent from the code**. The only real Free↔Pro differentiator. | P23 GAP1 / P4 | API | Makes Pro worth buying. |

### PHASE 2 — MAKE IT SURVIVE 5 000 ASSETS *(before any content ingest)*

| # | Do | Source | Scope | Note |
|---|---|---|---|---|
| **15** | **Server-side catalog: filter · search · sort · paginate** — and **delete the "fetch all pages" loops in BOTH clients** | P7 #2–#3 / P5.1 | API·WEB·PLUGIN | 🔒 needs 3 + 4. **The single biggest architectural debt.** Today both clients download the entire catalog. |
| **16** | **Slim the list payload** (cards only; scenes/description move to a detail endpoint) · ingest writes `assetKeysJson` | P7 #5 | API | Also provides the detail endpoint Part 2 needs for deep links. |
| **17** | **Cache the catalog response at the edge** (`Cache-Control` + `ETag`) | P7 #6 | API | 🔒 only possible after 3. |
| **18** | **Plugin list virtualization** — render only the visible cards | P7 #7 | PLUGIN | 5 000 DOM cards inside CEP will freeze After Effects regardless of API speed. |
| **19** | **Resumable bulk-ingest worker** — queue · per-item retry · progress · its own Cloud Run job | P6 #4 / P7 #8 | API | 5 000 clips ≈ **42–83 h of serialized ffmpeg**. It must never compete with user traffic. |
| **20** | **Sybil / abuse defences + payout safety** — download-event clustering · payout hold + review · keep `PAYOUT_MODE=pool` · pool base = revenue − AI − **infra** · share **30 %** · credit expiry (D3/D5) | P27 D3/D5 · P26.4 · P23 | API·ADMIN | 🔒 **Payouts must NOT be enabled before this.** |
| **21** | **Profit dashboard** — `revenue − AI − payouts − infra = profit`, per month / plan / channel | P26.8 | ADMIN | The screen that answers "am I making money?" in five seconds. |
| **22** | **Measure with 50 → 500 assets, record the numbers, then scale** | P7 #10 / P6.6 | — | **Mandatory.** Do NOT import 5 000 as the first test. |

**When Part 1 is done → start `MUAMMOLAR-2-MAHSULOT.md`.**

### Model guidance
- **Fable 5 (High)** — steps 7, 8, 9, 15, 19 (multi-layer, cross-client, money-adjacent).
- **Opus 4.8** — steps 1, 6, 10, 12, 13, 14, 20, 21, 22.
- **Sonnet 5** — steps 2, 3, 4, 5, 11, 16, 17, 18.

### Deferred (decided later, not in this part)
P26.3 (Studio "5 seats" priced as one account) · P26.7 (the pool can go negative — no floor) ·
P23.5 (device/seat limits) · P23.7 (chargeback velocity limits) · P5.6 (content-theft / pHash
detection).

---

# P8 — 🔴 "It randomly disconnects / sometimes just stops working" — root causes found

## Owner's report

Both the web app and the plugin sometimes drop the session by themselves, and sometimes simply
stop working.

## Root cause #1 — 🔴 THE DATABASE IS ON ANOTHER CONTINENT

- Cloud Run region: **`europe-west1`** (Belgium) — `deploy-cloudrun.sh:8`.
- Neon Postgres host: **`ep-shy-cake-apnzkowv.c-7.us-east-1.aws.neon.tech`** (N. Virginia) —
  `cloudrun-env.yaml:2`.

**Every single SQL query crosses the Atlantic: ~90–110 ms round-trip.** An endpoint that runs
5–10 queries pays **half a second to a second in pure network latency**, before any work. Under
load, or on any endpoint that queries per row, requests pile up, the instance (1 vCPU,
**max-instances 2**) saturates, and requests time out → *"it stopped working"*.

**Fix (highest priority, config-level):** put the database and the API in the **same region**.
Either move Neon to an EU region (`eu-central-1`) or move Cloud Run to `us-east*`. Nothing else
in P6/P7 matters as much per hour of effort — this is a **10–100× latency reduction on every
request**.

## Root cause #2 — 🔴 No connection pooling; Neon auto-suspends

`DATABASE_URL` points at the **direct** compute endpoint. It is **not** the Neon `-pooler`
host and carries **no `pgbouncer=true` / `connection_limit`** parameters.

- Prisma opens its own pool per instance; with a background worker (P6/P7 #8) plus the API,
  Neon's connection limit is reachable → intermittent `too many connections`.
- Neon **auto-suspends an idle compute**. The first request after idle pays a cold DB start —
  and can simply **fail**. This is the classic "works, then randomly doesn't" signature, and it
  matches the owner's report exactly.

**Fix:** use the Neon **pooled** connection string (`...-pooler...`, `?pgbouncer=true&
connection_limit=…&sslmode=require`), set Prisma's `directUrl` for migrations, and disable
auto-suspend (or accept it, but then add retry — see #4).

## Root cause #3 — 🔴 The web client has NO request timeout, and does not retry 5xx

`packages/assetflow-studio/platform/ff-api.js:53–62`:

- plain `fetch` with **no `AbortController`, no timeout** → if Cloud Run stalls, the request
  **hangs forever** and the UI spins until the user reloads. (The plugin does have
  `fetchWithTimeout`, 30 s — `assetflow-catalog.js:40`. The web app does not.)
- the 3-attempt retry loop only catches a **thrown network error**. A Cloud Run cold start,
  instance rotation or deploy returns **502 / 503** — `fetch` resolves, `break` runs, **no
  retry**, the error is shown to the user.

**Fix:** add a timeout (AbortController, ~20 s) **and** retry with backoff on `502/503/504` and
on `429` (respect `Retry-After`) — in **both** clients. Never retry non-idempotent POSTs blindly.

## Root cause #4 — 🔴 ANY 401 nukes the whole session

`ff-api.js:64–67`: on **any** 401 from **any** endpoint, the client calls `clearSession()` and
fires `ff-auth-expired` → the user is logged out mid-work. The JWT itself lives **30 days**
(`apps/api/src/middleware/auth.ts:29`), so genuine expiry is rare — which means these logouts
are being caused by something else:

- a redeploy with a different `JWT_SECRET` invalidates **every** token at once (mass logout);
- a 401 raised for a *permission* reason (not an auth reason) on one endpoint kills the session;
- a race where a request fires before the token is restored from `localStorage`.

**Fix:** only clear the session when the 401 is genuinely an **expired/invalid token** (the API
should return a distinguishable `code`, e.g. `TOKEN_EXPIRED` vs `FORBIDDEN`); everything else
surfaces as a normal error. Log the reason. **There is no refresh-token mechanism at all** — a
30-day JWT is the entire session model; when it dies, the user is simply thrown out. Decide
whether that is acceptable or a refresh flow is needed.

## Root cause #5 — Signed asset URLs expire after 24 h → dead thumbnails

`DISPLAY_URL_TTL = 86400` (`lib/catalog-map.ts:25`) and `CDN_BASE_URL` is empty (P7 #1), so
every thumb/preview URL is a **24-hour signed URL**. The **plugin caches the catalog to disk** —
so a cached catalog older than a day renders **broken/black cards** until a re-sync. The web app
papers over this with a focus-refetch of the entire catalog (expensive — see P6).
**Fix: P7 #1 (turn on the CDN).** Stable public URLs cannot expire.

## Root cause #6 — Two instances, no headroom

`--max-instances 2` (`deploy-cloudrun.sh:47`). During a deploy, a crash, or a traffic spike,
there is nowhere for requests to go → 429/503 → with #3 (no retry) the user sees a dead app.

## Required work (order)

1. **Move the DB into the API's region** (or the API into the DB's). — config, hours, biggest win.
2. **Switch to the Neon pooled connection string** + `directUrl` for migrations.
3. **Web client: request timeout + retry on 502/503/504/429 with backoff.** Same hardening in the
   plugin (it has a timeout; it needs the retry).
4. **Stop nuking the session on every 401** — distinguish expired-token from forbidden.
5. **Turn on `CDN_BASE_URL`** (kills the expiring-thumbnail failure mode too).
6. Raise `max-instances`; add a health-based warmup.
7. Add **error visibility**: `SENTRY_DSN` is in the launch checklist but unset. Right now these
   failures are invisible — the owner is diagnosing from feel. Turn it on **first**, so the fixes
   can be proven, and log DB latency + 5xx rate.

## Hidden problem

- **P8.1 — There is no way to see any of this.** No error tracking, no latency metric, no alert.
  Every conclusion above comes from reading configuration, not from telemetry. Ship Sentry (or
  Cloud Run's own metrics dashboard + log-based alerts) **before** the fixes, so "it randomly
  breaks" becomes a number instead of a feeling.

---


# P7.CDN — 🔴 STOP: turning on the CDN the naive way LEAKS EVERY PAID PACK

> **Director's catch (2026-07-13), before step 3 is executed. Read this in full.**

**The trap.** Step 3 says "set `CDN_BASE_URL` and make thumb/preview objects public". The obvious
way to do that is to grant `allUsers → Storage Object Viewer` on the bucket. **That would make the
ENTIRE bucket world-readable — including every paid pack.**

Everything lives in **one** bucket (`AWS_S3_BUCKET: assetflow-assets-2026`):

```
assetflow-assets-2026/
  templates/<id>/thumb.jpg      ← must be public
  templates/<id>/preview.mp4    ← must be public
  templates/<id>/pack.zip       ← 🔴 PAID. Must stay private.
  templates/<id>/mogrt/<slug>.mogrt   ← 🔴 PAID.
  gen-ref-src/...               ← user uploads. Private.
  users/<id>/generations/...    ← user content. Private.
```

Pack keys are **predictable** (`templates/<id>/pack.zip`) and the **template ids are public in the
catalog API**. A bucket-wide public grant therefore hands out the entire paid library:
`https://storage.googleapis.com/assetflow-assets-2026/templates/<id>/pack.zip`
— bypassing `guardDownloadable()` (the Pro gate, the download limit, the malware gate) completely.
**It would nullify P23's entire download-security chain in one click.**

## What must be done instead (this is a CODE task, not an owner click)

1. **Do NOT grant `allUsers` at the bucket level. Do not enable uniform public access.**
2. Make **only** the display objects public, **per object**:
   - `templates/*/thumb.*` · `templates/*/preview.*` · `templates/*/scenes/*` ·
     generation **display/thumb** derivatives (Part 2 P9).
   - **Never**: `pack.*`, `mogrt/*`, `gen-ref-src/*`, raw generation originals, incoming uploads.
3. Implement it in the upload path (`lib/s3.ts`): the thumb/preview/scene upload functions set the
   object public-read at write time; the pack/mogrt upload functions **must not**. Add an explicit
   allow-list of public prefixes in one place — never a "make public" flag passed by callers.
   (Bucket must therefore use **fine-grained** access, not uniform bucket-level access.)
4. **Backfill** the existing objects: a one-off script that walks the bucket and sets public-read on
   the allowed prefixes **only**.
5. **Then** set `CDN_BASE_URL=https://storage.googleapis.com/assetflow-assets-2026`.
6. **Prove it — this is the acceptance test, and it is not optional:**
   - `curl -I https://storage.googleapis.com/<bucket>/templates/<id>/thumb.jpg` → **200**
   - `curl -I https://storage.googleapis.com/<bucket>/templates/<id>/pack.zip` → **403**
   - `curl -I https://storage.googleapis.com/<bucket>/templates/<id>/mogrt/<slug>.mogrt` → **403**
   - The API pack route still works for an authorised Pro user (302 → 5-minute signed URL).
   - Repeat for a generation original vs its display derivative.
7. If a safe per-object public grant turns out to be impossible on this bucket, the fallback is a
   **separate public bucket** for display assets (thumbs/previews/derivatives) with the private
   bucket untouched — more work, same guarantee. **Never compromise on #6.**

**Alternative rejected:** proxying everything through a CDN in front of the API keeps the bucket
private but leaves the API in the bandwidth path — which is the cost P7 #1 exists to remove.

---

# P7 — PERFORMANCE PLAN: exactly what to change so web + plugin stay fast at 5 000+ assets

> Owner is time-pressured and wants to launch. This is the **ordered, minimal** engineering
> plan. P6 says *what breaks*; **P7 says what to do, in what order, and what each fix buys.**
> Items 1–6 are the **launch-blocking set**. Items 7–10 are the "grows with you" set.
>
> Already fine — do NOT redo these: thumbnails are generated as **512 px JPG**, previews are
> transcoded to **720p** (`lib/optimize-preview.ts:124`, `:94`). Image weight is not the problem.

## The launch-blocking six

**1. Turn on the CDN. (config; hours)**
`cloudrun-env.yaml:24` → `CDN_BASE_URL: ""`. Empty ⇒ `getPublicOrSignedUrl()` (`s3.ts:118`)
signs **every** thumb/preview URL, per row, per request.
Set `CDN_BASE_URL`, make the thumb/preview objects publicly readable, verify `img-src` /
`media-src` in `_headers` (`prepare-cf-pages.mjs`) allows the CDN host.
**Buys:** removes ~2 presigns per row (10 000+ per full catalog load), makes URLs stable and
**browser/edge-cacheable**, moves all image/video bandwidth off Cloud Run, and removes the
"signed URLs expired → refetch the whole catalog on focus" behaviour in the web app.
*Highest leverage change in this entire document.*

**2. Kill the "download the whole catalog" loops. (both clients; 1–2 days)**
- `platform/index.html:18215–18230` — `for (p = 0; p < MAX_PAGES=100; p++)` following
  `nextCursor` until exhausted.
- `assetflow-catalog.js:164–175` — the same loop in the plugin.
Replace with **one page at a time**: 24–48 items, `Load more` / infinite scroll.
**Buys:** first paint stops depending on catalog size. 5 000 assets → one request, not fifty.

**3. Move filtering, search and sorting to the server. (API + both clients; 2–3 days)**
Today the browser filters the array it holds (`index.html:19772`). Add query params to
`GET /api/plugin/catalog`: `kind`, `templateType`, `stockType`, `cat`, `app`, `pro`, `orient`,
`res`, `q`, `sort`, plus the existing cursor.
**Buys:** correctness *and* speed — without this, paginated + client-filtered = a category that
looks empty because the matches were on page 7. (This is P5.1; at 5 000 assets it is a blocker,
not debt.)

**4. Add the DB indexes. (additive migration; hours)**
Nothing indexes `kind` / `templateType` / `stockType` / `cat` / `templateApp`. Add composite
indexes covering the filtered queries, e.g.
`[published, reviewStatus, kind, templateType, updatedAt]` and
`[published, reviewStatus, stockType, updatedAt]`.
**Buys:** filtered queries stay on an index instead of scanning the table.

**5. Slim the list payload — and stop doing storage work per row. (API; 1 day)**
`CATALOG_SELECT` (`plugin.ts:80`) ships `metaJson`, `description`, full `tags`, contributor
object… and `mapCatalogItem()` runs `enrichScenesAsync()` **per row** (resolving every scene's
thumb/preview in storage) plus `listTemplateS3Keys()` when `assetKeysJson` is not cached.
- List endpoint returns only what a **card** needs: id, name, type/kind, thumb URL, pro flag,
  app, duration/res badge.
- Everything else (scenes, description, spec list, tags) moves to a **detail endpoint**
  (`GET /api/plugin/catalog/:id`) — which P2's deep links need anyway.
- The new raw-file ingest (P1.9) **must write `assetKeysJson`** so no LIST call is ever needed
  at read time.
**Buys:** an order-of-magnitude smaller response and no per-row storage round-trips.

**6. Cache the catalog response at the edge. (API; hours — only possible after #1)**
The catalog route sets **no `Cache-Control`** today (compare `plugin.ts:260`, which does).
Once URLs are no longer signed, add `Cache-Control: public, max-age=60, s-maxage=300` + `ETag`
to the list endpoint.
**Buys:** most catalog opens never reach the database. This is what makes "more users" cheap.

## The "grows with you" four

**7. Plugin list virtualization. (1–2 days)**
Even with paging, CEP renders every card into one ~800 KB HTML page. Render only the visible
window (windowed list / IntersectionObserver), keep thumbs `loading="lazy"`, and only load a
preview video **on hover**, never eagerly.

**8. Bulk ingest as a separate, resumable worker. (2–3 days — see P6 §4)**
`FFMPEG_MAX_CONCURRENCY` defaults to **1**; 5 000 clips ≈ 42–83 h of serialized CPU. Run ingest
as its own Cloud Run **job** (not the API service), with a queue, per-item retry, resume after
restart, and progress. **Ingest must never compete with user traffic for CPU.**

**9. Right-size Cloud Run. (config; hours)**
`deploy-cloudrun.sh:47–48` → `--cpu 1 --memory 1Gi --max-instances 2`. Two instances is a demo.
After #1–#6 the per-request cost collapses, so raise `max-instances` (e.g. 10) and consider
`--cpu 2`. Do this **after** the fixes, not instead of them — otherwise you are paying to
serve an inefficiency.

**10. Measure, then scale. (mandatory)**
Import **50** assets → measure catalog TTFB, payload size, plugin sync time, ffmpeg queue depth,
Cloud Run CPU. Then **500**. Only then 5 000. Record the numbers in `docs/`; without them
"is it fast?" has no answer. Load-test N concurrent users opening the catalog cold.

## Realistic launch advice (director's opinion)

You are late to market, so the temptation is to upload 5 000 assets and fix performance later.
**That order fails**: with today's code a 5 000-item catalog makes the web app and the plugin
unusable, and the first users see a frozen product — the damage is not recoverable with a later
fix. The dependency is strict: **#1–#6 (roughly one to two weeks) → import 500 → verify →
import the rest.** #1, #4 and #6 alone are hours of work and remove most of the cost.

A launch does not need 5 000 assets visible. **500 good assets with a fast catalog beats 5 000
with a frozen one**, and the remaining 4 500 can stream in behind the scenes once the ingest
worker (#8) exists.

---


# P6 — 🔴 SCALE: the platform will NOT survive 5 000 assets. Load-bearing fixes before ingest.

## Owner's question

"I have ~5 000 assets ready. If I upload them, will the web/plugin choke? Will the server fall
over as users grow?"

## Director's verdict: **yes, it breaks — and not in a subtle way.** Verified in code:

**1. 🔴 Both clients download the ENTIRE catalog on every load.**
- Web: `platform/index.html:18215–18230` — a `for (p = 0; p < MAX_PAGES=100; p++)` loop that
  keeps following `nextCursor` until the catalog is exhausted, concatenating everything into
  `this.state.catalog`.
- Plugin: `assetflow-catalog.js:164–175` — the identical loop, `MAX_PAGES = 100`.
- Page size default = 100 (`plugin.ts:121`, max 200).
→ **5 000 assets = ~50 sequential HTTP round-trips per client, per catalog load**, and a
  50 000-item-deep JSON payload in browser memory. Then the browser renders and filters all of
  it (`index.html:19772`). In the CEP plugin (a single ~800 KB HTML page, Chromium-embedded)
  this will visibly freeze After Effects.

**2. 🔴 `CDN_BASE_URL` is EMPTY in production** (`cloudrun-env.yaml:24` → `CDN_BASE_URL: ""`).
`getPublicOrSignedUrl()` (`s3.ts:118`) therefore takes the **signed-URL branch for every asset
URL**. `mapCatalogItem()` signs **thumb + preview (+ every scene thumb/preview)** per row.
→ For a full 5 000-asset catalog fetch that is **10 000+ presign operations per client, per
load** — pure CPU on a **1-vCPU** Cloud Run instance. And because signed URLs expire (24 h,
`DISPLAY_URL_TTL`), the responses **cannot be cached at the edge** and the web app *re-fetches
the whole catalog on window focus* to refresh them.
**Fix: set `CDN_BASE_URL` and serve thumbs/previews as stable public URLs.** This single change
removes the signing cost, makes catalog responses cacheable, and offloads image/video bandwidth
to the CDN. It is the highest-leverage fix in this document.

**3. 🔴 Cloud Run is sized for a demo:** `deploy-cloudrun.sh:47–48` →
`--cpu 1 --memory 1Gi --max-instances 2 --timeout 600`.
**Two instances, one core each.** With 50 requests per user just to open the catalog, a
handful of concurrent users saturates it. Raise `max-instances`, and only then talk about
"more users".

**4. 🔴 Ingesting 5 000 files will take days, not hours.** `optimize-preview.ts` enforces a
**global ffmpeg semaphore, default `FFMPEG_MAX_CONCURRENCY = 1`** — every transcode, every
watermark (P4), every probe is serialized on one core. At a conservative 30–60 s per clip,
**5 000 clips ≈ 42–83 hours of continuous CPU**, on an instance that is also serving traffic,
with `--timeout 600`. Add ~10 000 AI vision calls (2 frames per video, P1) on top.
→ Bulk ingest **must be a separate, resumable background worker** (its own Cloud Run job /
queue), not the request path. It must survive restarts, retry per item, and report progress.
Do not attempt 5 000 files through the current path.

**5. Per-item storage calls.** `mapCatalogItem()` calls `listTemplateS3Keys(t.id)` when the
`assetKeysJson` cache is missing (`asset-state.ts`) — that is **one GCS LIST per asset**. The
cache exists (good), but the new raw-file ingest (P1.9) **must populate `assetKeysJson` at
write time**, or the first full catalog load fires 5 000 LIST calls.

**6. Missing DB indexes for the new filters.** `schema.prisma` indexes
`reviewStatus`, `published`, `[reviewStatus, published, updatedAt]`, `packHash`,
`contributorId`, `takedownAt` — but **nothing on `kind`, `templateType`, `stockType`, `cat`,
`templateApp`, `orient`, `res`**. The moment server-side filtering lands (P5.1), every filtered
query is a sequential scan. **Additive indexes required** — at minimum a composite
`[published, reviewStatus, kind, templateType]` and `[published, reviewStatus, stockType]`.

## What must be built (in this order — this is the launch-blocking sequence)

1. **Set `CDN_BASE_URL`** + make thumbs/previews public, stable, cacheable URLs. (Config +
   verify `_headers`/CSP `img-src` allows the CDN host.)
2. **Server-side catalog: filter, search, sort, paginate.** Delete the "fetch all pages"
   loops in BOTH clients (web + plugin) — the client requests **one page at a time** with the
   active filters, and appends on scroll ("Load more" / infinite scroll). This is P5.1; with
   5 000 assets it is no longer debt, it is a **blocker**.
3. **Add the DB indexes** for the filter columns (additive migration).
4. **A resumable bulk-ingest worker** (queue + retries + progress), with `FFMPEG_MAX_CONCURRENCY`
   and instance sizing tuned deliberately — ingest must not compete with user traffic.
5. **Plugin list virtualization** (render only visible cards) — 5 000 DOM cards inside CEP is
   not viable regardless of how fast the API becomes.
6. **Only then** raise Cloud Run `max-instances` and load-test: N concurrent users × catalog
   open, with realistic thumbnails.

## Hidden problems

- **P6.1 — The 5 000 assets have to physically get there.** At ~50 MB average that is ~250 GB
  of upload through the browser to `incoming/`, then copied to permanent storage, then
  watermarked (P4) → **a second full copy**. Plan the GCS bill, the `incoming/` 7-day lifecycle,
  and a resumable uploader (a dropped connection at file 4 800 must not restart the batch).
- **P6.2 — 10 000 AI vision calls.** Two frames per video (P1). Rate limits, retries, and cost.
  The per-contributor cap in P1.13 must not lock the owner out of his own bulk import — give
  the admin/owner path a separate ceiling.
- **P6.3 — Embeddings backfill** (P5.3): 5 000 embedding calls, chunked and resumable.
- **P6.4 — The moderation queue with 5 000 pending items.** Bulk approve currently posts every
  id in one request (`StudioApi.bulkReview`). "Select all" over 5 000 rows will time out or
  blow the request body. Needs chunking + a server-side "approve by filter" action.
- **P6.5 — Neon connection limits.** A background ingest worker + the API + parallel requests
  can exhaust the Postgres connection pool. Confirm the pooled connection string is used.
- **P6.6 — Do not import 5 000 assets into production as the first test.** Import 50, measure
  (catalog TTFB, plugin sync time, ffmpeg queue depth, Cloud Run CPU), then scale up. The
  measurement is part of the work, not an afterthought.

---


# P18 — 🔴 "Can't reach the server — check your connection" while generating (and it can DOUBLE-CHARGE)

## Owner's report

While generating, the app sometimes shows **"Can't reach the server — check your connection"**.

## Where the message comes from

`platform/index.html:18197–18199`:

```js
errMsg(e) {
  if (e && e.message === 'NETWORK') return "Can't reach the server — check your connection";
  ...
```

`NETWORK` is thrown by `ff-api.js req()` (`:53–62`) **only after 3 failed `fetch` attempts** —
i.e. the request never got an HTTP response at all (connection refused / reset / DNS / CORS
failure). It surfaces on the `POST /api/studio/gen` call (`index.html:18799–18800`), not on the
poll (`pollJob`, `:18806`, fails silently and retries).

## Why it happens — three compounding causes (all verified)

1. **`POST /gen` is slow before it even starts working.** `apps/api/src/routes/studio-gen.ts:1006`:
   ```
   await cleanupExpiredSavedReferences(...)   // DB
   await reconcileStuckGenerations(...)       // DB (+ storage) — reconciles previous stuck jobs
   await prisma.genSession.findUnique(...)    // DB
   … model checks · cost-quote verify · credit consume (transaction) · create job
   ```
   Every one of those is a **cross-Atlantic DB round trip** (P8: Cloud Run in `europe-west1`,
   Neon in `us-east-1` — ~100 ms each). The request that is supposed to "just create a job" can
   take **seconds**.
2. **The retry policy cannot survive a Cloud Run cold start.** `ff-api.js` retries 3× with
   ~1.2 s / 2.4 s backoff — it gives up after **~4 seconds**. A Cloud Run instance boot can take
   far longer (the startup probe alone allows up to ~170 s: `deploy-cloudrun.sh:49`), and
   `--max-instances 2` means a second concurrent user can trigger exactly that boot.
   → the connection is refused, all 3 attempts fail inside 4 s, and the user gets **"Can't reach
   the server"** even though the service is coming up.
3. **There is no request timeout at all** (P8 #3) — so the other failure mode is the opposite:
   the request hangs and the UI spins forever.

## 🔴 The dangerous part: a lost response can DOUBLE-CHARGE the user

- `ff-api.js req()` retries **every** request on a network throw — **including `POST`**
  (`:53–62` has no method check).
- `POST /gen` has **no idempotency key** — `genSchema` (`studio-gen.ts:997–1005`) is
  `{ sessionId, mode, prompt, modelId, params, price, costQuoteSignature }`. Nothing identifies
  "this is the same request I already sent."

**So:** if the server *receives* the request, consumes credits and creates the job, but the
**response is lost** (connection reset, instance recycled mid-response), the client's `fetch`
throws → **it retries → a second job is created and credits are consumed a second time.**
The user sees "Can't reach the server" **and has been charged twice**.

This is consistent with the owner's report (the error appears *during generation*, i.e. exactly
when a request is in flight and instances are under load).

## Required fixes

1. **Never blindly retry a non-idempotent POST.** In `ff-api.js`, restrict the automatic retry
   to `GET`/idempotent calls, **or** gate it behind an idempotency key (below). This alone stops
   the double-charge.
2. **Add an idempotency key to `POST /gen`** (additive, no credit value changes): the client
   generates a UUID per *attempt to create a job* and sends it; the server stores it (unique
   index) and, on a repeat, **returns the existing job instead of creating a new one and
   charging again**. ⚠️ **MONEY ZONE — do not touch credit amounts, `computeGenCost`, the signed
   cost-quote or its HMAC.** Adding an idempotency record around the existing consume path is
   allowed; changing any credit value is not. If the implementation seems to require touching the
   quote signature, **STOP and flag.**
3. **Make `POST /gen` fast.** Move `cleanupExpiredSavedReferences` and
   `reconcileStuckGenerations` **off the request path** (a background sweep / a cron, or run them
   after the response is sent). The user's generate click must not pay for other jobs' garbage
   collection.
4. **Fix the transport (P8):** request timeout (~20 s), retry with exponential backoff on
   `502/503/504/429` (honour `Retry-After`), and a longer, more patient retry window so a Cloud
   Run cold start is survived instead of reported as a dead network.
5. **Fix the honesty of the message.** "Check your connection" blames the user's Wi-Fi for what
   is usually a server cold start. If the request may have gone through, say so and **verify**:
   before showing an error, re-check the session's jobs (the client already knows the session id)
   — if a job was in fact created, attach to it and poll instead of showing a failure.
6. **Raise `max-instances`** (P7 #9) so a second user does not force a cold start.

## Hidden problems

- **P18.1 — 🔴 AUDIT THE LEDGER FIRST — this is a task for Code, not for the owner.**
  Before writing any fix, **run this check against production and report the result**:

  ```sql
  -- Same user + same prompt + same model, created twice within 2 minutes = a retried POST /gen
  SELECT a.id AS gen_1, b.id AS gen_2, a."createdAt", b."createdAt",
         a.cost, a."modelId", left(a.prompt, 60) AS prompt
  FROM "Generation" a
  JOIN "Generation" b
    ON a."userId" = b."userId" AND a.prompt = b.prompt AND a."modelId" = b."modelId"
   AND a.id < b.id AND b."createdAt" - a."createdAt" < interval '2 minutes'
  ORDER BY a."createdAt" DESC;

  -- And the matching double charges
  SELECT "createdAt", delta, reason, "generationId", "balanceAfter"
  FROM "CreditLedger" WHERE reason = 'consume' ORDER BY "createdAt" DESC LIMIT 100;
  ```

  If rows come back, the double-charge is **real, not theoretical**: state how many times it
  happened and how many credits were lost, then refund them through the existing refund path
  (`refundAiCredits`) — **never by editing balances by hand.**
  The `reconcileStuckGenerations` function exists precisely because jobs get stuck, so this class
  of failure is **already known to the codebase**.
- **P18.2 — The plugin has the same client.** `plugins/after-effects-cep/assetflow-client.js`
  does its own fetching with a 30 s timeout but (per P8) **no 5xx retry** and no idempotency
  either. Same double-charge exposure. Fix both.
- **P18.3 — `pollJob` gives up after 8 consecutive failures / 12 minutes** (`:18806–18815`) and
  says *"Lost track of this job — it may still finish"*. With a slow API that message will start
  appearing for **successful** generations. It should resume polling on `visibilitychange`/focus
  rather than abandoning the job.

---


# P19 — Who pays when a generation fails? (The user is refunded. The OWNER can silently eat the provider cost.)

## Owner's question

"If a user presses Generate and the server errors, the user gets their credits back — fine. But
what happens to **my** money? Am I charged by the provider? What are the options?"

## Director's analysis — three cases, only one of them costs money

Verified in `apps/api/src/lib/gen-processor.ts`:

- `fail()` (`:995–1006`) sets `status = failed` and calls `refundAiCredits(...)` **atomically**
  (`updateMany` guarded, so a double refund is impossible — audit 2026-06-26).
  → **The user is always made whole.** That part is correct and must not be touched (money zone).

| Case | What happened | User credits | **Owner's real money** |
|---|---|---|---|
| **A** | Failure **before** the provider is called (validation, DB, cold start, network, invalid quote) | refunded ✅ | **nothing paid** ✅ |
| **B** | The **provider itself** errors / rejects | refunded ✅ | usually nothing — but **not guaranteed** (BytePlus bills tokens; some providers bill started jobs) ⚠️ |
| **C** | 🔴 The provider **produced the asset** (money already spent) and **our side** then failed — GCS upload error, output moderation block (`MODERATION_OUTPUT_BLOCKED`, `:986`), instance killed mid-processing, DB write failure | refunded ✅ | **PAID. Pure loss.** ❌ |

**Case C is the only real leak** — and it is invisible today.

**What already exists (do not rebuild):**
- **Video generations are resumable.** `isResumableRunningGeneration()` (`:311–321`) +
  `__providerJob` / provider webhook stored in `params` (`:166`, `:213`) → if the server dies
  while a *video* is running, it **re-attaches to the provider's existing job instead of paying
  for a new one.** Good. **This does NOT exist for images.**
- `writeProviderSpend()` (`lib/ledger.ts:35`) records provider cost per generation.
- `spend-guard.ts` caps total provider spend.

## Options (cheapest first — ordered by value per hour of work)

1. **Never fail what has already been paid for — RESUME instead.** Extend the video resume
   mechanism (`__providerJob`) to **image** generations. If the provider returned a result and
   only *our* storage/DB step failed, retry **fetching and saving that same result** (with
   backoff) instead of marking the job failed. The provider is paid once; the user gets what they
   paid for. **This converts most of case C into a success — it is the single highest-value fix.**
2. **Retry the delivery step, not the generation step.** Download-from-provider → upload-to-GCS
   must have its own retry/backoff and must not be the thing that throws the whole job away.
3. **Moderate the PROMPT before spending, not the OUTPUT after.** Output moderation
   (`MODERATION_OUTPUT_BLOCKED`) fires **after** the provider has been paid — every block is a
   direct loss. Pre-moderating the prompt is nearly free. Keep output moderation as a backstop,
   but it should be rare. (Do not weaken moderation — move most of it earlier.)
4. **Make the loss VISIBLE.** Today there is no way to answer "how much did I pay for
   generations that were refunded?". Add an admin metric that joins `ProviderSpend` with refunded
   `Generation` rows: **"paid to provider but refunded to user"** — per day, per model, in USD.
   Without this number, every discussion of this problem is guesswork. **Ensure `ProviderSpend`
   is written even when the generation later fails** — otherwise the loss is not even recorded.
5. **Price it in.** A 1–3 % failure loss is normal for this business; the credit price already
   carries a margin (BATCH4 "Apply 2× margin"). Once #4 exists and the real number is known, the
   margin can absorb it — that may be **cheaper than engineering it to zero**. Do not change any
   credit value without the owner's explicit decision (money zone).
6. **Verify case B per provider.** Confirm in each provider's billing docs whether a failed /
   rejected job is billed (BytePlus token accounting, Vertex, fal, ElevenLabs). Record the answer
   in `docs/` — right now it is an assumption.

## Hidden problems

- **P19.1 — P18's double-charge doubles this too.** A retried `POST /gen` creates a second job →
  the **provider is called twice** → the owner pays twice, while the user is only charged once
  (or twice, then refunded once). Fixing P18's idempotency fixes both sides.
- **P19.2 — Refund-farming.** If output moderation refunds the user, a user could generate
  policy-violating content repeatedly at **zero cost to themselves and full cost to the owner**.
  Add a per-user counter of moderation-blocked generations and a threshold (throttle / stop
  refunding after N blocks / suspend). **Owner decision required** — do not change refund
  behaviour without it.
- **P19.3 — `reconcileStuckGenerations` refunds stuck jobs** (`:1336`, `:1366`, `:1387`). If a
  job is stuck but the provider **did** deliver, that is a refund **and** a paid asset. The
  resume path (#1) must run **before** the reconciler gives up.

- **P19.4 — Owner's follow-up question: "the client dies but the API keeps generating — what
  then?" ANSWER (verified — the code handles it correctly, do NOT 'fix' it):**
  - A client disconnect (browser closed, plugin crashed, network dropped) **refunds nothing**.
    `pollJob` simply gives up client-side ("Lost track of this job — it may still finish") and
    the server finishes the job → the asset lands in **My Library**. User paid, user got the
    asset. ✅ Correct.
  - If the job runs longer than **20 minutes** (`stuckTimeoutMs`, `:1320–1323`), the reconciler
    marks it `failed` and **refunds**. If the provider then delivers at minute 21:
    `status: "done"` is written with `updateMany({ where: { id, status: "running" } })`
    (`:1302`) → **count = 0 → it is NOT flipped to done**. The fal webhook likewise ignores an
    already-terminal job (`fal-webhook.ts:156`). ✅ **A user can never get both the refund and the
    asset.** This guard is deliberate (audit 2026-06-26) — **money zone, do not touch.**
  - **The cost lands on the OWNER**: the provider was paid, the asset is discarded, the user was
    refunded. This is exactly case **C**.

- **P19.5 — 🔴 The 20-minute cutoff GUESSES instead of ASKING the provider. — DIRECTOR'S DECISION
  (binding): DO NOT simply raise the timeout.**

  The owner asked whether raising the 20-minute limit would fix this. **It would not — it would
  make it worse.** A job overruns for one of two reasons:
  1. the provider really is slow (long 4K video, provider queue) → a longer timeout helps;
  2. **nothing is driving the job any more** — the Cloud Run instance was recycled/restarted
     (`--max-instances 2`, see P8/P18), so the DB says `running` while **no process is working
     on it**. A longer timeout does not help here at all: it only makes the user wait 60 minutes
     instead of 20 for a refund they were always going to get. Given this deployment, case 2 is
     the likely-common one.

  **Decision — the timeout becomes a TRIGGER TO ASK, not a trigger to refund:**

  ```
  20 min elapsed (keep this number)
        └─► ask the provider about this job (the id is already stored: `__providerJob`, :166/:213)
              ├─ still running → EXTEND, do not refund   (a slow video is not a failure)
              ├─ done          → FETCH the result and COMPLETE the job
              │                   (the provider is already paid — deliver what was paid for)
              └─ failed/unknown → fail + refund  (only now)
  ```

  Plus a **hard ceiling** (e.g. 2 h) so a provider that never answers cannot leave a job hanging
  for ever, and **per-model expected durations** so the check interval is sensible (a 6 s
  Seedance clip and a Topaz upscale of a long video are not the same job).

  Video jobs are already resumable (`isResumableRunningGeneration`, `:311`) — this reuses that
  mechanism rather than inventing one. Keep the atomic guards (`updateMany … where status in
  (queued,running)`) exactly as they are; **only add the provider check before the refund
  decision.** Money math unchanged — money zone.

- **P19.6 — Orphaned files.** When a generation is refunded but the provider had already
  delivered, the asset may already be in GCS — never shown, never deleted, **still billed as
  storage**. Add a cleanup (or, better, deliver it per P19.5). Also count these in the
  "paid but refunded" metric (#4).

---


# P24 — Model prices: the owner does not trust the numbers. Stop hunting prices — MEASURE them.

## Owner's request

"I can't find the real prices of the AI models, or I'm getting them wrong. I need a director's
conclusion on how to enter accurate prices — I'm not going to go hunting for each model's price,
and I don't trust the ones that are in there now."

## Director's finding: the owner is right to distrust them — and the machinery to fix it already exists

**What is already built (do not rebuild — USE it):**

| Piece | File | What it does |
|---|---|---|
| Per-model provider cost in USD | `apps/api/src/lib/provider-cost.ts` | `IMAGE_USD_PER_UNIT`, video per-second tables, `estimateProviderUsd()` |
| Spend record per generation | `lib/ledger.ts` → `ProviderSpend.estimatedCostUsd` | what we *think* each generation cost |
| **Real invoice entry** | `ProviderInvoice` (`schema.prisma:619`) — `provider` · `periodMonth` · `actualUsd` | the **ground truth**, entered by an admin |
| Monthly reconciliation + margin alert | `lib/pricing-reconcile.ts` | revenue vs estimate vs **real invoice** → margin drift → email/webhook alert |
| Per-model margin | `lib/model-margin.ts` | credits earned ÷ USD spent, per model |
| Retail pricing engine | `lib/model-pricing.ts` | `creditUsdValue` (anchor $0.019) + `marginTarget` (2.0) + "Apply target margin" |
| Missing-price detector | `provider-cost.ts:144` `findEnabledModelsWithoutCost()` | flags enabled models with no cost entry |

**Why the distrust is justified — the code says so itself:**

- `provider-cost.ts:8–10`: *"Values are ESTIMATES — Stage 3 (the pricing engine + monthly billing
  reconciliation) will pin them down against the real invoice."* That reconciliation has **never
  been run against a real invoice.**
- `IMAGE_USD_PER_UNIT` (`:31`) mixes **confirmed** and **guessed** numbers in the same table, with
  the difference recorded only in a **code comment**:
  `1010: { "1K": 0.04 ✅, "2K": 0.06 taxminiy, "4K": 0.12 taxminiy }`.
  **Every 2K/4K tier is a guess.** Those are exactly the expensive ones.
- `DEFAULT_PROVIDER_USD = 0.5` is a deliberate over-estimate for unknown models.
- This has **already cost money**: the project's own status notes record that **Seedance 4K was
  being sold at a loss** until the margin was re-applied.

## 🎯 Director's conclusion — the method (do this, do not go price-hunting)

**Principle: a price you looked up is a rumour. A price the provider invoiced you is a fact.**

**Step 1 — Make the confidence EXPLICIT (stop hiding it in comments).**
Turn every cost entry into a structured record:
```ts
{ usd: 0.06, unit: "per image @2K", confidence: "official" | "measured" | "estimated",
  sourceUrl: "https://…", checkedAt: "2026-07-12" }
```
Rules: `official` = the provider's own pricing page (never a blog, never an aggregator, never an
LLM's memory) · `measured` = derived from a real invoice · `estimated` = a guess, and it must be
**conservative (over-, never under-estimate)**.

**Step 2 — CALIBRATE with a controlled run (this is the part that replaces price-hunting).**
For each `enabled` model × each tier the product actually sells (1K/2K/4K, each duration):
1. run **N identical generations** (N = 3–5) in a dedicated calibration session;
2. record everything the provider tells you at call time (BytePlus **returns token counts** — the
   BATCH5 test already proved the token→USD formula matches);
3. at the end of the billing period, enter the **real invoice** into `ProviderInvoice`;
4. `pricing-reconcile.ts` then divides the real invoice by the recorded usage → **the true USD per
   unit, per model.** Write it back as `confidence: "measured"`.
This is a **one-evening job for the whole catalog**, and it is the only number that is not a guess.

**Step 3 — Guardrails so an unknown price can never lose money.**
- **Never enable a model whose cost is `estimated` at a margin below target.** Extend the existing
  startup check (`findEnabledModelsWithoutCost`) to also fail/flag on
  `confidence === "estimated" && margin < marginTarget`.
- Keep the conservative over-estimate as the default — an over-estimate makes you *charge more*
  and trips the spend ceiling earlier; an under-estimate makes you *sell at a loss*. Asymmetric
  risk → always round **up** while unsure.
- Run `runMonthlyReconciliation()` on a schedule (it exists) and **actually read the alert.**

**Step 4 — Make it visible in Admin.** A Pricing table with one row per enabled model:
`credits charged · est. USD · **measured USD** · margin (×) · confidence · source · last verified`.
Colour: **red = estimated**, **amber = margin < target**, green = measured & healthy.
The owner should be able to answer "am I losing money on any model?" **in five seconds**, without
opening a file.

**Step 5 — Re-verify on a cadence.** Provider prices change. `checkedAt` older than 90 days →
the row goes amber. The reconciliation already detects drift *after* it costs money; the
`checkedAt` staleness flag catches it *before*.

## 🤖 AUTOMATION — the owner should not be typing invoice numbers at all (owner asked: "can this be automatic?")

Answer: **yes, for the two providers that matter.** Three tiers:

**Tier 1 — Google / Vertex → FULLY AUTOMATIC.**
Enable **Cloud Billing export to BigQuery** (free, standard GCP feature): GCP writes daily,
**per-SKU** cost rows. A nightly job queries it and writes the real USD into `ProviderInvoice` /
back into the per-model `measured` cost. **Zero human input.** This is the single biggest cost
line (Vertex images, Veo/Omni video, Chirp TTS) — automate it first.

**Tier 2 — BytePlus (Seedance / Seedream) → EXACT, no invoice needed.**
BytePlus **returns the token count in every response** — the BATCH5 live test already captured it
(`40,594 tokens` for a 480p/4s clip) and confirmed the formula matches. The token→USD rate is
known ($4.30 / 1M, the purchased pack). So:
`tokens × rate = the exact USD for THAT generation`
→ write it into `ProviderSpend.estimatedCostUsd` as **`confidence: "measured"`** at call time.
No monthly reconciliation required for this provider at all. **Make sure the adapter actually
records the returned token count** — if it is being discarded, that is a one-line fix with a large
payoff.

**Tier 3 — fal / ElevenLabs → check for a usage API; else 1 number per month.**
Verify whether each exposes a usage/billing endpoint. If not, the fallback is the owner entering
**one number per provider per month** into `ProviderInvoice` (the table and the admin path already
exist). Two minutes, once a month — acceptable.

**Result:** the owner's recurring task drops from *"look up every model's price"* to
**nothing** for Google and BytePlus, and *"paste one number"* for the small providers. The Admin
pricing table (Step 4) then shows measured, invoice-backed margins — not guesses.

## Hidden problems

- **P24.0 — Verify the BytePlus token count is being stored.** If `lib/ai/byteplus.ts` receives the
  usage/token field but does not persist it into `ProviderSpend`, Tier 2 above is not actually
  measuring anything. **Check this first — it is the cheapest accurate number in the whole system.**
- **P24.1 — 🔴 `ProviderSpend.estimatedCostUsd` is the input to the SPEND CEILING.** If the
  estimates are wrong, the global kill-switch fires at the wrong threshold — either too late
  (over-spend) or too early (`503` for everyone, see P23.3). The ceiling is only as trustworthy as
  these numbers.
- **P24.2 — Video is billed per SECOND of output, images per unit — and Seedance/BytePlus bills in
  TOKENS.** A single "USD per model" number cannot express all three. The unit must be part of the
  record (Step 1), and the calibration must cover **each duration/resolution the UI actually
  offers** — not just the default.
- **P24.3 — Reference images cost extra on some providers** (the code notes Seedream charges
  ~$0.003 per input reference beyond the first, and *deliberately excludes it* from the table).
  With P13/P14 making it easy to attach 9 references, that "small" number becomes real. Fold input
  cost into the calibration.
- **P24.4 — The retail anchor ($0.019/credit) is a separate decision from provider cost.** Do not
  let a provider price change silently move the retail price. Provider cost → margin → *proposal*;
  the owner presses **Apply**. That is how the existing "Apply target margin" button already works
  — keep it that way. **MONEY ZONE: nothing here may change a credit value automatically.**
- **P24.5 — Do not ask an LLM (or this document) for current provider prices.** They change, and a
  confidently wrong price is exactly how a model ends up being sold at a loss. Only two sources
  count: **the provider's own pricing page** (with a URL and a date) and **the invoice**.

---


# P26 — 🔴 UNIT ECONOMICS: Studio and the credit packs SELL CREDITS BELOW COST. Full chain audit.

## Owner's question

"Check the whole chain: **Contributor → Admin → user subscription money**. These are all guessed
prices. Pro is $19 for 1 000 credits — what is one credit actually worth? How much of that $19
goes to the contributor, how much to the AI providers? **Am I running at a loss?** And if a
contributor signs up on a second account and downloads their own templates non-stop — what
happens? Find the problems I haven't thought of."

## The numbers (all read from the code — not guessed)

- **Credit anchor:** `DEFAULT_CREDIT_USD = 0.019` (`lib/model-pricing.ts:23`) — literally derived
  as *"PRO $19 / 1 000 credits"*.
- **Margin target:** `DEFAULT_MARGIN_TARGET = 2.0` (`:26`).
- **Model price formula:** `credits = ceil(providerUSD × margin ÷ creditUsdValue)`.
  → **by construction, one credit is meant to cost the owner `$0.019 / 2 = $0.0095` in provider spend.**
- **Plans** (`lib/landing-config.ts:222–232`): Free $0/50 · **Pro $19/1 000** · **Studio $59/6 000**.
- **Credit packs** (`platform/index.html:17851–17855`): **500 = $5 · 1 500 = $12 · 5 000 = $35**.
- **Contributor payout** (`lib/earnings.ts`): `PAYOUT_MODE = "pool"` (default),
  `CONTRIBUTOR_POOL_SHARE = 0.50` → **pool = (net subscription revenue − AI provider spend) × 50 %**,
  split by each contributor's share of legitimate downloads.

## 🔴 Finding 1 — Every channel except Pro sells credits at or below cost

Revenue per credit vs the $0.0095 it costs to serve:

| Channel | Price | $ / credit | **Effective margin** | Verdict |
|---|---|---|---|---|
| **Pro** | $19 / 1 000 | **$0.0190** | **2.00×** | ✅ as designed |
| **Studio** | $59 / 6 000 | **$0.0098** | **1.03×** | ⚠️ **zero profit** |
| Pack 500 | $5 | **$0.0100** | 1.05× | ⚠️ ~zero profit |
| **Pack 1 500** | $12 | **$0.0080** | **0.84×** | 🔴 **LOSS** |
| **Pack 5 000** | $35 | **$0.0070** | **0.74×** | 🔴 **LOSS** |

**And this is BEFORE the Lemon Squeezy MoR fee (~5 % + $0.50).** After it:

| Channel | Net revenue | $ / credit (net) | Margin | Loss if fully spent |
|---|---|---|---|---|
| Pro $19 | ~$17.55 | $0.0176 | 1.85× | — |
| **Studio $59** | ~$55.55 | $0.0093 | **0.97×** | 🔴 **−$1 per cycle** |
| **Pack 5 000 $35** | ~$32.75 | $0.0066 | **0.69×** | 🔴 **≈ −$15 per pack** |

**A user who buys the $35 pack and spends it all costs the owner ~$47 in provider bills.**
The biggest, most attractive pack is the **most loss-making** one. The "save 20 %" label on the
$12 pack is literally a discount into a loss.

> Why it has not exploded yet: **breakage** — most users never spend all their credits. The
> business is currently profitable *because customers under-use it*. That is not a strategy; it is
> a bet against your own product succeeding.

## 🔴 Finding 2 — The $19 is being asked to pay for THREE things, but was priced for one

The anchor was set as `$19 ÷ 1 000 credits`, i.e. **100 % of the subscription price is allocated to
AI credits**. But that same $19 must also fund:

1. **AI provider spend** — $9.50 if fully used (at 2×);
2. **Contributor payouts** — `(net revenue − AI spend) × 50 %`;
3. **Infrastructure** — Cloud Run, Neon, **storage and egress** (see Finding 3);
4. the owner's actual profit.

Worked example, Pro, fully used:
```
$19.00  price
−$1.45  Lemon Squeezy (MoR fee)          → $17.55 net
−$9.50  AI providers (1 000 × $0.0095)   → $8.05
−$4.03  contributor pool (50 % of $8.05) → $4.02 left
−  ???  infra + egress + failed-gen losses (P19) + support
```
**The owner's margin on a fully-engaged Pro user is ~$4 — before infrastructure.** On Studio and on
credit packs it is **negative**.

**Fix:** the credit anchor must be **revenue allocated to AI ÷ credits granted**, not
**price ÷ credits**. E.g. allocate 60 % of Pro to AI → anchor `$11.40 / 1 000 = $0.0114`; then
1 000 credits cost $5.70 to serve and the remaining $11.85 funds contributors, infra and profit.
Then **re-derive every model price** (the "Apply target margin" engine already does this — P25).
**MONEY ZONE: the owner decides the anchor and presses Apply. Nothing changes automatically.**

## 🔴 Finding 3 — Template downloads have a bandwidth cost that appears NOWHERE in the model

- Pro advertises **"All 10 000+ templates"** and Free allows 15 downloads/month.
- Packs are large — the bulk uploader's per-file cap is **3 GB** (P5.7), and the one real template
  in production is **110 MB**.
- **GCS egress is roughly $0.08–0.12 / GB.** A Pro user downloading 100 packs × 300 MB = **30 GB
  ≈ $2.40–3.60** — i.e. **most or all of the ~$4 that was left**.
- **Nothing in the pricing model accounts for this.** `ProviderSpend` tracks AI cost only; egress is
  invisible.
- The pool payout is computed on `(revenue − AI spend)` — **egress is not subtracted**, so
  contributors are paid out of money that will later be spent on bandwidth.

**Fix:** subtract infra/egress from the pool base, and add a downloads-per-month cap on Pro (even a
generous one — "unlimited" with 3 GB packs is an unbounded liability), or serve packs through a CDN
with cheaper egress (P7 #1 — the CDN also fixes this).

## 🔴 Finding 4 — Contributor self-dealing (the owner's exact question)

**What is already defended** (`lib/download-events.ts:80–95`):
- **Self-exclusion:** downloading your own template earns you nothing (`input.userId !== ev.contributorId`).
- **Dedup:** unique `(user, template, kind)` — the same user downloading the same template 500 times
  earns **one** event, not 500.
- **Email-verify gate:** `downloaderMayEarn()` — an unverified account cannot generate earnings.
- **Admins excluded.**

**What is NOT defended — the sybil attack the owner is describing:**
- A contributor creates **50 verified throwaway accounts** (same weakness as P23 GAP 2 — free email
  addresses are unlimited), and each downloads each of their 100 templates **once**.
  → 5 000 perfectly "legitimate" download events → a large share of the pool.
- In **pool mode** this does not cost the owner more money directly (the pool is a fixed share) —
  it **steals from the honest contributors**, which destroys the supply side. In `per_download` mode
  (`$0.10/download`, `earnings.ts:26`) it would cost the owner **$500 in cash**.

**Fixes:** device/IP/ASN clustering on download events · a payout hold period + manual review above a
threshold · flag contributors whose downloads come from accounts created within N days of each other
or that download *only* their templates · require a payment method / KYC before payout · keep
`PAYOUT_MODE = pool` (never enable `per_download` without these defences).

## Problems the owner has not thought of (director-raised)

- **P26.1 — Credits are granted monthly; are they capped or do they roll over?** If unused credits
  accumulate, a user can bank 12 months of credits and then spend them **all at once** — at which
  point the loss-making pricing above becomes a real, simultaneous bill. Verify `resetMonthIfNeeded`
  (`plugin-profile.ts:160`): a **reset** (expiring) is safe; a **top-up** (rolling) is a liability.
  **This determines whether the breakage assumption above holds at all.**
- **P26.2 — Purchased (top-up) credits must not expire, plan credits should.** Mixing them in one
  `aiCredits` integer means you cannot tell them apart — and the chargeback clawback
  (`lemonsqueezy.ts:129`) can only claw back "unspent top-up credits", which is undecidable if the
  two are pooled. **Verify: are they tracked separately? If not, that is a real accounting bug.**
- **P26.3 — Studio's "5 seats" is priced as one account.** $59 / 6 000 credits shared by 5 people =
  the worst margin in the table, used by the heaviest users. Either raise the price, lower the
  credits, or price per seat.
- **P26.4 — "Priority generation" / "Priority render queue" are sold but not implemented.** There is
  no priority queue in `gen-processor.ts`. Same class of problem as the missing watermark (P23 GAP 1):
  **paid features that do not exist.** Either build them or remove them from the pricing page.
- **P26.5 — "API access" (Studio) does not exist.** There is no public API. Same issue.
- **P26.6 — Free plan cost is real:** 50 credits × $0.0095 = **$0.475/month of provider spend per
  free account**, plus storage. With the sybil weakness (P23 GAP 2) this is a direct, unbounded
  drain. Consider: fewer free credits, or credits that require email verification + one-time
  verification.
- **P26.7 — The pool can go NEGATIVE.** `pool = (net revenue − AI spend) × 0.5`. In a month where AI
  spend exceeds subscription revenue (entirely possible given Findings 1–3), the pool is ≤ 0 and
  **contributors earn nothing that month**. There is no floor. That is a supply-side death spiral —
  the contributors leave exactly when you need content most. Decide a minimum guaranteed pool.
- **P26.8 — Nothing tells the owner any of this in real time.** There is no dashboard showing
  *revenue − AI spend − payouts − infra = profit*, per month, per plan, per channel. `model-margin.ts`
  and `pricing-reconcile.ts` compute pieces of it. **Assemble them into one Admin screen** —
  otherwise the next pricing decision will be made the same way this one was: by guessing.

## What to do (director's recommendation, in order)

1. **Do P24 first** (measure the real provider cost). Every number above depends on the $0.0095
   assumption, which is itself derived from *estimated* provider prices. **If the estimates are low,
   the losses are worse than this table says.**
2. **Immediately re-price the credit packs and Studio** so that `$/credit ≥ anchor` — or accept a
   deliberate, quantified loss-leader. **The $35 pack as it stands is a machine for losing money.**
3. **Re-anchor the credit value** (Finding 2) so the subscription funds AI + contributors + infra,
   not AI alone.
4. **Subtract infra/egress from the pool base** and cap Pro downloads (Finding 3).
5. **Ship the sybil defences** before enabling payouts (Finding 4) — payouts are not live yet, which
   is the only reason this has not cost money already.
6. **Build the profit dashboard** (P26.8) — one screen, updated monthly, that answers "am I making
   money?" without a spreadsheet.

**MONEY ZONE:** every number here is a **decision for the owner**. Code may compute, propose, and
alert — it must **never** change a price, a credit value, a margin, or a payout rate on its own.

---


# P27 — OWNER'S PRICING DECISIONS (binding) — stop selling below cost

> These are **decisions**, not analysis. The analysis is P26; the measurement is P24.
> Approved by the owner on **2026-07-12**. Implement exactly as written.
> ⚠️ **MONEY ZONE:** these change *product prices and grants*. They do **NOT** change
> `computeGenCost`, `imageUnitCost`, the signed cost-quote / HMAC, or the consume/refund path.
> If any of these edits appears to require touching those → **STOP and flag.**

## D1 — Credit packs: keep the price, cut the credits ✅ APPROVED

`packages/assetflow-studio/platform/index.html:17851–17855` (`creditPacks`) — and the matching
**Lemon Squeezy variants must be updated to the same numbers** (`findCreditVariant` maps by credit
amount, `lib/lemonsqueezy.ts:187`), or checkout will break.

| Now (loss-making) | → | **New** | $/credit |
|---|---|---|---|
| $5 → 500 | → | **$5 → 250** | $0.020 ✅ |
| $12 → 1 500 ("save 20 %") | → | **$12 → 600** | $0.020 ✅ |
| $35 → 5 000 | → | **$35 → 1 800** | $0.019 ✅ |

Remove the misleading **"save 20 %"** label (a pack must never be cheaper per credit than the
subscription — that inversion is what caused the loss). Update the copy in **both** the pricing page
and the Account → Credits panel (`creditPacksAcc`).

## D2 — Studio plan: $59 → **3 000 credits** (was 6 000) ✅ APPROVED

`lib/landing-config.ts:232`. Restores a ~2× margin on the heaviest-usage plan.
Update the landing copy, the plan config, and the Lemon Squeezy variant.
Also update the **credit allotment** granted on subscription (`plugin-profile.ts` — the plan →
credits mapping), or the page and the grant will disagree.

## D3 — Contributor pool: **30 %**, and infra/egress comes out of the base first ✅ APPROVED

`lib/earnings.ts:50` → `contributorPoolShare()` default **0.50 → 0.30**
(`CONTRIBUTOR_POOL_SHARE` env stays the override).

And the pool **base** changes (`earnings.ts:117–125`):

```
OLD:  pool = (net subscription revenue − AI provider spend)          × 0.50
NEW:  pool = (net subscription revenue − AI provider spend − INFRA)  × 0.30
```

`INFRA` = storage + **egress** + compute for the period. Today egress is **not tracked at all**
(P26 Finding 3) — so this needs an infra-cost input (start with a monthly admin-entered figure, in
the same place as `ProviderInvoice`; automate later alongside P24's GCP billing export).
**Reason:** today contributors are paid out of money that is later spent on bandwidth.

⚠️ `PAYOUT_MODE` stays **`pool`**. Do **not** enable `per_download` (P26 Finding 4).
⚠️ Payouts are **not live** — do not enable them until the sybil defences ship.

## D4 — Remove features that are sold but do not exist ✅ APPROVED ("they aren't needed at all — remove them")

From the pricing page / plan config (`lib/landing-config.ts:227–237`) **delete**:
- **"Priority generation"** (Pro) — there is no priority queue in `gen-processor.ts`.
- **"API access"** (Studio) — there is no public API.
- **"Priority render queue"** (Studio) — same as above.

Also remove any other copy referencing them (FAQ, landing sections, plugin). Do **not** stub them —
the owner's decision is that they are not needed. Everything else on the plans stays.

**Kept, but it MUST be built:** **"Watermarked export"** (Free) / **"4K, watermark-free downloads"**
(Pro). This is the only real Free↔Pro differentiator and it **does not exist in the code**
(P23 GAP 1). Do not delete this line — **implement the watermark** (see P4 for the ffmpeg pipeline).

## D5 — Credit expiry (verify + implement)

- **Plan credits EXPIRE monthly** (reset, not accumulate) — otherwise a user can bank 12 months and
  spend them at once, landing the whole loss in one bill (P26.1).
- **Purchased (top-up) credits do NOT expire**, and must be **tracked separately** from plan credits
  — the chargeback clawback (`lemonsqueezy.ts:129`) already claims to claw back *unspent top-up*
  credits, which is undecidable if both live in one `aiCredits` integer (P26.2).
- **Verify `resetMonthIfNeeded` (`plugin-profile.ts:160`) first and report** what it does today
  before changing anything. **Money zone — additive tracking only.**

## D6 — Order of execution (do not reorder)

```
1. P24  — measure the REAL provider cost      (every number above depends on it)
2. D1–D2 — re-price packs + Studio             (stops the bleeding)
3. D4   — remove non-existent features         (10 minutes, removes legal risk)
4. P4/P23-GAP1 — build the watermark           (makes Pro worth buying)
5. D3 + D5 — pool base + credit expiry
6. Sybil defences → only then enable payouts
7. P26.8 — the profit dashboard                (revenue − AI − payouts − infra = profit)
8. Then: content ingest and launch
```

**Acceptance:** after D1–D2, **no channel sells a credit below `creditUsdValue ÷ marginTarget`**.
Add a startup assertion that fails loudly if any plan or pack violates this — so it can never
regress silently again.

---


# P25 — Admin → "Apply target margin": the owner cannot set a margin below 2× (e.g. 1.5×)

## Owner's report

The **Apply target margin** control will not let him enter anything below **2** — he wants to set
an arbitrary value, e.g. **1.5×**.

## Director's code analysis

**The server is fine.** `apps/api/src/routes/admin.ts:542`, `:572` →
`marginTarget: z.number().gt(0).max(1000)` — any positive number is accepted. **1.5 would work.**

**The client is the problem.** `packages/assetflow-studio/js/admin-business.js:44–48`:

```js
async function applyMarginAll(){
  const cur = PRICING_DATA ? PRICING_DATA.marginTarget : 2;
  const raw = prompt('Target margin (×) …', String(cur >= 2 ? cur : 2));   // ← forces the prefill to ≥ 2
  const mt = Number(raw);
  if(!(mt>0)){ toast('Error','Enter a positive margin (e.g. 2)','danger'); return; }
```

1. **`cur >= 2 ? cur : 2`** — the value shown is **clamped up to 2** even when the stored margin is
   lower (the comment admits it: *"default 2.0×, even if the DB is still 1.8"*). It reads like a
   minimum. It is not one — it is just a prefill — but the owner cannot tell, and that is a bug in
   itself.
2. **It is a raw browser `prompt()`** — no number input, no step, no decimal hint, no preview.
3. **`Number("1,5")` → `NaN`** → *"Enter a positive margin"*. On a keyboard/locale where the
   decimal separator is a **comma**, entering `1,5` is rejected with a message that explains
   nothing. **This is very likely what the owner actually hit.**

## What to build

1. **Replace the `prompt()` with a real modal** in the Admin pricing panel:
   - a proper number input (`step="0.1"`, sensible bounds), prefilled with the **actual current
     margin** — never clamped up;
   - accept both `1.5` and `1,5` (normalize the comma before `Number()`);
   - inline validation with a useful message.
2. **Show a live preview before applying.** The modal lists what the new price of each enabled
   model would become: `Seedance 2.0 · 48 → 36 credits`, `Nano Banana Lite · 2 → 2` … plus the
   count of pinned models that will be skipped. The owner presses **Apply** on a table, not on
   faith. Prices can go **down** as well as up (the current prompt text says so — nobody reads it).
3. **Warn, do not block, below 1.0×.** A margin below `1.0` means **selling below provider cost**.
   Allow it (the owner may want a loss-leader), but require an explicit confirmation:
   *"At 0.8× you will LOSE money on every generation. Continue?"*
4. **Show the resulting margin per model afterwards** (ties into P24's Admin pricing table):
   red if the model ends up under water.

## Hidden problems

- **P25.1 — 🔴 The margin is only as good as the provider cost (P24).** Setting 1.5× on a provider
  cost that is a **guess** does not give a 1.5× margin — it gives an unknown one. **P24 (measure
  the real cost) must land before the owner tunes the margin down**, or he will lower prices onto
  numbers that were already wrong. *A lower margin on a wrong cost is exactly how Seedance 4K ended
  up being sold at a loss.*
- **P25.2 — Money zone.** `applyMarginAll` **writes real credit prices for every enabled model**.
  The formula (`ceil(provider cost × margin ÷ credit value)`) and the pinned-model skip logic must
  not change — this prompt only fixes the **input UI and the preview**. Do not touch
  `computeGenCost`, `imageUnitCost`, the quote HMAC, or the consume/refund path. If a change seems
  to require it → **STOP and flag.**
- **P25.3 — Pinned models are silently skipped.** The toast mentions them after the fact. The
  preview (#2) must show them **before**, with the reason ("product-priced — not derived from
  margin"), or the owner will think the margin was applied everywhere when it was not.
- **P25.4 — There is no undo.** Applying a margin rewrites every enabled model's price at once. Add
  an audit entry (the audit log already exists) and, ideally, a "revert to previous prices" action —
  a mistyped margin currently has no way back except retyping the old one.

---


# P23 — MONEY & ABUSE AUDIT: how a user can steal credits, assets or Pro access (and what is already safe)

## Owner's request

"Find every way a user could cheat me: get credits without paying, force a fake error to get a
refund, top up with fake credits, break in without paying, steal credits or AI, download Pro
templates on a Free account — and find the ones I haven't thought of."

## ✅ ALREADY SAFE — verified in code. **Do NOT 'improve' these; they are money-zone.**

| Attack | Why it fails |
|---|---|
| **Forge the price** (send `price: 1` for a 344-credit video) | The quote is a **signed JWT** (`lib/gen-quote.ts:67`) over `{modelId, mode, price, paramsHash}`, 15-min TTL; `POST /gen` recomputes `genParamsHash` and calls `verifyCostQuote` **before** consuming (`studio-gen.ts:1199–1204`) → `BAD_QUOTE`. |
| **Delete the generation to get a refund** | `DELETE /gen/:jobId` (`:1578`) deletes assets — it **never refunds**. |
| **Double refund** | `refundAiCredits` claims atomically (`refunded=false→true`); `fail()` / reconcile use guarded `updateMany` (`gen-processor.ts:1000`, `:1332`). |
| **Refund *and* keep the asset** | `status:"done"` is written with `where: { status: "running" }` (`:1302`) — after a refund the job is `failed`, so `count = 0` and the asset is never shown. The fal webhook ignores terminal jobs (`fal-webhook.ts:156`). |
| **Free user downloads a Pro template** | `guardDownloadable()` (`plugin.ts:318–362`) — server-side, **before any bytes**: published check → `isPro && !isPaidPlan(profile.plan)` → **402 PRO_REQUIRED** → then an **atomic** `consumeDownload()` limit (Free = 15/mo). Both `/pack` and `/mogrt/:slug` go through it. Packs are served only as **5-minute signed URLs**, never public CDN links. |
| **Fake a top-up / replay the payment webhook** | Lemon Squeezy webhook: **HMAC signature verified** (`lemonsqueezy.ts:344–346`) + **claim-first idempotency** + unique `sourceKey`. |
| **Buy credits, then charge back** | `handleOrderRefunded` (`:127–139`): negative `RevenueEvent`, **claws back unspent top-up credits**, downgrades the subscription to FREE. |
| **Blow up the owner's provider bill** | Per-user **daily gen cap** (`withinGenDailyCap`), **global spend ceiling** (`checkGlobalSpendCeiling`), **kill switch** (`isGenKillSwitchOn`) — all checked before credits are consumed. |
| **Brute-force login / spam register** | `authLimiter` / `forgotLimiter` / `twofaLimiter` (`auth.ts:71–87`) + **Turnstile** on register (`:118`). |
| **Upload a malicious pack** | Malware scan is **fail-closed** — an unscanned/pending pack is served to **nobody, not even an admin** (`plugin.ts:318–325`). |

**Conclusion: the obvious attacks are closed.** The real holes are elsewhere.

## 🔴 GAP 1 — THE WATERMARK DOES NOT EXIST. Free users get clean exports today.

- The Free plan **advertises** "Watermarked export" (`lib/landing-config.ts:223`, `:224`) and the
  FAQ says Pro unlocks "**watermark-free** 4K export" (`:192`).
- **There is no watermark code in the API at all.** A repo-wide grep for `watermark` in
  `apps/api/src` returns **nothing** outside that marketing copy.
- → A Free user generates and downloads a **clean, unwatermarked** asset. The single most
  important thing separating Free from Pro **is not implemented**.
- This is simultaneously: **a revenue hole** (why pay for Pro?) and **false advertising** (you are
  charging for the removal of something you never add).

**Fix:** implement the export watermark server-side (never in the client — a client-side
watermark is trivially bypassed), applied on download/export for FREE plans, using the same
ffmpeg pipeline as P4. Then Free/Pro finally means something. **Decide with the owner:** does the
watermark apply to AI generations, template exports, or both? (P4 covers stock previews — this is
a different surface: the user's *own* paid-for output.)

## 🔴 GAP 2 — Free-credit farming with disposable accounts

- Every account gets **50 credits/month** (`landing-config.ts:223`), reset by
  `resetMonthIfNeeded` (`plugin-profile.ts:160`).
- Register is protected by **Turnstile** and creates the user with `emailVerified: false`
  (`auth.ts:177`).
- ⚠️ **VERIFY FIRST:** does `POST /gen` (or `requireAuth`) refuse an **unverified** account?
  `emailVerified` is checked at `auth.ts:514` but **not** in `middleware/auth.ts` and **not** in
  `studio-gen.ts`. **If an unverified account can generate, the farm is: script → 100 throwaway
  emails → 5 000 free credits.** Confirm and report before changing anything.
- Even with verification, 10 Gmail aliases = 500 credits/month.

**Fixes (choose with the owner):** require `emailVerified` before **any** credit spend ·
block disposable-email domains · rate-limit registrations per IP/ASN/device fingerprint ·
lower the free monthly grant · require a card (via LS) for anything above a small trial ·
alert on N accounts from one IP.

## 🔴 GAP 3 — Session security: a 30-day token in `localStorage`, with no way to revoke it

- `createToken` (`middleware/auth.ts:29`) → `jwt.sign(..., { expiresIn: "30d" })`.
- The web app stores it in **`localStorage`** (`ff-api.js:15`, `getToken`).
- The CSP **must keep `'unsafe-inline'`** (documented in `prepare-cf-pages.mjs`) because the UI
  relies on 168+ inline handlers → **an XSS anywhere = the attacker reads `localStorage` and owns
  the account (and its credits) for 30 days.**
- **There is no refresh token, no revocation list, no "sign out of all devices"**, and (verify)
  probably no invalidation on password change. A leaked token cannot be killed except by rotating
  `JWT_SECRET`, which logs out **everyone**.
- The **plugin** stores the token in **plaintext** on disk (`prefs.json` under the CEP extension
  folder) — anyone with file access to the machine has the account.

**Fixes:** shorter access token + refresh token · a server-side session/`tokenVersion` column so
password change / "log out everywhere" invalidates existing tokens · consider `httpOnly` cookies
for the web (removes the XSS-steals-the-token class entirely) · at minimum, add revocation.

## Other gaps (ordered by likelihood of costing money)

- **P23.1 — Refund-farming through moderation** (see P19.2). Output moderation refunds the user
  while the provider has **already been paid** → a user can burn the owner's money at zero cost to
  themselves. Cap moderation-blocked generations per user; after N, stop refunding / suspend.
- **P23.2 — The double-charge (P18) is the mirror image.** Not the user cheating the owner — the
  owner cheating the user by accident. It becomes customer-visible the moment P21 ships.
- **P23.3 — The global spend ceiling is a DoS vector.** One user (or a farm from GAP 2) can
  exhaust `checkGlobalSpendCeiling` and every other user gets `503 SPEND_CEILING_REACHED`. Add a
  **per-user** share of the ceiling so one account cannot deny service to all.
- **P23.4 — Pro-only MODELS: verify the server-side gate.** `POST /gen` checks
  `isModelEnabled(model)` (`studio-gen.ts:1026`) but **does it check the user's plan?** Templates
  have a Pro gate; models may not. If a Free user can call a Pro-tier model by sending its
  `modelId` directly (the quote endpoint will happily sign it), that is a paid feature given away.
  **Verify and, if missing, gate it exactly like `guardDownloadable` does.**
- **P23.5 — Account sharing.** One Pro subscription used by a whole studio. `device.html` +
  `device-confirm` exist — verify whether there is an actual **device/session limit** per plan, or
  just a confirmation screen. Without a limit, Pro is a group purchase.
- **P23.6 — Storage abuse.** `ref-upload` accepts up to **150 MB** bodies
  (`index.ts:169`). `getUserUsedBytes` exists (a quota is computed) — **verify it is actually
  enforced for FREE users**, or free accounts become free cloud storage.
- **P23.7 — Chargeback after spending.** The clawback only recovers **unspent** credits. A
  fraudster buys 5 000 credits, spends them all, then disputes the charge → the owner eats the
  full provider cost. Lemon Squeezy is the Merchant of Record (it absorbs much of the card fraud
  risk), but the **provider spend is already gone**. Mitigate: hold new-account top-ups behind a
  small velocity limit (e.g. a first-purchase spend cap for 24 h), and suspend the account on a
  dispute event.
- **P23.8 — Contributor payout fraud.** A contributor can inflate their own downloads (self-
  downloads / bot accounts) to farm payouts. `recordTemplateDownloadEvent` dedups per
  `(user, template, kind)` — verify **self-downloads are excluded** and add a per-IP/account
  anomaly check before any payout runs. (Payout is not live yet — fix it before it is.)
- **P23.9 — Preview quality as a paywall bypass.** Once stock ships (P4), if the watermarked
  preview is high-resolution, users will simply screen-record it. Keep previews deliberately
  lower-resolution — the resolution, not the logo, is the real protection.

## Rules for whoever implements this

- **Every fix here is READ-ONLY with respect to credit math.** Adding gates, caps, verification,
  revocation and watermarking is allowed. Changing any credit value, `computeGenCost`,
  `imageUnitCost`, the quote HMAC, or the consume/refund logic is **NOT**. If a fix seems to need
  it → **STOP and flag.**
- **Start by VERIFYING the three items marked "verify"** (unverified-email generation · Pro-model
  gate · Free storage quota) and **report the findings before writing any code.** Two of them may
  already be safe; one of them is probably not.

---


# P4 — Stock previews must be WATERMARKED; only a paying user gets the clean original

## Owner's report

Like Envato: the **preview** of a stock video / image carries a visible FrameFlow watermark.
The **original, clean file** is delivered only when a subscribed user downloads it.
Audio previews get an **audible watermark tag** (Envato/Artlist style).

**Owner decisions (2026-07-12):**

- Watermark scope: **Stock (Graphics + Motion Graphics)** and **AI Stock (P3)**.
  *Video Templates preview videos are NOT watermarked* (owner's choice — their preview is a
  render, not the product).
- Audio (Music / Sound Effects): **audible tag** on the preview — a low, periodic
  "FrameFlow" voice/sting every ~10–15 s. The downloadable original is clean.

## Director's code analysis — the architecture already fits (use it, don't invent)

- **Originals are already auth-gated.** `apps/api/src/routes/plugin.ts:400` — the `pack` route
  runs `requireAuth` + `downloadLimiter`, and `serve-asset.ts` hands out a **5-minute signed
  URL** for packs specifically so the link cannot be reshared.
- **`thumb` / `preview` are deliberately PUBLIC** (`plugin.ts:409` — `img`/`video` tags cannot
  send an auth header). This is exactly the split we need:
  → **`preview` and `thumb` = the WATERMARKED derivative. `pack` = the clean original.**
- **ffmpeg is available in production** — `Dockerfile:9` installs it. There is already a
  preview pipeline (`lib/transcode-preview.ts`, `lib/optimize-preview.ts`) with a **global
  ffmpeg concurrency semaphore** (`FFMPEG_MAX_CONCURRENCY`, default 1) and a
  background-processing helper (`transcodePreviewInBackground`). **Watermarking must go
  through that same semaphore and the same background path** — never on the HTTP request.

## What must be built

1. **At ingest (P1.12 — metadata/derivatives are produced at ingest, not at approval):**
   for every Stock and AI Stock asset, generate the watermarked derivative and store it as the
   `preview` (video/audio) and `thumb` (image) object. The clean file is stored as the `pack`.
2. **Video** (Motion Graphics): ffmpeg overlay of a semi-transparent FrameFlow mark — centered
   or tiled, ~10–20 % opacity — plus a preview-grade downscale/bitrate cap (e.g. 1080p, capped
   CRF) so the preview is not a usable substitute for the product.
3. **Image** (Graphics): same overlay via ffmpeg (no new image library needed).
4. **Audio** (Music / SFX): mix a short branded sting/voice tag over the preview every
   ~10–15 s (ffmpeg `amix`/`adelay`). Keep the preview at a reduced bitrate. The original stays
   clean.
5. **The watermark asset itself** (a transparent PNG + the audio sting) must be committed to
   the repo and referenced from one place — not regenerated per call.
6. **Backfill**: existing published rows must get watermarked derivatives too (a one-off
   script). Today there is one published template, so this is cheap — but write the script,
   because AI Stock will arrive in volume.

## Hidden problems (these are where this silently fails)

- **P4.1 — 🔴 If the raw stock file is used AS the preview, the original leaks publicly.** In
  the new raw-file ingest (P1.9) the natural shortcut is "the uploaded .mp4 is both the pack
  and the preview". That would publish the clean original at a public URL and **the watermark
  becomes theatre**. The pack object and the preview object must be **two distinct keys**, and
  the preview key must never be a copy of the original. State this explicitly in the ingest
  code with a comment.
- **P4.2 — 🔴 P2's `og:image` must use the WATERMARKED thumb.** The link-preview work (P2)
  points `og:image` at the asset thumbnail. If that thumb is the clean original, every shared
  link hands out an unwatermarked full asset to anyone. Cross-check when both land.
- **P4.3 — The plugin browses previews too.** The AE plugin's catalog shows `preview`/`thumb`
  from the same endpoints — so it will show the watermarked version automatically (correct).
  But **plugin IMPORT must pull the `pack`** (clean, auth-gated), not the preview. Verify:
  `plugins/after-effects-cep/assetflow-catalog.js` — if any import path ever falls back to the
  preview URL, the user gets a watermarked asset in their timeline. That is a shipping-level
  bug; check it explicitly.
- **P4.4 — Free plan vs. Pro.** "Only a subscriber gets the original" must be reconciled with
  the existing gate: assets have a `pro` flag and Free users may download Free assets today
  (`isFreePlan` + `dRaw.pro` — the inline Pro gate shipped in BATCH6 Prompt #3). **Do not
  invent a new paywall.** Clarify with the owner if the rule is now "clean original = paid
  plans only, regardless of the Free/Pro flag on the asset" — that would change the Free tier's
  meaning. Until confirmed: preview is watermarked for everyone; **download follows the
  existing plan gate unchanged.** Do NOT touch credit/plan logic (money zone).
- **P4.5 — ffmpeg throughput.** `FFMPEG_MAX_CONCURRENCY` defaults to **1**. A contributor
  dropping 10 × 4K/30 s clips means ten serialized transcodes — minutes of work. It MUST run in
  the background (the ingest HTTP response returns immediately, the item shows
  `processing → ready`), and Cloud Run's request timeout must not be the limiter. Also budget
  the cost: watermarking is CPU-heavy and Cloud Run bills CPU-seconds.
- **P4.6 — Storage doubles.** Every stock asset now stores original + watermarked preview
  (+ thumb). Factor it into the GCS lifecycle rules.
- **P4.7 — A watermark is not DRM.** Anyone can screen-record the preview. Keep the preview
  deliberately lower-resolution/bitrate — that, not the logo, is the real protection.

---


# P5 — DIRECTOR-RAISED: gaps in the chain the owner has not reported yet

Not reported by the owner — found by auditing the full chain
(*upload → moderation → catalog → download → plugin*) against the P1–P4 plan. Each of these
**breaks a P1–P4 feature once real volume arrives**. They are listed in the order they will
hurt.

- **P5.1 — 🔴 The web catalog filters CLIENT-SIDE over a paginated API. With volume it will
  show wrong results.** `GET /api/plugin/catalog` (`apps/api/src/routes/plugin.ts:180`) is
  **cursor-paginated** (`take` + `nextCursor`). The platform holds `this.state.catalog` and
  filters/sorts/searches it **in the browser** (`platform/index.html:19772`). Today that is
  invisible — there is **one** published asset. The moment the catalog holds hundreds of stock
  items, "LUTs" or a search will only match **within the first page**, and the user sees an
  almost-empty category with no way to know why. **Filtering, search, sorting and the type
  pills must move SERVER-SIDE** (`kind`, `templateType`, `stockType`, `cat`, `app`, `pro`,
  `orient`, `res`, `q`, plus proper pagination / infinite scroll). This is the single biggest
  architectural debt in the P1–P4 plan and it must land **before** bulk stock ingest, not
  after — otherwise the catalog silently lies.

- **P5.2 — 🔴 The AE plugin cannot import the new asset kinds.** `plugins/after-effects-cep/
  jsx/*.jsx` branches on the extension (`if (ext === "aep")`, `.mogrt` path). A stock **.mp4 /
  .wav / .png / .cube** has no import behaviour — the Browse panel will list assets it cannot
  place. Required: import raw media into the project/comp (`app.project.importFile` +
  place into the active comp), audio onto an audio layer, LUT via a Lumetri/color preset (or,
  if that is not feasible in AE, **hide LUTs from the plugin** rather than shipping a dead
  button). Decide per kind; a listed-but-unimportable asset is a bug report waiting to happen.

- **P5.3 — Semantic search will not see the new assets.** `lib/ai/embed-templates.ts` embeds
  templates for `/api/plugin/ai/search`. Stock, LUTs and AI Stock rows must be embedded too
  (the AI-written description + tags from P1 are exactly the text to embed), and the backfill
  must be run once. Otherwise the plugin's AI search finds only templates and the owner
  concludes "search is broken".

- **P5.4 — The moderation queue does not scale to bulk stock.** Bulk approve exists
  (`admin-views.js` `bulkAction()`), but the queue is template-shaped: no filter by
  contributor / category / kind, no audio player, no video scrubbing, and the metadata editor
  is the contributor's template wizard (P1.7). Reviewing 200 raw clips in that UI is not
  possible. Needs: queue filters, an inline preview player, "select all in this category",
  and a per-kind metadata editor. **Direct consequence of P1 — the owner's own step 5.**

- **P5.5 — Downloads, plan limits and contributor earnings now apply to stock.** Every stock
  item becomes downloadable, counts against the Free/Pro download limits, and generates a
  contributor earning (`lib/earnings.ts`, `recordTemplateDownloadEvent`). Questions the owner
  must answer before launch: does a stock download consume the same monthly quota as a
  template? Does the contributor earn the same per download (a 3-second SFX vs a full AE
  project)? **Money zone — plan it, do not improvise it in a fix prompt.**

- **P5.6 — Content theft is not detectable.** Dedup is `packHash` (byte-identical only) and the
  malware scan is a hash lookup — a contributor can re-upload stolen Envato/Artgrid footage and
  nothing stops it. The owner's own reference screenshot in this file is a watermarked Envato
  frame, which is exactly the material that will be uploaded. Minimum viable: a perceptual hash
  (pHash) on the first frame / image, checked against the existing library, plus a
  visible-watermark detector on submission ("this file appears to carry another vendor's
  watermark → reject"). At least log it for the admin.

- **P5.7 — The upload limit is per file, and 3 GB is generous.** Raw 4K stock at 3 GB × many
  files × many contributors → GCS bill and Cloud Run egress. Set a **per-kind** size ceiling
  (a .wav SFX does not need 3 GB) and a per-contributor daily volume cap. The `incoming/`
  bucket already has a 7-day lifecycle in the env checklist — verify it is actually applied.

- **P5.8 — The store is still empty (standing blocker).** One published asset; the landing says
  "5000+". P1–P4 build the shelves; they do not put anything on them. **P3 (AI Stock) is the
  fastest way to fill the catalog** — it needs no contributors at all. Worth sequencing first
  for that reason alone.

---



---

# CLOSING — PART 1

**When every step above is done:** the server is in one region, the CDN is on, the catalog is
server-filtered, the double-charge is fixed, the provider costs are MEASURED, no channel sells
below cost, and the watermark exists.

**Only then open `MUAMMOLAR-2-MAHSULOT.md`.**

Three things that break this plan if ignored:
1. **Order.** Steps 2–4 unblock 15–17. Step 9 unblocks 10–11. Do not reorder.
2. **The plugin.** Any step marked `PLUGIN` that was only done on the web is **not done**.
3. **The money zone.** Gates, caps, idempotency, tracking, watermarks: allowed.
   `computeGenCost` / `imageUnitCost` / the quote HMAC / consume / refund: **frozen.**
