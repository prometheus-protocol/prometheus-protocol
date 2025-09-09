#!/usr/bin/env zx
import { $ } from 'zx';
import { Principal } from '@dfinity/principal';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as bountyIdl } from '../packages/declarations/dist/generated/app_bounties/index.js';
import type { _SERVICE as BountyService } from '../packages/declarations/dist/generated/app_bounties/app_bounties.did.js';
import { loadDfxIdentity } from './identity.js';

// ==================================================================================
// Seed Bounties Script (Idempotent)
//
// Description:
// This script populates the `app_bounties` canister with standard example
// bounties. It is idempotent, meaning it can be run multiple times without
// creating duplicate entries. It checks for existing bounties by title before
// creating new ones.
// ==================================================================================

// --- Data for the bounties to be seeded ---
const seedBounties = [
  {
    title: 'PMP Token Faucet',
    short_description:
      'Get PMP tokens for development of Prometheus MCP servers.',
    reward_amount_usd: 0.0001,
    reward_token: 'USDC',
    status: 'Open',
    details_markdown: `The PMP Token Faucet provides developers with the necessary tokens to build and test their applications on the Prometheus Protocol.

### Key Features
*   Get tokens for testing and development
*   Uses On-Chain Identity for secure access
*   Instant token delivery

Click [here](https://discord.com/channels/YOUR_SERVER_ID/YOUR_CHANNEL_ID) to claim on Discord.`,
  },
  {
    title: 'Implement Metrics Endpoint',
    short_description:
      'Add a Prometheus-compatible /metrics endpoint to the node.',
    reward_amount_usd: 0.05,
    reward_token: 'USDC',
    status: 'Open',
    details_markdown: `This bounty is for implementing a standard \`/metrics\` endpoint on the MCP server node that exposes key performance indicators.

### Acceptance Criteria
1.  Endpoint must be available at \`/metrics\`.
2.  Must be compatible with Prometheus scraping.
3.  Must include at least the following metrics:
    *   \`mcp_active_connections\`
    *   \`mcp_requests_total\` (with method and status labels)
    *   \`mcp_request_duration_seconds\` (histogram)

Submit a pull request to the main repository for review. Claim the bounty in the Discord channel once the PR is merged.

Click [here](https://discord.com/channels/YOUR_SERVER_ID/YOUR_CHANNEL_ID) to claim on Discord.`,
  },
  {
    title: 'Documentation Translation: Japanese',
    short_description:
      'Translate the core protocol documentation into Japanese.',
    reward_amount_usd: 0.02,
    reward_token: 'USDC',
    status: 'In Progress',
    details_markdown: `We are looking for a native Japanese speaker to translate our core technical documentation.

### Scope
*   Protocol Overview
*   Getting Started Guide
*   API Reference

Please coordinate in the Discord channel before starting work to avoid duplication of effort.

Click [here](https://discord.com/channels/YOUR_SERVER_ID/YOUR_CHANNEL_ID) to coordinate and claim.`,
  },
];

// --- Main Seeding Function ---
async function main() {
  $.verbose = false;
  console.log(
    "🚀 Starting to seed bounties into the 'app_bounties' canister...",
  );

  // 1. Load DFX identity for authentication
  console.log('  - Loading DFX identity...');
  const identityName = (await $`dfx identity whoami`).stdout.trim();
  const identity = loadDfxIdentity(identityName);
  console.log(`  - Using identity: "${identityName}"`);

  // 2. Setup authenticated agent and actor
  const canisterId = Principal.fromText(
    (await $`dfx canister id app_bounties`).stdout.trim(),
  );
  const agent = new HttpAgent({ host: 'http://127.0.0.1:4943', identity });
  await agent.fetchRootKey();
  const bountyActor = Actor.createActor<BountyService>(bountyIdl, {
    agent,
    canisterId,
  });

  // 3. Fetch existing bounties to ensure idempotency
  console.log('  - Checking for existing bounties...');
  const existingBounties = await bountyActor.get_all_bounties();
  const existingTitles = new Set(existingBounties.map((b) => b.title));
  console.log(`  - Found ${existingTitles.size} existing bounties.`);

  // 4. Filter out bounties that already exist
  const bountiesToCreate = seedBounties.filter(
    (b) => !existingTitles.has(b.title),
  );

  if (bountiesToCreate.length === 0) {
    console.log('\n✅ All seed bounties already exist. Nothing to do.');
    return;
  }

  // 5. Create the missing bounties
  console.log(`\n  - Creating ${bountiesToCreate.length} new bounties...`);
  const creationPromises = bountiesToCreate.map((bounty) => {
    console.log(`    - Adding: "${bounty.title}"`);
    // Convert the human-readable USD amount to a Nat for the canister (assuming 6 decimals)
    const rewardAmountNat = Math.round(bounty.reward_amount_usd * 1_000_000);

    return bountyActor.create_bounty(
      bounty.title,
      bounty.short_description,
      rewardAmountNat,
      bounty.reward_token,
      bounty.status,
      bounty.details_markdown,
    );
  });

  await Promise.all(creationPromises);

  console.log('\n✅ Seeding complete. All example bounties are now on-chain.');
}

main().catch((err) => {
  console.error('❌ An error occurred during seeding:', err);
  process.exit(1);
});
