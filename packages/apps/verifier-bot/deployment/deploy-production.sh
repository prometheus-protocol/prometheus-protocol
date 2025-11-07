#!/bin/bash
# Deploy verifier bots to a production Kubernetes cluster
# Works with any K8s cluster: GKE, EKS, AKS, DigitalOcean, etc.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Deploying Verifier Bots to Production Kubernetes"
echo "===================================================="

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

# Verify we're not on a kind cluster
CURRENT_CONTEXT=$(kubectl config current-context)
if [[ "$CURRENT_CONTEXT" == *"kind"* ]]; then
    echo "⚠️  Warning: You appear to be on a kind (local) cluster"
    echo "   Current context: $CURRENT_CONTEXT"
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Current kubectl context: $CURRENT_CONTEXT"
read -p "Deploy to this cluster? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Switch context with: kubectl config use-context <context-name>"
    exit 1
fi

# Check secrets
echo "🔐 Checking secrets configuration..."
if grep -q "REPLACE_WITH_ACTUAL_KEY" k8s/secrets.yaml; then
    echo "❌ Error: secrets.yaml contains placeholder values"
    echo "   You must update k8s/secrets.yaml with real API keys"
    echo "   Each bot needs its own API key from the verifier dashboard"
    exit 1
fi

# Create namespace
echo "📁 Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Apply secrets and config
echo "🔐 Applying secrets and config..."
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Deploy the bots
echo "🚀 Deploying 10 verifier bots..."
kubectl apply -f k8s/deployments.yaml

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 Monitor rollout:"
echo "   kubectl rollout status deployment/verifier-bot-1 -n prometheus-verifiers"
echo ""
echo "📋 View all pods:"
echo "   kubectl get pods -n prometheus-verifiers -w"
echo ""
echo "📋 View logs:"
echo "   kubectl logs -n prometheus-verifiers -l app=verifier-bot -f --max-log-requests=10"
echo ""
echo "🔍 Check specific bot:"
echo "   kubectl logs -n prometheus-verifiers -l instance=verifier-1 -f"
echo ""
echo "♻️  Update deployment:"
echo "   ./deploy-production.sh"
echo ""
echo "🛑 Delete all bots:"
echo "   kubectl delete namespace prometheus-verifiers"
