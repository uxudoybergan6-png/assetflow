(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function operationId(){return 'imp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);}
  function ImportGateway(commands){this.commands=commands;this.active={};this.records={};}
  ImportGateway.prototype.record=function(id,patch){this.records[id]=Object.assign({},this.records[id]||{operationId:id,type:'import',startedAt:Date.now()},patch||{});return this.records[id];};
  ImportGateway.prototype.list=function(){var self=this;return Object.keys(this.records).map(function(id){return Object.assign({},self.records[id]);}).sort(function(a,b){return Number(b.startedAt)-Number(a.startedAt);});};
  ImportGateway.prototype.importAsset=function(asset){
    asset=asset||{};var id=String(asset.operationId||operationId());if(this.active[id])return this.active[id];var payload={operationId:id,url:asset.url,filePath:asset.filePath,kind:asset.kind||asset.mode||'image',ext:asset.ext};this.record(id,{status:'running',kind:payload.kind});if(ns.Metrics)ns.Metrics.track('import_attempt',{mode:payload.kind,operationTelemetryId:id});var self=this;
    var task=this.commands.run('importMedia',payload).then(async function(result){
      if(result&&result.ok){self.record(id,{status:'completed',completedAt:Date.now(),result:result});if(ns.Metrics)ns.Metrics.track('import_result',{mode:payload.kind,result:'completed',operationTelemetryId:id});return Object.assign({operationId:id,status:'completed'},result);}
      if(result&&result.unknownOutcome){var reconciled=await self.commands.run('reconcileImport',{operationId:id});if(reconciled&&reconciled.ok){self.record(id,{status:'completed',completedAt:Date.now(),result:reconciled});if(ns.Metrics)ns.Metrics.track('import_result',{mode:payload.kind,result:'reconciled',operationTelemetryId:id});return Object.assign({operationId:id,status:'completed'},reconciled);}var unknown=Object.assign({ok:false,status:'unknown_outcome',unknownOutcome:true,operationId:id},result);self.record(id,{status:'unknown_outcome',result:unknown});if(ns.Metrics)ns.Metrics.track('import_result',{mode:payload.kind,result:'unknown_outcome',operationTelemetryId:id});return unknown;}
      var failed=Object.assign({operationId:id,status:'failed'},result||{});self.record(id,{status:'failed',completedAt:Date.now(),result:failed});if(ns.Metrics)ns.Metrics.track('import_result',{mode:payload.kind,result:'failed',operationTelemetryId:id});return failed;
    }).catch(function(error){self.record(id,{status:'failed',completedAt:Date.now(),errorCode:error&&error.code||'IMPORT_FAILED'});throw error;}).finally(function(){delete self.active[id];});
    this.active[id]=task;return task;
  };
  ImportGateway.prototype.reconcile=function(id){return this.commands.run('reconcileImport',{operationId:id});};
  ns.ImportGateway=ImportGateway;
})(typeof window!=='undefined'?window:globalThis);
