#!/bin/sh
set -e

echo "🚀 Starting Nuclei Command Center..."

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
