const express = require('express');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const app = express();

// Config
const PORT = Number(process.env.PORT || 4010);
const HOST = process.env.HOST || '127.0.0.1';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || 'change-this-now';
const REVIT_BRIDGE_ROOT = 'D:\\TAD\\revit-bridge';
const REVIT_INBOX_DIR = path.join(REVIT_BRIDGE_ROOT, 'inbox');
const REVIT_OUTBOX_DIR = path.join(REVIT_BRIDGE_ROOT, 'outbox');
const JSON_PARSE_PENDING = { __parse_pending__: true };

const { createWallAction } = require('./revit/actions/createWall');
const { openCloudModelAction } = require('./revit/actions/openCloudModel');
const { list3DViewsAction } = require('./revit/actions/list3DViews');
const { exportNwcAction } = require('./revit/actions/exportNwc');
const { getSessionStatus, checkRevitRunning } = require('./revit/prechecks/sessionStatus');
const { launchRevit } = require('./revit/prechecks/launchRevit');

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

function getCreateWallIncomingPayload(body) {
  if (body?.args && typeof body.args === 'object' && !Array.isArray(body.args)) {
    return body.args;
  }

  return body ?? {};
}

function normalizeCreateWallPayload(body) {
  const incoming = getCreateWallIncomingPayload(body);

  return {
    start: incoming.start,
    end: incoming.end,
    height: incoming.height ?? incoming.unconnectedHeight,
    level: incoming.level ?? incoming.levelName,
    wallType: incoming.wallType
  };
}

async function readJsonIfExists(filePath) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const normalized = content.replace(/^\uFEFF/, '').trim();

      if (!normalized) {
        return null;
      }

      return JSON.parse(normalized);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      if (error instanceof SyntaxError) {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }

        return JSON_PARSE_PENDING;
      }

      throw error;
    }
  }
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

app.post('/tools/revit_session_status', async (req, res) => {
  const status = await getSessionStatus();

  return res.json({
    ok: true,
    tool: 'revit_session_status',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...status,
    source: 'bridge-live',
    time: new Date().toISOString()
  });
});

app.post('/tools/revit_launch', async (req, res) => {
  const { preferredVersion, waitForReadySeconds = 60 } = req.body || {};

  try {
    const result = await launchRevit(preferredVersion, waitForReadySeconds);

    return res.json({
      ok: true,
      tool: 'revit_launch',
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result,
      source: 'bridge-live',
      time: new Date().toISOString()
    });
  } catch (error) {
    return res.json({
      ok: false,
      tool: 'revit_launch',
      machine: process.env.COMPUTERNAME || 'unknown',
      launchNeeded: true,
      launchSucceeded: false,
      error: {
        code: 'LAUNCH_FAILED',
        message: error.message
      },
      source: 'bridge-live',
      time: new Date().toISOString()
    });
  }
});

app.post('/tools/revit_create_wall', async (req, res) => {
  const normalizedPayload = normalizeCreateWallPayload(req.body ?? {});
  const result = await createWallAction(normalizedPayload);

  if (result?.ok && result?.jobId) {
    return res.json({
      ok: true,
      status: 'accepted',
      jobId: result.jobId,
      pollPath: `/jobs/${result.jobId}`,
      tool: 'revit_create_wall',
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result
    });
  }

  return res.json({
    tool: 'revit_create_wall',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...result
  });
});

app.post('/tools/revit_open_cloud_model', async (req, res) => {
  const result = await openCloudModelAction(req.body ?? {});

  if (result?.ok && result?.jobId) {
    return res.json({
      ok: true,
      status: 'accepted',
      jobId: result.jobId,
      pollPath: `/jobs/${result.jobId}`,
      tool: 'revit_open_cloud_model',
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result
    });
  }

  return res.json({
    tool: 'revit_open_cloud_model',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...result
  });
});

app.post('/tools/revit_list_3d_views', async (req, res) => {
  const result = await list3DViewsAction(req.body ?? {});

  if (result?.ok && result?.jobId) {
    return res.json({
      ok: true,
      status: 'accepted',
      jobId: result.jobId,
      pollPath: `/jobs/${result.jobId}`,
      tool: 'revit_list_3d_views',
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result
    });
  }

  return res.json({
    tool: 'revit_list_3d_views',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...result
  });
});

app.post('/tools/revit_export_nwc', async (req, res) => {
  const result = await exportNwcAction(req.body ?? {});

  if (result?.ok && result?.jobId) {
    return res.json({
      ok: true,
      status: 'accepted',
      jobId: result.jobId,
      pollPath: `/jobs/${result.jobId}`,
      tool: 'revit_export_nwc',
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result
    });
  }

  return res.json({
    tool: 'revit_export_nwc',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...result
  });
});

app.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const inboxFile = path.join(REVIT_INBOX_DIR, `${jobId}.json`);
    const receivedFile = path.join(REVIT_OUTBOX_DIR, `${jobId}.received.json`);
    const resultFile = path.join(REVIT_OUTBOX_DIR, `${jobId}.result.json`);

    const result = await readJsonIfExists(resultFile);
    if (result) {
      if (result.__parse_pending__) {
        return res.json({
          ok: true,
          status: 'running',
          jobId
        });
      }

      if (result.ok === false || result.status === 'failed') {
        const error =
          result.error && typeof result.error === 'object'
            ? result.error
            : { message: result.error || 'Revit job failed.' };

        return res.json({
          ok: false,
          status: 'failed',
          jobId,
          error
        });
      }

      return res.json({
        ok: true,
        status: 'completed',
        jobId,
        result
      });
    }

    const received = await readJsonIfExists(receivedFile);
    if (received) {
      if (received.__parse_pending__) {
        return res.json({
          ok: true,
          status: 'running',
          jobId
        });
      }

      return res.json({
        ok: true,
        status: 'running',
        jobId
      });
    }

    const queued = await readJsonIfExists(inboxFile);
    if (queued) {
      if (queued.__parse_pending__) {
        return res.json({
          ok: true,
          status: 'accepted',
          jobId
        });
      }

      return res.json({
        ok: true,
        status: 'accepted',
        jobId
      });
    }

    return res.status(404).json({
      ok: false,
      status: 'failed',
      error: {
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} was not found.`
      }
    });
  } catch (error) {
    next(error);
  }
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
