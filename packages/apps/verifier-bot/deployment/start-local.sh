#!/bin/bash
# Local development deployment script using Docker Compose
# This is the simplest way to run 10 verifier bots locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting 10 Verifier Bots with Docker Compose"
echo "================================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Copy .env.example to .env and configure your API keys:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment variables
source .env

# Validate API keys are set
for i in {1..10}; do
    var_name="VERIFIER_${i}_API_KEY"
    if [ -z "${!var_name}" ] || [ "${!var_name}" == "vr_0123456789abcdef0123456789abcdef" ]; then
        echo "⚠️  Warning: $var_name not configured in .env"
    fi
done

# Build the Docker image
echo ""
echo "📦 Building verifier bot Docker image..."
docker-compose build

# Start all bots
echo ""
echo "🚀 Starting all 10 verifier bots..."
docker-compose up -d

echo ""
echo "✅ All bots started successfully!"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f                    # All bots"
echo "   docker-compose logs -f verifier-bot-1     # Specific bot"
echo ""
echo "🔍 Check status:"
echo "   docker-compose ps"
echo ""
echo "🛑 Stop all bots:"
echo "   docker-compose down"
