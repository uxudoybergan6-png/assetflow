(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var KEYS=['shellV2','homeV2','createImageV2','createVideoV2','createAudioV2','toolsV2','workSurfacesV2','browseV2','accountV2'];
  var DOMAIN=['image','video','audio','tools'];
  var STORAGE='ff.v2.feature-config.lkg';
  var REVISION='ff.v2.feature-config.revision';
  var generation=String(root.__FF_BUILD_GENERATION__||'dual-stack');
  var defaultOn=generation==='legacy-free';
  var state=defaults();

  function defaults(){
    var flags={}; KEYS.forEach(function(key){flags[key]=defaultOn;});
    flags.generationDomainV2={}; DOMAIN.forEach(function(key){flags.generationDomainV2[key]=defaultOn;});
    return flags;
  }
  function bool(value){return value===true;}
  function sanitize(input){
    var out=defaults(); input=input||{};
    KEYS.forEach(function(key){if(Object.prototype.hasOwnProperty.call(input,key))out[key]=bool(input[key]);});
    var domain=input.generationDomainV2||{};
    DOMAIN.forEach(function(key){if(Object.prototype.hasOwnProperty.call(domain,key))out.generationDomainV2[key]=bool(domain[key]);});
    return out;
  }
  function compatible(config,now){
    now=now||Date.now();
    if(!config||config.schemaVersion!==1||!Number.isFinite(config.configRevision))return false;
    if(config.minBuild&&String(root.__FF_BUILD_ID__||'dev')<String(config.minBuild))return false;
    var skew=5*60*1000;
    if(Date.parse(config.notBefore||0)>now+skew)return false;
    if(Date.parse(config.expiresAt||0)<=now-skew)return false;
    return true;
  }
  function apply(config,opts){
    opts=opts||{};
    if(!compatible(config,opts.now))return {ok:false,reason:'incompatible'};
    var accepted=Number(safeGet(REVISION)||0);
    if(config.configRevision<accepted)return {ok:false,reason:'replay'};
    var next=sanitize(config.flags),safetyMode=false;
    var emergency=config.emergencyDisable||{};
    KEYS.forEach(function(key){if(emergency[key]===true)next[key]=false;});
    DOMAIN.forEach(function(key){if(emergency.generationDomainV2&&emergency.generationDomainV2[key]===true)next.generationDomainV2[key]=false;});
    if(generation==='legacy-free'&&next.shellV2===false){next.shellV2=true;safetyMode=true;}
    state=next;
    if(opts.verified===true){safeSet(STORAGE,JSON.stringify(config));safeSet(REVISION,String(config.configRevision));}
    return {ok:true,flags:snapshot(),revision:config.configRevision,safetyMode:safetyMode};
  }
  async function loadLkg(){
    try{
      var config=JSON.parse(safeGet(STORAGE)||'null');
      if(!config)return {ok:false,reason:'missing'};
      if(!ns.ConfigVerifier||!await ns.ConfigVerifier.verify(config))return {ok:false,reason:'signature'};
      return apply(config,{verified:false});
    }catch(e){return {ok:false,reason:'corrupt'};}
  }
  function safeGet(key){try{return root.localStorage&&root.localStorage.getItem(key);}catch(e){return null;}}
  function safeSet(key,value){try{if(root.localStorage)root.localStorage.setItem(key,value);}catch(e){}}
  function snapshot(){return JSON.parse(JSON.stringify(state));}
  function enabled(key,mode){return key==='generationDomainV2'?!!state.generationDomainV2[mode]:!!state[key];}
  ns.FeatureFlags={keys:KEYS.slice(),domainKeys:DOMAIN.slice(),generation:generation,defaults:defaults,sanitize:sanitize,compatible:compatible,apply:apply,loadLkg:loadLkg,snapshot:snapshot,enabled:enabled,reset:function(){state=defaults();}};
})(typeof window!=='undefined'?window:globalThis);
