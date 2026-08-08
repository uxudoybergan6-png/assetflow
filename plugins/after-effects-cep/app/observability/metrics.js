(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var allowed={boot_started:1,shell_usable:1,session_end:1,auth_restore_attempt:1,auth_restore_result:1,cross_host_session_visible:1,view_opened:1,flag_exposure:1,quote_attempt:1,quote_result:1,generation_intent:1,generation_start:1,server_complete:1,result_visible:1,generation_terminal:1,restart_recovery_attempt:1,restart_recovery_result:1,import_attempt:1,import_result:1};
  var fieldAllow={host:1,build:1,cohort:1,view:1,tool:1,model:1,code:1,durationBucket:1,mode:1,result:1,launchId:1,operationTelemetryId:1};
  var launchId='ff_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
  var events=[];
  var optional={view_opened:1,flag_exposure:1};
  function optedOut(){try{return root.localStorage&&root.localStorage.getItem('ff.v2.analytics.optout')==='1';}catch(e){return false;}}
  function track(name,fields){
    if(!allowed[name])throw new Error('Metric not allowlisted: '+name);
    if(optional[name]&&optedOut())return null;
    var safe={launchId:launchId};
    Object.keys(fields||{}).forEach(function(key){if(fieldAllow[key])safe[key]=fields[key];});
    safe=ns.Redactor?ns.Redactor.value(safe):safe;
    var event={name:name,ts:new Date().toISOString(),fields:safe};
    events.push(event); if(events.length>200)events.shift();
    return event;
  }
  ns.Metrics={track:track,snapshot:function(){return events.slice();},clear:function(){events.length=0;},launchId:function(){return launchId;},optedOut:optedOut};
})(typeof window!=='undefined'?window:globalThis);
