// ============================================================
//  LeaveDesk — Frontend Static Server
//  Run:  node server.js   OR   npm start
//  Opens: http://localhost:3000
// ============================================================
const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = 3000;

// Serve all static files (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname)));

// All routes fallback to index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   LeaveDesk Frontend — Running       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`🌐  http://localhost:${PORT}`);
  console.log(`\n💡  Make sure backend is also running:`);
  console.log(`    cd ../backend && npm start\n`);
});
