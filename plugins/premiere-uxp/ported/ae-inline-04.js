
(function startAssetFlowBrowse(){
  function onMeta(){ if(window.__afBrowseReady) refreshLocalAssets(); }
  window.addEventListener('storage',e=>{
    if(e.key===AssetFlowStore?.META_KEY) onMeta();
  });
  window.addEventListener('assetflow:meta-updated',onMeta);
  // Token eskirdi (401/403) — b12: toast o'rniga modal karta (mockup), Kirish → account sheet
  function ensureAiSessModal(){
    var ov=document.getElementById('aiSessModal');
    if(ov)return ov;
    ov=document.createElement('div'); ov.className='ai-sess-ov'; ov.id='aiSessModal';
    ov.innerHTML='<div class="ai-sess-card">'
      +'<div class="ai-sess-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'
      +'<div class="ai-sess-t">Session expired — please sign in again</div>'
      +'<div class="ai-sess-s">For security, sessions refresh every 24 hours.</div>'
      +'<div role="button" tabindex="0" type="button" class="ai-sess-btn">Sign in</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov)ov.classList.remove('on'); });
    ov.querySelector('.ai-sess-btn').addEventListener('click',function(){
      ov.classList.remove('on');
      try{ openAccountSheet(); }catch(e){}
    });
    return ov;
  }
  window.addEventListener('assetflow:session-expired',()=>{
    try{ refreshAccountUi(); }catch(e){}
    try{ if(window.afJobStore)window.afJobStore.clear(); }catch(e){}
    try{ if(window.afActiveSessionStore)window.afActiveSessionStore.clear(); }catch(e){}
    try{ if(typeof window.afIgClearRecent==='function')window.afIgClearRecent(); }catch(e){}
    try{ if(typeof window.axVGClearRecent==='function')window.axVGClearRecent(); }catch(e){}
    try{ if(typeof window.axAGClearRecent==='function')window.axAGClearRecent(); }catch(e){}
    try{ ensureAiSessModal().classList.add('on'); }
    catch(e){ showToast('Session expired — please sign in again','warning'); try{ openAccountSheet(); }catch(_){} }
  });
  // Panel yopilsa — faol yuklab olishni uzamiz (oqim ortda qolmasin)
  window.addEventListener('beforeunload',()=>{
    try{ if(typeof AssetFlowCatalog!=='undefined'&&AssetFlowCatalog.cancelDownload) AssetFlowCatalog.cancelDownload(); }catch(e){}
  });
  bootPlugin().catch(err=>{
    console.error(err);
    showToast(typeof friendlyError==='function'?friendlyError(err):('Load error: '+(err.message||'unknown')),'error');
  });
})();
