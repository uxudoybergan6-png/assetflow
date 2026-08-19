import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("packages/assetflow-studio/platform/ff-api.js", "utf8");

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function loadApi(steps) {
  const calls = [];
  const storage = new Map();
  const queue = steps.slice();
  const window = {
    location: { hostname: "getframeflow.app" },
    crypto: { randomUUID: () => "generated-request-uuid" },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    dispatchEvent() {},
  };
  window.window = window;
  const context = vm.createContext({
    window,
    document: { querySelector: () => null },
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      if (typeof next === "function") return next(url, options, calls.length);
      return next || jsonResponse(200, { ok: true });
    },
    Response,
    AbortController,
    URLSearchParams,
    CustomEvent: class CustomEvent {},
    FormData,
    // Backoff'larni testda darhol o'tkazamiz; request timeout timerlarini ishga tushirmaymiz.
    setTimeout: (fn, ms) => (ms < 15000 ? globalThis.setTimeout(fn, 0) : 1),
    clearTimeout: (id) => { if (id !== 1) globalThis.clearTimeout(id); },
    console,
  });
  vm.runInContext(source, context, { filename: "ff-api.js" });
  return { api: window.FFAPI, calls };
}

// Deploy/config xatolari qayta urilmaydi: uzoq kutish va server spam yo'q.
for (const code of [
  "MODERATION_NOT_CONFIGURED",
  "AI_NOT_CONFIGURED",
  "S3_NOT_CONFIGURED",
  "GEN_KILL_SWITCH",
  "SPEND_CEILING_REACHED",
  "GOOGLE_NOT_CONFIGURED",
  "BILLING_NOT_CONFIGURED",
  "BILLING_STORE_MISSING",
]) {
  const { api, calls } = loadApi([
    jsonResponse(503, { error: "not configured", code }),
  ]);
  await assert.rejects(api.req("/api/probe"), (error) => error?.status === 503 && error?.code === code);
  assert.equal(calls.length, 1, `${code} must not be retried`);
}

// Vaqtinchalik 503 esa cold-start/deploy uchun qayta uriladi.
{
  const { api, calls } = loadApi([
    jsonResponse(503, { error: "temporary", code: "MODERATION_UNAVAILABLE" }),
    jsonResponse(200, { ok: true }),
  ]);
  assert.deepEqual(await api.req("/api/probe"), { ok: true });
  assert.equal(calls.length, 2);
}

// Yon ta'sirli auth POST'lari javob yo'qolganda avtomatik takrorlanmaydi.
for (const invoke of [
  (api) => api.register("person@example.com", "password123", "Person", "turnstile"),
  (api) => api.forgot("person@example.com"),
  (api) => api.resendVerification("person@example.com"),
]) {
  const { api, calls } = loadApi([new Error("socket closed")]);
  await assert.rejects(invoke(api), (error) => error?.message === "NETWORK");
  assert.equal(calls.length, 1, "side-effecting auth action must run once");
}

// Login takror-xavfsiz: vaqtinchalik tarmoq uzilishidan keyin qayta urinadi.
{
  const { api, calls } = loadApi([
    new Error("cold start"),
    jsonResponse(200, { token: "t", user: { id: "u" } }),
  ]);
  assert.equal((await api.login("person@example.com", "password123")).token, "t");
  assert.equal(calls.length, 2);
}

// Download quota yozadigan GET ichki retry davomida aynan bitta Idempotency-Key ishlatadi.
{
  const { api, calls } = loadApi([
    jsonResponse(503, { error: "cold start", code: "SERVICE_UNAVAILABLE" }),
    jsonResponse(200, { url: "https://cdn.example/pack.zip" }),
  ]);
  await api.packLink("tpl-1", "download-click-1");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers["Idempotency-Key"], "download-click-1");
  assert.equal(calls[1].options.headers["Idempotency-Key"], "download-click-1");
}

// Caller kalit bermasa ham packLink bitta logical call uchun UUID yaratadi.
{
  const { api, calls } = loadApi([jsonResponse(200, { url: "https://cdn.example/pack.zip" })]);
  await api.packLink("tpl-2");
  assert.equal(calls[0].options.headers["Idempotency-Key"], "generated-request-uuid");
}

// Health bitlari model keshi ustidan authoritative fail-close.
{
  const { api } = loadApi([]);
  const models = [{ moderationReady: true, generationReady: true, models: [{ id: "m1" }] }];
  assert.equal(api.assessAiReadiness({ moderationReady: false, generationReady: true, storageReady: true }, models).code, "MODERATION_NOT_CONFIGURED");
  const moderationOutage = api.assessAiReadiness({ moderationConfigured: true, moderationReady: false, generationReady: false, storageReady: true }, models);
  assert.equal(moderationOutage.code, "MODERATION_UNAVAILABLE");
  assert.equal(moderationOutage.retryable, true);
  assert.equal(api.assessAiReadiness({ moderationReady: true, generationReady: true, storageReady: false, s3: true }, models).code, "S3_NOT_CONFIGURED");
  assert.equal(api.assessAiReadiness({ moderationReady: true, generationReady: true, storageReady: true, s3: false }, models).code, "S3_NOT_CONFIGURED");
  assert.equal(api.assessAiReadiness({ moderationReady: true, generationReady: false, storageReady: true }, models).code, "AI_NOT_CONFIGURED");
  const providerOutage = api.assessAiReadiness(
    { moderationReady: true, generationReady: false, storageReady: true },
    [{ models: [], unavailableModels: [{ unavailableCode: "PROVIDER_UNAVAILABLE", unavailableReason: "provider probe timed out", retryable: true }] }],
  );
  assert.equal(providerOutage.code, "PROVIDER_UNAVAILABLE");
  assert.equal(providerOutage.retryable, true);
  assert.equal(api.assessAiReadiness({ moderationReady: true, generationReady: true, storageReady: true }, [{ models: [] }]).code, "MODELS_UNAVAILABLE");
  assert.equal(api.assessAiReadiness({ moderationReady: true, generationReady: true, storageReady: true }, models).ready, true);
}

// Account A'ning kechikkan 401'i account B tokenini tozalamasligi va javobini
// B ekraniga qaytarmasligi kerak.
{
  let resolveOld;
  const { api } = loadApi([
    () => new Promise((resolve) => { resolveOld = resolve; }),
  ]);
  api.setSession("token-a", { id: "account-a" });
  const oldRequest = api.credits();
  await Promise.resolve();
  assert.equal(typeof resolveOld, "function");
  const oldEpoch = api.sessionEpoch();
  api.setSession("token-b", { id: "account-b" });
  assert.ok(api.sessionEpoch() > oldEpoch);
  resolveOld(jsonResponse(401, { error: "expired", code: "TOKEN_EXPIRED" }));
  await assert.rejects(oldRequest, (error) => error?.code === "SESSION_CHANGED");
  assert.equal(api.getToken(), "token-b");
  assert.equal(api.getUser().id, "account-b");
}

// Charge-only response'lar teskari kelsa balans qayta ko'tarilmaydi (350 keyin eski 400).
{
  const { api } = loadApi([]);
  let balance = api.reconcileChargedBalance(500, 350, true);
  balance = api.reconcileChargedBalance(balance, 400, true);
  assert.equal(balance, 350);
  assert.equal(api.reconcileChargedBalance(0, 420, false), 420);
  assert.equal(api.reconcileChargedBalance(350, undefined, true), 350);
}

console.log("Web API retry, readiness, idempotency and balance policy passed.");
