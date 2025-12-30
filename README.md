<div align="center">

# 🛡️ Nuclei Command Center
### The Self-Hosted Vulnerability Operations Platform

[![License](https://img.shields.io/badge/license-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Stack](https://img.shields.io/badge/Stack-Next.js_15_&_React_19-black?style=for-the-badge)](https://nextjs.org/)

**Orchestrate your Nuclei & Subfinder scanners with a powerful, persistent dashboard.**
Turn ephemeral CLI output into a permanent, intelligent asset inventory.

[Features](#-features) • [Hosting Requirements](#-hosting) • [Installation](#-installation)

</div>

---

## ⚡ Key Capabilities

### 1. Smart Vulnerability Management
*   **Live Injection**: Deterministic deduplication of Findings.
*   **Lifecycle Tracking**: Automatically flags **NEW**, **FIXED**, and **REGRESSED** issues.
*   **AI Triage**: Google Gemini integration for instant impact analysis and remediation advice.

### 2. Live Asset Probing (HTTPX)
*   **Visual Recon**: Full-screen drill-down with captured screenshots.
*   **Tech Stack**: Automatic WAF, CMS, and framework detection.
*   **Change Detection**: Track when assets change status codes (e.g., 403 -> 200).

### 3. Attack Surface Monitoring (Subfinder)
*   **Continuous Inventory**: Keep a database of every subdomain ever found.
*   **"New Discoveries"**: Automatically diffs daily scans to highlight *only* fresh targets.

---

## 🖥️ Hosting & Requirements

This dashboard is designed to be **Self-Hosted** on a Cloud VPS (DigitalOcean, AWS, Hetzner, etc.).

**[📄 View Detailed Hosting Requirements](HOSTING_REQUIREMENTS.md)**
*(Includes Hardware Tiers & Software Prerequisites)*

**Quick Specs**:
*   **OS**: Ubuntu 22.04 LTS
*   **Runtime**: Node.js v20 LTS + Go 1.21+

---

## 🚀 Installation (Manual Cloud Setup)

Follow these steps to deploy on a fresh Ubuntu VPS.

### 1. System Prep
Install critical dependencies for SQLite.
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install build-essential -y
```

### 2. Install Binaries
Ensure `nuclei`, `subfinder`, and `httpx` are in your `$PATH`.
```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
```

### 3. Deploy Dashboard
Clone and build the application.
```bash
git clone https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard

# Install Deps (Compiles SQLite bindings)
npm install

# Setup Config
cp .env.example .env.local
nano .env.local # Set ADMIN_PASSWORD and AUTH_SECRET

# Build for Production
npm run build
```

### 4. Run with PM2
Keep it running 24/7.
```bash
npm install -g pm2
pm2 start npm --name "nuclei-dashboard" -- start
pm2 save
pm2 startup
```

Your dashboard is now live at `http://YOUR_SERVER_IP:3000`.

---

## 📜 License
Distributed under the **MIT License**.
