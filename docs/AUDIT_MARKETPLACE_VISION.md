# Audit Marketplace Vision: Making Prometheus Protocol Universal

## Executive Summary

This document analyzes the current MCP-specific audit pipeline and proposes a path toward a universal, extensible audit marketplace that can serve any canister project while maintaining backward compatibility with MCP servers.

**Current State**: The system is primarily designed for MCP servers with hardcoded audit types and automatic progression.

**Proposed Vision**: Transform into a flexible audit marketplace where any developer can submit any canister for verification, and audits are modular badges that can be earned through manual or automatic triggers.

---

## Core Principle: Universal WASM Verification

### The Simplified Model

**All WASMs are treated the same:**

- Every canister (MCP server, ledger, DAO, game, asset canister) is just a WASM
- All WASMs go through the same universal flow: **build reproducibility only**
- No special treatment, no hardcoded logic, no auto-triggers
- **Audits are optional badges** that WASMs can earn

**MCP Servers are just WASMs with a badge:**

- If a WASM passes `tools_v1` audit → gets "Model Context Protocol" badge
- Details page shows the extracted tools (already implemented)
- No special deployment logic needed
- No different "type" classification needed

### What This Simplifies

**Before (Complex)**:

```
WASM Type → Different verification flows → Different audit requirements → Different deployment
```

**After (Simple)**:

```
WASM → Build reproducibility ✅ → Optional audits (tools_v1, icrc3, etc.) → Badges
```

**Key Insight**: An asset canister is just a backend WASM with a specific hash. The IC doesn't distinguish between "types" of WASMs at the protocol level—they're all just code.

---

## Current System Analysis

### 1. App Manifest Structure (`prometheus.yml`)

**Location**: Created by `app-store-cli init`

**MCP-Specific Fields**:

- `mcp_path`: `/mcp` - The HTTP endpoint for MCP server communication
- Auto-populated in `init.command.ts` line 175 with default value

**Finding**: This field is **only relevant for MCP servers** and creates friction for generic canister projects.

**Current Manifest Structure** (MCP-focused):

```yaml
namespace: com.example.app # Stable app identifier
submission:
  name: 'My App'
  description: '...'
  publisher: '...'
  category: 'Utilities'
  deployment_type: 'global' # or "provisioned"
  repo_url: 'https://github.com/...'
  mcp_path: '/mcp' # ⚠️ Required even for non-MCP WASMs
  git_commit: '<hash>'
  wasm_path: './out/out_Linux_x86_64.wasm'
  # ... other metadata
```

**Problems**:

- `mcp_path` required for ALL WASMs (even ledgers, DAOs, asset canisters)
- `tools_v1` audit auto-triggered for ALL WASMs (not applicable to most)
- No way to opt-out of MCP-specific behavior
- Forces non-MCP projects into an MCP-shaped box

### 2. Release Flow & Bounty Triggering

**Entry Point**: `app-store-cli release <version>`

**Current Workflow**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer: app-store-cli release 1.0.0                  │
│    └─> Updates version, commits, builds WASM                │
│    └─> Publishes to registry (submit_verification_request) │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Registry: Auto-creates build_reproducibility_v1 bounties│
│    └─> 9 bounties @ $0.25 USDC each                        │
│    └─> Adds job to audit_hub queue                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Verifier Bots: Process build verification               │
│    └─> Pull job from audit_hub                              │
│    └─> Rebuild WASM in isolated Docker environment          │
│    └─> File attestation or divergence                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Registry: Detect 5/9 consensus                          │
│    └─> Finalize WASM as #Verified                           │
│    └─> PAY BOUNTIES IMMEDIATELY ✅                           │
│    └─> ⚠️ AUTO-TRIGGER tools_v1 (hardcoded for ALL WASMs)  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Bounty Sponsor: sponsor_bounties_for_wasm(["tools_v1"]) │
│    └─> Creates 9 tools_v1 bounties FOR EVERY WASM          │
│    └─> Adds tools_v1 job to audit_hub                       │
│    └─> Even if WASM isn't an MCP server! ⚠️                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Verifier Bots: Process tools verification               │
│    └─> Try to extract MCP tools from WASM metadata          │
│    └─> Fails for non-MCP WASMs ❌                           │
└─────────────────────────────────────────────────────────────┘
```

**Key Code Location**: `packages/canisters/mcp_registry/src/main.mo` lines 1593-1616

```motoko
// Auto-trigger tools_v1 bounties now that build is verified
// ONLY for build_reproducibility_v1, not for tools_v1 itself
if (audit_type == "build_reproducibility_v1") {
  switch (_bounty_sponsor_canister_id) {
    case (?sponsor_id) {
      ignore sponsor.sponsor_bounties_for_wasm(
        req.wasm_id,
        verification_request.wasm_hash,
        ["tools_v1"],  // ⚠️ HARDCODED - runs for ALL WASMs
        verification_request.repo,
        Base16.encode(verification_request.commit_hash),
        verification_request.metadata,
        REQUIRED_VERIFIERS,
      );
    };
  };
};
```

**The Problem**: This auto-triggers `tools_v1` for every WASM, including ledgers, DAOs, games, and asset canisters where it's not applicable.

### 3. Current Audit Types

**Defined in System**:

1. **`build_reproducibility_v1`** (Universal)
   - ✅ Works for ANY canister
   - Verifies WASM can be rebuilt deterministically
   - Uses ICRC-118 Docker-based reproducible builds
   - Creates trust foundation

2. **`tools_v1`** (MCP-Specific)
   - ⚠️ Only for MCP servers
   - Extracts and validates MCP tool definitions
   - Checks ICRC-118 compliance
   - Auto-triggered after build verification

3. **`app_info_v1`** (Declarative, Universal)
   - Developer-submitted metadata attestation
   - Human verification of app description accuracy
   - Used for security tier calculation

4. **`data_safety_v1`** (Declarative, Universal)
   - Data collection/privacy practices
   - User privacy impact assessment
   - Used for Gold tier achievement

**Security Tier Calculation** (`packages/canisters/mcp_registry/src/AppStore.mo`):

```motoko
// Gold: Verified build + app_info + tools + data_safety
if (is_build_verified and
    has_audit("app_info_v1") and
    has_audit("tools_v1") and      // ⚠️ MCP-SPECIFIC
    has_audit("data_safety_v1")) {
  return #Gold;
};

// Silver: Verified build + app_info + tools
if (is_build_verified and
    has_audit("app_info_v1") and
    has_audit("tools_v1")) {       // ⚠️ MCP-SPECIFIC
  return #Silver;
};

// Bronze: Verified build + app_info
if (is_build_verified and
    has_audit("app_info_v1")) {
  return #Bronze;
};
```

### 4. Extensibility Analysis

**Bounty Sponsor** (`packages/canisters/bounty_sponsor/src/BountySponsor.mo`):

- ✅ Already supports **arbitrary audit types** via parameter
- ✅ Configurable reward amounts per audit type
- ✅ Idempotent (can be called multiple times safely)

**Audit Hub** (`packages/canisters/audit_hub/src/JobQueue.mo`):

- ✅ Uses composite key: `wasm_id::audit_type`
- ✅ Audit type extracted from `build_config` metadata
- ✅ **Completely agnostic to audit type**

**Verifier Bots** (`packages/apps/verifier-bot/src/index.ts`):

- ⚠️ Hardcoded logic for `build_reproducibility_v1` and `tools_v1`
- ⚠️ Would need plugin architecture for new audit types

**ICRC-126 Verification** (`libs/icrc126/`):

- ✅ Audit type is **just a text field** in attestation
- ✅ Framework is completely extensible
- ✅ Standard supports any verification workflow

---

## Problems with Current Design

### 1. **Forced MCP Assumptions for All WASMs**

- `mcp_path` required in manifest even for ledgers, DAOs, games, asset canisters
- Auto-triggering `tools_v1` for every WASM (wastes verifier resources)
- Security tiers require MCP-specific audits to reach Gold/Silver

### 2. **Lack of Developer Choice**

- Developers cannot opt-out of automatic `tools_v1` audit
- Cannot choose which audits to pursue (one-size-fits-all)
- Cannot sponsor custom audit types

### 3. **Waste of Resources**

- Verifier bots spend cycles checking non-MCP WASMs for tools
- Failed `tools_v1` audits for 99% of IC canisters
- Developers confused why their ledger needs MCP tools

### 4. **Limited Ecosystem Adoption**

- Generic IC projects see MCP requirements and leave
- "Why does my token ledger need an MCP path?"
- Missing opportunity for broader ecosystem adoption

---

## Proposed Solution: Audit Marketplace

### Vision

Transform Prometheus Protocol into a **universal WASM verification platform** where:

1. **Any developer** can submit **any WASM** for verification
2. **Build reproducibility is the ONLY automatic step** (universal trust foundation)
3. **ALL other audits are optional badges** developers can sponsor
4. **MCP badge earned by passing tools_v1** (not required for listing)
5. **No special treatment** - every WASM follows the same flow

### Universal Workflow

```
┌─────────────────────────────────────────────┐
│ Developer: app-store-cli release 1.0.0     │
│ └─> ANY WASM (MCP, ledger, DAO, asset...)  │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Registry: build_reproducibility_v1 ONLY    │
│ └─> That's it. No auto-triggers.            │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ After verification: WASM is verified ✅     │
│ └─> Listed on app store                     │
│ └─> Bronze tier available (build + info)   │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Developer: OPTIONAL audit sponsoring       │
│ └─> MCP server? Sponsor tools_v1 audit     │
│ └─> Ledger? Sponsor icrc3_compliance_v1    │
│ └─> DAO? Sponsor sns_compliance_v1         │
│ └─> Pick your badges!                       │
└─────────────────────────────────────────────┘
```

**Result**:

- ✅ Simpler system (one flow for all WASMs)
- ✅ No wasted verifier resources
- ✅ Developer choice and control
- ✅ MCP servers can still get their badge (by choice)
- ✅ Universal adoption across IC ecosystem

### Architecture Changes

#### Phase 1: Simplify to Build-Only Auto-Flow

**A. Update Manifest Schema**

```yaml
namespace: com.example.app
submission:
  # Required fields (universal for ALL WASMs)
  name: 'My App'
  description: '...'
  publisher: '...'
  category: 'Utilities | DeFi | Gaming | MCP Servers | ...'
  repo_url: 'https://github.com/...'
  git_commit: '<hash>'
  wasm_path: './out/out_Linux_x86_64.wasm'

  # REMOVED: mcp_path (not needed in manifest)
  # REMOVED: deployment_type (not part of verification)
  # REMOVED: wasm_type (all WASMs treated same)
```

**Optional** (for MCP servers who want details indexed):

```yaml
submission:
  # ... above fields ...
  mcp_path: '/mcp' # OPTIONAL: Only for UI display/indexing
```

**B. Update `app-store-cli init`**

```typescript
// Simple questions for ALL WASMs
const questions = [
  {
    type: 'text',
    name: 'namespace',
    message: 'Unique namespace (e.g., com.mycompany.app):',
  },
  {
    type: 'text',
    name: 'name',
    message: 'App name:',
  },
  {
    type: 'text',
    name: 'description',
    message: 'Short description:',
  },
  {
    type: 'select',
    name: 'category',
    message: 'Category:',
    choices: [
      'Utilities',
      'DeFi',
      'Gaming',
      'MCP Servers', // Just another category
      'Social',
      'Development',
    ],
  },
  // ... other universal fields
];

// NO special MCP detection or prompts
// If developer wants to note MCP path, they add it manually
```

#### Phase 2: Manual Audit Triggering

**A. Add CLI Commands**

```bash
# List available audit types for a WASM
app-store-cli audits list <wasm-id>

# Example output:
# Available Audits for wasm_abc123:
#  ✅ build_reproducibility_v1 (completed)
#  🎯 tools_v1 - Model Context Protocol Badge ($0.25 x 9 = $2.25)
#  🎯 icrc3_compliance_v1 - ICRC-3 Compliant Badge ($0.50 x 9 = $4.50)
#  🎯 security_audit_v1 - Security Audit Badge ($1.00 x 5 = $5.00)

# Sponsor an audit (developer pays)
app-store-cli audits sponsor <wasm-id> --type tools_v1

# Check audit status
app-store-cli audits status <wasm-id>
```

**B. Update Registry Logic**

Remove ALL hardcoded auto-triggers:

```motoko
// OLD (mcp_registry/src/main.mo line 1593):
if (audit_type == "build_reproducibility_v1") {
  ignore sponsor.sponsor_bounties_for_wasm([...], ["tools_v1"], [...]);
}

// NEW: Nothing auto-triggers except build reproducibility
if (audit_type == "build_reproducibility_v1") {
  // Just finalize. That's it.
  // No auto-triggers, no auto-deploy, nothing.
}

// Developer sponsors audits manually via CLI or UI
```

#### Phase 3: UI-Driven Audit Marketplace

**A. App Store UI Enhancements**

```
┌──────────────────────────────────────────────────────────┐
│ Token Watchlist MCP Server v1.0.0                       │
│                                                          │
│ Security Tier: Silver 🥈                                 │
│                                                          │
│ Verification Status:                                     │
│ ✅ Build Reproducibility (9/9 consensus)                │
│ ✅ App Info Verified                                    │
│ ✅ Model Context Protocol (9/9) 🔧                      │
│                                                          │
│ Available Audits:                                        │
│ 🎯 Data Safety ($0.10 x 9)  [Sponsor Audit →]          │
│ 🎯 Security Review ($1.00 x 5)  [Sponsor Audit →]      │
│                                                          │
│ MCP Tools (from tools_v1 badge):                        │
│  • get_token_price                                       │
│  • subscribe_price_updates                               │
│  • get_market_data                                       │
└──────────────────────────────────────────────────────────┘
```

**vs Generic Ledger:**

```
┌──────────────────────────────────────────────────────────┐
│ ACME Token Ledger v1.0.0                                │
│                                                          │
│ Security Tier: Bronze 🥉                                 │
│                                                          │
│ Verification Status:                                     │
│ ✅ Build Reproducibility (9/9 consensus)                │
│ ✅ App Info Verified                                    │
│                                                          │
│ Available Audits:                                        │
│ 🎯 ICRC-3 Compliance ($0.50 x 9)  [Sponsor Audit →]    │
│ 🎯 Security Review ($1.00 x 5)  [Sponsor Audit →]      │
│                                                          │
│ No MCP Tools badge (not an MCP server)                  │
└──────────────────────────────────────────────────────────┘
```

**Key**: The **only difference** is whether `tools_v1` audit was sponsored and passed. That's what makes it an "MCP Server" vs any other WASM.

**B. Audit Registry Canister**

New canister to track available audit types:

```motoko
type AuditType = {
  id: Text;                    // "icrc3_compliance_v1"
  name: Text;                  // "ICRC-3 Compliance"
  description: Text;
  category: AuditCategory;     // #Protocol | #Security | #MCP | #Custom
  applicable_to: [Text];       // Canister types or ["*"] for all
  verifier_count: Nat;         // Required verifiers
  reward_per_verifier: Nat;    // USDC amount
  verification_script: ?Text;  // URL to verifier script
  is_active: Bool;
};
```

**C. Verifier Bot Plugin System**

```typescript
// New plugin interface
interface AuditPlugin {
  auditType: string;
  canHandle(config: BuildConfig): boolean;
  execute(wasm: Uint8Array, config: BuildConfig): Promise<AttestationData>;
}

// Register plugins
const plugins = [
  new BuildReproducibilityPlugin(),
  new ToolsV1Plugin(),
  new ICRC3CompliancePlugin(), // NEW
  new DataSafetyPlugin(), // NEW
  // Community plugins can be added
];

// Dynamic dispatch
const plugin = plugins.find((p) => p.canHandle(job.build_config));
if (plugin) {
  const result = await plugin.execute(wasm, job.build_config);
  await submitAttestation(result);
}
```

#### Phase 4: Extensible Audit Types

**Example: ICRC-3 Compliance Audit**

```typescript
class ICRC3CompliancePlugin implements AuditPlugin {
  auditType = 'icrc3_compliance_v1';

  canHandle(config: BuildConfig): boolean {
    return config.get('audit_type') === this.auditType;
  }

  async execute(
    wasm: Uint8Array,
    config: BuildConfig,
  ): Promise<AttestationData> {
    // 1. Deploy canister to local replica
    const canisterId = await deployWasmLocally(wasm);

    // 2. Test ICRC-3 endpoints
    const tests = [
      testGetBlocks(canisterId),
      testGetArchives(canisterId),
      testGetDataCertificate(canisterId),
      testBlockSchema(canisterId),
      // ... more tests
    ];

    const results = await Promise.all(tests);
    const passed = results.every((r) => r.success);

    // 3. Generate attestation
    return {
      audit_type: this.auditType,
      result: passed ? '#Pass' : '#Fail',
      evidence: {
        test_results: results,
        timestamp: Date.now(),
        spec_version: '1.0.0',
      },
    };
  }
}
```

#### Phase 5: Community-Driven Audit Submissions

Allow developers to propose and fund new audit types:

```bash
# Create audit type proposal
app-store-cli audits propose \
  --name "ICRC-7 NFT Compliance" \
  --description "Validates ICRC-7 standard compliance" \
  --verifier-script https://github.com/user/icrc7-verifier \
  --reward 0.50 \
  --required-verifiers 5

# Fund the audit type
app-store-cli audits fund icrc7_compliance_v1 --amount 10.00

# Community can vote to activate
```

---

## Migration Path

### Backward Compatibility Strategy

**Goal**: Existing MCP servers continue working with zero changes.

**Detection Logic**:

```motoko
// In mcp_registry verification consensus handler

// 1. Check if wasm_type is explicitly set
let wasm_type = AppStore.getICRC16Text(metadata, "wasm_type");

// 2. If not set, use legacy detection
let is_legacy_mcp = if (wasm_type == "") {
  // Legacy detection: has mcp_path = is MCP server
  let mcp_path = AppStore.getICRC16Text(metadata, "mcp_path");
  mcp_path != ""
} else {
  wasm_type == "mcp_server"
};

// 3. Get auto_audits (with legacy default)
let auto_audits_config = AppStore.getICRC16TextArray(metadata, "auto_audits");
let auto_audits = if (auto_audits_config.size() == 0 and is_legacy_mcp) {
  ["tools_v1"]  // Legacy default for MCP servers
} else {
  auto_audits_config
};

// 4. Get auto_deploy setting (with legacy default)
let auto_deploy_text = AppStore.getICRC16Text(metadata, "auto_deploy");
let auto_deploy = if (auto_deploy_text == "") {
  is_legacy_mcp  // Legacy: MCP servers auto-deployed
} else {
  auto_deploy_text == "true"
};

// 5. Apply logic
if (audit_type == "build_reproducibility_v1") {
  // Auto-trigger configured audits
  if (auto_audits.size() > 0) {
    ignore sponsor.sponsor_bounties_for_wasm([...], auto_audits, [...]);
  };

  // Auto-deploy if configured
  if (auto_deploy) {
    let deployment_type = AppStore.getICRC16Text(metadata, "deployment_type");
    if (deployment_type == "global") {
      await orchestrator.deploy_verified_wasm(namespace, wasm_hash);
    };
  };
};
```

**Migration Examples**:

**Legacy Manifest** (still works):

```yaml
namespace: com.example.mcp-server
submission:
  # ... no wasm_type field
  mcp_path: /mcp # Detected as legacy MCP server
  deployment_type: global
```

→ System infers: `wasm_type=mcp_server`, `auto_audits=["tools_v1"]`, `auto_deploy=true`

**Modern Manifest** (explicit control):

```yaml
namespace: com.example.mcp-server
submission:
  wasm_type: mcp_server
  mcp_config:
    enabled: true
    path: /mcp
    deployment_type: global
    auto_deploy: true
    auto_audits: ['tools_v1']
```

→ System uses explicit values

### Rollout Phases

**Phase 1** (Month 1): Foundation & WASM Types

- Add `wasm_type` field to manifest schema
- Make MCP-specific fields optional and grouped under `mcp_config`
- Add `auto_deploy` and `auto_audits` explicit controls
- Update CLI to detect project type (MCP server, backend, asset)
- Implement backward compatibility logic for legacy manifests
- Update registry to respect `wasm_type` for deployment decisions

**Phase 2** (Month 2): Manual Triggers & Backend Support

- Add `app-store-cli audits` commands
- UI for manual audit triggering
- Support backend canisters (no auto-deploy)
- Documentation and examples for all three WASM types
- Category-based security tier calculation

**Phase 3** (Month 3): Audit Registry & Plugins

- Deploy audit registry canister
- Community audit type proposals
- Verifier bot plugin architecture
- Domain-specific audits (ICRC-3, ICRC-7, security, etc.)

**Phase 4** (Month 4): Asset Canisters & Launch

- Asset canister verification support
- Content hash verification (alternative to WASM build reproducibility)
- Frontend-specific audits (UI security, accessibility)
- Marketing to broader IC ecosystem
- Community bounties for new audit types

---

## Example Use Cases

### Use Case 1: Generic Token Ledger

**Project**: Custom ICRC-2 ledger implementation

**Workflow**:

```bash
# Init as backend canister (not MCP)
app-store-cli init
# Select: "Backend Canister"
# No MCP-specific questions asked

# Release with build verification only
app-store-cli release 1.0.0
# Build verified, but NO auto-deploy (developer controls deployment)

# Developer deploys manually to their canister ID
dfx deploy icrc2_ledger --argument '(record { minting_account = ... })'

# After build verification, optionally add compliance audit
app-store-cli audits create <wasm-id> --type icrc2_compliance_v1 --sponsor

# Achieve Bronze tier (build + app_info)
# ICRC-2 badge shown on app store UI
```

**Result**:

- Generic IC projects can participate without MCP friction
- Developer maintains full control over deployment
- Can still earn verification badges and security tiers

### Use Case 2: MCP Server (Backward Compatible)

**Project**: Existing MCP server

**Workflow**:

```bash
# Legacy manifest (minimal changes)
wasm_type: mcp_server  # NEW: Explicit type
mcp_config:
  enabled: true
  path: /mcp
  deployment_type: global
  auto_deploy: true  # NEW: Maintains current behavior
  auto_audits: ["tools_v1"]  # NEW: Explicit (was implicit)

# Release command unchanged
app-store-cli release 1.0.0

# tools_v1 still auto-triggers (configured behavior)
# Global instance still auto-deploys (configured behavior)
# Can still achieve Gold tier
```

**Result**:

- Zero breaking changes for existing projects
- Can opt-out of auto-deploy if desired (set auto_deploy: false)
- Can control which audits auto-trigger

### Use Case 3: Asset Canister (Future)

**Project**: React-based DeFi frontend

**Workflow**:

```bash
# Init as asset canister
app-store-cli init
# Select: "Asset Canister (frontend/static site)"

# Different build process (bundles assets, not WASM)
app-store-cli build --type asset
# Generates content hash instead of WASM hash

# Release uses content verification (not build reproducibility)
app-store-cli release 1.0.0
# Verifies: content hash, no malicious code, accessibility

# Optional audits
app-store-cli audits create <asset-id> --type ui_security_v1
app-store-cli audits create <asset-id> --type accessibility_v1
```

**Result**:

- Frontend projects can participate with appropriate verification
- Different verification model (content vs. WASM)
- Suitable audits for asset canisters

---

### Use Case 4: Provisioned MCP Server

**Project**: Wallet app requiring dedicated instance per user

**Workflow**:

```bash
# Init as provisioned MCP server
app-store-cli init
# Select: "MCP Server"
# Choose: "Provisioned - Dedicated per user"

# Release
app-store-cli release 1.0.0
# Build verified, tools_v1 runs, but NO auto-deploy

# User requests their instance from UI
# UI calls: orchestrator.provision_my_instance("com.acme.wallet")
# User gets dedicated canister with their own principal

# Each user's instance is isolated
# Higher cost, higher security
```

**Result**:

- Supports wallet/custody use cases
- User controls their canister
- On-demand provisioning, not automatic

---

### Use Case 5: Custom Audit Type

**Project**: DAO governance canister

**Workflow**:

```bash
# Developer creates custom audit
app-store-cli audits propose \
  --name "SNS DAO Compliance" \
  --verifier-script https://github.com/org/sns-verifier \
  --reward 1.00 \
  --required-verifiers 5

# Fund the audit
app-store-cli audits fund sns_dao_compliance_v1 --amount 50.00

# After activation, use it
app-store-cli audits create <wasm-id> --type sns_dao_compliance_v1
```

**Result**: Ecosystem can create domain-specific audits.

---

## Security Tier Reimagining

### Current Problem

Security tiers hardcode MCP-specific audits (tools_v1), making non-MCP projects unable to reach Silver/Gold.

### Proposed Solution: Audit Count Based Tiers (Universal)

```motoko
// Simple, universal tier calculation
public func calculate_security_tier(
  is_build_verified: Bool,
  completed_audits: [Text],  // Any audits (tools_v1, icrc3, security, etc.)
): SecurityTier {

  // Foundation
  if (not is_build_verified) { return #Unranked };
  if (not has_audit("app_info_v1")) { return #Unranked };

  // Count ANY audits beyond build + app_info
  let additional_audits = Buffer.Buffer<Text>(0);
  for (audit in completed_audits.vals()) {
    if (audit != "build_reproducibility_v1" and audit != "app_info_v1") {
      additional_audits.add(audit);
    };
  };

  // Universal tiers
  let count = additional_audits.size();
  if (count >= 2) { return #Gold };   // e.g., tools_v1 + data_safety OR icrc3 + security
  if (count >= 1) { return #Silver };  // e.g., tools_v1 OR icrc3 OR security
  return #Bronze;  // build + app_info only
};
```

**Benefits**:

- ✅ Fair across ALL WASMs (MCP, ledger, DAO, game, asset)
- ✅ MCP servers: tools_v1 + data_safety = Gold (same as before)
- ✅ Ledgers: icrc3 + security = Gold (new path!)
- ✅ DAOs: sns_compliance + security = Gold (new path!)
- ✅ Encourages developers to earn relevant badges

---

## Developer Experience Comparison

### Before (MCP-Only)

```bash
# Must be MCP server
app-store-cli init
# Required: mcp_path

app-store-cli release 1.0.0
# Auto: build_reproducibility_v1
# Auto: tools_v1 (no choice)

# Can only achieve tiers with MCP audits
# Generic projects excluded
```

### After (Universal)

```bash
# Works for ANY canister
app-store-cli init
# Optional: MCP config only if detected

app-store-cli release 1.0.0
# Auto: build_reproducibility_v1
# Auto: optional audits from manifest

# Choose your audits
app-store-cli audits create <wasm-id> --type icrc3_compliance_v1

# Flexible tier paths for all project types
```

---

## Technical Implementation Checklist

### Registry Canister Updates

- [ ] Add `wasm_type` field to metadata schema
- [ ] Make `mcp_path` optional in metadata validation
- [ ] Add `auto_deploy` boolean field support
- [ ] Add `auto_audits` array field support
- [ ] Update auto-trigger logic with backward compatibility
- [ ] Update auto-deploy logic to check `wasm_type` and `auto_deploy`
- [ ] Implement category-based tier calculation
- [ ] Add legacy manifest detection logic

### Orchestrator Canister Updates

- [ ] Respect `auto_deploy` flag (don't auto-deploy backends)
- [ ] Add manual deployment endpoint for backend canisters
- [ ] Update deployment type tracking per WASM type
- [ ] Support asset canister deployment (future)

### Bounty Sponsor Updates

- [ ] Already supports arbitrary audit types ✅
- [ ] Add public `sponsor_bounties_for_wasm` endpoint for manual triggers
- [ ] Add audit type registry integration

### Audit Hub Updates

- [ ] Already audit-type agnostic ✅
- [ ] Add endpoint to list available audits
- [ ] Add audit completion tracking

### CLI Updates

- [ ] Add WASM type detection in `init` command
- [ ] Update `init` prompts to be conditional based on type
- [ ] Make MCP prompts only show for MCP servers
- [ ] Add asset canister initialization support
- [ ] Add `audits` command group:
  - `audits list`
  - `audits create`
  - `audits status`
- [ ] Add deployment control flags to `release` command

### UI Updates

- [ ] Add "Available Audits" section to app details
- [ ] Add "Run Audit" buttons for manual triggers
- [ ] Show audit badges by category
- [ ] Update tier display to be category-aware
- [ ] Filter apps by WASM type
- [ ] Show deployment model (global/provisioned/manual) clearly

### Verifier Bot Updates

- [ ] Implement plugin architecture
- [ ] Extract existing logic into plugins:
  - `BuildReproducibilityPlugin`
  - `ToolsV1Plugin`
- [ ] Add plugin discovery mechanism
- [ ] Add ICRC compliance plugins (ICRC-3, ICRC-7, etc.)
- [ ] Add security audit plugin
- [ ] Document plugin interface for community

### New Canisters

- [ ] Audit Registry canister (stores audit type definitions)
- [ ] Community governance for audit proposals
- [ ] Asset verification service (content hash validation)

### Documentation

- [ ] Update publishing guide with WASM types
- [ ] Backend canister developer guide
- [ ] Asset canister developer guide
- [ ] MCP server migration guide (legacy → explicit)
- [ ] Community audit plugin developer guide

---

## Success Metrics

### Adoption Metrics

- Number of non-MCP projects using verification
- Number of custom audit types created
- Growth in total verified WASMs

### Quality Metrics

- Audit completion rate by type
- Verifier participation rate
- False positive/negative rates

### Community Metrics

- Community-contributed audit types
- Verifier bot plugins published
- Developer satisfaction scores

---

## Risks and Mitigations

### Risk 1: Breaking Existing MCP Servers

**Mitigation**: Comprehensive backward compatibility layer, extensive testing, gradual rollout

### Risk 2: Audit Quality Control

**Mitigation**: Governance system for audit type approval, reputation system for verifiers

### Risk 3: Spam Audit Types

**Mitigation**: Require funding, community voting, quality standards

### Risk 4: Verifier Bot Complexity

**Mitigation**: Clear plugin interface, examples, community support

---

---

## Conclusion: The Elegant Simplification

The current Prometheus Protocol verification system is **architecturally sound** but **over-complicated with MCP assumptions**. The key insight: **all WASMs are just WASMs**.

### The Simplified Vision

**One Universal Flow**:

1. All WASMs → Build reproducibility verification (automatic)
2. All WASMs → Listed after verification
3. Developers choose badges → Sponsor relevant audits (manual)

**MCP is just a badge**:

- MCP servers earn 🔧 badge by passing `tools_v1` audit
- Ledgers earn badges by passing ICRC compliance audits
- DAOs earn badges by passing governance audits
- All equal citizens in the ecosystem

### Required Changes

1. **Remove hardcoded `tools_v1` auto-trigger** (single line change!)
2. **Remove `mcp_path` requirement** from manifest
3. **Add manual audit sponsoring** via CLI/UI
4. **Update security tiers** to count ANY audits (not just tools_v1)

### Benefits

✅ **Simpler** - One flow for all WASMs, no special cases  
✅ **Universal** - Any IC project can participate  
✅ **Efficient** - No wasted verifier resources on non-MCP WASMs  
✅ **Flexible** - Developers choose relevant badges  
✅ **Scalable** - Easy to add new audit types

### Migration Path

**Phase 1**: Remove auto-trigger (1 week)

- Delete lines 1593-1616 in `mcp_registry/src/main.mo`
- Make `mcp_path` optional in manifest schema
- Deploy updated registry

**Phase 2**: Add manual sponsoring (2 weeks)

- Add `app-store-cli audits sponsor` command
- Add UI buttons for audit sponsoring
- Documentation

**Phase 3**: Universal tiers (1 week)

- Update tier calculation to count any audits
- Update UI to show all badges equally

**Total**: ~4 weeks to transform into universal platform

The technical foundation is already in place—we just need to **remove the artificial MCP constraint** and treat all WASMs equally.

---

## Next Steps

1. **Review this document** with stakeholders
2. **Prioritize phases** based on community needs
3. **Create detailed implementation plan** for Phase 1
4. **Begin development** with backward compatibility testing
5. **Launch beta** with selected non-MCP projects
6. **Iterate and expand** based on feedback

## Appendix A: Code References

### Key Files to Modify

**CLI**:

- `packages/apps/app-store-cli/src/commands/init.command.ts` (lines 175)
- `packages/apps/app-store-cli/src/commands/release.command.ts`
- Add: `packages/apps/app-store-cli/src/commands/audits/*`

**Registry**:

- `packages/canisters/mcp_registry/src/main.mo` (lines 1593-1616)
- `packages/canisters/mcp_registry/src/AppStore.mo` (lines 263, 293-314)

**Bounty Sponsor**:

- Already extensible ✅

**Audit Hub**:

- Already extensible ✅

**Verifier Bots**:

- `packages/apps/verifier-bot/src/index.ts` (lines 174-231)

### Standards to Reference

- ICRC-118: Reproducible Builds
- ICRC-126: Verification Standard
- ICRC-127: Bounty Standard
