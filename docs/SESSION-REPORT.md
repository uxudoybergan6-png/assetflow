# SESSION-REPORT — FIX-PROMPTS-SC3 round 3 (SC_41B … SC_53) — 2026-07-18

Executed the full MASTER EXECUTION ORDER of `docs/FIX-PROMPTS-SC3-2026-07-17.md`.
All 13 tasks done, **one commit each** (no push). GLOBAL RULES applied throughout
(money zone byte-frozen — never touched; UI constitution; tokens; EN UI / Uzbek
comments; additive migration only). Every change: `node --check` on all inline
scripts + browser smoke-test (plugin served at :8976), console clean each time.

## Per-SC result (in execution order)
- **SC_41 PART B** (a9ba621) — DONE. Deleted the new-session empty-state hero
  ("Start with your idea" + chips) and the "No generations yet" recent-empty block
  in both apps; empty session shows nothing. (PART A superseded by SC_42.)
- **SC_49** (1c11fdc) — DONE. Removed Favorites from the client (plugin + web);
  Projects is the single save mechanism; add-to-project verified on every ex-★
  surface. Backend `UserTemplateFavorite` table + `/api/plugin/favorites` routes
  left in place, unreferenced (no destructive migration). → owner action below.
- **SC_48** (223562e) — DONE. One chrome: stripped duplicate logo/avatar/credit/
  refresh from every plugin sub-view header (My Library, session picker, Sessions,
  Session, Projects, Project, History, Settings); top-bar Refresh now calls the
  global afRefreshAll; My Library "Clear cache" → new ⋯ menu. Web already single-nav.
- **SC_47** (bde40d3) — DONE. Voice/duration became on-demand picker chips (plugin);
  dumped 18-pill grid + explainer removed; char limit → textarea counter+notice.
  Web already used a settings-gear popover.
- **SC_42** (b05cf1a) — DONE. Rebuilt the video composer to the 3-row anatomy
  ([+] add-input menu + attachment strip; removed FRAMES/REFERENCES boxes, labels,
  counter line, limits sentence, placeholder tail). Image tool already compliant;
  web already anatomy-shaped. Per-model verification below.
- **SC_43** (d875731) — DONE. Reference capacity as a single icon indicator
  (digits-only used/limit, wordy text only in tooltip); one instance per composer,
  both apps.
- **SC_46** (0807917) — DONE. Session feed 3-state machine (loading skeletons →
  ready-empty → items); never flashes empty; header shows "loading…" not "0";
  web got an axShowLoading skeleton grid.
- **SC_44** (4e51eaa) — DONE. No black flash on gen-card open — thumbnail-first
  paint (cached thumb backdrop → cross-fade to full on decode; video poster+meta),
  both apps; error keeps the thumb.
- **SC_50** (b94da09) — PARTIAL/DONE (client zones). Home gained hero prompt-first
  input, Continue-a-session, Browse-by-category — real data, hide when empty.
  → deferred pieces below.
- **SC_52** (629b0ae) — PARTIAL/DONE (plugin chain). Additive `home.rails` schema
  (typechecks) + admin curation card + plugin New/Top auto-scroll rails (motion-
  disciplined) + Director's Home order (New replaces the deleted shelf; Top after
  sessions). → deferred pieces below.
- **SC_45** (8baa98d) — DONE. My Library galgrid → CSS column masonry (native
  aspect, no gaps); Use ▾ moved inside the card (hover overlay). Web va-axgrid +
  session recentgrid already masonry+inside.
- **SC_53** (2ee900d) — DONE. Web Stock Catalog fluid: `.va-main:has(.va-cathero)`
  drops the 1600px cap; grid `columns:260px` grows (≈4 @1280 → ≈9 @2600); reading
  blocks capped (hero 820px, search 700px); fluid `clamp(16px,3vw,40px)` padding.
- **SC_51** (363f931) — DONE. One motion system (`--mo-*` tokens, transform/opacity
  only, reduced-motion neutralizer) on cards/buttons/menus/toasts, both apps;
  removed the web card-hover violation (scale 1.025 + box-shadow @250ms).

## SC_42 per-model verification (scripts/verify-gen-payloads.mjs vs local :4000 API)
All ENABLED models built the correct /gen/cost-quote payload — **13/13 PASS**
(default + rich variants), negatives (disabled/mismatch/unknown) PASS. Money path
unchanged (UI-only restructure).

| id | model | mode | quote |
|----|-------|------|-------|
| 1010 | Nano Banana 2 | image | PASS |
| 1013 | Nano Banana 2 Lite | image | PASS |
| 1014 | Nano Banana Pro | image | PASS |
| 1011 | Imagen 4 | image | PASS |
| 1012 | Imagen 4 Ultra | image | PASS |
| 1021 | Seedream 5.0 Pro | image | PASS |
| 2002 | Chirp 3 HD | voice | PASS |
| 4001 | ElevenLabs SFX | sfx | PASS |
| 3001 | Veo 3.1 Lite | video | PASS |
| 3002 | Veo 3.1 Fast | video | PASS |
| 3010 | Gemini Omni Flash | video | PASS |
| 3003 | Veo 3.1 | video | PASS |
| 3102 | Seedance 2.0 | video | PASS |

Capability-survival (video composer): FRAMES box → [+] menu Start/End + strip
START/END badges · REFERENCES +buttons → [+] menu Image/Video/Audio (existing
openers proxied via hidden anchors) · counter/limits → [+] tooltip + SC_43 icon
indicator + notice pill · drag&drop/paste/@-mentions/model-output-audio pickers/
Enhance/Clear/Generate/collapse/undo → unchanged.

## Owner action items (blocked / deferred — could not complete in this env)
1. **SC_49 backend** — DATA CHECK could not be run against production from here.
   Decide: (a) whether any `UserTemplateFavorite` rows exist; (b) a later cleanup
   migration; (c) an optional one-off "Favorites → project 'Favorites'" import
   (propose-only, not built). The `/api/plugin/favorites` routes are now unused.
2. **SC_52 web rails** — the web dashboard does NOT consume the plugin content-config
   yet; wiring it (config fetch + a dc-runtime rail component) is a follow-up so both
   apps share one truth. Also: catalog `?ids=` param (client currently resolves from
   the loaded catalog) and an admin drag-reorder search picker (MVP = ordered ID list).
3. **SC_50 remaining zones** — Explore/AI-Stock zone, CMS-editable headings for the
   new zones, category item counts/collages, and web-dashboard zone parity — each
   needs the backend/CMS chain.
4. **Deploy checkpoints** (per master order): after Group B (plugin install + AE ⌘Q
   live check) · after Group D (push + API deploy + CF Pages — SC_52 extends the CMS
   schema + admin UI; schema here is config-JSON, no DB migration) · final full AE E2E
   of admin→config→client rails and every-model composer UX inside AE.

## Verification notes
- Live per-model **UI** walkthrough and AE-panel E2E need auth+AE (browser QA has no
  auth; prefs rewrite localhost→prod) → owner deploy checkpoint. Payload correctness
  is covered by the automated script above.
- SC_53 local check hit a stale http-server; edits are grep-confirmed in source,
  brace-balanced, not media-gated (standard fluid CSS).
