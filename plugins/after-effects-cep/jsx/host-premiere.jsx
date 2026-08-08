/* FrameFlow — Premiere Pro CEP ExtendScript adapter.
 * UI/network/session code is shared byte-for-byte with the AE CEP panel; only
 * host project/timeline operations live here. ES3 syntax is intentional. */

if (!String.prototype.trim) {
  String.prototype.trim = function () { return String(this).replace(/^\s+/, "").replace(/\s+$/, ""); };
}

if (typeof JSON === "undefined") { JSON = {}; }
(function () {
  function esc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  }
  if (typeof JSON.stringify !== "function") {
    JSON.stringify = function (v) {
      var t = typeof v, i, k, out, x;
      if (v === null) return "null";
      if (t === "number" || t === "boolean") return String(v);
      if (t === "string") return '"' + esc(v) + '"';
      if (v instanceof Array) {
        out = [];
        for (i = 0; i < v.length; i++) out.push(JSON.stringify(v[i]));
        return "[" + out.join(",") + "]";
      }
      if (t === "object") {
        out = [];
        for (k in v) {
          if (v.hasOwnProperty && !v.hasOwnProperty(k)) continue;
          x = JSON.stringify(v[k]);
          if (x !== undefined) out.push('"' + esc(k) + '":' + x);
        }
        return "{" + out.join(",") + "}";
      }
      return undefined;
    };
  }
  if (typeof JSON.parse !== "function") {
    JSON.parse = function (text) { return eval("(" + String(text) + ")"); };
  }
})();

function ffPrResult(ok, data) {
  var r = data || {};
  r.ok = !!ok;
  return JSON.stringify(r);
}
function ffPrFail(message, details) {
  var r = details || {}, text = String(message || "Premiere operation failed");
  r.reason = r.reason || text;
  r.message = r.message || text;
  return ffPrResult(false, r);
}
function ffPrProject() {
  try { return app && app.project ? app.project : null; } catch (e) { return null; }
}
function ffPrSequence() {
  var p = ffPrProject();
  try { return p ? p.activeSequence : null; } catch (e) { return null; }
}
function ffPrBaseName(p) { return String(p || "").replace(/^.*[\\\/]/, ""); }
function ffPrExt(p) {
  var m = String(p || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}
function ffPrMediaType(p) {
  var e = ffPrExt(p);
  if (/^(wav|mp3|aiff|aif|m4a|aac|ogg|flac)$/.test(e)) return "audio";
  if (/^(png|jpg|jpeg|webp|gif|tif|tiff|bmp|exr)$/.test(e)) return "image";
  return "video";
}
function ffPrChildren(item) {
  try { return item && item.children ? item.children : []; } catch (e) { return []; }
}
function ffPrWalk(item, out, seen) {
  var kids = ffPrChildren(item), i, child, id, mediaPath;
  for (i = 0; i < kids.numItems || i < kids.length; i++) {
    try { child = kids[i]; } catch (e0) { child = null; }
    if (!child) continue;
    try { id = String(child.nodeId || child.name || i); } catch (e1) { id = String(i); }
    if (seen[id]) continue;
    seen[id] = true;
    mediaPath = "";
    try { if (child.getMediaPath) mediaPath = String(child.getMediaPath() || ""); } catch (e2) {}
    if (mediaPath) out.push({ name: String(child.name || ffPrBaseName(mediaPath)), mediaPath: mediaPath, mediaType: ffPrMediaType(mediaPath), nodeId: id });
    ffPrWalk(child, out, seen);
  }
}
function ffPrFindByPath(item, wanted) {
  var kids = ffPrChildren(item), i, child, p, found;
  for (i = 0; i < kids.numItems || i < kids.length; i++) {
    try { child = kids[i]; } catch (e0) { child = null; }
    if (!child) continue;
    p = "";
    try { if (child.getMediaPath) p = String(child.getMediaPath() || ""); } catch (e1) {}
    if (p === wanted) return child;
    found = ffPrFindByPath(child, wanted);
    if (found) return found;
  }
  return null;
}
function ffPrFindByNodeId(item, wanted) {
  var kids = ffPrChildren(item), i, child, id, found;
  if (!item || !wanted) return null;
  try { id = String(item.nodeId || ""); } catch (e0) { id = ""; }
  if (id && id === String(wanted)) return item;
  for (i = 0; i < kids.numItems || i < kids.length; i++) {
    try { child = kids[i]; } catch (e1) { child = null; }
    if (!child) continue;
    found = ffPrFindByNodeId(child, wanted);
    if (found) return found;
  }
  return null;
}
function ffPrNodeId(item) {
  try { return item && item.nodeId !== undefined && item.nodeId !== null ? String(item.nodeId) : ""; } catch (e) { return ""; }
}
function ffPrFindTimelineItemById(seq, wanted) {
  var groups = [], g, tracks, ti, track, clips, ci, clip;
  if (!seq || !wanted) return null;
  try { groups.push(seq.videoTracks); } catch (e0) {}
  try { groups.push(seq.audioTracks); } catch (e1) {}
  for (g = 0; g < groups.length; g++) {
    tracks = groups[g];
    if (!tracks) continue;
    for (ti = 0; ti < (tracks.numTracks || tracks.length || 0); ti++) {
      try { track = tracks[ti]; clips = track && track.clips ? track.clips : []; } catch (e2) { clips = []; }
      for (ci = 0; ci < (clips.numItems || clips.length || 0); ci++) {
        try { clip = clips[ci]; } catch (e3) { clip = null; }
        if (clip && ffPrNodeId(clip) === String(wanted)) return clip;
      }
    }
  }
  return null;
}
function ffPrCreateBin(label) {
  var p = ffPrProject(), root, bin = null;
  if (!p) return null;
  try { root = p.rootItem; } catch (e0) { root = null; }
  if (!root) return null;
  try { if (root.createBin) bin = root.createBin(String(label || "FrameFlow")); } catch (e1) { bin = null; }
  return bin || root;
}
function ffPrImportOne(filePath, label, addToTimeline) {
  var p = ffPrProject(), f = new File(filePath), target, ok, item, seq, pos, track, type, ticks, inserted, folderId, itemId;
  if (!p) return { ok: false, reason: "No open Premiere Pro project" };
  if (!f.exists) return { ok: false, reason: "File not found: " + filePath };
  target = ffPrCreateBin(label || "FrameFlow");
  try { ok = p.importFiles([f.fsName], true, target, false); } catch (e0) { return { ok: false, reason: String(e0) }; }
  if (ok === false) return { ok: false, reason: "Premiere rejected the import: " + f.name };
  try { item = ffPrFindByPath(p.rootItem, f.fsName); } catch (e1) { item = null; }
  folderId = ffPrNodeId(target);
  itemId = ffPrNodeId(item);
  seq = ffPrSequence();
  if (addToTimeline && (!seq || !item)) {
    return { ok: false, partial: true, reason: !seq ? "Open a sequence in the Premiere Timeline before adding media" : "Premiere imported the file but could not identify it in the Project panel", item: item ? String(item.name || f.name) : f.name, itemId: itemId, folder: label || "FrameFlow", folderId: folderId };
  }
  if (addToTimeline && seq && item) {
    try {
      pos = seq.getPlayerPosition();
      ticks = String(pos && pos.ticks !== undefined ? pos.ticks : "0");
      type = ffPrMediaType(f.fsName);
      if (type === "audio") track = seq.audioTracks && seq.audioTracks.numTracks ? seq.audioTracks[0] : null;
      else track = seq.videoTracks && seq.videoTracks.numTracks ? seq.videoTracks[0] : null;
      if (!track || !track.insertClip) return { ok: false, partial: true, reason: "No compatible unlocked Premiere track is available", item: String(item.name || f.name), itemId: itemId, folder: label || "FrameFlow", folderId: folderId };
      try { if (track.isLocked && track.isLocked()) return { ok: false, partial: true, reason: "The target Premiere track is locked", item: String(item.name || f.name), itemId: itemId, folder: label || "FrameFlow", folderId: folderId }; } catch (eLock) {}
      inserted = track.insertClip(item, ticks, 0, 0);
      if (inserted === false) return { ok: false, partial: true, reason: "Premiere rejected the Timeline insert", item: String(item.name || f.name), itemId: itemId, folder: label || "FrameFlow", folderId: folderId };
    } catch (e2) { return { ok: false, partial: true, reason: String(e2), item: String(item.name || f.name), itemId: itemId, folder: label || "FrameFlow", folderId: folderId }; }
  }
  return { ok: true, item: item ? String(item.name || f.name) : f.name, itemId: itemId, name: f.name, addedToComp: !!(addToTimeline && seq && item), compName: seq ? String(seq.name || "") : "", folder: label || "FrameFlow", folderId: folderId || null, startTicks: addToTimeline ? ticks : null };
}

function pickDownloadFolder() {
  try {
    var folder = Folder.selectDialog("Choose a FrameFlow download folder");
    return folder ? ffPrResult(true, { path: folder.fsName }) : ffPrResult(false, { canceled: true });
  } catch (e) { return ffPrFail(e); }
}

function revealFileInOS(filePath) {
  try {
    var f = new File(filePath);
    if (!f.exists) return ffPrFail("File not found: " + filePath);
    f.parent.execute();
    return ffPrResult(true, { path: f.fsName });
  } catch (e) { return ffPrFail(e); }
}

function importMediaFromPath(filePath) {
  var r = ffPrImportOne(filePath, "FrameFlow", true);
  return ffPrResult(!!r.ok, r);
}
function importAssetToProject(filePath) { return importMediaFromPath(filePath); }

function ffPrImportMogrt(filePath) {
  var seq = ffPrSequence(), f = new File(filePath), pos, ticks, clip, clipId;
  if (!seq) return { ok: false, reason: "Open a sequence in the Premiere Timeline before importing a MOGRT" };
  if (!f.exists) return { ok: false, reason: "File not found: " + filePath };
  try {
    pos = seq.getPlayerPosition();
    ticks = String(pos && pos.ticks !== undefined ? pos.ticks : "0");
    clip = seq.importMGT(f.fsName, ticks, 0, 0);
    if (clip === false || clip === null) return { ok: false, reason: "Premiere rejected the MOGRT import" };
    clipId = ffPrNodeId(clip);
    return { ok: true, item: f.name, name: f.name, addedToComp: true, addedToTimeline: true, compName: String(seq.name || ""), startTicks: ticks, timelineItemId: clipId || null };
  } catch (e) { return { ok: false, reason: String(e) }; }
}

function importTemplateProject(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr || "{}"), filePath = String(cfg.filePath || ""), label = String(cfg.packLabel || "FrameFlow");
    var ext = ffPrExt(filePath), r;
    if (ext === "mogrt") r = ffPrImportMogrt(filePath);
    else if (ext === "prproj") {
      return ffPrFail("Premiere scripting cannot safely discover sequence IDs in a closed .prproj. Use File > Import and choose the downloaded project.", { code: "PRPROJ_MANUAL_IMPORT", capability: "manual-prproj-import", manual: true, path: filePath, recoverable: true });
    } else if (ext === "aep") {
      return ffPrFail("After Effects project files cannot be imported as Premiere templates.", { code: "WRONG_HOST_PACK", capability: "premiere-template", recoverable: false });
    } else r = ffPrImportOne(filePath, label, false);
    if (!r.ok) return ffPrFail(r.reason, r);
    return ffPrResult(true, { folder: r.folder || label, folderId: r.folderId || null, itemIds: r.itemId ? [r.itemId] : [], timelineItemIds: r.timelineItemId ? [r.timelineItemId] : [], movedCount: 1, item: r.item || r.name || ffPrBaseName(filePath), addedToComp: !!r.addedToComp, compName: r.compName || "", startTicks: r.startTicks || null, missingFonts: [] });
  } catch (e) { return ffPrFail(e); }
}

function importSingleSceneFromAep(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr || "{}"), filePath = String(cfg.aepPath || cfg.filePath || ""), label = String(cfg.packLabel || cfg.sceneName || "FrameFlow");
    return importTemplateProject(JSON.stringify({ filePath: filePath, packLabel: label }));
  } catch (e) { return ffPrFail(e); }
}

function importFootageBundle(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr || "{}"), files = cfg.files || [], label = String(cfg.packLabel || "FrameFlow");
    var p = ffPrProject(), target, live = [], i, f, ok;
    if (!p) return ffPrFail("No open Premiere Pro project");
    target = ffPrCreateBin(label);
    for (i = 0; i < files.length; i++) { f = new File(files[i]); if (f.exists) live.push(f.fsName); }
    if (!live.length) return ffPrFail("No importable media in the pack");
    try { ok = p.importFiles(live, true, target, false); } catch (e0) { return ffPrFail(e0); }
    if (ok === false) return ffPrFail("Premiere rejected the footage bundle");
    return ffPrResult(true, { imported: live.length, failed: files.length - live.length, folder: label, folderId: ffPrNodeId(target) || null });
  } catch (e) { return ffPrFail(e); }
}

function removeImportedTemplate(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr || "{}"), p = ffPrProject(), seq = ffPrSequence(), root, ids = [], timelineIds = [], i, item, removed = 0, failed = [];
    if (!p) return ffPrFail("No open Premiere Pro project");
    root = p.rootItem;
    if (cfg.folderIds && typeof cfg.folderIds.length === "number") ids = ids.concat(cfg.folderIds);
    if (cfg.itemIds && typeof cfg.itemIds.length === "number") ids = ids.concat(cfg.itemIds);
    if (cfg.timelineItemIds && typeof cfg.timelineItemIds.length === "number") timelineIds = timelineIds.concat(cfg.timelineItemIds);
    if (!ids.length && !timelineIds.length) return ffPrFail("This legacy import has no stable Premiere item IDs and cannot be removed safely.", { code: "UNSAFE_LEGACY_REMOVE", recoverable: false });
    for (i = 0; i < timelineIds.length; i++) {
      item = ffPrFindTimelineItemById(seq, String(timelineIds[i]));
      if (!item || !item.remove) { failed.push(String(timelineIds[i])); continue; }
      try { item.remove(false, false); removed++; } catch (eTimeline) { failed.push(String(timelineIds[i])); }
    }
    for (i = 0; i < ids.length; i++) {
      item = ffPrFindByNodeId(root, String(ids[i]));
      if (!item) { failed.push(String(ids[i])); continue; }
      try {
        if (!item.deleteBin) { failed.push(String(ids[i])); continue; }
        item.deleteBin();
        removed++;
      } catch (e0) { failed.push(String(ids[i])); }
    }
    if (failed.length) return ffPrFail("Some imported Premiere items could not be removed safely.", { code: "PARTIAL_REMOVE", removed: removed, failedIds: failed, recoverable: true });
    return ffPrResult(true, { removed: removed });
  } catch (e) { return ffPrFail(e); }
}

function getHostCapabilities() {
  return ffPrResult(true, {
    host: "pr",
    nativeMogrtImport: true,
    projectTemplateImport: "manual",
    safeRemoveById: true,
    projectReference: true,
    timelineReference: true,
    currentFrameReference: "qe-fallback",
    publisher: false
  });
}

function listProjectFootage() {
  var p = ffPrProject(), out = [];
  if (!p) return ffPrFail("No open Premiere Pro project");
  try { ffPrWalk(p.rootItem, out, {}); } catch (e) { return ffPrFail(e); }
  return ffPrResult(true, { items: out, count: out.length });
}

function getSelectedProjectReference() {
  try {
    var sel = app.getCurrentProjectViewSelection ? app.getCurrentProjectViewSelection() : [], i, p;
    for (i = 0; i < sel.length; i++) {
      p = "";
      try { if (sel[i].getMediaPath) p = String(sel[i].getMediaPath() || ""); } catch (e0) {}
      if (p) return ffPrResult(true, { name: String(sel[i].name || ffPrBaseName(p)), mediaPath: p, mediaType: ffPrMediaType(p) });
    }
    return ffPrFail("Select a media item in the Premiere Project panel");
  } catch (e) { return ffPrFail(e); }
}

function getActiveTimelineVideoReference() {
  try {
    var seq = ffPrSequence(), sel, i, clip, p;
    if (!seq) return ffPrFail("Open a sequence in the Premiere Timeline");
    sel = seq.getSelection ? seq.getSelection() : [];
    for (i = 0; i < sel.length; i++) {
      clip = sel[i]; p = "";
      try { if (clip.projectItem && clip.projectItem.getMediaPath) p = String(clip.projectItem.getMediaPath() || ""); } catch (e0) {}
      if (p) return ffPrResult(true, { name: String(clip.name || ffPrBaseName(p)), mediaPath: p, mediaType: ffPrMediaType(p), sequence: String(seq.name || "") });
    }
    return ffPrFail("Select a clip in the Premiere Timeline");
  } catch (e) { return ffPrFail(e); }
}

function getWorkAreaInfo() {
  try {
    var seq = ffPrSequence(), start = 0, end = 0;
    if (!seq) return ffPrFail("Open a sequence in the Premiere Timeline");
    try { start = Number(seq.getInPointAsTime().seconds || 0); } catch (e0) {}
    try { end = Number(seq.getOutPointAsTime().seconds || 0); } catch (e1) {}
    return ffPrResult(true, { start: start, end: end, duration: Math.max(0, end - start), sequence: String(seq.name || "") });
  } catch (e) { return ffPrFail(e); }
}

function exportTimelineFrame() {
  try {
    var seq = ffPrSequence(), outDir, outPath, pos, qeSeq, ok;
    if (!seq) return ffPrFail("Open a sequence in the Premiere Timeline");
    outDir = new Folder(Folder.temp.fsName + "/frameflow_refs");
    if (!outDir.exists) outDir.create();
    outPath = outDir.fsName + "/premiere_frame_" + (new Date().getTime()) + ".png";
    pos = seq.getPlayerPosition();
    app.enableQE();
    qeSeq = qe.project.getActiveSequence();
    if (!qeSeq || !qeSeq.exportFramePNG) return ffPrFail("Premiere frame export API is unavailable");
    ok = qeSeq.exportFramePNG(pos.seconds, outPath);
    if (ok === false || !(new File(outPath)).exists) return ffPrFail("Premiere could not export the current frame");
    return ffPrResult(true, { path: outPath, name: ffPrBaseName(outPath), mediaType: "image", sequence: String(seq.name || "") });
  } catch (e) { return ffPrFail(e); }
}

function refreshProjectPanel() {
  try {
    var p = ffPrProject(), filePath = "", projectName = "", seqs = [], folders = [], tree = [], i, s;
    if (!p) return ffPrFail("No open Premiere Pro project");
    try { filePath = String(p.path || ""); } catch (e0) {}
    try { projectName = String(p.name || ffPrBaseName(filePath)).replace(/\.prproj$/i, ""); } catch (e1) {}
    try {
      for (i = 0; i < p.sequences.numSequences; i++) {
        s = p.sequences[i];
        seqs.push({ name: String(s.name || "Sequence"), path: "Sequences/" + String(s.name || "Sequence"), type: "comp", folder: "Sequences" });
      }
    } catch (e2) {}
    folders.push({ name: "Sequences", path: "Sequences" });
    tree = seqs;
    return ffPrResult(true, { saved: !!filePath, projectFile: filePath, projectName: projectName, compCount: seqs.length, folderCount: folders.length, folders: folders, tree: tree });
  } catch (e) { return ffPrFail(e); }
}

function renderSceneStillFrames() {
  var r = exportTimelineFrame(), d;
  try { d = JSON.parse(r); } catch (e) { d = null; }
  if (!d || !d.ok) return r;
  return ffPrResult(true, { results: [{ ok: true, path: d.path, name: d.sequence || "Active Sequence", aeComp: d.sequence || "Active Sequence", width: 0, height: 0, fps: 0, durationSec: 0 }] });
}
