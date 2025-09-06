// packages/canisters/audit_hub/src/Main.mo
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Int "mo:base/Int";

shared ({ caller = deployer }) persistent actor class AuditHub() {

  // ==================================================================================
  // == TYPES & CONSTANTS
  // ==================================================================================

  // A unique identifier for a reputation token type (e.g., "security_v1").
  public type TokenId = Text;

  // A unique identifier for a bounty, matching the ID from the ICRC-127 canister.
  public type BountyId = Nat;

  // A balance of reputation tokens.
  public type Balance = Nat;

  // A timestamp in nanoseconds since the epoch.
  public type Timestamp = Int;

  // A record representing an active lock on a bounty.
  public type BountyLock = {
    claimant : Principal;
    expires_at : Timestamp;
    stake_amount : Balance;
    stake_token_id : TokenId;
  };

  // The duration a lock is valid before it expires (e.g., 3 days).
  let LOCK_DURATION_NS : Int = 3 * 24 * 60 * 60 * 1_000_000_000; // 72 hours in nanoseconds

  // ==================================================================================
  // == STATE
  // ==================================================================================

  // The owner of the canister, with administrative privileges.
  var owner : Principal = deployer;

  // Tracks the available (unstaked) balances for each auditor and token type.
  // Map<Auditor Principal, Map<TokenId, Balance>>
  var available_balances = Map.new<Principal, Map.Map<TokenId, Balance>>();

  // Tracks the staked balances for each auditor and token type.
  // Map<Auditor Principal, Map<TokenId, Balance>>
  var staked_balances = Map.new<Principal, Map.Map<TokenId, Balance>>();

  // Tracks active locks on bounties.
  var bounty_locks = Map.new<BountyId, BountyLock>();

  // Configuration: Minimum stake requirements per token type.
  var stake_requirements = Map.new<TokenId, Balance>();

  // ==================================================================================
  // == HELPER FUNCTIONS
  // ==================================================================================

  private func is_owner(caller : Principal) : Bool {
    return Principal.equal(owner, caller);
  };

  // Helper to get a balance from a given map, returning 0 if not found.
  private func _get_balance(balance_map : Map.Map<Principal, Map.Map<TokenId, Balance>>, auditor : Principal, token_id : TokenId) : Balance {
    switch (Map.get(balance_map, phash, auditor)) {
      case (null) { return 0 };
      case (?balances) {
        return Option.get(Map.get(balances, thash, token_id), 0);
      };
    };
  };

  // Helper to set a balance in a given map.
  private func _set_balance(balance_map : Map.Map<Principal, Map.Map<TokenId, Balance>>, auditor : Principal, token_id : TokenId, new_balance : Balance) {
    let auditor_balances = switch (Map.get(balance_map, phash, auditor)) {
      case (null) {
        let new_map = Map.new<TokenId, Balance>();
        Map.set(balance_map, phash, auditor, new_map);
        new_map;
      };
      case (?existing) { existing };
    };
    Map.set(auditor_balances, thash, token_id, new_balance);
  };

  // ==================================================================================
  // == ADMIN METHODS
  // ==================================================================================

  public shared query func get_owner() : async Principal {
    return owner;
  };

  public shared (msg) func set_stake_requirement(token_id : TokenId, amount : Balance) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    Map.set(stake_requirements, thash, token_id, amount);
    return #ok(());
  };

  public shared (msg) func transfer_ownership(new_owner : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can transfer ownership.");
    };
    owner := new_owner;
    return #ok(());
  };

  // Mints new reputation tokens to an auditor's available balance.
  public shared (msg) func mint_tokens(auditor : Principal, token_id : TokenId, amount : Balance) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can mint tokens.");
    };
    let current_balance = _get_balance(available_balances, auditor, token_id);
    _set_balance(available_balances, auditor, token_id, current_balance + amount);
    return #ok(());
  };

  // Burns tokens from an auditor's available balance.
  public shared (msg) func burn_tokens(auditor : Principal, token_id : TokenId, amount : Balance) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can burn tokens.");
    };
    let current_balance = _get_balance(available_balances, auditor, token_id);
    if (current_balance < amount) {
      return #err("Insufficient balance to burn.");
    };
    _set_balance(available_balances, auditor, token_id, current_balance - amount);
    return #ok(());
  };

  // ==================================================================================
  // == STAKING & LOCKING METHODS
  // ==================================================================================

  // Allows an auditor to stake reputation tokens to reserve a bounty.
  public shared (msg) func reserve_bounty(bounty_id : BountyId, token_id : TokenId) : async Result.Result<(), Text> {
    // 1. Check if bounty is already locked by someone else.
    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (?lock) {
        if (Time.now() < lock.expires_at) {
          return #err("Bounty is already locked.");
        };
        // If lock is expired, it can be overwritten.
      };
      case (null) {};
    };

    let auditor = msg.caller;

    let stake_amount = switch (Map.get(stake_requirements, thash, token_id)) {
      case (null) {
        return #err("No stake requirement configured for this token type.");
      };
      case (?amount) { amount };
    };

    // 2. Check if auditor has enough available tokens to stake.
    let available = _get_balance(available_balances, auditor, token_id);
    if (available < stake_amount) {
      return #err("Insufficient available balance to stake.");
    };

    // 3. Perform the internal stake transfer.
    _set_balance(available_balances, auditor, token_id, available - stake_amount);
    let current_staked = _get_balance(staked_balances, auditor, token_id);
    _set_balance(staked_balances, auditor, token_id, current_staked + stake_amount);

    // 4. Create and store the lock.
    let new_lock : BountyLock = {
      claimant = auditor;
      expires_at = Time.now() + LOCK_DURATION_NS;
      stake_amount = stake_amount;
      stake_token_id = token_id;
    };
    Map.set(bounty_locks, Map.nhash, bounty_id, new_lock);

    return #ok(());
  };

  // Called by a trusted party (e.g., DAO) after a successful audit to return the stake.
  public shared (msg) func release_stake(bounty_id : BountyId) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };

    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("Lock not found.") };
      case (?l) { l };
    };

    // Perform the internal unstake transfer.
    let current_staked = _get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    _set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);
    let current_available = _get_balance(available_balances, lock.claimant, lock.stake_token_id);
    _set_balance(available_balances, lock.claimant, lock.stake_token_id, current_available + lock.stake_amount);

    // Delete the lock.
    Map.delete(bounty_locks, Map.nhash, bounty_id);
    return #ok(());
  };

  // Public function anyone can call to clean up an expired lock and slash the stake.
  public shared (msg) func cleanup_expired_lock(bounty_id : BountyId) : async Result.Result<(), Text> {
    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("Lock not found.") };
      case (?l) { l };
    };

    if (Time.now() < lock.expires_at) {
      return #err("Lock has not expired yet.");
    };

    // Slash the stake (burn from the staked balance).
    let current_staked = _get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    _set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

    // Delete the lock, making the bounty available again.
    Map.delete(bounty_locks, Map.nhash, bounty_id);
    return #ok(());
  };

  // ==================================================================================
  // == PUBLIC QUERY & VERIFICATION METHODS
  // ==================================================================================

  public shared query func get_stake_requirement(token_id : TokenId) : async ?Balance {
    return Map.get(stake_requirements, thash, token_id);
  };

  // The critical function called by the ICRC-127 canister before payout.
  public shared query func is_bounty_ready_for_collection(bounty_id : BountyId, potential_claimant : Principal) : async Bool {
    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) {
        // No lock exists, so no one can claim it.
        return false;
      };
      case (?lock) {
        // Check if the caller is the assigned claimant AND the lock is not expired.
        return Principal.equal(lock.claimant, potential_claimant) and (Time.now() <= lock.expires_at);
      };
    };
  };

  public shared query func get_available_balance(auditor : Principal, token_id : TokenId) : async Balance {
    return _get_balance(available_balances, auditor, token_id);
  };

  public shared query func get_staked_balance(auditor : Principal, token_id : TokenId) : async Balance {
    return _get_balance(staked_balances, auditor, token_id);
  };

  public shared query func get_bounty_lock(bounty_id : BountyId) : async ?BountyLock {
    return Map.get(bounty_locks, Map.nhash, bounty_id);
  };
};
