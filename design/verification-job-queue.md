# Verification Job Queue System

## Problem

Current system has race conditions where multiple verifiers compete for the same WASM:

- All 9 verifiers query `list_pending_verifications()` simultaneously
- Each tries to reserve the first available bounty
- Race conditions cause same bounty to file both attestation AND divergence
- Inefficient: verifiers scan entire verification_progress lists

## Solution: Centralized Job Queue in Audit Hub

### Architecture Overview

```
┌─────────────────┐
│  MCP Registry   │
│                 │
│  - Stores       │
│    verification │
│    results      │
│  - Creates      │
│    bounties     │
└────────┬────────┘
         │
         │ notify on new WASM
         ↓
┌─────────────────┐
│   Audit Hub     │◄──── request_verification_job() ────┐
│                 │                                      │
│  - Job Queue    │──── {wasm_id, repo, commit} ────────┤
│  - Lock Manager │                                      │
│  - Bounty Pool  │                                      │
└─────────────────┘                                      │
                                                         │
                                    ┌────────────────────┴─────┐
                                    │  Verifier Bots (x9)      │
                                    │  - Request job           │
                                    │  - Build WASM            │
                                    │  - Submit result         │
                                    └──────────────────────────┘
```

### Key Components

#### 1. Audit Hub: Job Queue Manager

**New State:**

```motoko
// Pending WASMs needing verification
stable var pending_verifications = BTree.init<Text, VerificationJob>(null);

// Jobs currently assigned to verifiers
stable var assigned_jobs = Map.new<BountyId, AssignedJob>();

type VerificationJob = {
  wasm_id: Text;
  repo: Text;
  commit_hash: Text;
  build_config: ICRC16Map;
  created_at: Timestamp;
  required_verifiers: Nat;  // e.g., 9
  assigned_count: Nat;       // How many bounties assigned so far
};

type AssignedJob = {
  wasm_id: Text;
  verifier: Principal;
  bounty_id: BountyId;
  assigned_at: Timestamp;
  expires_at: Timestamp;
};
```

**New Functions:**

```motoko
// Called by mcp_registry when new WASM needs verification
public shared(msg) func add_verification_job(
  wasm_id: Text,
  repo: Text,
  commit_hash: Text,
  build_config: ICRC16Map,
  required_verifiers: Nat
) : async Result<(), Text> {
  // Only mcp_registry can add jobs
  assert(msg.caller == registry_canister_id);

  // Add to pending queue
  let job = {
    wasm_id;
    repo;
    commit_hash;
    build_config;
    created_at = Time.now();
    required_verifiers;
    assigned_count = 0;
  };

  ignore BTree.insert(pending_verifications, Text.compare, wasm_id, job);
  #ok()
}

// Called by verifier bots to get work
public shared func request_verification_job_with_api_key(
  api_key: Text
) : async Result<VerificationJobAssignment, Text> {
  // 1. Validate API key
  let verifier = validate_api_key(api_key)?;

  // 2. Check if verifier already has active assignment
  for ((bounty_id, job) in Map.entries(assigned_jobs)) {
    if (Principal.equal(job.verifier, verifier) and job.expires_at > Time.now()) {
      return #err("You already have an active job assignment");
    };
  };

  // 3. Find a WASM needing verification
  for ((wasm_id, job) in BTree.entries(pending_verifications)) {
    if (job.assigned_count < job.required_verifiers) {
      // 4. Create bounty and reserve it atomically
      let bounty_id = await create_and_reserve_bounty(wasm_id, verifier);

      // 5. Mark job as assigned
      let assignment = {
        wasm_id;
        verifier;
        bounty_id;
        assigned_at = Time.now();
        expires_at = Time.now() + LOCK_DURATION_NS;
      };

      ignore Map.put(assigned_jobs, Map.nhash, bounty_id, assignment);

      // 6. Update assignment count
      let updated_job = {
        job with
        assigned_count = job.assigned_count + 1
      };
      ignore BTree.insert(pending_verifications, Text.compare, wasm_id, updated_job);

      // 7. Return job details to verifier
      return #ok({
        bounty_id;
        wasm_id;
        repo = job.repo;
        commit_hash = job.commit_hash;
        build_config = job.build_config;
        expires_at = assignment.expires_at;
      });
    };
  };

  #err("No verification jobs available")
}

// Called when verification is complete or expires
public shared func release_job_assignment(bounty_id: BountyId) : async () {
  ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
}

// Called by mcp_registry when WASM is finalized
public shared func mark_verification_complete(wasm_id: Text) : async () {
  assert(msg.caller == registry_canister_id);
  ignore BTree.delete(pending_verifications, Text.compare, wasm_id);
}
```

#### 2. MCP Registry: Notify on New WASM

**Update icrc118_register_wasm:**

```motoko
// After creating bounties, notify audit hub
switch (_credentials_canister_id) {
  case (?audit_hub_id) {
    let auditHub : AuditHub.Service = actor(Principal.toText(audit_hub_id));
    let _ = await auditHub.add_verification_job(
      wasm_id,
      repo,
      commit_hash,
      build_config,
      REQUIRED_VERIFIERS
    );
  };
  case (null) {};
};
```

**Update \_finalize_verification:**

```motoko
// After finalization, tell audit hub job is complete
switch (_credentials_canister_id) {
  case (?audit_hub_id) {
    let auditHub : AuditHub.Service = actor(Principal.toText(audit_hub_id));
    let _ = await auditHub.mark_verification_complete(wasm_id);
  };
  case (null) {};
};
```

#### 3. Verifier Bot: Request-Based Flow

**Old Flow (REMOVE):**

```typescript
// Scan all pending verifications
const pending = await registry.list_pending_verifications();

// Try to claim first available
for (const wasm of pending) {
  const bounties = await auditHub.list_available_bounties();
  // Race condition here! Multiple bots compete
}
```

**New Flow:**

```typescript
async function getVerificationJob(): Promise<VerificationJob | null> {
  try {
    // Request a job - audit hub handles all locking
    const result = await auditHub.request_verification_job_with_api_key(apiKey);

    if ('err' in result) {
      console.log('No jobs available:', result.err);
      return null;
    }

    return result.ok;
  } catch (error) {
    console.error('Failed to request job:', error);
    return null;
  }
}

async function main() {
  while (true) {
    // Request work from audit hub
    const job = await getVerificationJob();

    if (!job) {
      // No work available, wait and retry
      await sleep(30_000);
      continue;
    }

    console.log(`Assigned job: ${job.wasm_id}, bounty: ${job.bounty_id}`);

    try {
      // Build and verify
      const result = await buildWasm(job.repo, job.commit_hash);

      // Submit result
      if (result.matches) {
        await registry.icrc126_file_attestation_with_api_key(apiKey, {
          wasm_id: job.wasm_id,
          // ... metadata with bounty_id
        });
      } else {
        await registry.icrc126_file_divergence_with_api_key(apiKey, {
          wasm_id: job.wasm_id,
          // ... metadata with bounty_id
        });
      }

      // Release assignment
      await auditHub.release_job_assignment(job.bounty_id);
    } catch (error) {
      console.error('Build failed:', error);
      // Assignment will expire automatically
    }
  }
}
```

### Benefits

1. **No Race Conditions**: Job assignment is atomic in audit hub
2. **Fair Distribution**: Each verifier gets unique assignment
3. **Better Performance**: No scanning large lists
4. **Clean Architecture**: Separation of concerns
5. **Automatic Expiry**: Jobs expire if verifier doesn't complete them
6. **Metrics**: Audit hub can track assignment/completion rates

### Migration Path

1. **Phase 1**: Add job queue to audit_hub (backward compatible)
2. **Phase 2**: Update mcp_registry to notify audit_hub (backward compatible)
3. **Phase 3**: Update verifier bots to use request_verification_job
4. **Phase 4**: Remove list_pending_verifications once all verifiers migrated

### Open Questions

1. Should we support priority queues? (older WASMs first, or specific projects)
2. How to handle verifier that repeatedly fails to complete jobs?
3. Should we allow verifiers to request specific WASMs they're interested in?
4. What happens if audit hub crashes - how to rebuild job queue from mcp_registry state?
