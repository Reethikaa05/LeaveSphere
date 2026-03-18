// ============================================================
//  LeaveDesk — Frontend Utils + App Core v2
// ============================================================
const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const AV_BG    = ['rgba(108,99,255,.2)','rgba(56,189,248,.2)','rgba(34,211,165,.2)','rgba(251,191,36,.2)','rgba(248,113,113,.2)','rgba(167,139,250,.2)'];
const AV_COLOR = ['var(--accent2)','var(--accent3)','var(--success)','var(--warning)','var(--danger)','#a78bfa'];

function fmtDate(d) { if(!d)return'—'; const dt=new Date(d); return`${dt.getUTCDate()} ${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`; }
function fmtDateRange(s,e){ const a=new Date(s),b=new Date(e); if(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCFullYear()===b.getUTCFullYear()) return`${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]} ${a.getUTCFullYear()}`; return`${fmtDate(s)} – ${fmtDate(e)}`; }
function todayStr(){ return new Date().toISOString().split('T')[0]; }
function typeLabel(c){ return{vacation:'Vacation',sick:'Sick Leave',personal:'Personal',bereavement:'Bereavement',maternity:'Maternity/Paternity'}[c]||c; }
function typeEmoji(c){ return{vacation:'🏖️',sick:'🤒',personal:'👤',bereavement:'🕊️',maternity:'👶'}[c]||'📋'; }
function typeBadge(c){ return{vacation:'b-vacation',sick:'b-sick',personal:'b-personal',bereavement:'b-bereavement',maternity:'b-maternity'}[c]||'b-neutral'; }
function statusBadge(s){ return{pending:'b-pending',approved:'b-approved',rejected:'b-rejected',cancelled:'b-cancelled'}[s]||'b-neutral'; }
function statusLabel(s){ return{pending:'Pending',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled'}[s]||s; }
function badge(txt,cls){ return`<span class="badge2 ${cls}">${txt}</span>`; }
function charIndex(s){ return(s?.charCodeAt(0)||0)%AV_BG.length; }
function avatarEl(initials,idx,size=32){ const i=(typeof idx==='number'?idx:charIndex(initials))%AV_BG.length; return`<div class="avatar" style="width:${size}px;height:${size}px;background:${AV_BG[i]};color:${AV_COLOR[i]}">${initials||'?'}</div>`; }
function progressBar(used,total,bg){ const pct=total>0?Math.min(100,Math.round(used/total*100)):0; return`<div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${bg}"></div></div>`; }
function workingDays(s,e){ if(!s||!e)return 0; const a=new Date(s),b=new Date(e); if(b<a)return 0; let n=0,cur=new Date(a); while(cur<=b){const d=cur.getDay();if(d!==0&&d!==6)n++;cur.setDate(cur.getDate()+1);} return n; }
function divider(){ return`<div class="divider"></div>`; }

let _tt;
function showToast(msg,type='success'){ const el=document.getElementById('toast'); document.getElementById('toast-msg').textContent=msg; const c={success:'rgba(34,211,165,.4)',warn:'rgba(251,191,36,.4)',info:'rgba(56,189,248,.4)',danger:'rgba(248,113,113,.4)'}; el.style.borderColor=c[type]||c.success; el.classList.add('show'); clearTimeout(_tt); _tt=setTimeout(()=>el.classList.remove('show'),3300); }
function openModal(title,html){ document.getElementById('modal-title').textContent=title; document.getElementById('modal-body').innerHTML=html; document.getElementById('modal-overlay').classList.add('open'); }
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); }
function setContent(html){ document.getElementById('content-area').innerHTML=html; }
function showLoader(){ setContent(`<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>`); }

// ── APP STATE ─────────────────────────────────────────────
let currentPage = 'dashboard';
let calDate     = new Date();
let leaveTypesCache = null;

const PAGE_TITLES = {
  dashboard:'Dashboard','my-leaves':'My Leave Requests',apply:'Apply for Leave',
  calendar:'Leave Calendar',approvals:'Leave Approvals',team:'Team Overview',
  reports:'Reports & Analytics','admin-users':'Manage Users',
  'admin-settings':'System Settings',audit:'Audit Log',
  notifications:'Notifications',profile:'My Profile',
};

function showLoginPage(){ document.getElementById('login-page').style.display='flex'; document.getElementById('app').style.display='none'; }
function showApp(){ document.getElementById('login-page').style.display='none'; document.getElementById('app').style.display='flex'; }

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error');
  const btn=document.getElementById('login-btn');
  errEl.style.display='none';
  if(!email||!password){ errEl.textContent='Please enter email and password'; errEl.style.display='block'; return; }
  btn.textContent='Signing in...'; btn.disabled=true;
  try{
    const res=await Auth.login(email,password);
    setToken(res.token); setUser(res.user);
    await initApp();
  }catch(err){
    errEl.textContent=err.message||'Login failed. Check your credentials.';
    errEl.style.display='block';
    btn.textContent="Sign In"; btn.disabled=false;
  }
}

function fillDemo(email){ document.getElementById('login-email').value=email; document.getElementById('login-password').value='password123'; }
function togglePassword(){ const i=document.getElementById('login-password'); i.type=i.type==='password'?'text':'password'; }

function doLogout(){ removeToken(); showLoginPage(); showToast('Signed out','info'); const b=document.getElementById('login-btn'); if(b){b.textContent='Sign In';b.disabled=false;} }

async function initApp(){
  showApp();
  const user=getUser();
  if(!user){doLogout();return;}

  document.getElementById('sidebar-name').textContent    = user.name;
  document.getElementById('sidebar-role').textContent    = user.department_name||user.role;
  document.getElementById('sidebar-avatar').textContent  = user.avatar_initials||user.name.slice(0,2).toUpperCase();
  document.getElementById('topbar-avatar').textContent   = user.avatar_initials||user.name.slice(0,2).toUpperCase();
  const now=new Date();
  document.getElementById('page-sub').textContent=`Welcome back, ${user.name.split(' ')[0]} 👋  •  ${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  if(user.role==='manager'||user.role==='admin'){
    ['mgr-section','nav-approvals','nav-team','nav-reports'].forEach(id=>{ const el=document.getElementById(id); if(el)el.style.display=''; });
  }
  if(user.role==='manager'||user.role==='admin'){
    ['admin-section','nav-admin-users','nav-admin-settings','nav-audit'].forEach(id=>{ const el=document.getElementById(id); if(el)el.style.display=''; });
  }

  document.querySelectorAll('.nav-item').forEach(item=>{
    item.addEventListener('click',()=>{ const page=item.getAttribute('data-page'); if(page)navigate(page,item); });
  });
  document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});
  document.getElementById('login-password')?.addEventListener('keyup',e=>{if(e.key==='Enter')doLogin();});

  navigate('dashboard',null);
  loadPendingCount();
  loadNotifCount();
}

function navigate(page,fromEl){
  if(!PAGE_TITLES[page])return;
  currentPage=page;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const target=fromEl||document.querySelector(`.nav-item[data-page="${page}"]`);
  if(target)target.classList.add('active');
  document.getElementById('page-title').textContent=PAGE_TITLES[page];
  showLoader();
  switch(page){
    case 'dashboard':       renderDashboard();       break;
    case 'my-leaves':       renderMyLeaves();        break;
    case 'apply':           renderApply();           break;
    case 'calendar':        renderCalendarPage();    break;
    case 'approvals':       renderApprovals();       break;
    case 'team':            renderTeam();            break;
    case 'reports':         renderReports();         break;
    case 'admin-users':     renderAdminUsers();      break;
    case 'admin-settings':  renderAdminSettings();   break;
    case 'audit':           renderAudit();           break;
    case 'notifications':   renderNotifications();   break;
    case 'profile':         renderProfile();         break;
  }
  closeSidebarMobile();
}

async function loadPendingCount(){
  try{
    const res=await Leaves.getPending();
    const c=res.count||0;
    const b=document.getElementById('pending-badge');
    if(b){b.textContent=c;b.style.display=c>0?'':'none';}
  }catch{}
}

async function loadNotifCount(){
  try{
    const res=await Notifications.getAll();
    const c=res.unread||0;
    const nb=document.getElementById('notif-badge');
    const dot=document.getElementById('topbar-notif-dot');
    if(nb){nb.textContent=c;nb.style.display=c>0?'':'none';}
    if(dot)dot.style.display=c>0?'':'none';
  }catch{}
}

function toggleSidebar(){ const sb=document.getElementById('sidebar'),ov=document.getElementById('sidebar-overlay'); const open=sb.classList.toggle('open'); ov.classList.toggle('show',open); }
function closeSidebarMobile(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); }

document.addEventListener('DOMContentLoaded',()=>{
  const token=getToken(),user=getUser();
  if(token&&user){ initApp(); }
  else{
    showLoginPage();
    document.getElementById('login-password')?.addEventListener('keyup',e=>{ if(e.key==='Enter')doLogin(); });
    document.getElementById('login-email')?.addEventListener('keyup',e=>{ if(e.key==='Enter')document.getElementById('login-password').focus(); });
  }
});
