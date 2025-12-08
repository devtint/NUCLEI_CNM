# Nuclei Dashboard - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [Data Flow](#data-flow)
6. [Component Architecture](#component-architecture)
7. [API Architecture](#api-architecture)
8. [Storage Strategy](#storage-strategy)

---

## System Overview

The Nuclei Dashboard is a **Next.js-based web application** that provides a modern, user-friendly interface for managing and executing Nuclei vulnerability scans. It wraps the native Nuclei binary installed on the system and provides:

- **Real-time scan monitoring** with live console output
- **Scan history** with downloadable results
- **Custom template management** for creating and running custom Nuclei templates
- **One-click preset scans** for common vulnerability checks
- **Vulnerability feed** with detailed findings analysis
- **Settings management** for performance tuning

### Key Design Principles

1. **No Custom Scanning Logic**: Wraps the native Nuclei binary instead of reimplementing scanning
2. **File-Based Storage**: Uses JSON files for scan results and logs (no database required)
3. **In-Memory Process Management**: Active scans tracked in server memory
4. **Real-time Updates**: SSE (Server-Sent Events) for live scan output streaming
5. **Client-Side State**: React hooks for UI state management

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS with custom design tokens
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: React hooks (`useState`, `useEffect`)

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Process Management**: `child_process.spawn` for Nuclei execution
- **File System**: Node.js `fs` module for scan result storage
- **Streaming**: Server-Sent Events (SSE) for real-time logs

### Build Tools
- **Package Manager**: npm
- **TypeScript**: Full type safety
- **Linting**: ESLint
- **Formatting**: Prettier (via IDE)

---

## Project Structure

```
d:\NCNC\
├── dashboard/                      # Next.js application root
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API Routes (Backend)
│   │   │   ├── findings/           # Vulnerability findings API
│   │   │   ├── history/            # Scan history API
│   │   │   ├── scan/               # Scan execution API
│   │   │   ├── settings/           # Settings API
│   │   │   ├── stats/              # Dashboard statistics
│   │   │   ├── stream/             # Real-time log streaming
│   │   │   └── templates/          # Custom template management
│   │   ├── layout.tsx              # Root layout with theme
│   │   ├── page.tsx                # Main dashboard page
│   │   └── globals.css             # Global styles & theme tokens
│   ├── components/                 # React components
│   │   ├── dashboard/              # Dashboard views
│   │   ├── findings/               # Vulnerability findings
│   │   ├── layout/                 # Layout components
│   │   ├── scan/                   # Scan management
│   │   ├── settings/               # Settings UI
│   │   ├── templates/              # Template management
│   │   └── ui/                     # shadcn/ui components
│   ├── lib/                        # Utility libraries
│   │   ├── nuclei/                 # Nuclei-specific logic
│   │   │   ├── config.ts           # Command construction & paths
│   │   │   └── presets.ts          # One-click preset definitions
│   │   └── utils.ts                # General utilities
│   ├── scans/                      # Scan results storage (gitignored)
│   ├── next.config.ts              # Next.js configuration
│   ├── package.json                # Dependencies
│   └── tsconfig.json               # TypeScript configuration
├── Refrencce and Usage And Guide/  # Documentation
└── guide.txt                       # Original requirements
```

---

## Architecture Patterns

### 1. Server-Side Rendering (SSR) + Client-Side Interactivity
- Initial page load uses Next.js SSR for fast rendering
- Client components handle interactive features
- API routes provide backend functionality

### 2. File-Based Data Storage
- **Scan Results**: `dashboard/scans/<scanId>.json`
- **Scan Logs**: `dashboard/scans/<scanId>.log`
- **Custom Templates**: `C:\Users\<user>\nuclei-custom-templates\*.yaml`
- **Settings**: Browser `localStorage`

### 3. In-Memory Process Management
Active scans stored in Map with process metadata

### 4. Event-Driven Architecture
- Scan execution via `child_process.spawn`
- Real-time streaming via SSE
- Event listeners for stdout, stderr, close, error

---

## Data Flow

### Scan Execution Flow
1. User configures scan in Wizard
2. POST to `/api/scan` with config
3. Backend constructs Nuclei command
4. Spawns Nuclei process
5. Stores in activeScans Map
6. Streams logs via SSE
7. Writes results on completion

### Finding Deletion Flow
1. User clicks delete button
2. DELETE to `/api/findings`
3. Backend filters finding from JSON
4. Writes updated file
5. Client refreshes list

---

## Component Architecture

### Frontend Components

#### DashboardClient.tsx
Main orchestrator for all views

#### ScanWizard.tsx
Scan configuration with presets and custom args

#### LiveConsole.tsx
Real-time scan monitoring with SSE

#### FindingsTable.tsx
Vulnerability display with delete/rescan

---

## API Architecture

### `/api/scan`
- POST: Start scan
- GET: List active scans
- DELETE: Stop scan

### `/api/findings`
- GET: List all findings
- DELETE: Remove finding

### `/api/stream/[id]`
- GET: Stream scan logs (SSE)

---

## Storage Strategy

### Scan Results
JSON array format from Nuclei `-json-export`

### Scan Logs
Plain text with ANSI codes

### Custom Templates
YAML files in user's home directory

### Settings
Client-side localStorage

---

## Integration with Nuclei Binary

### Command Construction
Builds Nuclei args from config object

### Nuclei Paths
Dynamically resolved using `os.homedir()`

---

## Performance Considerations

- Rate limiting: 50-1000 req/s
- Concurrency: 25-300 parallel templates
- Memory: Active scans in RAM
- File I/O: Buffered log writes

---

## Security Considerations

1. Input sanitization for template names
2. No arbitrary file access
3. Process spawned safely (not shell exec)
4. Privacy: .mhtml files excluded from Git

---

## Future Enhancements

1. Database integration (SQLite)
2. User authentication
3. Scan scheduling
4. Webhook notifications
5. Report generation
6. Template marketplace

---

For detailed API documentation, see [API_REFERENCE.md](./API_REFERENCE.md)
For component documentation, see [COMPONENTS.md](./COMPONENTS.md)
