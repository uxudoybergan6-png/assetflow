/* ============================================================
   USERS & ROLES — FAZA 6b (adx- redesign)
   Rol berish/olish (USER | CONTRIBUTOR | ADMIN) + pending
   contributor so'rovlarini tasdiqlash. Qo'lda SQL o'rniga.
   API: GET /api/admin/users, PATCH /api/admin/users/:id/role,
        DELETE /api/admin/users/:id/contributor-request
   ============================================================ */

let U_LIST = [];
let U_PENDING = [];
let U_SEARCH = "";
let U_ROLE_FILTER = "all";

function uLoading(){ return `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0"><span class="adx-spin" style="font-size:22px;color:var(--lime)"><i class="ph ph-arrow-clockwise"></i></span></div>`; }

function uById(id){ return U_LIST.find(u=>u.id===id) || U_PENDING.find(u=>u.id===id); }

/** Role badge — inline palette (ADMIN=lime, CONTRIBUTOR=blue, USER=gray). */
function axRole(role){
  const m = {
    ADMIN:       ['rgba(194,240,74,.14)','#C2F04A'],
    CONTRIBUTOR: ['rgba(124,196,255,.14)','#7CC4FF'],
    USER:        ['rgba(138,147,163,.14)','#8A93A3'],
  }[role] || ['rgba(138,147,163,.14)','#8A93A3'];
  return `<span class="adx-bdg" style="background:${m[0]};color:${m[1]}">${esc(role)}</span>`;
}

VIEWS.users = function(){ return `<div id="usersRoot">${uLoading()}</div>`; };

window.afterRender.users = async function(){
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='users'){
    tba.innerHTML =
      `<label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${U_ROLE_FILTER==='all'?'All roles':U_ROLE_FILTER}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i><select onchange="U_ROLE_FILTER=this.value;refreshAdminUsers()"><option value="all">All roles</option><option value="USER" ${U_ROLE_FILTER==='USER'?'selected':''}>USER</option><option value="CONTRIBUTOR" ${U_ROLE_FILTER==='CONTRIBUTOR'?'selected':''}>CONTRIBUTOR</option><option value="ADMIN" ${U_ROLE_FILTER==='ADMIN'?'selected':''}>ADMIN</option></select></label>`;
  }
  await refreshAdminUsers();
};

async function refreshAdminUsers(){
  const root = document.getElementById('usersRoot');
  if(!root) return;
  root.innerHTML = uLoading();
  try{
    const [list, pending] = await Promise.all([
      StudioApi.listAdminUsers({ search: U_SEARCH, role: U_ROLE_FILTER }),
      StudioApi.listAdminUsers({ pending: true }),
    ]);
    U_LIST = list.items || [];
    U_PENDING = pending.items || [];
    window._AF_ROLE_PENDING = list.pendingCount || 0;
    renderNav();
    renderAdminUsers();
  }catch(e){
    root.innerHTML = axInfo(`Could not load users: ${esc(e.message||'API')}`,'red');
  }
}

function renderAdminUsers(){
  const root = document.getElementById('usersRoot');
  if(!root) return;
  const admins = U_LIST.filter(u=>u.role==='ADMIN').length;
  const contribs = U_LIST.filter(u=>u.role==='CONTRIBUTOR').length;

  const pendingCard = U_PENDING.length ? `
    <div class="adx-card" style="overflow:hidden;margin-bottom:16px">
      <div class="adx-cardhd"><i class="ph ph-user-plus" style="color:#FFB27C;font-size:15px"></i><span class="adx-h16" style="font-size:14px">Contributor requests</span><span style="flex:1"></span><span style="font-size:11px;color:#8A93A3">${U_PENDING.length} pending</span></div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:640px">
        <tbody>
        ${U_PENDING.map(u=>`<tr>
          <td><div class="adx-who">${axAv(u.name||u.email,u.email,32)}<div style="min-width:0"><div class="nm">${esc(u.name||'—')}</div><div class="em">${esc(u.email)}</div></div></div></td>
          <td class="adx-num" style="font-size:11px;color:#8A93A3">Requested: ${esc(String(u.contributorRequestedAt||'').slice(0,10))}</td>
          <td class="r"><div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="adx-btn2 sm adx-btn-ok" onclick="openRoleChange('${u.id}','CONTRIBUTOR')"><i class="ph ph-check-circle"></i>Approve as contributor</button>
            <button class="adx-btn2 sm" onclick="openDismissRequest('${u.id}')"><i class="ph ph-x"></i>Dismiss</button>
          </div></td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : '';

  root.innerHTML = `
    <div class="adx-grid4" style="margin-bottom:18px">
      ${axStat({label:'Users shown',val:U_LIST.length,ic:'users',icColor:'#7CC4FF',foot:'latest 100'})}
      ${axStat({label:'Admins',val:admins,ic:'shield-star',icColor:'#C2F04A',foot:'in current list'})}
      ${axStat({label:'Contributors',val:contribs,ic:'users-three',foot:'in current list'})}
      ${axStat({label:'Pending requests',val:U_PENDING.length,ic:'user-plus',icColor:'#FFB27C',foot:'contributor access'})}
    </div>
    ${pendingCard}
    <div class="adx-card" style="overflow:hidden">
      <div class="adx-cardhd"><span class="adx-h16" style="font-size:14px">All users</span><span style="flex:1"></span>
        <label class="adx-inp" style="width:230px;height:32px"><i class="ph ph-magnifying-glass" style="font-size:13px"></i><input id="uSearchInp" placeholder="Search email or name…" value="${esc(U_SEARCH)}" onkeydown="if(event.key==='Enter'){U_SEARCH=this.value.trim();refreshAdminUsers()}"></label>
      </div>
      <div style="overflow-x:auto"><table class="adx-tbl" style="min-width:860px">
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Verified</th><th>Joined</th><th class="r">Change role</th></tr></thead>
        <tbody>
        ${U_LIST.length ? U_LIST.map(u=>`<tr>
          <td><div class="adx-who">${axAv(u.name||u.email,u.email,32)}<div style="min-width:0"><div class="nm">${esc(u.name||'—')}</div><div class="em">${esc(u.email)}</div></div></div></td>
          <td>${axRole(u.role)}${u.contributorRequestedAt&&u.role==='USER'?' <span class="adx-bdg" style="background:rgba(255,178,124,.14);color:#FFB27C">requested</span>':''}</td>
          <td>${axStatus(u.blocked?'blocked':'active')}</td>
          <td style="font-size:11.5px;color:${u.emailVerified?'#C2F04A':'#8A93A3'}">${u.emailVerified?'Yes':'No'}</td>
          <td class="adx-num" style="font-size:11px;color:#8A93A3">${esc(String(u.createdAt||'').slice(0,10))}</td>
          <td class="r"><label class="adx-sel" style="margin-left:auto"><span>${esc(u.role)}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i><select onchange="onRoleSelect('${u.id}',this)">
            <option value="USER" ${u.role==='USER'?'selected':''}>USER</option>
            <option value="CONTRIBUTOR" ${u.role==='CONTRIBUTOR'?'selected':''}>CONTRIBUTOR</option>
            <option value="ADMIN" ${u.role==='ADMIN'?'selected':''}>ADMIN</option>
          </select></label></td>
        </tr>`).join('') : `<tr><td colspan="6"><div class="adx-empty" style="border:0;padding:34px"><span class="ei"><i class="ph ph-users"></i></span><div style="font-weight:600;font-size:13px">No users found</div><div style="font-size:11px;color:var(--muted2)">Change the search or filter.</div></div></td></tr>`}
        </tbody>
      </table></div>
    </div>`;
}

/** Select o'zgardi → qiymatni olib, selectni joriy rolga qaytarib, modal ochamiz
 *  (bekor qilinsa UI noto'g'ri rol ko'rsatmasin — tasdiqda baribir re-render). */
function onRoleSelect(id, sel){
  const u = uById(id);
  const newRole = sel.value;
  if(!u || newRole === u.role) return;
  sel.value = u.role;
  openRoleChange(id, newRole);
}

function openRoleChange(id, newRole){
  const u = uById(id);
  if(!u) return;
  const demoteAdmin = u.role==='ADMIN' && newRole!=='ADMIN';
  const note = {
    ADMIN: 'Full access: moderation, users, finance and role management.',
    CONTRIBUTOR: 'Can upload templates and submit them for moderation.',
    USER: 'Subscriber only — no Studio upload access.',
  }[newRole];
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--violet-dim);color:var(--violet-bright)">${ic('users')}</div>
      <div><h3>Change role to ${esc(newRole)}</h3><p>${esc(u.name||u.email)} · ${esc(u.email)}</p></div>
    </div>
    <div class="modal-body col gap-12">
      <div class="info-banner${demoteAdmin?' danger':''}">${ic('alert')}<span><b>${esc(u.role)}</b> → <b>${esc(newRole)}</b>. ${esc(note||'')}${demoteAdmin?' Admin access is removed immediately.':''}</span></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn ${demoteAdmin?'btn-danger':'btn-primary'}" onclick="doRoleChange('${id}','${newRole}')">Set ${esc(newRole)}</button>
    </div>`);
}

async function doRoleChange(id, newRole){
  const u = uById(id);
  try{
    await StudioApi.setUserRole(id, newRole);
    closeModal();
    toast('Role updated', `${u?u.email:''} → ${newRole}`, 'success');
    await refreshAdminUsers();
  }catch(e){
    toast('Error', e.message || 'API', 'danger');
  }
}

function openDismissRequest(id){
  const u = uById(id);
  if(!u) return;
  openModal(`
    <div class="modal-head">
      <div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic('ban')}</div>
      <div><h3>Dismiss request</h3><p>${esc(u.email)}</p></div>
    </div>
    <div class="modal-body">
      <div class="info-banner">${ic('alert')}<span>The contributor request is removed. The user keeps the USER role and can request again later.</span></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doDismissRequest('${id}')">Dismiss</button>
    </div>`);
}

async function doDismissRequest(id){
  const u = uById(id);
  try{
    await StudioApi.dismissContributorRequest(id);
    closeModal();
    toast('Dismissed', `${u?u.email:''} — request removed`, 'info');
    await refreshAdminUsers();
  }catch(e){
    toast('Error', e.message || 'API', 'danger');
  }
}
