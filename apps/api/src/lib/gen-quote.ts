import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
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
 *  `referenceUrl` HASHDAN chiqariladi: u narxga ta'sir qilmaydi va katta (data-URI/URL)
 *  bo'lishi mumkin. Shu tufayli cost-quote (referencesiz) va /gen (reference bilan)
 *  bir xil hash beradi — aks holda reference qo'shilsa BAD_QUOTE bo'lardi. */
export function genParamsHash(
  modelId: number,
  mode: string,
  params: Record<string, unknown>
): string {
  const priced = { ...(params || {}) };
  delete priced.referenceUrl;
  delete priced.referenceUrls; // KO'P referens (GPT Image 2 Edit @imgN) — narxga ta'sir qilmaydi, data-og'ir.
  delete priced.referenceEndUrl; // End kadr ham narxga ta'sir qilmaydi (referenceUrl kabi)
  // QB-2: Magnific reference kanallari — narxga ta'sir qilmaydi, data-og'ir (base64).
  // Hashdan chiqarilmasa cost-quote (referencesiz) va /gen (reference bilan) ph'i farq qiladi
  // → har gen 400 BAD_QUOTE. Shu sabab DOIM o'chiriladi (mavjud bo'lmasa no-op).
  delete priced.styleReference;
  delete priced.structureReference;
  return stableStringify({ modelId, mode, params: priced });
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
  return jwt.sign({ ...q, k: QUOTE_KIND }, JWT_SECRET, { expiresIn: "15m" });
}

/** Imzolangan narxni tekshiradi — so'rovdagi qiymatlar imzo bilan mos kelishi shart. */
export function verifyCostQuote(
  signature: string,
  expect: CostQuote
): { ok: boolean; reason?: string } {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(signature, JWT_SECRET) as jwt.JwtPayload;
  } catch {
    return { ok: false, reason: "Imzo yaroqsiz yoki muddati o'tgan" };
  }
  if (decoded.k !== QUOTE_KIND) return { ok: false, reason: "Imzo turi noto'g'ri" };
  if (
    decoded.modelId !== expect.modelId ||
    decoded.price !== expect.price ||
    decoded.mode !== expect.mode ||
    decoded.ph !== expect.ph
  ) {
    return { ok: false, reason: "Narx/parametr imzo bilan mos kelmadi" };
  }
  return { ok: true };
}
