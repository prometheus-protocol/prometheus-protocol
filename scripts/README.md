# Configuration Scripts

## configure-canisters.ts

Automated canister dependency management using code-as-source-of-truth.

### Quick Usage

```bash
# Check configuration status
pnpm config:check                    # local
pnpm config:check -- --network ic    # mainnet

# Inject missing dependencies
pnpm config:inject                   # local
pnpm config:inject -- --network ic   # mainnet

# View current status
pnpm config:status                   # local
pnpm config:status -- --network ic   # mainnet
```

### Direct Script Usage

```bash
# Using the shell wrapper
./scripts/config --check
./scripts/config --inject --network ic

# Using zx directly
zx ./scripts/configure-canisters.ts --check
zx ./scripts/configure-canisters.ts --inject --network ic
```

### What It Does

1. **Discovers** canister requirements by querying `get_env_requirements()`
2. **Validates** current configuration state
3. **Resolves** canister IDs from network-specific files
4. **Injects** missing dependencies via setter methods
5. **Reports** status and any issues

### Options

- `--check` - Check configuration status (read-only)
- `--inject` - Automatically inject missing dependencies
- `--network <name>` - Target network (local/ic, default: local)

### How Canisters Declare Requirements

Each canister implements this standard interface:

```motoko
public query func get_env_requirements() : async {
  #v1 : {
    dependencies : [EnvDependency];
    configuration : [EnvConfig];
  };
}
```

See [ENV_CONFIG_STANDARD.md](../packages/canisters/ENV_CONFIG_STANDARD.md) for details.

---

## setup-local-dev.ts

Local development environment setup for testing and development.

### Quick Usage

```bash
pnpm setup:local
```

### What It Does

Performs **local development only** operations:

- Sets stake requirements for audit types
- Mints initial auditor reputation tokens
- Transfers test USDC to test auditor
- Fabricates cycles for the orchestrator

**Note**: This script is for LOCAL ONLY. Never run on production networks.

### Configuration

Edit the script to customize:

- `AUDITOR_PRINCIPAL` - Test auditor principal
- `STAKE_AMOUNT` - Stake requirement per audit type
- `MINT_AMOUNT` - Initial reputation tokens
- `USDC_TRANSFER_AMOUNT` - Test USDC amount
- `ORCHESTRATOR_CYCLES_IN_TRILLIONS` - Cycles to fabricate

---

## Deployment Workflows

### Local Development

```bash
# 1. Start local replica
dfx start --clean

# 2. Deploy all canisters
dfx deploy

# 3. Configure canister dependencies
pnpm config:inject

# 4. Set up local dev environment (tokens, cycles, etc.)
pnpm setup:local

# 5. Verify everything is configured
pnpm config:check
```

### Production Deployment

```bash
# 1. Deploy to IC mainnet
dfx deploy --network ic

# 2. Configure canister dependencies
pnpm config:inject -- --network ic

# 3. Verify everything is configured
pnpm config:check -- --network ic

# Note: Do NOT run setup:local on production
# Production configuration (stakes, tokens) should be done through governance
```

---

## Other Scripts

### seed-app-bounties.ts

Seeds the app bounty system with test data.

```bash
pnpm seed:app-bounties
```

### seed-leaderboard.ts

Seeds the leaderboard with test data.

```bash
pnpm seed:leaderboard
```

### seed (combined)

Runs both seeding scripts.

```bash
pnpm seed
```

### sync-historical-wasms.ts

Syncs historical WASM files from the registry.

```bash
pnpm sync:wasms
```

---

## Full Documentation

- [Automated Configuration Guide](../docs/AUTOMATED_CONFIG.md)
- [Production Deployment Guide](../docs/PRODUCTION_DEPLOYMENT.md)
- [System Summary](../docs/CONFIG_SYSTEM_SUMMARY.md)
- [Configuration Standard](../packages/canisters/ENV_CONFIG_STANDARD.md)
