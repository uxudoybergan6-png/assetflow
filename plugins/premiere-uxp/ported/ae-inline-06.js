
/* ===== Genlar galereyasi — BITTA qayta ishlatiladigan komponent (window.afGallery) =====
   Tool inline (scope:'recent') HAM, to'liq Tarix view (scope:'all') HAM shuni ishlatadi.
   Manba: GET /api/studio/gen/history (real shakl: items[].{id,mode,prompt,params,createdAt,assets[].{url,thumbUrl}}).
   Filter (Hammasi/Rasm/Video/Ovoz=voice+music/SFX) + zoom (−/+ ustun 3↔1, localStorage) + select (batch ⬇/🗑).
   Faqat mavjud endpointlar: /gen/history, DELETE /gen/:id, aiImportMedia. SVG ikonalar, .axroot scope. */
window.afGallery=(function(){
  var CACHE=null,LOADED=false,LOADING=null,LOADED_AT=0;
  var FRESH_MS=25*60*1000; // signed URL 1 soatda eskiradi — kesh undan ancha oldin yangilanadi (#8 stale fix)
  var COLS_KEY='af.gal.cols';
  // SVG ikonalar (emoji emas — CEP)
  var IC={
    imp:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
    dl:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
    trash:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    proj:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/></svg>',
    rst:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    copy:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    zin:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    zout:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
    sel:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
    check:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    play:'<svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(0,0,0,.5)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M10 8.5l6 3.5-6 3.5z" fill="#fff" stroke="none"/></svg>',
    img:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    vid:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="M22 8l-6 4 6 4z"/></svg>',
    aud:'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    // D6 — qadash (pin)
    pin:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>',
    pinF:'<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22a.9.9 0 0 1-.9-.9V17h1.8v4.1a.9.9 0 0 1-.9.9z"/><path d="M15 3H9a1 1 0 0 0-1 1.16L9 9.4 6.4 12a1.4 1.4 0 0 0-.4 1v1.6a.9.9 0 0 0 .9.9h10.2a.9.9 0 0 0 .9-.9V13a1.4 1.4 0 0 0-.4-1L15 9.4l1-5.24A1 1 0 0 0 15 3z"/></svg>'
  };
  /** D6 — qadalganlar avval, keyin yangilari. Server AYNI tartibda qaytaradi (pinned desc,
   *  createdAt desc); bu funksiya pin bosilgan zahoti javobni kutmasdan qayta tartiblaydi. */
  function sortPinned(list){
    return (list||[]).slice().sort(function(a,b){
      if(!!a.pinned!==!!b.pinned)return a.pinned?-1:1;
      return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
    });
  }
  function isCEP(){ return typeof window.__adobe_cep__!=='undefined'; }
  function esc(s){ return String(s==null?'':s).replace(/[<>&"]/g,function(c){return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c];}); }
  function toast(m,k){ if(typeof showToast==='function')showToast(m,k); }
  function cat(mode){ return mode==='video'?'video':(mode==='voice'||mode==='music')?'audio':mode==='sfx'?'sfx':'image'; }
  function normalize(items){
    return (items||[]).map(function(g){
      var a=(g.assets&&g.assets[0])||{}; var p=g.params||{};
      var sub=[p.aspectRatio,p.quality||p.resolution,(p.duration?(p.duration+'s'):null)].filter(Boolean).join(' · ');
      return { id:g.id, mode:g.mode, cat:cat(g.mode), url:a.url||'', thumb:a.thumbUrl||a.url||'',
        display:a.displayUrl||null, preview:a.previewUrl||null, width:a.width||null, height:a.height||null, // P9
        title:((g.prompt||'').trim()||'Result'), sub:sub, createdAt:g.createdAt,
        prompt:(g.prompt||'').trim(), params:p,
        cost:(typeof g.cost==='number'?g.cost:null), size:(a&&a.sizeBytes)||0,
        pinned:!!g.pinned }; // D6 — qadalgan natija ro'yxat boshida (server ham shunday saralaydi)
    }).filter(function(x){ return x.id && x.url; });
  }
  // b8: footer hajm formati — "2.1 GB" / "340 MB"
  function fmtSize(bytes){
    var b=Number(bytes)||0; if(!b)return '';
    var gb=b/(1024*1024*1024);
    if(gb>=1)return (Math.round(gb*10)/10)+' GB';
    return Math.max(1,Math.round(b/(1024*1024)))+' MB';
  }
  function load(force){
    if(LOADED && !force && CACHE && (Date.now()-LOADED_AT<FRESH_MS)) return Promise.resolve(CACHE);
    if(LOADING) return LOADING;
    LOADING=studioGet('/api/studio/gen/history?limit=60').then(function(d){
      try{ console.log('[gal] /gen/history →',((d&&d.items)||[]).length,'gen'); }catch(_){}
      CACHE=sortPinned(normalize((d&&d.items)||[])); LOADED=true; LOADED_AT=Date.now(); LOADING=null; return CACHE;
    }).catch(function(e){ LOADING=null; throw e; });
    return LOADING;
  }
  function clampCols(n){ n=parseInt(n,10); if(isNaN(n))n=2; return Math.max(1,Math.min(3,n)); }
  function loadCols(){ try{ return clampCols(localStorage.getItem(COLS_KEY)); }catch(e){ return 2; } }
  function saveCols(n){ try{ localStorage.setItem(COLS_KEY,String(n)); }catch(e){} }
  function importMedia(it){
    var kind=(it.cat==='video')?'video':(it.cat==='audio'||it.cat==='sfx')?'audio':'image';
    if(typeof aiImportMedia==='function')aiImportMedia(it.url,kind,null);
    else toast('Import only works inside Premiere Pro','info');
  }
  function download(it){
    if(isCEP()){ toast('Download — use Import (Premiere Project panel)','info'); return false; }
    try{ var a=document.createElement('a'); a.href=it.url; a.download=(String(it.title||'assetflow').slice(0,40).replace(/[^\w.-]+/g,'_')||'assetflow'); document.body.appendChild(a); a.click(); document.body.removeChild(a); return true; }catch(e){ toast('Download failed','error'); return false; }
  }
  // P15: "Qayta gen" — asl tool'ga o'tib prompt+referenslarni composer'ga tiklaydi (RECENT bilan bir xil global handoff).
  function galRestore(it){
    if(!it||!it.prompt){ toast('This result has no saved prompt','info'); return; }
    var c=it.cat||'image';
    if(c==='video'&&typeof window.afVgRestoreGen==='function'&&typeof window.axGo==='function'){ window.axGo('vidgen'); setTimeout(function(){ try{window.afVgRestoreGen(it);}catch(e){} },60); return; }
    // SC_30: faqat RASM genlari rasm tool'iga tiklanadi — audio/sfx bu yerga tushmasin (menyu ham yashiradi)
    if(c==='image'&&typeof window.afIgRestoreGen==='function'&&typeof window.axGo==='function'){ window.axGo('imggen'); setTimeout(function(){ try{window.afIgRestoreGen(it);}catch(e){} },60); return; }
    toast('Regenerate isn’t available for this result','info');
  }

  function render(container,opts){
    if(!container)return null;
    opts=opts||{}; var scope=opts.scope||'all';
    var st={ filter:'all', cols:loadCols(), select:false, sel:{} };
    container.className='gal'; container.setAttribute('data-scope',scope);
    container.innerHTML=
      '<div class="galselhead"><span class="gx"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></span><b class="gscount">0 selected</b><span class="gall">Select all</span></div>'
      + '<div class="galhead">'
      + '<div class="galtabs"></div>'
      + '<div class="galtools">'
      +   '<div class="galzoom"><b class="zout" title="Zoom out (more columns)">'+IC.zout+'</b><i></i><b class="zin" title="Zoom in (fewer columns)">'+IC.zin+'</b></div>'
      +   '<div class="galselbtn" title="Select mode">Select</div>'
      +   (scope==='recent'?'<div class="galmore" title="My Library">All →</div>':'')
      + '</div>'
      + '</div>'
      + '<div class="galgrid"></div>'
      + '<div class="galfoot"></div>'
      + '<div class="galbatch"><span class="gbinfo">0 selected</span>'+(isCEP()?'':'<div class="gbtn dl">'+IC.dl+' Download</div>')+'<div class="gbtn del">'+IC.trash+' Delete</div></div>';
    var tabsEl=container.querySelector('.galtabs');
    var gridEl=container.querySelector('.galgrid');
    var batchEl=container.querySelector('.galbatch');
    var selBtn=container.querySelector('.galselbtn');
    var selHead=container.querySelector('.galselhead');
    var footEl=container.querySelector('.galfoot');
    var zin=container.querySelector('.zin'), zout=container.querySelector('.zout');
    var more=container.querySelector('.galmore');

    var FILTERS=[['all','All'],['image','Image'],['video','Video'],['audio','Voice'],['sfx','SFX']];
    FILTERS.forEach(function(f){
      var d=document.createElement('div'); d.className='galtab'+(f[0]===st.filter?' on':''); d.textContent=f[1]; d.setAttribute('data-f',f[0]);
      d.addEventListener('click',function(){ st.filter=f[0]; st.sel={}; Array.prototype.forEach.call(tabsEl.children,function(c){ c.classList.toggle('on',c.getAttribute('data-f')===st.filter); }); draw(); });
      tabsEl.appendChild(d);
    });

    function applyZoom(){ gridEl.setAttribute('data-cols',st.cols); zout.classList.toggle('dis',st.cols>=3); zin.classList.toggle('dis',st.cols<=1); }
    zin.addEventListener('click',function(){ if(st.cols>1){ st.cols--; saveCols(st.cols); applyZoom(); } });   // kattalashtirish = kamroq ustun
    zout.addEventListener('click',function(){ if(st.cols<3){ st.cols++; saveCols(st.cols); applyZoom(); } });  // kichraytirish = ko'proq ustun
    selBtn.addEventListener('click',function(){ st.select=!st.select; st.sel={}; selBtn.classList.toggle('on',st.select); draw(); });
    if(more)more.addEventListener('click',function(){ if(typeof opts.onSeeAll==='function')opts.onSeeAll(); });
    // b9: select-mode header — ✕ chiqish + "Barchasini tanlash"
    selHead.querySelector('.gx').addEventListener('click',function(){ st.select=false; st.sel={}; selBtn.classList.remove('on'); draw(); });
    selHead.querySelector('.gall').addEventListener('click',function(){ visible().forEach(function(x){ st.sel[x.id]=1; }); draw(); });
    var _galDl=container.querySelector('.galbatch .dl');
    if(_galDl)_galDl.addEventListener('click',function(){
      var list=visible().filter(function(x){ return st.sel[x.id]; });
      if(!list.length){ toast('Select something first','warning'); return; }
      if(isCEP()){ toast('Download — import via the Premiere Project panel','info'); return; } // CEP: single toast (no spam)
      var ok=0; list.forEach(function(it){ if(download(it))ok++; });
      toast(ok+' downloaded','success');
    });
    container.querySelector('.galbatch .del').addEventListener('click',batchDelete);

    function visible(){ var arr=(CACHE||[]).filter(function(x){ return st.filter==='all'||x.cat===st.filter; }); if(scope==='recent')arr=arr.slice(0,12); return arr; }
    function updBatch(){
      var n=Object.keys(st.sel).length;
      batchEl.classList.toggle('on',st.select);
      container.querySelector('.gbinfo').textContent=n+' selected';
      // b9: select-mode header ("✕ N tanlandi · Barchasini tanlash"); oddiy head yashirinadi
      selHead.classList.toggle('on',st.select);
      selHead.querySelector('.gscount').textContent=n+' selected';
      var gh=container.querySelector('.galhead'); if(gh)gh.style.display=st.select?'none':'';
    }
    // b10: galereya kartasi lightbox'ga ochiladi (Import/Download lightbox ichida)
    function galLbCtx(){ return {
      isCEP:isCEP(),
      list:function(){ return visible(); },
      onImport:function(x){ importMedia(x); },
      onDownload:function(x){ download(x); },
      onPin:function(x){ galTogglePin(x); } // D6
    }; }

    function draw(){
      applyZoom();
      gridEl.classList.toggle('selmode',st.select);
      if(!CACHE){ gridEl.innerHTML='<div class="gskel"></div><div class="gskel"></div><div class="gskel"></div><div class="gskel"></div>'; return; } // SC_23: skeleton (matn/void emas)
      var list=visible();
      if(!list.length){
        // SC_23: bo'sh holat — ixcham matn + aniq amal tugmasi (Generate → launcher)
        gridEl.innerHTML='<div class="galempty"><b>Empty for now</b>'+(st.filter==='all'?'It\'ll show up here once you generate.':'No results of this type.')+(st.filter==='all'?'<br><div role="button" tabindex="0" type="button" class="galretry galgen" style="margin-top:8px">✦ Generate something</div>':'')+'</div>';
        var gb=gridEl.querySelector('.galgen');
        if(gb)gb.addEventListener('click',function(){ if(window.axGo)window.axGo('launcher'); });
        footEl.textContent=''; updBatch(); return;
      }
      gridEl.innerHTML='';
      list.forEach(function(it){
        var isAud=(it.cat==='audio'||it.cat==='sfx');
        var card=document.createElement('div'); card.className='gcard'+(st.sel[it.id]?' sel':'')+(isAud?' gcard-aud':'');
        var badge=(it.cat==='video')?IC.vid:isAud?IC.aud:IC.img;
        // video: thumb ko'pincha video url'ning o'zi — CSS background video kadrini chizmaydi (qora tile).
        // Haqiqiy poster bo'lsa background; bo'lmasa afVideoThumb <video> birinchi kadrni ko'rsatadi.
        var vNoPoster=(it.cat==='video')&&(!it.thumb||it.thumb===it.url);
        // SC_16: media NATIV nisbatda (payload width/height yoki params.aspectRatio; fallback 16/9 CSS'da)
        var arCss=null;
        var arS=it.params&&it.params.aspectRatio;
        if(arS){ var arM=String(arS).trim().match(/^(\d+(?:\.\d+)?)\s*[:\/x]\s*(\d+(?:\.\d+)?)$/i); if(arM)arCss=arM[1]+' / '+arM[2]; }
        if(!arCss&&it.width&&it.height)arCss=Number(it.width)+' / '+Number(it.height);
        var th;
        if(isAud){
          // SC_16: audio — maqsadli ixcham karta (waveform + tur chipi + play)
          var wseed=0; var wsid=String(it.id||''); for(var wsi=0;wsi<wsid.length;wsi++)wseed=(wseed*31+wsid.charCodeAt(wsi))%997;
          var bars=''; for(var wb=0;wb<24;wb++)bars+='<i style="height:'+(20+((wseed+wb*37)%67))+'%"></i>';
          th='<div class="gth gth-aud">'+(it.pinned?('<span class="gpin" title="Pinned">'+IC.pinF+'</span>'):'')+'<span class="gk">'+(it.cat==='sfx'?'SFX':'VOICE')+'</span><div role="button" tabindex="0" type="button" class="gaplay" title="Play / pause"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg></div><span class="gwave">'+bars+'</span><div class="gcb">'+IC.check+'</div></div>';
        }else{
          var gthStyle='';
          if(!vNoPoster&&it.thumb)gthStyle+='background-image:url(\''+it.thumb+'\');';
          if(arCss)gthStyle+='aspect-ratio:'+arCss+';';
          th='<div class="gth"'+(gthStyle?(' style="'+gthStyle+'"'):'')+'>'+(it.pinned?('<span class="gpin" title="Pinned">'+IC.pinF+'</span>'):'')+'<div class="gbadge">'+badge+'</div>'+(it.cat==='video'?('<div class="gplay">'+IC.play+'</div>'):'')+'<div class="gcb">'+IC.check+'</div></div>';
        }
        card.innerHTML=th;
        if(vNoPoster&&typeof window.afVideoThumb==='function'){
          var gth=card.querySelector('.gth'); var vv=window.afVideoThumb(it.url);
          if(gth&&vv)gth.insertBefore(vv,gth.firstChild);
        }
        if(isAud){
          var gap=card.querySelector('.gaplay');
          if(gap)gap.addEventListener('click',function(e){
            e.stopPropagation();
            var au=window.__afCardAudio||(window.__afCardAudio=new Audio());
            var pauseSvg='<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
            var playSvg='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>';
            if(au.src===it.url&&!au.paused){ au.pause(); gap.innerHTML=playSvg; return; }
            try{ au.pause(); }catch(err){}
            au.src=it.url; var pp2=au.play(); if(pp2&&pp2.catch)pp2.catch(function(){});
            document.querySelectorAll('.gaplay,.rc-aud .aplay').forEach(function(b){ b.innerHTML=playSvg; });
            gap.innerHTML=pauseSvg;
            au.onended=function(){ gap.innerHTML=playSvg; };
          });
        }
        // SC_45: "Use ▾" endi karta ICHIDA (media ustida) — alohida pastki strip o'rniga.
        // Menyu xaritasi 1:1: Import · Add to project · Add to Explore · Regenerate ·
        // Copy prompt · (Download — faqat brauzer) · Delete. Upscale yo'q (SC_17 o'chirgan).
        var useBtn=document.createElement('div'); useBtn.className='guse'; useBtn.textContent='Use ▾'; useBtn.title='Actions';
        useBtn.addEventListener('click',function(e){
          e.stopPropagation();
          var items=[];
          items.push({ic:IC.imp,label:'Import to Premiere',fn:function(){ importMedia(it); }});
          if(it.id)items.push({ic:IC.proj,label:'Add to project',fn:function(){ if(window.afProjectPicker)window.afProjectPicker('gen',it.id); }});
          if(it.id)items.push({ic:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',label:(window.afExploreState?window.afExploreState(it.id).label:'Add to Explore'),fn:function(){ window.afAddToExplore(it); }});
          // SC_30: Regenerate faqat rasm/video uchun — audio restore yo'li yo'q (avval audio genni
          // rasm tool'iga noto'g'ri yo'naltirardi); mumkin bo'lmagan kind uchun band ko'rsatilmaydi.
          // R4_08 — Topaz bir-bosishlik enhance/upscale (faqat yoqilgan op + mos media turida)
          var _tzOp2=(typeof window.afTopazOpFor==='function')?window.afTopazOpFor(it.cat||'image'):null;
          if(_tzOp2){
            var _tzI='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
            if((it.cat||'image')==='video'){
              items.push({ic:_tzI,label:'Upscale video 2×',fn:function(){ window.afRunTopazOp(_tzOp2,it,2); }});
              items.push({ic:_tzI,label:'Upscale video 4×',fn:function(){ window.afRunTopazOp(_tzOp2,it,4); }});
            } else if(it.cat==='image'||!it.cat){
              items.push({ic:_tzI,label:'Upscale image',fn:function(){ window.afRunTopazOp(_tzOp2,it,null); }});
            }
          }
          // D6 — natijani qadash: ro'yxatlarda DOIM birinchi chiqadi (web bilan AYNI endpoint)
          if(it.id)items.push({ic:IC.pin,label:(it.pinned?'Unpin':'Pin to top'),fn:function(){ galTogglePin(it); }});
          if(it.prompt&&(it.cat==='image'||it.cat==='video'))items.push({ic:IC.rst,label:'Regenerate',fn:function(){ galRestore(it); }});
          if(it.prompt)items.push({ic:IC.copy,label:'Copy prompt',fn:function(){ window.afCopyText(it.prompt); }});
          if(!isCEP())items.push({ic:IC.dl,label:'Download',fn:function(){ download(it); }});
          items.push({ic:IC.trash,label:'Delete',danger:true,fn:function(){ galDeleteOne(it); }});
          if(window.afUseMenuOpen)window.afUseMenuOpen(useBtn,items);
        });
        // SC_45: Use'ni karta ICHIGA joylaymiz — visual kartada .gth ustiga, audio kartada gth-aud qatoriga.
        var _host=card.querySelector('.gth')||card.querySelector('.gth-aud')||card;
        _host.appendChild(useBtn);
        if(st.select){
          card.addEventListener('click',function(){ if(st.sel[it.id])delete st.sel[it.id]; else st.sel[it.id]=1; card.classList.toggle('sel',!!st.sel[it.id]); updBatch(); });
        }else{
          card.addEventListener('click',function(){ if(window.afRecent&&window.afRecent.openLightbox)window.afRecent.openLightbox(it,galLbCtx()); else importMedia(it); });
        }
        gridEl.appendChild(card);
      });
      // b8: "N ta natija · X GB" footer
      var total=0; list.forEach(function(x){ total+=(x.size||0); });
      footEl.textContent=list.length+' result'+(list.length===1?'':'s')+(total?(' · '+fmtSize(total)):'');
      updBatch();
    }

    function batchDelete(){
      var list=visible().filter(function(x){ return st.sel[x.id]; });
      if(!list.length){ toast('Select something first','warning'); return; }
      window.afConfirm(list.length+' item(s) will be deleted?\nThis can\'t be undone. Files are also removed from the server.',{ok:'Delete',danger:true}).then(function(ok){
        if(!ok)return;
        var done=0,fail=0,total=list.length;
        list.forEach(function(it){
          studioDelete('/api/studio/gen/'+it.id).then(function(){
            done++; if(CACHE)CACHE=CACHE.filter(function(x){ return x.id!==it.id; }); delete st.sel[it.id];
          }).catch(function(){ fail++; }).then(function(){
            if(done+fail===total){ st.select=(Object.keys(st.sel).length>0); selBtn.classList.toggle('on',st.select); draw(); toast(done+' deleted'+(fail?(' · '+fail+' failed'):''), fail?'warning':'success'); }
          });
        });
      });
    }

    // D6 — natijani qadash/yechish. Optimistik: UI darhol qayta tartiblanadi, server rad etsa qaytariladi.
    // Web bilan AYNI endpoint (PATCH /gen/:id/pin) — ikkala tomon bir xil tartibni ko'radi.
    function galTogglePin(it){
      if(!it||!it.id){ toast('This result is still being saved','info'); return; }
      var want=!it.pinned;
      var apply=function(val){
        it.pinned=val;
        if(CACHE){ CACHE.forEach(function(x){ if(x.id===it.id)x.pinned=val; }); CACHE=sortPinned(CACHE); }
        draw();
      };
      apply(want);
      studioPatch('/api/studio/gen/'+encodeURIComponent(it.id)+'/pin',{pinned:want}).then(function(r){
        if(r&&typeof r.pinned==='boolean'&&r.pinned!==want)apply(r.pinned);
      }).catch(function(e){
        apply(!want); // server rad etdi — optimistik o'zgarish qaytariladi
        toast((e&&e.message)||'Pin failed','error');
      });
    }

    // P15: bitta karta o'chirish (amal panelidagi Delete) — tasdiq + server + kesh + redraw.
    function galDeleteOne(it){
      if(!it||!it.id){ toast('This result is still being saved','info'); return; }
      window.afConfirm('Delete this generation? This can’t be undone. It’s also removed from the server.',{ok:'Delete',danger:true}).then(function(ok){
        if(!ok)return;
        studioDelete('/api/studio/gen/'+it.id).then(function(){
          if(CACHE)CACHE=CACHE.filter(function(x){ return x.id!==it.id; }); delete st.sel[it.id]; draw(); toast('Deleted','success');
        }).catch(function(){ toast('Delete failed','error'); });
      });
    }

    applyZoom();
    // #9: aniq xato sababi + Retry (avval sababisiz "Failed to load" edi)
    function attempt(force){
      load(force).then(draw).catch(function(err){
        var why=(err&&err.message)?String(err.message):'Check your internet/session.';
        gridEl.innerHTML='<div class="galempty"><b>Failed to load</b>'+esc(why)+'<br><div role="button" tabindex="0" type="button" class="galretry" style="margin-top:8px">↻ Retry</div></div>';
        var rb=gridEl.querySelector('.galretry');
        if(rb)rb.addEventListener('click',function(){ gridEl.innerHTML='<div class="gskel"></div><div class="gskel"></div><div class="gskel"></div><div class="gskel"></div>'; attempt(true); }); // SC_23: skeleton
      });
    }
    attempt(false);
    return { refresh:function(force){ load(force).then(draw).catch(function(){}); }, el:container };
  }
  // #9 — load ham eksport: My Library referens tanlagichlari (ig/vg) shu keshdan o'qiydi
  return { render:render, load:load, invalidate:function(){ LOADED=false; CACHE=null; } };
})();
