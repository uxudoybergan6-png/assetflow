import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function makeStorage() {
  const data = Object.create(null);
  return {
    getItem(key) {
      return data[key] == null ? null : String(data[key]);
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    dump() {
      return { ...data };
    },
  };
}

function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body == null ? "" : JSON.stringify(body);
    },
    async json() {
      return body;
    },
  };
}

function createStudioHarness() {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const location = { href: "/studio/contributor/", pathname: "/studio/contributor/" };
  const fetchQueue = [];
  const fetchLog = [];

  const fetchImpl = async (url) => {
    const entry = fetchQueue.shift();
    if (typeof entry === "function") {
      const result = entry(url);
      if (result && typeof result.then === "function") {
        fetchLog.push({ url, response: "promise" });
        return result;
      }
      fetchLog.push({ url, response: result });
      return result;
    }
    if (entry instanceof Error) {
      fetchLog.push({ url, response: "error" });
      throw entry;
    }
    if (!entry) {
      throw new Error(`Unhandled fetch: ${url}`);
    }
    fetchLog.push({ url, response: entry.status });
    return entry;
  };

  const apiCalls = { set queue(list) { while (fetchQueue.length) fetchQueue.pop(); list.forEach((x) => fetchQueue.push(x)); } };

  const sandbox = {
    window: {
      ASSETFLOW_STUDIO: {
        apiUrl: "https://api.getframeflow.app",
        loginUrl: "/studio/login.html",
        base: "/studio/",
      },
      location,
      localStorage,
      sessionStorage,
      addEventListener: () => {},
      document: { addEventListener: () => {} },
    },
    localStorage,
    sessionStorage,
    location,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    crypto: { randomUUID: () => "uuid" },
    console,
    FormData: function () {},
  };

  vm.createContext(sandbox);

  const authCode = fs.readFileSync("packages/assetflow-studio/js/auth.js", "utf8");
  vm.runInContext(authCode, sandbox, { filename: "auth.js" });

  const apiCode = fs.readFileSync("packages/assetflow-studio/js/studio-api.js", "utf8");
  vm.runInContext(apiCode, sandbox, { filename: "studio-api.js" });

  return {
    window: sandbox.window,
    localStorage,
    sessionStorage,
    getSession: () => sandbox.window.AssetFlowAuth.getSession(),
    setSession: (session) => sandbox.window.AssetFlowAuth.setSession(session),
    clearSession: () => sandbox.window.AssetFlowAuth.clearSession(),
    session: () => sandbox.window.AssetFlowAuth,
    api: sandbox.window.StudioApi,
    auth: sandbox.window.AssetFlowAuth,
    setQueue: (list) => {
      apiCalls.queue = list;
    },
    getFetchLog: () => fetchLog.slice(),
  };
}

const harness = createStudioHarness();

const initialSession = {
  role: "user",
  email: "user@assetflow.uz",
  name: "User",
  userId: "u1",
  apiToken: "web-token",
  at: Date.now(),
};
harness.setSession(initialSession);

assert.equal(harness.getSession()?.apiToken, "web-token", "Web can store session in sessionStorage/localStorage layer");

// Browser restart should keep session from localStorage (12h hard expiry gate removed).
harness.sessionStorage.removeItem("af_session");
const resumed = createStudioHarness();
resumed.localStorage.setItem("af_session", JSON.stringify(initialSession));
assert.equal(
  resumed.getSession()?.apiToken,
  "web-token",
  "Local session survives reload/restart because localStorage copy is preserved"
);

// Non-auth 401/403 must not clear browser session.
resumed.setQueue([fakeResponse(401, { code: "LIMIT_REACHED", error: "locked" })]);
await assert.rejects(() => resumed.api.getProfile(), /locked/);
assert.equal(resumed.getSession()?.apiToken, "web-token", "Non-authoritative 401 keeps web session");

// Network failure must keep web session.
resumed.setQueue([new Error("network")] );
await assert.rejects(() => resumed.api.getProfile(), /Lost connection to the server/);
assert.equal(resumed.getSession()?.apiToken, "web-token", "Network failure keeps web session");

// 5xx failure must keep web session.
resumed.setQueue([fakeResponse(503, { error: "service unavailable" })]);
await assert.rejects(() => resumed.api.getProfile(), /service unavailable/);
assert.equal(resumed.getSession()?.apiToken, "web-token", "5xx keeps web session");

// Authoritative session-invalid code must clear session and expire hook.
const authExpiredHarness = createStudioHarness();
authExpiredHarness.setSession(initialSession);
authExpiredHarness.setQueue([
  fakeResponse(401, { code: "TOKEN_EXPIRED", error: "token expired" }),
]);
await assert.rejects(() => authExpiredHarness.api.getProfile(), /token expired/);
assert.equal(authExpiredHarness.getSession(), null, "Authoritative web code clears session");

// Web logout clears local session even if server request fails, and logout does not remove plugin state directly.
const logoutHarness = createStudioHarness();
logoutHarness.setSession(initialSession);
logoutHarness.setQueue([new Error("server down")]);
await logoutHarness.auth.logout(false);
assert.equal(logoutHarness.getSession(), null, "Web logout clears session locally despite server failure");

// A very old persisted browser session should still load (no client 12h gate remains).
const staleSession = {
  role: "user",
  email: "old@assetflow.uz",
  name: "Old",
  userId: "uOld",
  apiToken: "old-token",
  at: Date.now() - 100 * 24 * 60 * 60 * 1000,
};
const staleHarness = createStudioHarness();
staleHarness.localStorage.setItem("af_session", JSON.stringify(staleSession));
assert.equal(staleHarness.getSession()?.apiToken, "old-token", "Stale local session still restored when server token still valid");

console.log("Web session policy checks passed.");
