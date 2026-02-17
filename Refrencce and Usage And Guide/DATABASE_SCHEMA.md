# Database Schema Documentation

## Overview
NUCLEI_CNM uses **SQLite** (via `better-sqlite3`) as its persistent storage engine. The database is located at `d:\NUCLEI_CNM\nuclei.db` (or `/app/data/nuclei.db` in Docker) and runs in **WAL (Write-Ahead-Logging)** mode for high concurrency performance.

## Core Tables

### 1. `scans`
Stores metadata for Nuclei vulnerability scans.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | Primary Key (UUID) |
| `target` | `TEXT` | Target URL or domain |
| `config` | `TEXT` | JSON string of scan configuration (tags, severity, etc.) |
| `start_time` | `INTEGER` | Unix timestamp of scan start |
| `end_time` | `INTEGER` | Unix timestamp of scan completion (nullable) |
| `status` | `TEXT` | `running`, `completed`, `stopped`, `failed` |
| `exit_code` | `INTEGER` | Process exit code (0 = success) |
| `json_file_path` | `TEXT` | Path to raw JSON output file |
| `json_file_size` | `INTEGER` | Size of JSON output file in bytes |
| `log_file_path` | `TEXT` | Path to raw log file |

**Indexes:**
- `idx_scans_start_time` on `start_time DESC`
- `idx_scans_status` on `status`

---

### 2. `findings`
Stores individual vulnerability findings linked to scans.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key (Auto-increment) |
| `scan_id` | `TEXT` | Foreign Key -> `scans.id` (CASCADE) |
| `template_id` | `TEXT` | Nuclei Template ID (e.g., `cve-2024-1234`) |
| `template_path` | `TEXT` | Full path to template file |
| `name` | `TEXT` | Finding title |
| `severity` | `TEXT` | `critical`, `high`, `medium`, `low`, `info` |
| `type` | `TEXT` | Template type (http, dns, etc.) |
| `host` | `TEXT` | Affected hostname/URL |
| `matched_at` | `TEXT` | Exact URL where finding was matched |
| `finding_hash` | `TEXT` | **Deterministic deduplication hash** (SHA-256) |
| `status` | `TEXT` | `New`, `Confirmed`, `False Positive`, `Fixed`, `Regression`, `Closed` |
| `first_seen` | `INTEGER` | Timestamp of first occurrence |
| `last_seen` | `INTEGER` | Timestamp of most recent occurrence |
| `raw_json` | `TEXT` | Full original JSON object from Nuclei |

**Indexes:**
- `idx_findings_scan_id` on `scan_id`
- `idx_finding_hash` (UNIQUE) on `finding_hash`
- `idx_findings_severity` on `severity`

---

## Asset Inventory Tables

### 3. `monitored_targets`
Recursive inventory of root domains being monitored.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key |
| `target` | `TEXT` | Root domain (e.g., `example.com`) |
| `last_scan_date` | `INTEGER` | Timestamp of last automation run |
| `total_count` | `INTEGER` | Count of discovered subdomains |
| `scheduler_enabled` | `INTEGER` | 1 = enabled, 0 = disabled |
| `nuclei_enabled` | `INTEGER` | 1 = scan for vulns, 0 = recon only |

### 4. `monitored_subdomains`
Discovered subdomains linked to a target.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key |
| `target_id` | `INTEGER` | Foreign Key -> `monitored_targets.id` (CASCADE) |
| `subdomain` | `TEXT` | Full subdomain (e.g., `api.example.com`) |
| `first_seen` | `INTEGER` | Discovery timestamp |
| `last_seen` | `INTEGER` | Last verification timestamp |

---

## Subdomain Recon Tables

### 5. `subfinder_scans`
Execution records for Subfinder runs.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | Primary Key (UUID) |
| `target` | `TEXT` | Root domain scanned |
| `status` | `TEXT` | `running`, `completed`, `failed` |
| `count` | `INTEGER` | Number of subdomains found |

### 6. `subfinder_results`
Individual subdomain results from a specific scan.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key |
| `scan_id` | `TEXT` | Foreign Key -> `subfinder_scans.id` (CASCADE) |
| `subdomain` | `TEXT` | The discovered subdomain |
| `is_new` | `BOOLEAN` | True if this is first discovery |

---

## HTTPX Tables (Live Assets)

### 7. `httpx_scans`
Execution records for HTTPX probing.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | Primary Key |
| `target` | `TEXT` | Domain being probed |
| `count` | `INTEGER` | Number of live hosts found |

### 8. `httpx_results`
Detailed technology stack and response data.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | Primary Key |
| `scan_id` | `TEXT` | Foreign Key -> `httpx_scans.id` (CASCADE) |
| `url` | `TEXT` | Full responding URL |
| `title` | `TEXT` | Page HTML title |
| `status_code` | `INTEGER` | HTTP Status (200, 403, etc.) |
| `technologies` | `TEXT` | JSON array of detected techs (NGINX, React, etc.) |
| `web_server` | `TEXT` | Server header |
| `response_time` | `TEXT` | Latency string |
| `screenshot_path` | `TEXT` | Path to screenshot file (if enabled) |
| `is_new` | `BOOLEAN` | True if first time seen live |

---

## System Tables

### 9. `settings`
Key-value store for global configuration.
| Column | Type | Description |
| :--- | :--- | :--- |
| `key` | `TEXT` | Primary Key (e.g., `telegram_bot_token`) |
| `value` | `TEXT` | Config value string |

### 10. `scheduler_logs`
Audit log of automation jobs.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key |
| `domain` | `TEXT` | Target domain |
| `status` | `TEXT` | `running`, `completed`, `error` |
| `subdomains_new` | `INTEGER` | Count of new subdomains found |
| `findings_count` | `INTEGER` | Count of vulnerabilities found |
| `error_message` | `TEXT` | Error details if failed |

---

## Performance Tuning
- **WAL Mode**: The database runs in Write-Ahead-Log mode (`journal_mode=WAL`), allowing simultaneous readers and one writer.
- **Connection Pooling**: `lib/db.ts` maintains a singleton connection to prevent file locking issues.
- **Prepared Statements**: All queries use `db.prepare()` with placeholder values for performance and security.
