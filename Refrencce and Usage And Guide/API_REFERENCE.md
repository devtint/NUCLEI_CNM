# API Reference

Complete documentation of all API endpoints in the Nuclei Dashboard.

---

## Table of Contents
1. [Scan Management API](#scan-management-api)
2. [Findings API](#findings-api)
3. [History API](#history-api)
4. [Templates API](#templates-api)
5. [Settings API](#settings-api)
6. [Stats API](#stats-api)
7. [Stream API](#stream-api)

---

## Scan Management API

### POST `/api/scan`
Start a new Nuclei scan.

**Request Body:**
```json
{
  "target": "https://example.com",
  "templateId": "cves/2024/CVE-2024-1234.yaml",
  "tags": ["panel", "login"],
  "severity": ["critical", "high"],
  "rateLimit": 300,
  "concurrency": 75,
  "bulkSize": 50,
  "customArgs": "-debug -v"
}
```

**Response:**
```json
{
  "scanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Process:**
1. Generates unique scan ID (UUID)
2. Constructs Nuclei command from config
3. Spawns Nuclei process
4. Stores in activeScans Map
5. Returns scan ID

---

### GET `/api/scan`
List all active scans.

**Response:**
```json
[
  {
    "id": "scan-id",
    "target": "https://example.com",
    "status": "running" | "stopped" | "completed" | "failed",
    "startTime": 1702345678901,
    "config": {
      "target": "https://example.com",
      "templateId": "...",
      "customArgs": "..."
    },
    "args": ["nuclei", "-u", "..."]
  }
]
```

**Notes:**
- Returns scans in reverse chronological order (newest first)
- Only includes scans currently in memory (cleared on server restart)

---

### DELETE `/api/scan?id=<scanId>`
Stop a running scan.

**Query Parameters:**
- `id`: Scan ID to stop

**Response:**
```json
{
  "success": true
}
```

**Process:**
1. Finds scan in activeScans Map
2. Calls `process.kill()` on Nuclei process
3. Updates status to "stopped"
4. Returns success

**Error Response:**
```json
{
  "error": "Scan not found"
}
```

---

## Findings API

### GET `/api/findings`
List all vulnerability findings from all scans.

**Response:**
```json
[
  {
    "template-id": "cves/2024/CVE-2024-1234",
    "template-path": "C:\\path\\to\\template.yaml",
    "info": {
      "name": "Vulnerability Name",
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "description": "Detailed description",
      "tags": ["cve", "2024"]
    },
    "matched-at": "https://example.com/path",
    "host": "example.com",
    "timestamp": "2024-12-09T12:34:56.789Z",
    "_sourceFile": "scan-id.json"
  }
]
```

**Process:**
1. Reads all `.json` files from `scans/` directory
2. Parses each file (JSON array)
3. Injects `_sourceFile` property for deletion tracking
4. Flattens and returns all findings

**Notes:**
- `_sourceFile` is added by backend, not from Nuclei
- Empty scans return `[]`

---

### DELETE `/api/findings`
Delete a specific finding from its source file.

**Request Body:**
```json
{
  "sourceFile": "scan-id.json",
  "templateId": "cves/2024/CVE-2024-1234",
  "matchedAt": "https://example.com/path"
}
```

**Response:**
```json
{
  "success": true
}
```

**Process:**
1. Reads `scans/<sourceFile>`
2. Filters out finding matching `templateId` AND `matchedAt`
3. Writes updated array back to file
4. Returns success

**Error Response:**
```json
{
  "error": "Source file not found"
}
```

---

## History API

### GET `/api/history`
List all completed scans with metadata.

**Response:**
```json
[
  {
    "id": "scan-id",
    "timestamp": "2024-12-09T12:34:56.789Z",
    "findingsCount": 5,
    "hasLog": true
  }
]
```

**Process:**
1. Reads all `.json` files from `scans/` directory
2. Parses each to count findings
3. Checks for corresponding `.log` file
4. Returns sorted by timestamp (newest first)

---

### GET `/api/history/download?file=<filename>&type=<json|log>`
Download scan results or logs.

**Query Parameters:**
- `file`: Filename (without extension)
- `type`: `json` or `log`

**Response:**
- **Content-Type**: `application/json` or `text/plain`
- **Content-Disposition**: `attachment; filename="<file>.<type>"`
- **Body**: File contents

**Error Response:**
```json
{
  "error": "File not found"
}
```

---

## Templates API

### GET `/api/templates`
List all custom templates.

**Response:**
```json
[
  {
    "id": "my-template",
    "name": "my-template.yaml",
    "path": "C:\\Users\\user\\nuclei-custom-templates\\my-template.yaml",
    "lastModified": "2024-12-09T12:34:56.789Z"
  }
]
```

**Process:**
1. Reads `C:\Users\<user>\nuclei-custom-templates\` directory
2. Filters `.yaml` and `.yml` files
3. Returns metadata for each

**Notes:**
- Directory created automatically if it doesn't exist
- Returns empty array if no templates found

---

### POST `/api/templates`
Create a new custom template.

**Request Body:**
```json
{
  "name": "my-template",
  "content": "id: my-template\ninfo:\n  name: My Template\n..."
}
```

**Response:**
```json
{
  "success": true,
  "path": "C:\\Users\\user\\nuclei-custom-templates\\my-template.yaml"
}
```

**Process:**
1. Sanitizes filename (alphanumeric + hyphens/underscores only)
2. Adds `.yaml` extension
3. Writes to `nuclei-custom-templates/` directory
4. Returns full path

**Error Response:**
```json
{
  "error": "Missing name or content"
}
```

---

### GET `/api/templates/content?path=<template-path>`
Read template content.

**Query Parameters:**
- `path`: Full path to template file

**Response:**
```json
{
  "content": "id: my-template\ninfo:\n  name: My Template\n..."
}
```

**Error Response:**
```json
{
  "error": "Template not found"
}
```

---

## Settings API

### GET `/api/settings`
Get current settings (from localStorage on client).

**Note:** This endpoint is not currently implemented. Settings are stored client-side only.

---

### POST `/api/settings`
Save settings (to localStorage on client).

**Note:** This endpoint is not currently implemented. Settings are stored client-side only.

**Client-Side Storage:**
```javascript
localStorage.setItem('nuclei_settings', JSON.stringify({
  rateLimit: 300,
  concurrency: 75,
  bulkSize: 50
}));
```

---

## Stats API

### GET `/api/stats`
Get dashboard statistics.

**Response:**
```json
{
  "totalScans": 42,
  "totalFindings": 156,
  "severityCounts": {
    "critical": 12,
    "high": 34,
    "medium": 56,
    "low": 45,
    "info": 9
  },
  "recentScans": [
    {
      "id": "scan-id",
      "timestamp": "2024-12-09T12:34:56.789Z",
      "findingsCount": 5
    }
  ]
}
```

**Process:**
1. Counts all `.json` files in `scans/` directory
2. Parses each to count findings by severity
3. Returns aggregated statistics

---

## Stream API

### GET `/api/stream/[id]`
Stream scan logs in real-time (Server-Sent Events).

**Path Parameters:**
- `id`: Scan ID

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Format:**
```
data: [INF] Starting scan...\n\n
data: [INF] Templates loaded: 1234\n\n
data: [VUL] Found vulnerability!\n\n
```

**Process:**
1. Opens log file (`scans/<id>.log`)
2. Sends initial content
3. Watches file for changes
4. Streams new lines as they're written
5. Closes on client disconnect or scan completion

**Client Usage:**
```javascript
const eventSource = new EventSource(`/api/stream/${scanId}`);
eventSource.onmessage = (event) => {
  console.log(event.data);
};
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad request (missing parameters)
- `404`: Resource not found
- `500`: Internal server error

---

## Rate Limiting

Currently, there is **no rate limiting** on API endpoints. Consider implementing rate limiting in production.

---

## Authentication

Currently, there is **no authentication**. The dashboard is designed for local use only. For production deployment, implement authentication middleware.

---

## CORS

CORS is not configured. The API is designed to be accessed from the same origin (Next.js frontend).

---

## Data Validation

### Input Validation
- Template names: Alphanumeric + hyphens/underscores only
- Scan IDs: UUID format
- File paths: Validated against allowed directories

### Output Validation
- JSON responses validated before sending
- File contents sanitized for security

---

## Performance Considerations

### Caching
- No caching implemented
- Consider caching scan history and stats

### Pagination
- No pagination implemented
- Large result sets may cause performance issues

### Concurrent Requests
- Multiple scans can run simultaneously
- Limited by system resources (CPU, memory)

---

## Future API Enhancements

1. **Pagination**: Add `?page=1&limit=50` to list endpoints
2. **Filtering**: Add `?severity=critical` to findings endpoint
3. **Sorting**: Add `?sort=timestamp&order=desc`
4. **Webhooks**: POST to external URL on scan completion
5. **Batch Operations**: Delete multiple findings at once
6. **Search**: Full-text search across findings
7. **Export**: Export findings in multiple formats (PDF, HTML, CSV)

---

For implementation details, see [ARCHITECTURE.md](./ARCHITECTURE.md)
