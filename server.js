'use strict';
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Serve static assets ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  ts: Date.now()
}));

// ── SPA fallback — all routes serve index.html ────────────────────────────────
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () =>
  console.log(`Apollo M-1 Controller running on http://localhost:${PORT}`)
);