# API Reference

Complete documentation of all API endpoints in the Nuclei Dashboard with database integration.

## Table of Contents
1. [Authentication](#authentication)
2. [Scan Management API](#scan-management-api)
3. [Findings API](#findings-api)
4. [History API](#history-api)
5. [Scheduler & Automation API](#scheduler--automation-api)
6. [Settings API](#settings-api)
7. [Backup & Restore API](#backup--restore-api)

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

## Scheduler & Automation API

### GET `/api/scheduler/status`
Get current automation status and logs.

**Response:**
```json
{
  "enabled": true,
  "frequency": "12h",
  "nextRun": "2024-03-15T12:00:00.000Z",
  "lastRun": 1710450000,
  "logs": [
    {
      "id": 1,
      "domain": "example.com",
      "status": "completed",
      "subdomains_new": 5,
      "findings_count": 2
    }
  ]
}
```

### POST `/api/scheduler/status`
Update scheduler configuration.

**Request Body:**
```json
{
  "enabled": true,
  "frequency": "24h"
}
```

**Response:**
```json
{
  "success": true,
  "nextRun": "2024-03-16T00:00:00.000Z"
}
```

---

## Settings API

### GET `/api/settings`
Retrieve global configuration.

**Response:**
```json
{
  "telegram_bot_token": "••••••••", 
  "telegram_chat_id": "123456789",
  "notifications_enabled": true,
  "is_configured": true
}
```
*Note: Tokens are masked for security.*

### POST `/api/settings`
Update global configuration.

**Request Body:**
```json
{
  "telegram_bot_token": "123:ABC...",
  "telegram_chat_id": "987654321",
  "notifications_enabled": true
}
```

**Response:**
```json
{
  "success": true
}
```

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
  "concurrency": 75
}
```

**Response:**
```json
{
  "scanId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### GET `/api/scan`
List recent scans from database (last 20).

**Response:**
```json
[
  {
    "id": "scan-id",
    "target": "https://example.com",
    "status": "completed",
    "startTime": 1702345678901,
    "exitCode": 0
  }
]
```

### DELETE `/api/scan?id=<scanId>`
Stop a running scan.

**Response:**
```json
{
  "success": true,
  "message": "Scan stopped"
}
```

---

## Findings API

### GET `/api/findings`
List findings.

**Query Parameters:**
- `scanId`: Filter by specific scan ID (optional)

**Response:**
```json
[
  {
    "info": {
      "name": "SQL Injection",
      "severity": "critical"
    },
    "host": "example.com",
    "_status": "New",
    "_dbId": 123
  }
]
```

### PATCH `/api/findings`
Update finding status.

**Request Body:**
```json
{
  "id": 123,
  "status": "Confirmed"
}
```
Allowed: `New`, `Confirmed`, `False Positive`, `Fixed`, `Closed`.

---

## History API

### GET `/api/history`
List complete scan history with file metadata.

### DELETE `/api/history`
Delete scan, findings, and files.

**Query Parameters:**
- `id`: Scan ID to delete

---

## Backup & Restore API

### GET `/api/backup/export`
Download full database backup.

### POST `/api/backup/restore`
Restore from backup file.

### POST `/api/findings/import`
Import external Nuclei JSON output.
