import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = process.argv.includes("--release-artifacts");

const commands = [
  ["API build", "npm", ["run", "build", "-w", "apps/api"]],
  ["vNext Wave 0 baseline", "node", ["plugins/after-effects-cep/scripts/test-vnext-baseline.mjs"]],
  ["vNext real-browser baseline", "node", ["plugins/after-effects-cep/scripts/test-vnext-browser-baseline.mjs"]],
  ["vNext V2 shell browser baseline", "node", ["plugins/after-effects-cep/scripts/test-vnext-browser-baseline.mjs", "--v2"]],
  ["vNext domain and rollback contracts", "node", ["plugins/after-effects-cep/scripts/test-vnext-domain.mjs"]],
  ["vNext rollout evidence chain", "node", ["scripts/vnext-rollout-chain.mjs", "verify"]],
  ["Create workspace", "npm", ["run", "test:plugin-create"]],
  ["Responsive contract", "npm", ["run", "test:plugin-responsive"]],
  ["Shared session persistence", "node", ["plugins/after-effects-cep/scripts/test-frameflow-session-persistence.mjs"]],
  ["Premiere host", "node", ["plugins/after-effects-cep/scripts/test-premiere-cep-host.mjs"]],
  ["Premiere integration", "node", ["plugins/after-effects-cep/scripts/test-premiere-cep-integration.mjs"]],
  ["Device auth API", "node", ["apps/api/scripts/test-plugin-device-auth.mjs"]],
  ["Device auth UI", "node", ["packages/assetflow-studio/scripts/test-device-auth-ui.mjs"]],
  ["Generation params", "node", ["apps/api/scripts/test-gen-param-contract.mjs"]],
  ["Generation providers", "node", ["apps/api/scripts/test-gen-provider-adapters.mjs"]],
  ["Generation availability", "node", ["apps/api/scripts/test-gen-provider-availability.mjs"]],
  ["Reference security", "node", ["apps/api/scripts/test-gen-reference-security.mjs"]],
  ["Web Create init", "node", ["packages/assetflow-studio/scripts/test-aistudio-create-init.mjs"]],
  ["Web Create parity", "node", ["packages/assetflow-studio/scripts/test-aistudio-create-parity.mjs"]],
  ["Studio session policy", "node", ["packages/assetflow-studio/scripts/test-studio-session-policy.mjs"]],
];

if (release) {
  commands.push(
    ["Package security (creates temporary archives)", "npm", ["run", "test:plugin-package"]],
    ["Updater security", "npm", ["run", "test:plugin-updater"]],
    ["Marketplace preflight", "npm", ["run", "test:marketplace-preflight"]],
  );
}

let passed = 0;
for (const [label, command, args] of commands) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\nqa:plugin stopped: ${label} failed with exit ${result.status ?? "unknown"}`);
    process.exit(result.status || 1);
  }
  passed += 1;
}

console.log(`\nqa:plugin: ${passed}/${commands.length} command groups passed${release ? " (release artifacts enabled)" : " (no archives/packages created)"}.`);
