import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  getCanisterWasmHash,
  getVerificationStatus,
  getVersions,
} from '@prometheus-protocol/ic-js';
import { Principal } from '@dfinity/principal';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

// 1. Update the interface to use the standardized 'namespace' key.
interface Manifest {
  namespace: string;
  submission: {
    wasm_path: string;
    canister_id?: string; // canister_id is optional for the core status check
  };
}

export function registerStatusCommand(program: Command) {
  program
    // 2. Use an optional positional argument for the wasm_hash.
    .command('status [wasm_hash]')
    .description(
      'Checks verification status. Reads WASM hash from prometheus.yml if not provided.',
    )
    // 3. The action now receives the optional wasm_hash.
    .action(async (wasm_hash) => {
      let targetWasmId = wasm_hash;
      let manifest: Manifest | undefined;

      // 4. If wasm_hash is missing, fall back to reading the local project files.
      if (!targetWasmId) {
        console.log(
          'ℹ️ WASM hash not provided, attempting to read from prometheus.yml...',
        );
        const configPath = path.join(process.cwd(), 'prometheus.yml');
        if (!fs.existsSync(configPath)) {
          console.error(
            '❌ Error: WASM hash not provided and prometheus.yml not found.',
          );
          console.error(
            '   Run this command from your project root or specify a WASM hash manually.',
          );
          return;
        }

        manifest = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Manifest;
        if (!manifest.submission?.wasm_path) {
          console.error('❌ Error: `wasm_path` is missing in prometheus.yml.');
          return;
        }

        const wasmPath = path.resolve(
          process.cwd(),
          manifest.submission.wasm_path,
        );
        if (!fs.existsSync(wasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        const wasmBuffer = fs.readFileSync(wasmPath);
        targetWasmId = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest('hex');
      }

      console.log(
        `\n🔎 Checking verification status for WASM Hash: ${targetWasmId}`,
      );

      try {
        const identity = loadDfxIdentity(getCurrentIdentityName());
        const status = await getVerificationStatus(targetWasmId);

        if (!status) {
          console.log('\n--- Verification Status: ❓ Not Found ---');
          console.log(
            '   (This WASM hash has not been submitted for verification yet.)',
          );
          return;
        }

        // --- Verification Status Display ---
        console.log('\n--- Verification Status ---');
        console.log(
          `   Verified by DAO: ${status.isVerified ? '✅ Yes' : '❌ No'}`,
        );

        if (status.verificationRequest) {
          console.log(`   Repo URL:        ${status.verificationRequest.repo}`);
          console.log(
            `   Commit Hash:     ${status.verificationRequest.commit_hash}`,
          );
        }

        // ... (The detailed bounty and attestation display logic remains the same and is excellent)
        console.log(
          `\n   Found ${status.bounties.length} tokenized bounty(s):`,
        );
        if (status.bounties.length > 0) {
          status.bounties.forEach((bounty, i) => {
            const bountyStatus = bounty.claimedTimestamp
              ? '✅ Claimed'
              : '🟢 Open';
            console.log(
              `     💰 [${i + 1}] ${bounty.tokenAmount.toLocaleString()} tokens (${bountyStatus})`,
            );
          });
        } else {
          console.log('     (None posted for this WASM hash.)');
        }
        console.log(`\n   Found ${status.attestations.length} attestation(s):`);
        if (status.attestations.length > 0) {
          status.attestations.forEach((att, i) => {
            console.log(`     🛡️ [${i + 1}] Auditor: ${att.auditor.toText()}`);
          });
        } else {
          console.log(
            '     (None yet. The audit process may still be in progress.)',
          );
        }
        console.log('---------------------------\n');

        // 5. The "Live Status" check is now a bonus feature that only runs
        //    when the command is used in the context of a project file.
        if (manifest?.namespace && manifest.submission?.canister_id) {
          console.log('--- Live Canister Status ---');
          const {
            namespace,
            submission: { canister_id },
          } = manifest;
          console.log(`   Checking official canister: ${canister_id}`);

          const [publishedVersions, liveHash] = await Promise.all([
            getVersions(identity, namespace),
            getCanisterWasmHash(Principal.fromText(canister_id)),
          ]);

          if (!liveHash) {
            console.log(
              '   ❌ Status: Could not retrieve WASM hash from this canister.',
            );
          } else {
            const liveHashHex = Buffer.from(liveHash).toString('hex');
            console.log(`      Live Hash: ${liveHashHex}`);
            const matchingVersion = publishedVersions.find(
              (v) => v.wasm_hash === liveHashHex,
            );
            if (matchingVersion) {
              console.log(
                `      ✅ Status: Verified. Matches published version ${matchingVersion.version}.`,
              );
            } else {
              console.log(
                '      ❌ Status: Unverified. The running WASM does not match any published version.',
              );
            }
          }
          console.log('---------------------------\n');
        }
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
