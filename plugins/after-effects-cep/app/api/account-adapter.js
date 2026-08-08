(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function AccountAdapter(controller,scope){this.controller=controller;this.scope=scope;this.lastAccount=null;}
  AccountAdapter.prototype.sync=function(){var user=this.controller&&this.controller.getCachedUser?this.controller.getCachedUser():null;var key=user&&String(user.id||user.email||'user');if(key!==this.lastAccount){this.lastAccount=key;this.scope.change(key||'guest');}return user;};
  AccountAdapter.prototype.request=function(path,options){this.sync();if(!this.controller||typeof this.controller.request!=='function')return Promise.reject(new Error('Account controller unavailable'));return this.controller.request(path,options||{});};
  AccountAdapter.prototype.logout=function(){this.lastAccount=null;this.scope.change('guest');if(this.controller&&this.controller.logout)return this.controller.logout();};
  ns.AccountAdapter=AccountAdapter;
})(typeof window!=='undefined'?window:globalThis);
