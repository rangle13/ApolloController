'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Persistent data storage (survives container restarts via a mounted volume) ─
const DATA_DIR = path.join(__dirname, 'data');
const PLAYLISTS_FILE = path.join(DATA_DIR, 'playlists.json');

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.error('Could not create data directory:', e.message);
}

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('Failed to read', file, e.message);
    return fallback;
  }
}

function writeJsonFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.json({ limit: '2mb' }));

// ── Serve static assets ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  ts: Date.now()
}));

// ── Playlists API ─────────────────────────────────────────────────────────────
app.get('/api/playlists', (_req, res) => {
  res.json(readJsonFile(PLAYLISTS_FILE, []));
});

app.put('/api/playlists', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of playlists' });
  }
  try {
    writeJsonFile(PLAYLISTS_FILE, req.body);
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Failed to save playlists:', e.message);
    res.status(500).json({ error: 'Failed to save playlists' });
  }
});

// ── SPA fallback — all routes serve index.html ────────────────────────────────
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () =>
  console.log(`Apollo M-1 Controller running on http://localhost:${PORT}`)
);