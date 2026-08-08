/* FrameFlow dual-host CEP bootstrap.
 * Keep the large AE implementation isolated from Premiere's ExtendScript engine:
 * several AE-only globals are valid only after the correct host file is loaded. */
(function () {
  var appName = "";
  try { appName = String(BridgeTalk.appName || "").toLowerCase(); } catch (e1) {}
  try { if (!appName && app && app.name) appName = String(app.name).toLowerCase(); } catch (e2) {}
  var isPremiere = appName.indexOf("premiere") >= 0 || appName === "ppro";
  var here = new File($.fileName).parent;
  var target = new File(here.fsName + "/" + (isPremiere ? "host-premiere.jsx" : "host.jsx"));
  if (!target.exists) throw new Error("FrameFlow host adapter missing: " + target.fsName);
  $.evalFile(target);
})();
