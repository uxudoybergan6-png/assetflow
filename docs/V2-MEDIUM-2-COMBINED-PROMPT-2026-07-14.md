# V2 MEDIUM-2 — COMBINED (barqarorlik + ishonch + admin) — 2026-07-14

> MEDIUM blokining IKKINCHI to'plami: P6 → P21 → P30 → P31 → P2 → P33 → P29 → P26.
> Aralash sirtlar (web reliability, admin, trust). Ega ishtiroki shart emas.
> Model: **Sonnet 5** — LEKIN 🔴 SECTION H (P26 to'lov) pul-tutash: agar server checkout
> dedup kerak bo'lsa o'sha qismni **Fable 5 Medium**'ga ajrat (prompt ichida belgilangan).
> To'liq diagnoz: P6/P21/P30/P31/P2/P33 → `docs/MUAMMOLAR V2-2026-07-13.md`; P29/P26 →
> `docs/DIREKTOR-AUDIT-V2-2026-07-14.md`.

---

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). EIGHT fixes in ONE session, order A→H.
COMMIT AFTER EACH ("V2-MED2 <letter>: <short>", no Co-Authored-By; do NOT push). Skip+note+
continue on conflict. Sections independent; A→H is just a convenient order.

SOURCES
- Web platform: platform/index.html + ff-api.js (DIRECT). Studio SPAs: ROOT js + admin shell,
  studio:sync once at end. Server: apps/api/src/** (build check npm run build -w apps/api).
- Plugin: plugins/after-effects-cep/ (no internet assets; install-cep.sh; node --check).

🔴 MONEY ZONE FROZEN (consume/refund, cost-quote/HMAC, credit values, consumeDownload, prices).
Section E (P2) rewrites PRICING COPY only — no code that computes prices; CMS + code defaults
BOTH updated. Section H (P26) adds checkout idempotency GATE (not price math) — see its 🔴 note.
Migrations NONE. English UI; Uzbek comments. Minimal diffs. Do NOT loosen isPublicReadKey().
⚠️ Uncommitted BATCH6/8 → checkpoint first, report. PLUGIN PARITY per section.

════════════════════════════════════════════════════════════════════════════════
SECTION A (P6) — web breaks on refresh: /stock stuck loader, silent dead-ends
════════════════════════════════════════════════════════════════════════════════
(HTTP/3/QUIC already disabled by owner 2026-07-14 — the "site dead" half. This is the code half.)
FIX A1 (one-line): platform/index.html ~:18490 boot deep-link /stock-without-asset branch sets
state + _syncStockUrl() but MISSES this.ensureBrowse(). Add it (mirror popstate :18527). This
alone fixes "/stock hard-refresh stuck on Hanging the template wall…".
FIX A2 (no silent dead-ends): loadBrowse catch (:18947) → {loading:false, done:false,
error:true, key:''} (empty key so ensureBrowse retries on re-entry); grid template (~:16715)
when browse.error && !items → "Couldn't load the catalog." + [Try again]→loadBrowse(true);
error && items → slim inline "Couldn't load more — Retry". loadCatalog catch (:18892) → set
_catalogErr + retry ONCE after 5s. Wire flags through the sc- data object (~:21774-21780).
FIX A3 (auth cold-start): ff-api.js login/register/google/forgot/resendVerification are POSTs
→ 1 attempt 20s → guaranteed loss vs cold start. Pass { idempotent:true, timeout:30000 } for
these five ONLY (server IP-rate-limited; 4 client attempts fine). Do NOT touch checkout/gen.
FIX A4 (warm-up): on boot (fire-and-forget, no await): FFAPI.req('/health',{auth:false,
timeout:8000}).catch(()=>{}) so Cloud Run + Neon wake while the user reads the page.
FIX A5 (audit + cheap fixes): refresh mid-generation → does a running job re-attach polling
(loadHistory/loadSessions + activeJobs)? If orphaned, re-attach poll timers for status
'running' items on boot. Grep boot-critical loads (loadModels/loadPluginMe/refreshCredits/
loadProjects) for silent catch → retry-once or non-blocking toast; fix cheap ones, list rest.
PLUGIN: catalog already has retry+Retry button — verify it recovers after a failed cold start
(point env at unreachable API); check assetflow-client.js request timeout not <20s; align.
VALIDATE: refresh /stock warm → grid loads; offline → error block + Try again works online;
login throttled → no instant "Can't reach server" before ~60s retries.

════════════════════════════════════════════════════════════════════════════════
SECTION B (P21) — session-wide □ tofu: Phosphor icon font fails, never retries
════════════════════════════════════════════════════════════════════════════════
ROOT: platform SELF-HOSTS Phosphor fonts (@font-face :349/:4975/:9600, font-display:block,
105+ .ph usages). One failed woff2 fetch → □ tofu for the whole session; browsers never retry
a failed font. (P7 preload may have added admin preloads — dedup.)
FIX:
1. Preload (web + admin shells): <link rel="preload" as="font" type="font/woff2" crossorigin>
   for each Phosphor woff2. Dedup with P7 if present.
2. Font watchdog (web + admin, one small script): on boot for each family
   ('Phosphor','Phosphor-Bold','Phosphor-Fill'): document.fonts.load('1em '+family).then(list=>
   { if(!list.length) retry }). retry: new FontFace(family,'url(<file>?r=n)').load() → add to
   document.fonts on success; 3 attempts, 2s/5s/10s backoff. Final failure: AssetFlowLog.error
   + html.classList.add('ff-iconfont-dead') → CSS makes .ph render a neutral · (not □). Uzbek
   comment (brauzer o'zi retry qilmaydi).
3. Inventory (report only): count .ph per file + top 10 visible spots; note full inline-sprite
   migration = BATCH8 candidate (not this prompt).
PLUGIN: grep for icon font → none expected (inline SVG); state it.
VALIDATE: block a Phosphor woff2 in devtools → reload → watchdog retries (network log), after
unblocking mid-retry icons appear WITHOUT manual reload; block permanently → after 3 tries
ff-iconfont-dead, .ph shows ·, error logged; normal load unchanged (preload early fetch).

════════════════════════════════════════════════════════════════════════════════
SECTION C (P30) — destructive actions unconfirmed + silent skeletons
════════════════════════════════════════════════════════════════════════════════
FIX 1: gen delete has NO confirm (lightbox trash :17520, Use▾ delete :21725, delActive
:21761) — a paid asset dies in one click. Add the 2-step "armed" pattern already used by
project delete (:19253) — first click arms ("Click again to delete"), second confirms, 3.5s
timeout disarms with a visible countdown/state. NOT native confirm().
FIX 2: loadSessions/loadProjects catch{} → eternal skeleton (:19205,:19222); refreshCredits/
loadPluginMe/loadExploreSubs silent (:19008-19032); downloadTemplate silent on url-less
response (:20357-20372). Add loaded-flag + error-state + Retry to each list loader (P6 A2
pattern); download fallback toast.
PLUGIN: gen delete confirm in its gallery (if one-click today); list-loader error states.
install-cep.sh.
VALIDATE: gen delete → arms then confirms, disarms after 3.5s; kill a list endpoint → error +
Retry (not eternal skeleton); download fail → toast.

════════════════════════════════════════════════════════════════════════════════
SECTION D (P31) — modal a11y + control consistency
════════════════════════════════════════════════════════════════════════════════
FIX: showCredits/showDelete/nameModal (:17366,:17392,:17410): Esc-close (integrate with P14's
one-layer-Esc if landed, else standalone), focus-trap, body scroll-lock, role="dialog"
aria-modal. delete-account input Enter-submits (:17401). Replace session bulk-delete native
confirm() (:21600) with the in-app armed pattern (Section C). Project-delete armed state shows
a countdown (:19253). One small modal helper (esc/focus/scroll-lock/aria) reused by all three.
PLUGIN: its modals/sheets get Esc + scroll-lock parity (reuse existing plugin patterns).
install-cep.sh.
VALIDATE: each modal Esc-closes, traps focus, locks body scroll; delete-account Enter works;
no native confirm() left; armed states show countdown.

════════════════════════════════════════════════════════════════════════════════
SECTION E (P2) — pricing copy is FALSE after P1: 4K/watermark no longer Pro-only
════════════════════════════════════════════════════════════════════════════════
After P1 (watermark gone) + no 4K gate, "Pro: 4K, watermark-free" (platform/index.html:18105,
:18118, landing-config) is false advertising. OWNER DECISION: Free gets any resolution within
its monthly download limit; Free↔Pro difference = downloads/month + credits.
FIX:
1. Do NOT build a 4K gate. Rewrite pricing/plan copy: remove "4K" + "watermark-free" as
   Pro-only; frame the difference as downloads/month (Free 15 → Pro/Studio unlimited) +
   credits. Update: pricing page, plan cards, FAQ ("What's in Free"), CMS landing config, AND
   the plugin plan copy. ⚠️ CMS-stored copy overrides code defaults — update BOTH.
2. Pre-flight download standing (the salvageable owner request): on asset detail + download
   button show "X of 15 downloads left this month"; when exhausted disable/relabel "Monthly
   limit reached — Upgrade to Pro" (no post-click 403 surprise). Same on plugin.
3. maxResolution profile field (plugin-profile.ts:112) is now dead/misleading — remove or
   repurpose (do not leave a field implying a gate that doesn't exist). 🔴 do NOT change the
   download-limit VALUE (consumeDownload) — UI/copy only.
PLUGIN: plan copy + "X of 15 left" pre-flight. install-cep.sh.
VALIDATE: pricing shows downloads/credits difference, no "4K/watermark-free" as Pro perk; CMS
+ code + plugin all consistent; download button shows remaining count, disables at limit.

════════════════════════════════════════════════════════════════════════════════
SECTION F (P33) — trust/honesty in the UI
════════════════════════════════════════════════════════════════════════════════
FIX: remove FAKE social proof "Just now: Sardor upgraded to Pro" hardcode (:21363) — delete or
wire to a real event. Placeholder shelves ("Model of the week", downloads/7d :17946,:20731,
:16447,:21040,:21206) — make honest (real data or remove the fake framing). Favorites are
localStorage-only (:17946) → server-sync via the EXISTING plugin favorites endpoint (bring to
web). Raw UTC date slices everywhere (platform + contributor-views:1519, admin-views2:286) →
one local-date helper. 9px/8.5px text (:15859,:14622) → min 10px.
PLUGIN: favorites already server-synced (verify) — ensure web uses the same endpoint; date
helper parity. install-cep.sh.
VALIDATE: no fake "Sardor" line; favorites persist across devices (web↔plugin); dates local-
formatted; no <10px text.

════════════════════════════════════════════════════════════════════════════════
SECTION G (P29) — admin controls that lie (server + studio)
════════════════════════════════════════════════════════════════════════════════
FIX (admin studio + server):
1. Block-reason ("Reason for blocking *") is collected but not persisted/audited
   (admin-views2:870-895) → send to the API + audit log (check server field exists; add
   additive if not).
2. Approve "Send approval message" checkbox does nothing (:657 vs :663-681) → wire to the
   message API or remove the checkbox.
3. Stub controls: All-Templates fake "1/1" pagination + dead checkboxes (:85-91,:67); Filter/
   CSV/"Add category"/moderation-rule toggle (:35-36,:105,:347,:465-478) — either make them
   work or disable with a "coming soon" label. Do NOT ship non-functional live-looking controls.
4. Double-submit guards: broadcast/DM/reply/saveEditMeta/doBlock (:958,923,831,634,882,975) —
   disable+spinner during await.
5. tName(id) null-guard (:614 stale onclick TypeError); unify unread badge count (index:272 vs
   views2:201); fix toast double-escape ("Tom &amp; Jerry").
6. Shadowed legacy timeline admin-views.js:208-213 — esc() its interpolations OR delete if
   provably dead (state which; note: V2-EASY H-6 already deleted a similar dead overview block —
   confirm this is a different one).
PLUGIN: admin surface is web/studio only — plugin verdict "n/a".
VALIDATE: block reason persists + audited; approve-notify sends or is gone; no live-looking
dead controls; double-clicks can't double-send; no tName TypeError; unread count consistent.

════════════════════════════════════════════════════════════════════════════════
SECTION H (P26) — payment UX holes: double checkout, silent return, lost intent
════════════════════════════════════════════════════════════════════════════════
🔴 MONEY-ADJACENT — if server-side checkout dedup is needed, treat that sub-part with extra
care (ledger/idempotency); the CLIENT fixes are safe. Do NOT change price/credit values.
FIX:
1. Pay buttons (onBuyCredits/onChoosePlan :21497-21516; markup :16209/:17097/:17378) have no
   busy/disabled state → 2-3 clicks = 2-3 Lemon Squeezy sessions. Add disable+spinner during
   the await. Optionally pass an idempotencyKey to the checkout POST if the server LS-checkout
   supports dedup (verify server; if it needs a server change, flag it — that sub-part may go
   to a Fable 5 follow-up).
2. Checkout return: only ?verified=1 is handled (:18539). Handle ?checkout=success →
   toast + refreshCredits + show the ledger; a failed/cancelled return → non-blocking notice.
3. Logged-out plan pick → auth → after login return to the SAVED intent (sessionStorage
   ff_intent = {plan|credits}) instead of dropping to dashboard.
PLUGIN: plan/credits purchase entry (if present) gets the same button-busy + intent handling.
install-cep.sh.
VALIDATE: rapid-click Buy → ONE checkout session; return with ?checkout=success → toast +
credits refresh + ledger entry; logged-out pick Pro → login → lands on the Pro checkout, not
dashboard; ledger unchanged by UI (no double charge).

════════════════════════════════════════════════════════════════════════════════
FINAL
- node --check every edited js; `npm run build -w apps/api` if server touched; studio:sync if
  studio js touched; install-cep.sh (plugin touched most sections).
- Up to 8 commits — do NOT push.
- Summary: per section done/skipped + root + PLUGIN verdict. Section H: state whether checkout
  needed a server dedup change (→ Fable follow-up) or client-only sufficed. Section G: which
  stub controls were wired vs disabled. Section E: confirm CMS + code + plugin copy all updated.
```

---

**Model:** Sonnet 5 (Section H server-dedup qismi chiqsa → Fable 5 Medium follow-up).

## MEDIUM TUGAGACH — HIGH JONLI-TEST qoladi
P22 → P24 → P35 → P28 (AE/Windows, ega ishtiroki, birma-bir, V2 faylidan). P18 (MEDIUM-1 D)
tugagach P24 chip-gate tayyor bo'ladi.
