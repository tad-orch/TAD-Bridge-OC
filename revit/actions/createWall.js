async function createWallAction(payload) {
  return {
    ok: true,
    action: 'create_wall',
    source: 'revit-action-placeholder',
    received: payload,
    time: new Date().toISOString()
  };
}

module.exports = { createWallAction };