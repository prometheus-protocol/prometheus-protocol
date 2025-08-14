import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';
import { getVerificationStatus } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

interface Manifest {
  wasm_path: string;
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
          '❌ Error: `prometheus.yml` not found. Please run `@prometheus-protocol/cli init` first.',
        );
        return;
      }

      console.log('\n🔎 Checking verification status from manifest...');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;
        const wasmPath = path.resolve(process.cwd(), manifest.wasm_path);
        if (!fs.existsSync(wasmPath)) {
          console.error(`❌ Error: WASM file not found at path: ${wasmPath}`);
          return;
        }

        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();
        console.log(`   WASM Hash: ${Buffer.from(wasmHash).toString('hex')}`);

        const identityName = execSync('dfx identity whoami').toString().trim();
        const identity = loadDfxIdentity(identityName);
        const status = await getVerificationStatus(identity, wasmHash);

        console.log('\n--- Verification Status ---');
        console.log(
          `   Verified by DAO: ${status.isVerified ? '✅ Yes' : '❌ No'}`,
        );
        console.log(`\n   Found ${status.attestations.length} attestation(s):`);
        if (status.attestations.length > 0) {
          status.attestations.forEach((att, i) => {
            console.log(`     [${i + 1}] Auditor: ${att.auditor.toText()}`);
            console.log(`         Type: ${att.audit_type}`);
          });
        } else {
          console.log(
            '     (None yet. Ask an auditor to review your submission.)',
          );
        }
        console.log('---------------------------\n');
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
