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
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules if needed (Debian based)
RUN apt-get update && apt-get install -y python3 make g++ libc6-dev && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (Debian glibc allows pre-built better-sqlite3 binaries, bypassing QEMU compilation crashes)
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies for Next.js and sqlite
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Create a non-root user and group
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nextjs

# Copy built assets and standalone Next.js server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure data directory exists with correct permissions
RUN mkdir -p /app/data /app/scans /app/scans/logs /app/scans/uploads /app/public/screenshots /home/nextjs /app/bin && \
    chown -R nextjs:nodejs /app/data /app/scans /app/public/screenshots /home/nextjs /app/bin

# Copy pre-compiled Go tools from Stage 1 into the runner
COPY --from=tools --chown=nextjs:nodejs /go/bin/nuclei /app/bin/nuclei
COPY --from=tools --chown=nextjs:nodejs /go/bin/subfinder /app/bin/subfinder
COPY --from=tools --chown=nextjs:nodejs /go/bin/httpx /app/bin/httpx

# Copy docker entrypoint
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
ENV NEXT_TELEMETRY_DISABLED=1

# Switch to non-root user
USER nextjs

# Set home directory for nuclei templates
ENV HOME=/home/nextjs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
