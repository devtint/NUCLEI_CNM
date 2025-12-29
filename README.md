<div align="center">

# 🛡️ Nuclei Command Center (CNM)
### The Ultimate Self-Hosted Vulnerability Management Platform

[![License](https://img.shields.io/badge/license-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-1.5_Flash-8E75B2?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

**Turn your Nuclei & Subfinder CLI tools into a sophisticated Security Operations Center.**

[Features](#-features) • [Smart Workflow](#-smart-workflow) • [Installation](#-installation) • [Configuration](#-configuration)

</div>

---

## 🚀 Overview

**Nuclei Command Center** isn't just a UI wrapper; it's an intelligent layer on top of ProjectDiscovery's most powerful tools. It solves the chaos of managing thousands of CLI outputs by providing a unified, persistent database and a smart triage workflow.

Whether you are a **Bug Bounty Hunter**, **Pentester**, or **SOC Analyst**, this dashboard organizes your chaos into actionable insights.

---

## ✨ Features In-Depth

### 🧠 1. Smart Vulnerability Management
Stop drowning in duplicate CSVs. We treat findings as *living objects*.
*   **Live Ingestion**: Vulnerabilities appear in the dashboard the second they are found.
*   **Intelligent Deduplication**: Uses deterministic hashing (Template ID + Host + Matcher) to ensure unique findings.
*   **Lifecycle Tracking**:
    *   🔵 **New**: Freshly discovered.
    *   🟢 **Fixed**: Automatically detected when a rescan finds the issue is gone.
    *   🔴 **Regression**: Automatically flagged if a "Fixed" issue reappears.
    *   ⚪ **Closed/False Positive**: Manually mark findings to hide them from reports.

### 🌐 2. Asset Inventory & Monitoring (Subfinder)
Know your attack surface.
*   **Continuous Inventory**: Keeps a persistent database of every target you've ever scanned.
*   **"New Discoveries" Feed**: Automatically diffs scan results against history.
    *   *Example*: Scanning `Uber.com` today vs yesterday? It will **only** show you the 5 new subdomains found today.
*   **One-Click pivot**: Click any asset in your inventory to instantly launch a Nuclei scan against it.

### 🤖 3. AI-Powered Triage (Gemini)
Don't just find bugs; understand them.
*   **Executive Summaries**: One-click generation of professional risk assessments for any finding.
*   **Context Aware**: AI analyzes the specific request/response and template description to explain *why* it matters.
*   **Remediation Advice**: Get instant, actionable fix context without leaving the dashboard.

### 📊 4. Professional Reporting
Deliver value instantly.
*   **Instant PDF Reports**: Client-ready reports with:
    *   Executive Summary & Scorecard.
    *   Severity Distribution Charts.
    *   Color-coded finding details.
*   **Excel (.xlsx) Export**: Fully colorized spreadsheets for audit logs or data analysis.
*   **Search & Filter**: Powerful boolean filtering by Host, Severity, Status, or Template Name.

### 🛡️ 5. Enterprise-Grade Security
Built to be safe.
*   **Secure Authentication**: NextAuth.js protection loop (Username/Password).
*   **Environment Isolation**: Development logs distinct from production findings.
*   **Dark Mode UI**: "Black & Emerald" theme optimized for low-light SOC environments.

---

## 🔄 Smart Workflows

### The "Fix & Verify" Loop
1.  **Detect**: Run a **Full Scan** preset on `example.com`.
2.  **Triage**: Finding marked as `Critical` (SQL Injection). AI Summary generated.
3.  **Remediate**: Developer patches the code.
4.  **Verify**: Click **"Rescan"** on the specific finding.
    *   *Scenario A*: Vulnerability is gone ➡️ Status updates to **Fixed**.
    *   *Scenario B*: Vulnerability persists ➡️ Status remains **Confirmed** (Timestamp updated).

### The "Continuous Monitoring" Loop
1.  **Monitor**: Run **Subfinder** on `target.com`.
2.  **Diff**: Dashboard highlights **3 New Subdomains** in the "New Discoveries" feed.
3.  **Scan**: Click the 🎯 **Scan** button on the new assets to run Nuclei.
4.  **Alert**: If vulnerabilities are found, they populate the main feed.

---

## 🛠️ Technology Stack

This project is built on the bleeding edge of modern web development:

| Layer | Tech | Why? |
|-------|------|------|
| **Core** | **Next.js 15 (App Router)** | Server-side stability & speed. |
| **Engine** | **React 19** | Latest hooks and state management. |
| **Database** | **SQLite (better-sqlite3)** | Local, fast, zero-config persistence. WAL mode enabled. |
| **UI** | **Tailwind CSS + Shadcn** | Beautiful, accessible, responsive components. |
| **Scanners** | **Nuclei & Subfinder** | Native binary wrappers for raw performance. |
| **Log/Stream** | **Node.js Streams** | Handles large outputs without memory leaks. |

---

## 🚀 Installation

### Prerequisites
1.  **Node.js** v18+ 
2.  **Nuclei** & **Subfinder** installed and added to system PATH.

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard

# 2. Install dependencies (Approx. 30s)
npm install

# 3. Setup Environment
cp .env.example .env.local
# (Edit .env.local with your passwords/API keys)

# 4. Ignite 🚀
npm run dev
```

Visit `http://localhost:3000` to access your command center.

---

## 🔐 Configuration

**File**: `dashboard/.env.local`

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | 32-char random string for session encryption. |
| `ADMIN_PASSWORD` | The password to access the dashboard. |
| `GEMINI_API_KEY` | (Optional) Google Gemini API Key for AI features. |

---

## 🤝 Contributing

We love builders! If you have a feature idea:
1.  Fork the repo.
2.  Create a feature branch (`git checkout -b feature/EpicMod`).
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.

---

## 📜 License

Distributed under the **MIT License**. Free for everyone.

<div align="center">
<i>"Information is power. But like all power, there are those who want to keep it for themselves."</i>
</div>
