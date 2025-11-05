# Canister Environment Configuration Standard

## Overview

Each canister in the Prometheus Protocol declares its environment requirements by implementing a `get_env_requirements()` query method. This allows for automated discovery and injection of canister dependencies.

## Standard Interface

```motoko
public query func get_env_requirements() : async {
  #v1 : {
    dependencies : [EnvDependency];
    configuration : [EnvConfig];
  }
} {
  // Return canister's environment requirements
}
```

### Types

#### EnvDependency

Represents a dependency on another canister:

```motoko
public type EnvDependency = {
  key : Text;              // Internal variable name (e.g., "_registry_canister_id")
  setter : Text;           // Setter method name (e.g., "set_registry_canister_id")
  canister_name : Text;    // Name in dfx.json (e.g., "mcp_registry")
  required : Bool;         // Whether this dependency is required
  current_value : ?Principal; // Current value if set
};
```

#### EnvConfig

Represents a configuration value:

```motoko
public type EnvConfig = {
  key : Text;              // Internal variable name (e.g., "_bounty_reward_amount")
  setter : Text;           // Setter method name (e.g., "set_bounty_reward_amount")
  value_type : Text;       // Type of value (e.g., "nat", "text", "principal")
  required : Bool;         // Whether this config is required
  current_value : ?Text;   // Current value as text if set
};
```

## Example Implementation

```motoko
public query func get_env_requirements() : async {
  #v1 : {
    dependencies : [EnvDependency];
    configuration : [EnvConfig];
  }
} {
  #v1({
    dependencies = [
      {
        key = "_registry_canister_id";
        setter = "set_registry_canister_id";
        canister_name = "mcp_registry";
        required = true;
        current_value = _registry_canister_id;
      },
      {
        key = "_orchestrator_canister_id";
        setter = "set_orchestrator_canister_id";
        canister_name = "mcp_orchestrator";
        required = true;
        current_value = _orchestrator_canister_id;
      }
    ];
    configuration = [
      {
        key = "_bounty_reward_amount";
        setter = "set_bounty_reward_amount";
        value_type = "nat";
        required = false;
        current_value = ?Nat.toText(_bounty_reward_amount);
      }
    ];
  })
}
```

## Tooling

The `scripts/configure-canisters.ts` script uses this standard to:

1. **Discover**: Query all canisters for their requirements
2. **Validate**: Check which dependencies are missing or misconfigured
3. **Inject**: Call setter methods with appropriate values
4. **Verify**: Confirm all required dependencies are set

## Usage

```bash
# Check what's missing across all canisters
./scripts/configure-canisters.ts --check

# Inject all missing dependencies
./scripts/configure-canisters.ts --inject

# Target specific network
./scripts/configure-canisters.ts --inject --network ic

# Show detailed status
./scripts/configure-canisters.ts --status
```
