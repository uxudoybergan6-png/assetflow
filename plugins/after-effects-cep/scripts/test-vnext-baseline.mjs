import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { collectBaseline, OUT_DIR } from "./build-vnext-baseline.mjs";

const expected = collectBaseline();
let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log(`  ✓ ${name}`);
}

for (const [name, current] of Object.entries(expected)) {
  check(`${name} matches the current code truth`, () => {
    const saved = JSON.parse(readFileSync(path.join(OUT_DIR, name), "utf8"));
    assert.deepEqual(saved, current);
  });
}

const runtime = expected["runtime-inventory.json"];
const contracts = expected["contract-snapshot.json"];
const hosts = expected["host-capability-matrix.json"];
const serialized = JSON.stringify(expected);

check("all dual-stack V2 embedded defaults are fail-closed", () => {
  const defaults = runtime.v2EmbeddedDefaults;
  assert.equal(defaults.shellV2, false);
  assert.equal(defaults.homeV2, false);
  assert.deepEqual(defaults.generationDomainV2, { image: false, video: false, audio: false, tools: false });
});
check("shared CEP route inventory includes every current primary AI view", () => {
  for (const id of ["v-launcher", "v-imggen", "v-vidgen", "v-audgen", "v-sessions", "v-session", "v-projects", "v-project", "v-history", "v-settings"]) {
    assert.ok(runtime.views.includes(id), `missing ${id}`);
  }
});
check("generation contract snapshot includes quote, generate and recovery endpoints", () => {
  const routes = new Set(contracts.routes.studio.map((route) => `${route.method} ${route.path}`));
  for (const route of ["GET /api/studio/gen/models", "POST /api/studio/gen/cost-quote", "POST /api/studio/gen", "GET /api/studio/gen/:jobId"]) {
    assert.ok(routes.has(route), `missing ${route}`);
  }
});
check("AE and Premiere capability truth remains explicit and shared-UI", () => {
  assert.equal(hosts.sharedUi, "plugins/after-effects-cep/AssetFlow_Plugin.html");
  assert.equal(hosts.capabilities.AEFT.projectReference, true);
  assert.equal(hosts.capabilities.PPRO.uxpFallback, true);
  assert.equal(hosts.releaseDecision.publicReadiness, "blocked");
});
check("baseline contains no secret-shaped credential material", () => {
  const forbidden = [
    /Bearer\s+[A-Za-z0-9._~-]{16,}/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?:api[_-]?key|client[_-]?secret|poll[_-]?token|quote[_-]?signature)\s*[=:]\s*["'][^"']{12,}["']/i,
  ];
  for (const pattern of forbidden) assert.equal(pattern.test(serialized), false, String(pattern));
});

console.log(`vNext Wave 0 baseline: ${checks} checks passed`);
