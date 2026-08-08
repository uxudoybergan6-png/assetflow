(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function QuoteMachine(client,scope){this.client=client;this.scope=scope;this.revision=0;this.state='draft';this.accepted=null;this.pending=null;}
  QuoteMachine.prototype.invalidate=function(){this.revision++;this.state='draft';this.accepted=null;this.pending=null;return this.revision;};
  QuoteMachine.prototype.quote=async function(intent){
    var revision=this.invalidate();var scope=this.scope.capture();this.state='quoting';
    var promise=this.client.quote(clone(intent));this.pending=promise;var quote=await promise;
    if(revision!==this.revision||!this.scope.isCurrent(scope)){var e=new Error('Stale quote');e.code='STALE_QUOTE';throw e;}
    if(!quote||!quote.signature||!quote.pricedParams){var bad=new Error('Invalid quote');bad.code='BAD_QUOTE';throw bad;}
    this.accepted={revision:revision,signature:quote.signature,pricedParams:clone(quote.pricedParams),cost:quote.cost,price:quote.price!=null?quote.price:quote.cost,expiresAt:quote.expiresAt||null};this.state='quote_ready';return clone(this.accepted);
  };
  QuoteMachine.prototype.take=function(){if(this.state!=='quote_ready'||!this.accepted){var e=new Error('Quote not ready');e.code='QUOTE_NOT_READY';throw e;}return clone(this.accepted);};
  QuoteMachine.prototype.peek=function(){return this.state==='quote_ready'&&this.accepted?clone(this.accepted):null;};
  QuoteMachine.prototype.markSubmitting=function(revision){if(!this.accepted||revision!==this.accepted.revision){var e=new Error('Quote revision mismatch');e.code='STALE_QUOTE';throw e;}this.state='submitting';};
  QuoteMachine.prototype.terminal=function(state){this.state=state;this.accepted=null;this.pending=null;};
  ns.QuoteMachine=QuoteMachine;
})(typeof window!=='undefined'?window:globalThis);
