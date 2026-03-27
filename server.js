const express = require('express');

const app = express();

// Config
const PORT = Number(process.env.PORT || 4010);
const HOST = process.env.HOST || '127.0.0.1';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || 'change-this-now';

// Middleware
app.use(express.json({ limit: '256kb' }));

// Simple request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// GET /health
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    host: process.env.COMPUTERNAME || 'unknown',
    service: 'tad-ops-bridge',
    version: '0.1.0',
    time: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  const publicPaths = new Set(['/health']);
  if (publicPaths.has(req.path)) return next();

  const auth = req.headers.authorization || '';
  const expected = `Bearer ${BRIDGE_TOKEN}`;

  if (auth !== expected) {
    return res.status(401).json({
      ok: false,
      error: 'unauthorized'
    });
  }

  next();
});

app.post('/tools/get_acc_auth_status', (req, res) => {
  res.json({
    ok: true,
    tool: 'get_acc_auth_status',
    authenticated: false,
    source: 'bridge-placeholder',
    time: new Date().toISOString(),
    received: req.body ?? {}
  });
});

// Protected tool
app.post('/tools/get_remote_health', (req, res) => {
  res.json({
    ok: true,
    tool: 'get_remote_health',
    host: process.env.COMPUTERNAME || 'unknown',
    service: 'tad-ops-bridge',
    version: '0.1.0',
    time: new Date().toISOString(),
    received: req.body ?? {}
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'not_found',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: 'internal_error'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`tad-ops-bridge listening on http://${HOST}:${PORT}`);
});