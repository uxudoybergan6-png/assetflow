# Claude Design prompt — AssetFlow (Liquid Glass variant, high-fidelity)

*claude.ai/design → Prototype → High fidelity. Bu — Artlist variantining LIQUID GLASS ko'rinishi.
Bir xil tuzilma/kontent, lekin Apple "Liquid Glass" estetikasi. UI matnlari o'zbekcha.*

---

## PROMPT (copy from here)

Design a high-fidelity **Apple "Liquid Glass"** style dark UI for **AssetFlow** — an Adobe After Effects panel (CEP plugin) combining a curated AE-template marketplace with an integrated AI generation studio. Same structure and content as a clean creative tool, but the entire surface treatment is **translucent frosted glass**: layered, light-refracting panels that float over a deep ambient background, with bright rim highlights and soft depth shadows. Keep AssetFlow's **lime-green** accent. The unique edge: the AI is **template-grounded** — tied to the marketplace catalog.

### Liquid Glass material (the defining aesthetic)
- **Ambient background:** a deep near-black canvas `#070806` with soft, blurred lime + cool ambient blooms (large out-of-focus radial gradients, very subtle) so the glass has something to refract. Optional faint noise. Never a flat single color — glass needs depth behind it.
- **Glass panels/cards:** semi-transparent dark fills `rgba(20,24,18,.55)` with **backdrop-blur(28–40px) + saturate(1.3)**; a **bright 1px rim highlight** on top/left edges (`rgba(255,255,255,.18)`) fading to a darker bottom edge; a soft outer shadow (`0 8px 40px rgba(0,0,0,.45)`) for floating depth; subtle inner top highlight (specular sheen). Corners large and rounded (18–24px), pill controls 999px.
- **Accent:** lime `#82c341` / bright `#a3e635`; lime elements glow softly through the glass (`box-shadow: 0 0 24px rgba(163,230,53,.35)`). Selection blue `#327bfa`. CTA = a glossy lime pill with a top specular highlight.
- **Text:** `#f6f8f1`, muted `rgba(255,255,255,.62)` — high contrast so it reads over translucent/blurred backgrounds (add a faint text-shadow if needed for legibility). Inter; headings bold 22–28px; body 13–15px; nothing below 11px. Sentence case.
- **Depth & motion:** layered z-depth (background → glass panel → floating controls). Hover: panels brighten + rim glows; 0.18s ease; active scale(0.98). Generation = a radial lime glow pulsing behind the frosted result panel.
- **Icons:** thin line icons (Tabler outline), 16–20px.

### App shell — glass sidebar
A floating translucent glass sidebar (backdrop-blur, rim highlight) over the ambient background:
- AssetFlow lime brand mark + collapse control.
- **User glass card:** avatar, name, email, **Pro/Free** glass pill badge.
- Collapsible sections (chevrons): **AI Tools** (✨, default-highlighted with lime glow), **Katalog** (Shablonlar, Motion Videos, Graphics, LUTs).
- Divider, then **Yuklab olingan**, **Sevimli**.
- Active item: lime-tinted glass pill + soft glow. Collapsible to 64px with hover tooltips.

### View 1 — AI Tools (CENTERPIECE — a single floating glass composer)
**A) Welcome state:** big centered heading **"Nima yaratamiz?"** over the ambient glow. Below, the glass composer (empty), then a grid of **glass action cards**: "Katalogdan qidirish", "Ovoz yaratish", "SFX yaratish", "Rasm yaratish", "Shablon uchun to'ldirish", "Promptga yordam" — each a translucent card with icon, label, hover brighten.

**B) The unified glass composer bar** (the hero element — one large floating frosted panel with a bright rim and lime edge-glow when focused):
- Top-left: a glass pill with grid/list result-view toggles. A "+" add button + a **"Shablon uchun"** glass chip.
- Large prompt area: placeholder **"G'oyangizni yozing…"** with a ✨ "prompt yaxshilash" icon on the right.
- **Bottom control row (all inline, as frosted pill controls):** media-type dropdown (**Rasm / Ovoz / SFX / Qidiruv**, opens a floating glass popup menu), **model selector** (icon + "Flux 2 ▾" / "Jessi ▾"), **settings** pill ("16:9 · 2K · 1 rasm ▾"), a **⚡ kredit** indicator, and a glossy lime **"Generatsiya · ~40 kredit"** CTA on the right.

**C) Generation states:** idle → generating (frosted result panel with a radial lime glow pulsing behind the glass + "Generatsiya qilinmoqda…") → result.

**D) Results:**
- **Rasm:** 2–3 col grid of glass result cards (aspect-ratio), hover actions (download / "AE'ga import" / regenerate).
- **Ovoz / SFX:** glass audio rows — play + title + **waveform** + duration + actions; plus a **floating glass bottom player bar** (prev/play/next + waveform scrubber + time + import/favorite + close).
- **Qidiruv (template-grounded — prominent, the unique edge):** "kosmik intro kerak" → matching catalog templates as glass cards; an **"AssetFlow ustunligi"** glow badge.
- **Timeline live-link:** "Timeline'dan tanlash" glass button with a small "tez orada" pill.

### View 2 — Katalog / Shablonlar
- Bold heading **"Shablonlar"**.
- **Featured hero row:** large glass hero cards (16:9 imagery behind frosted overlay), bold titles, category labels, NEW glow badges.
- **Glass filter bar:** Kategoriya / Format / Sifat frosted dropdowns; **"AI kontent" glass toggle** (lime) + **Saralash** + **Filtrlar** icon.
- **Card grid** (2–3 col): 16:9 thumbnails with hover-to-play, bold title, scene-count + resolution meta, NEW / "AI bilan" glass badges. Always-visible ★ / ⬇ on a soft gradient. Selected → lime-glow rim + 2px `#327bfa`.
- Glass skeleton loading + friendly empty states.

### View 3 — Account / Hisob (floating glass sheet)
- Profile header (avatar, name, email, Pro/Free glass pill).
- Usage glass block: "Bu oy: 15 / 50" with a glowing lime progress bar; secondary "Jami: 15 · Import: 12 · AI kredit: 50".
- Tarif glass cards: Free vs Pro (Pro highlighted with lime rim-glow).
- Download folder picker; sign-out (subtle danger).

### Also show (smaller)
- **Login-required glass modal** (guest import): lock icon, "Tizimga kiring", glossy lime "Kirish" CTA, cancel — a floating frosted dialog over a dimmed blurred backdrop.
- **Glass toasts** (success/error/warning/info — colored rim).

### Constraints & quality bar
- Dark Liquid Glass only; readable over translucent/blurred surfaces (mind contrast — muted text ≥ WCAG AA, add text-shadow where needed).
- Reads well from ~360px narrow up to wider; the AI composer stays clean, dense, premium — never sparse.
- All UI text in **Uzbek** (exact strings above).
- One cohesive glass design system: consistent translucency, rim highlights, blur, depth, the floating composer, glass popups, waveform player — so AI Tools, Katalog, Account feel like one premium Liquid Glass product.

**Make the AI Tools view the standout:** a single floating frosted-glass composer (prompt + media-type + model + settings + glossy lime cost-aware Generate), a welcome launcher with glass action cards, a radial lime generation glow behind frosted glass, a glass waveform player for voice/SFX, and a glass result grid for images — premium, light-refracting, a notch above competitors thanks to the template-grounded catalog search.

## (end of prompt)

---

### Foydalanish (o'zbekcha)
1. claude.ai/design → **Prototype** → **High fidelity** → "AssetFlow Liquid Glass".
2. Yuqoridagi PROMPT blokini to'liq qo'ying. Opus 4.8 model.
3. Natija chiqqach, ikkala variantni (Artlist flat + Liquid Glass) solishtirib, qaysini ishlatishni tanlaysiz — yoki ikkovini aralashtiramiz.

### Liquid Glass vs Artlist (flat) — farq
| | Artlist (flat) | Liquid Glass |
|---|---|---|
| Yuza | qattiq near-black kartalar | shaffof muzli panellar (backdrop-blur) |
| Fon | tekis near-black | chuqur ambient + lime/cool bloom |
| Chetlar | nozik 0.5px border | yorqin rim highlight + soft shadow |
| Chuqurlik | tekis | qatlamli, suzuvchi panellar |
| Lime | aksent | shisha orqali yumshoq porlaydi (glow) |
| Brend | bir xil (lime, Inter, o'zbekcha) | bir xil |

> Eslatma: Liquid Glass `backdrop-filter: blur()` ishlatadi — CEP (Chromium) buni qo'llaydi, lekin ko'p blur ishlash unumdorligiga ta'sir qilishi mumkin. Plaginga ko'chirishda blur darajasini me'yorlaymiz.
