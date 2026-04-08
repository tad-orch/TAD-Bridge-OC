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

function getInstalledRevitVersions() {
  return new Promise((resolve) => {
    exec('dir "C:\\Program Files\\Autodesk\\Revit*" /b', (error, stdout) => {
      if (error) {
        return resolve([]);
      }

      const output = (stdout || '').trim();
      const versions = output.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('Revit '))
        .map(line => line.replace('Revit ', ''))
        .filter(v => /^\d{4}$/.test(v))
        .sort((a, b) => parseInt(b) - parseInt(a)); // latest first

      resolve(versions);
    });
  });
}

async function launchRevit(preferredVersion, waitForReadySeconds = 60) {
  const revit = await checkRevitRunning();
  if (revit.revitRunning) {
    const version = await getRevitVersion();
    return {
      launchNeeded: false,
      launchSucceeded: true,
      revitRunning: true,
      revitVersion: version,
      requestedVersion: preferredVersion ?? null,
      selectedVersion: version,
      waitForReadySeconds
    };
  }

  const installedVersions = await getInstalledRevitVersions();
  if (installedVersions.length === 0) {
    throw new Error('No Revit versions found installed.');
  }

  const versionToLaunch = preferredVersion && installedVersions.includes(preferredVersion) ? preferredVersion : installedVersions[0];

  const exePath = `C:\\Program Files\\Autodesk\\Revit ${versionToLaunch}\\Revit.exe`;

  return new Promise((resolve, reject) => {
    exec(`"${exePath}"`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      // Wait and check
      setTimeout(async () => {
        const postLaunch = await checkRevitRunning();
        const postVersion = postLaunch.revitRunning ? await getRevitVersion() : null;

        resolve({
          launchNeeded: true,
          launchSucceeded: postLaunch.revitRunning,
          revitRunning: postLaunch.revitRunning,
          revitVersion: postVersion,
          requestedVersion: preferredVersion ?? null,
          selectedVersion: versionToLaunch,
          waitForReadySeconds
        });
      }, (waitForReadySeconds * 1000) / 2);
    });
  });
}

module.exports = { launchRevit };
