/* ============================================================
   AssetFlow — shared icons + helpers
   ============================================================ */
const ICONS = {
  // nav
  grid:    '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  layers:  '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  upload:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  inbox:   '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  gear:    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  logout:  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  shield:  '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  users:   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart:   '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  list:    '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  scroll:  '<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  // ui
  search:  '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell:    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus:    '<path d="M5 12h14M12 5v14"/>',
  check:   '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  x:       '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  chevR:   '<path d="m9 18 6-6-6-6"/>',
  chevL:   '<path d="m15 18-6-6 6-6"/>',
  chevD:   '<path d="m6 9 6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDn: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  trendUp: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  trendDn: '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
  play:    '<path d="m6 3 14 9-14 9V3Z"/>',
  edit:    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  trash:   '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye:     '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  send:    '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  filter:  '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  more:    '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  clock:   '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert:   '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  ban:     '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  film:    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M17 7.5h4M3 12h18M3 16.5h4M17 16.5h4"/>',
  image:   '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  file:    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/>',
  tag:     '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  ext:     '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  megaphone:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  folder:  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  star:    '<path d="M11.5 2.5 14 8l6 .8-4.4 4.2 1.1 6L11.5 16 6.3 19l1.1-6L3 8.8 9 8Z"/>',
  mail:    '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  link:    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  globe:   '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  calendar:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  dollar:  '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon:    '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  menu:    '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plugin:  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m10 8 6 4-6 4V8Z"/><path d="M3 9h2M3 15h2"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  reply:   '<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  flag:    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  copy:    '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
};

function ic(name, cls) {
  return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;
}

// avatar color from string
const AV_COLORS = [['#7b5cff','#4a2fb0'],['#f2994a','#c2410c'],['#38d399','#0a7a5c'],['#56a0f2','#2a4fb0'],['#ec5fb0','#9b2c6f'],['#f2c94c','#a16207'],['#34d399','#0f766e'],['#9b8cff','#5b4fc7']];
function avColor(s){ let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h); return AV_COLORS[Math.abs(h)%AV_COLORS.length]; }
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function avatar(name, size){
  const [a,b]=avColor(name); const s=size||30;
  return `<div class="avatar" style="width:${s}px;height:${s}px;font-size:${s*0.4}px;background:linear-gradient(140deg,${a},${b})">${initials(name)}</div>`;
}

// toast
function toast(title, msg, kind){
  let wrap=document.querySelector('.toast-wrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const map={success:['green','checkCircle'],danger:['red','xCircle'],warn:['orange','alert'],info:['violet','bell']};
  const [c,i]=map[kind||'success'];
  const el=document.createElement('div'); el.className='toast';
  // title/msg ko'pincha server matni (xato, contributor nomi) — XSS oldini olish uchun escape
  const esc=(s)=>(window.StudioMedia&&StudioMedia.escapeHtml?StudioMedia.escapeHtml(s):String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));
  el.innerHTML=`<div class="t-ico" style="background:var(--${c}-dim);color:var(--${c})">${ic(i)}</div>
    <div class="t-body"><div class="t-title">${esc(title)}</div>${msg?`<div class="t-msg">${esc(msg)}</div>`:''}</div>`;
  wrap.appendChild(el);
  // P34: bir vaqtda 3 tadan ortiq toast yig'ilib qolmasin — eng eskisi darhol yopiladi
  while (wrap.children.length > 3) wrap.children[0].remove();
  setTimeout(()=>{ el.style.transition='opacity .3s,transform .3s'; el.style.opacity='0'; el.style.transform='translateX(20px)'; setTimeout(()=>el.remove(),300); }, 3200);
}

// status meta
const STATUS = {
  draft:    {cls:'badge-draft',    label:'Draft'},
  pending:  {cls:'badge-pending',  label:'Pending'},
  approved: {cls:'badge-approved', label:'Approved'},
  soft:     {cls:'badge-soft',     label:'Soft reject'},
  hard:     {cls:'badge-hard',     label:'Hard reject'},
  archived: {cls:'badge-archived', label:'Archived'},
};
function badge(status){ const s=STATUS[status]; return `<span class="badge ${s.cls}"><span class="dot"></span>${s.label}</span>`; }

// §F (P33) — bitta LOKAL sana yordamchisi. Ilgari hamma joyda `iso.slice(0,10)` /
// `.slice(0,16).replace("T"," ")` — bu XOM UTC edi (foydalanuvchi mintaqasida noto'g'ri kun/soat).
// fmtLocalDate → mahalliy "Jul 15, 2026"; fmtLocalDateTime → mahalliy "Jul 15, 2026, 14:30".
function fmtLocalDate(iso){
  if(!iso) return '—';
  const d=new Date(iso); if(isNaN(d.getTime())) return String(iso).slice(0,10);
  return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}
function fmtLocalDateTime(iso){
  if(!iso) return '—';
  const d=new Date(iso); if(isNaN(d.getTime())) return String(iso).slice(0,16).replace('T',' ');
  return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
}
if(typeof window!=='undefined'){ window.fmtLocalDate=fmtLocalDate; window.fmtLocalDateTime=fmtLocalDateTime; }

// modal/drawer host
function openModal(html){
  closeModal();
  const o=document.createElement('div'); o.className='overlay'; o.id='__modal';
  o.innerHTML=`<div class="modal">${html}</div>`;
  o.addEventListener('click',e=>{ if(e.target===o) closeModal(); });
  document.body.appendChild(o);
  document.addEventListener('keydown', escClose);
}
function closeModal(){ const o=document.getElementById('__modal'); if(o) o.remove(); document.removeEventListener('keydown', escClose); }
function escClose(e){ if(e.key==='Escape'){ closeModal(); closeDrawer(); } }

function openDrawer(html){
  closeDrawer();
  const s=document.createElement('div'); s.className='drawer-scrim'; s.id='__scrim';
  s.addEventListener('click', closeDrawer);
  const d=document.createElement('div'); d.className='drawer'; d.id='__drawer'; d.innerHTML=html;
  document.body.appendChild(s); document.body.appendChild(d);
  document.addEventListener('keydown', escClose);
}
function closeDrawer(){ const d=document.getElementById('__drawer'); const s=document.getElementById('__scrim'); if(d)d.remove(); if(s)s.remove(); }

// tiny donut svg
function donut(segments, size){
  const sz=size||120, r=sz/2-10, c=2*Math.PI*r, cx=sz/2;
  let off=0, paths='';
  segments.forEach(seg=>{
    const len=c*seg.v; 
    paths+=`<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="13" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})" stroke-linecap="butt"/>`;
    off+=len;
  });
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">${paths}</svg>`;
}

// line chart svg (sparkline area)
function areaChart(data, w, h, color){
  const max=Math.max(...data), min=Math.min(...data)*0.6;
  const pts=data.map((v,i)=>[i/(data.length-1)*w, h-((v-min)/(max-min))*(h-10)-5]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L ${w} ${h} L 0 ${h} Z`;
  const id='grad'+Math.random().toString(36).slice(2,7);
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
