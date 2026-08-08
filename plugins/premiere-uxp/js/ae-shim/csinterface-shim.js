/*
 * CSInterface shim — AE CEP ↔ ExtendScript ko'prigining Premiere UXP muqobili.
 *
 * AE kodi host bilan FAQAT `csInterface.evalScript(script, cb)` orqali gaplashadi
 * (10 ta chaqiruv nuqtasi). UXP'da ExtendScript yo'q, shuning uchun bu yerda
 * ExtendScript **interpretatori emas**, `script` satridagi CHAQIRUV NOMINI
 * ajratib, uni `premierepro` API'siga yo'naltiruvchi dispetcher bor.
 *
 * Qoida: nomi ma'lum bo'lsa — bajaramiz; nomi ma'lum bo'lmasa — AE'ning o'z
 * xato shakli (`{ok:false,reason}`) bilan HALOL rad javob. Jim `null` qaytarish
 * TAQIQ: chaqiruvchi buni "loyiha ochilmagan" deb noto'g'ri talqin qiladi.
 *
 * Qo'llab-quvvatlanadigan host funksiyalari (AE jsx/host.jsx dagi javob shakli
 * bayt-bayt saqlanadi, chunki AE JS'i uni shunday parse qiladi):
 *   pickDownloadFolder()                  → {ok,path} | {ok:false,canceled}
 *   importMediaFromPath(path)             → {ok,name,path}
 *   listProjectFootage()                  → {ok,items[{name,mediaPath,mediaType}],count,truncated}
 *   getActiveTimelineVideoReference()     → {ok,name,mediaPath,mediaType,hasVideo,hasAudio,compName}
 *   exportTimelineFrame()                 → {ok,path,name}
 *   importTemplateProject(json)           → {ok,folder,folderId,movedCount,missingFonts} | {ok:false,message}
 *   importFootageBundle(json)             → {ok,imported,failed,folder,folderId,reason}
 *   revealFileInOS(path)                  → {ok:true} | {ok:true,revealed:false} | {ok:false,reason}
 *   removeImportedTemplate(json)          → {ok,removed} | {ok:false,message}
 *   installMogrtToLibrary(path)           → {ok,path} | {ok:false,reason}   (EG papkasiga doimiy o'rnatish)
 *   importSingleSceneFromAep(json)        → {ok:false,message}  (AE'ga xos — halol rad)
 */
(function () {
  "use strict";

  var uxp = null, ppro = null, fs = null;
  try { uxp = require("uxp"); } catch (e) { /* UXP tashqarisida (dev harness) */ }
  try { ppro = require("premierepro"); } catch (e) { /* Premiere yo'q */ }
  try { fs = require("fs"); } catch (e) { /* ixtiyoriy */ }

  var CAP = 60;            // AE listProjectFootage bilan bir xil chegara
  var log = window.FFLog || { warn: function () {}, error: function () {}, info: function () {} };

  function fail(reason) { return JSON.stringify({ ok: false, reason: String(reason) }); }
  function jstr(o) { return JSON.stringify(o); }

  // ── yordamchilar ────────────────────────────────────────────────────────────

  async function project() {
    if (!ppro) return null;
    try { return (await ppro.Project.getActiveProject()) || null; } catch (e) { return null; }
  }
  async function sequence(p) {
    if (!p) return null;
    try { return (await p.getActiveSequence()) || null; } catch (e) { return null; }
  }

  /** Kengaytma turidan media turini chiqaradi (Premiere ProjectItem `hasVideo`
   *  bermaydi — AE'dagi image/video/audio ajratishni yo'ldan tiklaymiz). */
  function mediaTypeOf(path) {
    var p = String(path || "").toLowerCase();
    if (/\.(png|jpe?g|webp|gif|bmp|tiff?|psd|avif|heic|tga|dpx|exr)$/.test(p)) return "image";
    if (/\.(mp4|mov|m4v|avi|mxf|mkv|webm|mpg|mpeg|r3d|braw|prproj)$/.test(p)) return "video";
    if (/\.(wav|mp3|aac|aif{1,2}|m4a|flac|ogg)$/.test(p)) return "audio";
    return "other";
  }

  /** Loyiha daraxtini kezib, disk fayliga ega klip elementlarini yig'adi. */
  async function walkClips(item, out, seen) {
    if (!item || out.length >= CAP) return;
    var kids = null;
    try { if (typeof item.getItems === "function") kids = await item.getItems(); } catch (e) { kids = null; }
    if (kids && kids.length) {
      for (var i = 0; i < kids.length && out.length < CAP; i++) await walkClips(kids[i], out, seen);
      return;
    }
    var clip = null;
    try { clip = ppro.ClipProjectItem.cast ? ppro.ClipProjectItem.cast(item) : item; } catch (e) { clip = item; }
    if (!clip || typeof clip.getMediaFilePath !== "function") return;
    var path = "";
    try { path = await clip.getMediaFilePath(); } catch (e) { path = ""; }
    if (!path || seen[path]) return;           // solid/placeholder yoki takror
    seen[path] = true;
    out.push({ name: item.name || "Footage", mediaPath: path, mediaType: mediaTypeOf(path) });
  }

  /** Plagin yozishi mumkin bo'lgan vaqtinchalik papka (kadr eksporti uchun). */
  async function tmpDir() {
    var lfs = uxp && uxp.storage && uxp.storage.localFileSystem;
    if (!lfs) throw new Error("UXP fayl tizimi mavjud emas");
    var data = await lfs.getDataFolder();
    try { return await data.getEntry("ff-frames"); }
    catch (e) { return await data.createFolder("ff-frames"); }
  }

  /** Fayl kengaytmasi (nuqtasiz, kichik harfda). */
  function extOf(path) {
    var m = /\.([A-Za-z0-9]+)\s*$/.exec(String(path || ""));
    return m ? m[1].toLowerCase() : "";
  }

  /** Premiere versiyalari `CloseProjectOptions`ni factory yoki constructor
   *  sifatida eksport qilgan. Ikkalasini ham xavfsiz sinaymiz. */
  function closeProjectOptions() {
    if (!ppro || !ppro.CloseProjectOptions) return undefined;
    try { return ppro.CloseProjectOptions(); } catch (e) { /* constructor varianti */ }
    try { return new ppro.CloseProjectOptions(); } catch (e) { return undefined; }
  }

  async function closeProjectQuietly(p) {
    if (!p || typeof p.close !== "function") return;
    try { await p.close(closeProjectOptions()); } catch (e) { /* cleanup import natijasini bosmasin */ }
  }

  /** UXP entry'sini disk yo'lidan oladi (`file:` sxemasi shart). */
  async function entryAt(path) {
    var lfs = uxp && uxp.storage && uxp.storage.localFileSystem;
    if (!lfs || !lfs.getEntryWithUrl) throw new Error("UXP fayl tizimi mavjud emas");
    return await lfs.getEntryWithUrl("file:" + String(path));
  }

  /**
   * Timeline'ga qo'yish nuqtasi: playhead + eng YUQORIGI video trek.
   *
   * Eng yuqori trek tanlanadi, chunki `insertMogrtFromPath` mavjud klip ustiga
   * yozishi mumkin — grafika odatda eng ustki qatlamda turadi va shunda
   * foydalanuvchi montajiga tegmaydi.
   */
  async function insertPoint(s) {
    var t;
    try { t = await s.getPlayerPosition(); } catch (e) { t = null; }
    if (!t) {
      try { t = ppro.TickTime.TIME_ZERO !== undefined ? ppro.TickTime.TIME_ZERO : ppro.TickTime.createWithSeconds(0); }
      catch (e2) { t = null; }
    }
    var v = 0;
    try { var n = await s.getVideoTrackCount(); if (n > 0) v = n - 1; } catch (e) { v = 0; }
    return { time: t, vTrack: v, aTrack: 0 };
  }

  /**
   * `packLabel` nomli bin yaratishga URINADI va import maqsadini qaytaradi.
   *
   * DIQQAT: bin yaratish API'si spike'da JONLI tasdiqlanmagan (§7 da faqat
   * `importFiles` bor). Shu sabab urinish to'liq guard ichida: nomli bin
   * chiqmasa, ildiz bin'iga import qilamiz va javобda HAQIQIY joyni beramiz —
   * mavjud bo'lmagan papkani "yaratdik" deb ko'rsatmaymiz.
   */
  async function binFor(p, root, label) {
    if (!label || !root) return { item: root, name: "" };
    try {
      if (typeof root.createBinAction === "function" && typeof p.executeTransaction === "function") {
        await p.executeTransaction(function (ca) { ca.addAction(root.createBinAction(label, true)); }, "FrameFlow: create bin");
        var kids = await root.getItems();
        for (var i = kids.length - 1; i >= 0; i--) {
          if (kids[i] && kids[i].name === label) return { item: kids[i], name: label };
        }
      }
    } catch (e) { log.warn("[uxp-shim] bin yaratilmadi:", e); }
    return { item: root, name: "" };
  }

  /** Eksport ASINXRON: `true` qaytsa ham fayl bir necha yuz ms keyin paydo
   *  bo'ladi va o'lchami barqarorlashguncha o'sadi (spike o'lchovi). */
  async function waitForFile(dir, name, ms) {
    var last = -1, deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      try {
        var f = await dir.getEntry(name);
        var md = await f.getMetadata();
        if (md.size > 0 && md.size === last) return f;
        last = md.size;
      } catch (e) { /* hali yaratilmagan */ }
      await new Promise(function (r) { setTimeout(r, 120); });
    }
    return null;
  }

  // ── host funksiyalari ───────────────────────────────────────────────────────

  var HOST = {
    async pickDownloadFolder() {
      var lfs = uxp && uxp.storage && uxp.storage.localFileSystem;
      if (!lfs) return fail("UXP fayl tizimi mavjud emas");
      var folder = null;
      try { folder = await lfs.getFolder(); } catch (e) { folder = null; }
      if (!folder) return jstr({ ok: false, canceled: true });
      return jstr({ ok: true, path: folder.nativePath });
    },

    async importMediaFromPath(filePath) {
      if (!filePath) return fail("No file path provided");
      var p = await project();
      if (!p) return fail("No open Premiere Pro project");
      if (fs) {
        try { fs.lstatSync(filePath); } catch (e) { return fail("File not found: " + filePath); }
      }
      var root = null;
      try { root = await p.getRootItem(); } catch (e) { root = null; }
      var target = null;
      try { target = await p.getInsertionBin(); } catch (e) { target = null; }
      if (!target) target = root;
      var ok = false;
      try {
        // Adobe Premiere UXP reference: barcha 4 parametr aniq beriladi.
        // Joriy insertion bin ProjectItem; u bo'lmasa root xavfsiz fallback.
        var pending = p.importFiles([filePath], true, target, false);
        ok = await pending;
        // UXP download adapteri yakuniy faylni publish qilganidan keyin ham
        // Premiere media importer qisqa muddat `false` qaytarishi mumkin.
        // Birinchi urinish muvaffaqiyatsiz bo'lsagina bitta settle+retry.
        if (!ok) {
          await new Promise(function (resolve) { setTimeout(resolve, 1200); });
          ok = await p.importFiles([filePath], true, target, false);
        }
      } catch (e) {
        return fail("Import failed: " + String((e && e.message) || e));
      }
      if (!ok) return fail("Premiere rejected the import: " + filePath);
      var name = String(filePath).split(/[\\/]/).pop();
      return jstr({ ok: true, name: name, path: filePath });
    },

    async listProjectFootage() {
      var p = await project();
      if (!p) return fail("No open Premiere Pro project");
      var root = null;
      try { root = await p.getRootItem(); } catch (e) { root = null; }
      if (!root) return fail("Project bin is not readable");
      var items = [];
      await walkClips(root, items, {});
      return jstr({ ok: true, items: items, count: items.length, truncated: items.length >= CAP });
    },

    /** Premiere UXP 25.6–26.2 Project-panel selectionini o'qish API'sini
     *  bermaydi. Ro'yxat picker'i `listProjectFootage()` orqali to'liq ishlaydi;
     *  aynan selection so'ralganda esa boshqa klipni taxmin qilib yubormaymiz. */
    async getSelectedProjectReference() {
      return jstr({
        ok: false,
        reason: "Premiere's UXP API cannot read the Project-panel selection yet — choose the item from Project footage.",
        code: "PROJECT_SELECTION_UNAVAILABLE",
        recoverable: true,
      });
    },

    async getActiveTimelineVideoReference() {
      var p = await project();
      if (!p) return fail("No open Premiere Pro project");
      var s = await sequence(p);
      if (!s) return fail("No sequence open — open a sequence in the Timeline");
      var sel = null;
      try { sel = await s.getSelection(); } catch (e) { sel = null; }
      var tis = [];
      try { if (sel && typeof sel.getTrackItems === "function") tis = await sel.getTrackItems(); } catch (e) { tis = []; }
      if (!tis || !tis.length) return fail("No clip selected — select a clip in the Timeline");

      for (var i = 0; i < tis.length; i++) {
        var pi = null;
        try { pi = await tis[i].getProjectItem(); } catch (e) { pi = null; }
        if (!pi) continue;
        var clip = null;
        try { clip = ppro.ClipProjectItem.cast ? ppro.ClipProjectItem.cast(pi) : pi; } catch (e) { clip = pi; }
        var path = "";
        try { if (clip && clip.getMediaFilePath) path = await clip.getMediaFilePath(); } catch (e) { path = ""; }
        if (!path) continue;                    // sintetik klip (title/color matte) — fayl yo'q
        var mt = mediaTypeOf(path);
        return jstr({
          ok: true,
          name: pi.name || "Clip",
          mediaPath: path,
          mediaType: mt === "image" ? "video" : mt,   // AE ham still'ni video referens sifatida beradi
          hasVideo: mt === "video" || mt === "image",
          hasAudio: mt === "audio",
          compName: s.name || "",
        });
      }
      return fail("Selected clip has no media file on disk");
    },

    async exportTimelineFrame() {
      var p = await project();
      if (!p) return fail("No open Premiere Pro project");
      var s = await sequence(p);
      if (!s) return fail("No sequence open — open a sequence in the Timeline");
      if (!ppro.Exporter || !ppro.Exporter.exportSequenceFrame) return fail("Frame export is not available in this Premiere version");
      var dir, t;
      try { dir = await tmpDir(); } catch (e) { return fail(String((e && e.message) || e)); }
      try {
        t = await s.getPlayerPosition();
      } catch (e) {
        t = ppro.TickTime.TIME_ZERO !== undefined ? ppro.TickTime.TIME_ZERO : ppro.TickTime.createWithSeconds(0);
      }
      var name = "ff-frame-" + String(Date.now()) + ".png";   // .bmp/kengaytmasiz TAQIQ (spike: qo'llanmaydi)
      var size = { w: 1280, h: 720 };
      try { var fsz = await s.getFrameSize(); if (fsz && fsz.width) size = { w: fsz.width, h: fsz.height }; } catch (e) { /* default */ }
      try {
        await ppro.Exporter.exportSequenceFrame(s, t, name, dir.nativePath, size.w, size.h);
      } catch (e) {
        return fail("Frame export failed: " + String((e && e.message) || e));
      }
      var f = await waitForFile(dir, name, 6000);
      if (!f) return fail("Frame export produced no file (6s)");
      return jstr({ ok: true, path: f.nativePath, name: name });
    },

    async getWorkAreaInfo() {
      var p = await project();
      if (!p) return fail("No open Premiere Pro project");
      var s = await sequence(p);
      if (!s) return fail("No sequence open — open a sequence in the Timeline");
      var start = 0, end = 0;
      try { var ip = await s.getInPoint(); start = Number(ip && ip.seconds) || 0; } catch (e) { start = 0; }
      try { var op = await s.getOutPoint(); end = Number(op && op.seconds) || 0; } catch (e) { end = 0; }
      if (!(end > start)) {
        try { var ep = await s.getEndTime(); end = Number(ep && ep.seconds) || start; } catch (e) { end = start; }
      }
      return jstr({ ok: true, start: start, end: end, duration: Math.max(0, end - start), sequence: s.name || "" });
    },

    async refreshProjectPanel() {
      var p = await project();
      if (!p) return fail("No open Premiere Pro project");
      var projectPath = String(p.path || "");
      var projectName = String(p.name || projectPath.split(/[\\/]/).pop() || "Premiere Project").replace(/\.prproj$/i, "");
      var seqs = [];
      try { seqs = typeof p.getSequences === "function" ? await p.getSequences() : []; } catch (e) { seqs = []; }
      var tree = [];
      for (var i = 0; i < seqs.length; i++) {
        var name = String((seqs[i] && seqs[i].name) || "Sequence");
        tree.push({ name: name, path: "Sequences/" + name, type: "comp", folder: "Sequences" });
      }
      return jstr({
        ok: true,
        saved: !!projectPath,
        projectFile: projectPath,
        projectName: projectName,
        compCount: tree.length,
        folderCount: 1,
        folders: [{ name: "Sequences", path: "Sequences" }],
        tree: tree,
      });
    },

    async renderSceneStillFrames() {
      var raw = await HOST.exportTimelineFrame();
      var frame = null;
      try { frame = JSON.parse(raw); } catch (e) { frame = null; }
      if (!frame || !frame.ok) return raw;
      var p = await project(), s = await sequence(p);
      var name = (s && s.name) || "Active Sequence";
      return jstr({
        ok: true,
        results: [{ ok: true, path: frame.path, name: name, aeComp: name, width: 0, height: 0, fps: 0, durationSec: 0 }],
      });
    },

    async getHostCapabilities() {
      return jstr({
        ok: true,
        host: "pr",
        bridge: "uxp",
        nativeMogrtImport: true,
        projectTemplateImport: true,
        safeRemoveById: false,
        projectReference: true,
        projectSelectionReference: false,
        timelineReference: true,
        currentFrameReference: true,
        publisher: false,
      });
    },

    /**
     * Shablonni loyihaga import qiladi — AE `importTemplateProject` o'rnida.
     *
     * Javob shakli AE'niki bilan BIR XIL (`{ok,folder,folderId,movedCount,
     * missingFonts}`), chunki chaqiruvchi (AssetFlow_Plugin.html:7059) uni
     * shunday parse qiladi.
     *
     * `folder` BO'SH qaytariladi: `.mogrt` timeline'ga qo'yiladi, loyihada
     * nomli bin yaratilmaydi. Bo'lmagan papkani qaytarsak, chaqiruvchi uni
     * "o'chirish mumkin" deb yozib qo'yadi va keyin o'chirish yolg'on xato
     * beradi (`recordImportedMeta` → `removeImportedTemplate`).
     */
    async importTemplateProject(cfgJson) {
      var cfg = {};
      try { cfg = JSON.parse(cfgJson) || {}; } catch (e) { return jstr({ ok: false, message: "Bad import config" }); }
      var filePath = String(cfg.filePath || "");
      if (!filePath) return jstr({ ok: false, message: "No file path provided" });
      var ext = extOf(filePath);

      // .aep — Premiere ochmaydi. Halol rad: soxta "import bo'ldi" TAQIQ.
      if (ext === "aep" || ext === "aepx") {
        return jstr({ ok: false, message: "This is an After Effects project (.aep). Premiere Pro can't open it — pick the Premiere (.mogrt) version of this template." });
      }

      var p = await project();
      if (!p) return jstr({ ok: false, message: "No open Premiere Pro project" });

      if (ext === "mogrt") {
        var s = await sequence(p);
        if (!s) return jstr({ ok: false, message: "Open a sequence in the Timeline first — Motion Graphics templates are inserted at the playhead." });
        var ed = null;
        try { ed = await ppro.SequenceEditor.getEditor(s); } catch (e) { ed = null; }
        if (!ed || typeof ed.insertMogrtFromPath !== "function") {
          return jstr({ ok: false, message: "Motion Graphics insertion is not available in this Premiere Pro version" });
        }
        var at = await insertPoint(s);
        if (!at.time) return jstr({ ok: false, message: "Could not read the playhead position" });
        var ti = null;
        try { ti = await ed.insertMogrtFromPath(filePath, at.time, at.vTrack, at.aTrack); } catch (e) {
          return jstr({ ok: false, message: "Insert failed: " + String((e && e.message) || e) });
        }
        if (!ti) return jstr({ ok: false, message: "Premiere did not insert the template — check that the sequence is unlocked." });
        // Doimiy nusxa: qayta ishlatish uchun Essential Graphics papkasiga.
        // Bu import'ni BLOKLAMAYDI — muvaffaqiyatsiz bo'lsa jim o'tamiz.
        var installed = false;
        try { installed = JSON.parse(await HOST.installMogrtToLibrary(filePath)).ok === true; } catch (e) { installed = false; }
        return jstr({ ok: true, folder: "", folderId: 0, movedCount: 1, missingFonts: [], installedToLibrary: installed });
      }

      // .prproj — Adobe rasmiy sample naqshi:
      // source projectni ochish → sequence GUID'larini olish → original projectni
      // qayta faollashtirish → `importSequences(sourcePath, ids)`.
      // `importFiles(.prproj)` halol ekvivalent emas: u sequence tanlovini bermaydi
      // va host versiyasiga qarab butun projectni media sifatida rad qilishi mumkin.
      if (ext === "prproj") {
        if (!ppro.Project || typeof ppro.Project.open !== "function" || typeof p.importSequences !== "function") {
          return jstr({ ok: false, message: "Premiere project sequence import is not available in this Premiere Pro version" });
        }
        try {
          if (typeof ppro.Project.isProject === "function" && !ppro.Project.isProject(filePath)) {
            return jstr({ ok: false, message: "Premiere rejected this .prproj file as invalid" });
          }
        } catch (e) { /* 25.6–26.1 da isProject yo'q — open yakuniy tekshiruv */ }

        var source = null;
        var sourcePath = filePath;
        var originalPath = String(p.path || "");
        try {
          var openOpts = null;
          try { openOpts = ppro.OpenProjectOptions ? ppro.OpenProjectOptions() : null; } catch (e) { openOpts = null; }
          if (openOpts) {
            try { if (openOpts.setShowLocateFileDialog) openOpts.setShowLocateFileDialog(false); } catch (e) {}
            try { if (openOpts.setShowWarningDialog) openOpts.setShowWarningDialog(false); } catch (e) {}
            try { if (openOpts.setShowConvertProjectDialog) openOpts.setShowConvertProjectDialog(false); } catch (e) {}
            try { if (openOpts.setAddToMRUList) openOpts.setAddToMRUList(false); } catch (e) {}
          }
          source = await ppro.Project.open(filePath, openOpts || undefined);
          if (!source) return jstr({ ok: false, message: "Could not open the Premiere project template" });
          sourcePath = String(source.path || filePath);
          var seqs = typeof source.getSequences === "function" ? await source.getSequences() : [];
          if (!seqs || !seqs.length) {
            if (originalPath) await ppro.Project.open(originalPath);
            await closeProjectQuietly(source);
            return jstr({ ok: false, message: "This Premiere project contains no sequences to import" });
          }
          var ids = [], names = [];
          for (var si = 0; si < seqs.length; si++) {
            if (seqs[si] && seqs[si].guid) ids.push(seqs[si].guid);
            if (seqs[si] && seqs[si].name) names.push(String(seqs[si].name));
          }
          if (!ids.length) {
            if (originalPath) await ppro.Project.open(originalPath);
            await closeProjectQuietly(source);
            return jstr({ ok: false, message: "Premiere could not read sequence IDs from this project" });
          }
          if (originalPath) await ppro.Project.open(originalPath);
          var imported = await p.importSequences(sourcePath, ids);
          await closeProjectQuietly(source);
          if (!imported) return jstr({ ok: false, message: "Premiere did not import the project sequences" });
          return jstr({
            ok: true,
            folder: "",
            folderId: 0,
            movedCount: ids.length,
            missingFonts: [],
            importedSequences: names,
          });
        } catch (e) {
          try { if (originalPath) await ppro.Project.open(originalPath); } catch (e2) {}
          await closeProjectQuietly(source);
          return jstr({ ok: false, message: "Premiere project import failed: " + String((e && e.message) || e) });
        }
      }

      // Boshqa import qilinadigan turlar — loyiha paneliga.
      var root = null;
      try { root = await p.getRootItem(); } catch (e) { root = null; }
      var okImp = false;
      try { okImp = await p.importFiles([filePath], true, root); } catch (e) {
        return jstr({ ok: false, message: "Import failed: " + String((e && e.message) || e) });
      }
      if (!okImp) return jstr({ ok: false, message: "Premiere rejected the file: " + filePath.split(/[\\/]/).pop() });
      return jstr({ ok: true, folder: "", folderId: 0, movedCount: 1, missingFonts: [] });
    },

    /**
     * Footage to'plami (P35): zip ichida `.mogrt`/`.aep` yo'q, faqat kliplar.
     * Hammasini shablon nomidagi bin'ga import qilishga urinamiz.
     *
     * `folder` FAQAT bin haqiqatan yaratilgan bo'lsa qaytariladi — chaqiruvchi
     * uni toast'da ko'rsatadi (`'… into "'+(br.folder||bundleLabel)+'"'`).
     */
    async importFootageBundle(cfgJson) {
      var cfg = {};
      try { cfg = JSON.parse(cfgJson) || {}; } catch (e) { return jstr({ ok: false, reason: "Bad bundle config" }); }
      var files = Array.isArray(cfg.files) ? cfg.files.filter(Boolean).map(String) : [];
      var label = String(cfg.packLabel || "").trim();
      if (!files.length) return jstr({ ok: false, reason: "No files in the bundle" });

      var p = await project();
      if (!p) return jstr({ ok: false, reason: "No open Premiere Pro project" });
      var root = null;
      try { root = await p.getRootItem(); } catch (e) { root = null; }
      if (!root) return jstr({ ok: false, reason: "Project bin is not readable" });

      var target = await binFor(p, root, label);
      // Diskda yo'q fayllarni oldindan ajratamiz — `importFiles` bitta yiqilgan
      // yo'l uchun BUTUN to'plamni rad etishi mumkin.
      var live = files, missing = 0;
      if (fs) {
        live = [];
        for (var i = 0; i < files.length; i++) {
          try { fs.lstatSync(files[i]); live.push(files[i]); } catch (e) { missing++; }
        }
      }
      if (!live.length) return jstr({ ok: false, reason: "None of the bundle files were found on disk" });

      var okImp = false;
      try { okImp = await p.importFiles(live, true, target.item); } catch (e) {
        return jstr({ ok: false, reason: "Import failed: " + String((e && e.message) || e) });
      }
      if (!okImp) return jstr({ ok: false, reason: "Premiere rejected the import" });
      return jstr({ ok: true, imported: live.length, failed: missing, folder: target.name, folderId: 0 });
    },

    /** `.mogrt` ni Essential Graphics papkasiga o'rnatadi (doimiy, qayta ishlatiladi). */
    async installMogrtToLibrary(filePath) {
      if (!ppro || !ppro.SequenceEditor || !ppro.SequenceEditor.getInstalledMogrtPath) {
        return jstr({ ok: false, reason: "Essential Graphics folder is not exposed by this Premiere Pro version" });
      }
      var egPath = "";
      try { egPath = await ppro.SequenceEditor.getInstalledMogrtPath(); } catch (e) { egPath = ""; }
      if (!egPath) return jstr({ ok: false, reason: "Essential Graphics folder not found" });
      try {
        var eg = await entryAt(egPath);
        var src = await entryAt(filePath);
        // So'rovsiz overwrite TAQIQ: foydalanuvchining mavjud MOGRT'i jimgina
        // almashtirilmasin. Mavjud nom bo'lsa import timeline'da muvaffaqiyatli
        // qoladi, faqat doimiy o'rnatish halol sabab bilan o'tkazib yuboriladi.
        try {
          var existing = await eg.getEntry(src.name);
          if (existing) return jstr({ ok: false, reason: "A Motion Graphics template named '" + src.name + "' is already installed" });
        } catch (e) { /* topilmadi — nusxalash mumkin */ }
        await src.copyTo(eg, { overwrite: false });
        return jstr({ ok: true, path: egPath });
      } catch (e) {
        return jstr({ ok: false, reason: "Install failed: " + String((e && e.message) || e) });
      }
    },

    /** LUT kabi import qilinmaydigan fayllarni OS fayl brauzerida ochadi. */
    async revealFileInOS(filePath) {
      if (!filePath) return fail("No file path provided");
      try {
        // `openPath` faylni tanlab papkani ochadi; bo'lmasa ota-papkani ochamiz.
        if (uxp && uxp.shell && uxp.shell.openPath) { await uxp.shell.openPath(String(filePath)); return jstr({ ok: true }); }
        if (uxp && uxp.shell && uxp.shell.openExternal) {
          var dir = String(filePath).replace(/[\\/][^\\/]*$/, "");
          await uxp.shell.openExternal("file://" + dir);
          return jstr({ ok: true, revealed: false });
        }
      } catch (e) { return jstr({ ok: false, reason: String((e && e.message) || e) }); }
      return jstr({ ok: false, reason: "Revealing files is not available in this Premiere Pro version" });
    },

    /**
     * Loyihadan olib tashlash — HALOL rad.
     *
     * AE'da import nomli papka + comp yaratadi va ularni ID bo'yicha o'chirish
     * mumkin. Premiere'da `.mogrt` timeline KLIPI bo'lib tushadi va uni
     * o'chirishning JONLI tasdiqlangan API'si yo'q (spike §7:
     * `create*Action` + `lockedAccess` naqshi faqat QISMAN ishladi). Xato
     * elementni o'chirishdan ko'ra, aniq ko'rsatma berish xavfsizroq.
     */
    async removeImportedTemplate() {
      return jstr({ ok: false, message: "Premiere Pro inserts templates as timeline clips — delete the clip in the Timeline (or the item in the Project panel) to remove it." });
    },

    /** AE'ga xos: bitta sahnani `.aep` ichidan import qilish. Premiere'da yo'q. */
    async importSingleSceneFromAep() {
      return jstr({ ok: false, message: "Importing a single scene from an After Effects project is an After Effects-only action." });
    },
  };

  // ── dispetcher ──────────────────────────────────────────────────────────────

  /** `script` satridan chaqiruv nomi + argumentlarni ajratadi.
   *  AE ishlatadigan 3 shakl: `FN()`, `FN("arg")`, `(function(){$.evalFile(…); return FN();})()`. */
  function parseCall(script) {
    var s = String(script || "").trim();
    var m = /return\s+([A-Za-z_$][\w$]*)\s*\(([\s\S]*?)\)\s*;?\s*\}\s*\)\s*\(\s*\)\s*$/.exec(s);
    if (m) return { name: m[1], argsText: m[2] };
    m = /^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)\s*;?$/.exec(s);
    if (m) return { name: m[1], argsText: m[2] };
    return null;
  }

  function parseArgs(text) {
    var t = String(text || "").trim();
    if (!t) return [];
    try { return JSON.parse("[" + t + "]"); } catch (e) { /* murakkab ifoda */ }
    return [t];
  }

  async function dispatch(script) {
    var s = String(script || "").trim();

    // jsx bootstrap: `try{$.evalFile("…");"ok"}catch(e){"err"}` — UXP'da host.jsx yo'q,
    // lekin chaqiruvchi faqat "ok" satrini kutadi (ko'prik tirikligi tekshiruvi).
    if (/\$\.evalFile\(/.test(s) && /["']ok["']/.test(s) && !/return\s+[A-Za-z_$]/.test(s)) return "ok";

    var call = parseCall(s);
    if (!call) {
      log.warn("[uxp-shim] tanilmagan evalScript:", s.slice(0, 120));
      return fail("This action is not available in Premiere Pro yet");
    }
    var fn = HOST[call.name];
    if (!fn) {
      log.warn("[uxp-shim] host funksiyasi yo'q:", call.name);
      return fail("`" + call.name + "` is an After Effects-only action");
    }
    try {
      return await fn.apply(null, parseArgs(call.argsText));
    } catch (e) {
      log.error("[uxp-shim]", call.name, e);
      return fail("Internal error: " + String((e && e.message) || e));
    }
  }

  // ── CSInterface yuzasi ──────────────────────────────────────────────────────

  window.SystemPath = window.SystemPath || {
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication",
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
  };

  // AE `getSystemPath(EXTENSION)` ni asosan jsx yo'lini yasash uchun ishlatadi
  // (dispetcher u yo'lni e'tiborsiz qoldiradi), LEKIN bitta chaqiruvchi undan
  // YOZISH uchun foydalanadi: `assetflow-local-store.js:32` u yerda
  // `assetflow-data/` papkasini yasaydi (lokal kesh + meta).
  //
  // O'LCHANGAN MUAMMO: UXP'da plagin papkasi FAQAT O'QISH uchun, ustiga
  // `getPluginFolder()` — ASINXRON, ya'ni boot paytida yo'l hali bo'sh
  // (`""`) edi. Natijada `path.join("", "assetflow-data")` NISBIY yo'l berib
  // `mkdirSync` yiqilardi → `useDisk=false` → kod `indexedDB` shoxiga tushardi
  // (UXP'da u ham yo'q) → har boot'da xato-log va lokal keshsiz panel.
  //
  // DAVO: EXTENSION uchun plaginning YOZILADIGAN ma'lumot papkasini beramiz
  // (`node-io` boot'da keshlagan `getDataFolder()`). U juda erta boot oynasida
  // hali yechilmagan bo'lsa, yoziladigan plugin-temp/native tmpdir ishlatiladi.
  // Read-only `getPluginFolder()`ga HECH QACHON qaytmaymiz. jsx yo'lini
  // yasovchilar uchun farqi yo'q (yo'l dispetcherda baribir ishlatilmaydi),
  // disk backend esa HAQIQATAN yoziladigan joy oladi.
  function writableSystemPath() {
    var io = window.__FFNodeIO;
    var data = (io && io.dataDir && io.dataDir()) || "";
    if (data) return data;
    var temp = (io && io.tmpDir && io.tmpDir()) || "";
    if (temp) return temp;
    try {
      var os = require("os");
      return (os && os.tmpdir && os.tmpdir()) || "";
    } catch (e) {
      return "";
    }
  }

  function CSInterface() {}

  CSInterface.prototype.getSystemPath = function (kind) {
    if (kind === window.SystemPath.HOST_APPLICATION) return "Adobe Premiere Pro";
    return writableSystemPath();
  };
  CSInterface.prototype.evalScript = function (script, cb) {
    dispatch(script).then(function (r) { if (typeof cb === "function") cb(r); });
  };
  // Xatoni YUTMAYMIZ: chaqiruvchi (`assetflow-account.js` → `openExternal`) buni
  // "brauzer ochildi" deb qabul qiladi va `true` qaytaradi. Jim `catch` bo'lsa
  // foydalanuvchiga "brauzerda tasdiqlang" deyilardi, ammo hech narsa ochilmasdi.
  //
  // MUHIM ASIMMETRIYA: CEP'da bu SINXRON va haqiqiy natija beradi; UXP'da esa
  // `openExternal` — ASYNC va RUXSAT SO'RAYDI ("… wants to open: https://…"
  // modali). Foydalanuvchi "Block" bossa, chaqiruv allaqachon `true` qaytargan
  // bo'ladi va panel "Browser opened — type this code there" deb YOLG'ON
  // gapiradi. Shu bois natijani keyin e'lon qilamiz: `ff-open-external`
  // hodisasi + `window.__ffOpenExternalOk` (uni `uxp-external-link.js` kartani
  // halol holatga o'tkazish uchun tinglaydi).
  CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (!uxp || !uxp.shell || !uxp.shell.openExternal) {
      throw new Error("uxp.shell.openExternal mavjud emas");
    }
    var u = String(url);
    function announce(ok, err) {
      window.__ffOpenExternalOk = ok;
      if (!ok) log.error("openExternal rad etildi:", err);
      try {
        window.dispatchEvent(new CustomEvent("ff-open-external", {
          detail: { url: u, ok: ok, error: err ? String(err.message || err) : "" },
        }));
      } catch (e) { /* CustomEvent bo'lmasa — bayroq yetarli */ }
    }
    window.__ffOpenExternalOk = null;   // "hali noma'lum"
    var p = uxp.shell.openExternal(u);
    if (p && typeof p.then === "function") {
      p.then(function () { announce(true, null); }, function (e) { announce(false, e); });
    } else {
      announce(true, null);   // sinxron variant — xato otmadi
    }
    return true;   // AE zanjiri (c) sinxron javob kutadi
  };
  CSInterface.prototype.getHostEnvironment = function () {
    var v = "";
    try { v = String((uxp.host && uxp.host.version) || ""); } catch (e) { /* ixtiyoriy */ }
    return { appName: "PPRO", appVersion: v, appId: "PPRO", appLocale: "en_US" };
  };
  CSInterface.prototype.getApplicationID = function () { return "PPRO"; };
  CSInterface.prototype.getExtensionID = function () { return "com.frameflow.premiere"; };
  CSInterface.prototype.getExtensions = function () { return []; };
  CSInterface.prototype.getOSInformation = function () {
    try { return require("os").platform(); } catch (e) { return "unknown"; }
  };
  // CEP hodisa avtobusi — UXP'da bitta panel, tashqi hodisa manbai yo'q.
  CSInterface.prototype.addEventListener = function () {};
  CSInterface.prototype.removeEventListener = function () {};
  CSInterface.prototype.dispatchEvent = function () {};
  CSInterface.prototype.requestOpenExtension = function () {};
  CSInterface.prototype.closeExtension = function () {};
  CSInterface.prototype.resizeContent = function () {};
  CSInterface.prototype.setWindowTitle = function () {};
  CSInterface.prototype.initResourceBundle = function () { return {}; };

  window.CSInterface = CSInterface;
  window.__ffHostDispatch = dispatch;   // diagnostika uchun

  /*
   * `window.__adobe_cep__` — AE kodining "men host ilova ICHIDAMAN" bayrog'i.
   *
   * AE manbasida 25+ joyda `typeof window.__adobe_cep__ === "undefined"` bilan
   * tekshiriladi va bu HAMMASI xatti-harakatni ikkiga ajratadi:
   *   • yuklab olish / import (`downloadPackToTemp`, `downloadSceneMogrt`,
   *     `extractMogrtItem`) — bayroqsiz "Import only works inside After Effects"
   *     xatosini otadi, ya'ni Premiere'da import UMUMAN ishlamasdi;
   *   • lokal saqlash diskka (`assetflow-local-store`), sozlama fayli
   *     (`settingsFilePath`), vaqtinchalik papka tozalash, shrift hal qilish;
   *   • brauzer ochish zanjiri (`assetflow-account.js` (c) sharti) — Google
   *     kirishida "Couldn't open the browser automatically" AYNAN shundan edi;
   *   • `ae-inline-02.js` dagi FAQAT-BRAUZER QA bloki bayroqsiz Premiere ICHIDA
   *     ham ishlab ketardi.
   * Bayroq berilmagani uchun panel Premiere ichida "brauzer" rejimida yurardi.
   *
   * Faqat HAQIQIY UXP runtime'da qo'yamiz (`uxp` moduli bor). Brauzerdagi 1:1
   * QA harness'ida qo'yilmasin — u yerda AE etaloni ham brauzer rejimida va
   * ikkalasi bir xil shoxni bosishi shart.
   *
   * Shakl: CEP'da bu — native ko'prik obyekti. Bizda CSInterface o'z ustidan
   * ishlaydi, shu bois bu yerda faqat MAVJUDLIK bayrog'i + CEP `CSInterface.js`
   * (agar biror yo'l bilan yuklansa) chaqiradigan bir nechta metod bor.
   */
  if (uxp) {
    window.__adobe_cep__ = window.__adobe_cep__ || {
      __ffUxp: true,
      openURLInDefaultBrowser: function (url) {
        return CSInterface.prototype.openURLInDefaultBrowser(url);
      },
      getSystemPath: function (kind) { return CSInterface.prototype.getSystemPath(kind); },
      getHostEnvironment: function () {
        return JSON.stringify(CSInterface.prototype.getHostEnvironment());
      },
      evalScript: function (script, cb) { CSInterface.prototype.evalScript(script, cb); },
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {},
    };
  }
})();
