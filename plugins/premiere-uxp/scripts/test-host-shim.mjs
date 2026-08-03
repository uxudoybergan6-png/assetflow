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

const calls = [];
const source = {
  path: "/packs/template.prproj",
  async getSequences() {
    return [{ guid: "seq-a", name: "Main" }, { guid: "seq-b", name: "Social" }];
  },
  async close() { calls.push(["close-source"]); },
};
const target = {
  path: "/work/current.prproj",
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

console.log("✓ host shim: writable path + path + .prproj import + cep.fs kontraktlari o'tdi");
