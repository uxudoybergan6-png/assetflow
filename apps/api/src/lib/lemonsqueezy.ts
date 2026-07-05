import crypto from "node:crypto";
import { PluginPlanTier } from "@creative-tools/database";

/**
 * Lemon Squeezy (Merchant-of-Record) API klienti — Bosqich 3 to'lov integratsiyasi.
 *
 * Lemon Squeezy soliq/VAT'ni O'ZI hisoblaydi (MoR). Bu klient uch ish qiladi:
 *   1) do'kon variantlarini ro'yxatlaydi va MAHSULOT NOMI bo'yicha plan/kreditga
 *      xaritalaydi ("Pro"→PRO, "Studio"→STUDIO, "N Credits"→N kredit) — variant
 *      ID'lari HARDCODE qilinmaydi, jonli aniqlaydi (xarita kesh'lanadi);
 *   2) berilgan variant uchun hosted checkout yaratadi (user id/email `custom`
 *      data sifatida uzatiladi → webhook'da xaridorni app-user'ga bog'lash);
 *   3) webhook HMAC-SHA256 imzosini tekshiradi.
 *
 * Env: LEMONSQUEEZY_API_KEY (Bearer), LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET.
 * Kalitlar yo'q bo'lsa klient NO-OP xavfsiz: isLemonSqueezyConfigured()=false.
 */

const API_BASE = "https://api.lemonsqueezy.com/v1";
const JSON_API = "application/vnd.api+json";
const REQUEST_TIMEOUT_MS = 15_000;
const VARIANT_CACHE_TTL_MS = 5 * 60_000; // 5 daqiqa

export function isLemonSqueezyConfigured(): boolean {
  return !!process.env.LEMONSQUEEZY_API_KEY?.trim();
}

export function getLemonSqueezyStoreId(): string | null {
  const id = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  return id || null;
}

function apiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY?.trim();
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY sozlanmagan");
  return key;
}

async function lsFetch(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: JSON_API,
        "Content-Type": JSON_API,
        Authorization: `Bearer ${apiKey()}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const detail =
        json?.errors?.[0]?.detail || json?.message || `HTTP ${res.status}`;
      throw new Error(`Lemon Squeezy API error: ${detail}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ── Variant → plan/kredit xaritasi ──────────────────────────────────────────

export type VariantMapping = {
  variantId: string;
  productName: string;
  variantName: string;
} & (
  | { kind: "subscription"; plan: PluginPlanTier }
  | { kind: "credit"; credits: number }
);

/**
 * Mahsulot/variant nomidan plan yoki kredit miqdorini aniqlaydi.
 * Tartib MUHIM: "Studio" "Pro"'dan oldin tekshiriladi; kredit naqshi ("N credit(s)")
 * obunadan ustun (mahsulot nomi "500 Credits" kabi bo'lsa).
 */
export function classifyVariant(
  productName: string,
  variantName: string,
  variantId: string
): VariantMapping | null {
  const hay = `${productName} ${variantName}`.toLowerCase();

  // Kredit-paket: "500 Credits", "1,500 Credits", "5,000 Credits"
  const creditMatch = hay.match(/([\d][\d,\.]*)\s*credit/);
  if (creditMatch) {
    const credits = parseInt(creditMatch[1].replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(credits) && credits > 0) {
      return { kind: "credit", credits, variantId, productName, variantName };
    }
  }

  if (/\bstudio\b/.test(hay)) {
    return {
      kind: "subscription",
      plan: PluginPlanTier.STUDIO,
      variantId,
      productName,
      variantName,
    };
  }
  if (/\bpro\b/.test(hay)) {
    return {
      kind: "subscription",
      plan: PluginPlanTier.PRO,
      variantId,
      productName,
      variantName,
    };
  }
  return null; // "Free" yoki tanilmagan — checkout/webhook'da e'tiborsiz
}

type VariantCache = { at: number; list: VariantMapping[] };
let variantCache: VariantCache | null = null;

/**
 * Do'kon variantlarini Lemon Squeezy'dan olib, plan/kreditga xaritalaydi.
 * `include=product` bilan bitta so'rov: variant nomi + mahsulot nomi birga keladi.
 * STORE_ID sozlangan bo'lsa faqat shu do'kon mahsulotlari qoladi.
 */
async function fetchVariantMap(): Promise<VariantMapping[]> {
  const storeId = getLemonSqueezyStoreId();
  const out: VariantMapping[] = [];
  const products = new Map<string, { name: string; storeId?: string }>();

  let path = `/variants?include=product&page[size]=100`;
  let guard = 0;
  while (path && guard++ < 20) {
    const json = await lsFetch(path);
    for (const inc of json.included ?? []) {
      if (inc.type === "products") {
        products.set(String(inc.id), {
          name: String(inc.attributes?.name ?? ""),
          storeId: inc.attributes?.store_id != null ? String(inc.attributes.store_id) : undefined,
        });
      }
    }
    for (const v of json.data ?? []) {
      const productId = String(v.relationships?.product?.data?.id ?? "");
      const product = products.get(productId);
      if (!product) continue;
      if (storeId && product.storeId && product.storeId !== storeId) continue;
      const mapping = classifyVariant(
        product.name,
        String(v.attributes?.name ?? ""),
        String(v.id)
      );
      if (mapping) out.push(mapping);
    }
    const next: string | undefined = json.links?.next;
    // links.next to'liq URL — API_BASE'dan keyingi qismini olamiz
    path = next ? next.replace(API_BASE, "") : "";
  }
  return out;
}

export async function getVariantMap(force = false): Promise<VariantMapping[]> {
  const now = Date.now();
  if (!force && variantCache && now - variantCache.at < VARIANT_CACHE_TTL_MS) {
    return variantCache.list;
  }
  const list = await fetchVariantMap();
  variantCache = { at: now, list };
  return list;
}

/** Obuna plan (PRO/STUDIO) uchun variantni topadi (birinchi mos keluvchi). */
export async function findSubscriptionVariant(
  plan: PluginPlanTier
): Promise<VariantMapping | null> {
  const list = await getVariantMap();
  return (
    list.find((v) => v.kind === "subscription" && v.plan === plan) ?? null
  );
}

/** Aniq kredit miqdori uchun paket variantini topadi (masalan 500/1500/5000). */
export async function findCreditVariant(
  credits: number
): Promise<VariantMapping | null> {
  const list = await getVariantMap();
  return (
    list.find((v) => v.kind === "credit" && v.credits === credits) ?? null
  );
}

// ── Checkout ────────────────────────────────────────────────────────────────

/**
 * Berilgan variant uchun hosted checkout yaratadi. `custom.user_id` webhook
 * meta.custom_data'da qaytadi → xaridorni app-user'ga bog'laymiz.
 * Hosted checkout URL'ini qaytaradi.
 */
export async function createCheckout(opts: {
  variantId: string;
  userId: string;
  email?: string | null;
  name?: string | null;
  redirectUrl?: string;
}): Promise<string> {
  const storeId = getLemonSqueezyStoreId();
  if (!storeId) throw new Error("LEMONSQUEEZY_STORE_ID sozlanmagan");

  const checkoutData: Record<string, unknown> = {
    // `custom` qiymatlari STRING bo'lishi kerak — LS webhook'da meta.custom_data'da qaytaradi.
    custom: { user_id: opts.userId },
  };
  if (opts.email) checkoutData.email = opts.email;
  if (opts.name) checkoutData.name = opts.name;

  const attributes: Record<string, unknown> = { checkout_data: checkoutData };
  if (opts.redirectUrl) {
    attributes.product_options = { redirect_url: opts.redirectUrl };
  }

  const json = await lsFetch(`/checkouts`, {
    method: "POST",
    body: {
      data: {
        type: "checkouts",
        attributes,
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: opts.variantId } },
        },
      },
    },
  });

  const url = json?.data?.attributes?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Lemon Squeezy checkout URL qaytmadi");
  }
  return url;
}

// ── Webhook imzosi ──────────────────────────────────────────────────────────

/**
 * Lemon Squeezy webhook HMAC-SHA256 imzosini tekshiradi. Imzo = X-Signature
 * sarlavhasi (hex), maxfiy = LEMONSQUEEZY_WEBHOOK_SECRET, xabar = RAW body bytes.
 * timingSafeEqual bilan doimiy-vaqt taqqoslash. Sozlanmagan/imzo yo'q → false.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHex: string | undefined
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHex) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Webhook body'dan barqaror dedup kaliti — imzo-mustaqil (raw body sha256).
    Bir xil yetkazish (retry) → bir xil kalit; boshqa event → boshqa kalit. */
export function webhookDedupeKey(rawBody: Buffer): string {
  const hash = crypto.createHash("sha256").update(rawBody).digest("hex");
  return `ls:${hash}`;
}
