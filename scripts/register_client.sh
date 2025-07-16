#!/bin/bash

# ======================================================================================
# register_client.sh
#
# This script dynamically registers a new client with the Prometheus Protocol
# auth canister, parses the response, and saves the credentials to a file
# named '.env.prom' for easy sourcing.
#
# PREREQUISITE: This script requires 'jq'.
# Install it with:
#   - macOS: brew install jq
#   - Debian/Ubuntu: sudo apt-get install jq
#
# USAGE:
#   1. Run the script: ./register_client.sh
#   2. Source the output file to set the variables: source .env.prom
#
# ======================================================================================

# --- CONFIGURATION ---
# !!! IMPORTANT: Replace this with your actual backend canister ID !!!
AUTH_CANISTER_ID="avqkn-guaaa-aaaaa-qaaea-cai" # Example ID, replace me!
# ---------------------

# Set the name of the output file
ENV_FILE=".env.prom"

# 1. Check for prerequisites (jq)
if ! command -v jq &> /dev/null
then
    echo "❌ ERROR: 'jq' is not installed. Please install it to continue."
    echo "   - On macOS: brew install jq"
    echo "   - On Debian/Ubuntu: sudo apt-get install jq"
    exit 1
fi

# 2. Check if canister ID has been configured
if [[ "$AUTH_CANISTER_ID" == *"replace me"* ]]; then
    echo "❌ ERROR: Please edit this script and replace the placeholder AUTH_CANISTER_ID."
    exit 1
fi

echo "➡️  Registering new client with canister: $AUTH_CANISTER_ID..."

# 3. Call the /register endpoint and capture the JSON response
RESPONSE=$(curl -s -X POST \
  --resolve $AUTH_CANISTER_ID.localhost:4943:127.0.0.1 \
  http://$AUTH_CANISTER_ID.localhost:4943/register \
  -H "Content-Type: application/json" \
  -d '{
        "client_name": "My CLI-Registered App",
        "redirect_uris": ["https://jwt.io", "http://localhost:3000/callback"]
      }')

# 4. Parse the response with jq
CLIENT_ID=$(echo "$RESPONSE" | jq -r .client_id)
CLIENT_SECRET=$(echo "$RESPONSE" | jq -r .client_secret)

# 5. Check if parsing was successful
if [[ "$CLIENT_ID" == "null" || -z "$CLIENT_ID" || "$CLIENT_SECRET" == "null" || -z "$CLIENT_SECRET" ]]; then
    echo "❌ ERROR: Failed to parse client credentials from the server response."
    echo "--- RAW SERVER RESPONSE ---"
    echo "$RESPONSE"
    echo "---------------------------"
    exit 1
fi

# 6. Write the export commands to the .env file
echo "# Prometheus Protocol client credentials" > "$ENV_FILE"
echo "# Generated on $(date)" >> "$ENV_FILE"
echo "export NEW_CLIENT_ID=\"$CLIENT_ID\"" >> "$ENV_FILE"
echo "export NEW_CLIENT_SECRET=\"$CLIENT_SECRET\"" >> "$ENV_FILE"

# 7. Print a success message and clear instructions to the user
echo -e "\n✅ Success! Client credentials have been saved to '$ENV_FILE'."
