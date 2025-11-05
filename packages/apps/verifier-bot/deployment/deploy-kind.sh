#!/bin/bash
# Deploy verifier bots to a local kind (Kubernetes in Docker) cluster
# This simulates a production Kubernetes environment locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Deploying Verifier Bots to kind (Kubernetes in Docker)"
echo "=========================================================="

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "❌ kind is not installed"
    echo "   Install it with: brew install kind  (macOS)"
    echo "   Or visit: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    echo "   Install it with: brew install kubectl  (macOS)"
    exit 1
fi

# Check if cluster exists
if kind get clusters | grep -q "verifier-bots"; then
    echo "📦 Using existing kind cluster 'verifier-bots'"
else
    echo "📦 Creating kind cluster 'verifier-bots'..."
    kind create cluster --config kind-config.yaml
fi

# Set kubectl context
echo "🔧 Setting kubectl context..."
kubectl config use-context kind-verifier-bots

# Build and load the Docker image into kind
echo "🏗️  Building Docker image..."
cd ..
docker build -t verifier-bot:latest .

echo "📥 Loading image into kind cluster..."
kind load docker-image verifier-bot:latest --name verifier-bots

# Update image reference in deployments to use local image
echo "🔧 Updating deployment manifests for local use..."
cd deployment
sed 's|ghcr.io/prometheus-protocol/verifier-bot:latest|verifier-bot:latest|g' k8s/deployments.yaml > k8s/deployments-local.yaml
sed -i '' 's|imagePullPolicy: Always|imagePullPolicy: Never|g' k8s/deployments-local.yaml 2>/dev/null || sed -i 's|imagePullPolicy: Always|imagePullPolicy: Never|g' k8s/deployments-local.yaml

# Create namespace
echo "📁 Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Check if secrets file exists with real keys
if grep -q "REPLACE_WITH_ACTUAL_KEY" k8s/secrets.yaml; then
    echo "⚠️  Warning: secrets.yaml still contains placeholder values"
    echo "   Update k8s/secrets.yaml with real API keys before deploying to production"
    echo "   For local testing, this will still work but may fail authentication"
fi

# Apply secrets and config
echo "🔐 Creating secrets and config..."
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Deploy the bots
echo "🚀 Deploying 10 verifier bots..."
kubectl apply -f k8s/deployments-local.yaml

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 View deployment status:"
echo "   kubectl get pods -n prometheus-verifiers"
echo ""
echo "📋 View logs:"
echo "   kubectl logs -n prometheus-verifiers -l app=verifier-bot -f"
echo "   kubectl logs -n prometheus-verifiers verifier-bot-1-<pod-suffix> -f"
echo ""
echo "🔍 Check specific bot:"
echo "   kubectl describe pod -n prometheus-verifiers verifier-bot-1-<pod-suffix>"
echo ""
echo "🛑 Delete deployment:"
echo "   kubectl delete namespace prometheus-verifiers"
echo ""
echo "💻 Access cluster:"
echo "   kubectl config use-context kind-verifier-bots"
