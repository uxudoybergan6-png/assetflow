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

function createSecretStore() {
  const tokens = Object.create(null);
  return {
    available() {
      return true;
    },
    get(account) {
      return tokens[account] || "";
    },
    set(value, account) {
      tokens[account] = String(value || "");
      return true;
    },
    clear(account) {
      delete tokens[account];
      return true;
    },
    dump() {
      return { ...tokens };
    },
  };
}

function makeMockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body == null ? "" : JSON.stringify(body)),
  };
}

function makeTokenMeta({ issuedOffsetMinutes = 0, expiresInMinutes = 60 * 24 * 2 } = {}) {
  const now = Date.now();
  const issuedAt = new Date(now + issuedOffsetMinutes * 60_000);
  const expiresAt = new Date(now + expiresInMinutes * 60_000);
  const refreshAt = new Date(expiresAt.getTime() - 48 * 60 * 60 * 1000);
  return {
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    refreshAt: refreshAt.toISOString(),
  };
}

function mkApiResponder(routes) {
  const routeFor = (method, pathname) => {
    const explicit = routes[`${method} ${pathname}`] || routes[pathname];
    if (explicit) return explicit;

    const cleanedPath = String(pathname || "").split("?")[0].split("#")[0];
    const normalizedPath = cleanedPath.replace(/\/+$/, "") || "/";
    const normalizedExplicit = routes[`${method} ${normalizedPath}`] || routes[normalizedPath];
    if (normalizedExplicit) return normalizedExplicit;

    return null;
  };
  return async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const method = String(options?.method || "GET").toUpperCase();
    const handler = routeFor(method, path);
    if (!handler) {
      const routeKeys = Object.keys(routes).sort();
      throw new Error(`No mock for ${method} ${path} (keys: ${routeKeys.join(", ")})`);
    }
    return handler(url, options);
  };
}

function loadAccountModule({ host = "ae", prefs, secretStore, fetchResponder }) {
  const storage = makeStorage();
  const apiCalls = [];
  const source = fs.readFileSync("plugins/after-effects-cep/assetflow-account.js", "utf8");
  const sandbox = {
    window: {
      ASSETFLOW_STUDIO: {
        apiUrl: "https://api.getframeflow.app",
      },
      AF_TEMPLATE_APP: host,
      location: { hostname: "localhost" },
      __adobe_cep__: {},
      document: {},
      open: () => null,
      localStorage: makeStorage(),
      sessionStorage: storage,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      documentElement: {},
      setTimeout,
      clearTimeout,
      clearInterval,
      setInterval,
      openInBrowser: () => {},
    },
    console,
    AssetFlowStore: {
      loadPrefs() {
        return JSON.parse(JSON.stringify(prefs));
      },
      savePrefs(next) {
        Object.assign(prefs, JSON.parse(JSON.stringify(next)));
      },
    },
    AssetFlowSecret: secretStore || createSecretStore(),
    fetch: async (...args) => {
      const response = await fetchResponder(...args);
      apiCalls.push({ args, response });
      return response;
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "assetflow-account.js" });

  return {
    account: sandbox.window.AssetFlowAccount,
    secret: sandbox.AssetFlowSecret,
    prefs,
    storage,
    apiCalls,
    lastCall(method, path) {
      return apiCalls.find((entry) => {
        const reqPath = String(entry.args[0]).replace(/^https?:\/\/[^/]+/, "");
        const reqMethod = String((entry.args[1]?.method || "GET").toUpperCase());
        return reqMethod === method && reqPath === path;
      });
    },
    setHost(nextHost) {
      sandbox.window.AF_TEMPLATE_APP = nextHost;
    },
    flush() {
      while (apiCalls.length) apiCalls.pop();
    },
  };
}

// 1) AE login is shared to Premiere immediately.
const sharedPrefs = { client: {} };
const sharedSecret = createSecretStore();
const aeLogin = loadAccountModule({
  host: "ae",
  prefs: sharedPrefs,
  secretStore: sharedSecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/login": () =>
      makeMockResponse(200, {
        token: "ae-token",
        pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
      }),
    "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
  }),
});
await aeLogin.account.login("user@assetflow.uz", "secret");
const prView = loadAccountModule({
  host: "pr",
  prefs: sharedPrefs,
  secretStore: sharedSecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/login": () =>
      makeMockResponse(200, {
        token: "ae-token",
        pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
      }),
    "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
  }),
});
assert.equal(prView.account.token(), "ae-token", "AE login is readable in Premiere on same installation");

// 2) Premiere login is immediately readable in AE.
await prView.account.login("user@assetflow.uz", "secret");
assert.equal(await prView.account.token(), "ae-token", "Premiere login replaced shared session before AE read");
const aeView = loadAccountModule({
  host: "ae",
  prefs: sharedPrefs,
  secretStore: sharedSecret,
  fetchResponder: mkApiResponder({
    "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
  }),
});
const aeSeen = aeView.account.token();
assert.equal(aeSeen, prView.account.token(), "Premiere-auth session persists as shared value");

// 3) Restart/reload preserves desktop session.
const reloadHarness = loadAccountModule({
  host: "pr",
  prefs: sharedPrefs,
  secretStore: sharedSecret,
  fetchResponder: mkApiResponder({ "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }) }),
});
assert.equal(reloadHarness.account.token(), aeSeen, "Restart/reload keeps shared secure token");

// 4) Migration deterministic from legacy keys: AE+PR scoped + common token.
const migrationPrefs = {
  client: {
    token: "legacy-prefs-token",
    pluginToken: makeTokenMeta({ issuedOffsetMinutes: -120, expiresInMinutes: 15 }),
  },
};
const migrationSecret = createSecretStore();
migrationSecret.set("legacy-shared-token", "legacy-shared");
migrationSecret.set("legacy-ae-token", "session-token-ae");
migrationSecret.set("legacy-pr-token", "session-token-pr");
const migrationRoutes = mkApiResponder({
  "GET /api/plugin/validate": ({}, options) => {
    const auth = String(options?.headers?.Authorization || "");
    const token = auth.replace(/^Bearer\s+/, "");
    if (token === "legacy-shared-token") return makeMockResponse(401, { code: "TOKEN_INVALID", error: "invalid" });
    if (token === "legacy-ae-token") return makeMockResponse(200, { token, pluginToken: makeTokenMeta({ issuedOffsetMinutes: -40, expiresInMinutes: 10 }) });
    if (token === "legacy-pr-token") return makeMockResponse(200, { token, pluginToken: makeTokenMeta({ issuedOffsetMinutes: -10, expiresInMinutes: 10 }) });
    if (token === "legacy-prefs-token") return makeMockResponse(200, { token, pluginToken: makeTokenMeta({ issuedOffsetMinutes: -90, expiresInMinutes: 10 }) });
    return makeMockResponse(401, { code: "NO_TOKEN" });
  },
  "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
});
const migrationEnv = loadAccountModule({
  host: "ae",
  prefs: migrationPrefs,
  secretStore: migrationSecret,
  fetchResponder: migrationRoutes,
});
await migrationEnv.account.fetchMe();
const migratedToken = migrationEnv.account.token();
assert.equal(migratedToken, "legacy-pr-token", "Migration chooses latest valid scoped token deterministically");
const migrationStore = migrationEnv.secret.dump();
assert.equal(!!migrationStore["session-token-ae"], false, "AE-scoped legacy token is cleaned after persistence");
assert.equal(!!migrationStore["session-token-pr"], false, "PR-scoped legacy token is cleaned after persistence");
assert.equal(!!migrationStore["legacy-shared"], true, "Unknown old keys are untouched because migration is scoped to known candidates");

// 4b) Migration network failure keeps legacy tokens until successful validation.
const migrationNetFailurePrefs = {
  client: {
    token: "legacy-prefs-token",
    pluginToken: makeTokenMeta({ issuedOffsetMinutes: -30, expiresInMinutes: 15 }),
  },
};
const migrationNetFailureSecret = createSecretStore();
migrationNetFailureSecret.set("legacy-ae-token", "session-token-ae");
const migrationNetFailureRoutes = mkApiResponder({
  "GET /api/plugin/validate": () => {
    const e = new Error("network timeout");
    e.timeout = true;
    throw e;
  },
  "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
});
const migrationNetFailureEnv = loadAccountModule({
  host: "ae",
  prefs: migrationNetFailurePrefs,
  secretStore: migrationNetFailureSecret,
  fetchResponder: migrationNetFailureRoutes,
});
await migrationNetFailureEnv.account.fetchMe();
const migrationNetFailureStore = migrationNetFailureEnv.secret.dump();
assert.equal(!!migrationNetFailureStore["session-token-ae"], true, "Legacy AE token survives when migration validation fails on network");

// 4c) Shared token cleanup occurs only after shared write/read-back succeeds.
const migrationWriteReadFailureSecret = {
  _tokens: { "session-token-ae": "legacy-ae-token", "session-token-pr": "legacy-pr-token" },
  available() {
    return true;
  },
  get(account) {
    if (account === "session-token") return "";
    return this._tokens[account] || "";
  },
  set(value, account) {
    this._tokens[account] = String(value || "");
    return true;
  },
  clear(account) {
    delete this._tokens[account];
    return true;
  },
  dump() {
    return { ...this._tokens };
  },
};
const migrationWriteReadFailureEnv = loadAccountModule({
  host: "ae",
  prefs: migrationPrefs,
  secretStore: migrationWriteReadFailureSecret,
  fetchResponder: migrationRoutes,
});
await migrationWriteReadFailureEnv.account.fetchMe();
const migrationWriteReadFailureDump = migrationWriteReadFailureEnv.secret.dump();
assert.equal(
  !!migrationWriteReadFailureDump["session-token-ae"],
  true,
  "Legacy AE token survives when shared write/readback fails"
);
assert.equal(
  !!migrationWriteReadFailureDump["session-token-pr"],
  true,
  "Legacy PR token survives when shared write/readback fails"
);

// 5) Two different installations coexist.
const installAPrefs = { client: {} };
const installASecret = createSecretStore();
const installBPrefs = { client: {} };
const installBSecret = createSecretStore();
const installationA = loadAccountModule({
  host: "ae",
  prefs: installAPrefs,
  secretStore: installASecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/login": () =>
      makeMockResponse(200, {
        token: "install-a-token",
        pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
      }),
    "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
  }),
});
const installationB = loadAccountModule({
  host: "ae",
  prefs: installBPrefs,
  secretStore: installBSecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/login": () =>
      makeMockResponse(200, {
        token: "install-b-token",
        pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
      }),
    "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" } }),
  }),
});
await installationA.account.login("user@assetflow.uz", "x");
await installationB.account.login("user@assetflow.uz", "x");
assert.equal(installationA.account.token(), "install-a-token", "Installation A keeps its own secure token");
assert.equal(installationB.account.token(), "install-b-token", "Installation B keeps its own secure token");

// 6) Login on one installation does not revoke another.
await installationB.account.fetchMe();
assert.equal(installationA.account.token(), "install-a-token", "Installation A unaffected by Installation B login");

// 7) Logout on one shared desktop installation does not revoke other installation.
await installationA.account.logout();
assert.equal(installationA.account.token(), "", "Installation A logout removes its local session");
assert.equal(installationB.account.token(), "install-b-token", "Installation B retains local session after A logout");

// 8) Renewal happens before expiry for same session.
const nearExpiryToken = "near-expiry-token";
const nearExpiryPrefs = {
  client: {
    token: nearExpiryToken,
    pluginToken: {
      issuedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      refreshAt: new Date(Date.now() - 1000).toISOString(),
    },
  },
};
const nearExpirySecret = createSecretStore();
nearExpirySecret.set(nearExpiryToken, "session-token");
const renewalCallOrder = [];
const nearExpiryEnv = loadAccountModule({
  host: "ae",
  prefs: nearExpiryPrefs,
  secretStore: nearExpirySecret,
  fetchResponder: async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const method = String(options?.method || "GET").toUpperCase();
    renewalCallOrder.push(`${method} ${path}`);
    if (path === "/api/plugin/token") {
      return makeMockResponse(200, {
        token: "renewed-token",
        pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
      });
    }
    if (path === "/api/plugin/me") {
      return makeMockResponse(200, { user: { id: "u1" }, pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 }) });
    }
    return makeMockResponse(500, {});
  },
});
await nearExpiryEnv.account.fetchMe();
assert.equal(nearExpiryEnv.account.token(), "renewed-token", "Token renewal occurs before expiry and updates active token");
const renewalCallIndex = renewalCallOrder.findIndex((item) => item === "POST /api/plugin/token");
const meCallIndex = renewalCallOrder.findIndex((item) => item === "GET /api/plugin/me");
assert.equal(renewalCallIndex >= 0, true, "Token renewal endpoint is attempted for near-expiry session");
assert.equal(
  meCallIndex > renewalCallIndex,
  true,
  "Renewal call happens before normal API call"
);

// 9) Failed renewal keeps still-valid token.
const failRenewPrefs = {
  client: {
    token: "fresh-token",
    pluginToken: {
      issuedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      refreshAt: new Date(Date.now() - 5000).toISOString(),
    },
  },
};
const failRenewSecret = createSecretStore();
failRenewSecret.set("fresh-token", "session-token");
const failRenewEnv = loadAccountModule({
  host: "ae",
  prefs: failRenewPrefs,
  secretStore: failRenewSecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/token": () => {
      const err = new Error("gateway timeout");
      err.status = 503;
      throw err;
    },
    "GET /api/plugin/me": () =>
      makeMockResponse(200, {
        user: { id: "u1" },
        pluginToken: makeTokenMeta({ expiresInMinutes: 15 * 24 }),
      }),
  }),
});
await failRenewEnv.account.fetchMe();
assert.equal(failRenewEnv.account.token(), "fresh-token", "Failed renewal does not replace still-valid token");

// 10) Expired credentials are cleared and return to sign-in.
const expiredEnv = loadAccountModule({
  host: "ae",
  prefs: { client: { token: "expired-token" } },
  secretStore: createSecretStore(),
  fetchResponder: mkApiResponder({ "GET /api/plugin/me": () => makeMockResponse(401, { code: "TOKEN_EXPIRED", error: "expired" }) }),
});
expiredEnv.secret.set("expired-token", "session-token");
const expiredSession = await expiredEnv.account.fetchMe();
assert.equal(expiredSession, null, "Expired token maps to signed-out flow");
assert.equal(expiredEnv.account.token(), "", "Expired token is cleared");

// 11) Network/429/5xx in fetchMe keeps credentials.
const netHarness = loadAccountModule({
  host: "ae",
  prefs: { client: { token: "stable-token" } },
  secretStore: (() => {
    const s = createSecretStore();
    s.set("stable-token", "session-token");
    return s;
  })(),
  fetchResponder: mkApiResponder({
    "GET /api/plugin/me": () => {
      const e = new Error("network");
      e.timeout = true;
      throw e;
    },
  }),
});
await assert.rejects(() => netHarness.account.fetchMe(), /network/);
assert.equal(netHarness.account.token(), "stable-token", "Network failures keep browser plugin token");

const tooMany = loadAccountModule({
  host: "ae",
  prefs: { client: { token: "stable-token" } },
  secretStore: (() => {
    const s = createSecretStore();
    s.set("stable-token", "session-token");
    return s;
  })(),
  fetchResponder: mkApiResponder({ "GET /api/plugin/me": () => makeMockResponse(429, { error: "rate limited" }) }),
});
await assert.rejects(() => tooMany.account.fetchMe(), /rate limited/);
assert.equal(tooMany.account.token(), "stable-token", "HTTP 429 does not clear valid token");

const serviceDown = loadAccountModule({
  host: "ae",
  prefs: { client: { token: "stable-token" } },
  secretStore: (() => {
    const s = createSecretStore();
    s.set("stable-token", "session-token");
    return s;
  })(),
  fetchResponder: mkApiResponder({ "GET /api/plugin/me": () => makeMockResponse(503, { error: "service unavailable" }) }),
});
await assert.rejects(() => serviceDown.account.fetchMe(), /service unavailable/);
assert.equal(serviceDown.account.token(), "stable-token", "HTTP 503 does not clear valid token");

// 12) Renewing one installation does not affect sibling session.
const siblingASecret = createSecretStore();
const siblingBSecret = createSecretStore();
siblingASecret.set("a-token-old", "session-token");
siblingBSecret.set("b-token", "session-token");
const siblingA = loadAccountModule({
  host: "ae",
  prefs: { client: { token: "a-token-old", pluginToken: {
    issuedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    refreshAt: new Date(Date.now() - 1000).toISOString(),
  } } },
  secretStore: siblingASecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/token": () => makeMockResponse(200, {
      token: "a-token-new",
      pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
    }),
    "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" }, pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }) }),
  }),
});
const siblingB = loadAccountModule({
  host: "pr",
  prefs: { token: "b-token", pluginToken: {
    issuedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    refreshAt: new Date(Date.now() - 1000).toISOString(),
  } },
  secretStore: siblingBSecret,
  fetchResponder: mkApiResponder({ "GET /api/plugin/me": () => makeMockResponse(200, { user: { id: "u1" }, pluginToken: makeTokenMeta({ expiresInMinutes: 10 * 24 }) }) }),
});
await siblingA.account.fetchMe();
assert.equal(siblingA.account.token(), "a-token-new", "S1 token renews when close to expiry");
assert.equal(siblingB.account.token(), "b-token", "S2 token is untouched by sibling renewal");

// 13) Google device flow keeps poll secret out of URL, uses POST, persists the
// shared token, and can cancel a pending request without touching sibling auth.
const deviceSecret = createSecretStore();
const deviceRequest = "a".repeat(48);
const devicePollToken = "b".repeat(64);
let pollBody = null;
let cancelBody = null;
const deviceHarness = loadAccountModule({
  host: "ae",
  prefs: { client: {} },
  secretStore: deviceSecret,
  fetchResponder: mkApiResponder({
    "POST /api/plugin/device/start": () => makeMockResponse(200, {
      requestId: deviceRequest,
      pollToken: devicePollToken,
      verificationUrl: "https://getframeflow.app/device.html",
      verificationUrlComplete: `https://getframeflow.app/device.html?request=${deviceRequest}&state=${"c".repeat(64)}`,
      expiresIn: 300,
    }),
    "POST /api/plugin/device/poll": (_url, options) => {
      pollBody = JSON.parse(options.body);
      return makeMockResponse(200, {
        status: "confirmed",
        token: "google-plugin-token",
        pluginToken: makeTokenMeta({ expiresInMinutes: 60 * 24 * 30 }),
        user: { id: "google-user", email: "google@example.com" },
      });
    },
    "POST /api/plugin/device/cancel": (_url, options) => {
      cancelBody = JSON.parse(options.body);
      return makeMockResponse(200, { ok: true });
    },
  }),
});
const startedDevice = await deviceHarness.account.startDeviceLogin();
assert.equal(startedDevice.verificationUrlComplete.includes(devicePollToken), false, "poll secret never enters browser URL");
await new Promise((resolve, reject) => {
  deviceHarness.account.pollDeviceLogin(startedDevice, {
    intervalMs: 5,
    onConfirmed: resolve,
    onError: reject,
  });
});
assert.deepEqual(pollBody, { requestId: deviceRequest, pollToken: devicePollToken }, "device status uses bound POST body");
assert.equal(deviceHarness.account.token(), "google-plugin-token", "Google confirmation persists shared CEP token");

await deviceHarness.account.startDeviceLogin();
deviceHarness.account.stopDevicePolling(true);
await new Promise((resolve) => setTimeout(resolve, 5));
assert.deepEqual(cancelBody, { requestId: deviceRequest, pollToken: devicePollToken }, "cancel revokes only the pending device request");

console.log("✓ FrameFlow session persistence behavior checks passed.");
