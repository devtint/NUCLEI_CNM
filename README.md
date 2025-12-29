<div align="center">

# 🛡️ Nuclei Command Center

### The Modern, Smart Interface for Nuclei Vulnerability Scanner

[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-8E75B2?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

[Features](#-features) • [Smart Rescan](#-smart-rescan) • [Installation](#-installation) • [Configuration](#-configuration)

</div>

---

## ✨ Features

### 🧠 Smart & AI-Powered
- **AI Executive Summaries**: One-click generation of professional executive summaries for your findings using **Google Gemini AI**.
- **Smart Rescan**: 
    - **Auto-Fix Detection**: Automatically marks findings as "Fixed" if a rescan returns clean.
    - **Regression Handling**: Automatically re-opens "Fixed" findings to "Confirmed" if the vulnerability reappears.
- **Intelligent Deduplication**: Hash-based system prevents duplicate findings across multiple scans.

### 🚀 High-Performance Scanning
- **One-Click Presets**: Pre-configured modes for common workflows (Critical Only, Full Scan, Tech Detect, etc).
- **Native Engine**: Wraps the official Nuclei binary for maximum speed and compatibility.
- **Real-Time Analytics**: Live finding counts and status updates without page refreshes.

### 📊 Professional Reporting
- **Instant PDF Export**: Generate client-ready PDF reports with severity color coding.
- **Excel Export**: Detailed `.xlsx` exports for data analysis.
- **Advanced Filtering**: Filter by Status, Severity, or search specifically by Host.

### 🛡️ Secure & Enterprise Ready
- **Secure Authentication**: Built-in Admin login loop protected by NextAuth.js.
- **Environment Isolation**: Activity logs are kept clean by isolating single-target rescans from the main history.
- **High Contrast UI**: Optimized "Black" mode for readability in SOC environments.

---

## 🚀 Installation

### Prerequisites
- **Node.js** v18+
- **Nuclei** v3.6.0+ (Must be in system PATH)
- **Subfinder** v2.6.0+ (Must be in system PATH)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/devtint/NUCLEI_CNM.git

# 2. Navigate to dashboard
cd NUCLEI_CNM/dashboard

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
```

---

## 🔐 Configuration

Create a `.env.local` file in the `dashboard` directory to secure your instance and enable AI features.

```env
# 1. Security (Required)
# Random 32-character string for cookie encryption
AUTH_SECRET="your-super-secret-key-at-least-32-chars"
ADMIN_PASSWORD="your-secure-password"

# 2. AI Features (Optional)
# Get your key from https://aistudio.google.com/
GEMINI_API_KEY="your-gemini-api-key"
```

> **Note**: If `GEMINI_API_KEY` is missing, the "Summarize" button will simply be hidden.

---

## 🔄 Smart Rescan Workflow

The dashboard features an intelligent rescan system designed to save time:

1.  **Click "Rescan"** on any finding in the Vulnerability Feed.
2.  **The System verifies the finding** against the target using the specific template.
3.  **Auto-Action**:
    *   **✅ Fixed**: If the vulnerability is gone, the status updates to **Fixed**.
    *   **⚠️ Regression**: If it was previously fixed but returned, the status updates to **Confirmed**.
    *   **ℹ️ Updated**: If details changed (e.g., different response size), the finding is updated.

---

## 📖 Scanning Presets

| Preset | Command Flags | Best For |
|--------|---------------|----------|
| **Full Scan** | `none` | Comprehensive security assessment. |
| **Critical Only** | `-s critical` | Quick triage of most dangerous issues. |
| **Tech Detect** | `-tags tech` | Identifying stack technologies (fingerprinting). |
| **CVEs (2023-24)** | `-tags cve2023,cve2024` | Checking for recent critical vulnerabilities. |
| **Misconfig** | `-tags misconfig` | Finding security header/server issues. |
| **Exposed Panels** | `-tags panel` | Locating admin interfaces and login pages. |

---

## 🛠️ Tech Stack

<div align="center">

| Component | Technology |
|-----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **UI Library** | React 19 + Tailwind CSS |
| **Components** | shadcn/ui + Lucide Icons |
| **Notifications** | Sonner (Toast) |
| **Database** | SQLite (better-sqlite3) |
| **Auth** | NextAuth.js v5 |
| **AI Model** | Google Gemini 1.5 Flash |

</div>

---

## 📢 Contributing

Contributions are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">
Built with ❤️ for the security community
</div>
