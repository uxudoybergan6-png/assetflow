import assert from "node:assert/strict";
import fs from "node:fs";

const device = fs.readFileSync("packages/assetflow-studio/device.html", "utf8");
const plugin = fs.readFileSync("plugins/after-effects-cep/AssetFlow_Plugin.html", "utf8");
const account = fs.readFileSync("plugins/after-effects-cep/assetflow-account.js", "utf8");

assert.match(device, /queryParams\.get\("request"\)[\s\S]*fragmentParams\.get\("request"\)/, "browser prefers reliable query handoff and keeps legacy fragment fallback");
assert.match(device, /FFAPI\?\.getUser/, "existing web account is detected");
assert.match(device, /\/api\/plugin\/device\/confirm-session/, "existing web account confirms exact device request");
assert.match(device, /Continue with this account/, "account substitution requires explicit confirmation");
assert.match(device, /Having trouble\?/, "manual fallback is hidden under troubleshooting");
assert.match(device, /\/api\/plugin\/device\/confirm-password/, "email/password fallback remains available");
assert.match(device, /You're signed in\.[\s\S]*Return to After Effects or Premiere Pro/, "success handoff names both Adobe hosts");

const guestStart = plugin.indexOf('<div class="gu-ctas">');
const guestEnd = plugin.indexOf('</div>', guestStart);
const guestCtas = plugin.slice(guestStart, guestEnd);
assert.ok(guestCtas.indexOf("Continue with Google") < guestCtas.indexOf("Use email instead"), "Google is primary guest CTA");
assert.match(plugin, /Opening browser…|Opening browser/, "opening status is visible");
assert.match(plugin, /Waiting for confirmation…|Waiting for confirmation/, "waiting status is visible");
assert.match(plugin, /Request expired/, "expiry status is visible");
assert.match(plugin, /Sign-in denied/, "denied status is visible");
assert.match(plugin, /Could not open browser/, "browser failure status is visible");
assert.match(plugin, />Try again<|Try again/, "retry control is visible");
assert.match(plugin, />Cancel<|Cancel/, "cancel control is visible");
assert.match(account, /POST"[\s\S]*\/api\/plugin\/device\/poll|\/api\/plugin\/device\/poll[\s\S]*method:\s*"POST"/, "CEP polls with POST");

console.log("✓ Shared AE/Premiere Google sign-in UI checks passed.");
