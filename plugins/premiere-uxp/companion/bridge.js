/* Invisible Premiere UXP companion: executes only csinterface-shim's allow-list. */
(function (root) {
  "use strict";

  var fs = null, os = null, uxp = null;
  var timer = 0, active = {};
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
    var rootDir = mailboxRoot(), names = [];
    try { names = fs.readdirSync(rootDir); } catch (e) { return; }
    for (var i = 0; i < names.length; i++) {
      var name = String(names[i] || "");
      if (!/^session-[a-f0-9]{32}$/.test(name)) continue;
      var session = name.slice(8), dir = join(rootDir, name);
      var descriptor = readJson(join(dir, "bridge.json"));
      if (!descriptor || descriptor.protocol !== PROTOCOL || descriptor.session !== session || !/^[a-f0-9]{64}$/.test(String(descriptor.secret || ""))) continue;
      try { writeJson(join(dir, "ready.json"), { protocol: PROTOCOL, session: session, secret: descriptor.secret, readyAt: Date.now() }); } catch (e) { continue; }
      var request = readJson(join(dir, "request.json"));
      if (!request || request.protocol !== PROTOCOL || request.session !== session || request.secret !== descriptor.secret || request.id === active[session]) continue;
      if (!/^[a-z0-9-]{6,80}$/i.test(String(request.id || ""))) continue;
      if (typeof request.script !== "string" || request.script.length > 262144) continue;
      var now = Date.now();
      if (!Number(request.createdAt) || !Number(request.deadlineAt) || request.createdAt > now + 5000 || request.deadlineAt < now || request.deadlineAt > now + 200000) continue;
      if (Number(request.pid) !== Number(descriptor.pid)) continue;
      active[session] = request.id;
      var result;
      try { result = await root.__ffHostDispatch(request.script); }
      catch (e) { result = JSON.stringify({ ok: false, reason: String((e && e.message) || e) }); }
      try {
        writeJson(join(dir, "response.json"), {
          protocol: PROTOCOL,
          session: session,
          id: request.id,
          secret: descriptor.secret,
          result: String(result == null ? "" : result),
          finishedAt: Date.now(),
        });
      } catch (e) {}
    }
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
