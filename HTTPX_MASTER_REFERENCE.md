# HTTPX Master Technical Reference & Integration Guide

**Status**: Ready for Implementation
**Source**: CLI Usage & Running Docs
**Purpose**: Complete reference for integrating HTTPX into the Nuclei Command Center ecosystem without errors.

---

## 1. Core Architecture & Usage Logic

HTTPX is a fast and multi-purpose HTTP toolkit. For our dashboard, it acts as the **enrichment layer**—taking raw domains (from Subfinder) and turning them into "Live Assets" with metadata (Status, Tech Stack, Title, IP).

### Critical Operational Rules (From Docs)
1.  **Fallback Behavior**: By default, `httpx` probes HTTPS -> Fallback to HTTP.
    *   *Correction Flag*: Use `-no-fallback` to force probing both protocols explicitly if needed.
2.  **Input Methods**:
    *   **Pipe**: `subfinder ... | httpx` (Best for our "Tool Chain").
    *   **CIDR**: `173.0.84.0/24`.
    *   **ASN**: `AS14421`.
    *   **File**: `-l hosts.txt`.
3.  **Performance**:
    *   Screenshots (`-ss`) use a headless browser and **significantly slow down** scans. Use optional toggle in UI.

---

## 2. Complete Flag Dictionary (For UI Config)

When building the UI Config Form, map these inputs to these flags.

### 🔍 Probes (Data Extraction)
These flags determine *what columns* we need in our database.

| UI Label | Flag | Database Column | Notes |
| :--- | :--- | :--- | :--- |
| Status Code | `-sc` | `status_code` | Essential. |
| Page Title | `-title` | `title` | Essential. |
| Tech Detect | `-td` | `technologies` | Returns array (e.g. `[React, Nginx]`). |
| Content Length | `-cl` | `content_length` | Useful for diffing. |
| Web Server | `-server` | `web_server` | e.g. "nginx/1.18". |
| Response Time | `-rt` | `response_time` | Latency monitoring. |
| Favicon Hash | `-favicon` | `favicon_hash` | For tracking frameworks. |
| JARM Hash | `-jarm` | `jarm_hash` | Active TLS fingerprinting. |
| IP Address | `-ip` | `ip` | Host resolution. |
| CNAME | `-cname` | `cname` | DNS pointers. |
| CDN/WAF | `-cdn` | `cdn_name` | e.g. "Cloudflare". |
| Location | `-location` | `location` | Redirect target. |

### 🛠️ Scan Configuration (Advanced Settings)
| Feature | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| **Methods** | `-x` | `GET` | Verb `all` probes all methods. |
| **Threads** | `-t` | `50` | Concurrency control. |
| **Rate Limit** | `-rl` | `150` | Requests per second. |
| **Follow Redirects** | `-fr` | `false` | Vital for true status. |
| **Ports** | `-p` | `80,443` | Can specify `http:80,https:443`. |
| **Screenshots** | `-ss` | `false` | Requires Chrome/Headless. |

### 🛑 Filtering & Matching (For Search/Post-Processing)
*Do not use these in general scans usually, as we want to save RAW data to DB and filter in the UI.*
*   `-mc`: Match Code (e.g., `200`).
*   `-fc`: Filter Code (e.g., `404`).
*   `-ms`: Match String.

---

## 3. Recommended Database Schema

Based on the flags above, here is the robust schema for the `httpx_results` table to be built later.

```sql
CREATE TABLE httpx_results (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL,
    url TEXT NOT NULL,           -- Full URL (https://example.com)
    host TEXT NOT NULL,          -- Domain only (example.com)
    port INTEGER,                -- 443
    scheme TEXT,                 -- https
    title TEXT,                  -- "Example Domain"
    status_code INTEGER,         -- 200
    subdomain TEXT,              -- For linking to subfinder
    technologies TEXT,           -- JSON Array: ["React", "Express"]
    web_server TEXT,
    content_type TEXT,
    content_length INTEGER,
    response_time TEXT,
    ip TEXT,
    cname TEXT,
    cdn_name TEXT,
    is_new BOOLEAN,
    timestamp INTEGER,
    FOREIGN KEY(scan_id) REFERENCES httpx_scans(id)
);
```

---

## 4. Integration Logic (The "Build" Plan)

### Step A: The Command Construction
When the user clicks "Enriched Scan" in Dashboard:
1.  **Base Command**: `httpx -json` (Always use JSON for parsing).
2.  **Input**: Pass targets via `stdin` or `-l` file.
    *   *Pattern*: `subfinder -d target.com -silent | httpx -json ...`
3.  **Standard Flags**: We should likely *always* run with:
    *   `-title -sc -td -ip -cname -server` (Maximum metadata).
4.  **Screenshot Mode**: If user toggles "Visual Recon":
    *   Add `-ss -srd ./scans/screenshots`.

### Step B: Parsing JSON Output
HTTPX `-json` output is JSONL (JSON Lines).
**Node.js Parser Logic**:
```typescript
child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
        try {
            const data = JSON.parse(line);
            // Map data.url -> db.url
            // Map data.title -> db.title
            // Map data.tech -> db.technologies
            saveToDb(data);
        } catch (e) { /* Buffer split edge case */ }
    });
});
```

### Step C: Usage Scenarios (From Running Docs)

**Scenario 1: Subdomain Discovery & Probing**
*Command*: `subfinder -d example.com -silent | httpx -title -tech-detect -status-code -json`
*Use Case*: Main dashboard "Inventory" view.

**Scenario 2: API Discovery (Fuzzing)**
*Command*: `httpx -l urls.txt -path /v1/api -sc -json`
*Use Case*: Specific "API Scan" mode in Wizard.

**Scenario 3: Error Page Filtering**
*Command*: `httpx ... -fep -json`
*Use Case*: Cleaning up "garbage" results in the findings table.

---

## 5. Troubleshooting Reference

*   **Error**: `Cannot read properties of undefined`
    *   *Fix*: Ensure API always returns default object structure even if binary fails.
*   **Error**: `Port in use` or Socket errors.
    *   *Fix*: Respect `-rl` (Rate Limits) to avoid DOSing the local network stack.
*   **Dependecy**: `httpx` binary must be in PATH or defined in `.env`.
*   **Screenshots**: Require `chrome` installed or `-system-chrome` flag if local Chrome is present.
