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
  category: string | null; // "sexual" | "content" | null
  reason: string;
};

// Provayderlar (Google Vertex/Imagen/Veo, BytePlus, fal) qaytaradigan kontent-rad naqshlari.
const CONTENT_PATTERNS: Array<{ re: RegExp; category: string }> = [
  { re: /sensitive content|nsfw|nudity|sexual|explicit|erotic/i, category: "sexual" },
  { re: /no image was returned|returned no image|image was not (returned|generated)/i, category: "content" },
  { re: /content polic|usage polic|safety (system|filter|policy|settings)|responsible ai|\bRAI[_ ]?|blocklist|block[_ ]?list/i, category: "content" },
  { re: /blocked (by|for|due)|was blocked|prohibited|flagged (as|for|by)|violat\w+ .*(polic|guideline)/i, category: "content" },
  { re: /moderation (blocked|failed|rejected)|did not pass moderation/i, category: "content" },
];

/** Xato matnini tasniflaydi. isContent=true → provayder kontent filtri rad etdi (transient emas). */
export function classifyGenRejection(errorText: string | null | undefined): RejectionInfo {
  const raw = String(errorText || "").trim();
  if (!raw) return { isContent: false, category: null, reason: "" };
  for (const p of CONTENT_PATTERNS) {
    if (p.re.test(raw)) {
      return { isContent: true, category: p.category, reason: raw };
    }
  }
  return { isContent: false, category: null, reason: raw };
}
