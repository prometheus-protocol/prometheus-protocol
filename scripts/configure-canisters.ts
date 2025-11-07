#!/usr/bin/env zx
import { $, chalk } from 'zx';

/**
 * Automated Canister Configuration Script
 *
 * This script discovers environment requirements from canisters and automatically
 * configures them. It uses the standard `get_env_requirements()` interface.
 */

// Parse command line arguments
const args = process.argv.slice(3);
const networkIndex = args.indexOf('--network');
const NETWORK = networkIndex !== -1 ? args[networkIndex + 1] : 'local';

const CHECK_ONLY = args.includes('--check');
const INJECT = args.includes('--inject');
const STATUS = args.includes('--status') || (!CHECK_ONLY && !INJECT);

// Known audit_type to token mappings
// These define which token should be used for each audit type
const AUDIT_TYPE_MAPPINGS: Record<string, string> = {
  build_reproducibility_v1: 'usdc_ledger',
  app_info_v1: 'usdc_ledger',
  quality: 'usdc_ledger',
  data_safety_v1: 'usdc_ledger',
};

interface EnvDependency {
  key: string;
  setter: string;
  canister_name: string;
  required: boolean;
  current_value: string[] | null; // Candid returns [Principal] for ?Principal
}

interface EnvConfig {
  key: string;
  setter: string;
  value_type: string;
  required: boolean;
  current_value: string[] | null; // Candid returns [Text] for ?Text
}

interface EnvRequirements {
  dependencies: EnvDependency[];
  configuration: EnvConfig[];
}

interface CanisterStatus {
  name: string;
  id: string;
  hasStandard: boolean;
  requirements?: EnvRequirements;
  missingDeps: EnvDependency[];
  missingConfigs: EnvConfig[];
}

// List of canisters to check (in dependency order)
const CANISTER_NAMES = [
  'usdc_ledger',
  'audit_hub',
  'usage_tracker',
  'leaderboard',
  'mcp_orchestrator',
  'search_index',
  'mcp_registry',
];

/**
 * Fetch canister ID for a given canister name
 */
async function getCanisterId(name: string): Promise<string> {
  try {
    const result =
      NETWORK === 'local'
        ? await $`dfx canister id ${name}`
        : await $`dfx canister id ${name} --network ${NETWORK}`;
    return result.stdout.trim();
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Canister '${name}' not found`));
    return '';
  }
}

/**
 * Fetch all canister IDs
 */
async function getAllCanisterIds(): Promise<Map<string, string>> {
  console.log(chalk.bold('🔍 Fetching canister IDs...'));
  const canisterIds = new Map<string, string>();

  for (const name of CANISTER_NAMES) {
    const id = await getCanisterId(name);
    if (id) {
      canisterIds.set(name, id);
    }
  }

  console.log(chalk.green(`✅ Found ${canisterIds.size} canisters`));
  console.log('');
  return canisterIds;
}

/**
 * Try to fetch environment requirements from a canister
 */
async function getEnvRequirements(
  name: string,
  id: string,
): Promise<EnvRequirements | null> {
  try {
    $.verbose = false;
    const result =
      NETWORK === 'local'
        ? await $`dfx canister call ${name} get_env_requirements '()'`
        : await $`dfx canister call ${name} get_env_requirements '()' --network ${NETWORK}`;
    const output = result.stdout.trim();

    // Parse the Candid output - it returns a variant with #v1
    // Expected format: (variant { v1 = record { dependencies = vec {...}; configuration = vec {...} } })
    if (output.includes('v1')) {
      // For now, we'll need to parse this manually or use a proper Candid parser
      // This is a simplified version - in production, you'd want proper Candid parsing
      return await parseEnvRequirements(name, output);
    }

    return null;
  } catch (error) {
    // Canister doesn't implement the standard
    return null;
  }
}

/**
 * Parse environment requirements from Candid output
 * This is a simplified parser - a production version would use proper Candid parsing
 */
async function parseEnvRequirements(
  name: string,
  candidOutput: string,
): Promise<EnvRequirements | null> {
  try {
    // For now, just call it via candid-ui format and parse JSON
    // In a real implementation, you'd use @dfinity/candid or similar
    const result =
      NETWORK === 'local'
        ? await $`dfx canister call ${name} get_env_requirements --output json`
        : await $`dfx canister call ${name} get_env_requirements --output json --network ${NETWORK}`;
    const parsed = JSON.parse(result.stdout);

    // The JSON output will have the structure we need
    if (parsed && parsed.v1) {
      return parsed.v1;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check all canisters for their configuration status
 */
async function checkAllCanisters(
  canisterIds: Map<string, string>,
): Promise<CanisterStatus[]> {
  console.log(chalk.bold('🔎 Checking canister configurations...'));
  console.log('');

  const statuses: CanisterStatus[] = [];

  for (const [name, id] of canisterIds) {
    const requirements = await getEnvRequirements(name, id);

    if (!requirements) {
      console.log(
        chalk.yellow(`⚠️  ${name}: Does not implement env config standard`),
      );
      statuses.push({
        name,
        id,
        hasStandard: false,
        missingDeps: [],
        missingConfigs: [],
      });
      continue;
    }

    // Check which dependencies are missing
    // Note: Candid optional types come as [] (empty array) or [value] in JSON
    const missingDeps = requirements.dependencies.filter(
      (dep) =>
        dep.required &&
        (!dep.current_value ||
          (Array.isArray(dep.current_value) && dep.current_value.length === 0)),
    );
    const missingConfigs = requirements.configuration.filter(
      (cfg) =>
        cfg.required &&
        (!cfg.current_value ||
          (Array.isArray(cfg.current_value) && cfg.current_value.length === 0)),
    );

    const status: CanisterStatus = {
      name,
      id,
      hasStandard: true,
      requirements,
      missingDeps,
      missingConfigs,
    };

    statuses.push(status);

    if (missingDeps.length > 0 || missingConfigs.length > 0) {
      console.log(chalk.red(`❌ ${name}: Missing configuration`));
      if (missingDeps.length > 0) {
        console.log(chalk.red(`   Missing dependencies:`));
        missingDeps.forEach((dep) => {
          console.log(chalk.red(`     - ${dep.key} (${dep.canister_name})`));
        });
      }
      if (missingConfigs.length > 0) {
        console.log(chalk.red(`   Missing configuration:`));
        missingConfigs.forEach((cfg) => {
          console.log(chalk.red(`     - ${cfg.key} (${cfg.value_type})`));
        });
      }
    } else {
      console.log(chalk.green(`✅ ${name}: Fully configured`));
    }
  }

  console.log('');
  return statuses;
}

/**
 * Inject missing configuration into canisters
 */
async function injectConfiguration(
  statuses: CanisterStatus[],
  canisterIds: Map<string, string>,
): Promise<void> {
  console.log(chalk.bold('💉 Injecting configuration...'));
  console.log('');

  let injectedCount = 0;

  // Special case: Configure payment token for audit_hub
  const auditHubId = canisterIds.get('audit_hub');
  const usdcLedgerId = canisterIds.get('usdc_ledger');
  if (auditHubId && usdcLedgerId) {
    try {
      console.log(
        chalk.cyan('   Configuring payment token (USDC) for audit_hub...'),
      );
      if (NETWORK === 'local') {
        await $`dfx canister call audit_hub set_payment_token_config '(principal "${usdcLedgerId}", "USDC", 6:nat8)'`;
      } else {
        await $`dfx canister call audit_hub set_payment_token_config '(principal "${usdcLedgerId}", "USDC", 6:nat8)' --network ${NETWORK}`;
      }
      injectedCount++;
      console.log(chalk.green('   ✅ Payment token configured'));
    } catch (error) {
      console.log(
        chalk.red(`   ❌ Failed to configure payment token: ${error}`),
      );
    }
  }

  for (const status of statuses) {
    if (!status.hasStandard || !status.requirements) {
      continue;
    }

    // Inject missing dependencies
    for (const dep of status.missingDeps) {
      const targetId = canisterIds.get(dep.canister_name);
      if (!targetId) {
        console.log(
          chalk.yellow(
            `⚠️  ${status.name}: Cannot inject ${dep.key} - target canister '${dep.canister_name}' not found`,
          ),
        );
        continue;
      }

      try {
        console.log(
          chalk.cyan(
            `   Setting ${status.name}.${dep.setter}(${dep.canister_name})...`,
          ),
        );

        // Build the command arguments carefully
        const args = [`(principal "${targetId}")`];

        if (NETWORK === 'local') {
          await $`dfx canister call ${status.name} ${dep.setter} ${args}`;
        } else {
          await $`dfx canister call ${status.name} ${dep.setter} ${args} --network ${NETWORK}`;
        }

        injectedCount++;
        console.log(chalk.green(`   ✅ Set successfully`));
      } catch (error) {
        console.log(chalk.red(`   ❌ Failed to set ${dep.key}: ${error}`));
      }
    }

    // Inject missing configurations
    for (const cfg of status.missingConfigs) {
      // Special handling for audit_type_mapping
      if (cfg.value_type === 'audit_type_mapping') {
        // Look up the token canister for this audit_type
        const tokenCanisterName = AUDIT_TYPE_MAPPINGS[cfg.key];
        if (!tokenCanisterName) {
          console.log(
            chalk.yellow(
              `⚠️  ${status.name}: Unknown audit type '${cfg.key}' - not in AUDIT_TYPE_MAPPINGS`,
            ),
          );
          continue;
        }

        const tokenId = canisterIds.get(tokenCanisterName);
        if (!tokenId) {
          console.log(
            chalk.yellow(
              `⚠️  ${status.name}: Cannot inject audit type mapping '${cfg.key}' - token canister '${tokenCanisterName}' not found`,
            ),
          );
          continue;
        }

        try {
          console.log(
            chalk.cyan(
              `   Registering audit type '${cfg.key}' → ${tokenCanisterName}...`,
            ),
          );

          if (NETWORK === 'local') {
            await $`dfx canister call ${status.name} ${cfg.setter} '("${cfg.key}", "${tokenId}")'`;
          } else {
            await $`dfx canister call ${status.name} ${cfg.setter} '("${cfg.key}", "${tokenId}")' --network ${NETWORK}`;
          }

          injectedCount++;
          console.log(chalk.green(`   ✅ Registered successfully`));
        } catch (error) {
          console.log(
            chalk.red(`   ❌ Failed to register ${cfg.key}: ${error}`),
          );
        }
        continue;
      }

      // Note: For other configuration values, we'd need a config file or defaults
      // For now, we skip these as they need explicit values
      console.log(
        chalk.yellow(
          `⚠️  ${status.name}: Config value '${cfg.key}' (${cfg.value_type}) needs manual setting via ${cfg.setter}`,
        ),
      );
    }
  }

  console.log('');
  console.log(
    chalk.bold.green(`🎉 Injected ${injectedCount} configuration values`),
  );
}

/**
 * Display configuration status summary
 */
function displaySummary(statuses: CanisterStatus[]): void {
  console.log(chalk.bold('📊 Configuration Summary'));
  console.log('');

  const total = statuses.length;
  const withStandard = statuses.filter((s) => s.hasStandard).length;
  const fullyConfigured = statuses.filter(
    (s) =>
      s.hasStandard &&
      s.missingDeps.length === 0 &&
      s.missingConfigs.length === 0,
  ).length;
  const needsConfig = statuses.filter(
    (s) => s.missingDeps.length > 0 || s.missingConfigs.length > 0,
  ).length;

  console.log(`Total canisters: ${total}`);
  console.log(`With env config standard: ${withStandard}`);
  console.log(chalk.green(`Fully configured: ${fullyConfigured}`));
  console.log(chalk.red(`Needs configuration: ${needsConfig}`));
  console.log('');
}

/**
 * Main script
 */
async function main() {
  $.verbose = false;

  console.log(
    chalk.bold.cyan(`🚀 Canister Configuration Tool (network: ${NETWORK})`),
  );
  console.log('');

  // Fetch all canister IDs
  const canisterIds = await getAllCanisterIds();

  if (canisterIds.size === 0) {
    console.log(chalk.red('❌ No canisters found'));
    process.exit(1);
  }

  // Check configuration status
  const statuses = await checkAllCanisters(canisterIds);

  // Display summary
  displaySummary(statuses);

  // Inject configuration if requested
  if (INJECT) {
    await injectConfiguration(statuses, canisterIds);
  } else if (CHECK_ONLY) {
    console.log(
      chalk.yellow('ℹ️  Check complete. Use --inject to apply configuration.'),
    );
  }
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ An error occurred:'), err);
  process.exit(1);
});
