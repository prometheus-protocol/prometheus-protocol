# Verifier Bot - Dockerfile
# Node.js runtime with DFX for PocketIC support

FROM node:20-bookworm-slim

# Install dependencies
# - git: for cloning repositories
# - docker.io + docker-compose: for running reproducible builds (uses host Docker daemon)
# - libunwind8: required by PocketIC binary
# - procps: provides pgrep for healthcheck
RUN apt-get update && apt-get install -y \
    git \
    docker.io \
    docker-compose \
    curl \
    ca-certificates \
    libunwind8 \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Download and install DFX (includes PocketIC server since 0.26.0)
ENV DFX_VERSION=0.29.0
RUN curl -fsSL "https://github.com/dfinity/sdk/releases/download/${DFX_VERSION}/dfx-${DFX_VERSION}-x86_64-linux.tar.gz" -o dfx.tar.gz && \
    tar -xzf dfx.tar.gz && \
    mv dfx /usr/local/bin/dfx && \
    rm dfx.tar.gz && \
    chmod +x /usr/local/bin/dfx

# Install @dfinity/pic for TypeScript bindings (will use DFX's PocketIC server)
RUN npm install @dfinity/pic@^0.16.1 --omit=dev

# Copy compiled and bundled TypeScript (everything else is bundled into dist/index.js)
COPY dist ./dist

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Set environment variables
ENV NODE_ENV=production
ENV IC_NETWORK=ic

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*index.js" || exit 1

# Start DFX PocketIC server and verifier bot
CMD ["./start.sh"]
