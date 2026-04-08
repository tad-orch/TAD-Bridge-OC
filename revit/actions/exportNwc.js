const { enqueueAddinCommand, extractToolPayload } = require('../addinQueue');

const SUPPORTED_EXPORT_SCOPES = new Set(['selected_views', 'model']);

function normalizePayload(body) {
  const incoming = extractToolPayload(body);

  return {
    viewNames: Array.isArray(incoming.viewNames) ? incoming.viewNames : [],
    outputPath: incoming.outputPath,
    exportScope: incoming.exportScope ?? 'selected_views'
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { viewNames, outputPath, exportScope } = payload;

  if (!viewNames || !Array.isArray(viewNames) || viewNames.length === 0) return 'viewNames is required and must be a non-empty array.';
  if (!viewNames.every((name) => typeof name === 'string' && name.trim().length > 0)) {
    return 'viewNames must contain only non-empty strings.';
  }
  if (!outputPath || typeof outputPath !== 'string') return 'outputPath is required.';
  if (exportScope && (typeof exportScope !== 'string' || !SUPPORTED_EXPORT_SCOPES.has(exportScope))) {
    return 'exportScope must be one of: selected_views, model.';
  }

  return null;
}

async function exportNwcAction(body) {
  const payload = normalizePayload(body);
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

  const queued = await enqueueAddinCommand('revit_export_nwc', payload);

  return {
    ...queued,
    action: 'export_nwc'
  };
}

module.exports = { exportNwcAction };
