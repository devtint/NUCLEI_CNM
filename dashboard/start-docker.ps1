# Docker Build & Run Script for Windows
# Make sure Docker Desktop is running before executing

Write-Host "Docker Nuclei Command Center - Deployment" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -NoNewline
try {
    docker version | Out-Null
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Build Steps:" -ForegroundColor Yellow
Write-Host "  1. Building Docker image (this may take 5-10 minutes)..."
Write-Host "  2. Creating container with your credentials..."
Write-Host "  3. Starting application..."
Write-Host ""

# Build the image
Write-Host "Building image..." -ForegroundColor Cyan
docker build -t nuclei-dashboard:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green
Write-Host ""

# Load .env file
$env:AUTH_SECRET = ""
$env:ADMIN_PASSWORD_HASH = ""

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^AUTH_SECRET="?([^"]+)"?') {
            $env:AUTH_SECRET = $matches[1]
        }
        if ($_ -match '^ADMIN_PASSWORD_HASH=(.+)$') {
            $env:ADMIN_PASSWORD_HASH = $matches[1].Trim('"')
        }
    }
}

if (-not $env:AUTH_SECRET -or -not $env:ADMIN_PASSWORD_HASH) {
    Write-Host "WARNING: .env file not found or incomplete" -ForegroundColor Yellow
}

Write-Host "Using credentials from .env file:" -ForegroundColor Cyan
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: SuperSlowApi" -ForegroundColor White
Write-Host ""
Write-Host "Starting container..." -ForegroundColor Cyan

# Remove old container if exists
docker rm -f nuclei-command-center 2>$null

# Run the container
docker run -d `
    --name nuclei-command-center `
    -p 3000:3000 `
    -e "DOCKER_ENV=true" `
    -e "AUTH_SECRET=$env:AUTH_SECRET" `
    -e "ADMIN_PASSWORD_HASH=$env:ADMIN_PASSWORD_HASH" `
    -e "AUTH_TRUST_HOST=true" `
    -v nuclei-data:/app/nuclei.db `
    -v "${PWD}/scans:/app/scans" `
    nuclei-dashboard:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start container" -ForegroundColor Red
    exit 1
}

Write-Host "Container started!" -ForegroundColor Green
Write-Host ""

# Wait for startup
Write-Host "Waiting for application to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Show logs
Write-Host ""
Write-Host "Recent logs:" -ForegroundColor Yellow
docker logs --tail 20 nuclei-command-center

Write-Host ""
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Access the dashboard at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login credentials:" -ForegroundColor Yellow
Write-Host "   Username: admin" -ForegroundColor White
Write-Host "   Password: SuperSlowApi" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "   View logs:    docker logs -f nuclei-command-center" -ForegroundColor White
Write-Host "   Stop:         docker stop nuclei-command-center" -ForegroundColor White
Write-Host "   Restart:      docker restart nuclei-command-center" -ForegroundColor White
Write-Host "   Remove:       docker rm -f nuclei-command-center" -ForegroundColor White
Write-Host ""
