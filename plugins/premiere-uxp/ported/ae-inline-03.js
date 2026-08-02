
const IS_CEP=typeof window.__adobe_cep__!=='undefined';
let csInterface=null;
if(IS_CEP){
  document.documentElement.classList.add('cep-mode');
  try{csInterface=new CSInterface();}catch(e){}
}

const packs=window.packs;

const navSubs={
  video:['All','Logos','Typography & Titles','Slideshows','Lower Thirds','Intros','Transitions','Overlays & Icons'],
  motion:['All','Backgrounds','Overlays','Transitions','Elements','Light Leaks','Particles','Loops'],
  graphics:['All','Backgrounds','Textures','Patterns','Icons','Illustrations','Mockups'],
  luts:['All','Cinematic','Vintage','Film Emulation','Warm','Cool','Moody'],
  // P1 (step 32) — Stock audio tablari
  music:['All','Cinematic','Corporate','Ambient','Electronic','Hip-Hop','Rock','Pop'],
  sfx:['All','Whoosh','Impact','UI / Interface','Ambience','Foley','Transitions','Nature']
};

/* P2 (step 31) — YAGONA nav label xaritasi. Har ekran (sidebar/tab/select/home) shu matnlarga
   mos bo'lishi SHART — avval bir tur 4 xil nomlanardi (Templates/Video Templates/Motion/Motion Videos). */
const NAV_LABELS={video:'Video Templates',motion:'Motion Graphics',graphics:'Graphics',luts:'LUTs',music:'Music',sfx:'Sound Effects'};

// FAZA 5 (§2/§11) — kanonik dastur xaritasi (apps.ts server nusxasining ko'chirmasi).
// Kod → { lbl, full, dot }. Klient literallari server bilan mos bo'lishi shart.
const FF_APPS={
  ae:{lbl:'Ae',full:'Premiere Pro',dot:'#A79BFF'},
  pr:{lbl:'Pr',full:'Premiere Pro',dot:'#E585FF'},
  motion:{lbl:'Mn',full:'Apple Motion',dot:'#5CC8B0'},
  resolve:{lbl:'Dr',full:'DaVinci Resolve',dot:'#FFB27C'}
};
/** Dastur kodi(+nav) → {lbl,full,dot}. Belgilanmagan (bo'sh) → Premiere (DB default);
 *  eski 'dr' kodi → DaVinci; noma'lum kodni Premiere'ga majburlamaymiz. */
function ffAppInfo(code,navHint){
  const c=String(code||'').toLowerCase();
  if(FF_APPS[c])return FF_APPS[c];
  if(c==='dr')return FF_APPS.resolve;      // eski alias
  return FF_APPS.ae;                         // faqat bo'sh/noma'lumda Premiere
}

// P8 — stock turlar (motion/graphics/luts/music/sfx) uchun belgi; ffAppInfo faqat
// video-templates (Ae/Pr/Mn/Dr) uchun ishlatiladi. WEB: platform/index.html'da
// STOCK_TYPE_BADGES xuddi shu jadval (mirror, {a,ac} shaklida).
const STOCK_TYPE_BADGES={
  motion:{lbl:'Motion',full:'Motion Graphics',dot:'#5CC8B0'},
  graphics:{lbl:'Graphic',full:'Graphics',dot:'#7CC4FF'},
  luts:{lbl:'LUT',full:'LUTs',dot:'#FFB27C'},
  music:{lbl:'Music',full:'Music',dot:'#F0907F'},
  sfx:{lbl:'SFX',full:'Sound Effects',dot:'#E5C07B'}
};
/** Belgi manbai: stock nav (motion/graphics/luts/music/sfx) → STOCK_TYPE_BADGES;
 *  video-templates (yoki nav yo'q) → ffAppInfo (FF_APPS). Bu bilan LUTs stock endi
 *  "DaVinci" taxminiga qolmaydi — o'zining LUT belgisini oladi. */
function ffTypeBadge(code,nav){
  if(nav&&nav!=='video'&&STOCK_TYPE_BADGES[nav])return STOCK_TYPE_BADGES[nav];
  return ffAppInfo(code,nav);
}

const CAT_LABELS={
  all:'All', logos:'Logos', typographytitles:'Typography & Titles',
  slideshows:'Slideshows', lowerthirds:'Lower Thirds', intros:'Intros',
  transitions:'Transitions', overlaysicons:'Overlays & Icons',
  titles:'Titles', overlays:'Overlays', vfx:'VFX', greenscreen:'Green Screen',
  stockfootage:'Stock Footage',
  backgrounds:'Backgrounds', mockups:'Mockups', illustrations:'Illustrations',
  icons:'Icons', infographics:'Infographics',
  creative:'Creative', cinematic:'Cinematic', retro:'Retro'
};

const SUB_SLUG={
  'All':'all','Logos':'logos','Typography & Titles':'typographytitles',
  'Slideshows':'slideshows','Lower Thirds':'lowerthirds','Intros':'intros',
  'Transitions':'transitions','Overlays & Icons':'overlaysicons',
  'Titles':'titles','Overlays':'overlays','VFX':'vfx','Green Screen':'greenscreen',
  'Stock Footage':'stockfootage',
  'Backgrounds':'backgrounds','Mockups':'mockups','Illustrations':'illustrations',
  'Icons':'icons','Infographics':'infographics',
  'Creative':'creative','Cinematic':'cinematic','Retro':'retro'
};

const FEATURED={
  max:5,
  noticeTitle:'New templates!',
  ctaShort:'Try it →'
};

const assets=window.assets;

function packCanAeImport(pack){
  if(!pack)return false;
  if(pack.serverTemplateId) return pack.hasPack!==false;
  return !!pack.fileBlobId;
}

/** P5.2 (step 32) — pack media SINFI (import mantiqi shunga qarab). nav (server
 *  taksonomiyasi) ISHONCHLI — fileName default "template.aep" bo'lishi mumkin, shu bois
 *  nav BIRINCHI; nav bo'lmasa (lokal upload) fayl kengaytmasi. */
function packMediaKind(pack){
  const nav=pack&&pack.nav;
  const fn=String((pack&&pack.fileName)||'').toLowerCase();
  if(nav==='luts'||/\.(cube|3dl|look)$/.test(fn)) return 'lut';
  if(nav==='music'||nav==='sfx') return 'audio';
  if(nav==='motion') return 'video';
  if(nav==='graphics') return 'image';
  if(/\.(mp4|mov|webm|m4v)$/.test(fn)) return 'video';
  if(/\.(wav|mp3|aiff|aif|m4a|aac|ogg|flac)$/.test(fn)) return 'audio';
  if(/\.(png|jpg|jpeg|webp|svg|gif|tif|tiff)$/.test(fn)) return 'image';
  return 'project'; // video-templates (.aep/.mogrt zip)
}
function packIsRawMedia(pack){ const k=packMediaKind(pack); return k==='video'||k==='image'||k==='audio'; }

function mapPackScenes(u){
  if(u.scenes&&u.scenes.length){
    return u.scenes.map(s=>({
      ...s,
      preview:s.previewBlobId?AssetFlowStore.getBlobUrl(s.previewBlobId):undefined
    }));
  }
  const fr=u.extra?.aeFinalRender;
  if(fr?.name){
    const res=fr.width>=3840?'4K':fr.width>=1920?'1080p':'HD';
    return [{
      n:fr.name,
      aeComp:fr.name,
      meta:`${res} · ${fr.fps}fps · ${fr.width}×${fr.height}`,
      ico:u.icon||'✦',
      bg:'#4338ca',
      preview:u.previewBlobId?AssetFlowStore.getBlobUrl(u.previewBlobId):undefined
    }];
  }
  return [];
}

function mergeLocalUploads(){
  for(let i=assets.length-1;i>=0;i--){
    if(assets[i].local) assets.splice(i,1);
  }
  Object.keys(packs).forEach(k=>{
    if(packs[k].local) delete packs[k];
  });
  if(typeof AssetFlowStore==='undefined') return 0;
  const uploads=AssetFlowStore.listMeta().filter(u=>u.published!==false);
  uploads.forEach(u=>{
    const thumb=u.thumbBlobId?AssetFlowStore.getBlobUrl(u.thumbBlobId):'';
    const preview=u.previewBlobId?AssetFlowStore.getBlobUrl(u.previewBlobId):'';
    const resLabel=(u.res||'4k').toUpperCase();
    const appLabel=u.templateApp?ffTypeBadge(u.templateApp,u.nav).full:'';
    const extraBits=[];
    if(appLabel) extraBits.push(appLabel);
    if(u.extra?.colorSpace) extraBits.push(String(u.extra.colorSpace).toUpperCase());
    if(u.extra?.deviceType) extraBits.push(u.extra.deviceType);
    if(u.extra?.clipType) extraBits.push(u.extra.clipType);
    const extraLabel=extraBits.length?' · '+extraBits.join(' · '):'';
    packs[u.name]={
      ico:u.icon||'✦',bg:u.bg,
      sub:`${NAV_LABELS[u.nav]||u.nav} · ${u.catLabel} · ${resLabel}${extraLabel}`,
      preview:preview||undefined,
      scenes:mapPackScenes(u),
      local:true,fileBlobId:u.fileBlobId,fileName:u.fileName||'',
      templateApp:u.templateApp||null,catLabel:u.catLabel,orient:u.orient,res:u.res,nav:u.nav,
      description:(u.description||'').trim(),
      aeFinalRender:u.extra?.aeFinalRender||null,
      aeScenesFolder:u.extra?.aeScenesFolder||'Scenes'
    };
    assets.push({
      n:u.name,t:u.catLabel,i:u.icon||'✦',nav:u.nav,cat:u.cat,bg:u.bg,
      orient:u.orient||'horizontal',res:u.res||'4k',tags:u.tags||[],
      thumb:thumb||undefined,preview:preview||undefined,
      local:true,contributorId:u.id,nw:u.nw?1:0,templateApp:u.templateApp||null
    });
  });
  return uploads.length;
}

async function refreshLocalAssets(){
  if(typeof AssetFlowStore==='undefined') return 0;
  await AssetFlowStore.hydrateBlobUrls(AssetFlowStore.listMeta());
  const count=mergeLocalUploads();
  buildCategoryMenu(currentNav);
  render();
  return count;
}

if(!(window.importedScenes instanceof Set)) window.importedScenes=new Set();
// downloadedMeta[templateKey] = { folders:[...Premiere papka nomi], comps:[...comp nomi], displayName }
if(!window.downloadedMeta||typeof window.downloadedMeta!=='object') window.downloadedMeta={};

function loadUserPrefs(){
  if(typeof AssetFlowStore==='undefined')return;
  const prefs=AssetFlowStore.loadPrefs();
  // SC_49: favorites prefs yuklash O'CHIRILDI — template favorites olib tashlandi.
  // downloaded — TEMPLATE kalitlari (a.n / packKey), Downloaded tab uchun
  window.downloaded.clear();
  (prefs.downloaded||[]).forEach((x)=>window.downloaded.add(x));
  // importedScenes — sahna nomlari, sahna kartasi "imported" belgisi uchun
  window.importedScenes.clear();
  (prefs.importedScenes||[]).forEach((x)=>window.importedScenes.add(x));
  // downloadedMeta — Premiere da import qilingan papka/comp nomlari (o'chirish uchun)
  window.downloadedMeta=(prefs.downloadedMeta&&typeof prefs.downloadedMeta==='object')?prefs.downloadedMeta:{};
}

function persistUserPrefs(){
  if(typeof AssetFlowStore==='undefined')return;
  // Mavjud prefs bilan merge — client (token, apiBaseUrl, downloadDir) saqlanib qolsin
  const prefs=AssetFlowStore.loadPrefs();
  // SC_49: prefs.favorites saqlash O'CHIRILDI
  prefs.downloaded=[...window.downloaded];
  prefs.importedScenes=[...window.importedScenes];
  prefs.downloadedMeta=window.downloadedMeta;
  AssetFlowStore.savePrefs(prefs);
}

/** Import natijasidagi papka/comp ID (va eski nusxalar uchun nom) larini saqlaydi */
function recordImportedMeta(templateKey,sceneName,data){
  if(!templateKey)return;
  const m=window.downloadedMeta[templateKey]||{folders:[],comps:[],displayName:''};
  if(!Array.isArray(m.folderIds))m.folderIds=[];
  if(!Array.isArray(m.compIds))m.compIds=[];
  const pack=packs[templateKey];
  if(pack&&pack.displayName) m.displayName=pack.displayName;
  // #30 (PL-c): host Premiere item ID qaytarsa NOMNI saqlamaymiz — o'chirish faqat shu
  // aniq elementga tegadi. Nom bo'yicha o'chirish foydalanuvchining bir xil nomli
  // papkasini/comp'ini ham yo'q qilardi.
  const fid=data&&Number(data.folderId)||0;
  const cid=data&&Number(data.compId)||0;
  if(fid){ if(m.folderIds.indexOf(fid)<0) m.folderIds.push(fid); }
  else if(data&&data.folder&&m.folders.indexOf(data.folder)<0) m.folders.push(data.folder);
  if(cid){ if(m.compIds.indexOf(cid)<0) m.compIds.push(cid); }
  else if(data&&data.comp&&m.comps.indexOf(data.comp)<0) m.comps.push(data.comp);
  // Demo (CEP emas) holatda data bo'lmaydi — sahna nomini comp sifatida saqlaymiz
  if(!data&&sceneName&&m.comps.indexOf(sceneName)<0) m.comps.push(sceneName);
  m.at=Date.now(); // Home "Continue" qatori uchun oxirgi import vaqti
  window.downloadedMeta[templateKey]=m;
}

function packDownloadOpts(pack){
  return{
    packUrl:pack?.serverPackUrl,
    fileSize:pack?.fileSize||0,
    onProgress(done,total){
      // total ma'lum → foiz + "X / Y MB"; noma'lum → indeterminate, MB yo'q (soxta raqam yo'q)
      if(total>0){
        const pct=Math.min(100,Math.floor((done/total)*100));
        const mb=(done/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MB';
        showProgress(pct,'Downloading…',false,true,mb);
      }else showProgress(0,'Downloading…',true,true);
    }
  };
}
function sceneDownloadOpts(){
  return{
    onProgress(done,total){
      if(total>0){
        const pct=Math.min(100,Math.floor((done/total)*100));
        const mb=(done/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MB';
        showProgress(pct,'Downloading…',false,true,mb);
      }else showProgress(0,'Downloading…',true,true);
    }
  };
}
/**
 * #97 (PL-e) — host (ExtendScript) chaqiruvi uchun hang-guard.
 *
 * `csInterface.evalScript` callback'i Premiere modal dialog ochib qo'ysa (yetishmagan
 * shrift/effekt ogohlantirishi, "Save changes?" so'rovi) yoki host skript uzoq
 * ishlasa — callback HECH QACHON qaytmaydi. Ilgari bu holatda progress overlay
 * abadiy muzlar, panel esa o'lgandek ko'rinardi va foydalanuvchida chiqish yo'li
 * yo'q edi (`__afOpBusy` ham ochilmasdi → keyingi importlar ham bloklanardi).
 *
 * Bu o'ram:
 *   1) `softMs` dan keyin overlay matnini almashtiradi va «bekor qilish» tugmasini
 *      yoqadi — panel jonli ekani ko'rinadi va Premiere'da dialog borligi aytiladi;
 *   2) `hardMs` da o'zi settle bo'ladi.
 * ExtendScript'ni tashqaridan TO'XTATIB BO'LMAYDI — shu bois matn halol:
 * biz faqat KUTISHNI to'xtatamiz, Premiere fonda importni tugatishi mumkin.
 *
 * Natija doim string: host javobi yoki `{ok:false,error:'timeout'|'cancelled',message}`
 * JSON'i (chaqiruvchilar allaqachon shu shaklni parse qiladi).
 */
function hostEvalGuarded(script,opts){
  const o=opts||{};
  const softMs=o.softMs||15000;
  const hardMs=o.hardMs||180000;
  const label=o.label||'Premiere Pro';
  return new Promise((resolve)=>{
    let settled=false,softT=0,hardT=0;
    const done=(v)=>{
      if(settled)return;
      settled=true;
      clearTimeout(softT);clearTimeout(hardT);
      if(window.__afHostWait&&window.__afHostWait.done===done)window.__afHostWait=null;
      resolve(v);
    };
    softT=setTimeout(()=>{
      if(settled)return;
      showProgress(100,label+' is taking longer than usual — check Premiere Pro for an open dialog',true,true);
    },softMs);
    hardT=setTimeout(()=>{
      done(JSON.stringify({ok:false,error:'timeout',message:'Premiere Pro did not respond in '+Math.round(hardMs/1000)+'s — check Premiere for an open dialog, then try again'}));
    },hardMs);
    // onAfCancel shu yerdan kutishni uzadi (yuklab olish emas — host kutuvi)
    window.__afHostWait={done:done,cancel:()=>done(JSON.stringify({ok:false,error:'cancelled',message:'Stopped waiting — Premiere Pro may still finish the import in the background'}))};
    try{
      csInterface.evalScript(script,(raw)=>done(raw==null?'':String(raw)));
    }catch(e){
      done(JSON.stringify({ok:false,error:'evalfail',message:String((e&&e.message)||e)}));
    }
  });
}

async function importPackFileToAE(pack){
  if(!IS_CEP||!csInterface)return '';
  let importPath='';
  if(pack?.serverTemplateId&&typeof AssetFlowCatalog!=='undefined'){
    try{
      showProgress(0,'Preparing…');
      importPath=await AssetFlowCatalog.downloadPackToTemp(pack.serverTemplateId,pack.fileName||'template.aep',packDownloadOpts(pack));
    }catch(e){
      hideProgress();
      if(e&&e.cancelled) return '';   // foydalanuvchi bekor qildi — toast onAfCancel'da
      if(e&&e.mogrtItems){
        // Zip ichida bir nechta .mogrt — butun packni emas, tanlab import qilinadi
        applyMogrtItems('__srv_'+pack.serverTemplateId,e.mogrtItems);
        return 'mogrt:picker';
      }
      // Server gate (pack download): 402 PRO_REQUIRED → PRO sheet, 403 → oylik limit sheet (a5)
      if(e&&(e.status===402||e.code==='PRO_REQUIRED')){ openProSheet(pack?.displayName||pack?.name||''); return 'limit'; }
      if(e&&e.status===403){ openLimitSheet('download'); return 'limit'; }
      showToast(friendlyError(e),'error');
      return '';
    }
  }else if(pack?.fileBlobId){
    showProgress(0,'Preparing…');
    importPath=await AssetFlowStore.prepareImportFile(pack.fileBlobId,pack.fileName||'template.aep');
  }else return '';
  // Import limitini Premiere import qilishdan OLDIN majburlash (kesh'langan qayta-import
  // ham shu nuqtadan o'tadi). 403 — limit tugadi: import qilinmaydi.
  if(pack?.serverTemplateId&&typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.isLoggedIn()){
    try{
      await AssetFlowAccount.recordImport(pack.serverTemplateId);
      if(typeof refreshAccountUi==='function') refreshAccountUi();
    }catch(usageErr){
      if(usageErr&&usageErr.status===403){
        hideProgress();
        openLimitSheet('import');   // P21: Free oylik IMPORT limiti tugadi — import sheet (download emas)
        return 'limit';
      }
      // tarmoq/boshqa xato — bytes allaqachon gate'dan o'tgan, import davom etadi
    }
  }
  // P35 — footage-to'plami (zip ichida .aep/.mogrt yo'q, faqat kliplar): host
  // importFootageBundle bilan hammasini shablon nomidagi bin'ga FOOTAGE import.
  // recordImport allaqachon YUQORIDA bitta marta chaqirildi — bu yerda EMAS.
  if(importPath&&typeof importPath==='object'&&importPath.__footageBundle){
    const bundleFiles=Array.isArray(importPath.files)?importPath.files:[];
    const bundleLabel=String(pack?.displayName||pack?.name||'FrameFlow').trim()||'FrameFlow';
    showProgress(100,'Importing '+bundleFiles.length+' item'+(bundleFiles.length===1?'':'s')+'…',true);
    const bundleRaw=await hostEvalGuarded(`importFootageBundle(${JSON.stringify(JSON.stringify({files:bundleFiles,packLabel:bundleLabel}))})`,{label:'Importing footage'});
    hideProgress();
    let br=null;try{br=bundleRaw?JSON.parse(bundleRaw):null;}catch(e){br=null;}
    if(br&&br.ok){
      const n=br.imported||bundleFiles.length;
      showToast('Imported '+n+' item'+(n===1?'':'s')+' into "'+(br.folder||bundleLabel)+'"'+(br.failed?(' — '+br.failed+' skipped'):''),'success');
      return 'bundle:ok';
    }
    showToast('Import error: '+((br&&(br.reason||br.message))||(bundleRaw?String(bundleRaw):'no result')),'error');
    return '';
  }
  showProgress(100,'Importing into Premiere…',true);
  const packLabel=String(pack?.displayName||pack?.name||'FrameFlow').trim()||'FrameFlow';
  const mediaKind=packMediaKind(pack);
  // P5.2 — LUT: Premiere footage sifatida import qilib bo'lmaydi → faylni OS'da ko'rsatamiz + ko'rsatma.
  if(mediaKind==='lut'){
    await hostEvalGuarded(`revealFileInOS(${JSON.stringify(importPath)})`,{label:'Revealing file',hardMs:30000});
    hideProgress();
    showToast('LUT downloaded and revealed in your file browser. Apply it via Lumetri Color → Creative → Look, or the “Apply Color LUT” effect.','info');
    return 'lut:downloaded';
  }
  // P5.2 — Stock xom media (video/rasm/audio): FOOTAGE sifatida import + aktiv comp'ga qat'lam
  // (host importMediaFromPath — canImportAs(FOOTAGE) guard bilan). importTemplateProject EMAS.
  if(mediaKind==='video'||mediaKind==='image'||mediaKind==='audio'){
    const mediaRaw=await hostEvalGuarded(`importMediaFromPath(${JSON.stringify(importPath)})`,{label:'Importing media'});
    hideProgress();
    let mr=null;try{mr=mediaRaw?JSON.parse(mediaRaw):null;}catch(e){mr=(String(mediaRaw).indexOf('ok')===0)?{ok:true}:null;}
    if(mr&&mr.ok){
      showToast(mr.addedToComp?('Imported — added to '+(mr.compName?('"'+mr.compName+'" '):'')+'sequence'):'Imported to Premiere (Project panel)','success');
      return 'media:ok';
    }
    showToast('Import error: '+((mr&&(mr.reason||mr.message))||(mediaRaw?String(mediaRaw):'no result')),'error');
    return '';
  }
  // Default — .aep/.mogrt loyiha (video-templates). #97: hang-guard bilan.
  const projRaw=await hostEvalGuarded(`importTemplateProject(${JSON.stringify(JSON.stringify({filePath:importPath,packLabel}))})`,{label:'Importing template'});
  hideProgress();
  return projRaw||'';
}

async function importSingleSceneToAE(pack,scene,packLabel,importMode='timeline'){
  if(!IS_CEP||!csInterface)return '';
  let importPath='';
  if(pack?.serverTemplateId&&typeof AssetFlowCatalog!=='undefined'){
    try{
      showProgress(0,'Preparing…');
      if(scene?.mogrtPath&&AssetFlowCatalog.extractMogrtItem){
        // MOGRT-pack elementi — zip keshidan tanlangan .mogrt'ni extract qilamiz
        importPath=await AssetFlowCatalog.extractMogrtItem(pack.serverTemplateId,scene.mogrtPath);
      }else if(scene?.mogrtUrl&&AssetFlowCatalog.downloadSceneMogrt){
        // M2: faqat tanlangan sahna .mogrt'i yuklab olinadi — butun ZIP emas
        try{
          importPath=await AssetFlowCatalog.downloadSceneMogrt(pack.serverTemplateId,scene,sceneDownloadOpts());
        }catch(mogrtErr){
          // Server'da yakka .mogrt yo'q/xato — eski yo'l: butun pack
          console.warn('mogrt url yuklash xato, zip fallback',mogrtErr);
          importPath=await AssetFlowCatalog.downloadPackToTemp(pack.serverTemplateId,pack.fileName||'template.aep',packDownloadOpts(pack));
        }
      }else{
        importPath=await AssetFlowCatalog.downloadPackToTemp(pack.serverTemplateId,pack.fileName||'template.aep',packDownloadOpts(pack));
      }
    }catch(e){
      hideProgress();
      if(e&&e.cancelled) return '';   // foydalanuvchi bekor qildi — toast onAfCancel'da
      if(e&&e.mogrtItems){
        // Zip ichida bir nechta .mogrt — sahnalar ro'yxatiga aylantirib tanlatamiz
        applyMogrtItems(packLabel,e.mogrtItems);
        return JSON.stringify({ok:false,mogrtPicker:true});
      }
      // Server gate (pack/mogrt download): 402 PRO_REQUIRED → PRO sheet, 403 → oylik limit sheet (a5)
      if(e&&(e.status===402||e.code==='PRO_REQUIRED')){ openProSheet(pack?.displayName||pack?.name||packLabel||''); return 'limit'; }
      if(e&&e.status===403){ openLimitSheet('download'); return 'limit'; }
      showToast(friendlyError(e),'error');
      return '';
    }
  }else if(pack?.fileBlobId){
    showProgress(0,'Preparing…');
    importPath=await AssetFlowStore.prepareImportFile(pack.fileBlobId,pack.fileName||'template.aep');
  }else return '';
  // Import limitini Premiere import qilishdan OLDIN majburlash (kesh'langan/extract
  // qilingan qayta-import ham shu nuqtadan o'tadi). 403 — limit tugadi.
  if(pack?.serverTemplateId&&typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.isLoggedIn()){
    try{
      await AssetFlowAccount.recordImport(pack.serverTemplateId);
      if(typeof refreshAccountUi==='function') refreshAccountUi();
    }catch(usageErr){
      if(usageErr&&usageErr.status===403){
        hideProgress();
        openLimitSheet('import');   // P21: Free oylik IMPORT limiti tugadi — import sheet (download emas)
        return 'limit';
      }
      // tarmoq/boshqa xato — bytes allaqachon gate'dan o'tgan, import davom etadi
    }
  }
  // Yuklab olindi — endi Premiere import fazasi (sinxron, vaqt olishi mumkin)
  showProgress(100,'Importing into Premiere…',true);
  const compName=(scene?.aeComp||'').trim()||(scene?.n||'').trim();
  // Premiere'da ko'rinadigan nom — shablon title'i; __srv_<id> ichki kalit displeyga chiqmasin
  const isInternalKey=/^__srv_/.test(String(packLabel||''));
  const displayLabel=String(pack?.displayName||'').trim()
    ||(!isInternalKey?String(packLabel||'').trim():'')
    ||String(pack?.name||'').trim()
    ||'FrameFlow';
  const altNames=[];
  const pushAlt=(v)=>{const t=String(v||'').trim();if(t&&altNames.indexOf(t)<0)altNames.push(t);};
  pushAlt(scene?.aeComp);
  pushAlt(scene?.n);
  pushAlt(displayLabel);
  pushAlt(pack?.name);
  // .mogrt'dan chiqqan .aep bo'lsa — definition.json'dagi master comp nomi (eng aniq moslik)
  if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.mogrtCompName)pushAlt(AssetFlowCatalog.mogrtCompName(importPath));
  // Haqiqiy comp nomi (manifest aeComp) bo'lsa — faqat o'sha sahna + dependency import qilamiz.
  const pruneToScene=!!(scene&&scene.aeComp&&String(scene.aeComp).trim());
  const cfg=JSON.stringify({
    filePath:importPath,
    compName,
    sceneLabel:scene?.n||'',
    altCompNames:altNames,
    packLabel:displayLabel,
    scenesFolder:pack.aeScenesFolder||'Scenes',
    importMode:importMode||'timeline',
    pruneToScene
  });
  // #97 (PL-e): umumiy hang-guard — 15s dan keyin «bekor qilish», 180s da o'zi settle.
  // (Ilgari 30s qattiq timeout edi — katta .aep import'ida noto'g'ri "timeout" berardi.)
  return await hostEvalGuarded(`importSingleSceneFromAep(${JSON.stringify(cfg)})`,{label:'Importing scene'});
}
let featuredDismissedByNav={};
let currentNav='video', currentPage='assets', currentSub='all', currentOrient='all', currentRes='all', currentSearch='', currentSort='relevant';
window.currentNav=currentNav;
let currentPackName='', selectedSceneIdx=-1, selectedDropMode='project';
// Bir vaqtda bitta import/yuklab olish — qo'sh bosish va drag to'qnashuvini bloklaydi
let __afOpBusy=false;

function getAnim(i){
  if(i%2===0)return'<div class="preview-anim"><div class="anim-wave"><div class="anim-bar"></div><div class="anim-bar"></div><div class="anim-bar"></div><div class="anim-bar"></div></div></div>';
  return'<div class="preview-anim"><div class="anim-pulse"></div></div>';
}

/** Server matnini HTML'ga xavfsiz qo'yish (XSS himoyasi — katalog ishonchsiz manba) */
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
// SC_43: referens sig'imi ikonka indikatori — GLOBAL yordamchi (image/video toollar birga ishlatadi).
// kinds = [{k:'image'|'video'|'audio', used:N, lim:M, tip:'Up to M images ≤30MB'}] — faqat lim>0 turlar.
window.AF_CAP_ICONS={
  image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg>',
  video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="2.5"/><path d="M16 10l6-3.5v11L16 14"/></svg>',
  audio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
};
// SC_46: sessiya feed LOADING skeleton — bo'sh flash o'rniga shimmer kartalar (grid o'lchamiga mos)
window.afRecentSkel=function(n){
  var k=n||6, h='';
  for(var i=0;i<k;i++)h+='<div class="rcskel"></div>';
  return h;
};
window.afRenderCapInd=function(hostId,kinds){
  var host=document.getElementById(hostId); if(!host)return;
  host.innerHTML='';
  (kinds||[]).forEach(function(c){
    if(!c||!(c.lim>0))return; // model qabul qilmaydigan tur — UMUMAN chizilmaydi
    var full=(c.used||0)>=c.lim;
    var el=document.createElement('span');
    el.className='ci'+((c.used>0)?'':' zero')+(full?' full':'');
    el.title=c.tip||('Up to '+c.lim+' '+c.k);
    el.innerHTML=(window.AF_CAP_ICONS[c.k]||'')+'<b>'+(c.used||0)+'/'+c.lim+'</b>';
    host.appendChild(el);
  });
};

function renderThumbMedia(a){
  if(!a.thumb && !a.preview) return `<span class="ico">${escHtml(a.i)}</span>${getAnim(0)}`;
  let html = '';
  if(a.thumb) html += `<img class="thumb-poster" src="${escHtml(a.thumb)}" alt="${escHtml(a.n)}" loading="lazy">`;
  if(a.preview){
    const posterAttr=a.thumb?` poster="${escHtml(a.thumb)}"`:'';
    html += `<video class="thumb-media" data-src="${escHtml(a.preview)}"${posterAttr} muted loop playsinline></video>`;
    html += `<span class="thumb-play">▶</span>`;
  }
  return html;
}

function orientLabel(o){
  if(o==='horizontal')return '16:9';
  if(o==='vertical')return '9:16';
  if(o==='square')return '1:1';
  return '';
}

function renderCard(a,i,showDl){
  const dled=window.downloaded.has(a.n);
  const hasPreview=a.thumb||a.preview;
  const pack=packs[a.n];
  const noPack=!!(pack&&pack.server&&pack.hasPack===false);
  // a.n — ichki pack kaliti (__srv_<id> / lokal kalit), JS-string sifatida ishlatiladi
  const safeName=String(a.n).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
  // Tur rozetkasi: stock (Motion/Graphic/LUT/Music/SFX) yoki ilova (Ae/Pr/Mn/Dr) — §2/§11/P8.
  const appInfo=ffTypeBadge(a.templateApp,a.nav);
  const appLbl=appInfo.lbl;
  const appDot=appInfo.dot;
  // D10 — dastur (FF_APPS) bo'lsa plita + to'liq nom; stock turi bo'lsa eski nuqta + qisqa yorliq.
  const isApp=Object.keys(FF_APPS).some(function(k){return FF_APPS[k]===appInfo;});
  const appMark=isApp
    ? `<i class="tile" style="${hmAppTileStyle(appDot)}">${appLbl}</i>${appInfo.full||appLbl}`
    : `<i style="background:${appDot}"></i>${appLbl}`;
  // Status rozetkasi (yuqori-o'ng, bitta): ⏳ Pack > ✓ Yuklandi > AI bilan > YANGI
  let stTx='',stCol='';
  if(noPack){stTx='⏳ Pack';stCol='var(--amber)';}
  else if(dled){stTx='✓ Downloaded';stCol='var(--accent)';}
  else if(a.ai){stTx='With AI';stCol='var(--select)';}
  else if(a.nw&&!showDl){stTx='NEW';stCol='var(--accent)';}
  const stBadge=stTx?`<span class="ck-st" style="color:${stCol}">${stTx}</span>`:'';
  // SC_14: subtitr — FAQAT kategoriya (contributor nomi kartada ko'rsatilmaydi;
  // detail view'dagi muallif ma'lumoti tegilmagan).
  const subLine=a.t?escHtml(String(a.t)):'';
  const dlBtn=showDl?`<div role="button" tabindex="0" class="ck-del" title="Remove from project" onclick="event.stopPropagation();deleteDownloadedTemplate('${safeName}')">🗑</div>`:'';
  // SC_14: per-karta Import/Re-import tugmasi O'CHIRILDI — karta bosilishi detail'ni ochadi,
  // import/download detail'ning o'z tugmasida (pd3ImportAll — gated oqim o'zgarmagan).
  // "Downloaded" holati thumb ustidagi ✓ badge'da qoladi (stBadge).
  // #144 (PX7): `draggable` MARKUP'da qattiq qo'yilmaydi — uni `initDrag()` faqat haqiqiy
  // tashlash joyi bo'lganda qo'yadi. Klaviatura kontrakti AI natija kartasi (.rc) bilan bir xil:
  // role="button" + tabindex="0" + Enter/Space (delegatsiya `initDrag()` yonida).
  return`<div class="card${noPack?' no-pack':''}" role="button" tabindex="0" data-name="${escHtml(a.n)}" data-ico="${escHtml(a.i)}" data-preview="${escHtml(a.preview||'')}"
    onmouseenter="playCardPreview(this)" onmouseleave="pauseCardPreview(this)"
    onclick="openPack('${safeName}')">
    <div class="thumb${hasPreview?' has-preview':''}" style="background:${escHtml(a.bg)}">
      <span class="ck-plan ${a.isPro?'pro':'free'}">${a.isPro?'PRO':'FREE'}</span>
      ${stBadge}
      <span class="ck-app">${appMark}</span>
      ${hasPreview?renderThumbMedia(a):`<span class="ico">${escHtml(a.i)}</span>${getAnim(i)}`}
      ${dlBtn}
    </div>
    <div class="ck-title">${escHtml(a.displayName||a.n)}</div>
    ${subLine?`<div class="ck-sub">${subLine}</div>`:''}
  </div>`;
}

function playCardPreview(card){
  const v=card.querySelector('.thumb-media');
  if(!v)return;
  const src=v.dataset.src;
  if(src&&!v.src){
    v.src=src;
    v.preload='metadata';
  }
  v.currentTime=0;
  v.play().catch(()=>{});
}
function pauseCardPreview(card){
  const v=card.querySelector('.thumb-media');
  if(!v)return;
  // P10 — faqat pause() videoni oxirgi kadrda muzlatib qo'yardi (poster qaytmasdi);
  // load() dekodlangan kadrni tashlaydi, keyingi hover playCardPreview'da src qayta o'rnatiladi.
  try{
    v.pause();
    if(v.dataset.src) v.removeAttribute('src');
    v.load();
  }catch(e){}
}

function showMonitorPreview(asset){
  if(IS_CEP)return;
  const body=document.getElementById('monitorBody');
  const video=document.getElementById('monitorVideo');
  const label=document.getElementById('previewText');
  if(!body||!video)return;   // #143 (PX6): monitor faqat dev QA saxnasida bor
  let img=body.querySelector('.monitor-poster');
  if(!img){
    img=document.createElement('img');
    img.className='monitor-poster';
    img.alt='';
    body.appendChild(img);
  }
  if(asset&&asset.preview){
    img.style.display='none';
    body.classList.remove('has-poster');
    video.src=asset.preview;
    video.currentTime=0;
    body.classList.add('has-video');
    label.classList.add('active');
    video.play().catch(()=>{});
    return;
  }
  body.classList.remove('has-video');
  video.pause();
  video.removeAttribute('src');
  if(asset&&asset.thumb){
    img.src=asset.thumb;
    img.style.display='block';
    body.classList.add('has-poster');
    label.classList.add('active');
    return;
  }
  img.style.display='none';
  body.classList.remove('has-poster');
  label.textContent=asset?(asset.displayName||asset.n):'Drop file here';
  label.classList.toggle('active',!!asset);
}

function getScenePreviewMedia(scene,pack){
  const asset=assets.find(x=>x.n===currentPackName);
  const src=scene?.preview||pack?.preview||asset?.preview||'';
  const isImage=scene?.previewKind==='image';
  return {
    n:scene?.n||currentPackName,
    preview:isImage?'':src,
    thumb:isImage?src:(asset?.thumb||'')
  };
}

function catSlug(label){return SUB_SLUG[label]||'all';}

function countForSub(nav,slug){
  const prevSub=currentSub;
  currentSub=slug||'all';
  const n=getFiltered().length;
  currentSub=prevSub;
  return n;
}

const ORIENT_LABELS={all:'All',horizontal:'16:9',vertical:'9:16',square:'1:1'};
const RES_LABELS={all:'All','2k':'2K','4k':'4K','5k':'5K+'};

function buildCategoryMenu(nav){
  const menu=document.getElementById('catMenu');
  if(!menu)return;
  const labels=navSubs[nav]||navSubs.video;
  menu.innerHTML=labels.map(label=>{
    const slug=catSlug(label);
    const count=countForSub(nav,slug);
    const countLabel=slug==='all'?` (${count})`:'';
    const sel=slug===currentSub;
    const safeLabel=label.replace(/"/g,'&quot;');
    return `<div class="dd-item${sel?' selected':''}" data-slug="${slug}" data-label="${safeLabel}">${label}${countLabel}${sel?' <span class="dd-check">✓</span>':''}</div>`;
  }).join('');
  updateCategoryPillLabel();
}

function updateCategoryPillLabel(){
  const el=document.getElementById('catPillLabel');
  if(!el)return;
  if(currentSub==='all'){ el.textContent='Category'; return; }
  el.textContent=CAT_LABELS[currentSub]||currentSub;
}

function syncFilterDropMenu(menuId,filterValue){
  const menu=document.getElementById(menuId);
  if(!menu)return;
  menu.querySelectorAll('.dd-item').forEach(item=>{
    const on=item.dataset.filter===filterValue;
    item.classList.toggle('selected',on);
    const check=item.querySelector('.dd-check');
    if(on&&!check){
      const span=document.createElement('span');
      span.className='dd-check';
      span.textContent='✓';
      item.appendChild(span);
    }else if(!on&&check) check.remove();
  });
}

function updateOrientResPillLabels(){
  const o=document.getElementById('orientPillLabel');
  const r=document.getElementById('resPillLabel');
  if(o)o.textContent=currentOrient==='all'?'Format':(ORIENT_LABELS[currentOrient]||'Format');
  if(r)r.textContent=currentRes==='all'?'Quality':(RES_LABELS[currentRes]||'Quality');
}

function selectCategory(el,slug){
  currentSub=slug||el?.dataset?.slug||'all';
  buildCategoryMenu(currentNav);
  closeAllDropdowns();
  closePack();
  reloadServerBrowse(); // P1 #15 — kategoriya server tomonda filtrlanadi
}

function selectOrientFilter(el,value,label){
  currentOrient=value||'all';
  syncFilterDropMenu('orientMenu',currentOrient);
  const pill=document.getElementById('orientPillLabel');
  if(pill)pill.textContent=value==='all'?'Format':(label||ORIENT_LABELS[value]||'Format');
  closeAllDropdowns();
  closePack();
  reloadServerBrowse(); // P1 #15 — orientatsiya server tomonda
}
// E2: KATEGORIYA chiplari — katalogdan dinamik (navSubs), mavjud selectCategory ga
// ulanadi. Orientatsiya filtri Filtrlar panelidagi dropdown'da qoladi (o'zgarmaydi).
let __chipNav=null;
function buildCategoryChips(){
  const wrap=document.getElementById('afCatChips');
  if(!wrap||typeof navSubs==='undefined')return;
  const labels=navSubs[currentNav]||navSubs.video||[];
  wrap.innerHTML=labels.map(function(label){
    const slug=catSlug(label);
    const disp=slug==='all'?'All':label;
    const sj=String(slug).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div role="button" tabindex="0" type="button" class="af-chip'+(slug===currentSub?' active':'')+'" data-slug="'+escHtml(slug)+'" onclick="selectCategory(this,\''+sj+'\')">'+escHtml(disp)+'</div>';
  }).join('');
}
// aktiv holat currentSub bilan moslanadi (render() funneli orqali)
function syncCategoryChips(slug){
  document.querySelectorAll('#afCatChips .af-chip').forEach(function(c){
    c.classList.toggle('active',(c.dataset.slug||'all')===(slug||'all'));
  });
}
// E6.1: katalog top-tab → yashirin sidebar tugmasini .click() qiladi (mavjud onclick ishlaydi,
// handler tahrirlanmaydi, guard refs o'zgarmaydi). Aktiv holat render() funnelida syncTopNav bilan.
// SC_15/28: AI bo'limini ochib, mavjud axGo yo'liga o'tadi (Account sheet WORKSPACE + settings ishlatadi)
function afOpenAiSub(view){
  afNavTab('ai');
  if(typeof window.axGo==='function')setTimeout(function(){ window.axGo(view); },0);
}
/* ══ SC_21: fon generatsiya bildirishnomasi + global progress badge ══
   Poller endi view bilan o'lmaydi (teardown'lar yumshatilgan) — foydalanuvchi istalgan
   bo'limda yursa ham job tugaganda xabar oladi. OS-darajali bildirishnoma YO'Q — faqat
   panel ichida. Yangi endpoint yo'q — mavjud poll oqimlari chaqiradi. */
var __afGenToastT=null;
function afGenToast(view,cost,thumb,sessId,sessMode){
  var old=document.getElementById('afGenToast'); if(old)old.remove();
  clearTimeout(__afGenToastT);
  var d=document.createElement('div'); d.id='afGenToast'; d.className='af-gentoast';
  d.innerHTML=(thumb?'<span class="gt-th" style="background-image:url(\''+String(thumb).replace(/"/g,'')+'\')"></span>':'')
    +'<span class="gt-tx"><b>Generation ready</b>'+(typeof cost==='number'?'<small>✦'+cost+' charged</small>':'')+'</span>'
    +'<div role="button" tabindex="0" type="button" class="gt-view">View</div>'
    +'<div role="button" tabindex="0" type="button" class="gt-x" title="Dismiss">✕</div>';
  d.querySelector('.gt-view').addEventListener('click',function(){
    d.remove();
    afNavTab('ai');
    // SC_29: natija O'Z sessiyasiga tushgan — View o'sha sessiyani faollashtirib ochadi
    try{
      if(sessId){
        var so=(typeof window.axwsFindSession==='function')?window.axwsFindSession(sessId):null;
        window.__axwsSess=window.__axwsSess||{};
        if(view==='imggen'&&typeof window.axIGSetSession==='function'){ window.__axwsSess.imggen=so||{id:sessId,mode:'image'}; window.axIGSetSession(sessId); }
        else if(view==='vidgen'&&typeof window.axVGSetSession==='function'){ window.__axwsSess.vidgen=so||{id:sessId,mode:'video'}; window.axVGSetSession(sessId); }
        else if(view==='audgen'&&typeof window.axAGSetSession==='function'){ window.__axwsSess.audgen=so||{id:sessId,mode:sessMode||'voice'}; window.axAGSetSession((so&&so.mode)||sessMode||'voice',sessId); }
      }
    }catch(e){}
    if(typeof window.axGo==='function')setTimeout(function(){ window.axGo(view||'history'); },0);
  });
  d.querySelector('.gt-x').addEventListener('click',function(){ d.remove(); });
  document.body.appendChild(d);
  __afGenToastT=setTimeout(function(){ try{d.remove();}catch(e){} },7000);
}
window.afGenDoneNotify=function(view,cost,thumb,sessId,sessMode){
  var cur=document.querySelector('.axroot .view.on');
  var inAi=document.documentElement.classList.contains('ai-mode');
  // SC_29: "joyida" faqat view HAM sessiya HAM mos bo'lsa — aks holda View'li toast (to'g'ri sessiyaga olib boradi)
  var sameSess=true;
  try{
    if(sessId&&window.__axToolSess&&window.__axToolSess[view]){
      var cs=window.__axToolSess[view]();
      sameSess=Array.isArray(cs)?cs.indexOf(sessId)>=0:cs===sessId;
    }
  }catch(e){}
  if(inAi&&cur&&cur.id==='v-'+view&&sameSess){
    // Joyida — karta o'zi yangilandi; faqat mavjud kichik tasdiq (double-signal yo'q)
    if(typeof showToast==='function')showToast(typeof cost==='number'?('Done! ✦'+cost+' charged'):'Audio ready','success');
    return;
  }
  afGenToast(view,cost,thumb,sessId,sessMode);
};
// Global progress badge — top-bar "AI Tools" segmentida animatsion nuqta (+son >1 bo'lsa)
setInterval(function(){
  var n=0;
  try{ if(typeof window.__axIGRunning==='function')n+=window.__axIGRunning(); }catch(e){}
  try{ if(typeof window.__axVGRunning==='function')n+=window.__axVGRunning(); }catch(e){}
  try{ if(typeof window.__axAGRunning==='function')n+=window.__axAGRunning(); }catch(e){}
  var d=document.getElementById('afSegAiDot');
  if(d){
    if(n>0){ d.style.display=''; d.textContent=n>1?String(n):''; }
    else d.style.display='none';
  }
},1500);
// SC_11: kredit chip → kredit SOTIB OLISH oqimi (v-settings tepasidagi balans karta +
// ✦500/1500/5000 paketlar → startCreditTopup checkout). Guest → joriy xatti (Account sheet).
function afOpenTopup(){
  var logged=typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.isLoggedIn&&AssetFlowAccount.isLoggedIn();
  if(!logged){ if(typeof openAccountSheet==='function')openAccountSheet(); return; }
  afOpenAiSub('settings');
}
window.afOpenTopup=afOpenTopup;
function afNavTab(tab){
  // SC_12: uchinchi tab — Home (goHome mavjud yo'li; yangi routing yo'q)
  if(tab==='home'){
    if(typeof window.goHome==='function')window.goHome();
    syncPillarSeg();
    return;
  }
  if(tab==='catalog'){
    // P9: AI Tools'dan KATALOGGA qaytish. `[data-nav="catalog"]` yo'q — joriy (yoki default
    // "video"=Templates) katalog nav linkini bosamiz → applyNavSwitch ai-mode'ni olib tashlaydi.
    const cur=(typeof currentNav!=='undefined' && ['video','motion','graphics','luts'].indexOf(currentNav)>=0)?currentNav:'video';
    const el=document.querySelector('.env-side-link[data-nav="'+cur+'"]');
    if(el) el.click();
    else if(typeof applyNavSwitch==='function') applyNavSwitch(cur);
    if(typeof syncTopNav==='function') syncTopNav();
    syncPillarSeg();
    return;
  }
  const el=document.querySelector('.env-side-link[data-nav="'+tab+'"]');
  if(el) el.click();
  // AI yo'li render() chaqirmaydi (alohida sahifa) — tab aktiv holatini shu yerda moslaymiz
  if(typeof syncTopNav==='function') syncTopNav();
  syncPillarSeg();
}
// SC_12: header "Home · AI Tools · Stock Catalog" segment aktiv holatini joriy
// ko'rinishga moslaydi (har navigatsiya yo'lidan chaqiriladi — seg bosishidan tashqari ham).
function syncPillarSeg(){
  const h=document.documentElement;
  const isAi=h.classList.contains('ai-mode');
  const isHome=h.classList.contains('home-mode');
  const set=function(el,on){ if(el){ el.classList.toggle('is-on',on); el.setAttribute('aria-selected',on?'true':'false'); } };
  set(document.getElementById('afSegHome'),isHome);
  set(document.getElementById('afSegAi'),isAi);
  // lib-mode (Kutubxonam) katalog oilasiga kiradi — Stock Catalog yonadi
  set(document.getElementById('afSegKatalog'),!isAi&&!isHome);
}
// E6.2: header ixcham ikonalar (Downloads/Favorites) → yashirin sidebar .env-side-link[data-page]
// tugmasini .click() qiladi → mavjud onclick ishlaydi (handler tahrirlanmaydi).
function afHeaderPage(page){
  const el=document.querySelector('.env-side-link[data-page="'+page+'"]');
  if(el) el.click();
}
function syncTopNav(){
  const cur=(typeof currentNav!=='undefined')?currentNav:'video';
  document.querySelectorAll('#afTabs .af-tab').forEach(function(t){
    const on=t.dataset.nav===cur;
    t.classList.toggle('active',on);
    t.setAttribute('aria-selected',on?'true':'false');
  });
  // SC_35: aktiv tab strip ichida ko'rinsin + chet fade'lar yangilansin
  try{ const strip=document.getElementById('afTabs'); if(strip){ afRefreshStrip(strip); afScrollActiveStripIntoView(strip); } }catch(e){}
}
// Karta zichligi (view density) — html.dens-* class grid ustunlarini/karta ichini boshqaradi.
// Displey-only, localStorage'да saqlanadi. Karta markup'i o'zgarmaydi (faqat o'lcham CSS).
let __density=(function(){try{const v=localStorage.getItem('af.cardDensity');return (v==='sm'||v==='md'||v==='lg')?v:'md';}catch(e){return 'md';}})();
function applyDensityClass(){
  const h=document.documentElement;
  h.classList.remove('dens-sm','dens-md','dens-lg');
  h.classList.add('dens-'+__density);
  const b=document.getElementById('densityBtn');
  if(b)b.title='Card density: '+(__density==='sm'?'Compact':__density==='lg'?'Large':'Medium'); // SC_24: ustun soni endi kenglikka bog'liq (auto-fill)
}
function afCycleDensity(){
  const order=['md','sm','lg'];
  __density=order[(order.indexOf(__density)+1)%order.length];
  try{localStorage.setItem('af.cardDensity',__density);}catch(e){}
  applyDensityClass();
}
try{applyDensityClass();}catch(e){}
// SC_35: diagnostika — ulanish holati (catalogLoadState) + build versiyasi (displey-only).
// Endi Account sheet oxiridagi jim #acsDiag footer'ga yoziladi (pastki texnik qator olib tashlandi).
function updateConnStatus(){
  const wrap=document.getElementById('acsDiag');
  if(!wrap)return;
  const st=(typeof catalogLoadState!=='undefined')?catalogLoadState:'idle';
  wrap.classList.toggle('ok',st==='ready');
  wrap.classList.toggle('err',st==='error');
  const t=document.getElementById('acsDiagText');
  if(t)t.textContent=st==='ready'?'Server connected':st==='error'?'Server not connected':st==='loading'?'Loading…':'Waiting';
  const v=document.getElementById('acsDiagVer');
  if(v){const b=document.getElementById('afBuild');v.textContent=b?String(b.textContent).replace(/^build:\s*/,'').trim():'';}
}

/* ═══ SC_35: JONLI panel-resize adaptatsiyasi ═══════════════════════════════════════
   Premiere panel chetini sudraganda HAR sirt o'zini qayta moslaydi. CSS media-query + auto-fill
   grid'lar allaqachon jonli; bu yerda FAQAT-yuklashda/navigatsiyada hisoblanadigan JS-layout
   (virtual grid ustun/qatorlari, top-bar yorliq rejimi, pill-strip fade/aktiv-ko'rinish)
   yagona debounce'langan (~100ms) resize handler'ga ulanadi. Sikl/thrash yo'q. */

// Top-bar: haqiqiy toshib chiqishga qarab bosqichli ixchamlash (media-query'dan mustaqil).
// CSS grid ota-elementining scrollWidth'i toshishni ishonchli ko'rsatmaydi — shu sabab uch
// klaster (chap · seg · o'ng) KONTENT kengligini (scrollWidth, bolalar flex:none) yig'ib,
// panel kengligiga solishtiramiz. 8px tolerans soxta ishga tushishning oldini oladi.
function afFitTopbar(){
  const bar=document.querySelector('.af-topbar');
  const root=document.documentElement;
  root.classList.remove('tb-c1','tb-c2','tb-c3');
  if(!bar||getComputedStyle(bar).display==='none')return;
  const l=bar.querySelector('.af-tb-l'), s=bar.querySelector('.af-tb-seg'), r=bar.querySelector('.af-tb-r');
  const overflowing=function(){
    const need=(l?l.scrollWidth:0)+(s?s.scrollWidth:0)+(r?r.scrollWidth:0)+44; // 2×gap(10)+padding(24)
    return need>bar.clientWidth+8;
  };
  const steps=['tb-c1','tb-c2','tb-c3'];
  let i=0;
  while(i<steps.length && overflowing()){ root.classList.add(steps[i]); i++; }
}

// Pill scroll-strip: sig'sa markaz, toshsa chapdan scroll + chet fade'lar (qirqilish yo'q).
function afRefreshStrip(el){
  if(!el)return;
  const overflow=el.scrollWidth>el.clientWidth+2;
  el.classList.toggle('overflowing',overflow);
  if(!overflow){ el.classList.remove('fade-l','fade-r'); return; }
  const sl=el.scrollLeft, max=el.scrollWidth-el.clientWidth;
  el.classList.toggle('fade-l',sl>2);
  el.classList.toggle('fade-r',sl<max-2);
}
// Aktiv pill'ni strip ichida ko'rinadigan qilib markazlashtiradi (sahifa scroll'iga TEGMAYDI).
function afScrollActiveStripIntoView(el){
  if(!el)return;
  const a=el.querySelector('.active,.is-on');
  if(!a)return;
  if(el.scrollWidth<=el.clientWidth+2)return;
  const ar=a.getBoundingClientRect(), er=el.getBoundingClientRect();
  if(ar.left<er.left || ar.right>er.right){
    const target=a.offsetLeft-(el.clientWidth-a.offsetWidth)/2;
    el.scrollLeft=Math.max(0,target);
  }
}
// Strip'ni bir marta simlaydi: wheel→gorizontal, sudrab scroll, scroll'da fade yangilash.
function afInitScrollStrip(el){
  if(!el||el.__afStrip)return; el.__afStrip=true;
  el.addEventListener('wheel',function(e){
    if(el.scrollWidth<=el.clientWidth+2)return;
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ el.scrollLeft+=e.deltaY; e.preventDefault(); }
  },{passive:false});
  let down=false,sx=0,sl=0,moved=false;
  el.addEventListener('pointerdown',function(e){ down=true;moved=false;sx=e.clientX;sl=el.scrollLeft; });
  window.addEventListener('pointermove',function(e){ if(!down)return; const dx=e.clientX-sx; if(Math.abs(dx)>3)moved=true; el.scrollLeft=sl-dx; });
  window.addEventListener('pointerup',function(){ down=false; });
  // Sudralgandan keyingi "fantom" click pill tanlamasin.
  el.addEventListener('click',function(e){ if(moved){ e.preventDefault(); e.stopPropagation(); } },true);
  el.addEventListener('scroll',function(){ afRefreshStrip(el); },{passive:true});
  afRefreshStrip(el);
}
function afInitAllStrips(){
  const t=document.getElementById('afTabs'); if(t) afInitScrollStrip(t);
  const c=document.getElementById('afCatChips'); if(c) afInitScrollStrip(c);
}

let __afResizeTimer=null;
function afOnResize(){
  try{ afFitTopbar(); }catch(e){}
  // Virtual grid ustun/qator metrikasi kenglikka bog'liq — resize'da bekor qilib qayta chizamiz.
  try{
    if(typeof __gridList!=='undefined' && __gridList.length){
      __gridCardH=0; __gridCols=0; __gridWinKey='';
      if(typeof renderGrid==='function') renderGrid();
    }
  }catch(e){}
  try{
    const t=document.getElementById('afTabs'); if(t){ afRefreshStrip(t); afScrollActiveStripIntoView(t); }
    const c=document.getElementById('afCatChips'); if(c && !c.hasAttribute('hidden')){ afRefreshStrip(c); afScrollActiveStripIntoView(c); }
  }catch(e){}
  try{ axwsFitDockrows(); }catch(e){}
}
try{
  window.addEventListener('resize',function(){
    if(__afResizeTimer)clearTimeout(__afResizeTimer);
    __afResizeTimer=setTimeout(afOnResize,100);
  },{passive:true});
}catch(e){}

/* SC_54 — kompozer boshqaruv qatorini BITTA qatorda ushlash: qator sig'masligini o'lchab, minimal
   zarur kompaktlash zinasini (kc1…kc9 + data-compact) qo'yamiz. Har zina faqat oldingisi yetmasa.
   Generate (amal guruhi) qisqarmaydi. Faqat transform/opacity-siz — layout sakramaydi.
   SC_55 — sig'maslikni ANIQ o'lchov: `overflow:hidden` olib tashlangach `row.scrollWidth` YETARLI
   EMAS, chunki kc6'да setgroup shrink bo'lib o'z bolalarining toshishini yashiradi (scrollWidth
   o'smaydi). Shuning uchun SETTINGS chiplarining eng o'ng qirrasi AMAL guruhi (genwrap) chap
   qirrasidan OSHSA overflow deb hisoblaymiz (aynan o'lik-bosishга sabab bo'lgan qoplama); zaxira
   sifatida row.scrollWidth ham tekshiriladi (Generate o'ngдан chiqib ketmasin). */
function axwsRowOverflow(row){
  var gw=row.querySelector('.axws-genwrap');
  if(gw){
    var gwLeft=gw.getBoundingClientRect().left, sg=row.querySelector('.axws-setgroup');
    if(sg){ var k=sg.children, maxR=0;
      for(var i=0;i<k.length;i++){ if(getComputedStyle(k[i]).display==='none')continue; var r=k[i].getBoundingClientRect(); if(r.width>0&&r.right>maxR)maxR=r.right; }
      if(maxR > gwLeft + 1) return true; // settings AMAL guruhini qoplaydi
    }
  }
  return row.scrollWidth > row.clientWidth + 1; // Generate o'ngdan chiqib ketishi (zaxira tekshiruv)
}
/* SC_56: ⋯ overflow — sig'may qolgan boshqaruvni YASHIRMAY (kc7/8/9 o'chirildi) popover'ga KO'CHIRAMIZ.
   Aynan bir xil jonli element (marker-comment bilan asl joyi eslab qolinadi) — handler/holat saqlanadi. */
function axwsOvfBody(row){ var w=row.querySelector('.axws-ovfwrap'); return w?w.querySelector('.axws-ovfbody'):null; }
/* Ko'chiriladigan boshqaruvlar — Director ustuvorligi: output & audio → Clear → (voice/dur) → mode → model.
   HECH QACHON: Enhance, Generate(+narx). Ro'yxat ASL joyidagi (restoreAll'dan keyin) holatдан quriladi. */
function axwsMovables(row){
  var sg=row.querySelector('.axws-setgroup'), gw=row.querySelector('.axws-genwrap'), out=[];
  function ok(el){ return el&&el.offsetParent!==null; }
  function add(el){ if(ok(el)&&out.indexOf(el)<0)out.push(el); }
  if(sg){ add(sg.querySelector('.pill-out')); Array.prototype.forEach.call(sg.querySelectorAll('.pillseg.tgl'),add); }
  if(gw)add(gw.querySelector('.axws-clear'));
  if(sg){
    ['agVoiceWrap','agDurWrap'].forEach(function(idv){ var el=document.getElementById(idv); if(el&&sg.contains(el))add(el); }); // audio: voice/dur chip
    var mb=sg.querySelector('.ai-set.mode'); add(mb?mb.closest('.axws-modewrap'):null); // mode
    add(sg.querySelector('.pill-model')); // model — oxirgi chora
  }
  return out;
}
function axwsMoveToOvf(el,body){
  if(!el||!body||el.parentNode===body)return;
  if(!el.__ovfMarker){ var m=document.createComment('ovf'); if(el.parentNode)el.parentNode.insertBefore(m,el); el.__ovfMarker=m; }
  body.appendChild(el);
}
function axwsRestoreEl(el){
  if(!el||!el.__ovfMarker)return; var m=el.__ovfMarker;
  if(m.parentNode)m.parentNode.replaceChild(el,m); el.__ovfMarker=null;
}
function axwsRestoreAll(row){
  var body=axwsOvfBody(row); if(!body)return;
  Array.prototype.slice.call(body.children).forEach(axwsRestoreEl);
}
function axwsOvfSync(row){
  var w=row.querySelector('.axws-ovfwrap'), body=axwsOvfBody(row); if(!w||!body)return;
  var has=body.children.length>0; w.style.display=has?'':'none';
  if(!has){ var pop=w.querySelector('.axws-ovfpop'); if(pop)pop.classList.remove('open'); }
}
function axwsFitRow(row){
  var sg=row.querySelector('.axws-setgroup'); if(!sg)return;
  axwsRestoreAll(row); // 1) hammani asl joyiga — to'liq qatordan hisoblaymiz (deterministik)
  row.classList.remove('kc1','kc2','kc3','kc4','kc5','kc6');
  row.setAttribute('data-compact','0');
  // 2) yorliq-kompaktlash zinasi 1..6 (SC_54/SC_55): avval so'zlar tashlanadi, model nomi ellipsis
  var lvl; for(lvl=1; lvl<=6; lvl++){ if(!axwsRowOverflow(row))break; row.classList.add('kc'+lvl); row.setAttribute('data-compact',String(lvl)); }
  // 3) hali sig'masa — boshqaruvlarni ⋯ popover'ga ustuvorlik tartibida KO'CHIRAMIZ (yashirmaymiz)
  var body=axwsOvfBody(row), w=row.querySelector('.axws-ovfwrap');
  if(body&&axwsRowOverflow(row)){
    if(w)w.style.display=''; // ⋯ endi kenglik oladi — o'lchov to'g'ri bo'lsin
    var mv=axwsMovables(row), i, guard=0;
    for(i=0;i<mv.length&&guard<12;i++,guard++){ if(!axwsRowOverflow(row))break; axwsMoveToOvf(mv[i],body); }
  }
  axwsOvfSync(row);
}
/* SC_56: fit paytida SETgroup MO'sini uzamiz — ko'chirish (childList) o'zi qayta-fit trigger qilmasin
   (aks holda ko'chir→MO→fit→ko'chir cheksiz aylanardi). Tashqi o'zgarish (model nomi, mode) fit'dan
   keyin qayta ulanganda ushlanadi. */
var __axwsSetMo=null, __axwsSetGroups=[];
function __axwsMoObserve(){ if(!__axwsSetMo)return; try{ for(var i=0;i<__axwsSetGroups.length;i++)__axwsSetMo.observe(__axwsSetGroups[i],{subtree:true,childList:true,characterData:true,attributes:true}); }catch(e){} }
function axwsFitDockrows(){
  if(__axwsSetMo)try{ __axwsSetMo.disconnect(); }catch(e){}
  var rows=document.querySelectorAll('.axws-dockrow');
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    if(r.offsetParent===null) continue; // yashirin tool — o'tkazib yubor
    try{ axwsFitRow(r); }catch(e){}
  }
  __axwsMoObserve();
}
var __axwsFitTimer=null;
function axwsScheduleFit(){
  if(__axwsFitTimer)clearTimeout(__axwsFitTimer);
  __axwsFitTimer=setTimeout(function(){ try{ axwsFitDockrows(); }catch(e){} },100);
}
window.axwsFitDockrows=axwsFitDockrows;
window.axwsScheduleFit=axwsScheduleFit;
/* observerlar: RO = kenglik o'zgarishi (jonli Premiere panel resize); MO = kontent o'zgarishi
   (model nomi, mode almashuvi, audio toggle paydo bo'lishi). Ikkalasi ham debounce'langan. */
try{
  var _docks=document.querySelectorAll('.axws-dock');
  if(window.ResizeObserver){
    var _ro=new ResizeObserver(function(){ axwsScheduleFit(); });
    for(var d=0; d<_docks.length; d++){ try{ _ro.observe(_docks[d]); }catch(e){} }
  }
  if(window.MutationObserver){
    __axwsSetMo=new MutationObserver(function(){ axwsScheduleFit(); });
    for(var s=0; s<_docks.length; s++){
      var _sg=_docks[s].querySelector('.axws-setgroup');
      if(_sg)__axwsSetGroups.push(_sg);
    }
    __axwsMoObserve();
  }
  // dastlabki moslashuv (layout tayyor bo'lgach)
  setTimeout(function(){ try{ axwsFitDockrows(); }catch(e){} },300);
}catch(e){}

function selectResFilter(el,value,label){
  currentRes=value||'all';
  syncFilterDropMenu('resMenu',currentRes);
  const pill=document.getElementById('resPillLabel');
  if(pill)pill.textContent=value==='all'?'Quality':(label||RES_LABELS[value]||'Quality');
  closeAllDropdowns();
  closePack();
  reloadServerBrowse(); // P1 #15 — sifat server tomonda
}

function resMatchesAsset(assetRes,filterRes){
  const r=String(assetRes||'').toLowerCase().replace(/\s/g,'');
  if(!filterRes||filterRes==='all')return true;
  if(filterRes==='5k'){
    if(r==='5k'||r==='6k'||r==='8k')return true;
    const n=parseInt(r,10);
    return !isNaN(n)&&n>=5000;
  }
  return r===filterRes;
}

// P1 #15 — plagin joriy filtr holatidan SERVER katalog paramlarini quradi.
// nav→templateType, sub→cat, orient/res, qidiruv→q, sort→server sort. Server BUTUN
// baza bo'yicha filtrlaydi (grid endi "birinchi sahifa ichidan" qidirmaydi — P5.1).
function catalogFilters(){
  const navToType={video:'video-templates',motion:'motion-graphics',graphics:'graphics',luts:'luts',music:'music',sfx:'sfx'};
  const sortMap={relevant:'mos',newest:'new',name:'az'};
  const f={ templateType: navToType[currentNav]||'' };
  const sv=sortMap[currentSort]; if(sv&&sv!=='mos') f.sort=sv;
  if(currentSub&&currentSub!=='all') f.cat=currentSub;
  if(currentNav!=='luts'){
    if(currentOrient&&currentOrient!=='all') f.orient=currentOrient;
    if(currentRes&&currentRes!=='all') f.res=currentRes;
  }
  if(currentSearch) f.q=currentSearch;
  return f;
}
// Filtr/nav/qidiruv/sort o'zgarganda serverdan 1-sahifani qayta oladi (refreshBrowse
// ichida render() chaqiriladi). AI nav'da server so'rov shart emas.
function reloadServerBrowse(){
  if(currentNav==='ai'||typeof AssetFlowCatalog==='undefined'||!AssetFlowCatalog.refreshBrowse){ render(); return; }
  AssetFlowCatalog.refreshBrowse(catalogFilters(),{reset:true}).catch(()=>{ render(); });
}

function getFiltered(){
  return assets.filter(a=>{
    // FAZA 5 (§11) — Premiere plagin FAQAT Premiere Pro: dasturi belgilangan va Premiere bo'lmagan shablonlar chiqmaydi
    // (server ?app=ae filtridan tashqari klient zaxirasi). Belgilanmagan (bo'sh) → Premiere deb qabul qilinadi.
    if(a.templateApp&&String(a.templateApp).toLowerCase()!=='pr')return false;
    // P1 #15 — SERVER itemlari allaqachon server tomonda filtrlangan (nav/cat/orient/
    // res/qidiruv, BUTUN baza bo'yicha) → qayta filtrlamaymiz. Aks holda serverning
    // description-mos yoki boshqa-mezon natijasi bu yerda yo'qolardi. Faqat LOKAL
    // (upload/downloaded) itemlar mijoz tomonida filtrlanadi (ular sahifalanmaydi).
    if(a.server) return true;
    if(a.nav!==currentNav)return false;
    if(currentSub!=='all'&&a.cat!==currentSub)return false;
    if(currentNav!=='luts'&&currentOrient!=='all'&&a.orient!==currentOrient)return false;
    if(currentNav!=='luts'&&currentRes!=='all'&&!resMatchesAsset(a.res,currentRes))return false;
    if(currentSearch){
      const hay=[a.displayName||a.n,a.t,a.catLabel||'',...(a.tags||[])].join(' ').toLowerCase();
      if(!hay.includes(currentSearch))return false;
    }
    return true;
  });
}

/** Asset yaratilgan vaqti (ms) — server createdAt; lokalda 0 (oxiriga tushadi) */
function assetTime(a){
  const t=Date.parse((a&&a.createdAt)||'');
  return isNaN(t)?0:t;
}
/** Qidiruv so'ziga moslik bali (yuqori = mosroq). Bo'sh so'rovda 0. */
function relevanceScore(a,q){
  if(!q)return 0;
  const name=String(a.displayName||a.n||'').toLowerCase();
  const cat=String(a.catLabel||a.t||'').toLowerCase();
  const tags=(a.tags||[]).map(t=>String(t).toLowerCase());
  let s=0;
  if(name===q)s+=100;
  else if(name.indexOf(q)===0)s+=60;
  else if(name.indexOf(q)>=0)s+=35;
  if(tags.some(t=>t===q))s+=25;
  else if(tags.some(t=>t.indexOf(q)>=0))s+=12;
  if(cat.indexOf(q)>=0)s+=10;
  return s;
}
function sortAssetList(list){
  const out=[...list];
  if(currentSort==='name'){
    out.sort((a,b)=>String(a.displayName||a.n).localeCompare(String(b.displayName||b.n),undefined,{sensitivity:'base'}));
    return out;
  }
  if(currentSort==='newest'){
    // Haqiqiy sana bo'yicha (yangi→eski); sana teng bo'lsa server avval
    out.sort((a,b)=>{
      const ta=assetTime(a), tb=assetTime(b);
      if(tb!==ta)return tb-ta;
      const sa=a.server?1:0, sb=b.server?1:0;
      if(sb!==sa)return sb-sa;
      return String(b.n).localeCompare(String(a.n));
    });
    return out;
  }
  // 'relevant' — qidiruv bo'lsa moslik bo'yicha, aks holda server tartibi (API yangi→eski)
  const q=currentSearch;
  if(q){
    out.sort((a,b)=>{
      const d=relevanceScore(b,q)-relevanceScore(a,q);
      if(d!==0)return d;
      return assetTime(b)-assetTime(a);
    });
  }
  return out;
}

function updateGridLabel(){
  const nav=NAV_LABELS[currentNav]||'Assets';
  const sub=CAT_LABELS[currentSub];
  const el=document.getElementById('gridLabel');
  if(!el)return;
  let base=currentSub==='all' ? ('All '+nav) : (sub||currentSub);
  // SC_37 — qidiruv faol bo'lsa sarlavha doirani aytadi: q joriy bo'lim ichida qidiriladi
  const q=(currentSearch||'').trim();
  if(q)base='Results for "'+q+'" in '+base;
  // a1 grid sarlavha: "BARCHA SHABLONLAR · <hisob>" (hisob render()'da o'rnatilgan #assetCount)
  const cEl=document.getElementById('assetCount');
  const n=cEl?String(cEl.textContent||'').trim():'';
  el.textContent=n?(base+' · '+n):base;
}

function updatePackFooter(){
  const label=document.getElementById('pd3ImportHint');
  const btn=document.getElementById('importSceneBtn');
  const footBtn=document.getElementById('footImportBtn');
  const pack=packs[currentPackName];
  const canImport=packCanAeImport(pack);
  if(label) label.textContent=canImport?'':'No pack (.mogrt) available for this template yet';
  if(btn) btn.disabled=!canImport;
  if(footBtn){
    footBtn.disabled=!canImport;
    footBtn.textContent=canImport?'Import':'No pack';
  }
}

/* a3 hero video — glass play tugmasi (poster→video) */
function pd3ToggleHeroPlay(btn){
  const hero=btn.closest('.pd3-hero');
  const v=hero?.querySelector('.pd3-hero-vid');
  if(!v)return;
  if(hero.classList.contains('playing')&&!v.paused){
    v.pause();hero.classList.remove('playing');return;
  }
  hero.classList.add('playing');
  v.currentTime=0;
  v.play().catch(()=>{});
}
window.pd3ToggleHeroPlay=pd3ToggleHeroPlay;

/* ===== Katalog a3 — shablon detail (mockup 1:1 qobiq; import mantig'i saqlangan) ===== */
/* SC_49: PD3_STAR / PD3_STAR_FILL (Favorite icons) o'chirildi */
const PD3_PLAY='<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.2v13.6L19 12z"/></svg>';

/* Gradient placeholder — Home (1b) bilan bir xil oila, nom bo'yicha barqaror */
function pd3Grad(key){
  try{ if(typeof HM_GRAD!=='undefined'&&typeof HM_GKEYS!=='undefined'&&HM_GKEYS.length)
    return HM_GRAD[HM_GKEYS[hmHash(key)%HM_GKEYS.length]]; }catch(e){}
  return 'radial-gradient(120% 100% at 18% 0%,rgba(255,255,255,.14),transparent 55%),linear-gradient(138deg,#20153A,#8F4FD1 62%,#0F0A1C)';
}
function pd3AppInfo(asset){
  const info=ffTypeBadge(asset&&asset.templateApp,asset&&asset.nav);
  return {lbl:info.lbl,dot:info.dot};
}
function pd3AuthorName(asset){ return (asset&&asset.author&&(asset.author.name||asset.author))||''; }
function pd3Fmt(s){ s=Math.max(0,Math.round(s)); const m=Math.floor(s/60); return m+':'+String(s%60).padStart(2,'0'); }

/* Hero (210px) — real preview/thumb bo'lsa undan, aks holda gradient placeholder */
function renderPackHero(name,pack,asset){
  const hero=document.getElementById('packHero');
  if(!hero)return;
  const heroVid=pack.preview||asset?.preview||'';
  const thumb=asset?.thumb||'';
  const isPro=!!(asset&&asset.isPro);
  const isAi=!!(asset&&asset.ai);
  hero.className='pd3-hero';
  hero.style.background=pd3Grad(name);
  let inner='';
  if(thumb) inner+=`<img class="pd3-hero-poster" src="${escHtml(thumb)}" alt="${escHtml(asset?.displayName||name)}">`;
  if(heroVid){
    const posterAttr=thumb?` poster="${escHtml(thumb)}"`:'';
    inner+=`<video class="pd3-hero-vid" src="${escHtml(heroVid)}"${posterAttr} muted loop playsinline preload="metadata"></video>`;
  }
  inner+='<div class="pd3-hero-shade"></div>';
  inner+=`<span class="pd3-hero-plan ${isPro?'pro':'free'}">${isPro?'PRO':'FREE'}</span>`;
  if(isAi) inner+='<span class="pd3-hero-ai">With AI</span>';
  if(heroVid) inner+=`<div role="button" tabindex="0" type="button" class="pd3-hero-play" onclick="pd3ToggleHeroPlay(this)" aria-label="Preview">${PD3_PLAY}</div>`;
  inner+='<span class="pd3-hero-dur" id="pd3HeroDur" style="display:none"></span>';
  hero.innerHTML=inner;
  // Davomiylik pill — video metadata yuklangach real qiymat bilan
  const v=hero.querySelector('.pd3-hero-vid');const dur=hero.querySelector('#pd3HeroDur');
  if(v&&dur){
    const set=()=>{ if(v.duration&&isFinite(v.duration)){ dur.textContent=pd3Fmt(v.duration); dur.style.display='block'; } };
    if(v.readyState>=1&&v.duration)set(); else v.addEventListener('loadedmetadata',set,{once:true});
  }
}

/* Meta — sarlavha, kategoriya+Ae chip+muallif, mono sub-line, teglar, tavsif */
function renderPackMeta(name,pack,asset){
  const title=escHtml(asset?.displayName||pack.displayName||name);
  const cat=escHtml(asset?.t||asset?.catLabel||NAV_LABELS[asset?.nav]||'Templates');
  const app=pd3AppInfo(asset);
  const author=pd3AuthorName(asset);
  const authorHtml=author?`<span class="pd3-mdot"></span><span class="pd3-av"></span><span class="pd3-by">${escHtml(author)}</span>`:'';
  const bits=[];
  // P9: pack hajmi web bilan bir xil ko'rsatiladi ("20.1 MB pack")
  const fsz=Number(pack?.fileSize||asset?.fileSize||0);
  bits.push(packCanAeImport(pack)?(fsz>0?((fsz/1048576).toFixed(1)+' MB pack'):'Pack available'):'No pack');
  const res=asset?.res?String(asset.res).toUpperCase():'';
  const ratio=orientLabel(asset?.orient);
  if(res&&ratio)bits.push(res+'·'+ratio); else if(res)bits.push(res); else if(ratio)bits.push(ratio);
  const tags=(asset?.tags||[]).filter(Boolean).slice(0,6);
  const tagsHtml=tags.length?`<div class="pd3-tags">${tags.map(t=>`<span class="pd3-tag">${escHtml(String(t))}</span>`).join('')}</div>`:'';
  const desc=(pack.description||'').trim();
  const descHtml=desc?`<div class="pd3-desc">${escHtml(desc)}</div>`:'';
  const noPack=!!(pack.server&&pack.hasPack===false);
  const noPackHtml=noPack?`<div class="pd3-nopack">⏳ Project (.mogrt) file not uploaded yet — import isn't possible. The pack file must be uploaded via Contributor Studio.</div>`:'';
  const fr=pack.aeFinalRender;
  const frHtml=fr?`<div class="pd3-fr">Final Render: <strong>${escHtml(fr.name)}</strong>${fr.width?' · '+fr.width+'×'+fr.height:''}${fr.fps?' · '+fr.fps+'fps':''}</div>`:'';
  return `<div class="pd3-title">${title}</div>
    <div class="pd3-metarow">
      <span class="pd3-cat">${cat}</span>
      <span class="pd3-appchip"><i style="background:${app.dot}"></i>${app.lbl}</span>
      ${authorHtml}
    </div>
    <div class="pd3-sub">${escHtml(bits.join(' · '))}</div>
    ${tagsHtml}
    ${descHtml}
    ${frHtml}
    ${noPackHtml}`;
}

/* O'xshash shablonlar — bir kategoriya yoki bir turdagilar (joriysiz), maks 12.
   SC_31: baland panelda strip → ko'p qatorli grid; qatorlarni to'ldirish uchun
   ro'yxat kengaytirildi (nav bo'yicha zaxira + qolgan katalog) — strip'da faqat
   dastlabki bir nechtasi ko'rinadi, grid'da hammasi qatorlarga yotadi. */
function pd3SimilarList(name,asset){
  if(!asset||typeof assets==='undefined')return [];
  const others=assets.filter(x=>x&&x.n!==name);
  const cat=asset.cat,nav=asset.nav,t=asset.t;
  const sameCat=cat?others.filter(x=>x.cat===cat):[];
  const seen=new Set(sameCat.map(x=>x.n));
  const sameType=others.filter(x=>!seen.has(x.n)&&((nav&&x.nav===nav)||(t&&x.t===t)));
  sameType.forEach(x=>seen.add(x.n));
  // zaxira: grid qatorlarini to'ldirish uchun qolgan katalog (bir xil app'ni afzal ko'r)
  const rest=others.filter(x=>!seen.has(x.n));
  return sameCat.concat(sameType,rest).slice(0,12);
}
function renderPackSimilar(name,asset){
  const row=document.getElementById('pd3Similar');const head=document.getElementById('pd3SimHead');
  if(!row)return;
  const list=pd3SimilarList(name,asset);
  if(!list.length){ row.innerHTML=''; if(head)head.style.display='none'; return; }
  if(head)head.style.display='flex';
  row.innerHTML=list.map(x=>{
    const safe=String(x.n).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const pro=!!x.isPro;
    const bg=x.thumb?`background-image:url('${escHtml(x.thumb)}')`:`background:${pd3Grad(x.n)}`;
    return `<div class="pd3-simcard" onclick="openPack('${safe}')">
      <div class="pd3-simthumb" style="${bg}">
        <span class="pd3-simplan ${pro?'pro':'free'}">${pro?'PRO':'FREE'}</span>
      </div>
      <div class="pd3-simname">${escHtml(x.displayName||x.n)}</div>
    </div>`;
  }).join('');
}
function pd3ShowAllSimilar(){
  const asset=assets.find(x=>x.n===currentPackName);
  if(!asset){ closePack(); return; }
  if(asset.nav&&typeof currentNav!=='undefined'&&asset.nav!==currentNav&&typeof applyNavSwitch==='function'){
    applyNavSwitch(asset.nav);
  }
  if(typeof selectCategory==='function') selectCategory(null,asset.cat||'all');
  else closePack();
}
window.pd3ShowAllSimilar=pd3ShowAllSimilar;

/* SC_49: pd3 Favorite (pd3SyncFav / pd3ToggleFav) O'CHIRILDI — Projects yagona saqlash mexanizmi.
   Chaqiruvchilar saqlanib qolgan bo'lsa xatosiz no-op bo'lishi uchun stub qoldiramiz. */
function pd3SyncFav(){}
function pd3ToggleFav(){}
window.pd3ToggleFav=pd3ToggleFav;

/* "Hammasini import" — mavjud downloadAll (butun pack) */
function pd3ImportAll(){ if(currentPackName) downloadAll(currentPackName); }
window.pd3ImportAll=pd3ImportAll;

/* P1: katalog shabloni → loyihaga qo'shish (server shablon idsi kerak — lokal demo'da yo'q) */
function pd3AddToProject(){
  const pack=currentPackName?packs[currentPackName]:null;
  const tid=pack&&pack.serverTemplateId;
  if(!tid){ showToast('Only catalog templates can be added to a project','info'); return; }
  if(typeof window.afProjectPicker==='function')window.afProjectPicker('template',tid);
}
window.pd3AddToProject=pd3AddToProject;

/* Plan/usage qatori — real reja + bu oygi yuklamalar (account cache'dan) */
function pd3PlanText(){
  const u=(typeof homeCachedUser==='function')?homeCachedUser():null;
  if(!u) return 'Free plan — this month: 0 / 15 downloads';
  const pro=u.plan==='pro'||!!(u.limits&&u.limits.unlimitedDownloads);
  if(pro) return 'Pro plan — unlimited downloads';
  const used=u.downloadsMonth!=null?u.downloadsMonth:0;
  const lim=(u.limits&&u.limits.downloadLimit!=null)?u.limits.downloadLimit:15;
  return 'Free plan — this month: '+used+' / '+lim+' downloads';
}

/** MOGRT-pack elementlari → sahna kartalari (thumb.png/thumb.mp4 .mogrt ichidan) */
function mogrtScenesFromItems(pack,items){
  return items.map(it=>({
    n:it.name,
    aeComp:'',
    meta:'MOGRT',
    ico:pack.ico||'✦',
    bg:pack.bg,
    preview:it.thumbMp4||it.thumbPng||undefined,
    previewKind:(!it.thumbMp4&&it.thumbPng)?'image':undefined,
    mogrtPath:it.path
  }));
}

/** Server scene slug formati (API sceneKey bilan bir xil: dash, lowercase) */
function sceneSlugOf(name){
  return (String(name||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80))||'scene';
}

/** Sahna "import qilingan" holati uchun BARQAROR kalit: packKey + sahna slug'i.
 *  Faqat sahna nomi bilan kalitlamaymiz — ikki pack'da bir xil nom ("Scene 01")
 *  bo'lsa to'qnashmasligi uchun. packKey server itemlarda __srv_<id> (barqaror). */
function sceneStateKey(packKey,scene){
  if(!scene) return String(packKey||'');
  const slug=scene.slug||sceneSlugOf(scene.aeComp||scene.n||'');
  return String(packKey||'')+'::'+slug;
}

/** Keshdagi .mogrt elementlarni server sahnalariga slug bo'yicha biriktiradi.
    Server ro'yxati (nom, preview, tartib) SAQLANADI — keshdan faqat mogrtPath
    (va server preview bo'sh bo'lsa lokal thumb) keladi. Shu bois importedScenes
    Set (s.n bilan) barqaror ishlaydi: nomlar almashinmaydi.
    Server scenes bo'lmasa (eski format) — avvalgi xulq: to'liq ro'yxat keshdan. */
function mergeMogrtItems(pack,items){
  const fresh=mogrtScenesFromItems(pack,items);
  const existing=Array.isArray(pack.scenes)?pack.scenes:[];
  const hasServerScenes=existing.length&&existing.some(s=>s.slug);
  if(!hasServerScenes)return fresh;
  const bySlug={};
  fresh.forEach(f=>{bySlug[sceneSlugOf(f.n)]=f;});
  let matched=0;
  existing.forEach(s=>{
    const m=bySlug[s.slug||sceneSlugOf(s.aeComp||s.n)];
    if(m){
      s.mogrtPath=m.mogrtPath;
      if(!s.preview&&m.preview){s.preview=m.preview;s.previewKind=m.previewKind;}
      matched++;
    }
  });
  // Hech biri mos kelmasa (fayl nomlari boshqa manbadan) — kesh ro'yxati ishonchliroq
  return matched?existing:fresh;
}

/** Zip ichidan topilgan .mogrt'larni pack sahnalariga yozib, detalni yangilaydi */
function applyMogrtItems(packKey,items){
  const pack=packs[packKey];
  if(!pack||!items||!items.length)return;
  pack.scenes=mergeMogrtItems(pack,items);
  pack.mogrtScenesLoaded=true;
  if(currentPackName===packKey)openPack(packKey);
  // Bir nechta .mogrt — a4 tanlash bottom-sheet'i; bitta bo'lsa detal grid yetarli
  if(items.length>1) openMogrtSheet(packKey,items);
  else showToast('This pack has '+items.length+' MOGRT files — select a scene to import');
}

// P1 #16 — SLIM ro'yxat metaJson (sahnalar) bermaydi. Server pack ochilganda
// sahnalarni DETAL endpointdan (loadPackScenes) yuklaymiz — import va sahna ro'yxati
// to'g'ri bo'lishi uchun. Xato bo'lsa placeholder saqlanadi (import baribir ishlaydi).
async function ensurePackScenes(pack){
  if(!pack||!pack.server||!pack.serverTemplateId)return;
  if(pack.detailScenesLoaded||pack.mogrtScenesLoaded)return; // allaqachon real sahnalar bor
  if(typeof AssetFlowCatalog==='undefined'||!AssetFlowCatalog.loadPackScenes)return;
  try{
    const det=await AssetFlowCatalog.loadPackScenes(pack.serverTemplateId);
    if(det&&Array.isArray(det.scenes)&&det.scenes.length) pack.scenes=det.scenes;
    if(det&&det.aeScenesFolder) pack.aeScenesFolder=det.aeScenesFolder;
    pack.detailScenesLoaded=true;
  }catch(e){ try{console.warn('loadPackScenes',e);}catch(_){}}
}

async function openPack(name){
  const pack=packs[name];
  if(!pack){showToast('Pack not found');return;}
  // Sahnalarni detaldan yuklaymiz (mogrt overlay'idan OLDIN — detal sahnalar asos).
  await ensurePackScenes(pack);
  if(pack.server&&!packCanAeImport(pack)){
    showToast('No pack (.mogrt) — the contributor needs to upload the project file in Studio');
  }
  // MOGRT-pack keshi ochilgan bo'lsa — keshdagi mogrtPath'larni sahnalarga biriktirish (sync, yuklamaydi)
  if(IS_CEP&&pack.server&&pack.serverTemplateId&&!pack.mogrtScenesLoaded&&typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.cachedMogrtItems){
    try{
      const items=AssetFlowCatalog.cachedMogrtItems(pack.serverTemplateId);
      if(items.length){pack.scenes=mergeMogrtItems(pack,items);pack.mogrtScenesLoaded=true;}
    }catch(e){console.warn('mogrt cache',e);}
  }
  const asset=assets.find(x=>x.n===name);
  currentPackName=name;
  document.getElementById('packDetail').classList.add('open');
  renderPackHero(name,pack,asset);
  document.getElementById('pd3Meta').innerHTML=renderPackMeta(name,pack,asset);
  const planEl=document.getElementById('pd3PlanLine');if(planEl)planEl.textContent=pd3PlanText();
  renderPackSimilar(name,asset);
  pd3SyncFav();
  // SC_31: skroller endi .pd3-scroll (pd3Body emas) — ochilishda tepaga qaytar
  const sc=document.querySelector('#packDetail .pd3-scroll');if(sc)sc.scrollTop=0;
  updatePackFooter();
}

function closePack(){
  document.getElementById('packDetail').classList.remove('open');
  currentPackName='';
}

async function importSceneWithMode(pack,scene,packName,mode){
  if(!pack||!scene)return;
  if(__afOpBusy){ showToast('Please wait for the previous action to finish…','warning'); return; }
  if(typeof AssetFlowAccount!=='undefined'&&!AssetFlowAccount.isLoggedIn()){
    showLoginRequired(); return;
  }
  __afOpBusy=true;
  try{
    return await __importSceneWithModeImpl(pack,scene,packName,mode);
  }finally{
    __afOpBusy=false;
  }
}
async function __importSceneWithModeImpl(pack,scene,packName,mode){
  const compName=(scene.aeComp||scene.n||'').trim();
  if(!compName&&!packCanAeImport(pack)){
    showToast('Scene has no comp name');
    return;
  }
  const __t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  const __elapsed=()=>((((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-__t0)/1000);
  // Muvaffaqiyatda template'ni Downloaded'ga, sahnani importedScenes'ga belgilaymiz
  const markDownloaded=(data)=>{
    window.downloaded.add(packName);
    window.importedScenes.add(sceneStateKey(packName,scene));
    recordImportedMeta(packName,scene.n,data||null);
    persistUserPrefs();
  };

  if(IS_CEP&&packCanAeImport(pack)){
    try{
      const label=mode==='project'?'Adding to Project panel…':'Adding to Timeline…';
      showToast(label);
      const raw=await importSingleSceneToAE(pack,scene,packName,mode);
      hideProgress();
      if(raw==='limit') return;   // import limiti tugadi (toast ko'rsatildi, import qilinmadi)
      let data;
      try{ data=JSON.parse(raw); }catch{ data=null; }
      if(data?.ok){
        markDownloaded(data);
        // FAZA 4: sahna comp(lar)idagi yetishmagan shriftlarni hal qilamiz
        if(data.missingFonts&&data.missingFonts.length) resolveTemplateFonts(data.missingFonts);
        if(mode==='project'){
          const what=data.fullPack?('the full "'+(packName||scene.n)+'" pack'):('the "'+scene.n+'" scene (+ required footage)');
          showToast('✓ Imported '+what+' into the Project panel','success',__elapsed());
        }else if(data.addedToTimeline){
          showToast('✓ "'+scene.n+'" added to the timeline','success',__elapsed());
        }else if(data.timelineReason==='no_dest_comp'){
          showToast('Pack imported. To add to the Timeline, first open your own comp, then add the scene');
        }else{
          showToast('✓ Pack imported'+(data.timelineReason?': '+data.timelineReason:''));
        }
      }else if(data?.mogrtPicker){
        // MOGRT-pack aniqlandi — sahna ro'yxati yangilandi, foydalanuvchi tanlaydi
        return 'mogrt-picker';
      }else if(data&&(data.error==='cancelled'||data.error==='timeout')){
        // #97 (PL-e): kutish uzildi/tugadi — bu import XATOSI emas, holat xabari
        showToast(data.message||'Premiere Pro did not respond','warning');
      }else{
        const msg=data?.message||raw||'unknown';
        if(String(msg).indexOf('Comp not found')===0){
          showToast('Comp "'+compName+'" not found — it must match the name in Premiere');
        }else{
          showToast('Import error: '+msg);
        }
      }
    }catch(err){
      hideProgress();
      console.error(err);
      showToast('Import error: '+err.message);
    }
  }else if(!packCanAeImport(pack)){
    // Haqiqiy pack (.aep) yo'q — soxta "✓ qo'shildi" ko'rsatmaymiz (C.2)
    showToast('No pack (.mogrt) available for this template yet','error');
  }else{
    // CEP tashqarisida (brauzer preview/test) — demo ko'rinish uchun qoldirilgan
    markDownloaded();
    addLayer(scene.n,scene.ico,false);
    showMonitorPreview(getScenePreviewMedia(scene,pack));
    showToast('✓ "'+scene.n+'" added to the timeline','success',__elapsed());
  }

  render();renderDl();
  if(currentPackName){
    document.querySelectorAll('.scene-card').forEach((el,i)=>{
      const sc=packs[currentPackName].scenes[i];
      el.classList.toggle('imported',window.importedScenes.has(sceneStateKey(currentPackName,sc)));
    });
  }
}

async function downloadScene(name,ico,mode='timeline'){
  const pack=packs[currentPackName];
  const scene=pack?.scenes.find(s=>s.n===name)||pack?.scenes[selectedSceneIdx];
  if(!scene)return;
  const res=await importSceneWithMode(pack,scene,currentPackName,mode);
  if(mode==='timeline'&&res!=='mogrt-picker') closePack();
}


async function downloadAll(n){
  if(!packs[n])return;
  if(__afOpBusy){ showToast('Please wait for the previous action to finish…','warning'); return; }
  if(typeof AssetFlowAccount!=='undefined'&&!AssetFlowAccount.isLoggedIn()){
    showLoginRequired(); return;
  }
  __afOpBusy=true;
  try{
    return await __downloadAllImpl(n);
  }finally{
    __afOpBusy=false;
  }
}
async function __downloadAllImpl(n){
  const p=packs[n];
  if(!p)return;
  const __t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  const __elapsed=()=>((((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-__t0)/1000);
  // Template'ni Downloaded'ga, barcha sahnalarni importedScenes'ga
  const markPackDownloaded=()=>{
    window.downloaded.add(n);
    p.scenes.forEach(s=>window.importedScenes.add(sceneStateKey(n,s)));
    // Home "Continue" qatori uchun displayName + import vaqti muhri
    const m=window.downloadedMeta[n]||{folders:[],comps:[],displayName:''};
    if(p.displayName)m.displayName=p.displayName;
    m.at=Date.now();
    window.downloadedMeta[n]=m;
    persistUserPrefs();
  };

  if(IS_CEP&&packCanAeImport(p)){
    try{
      showToast('Importing into Premiere…');
      const result=await importPackFileToAE(p);
      if(result==='limit'){ render();renderDl(); return; }   // import limiti tugadi (toast ko'rsatildi)
      if(result==='mogrt:picker'){
        // MOGRT tanlash ro'yxati ochildi — detal ochiq qoladi
        return;
      }
      // Bo'sh natija — bekor qilingan yoki CEP emas: jim chiqamiz
      // (bekor qilish toast'i onAfCancel'da ko'rsatiladi).
      if(!result){ render();renderDl(); return; }
      // Host importTemplateProject JSON {ok,folder,movedCount} qaytaradi;
      // eski "ok:aep"/"ok:<name>" string kontrakti ham ehtiyot uchun qabul qilinadi.
      let ok=false,folder=null,folderId=0,missingFonts=null,failMsg='';
      if(typeof result==='string'){
        if(result.indexOf('ok:')===0) ok=true;
        else { try{ const d=JSON.parse(result); if(d&&d.ok){ ok=true; folder=d.folder||null; folderId=Number(d.folderId)||0; missingFonts=d.missingFonts||null; }
          else if(d){ failMsg=String(d.message||d.reason||''); if(d.error==='cancelled'||d.error==='timeout'){ showToast(failMsg||'Premiere Pro did not respond','warning'); render();renderDl(); return; } } }catch(e){} }
      }
      if(ok){
        markPackDownloaded();
        // #30 (PL-c): folderId bo'lsa nom saqlanmaydi (nom bo'yicha o'chirish xavfli)
        recordImportedMeta(n,null,(folderId||folder)?{folder,folderId}:null);
        showToast('✓ "'+(p.displayName||n)+'" imported into the Premiere project','success',__elapsed());
        // FAZA 4: yetishmagan shriftlarni fon rejimida hal qilamiz (import'ni bloklamaydi)
        if(missingFonts&&missingFonts.length) resolveTemplateFonts(missingFonts);
      }
      // Xom JSON foydalanuvchiga chiqmasin — faqat o'qiladigan xabar
      else showToast('Import error: '+(failMsg||'unknown'),'error');
    }catch(err){
      console.error(err);
      showToast('Import error: '+err.message);
    }
  }else if(!packCanAeImport(p)){
    // Haqiqiy pack (.aep) yo'q — soxta "✓ qo'shildi" ko'rsatmaymiz (C.2)
    showToast('No pack (.mogrt) available for this template yet','error');
  }else if(p.local&&p.fileBlobId&&typeof AssetFlowStore!=='undefined'){
    markPackDownloaded();
    const blob=await AssetFlowStore.getBlob(p.fileBlobId);
    if(blob){
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=p.fileName||`${n}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    showToast('✓ Pack downloaded');
  }else{
    // CEP tashqarisida (brauzer preview/test) — Premiere yo'q, shu sabab haqiqiy import
    // qilinmaydi; faqat demo ko'rinish uchun qoldirilgan (real foydalanuvchi doim CEP ichida).
    markPackDownloaded();
    p.scenes.forEach(s=>addLayer(s.n,s.ico));
    showToast('✓ All '+p.scenes.length+' scenes imported');
  }
  render();renderDl();closePack();
}

/** Yuklab olingan shablonni loyihadan (va keshdan) o'chiradi */
async function deleteDownloadedTemplate(key){
  const pack=packs[key];
  const meta=window.downloadedMeta[key]||{folders:[],comps:[],folderIds:[],compIds:[]};
  const name=(pack&&pack.displayName)||meta.displayName||key;
  if(!(await window.afConfirm('Remove "'+name+'" from your project?\nImported folders/comps in the Premiere Project panel and layers inside comps will also be removed.',{ok:"Remove",danger:true})))return;

  // 1) Premiere loyihasidan olib tashlash (CEP)
  if(IS_CEP&&csInterface){
    const folders=Array.isArray(meta.folders)?meta.folders:[];
    const comps=Array.isArray(meta.comps)?meta.comps:[];
    // #30 (PL-c): yangi importlarda ID bor — host aynan shu elementni o'chiradi.
    // Nom ro'yxatida faqat ID'siz eski yozuvlar qoladi.
    const folderIds=Array.isArray(meta.folderIds)?meta.folderIds:[];
    const compIds=Array.isArray(meta.compIds)?meta.compIds:[];
    if(folders.length||comps.length||folderIds.length||compIds.length){
      try{
        const cfg=JSON.stringify({folders,comps,folderIds,compIds});
        // #97 (PL-e): o'chirish ham host'da osilib qolishi mumkin — guard bilan
        const raw=await hostEvalGuarded('removeImportedTemplate('+JSON.stringify(cfg)+')',{label:'Removing from project',hardMs:60000});
        hideProgress();   // guard soft-timer overlay ochgan bo'lishi mumkin
        let data;try{data=JSON.parse(raw);}catch{data=null;}
        if(data&&data.ok) showToast('✓ Removed from project ('+(data.removed||0)+' items)');
        else showToast('Problem removing from project: '+((data&&data.message)||'unknown'));
      }catch(e){
        console.error('removeImportedTemplate',e);
        showToast('Error removing from Premiere: '+e.message);
      }
    }
    // 2) Keshlangan pack fayllarini tozalash — qisman muvaffaqiyatda ham aniq xabar
    if(pack&&pack.serverTemplateId){
      let cacheFails=0;
      try{
        const fs=__ffRequire('fs'),path=__ffRequire('path'),os=__ffRequire('os');
        const tid=pack.serverTemplateId;
        const base=(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.downloadDir&&AssetFlowCatalog.downloadDir())||os.tmpdir();
        // #29 (PL-b): bitta skan barcha kesh yozuvini qamrab oladi — `assetflow_<tid>`
        // fayllari, `_unzipped`, `assetflow_mogrt_<tid>_*` VA P9 nomli ekstraksiya
        // papkasi ("Nom (af-xxxxxx)"). Oxirgisi ilgari ro'yxatda YO'Q edi → papka
        // diskda abadiy qolardi, UI esa o'chirildi deb ko'rsatardi.
        const isMine=(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.isTemplateCacheEntryName)||null;
        if(!isMine) throw new Error('catalog module missing');
        fs.readdirSync(base).forEach(name=>{
          if(!isMine(name,tid))return;
          try{ fs.rmSync(path.join(base,name),{recursive:true,force:true}); }catch(e){ cacheFails++; }
        });
      }catch(e){ cacheFails++; }
      if(cacheFails>0) showToast('Some cache files could not be removed ('+cacheFails+') — please try again later','warning');
    }
  }else{
    showToast('"'+name+'" removed from the list');
  }

  // 3) Lokal holatni tozalash
  window.downloaded.delete(key);
  if(pack&&Array.isArray(pack.scenes)) pack.scenes.forEach(s=>window.importedScenes.delete(sceneStateKey(key,s)));
  delete window.downloadedMeta[key];
  persistUserPrefs();
  render();renderDl();
  if(document.documentElement.classList.contains('lib-mode'))renderLibDl();
}
window.deleteDownloadedTemplate=deleteDownloadedTemplate;

/** #23: yuklab olish keshini TO'LIQ tozalash — disk fayllar + downloaded ro'yxat,
 *  so'ng UI toza qayta chiziladi (qora karta/xato qolmasin). */
async function afClearDownloads(){
  const n=(window.downloaded&&window.downloaded.size)||0;
  const msg='Clear the download cache?'+(n?('\n'+n+' downloaded item(s) will be removed from the list.'):'')+'\nCached template files on disk will be deleted. Items already imported into Premiere projects are not affected.';
  if(!(await window.afConfirm(msg,{ok:'Clear',danger:true})))return;
  let cacheFails=0;
  if(IS_CEP){
    try{
      const fs=__ffRequire('fs'),path=__ffRequire('path'),os=__ffRequire('os');
      const base=(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.downloadDir&&AssetFlowCatalog.downloadDir())||os.tmpdir();
      // #29 (PL-b): faqat bizning kesh fayllar/papkalar. Ilgari shart `assetflow_`
      // prefiksi edi — P9 dan keyin ekstraksiya papkasi shablon NOMI bilan yasaladi
      // ("Nom (af-xxxxxx)") va bu filtrga tushmasdi: kesh hech qachon tozalanmasdi.
      const isMine=(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.isCacheEntryName)||null;
      if(!isMine) throw new Error('catalog module missing');
      fs.readdirSync(base).forEach(name=>{
        if(!isMine(name))return;
        try{ fs.rmSync(path.join(base,name),{recursive:true,force:true}); }catch(e){ cacheFails++; }
      });
    }catch(e){ cacheFails++; }
  }
  window.downloaded.clear();
  window.downloadedMeta={};
  if(window.importedScenes&&typeof window.importedScenes.clear==='function')window.importedScenes.clear();
  persistUserPrefs();
  render();renderDl();
  if(document.documentElement.classList.contains('lib-mode')){renderLibDl();afLibSyncCounts();}
  showToast(cacheFails?('Cache cleared — '+cacheFails+' file(s) could not be removed'):'Download cache cleared',cacheFails?'warning':'success');
}
window.afClearDownloads=afClearDownloads;

/** Eski format migratsiyasi: downloaded'da sahna nomlari bo'lsa → template kalitiga ko'chiramiz.
 *  Katalog yuklangandan keyin chaqiriladi (assets/packs tayyor bo'lishi kerak). */
function reconcileDownloadedFromScenes(){
  if(!Array.isArray(assets)||!assets.length)return;
  const validKeys=new Set(assets.map(a=>a.n));
  let changed=false;
  for(const entry of [...window.downloaded]){
    if(validKeys.has(entry))continue; // allaqachon template kaliti
    // Sahna nomi bo'lishi mumkin — qaysi pack'ga tegishliligini topamiz
    let matchedKey=null;
    for(const a of assets){
      const pk=packs[a.n];
      if(pk&&Array.isArray(pk.scenes)&&pk.scenes.some(s=>s.n===entry)){matchedKey=a.n;break;}
    }
    window.downloaded.delete(entry);
    if(matchedKey)window.downloaded.add(matchedKey);
    window.importedScenes.add(entry);
    changed=true;
  }
  if(changed){persistUserPrefs();renderDl();}
}

function getFeaturedAssets(){
  return assets
    .filter(a=>a.nav===currentNav && (a.local||a.server) && a.nw)
    // Import qilib bo'lmaydigan (pack .aep yo'q) shablonlarni "Yangi" stripda ko'rsatmaymiz
    .filter(a=>{const pk=packs[a.n];return !(pk&&pk.server&&pk.hasPack===false);})
    .slice(0, FEATURED.max);
}

function getGridAssets(){
  return sortAssetList(getFiltered());
}

function shouldShowFeatured(){
  if(featuredDismissedByNav[currentNav]||currentPage!=='assets')return false;
  if(currentSub!=='all'||currentSearch||currentOrient!=='all'||currentRes!=='all')return false;
  return getFeaturedAssets().length>0;
}

function renderNoticeItem(a){
  const safe=String(a.n).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
  const label=a.displayName||a.n;
  const thumb=a.thumb?`<img src="${escHtml(a.thumb)}" alt="${escHtml(label)}" loading="lazy">`:'';
  const nw=a.nw?'<span class="notice-item-new">NEW</span>':'';
  return`<div class="notice-item" onclick="openPack('${safe}')" title="${escHtml(label)}">
    <div class="notice-item-thumb" style="background:${escHtml(a.bg)}">${nw}${thumb}</div>
    <div class="notice-item-name">${escHtml(label)}</div>
  </div>`;
}

function dismissFeatured(e){
  e.stopPropagation();
  featuredDismissedByNav[currentNav]=true;
  render();
  showToast('Notification closed');
}

function playSpotlightPreview(el){
  const v=el.querySelector('.spotlight-vid');
  if(!v)return;
  v.currentTime=0;
  v.play().catch(()=>{});
}
function pauseSpotlightPreview(el){
  const v=el.querySelector('.spotlight-vid');
  if(!v)return;
  v.pause();
}

function renderHeroCard(a){
  const safe=String(a.n).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
  const label=a.displayName||a.n;
  const img=a.thumb?`<img class="cat-hero-img" src="${escHtml(a.thumb)}" alt="" loading="lazy">`:'';
  const cat=a.t?`<div class="cat-hero-cardcat">${escHtml(a.t)}</div>`:'';
  return`<div class="cat-hero-card" style="background:${escHtml(a.bg)}" onclick="openPack('${safe}')" title="${escHtml(label)}">
    ${img}
    ${a.nw?'<span class="cat-hero-new">NEW</span>':''}
    <span class="plan-badge ${a.isPro?'pro':'free'}">${a.isPro?'PRO':'FREE'}</span>
    <div class="cat-hero-cardgrad">${cat}<div class="cat-hero-cardtitle">${escHtml(label)}</div>${a.author?`<div class="card-author hero"><span class="card-av">${escHtml(a.authorInitials||'?')}</span><span class="card-by">${escHtml(a.author)}</span></div>`:''}</div>
  </div>`;
}

/* ============================================================
   Hero strip — AVTO-KARUSEL kontrolleri (faqat ko'rinish/animatsiya).
   renderFeatured ma'lumot mantig'i SAQLANADI. Avto ~4.5s, hover'da to'xtaydi,
   drag + strelka + nuqta; loop; silliq ease transition.
   ============================================================ */
let __heroCar=null;
function destroyHeroCarousel(){ if(__heroCar){ __heroCar.destroy(); __heroCar=null; } }
function initHeroCarousel(){
  destroyHeroCarousel();
  const track=document.getElementById('catCarouselTrack');
  const vp=document.getElementById('catCarouselVp');
  const dotsWrap=document.getElementById('catDots');
  const carousel=document.getElementById('catCarousel');
  if(!track||!vp)return;
  const cards=Array.prototype.slice.call(track.children);
  const n=cards.length;
  if(!n)return;

  let index=0,timer=null,paused=false,dragging=false,moved=false,suppressClick=false,startX=0,startTx=0,curTx=0;

  const stepPx=()=> (n>1 ? (cards[1].offsetLeft-cards[0].offsetLeft) : cards[0].offsetWidth);
  const overflow=()=> track.scrollWidth>vp.clientWidth+4;
  const wrapIdx=(i)=>{ if(i<0)return n-1; if(i>n-1)return 0; return i; };

  function apply(animate){
    track.style.transition=(animate===false)?'none':'transform .5s ease';
    track.style.transform='translateX('+curTx+'px)';
  }
  function renderDots(){
    if(!dotsWrap)return;
    dotsWrap.innerHTML=cards.map((_,i)=>'<div role="button" tabindex="0" type="button" class="cat-dot'+(i===index?' active':'')+'" data-i="'+i+'" aria-label="Hero '+(i+1)+'"></div>').join('');
  }
  function go(i,animate){
    index=wrapIdx(i);
    let tx=-(index*stepPx());
    const maxScroll=Math.max(0,track.scrollWidth-vp.clientWidth);
    if(tx<-maxScroll)tx=-maxScroll;
    curTx=tx; apply(animate); renderDots();
  }
  function next(){ go(index+1,true); }
  function prev(){ go(index-1,true); }

  function startTimer(){ stopTimer(); if(!overflow())return; timer=setInterval(()=>{ if(!paused&&!dragging)next(); },4500); }
  function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }

  function onDown(e){ if(!overflow())return; dragging=true;moved=false;paused=true; startX=(e.touches?e.touches[0].clientX:e.clientX); startTx=curTx; track.style.transition='none'; vp.classList.add('dragging'); }
  function onMove(e){ if(!dragging)return; const x=(e.touches?e.touches[0].clientX:e.clientX); const dx=x-startX; if(Math.abs(dx)>4)moved=true; curTx=startTx+dx; track.style.transform='translateX('+curTx+'px)'; }
  function onUp(){ if(!dragging)return; dragging=false; vp.classList.remove('dragging'); const s=stepPx()||1; go(Math.round(-curTx/s),true); if(moved){ suppressClick=true; setTimeout(()=>{suppressClick=false;},60); } paused=false; }
  function onClickCapture(e){ if(suppressClick){ e.stopPropagation(); e.preventDefault(); } }
  function onDots(e){ const d=e.target.closest('.cat-dot'); if(d){ go(parseInt(d.dataset.i,10)||0,true); } }
  const onEnter=()=>{paused=true;}, onLeave=()=>{paused=false;};

  vp.addEventListener('pointerdown',onDown);
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
  vp.addEventListener('click',onClickCapture,true);
  vp.addEventListener('mouseenter',onEnter);
  vp.addEventListener('mouseleave',onLeave);
  if(dotsWrap)dotsWrap.addEventListener('click',onDots);
  if(carousel)carousel.classList.toggle('no-scroll',!overflow());

  __heroCar={
    next,prev,go,
    destroy(){
      stopTimer();
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      vp.removeEventListener('pointerdown',onDown);
      vp.removeEventListener('click',onClickCapture,true);
      vp.removeEventListener('mouseenter',onEnter);
      vp.removeEventListener('mouseleave',onLeave);
      if(dotsWrap)dotsWrap.removeEventListener('click',onDots);
    }
  };
  go(0,false); startTimer();
}
function heroCarouselNext(){ if(__heroCar)__heroCar.next(); }
function heroCarouselPrev(){ if(__heroCar)__heroCar.prev(); }

/* Katalog yuklash holati: idle | loading | error | ready */
let catalogLoadState='idle';

function hasAnyAssets(){
  return Array.isArray(assets)&&assets.some(a=>a.local||a.server);
}
function filtersActive(){
  return !!(currentSearch||currentSub!=='all'||currentOrient!=='all'||currentRes!=='all');
}
/** Faol filtrlar soni (qidiruv + bo'lim + format + sifat) */
function activeFilterCount(){
  let n=0;
  if(currentSearch)n++;
  if(currentSub!=='all')n++;
  if(currentOrient!=='all')n++;
  if(currentRes!=='all')n++;
  return n;
}
/** Filtr bar'da «Tozalash (N)» tugmasini ko'rsatadi/yashiradi */
function updateFilterIndicator(){
  const pill=document.getElementById('clearFiltersPill');
  const n=activeFilterCount();
  // "Filtrlar" tugmasidagi faol-filtr soni rozetkasi (yig'iladigan panel uchun)
  const badge=document.getElementById('filterCountBadge');
  if(badge){ badge.textContent=String(n); badge.style.display=n>0?'inline-flex':'none'; }
  if(!pill)return;
  if(n>0){
    pill.style.display='';
    const c=document.getElementById('clearFiltersCount');
    if(c)c.textContent='('+n+')';
  }else{
    pill.style.display='none';
  }
}

// a7 holat ikonlari (inline SVG — a3–a6 uslubi; CDN yo'q)
var AF7_SPIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>';
var AF7_WIFI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3l20 20"/><path d="M5 12.6a11 11 0 0 1 4.3-2.6"/><path d="M1.4 8.8A16 16 0 0 1 7 5.6"/><path d="M8.5 16.1a6 6 0 0 1 6-1.2"/><path d="M16.7 10.5a11 11 0 0 1 2.9 2.1"/><path d="M22.6 8.8a16 16 0 0 0-5-3.1"/><path d="M12 20h.01"/></svg>';
var AF7_REFRESH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>';
var AF7_SEARCHMINUS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/><path d="M8 11h6"/></svg>';

/** So'nggi muvaffaqiyatli sinxron vaqti (HH:MM) yoki '' */
function af7LastSync(){
  const d=window.__afLastSyncAt;
  if(!(d instanceof Date)||isNaN(d.getTime()))return '';
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

/** Grid bo'sh bo'lganda holatga qarab tegishli xabar/skeleton/retry chiqaradi (a7 dizayn 1:1) */
function catalogEmptyStateHtml(){
  if(catalogLoadState==='loading'){
    const skelCard='<div class="af7-skel-card"></div>';
    const skelLine='<div class="af7-skel-line"></div>';
    return '<div class="af7-load">'+
        '<div class="af7-load-head">'+
          '<span class="af7-spin">'+AF7_SPIN+'</span>'+
          '<div class="af7-load-title">Loading catalog — server is waking up…</div>'+
          '<div class="af7-bar"><div class="af7-bar-fill"></div></div>'+
          '<div class="af7-hint">usually 10–20 seconds</div>'+
        '</div>'+
        '<div class="af7-skel">'+skelCard+skelCard+skelLine+skelLine+'</div>'+
      '</div>';
  }
  if(catalogLoadState==='error'){
    const last=af7LastSync();
    return '<div class="af7-state">'+
        '<div class="af7-circle err">'+AF7_WIFI+'</div>'+
        '<div class="af7-title">Server didn\'t respond</div>'+
        '<div class="af7-desc">Check your internet connection or try again shortly.</div>'+
        '<div role="button" tabindex="0" type="button" class="af7-btn" onclick="retryCatalog()">'+AF7_REFRESH+'Retry</div>'+
        (last?'<div class="af7-sync">Last synced: '+last+'</div>':'')+
      '</div>';
  }
  // Katalog tayyor, lekin filtr/qidiruv natija bermadi.
  // SC_37 — hasAnyAssets() sharti OLIB TASHLANDI: server-side filtrda 0 natija
  // assets ro'yxatini bo'shatadi — "No templates yet" (noto'g'ri retsept) chiqardi.
  if(catalogLoadState==='ready'&&filtersActive()){
    const q=(currentSearch||'').trim();
    // SC_37 — qidiruv doirasi: q joriy bo'lim (nav) ichida qidiriladi — copy shuni aytadi;
    // qidiruvda tugma FAQAT qidiruvni tozalaydi (filtrlar joyida qoladi).
    const navLabel=(typeof NAV_LABELS!=='undefined'&&NAV_LABELS[currentNav])||'this section';
    const sub=q
      ? 'No results for "'+escHtml(q)+'" in '+escHtml(navLabel)+'. Try a different phrase or clear the search.'
      : 'No results match your filters. Try loosening them.';
    return '<div class="af7-state">'+
        '<div class="af7-circle none">'+AF7_SEARCHMINUS+'</div>'+
        '<div class="af7-title">Nothing found</div>'+
        '<div class="af7-desc">'+sub+'</div>'+
        (q
          ? '<div role="button" tabindex="0" type="button" class="af7-btn" onclick="clearSearchOnly()">Clear search</div>'
          : '<div role="button" tabindex="0" type="button" class="af7-btn" onclick="clearAllFilters()">Clear filters</div>')+
      '</div>';
  }
  // Haqiqatan bo'sh (hech qanday shablon yo'q)
  return '<div class="af7-state">'+
      '<div class="af7-circle none">'+AF7_SEARCHMINUS+'</div>'+
      '<div class="af7-title">No templates yet</div>'+
      '<div class="af7-desc">Refresh the catalog or check back shortly.</div>'+
      '<div role="button" tabindex="0" type="button" class="af7-btn" onclick="retryCatalog()">'+AF7_REFRESH+'Refresh</div>'+
    '</div>';
}

/** Katalogni qayta yuklaydi — empty/error holatdagi tugma uchun */
async function retryCatalog(){
  if(typeof AssetFlowCatalog==='undefined')return;
  catalogLoadState='loading';
  render();
  try{
    // FIX A (P6) — reset:true MAJBURIY: cold-start muvaffaqiyatsizligidan keyin browseSig
    // eski qolib, reset'siz refreshBrowse guard (sig!==browseSig) tufayli darhol 0 qaytarib
    // hech narsa yuklamasdi (Retry "ishlagandek" ko'rinib, aslida bo'sh qolardi). Web loadBrowse(true) bilan tenglashtirildi.
    await AssetFlowCatalog.refreshBrowse(catalogFilters(),{reset:true});
    catalogLoadState='ready';
    window.__afLastSyncAt=new Date();
  }catch(e){
    catalogLoadState='error';
  }
  render();
  // SC_52/SC_50: katalog yuklangach Home rellslari + kategoriya kafellari qayta chizilsin (assets endi to'la)
  try{ if(document.documentElement.classList.contains('home-mode')){ if(typeof renderHomeRails==='function')renderHomeRails(); if(typeof renderHomeCategories==='function')renderHomeCategories(); if(typeof renderHomeExplore==='function')renderHomeExplore(); } }catch(e){}
}
window.retryCatalog=retryCatalog;

/** Barcha faol filtrlarni tozalaydi (bo'lim, qidiruv, format, sifat) */
function clearAllFilters(){
  currentSub='all';currentOrient='all';currentRes='all';currentSearch='';
  const si=document.getElementById('searchInput');if(si)si.value='';
  syncFilterDropMenu('orientMenu','all');
  syncFilterDropMenu('resMenu','all');
  updateOrientResPillLabels();
  buildCategoryMenu(currentNav);
  // SC_37 — filtrlar SERVER tomonda: tozalagach 1-sahifani filtrsiz qayta olamiz
  // (faqat render() eski filtrlangan sahifada "yopishib" qolardi).
  reloadServerBrowse();
}
window.clearAllFilters=clearAllFilters;

/** SC_37 — faqat qidiruvni tozalaydi (bo'lim/format/sifat filtrlari joyida qoladi) */
function clearSearchOnly(){
  currentSearch='';
  const si=document.getElementById('searchInput');if(si)si.value='';
  reloadServerBrowse();
}
window.clearSearchOnly=clearSearchOnly;

// ── P1 #18 — GRID VIRTUALIZATSIYASI ──
// 5000 karta DOM'ga chizilsa CEP (Chromium) Premiere'ni MUZLATADI. Endi faqat KO'RINADIGAN
// kartalar (+buffer) chiziladi; qolgan balandlik top/bottom spacer bilan saqlanadi.
// Kichik ro'yxatda (<= VIRT_THRESHOLD) hammasi chiziladi (xavfsiz oddiy yo'l).
// Thumbnail loading="lazy" (renderThumbMedia) va preview video FAQAT hover'da
// (playCardPreview) allaqachon bor — bu virtualizatsiya karta SONINI ham cheklaydi.
const VIRT_THRESHOLD=120;
const VIRT_BUFFER_ROWS=4;
let __gridList=[];
let __gridCardH=0, __gridCols=0, __gridWinKey='';

function measureGridMetrics(grid){
  const cards=grid.querySelectorAll('.card');
  if(!cards.length){ __gridCols=0; __gridCardH=0; return; }
  const top0=cards[0].offsetTop;
  let cols=0;
  for(const c of cards){ if(c.offsetTop===top0)cols++; else break; }
  __gridCols=Math.max(1,cols);
  let rowH=0;
  for(const c of cards){ if(c.offsetTop>top0){ rowH=c.offsetTop-top0; break; } }
  if(!rowH){ const r=cards[0].getBoundingClientRect(); rowH=(r.height||180)+16; }
  __gridCardH=rowH;
}

function renderGrid(){
  const grid=document.getElementById('grid');
  if(!grid) return;
  const list=__gridList;
  if(!list.length){ grid.innerHTML=catalogEmptyStateHtml(); __gridWinKey=''; return; }
  // Kichik ro'yxat — hammasini chizamiz (virtualizatsiya shart emas).
  if(list.length<=VIRT_THRESHOLD){
    grid.innerHTML=list.map((a,i)=>renderCard(a,i,false)).join('');
    initDrag(); __gridWinKey='all'; return;
  }
  try{
    // Metrikalar noma'lum — kichik probe chizib o'lchaymiz.
    if(!__gridCardH||!__gridCols){
      grid.innerHTML=list.slice(0,24).map((a,i)=>renderCard(a,i,false)).join('');
      measureGridMetrics(grid);
    }
    const sc=document.querySelector('.scroll-area');
    const viewH=sc?sc.clientHeight:0;
    // O'lchov muvaffaqiyatsiz (0 viewport / metrikasiz) — hammasini chizamiz (fallback).
    if(!__gridCardH||!__gridCols||viewH<=0){
      grid.innerHTML=list.map((a,i)=>renderCard(a,i,false)).join('');
      initDrag(); __gridWinKey='all'; return;
    }
    const rows=Math.ceil(list.length/__gridCols);
    const gridTopInSc=grid.getBoundingClientRect().top-sc.getBoundingClientRect().top+sc.scrollTop;
    const viewTop=Math.max(0,sc.scrollTop-gridTopInSc);
    let startRow=Math.max(0,Math.floor(viewTop/__gridCardH)-VIRT_BUFFER_ROWS);
    let endRow=Math.min(rows,Math.ceil((viewTop+viewH)/__gridCardH)+VIRT_BUFFER_ROWS);
    const key=startRow+':'+endRow+':'+list.length;
    if(key===__gridWinKey) return; // oyna o'zgarmadi
    __gridWinKey=key;
    const startIdx=startRow*__gridCols, endIdx=Math.min(list.length,endRow*__gridCols);
    const topH=Math.round(startRow*__gridCardH), botH=Math.round(Math.max(0,rows-endRow)*__gridCardH);
    let html='';
    if(topH>0) html+='<div class="grid-spacer" style="flex:0 0 100%;height:'+topH+'px"></div>';
    for(let i=startIdx;i<endIdx;i++) html+=renderCard(list[i],i,false);
    if(botH>0) html+='<div class="grid-spacer" style="flex:0 0 100%;height:'+botH+'px"></div>';
    grid.innerHTML=html;
    initDrag();
  }catch(e){
    try{ console.warn('grid virt fallback',e); }catch(_){}
    grid.innerHTML=list.map((a,i)=>renderCard(a,i,false)).join('');
    initDrag(); __gridWinKey='all';
  }
}

// Scroll paytida oynani yangilaydi (metrikalar cache'dan — probe qayta chizilmaydi).
function updateGridWindow(){
  if(!__gridList.length||__gridList.length<=VIRT_THRESHOLD||!__gridCardH||!__gridCols) return;
  renderGrid();
}

function render(){
  // E5: featured karusel olib tashlandi (funksiya saqlangan, lekin chaqirilmaydi — kompakt panel)
  if(__chipNav!==currentNav){buildCategoryChips();__chipNav=currentNav;}
  syncCategoryChips(currentSub);
  syncTopNav();
  applyDensityClass();
  updateConnStatus();
  __gridList=getGridAssets();
  // Ro'yxat/zichlik o'zgargan bo'lishi mumkin — metrikalarni qayta o'lchaymiz.
  __gridCardH=0; __gridCols=0; __gridWinKey='';
  renderGrid();
  // SC_37 — server sahifalaydi: yana sahifa bo'lsa hisob "N+" (web bilan bir xil semantika)
  let __cntTxt=String(__gridList.length);
  try{
    if(currentNav!=='ai'&&__gridList.length>0&&typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.browseHasMore&&AssetFlowCatalog.browseHasMore())__cntTxt+='+';
  }catch(e){}
  document.getElementById('assetCount').textContent=__cntTxt;
  updateGridLabel();
  updateFilterIndicator();
  if(typeof syncFilterSheet==='function')syncFilterSheet();
  // SC_35: navigatsiyadan keyin top-bar fit + pill strip'lar (chip qatori qayta qurilgan bo'lishi mumkin)
  try{ afFitTopbar(); afInitAllStrips();
    const c=document.getElementById('afCatChips'); if(c && !c.hasAttribute('hidden')){ afRefreshStrip(c); afScrollActiveStripIntoView(c); }
  }catch(e){}
}
// SC_49: renderFav() O'CHIRILDI — Favorites olib tashlandi (stub = no-op, chaqiruvchilar xatosiz).
function renderFav(){}
function renderDl(){
  const list=assets.filter(a=>window.downloaded.has(a.n));
  document.getElementById('dlGrid').innerHTML=list.map((a,i)=>renderCard(a,i,true)).join('');
  document.getElementById('dlEmpty').style.display=list.length?'none':'flex';
  document.getElementById('dlCount').textContent=window.downloaded.size;
  initDrag();
}

/* ===== Katalog a6 — "Kutubxonam" (Sevimli grid + Yuklab olingan qatorlar) =====
   Yangi a6 markup; ma'lumot (assets + favorites/downloaded) va handlerlar
   (toggleFav / openPack / deleteDownloadedTemplate / syncServerCatalog) o'zgarmaydi. */
function afLibEscKey(n){return String(n).replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
/* SC_49: AF_LIB_STAR (Favorites card star) o'chirildi */
var AF_LIB_IMP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
var AF_LIB_REIMP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/></svg>';
var AF_LIB_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>';

// SC_49: afLibFavCard (Favorites grid card) O'CHIRILDI — Favorites olib tashlandi.
function afLibDlMeta(a){
  const pack=packs[a.n];
  const bits=[];
  const hasPack=pack?((typeof packCanAeImport==='function')?packCanAeImport(pack):pack.hasPack!==false):(a.hasPack!==false);
  bits.push(hasPack?'Pack available':'No pack');
  let sc=0;
  if(pack&&Array.isArray(pack.scenes))sc=pack.scenes.length;
  else if(Array.isArray(a.scenes))sc=a.scenes.length;
  else if(a.sceneCount)sc=a.sceneCount;
  if(sc)bits.push(sc+(sc===1?' scene':' scenes'));
  const res=a.res?String(a.res).toUpperCase():'';
  const ratio=(typeof orientLabel==='function')?orientLabel(a.orient):'';
  if(res&&ratio)bits.push(res+'·'+ratio); else if(res)bits.push(res); else if(ratio)bits.push(ratio);
  return bits.join(' · ');
}
function afLibDlRow(a){
  const safe=afLibEscKey(a.n);
  // SC_14: Re-import tugmasi o'chirildi — QATOR bosilishi detail'ni ochadi (yagona oqim:
  // karta/qator → detail → Import). Orphan (katalogda yo'q) qator bosilmaydi.
  return `<div class="lib-row"${a._orphan?'':` onclick="openPack('${safe}')" title="Open template" style="cursor:pointer"`}>
    <div class="lib-rthumb" style="background:${escHtml(a.bg||'')}"><span class="lib-rck">✓</span></div>
    <div class="lib-rmid"><div class="lib-rname">${escHtml(a.displayName||a.n)}</div><div class="lib-rmeta">${escHtml(afLibDlMeta(a))}</div></div>
    <div role="button" tabindex="0" type="button" class="lib-rtrash" title="Remove from project" onclick="event.stopPropagation();deleteDownloadedTemplate('${safe}')">${AF_LIB_TRASH}</div>
  </div>`;
}
function afLibSyncCounts(){
  // SC_49: libFavCount O'CHIRILDI — faqat Downloaded soni.
  const d=(window.downloaded&&window.downloaded.size)||0;
  const de=document.getElementById('libDlCount'); if(de)de.textContent=d;
}
// SC_49: renderLibFav() O'CHIRILDI — Favorites olib tashlandi (stub = no-op).
function renderLibFav(){}
function renderLibDl(){
  const rows=document.getElementById('libDlRows'); if(!rows)return;
  const list=assets.filter(a=>window.downloaded.has(a.n));
  // #23: katalogda hozircha ko'rinmaydigan (offline/o'chirilgan) yuklab olinganlar ham ro'yxatda
  // qolsin — meta'dan nom bilan, Re-import'siz. Hech narsa "yo'qolib" qolmaydi.
  const known=new Set(list.map(a=>a.n));
  const orphans=[...window.downloaded].filter(k=>!known.has(k)).map(k=>{
    const m=(window.downloadedMeta&&window.downloadedMeta[k])||{};
    return {n:k,displayName:m.displayName||k,bg:'',_orphan:true};
  });
  rows.innerHTML=list.map(afLibDlRow).join('')+orphans.map(afLibDlRow).join('');
  const total=list.length+orphans.length;
  const emp=document.getElementById('libDlEmpty'); if(emp)emp.style.display=total?'none':'flex';
  afLibSyncCounts();
}
function afLibTab(tab){
  // SC_49: Favorites olib tashlandi — My Library endi faqat Downloaded ko'rsatadi.
  tab='downloaded';
  window.__libTab=tab;
  const sd=document.getElementById('libSegDl');
  if(sd){sd.classList.add('is-on');sd.setAttribute('aria-selected','true');}
  const vd=document.getElementById('libDlView');
  if(vd)vd.style.display='block';
  // Eski holat mashinasini saqlaymiz — dlCount + renderDl (yashirin) sinxron qoladi
  const ptab=document.querySelector('.ptab[data-page="downloaded"]');
  if(ptab&&typeof switchPage==='function')switchPage(ptab,'downloaded');
  renderLibDl();
}
window.afLibTab=afLibTab;
function afLibOpen(page){
  // SC_49: Favorites nav link o'chirildi — lib har doim Downloaded ochadi.
  const tab='downloaded';
  document.documentElement.classList.remove('home-mode','ai-mode');
  document.documentElement.classList.add('lib-mode');
  document.querySelectorAll('.env-side-link').forEach(b=>b.classList.remove('active'));
  const link=document.querySelector('.env-side-link[data-page="'+page+'"]');
  if(link)link.classList.add('active');
  afLibTab(tab);
  if(typeof afSetPaneCtx==='function')afSetPaneCtx(); // BATCH8 P3 — app-bar konteksti
  if(typeof syncPillarSeg==='function')syncPillarSeg(); // SC_12 — doimiy seg aktiv holati
}
window.afLibOpen=afLibOpen;
function afLibClose(){
  document.documentElement.classList.remove('lib-mode');
  const nav=(typeof currentNav!=='undefined'&&currentNav&&currentNav!=='ai')?currentNav:'video';
  const link=document.querySelector('.env-side-link[data-nav="'+nav+'"]');
  if(link&&typeof switchNavFromSidebar==='function')switchNavFromSidebar(link,nav);
  else{const at=document.querySelector('.ptab[data-page="assets"]');if(at)switchPage(at,'assets');}
}
window.afLibClose=afLibClose;

// SC_49: toggleFav() + syncFavoritesFromServer() O'CHIRILDI — Favorites olib tashlandi.
// Chaqiruvchilar (agar qolgan bo'lsa) xatosiz no-op bo'lishi uchun stub qoldiramiz.
function toggleFav(){}
function syncFavoritesFromServer(){}

const aeColors=['#6eb5ff','#46a046','#f7a028','#e84242','#9d72ff','#46cfcf','#e8428e','#c9a227'];
let layerIdx=2;

function addLayer(name,ico,updatePreview=true){
  // #143 (PX6): soxta Premiere timeline'i — faqat dev QA saxnasida (mijoz paketida yo'q).
  if(!document.getElementById('layerNames'))return;
  const c=aeColors[layerIdx%aeColors.length];
  const num=layerIdx+1;
  const w=Math.floor(Math.random()*30+25);
  const ml=Math.floor(Math.random()*20+5);

  const layerNames=document.getElementById('layerNames');
  const nameRow=document.createElement('div');
  nameRow.className='ae-layer';
  nameRow.innerHTML=`
    <span class="layer-num">${num}</span><span class="layer-sw">●</span><span class="layer-sw">○</span>
    <div class="layer-label"><span class="layer-color" style="background:${c}"></span><span class="layer-name">${ico} ${name}</span></div>`;
  layerNames.insertBefore(nameRow, layerNames.firstChild);

  const timeLayers=document.getElementById('layers');
  const timeRow=document.createElement('div');
  timeRow.className='time-layer';
  timeRow.innerHTML=`<div class="time-bar" style="left:${ml}%;width:${w}%;background:${c}55;border-color:${c}"></div>`;
  timeLayers.insertBefore(timeRow, timeLayers.firstChild);

  const bin=document.getElementById('binList');
  const bi=document.createElement('div');
  bi.className='proj-item added';
  bi.innerHTML=`<span class="proj-ico">▣</span>${name}`;
  bin.appendChild(bi);

  document.getElementById('aeTimecode').textContent='0:00:0'+Math.min(layerIdx,9)+':00';
  if(updatePreview){
    const asset=assets.find(x=>x.n===name);
    if(asset) showMonitorPreview(asset);
  }
  layerIdx++;
}

function downloadAsset(name){
  openPack(name);
}

function switchPage(el,p){
  // SC_49: 'favorites' sahifasi O'CHIRILDI — faqat assets/downloaded.
  document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  var ap=document.getElementById('assetsPage'); if(ap)ap.style.display=p==='assets'?'block':'none';
  var dp=document.getElementById('dlPage'); if(dp)dp.style.display=p==='downloaded'?'block':'none';
  if(p==='downloaded')renderDl();
}

// BATCH8 P3 — app-bar kontekst yorlig'i: faol pane holatidan (mavjud DOM klass + currentNav) hosil qilinadi.
// Faqat prezentatsiya — yangi routing yo'q; pane almashadigan mavjud chokepoint'lardan chaqiriladi.
var AF_PANE_CTX={video:'STOCK CATALOG · VIDEO',motion:'STOCK CATALOG · MOTION',graphics:'STOCK CATALOG · GRAPHICS',luts:'STOCK CATALOG · LUTS',music:'STOCK CATALOG · MUSIC',sfx:'STOCK CATALOG · SFX'};
function afSetPaneCtx(){
  var el=document.getElementById('afPaneCtx'); if(!el)return;
  var h=document.documentElement,t;
  if(h.classList.contains('home-mode'))t='HOME';
  else if(h.classList.contains('lib-mode'))t='MY LIBRARY';
  else if(h.classList.contains('ai-mode'))t='AI STUDIO';
  else{ var nav=(typeof currentNav!=='undefined'&&currentNav)?currentNav:(window.currentNav||'video'); t=AF_PANE_CTX[nav]||'STOCK CATALOG'; }
  el.textContent=t;
}
window.afSetPaneCtx=afSetPaneCtx;

function applyNavSwitch(tab,opts){
  // AI Tools — alohida sahifa (browse chrome yashiriladi, #aiPage ko'rsatiladi).
  // Mavjud video/motion/graphics/luts yo'llari pastda o'zgarishsiz qoladi.
  document.documentElement.classList.remove('home-mode'); // har nav Home'dan chiqadi
  document.documentElement.classList.remove('lib-mode'); // SC_12: doimiy seg'dan katalogga qaytishда lib ham yopiladi
  const isAi=tab==='ai';
  document.documentElement.classList.toggle('ai-mode',isAi);
  if(typeof syncPillarSeg==='function') syncPillarSeg(); // P9: header segment holatini ham yangilaymiz
  if(isAi){
    currentNav=tab;
    window.currentNav=tab;
    closePack();
    // V3: har AI kirishда launcher home (mavjud holatni reset qilmaydi — faqat ko'rinish)
    if(typeof axInit==='function')axInit(); // V5: yangi prototip UI (eski aiLauncherShow o'rniga)
    afSetPaneCtx();
    return;
  }
  currentNav=tab;
  window.currentNav=tab;
  afSetPaneCtx();
  currentSub='all';
  currentOrient='all';
  currentRes='all';
  currentSearch='';
  const si=document.getElementById('searchInput');
  if(si)si.value='';
  syncFilterDropMenu('orientMenu','all');
  syncFilterDropMenu('resMenu','all');
  updateOrientResPillLabels();
  buildCategoryMenu(tab);
  const hideFmt=tab==='luts'||tab==='graphics';
  closePack();
  // P1 #15 — nav almashsa server o'sha bo'lim (templateType) uchun 1-sahifani oladi.
  // Eski "server kontenti boshqa nav'da" toast'i OLIB TASHLANDI — u BUTUN katalog
  // sanog'iga tayanardi (endi nav server tomonda filtrlanadi, to'liq sanoq yo'q).
  // SC_38 — boot'da katalog ALLAQACHON aynan shu filtrlar bilan yuklangan (bootPlugin
  // refreshBrowse'i) → noReload bilan takroriy server so'rovsiz faqat render qilinadi.
  if(opts&&opts.noReload){ render(); return; }
  reloadServerBrowse();
}

function updateServerNavBadges(){
  if(typeof AssetFlowCatalog==='undefined')return;
  document.querySelectorAll('.env-side-link[data-nav]').forEach(btn=>{
    const nav=btn.dataset.nav;
    const n=AssetFlowCatalog.serverCountForNav(nav);
    let badge=btn.querySelector('.server-nav-badge');
    if(n>0){
      if(!badge){
        badge=document.createElement('span');
        badge.className='server-nav-badge';
        badge.style.cssText='margin-left:auto;font-size:var(--fs-xs);font-weight:700;color:#6ee7b7;background:rgba(110,231,183,.12);padding:2px 6px;border-radius:99px';
        btn.appendChild(badge);
      }
      badge.textContent=String(n);
      badge.style.display='';
    }else if(badge) badge.style.display='none';
  });
}

async function syncServerCatalog(){
  if(typeof AssetFlowCatalog==='undefined'){
    showToast('Catalog module not available');
    return;
  }
  try{
    const n=await AssetFlowCatalog.refreshBrowse(catalogFilters());
    window.__afLastSyncAt=new Date();
    reconcileDownloadedFromScenes();
    // Kutubxonam ochiq bo'lsa (a6) — yangilangan katalogdan sevimli/yuklab olingan qayta chiziladi
    if(document.documentElement.classList.contains('lib-mode')){renderLibDl();}
    const base=AssetFlowCatalog.apiBase();
  if(n>0){
      const where=AssetFlowCatalog.primaryServerNav();
      console.log('[sync] server templates:',n,'· API:',base); // P4: URL faqat konsolda
      showToast(n+' template'+(n>1?'s':'')+' synced','success');
      // Faqat foydalanuvchi hali katalog rejimida bo'lsa avto-o'tamiz — Sync await'i (cold-start)
      // davomida AI Tools/Home'ga o'tgan bo'lsa, uни tortib qaytarmaymiz.
      const _inCatalog=!document.documentElement.classList.contains('ai-mode')&&!document.documentElement.classList.contains('home-mode')&&!document.documentElement.classList.contains('lib-mode');
      if(_inCatalog&&AssetFlowCatalog.serverCountForNav(currentNav)===0&&where!==currentNav){
        switchNavFromSidebar(document.querySelector('.env-side-link[data-nav="'+where+'"]'),where);
      }
    }else{
      // P4: bo'sh katalog = NORMAL holat (hali shablon nashr etilmagan) — toast YO'Q, katalog o'zining
      // toza bo'sh holatini ko'rsatadi. Diagnostika faqat konsolda (URL/admin-jargon foydalanuvchiga emas).
      console.log('[sync] server catalog empty · API:',base);
    }
  }catch(e){
    // P4: xom xato/URL foydalanuvchiga chiqmaydi — qisqa do'stona xabar + konsolda texnik tafsilot.
    showToast('Couldn’t reach the server — retrying…','info');
    console.warn('syncServerCatalog',e);
  }
}

function switchNavFromSidebar(el,tab){
  document.querySelectorAll('.env-side-link').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  const scope=document.getElementById('envScope');
  if(scope) scope.value=tab;
  applyNavSwitch(tab);
  // Yig'iq holatda Katalog folder ikonasi aktiv ko'rinishi uchun
  const katHead=document.getElementById('sbKatHead');
  if(katHead) katHead.classList.toggle('cat-active', ['video','motion','graphics','luts'].indexOf(tab)>=0);
  // Tablar sidebar'ga ko'chgani uchun katalog navi "Shablonlar" (assets) sahifasini ko'rsatadi
  if(tab!=='ai'){
    const at=document.querySelector('.ptab[data-page="assets"]');
    if(at && typeof switchPage==='function') switchPage(at,'assets');
  }
}

/* ===== Asosiy (Home) — login'dan keyin birinchi ekran (faqat UI + navigatsiya) ===== */
function homeCachedUser(){
  try{ return (typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null; }catch(e){ return null; }
}
// Home = design 1b "Editorial stack": kredit + tavsiya etilgan hero + shablon grid.
// Real katalog (`assets`) bo'lsa undan, bo'lmasa dizayn demo to'plamidan (1:1 ko'rinish).
var HM_HL="radial-gradient(120% 100% at 18% 0%,rgba(255,255,255,.14),transparent 55%),";
function hmG(a,b,c){return HM_HL+"linear-gradient(138deg,"+a+","+b+" 62%,"+c+")";}
var HM_GRAD={blue:hmG('#1A2A4E','#33549E','#0C1220'),violet:hmG('#2A1E49','#6C3FA8','#130E24'),teal:hmG('#0F312C','#1F7A5F','#08150F'),crimson:hmG('#3A1B22','#A8434E','#150A0D'),amber:hmG('#3A2A12','#BE8428','#171006'),steel:hmG('#122032','#3E7BA6','#0A1118'),purple:hmG('#20153A','#8F4FD1','#0F0A1C'),cyan:hmG('#0F2436','#2E9DC0','#081019')};
var HM_GKEYS=Object.keys(HM_GRAD);
var HM_APPDOT={Ae:'#A79BFF',Pr:'#E585FF',Dr:'#FFB27C',Mn:'#5CC8B0',Motion:'#5CC8B0',Graphic:'#7CC4FF',LUT:'#FFB27C',Music:'#F0907F',SFX:'#E5C07B'}; // P8 — stock belgi ranglari ham shu jadvalda
// D10 — Home kartada ham plita + TO'LIQ dastur nomi (qisqartma tanish emas edi).
// Faqat dastur kodlari (Ae/Pr/Mn/Dr); stock turlari (LUT/Music/SFX…) eski nuqtada qoladi.
var HM_APPFULL={Ae:'Premiere Pro',Pr:'Premiere Pro',Mn:'Apple Motion',Dr:'DaVinci Resolve'};
// #RRGGBB → rgba(...). color-mix() ISHLATILMAYDI: CEP 11 (Chromium 88) uni bilmaydi va
// plita shaffof bo'lib qolardi — belgi esa aynan tanib olinishi uchun qo'yilgan.
function hmRgba(hex,a){
  var h=String(hex||'').replace('#',''); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n=parseInt(h,16); if(isNaN(n))return 'rgba(167,155,255,'+a+')';
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}
function hmAppTileStyle(col){
  return 'background:'+hmRgba(col,.18)+';border-color:'+hmRgba(col,.55)+';color:'+col;
}
function hmAppMark(lbl){
  var col=HM_APPDOT[lbl]||'#A79BFF', full=HM_APPFULL[lbl];
  if(!full)return '<i style="background:'+col+'"></i>'+hmEsc(lbl);
  return '<i class="tile" style="'+hmAppTileStyle(col)+'">'+hmEsc(lbl)+'</i>'+full;
}
var HM_NAVLBL=NAV_LABELS; // P2 — yagona xaritadan (avval alohida, nomuvofiq nusxa edi)
var HM_DEMO=[
  {n:'Glitch Logo Reveal',c:'Templates',a:'Aziza K.',app:'Ae',g:HM_GRAD.purple,plan:'PRO',x:'With AI',nav:'video'},
  {n:'Clean Lower Thirds',c:'Motion',a:'MotionLab',app:'Ae',g:HM_GRAD.blue,plan:'FREE',x:'',nav:'motion'},
  {n:'Paper Collage Promo',c:'Templates',a:'Studio Pixel',app:'Ae',g:HM_GRAD.amber,plan:'PRO',x:'',nopack:true,nav:'video'},
  {n:'Minimal Titles Vol.2',c:'Motion',a:'Diyor M.',app:'Ae',g:HM_GRAD.steel,plan:'FREE',x:'',dl:true,nav:'motion'},
  {n:'Kinetic Typo Pack',c:'Templates',a:'Diyor M.',app:'Ae',g:HM_GRAD.violet,plan:'PRO',x:'NEW',nav:'video'},
  {n:'Cinematic LUT Pack',c:'LUTs',a:'ColorKit',app:'Dr',g:HM_GRAD.teal,plan:'PRO',x:'',nav:'luts'}
];
function hmHash(s){var h=0,i;s=String(s||'');for(i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
function hmEsc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function hmFromAsset(a){
  var nav=a.nav||'video';
  var app=ffTypeBadge(a.templateApp,nav).lbl; // stock/ilova belgisi — P8
  var dl=!!(window.downloaded&&window.downloaded.has&&window.downloaded.has(a.n));
  return {
    n:a.displayName||a.n, c:a.catLabel||HM_NAVLBL[nav]||nav,
    a:(a.author&&(a.author.name||a.author))||'', app:app,
    g:HM_GRAD[HM_GKEYS[hmHash(a.n)%HM_GKEYS.length]], thumb:a.thumb||'',
    plan:a.isPro?'PRO':'FREE', x:'', dl:dl, nav:nav
  };
}
function hmList(){
  // P11 — bir xil shablon bir necha bor approve qilingan bo'lsa (nom+muallif) Recommended
  // gridida bir marta ko'rinsin — aks holda 4 katak bir xil kartadan iborat bo'lib qoladi.
  try{
    if(typeof assets!=='undefined'&&assets&&assets.length){
      var seen={}, out=[];
      for(var i=0;i<assets.length&&out.length<6;i++){
        var vm=hmFromAsset(assets[i]);
        var k=String(vm.n||'').trim().toLowerCase()+' '+String(vm.a||'').trim().toLowerCase();
        if(seen[k])continue; seen[k]=1; out.push(vm);
      }
      if(out.length)return out;
    }
  }catch(e){}
  return HM_DEMO;
}
function hmBg(vm){ return vm.thumb?("url('"+vm.thumb+"')"):vm.g; }
function hmXBadge(vm){
  var tx=vm.nopack?'⏳ Pack':vm.dl?'✓ Downloaded':(vm.x||''); if(!tx)return '';
  var col=vm.nopack?'var(--amber)':vm.dl?'var(--accent)':vm.x==='NEW'?'var(--accent)':vm.x==='With AI'?'var(--select)':'#E7ECF3';
  return '<span class="hm-x" style="color:'+col+'">'+tx+'</span>';
}
function hmPlanCls(p){return p==='PRO'?'pl-pro':'pl-free';}
/* Home = Variant A "Editorial Studio" (_home-redesign-mockup 02): greeting + 2 pillar +
   Continue (real oxirgi import + oxirgi gen) + Recommended (real katalog kartalari 1:1) + kredit nudge.
   Guest (04): taklif + real Sign in / Google device-code + katalog peek. */
function renderHome(){
  const u=homeCachedUser();
  const logged=(typeof AssetFlowAccount!=='undefined')&&AssetFlowAccount.isLoggedIn();
  const main=document.getElementById('homeMain'), guest=document.getElementById('homeGuest');
  if(main)main.style.display=logged?'':'none';
  if(guest)guest.style.display=logged?'none':'';
  if(typeof afHdrSyncAll==='function')afHdrSyncAll();
  if(!logged){ renderHomeGuest(); if(typeof afCmsApply==='function')afCmsApply(); return; }
  renderHomeGreeting(u);
  homeFetchLastGen();
  fhomeFetchModels();
  renderHomeHero();
  renderHomeRecent(); // SC_07 — "Jump back in" strip
  renderHomeSessions(); // SC_50 — "Continue a session"
  renderHomeExplore(); // SC_56 — "Explore" (kuratsiya AI-Stock)
  renderHomeCategories(); // SC_50 — "Browse by category"
  renderHomeRails(); // SC_52 — admin-kuratsiya New/Top rellslari (eski shelf o'rniga)
  // SC_04: login'dan keyin ham CMS matnlari qayta qo'llanadi (idempotent, arzon)
  if(typeof afCmsApply==='function')afCmsApply();
  if(typeof window.afCmsTick==='function')window.afCmsTick();
}
/* Vaqtga mos salomlashuv + hisobdagi real ism (yo'q bo'lsa ismsiz variant) */
function renderHomeGreeting(u){
  const el=document.getElementById('homeGreet'); if(!el)return;
  const h=new Date().getHours();
  const g=h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  let name=(u&&u.name)?String(u.name).trim().split(/\s+/)[0]:'';
  if(!name&&u&&u.email)name=String(u.email).split('@')[0];
  if(name)name=name.charAt(0).toUpperCase()+name.slice(1);
  // Dashboard B — ixcham inline salom ("Good afternoon, Alex")
  el.innerHTML=name ? hmEsc(g)+', <strong>'+hmEsc(name)+'</strong>' : hmEsc(g);
}
/* #H1 fhome hero: media = oxirgi gen thumbnaili (__homeGen, mavjud history yo'li), bo'lmasa
   statik CSS gradient. Chip = JONLI model katalogi featured modeli + narxi, AI karta badge =
   eng arzon rasm narxi (__fhomeModels) — narx hech qachon hardcode qilinmaydi. */
function renderHomeHero(){
  var art=document.getElementById('homeBArt'), chip=document.getElementById('homeBModel');
  var gen=(typeof __homeGen!=='undefined')?__homeGen.it:null;
  if(art){
    if(gen&&gen.thumb)art.style.backgroundImage='url("'+gen.thumb+'")';
    else art.style.backgroundImage='';
  }
  if(chip){
    if(__fhomeModels.featured&&__fhomeModels.featuredCost!=null){
      chip.textContent=String(__fhomeModels.featured).toUpperCase()+' · FROM ✦'+__fhomeModels.featuredCost;
      chip.style.display='';
    }else chip.style.display='none';
  }
  // SC_07: #fhomeAiBadge elementi kartalar bilan birga o'chirildi — jonli narx endi
  // faqat hero chipida (homeBModel, yuqorida) ko'rinadi; yozuv olib tashlandi.
  // SC_04: CMS hero media ustuvorligi gen-thumb holati o'zgarganda qayta baholanadi
  if(typeof window.afCmsHeroMedia==='function')window.afCmsHeroMedia();
}
/* SC_50: hero prompt-first — matnni AI Tools yangi rasm-sessiyasiga uzatadi (kredit YECHILMAYDI;
   foydalanuvchi Generate'ni o'zi bosadi). Mavjud yangi-sessiya (axIGSetSession(null)) + kompozer
   to'ldirish yo'llarini qayta ishlatadi. */
function afHomeHeroSubmit(){
  var inp=document.getElementById('homeHeroPrompt'); var txt=(inp&&inp.value||'').trim(); if(!txt)return;
  try{ document.documentElement.classList.remove('home-mode'); document.documentElement.classList.add('ai-mode'); }catch(e){}
  try{ if(typeof window.axIGSetSession==='function')window.axIGSetSession(null); }catch(e){} // yangi sessiya (kreditsiz)
  if(typeof window.axGo==='function')window.axGo('imggen');
  setTimeout(function(){
    var p=document.getElementById('igPrompt');
    if(p){ p.textContent=txt; try{ p.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} try{ p.focus(); }catch(e){} }
    if(inp)inp.value='';
  },70);
}
window.afHomeHeroSubmit=afHomeHeroSubmit;
/* SC_50: Continue a session — so'nggi sessiyalar (real axwsGetSessions). Bo'sh → bo'lim yashirin. */
function renderHomeSessions(){
  var sec=document.getElementById('fhomeSessSec'), row=document.getElementById('homeSessRow'); if(!row)return;
  var list=[]; try{ if(typeof window.axwsGetSessions==='function')list=window.axwsGetSessions()||[]; }catch(e){}
  list=list.slice(0,6);
  if(!list.length){ if(sec)sec.style.display='none'; row.innerHTML=''; return; }
  if(sec)sec.style.display='';
  var glyph={image:'▧',video:'▷',voice:'♪',sfx:'♪',audio:'♪'};
  row.innerHTML='';
  list.forEach(function(s){
    var nm=(typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(s):(s.title||'Session');
    var n=(typeof s.count==='number')?s.count:0;
    var ago=(s.lastAt&&typeof fmtAgo==='function')?(' · '+fmtAgo(s.lastAt)):'';
    var thumb=s.thumb||s.lastThumb||'';
    var mode=s.mode||'image';
    var c=document.createElement('div'); c.className='fhome-sesscard';
    c.innerHTML='<div class="sc-thumb"'+(thumb?(' style="background-image:url(\''+hmEsc(thumb)+'\')"'):'')+'>'+(thumb?'':'<span class="sc-glyph">'+(glyph[mode]||'▧')+'</span>')+'</div>'
      +'<div class="sc-meta"><div class="sc-nm">'+hmEsc(nm)+'</div><div class="sc-sub">'+n+' generation'+(n===1?'':'s')+hmEsc(ago)+'</div></div>';
    c.addEventListener('click',function(){
      try{ document.documentElement.classList.remove('home-mode'); document.documentElement.classList.add('ai-mode'); }catch(e){}
      // Sessiya picker'ining ochish yo'lini qayta ishlatamiz (mode+session)
      var setters={image:'axIGSetSession',video:'axVGSetSession',voice:'axAGSetSession',sfx:'axAGSetSession',audio:'axAGSetSession'};
      var dest={image:'imggen',video:'vidgen',voice:'audgen',sfx:'audgen',audio:'audgen'};
      try{ window.__axwsSess=window.__axwsSess||{}; window.__axwsSess[dest[mode]||'imggen']=s; }catch(e){}
      try{ var fn=window[setters[mode]||'axIGSetSession']; if(typeof fn==='function'){ if((mode==='voice'||mode==='sfx'||mode==='audio'))fn(s.mode||'voice',s.id); else fn(s.id); } }catch(e){}
      if(typeof window.axGo==='function')window.axGo(dest[mode]||'imggen');
    });
    row.appendChild(c);
  });
}
/* SC_56: EXPLORE — kuratsiya qilingan AI-Stock qatori. Stock katalog "AI Stock" bo'limi ishlatadigan
   endpoint (/api/plugin/catalog?templateType=ai-stock) qayta ishlatiladi — yangi route YO'Q. Manba
   bo'sh/xato → butun bo'lim yashirin (soxta karta yo'q). Bir marta yuklab keshlanadi (so'rov bo'roni yo'q). */
var __homeExplore={items:null,at:0,inflight:false};
function renderHomeExplore(){
  var sec=document.getElementById('fhomeExploreSec'), row=document.getElementById('homeExploreRow');
  if(!row)return;
  var items=__homeExplore.items;
  if(items&&items.length){ hmExploreCards(sec,row,items); return; }
  if(items&&!items.length){ if(sec)sec.style.display='none'; row.innerHTML=''; return; }
  // hali yuklanmagan → bo'lim yashirin, bir marta yuklab kelamiz
  if(sec)sec.style.display='none';
  if(__homeExplore.inflight||(__homeExplore.at&&(Date.now()-__homeExplore.at<270000)))return;
  __homeExplore.inflight=true;
  var url=afCmsBase()+'/api/plugin/catalog?templateType=ai-stock&take=12';
  fetch(url).then(function(r){ return r.ok?r.json():null; }).then(function(d){
    __homeExplore.inflight=false; __homeExplore.at=Date.now();
    __homeExplore.items=(d&&Array.isArray(d.items))?d.items:[];
    renderHomeExplore();
  }).catch(function(){ __homeExplore.inflight=false; __homeExplore.at=Date.now(); __homeExplore.items=[]; renderHomeExplore(); });
}
function hmExploreLbItem(u){
  var isVid=(u.nav==='video')||/video/i.test(String(u.cat||u.catLabel||''));
  return { id:u.id, url:u.previewUrl||u.thumbUrl||u.thumb||'', thumb:u.thumbUrl||u.thumb||'', cat:isVid?'video':'image', title:u.name||u.title||'Explore' };
}
function hmExploreCtx(){
  return { isCEP:(typeof IS_CEP!=='undefined'&&IS_CEP),
    list:function(){ return (__homeExplore.items||[]).map(hmExploreLbItem); },
    onDownload:function(it){ try{ var a=document.createElement('a'); a.href=it.url; a.download=(it.title||'explore'); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} } };
}
function hmExploreCards(sec,row,items){
  if(sec)sec.style.display='';
  row.innerHTML='';
  items.forEach(function(u){
    var it=hmExploreLbItem(u), thumb=it.thumb;
    var c=document.createElement('div'); c.className='fhome-sesscard fhome-explorecard';
    c.innerHTML='<div class="sc-thumb"'+(thumb?(' style="background-image:url(\''+hmEsc(thumb)+'\')"'):'')+'>'
      +(thumb?'':'<span class="sc-glyph">▧</span>')
      +(it.cat==='video'?'<span class="sc-glyph" style="font-size:16px">▶</span>':'')+'</div>';
    c.addEventListener('click',function(){ if(window.afRecent&&window.afRecent.openLightbox&&it.url)window.afRecent.openLightbox(it,hmExploreCtx()); });
    row.appendChild(c);
  });
}
/* SC_50: Browse by category — 6 katalog turi kafeli (real navigatsiya; son ko'rsatilmaydi agar ochiq bo'lmasa). */
var FHOME_CATS=[
  {nav:'video',label:'Video Templates',ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="3" y="15" width="18" height="6" rx="1.5"/></svg>'},
  {nav:'motion',label:'Motion Graphics',ic:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.5l1.4 4.1L17.5 8l-4.1 1.4L12 13.5l-1.4-4.1L6.5 8l4.1-1.4z"/></svg>'},
  {nav:'graphics',label:'Graphics',ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20l8-8a3 3 0 1 0-4.24-4.24l-8 8"/><circle cx="5" cy="19" r="2.25" fill="currentColor" stroke="none"/></svg>'},
  {nav:'luts',label:'LUTs',ic:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="5" width="4.5" height="14" rx="1.2" opacity=".32"/><rect x="9.75" y="5" width="4.5" height="14" rx="1.2" opacity=".58"/><rect x="15.5" y="5" width="4.5" height="14" rx="1.2"/></svg>'},
  {nav:'music',label:'Music',ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'},
  {nav:'sfx',label:'SFX',ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>'}
];
function renderHomeCategories(){
  var host=document.getElementById('homeCatTiles'); if(!host)return;
  // SC_56: real son FAQAT butun katalog per-nav to'liq yuklangan bo'lsa ko'rsatiladi. Katalog API
  // per-kategoriya facet/jami sonini bermaydi va browse SAHIFALANGAN (getCountByNav = faqat yuklangan
  // sahifadagi itemlar) — shu sabab jami sonni to'qib chiqarmaymiz; ko'rsatilmaydi (spec: "omit").
  // Ishonchli jami paydo bo'lsa (masalan kelajakda facet endpoint) shu yerdan ulanadi.
  var counts=null;
  host.innerHTML='';
  // SC_60 — admin CMS tayl override'lari: label (bo'sh=built-in) + ixtiyoriy fon media
  var tiles=window.__afCmsCatTiles||null;
  FHOME_CATS.forEach(function(c,idx){
    var ov=(tiles&&tiles[idx])||{};
    var label=ov.label||c.label;
    var n=(counts&&typeof counts[c.nav]==='number')?counts[c.nav]:null;
    var el=document.createElement('button'); el.type='button'; el.className='fhome-cattile';
    el.innerHTML='<span class="ct-ic">'+c.ic+'</span><span class="ct-tx"><span class="ct-nm">'+hmEsc(label)+'</span>'+((n!=null)?('<span class="ct-ct">'+n+' item'+(n===1?'':'s')+'</span>'):'')+'</span>';
    if(ov.mediaUrl){
      el.classList.add('has-media');
      var med;
      if(ov.mediaType==='video'){
        med=document.createElement('video');
        med.muted=true; med.loop=true; med.autoplay=true; med.playsInline=true;
        med.setAttribute('muted',''); med.setAttribute('playsinline','');
        med.src=ov.mediaUrl;
      }else{
        med=document.createElement('img');
        med.src=ov.mediaUrl; med.alt=''; med.loading='lazy';
      }
      med.className='ct-media';
      med.addEventListener('error',function(){
        try{ med.remove(); var sc=el.querySelector('.ct-scrim'); if(sc)sc.remove(); el.classList.remove('has-media'); }catch(e){}
      });
      var scrim=document.createElement('span'); scrim.className='ct-scrim';
      el.insertBefore(scrim,el.firstChild);
      el.insertBefore(med,el.firstChild);
    }
    el.addEventListener('click',function(){ try{ homeGo(c.nav); }catch(e){} });
    host.appendChild(el);
  });
}
/* SC_52: admin-kuratsiya New/Top rellslari — content-config home.rails'dan ID'lar, katalogdan hal qilinadi.
   Bo'sh/hal bo'lmaydigan ro'yxat → rells yashirin. Bitta sanksiyalangan uzluksiz animatsiya (marquee):
   faqat transform, hover/hidden-panel/off-screen'da PAUZA, reduced-motion → statik. */
function fhomeResolveIds(ids){
  if(!ids||!ids.length)return [];
  var out=[]; var byId={};
  try{ if(typeof assets!=='undefined'&&assets)assets.forEach(function(a){ var sid=(a.serverTemplateId!=null)?String(a.serverTemplateId):(String(a.n||'').indexOf('__srv_')===0?String(a.n).slice(6):''); if(sid)byId[sid]=a; }); }catch(e){}
  ids.forEach(function(id){ var a=byId[String(id)]; if(a)out.push(a); }); // mavjud/published bo'lmaganlar jimgina o'tkazib yuboriladi
  return out;
}
function fhomeRailCardHTML(a){
  var pro=!!a.isPro;
  var bg=a.thumb?("url('"+a.thumb+"')"):HM_GRAD[HM_GKEYS[hmHash(a.n)%HM_GKEYS.length]];
  var res=a.res?String(a.res).toUpperCase():'';
  return '<div role="button" tabindex="0" class="fhome-tcard fhome-railcard" type="button" data-key="'+hmEsc(a.n)+'" data-nav="'+hmEsc(a.nav||'video')+'">'
    +'<span class="fhome-tmedia" style="background-image:'+bg+'">'
    +'<span class="fhome-tbadge'+(pro?' pro':'')+'">'+(pro?'PRO':'FREE')+'</span>'
    +(res?'<span class="fhome-tres">'+hmEsc(res)+'</span>':'')
    +'</span><h3>'+hmEsc(a.displayName||a.n)+'</h3></div>';
}
var __fhomeRailObs=null;
function renderHomeRails(){
  var c=(__afCms&&__afCms.cfg)||null;
  var rails=(c&&c.home&&c.home.rails)||{newReleases:{title:'New releases',templateIds:[]},topTemplates:{title:'Top templates',templateIds:[]}};
  buildOneRail('fhomeNewRail','homeNewTrack','fhomeNewHd',rails.newReleases,'left');
  buildOneRail('fhomeTopRail','homeTopTrack','fhomeTopHd',rails.topTemplates,'right');
}
function buildOneRail(secId,trackId,hdId,rail,dir){
  var sec=document.getElementById(secId), track=document.getElementById(trackId), hd=document.getElementById(hdId);
  if(!sec||!track)return;
  var items=fhomeResolveIds(rail&&rail.templateIds);
  if(!items.length){ sec.style.display='none'; track.innerHTML=''; return; } // ro'yxat bo'sh/hал bo'lmaydi → rells yashirin
  sec.style.display='';
  if(hd&&rail&&rail.title)hd.textContent=rail.title;
  var reduce=false; try{ reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var many=items.length>=4; // kenglikni to'ldirmasa — statik qator (loop yo'q)
  var html=items.map(fhomeRailCardHTML).join('');
  // seamless loop uchun to'plamni takrorlaymiz (faqat animatsiya bo'lsa)
  track.innerHTML=(many&&!reduce)?(html+html):html;
  track.classList.toggle('anim',many&&!reduce);
  track.setAttribute('data-dir',dir);
  // karta bosilishi → detail (mavjud yo'l)
  Array.prototype.forEach.call(track.querySelectorAll('.fhome-railcard'),function(el){
    el.addEventListener('click',function(){ var key=el.getAttribute('data-key'); homeGo(el.getAttribute('data-nav')||'video'); try{ if(key&&typeof packs!=='undefined'&&packs&&packs[key]&&typeof openPack==='function')openPack(key); }catch(e){} });
  });
  // MOTION intizomi: off-screen → pauza (IntersectionObserver)
  try{
    if(!__fhomeRailObs&&typeof IntersectionObserver!=='undefined'){
      __fhomeRailObs=new IntersectionObserver(function(ents){ ents.forEach(function(en){ en.target.classList.toggle('paused-off',!en.isIntersecting); }); },{threshold:0.01});
    }
    if(__fhomeRailObs){ __fhomeRailObs.observe(track); }
  }catch(e){}
}
// SC_52: panel/hujjat yashiringanda BARCHA rellslar pauza (visibilitychange) — GPU/Premiere tejaydi
document.addEventListener('visibilitychange',function(){
  var hidden=document.hidden; document.querySelectorAll('.fhome-rail-track').forEach(function(t){ t.classList.toggle('paused-hidden',hidden); });
});
/* #H1 — jonli rasm-model katalogi (mavjud /api/studio/gen/models?mode=image endpointi, yangi API emas).
   Featured = isDefault (bo'lmasa 1-chi); narx qoidasi image tool'dagi igModelPrice bilan bir xil
   (quality default darajasi → bo'lmasa flat cost). 5 daqiqa throttle — model katalogi kam o'zgaradi. */
var __fhomeModels={featured:null,featuredCost:null,minCost:null,at:0,inflight:false};
function fhomeModelPrice(m){
  var s=m.imgSettings||null, ql=s&&s.quality;
  var qc=(ql&&ql.cost)||m.qualityCost||null;
  if(qc){ var d=(ql&&ql.def)||((qc.high!=null)?'high':Object.keys(qc)[0]); var v=qc[d]; if(typeof v==='number')return v; }
  return (typeof m.cost==='number')?m.cost:null;
}
function fhomeFetchModels(){
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn())return;
  if(typeof studioGet!=='function')return;
  if(__fhomeModels.inflight||(Date.now()-__fhomeModels.at<300000))return;
  __fhomeModels.inflight=true;
  // SC_05: bitta throttle oynasida 4 mode (image/video/voice/sfx) parallel — narx keshi
  // (hero chip) + JONLI display nomlari (launcher kartalari) bir joyda. Alohida so'rov
  // sikli YO'Q — shu mavjud fetch kengaytirildi.
  var clean=function(s){ return String(s==null?'':s).replace(/[<>&"]/g,''); };
  var getMode=function(mode){
    return studioGet('/api/studio/gen/models?mode='+mode).then(function(r){
      return ((r&&r.models)||[]).filter(function(x){ return x&&x.id!=null&&x.mode===mode&&x.enabled!==false; });
    }).catch(function(){ return []; });
  };
  Promise.all([getMode('image'),getMode('video'),getMode('voice'),getMode('sfx')]).then(function(res){
    __fhomeModels.inflight=false; __fhomeModels.at=Date.now();
    var img=res[0], vid=res[1], voice=res[2], sfx=res[3];
    // Narx keshi (hero chip) — avvalgi mantiq aynan
    if(img.length){
      var def=img.filter(function(x){ return x.isDefault; })[0]||img[0];
      var min=null;
      img.forEach(function(m){ var p=fhomeModelPrice(m); if(typeof p==='number'&&(min==null||p<min))min=p; });
      __fhomeModels.featured=def.label||String(def.id);
      __fhomeModels.featuredCost=fhomeModelPrice(def);
      __fhomeModels.minCost=min;
    }
    // SC_05: launcher karta qatorlari — top 2 yoqilgan model nomi " · " bilan;
    // audio: bitta voice + bitta SFX (ajratib bo'lsa), aks holda birinchi ikkitasi.
    var top2=function(list){ return list.slice(0,2).map(function(m){ return clean(m.label||m.id); }).filter(Boolean).join(' · '); };
    var names={};
    if(img.length)names.image=top2(img);
    if(vid.length)names.video=top2(vid);
    var aud=[];
    if(voice.length)aud.push(clean(voice[0].label||voice[0].id));
    if(sfx.length)aud.push(clean(sfx[0].label||sfx[0].id));
    if(!aud.length)aud=voice.concat(sfx).slice(0,2).map(function(m){ return clean(m.label||m.id); });
    if(aud.length)names.audio=aud.filter(Boolean).join(' · ');
    if(names.image||names.video||names.audio){
      window.__afLiveModelNames=names;
      if(typeof window.__afAiRenderCatGrid==='function')window.__afAiRenderCatGrid();
    }
    if(document.documentElement.classList.contains('home-mode'))renderHomeHero();
  }).catch(function(){ __fhomeModels.inflight=false; __fhomeModels.at=Date.now(); });
}
/* ══ SC_04: Plugin CMS — admin-tahrir kontent (matnlar + fon media) ══
   Manba: GET {API}/api/plugin/content-config (auth YO'Q, 60s server kesh).
   Oqim: boot'da localStorage keshi SINXRON qo'llanadi (offline birinchi bo'yash
   oxirgi ko'ringan holat bilan bir xil) → fon fetch (5 daq throttle) → yangi
   config kelsa qayta qo'llanadi. Xato/endpoint yo'q → joriy matnlar qoladi.
   Matnlar FAQAT textContent orqali (XSS gigienasi); bo'sh maydon = built-in. */
var __afCms={cfg:null,at:0,inflight:false};
/* Admin muharriri preview'i — FFCMS ko'prigi shu bayroqni yoqadi (?ffcms=1).
   Premiere ichida hech qachon yonmaydi, shu sabab plagin xatti-harakati o'zgarmaydi. */
var __afCmsDraftMode=false;
try{ __afCmsDraftMode=/[?&]ffcms/.test(location.search); }catch(e){}
var AF_CMS_LS='af.cms.config';
function afCmsBase(){
  try{ if(typeof AssetFlowAccount!=='undefined')return AssetFlowAccount.apiBase(); }catch(e){}
  return (typeof ASSETFLOW_ENV!=='undefined')?ASSETFLOW_ENV.defaultApi():'https://api.getframeflow.app';
}
function afCmsSetText(sel,v){
  if(v==null||String(v)==='')return;
  var el=document.querySelector(sel); if(el)el.textContent=v;
}
/* \n → satr uzilishi: text node + <br> (innerHTML EMAS) */
function afCmsSetLines(sel,v){
  if(v==null||String(v)==='')return;
  var el=document.querySelector(sel); if(!el)return;
  el.textContent='';
  String(v).split('\n').forEach(function(line,i){
    if(i)el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
}
function afCmsApply(){
  var c=__afCms.cfg; if(!c)return;
  try{
    var h=(c.home&&c.home.hero)||{};
    afCmsSetText('.fhome-kick',h.kicker);
    afCmsSetText('.fhome-hero-copy h1',h.title);
    afCmsSetText('.fhome-sub',h.sub);
    afCmsSetText('.fhome-btn-ai',h.ctaPrimary);
    afCmsSetText('.fhome-btn-stock',h.ctaSecondary);
    // SC_60: hero prompt placeholder (bo'sh = built-in qoladi)
    if(h.promptPlaceholder){
      var hp=document.getElementById('homeHeroPrompt');
      if(hp)hp.setAttribute('placeholder',h.promptPlaceholder);
    }
    var s=(c.home&&c.home.sections)||{};
    afCmsSetText('#fhomeRecentSec .fhome-sechd h2',s.recent);
    afCmsSetText('#fhomeShelfSec .fhome-sechd h2',s.shelf);
    afCmsSetText('.fhome-browse',s.browseAll);
    // SC_56: yangi Home bo'lim sarlavhalari (bo'sh → afCmsSetText tegmaydi, plagin default matni qoladi)
    afCmsSetText('#fhomeSessHd',s.continueSessions);
    afCmsSetText('#fhomeExploreHd',s.explore);
    afCmsSetText('#fhomeCatHd',s.categories);
    // Guest ekran (title/sub \n qo'llab-quvvatlaydi; features[3])
    var g=c.guest||{};
    afCmsSetLines('#homeGuest .gu-h1',g.title);
    afCmsSetLines('#homeGuest .gu-sub',g.sub);
    var feats=g.features||[];
    var nodes=document.querySelectorAll('#homeGuest .gu-feats .gu-f .tx');
    feats.forEach(function(f,i){
      var n=nodes[i]; if(!n||!f)return;
      if(f.title){ var b=n.querySelector('b'); if(b)b.textContent=f.title; }
      if(f.sub){ var sm=n.querySelector('small'); if(sm)sm.textContent=f.sub; }
    });
    // AI launcher sarlavhasi — birinchi ✦ span saqlanadi, matn qismi almashadi
    if(c.aiLauncher&&c.aiLauncher.title){
      var lt=document.querySelector('.ai-launch-t');
      if(lt){
        while(lt.childNodes.length>1)lt.removeChild(lt.lastChild);
        lt.appendChild(document.createTextNode(' '+c.aiLauncher.title));
      }
    }
    // SC_60: guest ekran qo'shimcha matnlari
    afCmsSetText('#homeGuest .sec .kick',g.peekKicker);
    afCmsSetText('#homeGuest .gu-mk',g.registerNote);
    // AI launcher kartalari (title/desc/media override) — render AI IIFE ichida o'qiydi
    window.__afCmsAiCards=(c.aiLauncher&&c.aiLauncher.cards)||null;
    if(typeof window.__afAiRenderCatGrid==='function')window.__afAiRenderCatGrid();
    // SC_60: kategoriya tayllari (label + media) — renderHomeCategories o'qiydi
    window.__afCmsCatTiles=(c.home&&c.home.categoryTiles)||null;
    if(typeof renderHomeCategories==='function')try{renderHomeCategories();}catch(_e){}
    // Hero fon media (mediaMode ustuvorligi renderHomeHero/afCmsHeroMedia'da)
    afCmsHeroMedia();
    // SC_61: e'lon paneli
    afCmsAnnounce(c.announcement||null);
    // CMS v3 — nishonlash + uslub qatlami + bildirishnomalar
    afCmsStamp();
    afCmsApplyUi(c.uiStyles);
    afCmsNotices(c.notices);
  }catch(e){ try{console.warn('[cms] apply:',e);}catch(_){} }
}
/* ══ SC_61: admin e'lon paneli — server content-config announcement ══
   Yopish localStorage'da (id bo'yicha; id bo'sh = matn hash o'rnida). CTA faqat
   ichki ekranlar (allow-list) — mavjud seg tugmalari bosiladi, URL ochilmaydi. */
function afAnnKey(a){ return 'af_announce_dismissed'; }
function afAnnId(a){ return (a&&a.id)||('t:'+String((a&&a.text)||'').slice(0,80)); }
function afCmsAnnounce(a){
  var bar=document.getElementById('afAnnounce'); if(!bar)return;
  var show=!!(a&&a.enabled&&a.text);
  if(show){
    try{ if(localStorage.getItem(afAnnKey(a))===afAnnId(a))show=false; }catch(e){}
  }
  if(!show){ bar.classList.remove('on'); return; }
  bar.classList.remove('tone-promo','tone-warn');
  if(a.tone==='promo')bar.classList.add('tone-promo');
  else if(a.tone==='warn')bar.classList.add('tone-warn');
  var t=document.getElementById('afAnnounceText'); if(t)t.textContent=a.text;
  var cta=document.getElementById('afAnnounceCta');
  var ACT={aistudio:'afSegAi',catalog:'afSegKatalog',home:'afSegHome',account:'afSegHome'};
  if(cta){
    if(a.ctaLabel&&a.ctaAction&&ACT[a.ctaAction]){
      cta.hidden=false; cta.textContent=a.ctaLabel;
      cta.onclick=function(){ try{ var b=document.getElementById(ACT[a.ctaAction]); if(b)b.click(); }catch(e){} };
    }else{ cta.hidden=true; cta.onclick=null; }
  }
  var x=document.getElementById('afAnnounceX');
  if(x){
    x.style.display=(a.dismissable===false)?'none':'';
    x.onclick=function(){
      try{ localStorage.setItem(afAnnKey(a),afAnnId(a)); }catch(e){}
      bar.classList.remove('on');
    };
  }
  bar.classList.add('on');
}
/* Hero fon media: media-first → doim admin media; auto → faqat oxirgi gen thumb yo'q bo'lsa.
   Video xato/kodek muammosi → element o'chadi, mavjud gradient/thumb yo'li ko'rinadi. */
function afCmsHeroMedia(){
  var art=document.getElementById('homeBArt'); if(!art)return;
  var c=__afCms.cfg; var h=c&&c.home&&c.home.hero;
  var old=art.querySelector('.af-cms-media');
  var gen=(typeof __homeGen!=='undefined')?__homeGen.it:null;
  var want=h&&h.mediaUrl&&(h.mediaMode==='media-first'||!(gen&&gen.thumb));
  if(!want){ if(old)old.remove(); return; }
  if(old&&old.getAttribute('data-src')===h.mediaUrl)return;
  if(old)old.remove();
  var el;
  if(h.mediaType==='video'){
    el=document.createElement('video');
    el.muted=true; el.loop=true; el.autoplay=true; el.playsInline=true;
    el.setAttribute('muted',''); el.setAttribute('playsinline','');
    el.src=h.mediaUrl;
  }else{
    el=document.createElement('img');
    el.src=h.mediaUrl; el.alt='';
  }
  el.className='af-cms-media'; el.setAttribute('data-src',h.mediaUrl);
  el.addEventListener('error',function(){ try{el.remove();}catch(e){} });
  art.appendChild(el);
}
window.afCmsHeroMedia=afCmsHeroMedia;
function afCmsFetch(){
  // Admin vizual muharriri (?ffcms=1): konfiguratsiya DRAFT sifatida postMessage
  // orqali keladi. Fon so'rovi serverdagi SAQLANGAN nusxani qaytarib, muharrirdagi
  // saqlanmagan o'zgarishlarni jimgina o'chirib yuborardi — preview'da so'rov yo'q.
  if(__afCmsDraftMode)return;
  // Throttle interval'dan KICHIK (4.5 daq < 5 daq): `at` fetch TUGAGANDA yoziladi,
  // shu sabab 300000 bo'lsa har ikkinchi 5-daq tick o'tkazib yuborilardi (~10 daq).
  if(__afCms.inflight||(Date.now()-__afCms.at<270000))return;
  __afCms.inflight=true;
  var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  var to=ctrl?setTimeout(function(){ try{ctrl.abort();}catch(e){} },15000):null;
  fetch(afCmsBase()+'/api/plugin/content-config',ctrl?{signal:ctrl.signal}:{}).then(function(r){
    if(!r.ok)throw new Error('http '+r.status);
    return r.json();
  }).then(function(d){
    if(to)clearTimeout(to);
    __afCms.inflight=false; __afCms.at=Date.now();
    if(d&&d.config){
      __afCms.cfg=d.config;
      try{ localStorage.setItem(AF_CMS_LS,JSON.stringify(d.config)); }catch(e){}
      afCmsApply();
    }
  }).catch(function(){
    if(to)clearTimeout(to);
    __afCms.inflight=false; __afCms.at=Date.now(); // xato → jim; joriy matnlar qoladi
  });
}
/* ══ CMS v3: nishonlash (data-cms) + uslub qatlami + bildirishnomalar ══
   Admin vizual muharriri element yo'llari bilan ishlaydi: har CMS matni DOM'da
   `data-cms-text="<yo'l>"` (yaproq) yoki `data-cms="<yo'l>"` (bo'lim) bilan
   nishonlanadi. Shu nishonlar IKKI narsa uchun kerak:
     1) admin panelida "bosib tanlash / joyida tahrir" (faqat preview iframe'da);
     2) `uiStyles` — o'lcham/rang/surish/masshtab overridelari (Premiere ichida ham).
   Nishonlash ishlab turgan plaginda ham bajariladi (atribut zararsiz), aks holda
   uslub qatlami ishlamaydi. */
var AF_CMS_TAG = [
  ['.fhome-kick', 'home.hero.kicker'],
  ['.fhome-hero-copy h1', 'home.hero.title'],
  ['.fhome-sub', 'home.hero.sub'],
  ['.fhome-btn-ai', 'home.hero.ctaPrimary'],
  ['.fhome-btn-stock', 'home.hero.ctaSecondary'],
  ['#homeHeroPrompt', 'home.hero.promptPlaceholder'],
  ['#homeBArt', 'home.hero.mediaUrl'],
  ['#fhomeRecentSec .fhome-sechd h2', 'home.sections.recent'],
  ['#fhomeShelfSec .fhome-sechd h2', 'home.sections.shelf'],
  ['.fhome-browse', 'home.sections.browseAll'],
  ['#fhomeSessHd', 'home.sections.continueSessions'],
  ['#fhomeExploreHd', 'home.sections.explore'],
  ['#fhomeCatHd', 'home.sections.categories'],
  ['#homeGuest .gu-h1', 'guest.title'],
  ['#homeGuest .gu-sub', 'guest.sub'],
  ['#homeGuest .sec .kick', 'guest.peekKicker'],
  ['#homeGuest .gu-mk', 'guest.registerNote'],
  ['.ai-launch-t', 'aiLauncher.title'],
  ['#afAnnounceText', 'announcement.text'],
  ['#afAnnounceCta', 'announcement.ctaLabel'],
];
/* Ro'yxatli bo'limlar: bir selektor → indeksli yo'l (0,1,2…). */
var AF_CMS_TAG_LIST = [
  ['#homeGuest .gu-feats .gu-f .tx b', 'guest.features.$.title'],
  ['#homeGuest .gu-feats .gu-f .tx small', 'guest.features.$.sub'],
  ['#homeCatTiles .fhome-cattile .ct-nm', 'home.categoryTiles.$.label'],
];
/* AI launcher kartalari DOM tartibi konfig indeksiga TENG EMAS (jonli tool'i
   yo'q kategoriya chizilmaydi) — ular aiRenderCatGrid ichida nishonlanadi. */
function afCmsMark(el, path, leaf) {
  if (!el) return;
  var a = leaf ? 'data-cms-text' : 'data-cms';
  if (el.getAttribute(a) !== path) el.setAttribute(a, path);
}
function afCmsStamp() {
  try {
    AF_CMS_TAG.forEach(function (t) {
      var el = document.querySelector(t[0]);
      if (el) afCmsMark(el, t[1], true);
    });
    AF_CMS_TAG_LIST.forEach(function (t) {
      var nodes = document.querySelectorAll(t[0]);
      for (var i = 0; i < nodes.length; i++) afCmsMark(nodes[i], t[1].replace('$', String(i)), true);
    });
    // Bo'lim (guruh) nishonlari — surish/masshtab butun blok uchun
    [['.fhome-hero', 'home.hero'], ['#homeGuest', 'guest'], ['#homeCatTiles', 'home.categoryTiles'],
     ['#afAnnounce', 'announcement'], ['#aiCatGrid', 'aiLauncher.cards']].forEach(function (t) {
      var el = document.querySelector(t[0]);
      if (el) afCmsMark(el, t[1], false);
    });
  } catch (e) {}
}

/* uiStyles → CSS. Platformadagi `ffUiCss` bilan AYNI qoidalar: xom CSS qabul
   qilinmaydi, har qiymat tip + chegara bo'yicha filtrlanadi (injection yuzasi
   yo'q). Plaginda "mobil" yo'q, lekin tor panel (≤560px) mobil slotini oladi. */
function afCmsUiCss(map) {
  if (!map || typeof map !== 'object') return '';
  var num = function (v, lo, hi) { return (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : null; };
  var col = function (v) { return (typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) ? v : null; };
  var pick = function (v, list) { return list.indexOf(v) >= 0 ? v : null; };
  var SHADOW = ['none', '0 2px 8px rgba(0,0,0,.28)', '0 8px 24px rgba(0,0,0,.38)', '0 16px 46px rgba(0,0,0,.48)', '0 28px 80px rgba(0,0,0,.6)'];
  var decls = function (sp) {
    if (!sp || typeof sp !== 'object') return '';
    var out = [];
    var push = function (prop, val) { if (val != null && val !== '') out.push(prop + ':' + val + ' !important'); };
    if (sp.hidden === true) return 'display:none !important';
    push('font-size', num(sp.fontSize, 8, 200) != null ? num(sp.fontSize, 8, 200) + 'px' : null);
    push('font-weight', num(sp.fontWeight, 100, 900));
    push('line-height', num(sp.lineHeight, 0.7, 2.8));
    push('letter-spacing', num(sp.letterSpacing, -0.15, 0.5) != null ? num(sp.letterSpacing, -0.15, 0.5) + 'em' : null);
    push('text-align', pick(sp.textAlign, ['left', 'center', 'right']));
    /* blockAlign — blokning O'ZINI tekislaydi (text-align faqat matnni quti ichida suradi). */
    var ba = pick(sp.blockAlign, ['left', 'center', 'right']);
    if (ba) { push('margin-left', ba === 'left' ? '0' : 'auto'); push('margin-right', ba === 'right' ? '0' : 'auto'); }
    push('text-transform', pick(sp.textTransform, ['none', 'uppercase', 'capitalize']));
    push('color', col(sp.color));
    push('background', col(sp.bg));
    var py = num(sp.padY, 0, 200), px = num(sp.padX, 0, 200);
    if (py != null) { push('padding-top', py + 'px'); push('padding-bottom', py + 'px'); }
    if (px != null) { push('padding-left', px + 'px'); push('padding-right', px + 'px'); }
    push('margin-top', num(sp.marginTop, -300, 400) != null ? num(sp.marginTop, -300, 400) + 'px' : null);
    push('margin-bottom', num(sp.marginBottom, -300, 400) != null ? num(sp.marginBottom, -300, 400) + 'px' : null);
    push('border-radius', num(sp.radius, 0, 120) != null ? num(sp.radius, 0, 120) + 'px' : null);
    /* Neytral qiymat = panelning O'Z CSS'ini bekor qilish (0 = yo'q qilish). */
    var mw = num(sp.maxWidth, 0, 1800);
    if (mw != null) push('max-width', mw > 0 ? mw + 'px' : 'none');
    push('opacity', num(sp.opacity, 0, 1));
    var sh = num(sp.shadow, 0, 4);
    if (sh != null) push('box-shadow', SHADOW[Math.round(sh)]);
    var bw = num(sp.borderWidth, 0, 8);
    if (bw != null && bw > 0) { push('border-style', 'solid'); push('border-width', bw + 'px'); push('border-color', col(sp.borderColor) || 'rgba(255,255,255,.35)'); }
    else if (bw === 0) { push('border', '0'); }
    var tx = num(sp.offsetX, -600, 600), ty = num(sp.offsetY, -600, 600);
    var sc = num(sp.scale, 0.4, 2.5), rot = num(sp.rotate, -30, 30);
    var tf = [];
    if (tx || ty) tf.push('translate(' + (tx || 0) + 'px,' + (ty || 0) + 'px)');
    if (sc != null && sc !== 1) tf.push('scale(' + sc + ')');
    if (rot) tf.push('rotate(' + rot + 'deg)');
    if (tf.length) { push('transform', tf.join(' ')); push('transform-origin', 'center center'); }
    return out.join(';');
  };
  var base = '', mob = '';
  Object.keys(map).forEach(function (path) {
    if (!/^[A-Za-z0-9_.-]{1,90}$/.test(path)) return;
    var st = map[path] || {};
    var sel = '[data-cms="' + path + '"],[data-cms-text="' + path + '"]';
    var d = decls(st.d); if (d) base += sel + '{' + d + '}';
    var m = decls(st.m); if (m) mob += sel + '{' + m + '}';
  });
  return base + (mob ? '@media(max-width:560px){' + mob + '}' : '');
}
var __afCmsCssLast = null;
function afCmsApplyUi(map) {
  var css = afCmsUiCss(map);
  if (css === __afCmsCssLast) return;
  __afCmsCssLast = css;
  try {
    var el = document.getElementById('afCmsStyles');
    if (!el) { el = document.createElement('style'); el.id = 'afCmsStyles'; document.head.appendChild(el); }
    el.textContent = css;
  } catch (e) {}
}

/* ══ Bildirishnomalar (notices) — banner / toast / modal ══
   Admin panelidan yoziladi; e'lon panelidan (announcement) farqi — bir nechta,
   auditoriya (guest/user) va sana oralig'i bilan. Matn FAQAT textContent.
   Yopish holati localStorage'da id bo'yicha. CTA ichki ekran (allow-list) yoki
   tashqi https havola — havola brauzerda ochiladi, panel ichida emas. */
var AF_NOTICE_LS = 'af.cms.notices.dismissed';
function afNoticeDismissed() {
  try { return JSON.parse(localStorage.getItem(AF_NOTICE_LS) || '{}') || {}; } catch (e) { return {}; }
}
function afNoticeDismiss(id) {
  try { var d = afNoticeDismissed(); d[id] = 1; localStorage.setItem(AF_NOTICE_LS, JSON.stringify(d)); } catch (e) {}
}
function afNoticeVisible(n, now, logged, dis) {
  if (!n || !n.enabled || !(n.text || n.title)) return false;
  if (n.audience === 'guest' && logged) return false;
  if (n.audience === 'user' && !logged) return false;
  if (n.startAt) { var s = Date.parse(n.startAt); if (isFinite(s) && now < s) return false; }
  if (n.endAt) { var e = Date.parse(n.endAt); if (isFinite(e) && now > e) return false; }
  if (n.dismissable !== false && n.id && dis[n.id]) return false;
  return true;
}
function afNoticeCta(n) {
  var NAV = { aistudio: 'ai', templates: 'catalog', plugin: 'home', dashboard: 'home', landing: 'home', account: 'home', pricing: '' };
  var tab = NAV[n.ctaTarget || ''];
  if (tab) { try { if (typeof afNavTab === 'function') afNavTab(tab); } catch (e) {} return; }
  var url = String(n.ctaUrl || '');
  if (/^https:\/\//.test(url)) {
    try {
      if (typeof AssetFlowAccount !== 'undefined' && AssetFlowAccount.openExternal) AssetFlowAccount.openExternal(url);
      else window.open(url, '_blank');
    } catch (e) {}
  }
}
function afCmsNoticeStyles() {
  if (document.getElementById('afNoticeCss')) return;
  var s = document.createElement('style');
  s.id = 'afNoticeCss';
  s.textContent =
    '#afNoticeWrap{position:fixed;left:0;right:0;bottom:0;z-index:9400;display:flex;flex-direction:column;gap:8px;padding:0 12px 12px;pointer-events:none}' +
    '#afNoticeTop{position:fixed;left:0;right:0;top:0;z-index:9400;display:flex;flex-direction:column;pointer-events:none}' +
    '.af-nt{pointer-events:auto;display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border-radius:11px;background:#141922;border:1px solid rgba(255,255,255,.13);box-shadow:0 14px 38px rgba(0,0,0,.5);font:500 11.5px/1.45 var(--ff-sans,ui-sans-serif,system-ui,sans-serif);color:#E7ECF3}' +
    '.af-nt.pl-banner{border-radius:0;border-left:0;border-right:0;border-top:0;box-shadow:none}' +
    '.af-nt .dot{width:6px;height:6px;border-radius:50%;background:currentColor;margin-top:6px;flex:none}' +
    '.af-nt .bd{flex:1;min-width:0}' +
    '.af-nt .ti{font-weight:700;font-size:11.5px;margin-bottom:2px}' +
    '.af-nt .tx{color:rgba(231,236,243,.82)}' +
    '.af-nt .cta{margin-top:6px;display:inline-block;border:1px solid currentColor;border-radius:99px;padding:2px 10px;font-size:10.5px;font-weight:700;cursor:pointer}' +
    '.af-nt .x{cursor:pointer;opacity:.55;font-size:13px;line-height:1;padding:2px 3px;flex:none}' +
    '.af-nt .x:hover{opacity:1}' +
    '.af-nt.tone-info{color:#9CCBFF}.af-nt.tone-promo{color:#d8ff3e}.af-nt.tone-warn{color:#FFB27C}.af-nt.tone-success{color:#8FE3B0}' +
    '#afNoticeModal{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(4,7,12,.72);backdrop-filter:blur(5px)}' +
    '#afNoticeModal .bx{width:min(360px,86vw);padding:20px 20px 17px;border-radius:16px;background:#141922;border:1px solid rgba(255,255,255,.14);box-shadow:0 28px 80px rgba(0,0,0,.62);font:500 12px/1.5 var(--ff-sans,ui-sans-serif,system-ui,sans-serif);color:#E7ECF3;text-align:center}';
  document.head.appendChild(s);
}
function afCmsNotices(list) {
  var top = document.getElementById('afNoticeTop');
  var wrap = document.getElementById('afNoticeWrap');
  var modal = document.getElementById('afNoticeModal');
  if (top) top.remove();
  if (wrap) wrap.remove();
  if (modal) modal.remove();
  if (!Array.isArray(list) || !list.length) return;
  afCmsNoticeStyles();
  var now = Date.now();
  var logged = false;
  try { logged = (typeof AssetFlowAccount !== 'undefined') && !!AssetFlowAccount.isLoggedIn(); } catch (e) {}
  var dis = afNoticeDismissed();
  var shown = list.filter(function (n) { return afNoticeVisible(n, now, logged, dis); });
  if (!shown.length) return;

  var mkCard = function (n, cls) {
    var d = document.createElement('div');
    d.className = 'af-nt tone-' + (n.tone || 'info') + (cls ? ' ' + cls : '');
    d.setAttribute('data-cms', 'notices.' + list.indexOf(n));
    var dot = document.createElement('span'); dot.className = 'dot'; d.appendChild(dot);
    var bd = document.createElement('div'); bd.className = 'bd';
    if (n.title) {
      var ti = document.createElement('div'); ti.className = 'ti'; ti.textContent = n.title;
      ti.setAttribute('data-cms-text', 'notices.' + list.indexOf(n) + '.title');
      bd.appendChild(ti);
    }
    if (n.text) {
      var tx = document.createElement('div'); tx.className = 'tx'; tx.textContent = n.text;
      tx.setAttribute('data-cms-text', 'notices.' + list.indexOf(n) + '.text');
      bd.appendChild(tx);
    }
    if (n.ctaLabel) {
      var c = document.createElement('span'); c.className = 'cta'; c.textContent = n.ctaLabel;
      c.setAttribute('data-cms-text', 'notices.' + list.indexOf(n) + '.ctaLabel');
      c.onclick = function () { afNoticeCta(n); };
      bd.appendChild(c);
    }
    d.appendChild(bd);
    if (n.dismissable !== false) {
      var x = document.createElement('span'); x.className = 'x'; x.textContent = '×';
      x.onclick = function () { if (n.id) afNoticeDismiss(n.id); d.remove(); };
      d.appendChild(x);
    }
    return d;
  };

  var banners = shown.filter(function (n) { return n.placement === 'banner'; });
  var toasts = shown.filter(function (n) { return n.placement === 'toast'; });
  var modals = shown.filter(function (n) { return n.placement === 'modal'; });
  if (banners.length) {
    var t = document.createElement('div'); t.id = 'afNoticeTop';
    banners.forEach(function (n) { t.appendChild(mkCard(n, 'pl-banner')); });
    document.body.appendChild(t);
  }
  if (toasts.length) {
    var w = document.createElement('div'); w.id = 'afNoticeWrap';
    toasts.forEach(function (n) { w.appendChild(mkCard(n)); });
    document.body.appendChild(w);
  }
  if (modals.length) {
    var n0 = modals[0];
    var m = document.createElement('div'); m.id = 'afNoticeModal';
    var bx = document.createElement('div'); bx.className = 'bx';
    bx.appendChild(mkCard(n0));
    var close = document.createElement('div');
    close.className = 'af-nt cta';
    close.textContent = 'Yopish';
    close.style.cssText = 'margin:12px auto 0;display:inline-block;padding:5px 16px;border:1px solid rgba(255,255,255,.2);border-radius:99px;cursor:pointer;font-weight:700;font-size:11px;background:transparent;box-shadow:none';
    close.onclick = function () { if (n0.id) afNoticeDismiss(n0.id); m.remove(); };
    bx.appendChild(close);
    m.appendChild(bx);
    document.body.appendChild(m);
  }
}
window.afCmsTick=function(){ afCmsFetch(); };
// Boot: kesh SINXRON qo'llanadi (instant, offline-safe) + fon fetch + 5-daq davriy yangilash
try{
  var __cmsCached=null;
  // Muharrir preview'ida kesh o'qilmaydi — draft yagona manba (afCmsFetch bilan bir xil sabab)
  if(!__afCmsDraftMode){ try{ __cmsCached=JSON.parse(localStorage.getItem(AF_CMS_LS)||'null'); }catch(e){} }
  if(__cmsCached){ __afCms.cfg=__cmsCached; afCmsApply(); }
  else afCmsStamp();  // config yo'q bo'lsa ham nishonlar qo'yiladi (uslub qatlami + admin preview)
  afCmsFetch();
  setInterval(afCmsFetch,300000);
}catch(e){}

/* ══ SC_22: sessiya displey nomi — xom prompt nomlari o'rniga toza sarlavha ══
   Qoida: title yo'q → "New session · <Mon D>"; qisqa title (≤28) → aynan (qo'lda
   nom ustun); uzun xom-prompt title → birinchi ~4 mazmunli so'z, Title Case,
   @mention/punktuatsiya olib tashlanadi, 28 belgida ellipsis. */
function afDeriveSessName(src,createdAt){
  var s=String(src||'').replace(/@[\w-]+/g,' ').replace(/[^A-Za-z0-9À-￿' ]+/g,' ').replace(/\s+/g,' ').trim();
  if(!s){
    var d=createdAt?new Date(createdAt):new Date();
    var mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return 'New session · '+mo[d.getMonth()]+' '+d.getDate();
  }
  var stop={a:1,an:1,the:1,of:1,on:1,in:1,at:1,to:1,and:1,with:1,for:1,is:1};
  var words=s.split(' ').filter(function(w){ return w&&!stop[w.toLowerCase()]; }).slice(0,4);
  if(!words.length)words=s.split(' ').slice(0,4);
  var out=words.map(function(w){ return w.charAt(0).toUpperCase()+w.slice(1); }).join(' ');
  if(out.length>28)out=out.slice(0,27).replace(/\s+\S*$/,'')+'…';
  return out||'Session';
}
window.afSessionDisplayName=function(s){
  var t=(s&&s.title?String(s.title):'').trim();
  if(!t)return afDeriveSessName('',s&&(s.createdAt||s.lastAt));
  if(t.length<=28)return t; // qisqa — ehtimol qo'lda qo'yilgan nom, aynan ko'rsatiladi
  return afDeriveSessName(t,s&&s.createdAt);
};
function afTimeAgo(ts){
  if(!ts)return '';
  const d=typeof ts==='number'?ts:Date.parse(ts); if(!isFinite(d))return '';
  const s=Math.max(0,(Date.now()-d)/1000);
  if(s<90)return 'just now';
  if(s<3600)return Math.round(s/60)+'m ago';
  if(s<86400)return Math.round(s/3600)+'h ago';
  if(s<172800)return 'yesterday';
  return Math.round(s/86400)+'d ago';
}
/* Oxirgi import — downloadedMeta[.at] muhri bo'yicha (eski yozuvlarda muhr yo'q → Set tartibidagi oxirgi) */
function homeLastImport(){
  try{
    if(!window.downloaded||!window.downloaded.size)return null;
    let best=null,bestAt=-1,last=null;
    window.downloaded.forEach(function(k){
      last=k;
      const at=(window.downloadedMeta&&window.downloadedMeta[k]&&window.downloadedMeta[k].at)||0;
      if(at>bestAt){bestAt=at;best=k;}
    });
    const key=bestAt>0?best:last; if(!key)return null;
    let a=null; try{ if(typeof assets!=='undefined'&&assets)a=assets.find(function(x){return x.n===key;})||null; }catch(e){}
    const meta=(window.downloadedMeta&&window.downloadedMeta[key])||{};
    const name=(a&&(a.displayName||a.n))||meta.displayName||key;
    return {key:key,asset:a,name:name,at:meta.at||0};
  }catch(e){ return null; }
}
/* Oxirgi gen — real /api/studio/gen/history (60s throttle; home-mode'da qatorni yangilaydi).
   SC_07: .it (hero art) SAQLANADI + .items (8 tagacha normalizatsiyalangan) — "Jump back in" strip. */
var __homeGen={it:null,items:[],at:0,inflight:false};
function homeGenItem(g){
  const a=(g.assets&&g.assets[0])||{}; const p=g.params||{};
  const cat=g.mode==='video'?'video':(g.mode==='voice'||g.mode==='music')?'audio':g.mode==='sfx'?'sfx':'image';
  return { id:g.id, mode:g.mode, cat:cat, url:a.url||'', thumb:a.thumbUrl||a.url||'', downloadUrl:a.downloadUrl||null,
    // P9 — 1280 display (Retina karta) + 720p hover preview + haqiqiy piksellar
    display:a.displayUrl||null, preview:a.previewUrl||null, width:a.width||null, height:a.height||null,
    title:((g.prompt||'').trim()||'Result'), prompt:(g.prompt||'').trim(), params:p,
    modelLabel:p.modelLabel||'', createdAt:g.createdAt, cost:(typeof g.cost==='number'?g.cost:null) };
}
function homeFetchLastGen(){
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn())return;
  if(typeof studioGet!=='function')return;
  if(__homeGen.inflight||(Date.now()-__homeGen.at<60000))return;
  __homeGen.inflight=true;
  studioGet('/api/studio/gen/history?limit=8').then(function(d){
    __homeGen.inflight=false; __homeGen.at=Date.now();
    const items=(d&&d.items)||[];
    // SC_07: to'liq ro'yxat saqlanadi (strip) + .it (hero art) avvalgidek birinchi URL'li element
    __homeGen.items=items.map(homeGenItem).filter(function(c){ return !!c.url; });
    __homeGen.it=__homeGen.items[0]||null;
    if(document.documentElement.classList.contains('home-mode')){ renderHomeHero(); renderHomeRecent(); }
  }).catch(function(){ __homeGen.inflight=false; __homeGen.at=Date.now(); });
}
function homeImportGen(it){
  if(!it||!it.url)return;
  if(typeof aiImportMedia==='function'){
    const kind=it.cat==='video'?'video':(it.cat==='audio'||it.cat==='sfx')?'audio':'image';
    aiImportMedia(it.url,kind,null);
  }else showToast('Import only works inside Premiere Pro','info');
}
function homeGenCtx(){
  return { isCEP:(typeof IS_CEP!=='undefined'&&IS_CEP),
    list:function(){ return __homeGen.it?[__homeGen.it]:[]; },
    onImport:homeImportGen,
    onAddProject:function(it){ if(window.afProjectPicker)window.afProjectPicker('gen',it.id); }, // P1
    onAddExplore:function(it){ window.afAddToExplore(it); }, // P3 (step 34)
    onDownload:function(it){ try{ const a=document.createElement('a'); a.href=it.downloadUrl||it.url; a.download=window.afGenDlName(it.prompt||it.title,it.url,it.cat); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} } };
}
/* Re-import: pack keshda bo'lsa to'g'ridan Premiere'ga (downloadAll), bo'lmasa Yuklab olinganlar ro'yxati */
function homeReimport(key){
  if(typeof packs!=='undefined'&&packs&&packs[key]&&typeof downloadAll==='function'){ downloadAll(key); return; }
  if(typeof afLibOpen==='function')afLibOpen('downloaded');
}
function homeOpenImported(li){
  try{ if(li.asset&&typeof openPack==='function'&&typeof packs!=='undefined'&&packs&&packs[li.key]){ homeGo(li.asset.nav||'video'); openPack(li.key); return; } }catch(e){}
  if(typeof afLibOpen==='function')afLibOpen('downloaded');
}
function renderHomeContinue(){
  const sec=document.getElementById('homeContSec'), box=document.getElementById('homeCont');
  if(!sec||!box)return;
  box.innerHTML='';
  const li=homeLastImport(); const gen=__homeGen.it;
  if(!li&&!gen){ sec.style.display='none'; return; }
  sec.style.display='';
  if(li){
    const row=document.createElement('div'); row.className='va-crow';
    const th=document.createElement('div'); th.className='cthumb grain';
    const vm=li.asset?hmFromAsset(li.asset):null;
    th.style.backgroundImage=vm?hmBg(vm):HM_GRAD.steel;
    row.appendChild(th);
    const tx=document.createElement('div'); tx.className='tx';
    const ago=li.at?afTimeAgo(li.at):'';
    tx.innerHTML='<b>'+hmEsc(li.name)+'</b><small><span class="st">IMPORTED</span>'+hmEsc('Template'+(ago?(' · '+ago):''))+'</small>';
    row.appendChild(tx);
    const b=document.createElement('button'); b.type='button'; b.className='imp soft act';
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"/><path d="M3 8a9 9 0 1 0 2.6-5.7L3 8"/></svg>Re-import';
    b.addEventListener('click',function(e){ e.stopPropagation(); homeReimport(li.key); });
    row.appendChild(b);
    row.addEventListener('click',function(){ homeOpenImported(li); });
    box.appendChild(row);
  }
  if(gen){
    const row=document.createElement('div'); row.className='va-crow';
    const th=document.createElement('div'); th.className='cthumb grain';
    if(gen.cat==='video'&&typeof window.afVideoThumb==='function'){
      const v=window.afVideoThumb(gen.url,(gen.thumb&&gen.thumb!==gen.url)?gen.thumb:null);
      if(v)th.appendChild(v);
      const pl=document.createElement('span'); pl.className='cplay'; pl.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>'; th.appendChild(pl);
    }else if(gen.cat==='audio'||gen.cat==='sfx'){
      th.style.background='linear-gradient(135deg,#1A2A4E,#33549E)';
      const pl=document.createElement('span'); pl.className='cplay'; pl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>'; th.appendChild(pl);
    }else{ th.style.backgroundImage='url("'+gen.thumb+'")'; }
    row.appendChild(th);
    const tx=document.createElement('div'); tx.className='tx';
    const catLb=gen.cat==='video'?'AI Video':gen.cat==='audio'?'AI Voice':gen.cat==='sfx'?'AI SFX':'AI Image';
    const bits=[catLb]; if(gen.modelLabel)bits.push(gen.modelLabel);
    const ago2=afTimeAgo(gen.createdAt); if(ago2)bits.push(ago2);
    tx.innerHTML='<b>'+hmEsc(gen.title)+'</b><small><span class="st">READY</span>'+hmEsc(bits.join(' · '))+'</small>';
    row.appendChild(tx);
    const b=document.createElement('button'); b.type='button'; b.className='imp act';
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>Import';
    b.addEventListener('click',function(e){ e.stopPropagation(); homeImportGen(gen); });
    row.appendChild(b);
    row.addEventListener('click',function(){ if(window.afRecent&&window.afRecent.openLightbox)window.afRecent.openLightbox(gen,homeGenCtx()); });
    box.appendChild(row);
  }
}
/* Kredit nudge — real balans natijaga tarjima qilinadi (~20 kredit ≈ 1 qisqa video) */
function renderHomeNudge(u){
  const box=document.getElementById('homeNudge'), tx=document.getElementById('homeNudgeTx');
  if(!box||!tx)return;
  const cr=(u&&typeof u.aiCredits==='number'&&isFinite(u.aiCredits))?u.aiCredits:null;
  if(cr==null){ box.style.display='none'; return; }
  const vids=Math.floor(cr/20);
  tx.innerHTML='<b style="font-weight:700">✦ '+cr.toLocaleString('en-US')+' credits</b> — '+(vids>=1?('enough for ~'+vids+' video'+(vids===1?'':'s')):'top up to keep generating');
  box.style.display='';
}
/* Karta HTML — mavjud hm-card komponenti 1:1 (Recommended + guest peek shundan foydalanadi) */
function hmCardHTML(vm){
  return '<div class="hm-card" data-nav="'+hmEsc(vm.nav||'video')+'">'
    +'<div class="hm-thumb" style="background-image:'+hmBg(vm)+(vm.nopack?';opacity:.5':'')+'">'
    +'<span class="hm-badge '+hmPlanCls(vm.plan)+'">'+hmEsc(vm.plan)+'</span>'
    +hmXBadge(vm)
    +'<span class="hm-app">'+hmAppMark(vm.app)+'</span>'
    +'</div><div class="hm-cn">'+hmEsc(vm.n)+'</div>'
    +'<div class="hm-cc">'+hmEsc(vm.c)+(vm.a?(' · '+hmEsc(vm.a)):'')+'</div></div>';
}
/* #H1 "Fresh for your next cut" javoni — faqat REAL katalog (window.assets; HM_DEMO fallback YO'Q).
   catalogLoadState==='loading' → 3 skelet; tayyor/xato + bo'sh → butun bo'lim yashirin.
   Karta bosilsa mavjud detal yo'li: homeGo(nav) + openPack(key). Katalogda duration maydoni
   yo'q — davomiylik chipi chiqarilmaydi (ma'lumot to'qilmaydi). */
function fhomeShelfList(){
  var out=[],seen={},i,a;
  try{
    if(typeof assets==='undefined'||!assets)return out;
    for(i=0;i<assets.length&&out.length<12;i++){ // SC_07: javon limiti 6→12 (ko'p-qatorli grid)
      a=assets[i];
      var nm=String(a.displayName||a.n||'').trim().toLowerCase();
      var au=String((a.author&&(a.author.name||a.author))||'').trim().toLowerCase();
      if(!nm||seen[nm+' '+au])continue; seen[nm+' '+au]=1; // P11 dedup naqshi — nom+muallif
      out.push(a);
    }
  }catch(e){}
  return out;
}
/* SC_07 — "Jump back in" strip: oxirgi 6 tagacha generatsiya (thumb + tur/model + vaqt).
   0 gen → butun seksiya yashirin (bo'sh placeholder YO'Q). Bosish → AI bo'lim + My Library. */
function renderHomeRecent(){
  var sec=document.getElementById('fhomeRecentSec'), box=document.getElementById('homeRecent');
  if(!sec||!box)return;
  var items=(typeof __homeGen!=='undefined'&&__homeGen.items)?__homeGen.items.slice(0,6):[];
  if(!items.length){ sec.style.display='none'; box.innerHTML=''; return; }
  sec.style.display='';
  box.innerHTML=items.map(function(it){
    var isVid=it.cat==='video';
    var isAud=it.cat==='audio'||it.cat==='sfx';
    var bg=it.thumb&&!isAud?("url('"+hmEsc(it.thumb)+"')"):'';
    var meta=it.modelLabel||({video:'Video',audio:'Voice',sfx:'SFX'})[it.cat]||'Image';
    return '<div role="button" tabindex="0" class="fhome-rcard" type="button" title="'+hmEsc(it.title)+'">'
      +'<span class="fhome-rmedia'+(isAud?' aud':'')+'"'+(bg?' style="background-image:'+bg+'"':'')+'>'
      +(isVid?'<span class="fhome-rplay">▶</span>':'')
      +(isAud?'<span class="fhome-raud">♪</span>':'')
      +'</span>'
      +'<span class="fhome-rmeta"><b>'+hmEsc(meta)+'</b><i>'+hmEsc(afTimeAgo(it.createdAt))+'</i></span>'
      +'</div>';
  }).join('');
  Array.prototype.forEach.call(box.querySelectorAll('.fhome-rcard'),function(c){
    c.addEventListener('click',function(){
      // mavjud navigatsiya: AI bo'lim → My Library (data-go="history" yo'li); yangi routing yo'q
      homeGo('ai');
      if(typeof window.axGo==='function')setTimeout(function(){ window.axGo('history'); },0);
    });
  });
}
function renderHomeGrid(){
  var sec=document.getElementById('fhomeShelfSec'), box=document.getElementById('homeGrid');
  if(!sec||!box)return;
  var list=fhomeShelfList();
  if(!list.length){
    if(typeof catalogLoadState!=='undefined'&&catalogLoadState==='loading'){
      sec.style.display='';
      // SC_07: skelet — yangi katta karta o'lchamida to'liq bir qator
      var sk='<div class="fhome-tcard fhome-tskel"><span class="fhome-tskel-media"></span><span class="fhome-tskel-line"></span></div>';
      box.innerHTML=sk+sk+sk+sk;
    }else{ sec.style.display='none'; box.innerHTML=''; }
    return;
  }
  sec.style.display='';
  // SC_07 karta anatomiyasi: media + chip'lar (FREE/PRO + rezolyutsiya) + BITTA sarlavha
  // qatori. "AFTER EFFECTS · 1080P" meta qatori O'CHIRILDI (butun javon Premiere — ortiqcha).
  box.innerHTML=list.map(function(a){
    var pro=!!a.isPro;
    var bg=a.thumb?("url('"+a.thumb+"')"):HM_GRAD[HM_GKEYS[hmHash(a.n)%HM_GKEYS.length]];
    var res=a.res?String(a.res).toUpperCase():'';
    return '<div role="button" tabindex="0" class="fhome-tcard" type="button" data-key="'+hmEsc(a.n)+'" data-nav="'+hmEsc(a.nav||'video')+'">'
      +'<span class="fhome-tmedia" style="background-image:'+bg+'">'
      +'<span class="fhome-tbadge'+(pro?' pro':'')+'">'+(pro?'PRO':'FREE')+'</span>'
      +(res?'<span class="fhome-tres">'+hmEsc(res)+'</span>':'')
      +'</span>'
      +'<h3>'+hmEsc(a.displayName||a.n)+'</h3></div>';
  }).join('')
  // "Browse all →" ghost karta — javon oxirida, katalogga o'tadi
  +'<div role="button" tabindex="0" class="fhome-tcard fhome-tghost" type="button" onclick="homeGo(\'video\')"><span>Browse all →</span></div>';
  Array.prototype.forEach.call(box.querySelectorAll('.fhome-tcard:not(.fhome-tghost)'),function(c){
    c.addEventListener('click',function(){
      var key=c.getAttribute('data-key');
      homeGo(c.getAttribute('data-nav')||'video');
      try{ if(key&&typeof packs!=='undefined'&&packs&&packs[key]&&typeof openPack==='function')openPack(key); }catch(e){}
    });
  });
}
/* Guest: real katalog peek (2 karta, blur) + shablon soni qatori */
function renderHomeGuest(){
  var box=document.getElementById('homeGuestGrid');
  if(box)box.innerHTML=hmList().slice(0,2).map(hmCardHTML).join('');
  var line=document.getElementById('homeGuestTplLine');
  if(line){
    var n=0; try{ if(typeof assets!=='undefined'&&assets)n=assets.length; }catch(e){}
    line.textContent=n?(n+'+ drag-and-drop templates'):'Drag-and-drop templates';
  }
}
/* Guest Google CTA — mavjud g2 sheet + device-code oqimi */
function homeGuestGoogle(){
  openAccountSheet();
  if(typeof accountLoginWithGoogle==='function')accountLoginWithGoogle();
}
function homeGo(tab){
  const el=document.querySelector('.env-side-link[data-nav="'+tab+'"]')||null;
  if(typeof switchNavFromSidebar==='function') switchNavFromSidebar(el,tab);
}
function goHome(){
  document.documentElement.classList.remove('ai-mode');
  document.documentElement.classList.remove('lib-mode'); // #10: Kutubxonadan ham bir bosishda Home
  document.documentElement.classList.add('home-mode');
  try{ renderHome(); }catch(e){}
  try{ const sa=document.querySelector('.scroll-area'); if(sa)sa.scrollTop=0; }catch(e){}
  if(typeof afSetPaneCtx==='function')afSetPaneCtx(); // BATCH8 P3 — app-bar konteksti
  if(typeof syncPillarSeg==='function')syncPillarSeg(); // SC_12 — doimiy seg aktiv holati
}
window.goHome=goHome;
function wireHome(){
  // Kredit/avatar/pillar/CTA'lar — inline onclick (markup ichida); bu yerda faqat katalog header chaqmoq tugmasi.
  const back=document.getElementById('afHomeBtn');
  if(back&&!back._wired){back._wired=1;back.addEventListener('click',goHome);}
}
// Boot: saqlangan yig'iq/yoyiq holatni tiklash. Sidebar DOM yuqorida — sinxron chaqiramiz
// (birinchi bo'yashdan oldin) → flash bo'lmaydi.
try{ restoreSidebarPref(); }catch(e){}
// Sidebar — yon panelni QO'LDA yig'ish/yoyish (1↔2 holat). Tanlov prefs'ga saqlanadi.
// cep-mode avtomatik yig'ilishi ENDI sidebar'ga ta'sir qilmaydi — qo'lda tanlov ustun.
function toggleSidebar(){
  const collapsed=document.documentElement.classList.toggle('sb-collapsed');
  try{ localStorage.setItem('af.sidebarCollapsed', collapsed?'1':'0'); }catch(e){}
}
/* Panelni qayta yuklash. CEP panel HTML hot-reload qilmaydi — bu location.reload()
   Premiere'ni to'liq Cmd+Q qilmasdan UI'ni yangilaydi (eski holat/xato bo'lganda foydali). */
function reloadPanel(){
  try{ location.reload(); }
  catch(e){ try{ window.location.href=window.location.href; }catch(_){ } }
}
function restoreSidebarPref(){
  let v=null; try{ v=localStorage.getItem('af.sidebarCollapsed'); }catch(e){}
  let collapsed;
  if(v==='1') collapsed=true;
  else if(v==='0') collapsed=false;
  else collapsed=(typeof IS_CEP!=='undefined'&&IS_CEP); // birinchi ishga tushirish: CEP'da yig'iq
  const html=document.documentElement;
  html.classList.add('sb-no-anim');
  html.classList.toggle('sb-collapsed',collapsed);
  requestAnimationFrame(()=>requestAnimationFrame(()=>html.classList.remove('sb-no-anim')));
}
// Katalog guruhi: yoyiq → bolalarni yig'ish/ochish; yig'iq → to'g'ridan "Shablonlar" ga o'tadi
function toggleKatalogGroup(){
  const sb=document.getElementById('envSidebar');
  if(!sb)return;
  if(document.documentElement.classList.contains('sb-collapsed')){
    const vid=document.querySelector('.env-side-link[data-nav="video"]');
    if(vid) switchNavFromSidebar(vid,'video');
    return;
  }
  const collapsed=sb.classList.toggle('kat-collapsed');
  const head=document.getElementById('sbKatHead');
  if(head)head.setAttribute('aria-expanded',String(!collapsed));
}
// Yuklab olingan / Sevimli — sidebar'dan a6 "Kutubxonam" (lib-mode) ochiladi.
// switchPage('favorites'|'downloaded') holati afLibOpen ichida saqlanadi.
function switchPageFromSidebar(el,page){
  afLibOpen(page);
}
// Sidebar user kartasi — AssetFlowAccount holatiga (updateFootUser bilan birga chaqiriladi)
function updateSidebarUser(u){
  const av=document.getElementById('sbAv'),name=document.getElementById('sbName'),
        mail=document.getElementById('sbMail'),plan=document.getElementById('sbPlan');
  if(!u){
    if(av)av.textContent='U';
    if(name)name.textContent='Guest';
    if(mail)mail.textContent='Click to sign in';
    if(plan){plan.textContent='Free';plan.className='sb-plan free';}
    setHeaderPlan(false,'Free');
    return;
  }
  const initial=(u.name||u.email||'U').trim().charAt(0).toUpperCase();
  if(av)av.textContent=initial;
  if(name)name.textContent=u.name||(u.email?u.email.split('@')[0]:'User');
  if(mail)mail.textContent=u.email||'';
  if(plan){const pro=u.plan==='pro';plan.textContent=u.planLabel||(pro?'Pro':'Free');plan.className='sb-plan '+(pro?'pro':'free');}
  setHeaderPlan(u.plan==='pro',u.planLabel||(u.plan==='pro'?'Pro':'Free'),(typeof u.aiCredits==='number'?u.aiCredits:undefined));
}

// C2 top-header plan-pill — sidebar user yangilanishi bilan birga (faqat ko'rinish).
// E1: kredit balansi (displey-only) — sidebar #sbCredit bilan bir manba (u.aiCredits).
function setHeaderPlan(pro,label,credits){
  // #10/#11 umumiy header sinxroni: kredit qiymati + plan chip (data-hdplan) + guest almashinuvi.
  const hasCred=typeof credits==='number'&&isFinite(credits);
  const t=hasCred?credits.toLocaleString('en-US'):'—';
  ['hdrCred','homeCredVal','libCredVal'].forEach(function(id){ const el=document.getElementById(id); if(el)el.textContent=t; }); // SC_07: homeBBal o'chirildi (greet-balans dublikati)
  const lb=String(label||'Free').toUpperCase();
  document.querySelectorAll('[data-hdplan]').forEach(function(el){ el.textContent=lb; el.classList.toggle('free',!pro); });
  afHdrSyncAll();
}
/* Guest ↔ logged-in header almashinuvi: HAR header (Home .hd / katalog .af-topbar / AI .ai-hdr / lib .lib-top)
   o'ng klasteri — logged: kredit+plan+avatar(ring); guest: bitta lime "Sign in" pill (bir xil geometriya). */
function afHdrSyncAll(){
  const logged=typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.isLoggedIn();
  // SC_12: guest holatда markaziy seg ko'rinmaydi (guest ekran — istisno);
  // visibility (display emas) — grid markazlash geometriyasi saqlanadi.
  const seg=document.querySelector('.af-tb-seg');
  if(seg)seg.style.visibility=logged?'':'hidden';
  document.querySelectorAll('#homeHd,.af-topbar,.axroot .ai-hdr,.lib-top').forEach(function(h){
    const cred=h.querySelector('.hd-cred,.af-tb-cred,.ai-cred');
    const ava=h.querySelector('.hd-ava,.af-tb-ava,.ai-ava');
    let si=h.querySelector('.hd-signin');
    if(!logged){
      if(cred)cred.style.display='none';
      if(ava)ava.style.display='none';
      if(!si){
        si=document.createElement('button'); si.type='button'; si.className='hd-signin';
        si.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>Sign in';
        si.addEventListener('click',function(){ if(typeof openAccountSheet==='function')openAccountSheet(); });
        // SC_12: af-topbar endi grid — pill headerning O'NG klasteriga kiradi
        // (to'g'ridan grid'ga qo'shilsa yangi qatorga tushib layoutni buzadi)
        (h.querySelector('.af-tb-r')||h).appendChild(si);
      }
      si.style.display='';
    }else{
      if(cred)cred.style.display='';
      if(ava)ava.style.display='';
      if(si)si.style.display='none';
    }
    if(ava)ava.classList.toggle('ring',logged);
  });
}
/* AI header kredit pill'lariga plan chip (aiLeadSync/afSyncCredits innerHTML yangilaganda ham saqlanadi) */
window.afPlanChipHTML=function(){
  var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null;
  if(!u)return '';
  var pro=u.plan==='pro';
  return ' <span class="hd-plan'+(pro?'':' free')+'" data-hdplan>'+String(u.planLabel||(pro?'Pro':'Free')).toUpperCase()+'</span>';
};

function onEnvScopeChange(sel){
  const tab=sel.value;
  document.querySelectorAll('.env-side-link').forEach(t=>{
    t.classList.toggle('active',t.dataset.nav===tab);
  });
  applyNavSwitch(tab);
}

/* F-02 tozalash: eski AI kompozer (AI_CFG/af_ai/aiLoadModels...) olib tashlandi — hech qayerdan chaqirilmasdi. */
/** /api/studio GET — auth bilan (pubFetch base+timeout). */
async function studioGet(path){
  const res=await pubFetch(path,{headers:pubAuthHeaders()},30000);
  const t=await res.text();let d={};try{d=t?JSON.parse(t):{};}catch(e){d={};}
  if(!res.ok){const e=new Error((d&&d.error)||('HTTP '+res.status));e.status=res.status;e.code=d&&d.code;throw e;}
  return d;
}
/** UUID (idempotency kaliti) — crypto.randomUUID bo'lsa o'sha, aks holda zaxira. */
function afUuid(){
  try{ if(window.crypto&&window.crypto.randomUUID) return window.crypto.randomUUID(); }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=(Math.random()*16)|0,v=c==='x'?r:(r&0x3)|0x8;return v.toString(16);});
}
/** #31 (PX1) — UCHAYOTGAN gen'lar reyestri (diskda saqlanadi).
 *
 *  MUAMMO: faol job'lar faqat tool'ning JS massivida yashardi. Panel yopilsa (yoki Premiere
 *  extension'ni qayta yuklasa) massiv yo'q bo'lardi: kredit yechilgan, server gen'ni
 *  davom ettirardi, lekin foydalanuvchi natijani HECH QACHON ko'rmasdi.
 *
 *  Endi job yuborilganda shu yerga yoziladi va tool ochilganda serverdagi
 *  `?status=active` ro'yxati bilan solishtirib TIKLANADI (prompt/model/narx diskdan,
 *  holat serverdan). Yozuv tugagach o'chiriladi; 6 soatdan eski yozuv o'z-o'zidan tushadi. */
var afJobStore=(function(){
  var KEY='af_active_jobs',MAX=20,TTL=6*60*60*1000;
  function read(){ try{ var raw=localStorage.getItem(KEY); var a=raw?JSON.parse(raw):[]; return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function write(rows){ try{ localStorage.setItem(KEY,JSON.stringify(rows.slice(0,MAX))); }catch(e){} }
  function prune(rows){ var cut=Date.now()-TTL; return rows.filter(function(r){ return r&&r.jobId&&(r.ts||0)>cut; }); }
  return {
    add:function(tool,rec){
      if(!rec||!rec.jobId)return;
      var rows=prune(read()).filter(function(r){ return r.jobId!==rec.jobId; });
      rows.unshift({tool:tool,jobId:rec.jobId,prompt:rec.prompt||'',cat:rec.cat||'image',cost:rec.cost||0,
                    sid:rec.sid||null,modelId:rec.modelId||null,params:rec.params||null,ts:Date.now()});
      write(rows);
    },
    remove:function(jobId){ if(jobId)write(prune(read()).filter(function(r){ return r.jobId!==jobId; })); },
    list:function(tool){ var rows=prune(read()); write(rows); return tool?rows.filter(function(r){ return r.tool===tool; }):rows; },
    clear:function(){ write([]); }
  };
})();
window.afJobStore=afJobStore;
/** #141 (PX4) — model `etaSec` (server o'lchagan mediana) → odam o'qiydigan diapazon.
 *  Bitta aniq raqam va'da qilmaymiz: haqiqiy vaqt navbat/provayder yukiga qarab tebranadi,
 *  shuning uchun ~0.7×…1.4× oralig'i ko'rsatiladi. */
function afEtaLabel(sec){
  sec=Number(sec)||0; if(sec<=0)return '';
  var lo=Math.max(5,Math.round(sec*0.7)),hi=Math.max(lo+5,Math.round(sec*1.4));
  if(hi<90)return '≈ '+lo+'–'+hi+' sec';
  var lm=Math.max(1,Math.round(lo/60)),hm=Math.max(lm+1,Math.round(hi/60));
  return '≈ '+lm+'–'+hm+' min';
}
window.afEtaLabel=afEtaLabel;
function afBackoff(a){ return [1500,3500,7000,10000][a]||10000; }
function afSleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
/** /api/studio POST — auth bilan.
 *  P18: body.idempotencyKey bo'lsa (masalan /gen) — Idempotency-Key header yuboriladi VA
 *  o'tkinchi xatolarda (tarmoq/timeout, 502/503/504/429) SABR bilan qayta uriniladi (server
 *  shu kalit bo'yicha dedup qiladi → ikkinchi charge YO'Q). Kalitsiz POST bitta urinish (avvalgidek)
 *  — himoyasiz POST'ni ko'r-ko'rona qayta yuborish DOUBLE-CHARGE'ga olib keladi. */
async function studioPost(path,body,ms){
  body=body||{};
  var idem=body.idempotencyKey||null;
  var headers=Object.assign({'Content-Type':'application/json'},pubAuthHeaders());
  if(idem)headers['Idempotency-Key']=idem;
  var maxAttempts=idem?4:1;
  var lastErr=null;
  for(var a=0;a<maxAttempts;a++){
    try{
      var res=await pubFetch(path,{method:'POST',headers:headers,body:JSON.stringify(body)},ms||60000);
      var t=await res.text();var d={};try{d=t?JSON.parse(t):{};}catch(e){d={};}
      if(!res.ok){
        if(idem&&(res.status===502||res.status===503||res.status===504||res.status===429)&&a<maxAttempts-1){ await afSleep(afBackoff(a)); continue; }
        var e2=new Error((d&&d.error)||('HTTP '+res.status));e2.status=res.status;e2.code=d&&d.code;throw e2;
      }
      return d;
    }catch(err){
      // status yo'q = tarmoq/timeout throw → idempotent bo'lsa qayta uramiz; HTTP xato (status bor) re-throw.
      if(idem&&(typeof err.status==='undefined')&&a<maxAttempts-1){ lastErr=err; await afSleep(afBackoff(a)); continue; }
      throw err;
    }
  }
  throw lastErr||new Error('Request failed');
}
/** /api/studio POST multipart/file — auth bilan. */
async function studioPostForm(path,form,ms){
  return new Promise(function(resolve,reject){
    try{
      var xhr=new XMLHttpRequest();
      xhr.open('POST',pubApiBase()+path,true);
      var hdr=pubAuthHeaders()||{};
      Object.keys(hdr).forEach(function(k){ try{xhr.setRequestHeader(k,hdr[k]);}catch(_){} });
      xhr.timeout=ms||120000;
      xhr.onreadystatechange=function(){
        if(xhr.readyState!==4)return;
        var txt=xhr.responseText||''; var d={}; try{ d=txt?JSON.parse(txt):{}; }catch(e){ d={}; }
        if(xhr.status>=200&&xhr.status<300){ resolve(d); return; }
        var err=new Error((d&&d.error)||('HTTP '+xhr.status));
        err.status=xhr.status||0; err.code=d&&d.code;
        reject(err);
      };
      xhr.ontimeout=function(){
        var err=new Error('Server did not respond (upload timeout)');
        err.status=408;
        reject(err);
      };
      xhr.onerror=function(){
        var err=new Error('Upload error');
        err.status=xhr.status||0;
        reject(err);
      };
      xhr.send(form);
    }catch(e){ reject(e); }
  });
}

// R4_08 — YOQILGAN Topaz enhance/upscale operatsiyalari (opType). /gen/models composer'dan filtrlangan;
// bu ro'yxat So'nggi-grid / galereya kartalaridagi "Use ▾ → Upscale" bir-bosishlik amallari uchun.
window.afTopazOps = window.afTopazOps || [];
window.afLoadTopazOps = function(){
  return studioGet('/api/studio/gen/ops').then(function(r){ window.afTopazOps=(r&&r.ops)||[]; return window.afTopazOps; }).catch(function(){ return window.afTopazOps; });
};
window.afTopazOpFor = function(cat){
  var ops=window.afTopazOps||[];
  if(cat==='video') return ops.filter(function(o){ return o.feature==='video-upscale'&&o.mode==='video'; })[0]||null;
  if(cat==='image'||!cat) return ops.filter(function(o){ return o.feature==='image-upscale'&&o.mode==='image'; })[0]||null;
  return null; // voice/sfx — enhance op yo'q
};
// Bir-bosishlik op: manba gen'ning YANGI imzolangan URL'i → params → imzolangan quote → gen → poll.
// Refund SERVER'da (money-zona tegilmagan): op muvaffaqiyatsiz bo'lsa kredit qaytadi.
window.afRunTopazOp = function(op, it, factor){
  if(!op||!it||!it.id) return;
  if(window.__afTopazBusy){ if(typeof showToast==='function')showToast('An enhance is already running — please wait','warn'); return; }
  window.__afTopazBusy=true;
  var mode=op.mode;
  if(typeof showToast==='function')showToast((op.opType==='removebg'?'Removing background…':'Upscaling…'),'info');
  studioGet('/api/studio/gen/'+encodeURIComponent(it.id)).then(function(g){
    var url=(g&&g.assets&&g.assets[0]&&g.assets[0].url)||(g&&g.asset&&g.asset.url)||it.url||'';
    if(!url) throw new Error('Could not load the source asset');
    var params=(mode==='video')?{sourceUrl:url,factor:(factor===4?4:2)}:{referenceUrl:url,referenceUrls:[url]};
    return Promise.all([
      studioPost('/api/studio/gen/cost-quote',{modelId:op.id,mode:mode,params:params,idempotencyKey:afUuid()}),
      studioPost('/api/studio/gen/sessions',{mode:mode,title:op.label})
    ]).then(function(arr){
      var quote=arr[0], sid=(arr[1]&&arr[1].id);
      var genParams=(quote&&quote.pricedParams)||params; // upscale: imzo SERVER canonical params ustidan
      return studioPost('/api/studio/gen',{sessionId:sid,mode:mode,modelId:op.id,prompt:op.label,params:genParams,price:quote.price,costQuoteSignature:quote.signature,idempotencyKey:afUuid()},60000);
    });
  }).then(function(res){
    if(!res||!res.jobId) throw new Error('Job was not created');
    if(res&&typeof res.creditsLeft==='number'&&typeof window.afSyncCredits==='function')window.afSyncCredits(res.creditsLeft);
    var jobId=res.jobId, tries=0;
    (function poll(){
      studioGet('/api/studio/gen/'+encodeURIComponent(jobId)).then(function(st){
        var s=st&&st.status;
        if(s==='done'||s==='completed'){ window.__afTopazBusy=false; if(typeof showToast==='function')showToast('Done — added to your recent generations','success'); if(typeof window.afRefreshRecentGrids==='function')window.afRefreshRecentGrids(); }
        else if(s==='failed'||s==='error'){ window.__afTopazBusy=false; if(typeof showToast==='function')showToast((typeof friendlyError==='function'?friendlyError(st):null)||'Enhance failed — your credits were refunded','error'); }
        else if(tries++<150){ setTimeout(poll,4000); }
        else { window.__afTopazBusy=false; if(typeof showToast==='function')showToast('Still processing — check your recent generations shortly','info'); }
      }).catch(function(){ if(tries++<150)setTimeout(poll,4000); else window.__afTopazBusy=false; });
    })();
  }).catch(function(err){
    window.__afTopazBusy=false;
    if(typeof showToast==='function')showToast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Enhance failed','error');
  });
};
/** /api/studio DELETE — auth bilan (gen natijani o'chirish). */
async function studioDelete(path){
  const res=await pubFetch(path,{method:'DELETE',headers:pubAuthHeaders()},20000);
  const t=await res.text();let d={};try{d=t?JSON.parse(t):{};}catch(e){d={};}
  if(!res.ok){const e=new Error((d&&d.error)||('HTTP '+res.status));e.status=res.status;e.code=d&&d.code;throw e;}
  return d;
}
/* P1: PATCH helper (sessiya/loyiha rename) — studioPost naqshida. */
async function studioPatch(path,body){
  const res=await pubFetch(path,{method:'PATCH',headers:Object.assign({'Content-Type':'application/json'},pubAuthHeaders()),body:JSON.stringify(body||{})},20000);
  const t=await res.text();let d={};try{d=t?JSON.parse(t):{};}catch(e){d={};}
  if(!res.ok){const e=new Error((d&&d.error)||('HTTP '+res.status));e.status=res.status;e.code=d&&d.code;throw e;}
  return d;
}

/* F-02 tozalash: eski (o'lik) mf-/ai V4 generatsiya avlodi olib tashlandi — jonli oqim .axroot (Script C-F). */
/** URL'ni tmp'ga yuklab → Premiere'ga import (kind: image/video/audio). */
async function aiImportMedia(url,kind,extRaw){
  if(!url){if(typeof showToast==='function')showToast('No result to import','warning');return;}
  if(!IS_CEP||!csInterface){if(typeof showToast==='function')showToast('Import only works inside Premiere Pro','info');return;}
  try{
    if(typeof showToast==='function')showToast('Downloading…','info');
    const ext='.'+((extRaw||(kind==='image'?'png':kind==='video'?'mp4':'mp3')).replace(/^\./,''));
    const tmp=await aiDownloadToTemp(url,ext);
    const raw=await new Promise(res=>csInterface.evalScript('importMediaFromPath('+JSON.stringify(tmp)+')',r=>res(r||'')));
    // host structured JSON {ok,addedToComp,compName,item} qaytaradi; eski "ok:" string'ga ham moslik
    let r=null;try{r=raw?JSON.parse(raw):null;}catch(e){r=(String(raw).indexOf('ok')===0)?{ok:true}:null;}
    if(r&&r.ok){
      const msg=r.addedToComp?('Imported — added to '+(r.compName?('"'+r.compName+'" '):'')+'sequence'):'Imported to Premiere (Project panel)';
      if(typeof showToast==='function')showToast(msg,'success');
    }else{
      // ok:false → aniq sabab; raw bo'sh/parse fail bo'lsa generic
      const reason=(r&&r.reason)?r.reason:(raw?String(raw):'no result returned');
      if(typeof showToast==='function')showToast('Import error: '+reason,'error');
    }
  }catch(e){
    if(typeof showToast==='function')showToast('Import error: '+((e&&e.message)||e),'error');
  }
}

/** URL (yoki data:) → tmp fayl. data: lokalda dekod; aks holda catalog downloaderi. */
function aiDownloadToTemp(url,ext){
  return new Promise((resolve,reject)=>{
    try{
      const fs=__ffRequire('fs'),path=__ffRequire('path'),os=__ffRequire('os');
      let dir=os.tmpdir();
      try{if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.downloadDir){dir=AssetFlowCatalog.downloadDir()||dir;}}catch(e){}
      const dest=path.join(dir,'assetflow_ai_'+Date.now()+ext);
      if(url.indexOf('data:')===0){
        const b64=url.slice(url.indexOf(',')+1);
        fs.writeFileSync(dest,Buffer.from(b64,'base64'));
        resolve(dest);return;
      }
      if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.downloadUrlToFile){
        AssetFlowCatalog.downloadUrlToFile(url,dest,null,{}).then(()=>resolve(dest)).catch(reject);
      }else{reject(new Error('Download module not available'));}
    }catch(e){reject(e);}
  });
}
/* F-02 tozalash: o'lik aiRenderCards/aiInit/aiSoon olib tashlandi (aiComposer DOM'da yo'q edi). */
// Katalog "AI kontent" toggle — vizual holat (filtr mantig'i tegilmaydi, "tez orada").
let __catAiOn=false;
function toggleCatalogAi(btn){
  __catAiOn=!__catAiOn;
  btn.classList.toggle('on',__catAiOn);
  if(typeof showToast==='function')showToast(__catAiOn?'AI content filter — coming soon':'AI content filter turned off','info');
}
// Filtrlar bottom-sheet (a2) — ochish/yopish. Filtr mantig'i (selectCategory / selectOrientFilter /
// selectResFilter / toggleCatalogAi / selectSort / clearAllFilters) o'zgarmaydi; faqat markup ko'chdi.
function toggleFilterPanel(){
  const sheet=document.getElementById('filterSheet');
  if(!sheet)return;
  if(sheet.classList.contains('open'))closeFilterSheet();
  else openFilterSheet();
}
function openFilterSheet(){
  const sheet=document.getElementById('filterSheet');
  if(!sheet)return;
  buildFilterSheetCats();
  syncFilterSheet();
  sheet.classList.add('open');
  const btn=document.getElementById('filterToggleBtn');
  if(btn)btn.classList.add('active');
}
function closeFilterSheet(){
  const sheet=document.getElementById('filterSheet');
  if(!sheet)return;
  sheet.classList.remove('open');
  const btn=document.getElementById('filterToggleBtn');
  if(btn)btn.classList.remove('active');
}
window.toggleFilterPanel=toggleFilterPanel;
window.openFilterSheet=openFilterSheet;
window.closeFilterSheet=closeFilterSheet;
// Esc — ochiq bo'lsa sheet'ni yopadi
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  const s=document.getElementById('filterSheet');
  if(s&&s.classList.contains('open')){ e.stopPropagation(); closeFilterSheet(); }
});

/* ===== MOGRT_PACK ko'p-fayl tanlash bottom-sheet (a4) =====
   Zip ichida bir nechta .mogrt bo'lsa (applyMogrtItems) — tanlab, har birini
   MAVJUD per-entry extract+import yo'lidan (importSceneWithMode → extractMogrtItem)
   ketma-ket import qiladi va STATE-1 progress kartasini haydaydi. Bitta sahna va
   "Hammasini import" (downloadAll) yo'llari o'zgarmaydi. */
const MGS_CHECK='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
let __mogrtPackKey='', __mogrtItems=[], __mogrtSel=new Set();
function openMogrtSheet(packKey,items){
  __mogrtPackKey=packKey;
  __mogrtItems=(items||[]).slice();
  __mogrtSel=new Set(__mogrtItems.map((_,i)=>i));   // default: barchasi tanlangan
  const t=document.getElementById('mogrtSheetTitle');
  if(t)t.textContent='MOGRT_PACK — '+__mogrtItems.length+' files';
  renderMogrtSheet();
  document.getElementById('mogrtSheet')?.classList.add('open');
}
function renderMogrtSheet(){
  const list=document.getElementById('mogrtSheetList');
  if(!list)return;
  list.innerHTML=__mogrtItems.map((it,i)=>{
    const on=__mogrtSel.has(i);
    const thumb=it.thumbPng
      ? `background-image:url('${escHtml(it.thumbPng)}')`
      : `background:${pd3Grad(it.name||('m'+i))}`;
    const sizeTxt=(it.size>0)?`<span class="mgs-size">${(it.size/1048576).toFixed(1)} MB</span>`:'';
    return `<div role="button" tabindex="0" type="button" class="mgs-row${on?' on':''}" data-idx="${i}" onclick="toggleMogrtRow(${i})">`
      +`<span class="mgs-chk">${MGS_CHECK}</span>`
      +`<span class="mgs-thumb" style="${thumb}"></span>`
      +`<span class="mgs-name">${escHtml(it.name||'')}</span>`
      +sizeTxt
      +`</div>`;
  }).join('');
  updateMogrtFooter();
}
function updateMogrtFooter(){
  const n=__mogrtSel.size;
  const lbl=document.getElementById('mogrtSheetImportLbl');
  if(lbl)lbl.textContent='Import '+n+' scenes';
  const imp=document.getElementById('mogrtSheetImport');
  if(imp)imp.disabled=(n===0);
}
function toggleMogrtRow(i){
  if(__mogrtSel.has(i))__mogrtSel.delete(i); else __mogrtSel.add(i);
  const row=document.querySelector('#mogrtSheetList .mgs-row[data-idx="'+i+'"]');
  if(row)row.classList.toggle('on',__mogrtSel.has(i));
  updateMogrtFooter();
}
function toggleMogrtAll(){
  if(__mogrtSel.size===__mogrtItems.length)__mogrtSel.clear();
  else __mogrtSel=new Set(__mogrtItems.map((_,i)=>i));
  renderMogrtSheet();
}
function closeMogrtSheet(){
  document.getElementById('mogrtSheet')?.classList.remove('open');
}
async function importSelectedMogrts(){
  const pack=packs[__mogrtPackKey];
  const idxs=[...__mogrtSel].sort((a,b)=>a-b);
  if(!pack||!idxs.length)return;
  if(typeof AssetFlowAccount!=='undefined'&&!AssetFlowAccount.isLoggedIn()){ showLoginRequired(); return; }
  const items=idxs.map(i=>__mogrtItems[i]);
  closeMogrtSheet();
  currentPackName=__mogrtPackKey;
  const mode=selectedDropMode||'project';
  for(const it of items){
    // Merge natijasidan mos sahna (mogrtPath barqaror kalit); topilmasa itemdan quramiz
    let scene=(pack.scenes||[]).find(s=>s.mogrtPath&&s.mogrtPath===it.path);
    if(!scene)scene={n:it.name,aeComp:'',meta:'MOGRT',ico:pack.ico||'✦',bg:pack.bg,mogrtPath:it.path,
      preview:it.thumbMp4||it.thumbPng||undefined,previewKind:(!it.thumbMp4&&it.thumbPng)?'image':undefined};
    await importSceneWithMode(pack,scene,__mogrtPackKey,mode);
  }
}
window.openMogrtSheet=openMogrtSheet;
window.closeMogrtSheet=closeMogrtSheet;
window.toggleMogrtRow=toggleMogrtRow;
window.toggleMogrtAll=toggleMogrtAll;
window.importSelectedMogrts=importSelectedMogrts;
// Esc — MOGRT sheet ochiq bo'lsa yopadi
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  const s=document.getElementById('mogrtSheet');
  if(s&&s.classList.contains('open')){ e.stopPropagation(); closeMogrtSheet(); }
});

/* ===== Limit holatlari bottom-sheet (a5) — Free oylik limit + PRO qulf =====
   Import gate to'sganda (server signali) toast o'rniga shu sheet'lar ochiladi.
   Faqat prezentatsiya — server enforcement / atomik gate / import mantig'iga tegmaydi.
   CTA'lar mavjud window.startProCheckout'ni chaqiradi (Stripe o'chiq bo'lsa info toast). */
function afDaysToMonthReset(){
  // Server oylik hisoblagichni keyingi oy boshida tiklaydi (monthResetAt=start).
  // Reset sanasi serializatsiyada yo'q → joriy oy oxirigacha qolgan kunlarni hisoblaymiz.
  try{
    const now=new Date();
    const next=new Date(now.getFullYear(),now.getMonth()+1,1,0,0,0,0);
    return Math.max(1,Math.ceil((next-now)/86400000));
  }catch(e){ return null; }
}
function openLimitSheet(kind){
  // P21: sheet endi DOWNLOAD yoki IMPORT limitini aniq ko'rsatadi (ikkalasi ham
  // 403 LIMIT_REACHED, lekin qaysi call 403 qildi — shu kontekst kind'ni belgilaydi).
  const isImport=kind==='import';
  const u=(typeof homeCachedUser==='function')?homeCachedUser():null;
  const lim=isImport
    ? ((u&&u.limits&&u.limits.importLimit!=null)?u.limits.importLimit:10)
    : ((u&&u.limits&&u.limits.downloadLimit!=null)?u.limits.downloadLimit:15);
  const used=isImport
    ? ((u&&u.importsMonth!=null)?u.importsMonth:lim)
    : ((u&&u.downloadsMonth!=null)?u.downloadsMonth:lim);
  const titleEl=document.getElementById('limitTitle');
  if(titleEl)titleEl.textContent=isImport?'Monthly import limit reached':'Monthly download limit reached';
  const subEl=document.getElementById('limitSub');
  if(subEl){
    let html='The Free plan includes '+lim+(isImport?' imports':' downloads')+' per month.';
    const days=afDaysToMonthReset();
    if(days!=null) html+='<br>'+days+' days until it resets.';
    subEl.innerHTML=html;
  }
  const cntEl=document.getElementById('limitCount');
  if(cntEl)cntEl.textContent=used+' / '+lim;
  const fillEl=document.getElementById('limitFill');
  if(fillEl)fillEl.style.width=((lim>0)?Math.min(100,Math.round(used/lim*100)):100)+'%';
  document.getElementById('limitSheet')?.classList.add('open');
}
function closeLimitSheet(){ document.getElementById('limitSheet')?.classList.remove('open'); }
function openProSheet(name){
  const t=String(name||'').trim()||'This template';
  const subEl=document.getElementById('proSub');
  if(subEl)subEl.textContent='"'+t+'" can only be imported on the Pro plan.';   // textContent = XSS-safe
  document.getElementById('proSheet')?.classList.add('open');
}
function closeProSheet(){ document.getElementById('proSheet')?.classList.remove('open'); }
function limitUpgrade(){
  closeLimitSheet(); closeProSheet();
  if(typeof window.startProCheckout==='function') window.startProCheckout();
  else if(typeof showToast==='function') showToast('Payments aren’t available yet — contact an admin','info');
}
window.openLimitSheet=openLimitSheet;
window.closeLimitSheet=closeLimitSheet;
window.openProSheet=openProSheet;
window.closeProSheet=closeProSheet;
window.limitUpgrade=limitUpgrade;
// Esc — limit / PRO sheet ochiq bo'lsa yopadi
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  const l=document.getElementById('limitSheet');
  if(l&&l.classList.contains('open')){ e.stopPropagation(); closeLimitSheet(); return; }
  const p=document.getElementById('proSheet');
  if(p&&p.classList.contains('open')){ e.stopPropagation(); closeProSheet(); }
});

// §D (P31) — web pariteti: markaziy overlay modallar (.afspov: nameModal, project picker)
// Escape bilan yopiladi (avval faqat X/Cancel/tashqi-klik bor edi). Eng ustki ochiqni yopamiz.
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  var ovs=document.querySelectorAll('.afspov.on');
  if(ovs.length){ e.stopPropagation(); ovs[ovs.length-1].classList.remove('on'); }
});

// Bo'lim segmenti — mavjud #envScope + onEnvScopeChange yo'lidan boradi (nav almashadi).
function afFilterSheetScope(val){
  const s=document.getElementById('envScope');
  if(s){ s.value=val; if(typeof onEnvScopeChange==='function')onEnvScopeChange(s); }
  else if(typeof applyNavSwitch==='function'){ applyNavSwitch(val); }
  if(val==='ai'){ closeFilterSheet(); return; }  // AI — alohida sahifa
  syncFilterSheet();
}
window.afFilterSheetScope=afFilterSheetScope;

// Saralash — grid sarlavhasidagi mavjud #sortMenu bilan sinxron (selectSort qayta ishlatiladi).
function afFilterSheetSort(key){
  const item=document.querySelector('#sortMenu .dd-item[data-sort="'+key+'"]');
  if(item&&typeof selectSort==='function'){
    const label=(item.textContent||'').replace('✓','').trim();
    selectSort(item,key,label);
  }
  syncFilterSheet();
}
window.afFilterSheetSort=afFilterSheetSort;

// Kategoriya chiplari — navSubs'dan dinamik (buildCategoryChips bilan bir xil manba + selectCategory).
let __fsheetCatNav=null;
function buildFilterSheetCats(){
  const wrap=document.getElementById('fsheetCats');
  if(!wrap||typeof navSubs==='undefined')return;
  const labels=navSubs[currentNav]||navSubs.video||[];
  wrap.innerHTML=labels.map(function(label){
    const slug=catSlug(label);
    const disp=slug==='all'?'All':label;
    const sj=String(slug).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const on=slug===currentSub;
    return '<div role="button" tabindex="0" type="button" class="fsheet-catchip'+(on?' on':'')+'" data-slug="'+escHtml(slug)+
      '" onclick="selectCategory(this,\''+sj+'\')">'+escHtml(disp)+'</div>';
  }).join('');
  __fsheetCatNav=currentNav;
}
window.buildFilterSheetCats=buildFilterSheetCats;

// Sheet ichidagi barcha kontrollarni joriy filtr holatiga moslaydi (render() funnelidan chaqiriladi).
function syncFilterSheet(){
  const sheet=document.getElementById('filterSheet');
  if(!sheet)return;
  if(__fsheetCatNav!==currentNav)buildFilterSheetCats();
  sheet.querySelectorAll('#fsheetCats .fsheet-catchip').forEach(function(c){
    c.classList.toggle('on',(c.dataset.slug||'all')===(currentSub||'all'));
  });
  sheet.querySelectorAll('#fsheetFmt .fsheet-fchip').forEach(function(c){
    c.classList.toggle('on',(c.dataset.filter||'all')===(currentOrient||'all'));
  });
  sheet.querySelectorAll('#fsheetQual .fsheet-fchip').forEach(function(c){
    c.classList.toggle('on',(c.dataset.filter||'all')===(currentRes||'all'));
  });
  sheet.querySelectorAll('#fsheetScope .fsheet-segi').forEach(function(s){
    s.classList.toggle('on',s.dataset.scope===currentNav);
  });
  sheet.querySelectorAll('#fsheetSort .fsheet-sortrow').forEach(function(r){
    r.classList.toggle('on',(r.dataset.sort||'relevant')===(currentSort||'relevant'));
  });
  const ai=document.getElementById('catAiToggle');
  if(ai)ai.classList.toggle('on',!!(typeof __catAiOn!=='undefined'&&__catAiOn));
  // LUTs / Graphics — format+sifat qo'llanmaydi (applyNavSwitch is-hidden bilan bir xil)
  const hideFmt=currentNav==='luts'||currentNav==='graphics';
  const fmtSec=document.getElementById('fsheetFmtSec');if(fmtSec)fmtSec.style.display=hideFmt?'none':'';
  const qualCol=document.getElementById('fsheetQualCol');if(qualCol)qualCol.style.display=hideFmt?'none':'';
  const btn=document.getElementById('fsheetApply');
  if(btn){
    let n=0;try{ n=(typeof getGridAssets==='function')?getGridAssets().length:0; }catch(e){}
    btn.textContent='Show — '+n+' templates';
  }
}
window.syncFilterSheet=syncFilterSheet;

/* ============================================================
   TEMA TIZIMI — 3 ta tema: noir / neon / cold (BATCH8, production
   platformasi bilan tenglashtirildi). html[data-theme] o'zgaradi →
   barcha tokenlar (va shu sababli barcha ekran) yangilanadi. Tanlov
   prefs'ga (merge) saqlanadi, boot'da tiklanadi.
   ============================================================ */
const AF_THEMES=['noir','neon','cold'];
// Eski saqlangan tema nomlarini yangisiga ko'chirish (migratsiya)
const AF_THEME_MIGRATE={standart:'noir','liquid-glass':'neon','light-glass':'cold'};
function afNormTheme(name){
  if(AF_THEME_MIGRATE[name])name=AF_THEME_MIGRATE[name];
  return (AF_THEMES.indexOf(name)>=0)?name:'noir';
}
function afGetPrefs(){ try{ return JSON.parse(localStorage.getItem('af.prefs')||'{}')||{}; }catch(e){ return {}; } }
function afSavePrefs(patch){ try{ const p=afGetPrefs(); Object.assign(p,patch); localStorage.setItem('af.prefs',JSON.stringify(p)); }catch(e){} }
// P12 — model pin (mahkamlash): image (.axig) va video (.axvg) kompozerlari alohida IIFE (Section C
// darsi — biri ichida e'lon qilingan funksiya ikkinchisiga ko'rinmaydi), shu bois umumiy pin
// mantiqi ATAYLAB shu haqiqiy top-level qamrovda — ikkalasi ham af.prefs.pinnedModels'ni ishlatadi.
var PIN_SVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 21s-7-7.1-7-12a7 7 0 0 1 14 0c0 4.9-7 12-7 12Z"></path><circle cx="12" cy="9" r="2.3"></circle></svg>';
/* ══ SC_16: umumiy "Use ▾" langar menyusi — gen kartalari uchun ══
   Tugma getBoundingClientRect'iga fixed langar; chekkada yuqoriga/ichkariga flip;
   tashqi bosish / Esc / scroll'da yopiladi. Menyu FAQAT aniq bosishda ochiladi. */
var __afUseMenuEl=null;
function afUseMenuClose(){
  if(__afUseMenuEl){ try{ __afUseMenuEl.remove(); }catch(e){} __afUseMenuEl=null; }
  document.removeEventListener('click',afUseMenuClose,true);
  document.removeEventListener('keydown',__afUseMenuEsc,true);
  window.removeEventListener('scroll',afUseMenuClose,true);
}
function __afUseMenuEsc(e){ if(e.key==='Escape'||e.keyCode===27)afUseMenuClose(); }
function afUseMenuOpen(btn,items){
  afUseMenuClose();
  if(!btn||!btn.getBoundingClientRect||!items||!items.length)return;
  var r=btn.getBoundingClientRect(); if(!r.width&&!r.height)return;
  var m=document.createElement('div'); m.className='af-usemenu';
  items.forEach(function(it){
    var row=document.createElement('div'); row.className='af-usemi'+(it.danger?' danger':'');
    row.innerHTML='<span class="mic">'+(it.ic||'')+'</span><span class="ml"></span>';
    row.querySelector('.ml').textContent=it.label;
    row.addEventListener('click',function(e){ e.stopPropagation(); afUseMenuClose(); try{ it.fn(); }catch(err){} });
    m.appendChild(row);
  });
  document.body.appendChild(m); __afUseMenuEl=m;
  var vw=window.innerWidth,vh=window.innerHeight,pad=8,mw=210;
  var mh=Math.min(m.offsetHeight||260,Math.round(vh*0.62));
  var left=Math.min(Math.max(r.left,pad),Math.max(pad,vw-mw-pad));
  var top=r.bottom+4;
  if(top+mh>vh-pad)top=r.top-mh-4;                       // yuqoriga flip
  if(top<pad)top=Math.max(pad,Math.min(r.bottom+4,vh-mh-pad)); // clamp — langar yaqin qoladi
  m.style.left=left+'px'; m.style.top=top+'px'; m.style.maxHeight=mh+'px';
  setTimeout(function(){
    document.addEventListener('click',afUseMenuClose,true);
    document.addEventListener('keydown',__afUseMenuEsc,true);
    window.addEventListener('scroll',afUseMenuClose,true);
  },0);
}
window.afUseMenuOpen=afUseMenuOpen;
function afIsModelPinned(id){ var p=(afGetPrefs().pinnedModels)||[]; return p.indexOf(String(id))>=0; }
function afToggleModelPin(id){
  id=String(id);
  var p=((afGetPrefs().pinnedModels)||[]).slice(); var i=p.indexOf(id);
  if(i>=0)p.splice(i,1); else p.push(id);
  afSavePrefs({pinnedModels:p});
  return i<0; // true = endi pinlangan
}
// Mahkamlangan modellar ro'yxat boshida (ular orasidagi tartib saqlanadi — stable sort)
function afSortPinnedFirst(list){
  var p=(afGetPrefs().pinnedModels)||[];
  return (list||[]).slice().sort(function(a,b){
    var pa=p.indexOf(String(a.id))>=0, pb=p.indexOf(String(b.id))>=0;
    return pa===pb?0:(pa?-1:1);
  });
}
// Section F (P13) — model.brand nishoni: ilgari .axig ICHIDA edi (faqat subtitle matni uchun), endi
// haqiqiy top-level (.axvg ham ishlatadi) VA endi renderModelSheet/renderVgModelSheet ichida haqiqiy
// ikonka sifatida chiziladi (web'dagi rangli glyph nishon bilan bir xil rang — brandBadge()).
var BRAND_SVG={
  openai:'<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="#10a37f"/><circle cx="11" cy="11" r="5.5" fill="none" stroke="#fff" stroke-width="2.2"/></svg>',
  google:'<svg width="22" height="22" viewBox="0 0 22 22"><text x="11" y="16.5" text-anchor="middle" font-size="16" font-weight="900" fill="#4285F4" font-family="Arial,sans-serif">G</text></svg>',
  bytedance:'<svg width="22" height="22" viewBox="0 0 22 22"><text x="11" y="15" text-anchor="middle" font-size="9.5" font-weight="900" fill="#5e9fe8" font-family="Arial,sans-serif">BD</text></svg>',
  bfl:'<svg width="22" height="22" viewBox="0 0 22 22"><text x="11" y="15" text-anchor="middle" font-size="8" font-weight="900" fill="currentColor" font-family="Arial,sans-serif">BFL</text></svg>',
  elevenlabs:'<svg width="22" height="22" viewBox="0 0 22 22"><text x="11" y="15" text-anchor="middle" font-size="7.5" font-weight="900" fill="#e8e8e8" font-family="Arial,sans-serif">11L</text></svg>',
  topaz:'<svg width="22" height="22" viewBox="0 0 22 22"><text x="11" y="15" text-anchor="middle" font-size="8" font-weight="900" fill="#a78bfa" font-family="Arial,sans-serif">TZ</text></svg>'
};
var BRAND_LABEL={openai:'OpenAI',google:'Google',bytedance:'ByteDance',bfl:'Black Forest Labs',elevenlabs:'ElevenLabs',topaz:'Topaz'};
// model row'ga qo'yiladigan kichik rangli nishon (mrowb HTML'iga to'g'ridan-to'g'ri qo'shiladi)
function brandBadgeHtml(brand){
  if(!brand||!BRAND_SVG[brand])return '';
  return '<span class="mbrand" title="'+(BRAND_LABEL[brand]||brand)+'">'+BRAND_SVG[brand]+'</span>';
}
function markActiveTheme(name){
  document.querySelectorAll('.theme-opt').forEach(b=>b.classList.toggle('active', b.dataset.themeVal===name));
}
function setTheme(name){
  name=afNormTheme(name);
  document.documentElement.setAttribute('data-theme',name);
  afSavePrefs({theme:name});       // prefs'ga merge
  markActiveTheme(name);
}
function restoreTheme(){
  const t=afNormTheme(afGetPrefs().theme);   // default: noir (+ eski nomlarni ko'chiradi)
  document.documentElement.setAttribute('data-theme',t);
  markActiveTheme(t);
}
// Boot: saqlangan temani tiklash (birinchi bo'yashdan oldin — flash yo'q)
try{ restoreTheme(); }catch(e){}
// Orqaga moslik: eski nom hali chaqirilsa ham xato bermasin
function aiComingSoon(label){if(typeof showToast==='function')showToast((label||'AI')+' — coming soon','info');}

// Qidiruv — har klaviatura bosilishida emas, 300ms jim turgach render qilinadi
let __searchDebounce=null;
document.getElementById('searchInput').addEventListener('input',function(){
  const val=this.value.toLowerCase();
  if(__searchDebounce)clearTimeout(__searchDebounce);
  // P1 #15 — qidiruv SERVER tomonda (butun baza); 300ms debounce spam'ni to'sadi
  __searchDebounce=setTimeout(function(){currentSearch=val;reloadServerBrowse();},300);
});

function runSearch(){
  const si=document.getElementById('searchInput');
  if(!si)return;
  if(__searchDebounce){clearTimeout(__searchDebounce);__searchDebounce=null;}
  currentSearch=si.value.toLowerCase();
  si.focus();
  reloadServerBrowse();
}

// P1 #15/#18 — grid scroll: (1) virtualizatsiya oynasini yangilaydi (faqat ko'rinadigan
// kartalar DOM'da), (2) pastga yaqinlashganda server keyingi sahifasini qo'shadi
// (loadMoreBrowse — bitta faol so'rov, done bo'lsa to'xtaydi). rAF bilan throttle.
(function(){
  const sc=document.querySelector('.scroll-area');
  if(!sc)return;
  let __scRaf=0;
  sc.addEventListener('scroll',function(){
    if(__scRaf)return;
    __scRaf=requestAnimationFrame(function(){
      __scRaf=0;
      try{ if(typeof updateGridWindow==='function') updateGridWindow(); }catch(e){}
      // Load-more faqat assets browse'da (favorites/downloaded/AI emas)
      if(currentPage!=='assets'||currentNav==='ai')return;
      if(typeof AssetFlowCatalog==='undefined'||!AssetFlowCatalog.browseHasMore)return;
      if(!AssetFlowCatalog.browseHasMore()||AssetFlowCatalog.isBrowseLoading())return;
      if((sc.scrollHeight-(sc.scrollTop+sc.clientHeight))<700){
        AssetFlowCatalog.loadMoreBrowse(catalogFilters()).catch(function(){});
      }
    });
  },{passive:true});
})();

function closeAllDropdowns(){
  document.querySelectorAll('.env-filter-bar .dd-menu').forEach(x=>x.classList.remove('open'));
}

function toggleDrop(id,e){
  if(e){
    e.preventDefault();
    e.stopPropagation();
  }
  const drop=document.getElementById(id);
  if(!drop)return;
  const menu=drop.querySelector('.dd-menu');
  const btn=drop.querySelector('.env-pill')||drop.querySelector('[role="button"]');
  if(!menu||!btn)return;
  const open=menu.classList.contains('open');
  closeAllDropdowns();
  if(!open){
    menu.classList.add('open');
    btn.classList.add('open');
  }
}

function initEnvFilterUi(){
  const bar=document.querySelector('.env-filter-bar');
  if(!bar||bar.dataset.dropBound)return;
  bar.dataset.dropBound='1';

  bar.addEventListener('click',e=>{
    const pill=e.target.closest('.dropdown > button');
    if(pill&&bar.contains(pill)){
      e.preventDefault();
      e.stopPropagation();
      const dropId=pill.parentElement?.id;
      if(dropId) toggleDrop(dropId,e);
      return;
    }

    const item=e.target.closest('.dd-item');
    if(!item||!bar.contains(item))return;
    e.preventDefault();
    e.stopPropagation();
    const menu=item.closest('.dd-menu');
    if(!menu)return;

    if(menu.id==='catMenu'){
      selectCategory(item,item.dataset.slug||'all');
      return;
    }
    const filter=item.dataset.filter;
    if(menu.id==='orientMenu'){
      selectOrientFilter(item,filter,ORIENT_LABELS[filter]||'All');
      return;
    }
    if(menu.id==='resMenu'){
      selectResFilter(item,filter,RES_LABELS[filter]||'All');
      return;
    }
    if(menu.id==='sortMenu'){
      const key=item.dataset.sort||'relevant';
      const label=(item.textContent||'').replace('✓','').trim();
      selectSort(item,key,label);
    }
  });

  document.addEventListener('click',e=>{
    if(e.target.closest('.env-filter-bar'))return;
    closeAllDropdowns();
  });
  // SC_48: lib-top ⋯ menyusini tashqariga bosilganda yopamiz
  document.addEventListener('click',e=>{
    if(e.target.closest('.lib-morewrap'))return;
    document.querySelectorAll('.lib-menu.on').forEach(m=>m.classList.remove('on'));
  });
}

window.toggleDrop=toggleDrop;
window.closeAllDropdowns=closeAllDropdowns;
function selectSort(el,key,label){
  currentSort=key||'relevant';
  document.getElementById('sortLabel').textContent=label||'Sort';
  document.querySelectorAll('#sortMenu .dd-item').forEach(item=>{
    item.classList.toggle('selected',item===el);
  });
  closeAllDropdowns();
  reloadServerBrowse(); // P1 #15 — saralash server tomonda
}
// #144 (PX7): katalog kartasi va AI natija kartasi (.rc) o'rtasidagi nomuvofiqlik.
// Katalog kartasi `draggable="true"` bilan chizilardi va `cursor:grab` ko'rsatardi, AI natija
// kartasi esa faqat bosiladi. Ammo CEP paneldan Premiere Pro'ga HTML5 drag ISHLAMAYDI — yagona
// tashlash joyi brauzer QA saxnasidagi `#dropZone` edi (#143 dan keyin u reliz paketida yo'q).
// Ya'ni mijozda "tortish mumkin" degan YOLG'ON affordans turardi, ustiga ustak u bosish bilan
// bir xil ishni (`openPack`) qilardi. Endi: drag faqat haqiqiy tashlash joyi bo'lganda ulanadi,
// aks holda ikkala grid ham bir xil kontrakt — bosish / Enter / Space.
function initDrag(){
  const hasDrop=!!document.getElementById('dropZone');
  document.querySelectorAll('.card[data-name]').forEach(card=>{
    if(!hasDrop){ card.removeAttribute('draggable'); return; }
    card.draggable=true;
    card.ondragstart=e=>{card.classList.add('dragging');document.getElementById('ghostName').textContent=card.dataset.name;
      document.getElementById('dragGhost').classList.add('visible');
      e.dataTransfer.setData('text/plain',JSON.stringify({name:card.dataset.name,ico:card.dataset.ico}));};
    card.ondragend=()=>{card.classList.remove('dragging');document.getElementById('dragGhost').classList.remove('visible');};
  });
}
// #144 (PX7): Enter/Space kartani ochadi — .rc kartasidagi klaviatura xatti-harakati bilan bir xil.
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' '&&e.keyCode!==13&&e.keyCode!==32)return;
  const c=e.target;
  if(!c||!c.classList||!c.classList.contains('card')||!c.dataset||!c.dataset.name)return;
  e.preventDefault();
  openPack(c.dataset.name);
});

/* #145 (PX8) — OFLAYN / ULANISH ANIQLASH.
 *
 * MUAMMO: panelda ulanish holati umuman kuzatilmasdi. Internet uzilganda har bir ekran o'z
 * xom xatosini ("Failed to fetch", bo'sh grid, abadiy skeleton) ko'rsatardi; foydalanuvchi
 * buni plagin buzilgan deb tushunardi. `navigator.onLine` hech qayerda ishlatilmagan edi.
 *
 * YECHIM: bitta manba — `afNet`. Uch signal bilan boqiladi:
 *   1) brauzerning `offline`/`online` hodisalari (OS interfeysi darajasi),
 *   2) HAR QANDAY `fetch` ning tarmoq darajasidagi xatosi (TypeError — HTTP status EMAS),
 *   3) `/livez` probe'i (arzon, rate-limitdan ozod) — "haqiqatan yetib bormayaptimi" deb
 *      TASDIQLAYDI. `navigator.onLine` CEP ichida yolg'on "true" berishi mumkin, shuning
 *      uchun bayroqqa emas, probe natijasiga ishonamiz.
 *
 * Tiklanganda `af:online` hodisasi chiqadi — ekranlar o'zini qayta yuklashi mumkin.
 * Boot'da probe YUBORILMAYDI: birinchi haqiqiy so'rov baribir signal beradi.
 */
window.afNet=(function(){
  var bar=null,txt=null,btn=null,offline=false,checking=false,timer=null;
  function els(){
    if(bar)return true;
    bar=document.getElementById('offBar'); txt=document.getElementById('offBarText'); btn=document.getElementById('offBarRetry');
    if(btn)btn.addEventListener('click',function(){ check(); });
    return !!bar;
  }
  function render(){
    if(!els())return;
    bar.classList.toggle('on',offline);
    if(txt)txt.textContent=(navigator.onLine===false)
      ? "You're offline — check your network connection"
      : "Can’t reach FrameFlow — the server may be waking up";
    if(btn){ btn.disabled=!!checking; btn.textContent=checking?'Checking…':'Retry'; }
  }
  function set(v){
    var was=offline; offline=!!v; render();
    if(was===offline)return;
    try{ document.dispatchEvent(new CustomEvent(offline?'af:offline':'af:online')); }catch(e){}
    if(offline){
      // Avtomatik qayta tekshirish — foydalanuvchi "Retry" bosishini kutmaymiz.
      if(!timer)timer=setInterval(function(){ check(); },20000);
    } else if(timer){ clearInterval(timer); timer=null; }
  }
  /** Server yetib boradimi? true = yetadi. Probe FAQAT tarmoq darajasini o'lchaydi. */
  function check(){
    if(checking)return Promise.resolve(!offline);
    checking=true; render();
    var base;
    try{ base=(typeof pubApiBase==='function')?pubApiBase():''; }catch(e){ base=''; }
    if(!base){ checking=false; set(navigator.onLine===false); return Promise.resolve(!offline); }
    var opts={cache:'no-store'},ctrl=null;
    if(typeof AbortController!=='undefined'){ ctrl=new AbortController(); opts.signal=ctrl.signal; setTimeout(function(){ try{ctrl.abort();}catch(e){} },8000); }
    return _fetch(base+'/livez',opts).then(function(){ checking=false; set(false); return true; })
      .catch(function(){ checking=false; set(true); return false; });
  }
  /** Tarmoq darajasidagi xato (HTTP 4xx/5xx EMAS) — probe bilan tasdiqlaymiz. */
  function noteFailure(err){
    var m=(err&&err.message)||String(err||'');
    if(err&&err.name==='AbortError')return;                     // foydalanuvchi/timeout bekori
    if(!/Failed to fetch|NetworkError|ERR_|ENOTFOUND|ECONNREFUSED|Load failed|network/i.test(m))return;
    check();
  }
  // Global `fetch` o'ramasi — xato AYNAN o'zgarmagan holda qayta uloqtiriladi (chaqiruvchi
  // mantig'i tegilmaydi), biz faqat kuzatamiz.
  var _fetch=window.fetch&&window.fetch.bind(window);
  if(_fetch){
    window.fetch=function(){
      return _fetch.apply(null,arguments).then(function(r){ if(offline)set(false); return r; },
        function(e){ noteFailure(e); throw e; });
    };
  }
  window.addEventListener('offline',function(){ set(true); });
  window.addEventListener('online',function(){ check(); });
  if(navigator.onLine===false)set(true); else render();
  return { isOffline:function(){ return offline; }, check:check, noteFailure:noteFailure };
})();

document.addEventListener('dragover',e=>{const g=document.getElementById('dragGhost');if(g.classList.contains('visible')){g.style.left=(e.clientX+14)+'px';g.style.top=(e.clientY+14)+'px';}});
// #143 (PX6): drop-zone endi FAQAT dev QA saxnasida mavjud (_dev-ae-stage.html) —
// mijoz paketida element yo'q, shuning uchun null-guard.
const dz=document.getElementById('dropZone');
if(dz){
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});
  dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');
    try{const d=JSON.parse(e.dataTransfer.getData('text/plain'));openPack(d.name);}catch(err){}});
}

let resizing=false,resizeDir='',startX,startY,startW,startH;
document.querySelectorAll('.rh').forEach(h=>h.onmousedown=e=>{
  e.preventDefault();resizing=true;resizeDir=h.dataset.dir;startX=e.clientX;startY=e.clientY;
  const c=document.getElementById('container');startW=c.offsetWidth;startH=c.offsetHeight;
  document.body.style.cursor=getComputedStyle(h).cursor;
});
document.onmousemove=e=>{
  if(!resizing)return;const c=document.getElementById('container'),dx=e.clientX-startX,dy=e.clientY-startY;
  let nw=startW,nh=startH;
  if(resizeDir.includes('e'))nw=Math.max(280,startW+dx);
  if(resizeDir.includes('w'))nw=Math.max(280,startW-dx);
  if(resizeDir.includes('s'))nh=Math.max(400,startH+dy);
  if(resizeDir.includes('n'))nh=Math.max(400,startH-dy);
  c.style.width=nw+'px';if(!collapsed)c.style.height=nh+'px';
  document.getElementById('sizeHint').textContent=Math.round(nw)+' × '+Math.round(nh);
};
document.onmouseup=()=>{
  if(resizing){
    resizing=false;document.body.style.cursor='';
    setTimeout(()=>document.getElementById('sizeHint').textContent='',1200);
  }
};


let collapsed=false,expanded=false;
function toggleCollapse(){
  const p=document.getElementById('panel'),c=document.getElementById('container'),m=document.querySelector('.pmenu');
  collapsed=!collapsed;
  if(collapsed){p.classList.add('collapsed');c.style.height='32px';m.textContent='⌃';}
  else{p.classList.remove('collapsed');c.style.height=c.dataset.h||'720px';m.textContent='⌄';}
}
function toggleExpand(){
  const c=document.getElementById('container');
  if(!expanded){c.dataset.w=c.style.width||'340px';c.dataset.h=c.style.height||'720px';c.style.width='400px';c.style.height='820px';expanded=true;}
  else{c.style.width=c.dataset.w||'340px';c.style.height=c.dataset.h||'720px';expanded=false;}
}

/* ===== Toast — turli xil (success/error/warning/info) · pastda STACK (P23) ===== */
// Success (a4) kartadagi lime check-circle ikonasi (Phosphor fill · inline SVG)
const TOAST_CHECK='<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>';
// P23 — STACK toast (web pariteti): har xabar alohida karta, pastda-markazda ustma-ust (maks 3),
// tur ikonkasi + rang, slide/fade auto-dismiss. showToast() imzosi O'ZGARMAGAN (msg,type,elapsedSec).
const TOAST_TYPE_IC={
  error:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  warning:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  info:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
};
function showToast(msg,type,elapsedSec){
  let t=type||'info';
  if(t==='danger') t='error';           // catalog.js eski "danger" → error
  if(['success','error','warning','info'].indexOf(t)<0) t='info';
  const stack=document.getElementById('toastStack');
  if(!stack)return;
  const elapsed=(t==='success'&&elapsedSec!=null&&isFinite(elapsedSec)&&elapsedSec>=0.1)
    ? `<span class="toast-elapsed">${escHtml(elapsedSec.toFixed(1)+'s')}</span>` : '';
  const icon=t==='success'?TOAST_CHECK:`<span class="toast-ic">${TOAST_TYPE_IC[t]||TOAST_TYPE_IC.info}</span>`;
  const el=document.createElement('div');
  el.className='toast t-'+t;
  el.innerHTML=`${icon}<span class="toast-msg">${escHtml(String(msg==null?'':msg))}</span><span class="toast-sp"></span>${elapsed}`;
  stack.appendChild(el);
  // Maks 3 ustma-ust — eng eskisini darhol olib tashla.
  while(stack.children.length>3){ const old=stack.firstChild; if(old&&old.parentNode)old.parentNode.removeChild(old); }
  requestAnimationFrame(()=>{ el.classList.add('show'); });
  const dur=t==='error'?4200:(t==='warning'?3400:2600);
  setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=>{ if(el.parentNode)el.parentNode.removeChild(el); },300); // fade tugagach DOM'dan olib tashla
  },dur);
}

/** Plagin ichki tasdiqlash modali — OS'ning "JavaScript Confirm" oynasi O'RNIGA.
 * window.afConfirm(msg,{ok,cancel,danger}) → Promise<boolean>. Overlay/Escape = bekor.
 * DOM ishlamay qolsa xavfsiz fallback: native confirm (funksiya hech qachon reject qilmaydi). */
window.afConfirm=function(msg,opts){
  opts=opts||{};
  return new Promise(function(resolve){
    try{
      var old=document.getElementById('afConfirmOv'); if(old)old.parentNode.removeChild(old);
      var ov=document.createElement('div'); ov.id='afConfirmOv';
      ov.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:0 34px';
      var card=document.createElement('div');
      card.style.cssText='width:100%;max-width:340px;background:var(--surface-2);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:16px;box-shadow:0 18px 42px rgba(0,0,0,.5);font-family:inherit';
      // b9 mockup: birinchi qator — sarlavha (700), qolgani — izoh (kichik, kulrang)
      var raw=String(msg==null?'':msg); var nl=raw.indexOf('\n');
      var titleTxt=(nl>=0)?raw.slice(0,nl):raw, subTxt=(nl>=0)?raw.slice(nl+1):'';
      var tt=document.createElement('div');
      tt.style.cssText='color:var(--text);font-weight:700;font-size:13.5px;line-height:1.4';
      tt.textContent=titleTxt;
      card.appendChild(tt);
      if(subTxt){ var tx=document.createElement('div');
        tx.style.cssText='color:var(--muted);font-size:11px;margin-top:5px;line-height:1.5;white-space:pre-line';
        tx.textContent=subTxt; card.appendChild(tx); }
      var row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;margin-top:14px';
      var mk=function(label,primary){ var b=document.createElement('button'); b.type='button'; b.textContent=label;
        b.style.cssText='flex:1;height:36px;border-radius:999px;font-size:12px;cursor:pointer;font-family:inherit;'
          +(primary
            ?('border:0;background:'+(opts.danger?'var(--red)':'var(--accent)')+';color:'+(opts.danger?'#1C0806':'var(--on-accent)')+';font-weight:700')
            :'border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.06);color:var(--text);font-weight:600');
        return b; };
      var no=mk(opts.cancel||'Cancel',false), yes=mk(opts.ok||'Continue',true);
      var done=function(v){ try{ ov.parentNode.removeChild(ov); }catch(_){ } document.removeEventListener('keydown',esc,true); resolve(!!v); };
      var esc=function(e){ if(e.key==='Escape'){ e.stopPropagation(); done(false); } };
      no.addEventListener('click',function(){ done(false); });
      yes.addEventListener('click',function(){ done(true); });
      ov.addEventListener('click',function(e){ if(e.target===ov)done(false); });
      document.addEventListener('keydown',esc,true);
      row.appendChild(no); row.appendChild(yes); card.appendChild(row); ov.appendChild(card);
      document.body.appendChild(ov);
      try{ yes.focus(); }catch(_){ }
    }catch(e){
      try{ resolve(typeof window.confirm==='function'?window.confirm(String(msg||'')):true); }catch(_){ resolve(false); }
    }
  });
};

/** BATCH4 #2 — ko'p-variantli ichki tanlov modali (afConfirm uslubi, OS dialog EMAS).
 * window.afChoose(title, sub, [{label, value}]) → Promise<value|null>. Overlay/Escape/Cancel = null. */
window.afChoose=function(title,sub,options){
  return new Promise(function(resolve){
    try{
      var old=document.getElementById('afChooseOv'); if(old)old.parentNode.removeChild(old);
      var ov=document.createElement('div'); ov.id='afChooseOv';
      ov.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:0 34px';
      var card=document.createElement('div');
      card.style.cssText='width:100%;max-width:360px;background:var(--surface-2);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:16px;box-shadow:0 18px 42px rgba(0,0,0,.5);font-family:inherit';
      var tt=document.createElement('div'); tt.style.cssText='color:var(--text);font-weight:700;font-size:13.5px;line-height:1.4'; tt.textContent=String(title||''); card.appendChild(tt);
      if(sub){ var tx=document.createElement('div'); tx.style.cssText='color:var(--muted);font-size:11px;margin-top:5px;line-height:1.5'; tx.textContent=String(sub); card.appendChild(tx); }
      var done=function(v){ try{ ov.parentNode.removeChild(ov); }catch(_){ } document.removeEventListener('keydown',esc,true); resolve(v); };
      var esc=function(e){ if(e.key==='Escape'){ e.stopPropagation(); done(null); } };
      var col=document.createElement('div'); col.style.cssText='display:flex;flex-direction:column;gap:8px;margin-top:13px';
      (options||[]).forEach(function(o){
        var b=document.createElement('button'); b.type='button'; b.textContent=o.label;
        b.style.cssText='height:38px;border-radius:11px;font-size:12px;cursor:pointer;font-family:inherit;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.06);color:var(--text);font-weight:600;text-align:left;padding:0 13px';
        b.addEventListener('mouseenter',function(){ b.style.borderColor='var(--accent)'; });
        b.addEventListener('mouseleave',function(){ b.style.borderColor='rgba(255,255,255,.09)'; });
        b.addEventListener('click',function(){ done(o.value); });
        col.appendChild(b);
      });
      var no=document.createElement('button'); no.type='button'; no.textContent='Cancel';
      no.style.cssText='height:34px;border-radius:999px;font-size:12px;cursor:pointer;font-family:inherit;border:1px solid rgba(255,255,255,.09);background:transparent;color:var(--muted);font-weight:600;margin-top:2px';
      no.addEventListener('click',function(){ done(null); });
      col.appendChild(no); card.appendChild(col);
      ov.addEventListener('click',function(e){ if(e.target===ov)done(null); });
      document.addEventListener('keydown',esc,true);
      ov.appendChild(card); document.body.appendChild(ov);
    }catch(e){ resolve(null); }
  });
};

/* ===== FAZA 4: yetishmagan shrift hal qiluvchi paneli =====================
 * Import'dan keyin host aniqlagan missing shriftlarni AssetFlowCatalog.resolveMissingFonts
 * (Node) orqali 3 bosqichda hal qiladi va har shriftni jonli holat bilan ko'rsatadi:
 *   installed → Google Fonts'dan o'rnatildi
 *   adobe     → CC avtomat yoqadi
 *   manual    → qo'lda o'rnating
 * Redizayn yo'q — mavjud afConfirm modal uslubini qayta ishlatadi (inline stil). */
window.afFontResolver=(function(){
  var CHIP={
    checking:{t:'⏳ checking',c:'var(--muted)'},
    installed:{t:'✓ installed',c:'#22c55e'},
    adobe:{t:'☁ via CC',c:'#60a5fa'},
    manual:{t:'⚠ manual',c:'#f59e0b'},
    error:{t:'✕ error',c:'var(--red)'}
  };
  var ov=null,listEl=null,rows={};
  function close(){ try{ ov.parentNode.removeChild(ov); }catch(_){ } ov=null;listEl=null;rows={}; document.removeEventListener('keydown',esc,true); }
  function esc(e){ if(e.key==='Escape'){ e.stopPropagation(); close(); } }
  function chip(status){
    var meta=CHIP[status]||CHIP.checking;
    var s=document.createElement('span');
    s.style.cssText='flex:0 0 auto;font-size:10.5px;font-weight:700;color:'+meta.c+';white-space:nowrap';
    s.textContent=meta.t; return s;
  }
  function open(fonts){
    try{ if(ov)close(); }catch(_){}
    ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:0 34px';
    var card=document.createElement('div');
    card.style.cssText='width:100%;max-width:340px;background:var(--surface-2);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:16px;box-shadow:0 18px 42px rgba(0,0,0,.5);font-family:inherit;max-height:80vh;display:flex;flex-direction:column';
    var tt=document.createElement('div');
    tt.style.cssText='color:var(--text);font-weight:700;font-size:13.5px;line-height:1.4';
    tt.textContent='Missing fonts';
    var sub=document.createElement('div');
    sub.style.cssText='color:var(--muted);font-size:11px;margin-top:5px;line-height:1.5';
    sub.textContent='Template uses '+fonts.length+' missing font(s) — resolving automatically.';
    listEl=document.createElement('div');
    listEl.style.cssText='margin-top:12px;overflow-y:auto;display:flex;flex-direction:column;gap:8px';
    for(var i=0;i<fonts.length;i++){
      var nm=String((fonts[i]&&(fonts[i].family||fonts[i].postScript))||'Font');
      var row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;justify-content:space-between';
      var left=document.createElement('div');
      left.style.cssText='min-width:0;flex:1';
      var name=document.createElement('div');
      name.style.cssText='color:var(--text);font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      name.textContent=nm;
      var note=document.createElement('div');
      note.style.cssText='color:var(--muted);font-size:10px;margin-top:2px;line-height:1.35';
      note.textContent='';
      left.appendChild(name);left.appendChild(note);
      var c=chip('checking');
      row.appendChild(left);row.appendChild(c);
      listEl.appendChild(row);
      rows[i]={row:row,chip:c,note:note};
    }
    var closeBtn=document.createElement('button');
    closeBtn.type='button';closeBtn.textContent='Close';
    closeBtn.style.cssText='margin-top:14px;height:36px;border-radius:999px;font-size:12px;cursor:pointer;font-family:inherit;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.06);color:var(--text);font-weight:600';
    closeBtn.addEventListener('click',close);
    card.appendChild(tt);card.appendChild(sub);card.appendChild(listEl);card.appendChild(closeBtn);
    ov.appendChild(card);
    ov.addEventListener('click',function(e){ if(e.target===ov)close(); });
    document.addEventListener('keydown',esc,true);
    document.body.appendChild(ov);
  }
  function update(index,result){
    var r=rows[index]; if(!r)return;
    var st=(result&&result.status)||'error';
    var newChip=chip(st);
    try{ r.row.replaceChild(newChip,r.chip); r.chip=newChip; }catch(_){}
    if(r.note)r.note.textContent=(result&&result.message)||'';
  }
  return { open:open, update:update, close:close };
})();

/**
 * #99 (PL-g) — shrift o'rnatishga rozilik. Nima bo'lishini ANIQ aytamiz:
 * qayerdan yuklanadi, qayerga yoziladi va nimaga tegilmaydi. Rad etilsa
 * hech narsa yuklanmaydi — import natijasi o'zgarishsiz qoladi.
 */
async function confirmFontInstall(fonts){
  if(typeof window.afConfirm!=='function')return false;   // dialog yo'q → rozilik yo'q
  var names=fonts.slice(0,6).map(function(f){return String(f.family||f.postScript||'').trim();})
    .filter(Boolean).join(', ');
  if(fonts.length>6)names+=' +'+(fonts.length-6)+' more';
  var isWin=false;
  try{ isWin=(typeof process!=='undefined'&&process.platform==='win32'); }catch(_){ }
  var where=isWin
    ?'your personal Windows font folder (and a registry entry under your user account)'
    :'your personal font folder';
  return await window.afConfirm(
    'Install '+fonts.length+' missing font'+(fonts.length===1?'':'s')+'?\n'
    +names+'\n\nFrameFlow will look them up on Google Fonts and install what it finds into '
    +where+'. Nothing is installed system-wide, and fonts that are not open-source are left for you to install yourself.',
    {ok:'Install fonts',cancel:'Not now'}
  );
}

/** Import natijasidagi missingFonts'ni 3 bosqichda hal qiladi (host → Node → UI).
 *  Money-zone'ga tegmaydi; xato bo'lsa import muvaffaqiyati BUZILMAYDI. */
async function resolveTemplateFonts(missingFonts){
  try{
    if(!IS_CEP)return;                       // Premiere tashqarisida OS font papkasiga yozmaymiz
    if(typeof AssetFlowCatalog==='undefined'||!AssetFlowCatalog.resolveMissingFonts)return;
    var fonts=Array.isArray(missingFonts)?missingFonts.filter(function(f){return f&&(f.family||f.postScript);}):[];
    if(!fonts.length)return;
    // #99 (PL-g) — ROZILIK. Ilgari import tugashi bilan panel hech nima
    // so'ramasdan Google Fonts'dan shrift yuklab, foydalanuvchining OS shrift
    // papkasiga yozar (Windows'da HKCU registriga yozuv ham qo'shar) edi.
    // Bu OS'ga jimgina o'zgartirish — endi har safar aniq ruxsat so'raymiz.
    if(!(await confirmFontInstall(fonts)))return;
    window.afFontResolver.open(fonts);
    var res=await AssetFlowCatalog.resolveMissingFonts(fonts,function(r,i){
      window.afFontResolver.update(i,r);
    });
    // Yakuniy qisqa xulosa (toast) — nechta o'rnatildi / CC / qo'lda
    var n={installed:0,adobe:0,manual:0,error:0};
    (res||[]).forEach(function(r){ if(r&&n[r.status]!=null)n[r.status]++; });
    var parts=[];
    if(n.installed)parts.push(n.installed+' installed');
    if(n.adobe)parts.push(n.adobe+' via CC');
    if(n.manual||n.error)parts.push((n.manual+n.error)+' manual');
    if(parts.length)showToast('Fonts: '+parts.join(', '),(n.manual||n.error)?'warning':'success');
  }catch(err){
    try{ console.warn('resolveTemplateFonts',err); }catch(_){}
    // Font hal qilish xatosi import natijasini o'zgartirmaydi (jim o'tamiz).
  }
}

/** Xom xato matnlarini (Failed to fetch, ExtendScript, HTTP) tushunarli qiladi */
// Enhance natijasini tozalaydi — LLM ba'zan META blok qo'shadi (sarlavha + Target Model/Duration/
// Aspect Ratio/Resolution/Quality/Native Audio). Ular promptда bo'lmasligi kerak (UI boshqaradi).
function afCleanEnhancedPrompt(t){
  var s=String(t==null?'':t);
  s=s.replace(/^\s*(?:\*\*\s*)?(?:video|image|audio)\s*prompt\s*:?\s*(?:\*\*)?\s*/i,''); // boshidagi sarlavha
  s=s.replace(/(?:\n\s*\**\s*(?:target model|duration|aspect ratio|resolution\s*\/?\s*quality|resolution|quality|native audio|audio)\s*:\**[^\n]*)+\s*$/i,''); // oxiridagi meta bloki
  return s.trim();
}
// P30 (29c) — provayder KONTENT rad etilishini birxil ishlash: halol xato (✕, ✓ EMAS) +
// haqiqiy sabab + "✦N qaytarildi" + boshqa (mo''tadil siyosatli) MODEL taklifi (afConfirm).
// gn = /gen/:jobId javobi (rejection maydoni bilan). switchFn(id,label) tool'ga xos almashtiradi.
// Rad etilishni ishlagan bo'lsa true qaytaradi (chaqiruvchi success toast'ni O'TKAZIB YUBORADI).
function handleGenRejection(gn, switchFn){
  var rej = gn && gn.rejection;
  if(!(rej && rej.isContent)) return false;
  var refNote = rej.refunded ? (' · ✦'+rej.refunded+' refunded') : '';
  // R4_04 — sabab HAR DOIM toza (backend toza yuboradi); belt-and-suspenders: xom JSON tushsa tozalaymiz.
  var reason = rej.reason || 'The provider rejected this content';
  if(/\{["']?\s*error\b/i.test(reason)) reason = (typeof friendlyError==='function') ? friendlyError({message:reason}) : 'This request was rejected by the model’s content policy';
  if(typeof showToast==='function') showToast(reason+refNote, 'error');
  if(rej.suggestModelId && rej.suggestModelLabel && typeof switchFn==='function' && typeof window.afConfirm==='function'){
    var prov = ({'vertex-image':'Google','vertex':'Google','vertex-omni':'Google','google-tts':'Google','byteplus':'BytePlus','fal':'fal','elevenlabs':'ElevenLabs'})[rej.provider]||'';
    window.afConfirm((rej.modelLabel||'This model')+(prov?(' ('+prov+')'):'')+' refused this content.\nTry '+rej.suggestModelLabel+' — a model with a different content policy?', {ok:'Switch model', cancel:'Not now'}).then(function(ok){ if(ok) try{ switchFn(rej.suggestModelId, rej.suggestModelLabel); }catch(e){} });
  }
  return true;
}
function friendlyError(e){
  const raw=(e&&e.message)||String(e||'');
  const code=(e&&e.code)||'', status=(e&&e.status)||0;
  if(code==='INSUFFICIENT_CREDITS'||code==='AI_CREDITS_EXHAUSTED'||status===402||/kredit yetarli emas|insufficient credit/i.test(raw))
    return 'Not enough credits — ⚙ Settings › "Top up credits"';
  if(code==='AI_DAILY_CAP'||/kunlik.*(cap|chek|limit)|daily.*cap|cap.*(reached|tugadi)/i.test(raw))
    return 'Today’s limit reached — try again tomorrow';
  if(code==='AI_NOT_CONFIGURED')return 'AI isn’t configured yet — contact an administrator';
  if(status===429||code==='RATE_LIMITED'||/too many requests|rate.?limit/i.test(raw))
    return 'Too many requests — wait a moment and try again';
  // P30 §3 (29c) — HALOL xato, "soften the prompt" (evasion maslahati) OLIB TASHLANDI. Kredit
  // qaytariladi; rad etilishida handleGenRejection() boshqa-model taklifini ko'rsatadi.
  // R4_04 — Google real yuz / mashhur shaxs bloki ("restricted individuals ... Responsible AI ...
  // could not be submitted") — xom JSON o'rniga toza xabar. handleGenRejection backend suggestModel'ni ko'rsatadi.
  if(/restricted individual|responsible ai|could not be submitted|real (?:person|people|face)|public figure|\bcelebrit/i.test(raw))
    return 'This model won’t process real people or public figures — your credits were refunded';
  if(/output video has sensitive content|sensitive content|nsfw|sexual|nudity|content policy|safety system|no image was returned/i.test(raw))
    return 'The model’s content filter rejected this request — your credits were refunded';
  // #145 (PX8): OS "ulanish yo'q" desa — taxmin qilmaymiz, aniq aytamiz (strip ham chiqadi).
  if(navigator.onLine===false)
    return 'You’re offline — check your network connection';
  if(/Failed to fetch|NetworkError|ENOTFOUND|ECONNREFUSED|network/i.test(raw))
    return 'Couldn’t connect to the internet — check your network or the API';
  // P20: 403 overloaded — biznes-kodni AVVAL hurmat qilamiz, faqat HAQIQIY auth-bekor (401 /
  // token expired) "Session expired" beradi. LIMIT_REACHED/PRO_REQUIRED odatda o'z modallariga
  // yo'naladi; bu fallback toast'ga tushsa ham hech qachon soxta "sessiya tugadi" ko'rsatilmaydi.
  if(code==='LIMIT_REACHED')
    return 'Monthly limit reached — upgrade to Pro for more';
  if(code==='PRO_REQUIRED')
    return 'This is a Pro template — upgrade to Pro to import it';
  if(code==='ACCOUNT_BLOCKED')
    return 'Your account was blocked — contact support';
  if(code==='ACCOUNT_INACTIVE')
    return 'Your account isn’t active — contact support';
  if(status===401||/\b401\b|unauthorized/i.test(raw))
    return 'Session expired — please sign in again';
  if(status===403||/\b403\b|forbidden/i.test(raw))
    return 'You don’t have access to that';
  if(/\b5\d\d\b|server error|ETIMEDOUT|timeout/i.test(raw))
    return 'Server isn’t responding — try again shortly (it may be waking up from sleep)';
  if(/EvalScript error/i.test(raw))
    return 'Premiere Pro script didn’t respond — restart Premiere';
  if(/redirect limit|Pack HTTP/i.test(raw))
    return 'Couldn’t download the file — the pack URL is invalid or was removed';
  // R4_04 — xom provayder JSON HECH QACHON foydalanuvchiga ko'rsatilmasin (masalan "Omni 400: {\"error\":...}").
  if(/\{["']?\s*error\b/i.test(raw) || /^\s*\w[\w .()\/-]*\d{3}\s*:\s*[\[{]/.test(raw))
    return 'The request was rejected by the model — your credits were refunded';
  return raw||'Unknown error';
}

/* ===== Import/Download progress (a4) — label + optional MB counter, else % ===== */
function showProgress(pct,text,indeterminate,cancellable,mbText){
  const box=document.getElementById('afProgress');
  if(!box)return;
  const fill=document.getElementById('afProgressFill');
  const pctEl=document.getElementById('afProgressPct');
  const mbEl=document.getElementById('afProgressMB');
  const txtEl=document.getElementById('afProgressText');
  box.classList.add('show');
  box.classList.toggle('indeterminate',!!indeterminate);
  box.classList.toggle('cancellable',!!cancellable);
  if(txtEl&&text!=null) txtEl.textContent=text;
  // MB hisoblagichni faqat bayt jami ma'lum bo'lsa ko'rsatamiz (soxta raqam yo'q)
  const hasMb=mbText!=null&&mbText!=='';
  if(mbEl){ mbEl.textContent=hasMb?mbText:''; mbEl.style.display=hasMb?'':'none'; }
  if(indeterminate){
    if(pctEl){ pctEl.textContent=''; pctEl.style.display='none'; }
  }else{
    const p=Math.max(0,Math.min(100,Math.round(pct||0)));
    if(fill) fill.style.width=p+'%';
    // MB bo'lsa foizni yashiramiz; aks holda foizni fallback sifatida ko'rsatamiz
    if(pctEl){ pctEl.textContent=p+'%'; pctEl.style.display=hasMb?'none':''; }
  }
}
function hideProgress(){
  const box=document.getElementById('afProgress');
  if(!box)return;
  box.classList.remove('show','indeterminate','cancellable');
  const fill=document.getElementById('afProgressFill');
  if(fill) fill.style.width='0';
  const mbEl=document.getElementById('afProgressMB');
  if(mbEl){ mbEl.textContent=''; mbEl.style.display='none'; }
}
/** Progress'dagi «Bekor qilish» — faol yuklab olishni uzadi */
function onAfCancel(){
  // #97 (PL-e): faol host (ExtendScript) kutuvi bo'lsa — avval O'SHANI uzamiz.
  // Yuklab olish allaqachon tugagan; bu yerda «bekor» = kutishni to'xtatish.
  if(window.__afHostWait){
    try{ window.__afHostWait.cancel(); }catch(e){}
    hideProgress();
    return;   // xabar chaqiruvchi callback'da (host javobi 'cancelled' bo'ladi)
  }
  try{
    if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.cancelDownload)
      AssetFlowCatalog.cancelDownload();
  }catch(e){}
  hideProgress();
  showToast('Download canceled','warning');
}
window.onAfCancel=onAfCancel;

function setupCepMetaListener(){
  if(!csInterface||window.__afCepMetaListener)return;
  csInterface.addEventListener(AssetFlowStore?.CEP_EVENT||'com.frameflow.metaUpdated',()=>{
    if(window.__afBrowseReady) refreshLocalAssets();
  });
  window.__afCepMetaListener=true;
}

function showLoginRequired(){
  document.getElementById('lrOverlay')?.classList.add('open');
}
function closeLoginRequired(){
  document.getElementById('lrOverlay')?.classList.remove('open');
}

function openAccountSheet(){
  document.getElementById('accountSheet')?.classList.add('open');
  refreshAccountUi();
  try{updateConnStatus();}catch(e){} // SC_35: diagnostika footerini joriy holatga yangilash
}
function closeAccountSheet(){
  document.getElementById('accountSheet')?.classList.remove('open');
}

function refreshAccountUi(){
  const logged=typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.isLoggedIn();
  const u=typeof AssetFlowAccount!=='undefined'?AssetFlowAccount.getCachedUser():null;
  document.getElementById('accountLoginBlock').style.display=logged?'none':'block';
  document.getElementById('accountProfileBlock').style.display=logged?'block':'none';
  // SC_28: WORKSPACE (Sessions/Projects) — faqat login bo'lganda (top-bar'dan ko'chgan)
  const wsBlock=document.getElementById('accountWorkspaceBlock');
  if(wsBlock)wsBlock.style.display=logged?'block':'none';
  document.getElementById('accountPlanBlock').style.display=logged?'block':'none';
  document.getElementById('accountAdminBlock').style.display=
    logged&&u?.role==='ADMIN'?'block':'none';
  // P10: "Publish a template" (CONTRIBUTOR) bo'limi olib tashlandi — bu yerda toggle yo'q.
  document.getElementById('accountActionsBlock').style.display=logged?'flex':'none';
  // Yuklab olish papkasi — lokal sozlama, login shart emas (faqat Premiere/CEP ichida)
  const dlBlock=document.getElementById('accountDownloadBlock');
  if(dlBlock){
    dlBlock.style.display=IS_CEP?'block':'none';
    // Saqlangan qiymatni ko'rsatamiz, staging'ni tozalaymiz
    pendingDownloadDir=undefined;
    renderDownloadPath(getDownloadDir());
  }
  if(!logged){
    updateFootUser(null);
    afApplyAvatar(null);
    return;
  }
  if(!u)return;
  // AI kredit-pill (#sbCredit) — server bergan haqiqiy balans
  if(typeof u.aiCredits==='number'){
    const credEl=document.getElementById('sbCredit');
    if(credEl)credEl.textContent=String(u.aiCredits);
  }
  // Sheet avatar — rasm (avatarUrl) yoki birinchi harf; hamma header tugmalari ham
  afApplyAvatar(u);
  document.getElementById('accProfileName').textContent=u.name||u.email;
  document.getElementById('accProfileEmail').textContent=u.email;
  const badge=document.getElementById('accPlanBadge');
  badge.textContent=u.planLabel||'Free';
  badge.className='badge-plan '+(u.plan==='pro'?'pro':'free');
  const _dlM=u.downloadsMonth??0,_dlLim=u.limits?.downloadLimit,_unlim=u.limits?.unlimitedDownloads;
  document.getElementById('accDlMonth').textContent=String(_dlM);
  document.getElementById('accDlTotal').textContent=String(u.downloadsTotal??0);
  // P21: import kvotasi endi OYLIK va limitni belgilaydi — importsMonth/importLimit ko'rsatiladi
  // (unlimited bo'lsa faqat oylik son). Umrlik importsTotal endi sarlavhada emas.
  const _imM=u.importsMonth??0,_imLim=u.limits?.importLimit,_imUnlim=u.limits?.unlimitedImports;
  document.getElementById('accImports').textContent=_imUnlim?String(_imM):(String(_imM)+'/'+(_imLim??'—'));
  document.getElementById('accDlLimitDisp').textContent=_unlim?'Unlimited':String(_dlLim??'—');
  document.getElementById('accUsageFill').style.width=(!_unlim&&_dlLim)?Math.min(100,Math.round(_dlM/_dlLim*100))+'%':'0%';
  document.getElementById('planOptFree').classList.toggle('active',u.plan!=='pro');
  document.getElementById('planOptPro').classList.toggle('active',u.plan==='pro');
  const hint=document.getElementById('accPlanHint');
  if(hint){
    // SC_10: yordamchi jumlalar QISQARTIRILDI — Pro faol holatда umuman ko'rinmaydi
    // (karta o'zi "Unlimited downloads · Pack files" deb aytadi); qolganlari bir necha so'z.
    if(u.plan==='pro'){
      hint.textContent=''; hint.style.display='none';
    }else if(u.stripeSubscriptionActive){
      hint.style.display=''; hint.textContent='Payment active — click "Pro" to enable.';
    }else{
      hint.style.display=''; hint.textContent='"Pro" opens checkout · "Refresh" after paying.';
    }
  }
  // Billing portal — faqat Stripe obunasi bo'lganlarga
  const billingRow=document.getElementById('accBillingRow');
  if(billingRow) billingRow.style.display=(u.plan==='pro'||u.stripeSubscriptionActive)?'flex':'none';
  refreshStorageBar(); // FAZA 2 #20 — "X / Y GB" (async, best-effort)
  updateFootUser(u);
}

/** FAZA 2 #20 — hisob sheet'idagi storage bar (/api/studio/credits .storage). */
function fmtGB(bytes){
  var b=Number(bytes)||0; var gb=b/(1024*1024*1024);
  if(gb>=1)return (Math.round(gb*100)/100)+' GB';
  var mb=b/(1024*1024);
  return (mb>=1?Math.round(mb):(b?1:0))+' MB';
}
function refreshStorageBar(){
  var wrap=document.getElementById('accStorageWrap'); if(!wrap)return;
  try{
    if(typeof studioGet!=='function'){ wrap.style.display='none'; return; }
    studioGet('/api/studio/credits').then(function(d){
      var s=d&&d.storage;
      if(!s||typeof s.quotaBytes!=='number'){ wrap.style.display='none'; return; }
      wrap.style.display='';
      document.getElementById('accStoreUsed').textContent=fmtGB(s.usedBytes||0);
      document.getElementById('accStoreQuota').textContent=fmtGB(s.quotaBytes);
      var pct=s.quotaBytes?Math.min(100,Math.round((s.usedBytes||0)/s.quotaBytes*100)):0;
      var fill=document.getElementById('accStoreFill');
      fill.style.width=pct+'%';
      fill.style.background=pct>=90?'#e84242':''; // to'lay deb qolganda ogohlantirish rangi
    }).catch(function(){ wrap.style.display='none'; });
  }catch(e){ wrap.style.display='none'; }
}

function getDownloadDir(){
  // Barqaror settings fayldan (CEP) — restartda saqlanadi
  if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.configuredDownloadDir){
    return AssetFlowCatalog.configuredDownloadDir()||'';
  }
  if(typeof AssetFlowStore==='undefined')return '';
  return (AssetFlowStore.loadPrefs().client||{}).downloadDir||'';
}

// Hali saqlanmagan tanlov (undefined = staging yo'q, saqlangan qiymat ko'rsatiladi)
let pendingDownloadDir=undefined;

/** Papka yo'lini UI'da ko'rsatadi va "Saqlash" tugmasi holatini yangilaydi */
function renderDownloadPath(dir,staged){
  const pathEl=document.getElementById('accDownloadPath');
  if(pathEl){
    pathEl.textContent=dir||'Default (temporary folder)';
    pathEl.className='acc-folder-path'+(dir?'':' empty');
  }
  const hint=document.getElementById('dlSaveHint');
  const btn=document.getElementById('dlSaveBtn');
  if(staged){
    // SC_10: hint endi faqat OGOHLANTIRISH holatida ko'rinadi (doimiy tushuntirish title'da)
    if(hint){ hint.textContent='⚠ Not saved — click "Save" to confirm.'; hint.style.display=''; }
    if(btn) btn.classList.add('visible');
  }else{
    if(hint){ hint.textContent=''; hint.style.display='none'; }
    if(btn) btn.classList.remove('visible');
  }
}

function persistDownloadDir(dir){
  let ok=true;
  // Barqaror settings faylga (CEP) — restartdan keyin ham saqlanadi
  if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.saveDownloadDir){
    if(AssetFlowCatalog.saveDownloadDir(dir||'')===false) ok=false;
  }
  // Eski joyga ham (backwards-compat)
  if(typeof AssetFlowStore!=='undefined'){
    try{
      const prefs=AssetFlowStore.loadPrefs();
      prefs.client={...(prefs.client||{}),downloadDir:dir||''};
      AssetFlowStore.savePrefs(prefs);
    }catch(e){ ok=false; }
  }
  return ok;
}

/** CEP native folder picker (ExtendScript'siz, ishonchli).
 *  Qaytaradi: yo'l (tanlandi) | '' (bekor) | null (CEP fs yo'q) */
function cepPickFolder(){
  try{
    if(window.cep&&window.cep.fs&&typeof window.cep.fs.showOpenDialog==='function'){
      const r=window.cep.fs.showOpenDialog(false,true,'Choose a download folder','');
      if(r&&r.err===0&&r.data&&r.data.length){
        return decodeURI(String(r.data[0]).replace(/^file:\/\//,''));
      }
      return '';
    }
  }catch(e){ console.warn('cepPickFolder',e); }
  return null;
}

async function chooseDownloadFolder(){
  if(!IS_CEP){ showToast('Only available inside Premiere Pro'); return; }
  // 1) CEP native picker
  let path=cepPickFolder();
  // 2) Fallback — ExtendScript
  if(path===null&&csInterface){
    try{
      const raw=await new Promise(res=>csInterface.evalScript('pickDownloadFolder()',r=>res(r||'')));
      try{ const d=JSON.parse(raw); path=(d&&d.ok&&d.path)?d.path:''; }catch{ path=''; }
    }catch(e){ showToast('Error choosing folder: '+e.message); return; }
  }
  if(path===null){ showToast('Folder selection isn’t available'); return; }
  if(!path) return; // bekor qilindi
  pendingDownloadDir=path;
  renderDownloadPath(path,true);
  showToast('Folder selected — click “Save” to confirm');
}

function resetDownloadFolder(){
  pendingDownloadDir='';
  renderDownloadPath('',true);
  showToast('Default selected — click “Save” to confirm');
}

/** «Saqlash» — tanlangan papkani prefs'ga yozadi (yozib bo'lishini avval sinaydi) */
function saveDownloadFolderSettings(){
  const dir=(pendingDownloadDir!==undefined)?pendingDownloadDir:getDownloadDir();
  // CEP'da tanlangan papka haqiqatan yozib bo'ladimi — sinab ko'ramiz
  if(dir&&IS_CEP){
    try{
      const fs=__ffRequire('fs'),path=__ffRequire('path');
      if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
      const probe=path.join(dir,'.afwrite_'+Date.now());
      fs.writeFileSync(probe,'ok');
      fs.rmSync(probe,{force:true});
    }catch(e){
      showToast('Couldn’t write to this folder — choose another one','error');
      return;
    }
  }
  if(!persistDownloadDir(dir)){
    showToast('Setting wasn’t saved — check disk space or permissions','error');
    return;
  }
  pendingDownloadDir=undefined;
  renderDownloadPath(dir,false);
  showToast('✓ Saved','success');
}

window.chooseDownloadFolder=chooseDownloadFolder;
window.resetDownloadFolder=resetDownloadFolder;
window.saveDownloadFolderSettings=saveDownloadFolderSettings;

function setPlanButtonsBusy(busy){
  const free=document.getElementById('planOptFree');
  const pro=document.getElementById('planOptPro');
  if(free)free.disabled=!!busy;
  if(pro)pro.disabled=!!busy;
}

function initAccountUi(){
  const sheet=document.getElementById('accountSheet');
  if(!sheet||sheet.dataset.accBound)return;
  sheet.dataset.accBound='1';
  sheet.querySelectorAll('.plan-opt[data-plan]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      accountPickPlan(btn.dataset.plan);
    });
  });
}

function updateFootUser(u){
  if(typeof updateSidebarUser==='function') updateSidebarUser(u);
  try{ if(document.documentElement.classList.contains('home-mode')&&typeof renderHome==='function') renderHome(); }catch(e){}
  const av=document.getElementById('footAv');
  const name=document.getElementById('footName');
  const sub=document.getElementById('footSub');
  if(!u){
    if(av)av.textContent='?';
    if(name)name.textContent='Guest';
    if(sub)sub.textContent='Click to sign in';
    return;
  }
  const initial=(u.name||u.email||'U').trim().charAt(0).toUpperCase();
  if(av)av.textContent=initial;
  if(name)name.textContent=u.name||u.email.split('@')[0];
  if(sub){
    const dl=u.downloadsTotal??0;
    sub.textContent=(u.planLabel||'Free')+' · '+dl+' downloads';
  }
}

function setFootConnecting(sub){
  const name=document.getElementById('footName');
  const subEl=document.getElementById('footSub');
  if(name)name.textContent='Connecting…';
  if(subEl)subEl.textContent=sub||'Checking account';
}

async function refreshAccountFromApi(){
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn())return;
  // Render cold start 30-50s bo'lishi mumkin — backoff bilan ~65s gacha qayta urinamiz.
  // fetchMe 5xx/timeout'да token'ni tozalamaydi (faqat 401/403) → cold-start = logout EMAS.
  const delays=[0,2000,5000,10000,18000,30000];
  setFootConnecting();
  for(let i=0;i<delays.length;i++){
    if(delays[i])await new Promise(r=>setTimeout(r,delays[i]));
    try{
      await AssetFlowAccount.fetchMe();
      await AssetFlowAccount.heartbeat({
        deviceLabel:navigator.platform||'Mac',
        aeVersion:'Premiere Pro',
      });
      refreshAccountUi();
      return;
    }catch(e){
      console.warn('account ('+(i+1)+'/'+delays.length+')',e);
      // 401/403 da fetchMe tokenni tozalaydi — mehmon holatiga qaytamiz
      if(!AssetFlowAccount.isLoggedIn()){refreshAccountUi();return;}
    }
  }
  setFootConnecting('Server didn’t respond — click "Refresh"');
}

async function accountLogin(){
  const email=document.getElementById('accEmail')?.value?.trim();
  const password=document.getElementById('accPass')?.value||'';
  if(!email||!password){
    showToast('Enter your email and password');
    return;
  }
  try{
    await AssetFlowAccount.login(email,password);
    refreshAccountUi();
    try{ syncFavoritesFromServer(); }catch(e){} // #17: login bo'lgach hisob sevimlilari
    showToast('Signed in successfully','success');
    if(typeof AssetFlowCatalog!=='undefined'){
      catalogLoadState='loading';
      render();
      try{
        await AssetFlowCatalog.refreshBrowse(catalogFilters());
        catalogLoadState='ready';
      }catch(e){
        catalogLoadState='error';
      }
      render();
    }
  }catch(e){
    showToast(friendlyError(e),'error');
  }
}

/* Nusxa olish — CEP webview'da navigator.clipboard ba'zan yo'q, execCommand zaxira */
// P7: CEP webview file://'dan yuklanadi — XAVFSIZ kontekst EMAS, shu sabab navigator.clipboard
// ko'pincha yo'q/bloklangan. AVVAL sinxron execCommand('copy') (haqiqiy true/false qaytaradi va
// file://'da ishlaydi); faqat u ishlamasa — best-effort clipboard API. afCopyText BITTA toast
// ko'rsatadi (yagona manba) va HAQIQIY boolean qaytaradi — caller'lar qo'shimcha toast QILMASIN.
function afCopyExec(text){
  try{
    var ta=document.createElement('textarea');
    ta.value=String(text||''); ta.style.position='fixed'; ta.style.top='-9999px'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    var ok=!!(document.execCommand&&document.execCommand('copy'));
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}
function afCopyText(text){
  text=String(text||'');
  var ok=afCopyExec(text);
  if(!ok){
    // Xavfsiz kontekstда (masalan http(s) preview) — async clipboard best-effort.
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){},function(){});
        ok=true; // optimistik: writeText odatda muvaffaqiyat (rad etilса ham toast bir marta)
      }
    }catch(e){}
  }
  if(typeof showToast==='function') showToast(ok?'Copied':'Copy failed',ok?'success':'error');
  return ok;
}
// Eski nom bilan uyg'unlik (dormant caller'lar bo'lsa) — endi afCopyText'ga yo'naltiradi.
function afCopyFallback(text){ return afCopyText(text); }

/* Google device-code oqimi — har qadamda ko'rinadigan status + qo'lda ochish uchun
   nusxalanadigan havola/kod. Ikkala Google tugmasi ham shu funksiyaga tushadi. */
async function accountLoginWithGoogle(){
  const btn=document.getElementById('accGoogleBtn');
  const hint=document.getElementById('accGoogleHint');
  const setStatus=(html)=>{ if(hint){ hint.style.display='block'; hint.innerHTML=html; } };
  const hideStatus=()=>{ if(hint){ hint.style.display='none'; hint.innerHTML=''; } };
  if(btn) btn.disabled=true;
  setStatus('Starting secure sign-in…');
  try{
    // Public (token'siz) device/start — global 401 "sessiya tugadi" ushlagichidan ajratilgan
    const {code,verificationUrl,expiresIn}=await AssetFlowAccount.startDeviceLogin();
    // Tizim brauzerida ochamiz — openExternal HAQIQIY muvaffaqiyatni qaytaradi (true/false).
    let opened=false;
    try{ opened=AssetFlowAccount.openExternal(verificationUrl); }catch(e){ opened=false; }
    console.log('[accountLoginWithGoogle] openExternal returned', opened);
    // Muvaffaqiyat bo'lsa — qisqa status. Aks holda — havolani BIRINCHI DARAJALI qilib ko'rsatamiz.
    if(opened){
      // BATCH8 auth-device: bir martalik kodni ko'zga tashlanadigan mono blok sifatida ko'rsatamiz
      setStatus(
        '<span style="display:block;margin-bottom:10px;color:var(--muted);font-size:11px">Browser opened — type this code there, then sign in.</span>'+
        '<span style="display:block;margin:0 0 10px;padding:14px 10px;border:1px solid var(--accent);border-radius:12px;background:var(--accent-soft);text-align:center">'+
          '<span style="display:block;color:var(--faint);font-family:var(--font-mono);font-size:8px;letter-spacing:.12em;margin-bottom:6px">ONE-TIME CODE</span>'+
          '<b id="afGsigCode" style="display:block;font-family:var(--font-mono);font-size:17px;font-weight:750;letter-spacing:.1em;color:var(--accent);word-break:break-all"></b>'+
          '<div role="button" tabindex="0" type="button" id="afGsigCopyCode" style="margin-top:8px;cursor:pointer;font:inherit;font-size:10px;padding:3px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)">Copy code</div>'+
        '</span>'+
        '<span style="display:block;color:var(--faint);font-size:11px;margin-bottom:4px">Didn’t see it? Copy this link into your browser:</span>'+
        '<code id="afGsigUrl" style="display:block;word-break:break-all;font-size:11px;color:var(--muted);margin-bottom:8px"></code>'+
        '<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
          '<div role="button" tabindex="0" type="button" id="afGsigCopyLink" style="cursor:pointer;font:inherit;font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)">Copy link</div>'+
          '<div role="button" tabindex="0" type="button" id="afGsigOpen" style="cursor:pointer;font:inherit;font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)">Open again</div>'+
        '</span>'
      );
    } else {
      setStatus(
        '<span style="display:block;margin-bottom:8px;font-weight:600">Couldn’t open the browser automatically — copy this link and open it manually:</span>'+
        '<code id="afGsigUrl" style="display:block;word-break:break-all;font-size:12px;padding:8px;border-radius:6px;border:1px solid currentColor;margin-bottom:8px"></code>'+
        '<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
          '<div role="button" tabindex="0" type="button" id="afGsigCopyLink" style="cursor:pointer;font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:var(--on-accent)">Copy link</div>'+
          '<div role="button" tabindex="0" type="button" id="afGsigOpen" style="cursor:pointer;font:inherit;font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid currentColor;background:transparent;color:inherit">Try again</div>'+
          '<span style="font-size:11px;opacity:.7">Code: <b id="afGsigCode"></b></span>'+
        '</span>'
      );
    }
    // Qiymatlarni textContent orqali qo'yamiz (HTML injection yo'q)
    const urlEl=document.getElementById('afGsigUrl'); if(urlEl) urlEl.textContent=verificationUrl||'';
    const codeEl=document.getElementById('afGsigCode'); if(codeEl) codeEl.textContent=code||'';
    document.getElementById('afGsigCopyLink')?.addEventListener('click',()=>afCopyText(verificationUrl||''));
    document.getElementById('afGsigCopyCode')?.addEventListener('click',()=>afCopyText(code||''));
    document.getElementById('afGsigOpen')?.addEventListener('click',()=>{
      let ok=false; try{ ok=AssetFlowAccount.openExternal(verificationUrl); }catch(e){}
      if(!ok) showToast('Still couldn’t open the browser — please copy the link','warning');
    });

    const safetyTimeout=setTimeout(()=>{
      AssetFlowAccount.stopDevicePolling();
      if(btn) btn.disabled=false;
      hideStatus();
    },(expiresIn||600)*1000+5000);
    AssetFlowAccount.pollDeviceLogin(code,{
      onConfirmed:async ()=>{
        clearTimeout(safetyTimeout);
        if(btn) btn.disabled=false;
        hideStatus();
        refreshAccountUi();
        try{ syncFavoritesFromServer(); }catch(e){} // #17: Google login bo'lgach hisob sevimlilari
        showToast('Signed in successfully','success');
        if(typeof AssetFlowCatalog!=='undefined'){
          catalogLoadState='loading';
          render();
          try{
            await AssetFlowCatalog.refreshBrowse(catalogFilters());
            catalogLoadState='ready';
          }catch(e){
            catalogLoadState='error';
          }
          render();
        }
      },
      onExpired:()=>{
        clearTimeout(safetyTimeout);
        if(btn) btn.disabled=false;
        hideStatus();
        showToast('Timed out — please try again','warning');
      },
      onDenied:()=>{
        clearTimeout(safetyTimeout);
        if(btn) btn.disabled=false;
        hideStatus();
        showToast('Sign-in denied','error');
      },
      onError:(e)=>{
        /* tarmoq xatosi — pollik davom etadi, safetyTimeout oxir-oqibat to'xtatadi */
      },
    });
  }catch(e){
    if(btn) btn.disabled=false;
    hideStatus();
    showToast(friendlyError(e),'error');
  }
}

function accountLogout(){
  if(typeof AssetFlowAccount!=='undefined') AssetFlowAccount.logout();
  refreshAccountUi();
  // P25 — boshqa hisob shu qurilmada kirsa, eski foydalanuvchining AI Tools tarixi (rasm/video/audio
  // gen grid'lari) darhol tozalansin — aks holda keyingi login'gacha eski hisob generatsiyalari ko'rinardi.
  try{ if(typeof window.afIgClearRecent==='function')window.afIgClearRecent(); }catch(e){}
  try{ if(typeof window.axVGClearRecent==='function')window.axVGClearRecent(); }catch(e){}
  try{ if(typeof window.axAGClearRecent==='function')window.axAGClearRecent(); }catch(e){}
  // #31 (PX1) — uchayotgan gen reyestri ham hisobga bog'liq: boshqa foydalanuvchi kirsa,
  // eski hisobning job'lari tiklanmasin (server baribir 404/foreign qaytaradi).
  try{ if(window.afJobStore)window.afJobStore.clear(); }catch(e){}
  showToast('Signed out');
}

/** #21: avatarUrl bo'lsa rasm, bo'lmasa birinchi harf — sheet + BARCHA header tugmalari. */
let __afAvaBust=0;
function afApplyAvatar(u){
  const raw=u&&u.avatarUrl?String(u.avatarUrl):null;
  const url=raw?raw+(raw.indexOf('?')<0?'?':'&')+'v='+__afAvaBust:null;
  const initial=((u&&(u.name||u.email))||'U').trim().charAt(0).toUpperCase();
  const acc=document.getElementById('accAvatar');
  const tiles=document.querySelectorAll('.ai-ava,.hd-ava,.af-tb-ava');
  tiles.forEach(function(b){ b.classList.toggle('ring',!!u); }); // #11: lime halqa = tizimga kirilgan
  function showInitials(){
    if(acc){acc.style.backgroundImage='';acc.textContent=u?initial:'?';}
    tiles.forEach(function(b){b.style.backgroundImage='';});
  }
  // P7 — bosh harf yuklanguncha (va rasm 404/tarmoq xatosida) darhol ko'rinadi; bo'sh doira yo'q.
  showInitials();
  if(url){
    const img=new Image();
    img.onload=function(){
      if(acc){acc.textContent='';acc.style.backgroundImage='url("'+url+'")';}
      tiles.forEach(function(b){b.style.backgroundImage='url("'+url+'")';b.style.backgroundSize='cover';b.style.backgroundPosition='center';});
    };
    img.onerror=showInitials;
    img.src=url;
  }
}

/** #21: profil rasmini yuklash/almashtirish — POST /api/auth/avatar (plugin JWT). */
async function accountUploadAvatar(input){
  const f=input&&input.files&&input.files[0];
  if(input)input.value='';
  if(!f)return;
  if(f.size>5*1024*1024){showToast('Image is too large — max 5 MB','warning');return;}
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn()){showToast('Sign in first','info');return;}
  try{
    showToast('Uploading photo…');
    const fd=new FormData();
    fd.append('avatar',f);
    const res=await fetch(AssetFlowAccount.apiBase()+'/api/auth/avatar',{method:'POST',headers:AssetFlowAccount.authHeaders(),body:fd});
    const d=await res.json().catch(()=>null);
    if(!res.ok)throw new Error((d&&d.error)||('HTTP '+res.status));
    __afAvaBust=Date.now(); // redirect URL o'zgarmaydi — keshni chetlab o'tamiz
    try{ await AssetFlowAccount.fetchMe(); }catch(e){}
    refreshAccountUi();
    showToast('Profile photo updated','success');
  }catch(e){
    showToast((e&&e.message)||'Avatar upload failed','error');
  }
}
window.accountUploadAvatar=accountUploadAvatar;

// #3: Enter — login (inputlar <form>siz, Enter avval hech narsa qilmasdi)
['accEmail','accPass'].forEach(function(id){
  const el=document.getElementById(id);
  if(el)el.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();accountLogin();}
  });
});

// #22: avto-fon yangilanish — har 5 daqiqada katalog jimgina yangilanadi (toast'siz),
// ochiq AI tool bo'lsa So'nggi genlar ham (signed URL'lar eskirmasin).
setInterval(function(){
  try{
    if(typeof AssetFlowCatalog!=='undefined'&&typeof AssetFlowCatalog.refreshBrowse==='function'){
      AssetFlowCatalog.refreshBrowse(catalogFilters()).then(function(){
        window.__afLastSyncAt=new Date();
        if(typeof reconcileDownloadedFromScenes==='function')reconcileDownloadedFromScenes();
        const html=document.documentElement;
        if(typeof render==='function'&&!html.classList.contains('ai-mode')&&!html.classList.contains('home-mode')&&!html.classList.contains('lib-mode'))render();
        if(html.classList.contains('lib-mode')&&typeof renderLibDl==='function'){renderLibDl();}
      }).catch(function(){ /* fon rejimida jim — foydalanuvchini bezovta qilmaymiz */ });
    }
    const vi=document.getElementById('v-imggen');
    if(vi&&vi.classList.contains('on')&&typeof window.afIgRetryRecent==='function')window.afIgRetryRecent();
    const vv=document.getElementById('v-vidgen');
    if(vv&&vv.classList.contains('on')&&typeof window.retryVgRecent==='function')window.retryVgRecent();
  }catch(e){}
},5*60*1000);

async function accountPickPlan(plan){
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn()){
    showToast('Please sign in first');
    return;
  }
  const u=AssetFlowAccount.getCachedUser();
  if(u&&u.plan===plan){
    showToast('Already on '+((plan==='pro')?'Pro':'Free'));
    return;
  }
  // Pro tanlandi, lekin faol Stripe obunasi yo'q → checkout sahifasiga yuboramiz
  if(plan==='pro' && u && !u.stripeSubscriptionActive){
    await startProCheckout();
    return;
  }
  setPlanButtonsBusy(true);
  try{
    const next=await AssetFlowAccount.setPlan(plan);
    refreshAccountUi();
    showToast('✓ '+(next?.planLabel||(plan==='pro'?'Pro':'Free'))+' is active');
  }catch(e){
    console.error('accountPickPlan',e);
    // Backend "Stripe obunasi kerak" desa — checkout'ga o'tamiz
    if(plan==='pro' && (e.status===403 || /stripe|obuna/i.test(e.message||''))){
      await startProCheckout();
    }else{
      showToast(e.message||'Plan wasn’t changed');
    }
  }finally{
    setPlanButtonsBusy(false);
  }
}

/** P8 — Pro obuna → Lemon Squeezy checkout (startCreditTopup naqshi). Eski Stripe
 *  yo'li (requestCheckout → STRIPE_NOT_CONFIGURED) olib tashlandi; backend
 *  POST /api/billing/checkout {plan:'pro'} allaqachon LS subscription URL beradi. */
async function startProCheckout(plan){
  plan=(plan==='studio')?'studio':'pro';
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn()){
    showToast('Sign in first to upgrade','info');
    if(typeof openAccountSheet==='function')openAccountSheet();
    return;
  }
  setPlanButtonsBusy(true);
  try{
    showToast('Opening payment page…');
    const d=await studioPost('/api/billing/checkout',{plan});
    if(!d||!d.url) throw new Error('No checkout URL returned');
    AssetFlowAccount.openExternal(d.url);
    showToast('Complete payment in your browser, then click "Refresh"');
  }catch(e){
    console.error('startProCheckout',e);
    const code=(e&&(e.code||(e.data&&e.data.code)))||'';
    if(code==='BILLING_NOT_CONFIGURED'||code==='VARIANT_NOT_FOUND'||code==='STRIPE_NOT_CONFIGURED'){
      showToast('Upgrades aren’t available right now — contact support','info');
    }else{
      showToast('Couldn’t open the payment page — try again','error');
    }
  }finally{
    setPlanButtonsBusy(false);
  }
}

/** FAZA 2 #25 — kredit paketi → Lemon Squeezy checkout (tashqi brauzerda).
 *  POST /api/billing/checkout {credits} LS hosted checkout URL qaytaradi;
 *  webhook (order_created) kreditni shu hisobga qo'shadi. */
let _topupBusy=false; // §H (P26) — web pariteti: double-submit guard (2-3 klik = 2-3 checkout sessiyasi bo'lmasin)
async function startCreditTopup(credits){
  if(typeof AssetFlowAccount==='undefined'||!AssetFlowAccount.isLoggedIn()){
    showToast('Sign in first to buy credits','info');
    if(typeof openAccountSheet==='function')openAccountSheet();
    return;
  }
  if(_topupBusy) return; _topupBusy=true;
  // Kredit paket tugmalarini vaqtincha o'chiramiz (vizual busy)
  const packs=document.querySelectorAll('.set-pack,.set-topup');
  packs.forEach(function(el){ el.style.pointerEvents='none'; el.style.opacity='.62'; });
  const reset=function(){ _topupBusy=false; packs.forEach(function(el){ el.style.pointerEvents=''; el.style.opacity=''; }); };
  try{
    showToast('Opening payment page…');
    const d=await studioPost('/api/billing/checkout',{credits:Number(credits)||500});
    if(!d||!d.url) throw new Error('No checkout URL returned');
    AssetFlowAccount.openExternal(d.url);
    showToast('Complete payment in your browser, then click "Refresh"');
  }catch(e){
    console.error('startCreditTopup',e);
    showToast((e&&e.message)||"Payment isn't available right now",'error');
  }finally{
    reset();
  }
}
window.startCreditTopup=startCreditTopup;

async function manageBilling(){
  try{
    const url=await AssetFlowAccount.requestBillingPortal();
    if(url) AssetFlowAccount.openExternal(url);
    else showToast('No billing account');
  }catch(e){
    showToast(e.message||'Couldn’t open billing');
  }
}

async function refreshAccountAndUi(){
  try{
    await AssetFlowAccount.fetchMe();
    refreshAccountUi();
    showToast('✓ Refreshed');
  }catch(e){
    showToast(e.message||'Refresh failed');
  }
}

window.accountPickPlan=accountPickPlan;
window.startProCheckout=startProCheckout;
window.manageBilling=manageBilling;
window.refreshAccountAndUi=refreshAccountAndUi;
window.openAccountSheet=openAccountSheet;
window.closeAccountSheet=closeAccountSheet;
window.accountLogin=accountLogin;
window.accountLogout=accountLogout;

/* ===== Contributor Publish ===== */
function evalP(script){
  return new Promise((resolve)=>{
    if(!csInterface){resolve('');return;}
    csInterface.evalScript(script,(r)=>resolve(r||''));
  });
}

function pubSceneKey(name){
  return (String(name||'').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80))||'scene';
}

/**
 * Sahnalar papkasini avtomatik aniqlash (02.Scene). Scoring:
 *  - nomi "scene"/"scenes" (raqam/nuqta prefiks tashlanadi) → +100
 *  - "Scene_01" kabi per-scene asset papkasi → katta jarima (footage papkasi)
 *  - chuqurroq joylashgan papka → jarima (yuqori darajadagi 02.Scene afzal)
 *  - ichida ko'p comp bo'lsa → bonus (sahnalar papkasida sahnalar bor)
 */
function pickScenesFolder(folders, tree){
  if(!folders||!folders.length) return '';
  var compCount={};
  (tree||[]).forEach(function(n){
    if(n&&n.type==='comp'&&n.folder){ compCount[n.folder]=(compCount[n.folder]||0)+1; }
  });
  function coreName(name){
    return String(name||'').toLowerCase().replace(/^[\s\d._\-]+/,'').replace(/[\s._\-]+$/,'');
  }
  var best=null,bestScore=-1e9,i,f,score,core,depth;
  for(i=0;i<folders.length;i++){
    f=folders[i];
    core=coreName(f.name);
    score=0;
    if(core==='scene'||core==='scenes') score+=100;
    else if(core.indexOf('scene')>=0) score+=25;
    else score-=50;
    if(/scene[\s_\-]*\d+$/i.test(String(f.name||''))) score-=200;
    depth=(String(f.path||'').match(/\//g)||[]).length;
    score-=depth*15;
    score+=(compCount[f.path]||0)*8;
    if(score>bestScore){ bestScore=score; best=f; }
  }
  return (best&&bestScore>0)?best.path:'';
}

function pubAuthHeaders(){
  return (typeof AssetFlowAccount!=='undefined')?AssetFlowAccount.authHeaders():{};
}
function pubApiBase(){
  if(typeof AssetFlowAccount!=='undefined') return AssetFlowAccount.apiBase();
  return (typeof ASSETFLOW_ENV!=='undefined')?ASSETFLOW_ENV.defaultApi():'https://api.getframeflow.app';
}

/** 30s timeout bilan fetch — publish so'rovlari cheksiz osilib qolmasin */
function pubFetch(path,opts,ms){
  opts=opts||{};
  if(typeof AbortController==='undefined') return fetch(pubApiBase()+path,opts);
  const ctrl=new AbortController();
  const timer=setTimeout(function(){ctrl.abort();},ms||30000);
  return fetch(pubApiBase()+path,Object.assign({},opts,{signal:ctrl.signal}))
    .catch(function(e){ if(e&&e.name==='AbortError'){throw new Error('Server did not respond (timed out)');} throw e; })
    .finally(function(){ clearTimeout(timer); });
}

async function pubJson(path,body,method){
  const res=await pubFetch(path,{
    method:method||'POST',
    headers:Object.assign({'Content-Type':'application/json'},pubAuthHeaders()),
    body:JSON.stringify(body||{})
  });
  const txt=await res.text();let data;try{data=txt?JSON.parse(txt):null;}catch(e){data={raw:txt};}
  if(!res.ok) throw new Error((data&&data.error)||('HTTP '+res.status));
  return data;
}

/** Shu contributor'ning bir xil externalId yoki nomli shablonini topadi (dublikat oldini olish) */
async function pubFindExisting(externalId,name){
  try{
    const res=await pubFetch('/api/contributor/templates?mine=1',{headers:pubAuthHeaders()});
    if(!res.ok) return null;
    const data=await res.json();
    const items=data.items||[];
    const nm=String(name||'').toLowerCase();
    return items.filter(function(t){return externalId&&t.externalId===externalId;})[0]
        || items.filter(function(t){return String(t.name||'').toLowerCase()===nm;})[0]
        || null;
  }catch(e){ return null; }
}

/** Fayl yuklash — XHR orqali (upload progress bilan). onProgress(loaded,total) ixtiyoriy. */
function pubUpload(path,formData,onProgress){
  return new Promise(function(resolve,reject){
    const xhr=new XMLHttpRequest();
    xhr.open('POST',pubApiBase()+path);
    const h=pubAuthHeaders();
    Object.keys(h).forEach(function(k){ try{ xhr.setRequestHeader(k,h[k]); }catch(e){} });
    if(onProgress&&xhr.upload){
      xhr.upload.onprogress=function(e){ if(e.lengthComputable) onProgress(e.loaded,e.total); };
    }
    xhr.onload=function(){
      let data;try{data=xhr.responseText?JSON.parse(xhr.responseText):null;}catch(e){data={raw:xhr.responseText};}
      if(xhr.status>=200&&xhr.status<300) resolve(data);
      else reject(new Error((data&&data.error)||('HTTP '+xhr.status)));
    };
    xhr.onerror=function(){ reject(new Error('Network error — check your internet or the API URL')); };
    xhr.ontimeout=function(){ reject(new Error('Upload timed out (5 min)')); };
    xhr.timeout=300000;
    xhr.send(formData);
  });
}

/**
 * #61 — presigned PUT (to'g'ridan bulutga, server tanasidan o'tmasdan).
 * Authorization YUBORILMAYDI: imzo buziladi. Faqat Content-Type.
 */
function pubPutSigned(url,blob,contentType,onProgress){
  return new Promise(function(resolve,reject){
    const xhr=new XMLHttpRequest();
    xhr.open('PUT',url);
    try{ xhr.setRequestHeader('Content-Type',contentType||'application/octet-stream'); }catch(e){}
    if(onProgress&&xhr.upload){
      xhr.upload.onprogress=function(e){ if(e.lengthComputable) onProgress(e.loaded,e.total); };
    }
    xhr.onload=function(){
      if(xhr.status>=200&&xhr.status<300) resolve();
      else reject(new Error('Upload failed (HTTP '+xhr.status+')'));
    };
    xhr.onerror=function(){ reject(new Error('Network error — check your internet or the API URL')); };
    xhr.ontimeout=function(){ reject(new Error('Upload timed out')); };
    xhr.timeout=1800000; // 30 daq — GB'lik pack sekin ulanishda
    xhr.send(blob);
  });
}

function fileToBlob(p,type){
  const fs=__ffRequire('fs');
  const buf=fs.readFileSync(p);
  return new Blob([buf],{type:type||'application/octet-stream'});
}

function buildPackZip(projectFile){
  const path=__ffRequire('path'),fs=__ffRequire('fs'),os=__ffRequire('os'),child=__ffRequire('child_process');
  const dir=path.dirname(projectFile);
  const aep=path.basename(projectFile);
  const out=path.join(os.tmpdir(),'assetflow_pack_'+Date.now()+'.zip');
  const entries=[aep];
  ['(Footage)','Footage','(footage)','footage'].forEach(function(f){
    try{ if(fs.existsSync(path.join(dir,f))) entries.push(f); }catch(e){}
  });
  child.execFileSync('zip',['-r','-q',out].concat(entries),{cwd:dir,timeout:180000});
  return { path:out, size:fs.statSync(out).size, name:aep };
}

function openPublish(){
  closeAccountSheet();
  document.getElementById('publishSheet').classList.add('open');
  ['pubFolderStep','pubScenesStep','pubMetaStep','pubActionStep'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  document.getElementById('pubStatus').textContent='';
  var rc=document.getElementById('pubRights'); if(rc){ rc.checked=false; }
  pubRightsSync();
  if(IS_CEP){ publishScan(); }
  else{ document.getElementById('pubProjectInfo').textContent='Only works inside Premiere Pro'; }
}
function closePublish(){ document.getElementById('publishSheet').classList.remove('open'); }
/** Rights-attestation checkbox → Publish tugmasini yoqadi/o'chiradi (majburiy). */
function pubRightsSync(){
  var rc=document.getElementById('pubRights');
  var btn=document.getElementById('pubGoBtn');
  if(!btn) return;
  var ok=!!(rc&&rc.checked);
  btn.disabled=!ok;
  btn.style.opacity=ok?'1':'.5';
}
window.pubRightsSync=pubRightsSync;

async function publishScan(){
  const info=document.getElementById('pubProjectInfo');
  if(!IS_CEP){ info.textContent='Only available inside Premiere Pro'; return; }
  info.textContent='Scanning…';
  const raw=await evalP('refreshProjectPanel()');
  let data;try{data=JSON.parse(raw);}catch(e){data=null;}
  if(!data||!data.ok){ info.textContent=(data&&data.message)||'Project not found'; return; }
  if(!data.saved){ info.textContent='⚠ Project not saved — use File → Save, then scan again'; return; }
  window.__pubProject={file:data.projectFile,name:data.projectName};
  info.innerHTML='✓ <b>'+data.projectName+'</b> · '+data.compCount+' comps · '+data.folderCount+' folders';
  const sel=document.getElementById('pubScenesFolder');
  const folders=data.folders||[];
  sel.innerHTML='<option value="">— choose a folder —</option>'+folders.map(function(f){
    return '<option value="'+String(f.path).replace(/"/g,'&quot;')+'">'+f.path+'</option>';
  }).join('');
  const guessPath=pickScenesFolder(folders,data.tree||[]);
  document.getElementById('pubFolderStep').style.display='block';
  document.getElementById('pubName').value=data.projectName||'';
  if(guessPath){
    sel.value=guessPath;
    info.innerHTML+=' · <b style="color:var(--accent-2)">'+guessPath+'</b> selected automatically';
    publishDetectScenes();
  }
}

async function publishDetectScenes(){
  const folder=document.getElementById('pubScenesFolder').value;
  const listEl=document.getElementById('pubScenesList');
  const hide=function(){['pubScenesStep','pubMetaStep','pubActionStep'].forEach(function(id){document.getElementById(id).style.display='none';});};
  if(!folder){ hide(); return; }
  const os=__ffRequire('os'),path=__ffRequire('path');
  const exportRoot=path.join(os.tmpdir(),'assetflow_pub_previews');
  document.getElementById('pubScenesStep').style.display='block';
  listEl.innerHTML='<div class="account-hint">Rendering mid-frames…</div>';
  const cfg=JSON.stringify({scenesFolder:folder,exportRoot:exportRoot});
  const raw=await evalP('renderSceneStillFrames('+JSON.stringify(cfg)+')');
  let data;try{data=JSON.parse(raw);}catch(e){data=null;}
  if(!data||!data.ok){ listEl.innerHTML='<div class="account-hint">'+((data&&data.message)||'No scenes found')+'</div>'; return; }
  window.__pubScenes=data.results;
  document.getElementById('pubScenesCount').textContent='('+data.results.length+')';
  const _checkSvg='<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm45.66 85.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32Z"/></svg>';
  listEl.innerHTML=data.results.map(function(s){
    const meta=(s.width&&s.height?s.width+'×'+s.height:'')+(s.fps?' · '+s.fps+'fps':'');
    const thumb=(s.ok&&s.path)?'<img class="pub-scene-thumb" src="file://'+encodeURI(s.path)+'">':'<div class="pub-scene-thumb">✦</div>';
    return '<div class="pub-scene-row'+(s.ok?'':' fail')+'"><span class="pub-scene-dot"></span>'+thumb+
      '<div class="pub-scene-txt"><div class="pub-scene-name">'+s.name+'</div>'+
      '<div class="pub-scene-meta">'+(s.ok?meta:'preview render failed')+'</div></div>'+
      (s.ok?'<span class="pub-scene-check">'+_checkSvg+'</span>':'')+'</div>';
  }).join('');
  document.getElementById('pubMetaStep').style.display='block';
  document.getElementById('pubActionStep').style.display='block';
}

async function publishGo(){
  const btn=document.getElementById('pubGoBtn');
  const status=document.getElementById('pubStatus');
  const scenes=window.__pubScenes||[];
  const proj=window.__pubProject;
  if(!proj||!proj.file){ status.textContent='Scan the project first'; return; }
  if(!scenes.length){ status.textContent='No scenes found'; return; }
  const name=document.getElementById('pubName').value.trim();
  if(!name){ status.textContent='Enter a name'; return; }
  const rightsChk=document.getElementById('pubRights');
  if(!rightsChk||!rightsChk.checked){ status.textContent='Please confirm you have the rights to distribute this content'; return; }
  const nav=document.getElementById('pubNav').value;
  const catLabel=document.getElementById('pubCat').value.trim()||'Templates';
  const cat=(catLabel.toLowerCase().replace(/[^a-z0-9]+/g,''))||'all';
  const orient=document.getElementById('pubOrient').value;
  const res=document.getElementById('pubRes').value;
  const tags=document.getElementById('pubTags').value.split(',').map(function(t){return t.trim();}).filter(Boolean);
  const description=document.getElementById('pubDesc').value.trim();
  const folder=document.getElementById('pubScenesFolder').value;
  const path=__ffRequire('path');

  const manifestScenes=scenes.map(function(s){
    const comp=s.aeComp||s.name;
    const resLbl=s.width>=3840?'4K':(s.width>=1920?'1080p':'HD');
    return {
      n:s.name, aeComp:comp, previewKey:pubSceneKey(comp),
      meta:resLbl+(s.fps?' · '+s.fps+'fps':''),
      width:s.width, height:s.height, fps:s.fps, durationSec:s.durationSec
    };
  });

  const externalId='ae-'+pubSceneKey(name);

  btn.disabled=true;
  // Joriy bosqich — xato bo'lsa qaysi qadamda ekani aniq ko'rinadi
  let stage='1/6 Zipping pack';
  const setStage=function(s){ stage=s; status.textContent=s+'…'; };
  try{
    setStage('1/6 Zipping pack');
    const zip=buildPackZip(proj.file);

    const body={
      name:name, description:description, nav:nav, cat:cat, catLabel:catLabel,
      orient:orient, res:res, tags:tags, templateApp:'ae', externalId:externalId,
      fileName:zip.name||path.basename(zip.path), fileSize:zip.size,
      metaJson:{ aeScenesFolder:folder }, scenes:manifestScenes,
      rightsAccepted:true, rightsTermsVersion:'2026-07-08'
    };

    setStage('2/6 Checking');
    const existing=await pubFindExisting(externalId,name);
    let id;
    if(existing){
      setStage('3/6 Updating existing template');
      await pubJson('/api/contributor/templates/'+existing.id, body, 'PATCH');
      id=existing.id;
    }else{
      setStage('3/6 Creating template');
      const tpl=await pubJson('/api/contributor/templates', body);
      id=tpl.id;
    }

    const zipMb=(zip.size/1048576).toFixed(1);
    setStage('4/6 Uploading pack ('+zipMb+' MB)');
    // #61 — pack endi TO'G'RIDAN bulutga (presigned PUT), multipart /assets orqali EMAS:
    // Cloud Run so'rov tanasi 32MB bilan cheklangan, Premiere pack'lari esa 100MB–GB.
    // Studio (studio-api.js uploadAssets) ham aynan shu yo'ldan boradi.
    const packName=path.basename(zip.path);
    const firstOk=scenes.filter(function(s){return s.ok&&s.path;})[0];
    const wanted=[{kind:'pack',fileName:packName,contentType:'application/zip'}];
    if(firstOk) wanted.push({kind:'thumb',fileName:'thumb.png',contentType:'image/png'});
    const signed=await pubJson('/api/contributor/templates/'+id+'/upload-url',{files:wanted});
    const ups=(signed&&signed.uploads)||[];
    const packUp=ups.filter(function(u){return u.kind==='pack';})[0];
    if(!packUp) throw new Error('Failed to get upload URL for pack');
    await pubPutSigned(packUp.url, fileToBlob(zip.path,'application/zip'), packUp.contentType, function(loaded,total){
      const pct=total?Math.round(loaded/total*100):0;
      const mb=total?(' · '+(loaded/1048576).toFixed(1)+'/'+(total/1048576).toFixed(1)+' MB'):'';
      status.textContent='4/6 Uploading pack… '+pct+'%'+mb;
    });
    const thumbUp=ups.filter(function(u){return u.kind==='thumb';})[0];
    if(firstOk&&thumbUp){
      await pubPutSigned(thumbUp.url, fileToBlob(firstOk.path,'image/png'), thumbUp.contentType);
    }
    // MAJBURIY signal: DB'ga fileName/fileSize yoziladi va .zip sahnalari FON'da ajratiladi.
    await pubJson('/api/contributor/templates/'+id+'/pack-uploaded',{fileName:packName});

    const okScenes=scenes.filter(function(s){return s.ok&&s.path;});
    if(okScenes.length){
      setStage('5/6 Uploading scene previews ('+okScenes.length+')');
      const sf=new FormData();
      okScenes.forEach(function(s){
        const key=pubSceneKey(s.aeComp||s.name);
        sf.append(key, fileToBlob(s.path,'image/png'), key+'.png');
      });
      await pubUpload('/api/contributor/templates/'+id+'/scene-previews', sf, function(loaded,total){
        const pct=total?Math.round(loaded/total*100):0;
        status.textContent='5/6 Uploading scene previews… '+pct+'%';
      });
    }

    const cu=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null;
    const isAdmin=cu&&cu.role==='ADMIN';
    if(isAdmin){
      setStage('6/6 Approving');
      await pubJson('/api/contributor/templates/'+id+'/review', {action:'approve',published:true});
    }else{
      setStage('6/6 Sending for moderation');
      await pubJson('/api/contributor/templates/'+id+'/submit', {});
    }

    showToast('✓ "'+name+'" '+(existing?'updated':'published')+(isAdmin?' and approved':' — waiting for admin approval'),'success');
    closePublish();
    if(isAdmin&&typeof AssetFlowCatalog!=='undefined'){
      try{ await AssetFlowCatalog.refreshBrowse(catalogFilters()); }catch(e){}
    }
  }catch(e){
    console.error('publishGo',e);
    const friendly=(typeof friendlyError==='function')?friendlyError(e):(e.message||'unknown');
    status.textContent='Error ['+stage+']: '+friendly;
  }finally{
    btn.disabled=false;
  }
}

window.openPublish=openPublish;
window.closePublish=closePublish;
window.publishScan=publishScan;
window.publishDetectScenes=publishDetectScenes;
window.publishGo=publishGo;

/** host.jsx ni majburan qayta yuklaydi — Premiere restartisiz yangi funksiyalar uchun */
async function reloadHostScript(){
  if(!IS_CEP||!csInterface)return false;
  try{
    const ext=csInterface.getSystemPath(SystemPath.EXTENSION);
    const jsxPath=(ext+'/jsx/host.jsx').replace(/\\/g,'/');
    const raw=await new Promise(res=>csInterface.evalScript('try{$.evalFile('+JSON.stringify(jsxPath)+');"ok"}catch(e){"err"}',r=>res(r||'')));
    return raw==='ok';
  }catch(e){ return false; }
}

// #143 (PX6) — o'rnatilgan kengaytma versiyasi (CSXS manifestidan). CEP tashqarisida null.
function afExtVersion(){
  try{
    if(typeof CSInterface==='undefined')return null;
    const cs=new CSInterface(); const id=cs.getExtensionID&&cs.getExtensionID();
    const list=(cs.getExtensions?cs.getExtensions(id?[id]:undefined):null)||[];
    for(let i=0;i<list.length;i++){ if(list[i]&&list[i].version)return String(list[i].version); }
  }catch(e){}
  return null;
}

async function bootPlugin(){
  // Build yorlig'i — shtamplanmagan bo'lsa (manbadan ishga tushirilgan) "dev".
  // Token BO'LIB yozilgan — install-cep.sh sed'i bu tekshiruvga tegmasin (faqat element shtamplanadi).
  try{
    const _b=document.getElementById('afBuild');const _ph='__AF_'+'BUILD__';
    const _isDev=!!(_b&&_b.textContent.indexOf(_ph)>=0);
    // #143 (PX6): ZXP reliz paketi shtamp URMAYDI (paket baytlari manba bilan AYNAN teng
    // bo'lishi shart — marketplace-preflight shu qoidani tekshiradi), shuning uchun ilgari
    // mijozda ham "build: dev" chiqardi. Endi shtamplanmagan bo'lsa manifest versiyasini
    // CEP'dan so'raymiz; faqat u ham yo'q bo'lsa "dev" (haqiqiy manba ishga tushirilishi).
    if(_isDev)_b.textContent='build: '+(afExtVersion()||'dev');
    // DEV·DEMO gate olib tashlandi — bo'limning o'zi o'chirildi (soxta demo holatlari
    // mijoz paketiga tushmasin). Bu yerda faqat build yorlig'i qoladi.
  }catch(e){}
  initEnvFilterUi();
  initAccountUi();
  try{ afInitAllStrips(); afFitTopbar(); }catch(e){} // SC_35: pill strip'lar + top-bar fit boshlang'ich
  if(typeof AssetFlowLog!=='undefined') AssetFlowLog.init({ source:'ae_plugin' });
  if(IS_CEP){
    const c=document.getElementById('container');
    if(c){c.style.width='100%';c.style.height='100vh';}
    setupCepMetaListener();
    reloadHostScript();
  }
  try{
    // BIRINCHI ekran = Asosiy (Home). Katalog cold-start (~50s) await'idan OLDIN ko'rsatamiz,
    // shunda plagin har ochilganda Home'dan boshlanadi (Shablonlar emas).
    try{ wireHome(); goHome(); }catch(e){}
    if(typeof AssetFlow!=='undefined') await AssetFlow.init();
    loadUserPrefs();
    // P34 — 14+ kunlik eski extract papkalari (assetflow_mogrt_*/extract_*): fon rejimida, xatolar e'tiborsiz
    if(IS_CEP&&typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.pruneOldTempDirs){ try{ AssetFlowCatalog.pruneOldTempDirs(); }catch(e){} }
    try{ syncFavoritesFromServer(); }catch(e){} // #17: hisob sevimlilari (plagin↔web)
    // Retry'lar katalog yuklanishini bloklamasin — parallel ishlaydi
    refreshAccountFromApi();
    if(typeof AssetFlowStore!=='undefined'){
      await AssetFlowStore.hydrateBlobUrls(AssetFlowStore.listMeta());
      const localN=mergeLocalUploads();
      // Katalog kelguncha skeleton/spinner ko'rsatamiz (Render cold start ~50s)
      catalogLoadState='loading';
      render();
      let serverN=0;
      if(typeof AssetFlowCatalog!=='undefined'){
        try{
          serverN=await AssetFlowCatalog.refreshBrowse(catalogFilters());
          catalogLoadState='ready';
        }catch(catErr){
          catalogLoadState='error';   // grid'da «Qayta urinish» tugmasi chiqadi
          console.warn('Server catalog',catErr);
        }
      }else{
        catalogLoadState='ready';
      }
      reconcileDownloadedFromScenes();
      // Katalog cold-start (~50s) tugadi. Foydalanuvchi shu vaqt ichida AI Tools / bo'limga
      // o'tgan bo'lishi mumkin — uни Home'ga QAYTARMAYMIZ. Faqat hali Home'da bo'lsa,
      // katalogni tayyorlab Home'da qoldiramiz (Home BIRINCHI ekran — early goHome yuqorida bajarilgan).
      if(document.documentElement.classList.contains('home-mode')){
        // SC_38 — noReload: katalog yuqorida shu filtrlar bilan yuklangan; ikkinchi
        // (takroriy) catalog+featured so'rovi endi otilmaydi (boot double-fetch fix).
        applyNavSwitch('video',{noReload:true}); // currentNav + yuklangan katalog grid render
        try{ goHome(); }catch(e){} // home-mode'ni qaytaramiz (foydalanuvchi hali Home'da edi)
      }
      const total=localN+serverN;
      if(catalogLoadState==='error'){
        // Xato toast'i catalog.js'da chiqdi, grid'da Retry tugmasi bor — qo'shimcha shart emas
        if(typeof AssetFlowLog!=='undefined') AssetFlowLog.error('Catalog failed to load',{action:'catalog_error'});
      }else if(!total){
        showToast('No templates yet — add one via Studio','info');
        if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Library is empty',{action:'catalog_empty'});
      }else{
        if(typeof AssetFlowLog!=='undefined') AssetFlowLog.info('Catalog loaded',{action:'catalog_ready',detail:String(total)+' templates'});
        if(serverN>0&&typeof AssetFlowCatalog!=='undefined'){
          const where=AssetFlowCatalog.primaryServerNav();
          showToast(serverN+' approved · "'+AssetFlowCatalog.navHint(where)+'"','success');
          updateServerNavBadges();
        }
      }
    }else{
      showToast('AssetFlowStore failed to load');
      if(typeof AssetFlowLog!=='undefined') AssetFlowLog.error('AssetFlowStore failed to load',{action:'boot'});
    }
  }catch(err){
    console.error(err);
    showToast('Load error: '+(err.message||'unknown'));
    if(typeof AssetFlowLog!=='undefined') AssetFlowLog.error(err.message||'boot error',{action:'boot'});
  }
}
