# Nuclei Dashboard

A modern, web-based interface for managing and executing [Nuclei](https://github.com/projectdiscovery/nuclei) vulnerability scans.

![Dashboard Screenshot](https://via.placeholder.com/800x400?text=Nuclei+Dashboard)

---

## Features

✨ **One-Click Presets** - Pre-configured scans for common vulnerability checks  
🔴 **Real-Time Monitoring** - Live console output with Server-Sent Events  
📊 **Vulnerability Feed** - Detailed findings with delete and rescan capabilities  
📝 **Custom Templates** - Create and manage your own Nuclei templates  
📈 **Scan History** - Download and review past scan results  
⚙️ **Performance Tuning** - Configure rate limiting and concurrency  
🎨 **Modern UI** - Built with Next.js, React, and Tailwind CSS

---

## Quick Start

### Prerequisites
- Node.js v18+
- Nuclei v3.6.0+ (installed and in PATH)

### Installation
```bash
git clone https://github.com/devtint/NUCLEI_CNM.git
cd NCNC/dashboard
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Documentation

📖 **[Getting Started Guide](./Refrencce%20and%20Usage%20And%20Guide/GETTING_STARTED.md)** - Installation and first scan  
🏗️ **[Architecture](./Refrencce%20and%20Usage%20And%20Guide/ARCHITECTURE.md)** - System design and data flow  
🔌 **[API Reference](./Refrencce%20and%20Usage%20And%20Guide/API_REFERENCE.md)** - Complete API documentation  
🧩 **[Components](./Refrencce%20and%20Usage%20And%20Guide/COMPONENTS.md)** - React component documentation

---

## Usage

### Running a Scan

1. Navigate to **New Operation**
2. Enter target URL (e.g., `scanme.sh`)
3. Choose a preset or enter custom flags
4. Click **Run**

### One-Click Presets

| Preset | Flags | Description |
|--------|-------|-------------|
| **Full Scan (Critical)** | `-s critical` | Critical severity only |
| **Full Scan (High/Crit)** | `-s critical,high` | High and critical |
| **Tech Detect** | `-tags tech` | Technology detection |
| **CVEs (2023-2024)** | `-tags cve2023,cve2024` | Recent CVEs |
| **Misconfigurations** | `-tags misconfig` | Security misconfigurations |
| **Panels & Logins** | `-tags panel,login` | Exposed login panels |

### Custom Templates

1. Go to **Templates**
2. Click **New Template**
3. Write YAML template
4. Click **Save**
5. Click **Run** to execute

---

## Technology Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **UI Components**: shadcn/ui (Radix UI)
- **Icons**: Lucide React
- **Scanning**: Native Nuclei binary

---

## Project Structure

```
NCNC/
├── dashboard/                  # Next.js application
│   ├── app/                    # App Router
│   │   ├── api/                # API routes
│   │   └── page.tsx            # Main page
│   ├── components/             # React components
│   ├── lib/                    # Utilities
│   └── scans/                  # Scan results (gitignored)
├── Refrencce and Usage And Guide/  # Documentation
└── guide.txt                   # Original requirements
```

---

## Performance Settings

Configure in **Settings**:

- **Rate Limit**: 50-1000 req/s (default: 150)
- **Concurrency**: 25-300 templates (default: 25)
- **Bulk Size**: 25-100 hosts (default: 25)

**Recommended for speed:**
- Rate Limit: 300-500
- Concurrency: 75-100

---

## Security

⚠️ **Important Security Notes:**

1. **Local Use Only** - No authentication implemented
2. **Scan Permissions** - Only scan targets you own or have permission to test
3. **Rate Limiting** - High rates can be considered DoS attacks
4. **Data Privacy** - Scan results contain sensitive information

---

## Development

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Troubleshooting

### Scan Stuck in "Running"
Restart the dashboard server.

### No Findings Shown
Check scan history to confirm scan completed with 0 vulnerabilities.

### Nuclei Command Not Found
Ensure Nuclei is installed and in your system PATH.

For more troubleshooting, see [Getting Started Guide](./Refrencce%20and%20Usage%20And%20Guide/GETTING_STARTED.md#troubleshooting).

---

## License

This project wraps the Nuclei binary. Nuclei is licensed under the MIT License.

---

## Acknowledgments

- [Nuclei](https://github.com/projectdiscovery/nuclei) by ProjectDiscovery
- [Next.js](https://nextjs.org/) by Vercel
- [shadcn/ui](https://ui.shadcn.com/) by shadcn
- [Tailwind CSS](https://tailwindcss.com/)

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [documentation](./Refrencce%20and%20Usage%20And%20Guide/)
3. Check [Nuclei's official documentation](https://docs.projectdiscovery.io/tools/nuclei/overview)

---

**Built with ❤️ for the security community**
