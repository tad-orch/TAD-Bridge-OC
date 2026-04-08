# TAD Bridge OC

A Node.js Express server providing HTTP API access to Revit operations on Windows.

## Overview

This bridge enables remote orchestration of Revit operations through a REST API. It uses a job queue system where requests are written to files for a Revit add-in to process.

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

#### New Tools (Phase 2)

##### Session Management
- `POST /tools/revit_session_status` - Get Revit installation and session status
- `POST /tools/revit_launch` - Launch Revit if not running

##### Cloud Model Operations
- `POST /tools/revit_open_cloud_model` - Open a cloud model (not implemented)
- `POST /tools/revit_list_3d_views` - List 3D views (not implemented)
- `POST /tools/revit_export_nwc` - Export to NWC (not implemented)

### Job Polling
- `GET /jobs/{jobId}` - Poll job status

## Tool Details

### revit_session_status
Returns Revit installation and running status.

**Response:**
```json
{
  "ok": true,
  "tool": "revit_session_status",
  "machine": "HOSTNAME",
  "revitInstalled": true,
  "revitRunning": true,
  "revitVersion": "2025",
  "activeDocument": null,
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
  "tool": "revit_launch",
  "machine": "HOSTNAME",
  "launchNeeded": true,
  "launchSucceeded": true,
  "revitRunning": true,
  "revitVersion": "2025",
  "source": "bridge-live",
  "time": "2023-..."
}
```

### Cloud Model Tools
The cloud model, 3D views listing, and NWC export tools are currently stubbed with "not implemented" responses. They require Revit add-in support for full functionality.

## Configuration

- `PORT`: Server port (default 4010)
- `HOST`: Server host (default 127.0.0.1)
- `BRIDGE_TOKEN`: Authentication token
- `REVIT_BRIDGE_ROOT`: Path to Revit bridge directories (default D:\TAD\revit-bridge)

## Project Structure

```
revit/
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

- Cloud model operations require add-in implementation
- Version detection limited to running processes
- No UI components
- Windows-specific (uses Windows commands)