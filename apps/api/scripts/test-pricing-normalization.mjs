import assert from "node:assert/strict";
import { getModelById } from "../dist/lib/gen-models.js";
import { computeResolvedProviderCost } from "../dist/lib/measured-cost.js";
import { IMAGE_USD_PER_UNIT, VIDEO_USD_PER_SEC, FLAT_USD } from "../dist/lib/provider-cost.js";

assert.deepEqual(IMAGE_USD_PER_UNIT[1010], { "1K": 0.067, "2K": 0.101, "4K": 0.15 });
assert.equal(IMAGE_USD_PER_UNIT[1013]["1K"], 0.034);
assert.equal(IMAGE_USD_PER_UNIT[1011]["2K"], 0.04);
assert.equal(VIDEO_USD_PER_SEC[3001]["720p"], 0.03);
assert.equal(FLAT_USD[4001], 0.02);

const seedance = getModelById(3102);
assert.ok(seedance);
const measured = { usd: 0.1, samples: 3, unit: "second", tier: "720p" };
const sameTier = computeResolvedProviderCost(
  seedance,
  { resolution: "720p", duration: "4" },
  measured,
  { allowRaise: true }
);
assert.equal(sameTier.unitUsd, 0.1);
assert.equal(sameTier.usd, 0.4, "4-second total must be unit cost × duration");

const lowerTier = computeResolvedProviderCost(
  seedance,
  { resolution: "480p", duration: "4" },
  measured,
  { allowRaise: true }
);
assert.ok(lowerTier.unitUsd < sameTier.unitUsd, "tier ratio must scale normalized cost");
assert.equal(lowerTier.usd, Math.round(lowerTier.unitUsd * 4 * 10000) / 10000);

console.log("✓ Pricing normalization OK — totals, units, tiers and official tables validated.");
