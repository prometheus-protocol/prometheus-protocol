import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  updateWasm,
  uploadWasmChunk,
  VersionTuple,
} from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

const CHUNK_SIZE = 1.9 * 1024 * 1024;

interface Manifest {
  // 1. Standardize on 'namespace' for consistency with all other commands.
  namespace: string;
  submission: {
    repo_url: string;
    wasm_path: string;
  };
}

export function registerPublishCommand(program: Command) {
  program
    // 2. Use a required positional argument for the version.
    .command('publish <version>')
    .description('Publishes and uploads a new WASM version to the registry.')
    // 3. The action now receives the version string directly.
    .action(async (version) => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run this command in a project directory.',
        );
        return;
      }

      console.log(`\n📦 Publishing version ${version} from manifest...`);

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        // 4. Update validation to use the standardized 'namespace' key.
        if (!manifest.namespace) {
          console.error(
            '❌ Error: Manifest is incomplete. `namespace` is missing.',
          );
          return;
        }
        if (!manifest.submission?.repo_url || !manifest.submission?.wasm_path) {
          console.error(
            '❌ Error: Manifest is incomplete. `submission.repo_url` or `submission.wasm_path` is missing.',
          );
          return;
        }

        const namespace = manifest.namespace;
        const wasmPath = path.resolve(
          process.cwd(),
          manifest.submission.wasm_path,
        );

        if (!fs.existsSync(wasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        // --- PREPARE ALL DATA BEFORE ANY API CALLS ---
        console.log('   🔬 Analyzing WASM and preparing for upload...');
        const wasmBuffer = fs.readFileSync(wasmPath);
        const totalWasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();

        const chunks: Buffer[] = [];
        const chunkHashes: Buffer[] = [];
        for (let i = 0; i < wasmBuffer.length; i += CHUNK_SIZE) {
          const chunk = wasmBuffer.slice(i, i + CHUNK_SIZE);
          chunks.push(chunk);
          chunkHashes.push(crypto.createHash('sha256').update(chunk).digest());
        }
        console.log(`   Computed Total Hash: ${totalWasmHash.toString('hex')}`);
        console.log(`   WASM will be split into ${chunks.length} chunk(s).`);

        const versionParts = version.split('.').map(BigInt);
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

        // --- PHASE 1: REGISTER THE WASM ---
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
          if (error.message?.includes('NonDeprecatedWasmFound')) {
            console.log(
              '   ℹ️  WASM version already registered. Proceeding to upload chunks...',
            );
          } else {
            throw error;
          }
        }

        // --- PHASE 2: UPLOAD CHUNKS ---
        console.log('\n   📤 Uploading WASM chunks...');
        for (let i = 0; i < chunks.length; i++) {
          console.log(`      Uploading chunk ${i + 1} of ${chunks.length}...`);
          await uploadWasmChunk(identity, {
            namespace: namespace,
            version: versionTuple,
            chunk_bytes: chunks[i],
            chunk_index: BigInt(i),
            chunk_hash: chunkHashes[i],
          });
        }
        console.log('   ✅ All chunks uploaded successfully.');

        console.log(
          `\n🎉 Success! Version ${version} for namespace ${namespace} has been published.`,
        );
        // 5. Add a helpful next step for the user.
        console.log(
          `   You can verify by running: app-store version list ${namespace}`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
