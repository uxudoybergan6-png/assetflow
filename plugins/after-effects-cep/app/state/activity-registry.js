(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function ActivityRegistry(jobs,imports){this.jobs=jobs;this.imports=imports;}
  ActivityRegistry.prototype.list=function(){var generations=this.jobs.list().map(function(job){return {type:'generation',id:job.id,status:job.status,title:job.title||job.prompt||job.id,owner:job};});var imports=this.imports.list().map(function(item){return {type:'import',id:item.operationId,status:item.status,title:'Adobe import · '+String(item.kind||'media'),owner:item};});return generations.concat(imports);};
  ns.ActivityRegistry=ActivityRegistry;
})(typeof window!=='undefined'?window:globalThis);
