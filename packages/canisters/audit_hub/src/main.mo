// packages/canisters/audit_hub/src/Main.mo
import Map "mo:map/Map";
import { thash; phash } "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import ICRC2 "mo:icrc2-types";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Blob "mo:base/Blob";
import Text "mo:base/Text";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Base16 "mo:base16/Base16";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Option "mo:base/Option";
import Iter "mo:base/Iter";
import ICRC127Lib "../../../../libs/icrc127/src/lib";
import ICRC127Service "../../../../libs/icrc127/src/service";
import ClassPlus "mo:class-plus";
import TimerTool "mo:timer-tool";
import LogLib "mo:stable-local-log";
import ICRC3 "mo:icrc3-mo";
import CertTree "mo:ic-certification/CertTree";

import Admin "Admin";
import ApiKey "ApiKey";
import McpRegistry "McpRegistry";
import Types "Types";
import Account "Account";
import StakePool "StakePool";
import BountyLock "BountyLock";
import Bounty "Bounty";
import JobQueue "JobQueue";
import QueryMethods "QueryMethods";
import Config "Config";
import JobAssignment "JobAssignment";
import Treasury "Treasury";

// (
//   with migration = func(
//     old_state : {
//       var wasm_verifier_assignments : Map.Map<Text, Map.Map<Principal, Bool>>;
//     }
//   ) : {
//     // Explicitly discard wasm_verifier_assignments (replaced by job_verifier_assignments)
//     // The old map tracked by wasm_id, the new map tracks by queue_key (wasm_id::audit_type::timestamp)
//     // This allows verifiers to work on different audit types and re-audits over time
//   } {
//     // Return empty state - wasm_verifier_assignments is discarded
//     {};
//   }
// )
shared ({ caller = deployer }) persistent actor class AuditHub() = this {

  // The duration a lock is valid before it expires (10 mins for automated builds).
  let LOCK_DURATION_NS : Int = 10 * 60 * 1_000_000_000; // 10 minutes in nanoseconds

  // Maximum number of pending jobs to check per verifier request
  // This prevents excessive inter-canister calls when many jobs are pending
  let MAX_JOBS_TO_CHECK : Nat = 20;

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

  // Temporary deny list for problematic verifier nodes
  // Admin can add/remove principals to temporarily block them from receiving job assignments
  var verifier_deny_list = Map.new<Principal, Bool>();

  // ==================================================================================
  // == JOB QUEUE STATE
  // ==================================================================================

  // Pending audits for verified WASMs (tools_v1, etc.) - keyed by wasm_id::audit_type
  // BTree<wasm_id::audit_type, VerificationJob>
  var pending_audits = BTree.init<Text, Types.VerificationJob>(null);

  // Currently assigned jobs
  // Map<BountyId, AssignedJob>
  var assigned_jobs = Map.new<Types.BountyId, Types.AssignedJob>();

  // Track which verifiers have been assigned to which jobs (to prevent duplicate assignments)
  // Uses queue_key (wasm_id::audit_type::timestamp) instead of just wasm_id to allow:
  // - Same verifier to work on different audit types for the same WASM
  // - Same verifier to work on re-audits of the same WASM+audit_type over time
  // Map<queue_key, Set<Principal>>
  var job_verifier_assignments = Map.new<Text, Map.Map<Principal, Bool>>();

  // ==================================================================================
  // == ICRC127 LOCAL BOUNTY SYSTEM
  // ==================================================================================

  // ClassPlus manager for all library instances
  transient let initManager = ClassPlus.ClassPlusInitializationManager(owner, Principal.fromActor(this), false);

  // TimerTool setup
  var tt_migration_state : TimerTool.State = TimerTool.initialState();
  transient let tt = TimerTool.Init<system>({
    manager = initManager;
    initialState = tt_migration_state;
    args = null;
    pullEnvironment = ?(
      func() : TimerTool.Environment {
        {
          advanced = null;
          reportExecution = null;
          reportError = null;
          syncUnsafe = null;
          reportBatch = null;
        };
      }
    );
    onInitialize = ?(
      func(newClass : TimerTool.TimerTool) : async* () {
        Debug.print("Initializing TimerTool");
        newClass.initialize<system>();
      }
    );
    onStorageChange = func(state : TimerTool.State) {
      tt_migration_state := state;
    };
  });

  // Local log setup
  var localLog_migration_state : LogLib.State = LogLib.initialState();
  transient let localLog = LogLib.Init<system>({
    args = ?{
      min_level = ?#Debug;
      bufferSize = ?5000;
    };
    manager = initManager;
    initialState = localLog_migration_state;
    pullEnvironment = ?(
      func() : LogLib.Environment {
        {
          tt = tt();
          advanced = null;
          onEvict = null;
        };
      }
    );
    onInitialize = null;
    onStorageChange = func(state : LogLib.State) {
      localLog_migration_state := state;
    };
  });

  // ==================================================================================
  // == ICRC3 INTEGRATION
  // ==================================================================================

  stable let cert_store : CertTree.Store = CertTree.newStore();
  transient let ct = CertTree.Ops(cert_store);

  private func get_certificate_store() : CertTree.Store {
    cert_store;
  };

  private func updated_certification(cert : Blob, lastIndex : Nat) : Bool {
    ct.setCertifiedData();
    true;
  };

  private func get_icrc3_environment() : ICRC3.Environment {
    {
      updated_certification = ?updated_certification;
      get_certificate_store = ?get_certificate_store;
    };
  };

  stable var icrc3_migration_state = ICRC3.initialState();
  transient let icrc3 = ICRC3.Init<system>({
    manager = initManager;
    initialState = icrc3_migration_state;
    args = null;
    pullEnvironment = ?get_icrc3_environment;
    onInitialize = ?(
      func(newClass : ICRC3.ICRC3) : async* () {
        if (newClass.stats().supportedBlocks.size() == 0) {
          newClass.update_supported_blocks([
            { block_type = "127mint"; url = "https://github.com/icdevs/ICRCs" },
            { block_type = "127burn"; url = "https://github.com/icdevs/ICRCs" },
            {
              block_type = "127transfer";
              url = "https://github.com/icdevs/ICRCs";
            },
          ]);
        };
      }
    );
    onStorageChange = func(state : ICRC3.State) {
      icrc3_migration_state := state;
    };
  });

  // Helper function to convert ICRC127 ICRC16 values to ICRC3 Values
  private func convertIcrc127ValueToIcrc3Value(val : ICRC127Lib.ICRC16) : ICRC3.Value {
    switch (val) {
      case (#Nat(n)) { return #Nat(n) };
      case (#Int(i)) { return #Int(i) };
      case (#Text(t)) { return #Text(t) };
      case (#Blob(b)) { return #Blob(b) };
      case (#Array(arr)) {
        let converted_arr = Array.map<ICRC127Lib.ICRC16, ICRC3.Value>(arr, convertIcrc127ValueToIcrc3Value);
        return #Array(converted_arr);
      };
      case (#Map(map)) {
        let converted_map = Array.map<(Text, ICRC127Lib.ICRC16), (Text, ICRC3.Value)>(map, func((k, v)) { (k, convertIcrc127ValueToIcrc3Value(v)) });
        return #Map(converted_map);
      };
      case (#Bool(b)) { return #Text(debug_show (b)) };
      case (#Principal(p)) { return #Text(Principal.toText(p)) };
      case (_) {
        return #Text("Unsupported ICRC-3 Value Type");
      };
    };
  };

  // Validation hook for WASM verification submissions
  // Called by ICRC127 when a verifier submits a bounty claim
  // This verifies that the claimant actually submitted an attestation or divergence to the registry
  private func _validate_verification_submission(
    req : ICRC127Service.RunBountyRequest
  ) : async ICRC127Service.RunBountyResult {
    Debug.print("Validating bounty submission " # Nat.toText(req.bounty_id));

    // Get the verifier principal from the bounty lock
    let verifier = switch (Map.get(_bounty_verifier_map, Map.nhash, req.bounty_id)) {
      case (?v) { v };
      case (null) {
        Debug.print("No verifier found for bounty " # Nat.toText(req.bounty_id));
        return {
          result = #Invalid;
          metadata = #Map([("error", #Text("bounty not reserved"))]);
          trx_id = null;
        };
      };
    };

    // Extract wasm_id and audit_type from challenge_parameters
    let challenge_data = switch (req.challenge_parameters) {
      case (#Map(m)) { m };
      case (_) {
        Debug.print("Invalid challenge_parameters: not a map");
        return {
          result = #Invalid;
          metadata = #Map([("error", #Text("invalid challenge_parameters"))]);
          trx_id = null;
        };
      };
    };

    var wasm_id_opt : ?Text = null;
    var audit_type_opt : ?Text = null;

    for ((key, value) in challenge_data.vals()) {
      if (key == "wasm_id") {
        switch (value) {
          case (#Text(t)) { wasm_id_opt := ?t };
          case (_) {};
        };
      } else if (key == "audit_type") {
        switch (value) {
          case (#Text(t)) { audit_type_opt := ?t };
          case (_) {};
        };
      };
    };

    let wasm_id = switch (wasm_id_opt) {
      case (?id) { id };
      case (null) {
        Debug.print("Missing wasm_id in challenge_parameters");
        return {
          result = #Invalid;
          metadata = #Map([("error", #Text("missing wasm_id"))]);
          trx_id = null;
        };
      };
    };

    let audit_type = switch (audit_type_opt) {
      case (?at) { at };
      case (null) {
        Debug.print("Missing audit_type in challenge_parameters");
        return {
          result = #Invalid;
          metadata = #Map([("error", #Text("missing audit_type"))]);
          trx_id = null;
        };
      };
    };

    // Call registry to verify the claimant submitted an attestation or divergence
    let registry_id = switch (registry_canister_id) {
      case (?id) { id };
      case (null) {
        Debug.print("Registry canister ID not configured");
        return {
          result = #Invalid;
          metadata = #Map([("error", #Text("registry not configured"))]);
          trx_id = null;
        };
      };
    };

    let registry : McpRegistry.Service = actor (Principal.toText(registry_id));

    // Check if the verifier participated by submitting attestation/divergence
    let has_participated = await registry.has_verifier_participated_in_wasm(
      verifier,
      wasm_id,
      audit_type,
    );

    if (has_participated) {
      Debug.print("✓ Valid: Verifier " # Principal.toText(verifier) # " submitted attestation/divergence for " # wasm_id);
      return {
        result = #Valid;
        metadata = #Map([
          ("wasm_id", #Text(wasm_id)),
          ("audit_type", #Text(audit_type)),
        ]);
        trx_id = null;
      };
    } else {
      Debug.print("✗ Invalid: Verifier " # Principal.toText(verifier) # " has not submitted attestation/divergence for " # wasm_id);
      return {
        result = #Invalid;
        metadata = #Map([
          ("error", #Text("No attestation or divergence found")),
          ("wasm_id", #Text(wasm_id)),
        ]);
        trx_id = null;
      };
    };
  };

  // Stable state for ICRC127 bounty management
  var icrc127_migration_state : ICRC127Lib.State = ICRC127Lib.initialState();

  // ICRC127 instance getter (lazy initialization)
  transient let icrc127 = ICRC127Lib.Init<system>({
    manager = initManager;
    initialState = icrc127_migration_state;
    args = null;
    pullEnvironment = ?(
      func() : ICRC127Lib.Environment {
        {
          tt = tt();
          log = localLog();
          advanced = null; // No ICRC-85 support for now
          add_record = ?(
            func<system>(data : ICRC127Lib.ICRC16, meta : ?ICRC127Lib.ICRC16) : Nat {
              let converted_data = convertIcrc127ValueToIcrc3Value(data);
              let converted_meta = Option.map(meta, convertIcrc127ValueToIcrc3Value);
              icrc3().add_record<system>(converted_data, converted_meta);
            }
          );
          icrc1_fee = func(token_canister : Principal) : async Nat {
            let ledger : ICRC2.Service = actor (Principal.toText(token_canister));
            await ledger.icrc1_fee();
          };
          icrc1_transfer = func(token_canister : Principal, args : ICRC2.TransferArgs) : async ICRC2.TransferResult {
            let ledger : ICRC2.Service = actor (Principal.toText(token_canister));
            await ledger.icrc1_transfer(args);
          };
          icrc2_transfer_from = func(token_canister : Principal, args : ICRC2.TransferFromArgs) : async ICRC2.TransferFromResult {
            let ledger : ICRC2.Service = actor (Principal.toText(token_canister));
            await ledger.icrc2_transfer_from(args);
          };
          validate_submission = _validate_verification_submission;
        };
      }
    );
    onInitialize = ?(
      func(icrc127 : ICRC127Lib.ICRC127Bounty) : async* () {
        Debug.print("ICRC127: Initialized in audit_hub");
      }
    );
    onStorageChange = func(state : ICRC127Lib.State) {
      icrc127_migration_state := state;
    };
  });

  // ==================================================================================
  // == LOCAL BOUNTY ASSIGNMENT HELPERS
  // ==================================================================================

  /**
   * Find an active locked bounty for a verifier from LOCAL bounties.
   * Returns (bounty_id, challenge_params) if found.
   */
  private func _find_active_local_bounty(
    job : Types.VerificationJob,
    verifier : Principal,
    current_time : Int,
  ) : ?(Types.BountyId, ICRC127Lib.ICRC16) {
    label bounty_check for (bounty_id in job.bounty_ids.vals()) {
      switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
        case (?lock) {
          if (Principal.equal(lock.claimant, verifier) and lock.expires_at > current_time) {
            // Check bounty status locally
            let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
            switch (bounty_opt) {
              case (?bounty) {
                if (Option.isNull(bounty.claimed)) {
                  // Active unclaimed bounty
                  Debug.print("Verifier " # Principal.toText(verifier) # " has ACTIVE local bounty " # Nat.toText(bounty_id) # " for WASM " # job.wasm_id);
                  return ?(bounty_id, bounty.challenge_parameters);
                };
              };
              case (null) {};
            };
          };
        };
        case (null) {};
      };
    };
    return null;
  };

  /**
   * Claim an available LOCAL bounty for a verifier.
   * Atomically creates assignment and provisional lock.
   */
  private func _claim_available_local_bounty(
    job : Types.VerificationJob,
    verifier : Principal,
    current_time : Int,
    stake_amount : Types.Balance,
    token_id : Types.TokenId,
  ) : ?Types.BountyId {
    label bounty_search for (bounty_id in job.bounty_ids.vals()) {
      // Skip if already assigned
      if (Option.isSome(Map.get(assigned_jobs, Map.nhash, bounty_id))) {
        continue bounty_search;
      };

      // Check bounty status locally
      let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
      switch (bounty_opt) {
        case (?bounty) {
          // Skip if already claimed
          if (Option.isSome(bounty.claimed)) {
            continue bounty_search;
          };

          // Found available bounty - claim it
          let assignment : Types.AssignedJob = {
            wasm_id = job.wasm_id;
            audit_type = job.audit_type;
            verifier = verifier;
            bounty_id = bounty_id;
            assigned_at = current_time;
            expires_at = current_time + LOCK_DURATION_NS;
          };

          let lock : Types.BountyLock = {
            claimant = verifier;
            expires_at = current_time + LOCK_DURATION_NS;
            stake_amount = stake_amount;
            stake_token_id = token_id;
          };

          ignore Map.put(assigned_jobs, Map.nhash, bounty_id, assignment);
          ignore Map.put(bounty_locks, Map.nhash, bounty_id, lock);
          ignore Map.put(_bounty_verifier_map, Map.nhash, bounty_id, verifier);

          Debug.print("Assigned local bounty " # Nat.toText(bounty_id) # " to verifier " # Principal.toText(verifier));
          return ?bounty_id;
        };
        case (null) {};
      };
    };
    return null;
  };

  /**
   * Get build config from LOCAL bounty's challenge parameters.
   */
  private func _get_local_bounty_build_config(
    bounty_id : Types.BountyId
  ) : ICRC127Lib.ICRC16 {
    let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
    switch (bounty_opt) {
      case (?bounty) {
        return bounty.challenge_parameters;
      };
      case (null) {
        Debug.print("Warning: Could not get local bounty " # Nat.toText(bounty_id) # ", returning empty config");
        return #Map([]);
      };
    };
  };

  // ==================================================================================
  // == HELPER FUNCTIONS
  // ==================================================================================

  private func is_owner(caller : Principal) : Bool {
    return Principal.equal(owner, caller);
  };

  // Check if caller is authorized for consensus operations (owner or registry)
  private func _is_authorized_for_consensus(caller : Principal) : Bool {
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

  // Admin method to add bounties to a specific job by exact queue key
  public shared (msg) func admin_add_bounties_by_queue_key(
    queue_key : Text,
    additional_bounty_ids : [Nat],
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can call this method");
    };

    switch (BTree.get(pending_audits, Text.compare, queue_key)) {
      case (null) {
        #err("No verification job found for queue_key: " # queue_key);
      };
      case (?job) {
        let merged = Buffer.Buffer<Nat>(job.bounty_ids.size() + additional_bounty_ids.size());
        for (id in job.bounty_ids.vals()) {
          merged.add(id);
        };
        for (id in additional_bounty_ids.vals()) {
          merged.add(id);
        };

        let updated_job : Types.VerificationJob = {
          job with bounty_ids = Buffer.toArray(merged);
        };

        ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);
        Debug.print("Added " # Nat.toText(additional_bounty_ids.size()) # " bounty_ids to job " # queue_key # ". Total now: " # Nat.toText(updated_job.bounty_ids.size()));
        #ok();
      };
    };
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

  /// Withdraw USDC or other ICRC-2 tokens from the audit_hub treasury
  /// Only the owner can call this function
  public shared ({ caller }) func withdraw(
    ledger_id : Principal,
    amount : Nat,
    destination : ICRC2.Account,
  ) : async Result.Result<Nat, Treasury.TreasuryError> {
    await Treasury.withdraw(caller, owner, ledger_id, amount, destination);
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

  /**
   * Admin method to manually add a verifier to job_verifier_assignments.
   * Used for migration or manual fixes when verifiers have already participated but aren't tracked.
   * @param queue_key - The job queue key (wasm_id::audit_type::timestamp)
   * @param verifier - The verifier principal to add
   */
  public shared (msg) func admin_add_verifier_to_job(
    queue_key : Text,
    verifier : Principal,
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can call this method");
    };

    // Get or create the assignments map for this job
    let assignments = switch (Map.get(job_verifier_assignments, thash, queue_key)) {
      case (?existing) { existing };
      case (null) {
        let new_map = Map.new<Principal, Bool>();
        Map.set(job_verifier_assignments, thash, queue_key, new_map);
        new_map;
      };
    };

    // Add the verifier
    Map.set(assignments, phash, verifier, true);

    Debug.print("Admin: Added verifier " # Principal.toText(verifier) # " to job " # queue_key);
    #ok();
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
      verifier_stats,
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
    // --- NEW: Validate that verifier hasn't already participated in this WASM verification ---
    // 1. Get verifier principal from API key
    let verifier = switch (Map.get(api_credentials, Map.thash, api_key)) {
      case (null) { return #err("Invalid API key.") };
      case (?cred) {
        if (not cred.is_active) {
          return #err("API key has been revoked.");
        };
        cred.verifier_principal;
      };
    };

    // 2. Get bounty details from registry to extract wasm_id
    switch (registry_canister_id) {
      case (null) {
        return #err("Registry canister ID not configured.");
      };
      case (?registry_id) {
        let registry : McpRegistry.Service = actor (Principal.toText(registry_id));

        // Get bounty details
        let bounty_opt = await registry.icrc127_get_bounty(bounty_id);
        switch (bounty_opt) {
          case (null) {
            return #err("Bounty not found in registry.");
          };
          case (?bounty) {
            // Extract wasm_id from challenge_parameters
            let wasm_id_opt = switch (bounty.challenge_parameters) {
              case (#Map(params)) {
                // Find wasm_hash in the map
                var found_wasm_hash : ?Blob = null;
                label findWasm for ((key, value) in params.vals()) {
                  if (key == "wasm_hash") {
                    switch (value) {
                      case (#Blob(b)) {
                        found_wasm_hash := ?b;
                        break findWasm;
                      };
                      case (_) {};
                    };
                  };
                };

                // Convert Blob to hex string using Base16
                switch (found_wasm_hash) {
                  case (?hash) {
                    ?Base16.encode(hash);
                  };
                  case (null) { null };
                };
              };
              case (_) { null }; // Handle all other ICRC16 variants
            };

            switch (wasm_id_opt) {
              case (null) {
                return #err("Bounty challenge_parameters missing wasm_hash.");
              };
              case (?wasm_id) {
                // Check if verifier has already participated
                let has_participated = await registry.has_verifier_participated_in_wasm(verifier, wasm_id, audit_type);
                if (has_participated) {
                  return #err("You have already participated in the verification of this WASM. Each verifier can only submit one report per WASM.");
                };
              };
            };
          };
        };
      };
    };
    // --- END NEW CHECK ---

    BountyLock.reserve_bounty_with_api_key(
      api_key,
      bounty_id,
      audit_type,
      api_credentials,
      bounty_locks,
      stake_requirements,
      available_balances,
      staked_balances,
      verifier_stats,
      LOCK_DURATION_NS,
      _record_api_key_usage,
    );
  };

  // Called by the registry after successful verification to return the stake and update reputation.
  // Can also be called by the owner for administrative purposes.
  public shared (msg) func release_stake(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    // Check if caller is owner or registry
    let is_owner = Principal.equal(msg.caller, owner);
    let is_registry = switch (registry_canister_id) {
      case (null) { false };
      case (?registry_id) { Principal.equal(msg.caller, registry_id) };
    };

    if (not is_owner and not is_registry) {
      return #err("Unauthorized: Only the owner or registry canister can call this method.");
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
   * Can also be called by the owner for administrative purposes.
   */
  public shared (msg) func slash_stake_for_incorrect_consensus(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    // Check if caller is owner or registry
    let is_owner = Principal.equal(msg.caller, owner);
    let is_registry = switch (registry_canister_id) {
      case (null) { false };
      case (?registry_id) { Principal.equal(msg.caller, registry_id) };
    };

    if (not is_owner and not is_registry) {
      return #err("Unauthorized: Only the owner or registry canister can call this method.");
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

  // Admin function to force-release a lock (even if not expired) in case of bugs.
  public shared (msg) func admin_force_release_lock(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    if (not Principal.equal(msg.caller, owner)) {
      return #err("Only owner can force-release locks");
    };

    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("No lock found for this bounty") };
      case (?lock) {
        // Return stake to verifier (no slashing since this might be a bug, not abandonment)
        let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
        Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

        let current_available = Account.get_balance(available_balances, lock.claimant, lock.stake_token_id);
        Account.set_balance(available_balances, lock.claimant, lock.stake_token_id, current_available + lock.stake_amount);

        // Delete the lock
        Map.delete(bounty_locks, Map.nhash, bounty_id);

        // Also remove assignment if it exists and decrement job assigned_count
        switch (Map.remove(assigned_jobs, Map.nhash, bounty_id)) {
          case (?assignment) {
            // Find the job in pending_audits by searching for matching wasm_id and audit_type
            for ((queue_key, job) in BTree.entries(pending_audits)) {
              if (job.wasm_id == assignment.wasm_id and job.audit_type == assignment.audit_type) {
                let updated_job : Types.VerificationJob = {
                  wasm_id = job.wasm_id;
                  repo = job.repo;
                  commit_hash = job.commit_hash;
                  build_config = job.build_config;
                  created_at = job.created_at;
                  required_verifiers = job.required_verifiers;
                  assigned_count = if (job.assigned_count > 0) {
                    job.assigned_count - 1;
                  } else { 0 };
                  completed_count = job.completed_count;
                  bounty_ids = job.bounty_ids;
                  audit_type = job.audit_type;
                  creator = job.creator;
                };
                ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);
                Debug.print("Decremented assigned_count for job " # queue_key # " from " # Nat.toText(job.assigned_count) # " to " # Nat.toText(updated_job.assigned_count));
              };
            };
          };
          case (null) {};
        };

        // Clear from bounty-verifier map
        ignore Map.remove(_bounty_verifier_map, Map.nhash, bounty_id);

        Debug.print("Admin force-released lock for bounty " # Nat.toText(bounty_id));
        return #ok();
      };
    };
  };

  /**
   * Admin function to manually fix a job's assigned_count
   * Useful when locks are released but assigned_count wasn't decremented
   */
  public shared (msg) func admin_fix_job_assigned_count(
    queue_key : Text,
    new_assigned_count : Nat,
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can call this method");
    };

    switch (BTree.get(pending_audits, Text.compare, queue_key)) {
      case (?job) {
        let updated_job : Types.VerificationJob = {
          wasm_id = job.wasm_id;
          repo = job.repo;
          commit_hash = job.commit_hash;
          build_config = job.build_config;
          created_at = job.created_at;
          required_verifiers = job.required_verifiers;
          assigned_count = new_assigned_count;
          completed_count = job.completed_count;
          bounty_ids = job.bounty_ids;
          audit_type = job.audit_type;
          creator = job.creator;
        };
        ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);
        Debug.print("Updated job " # queue_key # " assigned_count to " # Nat.toText(new_assigned_count));
        #ok();
      };
      case (null) {
        #err("Job not found: " # queue_key);
      };
    };
  };

  // Admin function to manually claim a bounty on behalf of a verifier
  // Used when old verifier nodes filed attestations/divergences but didn't claim
  public shared (msg) func admin_claim_bounty_for_verifier(
    bounty_id : Types.BountyId,
    verifier : Principal,
    wasm_id : Text,
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can call this method");
    };

    // Submit the claim on behalf of the verifier
    let claim_request : ICRC127Service.BountySubmissionRequest = {
      bounty_id = bounty_id;
      account = ?{ owner = verifier; subaccount = null };
      submission = #Map([("wasm_id", #Text(wasm_id))]);
    };

    let result = await icrc127().icrc127_submit_bounty(verifier, claim_request);

    // Clean up any remaining locks/assignments
    ignore Map.remove(bounty_locks, Map.nhash, bounty_id);
    ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
    ignore Map.remove(_bounty_verifier_map, Map.nhash, bounty_id);

    switch (result) {
      case (#Ok(_)) {
        Debug.print("Admin claimed bounty " # Nat.toText(bounty_id) # " for verifier " # Principal.toText(verifier));
        #ok();
      };
      case (#Error(err)) {
        let errMsg = switch (err) {
          case (#InsufficientAllowance) { "InsufficientAllowance" };
          case (#Generic(msg)) { "Generic: " # msg };
        };
        #err("Failed to claim bounty: " # errMsg);
      };
    };
  };

  // Admin function to clear a bounty-verifier mapping (for stuck state recovery)
  public shared (msg) func admin_clear_bounty_verifier(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    if (not Principal.equal(msg.caller, owner)) {
      return #err("Only owner can clear bounty-verifier mappings");
    };

    ignore Map.remove(_bounty_verifier_map, Map.nhash, bounty_id);
    Debug.print("Admin cleared bounty-verifier mapping for bounty " # Nat.toText(bounty_id));
    return #ok();
  };

  /**
   * Add a verifier to the deny list (temporarily blocks them from receiving jobs).
   * Use this for problematic nodes until they upgrade.
   */
  public shared (msg) func admin_add_to_deny_list(verifier : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can modify deny list");
    };

    Map.set(verifier_deny_list, phash, verifier, true);
    Debug.print("Added verifier " # Principal.toText(verifier) # " to deny list");
    return #ok();
  };

  /**
   * Remove a verifier from the deny list.
   */
  public shared (msg) func admin_remove_from_deny_list(verifier : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can modify deny list");
    };

    ignore Map.remove(verifier_deny_list, phash, verifier);
    Debug.print("Removed verifier " # Principal.toText(verifier) # " from deny list");
    return #ok();
  };

  /**
   * Get the current deny list.
   */
  public shared query func get_deny_list() : async [Principal] {
    let buffer = Buffer.Buffer<Principal>(0);
    for ((verifier, _) in Map.entries(verifier_deny_list)) {
      buffer.add(verifier);
    };
    Buffer.toArray(buffer);
  };

  /**
   * Admin function to clean up staked balances from deleted/non-existent bounties.
   * This will check all bounty locks and return stakes to available for bounties that don't exist.
   */
  public shared (msg) func admin_cleanup_orphaned_stakes() : async Result.Result<Text, Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only owner can cleanup orphaned stakes");
    };

    let buffer = Buffer.Buffer<Nat>(0);
    var total_released : Nat = 0;
    var total_amount : Nat = 0;

    // Collect all bounty IDs from locks
    let bounty_ids = Buffer.Buffer<Nat>(0);
    for ((bounty_id, _) in Map.entries(bounty_locks)) {
      bounty_ids.add(bounty_id);
    };

    // Check each locked bounty to see if it still exists
    for (bounty_id in bounty_ids.vals()) {
      let bounty_result = icrc127().icrc127_get_bounty(bounty_id);

      switch (bounty_result) {
        case (null) {
          // Bounty doesn't exist - release the stake
          switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
            case (?lock) {
              // Return stake to verifier
              let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
              Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

              let current_available = Account.get_balance(available_balances, lock.claimant, lock.stake_token_id);
              Account.set_balance(available_balances, lock.claimant, lock.stake_token_id, current_available + lock.stake_amount);

              // Delete the lock and related data
              Map.delete(bounty_locks, Map.nhash, bounty_id);

              // Remove assignment and decrement job assigned_count
              switch (Map.remove(assigned_jobs, Map.nhash, bounty_id)) {
                case (?assignment) {
                  // Find and update the job
                  for ((queue_key, job) in BTree.entries(pending_audits)) {
                    if (job.wasm_id == assignment.wasm_id and job.audit_type == assignment.audit_type) {
                      let updated_job : Types.VerificationJob = {
                        wasm_id = job.wasm_id;
                        repo = job.repo;
                        commit_hash = job.commit_hash;
                        build_config = job.build_config;
                        created_at = job.created_at;
                        required_verifiers = job.required_verifiers;
                        assigned_count = if (job.assigned_count > 0) {
                          job.assigned_count - 1;
                        } else { 0 };
                        completed_count = job.completed_count;
                        bounty_ids = job.bounty_ids;
                        audit_type = job.audit_type;
                        creator = job.creator;
                      };
                      ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);
                    };
                  };
                };
                case (null) {};
              };

              ignore Map.remove(_bounty_verifier_map, Map.nhash, bounty_id);

              buffer.add(bounty_id);
              total_released += 1;
              total_amount += lock.stake_amount;

              Debug.print("Cleaned up orphaned stake for bounty " # Nat.toText(bounty_id) # " - returned " # Nat.toText(lock.stake_amount) # " to " # Principal.toText(lock.claimant));
            };
            case (null) {};
          };
        };
        case (?bounty) {
          // Bounty exists - check if it's been claimed and lock is stale
          switch (bounty.claimed) {
            case (?claimed_date) {
              // Bounty was claimed - release the lock if it still exists
              switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
                case (?lock) {
                  // Return stake to verifier
                  let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
                  Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

                  let current_available = Account.get_balance(available_balances, lock.claimant, lock.stake_token_id);
                  Account.set_balance(available_balances, lock.claimant, lock.stake_token_id, current_available + lock.stake_amount);

                  // Delete the lock and related data
                  Map.delete(bounty_locks, Map.nhash, bounty_id);

                  // Remove assignment and decrement job assigned_count
                  switch (Map.remove(assigned_jobs, Map.nhash, bounty_id)) {
                    case (?assignment) {
                      // Find and update the job
                      for ((queue_key, job) in BTree.entries(pending_audits)) {
                        if (job.wasm_id == assignment.wasm_id and job.audit_type == assignment.audit_type) {
                          let updated_job : Types.VerificationJob = {
                            wasm_id = job.wasm_id;
                            repo = job.repo;
                            commit_hash = job.commit_hash;
                            build_config = job.build_config;
                            created_at = job.created_at;
                            required_verifiers = job.required_verifiers;
                            assigned_count = if (job.assigned_count > 0) {
                              job.assigned_count - 1;
                            } else { 0 };
                            completed_count = job.completed_count;
                            bounty_ids = job.bounty_ids;
                            audit_type = job.audit_type;
                            creator = job.creator;
                          };
                          ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);
                        };
                      };
                    };
                    case (null) {};
                  };

                  ignore Map.remove(_bounty_verifier_map, Map.nhash, bounty_id);

                  buffer.add(bounty_id);
                  total_released += 1;
                  total_amount += lock.stake_amount;

                  Debug.print("Cleaned up stale lock for claimed bounty " # Nat.toText(bounty_id) # " - returned " # Nat.toText(lock.stake_amount) # " to " # Principal.toText(lock.claimant));
                };
                case (null) {};
              };
            };
            case (null) {
              // Bounty exists and not claimed - keep the lock
            };
          };
        };
      };
    };

    let cleaned_bounties = Buffer.toArray(buffer);
    let summary = "Cleaned up " # Nat.toText(total_released) # " orphaned/stale stakes, released " # Nat.toText(total_amount) # " tokens total. Bounty IDs: " # debug_show (cleaned_bounties);
    Debug.print(summary);
    #ok(summary);
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
    audit_type : Text,
    required_verifiers : Nat,
    bounty_ids : [Types.BountyId],
  ) : async Result.Result<(), Text> {
    let result = JobQueue.add_verification_job(
      pending_audits,
      wasm_id,
      repo,
      commit_hash,
      build_config,
      audit_type,
      required_verifiers,
      bounty_ids,
      msg.caller,
      registry_canister_id,
      bounty_sponsor_canister_id,
    );

    // Note: This function is called by legacy mcp_registry with external bounty_ids
    // For new integrations, use create_local_bounties_for_job after adding the job
    result;
  };

  /**
   * Create local bounties for a verification job.
   * This enables local bounty management instead of relying on mcp_registry.
   * Can be called by authorized canisters (registry, bounty_sponsor) or owner.
   *
   * @param wasm_id - The WASM ID
   * @param audit_type - The audit type (e.g., "build_reproducibility_v1")
   * @param num_bounties - Number of bounties to create
   * @param reward_amount - Reward amount per bounty (in token atomic units)
   * @param reward_token - Token canister ID for rewards
   * @param timeout_date - Expiration timestamp for bounties
   */
  public shared (msg) func create_local_bounties_for_job(
    wasm_id : Text,
    audit_type : Text,
    num_bounties : Nat,
    reward_amount : Nat,
    reward_token : Principal,
    timeout_date : Int,
  ) : async Result.Result<[Nat], Text> {
    // Check authorization
    var authorized = false;
    if (is_owner(msg.caller)) {
      authorized := true;
    } else {
      switch (registry_canister_id) {
        case (?registry_id) {
          if (Principal.equal(msg.caller, registry_id)) {
            authorized := true;
          };
        };
        case (null) {};
      };
    };
    if (not authorized) {
      switch (bounty_sponsor_canister_id) {
        case (?sponsor_id) {
          if (Principal.equal(msg.caller, sponsor_id)) {
            authorized := true;
          };
        };
        case (null) {};
      };
    };
    if (not authorized) {
      return #err("Only owner, registry, or bounty_sponsor can create bounties");
    };

    // Find the most recent job matching wasm_id and audit_type
    let prefix = wasm_id # "::" # audit_type # "::";
    var matching_job : ?Types.VerificationJob = null;
    var matching_key : ?Text = null;

    for ((key, job) in BTree.entries(pending_audits)) {
      if (Text.size(key) >= Text.size(prefix)) {
        let chars = Text.toIter(key);
        var i = 0;
        var matches = true;
        label char_check for (c in Text.toIter(prefix)) {
          switch (chars.next()) {
            case (?key_char) {
              if (key_char != c) {
                matches := false;
                break char_check;
              };
            };
            case (null) {
              matches := false;
              break char_check;
            };
          };
        };
        if (matches) {
          // Found a matching job - use the most recent one
          switch (matching_job) {
            case (null) {
              matching_job := ?job;
              matching_key := ?key;
            };
            case (?existing) {
              if (job.created_at > existing.created_at) {
                matching_job := ?job;
                matching_key := ?key;
              };
            };
          };
        };
      };
    };

    let job = switch (matching_job) {
      case (?j) { j };
      case (null) {
        return #err("Job not found for wasm_id: " # wasm_id # ", audit_type: " # audit_type);
      };
    };

    let queue_key = switch (matching_key) {
      case (?k) { k };
      case (null) {
        return #err("Job key not found");
      };
    };

    // Create bounties
    let created_bounty_ids = Buffer.Buffer<Nat>(num_bounties);

    for (i in Iter.range(0, num_bounties - 1)) {
      let bounty_metadata : Types.ICRC16Map = [
        ("icrc127:reward_canister", #Principal(reward_token)),
        ("icrc127:reward_amount", #Nat(reward_amount)),
        ("wasm_id", #Text(wasm_id)),
        ("audit_type", #Text(audit_type)),
        ("repo", #Text(job.repo)),
        ("commit_hash", #Text(job.commit_hash)),
      ];

      let challenge_parameters : Types.ICRC16Map = [
        ("wasm_id", #Text(wasm_id)),
        ("repo", #Text(job.repo)),
        ("commit_hash", #Text(job.commit_hash)),
        ("audit_type", #Text(audit_type)),
      ];

      let create_req : ICRC127Service.CreateBountyRequest = {
        bounty_id = null; // Let ICRC127 assign ID
        validation_canister_id = Principal.fromActor(this);
        bounty_metadata = bounty_metadata;
        challenge_parameters = #Map(challenge_parameters);
        timeout_date = Int.abs(timeout_date);
        start_date = null;
      };

      let create_result = await icrc127().icrc127_create_bounty(msg.caller, create_req);

      switch (create_result) {
        case (#Ok(result)) {
          created_bounty_ids.add(result.bounty_id);
          Debug.print("Created local bounty " # Nat.toText(result.bounty_id) # " for job " # queue_key);
        };
        case (#Error(err)) {
          // Rollback not implemented - bounties already created will remain
          return #err("Failed to create bounty " # Nat.toText(i) # ": " # debug_show (err));
        };
      };
    };

    // Update job with new bounty_ids
    let updated_job : Types.VerificationJob = {
      wasm_id = job.wasm_id;
      repo = job.repo;
      commit_hash = job.commit_hash;
      build_config = job.build_config;
      created_at = job.created_at;
      required_verifiers = job.required_verifiers;
      assigned_count = job.assigned_count;
      completed_count = job.completed_count;
      bounty_ids = Array.append(job.bounty_ids, Buffer.toArray(created_bounty_ids));
      audit_type = job.audit_type;
      creator = job.creator;
    };

    ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);

    Debug.print("Created " # Nat.toText(created_bounty_ids.size()) # " local bounties for job " # queue_key);
    #ok(Buffer.toArray(created_bounty_ids));
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
   * Uses ONLY local bounties (no legacy mcp_registry bounties).
   */
  private func _process_audit_job(
    queue_key : Text,
    job : Types.VerificationJob,
    verifier : Principal,
    current_time : Int,
  ) : async ?Result.Result<Types.VerificationJobAssignment, Text> {
    let wasm_id = job.wasm_id;

    // 0. Check if job is already complete (all bounties claimed)
    var completed_count : Nat = 0;
    for (bounty_id in job.bounty_ids.vals()) {
      switch (icrc127().icrc127_get_bounty(bounty_id)) {
        case (?bounty) {
          if (bounty.claims.size() > 0) {
            completed_count += 1;
          };
        };
        case (null) {};
      };
    };

    Debug.print("Job " # queue_key # " completion check: " # Nat.toText(completed_count) # "/" # Nat.toText(job.required_verifiers) # " claimed");

    if (completed_count >= job.required_verifiers) {
      Debug.print("Job " # queue_key # " is already complete (" # Nat.toText(completed_count) # "/" # Nat.toText(job.required_verifiers) # " claimed) - skipping assignment");
      return null;
    };

    // 1. Check for active LOCAL bounty
    let active_local_bounty = JobAssignment.find_active_local_bounty(
      job,
      verifier,
      bounty_locks,
      icrc127,
      current_time,
    );
    switch (active_local_bounty) {
      case (?(bounty_id, challenge_params)) {
        Debug.print("Returning active LOCAL bounty " # Nat.toText(bounty_id) # " to verifier " # Principal.toText(verifier));

        // Ensure assignment exists in assigned_jobs (create if missing)
        switch (Map.get(assigned_jobs, Map.nhash, bounty_id)) {
          case (null) {
            // Assignment doesn't exist - create it
            let lock_expires = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
              case (?lock) { lock.expires_at };
              case (null) { current_time + LOCK_DURATION_NS };
            };
            let assignment : Types.AssignedJob = {
              verifier = verifier;
              wasm_id = wasm_id;
              audit_type = switch (JobQueue.get_audit_type_from_metadata(job.build_config)) {
                case (?at) { at };
                case (null) { "build_reproducibility_v1" };
              };
              bounty_id = bounty_id;
              assigned_at = current_time;
              expires_at = lock_expires;
            };
            ignore Map.put(assigned_jobs, Map.nhash, bounty_id, assignment);
            Debug.print("Created missing assignment entry for bounty " # Nat.toText(bounty_id));
          };
          case (?_existing) {
            // Assignment already exists - this is expected
          };
        };

        return ?#ok(
          JobAssignment.create_job_assignment(
            bounty_id,
            wasm_id,
            job.repo,
            job.commit_hash,
            challenge_params,
            switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
              case (?lock) { lock.expires_at };
              case (null) { current_time + LOCK_DURATION_NS };
            },
          )
        );
      };
      case (null) {};
    };

    // 2. No active bounty - try to assign a new one
    Debug.print("Job " # queue_key # " - Checking assignment availability: assigned_count=" # Nat.toText(job.assigned_count) # ", required=" # Nat.toText(job.required_verifiers));
    if (job.assigned_count < job.required_verifiers) {
      Debug.print("Found audit job needing verification: " # queue_key # " (" # Nat.toText(job.assigned_count) # "/" # Nat.toText(job.required_verifiers) # " assigned)");

      // Determine audit_type and stake requirement
      let audit_type = switch (JobQueue.get_audit_type_from_metadata(job.build_config)) {
        case (?at) { at };
        case (null) { "build_reproducibility_v1" };
      };

      // Check if verifier already has a bounty for this verification job
      var already_participating = false;
      label check_participation for (bounty_id in job.bounty_ids.vals()) {
        switch (Map.get(_bounty_verifier_map, Map.nhash, bounty_id)) {
          case (?assigned_verifier) {
            if (Principal.equal(assigned_verifier, verifier)) {
              Debug.print("Verifier " # Principal.toText(verifier) # " already has bounty " # Nat.toText(bounty_id) # " for this verification job - skipping");
              already_participating := true;
              break check_participation;
            };
          };
          case (null) {};
        };
      };

      if (already_participating) {
        return null;
      };

      // Check if verifier has already been assigned to this specific job (permanent record)
      let already_assigned_to_job = switch (Map.get(job_verifier_assignments, thash, queue_key)) {
        case (?assignments) {
          switch (Map.get(assignments, phash, verifier)) {
            case (?true) { true };
            case (_) { false };
          };
        };
        case (null) { false };
      };

      if (already_assigned_to_job) {
        Debug.print("Verifier " # Principal.toText(verifier) # " has already been assigned to job " # queue_key # " - skipping");
        return null;
      };

      let (token_id, stake_amount) = switch (Map.get(stake_requirements, thash, audit_type)) {
        case (?(tid, amt)) { (tid, amt) };
        case (null) {
          Debug.print("Warning: No stake requirement configured for audit_type '" # audit_type # "'");
          return ?#err("No stake requirement configured for audit type: " # audit_type);
        };
      };

      // Try to claim a LOCAL bounty
      if (job.bounty_ids.size() > 0) {
        let local_bounty_id = JobAssignment.claim_available_local_bounty(
          job,
          verifier,
          current_time,
          LOCK_DURATION_NS,
          stake_amount,
          token_id,
          assigned_jobs,
          bounty_locks,
          icrc127,
        );

        switch (local_bounty_id) {
          case (?bounty_id) {
            // Successfully claimed LOCAL bounty
            let bounty_build_config = JobAssignment.get_local_bounty_build_config(
              bounty_id,
              job,
              icrc127,
            );

            // Reserve the bounty with stake
            switch (await _reserve_bounty_internal(verifier, bounty_id, token_id, stake_amount)) {
              case (#err(e)) {
                ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
                ignore Map.remove(bounty_locks, Map.nhash, bounty_id);
                return ?#err("Failed to reserve LOCAL bounty: " # e);
              };
              case (#ok()) {};
            };

            // Track that this verifier has been assigned to this job (permanent record)
            let job_assignments = switch (Map.get(job_verifier_assignments, thash, queue_key)) {
              case (?existing) { existing };
              case (null) {
                let new_map = Map.new<Principal, Bool>();
                ignore Map.put(job_verifier_assignments, thash, queue_key, new_map);
                new_map;
              };
            };
            ignore Map.put(job_assignments, phash, verifier, true);

            // Update job assignment count
            let updated_job : Types.VerificationJob = {
              job with assigned_count = job.assigned_count + 1;
            };
            ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);

            Debug.print("✓ Assigned LOCAL bounty " # Nat.toText(bounty_id) # " to verifier (wasm=" # wasm_id # ", audit_type=" # audit_type # ")");

            return ?#ok(
              JobAssignment.create_job_assignment(
                bounty_id,
                wasm_id,
                job.repo,
                job.commit_hash,
                bounty_build_config,
                current_time + LOCK_DURATION_NS,
              )
            );
          };
          case (null) {
            Debug.print("No available LOCAL bounties for this job");
          };
        };
      };
    } else {
      Debug.print("Job " # queue_key # " skipped: assigned_count=" # Nat.toText(job.assigned_count) # " >= required=" # Nat.toText(job.required_verifiers));
    };

    Debug.print("_process_audit_job returning null for job " # queue_key);
    return null;
  };

  /**
   * Request a verification job assignment.
   * Called by verifier bots using their API key.
   * Returns a job assignment with bounty_id, or an error if no jobs available.
   *
   * PERFORMANCE OPTIMIZATION:
   * Instead of checking participation for each job individually (N jobs × M verifiers = lots of calls),
   * we batch-check participation for ALL jobs that need verifiers upfront (M verifiers × 1 batch each).
   * This dramatically reduces inter-canister calls to mcp_registry.
   */
  public shared func request_verification_job_with_api_key(
    api_key : Text
  ) : async Result.Result<Types.VerificationJobAssignment, Text> {
    // 1. Validate API key
    let verifier = switch (ApiKey.validate_api_key(api_credentials, api_key)) {
      case (#err(e)) { return #err(e) };
      case (#ok(v)) { v };
    };

    // 1.5. Check deny list
    switch (Map.get(verifier_deny_list, phash, verifier)) {
      case (?true) {
        Debug.print("Verifier " # Principal.toText(verifier) # " is on deny list - blocking job request");
        return #err("Your verifier node has been temporarily blocked. Please contact support.");
      };
      case (_) {};
    };

    Debug.print("Verifier " # Principal.toText(verifier) # " requesting verification job");

    // 2. Check for existing active assignment
    let current_time = Time.now();
    let existing_assignment = JobAssignment.check_existing_assignment(
      verifier,
      current_time,
      assigned_jobs,
      pending_audits,
      bounty_locks,
      icrc127,
    );

    switch (existing_assignment) {
      case (?assignment) { return #ok(assignment) };
      case (null) { /* Continue to find new job */ };
    };

    // 3. Search for available jobs
    // Each job already prevents duplicate assignments via _bounty_verifier_map check
    var jobs_checked : Nat = 0;
    label assignment_loop for ((queue_key, job) in BTree.entries(pending_audits)) {
      if (jobs_checked >= MAX_JOBS_TO_CHECK) {
        Debug.print("Reached maximum jobs to check (" # Nat.toText(MAX_JOBS_TO_CHECK) # "), stopping job search");
        break assignment_loop;
      };

      // Always process the job to check completion status
      jobs_checked += 1;

      switch (await _process_audit_job(queue_key, job, verifier, current_time)) {
        case (?result) {
          // Exit immediately on successful assignment
          Debug.print("Job assigned successfully, stopping search");
          return result;
        };
        case (null) { /* Continue to next job */ };
      };
    };

    // No jobs available
    Debug.print("No verification jobs available after checking " # Nat.toText(jobs_checked) # " jobs");
    #err("No verification jobs available");
  };

  /**
   * Release a job assignment when verification is complete or expired.
   * Can be called by the verifier or by cleanup processes.
   */
  public shared func release_job_assignment(bounty_id : Types.BountyId) : async Result.Result<(), Text> {
    JobQueue.release_job_assignment(
      assigned_jobs,
      job_verifier_assignments,
      bounty_id,
    );
    return #ok(());
  };

  /**
   * Get all pending verification jobs with pagination (for debugging/monitoring).
   */
  public shared query func list_pending_jobs(offset : ?Nat, limit : ?Nat) : async {
    jobs : [(Text, Types.VerificationJob)];
    total : Nat;
  } {
    JobQueue.list_pending_jobs(pending_audits, assigned_jobs, icrc127().icrc127_get_bounty, offset, limit);
  };

  /**
   * Get a specific pending job by its queue key.
   * Returns null if the job doesn't exist.
   */
  public shared query func get_pending_job(queue_key : Text) : async ?Types.VerificationJob {
    BTree.get(pending_audits, Text.compare, queue_key);
  };

  /**
   * Get all bounties for a specific job by its queue key.
   * Returns an empty array if the job doesn't exist.
   */
  public shared query func get_bounties_for_job(queue_key : Text) : async [ICRC127Lib.Bounty] {
    switch (BTree.get(pending_audits, Text.compare, queue_key)) {
      case (?job) {
        let bounties = Buffer.Buffer<ICRC127Lib.Bounty>(job.bounty_ids.size());
        for (bounty_id in job.bounty_ids.vals()) {
          switch (icrc127().icrc127_get_bounty(bounty_id)) {
            case (?bounty) bounties.add(bounty);
            case null {}; // Skip if bounty not found
          };
        };
        Buffer.toArray(bounties);
      };
      case null [];
    };
  };

  /**
   * Get all bounties and their locks for a specific job by its queue key.
   * More efficient than fetching bounties and then fetching each lock separately.
   * Returns tuple of (bounty, optional lock) for each bounty in the job.
   */
  public shared query func get_bounties_with_locks_for_job(queue_key : Text) : async [(ICRC127Lib.Bounty, ?Types.BountyLock)] {
    switch (BTree.get(pending_audits, Text.compare, queue_key)) {
      case (?job) {
        let result = Buffer.Buffer<(ICRC127Lib.Bounty, ?Types.BountyLock)>(job.bounty_ids.size());
        for (bounty_id in job.bounty_ids.vals()) {
          switch (icrc127().icrc127_get_bounty(bounty_id)) {
            case (?bounty) {
              let lock = QueryMethods.get_bounty_lock(bounty_id, bounty_locks);
              result.add((bounty, lock));
            };
            case null {}; // Skip if bounty not found
          };
        };
        Buffer.toArray(result);
      };
      case null [];
    };
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
        } else {
          // Lock is expired and owned by someone else - clean it up
          if (not Principal.equal(existing.claimant, verifier)) {
            let current_staked = Account.get_balance(staked_balances, existing.claimant, existing.stake_token_id);
            Account.set_balance(staked_balances, existing.claimant, existing.stake_token_id, current_staked - existing.stake_amount);

            // Penalize reputation for abandoning verification
            let stats = Account.get_verifier_stats(verifier_stats, existing.claimant);
            var new_score : Nat = 0;
            if (stats.reputation_score > 10) {
              new_score := stats.reputation_score - 10;
            };
            ignore Map.put(
              verifier_stats,
              phash,
              existing.claimant,
              {
                total_verifications = stats.total_verifications;
                reputation_score = new_score;
                total_earnings = stats.total_earnings;
              },
            );
          };
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
  // == PUBLIC ICRC127 ENDPOINTS
  // ==================================================================================

  // Create a bounty locally (called by app_store when registering WASM)
  public shared (msg) func icrc127_create_bounty(
    req : ICRC127Service.CreateBountyRequest
  ) : async ICRC127Service.CreateBountyResult {
    let result = await icrc127().icrc127_create_bounty(msg.caller, req);

    // Auto-attach bounty to matching verification job (if exists)
    Debug.print("icrc127_create_bounty called - attempting auto-attach");
    switch (result) {
      case (#Ok(bounty_result)) {
        let bounty_id = bounty_result.bounty_id;
        Debug.print("Bounty created successfully with ID: " # Nat.toText(bounty_id));

        // Extract wasm_id and audit_type from bounty metadata
        var wasm_id_opt : ?Text = null;
        var audit_type_opt : ?Text = null;

        for ((key, value) in req.bounty_metadata.vals()) {
          if (key == "wasm_id") {
            switch (value) {
              case (#Text(t)) { wasm_id_opt := ?t };
              case (_) {};
            };
          };
          if (key == "audit_type") {
            switch (value) {
              case (#Text(t)) { audit_type_opt := ?t };
              case (_) {};
            };
          };
        };

        // If both wasm_id and audit_type found, try to attach to most recent matching job
        switch (wasm_id_opt, audit_type_opt) {
          case (?wasm_id, ?audit_type) {
            let prefix = wasm_id # "::" # audit_type # "::";
            var matching_job : ?Types.VerificationJob = null;
            var matching_key : ?Text = null;

            // Find the most recent job matching this wasm_id and audit_type
            for ((key, job) in BTree.entries(pending_audits)) {
              if (Text.size(key) >= Text.size(prefix)) {
                let chars = Text.toIter(key);
                var matches = true;
                label char_check for (c in Text.toIter(prefix)) {
                  switch (chars.next()) {
                    case (?key_char) {
                      if (key_char != c) {
                        matches := false;
                        break char_check;
                      };
                    };
                    case (null) {
                      matches := false;
                      break char_check;
                    };
                  };
                };
                if (matches) {
                  switch (matching_job) {
                    case (null) {
                      matching_job := ?job;
                      matching_key := ?key;
                    };
                    case (?existing) {
                      if (job.created_at > existing.created_at) {
                        matching_job := ?job;
                        matching_key := ?key;
                      };
                    };
                  };
                };
              };
            };

            switch (matching_job, matching_key) {
              case (?existing_job, ?queue_key) {
                // Append this bounty to the job's bounty_ids
                let updated_bounty_ids = Buffer.fromArray<Types.BountyId>(existing_job.bounty_ids);
                updated_bounty_ids.add(bounty_id);

                let updated_job : Types.VerificationJob = {
                  wasm_id = existing_job.wasm_id;
                  repo = existing_job.repo;
                  commit_hash = existing_job.commit_hash;
                  build_config = existing_job.build_config;
                  required_verifiers = existing_job.required_verifiers;
                  bounty_ids = Buffer.toArray(updated_bounty_ids);
                  audit_type = existing_job.audit_type;
                  assigned_count = existing_job.assigned_count;
                  completed_count = existing_job.completed_count;
                  created_at = existing_job.created_at;
                  creator = existing_job.creator;
                };

                ignore BTree.insert(pending_audits, Text.compare, queue_key, updated_job);
                Debug.print("Auto-attached bounty " # Nat.toText(bounty_id) # " to job " # queue_key);
              };
              case (_, _) {
                Debug.print("No matching job found for bounty " # Nat.toText(bounty_id) # " (wasm_id: " # wasm_id # ", audit_type: " # audit_type # ")");
              };
            };
          };
          case (_, _) {
            Debug.print("Bounty " # Nat.toText(bounty_id) # " missing wasm_id or audit_type metadata - cannot auto-attach");
          };
        };
      };
      case (#Error(_)) {
        // Bounty creation failed, nothing to attach
      };
    };

    result;
  };

  // Submit a bounty claim (called by verifier after completing verification)
  public shared (msg) func icrc127_submit_bounty(
    req : ICRC127Service.BountySubmissionRequest
  ) : async ICRC127Service.BountySubmissionResult {
    await icrc127().icrc127_submit_bounty(msg.caller, req);
  };

  // Query bounty information
  public shared query func icrc127_get_bounty(
    bounty_id : Nat
  ) : async ?ICRC127Service.Bounty {
    icrc127().icrc127_get_bounty(bounty_id);
  };

  // List bounties with optional filters
  public shared query func icrc127_list_bounties(
    filter : ?[ICRC127Service.ListBountiesFilter],
    prev : ?Nat,
    take : ?Nat,
  ) : async [ICRC127Lib.Bounty] {
    icrc127().icrc127_list_bounties(filter, prev, take);
  };

  // Get ICRC127 metadata
  public shared query func icrc127_metadata() : async Types.ICRC16Map {
    icrc127().icrc127_metadata();
  };

  // Get supported ICRC standards
  public shared query func icrc10_supported_standards() : async [{
    name : Text;
    url : Text;
  }] {
    icrc127().icrc10_supported_standards();
  };

  private func _getICRC16Field(map : Types.ICRC16Map, key : Text) : ?Types.ICRC16 {
    for ((k, v) in map.vals()) { if (k == key) return ?v };
    null;
  };

  // Add this new helper function. It's designed specifically for filtering.
  private func _getICRC16TextOptional(map : Types.ICRC16Map, key : Text) : ?Text {
    switch (_getICRC16Field(map, key)) {
      case (null) { return null }; // Not found, return null
      case (?(#Text(t))) { return ?t }; // Found and is Text, return the optional value
      case (_) { return null }; // Found but is wrong type, return null
    };
  };

  /**
   * @notice Fetches a paginated and filtered list of all bounties.
   * @param req The request object containing optional filters and pagination cursors.
   * @return A result containing an array of matching `ICRC127Lib.Bounty` records or an error.
   */
  public shared query func list_bounties(req : Bounty.BountyListingRequest) : async Bounty.BountyListingResponse {
    // 1. Handle optional arguments and set defaults.
    let filters = switch (req.filter) { case null []; case (?fs) fs };
    let take = switch (req.take) { case null 20; case (?n) Nat.min(n, 100) };
    let prev = req.prev;

    // 2. Use BTree iterator instead of converting to array - this is O(n) only for items we check
    // not O(n) upfront cost of converting entire tree to array
    let bounties_tree = icrc127().state.bounties;

    // 3. Define the filtering logic in a helper function.
    // A bounty must match ALL filters in the request to be included.
    func matchesAllFilters(bounty : ICRC127Lib.Bounty, filters : [Bounty.BountyFilter]) : Bool {
      if (filters.size() == 0) return true;

      for (f in filters.vals()) {
        switch (f) {
          case (#status(statusFilter)) {
            let is_claimed = bounty.claimed != null;
            switch (statusFilter) {
              case (#Open) { if (is_claimed) return false };
              case (#Claimed) { if (not is_claimed) return false };
            };
          };
          case (#audit_type(typeFilter)) {
            switch (bounty.challenge_parameters) {
              case (#Map(params_map)) {
                switch (_getICRC16TextOptional(params_map, "audit_type")) {
                  case (?bountyType) {
                    if (bountyType != typeFilter) { return false };
                  };
                  case (null) {
                    return false;
                  };
                };
              };
              case (_) {
                return false;
              };
            };
          };
          case (#creator(creatorFilter)) {
            if (bounty.creator != creatorFilter) return false;
          };
          case (#wasm_id(wasmIdFilter)) {
            switch (bounty.challenge_parameters) {
              case (#Map(params_map)) {
                switch (_getICRC16TextOptional(params_map, "wasm_id")) {
                  case (?bountyWasmId) {
                    if (bountyWasmId != wasmIdFilter) { return false };
                  };
                  case (null) {
                    return false;
                  };
                };
              };
              case (_) {
                return false;
              };
            };
          };
        };
      };
      return true;
    };

    // 4. Apply pagination and filtering by iterating the BTree
    // Convert to array but only for matching/pagination, not for storage
    // This is still better than the old approach since we can exit early
    var started = prev == null;
    var count : Nat = 0;
    let out = Buffer.Buffer<ICRC127Lib.Bounty>(take);

    // Get entries and convert to array for reverse iteration (newest first)
    let entries = Buffer.fromArray<(Nat, ICRC127Lib.Bounty)>(
      Iter.toArray(BTree.entries(bounties_tree))
    );

    // Iterate in reverse order (newest first)
    var i = entries.size();
    while (i > 0 and count < take) {
      i -= 1;
      let (id, bounty) = entries.get(i);

      if (not started) {
        switch (prev) {
          case (?p) {
            if (bounty.bounty_id == p) {
              started := true;
            };
          };
          case (null) {};
        };
      } else {
        // We've started collecting
        if (matchesAllFilters(bounty, filters)) {
          out.add(bounty);
          count += 1;
        };
      };
    };

    return #ok(Buffer.toArray(out));
  };
};
