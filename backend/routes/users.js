// ============================================================
//  LeaveDesk — Users / Balances / Team / Holidays Routes
// ============================================================
const express = require('express');
const db = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/users/balances  (my balances) ────────────────
router.get('/balances', authenticate, async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  try {
    const [rows] = await db.query(
      `SELECT lb.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
              (lb.total_days - lb.used_days) AS remaining_days
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.user_id = ? AND lb.year = ?
       ORDER BY lt.id`,
      [req.user.id, year]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/team  (manager: all team members) ──────
router.get('/team', authenticate, requireManager, async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_initials, u.role, u.joining_date,
              d.name AS department,
              COALESCE(SUM(lb.used_days), 0) AS total_used_days,
              MAX(CASE WHEN lr.status='approved' AND CURDATE() BETWEEN lr.start_date AND lr.end_date THEN 1 ELSE 0 END) AS is_on_leave
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN leave_balances lb ON lb.user_id = u.id AND lb.year = ?
       LEFT JOIN leave_requests lr ON lr.user_id = u.id
       WHERE u.is_active = 1
       GROUP BY u.id
       ORDER BY u.name`,
      [year]
    );

    // Get per-type balances for each user
    const [balances] = await db.query(
      `SELECT lb.user_id, lt.code, lb.used_days, lb.total_days
       FROM leave_balances lb
       JOIN leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.year = ?`,
      [year]
    );

    // Attach balances to each user
    const balMap = {};
    balances.forEach(b => {
      if (!balMap[b.user_id]) balMap[b.user_id] = {};
      balMap[b.user_id][b.code] = { used: b.used_days, total: b.total_days };
    });

    const result = rows.map(u => ({ ...u, balances: balMap[u.id] || {} }));
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/on-leave-today ─────────────────────────
router.get('/on-leave-today', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.avatar_initials, d.name AS department,
              lt.name AS leave_type, lr.end_date
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE lr.status = 'approved'
         AND CURDATE() BETWEEN lr.start_date AND lr.end_date
       ORDER BY u.name`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/departments ────────────────────────────
router.get('/departments', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY name');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/leave-types ────────────────────────────
router.get('/leave-types', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM leave_types ORDER BY id');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/holidays ───────────────────────────────
router.get('/holidays', authenticate, async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  try {
    const [rows] = await db.query(
      'SELECT * FROM holidays WHERE YEAR(holiday_date) = ? ORDER BY holiday_date',
      [year]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/calendar  (leave days for month) ───────
router.get('/calendar', authenticate, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ success: false, message: 'year and month required' });

  try {
    const [rows] = await db.query(
      `SELECT lr.start_date, lr.end_date, lt.code AS leave_type, lt.name AS leave_type_name,
              u.name AS employee_name, u.avatar_initials
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.status = 'approved'
         AND YEAR(lr.start_date) = ? AND MONTH(lr.start_date) = ?
       ORDER BY lr.start_date`,
      [year, month]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/reports  (manager analytics) ───────────
router.get('/reports', authenticate, requireManager, async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  try {
    const [[summary]] = await db.query(
      `SELECT
         COUNT(*)                                     AS total_requests,
         SUM(CASE WHEN status='approved'  THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='rejected'  THEN 1 ELSE 0 END) AS rejected,
         SUM(CASE WHEN status='approved'  THEN working_days ELSE 0 END) AS total_days_taken
       FROM leave_requests
       WHERE YEAR(start_date) = ?`,
      [year]
    );

    const [byType] = await db.query(
      `SELECT lt.name, lt.code,
              SUM(CASE WHEN lr.status='approved' THEN lr.working_days ELSE 0 END) AS days_taken,
              COUNT(lr.id) AS request_count
       FROM leave_types lt
       LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id AND YEAR(lr.start_date) = ?
       GROUP BY lt.id ORDER BY days_taken DESC`,
      [year]
    );

    const [byMonth] = await db.query(
      `SELECT MONTH(start_date) AS month_num,
              MONTHNAME(start_date) AS month_name,
              SUM(CASE WHEN status='approved' THEN working_days ELSE 0 END) AS days_taken
       FROM leave_requests WHERE YEAR(start_date) = ?
       GROUP BY MONTH(start_date), MONTHNAME(start_date)
       ORDER BY month_num`,
      [year]
    );

    return res.json({ success: true, data: { summary, byType, byMonth } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
