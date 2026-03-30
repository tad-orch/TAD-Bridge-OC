const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const REVIT_BRIDGE_ROOT = 'D:\\TAD\\revit-bridge';
const INBOX_DIR = path.join(REVIT_BRIDGE_ROOT, 'inbox');

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { start, end, height, level, wallType } = payload;

  if (!start || typeof start !== 'object') return 'start is required.';
  if (!end || typeof end !== 'object') return 'end is required.';
  if (typeof start.x !== 'number' || typeof start.y !== 'number' || typeof start.z !== 'number') {
    return 'start.x, start.y, start.z must be numbers.';
  }
  if (typeof end.x !== 'number' || typeof end.y !== 'number' || typeof end.z !== 'number') {
    return 'end.x, end.y, end.z must be numbers.';
  }
  if (typeof height !== 'number' || height <= 0) {
    return 'height must be a positive number.';
  }
  if (!level || typeof level !== 'string') {
    return 'level is required.';
  }
  if (!wallType || typeof wallType !== 'string') {
    return 'wallType is required.';
  }

  return null;
}

async function createWallAction(payload) {
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      action: 'create_wall',
      source: 'bridge-queue',
      error: {
        code: 'INVALID_PAYLOAD',
        message: validationError
      },
      time: new Date().toISOString()
    };
  }

  const jobId = `job-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const command = {
    jobId,
    tool: 'revit_create_wall',
    createdAt,
    status: 'queued',
    payload
  };

  await fs.mkdir(INBOX_DIR, { recursive: true });

  const filePath = path.join(INBOX_DIR, `${jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(command, null, 2), 'utf8');

  return {
    ok: true,
    action: 'create_wall',
    queued: true,
    jobId,
    commandFile: filePath,
    source: 'bridge-queue',
    received: payload,
    time: createdAt
  };
}

module.exports = { createWallAction };