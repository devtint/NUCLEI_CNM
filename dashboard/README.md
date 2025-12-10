# Nuclei Command Center - Dashboard

A modern, feature-rich web dashboard for managing Nuclei vulnerability scans with real-time monitoring, database storage, and comprehensive finding management.

## Features

### 🎯 Core Functionality
- **One-Click Scan Presets**: 7 pre-configured scan profiles including Full Scan, Critical/High severity, Tech Detection, CVEs, Misconfigurations, and Login Panels
- **Custom Command Builder**: Advanced scan configuration with custom Nuclei flags
- **Real-Time Activity Monitor**: Live scan tracking with status, duration, and exit codes
- **Database-Backed Storage**: SQLite database for persistent scan history and findings
- **Finding Deduplication**: Intelligent hash-based system prevents duplicate findings across scans
- **Finding Status Management**: Track findings as New, Confirmed, False Positive, Fixed, Closed, or Regression
- **Regression Detection**: Automatically detects when fixed vulnerabilities reappear

### 📊 Dashboard & Analytics
- **Overview Dashboard**: Total scans, findings count, and last activity
- **Severity Breakdown**: Visual breakdown of findings by severity (Critical, High, Medium, Low, Info)
- **Multi-Select Filtering**: Filter vulnerabilities by multiple severity levels simultaneously
- **Scan History**: Complete history of all scans with metadata and file downloads

### 🔍 Vulnerability Management
- **Findings Table**: Comprehensive view of all vulnerabilities with severity badges
- **Status Tracking**: Update finding status with color-coded badges
- **Detailed View**: Click any finding for full details including template info, matched URL, and raw JSON
- **Export Options**: Export findings to CSV (all, or filtered by severity)
- **Delete & Rescan**: Remove false positives or re-verify findings

### ⚙️ Advanced Features
- **Custom Templates**: Create and manage custom Nuclei templates
- **Settings Management**: Configure rate limits, concurrency, and bulk size
- **Response Caching**: Optimized API performance with intelligent caching
- **File Metadata Storage**: Scan results and logs stored with size and path information

## Getting Started

### Prerequisites
- Node.js 18+ 
- Nuclei binary installed and in PATH
- Windows/Linux/macOS

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

### First Scan

1. Navigate to **New Operation**
2. Enter a target URL (e.g., `testhtml5.vulnweb.com`)
3. Choose a preset or enter custom flags
4. Click **Run** and monitor in **Activity Monitor**
5. View results in **Vulnerabilities**

## Database Schema

### Scans Table
- `id`: Unique scan identifier
- `target`: Target URL/domain
- `config`: JSON configuration
- `start_time`, `end_time`: Timestamps
- `status`: running/completed/stopped/failed
- `exit_code`: Nuclei exit code
- `json_file_path`, `json_file_size`: Result file metadata
- `log_file_path`: Log file path

### Findings Table
- `id`: Auto-increment ID
- `scan_id`: Foreign key to scans
- `template_id`: Nuclei template identifier
- `severity`: critical/high/medium/low/info
- `name`: Vulnerability name
- `matched_at`: Target URL
- `matcher_name`: Specific matcher that triggered
- `status`: New/Confirmed/False Positive/Fixed/Closed/Regression
- `finding_hash`: SHA-256 hash for deduplication (template_id + host + matched_at + name + matcher_name)
- `first_seen`: Unix timestamp when first discovered
- `last_seen`: Unix timestamp when last seen
- `raw_json`: Complete finding data
- `timestamp`: Detection time

## API Endpoints

- `GET /api/scan` - List recent scans (last 20)
- `POST /api/scan` - Start new scan
- `DELETE /api/scan?id={id}` - Stop running scan
- `GET /api/findings` - Get all findings (cached 20s)
- `GET /api/findings?scanId={id}` - Get findings for specific scan
- `PATCH /api/findings` - Update finding status
- `DELETE /api/findings` - Delete finding
- `GET /api/history` - Get scan history (cached 30s)
- `DELETE /api/history?id={id}` - Delete scan and files
- `GET /api/templates` - List available templates
- `POST /api/templates` - Create custom template

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Database**: SQLite with better-sqlite3
- **Backend**: Next.js API Routes
- **Caching**: In-memory with TTL
- **Scanner**: Nuclei (native binary)

## Project Structure

```
dashboard/
├── app/
│   ├── api/           # API routes
│   │   ├── scan/      # Scan management
│   │   ├── findings/  # Finding operations
│   │   ├── history/   # Scan history
│   │   └── templates/ # Template management
│   └── page.tsx       # Main page
├── components/
│   ├── dashboard/     # Dashboard components
│   ├── findings/      # Finding table & details
│   ├── scan/          # Scan wizard & console
│   └── templates/     # Template manager
├── lib/
│   ├── db.ts          # Database operations
│   ├── cache.ts       # Response caching
│   ├── errors.ts      # Error handling
│   └── nuclei/        # Nuclei configuration
├── scans/             # Scan output files
└── nuclei.db          # SQLite database
```

## Finding Deduplication System

The dashboard uses a sophisticated hash-based deduplication system to prevent duplicate findings:

### How It Works

1. **Unique Hash Generation**: Each finding gets a SHA-256 hash based on:
   - Template ID (e.g., `http-missing-security-headers`)
   - Host (e.g., `fast.com`)
   - Matched URL (e.g., `https://fast.com`)
   - Vulnerability name (e.g., `HTTP Missing Security Headers`)
   - Matcher name (e.g., `x-frame-options`, `csp`)

2. **Smart Upsert Logic**:
   - If hash exists: Updates `last_seen` timestamp, preserves status
   - If hash is new: Inserts as new finding with `first_seen` timestamp

3. **Status Preservation**: User-assigned statuses (e.g., "False Positive") persist across rescans

4. **Regression Detection**: Findings marked "Fixed" or "Closed" automatically become "Regression" if detected again

### Benefits

✅ No duplicate findings across multiple scans  
✅ Status flags survive rescans  
✅ Automatic regression tracking  
✅ Historical data (first/last seen)  
✅ Cleaner UI without duplicates  

## Configuration

### Settings (via UI)
- **Rate Limit**: Requests per second
- **Concurrency**: Parallel template execution
- **Bulk Size**: Targets per template

### Environment
- Custom template directory: `~/nuclei-custom-templates`
- Scan output: `dashboard/scans/`
- Database: `dashboard/nuclei.db`

## Development

Built with Next.js and TypeScript. Hot reload enabled for rapid development.

```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Production server
```

## License

MIT
