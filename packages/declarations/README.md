# @prometheus-protocol/declarations

Auto-generated Candid interface declarations (TypeScript bindings + IDL factories) for every Prometheus Protocol canister. These are the IDL bindings that `@prometheus-protocol/ic-js`, the App Store CLI, and the web frontends use to talk to mainnet and local-replica canisters.

## What's in the box

Each subpath exports the declarations for one canister:

| Canister            | Subpath                                |
| ------------------- | -------------------------------------- |
| App Bounties        | `@prometheus-protocol/declarations/app_bounties` |
| Audit Hub           | `@prometheus-protocol/declarations/audit_hub`    |
| Auth Server         | `@prometheus-protocol/declarations/auth_server`  |
| Bounty Sponsor      | `@prometheus-protocol/declarations/bounty_sponsor` |
| EXT (NFT)           | `@prometheus-protocol/declarations/ext`          |
| ICRC-1 Ledger       | `@prometheus-protocol/declarations/icrc1_ledger` |
| Leaderboard         | `@prometheus-protocol/declarations/leaderboard`  |
| MCP Orchestrator    | `@prometheus-protocol/declarations/mcp_orchestrator` |
| MCP Registry        | `@prometheus-protocol/declarations/mcp_registry` |
| MCP Server          | `@prometheus-protocol/declarations/mcp_server`   |
| Search Index        | `@prometheus-protocol/declarations/search_index` |
| Token Watchlist     | `@prometheus-protocol/declarations/token_watchlist` |
| Usage Tracker       | `@prometheus-protocol/declarations/usage_tracker` |

Each export provides:

- `idlFactory` — Candid IDL factory for `Actor.createActor(...)`
- `_SERVICE` — TypeScript interface for the canister's method signatures
- All argument / result types exported as named types

## Installation

```bash
pnpm add @prometheus-protocol/declarations
# or
npm install @prometheus-protocol/declarations
```

You rarely depend on this package directly — use `@prometheus-protocol/ic-js` for high-level API calls. This package is the raw IDL layer underneath.

## Usage

```ts
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { idlFactory, _SERVICE } from '@prometheus-protocol/declarations/mcp_registry';

const agent = HttpAgent.createSync({ host: 'https://icp-api.io' });
const registry = Actor.createActor<_SERVICE>(idlFactory, {
  agent,
  canisterId: 'grhdx-gqaaa-aaaai-q32va-cai',
});

const apps = await registry.icrc118_get_canister_types({ /* ... */ });
```

## Regenerating declarations

Declarations are generated from the `.did` files of each Motoko canister. After modifying a canister's public interface:

```bash
# From the repo root
dfx generate <canister_name>

# Then rebuild the package
pnpm --filter @prometheus-protocol/declarations build
```

The generated TypeScript ends up in `src/generated/<canister>/` and is committed to source control alongside this package.

## License

MIT. See the repo root for the full license.
