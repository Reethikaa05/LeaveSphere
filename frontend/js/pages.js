// ============================================================
//  LeaveDesk — All Page Renderers (API-connected)
// ============================================================

// ╔══════════════════════════════════════════╗
// ║  DASHBOARD                               ║
// ╚══════════════════════════════════════════╝
async function renderDashboard() {
  try {
    const [balRes, leavesRes, onLeaveRes, holidayRes] = await Promise.all([
      Users.getBalances(), Leaves.getMyLeaves({ year: new Date().getFullYear() }),
      Users.onLeaveToday(), Users.getHolidays()
    ]);

    const balances = balRes.data || [];
    const leaves   = leavesRes.data || [];
    const onLeave  = onLeaveRes.data || [];
    const holidays = holidayRes.data || [];

    const totalDays   = balances.reduce((a,b) => a + b.total_days, 0);
    const usedDays    = balances.reduce((a,b) => a + b.used_days, 0);
    const remaining   = totalDays - usedDays;
    const approved    = leaves.filter(l => l.status === 'approved').length;
    const pending     = leaves.filter(l => l.status === 'pending').length;

    const bgColors = ['linear-gradient(90deg,var(--accent),var(--accent2))','linear-gradient(90deg,var(--accent3),#818cf8)','linear-gradient(90deg,var(--warning),#f59e0b)','linear-gradient(90deg,var(--danger),#f87171)','linear-gradient(90deg,var(--success),#34d399)'];

    setContent(`
      <div class="view active">
        <div class="stat-grid">
          <div class="stat-card purple"><div class="stat-label">Leave Balance</div><div class="stat-num">${remaining}</div><div class="stat-sub">Days remaining this year</div><div class="stat-icon">🏖️</div></div>
          <div class="stat-card blue"><div class="stat-label">Days Used</div><div class="stat-num">${usedDays}</div><div class="stat-sub">Out of ${totalDays} total</div><div class="stat-icon">📅</div></div>
          <div class="stat-card green"><div class="stat-label">Approved</div><div class="stat-num">${approved}</div><div class="stat-sub">Requests this year</div><div class="stat-icon">✅</div></div>
          <div class="stat-card amber"><div class="stat-label">Pending</div><div class="stat-num">${pending}</div><div class="stat-sub">Awaiting approval</div><div class="stat-icon">⏳</div></div>
        </div>

        <div class="grid-3">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">Recent Leave Requests</div>
              <button class="panel-action" onclick="navigate('my-leaves',null)">View all →</button>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Type</th><th>Duration</th><th>Days</th><th>Status</th></tr></thead>
                <tbody>
                  ${leaves.slice(0,5).map(r => `
                    <tr onclick="showLeaveDetail(${r.id})" style="cursor:pointer">
                      <td>${badge(typeLabel(r.leave_type_code || r.leave_type_name), typeBadge(r.leave_type_code))}</td>
                      <td style="font-size:12px;color:var(--text2)">${fmtDateRange(r.start_date, r.end_date)}</td>
                      <td>${badge(r.working_days+'d','b-neutral')}</td>
                      <td>${badge(statusLabel(r.status), statusBadge(r.status))}</td>
                    </tr>`).join('') || `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📋</div><p>No leave requests yet</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><div class="panel-title">Leave Balances</div></div>
            <div class="panel-body">
              <div class="balance-list">
                ${balances.map((b,i) => `
                  <div class="balance-item">
                    <div class="balance-info">
                      <div class="balance-name">${b.leave_type_name}</div>
                      ${progressBar(b.used_days, b.total_days, bgColors[i % bgColors.length])}
                      <div class="balance-used">${b.used_days} used of ${b.total_days} days</div>
                    </div>
                    <div class="balance-num">${b.remaining_days}</div>
                  </div>`).join('') || '<p style="color:var(--text2);font-size:13px">No balances found</p>'}
              </div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div class="panel-title">Team — On Leave Today</div></div>
            <div class="panel-body">
              ${onLeave.length ? `<div style="display:flex;flex-direction:column;gap:13px">
                ${onLeave.map((u,i) => `
                  <div class="emp-cell">
                    ${avatarEl(u.avatar_initials, i, 34)}
                    <div>
                      <div class="emp-name">${u.name}</div>
                      <div class="emp-dept">${typeEmoji(u.leave_type)} ${u.leave_type} • Returns ${fmtDate(u.end_date)}</div>
                    </div>
                  </div>`).join('')}
              </div>` : `<div class="empty-state" style="padding:20px"><div class="empty-icon">🎉</div><p>Everyone's in today!</p></div>`}
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><div class="panel-title">Upcoming Holidays</div></div>
            <div class="panel-body" style="padding-top:12px">
              ${holidays.slice(0,6).map(h => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                  <span style="font-size:13px">${h.name}</span>
                  <span style="font-size:11.5px;color:var(--text2);font-family:var(--font)">${fmtDate(h.holiday_date)}</span>
                </div>`).join('') || '<p style="color:var(--text2);font-size:13px">No holidays found</p>'}
            </div>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

// ╔══════════════════════════════════════════╗
// ║  MY LEAVES                               ║
// ╚══════════════════════════════════════════╝
async function renderMyLeaves() {
  try {
    const res = await Leaves.getMyLeaves();
    const leaves = res.data || [];
    const approved = leaves.filter(l=>l.status==='approved');
    const pending  = leaves.filter(l=>l.status==='pending');
    const rejected = leaves.filter(l=>l.status==='rejected'||l.status==='cancelled');
    const totalUsed= approved.reduce((a,b)=>a+b.working_days,0);

    setContent(`
      <div class="view active">
        <div class="sec-header">
          <div><div class="sec-title">My Leave History</div><div class="sec-sub">All submitted requests</div></div>
          <button class="btn btn-primary" onclick="navigate('apply',null)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Apply Leave
          </button>
        </div>
        <div class="stat-grid" style="margin-bottom:18px">
          <div class="stat-card green"><div class="stat-label">Approved</div><div class="stat-num">${approved.length}</div><div class="stat-sub">${approved.reduce((a,b)=>a+b.working_days,0)} days total</div></div>
          <div class="stat-card amber"><div class="stat-label">Pending</div><div class="stat-num">${pending.length}</div><div class="stat-sub">Awaiting review</div></div>
          <div class="stat-card red"><div class="stat-label">Rejected</div><div class="stat-num">${rejected.length}</div><div class="stat-sub">Not approved</div></div>
          <div class="stat-card blue"><div class="stat-label">Days Taken</div><div class="stat-num">${totalUsed}</div><div class="stat-sub">Working days this year</div></div>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${leaves.length ? leaves.map(r => `
                  <tr>
                    <td>${badge(typeLabel(r.leave_type_code), typeBadge(r.leave_type_code))}</td>
                    <td style="font-size:12.5px">${fmtDate(r.start_date)}</td>
                    <td style="font-size:12.5px">${fmtDate(r.end_date)}</td>
                    <td>${badge(r.working_days+'d','b-neutral')}</td>
                    <td style="font-size:12.5px;color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.reason}</td>
                    <td>${badge(statusLabel(r.status), statusBadge(r.status))}</td>
                    <td>
                      ${r.status==='pending'
                        ? `<button class="btn btn-danger btn-sm" onclick="cancelLeave(${r.id})">Cancel</button>`
                        : `<button class="btn btn-ghost btn-sm" onclick="showLeaveDetail(${r.id})">View</button>`}
                    </td>
                  </tr>`).join('')
                  : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No leave requests found. <a href="#" onclick="navigate('apply',null)" style="color:var(--accent2)">Apply now →</a></p></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

// ╔══════════════════════════════════════════╗
// ║  APPLY LEAVE                             ║
// ╚══════════════════════════════════════════╝
async function renderApply() {
  try {
    if (!leaveTypesCache) {
      const res = await Users.getLeaveTypes();
      leaveTypesCache = res.data || [];
    }
    const today = todayStr();

    setContent(`
      <div class="view active">
        <div style="max-width:600px">
          <div class="sec-header">
            <div><div class="sec-title">Apply for Leave</div><div class="sec-sub">Submit a new leave request for manager approval</div></div>
          </div>
          <div class="panel" style="margin-bottom:14px">
            <div class="panel-body">
              <div class="form-group">
                <label class="form-label">Leave Type <span style="color:var(--danger)">*</span></label>
                <select class="form-input form-select" id="f-type">
                  <option value="">— Select leave type —</option>
                  ${leaveTypesCache.map(lt => `<option value="${lt.id}" data-code="${lt.code}">${typeEmoji(lt.code)} ${lt.name} (${lt.default_days} days/year)</option>`).join('')}
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Start Date <span style="color:var(--danger)">*</span></label>
                  <input type="date" class="form-input" id="f-start" value="${today}" oninput="calcDaysPreview()">
                </div>
                <div class="form-group">
                  <label class="form-label">End Date <span style="color:var(--danger)">*</span></label>
                  <input type="date" class="form-input" id="f-end" value="${today}" oninput="calcDaysPreview()">
                </div>
              </div>
              <div class="days-preview" id="days-preview" style="display:none;margin-bottom:16px">
                <div style="font-size:20px">📅</div>
                <div>
                  <div class="days-count-text" id="days-count-text">1 working day</div>
                  <div class="days-count-sub">Weekends and holidays excluded</div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Reason <span style="color:var(--danger)">*</span></label>
                <textarea class="form-input" id="f-reason" placeholder="Briefly describe your reason..."></textarea>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Emergency Contact <span class="opt">(optional)</span></label>
                <input type="text" class="form-input" id="f-contact" placeholder="Name and phone number">
              </div>
              <div class="form-footer">
                <button class="btn btn-ghost" onclick="navigate('my-leaves',null)">Cancel</button>
                <button class="btn btn-primary" id="submit-btn" onclick="submitLeave()">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Submit Request
                </button>
              </div>
            </div>
          </div>
          <div class="info-box">
            <span style="font-size:18px;flex-shrink:0">ℹ️</span>
            <div>Submit vacation leave at least <strong>3 working days</strong> in advance. Sick leave can be applied same-day. All requests require manager approval.
            </div>
          </div>
        </div>
      </div>
    `);
    calcDaysPreview();
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

function calcDaysPreview() {
  const s = document.getElementById('f-start')?.value;
  const e = document.getElementById('f-end')?.value;
  const days = workingDays(s, e);
  const prev = document.getElementById('days-preview');
  if (!prev) return;
  if (days > 0) {
    document.getElementById('days-count-text').textContent = `${days} working day${days>1?'s':''}`;
    prev.style.display = 'flex';
  } else { prev.style.display = 'none'; }
}

async function submitLeave() {
  const typeEl   = document.getElementById('f-type');
  const start    = document.getElementById('f-start').value;
  const end      = document.getElementById('f-end').value;
  const reason   = document.getElementById('f-reason').value.trim();
  const contact  = document.getElementById('f-contact').value.trim();
  const btn      = document.getElementById('submit-btn');

  if (!typeEl.value)  { showToast('⚠️ Select a leave type','warn'); return; }
  if (!start||!end)   { showToast('⚠️ Select start and end dates','warn'); return; }
  if (!reason)        { showToast('⚠️ Please provide a reason','warn'); return; }

  btn.textContent = 'Submitting...'; btn.disabled = true;
  try {
    const res = await Leaves.submit({
      leave_type_id: parseInt(typeEl.value), start_date: start, end_date: end,
      reason, emergency_contact: contact || undefined
    });
    showToast(`✅ Leave request submitted! (${res.data.working_days} working days)`, 'success');
    navigate('my-leaves', null);
  } catch (err) {
    showToast('❌ ' + err.message, 'danger');
    btn.textContent = 'Submit Request'; btn.disabled = false;
  }
}

async function cancelLeave(id) {
  if (!confirm('Cancel this leave request?')) return;
  try {
    await Leaves.cancel(id);
    showToast('Leave request cancelled', 'warn');
    renderMyLeaves();
  } catch (err) { showToast('❌ ' + err.message, 'danger'); }
}

async function showLeaveDetail(id) {
  try {
    const res = await Leaves.getById(id);
    const r = res.data;
    openModal(`${typeEmoji(r.leave_type_code)} ${r.leave_type_name}`, `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between">
          ${badge(r.leave_type_name, typeBadge(r.leave_type_code))}
          ${badge(statusLabel(r.status), statusBadge(r.status))}
        </div>
        <div style="background:var(--bg3);border-radius:var(--r2);padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Start Date</div><div style="font-size:14px;font-weight:500">${fmtDate(r.start_date)}</div></div>
          <div><div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">End Date</div><div style="font-size:14px;font-weight:500">${fmtDate(r.end_date)}</div></div>
          <div><div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Duration</div><div style="font-size:15px;font-weight:700;font-family:var(--font)">${r.working_days} day${r.working_days>1?'s':''}</div></div>
          <div><div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Submitted</div><div style="font-size:13.5px">${fmtDate(r.created_at)}</div></div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Reason</div>
          <div style="font-size:13.5px;color:var(--text2);line-height:1.65;background:var(--bg3);padding:12px 14px;border-radius:var(--r2)">${r.reason}</div>
        </div>
        ${r.review_comment ? `<div><div style="font-size:10px;color:var(--text3);font-family:var(--font);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Manager Comment</div><div style="font-size:13px;color:var(--text2);background:var(--bg3);padding:12px 14px;border-radius:var(--r2)">${r.review_comment}</div></div>` : ''}
        <div style="display:flex;gap:9px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border)">
          <button class="btn btn-ghost" onclick="closeModal()">Close</button>
          ${r.status==='pending'?`<button class="btn btn-danger" onclick="cancelLeave(${r.id});closeModal()">Cancel Request</button>`:''}
        </div>
      </div>`);
  } catch (err) { showToast('❌ ' + err.message, 'danger'); }
}

// ╔══════════════════════════════════════════╗
// ║  CALENDAR                                ║
// ╚══════════════════════════════════════════╝
async function renderCalendarPage() {
  setContent(`<div class="view active" id="cal-view">
    <div class="loading-inline"><div class="spinner-sm"></div>Loading calendar...</div>
  </div>`);
  try {
    const y = calDate.getFullYear(), m = calDate.getMonth() + 1;
    const [calRes, onLeaveRes, holidayRes] = await Promise.all([
      Users.getCalendar(y, m), Users.onLeaveToday(), Users.getHolidays(y)
    ]);

    const calEvents  = calRes.data || [];
    const onLeave    = onLeaveRes.data || [];
    const holidays   = holidayRes.data || [];

    // Build set of leave days for the month
    const leaveDaySet = new Set();
    calEvents.forEach(ev => {
      const s = new Date(ev.start_date), e = new Date(ev.end_date);
      const cur = new Date(s);
      while(cur <= e) {
        if(cur.getUTCMonth()+1 === m) leaveDaySet.add(cur.getUTCDate());
        cur.setUTCDate(cur.getUTCDate()+1);
      }
    });

    const today = new Date();
    const firstDay = new Date(y, calDate.getMonth(), 1).getDay();
    const daysInM  = new Date(y, calDate.getMonth()+1, 0).getDate();

    const calHTML = `
      <div class="cal-nav">
        <div class="cal-arrow" onclick="calChange(-1)">&#8249;</div>
        <div class="cal-month">${MONTHS[calDate.getMonth()]} ${y}</div>
        <div class="cal-arrow" onclick="calChange(1)">&#8250;</div>
      </div>
      <div class="cal-grid">
        ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="cal-day-label">${d}</div>`).join('')}
        ${Array(firstDay).fill('<div class="cal-day empty"></div>').join('')}
        ${Array.from({length:daysInM},(_,i)=>{
          const d=i+1, dow=(firstDay+i)%7;
          const isToday = d===today.getDate()&&calDate.getMonth()===today.getMonth()&&y===today.getFullYear();
          const isLeave = leaveDaySet.has(d);
          const isWeekend = dow===0||dow===6;
          return `<div class="cal-day${isToday?' today':''}${isLeave?' has-leave':''}${isWeekend?' weekend':''}">${d}</div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2)"><div style="width:8px;height:8px;border-radius:50%;background:var(--success)"></div>Leave</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text2)"><div style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></div>Today</div>
      </div>`;

    setContent(`
      <div class="view active">
        <div class="sec-header">
          <div><div class="sec-title">Leave Calendar</div><div class="sec-sub">Team schedule and availability</div></div>
        </div>
        <div class="grid-2" style="gap:18px">
          <div class="panel"><div class="panel-body">${calHTML}</div></div>
          <div>
            <div class="panel" style="margin-bottom:14px">
              <div class="panel-head"><div class="panel-title">On Leave Today (${onLeave.length})</div></div>
              <div class="panel-body" style="padding-top:12px">
                ${onLeave.length ? `<div style="display:flex;flex-direction:column;gap:12px">
                  ${onLeave.map((u,i)=>`<div class="emp-cell">${avatarEl(u.avatar_initials,i,32)}<div><div class="emp-name">${u.name}</div><div class="emp-dept">${typeEmoji(u.leave_type)} ${u.leave_type} • Until ${fmtDate(u.end_date)}</div></div></div>`).join('')}
                </div>` : `<div style="color:var(--text2);font-size:13px;text-align:center;padding:12px 0">Everyone's in today 🎉</div>`}
              </div>
            </div>
            <div class="panel">
              <div class="panel-head"><div class="panel-title">Public Holidays ${y}</div></div>
              <div class="panel-body" style="padding-top:10px">
                ${holidays.map(h=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px">${h.name}</span><span style="font-size:11.5px;color:var(--text2);font-family:var(--font)">${fmtDate(h.holiday_date)}</span></div>`).join('') || '<p style="color:var(--text2);font-size:13px">No holidays found</p>'}
              </div>
            </div>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

function calChange(dir) { calDate.setMonth(calDate.getMonth()+dir); renderCalendarPage(); }

// ╔══════════════════════════════════════════╗
// ║  APPROVALS                               ║
// ╚══════════════════════════════════════════╝
async function renderApprovals() {
  try {
    const res  = await Leaves.getPending();
    const reqs = res.data || [];

    setContent(`
      <div class="view active">
        <div class="sec-header">
          <div><div class="sec-title">Leave Approvals</div><div class="sec-sub">Review pending requests</div></div>
          <span class="badge2 b-pending" style="font-size:12px;padding:6px 16px">
            <span class="pulse">●</span>&nbsp;
            <span id="pending-label">${reqs.length} Pending</span>
          </span>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Duration</th><th>Days</th><th>Reason</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody id="approvals-tbody">
                ${reqs.length ? reqs.map((r,i) => `
                  <tr id="arow-${r.id}">
                    <td><div class="emp-cell">${avatarEl(r.avatar_initials,i)}<div><div class="emp-name">${r.employee_name}</div><div class="emp-dept">${r.department||''}</div></div></div></td>
                    <td>${badge(typeLabel(r.leave_code), typeBadge(r.leave_code))}</td>
                    <td style="font-size:12px;color:var(--text2)">${fmtDateRange(r.start_date,r.end_date)}</td>
                    <td>${badge(r.working_days+'d','b-neutral')}</td>
                    <td style="font-size:12.5px;color:var(--text2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.reason}</td>
                    <td style="font-size:11.5px;color:var(--text3)">${fmtDate(r.submitted_at)}</td>
                    <td><div style="display:flex;gap:7px">
                      <button class="btn btn-success btn-sm" onclick="approveReq(${r.id})">✓ Approve</button>
                      <button class="btn btn-danger btn-sm" onclick="rejectReq(${r.id})">✕ Reject</button>
                    </div></td>
                  </tr>`).join('')
                  : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🎉</div><p>No pending requests!</p></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

async function approveReq(id) {
  const comment = prompt('Approval comment (optional):') || '';
  try {
    await Leaves.approve(id, comment);
    document.getElementById('arow-'+id)?.remove();
    showToast('✅ Leave approved!', 'success');
    loadPendingCount();
    const label = document.getElementById('pending-label');
    if (label) { const c=parseInt(label.textContent)-1; label.textContent=c+' Pending'; }
  } catch (err) { showToast('❌ '+err.message, 'danger'); }
}

async function rejectReq(id) {
  const comment = prompt('Rejection reason (optional):') || '';
  try {
    await Leaves.reject(id, comment);
    document.getElementById('arow-'+id)?.remove();
    showToast('Request rejected', 'warn');
    loadPendingCount();
    const label = document.getElementById('pending-label');
    if (label) { const c=Math.max(0,parseInt(label.textContent)-1); label.textContent=c+' Pending'; }
  } catch (err) { showToast('❌ '+err.message, 'danger'); }
}

// ╔══════════════════════════════════════════╗
// ║  TEAM                                    ║
// ╚══════════════════════════════════════════╝
async function renderTeam() {
  try {
    const [teamRes, pendRes] = await Promise.all([Users.getTeam(), Leaves.getPending()]);
    const team    = teamRes.data || [];
    const pending = pendRes.count || 0;
    const onLeave = team.filter(u=>u.is_on_leave).length;
    const avgUsed = team.length ? Math.round(team.reduce((a,u)=>a+parseInt(u.total_used_days||0),0)/team.length) : 0;

    setContent(`
      <div class="view active">
        <div class="sec-header"><div><div class="sec-title">Team Overview</div><div class="sec-sub">Employee leave balances and status</div></div></div>
        <div class="stat-grid" style="margin-bottom:18px">
          <div class="stat-card purple"><div class="stat-label">Total Employees</div><div class="stat-num">${team.length}</div><div class="stat-sub">Active headcount</div><div class="stat-icon">👥</div></div>
          <div class="stat-card blue"><div class="stat-label">On Leave Today</div><div class="stat-num">${onLeave}</div><div class="stat-sub">Currently absent</div><div class="stat-icon">🏖️</div></div>
          <div class="stat-card green"><div class="stat-label">Avg Days Used</div><div class="stat-num">${avgUsed}</div><div class="stat-sub">This year</div><div class="stat-icon">📊</div></div>
          <div class="stat-card amber"><div class="stat-label">Pending</div><div class="stat-num">${pending}</div><div class="stat-sub">Need review</div><div class="stat-icon">⏳</div></div>
        </div>
        <div class="panel">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Department</th><th>Vacation</th><th>Sick</th><th>Personal</th><th>Total Used</th><th>Status</th></tr></thead>
              <tbody>
                ${team.map((e,i) => {
                  const vac  = e.balances?.vacation || {used:0,total:15};
                  const sick = e.balances?.sick      || {used:0,total:7};
                  const per  = e.balances?.personal  || {used:0,total:3};
                  return `<tr>
                    <td><div class="emp-cell">${avatarEl(e.avatar_initials,i)}<div class="emp-name">${e.name}</div></div></td>
                    <td style="font-size:12px;color:var(--text2)">${e.department||'—'}</td>
                    <td><div class="stat-mini"><span class="num">${vac.used}</span><span class="denom">/${vac.total}</span></div></td>
                    <td><div class="stat-mini"><span class="num">${sick.used}</span><span class="denom">/${sick.total}</span></div></td>
                    <td><div class="stat-mini"><span class="num">${per.used}</span><span class="denom">/${per.total}</span></div></td>
                    <td><div class="stat-mini"><span class="num" style="font-size:16px">${e.total_used_days||0}</span><span class="denom">days</span></div></td>
                    <td>${badge(e.is_on_leave?'On Leave':'Active', e.is_on_leave?'b-onleave':'b-active')}</td>
                  </tr>`;
                }).join('') || `<tr><td colspan="7"><div class="empty-state"><p>No team members found</p></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}

// ╔══════════════════════════════════════════╗
// ║  REPORTS                                 ║
// ╚══════════════════════════════════════════╝
async function renderReports() {
  try {
    const res  = await Users.getReports();
    const { summary, byType, byMonth } = res.data;
    const approvalRate = summary.total_requests > 0
      ? Math.round((summary.approved / summary.total_requests) * 100) : 0;
    const maxMonth = Math.max(...byMonth.map(m=>m.days_taken||0), 1);
    const bgColors = ['linear-gradient(90deg,var(--accent),var(--accent2))','linear-gradient(90deg,var(--accent3),#818cf8)','linear-gradient(90deg,var(--warning),#f59e0b)','linear-gradient(90deg,var(--danger),#f87171)','linear-gradient(90deg,var(--success),#34d399)'];
    const peakMonth = byMonth.reduce((a,b)=>(b.days_taken>=(a.days_taken||0)?b:a), {month_name:'—'});

    setContent(`
      <div class="view active">
        <div class="sec-header"><div><div class="sec-title">Reports & Analytics</div><div class="sec-sub">Leave data for ${new Date().getFullYear()}</div></div></div>
        <div class="stat-grid" style="margin-bottom:22px">
          <div class="stat-card purple"><div class="stat-label">Total Leave Days</div><div class="stat-num">${summary.total_days_taken||0}</div><div class="stat-sub">Company-wide this year</div><div class="stat-icon">📊</div></div>
          <div class="stat-card blue"><div class="stat-label">Total Requests</div><div class="stat-num">${summary.total_requests||0}</div><div class="stat-sub">Submitted this year</div><div class="stat-icon">📋</div></div>
          <div class="stat-card green"><div class="stat-label">Approval Rate</div><div class="stat-num">${approvalRate}%</div><div class="stat-sub">Of all requests</div><div class="stat-icon">✅</div></div>
          <div class="stat-card amber"><div class="stat-label">Peak Month</div><div class="stat-num">${(peakMonth.month_name||'—').slice(0,3)}</div><div class="stat-sub">Highest leave volume</div><div class="stat-icon">📈</div></div>
        </div>
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div class="panel-title">Leave by Type</div></div>
            <div class="panel-body">
              ${byType.map((t,i) => `
                <div style="margin-bottom:16px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:13px;color:var(--text2)">${typeEmoji(t.code)} ${t.name}</span>
                    <span style="font-family:var(--font);font-weight:700;font-size:13px">${t.days_taken} days</span>
                  </div>
                  ${progressBar(t.days_taken, Math.max(...byType.map(x=>x.days_taken),1), bgColors[i%bgColors.length])}
                </div>`).join('') || '<p style="color:var(--text2);font-size:13px">No data</p>'}
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><div class="panel-title">Monthly Distribution</div></div>
            <div class="panel-body">
              ${byMonth.map(m => `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12.5px">
                  <span style="width:28px;color:var(--text3);font-family:var(--font);font-size:11px">${(m.month_name||'').slice(0,3)}</span>
                  <div class="progress-wrap" style="flex:1">
                    <div class="progress-bar" style="width:${Math.round((m.days_taken/maxMonth)*100)}%;background:${m.days_taken===maxMonth?'linear-gradient(90deg,var(--accent2),var(--accent))':'var(--accent)'}"></div>
                  </div>
                  <span style="width:22px;text-align:right;font-family:var(--font);font-weight:700;font-size:12px">${m.days_taken}</span>
                </div>`).join('') || '<p style="color:var(--text2);font-size:13px">No data yet</p>'}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Request Status Breakdown</div></div>
          <div class="panel-body">
            <div style="display:flex;gap:30px;flex-wrap:wrap">
              ${[
                {label:'Approved', count:summary.approved||0, cls:'b-approved', bg:'var(--success)'},
                {label:'Pending',  count:summary.pending||0,  cls:'b-pending',  bg:'var(--warning)'},
                {label:'Rejected', count:summary.rejected||0, cls:'b-rejected', bg:'var(--danger)'},
              ].map(s => `
                <div style="flex:1;min-width:120px">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    ${badge(s.label, s.cls)}
                    <span style="font-family:var(--font);font-weight:700;font-size:18px">${s.count}</span>
                  </div>
                  ${progressBar(s.count, summary.total_requests||1, s.bg)}
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`);
  }
}
