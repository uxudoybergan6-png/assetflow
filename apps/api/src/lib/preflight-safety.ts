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

export function softenPromptForSafety(prompt: string, mode = "video"): string {
  let text = String(prompt || "");
  if (!text) return text;
  const swaps: Array<[RegExp, string]> = [
    [/\bshirtless\b/gi, "in sportswear"],
    [/\btopless\b/gi, "fully clothed"],
    [/\bbare chest\b/gi, "upper-body silhouette"],
    [/\bfull body\b/gi, "full figure"],
    [/\bbody parts\b/gi, "appearance details"],
    [/\bmuscular\b/gi, "athletic"],
    [/\btorso\b/gi, "upper silhouette"],
    [/\bchest\b/gi, "upper frame"],
    [/to'liq tanasini/gi, "obrazini"],
    [/to'liq tana/gi, "to'liq figura"],
    [/tana qismlari/gi, "tashqi ko'rinishi"],
    [/qo'l va oyoqlarini qo'y/gi, "pozasi va harakatini moslashtir"],
    [/qo'l va oyoq/gi, "poza va harakat"],
    [/\btana\b/gi, "figura"],
  ];
  swaps.forEach(([from, to]) => {
    text = text.replace(from, to);
  });
  if (mode === "video") {
    text +=
      " Subject remains fully clothed in sportswear. Focus on motion, composition, lighting, and athletic performance rather than exposed body details.";
  }
  return text.trim();
}

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
    "Ochiq tana urg'usini kamaytiring va kiyimni aniq yozing: `sportswear`, `jersey`, `training outfit`.",
    "Real odamga juda yaqin tasvir o'rniga `athletic male character` yoki `sports commercial character` kabi neytral ibora ishlating.",
    "Tana detali o'rniga harakat, kamera, yorug'lik va sport atmosferasiga urg'u bering.",
  ];

  // CSAM (audit 1a) — nozik yosh + ISTALGAN jinsiylashtirish/ochiq-tana/ich-kiyim signali → HARD BLOK.
  // Ilgari faqat (minor && sexual) so'z birga kelganда bloklardi; endi ANY signal bloklaydi. Bypass yo'q.
  if (minor && (sexual || strongBody || genericBody || swimwear)) {
    return {
      blocked: true,
      severity: "high",
      reason: "Nozik yosh + tana/jinsiy kontekst aniqlandi — bu qat'iy taqiqlangan va bloklanadi",
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
        "Haqiqiy shaxsning o'xshashligi yoki yuz almashtirish (deepfake) so'ralgan — bu bloklanadi",
      warnings,
      suggestions: [
        "Aniq real shaxs (nom/mashhurlik) o'rniga xayoliy, neytral personaj tasvirlang.",
        "«deepfake», «face swap», «real person's face» kabi niyatlarni olib tashlang.",
      ],
      category: "deepfake",
    };
  }

  if (gore) {
    return {
      blocked: true,
      severity: "high",
      reason: "Promptda grafik zo'ravonlik yoki gore ifodalari bor, bu video modelda bloklanadi",
      warnings,
      suggestions: [
        "Grafik jarohat, ichki a'zo yoki qonli tafsilotlarni olib tashlang.",
        "Kuchli sahna kerak bo'lsa, `cinematic tension` yoki `dramatic action` kabi yumshoqroq tasvir bering.",
      ],
      category: "gore",
    };
  }

  if (sexual) {
    return {
      blocked: true,
      severity: "high",
      reason: "Promptda ochiq jinsiy yoki yalang'ochlikka yaqin iboralar bor, model buni ko'pincha bloklaydi",
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
        "Realistik odam + tana urg'usi + vizual referens kombinatsiyasi safety filtrga tushishi mumkin",
      warnings,
      suggestions,
    };
  }

  if (input.mode === "video" && hasVisualRefs && strongBody) {
    return {
      blocked: true,
      severity: "medium",
      reason:
        "Tana detali kuchli berilgan va referenslar biriktirilgan — model buni nozik kontent deb ushlashi mumkin",
      warnings,
      suggestions,
    };
  }

  if (input.mode === "video" && hasVisualRefs && genericBody) {
    warnings.push("Referensli video promptda tana ta'rifi kuchli — harakat va kiyimga ko'proq urg'u bering");
    return {
      blocked: false,
      severity: "medium",
      reason: null,
      warnings,
      suggestions,
    };
  }

  if ((strongBody || genericBody) && real) {
    warnings.push("Realistik odam va tana detaliga kuchli urg'u safety filtrga yaqinlashishi mumkin");
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
