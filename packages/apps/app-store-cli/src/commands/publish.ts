import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
  updateWasm,
  uploadWasmChunk,
  VersionTuple,
} from '@prometheus-protocol/ic-js';

// The IC has a 2MB message limit. We chunk at 1.9MB to be safe.
const CHUNK_SIZE = 1.9 * 1024 * 1024;

interface Manifest {
  app: {
    id: string;
  };
  submission: {
    repo_url: string;
    wasm_path: string;
  };
}

export function registerPublishCommand(program: Command) {
  program
    .command('publish')
    .description('Publishes and uploads a new WASM version to the registry.')
    .requiredOption(
      '--app-version <version>',
      'The semantic version to publish (e.g., "1.0.0")',
    )
    .action(async (options) => {
      const { appVersion } = options;
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run this command in a project directory.',
        );
        return;
      }

      console.log(`\n📦 Publishing version ${appVersion} from manifest...`);

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        if (!manifest.app?.id) {
          console.error(
            '❌ Error: Manifest is incomplete. `app.id` (namespace) is missing.',
          );
          return;
        }
        if (!manifest.submission?.repo_url || !manifest.submission?.wasm_path) {
          console.error(
            '❌ Error: Manifest is incomplete. `submission.repo_url` or `submission.wasm_path` is missing.',
          );
          return;
        }

        const namespace = manifest.app.id;
        const wasmPath = path.resolve(
          process.cwd(),
          manifest.submission.wasm_path,
        );

        if (!fs.existsSync(wasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        // --- 1. PREPARE ALL DATA BEFORE ANY API CALLS ---
        console.log('   🔬 Analyzing WASM and preparing for upload...');
        const wasmBuffer = fs.readFileSync(wasmPath);

        // Calculate the hash of the entire WASM
        const totalWasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();

        // Split the WASM into chunks and calculate the hash of each chunk
        const chunks: Buffer[] = [];
        const chunkHashes: Buffer[] = [];
        for (let i = 0; i < wasmBuffer.length; i += CHUNK_SIZE) {
          const chunk = wasmBuffer.slice(i, i + CHUNK_SIZE);
          chunks.push(chunk);
          chunkHashes.push(crypto.createHash('sha256').update(chunk).digest());
        }
        console.log(`   Computed Total Hash: ${totalWasmHash.toString('hex')}`);
        console.log(`   WASM will be split into ${chunks.length} chunk(s).`);

        // Parse the version string into the required (Nat, Nat, Nat) tuple format
        const versionParts = appVersion.split('.').map(BigInt);
        if (versionParts.length !== 3) {
          throw new Error(
            'Version must be in format major.minor.patch (e.g., 1.0.0)',
          );
        }
        const versionTuple: VersionTuple = [
          versionParts[0],
          versionParts[1],
          versionParts[2],
        ];

        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        // --- 2. PHASE 1: REGISTER THE WASM ---
        try {
          console.log(
            '\n   📞 Registering new WASM version with the canister...',
          );
          await updateWasm(identity, {
            namespace: namespace,
            version: versionTuple,
            wasm_hash: totalWasmHash,
            chunk_hashes: chunkHashes,
            repo_url: manifest.submission.repo_url,
          });
          console.log('   ✅ Registration successful.');
        } catch (error: any) {
          // Check if the error is the specific "already exists" error.
          if (error.message?.includes('NonDeprecatedWasmFound')) {
            console.log(
              '   ℹ️  WASM version already registered. Proceeding to upload chunks...',
            );
          } else {
            // If it's any other error, re-throw it to fail the command.
            throw error;
          }
        }
        console.log('   ✅ Registration successful.');

        // --- 3. PHASE 2: UPLOAD CHUNKS ---
        console.log('\n   📤 Uploading WASM chunks...');
        for (let i = 0; i < chunks.length; i++) {
          console.log(`      Uploading chunk ${i + 1} of ${chunks.length}...`);
          await uploadWasmChunk(identity, {
            namespace: namespace,
            version: versionTuple,
            chunk_bytes: chunks[i],
            chunk_index: BigInt(i),
            chunk_hash: chunkHashes[i], // Pass the specific hash for this chunk
          });
        }
        console.log('   ✅ All chunks uploaded successfully.');

        console.log(
          `\n🎉 Success! Version ${appVersion} for namespace ${namespace} has been published and validated.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
