const express = require('express');
const { exec } = require('child_process');

const app = express();

// Config
const PORT = Number(process.env.PORT || 4010);
const HOST = process.env.HOST || '127.0.0.1';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || 'change-this-now';

const { createWallAction } = require('./revit/actions/createWall');

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

function checkRevitRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq Revit.exe" /FO CSV /NH', (error, stdout) => {
      if (error) {
        return resolve({
          revitInstalled: null,
          revitRunning: false,
          detection: 'tasklist-error'
        });
      }

      const output = (stdout || '').trim();

      const isRunning =
        output.length > 0 &&
        !output.includes('INFO: No tasks are running') &&
        output.toLowerCase().includes('revit.exe');

      resolve({
        revitInstalled: true,
        revitRunning: isRunning,
        detection: 'tasklist'
      });
    });
  });
}

app.post('/tools/revit_ping', async (req, res) => {
  const revit = await checkRevitRunning();

  return res.json({
    ok: true,
    tool: 'revit_ping',
    machine: process.env.COMPUTERNAME || 'unknown',
    revitInstalled: revit.revitInstalled,
    revitRunning: revit.revitRunning,
    detection: revit.detection,
    source: 'bridge-live',
    time: new Date().toISOString(),
    received: req.body ?? {}
  });
});

app.post('/tools/revit_create_wall', async (req, res) => {
  const result = await createWallAction(req.body ?? {});
  return res.json({
    ok: true,
    tool: 'revit_create_wall',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...result
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