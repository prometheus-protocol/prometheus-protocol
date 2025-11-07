# Automated Canister Configuration

## Overview

The Prometheus Protocol uses a **code-as-source-of-truth** approach for canister configuration. Instead of maintaining separate configuration files, each canister declares its own environment requirements through a standard interface. This enables automated discovery, validation, and injection of dependencies.

## Quick Start

### Local Development

```bash
# Check configuration status for all canisters
pnpm config:check

# Automatically inject missing dependencies
pnpm config:inject
```

### Production (IC Mainnet)

```bash
# Deploy to mainnet
dfx deploy --network ic

# Check configuration status on mainnet
pnpm config:check -- --network ic

# Automatically inject missing dependencies on mainnet
pnpm config:inject -- --network ic
```

**The same commands work for both local and production - just add `--network ic` for mainnet!**

## How It Works

### 1. Canisters Declare Requirements

Each canister implements a `get_env_requirements()` query method:

```motoko
public query func get_env_requirements() : async {
  #v1 : {
    dependencies : [EnvDependency];
    configuration : [EnvConfig];
  };
} {
  #v1({
    dependencies = [
      {
        key = "_registry_canister_id";
        setter = "set_registry_canister_id";
        canister_name = "mcp_registry";
        required = true;
        current_value = _registry_canister_id;
      }
    ];
    configuration = [];
  })
}
```

### 2. Script Discovers Requirements

The `configure-canisters.ts` script:

1. Queries each canister for its requirements
2. Fetches all available canister IDs
3. Identifies missing or misconfigured dependencies

### 3. Automated Configuration

The script can automatically:

- Validate current configuration
- Inject missing dependencies
- Report configuration status

## Benefits

✅ **Single Source of Truth** - Canisters themselves define what they need
✅ **Self-Documenting** - No need to maintain separate config documentation
✅ **Automated** - One command to configure all canisters
✅ **Validated** - Script checks for missing or incorrect configuration
✅ **Network-Aware** - Works for local dev and production deployments

## Standard Interface

See [ENV_CONFIG_STANDARD.md](./packages/canisters/ENV_CONFIG_STANDARD.md) for the complete specification.

### Types

**EnvDependency** - A dependency on another canister:

- `key`: Internal variable name
- `setter`: Method name to call for injection
- `canister_name`: Name in dfx.json
- `required`: Whether this is mandatory
- `current_value`: Current Principal if set

**EnvConfig** - A configuration value:

- `key`: Internal variable name
- `setter`: Method name to call for injection
- `value_type`: Data type (nat, text, principal, etc.)
- `required`: Whether this is mandatory
- `current_value`: Current value as text if set

## Implementation Guide

### Adding to Your Canister

1. **Define the types** (one-time in your canister):

```motoko
public type EnvDependency = {
  key : Text;
  setter : Text;
  canister_name : Text;
  required : Bool;
  current_value : ?Principal;
};

public type EnvConfig = {
  key : Text;
  setter : Text;
  value_type : Text;
  required : Bool;
  current_value : ?Text;
};
```

2. **Implement the method**:

```motoko
public query func get_env_requirements() : async {
  #v1 : {
    dependencies : [EnvDependency];
    configuration : [EnvConfig];
  };
} {
  #v1({
    dependencies = [
      // List your canister dependencies here
    ];
    configuration = [
      // List your config values here
    ];
  })
}
```

3. **Deploy and test**:

```bash
dfx deploy your_canister
./scripts/configure-canisters.ts --check
```

## Complete Deployment Workflow

### Local Development

```bash
# 1. Start local replica
dfx start --clean

# 2. Deploy all canisters
dfx deploy

# 3. Check configuration status
pnpm config:check

# 4. Auto-configure all dependencies
pnpm config:inject

# 5. Verify everything is configured
pnpm config:check
```

### Production Deployment to IC Mainnet

```bash
# 1. Deploy all canisters to mainnet
dfx deploy --network ic

# 2. Check configuration status on mainnet
pnpm config:check -- --network ic

# 3. Auto-configure all dependencies on mainnet
pnpm config:inject -- --network ic

# 4. Verify everything is configured
pnpm config:check -- --network ic
```

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
- name: Deploy canisters to IC
  run: dfx deploy --network ic

- name: Configure canister dependencies
  run: pnpm config:inject -- --network ic

- name: Verify configuration
  run: pnpm config:check -- --network ic
```

## Migration Path

The old bootstrap scripts are **replaced** by this automated system:

```bash
# ❌ Old way (manual, error-prone)
./scripts/bootstrap.ts         # local
./scripts/bootstrap-prod.ts    # production

# ✅ New way (automated, self-documenting)
pnpm config:inject              # local
pnpm config:inject -- --network ic  # production
```

**Benefits:**

- Single source of truth (canisters declare their own needs)
- Works on any network (local/mainnet)
- Validates before and after
- Shows exactly what's missing or misconfigured

## Example: search_index Canister

See [packages/canisters/search_index/src/main.mo](./packages/canisters/search_index/src/main.mo) for a complete implementation example.

## Troubleshooting

**"Canister doesn't implement env config standard"**

- The canister hasn't added the `get_env_requirements()` method yet
- Add the method following the implementation guide above

**"Cannot inject - target canister not found"**

- The dependency canister isn't deployed or listed in the script
- Deploy missing canisters first

**"Missing config values need manual setting"**

- Some configuration values (like amounts, URLs) need explicit values
- Set these manually or extend the script with a config file

## Future Enhancements

- [ ] Support for configuration value defaults/overrides via JSON file
- [ ] Dry-run mode with detailed change preview
- [ ] Configuration drift detection
- [ ] Automated testing of configuration changes
- [ ] Integration with CI/CD pipelines
