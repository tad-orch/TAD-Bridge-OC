const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const REVIT_BRIDGE_ROOT = 'D:\\TAD\\revit-bridge';
const INBOX_DIR = path.join(REVIT_BRIDGE_ROOT, 'inbox');

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { projectId, modelGuid, region } = payload;

  if (!projectId || typeof projectId !== 'string') return 'projectId is required.';
  if (!modelGuid || typeof modelGuid !== 'string') return 'modelGuid is required.';
  if (region && typeof region !== 'string') return 'region must be a string.';

  return null;
}

async function openCloudModelAction(payload) {
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      action: 'open_cloud_model',
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
    action: 'open_cloud_model',
    source: 'bridge-queue',
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Cloud model opening not yet implemented in Revit add-in.'
    },
    time: new Date().toISOString()
  };

  // Uncomment when implemented
  /*
  const jobId = `job-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const command = {
    jobId,
    tool: 'revit_open_cloud_model',
    createdAt,
    status: 'queued',
    payload
  };

  await fs.mkdir(INBOX_DIR, { recursive: true });

  const filePath = path.join(INBOX_DIR, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(command, null, 2), 'utf8');

  return {
    ok: true,
    action: 'open_cloud_model',
    queued: true,
    jobId,
    commandFile: filePath,
    source: 'bridge-queue',
    received: payload,
    time: createdAt
  };
  */
}

module.exports = { openCloudModelAction };