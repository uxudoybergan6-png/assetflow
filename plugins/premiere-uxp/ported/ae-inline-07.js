
/* Rasm yaratish tool — tool-image.html 1:1 JS oqimi, MODEL-AWARE. REAL backend:
   /gen/models (refMode/maxRefs/aspects/resolutions/qualityCost/count) → /gen/ref-upload (referens R2)
   → cost-quote → session → gen → poll. CEP showOpenDialog + listProjectFootage + exportTimelineFrame
   manbalar; @imgN token promptga kursor joyiga qo'yiladi. Soxta canvas YO'Q. */
(function(){
  var $=function(id){return document.getElementById(id);};
  if(!$('v-imggen'))return;
  var IS_CEP=(typeof window.__adobe_cep__!=='undefined');

  // model metadata (lazy, cached) — refMode/maxRefs/aspects/resolutions/qualityCost/count backenddan
  // P8: pre-load defaultlar joriy default katalog modeliga (Nano Banana 2, id 1010) mos —
  // ensureMeta yuklangach baribir katalogdan yangilanadi.
  var meta={loaded:false,models:[],modelId:null,key:null,label:'Nano Banana 2',refMode:'image-edit',maxRefs:10,refKind:null,refOk:true,
    ars:['1:1','2:3','3:2','3:4','4:3','16:9','9:16','21:9'],quals:['1K','2K','4K'],qLabel:'Quality',aspDef:'1:1',qDefault:'1K',
    qcost:{'1K':4,'2K':8,'4K':16},counts:[1,2,3,4]};
  var st={ar:'1:1',q:'1K',n:1,refs:[],sessionId:null,lastResults:[],recent:[],recentSelect:false,recentSel:{},sessTotal:null,audCount:0}; // SC_29: sessTotal/audCount — faol sessiya sanoqlari

  function toast(t,k){ if(typeof showToast==='function')showToast(t,k); }
  function ext(p){ return (String(p).split('.').pop()||'').toLowerCase(); }
  function isImg(p){ return /\.(png|jpe?g|webp|gif|bmp|tiff?|avif|heic)$/i.test(String(p||'')); }
  function base(p){ return String(p).split(/[\\\/]/).pop(); }
  function mime(p){ var e=ext(p); return e==='jpg'?'image/jpeg':((e==='tif'||e==='tiff')?'image/tiff':(e==='svg'?'image/svg+xml':'image/'+(e||'png'))); }
  function cap(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }

  // ---- kredit (REAL profil) + narx ----
  function credits(){ try{ var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null; return (u&&typeof u.aiCredits==='number'&&isFinite(u.aiCredits))?u.aiCredits:null; }catch(e){ return null; } }
  function cost(){ return meta.hasQuality ? (meta.qcost[st.q]||12)*st.n : (meta.flatCost||4)*st.n; }
  function setCreditChip(v){ var cr=$('igCredit'); if(cr)cr.innerHTML='<span class="cs">✦</span> '+((v!=null)?Number(v).toLocaleString('en-US'):'—'); if(typeof window.afSyncCredits==='function')window.afSyncCredits(v); }
  function recost(){
    var sc=$('igCost'), c=cost();
    if(sc){ sc.textContent='✦'+c;
      sc.title=meta.hasQuality
        ? ('Price ≈ ✦'+(meta.qcost[st.q]||12)+'/image × '+st.n+' = ✦'+c)
        : ('Fixed price: ✦'+(meta.flatCost||4)+'/image × '+st.n+' = ✦'+c); }
    var g=$('igGen'); if(g)g.title='Generate (✦'+c+')';
    refreshGen(); // P22 — narx o'zgardi → banner + tugma holatini qayta hisobla
  }
  // P22 — "kredit yetmaydi" darvozasi: BOSISHDAN OLDIN. Balans uchayotgan (parallel) ishlarga
  //   komitilgan kreditni hisobga oladi (P22.2). Money-zona: faqat ko'rsatish/darvoza — server atomik.
  function igCreditGate(){
    var cr=credits(), c=cost();
    var committed=(activeJobs||[]).reduce(function(a,j){ return a+(j.jcost||0); },0);
    var avail=(cr!=null)?(cr-committed):null;
    var low=(avail!=null)&&(c>avail);
    window.afLowCred('ig',low,window.afLowCredNeed(c,avail)); // D7: umumiy banner helper
    var chip=$('igCredit'); if(chip)chip.classList.toggle('low',low);
    return low;
  }
  function refresh(){ setCreditChip(credits()); recost(); ensureMeta(); renderRecentGrid(); loadRecent(); restoreActiveJobs(); }
  // SC_29: sessiya almashganda feed TOZALANADI — boshqa sessiyaning kartalari qolib ketmasin;
  // faol joblarning pit'i uziladi (natija endi eski sessiya feed'iga tushmaydi, poll fonda davom etadi).
  function igResetFeed(){
    st.recent=[]; st.recentSel={}; st.recentSelect=false; st.sessTotal=null; st.audCount=0;
    recentLoaded=false; recentLoadedAt=0; recentError='';
    var sb=$('igRecentSel'); if(sb)sb.classList.remove('on');
    activeJobs.forEach(function(j){ j.pit=null; });
    renderRecentGrid();
  }
  window.axIGNewSession=function(){ st.sessionId=null; if(window.__axwsSess)window.__axwsSess.imggen=null; igResetFeed(); }; // P1: New session
  window.axIGSetSession=function(id){ id=id||null; if(id===st.sessionId)return; st.sessionId=id; igResetFeed(); }; // SC_18: picker'dan sessiya davomi
  // SC_29: joriy sessiya (fon-toast "View" mos sessiyani aniqlashi uchun) + tab sanoqlari
  window.__axToolSess=window.__axToolSess||{};
  window.__axToolSess.imggen=function(){ return st.sessionId; };
  window.__axwsCounts=window.__axwsCounts||{};
  window.__axwsCounts.imggen=function(){
    var visLoaded=0,pend=0;
    st.recent.forEach(function(x){ if(!x)return; if(x.pending)pend++; else if(x.url)visLoaded++; });
    var vis=(typeof st.sessTotal==='number'&&st.sessTotal>=visLoaded+st.audCount)?(st.sessTotal-st.audCount):visLoaded;
    return {vis:vis+pend,aud:st.audCount||0};
  };
  window.axIGRefresh=refresh;

  // SC_17: Upscale (selectUpscaleModel/igStartUpscale/afIgUpscale/axIGSelectUpscale)
  // BUTUNLAY o'chirildi — UI ham, kod ham. Tarixdagi eski upscale natijalari oddiy
  // rasm/video sifatida renderlanadi (maxsus kod shart emas).

  // ---- "Yaratish" disabled holatini qayta hisoblash ----
  function anyLoading(){ return st.refs.some(function(r){ return r.loading; }); }
  function refreshGen(){
    var needRef=meta.refMode==='required';
    var needPrompt=true; // SC_17: upscale (prompt-siz yagona rejim) o'chirildi
    var low=igCreditGate(); // P22 — kredit yetmasa (komitilgan bilan) tugma O'CHADI (bosishdan oldin)
    var ok=meta.loaded && (!needPrompt || $('igPrompt').value.trim().length>=2) && (!needRef || st.refs.length>0) && !anyLoading() && activeJobs.length<MAX_JOBS && !low;
    var g=$('igGen'); if(g)g.disabled=!ok;
    $('igRefWarn').classList.toggle('on', needRef && st.refs.length===0);
    // P30 §2 — qattiq siyosatli model + prompt bor → "rad etilsa hisobdan yechilmaydi" ogohlantirish
    var pn=$('igPolNote'); if(pn)pn.style.display=(meta.strict && $('igPrompt').value.trim().length>=2)?'flex':'none';
  }

  // ---- sheet'lar (backdrop + Esc + ✕) ----
  function closeSheets(){ document.querySelectorAll('.axig .sheet').forEach(function(s){s.classList.remove('on');}); }
  // FIX4: sozlama sheet'lari (.pop) — bosilgan pill yoniga joylanadigan popover (ostiga, joy yetmasa
  // ustiga; viewport ichida clamp). .pop bo'lmagan sheet'lar bottom-sheet (CSS boshqaradi, inline toza).
  function positionPopover(sc,anchorEl){
    if(!sc)return;
    var pad=8,gap=6,vw=window.innerWidth,vh=window.innerHeight;
    sc.style.bottom='auto';
    if(anchorEl&&anchorEl.getBoundingClientRect){
      var ar=anchorEl.getBoundingClientRect();
      var w=Math.min(Math.max(ar.width,240),380,vw-pad*2);
      sc.style.width=w+'px'; sc.style.maxHeight=Math.round(vh*0.62)+'px';
      sc.style.left='-9999px'; sc.style.top='0px'; var sh=sc.offsetHeight; // o'lchash
      var left=Math.min(Math.max(pad,ar.left),Math.max(pad,vw-w-pad));
      var top;
      if(ar.bottom+gap+sh<=vh-pad) top=ar.bottom+gap;       // pill OSTIDA joy bor
      else if(ar.top-gap-sh>=pad) top=ar.top-gap-sh;        // pill USTIDA joy bor
      else top=Math.max(pad,vh-sh-pad);                     // sig'masa — viewport ichida clamp
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
  function openSheet(id,anchorEl){
    closeSheets(); var s=$(id); if(!s)return; s.classList.add('on'); s._anchor=anchorEl||null;
    var sc=s.querySelector('.sheetc'); if(!sc)return;
    if(s.classList.contains('pop'))positionPopover(sc,anchorEl);
    else { sc.style.left='';sc.style.top='';sc.style.bottom='';sc.style.width='';sc.style.maxHeight=''; }
  }
  // async kontent (masalan Project ro'yxati) kelgach popover'ni qayta joylash — balandlik o'zgaradi
  function repositionSheet(id){
    var s=$(id); if(!s||!s.classList.contains('on')||!s.classList.contains('pop'))return;
    positionPopover(s.querySelector('.sheetc'),s._anchor);
  }
  document.querySelectorAll('.axig [data-igclose]').forEach(function(x){ x.addEventListener('click',closeSheets); });
  document.querySelectorAll('.axig .sheet').forEach(function(s){ s.addEventListener('click',function(e){ if(e.target===s)closeSheets(); }); });
  // P15 — kompozer "Expand" toggle: default ~140px qopqoq, bosilganda to'liq balandlikka kengayadi.
  function setChipExpanded(taId,btnId,on){
    var ta=$(taId),exp=$(btnId); if(!ta)return;
    ta.classList.toggle('expanded',on);
    if(exp){ exp.classList.toggle('on',on); exp.title=on?'Collapse':'Expand'; }
  }
  (function(){ var exp=$('igPromptExp'),ta=$('igPrompt'); if(exp&&ta)exp.addEventListener('click',function(){ setChipExpanded('igPrompt','igPromptExp',!ta.classList.contains('expanded')); }); })();
  // P14/P15 — bitta Esc = bitta qatlam: avval sheet, keyin kengaytirilgan kompozer.
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    if(document.querySelector('.axig .sheet.on')){ closeSheets(); return; }
    var ta=$('igPrompt'); if(ta&&ta.classList.contains('expanded'))setChipExpanded('igPrompt','igPromptExp',false);
  });

  // ---- pill'lar ----
  function buildPills(host,arr,cur,onpick){ if(!host)return; host.innerHTML=''; arr.forEach(function(v){ var d=document.createElement('div'); d.className='pill'+(String(v.val!=null?v.val:v)===String(cur)?' cur':''); d.textContent=(v.label!=null?v.label:v); d.addEventListener('click',function(){ onpick(v.val!=null?v.val:v); }); host.appendChild(d); }); }

  // ---- model metadata (lazy, cached, MODEL-AWARE picker) ----
  // FIX3: model referens qabul qiladimi — FAQAT /gen/models imkoniyatlaridan: refKind ('image'|'media-refs')
  // + maxRefs>0. refKind deklaratsiya qilinmagan eski modelda refMode fallback (orqaga moslik).
  function igModelRefOk(m){
    var rk=(m&&m.refKind)||null;
    var okKind=rk?(rk==='image'||rk==='media-refs'):(((m&&m.refMode)||'optional')!=='none');
    return okKind&&((m&&m.maxRefs)||0)>0;
  }
  // Tanlangan modelni qo'llaydi: refKind/maxRefs/aspects/quals/qcost/counts + default'lar.
  // Referens qo'llamaydigan model (refKind none yoki maxRefs 0) → referenslar tozalanadi.
  function setModel(m){
    if(!m)return false;
    // P12 — chiqayotgan modelning joriy kompozer parametrlarini eslab qolamiz (af.prefs.genPrefsImg).
    var prevImgId=meta.modelId, prevImgSnap={ar:st.ar,q:st.q,n:st.n};
    var gpImg=(afGetPrefs().genPrefsImg)||{};
    if(prevImgId!=null)gpImg[prevImgId]=prevImgSnap;
    // P13 — REFERENS HOVUZI MODEL-MUSTAQIL: model almashishi st.refs'dan HECH NARSA o'chirmaydi/klamplamaydi.
    //   Model imkoniyati faqat PROYEKSIYA beradi — renderRefs faol/nofaol (xira) qiladi, genClick FAQAT
    //   faollarini yuboradi, @raqamlash hovuzga bog'liq (qayta raqamlanmaydi). Orqaga qaytsa hammasi qaytadi.
    meta.modelId=m.id; meta.key=m.key; meta.label=m.label||meta.label;
    meta.strict=(m.policyStrictness==='strict'); // P30 §2 — qattiq siyosat ogohlantirishi uchun
    meta.refMode=m.refMode||'optional'; meta.maxRefs=m.maxRefs||0;
    meta.refKind=m.refKind||null; meta.refOk=igModelRefOk(m);
    meta.feature=m.feature||null; // BATCH4 #1 — image-upscale: prompt ixtiyoriy, tugma "Upscale image"
    // MODEL-AWARE: sozlama deskriptoridan (imgSettings) — bo'lmasa eski flat fieldlar (orqaga moslik).
    var s=m.imgSettings||null;
    var asp=s&&s.aspect, ql=s&&s.quality;
    meta.ars=(asp&&asp.options&&asp.options.length)?asp.options:((m.aspects&&m.aspects.length)?m.aspects:meta.ars);
    meta.aspDef=(asp&&asp.def)||meta.ars[0];
    meta.quals=(ql&&ql.options&&ql.options.length)?ql.options:((m.resolutions&&m.resolutions.length)?m.resolutions:meta.quals);
    meta.hasQuality=!!ql; // false → 2-chip yashiriladi, narx flatCost×n
    meta.flatCost=m.cost||4; // quality yo'q modellar uchun tekis kredit/rasm
    meta.qcost=(ql&&ql.cost)||m.qualityCost||meta.qcost;
    meta.qLabel=(ql&&ql.label)||'Quality'; // 2-chip label: gpt→"Quality", nano→"Resolution"
    meta.qDefault=(ql&&ql.def)||((meta.quals.indexOf('high')>=0)?'high':meta.quals[0]);
    meta.counts=(s&&s.num&&s.num.length)?s.num:((m.count&&m.count.length)?m.count:meta.counts);
    // P12 — shu model uchun avval saqlangan preferensiya bo'lsa (hali ham YAROQLI bo'lsa) tiklaymiz,
    //   aks holda model default'i.
    var savedImg=gpImg[m.id];
    // SC_27: saqlangan qiymat yangi modelda yaroqsiz bo'lsa default'ga tushadi — sonini sanab xabar beramiz
    var drp=0;
    if(savedImg){
      if(savedImg.ar!=null&&meta.ars.indexOf(savedImg.ar)<0)drp++;
      if(savedImg.q!=null&&meta.hasQuality&&meta.quals.indexOf(savedImg.q)<0)drp++;
      if(savedImg.n!=null&&meta.counts.indexOf(savedImg.n)<0)drp++;
    }
    st.ar=(savedImg&&meta.ars.indexOf(savedImg.ar)>=0)?savedImg.ar:meta.aspDef;
    st.q=(savedImg&&meta.quals.indexOf(savedImg.q)>=0)?savedImg.q:meta.qDefault;
    st.n=(savedImg&&meta.counts.indexOf(savedImg.n)>=0)?savedImg.n:(meta.counts[0]||1);
    afSavePrefs({genPrefsImg:gpImg});
    // P13 — hovuz tegilmaydi; proyeksiyani yangilash uchun refs QAYTA chiziladi (xira holatlar).
    var inact=igInactiveRefCount();
    applyMeta(); renderRefs(); updRefMeta();
    if(inact>0||drp>0){
      var bits=[];
      if(inact>0)bits.push(inact+' reference'+(inact>1?'s':'')+' not used by '+(m.label||'this model')+' — kept for other models');
      if(drp>0)bits.push(drp+' setting'+(drp>1?'s':'')+' reset to model default');
      toast(bits.join(' · '),'info');
    }
    return true;
  }
  // P13 — joriy modelda NOFAOL bo'ladigan (limitdan tashqari yoki qo'llanmaydigan) referenslar soni
  function igActiveRefLimit(){ return meta.refOk?(meta.maxRefs||0):0; }
  function igInactiveRefCount(){ return Math.max(0, st.refs.length - igActiveRefLimit()); }
  // Section F — BRAND_SVG/BRAND_LABEL endi haqiqiy top-level (afSortPinnedFirst yonida, .axvg ham
  // ishlatadi); shu yerda takrorlanmaydi (Section C darsi — IIFE ichida e'lon qilinsa .axvg'ga ko'rinmasdi).
  // b2: modelning 1-natija narxi (quality bo'lsa default sifatda, aks holda flat cost)
  function igModelPrice(m){
    var s=m.imgSettings||null, ql=s&&s.quality;
    var qc=(ql&&ql.cost)||m.qualityCost||null;
    if(qc){ var d=(ql&&ql.def)||((qc.high!=null)?'high':Object.keys(qc)[0]); var v=qc[d]; if(typeof v==='number')return v; }
    return (typeof m.cost==='number')?m.cost:null;
  }
  // Model sheet — b2 mockup: nom+tavsif+narx (✦N); tanlangan qator = bg + chap lime nuqta
  function renderModelSheet(){
    var host=$('igMList'); if(!host)return; host.innerHTML='';
    var reqNames=[];
    afSortPinnedFirst(meta.models||[]).forEach(function(m){
      var cur=(m.id===meta.modelId);
      var pinned=afIsModelPinned(m.id);
      var brandName=BRAND_LABEL[m.brand]||'AI';
      var sub=String(m.desc||m.description||((m.refMode==='required')?brandName+' · reference required':(m.refMode==='none')?brandName+' · no reference':brandName)).replace(/[<>&]/g,'');
      if(m.refMode==='required')reqNames.push(String(m.label||''));
      var price=igModelPrice(m);
      var o=document.createElement('div'); o.className='mrowb'+(cur?' cur':'');
      o.innerHTML='<span class="mdot"></span><div class="mtx"><b>'+String(m.label||'').replace(/[<>&]/g,'')+brandBadgeHtml(m.brand)+'</b><small>'+sub+'</small></div>'+((price!=null)?'<span class="mprice">✦ '+price+'</span>':'')+'<span class="mpin'+(pinned?' on':'')+'" title="'+(pinned?'Unpin model':'Pin model')+'">'+PIN_SVG+'</span>';
      o.addEventListener('click',function(){ if(m.id!==meta.modelId){ if(setModel(m)!==false){ renderModelSheet(); toast(m.label+' selected','info'); } } closeSheets(); });
      var pinEl=o.querySelector('.mpin');
      if(pinEl)pinEl.addEventListener('click',function(e){ e.stopPropagation(); var on=afToggleModelPin(m.id); renderModelSheet(); toast(on?'Model pinned':'Model unpinned','info'); });
      host.appendChild(o);
    });
    var hint=$('igMHint'); var hs=hint&&hint.querySelector('span');
    if(hs)hs.textContent=reqNames.length?('At least 1 reference is required for '+reqNames.join(', ')):'Each model sets its own reference rules';
  }
  function ensureMeta(){
    if(meta.loaded)return Promise.resolve(meta);
    if(meta._pending)return meta._pending;
    meta._pending=studioGet('/api/studio/gen/models?mode=image').then(function(r){
      // P10: provider allowlist OLIB TASHLANDI — server faqat enabled modellarni qaytaradi;
      // yangi provider'li model katalogga qo'shilsa UI kodi o'zgarmasdan ko'rinadi (katalog-driven).
      var fal=((r&&r.models)||[]).filter(function(x){ return x&&x.id!=null&&x.mode==='image'; });
      if(!fal.length)throw new Error('No model found');
      meta.models=fal;
      // default: isDefault belgilangani (Nano Banana), aks holда 1-chi
      var def=fal.filter(function(x){ return x.isDefault; })[0]||fal[0];
      meta.loaded=true; setModel(def); renderModelSheet();
      return meta;
    }).catch(function(err){
      meta._pending=null;
      toast((err&&err.message)||'Failed to load model','error');
      var g=$('igGen'); if(g)g.disabled=true;
      throw err;
    });
    return meta._pending;
  }
  function applyMeta(){
    $('igMName').textContent=meta.label; // model = sozlamalar chip
    var _ims=$('igModelSeg'); if(_ims)_ims.title=meta.label||'Choose a model'; // SC_20: to'liq nom tooltip'da
    // FIX3: prompt bo'limi har doim ko'rinadi; ＋Referens FAQAT model referens qo'llasa
    // (refKind 'image'|'media-refs' va maxRefs>0) — sof t2i modelda butunlay yashirin.
    var noRef=!meta.refOk;
    $('igRefAdd').style.display=noRef?'none':''; // ＋Referens yangi qo'shishga; xira hovuz esa TURADI
    // P13 — hovuzda referens bo'lsa "N kept (unused)" hisoblagichi ko'rinsin (model qo'llamasa ham)
    // SC_19: igRefMeta endi yashirin (hisoblagich [+] badge'ida — updRefMeta yangilaydi)
    var qlEl=$('igQLab'); if(qlEl)qlEl.textContent=meta.qLabel||'Quality'; // gpt→"Sifat", nano→"Resolution"
    var qsec=$('igQSec'); if(qsec)qsec.style.display=meta.hasQuality?'':'none'; // quality yo'q → sektsiya yashirin
    // P16 — bitta sozlama chipi xulosasi (Ratio · Quality · ×N)
    var sv=$('igSetVal'); if(sv){ sv.textContent=igSummary(); var _iss=$('igSetSeg'); if(_iss)_iss.title='Output: '+igSummary(); } // SC_20: tooltip
    // SC_17: upscale rejimi o'chirildi — placeholder/tugma matni doim standart
    var taUp=$('igPrompt'); if(taUp)taUp.placeholder='What should we create? Type @ to bring up references. E.g.: apply @img1 material to @img2 shape';
    var gUp=$('igGen'); if(gUp&&gUp.firstChild&&gUp.firstChild.nodeType===3)gUp.firstChild.textContent='Generate image';
    // b3: warn matni model nomi bilan (olov-rang ogohlantirish)
    var wsp=$('igRefWarn')&&$('igRefWarn').querySelector('span:last-child');
    if(wsp)wsp.innerHTML=String(meta.label||'This model').replace(/[<>&]/g,'')+' <b>requires</b> at least 1 reference';
    recost(); refreshGen();
    // Model-aware UI yangilanishi (audit fix): limit matni (N / max) + So'nggi grid kartalari
    // (Referens tugmasi refMode'ga bog'liq) — model almashganda QAYTA chiziladi (vg bilan bir xil).
    try{ if(typeof updRefMeta==='function')updRefMeta(); }catch(_){}
    try{ if(typeof renderRecentGrid==='function')renderRecentGrid(); }catch(_){}
  }
  function ensureSession(){
    if(st.sessionId)return Promise.resolve(st.sessionId);
    return studioPost('/api/studio/gen/sessions',{mode:'image'}).then(function(s){ st.sessionId=(s&&s.id)||null; if(s&&s.id){ window.__axwsSess=window.__axwsSess||{}; window.__axwsSess.imggen=s; } return st.sessionId; }); // SC_29: lazy sessiya header'ga ham
  }

  // ---- chip openerlar ----
  // BATCH8 P3 — model sheet qidiruvi (sanksiyalangan): mavjud .mrowb qatorlarini nomi bo'yicha filtrlaydi.
  // Faqat client-side — qator markup'i/tanlov handlerlari/tartib/narx TEGILMAYDI. Sheet ochilganda tozalanadi.
  function afMFilter(){
    var inp=$('igMSrch'),list=$('igMList'),none=$('igMNone'); if(!list)return;
    var q=inp?String(inp.value||'').toLowerCase().replace(/^\s+|\s+$/g,''):'';
    var rows=list.querySelectorAll('.mrowb'),shown=0,i,b,tn,nm;
    for(i=0;i<rows.length;i++){
      b=rows[i].querySelector('.mtx b'); tn=b&&b.firstChild;
      nm=((tn&&tn.nodeType===3?tn.textContent:(b?b.textContent:rows[i].textContent))||'').toLowerCase();
      if(!q||nm.indexOf(q)>=0){ rows[i].style.display=''; shown++; } else rows[i].style.display='none';
    }
    if(none)none.style.display=(q&&shown===0)?'':'none';
  }
  function afMReset(){ var inp=$('igMSrch'); if(inp)inp.value=''; afMFilter(); }
  (function(){ var s=$('igMSrch'); if(s)s.addEventListener('input',afMFilter); })();
  $('igModelSeg').addEventListener('click',function(){ renderModelSheet(); afMReset(); openSheet('igMSheet',$('igModelSeg')); });
  // P16 — bitta sozlama chipi xulosasi + guruhlangan sheet (Ratio · Quality · ×N bitta popover'da)
  function igSummary(){ var b=[st.ar]; if(meta.hasQuality)b.push(cap(st.q)); b.push('×'+st.n); return b.join(' · '); }
  function afterIgSet(){ var sv=$('igSetVal'); if(sv){ sv.textContent=igSummary(); var _iss=$('igSetSeg'); if(_iss)_iss.title='Output: '+igSummary(); } buildIgSettings(); } // tanlovdan keyin: xulosa + pill'lar qayta belgilansin (sheet OCHIQ qoladi)
  function buildIgSettings(){
    buildPills($('igArPills'),meta.ars,st.ar,function(v){ st.ar=v; afterIgSet(); });
    var qsec=$('igQSec'); if(qsec)qsec.style.display=meta.hasQuality?'':'none';
    if(meta.hasQuality){ var qArr=meta.quals.map(function(q){ return {val:q,label:cap(q)}; }); buildPills($('igQPills'),qArr,st.q,function(v){ st.q=v; recost(); afterIgSet(); }); }
    buildPills($('igNPills'),meta.counts,st.n,function(v){ st.n=v; recost(); afterIgSet(); });
  }
  $('igSetSeg').addEventListener('click',function(){ buildIgSettings(); openSheet('igSetSheet',$('igSetSeg')); });

  // ---- @imgN token promptga (kursor joyiga) — #6: chip-editor pill sifatida ----
  function insertToken(tok){
    igEd.insertText(tok+' ',true); // parse: mos referens bo'lsa atom pill, bo'lmasa oddiy matn
  }
  // P13 (Artlist paritet): referens o'chirilganda dangling @imgN qolmasin — tokenni olib tashlab,
  // qolgan @img(k) (k>n) larni bir pastga surib qayta raqamlaymiz (referens tartibi bilan mos).
  function igStripMention(removedIdx){
    var ta=$('igPrompt'); if(!ta)return; var n=removedIdx+1;
    var s=ta.value.replace(new RegExp('\\s*@img'+n+'(?![0-9])','g'),'');
    s=s.replace(/@img(\d+)/g,function(m,d){ var k=parseInt(d,10); return k>n?('@img'+(k-1)):m; });
    if(s!==ta.value){ ta.value=s; try{ta.dispatchEvent(new Event('input'));}catch(e){} }
  }
  // Barcha @imgN'ni olib tashlash (model referens qabul qilmaganda / hammasi tozalanganda).
  function igStripAllMentions(){
    var ta=$('igPrompt'); if(!ta)return;
    var s=ta.value.replace(/\s*@img\d+/g,'');
    if(s!==ta.value){ ta.value=s; try{ta.dispatchEvent(new Event('input'));}catch(e){} }
  }
  // Generate OLDIDAN orphan mention (st.refs.length'dan katta @imgN — o'chirilgan/renumber qolgan)
  // tozalash — provayderga buzuq referens ketmasin.
  function igSanitizeMentions(){
    var ta=$('igPrompt'); if(!ta)return; var cnt=st.refs.length;
    var s=ta.value.replace(/@img(\d+)/g,function(m,d){ return (parseInt(d,10)>cnt)?'':m; }).replace(/[ \t]{2,}/g,' ').trim();
    if(s!==ta.value){ ta.value=s; }
  }

  // ---- referens tile'lar (@img1.. tartibda, × renumber) ----
  function renderRefs(){
    var g=$('igRefgrid');
    Array.prototype.slice.call(g.querySelectorAll('.reftile')).forEach(function(n){ g.removeChild(n); });
    var lim=igActiveRefLimit(); // P13 — faol referenslar soni (model proyeksiyasi)
    st.refs.forEach(function(ref,i){
      var active=i<lim; // P13 — limitdan tashqari / model qo'llamasa: XIRA, lekin joyida
      var t=document.createElement('div'); t.className='reftile'+(active?'':' dim');
      t.style.backgroundImage='url("'+ref.dataUrl+'")';
      t.title=active?('Add @img'+(i+1)+' to prompt'):(meta.refOk?('Not sent — '+(meta.label||'this model')+' uses '+lim+' reference'+(lim>1?'s':'')):((meta.label||'this model')+" doesn't use references"));
      var tag=document.createElement('div'); tag.className='tag'; tag.textContent='@img'+(i+1); t.appendChild(tag);
      if(ref.loading){ var sp=document.createElement('div'); sp.className='spin'; sp.innerHTML='<i></i>'; t.appendChild(sp); }
      var x=document.createElement('div'); x.className='rx'; x.textContent='✕';
      x.addEventListener('click',function(ev){ ev.stopPropagation(); var idx=st.refs.indexOf(ref); if(idx>=0){ st.refs.splice(idx,1); igStripMention(idx); } renderRefs(); updRefMeta(); refreshGen(); }); // P13: foydalanuvchi o'chirsa @imgN cascade-strip (#6: AVVAL splice — pill'lar yangi ro'yxatdan thumb oladi)
      t.appendChild(x);
      t.addEventListener('click',function(){ if(!ref.loading&&i<igActiveRefLimit())insertToken('@img'+(st.refs.indexOf(ref)+1)); });
      g.appendChild(t); // igRefAdd endi prow'da — grid faqat reftile'lar (bo'sh bo'lsa CSS yashiradi)
    });
  }
  function updRefMeta(){
    // SC_19: doimiy matn o'rniga [+] tugmadagi ixcham "N/max" badge (faqat ≥1 ref bo'lsa);
    // to'liq tushuntirish tooltip'da. Nofaol hovuz soni ham tooltip'ga kiradi.
    var max=meta.maxRefs||0, inact=igInactiveRefCount();
    // SC_43: total badge O'RNIGA yagona ikonka sig'im indikatori (image kind)
    var ct=$('igRefCt'); if(ct)ct.style.display='none';
    if(typeof window.afRenderCapInd==='function')window.afRenderCapInd('igCapInd', max>0 ? [
      {k:'image',used:st.refs.length,lim:max,tip:'Up to '+max+' image'+(max===1?'':'s')+' to edit or combine'+(inact>0?(' · '+inact+' kept (unused)'):'')}
    ] : []);
    var add=$('igRefAdd');
    if(add)add.title='Add references — images to edit or combine · type @ to mention'
      +(max?(' · '+st.refs.length+'/'+max):'')
      +((meta.refMode==='required'&&st.refs.length===0)?' · required for this model':'')
      +(inact>0?(' · '+inact+' kept (unused)'):'');
  }

  // SC_19: referens limiti — composer ICHIDA ikonkali tranzient pill (~3s avto-yopiladi)
  var _igLimT=null;
  function igShowLimitNote(max){
    var n=$('igLimitNote'), tx=$('igLimitNoteTx');
    if(!n){ toast('Max '+max+' reference(s)','warning'); return; }
    if(tx)tx.textContent='Reference limit reached — '+max+'/'+max;
    n.classList.add('on'); clearTimeout(_igLimT);
    _igLimT=setTimeout(function(){ n.classList.remove('on'); },3000);
  }
  // dataUrl → push (spinner) → R2 yuklash → ref.url; xato bo'lsa olib tashlash
  function addRef(dataUrl){
    if(!dataUrl)return;
    if(st.refs.length>=meta.maxRefs){ igShowLimitNote(meta.maxRefs); return; } // SC_19: ikonkali ichki notice
    var ref={dataUrl:dataUrl,url:null,loading:true};
    st.refs.push(ref); renderRefs(); updRefMeta(); refreshGen();
    studioPost('/api/studio/gen/ref-upload',{dataUrl:dataUrl}).then(function(u){
      ref.url=(u&&u.url)||null;
      if(!ref.url)throw new Error('Empty upload response');
    }).catch(function(err){
      var idx=st.refs.indexOf(ref); if(idx>=0)st.refs.splice(idx,1);
      toast((err&&err.message)||'Failed to upload reference','error');
    }).then(function(){
      ref.loading=false; renderRefs(); updRefMeta(); refreshGen();
    });
  }

  // natijani to'g'ridan referensga — URL allaqachon R2'da (qayta yuklash shart emas)
  function addRefReady(url){
    if(!url)return;
    if(!meta.refOk){ toast('This model does not accept references','warning'); return; }
    if(st.refs.length>=meta.maxRefs){ toast('Max '+meta.maxRefs+' reference(s)','warning'); return; }
    st.refs.push({dataUrl:url,url:url,loading:false}); renderRefs(); updRefMeta(); refreshGen();
    toast('Added as @img'+st.refs.length+' reference','success');
  }

  // ---- CEP fayl o'qish → data-URL ----
  // Node modulини ISHONCHLI olish: CEP --enable-nodejs'да bare `require` har doim ko'rinmaydi —
  // CEP `cep_node` global'ini in'eksiya qiladi (cep_node.require). Bir nechta yo'lni sinaymiz.
  function nodeRequire(modName){
    try{ if(typeof require==='function')return __ffRequire(modName); }catch(e){}
    try{ if(typeof cep_node!=='undefined'&&cep_node&&cep_node.require)return cep_node.__ffRequire(modName); }catch(e){}
    try{ if(typeof window!=='undefined'&&window.cep_node&&window.cep_node.require)return window.cep_node.__ffRequire(modName); }catch(e){}
    try{ if(typeof window!=='undefined'&&typeof window.require==='function')return window.__ffRequire(modName); }catch(e){}
    return null;
  }
  // showOpenDialog (va ba'zi host) `file:///Users/.../x.jpg` qaytaradi — Node fs/cep.fs ODDIY yo'l kutadi
  // (file:// → ENOENT/err=3). Shu sabab o'qishdan OLDIN normalizatsiya: file:// strip + URI-decode (%20 → bo'shliq).
  function toFsPath(p){
    if(!p)return p;
    p=String(p);
    if(p.indexOf('file://')===0){ p=p.replace(/^file:\/\//,''); }
    try{ p=decodeURIComponent(p); }catch(e){}
    return p;
  }
  // Diskdagi rasmni dataURL'ga o'qiydi. AVVAL Node fs (cep_node.require — istalgan binary → base64,
  // bo'shliq/maxsus belgili path ham ishlaydi), keyin cep.fs.readFile fallback. Aniq sabab `_why`да.
  function readDataUrl(path){
    readDataUrl._why='';
    var fp=toFsPath(path); // file:///Users/.../x.jpg → /Users/.../x.jpg ; %20 → bo'shliq
    // 1) Node fs
    try{
      var fsmod=nodeRequire('fs');
      if(fsmod&&fsmod.readFileSync){
        var buf=fsmod.readFileSync(fp);
        if(buf&&buf.length){ try{console.log('[ig] node fs o\'qildi:',fp,buf.length,'bayt');}catch(_){} return 'data:'+mime(fp)+';base64,'+buf.toString('base64'); }
        readDataUrl._why='node fs: bo\'sh fayl';
      } else { readDataUrl._why='node __ffRequire("fs") topilmadi'; }
    }catch(e1){ readDataUrl._why='node fs: '+String(e1&&e1.message||e1); try{console.warn('[ig] node readFileSync xato:',fp,String(e1));}catch(_){} }
    // 2) Fallback: cep.fs.readFile Base64
    try{
      if(window.cep&&window.cep.fs&&window.cep.fs.readFile){
        var enc=(window.cep.encoding&&window.cep.encoding.Base64)||'Base64';
        var r=window.cep.fs.readFile(fp,enc);
        try{console.log('[ig] cep.fs.readFile',fp,'err=',(r&&r.err),'len=',(r&&r.data?r.data.length:0));}catch(_){}
        if(r&&(r.err===0||r.err==null)&&r.data){ return 'data:'+mime(fp)+';base64,'+r.data; }
        readDataUrl._why=readDataUrl._why+' | cep.fs err='+(r&&r.err);
      } else { readDataUrl._why=readDataUrl._why+' | cep.fs.readFile yo\'q'; }
    }catch(e2){ readDataUrl._why=readDataUrl._why+' | cep.fs: '+String(e2); try{console.warn('[ig] cep.fs.readFile xato:',String(e2));}catch(_){} }
    try{console.warn('[ig] readDataUrl NULL:',fp,'| sabab:',readDataUrl._why);}catch(_){}
    return null;
  }
  function readErr(){ return readDataUrl._why?(' ('+readDataUrl._why+')'):''; }

  // ---- host-call (jsx) helper — listProjectFootage / exportTimelineFrame ----
  function hostCall(fn){ return new Promise(function(res){
    if(typeof csInterface==='undefined'||!csInterface){ res(null); return; }
    try{ var ed=csInterface.getSystemPath((typeof SystemPath!=='undefined'&&SystemPath.EXTENSION)?SystemPath.EXTENSION:'extension');
      var jp=(ed+'/jsx/host.jsx').replace(/\\/g,'/');
      csInterface.evalScript('(function(){$.evalFile('+JSON.stringify(jp)+'); return '+fn+'();})()',function(raw){
        try{console.log('[ig] host '+fn+' raw:',raw);}catch(_){}
        var r=null; try{ r=raw?JSON.parse(raw):null; }catch(e){ r=null; }
        if(r&&!r.ok&&r.reason){ try{console.warn('[ig] host '+fn+' xato:',r.reason);}catch(_){} }
        res(r||null); }); // {ok:false,reason} ham qaytadi (chaqiruvchi xatoni ko'rsatadi)
    }catch(e){ try{console.warn('[ig] host '+fn+' eval xato:',String(e));}catch(_){} res(null); }
  }); }

  // ---- ＋ Qo'shish → manba menyu (3 ta manba) ----
  $('igRefAdd').addEventListener('click',function(){
    if(st.refs.length>=meta.maxRefs){ toast('Max '+meta.maxRefs+' reference(s)','warning'); return; }
    openSheet('igAddSheet',$('igRefAdd')); // manba menyu — ＋Referens tugmasiga bog'lab (popover)
  });
  // Copy-paste: clipboarddagi RASM → referens (rasm tool ko'rinib turganda; matn promptga odatdagidek yopishadi).
  document.addEventListener('paste',function(e){
    try{
      if(!meta.refOk)return; // referenssiz model — referens qabul qilmaydi (FIX3: maxRefs=0 ham)
      var ip=$('igPrompt'); if(!ip||ip.offsetParent===null)return; // rasm tool ko'rinmasa — aralashmaymiz
      var items=(e.clipboardData&&e.clipboardData.items)||[];
      var img=null; for(var i=0;i<items.length;i++){ if(items[i].type&&items[i].type.indexOf('image/')===0){ img=items[i]; break; } }
      if(!img)return;
      e.preventDefault();
      if(st.refs.length>=meta.maxRefs){ toast('Max '+meta.maxRefs+' reference(s)','warning'); return; }
      var blob=img.getAsFile(); if(!blob)return;
      var rd=new FileReader();
      rd.onload=function(){ addRef(String(rd.result||'')); toast('Image added from clipboard','success'); };
      rd.readAsDataURL(blob);
    }catch(_){}
  });
  // 1) Fayl yuklash
  $('igSrcFile').addEventListener('click',function(){
    closeSheets();
    if(!(window.cep&&window.cep.fs&&typeof window.cep.fs.showOpenDialog==='function')){ toast('Upload only works inside Premiere Pro','warning'); return; }
    var exts=['png','jpg','jpeg','webp','gif','bmp'],r;
    try{ r=window.cep.fs.showOpenDialog(true,false,'Choose image(s)','',exts); }catch(e){ toast('Dialog error: '+String(e),'error'); return; }
    var paths=(r&&r.data)||[];
    try{console.log('[ig] showOpenDialog →',paths.length,'fayl:',paths);}catch(_){}
    if(!paths.length)return; // bekor qilindi
    // Bo'sh slot qadar qo'shamiz (limitдан oshmaydi) + bitta umumiy ogohlantirish (spam emas).
    var imgs=paths.filter(isImg), slots=Math.max(0,(meta.maxRefs||0)-st.refs.length), take=imgs.slice(0,slots);
    take.forEach(function(p){ var d=readDataUrl(p); if(d)addRef(d); else toast('Could not read file: '+base(p)+readErr(),'error'); });
    if(imgs.length>take.length)toast(take.length+' added (max '+meta.maxRefs+')','info');
  });
  // #9 — My Library manbasi: o'z gen natijalaringizdan rasm referens (afGallery keshi;
  // mavjud onRef yo'li — addRefReady — bilan AYNAN bir xil biriktirish, yangi upload YO'Q).
  $('igSrcLib').addEventListener('click',function(){
    closeSheets();
    openSheet('igLibSheet',$('igRefAdd'));
    var host=$('igLibList'); if(!host)return;
    host.innerHTML='<div class="axighint" style="flex:0 0 100%">Loading…</div>';
    if(!(window.afGallery&&window.afGallery.load)){ host.innerHTML='<div class="axighint" style="flex:0 0 100%">Library is unavailable</div>'; return; }
    window.afGallery.load().then(function(items){
      // refAllowed bilan bir xil filtr: rasm tool → faqat RASM natijalar
      var pics=(items||[]).filter(function(it){ return (it.cat||'image')==='image' && it.url; });
      if(!pics.length){ host.innerHTML='<div class="axighint" style="flex:0 0 100%">No generations yet — generate something first.</div>'; repositionSheet('igLibSheet'); return; }
      host.innerHTML='';
      pics.forEach(function(it){
        var d=document.createElement('div');
        d.style.cssText='aspect-ratio:1/1;border-radius:8px;overflow:hidden;cursor:pointer;border-width:1px;border-style:solid;border-color:rgba(255,255,255,.08);background:#0c0f14 url("'+String(it.thumb||it.url).replace(/"/g,'&quot;')+'") center/cover no-repeat';
        d.title=(it.title||'').slice(0,60);
        d.addEventListener('click',function(){
          if(st.refs.length>=meta.maxRefs){ toast('Max '+meta.maxRefs+' reference(s)','warning'); return; }
          addRefReady(it.url); closeSheets(); toast('Reference added from My Library','success');
        });
        host.appendChild(d);
      });
      repositionSheet('igLibSheet');
    }).catch(function(){ host.innerHTML='<div class="axighint" style="flex:0 0 100%">Couldn&#39;t load your library — try again</div>'; });
  });
  // 2) Project paneldan — CHECKBOX multi-select (birdaniga bir nechta rasm; video tool naqshi)
  $('igSrcProj').addEventListener('click',function(){
    closeSheets();
    if(typeof csInterface==='undefined'||!csInterface){ toast('Project panel only works inside Premiere Pro','info'); return; }
    var sel={}, foot=$('igProjFoot'), info=$('igProjInfo'), addBtn=$('igProjAdd');
    if(foot)foot.style.display='flex';
    function slotsLeft(){ return Math.max(0,(meta.maxRefs||0)-st.refs.length); }
    function refreshFoot(){ var n=Object.keys(sel).length; if(info)info.textContent=n+' selected · space left '+slotsLeft(); if(addBtn){ addBtn.textContent='Add'+(n?(' ('+n+')'):''); addBtn.style.opacity=n?'1':'.5'; } }
    if(addBtn)addBtn.onclick=function(){ var paths=Object.keys(sel); if(!paths.length){ toast('Select something first','warning'); return; } paths.forEach(function(p){ if(st.refs.length>=meta.maxRefs)return; var d=readDataUrl(p); if(d)addRef(d); else toast('Could not read file: '+base(p)+readErr(),'error'); }); closeSheets(); };
    $('igProjList').innerHTML='<div class="axighint">Loading…</div>'; openSheet('igProjSheet',$('igRefAdd'));
    hostCall('listProjectFootage').then(function(r){
      if(!$('igProjList'))return;
      if(!r||(r.ok===false)){ $('igProjList').innerHTML='<div class="axighint">Could not get project list'+((r&&r.reason)?': '+r.reason:'')+'</div>'; if(foot)foot.style.display='none'; repositionSheet('igProjSheet'); return; }
      var items=((r&&r.items)||[]).filter(function(it){ return it.mediaType==='image'||isImg(it.mediaPath); });
      if(!items.length){ $('igProjList').innerHTML='<div class="axighint">No matching images found in the project. Upload from file.</div>'; if(foot)foot.style.display='none'; repositionSheet('igProjSheet'); return; }
      $('igProjList').innerHTML='';
      items.forEach(function(it){
        var mp=it.mediaPath||'';
        var o=document.createElement('div'); o.className='opt';
        o.innerHTML='<div class="oi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><b>'+String(it.name||base(mp)).replace(/[<>]/g,'')+'</b><small>'+(it.mediaType||'image')+'</small></div><span class="igprojchk" style="margin-left:auto;font-size:15px;color:var(--acc);width:20px;text-align:center">○</span>';
        (function(path,row){ o.addEventListener('click',function(){
          if(!path)return;
          var chk=row.querySelector('.igprojchk');
          if(sel[path]){ delete sel[path]; row.style.backgroundColor=''; if(chk)chk.textContent='○'; }
          else { if(Object.keys(sel).length>=slotsLeft()){ toast('Not enough space left (≤'+slotsLeft()+')','warning'); return; } sel[path]=true; row.style.backgroundColor='var(--accent-soft)'; if(chk)chk.textContent='✓'; }
          refreshFoot();
        }); })(mp,o);
        $('igProjList').appendChild(o);
      });
      refreshFoot(); repositionSheet('igProjSheet');
    }).catch(function(e){ if($('igProjList'))$('igProjList').innerHTML='<div class="axighint">Could not get project list: '+String(e)+'</div>'; repositionSheet('igProjSheet'); });
  });
  // 3) Timeline'dan (joriy kadr → PNG)
  $('igSrcTl').addEventListener('click',function(){
    closeSheets();
    if(typeof csInterface==='undefined'||!csInterface){ toast('Timeline frame only works inside Premiere Pro','info'); return; }
    toast('Exporting frame…','info');
    hostCall('exportTimelineFrame').then(function(r){
      if(!r||!r.path){ toast('Could not get frame'+((r&&r.reason)?': '+r.reason:' — make sure a comp is open in the Timeline'),'warning'); return; }
      try{console.log('[ig] timeline frame:',r.path);}catch(_){}
      var d=readDataUrl(r.path); if(d)addRef(d); else toast('Could not read frame: '+base(r.path)+readErr(),'error');
    }).catch(function(e){ toast('Frame export error: '+String(e),'error'); });
  });

  // ---- prompt auto-grow + validatsiya + @ mention ----
  var ta=$('igPrompt');
  var mention=$('igMention');
  // #6 — chip-editor: pill (thumb + "@Image 1") atom token; .value get/set meros (string kod o'zgarmagan)
  var igEd=window.afChipEditor(ta,{
    refs:function(){ return { image: st.refs.map(function(r){ return r.dataUrl||r.url||null; }) }; },
    token:function(kind,n){ return kind==='image'?('@img'+n):('@'+kind+n); }, // rasm tool kanonik: @imgN
    interceptEnter:function(){ return mention.classList.contains('on')?pickMentionActive():false; },
    // P15 — undo snapshoti REFERENS HOVUZINI ham saqlaydi/tiklaydi (raw = st.refs obyektlari)
    snapshotRefs:function(){ return { image: st.refs.map(function(r){ return r.dataUrl||r.url||null; }), raw: st.refs.slice() }; },
    restoreRefs:function(rs){ st.refs=(rs&&rs.raw)?rs.raw.slice():[]; try{ renderRefs(); updRefMeta(); refreshGen(); }catch(e){} },
    // P14 — paste'dagi rasm fayllar (screenshot ham) → referens; atCaret bo'lsa kursorga @img pill
    onFiles:function(files,o){ (files||[]).forEach(function(f){ if(!/^image\//.test(f.type||'')){ toast('Only image references are supported here','warning'); return; } var rd=new FileReader(); rd.onload=function(){ if(igEd)igEd.commit(); addRef(String(rd.result||'')); if(o&&o.atCaret&&igEd)setTimeout(function(){ igEd.insertText('@img'+st.refs.length+' ',true); },0); }; rd.readAsDataURL(f); }); }
  });
  function grow(){} // #6: chipedit balandligi CSS max-height bilan — JS o'lchash kerak emas
  ta.addEventListener('input',function(){ refreshGen(); checkMention(); });
  ta.addEventListener('keydown',function(e){
    if(!mention.classList.contains('on'))return;
    if(e.key==='Escape'){ e.stopPropagation(); e.preventDefault(); hideMention(); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); moveMention(e.key==='ArrowDown'?1:-1); }
  });
  ta.addEventListener('keyup',checkMention); // caret strelka bilan siljiganda ham dropdown holati yangilansin
  ta.addEventListener('blur',function(){ setTimeout(hideMention,150); });

  // @ yozilsa referenslar ro'yxati (autocomplete) — kursordan oldingi @<so'z> ni ushlaydi
  function checkMention(){
    if(!meta.refOk){ hideMention(); return; } // t2i (referenssiz) → @dropdown yo'q (FIX3: maxRefs=0 ham)
    var pre=igEd.textBeforeCaret(); if(pre==null){ hideMention(); return; }
    var m=pre.match(/@(\w*)$/);
    if(m)showMention(m[1]); else hideMention();
  }
  var menIdx=0;
  function menItems(){ return mention.querySelectorAll('.mitem'); }
  function moveMention(d){
    var its=menItems(); if(!its.length)return;
    menIdx=(menIdx+d+its.length)%its.length;
    Array.prototype.forEach.call(its,function(x,ix){ x.classList.toggle('sel',ix===menIdx); });
  }
  function pickMentionActive(){ // Enter — faol (sel) qatorni tanlash; dropdown ochiq bo'lsa true
    var its=menItems(); if(!its.length)return false;
    var ix=Math.min(menIdx,its.length-1);
    pickMention(parseInt(its[ix].getAttribute('data-i'),10));
    return true;
  }
  function showMention(q){
    if(!mention)return;
    if(st.refs.length===0){ mention.innerHTML='<div class="mh">No references — add an image first</div>'; mention.classList.add('on'); return; }
    q=(q||'').toLowerCase();
    var html='<div class="mh">References</div>',shown=0;
    st.refs.forEach(function(r,i){
      var name='img'+(i+1); // filtr: "img1"/"image1"/"1" prefikslari mos kelsin
      if(q&&name.indexOf(q)!==0&&('image'+(i+1)).indexOf(q)!==0&&String(i+1)!==q)return; shown++;
      html+='<div class="mitem" data-i="'+i+'"><div class="mt" style="background-image:url(\''+(r.dataUrl||r.url||'')+'\')"></div><div><b>@Image '+(i+1)+'</b><small>Image</small></div></div>';
    });
    if(!shown){ hideMention(); return; }
    mention.innerHTML=html; mention.classList.add('on');
    menIdx=0; var its=menItems(); if(its.length)its[0].classList.add('sel'); // klaviatura navigatsiya boshi
    Array.prototype.forEach.call(its,function(el){ el.addEventListener('mousedown',function(ev){ ev.preventDefault(); pickMention(parseInt(el.getAttribute('data-i'),10)); }); });
  }
  function hideMention(){ if(mention)mention.classList.remove('on'); }
  function pickMention(i){
    var pre=igEd.textBeforeCaret(); var m=pre?pre.match(/@(\w*)$/):null;
    if(m)igEd.replaceBeforeCaret(m[0].length,'@img'+(i+1)+' '); // "@so'z" → pill + bo'shliq
    else igEd.insertText('@img'+(i+1)+' ',true);
    hideMention();
  }

  // ---- ✨ Yaxshilash (REAL /gen/prompt/enhance) ----
  var enhancing=false;
  $('igEnhance').addEventListener('click',function(){
    if(enhancing)return;
    var b=ta.value.trim();
    if(!b){ toast('Write a prompt first','warning'); return; }
    // referens bo'lsa @img TARTIBDA R2 url'lari → VISION enhance (rasmlarni ham ko'radi). Yo'q bo'lsa → matn.
    var refUrls=st.refs.map(function(r){ return r.url; }).filter(Boolean);
    // P17 — har klik BITTA idempotency kaliti: studioPost cold-start'da (502/503/504/429/tarmoq) shu
    // kalit bilan sabr qilib qayta uradi → server dedup, IKKINCHI consume YO'Q.
    var body={prompt:b,mode:'image',format:'text',idempotencyKey:afUuid()};
    if(refUrls.length)body.image_urls=refUrls;
    try{ console.log('[ig] enhance →', refUrls.length?('VISION '+refUrls.length+' referens'):'TEXT'); }catch(_){}
    enhancing=true; var en=$('igEnhance'); en.classList.add('busy');
    studioPost('/api/studio/gen/prompt/enhance',body).then(function(e){
      // P28.3 (29a) — API mos kelmagan @mention sabab qayta yozishni RAD ETsa (mentionMismatch),
      // asl prompt qaytadi (o'zgarmaydi) → jimgina "softened" DEMAYMIZ (evasion olib tashlandi).
      if(e&&e.mentionMismatch){ if(typeof e.creditsLeft==='number')setCreditChip(e.creditsLeft); toast('Kept your prompt — the rewrite pointed a reference at the wrong image','info'); }
      else if(e&&e.prompt){ ta.value=(typeof afCleanEnhancedPrompt==='function')?afCleanEnhancedPrompt(e.prompt):String(e.prompt).trim(); grow(); refreshGen(); if(typeof e.creditsLeft==='number')setCreditChip(e.creditsLeft); toast('Prompt enhanced ✨'+(refUrls.length?(' · saw '+refUrls.length+' reference'+(refUrls.length>1?'s':'')):'')+(e&&e.creditsCharged?(' · ✦'+e.creditsCharged):''),'success'); }
      else toast('Could not enhance','error');
    }).catch(function(err){ toast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Enhance error','error'); }).then(function(){ enhancing=false; en.classList.remove('busy'); });
  });

  // ---- parallel gen — job massivi ----
  // Har gen ALOHIDA job ob'ekti. MAX_JOBS gacha bir vaqtda. igGen tugmasi faol joblar MAX_JOBS ga yetganда
  // disabled bo'ladi; aks holda yangi gen boshlash mumkin. Har job mustaqil poll/progress/kredit/refund.
  var activeJobs=[]; var jobSeq=0; var MAX_JOBS=5;
  var POLL_CAP=670; // ~20 daqiqa (foydalanuvchi so'rovi) — sekin 4K/Pro genlar uzilmasin (2026-07-01)
  function pollDelay(t){ return t<6?1000:1800; }

  // Faol job qatorlarini igProg'ga render qiladi.
  // YUQORI progress endi ishlatilmaydi — gen holati pastdagi So'nggi grid kartasida ko'rsatiladi.
  function renderJobs(){ var el=$('igProg'); if(el){ el.classList.remove('on'); el.innerHTML=''; } }

  // Job progress timer (jobId olinganidan keyin boshlaydi) — pastdagi pending kartani yangilaydi.
  function startJobProg(j){
    j.t0=Date.now();
    j.progTimer=setInterval(function(){
      // vaqt-asosli silliq shkala: ~90s da 90% ga yetadi, keyin sekinlashib 97% da to'xtaydi (done→100%)
      var el=(Date.now()-j.t0)/1000;
      var pct=Math.min(97,Math.round(97*(1-Math.exp(-el/45))));
      if(j.pit){ j.pit.progress=pct; if(window.afRecent)window.afRecent.updatePending($('igRecent'),j.seq,pct); }
    },500);
  }

  // Jobni massivdan olib tashlaydi, pending kartani ham tozalaydi, UI yangilaydi.
  function removeJob(j){
    var idx=activeJobs.indexOf(j); if(idx>=0)activeJobs.splice(idx,1);
    if(j.jobId&&window.afJobStore)window.afJobStore.remove(j.jobId); // #31: reyestrdan ham chiqadi
    if(j.progTimer){clearInterval(j.progTimer);j.progTimer=null;}
    if(j.pollTimer){clearTimeout(j.pollTimer);j.pollTimer=null;}
    if(j.pit){ var pi=st.recent.indexOf(j.pit); if(pi>=0)st.recent.splice(pi,1); j.pit=null; }
    renderRecentGrid(); refreshGen();
  }

  // Foydalanuvchi "Bekor qilish" bosdi.
  /** #100 (PX2) — HAQIQIY bekor qilish. Ilgari bu faqat kartani yashirar edi: job serverda
   *  davom etardi, kredit qaytmasdi. Endi serverga `POST /gen/:jobId/cancel` yuboriladi:
   *  navbatdagi (provayderga ketmagan) job bekor qilinadi + TO'LIQ refund; provayder allaqachon
   *  boshlagan bo'lsa server 409 `GENERATION_DISPATCHED` beradi — u holda faqat kutishni
   *  to'xtatamiz va buni ochiq aytamiz (natija History'da chiqadi, kredit yechilgan). */
  function cancelJob(j){
    j.cancelled=true; removeJob(j);
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

  // View'дан chiqishда barcha faol joblarni to'xtatamiz (timer/network leak oldini olish).
  function teardownGen(){
    // SC_21: joblar endi view almashganda BEKOR QILINMAYDI — poll fonда davom etadi
    // (view faqat display bilan yashirinadi, DOM saqlanadi); foydalanuvchi qaytганда
    // pending karta joyida natijaga aylangan bo'ladi. Poll POLL_CAP bilan chegaralangan.
  }
  window.axIGTeardown=teardownGen;
  window.__axIGRunning=function(){ return activeJobs.length; }; // SC_21: global badge uchun

  // ---- generatsiya (REAL, parallel) ----
  function genClick(){
    if(activeJobs.length>=MAX_JOBS){ toast('Max '+MAX_JOBS+' active gens — wait for one to finish','info'); return; }
    igSanitizeMentions(); // P13: orphan @imgN (mavjud referensdan katta) provayderga ketmasin
    // P13 — pre-flight: promptda eslatilgan, lekin joriy modelda NOFAOL (limitdan tashqari) @imgN — ogohlantiramiz
    (function(){ var lim=igActiveRefLimit(); var bad=[]; (ta.value.match(/@img(\d+)/g)||[]).forEach(function(t){ var k=parseInt(t.slice(4),10); if(k>lim&&k<=st.refs.length&&bad.indexOf(k)<0)bad.push(k); }); if(bad.length)toast('@Image '+bad.sort(function(a,b){return a-b;}).join(', @Image ')+' will be ignored by '+(meta.label||'this model'),'info'); })();
    var prompt=ta.value.trim();
    // SC_17: upscale avto-nom shoxi o'chirildi
    if(prompt.length<2){ toast('Write a prompt','warning'); return; }
    if(meta.refMode==='required'&&st.refs.length===0){ toast('Upload a reference','warning'); return; }
    if(anyLoading()){ toast('Reference is uploading — please wait','info'); return; }
    var c=credits();
    if(c!=null&&c<cost()){ toast('Not enough credits — ⚙ Settings › "Top up credits"','error'); return; }
    var j={seq:++jobSeq,jobId:null,prompt:prompt,label:meta.label,jcost:cost(),ar:st.ar,q:st.q,
           cancelled:false,submitted:false,pollTimer:null,progTimer:null,t0:Date.now()};
    activeJobs.push(j);
    // GEN ishlamoqda kartasi — YUQORIDA emas, pastdagi So'nggi grid tepasiga (0-100% shkala)
    j.pit={seq:j.seq,pending:true,prompt:prompt,cat:'image',progress:2,job:j};
    st.recent.unshift(j.pit); renderRecentGrid(); refreshGen();
    var _gb=$('igGen'); if(_gb)_gb.classList.add('busy'); // yuborilmoqda — tugmada spinner
    // @img tartibida URL'lar (@img1=referenceUrls[0]) — P13: FAQAT faollarini (model limitigacha) yuboramiz
    var refUrls=st.refs.slice(0,igActiveRefLimit()).map(function(r){ return r.url; }).filter(Boolean);
    // SC_27: payload aniqligi — quality FAQAT modelda sifat selektori bo'lsa (Lite kabi flat modellarga
    // eski model qiymati ketmasin); referens maydonlari faqat referens BOR bo'lganda.
    var params={aspectRatio:st.ar,count:st.n};
    if(meta.hasQuality)params.quality=st.q;
    if(refUrls.length){ params.referenceUrl=refUrls[0]; params.referenceUrls=refUrls; }
    j.params=params; j.modelId=meta.modelId; // Qayta gen: yangi tugagan kartada ham params/model bo'lsin
    var quote=null;
    ensureMeta().then(function(){
      if(j.cancelled)throw new Error('CANCELLED');
      if(meta.modelId==null)throw new Error('No model found');
      return Promise.all([
        // P17 — quote SOF hisob+imzo; idempotencyKey studioPost'ni cold-start'da qayta urinishga majbur
        // qiladi (server bu maydonni e'tiborsiz qoldiradi — DB yozmaydi/consume qilmaydi).
        studioPost('/api/studio/gen/cost-quote',{modelId:meta.modelId,mode:'image',params,idempotencyKey:afUuid()}),
        ensureSession()
      ]);
    }).then(function(arr){
      if(j.cancelled)throw new Error('CANCELLED');
      quote=arr[0]; var sid=arr[1];
      j.sid=sid; // SC_29: job qaysi sessiyaga yozilishini eslab qolamiz (sessiya almashsa feed'ga aralashmasin)
      return studioPost('/api/studio/gen',{sessionId:sid,mode:'image',modelId:meta.modelId,prompt:prompt,params:params,price:quote.price,costQuoteSignature:quote.signature,idempotencyKey:afUuid()},60000);
    }).then(function(res){
      if(j.cancelled)throw new Error('CANCELLED');
      if(res&&typeof res.creditsLeft==='number')setCreditChip(res.creditsLeft);
      if(!res||!res.jobId)throw new Error('Job was not created');
      j.jobId=res.jobId; j.submitted=true;
      // #31 (PX1): panel yopilsa ham job diskda qoladi → keyingi ochilishда tiklanadi
      if(window.afJobStore)window.afJobStore.add('imggen',{jobId:j.jobId,prompt:j.prompt,cat:'image',cost:j.jcost,sid:j.sid,modelId:j.modelId,params:j.params});
      if(_gb)_gb.classList.remove('busy');
      startJobProg(j); pollJob(j,0);
    }).catch(function(err){
      if(_gb)_gb.classList.remove('busy');
      if(j.cancelled||(err&&err.message==='CANCELLED')){ removeJob(j); return; }
      removeJob(j); toast((typeof friendlyError==='function'?friendlyError(err):(err&&err.message))||'Generation error','error');
    });
  }
  /** #31 (PX1) — panel qayta ochilganda UCHAYOTGAN gen'larni tiklaydi.
   *  Holat manbai — server (`/gen/history?status=active`); prompt/narx/model esa diskdagi
   *  reyestrdan (afJobStore) to'ldiriladi. Karta FAQAT joriy sessiya job'lari uchun
   *  ko'rsatiladi (SC_29), lekin poll hamma tiklangan job uchun ishlaydi — kredit/xabar
   *  oqimi tugallanishi shart. */
  var restoreTried=false;
  function restoreActiveJobs(){
    if(restoreTried)return; restoreTried=true;
    var saved={}; try{ (window.afJobStore?window.afJobStore.list('imggen'):[]).forEach(function(r){ saved[r.jobId]=r; }); }catch(_){}
    studioGet('/api/studio/gen/history?status=active&limit=10&mode=image').then(function(d){
      var items=(d&&d.items)||[]; var live={},added=0;
      items.forEach(function(gn){
        if(!gn||!gn.id)return; live[gn.id]=1;
        if(activeJobs.some(function(x){ return x.jobId===gn.id; }))return; // allaqachon kuzatilyapti
        var rec=saved[gn.id]||{};
        var j={seq:++jobSeq,jobId:gn.id,prompt:(gn.prompt||rec.prompt||''),label:meta.label,
               jcost:(typeof gn.cost==='number'?gn.cost:(rec.cost||0)),cancelled:false,submitted:true,
               pollTimer:null,progTimer:null,t0:Date.now(),sid:gn.sessionId||rec.sid||null,
               params:gn.params||rec.params||null,modelId:gn.modelId||rec.modelId||null};
        activeJobs.push(j); added++;
        if(!j.sid||j.sid===st.sessionId){ j.pit={seq:j.seq,pending:true,prompt:j.prompt,cat:'image',progress:2,job:j}; st.recent.unshift(j.pit); }
        startJobProg(j);
        var ct=Date.parse(gn.createdAt||''); if(ct)j.t0=ct; // progress shkalasi HAQIQIY o'tgan vaqtdan
        pollJob(j,0);
      });
      // serverda endi faol bo'lmagan yozuvlar diskda qolib ketmasin
      Object.keys(saved).forEach(function(id){ if(!live[id]&&window.afJobStore)window.afJobStore.remove(id); });
      if(added){ renderRecentGrid(); refreshGen(); }
    }).catch(function(){ restoreTried=false; }); // tarmoq xatosi — keyingi ochilishda qayta uriniladi
  }
  function pollJob(j,tries){
    if(j.cancelled)return;
    if(tries>POLL_CAP){ removeJob(j); toast('Taking a while — it may still finish, check History🕘 in a bit','warning'); return; }
    studioGet('/api/studio/gen/'+j.jobId).then(function(gn){
      if(j.cancelled)return;
      var s=(gn&&gn.status)||'';
      if(s==='done'){
        if(j.pit&&window.afRecent)window.afRecent.updatePending($('igRecent'),j.seq,100);
        setTimeout(function(){
          var assets=(gn&&gn.assets)||[]; var first=null;
          for(var fi=0;fi<assets.length;fi++){ if(assets[fi]&&assets[fi].url){ first=assets[fi]; break; } }
          // P30 (29c) — status=done LEKIN natija yo'q = provayder kontent rad etdi (success-shaklda!).
          // HALOL ishlaymiz: "Done! charged" ✓ EMAS. Kredit qaytariladi; boshqa-model taklifi.
          if(!first){
            removeJob(j); setCreditChip(credits());
            if(!handleGenRejection(gn, function(id){ var m=(meta.models||[]).filter(function(x){return x.id===id;})[0]; if(m&&typeof setModel==='function'){ if(setModel(m)!==false&&typeof renderModelSheet==='function')renderModelSheet(); } }))
              toast((gn&&gn.error&&typeof friendlyError==='function')?friendlyError({message:gn.error}):'No result was returned — your credits were refunded','error');
            if(typeof loadRecent==='function')setTimeout(function(){ loadRecent(); },1500);
            return;
          }
          if(j.sid&&st.sessionId!==j.sid)j.pit=null; // SC_29: sessiya almashgan — natija BOSHQA sessiya feed'iga kirmaydi
          if(j.pit&&first){
            // pending kartani O'SHA JOYDA natijaga aylantiramiz (So'nggi grid)
            j.pit.pending=false; j.pit.url=first.url; j.pit.thumb=first.thumbUrl||first.url; j.pit.id=(gn&&gn.id)||first.id||null; j.pit.cat='image';
            // Qayta gen: yangi tugagan kartada ham params/modelId bo'lsin (aks holda restore faqat prompt tiklaydi — bug fix)
            j.pit.params=(gn&&gn.params)||j.params||null; j.pit.modelId=(gn&&gn.modelId)||j.modelId||null;
            var pidx=st.recent.indexOf(j.pit); var off=1;
            for(var ai=0;ai<assets.length;ai++){ var a=assets[ai]; if(a&&a.url&&a.url!==first.url){ st.recent.splice((pidx>=0?pidx:0)+off,0,{url:a.url,thumb:a.thumbUrl||a.url,id:(gn&&gn.id)||null,cat:'image',prompt:j.prompt,params:(gn&&gn.params)||j.params||null,modelId:(gn&&gn.modelId)||j.modelId||null}); off++; } }
            j.pit=null; // endi natija — removeJob o'chirmasin
          }
          var idx=activeJobs.indexOf(j); if(idx>=0)activeJobs.splice(idx,1);
          if(j.jobId&&window.afJobStore)window.afJobStore.remove(j.jobId); // #31: tugadi — reyestrdan chiqadi
          if(j.progTimer){clearInterval(j.progTimer);j.progTimer=null;}
          if(j.pollTimer){clearTimeout(j.pollTimer);j.pollTimer=null;}
          renderRecentGrid(); refreshGen(); setCreditChip(credits());
          // SC_21: foydalanuvchi shu workspace'da bo'lsa — karta joyida yangilandi (kichik charge
          // tasdig'i yetadi); boshqa bo'limda bo'lsa — thumbnail + View'li boy toast.
          if(typeof window.afGenDoneNotify==='function')window.afGenDoneNotify('imggen',j.jcost,(first&&(first.thumbUrl||first.url))||null,j.sid||null);
          else toast('Done! ✦'+j.jcost+' charged','success');
          if(window.axSPInvalidate)window.axSPInvalidate(); // SC_29: picker/sessiyalar ro'yxati sanoqlari yangilansin
          if(typeof loadRecent==='function')setTimeout(function(){ loadRecent(); },2000); // history bilan id/thumb sinxron
        },200);
      }else if(s==='failed'){
        removeJob(j); setCreditChip(credits());
        // P30 §3+§4 — kontent rad etilishi bo'lsa halol xato + ✦N qaytarildi + boshqa-model taklifi.
        if(!handleGenRejection(gn, function(id){ var m=(meta.models||[]).filter(function(x){return x.id===id;})[0]; if(m&&typeof setModel==='function'){ if(setModel(m)!==false&&typeof renderModelSheet==='function')renderModelSheet(); } }))
          toast((gn&&gn.error&&typeof friendlyError==='function')?friendlyError({message:gn.error}):((gn&&gn.error)||'Generation failed — credits refunded'),'error');
      }else{
        j.pollTimer=setTimeout(function(){ pollJob(j,tries+1); },pollDelay(tries));
      }
    }).catch(function(){
      if(j.cancelled)return;
      j.pollTimer=setTimeout(function(){ pollJob(j,tries+1); },pollDelay(tries));
    });
  }
  $('igGen').addEventListener('click',genClick);
  ta.addEventListener('keydown',function(e){ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ e.preventDefault(); if(!$('igGen').disabled)genClick(); } });

  // ---- natija kartalari ----
  function mkAct(svg,label,fn){ var d=document.createElement('div'); d.innerHTML=svg+' '+label; d.addEventListener('click',fn); return d; }
  var IC_IMP='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_SAVE='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_DL='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_REF='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8a9 9 0 1 0 2.6-5.7L3 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function downloadUrl(url,name){
    if(IS_CEP){ toast('Download — import into the Premiere Project panel instead','info'); return; }
    // PROBLEM 13 — nom prompt'dan (afGenDlName); berilmasa URL kengaytmasi bilan fallback.
    try{ var a=document.createElement('a'); a.href=url; a.download=name||window.afGenDlName('',url,'image'); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){ toast('Download failed','error'); }
  }
  function importOne(url){ if(typeof aiImportMedia==='function')aiImportMedia(url,'image','png'); else toast('Premiere import only works inside Premiere Pro','info'); }
  function renderResults(assets,jobId,j){
    var urls=(assets||[]).map(function(a){ return a&&a.url; }).filter(Boolean);
    if(!urls.length){ toast('Empty result','warning'); return; }
    st.lastResults=urls.concat(st.lastResults);
    var grid=$('igGrid');
    var total=grid.children.length+urls.length;
    grid.className='rgrid '+(total>=2?'g2':'g1');
    urls.forEach(function(url){
      var card=document.createElement('div'); card.className='rcard';
      var img=document.createElement('img'); img.src=url; img.title='Zoom in';
      img.addEventListener('click',function(){ openLightbox(url); });
      card.appendChild(img);
      // ✕ O'chirish (natijani ro'yxatdan olib tashlash)
      var del=document.createElement('div'); del.className='del'; del.textContent='✕'; del.title='Delete result';
      del.addEventListener('click',function(){ var k=st.lastResults.indexOf(url); if(k>=0)st.lastResults.splice(k,1); if(card.parentNode)grid.removeChild(card); if(!grid.children.length)$('igRes').classList.remove('on'); toast('Result deleted','info'); });
      card.appendChild(del);
      // pastki amallar: Import / ↺ Referensга / ⬇ Yuklab olish
      var ra=document.createElement('div'); ra.className='ra';
      ra.appendChild(mkAct(IC_IMP,'Import',function(){ importOne(url); }));
      ra.appendChild(mkAct(IC_REF,'To reference',function(){ addRefReady(url); }));
      // "Yuklab olish" Premiere (CEP) ichida ishlamaydi (faqat Import) → tugmani ko'rsatmaymiz.
      if(typeof IS_CEP==='undefined'||!IS_CEP)ra.appendChild(mkAct(IC_DL,'Download',function(){ downloadUrl(url,window.afGenDlName((j&&j.prompt)||'',url,'image')); }));
      card.appendChild(ra); grid.insertBefore(card,grid.firstChild); // yangi natijalar tepada
    });
    var jAr=(j&&j.ar)||st.ar; var jQ=(j&&j.q)||st.q;
    $('igResMeta').textContent=grid.children.length+' · '+jAr+(jQ&&!meta.hasQuality?'':jQ?' · '+cap(jQ):'');
    $('igRes').classList.add('on');
    try{ $('igRes').scrollIntoView({behavior:'smooth'}); }catch(e){}
    // So'nggi gridга yangi gen'ni qo'shamiz (bitta karta/gen, id=jobId → o'chirish ishlaydi) + Tarix cache
    var promptLabel=(j&&j.prompt)||ta.value.trim()||'Result';
    try{
      if(urls[0])st.recent.unshift({id:jobId||null,url:urls[0],thumb:urls[0],cat:'image',title:promptLabel});
      st.recent=st.recent.slice(0,12); renderRecentGrid();
      if(window.afGallery)window.afGallery.invalidate();
    }catch(e){}
  }

  // ---- Tarix view'ni ochish (robust: axGo → tasdiq → to'g'ridan fallback) ----
  // SABAB: avval "Barchasi →" faqat window.axGo('history') chaqirardi; axGo ichidagi
  // try/catch xatoni YUTARDI (silent) → view almashmasa hech narsa ko'rinmasdi. Endi:
  // axGo'ni chaqiramiz, v-history.on bo'lganini TEKSHIRAMIZ, bo'lmasa to'g'ridan almashtiramiz.
  function openHistory(){
    closeSheets(); hideMention(); teardownGen(); // tooldan chiqyapmiz → poll/timer tozalansin (go() fallback'da chaqirilmasligi mumkin)
    try{ console.log('[ig] History → opening'); }catch(_){}
    if(typeof window.axGo==='function'){ try{ window.axGo('history'); }catch(e){ try{console.warn('[ig] axGo("history") error:',e);}catch(_){} } }
    var v=document.getElementById('v-history');
    var ok=!!(v&&v.classList.contains('on'));
    try{ console.log('[ig] after axGo v-history.on =',ok); }catch(_){}
    if(ok)return;
    // Fallback — axGo view'ni almashtirmadi: to'g'ridan-to'g'ri DOM bilan
    try{
      document.querySelectorAll('.axroot .view').forEach(function(x){ x.classList.remove('on'); });
      if(v)v.classList.add('on');
      var pb=document.querySelector('.axroot .app > .pbar'); if(pb)pb.style.display=''; // imggen .pbar'ni yashirgan edi
      var sc=document.querySelector('.axroot .scroll'); if(sc)sc.scrollTop=0;
      if(typeof window.axRenderHistory==='function')window.axRenderHistory('all');
      try{ console.log('[ig] fallback: opened v-history directly'); }catch(_){}
    }catch(e2){ try{console.error('[ig] History fallback error:',e2);}catch(_){} toast('Could not open History','error'); }
  }

  // ---- lightbox (natijani to'liq ko'rish + amal paneli: Import / Referensга / Yuklab) ----
  var IC_VID='<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 8l-6 4 6 4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_AUD='<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function importMediaCat(url,cat){ var kind=cat==='video'?'video':(cat==='audio'||cat==='sfx')?'audio':'image'; if(typeof aiImportMedia==='function')aiImportMedia(url,kind,null); else toast('Premiere import only works inside Premiere Pro','info'); }
  function lbAct(svg,label,fn){ var d=document.createElement('div'); d.className='lba'; d.innerHTML=svg+' '+label; d.addEventListener('click',fn); return d; }
  // item = string (rasm) yoki {url,cat}. UMUMIY lightbox: rasm→<img>, video→<video controls autoplay>, ovoz→<audio>.
  function openLightbox(item){
    if(typeof item==='string')item={url:item,cat:'image'};
    window.afRecent.openLightbox(item, igRecentCtx());
  }
  function closeLightbox(){ if(window.afRecent)window.afRecent.closeLightbox(); }

  // ---- SO'NGGI grid (katta kartali 2-ustun; hover ⬇/✕ · ☑ select batch o'chirish; Barchasi → Tarix) ----
  function catLabel(c){ return c==='video'?'Video':(c==='audio')?'Voice':(c==='sfx')?'SFX':'Image'; }
  var RC_DL='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var RC_X='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var RC_CHK='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function recentBatchEl(){ return $('igRecentBatch'); }
  function updRecentBatch(){ var b=recentBatchEl(); if(!b)return; b.classList.toggle('on',st.recentSelect); var bi=$('igRecentBI'); if(bi)bi.textContent=Object.keys(st.recentSel).length+' selected'; }
  // Image tool refKind (model-aware): edit modellar referens oladi (image/@imgN), t2i — yo'q.
  function igRefKind(){ if(meta&&meta.refOk===false)return 'none'; return (meta&&meta.refKind) || ((meta&&meta.refMode&&meta.refMode!=='none')?'image':'none'); } // FIX3: maxRefs=0 → 'none'
  // So'nggi-grid ctx — umumiy afRecent.card/openLightbox shundan foydalanadi (model-aware Referens shu yerda).
  function igRecentCtx(){ return {
    isCEP: IS_CEP,
    list: function(){ return st.recent.filter(function(x){ return x&&x.url&&!x.pending; }); }, // b10: lightbox prev/next
    selecting: function(){ return st.recentSelect; },
    isSelected: function(it){ return !!(it.id&&st.recentSel[it.id]); },
    onToggleSelect: function(it,d){ if(!it.id){ toast('This result is still being saved','info'); return; } if(st.recentSel[it.id])delete st.recentSel[it.id]; else st.recentSel[it.id]=it; d.classList.toggle('sel',!!st.recentSel[it.id]); updRecentBatch(); },
    onImport: function(it){ importMediaCat(it.url,it.cat); },
    onAddProject:function(it){ if(window.afProjectPicker)window.afProjectPicker('gen',it.id); }, // P1
    onAddExplore:function(it){ window.afAddToExplore(it); }, // P3 (step 34)
    onDownload: function(it){ downloadUrl(it.downloadUrl||it.url,window.afGenDlName(it.prompt||it.title,it.url,it.cat)); },
    onDelete: function(it){ recentDelete(it); },
    refAllowed: function(it){ return igRefKind()==='image' && (it.cat||'image')==='image'; },
    onRef: function(it){ addRefReady(it.url); }, // image tool: @imgN referens stripга qo'shadi
    // SC_17: onUpscale olib tashlandi
    onRestore: function(it){ igRestoreGen(it); }
  }; }
  // "Qayta gen" (rasm tool) — ASL MODELga avtomatik o'tib, prompt + referenslar composer'ga qaytadi.
  function igRestoreGen(it){
    if(!it||!it.prompt){ toast('This result has no saved prompt','info'); return; }
    // Video gen → VIDEO TOOLga o'tib o'sha yerda tiklanadi (asl model video modeli — cross-tool).
    if((it.cat||'image')!=='image'){
      if(it.cat==='video'&&typeof window.afVgRestoreGen==='function'&&typeof window.axGo==='function'){
        window.axGo('vidgen');
        setTimeout(function(){ window.afVgRestoreGen(it); },60);
        return;
      }
      ta.value=it.prompt; grow(); hideMention(); refreshGen();
      try{ ta.focus(); }catch(_){ }
      toast('Prompt restored (this is a voice/SFX gen — its references don\'t apply to the image tool)','info');
      return;
    }
    var doRestore=function(){
      var p=it.params||{}; var restored=0;
      st.refs=[]; // restore = holatni ALMASHTIRISH — eski referenslar limit/duplikatga to'sqinlik qilmasin
      var urls=Array.isArray(p.referenceUrls)?p.referenceUrls:(p.referenceUrl?[p.referenceUrl]:[]);
      if(urls.length&&meta.refOk){
        urls.forEach(function(u){
          if(typeof u!=='string'||!u)return;
          if(st.refs.length>=meta.maxRefs)return;
          if(st.refs.some(function(r){return r.url===u;}))return;
          st.refs.push({dataUrl:u,url:u,loading:false}); restored++;
        });
      }
      renderRefs(); updRefMeta();
      ta.value=it.prompt; grow(); hideMention(); refreshGen();
      try{ ta.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_){ }
      try{ ta.focus(); }catch(_){ }
      toast('Prompt restored'+(restored?(' · '+restored+' reference(s) reconnected'):''),'success');
    };
    // ASL modelga o'tish — gen qaysi modelda qilingan bo'lsa restore ham o'sha modelda.
    var tgt=(it.modelId!=null)?String(it.modelId):null;
    ensureMeta().then(function(){
      if(tgt&&String(meta.modelId)!==tgt){
        var m=(meta.models||[]).filter(function(x){return String(x.id)===tgt;})[0];
        if(m){
          st.refs=[]; igStripAllMentions(); renderRefs(); updRefMeta(); hideMention(); // refs bo'sh → setModel tasdiq so'ramaydi
          if(setModel(m)!==false){ renderModelSheet(); toast((m.label||'Model')+' — switched to the original generation model','info'); }
        } else toast('Original model is not available right now — restoring on the current model','info');
      }
      doRestore();
    }).catch(function(){ doRestore(); });
  }
  window.afIgRestoreGen=igRestoreGen; // cross-tool: video tool rasm genini shu yerga uzatadi
  function renderRecentGrid(){
    var r=$('igRecent'); if(!r)return; r.innerHTML='';
    r.className='recentgrid'+(st.recentSelect?' selmode':'');
    // pending (gen ishlamoqda) itemlarni saqlaymiz + url bo'yicha dedup, eng yangisi oldinda
    var pend=[],seen={},uniq=[];
    st.recent.forEach(function(it){ if(it&&it.pending){ pend.push(it); } else if(it&&it.url&&!seen[it.url]){ seen[it.url]=1; uniq.push(it); } });
    st.recent=pend.concat(uniq);
    // SC_41 PART B: bo'sh (0-generatsiya) sessiya feed maydonida HECH NARSA — "No generations yet" hero o'chirildi.
    var _rs=$('igRecentSect');
    (window.__axwsLoading=window.__axwsLoading||{}).imggen=((recentLoading||!recentLoaded)&&!uniq.length&&!recentError); // SC_46: header "loading…" (0 flash emas)
    if(!pend.length){
      // SC_46: uch holatli mashina — LOADING (yoki hali yuklanmagan) → skeleton; ERROR → Retry;
      //   READY-EMPTY (fetch tugadi, 0 element) → hech narsa. Bo'sh branch HECH QACHON boshlang'ich holat emas.
      if(recentError&&!uniq.length){ if(_rs)_rs.style.display=''; r.innerHTML='<div class="empt"><b>Failed to load recent</b>'+String(recentError)+'<br><div role="button" tabindex="0" type="button" onclick="if(window.afIgRetryRecent)window.afIgRetryRecent()">↻ Retry</div></div>'; updRecentBatch(); return; }
      if((recentLoading||!recentLoaded)&&!uniq.length){ if(_rs)_rs.style.display=''; r.innerHTML=afRecentSkel(); updRecentBatch(); return; }
      if(!uniq.length){ if(_rs)_rs.style.display='none'; r.innerHTML=''; updRecentBatch(); return; }
    }
    if(_rs)_rs.style.display='';
    var ctx=igRecentCtx(); var pctx={ onCancel:function(it){ if(it.job)cancelJob(it.job); } };
    // P23 — element identity: mavjud natija kartalarini URL bo'yicha QAYTA ishlatamiz (bir gen tugaganda
    // butun grid qayta yaratilmasin → boshqa kartalarning <img>/<video> tugunlari saqlanadi, flash/reflow yo'q).
    // Select-mode'da (checkbox holati) yoki xato'da to'liq qayta quramiz (kam uchraydi, foydalanuvchi boshlaydi).
    var reuse=!st.recentSelect;
    var cache=renderRecentGrid._nc||(renderRecentGrid._nc={});
    var frag=document.createDocumentFragment();
    pend.forEach(function(it){ frag.appendChild(window.afRecent.pendingCard(it,pctx)); }); // pending — har doim yangi
    var used={};
    uniq.slice(0,12).forEach(function(it){
      var key=it.url; var node=reuse?cache[key]:null;
      if(!node){ node=window.afRecent.card(it,ctx); if(reuse)cache[key]=node; }
      used[key]=1;
      frag.appendChild(node); // mavjud tugunni KO'CHIRADI (identity saqlanadi), yangisini qo'shadi
    });
    for(var k in cache){ if(!used[k])delete cache[k]; } // eskirgan keshni tozalash
    r.innerHTML=''; r.appendChild(frag); // reused tugunlar frag'ga ko'chgan → wipe ularni yo'qotmaydi
    updRecentBatch();
  }
  // bitta gen o'chirish (DELETE /gen/:jobId) — tasdiq bilan
  function recentDelete(it){
    if(!it.id){ toast('This result cannot be deleted yet','info'); return; }
    window.afConfirm('Delete this? This cannot be undone.',{ok:"Delete",danger:true}).then(function(ok){
      if(!ok)return;
      studioDelete('/api/studio/gen/'+it.id).then(function(){
        st.recent=st.recent.filter(function(x){ return !(x.id===it.id||x.url===it.url); }); delete st.recentSel[it.id];
        if(window.afGallery)window.afGallery.invalidate(); renderRecentGrid(); toast('Deleted','success');
      }).catch(function(err){ toast((err&&err.message)||'Delete failed','error'); });
    });
  }
  function recentBatchDelete(){
    var items=Object.keys(st.recentSel).map(function(k){ return st.recentSel[k]; }).filter(function(x){ return x&&x.id; });
    if(!items.length){ toast('Select something first','warning'); return; }
    window.afConfirm('Delete '+items.length+' result(s)? This cannot be undone.',{ok:"Delete",danger:true}).then(function(ok){
      if(!ok)return;
      var done=0,fail=0,total=items.length;
      items.forEach(function(it){ studioDelete('/api/studio/gen/'+it.id).then(function(){
          done++; st.recent=st.recent.filter(function(x){ return !(x.id===it.id||x.url===it.url); }); delete st.recentSel[it.id];
        }).catch(function(){ fail++; }).then(function(){
          if(done+fail===total){ st.recentSelect=(Object.keys(st.recentSel).length>0); var sb=$('igRecentSel'); if(sb)sb.classList.toggle('on',st.recentSelect); if(window.afGallery)window.afGallery.invalidate(); renderRecentGrid(); toast(done+' deleted'+(fail?(' · '+fail+' failed'):''), fail?'warning':'success'); }
        }); });
    });
  }
  // dastlabki So'nggi — foydalanuvchining oxirgi gen'lari (tool ochilganda; 25 daqiqada
  // qayta imzolash uchun yangilanadi — signed URL 1 soatda eskiradi, #8 stale fix).
  var recentLoaded=false,recentLoading=false,recentError='',recentLoadedAt=0;
  function loadRecent(force){
    if(recentLoading||!$('igRecent'))return;
    if(recentLoaded&&!force&&(Date.now()-recentLoadedAt<25*60*1000))return;
    var v=document.getElementById('v-imggen'); if(!v||!v.classList.contains('on'))return; // tool ochiq bo'lsa
    // SC_29: feed FAQAT faol sessiya bilan chegaralangan (global /gen/history EMAS).
    // Sessiya yo'q (yangi sessiya) → bo'sh feed, so'rov yuborilmaydi.
    if(!st.sessionId){ recentLoaded=true; recentLoading=false; recentLoadedAt=Date.now(); recentError=''; st.sessTotal=0; st.audCount=0; renderRecentGrid(); return; }
    var sid=st.sessionId;
    recentLoading=true; recentError=''; renderRecentGrid(); // "Yuklanmoqda…" — bo'sh ko'rinmasin (cold-start sekin)
    studioGet('/api/studio/gen/sessions/'+encodeURIComponent(sid)+'/generations?perPage=12&status=done').then(function(d){
      if(sid!==st.sessionId){ recentLoading=false; return; } // sessiya almashdi — eskirgan javob tashlanadi
      var aud=0;
      (((d&&d.items)||[])).forEach(function(g){
        var a=(g.assets&&g.assets[0])||{}; var url=a.url; if(!url)return;
        var c=g.mode==='video'?'video':(g.mode==='voice'||g.mode==='music')?'audio':g.mode==='sfx'?'sfx':'image';
        if(c==='audio'||c==='sfx'){ aud++; return; } // Visuals feed'ida audio karta chiqmaydi (SC_29 filtr)
        var ex=null; st.recent.some(function(x){ if(x.id===g.id||x.url===url){ex=x;return true;} return false;});
        if(ex){ ex.url=url; ex.thumb=a.thumbUrl||url; ex.display=a.displayUrl||null; ex.preview=a.previewUrl||null; ex.width=a.width||null; ex.height=a.height||null; } // P9: qayta imzolangan URL'lar
        else st.recent.push({id:g.id,url:url,thumb:a.thumbUrl||url,display:a.displayUrl||null,preview:a.previewUrl||null,width:a.width||null,height:a.height||null,downloadUrl:a.downloadUrl||null,cat:c,title:(g.prompt||'').trim()||'Result',prompt:(g.prompt||'').trim(),params:g.params||null,modelId:g.modelId||null,cost:(typeof g.cost==='number'?g.cost:null),createdAt:g.createdAt||null});
      });
      st.audCount=aud; st.sessTotal=(d&&typeof d.total==='number')?d.total:null;
      recentLoaded=true; recentLoading=false; recentLoadedAt=Date.now(); st.recent=st.recent.slice(0,12); renderRecentGrid();
    }).catch(function(err){ recentLoaded=false; recentLoading=false; recentError=(err&&err.message)?String(err.message):'Check your internet or session.'; renderRecentGrid(); });
  }
  window.afIgRetryRecent=function(){ recentLoaded=false; recentError=''; loadRecent(true); };
  // P25 — logout/boshqa hisob login: eski foydalanuvchining so'nggi generatsiyalari grid'da qolib ketmasin
  window.afIgClearRecent=function(){ recentLoaded=false; recentLoadedAt=0; recentError=''; st.recent=[]; renderRecentGrid(); };
  // #22: header ↻ — So'nggi genlar + kredit chip qo'lda yangilash
  var igRefr=$('igRefreshBtn'); if(igRefr)igRefr.addEventListener('click',function(){ if(typeof window.afRefreshAll==='function')window.afRefreshAll(); else { setCreditChip(credits()); window.afIgRetryRecent(); } }); // P16: refresh-all
  var igMore=$('igMoreLink'); if(igMore)igMore.addEventListener('click',openHistory);
  // ☑ Tanlash → select rejim toggle
  var igRecentSel=$('igRecentSel'); if(igRecentSel)igRecentSel.addEventListener('click',function(){ st.recentSelect=!st.recentSelect; st.recentSel={}; igRecentSel.classList.toggle('on',st.recentSelect); renderRecentGrid(); });
  // batch bar tugmalari
  (function(){
    var dl=$('igRecentDl'); if(dl)dl.addEventListener('click',function(){ var items=Object.keys(st.recentSel).map(function(k){return st.recentSel[k];}); if(!items.length){toast('Select something first','warning');return;} if(IS_CEP){ toast('Download — import into the Premiere Project panel instead','info'); return; } items.forEach(function(it){ downloadUrl(it.downloadUrl||it.url,window.afGenDlName(it.prompt||it.title,it.url,it.cat)); }); toast(items.length+' downloaded','success'); });
    var del=$('igRecentDel'); if(del)del.addEventListener('click',recentBatchDelete);
    var can=$('igRecentCancel'); if(can)can.addEventListener('click',function(){ st.recentSelect=false; st.recentSel={}; if(igRecentSel)igRecentSel.classList.remove('on'); renderRecentGrid(); });
  })();

  // ---- header 🕘 → Tarix view (xuddi "Barchasi →" kabi) ----
  var igHist=$('igHist'); if(igHist)igHist.addEventListener('click',openHistory);
  var igSet=$('igSet'); if(igSet)igSet.addEventListener('click',function(){ closeSheets(); if(typeof window.axGo==='function')window.axGo('settings'); });

  // ---- ↺ Tozalash — faqat KIRISH (prompt + referens) tozalanadi; NATIJA tegmaydi ----
  var igClear=$('igClearBtn');
  if(igClear)igClear.addEventListener('click',function(){
    ta.value=''; grow();                 // prompt bo'sh + auto-grow reset
    st.refs=[]; igStripAllMentions(); renderRefs(); updRefMeta(); // barcha referens o'chiriladi, strip qayta render
    hideMention(); refreshGen();           // @ dropdown yopiladi; ogohlantirish/disabled yangilanadi
    toast('Cleared','info');
  });

  // ---- P14 — CEP OS fayl drop → rasm referens. Promptga tashlansa @img pill, referens paneliga faqat referens.
  //   CEP drop File obyektida `.path` (native yo'l) YOKI oddiy File bo'lishi mumkin — ikkovini ham qo'llaymiz.
  (function(){
    var box=(ta.closest&&ta.closest('.pbox'))||ta;
    box.addEventListener('dragover',function(e){ if(e.dataTransfer&&Array.prototype.indexOf.call(e.dataTransfer.types||[],'Files')>=0){ e.preventDefault(); box.classList.add('af-dropon'); } });
    box.addEventListener('dragleave',function(e){ if(!box.contains(e.relatedTarget))box.classList.remove('af-dropon'); });
    box.addEventListener('drop',function(e){
      if(!e.dataTransfer||!e.dataTransfer.files||!e.dataTransfer.files.length)return;
      e.preventDefault(); box.classList.remove('af-dropon');
      var atCaret=!!(e.target&&e.target.closest&&e.target.closest('.chipedit'));
      var files=Array.prototype.slice.call(e.dataTransfer.files);
      files.forEach(function(f){
        var isImg=/^image\//.test(f.type||'')||/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name||f.path||'');
        if(!isImg){ toast('Only image references are supported here','warning'); return; }
        function afterAdd(){ if(atCaret&&igEd)setTimeout(function(){ igEd.insertText('@img'+st.refs.length+' ',true); },0); }
        if(f.path&&typeof readDataUrl==='function'){ var d=readDataUrl(f.path); if(d){ if(igEd)igEd.commit(); addRef(d); afterAdd(); } else toast('Could not read '+base(f.path),'error'); }
        else { var rd=new FileReader(); rd.onload=function(){ if(igEd)igEd.commit(); addRef(String(rd.result||'')); afterAdd(); }; rd.readAsDataURL(f); }
      });
    });
  })();

  // ---- ‹ Image kategoriya → imggen orqaga navigatsiya ----
  $('igBack').addEventListener('click',function(){ closeSheets(); if(typeof window.axGo==='function')window.axGo('launcher'); }); // #6: aicat oraliq ekrani chetlab o'tiladi

  refresh(); updRefMeta(); refreshGen();
})();
