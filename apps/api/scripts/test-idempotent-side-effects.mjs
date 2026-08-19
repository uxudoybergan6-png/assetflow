import assert from "node:assert/strict";
import fs from "node:fs";
import { assistIdentity } from "../dist/lib/assist-idempotency.js";
import {
  hasUnsettledGenerationRefund,
  isActiveSessionGeneration,
} from "../dist/lib/generation-state.js";
import {
  downloadClaimReplayDecision,
  creditRefundPlan,
  importReservationReplayDecision,
  importReservationIdFor,
  ledgerBackedGenerationRefund,
  shouldUpdateGenerationRefundState,
  writeGenerationRefundState,
} from "../dist/lib/plugin-profile.js";

// Durable assist identity: ayni click+payload barcha instansda bir xil; payload reuse esa
// ayni operation ID, boshqa requestHash beradi va server conflict deb taniydi.
const a1 = assistIdentity("user-1", "enhance", "request-12345678", { prompt: "hello", mode: "image" });
const a2 = assistIdentity("user-1", "enhance", "request-12345678", { mode: "image", prompt: "hello" });
const changed = assistIdentity("user-1", "enhance", "request-12345678", { prompt: "different", mode: "image" });
const describe = assistIdentity("user-1", "describe", "request-12345678", { prompt: "hello", mode: "image" });
assert.deepEqual(a2, a1, "canonical payload order must not change assist identity");
assert.equal(changed.id, a1.id, "same logical request key must hit the same durable operation row");
assert.notEqual(changed.requestHash, a1.requestHash, "same key with changed payload must be detectable as a conflict");
assert.notEqual(describe.id, a1.id, "enhance and describe keys are separately namespaced");

// Import response-loss retry aynan bitta deterministic ImportReservation primary key oladi.
const now = Date.now();
const ir1 = importReservationIdFor("user-1", "import-request-123");
assert.equal(importReservationIdFor("user-1", "import-request-123"), ir1);
assert.notEqual(importReservationIdFor("user-1", "import-request-456"), ir1);
assert.notEqual(importReservationIdFor("user-2", "import-request-123"), ir1);
assert.match(ir1, /^ir_[a-f0-9]{36}$/);

// Reserve javobi yo'qolgan PENDING urinishgina replay bo'ladi. Committed kalitni
// qayta ishlatish yangi import slotini tekin ochmasligi kerak.
const reservationExpiry = new Date(now + 60_000);
assert.equal(importReservationReplayDecision({ status: "reserved", expiresAt: reservationExpiry }, new Date(now)), "replay");
assert.equal(importReservationReplayDecision({ status: "reserved", expiresAt: new Date(now - 1) }, new Date(now)), "expired");
assert.equal(importReservationReplayDecision({ status: "committed", expiresAt: reservationExpiry }, new Date(now)), "terminal");
assert.equal(importReservationReplayDecision({ status: "cancelled", expiresAt: reservationExpiry }, new Date(now)), "terminal");

assert.equal(isActiveSessionGeneration("reserving"), true);
assert.equal(isActiveSessionGeneration("queued"), true);
assert.equal(isActiveSessionGeneration("running"), true);
assert.equal(isActiveSessionGeneration("done"), false);
assert.equal(isActiveSessionGeneration("failed"), false);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 10, refunded: false, refundStatus: null }), true);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 10, refunded: false, refundStatus: "pending" }), true);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 10, refunded: true, refundStatus: "pending" }), false);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 10, refunded: false, refundStatus: "not_required" }), false);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 10, refunded: true, refundStatus: "applied" }), false);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 10, refunded: true, refundStatus: null }), false);
assert.equal(hasUnsettledGenerationRefund({ status: "failed", cost: 0, refunded: false, refundStatus: null }), false);
assert.equal(hasUnsettledGenerationRefund({ status: "done", cost: 10, refunded: false, refundStatus: null }), false);

// Download retry faqat 15 daqiqalik oyna + ayni template uchun replay. Template-level
// marker MOGRT→pack fallbackni bitta logical download qiladi; boshqa template conflict.
const claim = {
  userId: "user-1",
  reason: "download_claim",
  generationId: "download:template-1",
  createdAt: new Date(now - 60_000),
};
assert.equal(
  downloadClaimReplayDecision(claim, { userId: "user-1", assetMarker: "download:template-1" }, now),
  "replay",
  "claimed MOGRT then pack fallback for the same template must not consume twice"
);
assert.equal(
  downloadClaimReplayDecision(claim, { userId: "user-1", assetMarker: "download:template-2" }, now),
  "conflict",
  "same request key cannot be moved to another template"
);
assert.equal(
  downloadClaimReplayDecision({ ...claim, createdAt: new Date(now - 16 * 60_000) }, { userId: "user-1", assetMarker: "download:template-1" }, now),
  "expired",
  "idempotency key cannot bypass quota indefinitely"
);

// Refund hech qachon haqiqiy consume ledger debitidan oshmaydi (credit mint guard).
assert.equal(ledgerBackedGenerationRefund(10, -4), 4);
assert.equal(ledgerBackedGenerationRefund(10, 0), 0);
assert.equal(ledgerBackedGenerationRefund(10, null), 0);
assert.deepEqual(
  creditRefundPlan({ cost: 55, currentBalance: 5, currentTopup: 5, monthlyAllotment: 50, topupConsumed: 5 }),
  { applied: 55, topupApplied: 5 },
  "same-month failure must restore both monthly and purchased credits"
);
assert.deepEqual(
  creditRefundPlan({ cost: 55, currentBalance: 55, currentTopup: 5, monthlyAllotment: 50, topupConsumed: 5 }),
  { applied: 5, topupApplied: 5 },
  "after a month reset only the consumed paid top-up portion carries over"
);
assert.deepEqual(
  creditRefundPlan({ cost: 10, currentBalance: 50, currentTopup: 0, monthlyAllotment: 50, topupConsumed: 0 }),
  { applied: 0, topupApplied: 0 },
  "an old base-credit refund must not mint above the monthly ceiling"
);
assert.equal(shouldUpdateGenerationRefundState({ generationId: "gen-1" }), true);
assert.equal(
  shouldUpdateGenerationRefundState({ generationId: "assist-1", consumeSourceKey: "assist:consume" }),
  false,
  "AiGeneration assist refund must never update the unrelated Generation table"
);
let generationWrites = 0;
const fakeTx = {
  generation: {
    update: async () => { generationWrites += 1; },
  },
};
assert.equal(await writeGenerationRefundState(fakeTx, { generationId: "assist-1", consumeSourceKey: "assist:consume" }, 3), false);
assert.equal(generationWrites, 0, "assist refund must issue zero Generation.update calls");
assert.equal(await writeGenerationRefundState(fakeTx, { generationId: "gen-1" }, 3), true);
assert.equal(generationWrites, 1, "regular generation refund still updates its settlement row");

const profile = fs.readFileSync("apps/api/src/lib/plugin-profile.ts", "utf8");
const assist = fs.readFileSync("apps/api/src/lib/assist-idempotency.ts", "utf8");
const studio = fs.readFileSync("apps/api/src/routes/studio-gen.ts", "utf8");
const plugin = fs.readFileSync("apps/api/src/routes/plugin.ts", "utf8");
const processor = fs.readFileSync("apps/api/src/lib/gen-processor.ts", "utf8");
const refundConstraintMigration = fs.readFileSync(
  "packages/database/prisma/migrations/20260820120000_generation_refund_not_required/migration.sql",
  "utf8"
);

assert.match(profile, /sourceKey:\s*opts\.sourceKey\s*\|\|\s*null/);
assert.match(profile, /if \(\(e as \{ code\?: string \}\)\?\.code !== "P2002" \|\| !opts\.sourceKey\) throw e;/);
assert.match(profile, /tx\.aiGeneration\.create/);
assert.match(profile, /TOPUP_CONSUME_ALLOCATION_REASON/);
assert.match(profile, /"topupBefore" - "aiCreditsTopup"/, "consume transaction persists the paid-credit allocation");
assert.match(profile, /aiCreditsTopup:\s*\{ increment: topupApplied \}/, "refund restores the paid-credit tracker atomically");
assert.match(profile, /id:\s*opts\.operation\.id/);
assert.match(profile, /consumeSourceKey/);
assert.match(profile, /prior\.generationId !== \(opts\.generationId \?\? null\)/, "refund replay must remain bound to the original operation");
assert.match(profile, /await writeGenerationRefundState\(tx, opts, applied\)/, "the DB transaction must use the tested refund-state writer");
assert.match(profile, /importReservationReplayDecision\(existing\)/, "expired/terminal import replay must use the tested state decision");
assert.match(profile, /current\?\.status === "reserved" && current\.expiresAt < new Date\(\)/, "commit cannot revive an expired import reservation");
assert.match(refundConstraintMigration, /DROP CONSTRAINT IF EXISTS "Generation_refundStatus_valid"/);
assert.match(
  refundConstraintMigration,
  /"refundStatus" IN \('pending', 'applied', 'not_required'\)/,
  "production CHECK constraint must accept the terminal no-charge settlement state"
);

assert.match(assist, /status:\s*AiGenerationStatus\.PENDING/);
assert.match(assist, /status:\s*AiGenerationStatus\.FAILED, resultKey:\s*null/);
assert.match(assist, /refundAiCredits\(row\.userId, row\.credits/);
assert.match(assist, /where:\s*\{[\s\S]*status:\s*AiGenerationStatus\.PENDING[\s\S]*\}/);
assert.match(processor, /reconcileStaleAssistOperations\(\)/, "periodic money reconciler must repair crashed assists");

const enhanceCore = studio.slice(studio.indexOf("async function enhanceCore"), studio.indexOf('studioGenRouter.post("/gen/prompt/enhance"'));
assert.ok(enhanceCore.indexOf("readAssistReplay") < enhanceCore.indexOf("isVertexEnhanceConfigured"), "replay must work during a current provider outage");
assert.ok(enhanceCore.indexOf("gate.idempotentReplay") < enhanceCore.indexOf("vertexEnhancePrompt"), "duplicate must return before provider call");
assert.ok(enhanceCore.indexOf("gate.idempotentReplay") < enhanceCore.indexOf("withinDailyCap"), "duplicate must not increment the helper daily cap twice");
assert.ok(enhanceCore.indexOf("invalidEnhanceVideo") < enhanceCore.indexOf("withinDailyCap"), "invalid video references must not consume daily cap");
assert.match(enhanceCore, /settleAssistOperation/);
assert.match(enhanceCore, /if \(await settleAssistOperation[\s\S]*readAssistReplay/, "late provider success must lose to stale-refund durable state");

const describeCore = studio.slice(studio.indexOf("async function describeCore"), studio.indexOf('studioGenRouter.post("/gen/describe"'));
assert.ok(describeCore.indexOf("readAssistReplay") < describeCore.indexOf("isOpenRouterConfigured"));
assert.ok(describeCore.indexOf("gate.idempotentReplay") < describeCore.indexOf("orImageToPrompt"));
assert.ok(describeCore.indexOf("gate.idempotentReplay") < describeCore.indexOf("withinDailyCap"), "describe duplicate must not increment the helper daily cap twice");
assert.match(describeCore, /settleAssistOperation/);

assert.match(plugin, /`download:\$\{month\}:\$\{digest\}`/, "download claims must be month-namespaced");
assert.match(plugin, /code:\s*"STORAGE_UNAVAILABLE"[\s\S]*return false;[\s\S]*consumeDownload/, "storage probe failure must happen before quota consume");
assert.match(plugin, /guardDownloadable\(req, res, templateId, mogrtExists, idem\.key\)/);
assert.match(plugin, /guardDownloadable\(req, res, templateId, packExists, idem\.key\)/);
assert.equal((plugin.match(/if \(!downloadGate\.idempotentReplay\) \{/g) || []).length, 0, "replays must retry idempotent event/earning persistence after a crash gap");
assert.equal((plugin.match(/code:\s*"DOWNLOAD_EVENT_UNAVAILABLE"/g) || []).length, 2, "pack and MOGRT fail closed until accounting is durable");
assert.match(plugin, /reserveImport\(req\.user!\.userId, parsed\.data\.templateId, \{ requestKey:/);
assert.match(studio, /USER_VISIBLE_CREDIT_REASONS/, "internal zero-delta claims must not pollute credit activity");
assert.doesNotMatch(studio, /USER_VISIBLE_CREDIT_REASONS[^\n]*download_claim/);

const sessionDelete = studio.slice(
  studio.indexOf('studioGenRouter.delete("/gen/sessions/:id"'),
  studio.indexOf('/** GET /gen/sessions/:id/generations')
);
assert.match(sessionDelete, /isActiveSessionGeneration\(g\.status\)/);
assert.match(sessionDelete, /hasUnsettledGenerationRefund\(g\)/);
assert.match(sessionDelete, /SESSION_HAS_ACTIVE_GENERATIONS/);
assert.match(sessionDelete, /SESSION_HAS_UNSETTLED_REFUNDS/);
assert.ok(
  sessionDelete.indexOf("FOR UPDATE") < sessionDelete.indexOf("tx.genSession.delete"),
  "session row lock must cover the active check and cascade delete"
);
assert.match(sessionDelete, /if \(active\.length > 0 \|\| unsettledRefunds\.length > 0\)/, "active or unsettled sessions must stop before delete");
assert.match(sessionDelete, /await tx\.genSession\.delete/, "empty or terminal-only sessions must continue to delete");

// AiGeneration.resultKey'ni boshqa API kodi storage asset sifatida o'qimaydi; assist JSON
// legacy image/voice persistence yoki cleanupga tasodifan berilmaydi.
const apiSources = fs.readdirSync("apps/api/src/routes").filter((f) => f.endsWith(".ts"));
for (const file of apiSources) {
  if (file === "studio-gen.ts") continue;
  const source = fs.readFileSync(`apps/api/src/routes/${file}`, "utf8");
  assert.doesNotMatch(source, /aiGeneration[\s\S]{0,160}resultKey[\s\S]{0,160}(deleteS3|downloadS3|getSignedDownloadUrl)/i);
}

console.log("✓ idempotent-side-effects — assist, download, import va refund kontraktlari");
