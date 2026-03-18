// ============================================================
//  LeaveDesk — Notifications Route  (/api/notifications)
// ============================================================
const express = require('express');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Build notifications dynamically from leave_requests table
router.get('/', async (req, res) => {
  try {
    const notifications = [];

    if (req.user.role === 'manager' || req.user.role === 'admin') {
      // Manager: new pending requests
      const [pending] = await db.query(
        `SELECT lr.id, u.name AS employee_name, lt.name AS leave_type, lr.created_at, lr.working_days
         FROM leave_requests lr
         JOIN users u ON u.id=lr.user_id
         JOIN leave_types lt ON lt.id=lr.leave_type_id
         WHERE lr.status='pending'
         ORDER BY lr.created_at DESC LIMIT 10`
      );
      pending.forEach(r => {
        notifications.push({
          id: `leave_${r.id}`,
          type: 'pending_approval',
          title: 'Leave Request Pending',
          message: `${r.employee_name} requested ${r.working_days} day(s) of ${r.leave_type}`,
          time: r.created_at,
          read: false,
          link_page: 'approvals',
        });
      });
    }

    // For employee: status changes on own requests
    const [myUpdates] = await db.query(
      `SELECT lr.id, lt.name AS leave_type, lr.status, lr.reviewed_at, lr.working_days
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id=lr.leave_type_id
       WHERE lr.user_id=? AND lr.status IN ('approved','rejected') AND lr.reviewed_at IS NOT NULL
       ORDER BY lr.reviewed_at DESC LIMIT 10`,
      [req.user.id]
    );
    myUpdates.forEach(r => {
      notifications.push({
        id: `status_${r.id}`,
        type: r.status === 'approved' ? 'approved' : 'rejected',
        title: r.status === 'approved' ? 'Leave Approved ✅' : 'Leave Rejected ❌',
        message: `Your ${r.working_days}-day ${r.leave_type} request was ${r.status}`,
        time: r.reviewed_at,
        read: false,
        link_page: 'my-leaves',
      });
    });

    // Upcoming leaves (next 7 days)
    const [upcoming] = await db.query(
      `SELECT lr.id, lt.name AS leave_type, lr.start_date, lr.working_days
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id=lr.leave_type_id
       WHERE lr.user_id=? AND lr.status='approved'
         AND lr.start_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
      [req.user.id]
    );
    upcoming.forEach(r => {
      notifications.push({
        id: `upcoming_${r.id}`,
        type: 'reminder',
        title: 'Upcoming Leave Reminder',
        message: `Your ${r.leave_type} starts on ${new Date(r.start_date).toDateString()}`,
        time: new Date(),
        read: false,
        link_page: 'calendar',
      });
    });

    // Sort by time desc
    notifications.sort((a,b) => new Date(b.time) - new Date(a.time));
    return res.json({ success:true, data: notifications, unread: notifications.filter(n=>!n.read).length });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
