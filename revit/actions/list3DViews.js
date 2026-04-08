const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const REVIT_BRIDGE_ROOT = 'D:\\TAD\\revit-bridge';
const INBOX_DIR = path.join(REVIT_BRIDGE_ROOT, 'inbox');

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { onlyExportable } = payload;

  if (onlyExportable !== undefined && typeof onlyExportable !== 'boolean') return 'onlyExportable must be a boolean.';

  return null;
}

async function list3DViewsAction(payload) {
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      action: 'list_3d_views',
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
    action: 'list_3d_views',
    source: 'bridge-queue',
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Listing 3D views not yet implemented in Revit add-in.'
    },
    time: new Date().toISOString()
  };

  // Uncomment when implemented
  /*
  const jobId = `job-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const command = {
    jobId,
    tool: 'revit_list_3d_views',
    createdAt,
    status: 'queued',
    payload
  };

  await fs.mkdir(INBOX_DIR, { recursive: true });

  const filePath = path.join(INBOX_DIR, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(command, null, 2), 'utf8');

  return {
    ok: true,
    action: 'list_3d_views',
    queued: true,
    jobId,
    commandFile: filePath,
    source: 'bridge-queue',
    received: payload,
    time: createdAt
  };
  */
}

module.exports = { list3DViewsAction };