import { prisma, Prisma } from "@creative-tools/database";
import { z } from "zod";

// ── Plugin CMS — konfiguratsiya manbai (landing-config.ts naqshi 1:1) ────────
// Bitta PluginContentConfig qatori (id=1) JSON blob saqlaydi; bu fayl DEFAULT
// qiymatlarni (= plaginning HOZIRGI hardcoded kontenti) va deep-merge'ni
// beradi. Qator yo'q/qisman bo'lsa yetishmagan maydonlar defaultdan to'ladi —
// admin tahrir qilmaguncha plagin bir pikselga ham o'zgarmaydi.
//
// 🔒 HARD GUARD: bu sxemada HECH QANDAY kredit/narx raqami va model-pricing
// maydoni YO'Q va bo'lmaydi. Plagindagi jonli narx chiplari (hero model chip,
// "FROM ✦N" badge) /api/studio/gen/models dan keladi — CMS nazoratidan tashqarida.

export interface PluginGuestFeature {
  title: string;
  sub: string;
}

export interface PluginAiLauncherCard {
  title: string;
  desc: string;
  mediaUrl: string;
  mediaType: "" | "image" | "video";
}

export interface PluginContentConfigData {
  home: {
    hero: {
      kicker: string;
      title: string;
      sub: string;
      ctaPrimary: string;
      ctaSecondary: string;
      mediaUrl: string;
      mediaType: "" | "image" | "video";
      // mediaMode: "auto" — foydalanuvchining oxirgi generatsiyasi ustun;
      // "media-first" — admin yuklagan media doim ko'rinadi.
      mediaMode: "auto" | "media-first";
    };
    // v2: home.cards YO'Q — "Start your next project" kartalari parallel
    // redesign (SC_07) bilan plagindan olib tashlangan; modellashtirilmaydi.
    sections: {
      recent: string;
      shelf: string;
      browseAll: string;
      // SC_56: plagin Home yangi bo'limlari sarlavhalari (additive) — admin tahrirlaydi.
      continueSessions: string;
      explore: string;
      categories: string;
    };
    // SC_52: admin-kuratsiya qilingan "New releases" va "Top templates" rellslari.
    // Faqat template ID'lari saqlanadi (denormalizatsiya YO'Q) — klient katalogdan hal qiladi.
    rails: {
      newReleases: { title: string; templateIds: string[] };
      topTemplates: { title: string; templateIds: string[] };
    };
  };
  guest: {
    // \n — qator uzilish pozitsiyasi (plagin <br> ga aylantiradi, textContent+split)
    title: string;
    sub: string;
    features: PluginGuestFeature[]; // 3 ta — #homeGuest .gu-f bloklari
  };
  aiLauncher: {
    title: string;
    // v4: `sub` YO'Q — "Prompt → result → import…" qatori mikromatn tozalashda
    // o'chirilgan; modellashtirilmaydi.
    cards: PluginAiLauncherCard[]; // 3 ta: image/video/audio; bo'sh = plagin o'z matnini saqlaydi
  };
}

// DEFAULTS = plaginning joriy ko'rinishi (AssetFlow_Plugin.html bilan AYNI matnlar).
export const DEFAULT_PLUGIN_CONTENT_CONFIG: PluginContentConfigData = {
  home: {
    hero: {
      kicker: "Your next frame",
      title: "Make something worth replaying.",
      sub: "Generate a key visual or start from a production-ready After Effects template.",
      ctaPrimary: "✦ Open AI Studio",
      ctaSecondary: "Open Stock Catalog",
      mediaUrl: "",
      mediaType: "",
      mediaMode: "auto",
    },
    sections: {
      recent: "Jump back in",
      shelf: "Fresh for your next cut",
      browseAll: "Browse all →",
      // SC_56: plagin Home yangi bo'lim sarlavhalari (default = plagin ships qiladigan matn)
      continueSessions: "Continue a session",
      explore: "Explore",
      categories: "Browse by category",
    },
    rails: {
      newReleases: { title: "New releases", templateIds: [] },
      topTemplates: { title: "Top templates", templateIds: [] },
    },
  },
  guest: {
    title: "Make After Effects\nmove faster.",
    sub: "Drop-in templates and AI generation —\nright inside your panel, synced with the web.",
    features: [
      { title: "Drag-and-drop templates", sub: "Broadcast, titles, promos — import straight into your comp." },
      { title: "Generate image, video, voice & SFX", sub: "Credit-based AI studio. Free plan starts with ✦ 50." },
      { title: "One library, everywhere", sub: "Imports, projects and gens sync with getframeflow.app." },
    ],
  },
  aiLauncher: {
    title: "AI Tools",
    cards: [
      { title: "", desc: "", mediaUrl: "", mediaType: "" },
      { title: "", desc: "", mediaUrl: "", mediaType: "" },
      { title: "", desc: "", mediaUrl: "", mediaType: "" },
    ],
  },
};

// PUT validatsiyasi — hamma maydon ixtiyoriy (qisman saqlash), qat'iy tip/o'lcham.
const shortText = z.string().max(200);
// mediaUrl — faqat https (yoki bo'sh); localhost dev uchun http ham qabul qilinadi.
const mediaUrl = z
  .string()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "mediaUrl must be http(s)");
const mediaType = z.enum(["", "image", "video"]);

const guestFeatureSchema = z.object({
  title: shortText.optional(),
  sub: shortText.optional(),
});

const aiCardSchema = z.object({
  title: shortText.optional(),
  desc: shortText.optional(),
  mediaUrl: mediaUrl.optional(),
  mediaType: mediaType.optional(),
});

export const pluginContentConfigSchema = z
  .object({
    home: z
      .object({
        hero: z
          .object({
            kicker: shortText.optional(),
            title: shortText.optional(),
            sub: shortText.optional(),
            ctaPrimary: shortText.optional(),
            ctaSecondary: shortText.optional(),
            mediaUrl: mediaUrl.optional(),
            mediaType: mediaType.optional(),
            mediaMode: z.enum(["auto", "media-first"]).optional(),
          })
          .optional(),
        sections: z
          .object({
            recent: shortText.optional(),
            shelf: shortText.optional(),
            browseAll: shortText.optional(),
            // SC_56: additive Home bo'lim sarlavhalari
            continueSessions: shortText.optional(),
            explore: shortText.optional(),
            categories: shortText.optional(),
          })
          .optional(),
        // SC_52: rails — har ro'yxatда ≤12 ta template ID + tahrirlanadigan sarlavha.
        rails: z
          .object({
            newReleases: z
              .object({ title: shortText.optional(), templateIds: z.array(z.string().max(60)).max(12).optional() })
              .optional(),
            topTemplates: z
              .object({ title: shortText.optional(), templateIds: z.array(z.string().max(60)).max(12).optional() })
              .optional(),
          })
          .optional(),
      })
      .optional(),
    guest: z
      .object({
        title: shortText.optional(),
        sub: shortText.optional(),
        features: z.array(guestFeatureSchema).max(3).optional(),
      })
      .optional(),
    aiLauncher: z
      .object({
        title: shortText.optional(),
        cards: z.array(aiCardSchema).length(3).optional(),
      })
      .optional(),
  })
  .strict();

export type PluginContentConfigPatch = z.infer<typeof pluginContentConfigSchema>;

/** Chuqur merge: saqlangan qisman blob defaultlar ustiga yoziladi.
 *  Ob'ekt-massivlar (features/cards) element-darajada merge — uzunlik defaultdagidek. */
function mergeConfig(stored: unknown): PluginContentConfigData {
  const d = DEFAULT_PLUGIN_CONTENT_CONFIG;
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, any>;
  const obj = <T extends Record<string, any>>(base: T, over: any): T =>
    over && typeof over === "object"
      ? { ...base, ...Object.fromEntries(Object.entries(over).filter(([k, v]) => k in base && v != null)) }
      : { ...base };
  const objArr = <T extends Record<string, any>>(base: T[], over: any): T[] =>
    base.map((el, i) => obj(el, Array.isArray(over) ? over[i] : null));
  // SC_52: rails merge — sarlavha (obj) + templateIds massivi (bevosita, agar massiv bo'lsa).
  const railList = (base: { title: string; templateIds: string[] }, over: any) => ({
    title: over && typeof over.title === "string" && over.title != null ? over.title : base.title,
    templateIds:
      over && Array.isArray(over.templateIds)
        ? over.templateIds.filter((x: unknown) => typeof x === "string" && x).slice(0, 12)
        : base.templateIds.slice(),
  });
  return {
    home: {
      hero: obj(d.home.hero, s.home?.hero),
      sections: obj(d.home.sections, s.home?.sections),
      rails: {
        newReleases: railList(d.home.rails.newReleases, s.home?.rails?.newReleases),
        topTemplates: railList(d.home.rails.topTemplates, s.home?.rails?.topTemplates),
      },
    },
    guest: {
      ...obj({ title: d.guest.title, sub: d.guest.sub }, s.guest),
      features: objArr(d.guest.features, s.guest?.features),
    },
    aiLauncher: {
      title: (typeof s.aiLauncher?.title === "string" && s.aiLauncher.title) || d.aiLauncher.title,
      cards: objArr(d.aiLauncher.cards, s.aiLauncher?.cards),
    },
  };
}

// Yengil in-memory kesh — public GET issiq yo'l (har plagin boot + 5-daq refresh).
let _cache: { at: number; merged: PluginContentConfigData; updatedAt: string | null } | null = null;
const CACHE_TTL_MS = 30_000;

export function bustPluginContentConfigCache(): void {
  _cache = null;
}

export async function getPluginContentConfig(): Promise<{
  config: PluginContentConfigData;
  updatedAt: string | null;
}> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return { config: _cache.merged, updatedAt: _cache.updatedAt };
  }
  let row: { data: unknown; updatedAt: Date } | null = null;
  try {
    row = await prisma.pluginContentConfig.findUnique({ where: { id: 1 } });
  } catch (e) {
    // Jadval hali migratsiya qilinmagan bo'lsa ham plagin yiqilmasin — defaultlar.
    console.warn("[plugin-content-config] read failed, defaults used:", (e as Error)?.message);
  }
  const merged = mergeConfig(row?.data);
  const updatedAt = row ? row.updatedAt.toISOString() : null;
  _cache = { at: Date.now(), merged, updatedAt };
  return { config: merged, updatedAt };
}

/** Saqlash — kelgan qisman patch mavjud saqlangan blob ustiga bo'lim-darajada qo'shiladi. */
export async function savePluginContentConfig(
  patch: PluginContentConfigPatch,
  updatedById: string | null
): Promise<PluginContentConfigData> {
  const existing = await prisma.pluginContentConfig.findUnique({ where: { id: 1 } });
  const prev = (existing?.data && typeof existing.data === "object" ? existing.data : {}) as Record<string, any>;
  const next: Record<string, any> = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    if (Array.isArray(v)) next[k] = v;
    else if (typeof v === "object") next[k] = { ...(prev[k] || {}), ...v };
    else next[k] = v;
  }
  await prisma.pluginContentConfig.upsert({
    where: { id: 1 },
    create: { id: 1, data: next as Prisma.InputJsonValue, updatedById },
    update: { data: next as Prisma.InputJsonValue, updatedById },
  });
  bustPluginContentConfigCache();
  return mergeConfig(next);
}

/** Reset — saqlangan qatorni o'chiradi; plagin defaultlarga (joriy kontent) qaytadi. */
export async function resetPluginContentConfig(): Promise<PluginContentConfigData> {
  await prisma.pluginContentConfig.deleteMany({ where: { id: 1 } });
  bustPluginContentConfigCache();
  return DEFAULT_PLUGIN_CONTENT_CONFIG;
}
