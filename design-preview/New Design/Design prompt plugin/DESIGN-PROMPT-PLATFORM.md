# FrameFlow Platforma (getframeflow.app) — to'liq UI/UX qayta-dizayn PROMPTI (koddan-tasdiqlangan)

> Bu prompt bizning HAQIQIY platformamizning to'liq inventari (`packages/assetflow-studio/platform/index.html` — 16,283 qator, `ff-api.js`) asosida yozilgan — taxmin emas.
> Yo'nalish: **bir xil UX/UI oila** — AE plagin uchun yozilgan `docs/DESIGN-PROMPT-PLUGIN.md` bilan **bir xil dizayn tizimi** (token, tipografiya, komponent tili, sifat darajasi, Higgsfield restraint + lime accent). LEKIN: **Platforma Plagin emas** — platforma o'zining web-shakliga (keng ekran, ko'p sahifali, marketing+ilova gibrid) mos o'z kompozitsiyasini oladi. 1:1 klon EMAS, plaginning tor 380px panelini brauzerga qisib joylashtirish ЭМАС.
> Barcha UI matnlari o'zbekcha (real satrlar quyida, ko'pi hozirgi koddan olingan). Prompt inglizcha (dizayn vositasi uchun aniqroq).

---

## PROMPT (copy from here)

You are a senior product designer + front-end engineer. Design and build the **complete UI** for the **FrameFlow web platform** (getframeflow.app) — a marketing site + authenticated web app for a creative-assets marketplace and credit-based AI generation studio. Deliver a full design system + **every screen and state below**, dark, pixel-precise, as self-contained **HTML + CSS** with the Phosphor icon webfont. Show every screen; stub nothing.

### 0. REDESIGN MANDATE — read first (most important)
This is a **from-scratch redesign of the platform's information architecture and visual composition**, sharing a **design system** with FrameFlow's AE plugin (already redesigned — see the plugin's token/component spec in §4/§6 below, copied verbatim from that project). Two rules that must both hold at once:
1. **Same family, unmistakably.** A user who has used the AE plugin should recognize FrameFlow instantly on the website: identical color tokens, identical typography pairing (Hanken Grotesk + IBM Plex Mono), identical lime-accent restraint discipline, identical credit-clarity and labeled-settings philosophy, identical motion timing, identical card/toast/modal visual language.
2. **The Platform is the Platform, not the Plugin.** Do NOT reuse the plugin's 380px single-column panel layout, its single top-switch nav, or its bottom-sheet-for-everything interaction model. This is a **wide, desktop-first, multi-page web app** with a marketing site attached — it needs a proper marketing top-nav, a real dashboard, wide grids, hero sections, and a full app sidebar. Compose these fresh for the web form factor. Bottom-sheets become **modals/drawers/popovers** where a sheet doesn't make sense on desktop; the plugin's single-tap categories become **real navigation** (sidebar sections, breadcrumbs) appropriate to a multi-page site.
- The current platform's layout, navigation groupings, and broken/duplicate elements (§5, §7) must NOT be reproduced. Throw away the current structure's problems; keep the site's real capabilities (§7) and real Uzbek copy where it already exists and reads well.
- Benchmark quality: it must look like it was designed by the team behind Higgsfield / Runway / Linear — a tool a professional would pay for, AND a marketing site that converts. If it looks like a generic SaaS template, or like the plugin panel stretched wide, you have failed.

### 1. Product & audience
FrameFlow is a creative-assets platform with two parts, both web: (A) a **public marketing site** (landing, pricing, plugin download, legal) that converts visitors into signups, and (B) an **authenticated web app** (dashboard, template marketplace, AI Studio for image/video/voiceover/SFX generation, account/billing, projects) that a subscriber uses from a browser — in parallel with the same subscriber's AE plugin. Audience: motion designers, video editors, content creators — professionals evaluating a paid tool, not hobbyists. Tone: **premium, quiet, confident**, same tone as the plugin, translated to a web-marketing register on public pages (still restrained — no stock-photo SaaS clichés, no fake urgency).

### 2. Hard platform constraints
- **Desktop-first responsive web**, NOT a narrow panel. Design at three real breakpoints: **desktop ≥1280px** (primary canvas, marketing containers ~1280–1340px max-width), **tablet ~960px** (sidebar collapses, grids reflow to fewer columns), **mobile ~390px** (sidebar → drawer, AI Studio 3-panel workspace stacks vertically, marketing nav → hamburger). Every screen needs all three states designed, not just desktop with a vague "responsive" note.
- **Two navigation contexts that must feel like one brand**: marketing pages (public, top-nav) and the authenticated app (sidebar). Design both explicitly and make the transition between them (e.g. clicking "Kirish" on marketing nav → auth screen → dashboard) feel seamless in tone.
- **Icons:** thin, rounded line icons (Phosphor `regular` + a few `fill`), colored by context — same icon set as the plugin.
- **Fonts:** display/UI = **Hanken Grotesk**; numbers/labels/credits = **IBM Plex Mono** (`tabular-nums`) — identical to plugin, loaded via Google Fonts or self-hosted woff2 (the current site already self-hosts subsetted woff2 — keep that approach for performance).

### 3. Design language — "Same system, web-native composition"
Reuse the plugin's **"Premium restraint"** language wholesale at the token level (§4), but recompose it for a wide canvas:
1. **One accent, used rarely** — lime `#C2F04A` ONLY on primary CTAs, in-progress states, selected items, credit numbers, logo mark. On marketing pages this means: ONE lime CTA button per viewport fold, not lime everywhere.
2. **Dotted-grid texture** on generative/app surfaces (AI Studio canvas), NOT on marketing pages (marketing gets cleaner gradients/mesh backgrounds — still restrained, dark, premium).
3. **Frosted glass** for floating elements (AI Studio composer, modals, the marketing header once scrolled — sticky header should pick up a frosted background on scroll, not stay flat).
4. **Pill morphology** for controls, same radii scale as plugin.
5. **Media is king** on marketing (template carousels, AI Studio results) — frameless cards, hover autoplay.
6. **Calm 150ms motion** + the plugin's breathing-lime-glow for pending generation states; marketing pages additionally use **scroll-reveal** (the current site already respects `prefers-reduced-motion` — keep that).
7. **Structured, labeled settings** in AI Studio (same "guided borrow" as plugin — every control has a micro-label).
8. **Explicit cost clarity** — credit cost shown before every paid action, balance always visible in the app topbar, same `✦ 1,230` / `✦ 5` treatment as plugin.
9. **Typographic discipline** — but at web scale: marketing gets a real display scale (up to ~56–64px hero headline) that the 380px plugin never needed. Use IBM Plex Mono only for numbers/meta, never for headlines.

### 4. Tokens (use EXACTLY — identical to the AE plugin's design system, this is what makes them one brand)
**Colors** — page `#06080B`; surface/cards `#13161C`; deeper rail/header `#0A0D12`; elevated sheet/modal `#161B22`; media frame `#0A0A0A`. Text primary `#F2F5F8`, muted `#8A93A3`, faint `#5E6675`. Borders `#2A3140` + hairline `rgba(255,255,255,0.05)`. **Accent lime `#C2F04A`** (secondary `#9CD62B`, on-lime text `#0E1400`). Selection blue `#7CC4FF`. Error `#FF6B5E`, warn/amber `#FFB27C` — **these must become real CSS custom properties this time** (the current site hardcodes `#ff6b6b`/`#ff9c9c` outside its token system — fix that as part of this redesign). Glass: surface @ ~72% + `backdrop-filter: blur(44px)`, border white/.10, shadow `0 18px 42px rgba(0,0,0,0.5)`. Dotted grid: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)` 18px.
**Type** — Hanken Grotesk; UI sizes 11/12/13/14/16/18/22/30px (same as plugin) PLUS a marketing display scale: 30/36/44/56px for hero/section headlines. IBM Plex Mono for credits/meta/numbers, tabular-nums everywhere.
**Shape/motion** — radii 6/8/10/14/999px; ease `cubic-bezier(.34,1.2,.64,1)`; duration ~150–200ms; breathing glow 2.2s for pending generation.
**Note on theme:** current site has a leftover 3-accent theme switch (lime/cyan/amber) in its CSS variables — the plugin's approved direction is **lime only**. Drop cyan/amber theme variants unless the user asks to keep a theme picker; default to lime as the single brand accent site-wide.

### 5. Navigation & IA — fix the real problems, don't just reskin them
The current site (verified in code) has these concrete IA problems — the redesign must resolve every one, not carry it forward:
- **Two separately-coded nav systems** (marketing top-nav vs. app sidebar) with **duplicated mobile-drawer logic** — unify into one navigation component system that adapts by context (public vs. authenticated), not two parallel implementations.
- **Dead links/controls that must become real or be removed**: "Blog" nav link (currently redirects to landing — either build a real blog entry point or remove the link), notification bell (no handler, permanently shows a red dot — wire it up or remove the badge), "Hujjatlar" button on the Plugin page (currently mislabeled, goes to Dashboard — must go to real docs or be removed), sidebar's "Mening yuklamalarim" and "Sozlamalar" both pointing at the same `account` screen (make them distinct sections/tabs, or merge into one link honestly).
- **Non-functional filters that look clickable**: Templates/Marketplace page has "Orientatsiya" (Landscape/Portrait) and "Sifat" (HD/4K) filter chips with no click handler at all — either wire them to the real catalog query or remove them; a filter that looks interactive but does nothing erodes trust.
- **Mobile filter dead-end**: below 680px the marketplace filter bar is hidden entirely with no alternative (no filter drawer/button) — mobile users currently cannot filter at all. Fix with a filter drawer/sheet on mobile.
- **Fake social proof**: the landing page's "brand logo" strip (`NOVA, PixelHaus, Lumen, ORBIT, Kadr, Vizor`) and testimonials use invented names — flag this to the product owner; design the section to work equally well with 0 real logos/testimonials (e.g. a stats-focused hero instead) OR with real ones once available. Don't design a component that only works with fabricated trust signals.
- New IA: **Marketing** = Landing · Pricing · Plugin (download) · (optional real Blog) — public, one clean top-nav, footer with legal links (Terms/Privacy/Refund — keep, they're real and reference actual vendors). **Auth** = one unified login/register/forgot-password flow + verify-email interstitial. **App** = Dashboard · Templates (marketplace) · AI Studio · Projects · Account (Profile/Subscription/Credits/Downloads tabs) — one sidebar, collapsible, with a mobile drawer sharing the same component (not a second reimplementation).

### 6. Component library (spec + build each — shared with plugin where noted)
**Shared 1:1 with plugin (reuse exact spec from `docs/DESIGN-PROMPT-PLUGIN.md` §6):** primary/secondary buttons, pill/segment tabs, setting chip + bottom-sheet-becomes-popover-on-desktop, credit pill, template card (frameless thumb, hover video, PRO/FREE badge, app chip), AI result card (normal/pending-glow/error), reference tile, toast, custom confirm modal, progress bar, skeleton shimmer, empty state.
**New, web-specific:**
- **Marketing top-nav** — logo, pill nav links, sticky-frosted on scroll, Kirish/Bepul-boshlash CTAs; mobile hamburger → slide-down.
- **Hero section** — headline (display scale), subhead, dual CTA, media/product shot; scroll-reveal entrance.
- **Pricing card set** — 3 plans, monthly/yearly toggle, feature checklist, one plan visually "recommended" (subtle lime border, not a loud ribbon).
- **App sidebar** — icon+label rows, active state with lime left-accent bar (mirrors plugin's rail-selected pattern), collapsible to icon-only, credit balance + upgrade CTA pinned at bottom.
- **App topbar** — global search, credit pill, working notification bell (with real dropdown or removed entirely — no fake badge), avatar → dropdown (not a bare link) with Account/Logout.
- **Dashboard cards** — quick-action tiles, "recent generations" grid (reuse AI result card), "recommended templates" grid (reuse template card).
- **AI Studio workspace (desktop 3-column)** — left tool rail (Image/Video/Voiceover/SFX — note: voiceover+SFX exist on web today, unlike the plugin where they're "tez orada" — design them for real here), center composer (prompt + settings chips + model/ratio/quality — same idiom as plugin's frosted composer but roomier), right canvas/results with filmstrip history. Must include a **working reference-image upload** (the current web version is a stub — bring it to parity with the plugin, which already has this working).
- **Account tabs** — Profile (name/email edit), Subscription (plan cards + real Paddle checkout flow — design the checkout modal/redirect state even though wiring is a later phase), Credits (balance + transaction history + purchase modal), Downloads (usage history — currently just a number, design the real detail list).
- **Template detail modal**, **generation lightbox** — reuse plugin's lightbox idiom, scaled up for desktop with keyboard nav (←/→ between results).
- **Legal page template** — clean single-column reading layout for Terms/Privacy/Refund (keep content, restyle only).

### 7. Screens & states — CAPABILITIES to cover (real, from code — §0 in `ff-api.js`/`index.html`)
Design each screen fresh (§0), at desktop + tablet + mobile:

**MARKETING (public)**
1. **Landing** — hero, stats strip, "how it works", template showcase carousel (category-filterable), AI Studio promo block, Plugin promo block, pricing teaser, FAQ accordion, footer. (Resolve fake-logo/testimonial concern per §5.)
2. **Pricing** — monthly/yearly toggle, 3 plan cards (Bepul/Pro/Studio), FAQ, CTA → register.
3. **Plugin (download)** — .zxp download CTA (currently stubbed "tez orada" — design both the "coming soon" state and the eventual real-download state), 3-step install guide, real docs link (fix the mislabeled button).
4. **Auth** — unified login/register/forgot-password (mode switch within one screen), Google Sign-In (real), Turnstile widget on register, clear error states.
5. **Verify-email** — pending state, "Tekshirish" + "Havolani qayta yuborish", success transition into the app.

**APP (authenticated)**
6. **Dashboard** — welcome header, quick actions, recent generations (real data), recommended templates (real data).
7. **Templates / Marketplace** — search, working filters (App/Category/Price/Orientation/Quality — all real this time), result grid, template detail modal, download/import CTA.
8. **AI Studio** — tool rail (Image/Video/Voiceover/SFX all real), composer with prompt + model/settings chips + working reference upload, credit cost shown before generating, results canvas + filmstrip history, generation lightbox.
9. **Account** — Profile tab (edit name/email), Subscription tab (plan + real Paddle checkout flow, cancel/manage), Credits tab (balance, transaction history, purchase modal), Downloads tab (real usage history list, not just a count).
10. **Projects** — currently 100% decorative/fake in code (hardcoded array, "Yangi loyiha" does nothing real). Design this screen as if it will be wired to a real backend — OR explicitly flag it as out-of-scope/removed for this launch; do not ship another fake screen. (Decide with the product owner before implementing; the design should cover the real version.)
11. **Global** — toast, confirm modal, credit-purchase modal, empty states, loading/skeleton states, 401/session-expired handling (already has a real event-driven auto-logout — design the resulting redirect-to-auth state), network-retry states (Cloud Run cold-start — same "server uyg'onmoqda…" pattern as plugin's catalog cold-start).

**LEGAL (public, keep content, restyle only)**
12. Terms, Privacy, Refund — single-column legal reading layout.

### 8. UI copy — Uzbek, use REAL existing strings where they already exist in code
The current site already has substantial real Uzbek copy across all 11 screens (`packages/assetflow-studio/platform/index.html`) — when implementing, **pull exact strings from the current code** rather than inventing new copy, except where §5/§7 calls for a broken feature to be fixed or removed (e.g. don't invent fake blog post titles; either link a real blog or remove the nav item). Credit/cost copy matches the plugin exactly: `✦ 1,230` balance, `✦ 5` / `✦ 60` cost tags, `Kredit qo'shish`, `Kredit to'ldirish`. Auth: `Kirish`, `Ro'yxatdan o'tish`, `Parolni unutdingizmi?`, `Email tasdiqlanmagan`. Account tabs: `Profil`, `Obuna`, `Kreditlar`, `Yuklamalar`.

### 9. Motion
Identical timing to plugin: 150ms ease everywhere, press scale(.96–.99), 2.2s breathing lime glow on pending generation, bottom-sheet/modal slide+fade. Additionally for marketing: scroll-reveal on section entrance (already implemented via `prefers-reduced-motion` support in current CSS — preserve that accessibility behavior), sticky-header frost-in on scroll.

### 10. Deliverables
A design-token sheet (shared, cross-reference the plugin's — call out explicitly "identical to plugin tokens"); **every screen above** at three widths (desktop/tablet/mobile) as a labeled flow board; a component gallery (marking which components are shared 1:1 with the plugin vs. web-specific); clean self-contained dark-theme code with real Uzbek copy pulled from the current site, Hanken Grotesk + IBM Plex Mono, Phosphor icons. Make it unmistakably the same brand as the AE plugin, while being unmistakably a website, not a panel.

## PROMPT (end)

---

## Qo'shimcha eslatmalar (bu hujjatni implement qiluvchi uchun, promptdan tashqari)

- **Joriy sahifa mavjudligi:** platforma allaqachon `<x-dc>`+`dc-runtime` formatida productionda ishlab turibdi (`packages/assetflow-studio/platform/index.html`, 1 ta katta komponent, `state.screen` bilan almashadigan 11 ta ekran). Plagin uchun ham xuddi shu format ishlatilmoqda — demak implement bosqichida ikkalasi ham bir xil `dc-runtime` yo'li bilan productionga tushishi mumkin.
- **Real vs stub funksiyalar (implement paytida ustuvorlik):** Dashboard/Templates/AI Studio/Account'ning katta qismi REAL API'ga ulangan (`FFAPI`). Faqat quyidagilar hali stub: `.zxp` yuklab olish, Paddle checkout, AI Studio referens-rasm yuklash (pluginda allaqachon bor — parity kerak), Projects ekrani (100% soxta). Dizaynni shu haqiqiy holatga mos qurish kerak — stub joylarni ham "kelajakda ulanadi" holatida chiroyli ko'rsatish kerak, ularni yashirish emas.
- **Qaror talab qiladigan band:** Projects ekrani hozir butunlay dekorativ. Redesign paytida buni backend bilan real qilish yoki bu safar butunlay olib tashlashni foydalanuvchi hal qilishi kerak — ikkalasi ham dizaynga ta'sir qiladi.
- **Ranglar tozalash:** joriy CSS'da lime/cyan/amber uchtala tema o'zgaruvchisi bor edi (eskirgan reja qoldig'i) — endi tasdiqlangan yo'nalish faqat **lime**, shuning uchun bu prompt cyan/amber'ni olib tashlashni belgilagan.

*Yaratildi: 2026-07-03 · manba: platforma to'liq inventari (koddan-tasdiqlangan, `index.html` 16,283 qator + `ff-api.js`) + AE plagin dizayn tizimi (`docs/DESIGN-PROMPT-PLUGIN.md`, `design-preview/New Design/Design prompt plugin/`). Foydalanuvchi qarori: UX/UI bir xil oila, lekin Platforma Plaginga o'xshab qolmasin (kompozitsiya web-shakliga mos, tokenlar bir xil). Qamrov: hammasi (marketing + auth + butun app).*
