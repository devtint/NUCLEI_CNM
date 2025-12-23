<div align="center">

# 🛡️ Nuclei Command Center

### Modern Web Interface for Nuclei Vulnerability Scanner

[![GitHub Stars](https://img.shields.io/github/stars/devtint/NUCLEI_CNM?style=for-the-badge&logo=github&color=yellow)](https://github.com/devtint/NUCLEI_CNM/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/devtint/NUCLEI_CNM?style=for-the-badge&logo=github&color=blue)](https://github.com/devtint/NUCLEI_CNM/network/members)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Screenshots](#-screenshots)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 **One-Click Presets**
7 pre-configured scans including Full Scan with no filters

### 🔴 **Real-Time Monitoring**
Database-backed activity monitor with scan history

### 📊 **Vulnerability Feed**
Multi-select severity filtering and status management

</td>
<td width="50%">

### 📝 **Custom Templates**
Create and manage your own Nuclei templates

### 💾 **Database Storage**
SQLite database with intelligent deduplication

### 🔄 **Smart Deduplication**
Hash-based system prevents duplicate findings

### ⚙️ **Performance Tuning**
Configure rate limiting and concurrency settings

</td>
</tr>
</table>

### 🎯 Key Features

- **Finding Deduplication**: Intelligent hash-based system prevents duplicate findings across scans
- **Status Management**: Track findings as New, Confirmed, False Positive, Fixed, Closed, or Regression  
- **Regression Detection**: Automatically detects when fixed vulnerabilities reappear
- **Historical Tracking**: First seen / last seen timestamps for all findings
- **Status Preservation**: User-assigned statuses persist across rescans

### 🌐 **Subdomain Discovery** (*Powered by Subfinder*)
- **Integrated Workflow**: Discover subdomains and instantly pivot to vulnerability scanning
- **One-Click Presets**: Standard, Recursive, All Sources, and Deep & Active scan modes
- **Results Feed**: Searchable history of all discovered subdomains with "Scan" actions
- **Activity Monitor**: Real-time log monitoring for long-running discovery jobs

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
Node.js v18+
Nuclei v3.6.0+ (installed and in PATH)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/devtint/NUCLEI_CNM.git

# Navigate to dashboard
cd NCNC/dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

🌐 Open **http://localhost:3000** in your browser

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| 🚀 [**Getting Started**](./Refrencce%20and%20Usage%20And%20Guide/GETTING_STARTED.md) | Installation and first scan tutorial |
| 🏗️ [**Architecture**](./Refrencce%20and%20Usage%20And%20Guide/ARCHITECTURE.md) | System design and data flow |
| 🔌 [**API Reference**](./Refrencce%20and%20Usage%20And%20Guide/API_REFERENCE.md) | Complete API documentation |
| 🧩 [**Components**](./Refrencce%20and%20Usage%20And%20Guide/COMPONENTS.md) | React component documentation |

---

## 🎯 One-Click Presets

| Preset | Flags | Description |
|--------|-------|-------------|
| ⚡ **Full Scan** | `none` | All templates - comprehensive scan |
| 🔴 **Full Scan (Critical)** | `-s critical` | Critical severity vulnerabilities only |
| 🟠 **Full Scan (High/Crit)** | `-s critical,high` | High and critical vulnerabilities |
| 🔍 **Tech Detect** | `-tags tech` | Technology detection and fingerprinting |
| 🆕 **CVEs (2023-2024)** | `-tags cve2023,cve2024` | Recent CVE vulnerabilities |
| ⚙️ **Misconfigurations** | `-tags misconfig` | Security misconfigurations |
| 🔐 **Panels & Logins** | `-tags panel,login` | Exposed admin panels and login pages |

---

## 💻 Technology Stack

<div align="center">

| Frontend | Backend | UI/UX |
|----------|---------|-------|
| ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) | ![Node.js](https://img.shields.io/badge/Node.js-API-339933?style=flat-square&logo=node.js) | ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css) |
| ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react) | ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript) | ![shadcn/ui](https://img.shields.io/badge/shadcn/ui-Components-000000?style=flat-square) |

</div>

**Scanning Engine:** Native Nuclei Binary Integration

---

## 📁 Project Structure

```
NCNC/
├── 📂 dashboard/                    # Next.js Application
│   ├── 📂 app/                      # App Router
│   │   ├── 📂 api/                  # API Routes (Backend)
│   │   │   ├── findings/            # Vulnerability findings API
│   │   │   ├── history/             # Scan history API
│   │   │   ├── scan/                # Scan execution API
│   │   │   ├── stream/              # Real-time log streaming
│   │   │   └── templates/           # Template management API
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Main dashboard
│   │   └── globals.css              # Global styles
│   ├── 📂 components/               # React Components
│   │   ├── dashboard/               # Dashboard views
│   │   ├── findings/                # Vulnerability feed
│   │   ├── scan/                    # Scan management
│   │   ├── templates/               # Template management
│   │   └── ui/                      # shadcn/ui components
│   ├── 📂 lib/                      # Utilities
│   │   ├── db.ts                    # Database operations
│   │   ├── cache.ts                 # Response caching
│   │   ├── errors.ts                # Error handling
│   │   └── nuclei/                  # Nuclei configuration
│   ├── 📂 scans/                    # Scan results (gitignored)
│   └── 📄 nuclei.db                 # SQLite database (gitignored)
├── 📂 Refrencce and Usage And Guide/ # Documentation
└── 📄 guide.txt                     # Original requirements
```

---

## ⚡ Performance Settings

Configure in **Settings** panel:

| Setting | Range | Default | Recommended |
|---------|-------|---------|-------------|
| **Rate Limit** | 50-1000 req/s | 150 | 300-500 |
| **Concurrency** | 25-300 templates | 25 | 75-100 |
| **Bulk Size** | 25-100 hosts | 25 | 50 |

> ⚠️ **Note:** Higher values = faster scans, but may trigger WAF/rate limiting

---

## 🔒 Security

<div align="center">

| ⚠️ Important Security Notes |
|----------------------------|
| **Local Use Only** - No authentication implemented |
| **Scan Permissions** - Only scan targets you own or have permission to test |
| **Rate Limiting** - High rates can be considered DoS attacks |
| **Data Privacy** - Scan results contain sensitive information |

</div>

---

## 🛠️ Development

### Running in Development
```bash
cd dashboard
npm run dev
```

### Building for Production
```bash
cd dashboard
npm run build
npm start
```

### Linting
```bash
npm run lint
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🐛 Troubleshooting

<details>
<summary><b>Scan Stuck in "Running"</b></summary>

Restart the dashboard server. This usually happens when the Nuclei process is waiting for input.
</details>

<details>
<summary><b>No Findings Shown</b></summary>

Check scan history to confirm the scan completed with 0 vulnerabilities. This is normal for secure targets.
</details>

<details>
<summary><b>Nuclei Command Not Found</b></summary>

Ensure Nuclei is installed and added to your system PATH. Run `nuclei -version` to verify.
</details>

For more troubleshooting, see [Getting Started Guide](./Refrencce%20and%20Usage%20And%20Guide/GETTING_STARTED.md#troubleshooting).

---

## 📜 License

This project wraps the Nuclei binary. Nuclei is licensed under the MIT License.

---

## 🙏 Acknowledgments

<div align="center">

Built with amazing open-source tools:

[![Nuclei](https://img.shields.io/badge/Nuclei-ProjectDiscovery-blue?style=flat-square)](https://github.com/projectdiscovery/nuclei)
[![Next.js](https://img.shields.io/badge/Next.js-Vercel-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![shadcn/ui](https://img.shields.io/badge/shadcn/ui-Components-black?style=flat-square)](https://ui.shadcn.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## 💬 Support

For issues or questions:
1. 📋 Check the [Troubleshooting](#-troubleshooting) section
2. 📚 Review the [documentation](./Refrencce%20and%20Usage%20And%20Guide/)
3. 🔗 Check [Nuclei's official documentation](https://docs.projectdiscovery.io/tools/nuclei/overview)
4. ⭐ Star this repo if you find it helpful!

---

<div align="center">

### ⭐ Star the Repository

If you find this project useful, please consider giving it a star!

[![GitHub stars](https://img.shields.io/github/stars/devtint/NUCLEI_CNM?style=social)](https://github.com/devtint/NUCLEI_CNM/stargazers)

**Built with ❤️ for the security community**

[⬆ Back to Top](#-nuclei-command-center)

</div>
