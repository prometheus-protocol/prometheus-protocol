// JobAssignment.mo - Handles job assignment logic for verifiers
import Map "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Text "mo:base/Text";

import Types "Types";
import JobQueue "JobQueue";
import McpRegistry "McpRegistry";
import ICRC127Lib "../../../../libs/icrc127/src/lib";

module {

  /**
   * ICRC127 instance type for local bounty queries
   */
  public type ICRC127Instance = () -> ICRC127Lib.ICRC127Bounty;

  /**
   * Check if verifier has an active locked LOCAL bounty for this job.
   * Returns (bounty_id, challenge_params) if found.
   * This is the PRIMARY method - queries local ICRC127 instance (no inter-canister calls).
   */
  public func find_active_local_bounty(
    job : Types.VerificationJob,
    verifier : Principal,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    icrc127 : ICRC127Instance,
    current_time : Int,
  ) : ?(Types.BountyId, Types.ICRC16Map) {
    label bounty_check for (bounty_id in job.bounty_ids.vals()) {
      switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
        case (?lock) {
          if (Principal.equal(lock.claimant, verifier) and lock.expires_at > current_time) {
            // Query local ICRC127 instance (no inter-canister call!)
            let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
            switch (bounty_opt) {
              case (?bounty) {
                if (Option.isNull(bounty.claimed)) {
                  // Extract challenge_parameters from ICRC16 variant
                  let challenge_params = switch (bounty.challenge_parameters) {
                    case (#Map(params)) { params };
                    case (_) { job.build_config }; // Fallback
                  };

                  Debug.print("Verifier " # Principal.toText(verifier) # " has ACTIVE local bounty " # Nat.toText(bounty_id) # " for WASM " # job.wasm_id);
                  return ?(bounty_id, challenge_params);
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
   * Claim an available LOCAL bounty (no inter-canister calls).
   * Atomically claims it by creating assignment and provisional lock.
   * This is the PRIMARY method for local bounties.
   */
  public func claim_available_local_bounty(
    job : Types.VerificationJob,
    verifier : Principal,
    current_time : Int,
    lock_duration_ns : Int,
    stake_amount : Types.Balance,
    token_id : Types.TokenId,
    assigned_jobs : Map.Map<Types.BountyId, Types.AssignedJob>,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    icrc127 : ICRC127Instance,
  ) : ?Types.BountyId {
    let wasm_id = job.wasm_id;

    label bounty_search for (bounty_id in job.bounty_ids.vals()) {
      // Query local ICRC127 instance (no inter-canister call!)
      let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
      switch (bounty_opt) {
        case (?bounty) {
          // Check if bounty has been claimed
          if (Option.isSome(bounty.claimed)) {
            Debug.print("Local bounty " # Nat.toText(bounty_id) # " already claimed - skipping");
            continue bounty_search;
          };
        };
        case (null) {
          Debug.print("Local bounty " # Nat.toText(bounty_id) # " not found - skipping");
          continue bounty_search;
        };
      };

      // Check if already assigned
      let is_assigned = Option.isSome(Map.get(assigned_jobs, Map.nhash, bounty_id));
      if (not is_assigned) {
        // IMMEDIATELY claim this bounty to prevent race conditions
        let temp_assignment : Types.AssignedJob = {
          wasm_id;
          audit_type = job.audit_type;
          verifier;
          bounty_id;
          assigned_at = current_time;
          expires_at = current_time + lock_duration_ns;
        };
        ignore Map.put(assigned_jobs, Map.nhash, bounty_id, temp_assignment);

        // Create a provisional bounty lock
        let provisional_lock : Types.BountyLock = {
          claimant = verifier;
          expires_at = current_time + lock_duration_ns;
          stake_amount = stake_amount;
          stake_token_id = token_id;
        };
        ignore Map.put(bounty_locks, Map.nhash, bounty_id, provisional_lock);

        Debug.print("Claimed local bounty " # Nat.toText(bounty_id) # " for verifier " # Principal.toText(verifier));
        return ?bounty_id;
      };
    };

    return null;
  };

  /**
   * Get build config from LOCAL bounty (no inter-canister call).
   * This is the PRIMARY method for local bounties.
   */
  public func get_local_bounty_build_config(
    bounty_id : Types.BountyId,
    job : Types.VerificationJob,
    icrc127 : ICRC127Instance,
  ) : Types.ICRC16Map {
    let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
    switch (bounty_opt) {
      case (?bounty) {
        switch (bounty.challenge_parameters) {
          case (#Map(params)) { return params };
          case (_) {
            Debug.print("Warning: challenge_parameters for local bounty " # Nat.toText(bounty_id) # " is not a Map, falling back to job.build_config");
            return job.build_config;
          };
        };
      };
      case (null) {
        Debug.print("Warning: Could not find local bounty " # Nat.toText(bounty_id) # ", falling back to job.build_config");
        return job.build_config;
      };
    };
  };

  /**
   * Create a job assignment response.
   */
  public func create_job_assignment(
    bounty_id : Types.BountyId,
    wasm_id : Text,
    repo : Text,
    commit_hash : Text,
    build_config : Types.ICRC16Map,
    expires_at : Types.Timestamp,
  ) : Types.VerificationJobAssignment {
    {
      bounty_id;
      wasm_id;
      repo;
      commit_hash;
      build_config;
      expires_at;
    };
  };

  /**
   * Check and cleanup expired assignments for a verifier.
   * Returns active assignment if found.
   * Only uses local bounties (no inter-canister calls to registry).
   */
  public func check_existing_assignment(
    verifier : Principal,
    current_time : Int,
    assigned_jobs : Map.Map<Types.BountyId, Types.AssignedJob>,
    pending_audits : BTree.BTree<Text, Types.VerificationJob>,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    icrc127 : ICRC127Instance,
  ) : ?Types.VerificationJobAssignment {
    for ((bounty_id, assignment) in Map.entries(assigned_jobs)) {
      if (Principal.equal(assignment.verifier, verifier) and assignment.expires_at > current_time) {
        // Check if this bounty is claimed (query local ICRC127)
        let bounty_opt = icrc127().icrc127_get_bounty(bounty_id);
        let is_claimed = switch (bounty_opt) {
          case (?bounty) { Option.isSome(bounty.claimed) };
          case (null) { false };
        };

        if (is_claimed) {
          Debug.print("Verifier has assignment for bounty " # Nat.toText(bounty_id) # " but it's CLAIMED - cleaning up");
          ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
        } else {
          // Return the existing active assignment
          Debug.print("Verifier already has active assignment for bounty " # Nat.toText(bounty_id));

          // Find the job in pending_audits
          var found_job : ?Types.VerificationJob = null;
          for ((queue_key, job) in BTree.entries(pending_audits)) {
            if (job.wasm_id == assignment.wasm_id) {
              found_job := ?job;
            };
          };

          switch (found_job) {
            case (?job) {
              let bounty_build_config = get_local_bounty_build_config(
                bounty_id,
                job,
                icrc127,
              );

              return ?create_job_assignment(
                bounty_id,
                assignment.wasm_id,
                job.repo,
                job.commit_hash,
                bounty_build_config,
                assignment.expires_at,
              );
            };
            case (null) {
              Debug.print("Warning: Assignment found but job not in pending_audits - cleaning up");
              ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
            };
          };
        };
      } else if (Principal.equal(assignment.verifier, verifier)) {
        // Assignment expired, clean it up
        Debug.print("Cleaning up expired assignment for bounty " # Nat.toText(bounty_id));
        ignore Map.remove(assigned_jobs, Map.nhash, bounty_id);
        ignore Map.remove(bounty_locks, Map.nhash, bounty_id);
      };
    };

    return null;
  };

};
