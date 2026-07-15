# V2 MEDIUM-1 — COMBINED (AI Studio composer + picker UX) — 2026-07-14

> MEDIUM blokining BIRINCHI to'plami: P14 → P19 → P15 → P18 → P12 → P13.
> Hammasi AI Studio composer/picker sirtida (web + plugin) — tartib MUHIM (P14 Esc qatlamini
> o'rnatadi, P19/P15 unga tayanadi; P18 chip-gate keyingi HIGH jonli-test P24 uchun ZARUR).
> Model: **Sonnet 5** (P13'da gen-models.ts pul-tutash — diff-tekshiruv bilan).
> To'liq diagnoz: `docs/MUAMMOLAR V2-2026-07-13.md` (P14, P19, P15, P18, P12, P13).

---

```
CONTEXT
Repo: ~/Projects/creative-tools-saas (FrameFlow). SIX composer/picker UX fixes in ONE session,
order A→F. COMMIT AFTER EACH ("V2-MED1 <letter>: <short>", no Co-Authored-By; do NOT push).
Skip+note+continue on conflict. ORDER MATTERS: A(P14) installs the popover-close mechanism
that D-shape helpers reuse; B(P19)/C(P15) integrate with A's one-layer-Esc.

SOURCES
- Web platform: packages/assetflow-studio/platform/index.html (DIRECT; custom sc- runtime =
  React under the hood; popover flags in this.state). Plugin:
  plugins/after-effects-cep/AssetFlow_Plugin.html (own composer chips/pickers).
- Server (D-shape only, section F): apps/api/src/lib/gen-models.ts + /gen/models serializer.

🔴 MONEY ZONE FROZEN. Section F only ADDS display metadata to gen-models.ts — cost lines
byte-identical (verify with a /gen/models JSON diff minus the new field). Do NOT renumber @N
tokens (P18). Migrations NONE. English UI; Uzbek comments. Minimal diffs.
⚠️ Uncommitted BATCH6/8 in platform/plugin → checkpoint first, report.
PLUGIN PARITY: every section fixes BOTH clients (owner directive) — state the verdict.

════════════════════════════════════════════════════════════════════════════════
SECTION A (P14) — popovers/dropdowns must close on OUTSIDE CLICK + ESC, everywhere
════════════════════════════════════════════════════════════════════════════════
ROOT: no document-level outside-click handler exists; Esc handler (:18506-18512) covers only
megaOpen/lightbox/refLibPick/chipPop. Uncovered: modelOpen, modelModalOpen, fbarPop, sortOpen,
useMenuOpen, appMenuOpen, avatarOpen, navOpen.
FIX (web):
1. POPS = { chipPop:null, modelOpen:false, fbarPop:null, sortOpen:false, useMenuOpen:false,
   appMenuOpen:false, avatarOpen:false, refSrcK:null }. (modelModalOpen + lightbox are MODALS:
   Esc yes, outside-click only via their existing backdrop.)
2. OUTSIDE CLICK: one document 'mousedown' (capture) installed once at boot — if no popover
   flag truthy, no-op; else if target not inside [data-pop-root] → setState(POPS). Mark every
   popover panel AND its trigger with data-pop-root (composer chips, model quick list, filter
   labels, sort dropdown, avatar/app menus). In-panel interactions (multi-select ticks) stay.
3. ESC: extend the keydown handler — BEFORE its current checks, if any POPS flag truthy →
   close them all + return (one layer). Keep megaOpen→lightbox→refLibPick→chipPop order after.
   modelModalOpen: Esc-close (return before lightbox handling).
4. PICK-TO-CLOSE: single-select handlers already close — verify each; multi-select filter
   popovers (fApps/fCats :21766-21769) INTENTIONALLY stay open on tick — keep; outside-click/
   Esc closes them.
PLUGIN: apply the same trio (outside-click via document mousedown + data-pop-root, Esc,
pick-to-close) to its composer chips/pickers (BATCH5 ⚙ chip, model picker, edit-preset chips).
Reuse its state/flags, no redesign. install-cep.sh.
VALIDATE: open model list → click empty canvas → closes; reopen → Esc → closes; multi-select
filter (tick 2 apps stays open) → click outside → closes filters applied; sort/avatar/app/⚙
same; Choose-a-model sheet Esc + backdrop close; Esc peels ONE layer (popover before
lightbox); model-sheet search typing unaffected. Plugin same in AE.

════════════════════════════════════════════════════════════════════════════════
SECTION B (P19) — "Use ▾" menu opens in the WRONG place / split across columns
════════════════════════════════════════════════════════════════════════════════
ROOT: .va-axmenu (CSS :15683) is position:absolute inside a CSS multicol cell
(.va-axgrid{columns} :15625, .va-axcell{position:relative} :15627) — Chrome positions/fragments
abs-pos descendants into other column boxes → menu next to wrong card / split. Mobile already
avoids this with position:fixed (:15836).
FIX (web):
1. toggleUseMenu: capture trigger rect (getBoundingClientRect), store {x:left, y:bottom,
   up:(bottom > innerHeight-420)} in state with useMenuOpen.
2. Render .va-axmenu position:fixed; left/top from stored rect, clamped (left=min(x,
   innerWidth-258); if up, open ABOVE: top=r.top-menuHeight). Bind inline style via the sc-
   runtime style pattern.
3. Close on scroll/resize while open (listener added on open, removed on close).
4. Keep the backdrop (.ffa-popbd :17030) + closeUseMenu + all items byte-identical; keep the
   mobile fixed-sheet (:15836) winning (apply coords only >640px).
5. Remove now-unused absolute coords in desktop .va-axmenu CSS.
PLUGIN: test if its result-card / My Library menu container is CSS-columns (grep columns:) with
abs-pos menu inside a cell → same fixed-position fix; if flex/grid, state so + leave.
VALIDATE: Use ▾ on cards in every column top+bottom → menu attached to ITS trigger, never
another column, never split; near bottom → flips up, fully visible; scroll → closes; all items
work (Edit handoff, i2v, Upscale x2/x4, Add to project, Delete); compact grid + 2-col + mobile
correct.

════════════════════════════════════════════════════════════════════════════════
SECTION C (P15) — composer balloons to full screen on long/Enhanced prompts
════════════════════════════════════════════════════════════════════════════════
ROOT: afSizePromptTa (:19797-19804) grows editor to min(scrollHeight, 60vh); chip-editor
variant sized by CSS max-height similarly oversized; a 300+ word Enhance result covers the
screen. Stale comment :21847 claims 240px (disagrees with code).
FIX (web):
1. Cap editor max-height ≈200px + overflow-y:auto. afSizePromptTa CAP=200; after programmatic
   sets (Enhance/restore/chip) scroll editor to TOP (user sees the beginning); while typing,
   browser keeps caret in view. Chip-editor CSS: same max-height + overflow-y:auto on
   .prompt.chipedit; verify pill wrapping + @mention dropdown anchors to caret/viewport (NOT
   clipped inside the scroll container) — test.
2. ⤢ expand toggle in dock top-right, visible ONLY when content taller than cap: toggles to
   60vh and back (transient). Esc collapses expanded first (integrate with A's one-layer-Esc).
3. Other dock rows unchanged; total dock ≤~70vh even expanded. Fix the stale :21847 comment.
PLUGIN: same cap (≈140px, narrower panel) + internal scroll + ⤢ on the AE composer chip-editor;
keep SD2-EDIT-PRESETS sync markers. install-cep.sh.
VALIDATE: paste 500-word prompt → editor stops at cap, scrolls internally, gallery visible; ⤢
expands/collapses; Esc collapses expanded; Enhance → shows TOP of new text; chip pills +
@mention work inside scrolled editor; ⌘Z undo intact. Plugin same at ~360px.

════════════════════════════════════════════════════════════════════════════════
SECTION D (P18) — black reference tiles + preset chips leak onto Gemini Omni [enables P24]
════════════════════════════════════════════════════════════════════════════════
ROOT: video ref tiles get null poster by design (:19826 map(()=>null), :19865 thumb:null,
glyph '▶') → near-black tile. Preset chips (:16972 "≥1 VIDEO ref" gate; templates :17570-17574)
show for ANY model with a video ref — including Gemini Omni Flash — but were written for
Seedance/Dreamina.
FIX:
1. VIDEO ref tiles: real first-frame preview <video muted playsinline preload="metadata"
   src="<refUrl>"> + small ▶ overlay. IMAGE ref tiles: onerror → glyph + amber ring (P9
   fixed expiry at root; this is the display fallback). Label/✕/drag/paste unchanged. (Mention
   dropdown list may stay glyph-only; the COMPOSER TILE must show the frame.)
2. Gate preset chips by MODEL: show ONLY when the selected model is the Seedance/Seedance
   (Dreamina) edit family (identify by model id prefix from the live genModels list — do NOT
   hardcode display names) AND ≥1 video ref. Gemini Omni + others: chips hidden. Update the
   SD2-EDIT-PRESETS comment to document the gate.
PLUGIN: same two fixes in the AE composer (ref tiles + the SD2-EDIT-PRESETS chips model gate);
the two chip copies are manually synced (marker :17570) — keep them IDENTICAL, note sync in
both. install-cep.sh.
VALIDATE: attach video ref → tile shows first frame + ▶, ✕ works, @Video 1 pill intact; broken
image URL → glyph+amber, no black box; Seedance + video ref → chips visible; Gemini Omni +
video ref → chips GONE; chip insert still writes the template on Seedance; @mention tokens
unchanged on model switch. Plugin same.

════════════════════════════════════════════════════════════════════════════════
SECTION E (P12) — pin/unpin gen models + persist last-used composer params (not prompt)
════════════════════════════════════════════════════════════════════════════════
FIX 1 — pin/unpin (both clients): localStorage ff_gen_pins:<userId> = { <mode>:[modelId,…] }
(plugin: same shape in its prefs). Picker: a pin icon per model row (right side, near price),
click toggles pin WITHOUT selecting (stopPropagation); pinned rows sort to top (pin time,
newest first) with a subtle pinned state. Pins referencing models no longer in the server list
are dropped on load. Web rows :16992 + :17047 share one pin handler; plugin picker its own row
renderer (inline SVG icon).
FIX 2 — persist composer params (both clients): localStorage ff_gen_prefs:<userId> = {
selModel(mode→modelId), aspect/resolution per mode, aiTool, enhance on/off, plugin chip
equivalents }. EXCLUDE prompt text, references, session id. Save debounced (300ms) on relevant
setState (pickModel, size/aspect, tool switch, enhance toggle) — one helper. Restore on boot
AFTER genModels load: validate each saved modelId against the live list (invalid→default
list[0]); restore aspect/res through the SAME clamp pickModel uses (:19507). Logout/account-
delete: clear both keys (integrate with resetUserState from P25). ff-auth-expired: keep keys.
🔴 Money-safe: persistence restores SELECTION only; the quote flow re-prices as usual.
PLUGIN: same via its loadUserPrefs mechanism. install-cep.sh.
VALIDATE: pick model B/9:16/2K/Enhance-off → refresh → same, EMPTY prompt, cost re-quotes; pin
2 → float to top, unpin works, refresh keeps pins; disable a pinned model server-side → pin
dropped silently; second user same browser → independent pins/prefs. Plugin same in AE.

════════════════════════════════════════════════════════════════════════════════
SECTION F (P13) — every gen model shows its own PROVIDER BRAND icon in the picker
════════════════════════════════════════════════════════════════════════════════
🔴 gen-models.ts is money-adjacent — ONLY add a display field; cost math byte-identical.
FIX:
1. SERVER gen-models.ts: add optional `brand` to each model entry (metadata by MODEL FAMILY,
   not transport): 'google' (Nano Banana*/Imagen*/Veo*/Chirp*/Gemini*), 'openai' (GPT Image*),
   'dreamina' (Seedream*/Seedance*), 'kling' (Kling*), 'elevenlabs', 'topaz', 'krea',
   'artlist'; unmapped → omit. Include brand in the /gen/models serializer.
2. ICON SET (both clients, INLINE SVG): one shared sprite of small monochrome brand marks
   (~20px, currentColor). Accuracy rule: faithful mark where drawable precisely (Google G,
   OpenAI knot); else a clean LETTERMARK tile (brand initial, rounded square, brand accent) —
   NEVER ship a wrong/mangled logo. Fallback (no brand) → today's mode tile.
3. WEB: brand icon left of each model row in BOTH pickers (:16992 quick, :17047 sheet) + the
   collapsed model chip. Row height unchanged.
4. PLUGIN: same icons inline in its picker rows + collapsed chip; no external requests (verify
   no <img src="http…">). install-cep.sh.
5. THEMING: work in all 3 themes (currentColor/theme vars; lettermark accent = brand hex with
   contrast on dark).
VALIDATE: every model row shows a brand mark/lettermark; unknown → mode-tile fallback;
/gen/models response includes brand with costs byte-identical (diff JSON minus brand); plugin
matches, AE offline still renders icons; legible in noir/neon/cold.

════════════════════════════════════════════════════════════════════════════════
FINAL
- node --check every edited js; `npm run build -w apps/api` (Section F); studio:sync if studio
  js touched; install-cep.sh (plugin touched every section).
- Up to 6 commits — do NOT push.
- Summary: per section done/skipped + root + PLUGIN verdict; Section F: confirm /gen/models
  cost lines byte-identical (JSON diff).
```

---

**Model:** Sonnet 5. Bergач: **MEDIUM-2** (`V2-MEDIUM-2-COMBINED-PROMPT`) — barqarorlik+ishonch+admin.
