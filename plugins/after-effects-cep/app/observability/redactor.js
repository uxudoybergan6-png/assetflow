(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var secretKey=/authorization|token|secret|signature|signed.?url|poll.?token|password|cookie/i;
  var bearer=/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
  var urlSecret=/([?&](?:token|secret|signature|sig|key|authorization)=)[^&#\s]+/gi;
  var jwt=/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

  function text(value){
    return String(value==null?'':value)
      .replace(bearer,'Bearer [REDACTED]')
      .replace(urlSecret,'$1[REDACTED]')
      .replace(jwt,'[REDACTED_JWT]')
      .slice(0,1000);
  }

  function value(input,depth){
    depth=depth||0;
    if(depth>5)return '[TRUNCATED]';
    if(input==null||typeof input==='boolean'||typeof input==='number')return input;
    if(typeof input==='string')return text(input);
    if(Array.isArray(input))return input.slice(0,30).map(function(item){return value(item,depth+1);});
    if(typeof input==='object'){
      var out={};
      Object.keys(input).slice(0,50).forEach(function(key){
        out[key]=secretKey.test(key)?'[REDACTED]':value(input[key],depth+1);
      });
      return out;
    }
    return text(input);
  }

  ns.Redactor={text:text,value:value,isSecretKey:function(key){return secretKey.test(String(key||''));}};
})(typeof window!=='undefined'?window:globalThis);
