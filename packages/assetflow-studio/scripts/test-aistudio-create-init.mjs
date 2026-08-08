import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("packages/assetflow-studio/platform/index.html", "utf8");

const goAistudioHandlers = [...src.matchAll(/goAistudio:\s*\(.*?\)\s*=>\s*\{([\s\S]*?)\}\s*,/g)];
for (const h of goAistudioHandlers) {
  const b = h[1] || "";
  assert.ok(/setState\(st\s*=>\s*initAistudioState\([^)]*\)\)/.test(b), "top navigation/projects goAistudio uses shared helper state patch");
  assert.ok(/ensureAistudioModels/.test(b), "top navigation/projects goAistudio triggers model preload guard");
}
assert.equal(goAistudioHandlers.length, 2, "exactly 2 goAistudio handlers remain");

const getHandler = (name) => {
  const re = new RegExp(`${name}:\\s*\\(.*?\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\s*,`);
  const match = src.match(re);
  assert.ok(!!match, `${name} handler block found`);
  return match[1];
};

const onTryToolBootstrap = getHandler("onTryTool");
const tryModelBootstrap = getHandler("tryModel");
const oldDirectForm = /goAistudio:\s*\(\)\s*=>\s*this\.go\('aistudio'\)/;

assert.ok(/const\s+initAistudioState\s*=\s*\(/.test(src), "aistudio initialization helper added");
assert.ok(/aiView:\s*'composer'/.test(src), "init helper forces composer view");
assert.ok(/aiMediaView:\s*null/.test(src), "init helper resets media pane mode");

assert.equal(/this\.initAistudioState/.test(src), false, "No undefined this.initAistudioState call remains");
assert.ok(/setState\(st\s*=>\s*initAistudioState\([^)]*\)\)/.test(onTryToolBootstrap), "Home AI tool card path initializes via shared helper state patch");
assert.ok(/ensureAistudioModels/.test(onTryToolBootstrap), "Home AI tool card path triggers model preload guard");
assert.ok(/setState\(st\s*=>\s*initAistudioState\([^)]*\)\)/.test(tryModelBootstrap), "Home featured model path initializes via shared helper state patch");
assert.ok(/ensureAistudioModels/.test(tryModelBootstrap), "Home featured model path triggers model preload guard");
assert.ok(!oldDirectForm.test(src), "legacy direct goAistudio shortcut removed");
assert.equal(/if\s*\(!s\.genModelsLoaded/.test(src), false, "init helper has no side-effect state loader call");

console.log("Aistudio create-init regression checks passed.");
