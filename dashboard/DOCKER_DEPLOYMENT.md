# 🐳 Docker Deployment Guide

## Quick Start

### Using Docker Compose (Recommended)

```bash
# 1. Set environment variables
export AUTH_SECRET="your-secure-random-secret"
export ADMIN_PASSWORD_HASH=$(node scripts/hash-password.js "your-password")

# 2. Build and start
docker-compose up -d

# 3. Access the dashboard
open http://localhost:3000
```

### Using Docker CLI

```bash
# Build image
docker build -t nuclei-dashboard:latest .

# Run container
docker run -d \
  --name nuclei-command-center \
  -p 3000:3000 \
  -e AUTH_SECRET="your-secret" \
  -e ADMIN_PASSWORD_HASH="your-hash" \
  -v nuclei-data:/app/nuclei.db \
  -v $(pwd)/scans:/app/scans \
  nuclei-dashboard:latest
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | ✅ Yes | NextAuth.js secret (min 32 chars) |
| `ADMIN_PASSWORD_HASH` | ✅ Yes | Bcrypt hash of admin password |
| `DOCKER_ENV` | Auto | Set to `true` in container |
| `NODE_ENV` | Auto | Set to `production` |
| `PORT` | No | Default: 3000 |

### Generate Password Hash

```bash
# In dashboard directory
node scripts/hash-password.js "YourSecurePassword123"
```

## Volume Mounts

```yaml
volumes:
  # Database persistence (critical)
  - nuclei-data:/app/nuclei.db
  
  # Scan results
  - ./scans:/app/scans
  
  # Nuclei configuration
  - nuclei-config:/root/.config/nuclei
  
  # Templates (auto-downloaded on first scan)
  - nuclei-templates:/root/nuclei-templates
```

## Network Modes

### Bridge Mode (Default)
- Standard Docker networking
- Port mapping: `-p 3000:3000`
- Suitable for most deployments

### Host Mode (High Performance)
- Direct host network access
- No NAT overhead
- Maximum scan throughput

```yaml
# In docker-compose.yml
network_mode: host
```

## Production Deployment

### 1. Update Templates on Startup

```bash
docker exec -it nuclei-command-center nuclei -update-templates
```

### 2. Monitor Logs

```bash
docker logs -f nuclei-command-center
```

### 3. Health Check

```bash
curl http://localhost:3000/api/system/status
```

### 4. Backup Database

```bash
docker cp nuclei-command-center:/app/nuclei.db ./backup-$(date +%Y%m%d).db
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs nuclei-command-center

# Common issues:
# 1. AUTH_SECRET not set
# 2. ADMIN_PASSWORD_HASH missing
# 3. Port 3000 already in use
```

### Scans fail immediately
```bash
# Verify nuclei binary
docker exec nuclei-command-center nuclei -version

# Check templates
docker exec nuclei-command-center ls -la /root/nuclei-templates
```

### Database locked errors
```bash
# Check WAL mode enabled
docker exec nuclei-command-center sqlite3 /app/nuclei.db "PRAGMA journal_mode;"
# Should output: wal
```

## Security Best Practices

1. **Never use default passwords**
   ```bash
   # Generate strong password
   openssl rand -base64 32
   ```

2. **Use environment files**
   ```bash
   # Create .env file
   echo "AUTH_SECRET=$(openssl rand -base64 32)" > .env
   echo "ADMIN_PASSWORD_HASH=..." >> .env
   
   # Load in docker-compose
   docker-compose --env-file .env up -d
   ```

3. **Restrict network access**
   ```yaml
   # Only expose locally
   ports:
     - "127.0.0.1:3000:3000"
   ```

4. **Regular backups**
   ```bash
   # Automated backup script
   0 2 * * * docker cp nuclei-command-center:/app/nuclei.db /backups/nuclei-$(date +\%Y\%m\%d).db
   ```

## Updating

```bash
# Pull latest code
git pull

# Rebuild image
docker-compose build --no-cache

# Restart with new image
docker-compose up -d

# Verify version
docker exec nuclei-command-center node -v
docker exec nuclei-command-center nuclei -version
```

## Performance Tuning

### High-Volume Scanning

```yaml
environment:
  # Increase Node.js memory
  - NODE_OPTIONS="--max-old-space-size=4096"
  
resources:
  limits:
    memory: 4G
    cpus: '2'
```

### Database Optimization

```sql
-- Run inside container
docker exec nuclei-command-center sqlite3 /app/nuclei.db <<EOF
PRAGMA optimize;
VACUUM;
ANALYZE;
EOF
```

## Multi-Container Setup

For distributed scanning:

```yaml
version: '3.8'
services:
  dashboard:
    # Main dashboard
    
  scanner-1:
    image: projectdiscovery/nuclei:latest
    # Dedicated scanner node
    
  redis:
    image: redis:alpine
    # Optional: Shared state
```

## Support

- 📖 Full Documentation: `/docs`
- 🐛 Issues: GitHub Issues
- 💬 Community: Discord/Slack
