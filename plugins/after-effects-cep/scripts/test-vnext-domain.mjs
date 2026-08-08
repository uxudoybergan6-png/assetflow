import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveFlavorFiles } from './package-flavors.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const files = [
  'app/observability/redactor.js', 'app/observability/safe-log.js', 'app/observability/metrics.js',
  'app/feature-flags.js', 'app/config-verifier.js', 'app/config-manager.js', 'app/shell/resources.js', 'app/shell/router.js', 'app/state/account-scope.js', 'app/state/scoped-preferences.js',
  'app/api/http-client.js', 'app/api/gen-client.js', 'app/state/model-store.js', 'app/state/entity-cache.js',
  'app/domain/generation/reference-store.js', 'app/domain/generation/session-coordinator.js',
  'app/domain/generation/quote-machine.js', 'app/state/job-registry.js',
  'app/domain/generation/generation-gateway.js', 'app/domain/tools/tool-registry.js', 'app/domain/tools/operation-gateway.js', 'app/host/runtime-adapter.js', 'app/host/commands.js',
  'app/domain/import/import-gateway.js', 'app/state/activity-registry.js'
];
const storage = new Map();
const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval,
  crypto: webcrypto, TextEncoder, atob: value => Buffer.from(value, 'base64').toString('binary'),
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) }
});
context.window = context; context.globalThis = context;
for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
const ff = context.FFVNext;
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; process.stdout.write(`PASS ${name}\n`); };

await check('redactor removes secrets recursively', async () => {
  const value = ff.Redactor.value({ token: 'abc', nested: { url: 'https://x.test/a?signature=secret', text: 'Bearer secret' } });
  assert.equal(value.token, '[REDACTED]'); assert.doesNotMatch(JSON.stringify(value), /secret/);
});
await check('metrics accepts only typed allowlist', async () => {
  ff.Metrics.track('view_opened', { view: 'home', prompt: 'must not pass' });
  assert.equal(ff.Metrics.snapshot()[0].fields.prompt, undefined);
  assert.throws(() => ff.Metrics.track('raw_event', {}), /allowlisted/);
});
await check('analytics opt-out blocks optional events but keeps essential diagnostics', async () => {
  storage.set('ff.v2.analytics.optout', '1'); const before = ff.Metrics.snapshot().length;
  assert.equal(ff.Metrics.track('view_opened', { view: 'home' }), null);
  ff.Metrics.track('import_result', { result: 'completed' }); assert.equal(ff.Metrics.snapshot().length, before + 1);
  storage.delete('ff.v2.analytics.optout');
});
await check('dual-stack defaults are fail-closed', async () => {
  assert.equal(ff.FeatureFlags.generation, 'dual-stack');
  assert.equal(Object.values(ff.FeatureFlags.snapshot()).filter(value => value === true).length, 0);
  assert.equal(Object.values(ff.FeatureFlags.snapshot().generationDomainV2).some(Boolean), false);
});
await check('feature config blocks replay and applies emergency disable', async () => {
  const base = { schemaVersion: 1, configRevision: 3, notBefore: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), flags: { shellV2: true, generationDomainV2: { image: true } }, emergencyDisable: { shellV2: true } };
  assert.equal(ff.FeatureFlags.apply(base, { verified: true }).ok, true);
  assert.equal(ff.FeatureFlags.enabled('shellV2'), false); assert.equal(ff.FeatureFlags.enabled('generationDomainV2', 'image'), true);
  assert.equal(ff.FeatureFlags.apply({ ...base, configRevision: 2 }).reason, 'replay');
});
await check('legacy-free emergency shell disable stays on safe V2 shell', async () => {
  const legacyStorage = new Map(); const legacy = vm.createContext({ Date, JSON, Number, Object, String, localStorage: { getItem: key => legacyStorage.get(key) ?? null, setItem: (key, value) => legacyStorage.set(key, String(value)) }, __FF_BUILD_GENERATION__: 'legacy-free' }); legacy.window=legacy;legacy.globalThis=legacy;
  vm.runInContext(fs.readFileSync(path.join(root, 'app/feature-flags.js'), 'utf8'), legacy);
  const now=Date.now(),result=legacy.FFVNext.FeatureFlags.apply({schemaVersion:1,configRevision:1,notBefore:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),flags:{shellV2:false},emergencyDisable:{shellV2:true}},{verified:true,now});
  assert.equal(result.safetyMode,true);assert.equal(legacy.FFVNext.FeatureFlags.enabled('shellV2'),true);
});
await check('feature config signature verifies before apply', async () => {
  const pair = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = Buffer.from(await webcrypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
  const config = { schemaVersion: 1, configRevision: 4, keyId: 'test', notBefore: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), flags: { homeV2: true } };
  config.signature = Buffer.from(await webcrypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(ff.ConfigVerifier.payload(config)))).toString('base64');
  assert.equal(await ff.ConfigVerifier.verify(config, { test: raw }), true);
  config.flags.homeV2 = false; assert.equal(await ff.ConfigVerifier.verify(config, { test: raw }), false);
});
await check('router calls lifecycle once and falls back home', async () => {
  const calls = []; const router = new ff.Router({ fallback: 'home' });
  router.register('home', { enter: () => calls.push('enter-home'), render: () => calls.push('render-home'), leave: () => calls.push('leave-home'), dispose: () => calls.push('dispose-home') });
  router.register('create', { enter: () => calls.push('enter-create'), render: () => calls.push('render-create') });
  await router.go('home'); await router.go('create'); await router.go('unknown');
  assert.deepEqual(calls.slice(0, 6), ['enter-home', 'render-home', 'leave-home', 'dispose-home', 'enter-create', 'render-create']); assert.equal(router.current.name, 'home');
});
await check('account epoch rejects late response', async () => {
  const scope = new ff.AccountScope(); scope.change('a'); let resolve;
  const client = new ff.HttpClient({ scope, request: () => new Promise(done => { resolve = done; }) });
  const pending = client.send('/x'); scope.change('b'); resolve({ ok: true });
  await assert.rejects(pending, error => error.code === 'STALE_SCOPE');
});
await check('account preferences are install-salted and isolated without raw identity keys', async () => {
  const scope=new ff.AccountScope();scope.change('account-alpha@example.test');const prefs=new ff.ScopedPreferences(scope);prefs.write('tool-pins',['image']);const first=prefs.key('tool-pins');
  scope.change('account-beta@example.test');assert.deepEqual([...prefs.read('tool-pins',[])],[]);const second=prefs.key('tool-pins');
  assert.notEqual(first,second);assert.doesNotMatch(first,/account-alpha|example/i);
});
await check('tool registry scrubs stale pins and intersects flags with model availability', async () => {
  const scope=new ff.AccountScope();scope.change('tool-user');const prefs=new ff.ScopedPreferences(scope);prefs.write('tool-pins',['image','removed-tool']);
  const flags={generation:'legacy-free',enabled:(key,mode)=>key==='generationDomainV2'?mode==='image':key==='createImageV2'};
  const registry=new ff.ToolRegistry({list:mode=>mode==='image'?[{id:1}]:[]},prefs,flags);const list=registry.list();
  assert.deepEqual([...registry.pins()],['image']);assert.equal(list.find(item=>item.id==='image').enabled,true);assert.equal(list.some(item=>item.id==='video'),false);
});
await check('temporarily unavailable operation keeps its account pin', async () => {
  const scope=new ff.AccountScope();scope.change('tool-pinned-user');const prefs=new ff.ScopedPreferences(scope);prefs.write('tool-pins',['image-upscale']);
  const flags={generation:'legacy-free',enabled:key=>key==='toolsV2'};const registry=new ff.ToolRegistry({list:()=>[],operationFor:()=>null},prefs,flags);const list=registry.list();
  assert.deepEqual([...registry.pins()],['image-upscale']);assert.equal(list.find(item=>item.id==='image-upscale').enabled,false);assert.match(list.find(item=>item.id==='image-upscale').reason,/temporarily unavailable/);
});
await check('reference store validates MIME and isolates account', async () => {
  const scope = new ff.AccountScope(); scope.change('a'); const refs = new ff.ReferenceStore(scope);
  assert.equal(refs.canAdd({ refKind: 'image' }, 'image').ok, true); assert.equal(refs.canAdd({ refKind: 'image' }, 'video').reason, 'REFERENCE_NOT_SUPPORTED');
  refs.add({ kind: 'image', mime: 'image/png', size: 10, handle: 'opaque-1' }); assert.equal(refs.snapshot().items.length, 1);
  assert.equal(refs.canAdd({ refKind: 'image' }, 'image').reason, 'REFERENCE_LIMIT_EXCEEDED');
  assert.throws(() => refs.add({ kind: 'image', mime: 'text/html', size: 10 }), error => error.code === 'REFERENCE_TYPE');
  scope.change('b'); assert.equal(refs.snapshot().items.length, 0);
});
await check('reference store assigns stable start/end roles and canonical frame params', async () => {
  const scope=new ff.AccountScope();scope.change('frames');const refs=new ff.ReferenceStore(scope),model={refKind:'frames',endFrame:true};assert.equal(refs.nextRole(model,'image'),'start-frame');refs.add({id:'start',kind:'image',role:'start-frame',mime:'image/png',size:10,url:'https://cdn.test/start.png'});assert.equal(refs.nextRole(model,'image'),'end-frame');refs.add({id:'end',kind:'image',role:'end-frame',mime:'image/png',size:10,url:'https://cdn.test/end.png'});assert.equal(JSON.stringify(refs.toParams(model)),JSON.stringify({savedReferenceIds:['start','end'],referenceUrl:'https://cdn.test/start.png',referenceEndUrl:'https://cdn.test/end.png'}));
});
await check('reference projection keeps incompatible pool items out of quote params', async () => {
  const scope=new ff.AccountScope();scope.change('projection');const refs=new ff.ReferenceStore(scope);refs.add({id:'image-pool',kind:'image',mime:'image/png',size:10,url:'https://cdn.test/pool.png'});assert.equal(JSON.stringify(refs.toParams({refKind:'none'})),'{}');assert.equal(refs.snapshot().items.length,1);
});
await check('quote machine drops stale response', async () => {
  const scope = new ff.AccountScope(); scope.change('a'); const waits = [];
  const machine = new ff.QuoteMachine({ quote: () => new Promise(resolve => waits.push(resolve)) }, scope);
  const first = machine.quote({ params: { n: 1 } }); const second = machine.quote({ params: { n: 2 } });
  waits[0]({ signature: 's1', pricedParams: { n: 1 }, cost: 1 }); await assert.rejects(first, error => error.code === 'STALE_QUOTE');
  waits[1]({ signature: 's2', pricedParams: { n: 2 }, cost: 2 }); assert.equal((await second).cost, 2);
});
await check('generation gateway single-flights and submits priced params', async () => {
  const scope = new ff.AccountScope(); scope.change('a'); const resources = new ff.Resources(); let generateCalls = 0; let bodySeen; let quoteSeen;
  const client = { createSession: async () => ({ id: 'session-1' }), quote: async body => { quoteSeen = body; return { signature: 'signed', pricedParams: body.params, price: 1, cost: 1 }; }, generate: async body => { generateCalls++; bodySeen = body; return { jobId: 'job-1', status: 'queued' }; }, job: async () => ({ id: 'job-1', status: 'completed' }) };
  const refs = new ff.ReferenceStore(scope); refs.add({ id: 'saved-ref-1', kind: 'image', mime: 'image/png', size: 10, url: 'https://cdn.test/ref.png' }); const sessions = new ff.SessionCoordinator(scope);
  const quotes = new ff.QuoteMachine(client, scope); const jobs = new ff.JobRegistry(client, scope, resources);
  const gateway = new ff.GenerationGateway({ client, scope, quoteMachine: quotes, references: refs, sessions, jobs, models: { get: () => ({ id: 1, refKind: 'image' }) } });
  await gateway.prepare({ mode: 'image', modelId: 1, prompt: 'hello world', params: { width: 10 } }); const a = gateway.submit(); const b = gateway.submit();
  assert.equal(a, b); assert.equal((await a).id, 'job-1'); assert.equal(generateCalls, 1); assert.equal(bodySeen.sessionId, 'session-1');
  assert.equal(JSON.stringify(bodySeen.params), JSON.stringify(quoteSeen.params)); assert.equal(quoteSeen.params.referenceUrl, 'https://cdn.test/ref.png'); assert.deepEqual([...quoteSeen.params.savedReferenceIds], ['saved-ref-1']);
  assert.deepEqual(Object.keys(quoteSeen).sort(), ['mode', 'modelId', 'params']); assert.equal('references' in bodySeen, false); assert.equal(bodySeen.costQuoteSignature, 'signed');
});
await check('operation gateway fetches fresh source and submits exact priced params', async () => {
  const scope=new ff.AccountScope();scope.change('ops');let quoteBody,generateBody,calls=0;const client={job:async()=>({id:'source-1',assets:[{url:'https://cdn.test/fresh.png'}]}),quote:async body=>{quoteBody=body;return {signature:'op-signature',pricedParams:body.params,price:11};},createSession:async()=>({id:'op-session'}),generate:async body=>{calls++;generateBody=body;return {jobId:'op-job',status:'queued'};}};const jobs={register:job=>job,poll:()=>{}};const gateway=new ff.OperationGateway({client,scope,models:{},jobs});const op={id:5002,mode:'image',label:'Upscale Image'};const a=gateway.run(op,{id:'source-1'},2),b=gateway.run(op,{id:'source-1'},2);assert.equal(a,b);assert.equal((await a).id,'op-job');assert.equal(calls,1);assert.deepEqual(generateBody.params,quoteBody.params);assert.equal(generateBody.params.referenceUrl,'https://cdn.test/fresh.png');assert.equal(generateBody.costQuoteSignature,'op-signature');
});
await check('job registry treats server done as terminal and stops polling', async () => {
  const scope=new ff.AccountScope();scope.change('jobs');const registry=new ff.JobRegistry({job:async()=>({id:'job-done',status:'done'})},scope,{interval:()=>77});registry.register({id:'job-done',status:'queued'});registry.poll('job-done',10);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(registry.pollers['job-done'],undefined);
});
await check('host mutations require operation id and de-duplicate inflight', async () => {
  let calls = 0; let release; const commands = new ff.HostCommands(() => { calls++; return new Promise(resolve => { release = resolve; }); }, { importMedia: true });
  await assert.rejects(commands.run('importMedia', {}), error => error.code === 'OPERATION_ID_REQUIRED');
  const a = commands.run('importMedia', { operationId: 'op-1' }); const b = commands.run('importMedia', { operationId: 'op-1' });
  assert.equal(a, b); await Promise.resolve(); release({ ok: true }); await a; assert.equal(calls, 1);
  await assert.rejects(commands.run('rawEval', {}), error => error.code === 'HOST_COMMAND_DENIED');
});
await check('runtime host adapter maps media import and reconciles known completion', async () => {
  let scriptSeen = '';
  const adapter = new ff.RuntimeHostAdapter({ download: async (url, ext) => { assert.equal(url, 'https://cdn.test/result.mp4'); assert.equal(ext, '.mp4'); return '/tmp/result.mp4'; }, evaluate: async script => { scriptSeen = script; return JSON.stringify({ ok: true, item: 'result.mp4' }); } });
  const result = await adapter.run('importMedia', { operationId: 'import-1', url: 'https://cdn.test/result.mp4', kind: 'video' });
  assert.equal(result.ok, true); assert.match(scriptSeen, /importMediaFromPath/);
  assert.equal((await adapter.run('reconcileImport', { operationId: 'import-1' })).status, 'completed');
});
await check('import gateway never blind-retries an unknown host outcome', async () => {
  let imports = 0, reconciles = 0;
  const gateway = new ff.ImportGateway({ run: async name => { if(name === 'importMedia'){ imports++; return { ok: false, error: 'timeout', unknownOutcome: true }; } reconciles++; return { ok: false, status: 'unknown_outcome', unknownOutcome: true }; } });
  const result = await gateway.importAsset({ url: 'https://cdn.test/result.png', kind: 'image' });
  assert.equal(result.status, 'unknown_outcome'); assert.equal(imports, 1); assert.equal(reconciles, 1);
});
await check('activity registry is a read-only projection of job and import owners', async () => {
  const activity=new ff.ActivityRegistry({list:()=>[{id:'job-a',status:'queued'}]},{list:()=>[{operationId:'imp-a',status:'running',kind:'video'}]});const list=activity.list();assert.deepEqual([...list.map(item=>item.type)],['generation','import']);assert.equal(list[0].owner.status,'queued');
});
await check('customer install manifest includes every local runtime asset', async () => {
  const html = fs.readFileSync(path.join(root, 'AssetFlow_Plugin.html'), 'utf8');
  const runtime = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+)"/g)].map(match => match[1]).filter(file => !/^(?:https?:|data:)/.test(file));
  const shipped = new Set(resolveFlavorFiles('customer').map(item => item.to));
  assert.deepEqual(runtime.filter(file => !shipped.has(file)), []);
});
process.stdout.write(`vNext domain: ${passed}/${passed} checks passed.\n`);
