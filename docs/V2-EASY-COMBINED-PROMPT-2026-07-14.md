# V2 EASY — COMBINED ONE-SHOT PROMPT (2026-07-14)

> Ega qarori: barcha EASY ishlar (P4, P3, P7, P8, P10, P16, P25, P34) BITTA Code
> sessiyasida. Model: **Sonnet 5**. Quyidagi promptni to'liq nusxalab Code'ga bering.

---

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). You will complete EIGHT small, precisely
diagnosed fixes in ONE session, in order A→H. COMMIT AFTER EACH SECTION with message
"V2-EASY <letter>: <short>" (no Co-Authored-By); do NOT push. If a section unexpectedly
conflicts or balloons, SKIP it, note why in the final summary, and continue with the next.

SOURCES OF TRUTH
- Studio SPAs: edit ROOT packages/assetflow-studio/js|styles + contributor/admin shells,
  then run `npm run studio:sync` ONCE at the end (never edit studio/, admin/ build output).
- Web platform: packages/assetflow-studio/platform/index.html + platform/ff-api.js are
  DIRECT sources (edit in place).
- Plugin: plugins/after-effects-cep/ — no internet-loaded assets; after plugin edits run
  `bash plugins/after-effects-cep/scripts/install-cep.sh`; validate JS with node --check.

GLOBAL RULES (apply to every section)
- 🔴 MONEY ZONE FROZEN: never touch credit consume/refund, cost-quote/HMAC (lib/gen-quote.ts,
  gen-models.ts computeGenCost/imageUnitCost, plugin-profile.ts), any credit value, or
  consumeDownload limits.
- 🔴 Do NOT loosen isPublicReadKey(). Do NOT reintroduce softenPromptForSafety. Do NOT
  renumber @N reference tokens.
- English UI text; Uzbek code comments. Minimal, tight diffs. Migrations: NONE.
- ⚠️ If platform/index.html or the plugin has uncommitted BATCH6/8 changes → stop, report.
- PLUGIN PARITY: each section states its plugin verdict (fixed there too / surface absent).

════════════════════════════════════════════════════════════════════════════════
SECTION A (P4) — admin panel destroyed by one line: '" /> text, broken layout
════════════════════════════════════════════════════════════════════════════════
BUG: packages/assetflow-studio/js/studio-media.js:90 renderThumb():
  <img ... onerror="this.outerHTML='${thumbArt(...).replace(/'/g,"\\'")}'" />
thumbArt() (admin-views.js:26) returns HTML full of double quotes and '>'. Only single
quotes are escaped → the double-quoted onerror attribute terminates early at parse time,
the <img> closes mid-string, thumbArt markup leaks into the DOM, trailing '" /> renders as
text. Corrupts EVERY admin row with a thumb (Overview approval queue via admin-dashboard.js
qthumbHtml:29, Moderation list via adxModThumb admin-views.js:317, tables admin-views2.js:68,
:182) and any portal using renderThumb.
FIX:
1. Replace the onerror-injects-HTML pattern with wrapper + hide-on-error:
   if (t.id && hasAsset(t, "thumb")) {
     const src = escapeAttr(t.thumbUrl || assetUrl(t.id, "thumb"));
     // Uzbek comment: onerror ichiga HTML kiritish taqiqlangan — atribut buziladi (P4)
     return `<span class="thumb ${escapeAttr(t.grad||"g1")} grain" style="display:block;width:${w};height:${h};border-radius:var(--r-sm);overflow:hidden">`+
            `<img src="${src}" alt="" style="${box}" loading="lazy" onerror="this.style.display='none'" /></span>`;
   }
   The gradient span behind IS the fallback. Do not call thumbArt() from studio-media.js
   (also removes a hidden dependency: thumbArt doesn't exist on non-admin portals).
2. Repo audit: grep packages/assetflow-studio + platform/index.html +
   plugins/after-effects-cep for onerror=/outerHTML= patterns that interpolate
   HTML-producing code into ATTRIBUTE values; fix any instance the same way; list findings.
3. Moderation polish (admin-views.js): (a) when items exist and nothing is checked, render
   a subtle hint row where the bulk bar appears: "Tip: select items (or Select all) to bulk
   Approve / Reject / Clear pack." (no layout shift); (b) bulkAction('reject') gets a
   confirm step with count ("Reject N templates?"); approve/clear-pack stay instant;
   (c) constrain .adx-qthumb (fixed size + overflow:hidden) so a slow thumb can't stretch
   Overview rows.
VALIDATE: admin Overview + Moderation render clean (no '" /> text), two-pane layout intact,
select-all → bulk bar, offline thumb → gradient fallback. Contributor "My templates" +
plugin catalog still render thumbs (shared file).

════════════════════════════════════════════════════════════════════════════════
SECTION B (P3) — contributor upload stuck after "Sent to moderation"
════════════════════════════════════════════════════════════════════════════════
FILES: packages/assetflow-studio/js/contributor-views.js (bulk upload :416-676),
contributor-dashboard.js:134,:157.
PROBLEM: startBulkIngest()'s finally re-renders the same list — done rows + checked rights
box sit forever; sidebar "New upload" and dashboard CTAs call route('upload') WITHOUT
resetting state (only the header button calls startNewUpload()), so the stale list returns
on every visit.
FIX:
1. Add BULK_SUMMARY=null module flag. After ingest finishes with doneCount>0 and no queued
   left: BULK_SUMMARY={done,dup,err}. renderBulkUpload(): when BULK_SUMMARY && !BULK_RUNNING
   render a success card instead of dropzone+rows: "✓ N asset(s) sent to moderation" +
   dim line "They'll appear in My templates with a Pending review status." + amber/red
   count lines when dup/err>0 (keep those rows rendered+removable below) + buttons
   [View my templates]→route('templates') and [Upload more]→clear done+dup rows (reuse
   bulkClearFinished), BULK_SUMMARY=null, keep BULK_CAT, BULK_RIGHTS=false, renderUpload().
2. window.afterRender.upload (:994): before renderUpload(), if !BULK_RUNNING and
   (BULK_SUMMARY || every file done/duplicate) → same cleanup. Queued/error rows survive.
3. contributor-dashboard.js:134,:157: route('upload') → startNewUpload().
GUARD: BULK_RUNNING fully gates cleanup — mid-upload navigation must keep live progress.
PLUGIN: no contributor upload surface — state it.
VALIDATE: upload 2 files → success card; Upload more → clean, rights unchecked; sidebar
re-entry after finish → clean; mid-upload nav keeps progress; 1 done+1 dup+1 err → counts.

════════════════════════════════════════════════════════════════════════════════
SECTION C (P7) — avatars vanish; hardening
════════════════════════════════════════════════════════════════════════════════
1. PLUGIN empty-circle bug: AssetFlow_Plugin.html afApplyAvatar (~:8967) clears the initial
   THEN sets background-image with no failure handler. Fix with preload:
   const img=new Image(); img.onload=()=>{set bg on acc + .ai-ava/.hd-ava/.af-tb-ava};
   img.onerror=()=>{restore initials (textContent=initial, bg='')}; img.src=url;
   Initials are the immediate state while loading. Keep __afAvaBust.
2. WEB+STUDIO avatar fallback: every avatar render (platform account chip/account screen,
   studio sidebar user-chip contributor+admin, admin topbar) gets initials-behind +
   onerror-hide for <img>, or the Image() preload for background-image variants. One tiny
   helper per codebase; no redesign.
3. SERVER (apps/api/src/routes/auth.ts:767): avatar 302 Cache-Control private,max-age=300 →
   private,max-age=1800 (sign TTL is 3600 — safe half). Nothing else in the route.
4. ADMIN shell: <link rel="preload" as="font" type="font/woff2" crossorigin> for the three
   Phosphor woff2 files (styles/admin.css:49-51 paths). Report if the deployed
   /assets/fonts path 404s in scripts/prepare-cf-pages.mjs copies.
VALIDATE: devtools offline → initials everywhere (plugin included), no broken-img glyphs;
online reload → photos. node --check + install-cep.sh.

════════════════════════════════════════════════════════════════════════════════
SECTION D (P8) — every catalog card shows "Ae"; type-aware badges
════════════════════════════════════════════════════════════════════════════════
Badge table (label + dot hex):
  video-templates → app badge as today (Ae/Pr/Mn/Dr from templateApp + app color)
  motion-graphics → 'Motion' #5CC8B0 · graphics → 'Graphic' #7CC4FF · luts → 'LUT' #FFB27C
  music → 'Music' #F0907F · sfx → 'SFX' #E5C07B · ai-stock → 'AI' #C2F04A
1. WEB platform/index.html mapCatalogItems (~:18963): compute a/ac via helper typeBadge(it):
   (it.type||'video-templates')==='video-templates' → current APP_L/APP_C logic; else table.
   Cards already read t.a/t.ac (5 templates) — no markup change. Route the DETAIL view +
   lightbox meta app label through the same helper.
2. PLUGIN AssetFlow_Plugin.html: add the same mapping beside FF_APPS (:5100) with mirror
   comment; card renderer (:7212) + detail (:5204,:5531,:5967) branch on templateType/nav:
   stock types → type badge; video-templates → ffAppInfo. Scope the LUTs→DaVinci hint
   (:5112) to the video-templates branch only so it stops hijacking LUT stock.
3. Display-only: do NOT touch _browseParams/pillTypes/filters.
VALIDATE: /stock All: AE template "Ae", motion graphics "Motion", AI stock "AI" lime;
detail matches card; plugin Browse same; import flow unchanged.

════════════════════════════════════════════════════════════════════════════════
SECTION E (P10) — hover-preview freezes on a frame instead of returning to poster
════════════════════════════════════════════════════════════════════════════════
platform/index.html installMediaFx() mouseleave (:18685-18688) does pause()+currentTime=0 —
a <video> never shows its poster again after loading data. FIX:
  try { vid.pause();
    if (vid.getAttribute('data-src')) vid.removeAttribute('src'); // lazy variant
    vid.load(); // Uzbek comment: load() posterni qaytaradi
  } catch(e){}
data-src variant re-sets src on next hover (:18680-18681 — verified). Direct-src gen cards:
load() alone restores poster. Test rapid in/out hover (mouseenter after load() must still
play). Detail-page main player and audio cards unaffected (handler binds .va-hovplay only).
PLUGIN: grep for hover play/pause on card videos; same reset if the pattern exists, else
state "static thumbs only".
VALIDATE: hover→plays; leave→poster (not dark frame); 5× rapid hover → no stuck card.

════════════════════════════════════════════════════════════════════════════════
SECTION F (P16) — lightbox media too small; clunky IMAGE/VIDEO tag; Uzbek UI strings
════════════════════════════════════════════════════════════════════════════════
1. platform/index.html CSS: .va-lb-shell (:15639) max-width:1400px → min(96vw,1880px);
   .va-lb-stage (:15640) padding 24px → 12px; .va-lb-el (:15641) max-height 88vh → 90vh.
   Verify arrows/✕ don't overlap media; portrait 9:16 fits; .va-lb-aud still centers.
2. Remove the .va-lb-tag overlay (:15644 + its markup) from the lightbox entirely (details
   panel already shows type). Grid cards: replace the text chip with a 22×22 icon-only tile
   (rgba(0,0,0,.45)+blur, inline-sprite image/play glyph, top-left) — one class, all card
   variants (library grid, session strip, projects).
3. "Rasm yaratish · 1/9" and friends: grep platform + studio js for Uzbek UI literals
   (:18098,:18139,:18145 "Video yaratish"/"Rasm yaratish"; also "yaratish","yuklab",
   "sozlamalar" etc. in USER-FACING strings) → English ("Image generation", "Video
   generation" by mode). Code comments stay Uzbek. Report every replacement.
PLUGIN: same treatment for its gen gallery/lightbox tags and any Uzbek UI strings.
VALIDATE: 16:9/9:16/1:1/audio lightbox bigger + clean; grep -i "rasm yaratish" in UI = 0.

════════════════════════════════════════════════════════════════════════════════
SECTION G (P25) — 🔴 PRIVACY: session-expiry/login leave previous user's state behind
════════════════════════════════════════════════════════════════════════════════
platform/index.html: logout (:19451) resets ~27 keys; ff-auth-expired handler (:18470-18477)
resets only 5; _afterLoginSuccess (~:19361) also partial. Leftovers include refImages/
refVideos/refAudios/refStartUrl/refEndUrl, sessions, sessGens, projects, projOpen,
curSessId, plan, downloadsMonth, selModel, genModels — the NEXT user on a shared computer
can see the previous user's reference images and data.
FIX: extract ONE resetUserState() returning the FULL reset patch (superset of the logout
list — diff the three call sites and unify), call it from logout, account-delete (:19480),
ff-auth-expired, and _afterLoginSuccess (before applying the new user). Also clear the
sessionStorage caches if Section/other features added any (grep ff_ keys; per-user keys may
stay — they're keyed by userId).
PLUGIN: verify its logout (afLogout/AssetFlowAccount.logout) clears account-scoped state +
prefs; fix gaps the same way.
VALIDATE: login as user A → add 2 refs, open a session → force ff-auth-expired (delete
token, trigger 401 w/ TOKEN_EXPIRED) → login as user B → composer refs EMPTY, sessions/
projects/gens empty until B's own load; plugin same.

════════════════════════════════════════════════════════════════════════════════
SECTION H (P34) — housekeeping batch (small, safe)
════════════════════════════════════════════════════════════════════════════════
1. scripts/prepare-cf-pages.mjs: add cache-busting to CSS references (same mechanism the js
   files use, :103-139) so deploys don't serve stale CSS.
2. ui.js toast stack: cap visible toasts at 3 (oldest collapses) (~:83-95).
3. Mention dropdown (platform/index.html ~:19887): route interpolated values through the
   existing esc/escapeAttr helper (currently only URL-quote escaping).
4. Plugin temp growth: prune old extraction dirs (assetflow_mogrt_*, extract_*) older than
   14 days at boot (assetflow-catalog.js:635 / local-store.js:544 areas) — fire-and-forget,
   errors ignored.
5. Studio messages: after sending a reply, re-sort the thread list so the replied thread
   moves to top (admin-views2.js:983-986).
6. admin-views.js:208-213 shadowed legacy timeline: esc() its interpolations (or delete the
   dead block if provably unreachable — state which).
VALIDATE: node --check on all touched js; npm run studio:sync; quick smoke of toasts,
messages reorder, mention dropdown with a name containing <b>test</b>.

════════════════════════════════════════════════════════════════════════════════
FINAL
- Run `npm run studio:sync` once; `bash plugins/after-effects-cep/scripts/install-cep.sh`
  once (if plugin touched); node --check on every edited js file.
- 8 commits (or fewer if a section was skipped) — do NOT push.
- Summary: per section — done/skipped, root cause confirmed, plugin verdict, and the
  Section A audit findings + Section F Uzbek-string replacement list.
```

---

**Model:** Sonnet 5. Sessiya uzun — Code kontekst yetmay qolsa, qolgan bo'limlarni alohida
sessiyada "SECTION X'dan davom et" deb bering (har bo'lim o'zi self-contained).
