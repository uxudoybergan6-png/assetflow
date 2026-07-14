/**
 * P27 D6 (acceptance) — "no channel sells a credit below creditUsdValue ÷ marginTarget".
 * Boot-gate (validateGenModelsOrThrow naqshi): har sotuv kanali (plan + kredit paketi) $/kredit'i
 * pol (floor)dan past bo'lsa BALAND ovozda yiqiladi → narx regressiyasi jimgina qaytib kelolmaydi.
 *
 * ⚠️ MONEY ZONE: bu faqat TEKSHIRADI — hech qanday kredit qiymatini o'zgartirmaydi. Kanallar
 * P27 tasdiqlangan raqamlari; landing-config plans + platform/index.html creditPacks + Lemon
 * Squeezy variantlari SHU raqamlarga mos bo'lishi kerak (uchtasi ham qo'lda sinxron).
 */

function envNum(key: string, def: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

// Anchor + marja — model-pricing.ts bilan bir xil env/default (DEFAULT_CREDIT_USD=0.019, target=2.0).
function creditFloorUsd(): number {
  const creditUsd = envNum("PRICING_CREDIT_USD_VALUE", 0.019);
  const margin = envNum("PRICING_MARGIN_TARGET", 2.0);
  return creditUsd / margin; // pastki chegara: kanal $/kredit shundan past bo'lmasin
}

type Channel = { name: string; usd: number; credits: number };

// P27 tasdiqlangan kanallar (D1 paketlar + D2 planlar). Free (0/50) — chiqarilgan (bepul kanal).
const CHANNELS: Channel[] = [
  { name: "Pro plan", usd: 19, credits: 1000 },
  { name: "Studio plan", usd: 59, credits: 3000 },
  { name: "Pack 250", usd: 5, credits: 250 },
  { name: "Pack 600", usd: 12, credits: 600 },
  { name: "Pack 1800", usd: 35, credits: 1800 },
];

/** Step 21 — panelда ko'rsatish uchun THROW qilmaydigan tekshiruv (boot assert bilan bir mantiq).
 *  Har kanal $/kredit'i + pol'dan pastmi. Profit paneli qizil banner uchun ishlatadi. */
export function checkPricingFloors(): {
  floorUsd: number;
  channels: Array<{ name: string; usd: number; credits: number; perCredit: number; belowFloor: boolean }>;
  violations: string[];
} {
  const floor = creditFloorUsd();
  const channels = CHANNELS.map((c) => {
    const perCredit = c.credits > 0 ? c.usd / c.credits : 0;
    return { name: c.name, usd: c.usd, credits: c.credits, perCredit, belowFloor: perCredit < floor - 1e-9 };
  });
  return {
    floorUsd: floor,
    channels,
    violations: channels.filter((c) => c.belowFloor).map((c) => `${c.name}: $${c.perCredit.toFixed(4)}/credit < floor $${floor.toFixed(4)}`),
  };
}

/** Boshda chaqiriladi — biror kanal pol'dan past bo'lsa throw (boot yiqiladi). */
export function assertPricingFloorsOrThrow(): void {
  const floor = creditFloorUsd();
  const bad: string[] = [];
  for (const c of CHANNELS) {
    if (!(c.credits > 0)) continue;
    const perCredit = c.usd / c.credits;
    if (perCredit < floor - 1e-9) {
      bad.push(
        `${c.name}: $${perCredit.toFixed(4)}/credit < floor $${floor.toFixed(4)} ($${c.usd}/${c.credits})`
      );
    }
  }
  if (bad.length) {
    throw new Error(
      `PRICING FLOOR VIOLATION (P27 D6) — a channel sells credits below cost:\n  ` +
        bad.join("\n  ") +
        `\nFix landing-config plans / platform/index.html creditPacks / Lemon Squeezy variants.`
    );
  }
  console.log(
    `✓ Pricing floors OK — ${CHANNELS.length} kanal, hech biri $${floor.toFixed(4)}/credit pol'dan past emas.`
  );
}
