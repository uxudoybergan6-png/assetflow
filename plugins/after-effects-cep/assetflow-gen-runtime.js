/**
 * FrameFlow Studio Gen client-side availability/retry/settlement contract.
 *
 * This file is shared verbatim by AE CEP and the generated Premiere UXP panel.
 * It deliberately contains no DOM or host APIs so the safety-critical state
 * transitions can be regression-tested in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrameFlowGenRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var MODES = ["image", "video", "voice", "sfx"];
  var PERMANENT_CODES = {
    AI_NOT_CONFIGURED: 1,
    MODERATION_NOT_CONFIGURED: 1,
    PROVIDER_NOT_CONFIGURED: 1,
    PROVIDER_UNDECLARED: 1,
    MODEL_DISABLED: 1,
    MODEL_UNAVAILABLE: 1,
    S3_NOT_CONFIGURED: 1,
    GEN_KILL_SWITCH: 1,
    SPEND_CEILING_REACHED: 1,
    BLOCKED_ATTEMPTS_CAP: 1,
    DAILY_CAP_REACHED: 1,
    GEN_DAILY_CAP_REACHED: 1,
    STORAGE_QUOTA_EXCEEDED: 1,
    VOICE_TEXT_TOO_LONG: 1,
    PARAM_INVALID: 1,
    PAYLOAD_TOO_LARGE: 1,
    BAD_QUOTE: 1,
    PRICE_CHANGED: 1,
    PREFLIGHT_BLOCKED: 1,
    MODERATION_BLOCKED: 1,
    VIDEO_CLIP_REQUIRED: 1,
    VIDEO_REF_STILL_TOO_LARGE: 1,
    TOO_MANY_ACTIVE_GENERATIONS: 1,
  };

  var state = {
    authenticated: false,
    health: { known: false, ready: false, checking: false, code: "", reason: "", checkedAt: 0 },
    modes: {},
  };
  var listeners = [];
  var healthPromise = null;
  var authEpoch = 0;

  MODES.forEach(function (mode) {
    state.modes[mode] = { known: false, ready: false, code: "", reason: "", catalogVersion: "" };
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function emit() {
    var snapshot = getState();
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot); } catch (_) { /* UI listener isolation */ }
    });
  }

  function firstUnavailable(payload) {
    var rows = payload && Array.isArray(payload.unavailableModels) ? payload.unavailableModels : [];
    return rows[0] || null;
  }

  function unavailableCopy(code, fallback) {
    if (code === "MODERATION_NOT_CONFIGURED") return "AI generation is temporarily unavailable — safety verification needs administrator attention";
    if (code === "MODERATION_UNAVAILABLE") return "AI safety verification is temporarily unavailable — retry shortly";
    if (code === "AI_NOT_CONFIGURED" || code === "PROVIDER_NOT_CONFIGURED" || code === "PROVIDER_UNDECLARED") return "AI generation is temporarily unavailable — contact an administrator";
    if (code === "MODEL_DISABLED" || code === "MODEL_UNAVAILABLE") return "No enabled model is currently available for this mode";
    if (code === "S3_NOT_CONFIGURED") return "AI storage is temporarily unavailable — contact an administrator";
    if (code === "GEN_KILL_SWITCH") return "AI generation is temporarily paused — try again later";
    if (code === "SPEND_CEILING_REACHED") return "The service-wide generation limit has been reached — try again later";
    return fallback || "AI generation is temporarily unavailable";
  }

  function healthCode(payload) {
    payload = payload || {};
    // Storage is required for every successful generation and is more specific
    // than the aggregate generationReady flag.
    if (payload.storageReady === false) return "S3_NOT_CONFIGURED";
    if (payload.moderationReady === false) {
      // A configured moderation provider can still have a transient probe
      // outage. Do not tell users/admins that it was never configured.
      return payload.moderationConfigured === true ? "MODERATION_UNAVAILABLE" : "MODERATION_NOT_CONFIGURED";
    }
    return payload.generationReady === true ? "" : "AI_NOT_CONFIGURED";
  }

  function setAuthenticated(value) {
    var next = !!value;
    if (state.authenticated === next) return getState();
    authEpoch += 1;
    state.authenticated = next;
    MODES.forEach(function (mode) {
      state.modes[mode] = { known: false, ready: false, code: "", reason: "", catalogVersion: "" };
    });
    // Detach an old account's request. Its closure checks authEpoch before it
    // can publish, so a late response cannot revive stale readiness.
    healthPromise = null;
    if (!next) {
      state.health = { known: true, ready: false, checking: false, code: "AUTH_REQUIRED", reason: "Sign in to generate", checkedAt: Date.now() };
    } else {
      state.health = { known: false, ready: false, checking: false, code: "", reason: "Checking AI availability…", checkedAt: 0 };
    }
    emit();
    return getState();
  }

  function updateHealth(payload) {
    if (!state.authenticated) return getState();
    payload = payload || {};
    var code = healthCode(payload);
    state.health = {
      known: true,
      ready: !code,
      checking: false,
      code: code,
      reason: unavailableCopy(code, payload.error || ""),
      checkedAt: Date.now(),
      catalogVersion: String(payload.catalogVersion || ""),
    };
    emit();
    return getState();
  }

  function failHealth(error) {
    if (!state.authenticated) return getState();
    var code = String((error && error.code) || "HEALTH_UNAVAILABLE");
    state.health = {
      known: true,
      ready: false,
      checking: false,
      code: code,
      reason: unavailableCopy(code, (error && error.message) || "Couldn’t verify AI availability — check your connection"),
      checkedAt: Date.now(),
    };
    emit();
    return getState();
  }

  function refreshHealth(fetchHealth, options) {
    options = options || {};
    if (!state.authenticated) return Promise.resolve(getState());
    if (healthPromise) return healthPromise;
    var maxAge = Number(options.maxAgeMs);
    if (!isFinite(maxAge)) maxAge = 30000;
    if (!options.force && state.health.checkedAt && Date.now() - state.health.checkedAt < maxAge) {
      return Promise.resolve(getState());
    }
    if (typeof fetchHealth !== "function") return Promise.resolve(failHealth(new Error("AI health check is unavailable")));
    state.health.checking = true;
    emit();
    var epoch = authEpoch;
    var request = Promise.resolve().then(fetchHealth).then(function (payload) {
      if (!state.authenticated || epoch !== authEpoch) return getState();
      return updateHealth(payload);
    }, function (error) {
      if (!state.authenticated || epoch !== authEpoch) return getState();
      failHealth(error); throw error;
    });
    healthPromise = request;
    request.then(function () { if (healthPromise === request) healthPromise = null; }, function () { if (healthPromise === request) healthPromise = null; });
    return request;
  }

  function applyModelCatalog(mode, payload) {
    if (MODES.indexOf(mode) < 0) return [];
    if (!state.authenticated) {
      state.modes[mode] = { known: true, ready: false, code: "AUTH_REQUIRED", reason: "Sign in to generate", catalogVersion: "" };
      emit();
      return [];
    }
    payload = payload || {};
    var rows = (Array.isArray(payload.models) ? payload.models : []).filter(function (model) {
      return model && model.id != null && model.mode === mode && model.enabled !== false && model.disabled !== true && model.available !== false;
    });
    var unavailable = firstUnavailable(payload);
    var explicitReady = payload.configured !== false && payload.moderationReady !== false && payload.generationReady !== false;
    var ready = explicitReady && rows.length > 0;
    var platformCode = healthCode(payload);
    var code = ready ? "" : String((unavailable && unavailable.unavailableCode) || platformCode || "MODEL_UNAVAILABLE");
    var reason = ready ? "" : unavailableCopy(code, (unavailable && unavailable.unavailableReason) || payload.error || "");
    state.modes[mode] = {
      known: true,
      ready: ready,
      code: code,
      reason: reason,
      catalogVersion: String(payload.catalogVersion || ""),
    };
    emit();
    return ready ? rows : [];
  }

  function canGenerate(mode) {
    var entry = state.modes[mode];
    return !!(state.authenticated && state.health.ready && entry && entry.ready);
  }

  function reason(mode) {
    if (!state.authenticated) return "Sign in to generate";
    if (!state.health.known || state.health.checking) return "Checking AI availability…";
    if (!state.health.ready) return state.health.reason || unavailableCopy(state.health.code);
    var entry = state.modes[mode];
    if (!entry || !entry.known) return "Loading the live model catalog…";
    if (!entry.ready) return entry.reason || unavailableCopy(entry.code);
    return "";
  }

  function isPermanentError(status, code) {
    code = String(code || "");
    if (PERMANENT_CODES[code]) return true;
    status = Number(status) || 0;
    return status >= 400 && status < 500 && status !== 408 && status !== 425 && status !== 429;
  }

  // Cached credits returned by POST /gen already include every submitted job.
  // Only jobs still waiting for that server response need a temporary local
  // reservation; subtracting submitted jobs again blocks valid parallel work.
  function pendingUnreservedCost(jobs) {
    return (Array.isArray(jobs) ? jobs : []).reduce(function (sum, job) {
      if (!job || job.submitted) return sum;
      var cost = Number(job.jcost);
      return sum + (isFinite(cost) && cost > 0 ? cost : 0);
    }, 0);
  }

  function availableCredits(balance, jobs) {
    var value = Number(balance);
    if (!isFinite(value)) return null;
    return value - pendingUnreservedCost(jobs);
  }

  // Concurrent charge requests may return out of order (for example 70, then
  // a stale 90). Charge acknowledgements may only lower the cached balance.
  // Refund/cancel and explicit refresh deliberately use syncSettledCredits and
  // remain authoritative, so they can raise it again.
  function mergeChargedCredits(current, payload) {
    var incoming = payload && Number(payload.creditsLeft);
    if (!isFinite(incoming)) return null;
    var cached = Number(current);
    return isFinite(cached) ? Math.min(cached, incoming) : incoming;
  }

  function syncSettledCredits(payload, syncCredits, refreshCredits) {
    // A cancel/refund response can cross a newer charge response in flight.
    // Its embedded creditsLeft is therefore not an ordering proof. Whenever
    // possible, read the ledger after settlement and apply that value.
    if (typeof refreshCredits === "function") {
      return Promise.resolve(refreshCredits({ force: true })).then(function (result) {
        var current = result && Number(result.aiCredits);
        // refreshCredits owns ordering and applies its response with the
        // sequence captured when the read began. Applying the returned value
        // again without that sequence would resurrect an ignored stale read
        // over a newer charge acknowledgement.
        return isFinite(current) ? current : null;
      });
    }
    var left = payload && Number(payload.creditsLeft);
    if (isFinite(left) && typeof syncCredits === "function") {
      syncCredits(left);
      return Promise.resolve(left);
    }
    return Promise.resolve(null);
  }

  function createMutationBarrier() {
    var pending = 0;
    var waiters = [];
    function begin() {
      pending += 1;
      var ended = false;
      return function end() {
        if (ended) return;
        ended = true;
        pending = Math.max(0, pending - 1);
        if (!pending) {
          var ready = waiters.slice();
          waiters = [];
          ready.forEach(function (resolve) { resolve(); });
        }
      };
    }
    function wait() {
      if (!pending) return Promise.resolve();
      return new Promise(function (resolve) { waiters.push(resolve); });
    }
    return { begin: begin, wait: wait, pending: function () { return pending; } };
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (item) { return item !== fn; }); };
  }

  function getState() { return clone(state); }

  function reset() {
    authEpoch += 1;
    state.authenticated = false;
    state.health = { known: false, ready: false, checking: false, code: "", reason: "", checkedAt: 0 };
    MODES.forEach(function (mode) {
      state.modes[mode] = { known: false, ready: false, code: "", reason: "", catalogVersion: "" };
    });
    healthPromise = null;
    emit();
  }

  return {
    MODES: MODES.slice(),
    setAuthenticated: setAuthenticated,
    updateHealth: updateHealth,
    failHealth: failHealth,
    refreshHealth: refreshHealth,
    applyModelCatalog: applyModelCatalog,
    canGenerate: canGenerate,
    reason: reason,
    unavailableCopy: unavailableCopy,
    healthCode: healthCode,
    isPermanentError: isPermanentError,
    pendingUnreservedCost: pendingUnreservedCost,
    availableCredits: availableCredits,
    mergeChargedCredits: mergeChargedCredits,
    syncSettledCredits: syncSettledCredits,
    createMutationBarrier: createMutationBarrier,
    subscribe: subscribe,
    getState: getState,
    reset: reset,
  };
});
