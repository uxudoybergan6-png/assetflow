import {
  GEN_MODELS,
  type GenModel,
  resolveVideoParams,
  buildFalVideoInput,
  computeGenCost,
  resolveImageCount,
} from "./gen-models.js";

/**
 * PROBLEM 10 — GEN_MODELS katalog validatori.
 *
 * Yangi model qo'shish = bitta katalog entry. Bu modul HAR entry'ni tekshiradi:
 * noto'g'ri/chala entry server startup'da BALAND OVOZDA yiqiladi (model+maydon
 * nomi bilan) — UI yoki provider chaqiruvi jim buzilmaydi.
 *
 * MONEY-ZONE: bu modul faqat O'QIYDI (computeGenCost/quote'ga tegmaydi) —
 * validatsiya yangi entry'lar to'g'ri narx maydonlari bilan kelishini ta'minlaydi.
 *
 * Ishlatish:
 *   startup: validateGenModelsOrThrow() (index.ts) — xato bo'lsa throw.
 *   CLI/guard-test: `node apps/api/dist/lib/gen-models-validate.js` — exit 1.
 */

const MODES = new Set(["image", "voice", "video", "music", "sfx"]);
const FEATURES = new Set([
  "text-to-image", "image-edit", "text-to-speech", "text-to-video",
  "image-to-video", "reference-to-video", "text-to-sfx",
]);
const PROVIDERS = new Set([
  "openrouter", "freepik", "elevenlabs", "magnific", "fal", "vertex", "vertex-omni", "vertex-image", undefined,
]);
// gen-processor dispatch'ida REAL branch bor provider+feature juftliklari (yangi provider →
// yangi adapter branch SHART; ro'yxatga qo'shishdan oldin gen-processor.ts'ga branch yozing).
const VIDEO_DISPATCH = new Set(["fal", "vertex", "vertex-omni", "openrouter", undefined]);
const IMAGE_DISPATCH = new Set(["fal", "vertex-image", "magnific", "openrouter", undefined]);

export type ModelIssue = { modelId: number | string; field: string; message: string };

function issue(list: ModelIssue[], m: Partial<GenModel>, field: string, message: string): void {
  list.push({ modelId: m.id ?? "?", field, message });
}

/** Bitta model entry'ni tekshiradi — muammolar ro'yxatini qaytaradi. */
export function validateModel(m: GenModel, enabledOnlyChecks: boolean): ModelIssue[] {
  const out: ModelIssue[] = [];
  // ── Umumiy majburiy maydonlar ──
  if (!Number.isInteger(m.id) || m.id <= 0) issue(out, m, "id", "musbat butun bo'lishi shart");
  if (!MODES.has(m.mode)) issue(out, m, "mode", `noma'lum mode: ${String(m.mode)}`);
  if (!m.key || typeof m.key !== "string") issue(out, m, "key", "bo'sh bo'lmasligi shart");
  if (!m.label || typeof m.label !== "string") issue(out, m, "label", "bo'sh bo'lmasligi shart");
  if (!FEATURES.has(m.feature)) issue(out, m, "feature", `noma'lum feature: ${String(m.feature)}`);
  if (!PROVIDERS.has(m.provider)) issue(out, m, "provider", `noma'lum provider: ${String(m.provider)}`);
  if (typeof m.cost !== "number" || !(m.cost >= 0)) issue(out, m, "cost", "raqam (≥0) bo'lishi shart");

  // mode ↔ feature mosligi
  const featureByMode: Record<string, string[]> = {
    image: ["text-to-image", "image-edit"],
    video: ["text-to-video", "image-to-video", "reference-to-video"],
    voice: ["text-to-speech"],
    sfx: ["text-to-sfx"],
    music: ["text-to-speech"],
  };
  if (MODES.has(m.mode) && FEATURES.has(m.feature) && !featureByMode[m.mode]?.includes(m.feature)) {
    issue(out, m, "feature", `mode='${m.mode}' bilan feature='${m.feature}' mos emas`);
  }

  // refMode/maxRefs izchilligi
  if (m.refMode && !["none", "optional", "required"].includes(m.refMode)) {
    issue(out, m, "refMode", `noma'lum refMode: ${m.refMode}`);
  }
  if (typeof m.maxRefs === "number" && (m.maxRefs < 0 || !Number.isInteger(m.maxRefs))) {
    issue(out, m, "maxRefs", "manfiy bo'lmagan butun bo'lishi shart");
  }
  if (m.refMode === "required" && !(typeof m.maxRefs === "number" && m.maxRefs > 0) && m.mode === "image") {
    issue(out, m, "maxRefs", "refMode='required' rasm modeli maxRefs>0 e'lon qilishi shart (UI referens tugmasini bloklaydi)");
  }

  if (!enabledOnlyChecks) return out; // disabled model uchun chuqur tekshiruv shart emas

  // ── Yoqilgan model uchun mode-spetsifik talablar (UI shu maydonlardan quradi) ──
  if (m.mode === "image") {
    if (!IMAGE_DISPATCH.has(m.provider)) issue(out, m, "provider", `rasm dispatch'ida '${m.provider}' branch yo'q (gen-processor.ts)`);
    if (!Array.isArray(m.aspects) || !m.aspects.length) issue(out, m, "aspects", "bo'sh bo'lmasligi shart (aspect chip)");
    const counts = m.imgSettings?.num ?? m.count;
    if (counts && (!Array.isArray(counts) || counts.some((n) => !Number.isInteger(n) || n < 1))) {
      issue(out, m, "count/imgSettings.num", "musbat butunlar ro'yxati bo'lishi shart");
    }
    const ql = m.imgSettings?.quality;
    if (ql) {
      if (!Array.isArray(ql.options) || !ql.options.length) issue(out, m, "imgSettings.quality.options", "bo'sh bo'lmasligi shart");
      if (ql.def && Array.isArray(ql.options) && !ql.options.includes(ql.def)) issue(out, m, "imgSettings.quality.def", `def='${ql.def}' options ichida emas`);
      if (ql.cost) for (const o of ql.options || []) {
        if (typeof ql.cost[o] !== "number") issue(out, m, "imgSettings.quality.cost", `'${o}' uchun narx yo'q`);
      }
    }
    const asp = m.imgSettings?.aspect;
    if (asp?.def && Array.isArray(asp.options) && !asp.options.includes(asp.def)) {
      issue(out, m, "imgSettings.aspect.def", `def='${asp.def}' options ichida emas`);
    }
    if (m.provider === "fal" && !m.falModel && !m.key) issue(out, m, "falModel", "fal modeli falModel yoki key e'lon qilishi shart");
  }

  if (m.mode === "video") {
    if (!VIDEO_DISPATCH.has(m.provider)) issue(out, m, "provider", `video dispatch'ida '${m.provider}' branch yo'q (gen-processor.ts)`);
    const vs = m.videoSettings;
    const durOpts = vs?.duration?.options ?? m.durations;
    if (!Array.isArray(durOpts) || !durOpts.length) issue(out, m, "durations/videoSettings.duration", "bo'sh bo'lmasligi shart");
    const resOpts = vs?.resolution?.options ?? m.resolutions;
    if (!Array.isArray(resOpts) || !resOpts.length) issue(out, m, "resolutions/videoSettings.resolution", "bo'sh bo'lmasligi shart");
    if (!Array.isArray(m.aspects) || !m.aspects.length) issue(out, m, "aspects", "bo'sh bo'lmasligi shart");
    // Narx: per-generation → flat cost; aks holda perSec har resolution uchun
    if (m.pricing === "per-generation") {
      if (!(m.cost > 0)) issue(out, m, "cost", "per-generation model cost>0 bo'lishi shart");
    } else {
      const perSec = vs?.resolution?.perSec;
      if (!perSec) issue(out, m, "videoSettings.resolution.perSec", "per-second video model perSec e'lon qilishi shart");
      else for (const r of resOpts || []) {
        if (typeof perSec[r] !== "number") issue(out, m, "videoSettings.resolution.perSec", `'${r}' uchun perSec yo'q`);
      }
    }
    if (vs?.resolution?.def && Array.isArray(vs.resolution.options) && !vs.resolution.options.includes(vs.resolution.def)) {
      issue(out, m, "videoSettings.resolution.def", `def options ichida emas`);
    }
    if (vs?.duration?.def != null && Array.isArray(vs.duration.options) && !vs.duration.options.map(String).includes(String(vs.duration.def))) {
      issue(out, m, "videoSettings.duration.def", `def options ichida emas`);
    }
    if (vs?.aspect?.def && Array.isArray(vs.aspect.options) && !vs.aspect.options.includes(vs.aspect.def)) {
      issue(out, m, "videoSettings.aspect.def", `def options ichida emas`);
    }
    if (vs?.bitrate) {
      if (!Array.isArray(vs.bitrate.options) || !vs.bitrate.options.length) issue(out, m, "videoSettings.bitrate.options", "bo'sh bo'lmasligi shart");
      if (vs.bitrate.def && !vs.bitrate.options.includes(vs.bitrate.def)) issue(out, m, "videoSettings.bitrate.def", "def options ichida emas");
    }
    // media-refs → mediaRefs limitlari shart
    const isMediaRefs = m.feature === "reference-to-video" || (m as { refKind?: string }).refKind === "media-refs" || !!m.mediaRefs;
    if (isMediaRefs && m.mediaRefs) {
      const L = m.mediaRefs;
      for (const k of ["image", "video", "audio", "total"] as const) {
        if (typeof L[k] !== "number" || L[k] < 0) issue(out, m, `mediaRefs.${k}`, "manfiy bo'lmagan raqam bo'lishi shart");
      }
      if (typeof L.total === "number" && L.total < 1) issue(out, m, "mediaRefs.total", "kamida 1 bo'lishi kerak");
    }
    if (m.feature === "reference-to-video" && !m.mediaRefs) {
      issue(out, m, "mediaRefs", "reference-to-video model mediaRefs limitlarini e'lon qilishi shart");
    }
    if (m.provider === "fal" && !m.falModel && !m.key) issue(out, m, "falModel", "fal video modeli falModel/key e'lon qilishi shart");
  }

  if (m.mode === "voice" || m.mode === "music") {
    if (!Array.isArray(m.voices) || !m.voices.length) issue(out, m, "voices", "TTS model voices ro'yxatini e'lon qilishi shart");
    else for (const v of m.voices) {
      if (!v || typeof v.id !== "string" || !v.id) issue(out, m, "voices[].id", "bo'sh bo'lmasligi shart");
    }
    if (!(m.cost > 0)) issue(out, m, "cost", "TTS cost>0 bo'lishi shart");
  }
  if (m.mode === "sfx") {
    if (!Array.isArray(m.durations) || !m.durations.length) issue(out, m, "durations", "SFX durations ro'yxatini e'lon qilishi shart");
    if (!(m.cost > 0)) issue(out, m, "cost", "SFX cost>0 bo'lishi shart");
  }

  // ── Dry-run: video model provider input QURILISHI (fal) va narx hisobi ishlashi ──
  try {
    if (m.mode === "video") {
      const params = { resolution: (m.resolutions || [])[0], duration: (m.durations || [5])[0], aspectRatio: (m.aspects || [])[0] };
      const rv = resolveVideoParams(m, params);
      if (!(rv.duration > 0)) issue(out, m, "durations", "resolveVideoParams musbat duration qaytarmadi");
      if (m.provider === "fal") {
        const input = buildFalVideoInput(m, "validator", rv, { startUrl: "https://x/i.png", imageUrls: ["https://x/i.png"] });
        if (!input.prompt) issue(out, m, "videoInput", "buildFalVideoInput prompt qaytarmadi");
      }
      const c = computeGenCost(m, params);
      if (!(c > 0)) issue(out, m, "cost", `computeGenCost ${c} qaytardi (musbat kutiladi)`);
    }
    if (m.mode === "image") {
      const params = { aspectRatio: (m.aspects || [])[0], quality: m.imgSettings?.quality?.def, count: 1 };
      const c = computeGenCost(m, params);
      if (!(c > 0)) issue(out, m, "cost", `computeGenCost ${c} qaytardi (musbat kutiladi)`);
      if (resolveImageCount(m, { count: 1 }) < 1) issue(out, m, "count", "resolveImageCount <1 qaytardi");
    }
  } catch (e) {
    issue(out, m, "dry-run", `payload/narx dry-run xatosi: ${e instanceof Error ? e.message : String(e)}`);
  }

  return out;
}

/** Butun katalogni tekshiradi (id unikallik + har entry). */
export function validateGenModels(): ModelIssue[] {
  const out: ModelIssue[] = [];
  const seen = new Map<number, string>();
  for (const m of GEN_MODELS) {
    if (seen.has(m.id)) out.push({ modelId: m.id, field: "id", message: `id takrorlangan ('${seen.get(m.id)}' va '${m.label}')` });
    seen.set(m.id, m.label);
    out.push(...validateModel(m, m.enabled !== false));
  }
  return out;
}

/** Startup guard — muammo bo'lsa throw (server ko'tarilmaydi, health-gate deployni to'xtatadi). */
export function validateGenModelsOrThrow(): void {
  const issues = validateGenModels();
  if (issues.length) {
    const lines = issues.map((i) => `  • model ${i.modelId} — ${i.field}: ${i.message}`);
    throw new Error(`GEN_MODELS katalogi validatsiyadan o'tmadi (${issues.length} muammo):\n${lines.join("\n")}`);
  }
}

// CLI/guard-test: `node apps/api/dist/lib/gen-models-validate.js`
const isCli = process.argv[1] && /gen-models-validate\.(js|ts)$/.test(process.argv[1]);
if (isCli) {
  const issues = validateGenModels();
  const enabled = GEN_MODELS.filter((m) => m.enabled !== false).length;
  if (issues.length) {
    console.error(`✗ GEN_MODELS: ${issues.length} muammo topildi:`);
    for (const i of issues) console.error(`  • model ${i.modelId} — ${i.field}: ${i.message}`);
    process.exit(1);
  }
  console.log(`✓ GEN_MODELS OK — ${GEN_MODELS.length} entry (${enabled} yoqilgan), 0 muammo.`);
}
