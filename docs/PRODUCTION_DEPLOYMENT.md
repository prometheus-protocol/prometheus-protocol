# Production Deployment Guide

## Complete Production Deployment Process

This guide covers deploying the Prometheus Protocol to the Internet Computer mainnet.

## Prerequisites

- `dfx` installed and configured
- IC mainnet identity configured: `dfx identity use <your-prod-identity>`
- Sufficient ICP for canister creation and cycles

## Step-by-Step Deployment

### 1. Deploy Canisters

```bash
# Deploy all canisters to IC mainnet
dfx deploy --network ic
```

This will:

- Create or upgrade all canisters on mainnet
- Use canister IDs from `canister_ids.json`
- Compile with mainnet-specific settings

### 2. Verify Deployment

```bash
# Check that canisters are running
dfx canister --network ic status mcp_registry
dfx canister --network ic status search_index
# ... check other canisters
```

### 3. Configure Dependencies

```bash
# Check current configuration status
pnpm config:check -- --network ic

# Auto-inject all missing dependencies
pnpm config:inject -- --network ic
```

The script will:

- Query each canister's requirements
- Resolve canister IDs from mainnet
- Call setter methods to link canisters
- Report success/failure for each injection

### 4. Verify Configuration

```bash
# Confirm all canisters are properly configured
pnpm config:check -- --network ic
```

Expected output:

```
✅ audit_hub: Fully configured
✅ mcp_registry: Fully configured
✅ mcp_orchestrator: Fully configured
✅ usage_tracker: Fully configured
✅ leaderboard: Fully configured
✅ search_index: Fully configured
```

## Alternative: Direct Script Usage

```bash
# Using the configure script directly
./scripts/config --inject --network ic

# Or with zx
zx ./scripts/configure-canisters.ts --inject --network ic
```

## What Gets Configured

The automated system configures these dependencies:

### audit_hub

- `usdc_ledger` - Payment token ledger
- `mcp_registry` - Main registry
- `dashboard` - Optional dashboard (if deployed)

### mcp_registry

- `audit_hub` - Credentials/auditing system
- `mcp_orchestrator` - Deployment orchestrator
- `usage_tracker` - Usage metrics
- `search_index` - Search functionality
- `usdc_ledger` - Bounty rewards

### mcp_orchestrator

- `mcp_registry` - Main registry
- `auth_server` - Authentication
- `usage_tracker` - Usage metrics

### usage_tracker

- `mcp_registry` - Main registry
- `mcp_orchestrator` - Orchestrator
- `payout` - Payout system (optional)

### leaderboard

- `usage_tracker` - Metrics source

### search_index

- `mcp_registry` - Main registry

## Rollback Strategy

If configuration fails:

```bash
# Check what went wrong
pnpm config:check -- --network ic

# Fix specific canister manually
dfx canister --network ic call mcp_registry set_orchestrator_canister_id \
  '(principal "vpyes-67777-77774-qaaeq-cai")'

# Or redeploy specific canister
dfx deploy --network ic mcp_registry
pnpm config:inject -- --network ic
```

## Network Differences

The script automatically handles network differences:

| Aspect       | Local                          | Mainnet             |
| ------------ | ------------------------------ | ------------------- |
| Canister IDs | `.dfx/local/canister_ids.json` | `canister_ids.json` |
| Network flag | `--network local` (default)    | `--network ic`      |
| DFX commands | Uses local replica             | Uses IC mainnet     |

## Monitoring After Deployment

```bash
# Check canister status
dfx canister --network ic status mcp_registry

# View logs (if available)
dfx canister --network ic logs mcp_registry

# Check cycles balance
dfx canister --network ic status mcp_registry | grep Balance
```

## Common Issues

### "Canister not found"

- Ensure canister is deployed: `dfx deploy --network ic <canister_name>`
- Check `canister_ids.json` has the correct ID

### "Unauthorized caller"

- Verify your identity has controller access
- Check: `dfx canister --network ic info <canister_id>`

### "Network error"

- IC mainnet may be experiencing issues
- Check status: https://status.internetcomputer.org/
- Retry with: `pnpm config:inject -- --network ic`

### "Method not found: get_env_requirements"

- Canister needs to be rebuilt and deployed
- Run: `dfx deploy --network ic <canister_name>`

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy to IC Mainnet

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dfx
        run: |
          sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"

      - name: Setup identity
        run: |
          echo "${{ secrets.DFX_IDENTITY }}" > identity.pem
          dfx identity import prod identity.pem
          dfx identity use prod

      - name: Deploy canisters
        run: dfx deploy --network ic

      - name: Configure dependencies
        run: pnpm config:inject -- --network ic

      - name: Verify configuration
        run: pnpm config:check -- --network ic
```

## Best Practices

1. **Always check before inject**: Run `pnpm config:check -- --network ic` first
2. **Test locally first**: Validate changes on local replica before mainnet
3. **Monitor cycles**: Ensure canisters have sufficient cycles after deployment
4. **Verify configuration**: Always run final check after injection
5. **Use version control**: Tag production deployments in git

## Next Steps

After successful deployment:

1. Verify frontend applications are connecting to mainnet canisters
2. Test critical user flows (registration, auth, etc.)
3. Monitor canister metrics and logs
4. Set up alerts for low cycles balance
5. Document the deployment in your changelog
