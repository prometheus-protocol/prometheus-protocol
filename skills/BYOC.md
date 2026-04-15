# BYOC — Bring Your Own Canister

Register an externally-deployed canister with Prometheus for discovery.

## When to use

You have a canister already deployed on the Internet Computer and want it discoverable through the Prometheus app store. You own the namespace in the registry.

## Register

```bash
# Namespace inferred from prometheus.yml in current directory
app-store-cli byoc register <canister-id>

# Explicit namespace
app-store-cli byoc register <canister-id> <namespace>
```

Uses your current dfx identity. You must be a controller of the namespace.

## Check status

```bash
app-store-cli byoc status [namespace]
```

Anonymous query — no identity needed.

## Unregister

```bash
app-store-cli byoc unregister <canister-id> [namespace]
```

## Programmatic API (ic-js)

```typescript
import {
  registerExternalCanister,
  unregisterExternalCanister,
  getExternalBinding,
} from '@prometheus-protocol/ic-js';

// Register (requires identity)
const binding = await registerExternalCanister(identity, {
  namespace: 'com.myorg.myapp',
  canisterId: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
});

// Query (anonymous)
const binding = await getExternalBinding('com.myorg.myapp');

// Unregister (requires identity)
await unregisterExternalCanister(identity, {
  namespace: 'com.myorg.myapp',
  canisterId: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
});
```

## Constraints

- **Namespace ownership required** — caller must be a controller of the namespace
- **1:1 uniqueness** — one canister per namespace, one namespace per canister
- **Global apps only** (MVP) — no per-user or per-org scoping

## Errors

| Error | Meaning |
|-------|---------|
| `NotController` | Caller is not a controller of the namespace |
| `NamespaceNotFound` | Namespace doesn't exist in the registry |
| `AlreadyBound` | Namespace already has an external canister |
| `CanisterAlreadyBound` | Canister is already bound to another namespace |

## Canister API (raw Candid)

| Method | Type | Auth |
|--------|------|------|
| `register_external_canister(req)` | update | Namespace controller |
| `unregister_external_canister(ns, cid)` | update | Namespace controller |
| `get_external_binding(ns)` | query | Anonymous |

## File locations

```
packages/canisters/mcp_registry/src/main.mo          # Canister endpoints
packages/libs/ic-js/src/api/registry.api.ts           # TypeScript wrappers
packages/apps/app-store-cli/src/commands/byoc/        # CLI commands
```
