# Nuclei Dashboard - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [Data Flow](#data-flow)
6. [Component Architecture](#component-architecture)
7. [API Architecture](#api-architecture)
8. [Database Schema](#database-schema)
9. [Storage Strategy](#storage-strategy)
10. [Caching Strategy](#caching-strategy)

---

## System Overview

The Nuclei Dashboard is a **Next.js-based web application** with **SQLite database integration** that provides a modern, user-friendly interface for managing and executing Nuclei vulnerability scans. It wraps the native Nuclei binary installed on the system and provides:

- **Real-time scan monitoring** with database-backed history
- **Persistent finding storage** with status management
- **Custom template management** for creating and running custom Nuclei templates
- **One-click preset scans** for common vulnerability checks (7 presets)
- **Vulnerability feed** with multi-select severity filtering
- **Settings management** for performance tuning
- **Response caching** for optimized performance

### Key Design Principles

1. **No Custom Scanning Logic**: Wraps the native Nuclei binary instead of reimplementing scanning
2. **Hybrid Storage**: Database for structured data + Files for raw output
3. **Database-Backed Process Management**: Scans and findings persisted in SQLite
4. **Real-time Updates**: Database polling for scan status
5. **Client-Side State**: React hooks for UI state management
6. **Response Caching**: In-memory caching with TTL for API optimization

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS with custom design tokens
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: React hooks (`useState`, `useEffect`)

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: SQLite with better-sqlite3
- **Process Management**: `child_process.spawn` for Nuclei execution
- **File System**: Node.js `fs` module for scan output storage
- **Caching**: In-memory cache with TTL

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
│   │   │   │   └── route.ts        # GET, PATCH, DELETE
│   │   │   ├── history/            # Scan history API
│   │   │   │   ├── route.ts        # GET, DELETE
│   │   │   │   └── download/       # File downloads
│   │   │   ├── scan/               # Scan execution API
│   │   │   │   └── route.ts        # POST, GET, DELETE
│   │   │   ├── settings/           # Settings API
│   │   │   ├── stream/             # Real-time log streaming
│   │   │   └── templates/          # Custom template management
│   │   ├── layout.tsx              # Root layout with theme
│   │   ├── page.tsx                # Main dashboard page
│   │   └── globals.css             # Global styles & theme tokens
│   ├── components/                 # React components
│   │   ├── dashboard/              # Dashboard views
│   │   │   ├── DashboardClient.tsx # Main orchestrator
│   │   │   └── Stats.tsx           # Statistics with severity breakdown
│   │   ├── findings/               # Vulnerability findings
│   │   │   └── Table.tsx           # Findings table with filtering
│   │   ├── layout/                 # Layout components
│   │   │   └── Sidebar.tsx         # Navigation sidebar
│   │   ├── scan/                   # Scan management
│   │   │   ├── Wizard.tsx          # Scan configuration
│   │   │   ├── LiveConsole.tsx     # Activity monitor
│   │   │   └── History.tsx         # Scan history
│   │   ├── settings/               # Settings UI
│   │   ├── templates/              # Template management
│   │   └── ui/                     # shadcn/ui components
│   ├── lib/                        # Utility libraries
│   │   ├── db.ts                   # Database operations
│   │   ├── cache.ts                # Response caching
│   │   ├── errors.ts               # Error handling
│   │   ├── nuclei/                 # Nuclei-specific logic
│   │   │   ├── config.ts           # Command construction & paths
│   │   │   └── presets.ts          # One-click preset definitions
│   │   └── utils.ts                # General utilities
│   ├── scans/                      # Scan results storage (gitignored)
│   ├── nuclei.db                   # SQLite database (gitignored)
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

### 2. Hybrid Storage Strategy
- **Database**: Structured data (scans, findings, metadata)
- **Files**: Raw output (JSON results, log files)
- **File Metadata**: Stored in database for fast access

### 3. Database-Backed Process Management
- Scans stored in `scans` table with status tracking
- Findings stored in `findings` table with relationships
- Activity Monitor reads from database (last 20 scans)

### 4. Event-Driven Architecture
- Scan execution via `child_process.spawn`
- Database updates on scan events
- Event listeners for stdout, stderr, close, error

### 5. Response Caching
- In-memory cache with TTL
- History API: 30-second cache
- Findings API: 20-second cache
- Automatic invalidation on mutations

---

## Data Flow

### Scan Execution Flow
```
1. User configures scan in Wizard
2. POST to `/api/scan` with config
3. Backend:
   a. Inserts scan record in database
   b. Constructs Nuclei command
   c. Spawns Nuclei process
   d. Creates log file
4. On scan completion:
   a. Parses JSON output
   b. Inserts findings into database
   c. Updates scan status and metadata
   d. Invalidates caches
5. Client polls Activity Monitor
6. Findings appear in Vulnerabilities page
```

### Finding Status Update Flow
```
1. User clicks status badge
2. Selects new status from dropdown
3. PATCH to `/api/findings` with ID and status
4. Backend:
   a. Updates finding in database
   b. Invalidates findings cache
5. Client refreshes findings list
6. Status badge updates with new color
```

### Finding Deletion Flow
```
1. User clicks delete button
2. Confirmation dialog
3. DELETE to `/api/findings` with ID
4. Backend:
   a. Deletes finding from database (by ID)
   b. Invalidates findings cache
5. Client refreshes list
6. Finding removed from UI
```

### Scan History Deletion Flow
```
1. User clicks delete in history
2. Confirmation dialog
3. DELETE to `/api/history?id={scanId}`
4. Backend:
   a. Deletes scan from database (cascade to findings)
   b. Deletes JSON and log files
   c. Invalidates history and findings caches
5. Client refreshes history
6. Scan removed from UI
```

---

## Component Architecture

### Frontend Components

#### DashboardClient.tsx
Main orchestrator for all views with view routing

#### Stats.tsx
Dashboard statistics with:
- Total scans count
- Total findings count
- Last activity timestamp
- Severity breakdown (Critical, High, Medium, Low, Info)

#### ScanWizard.tsx
Scan configuration with:
- 7 one-click presets (including Full Scan)
- Custom command builder
- Settings integration

#### LiveConsole.tsx (Activity Monitor)
Database-backed scan monitoring:
- Last 20 scans from database
- Real-time status updates
- Scan duration and exit codes
- Configuration details display
- Color-coded status badges

#### FindingsTable.tsx
Vulnerability display with:
- Multi-select severity filtering
- Status management dropdown
- Delete and rescan actions
- Detailed finding view
- CSV export

#### History.tsx
Scan history with:
- Database-backed scan list
- File download buttons
- Delete functionality
- Findings count per scan

---

## API Architecture

### `/api/scan`
**GET** - List recent scans (last 20 from database)
- Returns: `{ id, target, status, startTime, endTime, exitCode, config }`
- Source: Database query with ORDER BY start_time DESC

**POST** - Start new scan
- Inserts scan record in database
- Spawns Nuclei process
- Returns: `{ scanId }`

**DELETE** - Stop running scan
- Updates scan status in database
- Kills Nuclei process
- Returns: `{ success: true }`

### `/api/findings`
**GET** - List all findings or by scanId
- Query param: `?scanId={id}` (optional)
- Returns: Array of findings with `_status` and `_dbId`
- Cached: 20-second TTL
- Source: Database query

**PATCH** - Update finding status
- Body: `{ id, status }`
- Validates status against allowed values
- Invalidates cache
- Returns: `{ success: true }`

**DELETE** - Delete finding
- Body: `{ id }`
- Deletes by database ID
- Invalidates cache
- Returns: `{ success: true }`

### `/api/history`
**GET** - Get scan history
- Returns: Array of scans with metadata
- Includes: filename, size, date, findingsCount, hasLog
- Cached: 30-second TTL
- Fallback to filesystem for legacy scans

**DELETE** - Delete scan and files
- Query param: `?id={scanId}`
- Deletes database record (cascade to findings)
- Deletes JSON and log files
- Invalidates caches
- Returns: `{ success: true }`

### `/api/templates`
**GET** - List available templates
- Returns: Standard + custom templates

**POST** - Create custom template
- Body: `{ name, content }`
- Saves to `~/nuclei-custom-templates/`
- Returns: `{ success: true }`

---

## Database Schema

### Scans Table
```sql
CREATE TABLE scans (
    id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    config TEXT,
    start_time INTEGER,
    end_time INTEGER,
    status TEXT,
    exit_code INTEGER,
    json_file_path TEXT,
    json_file_size INTEGER DEFAULT 0,
    log_file_path TEXT
);

CREATE INDEX idx_scans_start_time ON scans(start_time);
CREATE INDEX idx_scans_status ON scans(status);
```

### Findings Table
```sql
CREATE TABLE findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id TEXT NOT NULL,
    template_id TEXT,
    severity TEXT,
    name TEXT,
    matched_at TEXT,
    status TEXT DEFAULT 'New',
    raw_json TEXT,
    timestamp INTEGER,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX idx_findings_scan_id ON findings(scan_id);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_status ON findings(status);
```

### Database Operations (lib/db.ts)
- `getDatabase()` - Get singleton database instance
- `insertScan()` - Create scan record
- `updateScan()` - Update scan metadata
- `getScan()` - Retrieve scan by ID
- `getAllScans()` - Get all scans
- `deleteScan()` - Delete scan and findings
- `insertFinding()` - Create single finding
- `insertFindings()` - Batch insert findings
- `updateFinding()` - Update finding fields
- `deleteFinding()` - Delete finding by ID
- `getFindings()` - Get findings (all or by scan)

---

## Storage Strategy

### Database Storage
- **Scans**: Metadata, configuration, status, timestamps
- **Findings**: Vulnerabilities with status tracking
- **Indexes**: Optimized for common queries

### File Storage
- **Scan Results**: `dashboard/scans/{scanId}_{timestamp}.json`
- **Scan Logs**: `dashboard/scans/{scanId}.log`
- **Custom Templates**: `~/nuclei-custom-templates/*.yaml`

### Client Storage
- **Settings**: Browser `localStorage`

### File Metadata in Database
- JSON file path and size stored in `scans` table
- Log file path stored in `scans` table
- Reduces filesystem I/O for history display
- Fallback to filesystem for legacy scans

---

## Caching Strategy

### In-Memory Cache (lib/cache.ts)
```typescript
class SimpleCache {
    cache: Map<string, CacheEntry>
    set(key, value, ttl)
    get(key)
    invalidate(pattern)
    clear()
}
```

### Cache Configuration
- **History API**: 30-second TTL
- **Findings API**: 20-second TTL
- **Pattern-based invalidation**: `findings-*`, `history-*`

### Cache Invalidation Triggers
- Scan completion → invalidate history + findings
- Finding deletion → invalidate findings
- Finding status update → invalidate findings
- Scan deletion → invalidate history + findings

---

## Error Handling

### Centralized Error Management (lib/errors.ts)
```typescript
enum ErrorType {
    DATABASE_ERROR,
    VALIDATION_ERROR,
    FILE_SYSTEM_ERROR,
    NETWORK_ERROR
}

class ApiError extends Error {
    type: ErrorType
    statusCode: number
}
```

### Error Handling Utilities
- `handleApiError()` - Consistent error responses
- `tryCatch()` - Async error wrapper
- `dbOperation()` - Database operation wrapper

---

## Integration with Nuclei Binary

### Command Construction
Builds Nuclei args from config object:
- Target URL
- Tags filter
- Severity filter
- Template ID
- Rate limit, concurrency, bulk size
- Custom arguments

### Nuclei Paths
Dynamically resolved using `os.homedir()`

---

## Performance Considerations

### Database
- Indexed queries for fast retrieval
- Batch inserts for findings
- Connection pooling (singleton)
- Prepared statements

### Caching
- Reduced database load
- Faster API responses
- Smart invalidation

### File I/O
- Metadata in database
- Buffered log writes
- Async file operations

### Settings
- Rate limiting: 50-1000 req/s
- Concurrency: 25-300 parallel templates
- Bulk size: 25-100 hosts

---

## Security Considerations

1. Input sanitization for template names
2. No arbitrary file access
3. Process spawned safely (not shell exec)
4. Database prepared statements (SQL injection prevention)
5. Privacy: `.mhtml`, `nuclei.db` excluded from Git
6. Status validation against allowed values

---

## Completed Enhancements

✅ Database integration (SQLite)  
✅ Finding status management  
✅ Multi-select severity filtering  
✅ Response caching  
✅ Activity Monitor from database  
✅ Severity breakdown dashboard  
✅ File metadata storage  
✅ Error handling improvements  

## Future Enhancements

- [ ] User authentication
- [ ] Multi-user support
- [ ] Scan scheduling
- [ ] Email notifications
- [ ] Report generation
- [ ] Webhook integrations
- [ ] Advanced analytics
- [ ] Finding deduplication

---

For detailed API documentation, see [API_REFERENCE.md](./API_REFERENCE.md)  
For component documentation, see [COMPONENTS.md](./COMPONENTS.md)  
For features documentation, see [FEATURES.md](./FEATURES.md)
