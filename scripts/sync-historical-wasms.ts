#!/usr/bin/env tsx

/**
 * Script to sync all historical WASM IDs from the MCP Registry to the Usage Tracker.
 * This ensures Genesis Users counts are preserved across all app versions.
 *
 * Usage:
 *   pnpm tsx scripts/sync-historical-wasms.ts --network ic
 */

import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { loadDfxIdentity } from '../packages/apps/app-store-cli/src/identity.node.js';
import { idlFactory as registryIdl } from '../packages/declarations/src/generated/mcp_registry/mcp_registry.did.js';
import { idlFactory as trackerIdl } from '../packages/declarations/src/generated/usage_tracker/usage_tracker.did.js';
import type { _SERVICE as RegistryService } from '../packages/declarations/src/generated/mcp_registry/mcp_registry.did.d.ts';
import type { _SERVICE as TrackerService } from '../packages/declarations/src/generated/usage_tracker/usage_tracker.did.d.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function getCanisterId(
  canisterName: string,
  network: string,
): Promise<string> {
  try {
    const canisterIdsPath = resolve(__dirname, '..', 'canister_ids.json');
    const canisterIds = JSON.parse(readFileSync(canisterIdsPath, 'utf-8'));
    return canisterIds[canisterName]?.[network] || '';
  } catch {
    return '';
  }
}

async function main() {
  const network = process.argv.includes('--network')
    ? process.argv[process.argv.indexOf('--network') + 1]
    : 'local';

  const isMainnet = network === 'ic' || network === 'mainnet';

  const host = isMainnet ? 'https://ic0.app' : 'http://localhost:4943';

  console.log(`\n🔗 Connecting to ${network} network...`);

  // Load identity from dfx identity
  const identityName = 'pp_owner';
  let identity;

  try {
    identity = loadDfxIdentity(identityName);
    console.log(`🔑 Using identity: ${identityName}\n`);
  } catch (error) {
    console.error(`❌ Could not load identity '${identityName}'`);
    console.error('   Make sure the identity exists with: dfx identity list');
    console.error(`   Error: ${error}`);
    process.exit(1);
  }

  const agent = await HttpAgent.create({ host, identity });

  // Only fetch root key for local development
  if (!isMainnet) {
    await agent.fetchRootKey();
  }

  // Get canister IDs (you might want to read these from canister_ids.json)
  const registryCanisterId =
    (await getCanisterId('mcp_registry', network)) ||
    process.env.CANISTER_ID_MCP_REGISTRY;
  const trackerCanisterId =
    (await getCanisterId('usage_tracker', network)) ||
    process.env.CANISTER_ID_USAGE_TRACKER;

  if (!registryCanisterId || !trackerCanisterId) {
    console.error(
      '❌ Could not find canister IDs. Make sure canister_ids.json exists or set environment variables.',
    );
    process.exit(1);
  }

  console.log(`📦 Registry: ${registryCanisterId}`);
  console.log(`📊 Tracker:  ${trackerCanisterId}\n`);

  const registryActor = Actor.createActor<RegistryService>(registryIdl, {
    agent,
    canisterId: registryCanisterId,
  });

  const trackerActor = Actor.createActor<TrackerService>(trackerIdl, {
    agent,
    canisterId: trackerCanisterId,
  });

  // Step 1: Get all canister types (apps) from the registry
  console.log('📋 Fetching all apps from MCP Registry...');

  let allApps: any[] = [];
  let prev: any = null;
  let pageCount = 0;

  while (true) {
    pageCount++;
    const response = await registryActor.icrc118_get_canister_types({
      filter: [],
      prev: prev ? [prev] : [],
      take: [50n], // Fetch 50 at a time
    });

    if (response.length === 0) break;

    console.log(`  Page ${pageCount}: ${response.length} apps`);
    allApps.push(...response);

    // Get the last item for pagination
    if (response.length < 50) break;
    prev = response[response.length - 1].canister_type_namespace;
  }

  console.log(`\n✅ Found ${allApps.length} total apps\n`);

  // Step 2: Get all historical WASMs from the tracker
  console.log('🔍 Fetching all historical WASMs from Usage Tracker...');
  const allWasms = await trackerActor.list_all_wasm_ids();
  console.log(`  Found ${allWasms.length} WASMs with usage data\n`);

  // Create a map of WASM ID to its stats for easier lookup
  const wasmStats = new Map<string, { invocations: bigint; users: bigint }>(
    allWasms.map(([wasmId, invocations, users]: [string, bigint, bigint]) => [
      wasmId,
      { invocations, users },
    ]),
  );

  // Step 3: For each app, get its registered WASMs and check for missing ones
  let totalRegistered = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const app of allApps) {
    const namespace = app.canister_type_namespace;
    console.log(`\n📱 Processing: ${namespace}`);

    // Get all versions of this app
    const versions = app.versions || [];
    console.log(`  ${versions.length} versions found`);

    if (versions.length === 0) {
      console.log(`  ⏭️  No versions, skipping`);
      continue;
    }

    // Get currently registered WASMs for this namespace
    const registeredWasms = await trackerActor.get_namespace_wasms(namespace);
    console.log(`  ${registeredWasms.length} WASMs already registered`);

    // Check each version's WASM
    for (const version of versions) {
      // Convert calculated_hash (bytes) to hex string
      const hashBytes = version.calculated_hash;
      if (!hashBytes || hashBytes.length === 0) {
        console.log(`  ⊘ Version missing calculated_hash, skipping`);
        totalSkipped++;
        continue;
      }

      const wasmId = Array.from(hashBytes as Uint8Array)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (!wasmId) {
        console.log(`  ⊘ Version has empty hash, skipping`);
        totalSkipped++;
        continue;
      }

      // Skip if already registered
      if (registeredWasms.includes(wasmId)) {
        console.log(`  ✓ ${wasmId.substring(0, 12)}... already registered`);
        totalSkipped++;
        continue;
      }

      // Check if this WASM has usage data
      const stats = wasmStats.get(wasmId);
      if (!stats) {
        console.log(
          `  ⊘ ${wasmId.substring(0, 12)}... no usage data, skipping`,
        );
        totalSkipped++;
        continue;
      }

      // Register this historical WASM
      try {
        console.log(
          `  ⚙️  Registering ${wasmId.substring(0, 12)}... (${stats.users} users, ${stats.invocations} calls)`,
        );
        const result = await trackerActor.register_historical_wasm(
          namespace,
          wasmId,
        );

        if ('ok' in result) {
          console.log(`  ✅ ${result.ok}`);
          totalRegistered++;
        } else {
          console.log(`  ❌ Error: ${result.err}`);
          totalErrors++;
        }
      } catch (error) {
        console.log(`  ❌ Failed to register: ${error}`);
        totalErrors++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Registered: ${totalRegistered} historical WASMs`);
  console.log(
    `⏭️  Skipped:    ${totalSkipped} (already registered or no data)`,
  );
  console.log(`❌ Errors:     ${totalErrors}`);
  console.log('='.repeat(60) + '\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
