# FrameFlow — Stock Expansion Plan (contributor Stock + Motion-Elements-style upload)

> 2026-07-10 · USER decision: FrameFlow expands from a Template-only marketplace to also accept
> **contributor Stock** (Video · Music · Sound FX · Photo), AND still ingest Stock via API
> (Artlist/Shutterstock) later. The contributor "Add product" upload becomes a Motion-Elements-style
> grouped **kind picker**. This is a MULTI-PHASE build — do it phase by phase, each its own Code prompt.
> Money-zone stays byte-for-byte; migrations additive only.

## Product kinds (what the picker offers)

- **Template** (existing): After Effects · Premiere Pro · Apple Motion · DaVinci Resolve.
  - broad **Type**: Video Templates · Motion Graphics · Graphics · LUTs (the 4 web pills).
  - granular **Category**: `TEMPLATE_CATEGORIES` (Titles, Transitions, Logo Reveal, …).
- **Stock** (new, contributor-uploaded): Video · Music · Sound FX · Photo.
  - stock **Category/tags** per media type (AI-assisted).
- **Prompt** (deferred — not now).

## Data model (additive on `ContributorTemplate`; table name kept for now — additive is safer than rename)

- `kind        String  @default("template")`  — `template` | `stock`
- `stockType   String?`                        — `video` | `music` | `sfx` | `photo` (null for templates)
- `templateType String @default("video-templates")` — `video-templates` | `motion-graphics` | `graphics` | `luts`
- (existing: `templateApp` ae/pr/motion/resolve, `cat`/`catLabel`, `nav`, `metaJson`, …)

## Accepted file formats per selection (picker drives the upload accept + validation)

- Template · After Effects → `.aep`, `.ffx`, `.zip` · Premiere Pro → `.mogrt`, `.zip` · Apple Motion →
  `.motn`, `.zip` · DaVinci Resolve → `.drfx`, `.setting`, `.zip`
- Stock · Video → `.mp4`, `.mov` · Music → `.wav`, `.mp3`, `.aiff` · Sound FX → `.wav`, `.aiff` ·
  Photo → `.jpg`, `.png`, `.webp`
- (Each product = one zip/file; the picker shows the accepted extensions inline, Motion-Elements-style.)

## Phases (each = one Code prompt, done in order)

- **S1 — Upload kind-picker + data-model foundation.** Motion-Elements-style grouped picker (Stock +
  Template) as the first upload step; drives kind/subtype/app + accepted formats + which Step-1 fields
  show. Add the 3 additive columns + migration. Fold in the broad **Type** (template branch) and align the
  granular `CATS` to `TEMPLATE_CATEGORIES`. Stock products can be created (PENDING) with their media file
  stored; full stock processing = S2. → this is batch problem **#10**.
- **S2 — Stock ingest pipeline (per type).** Validate + generate preview/waveform/thumbnail + AI metadata
  + malware scan + moderation → PENDING → admin approve, for each stock type.
- **S3 — Web catalog Stock surfaces.** A Stock browse area (video player, audio waveform play, photo grid)
  with filters; integrate with / sit alongside Templates.
- **S4 — Plugin Stock surfaces.** Browse + import stock in AE (music/SFX to timeline, video/photo as
  footage), model/app-aware.
- **S5 — Licensing / payout / pricing.** Contributor Agreement + **Release Forms** (model/property
  releases — legal, needs lawyer), stock pricing, stock payout. ⚠️ legal.
- **S6 — API stock (Artlist/Shutterstock).** Merge API-sourced stock with contributor stock into one
  catalog (see the stock-API research: Artlist Enterprise / Shutterstock Platform License).

## Related batch problems
- **#3** web pills filter by `templateType`; **#4** granular Categories multi-select. Both = Template
  branch, and depend on S1's fields. Order: **S1 (#10) → #3 → #4**.
