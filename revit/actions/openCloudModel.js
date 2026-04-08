const { enqueueAddinCommand, extractToolPayload } = require('../addinQueue');

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_WORKSET_MODES = new Set(['default', 'open_all', 'close_all', 'open_last_viewed']);
const SUPPORTED_CONFLICT_POLICIES = new Set([
  'use_default',
  'discard_local_changes_and_open_latest_version',
  'keep_local_changes',
  'detach_from_central',
  'cancel'
]);

function normalizePayload(body) {
  const incoming = extractToolPayload(body);
  const cloudOpenConflictPolicy =
    incoming.cloudOpenConflictPolicy ?? (incoming.detach === true ? 'detach_from_central' : 'use_default');

  return {
    region: typeof incoming.region === 'string' && incoming.region.trim().toUpperCase() === 'EU'
      ? 'EMEA'
      : incoming.region,
    projectGuid: incoming.projectGuid ?? incoming.projectId,
    modelGuid: incoming.modelGuid,
    openInUi: incoming.openInUi ?? incoming.openInCurrentSession ?? false,
    audit: incoming.audit === true,
    worksets: incoming.worksets && typeof incoming.worksets === 'object'
      ? {
          mode: incoming.worksets.mode ?? 'default'
        }
      : {
          mode: 'default'
        },
    cloudOpenConflictPolicy
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload is required.';
  }

  const { projectGuid, modelGuid, region, openInUi, audit, worksets, cloudOpenConflictPolicy } = payload;

  if (!projectGuid || typeof projectGuid !== 'string') return 'projectGuid is required.';
  if (!GUID_PATTERN.test(projectGuid)) return 'projectGuid must be a valid GUID.';
  if (!modelGuid || typeof modelGuid !== 'string') return 'modelGuid is required.';
  if (!GUID_PATTERN.test(modelGuid)) return 'modelGuid must be a valid GUID.';
  if (!region || typeof region !== 'string') return 'region is required.';
  if (typeof openInUi !== 'boolean') return 'openInUi must be a boolean.';
  if (typeof audit !== 'boolean') return 'audit must be a boolean.';
  if (!worksets || typeof worksets !== 'object') return 'worksets is required.';
  if (typeof worksets.mode !== 'string' || !SUPPORTED_WORKSET_MODES.has(worksets.mode)) {
    return 'worksets.mode must be one of: default, open_all, close_all, open_last_viewed.';
  }
  if (
    typeof cloudOpenConflictPolicy !== 'string' ||
    !SUPPORTED_CONFLICT_POLICIES.has(cloudOpenConflictPolicy)
  ) {
    return 'cloudOpenConflictPolicy must be one of: use_default, discard_local_changes_and_open_latest_version, keep_local_changes, detach_from_central, cancel.';
  }

  return null;
}

async function openCloudModelAction(body) {
  const payload = normalizePayload(body);
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

  const queued = await enqueueAddinCommand('revit_open_cloud_model', payload);

  return {
    ...queued,
    action: 'open_cloud_model'
  };
}

module.exports = { openCloudModelAction };
