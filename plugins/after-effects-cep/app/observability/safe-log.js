(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var rows=[];
  var maxRows=100;
  function emit(level,code,fields){
    var redactor=ns.Redactor;
    var row={ts:new Date().toISOString(),level:level,code:String(code||'unknown').slice(0,80),fields:redactor?redactor.value(fields||{}):{}};
    rows.push(row); if(rows.length>maxRows)rows.shift();
    try{
      var sink=(level==='error'?console.error:level==='warn'?console.warn:console.log);
      if(root.__FF_VNEXT_DEBUG__)sink.call(console,'[FrameFlow]',row.code,row.fields);
    }catch(e){}
    return row;
  }
  ns.SafeLog={
    info:function(code,fields){return emit('info',code,fields);},
    warn:function(code,fields){return emit('warn',code,fields);},
    error:function(code,fields){return emit('error',code,fields);},
    snapshot:function(){return rows.slice();},
    clear:function(){rows.length=0;}
  };
})(typeof window!=='undefined'?window:globalThis);
