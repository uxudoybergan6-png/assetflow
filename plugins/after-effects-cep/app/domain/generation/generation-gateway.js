(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function idempotency(){return 'gen_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);}
  function GenerationGateway(options){this.client=options.client;this.scope=options.scope;this.quoteMachine=options.quoteMachine;this.references=options.references;this.sessions=options.sessions;this.jobs=options.jobs;this.models=options.models;this.active=null;this.prepared=null;}
  GenerationGateway.prototype.prepare=async function(intent){
    var payload=clone(intent||{}),model=this.models&&this.models.get(payload.modelId);if(!model){var e=new Error('Model unavailable');e.code='MODEL_UNAVAILABLE';throw e;}
    payload.params=Object.assign({},payload.params||{},this.references.toParams(model));if(this.prepared&&same(this.prepared,payload)){var cached=this.quoteMachine.peek();if(cached)return cached;}this.prepared=payload;
    return this.quoteMachine.quote({modelId:Number(payload.modelId),mode:payload.mode,params:payload.params});
  };
  GenerationGateway.prototype.submit=function(intent){
    if(this.active)return this.active.promise;
    var quote=this.quoteMachine.take();var scope=this.scope.capture();var params=clone(quote.pricedParams);var prepared=this.prepared||{};
    if(intent&&intent.params&&!same(intent.params,params)){var e=new Error('Generation params differ from priced params');e.code='PRICED_PARAMS_MISMATCH';throw e;}
    this.quoteMachine.markSubmitting(quote.revision);
    var key=idempotency();var body={sessionId:this.sessions.current(),mode:prepared.mode,modelId:Number(prepared.modelId),prompt:prepared.prompt||'',params:params,price:quote.price,costQuoteSignature:quote.signature};
    var self=this;var promise=this.sessions.ensureSession(this.client,prepared.mode).then(function(sessionId){body.sessionId=sessionId;return self.client.generate(body,key);}).then(function(job){self.scope.assertCurrent(scope);if(job&&job.jobId&&!job.id)job=Object.assign({id:job.jobId},job);self.jobs.register(job);self.quoteMachine.terminal(String(job.status||'queued'));return job;}).catch(function(error){self.quoteMachine.terminal('failed');throw error;}).finally(function(){self.active=null;self.prepared=null;});
    this.active={key:key,promise:promise};return promise;
  };
  ns.GenerationGateway=GenerationGateway;
})(typeof window!=='undefined'?window:globalThis);
