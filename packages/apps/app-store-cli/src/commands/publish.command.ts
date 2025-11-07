import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  createCanisterType,
  submitVerificationRequest,
  updateWasm,
  uploadWasmChunk,
  VersionTuple,
  serializeToIcrc16Map,
} from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

const CHUNK_SIZE = 1024 * 1024; // 1MiB

// The manifest now contains all necessary information for the unified command.
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

export function registerPublishCommand(program: Command) {
  program
    .command('publish <version>')
    .description(
      'Submits a WASM for verification and publishes it to the registry.',
    )
    .action(async (version: string) => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `app-store init` first.',
        );
        return;
      }

      console.log(
        `\n🚀 Publishing version ${version} from manifest to the App Store...`,
      );

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        // --- 1. VALIDATE MANIFEST ---
        if (
          !manifest.namespace ||
          !manifest.submission?.repo_url ||
          !manifest.submission?.wasm_path ||
          !manifest.submission?.git_commit ||
          !manifest.submission?.name ||
          !manifest.submission?.description
        ) {
          console.error(
            '❌ Error: Manifest is incomplete. Please ensure `namespace`, `repo_url`, `wasm_path`, `git_commit`, `name`, and `description` are all set.',
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

        // Warn if WASM path doesn't look like it came from reproducible build
        if (
          !wasmPath.includes('/out/out_Linux_x86_64.wasm') &&
          !wasmPath.includes('\\out\\out_Linux_x86_64.wasm')
        ) {
          console.warn(
            '\n⚠️  WARNING: Your WASM path does not match the reproducible build output.',
          );
          console.warn(
            '   Expected path: ./out/out_Linux_x86_64.wasm (from docker-compose build)',
          );
          console.warn(`   Your path: ${manifest.submission.wasm_path}`);
          console.warn(
            '\n   If you did not build using "docker-compose run --rm wasm",',
          );
          console.warn(
            '   verification WILL FAIL because the hash will not match!',
          );
          console.warn(
            '\n   See: https://github.com/prometheus-protocol/prometheus-protocol/tree/main/libs/icrc118#usage-by-verifier\n',
          );
        }

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

        // --- 2. PREPARE ALL DATA LOCALLY ---
        console.log('\n   [1/5] 🔬 Analyzing local files and metadata...');
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
        console.log(`   Computed WASM Hash: ${totalWasmHash.toString('hex')}`);

        const currentIdentityName = getCurrentIdentityName();
        console.log(
          `   🔑 Using current dfx identity: '${currentIdentityName}'`,
        );
        const identity = loadDfxIdentity(currentIdentityName);

        // --- 3. ENSURE CANISTER TYPE EXISTS (Idempotent) ---
        console.log(
          '\n   [2/5] 🔗 Ensuring app namespace is registered on-chain...',
        );
        const status = await createCanisterType(identity, {
          namespace: manifest.namespace,
          name: manifest.submission.name,
          description: manifest.submission.description,
          repo_url: manifest.submission.repo_url,
        });
        console.log(
          status === 'created'
            ? '   ✅ Success! App namespace registered for the first time.'
            : '   ℹ️  App namespace already exists. Proceeding...',
        );

        // --- 4. SUBMIT VERIFICATION REQUEST (Idempotent) ---
        console.log('\n   [3/5] 📝 Submitting verification request...');
        const commitHash = Buffer.from(
          manifest.submission.git_commit.trim(),
          'hex',
        );
        const metadataPayload: Record<string, any> = { ...manifest.submission };
        delete metadataPayload.repo_url;
        delete metadataPayload.wasm_path;
        delete metadataPayload.git_commit;

        await submitVerificationRequest(identity, {
          wasm_hash: totalWasmHash,
          repo: manifest.submission.repo_url,
          commit_hash: new Uint8Array(commitHash),
          metadata: serializeToIcrc16Map(metadataPayload),
        });
        console.log('   ✅ Verification request submitted successfully.');

        // --- 5. PUBLISH WASM (Idempotent) ---
        console.log('\n   [4/5] 📦 Registering WASM version...');
        try {
          await updateWasm(identity, {
            namespace: manifest.namespace,
            version: versionTuple,
            wasm_hash: totalWasmHash,
            chunk_hashes: chunkHashes,
            repo_url: manifest.submission.repo_url,
          });
          console.log('   ✅ Version registration successful.');
        } catch (error: any) {
          if (error.message?.includes('NonDeprecatedWasmFound')) {
            console.log(
              '   ℹ️  WASM version already registered. Proceeding to upload chunks...',
            );
          } else {
            throw error;
          }
        }

        console.log('\n   [5/5] 📤 Uploading WASM chunks...');
        for (let i = 0; i < chunks.length; i++) {
          console.log(`      Uploading chunk ${i + 1} of ${chunks.length}...`);
          await uploadWasmChunk(identity, {
            namespace: manifest.namespace,
            version: versionTuple,
            chunk_bytes: chunks[i],
            chunk_index: BigInt(i),
            chunk_hash: chunkHashes[i],
          });
        }
        console.log('   ✅ All chunks uploaded successfully.');

        // --- FINAL SUCCESS MESSAGE ---
        console.log(
          `\n🎉 Success! Version ${version} for '${manifest.namespace}' has been published.`,
        );
        console.log(
          '   An auditor can now perform the build reproducibility audit.',
        );
        console.log(
          '   Once verified, your canister will be deployed automatically.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
