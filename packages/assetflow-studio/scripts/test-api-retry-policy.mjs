import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("packages/assetflow-studio/platform/ff-api.js", "utf8");
let calls = 0;
const storage = new Map();
const window = {
  location: { hostname: "getframeflow.app" },
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
  fetch: async () => {
    calls++;
    return new Response(JSON.stringify({
      error: "AI safety verification is temporarily unavailable",
      code: "MODERATION_NOT_CONFIGURED",
    }), { status: 503, headers: { "content-type": "application/json" } });
  },
  Response,
  AbortController,
  URLSearchParams,
  CustomEvent: class CustomEvent {},
  FormData,
  setTimeout,
  clearTimeout,
  console,
});

vm.runInContext(source, context, { filename: "ff-api.js" });
await assert.rejects(
  window.FFAPI.req("/api/studio/gen", {
    method: "POST",
    body: { prompt: "safe test" },
    idempotencyKey: "test-idempotency-key",
  }),
  (error) => error?.status === 503 && error?.code === "MODERATION_NOT_CONFIGURED"
);
assert.equal(calls, 1, "permanent configuration 503 must not be retried");

console.log("Web API permanent-response retry policy passed.");
