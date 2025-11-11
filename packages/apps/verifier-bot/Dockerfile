# Verifier Bot - Dockerfile
# Simple Node.js runtime that uses Docker on the host system

FROM node:20-alpine

# Install git for cloning repositories and docker tools for reproducible builds
RUN apk add --no-cache \
    git \
    docker-cli \
    docker-cli-compose \
    bash

WORKDIR /app

# Install only @dfinity/pic (the one external dependency)
# Use npm to avoid pnpm workspace resolution issues
# PicJS will automatically download the PocketIC binary on first use
RUN npm install @dfinity/pic@^0.16.1 --omit=dev

# Ensure PocketIC binary has correct permissions (readable and executable by all)
RUN chmod 755 /app/node_modules/@dfinity/pic/pocket-ic 2>/dev/null || true

# Copy compiled and bundled TypeScript (everything else is bundled into dist/index.js)
COPY dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV IC_NETWORK=ic

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*index.js" || exit 1

# Start the verifier bot
CMD ["node", "dist/index.js"]
