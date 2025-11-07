#!/bin/bash
set -e

# Build and publish verifier-bot container to GitHub Container Registry (GHCR)
# Usage: ./publish-container.sh [version]
# Example: ./publish-container.sh v1.0.0
# If no version is provided, uses 'latest'

VERSION=${1:-latest}
REPO_OWNER="prometheus-protocol"
IMAGE_NAME="verifier-bot"
GHCR_IMAGE="ghcr.io/${REPO_OWNER}/${IMAGE_NAME}"

echo "🏗️  Building verifier-bot container..."
echo "   Image: ${GHCR_IMAGE}:${VERSION}"
echo ""

# Step 1: Build the TypeScript code
echo "📦 Building TypeScript code..."
pnpm build

# Step 2: Build the Docker image
echo "🐳 Building Docker image..."
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .

# Step 3: Tag for GHCR
echo "🏷️  Tagging for GHCR..."
docker tag ${IMAGE_NAME}:${VERSION} ${GHCR_IMAGE}:${VERSION}
docker tag ${IMAGE_NAME}:latest ${GHCR_IMAGE}:latest

# Step 4: Login to GHCR (if not already logged in)
echo "🔐 Logging in to GitHub Container Registry..."
echo "   (You may be prompted for your GitHub token)"
echo $GITHUB_TOKEN | docker login ghcr.io -u ${REPO_OWNER} --password-stdin

# Step 5: Push to GHCR
echo "⬆️  Pushing to GHCR..."
docker push ${GHCR_IMAGE}:${VERSION}
docker push ${GHCR_IMAGE}:latest

echo ""
echo "✅ Successfully published ${GHCR_IMAGE}:${VERSION}"
echo "✅ Also tagged as: ${GHCR_IMAGE}:latest"
echo ""
echo "🚀 To deploy to production:"
echo "   kubectl apply -f deployment/k8s/secrets-prod.yaml"
echo "   kubectl apply -f deployment/k8s/configmap-prod.yaml"
echo "   kubectl apply -f deployment/k8s/canister-ids-configmap-prod.yaml"
echo "   kubectl apply -f deployment/k8s/deployments-prod.yaml"
