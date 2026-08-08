/*
 * FrameFlow CEP -> Premiere UXP host bridge.
 *
 * Premiere 26.2 can keep CEP/Node alive while its ExtendScript engine returns
 * only `EvalScript error.`.  The visible CEP panel therefore keeps its proven
 * UI/network/download code and delegates only allow-listed host calls to the
 * invisible UXP companion.  Transport is a per-user, mode-0700 file mailbox;
 * no localhost port and no arbitrary JavaScript evaluation are involved.
 */
(function (root) {
  "use strict";

  var queue = Promise.resolve();
  var state = null;
  var PROTOCOL = 1;
  var READY_WAIT_MS = 2500;
  var RESPONSE_WAIT_MS = 190000;

  function nodeRequire(name) {
    try { if (typeof require === "function") return require(name); } catch (e) {}
    try { if (typeof cep_node !== "undefined" && cep_node && cep_node.require) return cep_node.require(name); } catch (e) {}
    try { if (root.cep_node && root.cep_node.require) return root.cep_node.require(name); } catch (e) {}
    try { if (typeof root.require === "function") return root.require(name); } catch (e) {}
    return null;
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function randomHex(bytes, crypto) {
    try { return crypto.randomBytes(bytes).toString("hex"); } catch (e) {}
    var out = "";
    while (out.length < bytes * 2) out += Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
    return out.slice(0, bytes * 2);
  }

  function mailboxRoot(os, path) {
    var platform = "";
    try { platform = os.platform(); } catch (e) {}
    var tmp = "";
    try { tmp = os.tmpdir(); } catch (e) {}
    if (platform === "darwin") tmp = "/tmp";
    return path.join(tmp || ".", "com.frameflow.premiere.host-bridge");
  }

  function atomicJson(fs, path, file, value) {
    var tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(value), { encoding: "utf8", mode: 384 });
    try { fs.renameSync(tmp, file); }
    catch (e) {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
      fs.renameSync(tmp, file);
    }
  }

  function safeUnlink(fs, file) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) {}
  }

  function init() {
    if (state) return state;
    var fs = nodeRequire("fs"), os = nodeRequire("os"), path = nodeRequire("path"), crypto = nodeRequire("crypto");
    if (!fs || !os || !path || !crypto) throw new Error("CEP Node bridge modules are unavailable");
    var dir = mailboxRoot(os, path);
    fs.mkdirSync(dir, { recursive: true, mode: 448 });
    try { fs.chmodSync(dir, 448); } catch (e) {}
    state = {
      fs: fs,
      path: path,
      dir: dir,
      secret: randomHex(32, crypto),
      request: path.join(dir, "request.json"),
      response: path.join(dir, "response.json"),
      descriptor: path.join(dir, "bridge.json"),
      ready: path.join(dir, "ready.json"),
    };
    safeUnlink(fs, state.request);
    safeUnlink(fs, state.response);
    safeUnlink(fs, state.ready);
    atomicJson(fs, path, state.descriptor, {
      protocol: PROTOCOL,
      secret: state.secret,
      pid: typeof process !== "undefined" ? process.pid : 0,
      createdAt: Date.now(),
    });
    return state;
  }

  function readJson(fs, file) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return null; }
  }

  async function waitReady(s) {
    var until = Date.now() + READY_WAIT_MS;
    while (Date.now() < until) {
      var ready = readJson(s.fs, s.ready);
      if (ready && ready.protocol === PROTOCOL && ready.secret === s.secret) return true;
      await sleep(75);
    }
    return false;
  }

  async function runOne(script) {
    var s = init();
    if (!(await waitReady(s))) throw new Error("Premiere UXP host companion is not running");
    var id = Date.now().toString(36) + "-" + randomHex(8, nodeRequire("crypto"));
    safeUnlink(s.fs, s.response);
    atomicJson(s.fs, s.path, s.request, {
      protocol: PROTOCOL,
      id: id,
      secret: s.secret,
      script: String(script || ""),
      createdAt: Date.now(),
    });
    var until = Date.now() + RESPONSE_WAIT_MS;
    while (Date.now() < until) {
      var response = readJson(s.fs, s.response);
      if (response && response.protocol === PROTOCOL && response.id === id && response.secret === s.secret) {
        safeUnlink(s.fs, s.request);
        safeUnlink(s.fs, s.response);
        return String(response.result == null ? "" : response.result);
      }
      await sleep(60);
    }
    safeUnlink(s.fs, s.request);
    throw new Error("Premiere UXP host companion timed out");
  }

  function evalScript(script, callback) {
    var done = typeof callback === "function" ? callback : function () {};
    queue = queue.catch(function () {}).then(function () { return runOne(script); });
    queue.then(done, function (error) {
      done(JSON.stringify({
        ok: false,
        error: "premiere_uxp_bridge_unavailable",
        reason: String((error && error.message) || error),
        message: String((error && error.message) || error),
      }));
    });
  }

  root.AF_UXP_BRIDGE = { evalScript: evalScript, protocol: PROTOCOL };
})(window);
