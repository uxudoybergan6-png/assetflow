/**
 * P1 (step 30) — INGEST paytida (tasdiqlashda EMAS — P1.12) AI metadata: nom + tavsif +
 * kategoriya (type ro'yxatidan) + 20 teg. Har asset kind uchun:
 *   - Video (Motion Graphics): BIRINCHI + O'RTA kadr → vision
 *   - Rasm (Graphics): rasmning o'zi → vision
 *   - Audio (Music/SFX): fayl nomi + davomiylik (vision yo'q)
 *   - LUT: fayl nomi (vision yo'q)
 *   - Zip (Video Templates): zip nomi (+ preview rasmi) — generateTemplateMetadata bilan bir xil
 *
 * PROVAYDER: Vertex Gemini (gemini-2.5-flash) BIRLAMCHI (P1.4 — OpenRouter retirilmoqda);
 * Vertex yo'q bo'lsa OpenRouter; ikkalasi ham yo'q/xato bo'lsa fayl-nomidan FALLBACK
 * (Uncategorized + kalit-so'z teglar). INTERNAL: foydalanuvchi krediti ISHLATILMAYDI.
 *
 * P1.13 — kunlik cap: contributor 500 fayl tashlasa 500 vision chaqiruvi bo'lmasin.
 * Cap oshsa yoki global kill-switch (AI_METADATA_DISABLED) → fallback (ingest bloklanmaydi).
 */
import fs from "node:fs";
import { isOpenRouterConfigured, orChatJsonVision } from "./openrouter.js";
import { isVertexEnhanceConfigured, vertexJsonVision } from "./vertex-enhance.js";
import { categoriesForType, resolveCategoryForType, type Category } from "../taxonomy.js";
import { incrDailyUsage } from "../spend-guard.js";

const VERTEX_MODEL = "gemini-2.5-flash";
const OPENROUTER_MODEL = process.env.AI_MODEL_METADATA ?? "google/gemini-2.5-flash";

// P1.13 — kunlik cap (contributor). Admin/owner path (isAdmin) alohida yuqori ceiling
// (P6.2 — bulk import egani o'z platformasidan qulflab qo'ymasin).
const AI_META_DAILY_CAP = Math.max(1, Number(process.env.AI_METADATA_DAILY_CAP) || 600);
const AI_META_DAILY_CAP_ADMIN = Math.max(
  AI_META_DAILY_CAP,
  Number(process.env.AI_METADATA_DAILY_CAP_ADMIN) || 20000
);

export type AssetMetadata = {
  title: string;
  description: string;
  cat: string;
  catLabel: string;
  tags: string[];
  source: "vertex" | "openrouter" | "fallback";
};

export type AssetMetaInput = {
  /** templateType (video-templates/luts) yoki stockType (graphics/motion-graphics/music/sfx). */
  typeKey: string;
  mediaClass: "project" | "lut" | "image" | "video" | "audio";
  /** Nom uchun urug' (fayl nomi yoki zip nomi — kengaytmasiz). */
  displayName: string;
  /** Vision uchun lokal rasm fayllari (video kadrlari / rasmning o'zi / zip preview). */
  imagePaths?: string[];
  /** Audio uchun davomiylik (teg uchun). */
  durationSec?: number | null;
  /** Kunlik cap uchun. */
  contributorId?: string;
  isAdmin?: boolean;
};

// ── Yordamchilar ──────────────────────────────────────────────────────────────
function cleanTag(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

const FILLER_TAGS = [
  "stock", "asset", "template", "design", "creative", "professional", "modern",
  "clean", "hd", "4k", "editable", "background", "video", "graphics", "footage",
  "motion", "abstract", "minimal", "colorful", "cinematic",
];

function keywordsFromName(name: string): string[] {
  return String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

function normalizeTags(raw: unknown, seed: string[], count = 20): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    const c = cleanTag(t);
    if (c && c.length >= 2 && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  };
  if (Array.isArray(raw)) for (const t of raw) push(t);
  for (const t of seed) push(t);
  for (const t of FILLER_TAGS) {
    if (out.length >= count) break;
    push(t);
  }
  return out.slice(0, count);
}

/** Fayl/zip nomidan toza sarlavha (Title Case, kengaytmasiz). */
export function titleFromName(name: string): string {
  const base = String(name || "")
    .split("/")
    .pop()!
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Untitled";
  return base
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .slice(0, 120);
}

function fallbackMetadata(input: AssetMetaInput): AssetMetadata {
  const title = titleFromName(input.displayName);
  const seed = keywordsFromName(title);
  return {
    title,
    description: "",
    cat: "uncategorized",
    catLabel: "Uncategorized",
    tags: normalizeTags(seed, seed),
    source: "fallback",
  };
}

/** Lokal rasmni {data, mimeType} (base64) ga o'giradi. Xato/juda katta → null. */
function imageToInline(imagePath: string): { data: string; mimeType: string } | null {
  try {
    const stat = fs.statSync(imagePath);
    if (!stat.isFile() || stat.size > 6 * 1024 * 1024) return null; // 6MB cap
    const lower = imagePath.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return { data: fs.readFileSync(imagePath).toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function buildSystemPrompt(cats: Category[]): string {
  const catList = cats
    .filter((c) => c.value !== "uncategorized")
    .map((c) => `${c.value} (${c.label})`)
    .join(", ");
  return (
    "You are a metadata generator for a creative-assets marketplace (video templates, LUTs, " +
    "stock graphics, motion graphics, music and sound effects). Produce clean catalog metadata. " +
    "Respond with ONLY a JSON object, no markdown, with EXACTLY these keys:\n" +
    '  "title": a clean, short, human-readable asset name (Title Case, no file extension, no ' +
    "underscores/dashes).\n" +
    '  "description": ONE concise sentence (max ~160 chars) describing the asset for buyers — ' +
    "faithful to what is actually shown/heard, no marketing fluff.\n" +
    `  "category": choose EXACTLY ONE value from this fixed list (use the value on the left): ${catList}. ` +
    'If nothing fits, use "uncategorized".\n' +
    '  "tags": an array of EXACTLY 20 lowercase search keywords (single or short multi-word), ' +
    "relevant to style, use-case and content. No duplicates, no '#'."
  );
}

function parseAiJson(
  raw: string,
  input: AssetMetaInput,
  cats: Category[],
  source: "vertex" | "openrouter"
): AssetMetadata | null {
  let parsed: { title?: unknown; description?: unknown; category?: unknown; tags?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const fbTitle = titleFromName(input.displayName);
  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : fbTitle;
  const description =
    typeof parsed.description === "string" ? parsed.description.trim().slice(0, 400) : "";
  const cat = resolveCategoryForType(input.typeKey, parsed.category);
  const seed = keywordsFromName(title);
  const tags = normalizeTags(parsed.tags, seed);
  return { title, description, cat: cat.value, catLabel: cat.label, tags, source };
}

/**
 * Ingest paytida chaqiriladi. HECH QACHON throw QILMAYDI — xatoda fallback qaytaradi.
 */
export async function generateAssetMetadata(input: AssetMetaInput): Promise<AssetMetadata> {
  const fallback = fallbackMetadata(input);

  // Global kill-switch (P1.13).
  if (["1", "true", "on"].includes(String(process.env.AI_METADATA_DISABLED || "").toLowerCase())) {
    return fallback;
  }

  // Kunlik cap (P1.13) — oshsa fallback (ingest bloklanmaydi). Chaqiruv SANALADI faqat
  // haqiqiy AI ishlatiladigan bo'lsa (provider mavjud).
  const hasProvider = isVertexEnhanceConfigured() || isOpenRouterConfigured();
  if (!hasProvider) return fallback;
  if (input.contributorId) {
    const cap = input.isAdmin ? AI_META_DAILY_CAP_ADMIN : AI_META_DAILY_CAP;
    const within = await incrDailyUsage(input.contributorId, "ai-metadata", cap);
    if (!within) {
      console.warn(`[asset-metadata] kunlik cap oshdi (${input.contributorId}) → fallback`);
      return fallback;
    }
  }

  const cats = categoriesForType(input.typeKey);
  const system = buildSystemPrompt(cats);
  const inlineImages = (input.imagePaths || [])
    .map(imageToInline)
    .filter((x): x is { data: string; mimeType: string } => x !== null);

  const userText = buildUserText(input, inlineImages.length > 0);

  // 1) Vertex birlamchi (vision bilan yoki matn bilan).
  if (isVertexEnhanceConfigured()) {
    try {
      const out = await vertexJsonVision(system, userText, inlineImages);
      if (out.ok) {
        const meta = parseAiJson(out.data, input, cats, "vertex");
        if (meta) return meta;
      }
    } catch (e) {
      console.warn("[asset-metadata] Vertex xato → OpenRouter/fallback:", e);
    }
  }

  // 2) OpenRouter fallback (retirilmoqda, lekin kalit bo'lsa ishlaydi).
  if (isOpenRouterConfigured()) {
    try {
      const dataUris = inlineImages.map((i) => `data:${i.mimeType};base64,${i.data}`);
      const out = await orChatJsonVision(OPENROUTER_MODEL, system, userText, dataUris);
      if (out.ok) {
        const meta = parseAiJson(out.data, input, cats, "openrouter");
        if (meta) return meta;
      }
    } catch (e) {
      console.warn("[asset-metadata] OpenRouter xato → fallback:", e);
    }
  }

  return fallback;
}

function buildUserText(input: AssetMetaInput, hasImages: boolean): string {
  const name = input.displayName.split("/").pop() || input.displayName;
  const kindNote =
    input.mediaClass === "video"
      ? "This is a stock MOTION GRAPHICS / video clip."
      : input.mediaClass === "image"
        ? "This is a stock GRAPHIC / image asset."
        : input.mediaClass === "audio"
          ? input.typeKey === "sfx"
            ? "This is a SOUND EFFECT audio file (no image provided)."
            : "This is a MUSIC track (no image provided)."
          : input.mediaClass === "lut"
            ? "This is a color grading LUT (.cube/.3dl) file (no image provided)."
            : "This is a video template (project file).";
  const dur =
    input.durationSec && input.durationSec > 0
      ? ` Duration: ${input.durationSec.toFixed(1)}s.`
      : "";
  const frames =
    hasImages && input.mediaClass === "video"
      ? " Two frames (first and middle) of the clip are attached — analyze them for accuracy."
      : hasImages
        ? " An image of the asset is attached — analyze it for accuracy."
        : "";
  return `File name: "${name}". ${kindNote}${dur}${frames}`;
}
