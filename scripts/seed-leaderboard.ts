#!/usr/bin/env zx
import { $ } from 'zx';
import { faker } from '@faker-js/faker';
import { Principal } from '@icp-sdk/core/principal';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { idlFactory as trackerIdl } from '../packages/declarations/dist/generated/usage_tracker/index.js';
import type { _SERVICE as TrackerService } from '../packages/declarations/dist/generated/usage_tracker/usage_tracker.did.js';
import { idlFactory as aggregatorIdl } from '../packages/declarations/dist/generated/leaderboard/index.js';
import type { _SERVICE as AggregatorService } from '../packages/declarations/dist/generated/leaderboard/leaderboard.did.js';
import { randomBytes } from 'node:crypto';
import { loadDfxIdentity } from './identity.js';

// --- Configuration ---
const NUM_SERVERS = 10;
const NUM_USERS = 50;
const LOGS_PER_SERVER = 25;

const createRandomPrincipal = (): Principal => {
  const randomBytesArray = randomBytes(29);
  return Principal.fromUint8Array(randomBytesArray);
};

const createRandomWasmHash = (): Uint8Array => {
  return randomBytes(32);
};

// --- Main Seeding Function ---
async function main() {
  $.verbose = false;

  console.log('🚀 Starting leaderboard seeding process...');

  // 1. Load DFX identity
  console.log('  - Loading DFX identity...');
  const identityName = (await $`dfx identity whoami`).stdout.trim();
  const identity = loadDfxIdentity(identityName);
  console.log(`  - Using identity: "${identityName}"`);

  // 2. Fetch Canister IDs
  console.log('  - Fetching canister IDs...');
  const trackerId = Principal.fromText(
    (await $`dfx canister id usage_tracker`).stdout.trim(),
  );
  const aggregatorId = Principal.fromText(
    (await $`dfx canister id leaderboard`).stdout.trim(),
  );

  // 3. Setup Actors
  const agent = new HttpAgent({ host: 'http://127.0.0.1:4943', identity });
  await agent.fetchRootKey();
  const trackerActor = Actor.createActor<TrackerService>(trackerIdl, {
    agent,
    canisterId: trackerId,
  });
  const aggregatorActor = Actor.createActor<AggregatorService>(aggregatorIdl, {
    agent,
    canisterId: aggregatorId,
  });

  // Initialize the aggregator canister (idempotent)
  console.log('  - Initializing leaderboard canister...');
  await aggregatorActor.init(Principal.fromText(trackerId.toText()));

  // --- NEW IDEMPOTENCY CHECK ---
  // 4. Check if the leaderboard already has data. If so, exit gracefully.
  console.log('  - Checking if leaderboard has already been seeded...');
  const existingLeaderboard = await aggregatorActor.get_user_leaderboard();

  if (existingLeaderboard.length > 0) {
    console.log(
      '\n✅ Leaderboard already contains data. Skipping seed process.',
    );
    console.log(
      '   To re-seed with fresh data, run `dfx start --clean` and `dfx deploy` first.',
    );
    return; // Exit the script successfully
  }

  // 5. Generate Mock Principals (only runs if the leaderboard is empty)
  console.log(
    `  - Generating mock data for ${NUM_SERVERS} servers and ${NUM_USERS} users...`,
  );
  const serverWasmHashes = Array.from(
    { length: NUM_SERVERS },
    createRandomWasmHash,
  );
  const userPrincipals = Array.from(
    { length: NUM_USERS },
    createRandomPrincipal,
  );

  // 6. Seed the Usage Tracker
  console.log(
    `  - Seeding Usage Tracker with ${NUM_SERVERS * LOGS_PER_SERVER} logs...`,
  );
  const seedPromises = [];
  for (const serverWasmHash of serverWasmHashes) {
    const stats = {
      start_timestamp_ns: BigInt(faker.date.past().getTime()) * 1_000_000n,
      end_timestamp_ns: BigInt(new Date().getTime()) * 1_000_000n,
      activity: Array.from({ length: LOGS_PER_SERVER }, () => ({
        caller: faker.helpers.arrayElement(userPrincipals),
        tool_id: faker.helpers.arrayElement([
          'get_data',
          'process_image',
          'execute_swap',
        ]),
        call_count: BigInt(faker.number.int({ min: 1, max: 1000 })),
      })),
    };
    seedPromises.push(
      trackerActor.seed_log(
        createRandomPrincipal(),
        Buffer.from(serverWasmHash).toString('hex'),
        stats,
      ),
    );
  }
  await Promise.all(seedPromises);

  // 7. Trigger the Leaderboard Aggregator
  console.log('  - Triggering leaderboard aggregation...');
  const result = await aggregatorActor.trigger_manual_update();
  if ('err' in result) {
    console.error('❌ Aggregation failed:', result.err);
    return;
  }

  console.log('\n✅ Seeding complete!');
  console.log('Your local leaderboard is now populated with fresh data.');
}

main().catch((err) => {
  console.error('❌ An error occurred during seeding:', err);
  process.exit(1);
});
