(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var watchdog=null;var healthy=false;
  function recovery(reason){
    if(healthy)return false;
    var existing=document.getElementById('ff-v2-recovery');if(existing){existing.hidden=false;return true;}
    var node=document.createElement('section');node.id='ff-v2-recovery';node.className='ff-v2-recovery';node.setAttribute('role','alert');
    node.innerHTML='<div class="ff-v2-recovery__card"><h1>FrameFlow recovery</h1><p>The main interface could not start safely. Active server jobs are not cancelled.</p><div class="ff-v2-recovery__actions"><button type="button" data-ff-retry>Retry</button><button type="button" data-ff-diagnostics>Diagnostics</button><button type="button" data-ff-update>Update</button></div><code></code></div>';
    var code=node.querySelector('code');if(code)code.textContent=String(reason||'BOOT_FAILED').replace(/[^A-Z0-9_.-]/gi,'').slice(0,60);
    node.querySelector('[data-ff-retry]').addEventListener('click',function(){root.location.reload();});
    node.querySelector('[data-ff-diagnostics]').addEventListener('click',function(){try{if(typeof root.openAccountSheet==='function')root.openAccountSheet();}catch(e){}});
    node.querySelector('[data-ff-update]').addEventListener('click',function(){try{if(typeof root.afCheckForUpdate==='function')root.afCheckForUpdate();}catch(e){}});
    document.body.appendChild(node);return true;
  }
  function start(ms){healthy=false;clearTimeout(watchdog);if(ns.Metrics)ns.Metrics.track('boot_started',{});watchdog=setTimeout(function(){recovery('BOOT_TIMEOUT');},ms||10000);}
  function ready(){healthy=true;clearTimeout(watchdog);var node=document.getElementById('ff-v2-recovery');if(node)node.hidden=true;if(ns.Metrics)ns.Metrics.track('shell_usable',{});}
  root.addEventListener('error',function(event){if(!healthy&&event&&event.error)recovery('BOOT_SCRIPT_ERROR');});
  root.addEventListener('unhandledrejection',function(){if(!healthy)recovery('BOOT_REJECTION');});
  ns.Bootloader={start:start,ready:ready,recovery:recovery,isHealthy:function(){return healthy;}};
})(typeof window!=='undefined'?window:globalThis);
