import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);
const pluginRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const catalogSrc = readFileSync(path.join(pluginRoot, "assetflow-catalog.js"), "utf8");
const panelSrc = readFileSync(path.join(pluginRoot, "AssetFlow_Plugin.html"), "utf8");
const aeHostSrc = readFileSync(path.join(pluginRoot, "jsx/host.jsx"), "utf8");
const prHostSrc = readFileSync(path.join(pluginRoot, "jsx/host-premiere.jsx"), "utf8");
const accountSrc = readFileSync(path.join(pluginRoot, "assetflow-account.js"), "utf8");
const logSrc = readFileSync(path.join(pluginRoot, "assetflow-log.js"), "utf8");
const storeSrc = readFileSync(path.join(pluginRoot, "assetflow-local-store.js"), "utf8");

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "ff-pr-integration-"));
let passed = 0;

function check(name, fn) {
  try {
    const value = fn();
    if (value && typeof value.then === "function") {
      return value.then(() => {
        passed++;
        console.log(`✓ ${name}`);
      });
    }
    passed++;
    console.log(`✓ ${name}`);
    return value;
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

function fixtureFile(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.alloc(2048, 1));
  return filePath;
}

function makeCatalog(hostId, name) {
  const root = path.join(tempRoot, name);
  const settings = path.join(root, "settings");
  mkdirSync(settings, { recursive: true });
  const nodeRequire = (id) => {
    if (id === "os") return { ...os, tmpdir: () => root, homedir: () => root };
    return requireFromHere(id);
  };
  const window = {
    __adobe_cep__: {},
    AFZip: {
      listEntries() { return []; },
      async extractAll(source, dest) {
        if (String(source).includes("assetflow_empty.zip")) return;
        fixtureFile(path.join(dest, "project.aep"));
      },
      extractEntriesSync() {},
    },
  };
  function CSInterface() {}
  CSInterface.prototype.getHostEnvironment = () => ({ appName: hostId });
  const context = vm.createContext({
    window,
    CSInterface,
    AssetFlowSecret: {
      settingsDir: () => settings,
      legacySettingsDir: () => path.join(root, "legacy"),
    },
    URL,
    URLSearchParams,
    AbortController,
    Buffer,
    console,
    fetch: async () => { throw new Error("network must not be used by cached fixtures"); },
    require: nodeRequire,
    process,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(catalogSrc, context, { filename: "assetflow-catalog.js" });
  const catalog = vm.runInContext("AssetFlowCatalog", context);
  return { catalog, root };
}

function cachedZipDir(root, templateId) {
  const dir = path.join(root, `assetflow_${templateId}_unzipped`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

try {
  const requiredHostCalls = [
    "pickDownloadFolder",
    "revealFileInOS",
    "importMediaFromPath",
    "importTemplateProject",
    "importSingleSceneFromAep",
    "importFootageBundle",
    "listProjectFootage",
    "getSelectedProjectReference",
    "getActiveTimelineVideoReference",
    "getWorkAreaInfo",
    "exportTimelineFrame",
    "refreshProjectPanel",
    "renderSceneStillFrames",
    "removeImportedTemplate",
    "getHostCapabilities",
  ];

  await check("shared UI host-call inventory exists in both adapters", () => {
    for (const name of requiredHostCalls) {
      assert.match(aeHostSrc, new RegExp(`function\\s+${name}\\s*\\(`), `AE adapter missing ${name}`);
      assert.match(prHostSrc, new RegExp(`function\\s+${name}\\s*\\(`), `Premiere adapter missing ${name}`);
    }
    assert.match(panelSrc, /removeImportedTemplate\s*\(/);
  });

  await check("Premiere direct MOGRT remains a native .mogrt path", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-direct");
    const source = fixtureFile(path.join(root, "assetflow_direct.mogrt"));
    assert.equal(await catalog.downloadPackToTemp("direct", "template.mogrt", {}), source);
  });

  await check("AE direct MOGRT keeps the established MOGRT-to-AEP path", async () => {
    const { catalog, root } = makeCatalog("AEFT", "ae-direct");
    fixtureFile(path.join(root, "assetflow_direct.mogrt"));
    assert.match(await catalog.downloadPackToTemp("direct", "template.mogrt", {}), /\.aep$/i);
  });

  await check("Premiere selected cached MOGRT remains native", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-selected");
    const mogrt = fixtureFile(path.join(root, "selected.mogrt"));
    assert.equal(await catalog.extractMogrtItem("selected", mogrt), mogrt);
  });

  await check("Premiere ZIP with one MOGRT resolves to the native MOGRT", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-zip-mogrt");
    const mogrt = fixtureFile(path.join(cachedZipDir(root, "one"), "title.mogrt"));
    assert.equal(await catalog.downloadPackToTemp("one", "pack.zip", {}), mogrt);
  });

  await check("Premiere ZIP with PRPROJ resolves to the project template", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-zip-project");
    const project = fixtureFile(path.join(cachedZipDir(root, "project"), "template.prproj"));
    assert.equal(await catalog.downloadPackToTemp("project", "pack.zip", {}), project);
  });

  await check("Premiere ZIP with multiple MOGRTs returns native picker items", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-zip-multi");
    const dir = cachedZipDir(root, "multi");
    const first = fixtureFile(path.join(dir, "a-title.mogrt"));
    const second = fixtureFile(path.join(dir, "b-title.mogrt"));
    await assert.rejects(catalog.downloadPackToTemp("multi", "pack.zip", {}), (error) => {
      assert.equal(error.message, "MOGRT_PACK");
      assert.deepEqual(Array.from(error.mogrtItems, (item) => item.path), [first, second]);
      return true;
    });
  });

  await check("Premiere footage-only ZIP remains a footage bundle", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-zip-footage");
    const clip = fixtureFile(path.join(cachedZipDir(root, "footage"), "content", "clip.mp4"));
    const result = await catalog.downloadPackToTemp("footage", "pack.zip", {});
    assert.equal(result.__footageBundle, true);
    assert.deepEqual(Array.from(result.files), [clip]);
  });

  await check("empty cached ZIP fails closed", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-zip-empty");
    fixtureFile(path.join(root, "assetflow_empty.zip"));
    await assert.rejects(catalog.downloadPackToTemp("empty", "pack.zip", {}), /invalid|empty/i);
  });

  await check("Premiere rejects an AE-only .aep pack", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-wrong-host");
    fixtureFile(path.join(cachedZipDir(root, "wrong"), "template.aep"));
    await assert.rejects(
      catalog.downloadPackToTemp("wrong", "pack.zip", {}),
      /After Effects|wrong host|Premiere/i,
    );
  });

  await check("Premiere rejects a direct cached .aep pack", async () => {
    const { catalog, root } = makeCatalog("PPRO", "pr-wrong-direct");
    fixtureFile(path.join(root, "assetflow_wrong.aep"));
    await assert.rejects(catalog.downloadPackToTemp("wrong", "template.aep", {}), /After Effects|Premiere/i);
  });

  await check("Premiere adapter never sends PRPROJ to importFiles", () => {
    assert.match(prHostSrc, /ext\s*===\s*["']prproj["']/);
    assert.doesNotMatch(prHostSrc, /if\s*\(ext\s*===\s*["']mogrt["']\)[\s\S]{0,180}else\s+r\s*=\s*ffPrImportOne/);
  });

  await check("Premiere account requests carry app=pr in headers and usage bodies", async () => {
    const calls = [];
    const prefs = { client: { token: "test-token", apiBaseUrl: "https://api.example.test" } };
    const context = vm.createContext({
      window: {
        AF_TEMPLATE_APP: "pr",
        ASSETFLOW_STUDIO: { apiUrl: "https://api.example.test" },
        dispatchEvent() {},
        location: { hostname: "" },
        open() {},
      },
      AssetFlowStore: {
        loadPrefs: () => prefs,
        savePrefs(next) { Object.assign(prefs, next); },
      },
      fetch: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, text: async () => JSON.stringify({ user: { id: "u1" } }) };
      },
      AbortController,
      FormData,
      CustomEvent,
      URL,
      console,
      require: requireFromHere,
      process,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    });
    vm.runInContext(accountSrc, context, { filename: "assetflow-account.js" });
    const account = vm.runInContext("AssetFlowAccount", context);
    await account.recordDownload("tpl-download");
    await account.recordImport("tpl-import");
    await account.heartbeat({ deviceLabel: "QA" });
    const hostAwareCalls = calls.filter((call) => /\/api\/plugin\/(?:usage\/(?:download|import)|heartbeat)$/.test(String(call.url)));
    assert.equal(hostAwareCalls.length, 3);
    for (const call of calls) assert.equal(call.options.headers["X-FF-App"], "pr");
    assert.deepEqual(JSON.parse(hostAwareCalls[0].options.body), { templateId: "tpl-download", app: "pr" });
    assert.deepEqual(JSON.parse(hostAwareCalls[1].options.body), { templateId: "tpl-import", app: "pr" });
    assert.equal(JSON.parse(hostAwareCalls[2].options.body).app, "pr");
  });

  await check("updater, logs and local-store events are host-aware", () => {
    assert.match(panelSrc, /platformQuery[\s\S]{0,260}AF_TEMPLATE_APP/);
    assert.match(logSrc, /pr_plugin:\s*["']Premiere Plugin/);
    assert.match(logSrc, /["']X-FF-App["']:\s*appId/);
    assert.match(storeSrc, /\["AEFT",\s*"PPRO"\]\.forEach/);
  });

  await check("Premiere copy adapter covers static and dynamic AE UI terms", () => {
    const start = panelSrc.indexOf("const AF_PREMIERE_COPY_RULES=");
    const end = panelSrc.indexOf("function afApplyHostCopyToTree", start);
    assert.ok(start >= 0 && end > start, "Premiere copy adapter missing");
    const block = panelSrc.slice(start, end);
    const context = vm.createContext({ window: {}, result: "" });
    vm.runInContext(`const AF_IS_PREMIERE=true; ${block}`, context);
    const samples = [
      "Import to AE",
      "AE import only works inside After Effects",
      "Choose from AE Project or upload",
      "AE Project items",
      "AE project footage",
      "Frame from the active composition",
      "Could not get frame — make sure a comp is open in the Timeline",
      "Default import: Comp",
    ];
    for (const sample of samples) {
      context.sample = sample;
      vm.runInContext("result=afHostCopyMessage(sample);", context);
      assert.doesNotMatch(context.result, /Import to AE|AE import|AE Project|AE project footage|inside After Effects|\bcomp(?:osition)?\b/i, sample);
    }
    vm.runInContext("result=afHostCopyMessage('This is an After Effects project pack.');", context);
    assert.equal(context.result, "This is an After Effects project pack.");
  });

  await check("Premiere copy adapter observes UI created after boot", () => {
    assert.match(panelSrc, /function afApplyHostCopyToTree\s*\(/);
    assert.match(panelSrc, /new MutationObserver\s*\(/);
    assert.match(panelSrc, /rec\.addedNodes/);
    assert.match(panelSrc, /attributeFilter:\['title','aria-label','placeholder'\]/);
    assert.match(panelSrc, /afApplyHostCopyToTree\(document\.body\)/);
    assert.match(panelSrc, /setText\('#impComp','Timeline'\)/);
    assert.match(panelSrc, /setText\('#impBin','Project panel'\)/);
    assert.match(panelSrc, /class="af-tb-host">Premiere Pro</);
    assert.match(panelSrc, /class="sb-host-badge"[^>]*>Pr</);
  });

  await check("Premiere partial media import is reported as Project-panel success", () => {
    assert.match(panelSrc, /AF_IS_PREMIERE&&mr&&mr\.partial/);
    assert.match(panelSrc, /Imported to the Premiere Project panel, but not added to the Timeline/);
    assert.match(panelSrc, /result==='media:partial'/);
    assert.match(panelSrc, /importPref\.closest\('\.set-prefrow'\)\.style\.display='none'/);
  });

  await check("Premiere boot records host health and escapes an empty default catalog", () => {
    assert.match(panelSrc, /localStorage\.setItem\('af_host_health'/);
    assert.match(panelSrc, /AssetFlowLog\.info\('Host bridge ready'/);
    assert.match(panelSrc, /AssetFlowLog\.error\('Host bridge unavailable'/);
    assert.match(panelSrc, /const fallbacks=\['motion','graphics','luts','music','sfx'\]/);
    assert.match(panelSrc, /applyNavSwitch\(currentNav,\{noReload:true\}\)/);
    assert.doesNotMatch(panelSrc, /applyNavSwitch\('video',\{noReload:true\}\)/);
  });

  await check("Premiere engine-wide EvalScript failure falls back to the UXP host companion", () => {
    const start = panelSrc.indexOf("function afPremiereScriptEngineMessage");
    const end = panelSrc.indexOf("function hostEvalGuarded", start);
    assert.ok(start >= 0 && end > start, "shared evalScript adapter missing");
    const block = panelSrc.slice(start, end);
    const saved = new Map();
    const context = vm.createContext({
      window: {
        AF_UXP_BRIDGE: {
          evalScript(script, callback) {
            assert.equal(script, "listProjectFootage()");
            callback(JSON.stringify({ ok: true, count: 3, bridge: "uxp" }));
          },
        },
      },
      localStorage: { setItem(key, value) { saved.set(key, value); } },
      csInterface: { evalScript(_script, callback) { callback("EvalScript error."); } },
      JSON,
      Date,
      result: "",
    });
    vm.runInContext(`const AF_IS_PREMIERE=true; ${block}; afEvalScript('listProjectFootage()',function(raw){result=raw;});`, context);
    const result = JSON.parse(context.result);
    assert.equal(result.ok, true);
    assert.equal(result.bridge, "uxp");
    assert.equal(JSON.parse(saved.get("af_host_health")).bridge, "uxp");

    context.window.AF_UXP_BRIDGE = null;
    vm.runInContext("result=''; afEvalScript('1+1',function(raw){result=raw;});", context);
    const failure = JSON.parse(context.result);
    assert.equal(failure.ok, false);
    assert.equal(failure.error, "premiere_uxp_bridge_unavailable");
    assert.match(failure.message, /host bridge is unavailable/i);
  });

  console.log(`Premiere CEP integration: ${passed} checks passed`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
