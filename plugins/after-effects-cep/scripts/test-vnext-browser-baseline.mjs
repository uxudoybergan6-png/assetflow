import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../../..");
const PLUGIN_DIR = path.resolve(process.env.FF_PLUGIN_ROOT || path.join(ROOT, "plugins/after-effects-cep"));
const AXE_SOURCE = readFileSync(path.join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const V2 = process.argv.includes("--v2");
const INSTALLED_ACTIVATION = process.env.FF_VNEXT_USE_INSTALLED_ACTIVATION === "1";
const OUT_FILE = path.join(ROOT, `docs/vnext-baseline/${V2 ? "browser-v2-baseline" : "browser-baseline"}.json`);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORTS = [
  [320, 400], [320, 600], [380, 600], [380, 720], [600, 650], [600, 900], [1000, 900],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".jsx": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  })[ext] || "application/octet-stream";
}

function staticServer() {
  return createServer((req, res) => {
    const raw = decodeURIComponent(String(req.url || "/").split("?")[0]);
    const relative = raw === "/" ? "AssetFlow_Plugin.html" : raw.replace(/^\/+/, "");
    const file = path.resolve(PLUGIN_DIR, relative);
    if (file !== PLUGIN_DIR && !file.startsWith(`${PLUGIN_DIR}${path.sep}`)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
    createReadStream(file).pipe(res);
  });
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      const listeners = this.events.get(message.method) || [];
      this.events.delete(message.method);
      listeners.forEach((resolve) => resolve(message.params || {}));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, timeoutMs = 10_000) {
    return Promise.race([
      new Promise((resolve) => {
        const list = this.events.get(method) || [];
        list.push(resolve);
        this.events.set(method, list);
      }),
      sleep(timeoutMs).then(() => { throw new Error(`Timed out waiting for ${method}`); }),
    ]);
  }
  close() { try { this.ws.close(); } catch {} }
}

async function devtoolsPort(profile) {
  const file = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(file)) return Number(readFileSync(file, "utf8").split(/\r?\n/)[0]);
    await sleep(50);
  }
  throw new Error("Chrome DevTools port did not become ready");
}

async function target(port) {
  for (let i = 0; i < 100; i += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) => res.json());
      const page = list.find((item) => item.type === "page");
      if (page) return page;
    } catch {}
    await sleep(50);
  }
  throw new Error("Chrome page target did not become ready");
}

const AUDIT_EXPRESSION = `(() => {
  const visible = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const focusable = [...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter((el) => visible(el) && !el.disabled && el.tabIndex >= 0);
  const unnamed = focusable.filter((el) => !String(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').trim()).map((el) => el.id || el.tagName).slice(0, 20);
  const activeViews = [...document.querySelectorAll('[id^="v-"]')].filter(visible).map((el) => el.id);
  const rects = [...document.querySelectorAll('body *')].filter(visible).map((el) => ({ id: el.id || '', tag: el.tagName, r: el.getBoundingClientRect() }));
  const clipped = rects.filter((item) => item.r.right > innerWidth + 1 || item.r.left < -1).map((item) => item.id || item.tag).slice(0, 30);
  return {
    title: document.title,
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    activeViews,
    focusableCount: focusable.length,
    unnamedFocusable: unnamed,
    clippedElements: clipped,
    primaryIds: (window.__FF_V2_TEST__ ? ['ffV2Root','ffV2Content'] : ['ffCreateStart','ffCreateComposer','ffActivityBtn','hdrCred','hdrAva']).reduce((out,id)=>{out[id]=!!document.getElementById(id);return out;},{}),
    runtimeErrors: Array.isArray(window.__afRuntimeErrors) ? window.__afRuntimeErrors.length : 0,
  };
})()`;

async function main() {
  assert.ok(existsSync(CHROME), "Google Chrome is required for the real-browser baseline");
  const server = staticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const profileRoot = mkdtempSync(path.join(tmpdir(), "ff-vnext-browser-"));
  const profile = path.join(profileRoot, "profile");
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update", "--disable-sync",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  let cdp;
  try {
    const debugPort = await devtoolsPort(profile);
    const page = await target(debugPort);
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `window.__adobe_cep__={};window.AF_TEMPLATE_APP='ae';window.__FF_V2_TEST__=${V2};${V2 && !INSTALLED_ACTIVATION ? "window.__FF_BUILD_GENERATION__='legacy-free';" : ""}`,
    });
    await cdp.send("Network.setBlockedURLs", { urls: ["*api.getframeflow.app*", "*googleapis.com*", "*gstatic.com*"] });
    const results = [];
    for (const [width, height] of VIEWPORTS) {
      if (process.env.FF_VNEXT_DEBUG) process.stderr.write(`vNext browser ${width}x${height}: load\n`);
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: `http://127.0.0.1:${port}/AssetFlow_Plugin.html?ff-baseline=1` });
      await loaded;
      await sleep(700);
      if (process.env.FF_VNEXT_DEBUG) process.stderr.write(`vNext browser ${width}x${height}: route/audit\n`);
      const audit = await cdp.send("Runtime.evaluate", { expression: AUDIT_EXPRESSION, returnByValue: true });
      let routeAudit = null;
      let routeTimings = null;
      let keyboardAudit = null;
      let resourceAudit = null;
      if (V2) {
        const routed = await cdp.send("Runtime.evaluate", { expression: `(async()=>{const out={},timings={};for(const route of ['home','create','browse','activity','library','sessions','projects','settings','account']){const b=document.querySelector('[data-ff-v2-route="'+route+'"]');if(!b){out[route]='missing';continue;}const started=performance.now();b.click();await new Promise(resolve=>setTimeout(resolve,20));timings[route]=performance.now()-started;out[route]=(document.querySelector('#ffV2Content h1')||{}).textContent||'';}return {out,timings};})()`, awaitPromise: true, returnByValue: true });
        routeAudit = routed.result.value.out;
        routeTimings = routed.result.value.timings;
        await cdp.send("Runtime.evaluate", { expression: `document.querySelector('[data-ff-v2-route="browse"]').focus()` });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", keyIdentifier: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
        await sleep(40);
        keyboardAudit = (await cdp.send("Runtime.evaluate", { expression: `({heading:(document.querySelector('#ffV2Content h1')||{}).textContent||'',active:(document.activeElement&&document.activeElement.textContent||'').trim()})`, returnByValue: true })).result.value;
        await cdp.send("Runtime.evaluate", { expression: `document.querySelector('[data-ff-v2-route="account"]').click()` });
        if (width === VIEWPORTS[0][0] && height === VIEWPORTS[0][1]) resourceAudit = (await cdp.send("Runtime.evaluate", { expression: `(async()=>{const before=FFVNext.resources.counts();for(let i=0;i<25;i++){await FFVNext.shell.router.go('account');await FFVNext.shell.router.go('settings');}const after=FFVNext.resources.counts();await FFVNext.shell.router.go('account');return {before,after,transitions:50};})()`, awaitPromise: true, returnByValue: true })).result.value;
      }
      await cdp.send("Runtime.evaluate", { expression: AXE_SOURCE });
      if (process.env.FF_VNEXT_DEBUG) process.stderr.write(`vNext browser ${width}x${height}: axe\n`);
      const axe = await cdp.send("Runtime.evaluate", { expression: `(async()=>{const result=await axe.run(${V2 ? "document.getElementById('ffV2Root')" : "document"},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));})()`, awaitPromise: true, returnByValue: true });
      const performanceAudit = (await cdp.send("Runtime.evaluate", { expression: `({shellUsableMs:performance.now(),domContentLoadedMs:(performance.getEntriesByType('navigation')[0]||{}).domContentLoadedEventEnd||0,transferBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+(r.transferSize||0),0)})`, returnByValue: true })).result.value;
      if (process.env.FF_VNEXT_DEBUG) process.stderr.write(`vNext browser ${width}x${height}: fixture/screenshot\n`);
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const screenshot = Buffer.from(shot.data, "base64");
      let fixtureAudit = null;
      if (V2) {
        const fixture = await cdp.send("Runtime.evaluate", { expression: `(async()=>{const calls=[];FFVNext.accountAdapter.controller={getCachedUser:()=>({id:'fixture-user',name:'Fixture',aiCredits:50}),request:async(path,options={})=>{calls.push({path,method:options.method||'GET',body:options.body||null});if(path==='/api/studio/gen/models')return {models:[{id:1,mode:'image',label:'Fixture Image',refKind:'none',available:true,imgSettings:{aspect:{options:['1:1','16:9'],def:'16:9'},quality:{label:'Quality',options:['draft','high'],def:'high',cost:{draft:1,high:2}},num:[1,2]}}]};if(path==='/api/studio/gen/sessions')return options.method==='POST'?{id:'session-fixture'}:{items:[]};if(path==='/api/studio/gen/cost-quote')return {signature:'signed-fixture',pricedParams:options.body.params,price:2,cost:2};if(path==='/api/studio/gen')return {jobId:'job-fixture',status:'queued'};if(path==='/api/studio/gen/job-fixture')return {id:'job-fixture',status:'completed'};if(path.startsWith('/api/studio/gen/history'))return {items:[]};if(path==='/api/studio/projects')return {items:[]};return {items:[]};}};FFVNext.accountAdapter.lastAccount=null;FFVNext.accountAdapter.sync();await FFVNext.shell.router.go('create',{mode:'image'});const prompt=document.querySelector('#ffV2Content [name=prompt]');prompt.value='fixture prompt';document.querySelector('#ffV2Content form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,250));const generation={status:(document.querySelector('.ff-v2-status')||{}).textContent||'',model:(document.querySelector('[name=modelId]')||{}).value||'',params:(calls.find(call=>call.path==='/api/studio/gen/cost-quote')||{body:{params:null}}).body.params};AssetFlowCatalog.fetchCatalog=async()=>({items:[{id:'tpl-fixture',name:'Fixture Template',catLabel:'Titles',hasPack:true}]});AssetFlowCatalog.fetchTemplateDetail=async()=>({id:'tpl-fixture',name:'Fixture Template',description:'Fixture detail',catLabel:'Titles',hasPack:true});await FFVNext.shell.router.go('browse',{search:'motion'});await new Promise(r=>setTimeout(r,30));document.querySelector('[data-ff-action=browse-detail]').click();await new Promise(r=>setTimeout(r,30));const detail={title:(document.querySelector('.ff-v2-detail h2')||{}).textContent||'',importAction:!!document.querySelector('[data-ff-action=template-import]')};document.querySelector('[data-ff-action=browse-back]').click();await new Promise(r=>setTimeout(r,30));detail.restoredSearch=(document.querySelector('[name=search]')||{}).value||'';return {calls,status:generation.status,model:generation.model,params:generation.params,browse:detail};})()`, awaitPromise: true, returnByValue: true });
        fixtureAudit = fixture.result.value;
      }
      results.push({
        viewport: `${width}x${height}`,
        ...audit.result.value,
        ...(routeAudit ? { routeAudit } : {}),
        ...(routeTimings ? { routeTimings } : {}),
        ...(keyboardAudit ? { keyboardAudit } : {}),
        ...(resourceAudit ? { resourceAudit } : {}),
        axeViolations: axe.result.value,
        performance: performanceAudit,
        ...(fixtureAudit ? { fixtureAudit } : {}),
        screenshot: { bytes: screenshot.length, sha256: sha256(screenshot) },
      });
    }
    const baseline = {
      schemaVersion: 1,
      browser: "Google Chrome headless",
      source: "plugins/after-effects-cep/AssetFlow_Plugin.html",
      mode: V2 ? "legacy-free V2 default-on" : "dual-stack V1 default-off",
      networkPolicy: "production API and external font requests blocked; CEP-mode guest/local layout only",
      screenshots: "captured in memory; hashes retained, binary images are CI artifacts rather than source files",
      results,
    };
    if (process.argv.includes("--write")) {
      writeFileSync(OUT_FILE, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    } else {
      const saved = JSON.parse(readFileSync(OUT_FILE, "utf8"));
      assert.deepEqual(saved.results.map((item) => item.viewport), baseline.results.map((item) => item.viewport));
      assert.equal(saved.source, baseline.source);
    }
    for (const result of results) {
      assert.equal(result.horizontalOverflow, false, `${result.viewport} has page-level horizontal overflow`);
      assert.equal(result.unnamedFocusable.length, 0, `${result.viewport} has unnamed focusable controls: ${result.unnamedFocusable.join(", ")}`);
      assert.ok(result.focusableCount > 0, `${result.viewport} has no keyboard focus targets`);
      assert.deepEqual(result.axeViolations, [], `${result.viewport} has axe violations: ${result.axeViolations.map(item => item.id).join(", ")}`);
      assert.ok(Object.values(result.primaryIds).every(Boolean), `${result.viewport} is missing primary shared UI IDs`);
      if (V2) assert.deepEqual(result.routeAudit, { home: 'Welcome to FrameFlow', create: 'Create', browse: 'Browse', activity: 'Activity', library: 'Library', sessions: 'Sessions', projects: 'Projects', settings: 'Settings', account: 'Account' }, `${result.viewport} V2 route lifecycle failed`);
      if (V2) {
        assert.equal(result.keyboardAudit.heading, 'Browse', `${result.viewport} keyboard activation did not open Browse`);
        if (result.resourceAudit) { assert.equal(result.resourceAudit.transitions, 50); assert.deepEqual(result.resourceAudit.after, result.resourceAudit.before, `${result.viewport} leaked tracked resources after 50 route transitions`); }
        assert.ok(Math.max(...Object.values(result.routeTimings)) <= 200, `${result.viewport} exceeded the 200 ms route-switch budget`);
        assert.ok(result.performance.shellUsableMs <= 1500, `${result.viewport} exceeded the 1.5 s local-shell budget`);
        const paths = result.fixtureAudit.calls.map(call => call.path);
        assert.ok(paths.includes('/api/studio/gen/models'), `${result.viewport} V2 models were not loaded`);
        assert.ok(paths.includes('/api/studio/gen/cost-quote'), `${result.viewport} V2 quote was not requested`);
        assert.ok(paths.includes('/api/studio/gen'), `${result.viewport} V2 generation was not submitted`);
        assert.equal(result.fixtureAudit.model, '1', `${result.viewport} V2 model selection failed`);
        assert.deepEqual(result.fixtureAudit.params, { aspectRatio: '16:9', quality: 'high', count: 1 }, `${result.viewport} V2 capability settings were not quoted canonically`);
        assert.deepEqual(result.fixtureAudit.browse, { title: 'Fixture Template', importAction: true, restoredSearch: 'motion' }, `${result.viewport} V2 Browse list/detail/Back flow failed`);
      }
    }
    console.log(`vNext ${V2 ? "V2 shell " : ""}browser baseline: ${results.length}/${VIEWPORTS.length} viewports passed${process.argv.includes("--write") ? " and snapshot written" : ""}`);
  } finally {
    if (cdp) cdp.close();
    chrome.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => chrome.once("exit", resolve)),
      sleep(2_000),
    ]);
    await new Promise((resolve) => server.close(resolve));
    rmSync(profileRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

await main();
