# SESSION-REPORT — FIX-PROMPTS-SC2 round 2 (2026-07-17 → 18)

Executed all 15 remaining SC2 tasks in the Director's MASTER EXECUTION ORDER. One
commit per SC, no push, money zone frozen throughout. SC_29 was the pre-existing base.

## Per-SC results (one line each)

**Group A — functional correctness**
- **SC_40** `93c3963` — Session rename: inline ✎ (hover/focus) on picker + sessions list + web rail; reused `PATCH /gen/sessions/:id`, relaxed schema to accept null/empty title (revert to auto-name); optimistic update + rollback.
- **SC_28** `ebe44ff` — Sessions/Projects removed from top bar → Account-sheet WORKSPACE group (plugin); web top-bar Projects removed (avatar menu remains); seg stays pixel-centered.
- **SC_30** `d91eb4d` — Use ▾ menu action sweep (matrix below): audio Regenerate misroute hidden+guarded, delete confirms added (audio/session feeds), project-view "Remove from project" label, CEP-safe Copy-prompt toast; web Edit/i2v rows hidden for non-image, menu closes after delete.
- **SC_34** `0de2d90` — Projects select-mode + bulk delete both apps; Select all/Clear, armed confirm, per-item failure tolerance; used existing `DELETE /api/studio/projects/:id` (no new endpoint); non-cascade verified (items stay in My Library).
- **SC_37** `5ef6659` — Search verified/fixed: web ⌘K handler added + honest placeholder + scope copy + in-flight race fix; plugin Clear-search + server refetch + pending-queue (latest-wins).
- **SC_32** `bb8456a` — Plugin CMS chain: 2 code bugs fixed (editor MEDIA-UNREACHABLE fallback; plugin refresh throttle 300→270s so the 5-min tick isn't skipped). Root cause of owner's broken preview = **CDN worker not redeployed (owner deploy step)**.
- **SC_38** `54b294d` — Guest/login audit: expired-session return-to-screen (web), plugin boot double-fetch fix, device.html local-API fix, Copy-link contrast, guest plan copy corrected.

**Group B — the deep one**
- **SC_27** `485ec59` — Composer parity (plugin ← web) + per-model UX/payloads; plugin media-refs UI made live (Omni/Seedance +Img/+Vid/+Aud), video paste/drop, audio Enhance+Clear+credit gate; exact per-model params. Verification table below.

**Group C — layout system**
- **SC_26** `1555aa1` — Full-panel layout: removed the 640px `.axroot .app` island cap; feed uses responsive column-width (2→8 cols across 320→2500); composer capped 1160 centered.
- **SC_31** `9c8e6c6` — Full-height stock template detail: media scales up, Similar becomes a grid height-sink on tall panels (void ~60-70% → ~1-2%).
- **SC_33** `c9221e1` — Audio preview redesign: one token-based waveform player (killed lime/purple literals), fixed poster-as-waveform overflow at root, identical in plugin + web.
- **SC_25** `3994b66` — Narrow-panel fixes: credit chip never clips (grid `minmax(max-content,1fr)`), workspace avatar de-duped, audio-card Use button no overlap, disciplined 3-row composer; web `va-nav` same grid fix.
- **SC_35** `33f5599` — Live AE-panel resize: shared debounced resize handler re-runs virtualized grid + top-bar auto-fit + pill-strip; mid-width top-bar collision safety net; category pill row scroll-strip (no mid-word clip); **tech status bar removed** → quiet Account-sheet footer.

**Group D — final passes**
- **SC_36** `5c31c90` — Progressive-disclosure pass: workspace 2nd bar → slim sub-row + ⋯ menu (all controls relocated, reachable); media-first card faces (caption + Use ▾ on hover/focus, keyboard too).
- **SC_39** `2867c96` — Dead-code purge: −34,217 bytes (1,166,188 → 1,131,971, −2.9%) of provably-orphan CSS (mf-*/ail- launcher, ai-history strip, axws-tools/density, #afFtr). Zero behaviour change.

## SC_30 — Use ▾ action verification matrix (I=image V=video A=audio)

| Action | Plugin I | Plugin V | Plugin A | Web I | Web V | Web A |
|---|---|---|---|---|---|---|
| Import to AE | PASS* | PASS* | PASS* | — | — | — |
| Add to project | PASS | PASS | PASS | PASS | PASS | via lightbox |
| Add to Explore | PASS† | PASS | PASS | PASS† | PASS | via lightbox |
| Use as reference | PASS | PASS | N-A (hidden) | PASS | FIXED→N-A | N-A |
| Regenerate | PASS | PASS | FIXED→N-A | PASS | PASS | PASS (lightbox) |
| Copy prompt | FIXED | FIXED | FIXED | PASS | PASS | via lightbox |
| Delete | PASS | PASS | FIXED | PASS+FIXED | PASS | PASS |
| Download (web) | — | — | — | PASS | PASS | via lightbox |

\* Import verified to last emulatable step (download + ExtendScript args); needs live-AE confirm.
† Explore full submit blocked locally by seed gens lacking R2 resultKey (NO_ASSET); prod path code-verified (idempotent, rights-gated, daily-capped).

## SC_27 — per-model payload verification (scripts/verify-gen-payloads.mjs, local :4000)

**26/26 quote checks PASS** (default + rich variant per model) + **3/3 documented negatives** (disabled 3101, mode mismatch, unknown model → 400), across all 13 enabled models:
image 1010/1013/1014/1011/1012/1021, voice 2002, sfx 4001, video 3001/3002/3010/3003/3102. Prices exact (e.g. 3102 = 32 base / 540 with the ×0.6 video-ref multiplier path). Live plugin POST /gen capture confirmed correct per-model fields (audio omitted where unsupported, aspect `auto` lowercase, ref fields only when refs present). Real gens done: image (NB2 Lite ✦2), voice (Chirp ✦4), audio-enhance ✦1; video (Veo Lite ✦24) reached provider submit then failed on the local env's missing GCS staging bucket — credits auto-refunded (refund path proven). No backend findings blocking.

## OWNER ACTION ITEMS (deploy / environment — no code change needed)

1. **CDN worker redeploy** (`cd workers/cdn-proxy && npx wrangler deploy`) — unblocks all `site/plugin/*` + `landing/*` CMS media in prod (SC_32 root cause of the broken hero preview). `isPublicReadKey()` is already correct in code.
2. **Storage bucket CORS** — add admin/localhost origins so browser presigned PUTs work in dev (SC_32).
3. **GCS staging bucket** in local dev env (`assetflow-uploads`) for full video gen e2e (SC_27); prod unaffected.
4. **Push + API deploy + prod migration** state (round-1 checkpoints) — the SC_40 null-clear rename 400s against the currently-deployed API until push+deploy; rename-to-nonempty works today.
5. **Live AE E2E** (owner, after Cmd+Q relaunch): resize-drag 320→2500, CMS edit → 5-min apply, one gen per mode with per-model controls, Import to AE (all kinds), rename/clear/cancel, bulk delete, search, sign-out/in.

## Kept-unsure (feeds next round)
SC_39 left ~540 interwoven orphan CSS classes (share grouped selectors with live classes) for a dedicated surgical prune. SC_36 flagged non-workspace `ai-hdr` avatars and a full budget-rule pass over Home/Catalog/Projects for a targeted follow-up.
