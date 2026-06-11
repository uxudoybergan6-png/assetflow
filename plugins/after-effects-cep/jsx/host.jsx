function pickTemplateFile(filterHint) {
  try {
    var f = File.openDialog("Select file", filterHint || "*.*");
    if (!f) return "";
    return f.fsName;
  } catch (e) {
    return "error:" + e.toString();
  }
}

function compInfo(comp) {
  return {
    name: comp.name,
    width: comp.width,
    height: comp.height,
    fps: Math.round(comp.frameRate * 100) / 100,
    durationSec: Math.round(comp.duration * 100) / 100
  };
}

function sceneNumber(name) {
  var m = String(name).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

function sortScenesByNumber(list) {
  var i, j, tmp;
  for (i = 0; i < list.length - 1; i++) {
    for (j = i + 1; j < list.length; j++) {
      if (sceneNumber(list[i].name) > sceneNumber(list[j].name)) {
        tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
    }
  }
  return list;
}

function isFinalRenderName(name) {
  var n = String(name).replace(/^\s+|\s+$/g, "").toUpperCase();
  if (n === "RENDER") return true;
  if (n.indexOf("FINAL") >= 0 && n.indexOf("RENDER") >= 0) return true;
  if (n === "FINAL RENDER" || n === "FINAL_RENDER") return true;
  return false;
}

function findScenesFolder() {
  var i, item;
  for (i = 1; i <= app.project.numItems; i++) {
    item = app.project.item(i);
    if (item instanceof FolderItem && String(item.name).toLowerCase() === "scenes") {
      return item;
    }
  }
  return null;
}

function collectScenesFromFolder(folder) {
  var out = [];
  var i, child;
  for (i = 1; i <= folder.numItems; i++) {
    child = folder.item(i);
    if (child instanceof CompItem) out.push(compInfo(child));
  }
  return sortScenesByNumber(out);
}

function collectScenesFromRoot() {
  var out = [];
  var i, item;
  for (i = 1; i <= app.project.numItems; i++) {
    item = app.project.item(i);
    if (!(item instanceof CompItem)) continue;
    if (/^scene\s*\d+/i.test(item.name)) out.push(compInfo(item));
  }
  return sortScenesByNumber(out);
}

function findFinalRenderComp() {
  var i, item, best = null;
  for (i = 1; i <= app.project.numItems; i++) {
    item = app.project.item(i);
    if (!(item instanceof CompItem)) continue;
    if (isFinalRenderName(item.name)) {
      if (String(item.name).toUpperCase() === "RENDER") return compInfo(item);
      if (!best) best = compInfo(item);
    }
  }
  return best;
}

function collectAllComps(parent, folderPath) {
  var out = [];
  var i, item, subPath;
  for (i = 1; i <= parent.numItems; i++) {
    item = parent.item(i);
    if (item instanceof CompItem) {
      out.push({
        name: item.name,
        folder: folderPath || "",
        width: item.width,
        height: item.height,
        fps: Math.round(item.frameRate * 100) / 100,
        durationSec: Math.round(item.duration * 100) / 100
      });
    } else if (item instanceof FolderItem) {
      subPath = folderPath ? folderPath + "/" + item.name : item.name;
      out = out.concat(collectAllComps(item, subPath));
    }
  }
  return out;
}

function isProjectFolder(item) {
  return item && item instanceof FolderItem;
}

function collectFolders(parent, folderPath) {
  var out = [];
  var i, item, subPath;
  for (i = 1; i <= parent.numItems; i++) {
    item = parent.item(i);
    if (!isProjectFolder(item)) continue;
    subPath = folderPath ? folderPath + "/" + item.name : item.name;
    out.push({ path: subPath, name: item.name, type: "folder" });
    out = out.concat(collectFolders(item, subPath));
  }
  return out;
}

function findFolderByPath(pathStr) {
  if (!pathStr) return null;
  var parts = String(pathStr).split("/");
  var current = app.project;
  var i, j, item, part;
  for (i = 0; i < parts.length; i++) {
    part = parts[i];
    item = null;
    for (j = 1; j <= current.numItems; j++) {
      if (isProjectFolder(current.item(j)) && current.item(j).name === part) {
        item = current.item(j);
        break;
      }
    }
    if (!item) return null;
    current = item;
  }
  return isProjectFolder(current) ? current : null;
}

function pickFinalRenderFromFolder(folder) {
  var comps = collectScenesFromFolder(folder);
  if (!comps.length) return null;
  var i;
  for (i = 0; i < comps.length; i++) {
    if (isFinalRenderName(comps[i].name)) return comps[i];
  }
  for (i = 0; i < comps.length; i++) {
    if (String(comps[i].name).toUpperCase() === "RENDER") return comps[i];
  }
  return comps[0];
}

function pickPreviewFromFolder(folder) {
  var comps = collectScenesFromFolder(folder);
  if (!comps.length) return null;
  var i;
  for (i = 0; i < comps.length; i++) {
    if (/preview/i.test(comps[i].name)) return comps[i];
  }
  return comps[0];
}

function collectProjectTree(parent, folderPath, depth) {
  var out = [];
  var i, item, subPath;
  for (i = 1; i <= parent.numItems; i++) {
    item = parent.item(i);
    if (item instanceof FolderItem) {
      subPath = folderPath ? folderPath + "/" + item.name : item.name;
      out.push({ type: "folder", name: item.name, path: subPath, depth: depth });
      out = out.concat(collectProjectTree(item, subPath, depth + 1));
    } else if (item instanceof CompItem) {
      out.push({
        type: "comp",
        name: item.name,
        folder: folderPath || "",
        path: folderPath ? folderPath + "/" + item.name : item.name,
        depth: depth,
        width: item.width,
        height: item.height,
        fps: Math.round(item.frameRate * 100) / 100,
        durationSec: Math.round(item.duration * 100) / 100
      });
    }
  }
  return out;
}

function refreshProjectPanel() {
  try {
    if (!app.project) return JSON.stringify({ ok: false, error: "no_project" });

    var saved = !!app.project.file;
    var tree = collectProjectTree(app.project, "", 0);
    var folders = collectFolders(app.project, "");
    var compCount = 0;
    var i;
    for (i = 0; i < tree.length; i++) {
      if (tree[i].type === "comp") compCount++;
    }

    return JSON.stringify({
      ok: true,
      saved: saved,
      projectFile: saved ? app.project.file.fsName : "",
      projectName: saved
        ? app.project.file.displayName.replace(/\.aep$/i, "")
        : String(app.project.name || "Untitled"),
      folders: folders,
      tree: tree,
      folderCount: folders.length,
      compCount: compCount
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function listProjectFolders() {
  return refreshProjectPanel();
}

function extractTemplateFromFolders(jsonStr) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, error: "no_project" });

    if (!app.project.file) {
      return JSON.stringify({
        ok: false,
        error: "unsaved",
        message: "Avval projectni saqlang (File → Save)"
      });
    }

    var cfg = JSON.parse(jsonStr);
    var scenesPath = cfg.scenesFolder || "";
    var renderPath = cfg.finalRenderFolder || "";
    var previewPath = cfg.previewFolder || "";

    if (!scenesPath && !renderPath && !previewPath) {
      return JSON.stringify({
        ok: false,
        error: "no_folders",
        message: "Kamida bitta papka tanlang"
      });
    }

    var scenesFolder = findFolderByPath(scenesPath);
    var renderFolder = findFolderByPath(renderPath);
    var previewFolder = findFolderByPath(previewPath);

    if (scenesPath && !scenesFolder) {
      return JSON.stringify({ ok: false, error: "not_found", message: "Scenes papkasi topilmadi" });
    }
    if (renderPath && !renderFolder) {
      return JSON.stringify({ ok: false, error: "not_found", message: "Final Render papkasi topilmadi" });
    }
    if (previewPath && !previewFolder) {
      return JSON.stringify({ ok: false, error: "not_found", message: "Preview papkasi topilmadi" });
    }

    var scenes = scenesFolder ? collectScenesFromFolder(scenesFolder) : [];
    var finalRender = renderFolder ? pickFinalRenderFromFolder(renderFolder) : null;
    var previewComp = previewFolder ? pickPreviewFromFolder(previewFolder) : null;

    // Scenes papkasi bo‘lmasa, Final Render papkasidagi qo‘shimcha comp larni sahna deb ol (logo reveal 2+ sahna)
    if (!scenes.length && renderFolder && !scenesPath) {
      var allInRender = collectScenesFromFolder(renderFolder);
      if (allInRender.length > 1) {
        var frName = finalRender ? finalRender.name : "";
        var rest = [];
        var ri, rc;
        for (ri = 0; ri < allInRender.length; ri++) {
          rc = allInRender[ri];
          if (frName && rc.name === frName) continue;
          rest.push(rc);
        }
        if (rest.length) {
          scenes = sortScenesByNumber(rest);
        } else {
          finalRender = allInRender[0];
          scenes = sortScenesByNumber(allInRender.slice(1));
        }
      }
    }

    if (!scenes.length && !finalRender && !previewComp) {
      return JSON.stringify({
        ok: false,
        error: "empty",
        message: "Tanlangan papkalarda comp topilmadi"
      });
    }

    return JSON.stringify({
      ok: true,
      projectFile: app.project.file.fsName,
      projectName: app.project.file.displayName.replace(/\.aep$/i, ""),
      finalRenderFolder: renderPath,
      scenesFolder: scenesPath,
      previewFolder: previewPath,
      finalRender: finalRender,
      previewComp: previewComp,
      scenes: scenes
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function listProjectCompositions() {
  try {
    if (!app.project) return JSON.stringify({ ok: false, error: "no_project" });

    if (!app.project.file) {
      return JSON.stringify({
        ok: false,
        error: "unsaved",
        message: "Avval projectni saqlang (File → Save)"
      });
    }

    var comps = collectAllComps(app.project, "");
    if (!comps.length) {
      return JSON.stringify({
        ok: false,
        error: "no_comps",
        message: "Projectda kompozitsiya topilmadi"
      });
    }

    return JSON.stringify({
      ok: true,
      projectFile: app.project.file.fsName,
      projectName: app.project.file.displayName.replace(/\.aep$/i, ""),
      comps: comps
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function scanOpenProjectForTemplate() {
  try {
    if (!app.project) return JSON.stringify({ ok: false, error: "no_project" });

    if (!app.project.file) {
      return JSON.stringify({
        ok: false,
        error: "unsaved",
        message: "Avval projectni saqlang (File → Save)"
      });
    }

    var scenesFolder = findScenesFolder();
    var scenes = scenesFolder ? collectScenesFromFolder(scenesFolder) : collectScenesFromRoot();
    var finalRender = findFinalRenderComp();

    if (!scenes.length && !finalRender) {
      return JSON.stringify({
        ok: false,
        error: "not_found",
        message: "RENDER yoki Scenes papkasi topilmadi"
      });
    }

    return JSON.stringify({
      ok: true,
      projectFile: app.project.file.fsName,
      projectName: app.project.file.displayName.replace(/\.aep$/i, ""),
      scenesFolder: scenesFolder ? scenesFolder.name : "",
      finalRender: finalRender,
      scenes: scenes
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function findCompByNameRecursive(parent, compName) {
  var i, item, found;
  for (i = 1; i <= parent.numItems; i++) {
    item = parent.item(i);
    if (item instanceof CompItem && item.name === compName) return item;
    if (item instanceof FolderItem) {
      found = findCompByNameRecursive(item, compName);
      if (found) return found;
    }
  }
  return null;
}

function findCompByName(compName) {
  if (!app.project || !compName) return null;
  return findCompByNameRecursive(app.project, compName);
}

function sanitizeFileName(name) {
  var s = String(name);
  var out = "";
  var bad = "\\/:*?\"<>|";
  var i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charAt(i);
    if (bad.indexOf(c) >= 0) out += "_";
    else out += c;
  }
  s = out.replace(/^\s+|\s+$/g, "");
  return s || "comp";
}

function renderOutputBase(exportRoot, name) {
  return exportRoot + "/" + sanitizeFileName(name);
}

function findExistingRender(exportRoot, name) {
  var base = sanitizeFileName(name);
  var exts = [".mp4", ".mov", ".MP4", ".MOV", ".m4v"];
  var i, f, path;
  for (i = 0; i < exts.length; i++) {
    path = exportRoot + "/" + base + exts[i];
    f = new File(path);
    if (f.exists) return f.fsName;
  }
  var folder = new Folder(exportRoot);
  if (folder.exists) {
    var files = folder.getFiles(base + "*");
    if (files) {
      for (i = 0; i < files.length; i++) {
        if (!(files[i] instanceof File)) continue;
        if (/\.(mp4|mov|m4v)$/i.test(files[i].name)) return files[i].fsName;
      }
    }
  }
  return "";
}

function findCompInFolderRecursive(folder, compName) {
  var i, item, found;
  if (!folder) return null;
  for (i = 1; i <= folder.numItems; i++) {
    item = folder.item(i);
    if (item instanceof CompItem && item.name === compName) return item;
    if (isProjectFolder(item)) {
      found = findCompInFolderRecursive(item, compName);
      if (found) return found;
    }
  }
  return null;
}

function findCompForRender(compName, folderPath) {
  var folder = folderPath ? findFolderByPath(folderPath) : null;
  if (folder) {
    var inFolder = findCompInFolderRecursive(folder, compName);
    if (inFolder) return inFolder;
  }
  return findCompByName(compName);
}

function applyBestVideoTemplate(om) {
  try {
    var templates = om.templates;
    var i, t, fallback = "";
    for (i = 0; i < templates.length; i++) {
      t = templates[i];
      if (t.indexOf("H.264") >= 0) {
        om.applyTemplate(t);
        return;
      }
      if (!fallback && (t.indexOf("High Quality") >= 0 || t.indexOf("AVI") >= 0)) fallback = t;
    }
    if (fallback) om.applyTemplate(fallback);
  } catch (e) {}
}

function sortSegmentsBySceneNumber(list) {
  var i, j, tmp;
  for (i = 0; i < list.length - 1; i++) {
    for (j = i + 1; j < list.length; j++) {
      if (sceneNumber(list[i].name) > sceneNumber(list[j].name)) {
        tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
    }
  }
  return list;
}

function roundSec(n) {
  return Math.round(n * 1000) / 1000;
}

function padSceneNum(n) {
  return n < 10 ? "0" + n : "" + n;
}

function sceneIndexFromMarker(comment) {
  var m = String(comment).match(/Scene_(\d+)/i);
  return m ? parseInt(m[1], 10) : 9999;
}

function clearSceneMarkers(comp) {
  var mp = comp.markerProperty;
  var i, v;
  for (i = mp.numKeys; i >= 1; i--) {
    v = mp.keyValue(i);
    if (v.comment && String(v.comment).indexOf("Scene_") === 0) {
      mp.removeKey(i);
    }
  }
}

function getPreviewCompFromCfg(cfg) {
  return findCompForRender(cfg.previewCompName, cfg.previewFolder || "");
}

function readPreviewMarkerSegments(comp, sceneNames) {
  var mp = comp.markerProperty;
  var markers = [];
  var segments = [];
  var i, j, v, num, startMarker, start, end;

  for (i = 1; i <= mp.numKeys; i++) {
    v = mp.keyValue(i);
    if (v.comment && String(v.comment).indexOf("Scene_") === 0) {
      markers.push({
        comment: String(v.comment),
        time: mp.keyTime(i),
        num: sceneIndexFromMarker(v.comment)
      });
    }
  }

  markers.sort(function (a, b) {
    return a.time - b.time;
  });

  for (i = 0; i < sceneNames.length; i++) {
    num = i + 1;
    startMarker = null;
    for (j = 0; j < markers.length; j++) {
      if (markers[j].num === num) {
        startMarker = markers[j];
        break;
      }
    }
    if (!startMarker) continue;

    start = startMarker.time;
    end = comp.duration;
    for (j = 0; j < markers.length; j++) {
      if (markers[j].time > start + 0.001) {
        end = markers[j].time;
        break;
      }
    }

    segments.push({
      name: sceneNames[i],
      marker: startMarker.comment,
      startSec: roundSec(start),
      endSec: roundSec(end),
      durationSec: roundSec(Math.max(0.04, end - start))
    });
  }

  return segments;
}

function createPreviewSceneMarkers(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var comp = getPreviewCompFromCfg(cfg);
    if (!comp) {
      return JSON.stringify({ ok: false, message: "Preview comp topilmadi" });
    }

    var sceneNames = cfg.sceneNames || [];
    if (!sceneNames.length) {
      return JSON.stringify({ ok: false, message: "Scene ro'yxati bo'sh" });
    }

    comp.openInViewer();
    clearSceneMarkers(comp);

    var count = sceneNames.length;
    var dur = comp.duration;
    var step = dur / count;
    var i, t, mv;

    for (i = 0; i < count; i++) {
      t = i * step;
      mv = new MarkerValue("Scene_" + padSceneNum(i + 1));
      mv.label = (i % 16) + 1;
      comp.markerProperty.setValueAtTime(t, mv);
    }

    return JSON.stringify({
      ok: true,
      previewComp: comp.name,
      markerCount: count,
      durationSec: roundSec(dur)
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function renderScenesFromPreviewMarkers(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    var sceneNames = cfg.sceneNames || [];
    var comp = getPreviewCompFromCfg(cfg);

    if (!comp) {
      return JSON.stringify({ ok: false, message: "Preview comp topilmadi" });
    }

    var segments = readPreviewMarkerSegments(comp, sceneNames);
    if (segments.length < sceneNames.length) {
      return JSON.stringify({
        ok: false,
        message: "Marker yetarli emas — «Markerlar yaratish» va joylashtirish kerak (" + segments.length + "/" + sceneNames.length + ")"
      });
    }

    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    var results = [];
    var pending = [];
    var i, seg, existing, rq, added, rqItem, om, outFile;

    for (i = 0; i < segments.length; i++) {
      seg = segments[i];
      existing = findExistingRender(exportRoot, seg.name);
      if (existing) {
        results.push({ name: seg.name, path: existing, ok: true, skipped: true });
      } else {
        pending.push(seg);
      }
    }

    rq = app.project.renderQueue;

    if (pending.length) {
      added = [];
      for (i = 0; i < pending.length; i++) {
        seg = pending[i];
        rqItem = rq.items.add(comp);
        rqItem.timeSpanStart = seg.startSec;
        rqItem.timeSpanDuration = seg.durationSec;
        om = rqItem.outputModule(1);
        applyBestVideoTemplate(om);
        om.file = new File(renderOutputBase(exportRoot, seg.name) + ".mp4");
        added.push({ rqItem: rqItem, name: seg.name });
      }
      rq.render();
      for (i = added.length - 1; i >= 0; i--) {
        try { added[i].rqItem.remove(); } catch (ignore) {}
      }
      for (i = 0; i < pending.length; i++) {
        seg = pending[i];
        existing = findExistingRender(exportRoot, seg.name);
        results.push({
          name: seg.name,
          path: existing || renderOutputBase(exportRoot, seg.name) + ".mp4",
          ok: !!existing,
          skipped: false,
          error: existing ? "" : "Render yakunlanmadi"
        });
      }
    }

    var previewResult = null;
    if (cfg.renderFullPreview) {
      existing = findExistingRender(exportRoot, comp.name);
      if (!existing) {
        rqItem = rq.items.add(comp);
        om = rqItem.outputModule(1);
        applyBestVideoTemplate(om);
        om.file = new File(renderOutputBase(exportRoot, comp.name) + ".mp4");
        rq.render();
        try { rqItem.remove(); } catch (ignore2) {}
        existing = findExistingRender(exportRoot, comp.name);
      }
      if (existing) {
        previewResult = { name: comp.name, path: existing, ok: true };
      }
    }

    return JSON.stringify({
      ok: true,
      results: results,
      previewResult: previewResult,
      segments: segments,
      exportRoot: exportRoot
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function checkRenderOutputs(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    var items = cfg.items || [];
    var compNames = cfg.compNames || [];
    var results = [];
    var i, name, existing;

    if (!items.length && compNames.length) {
      for (i = 0; i < compNames.length; i++) {
        items.push({ name: compNames[i], folder: "" });
      }
    }

    for (i = 0; i < items.length; i++) {
      name = items[i].name;
      existing = findExistingRender(exportRoot, name);
      results.push({
        name: name,
        path: existing || renderOutputBase(exportRoot, name) + ".mp4",
        exists: !!existing
      });
    }
    return JSON.stringify({ ok: true, results: results, exportRoot: exportRoot });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function renderCompsBatch(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    var items = cfg.items || [];
    var compNames = cfg.compNames || [];
    var results = [];
    var pending = [];
    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    if (!items.length && compNames.length) {
      var k;
      for (k = 0; k < compNames.length; k++) {
        items.push({ name: compNames[k], folder: "" });
      }
    }

    var i, name, folderPath, existing, outPath, outFile, comp;
    for (i = 0; i < items.length; i++) {
      name = items[i].name;
      folderPath = items[i].folder || "";
      existing = findExistingRender(exportRoot, name);
      if (existing) {
        results.push({ name: name, path: existing, skipped: true, ok: true });
      } else {
        comp = findCompForRender(name, folderPath);
        outPath = renderOutputBase(exportRoot, name) + ".mp4";
        if (!comp) {
          results.push({
            name: name,
            path: outPath,
            skipped: false,
            ok: false,
            error: "Comp topilmadi"
          });
        } else {
          pending.push({ name: name, path: outPath, comp: comp });
        }
      }
    }

    if (pending.length) {
      var rq = app.project.renderQueue;
      var added = [];
      for (i = 0; i < pending.length; i++) {
        outFile = new File(pending[i].path);
        var rqItem = rq.items.add(pending[i].comp);
        var om = rqItem.outputModule(1);
        applyBestVideoTemplate(om);
        om.file = outFile;
        added.push({ rqItem: rqItem, name: pending[i].name, target: pending[i].path });
      }
      rq.render();
      for (i = added.length - 1; i >= 0; i--) {
        try { added[i].rqItem.remove(); } catch (ignore) {}
      }
      for (i = 0; i < added.length; i++) {
        existing = findExistingRender(exportRoot, added[i].name);
        results.push({
          name: added[i].name,
          path: existing || added[i].target,
          skipped: false,
          ok: !!existing,
          error: existing ? "" : "Render yakunlanmadi — Output Module ni tekshiring"
        });
      }
    }

    return JSON.stringify({ ok: true, results: results, exportRoot: exportRoot });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

function collectCompDependencies(rootItem, bag, seen) {
  if (!rootItem || !bag) return bag;
  if (!seen) seen = {};
  if (seen[rootItem.id]) return bag;
  seen[rootItem.id] = true;
  bag.push(rootItem);
  if (!(rootItem instanceof CompItem)) return bag;
  var i, layer, src;
  for (i = 1; i <= rootItem.numLayers; i++) {
    try {
      layer = rootItem.layer(i);
      if (!layer) continue;
      if (!(layer instanceof AVLayer)) continue;
      src = layer.source;
      if (!src) continue;
      if (src instanceof CompItem || src instanceof FootageItem) {
        collectCompDependencies(src, bag, seen);
      }
    } catch (ignoreLayer) {}
  }
  return bag;
}

function findCompsWithPath(container, compName, basePath, matches) {
  if (!container || !matches) return;
  var i, item, subPath;
  if (container instanceof CompItem) {
    if (container.name === compName) matches.push({ comp: container, path: basePath || container.name });
    return;
  }
  if (!(container instanceof FolderItem)) return;
  for (i = 1; i <= container.numItems; i++) {
    item = container.item(i);
    subPath = basePath ? basePath + "/" + item.name : item.name;
    if (item instanceof CompItem) {
      if (item.name === compName) matches.push({ comp: item, path: subPath });
    } else if (item instanceof FolderItem) {
      findCompsWithPath(item, compName, subPath, matches);
    }
  }
}

function pickBestCompMatch(matches, scenesFolderHint) {
  if (!matches || !matches.length) return null;
  if (matches.length === 1) return matches[0].comp;
  var i, path, hint = String(scenesFolderHint || "Scenes").toLowerCase();
  for (i = 0; i < matches.length; i++) {
    path = String(matches[i].path || "").toLowerCase();
    if (hint && path.indexOf(hint) >= 0) return matches[i].comp;
    if (path.indexOf("scenes") >= 0) return matches[i].comp;
  }
  return matches[0].comp;
}

function collectProjectItemIds(container, map) {
  if (!map) map = {};
  if (!container) return map;
  var i, item;
  if (container === app.project) {
    for (i = 1; i <= app.project.numItems; i++) {
      collectProjectItemIds(app.project.item(i), map);
    }
    return map;
  }
  try {
    if (container.id) map[container.id] = true;
  } catch (ignoreId) {}
  if (container instanceof FolderItem) {
    for (i = 1; i <= container.numItems; i++) {
      collectProjectItemIds(container.item(i), map);
    }
  }
  return map;
}

function isNewProjectItem(item, existingIds) {
  if (!item || !existingIds) return false;
  try {
    return item.id && !existingIds[item.id];
  } catch (ignore) {
    return false;
  }
}

function normalizeCompNameKey(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .toLowerCase();
}

function compNameMatches(candidate, wanted) {
  if (!candidate || !wanted) return false;
  var a = normalizeCompNameKey(candidate);
  var b = normalizeCompNameKey(wanted);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
  return false;
}

function gatherImportedComps(container, existingIds, basePath, out) {
  if (!container || !out || !existingIds) return;
  var i, item, subPath;
  if (container instanceof CompItem) {
    if (isNewProjectItem(container, existingIds)) {
      out.push({ comp: container, path: basePath || container.name });
    }
    return;
  }
  if (!(container instanceof FolderItem)) return;
  for (i = 1; i <= container.numItems; i++) {
    item = container.item(i);
    subPath = basePath ? basePath + "/" + item.name : item.name;
    if (item instanceof CompItem) {
      if (isNewProjectItem(item, existingIds)) {
        out.push({ comp: item, path: subPath });
      }
    } else if (item instanceof FolderItem) {
      gatherImportedComps(item, existingIds, subPath, out);
    }
  }
}

function collectAllImportedComps(existingIds) {
  var out = [];
  var i;
  for (i = 1; i <= app.project.numItems; i++) {
    gatherImportedComps(app.project.item(i), existingIds, app.project.item(i).name, out);
  }
  return out;
}

function getNewRootItems(existingIds) {
  var roots = [];
  var i, item;
  for (i = 1; i <= app.project.numItems; i++) {
    item = app.project.item(i);
    if (isNewProjectItem(item, existingIds)) roots.push(item);
  }
  return roots;
}

function removeAllImportedItems(existingIds) {
  var roots = getNewRootItems(existingIds);
  var i;
  for (i = roots.length - 1; i >= 0; i--) {
    try {
      roots[i].remove();
    } catch (ignore) {}
  }
}

function pushUniqueName(list, name) {
  if (!name) return;
  var i, key = normalizeCompNameKey(name);
  for (i = 0; i < list.length; i++) {
    if (normalizeCompNameKey(list[i]) === key) return;
  }
  list.push(name);
}

function findImportedCompMatches(existingIds, names, exactOnly) {
  var matches = [];
  var imported = collectAllImportedComps(existingIds);
  var i, j, comp, name;
  for (i = 0; i < imported.length; i++) {
    comp = imported[i].comp;
    if (!comp) continue;
    for (j = 0; j < names.length; j++) {
      name = names[j];
      if (!name) continue;
      if (exactOnly) {
        if (comp.name === name) matches.push(imported[i]);
      } else if (compNameMatches(comp.name, name)) {
        matches.push(imported[i]);
      }
    }
  }
  return matches;
}

function pickBestImportedComp(imported, scenesFolderHint) {
  if (!imported || !imported.length) return null;
  var usable = [];
  var i, comp;
  for (i = 0; i < imported.length; i++) {
    comp = imported[i].comp;
    if (!comp) continue;
    if (isFinalRenderName(comp.name)) continue;
    usable.push(imported[i]);
  }
  if (!usable.length) usable = imported;
  return pickBestCompMatch(usable, scenesFolderHint);
}

function resolveImportedSceneComp(existingIds, cfg) {
  var names = [];
  var scenesFolderHint = cfg.scenesFolder || "Scenes";
  pushUniqueName(names, cfg.compName);
  pushUniqueName(names, cfg.sceneLabel);
  if (cfg.altCompNames && cfg.altCompNames.length) {
    for (var a = 0; a < cfg.altCompNames.length; a++) pushUniqueName(names, cfg.altCompNames[a]);
  }

  var matches = findImportedCompMatches(existingIds, names, true);
  var target = pickBestCompMatch(matches, scenesFolderHint);
  if (target) return target;

  matches = findImportedCompMatches(existingIds, names, false);
  target = pickBestCompMatch(matches, scenesFolderHint);
  if (target) return target;

  var imported = collectAllImportedComps(existingIds);
  target = pickBestImportedComp(imported, scenesFolderHint);
  if (target) return target;

  if (imported.length === 1 && imported[0].comp) return imported[0].comp;
  return null;
}

function findCompInContainer(container, compName, matches) {
  findCompsWithPath(container, compName, container && container.name ? container.name : "", matches);
}

function rootFolderNameExists(name, excludeId) {
  try {
    var items = app.project.items;
    for (var i = 1; i <= items.length; i++) {
      var it = items[i];
      if (
        it instanceof FolderItem &&
        it.id !== excludeId &&
        it.name === name &&
        it.parentFolder &&
        !it.parentFolder.parentFolder
      ) {
        return true;
      }
    }
  } catch (ignore) {}
  return false;
}

// Shu nomli root papka allaqachon bo'lsa " (2)", " (3)"… suffiks qo'shamiz
function uniqueRootFolderLabel(label, excludeId) {
  var name = label;
  var n = 2;
  while (rootFolderNameExists(name, excludeId) && n < 100) {
    name = label + " (" + n + ")";
    n++;
  }
  return name;
}

function renameImportRootForComp(comp, folderLabel) {
  if (!comp) return folderLabel;
  try {
    var folder = comp.parentFolder;
    // Root papkaning parentFolder'i null — shu orqali rootgacha ko'tarilamiz
    while (folder && folder.parentFolder && folder.parentFolder.parentFolder) {
      folder = folder.parentFolder;
    }
    if (folder && folder instanceof FolderItem) {
      folder.name = uniqueRootFolderLabel(folderLabel, folder.id);
      return folder.name;
    }
  } catch (ignore) {}
  return folderLabel;
}

function renameNewImportRootFolder(existingIds, folderLabel) {
  var roots = getNewRootItems(existingIds);
  var i, root;
  for (i = 0; i < roots.length; i++) {
    root = roots[i];
    if (root instanceof FolderItem) {
      try {
        root.name = uniqueRootFolderLabel(folderLabel, root.id);
        return root.name;
      } catch (ignore) {}
    }
  }
  return folderLabel;
}

function restoreActiveComp(destCompId) {
  if (!destCompId) return false;
  var comp = findCompByIdInProject(destCompId);
  if (!comp) return false;
  try {
    comp.openInViewer();
    return true;
  } catch (ignore) {}
  return false;
}

function addSceneCompToTimeline(sceneComp, destCompId) {
  if (!sceneComp) return { ok: false, reason: "no_scene" };
  var destComp = destCompId ? findCompByIdInProject(destCompId) : null;
  if (!destComp) {
    return { ok: false, reason: "no_dest_comp" };
  }
  try {
    var newLayer = destComp.layers.add(sceneComp);
    newLayer.startTime = destComp.time;
    destComp.openInViewer();
    return { ok: true, reason: "" };
  } catch (e) {
    return { ok: false, reason: e.toString() };
  }
}

function buildDepIdMap(deps) {
  var map = {};
  var i;
  for (i = 0; i < deps.length; i++) map[deps[i].id] = true;
  return map;
}

function pruneImportFolder(folder, depIds, existingIds) {
  if (!folder || !(folder instanceof FolderItem) || !depIds) return;
  var i, item;
  for (i = folder.numItems; i >= 1; i--) {
    item = folder.item(i);
    if (existingIds && !isNewProjectItem(item, existingIds)) continue;
    if (item instanceof FolderItem) {
      pruneImportFolder(item, depIds, existingIds);
      if (isNewProjectItem(item, existingIds) && item.numItems === 0) {
        try { item.remove(); } catch (ignore) {}
      }
    } else if (item instanceof CompItem || item instanceof FootageItem) {
      if (!depIds[item.id]) {
        try { item.remove(); } catch (ignore2) {}
      }
    }
  }
}

function pruneImportedRoots(existingIds, depIds) {
  var roots = getNewRootItems(existingIds);
  var i, rootItem;
  for (i = 0; i < roots.length; i++) {
    rootItem = roots[i];
    if (rootItem instanceof FolderItem) {
      pruneImportFolder(rootItem, depIds, existingIds);
    } else if ((rootItem instanceof CompItem || rootItem instanceof FootageItem) && !depIds[rootItem.id]) {
      try { rootItem.remove(); } catch (ignoreRoot) {}
    }
  }
}

function removeImportRoots(before, after, existingIds) {
  if (existingIds) {
    removeAllImportedItems(existingIds);
    return;
  }
  var removeCount = after - before;
  var i;
  for (i = 0; i < removeCount; i++) {
    if (app.project.numItems <= before) break;
    try { app.project.item(before + 1).remove(); } catch (ignore) {}
  }
}

function findCompByIdInProject(compId) {
  var i, item;
  for (i = 1; i <= app.project.numItems; i++) {
    item = app.project.item(i);
    if (item instanceof CompItem && item.id === compId) return item;
    if (item instanceof FolderItem) {
      var found = findCompByIdInFolder(item, compId);
      if (found) return found;
    }
  }
  return null;
}

function findCompByIdInFolder(folder, compId) {
  var i, item, found;
  for (i = 1; i <= folder.numItems; i++) {
    item = folder.item(i);
    if (item instanceof CompItem && item.id === compId) return item;
    if (item instanceof FolderItem) {
      found = findCompByIdInFolder(item, compId);
      if (found) return found;
    }
  }
  return null;
}

function importSingleSceneFromAep(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var filePath = cfg.filePath;
    var compName = cfg.compName || cfg.sceneLabel || "";
    var packLabel = cfg.packLabel || "AssetFlow";
    var scenesFolderHint = cfg.scenesFolder || "Scenes";
    if (!filePath) {
      return JSON.stringify({ ok: false, message: "Fayl yo‘li kerak" });
    }

    var file = new File(filePath);
    if (!file.exists) {
      return JSON.stringify({ ok: false, message: "Fayl topilmadi" });
    }

    app.beginUndoGroup("AssetFlow Import Scene");
    var importMode = cfg.importMode || "timeline";
    var destCompId = null;
    var activeBefore = app.project.activeItem;
    if (activeBefore instanceof CompItem) {
      destCompId = activeBefore.id;
    }

    var existingIds = collectProjectItemIds(app.project, {});
    var io = new ImportOptions(file);
    io.importAs = ImportAsType.PROJECT;
    app.project.importFile(io);

    var targetComp = resolveImportedSceneComp(existingIds, cfg);
    if (!targetComp) {
      removeAllImportedItems(existingIds);
      app.endUndoGroup();
      var wanted = compName || cfg.sceneLabel || "sahna";
      return JSON.stringify({
        ok: false,
        message: "Comp topilmadi: " + wanted + " (pack ichidagi comp nomi mos emas)"
      });
    }

    var resolvedName = targetComp.name;
    var targetId = targetComp.id;
    var pruneToScene = cfg.pruneToScene === true;
    var folderLabel = String(packLabel);
    var keptFolder = folderLabel;
    var movedCount = 0;

    if (pruneToScene) {
      var deps = collectCompDependencies(targetComp, [], {});
      var depIds = buildDepIdMap(deps);
      movedCount = deps.length;
      folderLabel = String(packLabel) + " / " + resolvedName;
      try {
        pruneImportedRoots(existingIds, depIds);
      } catch (ignorePruneAll) {}
      targetComp = findCompByIdInProject(targetId);
      if (!targetComp) {
        removeAllImportedItems(existingIds);
        app.endUndoGroup();
        return JSON.stringify({ ok: false, message: "Comp saqlanmadi: " + resolvedName });
      }
      keptFolder = renameImportRootForComp(targetComp, folderLabel);
    } else {
      keptFolder = renameNewImportRootFolder(existingIds, folderLabel);
      targetComp = findCompByIdInProject(targetId);
      if (!targetComp) {
        removeAllImportedItems(existingIds);
        app.endUndoGroup();
        return JSON.stringify({ ok: false, message: "Comp saqlanmadi: " + resolvedName });
      }
      movedCount = collectAllImportedComps(existingIds).length;
    }

    var timelineResult = { ok: false, reason: "skipped" };
    if (importMode === "project") {
      restoreActiveComp(destCompId);
      try {
        targetComp.openInViewer();
      } catch (ignoreOpen) {}
      timelineResult = { ok: true, reason: "project_only" };
    } else {
      timelineResult = addSceneCompToTimeline(targetComp, destCompId);
    }
    app.endUndoGroup();
    return JSON.stringify({
      ok: true,
      comp: resolvedName,
      folder: keptFolder || folderLabel,
      movedCount: movedCount,
      importMode: importMode,
      fullPack: !pruneToScene,
      addedToTimeline: timelineResult.ok,
      timelineReason: timelineResult.reason || ""
    });
  } catch (e) {
    try { app.endUndoGroup(); } catch (ignore4) {}
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/** Loyihadan yuqori darajadagi papkani nomi bo'yicha o'chiradi (ichidagi comp/footage bilan) */
function removeProjectFolderByName(name) {
  for (var i = app.project.numItems; i >= 1; i--) {
    var item = app.project.item(i);
    if (item instanceof FolderItem && item.name === name) {
      item.remove();
      return true;
    }
  }
  return false;
}

/** Comp'ni aniq nomi bo'yicha o'chiradi — layer nusxalari boshqa comp'lardan avtomatik o'chadi */
function removeCompByExactName(name) {
  var removed = 0;
  for (var i = app.project.numItems; i >= 1; i--) {
    var item = app.project.item(i);
    if (item instanceof CompItem && item.name === name) {
      item.remove();
      removed++;
    }
  }
  return removed;
}

/**
 * Yuklab olingan shablonni loyihadan olib tashlaydi.
 * cfg = { folders: [...nom], comps: [...nom] }
 * Avval papkalar (ichidagi hamma narsa bilan), keyin qolgan comp'lar nomi bo'yicha.
 * Comp o'chirilganda uning layer nusxalari foydalanuvchi comp'idan ham yo'qoladi.
 */
function removeImportedTemplate(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr || "{}");
    var folders = cfg.folders || [];
    var comps = cfg.comps || [];
    app.beginUndoGroup("AssetFlow Remove Template");
    var removed = 0;
    var i;
    for (i = 0; i < folders.length; i++) {
      if (folders[i] && removeProjectFolderByName(String(folders[i]))) removed++;
    }
    for (i = 0; i < comps.length; i++) {
      if (comps[i]) removed += removeCompByExactName(String(comps[i]));
    }
    app.endUndoGroup();
    return JSON.stringify({ ok: true, removed: removed });
  } catch (e) {
    try { app.endUndoGroup(); } catch (ignoreRm) {}
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/** Foydalanuvchidan yuklab olish papkasini so'raydi */
function pickDownloadFolder() {
  try {
    var f = Folder.selectDialog("AssetFlow — yuklab olingan shablonlar saqlanadigan papka");
    if (f) return JSON.stringify({ ok: true, path: f.fsName });
    return JSON.stringify({ ok: false, canceled: true });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/**
 * Loyihani avtomatik saqlaydi (CMD+S shart bo'lmasin).
 * cfg = { path } — loyiha fayli yo'q bo'lsa shu yo'lga saqlaydi.
 */
function ensureProjectSaved(jsonStr) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha ochiq emas" });
    var cfg = {};
    try { cfg = JSON.parse(jsonStr || "{}"); } catch (e) {}
    if (app.project.file) {
      // Mavjud faylga saqlaymiz (o'zgarishlarni flush qiladi)
      app.project.save();
      return JSON.stringify({ ok: true, saved: true, projectFile: app.project.file.fsName });
    }
    if (cfg.path) {
      var nf = new File(cfg.path);
      app.project.save(nf);
      return JSON.stringify({ ok: true, saved: true, projectFile: app.project.file.fsName });
    }
    return JSON.stringify({ ok: false, message: "Loyiha fayli yo'q — qo'lda CMD+S bosing" });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

function midFrameTime(comp) {
  var t = comp.duration * 0.5;
  var maxT = Math.max(0, comp.duration - comp.frameDuration);
  if (t > maxT) t = maxT;
  if (t < 0) t = 0;
  return t;
}

/**
 * Publish: tanlangan papkadagi (yoki berilgan nomdagi) har comp'ning o'rta
 * kadrini PNG qilib saqlaydi. Subscriber panelda sahna preview rasmi sifatida
 * ishlatiladi. cfg: { exportRoot, scenesFolder?, compNames?[] }
 */
function renderSceneStillFrames(jsonStr) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, error: "no_project" });
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    if (!exportRoot) return JSON.stringify({ ok: false, message: "exportRoot kerak" });

    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    var comps = [];
    var i, child;
    var scenesFolder = cfg.scenesFolder ? findFolderByPath(cfg.scenesFolder) : null;
    if (scenesFolder) {
      for (i = 1; i <= scenesFolder.numItems; i++) {
        child = scenesFolder.item(i);
        if (child instanceof CompItem) comps.push(child);
      }
    } else if (cfg.compNames && cfg.compNames.length) {
      var c, fc;
      for (c = 0; c < cfg.compNames.length; c++) {
        fc = findCompByName(cfg.compNames[c]);
        if (fc) comps.push(fc);
      }
    }

    if (!comps.length) {
      return JSON.stringify({ ok: false, message: "Sahna comp topilmadi" });
    }

    // Sahna raqami bo'yicha tartiblash (Scene_01, Scene_02 ...)
    var s, j, tmp;
    for (s = 0; s < comps.length - 1; s++) {
      for (j = s + 1; j < comps.length; j++) {
        if (sceneNumber(comps[s].name) > sceneNumber(comps[j].name)) {
          tmp = comps[s]; comps[s] = comps[j]; comps[j] = tmp;
        }
      }
    }

    var results = [];
    var k, comp, t, outFile, ok, errMsg;
    for (k = 0; k < comps.length; k++) {
      comp = comps[k];
      t = midFrameTime(comp);
      outFile = new File(exportRoot + "/" + sanitizeFileName(comp.name) + ".png");
      ok = false;
      errMsg = "";
      try {
        // Viewer'da ochish (saveFrameToPng uchun zarur)
        comp.openInViewer();
        // Composition viewer'ning render tugashini kutish
        app.purge(PurgeTarget.SNAPSHOT_CACHES);
      } catch (eView) {}
      try {
        comp.saveFrameToPng(t, outFile);
        ok = outFile.exists;
      } catch (eFrame) {
        errMsg = eFrame.toString();
        ok = false;
      }
      results.push({
        name: comp.name,
        aeComp: comp.name,
        path: ok ? outFile.fsName : "",
        ok: ok,
        error: errMsg,
        width: comp.width,
        height: comp.height,
        fps: Math.round(comp.frameRate * 100) / 100,
        durationSec: Math.round(comp.duration * 100) / 100,
        midSec: Math.round(t * 100) / 100
      });
    }

    return JSON.stringify({ ok: true, results: results, exportRoot: exportRoot });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

/**
 * Admin: har sahna uchun thumbnail PNG + preview video render (AE Render Queue orqali).
 * saveFrameToPng dan ko'ra ishonchli — render queue AE'ning to'liq renderer'ini ishlatadi.
 * cfg: { scenesFolder, exportRoot, previewDuration (soniya, default 6) }
 */
function adminRenderScenePreviews(jsonStr) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, error: "no_project" });
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    if (!exportRoot) return JSON.stringify({ ok: false, message: "exportRoot kerak" });
    var previewDur = (typeof cfg.previewDuration === "number") ? cfg.previewDuration : 6;

    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    var scenesFolder = cfg.scenesFolder ? findFolderByPath(cfg.scenesFolder) : null;
    if (!scenesFolder) return JSON.stringify({ ok: false, message: "02.Scene papkasi topilmadi" });

    var comps = [];
    var i, child;
    for (i = 1; i <= scenesFolder.numItems; i++) {
      child = scenesFolder.item(i);
      if (child instanceof CompItem) comps.push(child);
    }
    if (!comps.length) return JSON.stringify({ ok: false, message: "Sahna comp topilmadi" });

    /* Raqam bo'yicha tartiblash */
    var s, j, tmp;
    for (s = 0; s < comps.length - 1; s++) {
      for (j = s + 1; j < comps.length; j++) {
        if (sceneNumber(comps[s].name) > sceneNumber(comps[j].name)) {
          tmp = comps[s]; comps[s] = comps[j]; comps[j] = tmp;
        }
      }
    }

    var rq = app.project.renderQueue;
    var rqPending = []; /* { rqItem, comp, type, baseName } */
    var k, comp, rqItem, om, baseName;

    var imgTemplates = ["PNG Sequence", "TIFF Sequence", "Photoshop Sequence", "IFF Sequence"];
    var vidTemplates = [
      "Apple ProRes 422 LT", "Apple ProRes 422", "Apple ProRes 4444",
      "Animation", "QuickTime"
    ];

    for (k = 0; k < comps.length; k++) {
      comp = comps[k];
      baseName = sanitizeFileName(comp.name);

      /* --- Thumbnail: o'rta kadr, 1 frame --- */
      var midT = midFrameTime(comp);
      try {
        rqItem = rq.items.add(comp);
        rqItem.timeSpanStart = midT;
        rqItem.timeSpanDuration = comp.frameDuration;
        om = rqItem.outputModule(1);
        var imgOk = false;
        var ti;
        for (ti = 0; ti < imgTemplates.length && !imgOk; ti++) {
          try { om.applyTemplate(imgTemplates[ti]); imgOk = true; } catch(e1) {}
        }
        om.file = new File(exportRoot + "/" + baseName + "_thumb_[####].png");
        rqPending.push({ rqItem: rqItem, comp: comp, type: "thumb", baseName: baseName });
      } catch(eThumb) {
        rqPending.push({ rqItem: null, comp: comp, type: "thumb", baseName: baseName });
      }

      /* --- Video: birinchi previewDur soniya, ProRes --- */
      var vidDur = Math.min(comp.duration, previewDur);
      try {
        rqItem = rq.items.add(comp);
        rqItem.timeSpanStart = 0;
        rqItem.timeSpanDuration = vidDur;
        om = rqItem.outputModule(1);
        var vidOk = false;
        var vi;
        for (vi = 0; vi < vidTemplates.length && !vidOk; vi++) {
          try { om.applyTemplate(vidTemplates[vi]); vidOk = true; } catch(e2) {}
        }
        om.file = new File(exportRoot + "/" + baseName + "_preview.mov");
        rqPending.push({ rqItem: rqItem, comp: comp, type: "video", baseName: baseName,
                         outPath: exportRoot + "/" + baseName + "_preview.mov" });
      } catch(eVid) {
        rqPending.push({ rqItem: null, comp: comp, type: "video", baseName: baseName,
                         outPath: exportRoot + "/" + baseName + "_preview.mov" });
      }
    }

    /* Hammasini render qilamiz */
    try { rq.render(); } catch(eRender) {}

    /* Render Queue tozalash */
    var ri;
    for (ri = rqPending.length - 1; ri >= 0; ri--) {
      if (rqPending[ri].rqItem) {
        try { rqPending[ri].rqItem.remove(); } catch(e) {}
      }
    }

    /* Natijalarni yig'amiz */
    var results = [];
    for (k = 0; k < comps.length; k++) {
      comp = comps[k];
      baseName = sanitizeFileName(comp.name);

      /* Thumbnail fayli (PNG Sequence raqam qo'shadi: baseName_thumb_0001.png) */
      var thumbPath = "";
      var thumbOk = false;
      var tDir = new Folder(exportRoot);
      var tFiles = tDir.getFiles(baseName + "_thumb_*.png");
      if (!tFiles || !tFiles.length) tFiles = tDir.getFiles(baseName + "_thumb_*.tif");
      if (!tFiles || !tFiles.length) tFiles = tDir.getFiles(baseName + "_thumb_*.psd");
      if (tFiles && tFiles.length) {
        thumbPath = tFiles[0].fsName;
        thumbOk = true;
      }

      /* Video fayli */
      var videoPath = exportRoot + "/" + baseName + "_preview.mov";
      var vf = new File(videoPath);
      var videoOk = vf.exists;
      if (!videoOk) videoPath = "";

      results.push({
        name: comp.name,
        aeComp: comp.name,
        thumbPath: thumbPath,
        thumbOk: thumbOk,
        videoPath: videoPath,
        videoOk: videoOk,
        width: comp.width,
        height: comp.height,
        fps: Math.round(comp.frameRate * 100) / 100,
        durationSec: Math.round(comp.duration * 100) / 100,
        previewDur: Math.min(comp.duration, previewDur)
      });
    }

    return JSON.stringify({ ok: true, results: results, exportRoot: exportRoot });
  } catch(e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

/**
 * Bitta sahnani render qiladi (thumbnail PNG + ProRes video).
 * cfg = { compName, exportRoot, previewDuration }
 */
function adminRenderOneScene(jsonStr) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha yo'q" });
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    var compName = cfg.compName;
    if (!exportRoot || !compName) return JSON.stringify({ ok: false, message: "compName/exportRoot kerak" });
    var previewDur = (typeof cfg.previewDuration === "number") ? cfg.previewDuration : 6;

    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    var comp = findCompByName(compName);
    if (!comp) return JSON.stringify({ ok: false, message: "Comp topilmadi: " + compName });

    var baseName = sanitizeFileName(comp.name);
    var rq = app.project.renderQueue;
    var imgTemplates = ["PNG Sequence", "TIFF Sequence", "Photoshop Sequence", "IFF Sequence"];
    var pending = [];
    var pi;

    /* Thumbnail — o'rta kadr */
    try {
      var rqT = rq.items.add(comp);
      rqT.timeSpanStart = midFrameTime(comp);
      rqT.timeSpanDuration = comp.frameDuration;
      var omT = rqT.outputModule(1);
      var ti, imgOk = false;
      for (ti = 0; ti < imgTemplates.length && !imgOk; ti++) {
        try { omT.applyTemplate(imgTemplates[ti]); imgOk = true; } catch(e1) {}
      }
      omT.file = new File(exportRoot + "/" + baseName + "_thumb_[####].png");
      pending.push(rqT);
    } catch(eT) {}

    /* Video — birinchi previewDur soniya. Faqat "Admin Preview" preset. */
    var usedTemplate = "";
    try {
      var rqV = rq.items.add(comp);
      rqV.timeSpanStart = 0;
      rqV.timeSpanDuration = Math.min(comp.duration, previewDur);
      var omV = rqV.outputModule(1);
      var vidOk = false;
      try { omV.applyTemplate("Admin Preview"); vidOk = true; usedTemplate = "Admin Preview"; } catch(eAP) {}
      if (!vidOk) {
        for (pi = pending.length - 1; pi >= 0; pi--) { try { pending[pi].remove(); } catch(eRm) {} }
        return JSON.stringify({
          ok: false,
          message: "Admin Preview preset topilmadi. AE: Edit → Templates → Output Module → Admin Preview yarating."
        });
      }
      omV.file = new File(exportRoot + "/" + baseName + "_preview.mp4");
      pending.push(rqV);
    } catch(eV) {
      return JSON.stringify({ ok: false, message: "Video render navbati: " + eV.toString() });
    }

    try { rq.render(); } catch(eR) {}
    for (pi = pending.length - 1; pi >= 0; pi--) {
      try { pending[pi].remove(); } catch(e) {}
    }

    /* Natija */
    var tDir = new Folder(exportRoot);
    var tFiles = tDir.getFiles(baseName + "_thumb_*.png");
    var thumbPath = (tFiles && tFiles.length) ? tFiles[0].fsName : "";
    // Preview faylni kengaytmadan qat'i nazar topamiz (mp4/mov/...)
    var vPattern = baseName + "_preview";
    var vMatches = tDir.getFiles(function (f) {
      return (f instanceof File) && f.name.indexOf(vPattern) === 0;
    });
    var videoPath = (vMatches && vMatches.length) ? vMatches[0].fsName : "";
    var vf = videoPath ? new File(videoPath) : null;

    return JSON.stringify({
      ok: true,
      name: comp.name,
      aeComp: comp.name,
      thumbPath: thumbPath,
      thumbOk: !!thumbPath,
      videoPath: (vf && vf.exists) ? videoPath : "",
      videoOk: !!(vf && vf.exists),
      usedTemplate: usedTemplate,
      width: comp.width,
      height: comp.height,
      fps: Math.round(comp.frameRate * 100) / 100,
      durationSec: Math.round(comp.duration * 100) / 100,
      previewDur: Math.min(comp.duration, previewDur)
    });
  } catch(e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

function importAssetToProject(filePath) {
  if (!filePath) return "error: no path";
  var file = new File(filePath);
  if (!file.exists) return "error: file not found";
  try {
    app.beginUndoGroup("AssetFlow Import");
    var ext = file.name.replace(/^.*\./, "").toLowerCase();
    if (ext === "aep") {
      var projectImport = new ImportOptions(file);
      projectImport.importAs = ImportAsType.PROJECT;
      app.project.importFile(projectImport);
      app.endUndoGroup();
      return "ok:aep";
    }
    var io = new ImportOptions(file);
    var item = app.project.importFile(io);
    app.endUndoGroup();
    return item ? "ok:" + item.name : "ok:imported";
  } catch (e) {
    try { app.endUndoGroup(); } catch (ignore) {}
    return "error:" + e.toString();
  }
}

function importSceneCompToProject(compName) {
  if (!compName) return "error: no comp";
  try {
    var i, item;
    for (i = 1; i <= app.project.numItems; i++) {
      item = app.project.item(i);
      if (item instanceof CompItem && item.name === compName) {
        item.openInViewer();
        return "ok:open:" + compName;
      }
    }
    for (i = 1; i <= app.project.numItems; i++) {
      item = app.project.item(i);
      if (!(item instanceof FolderItem)) continue;
      var j, child;
      for (j = 1; j <= item.numItems; j++) {
        child = item.item(j);
        if (child instanceof CompItem && child.name === compName) {
          child.openInViewer();
          return "ok:open:" + compName;
        }
      }
    }
    return "error: comp not found";
  } catch (e) {
    return "error:" + e.toString();
  }
}

function importSceneToProject(sceneName) {
  return importSceneCompToProject(sceneName);
}

function openProjectFile(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var filePath = cfg.filePath;
    if (!filePath) {
      return JSON.stringify({ ok: false, message: "Project yo‘li kerak" });
    }
    var f = new File(filePath);
    if (!f.exists) {
      return JSON.stringify({
        ok: false,
        error: "not_found",
        message: "Fayl topilmadi: " + filePath
      });
    }
    var target = f.fsName;
    if (app.project && app.project.file && app.project.file.fsName === target) {
      return JSON.stringify({
        ok: true,
        alreadyOpen: true,
        projectFile: target,
        projectName: app.project.file.displayName.replace(/\.aep$/i, "")
      });
    }
    // forceOpen: joriy ochiq loyihani yopib (saqlamasdan) yangisini ochish.
    // Bu "Save changes?" dialogini oldini oladi va CEP bloklanmaydi.
    if (cfg.forceOpen && app.project) {
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch(ignoreClose) {}
    }

    app.open(f);
    // AE oynasini oldinga chiqarish
    try { app.activate(); } catch(ignoreActivate) {}

    if (!app.project || !app.project.file) {
      return JSON.stringify({
        ok: false,
        message: "Project ochildi, lekin fayl aniqlanmadi"
      });
    }
    return JSON.stringify({
      ok: true,
      alreadyOpen: false,
      projectFile: app.project.file.fsName,
      projectName: app.project.file.displayName.replace(/\.aep$/i, "")
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

/** CEP evalScript timeout — app.open() uzoq bloklaydi; navbat orqali ochamiz */
var __afOpenQueue = null;

function runQueuedOpenProject() {
  var cfg = __afOpenQueue;
  __afOpenQueue = null;
  if (!cfg || !cfg.filePath) return;
  try {
    var f = new File(cfg.filePath);
    if (!f.exists) return;
    var target = f.fsName;
    if (app.project && app.project.file && app.project.file.fsName === target) {
      __afOpenState = { state: "done", path: target, file: target, name: app.project.file.displayName.replace(/\.aep$/i, ""), err: "" };
      return;
    }
    if (cfg.forceOpen && app.project) {
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (ignoreClose) {}
    }
    __afOpenState = { state: "pending", path: target, file: "", name: "", err: "" };
    app.beginSuppressDialogs();
    try {
      app.open(f);
    } finally {
      app.endSuppressDialogs(false);
    }
    try { app.activate(); } catch (ignoreActivate) {}
    if (app.project && app.project.file) {
      __afOpenState = { state: "done", path: target, file: app.project.file.fsName, name: app.project.file.displayName.replace(/\.aep$/i, ""), err: "" };
    } else {
      __afOpenState = { state: "done", path: target, file: target, name: f.displayName.replace(/\.aep$/i, ""), err: "" };
    }
  } catch (e) {
    __afOpenState = { state: "error", path: (cfg && cfg.filePath) || "", file: "", name: "", err: e.toString() };
  }
}

function queueOpenProjectFile(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr || "{}");
    var filePath = cfg.filePath;
    if (!filePath) {
      return JSON.stringify({ ok: false, message: "Project yo‘li kerak" });
    }
    var f = new File(filePath);
    if (!f.exists) {
      return JSON.stringify({
        ok: false,
        message: "Fayl topilmadi: " + filePath
      });
    }
    var target = f.fsName;
    if (app.project && app.project.file && app.project.file.fsName === target) {
      return JSON.stringify({
        ok: true,
        alreadyOpen: true,
        projectFile: target,
        projectName: app.project.file.displayName.replace(/\.aep$/i, "")
      });
    }
    __afOpenQueue = cfg;
    var scheduled = false;
    try {
      app.scheduleTask("runQueuedOpenProject()", 100, false);
      scheduled = true;
    } catch (ignoreSched) {}
    if (!scheduled) {
      runQueuedOpenProject();
      return JSON.stringify({
        ok: true,
        openedSync: true,
        filePath: target,
        projectFile: __afOpenState.file || target,
        projectName: __afOpenState.name || f.displayName.replace(/\.aep$/i, "")
      });
    }
    return JSON.stringify({ ok: true, queued: true, filePath: target });
  } catch (e) {
    return JSON.stringify({ ok: false, error: "exception", message: e.toString() });
  }
}

/** CEP panel — bitta string argument; TO'G'RIDAN ochadi (scheduleTask emas).
 *  app.open bloklasa ham, dialoglar suppress qilinadi va natija qaytadi. */
// Loyiha ochish holati — nobloklash (deferred) open uchun
var __afOpenState = { state: "idle", path: "", file: "", name: "", err: "" };

// Haqiqiy ochish — app.scheduleTask orqali idle tick'da chaqiriladi.
// Shu tufayli evalScript darhol qaytadi va panel muzlamaydi.
function __afOpenRun() {
  try {
    var p = __afOpenState.path;
    if (!p) { __afOpenState.state = "error"; __afOpenState.err = "Yo‘l yo‘q"; return; }
    var f = new File(p);
    if (!f.exists) { __afOpenState.state = "error"; __afOpenState.err = "Fayl topilmadi"; return; }
    if (app.project && app.project.file && app.project.file.fsName === f.fsName) {
      __afOpenState.state = "done";
      __afOpenState.file = app.project.file.fsName;
      __afOpenState.name = app.project.file.displayName.replace(/\.aep$/i, "");
      return;
    }
    // Joriy loyihani saqlamasdan yopamiz — "Save changes?" dialogini oldini oladi
    try { if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e1) {}
    try { app.beginSuppressDialogs(); } catch (e2) {}
    try { app.open(f); } finally { try { app.endSuppressDialogs(false); } catch (e3) {} }
    try { app.activate(); } catch (e4) {}
    if (app.project && app.project.file) {
      __afOpenState.state = "done";
      __afOpenState.file = app.project.file.fsName;
      __afOpenState.name = app.project.file.displayName.replace(/\.aep$/i, "");
    } else {
      __afOpenState.state = "done";
      __afOpenState.file = f.fsName;
      __afOpenState.name = f.displayName.replace(/\.aep$/i, "");
    }
  } catch (e) {
    __afOpenState.state = "error";
    __afOpenState.err = e.toString();
  }
}

function afQueueOpen(pathStr, forceOpen) {
  // Eski API — ichida ishonchli queueOpenProjectFile ishlatiladi
  return queueOpenProjectFile(JSON.stringify({
    filePath: String(pathStr || ""),
    forceOpen: (forceOpen === true || forceOpen === "true")
  }));
}

// Joriy loyihani saqlamasdan yopadi — yangi loyiha ochishdan oldin "Save changes?" ni oldini oladi
function afCloseCurrent() {
  try {
    if (app.project) {
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e1) {}
    }
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

// scheduleTask ishlamasa — sinxron zaxira (dialoglar suppress qilinadi, tez bajariladi)
function afOpenNow() {
  __afOpenRun();
  return afOpenStatus();
}

// Deferred open holatini qaytaradi (panel poll qiladi)
function afOpenStatus() {
  return JSON.stringify({
    ok: true,
    state: __afOpenState.state,
    projectFile: __afOpenState.file,
    projectName: __afOpenState.name,
    message: __afOpenState.err || undefined
  });
}

function afEnsureSaved(pathStr) {
  return ensureProjectSaved(JSON.stringify({ path: String(pathStr || "") }));
}

/** YENGIL: faqat folderlar ro'yxati (og'ir tree YO'Q — evalScript bo'sh qaytarmaydi).
 *  Har folder uchun id, nom va comp soni. */
function afListFolders() {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha yo'q" });
    var out = [];
    var i, item, j, cc;
    for (i = 1; i <= app.project.numItems; i++) {
      item = app.project.item(i);
      if (item instanceof FolderItem) {
        cc = 0;
        for (j = 1; j <= item.numItems; j++) {
          if (item.item(j) instanceof CompItem) cc++;
        }
        out.push({ id: item.id, name: item.name, comps: cc });
      }
    }
    var pn = "Untitled";
    try { if (app.project.file) pn = app.project.file.displayName.replace(/\.aep$/i, ""); } catch (e) {}
    return JSON.stringify({ ok: true, folders: out, projectName: pn });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/** Berilgan folder ID dagi comp'lar (id orqali — nom takrorlanishidan himoya) */
function afCompsInFolder(folderId) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha yo'q" });
    var fid = parseInt(folderId, 10);
    var folder = null, i, it;
    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (it instanceof FolderItem && it.id === fid) { folder = it; break; }
    }
    if (!folder) return JSON.stringify({ ok: false, message: "Folder topilmadi" });
    var comps = [], j, c;
    for (j = 1; j <= folder.numItems; j++) {
      c = folder.item(j);
      if (c instanceof CompItem) {
        comps.push({
          name: c.name,
          width: c.width, height: c.height,
          fps: Math.round(c.frameRate * 100) / 100,
          durationSec: Math.round(c.duration * 100) / 100
        });
      }
    }
    return JSON.stringify({ ok: true, comps: comps });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/** Loyiha ochilgach asosiy compni viewer'da ochadi — admin AE da ko'rishi uchun.
 *  app.open() faqat loyihani yuklaydi, comp viewerda ko'rinmaydi; shuni tuzatadi. */
function afShowMainComp() {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha yo'q" });
    var i, item, target = null;
    // 1) "RENDER" / "FINAL RENDER" nomli comp (eng asosiy)
    for (i = 1; i <= app.project.numItems; i++) {
      item = app.project.item(i);
      if (item instanceof CompItem && isFinalRenderName(item.name)) { target = item; break; }
    }
    // 2) Bo'lmasa — eng uzun (asosiy) comp
    if (!target) {
      var maxDur = -1;
      for (i = 1; i <= app.project.numItems; i++) {
        item = app.project.item(i);
        if (item instanceof CompItem && item.duration > maxDur) { maxDur = item.duration; target = item; }
      }
    }
    if (!target) return JSON.stringify({ ok: false, message: "Comp topilmadi" });
    try { target.selected = true; } catch (eSel) {}
    try { target.openInViewer(); } catch (eOpen) {}
    try { app.activate(); } catch (eAct) {}
    return JSON.stringify({ ok: true, comp: target.name });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/** AE project panelda sahna comp'ni ochib/tanlab ko'rsatadi (Admin "Sahnalarni topish") */
function adminOpenSceneComp(compName) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha yo'q" });
    var comp = findCompByName(String(compName || ""));
    if (!comp) return JSON.stringify({ ok: false, message: "Comp topilmadi: " + compName });
    try { comp.selected = true; } catch (eSel) {}
    try { comp.openInViewer(); } catch (eOpen) {}
    try { app.activate(); } catch (eAct) {}
    return JSON.stringify({ ok: true, name: comp.name });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/** Berilgan papkadagi sahna comp'larini sanab beradi (qo'lda tanlangan Scene folder) */
function adminListScenesInFolder(jsonStr) {
  try {
    if (!app.project) return JSON.stringify({ ok: false, message: "Loyiha yo'q" });
    var cfg = {};
    try { cfg = JSON.parse(jsonStr || "{}"); } catch (e) {}
    var wantFolder = String(cfg.folder || "");
    var tree = collectProjectTree(app.project, "", 0);
    var out = [];
    var i;
    for (i = 0; i < tree.length; i++) {
      var n = tree[i];
      if (n.type !== "comp") continue;
      if (wantFolder && n.folder !== wantFolder) continue;
      out.push(n);
    }
    // Birinchi comp'ni AE da ochib ko'rsatamiz
    if (out.length) {
      var first = findCompByName(out[0].name);
      if (first) { try { first.openInViewer(); } catch (eO) {} }
    }
    return JSON.stringify({ ok: true, scenes: out, count: out.length });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}
