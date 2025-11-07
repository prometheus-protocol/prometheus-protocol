# Decentralized Verifiable Builds: Automating Trust in the MCP Ecosystem

## The Problem: "Trust Me Bro" Doesn't Scale

When you install software that has access to your data, your AI agents, or your systems, you're making a trust decision. But when that software can **move money, manage crypto assets, and execute cross-chain transactions on behalf of your AI agents**, the stakes become existential.

In traditional software distribution, trust comes from:

- **Brand reputation**: "I trust Microsoft/Apple/Google"
- **App store gatekeepers**: "Apple reviewed it, so it must be safe"
- **Social proof**: "It has 10,000 downloads and 4.5 stars"

But in the world of Model Context Protocol (MCP) servers - **AI tools that manage token allowances, control canister-held funds, and execute cross-chain transactions** - **none of these trust signals work**:

- Most MCP servers are from individual developers or small teams
- There's no centralized app store with review processes for financial tools
- Open source doesn't help if users can't verify that the published binary matches the source code
- "Just read the code" isn't realistic for users managing economic agents
- **A single malicious line in a deployed binary could drain allowances or canister-held funds**

The fundamental problem: **How do you know the deployed code matches the source code when your AI agent's financial capabilities are on the line?**

### The Economic Agent Reality

MCP servers aren't just reading files - they're managing real economic value:

- **Token allowances**: Users grant canisters permission to manage substantial token allowances on their behalf
- **Cross-chain operations**: Tools that bridge assets between Ethereum, Solana, Bitcoin, and Internet Computer
- **DeFi interactions**: Agents that can trade, provide liquidity, or manage yield strategies
- **Canister-held funds**: Users deposit funds into canisters for investment, trading, or treasury management
- **Autonomous treasury management**: AI agents managing protocol treasuries worth millions

**Example scenario**: You install an MCP server that lets your AI agent manage a $100k USDC investment fund. You approve a 100k allowance, which the canister pulls into the user's investment account. The source code on GitHub looks clean - it shows proper investment logic and safeguards. But what if the deployed binary has one extra line that drains your investment account to an attacker's address? On the Internet Computer, private keys are secured via WebAuthn or canister-controlled keys, but **the canister code determines where your deposited funds and allowances go**.

**The risk**: Every user who installs an unverified MCP server with economic capabilities is trusting that the deployed code matches the audited source. Without verifiable builds, a malicious developer could drain allowances and canister-held funds through code that was never in the public repository.

**The risk**: Every user who installs an unverified MCP server with economic capabilities is essentially saying "here are my funds, please don't steal them." This doesn't scale for an open agent economy.

### Why Reproducible Builds Alone Aren't Enough

The crypto and blockchain communities solved the technical challenge of reproducible builds years ago. If you compile the same source code with the same tools in the same environment, you get byte-for-byte identical binaries. This makes verification possible in theory.

But in practice, **nobody actually verifies them**. Why?

1. **It's specialized work**: You need to know Docker, understand build systems, and debug environment issues
2. **It's time-consuming**: Each verification takes 30 minutes to several hours
3. **There's no incentive**: Why would anyone spend their time verifying someone else's code for free?
4. **It's tedious**: Clone repo, set up environment, run build, compare hashes, document results...

The result? Reproducible builds exist as a checkbox feature that gives a false sense of security. The infrastructure is there, but the human incentive structure isn't.

**What we need is automation + incentives**.

## Our Solution: Fully Automated Verifiable Builds

Prometheus Protocol takes the concept of "automating the review process through a smart contract" to its logical conclusion. We've created a **fully automated, decentralized verification network** where:

1. **Developers publish their code** to the registry
2. **Automated verifier bots** perform reproducible builds 24/7
3. **Smart contracts enforce** cryptographic verification
4. **Multiple independent verifiers** file attestations for consensus
5. **Rewards are distributed automatically** when verification completes

**There is no manual process.** Everything from build verification to reward distribution happens automatically through smart contracts and Docker-based reproducible builds.

### Built on Internet Computer Standards

Prometheus Protocol leverages and extends several emerging Internet Computer standards:

- **[ICRC-118: Wasm Registry](https://github.com/dfinity/ICRC/issues/118)** - Standardized WebAssembly module version control and history tracking with immutable audit trails
- **[ICRC-120: Canister Orchestration](https://github.com/dfinity/ICRC/issues/120)** - Automated canister lifecycle management including installation, upgrades, snapshots, and rollbacks
- **[ICRC-126: Wasm Verification](https://forum.dfinity.org/t/icrc-126-wasm-verification/42592)** - Attestation system for build reproducibility verification
- **[ICRC-127: Generic Bounty System](https://forum.dfinity.org/t/icrc-127-generic-bounty-system/42594)** - Economic incentive layer for verification work

These standards provide the foundation for a **trustless, automated verification ecosystem** that works across any Internet Computer application.

### How It Works

#### 1. **Developer Submission with Automated Verification Request**

When an MCP server developer publishes a new version, they submit through the **ICRC-118 Wasm Registry**:

```motoko
// ICRC-118: Version-controlled WASM registry with history tracking
public shared(msg) func icrc118_update_wasm(
  caller: Principal,
  req: UpdateWasmRequest
) : async* UpdateWasmResult {
  // UpdateWasmRequest contains:
  // - canister_type_namespace: Text
  // - version_number: (Nat, Nat, Nat)  // major.minor.patch
  // - description: Text
  // - repo: Text
  // - metadata: ICRC16Map
  // - previous: ?CanisterVersion
  // - expected_hash: Blob
  // - expected_chunks: [Blob]  // Hashes of each WASM chunk

  // Verify caller is a controller
  let ct = BTree.get(state.canister_types, Text.compare, req.canister_type_namespace);
  switch ct {
    case(null) { return #Error(#Generic("Not Found")); };
    case (?rec) {
      if (not ListContains(rec.controllers, caller)) return #Error(#Unauthorized);

      // Store WASM metadata in registry
      let wasmRecord : WasmRecord = {
        var calculated_hash = null;
        expected_hash = req.expected_hash;
        description = req.description;
        repo = req.repo;
        metadata = req.metadata;
        version_number = req.version_number;
        previous = req.previous;
        var deprecated = false;
        canister_type_namespace = req.canister_type_namespace;
        var chunks = [];
        expected_chunks = req.expected_chunks;
        var validated = false;
        created = natNow();
      };

      updateWasm(null, wasmRecord);

      // WASM is now registered in the system
      // Next step: Developer creates a bounty (ICRC-127) to sponsor verification
      // Once bounty exists, verifier bots will discover it via list_pending_verifications()

      return #Ok(transaction_id);
    };
  };
};
```

**Key points about ICRC-118 registration:**

- Developer calls `icrc118_update_wasm()` with repo URL, version number, and expected WASM hash
- The WASM metadata is stored in the registry with `validated = false` initially
- Developer then uploads WASM chunks via `icrc118_upload_wasm_chunk()` (see ICRC-118 spec for chunking details)
- Once all chunks are uploaded and validated, the WASM is registered in the system

**Next step: Bounty Creation (ICRC-127)**

After registering the WASM, a verification bounty is created to incentivize independent verifiers. In the Prometheus Protocol MCP App Store, **we require multiple independent verifications** (9 verifiers) with **majority consensus** for maximum security:

```typescript
// Prometheus Protocol creates multiple bounties for each MCP server
// Each bounty can be claimed by one verifier
// Majority consensus (5 of 9) determines final verification status
const TOTAL_VERIFIERS = 9;
const COST_PER_VERIFICATION = 250_000n; // $0.25 USDC per verification

for (let i = 0; i < TOTAL_VERIFIERS; i++) {
  await createBounty(identity, {
    wasm_id: wasmHash,
    audit_type: 'build_reproducibility_v1',
    amount: COST_PER_VERIFICATION,
    token: {
      canisterId: USDC_LEDGER_CANISTER_ID,
      standard: 'ICRC2',
    },
    timeout_date: BigInt(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    validation_canister_id: AUDIT_HUB_CANISTER_ID,
  });
}

// This creates 9 separate bounties, each claimable by a different verifier
// Total cost: 9 × $0.25 = $2.25 per verification
// Affordable enough for frequent updates and bug fixes!
```

**Why majority consensus with multiple verifiers?**

- **Byzantine fault tolerance**: Even if minority of verifiers are malicious/incorrect, the majority consensus ensures correctness
- **No single point of failure**: One or two compromised verifiers cannot approve a malicious WASM
- **Higher confidence**: Majority of 9 independent parties agreeing on the same build hash provides strong cryptographic assurance
- **Resilience**: System works even if some verifiers fail or are delayed
- **Affordable maintenance**: At ~$2 per verification, developers can push frequent updates without breaking the bank

Once bounties are created, the WASM becomes visible in the MCP Registry's `list_pending_verifications()` endpoint, which verifier bots continuously monitor.

The **ICRC-118 registry** provides:

- **Version control** with semantic versioning (major.minor.patch)
- **Upgrade paths** tracking which WASMs can upgrade to which
- **Controller management** for canister type ownership
- **Immutable history** via ICRC-3 blocks

#### 2. **Verifier Bots Monitor Continuously**

Independent verifier bots (anyone can run one) automatically monitor for pending verifications:

```typescript
// Verifier bot continuously polls for new verifications
async function pollAndVerify(): Promise<void> {
  // Fetch pending verifications from the MCP Registry
  // This returns WASMs that have been registered but not yet verified
  const pending = await listPendingVerifications();
  console.log(`Found ${pending.length} pending verification(s)`);

  for (const job of pending) {
    // Check if there's a bounty for build reproducibility
    const bounties = await getBountiesForWasm(job.wasm_hash);
    const buildBounty = bounties.find(
      (b) => b.challengeParameters?.audit_type === 'build_reproducibility_v1',
    );

    if (!buildBounty) continue; // Skip if no bounty sponsored yet

    // Reserve the bounty (stake USDC as collateral)
    await reserveBounty(identity, {
      bounty_id: buildBounty.id,
      stake_amount: 10_000_000n, // 10 USDC collateral
    });

    // Perform AUTOMATED reproducible build in Docker
    const result = await verifyBuild(job.repo, job.commit_hash, job.wasm_hash);

    if (result.success) {
      // File attestation with cryptographic proof
      await fileAttestation(identity, {
        bounty_id: buildBounty.id,
        wasm_id: job.wasm_hash,
        attestationData: {
          '126:audit_type': 'build_reproducibility_v1',
          build_duration_seconds: result.duration,
          git_commit: job.commit_hash,
          repo_url: job.repo,
          build_log_excerpt: result.buildLog.slice(0, 500),
        },
      });

      // Claim bounty to trigger payout
      await claimBounty(identity, {
        bounty_id: buildBounty.id,
        wasm_id: job.wasm_hash,
      });
    } else {
      // File divergence report if build fails
      await submitDivergence(identity, {
        bountyId: buildBounty.id,
        wasmId: job.wasm_hash,
        reason: result.error,
      });

      // Still claim bounty for reporting divergence
      await claimBounty(identity, {
        bounty_id: buildBounty.id,
        wasm_id: job.wasm_hash,
      });
    }
  }
}

// Run continuously every minute
setInterval(pollAndVerify, 60_000);
```

**Key Point**: The build process is **completely automated**. The bot:

1. Clones the Git repository
2. Checks out the exact commit
3. Runs a deterministic Docker build
4. Compares the resulting WASM hash
5. Files attestation or divergence report automatically

No human intervention required!

#### 3. **Automated Docker-Based Reproducible Builds**

Every build runs in a deterministic Docker environment with **zero human intervention**, using the reproducible build setup from [research-ag/motoko-build-template](https://github.com/research-ag/motoko-build-template):

```typescript
// From packages/apps/verifier-bot/src/builder.ts
export async function verifyBuild(
  repo: string,
  commitHash: string,
  expectedWasmHash: string,
): Promise<BuildResult> {
  const workDir = `/tmp/verify-${Date.now()}`;

  // 1. Clone repository and checkout exact commit
  execSync(`git clone --depth 1 ${repo} ${workDir}`);
  execSync(`git -C ${workDir} checkout ${commitHash}`);

  // 2. Auto-detect canister configuration
  const canisterName = extractCanisterNameFromDfx(workDir);
  const mocVersion = getMocVersionFromMopsToml(canisterPath);

  // 3. Bootstrap reproducible build environment
  // Uses research-ag's docker-compose.yml + Dockerfile setup
  bootstrapBuildFiles({
    projectPath: canisterPath,
    mocVersion: mocVersion,
  });

  // 4. Build in isolated Docker container (no cache = clean build)
  // This uses the docker-compose setup from motoko-build-template
  execSync(`docker-compose build --no-cache`, { cwd: canisterPath });
  execSync(`docker-compose run wasm`, { cwd: canisterPath });

  // 5. Compute WASM hash
  const wasmBytes = fs.readFileSync(
    path.join(canisterPath, 'out', 'out_Linux_x86_64.wasm'),
  );
  const actualHash = crypto
    .createHash('sha256')
    .update(wasmBytes)
    .digest('hex');

  // 6. Return automated result
  return {
    success: actualHash === expectedWasmHash,
    wasmHash: actualHash,
    buildLog: buildLog.slice(-1000),
    duration: duration,
  };
}
```

**Key components of the reproducible build setup** (from [research-ag](https://github.com/research-ag)):

- **Base Docker image**: Pre-built image with pinned versions of `moc` (Motoko compiler), `ic-wasm`, and `mops-cli`
- **Isolated environment**: Each build runs in a fresh container with no cache
- **Deterministic output**: Same source code + same toolchain = byte-for-byte identical WASM
- **Fast verification**: Base images are ~76MB and verification completes in <10 seconds
- **Cross-platform consistency**: Linux and Mac M1 produce identical hashes (since moc 0.13.4)

#### 4. **Filing Attestations with ICRC-126**

When a verifier successfully builds and verifies the WASM, they file an attestation on-chain:

```motoko
// In MCP Registry canister
public shared (msg) func icrc126_file_attestation(
  req: AttestationRequest
) : async AttestationResult {

  // 1. Extract bounty_id from metadata
  let bounty_id = getBountyIdFromMetadata(req.metadata);

  // 2. Verify caller is authorized via Audit Hub
  let auditHub: AuditHub.Service = actor(audit_hub_id);
  let is_authorized = await auditHub.is_bounty_ready_for_collection(
    bounty_id,
    msg.caller
  );

  if (not is_authorized) {
    return #Error(#Unauthorized);
  };

  // 3. Extract audit type
  let audit_type = getTextFromMetadata(req.metadata, "126:audit_type");

  // 4. Store attestation record
  let record: AttestationRecord = {
    auditor = msg.caller;
    audit_type = audit_type;
    metadata = req.metadata;
    timestamp = Time.now();
  };

  // Append to existing attestations for this WASM
  attestations.append(req.wasm_id, record);

  // 5. Check if verification should be finalized
  if (audit_type == "build_reproducibility_v1") {
    // Finalize as Verified (consensus happens here)
    await _finalize_verification(req.wasm_id, #Verified, metadata);
  };

  return #Ok(transaction_id);
};
```

**Key insight**: The consensus mechanism isn't about counting attestations to reach a threshold. Instead, **each attestation from an authorized verifier is recorded on-chain**. The "consensus" happens through:

1. **Economic staking**: Verifiers must stake USDC collateral to reserve a bounty
2. **Audit Hub authorization**: Only verifiers who have staked and reserved the bounty can file attestations
3. **Slashing for failures**: If a verifier's stake expires (1 hour) without filing results, their USDC stake is burned
4. **Majority consensus**: Once 5 of 9 verifiers agree on the same WASM hash, verification is finalized
5. **Multiple bounties**: Ensures sufficient independent verifications for Byzantine fault tolerance

#### 5. **Bounty System with Multiple Independent Verifications**

The ICRC-127 bounty system enables **majority consensus** through separate bounties:

```motoko
// Each bounty is a separate verification job that can be claimed by ONE verifier
public func icrc127_create_bounty(req: CreateBountyRequest) : async Nat {
  let bounty = {
    id = next_bounty_id;
    wasm_id = extractWasmHashFromMetadata(req.challenge_parameters);
    audit_type = extractAuditTypeFromMetadata(req.challenge_parameters);
    reward_amount = extractRewardFromMetadata(req.bounty_metadata);
    validation_canister_id = req.validation_canister_id;
    timeout_date = req.timeout_date;
    claimant = null; // Will be set when a verifier claims it
    status = #Open;
  };

  bounties.put(bounty.id, bounty);
  return bounty.id;
};

// When a verifier claims, they get the full bounty amount
public func icrc127_submit_bounty(req: BountySubmissionRequest) : async Result {
  let bounty = bounties.get(req.bounty_id);

  // Check if already claimed
  if (bounty.claimant != null) {
    return #Error("Bounty already claimed");
  };

  // Check if caller filed an attestation
  let has_attestation = checkAttestationExists(
    bounty.wasm_id,
    msg.caller,
    bounty.audit_type
  );

  if (not has_attestation) {
    return #Error("No attestation found");
  };

  // Mark as claimed and transfer reward
  bounty.claimant := ?msg.caller;
  bounty.status := #Claimed;

  await icrc_ledger.transfer({
    to = msg.caller;
    amount = bounty.reward_amount;
  });

  return #Ok(claim_id);
};
```

**How majority consensus works:**

- **Prometheus Protocol creates N separate bounties** (e.g., 9 bounties for 9 verifications)
- **Each bounty can only be claimed by ONE verifier**
- **Each verifier gets the full bounty amount** (e.g., $0.25 USDC per bounty)
- **Majority threshold**: 5 of 9 verifiers must agree on the same WASM hash
- **Total cost**: 9 × $0.25 = $2.25 per verification
- **Result**: WASM is verified when majority of independent verifiers confirm the same hash

#### 6. **Automated Reward Distribution**

When a verifier successfully files an attestation and claims a bounty:

```typescript
// In the verifier bot after successful build
if (result.success) {
  // File attestation
  await fileAttestation(identity, {
    bounty_id: buildBounty.id,
    wasm_id: job.wasm_hash,
    attestationData: {
      '126:audit_type': 'build_reproducibility_v1',
      build_duration_seconds: result.duration,
      git_commit: job.commit_hash,
      repo_url: job.repo,
    },
  });

  // Claim bounty (triggers automatic USDC transfer)
  await claimBounty(identity, {
    bounty_id: buildBounty.id,
    wasm_id: job.wasm_hash,
  });

  // Done! USDC is now in the verifier's wallet
  console.log(`✅ Reward transferred to verifier`);
}
```

The entire process from build → verification → payment happens automatically without any manual intervention or approval steps.

## ICRC-120: Automated Canister Management

Once a WASM is verified, users can safely deploy and upgrade their canisters using the **ICRC-120 Orchestrator**. This standard enables:

### **Safe Upgrades with Snapshots**

When a new verified version is available, users can upgrade with automatic rollback:

```typescript
// Frontend: User clicks "Upgrade to v2.0"
const result = await orchestrator.icrc120_upgrade_to([
  {
    canister_id: userCanisterId,
    hash: newVerifiedWasmHash,
    mode: { upgrade: { wasm_memory_persistence: 'keep' } },
    snapshot: true, // Create snapshot before upgrade
    stop: true, // Stop canister safely
    restart: true, // Restart after upgrade
    timeout: 300_000_000_000n,
    parameters: [['version', { Text: '2.0.0' }]],
  },
]);

// If upgrade fails, automatic rollback to snapshot
if (result[0].Error) {
  await orchestrator.icrc120_revert_snapshot([
    {
      canister_id: userCanisterId,
      snapshot_id: lastSnapshotId,
      restart: true,
    },
  ]);
}
```

### **ICRC-120 Advantages**

- **Snapshot management**: Pre-upgrade state capture for instant rollbacks
- **Lifecycle control**: Start, stop, and configure canisters programmatically
- **Batch operations**: Upgrade multiple canisters in a single call
- **Audit trail**: Full ICRC-3 integration for operation history
- **Authorization**: Principal-based access control for who can manage what

The combination of **ICRC-118 (verified WASM registry) + ICRC-120 (canister orchestration)** creates a complete system for trusted, automated application deployment and management.

## Key Advantages Over Manual Verification

### 1. **Fully Automated Process**

- **Zero human intervention**: Bots handle everything from cloning repos to filing attestations
- **Docker-based builds**: Deterministic, reproducible across all verifiers
- **Continuous monitoring**: Bots run 24/7, verifying new WASMs within minutes
- **Automatic rewards**: Payments distributed instantly upon successful verification

### 2. **Cryptographic Proof, Not Screenshots**

Instead of forum posts with screenshots, the system records:

- Complete build logs stored on-chain (excerpt in attestation metadata)
- Exact Git commit hash that was built
- Docker image version used
- Build duration and timestamp
- Verifier's principal (cryptographically signed)

### 3. **Economic Security Through Staking**

No single entity acts as the authority:

- **Verifiers must stake USDC** to reserve bounties (e.g., 10 USDC collateral per bounty)
- **1-hour lock period**: Stakes are locked while verification is in progress (automated builds complete in minutes)
- **Slashing for abandonment**: If verifiers don't submit results within 1 hour, their USDC stake is burned
- **Anyone can run a bot**: Permissionless participation - just stake USDC to get started
- **Market-driven rewards**: Bounty amounts set by developers based on urgency/complexity

### 4. **Strong Majority Consensus**

Prometheus Protocol enforces multiple independent verifications with majority consensus for all MCP servers:

- **9 independent verifications**, 5 of 9 majority required
- **Byzantine fault tolerant**: Even if minority of verifiers are compromised or incorrect, the majority consensus ensures integrity
- **Flexible & resilient**: System tolerates verifier failures while maintaining security

The consensus happens through **economic incentives** and **cryptographic proof**:

- Malicious verifiers lose their USDC stake when caught
- Honest verifiers earn rewards immediately and get their stake back
- Each verification is independently reproducible
- Majority of verifiers must arrive at the same WASM hash for approval

### 5. **Divergence Reports Also Pay**

Even if a build fails verification:

- Verifiers can file a **divergence report** explaining why
- They still claim the bounty reward for doing the work
- The WASM is marked as "Rejected" rather than "Verified"
- This incentivizes honest reporting rather than only success-driven verification

### 6. **Transparent Security Tiers**

Users see real-time verification status:

```typescript
// In the App Store UI
<SecurityBadge tier={app.securityTier} />

// Where tier is determined by:
// - 🟢 Gold: Multiple verified builds, active maintenance, no issues
// - 🔵 Silver: At least one verified build, responsive developer
// - 🟡 Bronze: Verified but newer/less established
// ⚪ Unranked: No verified builds yet
```

## Economic Model

### For Developers (via Prometheus Protocol)

- **Verification cost**: ~$2.25 per WASM (9 verifiers @ $0.25 each)
- **Affordable for frequent updates**: Push bug fixes without worrying about verification costs
- **Majority consensus**: Only 5 of 9 need to complete for verification
- **Byzantine fault tolerance**: Minority of compromised verifiers cannot approve malicious code
- **Fast completion**: Majority threshold typically reached within 1-5 minutes
- **Build trust**: "Verified by majority of 9 independent verifiers" badge increases user adoption significantly

### For Verifiers

- **Earn per verification**: Full bounty amount ($0.25 USDC per verification)
- **Low operational costs**: Docker builds cost ~$0.01-0.05 in compute (VPS, electricity, bandwidth)
- **Healthy margins**: 5-25x markup on actual costs
- **Volume game**: Profitability comes from processing many verifications automatically
- **Passive income**: Run a bot 24/7 to automatically process verifications
- **Scale earnings**: Each bot can process multiple verifications simultaneously
- **Centralized stake pool**: Deposit USDC once into your dashboard, use it across all verifications
- **Dashboard management**: Monitor stakes, earnings, and performance from one interface
- **Instant withdrawals**: Withdraw earnings anytime through the dashboard
- **No wallet management**: Bot uses API credentials, all funds managed through dashboard
- **Competition**: First verifier to claim an open bounty wins (incentivizes fast, accurate builds)

### For Users

- **Pre-verified apps**: All MCP servers on the app store are verified before deployment to our infrastructure
- **Audit trail**: View all attestations and verifier principals on-chain
- **Transparent security**: See which independent verifiers confirmed each app
- **Ongoing protection**: New versions are automatically re-verified before updates roll out

## Real-World Impact

### Before Prometheus Protocol

1. Developer publishes MCP server for DeFi portfolio management
2. User asks: "Is this safe? I'm giving it a 100k USDC allowance."
3. Developer: "Trust me, here's the repo 🤷"
4. User: _either takes the risk and grants allowance, or avoids economic agents entirely_
5. **Result**: Ecosystem stays small, agents can't manage real value, innovation stalled

### With Prometheus Protocol

1. Developer registers portfolio manager WASM with repo URL and commit hash
2. Automated verifier bot picks up job within 60 seconds
3. Docker build completes in 1-5 minutes, 9 independent verifiers confirm identical hash
4. Attestations filed on-chain, bounties claimed automatically
5. User sees: "✅ Verified by 9 independent verifiers - source code matches deployment"
6. **Result**: User confidently grants allowance and deposits funds, developer gets adoptions

**Real Example**: An MCP server that lets AI agents manage a DeFi portfolio across Uniswap, Aave, and cross-chain bridges. Without verification, users must trust the deployed canister won't drain their allowances or deposited funds. With verification, users know the deployed code is exactly what's on GitHub - cryptographically proven by 9 independent parties.

**Timeline**: From registration to verified status in under 5 minutes, fully automated.

## Getting Started as a Verifier

Want to earn tokens by verifying builds? Here's how:

### Step 1: Set Up Your Verifier Account

1. **Visit the Verifier Dashboard** at [prometheusprotocol.org/verifiers](https://prometheusprotocol.org/verifiers)
2. **Connect your wallet** - Log in with Internet Identity
3. **Deposit USDC stake** - Start with 50-100 USDC to handle multiple concurrent verifications
   - View your available balance and active stakes in real-time
   - Withdraw unused stake anytime (instant, no lock-up)
4. **Generate API credentials** - Dashboard provides a secure API key for your bot
5. **Monitor your earnings** - Real-time dashboard shows:
   - Total verifications completed
   - Active stakes and locks
   - Earned rewards (available for withdrawal)
   - Performance metrics and uptime

### Step 2: Run the Verifier Bot

```bash
# Clone the verifier bot
git clone https://github.com/prometheus-protocol/prometheus-protocol
cd packages/apps/verifier-bot

# Install dependencies
pnpm install

# Configure with your API credentials from dashboard
cp .env.example .env
# Add your API_KEY from the verifier dashboard

# Start verifying!
pnpm start

# The bot will:
# 1. Monitor the bounty board via API
# 2. Automatically reserve bounties using your dashboard stake pool
# 3. Perform reproducible builds in Docker
# 4. Submit verifications
# 5. Return stake + rewards to your dashboard balance
```

**Key Benefits of Dashboard Management:**

- **No wallet management in bot** - Bot uses API credentials, all funds stay in your dashboard account
- **Centralized stake pool** - One balance handles all concurrent verifications
- **Easy withdrawals** - Withdraw earnings anytime through the dashboard UI
- **Monitor across multiple bots** - Run bots on multiple servers, all pulling from one stake pool
- **Adjust stake dynamically** - Add more USDC as you scale, withdraw excess when needed

### Requirements

- VPS or cloud instance (2 CPU, 4GB RAM minimum) - $5-10/month
- Docker installed for isolated builds
- Initial stake pool: 50-100 USDC recommended (handles 5-10 concurrent verifications)
- Verifier dashboard account at prometheusprotocol.org/verifiers

### Expected Earnings

- **Casual verifier** (20-50 verifications/day): $5-12.50/day = $150-375/month
- **Active verifier** (100-200/day): $25-50/day = $750-1,500/month
- **Professional operation** (multiple bots, 500+/day): $125+/day = $3,750+/month

_Earnings vary based on bounty availability and competition. Actual compute costs are <$0.05 per verification. Profitability comes from volume automation._

**Beginner-Friendly**: Start with 50 USDC stake and run one bot. Monitor the dashboard to see how it works. Scale up as you gain confidence.

**Professional Setup**: Deposit 500+ USDC, run bots across multiple regions, monitor everything from one dashboard.

## Technical Deep Dive

### Reproducible Build Environment

Every build uses the same deterministic Docker configuration based on [research-ag/motoko-build-template](https://github.com/research-ag/motoko-build-template):

```dockerfile
# Dockerfile.base - Pre-built base image with pinned toolchain versions
# Uses Alpine Linux for minimal, reproducible builds
FROM alpine:latest AS build

# Install build tools
RUN apk add --no-cache curl ca-certificates tar bash

# Create installation directory
RUN mkdir -p /install/bin

# Download and install moc (Motoko compiler)
ARG MOC_VERSION=0.16.0
RUN curl -L https://github.com/dfinity/motoko/releases/download/${MOC_VERSION}/motoko-Linux-x86_64-${MOC_VERSION}.tar.gz -o motoko.tgz \
    && tar xzf motoko.tgz \
    && install moc /install/bin

# Download and install ic-wasm (WASM optimizer)
ARG IC_WASM_VERSION=0.9.3
RUN curl -L https://github.com/research-ag/ic-wasm/releases/download/${IC_WASM_VERSION}/ic-wasm-x86_64-unknown-linux-musl.tar.gz -o ic-wasm.tgz \
    && tar xzf ic-wasm.tgz \
    && install ic-wasm /install/bin

# Download and install mops-cli (Rust version from jneums/mops-cli)
ARG MOPS_CLI_VERSION=0.2.1
RUN curl -L https://github.com/jneums/mops-cli/releases/download/v${MOPS_CLI_VERSION}/mops-cli-linux64 -o mops-cli \
    && install mops-cli /install/bin

# Final runtime image
FROM alpine:latest
RUN apk add bash
COPY --from=build /install/bin/* /usr/local/bin/

# Set working directory
WORKDIR /project

# Copy mops.toml first to install dependencies
COPY mops.toml ./
RUN mops-cli install --locked

# Copy source files
COPY src /project/src/
COPY did /project/did/
COPY build.sh /project/

# Build the canister
CMD ["bash", "build.sh"]
```

**Key features ensuring reproducibility** (from research-ag's template):

- **Pinned tool versions**: Motoko compiler version specified in `docker-compose.yml`
- **Locked dependencies**: `mops install --locked` uses exact versions from `mops.toml`
- **Isolated environment**: No network access during build, no host system dependencies
- **Clean builds**: `--no-cache` flag ensures fresh container every time
- **Base image registry**: Pre-built images at `ghcr.io/prometheus-protocol/motoko-build-template` (~76MB)
- **Fast verification**: Complete verification in <10 seconds from cached base image

### Attestation Data Structure

Attestations stored on-chain include comprehensive metadata:

```motoko
type AttestationRecord = {
  auditor: Principal;              // Who verified it
  audit_type: Text;                // "build_reproducibility_v1"
  timestamp: Int;                  // When it was verified
  metadata: ICRC16Map;             // Additional data:
  // {
  //   "126:audit_type": "build_reproducibility_v1",
  //   "git_commit": "abc123...",
  //   "repo_url": "https://github.com/...",
  //   "build_duration_seconds": 143,
  //   "build_log_excerpt": "...",
  //   "verifier_version": "1.0.0",
  //   "verifier_principal": "aaaaa-aa..."
  // }
};
```

All attestations are stored permanently on-chain in the MCP Registry canister, creating an immutable audit trail.

### Verification Status Flow

```
WASM Registered
      ↓
Verification Request Created (ICRC-126)
      ↓
Verifier Bot Detects Pending Verification
      ↓
Bot Checks for Bounty (ICRC-127)
      ↓
Bot Reserves Bounty (Stakes 10 USDC Collateral)
      ↓
Automated Docker Build
      ↓
    Success?
   /        \
  Yes       No
   ↓         ↓
File      File
Attestation  Divergence
   ↓         ↓
Claim     Claim
Bounty    Bounty
   ↓         ↓
✅ Verified  ❌ Rejected
   ↓         ↓
USDC → Verifier
```

### Fraud Prevention

**Economic Staking with USDC**:

```motoko
// Verifiers must stake USDC to reserve bounties
public shared(msg) func reserve_bounty(
  bounty_id: Nat,
  stake_amount: Nat
) : async Result {
  let stake_required = 10_000_000; // 10 USDC (in e8s)

  // Verify stake amount is sufficient
  if (stake_amount < stake_required) {
    return #err("Insufficient stake. Minimum: 10 USDC");
  };

  // Transfer USDC from verifier to Audit Hub (held as collateral)
  let usdc_ledger : ICRC1.Service = actor(USDC_LEDGER_ID);
  let transfer_result = await usdc_ledger.icrc1_transfer({
    from_subaccount = null;
    to = { owner = Principal.fromActor(this); subaccount = null };
    amount = stake_required;
    fee = null;
    memo = null;
    created_at_time = null;
  });

  switch (transfer_result) {
    case (#Err(e)) { return #err("USDC transfer failed"); };
    case (#Ok(block_index)) {
      // Lock the stake for 1 hour (more than enough for automated builds)
      create_bounty_lock(
        bounty_id,
        msg.caller,
        stake_required,
        Time.now() + 1_hour
      );
      return #ok();
    };
  };
};
```

**Slashing Mechanism**:

```motoko
// Anyone can call this to clean up expired locks
public func cleanup_expired_lock(bounty_id: Nat) : async Result {
  let lock = get_bounty_lock(bounty_id);

  if (Time.now() < lock.expires_at) {
    return #err("Lock not expired yet");
  };

  // Burn the staked USDC by sending to black hole
  let usdc_ledger : ICRC1.Service = actor(USDC_LEDGER_ID);
  let burn_result = await usdc_ledger.icrc1_transfer({
    from_subaccount = null;
    to = {
      owner = Principal.fromText("aaaaa-aa"); // Black hole
      subaccount = null
    };
    amount = lock.stake_amount;
    fee = null;
    memo = ?Text.encodeUtf8("Slashed for abandonment");
    created_at_time = null;
  });

  // Free the bounty for another verifier
  delete_bounty_lock(bounty_id);

  return #ok();
};

// When verification completes successfully, return the stake + reward
public shared(msg) func claim_bounty_with_stake_return(
  bounty_id: Nat
) : async Result {
  let lock = get_bounty_lock(bounty_id);
  let bounty = get_bounty(bounty_id);

  // Verify caller reserved this bounty
  if (lock.verifier != msg.caller) {
    return #err("Not authorized");
  };

  // Return stake + send reward
  let usdc_ledger : ICRC1.Service = actor(USDC_LEDGER_ID);
  let total_payout = lock.stake_amount + bounty.reward_amount;

  let transfer_result = await usdc_ledger.icrc1_transfer({
    from_subaccount = null;
    to = { owner = msg.caller; subaccount = null };
    amount = total_payout;
    fee = null;
    memo = ?Text.encodeUtf8("Stake return + reward");
    created_at_time = null;
  });

  return #ok();
};
```

This prevents verifiers from:

- Reserving bounties and abandoning them
- Flooding the system with fake reservations
- Gaming the system without doing actual work

## Security Considerations & Attack Vectors

### Supply Chain Security: The Build Environment is the Root of Trust

The system's integrity fundamentally depends on the deterministic Docker build environment. We've taken several measures to address supply chain risks:

**Pinned Dependencies with Hash Verification:**

- All toolchain binaries (moc, ic-wasm, mops-cli) are fetched by **version number AND hash verification**
- Base images use `alpine:latest@sha256:...` pinning to specific digest
- The [research-ag/motoko-build-template](https://github.com/research-ag/motoko-build-template) repo uses **GitHub's dependabot and security scanning**
- Pre-built base images at `ghcr.io/prometheus-protocol/motoko-build-template` are **content-addressed** and immutable

**Mitigation Strategy:**
If an upstream dependency is compromised (e.g., a malicious Alpine image or GitHub release binary), the attack would need to:

1. Compromise the exact version at the exact hash expected by the Dockerfile
2. Do so for all toolchain components simultaneously
3. Maintain this compromise across the 1-hour window between verifier attempts

**Our Defense:**

- Regular security audits of the build template repository
- Multiple independent verifier bots pulling from different CDN endpoints
- Community monitoring of unexpected hash changes in toolchain releases

### Verifier Independence & Sybil Resistance

**The Challenge:** What prevents one entity from running 5 of 9 verifiers to control majority consensus?

**Current Mitigations:**

1. **Economic cost**: Running 5 bots requires 5x operational infrastructure ($25-50/month) plus 5x stake pools
2. **Dashboard reputation system**: The Prometheus dashboard tracks verifier performance, uptime, and historical accuracy. High-reputation verifiers are preferred for high-value bounties
3. **Geographic diversity incentives**: Future versions will implement geographic proof-of-location to reward verifiers in different regions
4. **Staking requirements scale with value**: High-value applications require larger stakes per verifier, making Sybil attacks expensive

**Honest Assessment:**
True decentralization depends on ecosystem adoption. Early on, if only 3 companies run 90% of verifiers, consensus is "decentralized theater." We're actively working to:

- **Partner with existing validator communities** (Ethereum validators, IC node operators)
- **Provide open bounty boards** so anyone can see available work
- **Build reputation systems** that reward long-term independent operators

### Divergence Report Gaming

**The Risk:** Could verifiers file false divergence reports without actually building, just to claim bounties faster?

**Protection Mechanisms:**

1. **Build logs are required**: Divergence reports must include substantial build log evidence
2. **Areta audit integration**: Disputed divergence reports can trigger a formal audit investigation
3. **Reputation penalties**: Verifiers filing unsubstantiated divergence reports lose reputation score
4. **Slashing for false reports**: If a divergence report is proven false through audit, the verifier's stake is slashed
5. **Build artifacts**: Verifiers must provide WASM artifacts and their computed hash, which can be cross-checked

**Why This Works:**
Filing a fake divergence report is **more work than just running the build**. The build takes 2-5 minutes. Fabricating convincing build logs and artifacts that would pass scrutiny takes longer.

### Dashboard Security: Decentralized Protocol, Centralized UX

**The Concern:** The Verifier Dashboard at prometheusprotocol.org is a centralized honeypot for API keys and stake management.

**How We Address This:**

1. **Dashboard is a canister on ICP**: The dashboard isn't a traditional web server - it's a smart contract running on the Internet Computer with:
   - **WebAuthn authentication** (same security as Internet Identity)
   - **Canister-controlled security**: No traditional server to compromise
   - **Transparent code**: Dashboard canister code is open-source and verified through this same system

2. **API credentials are scoped and revocable**:
   - API keys can only reserve bounties and submit attestations
   - Cannot withdraw funds without separate WebAuthn confirmation
   - Can be instantly revoked through the dashboard

3. **Multi-signature withdrawals**: Large withdrawals (>$1000) require additional confirmation
4. **Rate limiting**: API keys are rate-limited to prevent abuse if compromised

**Honest Trade-off:**
Yes, the dashboard adds a UX layer that could be phished or attacked. This is the classic **usability vs. security** trade-off. Users who want maximum security can:

- Run their own on-chain stake management directly with canisters
- Use hardware wallet authentication
- Avoid the dashboard entirely

But for 90% of users, the ICP-based dashboard with WebAuthn is **significantly more secure** than managing private keys directly in a bot's environment.

## What This System Does NOT Provide

### 1. Source Code Audits

**Critical Understanding:** This system verifies that `deployed_binary == f(source_code)`. It does **NOT** verify that `source_code == safe`.

Reproducible builds prove **integrity**, not **security**. A verifier can confirm the deployed WASM matches the source, but cannot confirm the source code doesn't have vulnerabilities or malicious logic.

**Our Solution:**
We integrate with **[Areta](https://areta.fi)**, an established audit marketplace on the Internet Computer, to provide **separate security audit verification**:

- Developers can sponsor security audits through Areta
- Audit reports are attached to the WASM metadata
- Users see both "Build Verified ✅" and "Security Audit: Areta Report Link"
- Gold-tier apps require **both** reproducible build verification AND a security audit

**Two-Layer Trust Model:**

1. **Build verification** (this system): "The deployed code matches what's in the GitHub repo"
2. **Security audit** (Areta): "An expert reviewed the GitHub repo code and found no critical vulnerabilities"

### 2. Dispute Resolution & Edge Cases

**Scenario:** 5 verifiers get hash A, 4 verifiers get hash B. Majority consensus awards the verification to hash A. But what if hash B was correct?

**Current Resolution:**

- Developers can **appeal through Areta audit system** with evidence
- Independent auditors review the build environment, toolchain versions, and disputed hashes
- If the minority was correct, verifiers in the majority are **reputation-penalized** (not slashed, since they followed protocol honestly)
- Future versions may implement **cryptographic proof of build correctness** using zero-knowledge proofs

**Absolute Majority Rule:**
Currently, yes - majority consensus is absolute within the protocol. This is a **conscious trade-off** for automation and decentralization. Perfect dispute resolution would require centralized arbiters, which we explicitly avoid.

### 3. Dynamic Bounty Pricing

**Scenario:** A build takes 30 minutes instead of 2 minutes. Is $0.25 still enough?

**Current Approach:**

- Developers can **set custom bounty amounts** when creating bounties
- The $0.25 is a suggested default for typical Motoko canisters
- Complex builds (Rust, multi-canister projects) typically use $1-5 bounties
- Verifiers can **filter by minimum bounty** in their bot configuration

**Future Enhancement:**
We're exploring **automated dynamic pricing** based on:

- Historical build duration for similar projects
- Current verifier demand/supply
- Complexity metrics (lines of code, dependency count)

## Comparison to Other Approaches

| Approach                   | Trust Model           | Automation | Scalability | Consensus    | Cost                |
| -------------------------- | --------------------- | ---------- | ----------- | ------------ | ------------------- |
| **Manual Forum Posts**     | Social/DFINITY        | None       | Low         | Human review | High (grants)       |
| **Single Trusted Builder** | Centralized           | Partial    | Medium      | 1-of-1       | Medium              |
| **Prometheus Protocol**    | Decentralized Staking | Full       | High        | 5-of-9       | Low (market-driven) |
| **No Verification**        | None                  | N/A        | N/A         | N/A          | Free (high risk)    |

Key differentiators:

- **Only Prometheus is fully automated** - zero human intervention from registration to reward payout
- **Economic security** - staking and slashing prevent bad actors without centralized oversight
- **Permissionless** - anyone can run a verifier bot and earn rewards

## Roadmap

### Phase 1: Automated Verification System (Completed ✅)

- ✅ Automated verifier bot with Docker builds
- ✅ ICRC-126 attestation system
- ✅ ICRC-127 bounty system with USDC staking
- ✅ Audit Hub for authorization and slashing
- ✅ Multi-verifier consensus with majority thresholds
- ✅ Majority consensus (5-of-9)
- ✅ Automatic bounty creation on WASM registration
- ✅ Permissionless participation (stake USDC to verify)

## Conclusion

Prometheus Protocol transforms reproducible builds from a theoretical security feature into a **practical, fully automated trust system** that enables the open economic agent ecosystem. By combining smart contracts, economic staking, and Docker-based automation, we've created a system where:

- **Developers** building financial tools can prove their deployed code matches the source
- **Verifier bots** earn passive income running 24/7 with zero manual work
- **Users** can safely give AI agents economic capabilities, backed by cryptographic proof
- **The ecosystem** grows because agents can manage real value without centralized gatekeepers

**Every step is automated**:

1. Developer registers WASM → triggers verification request
2. Bot detects request → automatically builds in Docker
3. Bot files attestation → smart contract verifies authorization
4. Bot claims bounty → USDC transferred automatically
5. User sees verification → confidently grants allowances and deposits funds

The days of "trust me bro" and avoiding economic agents are over. With Prometheus Protocol, every MCP server - from simple file readers to cross-chain portfolio managers - can be cryptographically verified by economically-incentivized independent parties, with all results stored permanently on-chain.

**The question is no longer "do you trust this app with your funds?"**

**It's "how many independent verifiers confirmed that this app's deployed code matches the audited source?"**

This is how we unlock the **open economic agent web** - where your AI agents can manage token allowances, control investment funds, and execute cross-chain strategies, without trusting any central authority or individual developer.

---

## Join the Network

- **Developers**: [Register your MCP server](https://prometheusprotocol.org/)
- **Verifiers**: [Run a bot](https://github.com/prometheus-protocol)
- **Users**: [Browse verified apps](https://prometheusprotocol.org/)
- **Community**: [Join our Discord](https://discord.gg/TbqgYERjYw)
- **Documentation**: [Read the docs](https://docs.prometheusprotocol.org/)

---

_Prometheus Protocol is building the trust infrastructure for the Model Context Protocol ecosystem on the Internet Computer. Our mission is to make AI agents safe, verifiable, and accessible to everyone._
