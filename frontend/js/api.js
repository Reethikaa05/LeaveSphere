// ============================================================
//  LeaveDesk — API Service Layer v2 (fixed)
// ============================================================
const API_BASE = 'http://localhost:5000/api';

function getToken()   { return localStorage.getItem('ld_token'); }
function setToken(t)  { localStorage.setItem('ld_token', t); }
function removeToken(){ localStorage.removeItem('ld_token'); localStorage.removeItem('ld_user'); }
function getUser()    { return JSON.parse(localStorage.getItem('ld_user') || 'null'); }
function setUser(u)   { localStorage.setItem('ld_user', JSON.stringify(u)); }

// ── CORE FETCH ────────────────────────────────────────────
async function apiFetch(path, options) {
  options = options || {};
  var token   = getToken();
  var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var res, data;
  try {
    res  = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
    data = await res.json();
  } catch (netErr) {
    throw new Error('Cannot connect to backend. Make sure the backend server is running on port 5000.');
  }

  // Only force logout on 401 for protected routes — NOT on the login call itself
  var isLoginCall = (path === '/auth/login');
  if (res.status === 401 && !isLoginCall) {
    removeToken();
    if (typeof showLoginPage === 'function') showLoginPage();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    var msg = (data && data.message) || (data && data.errors && data.errors[0] && data.errors[0].msg) || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

function apiGet(path)         { return apiFetch(path); }
function apiPost(path, body)  { return apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }); }
function apiPut(path, body)   { return apiFetch(path, { method: 'PUT',    body: JSON.stringify(body || {}) }); }
function apiDelete(path)      { return apiFetch(path, { method: 'DELETE' }); }

// ── AUTH ──────────────────────────────────────────────────
var Auth = {
  login:          function(email, password) { return apiPost('/auth/login', { email: email, password: password }); },
  me:             function()               { return apiGet('/auth/me'); },
  changePassword: function(cp, np)         { return apiPost('/auth/change-password', { current_password: cp, new_password: np }); },
  register:       function(d)              { return apiPost('/auth/register', d); },
};

// ── LEAVES ────────────────────────────────────────────────
var Leaves = {
  getMyLeaves: function(p) { return apiGet('/leaves?' + new URLSearchParams(p || {})); },
  getAll:      function(p) { return apiGet('/leaves/all?' + new URLSearchParams(p || {})); },
  getPending:  function()  { return apiGet('/leaves/pending'); },
  getById:     function(id){ return apiGet('/leaves/' + id); },
  submit:      function(d) { return apiPost('/leaves', d); },
  cancel:      function(id){ return apiPut('/leaves/' + id + '/cancel'); },
  approve:     function(id, c) { return apiPut('/leaves/' + id + '/approve', { comment: c }); },
  reject:      function(id, c) { return apiPut('/leaves/' + id + '/reject',  { comment: c }); },
};

// ── USERS ─────────────────────────────────────────────────
var Users = {
  getBalances:    function(y)    { return apiGet('/users/balances'  + (y ? '?year=' + y : '')); },
  getTeam:        function(y)    { return apiGet('/users/team'      + (y ? '?year=' + y : '')); },
  onLeaveToday:   function()     { return apiGet('/users/on-leave-today'); },
  getDepartments: function()     { return apiGet('/users/departments'); },
  getLeaveTypes:  function()     { return apiGet('/users/leave-types'); },
  getHolidays:    function(y)    { return apiGet('/users/holidays'  + (y ? '?year=' + y : '')); },
  getCalendar:    function(y, m) { return apiGet('/users/calendar?year=' + y + '&month=' + m); },
  getReports:     function(y)    { return apiGet('/users/reports'   + (y ? '?year=' + y : '')); },
};

// ── ADMIN ─────────────────────────────────────────────────
var Admin = {
  getStats:        function()       { return apiGet('/admin/stats'); },
  getUsers:        function()       { return apiGet('/admin/users'); },
  createUser:      function(d)      { return apiPost('/admin/users', d); },
  updateUser:      function(id, d)  { return apiPut('/admin/users/' + id, d); },
  deleteUser:      function(id)     { return apiDelete('/admin/users/' + id); },
  getDepts:        function()       { return apiGet('/admin/departments'); },
  createDept:      function(d)      { return apiPost('/admin/departments', d); },
  updateDept:      function(id, d)  { return apiPut('/admin/departments/' + id, d); },
  deleteDept:      function(id)     { return apiDelete('/admin/departments/' + id); },
  getLeaveTypes:   function()       { return apiGet('/admin/leave-types'); },
  updateLeaveType: function(id, d)  { return apiPut('/admin/leave-types/' + id, d); },
  getHolidays:     function()       { return apiGet('/admin/holidays'); },
  addHoliday:      function(d)      { return apiPost('/admin/holidays', d); },
  deleteHoliday:   function(id)     { return apiDelete('/admin/holidays/' + id); },
  adjustBalance:   function(d)      { return apiPost('/admin/balance-adjust', d); },
  getAudit:        function(l, o)   { return apiGet('/admin/audit?limit=' + (l || 50) + '&offset=' + (o || 0)); },
};

// ── NOTIFICATIONS ─────────────────────────────────────────
var Notifications = {
  getAll: function() { return apiGet('/notifications'); },
};
