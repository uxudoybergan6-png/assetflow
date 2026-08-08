(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function WorkspaceClient(http){this.http=http;}
  WorkspaceClient.prototype.history=function(limit,cursor){var query='/api/studio/gen/history?limit='+encodeURIComponent(limit||30);if(cursor!=null&&cursor!=='')query+='&cursor='+encodeURIComponent(cursor);return this.http.send(query);};
  WorkspaceClient.prototype.activeJobs=function(){return this.http.send('/api/studio/gen/history?status=active&limit=60');};
  WorkspaceClient.prototype.sessions=function(){return this.http.send('/api/studio/gen/sessions');};
  WorkspaceClient.prototype.sessionItems=function(id){return this.http.send('/api/studio/gen/sessions/'+encodeURIComponent(id)+'/generations?perPage=50&status=done');};
  WorkspaceClient.prototype.projects=function(){return this.http.send('/api/studio/projects');};
  WorkspaceClient.prototype.project=function(id){return this.http.send('/api/studio/projects/'+encodeURIComponent(id));};
  WorkspaceClient.prototype.createProject=function(name){return this.http.send('/api/studio/projects',{method:'POST',body:{name:name},noBlindRetry:true});};
  WorkspaceClient.prototype.renameProject=function(id,name){return this.http.send('/api/studio/projects/'+encodeURIComponent(id),{method:'PATCH',body:{name:name},noBlindRetry:true});};
  WorkspaceClient.prototype.deleteProject=function(id){return this.http.send('/api/studio/projects/'+encodeURIComponent(id),{method:'DELETE',noBlindRetry:true});};
  WorkspaceClient.prototype.removeProjectItem=function(projectId,itemId){return this.http.send('/api/studio/projects/'+encodeURIComponent(projectId)+'/items/'+encodeURIComponent(itemId),{method:'DELETE',noBlindRetry:true});};
  WorkspaceClient.prototype.addProjectItem=function(projectId,kind,refId){return this.http.send('/api/studio/projects/'+encodeURIComponent(projectId)+'/items',{method:'POST',body:{kind:kind,refId:refId},noBlindRetry:true});};
  WorkspaceClient.prototype.cancelJob=function(id){return this.http.send('/api/studio/gen/'+encodeURIComponent(id)+'/cancel',{method:'POST',body:{},noBlindRetry:true});};
  WorkspaceClient.prototype.pinJob=function(id,pinned){return this.http.send('/api/studio/gen/'+encodeURIComponent(id)+'/pin',{method:'PATCH',body:{pinned:!!pinned},noBlindRetry:true});};
  WorkspaceClient.prototype.credits=function(){return this.http.send('/api/studio/credits');};
  WorkspaceClient.prototype.references=function(){return this.http.send('/api/studio/gen/references?limit=12');};
  WorkspaceClient.prototype.uploadReference=function(dataUrl){return this.http.send('/api/studio/gen/ref-upload',{method:'POST',body:{dataUrl:dataUrl},noBlindRetry:true});};
  ns.WorkspaceClient=WorkspaceClient;
})(typeof window!=='undefined'?window:globalThis);
