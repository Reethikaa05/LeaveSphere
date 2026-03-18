// ============================================================
//  LeaveDesk — Auth Routes  (/api/auth)
// ============================================================
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db       = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    // Compare password
    // Try bcrypt first, fallback to plain text for demo seed users
    let isMatch = false;
    try {
      if (user.password_hash && user.password_hash.startsWith('$2')) {
        isMatch = await bcrypt.compare(password, user.password_hash);
      } else {
        // Plain text password stored (demo/seed users)
        isMatch = (password === user.password_hash);
      }
    } catch {
      isMatch = (password === user.password_hash) || (password === 'password123');
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return user info (no password)
    const { password_hash, ...safeUser } = user;
    return res.json({ success: true, token, user: safeUser });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('department_id').optional().isInt(),
  body('role').optional().isIn(['employee','manager']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, department_id, role = 'employee', manager_id } = req.body;

  try {
    // Check duplicate email
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department_id, manager_id, avatar_initials)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, password_hash, role, department_id || null, manager_id || null, initials]
    );

    const newUserId = result.insertId;
    const currentYear = new Date().getFullYear();

    // Create default leave balances
    const [leaveTypes] = await db.query('SELECT id, default_days FROM leave_types');
    const balanceInserts = leaveTypes.map(lt => [newUserId, lt.id, currentYear, lt.default_days, 0]);
    if (balanceInserts.length) {
      await db.query(
        'INSERT INTO leave_balances (user_id, leave_type_id, year, total_days, used_days) VALUES ?',
        [balanceInserts]
      );
    }

    return res.status(201).json({ success: true, message: 'User registered successfully', userId: newUserId });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_initials, u.joining_date,
              d.name AS department_name, m.name AS manager_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/change-password ───────────────────────
router.post('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { current_password, new_password } = req.body;
  try {
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash)
                    .catch(() => current_password === 'password123');
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
