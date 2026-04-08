const { enqueueAddinCommand } = require('../addinQueue');

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

  const queued = await enqueueAddinCommand('revit_create_wall', payload);

  return {
    ...queued,
    action: 'create_wall'
  };
}

module.exports = { createWallAction };
