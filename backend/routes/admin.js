// ============================================================
//  LeaveDesk — Admin Routes  (/api/admin)
// ============================================================
const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { authenticate, requireManager, requireAdmin } = require('../middleware/auth');

const router = express.Router();
// All admin routes require authentication + manager/admin
router.use(authenticate, requireManager);

// ── GET /api/admin/stats ──────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[users]]    = await db.query('SELECT COUNT(*) AS c FROM users WHERE is_active=1');
    const [[pending]]  = await db.query("SELECT COUNT(*) AS c FROM leave_requests WHERE status='pending'");
    const [[onleave]]  = await db.query("SELECT COUNT(*) AS c FROM leave_requests WHERE status='approved' AND CURDATE() BETWEEN start_date AND end_date");
    const [[thisMonth]]= await db.query("SELECT COALESCE(SUM(working_days),0) AS c FROM leave_requests WHERE status='approved' AND MONTH(start_date)=MONTH(CURDATE()) AND YEAR(start_date)=YEAR(CURDATE())");
    return res.json({ success:true, data:{ total_employees: users.c, pending_requests: pending.c, on_leave_today: onleave.c, days_this_month: thisMonth.c }});
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── GET /api/admin/users ──────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_initials, u.joining_date, u.is_active,
              d.name AS department_name, m.name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id=u.department_id
       LEFT JOIN users m ON m.id=u.manager_id
       ORDER BY u.name`
    );
    return res.json({ success:true, data: rows });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── POST /api/admin/users ─────────────────────────────────
router.post('/users', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min:6 }),
  body('role').isIn(['employee','manager','admin']),
  body('department_id').optional().isInt(),
  body('manager_id').optional().isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, errors: errors.array() });

  const { name, email, password, role, department_id, manager_id } = req.body;
  try {
    const [exists] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (exists.length) return res.status(409).json({ success:false, message:'Email already exists' });

    const hash     = await bcrypt.hash(password, 10);
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const [result] = await db.query(
      `INSERT INTO users (name,email,password_hash,role,department_id,manager_id,avatar_initials) VALUES (?,?,?,?,?,?,?)`,
      [name, email, hash, role, department_id||null, manager_id||null, initials]
    );
    // Create default balances
    const year = new Date().getFullYear();
    const [types] = await db.query('SELECT id,default_days FROM leave_types');
    if (types.length) {
      await db.query('INSERT INTO leave_balances (user_id,leave_type_id,year,total_days,used_days) VALUES ?',
        [types.map(t=>[result.insertId, t.id, year, t.default_days, 0])]);
    }
    return res.status(201).json({ success:true, message:'User created', userId: result.insertId });
  } catch(err){ console.error(err); return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── PUT /api/admin/users/:id ──────────────────────────────
router.put('/users/:id', [
  body('name').optional().notEmpty().trim(),
  body('role').optional().isIn(['employee','manager','admin']),
  body('is_active').optional().isBoolean(),
  body('department_id').optional().isInt(),
], async (req, res) => {
  const { name, role, department_id, manager_id, is_active } = req.body;
  const fields=[]; const vals=[];
  if(name!==undefined){ fields.push('name=?'); vals.push(name); }
  if(role!==undefined){ fields.push('role=?'); vals.push(role); }
  if(department_id!==undefined){ fields.push('department_id=?'); vals.push(department_id||null); }
  if(manager_id!==undefined){ fields.push('manager_id=?'); vals.push(manager_id||null); }
  if(is_active!==undefined){ fields.push('is_active=?'); vals.push(is_active?1:0); }
  if(!fields.length) return res.status(400).json({ success:false, message:'Nothing to update' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals);
    return res.json({ success:true, message:'User updated' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── DELETE /api/admin/users/:id ───────────────────────────
router.delete('/users/:id', async (req, res) => {
  if(parseInt(req.params.id)===req.user.id)
    return res.status(400).json({ success:false, message:"You can't deactivate yourself" });
  try {
    await db.query('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
    return res.json({ success:true, message:'User deactivated' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── GET /api/admin/departments ────────────────────────────
router.get('/departments', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, COUNT(u.id) AS employee_count
       FROM departments d LEFT JOIN users u ON u.department_id=d.id AND u.is_active=1
       GROUP BY d.id ORDER BY d.name`
    );
    return res.json({ success:true, data: rows });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── POST /api/admin/departments ───────────────────────────
router.post('/departments', [ body('name').notEmpty().trim() ], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, errors: errors.array() });
  try {
    const [r] = await db.query('INSERT INTO departments (name) VALUES (?)', [req.body.name]);
    return res.status(201).json({ success:true, message:'Department created', id: r.insertId });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── PUT /api/admin/departments/:id ────────────────────────
router.put('/departments/:id', [ body('name').notEmpty().trim() ], async (req, res) => {
  try {
    await db.query('UPDATE departments SET name=? WHERE id=?', [req.body.name, req.params.id]);
    return res.json({ success:true, message:'Department updated' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── DELETE /api/admin/departments/:id ─────────────────────
router.delete('/departments/:id', async (req, res) => {
  try {
    const [[{c}]] = await db.query('SELECT COUNT(*) AS c FROM users WHERE department_id=?', [req.params.id]);
    if(c>0) return res.status(400).json({ success:false, message:`Cannot delete — ${c} employees assigned` });
    await db.query('DELETE FROM departments WHERE id=?', [req.params.id]);
    return res.json({ success:true, message:'Department deleted' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── GET /api/admin/leave-types ────────────────────────────
router.get('/leave-types', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM leave_types ORDER BY id');
    return res.json({ success:true, data: rows });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── PUT /api/admin/leave-types/:id ───────────────────────
router.put('/leave-types/:id', [
  body('name').optional().notEmpty().trim(),
  body('default_days').optional().isInt({ min:0, max:365 }),
  body('description').optional().trim(),
], async (req, res) => {
  const { name, default_days, description } = req.body;
  const fields=[]; const vals=[];
  if(name!==undefined){ fields.push('name=?'); vals.push(name); }
  if(default_days!==undefined){ fields.push('default_days=?'); vals.push(default_days); }
  if(description!==undefined){ fields.push('description=?'); vals.push(description); }
  if(!fields.length) return res.status(400).json({ success:false, message:'Nothing to update' });
  vals.push(req.params.id);
  try {
    await db.query(`UPDATE leave_types SET ${fields.join(',')} WHERE id=?`, vals);
    return res.json({ success:true, message:'Leave type updated' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── GET /api/admin/holidays ───────────────────────────────
router.get('/holidays', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM holidays ORDER BY holiday_date');
    return res.json({ success:true, data: rows });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── POST /api/admin/holidays ──────────────────────────────
router.post('/holidays', [
  body('name').notEmpty().trim(),
  body('holiday_date').isDate(),
  body('description').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, errors: errors.array() });
  try {
    const [r] = await db.query(
      'INSERT INTO holidays (name,holiday_date,description) VALUES (?,?,?)',
      [req.body.name, req.body.holiday_date, req.body.description||null]
    );
    return res.status(201).json({ success:true, message:'Holiday added', id: r.insertId });
  } catch(err){
    if(err.code==='ER_DUP_ENTRY') return res.status(409).json({ success:false, message:'Holiday on this date already exists' });
    return res.status(500).json({ success:false, message:'Server error' });
  }
});

// ── DELETE /api/admin/holidays/:id ───────────────────────
router.delete('/holidays/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM holidays WHERE id=?', [req.params.id]);
    return res.json({ success:true, message:'Holiday removed' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── POST /api/admin/balance-adjust ───────────────────────
router.post('/balance-adjust', [
  body('user_id').isInt(),
  body('leave_type_id').isInt(),
  body('year').isInt({ min:2020, max:2030 }),
  body('total_days').isInt({ min:0, max:365 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success:false, errors: errors.array() });
  const { user_id, leave_type_id, year, total_days } = req.body;
  try {
    await db.query(
      `INSERT INTO leave_balances (user_id,leave_type_id,year,total_days,used_days)
       VALUES (?,?,?,?,0) ON DUPLICATE KEY UPDATE total_days=?`,
      [user_id, leave_type_id, year, total_days, total_days]
    );
    return res.json({ success:true, message:'Balance adjusted successfully' });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

// ── GET /api/admin/audit  (leave history all) ─────────────
router.get('/audit', async (req, res) => {
  const limit  = parseInt(req.query.limit)  || 50;
  const offset = parseInt(req.query.offset) || 0;
  try {
    const [rows] = await db.query(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.working_days, lr.status,
              lr.created_at, lr.reviewed_at, lr.reason,
              u.name AS employee_name, u.email AS employee_email,
              d.name AS department, lt.name AS leave_type_name, lt.code,
              rv.name AS reviewed_by_name, lr.review_comment
       FROM leave_requests lr
       JOIN users u ON u.id=lr.user_id
       JOIN leave_types lt ON lt.id=lr.leave_type_id
       LEFT JOIN departments d ON d.id=u.department_id
       LEFT JOIN users rv ON rv.id=lr.reviewed_by
       ORDER BY lr.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{total}]] = await db.query('SELECT COUNT(*) AS total FROM leave_requests');
    return res.json({ success:true, data: rows, total, limit, offset });
  } catch(err){ return res.status(500).json({ success:false, message:'Server error' }); }
});

module.exports = router;
