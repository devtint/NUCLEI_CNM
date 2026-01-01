<div align="center">

# 🛡️ Nuclei Command Center
### The Self-Hosted Vulnerability Operations Platform

[![License](https://img.shields.io/badge/license-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-Next.js_15_&_React_19-black?style=for-the-badge)](https://nextjs.org/)
[![Security](https://img.shields.io/badge/Security-Hardened-blue?style=for-the-badge)](#-security-features)

**Orchestrate your Nuclei & Subfinder scanners with a powerful, persistent dashboard.**
Turn ephemeral CLI output into a permanent, intelligent asset inventory.

[Features](#-features) • [Security](#-security-features) • [Installation](#-installation) • [Troubleshooting](#-troubleshooting)

</div>

---

## ⚡ Use Cases

### 🔍 For Bug Bounty Hunters
*   **Never Lose Context**: Every scan is saved. Compare today's findings with last month's.
*   **Visual Recon**: See what targets look like before you visit them (HTTPX Screenshots).
*   **Live Injection**: Fix findings in real-time without re-scanning.

### 🏢 For SecOps Teams
*   **Continuous Monitoring**: Run daily cron jobs via API to update your asset inventory.
*   **Drift Detection**: Automatically flagged when a "Fixed" issue re-appears (**Regression**) or a new subdomain pops up.
*   **Centralized Knowledge**: A single source of truth for all current exposures.

---

## 🌟 Key Capabilities

### 1. Smart Vulnerability Management
*   **Modern Card Interface**: Rich, visual card-based feed with severity-coded borders and inline actions (Copy, Rescan, Delete).
*   **Deduplication**: Intelligent hashing ensures you never see the same duplicate finding twice (even if protocols differ: `http` vs `https`).
*   **Lifecycle Tracking**:
    *   **🆕 NEW**: Fresh findings from recent scans.
    *   **✅ FIXED**: Issues that were present but vanished in the latest scan.
    *   **⚠️ REGRESSION**: Issues that were fixed but have returned.

### 2. Live Asset Probing (HTTPX)
*   **Visual Recon**: Full-screen drill-down with captured screenshots of every live target.
*   **Tech Stack**: Automatic detection of WAFs (Cloudflare, AWS), CMS (WordPress, Drupal), and frameworks (React, Vue).
*   **Change Detection**: Track when assets change status codes (e.g., 403 Forbidden -> 200 OK).

### 3. Attack Surface Monitoring (Subfinder)
*   **Continuous Inventory**: Keep a database of every subdomain ever found.
*   **"New Discoveries"**: Automatically diffs daily scans to highlight *only* fresh targets.
*   **Global Search**: Instantly search across thousands of assets by IP, Title, Technology, or Subdomain.

### 4. Scanner Management (System)
*   **Centralized Control**: Manage Nuclei, Subfinder, and HTTPX versions from a single interface.
*   **One-Click Updates**: Keep your engines and templates fresh with instant update actions.
*   **Smart Detection**: Automatically finds installed versions and template snapshots, with cross-platform support for Windows/Linux paths (e.g., `~/.local`).

---

## 🔒 Security Features (Hardened)

This dashboard is designed to be exposed to the internet safely.

1.  **Bcrypt Password Hashing**: Passwords are never stored in plain text.
2.  **HTTPS Enforcement**: Middleware automatically redirects all HTTP traffic to HTTPS in production.
3.  **Strict Env Validation**: server fails fast if security keys are missing.
4.  **Cross-Platform**: Full support for Linux, macOS, and Windows file systems.

---

## 🚀 Installation

### Prerequisites
*   **Node.js** v20+
*   **Go** 1.21+ (for scanners)
*   **OpenSSL** (for secret generation)

### 1. Install Scanners
Ensure `nuclei`, `subfinder`, and `httpx` are installed and in your global `$PATH`.
```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
```

### 2. Clone & Setup
```bash
git clone https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard

# Install Dependencies (Compiles SQLite bindings)
npm install
```

### 3. Configure Security
Create your local environment file and secure your admin credentials.

```bash
cp .env.example .env.local

# 1. Generate Auth Secret
openssl rand -base64 32
# -> Paste result into .env.local as AUTH_SECRET

# 2. Hash your Admin Password
node scripts/hash-password.js mySuperSecretPassword
# -> Paste extracted Hash into .env.local as ADMIN_PASSWORD_HASH
```

### 4. Run Development Server
```bash
npm run dev
# Dashboard available at http://localhost:3000
```

### 5. Production Deployment (PM2)
For 24/7 background running on a server:

```bash
npm run build
npm install -g pm2
pm2 start npm --name "nuclei-dashboard" -- start
pm2 save
pm2 startup
```

---

## 🔧 Troubleshooting

### "Invalid Credentials" Loop
If you cannot log in despite setting the hash correctness:
1.  Ensure you have **restarted the server** after changing `.env.local`.
2.  The application uses a robust fallback loader. Check the server console logs on startup for `ℹ️ Manually loaded .env.local keys`.
3.  Verify the hash matches using our test script:
    ```bash
    # Edit the script to use your password if needed
    node scripts/verify-env.js
    ```

### Scans Failing
*   **Permissions**: Ensure the process has write access to `dashboard/scans` and `dashboard/nuclei.db`.
*   **Path**: Use `which nuclei` to verify the binary path and update `lib/nuclei/config.ts` if your path is non-standard.

---

## 📜 License
Distributed under the **MIT License**.
