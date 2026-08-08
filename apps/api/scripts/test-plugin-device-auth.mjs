import assert from "node:assert/strict";
import fs from "node:fs";
import {
  claimDeviceLogin,
  createDeviceAuthChallenge,
  deviceRequestCanIssueCredentials,
  isDeviceRequestExpired,
  validBrowserDeviceRequest,
  validDevicePollRequest,
} from "../dist/routes/plugin.js";

const first = createDeviceAuthChallenge("https://getframeflow.app");
const second = createDeviceAuthChallenge("https://getframeflow.app/");

assert.match(first.requestId, /^[0-9a-f]{48}$/, "request nonce is 192-bit hex");
assert.match(first.state, /^[0-9a-f]{64}$/, "browser state is signed");
assert.match(first.pollToken, /^[0-9a-f]{64}$/, "plugin poll proof is signed");
assert.notEqual(first.requestId, second.requestId, "requests are unique");
assert.equal(first.verificationUrlComplete.includes("?request="), true, "one-time identifier survives the CEP-to-browser handoff");
assert.equal(first.verificationUrlComplete.includes(first.pollToken), false, "browser URL never contains poll secret");
assert.equal(/access_token|refresh_token|pluginToken/i.test(first.verificationUrlComplete), false, "browser URL contains no session token");

assert.equal(validBrowserDeviceRequest(first.requestId, first.state), true, "matching browser state is accepted");
assert.equal(validBrowserDeviceRequest(first.requestId, "0".repeat(64)), false, "state mismatch is rejected");
assert.equal(validBrowserDeviceRequest("short", undefined), false, "low-entropy manual code is rejected");
assert.equal(validBrowserDeviceRequest(first.requestId, undefined), true, "high-entropy manual fallback is accepted");
assert.equal(validDevicePollRequest(first.requestId, first.pollToken), true, "bound plugin poll is accepted");
assert.equal(validDevicePollRequest(first.requestId, second.pollToken), false, "cross-request polling is rejected");

assert.equal(isDeviceRequestExpired(new Date(Date.now() - 1)), true, "expired request is rejected");
assert.equal(isDeviceRequestExpired(new Date(Date.now() + 60_000)), false, "live request remains usable");
const liveExpiry = new Date(Date.now() + 60_000);
const deadExpiry = new Date(Date.now() - 1);
assert.equal(deviceRequestCanIssueCredentials("confirmed", liveExpiry), true, "live confirmed request may issue once");
assert.equal(deviceRequestCanIssueCredentials("pending", liveExpiry), false, "pending request cannot issue credentials");
assert.equal(deviceRequestCanIssueCredentials("denied", liveExpiry), false, "denied request cannot issue credentials");
assert.equal(deviceRequestCanIssueCredentials("cancelled", liveExpiry), false, "cancelled request cannot issue credentials");
assert.equal(deviceRequestCanIssueCredentials("confirmed", deadExpiry), false, "expired confirmation cannot issue credentials");

let pending = true;
const mockDb = {
  pluginDeviceCode: {
    updateMany: async () => {
      if (!pending) return { count: 0 };
      pending = false;
      return { count: 1 };
    },
  },
};
assert.equal(await claimDeviceLogin("row", "user", "token-a", mockDb), true, "first confirmation claims request");
assert.equal(await claimDeviceLogin("row", "user", "token-b", mockDb), false, "replay confirmation loses atomic claim");

const source = fs.readFileSync("apps/api/src/routes/plugin.ts", "utf8");
assert.match(source, /max:\s*6,[\s\S]*keyPrefix:\s*"plugin-device-start"/, "device starts are rate limited");
assert.match(source, /post\("\/device\/cancel"/, "pending requests have cancellation endpoint");
assert.match(source, /post\("\/device\/poll"/, "poll secrets stay in POST bodies, not query logs");

console.log("✓ Plugin Google device-auth security checks passed.");
