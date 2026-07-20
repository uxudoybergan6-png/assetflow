// P30 (29c) — provayder KONTENT rad etishini aniqlash (transient xatolardan ajratish).
//
// Provayder xavfsizlik filtri promptni rad etsa, generatsiya `failed` bo'ladi va kredit
// QAYTARILADI (gen-processor). Klientga bu "kontent rad etilishi"ni ANIQ aytish kerak:
//  · halol xato ikonkasi (✓ EMAS),
//  · haqiqiy sabab,
//  · "✦N qaytarildi",
//  · boshqa (mo''tadil siyosatli) MODEL taklifi.
// Bu modul xato matnini shu maqsadda tasniflaydi. FILTER-EVASION uchun EMAS.

export type RejectionInfo = {
  isContent: boolean;
  category: string | null; // "realface" | "sexual" | "content" | null
  reason: string; // TOZA insoniy sabab (HECH QACHON xom provayder JSON'i emas) — klientга ko'rsatiladi
  raw: string; // asl xato matni (audit/log uchun — klientга ko'rsatilmaydi)
};

// Provayderlar (Google Vertex/Imagen/Veo, BytePlus, fal) qaytaradigan kontent-rad naqshlari.
const CONTENT_PATTERNS: Array<{ re: RegExp; category: string }> = [
  { re: /sensitive content|nsfw|nudity|sexual|explicit|erotic/i, category: "sexual" },
  { re: /no image was returned|returned no image|image was not (returned|generated)/i, category: "content" },
  { re: /content polic|usage polic|safety (system|filter|policy|settings)|responsible ai|\bRAI[_ ]?|blocklist|block[_ ]?list/i, category: "content" },
  { re: /blocked (by|for|due)|was blocked|prohibited|flagged (as|for|by)|violat\w+ .*(polic|guideline)/i, category: "content" },
  { re: /moderation (blocked|failed|rejected)|did not pass moderation/i, category: "content" },
];

// R4_04 — real yuz / mashhur shaxs bloki (Google "restricted individuals ... Responsible AI").
// Spetsifik iboralar provayderdan qat'iy nazar; "could not be submitted" esa GENERIC (boshqa 400'larda
// ham chiqishi mumkin) → faqat Google/Vertex/Omni kontekstida realface deb tasniflanadi (over-match yo'q).
const REALFACE_RE = /restricted individual|real (?:person|people|face|human)|public figure|\bcelebrit/i;
const GOOGLE_SUBMIT_RE = /could not be submitted|input could not be/i;
function isGoogleProvider(p: string | null | undefined): boolean {
  return /vertex|omni|google|imagen|\bveo\b|gemini/i.test(String(p || ""));
}

// Kategoriya → TOZA insoniy sabab (xom JSON hech qachon ko'rsatilmaydi).
const CLEAN_REASON: Record<string, string> = {
  realface:
    "This image contains a real person or public figure that this model won’t process — try a model with a different content policy.",
  sexual: "This request was blocked for sensitive/NSFW content.",
  content: "The model’s content filter rejected this request.",
};

/**
 * Xato matnini tasniflaydi. isContent=true → provayder kontent filtri rad etdi (transient emas).
 * `reason` — TOZA insoniy matn (klientга); `raw` — asl matn (audit). opts.provider realface gate uchun.
 */
export function classifyGenRejection(
  errorText: string | null | undefined,
  opts?: { provider?: string | null }
): RejectionInfo {
  const raw = String(errorText || "").trim();
  if (!raw) return { isContent: false, category: null, reason: "", raw: "" };
  // Realface birinchi (eng spetsifik). "could not be submitted" faqat Google kontekstida.
  if (REALFACE_RE.test(raw) || (isGoogleProvider(opts?.provider) && GOOGLE_SUBMIT_RE.test(raw))) {
    return { isContent: true, category: "realface", reason: CLEAN_REASON.realface, raw };
  }
  for (const p of CONTENT_PATTERNS) {
    if (p.re.test(raw)) {
      return {
        isContent: true,
        category: p.category,
        reason: CLEAN_REASON[p.category] || CLEAN_REASON.content,
        raw,
      };
    }
  }
  return { isContent: false, category: null, reason: raw, raw };
}
