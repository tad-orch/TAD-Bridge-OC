const { exec } = require('child_process');

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

  return {
    revitInstalled: revit.revitInstalled,
    revitRunning: revit.revitRunning,
    revitVersion: version,
    activeDocument: null // TODO: via add-in
  };
}

module.exports = { getSessionStatus, checkRevitRunning };