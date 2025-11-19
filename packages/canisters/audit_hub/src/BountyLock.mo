import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";

import Types "Types";
import Account "Account";

module {
  private let _LOCK_DURATION_NS : Int = 3_600_000_000_000; // 1 hour in nanoseconds

  /**
   * Reserve a bounty for a verifier.
   * Creates a lock and stakes tokens from their available balance.
   */
  public func reserve_bounty(
    bounty_id : Types.BountyId,
    audit_type : Text,
    verifier : Principal,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    stake_requirements : Map.Map<Text, (Types.TokenId, Types.Balance)>,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    verifier_stats : Map.Map<Principal, Types.VerifierProfile>,
    lock_duration_ns : Int,
  ) : Result.Result<(), Text> {
    // 1. Check if bounty is already locked by someone else.
    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (?lock) {
        if (Time.now() < lock.expires_at) {
          return #err("Bounty is already locked.");
        };
        // If lock is expired, clean it up first (slash the old stake)
        let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
        Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);
        
        // Penalize reputation for abandoning verification
        let stats = Account.get_verifier_stats(verifier_stats, lock.claimant);
        var new_score : Nat = 0;
        if (stats.reputation_score > 10) {
          new_score := stats.reputation_score - 10;
        };
        ignore Map.put(
          verifier_stats,
          phash,
          lock.claimant,
          {
            total_verifications = stats.total_verifications;
            reputation_score = new_score;
            total_earnings = stats.total_earnings;
          },
        );
      };
      case (null) {};
    };

    // Get stake requirement for this audit type
    let (token_id, stake_amount) = switch (Map.get(stake_requirements, thash, audit_type)) {
      case (null) {
        return #err("No stake requirement configured for audit type: " # audit_type);
      };
      case (?(tid, amt)) { (tid, amt) };
    };

    // 2. Check if verifier has enough available tokens to stake.
    let available = Account.get_balance(available_balances, verifier, token_id);
    if (available < stake_amount) {
      return #err("Insufficient available balance to stake. Deposit more tokens via the dashboard.");
    };

    // 3. Perform the internal stake transfer.
    Account.set_balance(available_balances, verifier, token_id, available - stake_amount);
    let current_staked = Account.get_balance(staked_balances, verifier, token_id);
    Account.set_balance(staked_balances, verifier, token_id, current_staked + stake_amount);

    // 4. Create and store the lock.
    let new_lock : Types.BountyLock = {
      claimant = verifier;
      expires_at = Time.now() + lock_duration_ns;
      stake_amount = stake_amount;
      stake_token_id = token_id;
    };
    Map.set(bounty_locks, Map.nhash, bounty_id, new_lock);

    return #ok(());
  };

  /**
   * Reserve a bounty using an API key (for bot authentication).
   * The bot passes its API key, and we resolve it to the verifier principal.
   */
  public func reserve_bounty_with_api_key(
    api_key : Text,
    bounty_id : Types.BountyId,
    audit_type : Text,
    api_credentials : Map.Map<Text, Types.ApiCredential>,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    stake_requirements : Map.Map<Text, (Types.TokenId, Types.Balance)>,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    verifier_stats : Map.Map<Principal, Types.VerifierProfile>,
    lock_duration_ns : Int,
    record_api_key_usage : (Text) -> (),
  ) : Result.Result<(), Text> {
    // 1. Validate API key and get verifier principal
    let verifier = switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { return #err("Invalid API key.") };
      case (?cred) {
        if (not cred.is_active) {
          return #err("API key has been revoked.");
        };
        record_api_key_usage(api_key);
        cred.verifier_principal;
      };
    };

    // 2. Delegate to reserve_bounty
    reserve_bounty(
      bounty_id,
      audit_type,
      verifier,
      bounty_locks,
      stake_requirements,
      available_balances,
      staked_balances,
      verifier_stats,
      lock_duration_ns,
    );
  };

  /**
   * Release the stake for a successful verification.
   * Called by the registry after verification is complete.
   */
  public func release_stake(
    bounty_id : Types.BountyId,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    verifier_stats : Map.Map<Principal, Types.VerifierProfile>,
  ) : Result.Result<(), Text> {
    // Look up the lock.
    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("No lock found for this bounty.") };
      case (?l) { l };
    };

    // Return stake to the verifier's available balance
    let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

    let current_available = Account.get_balance(available_balances, lock.claimant, lock.stake_token_id);
    Account.set_balance(available_balances, lock.claimant, lock.stake_token_id, current_available + lock.stake_amount);

    // Update verifier stats (successful verification)
    let stats = Account.get_verifier_stats(verifier_stats, lock.claimant);
    ignore Map.put(
      verifier_stats,
      phash,
      lock.claimant,
      {
        total_verifications = stats.total_verifications + 1;
        reputation_score = Nat.min(100, stats.reputation_score + 1); // Increase reputation up to 100
        total_earnings = stats.total_earnings + lock.stake_amount; // Track the bounty amount earned
      },
    );

    // Delete the lock.
    Map.delete(bounty_locks, Map.nhash, bounty_id);
    return #ok(());
  };

  /**
   * Slash the stake for incorrect consensus (verifier on the wrong side).
   * Called by the registry after consensus is reached.
   */
  public func slash_stake_for_incorrect_consensus(
    bounty_id : Types.BountyId,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    verifier_stats : Map.Map<Principal, Types.VerifierProfile>,
  ) : Result.Result<(), Text> {
    // Look up the lock.
    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("No lock found for this bounty.") };
      case (?l) { l };
    };

    // Remove the stake from the verifier's staked balance (effectively slashing it)
    let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

    // Penalize reputation for being on wrong side of consensus
    let stats = Account.get_verifier_stats(verifier_stats, lock.claimant);
    var new_score : Nat = 0;
    if (stats.reputation_score > 20) {
      new_score := stats.reputation_score - 20; // Larger penalty than timeout (20 vs 10)
    };

    ignore Map.put(
      verifier_stats,
      phash,
      lock.claimant,
      {
        total_verifications = stats.total_verifications; // No increment
        reputation_score = new_score;
        total_earnings = stats.total_earnings; // No change in earnings
      },
    );

    // Delete the lock
    Map.delete(bounty_locks, Map.nhash, bounty_id);
    return #ok(());
  };

  /**
   * Public function anyone can call to clean up an expired lock and slash the stake.
   */
  public func cleanup_expired_lock(
    bounty_id : Types.BountyId,
    bounty_locks : Map.Map<Types.BountyId, Types.BountyLock>,
    staked_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    verifier_stats : Map.Map<Principal, Types.VerifierProfile>,
  ) : Result.Result<(), Text> {
    // Look up the lock.
    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("No lock found for this bounty.") };
      case (?l) { l };
    };

    // Check if lock is expired.
    if (lock.expires_at > Time.now()) {
      return #err("Lock has not yet expired.");
    };

    // Slash the stake.
    let current_staked = Account.get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    Account.set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

    // Penalize reputation for abandoning verification (saturating subtraction)
    let stats = Account.get_verifier_stats(verifier_stats, lock.claimant);
    var new_score : Nat = 0;
    if (stats.reputation_score > 10) {
      new_score := stats.reputation_score - 10;
    };

    ignore Map.put(
      verifier_stats,
      phash,
      lock.claimant,
      {
        total_verifications = stats.total_verifications; // No increment
        reputation_score = new_score;
        total_earnings = stats.total_earnings; // No change in earnings
      },
    );

    // Delete the lock, making the bounty available again.
    Map.delete(bounty_locks, Map.nhash, bounty_id);
    return #ok(());
  };
};
