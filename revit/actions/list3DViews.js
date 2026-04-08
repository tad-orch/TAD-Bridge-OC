const { executeAddinCommandSync, extractToolPayload } = require('../addinQueue');

function normalizePayload(body) {
  const incoming = extractToolPayload(body);

  return {
    onlyExportable: incoming.onlyExportable !== undefined ? incoming.onlyExportable : true,
    excludeTemplates:
      incoming.excludeTemplates !== undefined
        ? incoming.excludeTemplates
        : incoming.onlyExportable !== undefined
          ? incoming.onlyExportable
          : true
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { onlyExportable, excludeTemplates } = payload;

  if (onlyExportable !== undefined && typeof onlyExportable !== 'boolean') return 'onlyExportable must be a boolean.';
  if (excludeTemplates !== undefined && typeof excludeTemplates !== 'boolean') {
    return 'excludeTemplates must be a boolean.';
  }

  return null;
}

async function list3DViewsAction(body) {
  const payload = normalizePayload(body);
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

  const result = await executeAddinCommandSync('revit_list_3d_views', payload);

  return {
    ...result,
    action: 'list_3d_views'
  };
}

module.exports = { list3DViewsAction };
