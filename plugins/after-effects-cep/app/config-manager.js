(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function ConfigManager(options){options=options||{};this.url=options.url||root.__FF_CONFIG_URL__||'';this.interval=options.interval||15*60*1000;this.timer=null;this.fetcher=options.fetcher||root.fetch;}
  ConfigManager.prototype.refresh=async function(){
    if(!this.url||typeof this.fetcher!=='function')return {ok:false,reason:'disabled'};
    try{
      var response=await this.fetcher(this.url,{cache:'no-store',credentials:'omit'});if(!response.ok)return {ok:false,reason:'http_'+response.status};
      var config=await response.json();var verified=await ns.ConfigVerifier.verify(config);if(!verified)return {ok:false,reason:'signature'};
      var result=ns.FeatureFlags.apply(config,{verified:true});
      if(result.ok&&typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('ffvnext:flags-changed',{detail:result}));
      return result;
    }catch(e){if(ns.SafeLog)ns.SafeLog.warn('config_refresh_failed',{code:e&&e.code||'NETWORK'});return {ok:false,reason:'network'};}
  };
  ConfigManager.prototype.start=function(){var self=this;if(this.timer||!this.url)return;this.refresh();this.timer=setInterval(function(){self.refresh();},this.interval);};
  ConfigManager.prototype.stop=function(){if(this.timer){clearInterval(this.timer);this.timer=null;}};
  ns.ConfigManager=ConfigManager;
})(typeof window!=='undefined'?window:globalThis);
