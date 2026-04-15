const { enqueueAddinCommand, extractToolPayload } = require('../addinQueue');

function normalizePayload(body) {
  const incoming = extractToolPayload(body);

  return {
    documentTitle: incoming.documentTitle
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { documentTitle } = payload;

  if (!documentTitle || typeof documentTitle !== 'string') return 'documentTitle is required.';

  return null;
}

async function activateDocumentAction(body) {
  const payload = normalizePayload(body);
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      action: 'activate_document',
      source: 'bridge-queue',
      error: {
        code: 'INVALID_PAYLOAD',
        message: validationError
      },
      time: new Date().toISOString()
    };
  }

  const queued = await enqueueAddinCommand('revit_activate_document', payload);

  return {
    ...queued,
    action: 'activate_document'
  };
}

module.exports = { activateDocumentAction };
