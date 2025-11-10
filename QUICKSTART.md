# Quick Start Guide

## Local Development

### First Time Setup

```bash
# 1. Start local replica
dfx start --clean

# 2. Deploy all canisters
dfx deploy

# 3. Configure canister dependencies (linking)
pnpm config:inject

# 4. Set up local dev environment (test tokens, cycles, etc.)
pnpm setup:local

# 5. Set up verifier nodes (optional, for bounty testing)
pnpm register:dev-verifiers
pnpm generate:verifier-env
pnpm verifiers:up

# 6. Verify configuration
pnpm config:check
```

### After Changes

```bash
# Rebuild and redeploy changed canisters
dfx deploy

# Auto-configure any new dependencies
pnpm config:inject

# Verify
pnpm config:check
```

---

## Production Deployment

### Deploying to IC Mainnet

```bash
# 1. Deploy all canisters
dfx deploy --network ic

# 2. Configure canister dependencies
pnpm config:inject -- --network ic

# 3. Verify all canisters are configured
pnpm config:check -- --network ic
```

### Updating Production

```bash
# 1. Deploy specific canister or all
dfx deploy <canister_name> --network ic

# 2. Re-run configuration (idempotent, safe)
pnpm config:inject -- --network ic

# 3. Verify
pnpm config:check -- --network ic
```

---

## Common Tasks

### Check Configuration Status

```bash
# Local
pnpm config:check

# Production
pnpm config:check -- --network ic
```

### Seed Test Data (Local Only)

```bash
# Seed app bounties
pnpm seed:app-bounties

# Seed leaderboard
pnpm seed:leaderboard

# Seed everything
pnpm seed
```

### Verifier Node Management

```bash
# Register dev verifiers with audit hub
pnpm register:dev-verifiers

# Generate .env files for verifier bots
pnpm generate:verifier-env

# Start all verifier nodes
pnpm verifiers:up

# Stop all verifier nodes
pnpm verifiers:down

# View verifier logs
pnpm verifiers:logs

# Check verifier balances
pnpm check:verifier-balances

# Top up verifier balances (local)
pnpm topup:verifiers --amount 5
```

### View Canister IDs

```bash
# Local
dfx canister id <canister_name>

# Production
dfx canister id <canister_name> --network ic
```

### Check Canister Status

```bash
# Local
dfx canister status <canister_name>

# Production
dfx canister status <canister_name> --network ic
```

---

## Key Differences: Local vs Production

| Operation    | Local                 | Production                           |
| ------------ | --------------------- | ------------------------------------ |
| Deploy       | `dfx deploy`          | `dfx deploy --network ic`            |
| Configure    | `pnpm config:inject`  | `pnpm config:inject -- --network ic` |
| Check Status | `pnpm config:check`   | `pnpm config:check -- --network ic`  |
| Local Setup  | `pnpm setup:local` ✅ | ❌ Never run on prod                 |
| Seed Data    | `pnpm seed` ✅        | ❌ Never run on prod                 |

---

## Troubleshooting

### "Canister not found"

Make sure the canister is deployed:

```bash
dfx deploy <canister_name>
```

### "Missing dependencies"

Run the configuration script:

```bash
pnpm config:inject
```

### "Configuration failed"

Check the error message and verify:

1. All canisters are deployed
2. You have controller access
3. Network is reachable

Then retry:

```bash
pnpm config:inject
```

### Start Fresh (Local)

```bash
# Stop replica
dfx stop

# Clean everything
dfx start --clean

# Redeploy and configure
dfx deploy
pnpm config:inject
pnpm setup:local
```

---

## More Documentation

- [Automated Configuration](./docs/AUTOMATED_CONFIG.md) - Complete configuration guide
- [Production Deployment](./docs/PRODUCTION_DEPLOYMENT.md) - Detailed production process
- [Configuration System](./docs/CONFIG_SYSTEM_SUMMARY.md) - System architecture
- [Scripts README](./scripts/README.md) - All available scripts
