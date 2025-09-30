#!/bin/bash

# Test runner script for Discord Bot

set -e

echo "🚀 Discord Bot Test Runner"
echo "=========================="

# Function to run tests with different options
run_tests() {
    local mode=$1
    local pattern=$2
    
    echo "Running tests in $mode mode..."
    
    case $mode in
        "watch")
            echo "Starting test watch mode (Press 'q' to quit)"
            pnpm test:watch $pattern
            ;;
        "coverage")
            echo "Running tests with coverage report"
            pnpm vitest run --coverage $pattern
            ;;
        "ui")
            echo "Starting Vitest UI (will open in browser)"
            pnpm vitest --ui $pattern
            ;;
        "run"|*)
            pnpm test:run $pattern
            ;;
    esac
}

# Parse command line arguments
MODE="run"
PATTERN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -w|--watch)
            MODE="watch"
            shift
            ;;
        -c|--coverage)
            MODE="coverage"
            shift
            ;;
        -u|--ui)
            MODE="ui"
            shift
            ;;
        -p|--pattern)
            PATTERN="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -w, --watch     Run tests in watch mode"
            echo "  -c, --coverage  Run tests with coverage report"
            echo "  -u, --ui        Open Vitest UI in browser"
            echo "  -p, --pattern   Run specific test pattern"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                          # Run all tests once"
            echo "  $0 --watch                  # Run tests in watch mode"
            echo "  $0 --coverage               # Run with coverage"
            echo "  $0 --pattern oauth-provider # Run only OAuth provider tests"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Not in Discord bot root directory"
    exit 1
fi

# Check if vitest is installed
if ! pnpm list vitest > /dev/null 2>&1; then
    echo "Error: Vitest not installed. Run 'pnpm install' first."
    exit 1
fi

# Run the tests
run_tests $MODE $PATTERN

echo ""
echo "✅ Test run completed!"