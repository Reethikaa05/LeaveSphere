// ============================================================
//  LeaveDesk — Admin, Profile, Notifications, Settings Pages
// ============================================================

// ╔══════════════════════════════════════════╗
// ║  PROFILE PAGE                            ║
// ╚══════════════════════════════════════════╝
async function renderProfile() {
  try {
    const [meRes, balRes, leavesRes] = await Promise.all([
      Auth.me(), Users.getBalances(), Leaves.getMyLeaves()
    ]);
    const user    = meRes.user;
    const bals    = balRes.data || [];
    const leaves  = leavesRes.data || [];
    const taken   = leaves.filter(l => l.status === 'approved').reduce((a,b) => a + b.working_days, 0);
    const idx     = charIndex(user.avatar_initials || user.name);
    const bgColors= ['linear-gradient(90deg,var(--accent),var(--accent2))','linear-gradient(90deg,var(--accent3),#818cf8)','linear-gradient(90deg,var(--warning),#f59e0b)','linear-gradient(90deg,var(--danger),#f87171)','linear-gradient(90deg,var(--success),#34d399)'];

    setContent(`
      <div class="view active">
        <div class="profile-header">
          <div class="profile-av" style="background:${AV_BG[idx]};color:${AV_COLOR[idx]};font-size:22px">${user.avatar_initials || '??'}</div>
          <div style="flex:1;min-width:0">
            <div class="profile-name">${user.name}</div>
            <div class="profile-role">${user.department_name || 'N/A'} &nbsp;•&nbsp; ${user.email}</div>
            <div class="profile-badges">
              ${badge(user.role.charAt(0).toUpperCase()+user.role.slice(1), user.role==='manager'?'b-approved':'b-vacation')}
              ${user.joining_date ? badge('Joined '+fmtDate(user.joining_date),'b-neutral') : ''}
              ${user.manager_name ? badge('Reports to '+user.manager_name,'b-neutral') : ''}
            </div>
          </div>
          <button class="btn btn-ghost" onclick="navigate('apply',null)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Apply Leave
          </button>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div class="panel-title">Leave Balances — ${new Date().getFullYear()}</div></div>
            <div class="panel-body">
              <div class="balance-list">
                ${bals.map((b,i) => `
                  <div class="balance-item">
                    <div class="balance-info">
                      <div class="balance-name">${b.leave_type_name}</div>
                      ${progressBar(b.used_days, b.total_days, bgColors[i % bgColors.length])}
                      <div class="balance-used">${b.used_days} used of ${b.total_days} days &nbsp;•&nbsp; ${b.remaining_days} remaining</div>
                    </div>
                    <div class="balance-num">${b.remaining_days}</div>
                  </div>`).join('') || '<p style="color:var(--text2)">No balance data</p>'}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><div class="panel-title">Quick Stats</div></div>
            <div class="panel-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                ${[
                  {label:'Days Taken',  val:taken, icon:'📅'},
                  {label:'Approved',    val:leaves.filter(l=>l.status==='approved').length, icon:'✅'},
                  {label:'Pending',     val:leaves.filter(l=>l.status==='pending').length, icon:'⏳'},
                  {label:'Rejected',    val:leaves.filter(l=>l.status==='rejected').length, icon:'❌'},
                ].map(s => `
                  <div style="background:var(--bg3);border-radius:var(--r2);padding:14px">
                    <div style="font-size:18px;margin-bottom:6px">${s.icon}</div>
                    <div style="font-family:var(--font);font-size:22px;font-weight:800">${s.val}</div>
                    <div style="font-size:11.5px;color:var(--text2);margin-top:2px">${s.label}</div>
                  </div>`).join('')}
              </div>
              <div class="divider"></div>
              <div style="font-size:12.5px;color:var(--text2);line-height:1.7">
                <div><strong style="color:var(--text)">Email:</strong> ${user.email}</div>
                <div><strong style="color:var(--text)">Department:</strong> ${user.department_name || '—'}</div>
                <div><strong style="color:var(--text)">Manager:</strong> ${user.manager_name || '—'}</div>
                <div><strong style="color:var(--text)">Joined:</strong> ${fmtDate(user.joining_date)}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Change Password</div></div>
          <div class="panel-body" style="max-width:460px">
            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" class="form-input" id="cp-current" placeholder="Current password">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input type="password" class="form-input" id="cp-new" placeholder="Min. 6 characters">
              </div>
              <div class="form-group">
                <label class="form-label">Confirm Password</label>
                <input type="password" class="form-input" id="cp-confirm" placeholder="Repeat new password">
              </div>
            </div>
            <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

async function changePassword() {
  const cur  = document.getElementById('cp-current').value;
  const nw   = document.getElementById('cp-new').value;
  const conf = document.getElementById('cp-confirm').value;
  if (!cur || !nw) { showToast('⚠️ Fill in all password fields','warn'); return; }
  if (nw !== conf) { showToast('⚠️ New passwords do not match','warn'); return; }
  if (nw.length < 6) { showToast('⚠️ Password must be at least 6 characters','warn'); return; }
  try {
    await Auth.changePassword(cur, nw);
    showToast('✅ Password updated successfully!','success');
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value     = '';
    document.getElementById('cp-confirm').value = '';
  } catch (err) { showToast('❌ ' + err.message,'danger'); }
}

// ╔══════════════════════════════════════════╗
// ║  NOTIFICATIONS                           ║
// ╚══════════════════════════════════════════╝
async function renderNotifications() {
  try {
    const res    = await Notifications.getAll();
    const notifs = res.data || [];
    const typeInfo = {
      pending_approval:{ icon:'⏳', bg:'rgba(251,191,36,.15)',  color:'var(--warning)' },
      approved:        { icon:'✅', bg:'rgba(34,211,165,.15)',  color:'var(--success)' },
      rejected:        { icon:'❌', bg:'rgba(248,113,113,.15)', color:'var(--danger)'  },
      reminder:        { icon:'🔔', bg:'rgba(56,189,248,.15)',  color:'var(--accent3)' },
    };

    setContent(`
      <div class="view active">
        <div class="sec-header">
          <div><div class="sec-title">Notifications</div><div class="sec-sub">${notifs.length} total notifications</div></div>
          ${notifs.length ? `<button class="btn btn-ghost btn-sm" onclick="renderNotifications()">↻ Refresh</button>` : ''}
        </div>
        <div class="panel">
          <div class="panel-body" style="padding-top:8px">
            ${notifs.length ? notifs.map(n => {
              const info = typeInfo[n.type] || typeInfo.reminder;
              return `
                <div class="notif-item notif-unread" onclick="navigate('${n.link_page}',null)">
                  <div class="notif-dot-wrap" style="background:${info.bg}">
                    <span style="font-size:16px">${info.icon}</span>
                  </div>
                  <div style="flex:1;min-width:0">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-msg">${n.message}</div>
                    <div class="notif-time">${n.time ? new Date(n.time).toLocaleString() : ''}</div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>`;
            }).join('')
            : `<div class="empty-state"><div class="empty-icon">🔔</div><p>No notifications yet</p></div>`}
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

// ╔══════════════════════════════════════════╗
// ║  ADMIN — MANAGE USERS                    ║
// ╚══════════════════════════════════════════╝
async function renderAdminUsers() {
  try {
    const [usersRes, deptRes] = await Promise.all([Admin.getUsers(), Admin.getDepts()]);
    const users = usersRes.data || [];
    const depts = deptRes.data  || [];
    const active   = users.filter(u=>u.is_active).length;
    const managers = users.filter(u=>u.role==='manager').length;

    setContent(`
      <div class="view active">
        <div class="sec-header">
          <div><div class="sec-title">Manage Users</div><div class="sec-sub">${users.length} total accounts</div></div>
          <button class="btn btn-primary" onclick="openAddUserModal(${JSON.stringify(depts).replace(/"/g,'&quot;')})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add User
          </button>
        </div>
        <div class="stat-grid" style="margin-bottom:18px">
          <div class="stat-card blue"><div class="stat-label">Total Users</div><div class="stat-num">${users.length}</div><div class="stat-sub">Registered accounts</div></div>
          <div class="stat-card green"><div class="stat-label">Active</div><div class="stat-num">${active}</div><div class="stat-sub">Currently active</div></div>
          <div class="stat-card purple"><div class="stat-label">Managers</div><div class="stat-num">${managers}</div><div class="stat-sub">Manager role</div></div>
          <div class="stat-card amber"><div class="stat-label">Departments</div><div class="stat-num">${depts.length}</div><div class="stat-sub">Active departments</div></div>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Manager</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${users.map((u,i) => `
                  <tr>
                    <td><div class="emp-cell">${avatarEl(u.avatar_initials,i)}<div class="emp-name">${u.name}</div></div></td>
                    <td style="font-size:12px;color:var(--text2)">${u.email}</td>
                    <td>${badge(u.role.charAt(0).toUpperCase()+u.role.slice(1), u.role==='manager'?'b-approved':u.role==='admin'?'b-bereavement':'b-vacation')}</td>
                    <td style="font-size:12.5px;color:var(--text2)">${u.department_name||'—'}</td>
                    <td style="font-size:12.5px;color:var(--text2)">${u.manager_name||'—'}</td>
                    <td>${badge(u.is_active?'Active':'Inactive', u.is_active?'b-active':'b-rejected')}</td>
                    <td><div class="tbl-actions">
                      <button class="btn btn-ghost btn-sm" onclick="openEditUserModal(${u.id},'${u.name}','${u.role}',${u.is_active},${JSON.stringify(depts).replace(/"/g,'&quot;')})">Edit</button>
                      ${u.is_active ? `<button class="btn btn-danger btn-sm" onclick="deactivateUser(${u.id},'${u.name}')">Deactivate</button>` : `<button class="btn btn-success btn-sm" onclick="activateUser(${u.id})">Activate</button>`}
                    </div></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

function openAddUserModal(depts) {
  const deptsArr = typeof depts === 'string' ? JSON.parse(depts.replace(/&quot;/g,'"')) : depts;
  openModal('Add New User', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-row">
        <div class="form-group" style="margin:0"><label class="form-label">Full Name *</label><input type="text" class="form-input" id="au-name" placeholder="John Smith"></div>
        <div class="form-group" style="margin:0"><label class="form-label">Email *</label><input type="email" class="form-input" id="au-email" placeholder="john@company.com"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin:0"><label class="form-label">Password *</label><input type="password" class="form-input" id="au-pass" placeholder="Min. 6 chars"></div>
        <div class="form-group" style="margin:0"><label class="form-label">Role</label>
          <select class="form-input form-select" id="au-role">
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin:0"><label class="form-label">Department</label>
        <select class="form-input form-select" id="au-dept">
          <option value="">— None —</option>
          ${deptsArr.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createUser()">Create User</button>
      </div>
    </div>`);
}

async function createUser() {
  const name  = document.getElementById('au-name').value.trim();
  const email = document.getElementById('au-email').value.trim();
  const pass  = document.getElementById('au-pass').value;
  const role  = document.getElementById('au-role').value;
  const dept  = document.getElementById('au-dept').value;
  if (!name || !email || !pass) { showToast('⚠️ Fill in all required fields','warn'); return; }
  try {
    await Admin.createUser({ name, email, password:pass, role, department_id: dept||undefined });
    showToast('✅ User created successfully!','success');
    closeModal();
    renderAdminUsers();
  } catch (err) { showToast('❌ '+err.message,'danger'); }
}

function openEditUserModal(id, name, role, isActive, depts) {
  const deptsArr = typeof depts === 'string' ? JSON.parse(depts.replace(/&quot;/g,'"')) : depts;
  openModal(`Edit User — ${name}`, `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group" style="margin:0"><label class="form-label">Role</label>
        <select class="form-input form-select" id="eu-role">
          <option value="employee" ${role==='employee'?'selected':''}>Employee</option>
          <option value="manager"  ${role==='manager'?'selected':''}>Manager</option>
          <option value="admin"    ${role==='admin'?'selected':''}>Admin</option>
        </select>
      </div>
      <div class="form-group" style="margin:0"><label class="form-label">Department</label>
        <select class="form-input form-select" id="eu-dept">
          <option value="">— None —</option>
          ${deptsArr.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditUser(${id})">Save Changes</button>
      </div>
    </div>`);
}

async function saveEditUser(id) {
  const role = document.getElementById('eu-role').value;
  const dept = document.getElementById('eu-dept').value;
  try {
    await Admin.updateUser(id, { role, department_id: dept||null });
    showToast('✅ User updated','success');
    closeModal();
    renderAdminUsers();
  } catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function deactivateUser(id, name) {
  if (!confirm(`Deactivate ${name}? They will lose access.`)) return;
  try {
    await Admin.deleteUser(id);
    showToast(`User ${name} deactivated`,'warn');
    renderAdminUsers();
  } catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function activateUser(id) {
  try {
    await Admin.updateUser(id, { is_active: true });
    showToast('✅ User activated','success');
    renderAdminUsers();
  } catch (err) { showToast('❌ '+err.message,'danger'); }
}

// ╔══════════════════════════════════════════╗
// ║  ADMIN — SETTINGS                        ║
// ╚══════════════════════════════════════════╝
let settingsTab = 'departments';

async function renderAdminSettings() {
  setContent(`
    <div class="view active">
      <div class="sec-header"><div><div class="sec-title">System Settings</div><div class="sec-sub">Manage departments, leave policies, and holidays</div></div></div>
      <div class="settings-tabs">
        <button class="settings-tab ${settingsTab==='departments'?'active':''}" onclick="switchSettingsTab('departments')">Departments</button>
        <button class="settings-tab ${settingsTab==='leave-types'?'active':''}" onclick="switchSettingsTab('leave-types')">Leave Policies</button>
        <button class="settings-tab ${settingsTab==='holidays'?'active':''}" onclick="switchSettingsTab('holidays')">Holidays</button>
        <button class="settings-tab ${settingsTab==='balance'?'active':''}" onclick="switchSettingsTab('balance')">Balance Adjust</button>
      </div>
      <div id="settings-content"><div class="loading-inline"><div class="spinner-sm"></div>Loading...</div></div>
    </div>`);
  loadSettingsTab();
}

function switchSettingsTab(tab) {
  settingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(tab.replace('-',' '))));
  loadSettingsTab();
}

async function loadSettingsTab() {
  const el = document.getElementById('settings-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-inline"><div class="spinner-sm"></div>Loading...</div>`;

  try {
    if (settingsTab === 'departments') {
      const res  = await Admin.getDepts();
      const data = res.data || [];
      el.innerHTML = `
        <div class="sec-header" style="margin-bottom:16px">
          <div style="font-size:14px;font-weight:600">Departments (${data.length})</div>
          <button class="btn btn-primary btn-sm" onclick="openAddDeptModal()">+ Add Department</button>
        </div>
        <div class="panel"><div class="table-wrap"><table>
          <thead><tr><th>Department</th><th>Employees</th><th>Action</th></tr></thead>
          <tbody>
            ${data.map(d=>`<tr>
              <td style="font-weight:500">${d.name}</td>
              <td>${badge(d.employee_count+' employees','b-neutral')}</td>
              <td><div class="tbl-actions">
                <button class="btn btn-ghost btn-sm" onclick="editDept(${d.id},'${d.name}')">Rename</button>
                <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.id},'${d.name}')">Delete</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table></div></div>`;
    }

    else if (settingsTab === 'leave-types') {
      const res  = await Admin.getLeaveTypes();
      const data = res.data || [];
      el.innerHTML = `
        <div style="margin-bottom:14px;font-size:13px;color:var(--text2)">Edit default day allocations per leave type. Changes apply to new users only.</div>
        <div class="panel"><div class="table-wrap"><table>
          <thead><tr><th>Leave Type</th><th>Code</th><th>Default Days/Year</th><th>Description</th><th>Action</th></tr></thead>
          <tbody>
            ${data.map(lt=>`<tr>
              <td style="font-weight:500">${typeEmoji(lt.code)} ${lt.name}</td>
              <td>${badge(lt.code,'b-neutral')}</td>
              <td><input type="number" class="form-input" value="${lt.default_days}" id="lt-days-${lt.id}" style="width:70px;padding:5px 8px;font-size:13px" min="0" max="365"></td>
              <td style="font-size:12px;color:var(--text2);max-width:180px">${lt.description||'—'}</td>
              <td><button class="btn btn-primary btn-sm" onclick="saveLeaveType(${lt.id})">Save</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div></div>`;
    }

    else if (settingsTab === 'holidays') {
      const res  = await Admin.getHolidays();
      const data = res.data || [];
      el.innerHTML = `
        <div class="sec-header" style="margin-bottom:16px">
          <div style="font-size:14px;font-weight:600">Public Holidays (${data.length})</div>
          <button class="btn btn-primary btn-sm" onclick="openAddHolidayModal()">+ Add Holiday</button>
        </div>
        <div class="panel"><div class="table-wrap"><table>
          <thead><tr><th>Holiday</th><th>Date</th><th>Description</th><th>Action</th></tr></thead>
          <tbody>
            ${data.map(h=>`<tr>
              <td style="font-weight:500">${h.name}</td>
              <td>${fmtDate(h.holiday_date)}</td>
              <td style="font-size:12.5px;color:var(--text2)">${h.description||'—'}</td>
              <td><button class="btn btn-danger btn-sm" onclick="deleteHoliday(${h.id},'${h.name}')">Remove</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div></div>`;
    }

    else if (settingsTab === 'balance') {
      const [usersRes, typesRes] = await Promise.all([Admin.getUsers(), Admin.getLeaveTypes()]);
      const users = usersRes.data || [];
      const types = typesRes.data || [];
      el.innerHTML = `
        <div style="margin-bottom:16px;font-size:13px;color:var(--text2)">Manually adjust leave day allocations for individual employees.</div>
        <div class="panel"><div class="panel-body">
          <div class="form-row" style="margin-bottom:14px">
            <div class="form-group" style="margin:0"><label class="form-label">Employee</label>
              <select class="form-input form-select" id="ba-user">
                <option value="">Select employee</option>
                ${users.map(u=>`<option value="${u.id}">${u.name} (${u.department_name||'No dept'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0"><label class="form-label">Leave Type</label>
              <select class="form-input form-select" id="ba-type">
                ${types.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row" style="margin-bottom:14px">
            <div class="form-group" style="margin:0"><label class="form-label">Year</label>
              <input type="number" class="form-input" id="ba-year" value="${new Date().getFullYear()}" min="2020" max="2030">
            </div>
            <div class="form-group" style="margin:0"><label class="form-label">Total Days Allocation</label>
              <input type="number" class="form-input" id="ba-days" placeholder="e.g. 20" min="0" max="365">
            </div>
          </div>
          <button class="btn btn-primary" onclick="adjustBalance()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Apply Adjustment
          </button>
        </div></div>`;
    }
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function openAddDeptModal() {
  openModal('Add Department', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group" style="margin:0"><label class="form-label">Department Name *</label><input type="text" class="form-input" id="ad-name" placeholder="e.g. Customer Success"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="addDept()">Create</button>
      </div>
    </div>`);
}

async function addDept() {
  const name = document.getElementById('ad-name').value.trim();
  if (!name) { showToast('⚠️ Enter department name','warn'); return; }
  try { await Admin.createDept({ name }); showToast('✅ Department created','success'); closeModal(); renderAdminSettings(); }
  catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function editDept(id, oldName) {
  const name = prompt('New department name:', oldName);
  if (!name || name === oldName) return;
  try { await Admin.updateDept(id, { name }); showToast('✅ Renamed','success'); loadSettingsTab(); }
  catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function deleteDept(id, name) {
  if (!confirm(`Delete department "${name}"?`)) return;
  try { await Admin.deleteDept(id); showToast('Department deleted','warn'); loadSettingsTab(); }
  catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function saveLeaveType(id) {
  const days = parseInt(document.getElementById(`lt-days-${id}`).value);
  if (isNaN(days)) { showToast('⚠️ Enter valid days','warn'); return; }
  try { await Admin.updateLeaveType(id, { default_days: days }); showToast('✅ Policy updated','success'); }
  catch (err) { showToast('❌ '+err.message,'danger'); }
}

function openAddHolidayModal() {
  openModal('Add Public Holiday', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group" style="margin:0"><label class="form-label">Holiday Name *</label><input type="text" class="form-input" id="ah-name" placeholder="e.g. Diwali"></div>
      <div class="form-group" style="margin:0"><label class="form-label">Date *</label><input type="date" class="form-input" id="ah-date"></div>
      <div class="form-group" style="margin:0"><label class="form-label">Description</label><input type="text" class="form-input" id="ah-desc" placeholder="Optional description"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="addHoliday()">Add Holiday</button>
      </div>
    </div>`);
}

async function addHoliday() {
  const name = document.getElementById('ah-name').value.trim();
  const date = document.getElementById('ah-date').value;
  const desc = document.getElementById('ah-desc').value.trim();
  if (!name || !date) { showToast('⚠️ Fill name and date','warn'); return; }
  try { await Admin.addHoliday({ name, holiday_date: date, description: desc||undefined }); showToast('✅ Holiday added','success'); closeModal(); loadSettingsTab(); }
  catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function deleteHoliday(id, name) {
  if (!confirm(`Remove holiday "${name}"?`)) return;
  try { await Admin.deleteHoliday(id); showToast('Holiday removed','warn'); loadSettingsTab(); }
  catch (err) { showToast('❌ '+err.message,'danger'); }
}

async function adjustBalance() {
  const user_id       = document.getElementById('ba-user').value;
  const leave_type_id = document.getElementById('ba-type').value;
  const year          = document.getElementById('ba-year').value;
  const total_days    = document.getElementById('ba-days').value;
  if (!user_id) { showToast('⚠️ Select an employee','warn'); return; }
  if (!total_days)  { showToast('⚠️ Enter days allocation','warn'); return; }
  try {
    await Admin.adjustBalance({ user_id:parseInt(user_id), leave_type_id:parseInt(leave_type_id), year:parseInt(year), total_days:parseInt(total_days) });
    showToast('✅ Balance adjusted successfully!','success');
    document.getElementById('ba-days').value = '';
  } catch (err) { showToast('❌ '+err.message,'danger'); }
}

// ╔══════════════════════════════════════════╗
// ║  AUDIT LOG                               ║
// ╚══════════════════════════════════════════╝
let auditOffset = 0;

async function renderAudit() {
  auditOffset = 0;
  showLoader();
  try {
    const res  = await Admin.getAudit(50, 0);
    const data = res.data || [];

    setContent(`
      <div class="view active">
        <div class="sec-header">
          <div><div class="sec-title">Audit Log</div><div class="sec-sub">${res.total} total leave transactions</div></div>
          <button class="btn btn-ghost" onclick="renderAudit()">↻ Refresh</button>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Dept</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Reviewed By</th><th>Submitted</th></tr></thead>
              <tbody>
                ${data.map(r => `
                  <tr class="audit-row-${r.status}">
                    <td><div class="emp-cell">${avatarEl(r.employee_name.split(' ').map(w=>w[0]).join(''), charIndex(r.employee_name))}<div class="emp-name">${r.employee_name}</div></div></td>
                    <td style="font-size:12px;color:var(--text2)">${r.department||'—'}</td>
                    <td>${badge(typeLabel(r.code), typeBadge(r.code))}</td>
                    <td style="font-size:12px;color:var(--text2)">${fmtDateRange(r.start_date, r.end_date)}</td>
                    <td>${badge(r.working_days+'d','b-neutral')}</td>
                    <td>${badge(statusLabel(r.status), statusBadge(r.status))}</td>
                    <td style="font-size:12px;color:var(--text2)">${r.reviewed_by_name||'—'}</td>
                    <td style="font-size:11.5px;color:var(--text3)">${fmtDate(r.created_at)}</td>
                  </tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><p>No audit records</p></div></td></tr>`}
              </tbody>
            </table>
          </div>
          ${res.total > 50 ? `
            <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12.5px;color:var(--text2)">Showing ${Math.min(50,res.total)} of ${res.total}</span>
              <button class="btn btn-ghost btn-sm" onclick="loadMoreAudit()">Load More</button>
            </div>` : ''}
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

async function loadMoreAudit() {
  auditOffset += 50;
  try {
    const res  = await Admin.getAudit(50, auditOffset);
    const tbody= document.querySelector('#content-area tbody');
    if (!tbody || !res.data?.length) return;
    res.data.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = `audit-row-${r.status}`;
      tr.innerHTML = `
        <td><div class="emp-cell">${avatarEl(r.employee_name.split(' ').map(w=>w[0]).join(''), charIndex(r.employee_name))}<div class="emp-name">${r.employee_name}</div></div></td>
        <td style="font-size:12px;color:var(--text2)">${r.department||'—'}</td>
        <td>${badge(typeLabel(r.code), typeBadge(r.code))}</td>
        <td style="font-size:12px;color:var(--text2)">${fmtDateRange(r.start_date, r.end_date)}</td>
        <td>${badge(r.working_days+'d','b-neutral')}</td>
        <td>${badge(statusLabel(r.status), statusBadge(r.status))}</td>
        <td style="font-size:12px;color:var(--text2)">${r.reviewed_by_name||'—'}</td>
        <td style="font-size:11.5px;color:var(--text3)">${fmtDate(r.created_at)}</td>`;
      tbody.appendChild(tr);
    });
  } catch {}
}
