(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function canonical(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    return '{'+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+':'+canonical(value[key]);}).join(',')+'}';
  }
  function payload(config){var copy={};Object.keys(config||{}).forEach(function(key){if(key!=='signature')copy[key]=config[key];});return canonical(copy);}
  function bytesBase64(value){
    if(typeof Buffer!=='undefined')return Buffer.from(String(value||''),'base64');
    var raw=atob(String(value||'')),out=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
  }
  function bytesText(value){if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(value);if(typeof Buffer!=='undefined')return Buffer.from(value,'utf8');throw new Error('Text encoding unavailable');}
  async function verify(config,keys){
    keys=keys||root.__FF_CONFIG_KEYS__||{};var publicKey=keys[config&&config.keyId];if(!publicKey||!config.signature)return false;
    var data=bytesText(payload(config)),signature=bytesBase64(config.signature);
    try{
      if(root.crypto&&root.crypto.subtle){var raw=bytesBase64(publicKey);var key=await root.crypto.subtle.importKey('raw',raw,{name:'Ed25519'},false,['verify']);return root.crypto.subtle.verify({name:'Ed25519'},key,signature,data);}
    }catch(e){}
    try{
      if(typeof require==='function'){var crypto=require('crypto');var pem=/BEGIN PUBLIC KEY/.test(publicKey)?publicKey:Buffer.from(publicKey,'base64');return crypto.verify(null,data,pem,signature);}
    }catch(e){}
    return false;
  }
  ns.ConfigVerifier={canonical:canonical,payload:payload,verify:verify};
})(typeof window!=='undefined'?window:globalThis);
