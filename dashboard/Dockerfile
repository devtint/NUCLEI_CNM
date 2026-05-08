# =============================================================================
# Stage 1: Download Pre-built Go Tools (nuclei, subfinder, httpx)
# =============================================================================
# Instead of compiling from source (which causes OOM crashes on GitHub Actions),
# we download the official pre-compiled static binaries for the target architecture.
FROM alpine:3.19 AS tools

ARG TARGETARCH

RUN apk add --no-cache curl unzip

RUN mkdir -p /go/bin && \
    if [ "$TARGETARCH" = "amd64" ]; then \
      export ARCH="amd64"; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
      export ARCH="arm64"; \
    else \
      echo "Unsupported architecture: $TARGETARCH" && exit 1; \
    fi && \
    # Download Nuclei
    curl -sL "https://github.com/projectdiscovery/nuclei/releases/download/v3.3.8/nuclei_3.3.8_linux_${ARCH}.zip" -o nuclei.zip && \
    unzip nuclei.zip nuclei && mv nuclei /go/bin/ && \
    # Download Subfinder
    curl -sL "https://github.com/projectdiscovery/subfinder/releases/download/v2.6.7/subfinder_2.6.7_linux_${ARCH}.zip" -o subfinder.zip && \
    unzip subfinder.zip subfinder && mv subfinder /go/bin/ && \
    # Download HTTPX
    curl -sL "https://github.com/projectdiscovery/httpx/releases/download/v1.6.9/httpx_1.6.9_linux_${ARCH}.zip" -o httpx.zip && \
    unzip httpx.zip httpx && mv httpx /go/bin/

# =============================================================================
# Stage 2: Build Next.js Application
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies with retry logic to handle transient network issues (ECONNRESET)
RUN until npm ci; do echo "Retrying npm ci..."; sleep 5; done

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
RUN mkdir -p /app/data /app/scans /app/scans/logs /app/scans/uploads /app/public/screenshots /home/nextjs /app/bin

# Copy Go tools to user-owned directory (so self-update can write temp files + replace binaries)
COPY --from=tools /go/bin/nuclei /app/bin/
COPY --from=tools /go/bin/subfinder /app/bin/
COPY --from=tools /go/bin/httpx /app/bin/

# Copy built application from stage 2
# The standalone output includes node_modules for dependencies
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set ownership of all directories (includes /app/bin with Go tools)
RUN chown -R nextjs:nodejs /app /home/nextjs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH=/app/data/nuclei.db
ENV PATH="/app/bin:$PATH"

# Switch to non-root user
USER nextjs

# Set home directory for nuclei templates
ENV HOME=/home/nextjs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
