require('dotenv/config');

const express = require('express');
const path = require('path');

const app = express();

// Config
const PORT = Number(process.env.PORT || 4010);
const HOST = process.env.HOST || '127.0.0.1';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || 'change-this-now';

const { createWallAction } = require('./revit/actions/createWall');
const { openCloudModelAction } = require('./revit/actions/openCloudModel');
const { list3DViewsAction } = require('./revit/actions/list3DViews');
const { exportNwcAction } = require('./revit/actions/exportNwc');
const { activateDocumentAction } = require('./revit/actions/activateDocument');
const { extractToolPayload, getBridgePaths, readJsonIfExists } = require('./revit/addinQueue');
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

function sendToolResponse(res, toolName, result) {
  if (result?.queued && result?.jobId) {
    return res.json({
      ok: true,
      status: 'accepted',
      jobId: result.jobId,
      pollPath: `/jobs/${result.jobId}`,
      tool: toolName,
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result
    });
  }

  return res.json({
    tool: toolName,
    machine: process.env.COMPUTERNAME || 'unknown',
    ...result
  });
}

app.post('/tools/revit_ping', async (req, res) => {
  const revit = await checkRevitRunning();

  return res.json({
    ok: true,
    status: 'completed',
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
    status: 'completed',
    tool: 'revit_session_status',
    machine: process.env.COMPUTERNAME || 'unknown',
    ...status,
    source: 'bridge-live',
    time: new Date().toISOString()
  });
});

app.post('/tools/revit_launch', async (req, res) => {
  const payload = extractToolPayload(req.body ?? {});
  const { preferredVersion, waitForReadySeconds = 60 } = payload;

  try {
    const result = await launchRevit(preferredVersion, waitForReadySeconds);

    return res.json({
      ok: true,
      status: 'completed',
      tool: 'revit_launch',
      machine: process.env.COMPUTERNAME || 'unknown',
      ...result,
      source: 'bridge-live',
      time: new Date().toISOString()
    });
  } catch (error) {
    return res.json({
      ok: false,
      status: 'failed',
      tool: 'revit_launch',
      machine: process.env.COMPUTERNAME || 'unknown',
      launchNeeded: true,
      launchSucceeded: false,
      requestedVersion: preferredVersion ?? null,
      waitForReadySeconds,
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
  return sendToolResponse(res, 'revit_create_wall', result);
});

app.post('/tools/revit_open_cloud_model', async (req, res) => {
  const result = await openCloudModelAction(req.body ?? {});
  return sendToolResponse(res, 'revit_open_cloud_model', result);
});

app.post('/tools/revit_list_3d_views', async (req, res) => {
  const result = await list3DViewsAction(req.body ?? {});
  return sendToolResponse(res, 'revit_list_3d_views', result);
});

app.post('/tools/revit_export_nwc', async (req, res) => {
  const result = await exportNwcAction(req.body ?? {});
  return sendToolResponse(res, 'revit_export_nwc', result);
});

app.post('/tools/revit_activate_document', async (req, res) => {
  const result = await activateDocumentAction(req.body ?? {});
  return sendToolResponse(res, 'revit_activate_document', result);
});

app.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { inboxDir, outboxDir } = getBridgePaths();
    const inboxFile = path.join(inboxDir, `${jobId}.json`);
    const receivedFile = path.join(outboxDir, `${jobId}.received.json`);
    const resultFile = path.join(outboxDir, `${jobId}.result.json`);

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
