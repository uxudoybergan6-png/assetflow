(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function GenClient(http){this.http=http;}
  GenClient.prototype.models=function(){return this.http.send('/api/studio/gen/models');};
  GenClient.prototype.operations=function(){return this.http.send('/api/studio/gen/ops');};
  GenClient.prototype.quote=function(body){return this.http.send('/api/studio/gen/cost-quote',{method:'POST',body:body});};
  GenClient.prototype.createSession=function(mode){return this.http.send('/api/studio/gen/sessions',{method:'POST',body:{mode:mode}});};
  GenClient.prototype.generate=function(body,idempotencyKey){var payload=Object.assign({},body,{idempotencyKey:idempotencyKey});return this.http.send('/api/studio/gen',{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:payload,noBlindRetry:true});};
  GenClient.prototype.enhance=function(body){return this.http.send('/api/studio/gen/prompt/enhance',{method:'POST',body:Object.assign({},body,{idempotencyKey:'enh_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)})});};
  GenClient.prototype.job=function(id){return this.http.send('/api/studio/gen/'+encodeURIComponent(id));};
  ns.GenClient=GenClient;
})(typeof window!=='undefined'?window:globalThis);
