
/* V5: prototip AI JS (1:1, IIFE-scoped) */
(function(){

  // #143 (PX6): demo holati (`balance=606`, `lowDemo`, `errMode`, `emptyDemo`) o'chirildi —
  // u mockup davridan qolgan va Sozlamalardagi "DEV · DEMO" bo'limi orqali boshqarilardi.
  // Bo'lim mijoz paketida ham jo'natilardi (ZXP `__AF_BUILD__` shtampini urmaydi → gate
  // "dev" deb qarordi), ya'ni obunachi "Demo: low credits" tugmasini ko'rishi mumkin edi.
  var importTarget='comp', toastT;
  // Yagona toast — asosiy showToast'ga yo'naltiramiz (warn/err → warning/error) → AI Tools va panel bir xil ko'rinish.
  function toast(m,k){
    if(typeof showToast==='function'){ showToast(m,(k==='warn')?'warning':(k==='err')?'error':(k||'info')); return; }
    var t=document.getElementById('axToast'); if(!t)return; t.textContent=m;t.className='on'+(k?' '+k:'');clearTimeout(toastT);toastT=setTimeout(function(){t.className='';},2200);
  }
  // #143 (PX6): `soon()` ("Coming soon · next phase") o'chirildi — uni faqat o'lik
  // `data-soon` shoxobchasi chaqirardi; panelda bunday atributli element yo'q.
  // Kredit — YAGONA manba: AssetFlowAccount.aiCredits (demo 606 emas). Header'lar shundan o'qiydi → bir xil qiymat.
  function aiCredReal(){ try{ var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null; if(u&&typeof u.aiCredits==='number'&&isFinite(u.aiCredits))return u.aiCredits; }catch(e){} return null; }
  // #143 (PX6): `bal()` (demo 606 / lowDemo 5 zaxirasi) o'chirildi — uni faqat mockup
  // narx mashinasi ishlatardi. Displey: real kredit yoki yuklanmaguncha '—'.
  // #25: kesh bo'sh (— ko'rinishi) + login bor → /credits'dan bir marta olamiz (60s guard).
  var balFetchAt=0;
  function syncBal(){var v=aiCredReal();var t=(v!=null)?String(v):'—';var b=document.getElementById('balTop');if(b)b.textContent=t;var s=document.getElementById('balSet');if(s)s.textContent=t;aiLeadSync();
    if(v==null&&(Date.now()-balFetchAt>60000)&&typeof studioGet==='function'&&typeof pubAuthHeaders==='function'){
      try{ var h=pubAuthHeaders(); if(h&&h.Authorization){ balFetchAt=Date.now();
        studioGet('/api/studio/credits').then(function(d){ if(d&&typeof d.aiCredits==='number'&&typeof window.afSyncCredits==='function')window.afSyncCredits(d.aiCredits); }).catch(function(){});
        // P3 (step 34) — AI Stock topshiriq holatlarini bir marta yuklaymiz (kartada "yuborilgan").
        if(!window._afExploreLoaded && typeof window.afLoadExploreSubs==='function'){ window._afExploreLoaded=true; window.afLoadExploreSubs(); }
        // R4_08 — yoqilgan Topaz enhance/upscale operatsiyalarini bir marta yuklaymiz (kartada "Use ▾").
        if(!window._afTopazOpsLoaded && typeof window.afLoadTopazOps==='function'){ window._afTopazOpsLoaded=true; window.afLoadTopazOps(); }
      } }catch(e){}
    }
  }
  // AI Tools (launcher/aicat) ixcham header kreditи — real qiymat bilan (faqat shu yagona joyda ko'rsatiladi).
  function aiLeadSync(){ var v=aiCredReal(); var t='<span class="cs">✦</span> '+((v!=null)?Number(v).toLocaleString('en-US'):'—')+((typeof window.afPlanChipHTML==='function')?window.afPlanChipHTML():''); var a=document.getElementById('aiLeadCredL'); if(a)a.innerHTML=t; var c=document.getElementById('aiLeadCredA'); if(c)c.innerHTML=t; }
  // UMUMIY kredit sinxron — yagona manba (cached aiCredits) → BARCHA chip (balTop/balSet/aiLead/igCredit/vgCredit).
  // Har tool gen/enhance'dan keyin shuni chaqiradi → chiplar bir-biridan farq qilib qolmaydi (drift fix — audit MEDIUM).
  window.afSyncCredits=function(v){
    if(typeof v==='number'&&isFinite(v)){ try{ var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null; if(u)u.aiCredits=v; }catch(e){} }
    try{ syncBal(); }catch(e){}
    var rv=aiCredReal(); var t='<span class="cs">✦</span> '+((rv!=null)?Number(rv).toLocaleString('en-US'):'—');
    var ig=document.getElementById('igCredit'); if(ig)ig.innerHTML=t;
    var vg=document.getElementById('vgCredit'); if(vg)vg.innerHTML=t;
    var ag=document.getElementById('agCredit'); if(ag)ag.innerHTML=t; // P8: audio tool chip'i ham sinxron
  };
  // D7 (#P1-plagin) — UMUMIY "kam kredit" banneri. Ilgari uchta tool (ig/vg/ag) markup'da ham
  // (bir xil 14px SVG + .lt/.ls tuzilishi, faqat id prefiksi farqli), gate kodida ham
  // (`toggle('on') + LowNeed.textContent`) mustaqil nusxaga ega edi — to'rt joyda. Endi markup
  // `data-lowcred="<prefiks>"` bo'sh konteyneridan generatsiya qilinadi (pastdagi to'ldiruvchi),
  // holat esa shu funksiyadan o'tadi. `need/have` matni bitta joyda formatlanadi.
  window.afLowCred=function(prefix,low,text){
    var b=document.getElementById(prefix+'LowBanner'); if(!b)return low;
    b.classList.toggle('on',!!low);
    var n=document.getElementById(prefix+'LowNeed'); if(n&&text!=null)n.textContent=text;
    return low;
  };
  // `need ✦ N · you have ✦ M` — yagona format (uchta gate bir xil satrni qayta yozardi).
  window.afLowCredNeed=function(need,avail){ return 'need ✦ '+need+' · you have ✦ '+((avail!=null)?avail:'—'); };
  // Bannerlarni bir marta to'ldirish: `data-lowcred="ig|vg|ag"` bo'sh konteyner → bir xil ichki tuzilish.
  // Skript parse vaqtida ishlaydi va uchta konteyner ham yuqorida (markup'da) e'lon qilingan, ya'ni
  // birinchi gate chaqirig'idan (`igCreditGate` va h.k.) ancha oldin id'lar mavjud bo'ladi.
  (function(){
    var ic='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v7h-2zm1 11.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" fill="currentColor"/></svg>';
    var ls=document.querySelectorAll('[data-lowcred]');
    for(var i=0;i<ls.length;i++){ var el=ls[i], p=el.getAttribute('data-lowcred');
      el.id=p+'LowBanner';
      el.title='Top up credits — Settings';
      el.innerHTML=ic+'<div style="flex:1"><div class="lt">Not enough credits</div><div class="ls" id="'+p+'LowNeed"></div></div>';
      el.onclick=function(){ if(window.axGo)window.axGo('settings'); };
    }
  })();
  // UMUMIY video thumbnail — So'nggi grid kartasi (rasm tool + video tool BIR XIL ishlatadi).
  // CSS background-image videoni render qilmaydi (qora) → <video #t=0.1 muted> + birinchi kadrga seek.
  // poster bo'lsa u darhol ko'rinadi; preload=auto — CEP CEF preload=metadata bilan kadr chizmaydi.
  window.afVideoThumb=function(url,poster){
    var v=document.createElement('video');
    if(poster)v.poster=poster;
    v.src=String(url)+(/#/.test(String(url))?'':'#t=0.1');
    v.muted=true; v.setAttribute('muted',''); v.playsInline=true; v.setAttribute('playsinline',''); v.preload=poster?'metadata':'auto';
    v.style.cssText='position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;pointer-events:none;background-color:#000';
    try{ var sk=false; var seek=function(){ if(sk)return; try{v.currentTime=0.1;}catch(e){} };
      v.addEventListener('loadedmetadata',seek); v.addEventListener('loadeddata',seek); v.addEventListener('canplay',seek); v.addEventListener('seeked',function(){sk=true;}); }catch(e){}
    return v;
  };

  /* SD2-CHIP-EDITOR v1 — sync manually with packages/assetflow-studio/platform/index.html (ffChipEditor) */
  // ===== #6 — UMUMIY chip-editor (Dreamina-uslub atom mention pill; rasm + video tool BIR XIL) =====
  // textarea o'rniga contenteditable div. DOM FLAT invariant: bolalar faqat Text / <br> / .mchip span
  // (Enter intercept + paste plain-text → brauzer <div> blok yaratmaydi, serializatsiya sodda qoladi).
  // `.value` va `.placeholder` PROPERTY sifatida beriladi (defineProperty) — mavjud string-level kod
  // (strip/renumber/enhance/restore/clear) O'ZGARISHSIZ ishlaydi: o'qish=serializatsiya (pill→token),
  // yozish=parse (token→pill; mos referens bo'lmagan token oddiy matn bo'lib qoladi — crash yo'q).
  // opts: refs() → {image:[thumb...],video:[...],audio:[...]} (joriy biriktirilganlar);
  //       token(kind,n) → serializatsiya shakli (rasm tool '@imgN', video tool '@ImageN');
  //       interceptEnter() → true bo'lsa Enter yangi qator QO'YMAYDI (mention dropdown tanlovi).
  window.afChipEditor=function(el,opts){
    opts=opts||{};
    // Premiere UXP contenteditable'ga klaviatura fokusini bermaydi. Port shu
    // ikki editorni native <textarea>ga aylantiradi; Premiere/web contenteditable
    // yo'li pastda o'zgarishsiz qoladi. UXP'da mentionlar oddiy @token matni
    // sifatida ko'rinadi, alohida reference grid esa thumbnailni saqlaydi.
    if(el&&String(el.tagName||'').toUpperCase()==='TEXTAREA'){
      function fireSimple(){ try{el.dispatchEvent(new Event('input'));}catch(e){} }
      function simpleSet(v){ el.value=String(v==null?'':v); fireSimple(); }
      function simpleBefore(){ var p=typeof el.selectionStart==='number'?el.selectionStart:el.value.length; return el.value.slice(0,p); }
      function simpleInsert(text,smartSpace){
        try{el.focus();}catch(e){}
        var a=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;
        var b=typeof el.selectionEnd==='number'?el.selectionEnd:a;
        var sep=(smartSpace&&a>0&&!/\s$/.test(el.value.slice(0,a)))?' ':'';
        var ins=sep+String(text==null?'':text);
        el.value=el.value.slice(0,a)+ins+el.value.slice(b);
        try{el.setSelectionRange(a+ins.length,a+ins.length);}catch(e){}
        fireSimple();
      }
      function simpleReplace(len,text){
        var p=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;
        var start=Math.max(0,p-(Number(len)||0));
        try{el.setSelectionRange(start,p);}catch(e){}
        simpleInsert(text,false);
      }
      return {el:el,getValue:function(){return el.value||'';},setValue:simpleSet,
        insertText:simpleInsert,textBeforeCaret:simpleBefore,replaceBeforeCaret:simpleReplace,
        undo:function(){},redo:function(){},commit:function(){},flushTyping:function(){}};
    }
    var KIND={img:'image',image:'image',vid:'video',video:'video',aud:'audio',audio:'audio'};
    var GLYPH={image:'⊞',video:'▶',audio:'♪'};
    var TOKEN_RE=/@(image|img|video|vid|audio|aud)(\d+)/gi;
    var composing=false;
    var _refOverride=null; // P15 — undo/redo tiklashda pill'lar snapshot hovuzidan qurilsin
    function refThumb(kind,n){
      var lists=_refOverride||(opts.refs&&opts.refs())||{}; var arr=lists[kind]||[];
      return (n>=1&&n<=arr.length)?{thumb:arr[n-1]||null}:null; // null = mos referens yo'q
    }
    function tokenOf(kind,n){ return opts.token?opts.token(kind,n):('@'+(kind==='image'?'img':kind)+n); }
    function labelOf(kind,n){ return '@'+(kind==='image'?'Image':kind==='video'?'Video':'Audio')+' '+n; }
    function isPill(node){ return !!(node&&node.nodeType===1&&node.classList&&node.classList.contains('mchip')); }
    function makePill(kind,n){
      var info=refThumb(kind,n); if(!info)return null;
      var s=document.createElement('span'); s.className='mchip'; s.setAttribute('contenteditable','false');
      s.setAttribute('data-kind',kind); s.setAttribute('data-n',String(n));
      var t=document.createElement('span'); t.className='ct';
      if(kind==='image'&&info.thumb)t.style.backgroundImage='url("'+info.thumb+'")'; else t.textContent=GLYPH[kind]||'⊞';
      var l=document.createElement('span'); l.className='cl'; l.textContent=labelOf(kind,n);
      // P12 — pill burchagida ✕: FAQAT promptdagi eslatmani o'chiradi (referens hovuzda QOLADI, qayta raqamlash YO'Q)
      var x=document.createElement('span'); x.className='mx'; x.textContent='✕'; x.setAttribute('contenteditable','false'); x.title='Remove mention (keeps the reference)';
      x.addEventListener('mousedown',function(e){ e.preventDefault(); e.stopPropagation(); commit(); if(s.parentNode)s.parentNode.removeChild(s); fireInput(); commit(); });
      s.appendChild(t); s.appendChild(l); s.appendChild(x);
      return s;
    }
    // mask=true → pill \u0001 belgisi bo'lib chiqadi (mention regex "@(\w*)$" pill tokenini matn deb adashmasin)
    function serializeNode(node,mask){
      if(node.nodeType===3)return node.nodeValue||'';
      if(isPill(node))return mask?'\u0001':tokenOf(node.getAttribute('data-kind'),parseInt(node.getAttribute('data-n'),10)||0);
      if(node.nodeType!==1)return '';
      if(node.tagName==='BR')return '\n';
      var out=''; for(var c=node.firstChild;c;c=c.nextSibling)out+=serializeNode(c,mask);
      if(node.tagName==='DIV'||node.tagName==='P')out='\n'+out; // himoya: brauzer blok qo'ygan bo'lsa ham yo'qolmasin
      return out;
    }
    function getValue(){ var out=''; for(var c=el.firstChild;c;c=c.nextSibling)out+=serializeNode(c,false); return out.replace(/[\u200B\u0001]/g,''); }
    // matn → fragment: tokenlar pill (mos referens bo'lsa), '\n' → <br>, qolgani Text
    function appendPlain(frag,s){
      var parts=String(s).split('\n');
      for(var i=0;i<parts.length;i++){
        if(i>0)frag.appendChild(document.createElement('br'));
        if(parts[i])frag.appendChild(document.createTextNode(parts[i]));
      }
    }
    function buildFragment(text){
      var frag=document.createDocumentFragment(); var s=String(text==null?'':text);
      var last=0,m; TOKEN_RE.lastIndex=0;
      while((m=TOKEN_RE.exec(s))){
        if(m.index>last)appendPlain(frag,s.slice(last,m.index));
        var pill=makePill(KIND[m[1].toLowerCase()],parseInt(m[2],10));
        if(pill)frag.appendChild(pill); else frag.appendChild(document.createTextNode(m[0]));
        last=m.index+m[0].length;
      }
      if(last<s.length)appendPlain(frag,s.slice(last));
      return frag;
    }
    // Tashqi setValue (enhance/restore/suggestion/clear) — o'zgarishni tarixga checkpoint qiladi (before+after)
    function setValue(text){ commit(); el.textContent=''; el.appendChild(buildFragment(text)); commit(); }
    // ── P15 — UNDO/REDO tarixi (web ffChipEditor bilan mos). Snapshot = token-matni + kursor (token-offset)
    //   + REFERENS HOVUZI (opts.snapshotRefs). Yozish ~500ms birlashadi; pill/paste/clear ALOHIDA yozuv. ──
    var undoStack=[], redoStack=[], restoring=false, _typeT=null, _typeDirty=false;
    function refsEq(a,b){ if(a===b)return true; if(!a||!b)return false; try{ return JSON.stringify(a)===JSON.stringify(b); }catch(e){ return false; } }
    function snapshot(){ return { text:getValue(), caret:caretTokenOffset(), refs:opts.snapshotRefs?opts.snapshotRefs():null }; }
    function commit(){
      if(restoring)return; _typeDirty=false;
      var s=snapshot(), top=undoStack[undoStack.length-1];
      if(top&&top.text===s.text&&refsEq(top.refs,s.refs))return;
      undoStack.push(s); if(undoStack.length>120)undoStack.shift(); redoStack.length=0;
    }
    function commitTypingSoon(){ if(restoring)return; _typeDirty=true; clearTimeout(_typeT); _typeT=setTimeout(commit,500); }
    function flushTyping(){ clearTimeout(_typeT); if(_typeDirty)commit(); } // faqat kutilayotgan yozish bo'lsa
    function applySnapshot(s){
      if(!s)return; restoring=true;
      try{
        if(opts.restoreRefs&&s.refs)opts.restoreRefs(s.refs);
        _refOverride=s.refs||null;
        el.textContent=''; el.appendChild(buildFragment(s.text||''));
        _refOverride=null;
        setCaretByTokenOffset(s.caret);
        if(opts.syncText)opts.syncText(s.text||'');
        fireInput();
      }catch(e){}
      restoring=false;
    }
    function undo(){ flushTyping(); if(undoStack.length<2)return; redoStack.push(undoStack.pop()); applySnapshot(undoStack[undoStack.length-1]); }
    function redo(){ if(!redoStack.length)return; var s=redoStack.pop(); undoStack.push(s); applySnapshot(s); }
    function caretTokenOffset(){
      var r=caretRange(); if(!r)return null;
      var pre=r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer,r.startOffset);
      var frag=pre.cloneContents(); var out='';
      for(var c=frag.firstChild;c;c=c.nextSibling)out+=serializeNode(c,false);
      return out.replace(/[​]/g,'').length;
    }
    function setCaretByTokenOffset(off){
      if(off==null){ setCaret(el,el.childNodes.length); return; }
      var rem=off;
      for(var c=el.firstChild;c;c=c.nextSibling){
        if(c.nodeType===3){ var len=(c.nodeValue||'').length; if(rem<=len){ setCaret(c,rem); return; } rem-=len; }
        else if(isPill(c)){ var tl=tokenOf(c.getAttribute('data-kind'),parseInt(c.getAttribute('data-n'),10)||0).length; if(rem<tl){ placeCaretAfter(c); return; } rem-=tl; }
        else if(c.tagName==='BR'){ if(rem<1){ placeCaretAfter(c); return; } rem-=1; }
      }
      setCaret(el,el.childNodes.length);
    }
    // ---- caret utilitalari ----
    function caretRange(){
      var s=window.getSelection(); if(!s||!s.rangeCount)return null;
      var r=s.getRangeAt(0); if(!el.contains(r.startContainer))return null;
      return r;
    }
    function setCaret(node,offset){
      var r=document.createRange();
      try{ r.setStart(node,offset); }catch(_){ r.selectNodeContents(el); r.collapse(false); }
      r.collapse(true);
      var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function placeCaretAfter(node){
      var r=document.createRange(); r.setStartAfter(node); r.collapse(true);
      var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function textBeforeCaret(){
      var r=caretRange(); if(!r)return null;
      var pre=r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer,r.startOffset);
      var frag=pre.cloneContents(); var out='';
      for(var c=frag.firstChild;c;c=c.nextSibling)out+=serializeNode(c,true);
      return out;
    }
    function fireInput(){ try{ el.dispatchEvent(new Event('input')); }catch(_){ } }
    function insertFragAtCaret(frag){
      var lastNode=frag.lastChild;
      var r=caretRange();
      if(!r){ el.appendChild(frag); } else { r.deleteContents(); r.insertNode(frag); }
      if(lastNode)placeCaretAfter(lastNode); else setCaret(el,el.childNodes.length);
      fireInput();
    }
    // token/shablon qo'shish (kursor joyiga); smartSpace — oldingi belgi bo'shliq bo'lmasa ' ' qo'yiladi
    function insertText(text,smartSpace){
      try{ el.focus(); }catch(_){ }
      var sep='';
      if(smartSpace){ var pre=textBeforeCaret(); if(pre&&!/\s$/.test(pre))sep=' '; }
      commit(); insertFragAtCaret(buildFragment(sep+String(text))); commit(); // mention/preset = alohida yozuv
    }
    // mention tanlovi: caret oldidagi len belgini ("@so'z") o'chirib o'rniga parse qilingan matn qo'yish
    function replaceBeforeCaret(len,insertStr){
      var r=caretRange(); if(!r){ insertText(insertStr,false); return; }
      var node=r.startContainer, off=r.startOffset, remain=len;
      while(remain>0&&node&&node.nodeType===3){
        var take=Math.min(off,remain);
        node.nodeValue=node.nodeValue.slice(0,off-take)+node.nodeValue.slice(off);
        remain-=take; off-=take;
        if(remain>0){ var prev=node.previousSibling; if(prev&&prev.nodeType===3){ node=prev; off=node.nodeValue.length; } else break; }
      }
      if(node&&node.nodeType===3)setCaret(node,off);
      insertFragAtCaret(buildFragment(insertStr));
    }
    // caret yonidagi pill (Backspace/Delete atom o'chirish uchun)
    function pillNextTo(r,dir){
      if(!r||!r.collapsed)return null;
      var node=r.startContainer, off=r.startOffset;
      if(node.nodeType===3){
        if(dir<0&&off>0)return null; if(dir>0&&off<(node.nodeValue||'').length)return null;
        var sib=dir<0?node.previousSibling:node.nextSibling;
        return isPill(sib)?sib:null;
      }
      if(node===el){
        var ch=dir<0?el.childNodes[off-1]:el.childNodes[off];
        return isPill(ch)?ch:null;
      }
      return null;
    }
    // ---- hodisalar ----
    el.addEventListener('compositionstart',function(){ composing=true; });
    el.addEventListener('compositionend',function(){ composing=false; });
    el.addEventListener('keydown',function(e){
      if(composing)return;
      // P15 — undo/redo: ⌘Z / Ctrl+Z → undo; ⌘⇧Z / Ctrl+Y → redo
      var mod=e.metaKey||e.ctrlKey;
      if(mod&&(e.key==='z'||e.key==='Z')){ e.preventDefault(); if(e.shiftKey)redo(); else undo(); return; }
      if(mod&&(e.key==='y'||e.key==='Y')){ e.preventDefault(); redo(); return; }
      if(e.key==='Enter'&&!e.metaKey&&!e.ctrlKey){
        if(opts.interceptEnter&&opts.interceptEnter()){ e.preventDefault(); return; } // mention tanlovi
        e.preventDefault();
        flushTyping();
        var br=document.createElement('br'); var frag=document.createDocumentFragment(); frag.appendChild(br);
        var r=caretRange();
        if(!r){ el.appendChild(frag); } else { r.deleteContents(); r.insertNode(frag); }
        // oxirgi <br> ko'rinmaydi (Chromium collapse) → yakunda bo'lsa ikkinchi <br>, caret orasiga
        if(!br.nextSibling)el.appendChild(document.createElement('br'));
        placeCaretAfter(br); fireInput(); commit();
        return;
      }
      if(e.key==='Backspace'||e.key==='Delete'){
        var p=pillNextTo(caretRange(),e.key==='Backspace'?-1:1);
        if(p){ e.preventDefault(); commit(); p.parentNode.removeChild(p); fireInput(); commit(); }
      }
    });
    function serializeRangeText(r){
      var frag=r.cloneContents(); var out='';
      for(var c=frag.firstChild;c;c=c.nextSibling)out+=serializeNode(c,false);
      return out;
    }
    el.addEventListener('copy',function(e){
      var r=caretRange(); if(!r||r.collapsed)return;
      try{ e.clipboardData.setData('text/plain',serializeRangeText(r)); e.preventDefault(); }catch(_){ }
    });
    el.addEventListener('cut',function(e){
      var r=caretRange(); if(!r||r.collapsed)return;
      try{ e.clipboardData.setData('text/plain',serializeRangeText(r)); e.preventDefault(); r.deleteContents(); fireInput(); }catch(_){ }
    });
    el.addEventListener('paste',function(e){
      // P14 — bufer MEDIASI (rasm/video/audio) → referens (CEP'da cheklangan, lekin brauzer/HTML paste ishlaydi)
      var cd=e.clipboardData||window.clipboardData;
      var files=[];
      try{
        if(cd&&cd.files&&cd.files.length)files=Array.prototype.slice.call(cd.files);
        else if(cd&&cd.items)files=Array.prototype.slice.call(cd.items).filter(function(it){return it.kind==='file';}).map(function(it){return it.getAsFile();}).filter(Boolean);
      }catch(_){ }
      var media=files.filter(function(f){return f&&/^(image|video|audio)\//.test(f.type||'');});
      if(media.length&&opts.onFiles){ e.preventDefault(); opts.onFiles(media,{atCaret:true}); return; }
      var t=''; try{ t=cd.getData('text/plain')||''; }catch(_){ }
      if(!t)return;
      e.preventDefault();
      commit(); insertFragAtCaret(buildFragment(t.replace(/\r\n?/g,'\n'))); commit();
    });
    // bo'shagan editor'ni chinakam :empty qilish (placeholder ko'rinsin) — qoldiq <br> tozalanadi
    el.addEventListener('input',function(){
      if(el.firstChild&&!el.textContent&&!el.querySelector('.mchip')&&!el.querySelector('br+br'))el.textContent='';
      commitTypingSoon(); // P15 — yozish ~500ms birlashadi
    });
    try{
      Object.defineProperty(el,'value',{get:getValue,set:function(v){setValue(v);},configurable:true});
      Object.defineProperty(el,'placeholder',{
        get:function(){ return el.getAttribute('data-ph')||''; },
        set:function(v){ el.setAttribute('data-ph',v==null?'':String(v)); },
        configurable:true
      });
    }catch(_){ }
    commit(); // boshlang'ich holat (undo poydevori)
    return {el:el,getValue:getValue,setValue:setValue,insertText:insertText,textBeforeCaret:textBeforeCaret,replaceBeforeCaret:replaceBeforeCaret,undo:undo,redo:redo,commit:commit,flushTyping:flushTyping};
  };

  // P2 — CEP-xavfsiz clipboard: navigator.clipboard CEP'da ishonchsiz → yashirin textarea
  // + execCommand('copy') fallback. Muvaffaqiyatda true.
  // SC_30: execCommand AVVAL (CEP'da writeText jim rad etilishi mumkin edi — "copied" yolg'on bo'lardi),
  // writeText faqat zaxira; natija toast bilan tasdiqlanadi (menyu caller'lari toast'ni shu yerdan kutadi).
  window.afCopyText=function(text){
    var t=String(text==null?'':text), ok=false;
    try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.cssText='position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.focus(); ta.select(); ok=!!(document.execCommand&&document.execCommand('copy')); document.body.removeChild(ta); }catch(e){ ok=false; }
    if(!ok){ try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(function(){},function(){}); ok=true; } }catch(e){} }
    if(typeof showToast==='function')showToast(ok?'Prompt copied':'Copy failed',ok?'success':'error');
    return ok;
  };

  // P16 (SYNC) — YAGONA refresh-all: har qanday view'dagi ↻ tugma shu bilan ishlaydi.
  // Katalog + kredit + tool recents + sessiya/loyiha keshlari birga yangilanadi.
  window.afRefreshAll=function(){
    try{ if(typeof syncServerCatalog==='function')syncServerCatalog(); }catch(e){}
    try{ studioGet('/api/studio/credits').then(function(d){ if(d&&typeof d.aiCredits==='number'&&typeof window.afSyncCredits==='function')window.afSyncCredits(d.aiCredits); }).catch(function(){}); }catch(e){}
    try{ if(typeof window.afIgRetryRecent==='function')window.afIgRetryRecent(); }catch(e){}
    try{ if(typeof window.axVGRefresh==='function')window.axVGRefresh(); }catch(e){}
    try{ if(typeof window.axAGRefresh==='function')window.axAGRefresh(); }catch(e){}
    try{ if(typeof window.axSPInvalidate==='function')window.axSPInvalidate(); }catch(e){}
    try{ if(typeof window.afLoadExploreSubs==='function')window.afLoadExploreSubs(); }catch(e){}
    try{ if(typeof showToast==='function')showToast('Refreshing…','info'); }catch(e){}
  };

  // ── P3 (step 34) — "Add to Explore": generatsiya → ommaviy AI Stock katalogi ──
  // Web bilan bir xil zanjir: yuborish → admin moderatsiya → AI Stock pill. Huquq attestatsiyasi
  // SHART (afConfirm ichida — tor panel; server rightsAccepted'ni majburlaydi). Pul-zonasi TEGILMAYDI.
  window.afExploreSubs = window.afExploreSubs || {};
  window.afExploreState = function(genId){
    var s = window.afExploreSubs[genId];
    if(!s) return { submitted:false, label:'Add to Explore', status:'' };
    var st = s.reviewStatus;
    var label = st==='APPROVED' ? (s.published?'Published in Explore':'Approved — Explore')
      : st==='REJECTED' ? 'Not approved · Explore' : 'In review · Explore';
    return { submitted:true, label:label, status:st };
  };
  window.afLoadExploreSubs = function(){
    return studioGet('/api/studio/gen/explore/submissions').then(function(r){
      var subs = {};
      ((r&&r.submissions)||[]).forEach(function(s){ if(s.generationId) subs[s.generationId]={reviewStatus:s.reviewStatus, published:s.published}; });
      window.afExploreSubs = subs;
    }).catch(function(){});
  };
  window.afAddToExplore = async function(it){
    if(!it || !it.id){ toast('This result is still being saved','info'); return; }
    var cur = window.afExploreState(it.id);
    if(cur.submitted){ toast('Already submitted — '+cur.label,'info'); return; }
    var ok = false;
    try{
      ok = await window.afConfirm(
        'Publish this to the public AI Stock catalog?\n\nBy publishing you confirm you OWN THE RIGHTS to this content and may share it publicly. An admin reviews it before it goes live. Free for everyone by default.',
        {ok:'Publish to Explore', cancel:'Cancel'});
    }catch(e){ ok=false; }
    if(!ok) return;
    try{
      var r = await studioPost('/api/studio/gen/'+encodeURIComponent(it.id)+'/explore', {rightsAccepted:true, promptPublic:false});
      var st = (r&&r.submission&&r.submission.reviewStatus)||'PENDING_REVIEW';
      window.afExploreSubs[it.id] = {reviewStatus:st, published:false};
      toast((r&&r.alreadySubmitted)?'Already submitted — in review':'Submitted to Explore — pending review','success');
      // Kartani yangilash (holat matni o'zgarsin)
      try{ if(typeof window.afIgRetryRecent==='function')window.afIgRetryRecent(); }catch(e){}
    }catch(e){
      var code = e && (e.code || (e.data&&e.data.code));
      var msg = code==='RIGHTS_REQUIRED' ? 'Rights confirmation required'
        : code==='DAILY_CAP' ? (e.message||'Daily submission limit reached — try again tomorrow')
        : code==='MODERATION_BLOCKED' ? "This content can't be published (didn't pass moderation)"
        : code==='GEN_NOT_READY' ? 'This generation is not finished yet'
        : code==='NO_ASSET' ? 'This generation has no asset to publish'
        : (e && e.message) || 'Could not submit — please try again';
      toast(msg,'error');
    }
  };
  // P16 — panelga fokus qaytganda avto-yangilash (web bilan almashganda stale window yo'q; 20s throttle)
  (function(){
    var last=0;
    window.addEventListener('focus',function(){
      var now=Date.now(); if(now-last<20000)return; last=now;
      try{ studioGet('/api/studio/credits').then(function(d){ if(d&&typeof d.aiCredits==='number'&&typeof window.afSyncCredits==='function')window.afSyncCredits(d.aiCredits); }).catch(function(){}); }catch(e){}
      try{ if(typeof window.axSPInvalidate==='function')window.axSPInvalidate(); }catch(e){}
    });
  })();

  // PROBLEM 13 — UMUMIY yuklab-olish fayl nomi: PROMPT'dan (backend genDownloadName bilan
  // BIR XIL qoida: xavfli belgilar → bo'shliq, ~60 belgi, chekka nuqtalar olib tashlanadi;
  // bo'sh prompt → frameflow-<cat>). Kengaytma URL'dan, bo'lmasa cat bo'yicha.
  window.afGenDlName=function(prompt,url,cat){
    var ext=(String(url||'').match(/\.(\w{2,5})(?:\?|#|$)/)||[])[1];
    if(!ext)ext=(cat==='video')?'mp4':(cat==='audio'||cat==='sfx'||cat==='voice'||cat==='music')?'mp3':'png';
    var base=String(prompt||'').replace(/[\\/:*?"<>|\x00-\x1f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60).trim().replace(/[. ]+$/,'').replace(/^[. ]+/,'');
    return (base||('frameflow-'+(cat||'gen')))+'.'+ext.toLowerCase();
  };

  // ===== UMUMIY So'nggi-grid komponenti (rasm tool + video tool BIR XIL ishlatadi) =====
  // ctx: {isCEP, selecting():bool, isSelected(it):bool, onToggleSelect(it,cardEl), onImport(it),
  //       onDownload(it), onDelete(it), refAllowed(it):bool, onRef(it)}
  // — har tool o'z ctx'ini beradi (model-aware refKind/onRef tool ichida); RENDER + LIGHTBOX umumiy.
  window.afRecent=(function(){
    var IC={
      x:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      chk:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      imp:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      ref:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      rst:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      dl:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      up:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21H3v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 3l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      aud:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      play:'<svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(0,0,0,.5)" stroke="#fff" stroke-width="1.4"><circle cx="12" cy="12" r="10" fill="rgba(0,0,0,.5)" stroke="#fff" stroke-width="1.4"/><path d="M10 8.5l6 3.5-6 3.5z" fill="#fff" stroke="none" stroke-width="1.4"/></svg>'
    };
    function catLabel(c){ return c==='video'?'Video':(c==='audio')?'Voice':(c==='sfx')?'SFX':'Image'; }
    // P16 — grid kartalar uchun matnsiz tur ikonkasi (.tg/.rc-cat); web .va-typeicon bilan bir xil uslub
    function catIcon(c){
      if(c==='video')return '<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M8 5l11 7-11 7z" fill="#fff"/></svg>';
      if(c==='audio'||c==='sfx')return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15l-5-5L5 21" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    // ---- UMUMIY lightbox (bitta DOM, body oxirida; rasm/video/ovoz) — b10 mockup 1:1 ----
    var lb=null,lbCur=null; // lbCur={it,ctx} — prev/next + klaviatura nav uchun
    function fmtT(s){ s=Math.max(0,Math.floor(Number(s)||0)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
    function ensureLb(){
      if(lb)return lb;
      lb=document.createElement('div'); lb.className='lightbox'; lb.id='afLightbox';
      lb.innerHTML='<div class="lbinner">'
        +'<div class="lbtop"><span class="lbcount" id="afLbCount"></span><span class="lbsp"></span><span class="lbesc">ESC</span><div class="lx" id="afLbClose"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>'
        +'<div class="lbmedia">'
        +  '<video id="afLbVideo" playsinline style="display:none"></video>'
        +  '<img id="afLbImg" alt="" style="display:none"/>'
        +  '<audio id="afLbAudio" style="display:none"></audio>'
        +  '<div class="lbaud" id="afLbAud"><div role="button" tabindex="0" type="button" class="lbaplay" id="afLbAudPlay"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></div><div class="lbamid"><div class="lbawave" id="afLbAudWave"><div class="lbabars" id="afLbAudBars"></div><div class="lbaprog" id="afLbAudProg"></div><div class="lbaline" id="afLbAudLine"></div></div><div class="lbatime" id="afLbAudTime">00:00 / 00:00</div></div></div>'
        +  '<div class="lbplay" id="afLbPlay" style="display:none"><svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M8 5l11 7-11 7z" fill="#fff"/></svg></div>'
        +  '<div class="lbnav" id="afLbNav" style="display:none"><div class="lbnavb" id="afLbPrev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="lbnavb" id="afLbNext"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>'
        +'</div>'
        +'<div class="lbscrub" id="afLbScrub"><div class="lbtrack" id="afLbTrack"><div class="lbfill" id="afLbFill"></div><span class="lbknob" id="afLbKnob"></span></div><span class="lbtime" id="afLbTime">00:00 / 00:00</span><span class="lbspk" id="afLbSpk"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>'
        +'<div class="lbcard" id="afLbCard"><div class="lbprompt" id="afLbPrompt"></div><div class="lbchips" id="afLbChips"></div></div>'
        +'<div class="lbacts" id="afLbActs"></div>'
        +'<div class="lbcap" id="afLbCap"></div>'
        +'</div>';
      document.body.appendChild(lb);
      lb.addEventListener('click',function(e){ if(e.target===lb)closeLb(); });
      lb.querySelector('#afLbClose').addEventListener('click',closeLb);
      document.addEventListener('keydown',function(e){
        if(!lb||!lb.classList.contains('on'))return;
        if(e.key==='Escape'){ closeLb(); return; }
        if(e.key==='ArrowLeft'){ var p=document.getElementById('afLbPrev'); if(p&&!p.classList.contains('off'))p.click(); }
        if(e.key==='ArrowRight'){ var n=document.getElementById('afLbNext'); if(n&&!n.classList.contains('off'))n.click(); }
      });
      // video boshqaruvi (bitta marta bog'lanadi)
      var v=lb.querySelector('#afLbVideo'), play=lb.querySelector('#afLbPlay'),
          track=lb.querySelector('#afLbTrack'), fill=lb.querySelector('#afLbFill'), knob=lb.querySelector('#afLbKnob'),
          time=lb.querySelector('#afLbTime'), spk=lb.querySelector('#afLbSpk');
      function updScrub(){
        var d=v.duration||0, c=v.currentTime||0, p=d?Math.min(100,c/d*100):0;
        fill.style.width=p+'%'; knob.style.left=p+'%';
        time.textContent=fmtT(c)+' / '+fmtT(d);
      }
      v.addEventListener('timeupdate',updScrub);
      v.addEventListener('loadedmetadata',updScrub);
      v.addEventListener('play',function(){ play.style.display='none'; });
      v.addEventListener('pause',function(){ if(v.style.display!=='none')play.style.display='flex'; });
      v.addEventListener('ended',function(){ play.style.display='flex'; });
      play.addEventListener('click',function(){ var p=v.play&&v.play(); if(p&&p.catch)p.catch(function(){}); });
      v.addEventListener('click',function(){ if(v.paused){ var p=v.play&&v.play(); if(p&&p.catch)p.catch(function(){}); } else v.pause(); });
      track.addEventListener('click',function(e){ var r=track.getBoundingClientRect(); var x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(v.duration)v.currentTime=x*v.duration; updScrub(); });
      spk.addEventListener('click',function(){ v.muted=!v.muted; spk.classList.toggle('muted',v.muted); });
      // SC_33 — audio pleeri: native <audio> (au) = engine, vizual esa web `.va-aplayer` bilan bir xil.
      var au=lb.querySelector('#afLbAudio'), aplay=lb.querySelector('#afLbAudPlay'),
          awave=lb.querySelector('#afLbAudWave'), aprog=lb.querySelector('#afLbAudProg'),
          aline=lb.querySelector('#afLbAudLine'), atime=lb.querySelector('#afLbAudTime');
      var A_PLAY='<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
      var A_PAUSE='<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>';
      function updAu(){ var d=au.duration||0, c=au.currentTime||0, p=d?Math.min(100,c/d*100):0; aprog.style.width=p+'%'; aline.style.left=p+'%'; atime.textContent=fmtT(c)+' / '+fmtT(d); }
      au.addEventListener('timeupdate',updAu);
      au.addEventListener('loadedmetadata',updAu);
      au.addEventListener('play',function(){ aplay.innerHTML=A_PAUSE; });
      au.addEventListener('pause',function(){ aplay.innerHTML=A_PLAY; });
      au.addEventListener('ended',function(){ aplay.innerHTML=A_PLAY; aprog.style.width='0%'; aline.style.left='0%'; });
      aplay.addEventListener('click',function(){ if(au.paused){ var pp=au.play&&au.play(); if(pp&&pp.catch)pp.catch(function(){}); } else au.pause(); });
      awave.addEventListener('click',function(e){ var r=awave.getBoundingClientRect(); var x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(au.duration)au.currentTime=x*au.duration; updAu(); });
      return lb;
    }
    function closeLb(){ if(!lb)return; lb.classList.remove('on'); lbCur=null;
      var v=document.getElementById('afLbVideo'); if(v){try{v.pause();}catch(e){} v.removeAttribute('src'); v.load&&v.load();}
      var a=document.getElementById('afLbAudio'); if(a){try{a.pause();}catch(e){} a.removeAttribute('src');} }
    function lbIcon(svg,title,fn){ var d=document.createElement('div'); d.className='lbico'; d.title=title; d.innerHTML=svg; d.addEventListener('click',fn); return d; }
    function openLightbox(it,ctx){
      if(!it||!it.url)return; ensureLb(); ctx=ctx||{};
      var cat=it.cat||'image';
      var v=document.getElementById('afLbVideo'),img=document.getElementById('afLbImg'),au=document.getElementById('afLbAudio'),
          acts=document.getElementById('afLbActs'),play=document.getElementById('afLbPlay'),scrub=document.getElementById('afLbScrub'),
          aud=document.getElementById('afLbAud'),media=lb.querySelector('.lbmedia');
      lbCur={it:it,ctx:ctx};
      v.style.display='none'; img.style.display='none'; au.style.display='none'; play.style.display='none';
      scrub.classList.remove('on'); aud.classList.remove('on'); media.classList.remove('aud');
      try{v.pause();}catch(e){} try{au.pause();}catch(e){}
      // SC_44: karta thumbnail'ini INSTANT backdrop qilamiz (keshda — tarmoqsiz); to'liq media decode'da fade bilan almashadi. Qora flash yo'q.
      var _thumb=it.thumb||it.display||it.preview||((cat==='image')?it.url:'');
      media.style.backgroundImage=_thumb?('url("'+_thumb+'")'):'';
      if(cat==='video'){ v.style.display=''; v.controls=false; if(_thumb)v.setAttribute('poster',_thumb); else v.removeAttribute('poster'); v.preload='metadata'; v.classList.add('lb-fadein'); v.src=it.url; v.muted=false; try{v.currentTime=0;}catch(e){} v.load&&v.load(); var _vdone=function(){ v.classList.remove('lb-fadein'); }; v.addEventListener('loadeddata',_vdone,{once:true}); scrub.classList.add('on'); var p=v.play&&v.play(); if(p&&p.catch)p.catch(function(){ play.style.display='flex'; }); }
      else if(cat==='audio'||cat==='sfx'){
        // SC_33 — web `.va-aplayer` bilan bir xil pleer (native <audio> engine, neytral waveform, accent progress)
        aud.classList.add('on'); media.classList.add('aud');
        var abars=document.getElementById('afLbAudBars'); abars.innerHTML='';
        var aseed=0, asid=String(it.id||it.title||''); for(var ab=0;ab<asid.length;ab++)aseed=(aseed*31+asid.charCodeAt(ab))%997;
        for(var aw2=0;aw2<40;aw2++){ var abar=document.createElement('i'); abar.style.height=(20+((aseed+aw2*37)%67))+'%'; abars.appendChild(abar); }
        document.getElementById('afLbAudProg').style.width='0%'; document.getElementById('afLbAudLine').style.left='0%';
        document.getElementById('afLbAudTime').textContent='00:00 / 00:00';
        document.getElementById('afLbAudPlay').innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
        au.src=it.url;
      }
      else {
        // SC_44: img — thumbnail backdrop ko'rinib turadi; to'liq rasm decode'da fade bilan kiradi. Xato'да thumbnail qoladi.
        img.style.display=''; img.classList.add('lb-fadein');
        var _fadeIn=function(){ img.classList.remove('lb-fadein'); };
        img.onload=_fadeIn;
        img.onerror=function(){ img.style.display='none'; }; // to'liq rasm kelmasa — backdrop thumbnail qoladi (qora emas)
        img.src=it.url;
        if(img.decode){ img.decode().then(_fadeIn).catch(function(){}); }
      }
      // counter + prev/next (ctx.list bo'lsa)
      var list=(ctx&&typeof ctx.list==='function')?(ctx.list()||[]):[];
      var idx=-1;
      for(var i=0;i<list.length;i++){ var x=list[i]; if(x===it||(it.id&&x.id===it.id)){ idx=i; break; } }
      if(idx<0&&it.url){ for(var i2=0;i2<list.length;i2++){ if(list[i2].url===it.url){ idx=i2; break; } } }
      var cnt=document.getElementById('afLbCount');
      cnt.textContent=(idx>=0&&list.length)?((idx+1)+' / '+list.length):'';
      var nav=document.getElementById('afLbNav'), pv=document.getElementById('afLbPrev'), nx=document.getElementById('afLbNext');
      if(list.length>1&&idx>=0){
        nav.style.display='';
        pv.classList.toggle('off',idx<=0); nx.classList.toggle('off',idx>=list.length-1);
        pv.onclick=function(){ if(idx>0)openLightbox(list[idx-1],ctx); };
        nx.onclick=function(){ if(idx<list.length-1)openLightbox(list[idx+1],ctx); };
      } else { nav.style.display='none'; pv.onclick=nx.onclick=null; }
      // prompt + meta karta
      var card=document.getElementById('afLbCard'), pr=document.getElementById('afLbPrompt'), chips=document.getElementById('afLbChips');
      var prompt=(it.prompt||it.title||'').trim();
      chips.innerHTML='';
      var addChip=function(t){ if(!t)return; var s=document.createElement('span'); s.textContent=t; chips.appendChild(s); };
      var pp=it.params||{};
      addChip(it.modelLabel||pp.modelLabel||'');
      addChip([pp.aspectRatio,pp.resolution||pp.quality].filter(Boolean).join(' · ')||it.sub||'');
      if(it.width&&it.height)addChip(it.width+'×'+it.height); // P11 — haqiqiy o'lcham
      if(typeof it.cost==='number'&&it.cost>0)addChip('✦ '+it.cost);
      if(it.createdAt){ try{ var d=new Date(it.createdAt); if(!isNaN(d.getTime())){ var now=new Date(); var same=d.toDateString()===now.toDateString(); addChip((same?'today':String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0'))+' · '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')); } }catch(e){} }
      pr.textContent=prompt;
      card.classList.toggle('on',!!(prompt||chips.children.length));
      // amallar: lime Import + icon-doiralar (ctx handlerlari SAQLANADI)
      acts.innerHTML=''; var cap=[];
      var imp=document.createElement('div'); imp.className='lbimp';
      imp.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Import';
      imp.addEventListener('click',function(){ ctx.onImport&&ctx.onImport(it); });
      acts.appendChild(imp); cap.push('Import');
      // P1: lightbox'da ham Add to project (ctx bergan bo'lsa)
      if(ctx.onAddProject&&it.id){ acts.appendChild(lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11v6M9 14h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>','Add to project',function(){ ctx.onAddProject(it); })); cap.push('Add to project'); }
      // P3 (step 34) — lightbox'da Add to Explore
      if(ctx.onAddExplore&&it.id){ var exLbl=window.afExploreState?window.afExploreState(it.id).label:'Add to Explore'; acts.appendChild(lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',exLbl,function(){ ctx.onAddExplore(it); })); cap.push(exLbl); }
      if(ctx.refAllowed&&ctx.refAllowed(it)){ acts.appendChild(lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>','Reference',function(){ closeLb(); ctx.onRef&&ctx.onRef(it); })); cap.push('Reference'); }
      // BATCH4 #1/#2 — lightbox'da Upscale (rasm: Imagen · video: Topaz)
      // SC_17: lightbox Upscale amali olib tashlandi
      // D6 — qadash: lightbox YOPILMAYDI (natijani ko'rib turib qilinadigan amal)
      if(ctx.onPin&&it.id){
        var _pinEl=lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',(it.pinned?'Unpin':'Pin to top'),function(){
          ctx.onPin(it);
          // holat darhol ko'rinadi: `it` optimistik yangilanadi (galTogglePin), shu yerda aks etadi
          setTimeout(function(){ _pinEl.title=(it.pinned?'Unpin':'Pin to top'); _pinEl.classList.toggle('on',!!it.pinned); },0);
        });
        _pinEl.classList.toggle('on',!!it.pinned);
        acts.appendChild(_pinEl); cap.push('Pin');
      }
      if(ctx.onRestore&&it.prompt){ acts.appendChild(lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8a9 9 0 1 0 2.6-5.7L3 8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>','Regenerate',function(){ closeLb(); ctx.onRestore(it); })); cap.push('Regenerate'); }
      if(it.prompt){ acts.appendChild(lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>','Copy prompt',function(){ window.afCopyText(it.prompt); })); cap.push('Copy prompt'); } // P2/P7: afCopyText o'zi toast qiladi
      if(!ctx.isCEP){ acts.appendChild(lbIcon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>','Download',function(){ ctx.onDownload&&ctx.onDownload(it); })); cap.push('Download'); }
      document.getElementById('afLbCap').textContent=cap.join(' · ');
      lb.classList.add('on');
    }

    // ---- UMUMIY karta ----
    function actBtn(svg,title,fn,cls){ var b=document.createElement('b'); if(cls)b.className=cls; b.title=title; b.innerHTML=svg; b.addEventListener('click',fn); return b; }
    // P5/P14: gen'ning HAQIQIY nisbatini CSS qiymatiga aylantiradi ("16:9"→"16 / 9"). Manba:
    // it.aspect / it.aspectRatio / it.params.aspectRatio. Topilmasa null (default 1/1 qoladi).
    function genAspectCss(it){
      var ar=it&&(it.aspect||it.aspectRatio||(it.params&&it.params.aspectRatio));
      if(ar){ var m=String(ar).trim().match(/^(\d+(?:\.\d+)?)\s*[:\/x]\s*(\d+(?:\.\d+)?)$/i); if(m) return m[1]+' / '+m[2]; }
      // SC_16: aspect satri yo'q — haqiqiy piksellardan (payload width/height); baribir yo'q → null (CSS default 16/9)
      if(it&&it.width&&it.height&&Number(it.width)>0&&Number(it.height)>0)return Number(it.width)+' / '+Number(it.height);
      return null;
    }
    function card(it,ctx){
      ctx=ctx||{}; var cat=it.cat||'image';
      var d=document.createElement('div'); d.className='rc'+(ctx.isSelected&&ctx.isSelected(it)?' sel':'');
      d.tabIndex=0; d.setAttribute('role','button'); // SC_36: klaviatura fokusi — sarlavha+"Use ▾" fokusда ochiladi
      var arCss=genAspectCss(it); if(arCss) d.style.aspectRatio=arCss; // P5: haqiqiy nisbat (1/1 default'ni yengadi)
      if(cat==='video'){
        // haqiqiy poster (thumbUrl ≠ video url) bo'lsa u darhol chiziladi; bo'lmasa birinchi kadr yuklanadi
        // P9.2: hover 720p preview (bo'lsa) — asl to'liq faylni oqizmaydi
        var vPoster=(it.thumb&&it.thumb!==it.url)?it.thumb:null;
        var vEl=(typeof window.afVideoThumb==='function')?window.afVideoThumb(it.preview||it.url,vPoster):null;
        if(vEl){ d.appendChild(vEl);
          // HOVER PREVIEW: sichqoncha → JIM (muted) o'ynaydi; ketganда → to'xtab birinchi kadrга qaytadi (ovozsiz)
          d.addEventListener('mouseenter',function(){ try{ vEl.muted=true; var pp=vEl.play(); if(pp&&pp.catch)pp.catch(function(){}); }catch(e){} });
          d.addEventListener('mouseleave',function(){ try{ vEl.pause(); vEl.currentTime=0.1; }catch(e){} });
        } else if(it.thumb){ d.style.backgroundImage='url("'+it.thumb+'")'; }
        var pv=document.createElement('div'); pv.className='pv'; pv.innerHTML=IC.play; d.appendChild(pv); }
      else if(cat==='audio'||cat==='sfx'){
        // SC_16: maqsadli ixcham audio karta — play/pause + tur chipi + statik waveform + bitta satr.
        d.classList.add('rc-aud');
        var ap=document.createElement('button'); ap.type='button'; ap.className='aplay'; ap.title='Play / pause';
        ap.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>';
        ap.addEventListener('click',function(e){
          e.stopPropagation();
          // Yagona umumiy <audio> (lightbox pleer bilan bir xil URL yo'li) — bitta vaqtda bitta ijro
          var au=window.__afCardAudio||(window.__afCardAudio=new Audio());
          var pauseSvg='<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>';
          var playSvg='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>';
          if(au.src===it.url&&!au.paused){ au.pause(); ap.innerHTML=playSvg; return; }
          try{ au.pause(); }catch(err){}
          au.src=it.url; var pp=au.play(); if(pp&&pp.catch)pp.catch(function(){});
          document.querySelectorAll('.rc-aud .aplay').forEach(function(b){ b.innerHTML=playSvg; });
          ap.innerHTML=pauseSvg;
          au.onended=function(){ ap.innerHTML=playSvg; };
        });
        d.appendChild(ap);
        var ak=document.createElement('span'); ak.className='akind'; ak.textContent=(cat==='sfx')?'SFX':'VOICE'; d.appendChild(ak);
        var aw=document.createElement('span'); aw.className='awave';
        var seed=0; var sid=String(it.id||it.title||''); for(var si=0;si<sid.length;si++)seed=(seed*31+sid.charCodeAt(si))%997;
        for(var wi=0;wi<24;wi++){ var bar=document.createElement('i'); bar.style.height=(20+((seed+wi*37)%67))+'%'; aw.appendChild(bar); }
        d.appendChild(aw);
        var atx=document.createElement('span'); atx.className='atx';
        var dur=(it.params&&it.params.duration)?(it.params.duration+'s'):'';
        atx.innerHTML='<b></b><small></small>';
        atx.querySelector('b').textContent=String(it.title||'Audio');
        atx.querySelector('small').textContent=[dur,it.modelLabel||''].filter(Boolean).join(' · ');
        d.appendChild(atx);
      }
      else {
        // P4/P9: birinchi ko'rinadigan kartalar EAGER (grid darhol chiziladi), qolganlar lazy;
        // src endi 1280 display derivativini afzal ko'radi (Retina'da aniq); srcset 512/1280.
        var im=document.createElement('img');
        var _li=(ctx.list&&typeof ctx.list==='function')?(ctx.list()||[]).indexOf(it):-1;
        im.loading=(_li>-1&&_li<4)?'eager':'lazy'; im.decoding='async'; im.alt=''; im.src=(it.display||it.thumb||it.url);
        if(it.display&&it.thumb){ im.srcset=it.thumb+' 512w, '+it.display+' 1280w'; im.sizes='(max-width:520px) 50vw, 240px'; }
        im.style.cssText='position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover';
        d.appendChild(im);
      }
      var tg=document.createElement('div'); tg.className='tg'; tg.innerHTML=catIcon(cat); d.appendChild(tg);
      var bd=document.createElement('div'); bd.className='bd'; bd.textContent=String(it.title||catLabel(cat)); d.appendChild(bd);
      // SC_16: doimiy 6-ikon qatori O'RNIGA web-uslub bitta "Use ▾" tugmasi — bosilganda
      // kartaga LANGARLANGAN menyu ochiladi. Strip ikonasi → menyu bandi xaritasi 1:1:
      // Import→Import to Premiere · papka→Add to project · kompas→Add to Explore · qisqich→Use as
      // reference · ↻→Regenerate · ⧉→Copy prompt · ⬇→Download (faqat brauzer) · ✕→Delete.
      var ra=document.createElement('div'); ra.className='racts';
      var useBtn=document.createElement('b'); useBtn.className='useb'; useBtn.textContent='Use ▾'; useBtn.title='Actions';
      useBtn.addEventListener('click',function(e){
        e.stopPropagation();
        var items=[];
        items.push({ic:IC.imp,label:'Import to Premiere',fn:function(){ ctx.onImport&&ctx.onImport(it); }});
        if(ctx.onAddProject&&it.id)items.push({ic:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11v6M9 14h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',label:'Add to project',fn:function(){ ctx.onAddProject(it); }});
        if(ctx.onAddExplore&&it.id)items.push({ic:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',label:(window.afExploreState?window.afExploreState(it.id).label:'Add to Explore'),fn:function(){ ctx.onAddExplore(it); }});
        if(ctx.refAllowed&&ctx.refAllowed(it))items.push({ic:IC.ref,label:'Use as reference',fn:function(){ ctx.onRef&&ctx.onRef(it); }});
        // R4_08 — Topaz bir-bosishlik enhance/upscale (faqat yoqilgan op + mos media turida)
        var _tzIco='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        var _tzOp=(typeof window.afTopazOpFor==='function')?window.afTopazOpFor(it.cat||'image'):null;
        if(_tzOp){
          if((it.cat||'image')==='video'){
            items.push({ic:_tzIco,label:'Upscale video 2×',fn:function(){ window.afRunTopazOp(_tzOp,it,2); }});
            items.push({ic:_tzIco,label:'Upscale video 4×',fn:function(){ window.afRunTopazOp(_tzOp,it,4); }});
          } else {
            items.push({ic:_tzIco,label:'Upscale image',fn:function(){ window.afRunTopazOp(_tzOp,it,null); }});
          }
        }
        // D6 — qadash (ctx bergan ro'yxatlarda)
        if(ctx.onPin&&it.id)items.push({ic:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',label:(it.pinned?'Unpin':'Pin to top'),fn:function(){ ctx.onPin(it); }});
        if(ctx.onRestore&&it.prompt)items.push({ic:IC.rst,label:'Regenerate',fn:function(){ ctx.onRestore(it); }});
        if(it.prompt)items.push({ic:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',label:'Copy prompt',fn:function(){ window.afCopyText(it.prompt); }});
        if(!ctx.isCEP)items.push({ic:IC.dl,label:'Download',fn:function(){ ctx.onDownload&&ctx.onDownload(it); }});
        // SC_30: onDelete bermagan ctx'da o'lik band ko'rsatilmaydi; loyiha view'da label "Remove from project"
        if(ctx.onDelete)items.push({ic:IC.x,label:(ctx.deleteLabel||'Delete'),danger:true,fn:function(){ ctx.onDelete(it); }});
        afUseMenuOpen(useBtn,items);
      });
      ra.appendChild(useBtn);
      d.appendChild(ra);
      var cb=document.createElement('div'); cb.className='rcb'; cb.innerHTML=IC.chk; d.appendChild(cb);
      d.addEventListener('click',function(){ if(ctx.selecting&&ctx.selecting()){ ctx.onToggleSelect&&ctx.onToggleSelect(it,d); } else openLightbox(it,ctx); });
      // SC_36: Enter/Space kartani ochadi (klaviatura) — sichqonchasiz ham ishlaydi
      d.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '||e.keyCode===13||e.keyCode===32){ if(e.target!==d)return; e.preventDefault(); if(ctx.selecting&&ctx.selecting()){ ctx.onToggleSelect&&ctx.onToggleSelect(it,d); } else openLightbox(it,ctx); } });
      return d;
    }
    // ---- PENDING (gen ishlamoqda) karta — grid ichida 0-100% shkala. seq bo'yicha yangilanadi. ----
    function pcEsc(x){ return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
    function pendingCard(it,ctx){
      ctx=ctx||{}; var cat=it.cat||'image';
      var d=document.createElement('div'); d.className='rc rc-pend'; d.setAttribute('data-pseq',it.seq);
      var pct=Math.max(2,Math.min(100,Math.round(it.progress||2)));
      d.innerHTML=''
        +'<span class="rc-cat">'+catIcon(cat)+'</span>'
        +'<div class="rc-pmid"><span class="rc-spin"></span><span class="rc-ppct">'+pct+'%</span></div>'
        +'<div class="rc-pbar"><i style="width:'+pct+'%"></i></div>'
        +'<div class="rc-pprompt">'+pcEsc(it.prompt||'')+'</div>'
        +'<div class="rc-pcancel">Cancel</div>';
      var cn=d.querySelector('.rc-pcancel');
      if(cn)cn.addEventListener('click',function(e){ e.stopPropagation(); ctx.onCancel&&ctx.onCancel(it); });
      return d;
    }
    // Mavjud pending kartaning shkalasini yangilaydi (re-render'siz — silliq).
    function updatePending(root,seq,pct){
      var el=(root||document).querySelector('.rc-pend[data-pseq="'+seq+'"]'); if(!el)return;
      var p=Math.max(2,Math.min(100,Math.round(pct)));
      var fill=el.querySelector('.rc-pbar > i'); if(fill)fill.style.width=p+'%';
      var lab=el.querySelector('.rc-ppct'); if(lab)lab.textContent=p+'%';
    }
    return { card: card, pendingCard: pendingCard, updatePending: updatePending, openLightbox: openLightbox, closeLightbox: closeLb, catLabel: catLabel };
  })();

  function setBusy(b){var el=document.getElementById('busy');if(el)el.style.display=b?'inline-flex':'none';}

  // #142 (PX5) + #143 (PX6): prototip model ro'yxatlari (IMG/VID/IEDIT/VEDIT/I3D/TTS/
  // MUSIC/SFX_A/STT/AVATAR/OPS va VTT/ITP/PA) o'chirildi — hammasi BO'SH edi va faqat
  // mockup narx/tanlov mashinasida ishlatilardi. Modellar YAGONA manbadan keladi:
  // server `/api/studio/gen/models` (imggen/vidgen/audgen o'z katalogini shundan oladi).

  function go(id){
    // Har view almashganda Rasm/Video tool poll/progress timerlari + inline pleyer ovozini tozalaymiz (leak fix — audit).
    if(typeof window.axIGTeardown==='function'){ try{ window.axIGTeardown(); }catch(e){} }
    if(typeof window.axVGTeardown==='function'){ try{ window.axVGTeardown(); }catch(e){} }
    if(typeof window.axAGTeardown==='function'){ try{ window.axAGTeardown(); }catch(e){} }
    if(id==='main'||id==='home'){ if(typeof window.goHome==='function')window.goHome(); return; } // ‹ Asosiy → Home
    closeSheet();
    // UXP composer paint yamoqlari inline yoziladi; keyingi view'da ular
    // `.view{display:none}` ni bosib ketmasligi shart. Faqat ketayotgan
    // composer(lar)dan yamoq xossalarini tozalaymiz, yangi target pastda qayta
    // mahkamlanadi. Aks holda picker ustida eski composer ko'rinib qoladi.
    if(window.__FFNodeIO){
      ['imggen','vidgen','audgen'].forEach(function(_cid){
        if(_cid===id)return;
        var _cv=document.getElementById('v-'+_cid); if(!_cv)return;
        ['display','flex-direction','flex','min-height','opacity','visibility','transform','animation'].forEach(function(_p){_cv.style.removeProperty(_p);});
      });
    }
    document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});
    var _v=document.getElementById('v-'+id); if(!_v)return; _v.classList.add('on');document.querySelector('.axroot .scroll').scrollTop=0; // F-01: null guard — mavjud bo'lmagan view id router'ni qulatmasin
    document.querySelectorAll('.resultArea').forEach(function(r){r.innerHTML='';});
    document.querySelectorAll('.proc').forEach(function(p){p.classList.remove('on');p.innerHTML='';});
    if(id==='history')renderHistory('all');
    if(id==='launcher'&&typeof aiRenderHistStrip==='function')aiRenderHistStrip();
    if(id==='settings'){ if(typeof renderLedger==='function')renderLedger(); if(typeof renderPlanLine==='function')renderPlanLine(); }
    if(typeof axAuto==='function')axAuto(id);
    // Rasm yaratish tool o'z header'iga ega — AI .pbar'ni yashiramiz; kreditni yangilaymiz.
    // Ixcham header: tool/AI Tools view'lari o'z bitta qatoriga ega → takror brand+kredit pbar yashirin.
    var _aipbar=document.querySelector('.axroot .app > .pbar'); if(_aipbar)_aipbar.style.display=(id==='imggen'||id==='vidgen'||id==='audgen'||id==='launcher'||id==='aicat'||id==='history'||id==='settings'||id==='sessions'||id==='session'||id==='projects'||id==='project')?'none':'';
    // Premiere UXP composer DOM'ini render/async tarix yuklashidan OLDIN qat'iy
    // layoutga o'tkazamiz. Aks holda hidden picker → flex composer almashinuvi
    // paytida host sog'lom DOM'ni qora paint qatlamida keshlar ekan. Premiere/CEP
    // tartibi o'zgarmaydi; pastdagi umumiy chaqiruv UXP'da takrorlanmaydi.
    var _uxpWorkspacePrepared=false;
    var _uxpComposerTarget=(id==='imggen'||id==='vidgen'||id==='audgen');
    if(window.__FFNodeIO&&_uxpComposerTarget&&typeof window.axwsAfterView==='function'){
      try{window.axwsAfterView(id);_uxpWorkspacePrepared=true;}catch(e){}
    }
    syncBal(); // kredit yagona manba (real aiCredits) — balTop + AI Tools ixcham header sinxron
    if(id==='imggen'&&typeof window.axIGRefresh==='function'){try{window.axIGRefresh();}catch(e){}}
    if(id==='vidgen'&&typeof window.axVGRefresh==='function'){try{window.axVGRefresh();}catch(e){}} // FIX H: video ham view ochilганда retry
    if(id==='audgen'&&typeof window.axAGRefresh==='function'){try{window.axAGRefresh();}catch(e){}} // P8: audio tool
    if((id==='sessions'||id==='projects')&&typeof window.axSPRefresh==='function'){try{window.axSPRefresh(id);}catch(e){}} // P1
    if(!_uxpWorkspacePrepared&&typeof window.axwsAfterView==='function'){try{window.axwsAfterView(id);}catch(e){}} // #R1: workspace chrome (strip/viewbar/empty) yangilash
  }

  // #143 (PX6): mockup davrining SOXTA narx/model mashinasi o'chirildi —
  // `parseSec`/`estimate` (model NOMIDAN taxminiy kredit), `openSelect` (bottom-sheet
  // model tanlash), `buildBar` (chip-bar + "~N kr · ~$X" + Generate) va `renderCtrls`.
  // Hech biri chaqirilmasdi (`buildBar` ichidagi `run()` esa umuman mavjud emas edi),
  // REAL oqim esa serverdan: `/gen/models` katalogi + imzolangan `/gen/cost-quote`.

  // ===== reference strip =====
  function refStripHTML(label,thumbs,kind){var t=thumbs.map(function(x){return '<div class="refthumb"><div class="'+x.c+'" style="width:100%;height:100%"></div>'+(x.lab?'<span class="lab">'+x.lab+'</span>':'')+'</div>';}).join('');return '<div class="amal">'+label+'</div><div class="refstrip">'+t+'<div class="refadd" data-ref="'+kind+'">+</div></div>';}




  // ===== EDIT hubs =====
  function srcBanner(kind){var m=axGetMedia(kind);if(!m)return '<div class="src empty" data-ref="'+kind+'"><span class="d"></span><div class="x"><b>No source selected</b><small>Choose from Premiere Project or upload</small></div><span class="sw">Select</span></div>';return '<div class="src"><span class="d"></span><div class="x"><b>'+axEsc(m.name)+'</b><small>'+(m.mediaType||'media')+' · auto-loaded</small></div><span class="sw" data-ref="'+kind+'">Replace</span></div>';}
  function axPreview(kind){var m=axGetMedia(kind);if(!m)return '';var v=(kind==='video');return '<div class="prev '+(v?'v':'i')+'">'+(v?'<div class="pl">\u25B6</div>':'')+'<div class="cap">'+axEsc(m.name)+'</div></div>';}
  function axEsc(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function emptyBox(kind){return '<div class="empty"><b>Source needed</b>Choose or upload media from the Project panel.<br><span class="pick" data-ref="'+kind+'">Select / Upload</span></div>';}

  function mkBtn(t,fn,cls){var d=document.createElement('div');d.className='rb'+(cls?' '+cls:'');d.textContent=t;d.onclick=fn;return d;}


  // ===== history (REAL /api/studio/gen/history) =====
  var HIST=[],histLoaded=false,histLoading=false,histLoadedAt=0;
  function histStale(){ return !histLoaded||(Date.now()-histLoadedAt>25*60*1000); } // signed URL eskirmasin (#8)
  function histEsc(s){return String(s==null?'':s).replace(/[<>&"]/g,function(c){return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c];});}
  function histType(mode){ return mode==='video'?'video':(mode==='voice'||mode==='music')?'audio':'image'; }
  var histCbs=[];
  function histFlush(){ var cbs=histCbs.splice(0); cbs.forEach(function(f){ try{ f(); }catch(e){} }); }
  function loadHistory(cb){
    if(cb)histCbs.push(cb);
    if(histLoading)return; histLoading=true;
    studioGet('/api/studio/gen/history?limit=40').then(function(d){
      var items=(d&&d.items)||[];
      HIST=items.map(function(g){
        var a=(g.assets&&g.assets[0])||{};
        var p=(g.params||{});
        var sub=[p.aspectRatio,p.quality||p.resolution,p.duration?(p.duration+'s'):null].filter(Boolean).join(' · ');
        return {id:g.id,t:histType(g.mode),mode:g.mode,url:a.url||'',thumb:a.thumbUrl||a.url||'',downloadUrl:a.downloadUrl||null,
          display:a.displayUrl||null,preview:a.previewUrl||null,width:a.width||null,height:a.height||null, // P9
          title:((g.prompt||'').trim()||'Result').slice(0,60),sub:sub,
          prompt:(g.prompt||'').trim(),params:p, // FIX G: lightbox meta karta uchun to'liq prompt+params
          cost:(typeof g.cost==='number'?g.cost:0),created:g.createdAt};
      });
      histLoaded=true; histLoading=false; histLoadedAt=Date.now(); histFlush();
    }).catch(function(){ histLoading=false; histFlush(); });
  }
  // b11: KREDIT TARIXI — gen xarajatlari (/gen/history cost maydonidan; alohida ledger endpoint yo'q)
  function ledgerWhen(iso){
    var d=new Date(iso); if(isNaN(d.getTime()))return '';
    var now=new Date();
    var hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    var day=function(x){return x.getFullYear()+'-'+x.getMonth()+'-'+x.getDate();};
    if(day(d)===day(now))return 'today '+hm;
    var y=new Date(now.getTime()-86400000);
    if(day(d)===day(y))return 'yesterday '+hm;
    return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+' '+hm;
  }
  var _ledIC={
    video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 10l6-3v10l-6-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    audio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 8a5 5 0 010 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  // P21 (29) — HAQIQIY kredit ledger (CreditLedger endpoint): consume/refund/topup KO'RINADI.
  // Ilgari /gen/history cost'idan yasalardi → QAYTARILGAN KREDITLAR KO'RINMASDI ("pulimni yeb qo'ydi").
  var LEDGER=[],ledgerLoaded=false,ledgerLoading=false,ledgerTotals=null,ledgerCbs=[];
  function ledgerFlush(){ var cbs=ledgerCbs.splice(0); cbs.forEach(function(f){ try{ f(); }catch(e){} }); }
  function loadLedgerReal(cb){
    if(cb)ledgerCbs.push(cb);
    if(ledgerLoading)return; ledgerLoading=true;
    studioGet('/api/studio/credits/ledger').then(function(d){
      LEDGER=(d&&d.items)||[]; ledgerTotals=(d&&d.totals)||null; ledgerLoaded=true; ledgerLoading=false; ledgerFlush();
    }).catch(function(){ ledgerLoading=false; ledgerFlush(); });
  }
  var _ledReasonIC={
    refund:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-8 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    topup:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function renderLedger(){
    var w=document.getElementById('setLedger'); if(!w)return;
    var draw=function(){
      var t=ledgerTotals||{totalSpent:0,totalRefunded:0,netSpent:0,totalPurchased:0};
      var head='<div class="set-ltot"><span>SPENT<b>✦'+t.totalSpent+'</b></span><span class="ref">REFUNDED<b>✦'+t.totalRefunded+'</b></span><span>NET<b>✦'+t.netSpent+'</b></span></div>';
      if(!LEDGER.length){ w.innerHTML=head+'<div class="set-lgempty">No transactions yet — it\'ll show up here once you generate.</div>'; return; }
      var html=head;
      LEDGER.forEach(function(r){
        var g=(r.gen&&!r.gen.deleted)?r.gen:null, deleted=!!(r.gen&&r.gen.deleted);
        var isRefund=r.reason==='refund', isBuy=r.reason==='topup', isClaw=r.reason==='clawback';
        var pos=(r.delta||0)>0;
        var kindLbl=isRefund?'Refund':isBuy?'Credit pack':isClaw?'Reversal':(g?(g.mode==='video'?'Video':g.mode==='voice'?'Voice':g.mode==='sfx'?'SFX':'Image'):'Generation');
        var title=isBuy?'Credit pack':isClaw?'Credit pack reversal':(g?((g.prompt||'').trim()||kindLbl):(deleted?(isRefund?'Refund (deleted)':'Generation (deleted)'):(isRefund?'Refund':'Generation')));
        var sub=(g&&g.modelLabel?g.modelLabel:kindLbl)+' · '+ledgerWhen(r.createdAt);
        var ic=isRefund?_ledReasonIC.refund:isBuy?_ledReasonIC.topup:(_ledIC[g?histType(g.mode):'image']||_ledIC.image);
        var amt=(r.delta<0?('− '+Math.abs(r.delta)):('+ '+(r.delta||0)));
        var bal=(typeof r.balanceAfter==='number')?('<small>✦'+r.balanceAfter+'</small>'):'';
        html+='<div class="set-lrow'+(pos?' plus':'')+'">'
          +'<div class="set-lic" title="'+histEsc(kindLbl)+'">'+ic+'</div>'
          +'<div class="set-lt"><b title="'+histEsc(title)+'">'+histEsc(title)+'</b><small>'+histEsc(sub)+'</small></div>'
          +'<span class="set-lamt'+(pos?' pos':' neg')+'">'+amt+bal+'</span>'
          +'</div>';
      });
      w.innerHTML=html;
    };
    if(ledgerLoaded)draw(); else w.innerHTML='<div class="set-lgempty">Loading…</div>';
    // Har ochilganда fon yangilash (refund/yangi gen ko'rinsin). loadLedgerLoading ikki-yuklashdan himoya.
    loadLedgerReal(function(){ if(!ledgerLoaded){ if(!w.querySelector('.set-lrow'))w.innerHTML='<div class="set-lgempty">History failed to load — check your internet/session.</div>'; return; } draw(); });
  }
  function renderPlanLine(){
    var el=document.getElementById('setPlanLine'); if(!el)return;
    try{
      var u=(typeof AssetFlowAccount!=='undefined'&&AssetFlowAccount.getCachedUser)?AssetFlowAccount.getCachedUser():null;
      var plan=u&&(u.plan||u.subscription);
      el.textContent=plan?('plan — '+String(plan).toUpperCase()):' ';
    }catch(e){ el.textContent=' '; }
  }
  // To'liq Tarix view — umumiy galereya komponenti (scope:'all'). Filter+zoom+select galereya ichida.
  function renderHistory(){
    var w=document.getElementById('hgridWrap'); if(!w)return;
    if(window.afGallery){ window.afGallery.invalidate(); window.afGallery.render(w,{scope:'all'}); }
    else { w.innerHTML='<div class="empty"><b>Gallery failed to load</b></div>'; }
  }
  // #143 (PX6): `histDetail()` o'chirildi — uni faqat o'lik `data-hist` shoxobchasi chaqirardi.
  // Tarix detali endi umumiy galereya lightbox'i (afGallery) orqali ochiladi.

  // ===== modal / picker =====
  function openSheet(h){document.getElementById('sheet').innerHTML=h;document.getElementById('ov').classList.add('on');}
  function closeSheet(){document.getElementById('ov').classList.remove('on');}
  function refPicker(kind){
    if(typeof IS_CEP!=='undefined'&&IS_CEP){
      var fn=(kind==='video')?'getActiveTimelineVideoReference':'getSelectedProjectReference';
      axProbe(fn).then(function(r){return (r&&r.mediaPath)?r:axProbe('getSelectedProjectReference');}).then(function(r){
        var ok=r&&r.mediaPath&&(kind==='video'?r.mediaType==='video':kind==='audio'?r.mediaType==='audio':(r.mediaType!=='video'&&r.mediaType!=='audio'));
        if(ok){ axMedia[kind]={name:r.name||String(r.mediaPath).split(/[\\/]/).pop(),mediaPath:r.mediaPath,mediaType:r.mediaType}; toast('Selected: '+axMedia[kind].name); var v=document.querySelector('.axroot .view.on'); if(v)axRerenderSrc(v.id.replace('v-','')); }
        else toast('No '+(kind==='video'?'video':kind==='audio'?'audio':'image')+' selected in Premiere \u2014 choose one from Project/Timeline','warn');
      });
      return;
    }
    toast('Reference only works inside Premiere Pro','warn');
  }

  // ===== Reference store: fayl yuklash (CEP) + Premiere Project + thumbnail + olib tashlash =====
  var axRefStore={};      // key -> [ {name,path,url,isImg,icon} ]
  var axRefReg={};        // key -> { cid, kind, max, label }
  var axRefProjCache={};  // key -> [project items] (sheet ochilganda)
  var AX_IMG_EXT=['png','jpg','jpeg','webp','gif','bmp','tif','tiff','avif','heic'];
  var AX_VID_EXT=['mp4','mov','webm','m4v','avi','mkv'];
  var AX_AUD_EXT=['mp3','wav','aac','m4a','flac','ogg'];
  function axBasename(p){return String(p||'').split(/[\\/]/).pop()||String(p||'');}
  function axExt(p){var m=/\.([a-z0-9]+)$/i.exec(String(p||''));return m?m[1].toLowerCase():'';}
  function axIsImgExt(p){return AX_IMG_EXT.indexOf(axExt(p))>=0;}
  function axFileUrl(p){var s=String(p||'').replace(/\\/g,'/').replace(/^\/+/,'');return 'file:///'+encodeURI(s).replace(/#/g,'%23').replace(/\?/g,'%3F');}
  function axMime(p){var e=axExt(p);return e==='jpg'?'image/jpeg':((e==='tif'||e==='tiff')?'image/tiff':(e==='svg'?'image/svg+xml':'image/'+(e||'png')));}
  function axReadBase64(p){try{if(window.cep&&window.cep.fs&&window.cep.fs.readFile){var enc=(window.cep.encoding&&window.cep.encoding.Base64)||'Base64';var r=window.cep.fs.readFile(p,enc);if(r&&(r.err===0||r.err==null)&&r.data)return 'data:'+axMime(p)+';base64,'+r.data;}}catch(e){}return null;}
  function axRefIcon(kind,p){return axIsImgExt(p)?'🖼️':((kind==='video'||AX_VID_EXT.indexOf(axExt(p))>=0)?'🎬':((kind==='audio'||AX_AUD_EXT.indexOf(axExt(p))>=0)?'🎵':'📄'));}
  function axImgEl(url,path){var im=document.createElement('img');im.className='axim';im.alt='';im.src=url;im.onerror=function(){var d=axReadBase64(path);if(d){im.onerror=function(){im.style.display='none';};im.src=d;}else{im.style.display='none';}};return im;}

  function axRefRender(key){
    var reg=axRefReg[key]; if(!reg)return;
    var c=document.getElementById(reg.cid); if(!c)return;
    var list=axRefStore[key]||(axRefStore[key]=[]);
    c.innerHTML='';
    var head=document.createElement('div');head.className='amal';head.textContent=reg.label+(reg.max>1?' · '+list.length+'/'+reg.max:'');c.appendChild(head);
    var strip=document.createElement('div');strip.className='refstrip';c.appendChild(strip);
    list.forEach(function(it,i){
      var th=document.createElement('div');th.className='refthumb';th.title=it.name;
      var ph=document.createElement('div');ph.className='axph';ph.textContent=it.icon||'📄';th.appendChild(ph);
      if(it.isImg&&it.url)th.appendChild(axImgEl(it.url,it.path));
      var lab=document.createElement('span');lab.className='lab';lab.textContent=it.name;th.appendChild(lab);
      var x=document.createElement('span');x.className='refx';x.textContent='×';x.title='Remove';x.setAttribute('data-refdel',key+'|'+i);th.appendChild(x);
      strip.appendChild(th);
    });
    if(list.length<reg.max){var add=document.createElement('div');add.className='refadd';add.textContent='+';add.setAttribute('data-refadd',key);strip.appendChild(add);}
  }
  function axRefAdd(key,path,kind){
    var list=axRefStore[key]||(axRefStore[key]=[]); var reg=axRefReg[key]; var max=reg?reg.max:1;
    if(!path)return false;
    if(list.length>=max){toast('Maximum '+max+' reference(s)','warn');return false;}
    for(var j=0;j<list.length;j++){if(list[j].path===path)return false;} // duplicate
    var k=kind||(reg&&reg.kind)||'image';
    list.push({name:axBasename(path),path:path,url:axFileUrl(path),isImg:axIsImgExt(path),icon:axRefIcon(k,path)});
    axRefRender(key); return true;
  }
  function axRefRemove(key,idx){var list=axRefStore[key];if(!list||idx<0||idx>=list.length)return;list.splice(idx,1);axRefRender(key);toast('Reference removed');}

  async function axRefUpload(key){
    var reg=axRefReg[key]; if(!reg)return;
    if(!(window.cep&&window.cep.fs&&typeof window.cep.fs.showOpenDialog==='function')){toast('File upload only works inside Premiere Pro','warn');return;}
    var exts=(reg.kind==='video')?AX_VID_EXT:(reg.kind==='audio')?AX_AUD_EXT:AX_IMG_EXT;
    var multi=reg.max>1; var r;
    try{r=await window.cep.fs.showOpenDialog(multi,false,'Choose reference file(s)','',exts);}catch(e){r=null;}
    var paths=(r&&r.data)||[]; if(!paths.length){return;} // canceled: data empty (not an error)
    var added=0,skipped=0;
    paths.forEach(function(p){
      if(reg.kind==='image'&&!axIsImgExt(p)){skipped++;return;} // JS extension check (dialog filter isn't reliable)
      if(axRefAdd(key,p,reg.kind))added++;
    });
    closeSheet();
    if(added)toast(added+' reference(s) added'); else if(skipped)toast('Choose an image file (png/jpg/webp…)','warn');
  }
  function axRefPicker(key){
    var reg=axRefReg[key]; if(!reg)return;
    openSheet('<div class="sh"><b>Add reference</b><span class="cl" data-close>✕</span></div>'
      +'<div class="upbtn" id="axRefUp">⬆ Choose from file'+(reg.max>1?' (multiple)':'')+'</div>'
      +'<div class="amal" style="margin:13px 0 6px">Premiere Project items</div>'
      +'<div id="axRefProj"><div class="axhint">Loading…</div></div>');
    var up=document.getElementById('axRefUp'); if(up)up.onclick=function(){axRefUpload(key);};
    axRefLoadProject(key);
  }
  function axRefLoadProject(key){
    var box=document.getElementById('axRefProj'); if(!box)return;
    if(!(typeof IS_CEP!=='undefined'&&IS_CEP)){box.innerHTML='<div class="axhint">The Premiere Project list only works inside Premiere Pro. Use file upload instead.</div>';return;}
    axProbe('listProjectFootage').then(function(r){
      if(!document.getElementById('axRefProj'))return; // sheet closed
      var items=(r&&r.items)?r.items:[]; var reg=axRefReg[key];
      if(reg&&reg.kind==='image')items=items.filter(function(it){return it.mediaType==='image'||axIsImgExt(it.mediaPath);});
      else if(reg&&reg.kind==='video')items=items.filter(function(it){return it.mediaType==='video';});
      axRefProjCache[key]=items;
      if(!items.length){box.innerHTML='<div class="axhint">No matching footage found in the Project. Import it in the Project panel or upload a file.</div>';return;}
      box.innerHTML='';
      items.forEach(function(it,i){
        var row=document.createElement('div');row.className='pickrow';row.setAttribute('data-refproj',key+'|'+i);
        var tn=document.createElement('div');tn.className='tn';
        var ph=document.createElement('div');ph.className='axph';ph.textContent=axRefIcon(it.mediaType,it.mediaPath);tn.appendChild(ph);
        if(axIsImgExt(it.mediaPath))tn.appendChild(axImgEl(axFileUrl(it.mediaPath),it.mediaPath));
        var nm=document.createElement('div');nm.className='nm';nm.innerHTML='<b>'+axEsc(it.name)+'</b><small>'+axEsc(it.mediaType||'footage')+'</small>';
        row.appendChild(tn);row.appendChild(nm);box.appendChild(row);
      });
    });
  }
  function axRefProjPick(key,idx){var items=axRefProjCache[key];if(!items||!items[idx])return;var it=items[idx];if(axRefAdd(key,it.mediaPath,it.mediaType))toast('Added: '+it.name);closeSheet();}

  // ===== delegation =====
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='ov'){closeSheet();return;} // backdrop bosilsa sheet yopiladi (stuck-overlay oldini oladi)
    // #143 (PX6): mockup davridan qolgan o'lik data-* shoxobchalari o'chirildi —
    // data-toast / data-toastmsg / data-op / data-soon / data-hf / data-hist / data-seg /
    // data-toggle / data-img2vid. Hech bir DOM elementi ularni ishlatmasdi, ikkitasi esa
    // mavjud bo'lmagan funksiya/o'zgaruvchini chaqirardi (`op()`, `vidCur`/`vidMode`).
    var el=e.target.closest('[data-go],[data-ref],[data-refadd],[data-refdel],[data-refproj],[data-close],[data-imp]');
    if(!el)return;
    if(el.hasAttribute('data-refdel')){var rd=el.getAttribute('data-refdel').split('|');axRefRemove(rd[0],parseInt(rd[1],10));return;}
    if(el.hasAttribute('data-refadd')){axRefPicker(el.getAttribute('data-refadd'));return;}
    if(el.hasAttribute('data-refproj')){var rp=el.getAttribute('data-refproj').split('|');axRefProjPick(rp[0],parseInt(rp[1],10));return;}
    if(el.hasAttribute('data-imp')){importTarget=el.getAttribute('data-imp');document.getElementById('impComp').classList.toggle('tg',importTarget==='comp');document.getElementById('impComp').classList.toggle('on',importTarget==='comp');document.getElementById('impBin').classList.toggle('on',importTarget==='bin');toast('Default import: '+(importTarget==='comp'?'Comp':'Bin'));return;}
    if(el.hasAttribute('data-go'))go(el.getAttribute('data-go'));
    else if(el.hasAttribute('data-ref'))refPicker(el.getAttribute('data-ref'));
    if(el.hasAttribute('data-close'))closeSheet();
  });

  // ===== time-range (per container) =====
  function initTR(box){var tl=box.querySelector('.tl');if(!tl)return;var sel=box.querySelector('.sel'),h1=box.querySelector('.h1'),h2=box.querySelector('.h2'),dur=box.querySelector('.dur'),mid=box.querySelector('.mid'),warn=box.querySelector('.warnrow');var TOTAL=10,MAX=5,a=30,b=70,drag=null;
    try{ if(typeof axWorkArea!=='undefined'&&axWorkArea&&axWorkArea.compDuration>0){ TOTAL=axWorkArea.compDuration; var ws=axWorkArea.workAreaStart||0, wd=axWorkArea.workAreaDuration||TOTAL; a=Math.max(0,ws/TOTAL*100); b=Math.min(100,(ws+wd)/TOTAL*100); } }catch(e){}
    function fmt(s){var m=Math.floor(s/60),x=Math.round(s%60);return m+':'+String(x).padStart(2,'0');}
    function upd(){a=Math.max(0,Math.min(a,b-5));b=Math.min(100,Math.max(b,a+5));sel.style.left=a+'%';sel.style.width=(b-a)+'%';h1.style.left='calc('+a+'% - 4px)';h2.style.left='calc('+b+'% - 4px)';var d=(b-a)/100*TOTAL,over=d>MAX;dur.textContent=(Math.round(d*10)/10)+'s'+(over?' ⚠':' ✓');dur.className='dur'+(over?' w':'');sel.className='sel'+(over?' w':'');h1.className='h h1'+(over?' w':'');h2.className='h h2'+(over?' w':'');mid.textContent=fmt(a/100*TOTAL)+' – '+fmt(b/100*TOTAL);mid.style.color=over?'#FFB27C':'var(--acc)';warn.className='warnrow'+(over?' on':'');}
    function pos(e){var r=tl.getBoundingClientRect();var x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;return Math.max(0,Math.min(100,x/r.width*100));}
    function down(w){return function(e){drag=w;e.preventDefault();e.stopPropagation();};}
    h1.addEventListener('mousedown',down('a'));h2.addEventListener('mousedown',down('b'));h1.addEventListener('touchstart',down('a'));h2.addEventListener('touchstart',down('b'));
    function move(e){if(!drag)return;var p=pos(e);if(drag==='a')a=p;else b=p;upd();}
    document.addEventListener('mousemove',move);document.addEventListener('touchmove',move,{passive:false});document.addEventListener('mouseup',function(){drag=null;});document.addEventListener('touchend',function(){drag=null;});
    box.querySelectorAll('.seg .s').forEach(function(s){s.onclick=function(){box.querySelectorAll('.seg .s').forEach(function(x){x.classList.remove('on');});s.classList.add('on');toast(s.classList.contains('sf')?'Whole clip':'Work area');};});
    upd();}

  // HOST ulanishi (mavjud host.jsx; faqat host READ — kredit emas)
  var IS_CEP=(typeof window.__adobe_cep__!=='undefined');
  var axWorkArea=null, axAutoTimer=null, axMedia={}, axOpKind='image';
  function axGetMedia(kind){return axMedia[kind]||null;}
  function axRerenderSrc(id){
    if(id==='editimage'){var e=document.getElementById('eiSrc');if(e)e.innerHTML=srcBanner('image')+axPreview('image');}
    else if(id==='editvideo'){var sv=document.getElementById('evSrc');if(sv)sv.innerHTML=srcBanner('video')+axPreview('video');var tv=document.getElementById('evTr');if(tv){tv.innerHTML=axGetMedia('video')?trHTML():'';if(axGetMedia('video'))initTR(tv);}}
    else if(id==='op'){var oi=document.getElementById('opInputs');if(oi)oi.innerHTML=srcBanner(axOpKind)+axPreview(axOpKind);var oz=document.getElementById('opTr');if(oz){oz.innerHTML=(axOpKind==='video'&&axGetMedia('video'))?trHTML():'';if(axOpKind==='video'&&axGetMedia('video'))initTR(oz);}}
  }
  function axProbe(fn){return new Promise(function(res){
    if(!IS_CEP||typeof csInterface==='undefined'||!csInterface){res(null);return;}
    try{var ext=csInterface.getSystemPath((typeof SystemPath!=='undefined'&&SystemPath.EXTENSION)?SystemPath.EXTENSION:'extension');
      var jp=(ext+'/jsx/host.jsx').replace(/\\/g,'/');
      csInterface.evalScript('(function(){$.evalFile('+JSON.stringify(jp)+'); return '+fn+'();})()',function(raw){
        var r=null;try{r=raw?JSON.parse(raw):null;}catch(e){r=null;}res((r&&r.ok)?r:null);});
    }catch(e){res(null);}});}
  function axAuto(id){
    if(axAutoTimer){clearInterval(axAutoTimer);axAutoTimer=null;}
    var kind=(id==='editimage')?'image':(id==='editvideo')?'video':(id==='op')?axOpKind:null;
    if(!kind)return;
    if(!IS_CEP){axRerenderSrc(id);return;} // brauzer: empty state
    var tick=function(){
      var p0=(kind==='video')?axProbe('getActiveTimelineVideoReference'):Promise.resolve(null);
      p0.then(function(r){return (r&&r.mediaPath)?r:axProbe('getSelectedProjectReference');}).then(function(r){
        var typeOk=r&&r.mediaPath&&(kind==='video'?r.mediaType==='video':(r.mediaType!=='video'&&r.mediaType!=='audio'));
        var cur=axMedia[kind];
        if(typeOk){ if(cur&&cur.mediaPath===r.mediaPath)return; axMedia[kind]={name:r.name||String(r.mediaPath).split('/').pop().split(String.fromCharCode(92)).pop(),mediaPath:r.mediaPath,mediaType:r.mediaType}; }
        else { if(!cur)return; axMedia[kind]=null; }
        if(kind==='video'){axProbe('getWorkAreaInfo').then(function(w){axWorkArea=w;axRerenderSrc(id);});}else axRerenderSrc(id);
      });
    };
    tick(); axAutoTimer=setInterval(tick,1500);
  }
  // ── AI Tools kategoriya navigatsiyasi ──
  var _catImgSVG='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var _catVidSVG='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 8l-6 4 6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var _catAudSVG='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 8a5 5 0 010 8M19.5 5.5a9 9 0 010 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var _cat3dSVG='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22V12M21 7l-9 5L3 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var _toolImgSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var _toolVidSVG='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 8l-6 4 6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // SC_05: models/sub — FALLBACK matnlar (fetch kelguncha / xatoda); jonli katalog
  // (window.__afLiveModelNames — fhomeFetchModels to'ldiradi) kelgach ular almashadi.
  // BIR qator format (ellipsis CSS'da) — eski 2 qatorli <br> ro'yxat olib tashlandi.
  // SC_17: Upscale tool'lari BUTUNLAY olib tashlandi (UX+UI+kod) — har kategoriyada
  // bitta jonli tool qoldi → launcher kartasi generatorni TO'G'RIDAN ochadi
  // (oraliq "TOOLS" ro'yxat ekrani o'chirildi).
  var AI_CATS=[
    {id:'image',name:'Image',icon:_catImgSVG,card:'Generate image',models:'Nano Banana 2 · Imagen 4',glow:'rgba(143,79,209,.22)',tools:[
      {name:'Generate image',sub:'Nano Banana 2 · Imagen 4',icon:_toolImgSVG,dest:'imggen'}
    ]},
    {id:'video',name:'Video',icon:_catVidSVG,card:'Generate video',models:'Veo 3.1 · Seedance 2.0',glow:'rgba(46,157,192,.2)',tools:[
      {name:'Generate video',sub:'Veo 3.1 · Seedance 2.0',icon:_toolVidSVG,dest:'vidgen'}
    ]},
    {id:'audio',name:'Audio',icon:_catAudSVG,card:'Generate audio',models:'Chirp 3 HD · ElevenLabs SFX',glow:'rgba(230,179,53,.2)',tools:[
      {name:'Generate audio',sub:'Chirp 3 HD · ElevenLabs SFX',icon:_catAudSVG,dest:'audgen'}
    ]}
  ];
  // P8: "3D" karta olib tashlandi (backend'da 3D yo'q — halol tool to'plami);
  // Audio endi JONLI (Voice/Kokoro + SFX/ElevenLabs → v-audgen).
  // b1: pastki info-toast — bo'sh kategoriya bosilganda (mockup)
  var _soonToastT=null;
  function aiSoonToast(){
    var t=document.getElementById('aiSoonToast'); if(!t)return;
    t.classList.add('on'); clearTimeout(_soonToastT);
    _soonToastT=setTimeout(function(){ t.classList.remove('on'); },2400);
  }
  function aiRenderCatGrid(){
    var g=document.getElementById('aiCatGrid'); if(!g)return;
    g.innerHTML='';
    var cmsEsc=function(v){ return String(v==null?'':v).replace(/[<>&"]/g,function(ch){return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[ch];}); };
    AI_CATS.forEach(function(c,idx){
      // FAZA 5 (C5): jonli tool'i yo'q kategoriya (faza-2 Audio/3D) end user'ga
      // KO'RSATILMAYDI — "COMING SOON" karta o'rniga launcher'da faqat ishlaydigan
      // bo'limlar qoladi. Faza-2 ulanish tayyor bo'lgach AI_CATS'dagi tools[]
      // to'ldiriladi va karta o'z-o'zidan qaytadi.
      var hasTools=c.tools.some(function(t){return !t.soon;});
      if(!hasTools)return;
      // SC_04: CMS override (title/desc/media) — bo'sh maydon = built-in matn qoladi
      var ov=(window.__afCmsAiCards&&window.__afCmsAiCards[idx])||null;
      var nm=(ov&&ov.title)?cmsEsc(ov.title):c.card;
      // SC_05: ustuvorlik — CMS desc > JONLI katalog nomlari > hardcoded fallback
      var live=(window.__afLiveModelNames&&window.__afLiveModelNames[c.id])||null;
      var models=(ov&&ov.desc)?cmsEsc(ov.desc):(live?cmsEsc(live):c.models);
      var mediaHtml='';
      if(ov&&ov.mediaUrl){
        var mu=cmsEsc(ov.mediaUrl);
        mediaHtml='<div class="cat-media">'
          +(ov.mediaType==='video'
            ?'<video src="'+mu+'" muted loop autoplay playsinline></video>'
            :'<img src="'+mu+'" alt="">')
          +'<span class="cat-scrim"></span></div>';
      }
      var el=document.createElement('div');
      el.className='cat';
      // CMS nishonlari: DOM tartibi emas, AI_CATS indeksi (jonli tool'i yo'q karta chizilmaydi)
      el.setAttribute('data-cms','aiLauncher.cards.'+idx);
      el.innerHTML=mediaHtml
        +'<div class="cat-glow" style="background:radial-gradient(110% 90% at 85% -10%,'+c.glow+',transparent 55%)"></div>'
        +'<div class="cat-in"><span class="cat-ic">'+c.icon+'</span>'
        +'<div class="cat-nm">'+nm+'</div>'
        +'<div class="cat-models">'+models+'</div></div>'; // SC_05: "● LIVE" qatori o'chirildi
      // SC_04: media yuklanmasa qatlam olib tashlanadi — glow/gradient fon qoladi
      var nmEl=el.querySelector('.cat-nm'); if(nmEl)nmEl.setAttribute('data-cms-text','aiLauncher.cards.'+idx+'.title');
      var dsEl=el.querySelector('.cat-models'); if(dsEl)dsEl.setAttribute('data-cms-text','aiLauncher.cards.'+idx+'.desc');
      var mEl=el.querySelector('.cat-media video,.cat-media img');
      if(mEl)mEl.addEventListener('error',function(){ var w=el.querySelector('.cat-media'); if(w)w.remove(); });
      var _catLast=0;
      var _catOpen=function(){
        var _catNow=Date.now(); if(_catNow-_catLast<350)return; _catLast=_catNow;
        // SC_17: oraliq kategoriya ekrani yo'q. SC_18 (supersede): kirish qadami =
        // SESSION PICKER (0 sessiya bo'lsa picker o'zi workspace'ga avto-o'tadi).
        var live=c.tools.filter(function(t){return !t.soon&&t.dest;});
        if(!live.length){ aiSoonToast(); return; }
        if(typeof window.afSessionPicker==='function'){ window.afSessionPicker(c.id); return; }
        go(live[0].dest); // fallback — picker moduli yo'q bo'lsa
      };
      // Premiere 26.2 Drover ba'zan dinamik karta `click`ini yutadi. Mousedown
      // deterministic fallback; throttle oddiy click bilan ikki marta ochmaydi.
      el.addEventListener('mousedown',_catOpen);
      el.addEventListener('click',_catOpen);
      g.appendChild(el);
    });
  }
  window.__afAiRenderCatGrid=aiRenderCatGrid; // SC_04: CMS config kelganda qayta chizish
  // b1: TARIX strip — real /gen/history thumbnaillari (74×74)
  // FIX G: karta bosilsa O'SHA gen lightbox'da ochiladi (avval Tarix ro'yxatiga olib ketardi)
  function histLbItem(h){
    return {id:h.id,cat:h.t,url:h.url,thumb:h.thumb,downloadUrl:h.downloadUrl||null,title:h.title,sub:h.sub,
      prompt:h.prompt||'',params:h.params||{},cost:h.cost,createdAt:h.created};
  }
  function histLbCtx(){
    var isCep=(typeof window.__adobe_cep__!=='undefined');
    return {
      isCEP:isCep,
      list:function(){ return HIST.slice(0,5).map(histLbItem); },
      onImport:function(x){ if(typeof aiImportMedia==='function')aiImportMedia(x.url,(x.cat==='video')?'video':(x.cat==='audio'||x.cat==='sfx')?'audio':'image',null); else toast('Premiere import — only works inside Premiere Pro','info'); },
      // SC_17: onUpscale olib tashlandi (Upscale butunlay o'chirildi)
      onAddProject:function(x){ if(window.afProjectPicker)window.afProjectPicker('gen',x.id); }, // P1
      onDownload:function(x){ try{ var a=document.createElement('a'); a.href=x.downloadUrl||x.url; a.download=window.afGenDlName(x.prompt||x.title,x.url,x.cat); document.body.appendChild(a); a.click(); document.body.removeChild(a); }catch(e){ toast('Download failed','error'); } }
    };
  }
  function aiRenderHistStrip(){
    var sec=document.getElementById('aiHistSec'), s=document.getElementById('aiHistStrip');
    if(!sec||!s)return;
    var draw=function(){
      if(!HIST.length){ sec.style.display='none'; return; }
      sec.style.display='';
      s.innerHTML='';
      // P14: ko'proq element (scroll ochadi) + haqiqiy nisbat + tur belgisi.
      HIST.slice(0,24).forEach(function(h){
        var d=document.createElement('div'); d.className='ht';
        var p=h.params||{}; var ar=p.aspectRatio; // haqiqiy nisbat (bo'lmasa 1/1 default CSS)
        if(ar){ var m=String(ar).trim().match(/^(\d+(?:\.\d+)?)\s*[:\/x]\s*(\d+(?:\.\d+)?)$/i); if(m)d.style.aspectRatio=m[1]+' / '+m[2]; }
        var vNoPoster=(h.t==='video')&&(!h.thumb||h.thumb===h.url);
        if(h.thumb&&!vNoPoster){ d.style.backgroundImage='url("'+h.thumb+'")'; }
        else if(vNoPoster&&typeof window.afVideoThumb==='function'){ var vt=window.afVideoThumb(h.url); if(vt)d.appendChild(vt); }
        var tlab=(h.t==='video')?'Video':(h.t==='audio'||h.t==='sfx')?'Audio':'Image';
        d.insertAdjacentHTML('beforeend','<span class="htbadge">'+tlab+'</span>');
        if(h.t==='video')d.insertAdjacentHTML('beforeend','<svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M8 5l11 7-11 7z" fill="#fff"/></svg>');
        d.addEventListener('click',function(){
          if(window.afRecent&&typeof window.afRecent.openLightbox==='function'&&h.url)window.afRecent.openLightbox(histLbItem(h),histLbCtx());
          else go('history'); // fallback — lightbox komponenti bo'lmasa
        });
        s.appendChild(d);
      });
    };
    if(histLoaded&&!histStale())draw(); else loadHistory(draw);
  }
  // SC_17: aiOpenCat + v-aicat (oraliq TOOLS ro'yxati) o'chirildi — karta to'g'ridan ochadi.
  aiRenderCatGrid();
  aiRenderHistStrip();

  window.axInit=function(){ try{ go('launcher'); }catch(e){ try{console.error('[ax] axInit error:',e);}catch(_){} } };
  window.axGo=function(id){ try{ go(id); }catch(e){ try{console.error('[ax] axGo("'+id+'") error:',e);}catch(_){} } }; // switch to AI view from outside (e.g. Home 🕘 → history). NOT a silent catch — error is logged.
  window.axRenderHistory=function(f){ try{ renderHistory(f||'all'); }catch(e){ try{console.error('[ax] axRenderHistory error:',e);}catch(_){} } }; // for imggen fallback

  // textarea auto-grow: yozilgan matnga qarab balandlashadi (max ~8 qator), keyin ichki scroll
  function axGrow(ta){if(!ta||ta.tagName!=='TEXTAREA')return;ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,240)+'px';} // P12: uzun prompt qulay (150→240)
  document.addEventListener('input',function(e){var ta=e.target;if(ta&&ta.tagName==='TEXTAREA'&&ta.closest&&ta.closest('.axroot'))axGrow(ta);});
  // Esc → ochiq sheet yopiladi · Cmd/Ctrl+Enter → yuborish
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closeSheet();return;}
    if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){var ta=e.target;if(ta&&ta.tagName==='TEXTAREA'){var view=ta.closest('.view');var sb=view&&view.querySelector('.sendbtn');if(sb){e.preventDefault();sb.click();}}}
  });
  syncBal();
  document.getElementById('impComp').classList.add('on');

})();

