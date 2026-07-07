/**
 * Shablon AI metadatasi (KONTENT-QUVURI-SXEMA.md §6) — ingest paytida zip nomidan
 * (va ixtiyoriy preview rasmidan) nom / kategoriya / 20 teg yozadi.
 *
 * MUHIM: bu INTERNAL tizim metadatasi — foydalanuvchi kredit yo'li (consumeAiCredits /
 * cost-quote) ISHLATILMAYDI, to'g'ridan-to'g'ri provider chaqiruvi. AI xato bersa —
 * fayl nomidan xavfsiz fallback (Uncategorized + kalit-so'z teglar); ingest hech qachon
 * bloklanmaydi.
 */
import fs from "node:fs";
import { isOpenRouterConfigured, orChatJsonVision } from "./openrouter.js";
import { titleFromZipFileName } from "../ingest-zip.js";

/** Bir vision-qodir arzon model — metadata (matn + ixtiyoriy rasm) uchun. */
const METADATA_MODEL = process.env.AI_MODEL_METADATA ?? "google/gemini-2.5-flash";

/**
 * Katalog filtri aynan shu kategoriyalar bo'yicha ishlaydi — shuning uchun AI erkin
 * kategoriya YOZMAYDI, faqat shu ro'yxatdan bittasini tanlaydi. Yangi kategoriya kerak
 * bo'lsa shu ro'yxatga qo'shiladi (yagona manba).
 */
export const TEMPLATE_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "titles", label: "Titles" },
  { value: "lower-thirds", label: "Lower Thirds" },
  { value: "transitions", label: "Transitions" },
  { value: "intros", label: "Intros" },
  { value: "logo-reveal", label: "Logo Reveal" },
  { value: "openers", label: "Openers" },
  { value: "slideshows", label: "Slideshows" },
  { value: "backgrounds", label: "Backgrounds" },
  { value: "luts", label: "LUTs" },
  { value: "overlays", label: "Overlays" },
  { value: "infographics", label: "Infographics" },
  { value: "social-media", label: "Social Media" },
  { value: "logos", label: "Logos" },
  { value: "mockups", label: "Mockups" },
  { value: "uncategorized", label: "Uncategorized" },
];

const CATEGORY_BY_VALUE = new Map(TEMPLATE_CATEGORIES.map((c) => [c.value, c]));
const CATEGORY_BY_LABEL = new Map(
  TEMPLATE_CATEGORIES.map((c) => [c.label.toLowerCase(), c])
);

export type TemplateMetadata = {
  title: string;
  cat: string;
  catLabel: string;
  tags: string[];
  source: "ai" | "fallback";
};

/** AI qaytargan kategoriyani (value yoki label, har xil registrda) kanonik ro'yxatga bog'laydi. */
function resolveCategory(raw: unknown): { value: string; label: string } {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return { value: "uncategorized", label: "Uncategorized" };
  const byVal = CATEGORY_BY_VALUE.get(s);
  if (byVal) return { value: byVal.value, label: byVal.label };
  const byLabel = CATEGORY_BY_LABEL.get(s);
  if (byLabel) return { value: byLabel.value, label: byLabel.label };
  // "logo reveal" ↔ "logo-reveal" kabi bo'sh-joy/tire farqiga bardosh.
  const norm = s.replace(/[\s_]+/g, "-");
  const byNorm = CATEGORY_BY_VALUE.get(norm);
  if (byNorm) return { value: byNorm.value, label: byNorm.label };
  return { value: "uncategorized", label: "Uncategorized" };
}

/** Bitta tegni tozalaydi: kichik harf, ortiqcha belgilar olib tashlanadi. */
function cleanTag(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/** Teglarni tozalaydi + dedup + aynan `count` taga yetkazadi (kam bo'lsa fillerlardan to'ldiradi). */
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
  for (const t of seed) push(t); // fayl nomidan kelgan kalit-so'zlar bilan to'ldiramiz
  for (const t of FILLER_TAGS) {
    if (out.length >= count) break;
    push(t);
  }
  return out.slice(0, count);
}

/** Fayl nomidan kalit-so'zlar (fallback teglar + AI teglarini to'ldirish uchun). */
function keywordsFromTitle(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

/** 20 tagga yetmasa umumiy motion-graphics fillerlari (deterministik). */
const FILLER_TAGS = [
  "motion graphics",
  "after effects",
  "animation",
  "template",
  "video",
  "broadcast",
  "modern",
  "clean",
  "dynamic",
  "professional",
  "creative",
  "editable",
  "hd",
  "4k",
  "promo",
  "corporate",
  "elegant",
  "minimal",
  "colorful",
  "cinematic",
];

/** Xavfsiz fallback: AI ishlamasa fayl nomidan nom + Uncategorized + kalit-so'z teglar. */
function fallbackMetadata(zipFileName: string): TemplateMetadata {
  const title = titleFromZipFileName(zipFileName);
  return {
    title,
    cat: "uncategorized",
    catLabel: "Uncategorized",
    tags: normalizeTags(keywordsFromTitle(title), keywordsFromTitle(title)),
    source: "fallback",
  };
}

/** Lokal rasmni data-URI ga o'giradi (vision uchun). Xato/juda katta bo'lsa null. */
function imageToDataUri(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  try {
    const stat = fs.statSync(imagePath);
    if (!stat.isFile() || stat.size > 6 * 1024 * 1024) return null; // 6MB cap
    const ext = imagePath.toLowerCase().endsWith(".png")
      ? "image/png"
      : imagePath.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    const b64 = fs.readFileSync(imagePath).toString("base64");
    return `data:${ext};base64,${b64}`;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT =
  "You are a metadata generator for a motion-graphics / video template marketplace. " +
  "Given a template's zip file name (and optionally its preview image), produce clean catalog " +
  "metadata. Respond with ONLY a JSON object, no markdown, with EXACTLY these keys:\n" +
  '  "title": a clean, short, human-readable template name (Title Case, no file extension, no ' +
  "underscores/dashes; improve the wording of the file name).\n" +
  '  "category": choose EXACTLY ONE value from this fixed list (use the value on the left): ' +
  "{CATEGORIES}. If nothing fits, use \"uncategorized\".\n" +
  '  "tags": an array of EXACTLY 20 lowercase search keywords (single or short multi-word), ' +
  "relevant to the template's style, use-case, and content. No duplicates, no '#'.";

/**
 * Ingest paytida chaqiriladi. Zip nomi (+ ixtiyoriy preview rasmi) dan nom / kategoriya /
 * 20 teg. Hech qachon throw QILMAYDI — xatoda fallback qaytaradi.
 */
export async function generateTemplateMetadata(opts: {
  zipFileName: string;
  imagePath?: string | null;
}): Promise<TemplateMetadata> {
  const { zipFileName, imagePath } = opts;
  const fallback = fallbackMetadata(zipFileName);
  if (!isOpenRouterConfigured()) return fallback;

  try {
    const catList = TEMPLATE_CATEGORIES.filter((c) => c.value !== "uncategorized")
      .map((c) => `${c.value} (${c.label})`)
      .join(", ");
    const system = SYSTEM_PROMPT.replace("{CATEGORIES}", catList);
    const dataUri = imageToDataUri(imagePath);
    const user =
      `Zip file name: "${zipFileName.split("/").pop() || zipFileName}"` +
      (dataUri ? "\nA preview image of the template is attached — use it for accuracy." : "");

    const out = await orChatJsonVision(
      METADATA_MODEL,
      system,
      user,
      dataUri ? [dataUri] : []
    );
    if (!out.ok) return fallback;

    let parsed: { title?: unknown; category?: unknown; tags?: unknown };
    try {
      parsed = JSON.parse(out.data);
    } catch {
      return fallback;
    }

    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 120)
        : fallback.title;
    const cat = resolveCategory(parsed.category);
    const seed = keywordsFromTitle(title);
    const tags = normalizeTags(parsed.tags, seed);

    return { title, cat: cat.value, catLabel: cat.label, tags, source: "ai" };
  } catch (e) {
    console.error("[template-metadata] AI xato, fallback:", e);
    return fallback;
  }
}
