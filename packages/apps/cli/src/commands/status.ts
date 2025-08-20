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
import { loadDfxIdentity } from '../utils.js';
import { execSync } from 'node:child_process';
import { Principal } from '@dfinity/principal';

interface Manifest {
  app: {
    id: string;
  };
  submission: {
    wasm_path: string;
    canister_id: string;
  };
}

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description(
      'Checks the verification status of the WASM defined in prometheus.yml.',
    )
    .action(async () => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `prom-cli init` first.',
        );
        return;
      }

      console.log('\n🔎 Checking verification status from manifest...');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        if (!manifest.submission || !manifest.submission.wasm_path) {
          console.error(
            '❌ Error: Manifest is incomplete. Please ensure `wasm_path` is set in the `submission` section of prometheus.yml.',
          );
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
        const wasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();

        const wasmId = Buffer.from(wasmHash).toString('hex');
        console.log(`   Computed WASM Hash: ${wasmId}`);

        const identityName = execSync('dfx identity whoami').toString().trim();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);
        const status = await getVerificationStatus(wasmId);

        if (!status) {
          console.log('\n--- Verification Status ---');
          console.log('   Status: ❓ Not Found');
          console.log(
            '   (This WASM hash has not been submitted for verification yet.)',
          );
          console.log('---------------------------\n');
          return;
        }

        // --- Verification Status Display (Updated) ---
        console.log('\n--- Verification Status ---');
        console.log(
          `   Verified by DAO: ${status.isVerified ? '✅ Yes' : '❌ No'}`,
        );

        // --- Tokenized Bounties Display (Fully Refactored) ---
        console.log(
          `\n   Found ${status.bounties.length} tokenized bounty(s):`,
        );
        if (status.bounties.length > 0) {
          // The type `ProcessedBounty` is now inferred correctly.
          status.bounties.forEach((bounty, i) => {
            // Logic is now simple property access, no more parsing!
            const auditType = bounty.metadata?.audit_type || 'Unknown';
            const bountyStatus = bounty.claimedTimestamp
              ? '✅ Claimed'
              : '🟢 Open';

            console.log(`     💰 [${i + 1}] Bounty ID: ${bounty.id}`);
            console.log(
              `         Reward: ${bounty.tokenAmount.toLocaleString()} tokens`,
            );
            console.log(
              `         Token Canister: ${bounty.tokenCanisterId.toText()}`,
            );
            console.log(`         For Audit Type: ${auditType}`);
            console.log(`         Status: ${bountyStatus}`);
            console.log(`         Claims Submitted: ${bounty.claims.length}`);
          });
        } else {
          console.log('     (None posted for this WASM hash.)');
        }

        // --- Attestations Display (Refactored for clarity) ---
        console.log(`\n   Found ${status.attestations.length} attestation(s):`);
        if (status.attestations.length > 0) {
          // The type `ProcessedAttestation` is now inferred correctly.
          status.attestations.forEach((att, i) => {
            console.log(`     🛡️ [${i + 1}] Auditor: ${att.auditor.toText()}`);
            console.log(`         Type: ${att.audit_type}`);
          });
        } else {
          console.log(
            '     (None yet. The audit process may still be in progress.)',
          );
        }
        console.log('---------------------------\n');

        // --- NEW "LIVE STATUS" SECTION ---
        console.log('\n--- Live Canister Status ---');
        const namespace = manifest.app.id;
        const officialCanisterId = manifest.submission.canister_id;

        if (!officialCanisterId) {
          console.log(
            '   (No `canister_id` specified in prometheus.yml to check.)',
          );
        } else {
          console.log(`   Checking official canister: ${officialCanisterId}`);

          const [publishedVersions, liveHash] = await Promise.all([
            getVersions(identity, namespace),
            getCanisterWasmHash(Principal.fromText(officialCanisterId)),
          ]);

          if (!liveHash) {
            console.log(
              '   ❌ Status: Could not retrieve WASM hash from this canister.',
            );
          } else {
            // 1. Convert the live hash (which is a Uint8Array) into a Node.js Buffer.
            const liveHashBuffer = Buffer.from(liveHash);
            console.log(`      Live Hash: ${liveHashBuffer.toString('hex')}`);

            // 2. In the find loop, convert each published hash to a Buffer and use the
            //    robust `Buffer.equals()` method for a direct byte-by-byte comparison.
            const matchingVersion = publishedVersions.find((v) => {
              const publishedHashBuffer = Buffer.from(v.wasm_hash, 'hex');
              return liveHashBuffer.equals(publishedHashBuffer);
            });
            if (matchingVersion) {
              const versionStr = matchingVersion.version;
              console.log(
                `      ✅ Status: Verified. Matches published version ${versionStr}.`,
              );
            } else {
              console.log(
                '      ❌ Status: Unverified. The running WASM does not match any published version for this namespace.',
              );
            }
          }
        }
        console.log('---------------------------\n');
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
