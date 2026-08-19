#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AE = path.resolve(HERE, "..");
const UXP = path.resolve(AE, "..", "premiere-uxp");
const require = createRequire(import.meta.url);
const sourceOnly = process.argv.includes("--source-only");
const runtime = require(path.join(AE, "assetflow-gen-runtime.js"));
const workspace = require(path.join(AE, "frameflow-create-workspace.js"));

const envSource = fs.readFileSync(path.join(AE, "assetflow-env.js"), "utf8");
function loadEnv(hostname) {
  const context = { window: { location: { hostname } }, URL };
  const vm = require("node:vm");
  vm.runInNewContext(envSource, context, { filename: "assetflow-env.js" });
  return context.window.ASSETFLOW_ENV;
}
const productionEnv = loadEnv("");
assert.equal(productionEnv.sanitizeApi("http://localhost:4000"), "https://api.getframeflow.app");
assert.equal(productionEnv.sanitizeApi("https://old-or-unknown.example"), "https://api.getframeflow.app");
assert.equal(productionEnv.sanitizeApi("not a url"), "https://api.getframeflow.app");
assert.equal(loadEnv("localhost").sanitizeApi("http://localhost:4000"), "http://localhost:4000");

runtime.reset();
runtime.setAuthenticated(true);
runtime.updateHealth({ moderationReady: true, generationReady: true, catalogVersion: "a" });
let rows = runtime.applyModelCatalog("image", {
  configured: true,
  moderationReady: true,
  generationReady: true,
  models: [{ id: 1, mode: "image", enabled: true, available: true }],
});
assert.equal(rows.length, 1);
assert.equal(runtime.canGenerate("image"), true);

runtime.setAuthenticated(false);
assert.equal(runtime.canGenerate("image"), false, "logout must immediately close Generate");
assert.equal(runtime.reason("image"), "Sign in to generate");

runtime.reset();
runtime.setAuthenticated(true);
let resolveOldHealth;
const oldHealth = runtime.refreshHealth(() => new Promise((resolve) => { resolveOldHealth = resolve; }), { force: true });
// refreshHealth intentionally invokes the transport on the next microtask so
// synchronous caller errors are captured by the returned promise.
await Promise.resolve();
assert.equal(typeof resolveOldHealth, "function");
runtime.setAuthenticated(false);
runtime.setAuthenticated(true);
resolveOldHealth({ moderationReady: true, generationReady: true });
await oldHealth;
assert.equal(runtime.getState().health.ready, false, "late health from the previous auth epoch must be ignored");
assert.equal(runtime.canGenerate("image"), false, "a new login must reload its own catalog and health");

runtime.updateHealth({ moderationConfigured: false, moderationReady: false, generationReady: false });
assert.equal(runtime.canGenerate("image"), false);
assert.match(runtime.reason("image"), /safety verification/i);

runtime.updateHealth({ storageReady: true, moderationConfigured: true, moderationReady: false, generationReady: false });
assert.equal(runtime.getState().health.code, "MODERATION_UNAVAILABLE");
assert.match(runtime.reason("image"), /retry shortly/i);
runtime.updateHealth({ storageReady: false, moderationConfigured: false, moderationReady: false, generationReady: false });
assert.equal(runtime.getState().health.code, "S3_NOT_CONFIGURED", "storage failure must win over aggregate readiness");

runtime.updateHealth({ moderationReady: true, generationReady: true });
rows = runtime.applyModelCatalog("video", {
  configured: false,
  moderationReady: true,
  generationReady: false,
  // Even if a stale/old server leaks rows, explicit readiness wins fail-closed.
  models: [{ id: 2, mode: "video", enabled: true }],
  unavailableModels: [{ unavailableCode: "PROVIDER_NOT_CONFIGURED", unavailableReason: "provider missing" }],
});
assert.deepEqual(rows, []);
assert.equal(runtime.canGenerate("video"), false);
assert.match(runtime.reason("video"), /administrator/i);

for (const code of [
  "MODERATION_NOT_CONFIGURED",
  "AI_NOT_CONFIGURED",
  "PROVIDER_NOT_CONFIGURED",
  "S3_NOT_CONFIGURED",
  "GEN_KILL_SWITCH",
  "SPEND_CEILING_REACHED",
  "DAILY_CAP_REACHED",
]) assert.equal(runtime.isPermanentError(503, code), true, code + " must not retry");
assert.equal(runtime.isPermanentError(503, "MODERATION_UNAVAILABLE"), false, "temporary moderation outage may retry");
assert.equal(runtime.isPermanentError(429, "RATE_LIMITED"), false, "short rate-limit may retry");
assert.equal(runtime.isPermanentError(400, "PARAM_INVALID"), true);

assert.equal(runtime.pendingUnreservedCost([
  { jcost: 10, submitted: true },
  { jcost: 7, submitted: false },
  { jcost: 3, submitted: false },
]), 10);
assert.equal(runtime.availableCredits(90, [{ jcost: 10, submitted: true }]), 90, "server balance already includes submitted jobs");
assert.equal(runtime.availableCredits(90, [{ jcost: 10, submitted: true }, { jcost: 7, submitted: false }]), 83, "only pending jobs are locally reserved");
assert.equal(runtime.mergeChargedCredits(70, { creditsLeft: 90 }), 70, "a late charge response must not raise cached balance");
assert.equal(runtime.mergeChargedCredits(90, { creditsLeft: 70 }), 70);
assert.equal(runtime.mergeChargedCredits(70, { refunded: 5 }), null, "refunds are not charge merges");

let synced = null;
let refreshes = 0;
await runtime.syncSettledCredits({ creditsLeft: 41 }, (v) => { synced = v; });
assert.equal(synced, 41);
assert.equal(refreshes, 0);
await runtime.syncSettledCredits({ refunded: 4 }, null, () => {
  refreshes += 1;
  return Promise.resolve({ aiCredits: 45 });
});
assert.equal(refreshes, 1, "failed jobs without creditsLeft must fetch the authoritative balance");
let authoritativeBalance = 90;
await runtime.syncSettledCredits({ creditsLeft: 100, refunded: 10 }, (v) => { authoritativeBalance = v; }, () => Promise.resolve({ aiCredits: 100 }));
assert.equal(authoritativeBalance, 90, "a refresh result ignored by its sequencer must not be applied again without its source sequence");

const barrier = runtime.createMutationBarrier();
const finishCharge = barrier.begin();
let settlementReadStarted = false;
const settlementRead = barrier.wait().then(() => { settlementReadStarted = true; });
await Promise.resolve();
assert.equal(settlementReadStarted, false, "settlement must wait for older in-flight charge mutations");
finishCharge();
await settlementRead;
assert.equal(settlementReadStarted, true);

// A catalog refresh with the same model ID still invalidates the old quote and
// clamps settings to the new descriptor.
const ctl = workspace.createController({ mode: "image" });
ctl.setModels("image", [{
  id: 10, mode: "image", enabled: true, isDefault: true,
  imgSettings: { aspect: { options: ["1:1", "16:9"], def: "1:1" }, quality: { options: ["1K", "2K"], def: "1K" }, num: [1] },
}]);
ctl.setSetting("quality", "2K");
ctl.setPrompt("a valid prompt");
await ctl.requestQuote(() => Promise.resolve({ price: 8, signature: "signed-old-quote" }));
assert.equal(ctl.snapshot().validation.ok, true);
ctl.setModels("image", [{
  id: 10, mode: "image", enabled: true, isDefault: true,
  imgSettings: { aspect: { options: ["1:1"], def: "1:1" }, quality: { options: ["1K"], def: "1K" }, num: [1] },
}]);
assert.equal(ctl.snapshot().quote.status, "idle");
assert.equal(ctl.snapshot().settings.quality, "1K");
assert.equal(ctl.snapshot().validation.ok, false);

const ae = fs.readFileSync(path.join(AE, "AssetFlow_Plugin.html"), "utf8");
const accountSource = fs.readFileSync(path.join(AE, "assetflow-account.js"), "utf8");
assert.match(ae, /assetflow-gen-runtime\.js/);
assert.match(accountSource, /const requestEpoch = authSessionEpoch;\s*await ensureSessionLoaded\(\)/);
assert.match(accountSource, /refreshEpoch !== authSessionEpoch \|\| activeToken !== currentToken/);
assert.match(accountSource, /requestEpoch !== authSessionEpoch \|\| e\?\.code === "SESSION_CHANGED"/);
assert.match(accountSource, /if \(t !== token\(\)\) throw e;/);
assert.match(accountSource, /sessionEpoch,/);
assert.match(ae, /creditRefreshSessionEpoch===sessionEpoch/);
assert.match(ae, /creditRefreshAtEpoch===sessionEpoch/);
assert.match(ae, /if\(sessionEpoch!==afAuthSessionEpoch\(\)\)return null/);
assert.match(ae, /var accountChanged=logged&&__afGenRuntimeSessionEpoch>=0&&sessionEpoch!==__afGenRuntimeSessionEpoch/);
assert.match(ae, /__afGenRuntimeSessionEpoch=sessionEpoch;[\s\S]{0,180}if\(accountChanged\)FrameFlowGenRuntime\.setAuthenticated\(false\)/);
assert.match(ae, /__afGenHealthRetryAttempt>=2/);
assert.match(ae, /var delay=\[3000,8000\]\[__afGenHealthRetryAttempt\+\+\]/);
assert.match(ae, /health\.code==='MODERATION_UNAVAILABLE'\)afQueueGenerationHealthRetry\(sessionEpoch\)/);
assert.match(ae, /!snapshot\.authenticated\)\{meta\.loaded=false;meta\._pending=null;meta\.models=\[\];meta\.modelId=null;/);
assert.match(ae, /!snapshot\.authenticated\)\{vm\.loaded=false;vm\._pending=null;vm\.models=\[\];vm\.model=null;/);
assert.match(ae, /!snapshot\.authenticated\)\{ag\.loaded=false;ag\._pending=null;ag\.catalogs\.voice=\[\];ag\.catalogs\.sfx=\[\]/);
assert.match(ae, /\['image','video','voice','sfx'\]\.forEach\(function\(mode\)\{ctl\.setModels\(mode,\[\]\);\}\)/);

// Plugin account A /me javobi account B loginidan keyin qaytsa, u B tokeni yoki
// cached userini qayta yozmasligi kerak.
{
  let prefs = { client: { apiBaseUrl: "https://api.getframeflow.app" } };
  const secrets = new Map();
  let loginCount = 0;
  let resolveOldMe;
  const tokenMeta = {
    issuedAt: "2026-01-01T00:00:00.000Z",
    refreshAt: "2098-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
  const fetch = async (url) => {
    if (url.endsWith("/api/plugin/login")) {
      loginCount += 1;
      const suffix = loginCount === 1 ? "a" : "b";
      return new Response(JSON.stringify({ token: `token-${suffix}`, user: { id: `account-${suffix}`, email: `${suffix}@example.com` }, pluginToken: tokenMeta }), { status: 200 });
    }
    if (url.endsWith("/api/plugin/me")) {
      return new Promise((resolve) => { resolveOldMe = resolve; });
    }
    throw new Error(`unexpected account test request: ${url}`);
  };
  const window = { location: { hostname: "" }, dispatchEvent() {} };
  const context = {
    window,
    AssetFlowStore: { loadPrefs: () => prefs, savePrefs: (next) => { prefs = next; } },
    AssetFlowSecret: {
      available: () => true,
      get: (key) => secrets.get(key) || "",
      set: (value, key) => { secrets.set(key, String(value)); return true; },
      clear: (key) => secrets.delete(key),
    },
    fetch,
    Response,
    AbortController,
    FormData,
    CustomEvent: class CustomEvent {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    console,
  };
  require("node:vm").runInNewContext(accountSource, context, { filename: "assetflow-account.js" });
  const account = window.AssetFlowAccount;
  await account.login("a@example.com", "password");
  const oldMe = account.fetchMe();
  for (let i = 0; i < 8 && !resolveOldMe; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof resolveOldMe, "function");
  await account.login("b@example.com", "password");
  resolveOldMe(new Response(JSON.stringify({ user: { id: "account-a", email: "a@example.com" } }), { status: 200 }));
  const visible = await oldMe;
  assert.equal(visible.id, "account-b");
  assert.equal(account.getCachedUser().id, "account-b");
  assert.match(account.authHeaders().Authorization, /token-b$/);
}
const sources = [ae];
if (!sourceOnly) {
  const ported = fs.readdirSync(path.join(UXP, "ported"))
    .filter((name) => /^ae-inline-\d+\.js$/.test(name))
    .sort()
    .map((name) => fs.readFileSync(path.join(UXP, "ported", name), "utf8"))
    .join("\n");
  const panel = fs.readFileSync(path.join(UXP, "panel.html"), "utf8");
  const portedRuntime = fs.readFileSync(path.join(UXP, "ported", "ae-src", "assetflow-gen-runtime.js"), "utf8");
  assert.match(panel, /ported\/ae-src\/assetflow-gen-runtime\.js/);
  assert.equal(portedRuntime, fs.readFileSync(path.join(AE, "assetflow-gen-runtime.js"), "utf8"));
  sources.push(ported);
}
for (const source of sources) {
  assert.match(source, /FrameFlowGenRuntime\.isPermanentError/);
  assert.match(source, /getframeflow\.app\/reset-password\.html/);
  assert.match(source, /afCanGenerate\('image'\)/);
  assert.match(source, /afCanGenerate\('video'\)/);
  assert.match(source, /afCanGenerate\(ag\.mode\)/);
  assert.match(source, /if\(e&&e\.mentionMismatch\)/);
  assert.match(source, /afSettleCredits\(gn\)/);
  assert.match(source, /FrameFlowGenRuntime\.availableCredits\(cr,activeJobs\)/);
  assert.match(source, /afApplyChargeCredits\(res\)/);
  assert.match(source, /version!==meta\.catalogVersion/);
  assert.match(source, /version!==vm\.catalogVersion/);
  assert.match(source, /selected image model is no longer available/);
  assert.match(source, /selected video model is no longer available/);
  assert.doesNotMatch(source, /reduce\(function\(a,j\)\{ return a\+\(j\.jcost\|\|0\); \},0\)/);
}

console.log("✓ Studio Gen plugin runtime: readiness + retry + refund" + (sourceOnly ? " source checks" : " + AE/UXP parity") + " passed");
