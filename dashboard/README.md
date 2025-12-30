# 📟 Dashboard Technical Documentation

This document details the internal architecture, database schema, and component structure of the **Nuclei Command Center**. It is intended for developers contributing to the codebase.

---

## 🏗️ Architecture

The app uses a **Hybrid Architecture** (Next.js App Router):
1.  **Backend (API Routes)**: Handles `child_process` spawning for CLI tools (Nuclei, Subfinder, Httpx) and SQLite `better-sqlite3` operations.
2.  **Frontend (React 19)**: Client-side polling for real-time updates using `SWR`-like patterns (custom `useEffect` hooks).

---

## 🗄️ Database Schema

We use **SQLite** with WAL mode for high-concurrency performance.

### 1. Scanning Tables
Tracks the execution metadata of CLI tools.
*   `scans`: Nuclei execution records.
*   `subfinder_scans`: Subfinder session records.
*   `httpx_scans`: Live probing session records (`pid`, `status`, `log_path`).

### 2. Findings (Nuclei)
*   **Table**: `findings`
*   **Unique Constraint**: `hash(template_id + host + matched_at)`
*   **Lifecycle**:
    *   `is_new`: Boolean flag for day-over-day diffing.
    *   `status`: 'new', 'fixed', 'regressed', 'false_positive'.

### 3. Asset Inventory (Subfinder)
*   `monitored_targets`: Parent domains.
*   `monitored_subdomains`: Flattened list of all found subdomains.
*   **Diff Logic**: `subfinder_results` table stores per-scan data to calculate "New Discoveries".

### 4. Probing (HTTPX)
Real-time validation data.
*   **Table**: `httpx_results`
*   **Key Columns**:
    *   `url`, `title`, `tech` (JSON), `webserver`
    *   `response_time`: String (e.g., "45ms").
    *   `host_ip`: Critical for network mapping.
    *   `change_status`: 'new', 'old', 'changed' (Diffs against previous scans).
    *   `screenshot_path`: Relative path to `public/screenshots/`.

---

## 🧩 Component Library Update

### `httpx/HttpxPanel.tsx`
The primary interface for Asset Probing.
*   **View Modes**:
    *   **Grid**: Card-based list of assets with "Quick Copy" buttons.
    *   **Detail (Full Screen)**: Conditional rendering overlay for deep-dive analysis.
*   **Key Logic**:
    *   `useEffect` ordering fixed for safe conditional rendering.
    *   `AlertDialog` integration for destructive actions.

### `ui/alert-dialog.tsx`
*   New primitive based on Radix UI.
*   Used for "Delete Single Scan" and "Delete All History" warnings.

---

## ⚡ Performance Notes for Cloud Hosting

When deploying to a VPS (Manual Setup):
1.  **Concurrency**: If using the **Heavy** tier presets, ensure the VPS has at least 4 vCPUs. `nuclei` + `httpx` running in parallel can easily saturate smaller instances.

---
*Maintained by the Antigravity Team*
