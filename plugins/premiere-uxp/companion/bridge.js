/* Invisible Premiere UXP companion: executes only csinterface-shim's allow-list. */
(function (root) {
  "use strict";

  var fs = null, os = null, uxp = null;
  var timer = 0, activeId = "", secret = "";
  var PROTOCOL = 1;
  try { fs = require("fs"); os = require("os"); uxp = require("uxp"); } catch (e) {}

  function join(dir, name) {
    var sep = /\\$/.test(String(dir || "")) ? "" : (/^[A-Za-z]:/.test(String(dir || "")) ? "\\" : "/");
    return String(dir || "") + sep + String(name || "");
  }

  function mailboxRoot() {
    var platform = "", tmp = "";
    try { platform = os.platform(); } catch (e) {}
    try { tmp = os.tmpdir(); } catch (e) {}
    if (platform === "darwin") tmp = "/tmp";
    return join(tmp || ".", "com.frameflow.premiere.host-bridge");
  }

  function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return null; }
  }

  function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value), { encoding: "utf8" });
  }

  async function tick() {
    if (!fs || !os || typeof root.__ffHostDispatch !== "function") return;
    var dir = mailboxRoot();
    var descriptor = readJson(join(dir, "bridge.json"));
    if (!descriptor || descriptor.protocol !== PROTOCOL || !/^[a-f0-9]{64}$/.test(String(descriptor.secret || ""))) return;
    if (secret !== descriptor.secret) {
      secret = descriptor.secret;
      activeId = "";
      try { writeJson(join(dir, "ready.json"), { protocol: PROTOCOL, secret: secret, readyAt: Date.now() }); } catch (e) { return; }
    }
    var request = readJson(join(dir, "request.json"));
    if (!request || request.protocol !== PROTOCOL || request.secret !== secret || request.id === activeId) return;
    if (!/^[a-z0-9-]{6,80}$/i.test(String(request.id || ""))) return;
    if (typeof request.script !== "string" || request.script.length > 262144) return;
    activeId = request.id;
    var result;
    try { result = await root.__ffHostDispatch(request.script); }
    catch (e) { result = JSON.stringify({ ok: false, reason: String((e && e.message) || e) }); }
    try {
      writeJson(join(dir, "response.json"), {
        protocol: PROTOCOL,
        id: request.id,
        secret: secret,
        result: String(result == null ? "" : result),
        finishedAt: Date.now(),
      });
    } catch (e) {}
  }

  function start() {
    if (timer || !fs || !os) return;
    timer = setInterval(function () { tick().catch(function () {}); }, 75);
    tick().catch(function () {});
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = 0;
  }

  try {
    if (uxp && uxp.entrypoints && uxp.entrypoints.setup) {
      uxp.entrypoints.setup({
        plugin: { create: start, destroy: stop },
        commands: { frameflowHostService: start },
      });
    }
  } catch (e) {}
  start();
})(window);
