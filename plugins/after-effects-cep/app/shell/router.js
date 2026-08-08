(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function Router(options){this.routes={};this.current=null;this.epoch=0;this.fallback=(options&&options.fallback)||'home';}
  Router.prototype.register=function(name,lifecycle){if(!name||!lifecycle)throw new Error('Route contract required');this.routes[name]=lifecycle;return this;};
  Router.prototype.go=async function(name,context){
    var target=this.routes[name]?name:this.fallback; var next=this.routes[target]; if(!next)throw new Error('Fallback route unavailable');
    var epoch=++this.epoch; var previous=this.current;
    if(previous){if(previous.lifecycle.leave)await previous.lifecycle.leave();if(previous.lifecycle.dispose)await previous.lifecycle.dispose();}
    if(epoch!==this.epoch)return false;
    this.current={name:target,lifecycle:next,epoch:epoch,context:context||{}};
    if(next.enter)await next.enter(context||{}); if(epoch!==this.epoch)return false;
    if(next.render)await next.render(context||{}); if(epoch!==this.epoch)return false;
    if(next.refresh)await next.refresh(context||{}); return epoch===this.epoch;
  };
  Router.prototype.dispose=async function(){this.epoch++;var current=this.current;this.current=null;if(current&&current.lifecycle.leave)await current.lifecycle.leave();if(current&&current.lifecycle.dispose)await current.lifecycle.dispose();};
  ns.Router=Router;
})(typeof window!=='undefined'?window:globalThis);
