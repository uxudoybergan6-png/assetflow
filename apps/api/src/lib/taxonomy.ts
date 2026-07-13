/**
 * P1 (step 30) — KANONIK TAKSONOMIYA (upload · katalog · admin · plagin uchun YAGONA MANBA).
 *
 * Direktor talabi: "Uchta alohida ro'yxat BO'LMASIN." data.js (klient) va admin/plagin
 * shu strukturaning nusxasini saqlaydi (apps.ts naqshi) — ammo VALIDATSIYA + nav + AI
 * kategoriya ro'yxati SHU YERDAN keladi.
 *
 * Top-level (P1 CANONICAL TAXONOMY):
 *   1. Video Templates  kind=template  templateType=video-templates  → .zip, app: ae/pr/motion/resolve
 *   2. LUTs             kind=template  templateType=luts             → RAW .cube/.3dl/.look
 *   3. Stock            kind=stock:
 *      - Graphics          stockType=graphics         RAW .jpg/.jpeg/.png/.webp/.svg
 *      - Motion Graphics   stockType=motion-graphics  RAW .mp4/.mov
 *      - Music             stockType=music            RAW .wav/.mp3/.aiff
 *      - Sound Effects     stockType=sfx              RAW .wav/.aiff/.mp3
 *   4. AI Stock         — contributor YUKLAMAYDI (P3, Explore chain).
 */

export type AssetTaxon = {
  /** Barqaror kalit (upload/plagin/admin bir xil ishlatadi). */
  key: string;
  label: string;
  kind: "template" | "stock";
  /** templateType (kind=template) yoki null (stock). */
  templateType: string | null;
  /** stockType (kind=stock) yoki null (template). */
  stockType: string | null;
  /** Plagin nav tab kaliti (assetflow-catalog groupsByNav). */
  nav: string;
  /** Ingest quvuri: 'zip' (loyiha+preview) yoki 'asset' (xom fayl = pack). */
  sourceType: "zip" | "asset";
  /** Qabul qilinadigan kengaytmalar (kichik harf, nuqta bilan). */
  exts: string[];
  /** Media sinfi — spec/derivativ/plagin import mantiqi shunga qarab. */
  mediaClass: "project" | "lut" | "image" | "video" | "audio";
};

/**
 * Video Templates uchun app sub-step: kanonik APP_CONFIG (apps.ts) bilan mos.
 * Har bir app alohida taxon EMAS — templateType=video-templates, templateApp bilan farqlanadi.
 */
export const VIDEO_TEMPLATE_APPS = ["ae", "pr", "motion", "resolve"] as const;

export const TAXONOMY: AssetTaxon[] = [
  {
    key: "video-templates",
    label: "Video Templates",
    kind: "template",
    templateType: "video-templates",
    stockType: null,
    nav: "video",
    sourceType: "zip",
    exts: [".zip"],
    mediaClass: "project",
  },
  {
    key: "luts",
    label: "LUTs",
    kind: "template",
    templateType: "luts",
    stockType: null,
    nav: "luts",
    sourceType: "asset",
    exts: [".cube", ".3dl", ".look"],
    mediaClass: "lut",
  },
  {
    key: "graphics",
    label: "Graphics",
    kind: "stock",
    templateType: null,
    stockType: "graphics",
    nav: "graphics",
    sourceType: "asset",
    exts: [".jpg", ".jpeg", ".png", ".webp", ".svg"],
    mediaClass: "image",
  },
  {
    key: "motion-graphics",
    label: "Motion Graphics",
    kind: "stock",
    templateType: null,
    stockType: "motion-graphics",
    nav: "motion",
    sourceType: "asset",
    // .mov = alfa uchun (ProRes 4444) — P1.10.
    exts: [".mp4", ".mov"],
    mediaClass: "video",
  },
  {
    key: "music",
    label: "Music",
    kind: "stock",
    templateType: null,
    stockType: "music",
    nav: "music",
    sourceType: "asset",
    exts: [".wav", ".mp3", ".aiff", ".aif"],
    mediaClass: "audio",
  },
  {
    key: "sfx",
    label: "Sound Effects",
    kind: "stock",
    templateType: null,
    stockType: "sfx",
    nav: "sfx",
    sourceType: "asset",
    exts: [".wav", ".aiff", ".aif", ".mp3"],
    mediaClass: "audio",
  },
];

const BY_KEY = new Map(TAXONOMY.map((t) => [t.key, t]));

/** Taxon'ni kalit bo'yicha topadi. */
export function taxonByKey(key: string | null | undefined): AssetTaxon | null {
  return BY_KEY.get(String(key || "")) || null;
}

/** (kind, templateType, stockType) → taxon (katalog satridan taxonni tiklash). */
export function taxonForRow(row: {
  kind?: string | null;
  templateType?: string | null;
  stockType?: string | null;
}): AssetTaxon | null {
  const kind = row.kind || "template";
  if (kind === "stock") {
    return TAXONOMY.find((t) => t.kind === "stock" && t.stockType === row.stockType) || null;
  }
  const tt = row.templateType || "video-templates";
  return TAXONOMY.find((t) => t.kind === "template" && t.templateType === tt) || null;
}

/** Plagin/katalog nav tab kaliti (kind/templateType/stockType'dan). Noma'lum → 'video'. */
export function navForAsset(row: {
  kind?: string | null;
  templateType?: string | null;
  stockType?: string | null;
}): string {
  return taxonForRow(row)?.nav || "video";
}

/** Fayl nomi berilgan taxon uchun ruxsat etilgan kengaytmagami. */
export function extAllowedForTaxon(taxon: AssetTaxon, fileName: string): boolean {
  const lower = String(fileName || "").toLowerCase();
  return taxon.exts.some((e) => lower.endsWith(e));
}

// ── Kategoriya ro'yxatlari (AI + admin editor) — HAR TYPE UCHUN ALOHIDA (P1.8) ──
// AI erkin kategoriya yozmaydi — faqat mos ro'yxatdan tanlaydi. `uncategorized` doim
// oxirgi fallback. Bu ro'yxatlar data.js (klient) bilan mos bo'lishi kerak.
export type Category = { value: string; label: string };

export const CATEGORIES_BY_TYPE: Record<string, Category[]> = {
  "video-templates": [
    { value: "titles", label: "Titles" },
    { value: "lower-thirds", label: "Lower Thirds" },
    { value: "transitions", label: "Transitions" },
    { value: "intros", label: "Intros" },
    { value: "logo-reveal", label: "Logo Reveal" },
    { value: "openers", label: "Openers" },
    { value: "slideshows", label: "Slideshows" },
    { value: "backgrounds", label: "Backgrounds" },
    { value: "overlays", label: "Overlays" },
    { value: "infographics", label: "Infographics" },
    { value: "social-media", label: "Social Media" },
    { value: "logos", label: "Logos" },
    { value: "mockups", label: "Mockups" },
  ],
  luts: [
    { value: "cinematic", label: "Cinematic" },
    { value: "vintage", label: "Vintage" },
    { value: "film-emulation", label: "Film Emulation" },
    { value: "black-white", label: "Black & White" },
    { value: "warm", label: "Warm" },
    { value: "cool", label: "Cool" },
    { value: "teal-orange", label: "Teal & Orange" },
    { value: "moody", label: "Moody" },
    { value: "vibrant", label: "Vibrant" },
    { value: "natural", label: "Natural" },
  ],
  graphics: [
    { value: "backgrounds", label: "Backgrounds" },
    { value: "textures", label: "Textures" },
    { value: "patterns", label: "Patterns" },
    { value: "icons", label: "Icons" },
    { value: "illustrations", label: "Illustrations" },
    { value: "mockups", label: "Mockups" },
    { value: "abstract", label: "Abstract" },
    { value: "gradients", label: "Gradients" },
    { value: "shapes", label: "Shapes" },
    { value: "social-media", label: "Social Media" },
  ],
  "motion-graphics": [
    { value: "backgrounds", label: "Backgrounds" },
    { value: "overlays", label: "Overlays" },
    { value: "transitions", label: "Transitions" },
    { value: "elements", label: "Elements" },
    { value: "light-leaks", label: "Light Leaks" },
    { value: "particles", label: "Particles" },
    { value: "abstract", label: "Abstract" },
    { value: "loops", label: "Loops" },
    { value: "social-media", label: "Social Media" },
  ],
  music: [
    { value: "cinematic", label: "Cinematic" },
    { value: "corporate", label: "Corporate" },
    { value: "ambient", label: "Ambient" },
    { value: "electronic", label: "Electronic" },
    { value: "hip-hop", label: "Hip-Hop" },
    { value: "rock", label: "Rock" },
    { value: "pop", label: "Pop" },
    { value: "folk", label: "Folk" },
    { value: "jazz", label: "Jazz" },
    { value: "classical", label: "Classical" },
  ],
  sfx: [
    { value: "whoosh", label: "Whoosh" },
    { value: "impact", label: "Impact" },
    { value: "ui", label: "UI / Interface" },
    { value: "ambience", label: "Ambience" },
    { value: "foley", label: "Foley" },
    { value: "transitions", label: "Transitions" },
    { value: "glitch", label: "Glitch" },
    { value: "nature", label: "Nature" },
    { value: "mechanical", label: "Mechanical" },
    { value: "voice", label: "Voice" },
  ],
  // P3 (step 34) — AI Stock (foydalanuvchi generatsiyasi → "Add to Explore"). Metadata
  // generatori shu ro'yxatdan kategoriya tanlaydi; platform katalog filtri AYNAN shu labellar.
  "ai-stock": [
    { value: "abstract", label: "Abstract" },
    { value: "nature", label: "Nature" },
    { value: "people", label: "People" },
    { value: "business", label: "Business" },
    { value: "technology", label: "Technology" },
    { value: "food", label: "Food" },
    { value: "travel", label: "Travel" },
    { value: "sports", label: "Sports" },
    { value: "backgrounds", label: "Backgrounds" },
  ],
};

const UNCATEGORIZED: Category = { value: "uncategorized", label: "Uncategorized" };

/** Type kaliti (templateType yoki stockType) uchun kategoriya ro'yxati (+ uncategorized). */
export function categoriesForType(typeKey: string | null | undefined): Category[] {
  const list = CATEGORIES_BY_TYPE[String(typeKey || "")] || [];
  return [...list, UNCATEGORIZED];
}

/** AI/admin qaytargan kategoriyani (value yoki label, har registrda) type ro'yxatiga bog'laydi. */
export function resolveCategoryForType(
  typeKey: string | null | undefined,
  raw: unknown
): Category {
  const list = categoriesForType(typeKey);
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return UNCATEGORIZED;
  const norm = s.replace(/[\s_]+/g, "-");
  for (const c of list) {
    if (c.value === s || c.label.toLowerCase() === s || c.value === norm) return c;
  }
  return UNCATEGORIZED;
}
