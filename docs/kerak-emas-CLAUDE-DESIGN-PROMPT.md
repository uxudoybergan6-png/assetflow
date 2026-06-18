# Claude Design prompt — AssetFlow plugin + AI Tools (Artlist-inspired, high-fidelity)

*claude.ai/design → Prototype → High fidelity. Quyidagi promptni to'liq qo'ying.
Referens: Artlist (layout DNA), Higgsfield (AI studiya chuqurligi). UI matnlari o'zbekcha.*

---

## PROMPT (copy from here)

Design a high-fidelity, **near-black dark-mode** UI for **AssetFlow** — an Adobe After Effects panel (CEP plugin) that combines a curated marketplace of AE templates with an integrated AI generation studio. The aesthetic target is **Artlist.io's app** (clean, premium, near-black, big rounded cards, bold editorial typography, one unified generation bar) crossed with **Higgsfield's AI studio depth** — but using AssetFlow's own **lime-green** accent instead of Artlist's yellow. The unique edge: the AI is **template-grounded** — tied to the marketplace catalog, which competitors don't have.

### Aesthetic & design language (Artlist-inspired)
- **Mood:** near-black, minimal, premium, confident. Large rounded cards (radius 16–20px), thin 0.5px borders, generous whitespace, bold editorial titles. Flat surfaces — the ONLY glow is a faint lime edge-glow on the active AI composer card and a radial lime pulse during generation.
- **Colors:** background `#0a0b08` (near-black); surfaces `#141612` / `#1c1f18`; borders `rgba(255,255,255,.08)`, hover `rgba(255,255,255,.16)`. Brand lime `#82c341`, hover `#9fd356`, brightest CTA `#a3e635`; lime edge-glow `rgba(163,230,53,.25)`. Selection blue `#327bfa`. Text `#f5f7f0`, muted `rgba(255,255,255,.60)`. Badges: NEW = lime pill; "AI bilan" = dark pill; category labels = uppercase 11px muted. Semantic danger `#ef4444`. NO indigo/purple, NO yellow.
- **Type:** Inter. Headings bold and large (section titles 22–28px, weight 600, e.g. "Nima yaratamiz?"); body 13–15px; meta/labels 11–12px. Nothing below 11px. Sentence case.
- **Radius:** cards 16px, controls 10px, pills 999px. **Spacing:** 4px base, generous (16–24px gaps). **Motion:** 0.18s ease; active scale(0.98); generation glow ~2.2s pulse.
- **Icons:** thin line icons (Tabler outline), 16–20px. **CTA buttons:** prominent pill, lime fill with dark text (like Artlist's bold Generate button, but lime).

### App shell — sidebar (Artlist style)
Left sidebar, dark, generous spacing, line icons:
- Top: AssetFlow lime brand mark + collapse control.
- **User card** (rounded surface): avatar, name, email, **Pro/Free badge** top-right.
- Collapsible sections with chevrons:
  - **AI Tools** (✨) — the studio (default-highlighted entry point).
  - **Katalog** (expandable): Shablonlar, Motion Videos, Graphics, LUTs (each line icon).
- Divider, then: **Yuklab olingan**, **Sevimli**.
- Active item: lime tint + left accent. Collapsible to icon-only (64px) with hover tooltips.

### View 1 — AI Tools (THE CENTERPIECE — model it on Artlist's generation bar)
This is the hero screen. Two states:

**A) Welcome / launcher state** (like Artlist's "What can I help you create today?"):
- Big centered heading: **"Nima yaratamiz?"**
- The **unified composer bar** (see below), empty.
- Below it, a grid of action cards (small thumbnail + label): **"Katalogdan qidirish"**, **"Ovoz yaratish"**, **"SFX yaratish"**, **"Rasm yaratish"**, **"Shablon uchun to'ldirish"**, **"Promptga yordam"**. Each card: rounded surface, thumbnail/icon left, label, subtle hover lift.

**B) The unified composer bar** (the core — copy Artlist's single-bar pattern, do NOT stack controls separately):
One large rounded card (radius 18px) with a faint lime edge-glow when focused:
- Top-left: a small pill with two toggle icons (grid results view / list view).
- A "+" add button + optional reference chips ("Reference rasm", and for template context a **"Shablon uchun"** chip).
- Large multi-line prompt area: placeholder **"G'oyangizni yozing…"** with a ✨ "prompt yaxshilash" magic icon on the right.
- **Bottom control row (all in one line):**
  - Media-type dropdown with icon: **Rasm / Ovoz / SFX / Qidiruv** (opens a clean rounded popup menu with line icons — like Artlist's Image/Video/Voiceover/Music menu).
  - **Model selector** with brand icon: e.g. "Flux 2 ▾", "Jessi (ovoz) ▾" — icon + name.
  - **Settings dropdown**: e.g. "16:9 / 2K / 1 rasm ▾" (for image), "Emotsiya / Tezlik ▾" (for voice).
  - A small **kredit** indicator "⚡ 50".
  - Prominent **lime "Generatsiya" pill** on the far right, showing cost inline: **"Generatsiya · ~40 kredit"**.

**C) Generation states:** (1) idle, (2) generating — radial lime-glow pulse over the result area + "Generatsiya qilinmoqda…" shimmer, (3) result.

**D) Results:**
- **Rasm:** a 2–3 column grid of result cards (aspect-ratio thumbnails) with hover actions (download, **"AE'ga import"**, regenerate).
- **Ovoz / SFX:** Artlist-style audio rows — thumbnail + play + title + **waveform** + duration + actions (download / favorite / "AE'ga import" / ⋮). Plus a **persistent bottom player bar** (track + prev/play/next + waveform scrubber + time + import/favorite + expand/close).
- **Qidiruv (template-grounded — make it prominent, this is the unique edge):** typing "kosmik intro kerak" returns matching real catalog templates as a card grid; add an **"AssetFlow ustunligi"** badge.
- **Timeline live-link:** a "Timeline'dan tanlash" reference button with a small "tez orada" pill.

### View 2 — Katalog / Shablonlar (Artlist "Discover" editorial style)
- Bold heading **"Shablonlar"**.
- **Featured hero row:** 2–3 large rounded hero cards (16:9), bold typographic titles, category labels (uppercase), NEW badges — like Artlist's "Discover template" hero strip.
- **Filter row:** Kategoriya / Format / Sifat dropdowns on the left; an **"AI kontent" toggle** (lime) + **Saralash** dropdown + a **Filtrlar** icon on the right (exactly like Artlist's filter bar).
- **Card grid** (2–3 col, edge-to-edge feel): 16:9 video thumbnails with hover-to-play, bold title, scene-count + resolution meta, NEW / "AI bilan" badges. Always-visible ★ favorite and ⬇ import on a soft bottom gradient. Selected card → 2px `#327bfa` ring.
- Skeleton loading + friendly empty states.

### View 3 — Account / Hisob
- Profile header: avatar, name, email, Free/Pro badge (Artlist user-card style).
- One clear usage block: "Bu oy: 15 / 50" with a lime progress bar; secondary "Jami: 15 · Import: 12 · AI kredit: 50".
- Tarif cards: Free (15 yuklab olish/oy · 1080p) vs Pro (Cheksiz · 4K · AI kredit), Pro highlighted.
- Download folder picker; sign-out (subtle danger).

### Also show (smaller)
- **Login-required modal** (guest tries to import): lock icon, "Tizimga kiring", lime "Kirish" CTA, cancel.
- **Toast** styles (success/error/warning/info — colored left border).

### Constraints & quality bar
- Near-black dark theme only; sits inside After Effects' dark UI.
- Must read well from ~360px narrow up to wider; the AI Tools composer must stay clean and dense, never sparse.
- All UI text in **Uzbek** (use the exact strings above).
- Accessibility: visible focus rings, real labels, muted text ≥ WCAG AA.
- One cohesive design system: a single token set, consistent cards, the unified composer, dropdown popups, pills, waveform player — so AI Tools, Katalog, and Account feel like one premium product.

**Make the AI Tools view the standout:** a single Artlist-style generation bar (prompt + media-type + model + settings + cost-aware lime Generate button), a welcome launcher with action cards, generation glow, a waveform audio player for voice/SFX, and a result grid for images — a notch above Higgsfield because of the template-grounded catalog search.

## (end of prompt)

---

### Foydalanish (o'zbekcha)
1. claude.ai/design → **Prototype** → **High fidelity** → "AssetFlow".
2. Yuqoridagi PROMPT blokini to'liq qo'ying.
3. Avval **AI Tools** ekranini batafsil so'rang (eng muhimi), keyin Katalog va Hisob.
4. Yoqqan dizaynni keyin biz `tokens.css` + `AssetFlow_Plugin.html` ga ko'chiramiz.

### Artlist'dan olingan asosiy g'oyalar (nusxa emas, ilhom)
- **Yagona kompozer bar** — prompt + barcha sozlama bitta yumaloq barда (sizning "sodda" muammoingizning yechimi).
- **"Nima yaratamiz?" launcher** — amal kartalari bilan.
- **Waveform audio qatorlar + doimiy pastki pleyer** — AI Ovoz/SFX uchun.
- **Editorial hero + qalin tipografik kartalar + filtr toggle** — katalog uchun.
- **User kartali sidebar + yig'iladigan bo'limlar** — Artlist navigatsiyasi.
- Sariq → **lime** ga almashtirildi (brend saqlanadi).
