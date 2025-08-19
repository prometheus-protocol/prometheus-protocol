import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { submitVerificationRequest } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity, serializeToIcrc16Map } from '../utils.js';

// --- 1. Updated interface to match the final YAML structure ---
interface Manifest {
  app: {
    id: string;
  };
  submission: {
    // Core technical fields
    repo_url: string;
    wasm_path: string;
    git_commit: string;
    // Version-locked metadata fields
    name: string;
    description: string;
    [key: string]: any; // Allow other metadata fields
  };
}

export function registerSubmitCommand(program: Command) {
  program
    .command('submit')
    .description(
      'Submits the WASM and its version-locked metadata for verification.',
    )
    .action(async () => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `prom-cli init` first.',
        );
        return;
      }

      console.log('\n🚀 Submitting new verification request from manifest...');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        const submissionData = manifest.submission;
        // --- 2. More robust validation ---
        if (
          !submissionData ||
          !submissionData.repo_url ||
          !submissionData.wasm_path ||
          !submissionData.git_commit ||
          !submissionData.name ||
          !submissionData.description
        ) {
          console.error(
            '❌ Error: Manifest is incomplete. Please ensure `repo_url`, `wasm_path`, `git_commit`, `name`, and `description` are all set in the `submission` section.',
          );
          return;
        }

        const wasmPath = path.resolve(process.cwd(), submissionData.wasm_path);
        if (!fs.existsSync(wasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        const identityName = execSync('dfx identity whoami').toString().trim();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        console.log(`   Reading WASM from: ${wasmPath}`);
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();
        console.log(
          `   Computed WASM Hash: ${Buffer.from(wasmHash).toString('hex')}`,
        );

        const commitHashStr = submissionData.git_commit.trim();
        if (!/^[a-f0-9]{40}$/.test(commitHashStr)) {
          console.error(
            `❌ Error: Invalid git_commit format in manifest: "${commitHashStr}". It must be a 40-character SHA-1 hash.`,
          );
          return;
        }
        const commitHash = Buffer.from(commitHashStr, 'hex');
        console.log(`   Using Git Commit Hash from manifest: ${commitHashStr}`);

        // --- 3. Serialize the metadata for the on-chain call ---
        console.log('   📦 Preparing submission metadata...');

        // 1. Create a copy of the submission data to serve as our metadata payload.
        const metadataPayload: Record<string, any> = { ...submissionData };

        // 2. Remove the keys that are NOT part of the metadata.
        //    These are handled as top-level arguments in the on-chain call.
        delete metadataPayload.repo_url;
        delete metadataPayload.wasm_path;
        delete metadataPayload.git_commit;

        // 3. Serialize the cleaned metadata object using the generic utility.
        const onChainMetadata = serializeToIcrc16Map(metadataPayload);

        console.log('\n   📞 Calling the registry via API...');
        const requestId = await submitVerificationRequest(identity, {
          wasm_hash: wasmHash,
          repo: submissionData.repo_url,
          commit_hash: new Uint8Array(commitHash),
          // --- 4. Pass the serialized metadata ---
          metadata: onChainMetadata,
        });

        console.log('\n🎉 Success!');
        console.log(`   Your verification request has been submitted.`);
        console.log(`   Request ID: ${requestId}`);
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
