# FrameFlow AE plugin — to'liq UI/UX qayta-dizayn PROMPTI (koddan-tasdiqlangan)

> Bu prompt bizning HAQIQIY plaginning to'liq inventari (AssetFlow_Plugin.html 12,328 qator + catalog/account/host.jsx) asosida yozilgan — taxmin emas.
> Yo'nalish: Higgsfield uslubidagi PREMIUM RESTRAINT (lime kam ishlatiladi, frosted, pill, feed) + V2'ning ANIQLIGI (belgilangan sozlama, aniq kredit-narx). 1:1 klon EMAS — FrameFlow o'zi.
> Barcha UI matnlari o'zbekcha (real satrlar quyida). Prompt inglizcha (dizayn vositasi uchun aniqroq) — o'zbekcha kerak bo'lsa so'rang.

---

## PROMPT (copy from here)

You are a senior product designer + front-end engineer. Design and build the **complete UI** for **FrameFlow**, an After Effects CEP panel that has **two pillars**: (A) a **template marketplace/browse** for importing approved templates into AE, and (B) a **credit-based AI generation studio** (image + video today; audio + 3D coming soon). Deliver a full design system + **every screen and state below**, dark, pixel-precise, as self-contained **HTML + CSS** with the Phosphor icon webfont. Show every screen; stub nothing.

### 0. REDESIGN MANDATE — read first (most important)
This is a **from-scratch redesign**, NOT a re-skin. The current FrameFlow plugin looks amateurish and its information architecture is messy (a confusing double navigation, cluttered layouts, dead prototype screens). **Do NOT reproduce the existing layout, navigation, screen arrangement, groupings, component placement, or visual style.** Throw the current structure away and design the best possible UX from scratch in the new design language.
- The lists of screens/features below describe **WHAT the plugin must be able to do (its capabilities)** — they are NOT layouts to copy. Re-think the information architecture, navigation, and every screen's composition fresh.
- The ONLY things you must preserve exactly: (1) the **feature capabilities** (nothing important may be lost), (2) the **credit / Free-Pro limit logic**, (3) the **Uzbek copy strings**. Everything about how it looks and how it is arranged is yours to reinvent.
- If the current plugin does something in a clumsy or confusing way, **design the clean version** — do not carry the clumsiness over. Fewer, clearer screens beat many cluttered ones.
- Benchmark quality: it must look like it was designed by the team behind Higgsfield / Runway / Linear — a tool a professional would pay for. If any screen looks like the old FrameFlow, you have failed.

### 1. Product & audience
FrameFlow lives **inside After Effects** (Adobe CEP panel). Motion designers/editors use it to (A) browse a curated template catalog (video templates, motion, graphics, LUTs), filter, preview on hover, and **import directly into the AE comp/timeline** (Free/Pro limits, some templates have no importable pack yet); and (B) generate **images and videos** from prompts using **credits**, with references pulled from files, the AE Project panel, or the current timeline, then import results back into AE. Tone: **premium, quiet, confident** — a professional creative tool, native to a pro NLE. Never playful/toy-like.

### 2. Hard platform constraints
- **CEP panel, default 380×720px** (min 320×400), user-resizable. This is a **NARROW single column** — design everything for ~360–380px width. No multi-column desktop layout; no wide sidebars. A collapsible slim rail or a compact top switch is fine, but content is one column.
- **Dark mode is the primary theme.** (The product also supports "Liquid Glass" and "Light" theme variants via a theme picker — design the dark "Standart" theme fully; keep the token structure themeable.)
- **Icons:** thin, rounded line icons (Phosphor `regular` + a few `fill`), 14–20px, colored by context (text-alpha); accent color only where specified.
- **Fonts:** display/UI = **Hanken Grotesk** (fallback system-ui); numbers/labels/credits = **IBM Plex Mono** (`tabular-nums`). Load via CDN (fonts.googleapis.com) or system fallback.

### 3. Design language — "Premium restraint (FrameFlow identity)"
Base = **Higgsfield-inspired restraint** (deep dark, single lime accent used rarely, frosted-glass floating composer, pill controls, "feed IS the result", dotted-grid texture). Deliberately **blend in clearer, guided structure** (labeled settings, explicit credit cost, readable steps) so first-time users are never lost. **Not a 1:1 Higgsfield clone** — FrameFlow's own identity.
Ten principles: (1) **one accent, used rarely** — lime `#C2F04A` ONLY on the primary Generate/Import action, in-progress glow, selected-item dot, credit number, logo; never fill secondary controls with lime. (2) **dotted-grid background** on generative surfaces (18px). (3) **frosted floating composer** (blur ~40–50px) in the AI workspaces. (4) **pill morphology**, 28–32px controls. (5) **alpha layering** (white/.04→.13) + hairline border + inset top-highlight so surfaces feel lit. (6) **media is king** — frameless cards, hover autoplay, UI recedes. (7) **calm 150ms motion**, press `scale(.96–.99)`, 2.2s breathing lime glow on pending. (8) **structured, labeled settings** (the guided borrow) — every control has a micro-label; model/settings open as clean sectioned **bottom-sheets**, not cryptic. (9) **explicit cost clarity** — show the credit cost before every paid action (e.g. `✦ 5`), balance always visible. (10) **typographic discipline** — Hanken Grotesk tight scale, IBM Plex Mono numbers, tracking-tight headings; even tiny text looks expensive.

### 4. Tokens (use exactly; refine current FrameFlow palette toward Higgsfield restraint)
**Colors** — page `#06080B`; surface/cards `#13161C`; deeper rail/header `#0A0D12`; elevated sheet `#161B22`; media frame `#0A0A0A`. Text primary `#F2F5F8`, muted `#8A93A3`, faint `#5E6675`. Borders `#2A3140` + hairline `rgba(255,255,255,0.05)`. **Accent lime `#C2F04A`** (secondary `#9CD62B`, on-lime text `#0E1400`). Selection blue `#7CC4FF` (for "selected/reference" affordances only). Error `#FF6B5E`, warn/amber `#FFB27C`. Composer glass: surface @ ~72% + `backdrop-filter: blur(44px)`, border white/.10, shadow `0 18px 42px rgba(0,0,0,0.5)`. Dotted grid: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)` 18px.
**Type** — Hanken Grotesk; sizes 11/12/13/14/16/18/22/30px; IBM Plex Mono for credits/meta. Weights 500/600 (700 badges). tabular-nums on all numbers.
**Shape/motion** — radii 6/8/10/14/999px; ease `cubic-bezier(.34,1.2,.64,1)`; duration ~.2s.

### 5. Navigation & UX — CLEAN UP the current double-nav
The current plugin has a confusing double navigation (a left sidebar AND a top tab-bar). **Redesign to ONE clear model** for a 360px panel:
- A compact **top bar**: logo + a primary two-way switch **"Katalog / AI Tools"** (the two pillars), a live **credit pill** (`✦ 1,230`), and an avatar → Account.
- Inside **Katalog**: a horizontally scrollable category row — **Shablonlar · Motion · Graphics · LUTs**, plus access to **Sevimli** and **Yuklab olingan**. A search field and a filter button.
- Inside **AI Tools**: a launcher of tool categories, then a per-tool generation workspace; plus **Tarix** (history) and **Sozlamalar**.
- Everything one column, immersive. Bottom-sheets for filters/settings/model/account. Confirm destructive actions (custom in-panel confirm, not native). Show credit cost before paid actions.

### 6. Component library (spec + build each)
Primary action button (full-width lime, `#0E1400` text, 44px, spinner on pending) + compact 32px lime send-circle for the composer; secondary button (white/.06, no lime); segment/tab (pill container, active white/.10 + inset highlight, passive muted); **setting chip** (30–32px pill, micro-label above, opens bottom-sheet); **bottom-sheet** (`#161B22`, rounded-18 top, 44px rows, selected row white/.08 + 8px lime dot, backdrop rgba(0,0,0,.55), slide-up); bare prompt textarea (auto-grow, Enter/⌘Enter submit, `@` mention dropdown); text input (36–42px, white/.06, focus ring); **template card** (frameless thumb, hover video preview, plan badge PRO lime / FREE dark, app chip Ae/Pr/Dr with colored dot, "⏳ Pack"/"YANGI"/"AI bilan"/"✓ Yuklandi" badges, category + name + author avatar, tag chips "Pack bor/yo'q · N sahna · 2K·16:9", import button 3-state); **AI result card** (thumb/video, type tag, actions Import/Referens/Re-gen/Download/Delete, pending variant with 0–100% progress bar + breathing lime glow); reference tile (42px, autoplay muted video, remove circle, red IP-blocked variant); credit pill; skew brand badge (-12° lime, hard 2px lower shadow, uppercase 8–9px) used rarely for "PLAGIN"/"YANGI"; toast (queued, success/error/warn/info); custom confirm modal; notice-bar (lime ticker with bell + red dot); progress bar (determinate + indeterminate + cancel); skeleton shimmer; empty state (icon + text + retry); drag-ghost for drag-to-AE.

### 7. Screens & states — CAPABILITIES to cover (design each fresh; do NOT copy old layouts)
The following is the list of capabilities the plugin must cover — every one must be reachable and usable. But **design each screen's layout, composition, and flow from scratch** in the new language (see §0). Merge, split, or re-sequence screens wherever it produces a cleaner UX; the item numbers are a checklist of what must exist, not a screen order or arrangement.

**PILLAR A — KATALOG (Browse)**
1. **Home / Asosiy** — hero carousel of featured templates (poster/video, PRO/FREE badge, author, dots + arrows), then per-section grids: **Shablonlar 🎬 · Motion ✨ · Graphics 🖼 · LUTs 🎨** each with a "Barchasi" link.
2. **Katalog grid** — search ("Shablon qidirish…") + filter button (badge shows active count) + density toggle + sort. Filters bottom-sheet: **Bo'lim** (Video/Motion/Graphics/LUTs/AI), **Kategoriya** (dynamic chips), **Format** (Barchasi/16:9/9:16/1:1), **Sifat** (Barchasi/2K/4K/5K+), **AI kontentni ajratish** toggle, **Saralash** (Mos/Yangi/Nom A–Z), **Filtrlarni tozalash**. Grid of template cards (see component). Section label ("Barcha shablonlar").
3. **Template card states** — normal; **Pack yo'q** (dim, import disabled, note "Loyiha (.aep) fayli hali yuklanmagan"); already-downloaded (import → "Qayta import", show ✓ Yuklandi); PRO template for Free user (lock).
4. **Template detail** — large preview (video + play), title, category · app · author, tags, description, primary **"Import"** (into current comp/timeline) + **"Qayta import"** / disabled **"Import o'chiq"**; favorite ★ and delete 🗑 (if downloaded); "O'xshash shablonlar".
5. **Sevimli** (favorites) and **Yuklab olingan** (downloaded) — same grid, filtered.
6. **Import flow states** — determinate progress (MB counter, cancel), multi-`.mogrt` "MOGRT_PACK" selection, success toast "Shablon AE'ga qo'shildi", Free-limit reached → "Oylik yuklama limiti tugadi — Pro'ga o'ting" sheet, Pro-locked → "Pro shablon" → CTA "Pro'ga o'tish".
7. **Katalog states** — loading/cold-start ("Katalog yuklanmoqda — server uyg'onmoqda…"), error + "↻ Qayta urinish", empty, skeleton cards. A "↻ Sinxronlash" action.

**PILLAR B — AI TOOLS**
8. **AI launcher** — header "✦ AI Tools" + credit + nav to History/Settings. A grid of **4 categories**: **Image → "Rasm yaratish"** (LIVE, sub: GPT Image 2 · Nano · Flux · Seedream), **Video → "Video yaratish"** (LIVE, sub: Seedance 2.0 · Fast+R2V), **Audio** (dim "tez orada"), **3D** (dim "tez orada"). Tapping an empty one: "Hali tool yo'q — tez orada qo'shiladi."
9. **Rasm yaratish (image workspace)** — header (‹ AI Tools · **Rasm ⇄ Video** tab · History/Settings · credit). Prompt textarea (placeholder "Nima qilish kerak? @ yozsangiz referenslar chiqadi…", `@` mention). **Referens** section: "+ Referens" → source sheet with **Fayl yuklash · Project paneldan · Timeline'dan**; reference grid; meta ("0 ta referens"); "referens majburiy" warning when the model requires it. Settings chips (each a labeled bottom-sheet): **Model · Nisbat · Sifat · Soni** + "Tozalash". **"🌟 Yaxshilash"** (enhance). **"Yaratish"** with cost tag (`✦ 5`). Result grid + meta + progress. "So'nggi" strip with select + batch (⬇ Yuklab / 🗑 O'chirish / bekor) + "Barchasi →".
10. **Video yaratish (video workspace)** — the most complex. Header (Video ⇄ Rasm tab). **Frames (Fast mode)**: "Boshlang'ich" + "Yakuniy (ixtiyoriy)" drop boxes, "FAST" tag, source sheet (Fayl/Project/Timeline). **References (R2V multi-modal)**: "+ Rasm · + Video · + Ovoz", ref limits, "Faol Referenslar" grid + "Saved References" ("10 minut saqlanadi"). **Video trim sheet**: player, "Butun klip"/"Tanlangan qism", trim timeline with handles, "⚠ 15 soniyadan uzun bo'lmasin" warning, "Videodagi audioni ham referens qil" toggle, "Shu bo'lakni ishlatish". Prompt (@mentions). Settings: **Model · Nisbat · Rezolyutsiya · Davomiylik ("Auto ≈ 5 soniya") · Ovoz toggle**. Enhance. "Video yaratish" + cost (`✦ 60`). Result `<video>` + actions + Recent + batch.
11. **Tarix (History)** — full gallery from generation history. Filters: **Hammasi · Rasm · Video · Ovoz · SFX**. Zoom −/+ (1↔3 columns), select mode, batch download/delete (with confirm). Same card component.
12. **Lightbox** — large media (video/image/audio), actions: **Import · Referens · Qayta gen · Download**, close (Esc).
13. **AI Sozlamalar** — credit balance + "Kredit to'ldirish"; (dev demo toggles exist but hide from the polished design).
14. **AI states** — generating badge "⟳ ishlanmoqda", pending card progress, reference-required warning, low-credit, "keyingi gen xato", session-expired.

**ACCOUNT & GLOBAL**
15. **Account sheet** — (a) **Login block**: email + parol + "Kirish", note "Cloud hisob bilan kiring"; (b) **Profile**: avatar, name, email, plan badge, "Bu oy" usage "5 / 15" + bar + "↻ Yangilash"; (c) **Theme picker**: Standart · Liquid Glass · Light Glass swatches; (d) **Tarif**: Free ("15 yuklab olish/oy · 1080p") / Pro ("Cheksiz · 4K pack") + "💳 Obunani boshqarish"; (e) **Yuklab olish papkasi**: path + "📁 Papka tanlash"/"Standart"/"💾 Saqlash"; (f) **Contributor**: "＋ Shablon Publish qilish"; (g) **Admin**: "🛠 Admin panelni ochish" (admin only); (h) "⎋ Chiqish".
16. **Publish sheet** (contributor) — scene selection to publish a template.
17. **Login-required modal** — "Katalog foydalanish uchun hisobga kiring." + "Kirish".
18. **Global** — toast, custom confirm, notice-bar, progress, skeleton, empty states, drag-ghost, bottom-sheets. Themes: Standart (dark, primary), Liquid Glass (translucent + blur), Light Glass.

**⚠️ DO NOT copy these from the current code (dead/unreachable prototype screens): v-genimage, v-genvideo, v-gen3d, v-gentts, v-genmusic, v-gensfx, v-genstt, v-genavatar, v-editimage, v-editvideo, v-op.** Audio/3D/edit tools should appear ONLY as "Tez orada" launcher categories until built.

### 8. UI copy — Uzbek, exact strings
Pillars/nav: `Katalog`, `AI Tools`, `Shablonlar`, `Motion`, `Graphics`, `LUTs`, `Sevimli`, `Yuklab olingan`, `Tarix`, `Sozlamalar`, `Hisob`, `Asosiy`, `↻ Sinxronlash`.
Browse: `Shablon qidirish...`, `Filtrlar`, `Bo'lim`, `Kategoriya`, `Format`, `Sifat`, `Saralash`, `AI kontentni ajratish`, `Filtrlarni tozalash`, `Barcha shablonlar`, `Import`, `Qayta import`, `Import o'chiq`, `Pack bor`, `Pack yo'q`, `YANGI`, `AI bilan`, `✓ Yuklandi`, `PRO`, `FREE`, `Shablon AE'ga qo'shildi`, `Katalog yuklanmoqda — server uyg'onmoqda…`, `Server javob bermadi`, `↻ Qayta urinish`.
AI: `✦ AI Tools`, `Rasm yaratish`, `Video yaratish`, `Audio`, `3D`, `tez orada`, `Referens`, `+ Referens`, `Fayl yuklash`, `Project paneldan`, `Timeline'dan`, `Model`, `Nisbat`, `Sifat`, `Soni`, `Rezolyutsiya`, `Davomiylik`, `Ovoz`, `🌟 Yaxshilash`, `Tozalash`, `Yaratish`, `Video yaratish`, `Ishlanmoqda`, `Hammasi`, `Rasm`, `Video`, `Ovoz`, `SFX`, `Boshlang'ich`, `Yakuniy (ixtiyoriy)`, `Faol Referenslar`, `Saved References`, `Shu bo'lakni ishlatish`, `Qayta gen`, `Barchasi →`, `0 tanlandi`.
Account: `Kirish`, `Chiqish`, `Kredit to'ldirish`, `Kredit qo'shish`, `Obunani boshqarish`, `Papka tanlash`, `Shablon Publish qilish`, `Admin panelni ochish`, `Bu oy`, `Free`, `Pro`, `Standart`, `Liquid Glass`, `Light Glass`.
Cost/credit: shown as `✦ 5` / `✦ 60`; balance `✦ 1,230`. Empty AI: `Hali generatsiya yo'q`. Session: `Sessiya tugadi — qayta kiring`.

### 9. Motion
150ms ease everywhere; press scale(.96–.99); pending = 2.2s breathing lime glow (opacity .82↔1, translateY 4px); bottom-sheets slide up + backdrop fade; hover autoplay on video cards; toasts rise then auto-dismiss (~3.5s); notice-bar ticker. No jumps.

### 10. Deliverables
A design-token sheet; **every screen and state above** as a labeled flow board, each screen at **~360–380px wide** (the real panel width); a component gallery; clean self-contained dark-theme code with Uzbek copy, Hanken Grotesk + IBM Plex Mono, Phosphor icons; realistic FrameFlow content (no lorem). Two pillars fully covered — Katalog (browse+import) and AI Tools (image+video, audio/3D "tez orada"). Make it feel like a tool a professional would pay for: Higgsfield's premium restraint fused with clear, guided structure. This is FrameFlow, not a clone.

## PROMPT (end)

---

*Yaratildi: 2026-07-03 · manba: bizning plagin to'liq inventari (koddan-tasdiqlangan) + Higgsfield tahlil. Panel 380×720. Yo'nalish: [[design-direction-2026-07]]. Ikki ustun: Katalog + AI Tools. O'lik prototip ekranlar (SFX/TTS/Edit) ko'chirilMAYDI.*
