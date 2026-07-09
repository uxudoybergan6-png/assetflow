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
}

// DEFAULTS = landing'ning joriy ko'rinishi (platform/index.html bilan AYNI matnlar).
export const DEFAULT_LANDING_CONFIG: LandingConfigData = {
  theme: { accent: "#C2F04A", font: "hanken" },
  nav: {
    templates: "Templates",
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
  })
  .strict();

export type LandingConfigPatch = z.infer<typeof landingConfigSchema>;

/** Chuqur merge: saqlangan qisman blob defaultlar ustiga yoziladi.
 *  Massivlar (cards/stats) element-darajada merge bo'ladi — uzunlik defaultdagidek qoladi. */
function mergeConfig(stored: unknown): LandingConfigData {
  const d = DEFAULT_LANDING_CONFIG;
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, any>;
  const obj = <T extends Record<string, any>>(base: T, over: any): T =>
    over && typeof over === "object" ? { ...base, ...Object.fromEntries(Object.entries(over).filter(([k, v]) => k in base && v != null)) } : { ...base };
  const cards = d.mockup.cards.map((c, i) => obj(c, Array.isArray(s.mockup?.cards) ? s.mockup.cards[i] : null));
  const stats = d.stats.map((st, i) => obj(st, Array.isArray(s.stats) ? s.stats[i] : null));
  return {
    theme: obj(d.theme, s.theme),
    nav: obj(d.nav, s.nav),
    hero: obj(d.hero, s.hero),
    mockup: { ...obj({ title: d.mockup.title, badge: d.mockup.badge }, s.mockup), cards },
    stats,
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
