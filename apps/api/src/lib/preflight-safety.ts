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

const REAL_PERSON = [
  "realistic",
  "photoreal",
  "photorealistic",
  "real person",
  "celebrity",
  "footballer",
  "athlete",
  "sportsman",
  "ronaldo",
  "messi",
  "haqiqiy odam",
  "fotoreal",
  "real odam",
  "sportchi",
  "futbolchi",
];

const MINOR_TERMS = [
  "child",
  "kid",
  "teen",
  "underage",
  "minor",
  "bola",
  "o'smir",
  "osm ir",
  "voyaga yetmagan",
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
  const real = hasAny(text, REAL_PERSON);
  const minor = hasAny(text, MINOR_TERMS);
  const gore = hasAny(text, GORE_TERMS);
  const warnings: string[] = [];
  const suggestions = [
    "Ochiq tana urg'usini kamaytiring va kiyimni aniq yozing: `sportswear`, `jersey`, `training outfit`.",
    "Real odamga juda yaqin tasvir o'rniga `athletic male character` yoki `sports commercial character` kabi neytral ibora ishlating.",
    "Tana detali o'rniga harakat, kamera, yorug'lik va sport atmosferasiga urg'u bering.",
  ];

  if (minor && sexual) {
    return {
      blocked: true,
      severity: "high",
      reason: "Promptda nozik yosh + jinsiy mazmun kombinatsiyasi bor, bu bloklanadi",
      warnings,
      suggestions,
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
    };
  }

  if (sexual) {
    return {
      blocked: true,
      severity: "high",
      reason: "Promptda ochiq jinsiy yoki yalang'ochlikka yaqin iboralar bor, model buni ko'pincha bloklaydi",
      warnings,
      suggestions,
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
