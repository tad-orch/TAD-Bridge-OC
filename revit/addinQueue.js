const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const DEFAULT_REVIT_BRIDGE_ROOT = 'D:\\TAD\\revit-bridge';
const DEFAULT_SYNC_TIMEOUT_MS = 10000;
const DEFAULT_SYNC_POLL_INTERVAL_MS = 200;
const DEFAULT_HEALTH_MAX_AGE_MS = 15000;

function getBridgeRoot() {
  return process.env.REVIT_BRIDGE_ROOT || DEFAULT_REVIT_BRIDGE_ROOT;
}

function getBridgePaths() {
  const root = getBridgeRoot();

  return {
    root,
    inboxDir: path.join(root, 'inbox'),
    outboxDir: path.join(root, 'outbox'),
    archiveDir: path.join(root, 'archive'),
    healthFile: path.join(root, 'outbox', 'revit-addin-alive.json')
  };
}

function extractToolPayload(body) {
  if (body?.args && typeof body.args === 'object' && !Array.isArray(body.args)) {
    return body.args;
  }

  return body ?? {};
}

async function readJsonIfExists(filePath) {
  const JSON_PARSE_PENDING = { __parse_pending__: true };

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

async function enqueueAddinCommand(tool, payload) {
  const { inboxDir } = getBridgePaths();
  const jobId = `job-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const command = {
    jobId,
    tool,
    createdAt,
    status: 'queued',
    payload
  };

  await fs.mkdir(inboxDir, { recursive: true });

  const filePath = path.join(inboxDir, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(command, null, 2), 'utf8');

  return {
    ok: true,
    queued: true,
    status: 'accepted',
    jobId,
    commandFile: filePath,
    source: 'bridge-queue',
    received: payload,
    time: createdAt
  };
}

async function waitForAddinResult(jobId, options = {}) {
  const { outboxDir } = getBridgePaths();
  const timeoutMs = Number(options.timeoutMs || process.env.ADDIN_SYNC_TIMEOUT_MS || DEFAULT_SYNC_TIMEOUT_MS);
  const pollIntervalMs = Number(
    options.pollIntervalMs || process.env.ADDIN_SYNC_POLL_INTERVAL_MS || DEFAULT_SYNC_POLL_INTERVAL_MS
  );
  const resultFile = path.join(outboxDir, `${jobId}.result.json`);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await readJsonIfExists(resultFile);

    if (result && !result.__parse_pending__) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

async function executeAddinCommandSync(tool, payload, options = {}) {
  const queued = await enqueueAddinCommand(tool, payload);
  const result = await waitForAddinResult(queued.jobId, options);

  if (result) {
    return result;
  }

  return {
    ok: false,
    status: 'timeout',
    jobId: queued.jobId,
    tool,
    source: 'bridge-queue',
    error: {
      code: 'ADDIN_TIMEOUT',
      message: `Timed out waiting for add-in result for '${tool}'.`
    },
    time: new Date().toISOString()
  };
}

async function getAddinHealth(maxAgeMs = DEFAULT_HEALTH_MAX_AGE_MS) {
  const { healthFile } = getBridgePaths();
  const health = await readJsonIfExists(healthFile);

  if (!health || health.__parse_pending__) {
    return {
      available: false,
      fresh: false,
      lastSeenAt: null,
      payload: null
    };
  }

  const lastSeenAt = health.timeUtc || health.time || health.timestamp || null;
  const ageMs = lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() : null;
  const fresh = typeof ageMs === 'number' && Number.isFinite(ageMs) ? ageMs <= maxAgeMs : true;

  return {
    available: true,
    fresh,
    lastSeenAt,
    payload: health
  };
}

module.exports = {
  extractToolPayload,
  getBridgePaths,
  readJsonIfExists,
  enqueueAddinCommand,
  executeAddinCommandSync,
  getAddinHealth
};
