import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../jsx/host-premiere.jsx", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../CSXS/manifest.xml", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../assetflow-catalog.js", import.meta.url), "utf8");
const store = readFileSync(new URL("../assetflow-local-store.js", import.meta.url), "utf8");

const files = new Set(["/tmp/result.png", "/tmp/template.mogrt", "/tmp/template.prproj", "/tmp/clip.mp4", "/tmp/sound.wav"]);
function File(path) {
  this.fsName = String(path);
  this.name = this.fsName.split(/[\\/]/).pop();
  this.parent = { fsName: this.fsName.replace(/[\\/][^\\/]+$/, ""), execute() {} };
  Object.defineProperty(this, "exists", { get: () => files.has(this.fsName) });
}
function Folder(path) {
  this.fsName = String(path);
  this.exists = true;
  this.create = () => true;
  this.execute = () => true;
}
Folder.temp = { fsName: "/tmp" };
Folder.selectDialog = () => ({ fsName: "/tmp/downloads" });

function children(items = []) {
  items.numItems = items.length;
  return items;
}
let nextNodeId = 1;
const root = {
  nodeId: "root",
  name: "Root",
  children: children(),
  createBin(name) {
    const bin = {
      name,
      nodeId: `bin-${nextNodeId++}`,
      children: children(),
      deleteBin() {
        const at = root.children.indexOf(this);
        if (at >= 0) root.children.splice(at, 1);
        root.children.numItems = root.children.length;
      },
    };
    this.children.push(bin);
    this.children.numItems = this.children.length;
    return bin;
  },
};
const calls = [];
const position = { seconds: 3.5, ticks: "889945056000" };
const videoClips = children();
const audioClips = children();
const videoTrack = {
  clips: videoClips,
  isLocked: () => false,
  insertClip(item, ticks, vIndex, aIndex) {
    assert.equal(typeof ticks, "string");
    assert.equal(arguments.length, 4);
    calls.push(["video", item.name, ticks, vIndex, aIndex]);
    return true;
  },
};
const audioTrack = {
  clips: audioClips,
  isLocked: () => false,
  insertClip(item, ticks, vIndex, aIndex) {
    assert.equal(typeof ticks, "string");
    assert.equal(arguments.length, 4);
    calls.push(["audio", item.name, ticks, vIndex, aIndex]);
    return true;
  },
};
const videoTracks = [videoTrack]; videoTracks.numTracks = 1;
const audioTracks = [audioTrack]; audioTracks.numTracks = 1;
const sequence = {
  name: "Sequence 01",
  videoTracks,
  audioTracks,
  getPlayerPosition: () => position,
  getSelection: () => [{ name: "clip.mp4", projectItem: { getMediaPath: () => "/tmp/clip.mp4" } }],
  importMGT(path, ticks, vt, at) {
    assert.equal(typeof ticks, "string");
    const clip = {
      nodeId: "timeline-mogrt-1",
      remove(ripple, align) {
        calls.push(["remove-timeline", this.nodeId, ripple, align]);
      },
    };
    videoClips.push(clip);
    videoClips.numItems = videoClips.length;
    calls.push(["mogrt", path, ticks, vt, at]);
    return clip;
  },
  getInPointAsTime: () => ({ seconds: 1 }),
  getOutPointAsTime: () => ({ seconds: 6 }),
};
const project = {
  name: "QA.prproj",
  path: "/tmp/QA.prproj",
  rootItem: root,
  activeSequence: sequence,
  sequences: Object.assign([sequence], { numSequences: 1 }),
  importFiles(paths, _suppress, target) {
    for (const path of paths) {
      assert.doesNotMatch(path, /\.prproj$/i, ".prproj must never use importFiles");
      const item = { name: path.split("/").pop(), nodeId: `item-${nextNodeId++}`, getMediaPath: () => path, children: children() };
      target.children.push(item);
      target.children.numItems = target.children.length;
    }
    return true;
  },
};

const context = vm.createContext({
  app: {
    project,
    enableQE() {},
    getCurrentProjectViewSelection: () => [{ name: "clip.mp4", getMediaPath: () => "/tmp/clip.mp4" }],
  },
  qe: { project: { getActiveSequence: () => ({ exportFramePNG(_seconds, path) { files.add(path); return true; } }) } },
  File,
  Folder,
  Date,
  Math,
  String,
  Number,
  RegExp,
  Error,
  JSON,
});
vm.runInContext(src, context, { filename: "host-premiere.jsx" });

const media = JSON.parse(context.importMediaFromPath("/tmp/clip.mp4"));
assert.equal(media.ok, true);
assert.equal(media.addedToComp, true);
assert.deepEqual(calls[0], ["video", "clip.mp4", position.ticks, 0, 0]);

const audio = JSON.parse(context.importMediaFromPath("/tmp/sound.wav"));
assert.equal(audio.ok, true);
assert.deepEqual(calls[1], ["audio", "sound.wav", position.ticks, 0, 0]);

const mogrt = JSON.parse(context.importTemplateProject(JSON.stringify({ filePath: "/tmp/template.mogrt", packLabel: "Titles" })));
assert.equal(mogrt.ok, true);
assert.equal(calls[2][0], "mogrt");
assert.equal(calls[2][2], position.ticks);

const prproj = JSON.parse(context.importTemplateProject(JSON.stringify({ filePath: "/tmp/template.prproj", packLabel: "Projects" })));
assert.equal(prproj.ok, false);
assert.equal(prproj.manual, true);
assert.equal(prproj.code, "PRPROJ_MANUAL_IMPORT");

const sameNameUserBin = root.createBin("FrameFlow");
const removeMogrt = JSON.parse(context.removeImportedTemplate(JSON.stringify({ timelineItemIds: mogrt.timelineItemIds })));
assert.equal(removeMogrt.ok, true);
assert.ok(root.children.includes(sameNameUserBin), "same-name user bin must survive ID-only removal");
assert.deepEqual(calls[3], ["remove-timeline", "timeline-mogrt-1", false, false]);

const unsafeRemove = JSON.parse(context.removeImportedTemplate(JSON.stringify({ folders: ["FrameFlow"] })));
assert.equal(unsafeRemove.ok, false);
assert.equal(unsafeRemove.code, "UNSAFE_LEGACY_REMOVE");

const bundle = JSON.parse(context.importFootageBundle(JSON.stringify({ files: ["/tmp/clip.mp4", "/missing.mov"], packLabel: "Stock" })));
assert.equal(bundle.ok, true);
assert.equal(bundle.imported, 1);
assert.equal(bundle.failed, 1);

assert.equal(JSON.parse(context.listProjectFootage()).ok, true);
assert.equal(JSON.parse(context.getSelectedProjectReference()).mediaPath, "/tmp/clip.mp4");
assert.equal(JSON.parse(context.getActiveTimelineVideoReference()).sequence, "Sequence 01");
assert.equal(JSON.parse(context.getWorkAreaInfo()).duration, 5);
assert.equal(JSON.parse(context.exportTimelineFrame()).ok, true);
assert.equal(JSON.parse(context.refreshProjectPanel()).projectName, "QA");

assert.match(manifest, /<Host Name="PPRO" Version="\[22\.0,99\.9\]"\/>/);
assert.match(manifest, /<ScriptPath>\.\/jsx\/host-bootstrap\.jsx<\/ScriptPath>/);
assert.match(catalog, /p\.set\("app", hostTemplateApp\(\)\)/);
assert.match(store, /AssetFlowSecret\.settingsDir\(\)/);
assert.doesNotMatch(store, /dataRoot\s*=\s*pathLib\.join\(extPath,\s*"assetflow-data"\)/);

console.log("Premiere CEP host adapter: 18 checks passed");
