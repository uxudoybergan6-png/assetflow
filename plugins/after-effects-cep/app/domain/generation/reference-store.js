(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var MIME={image:['image/jpeg','image/png','image/webp'],video:['video/mp4','video/quicktime','video/webm'],audio:['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a']};
  function ReferenceStore(scope){this.scope=scope;this.bound=scope.capture();this.revision=0;this.items=[];}
  ReferenceStore.prototype.ensure=function(){if(!this.scope.isCurrent(this.bound)){this.clear();this.bound=this.scope.capture();}};
  ReferenceStore.prototype.add=function(input){
    this.ensure(); input=input||{}; var kind=String(input.kind||'image'); var mime=String(input.mime||input.type||'').toLowerCase();
    if(!MIME[kind]||MIME[kind].indexOf(mime)<0){var e=new Error('Unsupported reference type');e.code='REFERENCE_TYPE';throw e;}
    if(!Number.isFinite(input.size)||input.size<=0){var se=new Error('Invalid reference size');se.code='REFERENCE_SIZE';throw se;}
    var item={id:String(input.id||('ref_'+Date.now()+'_'+Math.random().toString(36).slice(2,8))),savedId:input.saved===false?null:String(input.savedId||input.handle||input.id||''),kind:kind,role:String(input.role||'reference'),mime:mime,size:input.size,ownerScope:this.bound.scope,expiresAt:input.expiresAt||null,url:input.url||null,handle:input.handle||null};
    this.items=this.items.concat([item]);this.revision++;return item;
  };
  ReferenceStore.prototype.remove=function(id){this.ensure();var n=this.items.length;this.items=this.items.filter(function(item){return item.id!==id;});if(this.items.length!==n)this.revision++;};
  ReferenceStore.prototype.snapshot=function(){this.ensure();return {revision:this.revision,items:this.items.map(function(item){return {id:item.id,kind:item.kind,role:item.role,mime:item.mime,size:item.size,url:item.url,handle:item.handle};})};};
  ReferenceStore.prototype.nextRole=function(model,kind){this.ensure();model=model||{};kind=String(kind||'');if(model.refKind==='frames'&&kind==='image'){if(!this.items.some(function(item){return item.role==='start-frame';}))return 'start-frame';if(model.endFrame&&!this.items.some(function(item){return item.role==='end-frame';}))return 'end-frame';}var count=this.items.filter(function(item){return item.kind===kind;}).length+1;return kind+'-reference-'+count;};
  ReferenceStore.prototype.active=function(model){this.ensure();model=model||{};var kind=String(model.refKind||'none'),items=this.items.slice();if(kind==='frames'){var start=items.find(function(item){return item.kind==='image'&&item.role==='start-frame';})||items.find(function(item){return item.kind==='image'&&item.role!=='end-frame';}),end=model.endFrame?(items.find(function(item){return item.kind==='image'&&item.role==='end-frame';})||items.find(function(item){return item.kind==='image'&&item!==start;})):null;return [start,end].filter(Boolean);}if(kind==='image'){return items.filter(function(item){return item.kind==='image';}).slice(0,Math.max(0,Number(model.maxRefs)||1));}if(kind==='media-refs'){var limits=model.mediaRefs||model.mediaRefLimits||{},out=[];['image','video','audio'].forEach(function(mediaKind){var max=Math.max(0,Number(limits[mediaKind])||0);out=out.concat(items.filter(function(item){return item.kind===mediaKind;}).slice(0,max));});var total=Math.max(0,Number(limits.total)||out.length);return out.slice(0,total);}return [];};
  ReferenceStore.prototype.toParams=function(model){
    this.ensure();model=model||{};var params={},images=[],videos=[],audios=[],ids=[];
    this.active(model).forEach(function(item){if(item.savedId)ids.push(item.savedId);if(!item.url)return;if(item.kind==='image')images.push(item);else if(item.kind==='video')videos.push(item.url);else if(item.kind==='audio')audios.push(item.url);});
    if(ids.length)params.savedReferenceIds=ids;
    if(model.refKind==='frames'||(model.videoSettings&&model.videoSettings.frames)){var start=images.find(function(item){return item.role==='start-frame';})||images.find(function(item){return item.role!=='end-frame';}),end=images.find(function(item){return item.role==='end-frame';})||images.find(function(item){return item!==start;});if(start)params.referenceUrl=start.url;if(end)params.referenceEndUrl=end.url;}
    else if(model.refKind==='media-refs'){if(images.length)params.imageUrls=images.map(function(item){return item.url;});if(videos.length)params.videoUrls=videos;if(audios.length)params.audioUrls=audios;}
    else if(images.length){params.referenceUrl=images[0].url;if(images.length>1)params.referenceUrls=images.slice(1).map(function(item){return item.url;});}
    return params;
  };
  ReferenceStore.prototype.canAdd=function(model,kind,role){
    this.ensure();model=model||{};kind=String(kind||'');var limits=model.mediaRefs||model.mediaRefLimits||{};var allowed=[];
    if(model.refKind==='frames'||model.refKind==='image'||model.refMode==='required'||model.refMode==='image-edit')allowed.push('image');
    if(model.refKind==='media-refs')Object.keys({image:1,video:1,audio:1}).forEach(function(key){if(Number(limits[key])>0)allowed.push(key);});
    if(allowed.indexOf(kind)<0)return {ok:false,reason:'REFERENCE_NOT_SUPPORTED'};
    role=String(role||this.nextRole(model,kind));if(model.refKind==='frames'){if(role==='end-frame'&&!model.endFrame)return {ok:false,reason:'END_FRAME_NOT_SUPPORTED'};if((role==='start-frame'||role==='end-frame')&&this.items.some(function(item){return item.role===role;}))return {ok:false,reason:'REFERENCE_ROLE_OCCUPIED'};}
    var total=Number(limits.total);if(!Number.isFinite(total))total=model.refKind==='frames'?(model.endFrame?2:1):model.refKind==='image'?1:0;
    var count=this.items.filter(function(item){return item.kind===kind;}).length,kindMax=Number(limits[kind]);if(!Number.isFinite(kindMax)||kindMax<=0)kindMax=kind==='image'?total:0;
    if(this.items.length>=total||count>=kindMax)return {ok:false,reason:'REFERENCE_LIMIT_EXCEEDED'};
    return {ok:true};
  };
  ReferenceStore.prototype.clear=function(){this.items=[];this.revision++;};
  ns.ReferenceStore=ReferenceStore;
})(typeof window!=='undefined'?window:globalThis);
