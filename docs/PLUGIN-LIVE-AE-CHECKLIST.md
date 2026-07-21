# FrameFlow plugin — LIVE After Effects test checklist (SC_56 PART C)

Run this **inside real After Effects** after a full relaunch. It is the last gate before
sign-off: it exercises the paths that a browser cep-mode QA cannot (real CEP host calls,
AE import, panel docking/resize). Each step lists **what to click**, **what "pass" looks
like**, and **what to screenshot if it fails**.

Legend for the last column:
- **[BROWSER-OK]** — already verified in browser cep-mode QA (SC_41…SC_56); re-confirm only
  if it looks wrong.
- **[AE-ONLY]** — can only be verified inside real After Effects; this run is the first real test.

Seed subscriber: **user@assetflow.uz / user123**. API: production (or `npm run studio` :4000
if testing local). Themes to spot-check where noted: **noir · neon · cold**.

---

## 0. Install & launch
1. From a terminal: `bash plugins/after-effects-cep/scripts/install-cep.sh`. **Pass:** prints
   `✓ Fayl o'rnatildi … com.frameflow`. **[AE-ONLY]**
2. **Quit After Effects fully (Cmd+Q)**, reopen, then `Window ▸ Extensions ▸ FrameFlow`.
   **Pass:** the panel opens with no red error box; the guest state (⚡ + "FrameFlow" +
   "Sign in") or the last signed-in Home renders. **Screenshot on fail:** the whole panel +
   AE `Window ▸ Extensions` menu. **[AE-ONLY]**

## 1. Sign in
3. Click **Sign in** → complete the Google device-code / email flow. **Pass:** panel swaps to
   the logged-in top bar (⚡ logo · Home/AI/Stock segment · ✦ credits · avatar) — exactly
   **one** logo and **one** avatar on screen. **Screenshot on fail:** top bar. **[AE-ONLY]** auth,
   **[BROWSER-OK]** one-chrome layout.

## 2. Navigation tabs (top bar segment)
4. Click **Home**, **AI**, **Stock** in turn. **Pass:** each view switches; the top bar stays
   put (no second bar appears, no duplicate logo/avatar/refresh in any sub-view). **[BROWSER-OK]**
5. Credit chip → **Top up** opens; avatar → **Account** sheet opens. **Pass:** both open and
   close (Esc/outside click). **[BROWSER-OK]**

## 3. Home — every zone (SC_50/SC_52/SC_56)
6. On **Home**, confirm the zones in order, each hidden when it has no data:
   hero (with the one-line prompt input) → **New releases** rail → Jump back in → Continue a
   session → **Top templates** rail → **Explore** (curated AI-Stock row, SC_56) → Browse by
   category. **Pass:** zones with data render; empty zones are simply absent (no placeholder
   art, no "No items"). **Screenshot on fail:** full Home scroll. **[BROWSER-OK]** structure —
   but confirm the **Explore** row shows real AI-Stock cards here (needs published AI-Stock in
   the connected environment). **[AE-ONLY]** for real-data population.
7. Rails **auto-scroll** slowly in opposite directions and **pause on hover**. **Pass:** smooth,
   no jank; pause works. **[BROWSER-OK]**
8. **Browse by category** tiles: 6 tiles (Video Templates · Motion Graphics · Graphics · LUTs ·
   Music · SFX). Numbers are intentionally omitted (catalog API exposes no per-category totals).
   Click one → lands in the pre-filtered catalog. **[BROWSER-OK]**
9. **Hero prompt:** type a line, press Enter (or ✦). **Pass:** opens AI Tools in a NEW session
   with the text pre-filled and **no credits spent** (Generate not auto-fired). **[BROWSER-OK]**

## 4. Panel resize (SC_54/SC_55/SC_56 ⋯ overflow)
10. Drag the AE panel from **wide → narrow (~320px) and back**, on each of image/video/audio
    composers, across **noir/neon/cold**. **Pass at every width:** the composer control row is
    **exactly one row**; nothing wraps or clips; **Generate + its cost tag** and **Enhance ✦1**
    always fully visible. As it narrows, secondary controls (output → audio → Clear → mode →
    model) collapse into a **⋯ button left of Enhance** — click it and confirm the moved controls
    are all there and **still work** (open the model picker from inside ⋯ → the ⋯ stays open).
    **Nothing is ever hidden/unreachable.** **Screenshot on fail:** the composer at the failing
    width + which control is missing/clipped. **[BROWSER-OK]** mechanics; **[AE-ONLY]** live drag-resize
    smoothness inside CEF.
11. Whole panel **fills its height** at any size (no dead black band below content). **[BROWSER-OK]**

## 5. Create a session + generate one cheap item per mode
12. **AI ▸ + New session.** **Pass:** empty session shows a plain feed area (no hero, no "No
    generations yet" — SC_41 removed those). **[BROWSER-OK]**
13. **Image:** short prompt → **Generate**. **Pass:** cost is debited once, a card appears in the
    feed, and the completion toast fires. **Screenshot on fail:** composer + feed + console.
    **[AE-ONLY]** (real generation + credits).
14. **Video:** switch mode → pick a video model → Generate a short clip. **Pass:** same as above;
    the model-aware controls (resolution/duration/audio) match the model. **[AE-ONLY]**
15. **Audio (Voice / SFX):** the voice picker is behind **one chip** (SC_47) — open it, pick a
    voice, type text, Generate. **Pass:** audio card appears + toast. **[AE-ONLY]**

## 6. Open a gen + Import to AE ← the one step that TRULY needs AE
16. Click a finished gen card. **Pass:** opens the viewer **with the media visible immediately —
    no black flash** (SC_44). **[BROWSER-OK]** perceptual; re-confirm in AE.
17. In the viewer / **Use ▾** menu → **Import**. **Pass:** the comp/footage **lands in the active
    After Effects composition** (this is the real CEP host round-trip). **Screenshot on fail:** the
    AE timeline + the FrameFlow toast/error. **[AE-ONLY] — the critical test.**
18. Walk every **Use ▾** action (Import · Add to project · Download · Copy prompt · Restore/regen ·
    Add to Explore · Reference where offered). **Pass:** each does its thing without a console
    error. **[AE-ONLY]** for Import/Reference (host calls); **[BROWSER-OK]** for the rest.

## 7. Stock template → AE
19. **Stock**: search, tap a category pill, open a template detail, click **Import**. **Pass:** the
    template pack downloads and imports into AE (footage/comp appears). **Screenshot on fail:** AE
    project panel + toast. **[AE-ONLY].**
20. On template detail, **Add to project** works; there is **no ★ favorite** control anywhere
    (SC_49 removed it). **[BROWSER-OK]**

## 8. My Library / Projects
21. **My Library:** mixed-aspect cards pack with no dead gaps (masonry, SC_45); the **Use ▾** sits
    **inside** the card. **[BROWSER-OK]**
22. **Projects:** select mode → bulk delete a test project. **Pass:** confirm dialog, then removal.
    **[BROWSER-OK]** (avoid deleting real data).

## 9. Themes + sign out/in
23. **Account ▸ theme:** switch **noir → neon → cold**. **Pass:** all surfaces recolor via tokens
    (no hardcoded colors, prices/credits stay legible). **[BROWSER-OK]**
24. **Account ▸ Sign out**, then sign back in. **Pass:** returns to guest, then restores the
    logged-in state cleanly. **[AE-ONLY]** auth round-trip.

---

### If anything fails
Capture: (1) the panel screenshot at the failing state, (2) the CEP console
(`Debug ▸ CEF remote debugging` or the panel's own console) errors, (3) the exact width/theme/
model in play. File against SC_56 PART B (surface audit) with that evidence.

*Generated for SC_56. Steps marked [BROWSER-OK] were verified in browser cep-mode across
SC_41…SC_56; steps marked [AE-ONLY] are first verified in this live run.*
