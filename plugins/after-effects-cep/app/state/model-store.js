(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function ModelStore(client,scope){this.client=client;this.scope=scope;this.models=[];this.operations=[];}
  ModelStore.prototype.load=async function(){var snap=this.scope.capture();var data=await this.client.models();this.scope.assertCurrent(snap);this.models=Array.isArray(data&&data.models)?data.models.slice():[];return this.list();};
  ModelStore.prototype.loadOperations=async function(){var snap=this.scope.capture();var data=await this.client.operations();this.scope.assertCurrent(snap);this.operations=Array.isArray(data&&data.ops)?data.ops.slice():[];return this.operations.slice();};
  ModelStore.prototype.operationFor=function(kind){return this.operations.find(function(op){return kind==='video'?op.mode==='video'&&op.feature==='video-upscale':op.mode==='image'&&op.feature==='image-upscale';})||null;};
  ModelStore.prototype.list=function(mode){return this.models.filter(function(model){return !mode||model.mode===mode||model.type===mode;});};
  ModelStore.prototype.get=function(id){return this.models.find(function(model){return String(model.id)===String(id);})||null;};
  ModelStore.prototype.clear=function(){this.models=[];this.operations=[];};
  ns.ModelStore=ModelStore;
})(typeof window!=='undefined'?window:globalThis);
