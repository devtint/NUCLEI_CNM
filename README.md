<div align="center">

# 🛡️ Nuclei Command Center
### The Self-Hosted Vulnerability Operations Platform

[![License](https://img.shields.io/badge/license-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Docker Hub](https://img.shields.io/badge/Docker_Hub-mrtintnaingwin/nuclei--command--center-2496ED?style=for-the-badge&logo=docker)](https://hub.docker.com/r/mrtintnaingwin/nuclei-command-center)
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

### 5. Backup & Restore
*   **Complete Data Export**: Create full backups of all Nuclei findings, Subfinder discoveries, and HTTPX results in a single JSON file.
*   **Secure Format**: Proprietary backup format with version metadata prevents accidental imports of incompatible data.
*   **Transaction-Safe Restore**: All-or-nothing restore with automatic rollback on errors ensures database integrity.
*   **Import External Scans**: Upload Nuclei JSON output from CI/CD pipelines or remote scans for centralized management.
*   **Duplicate Prevention**: Automatic deduplication during restore prevents data conflicts.

---

## 🔒 Security Features (Hardened)

This dashboard is designed to be exposed to the internet safely.

1.  **Bcrypt Password Hashing**: Passwords are never stored in plain text.
2.  **HTTPS Enforcement**: Middleware automatically redirects all HTTP traffic to HTTPS in production.
3.  **Strict Env Validation**: server fails fast if security keys are missing.
4.  **Cross-Platform**: Full support for Linux, macOS, and Windows file systems.

---

## 🚀 Installation

### 🐳 Docker Deployment (Recommended)

**Pre-built image available!** No Node.js or Go installation required.

#### Option A: Pull from Docker Hub (30 seconds)
```bash
# Pull the image
docker pull mrtintnaingwin/nuclei-command-center:latest

# Run with persistent storage
docker run -d \
  --name nuclei-command-center \
  -p 3000:3000 \
  -v nuclei-data:/app/data \
  -v nuclei-config:/root/.config/nuclei \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  -e ADMIN_PASSWORD_HASH="your_bcrypt_hash_here" \
  mrtintnaingwin/nuclei-command-center:latest

# Access at https://localhost:3000
```

#### Option B: Docker Compose (from source)
```bash
# Switch to docker branch for full Docker setup
git clone -b docker https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard
docker-compose up -d
```

**What's Included in Docker:**
✅ Nuclei v3, Subfinder v2, HTTPX (latest)  
✅ Persistent database (survives restarts)  
✅ SSL/HTTPS certificates  
✅ Volume-mounted scan results  
✅ Alpine Linux (2.74GB image)

📦 **Docker Branch:** [github.com/devtint/NUCLEI_CNM/tree/docker](https://github.com/devtint/NUCLEI_CNM/tree/docker)

---

### 💻 Manual Installation

For development or customization without Docker.

#### Prerequisites
*   **Node.js** v20+
*   **Go** 1.21+ (for scanners)
*   **OpenSSL** (for secret generation)

#### 1. Install Scanners
```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
```

#### 2. Clone & Setup
```bash
git clone https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard
npm install
```

#### 3. Configure Security
```bash
cp .env.example .env.local

# Generate Auth Secret
openssl rand -base64 32
# -> Paste into .env.local as AUTH_SECRET

# Hash Admin Password
node scripts/hash-password.js YOUR_PASSWORD
# -> Paste into .env.local as ADMIN_PASSWORD_HASH
```

#### 4. Run Development
```bash
npm run dev
# Dashboard at http://localhost:3000
```

#### 5. Production (PM2)
```bash
npm run build
npm install -g pm2
pm2 start npm --name "nuclei-dashboard" -- start
pm2 save && pm2 startup
```

---

## 🔧 Troubleshooting

### Docker Issues
**"Invalid Credentials"**
```bash
docker logs nuclei-command-center | grep AUTH
docker exec nuclei-command-center node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"
```

**Database not persisting**
```bash
docker volume inspect nuclei-data
docker exec nuclei-command-center ls -lh /app/data/
```

---

### Manual Installation Issues

**"Invalid Credentials" Loop**
1.  Restart server after changing `.env.local`
2.  Check console for `ℹ️ Manually loaded .env.local keys`
3.  Verify: `node scripts/verify-env.js`

**Scans Failing**
*   Ensure write access to `dashboard/scans` and `dashboard/nuclei.db`
*   Verify scanner path: `which nuclei`

---

## 📜 License
Distributed under the **MIT License**.
