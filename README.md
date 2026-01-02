<div align="center">

# 🛡️ Nuclei Command Center
### The Self-Hosted Vulnerability Operations Platform

[![License](https://img.shields.io/badge/license-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Docker Hub](https://img.shields.io/badge/Docker_Hub-mrtintnaingwin/nuclei--command--center-2496ED?style=for-the-badge&logo=docker)](https://hub.docker.com/r/mrtintnaingwin/nuclei-command-center)
[![Stack](https://img.shields.io/badge/Stack-Next.js_15_&_React_19-black?style=for-the-badge)](https://nextjs.org/)
[![Security](https://img.shields.io/badge/Security-Hardened-blue?style=for-the-badge)](#-security-features)

**Orchestrate your Nuclei & Subfinder scanners with a powerful, persistent dashboard.**
Turn ephemeral CLI output into a permanent, intelligent asset inventory.

[Features](#-features) • [Security](#-security-features) • [Installation](#-installation) • [Troubleshooting](#-troubleshooting)

</div>

---

## ⚡ Use Cases

### 🔍 For Bug Bounty Hunters
*   **Never Lose Context**: Every scan is saved. Compare today's findings with last month's.
*   **Visual Recon**: See what targets look like before you visit them (HTTPX Screenshots).
*   **Live Injection**: Fix findings in real-time without re-scanning.

### 🏢 For SecOps Teams
*   **Continuous Monitoring**: Run daily cron jobs via API to update your asset inventory.
*   **Drift Detection**: Automatically flagged when a "Fixed" issue re-appears (**Regression**) or a new subdomain pops up.
*   **Centralized Knowledge**: A single source of truth for all current exposures.

---

## 🌟 Key Capabilities

### 1. Smart Vulnerability Management
*   **Modern Card Interface**: Rich, visual card-based feed with severity-coded borders and inline actions (Copy, Rescan, Delete).
*   **Deduplication**: Intelligent hashing ensures you never see the same duplicate finding twice (even if protocols differ: `http` vs `https`).
*   **Lifecycle Tracking**:
    *   **🆕 NEW**: Fresh findings from recent scans.
    *   **✅ FIXED**: Issues that were present but vanished in the latest scan.
    *   **⚠️ REGRESSION**: Issues that were fixed but have returned.

### 2. Live Asset Probing (HTTPX)
*   **Visual Recon**: Full-screen drill-down with captured screenshots of every live target.
*   **Tech Stack**: Automatic detection of WAFs (Cloudflare, AWS), CMS (WordPress, Drupal), and frameworks (React, Vue).
*   **Change Detection**: Track when assets change status codes (e.g., 403 Forbidden -> 200 OK).

### 3. Attack Surface Monitoring (Subfinder)
*   **Continuous Inventory**: Keep a database of every subdomain ever found.
*   **"New Discoveries"**: Automatically diffs daily scans to highlight *only* fresh targets.
*   **Global Search**: Instantly search across thousands of assets by IP, Title, Technology, or Subdomain.

### 4. Scanner Management (System)
*   **Centralized Control**: Manage Nuclei, Subfinder, and HTTPX versions from a single interface.
*   **One-Click Updates**: Keep your engines and templates fresh with instant update actions.
*   **Smart Detection**: Automatically finds installed versions and template snapshots, with cross-platform support for Windows/Linux paths (e.g., `~/.local`).

### 5. Backup & Restore
*   **Complete Data Export**: Create full backups of all Nuclei findings, Subfinder discoveries, and HTTPX results in a single JSON file.
*   **Secure Format**: Proprietary backup format with version metadata prevents accidental imports of incompatible data.
*   **Transaction-Safe Restore**: All-or-nothing restore with automatic rollback on errors ensures database integrity.
*   **Import External Scans**: Upload Nuclei JSON output from CI/CD pipelines or remote scans for centralized management.
*   **Duplicate Prevention**: Automatic deduplication during restore prevents data conflicts.

---

## 🔒 Security Features (Hardened)

This dashboard is designed to be exposed to the internet safely.

1.  **Bcrypt Password Hashing**: Passwords are never stored in plain text.
2.  **HTTPS Enforcement**: Middleware automatically redirects all HTTP traffic to HTTPS in production.
3.  **Strict Env Validation**: server fails fast if security keys are missing.
4.  **Cross-Platform**: Full support for Linux, macOS, and Windows file systems.

---

## 🚀 Installation Guide

### Prerequisites
Before you begin, ensure you have:
- **Docker Desktop** installed ([Windows](https://docs.docker.com/desktop/install/windows-install/) | [Mac](https://docs.docker.com/desktop/install/mac-install/) | [Linux](https://docs.docker.com/desktop/install/linux-install/))
- **Docker Compose** (included with Docker Desktop)
- **Git** for cloning the repository
- Basic understanding of terminal/command line

---

## 🐳 Docker Installation (Step-by-Step)

### Method 1: Pre-Built Docker Image (Fastest - Recommended)

This method uses the pre-built image from Docker Hub. Setup time: ~2-5 minutes.

#### Step 1: Create a Project Directory
```bash
# Windows (PowerShell)
mkdir C:\nuclei-dashboard
cd C:\nuclei-dashboard

# Linux/Mac
mkdir ~/nuclei-dashboard
cd ~/nuclei-dashboard
```

#### Step 2: Pull the Docker Image
```bash
docker pull mrtintnaingwin/nuclei-command-center:latest
```
**What this does:** Downloads the pre-built container image (~500MB) with all scanners and dependencies included.

#### Step 3: Generate Security Credentials

**⚠️ IMPORTANT: Do this step carefully to avoid "Invalid Credentials" errors**

##### 3a. Generate AUTH_SECRET
```bash
# Windows (PowerShell)
$AUTH_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "AUTH_SECRET=$AUTH_SECRET"

# Linux/Mac
AUTH_SECRET=$(openssl rand -base64 32)
echo "AUTH_SECRET=$AUTH_SECRET"
```
**Save this output** - you'll need it in the next step.

##### 3b. Generate Password Hash
Choose your admin password and generate its hash:

```bash
# Replace 'YourSecurePassword123' with your actual password
docker run --rm node:20-alpine sh -c "npm install bcryptjs && node -e \"console.log(require('bcryptjs').hashSync('YourSecurePassword123', 12))\""
```

**Example output:**
```
$2b$12$K9j5XH8fGq1pN7vL2mR8euTxYzW4J6Qq3Fh5vN8kL1mP9oX7wQ2hK
```

**⚠️ CRITICAL:** Copy the ENTIRE hash including `$2b$12$...`. Do NOT modify or truncate it.

#### Step 4: Create Environment File

Create a file named `nuclei.env` in your project directory:

```bash
# Windows (PowerShell)
@"
AUTH_SECRET=paste-your-auth-secret-here
ADMIN_PASSWORD_HASH=paste-your-full-hash-here
NODE_ENV=production
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0
"@ | Out-File -FilePath nuclei.env -Encoding utf8

# Linux/Mac
cat > nuclei.env << 'EOF'
AUTH_SECRET=paste-your-auth-secret-here
ADMIN_PASSWORD_HASH=paste-your-full-hash-here
NODE_ENV=production
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0
EOF
```

**⚠️ CRITICAL RULES:**
1. **NO spaces** around the `=` sign
2. **NO quotes** around values
3. Replace `paste-your-auth-secret-here` with the AUTH_SECRET from Step 3a
4. Replace `paste-your-full-hash-here` with the ENTIRE hash from Step 3b
5. The hash must start with `$2b$12$` and be exactly 60 characters long

**Example of CORRECT .env file:**
```
AUTH_SECRET=xK9j2pQ7vL3mR5nT8wY1zA4bC6dE0fG
ADMIN_PASSWORD_HASH=$2b$12$K9j5XH8fGq1pN7vL2mR8euTxYzW4J6Qq3Fh5vN8kL1mP9oX7wQ2hK
NODE_ENV=production
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0
```

#### Step 5: Verify Your Environment File

```bash
# Windows (PowerShell)
Get-Content nuclei.env

# Linux/Mac
cat nuclei.env
```

**Check that:**
- AUTH_SECRET is a 32+ character random string
- ADMIN_PASSWORD_HASH starts with `$2b$12$`
- ADMIN_PASSWORD_HASH is exactly 60 characters long
- NO lines have quotes around values

#### Step 6: Run the Container

```bash
docker run -d \
  --name nuclei-command-center \
  -p 3000:3000 \
  -v nuclei-data:/app/data \
  -v nuclei-config:/root/.config/nuclei \
  --env-file nuclei.env \
  --restart unless-stopped \
  mrtintnaingwin/nuclei-command-center:latest
```

**What this does:**
- `-d`: Runs container in background
- `--name nuclei-command-center`: Names the container for easy management
- `-p 3000:3000`: Maps port 3000 (access via https://localhost:3000)
- `-v nuclei-data:/app/data`: Persistent database storage
- `-v nuclei-config:/root/.config/nuclei`: Persistent Nuclei templates
- `--env-file nuclei.env`: Loads your credentials
- `--restart unless-stopped`: Auto-restart on system reboot

#### Step 7: Verify Container is Running

```bash
docker ps | grep nuclei-command-center
```

**Expected output:**
```
CONTAINER ID   IMAGE                                          STATUS         PORTS
abc123def456   mrtintnaingwin/nuclei-command-center:latest   Up 30 seconds  0.0.0.0:3000->3000/tcp
```

#### Step 8: Check Application Logs

```bash
docker logs nuclei-command-center
```

**Look for these success indicators:**
```
✓ Ready in 3s
✓ Local: https://localhost:3000
✓ Nuclei templates initialized
```

#### Step 9: Access the Dashboard

1. Open your browser to: **https://localhost:3000**
2. You'll see a security warning (self-signed certificate) - click "Advanced" → "Proceed"
3. Login with:
   - **Username:** `admin`
   - **Password:** The password you chose in Step 3b (NOT the hash)

---

### Method 2: Build From Source (Docker Compose)

This method builds the image locally. Setup time: ~10-15 minutes.

#### Step 1: Clone the Repository

```bash
# Windows (PowerShell)
cd C:\
git clone -b docker https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM\dashboard

# Linux/Mac
cd ~
git clone -b docker https://github.com/devtint/NUCLEI_CNM.git
cd NUCLEI_CNM/dashboard
```

**⚠️ If you encounter Git conflicts:**
```bash
# Abort any pending operations
git cherry-pick --abort
git merge --abort
git rebase --abort

# Force clean checkout
git reset --hard origin/docker
git clean -fd
```

#### Step 2: Create Environment File

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

#### Step 3: Generate AUTH_SECRET

```bash
# Windows (PowerShell)
$AUTH_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Add-Content .env "AUTH_SECRET=$AUTH_SECRET"
Write-Host "Generated AUTH_SECRET: $AUTH_SECRET"

# Linux/Mac
AUTH_SECRET=$(openssl rand -base64 32)
echo "AUTH_SECRET=$AUTH_SECRET" >> .env
echo "Generated AUTH_SECRET: $AUTH_SECRET"
```

#### Step 4: Generate Password Hash

```bash
# Replace 'YourSecurePassword123' with your desired password
docker run --rm node:20-alpine sh -c "npm install bcryptjs && node -e \"console.log(require('bcryptjs').hashSync('YourSecurePassword123', 12))\""
```

**Copy the ENTIRE hash output**, then add it to your .env file:

```bash
# Windows (PowerShell)
Add-Content .env "ADMIN_PASSWORD_HASH=paste-hash-here"

# Linux/Mac
echo "ADMIN_PASSWORD_HASH=paste-hash-here" >> .env
```

#### Step 5: Add Required Environment Variables

```bash
# Windows (PowerShell)
Add-Content .env "NODE_ENV=production"
Add-Content .env "PORT=3000"
Add-Content .env "NODE_TLS_REJECT_UNAUTHORIZED=0"

# Linux/Mac
echo "NODE_ENV=production" >> .env
echo "PORT=3000" >> .env
echo "NODE_TLS_REJECT_UNAUTHORIZED=0" >> .env
```

#### Step 6: Verify .env File

```bash
# Windows (PowerShell)
Get-Content .env

# Linux/Mac
cat .env
```

**Your .env should look like:**
```
AUTH_SECRET=xK9j2pQ7vL3mR5nT8wY1zA4bC6dE0fG
ADMIN_PASSWORD_HASH=$2b$12$K9j5XH8fGq1pN7vL2mR8euTxYzW4J6Qq3Fh5vN8kL1mP9oX7wQ2hK
NODE_ENV=production
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0
```

#### Step 7: Start the Application

```bash
docker-compose up -d --build
```

**What this does:**
- `up`: Starts the services
- `-d`: Runs in background
- `--build`: Builds the image from source

**⚠️ First build takes 5-10 minutes** (downloads Node.js, Go, scanners, etc.)

#### Step 8: Monitor Build Progress

```bash
docker-compose logs -f
```

**Press `Ctrl+C` to stop following logs** (container keeps running)

#### Step 9: Verify Deployment

```bash
docker-compose ps
```

**Expected output:**
```
NAME                    STATUS              PORTS
nuclei-command-center   Up 2 minutes       0.0.0.0:3000->3000/tcp
```

#### Step 10: Access the Dashboard

Visit **https://localhost:3000** and login with `admin` / your password.

---

## 🔧 Troubleshooting & Error Solutions

### Error 1: "Invalid Credentials" After Login

**Symptom:** You enter correct credentials but keep seeing "Invalid credentials" error.

**Root Cause:** Docker Compose corrupted the bcrypt hash by interpreting `$` as a variable.

**Solution A: Fix the .env File (Recommended)**

1. **Stop the container:**
   ```bash
   docker-compose down
   # OR for Method 1:
   docker stop nuclei-command-center
   docker rm nuclei-command-center
   ```

2. **Regenerate password hash:**
   ```bash
   docker run --rm node:20-alpine sh -c "npm install bcryptjs && node -e \"console.log(require('bcryptjs').hashSync('YourPassword123', 12))\""
   ```

3. **Edit your .env file manually:**
   ```bash
   # Windows
   notepad .env
   
   # Linux/Mac
   nano .env
   ```

4. **Replace ADMIN_PASSWORD_HASH with the new hash (entire line):**
   ```
   ADMIN_PASSWORD_HASH=$2b$12$K9j5XH8fGq1pN7vL2mR8euTxYzW4J6Qq3Fh5vN8kL1mP9oX7wQ2hK
   ```

5. **⚠️ CRITICAL RULES:**
   - NO quotes around the hash
   - NO spaces before or after `=`
   - Hash must be EXACTLY 60 characters
   - Hash must start with `$2b$12$`

6. **Save file and restart:**
   ```bash
   docker-compose up -d
   # OR for Method 1:
   docker run -d --name nuclei-command-center -p 3000:3000 \
     -v nuclei-data:/app/data -v nuclei-config:/root/.config/nuclei \
     --env-file nuclei.env mrtintnaingwin/nuclei-command-center:latest
   ```

**Solution B: Generate Hash Inside Container**

```bash
# For running container
docker exec nuclei-command-center node /app/scripts/hash-password.js YourPassword123

# Copy the output and update .env file, then restart
```

**Solution C: Verify docker-compose.yml Uses env_file**

Edit `docker-compose.yml` and ensure:
```yaml
services:
  app:
    env_file:
      - .env  # ✅ CORRECT - Preserves $ symbols
    # NOT this:
    # environment:
    #   - ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH}  # ❌ WRONG
```

---

### Error 2: Password Hash Truncated or Corrupted

**Symptom:** Hash in .env is shorter than 60 characters or contains unexpected characters.

**Diagnosis:**
```bash
# Windows (PowerShell)
$hash = (Get-Content .env | Select-String "ADMIN_PASSWORD_HASH").ToString().Split('=')[1]
Write-Host "Hash length: $($hash.Length)"
Write-Host "Hash value: $hash"

# Linux/Mac
hash=$(grep ADMIN_PASSWORD_HASH .env | cut -d'=' -f2)
echo "Hash length: ${#hash}"
echo "Hash value: $hash"
```

**Expected:** Length should be exactly 60 characters, starting with `$2b$12$`

**Solution:**

1. **Delete corrupted entry:**
   ```bash
   # Windows (PowerShell)
   (Get-Content .env) | Where-Object {$_ -notmatch 'ADMIN_PASSWORD_HASH'} | Set-Content .env
   
   # Linux/Mac
   sed -i '/ADMIN_PASSWORD_HASH/d' .env
   ```

2. **Generate fresh hash:**
   ```bash
   docker run --rm node:20-alpine sh -c "npm install bcryptjs && node -e \"console.log(require('bcryptjs').hashSync('YourPassword123', 12))\""
   ```

3. **Add to .env WITHOUT quotes:**
   ```bash
   # Windows (PowerShell)
   Add-Content .env "ADMIN_PASSWORD_HASH=$paste_full_hash_here"
   
   # Linux/Mac
   echo "ADMIN_PASSWORD_HASH=$paste_full_hash_here" >> .env
   ```

4. **Restart container:**
   ```bash
   docker-compose restart
   ```

---

### Error 3: Git Pull Conflicts

**Symptom:** 
```
error: Pulling is not possible because you have unmerged files.
fatal: Exiting because of an unresolved conflict.
```

**Solution A: Abort Pending Operations**
```bash
cd "d:\Build Docker\NUCLEI_CNM"  # Or your path
git cherry-pick --abort
git merge --abort
git rebase --abort
git status  # Should show "working tree clean"
```

**Solution B: Force Clean Checkout**
```bash
# Save your local changes first
git stash

# Reset to remote branch
git fetch origin docker
git reset --hard origin/docker
git clean -fd

# Restore your changes (optional)
git stash pop
```

**Solution C: Start Fresh**
```bash
cd ..
rm -rf NUCLEI_CNM  # Or on Windows: Remove-Item -Recurse -Force NUCLEI_CNM
git clone -b docker https://github.com/devtint/NUCLEI_CNM.git
```

---

### Error 4: Container Fails to Start

**Symptom:** Container exits immediately after starting.

**Diagnosis:**
```bash
docker logs nuclei-command-center
```

**Common Issues:**

**A) Missing Environment Variables**
```
Error: AUTH_SECRET is required
```
**Solution:** Check your .env file has all required variables (see Step 4 above).

**B) Port Already in Use**
```
Error: bind: address already in use
```
**Solution:** Either stop the conflicting service or change port:
```bash
# Use different port
docker run -d --name nuclei-command-center \
  -p 8080:3000 \  # Changed from 3000:3000
  -v nuclei-data:/app/data \
  --env-file nuclei.env \
  mrtintnaingwin/nuclei-command-center:latest

# Access at https://localhost:8080
```

**C) Permission Denied on Volumes**
```bash
# Linux/Mac - Fix volume permissions
docker volume rm nuclei-data nuclei-config
docker volume create nuclei-data
docker volume create nuclei-config
```

---

### Error 5: Database Not Persisting

**Symptom:** Scans disappear after container restart.

**Diagnosis:**
```bash
# Check if volumes exist
docker volume ls | grep nuclei

# Expected output:
# nuclei-data
# nuclei-config

# Inspect volume
docker volume inspect nuclei-data
```

**Solution:**
```bash
# Stop container
docker stop nuclei-command-center
docker rm nuclei-command-center

# Ensure volumes exist
docker volume create nuclei-data
docker volume create nuclei-config

# Restart with explicit volume mounts
docker run -d \
  --name nuclei-command-center \
  -p 3000:3000 \
  -v nuclei-data:/app/data \
  -v nuclei-config:/root/.config/nuclei \
  --env-file nuclei.env \
  mrtintnaingwin/nuclei-command-center:latest

# Verify database exists
docker exec nuclei-command-center ls -lh /app/data/
# Should show: nuclei.db with non-zero size
```

---

### Error 6: Scans Failing with "Command Not Found"

**Symptom:** Scans fail with errors like `nuclei: command not found`.

**Diagnosis:**
```bash
# Check if scanners are installed
docker exec nuclei-command-center which nuclei
docker exec nuclei-command-center which subfinder
docker exec nuclei-command-center which httpx

# Check versions
docker exec nuclei-command-center nuclei -version
docker exec nuclei-command-center subfinder -version
docker exec nuclei-command-center httpx -version
```

**Solution:**
```bash
# Rebuild container (Method 2)
docker-compose down
docker-compose up -d --build

# OR pull fresh image (Method 1)
docker pull mrtintnaingwin/nuclei-command-center:latest
docker stop nuclei-command-center
docker rm nuclei-command-center
# Then re-run the docker run command from Step 6
```

---

### Error 7: SSL Certificate Warnings

**Symptom:** Browser shows "Your connection is not private" or "NET::ERR_CERT_AUTHORITY_INVALID".

**This is NORMAL** - the application uses self-signed certificates.

**Solution:**
1. Click **Advanced**
2. Click **Proceed to localhost** (or similar)
3. Bookmark the page to avoid this warning in future

**Optional: Install Custom Certificate**
```bash
# Extract certificate from container
docker cp nuclei-command-center:/app/certs/cert.pem ./cert.pem

# Windows: Install to Trusted Root Certification Authorities
# Linux: sudo cp cert.pem /usr/local/share/ca-certificates/ && sudo update-ca-certificates
# Mac: Open cert.pem → Keychain Access → Always Trust
```

---

### Error 8: Environment Variables Not Loading

**Symptom:** Container starts but shows errors about missing AUTH_SECRET.

**Diagnosis:**
```bash
# Check environment inside container
docker exec nuclei-command-center env | grep -E "AUTH_SECRET|ADMIN_PASSWORD_HASH|NODE_ENV"
```

**Solution:**
```bash
# Verify .env file format
cat nuclei.env  # or .env for Method 2

# Must be:
# KEY=value (NO spaces, NO quotes)

# Recreate container with explicit env file
docker stop nuclei-command-center
docker rm nuclei-command-center
docker run -d --name nuclei-command-center \
  -p 3000:3000 \
  -v nuclei-data:/app/data \
  --env-file $(pwd)/nuclei.env \  # Use full path
  mrtintnaingwin/nuclei-command-center:latest
```

---

### Error 9: "Cannot Connect" or "ERR_CONNECTION_REFUSED"

**Symptom:** Browser can't connect to https://localhost:3000.

**Diagnosis:**
```bash
# Check if container is running
docker ps | grep nuclei

# Check if port is bound
docker port nuclei-command-center
# Should show: 3000/tcp -> 0.0.0.0:3000

# Check application logs
docker logs nuclei-command-center --tail 50
```

**Solutions:**

**A) Container not running**
```bash
docker start nuclei-command-center
```

**B) Application crashed**
```bash
docker logs nuclei-command-center  # Check for errors
docker restart nuclei-command-center
```

**C) Firewall blocking**
```bash
# Windows: Allow through Windows Firewall
# Settings → Windows Security → Firewall → Allow an app → Docker Desktop

# Linux: Check iptables
sudo iptables -L -n | grep 3000
```

---

## 🎯 Quick Reference Commands

### Container Management
```bash
# Start container
docker start nuclei-command-center

# Stop container
docker stop nuclei-command-center

# Restart container
docker restart nuclei-command-center

# View logs (live)
docker logs -f nuclei-command-center

# View last 100 lines
docker logs nuclei-command-center --tail 100

# Remove container (keeps data)
docker rm nuclei-command-center

# Remove container AND data
docker rm -v nuclei-command-center
docker volume rm nuclei-data nuclei-config
```

### Database Management
```bash
# Backup database
docker cp nuclei-command-center:/app/data/nuclei.db ./backup-$(date +%Y%m%d).db

# Restore database
docker cp ./backup-20260102.db nuclei-command-center:/app/data/nuclei.db
docker restart nuclei-command-center

# Check database size
docker exec nuclei-command-center du -h /app/data/nuclei.db
```

### Scanner Management
```bash
# Update Nuclei templates
docker exec nuclei-command-center nuclei -update-templates

# Check scanner versions
docker exec nuclei-command-center nuclei -version
docker exec nuclei-command-center subfinder -version
docker exec nuclei-command-center httpx -version

# Test scanner
docker exec nuclei-command-center nuclei -u https://example.com -t cves/
```

### Password Management
```bash
# Generate new password hash
docker exec nuclei-command-center node /app/scripts/hash-password.js NewPassword123

# Verify current environment
docker exec nuclei-command-center env | grep ADMIN_PASSWORD_HASH
```

### Update Application
```bash
# Method 1: Pull latest image
docker pull mrtintnaingwin/nuclei-command-center:latest
docker stop nuclei-command-center
docker rm nuclei-command-center
# Re-run docker run command (data persists in volumes)

# Method 2: Rebuild from source
cd NUCLEI_CNM/dashboard
git pull origin docker
docker-compose down
docker-compose up -d --build
```

---

## 🛡️ Security Best Practices

### 1. Strong Password
```bash
# Generate strong random password (Linux/Mac)
openssl rand -base64 24

# Windows (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object {[char]$_})
```

### 2. Regular Backups
```bash
# Automate daily backups (cron/Task Scheduler)
docker cp nuclei-command-center:/app/data/nuclei.db ./backups/nuclei-$(date +%Y%m%d).db

# Keep last 7 days only
find ./backups -name "nuclei-*.db" -mtime +7 -delete
```

### 3. Update Scanners Regularly
```bash
# Weekly template updates
docker exec nuclei-command-center nuclei -update-templates

# Monthly image updates
docker pull mrtintnaingwin/nuclei-command-center:latest
```

### 4. Monitor Logs
```bash
# Check for failed login attempts
docker logs nuclei-command-center | grep "Invalid credentials"

# Monitor scan activity
docker logs nuclei-command-center | grep "Scan completed"
```

### 5. Restrict Network Access
```bash
# Bind to localhost only (not exposed to internet)
docker run -d \
  --name nuclei-command-center \
  -p 127.0.0.1:3000:3000 \  # Only accessible from localhost
  -v nuclei-data:/app/data \
  --env-file nuclei.env \
  mrtintnaingwin/nuclei-command-center:latest
```

---

## 📊 What's Included

✅ **Pre-installed Scanners:**
- Nuclei v3 (vulnerability scanner)
- Subfinder v2 (subdomain discovery)
- HTTPX (HTTP probing with screenshots)

✅ **Features:**
- Persistent SQLite database (survives restarts)
- Automatic HTTPS with self-signed certificates
- Volume-mounted scan results
- Built-in authentication system
- Real-time scan logs
- Backup & restore functionality

✅ **System Requirements:**
- **RAM:** 2GB minimum (4GB recommended)
- **Disk:** 10GB free space
- **CPU:** 2 cores minimum
- **OS:** Windows 10/11, macOS 10.15+, Ubuntu 20.04+

---

## � License
Distributed under the **MIT License**.

---

## 🆘 Getting Help

**Still having issues?** 

1. Check logs: `docker logs nuclei-command-center --tail 100`
2. Verify .env file format (no quotes, no spaces around `=`)
3. Ensure hash is exactly 60 characters starting with `$2b$12$`
4. Try regenerating credentials from scratch (Steps 3-6 above)
5. Open an issue on GitHub with:
   - Your operating system
   - Docker version: `docker --version`
   - Error logs (sanitize sensitive data)
   - Steps you've already tried

**Common Quick Fixes:**
```bash
# Full reset (keeps database)
docker stop nuclei-command-center
docker rm nuclei-command-center
# Regenerate .env file
# Re-run docker run command

# Nuclear option (deletes everything)
docker stop nuclei-command-center
docker rm -v nuclei-command-center
docker volume rm nuclei-data nuclei-config
docker rmi mrtintnaingwin/nuclei-command-center:latest
# Start fresh from Step 1
```
