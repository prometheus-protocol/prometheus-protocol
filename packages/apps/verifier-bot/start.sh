#!/bin/bash
set -e

# Start the verifier bot (PocketIC is started programmatically)
echo "🤖 Starting verifier bot..."
exec node dist/index.js
