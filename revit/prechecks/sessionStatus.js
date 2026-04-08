const { exec } = require('child_process');
const { executeAddinCommandSync, getAddinHealth } = require('../addinQueue');

function checkRevitRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq Revit.exe" /FO CSV /NH', (error, stdout) => {
      if (error) {
        return resolve({
          revitInstalled: null,
          revitRunning: false,
          detection: 'tasklist-error'
        });
      }

      const output = (stdout || '').trim();

      const isRunning =
        output.length > 0 &&
        !output.includes('INFO: No tasks are running') &&
        output.toLowerCase().includes('revit.exe');

      resolve({
        revitInstalled: true,
        revitRunning: isRunning,
        detection: 'tasklist'
      });
    });
  });
}

function getRevitVersion() {
  return new Promise((resolve) => {
    exec('wmic process where name="Revit.exe" get CommandLine /value', (error, stdout) => {
      if (error) {
        return resolve(null);
      }

      const output = (stdout || '').trim();
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const match = line.match(/CommandLine=(.+)/i);
        if (match) {
          const cmd = match[1];
          const versionMatch = cmd.match(/Revit (\d{4})/i);
          if (versionMatch) {
            return resolve(versionMatch[1]);
          }
        }
      }

      resolve(null);
    });
  });
}

async function getSessionStatus() {
  const revit = await checkRevitRunning();
  const version = revit.revitRunning ? await getRevitVersion() : null;

  const baseStatus = {
    revitInstalled: revit.revitInstalled,
    revitRunning: revit.revitRunning,
    revitVersion: version,
    detection: revit.detection,
    activeDocument: null,
    sessionSource: 'process-precheck'
  };

  if (!revit.revitRunning) {
    return baseStatus;
  }

  const addinHealth = await getAddinHealth();

  if (!addinHealth.available || !addinHealth.fresh) {
    return baseStatus;
  }

  const addinResult = await executeAddinCommandSync('revit_session_status', {}, {
    timeoutMs: Number(process.env.ADDIN_SESSION_STATUS_TIMEOUT_MS || 2500)
  });

  if (addinResult?.ok === true && addinResult.status === 'completed') {
    return {
      ...baseStatus,
      revitRunning: addinResult.revitRunning ?? baseStatus.revitRunning,
      revitVersion: addinResult.revitVersion ?? baseStatus.revitVersion,
      activeDocument: addinResult.activeDocument ?? null,
      sessionSource: 'revit-addin',
      addinJobId: addinResult.jobId ?? null
    };
  }

  return {
    ...baseStatus,
    addinError: addinResult?.error ?? null
  };
}

module.exports = { getSessionStatus, checkRevitRunning };
