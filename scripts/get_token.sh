#!/bin/bash

# ======================================================================================
# get_token.sh
#
# This script exchanges an authorization code for a JWT access token.
# It reads the client credentials and PKCE verifier from the environment.
#
# PREREQUISITE: This script requires 'jq'.
#
# USAGE:
#   1. Run `source .env.prom` to load your credentials.
#   2. Run this script with the authorization code from the browser redirect:
#      ./get_token.sh <paste_authorization_code_here>
#
# ======================================================================================

# --- CONFIGURATION ---
AUTH_CANISTER_ID="avqkn-guaaa-aaaaa-qaaea-cai" # Example ID, replace me!
# ---------------------

# 1. Check for prerequisites (jq)
if ! command -v jq &> /dev/null
then
    echo "❌ ERROR: 'jq' is not installed." >&2
    exit 1
fi

# 2. Check for the authorization code argument
if [ -z "$1" ]; then
    echo "❌ ERROR: Authorization code is missing." >&2
    echo "   USAGE: ./get_token.sh <authorization_code>" >&2
    exit 1
fi
AUTH_CODE=$1

# 3. Check for required environment variables
if [ -z "$NEW_CLIENT_ID" ] || [ -z "$NEW_CLIENT_SECRET" ] || [ -z "$PKCE_VERIFIER" ]; then
    echo "❌ ERROR: Required environment variables are not set." >&2
    echo "   Please run 'source .env.prom' after registering a client and generating an auth URL." >&2
    exit 1
fi

echo "➡️  Exchanging authorization code for a token..."

# 4. Call the /token endpoint and pretty-print the response
curl -s -X POST \
  --resolve $AUTH_CANISTER_ID.localhost:4943:127.0.0.1 \
  http://$AUTH_CANISTER_ID.localhost:4943/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=$AUTH_CODE" \
  -d "client_id=$NEW_CLIENT_ID" \
  -d "client_secret=$NEW_CLIENT_SECRET" \
  -d "code_verifier=$PKCE_VERIFIER" | jq .

echo -e "\n✅ Token exchange complete." >&2