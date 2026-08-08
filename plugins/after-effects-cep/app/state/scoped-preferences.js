(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{},SALT_KEY='ff.v2.install-salt';
  function get(key){try{return root.localStorage&&root.localStorage.getItem(key);}catch(e){return null;}}
  function set(key,value){try{if(root.localStorage)root.localStorage.setItem(key,value);}catch(e){}}
  function salt(){var value=get(SALT_KEY);if(value)return value;value='s_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);set(SALT_KEY,value);return value;}
  function hash(value){var text=salt()+'|'+String(value||'guest'),h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function ScopedPreferences(scope){this.scope=scope;}
  ScopedPreferences.prototype.key=function(name){return 'ff.v2.scope.'+hash(this.scope.capture().scope)+'.'+String(name).replace(/[^a-z0-9_.-]/gi,'');};
  ScopedPreferences.prototype.read=function(name,fallback){try{var value=JSON.parse(get(this.key(name))||'null');return value==null?fallback:value;}catch(e){return fallback;}};
  ScopedPreferences.prototype.write=function(name,value){set(this.key(name),JSON.stringify(value));return value;};
  ScopedPreferences.prototype.remove=function(name){try{root.localStorage.removeItem(this.key(name));}catch(e){}};
  ns.ScopedPreferences=ScopedPreferences;
})(typeof window!=='undefined'?window:globalThis);
