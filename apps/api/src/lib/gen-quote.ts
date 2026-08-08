import jwt from "jsonwebtoken";
import crypto from "crypto";

// KALIT AJRATISH (Bosqich 1 #4 · FAZA 2 H6): cost-quote imzosi AUTH tokenidan ALOHIDA kalit
// bilan imzolanadi. Ilgari JWT_SECRET ham auth token, ham cost-quote uchun ishlatilardi — u
// sizib chiqsa hujjatchi SOXTA cost-quote yasab tekin generatsiya olardi.
// PRODUCTIONДА JWT_SECRET FALLBACK OLIB TASHLANDI: COST_QUOTE_SECRET yo'q yoki JWT_SECRET'ga
// teng bo'lsa index.ts validateEnv serverni FATAL to'xtatadi (JWT_SECRET kabi). Dev'da esa
// qulaylik uchun JWT_SECRET'ga (yoki dev-secret) qaytadi.
const QUOTE_SECRET =
  process.env.COST_QUOTE_SECRET?.trim() ||
  (process.env.NODE_ENV === "production"
    ? "" // prod'da bu holatga yetib bo'lmaydi — validateEnv boot'ni to'xtatadi (fail-closed)
    : process.env.JWT_SECRET || "dev-secret-change-me");
const QUOTE_KIND = "studio-gen-quote";

/** Stabil (kalitlar tartiblangan) JSON — params hash uchun. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(obj)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value ?? null);
}

/** modelId + mode + params bo'yicha barqaror hash (quote'ni so'rovga bog'lash uchun).
 * Reference qiymatlari narx paramsidan ajratiladi, lekin alohida SHA-256 manifest hash bilan
 * imzoga bog'lanadi. Demak quote'dan keyin reference almashtirilsa BAD_QUOTE chiqadi. */
export function genParamsHash(
  modelId: number,
  mode: string,
  params: Record<string, unknown>
): string {
  const priced = { ...(params || {}) };
  const referenceKeys = [
    "referenceUrl",
    "referenceUrls",
    "referenceEndUrl",
    "imageUrls",
    "videoUrls",
    "audioUrls",
    "savedReferenceIds",
    "styleReference",
    "structureReference",
  ] as const;
  const references: Record<string, unknown> = {};
  for (const key of referenceKeys) {
    if (priced[key] != null) references[key] = priced[key];
    delete priced[key];
  }
  // Reference narxga ta'sir qilmaydi, ammo quote'dan keyin reference almashtirilmasligi kerak.
  // Katta URL/data-URI'ni JWT payloadiga yozmaymiz: canonical manifestning SHA-256 digestigina
  // params hashga kiradi. Scalar va multimodal kanallar endi bir xil semantikada.
  const referenceManifestHash = crypto
    .createHash("sha256")
    .update(stableStringify(references))
    .digest("hex");
  return stableStringify({ modelId, mode, params: priced, referenceManifestHash });
}

export type CostQuote = {
  modelId: number;
  mode: string;
  price: number;
  ph: string;
};

/**
 * Narxni JWT bilan imzolaydi (15 daqiqa amal qiladi). Klient narxni o'zgartira olmaydi —
 * generate paytida imzo + (modelId, price, paramsHash) tekshiriladi (blueprint §7.3).
 */
export function signCostQuote(q: CostQuote): string {
  return jwt.sign({ ...q, k: QUOTE_KIND }, QUOTE_SECRET, { expiresIn: "15m" });
}

/** Imzolangan narxni tekshiradi — so'rovdagi qiymatlar imzo bilan mos kelishi shart. */
export function verifyCostQuote(
  signature: string,
  expect: CostQuote
): { ok: boolean; reason?: string } {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(signature, QUOTE_SECRET) as jwt.JwtPayload;
  } catch {
    return { ok: false, reason: "Signature is invalid or expired" };
  }
  if (decoded.k !== QUOTE_KIND) return { ok: false, reason: "Invalid signature type" };
  if (
    decoded.modelId !== expect.modelId ||
    decoded.price !== expect.price ||
    decoded.mode !== expect.mode ||
    decoded.ph !== expect.ph
  ) {
    return { ok: false, reason: "Price/parameters do not match the signature" };
  }
  return { ok: true };
}
