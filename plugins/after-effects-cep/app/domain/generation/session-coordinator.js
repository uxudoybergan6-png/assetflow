(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function SessionCoordinator(scope){this.scope=scope;this.bound=scope.capture();this.sessionId=null;}
  SessionCoordinator.prototype.ensure=function(){if(!this.scope.isCurrent(this.bound)){this.sessionId=null;this.bound=this.scope.capture();}};
  SessionCoordinator.prototype.select=function(id){this.ensure();this.sessionId=id?String(id):null;return this.sessionId;};
  SessionCoordinator.prototype.current=function(){this.ensure();return this.sessionId;};
  SessionCoordinator.prototype.ensureSession=async function(client,mode){this.ensure();if(this.sessionId)return this.sessionId;var created=await client.createSession(mode);this.scope.assertCurrent(this.bound);this.sessionId=String(created&&created.id||'');if(!this.sessionId)throw new Error('Session was not created');return this.sessionId;};
  SessionCoordinator.prototype.clear=function(){this.sessionId=null;this.bound=this.scope.capture();};
  ns.SessionCoordinator=SessionCoordinator;
})(typeof window!=='undefined'?window:globalThis);
