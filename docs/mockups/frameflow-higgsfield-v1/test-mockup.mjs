import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(directory, name), "utf8");
const html = read("index.html");
const css = read("mockup.css");
const js = read("mockup.js");
const readme = read("README.md");

for (const route of ["home", "create", "browse", "activity", "library", "projects", "settings"]) {
  assert.match(html, new RegExp(`id=["']route-${route}["']`), `missing ${route} route`);
}

for (const id of [
  "toolSections", "allToolsButton", "toolsModal", "allToolsSearch", "quickPrompt", "quickCreateButton", "promptInput", "referenceInput", "modelModal",
  "settingsModal", "assetModal", "generateButton", "assetGrid", "workMenu"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing interactive control #${id}`);
}

for (const contract of [
  "renderTools", "renderAllTools", "chooseTool", "setQuickMode", "startQuickSession", "setShowcase", "restartShowcase", "setMode", "renderModels", "renderAssets",
  "enhancePrompt", "generate", "previewReference", "openAsset", "openModal"
]) {
  assert.match(js, new RegExp(`function\\s+${contract}\\s*\\(`), `missing ${contract} behavior`);
}

assert.match(css, /background-image:\s*radial-gradient/, "dotted application background is missing");
assert.match(css, /\.command-center\s*\{/, "creative command center styling is missing");
assert.match(css, /\.live-canvas\s*\{/, "live canvas styling is missing");
assert.match(css, /\.project-pulse\s*\{/, "project pulse styling is missing");
assert.equal((html.match(/class="showcase-slide/g) || []).length, 3, "animated showcase must contain three trending templates");
assert.match(css, /\.showcase-slide\.active/, "active showcase animation state is missing");
assert.doesNotMatch(html, /class="template-promo"/, "static template rail must not duplicate the animated showcase");
assert.match(css, /\.tool-grid\s*\{/, "tool grid styling is missing");
assert.match(css, /\.composer\s*\{/, "composer styling is missing");
assert.match(css, /@media\s*\(max-width:\s*760px\)/, "panel/mobile breakpoint is missing");
assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)\s+auto\s+minmax\(0,1fr\)/, "AE panel header must reserve its center column for navigation");
assert.match(css, /@media\s*\(max-width:\s*760px\)[\s\S]*?\.primary-nav\s*\{[^}]*position:\s*static[^}]*grid-column:\s*2[^}]*grid-row:\s*1/, "AE panel navigation must sit between the brand and account controls");
assert.doesNotMatch(css, /\.primary-nav\s*\{[^}]*position:\s*fixed[^}]*bottom:/, "primary navigation must not float over panel content");
assert.match(css, /prefers-reduced-motion/, "reduced-motion support is missing");
for (const tool of ["Creative Assistant", "Generative Fill", "Audio Cleanup", "Render Queue"]) {
  assert.match(js, new RegExp(`name:\\s*["']${tool}["']`), `missing balanced-grid tool: ${tool}`);
}
assert.ok(js.indexOf('name: "Creative Assistant"') < js.indexOf('name: "Draw to Edit"'), "featured panel must start with the full-width assistant card");
assert.match(js, /const essentialToolIds\s*=\s*\[[^\]]+\]/, "Home essentials allowlist is missing");

assert.doesNotMatch(`${html}\n${css}\n${js}`, /higgsfield/i, "competitor branding must not appear in the UI source");
assert.doesNotMatch(`${html}\n${css}\n${js}`, /plugins\/after-effects-cep|AssetFlow_Plugin\.html/, "prototype must not bind to plugin runtime");
assert.match(readme, /does not modify or load the real AE\/Premiere CEP source/, "approval boundary must be documented");

const openTags = (html.match(/<section\b/g) || []).length;
const closeTags = (html.match(/<\/section>/g) || []).length;
assert.equal(openTags, closeTags, "section tags must be balanced");

console.log("FrameFlow interactive mockup contract checks passed.");
