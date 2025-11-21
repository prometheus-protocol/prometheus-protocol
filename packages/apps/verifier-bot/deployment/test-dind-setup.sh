#!/bin/bash
# Test script to replicate node provider environment
# This tests the Docker-in-Docker setup locally before sharing with node providers

set -e

echo "🧪 Testing Verifier Bot Docker-in-Docker Setup"
echo "=============================================="
echo ""

# Check prerequisites
echo "✅ Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env and add your API keys, then run this script again."
    exit 1
fi

# Verify .env has real API keys (not the example ones)
if grep -q "vr_0123456789abcdef" .env; then
    echo "⚠️  .env file still contains example API keys."
    echo "📝 Please edit .env and add your real API keys from the Prometheus Protocol dashboard."
    exit 1
fi

echo "✅ .env file configured"
echo ""

# Test with just 1 bot first
echo "🚀 Starting single test bot (verifier-bot-1)..."
docker-compose -f docker-compose-dind.yml up -d verifier-bot-1 dind-1

echo ""
echo "⏳ Waiting 10 seconds for containers to start..."
sleep 10

echo ""
echo "📊 Container status:"
docker-compose -f docker-compose-dind.yml ps

echo ""
echo "🔍 Checking if verifier bot can connect to Docker daemon..."
echo "   (Looking for Docker connectivity in logs...)"
sleep 5

# Check logs for errors
if docker-compose -f docker-compose-dind.yml logs verifier-bot-1 | grep -i "cannot connect to.*docker"; then
    echo ""
    echo "❌ FAILED: Verifier bot cannot connect to Docker daemon"
    echo ""
    echo "📋 Recent logs from verifier-bot-1:"
    docker-compose -f docker-compose-dind.yml logs --tail=50 verifier-bot-1
    echo ""
    echo "📋 Recent logs from dind-1:"
    docker-compose -f docker-compose-dind.yml logs --tail=50 dind-1
    echo ""
    echo "🛑 Stopping test containers..."
    docker-compose -f docker-compose-dind.yml down
    exit 1
fi

echo ""
echo "✅ No Docker connection errors found"
echo ""

echo "📋 Last 30 lines of verifier-bot-1 logs:"
docker-compose -f docker-compose-dind.yml logs --tail=30 verifier-bot-1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST PASSED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The verifier bot is running successfully with Docker-in-Docker."
echo ""
echo "Next steps:"
echo "  1. Check logs: docker-compose -f docker-compose-dind.yml logs -f"
echo "  2. Start all 10 bots: docker-compose -f docker-compose-dind.yml up -d"
echo "  3. Stop test: docker-compose -f docker-compose-dind.yml down"
echo ""
echo "To share with node providers:"
echo "  - Send them: docker-compose-dind.yml + .env.example + NODE_PROVIDER_SETUP.md"
echo "  - They need: Docker + Docker Compose + 10 API keys"
echo ""
