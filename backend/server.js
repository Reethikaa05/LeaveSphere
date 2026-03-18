require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter   = require('./routes/auth');
const leavesRouter = require('./routes/leaves');
const usersRouter  = require('./routes/users');
const adminRouter  = require('./routes/admin');
const notifsRouter = require('./routes/notifications');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS: allow all localhost origins ─────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any localhost or 127.0.0.1 port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Allow env-specified frontend URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── REQUEST LOGGER ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString().slice(11,19)}  ${req.method.padEnd(7)} ${req.path}`);
    next();
  });
}

// ── ROUTES ─────────────────────────────────────────────────
app.use('/api/auth',          authRouter);
app.use('/api/leaves',        leavesRouter);
app.use('/api/users',         usersRouter);
app.use('/api/admin',         adminRouter);
app.use('/api/notifications', notifsRouter);

// ── HEALTH CHECK ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'LeaveDesk API v2.0' });
});

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── ERROR HANDLER ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── START ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   LeaveDesk Backend — Running  ✅    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n🚀  Backend:  http://localhost:${PORT}`);
  console.log(`🏥  Health:   http://localhost:${PORT}/api/health`);
  console.log(`\n🔑  Employee: john@leavedesk.com / password123`);
  console.log(`👔  Manager:  alex@leavedesk.com / password123\n`);
});

module.exports = app;
