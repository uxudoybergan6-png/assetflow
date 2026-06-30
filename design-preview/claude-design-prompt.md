# Claude Design Prompt — FrameFlow Landing Page

---

Design a **full-page marketing website** for **FrameFlow** — a creative platform for video professionals, similar in concept to pixflow.net. The site sells subscriptions to a library of templates, AI tools, stock video, and plugins for Adobe After Effects and Premiere Pro.

---

## Brand

- **Name:** FrameFlow
- **Tagline:** The Creative Platform for Video Professionals
- **Domain:** getframeflow.app
- **Logo mark:** Corner bracket viewfinder icon (four L-shaped corners) with a horizontal arrow in the center — represents "frame" (brackets) + "flow" (arrow)
- **Primary color:** Lime green `#c2f04a`
- **Background:** Very dark near-black `#090a0c`
- **Text:** Off-white `#eef1f6`
- **Muted text:** `#8c95a3`
- **Card background:** `#0e1115`
- **Border color:** `#1a2028`
- **Font:** Inter (900/800/700/500/400 weights)

---

## Visual Style

- **Dark, premium SaaS aesthetic** — similar to Linear, Vercel, or pixflow.net
- Flat dark cards with subtle 1px borders
- Lime green used for accent badges, numbers, CTAs, active states
- No gradients except: hero background radial glow (lime, very subtle, 6% opacity), and the final CTA section (dark green tint gradient)
- Large, bold typography with tight negative letter-spacing (hero h1: 76px, 900 weight, letter-spacing: -4px)
- White text on dark backgrounds throughout
- Buttons: primary = lime green with dark text / secondary = transparent with border

---

## Page Sections (top to bottom)

### 1. Navigation Bar (fixed, glassmorphism)
- Left: FrameFlow logo (small icon + wordmark "Frame**Flow**" where "Flow" is lime)
- Center: nav links → Features / Plugin / Pricing / FAQ
- Right: "Sign in" ghost button + "Get started →" lime button
- Background: `rgba(9,10,12,0.85)` with `backdrop-filter: blur(24px)` and 1px border bottom

### 2. Hero Section (full-width, centered)
- Small pill badge at top: pulsing green dot + "AI-Powered Creative Platform"
- H1 (3 lines): "Everything You Need / to Create Stunning / Videos"
- Subtext: "100,000+ templates, AI generation, stock footage, and sound effects — all accessible directly inside After Effects and Premiere Pro."
- Two CTA buttons: **"Start for free →"** (lime) and **"Browse templates"** (ghost/outline)
- Stats bar below CTAs (4 columns in a bordered card):
  - 100K+ Templates
  - 4M+ Creators
  - 200+ AI Models
  - 30K+ Sound FX
- Subtle radial lime glow behind the hero (very faint, like a halo)

### 3. Trusted By (full-width stripe)
- Dark background stripe with: "Trusted by teams at" label on left
- Company logos (text-style): Netflix / Disney+ / BBC Studios / Adobe / YouTube / Spotify
- Muted gray, fade opacity

### 4. Features Grid (6 cards, 3×2 grid)
- Section label: "PLATFORM" (small uppercase lime)
- H2: "One Platform, Infinite Creativity"
- Subtext: "From motion graphics to AI-generated content — everything a video professional needs."
- Grid of 6 feature cards with dark background, 1px border:
  1. 🎬 **Video Templates** — "50,000+ professional motion graphics for AE & Premiere" — count badge: "50,000+ templates"
  2. 🤖 **AI Suite** — "Generate images, video, voiceover, and SFX with 200+ AI models" — "200+ AI models"
  3. 🎵 **Sound Effects** — "Cinematic SFX, ambient loops, UI sounds for commercial use" — "30,000+ SFX"
  4. 📹 **Stock Video** — "4K cinematic footage, aerial shots, and b-roll" — "10,000+ clips"
  5. 🎨 **Graphic Assets** — "Icons, Photoshop files, LUT packs, illustrations" — "20,000+ assets"
  6. 🔌 **Native Plugin** — "Browse and import inside After Effects without switching apps" — "AE + Premiere CEP"
- Each card has: emoji icon in a lime-tinted square, bold title, description, lime count badge

### 5. Plugin Showcase (two-column: text left, visual right)
- Left side text:
  - Label: "NATIVE PLUGIN"
  - H2: "Create Inside After Effects"
  - Paragraph about plugin benefits
  - 5 checkmark bullet points:
    - Browse 100K+ templates by category, mood, duration
    - AI image & video generation with 1-click import
    - AI voiceover in 29 languages, directly in your comp
    - Semantic search: "find slow cinematic titles"
    - After Effects CEP + Premiere Pro panel
- Right side: Plugin UI mockup — dark panel showing:
  - Top bar with FrameFlow logo, credits chip ("✦ 12,440 Credits" in lime)
  - Tab bar: Browse / AI Tools / History / Projects
  - Search field
  - Filter pills (All active in lime, then Titles / Transitions / Intros / SFX)
  - 2×3 card grid of assets with dark thumbnails (some with "AI" lime badge)

### 6. Pricing Section (dark bg variant `#0c0e12`)
- Section label: "PRICING"
- H2: "Simple, Transparent Pricing"
- Subtext: "Start free. Upgrade when you're ready. Cancel anytime."
- 3-column pricing cards:

  **Starter — $9/mo**
  - 10,000 AI Credits / month
  - AI Voiceover — 5 languages
  - 500 free templates
  - After Effects + Premiere plugin
  - 5 GB cloud storage
  - Commercial license
  - Button: "Get started" (outline)

  **Pro — $19/mo** ← FEATURED (lime border, lime gradient top, "Most Popular" badge)
  - 25,000 AI Credits / month
  - AI Voiceover — 29 languages
  - Full template library (50K+)
  - Stock Video collection
  - Sound Effects library (30K+)
  - 20 GB cloud storage
  - Commercial license
  - Button: "Get Pro →" (lime filled)

  **Max — $29/mo**
  - 50,000 AI Credits / month
  - Everything in Pro
  - Priority AI processing
  - Graphic Assets library (20K+)
  - LUT Collections
  - 100 GB cloud storage
  - Team collaboration tools
  - Button: "Get Max" (outline)

### 7. Testimonials (3-column grid)
- Section label: "TESTIMONIALS"
- H2: "Loved by 4 Million Video Creators"
- 3 cards, each with: ★★★★★ stars (lime), italic quote, avatar initials + name + role
  - Adam Gutierrez — Motion Designer, Freelance
  - Fabien Lapierre — VFX Art Director
  - Gina Vogel — Video Editor, Berlin

### 8. FAQ (accordion)
- Section label: "FAQ"
- H2: "Questions Answered"
- 6 expandable questions in a bordered card list:
  1. What is FrameFlow?
  2. Can I use assets in commercial projects?
  3. How does the After Effects plugin work?
  4. What are AI Credits?
  5. Can I cancel my subscription anytime?
  6. Is there a free plan?
- First item open by default; +/− toggle icons on right

### 9. Final CTA Section
- Dark green gradient background card with lime border (subtle)
- Lime radial glow in background
- H2: "Start Creating Today — Free" (word "Free" in lime green)
- Subtext: "Join 4 million creators using FrameFlow to build better videos, faster."
- Two buttons: "Get started for free →" (lime) + "Browse templates" (outline)

### 10. Footer
- 4-column grid: FrameFlow brand + description / Platform links / Company links / Legal links
- Bottom bar: "© 2025 FrameFlow. All rights reserved." + "getframeflow.app"
- Dark background with top border

---

## Technical Requirements

- Single HTML file with all CSS inline/embedded
- No external JS dependencies
- Google Fonts: Inter (weights 400/500/700/800/900)
- Fully responsive (mobile breakpoint at 768px)
- FAQ accordion works with vanilla JS
- Smooth scroll behavior
- Sticky nav with glassmorphism blur

---

## What Makes It "Platform" (not "Plugin")

The key difference from a plugin marketing page:
- **Broad value proposition** — the headline is about creative output ("stunning videos"), not the plugin
- **Multiple product categories** front and center, not just the plugin
- **Subscription pricing model** with tiered plans (not one-time plugin purchase)
- **Social proof at scale** — "4M+ creators", "Trusted by Netflix/Adobe"
- **The plugin is one feature** in section 5, not the main product
- The overall feel is like a **creative marketplace** (Envato, Pixflow, Motion Array) not a software tool page
