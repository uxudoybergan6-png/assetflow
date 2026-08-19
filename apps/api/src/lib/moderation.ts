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
 *   • API xatosi/tarmoq uzilishi:
 *       – PRODUKSIYADA va RASM inputi bo'lsa → FAIL-CLOSED (bloklanadi), chunki
 *         kalit-so'z qatlami MATNni ko'radi lekin RASM piksellarini KO'RMAYDI
 *         (vizual CSAM/deepfake tekshirilmay o'tib ketmasin). Malware-skan fail-closed
 *         naqshiga mos. Escape hatch: MODERATION_FAIL_OPEN=true (prodda ataylab fail-open).
 *       – Dev'da / matn-only → fail-open (LOG).
 *   • MODERATION_API_KEY YO'Q (prod): boot'da BALAND OGOHLANTIRISH (moderationStartupWarning).
 *     Rasm inputlarini majburiy tekshirtirish uchun MODERATION_REQUIRE_IMAGE_VERIFICATION=true
 *     → sozlanmagan holatda ham rasmli generatsiya prodda bloklanadi (fail-closed).
 */

import {
  isVertexModerationConfigured,
  vertexModerateContent,
  type VertexModerationMedia,
} from "./ai/vertex-enhance.js";

const DEFAULT_URL = "https://api.openai.com/v1/moderations";
const DEFAULT_MODEL = "omni-moderation-latest";

function isProduction(): boolean {
  return String(process.env.NODE_ENV || "").trim() === "production";
}

/** Prodda API xatosi/sozlanmaganda RASM inputini fail-open qilish ATAYLAB tanlanganmi. */
function moderationFailOpen(): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env.MODERATION_FAIL_OPEN || "").trim());
}

/** Sozlanmagan bo'lsa ham prodda rasm inputini majburiy tekshirtirish (fail-closed). */
function requireImageVerification(): boolean {
  return /^(1|true|yes|on)$/i.test(
    String(process.env.MODERATION_REQUIRE_IMAGE_VERIFICATION || "").trim()
  );
}

/**
 * Boot'da bir marta chaqiriladi (index.ts). Produksiyada na dedicated moderation,
 * na Vertex ADC safety fallback tayyor bo'lsa — BALAND ogohlantirish chiqaradi.
 */
export function moderationStartupWarning(): void {
  if (!isProduction()) return;
  if (isSafetyVerificationConfigured()) return;
  console.warn(
    "\n" +
      "══════════════════════════════════════════════════════════════════════\n" +
      " ⚠️  AI safety verification provayderi tayyor emas.\n" +
      "     Vertex ADC/IAM yoki MODERATION_API_KEY sozlang. Yangi Studio Gen\n" +
      "     so'rovlari MODERATION_NOT_CONFIGURED bilan fail-closed bloklanadi.\n" +
      "     Batafsil: docs/PROD-ENV-CHECKLIST.md\n" +
      "══════════════════════════════════════════════════════════════════════\n"
  );
}

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

export type SafetyVerificationReadiness = {
  configured: boolean;
  ready: boolean;
  checkedAt: string | null;
  reason: string | null;
};

type SafetyReadinessCache = SafetyVerificationReadiness & { at: number };
let safetyReadinessCache: SafetyReadinessCache | null = null;
let safetyReadinessInFlight: Promise<SafetyVerificationReadiness> | null = null;
const SAFETY_READY_TTL_MS = Math.max(
  30_000,
  Number(process.env.MODERATION_HEALTH_TTL_MS) || 5 * 60_000
);
const SAFETY_DOWN_TTL_MS = Math.max(
  5_000,
  Number(process.env.MODERATION_HEALTH_FAILURE_TTL_MS) || 30_000
);

function rememberSafetyReadiness(ok: boolean, reason: string | null): void {
  const now = Date.now();
  safetyReadinessCache = {
    configured: isSafetyVerificationConfigured(),
    ready: ok,
    checkedAt: new Date(now).toISOString(),
    reason: ok ? null : reason || "Safety verification request failed",
    at: now,
  };
}

/**
 * Secret borligini emas, haqiqiy moderation chaqiruvi ishlashini tekshiradi.
 * `/gen/health` va model katalogi shu keshlangan probe'ni ishlatadi; bir vaqtda
 * kelgan so'rovlar bitta provider chaqiruvini bo'lishadi.
 */
export async function safetyVerificationReadiness(
  force = false
): Promise<SafetyVerificationReadiness> {
  if (!isSafetyVerificationConfigured()) {
    return {
      configured: false,
      ready: false,
      checkedAt: null,
      reason: "Safety verification provider is not configured",
    };
  }
  const now = Date.now();
  if (!force && safetyReadinessCache) {
    const ttl = safetyReadinessCache.ready ? SAFETY_READY_TTL_MS : SAFETY_DOWN_TTL_MS;
    if (now - safetyReadinessCache.at < ttl) {
      const { at: _at, ...cached } = safetyReadinessCache;
      return cached;
    }
  }
  safetyReadinessInFlight ??= (async () => {
    try {
      const result = await moderateGenerationContent({
        text: "FrameFlow service readiness check: a neutral geometric landscape.",
      });
      const ready = result.ok && !result.blocked;
      rememberSafetyReadiness(ready, result.reason);
    } catch (error) {
      rememberSafetyReadiness(
        false,
        error instanceof Error ? error.message : "Safety verification probe failed"
      );
    }
    const { at: _at, ...checked } = safetyReadinessCache!;
    return checked;
  })().finally(() => {
    safetyReadinessInFlight = null;
  });
  return safetyReadinessInFlight;
}

export function isModerationConfigured(): boolean {
  return !!process.env.MODERATION_API_KEY?.trim();
}

export function moderateOutputsEnabled(): boolean {
  const dedicatedEnabled =
    isModerationConfigured() &&
    /^(1|true|yes|on)$/i.test(String(process.env.MODERATION_MODERATE_OUTPUTS || "").trim());
  // Local dev eski opt-in xatti-harakatini saqlaydi. Productionda esa mavjud Vertex ADC
  // fallback output image/video/audio'ni amalda tekshiradi — bo'sh env sabab hamma gen 503 emas.
  return dedicatedEnabled || (isProduction() && isVertexModerationConfigured());
}

export function isSafetyVerificationConfigured(): boolean {
  return isModerationConfigured() || isVertexModerationConfigured();
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
  /** O'z storage URL'ini moderatsiya API ishonchli o'qiydigan data-URI'ga aylantirish.
   *  Resolver xatosida asl URL saqlanadi; haqiqiy moderatsiya gate'i hech qachon chetlab o'tilmaydi. */
  resolveImageUrl?: (url: string) => Promise<string | null>;
}): Promise<ModerationResult> {
  const imageUrls = (opts.imageUrls || []).filter(
    (u) => typeof u === "string" && /^https?:\/\//i.test(u)
  );
  const hasImages = imageUrls.length > 0;

  // Prodda RASM inputi bor va ML tekshiruvi imkonsiz (sozlanmagan) → fail-closed,
  // FAQAT owner MODERATION_REQUIRE_IMAGE_VERIFICATION=true bilan yoqqanda. Aks holda
  // (default) mavjud oqim buzilmaydi — boot ogohlantirishi bilan ko'rinadi.
  if (!isModerationConfigured()) {
    if (isProduction() && hasImages && requireImageVerification()) {
      return imageUnverifiedBlock();
    }
    return CLEAN;
  }

  const parts: OmniInputPart[] = [];
  const text = String(opts.text || "").trim();
  if (text) parts.push({ type: "text", text: text.slice(0, 4000) });
  const resolvedImageUrls: string[] = [];
  for (const originalUrl of imageUrls.slice(0, 8)) {
    let url = originalUrl;
    if (opts.resolveImageUrl) {
      try {
        const resolved = await opts.resolveImageUrl(originalUrl);
        if (resolved && (/^https?:\/\//i.test(resolved) || /^data:image\//i.test(resolved))) {
          url = resolved;
        }
      } catch (e) {
        console.warn(
          "[moderation] reference materialization xato — asl URL ishlatiladi:",
          e instanceof Error ? e.message : e
        );
      }
    }
    resolvedImageUrls.push(url);
  }
  for (const url of resolvedImageUrls) {
    parts.push({ type: "image_url", image_url: { url } });
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
      if (isProduction() && hasImages && !moderationFailOpen()) {
        console.warn(`[moderation] API ${resp.status} — FAIL-CLOSED (prod, rasm inputi tekshirilmadi)`);
        return imageUnverifiedBlock();
      }
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
    if (isProduction() && hasImages && !moderationFailOpen()) {
      console.warn("[moderation] xato — FAIL-CLOSED (prod, rasm inputi tekshirilmadi):", e instanceof Error ? e.message : e);
      return imageUnverifiedBlock();
    }
    console.warn("[moderation] xato — fail-open:", e instanceof Error ? e.message : e);
    return { ...CLEAN, ok: false, configured: true };
  }
}

export type ModerationMedia = VertexModerationMedia;

/**
 * Generation uchun yagona multimodal gate. OpenAI-mos dedicated endpoint text/image'ni
 * tekshira olsa undan foydalanadi; kalit yo'q, endpoint xato yoki video/audio mavjud bo'lsa
 * allaqachon sozlangan Vertex ADC safety filteriga o'tadi. Ikkala yo'l ham ishlamasa
 * `ok:false + blocked:true` — caller kredit/provider ishidan OLDIN 503 beradi.
 */
export async function moderateGenerationContent(opts: {
  text?: string;
  media?: ModerationMedia[];
  resolveImageUrl?: (url: string) => Promise<string | null>;
}): Promise<ModerationResult> {
  const media = Array.from(
    new Map(
      (opts.media || [])
        .filter((m) => m && typeof m.url === "string" && m.url.length > 0)
        .map((m) => [`${m.kind}:${m.url}`, m] as const)
    ).values()
  );
  const canUseDedicated = isModerationConfigured() && media.every((m) => m.kind === "image");
  if (canUseDedicated) {
    const dedicated = await moderateContent({
      text: opts.text,
      imageUrls: media.map((m) => m.url),
      resolveImageUrl: opts.resolveImageUrl,
    });
    // Haqiqiy verdict final. Faqat provider/unverified xatosida Vertex fallbackga o'tamiz.
    if (dedicated.ok || (dedicated.blocked && !dedicated.categories.some((c) => c.startsWith("unverified-")))) {
      rememberSafetyReadiness(dedicated.ok, dedicated.reason);
      return dedicated;
    }
  }

  const vertex = await vertexModerateContent({ text: opts.text, media });
  const result: ModerationResult = {
    ok: vertex.ok,
    configured: isSafetyVerificationConfigured(),
    flagged: vertex.blocked && vertex.ok,
    blocked: vertex.blocked,
    severity: vertex.blocked ? "high" : "low",
    categories: vertex.categories,
    reason: vertex.reason,
  };
  rememberSafetyReadiness(result.ok, result.reason);
  return result;
}

/** Prodda rasm inputi ML bilan tekshirilmaganida qaytariladigan fail-closed natija. */
function imageUnverifiedBlock(): ModerationResult {
  return {
    ok: false,
    configured: isModerationConfigured(),
    flagged: false,
    blocked: true,
    severity: "high",
    categories: ["unverified-image"],
    reason: "Content could not be verified by moderation and was blocked (fail-closed).",
  };
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
