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
- **Secured Authentication**: Integrated NextAuth v5 for protected access

### Key Design Principles

1. **No Custom Scanning Logic**: Wraps the native Nuclei binary instead of reimplementing scanning
2. **Hybrid Storage**: Database for structured data + Files for raw output
3. **Database-Backed Process Management**: Scans and findings persisted in SQLite
4. **Real-time Updates**: Database polling for scan status
5. **Client-Side State**: React hooks for UI state management
6. **Response Caching**: In-memory caching with TTL for API optimization
7. **Middleware-Based Security**: Route-level protection for pages and APIs via `proxy.ts`.

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
- **Database**: SQLite with better-sqlite3 (WAL Mode)
- **Authentication**: NextAuth.js v5 (Auth.js)
- **Process Management**: `child_process.spawn` for Nuclei execution
- **Scheduler**: `node-cron` for automated background jobs
- **File System**: Node.js `fs` module for scan output storage
- **Caching**: In-memory `SimpleCache` with TTL

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
│   │   │   ├── auth/               # NextAuth authentication routes
│   │   │   ├── findings/           # Vulnerability findings API
│   │   │   ├── history/            # Scan history API
│   │   │   ├── scan/               # Scan execution API
│   │   │   ├── backup/             # Backup & Restore API
│   │   │   ├── settings/           # Settings API
│   │   │   ├── stream/             # Real-time log streaming
│   │   │   ├── scheduler/          # Automation scheduler endpoints
│   │   │   └── templates/          # Custom template management
│   │   ├── login/                  # Login page
│   │   ├── layout.tsx              # Root layout with theme
│   │   ├── page.tsx                # Main dashboard page
│   │   └── globals.css             # Global styles & theme tokens
│   ├── components/                 # React components
│   │   ├── system/                 # System modules (Scheduler, Settings)
│   │   ├── scan/                   # Scan modules (Wizard, LiveConsole)
│   │   └── ...
│   ├── lib/                        # Utility libraries
│   │   ├── db.ts                   # Database operations (Singleton)
│   │   ├── scheduler.ts            # Cron job engine
│   │   ├── notifications.ts        # Telegram alert system
│   │   └── ...
│   ├── scans/                      # Scan results storage (gitignored)
│   ├── nuclei.db                   # SQLite database (gitignored)
│   ├── proxy.ts                    # Next.js 16 Middleware (Route protection)
│   ├── auth.ts                     # Auth configuration and providers
│   ├── auth.config.ts              # Core Auth config schema
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

### 2. Middleware-Based Security (proxy.ts)
- Intercepts all requests at the edge.
- Enforces authentication for both Page routes and API routes.
- Handles production HTTPS redirects.
- **Lazy Protection**: Checks `NEXT_AUTH_SESSION` cookie before even reaching logic.

### 3. Hybrid Storage Strategy
- **Database**: Structured data (scans, findings, metadata)
- **Files**: Raw output (JSON results, log files)
- **File Metadata**: Stored in database for fast access

### 4. Database-Backed Process Management
- Scans stored in `scans` table with status tracking
- Findings stored in `findings` table with relationships
- Scheduler Logs stored in `scheduler_logs` table
- Activity Monitor reads from database (last 20 scans)

### 5. Event-Driven Architecture
- Scan execution via `child_process.spawn`
- Database updates on scan events
- Event listeners for stdout, stderr, close, error
- **Notification Hook**: On scan completion -> Trigger `notifications.ts` -> Send Telegram msg.

### 6. Response Caching
- In-memory cache with TTL
- History API: 30-second cache
- Findings API: 20-second cache
- Automatic invalidation on mutations (Create/Update/Delete)

---

## Data Flow

### Authentication Flow
```
1. User requests '/' or '/templates'
2. Middleware (proxy.ts) checks for session
3. If no session: Redirects to '/login'
4. User submits password to /api/auth/callback/credentials
5. auth.ts validates against ADMIN_PASSWORD_HASH
6. Session established, user redirected back to target
```

### Automation Scheduler Flow
```
1. User enables Scheduler in System settings
2. `scheduler.ts` initializes cron job (e.g., "0 0 * * *")
3. Job Triggers:
   a. Subfinder: Scans target for subdomains
   b. DB Sync: Updates `monitored_subdomains` (tracks "New" subs)
   c. HTTPX: Probes live hosts from sub list
   d. Nuclei: Scans only live hosts
   e. DB Insert: Saves findings
   f. Alert: Sends Telegram summary
```

### Finding Status Update Flow
```
1. User clicks status badge (e.g., "New" -> "Confirmed")
2. PATCH to `/api/findings` with ID and status
3. Backend:
   a. Updates finding in database
   b. Invalidates findings cache
4. Client refreshes findings list
5. Status badge updates with new color
```

---

## Component Architecture

### Frontend Components

#### DashboardClient.tsx
Main orchestrator for all views with conditional rendering for "tabs" (Dashboard, Vulnerabilities, History, etc.).

#### SchedulerPanel.tsx
Automation control center:
- Toggle On/Off
- Set Frequency (6h/12h/24h)
- Enable/Disable specific targets
- View recent automation logs

#### SettingsPanel.tsx
Global configuration:
- Telegram API keys
- Scan performance (Rate Limit, Concurrency)
- Notification toggles

#### LiveConsole.tsx (Activity Monitor)
Database-backed scan monitoring:
- Polling interval: 2s
- Reads `scans` table for active jobs
- Reads `tail` of log file for real-time output

---

## API Architecture

### Security
- All API routes utilize `await auth()` to verify session.
- Returns `401 Unauthorized` if no session is present.

### `/api/scan`
**POST** - Start new scan. Spawns process, returns `scanId`.

### `/api/scheduler/status`
**GET/POST** - Get or Set scheduler state (running, frequency, target list).

### `/api/findings`
**GET** - List findings (filtered by scan or all).
**PATCH** - Update status.

### `/api/settings`
**GET/POST** - Manage global `settings` key-value pairs (Telegram, etc.).

---

## Database Schema

For full schema details, refer to `DATABASE_SCHEMA.md`.

**Key Tables:**
- `scans`
- `findings`
- `monitored_targets` (Assets)
- `monitored_subdomains` (Recon)
- `scheduler_logs` (Audit)
- `settings` (Config)

---

## Storage Strategy

### Database Storage
- **Scans**: Metadata, configuration, status, timestamps
- **Findings**: Vulnerabilities with status tracking
- **Indexes**: Optimized for common queries (Severity, Status, Date)

### File Storage
- **Scan Results**: `dashboard/scans/{scanId}_{timestamp}.json`
- **Scan Logs**: `dashboard/scans/{scanId}.log`
- **Custom Templates**: `~/nuclei-custom-templates/*.yaml`

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
