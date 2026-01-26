# Manual Installation (Source Code)

This guide is for developers or users who prefer to run the application from source code instead of using Docker.

## Prerequisites

| Requirement | Version | Verification |
|-------------|---------|--------------|
| Node.js | ≥ 18.0.0 | `node --version` |
| npm | ≥ 9.0.0 | `npm --version` |
| Go | ≥ 1.21 | `go version` |
| Nuclei | ≥ 3.6.0 | `nuclei -version` |

## Step 1: Install ProjectDiscovery Tools

```bash
# Install Nuclei
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Install Subfinder (optional, for subdomain discovery)
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Install HTTPX (optional, for HTTP probing)
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# Ensure Go bin is in PATH
# Windows: Add %USERPROFILE%\go\bin to PATH
# Linux/macOS: export PATH=$PATH:$(go env GOPATH)/bin
```

## Step 2: Clone and Install

```bash
git clone https://github.com/yourusername/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard
npm install
```

## Step 3: Configure Authentication

Generate a secure password hash:

```bash
# Using Node.js (Run inside dashboard folder)
cd dashboard
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YOUR_SECURE_PASSWORD', 10).then(h => console.log(h));"
cd ..
```

Generate an auth secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Create `dashboard/.env.local`:

```env
# Required: Bcrypt hash of your admin password
ADMIN_PASSWORD_HASH="$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Required: Random secret for session signing (32+ characters)
AUTH_SECRET="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

## Step 4: Initialize and Run

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

Access the dashboard at **http://localhost:3000**
