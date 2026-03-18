// ============================================================
//  LeaveDesk — Leave Request Routes  (/api/leaves)
// ============================================================
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// ── Helper: count working days ────────────────────────────
async function countWorkingDays(start, end) {
  const [holidays] = await db.query(
    'SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN ? AND ?',
    [start, end]
  );
  const holidaySet = new Set(holidays.map(h => h.holiday_date.toISOString().split('T')[0]));

  let count = 0;
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) {
    const d = cur.getDay();
    const ds = cur.toISOString().split('T')[0];
    if (d !== 0 && d !== 6 && !holidaySet.has(ds)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── GET /api/leaves  (my leave requests) ─────────────────
router.get('/', authenticate, async (req, res) => {
  const { status, year } = req.query;
  let sql = `
    SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
           rv.name AS reviewed_by_name
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN users rv ON rv.id = lr.reviewed_by
    WHERE lr.user_id = ?`;
  const params = [req.user.id];

  if (status) { sql += ' AND lr.status = ?'; params.push(status); }
  if (year)   { sql += ' AND YEAR(lr.start_date) = ?'; params.push(year); }
  sql += ' ORDER BY lr.created_at DESC';

  try {
    const [rows] = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/leaves/all  (manager: all team requests) ─────
router.get('/all', authenticate, requireManager, async (req, res) => {
  const { status, year } = req.query;
  let sql = `
    SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
           u.name AS employee_name, u.email AS employee_email,
           u.avatar_initials, d.name AS department,
           rv.name AS reviewed_by_name
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN users rv ON rv.id = lr.reviewed_by
    WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND lr.status = ?'; params.push(status); }
  if (year)   { sql += ' AND YEAR(lr.start_date) = ?'; params.push(year); }
  sql += ' ORDER BY lr.created_at DESC';

  try {
    const [rows] = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/leaves/pending  (manager: pending queue) ─────
router.get('/pending', authenticate, requireManager, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM v_pending_requests');
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/leaves/:id ───────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT lr.*, lt.name AS leave_type_name, lt.code AS leave_type_code,
              u.name AS employee_name, rv.name AS reviewed_by_name
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN users rv ON rv.id = lr.reviewed_by
       WHERE lr.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Request not found' });

    // Employees can only see their own
    const r = rows[0];
    if (req.user.role === 'employee' && r.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, data: r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/leaves  (submit leave request) ──────────────
router.post('/', authenticate, [
  body('leave_type_id').isInt({ min: 1 }),
  body('start_date').isDate(),
  body('end_date').isDate(),
  body('reason').notEmpty().trim().isLength({ min: 5, max: 1000 }),
  body('emergency_contact').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { leave_type_id, start_date, end_date, reason, emergency_contact } = req.body;

  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
  }

  try {
    // Count working days
    const working_days = await countWorkingDays(start_date, end_date);
    if (working_days === 0) {
      return res.status(400).json({ success: false, message: 'No working days in selected range' });
    }

    // Check balance
    const year = new Date(start_date).getFullYear();
    const [balRows] = await db.query(
      `SELECT total_days, used_days FROM leave_balances
       WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [req.user.id, leave_type_id, year]
    );
    if (!balRows.length) {
      return res.status(400).json({ success: false, message: 'No leave balance found for this type' });
    }
    const { total_days, used_days } = balRows[0];
    if ((used_days + working_days) > total_days) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ${total_days - used_days} days, Requested: ${working_days} days`
      });
    }

    // Check for overlapping requests
    const [overlap] = await db.query(
      `SELECT id FROM leave_requests
       WHERE user_id = ? AND status IN ('pending','approved')
         AND NOT (end_date < ? OR start_date > ?)`,
      [req.user.id, start_date, end_date]
    );
    if (overlap.length) {
      return res.status(409).json({ success: false, message: 'You already have a leave request for this period' });
    }

    const [result] = await db.query(
      `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, working_days, reason, emergency_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, leave_type_id, start_date, end_date, working_days, reason, emergency_contact || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: { id: result.insertId, working_days }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/leaves/:id/cancel  (employee cancel) ─────────
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });

    const r = rows[0];
    if (r.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
    if (r.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending requests can be cancelled' });

    await db.query("UPDATE leave_requests SET status='cancelled' WHERE id=?", [req.params.id]);
    return res.json({ success: true, message: 'Leave request cancelled' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/leaves/:id/approve  (manager) ────────────────
router.put('/:id/approve', authenticate, requireManager, [
  body('comment').optional().trim(),
], async (req, res) => {
  try {
    const { comment = '' } = req.body;
    await db.query('CALL approve_leave(?, ?, ?)', [req.params.id, req.user.id, comment]);
    return res.json({ success: true, message: 'Leave request approved' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/leaves/:id/reject  (manager) ─────────────────
router.put('/:id/reject', authenticate, requireManager, [
  body('comment').optional().trim(),
], async (req, res) => {
  try {
    const { comment = '' } = req.body;
    await db.query('CALL reject_leave(?, ?, ?)', [req.params.id, req.user.id, comment]);
    return res.json({ success: true, message: 'Leave request rejected' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
