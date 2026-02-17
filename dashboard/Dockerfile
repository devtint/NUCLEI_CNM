# =============================================================================
# Stage 1: Build Go Tools (nuclei, subfinder, httpx)
# =============================================================================
FROM golang:1.23-alpine AS tools

RUN apk add --no-cache git

# Enable automatic toolchain download for newer Go requirements
ENV GOTOOLCHAIN=auto

# Install ProjectDiscovery tools
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# =============================================================================
# Stage 2: Build Next.js Application
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies (includes building native modules)
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for better-sqlite3 native module
RUN apk add --no-cache libc6-compat libstdc++

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create data directories BEFORE switching user
RUN mkdir -p /app/data /app/scans /app/scans/logs /app/scans/uploads /app/public/screenshots /home/nextjs

# Copy Go tools from stage 1
COPY --from=tools /go/bin/nuclei /usr/local/bin/
COPY --from=tools /go/bin/subfinder /usr/local/bin/
COPY --from=tools /go/bin/httpx /usr/local/bin/

# Copy built application from stage 2
# The standalone output includes node_modules for dependencies
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set ownership of all directories + Go tool binaries (so -up self-update works)
RUN chown -R nextjs:nodejs /app /home/nextjs && \
    chown nextjs:nodejs /usr/local/bin/nuclei /usr/local/bin/subfinder /usr/local/bin/httpx

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH=/app/data/nuclei.db

# Switch to non-root user
USER nextjs

# Set home directory for nuclei templates
ENV HOME=/home/nextjs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
