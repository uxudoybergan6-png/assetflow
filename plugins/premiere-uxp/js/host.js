/*
 * FrameFlow UXP — host (Premiere) qatlami.
 *
 * BARCHA `premierepro` DOM chaqiriqlari SHU FAYLDA bo'lishi shart: Adobe API drift
 * qilganda tuzatish bitta joyda bo'ladi (system prompt §5). UI modullari `require`
 * qilmaydi.
 *
 * Eslatma (spike §7): hamma metod async; 26.3 dan boshlab har `create*Action`
 * `project.lockedAccess()` ichida bo'lishi shart — shuning uchun tranzaksiya
 * yordamchisi ham shu yerda.
 */
(function () {
  "use strict";

  var uxp = require("uxp");
  var ppro = null;
  try {
    ppro = require("premierepro");
  } catch (e) {
    window.FFLog.error("premierepro modulini yuklab bo'lmadi:", e);
  }

  function available() {
    return !!ppro;
  }

  /** Joriy loyiha (yoki null — loyiha ochilmagan). */
  async function activeProject() {
    if (!ppro) return null;
    try {
      return (await ppro.Project.getActiveProject()) || null;
    } catch (e) {
      window.FFLog.warn("getActiveProject:", e);
      return null;
    }
  }

  /** Joriy ketma-ketlik (yoki null). */
  async function activeSequence(project) {
    var p = project || (await activeProject());
    if (!p) return null;
    try {
      return (await p.getActiveSequence()) || null;
    } catch (e) {
      window.FFLog.warn("getActiveSequence:", e);
      return null;
    }
  }

  /** Panel yuqorisidagi kontekst satri uchun: loyiha + ketma-ketlik nomi.
   *  Import amallarining HALOL disabled sababi ham shundan olinadi. */
  async function context() {
    var out = {
      ok: false,
      projectName: "",
      sequenceName: "",
      videoTrackCount: 0,
      reason: "",
    };
    if (!ppro) {
      out.reason = "Premiere API mavjud emas";
      return out;
    }
    var p = await activeProject();
    if (!p) {
      out.reason = "Loyiha ochilmagan";
      return out;
    }
    out.projectName = p.name || "";
    var s = await activeSequence(p);
    if (!s) {
      out.reason = "Faol ketma-ketlik yo'q";
      return out;
    }
    out.sequenceName = s.name || "";
    try { out.videoTrackCount = await s.getVideoTrackCount(); } catch (e) { /* ixtiyoriy */ }
    out.ok = true;
    return out;
  }

  /** Host dastur versiyasi (mavjud bo'lsa). */
  function hostVersion() {
    try {
      var host = uxp.host || {};
      return String(host.version || "");
    } catch (e) {
      return "";
    }
  }

  /** Tizim brauzerida havola ochish (Google device-code oqimi uchun). */
  async function openExternal(link) {
    try {
      await uxp.shell.openExternal(link);
      return true;
    } catch (e) {
      window.FFLog.error("openExternal:", e);
      return false;
    }
  }

  /** 26.3 talabi: create*Action faqat lockedAccess ichida, ijro executeTransaction bilan.
   *  `build(ctx)` → Action massivi qaytarishi kerak. */
  async function runTransaction(project, name, build) {
    if (!project) throw new Error("Loyiha yo'q");
    var actions = [];
    await project.lockedAccess(function () {
      actions = build() || [];
    });
    if (!actions.length) return false;
    await project.executeTransaction(function (compound) {
      actions.forEach(function (a) { compound.addAction(a); });
    }, name || "FrameFlow");
    return true;
  }

  window.FFHost = {
    available: available,
    ppro: function () { return ppro; },
    activeProject: activeProject,
    activeSequence: activeSequence,
    context: context,
    hostVersion: hostVersion,
    openExternal: openExternal,
    runTransaction: runTransaction,
  };
})();
