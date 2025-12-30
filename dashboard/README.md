# 📟 Dashboard Technical Documentation

This document provides a deep dive into the technical architecture, component structure, and database schema of the **Nuclei Command Center Dashboard**.

It is intended for developers, contributors, and power users who want to understand "how it works" under the hood.

---

## 🏗️ Architecture Overview

The application uses a **Hybrid Architecture** combining:
1.  **Server-Side Logic (Next.js API Routes)**: Handles CLI execution, file system access, and SQLite operations.
2.  **Client-Side UI (React)**: Handles real-time state, polling, and interactivity.

### Data Flow
1.  **Trigger**: User clicks "Start Scan".
2.  **API**: `/api/scan` spawns a `child_process` (Nuclei/Subfinder).
3.  **Stream**: The process stdout/stderr is piped to a `.log` file and a `.json` file.
4.  **Parsing**: On process exit (or during stream), JSON output is parsed and **UPSERTED** into `nuclei.db`.
5.  **UI**: The frontend polls `/api/scan?id=...` and `/api/findings` to update the interface live.

---

## 🗄️ Database Schema (SQLite)

We use `better-sqlite3` for synchronous, high-performance database access. The database is located at `dashboard/nuclei.db`.

### 1. Unified Scanning Tables
These tables track the execution of scans.

| Table | Description | Key Fields |
|-------|-------------|------------|
| `scans` | Nuclei scan metadata. | `id`, `target`, `status`, `exit_code`, `json_file_path` |
| `subfinder_scans` | Subfinder scan metadata. | `id`, `target`, `status`, `count` |
| `httpx_scans` | HTTPX probing metadata. | `id`, `target`, `status`, `count`, `pid` |

### 2. Findings & Vulnerabilities
The core intelligence tables.

| Table | Description | Key Fields |
|-------|-------------|------------|
| `findings` | Stores individual vulnerability occurrences. | `scan_id`, `template_id`, `severity`, `status` (New, Fixed...), `raw_json` |

> **Unique Constraint**: findings are deduplicated using a hash of `template_id + host + matched_at`. This allows us to track the *same* vulnerability across multiple scans.

### 3. Asset Inventory (Subfinder)
The continuous monitoring layer.

| Table | Description | Key Fields |
|-------|-------------|------------|
| `monitored_targets` | Distinct parent domains being tracked. | `target`, `last_scan_date`, `total_count` |
| `monitored_subdomains` | Global list of unique subdomains per target. | `subdomain`, `first_seen`, `last_seen` |
| `subfinder_results` | Results specific to a single execution. | `scan_id`, `subdomain`, `is_new` (Boolean) |

### 4. Probing (HTTPX)
Real-time asset validation.

| Table | Description | Key Fields |
|-------|-------------|------------|
| `httpx_results` | Live asset data. | `scan_id`, `url`, `title`, `tech`, `response_time`, `change_status` (new/old), `screenshot_path` |

---

## 🔌 API Reference

### Core Scanner
*   `POST /api/scan`: Start a Nuclei scan. Accepts `target` and `template` presets.
*   `DELETE /api/scan`: Kill a running scan process.
*   `GET /api/scan`: Retrieve scan history or status.

### Findings
*   `GET /api/findings`: Retrieve filtered vulnerabilities. Supports query params: `status`, `severity`, `host`.
*   `PATCH /api/findings`: Update status (e.g., mark as False Positive).
*   `POST /api/rescan`: Trigger a single-template rescan for verification.

### Subfinder
*   `POST /api/subfinder`: Start enumeration.
*   `GET /api/subfinder/inventory`: Get Asset Inventory & Subdomain details.
*   `DELETE /api/subfinder/inventory`: Remove a target from inventory.

---

## 🧩 Component Library

The UI is built using modular, reusable components in `dashboard/components/`.

### `dashboard/`
*   `DashboardClient.tsx`: The main layout controller. Handles view switching (Overview <-> Scan <-> Findings).
*   `Stats.tsx`: Statistic cards (Total Scans, Critical Findings, etc).

### `findings/`
*   `Table.tsx`: The massive Data Table component. Handles:
    *   Sorting & Pagination.
    *   Multi-select Severity filtering.
    *   Excel/PDF Export logic.
*   `FindingDetails.tsx`: The Modal/Dialog view showing Request/Response tabs.

### `subfinder/`
*   `SubfinderPanel.tsx`: The container for the Subfinder module.
*   `ResultsFeed.tsx`: The "New Discoveries" UI.
    *   **Logic**: Compares `first_seen` vs `last_seen` to display "New" badges.

### `scan/`
*   `Wizard.tsx`: The "New Operation" form.
*   `LiveConsole.tsx`: A real-time log viewer that tails the `.log` file of scanning processes.
*   `TargetListManager.tsx`: A dialog text-editor & uploader for managing `.txt` target lists.
    *   **Features**: Drag & drop upload, manual creation (copy-paste), and persistent file storage in `scans/uploads/`.

### `httpx/`
*   `HttpxPanel.tsx`: The real-time asset probing interface. Features:
    *   **Full Screen Drill-down**: Detailed view with screenshots and metadata.
    *   **Live Metrics**: Latency, content-length, and status codes.
    *   **History**: Scan history with "Delete" capabilities (using `AlertDialog`).

### `ui/`
*   Shadcn UI primitives including the new `alert-dialog.tsx` for destructive confirmations.


---

## 🤖 AI Integration (Gemini)

The AI logic is located in `dashboard/lib/ai.ts`.
*   **Model**: `gemini-1.5-flash`
*   **Prompt Engineering**: The system prompt instructs Gemini to act as a Senior Security Engineer.
*   **Input**: It receives the Finding Name, Description, and HTTP Request/Response snippet.
*   **Output**: A structured markdown summary with "Impact", "Analysis", and "Remediation".

---

## 📂 File Structure

```
dashboard/
├── app/                  # Next.js App Router
│   ├── api/              # Backend API Endpoints
│   └── page.tsx          # Entry Point
├── components/           # React Components
│   ├── ui/               # Shadcn UI primitives (Button, Card, etc.)
│   └── findings/         # Business logic components
├── lib/                  # Utilities
│   ├── db.ts             # Database Connection & Helpers
│   ├── ai.ts             # Gemini Integration
│   └── utils.ts          # Helper functions
├── public/               # Static assets
└── scans/                # Runtime folder for logs & JSON outputs
```

---

## ⚡ Performance Optimizations

1.  **WAL Mode**: SQLite Write-Ahead Logging is enabled for better concurrency.
2.  **Optimistic UI**: Use `useTransition` and local state for instant feedback on deletions/updates.
3.  **Dynamic Routes**: Usage of `export const dynamic = 'force-dynamic'` ensures APIs are not stale cached by Next.js.
4.  **Lazy Loading**: Heavy components (like Charts) are lazy loaded.

---

## 🛠️ Debugging

If you encounter issues:
1.  **Check Logs**: Look at the terminal output where `npm run dev` is running.
2.  **Database**: You can open `nuclei.db` with any SQLite viewer (e.g., *DB Browser for SQLite*) to inspect raw data.
3.  **Scan Artifacts**: Check `dashboard/scans/` to see if the raw CLI tool actually produced output files.

---

*Written by the Antigravity Team*
