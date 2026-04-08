const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const REVIT_BRIDGE_ROOT = 'D:\\TAD\\revit-bridge';
const INBOX_DIR = path.join(REVIT_BRIDGE_ROOT, 'inbox');

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { viewNames, outputPath, exportScope } = payload;

  if (!viewNames || !Array.isArray(viewNames) || viewNames.length === 0) return 'viewNames is required and must be a non-empty array.';
  if (!outputPath || typeof outputPath !== 'string') return 'outputPath is required.';
  if (exportScope && typeof exportScope !== 'string') return 'exportScope must be a string.';

  return null;
}

async function exportNwcAction(payload) {
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      action: 'export_nwc',
      source: 'bridge-queue',
      error: {
        code: 'INVALID_PAYLOAD',
        message: validationError
      },
      time: new Date().toISOString()
    };
  }

  // TODO: Implement via add-in
  return {
    ok: false,
    action: 'export_nwc',
    source: 'bridge-queue',
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'NWC export not yet implemented in Revit add-in.'
    },
    time: new Date().toISOString()
  };

  // Uncomment when implemented
  /*
  const jobId = `job-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const command = {
    jobId,
    tool: 'revit_export_nwc',
    createdAt,
    status: 'queued',
    payload
  };

  await fs.mkdir(INBOX_DIR, { recursive: true });

  const filePath = path.join(INBOX_DIR, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(command, null, 2), 'utf8');

  return {
    ok: true,
    action: 'export_nwc',
    queued: true,
    jobId,
    commandFile: filePath,
    source: 'bridge-queue',
    received: payload,
    time: createdAt
  };
  */
}

module.exports = { exportNwcAction };