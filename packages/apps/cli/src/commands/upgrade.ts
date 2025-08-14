import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';
import {
  requestUpgrade,
  getWasmHashForVersion,
} from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

export function registerUpgradeCommand(program: Command) {
  program
    .command('upgrade')
    .description(
      'Requests the orchestrator to upgrade a canister to a published version.',
    )
    .requiredOption(
      '-c, --canister <id>',
      'The principal ID of the canister to upgrade.',
    )
    .requiredOption(
      '-v, --version <version>',
      'The semantic version to upgrade to (e.g., 1.0.0)',
    )
    .option(
      '--mode <mode>',
      "Install mode: 'install', 'reinstall', or 'upgrade'",
      'upgrade',
    )
    .option(
      '--arg <hex>',
      'Argument to pass to the canister on upgrade/install, as a hex string',
    )
    .option(
      '--skip-pre-upgrade',
      "Skip the pre-upgrade hook (only for 'upgrade' mode)",
      false,
    )
    .action(async (options) => {
      const { canister, version, mode, arg, skipPreUpgrade } = options;
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. The upgrade command requires it to identify the namespace.',
        );
        return;
      }

      console.log(
        `\n🚀 Requesting upgrade for canister ${canister} to version ${version}...`,
      );

      try {
        const manifest = yaml.load(fs.readFileSync(configPath, 'utf-8')) as {
          namespace: string;
        };
        const identity = loadDfxIdentity(
          execSync('dfx identity whoami').toString().trim(),
        );
        const argBytes = arg ? Buffer.from(arg, 'hex') : undefined;

        // Step 1: Resolve version to WASM hash via the registry
        console.log(
          `   [1/2] 🔎 Resolving version ${version} to a WASM hash for namespace ${manifest.namespace}...`,
        );
        const wasm_hash = await getWasmHashForVersion(identity, {
          namespace: manifest.namespace,
          version: version,
        });
        console.log(
          `   ✅ Found WASM hash: ${Buffer.from(wasm_hash).toString('hex')}`,
        );

        // Step 2: Call the orchestrator with the resolved hash
        console.log(
          '   [2/2] 📞 Calling the orchestrator to perform the upgrade...',
        );
        await requestUpgrade(identity, {
          canister_id: canister,
          wasm_hash: wasm_hash,
          mode: mode,
          arg: argBytes,
          skip_pre_upgrade: skipPreUpgrade,
        });

        console.log(
          `\n🎉 Success! Upgrade request sent successfully for canister ${canister}.`,
        );
        console.log(
          '   The orchestrator will now attempt to install the new WASM.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
