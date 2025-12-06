// packages/canisters/audit_hub/src/JobQueue.mo
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Array "mo:base/Array";
import Order "mo:base/Order";
import Option "mo:base/Option";

import Types "Types";
import ICRC127Lib "../../../../libs/icrc127/src/lib";

module {
  public type VerificationJob = Types.VerificationJob;
  public type AssignedJob = Types.AssignedJob;
  public type BountyId = Types.BountyId;
  public type BountyLock = Types.BountyLock;
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
  // Format: wasm_id::audit_type::timestamp (e.g., "abc123::tools_v1::1234567890")
  // Including timestamp allows multiple jobs for the same wasm_id + audit_type
  public func make_queue_key(wasm_id : Text, audit_type : Text, timestamp : Int) : Text {
    wasm_id # "::" # audit_type # "::" # Int.toText(timestamp);
  };

  /**
   * Add a verification job to the pending audits queue.
   * Uses composite key format: wasm_id::audit_type
   * @param pending_audits - The BTree queue for pending audit jobs
   * @param wasm_id - The WASM ID to verify
   * @param repo - The repository URL
   * @param commit_hash - The commit hash to build from
   * @param build_config - ICRC-16 metadata containing audit_type and other config
   * @param audit_type - The audit type (e.g., "build_reproducibility_v1")
   * @param required_verifiers - Number of verifiers needed
   * @param bounty_ids - Legacy parameter (unused, kept for compatibility)
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
    audit_type : Text,
    required_verifiers : Nat,
    bounty_ids : [Nat],
    caller : Principal,
    registry_canister_id : ?Principal,
    bounty_sponsor_canister_id : ?Principal,
  ) : Result.Result<(), Text> {
    // Check authorization: caller must be authenticated (not anonymous)
    if (Principal.isAnonymous(caller)) {
      return #err("Anonymous users cannot add verification jobs");
    };

    // Create job with timestamp
    let created_at = Time.now();
    let queue_key = make_queue_key(wasm_id, audit_type, created_at);
    Debug.print("Adding " # audit_type # " audit job for WASM " # wasm_id # " with key: " # queue_key);

    let job : VerificationJob = {
      wasm_id;
      repo;
      commit_hash;
      build_config;
      created_at;
      required_verifiers;
      assigned_count = 0;
      in_progress_count = 0;
      completed_count = 0;
      bounty_ids = []; // Empty array - bounties will attach via auto-attach mechanism
      audit_type;
      creator = caller;
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

    // Note: We used to delete completed jobs, but now we keep them
    // so they remain visible in the UI. Jobs with assigned_count >= required_verifiers
    // are considered complete.
    Debug.print("Verification complete for " # audit_type # " audit on WASM " # wasm_id);
    Debug.print("Jobs are kept in queue for historical visibility");

    #ok();
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
              audit_type = job.audit_type;
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
              assigned_count = job.assigned_count;
              in_progress_count = job.in_progress_count;
              completed_count = job.completed_count;
              bounty_ids = job.bounty_ids;
              audit_type = job.audit_type;
              creator = job.creator;
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
    job_verifier_assignments : Map.Map<Text, Map.Map<Principal, Bool>>,
    bounty_id : BountyId,
  ) : () {
    switch (Map.get(assigned_jobs, Map.nhash, bounty_id)) {
      case (?assignment) {
        // DO NOT remove from assigned_jobs - this is a permanent record
        // assigned_count is derived from this map, so entries must stay forever

        // DO NOT remove from job_verifier_assignments - this should be permanent
        // to prevent verifiers from being reassigned to the same job
        // The verifier has already started work on this job and should not get another bounty for it

        Debug.print("Released lock for bounty " # Nat.toText(bounty_id) # " - assignment remains in permanent record");
      };
      case (null) {
        Debug.print("Warning: No assignment found for bounty " # Nat.toText(bounty_id));
      };
    };
  };

  /**
   * List all pending audit jobs with pagination and sorting.
   * @param pending_audits - The BTree queue for pending audit jobs
   * @param assigned_jobs - Map of currently assigned jobs to calculate accurate counts
   * @param icrc127_get_bounty - Function to retrieve bounty details by ID
   * @param offset - Starting index for pagination
   * @param limit - Maximum number of results to return
   */
  /**
   * List all pending audit jobs with pagination.
   * @param pending_audits - The BTree queue for pending audit jobs
   * @param assigned_jobs - Map of assigned jobs (for calculating assigned_count)
   * @param bounty_locks - Map of active bounty locks (for calculating in_progress_count)
   * @param icrc127_get_bounty - Function to get bounty details
   * @param offset - Starting index for pagination
   * @param limit - Maximum number of results to return
   */
  public func list_pending_jobs(
    pending_audits : BTree.BTree<Text, VerificationJob>,
    assigned_jobs : Map.Map<BountyId, AssignedJob>,
    bounty_locks : Map.Map<BountyId, BountyLock>,
    icrc127_get_bounty : (BountyId) -> ?ICRC127Lib.Bounty,
    offset : ?Nat,
    limit : ?Nat,
  ) : {
    jobs : [(Text, VerificationJob)];
    total : Nat;
  } {
    let result = Buffer.Buffer<(Text, VerificationJob)>(0);
    for ((key, job) in BTree.entries(pending_audits)) {
      // Recalculate assigned_count from assigned_jobs map
      var actual_assigned_count : Nat = 0;
      for ((_, assignment) in Map.entries(assigned_jobs)) {
        if (assignment.wasm_id == job.wasm_id and assignment.audit_type == job.audit_type) {
          actual_assigned_count += 1;
        };
      };

      // Recalculate in_progress_count from bounty locks (excluding claimed bounties)
      var actual_in_progress_count : Nat = 0;
      for (bounty_id in job.bounty_ids.vals()) {
        switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
          case (?_lock) {
            // Check if this bounty has been claimed
            let is_claimed = switch (icrc127_get_bounty(bounty_id)) {
              case (?bounty) { bounty.claims.size() > 0 };
              case (null) { false };
            };
            // Only count as in-progress if NOT claimed
            if (not is_claimed) {
              actual_in_progress_count += 1;
            };
          };
          case (null) {};
        };
      };

      // Recalculate completed_count from bounty claims
      var actual_completed_count : Nat = 0;
      for (bounty_id in job.bounty_ids.vals()) {
        switch (icrc127_get_bounty(bounty_id)) {
          case (?bounty) {
            if (bounty.claims.size() > 0) {
              actual_completed_count += 1;
            };
          };
          case (null) {};
        };
      };

      let job_with_updated_counts : VerificationJob = {
        wasm_id = job.wasm_id;
        repo = job.repo;
        commit_hash = job.commit_hash;
        build_config = job.build_config;
        created_at = job.created_at;
        required_verifiers = job.required_verifiers;
        assigned_count = actual_assigned_count;
        in_progress_count = actual_in_progress_count;
        completed_count = actual_completed_count;
        bounty_ids = job.bounty_ids;
        audit_type = job.audit_type;
        creator = job.creator;
      };

      result.add((key, job_with_updated_counts));
    };

    // Sort by timestamp descending (newest first)
    // Keys are in format: wasm_id::audit_type::timestamp
    var array = Buffer.toArray(result);
    let total = array.size();

    array := Array.sort<(Text, VerificationJob)>(
      array,
      func(a : (Text, VerificationJob), b : (Text, VerificationJob)) : Order.Order {
        // Use created_at from the job directly instead of parsing the key
        let a_timestamp = a.1.created_at;
        let b_timestamp = b.1.created_at;

        // Sort descending (newest first)
        if (a_timestamp > b_timestamp) {
          #less;
        } else if (a_timestamp < b_timestamp) {
          #greater;
        } else {
          #equal;
        };
      },
    );

    // Apply pagination
    let start = Option.get(offset, 0);
    let page_size = Option.get(limit, total);
    let end = Nat.min(start + page_size, total);

    let paginated = if (start >= total) {
      [];
    } else {
      Array.tabulate<(Text, VerificationJob)>(
        end - start,
        func(i : Nat) : (Text, VerificationJob) {
          array[start + i];
        },
      );
    };

    return {
      jobs = paginated;
      total = total;
    };
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
