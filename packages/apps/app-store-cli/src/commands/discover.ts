import { Command } from 'commander';
import {
  getAppStoreListings,
  getAppDetailsByHash,
} from '@prometheus-protocol/ic-js';
import { Buffer } from 'buffer';

/**
 * A custom replacer function for JSON.stringify to handle special types
 * from the IC like Uint8Array, BigInt, and Principal.
 */
function jsonReplacer(key: string, value: any): any {
  // Convert Uint8Array to a hex string
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex');
  }
  // Convert BigInt to a string
  if (typeof value === 'bigint') {
    return value.toString();
  }
  // Convert Principal objects to their text representation
  if (value && value._isPrincipal) {
    return value.toText();
  }
  return value;
}

export function registerDiscoverCommand(program: Command) {
  const discoverCommand = program
    .command('discover')
    .description(
      'Test app store functionality by fetching and displaying on-chain data.',
    );

  // --- Subcommand: `discover list` ---
  discoverCommand
    .command('list')
    .description('Fetch and display all app store listings.')
    .action(async () => {
      console.log('🔎 Fetching app store listings...');
      try {
        const listings = await getAppStoreListings();

        if (listings.length === 0) {
          console.log('✅ No app store listings found.');
          return;
        }

        console.log('\n--- App Store Listings ---');
        // Use our custom replacer to format the output nicely
        console.log(JSON.stringify(listings, jsonReplacer, 2));
        console.log('--------------------------\n');
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });

  // --- Subcommand: `discover details <wasm_hash>` ---
  discoverCommand
    .command('details <wasm_hash>')
    .description(
      'Fetch and display the full details for a specific app version.',
    )
    .action(async (wasmHashStr: string) => {
      console.log(`🔎 Fetching details for WASM hash: ${wasmHashStr}`);
      try {
        const details = await getAppDetailsByHash(wasmHashStr);

        console.log('\n--- App Details ---');
        console.log(JSON.stringify(details, jsonReplacer, 2));
        console.log('-------------------\n');
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
