<p align="center">
  <img src="https://raw.githubusercontent.com/projectdiscovery/nuclei/master/static/nuclei-logo.png" alt="Nuclei Command Center" width="200"/>
</p>

<h1 align="center">Nuclei Command Center</h1>

<p align="center">
  <strong>Enterprise-Grade Vulnerability Management Dashboard</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#-installation--deployment">Installation</a> •
  <a href="#security">Security</a> •
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15+-black?style=flat-square&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Auth.js-v5-green?style=flat-square&logo=auth0" alt="Auth.js"/>
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite" alt="SQLite"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License"/>
</p>

---

## Overview

**Nuclei Command Center (NUCLEI_CNM)** is a production-ready, security-hardened web interface for orchestrating vulnerability assessments using [ProjectDiscovery's Nuclei](https://github.com/projectdiscovery/nuclei) scanner. Built by security professionals for security professionals, it transforms raw Nuclei output into actionable intelligence through a modern, authenticated dashboard.

### Why Nuclei Command Center?

| Challenge | Solution |
|-----------|----------|
| CLI-only workflow slows down operations | **One-click preset scans** with configurable parameters |
| Findings scattered across JSON files | **Centralized SQLite database** with full-text search |
| No vulnerability lifecycle tracking | **Status management**: New → Confirmed → Fixed → Closed |
| Team collaboration is difficult | **Import/Export** capabilities with backup & restore |
| No access control for scan operations | **NextAuth v5 integration** with bcrypt password hashing |

---

## Screenshots

### 🔐 Authentication

<p align="center">
  <img src="./screenshots/login_page.png" alt="Login Page" width="800"/>
  <br/>
  <em>Secure login with bcrypt-hashed credentials</em>
</p>

---

### 📊 Dashboard & Monitoring

<p align="center">
  <img src="./screenshots/dashboard.png" alt="Dashboard Overview" width="800"/>
  <br/>
  <em>Real-time overview with vulnerability statistics and recent findings</em>
</p>

<p align="center">
  <img src="./screenshots/activity_monitor.png" alt="Activity Monitor" width="800"/>
  <br/>
  <em>Live scan activity tracking with process management</em>
</p>

---

### 🎯 Vulnerability Scanning

| Nuclei Scanner | Scan History |
|:--------------:|:------------:|
| ![Nuclei Scan](./screenshots/nuclei_scan.png) | ![Scan History](./screenshots/scan_history.png) |
| *Configure and launch Nuclei scans* | *View all past scan results* |

<p align="center">
  <img src="./screenshots/vuln.png" alt="Vulnerability Findings" width="800"/>
  <br/>
  <em>Detailed vulnerability findings with severity classification</em>
</p>

---

### 🌐 Subdomain Discovery (Subfinder)

| Subdomain Scan | Inventory View |
|:--------------:|:--------------:|
| ![Subfinder Scan](./screenshots/subfinder_scan.png) | ![Subfinder Inventory](./screenshots/subfinder_inventory.png) |
| *Launch subdomain enumeration* | *Browse discovered subdomains* |

<p align="center">
  <img src="./screenshots/subfinder_monitor.png" alt="Subfinder Monitor" width="800"/>
  <br/>
  <em>Monitor subdomain discovery progress</em>
</p>

---

### 🔍 HTTP Probing (HTTPX)

| HTTPX Scan | HTTPX Results |
|:----------:|:-------------:|
| ![HTTPX Scan](./screenshots/httpx_scan.png) | ![HTTPX Results](./screenshots/httpx_result.png) |
| *Configure HTTP probing parameters* | *View live host analysis results* |

---

### ⚙️ System Administration

| System Settings | Scanner Management |
|:---------------:|:------------------:|
| ![System Settings](./screenshots/system_setting.png) | ![System Scanner](./screenshots/system_scanner.png) |
| *Configure rate limits and performance* | *Manage scanner binaries* |

| Login Records | Backup & Restore |
|:-------------:|:----------------:|
| ![Login Records](./screenshots/system_login_record.png) | ![Backup Restore](./screenshots/backup_restore.png) |
| *Audit authentication events* | *Export and restore all data* |

<p align="center">
  <img src="./screenshots/custom_templates.png" alt="Custom Templates" width="800"/>
  <br/>
  <em>Create and manage custom Nuclei templates</em>
</p>

---

## Features

### 🎯 Vulnerability Management

- **Unified Finding Feed**: Aggregate all scan results in a single, filterable interface
- **Severity Classification**: Color-coded Critical/High/Medium/Low/Info badges
- **Status Workflow**: Track findings through New → Confirmed → False Positive → Fixed → Closed
- **Surgical Rescan**: Re-verify individual vulnerabilities with one click
- **Bulk Export**: CSV exports filtered by severity level

### ⚡ Scan Operations

- **7 Pre-Configured Presets**:
  | Preset | Nuclei Flags | Use Case |
  |--------|--------------|----------|
  | Full Scan | None | Comprehensive assessment |
  | Critical Only | `-s critical` | High-priority triage |
  | High & Critical | `-s critical,high` | Risk-focused scan |
  | Technology Detection | `-tags tech` | Asset fingerprinting |
  | Recent CVEs | `-tags cve2023,cve2024` | Patch verification |
  | Misconfigurations | `-tags misconfig` | Security hardening |
  | Admin Panels | `-tags panel,login` | Exposed interface detection |

- **Custom Command Builder**: Full CLI flag support for advanced operators
- **Real-time Activity Monitor**: Live scan status with duration tracking
- **Background Processing**: Non-blocking scan execution with process management

### 🔧 System Management

- **Engine Updates**: One-click updates for Nuclei, Subfinder, and HTTPX binaries
- **Template Management**: Create, edit, and execute custom YAML templates
- **Performance Tuning**: Configurable rate limits, concurrency, and bulk sizes
- **Access Logging**: Audit trail for authentication events

### 💾 Data Management

- **SQLite Persistence**: Indexed database with foreign key relationships
- **Full Backup**: Export all scanners' data (Nuclei, Subfinder, HTTPX) to JSON
- **Transaction-Safe Restore**: Atomic restore with rollback on failure
- **External Import**: Ingest Nuclei JSON from CI/CD pipelines or other sources

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NUCLEI COMMAND CENTER                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Browser   │───▶│  proxy.ts   │───▶│  Next.js    │                 │
│  │   Client    │    │ (Middleware)│    │  App Router │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                  │                  │                         │
│         │           ┌──────▼──────┐          │                         │
│         │           │  NextAuth   │          │                         │
│         │           │  Sessions   │          │                         │
│         │           └─────────────┘          │                         │
│         │                                    │                         │
│         │           ┌────────────────────────▼─────────────────────┐   │
│         │           │              API Routes (/api/*)              │   │
│         │           │  ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │   │
│         │           │  │  scan   │ │findings │ │ system/scanners │ │   │
│         │           │  └────┬────┘ └────┬────┘ └────────┬────────┘ │   │
│         │           └───────┼───────────┼───────────────┼──────────┘   │
│         │                   │           │               │              │
│  ┌──────▼──────┐     ┌──────▼───────────▼───────────────▼──────┐       │
│  │    React    │     │              SQLite Database             │       │
│  │  Components │     │  ┌────────┐  ┌──────────┐  ┌─────────┐  │       │
│  └─────────────┘     │  │ scans  │  │ findings │  │ access  │  │       │
│                      │  │        │  │          │  │  logs   │  │       │
│                      │  └────────┘  └──────────┘  └─────────┘  │       │
│                      └─────────────────────────────────────────┘       │
│                                        │                               │
│                               ┌────────▼────────┐                      │
│                               │  Nuclei Binary  │                      │
│                               │   (System PATH) │                      │
│                               └─────────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS | Server-side rendering, responsive UI |
| **Components** | shadcn/ui (Radix primitives) | Accessible, customizable UI library |
| **Authentication** | Auth.js v5 (NextAuth) | Session management, middleware protection |
| **Password Security** | bcrypt (10 rounds) | Secure credential hashing |
| **Database** | SQLite + better-sqlite3 | Embedded, zero-config persistence |
| **API** | Next.js Route Handlers | RESTful endpoints with type safety |
| **Process Mgmt** | Node.js child_process | Nuclei binary execution |
| **Caching** | In-memory TTL cache | Reduced database load |

---

## 🚀 Installation & Deployment

**We strongly recommend using Docker.** It allows you to run the full vulnerability dashboard without installing Node.js, Go, or configuring complex dependencies manually.

### Prerequisites
1.  **Docker Desktop** (running).
2.  That's it.

### Method 1: Docker Compose (Recommended)

**Step 1:** Create a project folder:
```bash
mkdir nuclei-cnm
cd nuclei-cnm
```

**Step 2:** Create `docker-compose.yml`:

> **Easier Option:** [Download this file from GitHub](https://github.com/devtint/NUCLEI_CNM/blob/main/docker-compose.yml) and save it as `docker-compose.yml`.

Or copy this exact content - it is production ready & includes Cloudflare Tunnel:

```yaml
services:
  nuclei-cnm:
    image: mrtintnaingwin/nucleicnm:latest
    container_name: nuclei-command-center
    ports:
      - "3000:3000"
    volumes:
      - nuclei_data:/app/data
      - nuclei_scans:/app/scans
      - nuclei_templates:/home/nextjs/nuclei-templates
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/nuclei.db
    restart: unless-stopped
    healthcheck:
      test: [ "CMD", "wget", "-q", "--spider", "http://localhost:3000/login" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: nuclei-cnm-tunnel
    command: tunnel --no-autoupdate --url http://nuclei-cnm:3000
    depends_on:
      - nuclei-cnm
    restart: unless-stopped

volumes:
  nuclei_data:
  nuclei_scans:
  nuclei_templates:
```

**Step 3:** Start the application:
Run these commands in order to ensure a clean start:

```bash
# 1. Stop any existing containers (prevents conflicts)
docker compose down

# 2. Start the application
docker compose up -d
```
*Wait ~30 seconds for the database to initialize.*

> [!IMPORTANT]
> ### 🛑 First Run: "No templates provided" Error?
>
> If your first scan fails with **"no templates provided"**, it is because the templates folder is empty.
>
> **1. Fix Permissions (One-time):**
> Docker creates the folder as `root`, but the app needs to write to it. Run this:
> ```bash
> docker exec -u 0 nuclei-command-center chown -R nextjs:nodejs /home/nextjs/nuclei-templates
> ```
>
> **2. Download Templates:**
> ```bash
> docker exec nuclei-command-center nuclei -ut
> ```
> *Or click "Update" in the System > Scanners dashboard.*

**Step 4:** Get your HTTPS URL (Cloudflare Tunnel)
This setup includes a free, secure Cloudflare Tunnel so you can access the dashboard from anywhere without opening ports.

```bash
docker compose logs -f cloudflared
```
You will see a URL like: `https://silent-snowflake-9d2a.trycloudflare.com`

> **Note**: This URL changes if the container restarts.

**Step 5:** Finish Setup:
*   Open your **Cloudflare URL** (or `http://localhost:3000` if on the same machine)
*   Follow the **Setup Wizard** to create your admin password.

---

### 🏠 Localhost Only (No Tunnel)
If you do **NOT** want public access and only want to use the dashboard on your local network:

> **Option A:** [Download `docker-compose.local.yml`](https://github.com/devtint/NUCLEI_CNM/blob/main/docker-compose.local.yml), rename it to `docker-compose.yml`, and run `docker compose up -d`.

> **Option B:** Copy the code below into a new `docker-compose.yml` file:

```yaml
services:
  nuclei-cnm:
    image: mrtintnaingwin/nucleicnm:latest
    container_name: nuclei-command-center
    ports:
      - "3000:3000"
    volumes:
      - nuclei_data:/app/data
      - nuclei_scans:/app/scans
      - nuclei_templates:/home/nextjs/nuclei-templates
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/nuclei.db
    restart: unless-stopped
    healthcheck:
      test: [ "CMD", "wget", "-q", "--spider", "http://localhost:3000/login" ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  nuclei_data:
  nuclei_scans:
  nuclei_templates:
```

---

### Method 2: One-Line Command (Quick Test)

```bash
docker run -d \
  --name nuclei-cnm \
  -p 3000:3000 \
  -v nuclei_data:/app/data \
  -v nuclei_scans:/app/scans \
  mrtintnaingwin/nucleicnm:latest
```

---

### Alternative: Build from Source
If you are a developer contributor and want to run from source code (requires installing Go, Node.js manually), please follow the **[Manual Installation Guide](MANUAL_INSTALL.md)**.

---

---

## 🛠 Maintenance

### How to Update
To update to the latest version without losing data:

#### Using Docker Compose (Recommended)
```bash
# 1. Pull the latest image
docker-compose pull

# 2. Recreate the container
# This REPLACES the container but KEEPS your data (mounted in ./data and ./scans)
docker-compose up -d
```

#### Using Docker Run
You must manually stop, remove, and restart:
```bash
docker stop nuclei-cnm
docker rm nuclei-cnm
# Run the start command again (ensure -v flags point to the SAME folders)
docker run ... -v ${PWD}/data:/app/data ...
```

### Data Persistence
We use **Docker Named Volumes** by default (`nuclei_data`, `nuclei_scans`). This ensures your data survives container updates and is independent of your host directory.

- **Backup Data**:
  ```bash
  # Copy database to host
  docker cp nuclei-command-center:/app/data/nuclei.db ./nuclei.db
  ```
- **Access Logs/Scans**:
  ```bash
  # List scan results
  docker exec nuclei-command-center ls -l /app/scans
  ```

---

## Security

### Authentication Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Edge Middleware (proxy.ts)                        │
│  ├─ Intercepts ALL requests before routing                  │
│  ├─ Validates session existence                             │
│  ├─ Redirects unauthenticated users to /login               │
│  └─ Enforces HTTPS in production                            │
│                                                              │
│  Layer 2: API Route Guards                                   │
│  ├─ Every API handler calls await auth()                    │
│  ├─ Returns 401 Unauthorized if no session                  │
│  └─ Prevents direct API access bypass                       │
│                                                              │
│  Layer 3: Password Security                                  │
│  ├─ Bcrypt hashing with 10 salt rounds                      │
│  ├─ Timing-safe comparison                                  │
│  └─ No plaintext password storage                           │
│                                                              │
│  Layer 4: Session Management                                 │
│  ├─ Secure HTTP-only cookies                                │
│  ├─ CSRF protection (built-in)                              │
│  └─ Configurable session lifetime                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **Secrets Management** | All secrets in `.env.local` (gitignored) |
| **Password Policy** | Minimum 12 characters recommended |
| **SQL Injection** | Prepared statements via better-sqlite3 |
| **XSS Prevention** | React's built-in escaping + CSP headers |
| **CSRF Protection** | NextAuth automatic token validation |
| **Access Logging** | Authentication events logged to database |
| **Sensitive Data** | Database and scan results excluded from Git |

### Protected Resources

| Resource | Protection Method |
|----------|-------------------|
| `/` (Dashboard) | Middleware redirect |
| `/vulnerabilities` | Middleware redirect |
| `/api/scan` | 401 if no session |
| `/api/findings` | 401 if no session |
| `/api/backup/*` | 401 if no session |
| `/api/system/*` | 401 if no session |

---

## Configuration

### Environment Variables

#### Local Development

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD_HASH` | ✅ | Bcrypt hash of admin password |
| `AUTH_SECRET` | ✅ | Session signing secret (32+ chars) |
| `NODE_ENV` | ❌ | `development` or `production` |
| `ALLOWED_ORIGINS` | ❌ | Comma-separated allowed origins (default: `localhost:3000`) |
| `NUCLEI_BINARY` | ❌ | Custom path to Nuclei binary (auto-detected via PATH) |
| `SUBFINDER_BINARY` | ❌ | Custom path to Subfinder binary (auto-detected via PATH) |
| `HTTPX_BINARY` | ❌ | Custom path to HTTPX binary (auto-detected via PATH) |

#### Docker Deployment

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD_HASH` | ❌ | **Auto-configured via setup wizard** |
| `AUTH_SECRET` | ❌ | **Auto-generated via setup wizard** |
| `ALLOWED_ORIGINS` | ❌ | Override for remote access |
| `DATABASE_PATH` | ❌ | Custom database location (default: `/app/data/nuclei.db`) |

> **Docker Note**: Password and auth secret are configured via the first-run setup wizard. No manual bcrypt hash generation required!

### Performance Tuning

Located in **Settings** within the dashboard:

| Setting | Default | Range | Impact |
|---------|---------|-------|--------|
| Rate Limit | 150 req/s | 50-1000 | Target server load |
| Concurrency | 25 | 25-300 | Parallel template execution |
| Bulk Size | 25 | 25-100 | Hosts per batch |

---

---

## Project Structure

```
NUCLEI_CNM/
├── dashboard/                          # Next.js Application
│   ├── app/                            # App Router
│   │   ├── api/                        # Backend API Routes
│   │   │   ├── auth/                   # NextAuth endpoints
│   │   │   ├── scan/                   # Scan CRUD operations
│   │   │   ├── findings/               # Finding management
│   │   │   ├── backup/                 # Export/restore
│   │   │   └── system/                 # Engine updates, health
│   │   ├── login/                      # Authentication page
│   │   └── page.tsx                    # Main dashboard
│   ├── components/                     # React Components
│   │   ├── dashboard/                  # Overview, stats
│   │   ├── findings/                   # Table, filters
│   │   ├── scan/                       # Wizard, console
│   │   └── ui/                         # shadcn/ui primitives
│   ├── lib/                            # Core Logic
│   │   ├── db.ts                       # Database operations
│   │   ├── cache.ts                    # TTL caching
│   │   ├── env.ts                      # Environment handling
│   │   └── nuclei/                     # Config, presets
│   ├── proxy.ts                        # Authentication middleware
│   ├── auth.ts                         # Credentials provider
│   ├── auth.config.ts                  # NextAuth config
│   └── scans/                          # Scan output (gitignored)
├── Refrencce and Usage And Guide/      # Technical Documentation
│   ├── GETTING_STARTED.md
│   ├── AUTHENTICATION.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── FEATURES.md
│   └── COMPONENTS.md
├── .gitignore                          # Security-conscious ignores
└── README.md                           # This file
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](./Refrencce%20and%20Usage%20And%20Guide/GETTING_STARTED.md) | Complete setup and first scan guide |
| [AUTHENTICATION.md](./Refrencce%20and%20Usage%20And%20Guide/AUTHENTICATION.md) | Security implementation details |
| [ARCHITECTURE.md](./Refrencce%20and%20Usage%20And%20Guide/ARCHITECTURE.md) | System design and data flow |
| [API_REFERENCE.md](./Refrencce%20and%20Usage%20And%20Guide/API_REFERENCE.md) | Endpoint specifications |
| [FEATURES.md](./Refrencce%20and%20Usage%20And%20Guide/FEATURES.md) | Feature catalog |
| [COMPONENTS.md](./Refrencce%20and%20Usage%20And%20Guide/COMPONENTS.md) | React component documentation |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/enhancement`)
3. Commit changes (`git commit -m 'feat: add new capability'`)
4. Push to branch (`git push origin feature/enhancement`)
5. Open a Pull Request

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `security:` Security improvements

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

Nuclei is a product of [ProjectDiscovery](https://projectdiscovery.io/) and is also licensed under the [MIT License](https://github.com/projectdiscovery/nuclei/blob/master/LICENSE).

---

## Acknowledgments

- [ProjectDiscovery](https://projectdiscovery.io/) for Nuclei, Subfinder, and HTTPX
- [Vercel](https://vercel.com/) for Next.js
- [shadcn](https://ui.shadcn.com/) for the UI component library
- [Auth.js](https://authjs.dev/) for authentication primitives

---

<p align="center">
  <strong>Built with 🔐 Security in Mind</strong>
</p>
