# TAD Bridge OC

A Node.js Express server providing authenticated HTTP access to Revit operations on Windows.

## Overview

This bridge is the Windows execution-node layer between:

- `TAD-BIM-Host-Runner`
- `TadOcRevitBridge`
- the local Revit installation on the PC

It preserves the current Express server, auth, and logging behavior, while relaying structured requests to the Revit add-in through the existing file queue:

- inbox: `D:\TAD\revit-bridge\inbox`
- outbox: `D:\TAD\revit-bridge\outbox`
- archive: `D:\TAD\revit-bridge\archive`

The bridge is now aligned to the add-in and MCP/backend contracts for:

- `revit_session_status`
- `revit_launch`
- `revit_open_cloud_model`
- `revit_list_3d_views`
- `revit_export_nwc`

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
All `/tools/*` endpoints require Bearer token authentication:
```
Authorization: Bearer <BRIDGE_TOKEN>
```

### Revit Tools

#### Existing Tools
- `POST /tools/revit_ping` - Check if Revit is running
- `POST /tools/revit_create_wall` - Create a wall in active Revit document

##### Session Management
- `POST /tools/revit_session_status` - Get Revit installation and session status
- `POST /tools/revit_launch` - Launch Revit if not running

##### Cloud Model Operations
- `POST /tools/revit_open_cloud_model` - Queue a cloud-model open request for the add-in
- `POST /tools/revit_list_3d_views` - Run a sync add-in-backed 3D view listing
- `POST /tools/revit_export_nwc` - Queue an NWC export request for the add-in

### Job Polling
- `GET /jobs/{jobId}` - Poll async job status

## Tool Details

### revit_session_status
Returns process-level Revit status and, when available, richer add-in-backed document/session information.

**Response:**
```json
{
  "ok": true,
  "status": "completed",
  "tool": "revit_session_status",
  "machine": "HOSTNAME",
  "revitInstalled": true,
  "revitRunning": true,
  "revitVersion": "2025",
  "detection": "tasklist",
  "activeDocument": {
    "isOpen": true,
    "isActive": true,
    "title": "ModelName",
    "isCloudModel": true,
    "projectGuid": "11111111-1111-1111-1111-111111111111",
    "modelGuid": "22222222-2222-2222-2222-222222222222",
    "region": "US"
  },
  "sessionSource": "revit-addin",
  "source": "bridge-live",
  "time": "2023-..."
}
```

### revit_launch
Launches Revit if not running.

**Request:**
```json
{
  "preferredVersion": "2025",
  "waitForReadySeconds": 60
}
```

**Response:**
```json
{
  "ok": true,
  "status": "completed",
  "tool": "revit_launch",
  "machine": "HOSTNAME",
  "launchNeeded": true,
  "launchSucceeded": true,
  "revitRunning": true,
  "revitVersion": "2025",
  "requestedVersion": "2025",
  "selectedVersion": "2025",
  "waitForReadySeconds": 60,
  "source": "bridge-live",
  "time": "2023-..."
}
```

### revit_open_cloud_model
Queues a cloud-model open request to the add-in.

Canonical request payload:

```json
{
  "projectGuid": "11111111-1111-1111-1111-111111111111",
  "modelGuid": "22222222-2222-2222-2222-222222222222",
  "region": "US",
  "openInUi": false,
  "audit": false,
  "worksets": {
    "mode": "default"
  },
  "cloudOpenConflictPolicy": "use_default"
}
```

Transitional aliases are still accepted and normalized immediately:

- `projectId` -> `projectGuid`
- `openInCurrentSession` -> `openInUi`
- `detach=true` -> `cloudOpenConflictPolicy=detach_from_central`

### revit_list_3d_views
Runs synchronously against the add-in and returns the add-in result directly.

Request payload:

```json
{
  "onlyExportable": true,
  "excludeTemplates": true
}
```

### revit_export_nwc
Queues an NWC export request to the add-in.

Request payload:

```json
{
  "viewNames": ["{3D}"],
  "outputPath": "C:\\Exports\\MyModel.nwc",
  "exportScope": "selected_views"
}
```

## Configuration

- `PORT`: Server port (default 4010)
- `HOST`: Server host (default 127.0.0.1)
- `BRIDGE_TOKEN`: Authentication token
- `REVIT_BRIDGE_ROOT`: Path to the shared bridge queue root (default `D:\TAD\revit-bridge`)
- `ADDIN_SYNC_TIMEOUT_MS`: Default timeout for sync add-in-backed tools such as `revit_list_3d_views`
- `ADDIN_SYNC_POLL_INTERVAL_MS`: Poll interval for sync add-in-backed tools
- `ADDIN_SESSION_STATUS_TIMEOUT_MS`: Short timeout for best-effort add-in enrichment on `revit_session_status`

## Run On The Windows PC

1. Install Node.js 20+ on the PC.
2. Install the bridge dependencies:

```powershell
npm install
```

3. Create the bridge env file:

```powershell
Copy-Item .env.example .env
```

4. Set at least:

- `BRIDGE_TOKEN`
- optionally `REVIT_BRIDGE_ROOT` if you are not using `D:\TAD\revit-bridge`
- optionally the sync timeout envs if the machine is slower

5. Make sure the Revit add-in from `TadOcRevitBridge` is installed for the matching Revit year.

Expected add-in manifest locations:

- `%AppData%\Autodesk\Revit\Addins\2024\`
- `%AppData%\Autodesk\Revit\Addins\2025\`
- `%AppData%\Autodesk\Revit\Addins\2026\`

Expected queue root used by both bridge and add-in:

- `D:\TAD\revit-bridge`

6. Start the bridge:

```powershell
npm start
```

The bridge will listen on `http://127.0.0.1:4010` unless overridden.

## Windows Smoke Tests

Set the token in PowerShell:

```powershell
$token = "replace-me"
```

Session status:

```powershell
curl.exe -X POST "http://127.0.0.1:4010/tools/revit_session_status" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{}"
```

Launch Revit:

```powershell
curl.exe -X POST "http://127.0.0.1:4010/tools/revit_launch" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"preferredVersion\":\"2025\",\"waitForReadySeconds\":60}"
```

Open cloud model:

```powershell
curl.exe -X POST "http://127.0.0.1:4010/tools/revit_open_cloud_model" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"projectGuid\":\"11111111-1111-1111-1111-111111111111\",\"modelGuid\":\"22222222-2222-2222-2222-222222222222\",\"region\":\"US\",\"openInUi\":false,\"audit\":false,\"worksets\":{\"mode\":\"default\"},\"cloudOpenConflictPolicy\":\"use_default\"}"
```

List 3D views:

```powershell
curl.exe -X POST "http://127.0.0.1:4010/tools/revit_list_3d_views" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"onlyExportable\":true,\"excludeTemplates\":true}"
```

Export NWC:

```powershell
curl.exe -X POST "http://127.0.0.1:4010/tools/revit_export_nwc" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"viewNames\":[\"{3D}\"],\"outputPath\":\"C:\\\\Exports\\\\MyModel.nwc\",\"exportScope\":\"selected_views\"}"
```

Poll an async job:

```powershell
curl.exe "http://127.0.0.1:4010/jobs/job-REPLACE_ME" -H "Authorization: Bearer $token"
```

## Project Structure

```
revit/
  addinQueue.js
  prechecks/
    sessionStatus.js
    launchRevit.js
  actions/
    createWall.js
    openCloudModel.js
    list3DViews.js
    exportNwc.js
server.js
package.json
```

## Limitations

- `revit_open_cloud_model` is aligned to the add-in contract, but `openInUi=true` still depends on add-in support and is not expected to succeed in the current idling queue path
- `revit_list_3d_views` and `revit_export_nwc` require a loaded add-in and a valid active Revit document
- `revit_export_nwc` still depends on the Navisworks exporter being available in the Revit session
- `revit_session_status` falls back to process-level prechecks if the add-in is not responding
- Windows-specific by design
