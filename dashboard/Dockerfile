# Multi-stage Dockerfile for Nuclei Command Center
# Production-ready Docker appliance with Alpine Linux

# ============================================
# Stage 1: Go Tools Builder
# ============================================
FROM golang:1.24-alpine AS go-builder

# Install ProjectDiscovery tools
RUN apk add --no-cache git ca-certificates && \
    go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# ============================================
# Stage 2: Node.js Dependencies Builder
# ============================================
FROM node:20-alpine AS node-builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install dependencies with native module compilation
RUN apk add --no-cache python3 make g++ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --build-from-source || npm install --build-from-source && \
    npm cache clean --force

# Copy application code
COPY . .

# Ensure middleware.ts exists for Next.js authentication
# Note: Source should have middleware.ts (not proxy.ts)
RUN if [ ! -f middleware.ts ]; then echo "ERROR: middleware.ts not found"; exit 1; fi

# Build Next.js application
RUN npm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    tini \
    openssl

# Create app user and directories
RUN addgroup -S appuser && \
    adduser -S -G appuser appuser && \
    mkdir -p /app /app/data /root/.config /app/certs && \
    chown -R appuser:appuser /app

WORKDIR /app

# Copy Go binaries from builder
COPY --from=go-builder /go/bin/nuclei /usr/local/bin/nuclei
COPY --from=go-builder /go/bin/subfinder /usr/local/bin/subfinder
COPY --from=go-builder /go/bin/httpx /usr/local/bin/httpx

# Copy Node.js dependencies and built app
COPY --from=node-builder --chown=appuser:appuser /build/node_modules ./node_modules
COPY --from=node-builder --chown=appuser:appuser /build/.next ./.next
COPY --from=node-builder --chown=appuser:appuser /build/public ./public
COPY --from=node-builder --chown=appuser:appuser /build/package*.json ./

# Copy application source (needed for lib/ and app/ imports)
COPY --chown=appuser:appuser . .

# Generate self-signed SSL certificate
RUN openssl req -x509 -newkey rsa:2048 -nodes -sha256 \
    -subj "/CN=localhost" \
    -keyout /app/certs/localhost-key.pem \
    -out /app/certs/localhost.pem \
    -days 365 && \
    chown -R appuser:appuser /app/certs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PATH="/usr/local/bin:${PATH}"

# Expose port
EXPOSE 3000 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const https = require('https'); https.get({hostname:'localhost',port:3000,path:'/api/system/status',rejectUnauthorized:false}, (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Switch to non-root user
USER appuser

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Create data directory with correct permissions on container start
CMD ["sh", "-c", "mkdir -p /app/data && npm start"]
