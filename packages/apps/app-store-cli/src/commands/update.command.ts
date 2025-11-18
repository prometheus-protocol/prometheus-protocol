import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  submitVerificationRequest,
  serializeToIcrc16Map,
} from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

const CHUNK_SIZE = 1024 * 1024; // 1MiB

// The manifest contains all necessary information
interface Manifest {
  namespace: string;
  submission: {
    repo_url: string;
    wasm_path: string;
    git_commit: string;
    name: string;
    description: string;
    [key: string]: any; // Allow other metadata
  };
}

/**
 * Registers the 'update' command.
 *
 * This command allows developers to update their app's metadata on the app store
 * by resubmitting a verification request with updated information. Since verification
 * requests are idempotent (they overwrite the previous request for the same WASM hash),
 * this is a safe operation with no side effects beyond updating the displayed metadata.
 *
 * The app store displays information based on the verification request metadata, so
 * updating the request will immediately reflect in the app store listing.
 */
export function registerUpdateCommand(program: Command) {
  program
    .command('update')
    .description(
      'Updates the app store metadata for an existing published version (idempotent).',
    )
    .option(
      '--wasm <path>',
      'Path to the WASM file (defaults to prometheus.yml wasm_path)',
    )
    .option(
      '--commit <hash>',
      'Git commit hash (defaults to prometheus.yml git_commit)',
    )
    .action(async (options) => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `app-store init` first.',
        );
        return;
      }

      console.log('\n🔄 Updating app store metadata...\n');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        // Validate required fields
        if (!manifest.namespace) {
          console.error('❌ Error: Missing "namespace" in prometheus.yml.');
          return;
        }

        if (!manifest.submission) {
          console.error('❌ Error: Missing "submission" in prometheus.yml.');
          return;
        }

        // Use options or fall back to manifest values
        const wasmPath = options.wasm || manifest.submission.wasm_path;
        const gitCommit = options.commit || manifest.submission.git_commit;

        if (!wasmPath) {
          console.error(
            '❌ Error: WASM path not specified. Set wasm_path in prometheus.yml or use --wasm flag.',
          );
          return;
        }

        if (!gitCommit) {
          console.error(
            '❌ Error: Git commit not specified. Set git_commit in prometheus.yml or use --commit flag.',
          );
          return;
        }

        // --- 1. VALIDATE WASM FILE ---
        console.log('   [1/3] 🔍 Validating WASM file...');
        const fullWasmPath = path.resolve(wasmPath);
        if (!fs.existsSync(fullWasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        const wasmContent = fs.readFileSync(fullWasmPath);
        const totalWasmHash = crypto
          .createHash('sha256')
          .update(wasmContent)
          .digest();

        console.log(
          `   ✅ WASM hash: ${totalWasmHash.toString('hex').substring(0, 16)}...`,
        );

        // --- 2. LOAD IDENTITY ---
        console.log('\n   [2/3] 🔐 Loading identity...');
        const currentIdentityName = await getCurrentIdentityName();
        console.log(`   Using identity: ${currentIdentityName}`);
        const identity = loadDfxIdentity(currentIdentityName);

        // --- 3. SUBMIT UPDATED VERIFICATION REQUEST ---
        console.log('\n   [3/3] 📝 Updating app store metadata...');
        const commitHash = Buffer.from(gitCommit.trim(), 'hex');

        // Prepare metadata payload (exclude fields that shouldn't be in metadata)
        const metadataPayload: Record<string, any> = {
          ...manifest.submission,
        };
        delete metadataPayload.repo_url;
        delete metadataPayload.wasm_path;
        delete metadataPayload.git_commit;

        await submitVerificationRequest(identity, {
          wasm_hash: totalWasmHash,
          repo: manifest.submission.repo_url,
          commit_hash: new Uint8Array(commitHash),
          metadata: serializeToIcrc16Map(metadataPayload),
        });

        console.log('   ✅ App store metadata updated successfully!\n');
        console.log('📋 Updated Information:');
        console.log(`   • Namespace: ${manifest.namespace}`);
        console.log(`   • Name: ${manifest.submission.name}`);
        console.log(`   • Description: ${manifest.submission.description}`);
        console.log(`   • Publisher: ${manifest.submission.publisher}`);
        console.log(`   • Category: ${manifest.submission.category}`);
        console.log(
          `   • WASM Hash: ${totalWasmHash.toString('hex').substring(0, 16)}...`,
        );

        console.log(
          '\n💡 Note: This operation is idempotent - you can run it multiple times safely.',
        );
        console.log(
          '   The app store will display the updated information immediately.',
        );
        console.log(
          '   This does NOT affect existing verifications or attestations.',
        );
      } catch (error: any) {
        console.error(`\n❌ Update failed: ${error.message || error}`);
        if (error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}
