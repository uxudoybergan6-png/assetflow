#!/usr/bin/env node
// R5 — AE panel responsive kontrakt testi (deterministik, DOM/brauzer talab qilmaydi).
// Tekshiradi: CEP'da 392×800 AI ramkasi yo'q, Home hero ixcham cap, katalog grid
// minimumi, yagona chrome, feature yo'qolmagan (ID/handler'lar joyida).
// Mutation-proof: qoidalar TARTIBI ham tekshiriladi (layer bazadan KEYIN kelishi shart).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'AssetFlow_Plugin.html'), 'utf8');
const stylesCss = readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

let failures = 0;
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const fail = (name, why) => { failures++; console.error(`  ✗ ${name} — ${why}`); };
const check = (name, cond, why) => (cond ? ok(name) : fail(name, why));

console.log('panel-responsive contract:');

// ── 1. Yakuniy density layer mavjud va kaskadning OXIRIDA (baza qoidalardan keyin) ──
const layerAt = html.indexOf('R5 · AE-PANEL DENSITY LAYER');
check('density layer marker present', layerAt !== -1, 'R5 layer marker missing');
const layer = layerAt === -1 ? '' : html.slice(layerAt, html.indexOf('</style>', layerAt));
const phoneBaseAt = html.indexOf('.axroot .app{width:392px');
check('legacy 392px base rule still present (demo mode)', phoneBaseAt !== -1,
  'base .axroot .app rule not found — selector renamed? update this test');
check('layer comes AFTER 392px base rule (cascade order)', layerAt > phoneBaseAt,
  'override layer must be later in the cascade than the phone-frame base rule');
check('styles.css linked BEFORE inline layer', html.indexOf('css/styles.css') < layerAt,
  'inline layer must load after css/styles.css to win ties');

// ── 2. CEP rejimida AI sheli full-bleed (392×800 telefon-ramka YO'Q) ──
check('cep-mode AI shell fills panel width',
  layer.includes('html.cep-mode .axroot .app{width:100%;max-width:none;height:auto'),
  'full-bleed cep-mode .app override missing');
check('cep-mode AI shell drops demo frame chrome',
  /html\.cep-mode \.axroot \.app\{[^}]*border:0;border-radius:0;box-shadow:none/.test(layer),
  'demo radius/shadow/border must be stripped in cep-mode');
check('cep-mode strips showcase padding',
  layer.includes('html.cep-mode .axroot{padding:0'),
  '.axroot showcase padding must be 0 in cep-mode');
check('axws-tool height chain untouched',
  html.includes('#aiPage.axws-tool .axroot .app{height:100%}'),
  'workspace height chain (#aiPage.axws-tool) must survive');

// ── 3. Home hero ixcham cap — marketing balandligi o'chirilgan ──
check('home hero compact cap in layer',
  /\.fhome-hero\{height:auto;min-height:0/.test(layer),
  'compact .fhome-hero override missing');
check('marketing hero clamp removed from the minimal Home',
  !stylesCss.includes('.fhome-hero{height:clamp(') && !layer.includes('height:clamp('),
  'minimal Home must not retain the marketing hero height clamp');
check('Artlist-style Home search is wired',
  html.includes('id="homeHeroPrompt"') && html.includes('afHomeBrowseSubmit()') &&
  html.includes('Search templates, music, SFX and LUTs…'),
  'Home must provide a direct asset-search launcher');
check('Artlist-style discovery shelves are present',
  html.includes('id="fhomeFootage"') && html.includes('id="fhomeDiscovery"') && html.includes('Footage of the week'),
  'Home must retain the real footage and remaining discovery shelves');
check('retired Home shelves are removed before the next redesign',
  !html.includes('id="fhomeShelfSec"') && !html.includes('id="fhomeRecentSec"') &&
  !html.includes("{key:'sfx',title:'Sound effects',nav:'sfx'}"),
  'featured assets, recent creations and the Sound effects shelf must not render on Home');
check('legacy CMS marketing copy cannot replace production Home',
  html.includes('if(__afCmsDraftMode)') && html.includes("afCmsSetText('.fhome-hero-copy h1','Find the right asset')"),
  'saved legacy CMS copy must not restore the promotional hero in production');
check('Home cards keep only the title',
  html.includes('fhome-tname') && html.includes('fhome-topen') &&
  !html.includes('fhome-tmeta') && !html.includes('fhome-ttype') && !html.includes("meta.join(' · ')") &&
  !html.includes('afTimeAgo(it.createdAt)'),
  'Home cards must not show contributor, category, resolution or generation time');
check('Home removes repetitive free badges',
  html.includes("(pro?'<span class=\"fhome-tbadge pro\">PRO</span>':'')") &&
  !html.includes("(pro?'PRO':'FREE')"),
  'free must be implicit and only paid cards should display a PRO badge');
check('Home catalog uses three compact columns at panel width',
  stylesCss.includes('@media (min-width:460px){.fhome-shelf{grid-template-columns:repeat(3,minmax(0,1fr))}}'),
  'Home shelf must not fall back to two oversized cards in a normal Premiere panel');
check('Home card hover does not move the layout',
  stylesCss.includes('html.home-mode .axroot .fhome-tcard:hover') && stylesCss.includes('html.home-mode .axroot .fhome-tcard:active{transform:none}'),
  'professional Home cards should not jump or scale on hover/press');
check('Asset arrows stay quiet while AI launchers keep the reference arrow',
  stylesCss.includes('.fhome-topen{position:absolute') && stylesCss.includes('opacity:0;transition:opacity') &&
  html.includes('class="fhome-toolopen"'),
  'asset-card arrows stay quiet while the AI cards retain their explicit launch affordance');
check('Home cards are visibly separated from the black panel',
  stylesCss.includes('.fhome-tcard{width:auto;min-width:0;margin:0;padding:4px;border:1px solid rgba(255,255,255,.12)') &&
  stylesCss.includes('box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 22px rgba(0,0,0,.24)') &&
  stylesCss.includes('.fhome-tcard:hover,.fhome-tcard:focus{border-color:rgba(255,255,255,.2)'),
  'asset cards need a restrained surface rim, depth and hover contrast');
check('AI toolkit uses the same restrained surface material',
  stylesCss.includes('.fhome-toolcard{--tool-inset:clamp(13px,1.4vw,19px);position:relative;isolation:isolate;display:flex;flex-direction:column;aspect-ratio:7/5;min-width:0;padding:var(--tool-inset);border:1px solid rgba(255,255,255,.22)') &&
  stylesCss.includes('inset 0 -22px 38px rgba(255,255,255,.026)') &&
  stylesCss.includes('.fhome-toolcard:after{content:') &&
  stylesCss.includes('.fhome-toolmedia{position:relative;display:flex;flex:1;min-height:0;width:100%;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.05);border-radius:clamp(11px,1.1vw,16px)') &&
  stylesCss.includes('.fhome-toolhead{display:flex;align-items:center;min-width:0;padding-right:clamp(27px,2.2vw,33px)') &&
  stylesCss.includes('.fhome-toolopen{position:absolute;z-index:2;top:var(--tool-inset);right:var(--tool-inset);width:clamp(21px,1.9vw,27px)'),
  'AI cards need the Artlist-style outer rim, compact inset and large framed media');
check('Home card typography stays compact',
  stylesCss.includes('.fhome-tcopy{position:absolute;z-index:2;left:0;right:0;bottom:0;display:block;padding:18px 8px 8px') &&
  stylesCss.includes('font:600 9.5px/1.18 var(--font-sans)') &&
  !stylesCss.includes('.fhome-tmeta{') && !stylesCss.includes('.fhome-recent .fhome-tcopy{'),
  'asset and recent titles must not dominate the preview at Premiere panel scale');
check('Recent creations reuse the featured card system',
  html.includes('<button class="fhome-rcard fhome-tcard"') &&
  html.includes('<span class="fhome-rmedia fhome-tmedia') &&
  html.includes("'<span class=\"fhome-tveil\"></span>'") &&
  stylesCss.includes('.fhome-rmedia{display:block;width:100%;height:auto;aspect-ratio:16/10;position:relative;overflow:hidden;border-radius:8px') &&
  html.includes('.fhome-rmedia{width:100%;height:auto;aspect-ratio:16/10;border-radius:8px}') &&
  !html.includes('.fhome-rmedia{height:88px'),
  'Recent cards must use the same rim, gradient, overlay copy and affordance as featured assets');
check('Home exposes four functional AI toolkit cards',
  html.includes('id="homeToolGrid"') && html.includes("{mode:'image',title:'AI Image'") &&
  html.includes("{mode:'video',title:'AI Video'") && html.includes("{mode:'voice',title:'AI Voiceover'") &&
  html.includes("{mode:'sfx',title:'AI Sound FX'") && html.includes('function fhomeOpenTool(mode)'),
  'reference-style toolkit must route to the four real generator modes');
check('AI toolkit copy stays editorial and compact',
  html.includes('Create with leading AI tools <span aria-hidden="true">✦</span>') &&
  html.includes('class="fhome-toolopen"') && html.includes('M7 17 17 7M8 7h9v9') && !html.includes('class="fhome-toolsub"') &&
  !html.includes('class="fhome-toolplay"') &&
  stylesCss.includes('.fhome-tools-hd h2{color:var(--text);font-size:21px;font-weight:760'),
  'tool cards should contain only title and media');
check('AI toolkit always remains one horizontal four-card row',
  stylesCss.includes('.fhome-toolgrid{display:flex;gap:clamp(10px,1.2vw,16px);overflow-x:auto') &&
  stylesCss.includes('scroll-snap-type:x proximity;scroll-behavior:smooth;scrollbar-width:none') &&
  stylesCss.includes('.fhome-toolgrid::-webkit-scrollbar{display:none}') &&
  stylesCss.includes('.fhome-toolgrid .fhome-toolcard{flex:1 0 210px;scroll-snap-align:start}') &&
  !stylesCss.includes('@media (min-width:420px){.fhome-toolgrid') &&
  !stylesCss.includes('@media (min-width:720px){.fhome-toolgrid'),
  'tool cards must never wrap; narrow panels should scroll horizontally instead');
check('AI tool rail has model-style controls and page dots',
  html.includes('id="homeToolPrev"') && html.includes('id="homeToolNext"') && html.includes('id="homeToolDots"') &&
  html.includes('function fhomeSyncToolRail()') && html.includes('function fhomeMoveToolRail(dir)') &&
  stylesCss.includes('.fhome-toolarrow{position:absolute') && stylesCss.includes('.fhome-tooldots{height:7px') &&
  stylesCss.includes('.fhome-tooldot.active{width:14px'),
  'narrow AI rails need arrows, dots and smooth paging like the model carousel');
check('featured model carousel uses the live Studio catalog',
  html.includes('id="fhomeModelsSec"') && html.includes('id="fhomeModelRail"') &&
  html.includes('__fhomeModels.catalog=catalog') && html.includes("getMode('image')") && html.includes("getMode('video')"),
  'Home model cards must come from the enabled image/video model endpoints');
check('featured model cards open Create with the selected model',
  html.includes('function fhomeOpenModel(mode,id)') && html.includes('window.axIGSelectModel=function(id)') &&
  html.includes('window.axVGSelectModel=function(id)') && html.includes("data-home-model-mode"),
  'model cards must select the matching model, not act as decorative links');
check('featured models use a horizontal portrait carousel',
  stylesCss.includes('.fhome-modelrail{display:flex;gap:10px;overflow-x:auto') &&
  stylesCss.includes('scroll-snap-type:x mandatory') && stylesCss.includes('aspect-ratio:4/5') &&
  stylesCss.includes('.fhome-modeldots{'),
  'reference-style portrait cards, horizontal overflow and page dots are required');
check('featured models contain no hardcoded vendor demo cards',
  !html.includes("Seedance 2.5") && !html.includes("Seedream 5.0 Pro") && !html.includes("Gemini Omni Flash"),
  'model names must be supplied by the server catalog');
check('Footage of the week uses the real motion catalog',
  html.includes("{key:'footage',title:'Footage of the week',nav:'motion',footage:true}") && html.includes('id="fhomeFootage"') &&
  html.includes("AssetFlowCatalog.fetchHomeShelf('motion-graphics',10)") && html.includes('fhomeFootageCardHtml'),
  'footage must be a real motion-graphics shelf, not a static demo row');
check('Home ends with a responsive demo Video Templates shelf',
  html.includes('id="fhomeVideoTemplates"') && html.includes('Video templates picked for you') &&
  html.includes('FHOME_DEMO_VIDEO_TEMPLATES') && html.includes("homeGo('video')") &&
  stylesCss.includes('.fhome-vtpl-rail{display:flex;gap:12px;overflow-x:auto') &&
  stylesCss.includes('.fhome-vtpl-media{position:relative;display:block;width:100%;aspect-ratio:16/9') &&
  stylesCss.includes('.fhome-vtpl-card{flex:1 0 clamp(210px,22vw,340px)'),
  'demo video templates need four media-first 16:9 cards and a non-wrapping browse rail');
check('footage cards match model size and animate to 16:9',
  stylesCss.includes('--footage-w:clamp(176px,25vw,230px);--footage-h:calc(var(--footage-w)*1.25)') &&
  stylesCss.includes('flex:0 0 var(--footage-w)') &&
  stylesCss.includes('.fhome-modelcard{position:relative;flex:0 0 clamp(176px,25vw,230px);aspect-ratio:4/5') &&
  stylesCss.includes('flex-basis:calc(var(--footage-h)*1.7778)') &&
  stylesCss.includes('transition:flex-basis .42s cubic-bezier'),
  'footage cards need the model carousel 4:5 footprint and an animated 16:9 hover state');
check('footage preview plays only on interaction',
  html.includes('class="fhome-footage-video" data-src=') && html.includes("video.setAttribute('src',video.getAttribute('data-src')") &&
  html.includes('var p=video.play()') && html.includes('video.pause(); video.currentTime=0'),
  'real preview video must lazy-load/play on hover and stop/reset on exit');
check('footage carousel advances and respects reduced motion',
  html.includes('fhomeStartFootageCarousel') && html.includes('},4800)') &&
  html.includes("matchMedia('(prefers-reduced-motion: reduce)')") && stylesCss.includes('.fhome-footage-dots{'),
  'footage carousel needs timed paging, controls, dots and reduced-motion safety');
const footageCardFn = html.slice(html.indexOf('function fhomeFootageCardHtml'), html.indexOf('function fhomeFootageScroll'));
check('footage cards keep title-only copy',
  footageCardFn.includes('fhome-tname') && !footageCardFn.includes('author') && !footageCardFn.includes('createdAt'),
  'footage cards must not restore contributor or timestamp metadata');
check('featured cards use a uniform professional grid',
  html.includes("orient=orient==='portrait'?'vertical'") && html.includes("fhome-tmedia fhome-o-'+orient") &&
  stylesCss.includes('.fhome-featured .fhome-tmedia{aspect-ratio:16/10}') &&
  stylesCss.includes('.fhome-featured .fhome-tmedia.fhome-o-vertical,.fhome-featured .fhome-tmedia.fhome-o-square{aspect-ratio:16/10;background-position:center}') &&
  !stylesCss.includes('fhome-o-vertical{aspect-ratio:4/5}') &&
  stylesCss.includes('.fhome-tcopy{position:absolute'),
  'portrait and square media must crop inside the same 16:10 card without breaking grid rows');
check('Home uses a compact editorial focal point',
  stylesCss.includes('html.home-mode .fhome-hero{margin:0 0 2px;padding:13px 14px 14px;border:1px solid rgba(255,255,255,.11)') &&
  stylesCss.includes('radial-gradient(circle at 100% 0,rgba(192,89,255,.11),transparent 38%)') &&
  stylesCss.includes('html.home-mode .fhome-hero:before{content:') &&
  stylesCss.includes('html.home-mode .fhome-hero-copy h1{display:block;font:600 15px/1.15'),
  'Home needs one restrained editorial anchor without restoring the oversized marketing hero');
check('featured six-pack stays three columns at the current panel width',
  stylesCss.includes('@media (min-width:1120px){.fhome-shelf{grid-template-columns:repeat(4,minmax(0,1fr))') &&
  !stylesCss.includes('@media (min-width:760px){.fhome-shelf{grid-template-columns:repeat(4'),
  'six featured assets should form a balanced 3×2 grid instead of 4+2');
check('Home search uses the available panel width',
  stylesCss.includes('html.home-mode .fhome-hero-copy{max-width:none}'),
  'later density rules must not constrain search to 340px');
check('Home source order follows search, toolkit, models, footage, sessions, discovery, video templates',
  html.indexOf('class="fhome-hero"') < html.indexOf('class="fhome-tools"') &&
  html.indexOf('id="fhomeToolsHd"') < html.indexOf('id="fhomeModelsSec"') &&
  html.indexOf('id="fhomeModelsSec"') < html.indexOf('id="fhomeFootage"') &&
  html.indexOf('id="fhomeFootage"') < html.indexOf('id="fhomeSessSec"') &&
  html.indexOf('id="fhomeSessSec"') < html.indexOf('id="fhomeDiscovery"') &&
  html.indexOf('id="fhomeDiscovery"') < html.indexOf('id="fhomeVideoTemplates"'),
  'Home sections must match the requested editorial order');
check('Home removes redundant greeting and Create CTA',
  html.includes('<div class="fhome-top" hidden aria-hidden="true">') &&
  html.includes('<h2 id="fhomeToolsHd">Create with leading AI tools <span aria-hidden="true">✦</span></h2>') &&
  !html.includes('fhome-tools-all') && !html.includes('Open Create ↗'),
  'top Create navigation makes the extra greeting and toolkit CTA unnecessary');

// ── 3b. Artlist audit: generator composer progressive disclosure ──
check('generator composer gives the prompt a dedicated writing zone',
  html.includes('ART-COMPOSER · Artlist generator audit') &&
  html.includes('.axws-promptwrap .chipedit{min-height:74px;max-height:190px') &&
  html.includes('Describe your image… Use @ for references') &&
  html.includes('Describe your video… Use @ for references'),
  'Image and Video need the same spacious Artlist-style prompt surface');
check('composer controls stay on one row at every panel width',
  html.includes('.axws-dockrow{position:relative;isolation:isolate;margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:nowrap') &&
  html.includes('.axws-setgroup{min-width:0;flex:1 1 auto;display:flex;align-items:center;gap:8px;flex-wrap:nowrap}') &&
  html.includes('.axws-dockrow{overflow-x:auto;overflow-y:hidden;padding-bottom:3px;scroll-padding-right:230px') &&
  html.includes('.axws-setgroup{flex:1 1 auto;min-width:0}') &&
  !html.includes('.axws-setgroup{flex:1 0 auto;min-width:390px}') &&
  !html.includes('.axws-setgroup{flex:1 0 auto;min-width:350px') &&
  html.includes('.axws-genwrap{position:sticky;right:0;z-index:8;flex:0 0 auto;justify-content:flex-end;margin-left:0}') &&
  html.includes('.axws-dock .pill-model{order:initial;flex:1 1 150px;width:auto;min-width:88px}') &&
  !html.includes('var lvl; for(lvl=1; lvl<=6; lvl++)'),
  'resize must keep one stable row; settings may scroll, but Enhance, Clear and Generate stay pinned and visible');
check('shared new-session controls also stay on one row',
  html.includes('.ff-create-controls{display:flex;align-items:center;gap:7px;flex-wrap:nowrap;min-width:0}') &&
  html.includes('.ff-create-setgroup{display:flex;align-items:center;gap:7px;min-width:0;flex:1 1 auto}') &&
  html.includes('<div class="ff-create-setgroup">') &&
  html.includes('.ff-create-controls{align-items:center;overflow-x:auto;overflow-y:hidden;padding-bottom:3px') &&
  !html.includes('.ff-create-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap}'),
  'new and existing sessions must preserve one horizontal controls rail without hiding model or output settings');
check('secondary prompt actions are icon-only',
  html.includes('.axws-genwrap .enh-lbl,.axws-genwrap .axws-clr-lbl{display:none}') &&
  html.includes('.axws-genwrap .ai-set.enhance,.axws-genwrap .axws-clear{width:36px') &&
  html.includes('.axws-genwrap .axws-clear svg{display:block;width:14px;height:14px;overflow:visible}') &&
  (html.match(/d="M5 5v5h5"/g)||[]).length===3,
  'Enhance and Clear text should not crowd the model/output controls');
check('reference strips stay ordered for every Image and Video model',
  html.includes('.vg-strip{display:flex;align-items:center;justify-content:flex-start;gap:8px;min-width:100%;width:max-content}') &&
  html.includes('.axvg .vg-strip .vg-strip-frame{flex:0 0 60px;width:60px;margin:0}') &&
  html.includes('.axvg .vg-strip .vg-refgrid{flex:0 0 auto;flex-wrap:nowrap;margin:0}') &&
  html.includes('.axig .axws-refs .axws-refwrap .refgrid{display:flex;align-items:center;flex-wrap:nowrap;margin:0;width:max-content}') &&
  html.indexOf('id="vgStartWrap"') < html.indexOf('id="vgEndWrap"') &&
  html.indexOf('id="vgEndWrap"') < html.indexOf('id="vgRefGrid"'),
  'references must remain left-packed as add, START, END, then extra media without wrapping');
check('Image and Video use the large searchable model modal',
  html.includes('class="sheet pop axws-modelsheet" id="igMSheet"') &&
  html.includes('class="sheet pop axws-modelsheet" id="vgMSheet"') &&
  html.includes('.axig .sheet.pop.axws-modelsheet{background:rgba(4,5,7,.72)') &&
  html.includes('var modelHost=sc.parentNode&&(sc.parentNode.id===\'igMSheet\')') &&
  html.includes('var modelHost=sc.parentNode&&(sc.parentNode.id===\'vgMSheet\')'),
  'long model catalogs must open in a centered searchable surface in both generators');

// ── 3c. Final Create: shared new-session composer + active-session engines ──
check('Create opens with one shared new-session composer',
  html.includes('id="ffCreateStart"') && html.includes('id="ffCreatePrompt"') &&
  html.indexOf('id="ffCreateStart"') < html.indexOf('id="aiCatGrid"'),
  'unified composer must be the first meaningful Create surface');
check('unified composer exposes the four real generation modes',
  ['image','video','voice','sfx'].every((m) => html.includes(`data-ff-mode="${m}"`)) &&
  html.includes("var modeView={image:'imggen',video:'vidgen',voice:'audgen',sfx:'audgen'}") &&
  html.includes('id="ffCreateModeMenu"') && !html.includes('class="ff-create-modes"') &&
  html.indexOf('id="ffCreatePrompt"') < html.indexOf('id="ffCreateMode"'),
  'Image, Video, Voiceover and SFX must route through a compact selector below the prompt');
check('the same composer mounts into existing session detail',
  html.includes('id="ffCreateComposer"') && html.includes('id="ffCreateLauncherSlot"') &&
  html.includes('id="ffCreateSessionSlot"') && html.includes('openSession:openExistingSession') &&
  html.includes('ctl.setSession(session.id||null)') && html.includes('payload.sessionId'),
  'old sessions must keep a bottom composer and dispatch back into the same server session');
check('unified composer uses a testable source controller',
  html.includes('<script src="frameflow-create-workspace.js"></script>') &&
  html.includes('FrameFlowCreateWorkspace.createController'),
  'shared state/quote/dedupe controller must load in both hosts');
check('Create model catalog is server-backed for every mode',
  html.includes("Promise.all(['image','video','voice','sfx'].map") &&
  html.includes("studioGet('/api/studio/gen/models?mode='"),
  'All Models must not use a hardcoded production catalog');
check('model choice has quick shortlist and All Models browser',
  html.includes("slice(0,5)") && html.includes("all.textContent='All Models →'") &&
  html.includes("modalShell('All Models'") && html.includes("q.placeholder='Search models…'"),
  'two-stage model picker is required');
check('All Models provides provider filter, details and explicit use action',
  html.includes("provider.setAttribute('aria-label','Filter provider')") &&
  html.includes("detail.className='ff-model-detail'") && html.includes("use.textContent='Use Model'"),
  'model browser must expose provider, detail and Use Model');
check('output settings are capability-driven',
  html.includes('FrameFlowCreateWorkspace.settingOptions(m,key)') &&
  html.includes("var keys=['aspectRatio','quality','resolution','count','duration','voice','audio','bitrateMode']"),
  'unsupported model controls must stay hidden');
check('secure live quote gates unified Generate',
  html.includes("studioPost('/api/studio/gen/cost-quote'") &&
  html.includes("gen.disabled=!s.validation.ok||s.submitting") &&
  html.includes("s.quote.status==='ready'?'✦'+s.quote.price"),
  'Generate must wait for a current server quote');
check('unified submit delegates to existing signed generation handlers',
  html.includes('window.axIGApplyDraft') && html.includes('window.axVGApplyDraft') &&
  html.includes('window.axAGApplyDraft') && html.includes('btn.click();return {accepted:true,view:view}'),
  'presentation shell must not replace signed quote/job engines');
check('composer keyboard submit respects IME composition',
  html.includes('if(e.isComposing)return') && html.includes("(e.metaKey||e.ctrlKey)&&e.key==='Enter'"),
  'Cmd/Ctrl+Enter and IME guard are required');
check('reference menu delegates to secure existing source flows',
  ['file','project','timeline','library'].every((v) => html.includes(`data-ff-ref="${v}"`)) &&
  html.includes("var id=prefix+'Src'+(source==='file'?'File':source==='project'?'Proj':source==='timeline'?'Tl':'Lib')"),
  'file, Project, Timeline/current-frame and Library sources must route to existing upload/host handlers');
check('global Activity combines persistent active jobs and server history',
  html.includes('id="ffActivityBtn"') && html.includes('window.afJobStore?window.afJobStore.list()') &&
  html.includes("studioGet('/api/studio/gen/history?limit=12')"),
  'Activity needs active recovery plus recent completed/failed items');
check('Activity exposes real cancel, retry and open-session actions',
  html.includes("studioPost('/api/studio/gen/'+encodeURIComponent(item.jobId)+'/cancel'") &&
  html.includes("retry.textContent='Retry'") && html.includes("open.textContent='Open session'"),
  'Activity actions must call the real cancel endpoint or navigate to a recoverable draft/session');
check('audio jobs participate in reopen Activity recovery',
  html.includes("window.afJobStore.add('audgen'") &&
  html.includes('if(window.afJobStore)window.afJobStore.remove(jobId)'),
  'voice/SFX jobs must not disappear on panel reopen');
check('active session pointer is persisted per signed-in user',
  html.includes("var afActiveSessionStore=(function()") &&
  html.includes("var KEY='af_active_session_v2'") && html.includes("r.user===user") &&
  html.includes("window.afActiveSessionStore.set('imggen'") &&
  html.includes("window.afActiveSessionStore.set('vidgen'") &&
  html.includes("window.afActiveSessionStore.set('audgen'"),
  'panel reopen must restore the correct account-scoped server session');
check('modal keyboard contract traps focus and restores trigger',
  html.includes("if(e.key==='Escape'){e.preventDefault();closeModal();return;}") &&
  html.includes("if(e.key!=='Tab')return") && html.includes('modalTrigger.focus()'),
  'All Models/settings/Activity must support Escape, focus trap and trigger restore');
check('unified composer remains readable at 320px',
  html.includes('@media(max-width:520px){.ff-create-start') &&
  html.includes('.ff-create-controls{align-items:center;overflow-x:auto;overflow-y:hidden;padding-bottom:3px') &&
  html.includes('.ff-create-setgroup{flex:0 0 auto;min-width:270px}') &&
  html.includes('.ff-create-model{flex:1 1 112px;min-width:76px;max-width:150px}') &&
  html.includes('.ff-create-generate{flex:0 0 auto}') && html.includes('max-height:calc(100vh - 20px)'),
  'model, settings, Generate and modal geometry must stay inside narrow panels');
check('new and existing session composers stay at the bottom',
  html.includes('.ff-create-start{display:flex;min-height:calc(100vh - 230px)') &&
  html.includes('.ff-create-slot{width:100%;margin-top:auto}') &&
  html.includes('.ff-create-session-slot{position:sticky;z-index:5;bottom:10px'),
  'composer must not float at the top above an empty session canvas');
check('AE and Premiere share Create DOM and layout tokens',
  !html.includes('html.host-premiere .ff-create') && !stylesCss.includes('html.host-premiere .ff-create') &&
  html.match(/id="ffCreateStart"/g)?.length === 1,
  'host class may not fork the Create layout or duplicate markup');
check('sticky active-session composer keeps gallery safe',
  html.includes('.axws-dock{') && html.includes('.axws-stage{') &&
  html.includes('padding-bottom:') && html.includes('position:sticky'),
  'active session gallery needs a real sticky/docked composer safe area');

// ── 4. Katalog grid minimumi — ixcham 2 ustun ~336px dan ──
check('catalog grid compact minimum (148px)',
  layer.includes('.grid,html.cep-mode .grid{grid-template-columns:repeat(auto-fill,minmax(148px,1fr))'),
  'compact catalog grid override missing');
check('density variants preserved (sm/md/lg)',
  layer.includes('html.dens-sm .grid') && layer.includes('html.dens-lg .grid'),
  'density toggle variants must be re-declared in the layer');

// ── 5. Yagona chrome — dublikat headerlar yashirin qoladi ──
for (const rule of ['#homeHd{display:none!important}', '#v-launcher>.ai-hdr{display:none!important}', '.axroot .pbar{display:none!important}']) {
  check(`duplicate chrome hidden: ${rule.split('{')[0]}`, html.includes(rule), 'single-chrome rule missing');
}
check('credit pill never fully hidden',
  !/\.af-tb-cred\s*\{[^}]*display:\s*none/.test(html),
  'credit/balance must never be display:none');

// ── 6. Launcher: 3-karta kompozitsiyasi (yetim karta yo'q) ──
check('launcher odd-last card spans full width',
  layer.includes('.axroot .cats .cat:last-child:nth-child(odd){grid-column:1/-1}'),
  'orphan-card composition rule missing');
check('launcher 3-col on wide panels',
  layer.includes('html.cep-mode .axroot .cats{grid-template-columns:repeat(3,1fr)}'),
  'wide-panel launcher columns missing');

// ── 7. Feature yo'qolmagan — ID / handler'lar joyida ──
const requiredIds = ['homeHeroPrompt', 'homeBArt', 'homeBModel', 'homeGreet', 'fhomeModelsSec', 'fhomeModelRail',
  'homeCatTiles', 'homeSessRow', 'aiCatGrid', 'searchInput', 'filterToggleBtn', 'densityBtn',
  'sortBtn', 'hdrCred', 'hdrPlanPill', 'hdrAva', 'afPillarSeg', 'sbCredit', 'grid', 'dlGrid'];
for (const id of requiredIds) {
  check(`id preserved: #${id}`, html.includes(`id="${id}"`), 'required element id missing');
}
const requiredHandlers = ['afHomeHeroSubmit', 'afHomeBrowseSubmit', 'afOpenTopup', 'openAccountSheet', 'afNavTab', 'afCycleDensity', 'toggleFilterPanel'];
for (const fn of requiredHandlers) {
  check(`handler wired: ${fn}`, html.includes(`${fn}(`), 'required handler reference missing');
}

if (failures) {
  console.error(`\npanel-responsive contract FAILED (${failures} failure${failures > 1 ? 's' : ''})`);
  process.exit(1);
}
console.log(`\npanel-responsive contract OK (${passed} passed, 0 failed)`);
