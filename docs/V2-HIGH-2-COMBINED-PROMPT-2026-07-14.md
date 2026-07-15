# V2 HIGH-2 — COMBINED (boot tezligi + server barqarorlik) — 2026-07-14

> HIGH blokining IKKINCHI to'plami: P5 → P11 → P27 → P32. Boot/render va server barqarorlik
> atrofida. Ega ishtiroki SHART EMAS (jonli AE/Windows testlari alohida to'plamda).
> Model: **Fable 5 (Medium)** (P27/P32 pul-tutash — monthStart, limiter). Kvota kam → Opus 4.8.
>
> To'liq diagnoz: P5/P11 → `docs/MUAMMOLAR V2-2026-07-13.md`; P27/P32 →
> `docs/DIREKTOR-AUDIT-V2-2026-07-14.md`.

---

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). FOUR fixes in ONE session, order A→D.
COMMIT AFTER EACH SECTION ("V2-HIGH2 <letter>: <short>", no Co-Authored-By; do NOT push). If
a section conflicts/balloons, SKIP it, note why, continue. Sections are INDEPENDENT (no
ordering dependency), but A and B touch the same client shells so do them in order.

SOURCES OF TRUTH
- Studio SPAs: edit ROOT packages/assetflow-studio/js + admin/contributor shells, then
  `npm run studio:sync` ONCE at end. Web platform: platform/index.html DIRECT.
- Server: apps/api/src/** — build check `npm run build -w apps/api`.
- Plugin: plugins/after-effects-cep/ (no internet assets; install-cep.sh; node --check).

🔴 MONEY ZONE — do NOT change credit consume/refund, cost-quote/HMAC, credit values,
consumeDownload limits. Section D touches monthStart() (a boundary CALCULATION, not a value)
and rate-limit (not money) — see the 🔴 note there. Migrations: NONE.

GLOBAL RULES
- English UI; Uzbek code comments. Minimal diffs. Do NOT loosen isPublicReadKey(). Do NOT
  reintroduce softenPromptForSafety. Do NOT renumber @N tokens.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → commit as own checkpoint
  first, then proceed. Report if found.
- PLUGIN PARITY: each section states its plugin verdict.

════════════════════════════════════════════════════════════════════════════════
SECTION A (P5) — every portal boots slowly: blank shell until 6+ serial API calls
════════════════════════════════════════════════════════════════════════════════
ROOT: admin/index.html:267 bootAdmin awaits StudioTemplates.init("admin") — which awaits
loadForAdmin→loadAdminContributors→loadPluginAnalytics→loadAuditLogs IN SERIES
(studio-templates.js:275) — then awaits listMessageThreads + listAdminUsers, and ONLY THEN
renderNav()+route(). 6+ serial round trips before first paint. loadForAdmin() also pages the
WHOLE catalog (listAllTemplatePages scope=all :107) at boot. contributor/index.html:175 same
serial pattern. refreshAfterReview (:301) re-runs 4 serial full loads after every decision.
FIX:
1. Paint first (admin + contributor boot): renderNav()+route(bootView) IMMEDIATELY before any
   network call. Views already tolerate empty TEMPLATES (skeletons: adxSkelList) — keep
   skeletons while empty. Then fire loads in PARALLEL via Promise.allSettled:
   admin: [templates(see 2), loadAdminContributors, loadPluginAnalytics, loadAuditLogs,
   listMessageThreads, listAdminUsers]; contributor: [loadForContributor, listMessageThreads].
   After the batch settles → renderNav() + one consolidated re-render of the CURRENT view
   (route(CURRENT,null,true)); plus an early re-render when the TEMPLATES load settles (the
   one the user waits for). Do NOT re-render per-promise.
2. Admin boot: replace full loadForAdmin() with loadModerationOnly() (studio-templates.js:135
   — pending queue only). Load full list LAZILY: the All-templates table + Soft/All moderation
   filters trigger loadForAdmin() on first entry (setModFilter already does for soft/all). Add
   a module flag _fullCatalogLoaded so repeated nav doesn't re-page; refreshAfterReview resets
   it. Verify in-memory search still works once loaded.
3. refreshAfterReview: Promise.allSettled instead of 4 serial awaits; default post-review =
   loadModerationOnly() + loadAdminContributors() (analytics/audit refresh only in their own
   views' afterRender). Keep syncRejectReasons().
4. PRESERVE: the ADMIN_REQUIRE_2FA sessionStorage gate + route("settings") redirect runs in
   the SYNCHRONOUS part BEFORE the deep-link decision (needs no API). Deep-link (location.hash)
   + popstate behaviour unchanged.
PLUGIN (P5.4/verify): AssetFlow_Plugin.html bootPlugin already paints Home before the catalog
await — VERIFY nothing before the first render() awaits the network (AssetFlow.init /
Local().init / hydrateBlobUrls must be local-only; move any network call after first paint),
refreshAccountFromApi/syncFavoritesFromServer stay non-blocking, catalog skeleton renders
immediately. Fix only violations; tiny diff. install-cep.sh.
VALIDATE (devtools Slow 3G): admin refresh → nav + skeletons <1s, data fills as responses
land; contributor same; approve/reject → fast, queue updates without a 4-call stall.
Deep-link /admin/#moderation refresh opens Moderation; 2FA gate still redirects when flag set.

════════════════════════════════════════════════════════════════════════════════
SECTION B (P11) — dashboard: "Trending" renders as ~9 stacked duplicates; identical shelves
════════════════════════════════════════════════════════════════════════════════
ROOT A (render bug): live #dashboard stacks ~9 copies of the whole "Trending" va-shwrap block
(evidence: one va-sharrow per stacked row). Source markup/CSS are correct single-row
(platform/index.html :16581-16608, CSS :15131-15134). Suspect the sc-if/sc-for template
runtime APPENDS instead of REPLACING when a conditional re-evaluates (hasTrend/shelvesLoading
flip during boot skeleton→shelves, plus focus-refetch loadCatalog).
ROOT B (data): catalog has ~4-5 assets, some approved multiple times → Recommended/Trending/
Category/New are four identical rows.
FIX:
1. Reproduce: load #dashboard with a real/seeded catalog; force re-renders (toggle
   catalogReady, call loadCatalog twice, fire focus events). Count .va-shwrap under Trending.
2. Fix the sc-if/sc-for RECONCILIATION (replace, don't append) — search the inline runtime for
   how conditional placeholders reconcile children; make the fix GENERIC (it likely affects
   other sc-if blocks — Recommended :16554 too). If it does NOT reproduce from source, build/
   diff against the deployed bundle and state "already fixed, needs push" vs real bug. Do not
   guess.
3. Shelf UX (:21203-21220 slices): DEDUP each shelf by normalized (name + contributor) so
   re-uploaded copies appear once (keep newest). SMALL-CATALOG MODE: uniqueCount < 8 → render
   ONLY "Recommended for you" (≤8), HIDE Trending/Category/New. Uzbek comment on the threshold.
   Do NOT change the catalog API or browse grid.
PLUGIN: the plugin Home also renders shelves — same evidence test for block duplication on
re-render + same dedup/small-catalog collapse if it slices client-side. install-cep.sh.
VALIDATE: #dashboard with 4-5 items (some dup names) → ONE Recommended row, no Trending/New,
no stacked duplicates after 5 forced re-renders + 3 focus events. Seed >8 unique → all shelves
return, deduped, single va-shwrap each. Browse grid + detail related-row unaffected.

════════════════════════════════════════════════════════════════════════════════
SECTION C (P27) — provider fetches have NO timeout → a hung call locks the gen pool
════════════════════════════════════════════════════════════════════════════════
ROOT: gen-processor.ts genActive slot system (:1696-1723): .finally() frees the slot ONLY if
processGeneration returns/throws. Provider fetches with no AbortSignal (openrouter.ts:55,438,
449; elevenlabs.ts:32; vertex*.ts; google-tts.ts; workers-ai.ts) can hang forever → the
finally never runs → GEN_CONCURRENCY slots exhaust → the WHOLE gen queue stalls (fal/byteplus/
magnific already have timeouts).
FIX 1 — universal fetch timeout wrapper for provider calls:
Add a shared helper (e.g. lib/ai/fetch-timeout.ts): fetchWithTimeout(url, opts, ms=120000)
using AbortController — aborts after ms, throws a clear "provider timeout" error. Apply to
every provider fetch missing a signal: openrouter.ts (:55,:438,:449), elevenlabs.ts (:32),
vertex-enhance.ts / any vertex-*.ts, google-tts.ts, workers-ai.ts. Keep per-provider sensible
ms (poll endpoints shorter, generation submit longer — but ALWAYS bounded). Do NOT touch the
credit refund path — a timeout must flow through the EXISTING error→refund handling (verify
processGeneration's catch refunds on provider error, unchanged).
FIX 2 — slot-release safety net: in genRunNext, wrap processGeneration in a hard overall
timeout (e.g. max job wall-clock, generous — 15min) so a stuck job ALWAYS releases its slot
via finally even if a provider call somehow escapes FIX 1. Log + captureException on forced
release. Money: a force-released job must go through the same error/refund path, not silently
drop the debit.
FIX 3 — big-buffer / OOM paths (report + safe-fix cheap ones):
gen-processor.ts:103-163,429 buffers 4K video in memory + tmpfs — where a stream already
exists, prefer stream→tmp only; REPORT the ones that need bigger refactors (don't force).
index.ts:202-205 express.json 150mb: verify only the ref-upload/describe routes need large
bodies; if a smaller global + per-route override is trivial, apply; else report.
fal-webhook.ts:136-144 scans 500 video rows per webhook in memory → use an indexed
requestId→genId lookup (Prisma where on the stored provider request id). Report if the id
isn't stored (needs a follow-up).
PLUGIN: server-only — plugin verdict "n/a (server)".
VALIDATE: simulate a hung provider (point a provider base at a black-hole/sleep endpoint or
mock a never-resolving fetch in a unit harness) → the job times out, its slot frees, the next
queued job runs; ledger shows the timed-out job REFUNDED (not double-charged, not stuck).
`npm run build -w apps/api` clean.

════════════════════════════════════════════════════════════════════════════════
SECTION D (P32) — server hardening batch (small, mostly independent)
════════════════════════════════════════════════════════════════════════════════
1. CORS hard-fail (index.ts:80-97): if CORS_ORIGIN is empty/"*" in PRODUCTION with credentials
   enabled → refuse to boot (throw) instead of warning. Dev stays permissive.
2. 🔴 monthStart() UTC (plugin-profile.ts:127-142): currently local-TZ → the monthly reset
   boundary drifts per instance/timezone. Pin it to UTC. This is a BOUNDARY CALCULATION, not a
   credit VALUE — but it shifts WHEN a reset happens once, at deploy. Comment it clearly in
   Uzbek "monthStart UTC — deploy paytida chegara bir marta siljiydi (owner xabardor)". Do NOT
   change any credit amount or the reset LOGIC, only the month boundary computation.
3. reset-password / verify-email limiters (auth.ts:452,489): add a dedicated rate limiter
   (reuse the existing limiter middleware, tighter window) — currently unthrottled.
4. Register transaction (auth.ts:134-146): wrap User + Subscription creation in
   prisma.$transaction so a half-created account can't exist.
5. Avatar mimetype sniff (auth.ts:717-747): validate the uploaded file's real content-type
   (magic bytes) not just the multer field — reject non-images.
6. LS signature length-guard (lemonsqueezy.ts:263-271): guard the HMAC compare against a
   malformed/short signature so it returns 400, not a 500 RangeError.
NOTE: rate-limit in-memory per-instance (middleware/rate-limit.ts:97-122) + per-account
lockout is a KNOWN scaling limit — REPORT it (real fix = shared store, post-launch), do not
build a distributed limiter here.
PLUGIN: server-only — "n/a".
VALIDATE: `npm run build -w apps/api` clean; boot with CORS_ORIGIN unset in NODE_ENV=production
→ refuses (test locally with the env, revert); register creates User+Subscription atomically
(kill mid-transaction in a test → neither persists); malformed LS signature → 400 not 500;
non-image avatar upload → rejected. monthStart returns UTC boundary.

════════════════════════════════════════════════════════════════════════════════
FINAL
- `npm run build -w apps/api` clean; node --check edited js; `npm run studio:sync` once if
  studio js touched; install-cep.sh once if plugin touched.
- Up to 4 commits — do NOT push.
- Summary: per section done/skipped + root cause + PLUGIN verdict. Section C: list which
  provider fetches got timeouts + the OOM items deferred. Section D: the monthStart
  deploy-shift note + the rate-limit scaling item reported. Section B: state "runtime bug
  fixed" vs "already fixed needs push".
```

---

**Model:** Fable 5 (Medium) — P27/P32 pul-tutash (monthStart, refund oqimi). Kvota kam → Opus 4.8.

## HIGH blokining OXIRGI qismi (bundan keyin)

**JONLI-TEST to'plami** (ega ishtiroki SHART, combined QILINMAYDI) — V2 faylidan BIRMA-BIR,
tartib: **P22** (plugin qora media/o'lgan tugmalar) → **P24** (plugin video modellari) →
**P35** (pack AE'da ochilmasligi + preview strip) → **P28** (Windows + in'ektsiya + AE 2022+).
Har biri AE panelini yoki Windows'ni ochib jonli tekshirishni talab qiladi.
