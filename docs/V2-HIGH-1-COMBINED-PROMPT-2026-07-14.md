# V2 HIGH-1 — COMBINED (gen-media + kredit o'zagi) — 2026-07-14

> HIGH blokining BIRINCHI to'plami: P1 → P9 → P17 → P20 → P23. Hammasi gen-media/kredit
> atrofida, MANTIQAN BOG'LIQ — bitta Code kontekstda ketma-ket toza ketadi (P1 va P9
> ikkalasi hydrateGenAssets'ni o'zgartiradi; P23 P9'ga tayanadi). Model: **Fable 5 (Medium)**.
> Ega ishtiroki SHART EMAS — Code o'zi tugatadi (jonli AE testlari P22/P24 alohida to'plamda).
>
> To'liq diagnoz: `docs/MUAMMOLAR V2-2026-07-13.md` (P1, P9, P17, P20, P23 bo'limlari).

---

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). FIVE money-adjacent gen/media fixes in ONE
session, in order A→E. COMMIT AFTER EACH SECTION ("V2-HIGH1 <letter>: <short>", no
Co-Authored-By; do NOT push). If a section conflicts/balloons, SKIP it, note why, continue.
ORDER IS MANDATORY: A(P1) and B(P9) both edit hydrateGenAssets — A first. E(P23) depends on
B's stable URLs.

SOURCES OF TRUTH
- Server: apps/api/src/routes/studio-gen.ts, lib/gen-processor.ts, lib/explore-submit.ts,
  lib/catalog-map.ts, routes/projects.ts. Build check: `npm run build -w apps/api` (or tsc).
- Web platform: packages/assetflow-studio/platform/index.html + ff-api.js (DIRECT sources).
- Plugin: plugins/after-effects-cep/ (no internet assets; install-cep.sh after edits;
  node --check).

🔴🔴 MONEY ZONE — READ TWICE
- NEVER change credit consume/refund internals, cost-quote/HMAC (lib/gen-quote.ts,
  gen-models.ts computeGenCost/imageUnitCost, plugin-profile.ts), computeEnhanceCost values,
  any credit VALUE, or consumeDownload limits.
- The hydrateGenAssets PLAN GATE (paid=clean original / free=watermark-or-small-derivative,
  invariants 1-3 in its doc comment) MUST stay behaviourally identical EXCEPT where a section
  explicitly says so. url/downloadUrl plan logic byte-identical unless noted.
- Every section that could touch charging MUST verify with a CreditLedger check that N
  actions = N debits (stated per section).
- Migrations: NONE. Keep GenAsset.watermarkKey COLUMN (additive) — just stop populating it.

GLOBAL RULES
- English UI; Uzbek code comments. Minimal diffs. Do NOT loosen isPublicReadKey(). Do NOT
  reintroduce softenPromptForSafety. Do NOT renumber @N tokens.
- ⚠️ Uncommitted BATCH6/8 changes in platform/index.html or plugin → commit them as their
  OWN checkpoint first (as the V2-EASY session did), then proceed. Report if found.
- PLUGIN PARITY: each section states its plugin verdict.

════════════════════════════════════════════════════════════════════════════════
SECTION A (P1) — Watermark rework: AI-gen ALWAYS clean; stock preview clean+low-res
════════════════════════════════════════════════════════════════════════════════
OWNER DECISIONS (binding, survey 2026-07-14): AI generations never watermarked (credits =
payment). Stock preview clean but deliberately LOW-RES (DRM = resolution). Stock download
past Free limit = HARD BLOCK (existing consumeDownload 403 kept). Audio STING = REMOVED.
AI Stock previews = clean + low-res like all stock. Net result: the burned-in watermark
engine ends with ZERO callers.
FIX:
1. STOP writing watermarkKey: gen-processor.ts remove makeGenWatermarkFromBuffer calls at
   :1344 (image), :1391, :1408 (audio), :1455 (video) and drop watermarkKey from the four
   genAsset.create data payloads (:1362, :1393, :1410, :1459). Keep the column in schema.
2. hydrateGenAssets (studio-gen.ts:122-181): the `else if (a.watermarkKey)` branch (:148-153)
   is now dead for new gens — KEEP the FREE small-derivative fallback (:154-165) as the FREE
   main-url path (never exposes resultKey). Since AI-gen is now ALWAYS clean per owner, the
   FREE branch should serve the clean display derivative; verify FREE users get their own
   generation's clean derivative for url/download (owner: "credits = payment"). Do NOT expose
   the 4K resultKey to FREE for STOCK — but AI-GEN originals to their OWN creator on FREE are
   now allowed (owner decision #2). Implement: for AI GENERATIONS, paid AND free → clean
   (resultKey for the creator). Re-read the invariant comment and REWRITE it to match the new
   owner model; keep viewerIsPaid computed server-side.
   🔴 This is the one intentional plan-gate change — make it surgical and comment it heavily
   in Uzbek referencing "owner 2026-07-14".
3. Stock previews CLEAN + LOW-RES: lib/stock-derivatives.ts
   generateStockWatermarkedDerivatives() — remove the burned-in logo; ensure the public
   preview is downscaled (video ≤720p capped bitrate, image ≤1280px long edge moderate
   quality, audio reduced bitrate). The FULL-quality original stays PRIVATE under `pack`
   (verify isPublicReadKey never exposes it; P1.2 trap).
4. Owner's PNG: store the owner-provided watermark PNG at apps/api/assets/watermark.png
   (replace the auto-generated one) for future use even though the engine is dormant. Audio
   sting apps/api/assets/watermark-sting.mp3 stays on disk, unused.
5. BACKFILL script scripts/backfill-clean-previews.mjs: (a) regenerate existing stock
   previews CLEAN+low-res (overwrite old watermarked objects), (b) AI-gen originals need no
   change (just stop serving watermarkKey). Dry-run flag; owner runs manually.
PLUGIN: plugin viewing/download consumes the same server URLs — no plugin code change for the
watermark removal, but VERIFY the plugin FREE download now gets a clean file (state it).
VALIDATE: new FREE image/video/sfx gen → download is CLEAN, no logo, no sting; ledger shows
credits charged once at gen time (unchanged). Stock card preview clean + visibly low-res;
stock pack download within limit = clean full-res; past limit = 403. Backfill dry-run lists
existing watermarked previews. `npm run build -w apps/api` clean.

════════════════════════════════════════════════════════════════════════════════
SECTION B (P9) — Gen DISPLAY derivatives via stable CDN (kills black cards + flash)
════════════════════════════════════════════════════════════════════════════════
ROOT: hydrateGenAssets (:128,:136-140) signs displayUrl/previewUrl/thumbUrl with
getSignedDownloadUrl(key,3600) — 1-hour URLs expire in-tab (cards blacken) and defeat the
browser cache (gradient flash every refresh). Those derivative keys are ALREADY CDN
allow-listed (public-keys.ts:42).
FIX:
1. studio-gen.ts hydrateGenAssets: change ONLY the DISPLAY-derivative signings (:136-140,
   displayUrl/previewUrl/thumbUrl/posterKey) from getSignedDownloadUrl to
   getPublicOrSignedUrl(key,3600) (already imported :42). Allow-listed keys → stable
   cdn.getframeflow.app URL; non-allow-listed keys keep signed fallback automatically. Do NOT
   change url/downloadUrl (Section A's plan gate stays). Watermark path already gone (A).
2. Grep all consumers of hydrateGenAssets (projects.ts, sessions list, the /gen/:id route)
   — they inherit the fix; verify no OTHER code signs thumbKey/displayKey/previewKey/posterKey
   directly with getSignedDownloadUrl.
3. WEB instant-paint: platform/index.html — cache last history/sessions/projects payloads in
   sessionStorage per userId (cap ~200KB). On boot render cached immediately, then refresh in
   background and overwrite. With stable CDN URLs the cached image URLs stay valid → no
   gradient flash. Invalidate on ff-auth-expired + logout (integrate with P25's resetUserState
   if present — clear the cache keys there).
4. WEB image-failure: gen card media (grid/session/lightbox) onerror → retry-once (cache-bust)
   then a small "media unavailable" overlay instead of silent gradient. One helper.
5. BACKFILL report: count GenAssets where resultKey!=null AND thumbKey IS NULL AND displayKey
   IS NULL (prisma). Report count. If a derivative util exists in gen-processor.ts, add
   scripts/backfill-gen-derivatives.mjs (batch, resumable, dry-run) — do NOT run on prod.
PLUGIN: the plugin gen gallery uses the same endpoints — verify cards now get CDN URLs (no
client change expected); add onerror fallback to its gallery if missing. install-cep.sh.
VALIDATE: fresh gen → card image host = cdn.getframeflow.app (derivative) while Download URL
is signed storage (paid) / clean derivative (free) — gate intact. Tab open >60min (or mock
TTL=60s) → cards DON'T blacken. Warm refresh → instant paint, no gradient flash. Old
derivative-less gen → "media unavailable", not eternal gradient.

════════════════════════════════════════════════════════════════════════════════
SECTION C (P17) — "Can't reach the server" on Generate/Enhance (cold-start safe)
════════════════════════════════════════════════════════════════════════════════
FIX 1 (client): ff-api.js quote() → pass { idempotent:true } (pure compute+sign; VERIFY the
cost-quote route does NO db write / NO consume — state it). This fixes most "Generate dies"
(the quote was the first cold-start victim; gen already retries via idempotencyKey).
FIX 2 (enhance idempotency — 🔴 double-charge risk):
a) SERVER studio-gen.ts POST /gen/prompt/enhance (:1630): replicate the EXISTING /gen
   Idempotency-Key dedup (find how /gen does it — reuse the SAME mechanism/store; NO new
   table). First request: cap→consume→Vertex, cache response under the key (TTL ~10min).
   Retry same key: return cached response WITHOUT consuming again. In-flight dup: mirror /gen.
b) CLIENT ff-api.js enhance(): generate a per-click idempotencyKey (uuid, same as gen()
   :210-214), pass { idempotencyKey } so req() retries safely (4 attempts). New click = new key.
c) 🔴 VERIFY: N retries of one click = exactly ONE credit debit (kill connection after server
   consumed, before client got response → client retries → cached → ledger ONE debit).
FIX 3 (client): where Generate/Enhance catch NETWORK (platform/index.html toast site :18866
+ callers), show the toast WITH a Retry action re-invoking the SAME op (same idempotencyKey
for enhance retry). Keep "won't be charged if refused" note.
PLUGIN: plugin AI client calls the same endpoints — give its enhance the idempotencyKey+retry
and its quote idempotent retry (mirror ff-api.js req() backoff for THESE TWO only). install-cep.sh.
VALIDATE (throttle Slow 3G + cold API): Enhance → survives 60s+, ONE debit, prompt arrives;
Generate → quote retries, one job, one charge. Kill network → toast WITH Retry; Retry after
reconnect → no second debit / no dup job. Ledger before/after 5 forced-retry enhances = 5 debits.

════════════════════════════════════════════════════════════════════════════════
SECTION D (P20) — AI SFX/Music → Sound Effects/Music pills + real audio player
════════════════════════════════════════════════════════════════════════════════
FIX 1 (server explore-submit.ts): at both publish sites (:144,:217) set templateType='sfx'
for sfx mode, 'music' for voice/music; image/video KEEP 'ai-stock'. stockType unchanged. Keep
meta.aiSource='ai'. "My submissions" query (:297) → templateType in ('ai-stock','sfx','music')
AND aiSource='ai'. Metadata typeKey (:187) → 'sfx'/'music' for audio (audio taxonomies, kills
"Uncategorized"). Verify admin moderation still shows the AI PROMPT box (keys off aiSource) and
web card AI badge keys off aiSource not templateType (adjust if needed).
BACKFILL scripts/backfill-ai-audio-type.mjs: UPDATE existing published AI audio
(templateType='ai-stock' AND stockType in ('sfx','music')) → 'sfx'|'music'. Dry-run; owner runs.
FIX 2 (web real player): one shared waveform player (image base + accent progress layer driven
by 'timeupdate' + playhead; click/drag seeks; custom play/pause + "0:04/0:10" mono; REMOVE
visible native <audio controls>, keep hidden <audio> engine). No-waveform items → simple bars
placeholder, progress still works. Used in catalog audio detail AND AI Studio audio lightbox.
FIX 2b (🔴 tofu): audio lightbox uses Phosphor <i class="ph…"> but that's an admin-only font on
web → □. Replace every ph-icon in platform/index.html AUDIO surfaces with the inline #i- sprite.
Grep class="ph in platform, report count. (P21 will do the global watchdog separately.)
FIX 3 (web audio detail): hide Application/Orientation/Resolution rows + "Open in After Effects"
for audio; show Duration (ffprobe if present) + Format (.mp3 pack). Non-audio unchanged.
PLUGIN: verify SFX/Music AI items now appear under their nav sections (server-driven — test);
give plugin audio preview progress+seek if it's static image + bare audio tag. install-cep.sh.
VALIDATE: gen SFX → Add to Explore → admin approve → appears under Sound Effects pill (NOT AI
Stock), real category, AI badge + prompt box intact; My submissions still lists it; backfill
dry-run lists the 2 alarm SFX; audio detail waveform fills as it plays, click seeks, no native
bar, no □ icons; audio detail shows Duration/Format.

════════════════════════════════════════════════════════════════════════════════
SECTION E (P23) — gen cards flicker every 3-4s (poll re-render) [depends on B]
════════════════════════════════════════════════════════════════════════════════
ROOT: while a job runs, the poll tick (~3s) setState re-renders the gallery region, recreating
<img>/<video> nodes → gradient flash. B fixed URL churn; E fixes node recreation.
FIX 1 (web): in the job poll tick, while status running/queued DO NOT setState for progress —
update the pending card in-place via DOM (querySelector('[data-jid]') → pct/status/bar, mirror
contributor bulkUpdateRow). Only on COMPLETE/FAIL: one setState (full render once). Keep
_clearPollTimers. Audit other idle setState sources (credits/focus/sessions poll) — gate each
to only setState when a small signature actually changed; list them.
FIX 1b: ensure identical items don't get new src strings between renders (post-B stable URLs;
no per-render cache-bust); loadedSet/va-skel keeps an already-loaded item WITHOUT skeleton on
re-render (fix if the id set drops on re-render).
FIX 2 (plugin): same discipline in AssetFlow_Plugin.html job poll (:11697) + recent strip —
update only the pending tile's DOM until done; single full refresh on completion. Verify other
cards' <img>/<video> keep element identity (devtools). install-cep.sh.
FIX 3 (plugin toast polish): restyle plugin toast to match web (fixed bottom-center stack,
12px radius, type colors info/success/warn/error + inline SVG icon, auto-dismiss slide/fade,
max 3 stacked); instructional banners (Voice pane helper) get the standard info-banner look.
Keep showToast() signature unchanged.
VALIDATE (web): start 30s+ video gen → pending card progress smooth; OTHER cards' <img> keep
identity across the run (devtools); completion inserts once. Idle 2min → zero re-renders (no
flashes). Plugin: same + toasts consistent all types.

════════════════════════════════════════════════════════════════════════════════
FINAL
- `npm run build -w apps/api` clean; node --check every edited js; `npm run studio:sync` once
  if any studio js touched; `install-cep.sh` once if plugin touched.
- Up to 5 commits (fewer if skipped) — do NOT push.
- Summary: per section done/skipped, root cause confirmed, PLUGIN verdict, and the 🔴 LEDGER
  results (Section A gen charge unchanged; Section C 5-retry = 5 debits; Section D backfill
  list). List any idle-setState sources found in Section E. List backfill scripts created.
```

---

**Model:** Fable 5 (Medium) — 5 tasi pul-tutash, ledger-testlar majburiy. Kvota kam bo'lsa Opus 4.8.

## HIGH blokining QOLGANI (bu to'plamdan keyin)

- **HIGH-2 combined** (boot + server barqarorlik): P5 → P11 → P27 → P32. Alohida fayl —
  ayting, tayyorlab beraman.
- **JONLI-TEST to'plami** (ega ishtiroki SHART, combined QILINMAYDI): **P24** (plugin video
  modellari), **P22** (plugin qora media/o'lgan tugmalar), **P35** (pack AE'da ochilmasligi +
  preview strip), **P28** (Windows + in'ektsiya). Bularni V2 faylidan BIRMA-BIR ishlating —
  har biri AE/Windows ochib jonli tekshirishni talab qiladi. Tartib: P22 → P24 → P35 → P28.
