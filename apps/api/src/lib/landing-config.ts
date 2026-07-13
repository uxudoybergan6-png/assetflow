import { prisma, Prisma } from "@creative-tools/database";
import { z } from "zod";

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
    cards: LandingMockupCard[]; // 6 ta: 3 kvadrat, 1 keng (video), 2 shablon
  };
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
  };
  pluginPromo: { eyebrow: string; title: string; desc: string; ctaLabel: string; chips: string[] }; // chips 3 ta
  pricingTeaser: { eyebrow: string; title: string; sub: string; note: string; noteLink: string };
  faqSection: { title: string; items: { q: string; a: string }[] }; // 5 ta — pricing sahifada ham shu
  finalCta: { title: string; sub: string; ctaLabel: string; credline: string };
  footer: {
    tagline: string;
    email: string;
    copyright: string;
    guarantee: string;
    cols: { title: string; links: string[] }[]; // 3 ustun — faqat YORLIQLAR (havola manzillari kodda)
  };
  pricingPage: { eyebrow: string; title: string; sub: string; faqTitle: string };
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
  };
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
  stats: [
    { value: 10000, suffix: "+", label: "Ready-made templates" },
    { value: 4, suffix: "", label: "AI tools — image · video · voice · SFX" },
    { value: 6, suffix: "", label: "Categories — Ae · Pr · DaVinci" },
    { value: 14, suffix: "days", label: "Money-back guarantee" },
  ],
  landingSections: [
    { key: "stats", visible: true },
    { key: "showcase", visible: true },
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
      { title: "Image generation", desc: "High-quality visuals from text. In seconds.", cost: "5 credits" },
      { title: "Video generation", desc: "Moving scenes and clips from a prompt.", cost: "40 credits" },
      { title: "Voice (Voiceover)", desc: "Natural-sounding voice from text — 30+ languages.", cost: "8 credits" },
      { title: "SFX", desc: "Generate effects and sounds that match your scene.", cost: "3 credits" },
    ],
    typingPrompts: [
      "A neon-lit city, rain reflections, cinematic shot…",
      "Sunrise over a mountain, drone shot, 4K…",
      "Clean backdrop for a modern logo animation, studio lighting…",
      "Slow motion on the shore, golden hour, film grain…",
    ],
  },
  pluginPromo: {
    eyebrow: "03 — PLUGIN",
    title: "The FrameFlow plugin — right inside After Effects",
    desc: "Catalog, import and AI Studio — in the panel. Works with your platform account and credits.",
    ctaLabel: "Download the plugin (.zxp)",
    chips: ["After Effects", "Premiere Pro", "DaVinci — coming soon"],
  },
  pricingTeaser: {
    eyebrow: "04 — PRICING",
    title: "Start free, scale up when you need to",
    sub: "Cancel anytime. All plans come with a 14-day money-back guarantee.",
    note: "Full comparison —",
    noteLink: "on the Pricing page →",
  },
  faqSection: {
    title: "Frequently asked questions",
    items: [
      { q: "How does FrameFlow work?", a: "Pick a template in your browser or create content in AI Studio, then download it directly or continue in the After Effects plugin." },
      { q: "What are credits and how are they spent?", a: "Credits are used for AI generations. Each image, video, or voice generation spends a set amount of credits. Downloading templates does not require credits." },
      { q: "What's included in the Free plan?", a: "50 monthly credits, the HD template library, and core AI tools. The Pro plan unlocks watermark-free 4K export and unlimited templates." },
      { q: "How do I install the plugin?", a: "Download the .zxp file from the Plugin page, install it with the installer, and connect it to your account on the platform. Ready in minutes." },
      { q: "Can I cancel my subscription anytime?", a: "Yes, you can cancel your subscription anytime. Access remains until the end of the current billing period." },
    ],
  },
  finalCta: {
    title: "Start free today",
    sub: "Sign up — get 50 AI credits on us. No card required.",
    ctaLabel: "Start for free",
    credline: "14-day money-back guarantee",
  },
  footer: {
    tagline: "Templates and an AI studio for motion designers and video creators.",
    email: "support@getframeflow.app",
    copyright: "© 2026 FrameFlow",
    guarantee: "All plans come with a 14-day money-back guarantee",
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
  },
  plans: [
    {
      name: "Free", price: 0, credits: "50 credits/mo", sub: "For trying it out", cta: "Get started",
      feats: ["50 AI credits per month", "HD template library", "Watermarked export", "1 active project", "Community support"],
      teaserFeats: ["HD template library", "Watermarked export", "1 active project"],
    },
    {
      // P27 D4 — "Priority generation" olib tashlandi (gen-processor'da priority queue YO'Q, sotilib
      // bajarilmayotgan xususiyat = huquqiy xavf). "Watermarked/4K watermark-free" QOLADI — u
      // yagona real Free↔Pro farqi (P4/P23 GAP1 — watermark QURILISHI kerak, step 14).
      name: "Pro", price: 19, credits: "1,000 credits/mo", sub: "For professionals", cta: "Upgrade to Pro",
      feats: ["1,000 AI credits per month", "All 10,000+ templates", "4K, watermark-free downloads", "Unlimited projects", "AE / Premiere plugin", "Email support"],
      teaserFeats: ["All 10,000+ templates", "4K, watermark-free downloads", "AE / Premiere plugin"],
    },
    {
      // P27 D2 — Studio 6,000 → 3,000 kredit (og'ir tarifda ~2× marja tiklandi). D4 — "API access"
      // (public API YO'Q) va "Priority render queue" (priority queue YO'Q) olib tashlandi.
      name: "Studio", price: 59, credits: "3,000 credits/mo", sub: "For teams", cta: "Choose Studio",
      feats: ["3,000 AI credits per month", "Everything in Pro", "Team workspace (5 seats)", "Brand kit and templates", "Dedicated account manager"],
      teaserFeats: ["Team workspace (5 seats)", "Brand kit and templates", "Dedicated account manager"],
    },
  ],
  pluginPage: {
    badge: "After Effects · Premiere Pro",
    title: "Install the FrameFlow plugin in one click",
    sub: "Catalog, import and AI Studio — right inside your NLE. With your account and credits.",
    ctaLabel: "Download the plugin (.zxp)",
    versionNote: "v2.4.1 · ~18 MB · ZXP Installer or Creative Cloud",
    guarantee: "All plans come with a 14-day money-back guarantee",
    steps: [
      { t: "Download the .zxp file", d: "Get the latest version from the platform in one click." },
      { t: "Install with the installer", d: "Install quickly via ZXP Installer or Creative Cloud." },
      { t: "Connect your account", d: "Enter your platform key — templates and credits are ready." },
    ],
  },
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
  suffix: z.string().max(12),
  label: shortText,
});

const SECTION_KEYS = ["stats", "showcase", "aiPromo", "pluginPromo", "pricingTeaser", "faq", "finalCta"] as const;
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
      })
      .optional(),
    pluginPromo: z
      .object({
        eyebrow: shortText.optional(),
        title: shortText.optional(),
        desc: longText.optional(),
        ctaLabel: shortText.optional(),
        chips: z.array(z.string().max(40)).length(3).optional(),
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
      })
      .optional(),
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
  // landingSections: saqlangan TARTIB ustun; noma'lum kalitlar tushiriladi, yetishmaganlar
  // default tartibda oxiriga qo'shiladi (yangi bo'lim qo'shilsa eski saqlangan config buzilmasin).
  const known = new Set(d.landingSections.map((x) => x.key));
  const storedSecs: LandingSectionOrder[] = Array.isArray(s.landingSections)
    ? s.landingSections
        .filter((x: any) => x && known.has(x.key))
        .map((x: any) => ({ key: String(x.key), visible: x.visible !== false }))
    : [];
  const seen = new Set(storedSecs.map((x) => x.key));
  const landingSections = storedSecs.concat(d.landingSections.filter((x) => !seen.has(x.key)));
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
    stats: objArr(d.stats, s.stats),
    landingSections,
    showcase: obj(d.showcase, s.showcase),
    aiPromo: {
      ...obj(
        { eyebrow: d.aiPromo.eyebrow, title: d.aiPromo.title, desc: d.aiPromo.desc, ctaLabel: d.aiPromo.ctaLabel },
        s.aiPromo
      ),
      cards: objArr(d.aiPromo.cards, s.aiPromo?.cards),
      typingPrompts: strArr(d.aiPromo.typingPrompts, s.aiPromo?.typingPrompts),
    },
    pluginPromo: {
      ...obj(
        { eyebrow: d.pluginPromo.eyebrow, title: d.pluginPromo.title, desc: d.pluginPromo.desc, ctaLabel: d.pluginPromo.ctaLabel },
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
    pricingPage: obj(d.pricingPage, s.pricingPage),
    plans,
    pluginPage: {
      ...obj(
        {
          badge: d.pluginPage.badge, title: d.pluginPage.title, sub: d.pluginPage.sub,
          ctaLabel: d.pluginPage.ctaLabel, versionNote: d.pluginPage.versionNote, guarantee: d.pluginPage.guarantee,
        },
        s.pluginPage
      ),
      steps: objArr(d.pluginPage.steps, s.pluginPage?.steps),
    },
  };
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
  return mergeConfig(next);
}

/** Reset — saqlangan qatorni o'chiradi; landing defaultlarga (joriy kontent) qaytadi. */
export async function resetLandingConfig(): Promise<LandingConfigData> {
  await prisma.landingConfig.deleteMany({ where: { id: 1 } });
  bustLandingConfigCache();
  return DEFAULT_LANDING_CONFIG;
}
