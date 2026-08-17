#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const uxpRoot = path.resolve(here, "..");
const repoRoot = path.resolve(uxpRoot, "../..");
const cepBridge = fs.readFileSync(path.join(repoRoot, "plugins/after-effects-cep/assetflow-uxp-bridge.js"), "utf8");
const uxpBridge = fs.readFileSync(path.join(uxpRoot, "companion/bridge.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(uxpRoot, "companion/manifest.json"), "utf8"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ff-host-bridge-test-"));
const mailbox = path.join(temp, "com.frameflow.premiere.host-bridge");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label) {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    const value = fn();
    if (value) return value;
    await sleep(15);
  }
  throw new Error(`timeout: ${label}`);
}

try {
  assert.equal(manifest.hostUIContext.hideFromMenu, true);
  assert.equal(manifest.requiredPermissions.localFileSystem, "fullAccess");
  assert.equal(manifest.requiredPermissions.network, undefined);

  const cepWindow = {};
  cepWindow.window = cepWindow;
  const cepContext = vm.createContext({
    window: cepWindow,
    require(name) {
      if (name === "os") return { platform: () => "linux", tmpdir: () => temp };
      if (name === "fs") return fs;
      if (name === "path") return path;
      if (name === "crypto") return { randomBytes: (n) => Buffer.alloc(n, 7) };
      throw new Error(name);
    },
    process: { pid: 4242 },
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    JSON,
    Math,
  });
  vm.runInContext(cepBridge, cepContext, { filename: "assetflow-uxp-bridge.js" });

  const resultPromise = new Promise((resolve) => cepWindow.AF_UXP_BRIDGE.evalScript("listProjectFootage()", resolve));
  const sessionDir = await until(() => {
    try {
      const name = fs.readdirSync(mailbox).find((item) => /^session-[a-f0-9]{32}$/.test(item));
      return name ? path.join(mailbox, name) : null;
    } catch { return null; }
  }, "CEP session mailbox");
  const descriptor = await until(() => {
    try { return JSON.parse(fs.readFileSync(path.join(sessionDir, "bridge.json"), "utf8")); } catch { return null; }
  }, "CEP descriptor");
  fs.writeFileSync(path.join(sessionDir, "ready.json"), JSON.stringify({ protocol: 1, session: descriptor.session, secret: descriptor.secret }));
  const request = await until(() => {
    try { return JSON.parse(fs.readFileSync(path.join(sessionDir, "request.json"), "utf8")); } catch { return null; }
  }, "CEP request");
  assert.equal(request.script, "listProjectFootage()");
  fs.writeFileSync(path.join(sessionDir, "response.json"), JSON.stringify({
    protocol: 1,
    session: descriptor.session,
    id: request.id,
    secret: descriptor.secret,
    result: JSON.stringify({ ok: true, count: 2 }),
  }));
  assert.deepEqual(JSON.parse(await resultPromise), { ok: true, count: 2 });

  fs.rmSync(mailbox, { recursive: true, force: true });
  fs.mkdirSync(mailbox, { recursive: true });
  const companionSecret = "a".repeat(64);
  const companionSession = "b".repeat(32);
  const companionDir = path.join(mailbox, `session-${companionSession}`);
  fs.mkdirSync(companionDir);
  fs.writeFileSync(path.join(companionDir, "bridge.json"), JSON.stringify({ protocol: 1, session: companionSession, secret: companionSecret, pid: 5150, createdAt: Date.now() }));
  fs.writeFileSync(path.join(companionDir, "request.json"), JSON.stringify({
    protocol: 1,
    session: companionSession,
    id: "request-123456",
    secret: companionSecret,
    pid: 5150,
    script: "importMediaFromPath(\"/tmp/a.mov\")",
    createdAt: Date.now(),
    deadlineAt: Date.now() + 190000,
  }));
  let lifecycle = null;
  const uxpWindow = {
    async __ffHostDispatch(script) {
      assert.equal(script, "importMediaFromPath(\"/tmp/a.mov\")");
      return JSON.stringify({ ok: true, name: "a.mov" });
    },
  };
  uxpWindow.window = uxpWindow;
  const uxpContext = vm.createContext({
    window: uxpWindow,
    require(name) {
      if (name === "fs") return fs;
      if (name === "os") return { platform: () => "linux", tmpdir: () => temp };
      if (name === "uxp") return { entrypoints: { setup(value) { lifecycle = value; } } };
      throw new Error(name);
    },
    setInterval,
    clearInterval,
    Date,
    JSON,
    String,
  });
  vm.runInContext(uxpBridge, uxpContext, { filename: "companion/bridge.js" });
  const response = await until(() => {
    try { return JSON.parse(fs.readFileSync(path.join(companionDir, "response.json"), "utf8")); } catch { return null; }
  }, "UXP response");
  assert.equal(response.id, "request-123456");
  assert.deepEqual(JSON.parse(response.result), { ok: true, name: "a.mov" });
  assert.ok(lifecycle && lifecycle.plugin && lifecycle.commands);
  lifecycle.plugin.destroy();

  console.log("✓ CEP↔UXP bridge: invisible manifest + authenticated mailbox + allow-list dispatch o'tdi");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
