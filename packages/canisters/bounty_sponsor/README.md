# Bounty Sponsor Canister

The `bounty_sponsor` canister is responsible for funding verification bounties in a decoupled, idempotent manner. This separation of concerns improves the system architecture by:

1. **Decoupling**: Verification requests are separate from bounty funding
2. **Idempotency**: Safe to call multiple times - won't double-fund
3. **Dedicated Management**: Independent USDC balance and configuration
4. **Flexibility**: Can sponsor bounties on-demand or programmatically

## Architecture

```
┌─────────────────────┐
│  Verification       │
│  Request            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌──────────────────┐
│  mcp_registry       │      │ bounty_sponsor   │
│  (ICRC-126/127)     │◄─────┤ (Funding)        │
└──────────┬──────────┘      └──────────────────┘
           │                         │
           │                         ├─ Tracks sponsored bounties
           │                         ├─ Idempotent funding
           ▼                         └─ USDC balance management
┌─────────────────────┐
│  audit_hub          │
│  (Job Queue)        │
└─────────────────────┘
```

## Workflow

1. **Verification Request**: Submit WASM to `mcp_registry.icrc126_verification_request()`
2. **Sponsor Bounties**: Call `bounty_sponsor.sponsor_bounties_for_wasm(wasm_id, wasm_hash)`
3. **Job Creation**: Bounties automatically added to audit_hub job queue
4. **Verification**: Verifier bots pick up jobs and complete audits

## Features

### Multi-Audit Type Support

Creates bounties for **both** audit types per WASM:

- `build_reproducibility_v1` (9 bounties)
- `tools_v1` (9 bounties)
- **Total: 18 bounties per WASM**

### Idempotent Funding

- Tracks all sponsored bounties in persistent storage
- Safe to call multiple times - returns existing bounty IDs if already sponsored
- Prevents accidental double-funding

### Independent Configuration

- Dedicated USDC balance for bounty rewards
- Configurable reward amount per bounty
- Registry canister reference for bounty creation
- Owner-controlled settings

## Setup

### 1. Deploy Canister

```bash
dfx deploy bounty_sponsor
```

### 2. Configure Registry

```bash
# Set the mcp_registry canister ID
dfx canister call bounty_sponsor set_registry_canister_id '(principal "YOUR_REGISTRY_ID")'

# Set the USDC ledger canister ID
dfx canister call bounty_sponsor set_reward_token_canister_id '(principal "YOUR_USDC_LEDGER_ID")'

# Set reward amount (default: 250_000 = $0.25 USDC with 6 decimals)
dfx canister call bounty_sponsor set_reward_amount '(250_000 : nat)'
```

### 3. Fund the Canister

Transfer USDC to the bounty_sponsor canister so it can fund bounties:

```bash
# Calculate required USDC: 18 bounties × $0.25 = $4.50 per WASM
# For 100 WASMs: $450 USDC = 450_000_000 (with 6 decimals)

dfx canister call usdc_ledger icrc1_transfer '(record {
  to = record { owner = principal "BOUNTY_SPONSOR_CANISTER_ID" };
  amount = 450_000_000 : nat;
})'
```

## Usage

### Sponsor Bounties for a WASM

```bash
# After submitting verification request, sponsor the bounties
dfx canister call bounty_sponsor sponsor_bounties_for_wasm '(
  "ABC123...",  // wasm_id (hex string of hash)
  blob "..."     // wasm_hash (blob)
)'

# Response:
# variant {
#   Ok = record {
#     bounty_ids = vec { 1; 2; 3; ... 18 };
#     total_sponsored = 18;
#   }
# }
```

### Check if WASM is Sponsored

```bash
dfx canister call bounty_sponsor is_wasm_sponsored '("ABC123...")'
# Returns: (true)
```

### Get Bounty IDs for WASM

```bash
dfx canister call bounty_sponsor get_sponsored_bounties_for_wasm '("ABC123...")'
# Returns: vec { 1; 2; 3; ... 18 }
```

### Get Bounty Info

```bash
dfx canister call bounty_sponsor get_bounty_info '(1 : nat)'
# Returns: opt record {
#   wasm_id = "ABC123...";
#   audit_type = "build_reproducibility_v1";
#   timestamp = 1699564800000000000;
# }
```

### View Configuration

```bash
dfx canister call bounty_sponsor get_config '()'
# Returns: record {
#   registry_canister_id = opt principal "...";
#   reward_token_canister_id = opt principal "...";
#   reward_amount_per_bounty = 250_000;
#   required_verifiers = 9;
#   audit_types = vec { "build_reproducibility_v1"; "tools_v1" };
# }
```

## Integration Example

### Complete Flow

```bash
# 1. Submit verification request
WASM_HASH=$(cat wasm.wasm | sha256sum | cut -d' ' -f1)
dfx canister call mcp_registry icrc126_verification_request '(
  record {
    wasm_hash = blob "'$WASM_HASH'";
    repo = "https://github.com/user/repo";
    commit_hash = blob "...";
    metadata = vec {
      ("audit_type", variant { Text = "build_reproducibility_v1" });
    };
  }
)'

# 2. Sponsor bounties (creates 18 bounties + adds to job queue)
dfx canister call bounty_sponsor sponsor_bounties_for_wasm "(
  \"$WASM_HASH\",
  blob \"$WASM_HASH\"
)"

# 3. Verifier bots automatically pick up jobs from audit_hub
# 4. Monitor progress via mcp_registry queries
```

### Automation Script

```typescript
import { bounty_sponsor } from '@prometheus-protocol/declarations';

async function sponsorVerification(wasmId: string, wasmHash: Uint8Array) {
  // Check if already sponsored
  const isSponsored = await bounty_sponsor.is_wasm_sponsored(wasmId);
  if (isSponsored) {
    console.log('Already sponsored:', wasmId);
    return;
  }

  // Sponsor bounties
  const result = await bounty_sponsor.sponsor_bounties_for_wasm(
    wasmId,
    wasmHash,
  );

  if ('Ok' in result) {
    console.log(
      `Sponsored ${result.Ok.total_sponsored} bounties for ${wasmId}`,
    );
    console.log('Bounty IDs:', result.Ok.bounty_ids);
  } else {
    console.error('Error:', result.Err);
  }
}
```

## Error Handling

### Common Errors

1. **"Registry canister ID not configured"**
   - Solution: Call `set_registry_canister_id()`

2. **"Reward token canister ID not configured"**
   - Solution: Call `set_reward_token_canister_id()`

3. **"Insufficient funds"** (during bounty creation)
   - Solution: Transfer more USDC to the bounty_sponsor canister

4. **"Unauthorized"**
   - Solution: Ensure you're calling admin functions from the owner principal

## Monitoring

### Check Total Sponsored Bounties

```bash
dfx canister call bounty_sponsor get_total_sponsored_bounties '()'
# Returns: 360  (example: 20 WASMs × 18 bounties each)
```

### Audit USDC Balance

```bash
dfx canister call usdc_ledger icrc1_balance_of '(
  record { owner = principal "BOUNTY_SPONSOR_CANISTER_ID" }
)'
```

## Security

- **Owner-only admin functions**: Only the canister owner can modify configuration
- **Idempotent funding**: Prevents accidental double-spending
- **Transfer ownership**: Owner can transfer control to another principal
- **Persistent state**: All sponsorship records survive upgrades

## Testing

### Run Tests

```bash
# Run all bounty_sponsor tests
pnpm test:pic packages/canisters/bounty_sponsor

# Run with coverage
pnpm test:pic packages/canisters/bounty_sponsor --coverage

# Run specific test suite
pnpm test:pic packages/canisters/bounty_sponsor -t "Configuration Management"
```

### Test Coverage

The test suite covers:

1. **Configuration Management** - Setting registry, reward token, and reward amounts
2. **Ownership Management** - Transfer ownership and access control
3. **Bounty Sponsorship** - Core functionality with idempotency and multi-audit type support
4. **Query Functions** - All read-only query methods
5. **Environment Requirements** - Automated configuration standard
6. **USDC Balance Management** - Funding and spending verification
7. **Multi-WASM Sponsorship** - Independent tracking of multiple WASMs

### Test Architecture

The test suite uses PocketIC for isolated canister testing:

- **3 Canisters Deployed**: bounty_sponsor, mcp_registry, usdc_ledger
- **Test Identities**: owner, sponsor, random user
- **Full ICRC-1 Integration**: Real USDC ledger transfers and balance checks
- **Idempotency Testing**: Ensures safe repeated calls
- **Error Cases**: Validates all error conditions

## Future Enhancements

- [ ] Configurable audit types (currently hardcoded)
- [ ] Variable verifier counts (currently 9 per type)
- [ ] Automatic refunding of expired bounties
- [ ] USDC balance monitoring and alerts
- [ ] Batch sponsorship for multiple WASMs
- [ ] Integration with auto-verification on WASM publication
