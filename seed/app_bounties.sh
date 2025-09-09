#!/bin/bash

# ==================================================================================
# Seed Bounties Script
#
# Description:
# This script populates the `app_bounties` canister with the three example
# bounties used in the frontend mock data. It must be run by the principal
# that owns the canister.
#
# Usage:
# 1. Make sure you are in the root directory of your project.
# 2. Ensure the canister is deployed to your local replica.
# 3. Make the script executable: `chmod +x seed/app_bounties.sh`
# 4. Run the script: `./seed/app_bounties.sh`
# ==================================================================================

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Canister Information ---
CANISTER_NAME="app_bounties"

# --- Bounty 1: PMP Token Faucet ---
TITLE_1="PMP Token Faucet"
DESC_1="Get PMP tokens for development of Prometheus MCP servers."
REWARD_1=0.0001
TOKEN_1="USDC"
STATUS_1="Open"
# Using $'...' to correctly handle newlines and special characters in the markdown.
DETAILS_1=$'The PMP Token Faucet provides developers with the necessary tokens to build and test their applications on the Prometheus Protocol.\n\n### Key Features\n*   Get tokens for testing and development\n*   Uses On-Chain Identity for secure access\n*   Instant token delivery\n\nClick [here](https://discord.com/channels/YOUR_SERVER_ID/YOUR_CHANNEL_ID) to claim on Discord.'

# --- Bounty 2: Implement Metrics Endpoint ---
TITLE_2="Implement Metrics Endpoint"
DESC_2="Add a Prometheus-compatible /metrics endpoint to the node."
REWARD_2=0.05
TOKEN_2="USDC"
STATUS_2="Open"
DETAILS_2=$'This bounty is for implementing a standard `/metrics` endpoint on the MCP server node that exposes key performance indicators.\n\n### Acceptance Criteria\n1.  Endpoint must be available at `/metrics`.\n2.  Must be compatible with Prometheus scraping.\n3.  Must include at least the following metrics:\n    *   `mcp_active_connections`\n    *   `mcp_requests_total` (with method and status labels)\n    *   `mcp_request_duration_seconds` (histogram)\n\nSubmit a pull request to the main repository for review. Claim the bounty in the Discord channel once the PR is merged.\n\nClick [here](https://discord.com/channels/YOUR_SERVER_ID/YOUR_CHANNEL_ID) to claim on Discord.'

# --- Bounty 3: Documentation Translation: Japanese ---
TITLE_3="Documentation Translation: Japanese"
DESC_3="Translate the core protocol documentation into Japanese."
REWARD_3=0.02
TOKEN_3="USDC"
STATUS_3="In Progress"
DETAILS_3=$'We are looking for a native Japanese speaker to translate our core technical documentation.\n\n### Scope\n*   Protocol Overview\n*   Getting Started Guide\n*   API Reference\n\nPlease coordinate in the Discord channel before starting work to avoid duplication of effort.\n\nClick [here](https://discord.com/channels/YOUR_SERVER_ID/YOUR_CHANNEL_ID) to coordinate and claim.'


# --- Execution ---
echo "🚀 Starting to seed bounties into the '$CANISTER_NAME' canister..."
echo "Make sure you are running this as the canister owner."
echo ""

# Call the create_bounty method for each bounty
echo "Adding bounty 1: $TITLE_1"
dfx canister call "$CANISTER_NAME" create_bounty \
  "(\"$TITLE_1\", \"$DESC_1\", $REWARD_1, \"$TOKEN_1\", \"$STATUS_1\", \"$DETAILS_1\")"

echo "Adding bounty 2: $TITLE_2"
dfx canister call "$CANISTER_NAME" create_bounty \
  "(\"$TITLE_2\", \"$DESC_2\", $REWARD_2, \"$TOKEN_2\", \"$STATUS_2\", \"$DETAILS_2\")"

echo "Adding bounty 3: $TITLE_3"
dfx canister call "$CANISTER_NAME" create_bounty \
  "(\"$TITLE_3\", \"$DESC_3\", $REWARD_3, \"$TOKEN_3\", \"$STATUS_3\", \"$DETAILS_3\")"

echo ""
echo "✅ All example bounties have been added successfully."