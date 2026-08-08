(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var allow={getSelection:1,captureCurrentFrame:1,importMedia:1,importTemplate:1,reconcileImport:1,insertAtPlayhead:1,getProjectContext:1,removeCreatedItemByStableId:1};
  function HostCommands(adapter,capabilities){this.adapter=adapter;this.capabilities=capabilities||{};this.inflight={};}
  HostCommands.prototype.run=function(name,payload){if(!allow[name])return Promise.reject(Object.assign(new Error('Host command denied'),{code:'HOST_COMMAND_DENIED'}));var capabilities=typeof this.capabilities==='function'?this.capabilities():this.capabilities;if(capabilities&&capabilities[name]===false)return Promise.reject(Object.assign(new Error('Host command unsupported'),{code:'HOST_UNSUPPORTED'}));var mutating=/^(import|insert|remove)/.test(name);var operationId=payload&&payload.operationId;if(mutating&&!operationId)return Promise.reject(Object.assign(new Error('operationId required'),{code:'OPERATION_ID_REQUIRED'}));if(operationId&&this.inflight[operationId])return this.inflight[operationId];var promise=Promise.resolve().then(function(){return this.adapter(name,payload||{});}.bind(this));if(operationId){this.inflight[operationId]=promise.finally(function(){delete this.inflight[operationId];}.bind(this));return this.inflight[operationId];}return promise;};
  ns.HostCommands=HostCommands;
})(typeof window!=='undefined'?window:globalThis);
