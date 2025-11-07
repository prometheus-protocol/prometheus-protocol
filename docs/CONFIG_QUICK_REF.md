# Quick Reference: Canister Configuration

## Commands

```bash
# Check configuration status
pnpm config:check

# Apply configuration automatically
pnpm config:inject

# For production (IC mainnet)
pnpm config:inject -- --network ic

# Or use the convenience wrapper
./scripts/config check
./scripts/config inject
```

## What This Does

1. **Discovers** what each canister needs by querying them directly
2. **Validates** current configuration state
3. **Injects** missing dependencies automatically
4. **Reports** any issues or missing values

## Implementation Checklist

To add the standard to a new canister:

- [ ] Add the type definitions:

  ```motoko
  public type EnvDependency = { ... };
  public type EnvConfig = { ... };
  ```

- [ ] Implement `get_env_requirements()`:

  ```motoko
  public query func get_env_requirements() : async { ... }
  ```

- [ ] List all dependencies (other canisters needed)
- [ ] List all configuration (values that need setting)
- [ ] Deploy and test with `./scripts/config check`

## Example Output

```
✅ search_index: Fully configured
❌ mcp_registry: Missing configuration
   - _orchestrator_canister_id (mcp_orchestrator)
   - _usage_tracker_canister_id (usage_tracker)
```

## Benefits

✅ Code is the source of truth
✅ Self-documenting
✅ Automated validation
✅ One command to configure everything
✅ Works for local dev and production

## See Also

- [Complete Standard](../packages/canisters/ENV_CONFIG_STANDARD.md)
- [Full Documentation](./AUTOMATED_CONFIG.md)
- [Implementation Summary](./CONFIG_SYSTEM_SUMMARY.md)
- [Example Implementation](../packages/canisters/search_index/src/main.mo)
