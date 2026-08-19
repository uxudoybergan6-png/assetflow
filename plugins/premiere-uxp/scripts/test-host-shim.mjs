#!/usr/bin/env node
/** Premiere UXP host shim regressiya testi — haqiqiy host API shaklini mock qiladi. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.resolve(HERE, "..", "js", "ae-shim", "csinterface-shim.js");
const CEP_FS = path.resolve(HERE, "..", "js", "ae-shim", "cep-fs.js");
const NODE_IO = path.resolve(HERE, "..", "js", "ae-shim", "node-io.js");
const REQUIRE_SHIM = path.resolve(HERE, "..", "js", "ae-shim", "require-shim.js");
const AE_PANEL = path.resolve(HERE, "..", "..", "after-effects-cep", "AssetFlow_Plugin.html");
const PORTED_BODY = path.resolve(HERE, "..", "ported", "ae-body.html");
const PORTED_CORE = path.resolve(HERE, "..", "ported", "ae-inline-05.js");
const PORTED_SESSIONS = path.resolve(HERE, "..", "ported", "ae-inline-08.js");
const PORTED_NETWORK = path.resolve(HERE, "..", "ported", "ae-inline-03.js");
const PORTED_CREATE = path.resolve(HERE, "..", "ported", "ae-src", "frameflow-create-workspace.js");
const PORTED_VNEXT = path.resolve(HERE, "..", "ported", "ae-src", "frameflow-vnext.js");

const calls = [];
const source = {
  path: "/packs/template.prproj",
  async getSequences() {
    return [{ guid: "seq-a", name: "Main" }, { guid: "seq-b", name: "Social" }];
  },
  async close() { calls.push(["close-source"]); },
};
const activeSequence = {
  name: "Main Timeline",
  async getInPoint() { return { seconds: 2 }; },
  async getOutPoint() { return { seconds: 9.5 }; },
  async getEndTime() { return { seconds: 12 }; },
};
const target = {
  path: "/work/current.prproj",
  name: "Current Project.prproj",
  async getActiveSequence() { return activeSequence; },
  async getSequences() { return [activeSequence]; },
  async importSequences(sourcePath, ids) {
    calls.push(["importSequences", sourcePath, Array.from(ids)]);
    return true;
  },
};
const ppro = {
  Project: {
    async getActiveProject() { return target; },
    isProject(p) { calls.push(["isProject", p]); return true; },
    async open(p) {
      calls.push(["open", p]);
      return p === source.path ? source : target;
    },
  },
  OpenProjectOptions() { return {}; },
  CloseProjectOptions() { return {}; },
};
const uxp = {
  host: { version: "26.3" },
  storage: { localFileSystem: {} },
  shell: { openExternal: async () => {} },
};
const win = {
  __FFNodeIO: { dataDir: () => "/writable/plugin-data", tmpDir: () => "/writable/tmp" },
  FFLog: { warn() {}, error() {}, info() {} },
  dispatchEvent() {},
};
win.window = win;
const context = vm.createContext({
  window: win,
  require(name) {
    if (name === "uxp") return uxp;
    if (name === "premierepro") return ppro;
    if (name === "fs") return { lstatSync() {} };
    if (name === "os") return { platform: () => "darwin", tmpdir: () => "/native/tmp" };
    throw new Error("unexpected module: " + name);
  },
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
  console,
  setTimeout,
  clearTimeout,
  JSON,
});
vm.runInContext(fs.readFileSync(SHIM, "utf8"), context, { filename: SHIM });

const cs = new win.CSInterface();
assert.equal(cs.getSystemPath(win.SystemPath.EXTENSION), "/writable/plugin-data");

const cfg = JSON.stringify({ filePath: source.path, packLabel: "Starter" });
const raw = await new Promise((resolve) => cs.evalScript(`importTemplateProject(${JSON.stringify(cfg)})`, resolve));
const result = JSON.parse(raw);
assert.equal(result.ok, true);
assert.equal(result.movedCount, 2);
assert.deepEqual(result.importedSequences, ["Main", "Social"]);
assert.deepEqual(calls, [
  ["isProject", source.path],
  ["open", source.path],
  ["open", target.path],
  ["importSequences", source.path, ["seq-a", "seq-b"]],
  ["close-source"],
]);

const capabilities = JSON.parse(await new Promise((resolve) => cs.evalScript("getHostCapabilities()", resolve)));
assert.equal(capabilities.ok, true);
assert.equal(capabilities.bridge, "uxp");
assert.equal(capabilities.currentFrameReference, true);

const workArea = JSON.parse(await new Promise((resolve) => cs.evalScript("getWorkAreaInfo()", resolve)));
assert.deepEqual({ start: workArea.start, end: workArea.end, duration: workArea.duration }, { start: 2, end: 9.5, duration: 7.5 });

const projectTree = JSON.parse(await new Promise((resolve) => cs.evalScript("refreshProjectPanel()", resolve)));
assert.equal(projectTree.projectName, "Current Project");
assert.equal(projectTree.compCount, 1);

const projectSelection = JSON.parse(await new Promise((resolve) => cs.evalScript("getSelectedProjectReference()", resolve)));
assert.equal(projectSelection.ok, false);
assert.equal(projectSelection.code, "PROJECT_SELECTION_UNAVAILABLE");

// Data folder hali boot bo'lmagan holat: writable temp, plugin folder EMAS.
win.__FFNodeIO.dataDir = () => "";
assert.equal(cs.getSystemPath(win.SystemPath.EXTENSION), "/writable/tmp");
win.__FFNodeIO.tmpDir = () => "";
assert.equal(cs.getSystemPath(win.SystemPath.EXTENSION), "/native/tmp");

// CEP picker/readFile yuzasi: async UXP entry → eski CEP javob shakli.
const fileUxp = {
  storage: {
    localFileSystem: {
      async getFolder() { return { nativePath: "/picked/folder" }; },
      async getFileForOpening(opts) {
        assert.equal(opts.allowMultiple, true);
        assert.deepEqual(opts.types, ["png", "jpg"]);
        return [{ nativePath: "/picked/a.png" }, { nativePath: "/picked/b.jpg" }];
      },
    },
  },
};
const fileWin = {
  FFLog: { warn() {} },
  __ffRequire(name) {
    assert.equal(name, "fs");
    return { readFileSync: () => new Uint8Array([0, 1, 255]) };
  },
};
fileWin.window = fileWin;
const fileContext = vm.createContext({
  window: fileWin,
  require(name) { if (name === "uxp") return fileUxp; throw new Error(name); },
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  Uint8Array,
  ArrayBuffer,
  String,
  Math,
  decodeURIComponent,
});
vm.runInContext(fs.readFileSync(CEP_FS, "utf8"), fileContext, { filename: CEP_FS });
const pickedFolder = await fileWin.cep.fs.showOpenDialog(false, true, "", "", []);
assert.deepEqual(Array.from(pickedFolder.data), ["/picked/folder"]);
const pickedFiles = await fileWin.cep.fs.showOpenDialog(true, false, "", "", [".png", "jpg"]);
assert.deepEqual(Array.from(pickedFiles.data), ["/picked/a.png", "/picked/b.jpg"]);
assert.equal(fileWin.cep.fs.readFile("/picked/a.png", fileWin.cep.encoding.Base64).data, "AAH/");

// Premiere 26.2 real host shakli: `require("path")` truthy, lekin join yo'q.
const pathWin = { FFLog: { warn() {}, error() {}, info() {} } };
pathWin.window = pathWin;
const pathContext = vm.createContext({
  window: pathWin,
  require(name) {
    if (name === "uxp") return { storage: { localFileSystem: {} } };
    if (name === "path") return {}; // jonli UXP logida ko'rilgan shakl
    throw new Error(name);
  },
  navigator: { platform: "MacIntel" },
  Proxy,
  Uint8Array,
  ArrayBuffer,
  AbortController,
  setTimeout,
  clearTimeout,
});
vm.runInContext(fs.readFileSync(NODE_IO, "utf8"), pathContext, { filename: NODE_IO });
vm.runInContext(fs.readFileSync(REQUIRE_SHIM, "utf8"), pathContext, { filename: REQUIRE_SHIM });
const pathShim = pathWin.__ffRequire("path");
assert.equal(pathShim.join("/plugin/data", "assetflow-data", "..", "prefs.json"), "/plugin/data/prefs.json");
assert.equal(pathShim.dirname("/plugin/data/prefs.json"), "/plugin/data");
assert.equal(pathShim.basename("/plugin/data/prefs.json", ".json"), "prefs");
assert.equal(pathShim.extname("/plugin/data/prefs.json"), ".json");
assert.equal(pathShim.relative("/plugin/data", "/plugin/data/blobs/a"), "blobs/a");

// AE yagona manba → Premiere port parity: serverda saqlanadigan workspace'lar
// yashirilmasin va UXP sessiya picker'ini ataylab chetlab o'tmasin.
const aePanel = fs.readFileSync(AE_PANEL, "utf8");
const portedBody = fs.readFileSync(PORTED_BODY, "utf8");
const portedCore = fs.readFileSync(PORTED_CORE, "utf8");
const portedSessions = fs.readFileSync(PORTED_SESSIONS, "utf8");
const portedNetwork = fs.readFileSync(PORTED_NETWORK, "utf8");
const portedCreate = fs.readFileSync(PORTED_CREATE, "utf8");
const portedVnext = fs.readFileSync(PORTED_VNEXT, "utf8");
for (const html of [aePanel, portedBody]) {
  assert.match(html, /class="ai-seg ai-workspace-nav"/);
  assert.match(html, /data-go="sessions">Sessions</);
  assert.match(html, /data-go="projects">Projects</);
}
assert.doesNotMatch(aePanel, /Premiere 26\.2 UXP populated picker/);
assert.doesNotMatch(portedSessions, /Premiere 26\.2 UXP populated picker/);
assert.doesNotMatch(portedSessions, /FFRepaint&&uxpView/);
assert.match(portedSessions, /uxpView\.style\.setProperty\('animation','none'\)/);
assert.match(portedCore, /_uxpWorkspacePrepared/);
assert.match(portedCore, /_uxpComposerTarget=\(id==='imggen'\|\|id==='vidgen'\|\|id==='audgen'\)/);
assert.match(portedCore, /_cv\.style\.removeProperty\(_p\)/);
assert.match(portedNetwork, /d\.code!=='MODERATION_NOT_CONFIGURED'/);
assert.match(portedNetwork, /function enhanceMismatchMessage\(r\)/);
assert.match(portedCreate, /FrameFlowCreateWorkspace/);
assert.match(portedVnext, /FrameFlowVNext/);

console.log("✓ host shim: writable path + path + .prproj import + cep.fs + AE/PR session parity o'tdi");
