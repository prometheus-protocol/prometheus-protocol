import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { submitVerificationRequest } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

interface Manifest {
  repo_url: string;
  wasm_path: string;
}

export function registerSubmitCommand(program: Command) {
  program
    .command('submit')
    .description('Submits the WASM defined in prometheus.yml for verification.')
    .action(async () => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `@prometheus-protocol/cli init` first.',
        );
        return;
      }

      console.log('\n🚀 Submitting new verification request from manifest...');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        if (
          !manifest.repo_url ||
          !manifest.wasm_path ||
          manifest.repo_url.includes('@prometheus-protocol')
        ) {
          console.error(
            '❌ Error: Manifest is incomplete. Please ensure `repo_url` and `wasm_path` are set correctly in prometheus.yml.',
          );
          return;
        }

        const wasmPath = path.resolve(process.cwd(), manifest.wasm_path);
        if (!fs.existsSync(wasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        // --- Refactored Logic ---
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

        const commitHashStr = execSync('git rev-parse HEAD').toString().trim();
        const commitHash = Uint8Array.from(Buffer.from(commitHashStr));
        console.log(`   Using Git Commit Hash: ${commitHashStr}`);

        console.log('\n   📞 Calling the registry via API...');
        const requestId = await submitVerificationRequest(identity, {
          wasm_hash: wasmHash,
          repo: manifest.repo_url,
          commit_hash: commitHash,
          metadata: [],
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
