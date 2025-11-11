// packages/canisters/audit_hub/src/Main.mo
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import ICRC2 "mo:icrc2-types";
import Blob "mo:base/Blob";
import Text "mo:base/Text";
import Random "mo:base/Random";
import Nat8 "mo:base/Nat8";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Error "mo:base/Error";

import Admin "Admin";
import ApiKey "ApiKey";
import McpRegistry "McpRegistry";
import Types "Types";
import Account "Account";
import StakePool "StakePool";
import BountyLock "BountyLock";
import JobQueue "JobQueue";
import QueryMethods "QueryMethods";
import Config "Config";
import JobAssignment "JobAssignment";

shared ({ caller = deployer }) persistent actor class AuditHub() = this {

  // The duration a lock is valid before it expires (10 mins for automated builds).
  let LOCK_DURATION_NS : Int = 10 * 60 * 1_000_000_000; // 10 minutes in nanoseconds

  // ==================================================================================
  // == STATE
  // ==================================================================================

  // The owner of the canister, with administrative privileges.
  var owner : Principal = deployer;

  // Verifier Dashboard canister ID - for API credential validation
  var registry_canister_id : ?Principal = null;
  var bounty_sponsor_canister_id : ?Principal = null;

  // Tracks the available (unstaked) balances for each verifier and token type
  // Map<Verifier Principal, Map<TokenId, Balance>>
  var available_balances = Map.new<Principal, Map.Map<Types.TokenId, Types.Balance>>();

  // Tracks the staked balances for each verifier and token type
  // Map<Verifier Principal, Map<TokenId, Balance>>
  var staked_balances = Map.new<Principal, Map.Map<Types.TokenId, Types.Balance>>();

  // Tracks active locks on bounties.
  var bounty_locks = Map.new<Types.BountyId, Types.BountyLock>();

  // Configuration: Stake requirements per audit type
  // Maps audit_type -> (token_id, stake_amount)
  // e.g., "tools_v1" -> ("ckusdc_canister_id", 1_000_000)
  // This makes sense because different audit types may require different stake amounts
  // and could potentially use different tokens
  var stake_requirements = Map.new<Text, (Types.TokenId, Types.Balance)>();

  // Reputation tracking: verifications completed per verifier
  var verifier_stats = Map.new<Principal, Types.VerifierProfile>();

  // API Credentials Management
  // Map API key to verifier principal and metadata
  var api_credentials = Map.new<Text, Types.ApiCredential>();

  // Map verifier principal to their API keys
  var verifier_api_keys = Map.new<Principal, [Text]>();

  // Track which verifiers have participated in each WASM verification
  // Map<BountyId, Principal> - maps bounty to the verifier who reserved it
  var _bounty_verifier_map = Map.new<Types.BountyId, Principal>();

  // ==================================================================================
  // == JOB QUEUE STATE
  // ==================================================================================

  // Pending audits for verified WASMs (tools_v1, etc.) - keyed by wasm_id::audit_type
  // BTree<wasm_id::audit_type, VerificationJob>
  var pending_audits = BTree.init<Text, Types.VerificationJob>(null);

  // Currently assigned jobs
  // Map<BountyId, AssignedJob>
  var assigned_jobs = Map.new<Types.BountyId, Types.AssignedJob>();

  // Track which verifiers have been assigned to which WASMs (to prevent duplicate assignments)
  // Map<WASM_ID, Set<Principal>>
  var wasm_verifier_assignments = Map.new<Text, Map.Map<Principal, Bool>>();

  // Track which verifiers have COMPLETED verification for which WASMs (persists after lock release)
  // Map<WASM_ID, Set<Principal>> - DEPRECATED: Not currently used, will remove in production
  var wasm_verifier_completions = Map.new<Text, Map.Map<Principal, Bool>>();

  // ==================================================================================
  // == HELPER FUNCTIONS
  // ==================================================================================

  private func is_owner(caller : Principal) : Bool {
    return Principal.equal(owner, caller);
  };

  // Check if caller is authorized for consensus operations (owner or registry)
  private func is_authorized_for_consensus(caller : Principal) : Bool {
    if (Principal.equal(owner, caller)) { return true };
    switch (registry_canister_id) {
      case (?registry_id) { Principal.equal(registry_id, caller) };
      case (null) { false };
    };
  };

  // Helper function to extract audit_type from ICRC-16 metadata (challenge_parameters)
  // ==================================================================================
  // == ADMIN METHODS
  // ==================================================================================

  public shared query func get_owner() : async Principal {
    return owner;
  };

  // Admin method to manually re-add bounty_ids to a verification job
  // Used to fix cases where bounty_ids were overwritten instead of merged
  public shared (msg) func admin_add_bounties_to_job(
    wasm_id : Text,
    audit_type : Text,
    additional_bounty_ids : [Nat],
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can call this method");
    };

    Admin.admin_add_bounties_to_job(
      pending_audits,
      wasm_id,
      audit_type,
      additional_bounty_ids,
    );
  };

  public shared (msg) func set_registry_canister_id(registry_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    registry_canister_id := ?registry_id;
    return #ok(());
  };

  public shared (msg) func set_bounty_sponsor_canister_id(bounty_sponsor_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    bounty_sponsor_canister_id := ?bounty_sponsor_id;
    return #ok(());
  };

  /**
   * Set the stake requirement for a specific audit type.
   * @param audit_type - The audit type (e.g., "tools_v1", "build_reproducibility_v1")
   * @param token_id - The ledger canister ID for the staking token
   * @param amount - The stake amount required (in token's smallest unit)
   */
  public shared (msg) func set_stake_requirement(audit_type : Text, token_id : Types.TokenId, amount : Types.Balance) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    Map.set(stake_requirements, thash, audit_type, (token_id, amount));
    return #ok(());
  };

  /**
   * Get the stake requirement for a specific audit type.
   * Returns (token_id, amount) tuple.
   */
  public shared query func get_stake_requirement(audit_type : Text) : async ?(Types.TokenId, Types.Balance) {
    return Map.get(stake_requirements, thash, audit_type);
  };

  public shared (msg) func set_owner(new_owner : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can transfer ownership.");
    };
    owner := new_owner;
    return #ok(());
  };

  // ==================================================================================
  // == API KEY MANAGEMENT (For Verifier Bots)
  // ==================================================================================

  /**
   * Generate a new API key for the verifier to use in their bot.
   * Called by the verifier principal (authenticated via Internet Identity in UI).
   */
  public shared (msg) func generate_api_key() : async Result.Result<Text, Text> {
    await ApiKey.generate_api_key(msg.caller, api_credentials, verifier_api_keys);
  };

  /**
   * Revoke an API key (makes it inactive).
   */
  public shared (msg) func revoke_api_key(api_key : Text) : async Result.Result<(), Text> {
    ApiKey.revoke_api_key(msg.caller, api_credentials, api_key);
  };

  /**
   * Validate an API key and return the associated verifier principal.
   * Used by the verifier bot to authenticate reserve_bounty requests.
   */
  public shared query func validate_api_key(api_key : Text) : async Result.Result<Principal, Text> {
    ApiKey.validate_api_key(api_credentials, api_key);
  };

  /**
   * List all API keys for the authenticated verifier.
   */
  public shared (msg) func list_api_keys() : async [Types.ApiCredential] {
    ApiKey.list_api_keys(msg.caller, api_credentials, verifier_api_keys);
  };

  // ==================================================================================
  // == STAKE POOL MANAGEMENT (Deposits & Withdrawals)
  // ==================================================================================

  /**
   * Deposit tokens as stake to become an eligible auditor.
   * The caller must have already approved this canister to spend tokens on their behalf.
   * @param token_id - The ledger canister ID (as Principal text) of the token to deposit (e.g., USDC, ICP)
   * @param amount - The amount to deposit (in token's smallest unit)
   */
  public shared (msg) func deposit_stake(token_id : Types.TokenId, amount : Types.Balance) : async Result.Result<(), Text> {
    await StakePool.deposit_stake(
      msg.caller,
      token_id,
      amount,
      available_balances,
      Principal.fromActor(this),
    );
  };

  /**
   * Withdraw tokens from the verifier's available balance (not currently staked).
   * The withdrawal amount will have the token's fee deducted from it during transfer.
   * @param token_id - The ledger canister ID (as Principal text) of the token to withdraw
   * @param amount - The amount to withdraw (in token's smallest unit) - this is what the user will receive
   */
  public shared (msg) func withdraw_stake(token_id : Types.TokenId, amount : Types.Balance) : async Result.Result<(), Text> {
    await StakePool.withdraw_stake(
      msg.caller,
      token_id,
      amount,
      available_balances,
      Principal.fromActor(this),
    );
  };

  // ==================================================================================
  // == BOUNTY RESERVATION & LOCKING METHODS
  // ==================================================================================

  /**
   * Allows a verifier to stake tokens to reserve a bounty (1-hour lock).
   * Can be called directly by the verifier principal.
   * @param bounty_id - The bounty to reserve
   * @param audit_type - The audit type (e.g., "tools_v1", "build_reproducibility_v1")
   */
  public shared (msg) func reserve_bounty(bounty_id : Types.BountyId, audit_type : Text) : async Result.Result<(), Text> {
    BountyLock.reserve_bounty(
      bounty_id,
      audit_type,
      msg.caller,
      bounty_locks,
      stake_requirements,
      available_balances,
      staked_balances,
      LOCK_DURATION_NS,
    );
  };

  /**
   * Reserve a bounty using an API key (for bot authentication).
   * The bot passes its API key, and we resolve it to the verifier principal.
   * @param api_key - The verifier's API key
   * @param bounty_id - The bounty to reserve
   * @param audit_type - The audit type (e.g., "tools_v1", "build_reproducibility_v1")
   */
  public shared func reserve_bounty_with_api_key(
    api_key : Text,
    bounty_id : Types.BountyId,
    audit_type : Text,
  ) : async Result.Result<(), Text> {
    BountyLock.reserve_bounty_with_api_key(
      api_key,
      bounty_id,
      audit_type,
      api_credentials,
      bounty_locks,
      stake_requirements,
      available_balances,
      staked_balances,
      LOCK_DURATION_NS,
      _record_api_key_usage,
    );
  };

  // Called by the registry after successful verification to return the stake and update reputation.
  public shared (msg) func release_stake(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    switch (registry_canister_id) {
      case (null) {
        return #err("Registry canister ID not configured.");
      };
      case (?registry_id) {
        if (not Principal.equal(msg.caller, registry_id)) {
          return #err("Unauthorized: Only the registry canister can call this method.");
        };
      };
    };

    BountyLock.release_stake(
      bounty_id,
      bounty_locks,
      staked_balances,
      available_balances,
      verifier_stats,
    );
  };

  /**
   * Called by the registry when a verifier was on the losing side of consensus.
   * Slashes their stake and penalizes reputation (they provided incorrect verification).
   */
  public shared (msg) func slash_stake_for_incorrect_consensus(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    switch (registry_canister_id) {
      case (null) {
        return #err("Registry canister ID not configured.");
      };
      case (?registry_id) {
        if (not Principal.equal(msg.caller, registry_id)) {
          return #err("Unauthorized: Only the registry canister can call this method.");
        };
      };
    };

    BountyLock.slash_stake_for_incorrect_consensus(
      bounty_id,
      bounty_locks,
      staked_balances,
      verifier_stats,
    );
  };

  // Public function anyone can call to clean up an expired lock and slash the stake.
  public shared func cleanup_expired_lock(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    BountyLock.cleanup_expired_lock(
      bounty_id,
      bounty_locks,
      staked_balances,
      verifier_stats,
    );
  };

  // ==================================================================================
  // == PUBLIC QUERY & VERIFICATION METHODS
  // ==================================================================================

  // The critical function called by the ICRC-127 canister before payout.
  public shared query func is_bounty_ready_for_collection(bounty_id : Types.BountyId, potential_claimant : Principal) : async Bool {
    QueryMethods.is_bounty_ready_for_collection(bounty_id, potential_claimant, bounty_locks);
  };

  /**
   * Get available balance by audit_type.
   * Looks up the token_id from the stake_requirements for this audit type.
   */
  public shared query func get_available_balance_by_audit_type(verifier : Principal, audit_type : Text) : async Types.Balance {
    QueryMethods.get_available_balance_by_audit_type(verifier, audit_type, stake_requirements, available_balances);
  };

  public shared query func get_staked_balance(verifier : Principal, token_id : Types.TokenId) : async Types.Balance {
    QueryMethods.get_staked_balance(verifier, token_id, staked_balances);
  };

  public shared query func get_bounty_lock(bounty_id : Types.BountyId) : async ?Types.BountyLock {
    QueryMethods.get_bounty_lock(bounty_id, bounty_locks);
  };

  /**
   * Check if a verifier has any active (non-expired) bounty locks.
   * This is used by the registry to authorize API-key-based attestations.
   * @param verifier - The principal of the verifier to check
   * @returns true if the verifier has at least one active lock, false otherwise
   */
  public shared query func has_active_bounty_lock(verifier : Principal) : async Bool {
    QueryMethods.has_active_bounty_lock(verifier, bounty_locks);
  };

  /**
   * Get verifier profile with balances for a specific token.
   * @param verifier - The principal of the verifier
   * @param token_id - The ledger canister ID (as Principal text) of the token to query
   */
  public shared query func get_verifier_profile(verifier : Principal, token_id : Types.TokenId) : async Types.VerifierProfile {
    QueryMethods.get_verifier_profile(verifier, token_id, available_balances, staked_balances, verifier_stats);
  };

  // ==================================================================================
  // == CONFIGURATION & ENV REQUIREMENTS
  // ==================================================================================

  public type EnvDependency = Config.EnvDependency;
  public type EnvConfig = Config.EnvConfig;

  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    Config.get_env_requirements(registry_canister_id, bounty_sponsor_canister_id, stake_requirements);
  };

  // ==================================================================================
  // == JOB QUEUE MANAGEMENT
  // ==================================================================================

  /**
   * Add a new verification job to the queue.
   * Called by mcp_registry when a new WASM is registered.
   * Only the registry canister can call this function.
   */
  public shared (msg) func add_verification_job(
    wasm_id : Text,
    repo : Text,
    commit_hash : Text,
    build_config : Types.ICRC16Map,
    required_verifiers : Nat,
    bounty_ids : [Types.BountyId],
  ) : async Result.Result<(), Text> {
    JobQueue.add_verification_job(
      pending_audits,
      wasm_id,
      repo,
      commit_hash,
      build_config,
      required_verifiers,
      bounty_ids,
      msg.caller,
      registry_canister_id,
      bounty_sponsor_canister_id,
    );
  };

  /**
   * Mark a verification job as complete.
   * Called by mcp_registry when a WASM verification or audit is finalized.
   * Only the registry canister can call this function.
   * @param wasm_id - The WASM ID
   * @param audit_type - The audit type (e.g., "build_reproducibility_v1", "tools_v1")
   */
  public shared (msg) func mark_verification_complete(
    wasm_id : Text,
    audit_type : Text,
  ) : async Result.Result<(), Text> {
    JobQueue.mark_verification_complete(
      pending_audits,
      wasm_id,
      audit_type,
      msg.caller,
      registry_canister_id,
      is_owner,
    );
  };

  /**
   * Helper function to process an audit job for a verifier.
   * Returns a job assignment or null if the job is fully assigned.
   */
  private func _process_audit_job(
    queue_key : Text,
    job : Types.VerificationJob,
    verifier : Principal,
    current_time : Int,
  ) : async ?Result.Result<Types.VerificationJobAssignment, Text> {
    let wasm_id = job.wasm_id;

    // Check if verifier has an active locked bounty for this job
    let active_locked_bounty = await JobAssignment.find_active_locked_bounty(
      job,
      verifier,
      bounty_locks,
      registry_canister_id,
    );

    // If verifier has an active locked bounty, return it
    switch (active_locked_bounty) {
      case (?(bounty_id, challenge_params)) {
        return ?#ok(
          JobAssignment.create_job_assignment(
            bounty_id,
            wasm_id,
            job.repo,
            job.commit_hash,
            challenge_params,
            switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
              case (?lock) { lock.expires_at };
              case (null) { current_time + (3600_000_000_000) };
            },
          )
        );
      };
      case (null) {
        // No active locked bounty, continue to check if we can assign a new one
      };
    };

    // Check if we can assign a new bounty
    if (job.assigned_count < job.required_verifiers) {
      Debug.print("Found audit job needing verification: " # queue_key # " (" # Nat.toText(job.assigned_count) # "/" # Nat.toText(job.required_verifiers) # " assigned)");

      // Determine audit_type and stake requirement
      let audit_type = switch (JobQueue.get_audit_type_from_metadata(job.build_config)) {
        case (?at) { at };
        case (null) { "build_reproducibility_v1" };
      };

      let (token_id, stake_amount) = switch (Map.get(stake_requirements, thash, audit_type)) {
        case (?(tid, amt)) { (tid, amt) };
        case (null) {
          Debug.print("Warning: No stake requirement configured for audit_type '" # audit_type # "'");
          return ?#err("No stake requirement configured for audit type: " # audit_type);
        };
      };

      // Claim an available bounty
      let available_bounty_id = JobAssignment.claim_available_bounty(
        job,
        verifier,
        current_time,
        LOCK_DURATION_NS,
        stake_amount,
        token_id,
        assigned_jobs,
        bounty_locks,
      );

      switch (available_bounty_id) {
        case (?bounty_id) {
          // Get bounty's challenge_parameters from registry
          let bounty_build_config = await JobAssignment.get_bounty_build_config(
            bounty_id,
            job,
            registry_canister_id,
          );

          // Extract audit_type from bounty's challenge_parameters
          let bounty_audit_type = switch (JobQueue.get_audit_type_from_metadata(bounty_build_config)) {
            case (?at) { at };
            case (null) { "build_reproducibility_v1" };
          };

          // Verify stake requirement exists for this audit type
          let (final_token_id, final_stake_amount) = switch (Map.get(stake_requirements, thash, bounty_audit_type)) {
            case (?(tid, amt)) { (tid, amt) };
            case (null) {
              Debug.print("Warning: No stake requirement configured for audit_type '" # bounty_audit_type # "'");
              ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
              return ?#err("No stake requirement configured for audit type: " # bounty_audit_type);
            };
          };

          // Reserve the bounty with stake
          switch (await _reserve_bounty_internal(verifier, bounty_id, final_token_id, final_stake_amount)) {
            case (#err(e)) {
              ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
              ignore Map.remove(bounty_locks, Map.nhash, bounty_id);
              return ?#err("Failed to reserve bounty: " # e);
            };
            case (#ok()) {};
          };

          // Update job assignment count
          let updated_job : Types.VerificationJob = {
            job with
            assigned_count = job.assigned_count + 1;
          };
          ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);

          Debug.print("Assigned audit job to verifier: bounty_id=" # Nat.toText(bounty_id) # ", wasm_id=" # wasm_id # ", audit_type=" # bounty_audit_type);

          // Return assignment
          let expires_at = switch (Map.get(assigned_jobs, Map.nhash, bounty_id)) {
            case (?assignment) { assignment.expires_at };
            case (null) { current_time + LOCK_DURATION_NS };
          };

          return ?#ok(
            JobAssignment.create_job_assignment(
              bounty_id,
              wasm_id,
              job.repo,
              job.commit_hash,
              bounty_build_config,
              expires_at,
            )
          );
        };
        case (null) {
          return null;
        };
      };
    };

    return null;
  };

  /**
   * Request a verification job assignment.
   * Called by verifier bots using their API key.
   * Returns a job assignment with bounty_id, or an error if no jobs available.
   */
  public shared func request_verification_job_with_api_key(
    api_key : Text
  ) : async Result.Result<Types.VerificationJobAssignment, Text> {
    // 1. Validate API key
    let verifier = switch (ApiKey.validate_api_key(api_credentials, api_key)) {
      case (#err(e)) { return #err(e) };
      case (#ok(v)) { v };
    };

    Debug.print("Verifier " # Principal.toText(verifier) # " requesting verification job");

    // 2. Check for existing active assignment
    let current_time = Time.now();
    let existing_assignment = await JobAssignment.check_existing_assignment(
      verifier,
      current_time,
      assigned_jobs,
      pending_audits,
      registry_canister_id,
    );

    switch (existing_assignment) {
      case (?assignment) { return #ok(assignment) };
      case (null) { /* Continue to find new job */ };
    };

    // 3. Search for available jobs
    for ((queue_key, job) in BTree.entries(pending_audits)) {
      switch (await _process_audit_job(queue_key, job, verifier, current_time)) {
        case (?result) { return result };
        case (null) { /* Continue to next job */ };
      };
    };

    // No jobs available
    Debug.print("No verification jobs available");
    #err("No verification jobs available");
  };

  /**
   * Release a job assignment when verification is complete or expired.
   * Can be called by the verifier or by cleanup processes.
   */
  public shared func release_job_assignment(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    JobQueue.release_job_assignment(
      assigned_jobs,
      wasm_verifier_assignments,
      bounty_id,
    );
    return #ok(());
  };

  /**
   * Get all pending verification jobs (for debugging/monitoring).
   */
  public shared query func list_pending_jobs() : async [(Text, Types.VerificationJob)] {
    JobQueue.list_pending_jobs(pending_audits);
  };

  /**
   * Get all currently assigned jobs (for debugging/monitoring).
   */
  public shared query func list_assigned_jobs() : async [(Types.BountyId, Types.AssignedJob)] {
    JobQueue.list_assigned_jobs(assigned_jobs);
  };

  // Helper: Record API key usage timestamp
  private func _record_api_key_usage(api_key : Text) {
    switch (Map.get(api_credentials, thash, api_key)) {
      case (?cred) {
        Map.set(
          api_credentials,
          thash,
          api_key,
          {
            api_key = cred.api_key;
            verifier_principal = cred.verifier_principal;
            created_at = cred.created_at;
            last_used = ?Time.now();
            is_active = cred.is_active;
          },
        );
      };
      case (null) {};
    };
  };

  // Helper: Internal version of reserve_bounty that doesn't require msg.caller
  private func _reserve_bounty_internal(
    verifier : Principal,
    bounty_id : Types.BountyId,
    token_id : Types.TokenId,
    stake_amount : Types.Balance,
  ) : async Result.Result<(), Text> {
    // Check if bounty is already locked by someone else.
    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (?existing) {
        if (existing.expires_at > Time.now()) {
          // If claimant is someone else, fail. If claimant is the same verifier,
          // proceed (this supports provisional locks created earlier by the assignment step).
          if (not Principal.equal(existing.claimant, verifier)) {
            return #err("Bounty " # Nat.toText(bounty_id) # " is already locked by " # Principal.toText(existing.claimant));
          };
          // else: existing lock is owned by this verifier and we can proceed to finalize staking
        };
      };
      case (null) {};
    };

    // Check if verifier has enough balance
    let available = Account.get_balance(available_balances, verifier, token_id);
    if (available < stake_amount) {
      return #err("Insufficient balance. Required: " # Nat.toText(stake_amount) # ", available: " # Nat.toText(available));
    };

    // Transfer from available to staked
    Account.set_balance(available_balances, verifier, token_id, available - stake_amount);
    let current_staked = Account.get_balance(staked_balances, verifier, token_id);
    Account.set_balance(staked_balances, verifier, token_id, current_staked + stake_amount);

    // Create or update the lock (if a provisional lock existed for this verifier
    // we overwrite it with the finalized stake info).
    let lock : Types.BountyLock = {
      claimant = verifier;
      expires_at = Time.now() + LOCK_DURATION_NS;
      stake_amount;
      stake_token_id = token_id;
    };

    ignore Map.put(bounty_locks, Map.nhash, bounty_id, lock);
    ignore Map.put(_bounty_verifier_map, Map.nhash, bounty_id, verifier);

    Debug.print("Reserved bounty " # Nat.toText(bounty_id) # " for verifier " # Principal.toText(verifier) # " with stake " # Nat.toText(stake_amount));
    #ok();
  };

  // ==================================================================================
  // == DEBUG METHODS
  // ==================================================================================

  // Debug method to proxy icrc127_get_bounty call to registry
  public shared func debug_get_bounty(bounty_id : Nat) : async Text {
    switch (registry_canister_id) {
      case (?id) {
        Debug.print("Calling registry " # Principal.toText(id) # " for bounty " # Nat.toText(bounty_id));
        let registry = actor (Principal.toText(id)) : McpRegistry.Service;
        try {
          let result = await registry.icrc127_get_bounty(bounty_id);
          let msg = "debug_get_bounty(" # Nat.toText(bounty_id) # ") returned: " # debug_show (result);
          Debug.print(msg);
          msg;
        } catch (e) {
          let msg = "debug_get_bounty(" # Nat.toText(bounty_id) # ") threw error: " # Error.message(e);
          Debug.print(msg);
          msg;
        };
      };
      case (null) {
        let msg = "debug_get_bounty: registry_canister_id is not set";
        Debug.print(msg);
        msg;
      };
    };
  };
};
