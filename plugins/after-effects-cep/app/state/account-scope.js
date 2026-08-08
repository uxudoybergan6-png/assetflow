(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function AccountScope(){this.epoch=0;this.scope='guest';}
  AccountScope.prototype.change=function(accountKey){this.epoch++;this.scope=String(accountKey||'guest');return this.capture();};
  AccountScope.prototype.capture=function(){return {scope:this.scope,epoch:this.epoch};};
  AccountScope.prototype.isCurrent=function(snapshot){return !!snapshot&&snapshot.scope===this.scope&&snapshot.epoch===this.epoch;};
  AccountScope.prototype.assertCurrent=function(snapshot){if(!this.isCurrent(snapshot)){var e=new Error('Stale account scope');e.code='STALE_SCOPE';throw e;}return true;};
  ns.AccountScope=AccountScope;
})(typeof window!=='undefined'?window:globalThis);
