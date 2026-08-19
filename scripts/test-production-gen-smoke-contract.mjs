#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const readonly = fs.readFileSync("scripts/verify-gen-production-readonly.mjs", "utf8");
const canary = fs.readFileSync("scripts/verify-gen-production-canary.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/deploy-cloudrun.yml", "utf8");

for (const [name, source] of [["read-only", readonly], ["canary", canary]]) {
  assert.match(source, /finally\s*\{/s, `${name} smoke must always clean up`);
  assert.match(source, /\/api\/plugin\/logout/, `${name} smoke must revoke its temporary token`);
  for (const mode of ["image", "video", "voice", "sfx"]) {
    assert.match(source, new RegExp(`["']${mode}["']`), `${name} smoke must cover ${mode} readiness`);
  }
}

assert.match(canary, /creditsBefore\s*=\s*Number\(initialCredits\.aiCredits\)/);
assert.match(canary, /assert\.equal\(Number\(finalCredits\.aiCredits\), creditsBefore/);
assert.match(canary, /costQuoteSignature:\s*["']invalid-deployment-canary-signature["']/);
assert.match(canary, /assert\.equal\(canary\.body\.code, ["']BAD_QUOTE["']/);

const readonlyGate = workflow.indexOf('npm run verify:gen-production-readonly');
const canaryGate = workflow.indexOf('npm run verify:gen-production-canary');
const trafficPromotion = workflow.indexOf('gcloud run services update-traffic');
assert.ok(readonlyGate > 0 && canaryGate > readonlyGate, "candidate must run both Studio Gen smokes");
assert.ok(trafficPromotion > canaryGate, "traffic promotion must happen only after both smokes");
assert.match(workflow, /FRAMEFLOW_READONLY_EMAIL:\s*\$\{\{ secrets\.FRAMEFLOW_READONLY_EMAIL \}\}/);
assert.match(workflow, /FRAMEFLOW_READONLY_PASSWORD:\s*\$\{\{ secrets\.FRAMEFLOW_READONLY_PASSWORD \}\}/);

console.log("Production Studio Gen deploy-smoke contract passed.");
