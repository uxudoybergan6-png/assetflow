(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function EntityCache(scope){this.scope=scope;this.data={};this.bound=scope.capture();}
  EntityCache.prototype.ensure=function(){if(!this.scope.isCurrent(this.bound)){this.data={};this.bound=this.scope.capture();}};
  EntityCache.prototype.set=function(kind,id,value){this.ensure();this.data[kind]=this.data[kind]||{};this.data[kind][id]=value;return value;};
  EntityCache.prototype.get=function(kind,id){this.ensure();return this.data[kind]&&this.data[kind][id]||null;};
  EntityCache.prototype.list=function(kind){this.ensure();return Object.keys(this.data[kind]||{}).map(function(id){return this.data[kind][id];},this);};
  EntityCache.prototype.clear=function(){this.data={};this.bound=this.scope.capture();};
  ns.EntityCache=EntityCache;
})(typeof window!=='undefined'?window:globalThis);
