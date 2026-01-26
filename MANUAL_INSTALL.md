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
git clone https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard
npm install
```

## Step 3: Initialize and Run

Start the development server:

```bash
npm run dev
```

## Step 4: Setup

1. Open your browser to **http://localhost:3000**
2. You will see the **Setup Wizard**.
3. Create your **Admin Password**.
4. Done!

> **Note:** The setup wizard creates a `data/config.json` file. You do NOT need to manually configure `.env.local` unless you want to override defaults.
