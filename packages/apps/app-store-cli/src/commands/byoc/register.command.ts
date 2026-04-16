import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { Principal } from '@icp-sdk/core/principal';

import {
  createCanisterType,
  registerExternalCanister,
  getCanisterWasmHash,
  serializeToIcrc16Map,
} from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

import type { Command } from 'commander';

interface Manifest {
  namespace?: string;
  submission?: {
    name?: string;
    description?: string;
    repo_url?: string;
    mcp_path?: string;
    [key: string]: any;
  };
}

export function registerByocRegisterCommand(program: Command) {
  program
    .command('register <canister-id> [namespace]')
    .description(
      'Register an externally-deployed canister with the Prometheus registry for discovery.',
    )
    .action(async (canisterId: string, namespace: string | undefined) => {
      // 1. Load prometheus.yml — required for BYOC so we can populate the
      //    app-store metadata (name, description, visuals, tags, etc.).
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '\n❌ `prometheus.yml` not found. BYOC registration needs a manifest ' +
            'to populate the app-store listing (name, description, icon, etc.).',
        );
        console.error('   Run `app-store-cli init` first, then retry.');
        process.exit(1);
      }

      const manifest = yaml.load(fs.readFileSync(configPath, 'utf-8')) as Manifest;

      // 2. Resolve namespace: explicit arg wins, otherwise manifest.
      const targetNamespace = namespace ?? manifest?.namespace;
      if (!targetNamespace) {
        console.error(
          '\n❌ Namespace is required. Provide it as an argument or set `namespace` in prometheus.yml.',
        );
        process.exit(1);
      }

      // 3. Validate manifest has what we need for the listing.
      const sub = manifest?.submission;
      if (
        manifest?.namespace !== targetNamespace ||
        !sub?.name ||
        !sub?.description ||
        !sub?.repo_url
      ) {
        console.error(
          '\n❌ Manifest is incomplete or doesn\'t match the namespace.\n' +
            '   Required: top-level `namespace` matching the target, and ' +
            '`submission.name`, `submission.description`, `submission.repo_url`.',
        );
        process.exit(1);
      }

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        console.log(`\n🔗 Registering external canister...`);
        console.log(`   Namespace:  ${targetNamespace}`);
        console.log(`   Canister:   ${canisterId}`);
        console.log(`   Identity:   ${currentIdentityName}`);

        // --- [1/3] Ensure namespace exists on-chain (idempotent) ---
        console.log(`\n   [1/3] 🔗 Ensuring namespace is registered on-chain...`);
        const status = await createCanisterType(identity, {
          namespace: targetNamespace,
          name: sub.name!,
          description: sub.description!,
          repo_url: sub.repo_url!,
        });
        console.log(
          status === 'created'
            ? '   ✅ Namespace registered for the first time.'
            : '   ℹ️  Namespace already exists. Proceeding...',
        );

        // --- [2/3] Fetch the live module_hash of the external canister ---
        console.log(`\n   [2/3] 🔎 Reading canister module hash...`);
        const wasmHash = await getCanisterWasmHash(Principal.fromText(canisterId));
        if (!wasmHash) {
          console.error(
            `   ❌ Could not read module_hash for ${canisterId}. ` +
              'Make sure the canister exists and is reachable on this network.',
          );
          process.exit(1);
        }
        const hashHex = Buffer.from(wasmHash).toString('hex');
        console.log(`   ✅ Module hash: ${hashHex}`);

        // --- [3/3] Bind the canister and upload submission metadata ---
        // Metadata shape mirrors `publish`'s verification request metadata:
        // strip repo_url / wasm_path / git_commit (not part of the
        // listing/details view; repo_url lives on the canister_type).
        const metadataPayload: Record<string, any> = { ...sub };
        delete metadataPayload.repo_url;
        delete metadataPayload.wasm_path;
        delete metadataPayload.git_commit;

        console.log(`\n   [3/3] 🔗 Binding canister and uploading metadata...`);
        const binding = await registerExternalCanister(identity, {
          namespace: targetNamespace,
          canisterId,
          wasmHash,
          metadata: serializeToIcrc16Map(metadataPayload),
        });

        console.log(`\n🎉 External canister registered successfully!`);
        console.log(`   Namespace:  ${binding.namespace}`);
        console.log(`   Canister:   ${binding.canisterId}`);
        console.log(`   Bound by:   ${binding.boundBy}`);
        console.log(
          `\n   Your app will now appear in the Prometheus app store with status=External.`,
        );
      } catch (error) {
        console.error('\n❌ Registration failed:');
        console.error(error);
        process.exit(1);
      }
    });
}
