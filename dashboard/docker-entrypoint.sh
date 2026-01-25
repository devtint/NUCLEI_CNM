#!/bin/sh
set -e

echo "🚀 Starting Nuclei Command Center..."

# Fix NextAuth UntrustedHost Error
# This is required because we are running in Docker behind a port mapping
export AUTH_TRUST_HOST=true
# Set internal database path if not set
export DATABASE_PATH=${DATABASE_PATH:-/app/data/nuclei.db}

# Initialize configuration (Generate AUTH_SECRET if missing)
node scripts/init-config.js

# Set default base URL for Next.js application
export NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}

# Create data directory if not exists
mkdir -p /app/data
mkdir -p /app/scans/logs
mkdir -p /app/scans/uploads
mkdir -p /app/public/screenshots

# Update nuclei templates on first run (if templates don't exist)
if [ ! -d "$HOME/nuclei-templates" ]; then
    echo "📦 Downloading Nuclei templates (first run)..."
    nuclei -update-templates -silent || echo "⚠️ Template update failed, will retry on first scan"
fi

echo "✅ Initialization complete"
echo "📊 Dashboard available at http://0.0.0.0:3000"

# Execute the main command
exec "$@"
