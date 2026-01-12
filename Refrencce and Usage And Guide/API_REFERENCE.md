# API Reference

Complete documentation of all API endpoints in the Nuclei Dashboard with database integration.

---

## Table of Contents
1. [Authentication](#authentication)
2. [Scan Management API](#scan-management-api)
3. [Findings API](#findings-api)
4. [History API](#history-api)
5. [Templates API](#templates-api)
6. [Backup & Restore API](#backup--restore-api)
7. [Caching](#caching)
8. [Error Handling](#error-handling)

---

## Authentication

All API endpoints (except `/api/auth/*`) require a valid session.

**Authentication Method:** NextAuth v5 (Session Cookies)

**Unauthorized Response:**
```json
{
  "error": "Unauthorized"
}
```
**Status Code:** `401 Unauthorized`

---

## Scan Management API

### POST `/api/scan`
Start a new Nuclei scan. **Requires Authentication.**

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
2. **Inserts scan record in database**
3. Constructs Nuclei command from config
4. Spawns Nuclei process
5. Creates log file
6. On completion:
   - Parses JSON output
   - **Inserts findings into database**
   - **Updates scan metadata (end_time, exit_code, file paths/sizes)**
   - **Invalidates history and findings caches**

---

### GET `/api/scan`
List recent scans from database (last 20). **Requires Authentication.**

**Response:**
```json
[
  {
    "id": "scan-id",
    "target": "https://example.com",
    "status": "running" | "completed" | "stopped" | "failed",
    "startTime": 1702345678901,
    "endTime": 1702345789012,
    "exitCode": 0,
    "config": {
      "target": "https://example.com",
      "tags": ["tech"],
      "severity": ["critical"]
    }
  }
]
```

**Source:** Database query
```sql
SELECT * FROM scans 
ORDER BY start_time DESC 
LIMIT 20
```

**Notes:**
- Returns scans from database (persistent across restarts)
- Includes completed and running scans
- Config stored as JSON string in database

---

### DELETE `/api/scan?id=<scanId>`
Stop a running scan. **Requires Authentication.**

**Query Parameters:**
- `id`: Scan ID to stop

**Response:**
```json
{
  "success": true,
  "message": "Scan stopped"
}
```

**Process:**
1. Finds scan in activeScans Map
2. Calls `process.kill()` on Nuclei process
3. **Updates database: status='stopped', end_time=now()**
4. Returns success

---

## Findings API

### GET `/api/findings`
List findings. **Requires Authentication.**

**Query Parameters (Optional):**
- `scanId`: Filter by specific scan ID

**Response:**
```json
[
  {
    "template-id": "cves/2024/CVE-2024-1234",
    "info": {
      "name": "Vulnerability Name",
      "severity": "critical",
      "description": "Detailed description",
      "tags": ["cve", "2024"]
    },
    "matched-at": "https://example.com/path",
    "host": "example.com",
    "timestamp": "2024-12-09T12:34:56.789Z",
    "_status": "New",
    "_dbId": 123
  }
]
```

**Source:** Database query
```sql
SELECT * FROM findings 
WHERE scan_id = ? OR ? IS NULL
```

**Caching:**
- TTL: 20 seconds
- Cache key: `findings-all` or `findings-{scanId}`
- Invalidated on: finding deletion, status update, scan completion

**Notes:**
- `_status`: Finding status (New/Confirmed/False Positive/Fixed/Closed)
- `_dbId`: Database ID for updates/deletes
- Returns empty array if no findings

---

### PATCH `/api/findings`
Update finding status. **Requires Authentication.**

**Request Body:**
```json
{
  "id": 123,
  "status": "Confirmed"
}
```

**Allowed Status Values:**
- `New`
- `Confirmed`
- `False Positive`
- `Fixed`
- `Closed`

**Response:**
```json
{
  "success": true
}
```

**Process:**
1. Validates status value
2. **Updates finding in database**
3. **Invalidates findings cache**
4. Returns success

**Error Response:**
```json
{
  "error": "Invalid status value"
}
```

---

### DELETE `/api/findings`
Delete a finding. **Requires Authentication.**

**Request Body:**
```json
{
  "id": 123
}
```

**Response:**
```json
{
  "success": true
}
```

**Process:**
1. **Deletes finding from database by ID**
2. **Invalidates findings cache**
3. Returns success

**Error Response:**
```json
{
  "error": "Finding not found"
}
```

---

## History API

### GET `/api/history`
List scan history. **Requires Authentication.**

**Response:**
```json
[
  {
    "id": "scan-id",
    "target": "https://example.com",
    "filename": "scan-id_2024-12-09T12-34-56.json",
    "size": "15.2 KB",
    "date": "2024-12-09T12:34:56.789Z",
    "findingsCount": 5,
    "hasLog": true,
    "status": "completed",
    "exitCode": 0
  }
]
```

**Source:** Database query with file metadata
```sql
SELECT 
  id, target, json_file_path, json_file_size, 
  log_file_path, start_time, status, exit_code
FROM scans 
ORDER BY start_time DESC
```

**Caching:**
- TTL: 30 seconds
- Cache key: `history-all`
- Invalidated on: scan completion, scan deletion

**Fallback:**
- If `json_file_size` is 0 or NULL, reads from filesystem
- Ensures legacy scans (pre-database) still display correctly

---

### DELETE `/api/history?id=<scanId>`
Delete scan data. **Requires Authentication.**

**Query Parameters:**
- `id`: Scan ID to delete

**Response:**
```json
{
  "success": true
}
```

**Process:**
1. **Deletes scan from database (CASCADE deletes findings)**
2. Deletes JSON file (`scans/{scanId}_{timestamp}.json`)
3. Deletes log file (`scans/{scanId}.log`)
4. **Invalidates history and findings caches**
5. Returns success

**Error Response:**
```json
{
  "error": "Scan not found"
}
```

---

### GET `/api/history/download?file=<filename>&type=<json|log>`
Download scan results or logs.

**Query Parameters:**
- `file`: Filename (with or without extension)
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
List all templates. **Requires Authentication.**

**Response:**
```json
[
  {
    "id": "my-template",
    "name": "my-template.yaml",
    "path": "C:\\Users\\user\\nuclei-custom-templates\\my-template.yaml",
    "lastModified": "2024-12-09T12:34:56.789Z",
    "isCustom": true
  }
]
```

**Process:**
1. Lists standard Nuclei templates
2. Lists custom templates from `~/nuclei-custom-templates/`
3. Returns combined list

---

### POST `/api/templates`
Create custom template. **Requires Authentication.**

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
1. Sanitizes filename
2. Adds `.yaml` extension
3. Writes to `~/nuclei-custom-templates/`
4. Returns full path

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

---

## Backup & Restore API

### GET `/api/backup/export`
Export complete database backup.

**Authentication:** Required

**Response:**
- **Content-Type**: `application/json`
- **Content-Disposition**: `attachment; filename="nuclei-cc-backup_{timestamp}.json"`
- **Body**: Complete backup JSON

**Backup Format:**
```json
{
  "metadata": {
    "version": "1.0.0",
    "exportedAt": "2026-01-01T10:00:00.000Z",
    "exportedBy": "Nuclei CC Backup System",
    "format": "nuclei-cc-backup"
  },
  "nuclei": {
    "scans": [...],
    "findings": [...]
  },
  "subfinder": {
    "scans": [...],
    "results": [...],
    "monitored_targets": [...],
    "monitored_subdomains": [...]
  },
  "httpx": {
    "scans": [...],
    "results": [...]
  }
}
```

**Process:**
1. Queries all tables from database
2. Adds metadata with version and timestamp
3. Returns as downloadable JSON file

---

### POST `/api/backup/restore`
Restore from Nuclei CC backup file.

**Authentication:** Required

**Request:**
- **Content-Type**: `multipart/form-data`
- **Body**: File upload (JSON)

**Response:**
```json
{
  "success": true,
  "message": "Backup restored successfully",
  "stats": {
    "nuclei": { "scans": 10, "findings": 150 },
    "subfinder": { "scans": 5, "results": 200, "monitored_targets": 3, "monitored_subdomains": 50 },
    "httpx": { "scans": 8, "results": 120 }
  },
  "backupInfo": {
    "version": "1.0.0",
    "exportedAt": "2026-01-01T10:00:00.000Z"
  }
}
```

**Validation:**
1. Checks file is JSON
2. Validates `metadata.format === "nuclei-cc-backup"`
3. Checks version compatibility

**Process:**
1. Begins SQLite transaction
2. Restores data in order (parent tables first)
3. Uses `INSERT OR IGNORE` for duplicate prevention
4. Skips records with invalid foreign keys
5. Commits transaction (or rolls back on error)
6. Returns detailed statistics

**Error Response:**
```json
{
  "error": "Invalid backup format. Only files created by Nuclei CC Backup System are supported."
}
```

---

### POST `/api/findings/import`
Import external Nuclei JSON scan results.

**Authentication:** Required

**Request:**
- **Content-Type**: `multipart/form-data`
- **Body**: Nuclei JSON file upload

**Response:**
```json
{
  "success": true,
  "scanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "imported": 45,
  "message": "Successfully imported 45 findings from scan.json"
}
```

**Validation:**
1. Checks file is JSON
2. Validates array format
3. Checks first finding has required fields:
   - `info` object
   - `template-id`
   - `matched-at` or `host`

**Process:**
1. Generates scan ID
2. Creates scan record (status: 'completed', source: 'json_import')
3. Parses findings array
4. Uses existing `generateFindingHash()` for deduplication
5. Inserts findings into database
6. Returns scan ID and count

**Error Response:**
```json
{
  "error": "Invalid Nuclei format. Required fields: 'info', 'template-id'"
}
```

---

## Caching

### Cache Implementation
In-memory cache with TTL (Time-To-Live).

**Cache Configuration:**
```typescript
{
  "history-all": { ttl: 30000 },  // 30 seconds
  "findings-all": { ttl: 20000 }, // 20 seconds
  "findings-{scanId}": { ttl: 20000 }
}
```

### Cache Invalidation

**Pattern-Based Invalidation:**
```typescript
cache.invalidate('findings-*')  // Invalidates all findings caches
cache.invalidate('history-*')   // Invalidates all history caches
```

**Triggers:**
- Scan completion → `findings-*`, `history-*`
- Finding deletion → `findings-*`
- Finding status update → `findings-*`
- Scan deletion → `findings-*`, `history-*`

### Cache Headers
No cache headers currently implemented. All caching is server-side.

---

## Error Handling

### Error Response Format
```json
{
  "error": "Error message description",
  "type": "DATABASE_ERROR" | "VALIDATION_ERROR" | "FILE_SYSTEM_ERROR",
  "statusCode": 400 | 404 | 500
}
```

### Error Types

**DATABASE_ERROR (500)**
```json
{
  "error": "Failed to insert scan into database",
  "type": "DATABASE_ERROR"
}
```

**VALIDATION_ERROR (400)**
```json
{
  "error": "Invalid status value",
  "type": "VALIDATION_ERROR"
}
```

**FILE_SYSTEM_ERROR (500)**
```json
{
  "error": "Failed to read scan file",
  "type": "FILE_SYSTEM_ERROR"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad request (validation error)
- `404`: Resource not found
- `500`: Internal server error (database, filesystem)

---

## Database Operations

### Scan Operations
```typescript
insertScan(id, target, config, start_time)
updateScan(id, { status, end_time, exit_code, json_file_path, json_file_size, log_file_path })
getScan(id)
getAllScans()
deleteScan(id) // CASCADE deletes findings
```

### Finding Operations
```typescript
insertFinding(scan_id, template_id, severity, name, matched_at, raw_json, timestamp)
insertFindings(findings[]) // Batch insert
updateFinding(id, { status })
deleteFinding(id)
getFindings(scan_id?) // Optional filter
```

---

## Performance Considerations

### Database Indexes
```sql
CREATE INDEX idx_scans_start_time ON scans(start_time);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_findings_scan_id ON findings(scan_id);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_status ON findings(status);
```

### Query Optimization
- Prepared statements for all queries
- Batch inserts for findings
- Indexed columns for common filters
- LIMIT clauses on list endpoints

### Caching Benefits
- Reduces database load
- Faster response times
- Automatic invalidation

---

## Security

### Input Validation
- Template names: Alphanumeric + hyphens/underscores
- Scan IDs: UUID format
- Status values: Whitelist validation
- File paths: Validated against allowed directories

### SQL Injection Prevention
- All queries use prepared statements
- No string concatenation in SQL

### File Access Control
- Only allowed directories accessible
- Path traversal prevention
- Filename sanitization

---

## Future Enhancements

✅ **Completed:**
- Database integration
- Response caching
- Finding status management
- Multi-select filtering

**Planned:**
- [ ] Pagination for large result sets
- [ ] Advanced filtering (by date, template, etc.)
- [ ] Sorting options
- [ ] Webhook notifications
- [ ] Batch operations
- [ ] Full-text search
- [ ] Export to PDF/HTML/CSV
- [ ] API authentication
- [ ] Rate limiting

---

For implementation details, see [ARCHITECTURE.md](./ARCHITECTURE.md)  
For feature documentation, see [FEATURES.md](./FEATURES.md)
