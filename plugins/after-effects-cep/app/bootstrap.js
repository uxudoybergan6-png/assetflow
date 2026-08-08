(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};var booted=false,readyRequested=false,flagReady=null;
  function accountRequest(path,options){return ns.accountAdapter.request(path,options);}
  function reconcileShell(){if(!readyRequested)return;var enabled=ns.flags.enabled('shellV2');if(enabled&&!ns.shell.started)ns.shell.start();else if(enabled&&ns.shell.started&&ns.shell.router.current)ns.shell.router.go(ns.shell.router.current.name,ns.shell.router.current.context||{});if(!enabled&&ns.shell.started)ns.shell.stop();}
  function recoverActiveJobs(){var user=ns.accountAdapter.sync();if(!user)return Promise.resolve([]);var snap=ns.accountScope.capture();if(ns.Metrics)ns.Metrics.track('restart_recovery_attempt',{});return ns.workspaceClient.activeJobs().then(function(data){ns.accountScope.assertCurrent(snap);var items=Array.isArray(data&&data.items)?data.items:[];items.forEach(function(job){ns.jobs.register(job);ns.jobs.poll(job.id,2500);});if(ns.Metrics)ns.Metrics.track('restart_recovery_result',{result:'completed'});return items;}).catch(function(error){if(error&&error.code==='STALE_SCOPE')return [];if(ns.Metrics)ns.Metrics.track('restart_recovery_result',{result:'failed',code:error&&error.code||'NETWORK'});return [];});}
  function bootstrap(){
    if(booted)return ns;booted=true;
    ns.flags=ns.FeatureFlags;
    ns.config=new ns.ConfigManager();
    ns.resources=new ns.Resources();ns.accountScope=new ns.AccountScope();
    ns.preferences=new ns.ScopedPreferences(ns.accountScope);
    ns.accountAdapter=new ns.AccountAdapter(root.AssetFlowAccount,ns.accountScope);ns.accountAdapter.sync();
    ns.http=new ns.HttpClient({request:accountRequest,scope:ns.accountScope});ns.genClient=new ns.GenClient(ns.http);
    ns.workspaceClient=new ns.WorkspaceClient(ns.http);
    ns.models=new ns.ModelStore(ns.genClient,ns.accountScope);ns.references=new ns.ReferenceStore(ns.accountScope);ns.sessions=new ns.SessionCoordinator(ns.accountScope);ns.entities=new ns.EntityCache(ns.accountScope);
    ns.tools=new ns.ToolRegistry(ns.models,ns.preferences,ns.flags);
    ns.quotes=new ns.QuoteMachine(ns.genClient,ns.accountScope);ns.jobs=new ns.JobRegistry(ns.genClient,ns.accountScope,ns.resources);
    ns.generation=new ns.GenerationGateway({client:ns.genClient,scope:ns.accountScope,quoteMachine:ns.quotes,references:ns.references,sessions:ns.sessions,jobs:ns.jobs,models:ns.models});
    ns.operations=new ns.OperationGateway({client:ns.genClient,scope:ns.accountScope,models:ns.models,jobs:ns.jobs});
    ns.runtimeHost=new ns.RuntimeHostAdapter();ns.hostCommands=new ns.HostCommands(ns.runtimeHost.run.bind(ns.runtimeHost),ns.runtimeHost.capabilities.bind(ns.runtimeHost));ns.imports=new ns.ImportGateway(ns.hostCommands);ns.activity=new ns.ActivityRegistry(ns.jobs,ns.imports);
    ns.recoverActiveJobs=recoverActiveJobs;ns.shell=new ns.V2Shell();recoverActiveJobs();
    root.addEventListener('ffvnext:flags-changed',reconcileShell);
    root.addEventListener('assetflow:account-changed',function(){var before=ns.accountScope.capture();ns.accountAdapter.sync();if(before.epoch===ns.accountScope.epoch)return;ns.jobs.stopAll();ns.references.clear();ns.sessions.clear();ns.models.clear();ns.entities.clear();ns.shell.resetSensitiveState();recoverActiveJobs();if(ns.shell.started&&ns.shell.router.current)ns.shell.router.go(ns.shell.router.current.name);});
    flagReady=Promise.resolve(ns.flags.loadLkg()).then(function(){if(!ns.config.url)return {ok:false,reason:'disabled'};return Promise.race([ns.config.refresh(),new Promise(function(resolve){setTimeout(function(){resolve({ok:false,reason:'timeout'});},1500);})]);}).catch(function(){return {ok:false,reason:'config'};}).then(function(result){ns.config.start();return result;});
    return ns;
  }
  function ready(){if(!booted)bootstrap();readyRequested=true;return Promise.resolve(flagReady).then(function(){reconcileShell();ns.Bootloader.ready();});}
  ns.bootstrap=bootstrap;ns.ready=ready;ns.isBooted=function(){return booted;};
})(typeof window!=='undefined'?window:globalThis);
