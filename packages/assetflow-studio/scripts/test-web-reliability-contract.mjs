import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("packages/assetflow-studio/platform/index.html", "utf8");
const adminBusiness = fs.readFileSync("packages/assetflow-studio/js/admin-business.js", "utf8");
const adminViews = fs.readFileSync("packages/assetflow-studio/js/admin-views2.js", "utf8");
const adminMedia = fs.readFileSync("packages/assetflow-studio/js/admin-media.js", "utf8");

// Global health Ready bo'lsa ham current mode'da model bo'lmasa Generate/Enhance yopiq va
// status "Ready" emas. Bu partial-mode outage regressiyasini ushlaydi.
assert.match(html, /const enhanceBlocked = this\.state\.enhBusy \|\| !aiServiceReady \|\| !model/);
assert.match(html, /const genBlocked = !aiServiceReady \|\| !model \|\| this\.state\.genSubmitting/);
assert.match(html, /else if \(!model\) genStatusText = 'No ' \+ tool\.short \+ ' model is currently available'/);
assert.match(html, /else if \(axPromptReady && !genGateOn[\s\S]{0,180}genStatusText = 'Ready'/);
assert.match(html, /if \(!model\) \{ this\.toast\('No ' \+ tool\.short \+ ' model is currently available', 'error'\); this\.loadModels\(\); return; \}/);
assert.match(html, /if \(\(requestFailures \|\| assessment\.retryable\) && a < 2\)/);
assert.match(html, /if \(sessionEpoch !== \(this\._creditSessionEpoch \|\| 0\)\) return;/);
assert.match(html, /this\._modelsBusyEpoch === sessionEpoch/);

// Health storageReady/s3 + moderation/provider readiness model ro'yxatidan ustun.
assert.match(html, /settled\(FFAPI\.genHealth\(\)\)/);
assert.match(html, /FFAPI\.assessAiReadiness\(healthResult\.ok \? healthResult\.value : null, rows\)/);
assert.match(html, /if \(!assessment\.ready\) Object\.keys\(gm\)/);

// `/gen` creditsLeft post-charge absolute balance: activeJobs qiymatini yana ayirmaydi.
assert.match(html, /const availCredits = this\.state\.credits;/);
assert.doesNotMatch(html, /this\.state\.credits\s*-\s*committedCredits/);
assert.match(html, /FFAPI\.reconcileChargedBalance\(s\.credits, floor, s\.creditsLoaded\)/);
assert.match(html, /this\._creditsBusy && this\._creditsBusyEpoch === epoch/);
assert.match(html, /if \(epoch !== \(this\._creditSessionEpoch \|\| 0\)\) return;/);

// Account almashganda barcha user-scoped kolleksiyalar, busy guard va tiklanadigan
// active-job yozuvlari tozalanadi; eski request epoch'lari yaroqsiz qilinadi.
const resetUserStateMethod = extractMethod(html, "resetUserState(extra)");
assert.match(resetUserStateMethod, /sessionStorage\.removeItem\('ff_active_jobs'\)/);
assert.match(resetUserStateMethod, /this\._ledgerEpoch = \(this\._ledgerEpoch \|\| 0\) \+ 1/);
assert.match(resetUserStateMethod, /this\._sessionsEpoch = \(this\._sessionsEpoch \|\| 0\) \+ 1/);
assert.match(resetUserStateMethod, /this\._projectsEpoch = \(this\._projectsEpoch \|\| 0\) \+ 1/);
assert.match(resetUserStateMethod, /ledger: \[\], ledgerTotals: null, ledgerLoaded: false/);
assert.match(resetUserStateMethod, /downloads: \[\], downloadsLoaded: false/);
assert.match(resetUserStateMethod, /exploreSubs: \{\}, exploreModal: null/);

// Template pack CTA real artifact + loading state bilan fail-close; logical retry stable UUID.
assert.match(html, /canDownload: !!dRaw\.hasPack && !this\.state\.templateDownloadBusy/);
assert.match(html, /Pack is not available yet/);
assert.match(html, /this\._templateDownloadRequest = \{ id: d\.id, key: FFAPI\.uuid\(\) \}/);
assert.match(html, /FFAPI\.packLink\(d\.id, requestKey\)/);
assert.match(html, /if \(!\(e && e\.message === 'NETWORK'\)\) this\._templateDownloadRequest = null/);

// Signup production runtime config'siz yuborilmaydi; widget bloklansa aniq recovery beriladi.
assert.match(html, /if \(!turnstile \|\| !turnstile\.enabled \|\| !turnstile\.siteKey\) throw new Error\('Bot protection is not configured'\)/);
assert.match(html, /const configReady = await this\.loadRuntimeConfig\(this\._turnstileConfigError\)/);
assert.match(html, /if \(this\.state\.authMode !== 'register'\) \{\s*this\.setState\(\{ authBusy: false \}\);\s*return;/);
assert.match(html, /if \(st\.authMode === 'register' && !this\._turnstileToken\)/);
assert.match(html, /Allow challenges\.cloudflare\.com/);

// Refund matni faqat server tasdig'iga bog'liq, generik error hech qachon refund va'da qilmaydi.
assert.match(html, /const refundConfirmed = refundRaw === true/);
assert.doesNotMatch(html, /your credits were refunded/);
assert.match(html, /g\.refunded && g\.cost \? \(' · ✦' \+ g\.cost \+ ' refunded'\)/);
assert.match(html, /g\.cost \? ' · refund confirmation pending'/);

// Clipboard Promise await qilinadi va fallback ham muvaffaqiyatini tekshiradi.
assert.match(html, /await navigator\.clipboard\.writeText\(value\)/);
assert.match(html, /document\.execCommand && document\.execCommand\('copy'\) === true/);

// Admin payout/UI: eligible payable summa ko'rsatiladi; fake Receipt/Add action yo'q.
assert.match(adminBusiness, /PAYABLE AMOUNT/);
assert.match(adminBusiness, /value="\$\{bizUsdCents\(payable\)\}" disabled/);
assert.match(adminBusiness, /Only currently eligible earnings will be linked/);
assert.match(adminBusiness, /remains inside the \$\{holdDays\}-day hold window and will not be included/);
assert.doesNotMatch(adminBusiness, /Viewing payout history coming in a future version/);
assert.match(adminBusiness, />No receipt view<\/span>/);
assert.doesNotMatch(adminViews, /Adding categories coming in a future version/);
assert.match(adminViews, /Categories are defined in the application source and cannot be edited here/);
assert.match(adminViews, /await navigator\.clipboard\.writeText\(value\)/);
assert.match(adminViews, /document\.execCommand && document\.execCommand\('copy'\)===true/);
assert.match(adminMedia, /document\.execCommand && document\.execCommand\("copy"\) === true/);

// Exact runTopazOp metodini ijro etib, normal success va 404-session retry yo'llarida ham
// charge balance finish'dan oldin qo'llanishini tekshiramiz.
function extractMethod(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} not found`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${signature}`);
}

const topazMethod = extractMethod(html, "async runTopazOp(")
  .replace(/^async runTopazOp/, "async function runTopazOp");
const loadModelsMethod = extractMethod(html, "async loadModels(")
  .replace(/^async loadModels/, "async function loadModels");
const refreshCreditsMethod = extractMethod(html, "async refreshCredits(")
  .replace(/^async refreshCredits/, "async function refreshCredits");

// Account A credit fetch'i kech qaytsa, B fetch'ini busy guard bilan bosib qo'ymaydi
// va B balansini A qiymati bilan almashtirmaydi.
{
  let resolveA;
  let resolveB;
  let call = 0;
  const FFAPI = {
    credits: () => new Promise((resolve) => { if (++call === 1) resolveA = resolve; else resolveB = resolve; }),
    reconcileChargedBalance: (_current, next) => next,
  };
  const refreshCredits = vm.runInNewContext(`(${refreshCreditsMethod})`, { FFAPI, isFinite, setTimeout });
  const component = {
    _creditSessionEpoch: 1,
    state: { credits: 0, creditsLoaded: false },
    setState(update) {
      const patch = typeof update === "function" ? update(this.state) : update;
      this.state = { ...this.state, ...patch };
    },
    _sigChanged() { return true; },
  };
  const oldRead = refreshCredits.call(component);
  await Promise.resolve();
  component._creditSessionEpoch = 2;
  component._creditsBusy = false;
  component._creditsBusyEpoch = null;
  const newRead = refreshCredits.call(component);
  await Promise.resolve();
  resolveB({ aiCredits: 25, plan: "pro" });
  await newRead;
  resolveA({ aiCredits: 900, plan: "studio" });
  await oldRead;
  assert.equal(component.state.credits, 25);
  assert.equal(component.state.plan, "pro");
  assert.equal(component._creditsBusy, false);
}

// Image endpoint vaqtincha yiqiladi, voice ishlaydi: global service usable, ammo image
// ro'yxati bo'sh (current-mode gate yopiq) va partial endpoint fon retry oladi.
{
  const scheduled = [];
  const FFAPI = {
    genHealth: async () => ({ moderationReady: true, storageReady: true, generationReady: true }),
    models: async (mode) => {
      if (mode === "image") throw new Error("image catalog timeout");
      return mode === "voice"
        ? { models: [{ id: 71, label: "Voice", enabled: true }], moderationReady: true, generationReady: true }
        : { models: [], moderationReady: true, generationReady: false };
    },
    ops: async () => ({ ops: [] }),
    assessAiReadiness: (_health, rows) => ({
      ready: rows.some((row) => Array.isArray(row.models) && row.models.length > 0),
      code: "",
      message: "",
    }),
  };
  const loadModels = vm.runInNewContext(`(${loadModelsMethod})`, {
    FFAPI,
    setTimeout: (fn, delay) => { scheduled.push({ fn, delay }); return scheduled.length; },
  });
  const component = {
    state: { selModel: {}, genQuote: null },
    setState(update) {
      const patch = typeof update === "function" ? update(this.state) : update;
      this.state = { ...this.state, ...patch };
    },
    toast() {},
  };
  await loadModels.call(component, 0);
  assert.equal(component.state.genAvailability, "ready");
  assert.equal(component.state.genModels.image.length, 0);
  assert.equal(component.state.genModels.voice[0].id, 71);
  assert.equal(component.state.selModel.image, undefined);
  assert.equal(component.state.selModel.voice, 71);
  assert.equal(scheduled.length, 1, "partial mode failure schedules a bounded retry");
  assert.equal(scheduled[0].delay, 4000);
}

// HTTP javoblari muvaffaqiyatli, ammo moderation/provider probe vaqtincha unavailable:
// holat permanent deb muzlamaydi, bounded fon retry oladi.
{
  const scheduled = [];
  const FFAPI = {
    genHealth: async () => ({ moderationConfigured: true, moderationReady: false, storageReady: true, generationReady: false }),
    models: async () => ({ models: [], moderationConfigured: true, moderationReady: false, generationReady: false }),
    ops: async () => ({ ops: [] }),
    assessAiReadiness: () => ({ ready: false, retryable: true, code: "MODERATION_UNAVAILABLE", message: "temporary safety outage" }),
  };
  const loadModels = vm.runInNewContext(`(${loadModelsMethod})`, {
    FFAPI,
    setTimeout: (fn, delay) => { scheduled.push({ fn, delay }); return scheduled.length; },
  });
  const component = {
    state: { selModel: {}, genQuote: null },
    setState(update) {
      const patch = typeof update === "function" ? update(this.state) : update;
      this.state = { ...this.state, ...patch };
    },
    toast() {},
  };
  await loadModels.call(component, 0);
  assert.equal(component.state.genAvailability, "unavailable");
  assert.equal(scheduled.length, 1, "transient readiness response schedules a bounded retry");
  assert.equal(scheduled[0].delay, 4000);
}

async function runTopazCase(firstGen404) {
  const events = [];
  let genCalls = 0;
  const FFAPI = {
    genGet: async () => ({ assets: [{ url: "https://cdn.example/source.png" }] }),
    quote: async () => ({ price: 50, signature: "sig", pricedParams: { referenceUrl: "https://cdn.example/source.png" } }),
    session: async () => ({ id: "new-session" }),
    gen: async () => {
      genCalls++;
      if (firstGen404 && genCalls === 1) throw Object.assign(new Error("missing session"), { status: 404 });
      return { jobId: firstGen404 ? "job-retry" : "job-normal", creditsLeft: firstGen404 ? 330 : 350 };
    },
  };
  const runTopazOp = vm.runInNewContext(`(${topazMethod})`, { FFAPI, Date, isFinite });
  const component = {
    state: { genAvailability: "ready", credits: 500, curSessId: "old-session", activeJobs: [] },
    setState(update) {
      const patch = typeof update === "function" ? update(this.state) : update;
      this.state = { ...this.state, ...patch };
    },
    _beginCreditMutation() { events.push("begin"); return 7; },
    _applyChargedBalance(value, epoch) { events.push(`apply:${value}:${epoch}`); },
    _finishCreditMutation(epoch) { events.push(`finish:${epoch}`); },
    _persistActiveJob() {},
    pollJob() {},
    toast() {},
    errMsg(error) { return error.message; },
    loadModels() {},
  };
  await runTopazOp.call(component, { id: "topaz", mode: "image", label: "Upscale", opType: "upscale" }, "source-1", 2);
  return { component, events, genCalls };
}

{
  const result = await runTopazCase(false);
  assert.equal(result.genCalls, 1);
  assert.deepEqual(result.events, ["begin", "apply:350:7", "finish:7"]);
  assert.equal(result.component.state.activeJobs[0].id, "job-normal");
}
{
  const result = await runTopazCase(true);
  assert.equal(result.genCalls, 2);
  assert.deepEqual(result.events, ["begin", "apply:330:7", "finish:7"]);
  assert.equal(result.component.state.activeJobs[0].sessionId, "new-session");
}

console.log("Web reliability, Topaz balance and truthful admin action contract passed.");
