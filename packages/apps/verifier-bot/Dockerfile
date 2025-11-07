# Verifier Bot - Dockerfile
# Simple Node.js runtime that uses Docker on the host system

FROM node:20-alpine

# Install git for cloning repositories
# Docker CLI for running reproducible builds (uses host Docker daemon)
RUN apk add --no-cache \
    git \
    docker-cli \
    bash

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --production

# Copy compiled TypeScript (assumes build happens before docker build)
COPY dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV IC_NETWORK=ic

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*index.js" || exit 1

# Start the verifier bot
CMD ["node", "dist/index.js"]
