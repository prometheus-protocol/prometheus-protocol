import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';
import { publishVersion } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

interface Manifest {
  namespace: string;
  repo_url: string;
  wasm_path: string;
}

export function registerPublishCommand(program: Command) {
  program
    .command('publish')
    .description(
      'Publishes a new version, linking a verified WASM to a semantic version.',
    )
    .requiredOption(
      '-v, --version <version>',
      'The semantic version to publish (e.g., 1.0.0)',
    )
    .action(async (options) => {
      const { version } = options;
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `@prometheus-protocol/cli init` first.',
        );
        return;
      }

      console.log(`\n📦 Publishing version ${version} from manifest...`);

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

        const identityName = execSync('dfx identity whoami').toString().trim();
        const identity = loadDfxIdentity(identityName);

        console.log('   📞 Calling the registry to publish...');
        await publishVersion(identity, {
          namespace: manifest.namespace,
          version: version,
          wasm_hash: wasmHash,
          repo_url: manifest.repo_url,
        });

        console.log(
          `\n🎉 Success! Successfully published version ${version} for namespace ${manifest.namespace}.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
