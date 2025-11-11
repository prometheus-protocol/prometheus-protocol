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

module {

  /**
   * Check if verifier has an active locked bounty for this job.
   * Returns (bounty_id, challenge_params) if found.
   */
  public func find_active_locked_bounty(
    job : Types.VerificationJob,
    verifier : Principal,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    registry_canister_id : ?Principal,
  ) : async ?(Types.BountyId, Types.ICRC16Map) {
    let wasm_id = job.wasm_id;

    let registry : ?McpRegistry.Service = switch (registry_canister_id) {
      case (?id) { ?actor (Principal.toText(id)) };
      case (null) { null };
    };

    label bounty_check for (bounty_id in job.bounty_ids.vals()) {
      switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
        case (?lock) {
          if (Principal.equal(lock.claimant, verifier)) {
            // This verifier has a lock - check if bounty is claimed and get challenge_parameters
            var is_claimed = false;
            var bounty_challenge_params : ?Types.ICRC16Map = null;

            switch (registry) {
              case (?reg) {
                try {
                  let bounty_opt = await reg.icrc127_get_bounty(bounty_id);
                  switch (bounty_opt) {
                    case (?bounty) {
                      is_claimed := Option.isSome(bounty.claimed_date);
                      // Extract challenge_parameters from the bounty
                      switch (bounty.challenge_parameters) {
                        case (#Map(params)) {
                          bounty_challenge_params := ?params;
                        };
                        case (_) {};
                      };
                    };
                    case (null) {};
                  };
                } catch (e) {
                  Debug.print("Error checking if bounty is claimed: " # Error.message(e));
                };
              };
              case (null) {};
            };

            if (not is_claimed) {
              // Found an active locked bounty
              switch (bounty_challenge_params) {
                case (?params) {
                  let audit_type_msg = switch (JobQueue.get_audit_type_from_metadata(params)) {
                    case (?at) { " audit_type=" # at };
                    case (null) { " audit_type=unknown" };
                  };
                  Debug.print("Verifier " # Principal.toText(verifier) # " has ACTIVE audit bounty " # Nat.toText(bounty_id) # audit_type_msg # " for WASM " # wasm_id # " - returning this job");
                  return ?(bounty_id, params);
                };
                case (null) {
                  Debug.print("Warning: Could not get challenge_parameters for active audit bounty " # Nat.toText(bounty_id) # ", falling back to job.build_config");
                  return ?(bounty_id, job.build_config);
                };
              };
            } else {
              Debug.print("Verifier " # Principal.toText(verifier) # " has COMPLETED audit bounty " # Nat.toText(bounty_id) # " for WASM " # wasm_id # " - can get another");
            };
          };
        };
        case (null) {};
      };
    };

    return null;
  };

  /**
   * Find an available bounty that hasn't been assigned yet.
   * Atomically claims it by creating assignment and provisional lock.
   */
  public func claim_available_bounty(
    job : Types.VerificationJob,
    verifier : Principal,
    current_time : Int,
    lock_duration_ns : Int,
    stake_amount : Types.Balance,
    token_id : Types.TokenId,
    assigned_jobs : Map.Map<Types.BountyId, Types.AssignedJob>,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
  ) : ?Types.BountyId {
    let wasm_id = job.wasm_id;

    label bounty_search for (bounty_id in job.bounty_ids.vals()) {
      let is_assigned = Option.isSome(Map.get(assigned_jobs, Map.nhash, bounty_id));
      if (not is_assigned) {
        // IMMEDIATELY claim this bounty to prevent race conditions
        let temp_assignment : Types.AssignedJob = {
          wasm_id;
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

        Debug.print("Claimed audit bounty " # Nat.toText(bounty_id) # " for verifier " # Principal.toText(verifier));
        return ?bounty_id;
      };
    };

    return null;
  };

  /**
   * Fetch bounty build config from registry, with fallback to job config.
   */
  public func get_bounty_build_config(
    bounty_id : Types.BountyId,
    job : Types.VerificationJob,
    registry_canister_id : ?Principal,
  ) : async Types.ICRC16Map {
    switch (registry_canister_id) {
      case (?registry_id) {
        let registry : McpRegistry.Service = actor (Principal.toText(registry_id));
        try {
          let bounty_opt = await registry.icrc127_get_bounty(bounty_id);
          switch (bounty_opt) {
            case (?bounty) {
              // Extract the Map from the challenge_parameters variant
              switch (bounty.challenge_parameters) {
                case (#Map(params)) { return params };
                case (_) {
                  Debug.print("Warning: challenge_parameters for bounty " # Nat.toText(bounty_id) # " is not a Map, falling back to job.build_config");
                  return job.build_config;
                };
              };
            };
            case (null) {
              Debug.print("Warning: Could not find audit bounty " # Nat.toText(bounty_id) # " in registry, falling back to job.build_config");
              return job.build_config;
            };
          };
        } catch (e) {
          Debug.print("Error fetching audit bounty from registry: " # Error.message(e) # ", falling back to job.build_config");
          return job.build_config;
        };
      };
      case (null) {
        Debug.print("Warning: Registry not configured, using job.build_config");
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
   * Check and cleanup expired or claimed assignments for a verifier.
   * Returns active assignment if found.
   */
  public func check_existing_assignment(
    verifier : Principal,
    current_time : Int,
    assigned_jobs : Map.Map<Types.BountyId, Types.AssignedJob>,
    pending_audits : BTree.BTree<Text, Types.VerificationJob>,
    registry_canister_id : ?Principal,
  ) : async ?Types.VerificationJobAssignment {
    let registry : ?McpRegistry.Service = switch (registry_canister_id) {
      case (?id) { ?actor (Principal.toText(id)) };
      case (null) { null };
    };

    for ((bounty_id, assignment) in Map.entries(assigned_jobs)) {
      if (Principal.equal(assignment.verifier, verifier) and assignment.expires_at > current_time) {
        // Check if this bounty is claimed
        var is_claimed = false;
        switch (registry) {
          case (?reg) {
            try {
              let bounty_opt = await reg.icrc127_get_bounty(bounty_id);
              is_claimed := switch (bounty_opt) {
                case (?bounty) { Option.isSome(bounty.claimed_date) };
                case (null) { false };
              };
            } catch (e) {
              Debug.print("Error checking if bounty is claimed: " # Error.message(e));
            };
          };
          case (null) {};
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
              let bounty_build_config = await get_bounty_build_config(
                bounty_id,
                job,
                registry_canister_id,
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
      };
    };

    return null;
  };

};
