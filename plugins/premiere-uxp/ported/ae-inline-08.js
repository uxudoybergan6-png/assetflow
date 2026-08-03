
/* Video yaratish tool — Seedance 2.0 Fast (fal.ai image-to-video). */
(function(){
  var $=function(id){return document.getElementById(id);};
  if(!$('v-vidgen'))return;
  var IS_CEP=(typeof window.__adobe_cep__!=='undefined');

  // model + sozlama holati (videoSettings deskriptoridan yuklangach to'ldiriladi)
  // P8: pre-load defaultlar joriy default video modelga (Veo 3.1 Lite, id 3001) mos.
  var vm={loaded:false,model:null,res:'720p',dur:'8',ar:'16:9',audio:false,bitrate:'standard',refKind:'frames',
    mediaRefs:{image:9,video:3,audio:3,total:12},
    mediaRefFormats:null,mediaRefMaxTotalBytes:null,videoInputCostMult:0,pricing:'per-second',flatCost:0,
    resOpts:['720p'],durOpts:['4','6','8'],bitOpts:['standard','high'],
    arOpts:['16:9','9:16'],audioSupported:false,
    perSec:{'720p':3},autoSec:8,sessionId:null};
  // kadr holati (refKind=frames) + ko'p-modal referens (refKind=media-refs)
  var st={start:null,end:null}; // {dataUrl, url, loading}
  var mref=[]; // [{type:'image'|'video'|'audio', dataUrl, url, loading}]
  var vgSaved={items:[],loaded:false,loading:false,error:'',ttlMs:600000};
  var vgClip={src:null,meta:null,url:'',startSec:0,endSec:0,lastStartSec:0,lastEndSec:0,totalSec:0,mode:'part',drag:null,busy:false,includeAudio:false};

  function toast(t,k){ if(typeof showToast==='function')showToast(t,k); }
  function brandLabel(b){
    var m={bytedance:'ByteDance',openai:'OpenAI',google:'Google',kling:'Kling',kwaivgi:'Kling',alibaba:'Alibaba',bfl:'Black Forest Labs',luma:'Luma'};
    var s=String(b||'').toLowerCase();
    return m[s]||String(b||'AI');
  }
  // Model-sheet ikonka harflari — brendga qarab (B11: avval har modelда 'BD' edi).
  function brandInitials(b){
    var s=String(b||'').toLowerCase();
    var m={bytedance:'BD',openai:'AI',google:'G',kling:'KL',kwaivgi:'KL',alibaba:'AL',bfl:'BF',luma:'LU'};
    return m[s]||(s?s.slice(0,2).toUpperCase():'AI');
  }
  function vgModelSubtitle(m){
    if(!m)return 'Video model';
    var brand=brandLabel(m.brand);
    if(m.refKind==='media-refs'||m.feature==='reference-to-video')return brand+" · R2V (multi-modal)";
    if(m.refKind==='frames'||m.feature==='image-to-video')return brand+' · i2v (frame)';
    if(m.refKind==='none')return brand+' · text-to-video';
    return brand+' · video model';
  }
  function vgGuideText(){
    return vm.refKind==='media-refs'
      ? "<b>R2V:</b> Add up to 9 images, 3 videos, and 3 audio clips. Reference them in the prompt as <b>@Image1</b>, <b>@Video1</b>, <b>@Audio1</b>."
      : vm.refKind==='none'
      ? "<b>Text-to-video:</b> No reference needed. Just write a prompt to generate a video."
      : "<b>Fast:</b> Add a start frame, optionally pick an end frame, then write a prompt to generate a video.";
  }
  function vgPromptPlaceholder(){
    // SC_42: bitta qisqa qator — uzun "(@Image1 / @Video1 / @Audio1)" tail @-menyu/tooltip'ga ko'chdi
    return vm.refKind==='media-refs'
      ? 'Describe the shot… @ for references'
      : vm.refKind==='none'
      ? 'Describe the scene, motion, camera and style…'
      : 'Describe the shot… @ for references';
  }
  function applyVgGuide(){
    var g=$('vgGuide'); if(g)g.innerHTML=vgGuideText();
  }
  function applyVgPromptUi(){
    // SC_42: vgPrompt = contenteditable → placeholder data-ph orqali (:empty::before)
    var ta=$('vgPrompt'); if(ta){ ta.placeholder=vgPromptPlaceholder(); ta.setAttribute('data-ph',vgPromptPlaceholder()); }
  }
  function setVgWarn(msg){
    var w=$('vgWarn'); if(!w)return;
    var txt=w.querySelector('span:last-child');
    if(txt)txt.textContent=String(msg||'');
    w.style.display=msg?'':'none';
  }
  function vgPromptValue(){ return (($('vgPrompt')&&$('vgPrompt').value)||'').trim(); }
  // #6 — chip-editor (rasm tool bilan UMUMIY window.afChipEditor): pill = thumb + "@Image 1".
  // Video tool kanonik tokenlari tokFor bilan bir xil: @ImageN/@VideoN/@AudioN (strip/renumber mos).
  var vgEd=window.afChipEditor($('vgPrompt'),{
    refs:function(){
      var im=[],vd=[],au=[];
      mref.forEach(function(r){
        if(r.type==='image')im.push(r.dataUrl||r.url||null);
        else if(r.type==='video')vd.push(null); // poster yo'q → glyph fallback
        else au.push(null);
      });
      return {image:im,video:vd,audio:au};
    },
    token:function(kind,n){ return '@'+(kind==='image'?'Image':kind==='video'?'Video':'Audio')+n; },
    interceptEnter:function(){ var m=$('vgMention'); return (m&&m.classList.contains('on'))?pickVgMentionActive():false; },
    // P15 — undo snapshoti media-referens hovuzi (mref) + start/end kadrni ham saqlaydi/tiklaydi
    snapshotRefs:function(){ var im=[],vd=[],au=[]; mref.forEach(function(r){ if(r.type==='image')im.push(r.dataUrl||r.url||null); else if(r.type==='video')vd.push(null); else au.push(null); }); return {image:im,video:vd,audio:au,raw:mref.slice(),start:st.start,end:st.end}; },
    restoreRefs:function(rs){ mref=(rs&&rs.raw)?rs.raw.slice():[]; st.start=(rs&&rs.start)||null; st.end=(rs&&rs.end)||null; try{ renderMediaRefs(); renderFrameBoxes(); updRefMeta(); refreshVgBtn(); }catch(e){} }
  });
  function credits(){ try{ var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null; return (u&&typeof u.aiCredits==='number'&&isFinite(u.aiCredits))?u.aiCredits:null; }catch(e){ return null; } }
  function setCreditChip(v){ var cr=$('vgCredit'); if(cr)cr.innerHTML='<span class="cs">✦</span> '+((v!=null)?Number(v).toLocaleString('en-US'):'—'); if(typeof window.afSyncCredits==='function')window.afSyncCredits(v); }
  function durSec(){ var d=vm.dur; return (!d||d==='Auto'||d==='auto')?vm.autoSec:(parseInt(d)||vm.autoSec); }
  // SC_27: nisbat param aniqligi — UI chip 'Auto' (katta harf), backend enum esa 'auto' (gen-models aspects).
  function vgAspectParam(){ return /^auto$/i.test(String(vm.ar||''))?'auto':vm.ar; }
  function hasVideoRefs(){ return mref.some(function(r){ return r.type==='video' && r.url; }); }
  function ratePerSec(){
    var base=(vm.perSec[vm.res]||12);
    if(vm.refKind==='media-refs' && hasVideoRefs() && vm.videoInputCostMult && vm.videoInputCostMult>0){
      return Math.max(1,Math.round(base*vm.videoInputCostMult));
    }
    return base;
  }
  function cost(){ return vm.pricing==='per-generation'?(vm.flatCost||0):(ratePerSec()*durSec()); }
  function recost(){
    var c=$('vgCost'); if(!c)return;
    if(vm.pricing==='per-generation'){ c.textContent='✦'+cost(); c.title='Fixed price: ✦'+cost()+' / video'; }
    else {
      var auto=(!vm.dur||/^auto$/i.test(String(vm.dur)));
      // Auto bo'lsa qancha soniyaga to'lashini ko'rsatamiz (✦48 (~4s)) — narx qaydan kelganini foydalanuvchi ko'rsin.
      c.textContent='✦'+cost()+(auto?(' (~'+durSec()+'s)'):'');
      var hasMult=(vm.refKind==='media-refs'&&hasVideoRefs()&&vm.videoInputCostMult&&vm.videoInputCostMult>1);
      c.title='Price ≈ ✦'+ratePerSec()+'/s × '+durSec()+'s'+(auto?' (Auto)':'')+(hasMult?' · video reference increases the price':'');
    }
    vgCreditGate(); // P22 — banner + kredit chip (komitilgan kreditni hisobga olib). Tugma refreshVgBtn'da.
  }
  // P22 — video "kredit yetmaydi" darvozasi: BOSISHDAN OLDIN; balans uchayotgan ishlarga komitilgan
  //   kreditni hisobga oladi (P22.2). Money-zona: faqat ko'rsatish/darvoza — server atomik.
  function vgCreditGate(){
    var cr=credits(), need=cost();
    var committed=(activeJobs||[]).reduce(function(a,j){ return a+(j.jcost||0); },0);
    var avail=(cr!=null)?(cr-committed):null;
    var low=(avail!=null)&&(need>avail);
    window.afLowCred('vg',low,window.afLowCredNeed(need,avail)); // D7: umumiy banner helper
    var chip=$('vgCredit'); if(chip)chip.classList.toggle('low',low);
    return low;
  }
  function fmtMb(n){ return Math.round((Number(n||0)/(1024*1024))*10)/10; }
  function fmtClockSec(sec){
    sec=Math.max(0,Number(sec)||0);
    var m=Math.floor(sec/60), s=Math.floor(sec%60), ms=Math.round((sec-Math.floor(sec))*10);
    return m+':'+String(s).padStart(2,'0')+(ms?'.'+ms:'');
  }
  function extAllowed(type,path){
    var opts=mediaExts(type), e=ext(path);
    return !opts.length || opts.indexOf(e)>=0;
  }
  function ext(p){
    var s=String(p||'').split(/[?#]/)[0];
    var m=s.match(/\.([a-z0-9]{2,6})$/i);
    return m?String(m[1]).toLowerCase():'';
  }
  function savedRefFormatAllowed(type,it){
    if(extAllowed(type,(it&&it.url)||''))return true;
    if(extAllowed(type,(it&&it.thumbUrl)||''))return true;
    var ct=String((it&&it.contentType)||'').toLowerCase();
    if(!ct)return !!(it&&it.id&&type===refTypeFromItem(it));
    if(type==='image')return ct.indexOf('image/')===0;
    if(type==='video')return ct.indexOf('video/')===0;
    return ct.indexOf('audio/')===0;
  }
  function mime(p){ var e=ext(p);
    var V={mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m4v:'video/mp4'};
    var A={mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg'};
    if(V[e])return V[e]; if(A[e])return A[e]; // R2V video/audio referens — to'g'ri content-type (ref-upload qabul qiladi)
    return e==='jpg'?'image/jpeg':((e==='tif'||e==='tiff')?'image/tiff':(e==='svg'?'image/svg+xml':'image/'+(e||'png'))); }
  function isImg(p){ return /\.(png|jpe?g|webp|gif|bmp|tiff?|avif|heic)$/i.test(String(p||'')); }
  // ── CEP fayl o'qish — igScript bilan bir xil isbotlangan yo'l ──
  // showOpenDialog `file:///path` qaytarishi mumkin; cep.fs bunday yo'lda ENOENT beradi.
  // toFsPath: file:// striplash + URI-decode. nodeRequire: Node fs → cep.fs fallback.
  function nodeRequire(n){ try{if(typeof require==='function')return __ffRequire(n);}catch(e){} try{if(typeof cep_node!=='undefined'&&cep_node&&cep_node.require)return cep_node.__ffRequire(n);}catch(e){} try{if(window.cep_node&&window.cep_node.require)return window.cep_node.__ffRequire(n);}catch(e){} try{if(typeof window.require==='function')return window.__ffRequire(n);}catch(e){} return null; }
  function toFsPath(p){ if(!p)return p; p=String(p); if(p.indexOf('file://')===0)p=p.replace(/^file:\/\//,''); try{p=decodeURIComponent(p);}catch(e){} return p; }
  function readFileBuffer(path){
    var fp=toFsPath(path);
    try{
      var fsmod=nodeRequire('fs');
      if(fsmod&&fsmod.readFileSync){
        var buf=fsmod.readFileSync(fp);
        if(buf&&buf.length)return buf;
      }
    }catch(e){}
    return null;
  }
  function readFileStat(path){
    var fp=toFsPath(path);
    try{
      var fsmod=nodeRequire('fs');
      if(fsmod&&fsmod.statSync)return fsmod.statSync(fp);
    }catch(e){}
    return null;
  }
  function baseName(path){
    var fp=toFsPath(path);
    return String(fp||'').split(/[\\/]/).pop()||'reference.bin';
  }
  function readDataUrl(path){
    var fp=toFsPath(path);
    try{ var fsmod=nodeRequire('fs'); if(fsmod&&fsmod.readFileSync){ var buf=fsmod.readFileSync(fp); if(buf&&buf.length)return 'data:'+mime(fp)+';base64,'+buf.toString('base64'); } }catch(e1){}
    try{ if(window.cep&&window.cep.fs&&window.cep.fs.readFile){ var enc=(window.cep.encoding&&window.cep.encoding.Base64)||'Base64'; var r=window.cep.fs.readFile(fp,enc); if(r&&(r.err===0||r.err==null)&&r.data)return 'data:'+mime(fp)+';base64,'+r.data; } }catch(e2){}
    return null;
  }
  function probeBlobMeta(blob,type){
    return new Promise(function(resolve,reject){
      if(typeof URL==='undefined'||!URL.createObjectURL){ reject(new Error('META_UNAVAILABLE')); return; }
      var el=document.createElement(type==='audio'?'audio':'video');
      var url=URL.createObjectURL(blob), done=false;
      var clean=function(){ try{ URL.revokeObjectURL(url); }catch(_){} if(el){ el.removeAttribute('src'); try{ el.load(); }catch(_){} } };
      el.preload='metadata';
      el.onloadedmetadata=function(){
        if(done)return; done=true;
        var meta={ duration:Number(el.duration)||0, width:Number(el.videoWidth)||0, height:Number(el.videoHeight)||0, sizeBytes:Number(blob.size)||0 };
        clean(); resolve(meta);
      };
      el.onerror=function(){ if(done)return; done=true; clean(); reject(new Error('META_LOAD_FAILED')); };
      el.src=url;
    });
  }
  async function inspectMediaSource(src,type){
    if(!src||type==='image')return null;
    if(src.meta)return src.meta;
    var fp=src.path||'';
    var buf=readFileBuffer(fp);
    if(!buf||!buf.length||typeof Blob==='undefined')return null;
    var meta=await probeBlobMeta(new Blob([new Uint8Array(buf)],{type:mime(fp)}),type);
    src.meta=meta;
    if(!src.sizeBytes&&meta&&meta.sizeBytes)src.sizeBytes=meta.sizeBytes;
    return meta;
  }
  // Node https PUT — katta faylni presigned URL'ga TO'G'RIDAN GCS'ga yuboradi (CORS/panel cheklovisiz,
  // Cloud Run'ga tegmaydi → 32MB so'rov chegarasi YO'Q). Stream — xotira ikkilanmaydi.
  function nodePutFile(putUrl,fp,contentType,sizeBytes){
    return new Promise(function(resolve,reject){
      var https=nodeRequire('https'), fsmod=nodeRequire('fs'), urlmod=nodeRequire('url');
      if(!https||!fsmod){ reject(new Error('NODE_UNAVAILABLE')); return; }
      var u; try{ u=new (urlmod&&urlmod.URL?urlmod.URL:URL)(putUrl); }catch(e){ reject(new Error('URL error')); return; }
      var req=https.request({
        method:'PUT', hostname:u.hostname, port:u.port||443, path:u.pathname+u.search,
        headers:{ 'Content-Type':contentType||'application/octet-stream', 'Content-Length':sizeBytes }
      },function(res){
        var body=''; res.on('data',function(c){ if(body.length<500)body+=String(c); }); // Buffer globalisiz (CEP)
        res.on('end',function(){
          if(res.statusCode>=200&&res.statusCode<300){ resolve(true); }
          else reject(new Error('GCS PUT '+res.statusCode+': '+body.slice(0,200)));
        });
      });
      req.on('error',reject);
      req.setTimeout(300000,function(){ try{req.destroy(new Error('upload timeout'));}catch(_){} });
      fsmod.createReadStream(fp).on('error',reject).pipe(req);
    });
  }
  // Clip parametrlarini JSON tanaga qo'shadi (srcKey/srcUrl rejimlari uchun)
  function clipParamsJson(src){
    var b={};
    if(src){
      if(src.clipMode)b.clipMode=String(src.clipMode);
      if(typeof src.clipStartSec==='number'&&isFinite(src.clipStartSec))b.clipStartSec=src.clipStartSec;
      if(typeof src.clipEndSec==='number'&&isFinite(src.clipEndSec))b.clipEndSec=src.clipEndSec;
      if(src.extractAudioRef)b.extractAudioRef='1';
    }
    return b;
  }
  // Cloud Run so'rov tanasi ~32MB — bundan katta fayllar presigned PUT bilan to'g'ridan GCS'ga.
  var DIRECT_UPLOAD_THRESHOLD=30*1024*1024;
  async function studioUploadRefFromPath(srcOrPath){
    var src=(srcOrPath&&typeof srcOrPath==='object')?srcOrPath:null;
    var fp=toFsPath(src?src.path:srcOrPath);
    var st=readFileStat(fp);
    if(st&&st.size>100*1024*1024){
      var ex=new Error('Reference is too large — choose a file smaller than 100MB');
      ex.code='PAYLOAD_TOO_LARGE';
      ex.status=413;
      throw ex;
    }
    // KATTA fayl (30–100MB): presigned PUT → GCS, so'ng serverga srcKey (kesish/optimizatsiya odatdagidek).
    // Ilgari bu oraliq Cloud Run 32MB chegarasida 413 olib "100MB dan kichik tanlang" degan YOLG'ON xato berardi.
    if(st&&st.size>DIRECT_UPLOAD_THRESHOLD){
      var pre=await studioPost('/api/studio/gen/ref-upload-url',{contentType:mime(fp)||'application/octet-stream',sizeBytes:st.size,name:baseName(fp)},30000);
      if(!pre||!pre.url||!pre.key)throw new Error('Could not get upload URL for large file');
      await nodePutFile(pre.url,fp,mime(fp)||'application/octet-stream',st.size);
      var body=clipParamsJson(src); body.srcKey=pre.key;
      return studioPost('/api/studio/gen/ref-upload',body,300000);
    }
    var buf=readFileBuffer(fp);
    if(!buf||!buf.length)throw new Error('Could not read file');
    // AUDIT FIX: stat o'qilmagan (st=null) katta fayl ham presigned yo'lga tushsin — aks holda
    // multipart Cloud Run 32MB devoriga urilib yana yolg'on 413 berardi.
    if(buf.length>DIRECT_UPLOAD_THRESHOLD){
      if(buf.length>100*1024*1024){ var ex2=new Error('Reference is too large — choose a file smaller than 100MB'); ex2.code='PAYLOAD_TOO_LARGE'; ex2.status=413; throw ex2; }
      var pre2=await studioPost('/api/studio/gen/ref-upload-url',{contentType:mime(fp)||'application/octet-stream',sizeBytes:buf.length,name:baseName(fp)},30000);
      if(!pre2||!pre2.url||!pre2.key)throw new Error('Could not get upload URL for large file');
      await nodePutFile(pre2.url,fp,mime(fp)||'application/octet-stream',buf.length);
      var body2=clipParamsJson(src); body2.srcKey=pre2.key;
      return studioPost('/api/studio/gen/ref-upload',body2,300000);
    }
    if(typeof FormData==='undefined' || typeof Blob==='undefined'){
      throw new Error('FORM_UNAVAILABLE');
    }
    var form=new FormData();
    form.append('file',new Blob([new Uint8Array(buf)],{type:mime(fp)}),baseName(fp));
    if(src){
      if(src.clipMode)form.append('clipMode',String(src.clipMode));
      if(typeof src.clipStartSec==='number'&&isFinite(src.clipStartSec))form.append('clipStartSec',String(src.clipStartSec));
      if(typeof src.clipEndSec==='number'&&isFinite(src.clipEndSec))form.append('clipEndSec',String(src.clipEndSec));
      if(src.extractAudioRef)form.append('extractAudioRef','1');
    }
    return studioPostForm('/api/studio/gen/ref-upload',form,300000);
  }
  async function studioUploadRefUniversal(src){
    // So'nggi grid'dagi gen natijasi (bizning bucket URL) — fayl qayta yuklanmaydi: server o'zi
    // bucket'dan olib kesadi/optimizatsiya qiladi (srcUrl rejimi).
    if(src&&src.srcUrl){
      var body=clipParamsJson(src); body.srcUrl=src.srcUrl;
      return studioPost('/api/studio/gen/ref-upload',body,300000);
    }
    if(src&&src.path){
      try{
        return await studioUploadRefFromPath(src);
      }catch(err){
        if(!src.dataUrl)throw err;
        var msg=String((err&&err.message)||'');
        if((err&&err.code==='PAYLOAD_TOO_LARGE') || (err&&err.status===413))throw err;
        if(msg==='FORM_UNAVAILABLE')return studioPost('/api/studio/gen/ref-upload',{dataUrl:src.dataUrl},300000);
        if(err&&err.status===400)return studioPost('/api/studio/gen/ref-upload',{dataUrl:src.dataUrl},300000);
        throw err;
      }
    }
    if(src&&src.dataUrl)return studioPost('/api/studio/gen/ref-upload',{dataUrl:src.dataUrl},300000);
    throw new Error('No reference source found');
  }
  function removeLocalTemp(path){
    if(!path)return;
    try{
      var fsmod=nodeRequire('fs');
      if(fsmod&&fsmod.existsSync&&fsmod.unlinkSync&&fsmod.existsSync(path))fsmod.unlinkSync(path);
    }catch(_){}
  }
  function cleanupMediaSource(src){
    if(src&&src.cleanupPath)removeLocalTemp(src.cleanupPath);
  }
  function revokeClipUrl(){
    if(vgClip.url&&typeof URL!=='undefined'&&URL.revokeObjectURL){
      try{ URL.revokeObjectURL(vgClip.url); }catch(_){}
    }
    vgClip.url='';
    var v=$('vgClipVideo'); if(v){ try{ v.pause(); }catch(_){} v.removeAttribute('src'); try{ v.load(); }catch(_){} }
  }
  function resetVgClipper(){
    if(vgClip.src&&vgClip.src.previewUrl)try{ delete vgClip.src.previewUrl; }catch(_){ vgClip.src.previewUrl=''; }
    revokeClipUrl();
    vgClip={src:null,meta:null,url:'',startSec:0,endSec:0,lastStartSec:0,lastEndSec:0,totalSec:0,mode:'part',drag:null,busy:false,includeAudio:false};
    var apply=$('vgClipApply'); if(apply){ apply.textContent='Use this clip'; apply.setAttribute('aria-disabled','false'); }
  }
  function clipAudioSupported(){
    return vm.refKind==='media-refs' && !!(vm.mediaRefs&&vm.mediaRefs.audio);
  }
  function clipAudioCapacity(){
    var lim=vm.mediaRefs||{image:9,video:3,audio:3,total:12};
    return cntRef('audio')<lim.audio && mref.length<=lim.total-2;
  }
  function renderVgClipAudioUi(){
    var box=$('vgClipAudioBox'), tgl=$('vgClipAudioToggle'), hint=$('vgClipAudioHint');
    var supported=clipAudioSupported();
    var capacity=supported&&clipAudioCapacity();
    if(box)box.style.display=supported?'':'none';
    if(tgl){
      if(!supported||!capacity)vgClip.includeAudio=false;
      tgl.className='aud-toggle'+(vgClip.includeAudio?' on':'');
      tgl.setAttribute('aria-disabled',capacity?'false':'true');
    }
    if(hint){
      if(!supported)hint.textContent='This model does not support adding an audio reference from a video.';
      else if(!capacity)hint.textContent='No room left for an audio reference, or the limit is reached.';
      else hint.textContent='Video motion is added separately, and audio is added as its own @Audio reference.';
    }
  }
  function clipPreviewUrl(src){
    if(src&&src.previewUrl)return src.previewUrl;
    var fp=src&&src.path||'';
    var buf=readFileBuffer(fp);
    if(!buf||!buf.length||typeof Blob==='undefined'||typeof URL==='undefined'||!URL.createObjectURL)throw new Error('Could not open preview');
    var url=URL.createObjectURL(new Blob([new Uint8Array(buf)],{type:mime(fp)||'video/mp4'}));
    if(src)src.previewUrl=url;
    return url;
  }
  function renderVgClipUi(){
    var total=Math.max(0,Number(vgClip.totalSec)||0);
    var start=vgClip.mode==='full'?0:Math.max(0,Math.min(Number(vgClip.startSec)||0,total));
    var end=vgClip.mode==='full'?total:Math.max(start,Math.min(Number(vgClip.endSec)||0,total));
    var duration=Math.max(0,end-start);
    var maxDur=15;
    var over=duration>maxDur;
    var part=$('vgClipPart'), full=$('vgClipFull');
    if(part)part.classList.toggle('on',vgClip.mode!=='full');
    if(full)full.classList.toggle('on',vgClip.mode==='full');
    var sel=$('vgClipSel'), h1=$('vgClipH1'), h2=$('vgClipH2'), tl=$('vgClipTl');
    var startPct=total>0?(start/total*100):0, endPct=total>0?(end/total*100):100;
    if(sel){
      sel.style.left=startPct+'%';
      sel.style.width=Math.max(0,endPct-startPct)+'%';
      sel.className='sel'+(over?' w':'');
    }
    if(h1){ h1.style.left='calc('+startPct+'% - 4px)'; h1.className='h h1'+(over?' w':''); }
    if(h2){ h2.style.left='calc('+endPct+'% - 4px)'; h2.className='h h2'+(over?' w':''); }
    if(tl)tl.classList.toggle('is-disabled',vgClip.mode==='full');
    var d=$('vgClipDur'); if(d){ d.textContent=(Math.round(duration*10)/10)+'s'+(over?' ⚠':' ✓'); d.className='dur'+(over?' w':''); }
    var mid=$('vgClipMid'); if(mid){ mid.textContent=fmtClockSec(start)+' – '+fmtClockSec(end); mid.style.color=over?'#FFB27C':'var(--acc)'; }
    var s=$('vgClipStartLbl'); if(s)s.textContent='0:00';
    var e=$('vgClipEndLbl'); if(e)e.textContent=fmtClockSec(total);
    var w=$('vgClipWarn'); if(w)w.className='warnrow'+(over?' on':'');
    var ml=$('vgClipMetaLeft'); if(ml)ml.textContent='Duration: '+(Math.round(duration*10)/10)+'s';
    var mr=$('vgClipMetaRight'); if(mr)mr.textContent=vgClip.mode==='full'?'The whole clip will be optimized':'Only the selected part will be sent';
    var ap=$('vgClipApply'); if(ap)ap.setAttribute('aria-disabled',(over||duration<2||vgClip.busy)?'true':'false');
    renderVgClipAudioUi();
  }
  function syncVgClipFromPct(pct){
    var total=Math.max(0,Number(vgClip.totalSec)||0);
    if(!total)return;
    if(vgClip.drag==='a'){
      vgClip.startSec=Math.max(0,Math.min((Number(pct)||0)/100*total,vgClip.endSec-0.2));
      vgClip.lastStartSec=vgClip.startSec;
    }else if(vgClip.drag==='b'){
      vgClip.endSec=Math.min(total,Math.max((Number(pct)||0)/100*total,vgClip.startSec+0.2));
      vgClip.lastEndSec=vgClip.endSec;
    }
    var pv=$('vgClipVideo');
    if(pv){ try{ pv.currentTime=(vgClip.drag==='b'?vgClip.endSec:vgClip.startSec); }catch(_){} }
    renderVgClipUi();
  }
  function bindVgClipTimeline(){
    var tl=$('vgClipTl'), h1=$('vgClipH1'), h2=$('vgClipH2');
    if(!tl||!h1||!h2||tl.__bound)return;
    tl.__bound=true;
    var pctFromEvent=function(e){
      var r=tl.getBoundingClientRect();
      var clientX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX);
      var x=clientX-r.left;
      return Math.max(0,Math.min(100,(x/r.width)*100));
    };
    var down=function(which){ return function(ev){ if(vgClip.mode==='full')return; vgClip.drag=which; ev.preventDefault(); ev.stopPropagation(); }; };
    h1.addEventListener('mousedown',down('a')); h2.addEventListener('mousedown',down('b'));
    h1.addEventListener('touchstart',down('a')); h2.addEventListener('touchstart',down('b'));
    var move=function(ev){ if(!vgClip.drag||vgClip.mode==='full')return; syncVgClipFromPct(pctFromEvent(ev)); if(ev.cancelable)ev.preventDefault(); };
    document.addEventListener('mousemove',move);
    document.addEventListener('touchmove',move,{passive:false});
    document.addEventListener('mouseup',function(){ vgClip.drag=null; });
    document.addEventListener('touchend',function(){ vgClip.drag=null; });
  }
  // Masofaviy (bucket'dagi) video meta — <video> elementi orqali (fayl yuklab olinmaydi).
  function probeRemoteMeta(url){
    return new Promise(function(resolve,reject){
      var el=document.createElement('video'), done=false;
      el.preload='metadata'; el.muted=true;
      var clean=function(){ if(el){ el.removeAttribute('src'); try{ el.load(); }catch(_){} } };
      el.onloadedmetadata=function(){ if(done)return; done=true;
        var m={ duration:Number(el.duration)||0, width:Number(el.videoWidth)||0, height:Number(el.videoHeight)||0, sizeBytes:0 };
        clean(); resolve(m); };
      el.onerror=function(){ if(done)return; done=true; clean(); reject(new Error('META_LOAD_FAILED')); };
      el.src=url;
    });
  }
  async function openVgClipper(src){
    if(!src||(!src.path&&!src.srcUrl)){ if(src)src.skipClipper=true; prepAndUploadMediaRef(src,'video'); return; }
    var meta=null;
    if(src.srcUrl){ try{ meta=await probeRemoteMeta(src.srcUrl); }catch(_){ meta=null; } }
    else meta=await inspectMediaSource(src,'video');
    // MUHIM: fallback'da skipClipper=true — aks holda prepAndUploadMediaRef yana openVgClipper'ni
    // chaqirib CHEKSIZ REKURSIYA bo'lardi (meta har safar olinmasa).
    if(!meta||!meta.duration){ src.skipClipper=true; prepAndUploadMediaRef(src,'video'); return; }
    if(meta.duration<2){ toast('Video reference must be at least 2 seconds','warning'); return; }
    resetVgClipper();
    vgClip.src=src;
    vgClip.meta=meta;
    vgClip.totalSec=Number(meta.duration)||0;
    vgClip.startSec=0;
    vgClip.endSec=Math.min(vgClip.totalSec,8);
    if(vgClip.endSec<2)vgClip.endSec=Math.min(vgClip.totalSec,2);
    vgClip.lastStartSec=vgClip.startSec;
    vgClip.lastEndSec=vgClip.endSec;
    vgClip.includeAudio=false;
    vgClip.url=src.srcUrl||clipPreviewUrl(src); // remote: URL to'g'ridan preview (blob shart emas)
    var nm=$('vgClipName'); if(nm)nm.textContent=src.srcUrl?(src.title||'Generated result'):(baseName(src.path||'')||'Video reference');
    var v=$('vgClipVideo'); if(v){ v.src=vgClip.url; try{ v.currentTime=0; }catch(_){} try{ v.load(); }catch(_){} }
    bindVgClipTimeline();
    renderVgClipUi();
    openVgSheet('vgClipSheet');
  }
  // host (jsx) chaqiruv — listProjectFootage / exportTimelineFrame (igScript bilan bir xil isbotlangan yo'l).
  // Bular GLOBAL funksiya EMAS — csInterface.evalScript orqali host.jsx evallanadi va natija JSON qaytadi.
  function hostCall(fn){ return new Promise(function(res){
    if(typeof csInterface==='undefined'||!csInterface){ res(null); return; }
    try{ var ed=csInterface.getSystemPath((typeof SystemPath!=='undefined'&&SystemPath.EXTENSION)?SystemPath.EXTENSION:'extension');
      var jp=(ed+'/jsx/host.jsx').replace(/\\/g,'/');
      csInterface.evalScript('(function(){$.evalFile('+JSON.stringify(jp)+'); return '+fn+'();})()',function(raw){
        var r=null; try{ r=raw?JSON.parse(raw):null; }catch(e){ r=null; }
        if(r&&!r.ok&&r.reason){ try{console.warn('[vg] host '+fn+' xato:',r.reason);}catch(_){} }
        res(r||null); });
    }catch(e){ try{console.warn('[vg] host '+fn+' eval xato:',String(e));}catch(_){} res(null); }
  }); }

  function refreshVgBtn(){
    var ok, pr=vgPromptValue();
    var low=vgCreditGate(); // P22 — kredit yetmasa (komitilgan bilan) tugma O'CHADI (bosishdan oldin)
    if(vm.refKind==='media-refs'){
      // R2V: referens IXTIYORIY → prompt majburiy (≥2 belgi); referens yuklanayotgan bo'lsa bloklanadi
      var refLoading=mref.some(function(r){return r.loading;});
      ok=vm.loaded&&pr.length>=2&&!refLoading&&activeJobs.length<MAX_VG_JOBS&&!low;
      if(!pr.length)setVgWarn('Prompt is required — describe what the video should do.');
      else if(refLoading)setVgWarn('Reference is uploading — please wait.');
      else setVgWarn('');
    } else if(vm.refKind==='none'){
      ok=vm.loaded&&pr.length>=2&&activeJobs.length<MAX_VG_JOBS&&!low;
      if(!pr.length)setVgWarn('Prompt is required — describe what the video should do.');
      else setVgWarn('');
    } else {
      // frames: image-to-video (Seedance) → boshlang'ich kadr MAJBURIY; matndan-video (Veo/Omni) → IXTIYORIY.
      var hasStart=!!(st.start&&st.start.url&&!st.start.loading);
      var frameLoading=!!(st.start&&st.start.loading)||!!(st.end&&st.end.loading);
      ok=vm.loaded&&pr.length>=2&&!frameLoading&&(!vm.startRequired||hasStart)&&activeJobs.length<MAX_VG_JOBS&&!low;
      if(vm.startRequired&&!hasStart)setVgWarn("Start frame is required — add it with +.");
      else if(!pr.length)setVgWarn('Prompt is required — describe what the video should do.');
      else if(frameLoading)setVgWarn('Frame is uploading — please wait.');
      else setVgWarn('');
    }
    var g=$('vgGen'); if(g)g.disabled=!ok;
    // P30 §2 — qattiq siyosatli model + prompt bor → "rad etilsa hisobdan yechilmaydi" ogohlantirish
    var pn=$('vgPolNote'); if(pn)pn.style.display=(vm.strict && pr.length>=2)?'flex':'none';
    setCreditChip(credits()); recost();
  }

  // ── sheet'lar (backdrop + Esc + ×) ──
  function closeVgSheets(){
    var clipOpen=$('vgClipSheet')&&$('vgClipSheet').classList.contains('on');
    document.querySelectorAll('.axvg .sheet').forEach(function(s){s.classList.remove('on');});
    if(clipOpen)resetVgClipper();
  }
  // FIX4: sozlama sheet'lari (.pop) — pill yoniga joylanadigan popover; qolganlari bottom-sheet.
  function positionVgPopover(sc,anch){
    if(!sc)return;
    var pad=8,gap=6,vw=window.innerWidth,vh=window.innerHeight;
    sc.style.bottom='auto';
    if(anch&&anch.getBoundingClientRect){
      var ar=anch.getBoundingClientRect();
      var w=Math.min(Math.max(ar.width,240),380,vw-pad*2);
      sc.style.width=w+'px'; sc.style.maxHeight=Math.round(vh*0.62)+'px';
      sc.style.left='-9999px'; sc.style.top='0px'; var sh=sc.offsetHeight; // o'lchash
      var left=Math.min(Math.max(pad,ar.left),Math.max(pad,vw-w-pad));
      var top;
      if(ar.bottom+gap+sh<=vh-pad) top=ar.bottom+gap;
      else if(ar.top-gap-sh>=pad) top=ar.top-gap-sh;
      else top=Math.max(pad,vh-sh-pad);
      sc.style.left=left+'px'; sc.style.top=top+'px';
    }else{
      // anchor yo'q — markazda ochiladi (pastdan chiqmaydi)
      var w2=Math.min(380,vw-pad*2);
      sc.style.width=w2+'px'; sc.style.maxHeight=Math.round(vh*0.62)+'px';
      sc.style.left='-9999px'; sc.style.top='0px'; var sh2=sc.offsetHeight;
      sc.style.left=Math.round((vw-w2)/2)+'px'; sc.style.bottom='auto';
      sc.style.top=Math.max(pad,Math.round((vh-sh2)/2))+'px';
    }
  }
  function openVgSheet(id,anch){
    closeVgSheets(); var s=$(id); if(!s)return; s.classList.add('on'); s._anchor=anch||null;
    var sc=s.querySelector('.sheetc'); if(!sc)return;
    if(s.classList.contains('pop'))positionVgPopover(sc,anch);
    else { sc.style.left='';sc.style.top='';sc.style.bottom='';sc.style.width='';sc.style.maxHeight=''; }
  }
  // async kontent (Project ro'yxati) kelgach popover'ni qayta joylash
  function repositionVgSheet(id){
    var s=$(id); if(!s||!s.classList.contains('on')||!s.classList.contains('pop'))return;
    positionVgPopover(s.querySelector('.sheetc'),s._anchor);
  }
  document.querySelectorAll('.axvg [data-vgclose]').forEach(function(x){ x.addEventListener('click',closeVgSheets); });
  document.querySelectorAll('.axvg .sheet').forEach(function(s){ s.addEventListener('click',function(e){ if(e.target===s)closeVgSheets(); }); });
  // P15 — kompozer "Expand" toggle (bu IIFE alohida qamrov — igPrompt versiyasi bilan ulashilmaydi).
  function setChipExpanded(taId,btnId,on){
    var ta=$(taId),exp=$(btnId); if(!ta)return;
    ta.classList.toggle('expanded',on);
    if(exp){ exp.classList.toggle('on',on); exp.title=on?'Collapse':'Expand'; }
  }
  (function(){ var exp=$('vgPromptExp'),ta=$('vgPrompt'); if(exp&&ta)exp.addEventListener('click',function(){ setChipExpanded('vgPrompt','vgPromptExp',!ta.classList.contains('expanded')); }); })();
  // P14/P15 — bitta Esc = bitta qatlam: avval sheet, keyin kengaytirilgan kompozer.
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    if(document.querySelector('.axvg .sheet.on')){ closeVgSheets(); return; }
    var ta=$('vgPrompt'); if(ta&&ta.classList.contains('expanded'))setChipExpanded('vgPrompt','vgPromptExp',false);
  });

  // ── pill'lar ──
  function buildPills(host,arr,cur,onpick){
    if(!host)return; host.innerHTML='';
    arr.forEach(function(v){ var d=document.createElement('div'); d.className='pill'+(String(v)===String(cur)?' cur':''); d.textContent=String(v); d.addEventListener('click',function(){ onpick(v); }); host.appendChild(d); });
  }

  // ── FIX3: model imkoniyat xaritasi — FAQAT /gen/models maydonlaridan (refKind, maxRefs, endFrame,
  // mediaRefs, videoInput.imageRequired). Media-turdagi refKind'lar ('media-refs'|'imagevideo'|'image'|
  // 'video') BITTA media-UI'ga normallashadi, ruxsat etilmagan tur limiti 0 bo'ladi; hamma limit 0 → 'none'.
  function vgCapsFor(m){
    var kind=(m&&m.refKind)||'none';
    if(kind==='frames'){
      // KADR MAJBURIY: videoInput.imageRequired deklaratsiyasi; bo'lmasa feature fallback (Seedance i2v).
      var req=(m.videoInput&&typeof m.videoInput.imageRequired==='boolean')?m.videoInput.imageRequired:(m.feature==='image-to-video');
      return {kind:'frames',frames:true,end:!!m.endFrame,startRequired:req,limits:{image:0,video:0,audio:0,total:0}};
    }
    if(kind==='media-refs'||kind==='imagevideo'||kind==='image'||kind==='video'){
      var mr=m.mediaRefs||(kind==='media-refs'?{image:9,video:3,audio:3,total:12}:null);
      var mx=m.maxRefs||0;
      var img=(kind==='video')?0:(mr?(mr.image||0):mx);
      var vid=(kind==='image')?0:(mr?(mr.video||0):mx);
      var aud=(kind==='media-refs')?(mr?(mr.audio||0):0):0;
      var tot=Math.min(mr?(mr.total||(img+vid+aud)):(mx||(img+vid+aud)),img+vid+aud);
      // BATCH5 #5 — Seedance 2.0 (BytePlus): media-refs model kadr HAM qo'llashi mumkin (flag'lardan)
      var fr=((m.inputs||[]).indexOf('start-end-frame')>=0)||!!m.endFrame;
      if(tot>0)return {kind:'media-refs',frames:fr,end:fr&&!!m.endFrame,startRequired:false,limits:{image:img,video:vid,audio:aud,total:tot}};
    }
    return {kind:'none',frames:false,end:false,startRequired:false,limits:{image:0,video:0,audio:0,total:0}};
  }
  // ── model sozlamalarini qo'llash (videoSettings deskriptoridan; joriy tanlov mos kelmasa def'ga klamp) ──
  function applyModelSettings(m){
    // P12 — chiqayotgan modelning joriy kompozer parametrlarini eslab qolamiz (af.prefs.genPrefsVid).
    var prevVidId=vm.model?vm.model.id:null;
    var gpVid=(afGetPrefs().genPrefsVid)||{};
    if(prevVidId!=null)gpVid[prevVidId]={res:vm.res,dur:vm.dur,ar:vm.ar,bitrate:vm.bitrate,audio:vm.audio};
    vm.model=m;
    vm.strict=(m&&m.policyStrictness==='strict'); // P30 §2 — qattiq siyosat ogohlantirishi
    // FIX3: refKind/limitlar imkoniyat xaritasidan (B4 'none' default saqlangan — kadr talab qilib bloklamaydi).
    var caps=vgCapsFor(m);
    vm.refKind=caps.kind;
    vm.framesOk=!!caps.frames; // BATCH5 #5: kadr slotlari refKind'dan mustaqil flag
    vm.endFrameOk=caps.end;
    vm.startRequired=caps.startRequired;
    vm.mediaRefs=caps.limits;
    vm.mediaRefMaxBytes=m.mediaRefMaxBytes||null;
    vm.mediaRefMaxTotalBytes=m.mediaRefMaxTotalBytes||null;
    vm.mediaRefFormats=m.mediaRefFormats||null;
    vm.videoInputCostMult=(typeof m.videoInputPerSecMultiplier==='number'&&m.videoInputPerSecMultiplier>0)?m.videoInputPerSecMultiplier:0;
    // B3: narx rejimi — per-generation modelда sobit cost (soniyaga emas).
    vm.pricing=(m.pricing==='per-generation')?'per-generation':'per-second';
    vm.flatCost=(typeof m.cost==='number')?m.cost:0;
    var vs=m.videoSettings;
    if(vs){
      if(vs.resolution){ vm.resOpts=vs.resolution.options||vm.resOpts; vm.res=vs.resolution.def||vm.resOpts[0]||vm.res; if(vs.resolution.perSec)vm.perSec=vs.resolution.perSec; }
      if(vs.duration){ vm.durOpts=vs.duration.options||vm.durOpts; vm.dur=vs.duration.def||vm.durOpts[0]||vm.dur; if(vs.duration.autoSec)vm.autoSec=vs.duration.autoSec; }
      if(vs.aspect){ vm.arOpts=vs.aspect.options||vm.arOpts; vm.ar=vs.aspect.def||vm.arOpts[0]||vm.ar; }
      if(typeof vs.audioDefault==='boolean')vm.audio=vs.audioDefault;
      else if(typeof vs.audio==='boolean')vm.audio=vs.audio;
      if(vs.bitrate){ vm.bitOpts=vs.bitrate.options||vm.bitOpts; vm.bitrate=vs.bitrate.def||vm.bitOpts[0]||vm.bitrate; }
      else { vm.bitOpts=['standard','high']; vm.bitrate='standard'; }
    }
    // Model xususiyati qulflari (Omni): ovoz doim yoqiq / video-ref bilan nisbat model ixtiyorida.
    vm.audioLocked=!!(vs&&vs.audioLocked);
    vm.arLockVideoRef=!!(vs&&vs.aspectIgnoredWithVideoRef);
    if(vm.audioLocked)vm.audio=(vs&&typeof vs.audioDefault==='boolean')?vs.audioDefault:true;
    // P8 (P2 gap): model audio QO'LLAMASA (Veo Lite/Fast audio:false) toggle yashirinadi va false yuboriladi.
    vm.audioSupported=((vs&&vs.audio!=null)?vs.audio:m.audio)===true;
    if(!vm.audioSupported)vm.audio=false;
    // P12 — shu model uchun avval saqlangan preferensiya bo'lsa (hali ham YAROQLI bo'lsa) tiklaymiz,
    //   aks holda model default'i (yuqoridagi vs blokidan).
    var savedVid=gpVid[m.id];
    // SC_27: yangi modelda YAROQSIZ bo'lib qolgan qiymatlar sonini hisoblaymiz — switch toast'ida
    // kichik tranzient xabar ("N setting(s) reset...") ko'rsatiladi (jimgina tashlab yuborilmaydi).
    vm._prefsDropped=0;
    if(savedVid){
      if(savedVid.res!=null){ if(vm.resOpts.indexOf(savedVid.res)>=0)vm.res=savedVid.res; else vm._prefsDropped++; }
      if(savedVid.dur!=null){ if(vm.durOpts.indexOf(savedVid.dur)>=0)vm.dur=savedVid.dur; else vm._prefsDropped++; }
      if(savedVid.ar!=null){ if(vm.arOpts.indexOf(savedVid.ar)>=0)vm.ar=savedVid.ar; else vm._prefsDropped++; }
      if(savedVid.bitrate!=null&&vm.bitOpts.indexOf(savedVid.bitrate)>=0)vm.bitrate=savedVid.bitrate;
      if(typeof savedVid.audio==='boolean'&&vm.audioSupported&&!vm.audioLocked)vm.audio=savedVid.audio;
    }
    afSavePrefs({genPrefsVid:gpVid});
    // So'nggi grid kartalari model-aware (Referens tugmasi refKind'ga bog'liq) — model almashganda
    // QAYTA chiziladi, aks holda eski model bilan chizilgan kartada tugma yo'qolib/ortib qoladi.
    try{ if(typeof renderVgRecent==='function')renderVgRecent(); }catch(_){}
  }
  function clearFrameState(){
    st.start=null; st.end=null; renderFrameBoxes();
  }
  function vgReEsc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function stripPromptTokens(tokens){
    var ta=$('vgPrompt'); if(!ta||!tokens||!tokens.length)return;
    var txt=String(ta.value||'');
    tokens.forEach(function(tok){
      if(!tok)return;
      txt=txt.replace(new RegExp('(^|\\s)'+vgReEsc(tok)+'(?=\\b)','g'),' ');
    });
    ta.value=txt.replace(/\s{2,}/g,' ').replace(/\s+([,.;!?])/g,'$1').trim();
  }
  function rewritePromptTokens(map,removedToken){
    var ta=$('vgPrompt'); if(!ta)return;
    var txt=String(ta.value||'');
    if(removedToken){
      txt=txt.replace(new RegExp('(^|\\s)'+vgReEsc(removedToken)+'(?=\\b)','g'),' ');
    }
    var keys=Object.keys(map||{});
    keys.forEach(function(oldTok,i){
      txt=txt.replace(new RegExp(vgReEsc(oldTok)+'(?=\\b)','g'),'__VG_TOKEN_'+i+'__');
    });
    keys.forEach(function(oldTok,i){
      txt=txt.replace(new RegExp('__VG_TOKEN_'+i+'__','g'),map[oldTok]);
    });
    txt=txt.replace(/\s{2,}/g,' ').replace(/\s+([,.;!?])/g,'$1');
    ta.value=txt.trim();
  }
  function syncMediaRefTokens(removedToken){
    var ci={image:0,video:0,audio:0},map={};
    mref.forEach(function(r){
      ci[r.type]++; var next=tokFor(r.type,ci[r.type]);
      if(r.token&&r.token!==next)map[r.token]=next;
      r.token=next;
    });
    if(removedToken||Object.keys(map).length)rewritePromptTokens(map,removedToken);
  }
  // ── model yuklanishi (videoSettings deskriptoridan) ──
  function ensureVgMeta(){
    if(vm.loaded)return Promise.resolve(vm);
    if(vm._pending)return vm._pending;
    vm._pending=studioGet('/api/studio/gen/models?mode=video').then(function(r){
      // SC_19 (TASK 3): eski "PROBLEM 3" client-side whitelist OLIB TASHLANDI — plagin
      // endi web bilan AYNAN bir xil yoqilgan to'plamni ko'rsatadi (media-refs/R2V ham;
      // pane model-aware: vgCapsFor/mref mashinasi ularni qo'llaydi). Yagona chetlash —
      // video-upscale (SC_17'da funksiya o'chirilgan; server ham disabled qaytaradi).
      var fal=((r&&r.models)||[]).filter(function(x){ return x&&x.mode==='video'&&x.feature!=='video-upscale'; });
      if(!fal.length)throw new Error('No video model found');
      vm.models=fal; vm.loaded=true;
      try{ console.log('[vg] video modellar:', fal.map(function(x){return x.id+':'+x.label+'('+x.refKind+')';}).join(', ')); }catch(_){}
      // P8: katalog isDefault hurmat qilinadi (image tool bilan bir xil); bo'lmasa birinchi model.
      applyModelSettings(fal.filter(function(x){return x.isDefault;})[0]||fal[0]);
      applyVgMeta(); return vm;
    }).catch(function(err){
      vm._pending=null; var g=$('vgGen'); if(g)g.disabled=true;
      toast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Failed to load video model','error'); throw err;
    });
    return vm._pending;
  }
  // FIX3: yangi model uchun ko'p-modal referenslarni saralash — hali YAROQLI bo'lganlari qoladi
  // (tur limiti + jami limit ichида), qolganlari olib tashlanadi (token'lari promptdan ham).
  function vgPruneMrefFor(caps){
    var cnt={image:0,video:0,audio:0},tot=0,kept=[],removedToks=[];
    mref.forEach(function(r){
      if(!r)return;
      var lim=(caps.limits&&caps.limits[r.type])||0;
      if(caps.kind==='media-refs'&&cnt[r.type]<lim&&tot<caps.limits.total){ cnt[r.type]++; tot++; kept.push(r); }
      else if(r.token)removedToks.push(r.token);
    });
    return {kept:kept,removedToks:removedToks};
  }
  // P13 — REFERENS HOVUZI MODEL-MUSTAQIL: model almashishi mref/kadrlardan HECH NARSA o'chirmaydi.
  //   Model faqat PROYEKSIYA beradi: renderMediaRefs/renderFrameBoxes limitdan tashqari/qo'llanmagan
  //   referensni XIRA qiladi (joyida qoladi), genVgClick FAQAT faollarini yuboradi, @tokenlar
  //   qayta raqamlanmaydi. Orqaga qaytsa hammasi qaytadi. Tasdiq shart emas — hech narsa yo'qolmaydi.
  //   id taqqoslash String bilan (API number/string bo'lishi mumkin — xavfsiz).
  function switchVgModel(m){
    if(!m||(vm.model&&String(m.id)===String(vm.model.id))){ closeVgSheets(); return; }
    doSwitchVgModel(m);
  }
  function doSwitchVgModel(m){
    var inact=vgInactiveRefCount(m); // yangi modelda nofaol bo'ladigan referenslar (ogohlantirish)
    applyModelSettings(m); applyVgMeta();
    // hovuz saqlanadi — proyeksiyani (xira holatlar) qayta chizamiz (@tokenlar TEGILMAYDI)
    // P18 — renderMediaRefs() ichida renderVgEditPresets() ham chaqiriladi (model-aware qayta chizish).
    hideVgMention(); renderMediaRefs(); renderFrameBoxes(); updRefMeta();
    closeVgSheets();
    // SC_27: yaroqsiz bo'lib qolgan sozlamalar model default'iga qaytdi — kichik tranzient xabar
    var drp=vm._prefsDropped||0;
    toast(String(m.label||'Model')+' selected'+(inact>0?(' · '+inact+' reference'+(inact>1?'s':'')+' kept (unused)'):'')+(drp>0?(' · '+drp+' setting'+(drp>1?'s':'')+' reset to model default'):''),'info');
  }
  // P13 — joriy/berilgan model proyeksiyasi: qaysi mref FAOL (yuboriladi). vgPruneMrefFor bilan bir xil
  //   mantiq, lekin O'CHIRMAYDI — faqat belgilaydi. Boolean bayroqlar massivi qaytadi (mref bilan hamqadam).
  function vgActiveFlags(model){
    var caps=vgCapsFor(model||vm.model||{});
    var cnt={image:0,video:0,audio:0},tot=0,act=[];
    mref.forEach(function(r){
      var ok=false;
      if(r&&caps.kind==='media-refs'){ var lim=(caps.limits&&caps.limits[r.type])||0; if(cnt[r.type]<lim&&tot<(caps.limits.total||0)){ cnt[r.type]++; tot++; ok=true; } }
      act.push(ok);
    });
    return {caps:caps,active:act,startOk:!!caps.frames,endOk:!!(caps.frames&&caps.end)};
  }
  function vgInactiveRefCount(model){
    var f=vgActiveFlags(model),n=0;
    f.active.forEach(function(a){ if(!a)n++; });
    if(st.start&&!f.startOk)n++;
    if(st.end&&!f.endOk)n++;
    return n;
  }
  // Qayta-gen model-switch: TASDIQSIZ almashtirish (restore holatni baribir almashtiradi) —
  // joriy referens/kadrlar tozalanadi, model sozlamalari qo'llanadi.
  function vgSilentSwitchModel(m){
    var prevKind=vm.refKind||'frames';
    if(prevKind==='media-refs'&&mref.length){
      var toks=mref.map(function(r){ return r&&r.token; }).filter(Boolean);
      mref=[]; stripPromptTokens(toks); hideVgMention(); renderMediaRefs(); updRefMeta();
    }
    clearFrameState();
    applyModelSettings(m); applyVgMeta(); closeVgSheets();
  }
  function applyVgMeta(){
    var mn=$('vgMName'); if(mn&&vm.model){ mn.textContent=vm.model.label||'Model'; var _vms=$('vgModelSeg'); if(_vms)_vms.title=vm.model.label||'Choose a model'; } // SC_20: tooltip
    // P16 — bitta sozlama chipi xulosasi (Ratio · Res · Duration · Bitrate)
    var sv=$('vgSetVal'); if(sv){ sv.textContent=vgSummary(); var _vss=$('vgSetSeg'); if(_vss)_vss.title='Output: '+vgSummary(); } // SC_20: tooltip
    var at=$('vgAudToggle'); if(at){ at.style.display=vm.audioSupported?'':'none'; at.classList.toggle('on',!!vm.audio); at.style.opacity=vm.audioLocked?'.45':''; at.title=vm.audioLocked?'Audio is always on for this model — model feature':''; }
    var avv=$('vgAudVal'); if(avv)avv.textContent=vm.audio?'On':'Off';
    applyVgArLock(); // model almashdi — nisbat qulfi qayta hisoblansin
    var bsec=$('vgBitSec'); if(bsec)bsec.style.display=(vm.model&&vm.model.videoSettings&&vm.model.videoSettings.bitrate)?'':'none';
    var rh=$('vgResHint'); if(rh)rh.textContent=vm.resOpts.map(function(k){ return k+' = ✦'+(vm.perSec[k]||vm.perSec[vm.resOpts[0]]||0)+'/s'; }).join(' · ');
    var dh=$('vgDurHint'); if(dh)dh.textContent='Auto ≈ '+vm.autoSec+' seconds';
    // #141 (PX4) — kutish vaqti MODEL bo'yicha (server `etaSec`: oxirgi 7 kun medianasi;
    // o'lchov yig'ilmagan modelda feature zaxirasi). Eski "≈ 1–2 min" hamma model uchun bir xil edi.
    var eh=$('vgEtaHint'); if(eh){ var lab=(typeof window.afEtaLabel==='function'&&vm.model)?window.afEtaLabel(vm.model.etaSec):''; eh.textContent=(lab?lab+' · ':'')+'credits refunded on error'; }
    // FIX3: referens hudud TO'LIQ model imkoniyatidan: frames=Kadrlar ↔ media-refs=ko'p-modal ↔ none=hech biri
    var isMedia=vm.refKind==='media-refs';
    var isNone=vm.refKind==='none';
    // BATCH5 #5: kadr bo'limi framesOk flag'idan (media-refs model ham kadr qo'llashi mumkin)
    // P13 — hovuzda kadr bo'lsa (start/end) bo'lim TURADI (xira ko'rinadi), model qo'llamasa ham
    // SC_42: vgFrameSect/vgMediaSect O'CHIRILDI — birlashgan [+] menyu + attachment strip.
    //   Kadr/media ko'rinishi renderFrameBoxes (bo'sh=yashirin) + updAddMenu (item darvozalari) bilan boshqariladi.
    // Lightbox/So'nggi "Referens kadr" menyusida Yakuniy varianti ham endFrame'ga bog'liq
    var reOpt=$('vgRefEnd'); if(reOpt)reOpt.style.display=vm.endFrameOk?'':'none';
    // SC_27: "FAST" nishoni faqat kadr MAJBURIY modelda (Seedance Fast merosxo'ri) — Veo'da chalg'itardi
    var kt=$('vgKadrTag'); if(kt)kt.style.display=(vm.framesOk&&vm.startRequired)?'inline-flex':'none';
    // SC_27: media-referens UI (vgMediaSect: +Image/+Video/+Audio) QAYTA JONLANTIRILDI —
    // media-refs modellar (Omni/Seedance) plaginda to'liq; eski "Fast-only" cheklov bekor.
    applyVgGuide(); applyVgPromptUi(); hideVgMention();
    if(isMedia){ renderMediaRefs(); updRefMeta(); loadVgSavedRefs(); }
    else renderVgSavedRefs();
    // P13 — kadr proyeksiyasi (xira holatlar) HAR applyVgMeta'da qayta chizilsin (model almashsa ham)
    renderFrameBoxes();
    if(mref.length&&!isMedia)renderMediaRefs(); // hovuzda media bo'lsa (nofaol) ham ko'rinsin
    renderVgModelSheet(); refreshVgBtn();
  }
  // b2: video model 1-natija narxi — per-generation=cost; per-second=perSec(def res)×autoSec
  function vgModelPrice(m){
    if(m.pricing==='per-generation')return (typeof m.cost==='number')?m.cost:null;
    var vs=m.videoSettings||{};
    var res=vs.resolution||{}; var perSec=res.perSec||null;
    var def=res.def||(res.options&&res.options[0]);
    var rate=(perSec&&def!=null)?perSec[def]:null;
    var sec=(vs.duration&&vs.duration.autoSec)||5;
    return (typeof rate==='number')?Math.round(rate*sec):((typeof m.cost==='number')?m.cost:null);
  }
  function renderVgModelSheet(){
    var host=$('vgMList'); if(!host)return; host.innerHTML='';
    var models=vm.models||[];
    if(!models.length&&vm.model)models=[vm.model];
    models=afSortPinnedFirst(models);
    models.forEach(function(m){
      var cur=(vm.model&&String(m.id)===String(vm.model.id));
      var pinned=afIsModelPinned(m.id);
      var sub=String(m.desc||m.description||vgModelSubtitle(m)).replace(/[<>&]/g,'');
      var price=vgModelPrice(m);
      var o=document.createElement('div'); o.className='mrowb'+(cur?' cur':''); o.setAttribute('data-mid',String(m.id));
      o.innerHTML='<span class="mdot"></span><div class="mtx"><b>'+String(m.label||'').replace(/[<>&]/g,'')+brandBadgeHtml(m.brand)+'</b><small>'+sub+'</small></div>'+((price!=null)?'<span class="mprice">✦ '+price+'</span>':'')+'<span class="mpin'+(pinned?' on':'')+'" title="'+(pinned?'Unpin model':'Pin model')+'">'+PIN_SVG+'</span>';
      var pinEl=o.querySelector('.mpin');
      if(pinEl)pinEl.addEventListener('click',function(e){ e.stopPropagation(); var on=afToggleModelPin(m.id); renderVgModelSheet(); toast(on?'Model pinned':'Model unpinned','info'); });
      host.appendChild(o);
    });
    if(!host.children.length)host.innerHTML='<div class="axighint">Loading model…</div>';
  }
  // Model tanlash — DELEGATSIYA (#vgMList'ga BIR marta). CEF88'да option ichidagi SVG/<text>/<b>'ga
  // bosilganda ham ishlaydi (e.target bola → qatorгача ko'tarilamiz). data-mid → String taqqoslash.
  (function(){ var host=$('vgMList'); if(!host)return;
    host.addEventListener('click',function(e){
      var n=e.target; while(n&&n!==host&&!(n.classList&&(n.classList.contains('opt')||n.classList.contains('mrowb'))))n=n.parentNode;
      if(!n||n===host)return;
      var mid=n.getAttribute&&n.getAttribute('data-mid'); if(mid==null)return;
      var m=(vm.models||[]).filter(function(x){return String(x.id)===String(mid);})[0];
      if(m)switchVgModel(m);
    });
  })();
  function ensureVgSession(){
    if(vm.sessionId)return Promise.resolve(vm.sessionId);
    return studioPost('/api/studio/gen/sessions',{mode:'video'}).then(function(s){ vm.sessionId=(s&&s.id)||null; if(s&&s.id){ window.__axwsSess=window.__axwsSess||{}; window.__axwsSess.vidgen=s; } return vm.sessionId; }); // SC_29: lazy sessiya header'ga ham
  }

  // ── b7: birlashgan "Video sozlamalari" sheet — barcha sozlama pill'lari SHU sheetni ochadi ──
  function vgDurChipLabel(v){
    if(/^auto$/i.test(String(v)))return 'Auto ≈ '+vm.autoSec+' sec';
    return String(v)+(/^\d+$/.test(String(v))?'s':'');
  }
  function vgSetChips(host,opts,cur,labelFn,locked,onpick){
    if(!host)return; host.innerHTML='';
    (opts||[]).forEach(function(v){
      var d=document.createElement('div');
      d.className='vg-chip'+(String(v)===String(cur)?' cur':'')+(locked?' dis':'');
      d.textContent=labelFn?labelFn(v):String(v);
      d.addEventListener('click',function(){ onpick(v); });
      host.appendChild(d);
    });
  }
  // (b7 renderVgSettingsSheet OLIB TASHLANDI — birlashgan sheet o'rniga per-pill popover'lar)
  // FIX4/5: b7 birlashgan sheet o'rniga — har pill O'Z popover'ini ochadi (rasm tool bilan bir xil).
  // Qiymat/apply/recost mantiqлари vgSetChips'dagi bilan aynan bir xil saqlangan.
  // BATCH8 P3 — video model sheet qidiruvi (image bilan bir xil client-side filtr)
  function afVgMFilter(){
    var inp=$('vgMSrch'),list=$('vgMList'),none=$('vgMNone'); if(!list)return;
    var q=inp?String(inp.value||'').toLowerCase().replace(/^\s+|\s+$/g,''):'';
    var rows=list.querySelectorAll('.mrowb'),shown=0,i,b,tn,nm;
    for(i=0;i<rows.length;i++){
      b=rows[i].querySelector('.mtx b'); tn=b&&b.firstChild;
      nm=((tn&&tn.nodeType===3?tn.textContent:(b?b.textContent:rows[i].textContent))||'').toLowerCase();
      if(!q||nm.indexOf(q)>=0){ rows[i].style.display=''; shown++; } else rows[i].style.display='none';
    }
    if(none)none.style.display=(q&&shown===0)?'':'none';
  }
  function afVgMReset(){ var inp=$('vgMSrch'); if(inp)inp.value=''; afVgMFilter(); }
  (function(){ var s=$('vgMSrch'); if(s)s.addEventListener('input',afVgMFilter); })();
  $('vgModelSeg').addEventListener('click',function(){ renderVgModelSheet(); afVgMReset(); openVgSheet('vgMSheet',$('vgModelSeg')); });
  // P16 — BITTA sozlama chipi: Ratio/Resolution/Duration/Bitrate bitta guruhlangan sheet'da.
  //   Tanlovdan keyin sheet OCHIQ qoladi (afterVgSet: xulosa + pill'lar qayta belgilanadi).
  function vgDurShort(v){ return /^auto$/i.test(String(v))?'Auto':(String(v)+(/^\d+$/.test(String(v))?'s':'')); }
  function vgSummary(){ var b=[]; if(vm.ar&&!/^auto$/i.test(vm.ar))b.push(vm.ar); if(vm.res)b.push(vm.res); b.push(vgDurShort(vm.dur)); if(vm.model&&vm.model.videoSettings&&vm.model.videoSettings.bitrate&&vm.bitrate&&!/^standard$/i.test(vm.bitrate))b.push(vm.bitrate); return b.join(' · '); }
  function afterVgSet(){ var sv=$('vgSetVal'); if(sv){ sv.textContent=vgSummary(); var _vss=$('vgSetSeg'); if(_vss)_vss.title='Output: '+vgSummary(); } buildVgSettings(); }
  function buildVgSettings(){
    var arLocked=!!(vm.arLockVideoRef&&hasVideoRefs());
    vgSetChips($('vgArPills'),vm.arOpts,vm.ar,null,arLocked,function(v){ if(arLocked){ toast('Video reference attached — the model sets the aspect ratio itself','info'); return; } vm.ar=v; afterVgSet(); });
    var ah=$('vgArHint'); if(ah)ah.textContent=arLocked?'Locked — the video reference sets the ratio.':'Auto — taken from the input frame.';
    vgSetChips($('vgResPills'),vm.resOpts,vm.res,null,false,function(v){ vm.res=v; refreshVgBtn(); afterVgSet(); }); // narx o'zgardi → tugma darvozasi (P22)
    vgSetChips($('vgDurPills'),vm.durOpts,vm.dur,vgDurChipLabel,false,function(v){ vm.dur=v; refreshVgBtn(); afterVgSet(); });
    var bitOn=!!(vm.model&&vm.model.videoSettings&&vm.model.videoSettings.bitrate);
    var bsec=$('vgBitSec'); if(bsec)bsec.style.display=bitOn?'':'none';
    if(bitOn)vgSetChips($('vgBitPills'),vm.bitOpts,vm.bitrate,null,false,function(v){ vm.bitrate=v; refreshVgBtn(); afterVgSet(); });
  }
  $('vgSetSeg').addEventListener('click',function(){ buildVgSettings(); openVgSheet('vgSetSheet',$('vgSetSeg')); });
  var audTgl=$('vgAudToggle');
  if(audTgl)audTgl.addEventListener('click',function(){
    if(vm.audioLocked){ toast('Audio is always on for this model — cannot be turned off (model feature)','info'); return; }
    vm.audio=!vm.audio; audTgl.classList.toggle('on',!!vm.audio);
    var avv2=$('vgAudVal'); if(avv2)avv2.textContent=vm.audio?'On':'Off';
  });

  // ── R2V ko'p-modal referens (refKind='media-refs'): @Image/@Video/@Audio, IXTIYORIY ──
  function cntRef(t){ return mref.filter(function(r){return r.type===t;}).length; }
  function tokFor(type,idx){ return '@'+(type==='image'?'Image':type==='video'?'Video':'Audio')+idx; }
  function typeLabel(t){ return t==='image'?'Image':t==='video'?'Video':'Voice'; }
  function savedRefTtlLabel(expiresAt){
    var ms=Math.max(0,new Date(expiresAt).getTime()-Date.now());
    var min=Math.ceil(ms/60000);
    if(!isFinite(min)||min<=1)return 'less than 1 minute';
    if(min<60)return min+' min left';
    return Math.ceil(min/60)+' hr left';
  }
  function mediaRefLimitBytes(type){
    var caps=vm.mediaRefMaxBytes||null;
    if(!caps||typeof caps[type]!=='number'||!(caps[type]>0))return 0;
    return caps[type];
  }
  function mediaRefTotalLimitBytes(type){
    var caps=vm.mediaRefMaxTotalBytes||null;
    if(!caps||typeof caps[type]!=='number'||!(caps[type]>0))return 0;
    return caps[type];
  }
  function mediaRefLimitMsg(type,maxBytes){
    return typeLabel(type)+' reference is too large for this model — choose a file smaller than '+fmtMb(maxBytes)+'MB';
  }
  function mediaRefTotalLimitMsg(type,maxBytes){
    return typeLabel(type)+" references' total size must not exceed "+fmtMb(maxBytes)+"MB";
  }
  function mediaMetaRuleMsg(type,metaOrItem){
    if(!metaOrItem||vm.refKind!=='media-refs')return '';
    if(type==='video'){
      var d=Number(metaOrItem.duration||metaOrItem.sourceDurationSec||0);
      if(d && (d<2 || d>15))return 'Video reference must be 2–15 seconds long';
      // AUDIT FIX: 1080p/4K bloklash OLIB TASHLANDI — server (optimize-preview) HAR QANDAY
      // o'lchamni avtomatik 720p/480p ga tushiradi; ilgari foydalanuvchi O'ZI yaratgan 1080p
      // gen natijasini referens qilolmasdi (yolg'on "480p–720p bo'lishi kerak" xatosi).
    }
    if(type==='audio'){
      var ad=Number(metaOrItem.duration||metaOrItem.sourceDurationSec||0);
      if(ad && ad>15)return 'Audio reference must not be longer than 15 seconds';
    }
    return '';
  }
  function totalRefBytes(type){
    return mref.filter(function(r){ return r.type===type; }).reduce(function(sum,r){ return sum + (Number(r.sizeBytes)||0); },0);
  }
  function refTypeFromItem(it){
    var cat=(it&&it.cat)||'image';
    return (cat==='video')?'video':((cat==='audio'||cat==='sfx')?'audio':'image');
  }
  function refUploadErr(err,type){
    var msg=(typeof friendlyError==='function')?friendlyError(err):((err&&err.message)||'Upload error');
    if(err&&err.code==='VIDEO_REF_STILL_TOO_LARGE')return 'The selected video clip is still over 50MB after server optimization — choose a shorter part';
    if(/maximum allowed size of 52428800 bytes|file size exceeds the maximum allowed size/i.test(String((err&&err.message)||''))){
      return mediaRefTotalLimitMsg(type,mediaRefTotalLimitBytes(type)||50*1024*1024);
    }
    if(err&&((err.status===413)||(err.code==='PAYLOAD_TOO_LARGE')))return typeLabel(type)+' reference is too large — choose a file smaller than 100MB';
    if(err&&((err.status===408)||/upload timeout|javob bermadi/i.test(String(err.message||''))))return typeLabel(type)+" reference upload took too long — please try again";
    if(err&&err.status>=500&&/server xatosi/i.test(String(err.message||'')))return typeLabel(type)+' reference was not accepted by the server — the backend upload limit may need updating';
    return msg;
  }
  function appendUploadedRef(type,payload){
    if(!payload||!payload.url)return null;
    if(!mediaAllowed(type))return null;
    if(mref.some(function(r){ return r.type===type&&r.url===payload.url; }))return null;
    var sizeBytes=(payload&&payload.bytes)||0, lim=mediaRefLimitBytes(type), totalLim=mediaRefTotalLimitBytes(type);
    if(lim&&sizeBytes&&sizeBytes>lim){ toast(mediaRefLimitMsg(type,lim),'warning'); return null; }
    if(totalLim&&sizeBytes&&(totalRefBytes(type)+sizeBytes)>totalLim){ toast(mediaRefTotalLimitMsg(type,totalLim),'warning'); return null; }
    var obj={type:type,dataUrl:type==='image'?(payload.thumb||payload.url):null,url:payload.url,loading:false,source:'upload',sizeBytes:sizeBytes||0,savedRefId:(payload&&payload.id)||null,expiresAt:(payload&&payload.expiresAt)||null};
    mref.push(obj); syncMediaRefTokens(); renderMediaRefs(); updRefMeta(); refreshVgBtn();
    return obj;
  }
  function updRefMeta(){
    var lim=vm.mediaRefs||{image:9,video:3,audio:3,total:12};
    // b5: hisob mockup formatida — "Rasm 2/3 · Video 1/1 · Ovoz 0/1"
    // SC_27: hisoblagich faqat model QO'LLAYDIGAN turlarni ko'rsatadi (Omni'da "Voice 0/0" chiqmasin)
    var m=$('vgRefMeta'); if(m){ var mm=[]; if(lim.image)mm.push('Image '+cntRef('image')+'/'+lim.image); if(lim.video)mm.push('Video '+cntRef('video')+'/'+lim.video); if(lim.audio)mm.push('Audio '+cntRef('audio')+'/'+lim.audio); m.textContent=mm.join(' · '); }
    // limit to'lgan turdagi + chip xira (mockup: +Video dim)
    // SC_27: limit=0 tur (masalan Omni audio) — tugma umuman YASHIRIN (o'chirilgan-shovqin emas)
    var ai=$('vgAddImg'); if(ai){ ai.style.display=(lim.image||0)>0?'':'none'; ai.classList.toggle('dim',cntRef('image')>=(lim.image||0)); }
    var av=$('vgAddVid'); if(av){ av.style.display=(lim.video||0)>0?'':'none'; av.classList.toggle('dim',cntRef('video')>=(lim.video||0)); }
    var aa2=$('vgAddAud'); if(aa2){ aa2.style.display=(lim.audio||0)>0?'':'none'; aa2.classList.toggle('dim',cntRef('audio')>=(lim.audio||0)); }
    // Limitlarni OLDINDAN ko'rsatamiz (fayl tanlagandan keyin xato chiqishidan oldin).
    var h=$('vgRefLimits');
    if(h){
      var imgMb=(vm.mediaRefMaxBytes&&vm.mediaRefMaxBytes.image)?Math.round(vm.mediaRefMaxBytes.image/1048576):0;
      var vidMb=(vm.mediaRefMaxTotalBytes&&vm.mediaRefMaxTotalBytes.video)?Math.round(vm.mediaRefMaxTotalBytes.video/1048576):0;
      // SC_27: faqat model qo'llaydigan turlar (limit 0 tur reklama qilinmaydi)
      var hh=[];
      if(lim.image)hh.push(lim.image+' image(s)'+(imgMb?(' ≤'+imgMb+'MB'):''));
      if(lim.video)hh.push(lim.video+' video(s)'+(vidMb?(' total ≤'+vidMb+'MB'):''));
      if(lim.audio)hh.push(lim.audio+' audio');
      h.textContent=hh.length?('Max '+hh.join(' · ')+(lim.total?(' · total '+lim.total):'')):'';
    }
    applyVgArLock(); // video referens qo'shildi/olindi → nisbat chipi qulfi yangilansin (Omni)
    if(typeof updAddMenu==='function')updAddMenu(); // SC_42: [+] badge/menyu item darvozalari
  }
  // Nisbat chipi qulfi: model video-referens bilan nisbatni e'tiborga olmasa (Omni: API 400 bermasligi
  // uchun adapter aspect'ni tashlab yuboradi) — chip xira + tushuntirish, foydalanuvchi aldanmaydi.
  function applyVgArLock(){
    // P16 — vgArSeg endi yo'q (guruhlangan sozlama sheet'i); qulf holati sheet ochilganda
    //   buildVgSettings ichida qo'llanadi (vgArPills dis + hint). Bu funksiya endi no-op qoldi.
  }
  /* SD2-EDIT-PRESETS v1 — sync manually with packages/assetflow-studio/platform/index.html */
  var VG_EDIT_PRESETS=[
    {label:'Replace subject',tpl:'Replace the <subject> in @video1 with the one from @img1. Keep camera movement, lighting, background, pacing and all other elements completely unchanged.'},
    {label:'Edit objects',tpl:'Insert <object> from @img1 into @video1 at <where/when>. Match position, scale, perspective, lighting and shadows; keep everything else unchanged.'},
    {label:'Inpaint / Fix',tpl:'Make <element> in @video1 <desired change>. Do not modify the background, lighting, camera motion, or any other element.'}
  ];
  // P18 — SD2 promptlari (@video1+@img1) faqat Seedance 2.0 oilasiga mos (feature: reference-to-video);
  // boshqa media-refs modellarda (Omni Flash, video-upscale) ma'nosiz bo'lardi — model-aware gate.
  function renderVgEditPresets(){
    var bar=$('vgEditPresets'); if(!bar)return;
    if(!hasVideoRefs()||!vm.model||vm.model.feature!=='reference-to-video'){ bar.style.display='none'; bar.innerHTML=''; return; }
    if(!bar.childNodes.length){
      VG_EDIT_PRESETS.forEach(function(p){
        var b=document.createElement('button'); b.type='button'; b.className='stag'; b.textContent=p.label;
        b.title='Insert an edit template into the prompt';
        b.addEventListener('click',function(){ insertVgTok(p.tpl); });
        bar.appendChild(b);
      });
    }
    bar.style.display='flex';
  }
  function renderMediaRefs(){
    var g=$('vgRefGrid'); if(!g)return; g.innerHTML='';
    var flags=vgActiveFlags(); // P13 — qaysi mref FAOL (model proyeksiyasi)
    mref.forEach(function(r,i){
      var active=!!flags.active[i];
      var tag=r.token||tokFor(r.type,i+1);
      var d=document.createElement('div'); d.className='mrt'+(r.type==='video'?' vid':r.type==='audio'?' aud':'')+(active?'':' dim');
      if(!active)d.title=(((vm.model&&vm.model.label)||'This model')+" doesn't use "+r.type+" references here — kept");
      if(r.type==='image'&&r.dataUrl)d.style.backgroundImage='url("'+r.dataUrl+'")';
      // VIDEO chip: gradient emas — HAQIQIY birinchi kadr (foydalanuvchi adashmasligi uchun).
      // DIQQAT: overflow:hidden EMAS — .rx (×) tugmasi chip tashqarisida (top:-6px) — kesilmasin;
      // buning o'rniga video elementning o'zi tile radiusi bilan yumaloqlanadi.
      if(r.type==='video'&&r.url&&typeof window.afVideoThumb==='function'){
        var vt=window.afVideoThumb(r.url); if(vt){ vt.style.borderRadius='10px'; vt.style.zIndex='0'; d.appendChild(vt); }
      }
      var t=document.createElement('div'); t.className='tag'; t.textContent=tag; t.style.position='relative'; t.style.zIndex='2'; d.appendChild(t);
      if(r.loading){ var sp=document.createElement('div'); sp.className='msp'; sp.textContent='…'; d.appendChild(sp); }
      var x=document.createElement('div'); x.className='rx'; x.textContent='×'; x.title='Remove';
      (function(idx){ x.addEventListener('click',function(e){
        e.stopPropagation();
        var removed=(mref[idx]&&mref[idx].token)||null;
        mref.splice(idx,1);
        syncMediaRefTokens(removed);
        renderMediaRefs(); updRefMeta(); refreshVgBtn();
      }); })(i);
      d.appendChild(x);
      if(active)d.title='Add '+tag+' to prompt'; // P13 — nofaol chip title'i (sabab) saqlanadi
      d.addEventListener('click',function(){ if(active)insertVgTok(tag); });
      g.appendChild(d);
    });
    renderVgEditPresets(); // referens o'zgargach edit-preset chiplarini yangilash
  }
  function renderVgSavedRefs(){
    var wrap=$('vgSavedWrap'), grid=$('vgSavedGrid'), meta=$('vgSavedMeta');
    if(!wrap||!grid||vm.refKind!=='media-refs'){ if(wrap)wrap.style.display='none'; return; }
    wrap.style.display='none';
    grid.innerHTML='';
    return;
  }
  function loadVgSavedRefs(force){
    if(vm.refKind!=='media-refs'){ renderVgSavedRefs(); return; }
    if(vgSaved.loading||(!force&&vgSaved.loaded))return;
    vgSaved.loading=true; if(force)vgSaved.loaded=false; vgSaved.error='';
    renderVgSavedRefs();
    studioGet('/api/studio/gen/references?limit=12').then(function(d){
      vgSaved.items=((d&&d.items)||[]).map(function(it){
        return {
          id:it.id,
          kind:it.kind||'image',
          url:it.url,
          thumbUrl:it.thumbUrl||null,
          contentType:it.contentType||'',
          sizeBytes:(it&&it.sizeBytes)||0,
          expiresAt:it.expiresAt
        };
      });
      vgSaved.ttlMs=(d&&d.ttlMs)||600000;
      vgSaved.loaded=true; vgSaved.loading=false; vgSaved.error='';
      renderVgSavedRefs();
    }).catch(function(err){
      vgSaved.loaded=false; vgSaved.loading=false; vgSaved.error=(err&&err.message)||'Error';
      renderVgSavedRefs();
    });
  }
  // #6: chip-editor orqali — token(lar) mos referens bo'lsa atom pill bo'lib kiradi (preset shablonlar ham)
  function insertVgTok(tok){ vgEd.insertText(tok+' ',true); refreshVgBtn(); }
  function uploadMediaRef(src,type){
    var sizeBytes=(src&&src.sizeBytes)||0, lim=mediaRefLimitBytes(type), totalLim=mediaRefTotalLimitBytes(type);
    if(lim&&sizeBytes&&sizeBytes>lim){ toast(mediaRefLimitMsg(type,lim),'warning'); return; }
    if(type!=='video' && totalLim&&sizeBytes&&(totalRefBytes(type)+sizeBytes)>totalLim){ toast(mediaRefTotalLimitMsg(type,totalLim),'warning'); return; }
    var metaSrc=(type==='video'&&src&&(src.skipClipper||src.clipMode))?src:((src&&src.meta)||src);
    var metaMsg=mediaMetaRuleMsg(type,metaSrc);
    if(metaMsg){ toast(metaMsg,'warning'); return; }
    var preview=(src&&src.dataUrl)||null;
    var obj={type:type,dataUrl:type==='image'?preview:null,url:null,loading:true,sizeBytes:(type==='video'?0:(sizeBytes||0))};
    mref.push(obj); syncMediaRefTokens(); renderMediaRefs(); updRefMeta(); refreshVgBtn();
    studioUploadRefUniversal(src).then(function(r){
      if(!r||!r.url){ toast('Failed to upload reference','error'); var i=mref.indexOf(obj); if(i>=0){ var removed=(mref[i]&&mref[i].token)||null; mref.splice(i,1); syncMediaRefTokens(removed); } renderMediaRefs(); updRefMeta(); refreshVgBtn(); return; }
      var finalBytes=(r&&r.bytes)||obj.sizeBytes||0;
      if(totalLim&&finalBytes&&(totalRefBytes(type)+finalBytes)>totalLim){
        toast(mediaRefTotalLimitMsg(type,totalLim),'warning');
        var ti=mref.indexOf(obj); if(ti>=0){ var tremoved=(mref[ti]&&mref[ti].token)||null; mref.splice(ti,1); syncMediaRefTokens(tremoved); }
        renderMediaRefs(); updRefMeta(); refreshVgBtn(); return;
      }
      obj.url=r.url; obj.loading=false; obj.sizeBytes=finalBytes; obj.savedRefId=r.id||null; obj.expiresAt=r.expiresAt||null; renderMediaRefs(); refreshVgBtn(); loadVgSavedRefs(true);
      if(type==='video'&&r.audioRef&&r.audioRef.url){
        var addedAudio=appendUploadedRef('audio',r.audioRef);
        if(addedAudio)toast('Video and its audio added as references','success');
        else if(r.audioError)toast(r.audioError,'warning');
      }else if(type==='video'&&r.audioError){
        toast(r.audioError,'warning');
      }
    }).catch(function(e){ toast(refUploadErr(e,type),'error'); var i=mref.indexOf(obj); if(i>=0){ var removed=(mref[i]&&mref[i].token)||null; mref.splice(i,1); syncMediaRefTokens(removed); } renderMediaRefs(); updRefMeta(); refreshVgBtn();
    }).then(function(){ cleanupMediaSource(src); },function(){ cleanupMediaSource(src); });
  }
  function addExistingMediaRef(it){
    var type=refTypeFromItem(it);
    if(!mediaAllowed(type))return false;
    if(!it||!it.url){ toast('Reference not found','warning'); return false; }
    if(!savedRefFormatAllowed(type,it)){ toast(typeLabel(type)+' format is not compatible with this model','warning'); return false; }
    var lim=mediaRefLimitBytes(type), totalLim=mediaRefTotalLimitBytes(type), sizeBytes=(it&&it.sizeBytes)||0;
    if(lim&&sizeBytes&&sizeBytes>lim){ toast(mediaRefLimitMsg(type,lim),'warning'); return false; }
    if(totalLim&&sizeBytes&&(totalRefBytes(type)+sizeBytes)>totalLim){ toast(mediaRefTotalLimitMsg(type,totalLim),'warning'); return false; }
    var metaMsg=mediaMetaRuleMsg(type,it);
    if(metaMsg){ toast(metaMsg,'warning'); return false; }
    if(mref.some(function(r){ return r.type===type&&r.url===it.url; })){ toast(typeLabel(type)+' reference already added','info'); return false; }
    var obj={type:type,dataUrl:type==='image'?(it.thumb||it.url):null,url:it.url,loading:false,source:'recent',sizeBytes:sizeBytes||0,savedRefId:it.savedRefId||it.id||null,expiresAt:it.expiresAt||null};
    mref.push(obj); syncMediaRefTokens(); renderMediaRefs(); updRefMeta(); refreshVgBtn();
    insertVgTok(obj.token||tokFor(type,cntRef(type)));
    toast(typeLabel(type)+' reference added','success');
    return true;
  }
  function prepAndUploadMediaRef(src,type){
    if(type==='image'){ uploadMediaRef(src,type); return; }
    if(type==='video' && !(src&&src.skipClipper)){ openVgClipper(src).catch(function(e){ toast((e&&e.message)||'Failed to open video reference','error'); }); return; }
    inspectMediaSource(src,type).then(function(){ uploadMediaRef(src,type); }).catch(function(){ uploadMediaRef(src,type); });
  }
  function mediaExts(type){
    var fm=vm.mediaRefFormats&&vm.mediaRefFormats[type];
    if(fm&&fm.length)return fm.slice();
    return type==='image'?['png','jpg','jpeg','webp','gif']:type==='video'?['mp4','webm','mov','m4v']:['mp3','wav','m4a','aac','ogg'];
  }
  function mediaAllowed(type){ // limit tekshiruvi (manba tanlashdan oldin)
    var lim=vm.mediaRefs||{image:9,video:3,audio:3,total:12};
    if(mref.length>=lim.total){ toast('Total references ≤'+lim.total,'warning'); return false; }
    if(cntRef(type)>=lim[type]){ toast(typeLabel(type)+' ≤'+lim[type],'warning'); return false; }
    return true;
  }
  // Bitta disk-fayl yo'lidan referens qo'shadi (Fayl/Project/Timeline manbalari shuni chaqiradi).
  function addOneMediaPath(path,type){
    if(!path)return;
    var st=readFileStat(path);
    var src={path:path,dataUrl:(type==='image'?readDataUrl(path):null),sizeBytes:(st&&st.size)||0};
    prepAndUploadMediaRef(src,type);
  }
  // Bir nechta fayl yo'lini qo'shadi (multi-import): bo'sh slotlar qadar, limitдан oshmaydi.
  function addMediaPaths(paths,type){
    var list=(paths||[]).filter(function(p){ return p && extAllowed(type,p); });
    if(!list.length){ toast(typeLabel(type)+' format is not compatible','warning'); return; }
    var lim=vm.mediaRefs||{image:9,video:3,audio:3,total:12};
    var slots=Math.min((lim[type]||0)-cntRef(type),(lim.total||0)-mref.length);
    if(slots<=0){ toast(typeLabel(type)+' limit reached','warning'); return; }
    if(type==='video'){ addOneMediaPath(list[0],'video'); if(list.length>1)toast('Videos are added one at a time — select the rest later','info'); return; }
    var take=list.slice(0,slots);
    take.forEach(function(p){ addOneMediaPath(p,type); });
    if(list.length>take.length)toast(take.length+' added (limit '+lim[type]+')','info');
  }
  // Manba 1 — Fayl yuklash (kompyuterdan); rasm/ovoz uchun BIR NECHTA fayl tanlash mumkin (video bittadan)
  async function pickFileMedia(type){
    if(!IS_CEP){ toast('File upload only works inside Premiere Pro','info'); return; }
    if(!mediaAllowed(type))return;
    var multi=(type!=='video'); // video klipperда bittadan
    var r; try{ r=await window.cep.fs.showOpenDialog(multi,false,'Choose '+typeLabel(type).toLowerCase()+' reference(s)','',mediaExts(type)); }catch(e){ toast('Dialog error','error'); return; }
    var paths=(r&&r.data)||[]; if(!paths.length)return;
    addMediaPaths(paths,type);
    if(type!=='video')closeVgSheets();
  }
  // Manba 2 — Project paneldan (Premiere footage); turga mos filtr. Rasm/ovoz: CHECKBOX multi-select (birdaniga).
  function pickProjMedia(type){
    if(typeof csInterface==='undefined'||!csInterface){ toast('Project panel only works inside Premiere Pro','info'); closeVgSheets(); return; }
    if(!mediaAllowed(type)){ closeVgSheets(); return; }
    var host=$('vgProjList'); if(!host)return;
    var multi=(type!=='video'); // video: klipper bittadan → multi yo'q
    var sel={}; // mediaPath → true
    var foot=$('vgProjFoot'), info=$('vgProjInfo'), addBtn=$('vgProjAdd');
    if(foot)foot.style.display=multi?'flex':'none';
    function slotsLeft(){ var lim=vm.mediaRefs||{image:9,video:3,audio:3,total:12}; return Math.max(0,Math.min((lim[type]||0)-cntRef(type),(lim.total||0)-mref.length)); }
    function refreshFoot(){ var n=Object.keys(sel).length; if(info)info.textContent=n+' selected · space left '+slotsLeft(); if(addBtn){ addBtn.textContent='Add'+(n?(' ('+n+')'):''); addBtn.style.opacity=n?'1':'.5'; } }
    if(addBtn)addBtn.onclick=function(){ var paths=Object.keys(sel); if(!paths.length){ toast('Select something first','warning'); return; } addMediaPaths(paths,type); closeVgSheets(); };
    host.innerHTML='<div class="axighint">Loading…</div>'; openVgSheet('vgProjSheet',_vgSrcTarget.anchor);
    hostCall('listProjectFootage').then(function(r){
      if(!$('vgProjList'))return;
      if(!r||(r.ok===false)){ host.innerHTML='<div class="axighint">Could not get project list'+((r&&r.reason)?': '+r.reason:'')+'</div>'; if(foot)foot.style.display='none'; repositionVgSheet('vgProjSheet'); return; }
      var items=((r&&r.items)||[]).filter(function(it){
        var mp=it&&it.mediaPath||'';
        if(type==='image')return (it.mediaType==='image'||isImg(mp)) && extAllowed(type,mp);
        return it.mediaType===type && extAllowed(type,mp);
      });
      if(!items.length){ host.innerHTML='<div class="axighint">No matching '+typeLabel(type).toLowerCase()+' found in the project. Upload from file.</div>'; if(foot)foot.style.display='none'; repositionVgSheet('vgProjSheet'); return; }
      host.innerHTML='';
      items.forEach(function(it){
        var d=document.createElement('div'); d.className='opt';
        d.innerHTML='<div class="oi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></div><div><b>'+String(it.name||it.mediaPath||'').replace(/[<>&]/g,'')+'</b><small>'+(it.mediaType||type)+'</small></div>'+(multi?'<span class="vgprojchk" style="margin-left:auto;font-size:15px;color:var(--acc);width:20px;text-align:center">○</span>':'');
        (function(item,row){ d.addEventListener('click',function(){
          var mp=item.mediaPath||''; if(!mp)return;
          if(!multi){ if(!mediaAllowed('video'))return; addOneMediaPath(mp,'video'); closeVgSheets(); return; }
          var chk=row.querySelector('.vgprojchk');
          if(sel[mp]){ delete sel[mp]; row.style.backgroundColor=''; if(chk)chk.textContent='○'; }
          else { if(Object.keys(sel).length>=slotsLeft()){ toast('Not enough space left (≤'+slotsLeft()+')','warning'); return; } sel[mp]=true; row.style.backgroundColor='var(--accent-soft)'; if(chk)chk.textContent='✓'; }
          refreshFoot();
        }); })(it,d);
        host.appendChild(d);
      });
      refreshFoot(); repositionVgSheet('vgProjSheet');
    }).catch(function(e){ if($('vgProjList'))$('vgProjList').innerHTML='<div class="axighint">Could not get project list: '+String(e)+'</div>'; repositionVgSheet('vgProjSheet'); });
  }
  // Manba 3 — Timeline'dan (joriy kadr → PNG); FAQAT rasm referens uchun
  function pickTlMedia(){
    if(typeof csInterface==='undefined'||!csInterface){ toast('Timeline frame only works inside Premiere Pro','info'); closeVgSheets(); return; }
    if(!mediaAllowed('image')){ closeVgSheets(); return; }
    closeVgSheets(); toast('Exporting frame…','info');
    hostCall('exportTimelineFrame').then(function(r){
      if(!r||!r.path){ toast('Could not get frame'+((r&&r.reason)?': '+r.reason:' — make sure a comp is open in the Timeline'),'warning'); return; }
      var du=readDataUrl(r.path); if(du){ uploadMediaRef({path:r.path,dataUrl:du},'image'); } else { toast('Could not read frame','error'); }
    }).catch(function(e){ toast('Frame export error: '+String(e),'error'); });
  }
  // Manba 3b — Timeline'dan (video/audio): TANLANGAN layer manba fayli (getActiveTimelineVideoReference)
  function pickTlSource(type){
    if(typeof csInterface==='undefined'||!csInterface){ toast('Timeline only works inside Premiere Pro','info'); closeVgSheets(); return; }
    if(!mediaAllowed(type)){ closeVgSheets(); return; }
    closeVgSheets(); toast('Getting timeline clip…','info');
    hostCall('getActiveTimelineVideoReference').then(function(r){
      if(!r||!r.mediaPath){ toast('Could not get clip'+((r&&r.reason)?': '+r.reason:' — select a clip in the Timeline'),'warning'); return; }
      var okType=(type==='video')?(r.hasVideo||r.mediaType==='video'):(r.hasAudio||r.mediaType==='audio');
      if(!okType){ toast('Selected clip is not '+typeLabel(type).toLowerCase(),'warning'); return; }
      if(!extAllowed(type,r.mediaPath)){ toast(typeLabel(type)+' format is not compatible','warning'); return; }
      addOneMediaPath(r.mediaPath,type);
    }).catch(function(e){ toast('Timeline error: '+String(e),'error'); });
  }
  // ＋Rasm/＋Video/＋Ovoz → manba menyu (Fayl/Project/Timeline) — kadrlardagidek (vgSrcSheet qayta ishlatiladi)
  function openMediaSrc(type,anch){
    if(!mediaAllowed(type))return;
    _vgSrcTarget={kind:'media',type:type,anchor:anch||$(type==='image'?'vgAddImg':type==='video'?'vgAddVid':'vgAddAud')};
    var t=$('vgSrcTitle'); if(t)t.textContent=typeLabel(type)+' reference';
    var tl=$('vgSrcTl'); if(tl){ tl.style.display=''; var s3=tl.querySelector('small'); if(s3)s3.textContent=(type==='image')?'frame from sequence':'selected clip source'; } // image=kadr PNG · video/audio=layer manbasi
    var fs=$('vgSrcFile'); if(fs){var s=fs.querySelector('small'); if(s)s.textContent='from computer — '+typeLabel(type).toLowerCase();}
    var pr=$('vgSrcProj'); if(pr){var s2=pr.querySelector('small'); if(s2)s2.textContent='Premiere project — '+typeLabel(type).toLowerCase();}
    openVgSheet('vgSrcSheet',_vgSrcTarget.anchor);
  }
  // SC_27: +Image/+Video/+Audio tugmalari QAYTA ULANDI — media-refs DOM (vgMediaSect) endi mavjud;
  // mref mashinasi (uploadMediaRef/renderMediaRefs/limitlar) o'zgarishsiz qayta ishlatiladi.
  (function(){
    [['vgAddImg','image'],['vgAddVid','video'],['vgAddAud','audio']].forEach(function(p){
      var b=$(p[0]); if(b)b.addEventListener('click',function(){ openMediaSrc(p[1],b); });
    });
  })();
  // SC_42: [+] add-input menyu — model-aware; mavjud openerlarni [+] anchor bilan proksi qiladi.
  (function(){
    var menu=$('vgAddMenu'), addBtn=$('vgRefAdd');
    function pick(fn){ return function(){ if(menu)menu.classList.remove('open'); fn(); }; }
    var map=[['vgAddStart',function(){ openFrameSrc('start',addBtn); }],
             ['vgAddEnd',function(){ openFrameSrc('end',addBtn); }],
             ['vgAddImgM',function(){ openMediaSrc('image',addBtn); }],
             ['vgAddVidM',function(){ openMediaSrc('video',addBtn); }],
             ['vgAddAudM',function(){ openMediaSrc('audio',addBtn); }]];
    map.forEach(function(m){ var b=$(m[0]); if(b)b.addEventListener('click',pick(m[1])); });
  })();
  // SC_42: [+] menyu item ko'rinishi/disabled + [+] badge + limits tooltip — model imkoniyati + limitlardan.
  function updAddMenu(){
    var lim=vm.mediaRefs||{};
    function setItem(id,show,full,reason){ var b=$(id); if(!b)return; b.style.display=show?'':'none'; b.classList.toggle('dim',!!full); b.disabled=!!full; b.title=full?(reason||'Limit reached'):''; }
    var framesOk=!!vm.framesOk, endOk=!!(vm.framesOk&&vm.endFrameOk);
    setItem('vgAddStart',framesOk,!!st.start,'Start frame already added');
    setItem('vgAddEnd',endOk,!!st.end,'End frame already added');
    setItem('vgAddImgM',(lim.image||0)>0,cntRef('image')>=(lim.image||0),'Up to '+(lim.image||0)+' images');
    setItem('vgAddVidM',(lim.video||0)>0,cntRef('video')>=(lim.video||0),'Up to '+(lim.video||0)+' videos');
    setItem('vgAddAudM',(lim.audio||0)>0,cntRef('audio')>=(lim.audio||0),'Up to '+(lim.audio||0)+' audio');
    // SC_43: referens sig'imi ikonka indikatori (yagona) — [+] total badge O'RNIGA.
    var imgMb=(vm.mediaRefMaxBytes&&vm.mediaRefMaxBytes.image)?Math.round(vm.mediaRefMaxBytes.image/1048576):0;
    var vidMb=(vm.mediaRefMaxTotalBytes&&vm.mediaRefMaxTotalBytes.video)?Math.round(vm.mediaRefMaxTotalBytes.video/1048576):0;
    if(typeof window.afRenderCapInd==='function')window.afRenderCapInd('vgCapInd',[
      {k:'image',used:cntRef('image'),lim:(lim.image||0),tip:'Up to '+(lim.image||0)+' image'+((lim.image||0)===1?'':'s')+(imgMb?(' ≤'+imgMb+'MB each'):'')},
      {k:'video',used:cntRef('video'),lim:(lim.video||0),tip:'Up to '+(lim.video||0)+' video'+((lim.video||0)===1?'':'s')+(vidMb?(' · total ≤'+vidMb+'MB'):'')},
      {k:'audio',used:cntRef('audio'),lim:(lim.audio||0),tip:'Up to '+(lim.audio||0)+' audio'}
    ]);
    var badge=$('vgRefCt'); if(badge)badge.style.display='none'; // SC_43: total badge o'rniga ikonka indikatori
    var add=$('vgRefAdd'); if(add){ var t=[]; if(framesOk)t.push('Start'+(endOk?'/End':'')+' frame'); if(lim.image)t.push('Up to '+lim.image+' images'); if(lim.video)t.push(lim.video+' video'); if(lim.audio)t.push(lim.audio+' audio'); add.title=t.length?('Add input — '+t.join(' · ')):'Add input'; }
    var any=framesOk||(lim.image||0)>0||(lim.video||0)>0||(lim.audio||0)>0;
    var sect=$('vgRefSect'); if(sect)sect.style.display=any?'':'none';
  }
  (function(){
    var full=$('vgClipFull'), part=$('vgClipPart'), cancel=$('vgClipCancel'), apply=$('vgClipApply'), audioTgl=$('vgClipAudioToggle');
    if(full)full.addEventListener('click',function(){
      if(!vgClip.totalSec)return;
      vgClip.mode='full';
      renderVgClipUi();
    });
    if(part)part.addEventListener('click',function(){
      if(!vgClip.totalSec)return;
      vgClip.mode='part';
      if(vgClip.lastEndSec>vgClip.lastStartSec){
        vgClip.startSec=vgClip.lastStartSec;
        vgClip.endSec=vgClip.lastEndSec;
      }
      renderVgClipUi();
    });
    if(audioTgl)audioTgl.addEventListener('click',function(){
      if(!clipAudioSupported()||!clipAudioCapacity())return;
      vgClip.includeAudio=!vgClip.includeAudio;
      renderVgClipAudioUi();
    });
    if(cancel)cancel.addEventListener('click',closeVgSheets);
    if(apply)apply.addEventListener('click',function(){
      if(vgClip.busy||!vgClip.src)return;
      var start=vgClip.mode==='full'?0:(Number(vgClip.startSec)||0);
      var end=vgClip.mode==='full'?(Number(vgClip.totalSec)||0):(Number(vgClip.endSec)||0);
      var dur=Math.max(0,end-start);
      if(dur<2){ toast('Select at least 2 seconds','warning'); return; }
      if(dur>15){ toast('Must not be longer than 15 seconds','warning'); return; }
      vgClip.busy=true;
      apply.textContent='Uploading to server…';
      apply.setAttribute('aria-disabled','true');
      toast('Video reference will be trimmed and optimized on the server…','info');
      var uploadSrc={
        path:vgClip.src.path||null,
        srcUrl:vgClip.src.srcUrl||null, // So'nggi grid gen natijasi — server bucket'dan o'zi oladi
        sizeBytes:(vgClip.src&&vgClip.src.sizeBytes)||0,
        meta:vgClip.meta,
        skipClipper:true,
        clipMode:vgClip.mode,
        clipStartSec:start,
        clipEndSec:end,
        extractAudioRef:!!vgClip.includeAudio
      };
      closeVgSheets();
      prepAndUploadMediaRef(uploadSrc,'video');
    });
  })();
  // @ mention (faqat media-refs; referens token'larini promptga PILL sifatida qo'shadi — #6)
  function hideVgMention(){ var m=$('vgMention'); if(m)m.classList.remove('on'); }
  function checkVgMention(){
    if(vm.refKind!=='media-refs'||!mref.length){ hideVgMention(); return; }
    var pre=vgEd.textBeforeCaret(); if(pre==null){ hideVgMention(); return; }
    var m=pre.match(/@(\w*)$/);
    if(m)showVgMention(m[1]); else hideVgMention();
  }
  var vgMenIdx=0;
  function vgMenItems(){ var m=$('vgMention'); return m?m.querySelectorAll('.mitem'):[]; }
  function moveVgMention(d){
    var its=vgMenItems(); if(!its.length)return;
    vgMenIdx=(vgMenIdx+d+its.length)%its.length;
    Array.prototype.forEach.call(its,function(x,ix){ x.classList.toggle('sel',ix===vgMenIdx); });
  }
  function pickVgTok(tok){ // "@so'z" → pill + bo'shliq (chip-editor caret almashtiruvi)
    var pre=vgEd.textBeforeCaret(); var m=pre?pre.match(/@(\w*)$/):null;
    if(m)vgEd.replaceBeforeCaret(m[0].length,tok+' ');
    else vgEd.insertText(tok+' ',true);
    hideVgMention(); refreshVgBtn();
  }
  function pickVgMentionActive(){ // Enter — faol (sel) qatorni tanlash; dropdown ochiq bo'lsa true
    var its=vgMenItems(); if(!its.length)return false;
    var ix=Math.min(vgMenIdx,its.length-1);
    pickVgTok(its[ix].getAttribute('data-t'));
    return true;
  }
  function showVgMention(q){
    var men=$('vgMention'); if(!men)return; q=(q||'').toLowerCase();
    var GL={image:'⊞',video:'▶',audio:'♪'};
    var html='<div class="mh">References</div>',n=0,ci={image:0,video:0,audio:0};
    mref.forEach(function(r){ ci[r.type]++; var nm=r.token||tokFor(r.type,ci[r.type]); if(q&&nm.toLowerCase().indexOf('@'+q)!==0)return; n++;
      var bg=r.type==='image'&&r.dataUrl?('background-image:url(\''+r.dataUrl+'\')'):(r.type==='video'?'background:#2a1f40':r.type==='audio'?'background:#0f3030':'background:#222');
      var glyph=(r.type==='image'&&r.dataUrl)?'':GL[r.type]||''; // thumb bo'lmasa tur belgisi (Dreamina uslubi)
      html+='<div class="mitem" data-t="'+nm+'"><div class="mt" style="'+bg+';display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--mut)">'+glyph+'</div><div><b>'+nm.replace(/^@(\D+)(\d+)$/,'@$1 $2')+'</b><small>'+typeLabel(r.type)+'</small></div></div>'; });
    if(!n){ hideVgMention(); return; }
    men.innerHTML=html; men.classList.add('on');
    vgMenIdx=0; var its=vgMenItems(); if(its.length)its[0].classList.add('sel');
    Array.prototype.forEach.call(its,function(el){ el.addEventListener('mousedown',function(ev){ ev.preventDefault(); pickVgTok(el.getAttribute('data-t')); }); });
  }

  // ── kadr render (fbox ichiga thumb/spinner/× qo'yadi) ──
  function renderFrameBoxes(){ renderFbox('vgStartBox',st.start,'start'); renderFbox('vgEndBox',st.end,'end'); if(typeof updAddMenu==='function')updAddMenu(); }
  function renderFbox(id,frame,which){
    var box=$(id); if(!box)return;
    var wrap=box.parentNode; // SC_42: vgStartWrap/vgEndWrap — bo'sh kadr strip'da KO'RSATILMAYDI
    box.innerHTML='';
    // P13 — kadr ROL: model qo'llamasa XIRA (o'chirilmaydi, hovuzda qoladi). start=framesOk; end=framesOk&&endFrameOk.
    var active=(which==='start')?!!vm.framesOk:!!(vm.framesOk&&vm.endFrameOk);
    if(!frame){ box.classList.remove('has-img'); if(wrap)wrap.style.display='none'; return; }
    if(wrap)wrap.style.display='';
    box.classList.toggle('dim',!active);
    box.title=(!active)?(((vm.model&&vm.model.label)||'This model')+((which==='end')?" doesn't accept an end frame":" doesn't use frames")+' — kept'):'';
    box.classList.add('has-img');
    var img=document.createElement('img'); img.className='fb-thumb'; img.src=frame.dataUrl; box.appendChild(img);
    if(frame.loading){
      var sp=document.createElement('div'); sp.style.cssText='position:absolute;top:0;right:0;bottom:0;left:0;background-color:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;border-radius:9px;z-index:2'; sp.textContent='Loading…'; box.appendChild(sp);
    } else {
      // SC_42: rol nishoni START / END (frame 1/2 o'rniga)
      var tag=document.createElement('span'); tag.className='fbtag'; tag.textContent=(which==='start')?'START':'END'; box.appendChild(tag);
      var x=document.createElement('div'); x.className='fbx'; x.textContent='×'; x.title='Remove';
      (function(w){ x.addEventListener('click',function(e){ e.stopPropagation(); if(w==='start')st.start=null; else st.end=null; renderFbox(id,null,w); if(typeof updAddMenu==='function')updAddMenu(); refreshVgBtn(); }); })(which);
      box.appendChild(x);
      // re-pick on click (frame bor bo'lsa ham kadrni o'zgartirish)
      (function(w){ box.addEventListener('click',function(){ if(!box.querySelector('.fbx:hover'))openFrameSrc(w,$('vgRefAdd')); }); })(which);
    }
  }

  // ── kadr upload (dataUrl → R2 URL) ──
  function uploadFrame(src,which){
    var frameObj={dataUrl:(src&&src.dataUrl)||null,url:null,loading:true};
    if(which==='start')st.start=frameObj; else st.end=frameObj;
    renderFrameBoxes(); refreshVgBtn();
    studioUploadRefUniversal(src).then(function(r){
      if(!r||!r.url){ toast('Failed to upload frame','error'); if(which==='start')st.start=null; else st.end=null; renderFrameBoxes(); refreshVgBtn(); return; }
      frameObj.url=r.url; frameObj.loading=false; renderFrameBoxes(); refreshVgBtn();
    }).catch(function(e){ toast(refUploadErr(e,'image'),'error'); if(which==='start')st.start=null; else st.end=null; renderFrameBoxes(); refreshVgBtn(); });
  }

  // ── kadr manba funksiyalari (readDataUrl = igScript bilan bir xil isbotlangan yo'l) ──
  async function pickFileFrame(which){
    if(!IS_CEP){ toast('File upload only works inside Premiere Pro','info'); return; }
    var exts=['png','jpg','jpeg','webp','gif','bmp'],r;
    try{ r=await window.cep.fs.showOpenDialog(false,false,'Choose image','',exts); }catch(e){ toast('Dialog error','error'); return; }
    var paths=(r&&r.data)||[]; if(!paths.length)return;
    var p=paths[0]; if(!isImg(p)){ toast('Choose an image file (jpg/png/webp)','warning'); return; }
    var d=readDataUrl(p); // preview uchun dataURL, upload esa raw file
    if(d){ uploadFrame({path:p,dataUrl:d},which); } else { toast('Could not read file','error'); }
    closeVgSheets();
  }
  function pickProjFrame(which){
    if(typeof csInterface==='undefined'||!csInterface){ toast('Project panel only works inside Premiere Pro','info'); closeVgSheets(); return; }
    var host=$('vgProjList'); if(!host)return;
    host.innerHTML='<div class="axighint">Loading…</div>';
    openVgSheet('vgProjSheet',_vgSrcTarget.anchor);
    // igScript bilan bir xil: async hostCall('listProjectFootage') → {items:[{name,mediaPath,mediaType}]}.
    hostCall('listProjectFootage').then(function(r){
      if(!$('vgProjList'))return;
      if(!r||(r.ok===false)){ host.innerHTML='<div class="axighint">Could not get project list'+((r&&r.reason)?': '+r.reason:'')+'</div>'; repositionVgSheet('vgProjSheet'); return; }
      var items=((r&&r.items)||[]).filter(function(it){ return it.mediaType==='image'||isImg(it.mediaPath); });
      if(!items.length){ host.innerHTML='<div class="axighint">No matching image found in the project. Upload from file.</div>'; repositionVgSheet('vgProjSheet'); return; }
      host.innerHTML='';
      items.forEach(function(it){
        var d=document.createElement('div'); d.className='opt';
        d.innerHTML='<div class="oi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></div><div><b>'+String(it.name||it.mediaPath||'').replace(/[<>&]/g,'')+'</b><small>'+(it.mediaType||'image')+'</small></div>';
        (function(item){ d.addEventListener('click',function(){
          var mp=item.mediaPath||''; var du=readDataUrl(mp); // readDataUrl: file:// normalize + Node fs → cep.fs
          if(du){ uploadFrame({path:mp,dataUrl:du},which); } else { toast('Could not read file','error'); }
          closeVgSheets();
        }); })(it);
        host.appendChild(d);
      });
      repositionVgSheet('vgProjSheet');
    }).catch(function(e){ if($('vgProjList'))$('vgProjList').innerHTML='<div class="axighint">Could not get project list: '+String(e)+'</div>'; repositionVgSheet('vgProjSheet'); });
  }
  function pickTlFrame(which){
    if(typeof csInterface==='undefined'||!csInterface){ toast('Timeline frame only works inside Premiere Pro','info'); closeVgSheets(); return; }
    closeVgSheets(); toast('Exporting frame…','info');
    // igScript bilan bir xil: async hostCall('exportTimelineFrame') → {path} (joriy kadr → PNG).
    hostCall('exportTimelineFrame').then(function(r){
      if(!r||!r.path){ toast('Could not get frame'+((r&&r.reason)?': '+r.reason:' — make sure a comp is open in the Timeline'),'warning'); return; }
      var du=readDataUrl(r.path); if(du){ uploadFrame({path:r.path,dataUrl:du},which); } else { toast('Could not read frame','error'); }
    }).catch(function(e){ toast('Frame export error: '+String(e),'error'); });
  }

  // Yagona manba-nishon: {kind:'frame',which} (kadr) yoki {kind:'media',type} (R2V referens)
  var _vgSrcTarget={kind:'frame',which:'start'};
  function openFrameSrc(which,anch){
    _vgSrcTarget={kind:'frame',which:which,anchor:anch||((which==='start')?$('vgStartBox'):$('vgEndBox'))};
    var t=$('vgSrcTitle'); if(t)t.textContent=(which==='start')?"Start frame":"End frame";
    var tl=$('vgSrcTl'); if(tl)tl.style.display=''; // kadr: Timeline doim bor (media yashirgan bo'lishi mumkin)
    var fs=$('vgSrcFile'); if(fs){var s=fs.querySelector('small'); if(s)s.textContent='image from computer';}
    var pr=$('vgSrcProj'); if(pr){var s2=pr.querySelector('small'); if(s2)s2.textContent='Premiere project footage';}
    openVgSheet('vgSrcSheet',_vgSrcTarget.anchor);
  }
  $('vgSrcFile').addEventListener('click',function(){ if(_vgSrcTarget.kind==='media')pickFileMedia(_vgSrcTarget.type); else pickFileFrame(_vgSrcTarget.which); });
  $('vgSrcProj').addEventListener('click',function(){ if(_vgSrcTarget.kind==='media')pickProjMedia(_vgSrcTarget.type); else pickProjFrame(_vgSrcTarget.which); });
  $('vgSrcTl').addEventListener('click',function(){ if(_vgSrcTarget.kind==='media'){ _vgSrcTarget.type==='image'?pickTlMedia():pickTlSource(_vgSrcTarget.type); } else pickTlFrame(_vgSrcTarget.which); });
  // #9 — My Library manbasi: gen natijasi joriy slotga (_vgSrcTarget) mos filtrlanadi va
  // MAVJUD biriktirish yo'llari bilan qo'shiladi: kadr → setFrameFromUrl, media → addExistingMediaRef
  // (video → openVgClipper — fayl yuklashdagi bilan bir xil kesish oqimi). Yangi upload YO'Q.
  $('vgSrcLib').addEventListener('click',function(){
    var target={kind:_vgSrcTarget.kind,type:_vgSrcTarget.type,which:_vgSrcTarget.which,anchor:_vgSrcTarget.anchor};
    var want=(target.kind==='media')?target.type:'image';
    openVgSheet('vgLibSheet',target.anchor);
    var t=$('vgLibTitle'); if(t)t.textContent='My Library — '+(want==='video'?'video':want==='audio'?'audio':'image');
    var host=$('vgLibList'); if(!host)return;
    host.innerHTML='<div class="axighint" style="flex:0 0 100%">Loading…</div>';
    if(!(window.afGallery&&window.afGallery.load)){ host.innerHTML='<div class="axighint" style="flex:0 0 100%">Library is unavailable</div>'; return; }
    window.afGallery.load().then(function(items){
      var list=(items||[]).filter(function(it){ return it.url && refTypeFromItem(it)===want; });
      if(!list.length){ host.innerHTML='<div class="axighint" style="flex:0 0 100%">No '+want+' generations yet — generate something first.</div>'; repositionVgSheet('vgLibSheet'); return; }
      host.innerHTML='';
      list.forEach(function(it){
        var d=document.createElement('div');
        var bg=(it.thumb&&want!=='audio')?('background:#0c0f14 url("'+String(it.thumb).replace(/"/g,'&quot;')+'") center/cover no-repeat'):'background:#0c0f14;display:flex;align-items:center;justify-content:center;color:#5b6472;font-size:10px';
        d.style.cssText='aspect-ratio:1/1;border-radius:8px;overflow:hidden;cursor:pointer;border-width:1px;border-style:solid;border-color:rgba(255,255,255,.08);'+bg;
        if(want==='audio'&&!it.thumb)d.textContent=(it.title||'Audio').slice(0,14);
        d.title=(it.title||'').slice(0,60);
        d.addEventListener('click',function(){
          if(target.kind==='frame'){ setFrameFromUrl(it.url,target.which); closeVgSheets(); return; }
          if(want==='video'){
            if(!mediaAllowed('video'))return;
            closeVgSheets();
            openVgClipper({srcUrl:it.url,title:(it.title||'').slice(0,60),sizeBytes:it.size||0})
              .catch(function(e){ toast((e&&e.message)||'Failed to open video reference','error'); });
            return;
          }
          if(addExistingMediaRef(it))closeVgSheets();
        });
        host.appendChild(d);
      });
      repositionVgSheet('vgLibSheet');
    }).catch(function(){ host.innerHTML='<div class="axighint" style="flex:0 0 100%">Couldn&#39;t load your library — try again</div>'; });
  });
  $('vgStartBox').addEventListener('click',function(){ if(!st.start)openFrameSrc('start'); });
  $('vgEndBox').addEventListener('click',function(){ if(!st.end)openFrameSrc('end'); });
  // SC_27 (web paritet): rasm ma'lumotini model turiga qarab joylash — media model → rasm referens;
  // frames model → bo'sh kadr slotiga (start, keyin end). Paste va drop ikkovi shu yo'ldan yuradi.
  function vgAcceptImageData(dataUrl,fromPath){
    var src=fromPath?{path:fromPath,dataUrl:dataUrl}:{dataUrl:dataUrl};
    if(vm.refKind==='media-refs'){ if(!mediaAllowed('image'))return; uploadMediaRef(src,'image'); toast('Image reference added','success'); return; }
    if(vm.framesOk){
      var which=(!st.start)?'start':((vm.endFrameOk&&!st.end)?'end':null);
      if(!which){ toast('Frames are already set — remove one first','info'); return; }
      uploadFrame(src,which); toast((which==='start'?'Start':'End')+' frame added','success'); return;
    }
    toast(((vm.model&&vm.model.label)||'This model')+" doesn't accept image references",'info');
  }
  // Copy-paste: clipboarddagi RASM → video referens/kadr (video tool ko'rinib turganda; matn odatdagidek yopishadi)
  document.addEventListener('paste',function(e){
    try{
      var vp=$('vgPrompt'); if(!vp||vp.offsetParent===null)return; // video tool ko'rinmasa — aralashmaymiz
      if(vm.refKind!=='media-refs'&&!vm.framesOk)return; // referenssiz model — qabul qilmaydi
      var items=(e.clipboardData&&e.clipboardData.items)||[];
      var img=null; for(var i=0;i<items.length;i++){ if(items[i].type&&items[i].type.indexOf('image/')===0){ img=items[i]; break; } }
      if(!img)return;
      e.preventDefault();
      var blob=img.getAsFile(); if(!blob)return;
      var rd=new FileReader();
      rd.onload=function(){ vgAcceptImageData(String(rd.result||'')); };
      rd.readAsDataURL(blob);
    }catch(_){}
  });
  // SC_27 (web paritet, P14 naqshi): OS fayl drop → video kompozer. Rasm → kadr/media-ref;
  // video/ovoz fayl (media model) → mavjud addOneMediaPath yo'li (klipper/limit tekshiruvlari bilan).
  (function(){
    var box=document.querySelector('#v-vidgen .axws-dock'); if(!box)return;
    box.addEventListener('dragover',function(e){ if(e.dataTransfer&&Array.prototype.indexOf.call(e.dataTransfer.types||[],'Files')>=0){ e.preventDefault(); box.classList.add('af-dropon'); } });
    box.addEventListener('dragleave',function(e){ if(!box.contains(e.relatedTarget))box.classList.remove('af-dropon'); });
    box.addEventListener('drop',function(e){
      if(!e.dataTransfer||!e.dataTransfer.files||!e.dataTransfer.files.length)return;
      e.preventDefault(); box.classList.remove('af-dropon');
      var files=Array.prototype.slice.call(e.dataTransfer.files);
      files.forEach(function(f){
        var name=f.name||f.path||'';
        var isI=/^image\//.test(f.type||'')||/\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
        var isV=/^video\//.test(f.type||'')||/\.(mp4|mov|webm|m4v)$/i.test(name);
        var isA=/^audio\//.test(f.type||'')||/\.(mp3|wav|m4a|aac|ogg)$/i.test(name);
        if(isI){
          if(f.path&&typeof readDataUrl==='function'){ var d=readDataUrl(f.path); if(d)vgAcceptImageData(d,f.path); else toast('Could not read '+name,'error'); }
          else { var rd=new FileReader(); rd.onload=function(){ vgAcceptImageData(String(rd.result||'')); }; rd.readAsDataURL(f); }
        } else if((isV||isA)&&vm.refKind==='media-refs'){
          var t=isV?'video':'audio';
          if(!f.path){ toast('Drop '+t+' files from Finder/Explorer to add them','info'); return; }
          if(!mediaAllowed(t))return;
          if(!extAllowed(t,f.path)){ toast(typeLabel(t)+' format is not compatible with this model','warning'); return; }
          addOneMediaPath(f.path,t);
        } else if(isV||isA){
          toast(((vm.model&&vm.model.label)||'This model')+" doesn't accept "+(isV?'video':'audio')+' references','info');
        } else {
          toast('Unsupported file type','warning');
        }
      });
    });
  })();
  // (prompt ichidagi ＋Referens tugmasi olib tashlandi — tepadagi kadr box / +Rasm/+Video kanonik)
  // FIX D: doimiy manba chiplari (vgChipFile/Proj/Tl) olib tashlandi — manba tanlash faqat
  // kadr box yoki ＋Referens popover menyusi (vgSrcSheet) orqali, rasm tool bilan bir xil.
  // PROBLEM 3: Fast|R2V toggle handler'lari (vgModelOfKind, #vgModeFast/#vgModeR2V) olib tashlandi.

  // ── enhance ──
  $('vgEnhance').addEventListener('click',function(){
    var ta=$('vgPrompt'); var txt=(ta&&ta.value||'').trim();
    if(!txt){ toast('Write a prompt first','warning'); return; }
    var enh=$('vgEnhance'); if(enh)enh.style.opacity='0.4';
    var imgRefs=mref.filter(function(r){ return r.type==='image'&&r.url; }).map(function(r){ return r.url; });
    // P28 (29a) — kadr (start/end) rasmlarini ham enhance KO'RSIN. Frames↔media-refs model bo'yicha
    // o'zaro istisno → mref bilan numbering to'qnashmaydi (kadr modelida mref bo'sh).
    if(st.end&&st.end.url)imgRefs.unshift(st.end.url);
    if(st.start&&st.start.url)imgRefs.unshift(st.start.url);
    var vidRefs=mref.filter(function(r){ return r.type==='video'&&r.url; }).map(function(r){ return r.url; });
    var audRefs=mref.filter(function(r){ return r.type==='audio'&&r.url; }).map(function(r){ return r.url; });
    var nref=imgRefs.length+vidRefs.length+audRefs.length;
    studioPost('/api/studio/gen/prompt/enhance',{
      prompt:txt,
      mode:'video',
      modelId:(vm.model&&vm.model.id)||null,
      image_urls:imgRefs,
      video_urls:vidRefs,
      audio_urls:audRefs,
      idempotencyKey:afUuid() // P17 — cold-start qayta urinish bitta consume
    }).then(function(r){
      if(r&&r.mentionMismatch){ if(r.creditsLeft!=null)setCreditChip(r.creditsLeft); toast('Kept your prompt — the rewrite pointed a reference at the wrong clip','info'); }
      else if(r&&r.prompt){ ta.value=(typeof afCleanEnhancedPrompt==='function')?afCleanEnhancedPrompt(r.prompt):r.prompt; if(r.creditsLeft!=null)setCreditChip(r.creditsLeft); toast('Prompt enhanced ✨'+(nref?(' · saw '+nref+' reference'+(nref>1?'s':'')):'')+(r&&r.creditsCharged?(' · ✦'+r.creditsCharged):''),'success'); }
      else toast('Could not enhance','warning');
    }).catch(function(e){ toast((typeof friendlyError==='function'?friendlyError(e):(e&&e.message))||'Enhance error','error');
    }).then(function(){ if(enh)enh.style.opacity=''; },function(){ if(enh)enh.style.opacity=''; });
  });

  // ── polling (video uzoq — backend fal/OpenRouter + Render cold-start bilan 10 daqiqadan oshishi mumkin) ──
  var activeJobs=[]; var jobSeq=0; var MAX_VG_JOBS=3; // bir vaqtda 3 ta video gen (avval 1 edi)
  // Oldingi limit ~10.5 daqiqa edi va R2V ba'zan undan oshib ketardi → plagin erta "taslim" bo'lardi.
  // Endi ~38-40 daqiqagacha yumshoq kuzatamiz: tez-tez → keyin siyrakroq.
  var VG_POLL_CAP=420;
  function vgPollDelay(t){ return t<10?3000:(t<80?4000:6000); }

  // YUQORI progress endi ishlatilmaydi — gen holati pastdagi So'nggi grid kartasida (0-100%).
  function renderVgJobs(){ var el=$('vgProg'); if(el){ el.classList.remove('on'); el.innerHTML=''; } }
  function removeVgJob(j){ var i=activeJobs.indexOf(j); if(i>=0)activeJobs.splice(i,1); if(j.jobId&&window.afJobStore)window.afJobStore.remove(j.jobId); if(j.progTimer){clearInterval(j.progTimer);j.progTimer=null;} if(j.pollTimer){clearTimeout(j.pollTimer);j.pollTimer=null;} if(j.pit){var pi=vgRcState.items.indexOf(j.pit); if(pi>=0)vgRcState.items.splice(pi,1); j.pit=null;} renderVgRecent(); refreshVgBtn(); }
  function startVgProg(j){ j.t0=Date.now(); j.progTimer=setInterval(function(){ var el=(Date.now()-j.t0)/1000; var pct=Math.min(97,Math.round(97*(1-Math.exp(-el/90)))); if(j.pit){ j.pit.progress=pct; if(window.afRecent)window.afRecent.updatePending($('vgRecent'),j.seq,pct); } },700); }

  /** #100 (PX2) — video gen'ni HAQIQIY bekor qilish (imggen cancelJob bilan bir xil qoida:
   *  navbatdagi job → refund; provayder boshlagan bo'lsa faqat kutish to'xtaydi). */
  function cancelVgJob(j){
    j.cancelled=true; removeVgJob(j);
    if(!j.submitted||!j.jobId){ toast('Canceled — no credits charged','info'); return; }
    studioPost('/api/studio/gen/'+j.jobId+'/cancel',{}).then(function(r){
      if(r&&typeof r.creditsLeft==='number')setCreditChip(r.creditsLeft); else setCreditChip(credits());
      toast('Cancelled'+(r&&r.refunded?(' — ✦'+r.refunded+' refunded'):' — no credits charged'),'success');
    }).catch(function(err){
      if(err&&err.code==='GENERATION_DISPATCHED')toast('Already started at the provider — stopped waiting; it will appear in History','warning');
      else if(err&&err.code==='GENERATION_FINISHED')toast('It already finished — check History🕘','info');
      else toast('Continuing in the background — result will appear in History','info');
    });
  }
  /** #31 (PX1) — panel qayta ochilganda UCHAYOTGAN video gen'larni tiklaydi (imggen bilan bir xil naqsh). */
  var vgRestoreTried=false;
  function restoreVgJobs(){
    if(vgRestoreTried)return; vgRestoreTried=true;
    var saved={}; try{ (window.afJobStore?window.afJobStore.list('vidgen'):[]).forEach(function(r){ saved[r.jobId]=r; }); }catch(_){}
    studioGet('/api/studio/gen/history?status=active&limit=10&mode=video').then(function(d){
      var items=(d&&d.items)||[]; var live={},added=0;
      items.forEach(function(gn){
        if(!gn||!gn.id)return; live[gn.id]=1;
        if(activeJobs.some(function(x){ return x.jobId===gn.id; }))return;
        var rec=saved[gn.id]||{};
        var j={seq:++jobSeq,jobId:gn.id,prompt:(gn.prompt||rec.prompt||''),
               jcost:(typeof gn.cost==='number'?gn.cost:(rec.cost||0)),cancelled:false,submitted:true,
               pollTimer:null,progTimer:null,t0:Date.now(),sid:gn.sessionId||rec.sid||null,
               params:gn.params||rec.params||null,modelId:gn.modelId||rec.modelId||null,
               modelLabel:(vm.model&&vm.model.label)||'Video model'};
        activeJobs.push(j); added++;
        if(!j.sid||j.sid===vm.sessionId){ j.pit={seq:j.seq,pending:true,prompt:(j.prompt||'Video'),cat:'video',progress:2,job:j}; vgRcState.items.unshift(j.pit); }
        startVgProg(j);
        var ct=Date.parse(gn.createdAt||''); if(ct)j.t0=ct;
        pollVgJob(j,0);
      });
      Object.keys(saved).forEach(function(id){ if(!live[id]&&window.afJobStore)window.afJobStore.remove(id); });
      if(added){ renderVgRecent(); refreshVgBtn(); }
    }).catch(function(){ vgRestoreTried=false; });
  }
  function pollVgJob(j,tries){
    if(j.cancelled)return;
    if(tries>VG_POLL_CAP){
      removeVgJob(j);
      toast('The video may still be processing on the server — check History later','warning');
      return;
    }
    studioGet('/api/studio/gen/'+j.jobId).then(function(gn){
      if(j.cancelled)return;
      var s=(gn&&gn.status)||'';
      if(s==='done'){
        if(j.pit&&window.afRecent)window.afRecent.updatePending($('vgRecent'),j.seq,100);
        setTimeout(function(){
          var a0=((gn&&gn.assets)||[])[0]||{};
          // P30 (29c) — status=done LEKIN natija yo'q = provayder kontent rad etdi (success-shaklda).
          // "Done! charged" ✓ EMAS: kredit qaytariladi; halol xato + boshqa-model taklifi.
          if(!a0.url){
            removeVgJob(j); setCreditChip(credits());
            if(!handleGenRejection(gn, function(id){ var m=(vm.models||[]).filter(function(x){return x.id===id;})[0]; if(m&&typeof switchVgModel==='function')switchVgModel(m); }))
              toast((gn&&gn.error&&typeof friendlyError==='function')?friendlyError({message:gn.error}):'No video was returned — your credits were refunded','error');
            return;
          }
          var sameSess=!j.sid||vm.sessionId===j.sid; // SC_29: sessiya almashgan bo'lsa natija BOSHQA sessiya feed'iga kirmaydi
          if(!sameSess)j.pit=null;
          if(j.pit&&a0.url){ // pending kartani O'SHA JOYDA natijaga aylantiramiz
            j.pit.pending=false; j.pit.url=a0.url; j.pit.thumb=a0.thumbUrl||null; j.pit.id=(gn&&gn.id)||j.jobId||null; j.pit.cat='video';
            // Qayta gen: yangi tugagan kartada ham params/modelId bo'lsin (aks holda restore faqat prompt tiklaydi — bug fix)
            j.pit.params=(gn&&gn.params)||j.params||null; j.pit.modelId=(gn&&gn.modelId)||j.modelId||null;
            j.pit=null;
          }
          if(sameSess)showVgResult((gn&&gn.assets)||[],j); // url dedup: unshift skip, faqat player + render
          var i=activeJobs.indexOf(j); if(i>=0)activeJobs.splice(i,1);
          if(j.jobId&&window.afJobStore)window.afJobStore.remove(j.jobId); // #31: tugadi — reyestrdan chiqadi
          if(j.progTimer){clearInterval(j.progTimer);j.progTimer=null;}
          if(j.pollTimer){clearTimeout(j.pollTimer);j.pollTimer=null;}
          renderVgRecent(); refreshVgBtn(); setCreditChip(credits());
          if(typeof window.afGenDoneNotify==='function')window.afGenDoneNotify('vidgen',j.jcost,(a0&&(a0.thumbUrl||null))||null,j.sid||null); // SC_21
          else toast('Done! ✦'+j.jcost+' charged','success');
          if(window.axSPInvalidate)window.axSPInvalidate(); // SC_29: picker sanoqlari yangilansin
        },200);
      } else if(s==='failed'){
        removeVgJob(j); setCreditChip(credits());
        // P30 §3+§4 — kontent rad etilishi: halol xato + ✦N qaytarildi + boshqa-model taklifi.
        if(!handleGenRejection(gn, function(id){ var m=(vm.models||[]).filter(function(x){return x.id===id;})[0]; if(m&&typeof switchVgModel==='function')switchVgModel(m); }))
          toast((gn&&gn.error&&typeof friendlyError==='function')?friendlyError({message:gn.error}):((gn&&gn.error)||'Video failed — credits refunded'),'error');
      } else {
        j.pollTimer=setTimeout(function(){ pollVgJob(j,tries+1); },vgPollDelay(tries));
      }
    }).catch(function(){ if(j.cancelled)return; j.pollTimer=setTimeout(function(){ pollVgJob(j,tries+1); },vgPollDelay(tries)); });
  }

  function showVgResult(assets,j){
    var a0=(assets&&assets[0])||{};
    var url=a0.url||null;
    if(!url){ toast('Empty result','warning'); return; }
    try{ if(!vgRcState.items.some(function(x){return x.url===url;})){
      vgRcState.items.unshift({
        id:(j&&j.jobId)||null,
        url:url,
        downloadUrl:(a0&&a0.downloadUrl)||null,
        thumb:null,
        title:(j&&j.prompt)||'Video',
        cat:'video',
        sizeBytes:(a0&&a0.sizeBytes)||0,
        sourceDurationSec:(j&&j.sourceDurationSec)||0,
        sourceResolution:(j&&j.sourceResolution)||''
      });
      vgRcState.items=vgRcState.items.slice(0,12);} renderVgRecent(); }catch(_){}
    var res=$('vgRes'); if(res)res.style.display='';
    var vid=$('vgVideo'); if(vid){ vid.src=url; vid.load(); }
    var acts=$('vgActs'); if(!acts)return; acts.innerHTML='';
    var btnImp=document.createElement('div'); btnImp.className='vact';
    btnImp.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Premiere import';
    btnImp.addEventListener('click',function(){ if(typeof aiImportMedia==='function')aiImportMedia(url,'video','mp4'); else toast('Only works inside Premiere Pro','info'); });
    acts.appendChild(btnImp);
    if(!IS_CEP){
      var btnDl=document.createElement('div'); btnDl.className='vact';
      btnDl.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Download';
      btnDl.addEventListener('click',function(){ try{ var a=document.createElement('a'); a.href=a0.downloadUrl||url; a.download=window.afGenDlName((j&&j.prompt)||'',url,'video'); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} });
      acts.appendChild(btnDl);
    }
  }

  // ── So'nggi grid (2-ustun; HAMMA tur: rasm/video/ovoz; to'g'ri badge; hover Import/Referens/⬇/✕; ☑ batch; lightbox) ──
  var VG_RC_X='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var VG_RC_CHK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var VG_RC_IMP='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var VG_RC_REF='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8a9 9 0 1 0 2.6-5.7L3 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var VG_RC_DL='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var VG_IC_AUD='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var vgRcState={items:[],sel:{},selecting:false,loaded:false,loading:false,error:'',audCount:0,sessTotal:null}; // SC_29: faol sessiya sanoqlari
  function catLabel(c){ return c==='video'?'Video':(c==='audio')?'Voice':(c==='sfx')?'SFX':'Image'; }
  function urlExt(u){ var m=String(u||'').match(/\.(\w{2,5})(?:\?|#|$)/); return m?m[1].toLowerCase():''; }
  function vgImport(it){
    if(typeof aiImportMedia!=='function'){ toast('Premiere import only works inside Premiere Pro','info'); return; }
    var cat=it.cat||'image';
    var kind=cat==='video'?'video':(cat==='audio'||cat==='sfx')?'audio':'image';
    aiImportMedia(it.url,kind,urlExt(it.url)||null);
  }
  function vgDownload(it){
    if(IS_CEP){ toast('Download — import into the Premiere Project panel instead','info'); return; }
    try{ var a=document.createElement('a'); a.href=it.downloadUrl||it.url; a.download=window.afGenDlName(it.prompt||it.title,it.url,it.cat); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){}
  }

  // So'nggi-grid ctx — umumiy afRecent.card/openLightbox shundan foydalanadi (model-aware Referens shu yerda).
  function vgRecentCtx(){ return {
    isCEP: IS_CEP,
    list: function(){ return vgRcState.items.filter(function(x){ return x&&x.url&&!x.pending; }); }, // b10: lightbox prev/next
    selecting: function(){ return vgRcState.selecting; },
    isSelected: function(it){ return !!(it.id&&vgRcState.sel[it.id]); },
    onToggleSelect: function(it,d){ if(!it.id){ toast('This result is still being saved','info'); return; } if(vgRcState.sel[it.id])delete vgRcState.sel[it.id]; else vgRcState.sel[it.id]=it; d.classList.toggle('sel',!!vgRcState.sel[it.id]); updVgRcBatch(); },
    onImport: function(it){ vgImport(it); },
    onAddProject:function(it){ if(window.afProjectPicker)window.afProjectPicker('gen',it.id); }, // P1
    onAddExplore:function(it){ window.afAddToExplore(it); }, // P3 (step 34)
    onDownload: function(it){ vgDownload(it); },
    onDelete: function(it){ vgRcDelete(it); },
    refAllowed: function(it){ return vgRefAllowed(it); },
    onRef: function(it){ vgUseAsRef(it); },
    // SC_17: onUpscale olib tashlandi
    onRestore: function(it){ vgRestoreGen(it); }
  }; }
  // "Qayta gen" — ASL MODELga avtomatik o'tib, o'sha gen'ning prompti + referenslari composer'ga
  // QAYTIB chiqadi (foydalanuvchi xohlasa tahrirlab yana yuboradi).
  function vgRestoreGen(it){
    if(!it||!it.prompt){ toast('No prompt saved for this result','info'); return; }
    // Rasm gen → RASM TOOLga o'tib o'sha yerda tiklanadi (asl model rasm modeli — cross-tool).
    if((it.cat||'video')!=='video'){
      if(it.cat==='image'&&typeof window.afIgRestoreGen==='function'&&typeof window.axGo==='function'){
        window.axGo('imggen');
        setTimeout(function(){ window.afIgRestoreGen(it); },60);
        return;
      }
      var ta0=$('vgPrompt'); if(ta0){ ta0.value=it.prompt; try{ ta0.dispatchEvent(new Event('input')); }catch(_){ } }
      refreshVgBtn();
      toast('Prompt restored (this is a voice/SFX gen — its references don\'t apply to the video tool)','info');
      return;
    }
    var doRestore=function(){
      var p=it.params||{}; var restored=0, skippedRef=0;
      // restore = holatni ALMASHTIRISH: joriy kadr/referenslar tozalanadi (limit/duplikat to'siq bo'lmasin)
      if(mref.length){ var toks=mref.map(function(r){return r&&r.token;}).filter(Boolean); mref=[]; stripPromptTokens(toks); hideVgMention(); renderMediaRefs(); updRefMeta(); }
      clearFrameState();
      // AVVAL referenslar (addExistingMediaRef promptga token yozadi), KEYIN prompt ustidan
      // asl matn yoziladi — asl @img/@video tokenlari takrorlanmaydi va tartib mos qoladi.
      if(vm.refKind==='frames'){
        if(p.referenceUrl){ setFrameFromUrl(String(p.referenceUrl),'start'); restored++; }
        if(p.referenceEndUrl){ setFrameFromUrl(String(p.referenceEndUrl),'end'); restored++; }
      } else if(vm.refKind==='media-refs'){
        var addList=function(arr,cat){ (Array.isArray(arr)?arr:[]).forEach(function(u){
          if(typeof u!=='string'||!u)return;
          if(addExistingMediaRef({cat:cat,url:u}))restored++; else skippedRef++;
        }); };
        addList(p.imageUrls,'image'); addList(p.videoUrls,'video'); addList(p.audioUrls,'audio');
        addList(p.referenceUrls,'image'); // rasm-gen (ig) natijasini video toolда tiklash — uning ref'lari rasm
        if(p.referenceUrl&&!(Array.isArray(p.imageUrls)&&p.imageUrls.length)&&!(Array.isArray(p.referenceUrls)&&p.referenceUrls.length)){ if(addExistingMediaRef({cat:'image',url:String(p.referenceUrl)}))restored++; }
      } else {
        var hadRefs=!!(p.referenceUrl||p.referenceEndUrl||(Array.isArray(p.imageUrls)&&p.imageUrls.length)||(Array.isArray(p.videoUrls)&&p.videoUrls.length));
        if(hadRefs)skippedRef++;
      }
      var ta=$('vgPrompt'); if(ta){ ta.value=it.prompt; try{ ta.dispatchEvent(new Event('input')); }catch(_){} }
      refreshVgBtn();
      var host=$('vgPrompt'); if(host&&host.scrollIntoView)try{ host.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_){ }
      if(host)try{ host.focus(); }catch(_){ }
      toast('Prompt restored'+(restored?(' · '+restored+' reference(s) reconnected'):'')+(skippedRef?(' · '+skippedRef+' reference(s) skipped (duplicate, limit, or incompatible)'):''),'success');
    };
    // ASL modelga o'tish — gen qaysi modelda qilingan bo'lsa restore ham o'sha modelda (referens UI mos bo'ladi).
    var tgt=(it.modelId!=null)?String(it.modelId):null;
    ensureVgMeta().then(function(){
      if(tgt&&vm.model&&String(vm.model.id)!==tgt){
        var m=(vm.models||[]).filter(function(x){return String(x.id)===tgt;})[0];
        if(m){ vgSilentSwitchModel(m); toast((m.label||'Model')+' — switched to the original generation model','info'); }
        else toast('Original model is not available right now — restoring on the current model','info');
      }
      doRestore();
    }).catch(function(){ doRestore(); });
  }
  window.afVgRestoreGen=vgRestoreGen; // cross-tool: rasm tool video genini shu yerga uzatadi
  function openVgLightbox(it){ window.afRecent.openLightbox(it, vgRecentCtx()); } // UMUMIY lightbox
  function closeVgLightbox(){ if(window.afRecent)window.afRecent.closeLightbox(); }

  // ── Referens model-aware: joriy model refKind'iga qarab karta turi mosmi? ──
  function vgRefAllowed(it){
    var rk=vm.refKind||'frames'; var cat=it.cat||'image';
    if(rk==='frames')return cat==='image';      // i2v: faqat RASM → Boshlang'ich/Yakuniy kadr
    if(rk==='media-refs'){ var t=refTypeFromItem(it); return !!(vm.mediaRefs&&vm.mediaRefs[t]>0); } // FIX3: tur limiti 0 → Referens tugmasi yo'q
    if(rk==='imagevideo')return cat==='image'||cat==='video';
    if(rk==='video')return cat==='video';
    if(rk==='image')return cat==='image';        // (video toolда ref-strip yo'q — amalda 'frames' ishlaydi)
    return false;                                // 'none' → Referens yo'q
  }
  var _pendingRefUrl=null;
  function vgUseAsRef(it){
    var rk=vm.refKind||'frames';
    if(rk==='frames'){ // RASM → qaysi kadr slotiga? menyu (Boshlang'ich / Yakuniy)
      _pendingRefUrl=it.url; openVgSheet('vgRefSlotSheet'); return;
    }
    if(rk==='media-refs'){
      // VIDEO natija → ham KESISH dialogi (fayl yuklashdagi kabi): foydalanuvchi qaysi qismni
      // ishlatishni tanlaydi, server bucket'dan olib kesadi (srcUrl rejimi).
      if(refTypeFromItem(it)==='video'){
        if(!mediaAllowed('video'))return;
        openVgClipper({srcUrl:it.url,title:(it.title||'').slice(0,60),sizeBytes:it.sizeBytes||0})
          .catch(function(e){ toast((e&&e.message)||'Failed to open video reference','error'); });
        return;
      }
      addExistingMediaRef(it); return;
    }
    // (kelajak refKind'lar uchun joy)
    toast('This model does not support references','info');
  }
  function setFrameFromUrl(url,which){
    if(!url)return;
    if(which==='end'&&!vm.endFrameOk){ toast('This model does not support an end frame','warning'); return; } // FIX3
    var f={dataUrl:url,url:url,loading:false}; // gen natijasi allaqachon R2 URL → qayta upload shart emas
    if(which==='start')st.start=f; else st.end=f;
    renderFrameBoxes(); refreshVgBtn();
    toast('Added as the '+(which==='start'?"start":"end")+' frame','success');
  }

  function updVgRcBatch(){ var b=$('vgRecentBatch'); if(!b)return; b.classList.toggle('on',vgRcState.selecting); var bi=$('vgRecentBI'); if(bi)bi.textContent=Object.keys(vgRcState.sel).length+' selected'; }

  function preflightMsg(d){
    if(!d)return 'Prompt failed the safety check';
    var msg=(d.reason||d.error||'Prompt failed the safety check');
    var tips=(d.suggestions||[]).slice(0,2);
    if(tips.length)msg+=' · '+tips.join(' ');
    return msg;
  }

  function renderVgRecent(){
    var r=$('vgRecent'); if(!r)return; r.innerHTML='';
    r.className='recentgrid'+(vgRcState.selecting?' selmode':'');
    var pend=[],seen={},uniq=[];
    vgRcState.items.forEach(function(it){ if(it&&it.pending){ pend.push(it); } else if(it&&it.url&&!seen[it.url]){seen[it.url]=1;uniq.push(it);} });
    vgRcState.items=pend.concat(uniq);
    // SC_41 PART B: bo'sh sessiya feed maydonida HECH NARSA — "No generations yet" hero o'chirildi.
    var _vrs=$('vgRecentSect');
    (window.__axwsLoading=window.__axwsLoading||{}).vidgen=((vgRcState.loading||!vgRcState.loaded)&&!uniq.length&&!vgRcState.error); // SC_46: header "loading…" (0 flash emas)
    if(!pend.length){
      // SC_46: uch holatli mashina — ERROR → Retry; LOADING/hali-yuklanmagan → skeleton; READY-EMPTY → hech narsa.
      if(vgRcState.error&&!uniq.length){ if(_vrs)_vrs.style.display=''; r.innerHTML='<div class="empt"><b>Failed to load recent</b>'+String(vgRcState.error||'Check your internet or session.')+'<br><div role="button" tabindex="0" type="button" onclick="retryVgRecent()">↻ Retry</div></div>'; updVgRcBatch(); return; }
      if((vgRcState.loading||!vgRcState.loaded)&&!uniq.length){ if(_vrs)_vrs.style.display=''; r.innerHTML=afRecentSkel(); updVgRcBatch(); return; }
      if(!uniq.length){ if(_vrs)_vrs.style.display='none'; r.innerHTML=''; updVgRcBatch(); return; }
    }
    if(_vrs)_vrs.style.display='';
    var ctx=vgRecentCtx(); var pctx={ onCancel:function(it){ if(it.job)cancelVgJob(it.job); } }; // #100 (PX2): haqiqiy bekor qilish
    pend.forEach(function(it){ r.appendChild(window.afRecent.pendingCard(it,pctx)); }); // gen ishlamoqda
    uniq.slice(0,12).forEach(function(it){ r.appendChild(window.afRecent.card(it,ctx)); }); // UMUMIY natija karta
    updVgRcBatch();
  }
  function vgRcDelete(it){
    if(!it.id){ toast('This result cannot be deleted yet','info'); return; }
    window.afConfirm('Delete this? This cannot be undone.',{ok:"Delete",danger:true}).then(function(ok){
      if(!ok)return;
      studioDelete('/api/studio/gen/'+it.id).then(function(){
        vgRcState.items=vgRcState.items.filter(function(x){return !(x.id===it.id||x.url===it.url);}); delete vgRcState.sel[it.id];
        renderVgRecent(); toast('Deleted','success');
      }).catch(function(err){ toast((err&&err.message)||'Delete failed','error'); });
    });
  }
  function vgRcBatchDelete(){
    var items=Object.keys(vgRcState.sel).map(function(k){return vgRcState.sel[k];}).filter(function(x){return x&&x.id;});
    if(!items.length){ toast('Select something first','warning'); return; }
    window.afConfirm('Delete '+items.length+' result(s)? This cannot be undone.',{ok:"Delete",danger:true}).then(function(ok){
      if(!ok)return;
      var done=0,fail=0,total=items.length;
      items.forEach(function(it){ studioDelete('/api/studio/gen/'+it.id).then(function(){
        done++; vgRcState.items=vgRcState.items.filter(function(x){return !(x.id===it.id||x.url===it.url);}); delete vgRcState.sel[it.id];
      }).catch(function(){ fail++; }).then(function(){
        if(done+fail===total){ vgRcState.selecting=false; vgRcState.sel={}; renderVgRecent(); toast(done+' deleted'+(fail?(' · '+fail+' failed'):''),fail?'warning':'success'); }
      }); });
    });
  }
  function genCat(mode){ return mode==='video'?'video':(mode==='voice'||mode==='music')?'audio':mode==='sfx'?'sfx':'image'; }
  function loadVgRecent(force){
    if(vgRcState.loading||!$('vgRecent'))return;
    if(vgRcState.loaded&&!force&&(Date.now()-(vgRcState.loadedAt||0)<25*60*1000))return; // 25 daq — signed URL eskirmasin (#8)
    // SC_29: feed FAQAT faol sessiya bilan chegaralangan (global /gen/history EMAS).
    // Sessiya yo'q (yangi sessiya) → bo'sh feed, so'rov yuborilmaydi.
    if(!vm.sessionId){ vgRcState.loaded=true; vgRcState.loading=false; vgRcState.loadedAt=Date.now(); vgRcState.error=''; vgRcState.sessTotal=0; vgRcState.audCount=0; renderVgRecent(); return; }
    var sid=vm.sessionId;
    vgRcState.loading=true; vgRcState.error='';
    if(force)vgRcState.loaded=false;
    renderVgRecent();
    studioGet('/api/studio/gen/sessions/'+encodeURIComponent(sid)+'/generations?perPage=12&status=done').then(function(d){
      if(sid!==vm.sessionId){ vgRcState.loading=false; return; } // sessiya almashdi — eskirgan javob tashlanadi
      var aud=0;
      ((d&&d.items)||[]).forEach(function(g){
        var a=(g.assets&&g.assets[0])||{}; var url=a.url; if(!url)return;
        var cat=genCat(g.mode);
        if(cat==='audio'||cat==='sfx'){ aud++; return; } // SC_29: Visuals feed'ida audio karta chiqmaydi
        var ex=null; vgRcState.items.some(function(x){ if(x.id===g.id||x.url===url){ex=x;return true;} return false;});
        if(ex){ ex.url=url; if(cat==='image')ex.thumb=a.thumbUrl||url; return; } // yangi imzolangan URL
        vgRcState.items.push({
            id:g.id,
            url:url,
            downloadUrl:a.downloadUrl||null,
            thumb:(cat==='image'?(a.thumbUrl||url):null),
            title:(g.prompt||'').trim()||catLabel(cat),
            prompt:(g.prompt||'').trim(),      // Qayta gen: to'liq prompt tiklash uchun
            params:g.params||null,             // Qayta gen: referens URL'lari shu yerda
            modelId:g.modelId||null,           // Qayta gen: asl modelga avtomatik o'tish uchun
            cat:cat,
            sizeBytes:(a&&a.sizeBytes)||0,
            sourceDurationSec:(g&&g.params&&g.params.duration&&String(g.params.duration)!=='auto')?(Number(g.params.duration)||0):0,
            sourceResolution:(g&&g.params&&g.params.resolution)?String(g.params.resolution):'',
            cost:(typeof g.cost==='number'?g.cost:null),          // b10: lightbox meta chip
            createdAt:g.createdAt||null
          });
      });
      vgRcState.items=vgRcState.items.slice(0,12);
      vgRcState.audCount=aud; vgRcState.sessTotal=(d&&typeof d.total==='number')?d.total:null;
      vgRcState.loaded=true; vgRcState.loading=false; vgRcState.error=''; vgRcState.loadedAt=Date.now();
      renderVgRecent();
    }).catch(function(err){
      vgRcState.loaded=false; vgRcState.loading=false;
      vgRcState.error=(err&&err.message)?String(err.message):'Check your internet or session.';
      renderVgRecent();
    });
  }
  window.retryVgRecent=function(){ loadVgRecent(true); };
  // P25 — logout/boshqa hisob login: eski foydalanuvchining video-gen tarixi grid'da qolib ketmasin
  window.axVGClearRecent=function(){ vgRcState.items=[]; vgRcState.loaded=false; vgRcState.loadedAt=0; vgRcState.error=''; renderVgRecent(); };
  // #22: header ↻ — So'nggi genlar + kredit chip qo'lda yangilash
  var vgRefr=$('vgRefreshBtn'); if(vgRefr)vgRefr.addEventListener('click',function(){ setCreditChip(credits()); window.retryVgRecent(); toast('Refreshing…','info'); });
  // lightbox
  // (eski #vgLightbox wiring olib tashlandi — umumiy afRecent #afLightbox o'z close/Esc/backdrop'ini boshqaradi)
  // Referens kadr slot menyusi (Boshlang'ich / Yakuniy)
  (function(){
    var s=$('vgRefStart'); if(s)s.addEventListener('click',function(){ var u=_pendingRefUrl; _pendingRefUrl=null; closeVgSheets(); setFrameFromUrl(u,'start'); });
    var e=$('vgRefEnd'); if(e)e.addEventListener('click',function(){ var u=_pendingRefUrl; _pendingRefUrl=null; closeVgSheets(); setFrameFromUrl(u,'end'); });
  })();
  // So'nggi select/batch/more
  (function(){
    var sel=$('vgRecentSel'); if(sel)sel.addEventListener('click',function(){ vgRcState.selecting=!vgRcState.selecting; vgRcState.sel={}; sel.classList.toggle('on',vgRcState.selecting); renderVgRecent(); });
    var del=$('vgRecentDel'); if(del)del.addEventListener('click',vgRcBatchDelete);
    var can=$('vgRecentCancel'); if(can)can.addEventListener('click',function(){ vgRcState.selecting=false; vgRcState.sel={}; var sel2=$('vgRecentSel'); if(sel2)sel2.classList.remove('on'); renderVgRecent(); });
    var more=$('vgMoreVid'); if(more)more.addEventListener('click',function(){ closeVgSheets(); if(typeof window.axGo==='function')window.axGo('history'); });
  })();

  // ── gen tugmasi ──
  function genVgClick(){
    if(activeJobs.length>=MAX_VG_JOBS){ toast('Max '+MAX_VG_JOBS+' active video gens — wait for one to finish','info'); return; }
    var prompt=vgPromptValue();
    var params;
    if(vm.refKind==='media-refs'){
      // R2V — referens IXTIYORIY, prompt majburiy. image/video/audio alohida ro'yxat (faqat yuklangan URL'lar).
      if(prompt.length<2){ toast('Write a prompt','warning'); return; }
      if(mref.some(function(r){return r.loading;})){ toast('Reference is uploading — please wait','info'); return; }
      // P13 — FAQAT faol (limit ichidagi) mref yuboriladi; xira (limitdan tashqari) hovuzda qoladi
      var vgFlags=vgActiveFlags();
      var pick=function(t){ return mref.filter(function(r,i){return r.type===t&&r.url&&vgFlags.active[i];}).map(function(r){return r.url;}); };
      var savedIds=mref.filter(function(r,i){ return !!(r&&r.savedRefId)&&vgFlags.active[i]; }).map(function(r){ return r.savedRefId; });
      var auds=pick('audio'), imgs=pick('image'), vids=pick('video');
      if(auds.length&&imgs.length+vids.length===0&&!(vm.framesOk&&st.start&&st.start.url)){ toast('Audio needs at least 1 image or video reference','warning'); return; }
      // SC_27: payload aniqligi — bo'sh massivlar YUBORILMAYDI (model faqat o'zi qabul qiladigan maydonlarni oladi)
      params={resolution:vm.res,duration:vm.dur,aspectRatio:vgAspectParam()};
      if(imgs.length)params.imageUrls=imgs;
      if(vids.length)params.videoUrls=vids;
      if(auds.length)params.audioUrls=auds;
      if(savedIds.length)params.savedReferenceIds=savedIds;
      // BATCH5 #5: kadr qo'llaydigan media model (Seedance 2.0) — start/end kadr referenslar BILAN birga
      if(vm.framesOk){
        if((st.start&&st.start.loading)||(st.end&&st.end.loading)){ toast('Frame is uploading — please wait','info'); return; }
        if(vm.endFrameOk&&st.end&&st.end.url&&!(st.start&&st.start.url)){ toast("End frame only works together with a start frame — add a start frame too",'warning'); return; }
        if(st.start&&st.start.url){ params.referenceUrl=st.start.url; if(vm.endFrameOk&&st.end&&st.end.url)params.referenceEndUrl=st.end.url; }
      }
    } else if(vm.refKind==='none'){
      if(prompt.length<2){ toast('Write a prompt','warning'); return; }
      params={resolution:vm.res,duration:vm.dur,aspectRatio:vgAspectParam()};
    } else {
      // frames: image-to-video (Seedance) → boshlang'ich kadr majburiy; matndan-video (Veo/Omni) → IXTIYORIY
      if(prompt.length<2){ toast('Write a prompt','warning'); return; }
      if(vm.startRequired&&(!st.start||!st.start.url)){ toast("Add a start frame",'warning'); return; }
      if(st.start&&st.start.loading){ toast('Frame is uploading — please wait','info'); return; }
      if(st.end&&st.end.loading){ toast('Frame is uploading — please wait','info'); return; }
      // Yakuniy kadr FAQAT boshlang'ich kadr bilan (Veo lastFrame i2v-only) — aks holda backend uni tashlab yuborardi
      if(vm.endFrameOk&&st.end&&st.end.url&&!(st.start&&st.start.url)){ toast("End frame only works together with a start frame — add a start frame too",'warning'); return; }
      // FIX3: end kadr FAQAT model endFrame qo'llasa yuboriladi (stale ref himoyasi)
      // SC_27: null qiymatlar yuborilmaydi (payload aniqligi)
      params={resolution:vm.res,duration:vm.dur,aspectRatio:vgAspectParam()};
      if(st.start&&st.start.url){ params.referenceUrl=st.start.url; if(vm.endFrameOk&&st.end&&st.end.url)params.referenceEndUrl=st.end.url; }
    }
    // SC_27: audio FAQAT model toggle'ni qo'llasa yuboriladi (web buildParams bilan bir xil):
    // audio:false modellar (Veo Lite/Fast) va qulflangan modellar (Omni) uchun server default'i ustun.
    if(vm.audioSupported&&!vm.audioLocked)params.audio=!!vm.audio;
    if(vm.model&&vm.model.videoSettings&&vm.model.videoSettings.bitrate)params.bitrateMode=vm.bitrate;
    var c=credits(); if(c!=null&&c<cost()){ toast('Not enough credits — ⚙ Settings › "Top up credits"','error'); return; }
    var j={seq:++jobSeq,jobId:null,prompt:prompt,jcost:cost(),cancelled:false,submitted:false,pollTimer:null,progTimer:null,t0:Date.now(),sourceDurationSec:durSec(),sourceResolution:vm.res,modelLabel:(vm.model&&vm.model.label)||'Video model',
           params:params,modelId:(vm.model&&vm.model.id)||null}; // Qayta gen: yangi kartada ham params/model bo'lsin
    activeJobs.push(j);
    // GEN ishlamoqda kartasi — pastdagi So'nggi grid tepasiga (0-100% shkala), yuqorida emas
    j.pit={seq:j.seq,pending:true,prompt:(prompt||'Video'),cat:'video',progress:2,job:j};
    vgRcState.items.unshift(j.pit); renderVgRecent(); refreshVgBtn();
    var _vgb=$('vgGen'); if(_vgb)_vgb.classList.add('busy'); // yuborilmoqda — tugmada spinner
    var quote=null;
    ensureVgMeta().then(function(){
      if(j.cancelled)throw new Error('CANCELLED');
      if(!vm.model)throw new Error('No model found');
      // TEZLIK: preflight + cost-quote + session PARALLEL (kredit faqat /gen'da yechiladi → xavfsiz).
      return Promise.all([
        studioPost('/api/studio/gen/preflight-safety',{mode:'video',modelId:vm.model.id,prompt:prompt,params:params},20000),
        studioPost('/api/studio/gen/cost-quote',{modelId:vm.model.id,mode:'video',params:params,idempotencyKey:afUuid()}),
        ensureVgSession()
      ]);
    }).then(function(arr){
      if(j.cancelled)throw new Error('CANCELLED');
      var pre=arr[0]; quote=arr[1]; var sid=arr[2];
      j.sid=sid; // SC_29: job qaysi sessiyaga yozilishini eslab qolamiz
      if(pre&&pre.blocked){
        var er=new Error(preflightMsg(pre));
        er.code='PREFLIGHT_BLOCKED';
        throw er;
      }
      if(pre&&pre.warnings&&pre.warnings.length)toast(pre.warnings[0],'warning');
      return studioPost('/api/studio/gen',{sessionId:sid,mode:'video',modelId:vm.model.id,prompt:prompt,params:params,price:quote.price,costQuoteSignature:quote.signature,idempotencyKey:afUuid()},300000);
    }).then(function(res){
      if(j.cancelled)throw new Error('CANCELLED');
      if(res&&typeof res.creditsLeft==='number')setCreditChip(res.creditsLeft);
      if(!res||!res.jobId)throw new Error('Job was not created');
      if(_vgb)_vgb.classList.remove('busy');
      j.jobId=res.jobId; j.submitted=true;
      // #31 (PX1): panel yopilsa ham job diskda qoladi → keyingi ochilishда tiklanadi
      if(window.afJobStore)window.afJobStore.add('vidgen',{jobId:j.jobId,prompt:j.prompt,cat:'video',cost:j.jcost,sid:j.sid,modelId:j.modelId,params:j.params});
      startVgProg(j); pollVgJob(j,0);
    }).catch(function(err){
      if(_vgb)_vgb.classList.remove('busy');
      if(j.cancelled||(err&&err.message==='CANCELLED')){ removeVgJob(j); return; }
      removeVgJob(j); toast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Generation error','error');
    });
  }
  $('vgGen').addEventListener('click',genVgClick);
  $('vgPrompt').addEventListener('keydown',function(e){
    if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ e.preventDefault(); if(!$('vgGen').disabled)genVgClick(); return; }
    var men=$('vgMention'); if(!men||!men.classList.contains('on'))return; // #6: dropdown klaviatura navigatsiyasi
    if(e.key==='Escape'){ e.stopPropagation(); e.preventDefault(); hideVgMention(); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); moveVgMention(e.key==='ArrowDown'?1:-1); }
  });
  $('vgBack').addEventListener('click',function(){ closeVgSheets(); if(typeof axGo==='function')axGo('launcher'); }); // #6: aicat oraliq ekrani chetlab o'tiladi
  // ↺ Tozalash — KIRISH (prompt + referens/kadr) tozalanadi; NATIJA (So'nggi grid) tegmaydi.
  (function(){ var b=$('vgClearBtn'); if(!b)return; b.addEventListener('click',function(){
    var ta=$('vgPrompt'); if(ta){ ta.value=''; if(typeof axGrow==='function')axGrow(ta); }
    if(mref.length){ var toks=mref.map(function(r){ return r&&r.token; }).filter(Boolean); mref=[]; stripPromptTokens(toks); }
    clearFrameState();
    hideVgMention(); renderMediaRefs(); updRefMeta(); refreshVgBtn();
    toast('Cleared','info');
  }); })();
  (function(){ var h=$('vgHist'); if(h)h.addEventListener('click',function(){ closeVgSheets(); if(typeof window.axGo==='function')window.axGo('history'); }); var s=$('vgSet'); if(s)s.addEventListener('click',function(){ closeVgSheets(); if(typeof window.axGo==='function')window.axGo('settings'); }); })();
  $('vgPrompt').addEventListener('input',function(){ refreshVgBtn(); checkVgMention(); });
  $('vgPrompt').addEventListener('keyup',checkVgMention);
  $('vgPrompt').addEventListener('blur',function(){ setTimeout(hideVgMention,150); });

  // SC_17: video Upscale (Topaz) oqimi BUTUNLAY o'chirildi — vupModel/vgStartUpscale/
  // vgRunUpscale/afVgUpscale yo'q. Eski upscale natijalari oddiy video sifatida ko'rinadi.

  // View'дан chiqishда video joblar timer/network + inline pleyer ovozini to'xtatamiz (leak oldini olish — igScript naqshi).
  function teardownVg(){
    // SC_21: video joblar view almashганда BEKOR QILINMAYDI — poll fonда davom etadi;
    // faqat inline pleer to'xtaydi va lightbox yopiladi (ovoz/leak oldini olish).
    var v=$('vgVideo'); if(v){ try{v.pause();}catch(e){} }
    if(window.afRecent&&window.afRecent.closeLightbox)window.afRecent.closeLightbox();
  }
  window.axVGTeardown=teardownVg;
  window.__axVGRunning=function(){ return activeJobs.length; }; // SC_21: global badge uchun
  // FIX H: rasm tool (axIGRefresh) bilan bir xil — view har ochilganda kredit sinxron + model
  // yuklanmagan bo'lsa QAYTA uriniladi (avval birinchi fetch xatosi tool'ni butunlay o'chirib qo'yardi)
  // SC_29: sessiya almashganda feed tozalanadi; faol joblarning pit'i uziladi (poll fonda davom etadi)
  function vgResetFeed(){
    vgRcState.items=[]; vgRcState.sel={}; vgRcState.selecting=false; vgRcState.loaded=false; vgRcState.loadedAt=0; vgRcState.error=''; vgRcState.audCount=0; vgRcState.sessTotal=null;
    var sb=$('vgRecentSel'); if(sb)sb.classList.remove('on');
    activeJobs.forEach(function(j){ j.pit=null; });
    renderVgRecent();
  }
  window.axVGNewSession=function(){ vm.sessionId=null; if(window.__axwsSess)window.__axwsSess.vidgen=null; vgResetFeed(); }; // P1: New session
  window.axVGSetSession=function(id){ id=id||null; if(id===vm.sessionId)return; vm.sessionId=id; vgResetFeed(); }; // SC_18: picker'dan sessiya davomi
  window.__axToolSess=window.__axToolSess||{};
  window.__axToolSess.vidgen=function(){ return vm.sessionId; };
  window.__axwsCounts=window.__axwsCounts||{};
  window.__axwsCounts.vidgen=function(){
    var visLoaded=0,pend=0;
    vgRcState.items.forEach(function(x){ if(!x)return; if(x.pending)pend++; else if(x.url)visLoaded++; });
    var vis=(typeof vgRcState.sessTotal==='number'&&vgRcState.sessTotal>=visLoaded+vgRcState.audCount)?(vgRcState.sessTotal-vgRcState.audCount):visLoaded;
    return {vis:vis+pend,aud:vgRcState.audCount||0};
  };
  window.axVGRefresh=function(){ setCreditChip(credits()); if(!vm.loaded)ensureVgMeta().catch(function(){}); loadVgRecent(); restoreVgJobs(); }; // SC_29: view ochilganda sessiya feed'i ham yuklanadi (+#31 faol joblar tiklanadi)

  ensureVgMeta().catch(function(){});
  renderFrameBoxes(); refreshVgBtn();
  loadVgRecent(); renderVgRecent(); renderVgSavedRefs();
})();

/* ===== AUDIO GEN TOOL — P8 Step C: Voice (Kokoro TTS 2001) + SFX (ElevenLabs 4001) =====
   Katalog-driven: voices/durations/cost /gen/models'dan; gen oqimi = imzolangan cost-quote →
   /gen → poll (money-zone'ga tegilmagan, mavjud yo'l qayta ishlatiladi). */
(function(){
  function $(id){return document.getElementById(id);}
  if(!$('v-audgen'))return;
  var IS_CEP=(typeof window.__adobe_cep__!=='undefined');
  function toast(m,k){ if(typeof showToast==='function')showToast(m,k); }
  var ag={mode:'voice',models:{voice:null,sfx:null},loaded:false,_pending:null,voice:'',dur:null,sessions:{},recent:[],recentLoaded:false,pollTimers:{},visCount:0}; // SC_29: visCount — sessiyadagi visual elementlar (Visuals tab sanog'i)

  function ensureAgMeta(){
    if(ag.loaded)return Promise.resolve(ag);
    if(ag._pending)return ag._pending;
    ag._pending=Promise.all([
      studioGet('/api/studio/gen/models?mode=voice'),
      studioGet('/api/studio/gen/models?mode=sfx')
    ]).then(function(rs){
      var vs=(rs[0]&&rs[0].models)||[], ss=(rs[1]&&rs[1].models)||[];
      ag.models.voice=vs.filter(function(x){return x.isDefault;})[0]||vs[0]||null;
      ag.models.sfx=ss.filter(function(x){return x.isDefault;})[0]||ss[0]||null;
      if(!ag.models.voice&&!ag.models.sfx)throw new Error('No audio model found');
      var vm0=ag.models.voice;
      if(vm0&&Array.isArray(vm0.voices)&&vm0.voices.length)ag.voice=vm0.voices[0].id;
      var sm0=ag.models.sfx;
      if(sm0&&Array.isArray(sm0.durations)&&sm0.durations.length)ag.dur=sm0.durations[0];
      ag.loaded=true; applyAg(); return ag;
    }).catch(function(err){
      ag._pending=null; var g=$('agGen'); if(g)g.disabled=true;
      toast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Failed to load audio models','error'); throw err;
    });
    return ag._pending;
  }
  // Kredit chip sinxroni — /credits'dan yangi qiymat olib umumiy afSyncCredits'ga beradi.
  function agSyncCredits(){ try{ studioGet('/api/studio/credits').then(function(d){ if(d&&typeof d.aiCredits==='number'&&typeof window.afSyncCredits==='function')window.afSyncCredits(d.aiCredits); }).catch(function(){}); }catch(e){} }
  function curAgModel(){ return ag.mode==='voice'?ag.models.voice:ag.models.sfx; }
  function agCost(){ var m=curAgModel(); return m?(m.cost||0):0; }
  // SC_27 (web paritet): kredit yetmasa Generate O'CHADI (bosishdan oldin) — image/video gate naqshi
  function agCredits(){ try{ var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null; return (u&&typeof u.aiCredits==='number'&&isFinite(u.aiCredits))?u.aiCredits:null; }catch(e){ return null; } }
  function agCreditGate(){
    var cr=agCredits(), need=agCost();
    var low=(cr!=null)&&need>0&&(need>cr);
    window.afLowCred('ag',low,window.afLowCredNeed(need,cr)); // D7: umumiy banner helper
    return low;
  }

  // SC_47: axws-pop popover'larni yopish (voice/duration tanlangach)
  function agClosePops(){ var ps=document.querySelectorAll('.axws-pop.open'); for(var i=0;i<ps.length;i++)ps[i].classList.remove('open'); }
  // SC_47: on-demand voice ro'yxati (searchable) — chip → popover ichida render
  function renderAgVoiceList(voices,curId,q){
    var list=$('agVoiceList'); if(!list)return; list.innerHTML='';
    var qq=(q||'').trim().toLowerCase();
    voices.forEach(function(v){
      if(qq&&String(v.label).toLowerCase().indexOf(qq)<0)return;
      var b=document.createElement('button'); b.type='button'; b.className='axws-vrow'+(v.id===curId?' active':'');
      b.innerHTML='<span>'+escHtml(v.label)+'</span><span class="vck">✓</span>';
      b.addEventListener('click',function(){ ag.voice=v.id; agClosePops(); applyAg(); });
      list.appendChild(b);
    });
  }
  // SC_47: voice belgi hisoblagichi (≥80% da ko'rinadi) + limit notice pill
  function updateAgCharCount(vCap){
    var cc=$('agCharCount'), ta=$('agPrompt'), note=$('agLimitNote');
    var len=(ta&&ta.value)?ta.value.length:0;
    if(cc){
      if(vCap&&len>=Math.floor(vCap*0.8)){ cc.style.display=''; cc.textContent=len+' / '+vCap; cc.classList.toggle('warn',len>vCap); }
      else cc.style.display='none';
    }
    if(note)note.classList.toggle('on',!!(vCap&&len>vCap));
  }
  function applyAg(){
    var m=curAgModel();
    var mv=$('agModeVoice'), ms=$('agModeSfx');
    if(mv)mv.classList.toggle('is-on',ag.mode==='voice');
    if(ms)ms.classList.toggle('is-on',ag.mode==='sfx');
    // BATCH4 #4 — Chirp maxChars cap (server 400 VOICE_TEXT_TOO_LONG dan oldin UX). SC_47: endi hisoblagichda.
    var vCap=(ag.mode==='voice'&&m&&typeof m.maxChars==='number'&&m.maxChars>0)?m.maxChars:0;
    var ta=$('agPrompt'); if(ta)ta.placeholder=ag.mode==='voice'?'Type the narration text… @ for references':'Describe the sound effect…';
    // SC_47 money guard: model/narx displeyi doimiy ko'rinadi
    var mn=$('agModelName'); if(mn)mn.textContent=m?(m.label+' · ✦'+(m.cost||0)):'';
    // SC_47: voice — on-demand chip + popover (faqat voice rejimida)
    var vwrap=$('agVoiceWrap'), vlbl=$('agVoicePillLbl');
    var showV=ag.mode==='voice'&&m&&Array.isArray(m.voices)&&m.voices.length>0;
    if(vwrap)vwrap.style.display=showV?'':'none';
    if(showV){
      var curV=m.voices.filter(function(v){return v.id===ag.voice;})[0]||m.voices[0];
      if(vlbl)vlbl.textContent=curV?curV.label:'Voice';
      var vs=$('agVoiceSearch'); renderAgVoiceList(m.voices,curV&&curV.id,vs?vs.value:'');
    }
    // SC_47: duration — on-demand chip + popover (faqat sfx rejimida)
    var dwrap=$('agDurWrap'), dlbl=$('agDurPillLbl'), dlist=$('agDurList');
    var showD=ag.mode==='sfx'&&m&&Array.isArray(m.durations)&&m.durations.length>0;
    if(dwrap)dwrap.style.display=showD?'':'none';
    if(showD){
      var curD=(m.durations.indexOf(ag.dur)>=0?ag.dur:m.durations[0]);
      if(dlbl)dlbl.textContent=curD+'s';
      if(dlist){ dlist.innerHTML=''; m.durations.forEach(function(d){ var b=document.createElement('button'); b.type='button'; b.className='axws-vrow'+(d===curD?' active':''); b.innerHTML='<span>'+d+'s</span><span class="vck">✓</span>'; b.addEventListener('click',function(){ ag.dur=d; agClosePops(); applyAg(); }); dlist.appendChild(b); }); }
    }
    updateAgCharCount(vCap);
    var c=$('agCost'); if(c)c.textContent='✦'+agCost();
    refreshAgBtn();
  }
  function refreshAgBtn(){
    var b=$('agGen'); if(!b)return;
    var ta=$('agPrompt');
    b.disabled=!(ag.loaded&&curAgModel()&&ta&&ta.value.trim().length>=2&&!agCreditGate()); // SC_27: kredit gate
  }
  var _ta=$('agPrompt'); if(_ta)_ta.addEventListener('input',function(){ refreshAgBtn(); var m=curAgModel(); var vCap=(ag.mode==='voice'&&m&&typeof m.maxChars==='number'&&m.maxChars>0)?m.maxChars:0; updateAgCharCount(vCap); });
  // SC_47: voice picker qidiruvi — ro'yxatni jonli filtrlaydi
  var _vs=$('agVoiceSearch'); if(_vs)_vs.addEventListener('input',function(){ var m=curAgModel(); if(ag.mode==='voice'&&m&&Array.isArray(m.voices)){ var curV=m.voices.filter(function(v){return v.id===ag.voice;})[0]||m.voices[0]; renderAgVoiceList(m.voices,curV&&curV.id,_vs.value); } });
  // SC_27 (web paritet): Clear — matn tozalanadi (natijalar tegilmaydi)
  var _acl=$('agClearBtn'); if(_acl)_acl.addEventListener('click',function(){ var t=$('agPrompt'); if(t)t.value=''; refreshAgBtn(); toast('Cleared','info'); });
  // SC_27 (web paritet): Enhance — /gen/prompt/enhance (mode-aware: voice matni / sfx tavsifi)
  var _agEnhancing=false;
  var _aen=$('agEnhance'); if(_aen)_aen.addEventListener('click',function(){
    if(_agEnhancing)return;
    var t=$('agPrompt'); var b=(t&&t.value||'').trim();
    if(!b){ toast('Write the text first','warning'); return; }
    _agEnhancing=true; _aen.classList.add('busy');
    studioPost('/api/studio/gen/prompt/enhance',{prompt:b,mode:ag.mode,format:'text',idempotencyKey:afUuid()}).then(function(e){
      if(e&&e.prompt){
        if(t)t.value=(typeof afCleanEnhancedPrompt==='function')?afCleanEnhancedPrompt(e.prompt):String(e.prompt).trim();
        refreshAgBtn();
        if(typeof e.creditsLeft==='number'&&typeof window.afSyncCredits==='function')window.afSyncCredits(e.creditsLeft);
        toast('Prompt enhanced ✨'+(e&&e.creditsCharged?(' · ✦'+e.creditsCharged):''),'success');
      } else toast('Could not enhance','error');
    }).catch(function(err){ toast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Enhance error','error'); }).then(function(){ _agEnhancing=false; _aen.classList.remove('busy'); });
  });
  var _mv=$('agModeVoice'); if(_mv)_mv.addEventListener('click',function(){ if(ag.mode!=='voice'){ ag.mode='voice'; applyAg(); } });
  var _ms2=$('agModeSfx'); if(_ms2)_ms2.addEventListener('click',function(){ if(ag.mode!=='sfx'){ ag.mode='sfx'; applyAg(); } });

  function agSession(mode){
    if(ag.sessions[mode])return Promise.resolve(ag.sessions[mode]);
    return studioPost('/api/studio/gen/sessions',{mode:mode}).then(function(s){ ag.sessions[mode]=s.id; window.__axwsSess=window.__axwsSess||{}; window.__axwsSess.audgen=s; return s.id; }); // SC_29: lazy sessiya header'ga ham
  }
  function agParams(){
    var m=curAgModel(); var p={};
    if(ag.mode==='voice'&&m&&Array.isArray(m.voices)&&m.voices.length){ p.voice=m.voices.some(function(v){return v.id===ag.voice;})?ag.voice:m.voices[0].id; }
    if(ag.mode==='sfx'&&m&&Array.isArray(m.durations)&&m.durations.length){ p.duration=(m.durations.indexOf(ag.dur)>=0?ag.dur:m.durations[0]); }
    return p;
  }
  function renderAgResult(assets,prompt){
    var res=$('agRes'), wrap=$('agResults'); if(!res||!wrap)return;
    var a0=(assets&&assets[0])||{}; var url=a0.url; if(!url){ toast('Empty result','warning'); return; }
    var row=document.createElement('div');
    row.style.cssText='display:flex;flex-direction:column;gap:7px;background-color:rgba(255,255,255,.04);border-width:1px;border-style:solid;border-color:rgba(255,255,255,.08);border-radius:12px;padding:10px;margin-bottom:8px';
    var cap=document.createElement('div'); cap.style.cssText='font-size:11px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; cap.textContent=prompt||''; row.appendChild(cap);
    var au=document.createElement('audio'); au.controls=true; au.src=url; au.style.width='100%'; row.appendChild(au);
    var acts=document.createElement('div'); acts.style.cssText='display:flex;gap:8px';
    var bImp=document.createElement('div'); bImp.className='vact'; bImp.textContent='⤓ Premiere import';
    bImp.addEventListener('click',function(){ if(typeof aiImportMedia==='function')aiImportMedia(url,'audio',null); else toast('Only works inside Premiere Pro','info'); });
    acts.appendChild(bImp);
    if(!IS_CEP){
      var bDl=document.createElement('div'); bDl.className='vact'; bDl.textContent='⬇ Download';
      bDl.addEventListener('click',function(){ try{ var a=document.createElement('a'); a.href=a0.downloadUrl||url; a.download=window.afGenDlName(prompt,url,ag.mode==='sfx'?'sfx':'audio'); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} });
      acts.appendChild(bDl);
    }
    row.appendChild(acts);
    wrap.insertBefore(row,wrap.firstChild);
    res.classList.add('on'); res.style.display='';
    var meta=$('agResMeta'); if(meta)meta.textContent=wrap.children.length+' result'+(wrap.children.length>1?'s':'');
  }
  function pollAg(jobId,prompt,ctx,tries){
    tries=tries||0; ctx=ctx||{};
    if(tries>90){ toast('Audio is taking too long — check History later','warning'); return; }
    ag.pollTimers[jobId]=setTimeout(function(){
      studioGet('/api/studio/gen/'+jobId).then(function(gn){
        if(!gn){ pollAg(jobId,prompt,ctx,tries+1); return; }
        if(gn.status==='done'){
          delete ag.pollTimers[jobId]; setAgBusy(false);
          var au0=((gn.assets||[])[0]||{});
          // P30 (29c) — done LEKIN natija yo'q = provayder rad etdi (success-shaklda). Halol ishlaymiz.
          if(!au0.url){ if(!handleGenRejection(gn,null)) toast((gn.error&&typeof friendlyError==='function')?friendlyError({message:gn.error}):'No audio was returned — your credits were refunded','error'); agSyncCredits(); return; }
          // SC_29: sessiya almashgan bo'lsa natija strip JORIY sessiyaga aralashmaydi (toast baribir keladi)
          var sameSess=!ctx.sid||agSessIds().indexOf(ctx.sid)>=0;
          if(sameSess){ renderAgResult(gn.assets,prompt); loadAgRecent(true); }
          agSyncCredits();
          if(typeof window.afGenDoneNotify==='function')window.afGenDoneNotify('audgen',null,null,ctx.sid||null,ctx.mode||null); // SC_21
          else toast('Audio ready','success');
          if(window.axSPInvalidate)window.axSPInvalidate(); // SC_29: picker sanoqlari yangilansin
        }
        else if(gn.status==='failed'){ delete ag.pollTimers[jobId]; setAgBusy(false); if(!handleGenRejection(gn,null)) toast((gn.error&&typeof friendlyError==='function')?friendlyError({message:gn.error}):(gn.error||'Audio failed — credits refunded'),'error'); agSyncCredits(); }
        else pollAg(jobId,prompt,ctx,tries+1);
      }).catch(function(){ pollAg(jobId,prompt,ctx,tries+1); });
    },2000);
  }
  function setAgBusy(b){ var g=$('agGen'); if(g){ g.classList.toggle('busy',b); g.disabled=b?true:!(($('agPrompt')||{}).value||'').trim(); } }
  var _gen=$('agGen'); if(_gen)_gen.addEventListener('click',function(){
    var m=curAgModel(); if(!m){ toast('Model not loaded yet','warning'); return; }
    var ta=$('agPrompt'); var prompt=(ta&&ta.value||'').trim();
    if(prompt.length<2){ toast('Write the text first','warning'); return; }
    // BATCH4 #4 — Chirp cap: kredit yechilmasdan oldin server 400 beradi; bu yerda aniq UX toast
    if(ag.mode==='voice'&&typeof m.maxChars==='number'&&m.maxChars>0&&prompt.length>m.maxChars){ toast('Max '+m.maxChars+' characters for '+m.label+' (yours: '+prompt.length+') — split the text','warning'); return; }
    var params=agParams(); var mode=ag.mode;
    setAgBusy(true);
    Promise.all([
      studioPost('/api/studio/gen/cost-quote',{modelId:m.id,mode:mode,params:params,idempotencyKey:afUuid()}),
      agSession(mode)
    ]).then(function(rs){
      var quote=rs[0], sid=rs[1];
      return studioPost('/api/studio/gen',{sessionId:sid,mode:mode,modelId:m.id,prompt:prompt,params:params,price:quote.price,costQuoteSignature:quote.signature,idempotencyKey:afUuid()},60000)
        .then(function(r){ return {r:r,sid:sid}; }); // SC_29: sid poll ctx'ga uzatiladi
    }).then(function(o){
      agSyncCredits();
      pollAg(o.r.jobId,prompt,{sid:o.sid,mode:mode},0);
    }).catch(function(e){
      setAgBusy(false);
      var msg=(typeof friendlyError==='function'?friendlyError(e):(e&&e.message))||'Failed to start';
      toast(msg,'error');
      if(/credit/i.test(String(msg)))window.afLowCred('ag',true,'This run needs ✦'+agCost()); // D7: umumiy banner helper
    });
  });

  // So'nggi — voice+sfx tarixi birga (umumiy afRecent kartasi bilan)
  function agRecentCtx(){ return {
    isCEP:IS_CEP,
    list:function(){ return ag.recent; },
    selecting:function(){ return false; }, isSelected:function(){ return false; }, onToggleSelect:function(){},
    onImport:function(it){ if(typeof aiImportMedia==='function')aiImportMedia(it.url,'audio',null); else toast('Only works inside Premiere Pro','info'); },
    onAddProject:function(it){ if(window.afProjectPicker)window.afProjectPicker('gen',it.id); }, // P1
    onAddExplore:function(it){ window.afAddToExplore(it); }, // P3 (step 34)
    onDownload:function(it){ try{ var a=document.createElement('a'); a.href=it.downloadUrl||it.url; a.download=window.afGenDlName(it.prompt||it.title,it.url,it.cat); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} },
    // SC_30: tasdiqsiz o'chirish xavfli edi — endi afConfirm (boshqa feed'lar bilan bir xil)
    onDelete:function(it){ if(!it.id)return; window.afConfirm('Delete this? This cannot be undone.',{ok:'Delete',danger:true}).then(function(ok){ if(!ok)return; studioDelete('/api/studio/gen/'+it.id).then(function(){ ag.recent=ag.recent.filter(function(x){return x.id!==it.id;}); renderAgRecent(); if(window.afGallery)window.afGallery.invalidate(); toast('Deleted','success'); }).catch(function(){ toast('Delete failed','error'); }); }); },
    refAllowed:function(){ return false; }, onRef:function(){}
  }; }
  function agSessIds(){ var out=[]; for(var k in ag.sessions){ if(ag.sessions[k]&&out.indexOf(ag.sessions[k])<0)out.push(ag.sessions[k]); } return out; }
  function loadAgRecent(force){
    if(ag.recentLoading)return;
    if(ag.recentLoaded&&!force){ renderAgRecent(); return; }
    // SC_29: feed FAQAT faol audio sessiya(lar) bilan chegaralangan (global /gen/history EMAS).
    // Sessiya yo'q (yangi sessiya) → bo'sh feed, so'rov yuborilmaydi.
    var sids=agSessIds();
    if(!sids.length){ ag.recent=[]; ag.visCount=0; ag.recentLoaded=true; ag.recentLoading=false; renderAgRecent(); return; }
    var snap=sids.join(',');
    ag.recentLoading=true;
    Promise.all(sids.map(function(id){
      return studioGet('/api/studio/gen/sessions/'+encodeURIComponent(id)+'/generations?perPage=10&status=done').catch(function(){return null;});
    })).then(function(rs){
      if(snap!==agSessIds().join(',')){ ag.recentLoading=false; return; } // sessiya almashdi — eskirgan javob tashlanadi
      var items=[],vis=0;
      rs.forEach(function(r){ (r&&(r.items||r.generations)||[]).forEach(function(g){
        var a=(g.assets&&g.assets[0])||{}; if(!a.url)return;
        var c=g.mode==='video'?'video':(g.mode==='voice'||g.mode==='music')?'audio':g.mode==='sfx'?'sfx':'image';
        if(c==='image'||c==='video'){ vis++; return; } // SC_29: Audio feed'ida visual karta chiqmaydi
        items.push({id:g.id,url:a.url,thumb:null,downloadUrl:a.downloadUrl||null,cat:c,title:(g.prompt||'').trim()||'Audio',prompt:(g.prompt||'').trim(),params:g.params||null,cost:(typeof g.cost==='number'?g.cost:null),createdAt:g.createdAt||null});
      }); });
      items.sort(function(x,y){ return String(y.createdAt||'').localeCompare(String(x.createdAt||'')); });
      ag.recent=items.slice(0,10); ag.visCount=vis; ag.recentLoaded=true; ag.recentLoading=false; renderAgRecent();
    }).catch(function(){ ag.recentLoading=false; });
  }
  function renderAgRecent(){
    var grid=$('agRecent'); if(!grid)return; grid.innerHTML='';
    if(!ag.recent.length){ var e=document.createElement('div'); e.style.cssText='font-size:11px;color:var(--mut2);padding:6px 2px'; e.textContent='No audio generations yet.'; grid.appendChild(e); return; }
    var ctx=agRecentCtx();
    ag.recent.forEach(function(it){ if(window.afRecent&&window.afRecent.card)grid.appendChild(window.afRecent.card(it,ctx)); });
  }
  var _ml=$('agMoreLink'); if(_ml)_ml.addEventListener('click',function(){ if(typeof window.axGo==='function')window.axGo('history'); });
  var _hb=$('agHist'); if(_hb)_hb.addEventListener('click',function(){ if(typeof window.axGo==='function')window.axGo('history'); });
  var _bk=$('agBack'); if(_bk)_bk.addEventListener('click',function(){ if(typeof window.axGo==='function')window.axGo('launcher'); });

  // SC_21: audio poll ham fonда davom etadi (bekor qilinmaydi)
  window.axAGTeardown=function(){};
  window.__axAGRunning=function(){ return Object.keys(ag.pollTimers).length; }; // SC_21
  // SC_29: sessiya almashganda feed + natija strip tozalanadi
  function agResetFeed(){
    ag.recent=[]; ag.visCount=0; ag.recentLoaded=false;
    var w=$('agResults'); if(w)w.innerHTML='';
    var res=$('agRes'); if(res)res.classList.remove('on');
    renderAgRecent();
  }
  window.axAGNewSession=function(){ ag.sessions={}; if(window.__axwsSess)window.__axwsSess.audgen=null; agResetFeed(); }; // P1: New session
  window.axAGSetSession=function(mode,id){
    if(mode&&id&&ag.sessions[mode]===id&&agSessIds().length===1)return; // o'sha sessiya — feed keshi qoladi
    ag.sessions={}; if(mode&&id)ag.sessions[mode]=id; agResetFeed();
  }; // SC_18: picker'dan sessiya davomi
  window.__axToolSess=window.__axToolSess||{};
  window.__axToolSess.audgen=function(){ return agSessIds(); }; // massiv — notify ichida indexOf bilan tekshiriladi
  window.__axwsCounts=window.__axwsCounts||{};
  window.__axwsCounts.audgen=function(){ return {vis:ag.visCount||0,aud:ag.recent.length}; };
  /** #31 (PX1) — panel yopilib qayta ochilganda tugallanmagan AUDIO gen'lar poll'i tiklanadi.
   *  Audio tool'da "ishlamoqda" kartasi yo'q (natija So'nggi feed'ga tushadi) — shu bois
   *  bu yerda faqat poll qayta ulanadi: tugagach kredit sinxronlanadi va xabar keladi. */
  var agRestoreTried=false;
  function restoreAgJobs(){
    if(agRestoreTried)return; agRestoreTried=true;
    studioGet('/api/studio/gen/history?status=active&limit=10').then(function(d){
      ((d&&d.items)||[]).forEach(function(gn){
        if(!gn||!gn.id||['voice','sfx','music'].indexOf(gn.mode)<0)return;
        if(ag.pollTimers[gn.id])return; // allaqachon kuzatilyapti
        pollAg(gn.id,gn.prompt||'',{sid:gn.sessionId||null,mode:gn.mode||''},0);
      });
    }).catch(function(){ agRestoreTried=false; }); // tarmoq xatosi — keyingi ochilishda qayta uriniladi
  }
  window.axAGRefresh=function(){ if(!ag.loaded)ensureAgMeta().catch(function(){}); else applyAg(); loadAgRecent(); restoreAgJobs(); };
  // P25 — logout/boshqa hisob login: eski foydalanuvchining audio-gen tarixi grid'da qolib ketmasin
  window.axAGClearRecent=function(){ ag.recent=[]; ag.recentLoaded=false; renderAgRecent(); };

  ensureAgMeta().catch(function(){});
  loadAgRecent();
})();

/* ===== P1 — SESSIONS + PROJECTS (web bilan paritet, tor panelga moslangan) =====
   Backend TAYYOR (PARTIYA 5) — /gen/sessions*, /api/studio/projects* qayta ishlatiladi.
   UI: ro'yxat qatorlari (sessiyalar) + 2-ustun karta grid (loyihalar) + markaziy modallar
   (bottom-sheet TAQIQ — redesign qoidasi). Gen kartalar UMUMIY afRecent bilan chiziladi. */
(function(){
  function $(id){return document.getElementById(id);}
  if(!$('v-sessions'))return;
  var IS_CEP=(typeof window.__adobe_cep__!=='undefined');
  function toast(m,k){ if(typeof showToast==='function')showToast(m,k); }
  var sp={sessions:[],sLoaded:false,sLoading:false,projects:[],pLoaded:false,pLoading:false,
          sess:null,sessItems:[],proj:null,
          sSelect:false,sSel:{},pSelect:false,pSel:{},pBusy:false}; // P11: multi-select holati (SC_34: pBusy — bulk delete jarayoni)

  // ── API mini-klient (ff-api.js project/session metodlari bilan 1:1) ──
  var api={
    sessions:function(){ return studioGet('/api/studio/gen/sessions'); },
    sessionRename:function(id,title){ return studioPatch('/api/studio/gen/sessions/'+encodeURIComponent(id),{title:title}); },
    sessionDelete:function(id){ return studioDelete('/api/studio/gen/sessions/'+encodeURIComponent(id)); }, // P11 (cascade backend)
    sessionGens:function(id){ return studioGet('/api/studio/gen/sessions/'+encodeURIComponent(id)+'/generations?perPage=50&status=done'); },
    projects:function(){ return studioGet('/api/studio/projects'); },
    projectCreate:function(name){ return studioPost('/api/studio/projects',{name:name}); },
    projectGet:function(id){ return studioGet('/api/studio/projects/'+encodeURIComponent(id)); },
    projectRename:function(id,name){ return studioPatch('/api/studio/projects/'+encodeURIComponent(id),{name:name}); },
    projectDelete:function(id){ return studioDelete('/api/studio/projects/'+encodeURIComponent(id)); },
    projectAddItem:function(id,kind,refId){ return studioPost('/api/studio/projects/'+encodeURIComponent(id)+'/items',{kind:kind,refId:refId}); },
    projectRemoveItem:function(id,itemId){ return studioDelete('/api/studio/projects/'+encodeURIComponent(id)+'/items/'+encodeURIComponent(itemId)); }
  };

  // #122 (L8) — loyiha yaratish xatosi SABABI ko'rsatiladi. Server Free rejada
  // `403 PROJECT_LIMIT` qaytaradi (`routes/projects.ts`), lekin plagin har qanday
  // xatoni "Failed to create project" deb ko'rsatardi: Free foydalanuvchi nega
  // bo'lmayotganini ham, yechimni (Pro) ham bilmasdi. Server matni tayyor va aniq.
  function afProjErr(e){
    var m=e&&e.message?String(e.message):'';
    if(!m||/^HTTP \d+$/.test(m))return 'Failed to create project';
    return m;
  }

  // ── Markaziy modal: nom kiritish (yaratish/rename) ──
  var nameOv=null;
  window.afNameModal=function(title,initial,cb){
    if(!nameOv){
      nameOv=document.createElement('div'); nameOv.className='afspov';
      nameOv.innerHTML='<div class="spc"><div class="sph"><b id="afNmT"></b><span class="x" id="afNmX">✕</span></div>'
        +'<input id="afNmI" maxlength="80" placeholder="Name…">'
        +'<div class="spb"><div role="button" tabindex="0" type="button" class="spbtn" id="afNmC">Cancel</div><div role="button" tabindex="0" type="button" class="spbtn pri" id="afNmOk">Save</div></div></div>';
      document.body.appendChild(nameOv);
      nameOv.addEventListener('click',function(e){ if(e.target===nameOv)nameOv.classList.remove('on'); });
      nameOv.querySelector('#afNmX').addEventListener('click',function(){ nameOv.classList.remove('on'); });
      nameOv.querySelector('#afNmC').addEventListener('click',function(){ nameOv.classList.remove('on'); });
    }
    nameOv.querySelector('#afNmT').textContent=title;
    var inp=nameOv.querySelector('#afNmI'); inp.value=initial||'';
    var ok=nameOv.querySelector('#afNmOk');
    var nok=ok.cloneNode(true); ok.parentNode.replaceChild(nok,ok); // eski listener'lar tozalansin
    nok.addEventListener('click',function(){ var v=inp.value.trim(); if(!v){ toast('Enter a name','warning'); return; } nameOv.classList.remove('on'); cb(v); });
    inp.onkeydown=function(e){ if(e.key==='Enter')nok.click(); };
    nameOv.classList.add('on'); setTimeout(function(){ try{inp.focus();inp.select();}catch(e){} },50);
  };

  // ── Markaziy modal: loyiha tanlash ("Add to project" picker; yangi loyiha ham) ──
  var pickOv=null;
  window.afProjectPicker=function(kind,refId){
    if(!refId){ toast('This item is still saving — try again shortly','info'); return; }
    if(!pickOv){
      pickOv=document.createElement('div'); pickOv.className='afspov';
      pickOv.innerHTML='<div class="spc"><div class="sph"><b>Add to project</b><span class="x" id="afPpX">✕</span></div>'
        +'<div class="spl" id="afPpL"><div class="sp-empty">Loading…</div></div>'
        +'<input id="afPpNew" maxlength="80" placeholder="New project name…">'
        +'<div class="spb"><div role="button" tabindex="0" type="button" class="spbtn pri" id="afPpCreate">Create & add</div></div></div>';
      document.body.appendChild(pickOv);
      pickOv.addEventListener('click',function(e){ if(e.target===pickOv)pickOv.classList.remove('on'); });
      pickOv.querySelector('#afPpX').addEventListener('click',function(){ pickOv.classList.remove('on'); });
    }
    var doAdd=function(pid){
      api.projectAddItem(pid,kind,refId).then(function(){ pickOv.classList.remove('on'); sp.pLoaded=false; toast('Added to project','success'); })
        .catch(function(e){ toast((typeof friendlyError==='function'?friendlyError(e):(e&&e.message))||'Failed to add','error'); });
    };
    var list=pickOv.querySelector('#afPpL'); list.innerHTML='<div class="sp-empty">Loading…</div>';
    api.projects().then(function(r){
      var items=(r&&r.items)||[];
      list.innerHTML='';
      if(!items.length){ var e=document.createElement('div'); e.className='sp-empty'; e.textContent='No projects yet — create one below.'; list.appendChild(e); }
      items.forEach(function(p){
        var row=document.createElement('div'); row.className='spr';
        row.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+String(p.name||'Project').replace(/[<>&]/g,'')+'</span><small>'+(p.count||0)+' items</small>';
        row.addEventListener('click',function(){ doAdd(p.id); });
        list.appendChild(row);
      });
    }).catch(function(){ list.innerHTML='<div class="sp-empty">Could not load projects.</div>'; });
    var inp=pickOv.querySelector('#afPpNew'); inp.value='';
    var cr=pickOv.querySelector('#afPpCreate');
    var ncr=cr.cloneNode(true); cr.parentNode.replaceChild(ncr,cr);
    ncr.addEventListener('click',function(){ var v=inp.value.trim(); if(!v){ toast('Enter a project name','warning'); return; }
      api.projectCreate(v).then(function(p){ doAdd(p.id); }).catch(function(e){ toast(afProjErr(e),'error'); }); });
    pickOv.classList.add('on');
  };

  // ── Sessiyalar ro'yxati ──
  function loadSessions(force){
    if(sp.sLoading)return;
    if(sp.sLoaded&&!force){ renderSessions(); return; }
    sp.sLoading=true;
    api.sessions().then(function(r){ sp.sessions=(r&&r.items)||[]; sp.sLoaded=true; sp.sLoading=false; renderSessions(); })
      .catch(function(){ sp.sLoading=false; var l=$('spSessList'); if(l)l.innerHTML='<div class="sp-empty">Could not load sessions — sign in and try again.<br><div role="button" tabindex="0" type="button" class="af7-btn" style="margin-top:8px" onclick="if(window.afSpRetrySessions)window.afSpRetrySessions()">↻ Retry</div></div>'; });
  }
  // §C (P30) — web pariteti: sessiya yuklash xatosida Retry
  window.afSpRetrySessions=function(){ loadSessions(true); };
  function fmtAgo(iso){ try{ var d=new Date(iso); var s=(Date.now()-d.getTime())/1000; if(s<3600)return Math.max(1,Math.round(s/60))+'m ago'; if(s<86400)return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; }catch(e){ return ''; } }
  // SC_40 — qatorda inline rename: Enter/blur saqlaydi, Esc bekor, bo'sh = avto-nomga qaytadi (null).
  // Optimistik yangilash + xatoda rollback. maxLength 28 — displey qoidasiga mos (≤28 qo'lda nom AYNAN chiqadi).
  function startRowRename(tx,s,rerender){
    var b=tx.querySelector('b'); if(!b||tx.querySelector('input'))return;
    var disp=(typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(s):(s.title||'');
    var inp=document.createElement('input'); inp.className='sp-renin'; inp.maxLength=28; inp.value=disp;
    var init=disp, done=false;
    function finish(save){
      if(done)return; done=true;
      var v=inp.value.trim();
      try{ inp.remove(); }catch(e){}
      b.style.display='';
      if(!save||v===init){ if(rerender)rerender(); return; } // Esc yoki o'zgarish yo'q — so'rov yubormaymiz
      var newTitle=v||null, old=s.title||null; // bo'sh — nom o'chadi (server null saqlaydi, avto-nom qaytadi)
      if(newTitle===old){ if(rerender)rerender(); return; }
      s.title=newTitle; if(rerender)rerender(); // optimistik
      api.sessionRename(s.id,newTitle).catch(function(){
        s.title=old; if(rerender)rerender(); toast('Rename failed','error');
      });
    }
    inp.addEventListener('click',function(e){ e.stopPropagation(); }); // qator klik (open) ishlamasin
    inp.addEventListener('keydown',function(e){
      if(e.key==='Enter'){ e.preventDefault(); finish(true); }
      else if(e.key==='Escape'){ e.stopPropagation(); finish(false); }
    });
    inp.addEventListener('blur',function(){ finish(true); });
    b.style.display='none'; tx.insertBefore(inp,b);
    setTimeout(function(){ try{ inp.focus(); inp.select(); }catch(e){} },30);
  }
  function rowRenameBtn(row,tx,s,rerender){
    var rn=document.createElement('span'); rn.className='sp-act ren'; rn.title='Rename session';
    rn.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    rn.addEventListener('click',function(e){ e.stopPropagation(); startRowRename(tx,s,rerender); });
    row.appendChild(rn);
  }
  // D5: o'chirilgan sessiya asbobda OCHIQ qolmasin. Aks holda keyingi Generate o'chirilgan
  //   id bilan ketadi va server 404 "Session not found" beradi (kredit yechilmaydi, lekin
  //   foydalanuvchi sababini tushunmaydi). Mavjud "New session" yo'llarini ishlatamiz.
  function forgetDeletedSessions(ids){
    var m={imggen:'axIGNewSession',vidgen:'axVGNewSession',audgen:'axAGNewSession'}, cur=window.__axwsSess||{};
    Object.keys(m).forEach(function(k){
      var s=cur[k]; if(!s||ids.indexOf(s.id)<0)return;
      if(typeof window[m[k]]==='function')window[m[k]](); else cur[k]=null;
    });
  }
  // D5: bitta sessiyani to'g'ridan-to'g'ri o'chirish — avval "Select" rejimiga kirish shart emas.
  //   Tasdiq AYNI bulk naqshi (afConfirm, danger) — faqat matn bitta sessiya nomi + gen soni bilan.
  //   Server cascade qiladi (gen'lar + assetlar): DELETE /gen/sessions/:id.
  function rowDeleteBtn(row,s,rerender){
    var dl=document.createElement('span'); dl.className='sp-act ren del'; dl.title='Delete session';
    dl.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6V4h8v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    dl.addEventListener('click',function(e){
      e.stopPropagation();
      var nm=(typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(s):(s.title||'this session');
      var n=s.count||0;
      window.afConfirm('Delete “'+nm+'”'+(n?(' and its '+n+' generation'+(n>1?'s':'')):'')+'? This can’t be undone.',{ok:'Delete',danger:true}).then(function(ok){
        if(!ok)return;
        api.sessionDelete(s.id).then(function(){
          delete sp.sSel[s.id]; sp.sLoaded=false; forgetDeletedSessions([s.id]);
          if(window.afRefreshAll)window.afRefreshAll(); else loadSessions(true);
          if(window.afGallery)window.afGallery.invalidate();
          if(rerender)rerender(); updSessBulk();
          toast('“'+nm+'” deleted','success');
        }).catch(function(){ toast('Delete failed','error'); });
      });
    });
    row.appendChild(dl);
  }
  function renderSessions(){
    var l=$('spSessList'); if(!l)return; l.innerHTML='';
    var meta=$('spSessMeta'); if(meta)meta.textContent=sp.sessions.length?(sp.sessions.length+' sessions'):'';
    if(!sp.sessions.length){ l.innerHTML='<div class="sp-empty">No sessions yet — generate something and it will appear here.</div>'; return; }
    var sel=sp.sSelect;
    sp.sessions.forEach(function(s){
      var row=document.createElement('div'); row.className='sp-row'+(sel&&sp.sSel[s.id]?' picked':'');
      if(sel){ // P11: select rejimда checkbox (muqova o'rniga chapda)
        var ck=document.createElement('span'); ck.className='sp-check'; ck.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'; row.appendChild(ck);
      }
      var cov=document.createElement('span'); cov.className='sp-cov';
      if(s.coverUrl)cov.style.backgroundImage='url("'+s.coverUrl+'")';
      else cov.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
      row.appendChild(cov);
      var tx=document.createElement('span'); tx.className='sp-tx';
      tx.innerHTML='<b></b><small></small>';
      // SC_22: toza displey nomi; to'liq prompt tooltip'da qoladi
      tx.querySelector('b').textContent=(typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(s):(s.title||('Session · '+(s.mode||'')));
      if(s.title)row.title=s.title;
      tx.querySelector('small').textContent=(s.count||0)+' generations · '+(s.mode||'')+(s.lastAt?(' · '+fmtAgo(s.lastAt)):'');
      row.appendChild(tx);
      if(!sel){ rowRenameBtn(row,tx,s,renderSessions); // SC_40: inline rename (modal emas)
                rowDeleteBtn(row,s,renderSessions); }  // D5: bitta sessiya 🗑 (select rejimisiz)
      row.addEventListener('click',function(){
        if(sp.sSelect){ if(sp.sSel[s.id])delete sp.sSel[s.id]; else sp.sSel[s.id]=1; renderSessions(); updSessBulk(); }
        else openSession(s);
      });
      l.appendChild(row);
    });
  }
  // P11: sessiya bulk holati (tanlangan son + Delete tugma holati)
  function updSessBulk(){
    var bar=$('spSessBulk'), n=$('spSessBulkN'), del=$('spSessBulkDel'), btn=$('spSessSelBtn');
    var c=Object.keys(sp.sSel).length;
    if(bar)bar.classList.toggle('on',sp.sSelect);
    if(btn)btn.classList.toggle('on',sp.sSelect);
    if(n)n.textContent=c+' selected';
    if(del)del.disabled=!c;
  }
  function toggleSessSelect(on){ sp.sSelect=(on==null?!sp.sSelect:!!on); sp.sSel={}; renderSessions(); updSessBulk(); }
  function bulkDeleteSessions(){
    var ids=Object.keys(sp.sSel); if(!ids.length)return;
    window.afConfirm('Delete '+ids.length+' session'+(ids.length>1?'s':'')+'? Their generations are permanently deleted (this can’t be undone).',{ok:'Delete',danger:true}).then(function(ok){
      if(!ok)return;
      var done=0,fail=0,okIds=[];
      ids.forEach(function(id){ api.sessionDelete(id).then(function(){ done++; okIds.push(id); }).catch(function(){ fail++; }).then(function(){
        if(done+fail===ids.length){
          sp.sSelect=false; sp.sSel={}; sp.sLoaded=false; forgetDeletedSessions(okIds); // D5: ochiq sessiya dangling qolmasin
          if(window.afRefreshAll)window.afRefreshAll(); else loadSessions(true);
          if(window.afGallery)window.afGallery.invalidate();
          renderSessions(); updSessBulk();
          toast(done+' deleted'+(fail?(' · '+fail+' failed'):''), fail?'warning':'success');
        }
      }); });
    });
  }

  // ── Sessiya detali — gen'lar (umumiy afRecent kartalari) ──
  function genToItem(g){
    var a=(g.assets&&g.assets[0])||{};
    var cat=g.mode==='video'?'video':(g.mode==='voice'||g.mode==='music')?'audio':g.mode==='sfx'?'sfx':'image';
    return {id:g.id,url:a.url||'',thumb:a.thumbUrl||a.url||'',downloadUrl:a.downloadUrl||null,cat:cat,
      title:(g.prompt||'').trim()||'Result',prompt:(g.prompt||'').trim(),params:g.params||null,
      cost:(typeof g.cost==='number'?g.cost:null),createdAt:g.createdAt||null};
  }
  function spGridCtx(items,afterDelete){ return {
    isCEP:IS_CEP,
    list:function(){ return items.filter(function(x){return x&&x.url;}); },
    selecting:function(){ return false; }, isSelected:function(){ return false; }, onToggleSelect:function(){},
    onImport:function(it){ if(typeof aiImportMedia==='function'){ var kind=it.cat==='video'?'video':(it.cat==='audio'||it.cat==='sfx')?'audio':'image'; aiImportMedia(it.url,kind,null); } else toast('Premiere import only works inside Premiere Pro','info'); },
    onDownload:function(it){ try{ var a=document.createElement('a'); a.href=it.downloadUrl||it.url; a.download=window.afGenDlName(it.prompt||it.title,it.url,it.cat); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} },
    // SC_30: tasdiqsiz o'chirish xavfli edi — endi afConfirm; My Library keshi ham yangilanadi
    onDelete:function(it){ if(!it.id)return; window.afConfirm('Delete this? This cannot be undone.',{ok:'Delete',danger:true}).then(function(ok){ if(!ok)return; studioDelete('/api/studio/gen/'+it.id).then(function(){ var i=items.indexOf(it); if(i>=0)items.splice(i,1); afterDelete&&afterDelete(); if(window.afGallery)window.afGallery.invalidate(); toast('Deleted','success'); }).catch(function(){ toast('Delete failed','error'); }); }); },
    onAddProject:function(it){ window.afProjectPicker('gen',it.id); },
    onAddExplore:function(it){ window.afAddToExplore(it); }, // P3 (step 34)
    refAllowed:function(){ return false; }, onRef:function(){}
  }; }
  function openSession(s){
    sp.sess=s; sp.sessItems=[];
    if(typeof window.axGo==='function')window.axGo('session');
    var t=$('spSessTitle'); if(t){ t.textContent=(typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(s):(s.title||'Session'); if(s.title)t.title=s.title; } // SC_22
    var m=$('spSessDetMeta'); if(m)m.textContent='Loading…';
    var g=$('spSessGrid'); if(g)g.innerHTML='';
    api.sessionGens(s.id).then(function(r){
      var items=((r&&r.items)||[]).map(genToItem).filter(function(x){return x.url;});
      sp.sessItems=items; renderSessionGrid();
    }).catch(function(){ if(m)m.textContent='Could not load this session.'; });
  }
  function renderSessionGrid(){
    var g=$('spSessGrid'), m=$('spSessDetMeta'); if(!g)return; g.innerHTML='';
    if(m)m.textContent=sp.sessItems.length+' generations'+(sp.sess&&sp.sess.mode?(' · '+sp.sess.mode):'');
    if(!sp.sessItems.length){ g.innerHTML='<div class="sp-empty">This session has no finished generations.</div>'; return; }
    var ctx=spGridCtx(sp.sessItems,renderSessionGrid);
    sp.sessItems.forEach(function(it){ if(window.afRecent&&window.afRecent.card)g.appendChild(window.afRecent.card(it,ctx)); });
  }

  // ── Loyihalar ──
  function loadProjects(force){
    if(sp.pLoading)return;
    if(sp.pLoaded&&!force){ renderProjects(); return; }
    sp.pLoading=true;
    api.projects().then(function(r){ sp.projects=(r&&r.items)||[]; sp.pLoaded=true; sp.pLoading=false; renderProjects(); })
      .catch(function(){ sp.pLoading=false; var g=$('spProjGrid'); if(g)g.innerHTML='<div class="sp-empty">Could not load projects — sign in and try again.<br><div role="button" tabindex="0" type="button" class="af7-btn" style="margin-top:8px" onclick="if(window.afSpRetryProjects)window.afSpRetryProjects()">↻ Retry</div></div>'; });
  }
  // §C (P30) — web pariteti: loyiha yuklash xatosida Retry
  window.afSpRetryProjects=function(){ loadProjects(true); };
  function renderProjects(){
    var g=$('spProjGrid'), em=$('spProjEmpty'), meta=$('spProjMeta'); if(!g)return; g.innerHTML='';
    if(meta)meta.textContent=sp.projects.length?(sp.projects.length+' projects'):'';
    if(em)em.style.display=sp.projects.length?'none':'';
    var sel=sp.pSelect;
    sp.projects.forEach(function(p){
      var card=document.createElement('div'); card.className='sp-card'+(sel&&sp.pSel[p.id]?' picked':'');
      if(sel){ var ck=document.createElement('span'); ck.className='sp-check'; ck.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'; card.appendChild(ck); }
      var cv=document.createElement('div'); cv.className='cv';
      // P6: faqat HAQIQIY muqovalar (thumb bor) — soniga qarab 1/2/3/4 layout, bo'sh katak yo'q.
      var covers=(p.covers||[]).filter(function(c){return c&&c.thumb;}).slice(0,4);
      cv.className='cv cv-n'+covers.length;
      if(!covers.length){ cv.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
      else covers.forEach(function(c){ var cell=document.createElement('i'); cell.style.backgroundImage='url("'+c.thumb+'")'; cv.appendChild(cell); });
      card.appendChild(cv);
      var nm=document.createElement('div'); nm.className='nm'; nm.textContent=p.name||'Project'; card.appendChild(nm);
      var ct=document.createElement('div'); ct.className='ct'; ct.textContent=(p.count||0)+' items';
      card.appendChild(ct);
      card.addEventListener('click',function(){
        if(sp.pSelect){ if(sp.pBusy)return; if(sp.pSel[p.id])delete sp.pSel[p.id]; else sp.pSel[p.id]=1; renderProjects(); updProjBulk(); } // SC_34: o'chirish jarayonida tanlov qotiriladi
        else openProject(p.id,p.name);
      });
      g.appendChild(card);
    });
  }
  // P11: loyiha bulk holati + tanlash + bulk delete (loyiha o'chadi; ichidagi genlar My Library'da qoladi)
  function updProjBulk(){
    var bar=$('spProjBulk'), n=$('spProjBulkN'), del=$('spProjBulkDel'), btn=$('spProjSelBtn');
    var c=Object.keys(sp.pSel).length;
    if(bar)bar.classList.toggle('on',sp.pSelect);
    if(btn)btn.classList.toggle('on',sp.pSelect);
    if(n)n.textContent=c+' selected';
    if(del){ del.disabled=!c||sp.pBusy; del.textContent=sp.pBusy?'Deleting…':'Delete'; } // SC_34: progress + spam-guard
  }
  function toggleProjSelect(on){ if(sp.pBusy)return; sp.pSelect=(on==null?!sp.pSelect:!!on); sp.pSel={}; renderProjects(); updProjBulk(); }
  function bulkDeleteProjects(){
    if(sp.pBusy)return; // SC_34: qayta bosishdan himoya
    var ids=Object.keys(sp.pSel); if(!ids.length)return;
    window.afConfirm('Delete '+ids.length+' project'+(ids.length>1?'s':'')+'? The projects and their groupings are removed — the generations inside stay in My Library.',{ok:'Delete',danger:true}).then(function(ok){
      if(!ok)return;
      if(sp.pBusy)return; sp.pBusy=true; updProjBulk(); // SC_34: jarayon holati (Deleting…, tugma qulflanadi)
      var done=0,fail=0;
      ids.forEach(function(id){ api.projectDelete(id).then(function(){ done++; }).catch(function(){ fail++; }).then(function(){
        if(done+fail===ids.length){
          sp.pBusy=false; sp.pSelect=false; sp.pSel={}; sp.pLoaded=false;
          loadProjects(true); renderProjects(); updProjBulk();
          toast(done+' deleted'+(fail?(' · '+fail+' failed'):''), fail?'warning':'success');
        }
      }); });
    });
  }
  function projItemToCard(it){
    if(it.kind==='gen'&&it.gen){ var x=genToItem(it.gen); x._itemId=it.id; return x; }
    if(it.kind==='template'&&it.template){
      var t=it.template;
      return {id:t.id,_itemId:it.id,_tpl:true,url:t.previewUrl||t.thumbUrl||'',thumb:t.thumbUrl||'',cat:(t.previewUrl?'video':'image'),
        title:t.title||t.name||'Template',prompt:'',params:null,cost:null,createdAt:it.addedAt};
    }
    return null;
  }
  function openProject(id,name){
    sp.proj={id:id,name:name,items:[]};
    if(typeof window.axGo==='function')window.axGo('project');
    var t=$('spProjTitle'); if(t)t.textContent=name||'Project';
    var m=$('spProjDetMeta'); if(m)m.textContent='Loading…';
    var g=$('spProjGridDet'); if(g)g.innerHTML='';
    api.projectGet(id).then(function(r){
      sp.proj={id:r.id,name:r.name,items:(r.items||[]).map(projItemToCard).filter(Boolean)};
      var tt=$('spProjTitle'); if(tt)tt.textContent=r.name||'Project';
      renderProjectGrid();
    }).catch(function(){ if(m)m.textContent='Could not load this project.'; });
  }
  function renderProjectGrid(){
    var g=$('spProjGridDet'), m=$('spProjDetMeta'); if(!g||!sp.proj)return; g.innerHTML='';
    var items=sp.proj.items;
    if(m)m.textContent=items.length+' items · generations & templates';
    if(!items.length){ g.innerHTML='<div class="sp-empty">Empty project — add results via the folder button on any generation.</div>'; return; }
    var ctx={
      isCEP:IS_CEP,
      list:function(){ return items.filter(function(x){return x&&x.url;}); },
      selecting:function(){ return false; }, isSelected:function(){ return false; }, onToggleSelect:function(){},
      onImport:function(it){ if(it._tpl){ toast('Open the template in Catalog to import its pack','info'); return; } if(typeof aiImportMedia==='function'){ var kind=it.cat==='video'?'video':(it.cat==='audio'||it.cat==='sfx')?'audio':'image'; aiImportMedia(it.url,kind,null); } else toast('Premiere import only works inside Premiere Pro','info'); },
      onDownload:function(it){ try{ var a=document.createElement('a'); a.href=it.downloadUrl||it.url; a.download=window.afGenDlName(it.prompt||it.title,it.url,it.cat); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){} },
      // Loyihada Delete = loyihadan OLIB TASHLASH (gen o'zi o'chmaydi)
      deleteLabel:'Remove from project', // SC_30: menyu bandi haqiqiy amalni aytadi
      onDelete:function(it){ if(!it._itemId)return; api.projectRemoveItem(sp.proj.id,it._itemId).then(function(){ var i=items.indexOf(it); if(i>=0)items.splice(i,1); sp.pLoaded=false; renderProjectGrid(); toast('Removed from project','info'); }).catch(function(){ toast('Remove failed','error'); }); },
      refAllowed:function(){ return false; }, onRef:function(){}
    };
    items.forEach(function(it){ if(window.afRecent&&window.afRecent.card)g.appendChild(window.afRecent.card(it,ctx)); });
  }

  // ── Tugmalar ──
  window.afResetToolSessions=function(){
    try{ if(typeof window.axIGNewSession==='function')window.axIGNewSession(); }catch(e){}
    try{ if(typeof window.axVGNewSession==='function')window.axVGNewSession(); }catch(e){}
    try{ if(typeof window.axAGNewSession==='function')window.axAGNewSession(); }catch(e){}
    sp.sLoaded=false;
  };
  var nb=$('spNewSess'); if(nb)nb.addEventListener('click',function(){
    // Yangi sessiya: tool sessiya keshlari tozalanadi — keyingi gen yangi sessiyada boshlanadi.
    try{ if(typeof window.afResetToolSessions==='function')window.afResetToolSessions(); }catch(e){}
    toast('New session — your next generation starts fresh','success');
    if(typeof window.axGo==='function')window.axGo('imggen');
  });
  var lr=$('spLibRow'); if(lr)lr.addEventListener('click',function(){ if(typeof window.axGo==='function')window.axGo('history'); });
  var np=$('spNewProj'); if(np)np.addEventListener('click',function(){
    window.afNameModal('New project','',function(v){ api.projectCreate(v).then(function(){ sp.pLoaded=false; loadProjects(true); toast('Project created','success'); }).catch(function(e){ toast(afProjErr(e),'error'); }); });
  });
  // P11: Select toggle + bulk bar tugmalari (Sessions + Projects)
  var ssb=$('spSessSelBtn'); if(ssb)ssb.addEventListener('click',function(){ toggleSessSelect(); });
  var ssd=$('spSessBulkDel'); if(ssd)ssd.addEventListener('click',function(){ bulkDeleteSessions(); });
  var ssc=$('spSessBulkCancel'); if(ssc)ssc.addEventListener('click',function(){ toggleSessSelect(false); });
  var psb=$('spProjSelBtn'); if(psb)psb.addEventListener('click',function(){ toggleProjSelect(); });
  var psd=$('spProjBulkDel'); if(psd)psd.addEventListener('click',function(){ bulkDeleteProjects(); });
  var psc=$('spProjBulkCancel'); if(psc)psc.addEventListener('click',function(){ toggleProjSelect(false); });
  // SC_34: Select all / Clear (faqat loyihalar; o'chirish jarayonida qotirilgan)
  var psa=$('spProjBulkAll'); if(psa)psa.addEventListener('click',function(){ if(sp.pBusy)return; sp.pSel={}; sp.projects.forEach(function(p){ sp.pSel[p.id]=1; }); renderProjects(); updProjBulk(); });
  var psn=$('spProjBulkClear'); if(psn)psn.addEventListener('click',function(){ if(sp.pBusy)return; sp.pSel={}; renderProjects(); updProjBulk(); });
  var sr=$('spSessRename'); if(sr)sr.addEventListener('click',function(){
    if(!sp.sess)return;
    window.afNameModal('Rename session',sp.sess.title||'',function(v){ api.sessionRename(sp.sess.id,v).then(function(){ sp.sess.title=v; var t=$('spSessTitle'); if(t)t.textContent=v; sp.sLoaded=false; toast('Renamed','success'); }).catch(function(){ toast('Rename failed','error'); }); });
  });
  var pr=$('spProjRename'); if(pr)pr.addEventListener('click',function(){
    if(!sp.proj)return;
    window.afNameModal('Rename project',sp.proj.name||'',function(v){ api.projectRename(sp.proj.id,v).then(function(){ sp.proj.name=v; var t=$('spProjTitle'); if(t)t.textContent=v; sp.pLoaded=false; toast('Renamed','success'); }).catch(function(){ toast('Rename failed','error'); }); });
  });
  var pd=$('spProjDelete'); if(pd)pd.addEventListener('click',function(){
    if(!sp.proj)return;
    var doDel=function(){ api.projectDelete(sp.proj.id).then(function(){ sp.pLoaded=false; toast('Project deleted','info'); if(typeof window.axGo==='function')window.axGo('projects'); }).catch(function(){ toast('Delete failed','error'); }); };
    if(typeof window.afConfirm==='function')window.afConfirm('Delete "'+(sp.proj.name||'this project')+'"? Items stay in your library.',{ok:'Delete',danger:true}).then(function(ok){ if(ok)doDel(); });
    else if(confirm('Delete this project?'))doDel();
  });

  window.axSPInvalidate=function(){ sp.sLoaded=false; sp.pLoaded=false;
    var vs=document.getElementById('v-sessions'), vp=document.getElementById('v-projects');
    if(vs&&vs.classList.contains('on'))loadSessions(true);
    if(vp&&vp.classList.contains('on'))loadProjects(true);
  };
  window.axSPRefresh=function(view){
    if(view==='sessions')loadSessions(true);
    if(view==='projects')loadProjects(true);
    try{ if(typeof window.afSyncCredits==='function')window.afSyncCredits(); }catch(e){}
    var c1=$('spCredS'),c2=$('spCredP');
    var v=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?(AssetFlowAccount.getCachedUser()||{}).aiCredits:null;
    var t='<span class="cs">✦</span> '+((typeof v==='number')?Number(v).toLocaleString('en-US'):'—');
    if(c1)c1.innerHTML=t; if(c2)c2.innerHTML=t;
  };
  // #R1 — workspace session-strip uchun sessiya ma'lumotini ochamiz (READ only, mavjud handler'lar).
  window.axwsGetSessions=function(){ return (sp.sessions||[]).slice(0,12); };
  window.axwsFindSession=function(id){ var l=sp.sessions||[]; for(var i=0;i<l.length;i++){ if(l[i].id===id)return l[i]; } return null; }; // SC_29: toast View sessiya obyekti
  window.axwsOpenSession=function(s){ if(s)openSession(s); };
  window.axwsEnsureSessions=function(cb){
    if(sp.sLoaded){ if(cb)cb(); return; }
    if(sp.sLoading)return;
    sp.sLoading=true;
    api.sessions().then(function(r){ sp.sessions=(r&&r.items)||[]; sp.sLoaded=true; sp.sLoading=false; if(cb)cb(); })
      .catch(function(){ sp.sLoading=false; if(cb)cb(); });
  };

  // ══ SC_18: SESSION PICKER — gen tool'ning kirish qadami (Director qarori) ══
  // afSessionPicker(mode): shu mode sessiyalari bo'lsa picker; 0 bo'lsa to'g'ridan
  // workspace (auto — sessiya birinchi genda mavjud lazy yo'lda yaratiladi).
  var SPICK_DEST={image:'imggen',video:'vidgen',audio:'audgen'};
  var spickMode=null;
  function spickMatch(mode,s){
    var m=String((s&&s.mode)||'');
    if(mode==='audio')return m==='voice'||m==='sfx'||m==='music'||m==='audio';
    return m===mode;
  }
  function spickEnter(mode,sess){
    // Tool sessiyasini o'rnatish — mavjud setter/reset yo'llari (yangi API yo'q)
    window.__axwsSess=window.__axwsSess||{};
    window.__axwsSess[SPICK_DEST[mode]]=sess||null;
    try{
      if(mode==='image'&&typeof window.axIGSetSession==='function')window.axIGSetSession(sess?sess.id:null);
      if(mode==='video'&&typeof window.axVGSetSession==='function')window.axVGSetSession(sess?sess.id:null);
      if(mode==='audio'&&typeof window.axAGSetSession==='function')window.axAGSetSession(sess?(sess.mode||'voice'):null,sess?sess.id:null);
    }catch(e){}
    if(typeof window.axGo==='function')window.axGo(SPICK_DEST[mode]);
  }
  function renderSpick(mode){
    var l=$('spickList'), meta=$('spickMeta'), ttl=$('spickTitle'); if(!l)return;
    var list=(sp.sessions||[]).filter(function(s){ return spickMatch(mode,s); });
    if(ttl)ttl.textContent=(mode==='image'?'Image':mode==='video'?'Video':'Audio')+' sessions';
    if(meta)meta.textContent=list.length?(list.length+' sessions'):'';
    l.innerHTML='';
    list.forEach(function(s){
      var row=document.createElement('div'); row.className='sp-row';
      var cov=document.createElement('span'); cov.className='sp-cov';
      if(s.coverUrl)cov.style.backgroundImage='url("'+s.coverUrl+'")';
      else cov.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
      row.appendChild(cov);
      var tx=document.createElement('span'); tx.className='sp-tx'; tx.innerHTML='<b></b><small></small>';
      tx.querySelector('b').textContent=(typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(s):(s.title||'Session');
      if(s.title)row.title=s.title; // SC_22: to'liq prompt tooltip'da
      tx.querySelector('small').textContent=(s.count||0)+' generations'+(s.lastAt?(' · '+fmtAgo(s.lastAt)):'');
      row.appendChild(tx);
      rowRenameBtn(row,tx,s,function(){ renderSpick(mode); }); // SC_40: picker qatorida ham inline rename
      row.addEventListener('click',function(){ spickEnter(mode,s); });
      l.appendChild(row);
    });
  }
  window.afSessionPicker=function(mode){
    if(!SPICK_DEST[mode]){ if(typeof window.axGo==='function')window.axGo('launcher'); return; }
    spickMode=mode;
    var decide=function(){
      var list=(sp.sessions||[]).filter(function(s){ return spickMatch(mode,s); });
      if(!list.length){ spickEnter(mode,null); return; } // 0 sessiya → picker o'tkazib yuboriladi (auto)
      renderSpick(mode);
      var cur=document.querySelector('.axroot .view.on');
      if(!cur||cur.id!=='v-spick'){ if(typeof window.axGo==='function')window.axGo('spick'); }
    };
    if(sp.sLoaded){ decide(); return; }
    // Yuklanmoqda: picker "Loading…" bilan ochiladi; ro'yxat kelgach 0 bo'lsa avto-enter
    var l=$('spickList'); if(l)l.innerHTML='<div class="sp-empty">Loading…</div>';
    var ttl=$('spickTitle'); if(ttl)ttl.textContent=(mode==='image'?'Image':mode==='video'?'Video':'Audio')+' sessions';
    if(typeof window.axGo==='function')window.axGo('spick');
    window.axwsEnsureSessions(function(){
      var stillHere=document.querySelector('.axroot .view.on');
      if(stillHere&&stillHere.id==='v-spick')decide();
    });
  };
  var snb=$('spickNew'); if(snb)snb.addEventListener('click',function(){ if(spickMode)spickEnter(spickMode,null); });
})();

/* AF-UPDATER-BEGIN — plagin yangilanish bildirishnomasi (test-updater-security.mjs shu chegaralarni o'qiydi) */
/* ===== P11 / Task 2 — PLAGIN YANGILANISH BILDIRISHNOMASI =====
   Ikki kanal: (1) model/tool/narx = server-driven (reliz kerak emas);
   (2) plagin KODI = GET /api/plugin/version → markaziy modal → installer.

   ⚠️ PANEL O'ZINI O'ZI YANGILAMAYDI. Eski oqim (arxivni ochib, extension papkasi
   ustiga nusxalash) BUTUNLAY OLIB TASHLANDI: Premiere fayllarni band qiladi, papka huquqi yo'q
   bo'lishi mumkin va qisman yozilish panelni buzadi. Yangi oqim:
     1) OS aniqlanadi (faqat mac/win allowlist) va serverdan SHU platformaning
        installeri so'raladi;
     2) artefakt HTTPS'dan chegaralangan vaqtinchalik papkaga yuklab olinadi
        (nom versiyadan quriladi — traversal imkonsiz);
     3) SHA-256 MAJBURIY tekshiriladi (yo'q/mos emas → fayl o'chiriladi, hech narsa
        ishga tushmaydi);
     4) fayl OS installeriga ARGUMENT-MASSIV bilan topshiriladi (shell yo'q):
        mac .pkg → /usr/bin/open (Installer.app), win .msi → msiexec /i, win .exe → o'zi.
   ISHONCH CHEGARASI — OS installeri: u imzoni tekshiradi va kerak bo'lsa ruxsat so'raydi.
   Panel imtiyoz KO'TARMAYDI va Premiere ichida hech narsa o'rnatmaydi.
   Nosozlikda faqat tasdiqlangan installer/yuklab olish sahifasi taklif qilinadi —
   extension papkasini qo'lda almashtirish maslahati BERILMAYDI. */
window.AF_PLUGIN_VERSION="0.1.2"; // CSXS/manifest.xml ExtensionBundleVersion bilan SINXRON tuting (docs/PLUGIN-UPDATE-CHAIN.md)
(function(){
  function $(id){return document.getElementById(id);}
  var IS_CEP=(typeof window.__adobe_cep__!=='undefined');
  function toast(m,k){ if(typeof showToast==='function')showToast(m,k); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  var DOWNLOAD_PAGE='https://getframeflow.app/plugin';
  var MAX_INSTALLER_BYTES=512*1024*1024;   // yuklab olish/tekshirish chegarasi
  // Allowlist — server kontrakti bilan bir xil (apps/api/src/lib/plugin-release-contract.ts).
  var PLATFORMS={
    darwin:{id:'mac',label:'macOS',exts:['pkg']},
    win32:{id:'win',label:'Windows',exts:['exe','msi']}
  };
  var REASON_TEXT={
    unsupported_platform:'Automatic install is supported on macOS and Windows only. Open the download page to get the installer for your system.',
    no_installer:'No installer has been published for your system yet. Open the download page to check for one.',
    platform_mismatch:'The server returned an installer for a different operating system — the download was blocked.',
    bad_extension:'The published file is not a valid installer for your system — the download was blocked.',
    insecure_url:'The update link was not a secure HTTPS link — the download was blocked.',
    missing_checksum:'This update has no SHA-256 checksum, so it cannot be verified — the download was blocked.',
    bad_size:'The published installer size is not valid — the download was blocked.',
    checksum_mismatch:'The downloaded file did not match its SHA-256 checksum. It was deleted and nothing was installed.',
    download_failed:'The download did not finish. Nothing was installed.',
    launch_failed:'The installer could not be opened automatically. Open the download page and run the installer yourself.',
    no_download_engine:'This panel cannot download the installer here. Open the download page and run the installer yourself.'
  };
  var upd={info:null,busy:false,ov:null,tmp:null};

  function dismissKey(v){ return 'af_update_dismissed_'+v; }
  function isDismissed(v){ try{ return localStorage.getItem(dismissKey(v))==='1'; }catch(e){ return false; } }
  function setDismissed(v){ try{ localStorage.setItem(dismissKey(v),'1'); }catch(e){} }

  /* ── Pure yordamchilar (testlar AYNAN shularni chaqiradi — window.__afUpdater) ── */
  function osPlatform(){
    try{ if(typeof require==='function')return String(__ffRequire('os').platform()||''); }catch(e){}
    try{ if(typeof process!=='undefined'&&process&&process.platform)return String(process.platform); }catch(e2){}
    return '';
  }
  function platformInfo(plat){ var k=String(plat==null?'':plat); return Object.prototype.hasOwnProperty.call(PLATFORMS,k)?PLATFORMS[k]:null; }
  function isHttpsUrl(u){ return /^https:\/\/[^\s]+$/i.test(String(u==null?'':u)); }
  function isSha256Hex(s){ return /^[0-9a-fA-F]{64}$/.test(String(s==null?'':s)); }
  /** Diskdagi nom SERVER matnidan EMAS — versiya+kengaytmadan quriladi (traversal/`..` imkonsiz). */
  function safeInstallerName(version,ext){
    var v=String(version==null?'':version).replace(/[^0-9A-Za-z.\-]/g,'');
    var e=String(ext==null?'':ext).replace(/[^A-Za-z0-9]/g,'').toLowerCase();
    return 'frameflow-plugin-'+(v||'update')+'.'+(e||'bin');
  }
  /** Fail-closed: platforma → kengaytma → HTTPS → SHA-256 → hajm. Bittasi yiqilsa hech narsa yuklanmaydi. */
  function validateInstaller(plat,installer){
    var pi=platformInfo(plat);
    if(!pi)return {ok:false,reason:'unsupported_platform'};
    if(!installer)return {ok:false,reason:'no_installer'};
    if(String(installer.platform==null?'':installer.platform)!==pi.id)return {ok:false,reason:'platform_mismatch'};
    var ext=String(installer.ext==null?'':installer.ext).toLowerCase().replace(/^\./,'');
    var okExt=false; for(var i=0;i<pi.exts.length;i++){ if(pi.exts[i]===ext)okExt=true; }
    if(!okExt)return {ok:false,reason:'bad_extension'};
    if(!isHttpsUrl(installer.url))return {ok:false,reason:'insecure_url'};
    if(!isSha256Hex(installer.sha256))return {ok:false,reason:'missing_checksum'};
    var sz=Number(installer.sizeBytes);
    if(!(sz>0)||sz>MAX_INSTALLER_BYTES)return {ok:false,reason:'bad_size'};
    return {ok:true,platform:pi.id,label:pi.label,ext:ext,sizeBytes:sz,sha256:String(installer.sha256).toLowerCase()};
  }
  /** OS'ga topshirish rejasi — FAQAT argument massivi (shell/string interpolatsiya YO'Q). */
  function launchPlan(plat,filePath,ext){
    var p=String(filePath==null?'':filePath);
    var e=String(ext==null?'':ext).toLowerCase().replace(/^\./,'');
    if(!p)return null;
    if(plat==='darwin'&&e==='pkg')return {cmd:'/usr/bin/open',args:[p]};
    if(plat==='win32'&&e==='msi')return {cmd:'msiexec.exe',args:['/i',p]};
    if(plat==='win32'&&e==='exe')return {cmd:p,args:[]};
    return null;
  }
  function reasonText(r){ return REASON_TEXT[String(r==null?'':r)]||'The update could not be installed automatically.'; }
  /** Yuklab olish dvigateli STRICT rejimni (httpsOnly+maxBytes) qo'llab-quvvatlaydimi.
   *  Eski nusxa yonida ishga tushsa — fail-closed: hech narsa yuklanmaydi. */
  function downloadEngineReady(){
    return typeof AssetFlowCatalog!=='undefined'&&!!AssetFlowCatalog.downloadUrlToFile&&AssetFlowCatalog.downloadStrictSupported===true;
  }
  /** MAJBURIY reliz dialogni FAQAT haqiqatan o'rnatib bo'ladigan bo'lsa bloklaydi.
   *  Installer yo'q/yaroqsiz yoki CEP emas — foydalanuvchi qopqonda qolmaydi:
   *  halol xato + Later/yopish/yuklab olish sahifasi (keyingi tekshiruvda yana eslatiladi). */
  function blocksDismissal(info,plat,isCep,engineReady){
    if(!info||!info.mandatory)return false;
    if(!isCep||!engineReady)return false;
    return validateInstaller(plat,info.installer).ok===true;
  }
  /** 'spawn' hodisasi Node 15+ da bor. Eskisida hodisa umuman kelmaydi — o'shanda
   *  qisqa kechikish bilan hal qilamiz (aks holda muvaffaqiyat hech qachon ko'rsatilmaydi). */
  function supportsSpawnEvent(nodeVersion){
    var m=/^(\d+)\./.exec(String(nodeVersion==null?'':nodeVersion));
    return !!m&&parseInt(m[1],10)>=15;
  }
  function nodeVersion(){ try{ return String(process.versions.node||''); }catch(e){ return ''; } }
  /** spawn natijasini BIR MARTA hal qiladi. 'spawn' = bola haqiqatan ishga tushdi
   *  (faqat shundan keyin muvaffaqiyat ko'rsatiladi va temp egaligi OS'ga o'tadi),
   *  'error' = tozalash + launch_failed. Ikki marta hal qilinmaydi. */
  function settleLaunch(ch,useSpawnEvent,onOk,onErr){
    var settled=false;
    function done(fn,a){ if(settled)return; settled=true; try{ fn(a); }catch(e){} }
    ch.on('error',function(err){ done(onErr,err); });
    if(useSpawnEvent){ ch.on('spawn',function(){ done(onOk); }); }
    else { setTimeout(function(){ done(onOk); },500); }
    return function(){ return settled; };
  }
  window.__afUpdater={platformInfo:platformInfo,isHttpsUrl:isHttpsUrl,isSha256Hex:isSha256Hex,
    safeInstallerName:safeInstallerName,validateInstaller:validateInstaller,launchPlan:launchPlan,
    blocksDismissal:blocksDismissal,supportsSpawnEvent:supportsSpawnEvent,settleLaunch:settleLaunch,
    reasonText:reasonText,platforms:PLATFORMS,maxBytes:MAX_INSTALLER_BYTES,downloadPage:DOWNLOAD_PAGE};

  /* ── Vaqtinchalik fayllar (nosozlikda hech narsa qolmaydi) ── */
  function cleanupTmp(){
    var t=upd.tmp; upd.tmp=null; if(!t)return;
    try{
      var fs=__ffRequire('fs');
      try{ fs.unlinkSync(t.file); }catch(e){}
      try{ fs.unlinkSync(t.file+'.part'); }catch(e2){}
      try{ fs.rmdirSync(t.dir); }catch(e3){}
    }catch(e4){}
  }

  function openDownloadPage(){
    try{
      if(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.openExternal){ AssetFlowAccount.openExternal(DOWNLOAD_PAGE); return; }
      window.open(DOWNLOAD_PAGE,'_blank');
    }catch(e){}
  }

  function showUpdateModal(){
    var info=upd.info; if(!info||!info.latest)return;
    if(!upd.ov){ upd.ov=document.createElement('div'); upd.ov.className='afspov'; document.body.appendChild(upd.ov); }
    var mand=!!info.mandatory;
    var v=validateInstaller(osPlatform(),info.installer);
    var canInstall=v.ok&&IS_CEP&&downloadEngineReady();
    // Majburiylik dialogni FAQAT o'rnatish haqiqatan mumkin bo'lganda bloklaydi —
    // imkonsiz yangilanish foydalanuvchini qopqonga solmaydi (halol xato + Later).
    var blocking=blocksDismissal(info,osPlatform(),IS_CEP,downloadEngineReady());
    var notes=String(info.latest.releaseNotes||'').split('\n').slice(0,10).map(function(l){ return '<div style="font-size:11px;color:var(--mut);line-height:1.5">• '+esc(l)+'</div>'; }).join('');
    // Halol kutish: installer OS tomonidan ochiladi, ruxsat so'ralishi mumkin, Premiere qayta ishga tushadi.
    var note=canInstall
      ? 'The installer opens outside Premiere Pro. Your system may ask you to approve it, and Premiere Pro must be restarted when it finishes.'
      : reasonText(v.ok?'no_download_engine':v.reason);
    upd.ov.innerHTML='<div class="spc">'
      +'<div class="sph"><b>FrameFlow v'+esc(info.latest.version)+' available</b>'+(blocking?'':'<span class="x" id="afUpdX">✕</span>')+'</div>'
      +'<div style="font-size:11px;color:var(--mut2);margin:-4px 0 8px">You have v'+esc(window.AF_PLUGIN_VERSION)+(mand?' — this update is required to continue':'')+'</div>'
      +(notes?('<div class="spl" style="margin-bottom:6px">'+notes+'</div>'):'')
      +'<div style="font-size:10.5px;color:var(--mut2);line-height:1.5;margin-bottom:6px">'+esc(note)+'</div>'
      +'<div id="afUpdStatus" style="font-size:10.5px;color:var(--mut2);min-height:14px"></div>'
      +'<div class="spb">'
      +(blocking?'':'<div role="button" tabindex="0" type="button" class="spbtn" id="afUpdLater">Later</div>')
      +(canInstall
        ?'<div role="button" tabindex="0" type="button" class="spbtn pri" id="afUpdGo">Download &amp; install</div>'
        :'<div role="button" tabindex="0" type="button" class="spbtn pri" id="afUpdPage">Open download page</div>')
      +'</div></div>';
    upd.ov.classList.add('on');
    if(!blocking){
      // Majburiy-lekin-imkonsiz holatda ham yopiladi; `setDismissed` mandatory relizni
      // jimlatmaydi (checkForUpdate mandatory'da dismiss'ga qaramaydi) — keyin yana eslatiladi.
      var x=$('afUpdX'); if(x)x.addEventListener('click',function(){ upd.ov.classList.remove('on'); setDismissed(info.latest.version); });
      var lt=$('afUpdLater'); if(lt)lt.addEventListener('click',function(){ upd.ov.classList.remove('on'); setDismissed(info.latest.version); });
    }
    var go=$('afUpdGo'); if(go)go.addEventListener('click',doUpdate);
    var pg=$('afUpdPage'); if(pg)pg.addEventListener('click',openDownloadPage);
  }
  function setUpdStatus(t){ var el=$('afUpdStatus'); if(el)el.textContent=t; }

  /** Yakuniy ekranlar — extension papkasini qo'lda almashtirish HECH QACHON taklif qilinmaydi. */
  function showBlocked(reason){
    upd.busy=false;
    setUpdStatus(reasonText(reason));
    var go=$('afUpdGo');
    if(go){ go.textContent='Open download page'; go.removeAttribute('id'); go.id='afUpdPage2'; go.addEventListener('click',openDownloadPage); }
    toast('Update not installed — download page available','warning');
  }
  function showHandedOff(v){
    upd.busy=false;
    if(!upd.ov)return;
    upd.ov.innerHTML='<div class="spc"><div class="sph"><b>Installer opened</b></div>'
      +'<div style="font-size:11.5px;color:var(--mut);line-height:1.6">The FrameFlow '+esc(v.label)+' installer is now running outside Premiere Pro. '
      +'Your system may ask you to approve it. When it finishes, quit Premiere Pro completely and open it again — this panel keeps running v'+esc(window.AF_PLUGIN_VERSION)+' until you do.</div>'
      +'<div class="spb"><div role="button" tabindex="0" type="button" class="spbtn" id="afUpdPage3">Download page</div>'
      +'<div role="button" tabindex="0" type="button" class="spbtn pri" id="afUpdDone">Got it</div></div></div>';
    var dn=$('afUpdDone'); if(dn)dn.addEventListener('click',function(){ upd.ov.classList.remove('on'); });
    var pg=$('afUpdPage3'); if(pg)pg.addEventListener('click',openDownloadPage);
    toast('Installer opened — restart Premiere Pro when it finishes','info');
  }

  function doUpdate(){
    var info=upd.info; if(!info||upd.busy)return;
    var plat=osPlatform();
    var v=validateInstaller(plat,info.installer);
    if(!v.ok){ showBlocked(v.reason); return; }
    if(!IS_CEP){ showBlocked('no_download_engine'); return; }
    var fs,path,os,child,crypto;
    try{ fs=__ffRequire('fs'); path=__ffRequire('path'); os=__ffRequire('os'); child=__ffRequire('child_process'); crypto=__ffRequire('crypto'); }
    catch(e){ showBlocked('no_download_engine'); return; }
    if(!downloadEngineReady()){ showBlocked('no_download_engine'); return; }
    // Chegaralangan, noyob vaqtinchalik papka — extension papkasiga HECH QACHON yozilmaydi.
    var dir='';
    try{ dir=fs.mkdtempSync(path.join(os.tmpdir(),'frameflow-update-')); }catch(e2){ showBlocked('download_failed'); return; }
    var name=safeInstallerName(info.latest?info.latest.version:'',v.ext);
    var file=path.join(dir,name);
    upd.tmp={dir:dir,file:file};
    if(path.dirname(file)!==dir){ cleanupTmp(); showBlocked('download_failed'); return; } // qo'shimcha traversal to'sig'i
    upd.busy=true;
    setUpdStatus('Downloading the '+v.label+' installer…');
    // STRICT: boshlang'ich URL ham, har bir redirect ham https bo'lishi shart (downgrade
    // = uzish) va oqim 512 MiB'dan oshsa darhol uziladi — qisman fayl o'chiriladi.
    AssetFlowCatalog.downloadUrlToFile(info.installer.url,file,function(done,total){
      if(total>0)setUpdStatus('Downloading… '+Math.floor(done/total*100)+'%');
    },null,{httpsOnly:true,maxBytes:MAX_INSTALLER_BYTES}).then(function(){
      setUpdStatus('Verifying SHA-256…');
      var st=null; try{ st=fs.statSync(file); }catch(e3){ st=null; }
      if(!st||!(st.size>0)||st.size>MAX_INSTALLER_BYTES){ cleanupTmp(); showBlocked('download_failed'); return; }
      // Oqim bilan hash — 500MB fayl xotiraga olinmaydi.
      var h=crypto.createHash('sha256');
      var rs=fs.createReadStream(file);
      rs.on('error',function(){ cleanupTmp(); showBlocked('download_failed'); });
      rs.on('data',function(c){ h.update(c); });
      rs.on('end',function(){
        var got=String(h.digest('hex')).toLowerCase();
        if(got!==v.sha256){ cleanupTmp(); showBlocked('checksum_mismatch'); return; }
        launchInstaller(child,plat,file,v);
      });
    }).catch(function(e4){
      console.error('[update] download',e4);
      cleanupTmp(); showBlocked('download_failed');
    });
  }

  /** Faylni OS'ga topshiradi — argument massivi, shell YO'Q, imtiyoz KO'TARILMAYDI.
   *  Muvaffaqiyat FAQAT bola haqiqatan ishga tushgach ('spawn') ko'rsatiladi: spawn xatosi
   *  ASINXRON keladi, shu bois darhol "ochildi" deyish yolg'on bo'lardi va temp fayl
   *  egasiz qolardi. 'error' → tozalash + halol launch_failed. Ikki marta hal qilinmaydi. */
  function launchInstaller(child,plat,file,v){
    var plan=launchPlan(plat,file,v.ext);
    if(!plan){ cleanupTmp(); showBlocked('bad_extension'); return; }
    setUpdStatus('Opening the installer…');
    try{
      var ch=child.spawn(plan.cmd,plan.args,{detached:true,stdio:'ignore'});
      settleLaunch(ch,supportsSpawnEvent(nodeVersion()),function(){
        upd.tmp=null; // fayl endi OS installeriga kerak — o'chirmaymiz (OS temp tozalaydi)
        try{ ch.unref(); }catch(e2){}
        showHandedOff(v);
      },function(err){
        console.error('[update] launch',err);
        cleanupTmp(); showBlocked('launch_failed');
      });
    }catch(e){
      console.error('[update] launch',e);
      cleanupTmp(); showBlocked('launch_failed');
    }
  }

  function platformQuery(){ var pi=platformInfo(osPlatform()); return pi?('&platform='+encodeURIComponent(pi.id)):''; }

  function checkForUpdate(silent){
    pubFetch('/api/plugin/version?app=pr&current='+encodeURIComponent(window.AF_PLUGIN_VERSION)+platformQuery(),{headers:{Accept:'application/json'}},15000)
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(!d||!d.updateAvailable)return;
        upd.info=d;
        // Majburiy bo'lmagan reliz foydalanuvchi tomonidan yopilgan bo'lsa — qayta bezovta qilmaymiz
        if(!d.mandatory&&isDismissed(d.latest.version)){ if(!silent)toast('Update v'+d.latest.version+' available — Settings → Update','info'); return; }
        showUpdateModal();
      })
      .catch(function(){ /* offline — jim */ });
  }
  window.afCheckForUpdate=function(){ if(upd.info&&upd.info.updateAvailable){ showUpdateModal(); } else { toast('Checking for updates…','info'); checkForUpdate(false); setTimeout(function(){ if(!upd.info||!upd.info.updateAvailable)toast('You are on the latest version (v'+window.AF_PLUGIN_VERSION+')','success'); },2500); } };

  setTimeout(function(){ checkForUpdate(true); },4000);           // panel ochilgach
  setInterval(function(){ checkForUpdate(true); },6*60*60*1000);  // har 6 soatda
})();
/* AF-UPDATER-END */

/* ============================================================
   #R1 — AI Studio workspace chrome (session-strip / viewbar / stage empty-hero / mode popover).
   MAVJUD handler'lar va id'larni QAYTA SIMLAYDI — hech qanday yangi API chaqiruvi yo'q.
   ES5-safe (CEP Premiere 2022+). ============================================================ */
(function(){
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function toast(m,k){ if(typeof showToast==='function')showToast(m,k); }
  // View konfiguratsiyalari — har composer view uchun workspace element id'lari.
  var VIEWS={
    imggen:{v:'imggen',mode:'image',sub:'Image mode',strip:'igStrip',tabVis:'igTabVis',tabAud:'igTabAud',visCt:'igTabVisCt',audCt:'igTabAudCt',meta:'igViewT',subEl:'igViewS',recent:'igRecent',res:'igRes',empty:'igEmpty',density:'igDensity',modePop:'igModePop'},
    vidgen:{v:'vidgen',mode:'video',sub:'Video mode',strip:'vgStrip',tabVis:'vgTabVis',tabAud:'vgTabAud',visCt:'vgTabVisCt',audCt:'vgTabAudCt',meta:'vgViewT',subEl:'vgViewS',recent:'vgRecent',res:'vgRes',empty:'vgEmpty',density:'vgDensity',modePop:'vgModePop'},
    audgen:{v:'audgen',mode:'audio',sub:'Audio mode',strip:'agStrip',tabVis:'agTabVis',tabAud:'agTabAud',visCt:'agTabVisCt',audCt:'agTabAudCt',meta:'agViewT',subEl:'agViewS',recent:'agRecent',res:'agRes',empty:'agEmpty',density:'agDensity',modePop:'agModePop'}
  };
  var observed={}; // recent grid MutationObserver'lar (view kaliti bilan)

  function recentCount(cfg){ var r=$(cfg.recent); return r?r.querySelectorAll('.rc').length:0; }
  function refreshViewbar(cfg){
    var isAud=(cfg.mode==='audio');
    var tv=$(cfg.tabVis), ta=$(cfg.tabAud);
    if(tv)tv.className='axws-tab'+(isAud?'':' active');
    if(ta)ta.className='axws-tab'+(isAud?' active':'');
    // SC_29: ikkala tab sanog'i ham FAOL SESSIYA elementlaridan (tool hook: visual=image+video,
    // audio=voice+sfx+music); hook yo'q bo'lsa DOM karta soni fallback.
    var n=recentCount(cfg);
    var cn=null; try{ if(window.__axwsCounts&&window.__axwsCounts[cfg.v])cn=window.__axwsCounts[cfg.v](); }catch(e){}
    var vis=cn?cn.vis:(isAud?0:n), aud=cn?cn.aud:(isAud?n:0);
    var vc=$(cfg.visCt), ac=$(cfg.audCt);
    if(vc)vc.textContent=vis;
    if(ac)ac.textContent=aud;
    // SC_18: header meta — sessiya NOMI + kichik "mode · N generations" (chip-strip o'rniga)
    var mt=$(cfg.meta), ms=$(cfg.subEl);
    var sess=(window.__axwsSess||{})[cfg.v]||null;
    var sname=sess?((typeof window.afSessionDisplayName==='function')?window.afSessionDisplayName(sess):(sess.title||'Session')):'New session';
    if(mt)mt.textContent=sname;
    var n2=isAud?aud:vis;
    // SC_46: sessiya yuklanayotganda "0 generations" FLASH qilmaydi — "loading…" (yoki picker'dan ma'lum son).
    var _ld=window.__axwsLoading&&window.__axwsLoading[cfg.v];
    if(ms){
      if(n2>0)ms.textContent=cfg.mode+' · '+n2+' generation'+(n2===1?'':'s');
      else if(_ld)ms.textContent=cfg.mode+' · loading…';
      else ms.textContent=cfg.mode+' · '+n2+' generation'+(n2===1?'':'s'); // READY-EMPTY → "0 generations" (to'g'ri)
    }
  }
  function syncEmpty(cfg){
    // SC_41 PART B: axws-empty hero o'chirildi — endi faqat header meta yangilanadi.
    // Bo'sh sessiya feed maydonida hech narsa ko'rsatilmaydi (Recent header ham renderRecentGrid'da yashiriladi).
    var emp=$(cfg.empty); if(emp)emp.style.display='none';
    refreshViewbar(cfg);
  }
  function ensureObserver(cfg){
    if(observed[cfg.v])return;
    var r=$(cfg.recent); if(!r||typeof MutationObserver==='undefined')return;
    var mo=new MutationObserver(function(){ syncEmpty(cfg); });
    mo.observe(r,{childList:true,subtree:false});
    var res=$(cfg.res); if(res)mo.observe(res,{attributes:true,attributeFilter:['class']});
    observed[cfg.v]=mo;
  }
  // SC_18: renderStrip (session chip-strip) O'CHIRILDI — sessiya almashish faqat
  // back → session picker orqali (bitta mental model). My Library/Projects o'z
  // joylarida (top-bar / launcher).
  function closePops(){ var ps=document.querySelectorAll('.axws-pop.open'); for(var i=0;i<ps.length;i++)ps[i].classList.remove('open'); var mb=document.querySelectorAll('.axws-more.on'); for(var j=0;j<mb.length;j++)mb[j].classList.remove('on'); } // SC_36: ⋯ tugma holatini ham tozalaydi
  // SC_56: `keep`'dan boshqa barcha popover'larni yop. ⋯ overflow ichidan bir chip (mode) o'z popoverini
  // ochganda ⋯ popoverini OCHIQ qoldirish uchun (aks holda ⋯ yopilib, chip'ning ankeri yo'qolardi).
  function closePopsExcept(keep){ var ps=document.querySelectorAll('.axws-pop.open'); for(var i=0;i<ps.length;i++){ if(ps[i]!==keep)ps[i].classList.remove('open'); } var mb=document.querySelectorAll('.axws-more.on'); for(var j=0;j<mb.length;j++)mb[j].classList.remove('on'); }

  // go() dan chaqiriladi — active composer view'ini sozlaydi.
  window.axwsAfterView=function(id){
    closePops();
    // Composer view'lari uchun shared .scroll'ni qat'iy flex-ustun rejimiga o'tkazamiz (dock pinlanadi).
    var ax=document.querySelector('.axroot'); if(ax)ax.classList.toggle('axws-tool',!!VIEWS[id]);
    var ap=document.getElementById('aiPage'); if(ap)ap.classList.toggle('axws-tool',!!VIEWS[id]); // #R1-FIX: balandlik zanjiri #aiPage'dan boshlanadi (scroll-area bounded)
    var cfg=VIEWS[id]; if(!cfg)return;
    ensureObserver(cfg);
    syncEmpty(cfg);
    try{ if(window.axwsScheduleFit)window.axwsScheduleFit(); }catch(e){} // SC_54: yangi ko'rinadigan kompozer qatorini bir qatorga moslash
  };

  // ── Delegatsiyalangan hodisalar (re-parent'ga chidamli) ──
  document.addEventListener('click',function(e){
    var t=e.target;
    // mode popover ochish/yopish
    var mp=t.closest&&t.closest('[data-modepop]');
    if(mp){ var wrap=mp.parentNode, pop=wrap&&wrap.querySelector('.axws-pop'); if(pop){ var was=pop.classList.contains('open'); closePopsExcept(mp.closest('.axws-ovfpop')); if(!was)pop.classList.add('open'); } e.stopPropagation(); return; }
    // SC_36: viewbar ⋯ menyu ochish/yopish
    var wm=t.closest&&t.closest('[data-wsmenu]');
    if(wm){ var wr=wm.parentNode, wp=wr&&wr.querySelector('.axws-pop'); var wo=wp&&wp.classList.contains('open'); closePops(); if(wp&&!wo){ wp.classList.add('open'); wm.classList.add('on'); } e.stopPropagation(); return; }
    // SC_36: ⋯ menyu ichidagi amal bosildi → menyuni yop (amalning o'z handleri/onclick alohida ishlaydi).
    // Density ([data-dense]) bu bandga TUSHMAYDI — u pastdagi maxsus shoxда ishlanadi (menyu ochiq qoladi).
    var wmi=t.closest&&t.closest('.axws-menu .axws-mi');
    if(wmi&&!(t.closest&&t.closest('[data-dense]'))){ closePops(); /* return YO'Q — id-bindingли handler shu bosishда ishlaydi */ }
    // mode tanlash
    var mr=t.closest&&t.closest('[data-mode]');
    if(mr){ var m=mr.getAttribute('data-mode'); closePops();
      if(m==='image'){ if(window.axGo)window.axGo('imggen'); }
      else if(m==='video'){ if(window.axGo)window.axGo('vidgen'); }
      else if(m==='voice'){ if(window.axGo)window.axGo('audgen'); setTimeout(function(){ var b=$('agModeVoice'); if(b)b.click(); },30); }
      else if(m==='sfx'){ if(window.axGo)window.axGo('audgen'); setTimeout(function(){ var b=$('agModeSfx'); if(b)b.click(); },30); }
      // SC_17: 'upscale' mode olib tashlandi (funksiya butunlay o'chirildi)
      return; }
    // SC_18: session-strip tugmalari ([data-axws]) o'chirildi — strip yo'q.
    // zichlik (density) — SC_18: bitta ixcham toggle (2× ↔ 1×)
    var db=t.closest&&t.closest('[data-dense]');
    if(db){ var host3=db.parentNode, cfg3=cfgByDensity(host3); if(cfg3){ var r=$(cfg3.recent); if(r){ r.classList.toggle('dense1'); db.classList.toggle('active',r.classList.contains('dense1')); } } return; }
    // SC_41 PART B: suggestion-chip handler O'CHIRILDI (axws-sugg heroes deleted).
    // popover tashqarisiga bosilsa yopamiz
    if(!(t.closest&&t.closest('.axws-pop')))closePops();
  },false);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'||e.keyCode===27)closePops(); },false);

  function curCfg(){ for(var k in VIEWS){ var v=$('v-'+k); if(v&&v.classList.contains('on'))return VIEWS[k]; } return null; }
  function cfgByDensity(host){ for(var k in VIEWS){ if(VIEWS[k].density&&$(VIEWS[k].density)===host)return VIEWS[k]; } return null; }
})();


/* ═══ FFCMS v2 · Admin vizual muharrir ko'prigi (?ffcms=1) ═══
   Plagin paneli admin ichida iframe'da ochilganda ishlaydi (platformadagi bilan
   AYNI protokol). Premiere ichida ?ffcms yo'q — bu kod umuman uxlaydi va bitta ham
   hodisa tinglovchisi qo'shilmaydi. */
(function () {
  var qs; try { qs = location.search || ''; } catch (e) { return; }
  if (!/[?&]ffcms/.test(qs)) return;
  var ALLOW = ['https://admin.getframeflow.app', 'https://getframeflow.app', 'http://localhost:3001', 'http://localhost:3000'];
  try { if (location.origin && ALLOW.indexOf(location.origin) < 0) ALLOW.push(location.origin); } catch (e) {}
  var parentOrigin = null, device = 'desktop', cfgStyles = {};
  var hovered = null, selected = null, selPath = '', editing = null, dragging = null, armed = true;

  /* Muharrir preview'ida panel toast'lari SHOVQIN: admin brauzerida plagin
     sessiyasi yo'q, shu sabab "Session expired" / tarmoq xatolari ustma-ust
     chiqib kontentni to'sardi. CMS bildirishnomalari (afCmsNotices) alohida
     qatlamda — ular ko'rinishda qoladi. */
  try { window.showToast = function () {}; } catch (e) {}

  var st = document.createElement('style');
  st.textContent =
    '[data-ffcms-hover]{outline:2px dashed #d8ff3e!important;outline-offset:2px;cursor:pointer!important}' +
    '#ffcmsChip{position:fixed;z-index:2147483647;background:#d8ff3e;color:#0a0d02;font:700 10px/1 ui-monospace,monospace;padding:5px 9px;border-radius:7px;pointer-events:none;display:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}' +
    '#ffcmsBox{position:fixed;z-index:2147483644;display:none;pointer-events:none;border:2px solid #7CC4FF;border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.35)}' +
    '#ffcmsBox b{position:absolute;right:-6px;bottom:-6px;width:13px;height:13px;border-radius:3px;background:#7CC4FF;border:2px solid #08131f;pointer-events:auto;cursor:nwse-resize}' +
    '#ffcmsBar{position:fixed;z-index:2147483646;display:none;align-items:center;gap:2px;padding:4px;border-radius:10px;background:#11141a;border:1px solid rgba(255,255,255,.16);box-shadow:0 12px 32px rgba(0,0,0,.55);font:600 11px/1 ui-sans-serif,system-ui,sans-serif}' +
    '#ffcmsBar button{all:unset;box-sizing:border-box;min-width:26px;height:24px;padding:0 6px;display:grid;place-items:center;border-radius:6px;color:#e6ebf2;cursor:pointer;font:600 11px/1 ui-sans-serif,system-ui,sans-serif}' +
    '#ffcmsBar button:hover{background:rgba(255,255,255,.12)}' +
    '#ffcmsBar i.sep{width:1px;height:15px;background:rgba(255,255,255,.14);margin:0 3px}' +
    '#ffcmsBar span.lbl{color:#8c97a8;font:600 10px/1 ui-monospace,monospace;padding:0 6px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '[data-ffcms-edit]{outline:2px solid #d8ff3e!important;outline-offset:2px;cursor:text!important}';
  document.head.appendChild(st);

  var chip = document.createElement('div'); chip.id = 'ffcmsChip';
  var box = document.createElement('div'); box.id = 'ffcmsBox';
  var hnd = document.createElement('b'); box.appendChild(hnd);
  var bar = document.createElement('div'); bar.id = 'ffcmsBar';
  var BTNS = [
    ['up', '↑', 'Ota elementni tanlash'], ['sep', '', ''],
    ['edit', '✎', 'Joyida matnni tahrirlash'], ['sep', '', ''],
    ['fs-', 'A−', 'Shriftni kichraytirish'], ['fs+', 'A+', 'Shriftni kattalashtirish'],
    ['fw-', 'W−', 'Yupqaroq'], ['fw+', 'W+', 'Qalinroq'], ['sep', '', ''],
    ['al', '⇤', 'Chapga'], ['ac', '↔', 'Markazga'], ['ar', '⇥', "O'ngga"], ['sep', '', ''],
    ['sc-', '−', 'Kichraytirish'], ['sc+', '+', 'Kattalashtirish'], ['sep', '', ''],
    ['hide', '👁', "Yashirish / ko'rsatish"], ['reset', '↺', 'Uslubni tiklash'],
  ];
  BTNS.forEach(function (b) {
    if (b[0] === 'sep') { var i = document.createElement('i'); i.className = 'sep'; bar.appendChild(i); return; }
    var el = document.createElement('button');
    el.textContent = b[1]; el.title = b[2]; el.setAttribute('data-act', b[0]);
    bar.appendChild(el);
  });
  var lbl = document.createElement('span'); lbl.className = 'lbl'; bar.appendChild(lbl);
  function mount() { if (!document.body) return; [chip, box, bar].forEach(function (n) { if (!n.parentNode) document.body.appendChild(n); }); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);


  /* ── Plagin qarshiliklari: draft qo'llash + ekran almashish ─────────────── */
  function applyDraft(cfg) {
    try {
      __afCms.cfg = cfg;
      if (typeof afCmsApply === 'function') afCmsApply();
      if (typeof afCmsStamp === 'function') afCmsStamp();
      if (typeof afCmsApplyUi === 'function') afCmsApplyUi(cfg.uiStyles);
      if (typeof afCmsNotices === 'function') afCmsNotices(cfg.notices);
    } catch (e) { try { console.warn('[ffcms] draft:', e); } catch (_) {} }
  }
  /* Mehmon ekrani real login holatiga bog'liq — previewda uni majburan
     ko'rsatamiz/yashiramiz (faqat iframe ichida, Premiere'da bu kod ishlamaydi). */
  function forceGuest(on) {
    var main = document.getElementById('homeMain'), guest = document.getElementById('homeGuest');
    if (main) main.style.display = on ? 'none' : '';
    if (guest) guest.style.display = on ? '' : 'none';
    if (on && typeof renderHomeGuest === 'function') { try { renderHomeGuest(); } catch (e) {} }
  }
  var __scr = 'home';
  function curScreen() { return __scr; }
  function gotoScreen(s) {
    __scr = s;
    try {
      if (s === 'guest') { if (typeof afNavTab === 'function') afNavTab('home'); forceGuest(true); }
      else { forceGuest(false); if (typeof afNavTab === 'function') afNavTab(s === 'ai' ? 'ai' : (s === 'catalog' ? 'catalog' : 'home')); }
    } catch (e) {}
    setTimeout(function () { if (typeof afCmsStamp === 'function') afCmsStamp(); }, 200);
  }

  function target(el) { return el && el.closest ? el.closest('[data-cms],[data-cms-text]') : null; }
  function keyOf(el) { return el ? (el.getAttribute('data-cms-text') || el.getAttribute('data-cms') || '') : ''; }
  function findByKey(k) { try { return document.querySelector('[data-cms-text="' + k + '"]') || document.querySelector('[data-cms="' + k + '"]'); } catch (e) { return null; } }
  function post(msg) { if (parentOrigin) try { parent.postMessage(msg, parentOrigin); } catch (e) {} }
  function styleOf(k) { var e = cfgStyles[k] || {}; return e[device === 'mobile' ? 'm' : 'd'] || {}; }
  function curNum(k, prop, fb) { var v = styleOf(k)[prop]; return (typeof v === 'number' && isFinite(v)) ? v : fb; }
  function sendPatch(patch) {
    if (!selPath) return;
    var e = cfgStyles[selPath] || (cfgStyles[selPath] = {});
    var slot = device === 'mobile' ? 'm' : 'd';
    e[slot] = Object.assign({}, e[slot] || {}, patch);
    post({ type: 'ffcms-style', path: selPath, device: device, patch: patch });
  }

  function selectEl(t, notify) {
    selected = t; selPath = keyOf(t);
    lbl.textContent = selPath;
    place();
    if (notify !== false) post({
      type: 'ffcms-select', path: selPath,
      textPath: t ? (t.getAttribute('data-cms-text') || '') : '',
      groupPath: t ? (t.getAttribute('data-cms') || '') : '',
      text: t ? (t.textContent || '').trim().slice(0, 200) : '',
      style: styleOf(selPath),
    });
  }
  function place() {
    if (selected && !selected.isConnected) { var re = findByKey(selPath); if (re) selected = re; }
    if (!selected || !selected.isConnected) { box.style.display = 'none'; bar.style.display = 'none'; return; }
    var r = selected.getBoundingClientRect();
    if (!r.width && !r.height) { box.style.display = 'none'; bar.style.display = 'none'; return; }
    box.style.display = 'block'; bar.style.display = 'flex';
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    var bw = bar.offsetWidth || 340;
    var bt = r.top - 32; if (bt < 6) bt = Math.min(r.bottom + 8, innerHeight - 34);
    bar.style.top = bt + 'px';
    bar.style.left = Math.max(6, Math.min(r.left, innerWidth - bw - 8)) + 'px';
  }
  /* FFCMS frame loop UXP portida o'chirilgan. */

  // ── hover ────────────────────────────────────────────────────────────────
  document.addEventListener('mousemove', function (ev) {
    if (!armed || dragging || editing) return;
    var t = target(ev.target);
    if (t !== hovered) {
      if (hovered) hovered.removeAttribute('data-ffcms-hover');
      hovered = t;
      if (t) { t.setAttribute('data-ffcms-hover', ''); chip.textContent = keyOf(t); chip.style.display = 'block'; }
      else chip.style.display = 'none';
    }
    if (t) { chip.style.left = (ev.clientX + 14) + 'px'; chip.style.top = (ev.clientY + 16) + 'px'; }
  }, true);

  // ── asboblar paneli ──────────────────────────────────────────────────────
  bar.addEventListener('mousedown', function (ev) { ev.preventDefault(); ev.stopPropagation(); }, true);
  bar.addEventListener('click', function (ev) {
    ev.preventDefault(); ev.stopPropagation();
    var b = ev.target.closest ? ev.target.closest('button[data-act]') : null;
    if (!b || !selected) return;
    var a = b.getAttribute('data-act');
    if (a === 'up') {
      var par = selected.parentElement && selected.parentElement.closest ? selected.parentElement.closest('[data-cms],[data-cms-text]') : null;
      if (par) selectEl(par);
      return;
    }
    if (a === 'edit') { startEdit(); return; }
    if (a === 'reset') { cfgStyles[selPath] = {}; post({ type: 'ffcms-style', path: selPath, device: device, patch: null }); return; }
    if (a === 'hide') { sendPatch({ hidden: !styleOf(selPath).hidden }); return; }
    if (a === 'al' || a === 'ac' || a === 'ar') {
      /* Platformadagi bilan AYNI: matn + qutining o'zi birga tekislanadi. */
      var av = a === 'al' ? 'left' : (a === 'ac' ? 'center' : 'right');
      sendPatch({ textAlign: av, blockAlign: av });
      if (getComputedStyle(selected).display.indexOf('inline') === 0) post({ type: 'ffcms-toast', text: 'Bu element satr ichida (inline) — qutini surish uchun ⬆ bilan ota blokni tanlang' });
      return;
    }
    if (a === 'fs-' || a === 'fs+') {
      var base = curNum(selPath, 'fontSize', Math.round(parseFloat(getComputedStyle(selected).fontSize) || 16));
      var step = base > 40 ? 3 : (base > 20 ? 2 : 1);
      sendPatch({ fontSize: Math.max(8, Math.min(200, base + (a === 'fs+' ? step : -step))) });
      return;
    }
    if (a === 'fw-' || a === 'fw+') {
      var w = curNum(selPath, 'fontWeight', Math.round((parseFloat(getComputedStyle(selected).fontWeight) || 400) / 100) * 100);
      sendPatch({ fontWeight: Math.max(100, Math.min(900, w + (a === 'fw+' ? 100 : -100))) });
      return;
    }
    if (a === 'sc-' || a === 'sc+') {
      var sc = curNum(selPath, 'scale', 1);
      sendPatch({ scale: +Math.max(0.4, Math.min(2.5, sc + (a === 'sc+' ? 0.05 : -0.05))).toFixed(3) });
      return;
    }
  }, true);

  // ── joyida matn tahriri ──────────────────────────────────────────────────
  function startEdit() {
    var el = selected; if (!el) return;
    var tp = el.getAttribute('data-cms-text');
    if (!tp) { post({ type: 'ffcms-toast', text: "Bu element matn tuguni emas — o'ng paneldan tahrirlang" }); return; }
    editing = { el: el, path: tp };
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('data-ffcms-edit', '');
    el.focus();
    try { var r = document.createRange(); r.selectNodeContents(el); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } catch (e) {}
    post({ type: 'ffcms-editing', on: true, path: tp });
  }
  function commitEdit(cancel) {
    if (!editing) return;
    var e = editing; editing = null;
    var v = (e.el.textContent || '').replace(/\s+/g, ' ').trim();
    e.el.removeAttribute('contenteditable'); e.el.removeAttribute('data-ffcms-edit');
    post({ type: 'ffcms-editing', on: false, path: e.path });
    if (!cancel) post({ type: 'ffcms-text', path: e.path, value: v });
  }
  document.addEventListener('input', function () {
    if (!editing) return;
    post({ type: 'ffcms-text-live', path: editing.path, value: (editing.el.textContent || '').replace(/\s+/g, ' ').trim() });
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (editing) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commitEdit(false); }
      else if (ev.key === 'Escape') { ev.preventDefault(); commitEdit(true); }
      return;
    }
    if (!selected) return;
    if (ev.key === 'Escape') { selected = null; selPath = ''; box.style.display = 'none'; bar.style.display = 'none'; post({ type: 'ffcms-select', path: '' }); return; }
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (d) {
      ev.preventDefault();
      var step = ev.shiftKey ? 10 : 1;
      sendPatch({ offsetX: Math.round(curNum(selPath, 'offsetX', 0) + d[0] * step), offsetY: Math.round(curNum(selPath, 'offsetY', 0) + d[1] * step) });
    }
  }, true);

  // ── tanlash + sudrash ────────────────────────────────────────────────────
  document.addEventListener('mousedown', function (ev) {
    if (!armed) return;
    if (bar.contains(ev.target)) return;
    if (editing) { if (editing.el.contains(ev.target)) return; commitEdit(false); }
    var onHandle = ev.target === hnd;
    var t = onHandle ? selected : target(ev.target);
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    if (t !== selected) selectEl(t);
    var k = keyOf(t);
    dragging = {
      el: t, mode: onHandle ? 'scale' : 'move', x0: ev.clientX, y0: ev.clientY, moved: false,
      bx: curNum(k, 'offsetX', 0), by: curNum(k, 'offsetY', 0), bs: curNum(k, 'scale', 1),
      inline: t.getAttribute('style'),
    };
  }, true);
  document.addEventListener('mousemove', function (ev) {
    if (!dragging) return;
    var dx = ev.clientX - dragging.x0, dy = ev.clientY - dragging.y0;
    if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    dragging.moved = true;
    var tf;
    if (dragging.mode === 'move') {
      dragging.cx = Math.round(dragging.bx + dx); dragging.cy = Math.round(dragging.by + dy);
      tf = 'translate(' + dragging.cx + 'px,' + dragging.cy + 'px)' + (dragging.bs !== 1 ? ' scale(' + dragging.bs + ')' : '');
    } else {
      dragging.cs = +Math.max(0.4, Math.min(2.5, dragging.bs + (dx + dy) / 320)).toFixed(3);
      tf = 'translate(' + dragging.bx + 'px,' + dragging.by + 'px) scale(' + dragging.cs + ')';
    }
    dragging.el.style.setProperty('transform', tf, 'important');
    dragging.el.style.setProperty('transform-origin', 'center center', 'important');
    place();
  }, true);
  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    var d = dragging; dragging = null;
    if (d.inline == null) d.el.removeAttribute('style'); else d.el.setAttribute('style', d.inline);
    if (!d.moved) return;
    if (d.mode === 'move') sendPatch({ offsetX: d.cx, offsetY: d.cy });
    else sendPatch({ scale: d.cs });
  }, true);
  // Preview'da navigatsiya/amallar BLOKlanadi — faqat tahrir ishlaydi.
  document.addEventListener('click', function (ev) {
    if (!armed || editing) return;
    if (bar.contains(ev.target)) return;
    ev.preventDefault(); ev.stopPropagation();
  }, true);
  document.addEventListener('dblclick', function (ev) {
    if (!armed || editing) return;
    var t = target(ev.target); if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    if (t !== selected) selectEl(t);
    startEdit();
  }, true);

  // ── qatlamlar ro'yxati (admin Layers paneli uchun) ───────────────────────
  function outline() {
    var out = [], seen = {};
    try {
      var all = document.querySelectorAll('[data-cms],[data-cms-text]');
      for (var i = 0; i < all.length && out.length < 400; i++) {
        var el = all[i], k = keyOf(el);
        if (!k || seen[k]) continue;
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        seen[k] = 1;
        out.push({ path: k, leaf: !!el.getAttribute('data-cms-text'), tag: el.tagName.toLowerCase(), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) });
      }
    } catch (e) {}
    return out;
  }

  window.addEventListener('message', function (ev) {
    if (ALLOW.indexOf(ev.origin) < 0) return;
    var d = ev.data || {};
    if (d.type === 'ffcms-hello') {
      parentOrigin = ev.origin;
      try { if (typeof afCmsStamp === 'function') afCmsStamp(); } catch (e) {}
      post({ type: 'ffcms-ready', outline: outline(), screen: curScreen() });
      return;
    }
    if (d.type === 'ffcms-draft' && d.config) {
      cfgStyles = (d.config.uiStyles && typeof d.config.uiStyles === 'object') ? d.config.uiStyles : {};
      if (editing) return;                      // yozayotganda qayta chizish karetni o'ldiradi
      applyDraft(d.config);
      setTimeout(function () { post({ type: 'ffcms-outline', outline: outline() }); }, 120);
      return;
    }
    if (d.type === 'ffcms-goto' && d.screen) { gotoScreen(String(d.screen)); setTimeout(function () { post({ type: 'ffcms-outline', outline: outline() }); }, 300); return; }
    if (d.type === 'ffcms-device') { device = d.device === 'mobile' ? 'mobile' : 'desktop'; return; }
    if (d.type === 'ffcms-arm') { armed = d.on !== false; if (!armed) { box.style.display = 'none'; bar.style.display = 'none'; chip.style.display = 'none'; } return; }
    if (d.type === 'ffcms-select-path') {
      var el = findByKey(String(d.path || ''));
      if (el) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} selectEl(el, false); }
      return;
    }
    if (d.type === 'ffcms-outline-req') { post({ type: 'ffcms-outline', outline: outline() }); return; }
  });
})();
