import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Option "mo:base/Option";
import Debug "mo:base/Debug";

import Types "Types";
import Account "Account";

module {

  /**
   * The critical function called by the ICRC-127 canister before payout.
   */
  public func is_bounty_ready_for_collection(
    bounty_id : Types.BountyId,
    potential_claimant : Principal,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
  ) : Bool {
    Debug.print("🔍 [audit_hub] is_bounty_ready_for_collection called:");
    Debug.print("   bounty_id: " # debug_show (bounty_id));
    Debug.print("   potential_claimant: " # debug_show (potential_claimant));

    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) {
        // No lock exists, so no one can claim it.
        Debug.print("   ❌ No lock found for this bounty_id");
        return false;
      };
      case (?lock) {
        Debug.print("   ✅ Lock found:");
        Debug.print("      claimant: " # debug_show (lock.claimant));
        Debug.print("      expires_at: " # debug_show (lock.expires_at));
        Debug.print("      current_time: " # debug_show (Time.now()));

        let claimant_matches = Principal.equal(lock.claimant, potential_claimant);
        let not_expired = Time.now() <= lock.expires_at;

        Debug.print("      claimant_matches: " # debug_show (claimant_matches));
        Debug.print("      not_expired: " # debug_show (not_expired));
        Debug.print("      result: " # debug_show (claimant_matches and not_expired));

        // Check if the caller is the assigned claimant AND the lock is not expired.
        return claimant_matches and not_expired;
      };
    };
  };

  /**
   * Get available balance by audit_type.
   * Looks up the token_id from the stake_requirements for this audit type.
   */
  public func get_available_balance_by_audit_type(
    verifier : Principal,
    audit_type : Text,
    stake_requirements : Map.Map<Text, (Types.TokenId, Types.Balance)>,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
  ) : Types.Balance {
    switch (Map.get(stake_requirements, thash, audit_type)) {
      case (null) { return 0 }; // No stake requirement configured for this audit type
      case (?(token_id, _amount)) {
        return Account.get_balance(available_balances, verifier, token_id);
      };
    };
  };

  public func get_staked_balance(
    verifier : Principal,
    token_id : Types.TokenId,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
  ) : Types.Balance {
    return Account.get_balance(staked_balances, verifier, token_id);
  };

  public func get_bounty_lock(
    bounty_id : Types.BountyId,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
  ) : ?Types.BountyLock {
    return Map.get(bounty_locks, Map.nhash, bounty_id);
  };

  /**
   * Check if a verifier has any active (non-expired) bounty locks.
   * This is used by the registry to authorize API-key-based attestations.
   * @param verifier - The principal of the verifier to check
   * @returns true if the verifier has at least one active lock, false otherwise
   */
  public func has_active_bounty_lock(
    verifier : Principal,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
  ) : Bool {
    let current_time = Time.now();

    // Iterate through all bounty locks to find one owned by this verifier that hasn't expired
    for ((bounty_id, lock) in Map.entries(bounty_locks)) {
      if (Principal.equal(lock.claimant, verifier)) {
        // Check if lock is still valid (not expired)
        if (current_time <= lock.expires_at) {
          return true; // Found an active lock
        };
      };
    };

    return false; // No active locks found
  };

  /**
   * Get verifier profile with balances for a specific token.
   * @param verifier - The principal of the verifier
   * @param token_id - The ledger canister ID (as Principal text) of the token to query
   */
  public func get_verifier_profile(
    verifier : Principal,
    token_id : Types.TokenId,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    verifier_stats : Map.Map<Principal, Types.VerifierProfile>,
  ) : Types.VerifierProfile {
    let stats = Account.get_verifier_stats(verifier_stats, verifier);
    return {
      total_verifications = stats.total_verifications;
      reputation_score = stats.reputation_score;
      total_earnings = stats.total_earnings;
    };
  };
};
