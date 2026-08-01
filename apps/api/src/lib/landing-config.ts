import { prisma, Prisma } from "@creative-tools/database";
import { z } from "zod";
import { recordContentRevision } from "./content-revisions.js";

// ── Landing CMS — konfiguratsiya manbai ─────────────────────────────────────
// Bitta LandingConfig qatori (id=1) JSON blob saqlaydi; bu fayl DEFAULT
// qiymatlarni (= landing'ning HOZIRGI hardcoded konteni) va deep-merge'ni
// beradi. Qator yo'q/qisman bo'lsa yetishmagan maydonlar defaultdan to'ladi —
// admin tahrir qilmaguncha landing bir pikselga ham o'zgarmaydi.

export interface LandingMockupCard {
  label: string;
  dur: string;
  mediaUrl: string;
  mediaType: "" | "image" | "video";
}

export interface LandingStat {
  value: number;
  suffix: string;
  label: string;
}

export interface LandingSectionOrder {
  key: string; // stats | showcase | aiPromo | pluginPromo | pricingTeaser | faq | finalCta
  visible: boolean;
}

export interface SitePlanCopy {
  name: string;
  price: number; // DISPLAY narx ($/oy) — real billing Lemon Squeezy/PlanConfig'da, bunga TEGMAYDI
  credits: string;
  sub: string;
  cta: string;
  feats: string[]; // pricing sahifadagi to'liq ro'yxat
  teaserFeats: string[]; // landing teaser'dagi 3 qator
}

// ── SITE CMS v2 — qo'shimcha bo'limlar (media-slotli kartalar + app/katalog) ──
export interface SiteMediaSlot {
  mediaUrl: string;
  mediaType: "" | "image" | "video";
}

export interface LandingPromoBar {
  enabled: boolean;
  tag: string; // kichik badge (masalan NEW)
  text: string;
  ctaLabel: string;
  showInApp: boolean; // login bo'lgan app ekranlarida ham ko'rsatish
}

export interface LandingPresetItem extends SiteMediaSlot {
  title: string;
  sub: string;
}

export interface LandingFeedCard extends SiteMediaSlot {
  title: string; // bo'sh = shu slotda built-in demo karta qoladi
  cat: string;
  dur: string;
  badge: string; // PRO | FREE | bo'sh
}

export interface LandingMegaModelRow {
  initials: string;
  title: string;
  sub: string;
  badge: string; // TOP/NEW/PREMIUM yoki bo'sh
  price: string; // ko'rsatiladigan narx yorlig'i (✦…)
}

// ── SITE CMS v3 — vizual muharrir: element uslub qatlami + bildirishnomalar ──
/** Bitta elementga (data-cms yo'li) beriladigan uslub ustqurmasi.
 *  DIQQAT: bu yerda XOM CSS satri YO'Q va bo'lmaydi — faqat tipli, chegaralangan
 *  qiymatlar. Platforma shulardan CSS quradi (injection yuzasi yopiq). */
export interface SiteStyleProps {
  fontSize?: number; // px 8..200
  fontWeight?: number; // 300..900
  lineHeight?: number; // 0.8..2.6
  letterSpacing?: number; // em -0.12..0.4
  textAlign?: "left" | "center" | "right";
  textTransform?: "none" | "uppercase" | "capitalize";
  color?: string; // #RGB | #RRGGBB
  bg?: string; // #RGB | #RRGGBB
  padY?: number; // px 0..200
  padX?: number; // px 0..200
  marginTop?: number; // px -300..400
  marginBottom?: number; // px -300..400
  offsetX?: number; // px -600..600 (translate — "surish")
  offsetY?: number; // px -600..600
  scale?: number; // 0.4..2.5 ("kattalashtirish/kichiklashtirish")
  rotate?: number; // deg -30..30
  radius?: number; // px 0..120
  maxWidth?: number; // px 0..1800 (0 = auto)
  opacity?: number; // 0..1
  shadow?: number; // 0..4 (preset darajalar)
  borderWidth?: number; // px 0..8
  borderColor?: string;
  hidden?: boolean; // display:none
}

/** Element uslubi — qurilma bo'yicha: d = desktop (asos), m = mobil (≤640px). */
export interface SiteElementStyle {
  d?: SiteStyleProps;
  m?: SiteStyleProps;
}

/** Foydalanuvchiga ko'rsatiladigan bildirishnoma (sayt + app ichida).
 *  Pul/kredit mantig'iga TEGMAYDI — faqat ko'rsatish qatlami. */
export interface SiteNotice {
  id: string; // barqaror kalit — dismiss holati shu bo'yicha eslab qolinadi
  enabled: boolean;
  placement: "banner" | "toast" | "modal";
  tone: "info" | "promo" | "warn" | "success";
  audience: "all" | "guest" | "user"; // guest = login qilmagan, user = login qilgan
  title: string;
  text: string;
  ctaLabel: string;
  ctaTarget: "" | "landing" | "pricing" | "plugin" | "templates" | "aistudio" | "account" | "dashboard";
  ctaUrl: string; // ctaTarget bo'sh bo'lsa — tashqi https havola
  dismissable: boolean;
  startAt: string; // "" yoki ISO sana — shundan oldin ko'rinmaydi
  endAt: string; // "" yoki ISO sana — shundan keyin ko'rinmaydi
}

export interface LandingConfigData {
  theme: {
    // accent — istalgan HEX; landing CSS o'zgaruvchilari shu rangdan hisoblanadi.
    accent: string;
    // font — o'z-serverimizda turadigan (CDN'siz) tanlov ro'yxatidan kalit.
    font: "hanken" | "system" | "plex-mono" | "georgia";
  };
  nav: {
    templates: string;
    aiStudio: string;
    pricing: string;
    plugin: string;
    signIn: string;
    cta: string;
    pluginBadge: string; // Plugin havolasidagi kichik pip (bo'sh = yashirin)
  };
  hero: {
    badgeTag: string;
    badgeText: string;
    title: string;
    titleAccent: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    credline: string;
  };
  mockup: {
    title: string;
    badge: string;
    cards: LandingMockupCard[]; // LEGACY (eski hero mockup) — hozirgi landing bularni render qilmaydi
  };
  // v2: hero billboard — media + kichik yorliqlar (vaqt/caption)
  heroMedia: SiteMediaSlot & { time: string; caption: string };
  // v2: e'lon paneli (promo strip) — endi hero-badge'dan MUSTAQIL
  promo: LandingPromoBar;
  // v2: oqar matn (ticker) bo'limi
  ticker: { label: string; items: string[] };
  // v2: kino-billboard bo'limi (media-slot bilan)
  cinema: SiteMediaSlot & {
    eyebrow: string;
    title: string;
    linkLabel: string;
    barLeft: string;
    barRight: string;
    word: string; // \n = qator uzilishi
    footTitle: string;
    footSub: string;
    cost: string;
  };
  // v2: preset reykasi — 4 media-slotli karta
  presetsRail: { eyebrow: string; title: string; linkLabel: string; items: LandingPresetItem[] };
  // v2: masonry feed — 11 slot; bo'sh slot built-in demo kartada qoladi
  feed: { note: string; cards: LandingFeedCard[] };
  // v2: nav mega-menyu "LIVE MODELS" ustuni (drift xavfi eng yuqori joy)
  megaModels: { rows: LandingMegaModelRow[] }; // 4 ta
  stats: LandingStat[]; // 4 ta
  // ── To'liq sayt CMS (landing pastki bo'limlar + pricing/plugin sahifalar) ──
  // landingSections — hero'dan keyingi bo'limlar TARTIBI + ko'rinishi (hero doim birinchi).
  landingSections: LandingSectionOrder[];
  showcase: { eyebrow: string; title: string; linkLabel: string };
  aiPromo: {
    eyebrow: string;
    title: string;
    desc: string;
    ctaLabel: string;
    cards: { title: string; desc: string; cost: string }[]; // 4 ta (tool kaliti kodda qoladi)
    typingPrompts: string[]; // 4 ta — yozilayotgan prompt animatsiyasi matnlari
    stackLabel: string; // result-stack yorlig'i (masalan "NANO BANANA PRO · 2K")
    chipMode: string;
    chipModel: string;
    chipRes: string;
    chipCost: string;
    chipGenerate: string;
  };
  pluginPromo: {
    eyebrow: string;
    title: string;
    desc: string;
    ctaLabel: string;
    chips: string[]; // 3 ta
    winTitle: string; // AE oynasi mock sarlavhasi
    winSearch: string;
    winImport: string;
  };
  pricingTeaser: { eyebrow: string; title: string; sub: string; note: string; noteLink: string };
  faqSection: { title: string; items: { q: string; a: string }[] }; // 5 ta — pricing sahifada ham shu
  finalCta: { title: string; sub: string; ctaLabel: string; credline: string; eyebrow: string; secondaryLabel: string };
  // v2: logged-in webapp Home ekrani matnlari
  appHome: {
    heroSub: string;
    quick: { title: string; desc: string }[]; // 3 ta (target ekranlar kodda)
    shelfCat: string; // "essentials" polkasi uchun afzal kategoriya
    secJump: string;
    secJumpLink: string;
    secStart: string;
    emptyTitle: string;
    emptySub: string;
    emptyBtn: string;
    secFeatured: string;
    secRec: string;
    recLink: string;
    shelfFreshKick: string;
    shelfFresh: string;
    shelfCatKick: string;
    shelfNewKick: string;
    shelfNew: string;
  };
  // v2: Stock Catalog sahifa sarlavha/qidiruv/бo'sh holat matnlari
  catalogPage: {
    kicker: string;
    title: string; // \n = qator uzilishi
    searchPlaceholder: string;
    loading: string;
    emptyTitle: string;
    emptySub: string;
  };
  footer: {
    tagline: string;
    email: string;
    copyright: string;
    guarantee: string;
    cols: { title: string; links: string[] }[]; // 3 ustun — faqat YORLIQLAR (havola manzillari kodda)
  };
  pricingPage: {
    eyebrow: string;
    title: string;
    sub: string;
    faqTitle: string;
    billingNote: string; // "MONTHLY PLANS" chizig'i
    billingSub: string;
    popularLabel: string; // "MOST POPULAR"
    compareTitle: string; // "ALL PLANS INCLUDE"
    compareItems: string[]; // 4 ta
  };
  // plans — DISPLAY nusxasi (teaser + pricing sahifa); key/pop/checkout kodda qoladi.
  plans: SitePlanCopy[]; // 3 ta: free, pro, studio
  pluginPage: {
    badge: string;
    title: string;
    sub: string;
    ctaLabel: string;
    versionNote: string;
    guarantee: string;
    steps: { t: string; d: string }[]; // 3 ta
    winTitle: string; // AE oynasi mock
    winSearch: string;
    mockName: string; // mockdagi shablon nomi
    mockImport: string;
  };
  // v3 — vizual muharrir qatlamlari
  /** data-cms yo'li → uslub ustqurmasi (bo'sh = built-in dizayn). */
  uiStyles: Record<string, SiteElementStyle>;
  /** Foydalanuvchiga bildirishnomalar (banner / toast / modal). */
  notices: SiteNotice[];
}

// DEFAULTS = landing'ning joriy ko'rinishi (platform/index.html bilan AYNI matnlar).
export const DEFAULT_LANDING_CONFIG: LandingConfigData = {
  theme: { accent: "#C2F04A", font: "hanken" },
  nav: {
    // P2 (step 31) — nav "Templates" → "Stock Catalog". ⚠️ Bu DEFAULT; agar prod DB'da
    // (LandingConfig id=1) nav.templates SAQLANGAN bo'lsa, u ustun turadi (mergeConfig) →
    // admin panel orqali ham yangilash SHART, aks holda sayt eskisini ko'rsatadi.
    templates: "Stock Catalog",
    aiStudio: "AI Studio",
    pricing: "Pricing",
    plugin: "Plugin",
    signIn: "Sign in",
    cta: "Start for free",
    pluginBadge: "NEW",
  },
  hero: {
    badgeTag: "NEW",
    badgeText: "AI Video 2.0 is here",
    title: "Templates, AI video and audio —",
    titleAccent: "one creative space",
    sub: "Download templates, generate images, video and audio with AI — all in one creative space. Work in the browser or keep going inside After Effects.",
    ctaPrimary: "Start for free",
    ctaSecondary: "Browse templates",
    credline: "No card required · 50 AI credits on us",
  },
  mockup: {
    title: "FrameFlow — AI Studio",
    badge: "LIVE",
    cards: [
      { label: "IMAGE", dur: "", mediaUrl: "", mediaType: "" },
      { label: "IMAGE", dur: "", mediaUrl: "", mediaType: "" },
      { label: "IMAGE", dur: "", mediaUrl: "", mediaType: "" },
      { label: "VIDEO", dur: "0:08", mediaUrl: "", mediaType: "" },
      { label: "TEMPLATE", dur: "0:12", mediaUrl: "", mediaType: "" },
      { label: "TEMPLATE", dur: "0:05", mediaUrl: "", mediaType: "" },
    ],
  },
  // v2 — hero billboard: media bo'sh = joriy CSS-art (aurora) qoladi.
  heroMedia: { mediaUrl: "", mediaType: "", time: "00:08", caption: "4K · cinematic motion" },
  // v2 — promo strip: default matn hero-badge bilan bir xil (joriy xulq saqlanadi).
  promo: { enabled: true, tag: "NEW", text: "AI Video 2.0 is here", ctaLabel: "Try it", showInApp: false },
  ticker: {
    label: "FRAMEFLOW SELECTS",
    items: ["TYPOGRAPHY ↗", "PRODUCT FILMS ↗", "SOCIAL CUTS ↗", "TITLE SYSTEMS ↗", "MOTION POSTERS ↗", "SEEDANCE 2.0 ↗"],
  },
  cinema: {
    eyebrow: "MADE WITH AI STUDIO",
    title: "One idea. Full-screen impact.",
    linkLabel: "Build a scene",
    barLeft: "CONCEPT PREVIEW",
    barRight: "SEEDANCE 2.0 · 4K",
    word: "AFTER\nLIGHT",
    footTitle: "After Light — product film study",
    footSub: "Start/end frames · native audio · 8 seconds",
    cost: "✦ 480",
    mediaUrl: "",
    mediaType: "",
  },
  presetsRail: {
    eyebrow: "START FASTER",
    title: "One-click creative presets",
    linkLabel: "View all presets",
    items: [
      { title: "Editorial portrait", sub: "Nano Banana Pro · ✦ 8", mediaUrl: "", mediaType: "" },
      { title: "Cinematic dolly", sub: "Veo 3.1 Lite · ✦ 24+", mediaUrl: "", mediaType: "" },
      { title: "Product refraction", sub: "Imagen 4 Ultra · ✦ 6+", mediaUrl: "", mediaType: "" },
      { title: "Type explosion", sub: "FrameFlow template · Pro", mediaUrl: "", mediaType: "" },
    ],
  },
  feed: {
    note: "Concept previews — styles you can create, not live catalog listings",
    cards: Array.from({ length: 11 }, () => ({ title: "", cat: "", dur: "", badge: "", mediaUrl: "", mediaType: "" as const })),
  },
  megaModels: {
    rows: [
      { initials: "S2", title: "Seedance 2.0", sub: "Reference-led video · 480p–4K · 4–15s", badge: "TOP", price: "✦8–60/s" },
      { initials: "NB", title: "Nano Banana 2", sub: "Fast multi-reference image · 1K–4K", badge: "NEW", price: "✦4–16" },
      { initials: "V3", title: "Veo 3.1", sub: "Premium video · start/end frames + audio", badge: "PREMIUM", price: "✦30/s" },
      { initials: "UP", title: "Video Upscale · Topaz", sub: "Resolution-aware 720p / 1080p / 4K", badge: "", price: "✦2/3/9" },
    ],
  },
  // Launch Task B — oqib ketadigan katalog-hajm raqami olib tashlandi (haqiqiy hajmga mos emas
  // edi); Pr/DaVinci plagin yorlig'i ham olib tashlandi (plagin faqat AE'ni qo'llab-quvvatlaydi).
  // Timeless/haqiqiy qiymatlar bilan almashtirildi.
  // Correction audit — "14-day money-back guarantee" refund.html'da hali lawyer-review ostida
  // (final shart/muddat tasdiqlanmagan), shuning uchun 4-statistika timeless haqiqiy faktga
  // almashtirildi (refund shartlari faqat Refund Policy sahifasida).
  stats: [
    { value: 50, suffix: "", label: "Free AI credits to start" },
    { value: 4, suffix: "", label: "AI tools — image · video · voice · SFX" },
    { value: 6, suffix: "", label: "Content categories — video, graphics, LUTs, audio" },
    { value: 1, suffix: "connected workflow", label: "Web and After Effects" },
  ],
  // v2 — ticker/cinema/presets endi tartib ro'yxatida (ilgari qattiq order:5/15/25 edi;
  // default tartib joriy vizual ketma-ketlik bilan AYNI).
  landingSections: [
    { key: "ticker", visible: true },
    { key: "stats", visible: true },
    { key: "cinema", visible: true },
    { key: "showcase", visible: true },
    { key: "presets", visible: true },
    { key: "aiPromo", visible: true },
    { key: "pluginPromo", visible: true },
    { key: "pricingTeaser", visible: true },
    { key: "faq", visible: true },
    { key: "finalCta", visible: true },
  ],
  showcase: { eyebrow: "01 — TEMPLATES", title: "A library of ready-made templates", linkLabel: "View all" },
  aiPromo: {
    eyebrow: "02 — AI STUDIO",
    title: "AI Studio — create in your browser",
    desc: "Images, video, voice and effects — from prompt to result in seconds. All in the browser.",
    ctaLabel: "Try it with 50 credits",
    cards: [
      // #117 (L3) — narxlar `gen-models.ts` dagi YOQILGAN modellarning eng arzonidan
      // hisoblanadi (`scripts/verify-public-copy.mjs` buni qadab qo'ygan). Ilgari
      // yozilgan qiymatlar (5 / 40 / 8 / 3) hech bir modelga mos emas edi; SFX ayniqsa
      // xavfli xato edi — e'lon 3 kredit, haqiqiy yagona model (ElevenLabs SFX) 4 kredit,
      // ya'ni mijozdan e'lon qilinganidan KO'PROQ olinardi.
      // Rasm: gemini-3.1-flash-lite-image = 2 · Video: veo-3.1-lite = 3 kr/sek ·
      // Ovoz: chirp3-hd = 4 · SFX: elevenlabs/sound-effects = 4.
      { title: "Image generation", desc: "High-quality visuals from text. In seconds.", cost: "from 2 credits" },
      { title: "Video generation", desc: "Moving scenes and clips from a prompt.", cost: "from 3 credits/sec" },
      { title: "Voice (Voiceover)", desc: "Natural-sounding voice from text — 30+ languages.", cost: "from 4 credits" },
      { title: "SFX", desc: "Generate effects and sounds that match your scene.", cost: "from 4 credits" },
    ],
    typingPrompts: [
      "A neon-lit city, rain reflections, cinematic shot…",
      "Sunrise over a mountain, drone shot, 4K…",
      "Clean backdrop for a modern logo animation, studio lighting…",
      "Slow motion on the shore, golden hour, film grain…",
    ],
    stackLabel: "NANO BANANA PRO · 2K",
    chipMode: "✦ Image",
    chipModel: "Nano Banana Pro",
    chipRes: "2K",
    chipCost: "✦ 14",
    chipGenerate: "Generate ↗",
  },
  pluginPromo: {
    eyebrow: "03 — PLUGIN",
    title: "The FrameFlow plugin — right inside After Effects",
    desc: "Catalog, import and AI Studio — in the panel. Works with your platform account and credits.",
    ctaLabel: "Download the plugin (.zxp)",
    chips: ["After Effects 2022+", "In-panel catalog", "AI Studio"],
    winTitle: "FrameFlow · After Effects",
    winSearch: "Search the catalog…",
    winImport: "Import to project",
  },
  pricingTeaser: {
    eyebrow: "04 — PRICING",
    title: "Start free, scale up when you need to",
    sub: "Cancel anytime. Refund eligibility is explained in the Refund Policy.",
    note: "Full comparison —",
    noteLink: "on the Pricing page →",
  },
  faqSection: {
    title: "Frequently asked questions",
    items: [
      { q: "How does FrameFlow work?", a: "Pick a template in your browser or create content in AI Studio, then download it directly or continue in the After Effects plugin." },
      { q: "What are credits and how are they spent?", a: "Credits are used for AI generations. Each image, video, or voice generation spends a set amount of credits. Downloading templates does not require credits." },
      { q: "What's included in the Free plan?", a: "50 monthly credits, the full template library at any resolution, core AI tools, and 15 downloads per month. Pro raises your monthly credits and gives unlimited downloads." },
      { q: "How do I install the plugin?", a: "Download the .zxp file from the Plugin page, install it with the installer, and connect it to your account on the platform. Ready in minutes." },
      { q: "Can I cancel my subscription anytime?", a: "Yes, you can cancel your subscription anytime. Access remains until the end of the current billing period." },
    ],
  },
  finalCta: {
    title: "Start free today",
    sub: "Sign up — get 50 AI credits on us. No card required.",
    ctaLabel: "Start for free",
    credline: "Refund eligibility is explained in the Refund Policy",
    eyebrow: "YOUR NEXT FRAME IS WAITING",
    secondaryLabel: "Browse templates",
  },
  appHome: {
    heroSub: "Pick up where you left off, or start something new.",
    quick: [
      { title: "Find a template", desc: "Browse the template library" },
      { title: "Create with AI", desc: "Image · Video · Voiceover · SFX" },
      { title: "Install the plugin", desc: "Browse & import inside After Effects" },
    ],
    shelfCat: "Lower Thirds",
    secJump: "Jump back in",
    secJumpLink: "Open AI Studio",
    secStart: "Start creating",
    emptyTitle: "No generations yet",
    emptySub: "Create your first image or video in AI Studio",
    emptyBtn: "Open AI Studio",
    secFeatured: "Featured models",
    secRec: "Recommended for you",
    recLink: "Browse all templates",
    shelfFreshKick: "FRESH PICKS",
    shelfFresh: "Recently updated",
    shelfCatKick: "CURATED · CATEGORY",
    shelfNewKick: "LATEST APPROVED",
    shelfNew: "New this week",
  },
  catalogPage: {
    kicker: "FRAMEFLOW MARKETPLACE",
    title: "A stock catalog that cuts\nyour edit time.",
    searchPlaceholder: 'Try "glitch logo", "wedding titles", "lower thirds"…',
    loading: "Hanging the template wall…",
    emptyTitle: "Nothing found",
    emptySub: "Try a different search or loosen the filters.",
  },
  footer: {
    tagline: "Templates and an AI studio for motion designers and video creators.",
    email: "support@getframeflow.app",
    copyright: "© 2026 FrameFlow",
    guarantee: "Refund eligibility is explained in the Refund Policy",
    cols: [
      { title: "PRODUCT", links: ["Templates", "AI Studio", "Plugin", "Pricing"] },
      { title: "CATEGORIES", links: ["Video templates", "Lower Thirds", "Transitions", "LUTs & Presets", "SFX"] },
      { title: "LEGAL", links: ["Help & FAQ", "Terms of Service", "Privacy Policy", "Refund Policy"] },
    ],
  },
  pricingPage: {
    eyebrow: "PRICING",
    title: "Choose the plan that fits you",
    sub: "Start free, scale up when you need to. Cancel anytime.",
    faqTitle: "Questions",
    billingNote: "MONTHLY PLANS",
    billingSub: "Refund eligibility is explained in the Refund Policy",
    popularLabel: "MOST POPULAR",
    compareTitle: "ALL PLANS INCLUDE",
    compareItems: ["Browser AI Studio", "Template previews", "Commercial license", "Refund Policy applies"],
  },
  plans: [
    {
      name: "Free", price: 0, credits: "50 credits/mo", sub: "For trying it out", cta: "Get started",
      feats: ["50 AI credits per month", "Full template library, any resolution", "15 downloads per month", "1 active project", "Community support"],
      teaserFeats: ["Full template library, any resolution", "15 downloads per month", "1 active project"],
    },
    {
      // §E (P2) — OWNER: 4K/watermark endi Pro-only EMAS (P1'da watermark olib tashlandi, 4K gate yo'q).
      // Free↔Pro yagona farqi endi: oylik yuklab olishlar (Free 15 → Pro cheksiz) + kreditlar.
      // "4K, watermark-free downloads" yolg'on reklama edi → "Unlimited downloads" bilan almashtirildi.
      name: "Pro", price: 19, credits: "1,000 credits/mo", sub: "For professionals", cta: "Upgrade to Pro",
      feats: ["1,000 AI credits per month", "Full template library, any resolution", "Unlimited downloads", "Unlimited projects", "After Effects plugin", "Email support"],
      teaserFeats: ["Full template library, any resolution", "Unlimited downloads", "After Effects plugin"],
    },
    {
      // P27 D2 — Studio 6,000 → 3,000 kredit (og'ir tarifda ~2× marja tiklandi). D4 — "API access"
      // (public API YO'Q) va "Priority render queue" (priority queue YO'Q) olib tashlandi.
      // Launch Task B — jamoa/brendkit/shaxsiy menejer imtiyozlari olib tashlandi: bularning
      // hech biri kodda/DB'da amalga oshirilmagan (grep tasdiqladi).
      // #132 (X11) — Studio kartasida atigi 2 bullet bor edi (Pro'da 6): "Everything in Pro"
      // hech narsa aytmaydi va qimmatroq tarif arzonrog'idan KAMBAG'AL ko'rinardi. Bulletlar
      // Pro'nikidan KO'CHIRILDI (Studio ularning hammasini o'z ichiga oladi) — yangi
      // (mavjud bo'lmagan) imtiyoz QO'SHILMADI. `sub` ham "For teams" edi-yu jamoa
      // funksiyalari yo'q → "For high-volume work".
      name: "Studio", price: 59, credits: "3,000 credits/mo", sub: "For high-volume work", cta: "Choose Studio",
      feats: ["3,000 AI credits per month", "Full template library, any resolution", "Unlimited downloads", "Unlimited projects", "After Effects plugin", "Email support"],
      teaserFeats: ["3,000 credits per month", "Unlimited downloads", "After Effects plugin"],
    },
  ],
  pluginPage: {
    badge: "After Effects 2022+",
    title: "Install the FrameFlow plugin in one click",
    sub: "Catalog, import and AI Studio — right inside After Effects. With your account and credits.",
    ctaLabel: "Download the plugin (.zxp)",
    versionNote: "Compatible ZXP installer · requires After Effects 2022 (22.0) or newer",
    guarantee: "Refund eligibility is explained in the Refund Policy",
    steps: [
      { t: "Download the .zxp file", d: "Get the latest version from the platform in one click." },
      { t: "Install with a compatible ZXP installer", d: "Install quickly with any compatible ZXP installer." },
      { t: "Connect your account", d: "Enter your platform key — templates and credits are ready." },
    ],
    winTitle: "FrameFlow · After Effects",
    winSearch: "Search templates",
    mockName: "Football Championship",
    mockImport: "Import",
  },
  uiStyles: {},
  notices: [],
};

// PUT validatsiyasi — hamma maydon ixtiyoriy (qisman saqlash mumkin), lekin
// kelgan qiymat tip/o'lcham bo'yicha qat'iy tekshiriladi.
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "accent must be #RRGGBB");
const shortText = z.string().max(120);
const longText = z.string().max(600);
// mediaUrl — faqat https (yoki bo'sh); localhost dev uchun http ham qabul qilinadi.
const mediaUrl = z
  .string()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "mediaUrl must be http(s)");

const cardSchema = z.object({
  label: z.string().max(24),
  dur: z.string().max(12),
  mediaUrl,
  mediaType: z.enum(["", "image", "video"]),
});

const statSchema = z.object({
  value: z.number().int().min(0).max(100_000_000),
  // SC_63 fix: default suffix "connected workflow" (18 belgi) 12-limitdan oshardi —
  // Website tab saqlashi 400 bilan yiqilardi (yashirin mavjud bug).
  suffix: z.string().max(24),
  label: shortText,
});

const SECTION_KEYS = [
  "ticker",
  "stats",
  "cinema",
  "showcase",
  "presets",
  "aiPromo",
  "pluginPromo",
  "pricingTeaser",
  "faq",
  "finalCta",
] as const;
// v2 media-slot bo'limlari uchun umumiy zod bo'laklari
const mediaSlot = { mediaUrl: mediaUrl.optional(), mediaType: z.enum(["", "image", "video"]).optional() };
const featsList = z.array(z.string().max(90)).min(1).max(12);
const planCopySchema = z.object({
  name: shortText.optional(),
  price: z.number().min(0).max(100_000).optional(), // DISPLAY narx — billing'ga ta'sir qilmaydi
  credits: shortText.optional(),
  sub: shortText.optional(),
  cta: shortText.optional(),
  feats: featsList.optional(),
  teaserFeats: z.array(z.string().max(90)).min(1).max(3).optional(),
});

// ── v3 — uslub qatlami va bildirishnomalar sxemasi ──
// Faqat tipli qiymatlar: XOM CSS satri qabul qilinmaydi (injection yuzasi yopiq).
const cssColor = z.string().regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})?$/, "color must be #RGB/#RRGGBB or empty");
const stylePropsSchema = z
  .object({
    fontSize: z.number().min(8).max(200).optional(),
    fontWeight: z.number().int().min(100).max(900).optional(),
    lineHeight: z.number().min(0.7).max(2.8).optional(),
    letterSpacing: z.number().min(-0.15).max(0.5).optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    textTransform: z.enum(["none", "uppercase", "capitalize"]).optional(),
    color: cssColor.optional(),
    bg: cssColor.optional(),
    padY: z.number().min(0).max(200).optional(),
    padX: z.number().min(0).max(200).optional(),
    marginTop: z.number().min(-300).max(400).optional(),
    marginBottom: z.number().min(-300).max(400).optional(),
    offsetX: z.number().min(-600).max(600).optional(),
    offsetY: z.number().min(-600).max(600).optional(),
    scale: z.number().min(0.4).max(2.5).optional(),
    rotate: z.number().min(-30).max(30).optional(),
    radius: z.number().min(0).max(120).optional(),
    maxWidth: z.number().min(0).max(1800).optional(),
    opacity: z.number().min(0).max(1).optional(),
    shadow: z.number().int().min(0).max(4).optional(),
    borderWidth: z.number().min(0).max(8).optional(),
    borderColor: cssColor.optional(),
    hidden: z.boolean().optional(),
  })
  .strict();
export const elementStyleSchema = z.object({ d: stylePropsSchema.optional(), m: stylePropsSchema.optional() }).strict();

export const MAX_NOTICES = 8;
export const noticeSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    enabled: z.boolean().optional(),
    placement: z.enum(["banner", "toast", "modal"]).optional(),
    tone: z.enum(["info", "promo", "warn", "success"]).optional(),
    audience: z.enum(["all", "guest", "user"]).optional(),
    title: shortText.optional(),
    text: longText.optional(),
    ctaLabel: z.string().max(40).optional(),
    ctaTarget: z.enum(["", "landing", "pricing", "plugin", "templates", "aistudio", "account", "dashboard"]).optional(),
    ctaUrl: z.string().max(400).regex(/^(https:\/\/.+)?$/, "ctaUrl must be https or empty").optional(),
    dismissable: z.boolean().optional(),
    startAt: z.string().max(40).optional(),
    endAt: z.string().max(40).optional(),
  })
  .strict();

export const landingConfigSchema = z
  .object({
    theme: z
      .object({
        accent: hexColor.optional(),
        font: z.enum(["hanken", "system", "plex-mono", "georgia"]).optional(),
      })
      .optional(),
    nav: z
      .object({
        templates: shortText.optional(),
        aiStudio: shortText.optional(),
        pricing: shortText.optional(),
        plugin: shortText.optional(),
        signIn: shortText.optional(),
        cta: shortText.optional(),
        pluginBadge: z.string().max(16).optional(),
      })
      .optional(),
    hero: z
      .object({
        badgeTag: z.string().max(16).optional(),
        badgeText: shortText.optional(),
        title: z.string().max(200).optional(),
        titleAccent: shortText.optional(),
        sub: longText.optional(),
        ctaPrimary: shortText.optional(),
        ctaSecondary: shortText.optional(),
        credline: shortText.optional(),
      })
      .optional(),
    mockup: z
      .object({
        title: shortText.optional(),
        badge: z.string().max(16).optional(),
        cards: z.array(cardSchema).length(6).optional(),
      })
      .optional(),
    // ── v2 bo'limlari ──
    heroMedia: z.object({ ...mediaSlot, time: z.string().max(12).optional(), caption: shortText.optional() }).optional(),
    promo: z
      .object({
        enabled: z.boolean().optional(),
        tag: z.string().max(16).optional(),
        text: shortText.optional(),
        ctaLabel: z.string().max(40).optional(),
        showInApp: z.boolean().optional(),
      })
      .optional(),
    ticker: z
      .object({ label: shortText.optional(), items: z.array(z.string().max(40)).min(1).max(12).optional() })
      .optional(),
    cinema: z
      .object({
        ...mediaSlot,
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        linkLabel: shortText.optional(),
        barLeft: shortText.optional(),
        barRight: shortText.optional(),
        word: z.string().max(40).optional(),
        footTitle: shortText.optional(),
        footSub: shortText.optional(),
        cost: z.string().max(16).optional(),
      })
      .optional(),
    presetsRail: z
      .object({
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        linkLabel: shortText.optional(),
        items: z
          .array(z.object({ ...mediaSlot, title: shortText.optional(), sub: shortText.optional() }))
          .length(4)
          .optional(),
      })
      .optional(),
    feed: z
      .object({
        note: shortText.optional(),
        cards: z
          .array(
            z.object({
              ...mediaSlot,
              title: z.string().max(60).optional(),
              cat: z.string().max(40).optional(),
              dur: z.string().max(12).optional(),
              badge: z.string().max(12).optional(),
            })
          )
          .length(11)
          .optional(),
      })
      .optional(),
    megaModels: z
      .object({
        rows: z
          .array(
            z.object({
              initials: z.string().max(4).optional(),
              title: shortText.optional(),
              sub: shortText.optional(),
              badge: z.string().max(12).optional(),
              price: z.string().max(16).optional(),
            })
          )
          .length(4)
          .optional(),
      })
      .optional(),
    stats: z.array(statSchema).length(4).optional(),
    // ── To'liq sayt CMS bo'limlari ──
    landingSections: z
      .array(z.object({ key: z.enum(SECTION_KEYS), visible: z.boolean() }))
      .max(SECTION_KEYS.length)
      .refine((a) => new Set(a.map((s) => s.key)).size === a.length, "duplicate section key")
      .optional(),
    showcase: z
      .object({ eyebrow: shortText.optional(), title: shortText.optional(), linkLabel: shortText.optional() })
      .optional(),
    aiPromo: z
      .object({
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        desc: longText.optional(),
        ctaLabel: shortText.optional(),
        cards: z.array(z.object({ title: shortText.optional(), desc: longText.optional(), cost: z.string().max(24).optional() })).length(4).optional(),
        typingPrompts: z.array(z.string().max(120)).min(1).max(6).optional(),
        stackLabel: z.string().max(40).optional(),
        chipMode: z.string().max(24).optional(),
        chipModel: z.string().max(40).optional(),
        chipRes: z.string().max(12).optional(),
        chipCost: z.string().max(12).optional(),
        chipGenerate: z.string().max(24).optional(),
      })
      .optional(),
    pluginPromo: z
      .object({
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        desc: longText.optional(),
        ctaLabel: shortText.optional(),
        chips: z.array(z.string().max(40)).length(3).optional(),
        winTitle: shortText.optional(),
        winSearch: shortText.optional(),
        winImport: shortText.optional(),
      })
      .optional(),
    pricingTeaser: z
      .object({
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        sub: longText.optional(),
        note: shortText.optional(),
        noteLink: shortText.optional(),
      })
      .optional(),
    faqSection: z
      .object({
        title: shortText.optional(),
        items: z.array(z.object({ q: z.string().max(200).optional(), a: longText.optional() })).length(5).optional(),
      })
      .optional(),
    finalCta: z
      .object({
        title: shortText.optional(),
        sub: longText.optional(),
        ctaLabel: shortText.optional(),
        credline: shortText.optional(),
        eyebrow: shortText.optional(),
        secondaryLabel: shortText.optional(),
      })
      .optional(),
    appHome: z
      .object({
        heroSub: longText.optional(),
        quick: z.array(z.object({ title: shortText.optional(), desc: shortText.optional() })).length(3).optional(),
        shelfCat: z.string().max(40).optional(),
        secJump: shortText.optional(),
        secJumpLink: shortText.optional(),
        secStart: shortText.optional(),
        emptyTitle: shortText.optional(),
        emptySub: longText.optional(),
        emptyBtn: shortText.optional(),
        secFeatured: shortText.optional(),
        secRec: shortText.optional(),
        recLink: shortText.optional(),
        shelfFreshKick: shortText.optional(),
        shelfFresh: shortText.optional(),
        shelfCatKick: shortText.optional(),
        shelfNewKick: shortText.optional(),
        shelfNew: shortText.optional(),
      })
      .optional(),
    catalogPage: z
      .object({
        kicker: shortText.optional(),
        title: z.string().max(120).optional(),
        searchPlaceholder: shortText.optional(),
        loading: shortText.optional(),
        emptyTitle: shortText.optional(),
        emptySub: longText.optional(),
      })
      .optional(),
    footer: z
      .object({
        tagline: longText.optional(),
        email: shortText.optional(),
        copyright: shortText.optional(),
        guarantee: shortText.optional(),
        cols: z.array(z.object({ title: shortText.optional(), links: z.array(z.string().max(60)).min(1).max(8).optional() })).length(3).optional(),
      })
      .optional(),
    pricingPage: z
      .object({
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        sub: longText.optional(),
        faqTitle: shortText.optional(),
        billingNote: shortText.optional(),
        billingSub: shortText.optional(),
        popularLabel: z.string().max(24).optional(),
        compareTitle: shortText.optional(),
        compareItems: z.array(z.string().max(60)).min(1).max(6).optional(),
      })
      .optional(),
    plans: z.array(planCopySchema).length(3).optional(),
    pluginPage: z
      .object({
        badge: shortText.optional(),
        title: shortText.optional(),
        sub: longText.optional(),
        ctaLabel: shortText.optional(),
        versionNote: shortText.optional(),
        guarantee: shortText.optional(),
        steps: z.array(z.object({ t: shortText.optional(), d: longText.optional() })).length(3).optional(),
        winTitle: shortText.optional(),
        winSearch: shortText.optional(),
        mockName: shortText.optional(),
        mockImport: shortText.optional(),
      })
      .optional(),
    // v3 — element uslub qatlami. Kalit = data-cms yo'li (harf/raqam/nuqta/tire).
    uiStyles: z.record(z.string().regex(/^[A-Za-z0-9_.-]{1,90}$/), elementStyleSchema).optional(),
    notices: z.array(noticeSchema).max(MAX_NOTICES).optional(),
  })
  .strict();

export type LandingConfigPatch = z.infer<typeof landingConfigSchema>;

/** Chuqur merge: saqlangan qisman blob defaultlar ustiga yoziladi.
 *  Ob'ekt-massivlar (cards/stats/steps/faq…) element-darajada merge — uzunlik defaultdagidek;
 *  satr-massivlar (feats/links/chips/prompts) butunicha almashadi (bo'lsa). */
function mergeConfig(stored: unknown): LandingConfigData {
  const d = DEFAULT_LANDING_CONFIG;
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, any>;
  const obj = <T extends Record<string, any>>(base: T, over: any): T =>
    over && typeof over === "object" ? { ...base, ...Object.fromEntries(Object.entries(over).filter(([k, v]) => k in base && v != null)) } : { ...base };
  // Fixed-length ob'ekt-massiv: default elementlari ustiga index bo'yicha merge
  const objArr = <T extends Record<string, any>>(base: T[], over: any): T[] =>
    base.map((el, i) => obj(el, Array.isArray(over) ? over[i] : null));
  // Satr-massiv: valid bo'lsa butunicha, aks holda default
  const strArr = (base: string[], over: any): string[] =>
    Array.isArray(over) && over.length && over.every((v) => typeof v === "string") ? over.slice(0, 12) : base;
  // landingSections: saqlangan TARTIB ustun; noma'lum kalitlar tushiriladi. Yetishmagan
  // (yangi qo'shilgan) bo'limlar DEFAULT POZITSIYASIGA qo'yiladi — default ro'yxatdagi
  // eng yaqin oldingi qo'shni topilib, undan keyin kiritiladi (oxiriga tushib qolmasin).
  const known = new Set(d.landingSections.map((x) => x.key));
  const storedSecs: LandingSectionOrder[] = Array.isArray(s.landingSections)
    ? s.landingSections
        .filter((x: any) => x && known.has(x.key))
        .map((x: any) => ({ key: String(x.key), visible: x.visible !== false }))
    : [];
  const seen = new Set(storedSecs.map((x) => x.key));
  const landingSections = storedSecs.slice();
  for (const m of d.landingSections.filter((x) => !seen.has(x.key))) {
    const defIdx = d.landingSections.findIndex((x) => x.key === m.key);
    let insertAt = -1;
    for (let i = defIdx - 1; i >= 0 && insertAt < 0; i--) {
      const p = landingSections.findIndex((x) => x.key === d.landingSections[i].key);
      if (p >= 0) insertAt = p + 1;
    }
    landingSections.splice(insertAt < 0 ? 0 : insertAt, 0, { key: m.key, visible: m.visible });
  }
  const plans = d.plans.map((p, i) => {
    const o = Array.isArray(s.plans) ? s.plans[i] : null;
    const merged = obj(p, o);
    merged.feats = strArr(p.feats, o?.feats);
    merged.teaserFeats = strArr(p.teaserFeats, o?.teaserFeats);
    return merged;
  });
  return {
    theme: obj(d.theme, s.theme),
    nav: obj(d.nav, s.nav),
    hero: obj(d.hero, s.hero),
    mockup: {
      ...obj({ title: d.mockup.title, badge: d.mockup.badge }, s.mockup),
      cards: objArr(d.mockup.cards, s.mockup?.cards),
    },
    heroMedia: obj(d.heroMedia, s.heroMedia),
    promo: obj(d.promo, s.promo),
    ticker: {
      label: (typeof s.ticker?.label === "string" && s.ticker.label) || d.ticker.label,
      items: strArr(d.ticker.items, s.ticker?.items),
    },
    cinema: obj(d.cinema, s.cinema),
    presetsRail: {
      ...obj(
        { eyebrow: d.presetsRail.eyebrow, title: d.presetsRail.title, linkLabel: d.presetsRail.linkLabel },
        s.presetsRail
      ),
      items: objArr(d.presetsRail.items, s.presetsRail?.items),
    },
    feed: {
      note: (typeof s.feed?.note === "string" && s.feed.note) || d.feed.note,
      cards: objArr(d.feed.cards, s.feed?.cards),
    },
    megaModels: { rows: objArr(d.megaModels.rows, s.megaModels?.rows) },
    stats: objArr(d.stats, s.stats),
    landingSections,
    showcase: obj(d.showcase, s.showcase),
    aiPromo: {
      ...obj(
        {
          eyebrow: d.aiPromo.eyebrow,
          title: d.aiPromo.title,
          desc: d.aiPromo.desc,
          ctaLabel: d.aiPromo.ctaLabel,
          stackLabel: d.aiPromo.stackLabel,
          chipMode: d.aiPromo.chipMode,
          chipModel: d.aiPromo.chipModel,
          chipRes: d.aiPromo.chipRes,
          chipCost: d.aiPromo.chipCost,
          chipGenerate: d.aiPromo.chipGenerate,
        },
        s.aiPromo
      ),
      cards: objArr(d.aiPromo.cards, s.aiPromo?.cards),
      typingPrompts: strArr(d.aiPromo.typingPrompts, s.aiPromo?.typingPrompts),
    },
    pluginPromo: {
      ...obj(
        {
          eyebrow: d.pluginPromo.eyebrow,
          title: d.pluginPromo.title,
          desc: d.pluginPromo.desc,
          ctaLabel: d.pluginPromo.ctaLabel,
          winTitle: d.pluginPromo.winTitle,
          winSearch: d.pluginPromo.winSearch,
          winImport: d.pluginPromo.winImport,
        },
        s.pluginPromo
      ),
      chips: strArr(d.pluginPromo.chips, s.pluginPromo?.chips),
    },
    pricingTeaser: obj(d.pricingTeaser, s.pricingTeaser),
    faqSection: {
      title: (typeof s.faqSection?.title === "string" && s.faqSection.title) || d.faqSection.title,
      items: objArr(d.faqSection.items, s.faqSection?.items),
    },
    finalCta: obj(d.finalCta, s.finalCta),
    appHome: {
      ...obj(
        {
          heroSub: d.appHome.heroSub,
          shelfCat: d.appHome.shelfCat,
          secJump: d.appHome.secJump,
          secJumpLink: d.appHome.secJumpLink,
          secStart: d.appHome.secStart,
          emptyTitle: d.appHome.emptyTitle,
          emptySub: d.appHome.emptySub,
          emptyBtn: d.appHome.emptyBtn,
          secFeatured: d.appHome.secFeatured,
          secRec: d.appHome.secRec,
          recLink: d.appHome.recLink,
          shelfFreshKick: d.appHome.shelfFreshKick,
          shelfFresh: d.appHome.shelfFresh,
          shelfCatKick: d.appHome.shelfCatKick,
          shelfNewKick: d.appHome.shelfNewKick,
          shelfNew: d.appHome.shelfNew,
        },
        s.appHome
      ),
      quick: objArr(d.appHome.quick, s.appHome?.quick),
    },
    catalogPage: obj(d.catalogPage, s.catalogPage),
    footer: {
      ...obj(
        { tagline: d.footer.tagline, email: d.footer.email, copyright: d.footer.copyright, guarantee: d.footer.guarantee },
        s.footer
      ),
      cols: d.footer.cols.map((c, i) => {
        const o = Array.isArray(s.footer?.cols) ? s.footer.cols[i] : null;
        return { title: (o && typeof o.title === "string" && o.title) || c.title, links: strArr(c.links, o?.links) };
      }),
    },
    pricingPage: {
      ...obj(
        {
          eyebrow: d.pricingPage.eyebrow,
          title: d.pricingPage.title,
          sub: d.pricingPage.sub,
          faqTitle: d.pricingPage.faqTitle,
          billingNote: d.pricingPage.billingNote,
          billingSub: d.pricingPage.billingSub,
          popularLabel: d.pricingPage.popularLabel,
          compareTitle: d.pricingPage.compareTitle,
        },
        s.pricingPage
      ),
      compareItems: strArr(d.pricingPage.compareItems, s.pricingPage?.compareItems),
    },
    plans,
    pluginPage: {
      ...obj(
        {
          badge: d.pluginPage.badge, title: d.pluginPage.title, sub: d.pluginPage.sub,
          ctaLabel: d.pluginPage.ctaLabel, versionNote: d.pluginPage.versionNote, guarantee: d.pluginPage.guarantee,
          winTitle: d.pluginPage.winTitle, winSearch: d.pluginPage.winSearch,
          mockName: d.pluginPage.mockName, mockImport: d.pluginPage.mockImport,
        },
        s.pluginPage
      ),
      steps: objArr(d.pluginPage.steps, s.pluginPage?.steps),
    },
    uiStyles: normalizeUiStyles(s.uiStyles),
    notices: normalizeNotices(s.notices),
  };
}

/** Saqlangan uslub blobini xavfsiz shaklga keltiradi — zod sxemasi bilan bir xil
 *  chegaralar (blob DB'da eski/qo'lda o'zgargan bo'lishi mumkin). */
export function normalizeUiStyles(raw: unknown): Record<string, SiteElementStyle> {
  const out: Record<string, SiteElementStyle> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [path, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_.-]{1,90}$/.test(path)) continue;
    const parsed = elementStyleSchema.safeParse(val);
    if (!parsed.success) continue;
    const entry: SiteElementStyle = {};
    if (parsed.data.d && Object.keys(parsed.data.d).length) entry.d = parsed.data.d;
    if (parsed.data.m && Object.keys(parsed.data.m).length) entry.m = parsed.data.m;
    if (entry.d || entry.m) out[path] = entry;
  }
  return out;
}

export function normalizeNotices(raw: unknown): SiteNotice[] {
  if (!Array.isArray(raw)) return [];
  const out: SiteNotice[] = [];
  for (const item of raw.slice(0, MAX_NOTICES)) {
    const parsed = noticeSchema.safeParse(item);
    if (!parsed.success) continue;
    const n = parsed.data;
    out.push({
      id: n.id,
      enabled: n.enabled !== false,
      placement: n.placement || "banner",
      tone: n.tone || "info",
      audience: n.audience || "all",
      title: n.title || "",
      text: n.text || "",
      ctaLabel: n.ctaLabel || "",
      ctaTarget: n.ctaTarget || "",
      ctaUrl: n.ctaUrl || "",
      dismissable: n.dismissable !== false,
      startAt: n.startAt || "",
      endAt: n.endAt || "",
    });
  }
  return out;
}

// Yengil in-memory kesh — public GET issiq yo'l (har landing ochilishi).
// PUT/DELETE keshni buzadi; TTL boshqa instans yozgan holat uchun.
let _cache: { at: number; merged: LandingConfigData; updatedAt: string | null } | null = null;
const CACHE_TTL_MS = 30_000;

export function bustLandingConfigCache(): void {
  _cache = null;
}

export async function getLandingConfig(): Promise<{
  config: LandingConfigData;
  updatedAt: string | null;
}> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return { config: _cache.merged, updatedAt: _cache.updatedAt };
  }
  let row: { data: unknown; updatedAt: Date } | null = null;
  try {
    row = await prisma.landingConfig.findUnique({ where: { id: 1 } });
  } catch (e) {
    // Jadval hali migratsiya qilinmagan bo'lsa ham landing yiqilmasin — defaultlar.
    console.warn("[landing-config] read failed, defaults used:", (e as Error)?.message);
  }
  const merged = mergeConfig(row?.data);
  const updatedAt = row ? row.updatedAt.toISOString() : null;
  _cache = { at: Date.now(), merged, updatedAt };
  return { config: merged, updatedAt };
}

/** Saqlash — kelgan qisman patch mavjud saqlangan blob ustiga chuqur qo'shiladi
 *  (bo'lim-darajada), shunda admin bitta bo'limni yuborsa qolganlari yo'qolmaydi. */
export async function saveLandingConfig(
  patch: LandingConfigPatch,
  updatedById: string | null
): Promise<LandingConfigData> {
  const existing = await prisma.landingConfig.findUnique({ where: { id: 1 } });
  const prev = (existing?.data && typeof existing.data === "object" ? existing.data : {}) as Record<string, any>;
  const next: Record<string, any> = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    if (Array.isArray(v)) next[k] = v;
    else if (typeof v === "object") next[k] = { ...(prev[k] || {}), ...v };
    else next[k] = v;
  }
  await prisma.landingConfig.upsert({
    where: { id: 1 },
    create: { id: 1, data: next as Prisma.InputJsonValue, updatedById },
    update: { data: next as Prisma.InputJsonValue, updatedById },
  });
  bustLandingConfigCache();
  // SC_62 — versiya tarixi: yangi saqlangan blob snapshot (jim muvaffaqiyatsizlik OK)
  await recordContentRevision("landing", next, updatedById);
  return mergeConfig(next);
}

/** SC_62 restore — saqlangan blob TO'LIQ almashtiriladi (revision snapshot'idan). */
export async function replaceLandingConfigBlob(
  data: Record<string, unknown>,
  updatedById: string | null
): Promise<LandingConfigData> {
  const blob = (data && typeof data === "object" ? data : {}) as Prisma.InputJsonValue;
  await prisma.landingConfig.upsert({
    where: { id: 1 },
    create: { id: 1, data: blob, updatedById },
    update: { data: blob, updatedById },
  });
  bustLandingConfigCache();
  return mergeConfig(data);
}

/** Reset — saqlangan qatorni o'chiradi; landing defaultlarga (joriy kontent) qaytadi. */
export async function resetLandingConfig(): Promise<LandingConfigData> {
  await prisma.landingConfig.deleteMany({ where: { id: 1 } });
  bustLandingConfigCache();
  return DEFAULT_LANDING_CONFIG;
}
