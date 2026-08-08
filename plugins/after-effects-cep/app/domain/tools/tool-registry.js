(function(root){
  'use strict';
  var ns=root.FFVNext=root.FFVNext||{};
  var TOOLS=[{id:'image',label:'Image',mode:'image',flag:'createImageV2'},{id:'video',label:'Video',mode:'video',flag:'createVideoV2'},{id:'voice',label:'Voiceover',mode:'voice',domain:'audio',flag:'createAudioV2'},{id:'sfx',label:'Sound effects',mode:'sfx',domain:'audio',flag:'createAudioV2'}];
  var OPERATIONS=[{id:'image-upscale',label:'Upscale image',mode:'image',operation:true},{id:'video-upscale',label:'Upscale video',mode:'video',operation:true}];
  function ToolRegistry(models,preferences,flags){this.models=models;this.preferences=preferences;this.flags=flags;}
  ToolRegistry.prototype.catalog=function(){var list=TOOLS.slice();if(this.flags.enabled('toolsV2'))list=list.concat(OPERATIONS);return list;};
  ToolRegistry.prototype.pins=function(){var known={};this.catalog().forEach(function(tool){known[tool.id]=1;});var pins=this.preferences.read('tool-pins',[]).filter(function(id){return known[id];});this.preferences.write('tool-pins',pins);return pins;};
  ToolRegistry.prototype.toggle=function(id){var pins=this.pins(),at=pins.indexOf(id);if(at>=0)pins.splice(at,1);else if(this.catalog().some(function(tool){return tool.id===id;}))pins.push(id);this.preferences.write('tool-pins',pins);return pins;};
  ToolRegistry.prototype.list=function(){var pins=this.pins(),self=this;return this.catalog().map(function(tool){var models=self.models.list(tool.mode),operation=tool.operation&&typeof self.models.operationFor==='function'?self.models.operationFor(tool.mode):null,enabled=tool.operation?!!operation:self.flags.enabled(tool.flag)&&self.flags.enabled('generationDomainV2',tool.domain||tool.mode)&&models.length>0;return Object.assign({},tool,{pinned:pins.indexOf(tool.id)>=0,enabled:enabled,reason:enabled?'':tool.operation?'Provider temporarily unavailable':models.length?'Disabled by rollout':'No enabled model'});}).filter(function(tool){return self.flags.generation==='dual-stack'||tool.enabled||tool.pinned;}).sort(function(a,b){return Number(b.pinned)-Number(a.pinned);});};
  ns.ToolRegistry=ToolRegistry;
})(typeof window!=='undefined'?window:globalThis);
