# Getting Started Guide

Complete guide to setting up and using the Nuclei Dashboard.

---

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **Nuclei** (v3.6.0 or higher)
   - Install: `go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest`
   - Verify: `nuclei -version`
   - Ensure Nuclei is in your PATH

3. **Git** (for cloning the repository)
   - Download: https://git-scm.com/
   - Verify: `git --version`

---

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd NCNC
```

### 2. Install Dependencies
```bash
cd dashboard
npm install
```

### 3. Verify Nuclei Installation
```bash
nuclei -version
```

Expected output:
```
Nuclei Engine Version: v3.6.0
```

---

## Running the Dashboard

### Development Mode
```bash
cd dashboard
npm run dev
```

The dashboard will be available at: **http://localhost:3000**

### Production Build
```bash
cd dashboard
npm run build
npm start
```

---

## First Scan

### 1. Navigate to "New Operation"
Click "New Operation" in the sidebar.

### 2. Enter Target
Enter a target URL (e.g., `scanme.sh` or `https://example.com`)

### 3. Choose Scan Type

#### Option A: One-Click Preset
Click one of the preset buttons:
- **Full Scan**: All templates (comprehensive scan)
- **Full Scan (Critical)**: `-s critical`
- **Full Scan (High/Crit)**: `-s critical,high`
- **Tech Detect**: `-tags tech`
- **CVEs (2023-2024)**: `-tags cve2023,cve2024`
- **Misconfigurations**: `-tags misconfig`
- **Panels & Logins**: `-tags panel,login`

#### Option B: Custom Command
Switch to "Custom Command" tab and enter flags:
```
-t cves/2024/ -s critical
```

### 4. Run Scan
Click the "Run" button. You'll be automatically switched to the Activity Monitor.

### 5. Monitor Progress
Watch the live console output as Nuclei scans the target.

### 6. View Results
Once complete, go to "Vulnerabilities" to see findings.

---

## Configuration

### Performance Settings
Navigate to "Settings" to configure:

- **Rate Limit**: Requests per second (default: 150)
  - Recommended: 300-500 for faster scans
  - Maximum: 1000+ (use with caution)

- **Concurrency**: Parallel templates (default: 25)
  - Recommended: 75-100 for faster scans
  - Maximum: 200+ (requires powerful machine)

- **Bulk Size**: Hosts per batch (default: 25)
  - Only relevant for multi-target scans

Click "Save Settings" to apply.

---

## Custom Templates

### Creating a Template

1. Navigate to "Templates"
2. Click "New Template"
3. Enter template name (e.g., `my-custom-check`)
4. Write YAML content:
```yaml
id: my-custom-check
info:
  name: My Custom Check
  severity: medium
requests:
  - method: GET
    path:
      - "{{BaseURL}}/admin"
    matchers:
      - type: status
        status:
          - 200
```
5. Click "Save Template"

### Running a Custom Template

1. Find your template in the Templates list
2. Click "Run"
3. Enter target URL
4. Click "Run" to start scan

---

## Managing Findings

### Viewing Details
Click any vulnerability row to see:
- Template ID
- Severity
- Matched URL
- Template Path
- Description
- Full raw JSON

### Deleting Findings
Click the trash icon (🗑️) next to any finding to delete it.

**Warning:** This permanently removes the finding from the scan file.

### Rescanning
Click "Rescan" to re-test a specific vulnerability.

### Exporting
Click "Export" and choose:
- All Findings (CSV)
- Critical Only
- High Only
- Medium Only
- Low Only
- Info Only

---

## Backup & Restore

### Creating a Backup

1. Navigate to "Backup & Restore" in the sidebar
2. Click the "Backup" tab
3. Click "Download Backup" button
4. Save the `nuclei-cc-backup_{timestamp}.json` file

**What's Included:**
- All Nuclei vulnerability findings
- All Subfinder subdomain discoveries
- All HTTPX live asset data
- Scan history and metadata

### Restoring from Backup

1. Navigate to "Backup & Restore"
2. Click the "Restore" tab
3. Click "Select Backup File"
4. Choose a Nuclei CC backup file
5. Wait for restore to complete
6. Review restore statistics

**Important:**
- Only Nuclei CC backup files are accepted
- Existing data will not be overwritten (duplicate prevention)
- Restore uses transactions (all-or-nothing)

### Importing External Nuclei Scans

1. Navigate to "Backup & Restore"
2. Click the "Import Nuclei JSON" tab
3. Click "Select JSON File"
4. Choose a Nuclei JSON output file
5. Wait for import to complete

**Use Cases:**
- Import scans from CI/CD pipelines
- Centralize scans from multiple devices
- Import historical scan data
- Team collaboration

---

## Scan History

### Viewing Past Scans
Navigate to "Scan History" to see all completed scans.

### Downloading Results
For each scan, you can download:
- **JSON**: Nuclei's raw findings
- **Log**: Complete scan output

---

## Troubleshooting

### Scan Stuck in "Running"
**Cause:** Nuclei process waiting for input  
**Fix:** Restart the dashboard server

### No Findings Shown
**Cause:** Scan completed with 0 vulnerabilities  
**Fix:** Check scan history to confirm scan completed

### Custom Template Not Found
**Cause:** Using template ID instead of full path  
**Fix:** Use the "Run" button from Templates list

### High Memory Usage
**Cause:** Too many concurrent scans  
**Fix:** Lower concurrency in Settings

### Nuclei Command Not Found
**Cause:** Nuclei not in PATH  
**Fix:** Add Nuclei to your system PATH

---

## Best Practices

### 1. Start with Presets
Use one-click presets for common scans before creating custom templates.

### 2. Test on Safe Targets
Always test on targets you own or have permission to scan.

### 3. Monitor Resource Usage
Watch CPU and memory usage during scans, especially with high concurrency.

### 4. Regular Updates
Keep Nuclei templates updated:
```bash
nuclei -update-templates
```

### 5. Backup Scan Results
Scan results are stored in `dashboard/scans/`. Back up this directory regularly.

---

## Advanced Usage

### Running Specific Templates
Use custom args:
```
-t cves/2024/CVE-2024-1234.yaml
```

### Multiple Targets
Create a file `targets.txt`:
```
https://example1.com
https://example2.com
```

Use custom args:
```
-l targets.txt
```

### Debug Mode
Add to custom args:
```
-debug -v
```

### Proxy Configuration
Add to custom args:
```
-proxy http://127.0.0.1:8080
```

---

## Security Considerations

### Local Use Only
The dashboard has no authentication. Only use on trusted networks.

### Scan Permissions
Only scan targets you own or have explicit permission to test.

### Rate Limiting
High scan rates can be considered DoS attacks. Use responsibly.

### Data Privacy
Scan results contain sensitive information. Protect the `scans/` directory.

---

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Read [API_REFERENCE.md](./API_REFERENCE.md) for API details
3. Read [COMPONENTS.md](./COMPONENTS.md) for component documentation
4. Explore the [Nuclei Documentation](https://docs.projectdiscovery.io/tools/nuclei/overview)

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the documentation in `Refrencce and Usage And Guide/`
3. Check Nuclei's official documentation

---

## License

This project wraps the Nuclei binary. Nuclei is licensed under the MIT License.
