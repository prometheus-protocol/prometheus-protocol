#!/bin/bash
# Check status of verifier bots across all deployment types
# This script helps you quickly see which bots are running and their health

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 Verifier Bot Fleet Status"
echo "============================"
echo ""

# Check Docker Compose
echo "📦 Docker Compose Status:"
if docker-compose ps --services >/dev/null 2>&1; then
    running_count=$(docker-compose ps --filter "status=running" | grep -c "verifier-bot" || echo "0")
    total_count=$(docker-compose ps --services | grep -c "verifier-bot" || echo "0")
    
    if [ "$running_count" -gt 0 ]; then
        echo "   ✅ $running_count/$total_count bots running"
        docker-compose ps | grep "verifier-bot"
    else
        echo "   ❌ No bots running (use ./start-local.sh to start)"
    fi
else
    echo "   ⚪ Not deployed with Docker Compose"
fi

echo ""

# Check kind cluster
echo "🐳 kind (Local Kubernetes) Status:"
if command -v kind &> /dev/null && kind get clusters 2>/dev/null | grep -q "verifier-bots"; then
    echo "   ✅ kind cluster exists"
    
    if command -v kubectl &> /dev/null; then
        kubectl config use-context kind-verifier-bots >/dev/null 2>&1 || true
        
        if kubectl get namespace prometheus-verifiers >/dev/null 2>&1; then
            pod_count=$(kubectl get pods -n prometheus-verifiers --no-headers 2>/dev/null | wc -l)
            running_count=$(kubectl get pods -n prometheus-verifiers --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
            
            echo "   📊 Pods: $running_count/$pod_count running"
            kubectl get pods -n prometheus-verifiers 2>/dev/null | head -11
        else
            echo "   ⚪ Namespace not deployed (use ./deploy-kind.sh)"
        fi
    else
        echo "   ⚠️  kubectl not installed"
    fi
else
    echo "   ⚪ kind cluster not running"
fi

echo ""

# Check production Kubernetes
echo "☁️  Production Kubernetes Status:"
if command -v kubectl &> /dev/null; then
    current_context=$(kubectl config current-context 2>/dev/null || echo "none")
    
    if [[ "$current_context" == "none" ]]; then
        echo "   ⚪ No kubectl context configured"
    elif [[ "$current_context" == *"kind"* ]]; then
        echo "   ⚪ Currently on kind cluster (see above)"
    else
        echo "   📍 Context: $current_context"
        
        if kubectl get namespace prometheus-verifiers >/dev/null 2>&1; then
            pod_count=$(kubectl get pods -n prometheus-verifiers --no-headers 2>/dev/null | wc -l)
            running_count=$(kubectl get pods -n prometheus-verifiers --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
            
            echo "   📊 Pods: $running_count/$pod_count running"
            kubectl get pods -n prometheus-verifiers 2>/dev/null | head -11
        else
            echo "   ⚪ Namespace not deployed (use ./deploy-production.sh)"
        fi
    fi
else
    echo "   ⚪ kubectl not installed"
fi

echo ""
echo "============================"
echo "📚 Quick Commands:"
echo ""
echo "Docker Compose:"
echo "  Start:  ./start-local.sh"
echo "  Logs:   docker-compose logs -f"
echo "  Stop:   docker-compose down"
echo ""
echo "kind:"
echo "  Deploy: ./deploy-kind.sh"
echo "  Logs:   kubectl logs -n prometheus-verifiers -l app=verifier-bot -f"
echo "  Delete: kind delete cluster --name verifier-bots"
echo ""
echo "Production:"
echo "  Deploy: ./deploy-production.sh"
echo "  Logs:   kubectl logs -n prometheus-verifiers -l app=verifier-bot -f"
echo "  Delete: kubectl delete namespace prometheus-verifiers"
echo ""
