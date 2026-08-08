(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function HttpClient(options){options=options||{};this.request=options.request;this.scope=options.scope;if(typeof this.request!=='function')throw new Error('Authenticated request adapter required');}
  HttpClient.prototype.send=async function(path,options){var snap=this.scope?this.scope.capture():null;var result=await this.request(path,options||{});if(this.scope)this.scope.assertCurrent(snap);return result;};
  ns.HttpClient=HttpClient;
})(typeof window!=='undefined'?window:globalThis);
