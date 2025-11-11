// packages/canisters/audit_hub/src/JobQueue.mo
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";

import Types "Types";

module {
  public type VerificationJob = Types.VerificationJob;
  public type AssignedJob = Types.AssignedJob;
  public type BountyId = Types.BountyId;
  public type ICRC16Map = Types.ICRC16Map;
  public type ICRC16 = Types.ICRC16;
  public type VerificationJobAssignment = Types.VerificationJobAssignment;

  // Helper function to extract audit_type from ICRC-16 metadata (challenge_parameters)
  public func get_audit_type_from_metadata(metadata : ICRC16Map) : ?Text {
    for ((key, val) in metadata.vals()) {
      if (key == "audit_type") {
        switch (val) {
          case (#Text(t)) { return ?t };
          case (_) { return null };
        };
      };
    };
    return null;
  };

  // Helper function to create composite key for pending_audits BTree
  // Format: wasm_id::audit_type (e.g., "abc123::tools_v1")
  public func make_queue_key(wasm_id : Text, audit_type : Text) : Text {
    wasm_id # "::" # audit_type;
  };

  /**
   * Add a verification job to the pending audits queue.
   * Uses composite key format: wasm_id::audit_type
   * @param pending_audits - The BTree queue for pending audit jobs
   * @param wasm_id - The WASM ID to verify
   * @param repo - The repository URL
   * @param commit_hash - The commit hash to build from
   * @param build_config - ICRC-16 metadata containing audit_type and other config
   * @param required_verifiers - Number of verifiers needed
   * @param bounty_ids - Array of bounty IDs associated with this job
   * @param caller - The principal calling this function (for authorization)
   * @param registry_canister_id - Optional registry canister ID for authorization
   * @param bounty_sponsor_canister_id - Optional bounty sponsor canister ID for authorization
   */
  public func add_verification_job(
    pending_audits : BTree.BTree<Text, VerificationJob>,
    wasm_id : Text,
    repo : Text,
    commit_hash : Text,
    build_config : ICRC16Map,
    required_verifiers : Nat,
    bounty_ids : [Nat],
    caller : Principal,
    registry_canister_id : ?Principal,
    bounty_sponsor_canister_id : ?Principal,
  ) : Result.Result<(), Text> {
    // Check authorization: caller must be registry or bounty_sponsor
    var authorized = false;
    switch (registry_canister_id) {
      case (?registry_id) {
        if (Principal.equal(caller, registry_id)) {
          authorized := true;
        };
      };
      case (null) {};
    };

    if (not authorized) {
      switch (bounty_sponsor_canister_id) {
        case (?sponsor_id) {
          if (Principal.equal(caller, sponsor_id)) {
            authorized := true;
          };
        };
        case (null) {};
      };
    };

    if (not authorized) {
      return #err("Only the registry or bounty_sponsor canister can add verification jobs");
    };

    // Extract audit_type from build_config
    let audit_type = switch (get_audit_type_from_metadata(build_config)) {
      case (?at) { at };
      case (null) { "build_reproducibility_v1" }; // Default if not specified
    };

    // Create composite key: wasm_id::audit_type
    let queue_key = make_queue_key(wasm_id, audit_type);
    Debug.print("Adding " # audit_type # " audit job for WASM " # wasm_id # " with key: " # queue_key);

    // Check if job already exists in the queue
    let final_bounty_ids = switch (BTree.get(pending_audits, Text.compare, queue_key)) {
      case (?existing) {
        // Job already exists, merge the bounty_ids
        Debug.print("Job for " # queue_key # " already exists, merging " # Nat.toText(bounty_ids.size()) # " new bounty_ids with existing " # Nat.toText(existing.bounty_ids.size()));

        // Create a buffer with all existing bounty_ids
        let merged = Buffer.Buffer<Nat>(existing.bounty_ids.size() + bounty_ids.size());
        for (id in existing.bounty_ids.vals()) {
          merged.add(id);
        };
        // Add new bounty_ids
        for (id in bounty_ids.vals()) {
          merged.add(id);
        };
        Buffer.toArray(merged);
      };
      case (null) {
        Debug.print("Adding new audit job for " # queue_key);
        bounty_ids;
      };
    };

    let job : VerificationJob = {
      wasm_id;
      repo;
      commit_hash;
      build_config;
      created_at = Time.now();
      required_verifiers;
      assigned_count = 0;
      bounty_ids = final_bounty_ids;
    };

    ignore BTree.insert(pending_audits, Text.compare, queue_key, job);
    #ok();
  };

  /**
   * Mark a verification job as complete.
   * Removes the job from pending_audits using composite key.
   * @param pending_audits - The BTree queue for pending audit jobs
   * @param wasm_id - The WASM ID
   * @param audit_type - The audit type (e.g., "build_reproducibility_v1", "tools_v1")
   * @param caller - The principal calling this function
   * @param registry_canister_id - Optional registry canister ID for authorization
   * @param is_owner - Function to check if caller is owner
   */
  public func mark_verification_complete(
    pending_audits : BTree.BTree<Text, VerificationJob>,
    wasm_id : Text,
    audit_type : Text,
    caller : Principal,
    registry_canister_id : ?Principal,
    is_owner : Principal -> Bool,
  ) : Result.Result<(), Text> {
    // Only registry or owner can mark jobs complete
    switch (registry_canister_id) {
      case (null) {
        return #err("Registry canister not configured");
      };
      case (?registry_id) {
        if (not Principal.equal(caller, registry_id) and not is_owner(caller)) {
          return #err("Only the registry canister or owner can mark jobs complete");
        };
      };
    };

    // Create composite key: wasm_id::audit_type
    let queue_key = make_queue_key(wasm_id, audit_type);
    Debug.print("Marking " # audit_type # " audit job complete for WASM " # wasm_id # " with key: " # queue_key);

    // Remove from pending queue
    switch (BTree.delete(pending_audits, Text.compare, queue_key)) {
      case (?_removed_job) {
        Debug.print("Successfully removed completed job for " # queue_key);
        #ok();
      };
      case (null) {
        Debug.print("Warning: No pending job found for " # queue_key);
        #ok(); // Don't error if job not found
      };
    };
  };

  /**
   * Request a verification job with API key authentication.
   * Finds an available job from pending_audits that the verifier hasn't completed yet.
   * @param pending_audits - The BTree queue for pending audit jobs
   * @param assigned_jobs - Map of currently assigned jobs
   * @param wasm_verifier_assignments - Map tracking which verifiers are assigned to which WASMs
   * @param wasm_verifier_completions - Map tracking which verifiers have completed which WASMs
   * @param verifier - The principal of the verifier requesting a job
   * @param lock_duration_ns - How long the job assignment lock lasts
   */
  public func request_verification_job_with_api_key(
    pending_audits : BTree.BTree<Text, VerificationJob>,
    assigned_jobs : Map.Map<BountyId, AssignedJob>,
    wasm_verifier_assignments : Map.Map<Text, Map.Map<Principal, Bool>>,
    wasm_verifier_completions : Map.Map<Text, Map.Map<Principal, Bool>>,
    verifier : Principal,
    lock_duration_ns : Int,
  ) : Result.Result<VerificationJobAssignment, Text> {
    // Search through pending_audits for an available job
    var job_to_assign : ?VerificationJob = null;
    var job_key : ?Text = null;

    // Iterate through pending_audits BTree to find an available job
    label search_loop for ((key, job) in BTree.entries(pending_audits)) {
      // Check if this verifier has already been assigned to this WASM
      let already_assigned = switch (Map.get(wasm_verifier_assignments, thash, job.wasm_id)) {
        case (?assignments) {
          switch (Map.get(assignments, phash, verifier)) {
            case (?true) { true };
            case (_) { false };
          };
        };
        case (null) { false };
      };

      if (not already_assigned) {
        // Check if this verifier has already completed this WASM
        let already_completed = switch (Map.get(wasm_verifier_completions, thash, job.wasm_id)) {
          case (?completions) {
            switch (Map.get(completions, phash, verifier)) {
              case (?true) { true };
              case (_) { false };
            };
          };
          case (null) { false };
        };

        if (not already_completed) {
          // Found an available job
          job_to_assign := ?job;
          job_key := ?key;
          break search_loop;
        };
      };
    };

    switch (job_to_assign) {
      case (?job) {
        switch (job_key) {
          case (?key) {
            // Get the first bounty_id for this job
            if (job.bounty_ids.size() == 0) {
              return #err("No bounties available for this job");
            };

            let bounty_id = job.bounty_ids[0];

            // Create assignment
            let assignment : AssignedJob = {
              verifier;
              assigned_at = Time.now();
              bounty_id;
              expires_at = Time.now() + lock_duration_ns;
              wasm_id = job.wasm_id;
            };

            // Store assignment
            ignore Map.put(assigned_jobs, Map.nhash, bounty_id, assignment);

            // Track that this verifier is assigned to this WASM
            let assignments = switch (Map.get(wasm_verifier_assignments, thash, job.wasm_id)) {
              case (?existing) { existing };
              case (null) {
                let new_map = Map.new<Principal, Bool>();
                ignore Map.put(wasm_verifier_assignments, thash, job.wasm_id, new_map);
                new_map;
              };
            };
            ignore Map.put(assignments, phash, verifier, true);

            // Increment assigned_count and update the job in the BTree
            let updated_job : VerificationJob = {
              wasm_id = job.wasm_id;
              repo = job.repo;
              commit_hash = job.commit_hash;
              build_config = job.build_config;
              created_at = job.created_at;
              required_verifiers = job.required_verifiers;
              assigned_count = job.assigned_count + 1;
              bounty_ids = job.bounty_ids;
            };
            ignore BTree.insert(pending_audits, Text.compare, key, updated_job);

            #ok({
              bounty_id;
              wasm_id = job.wasm_id;
              repo = job.repo;
              commit_hash = job.commit_hash;
              build_config = job.build_config;
              expires_at = Time.now() + lock_duration_ns;
            });
          };
          case (null) {
            #err("No verification jobs available for this verifier");
          };
        };
      };
      case (null) {
        #err("No verification jobs available for this verifier");
      };
    };
  };

  /**
   * Release a job assignment when a verifier is done (success or failure).
   * @param assigned_jobs - Map of currently assigned jobs
   * @param wasm_verifier_assignments - Map tracking which verifiers are assigned to which WASMs
   * @param bounty_id - The bounty ID to release
   */
  public func release_job_assignment(
    assigned_jobs : Map.Map<BountyId, AssignedJob>,
    wasm_verifier_assignments : Map.Map<Text, Map.Map<Principal, Bool>>,
    bounty_id : BountyId,
  ) : () {
    switch (Map.get(assigned_jobs, Map.nhash, bounty_id)) {
      case (?assignment) {
        // Remove from assigned_jobs
        ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);

        // Remove from wasm_verifier_assignments
        switch (Map.get(wasm_verifier_assignments, thash, assignment.wasm_id)) {
          case (?assignments) {
            ignore Map.remove(assignments, phash, assignment.verifier);
          };
          case (null) {};
        };

        Debug.print("Released job assignment for bounty " # Nat.toText(bounty_id));
      };
      case (null) {
        Debug.print("Warning: No assignment found for bounty " # Nat.toText(bounty_id));
      };
    };
  };

  /**
   * List all pending audit jobs.
   * @param pending_audits - The BTree queue for pending audit jobs
   */
  public func list_pending_jobs(
    pending_audits : BTree.BTree<Text, VerificationJob>
  ) : [(Text, VerificationJob)] {
    let result = Buffer.Buffer<(Text, VerificationJob)>(0);
    for ((key, job) in BTree.entries(pending_audits)) {
      result.add((key, job));
    };
    Buffer.toArray(result);
  };

  /**
   * List all currently assigned jobs.
   * @param assigned_jobs - Map of currently assigned jobs
   */
  public func list_assigned_jobs(
    assigned_jobs : Map.Map<BountyId, AssignedJob>
  ) : [(BountyId, AssignedJob)] {
    let result = Buffer.Buffer<(BountyId, AssignedJob)>(0);
    for ((bounty_id, assignment) in Map.entries(assigned_jobs)) {
      result.add((bounty_id, assignment));
    };
    Buffer.toArray(result);
  };
};
