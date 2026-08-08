(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function Resources(){this.timers=[];this.listeners=[];this.urls=[];}
  Resources.prototype.timeout=function(fn,ms){var id=setTimeout(fn,ms);this.timers.push({kind:'timeout',id:id});return id;};
  Resources.prototype.interval=function(fn,ms){var id=setInterval(fn,ms);this.timers.push({kind:'interval',id:id});return id;};
  Resources.prototype.listen=function(target,type,fn,opts){target.addEventListener(type,fn,opts);this.listeners.push([target,type,fn,opts]);return fn;};
  Resources.prototype.objectUrl=function(blob){var url=URL.createObjectURL(blob);this.urls.push(url);return url;};
  Resources.prototype.dispose=function(){this.timers.splice(0).forEach(function(x){(x.kind==='interval'?clearInterval:clearTimeout)(x.id);});this.listeners.splice(0).forEach(function(x){x[0].removeEventListener(x[1],x[2],x[3]);});this.urls.splice(0).forEach(function(url){try{URL.revokeObjectURL(url);}catch(e){}});};
  Resources.prototype.counts=function(){return {timers:this.timers.length,listeners:this.listeners.length,objectUrls:this.urls.length};};
  ns.Resources=Resources;
})(typeof window!=='undefined'?window:globalThis);
