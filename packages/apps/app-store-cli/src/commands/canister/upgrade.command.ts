import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  requestUpgrade,
  getWasmHashForVersion,
} from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

interface Manifest {
  // Note: We are standardizing on 'namespace' for consistency across all commands.
  namespace: string;
}

export function registerUpgradeCanisterCommand(program: Command) {
  program
    // 1. Use positional arguments for the core subjects.
    .command('upgrade <canister-id> <version> [namespace]')
    .description(
      'Requests an upgrade for a canister. Reads namespace from prometheus.yml if omitted.',
    )
    // 2. Keep the other parameters as options.
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
    // 3. The action now receives the positional arguments directly.
    .action(async (canisterId, version, namespace, options) => {
      let targetNamespace = namespace;

      // 4. If namespace is missing, try to load it from the config file.
      if (!targetNamespace) {
        console.log(
          'ℹ️ Namespace not provided, attempting to read from prometheus.yml...',
        );
        const configPath = path.join(process.cwd(), 'prometheus.yml');
        if (!fs.existsSync(configPath)) {
          console.error(
            '❌ Error: Namespace not provided and prometheus.yml not found.',
          );
          console.error(
            '   Run this command from your project root or specify a namespace manually.',
          );
          return;
        }
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;
        targetNamespace = manifest.namespace;
      }

      console.log(
        `\n🚀 Requesting upgrade for canister ${canisterId} to version ${version}...`,
      );

      try {
        const { mode, arg, skipPreUpgrade } = options;
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
        const argBytes = arg ? Buffer.from(arg, 'hex') : undefined;

        // Step 1: Resolve version to WASM hash using the resolved namespace
        console.log(
          `   [1/2] 🔎 Resolving version ${version} to a WASM hash for namespace ${targetNamespace}...`,
        );
        const wasm_hash = await getWasmHashForVersion(identity, {
          namespace: targetNamespace,
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
          canister_id: canisterId,
          wasm_hash: wasm_hash,
          mode: mode,
          arg: argBytes,
          skip_pre_upgrade: skipPreUpgrade,
        });

        console.log(
          `\n🎉 Success! Upgrade request sent successfully for canister ${canisterId}.`,
        );
        console.log(
          '   Run `app-store canister status` to check the progress.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
