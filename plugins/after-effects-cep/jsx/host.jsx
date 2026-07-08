if (!String.prototype.trim) {
  String.prototype.trim = function () {
    return String(this).replace(/^\s+/, "").replace(/\s+$/, "");
  };
}

// ── FAZA 4: yetishmagan shrift aniqlash (ES3-safe) ──────────────────────────
// Import'dan keyin text layerlar qaysi shriftni so'raganini o'qib, o'rnatilmagan
// (missing/substituted) shriftlarni yig'amiz. AE 2024+ (FontsObject `app.fonts`)
// bo'lsa aniq ishlaydi; eski AE'da app.fonts yo'q → hech qanday yolg'on
// "missing" bermaymiz (hasApi=false). ES5-only metodlardan (forEach, Array.*)
// qochamiz — faqat oddiy for/while ishlatamiz.
function af_fontKey(s) {
  return String(s == null ? "" : s).replace(/^\s+/, "").replace(/\s+$/, "").toLowerCase();
}

// O'rnatilgan shriftlar lug'ati (postScript + family, kichik harf). Substitute
// (missing font o'rnini bosuvchi) yozuvlarni CHIQARIB tashlaymiz — aks holda
// yetishmagan shrift "o'rnatilgan" ko'rinib, aniqlanmay qolardi.
function af_installedFontLookup() {
  var lk = { ps: {}, fam: {}, hasApi: false };
  try {
    if (typeof app !== "undefined" && app.fonts && app.fonts.allFonts) {
      var all = app.fonts.allFonts;
      lk.hasApi = true;
      for (var i = 0; i < all.length; i++) {
        var fo = all[i];
        var isSub = false;
        try { isSub = (fo.isSubstitute === true); } catch (eSub) {}
        if (isSub) continue;
        try { if (fo.postScriptName) lk.ps[af_fontKey(fo.postScriptName)] = true; } catch (e1) {}
        try { if (fo.familyName) lk.fam[af_fontKey(fo.familyName)] = true; } catch (e2) {}
      }
    }
  } catch (e) {}
  return lk;
}

// Bitta text layer'ning TextDocument'idan shrift nomlarini o'qiydi.
// Missing font'da AE `.font`'da ASL (so'ralgan) PostScript nomini saqlaydi —
// aynan shuni o'rnatilganlar ro'yxati bilan solishtiramiz.
function af_textDocFont(layer) {
  try {
    var prop = layer.property("ADBE Text Properties");
    if (!prop) return null;
    var doc = prop.property("ADBE Text Document");
    if (!doc) return null;
    var td = doc.value;
    if (!td) return null;
    var ps = "", fam = "", style = "";
    try { ps = td.font ? String(td.font) : ""; } catch (e1) {}
    try { fam = td.fontFamily ? String(td.fontFamily) : ""; } catch (e2) {}
    try { style = td.fontStyle ? String(td.fontStyle) : ""; } catch (e3) {}
    return { ps: ps, family: fam, style: style };
  } catch (e) { return null; }
}

// Comp(lar) ro'yxatidagi text layerlarni aylanib, o'rnatilmagan shriftlarni
// yig'adi. `comps` — CompItem yoki {comp:CompItem} yozuvlari aralash bo'lishi
// mumkin (collectAllImportedComps / collectCompDependencies ikkalasi ham beriladi).
// Natija: [{ family, postScript, style }] — postScript/family bo'yicha takrorsiz.
function af_missingFontsForComps(comps) {
  var out = [];
  var seen = {};
  var lk = af_installedFontLookup();
  if (!lk.hasApi) return out;
  if (!comps || comps.length == null) return out;
  for (var i = 0; i < comps.length; i++) {
    var comp = (comps[i] && comps[i].comp) ? comps[i].comp : comps[i];
    if (!comp) continue;
    var isComp = false;
    try { isComp = (comp instanceof CompItem); } catch (eC) { isComp = false; }
    if (!isComp) continue;
    var n = 0;
    try { n = comp.numLayers; } catch (eNum) { n = 0; }
    for (var j = 1; j <= n; j++) {
      var L = null;
      try { L = comp.layer(j); } catch (eL) { L = null; }
      if (!L) continue;
      var isText = false;
      try { isText = (L instanceof TextLayer); } catch (eT) { isText = false; }
      if (!isText) continue;
      var f = af_textDocFont(L);
      if (!f) continue;
      var psKey = af_fontKey(f.ps);
      var famKey = af_fontKey(f.family);
      if (!psKey && !famKey) continue;
      // O'rnatilgan bo'lsa (postScript YOKI family topilsa) — o'tkazamiz.
      if (psKey && lk.ps[psKey]) continue;
      if (famKey && lk.fam[famKey]) continue;
      var dedupe = psKey || famKey;
      if (seen[dedupe]) continue;
      seen[dedupe] = true;
      out.push({ family: f.family || f.ps, postScript: f.ps, style: f.style });
    }
  }
  return out;
}

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
  var current = null; // null = project root level
  var i, j, item, part, candidate;
  for (i = 0; i < parts.length; i++) {
    part = parts[i];
    item = null;
    if (current === null) {
      // Root level: app.project.item() iterates ALL project items (not root-only),
      // so we must filter by parentFolder == null to avoid matching nested folders
      // with the same name as a root-level folder.
      for (j = 1; j <= app.project.numItems; j++) {
        candidate = app.project.item(j);
        if (isProjectFolder(candidate) && candidate.name === part && candidate.parentFolder == null) {
          item = candidate;
          break;
        }
      }
    } else {
      // Nested level: FolderItem.item() returns direct children only
      for (j = 1; j <= current.numItems; j++) {
        candidate = current.item(j);
        if (isProjectFolder(candidate) && candidate.name === part) {
          item = candidate;
          break;
        }
      }
    }
    if (!item) return null;
    current = item;
  }
  return current && isProjectFolder(current) ? current : null;
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
        message: "Save the project first (File → Save)"
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
        message: "Select at least one folder"
      });
    }

    var scenesFolder = findFolderByPath(scenesPath);
    var renderFolder = findFolderByPath(renderPath);
    var previewFolder = findFolderByPath(previewPath);

    if (scenesPath && !scenesFolder) {
      return JSON.stringify({ ok: false, error: "not_found", message: "Scenes folder not found" });
    }
    if (renderPath && !renderFolder) {
      return JSON.stringify({ ok: false, error: "not_found", message: "Final Render folder not found" });
    }
    if (previewPath && !previewFolder) {
      return JSON.stringify({ ok: false, error: "not_found", message: "Preview folder not found" });
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
        message: "No comps found in the selected folders"
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
        message: "Save the project first (File → Save)"
      });
    }

    var comps = collectAllComps(app.project, "");
    if (!comps.length) {
      return JSON.stringify({
        ok: false,
        error: "no_comps",
        message: "No compositions found in the project"
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
        message: "Save the project first (File → Save)"
      });
    }

    var scenesFolder = findScenesFolder();
    var scenes = scenesFolder ? collectScenesFromFolder(scenesFolder) : collectScenesFromRoot();
    var finalRender = findFinalRenderComp();

    if (!scenes.length && !finalRender) {
      return JSON.stringify({
        ok: false,
        error: "not_found",
        message: "RENDER or Scenes folder not found"
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
    var startIdx = -1;
    for (j = 0; j < markers.length; j++) {
      if (markers[j].num === num) {
        startMarker = markers[j];
        startIdx = j;
        break;
      }
    }
    if (!startMarker) continue;

    start = startMarker.time;
    // End = next marker's start time in sorted order, not first marker after start.
    // Avoids floating-point threshold errors and wrong matches across out-of-order scenes.
    end = (startIdx >= 0 && startIdx + 1 < markers.length)
      ? markers[startIdx + 1].time
      : comp.duration;

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
      return JSON.stringify({ ok: false, message: "Preview comp not found" });
    }

    var sceneNames = cfg.sceneNames || [];
    if (!sceneNames.length) {
      return JSON.stringify({ ok: false, message: "Scene list is empty" });
    }

    comp.openInViewer();
    clearSceneMarkers(comp);

    var count = sceneNames.length;
    var dur = comp.duration;
    var i, t, mv;

    // Build per-scene durations from matching comp items if available,
    // falling back to equal spacing. This prevents markers from landing at
    // wrong boundaries when scenes have unequal durations.
    var sceneDurations = [];
    var totalFound = 0;
    var scenesFolder = cfg.scenesFolder ? findFolderByPath(cfg.scenesFolder) : null;
    for (i = 0; i < count; i++) {
      var matchComp = null;
      if (scenesFolder) {
        var k;
        for (k = 1; k <= scenesFolder.numItems; k++) {
          var candidate2 = scenesFolder.item(k);
          if (candidate2 instanceof CompItem && candidate2.name === sceneNames[i]) {
            matchComp = candidate2;
            break;
          }
        }
      }
      var d = matchComp ? matchComp.duration : 0;
      sceneDurations.push(d);
      totalFound += d;
    }

    // If all durations found and they fit within comp, use them; else equal spacing
    var useActual = totalFound > 0 && totalFound <= dur + 0.01;
    t = 0;
    for (i = 0; i < count; i++) {
      mv = new MarkerValue("Scene_" + padSceneNum(i + 1));
      mv.label = (i % 16) + 1;
      comp.markerProperty.setValueAtTime(roundSec(t), mv);
      t += useActual ? sceneDurations[i] : (dur / count);
    }

    return JSON.stringify({
      ok: true,
      previewComp: comp.name,
      markerCount: count,
      durationSec: roundSec(dur),
      usedActualDurations: useActual
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
      return JSON.stringify({ ok: false, message: "Preview comp not found" });
    }

    var segments = readPreviewMarkerSegments(comp, sceneNames);
    if (segments.length < sceneNames.length) {
      return JSON.stringify({
        ok: false,
        message: "Not enough markers — run «Create markers» and position them (" + segments.length + "/" + sceneNames.length + ")"
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
          error: existing ? "" : "Render did not finish"
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
            error: "Comp not found"
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
          error: existing ? "" : "Render did not finish — check the Output Module"
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

// ── Avto-masshtab (Mister Horse "AUTOSCALE" mexanizmi ekvivalenti) ─────────────
// COMPOSER-MECHANISM-ANALYSIS.md §2: import qilingan layer'ni KONTENT chegarasi
// (sourceRectAtTime — shaffof padding hisobga olinmaydi) bo'yicha faol comp
// o'lchamiga sig'diradi. Naiv comp/manba nisbati EMAS — haqiqiy kontent bounds.
// Faqat "ADBE Scale" yoziladi (qaytariladigan, past-xavf); import undo guruhi
// ICHIDA chaqiriladi (bitta Undo hammasini qaytaradi).

// Sof matematik yordamchi (mustaqil test qilingan): kontent→comp fit koeffitsiyenti
// (1 = 100%). mode: "contain" (sukut) | "fill" | "width" | "height". Yaroqsiz kirishda null.
function afComputeFitScale(contentW, contentH, compW, compH, mode) {
  if (!contentW || !contentH || !compW || !compH) return null;
  if (!isFinite(contentW) || !isFinite(contentH) || !isFinite(compW) || !isFinite(compH)) return null;
  if (contentW <= 0 || contentH <= 0 || compW <= 0 || compH <= 0) return null;
  var sx = compW / contentW, sy = compH / contentH, s;
  mode = String(mode || "contain");
  if (mode === "fill") s = Math.max(sx, sy);
  else if (mode === "width") s = sx;
  else if (mode === "height") s = sy;
  else s = Math.min(sx, sy); // contain — uzun tomonni sig'diradi, nisbat saqlanadi
  if (!isFinite(s) || s <= 0) return null;
  if (s > 100) s = 100; // 10000% qattiq clamp (patologik kattalashuvdan himoya)
  return s;
}

// Import qilingan layer'ni faol comp'ga masshtablaydi. Undo guruhi CHAQIRUVCHIDA
// ochilgan bo'lishi kerak. Xatoda layer 100% da qoladi — HECH QACHON throw qilmaydi.
// opts: { mode?, recenter?:bool, position?:[x,y] }. true = qo'llandi.
function afScaleLayerToComp(layer, comp, mode, opts) {
  opts = opts || {};
  try {
    if (!layer || !comp) return false;
    var t = comp.time;
    var r = null;
    try { r = layer.sourceRectAtTime(t, false); } catch (eRect) { r = null; }
    var cw, ch, cl, ct, haveRect = false;
    if (r && r.width > 0 && r.height > 0 && isFinite(r.width) && isFinite(r.height)) {
      cw = r.width; ch = r.height; cl = r.left; ct = r.top; haveRect = true;
    } else {
      // Kontent bounds yo'q — manba frame o'lchamiga qaytamiz (still/precomp)
      var src = null; try { src = layer.source; } catch (eSrc) { src = null; }
      cw = (src && src.width) ? src.width : 0;
      ch = (src && src.height) ? src.height : 0;
      cl = 0; ct = 0;
    }
    if (!cw || !ch) return false; // o'lchab bo'lmadi — 100% da qoldiramiz (graceful skip)
    // OPTIONAL hint: mavjud metadata base-o'lcham/fit rejimi ustun (agar berilgan bo'lsa).
    // TODO(FF): contributor upload size/fit hint shu yerdan opts.mode sifatida keladi.
    var m = opts.mode || mode || "contain";
    var mult = afComputeFitScale(cw, ch, comp.width, comp.height, m);
    if (mult == null) return false;
    var pct = mult * 100;
    if (!isFinite(pct) || pct <= 0) return false;
    var tg = layer.property("ADBE Transform Group");
    if (!tg) return false;
    var scaleProp = tg.property("ADBE Scale");
    if (!scaleProp) return false;
    var cur = null; try { cur = scaleProp.value; } catch (eVal) { cur = null; }
    if (cur && cur.length >= 3) scaleProp.setValue([pct, pct, cur[2]]); // 3D — Z saqlanadi
    else scaleProp.setValue([pct, pct]);
    // Ixtiyoriy kontent-markazlash (partial content uchun; sukut bo'yicha O'CHIQ —
    // to'liq-frame shablonlar AE sukut markazlashida allaqachon markazda; markazlash
    // faqat placeholder joylashda yoki aniq so'ralganda). anchor→kontent-markazi.
    if (opts.recenter === true && haveRect) {
      try {
        tg.property("ADBE Anchor Point").setValue([cl + cw / 2, ct + ch / 2]);
        var px = (opts.position && opts.position.length >= 2) ? opts.position[0] : comp.width / 2;
        var py = (opts.position && opts.position.length >= 2) ? opts.position[1] : comp.height / 2;
        tg.property("ADBE Position").setValue([px, py]);
      } catch (eCenter) {}
    }
    return true;
  } catch (e) {
    return false; // hech qachon throw qilmaymiz — import bloklanmasin
  }
}

// Ommaviy kirish (mustaqil test uchun): faol comp'da TANLANGAN layer(lar)ni fit qiladi.
// cfg: { mode?: "contain"|"fill"|"width"|"height", recenter?: bool }
function afAutoscaleSelection(jsonStr) {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return afFail("No composition open — open the Timeline");
    var sel = comp.selectedLayers;
    if (!sel || !sel.length) return afFail("No layer selected — select a layer to autoscale");
    var cfg = {};
    try { cfg = JSON.parse(jsonStr || "{}"); } catch (eP) { cfg = {}; }
    var mode = cfg.mode || "contain";
    var opts = { recenter: cfg.recenter === true };
    app.beginUndoGroup("FrameFlow Autoscale");
    var applied = 0;
    for (var i = 0; i < sel.length; i++) {
      if (afScaleLayerToComp(sel[i], comp, mode, opts)) applied++;
    }
    app.endUndoGroup();
    return '{"ok":true,"applied":' + applied + ',"selected":' + sel.length + ',"mode":' + afJStr(mode) + '}';
  } catch (e) {
    try { app.endUndoGroup(); } catch (ig) {}
    return afFail("Autoscale error: " + (e && e.toString ? e.toString() : e));
  }
}

// ── Self-tag (Mister Horse "o'z assetini tanish" mexanizmi ekvivalenti) ────────
// COMPOSER-MECHANISM-ANALYSIS.md §5: MH yashirin marker parametri + nom-regex
// ishlatadi. FrameFlow'da oddiy, ko'rinmas belgi: layer comment + marker + rang-
// yorliq. Kelajakda FrameFlow importlarini topish/o'chirish uchun (afIsFrameFlowItem).
var FF_TAG = "FrameFlow";
function afIsFrameFlowItem(layer) {
  try { if (layer && layer.comment && String(layer.comment).indexOf(FF_TAG) >= 0) return true; } catch (e) {}
  try { return /frameflow/i.test((layer && layer.name) || ""); } catch (e2) {}
  return false;
}
function afTagImportedLayer(layer) {
  if (!layer) return;
  var already = afIsFrameFlowItem(layer);
  try {
    if (!already) layer.comment = layer.comment ? (String(layer.comment) + " · " + FF_TAG) : FF_TAG;
  } catch (eC) {}
  try {
    var mp = layer.property("ADBE Marker"); // ko'rinmas belgi (regex'siz aniqlash uchun)
    if (mp) {
      var t = layer.inPoint;
      if (!isFinite(t)) t = 0;
      mp.setValueAtTime(t, new MarkerValue(FF_TAG));
    }
  } catch (eM) {}
  try { layer.label = 9; } catch (eL) {} // rang-yorliq (ko'rinadigan belgi)
}

function addSceneCompToTimeline(sceneComp, destCompId, cfg) {
  if (!sceneComp) return { ok: false, reason: "no_scene" };
  var destComp = destCompId ? findCompByIdInProject(destCompId) : null;
  if (!destComp) {
    return { ok: false, reason: "no_dest_comp" };
  }
  cfg = cfg || {};
  try {
    // Nishonga joylash (MH mexanizmi 1, ODDIY variant): tanlangan layer bo'lsa uni
    // "placeholder" sifatida ishlatamiz — inPoint (vaqt) + index (stacking slot). Aks
    // holda playhead (destComp.time). MUHIM: layers.add() tanlovni almashtiradi, shu
    // sabab tanlangan layer'ni add'dan OLDIN o'qiymiz. Placeholder OLIB TASHLANMAYDI
    // (native brick-replace EMAS — task doirasidan tashqari).
    var target = null;
    try {
      var selBefore = destComp.selectedLayers;
      if (selBefore && selBefore.length) target = selBefore[0];
    } catch (eSel) { target = null; }

    var insertTime = destComp.time;
    var placePos = null;
    if (target) {
      try { insertTime = target.inPoint; } catch (eIn) { insertTime = destComp.time; }
      // Placeholder pozitsiyasini o'qib qo'yamiz (autoscale recenter uchun) — ixtiyoriy.
      if (cfg.inheritPosition === true) {
        try {
          var tp = target.property("ADBE Transform Group").property("ADBE Position").value;
          if (tp && tp.length >= 2 && isFinite(tp[0]) && isFinite(tp[1])) placePos = [tp[0], tp[1]];
        } catch (ePos) { placePos = null; }
      }
    }

    var newLayer = destComp.layers.add(sceneComp);
    newLayer.startTime = insertTime;                       // placeholder inPoint yoki playhead
    if (target) {
      try { newLayer.moveBefore(target); } catch (eMove) {} // xuddi shu stacking slot
    }

    // Avto-masshtab (MH mexanizmi 2): kontent'ni comp'ga sig'diramiz. cfg.autoscale=false o'chiradi.
    if (cfg.autoscale !== false) {
      var scaleOpts = {};
      // Placeholder pozitsiyasiga markazlash (recenter) anchor/position o'zgartiradi →
      // jonli AE tekshiruvini talab qiladi, shu sabab sukut bo'yicha O'CHIQ (faqat Scale,
      // past-xavf). cfg.inheritPosition === true bo'lsa "lands in place" markazlash.
      if (placePos) { scaleOpts.recenter = true; scaleOpts.position = placePos; }
      afScaleLayerToComp(newLayer, destComp, cfg.fitMode || "contain", scaleOpts);
    }

    afTagImportedLayer(newLayer);                          // self-tag (MH mexanizmi 5)
    destComp.openInViewer();
    return { ok: true, reason: "", placed: target ? "selection" : "playhead" };
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
      return JSON.stringify({ ok: false, message: "File path required" });
    }

    var file = new File(filePath);
    if (!file.exists) {
      return JSON.stringify({ ok: false, message: "File not found" });
    }

    // .mogrt panel (CEP) tomonda .aep ga ochilgan bo'lishi kerak — bu yerga yetib kelsa eski plugin
    if (/\.mogrt$/i.test(filePath)) {
      return JSON.stringify({
        ok: false,
        message: ".mogrt was not extracted — update the plugin (install-cep.sh)"
      });
    }

    app.beginUndoGroup("AssetFlow Import Scene");
    var importMode = cfg.importMode || "timeline";
    var destCompId = null;
    var activeBefore = app.project.activeItem;
    if (!(activeBefore instanceof CompItem)) {
      // Project panel (yoki boshqa panel) fokusda bo'lsa activeItem null/folder
      // qaytadi — comp Timeline'da ochiq bo'lsa ham. Ochiq comp viewer'ini
      // aktiv qilib qayta o'qiymiz.
      try {
        if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
          app.activeViewer.setActive();
          activeBefore = app.project.activeItem;
        }
      } catch (ignoreViewer) {}
    }
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
      var wanted = compName || cfg.sceneLabel || "scene";
      return JSON.stringify({
        ok: false,
        message: "Comp not found: " + wanted + " (comp name inside the pack does not match)"
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
        return JSON.stringify({ ok: false, message: "Comp was not preserved: " + resolvedName });
      }
      keptFolder = renameImportRootForComp(targetComp, folderLabel);
    } else {
      keptFolder = renameNewImportRootFolder(existingIds, folderLabel);
      targetComp = findCompByIdInProject(targetId);
      if (!targetComp) {
        removeAllImportedItems(existingIds);
        app.endUndoGroup();
        return JSON.stringify({ ok: false, message: "Comp was not preserved: " + resolvedName });
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
      timelineResult = addSceneCompToTimeline(targetComp, destCompId, cfg);
    }
    // Yetishmagan shriftlar — faqat foydalanuvchi olgan comp(lar) bo'yicha:
    // prune bo'lsa targetComp + dependency, aks holda barcha import qilingan comp.
    var fontComps = pruneToScene
      ? collectCompDependencies(targetComp, [], {})
      : collectAllImportedComps(existingIds);
    var missingFonts = af_missingFontsForComps(fontComps);
    app.endUndoGroup();
    return JSON.stringify({
      ok: true,
      comp: resolvedName,
      folder: keptFolder || folderLabel,
      movedCount: movedCount,
      importMode: importMode,
      fullPack: !pruneToScene,
      addedToTimeline: timelineResult.ok,
      timelineReason: timelineResult.reason || "",
      missingFonts: missingFonts
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
    var f = Folder.selectDialog("AssetFlow — folder for downloaded templates");
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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project is open" });
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
    return JSON.stringify({ ok: false, message: "Project has no file — press CMD+S to save manually" });
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
    if (!exportRoot) return JSON.stringify({ ok: false, message: "exportRoot required" });

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
      return JSON.stringify({ ok: false, message: "Scene comp not found" });
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
    if (!exportRoot) return JSON.stringify({ ok: false, message: "exportRoot required" });
    var previewDur = (typeof cfg.previewDuration === "number") ? cfg.previewDuration : 6;

    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    var scenesFolder = cfg.scenesFolder ? findFolderByPath(cfg.scenesFolder) : null;
    if (!scenesFolder) return JSON.stringify({ ok: false, message: "02.Scene folder not found" });

    var comps = [];
    var i, child;
    for (i = 1; i <= scenesFolder.numItems; i++) {
      child = scenesFolder.item(i);
      if (child instanceof CompItem) comps.push(child);
    }
    if (!comps.length) return JSON.stringify({ ok: false, message: "Scene comp not found" });

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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project" });
    var cfg = JSON.parse(jsonStr);
    var exportRoot = cfg.exportRoot;
    var compName = cfg.compName;
    if (!exportRoot || !compName) return JSON.stringify({ ok: false, message: "compName/exportRoot required" });
    var previewDur = (typeof cfg.previewDuration === "number") ? cfg.previewDuration : 6;

    var folder = new Folder(exportRoot);
    if (!folder.exists) folder.create();

    var comp = findCompByName(compName);
    if (!comp) return JSON.stringify({ ok: false, message: "Comp not found: " + compName });

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
          message: "Admin Preview preset not found. In AE: Edit → Templates → Output Module → create Admin Preview."
        });
      }
      omV.file = new File(exportRoot + "/" + baseName + "_preview.mp4");
      pending.push(rqV);
    } catch(eV) {
      return JSON.stringify({ ok: false, message: "Video render queue: " + eV.toString() });
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
    if (ext === "mogrt") {
      app.endUndoGroup();
      return "error: .mogrt was not extracted — update the plugin (install-cep.sh)";
    }
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

// FAZA 1: shablon = bitta .aep, BUTUN loyiha import qilinadi (sahna tanlash yo'q,
// prune yo'q). Faqat yangi root papka shablon nomiga o'zgartiriladi — xuddi
// importSingleSceneFromAep'dagi pruneToScene=false filiali kabi.
function importTemplateProject(jsonStr) {
  try {
    var cfg = JSON.parse(jsonStr);
    var filePath = cfg.filePath;
    var packLabel = String(cfg.packLabel || "FrameFlow").trim() || "FrameFlow";
    if (!filePath) return JSON.stringify({ ok: false, message: "File path required" });
    var file = new File(filePath);
    if (!file.exists) return JSON.stringify({ ok: false, message: "File not found" });
    if (/\.mogrt$/i.test(filePath)) {
      return JSON.stringify({ ok: false, message: ".mogrt was not extracted — update the plugin (install-cep.sh)" });
    }
    app.beginUndoGroup("AssetFlow Import Template");
    var existingIds = collectProjectItemIds(app.project, {});
    var io = new ImportOptions(file);
    io.importAs = ImportAsType.PROJECT;
    app.project.importFile(io);
    var keptFolder = renameNewImportRootFolder(existingIds, packLabel);
    var importedComps = collectAllImportedComps(existingIds);
    var movedCount = importedComps.length;
    var missingFonts = af_missingFontsForComps(importedComps);
    app.endUndoGroup();
    return JSON.stringify({ ok: true, folder: keptFolder || packLabel, movedCount: movedCount, missingFonts: missingFonts });
  } catch (e) {
    try { app.endUndoGroup(); } catch (ignore) {}
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

// AI Tools natijasi (rasm/audio) uchun mustahkam media import (Higgsfield AEFT naqshi):
// canImportAs(FOOTAGE) guard — AE format'ni qabul qila olishini OLDIN tekshiradi, keyin
// importAs=FOOTAGE bilan import qiladi. Structured JSON {ok,reason,item} qaytaradi
// (frontend aniq sabab ko'rsatadi). importAssetToProject kontrakti tegilmaydi.
function importMediaFromPath(filePath) {
  if (!filePath) return JSON.stringify({ ok: false, reason: "No file path provided" });
  if (typeof app === "undefined" || !app.project) {
    return JSON.stringify({ ok: false, reason: "No open After Effects project" });
  }
  var file = new File(filePath);
  if (!file.exists) {
    return JSON.stringify({ ok: false, reason: "File not found: " + filePath });
  }
  // MUHIM: ExtendScript (ES3) try/finally ichidagi return qiymatni yutishi mumkin
  // (evalScript bo'sh "" qaytaradi). Shu sabab natijani o'zgaruvchiga yig'ib,
  // endUndoGroup'ni alohida chaqirib, OXIRIDA bitta return qilamiz.
  app.beginUndoGroup("AssetFlow AI Import");
  var result;
  try {
    var io = new ImportOptions(file);
    if (!io.canImportAs(ImportAsType.FOOTAGE)) {
      result = { ok: false, reason: "AE cannot import this file as footage: " + file.name };
    } else {
      io.importAs = ImportAsType.FOOTAGE;
      var item = app.project.importFile(io);
      // Higgsfield naqshi: aktiv comp bo'lsa footage'ni playhead'ga LAYER qo'sh.
      // Guard TIP bo'yicha (hasVideo/hasAudio EMAS): mp3/wav AE'da import'dan keyin
      // darrov "conform" bo'lmaydi → hasAudio vaqtincha false bo'lishi mumkin edi
      // (audio comp'ga qo'shilmay qolardi). FootageItem/CompItem — comp.layers.add()
      // qabul qiladigan AVItem; conform holatiga bog'liq emas.
      var addedToComp = false;
      var compName = "";
      var active = app.project.activeItem;
      var isComp = active && (active instanceof CompItem);
      var addable = item && (item instanceof FootageItem || item instanceof CompItem);
      if (isComp && addable) {
        try {
          var layer = active.layers.add(item);
          layer.startTime = active.time; // playhead'ga joylash
          addedToComp = true;
          compName = active.name;
        } catch (addErr) {
          addedToComp = false; // import baribir muvaffaqiyatli — comp'ga qo'shish XATO emas
        }
      }
      result = {
        ok: true,
        addedToComp: addedToComp,
        compName: compName,
        item: item ? item.name : ""
      };
    }
  } catch (e) {
    result = { ok: false, reason: String(e && e.toString ? e.toString() : e) };
  }
  try { app.endUndoGroup(); } catch (ignore) {}
  return JSON.stringify(result);
}

// ── Timeline live-link (Higgsfield AEFT naqshi) ─────────────────────────────
// Aktiv comp'dagi tanlangan layer manbasining fayl yo'lini qaytaradi (footage).
function afLayerSourcePath(source) {
  try {
    if (source && source.mainSource && source.mainSource.file) {
      return source.mainSource.file.fsName;
    }
  } catch (e) {}
  try {
    if (source && source.file) return source.file.fsName;
  } catch (e) {}
  return "";
}

// JSON STRING'ni QO'LDA quramiz — JSON.stringify'ga bog'liqlik yo'q (evalFile bilan yuklangan
// kontekstda JSON undefined bo'lib, JSON.stringify throw qilishi → funksiya bo'sh qaytarishi
// aniqlandi: A=ping,B=loaded,C=function,Dlen=0). Manual escape → DOIM yaroqli JSON string.
function afJStr(s) {
  return '"' + String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ") + '"';
}
function afFail(reason) {
  return '{"ok":false,"reason":' + afJStr(reason) + '}';
}

function getActiveTimelineVideoReference() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var active = app.project.activeItem;
    if (!active || !(active instanceof CompItem)) return afFail("No composition open — open the Timeline");
    var layers = active.selectedLayers;
    if (!layers || layers.length === 0) return afFail("No layer selected — select a clip in the Timeline");

    var firstReason = "Selected layer is not footage";
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      var src = null;
      try { src = L.source; } catch (e) { src = null; }
      if (!src) {
        if (i === 0) firstReason = "Selected layer is not footage (text/shape/camera)";
        continue;
      }
      if (!(src instanceof FootageItem)) {
        if (i === 0) firstReason = (src instanceof CompItem)
          ? "Selected layer is a precomp — select a footage clip"
          : "Selected layer is not footage";
        continue;
      }
      var mediaPath = afLayerSourcePath(src);
      if (!mediaPath) {
        if (i === 0) firstReason = "Footage has no file (solid/placeholder) — a disk file is required";
        continue;
      }
      var hasVideo = false, hasAudio = false;
      try { hasVideo = src.hasVideo === true; } catch (e) {}
      try { hasAudio = src.hasAudio === true; } catch (e) {}
      var mt = hasVideo ? "video" : (hasAudio ? "audio" : "other");
      var nm = L.name || src.name || "Layer";
      // QO'LDA JSON
      return '{"ok":true,"name":' + afJStr(nm) +
             ',"mediaPath":' + afJStr(mediaPath) +
             ',"mediaType":' + afJStr(mt) +
             ',"hasVideo":' + (hasVideo ? "true" : "false") +
             ',"hasAudio":' + (hasAudio ? "true" : "false") +
             ',"compName":' + afJStr(active.name) + '}';
    }
    return afFail(firstReason);
  } catch (e) {
    return afFail("Internal error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

// Project panelda TANLANGAN element(lar)dan birinchi footage (rasm/video) manba fayl
// yo'lini reference sifatida qaytaradi. getActiveTimelineVideoReference bilan bir xil
// shaklda (mediaPath/mediaType) — frontend ikkala manbani bir xil ishlaydi.
function getSelectedProjectReference() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var sel = app.project.selection;
    if (!sel || sel.length === 0) return afFail("Nothing selected in the Project panel — select footage (image/video)");

    var firstReason = "Selected item is not footage";
    for (var i = 0; i < sel.length; i++) {
      var it = sel[i];
      if (!(it instanceof FootageItem)) {
        if (i === 0) firstReason = (it instanceof CompItem)
          ? "Selected item is a composition — select footage (image/video)"
          : "Selected item is not footage (a folder?)";
        continue;
      }
      var mediaPath = afLayerSourcePath(it);
      if (!mediaPath) {
        if (i === 0) firstReason = "Footage has no file (solid/placeholder) — a disk file is required";
        continue;
      }
      var hasVideo = false, hasAudio = false;
      try { hasVideo = it.hasVideo === true; } catch (e) {}
      try { hasAudio = it.hasAudio === true; } catch (e) {}
      var mt = hasVideo ? "video" : (hasAudio ? "audio" : "other");
      var nm = it.name || "Footage";
      var kind = (hasAudio && !hasVideo) ? "audio" : "footage";
      // QO'LDA JSON (timeline funksiyasi bilan bir xil sabab)
      return '{"ok":true,"name":' + afJStr(nm) +
             ',"mediaPath":' + afJStr(mediaPath) +
             ',"mediaType":' + afJStr(mt) +
             ',"kind":' + afJStr(kind) +
             ',"hasVideo":' + (hasVideo ? "true" : "false") +
             ',"hasAudio":' + (hasAudio ? "true" : "false") +
             ',"source":"project"}';
    }
    return afFail(firstReason);
  } catch (e) {
    return afFail("Internal error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

// Project paneldagi BARCHA footage'larni (disk fayli bor) ro'yxatlaydi — reference picker uchun.
// CEP: $.evalFile(host.jsx) so'ng listProjectFootage(). mediaType = video|audio|image|other.
// QO'LDA JSON — JSON.stringify'ga bog'lanmaydi (evalFile kontekstida JSON undefined bo'lishi mumkin).
function listProjectFootage() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");

    var CAP = 60;
    var json = '{"ok":true,"items":[';
    var count = 0;
    var truncated = false;
    var i, it, mediaPath, hasVideo, hasAudio, mt, nm;

    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (!(it instanceof FootageItem)) continue;

      mediaPath = afLayerSourcePath(it);
      if (!mediaPath) continue; // solid / placeholder / faylsiz — o'tkazib yubor
      try { if (it.footageMissing === true) continue; } catch (eM) {} // offline/yo'qolgan fayl — o'tkazib yubor

      if (count >= CAP) { truncated = true; break; }

      hasVideo = false;
      hasAudio = false;
      try { hasVideo = it.hasVideo === true; } catch (eV) {}
      try { hasAudio = it.hasAudio === true; } catch (eA) {}

      // still rasm ham hasVideo=true qaytaradi — duration/isStill bilan ajratamiz
      if (hasVideo) {
        var isStill = false;
        try { isStill = (it.mainSource && it.mainSource.isStill === true) || (it.duration === 0) || /\.(png|jpe?g|webp|gif|bmp|tiff?|psd|avif|heic)$/i.test(mediaPath); } catch (eS) {}
        mt = isStill ? "image" : "video";
      } else if (hasAudio) {
        mt = "audio";
      } else {
        mt = "other";
      }

      nm = it.name || "Footage";

      if (count > 0) json += ",";
      json += '{"name":' + afJStr(nm) +
              ',"mediaPath":' + afJStr(mediaPath) +
              ',"mediaType":' + afJStr(mt) + '}';
      count++;
    }

    json += '],"count":' + count + ',"truncated":' + (truncated ? "true" : "false") + '}';
    return json;
  } catch (e) {
    return afFail("Internal error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

// Faol kompozitsiyaning joriy kadrini PNG ga eksport qiladi (Timeline → referens). {ok,path,name}.
function exportTimelineFrame() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var comp = app.project.activeItem;
    // CEP panel fokusda bo'lsa activeItem null bo'ladi — ochiq comp viewer'ini aktiv qilib qayta o'qiymiz.
    if (!(comp instanceof CompItem)) {
      try {
        if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
          app.activeViewer.setActive();
          comp = app.project.activeItem;
        }
      } catch (eViewer) {}
    }
    // Hali topilmasa — loyihадаги birinchi kompozitsiya (eng yaxshi taxmin).
    if (!(comp instanceof CompItem)) {
      for (var i = 1; i <= app.project.numItems; i++) {
        if (app.project.item(i) instanceof CompItem) { comp = app.project.item(i); break; }
      }
    }
    if (!(comp instanceof CompItem)) return afFail("No active composition — open a comp in the Timeline");
    var dir = Folder.temp.fsName + "/assetflow-refs";
    var folder = new Folder(dir);
    if (!folder.exists) folder.create();
    var outFile = new File(dir + "/tlframe-" + new Date().getTime() + ".png");
    try {
      comp.openInViewer(); // saveFrameToPng uchun zarur
      app.purge(PurgeTarget.SNAPSHOT_CACHES);
    } catch (eV) {}
    comp.saveFrameToPng(comp.time, outFile);
    if (!outFile.exists) return afFail("Frame was not saved — make sure the comp is open in the viewer");
    return '{"ok":true,"path":' + afJStr(outFile.fsName) +
           ',"name":' + afJStr(comp.name + " · frame") +
           ',"mediaType":"image"}';
  } catch (e) {
    return afFail("Internal error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

/**
 * Vaqt-oraliq UI uchun (v4): faol comp duration + work area (start/duration) + fps.
 * Faqat O'QIYDI — AE'ga hech narsa yozmaydi. Plagin shu asosда time-range'ni chizadi.
 */
function getWorkAreaInfo() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return afFail("No composition open");
    var compDur = Math.round(comp.duration * 1000) / 1000;
    var waStart = Math.round((comp.workAreaStart || 0) * 1000) / 1000;
    var waDur = Math.round((comp.workAreaDuration || comp.duration) * 1000) / 1000;
    var fps = comp.frameRate ? (Math.round(comp.frameRate * 100) / 100) : 25;
    return '{"ok":true,"compDuration":' + compDur +
           ',"workAreaStart":' + waStart +
           ',"workAreaDuration":' + waDur +
           ',"fps":' + fps + '}';
  } catch (e) {
    return afFail("Internal error: " + (e && e.toString ? e.toString() : e));
  }
}

/**
 * AI SFX (B) — faol comp work-area oralig'ini faylga render qiladi (tahlil uchun).
 * cfg: { destPath, maxDur } . Qaytaradi: {ok, path, workAreaStart, fps, duration}.
 * Eslatma: rq.render() butun navbatni render qiladi va AE'ni vaqtincha bloklaydi (qisqa klip uchun).
 */
function exportWorkAreaForSfx(destPath, maxDur) {
  try {
    // ExtendScript JSON.parse ishonchsiz — argumentlar oddiy parametr (JSON blob emas).
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return afFail("No composition open — open the Timeline");
    if (!destPath) return afFail("destPath missing");

    var fd = comp.frameDuration;
    var fps = comp.frameRate;
    // displayStartTime offset (comp 1:00:00 dan boshlanishi mumkin) — timeSpanStart shu fazoda.
    var dst = 0; try { dst = comp.displayStartTime; } catch (eD) { dst = 0; }
    var waRel = Math.round(comp.workAreaStart / fd) * fd;   // 0-asosli (layer joylash uchun)
    var waDur = Math.round(comp.workAreaDuration / fd) * fd;
    var md = (typeof maxDur === "number" && maxDur > 0) ? maxDur : 30;
    if (waDur > md) waDur = Math.round(md / fd) * fd;
    if (waDur < fd) return afFail("Work area is too short");

    var rq = app.project.renderQueue;
    var rqItem = rq.items.add(comp);
    rqItem.timeSpanStart = dst + waRel;        // display-vaqt fazosi (bo'sh kadr ogohlantirishini oldini oladi)
    rqItem.timeSpanDuration = waDur;
    var om = rqItem.outputModule(1);
    applyBestVideoTemplate(om);          // H.264 afzal (bo'lmasa High Quality)
    var outFile = new File(destPath);
    om.file = outFile;
    rq.render();                         // BLOKLAYDI (qisqa klip)
    try { rqItem.remove(); } catch (ig) {}

    if (!outFile.exists) return afFail("Render file was not created");
    return '{"ok":true,"path":' + afJStr(outFile.fsName) +
           ',"workAreaStart":' + waRel +
           ',"fps":' + fps +
           ',"duration":' + waDur + '}';
  } catch (e) {
    return afFail("Export error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

/**
 * AI SFX (B) — RENDER QILMASDAN faol comp work-area tuzilishini o'qiydi (qo'lda JSON).
 * Layer in/out (kesim/hodisa), nomlar, audio/video, comp markerlar — vaqtlar WORK-AREA'ga nisbiy.
 * LLM shu strukturadan SFX cue plan tuzadi. Frame-aniq, AE muzlamaydi.
 */
function readTimelineForSfx() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return afFail("No composition open — open the Timeline");
    var fps = comp.frameRate;
    var waStart = comp.workAreaStart, waEnd = waStart + comp.workAreaDuration;

    var lay = [], i, L, ip, op, nm, hasA, hasV, en;
    for (i = 1; i <= comp.numLayers; i++) {
      L = comp.layer(i);
      ip = 0; op = 0;
      try { ip = L.inPoint; op = L.outPoint; } catch (e1) {}
      if (op < waStart || ip > waEnd) continue;   // work area bilan kesishmaydi
      nm = L.name || "Layer";
      hasA = false; hasV = false; en = true;
      try { hasA = L.hasAudio === true; } catch (e2) {}
      try { hasV = L.hasVideo === true; } catch (e3) {}
      try { en = L.enabled === true; } catch (e4) {}
      lay.push('{"name":' + afJStr(nm) +
               ',"in":' + (ip - waStart).toFixed(3) +
               ',"out":' + (op - waStart).toFixed(3) +
               ',"audio":' + (hasA ? "true" : "false") +
               ',"video":' + (hasV ? "true" : "false") +
               ',"enabled":' + (en ? "true" : "false") + '}');
    }

    var mk = [], mp, n, t, c;
    try {
      mp = comp.markerProperty; n = mp.numKeys;
      for (i = 1; i <= n; i++) {
        t = mp.keyTime(i);
        if (t < waStart || t > waEnd) continue;
        c = ""; try { c = mp.keyValue(i).comment || ""; } catch (e5) {}
        mk.push('{"t":' + (t - waStart).toFixed(3) + ',"comment":' + afJStr(c) + '}');
      }
    } catch (eM) {}

    return '{"ok":true,"comp":' + afJStr(comp.name) +
           ',"fps":' + fps +
           ',"workAreaStart":' + waStart.toFixed(3) +
           ',"duration":' + comp.workAreaDuration.toFixed(3) +
           ',"layers":[' + lay.join(",") + ']' +
           ',"markers":[' + mk.join(",") + ']}';
  } catch (e) {
    return afFail("Timeline read error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

/**
 * AI SFX (B2) — work-area'дан bir nechta KADR namunasini PNG qilib saqlaydi (to'liq render emas).
 * timesCsv: work-area-nisbiy soniyalar (vergul bilan). destPrefix: fayl prefiksi.
 * saveFrameToPng comp-ichki (0-asosli) vaqt ishlatadi → workAreaStart + t.
 */
function sampleFramesForSfx(timesCsv, destPrefix) {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open project");
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return afFail("No composition open");
    if (!timesCsv || !destPrefix) return afFail("Missing parameters");
    var waStart = comp.workAreaStart;
    var parts = String(timesCsv).split(",");
    var out = [], i, t, ct, f;
    for (i = 0; i < parts.length; i++) {
      t = parseFloat(parts[i]); if (isNaN(t)) continue;
      ct = waStart + t;                       // 0-asosli comp vaqti
      f = new File(destPrefix + "_" + i + ".png");
      try { comp.saveFrameToPng(ct, f); } catch (eS) { continue; }
      if (f.exists) out.push(afJStr(f.fsName));
    }
    if (!out.length) return afFail("No frames were saved");
    return '{"ok":true,"frames":[' + out.join(",") + ']}';
  } catch (e) {
    return afFail("Frame error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
  }
}

// Tanlangan layer trim/oraliq tafsilotlari — bulletproof (qo'lda JSON, har yo'lda string).
function getActiveTimelineClipDetails() {
  try {
    if (typeof app === "undefined" || !app.project) return afFail("No open After Effects project");
    var active = app.project.activeItem;
    if (!(active && active instanceof CompItem)) return afFail("No active composition");
    var layers = active.selectedLayers;
    if (!layers || layers.length === 0) return afFail("No layer selected");
    var L = layers[0];
    var inP = 0, outP = 0, startT = 0, compT = 0, dur = 0;
    try { inP = L.inPoint; } catch (e) {}
    try { outP = L.outPoint; } catch (e) {}
    try { startT = L.startTime; } catch (e) {}
    try { compT = active.time; } catch (e) {}
    try { if (L.source && L.source.duration) dur = L.source.duration; } catch (e) {}
    return '{"ok":true,"name":' + afJStr(L.name || "Layer") +
           ',"inPoint":' + Number(inP) +
           ',"outPoint":' + Number(outP) +
           ',"startTime":' + Number(startT) +
           ',"compTime":' + Number(compT) +
           ',"sourceDuration":' + Number(dur) + '}';
  } catch (e) {
    return afFail("Internal error: " + (e && e.toString ? e.toString() : e) + " @line " + (e && e.line != null ? e.line : "?"));
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
      return JSON.stringify({ ok: false, message: "Project path required" });
    }
    var f = new File(filePath);
    if (!f.exists) {
      return JSON.stringify({
        ok: false,
        error: "not_found",
        message: "File not found: " + filePath
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
        message: "Project opened, but the file could not be determined"
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
      return JSON.stringify({ ok: false, message: "Project path required" });
    }
    var f = new File(filePath);
    if (!f.exists) {
      return JSON.stringify({
        ok: false,
        message: "File not found: " + filePath
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
    if (!p) { __afOpenState.state = "error"; __afOpenState.err = "No path"; return; }
    var f = new File(p);
    if (!f.exists) { __afOpenState.state = "error"; __afOpenState.err = "File not found"; return; }
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

// Joriy loyihani saqlamasdan yopadi — yangi loyiha ochishdan oldin "Save changes?" ni oldini oladi.
// force=false bo'lsa va loyihada saqlanmagan o'zgarish bo'lsa — YOPMAYDI, {dirty:true} qaytaradi
// (panel JS tomonda tasdiq so'raydi, keyin afCloseCurrent(true) bilan majburlaydi).
function afCloseCurrent(force) {
  try {
    if (app.project) {
      var isDirty = false;
      try { isDirty = !!app.project.dirty; } catch (eD) {}
      if (!force && isDirty) {
        return JSON.stringify({ ok: false, dirty: true, message: "There are unsaved changes" });
      }
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e1) {}
    }
    return JSON.stringify({ ok: true });
  } catch (e) {
    return JSON.stringify({ ok: false, message: e.toString() });
  }
}

/**
 * "Admin Preview" Output Module preseti bor-yo'qligini tekshiradi; yo'q bo'lsa
 * H.264/.mp4 bazaviy presetdan nusxa olib "Admin Preview" nomi bilan saqlaydi.
 * Vaqtinchalik comp + RQ element yaratib o'chiradi (loyiha tarkibiga tegmaydi).
 * Natija: {ok, existed, created} yoki {ok:false, message}.
 */
function afEnsureAdminPreviewPreset() {
  var tmpComp = null, rqi = null;
  try {
    if (!app.project) app.newProject();
    // Probe loyihani "dirty" qilmasin — oldingi holatni eslab, oxirida tiklaymiz
    // (shunda afCloseCurrent yolg'on "saqlanmagan o'zgarish" deb ogohlantirmaydi).
    var wasDirty = false;
    try { wasDirty = !!app.project.dirty; } catch (eWD) {}
    var rq = app.project.renderQueue;
    tmpComp = app.project.items.addComp("AF_PresetProbe", 1280, 720, 1, 1, 30);
    rqi = rq.items.add(tmpComp);
    var om = rqi.outputModule(1);

    // Mavjud preset nomlari ro'yxatida "Admin Preview" bormi?
    var exists = false;
    try {
      var tpls = om.templates; // nomlar massivi
      for (var i = 0; i < tpls.length; i++) {
        if (String(tpls[i]) === "Admin Preview") { exists = true; break; }
      }
    } catch (eTpl) {}

    var created = false;
    if (!exists) {
      // .mp4 (H.264) chiqaradigan bazaviy presetni qo'llaymiz (mavjud bo'lganini)
      var bases = [
        "H.264 - Match Render Settings - 15 Mbps",
        "H.264 - Match Render Settings - 40 Mbps",
        "H.264",
        "High Quality"
      ];
      for (var b = 0; b < bases.length; b++) {
        try { om.applyTemplate(bases[b]); break; } catch (eB) {}
      }
      try {
        om.saveAsTemplate("Admin Preview");
        created = true;
      } catch (eSave) {
        try { if (rqi) rqi.remove(); } catch (e1) {}
        try { if (tmpComp) tmpComp.remove(); } catch (e2) {}
        return JSON.stringify({
          ok: false,
          message: "Could not auto-create the Admin Preview preset: " + eSave.toString()
        });
      }
    }

    try { if (rqi) rqi.remove(); } catch (e3) {}
    try { if (tmpComp) tmpComp.remove(); } catch (e4) {}
    // Loyiha probe'dan oldin toza bo'lsa — dirty bayrog'ini tiklashga harakat qilamiz
    if (!wasDirty) { try { app.project.dirty = false; } catch (eR) {} }
    return JSON.stringify({ ok: true, existed: exists, created: created });
  } catch (e) {
    try { if (rqi) rqi.remove(); } catch (e5) {}
    try { if (tmpComp) tmpComp.remove(); } catch (e6) {}
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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project" });
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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project" });
    var fid = parseInt(folderId, 10);
    var folder = null, i, it;
    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (it instanceof FolderItem && it.id === fid) { folder = it; break; }
    }
    if (!folder) return JSON.stringify({ ok: false, message: "Folder not found" });
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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project" });
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
    if (!target) return JSON.stringify({ ok: false, message: "Comp not found" });
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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project" });
    var comp = findCompByName(String(compName || ""));
    if (!comp) return JSON.stringify({ ok: false, message: "Comp not found: " + compName });
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
    if (!app.project) return JSON.stringify({ ok: false, message: "No project" });
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
