/**
 * Kontent moderatsiya — ML klassifikator qatlami (Bosqich 2 #1).
 *
 * `preflight-safety.ts` — TEZKOR kalit-so'z (heuristik) qatlami; bu fayl uning
 * USTIGA haqiqiy ML moderatsiyani qo'yadi: matn prompt + referens RASM + generatsiya
 * NATIJASI OpenAI-mos moderation API (`omni-moderation-latest`) orqali klassifikatsiya
 * qilinadi.
 *
 * SOZLAMA (env — MANUAL QADAM):
 *   MODERATION_API_KEY   — provayder kaliti (masalan OpenAI). YO'Q → moderatsiya no-op:
 *                          dev'da o'tkazadi, prodda kalit-so'z qatlami (preflight) baribir
 *                          og'ir kategoriyalarni FAIL-CLOSED bloklaydi.
 *   MODERATION_API_URL   — endpoint (default https://api.openai.com/v1/moderations)
 *   MODERATION_MODEL     — model (default omni-moderation-latest — matn+rasm ko'p-modal)
 *   MODERATION_MODERATE_OUTPUTS=true — generatsiya NATIJASINI ham tekshir (default off)
 *
 * FAIL-CLOSED SIYOSATI:
 *   • OG'IR kategoriya (CSAM = sexual/minors, self-harm ko'rsatma, zo'ravon-noqonuniy)
 *     aniqlansa — HAR DOIM (dev ham, prod ham) BLOKLANADI. Bypass yo'q.
 *   • Yengilroq flag'lar — WARN (buzmaymiz — soxta pozitiv legitim oqimni to'smasin).
 *   • API xatosi/tarmoq uzilishi — fail-open (LOG) chunki kalit-so'z qatlami og'ir
 *     kategoriyalarni allaqachon gate qiladi; butun trafikni to'smaymiz.
 */

const DEFAULT_URL = "https://api.openai.com/v1/moderations";
const DEFAULT_MODEL = "omni-moderation-latest";

/** HAR DOIM bloklanadigan og'ir kategoriyalar (OpenAI omni-moderation nomlari). */
const SEVERE_CATEGORIES = new Set<string>([
  "sexual/minors", // CSAM — hech qachon o'tmaydi
  "self-harm/instructions",
  "illicit/violent",
]);

export type ModerationResult = {
  ok: boolean; // API muvaffaqiyatli javob berdimi (yoki sozlanmagan → true, no-op)
  configured: boolean;
  flagged: boolean;
  blocked: boolean; // og'ir kategoriya → true (yoki strict rejimda istalgan flag)
  severity: "low" | "medium" | "high";
  categories: string[]; // flag qilingan kategoriyalar
  reason: string | null;
};

const CLEAN: ModerationResult = {
  ok: true,
  configured: false,
  flagged: false,
  blocked: false,
  severity: "low",
  categories: [],
  reason: null,
};

export function isModerationConfigured(): boolean {
  return !!process.env.MODERATION_API_KEY?.trim();
}

export function moderateOutputsEnabled(): boolean {
  return (
    isModerationConfigured() &&
    /^(1|true|yes|on)$/i.test(String(process.env.MODERATION_MODERATE_OUTPUTS || "").trim())
  );
}

function moderationStrict(): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env.MODERATION_STRICT || "").trim());
}

type OmniInputPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Matn + rasm URL'larni bitta moderation chaqiruviga birlashtirib klassifikatsiya qiladi.
 * omni-moderation ko'p-modal `input` massivini qabul qiladi. Video/audio referens bu API'da
 * qo'llanmaydi — e'tiborsiz qoldiriladi (kalit-so'z qatlami ularni baribir ko'radi).
 */
export async function moderateContent(opts: {
  text?: string;
  imageUrls?: string[];
}): Promise<ModerationResult> {
  if (!isModerationConfigured()) return CLEAN;

  const parts: OmniInputPart[] = [];
  const text = String(opts.text || "").trim();
  if (text) parts.push({ type: "text", text: text.slice(0, 4000) });
  for (const url of (opts.imageUrls || []).slice(0, 8)) {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      parts.push({ type: "image_url", image_url: { url } });
    }
  }
  if (!parts.length) return { ...CLEAN, configured: true };

  const url = process.env.MODERATION_API_URL?.trim() || DEFAULT_URL;
  const model = process.env.MODERATION_MODEL?.trim() || DEFAULT_MODEL;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MODERATION_API_KEY!.trim()}`,
      },
      body: JSON.stringify({ model, input: parts }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!resp.ok) {
      console.warn(`[moderation] API ${resp.status} — fail-open (kalit-so'z qatlami baribir gate qiladi)`);
      return { ...CLEAN, ok: false, configured: true };
    }
    const data = (await resp.json()) as {
      results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>;
    };
    const flaggedCats = new Set<string>();
    let anyFlagged = false;
    for (const r of data.results || []) {
      if (r.flagged) anyFlagged = true;
      for (const [cat, on] of Object.entries(r.categories || {})) {
        if (on) flaggedCats.add(cat);
      }
    }
    const cats = Array.from(flaggedCats);
    const severe = cats.filter((c) => SEVERE_CATEGORIES.has(c));
    const blocked = severe.length > 0 || (moderationStrict() && anyFlagged);
    const reason = blocked
      ? severe.length
        ? `Content was flagged in a prohibited category: ${severe.join(", ")}`
        : `Content did not pass moderation: ${cats.join(", ")}`
      : null;
    return {
      ok: true,
      configured: true,
      flagged: anyFlagged,
      blocked,
      severity: severe.length ? "high" : anyFlagged ? "medium" : "low",
      categories: cats,
      reason,
    };
  } catch (e) {
    console.warn("[moderation] xato — fail-open:", e instanceof Error ? e.message : e);
    return { ...CLEAN, ok: false, configured: true };
  }
}

/** Params ichidan moderatsiya qilinadigan RASM referens URL'larini yig'adi (public http). */
export function collectImageRefUrls(params?: Record<string, unknown>): string[] {
  if (!params) return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && /^https?:\/\//i.test(v)) out.push(v);
  };
  push(params.referenceUrl);
  push(params.referenceEndUrl);
  for (const key of ["referenceUrls", "imageUrls"]) {
    const arr = params[key];
    if (Array.isArray(arr)) arr.forEach(push);
  }
  return Array.from(new Set(out));
}
