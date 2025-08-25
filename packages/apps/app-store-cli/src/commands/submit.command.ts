import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  createCanisterType, // 1. Import the new function needed for this command.
  serializeToIcrc16Map,
  submitVerificationRequest,
} from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

// 2. Update the interface to use the standardized 'namespace' key.
interface Manifest {
  namespace: string;
  submission: {
    repo_url: string;
    wasm_path: string;
    git_commit: string;
    name: string;
    description: string;
    [key: string]: any;
  };
}

export function registerSubmitCommand(program: Command) {
  program
    .command('submit')
    .description(
      'Registers the app type and submits the WASM package for verification.',
    )
    .action(async () => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `app-store init` first.',
        );
        return;
      }

      console.log('\n🚀 Submitting new verification request from manifest...');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        // 3. Update validation to use the standardized 'namespace' key.
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

        const currentIdentityName = getCurrentIdentityName();
        console.log(
          `   🔑 Using current dfx identity: '${currentIdentityName}'`,
        );
        const identity = loadDfxIdentity(currentIdentityName);

        // --- PHASE 1: REGISTER CANISTER TYPE (IDEMPOTENT) ---
        // 4. This is the logic moved from the 'init' command.
        console.log(
          '\n   [1/3] 🔗 Ensuring canister type is registered on-chain...',
        );
        const status = await createCanisterType(identity, {
          namespace: manifest.namespace,
          name: manifest.submission.name,
          description: manifest.submission.description,
          repo_url: manifest.submission.repo_url,
        });

        if (status === 'created') {
          console.log(
            '   ✅ Success! Canister type registered for the first time.',
          );
        } else {
          console.log('   ℹ️  Canister type already exists. Proceeding...');
        }

        // --- PHASE 2: PREPARE SUBMISSION DATA ---
        console.log('\n   [2/3] 🔬 Analyzing local WASM file and metadata...');
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();
        console.log(
          `   Computed WASM Hash: ${Buffer.from(wasmHash).toString('hex')}`,
        );

        const commitHashStr = manifest.submission.git_commit.trim();
        const commitHash = Buffer.from(commitHashStr, 'hex');

        const metadataPayload: Record<string, any> = { ...manifest.submission };
        delete metadataPayload.repo_url;
        delete metadataPayload.wasm_path;
        delete metadataPayload.git_commit;
        const onChainMetadata = serializeToIcrc16Map(metadataPayload);

        // --- PHASE 3: SUBMIT VERIFICATION REQUEST ---
        console.log('\n   [3/3] 📞 Submitting verification request...');
        const requestId = await submitVerificationRequest(identity, {
          wasm_hash: wasmHash,
          repo: manifest.submission.repo_url,
          commit_hash: new Uint8Array(commitHash),
          metadata: onChainMetadata,
        });

        console.log('\n🎉 Success!');
        console.log(
          `   Your verification request has been submitted (Request ID: ${requestId}).`,
        );
        // 6. Update the help text to point to the correct command.
        console.log(
          '   You can check its progress by running: app-store status',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
