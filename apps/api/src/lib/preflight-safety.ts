type PreflightInput = {
  mode: string;
  prompt: string;
  params?: Record<string, unknown>;
  modelLabel?: string;
};

export type PreflightSafetyResult = {
  blocked: boolean;
  severity: "low" | "medium" | "high";
  reason: string | null;
  warnings: string[];
  suggestions: string[];
  category?: string; // moderatsiya izi uchun: "csam" | "deepfake" | "sexual" | "gore" | ...
};

const SEXUAL_EXPLICIT = [
  "nude",
  "naked",
  "nudity",
  "explicit",
  "erotic",
  "sexual",
  "sensual",
  "topless",
  "shirtless",
  "bare chest",
  "half naked",
  "yalang'och",
  "yalangoch",
  "erotik",
  "jinsiy",
  "ustki kiyimsiz",
  "yarim yalang",
  "ko'krak ochiq",
];

const STRONG_BODY_EXPOSURE = [
  "muscular",
  "muscle",
  "abs",
  "six pack",
  "torso",
  "chest",
  "shirtless",
  "topless",
  "mushak",
  "ko'krak",
  "yalang'och",
  "yalangoch",
];

const GENERIC_BODY_TERMS = [
  "body",
  "skin",
  "tana",
  "teri",
  "to'liq tana",
  "tana qismlari",
  "qo'l va oyoq",
  "qo'l va oyoqlari",
  "full body",
  "body parts",
];

// P30 (Director's ruling) — `softenPromptForSafety` OLIB TASHLANDI: u foydalanuvchi so'zlarini
// (shirtless→in sportswear, chest→upper frame ...) provayder filtridan sirg'alib o'tish uchun
// almashtirar — bu ATAYLAB filter-evasion + ma'noni buzish, provayder shartnomasini buzardi.
// Enhance endi FAITHFUL (aytilmagan tafsilotni qo'shmaydi) → yumshatishning o'zi keraksiz.
// preflightSafetyCheck (quyida) HARD-BLOK sifatida qoladi (CSAM/deepfake/gore/jinsiy taqiqlangan).

// Umumiy "realistik uslub / rol" — o'zi BLOK EMAS (warn). Legitim mahsulot (realistik sport
// personaji) buzilmasin. Aniq REAL SHAXS uchun pastdagi NAMED_REAL_PEOPLE/DEEPFAKE_INTENT ishlaydi.
const REALISTIC_STYLE = [
  "realistic",
  "photoreal",
  "photorealistic",
  "footballer",
  "athlete",
  "sportsman",
  "fotoreal",
  "sportchi",
  "futbolchi",
];

// Aniqlanadigan HAQIQIY shaxs (nom/mashhurlik) — o'xshashlik (likeness) → HARD BLOK (audit 1b).
const NAMED_REAL_PEOPLE = [
  "real person",
  "celebrity",
  "ronaldo",
  "messi",
  "haqiqiy odam",
  "real odam",
  "mashhur shaxs",
  "mashhur odam",
];

// Deepfake/yuz-almashtirish NIYATI — HARD BLOK (audit 1b). Referens bo'lsin/bo'lmasin.
const DEEPFAKE_INTENT = [
  "deepfake",
  "deep fake",
  "deepfeyk",
  "face swap",
  "face-swap",
  "faceswap",
  "swap face",
  "swap the face",
  "swap his face",
  "swap her face",
  "put his face",
  "put her face",
  "clone his face",
  "clone her face",
  "real person's face",
  "someone's face",
  "impersonate",
  "impersonation",
  "yuz almashtirish",
  "yuzini almashtirish",
  "boshqa odamning yuzi",
  "soxta yuz",
];

const MINOR_TERMS = [
  "child",
  "children",
  "kid",
  "kids",
  "teen",
  "teenager",
  "underage",
  "minor",
  "preteen",
  "toddler",
  "schoolgirl",
  "schoolboy",
  "little girl",
  "little boy",
  "bola",
  "bolalar",
  "o'smir",
  "osmir",
  "osm ir",
  "voyaga yetmagan",
  "maktab o'quvchisi",
];

// Yalang'ochlikka yaqin kiyim (o'zi neytral) — LEKIN nozik yosh bilan birga → CSAM signali.
const SWIMWEAR_UNDERWEAR = [
  "bikini",
  "swimsuit",
  "swimwear",
  "lingerie",
  "underwear",
  "panties",
  "thong",
  "cholva",
  "ich kiyim",
  "cho'milish kiyimi",
];

const GORE_TERMS = [
  "gore",
  "dismembered",
  "bloody corpse",
  "graphic violence",
  "ichak",
  "parchalangan",
  "jasad",
  "qonli jasad",
];

function hasAny(text: string, list: string[]): boolean {
  return list.some((term) => text.includes(term));
}

function countRefs(params?: Record<string, unknown>): { image: number; video: number; audio: number } {
  const count = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((x) => typeof x === "string" && x.length > 8).length
      : 0;
  return {
    image: count(params?.imageUrls),
    video: count(params?.videoUrls),
    audio: count(params?.audioUrls),
  };
}

export function preflightSafetyCheck(input: PreflightInput): PreflightSafetyResult {
  const text = String(input.prompt || "").toLowerCase();
  const refs = countRefs(input.params);
  const hasVisualRefs = refs.image + refs.video > 0;
  const sexual = hasAny(text, SEXUAL_EXPLICIT);
  const strongBody = hasAny(text, STRONG_BODY_EXPOSURE);
  const genericBody = hasAny(text, GENERIC_BODY_TERMS);
  const swimwear = hasAny(text, SWIMWEAR_UNDERWEAR);
  const real = hasAny(text, REALISTIC_STYLE);
  const namedPerson = hasAny(text, NAMED_REAL_PEOPLE);
  const deepfake = hasAny(text, DEEPFAKE_INTENT);
  const minor = hasAny(text, MINOR_TERMS);
  const gore = hasAny(text, GORE_TERMS);
  const warnings: string[] = [];
  const suggestions = [
    "Reduce the emphasis on exposed body and describe clothing explicitly: `sportswear`, `jersey`, `training outfit`.",
    "Instead of an image very close to a real person, use a neutral phrase like `athletic male character` or `sports commercial character`.",
    "Emphasize motion, camera, lighting, and sports atmosphere instead of body detail.",
  ];

  // CSAM (audit 1a) — nozik yosh + ISTALGAN jinsiylashtirish/ochiq-tana/ich-kiyim signali → HARD BLOK.
  // Ilgari faqat (minor && sexual) so'z birga kelganда bloklardi; endi ANY signal bloklaydi. Bypass yo'q.
  if (minor && (sexual || strongBody || genericBody || swimwear)) {
    return {
      blocked: true,
      severity: "high",
      reason: "A minor combined with a body/sexual context was detected — this is strictly forbidden and blocked",
      warnings,
      suggestions,
      category: "csam",
    };
  }

  // Deepfake / haqiqiy shaxs o'xshashligi (audit 1b) — WARN emas, HARD BLOK.
  if (deepfake || namedPerson) {
    return {
      blocked: true,
      severity: "high",
      reason:
        "A real person's likeness or a face swap (deepfake) was requested — this is blocked",
      warnings,
      suggestions: [
        "Depict a fictional, neutral character instead of a specific real person (name/celebrity).",
        "Remove intents like \"deepfake\", \"face swap\", \"real person's face\".",
      ],
      category: "deepfake",
    };
  }

  if (gore) {
    return {
      blocked: true,
      severity: "high",
      reason: "The prompt contains graphic violence or gore, which the video model will block",
      warnings,
      suggestions: [
        "Remove graphic injury, internal organs, or bloody detail.",
        "If you need a strong scene, use a softer description like `cinematic tension` or `dramatic action`.",
      ],
      category: "gore",
    };
  }

  if (sexual) {
    return {
      blocked: true,
      severity: "high",
      reason: "The prompt contains explicit sexual or near-nudity phrasing, which the model usually blocks",
      warnings,
      suggestions,
      category: "sexual",
    };
  }

  if (input.mode === "video" && hasVisualRefs && strongBody && real) {
    return {
      blocked: true,
      severity: "medium",
      reason:
        "The combination of a realistic person + body emphasis + visual reference may trip the safety filter",
      warnings,
      suggestions,
    };
  }

  if (input.mode === "video" && hasVisualRefs && strongBody) {
    return {
      blocked: true,
      severity: "medium",
      reason:
        "Strong body detail combined with attached references may be flagged as sensitive content by the model",
      warnings,
      suggestions,
    };
  }

  if (input.mode === "video" && hasVisualRefs && genericBody) {
    warnings.push("The referenced video prompt has strong body description — emphasize motion and clothing more");
    return {
      blocked: false,
      severity: "medium",
      reason: null,
      warnings,
      suggestions,
    };
  }

  if ((strongBody || genericBody) && real) {
    warnings.push("Strong emphasis on a realistic person and body detail may come close to the safety filter");
    return {
      blocked: false,
      severity: "medium",
      reason: null,
      warnings,
      suggestions,
    };
  }

  return {
    blocked: false,
    severity: warnings.length ? "medium" : "low",
    reason: null,
    warnings,
    suggestions,
  };
}
