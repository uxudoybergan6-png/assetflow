(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function JobRegistry(client,scope,resources){this.client=client;this.scope=scope;this.resources=resources;this.jobs={};this.pollers={};this.bound=scope.capture();}
  JobRegistry.prototype.ensure=function(){if(!this.scope.isCurrent(this.bound)){this.stopAll();this.jobs={};this.bound=this.scope.capture();}};
  JobRegistry.prototype.register=function(job){this.ensure();if(!job||!job.id)throw new Error('Job id required');this.jobs[job.id]=Object.assign({},job);return this.jobs[job.id];};
  JobRegistry.prototype.poll=function(id,interval,onChange){this.ensure();if(this.pollers[id])return this.pollers[id];var self=this;var scope=this.scope.capture();var tick=async function(){try{var job=await self.client.job(id);if(!self.scope.isCurrent(scope))return self.stop(id);self.jobs[id]=job;if(onChange)onChange(job);if(/^(done|completed|failed|error|canceled|refunded)$/.test(String(job.status||'')))self.stop(id);}catch(e){if(e&&e.code==='STALE_SCOPE')self.stop(id);}};tick();var timer=this.resources.interval(tick,interval||2500);this.pollers[id]=timer;return timer;};
  JobRegistry.prototype.stop=function(id){var timer=this.pollers[id];if(timer){clearInterval(timer);delete this.pollers[id];}};
  JobRegistry.prototype.stopAll=function(){var self=this;Object.keys(this.pollers).forEach(function(id){self.stop(id);});};
  JobRegistry.prototype.list=function(){this.ensure();return Object.keys(this.jobs).map(function(id){return this.jobs[id];},this);};
  ns.JobRegistry=JobRegistry;
})(typeof window!=='undefined'?window:globalThis);
