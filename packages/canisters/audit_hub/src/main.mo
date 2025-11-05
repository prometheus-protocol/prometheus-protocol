// packages/canisters/audit_hub/src/Main.mo
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
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
import Debug "mo:base/Debug";

shared ({ caller = deployer }) persistent actor class AuditHub() = this {

  // ==================================================================================
  // == TYPES & CONSTANTS
  // ==================================================================================

  // API Credential for verifier bots
  public type ApiCredential = {
    api_key : Text; // Generated unique key
    verifier_principal : Principal; // Owner of this credential
    created_at : Timestamp;
    last_used : ?Timestamp;
    is_active : Bool;
  };

  // A unique identifier for a reputation token type (e.g., "build_reproducibility_v1").
  public type TokenId = Text;

  // A unique identifier for a bounty, matching the ID from the ICRC-127 canister.
  public type BountyId = Nat;

  // A balance in USDC (atomic units).
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

  // The profile of a verifier, including their balances and reputation scores.
  public type VerifierProfile = {
    available_balance_usdc : Balance; // USDC not currently staked
    staked_balance_usdc : Balance; // USDC locked in active bounties
    total_verifications : Nat; // Number of successful verifications
    reputation_score : Nat; // Performance metric (0-100)
    total_earnings : Balance; // Total amount earned from successful verifications
  };

  // The duration a lock is valid before it expires (1 hour for automated builds).
  let LOCK_DURATION_NS : Int = 1 * 60 * 60 * 1_000_000_000; // 1 hour in nanoseconds

  // ==================================================================================
  // == STATE
  // ==================================================================================

  // The owner of the canister, with administrative privileges.
  var owner : Principal = deployer;

  // Token configuration
  var payment_token_ledger_id : ?Principal = null; // Ledger canister ID (e.g., USDC)
  var payment_token_symbol : Text = "USDC"; // Token symbol (configurable)
  var payment_token_decimals : Nat8 = 6; // Token decimals (configurable)

  // DEPRECATED: Use payment_token_ledger_id instead
  var usdc_ledger_id : ?Principal = null;

  // Verifier Dashboard canister ID - for API credential validation
  var dashboard_canister_id : ?Principal = null;
  var registry_canister_id : ?Principal = null;

  // Tracks the available (unstaked) balances for each verifier and token type
  // Map<Verifier Principal, Map<TokenId, Balance>>
  var available_balances = Map.new<Principal, Map.Map<TokenId, Balance>>();

  // Tracks the staked balances for each verifier and token type
  // Map<Verifier Principal, Map<TokenId, Balance>>
  var staked_balances = Map.new<Principal, Map.Map<TokenId, Balance>>();

  // Tracks active locks on bounties.
  var bounty_locks = Map.new<BountyId, BountyLock>();

  // Configuration: Minimum stake requirements per token type (in USDC atomic units).
  var stake_requirements = Map.new<TokenId, Balance>();

  // Reputation tracking: verifications completed per verifier
  var verifier_stats = Map.new<Principal, { total_verifications : Nat; reputation_score : Nat; /* 0-100 based on performance */
  total_earnings : Balance; /* Total amount earned from successful verifications */ }>();

  // API Credentials Management
  // Map API key to verifier principal and metadata
  var api_credentials = Map.new<Text, ApiCredential>();

  // Map verifier principal to their API keys
  var verifier_api_keys = Map.new<Principal, [Text]>();

  // Track which verifiers have participated in each WASM verification
  // Map<BountyId, Principal> - maps bounty to the verifier who reserved it
  var _bounty_verifier_map = Map.new<BountyId, Principal>();

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

  // Helper to get a balance from a given map, returning 0 if not found.
  private func _get_balance(balance_map : Map.Map<Principal, Map.Map<TokenId, Balance>>, verifier : Principal, token_id : TokenId) : Balance {
    switch (Map.get(balance_map, phash, verifier)) {
      case (null) { return 0 };
      case (?balances) {
        return Option.get(Map.get(balances, thash, token_id), 0);
      };
    };
  };

  // Helper to set a balance in a given map.
  private func _set_balance(balance_map : Map.Map<Principal, Map.Map<TokenId, Balance>>, verifier : Principal, token_id : TokenId, new_balance : Balance) {
    let verifier_balances = switch (Map.get(balance_map, phash, verifier)) {
      case (null) {
        let new_map = Map.new<TokenId, Balance>();
        Map.set(balance_map, phash, verifier, new_map);
        new_map;
      };
      case (?existing) { existing };
    };
    Map.set(verifier_balances, thash, token_id, new_balance);
  };

  // Helper to get verifier stats
  private func _get_verifier_stats(verifier : Principal) : {
    total_verifications : Nat;
    reputation_score : Nat;
    total_earnings : Balance;
  } {
    return Option.get(
      Map.get(verifier_stats, phash, verifier),
      { total_verifications = 0; reputation_score = 100; total_earnings = 0 }, // Default: new verifier starts with perfect score
    );
  };

  /**
   * Generate a random API key from entropy.
   * Returns a 32-character hexadecimal string (128 bits of entropy).
   */
  private func _generate_api_key(entropy : Blob) : Text {
    let bytes = Blob.toArray(entropy);
    let hex_chars = "0123456789abcdef";

    var result = "";
    var i = 0;

    while (i < 16 and i < bytes.size()) {
      let byte = bytes[i];
      let high = Nat8.toNat(byte / 16);
      let low = Nat8.toNat(byte % 16);

      result := result # Text.fromChar(Text.toArray(hex_chars)[high]);
      result := result # Text.fromChar(Text.toArray(hex_chars)[low]);

      i += 1;
    };

    return "vr_" # result; // Prefix with "vr_" for clarity
  };

  // ==================================================================================
  // == ADMIN METHODS
  // ==================================================================================

  public shared query func get_owner() : async Principal {
    return owner;
  };

  public shared (msg) func set_usdc_ledger_id(ledger_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    usdc_ledger_id := ?ledger_id;
    payment_token_ledger_id := ?ledger_id; // Update new field too
    return #ok(());
  };

  public shared (msg) func set_payment_token_config(
    ledger_id : Principal,
    symbol : Text,
    decimals : Nat8,
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    payment_token_ledger_id := ?ledger_id;
    payment_token_symbol := symbol;
    payment_token_decimals := decimals;
    usdc_ledger_id := ?ledger_id; // Keep deprecated field in sync
    return #ok(());
  };

  public shared query func get_payment_token_config() : async {
    ledger_id : ?Principal;
    symbol : Text;
    decimals : Nat8;
  } {
    return {
      ledger_id = payment_token_ledger_id;
      symbol = payment_token_symbol;
      decimals = payment_token_decimals;
    };
  };

  public shared (msg) func set_dashboard_canister_id(dashboard_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    dashboard_canister_id := ?dashboard_id;
    return #ok(());
  };

  public shared (msg) func set_registry_canister_id(registry_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized.");
    };
    registry_canister_id := ?registry_id;
    return #ok(());
  };

  public shared query func get_registry_canister_id() : async ?Principal {
    return registry_canister_id;
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

  // ==================================================================================
  // == API KEY MANAGEMENT (For Verifier Bots)
  // ==================================================================================

  /**
   * Generate a new API key for the verifier to use in their bot.
   * Called by the verifier principal (authenticated via Internet Identity in UI).
   */
  public shared (msg) func generate_api_key() : async Result.Result<Text, Text> {
    let verifier = msg.caller;

    // Generate a random API key (128-bit hex string)
    let entropy = await Random.blob();
    let api_key = _generate_api_key(entropy);

    // Store credential
    let credential : ApiCredential = {
      api_key = api_key;
      verifier_principal = verifier;
      created_at = Time.now();
      last_used = null;
      is_active = true;
    };

    Map.set(api_credentials, thash, api_key, credential);

    // Update verifier's API key list
    let existing_keys = Option.get(Map.get(verifier_api_keys, phash, verifier), []);
    Map.set(verifier_api_keys, phash, verifier, Array.append(existing_keys, [api_key]));

    return #ok(api_key);
  };

  /**
   * Revoke an API key (makes it inactive).
   */
  public shared (msg) func revoke_api_key(api_key : Text) : async Result.Result<(), Text> {
    let verifier = msg.caller;

    // Check if this API key belongs to the caller
    switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { return #err("API key not found.") };
      case (?cred) {
        if (not Principal.equal(cred.verifier_principal, verifier)) {
          return #err("Unauthorized: This API key does not belong to you.");
        };

        // Deactivate the key
        let updated_cred : ApiCredential = {
          api_key = cred.api_key;
          verifier_principal = cred.verifier_principal;
          created_at = cred.created_at;
          last_used = cred.last_used;
          is_active = false;
        };

        Map.set(api_credentials, thash, api_key, updated_cred);
        return #ok(());
      };
    };
  };

  /**
   * Validate an API key and return the associated verifier principal.
   * Used by the verifier bot to authenticate reserve_bounty requests.
   */
  public shared query func validate_api_key(api_key : Text) : async Result.Result<Principal, Text> {
    switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { return #err("Invalid API key.") };
      case (?cred) {
        if (not cred.is_active) {
          return #err("API key has been revoked.");
        };
        return #ok(cred.verifier_principal);
      };
    };
  };

  /**
   * List all API keys for the authenticated verifier.
   */
  public shared (msg) func list_api_keys() : async [ApiCredential] {
    let verifier = msg.caller;
    let api_keys = Option.get(Map.get(verifier_api_keys, phash, verifier), []);

    let credentials = Array.mapFilter<Text, ApiCredential>(
      api_keys,
      func(key : Text) : ?ApiCredential {
        Map.get(api_credentials, thash, key);
      },
    );

    return credentials;
  };

  /**
   * Record that an API key was used (for monitoring in dashboard).
   */
  private func _record_api_key_usage(api_key : Text) {
    switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { /* Invalid key, ignore */ };
      case (?cred) {
        let updated_cred : ApiCredential = {
          api_key = cred.api_key;
          verifier_principal = cred.verifier_principal;
          created_at = cred.created_at;
          last_used = ?Time.now();
          is_active = cred.is_active;
        };
        Map.set(api_credentials, thash, api_key, updated_cred);
      };
    };
  };

  // ==================================================================================
  // == STAKE POOL MANAGEMENT (Deposits & Withdrawals)
  // ==================================================================================

  /**
   * Deposit USDC into the verifier's stake pool.
   * The caller must have already approved this canister to spend USDC on their behalf.
   */
  public shared (msg) func deposit_stake(amount : Balance) : async Result.Result<(), Text> {
    let verifier = msg.caller;
    let token_id = "usdc"; // Default token ID for USDC deposits

    // 1. Ensure USDC ledger is configured
    let ledger_id = switch (usdc_ledger_id) {
      case (null) { return #err("USDC ledger not configured.") };
      case (?id) { id };
    };

    Debug.print("Ledger ID for deposit: " # Principal.toText(ledger_id));

    // 2. Transfer USDC from verifier to this canister using icrc2_transfer_from
    let ledger : ICRC2.Service = actor (Principal.toText(ledger_id));

    Debug.print("Depositing stake: Verifier=" # Principal.toText(verifier) # " Amount=" # Nat.toText(amount));

    // Check allowance:
    let allowance = await ledger.icrc2_allowance({
      account = { owner = verifier; subaccount = null };
      spender = { owner = Principal.fromActor(this); subaccount = null };
    });

    if (allowance.allowance < amount) {
      Debug.print("Insufficient allowance: Allowed=" # Nat.toText(allowance.allowance) # " Required=" # Nat.toText(amount));
      return #err("Insufficient allowance for transfer. Please approve the canister to spend your USDC.");
    };

    let transfer_args : ICRC2.TransferFromArgs = {
      from = { owner = verifier; subaccount = null };
      to = { owner = Principal.fromActor(this); subaccount = null };
      amount = amount;
      fee = null; // Use default fee
      memo = null;
      created_at_time = null;
      spender_subaccount = null;
    };

    let transfer_result = await ledger.icrc2_transfer_from(transfer_args);

    switch (transfer_result) {
      case (#Ok(_)) {
        // 3. Update available balance
        let current_balance = _get_balance(available_balances, verifier, token_id);
        _set_balance(available_balances, verifier, token_id, current_balance + amount);
        return #ok(());
      };
      case (#Err(err)) {
        return #err("USDC transfer failed: " # debug_show (err));
      };
    };
  };

  /**
   * Withdraw USDC from the verifier's available balance (not currently staked).
   */
  public shared (msg) func withdraw_stake(amount : Balance) : async Result.Result<(), Text> {
    let verifier = msg.caller;
    let token_id = "usdc"; // Default token ID for USDC withdrawals

    // 1. Check available balance
    let current_balance = _get_balance(available_balances, verifier, token_id);
    if (current_balance < amount) {
      return #err("Insufficient available balance.");
    };

    // 2. Ensure USDC ledger is configured
    let ledger_id = switch (usdc_ledger_id) {
      case (null) { return #err("USDC ledger not configured.") };
      case (?id) { id };
    };

    // 3. Transfer USDC from this canister to verifier
    let ledger : ICRC2.Service = actor (Principal.toText(ledger_id));

    let transfer_args : ICRC2.TransferArgs = {
      to = { owner = verifier; subaccount = null };
      amount = amount;
      fee = null;
      memo = null;
      from_subaccount = null;
      created_at_time = null;
    };

    let transfer_result = await ledger.icrc1_transfer(transfer_args);

    switch (transfer_result) {
      case (#Ok(_)) {
        // 4. Update available balance
        _set_balance(available_balances, verifier, token_id, current_balance - amount);
        return #ok(());
      };
      case (#Err(err)) {
        return #err("USDC transfer failed: " # debug_show (err));
      };
    };
  };

  // ==================================================================================
  // == BOUNTY RESERVATION & LOCKING METHODS
  // ==================================================================================

  /**
   * Allows a verifier to stake USDC to reserve a bounty (1-hour lock).
   * Can be called directly by the verifier principal OR via API key from a bot.
   */
  public shared (msg) func reserve_bounty(bounty_id : BountyId, token_id : TokenId) : async Result.Result<(), Text> {
    let verifier = msg.caller;

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

    let stake_amount = switch (Map.get(stake_requirements, thash, token_id)) {
      case (null) {
        return #err("No stake requirement configured for this token type.");
      };
      case (?amount) { amount };
    };

    // 2. Check if verifier has enough available USDC to stake.
    let available = _get_balance(available_balances, verifier, token_id);
    if (available < stake_amount) {
      return #err("Insufficient available balance to stake. Deposit more USDC via the dashboard.");
    };

    // 3. Perform the internal stake transfer.
    _set_balance(available_balances, verifier, token_id, available - stake_amount);
    let current_staked = _get_balance(staked_balances, verifier, token_id);
    _set_balance(staked_balances, verifier, token_id, current_staked + stake_amount);

    // 4. Create and store the lock (1-hour expiration).
    let new_lock : BountyLock = {
      claimant = verifier;
      expires_at = Time.now() + LOCK_DURATION_NS;
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
  public shared func reserve_bounty_with_api_key(
    api_key : Text,
    bounty_id : BountyId,
    token_id : TokenId,
  ) : async Result.Result<(), Text> {
    // 1. Validate API key and get verifier principal
    let verifier = switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { return #err("Invalid API key.") };
      case (?cred) {
        if (not cred.is_active) {
          return #err("API key has been revoked.");
        };
        _record_api_key_usage(api_key);
        cred.verifier_principal;
      };
    };

    // 2. Check if bounty is already locked
    switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (?lock) {
        if (Time.now() < lock.expires_at) {
          return #err("Bounty is already locked.");
        };
      };
      case (null) {};
    };

    let stake_amount = switch (Map.get(stake_requirements, thash, token_id)) {
      case (null) {
        return #err("No stake requirement configured for this token type.");
      };
      case (?amount) { amount };
    };

    // 3. Check if verifier has enough available USDC to stake
    let available = _get_balance(available_balances, verifier, token_id);
    if (available < stake_amount) {
      return #err("Insufficient available balance to stake. Deposit more USDC via the dashboard.");
    };

    // 4. Perform the internal stake transfer
    _set_balance(available_balances, verifier, token_id, available - stake_amount);
    let current_staked = _get_balance(staked_balances, verifier, token_id);
    _set_balance(staked_balances, verifier, token_id, current_staked + stake_amount);

    // 5. Create and store the lock (1-hour expiration)
    let new_lock : BountyLock = {
      claimant = verifier;
      expires_at = Time.now() + LOCK_DURATION_NS;
      stake_amount = stake_amount;
      stake_token_id = token_id;
    };
    Map.set(bounty_locks, Map.nhash, bounty_id, new_lock);

    return #ok(());
  };

  // Called by the registry after successful verification to return the stake and update reputation.
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

    // Update verifier stats (successful verification)
    let stats = _get_verifier_stats(lock.claimant);
    Map.set(
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
   * Called by the registry when a verifier was on the losing side of consensus.
   * Slashes their stake and penalizes reputation (they provided incorrect verification).
   */
  public shared (msg) func slash_stake_for_incorrect_consensus(bounty_id : BountyId) : async Result.Result<(), Text> {
    if (not is_authorized_for_consensus(msg.caller)) {
      return #err("Unauthorized: caller is not owner or registry");
    };

    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("Lock not found.") };
      case (?l) { l };
    };

    // Slash the stake (burn from the staked balance - lost to the protocol)
    let current_staked = _get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    _set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

    // Penalize reputation for being on wrong side of consensus
    let stats = _get_verifier_stats(lock.claimant);
    var new_score : Nat = 0;
    if (stats.reputation_score > 20) {
      new_score := stats.reputation_score - 20; // Larger penalty than timeout (20 vs 10)
    };

    Map.set(
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

  // Public function anyone can call to clean up an expired lock and slash the stake.
  public shared func cleanup_expired_lock(bounty_id : BountyId) : async Result.Result<(), Text> {
    let lock = switch (Map.get(bounty_locks, Map.nhash, bounty_id)) {
      case (null) { return #err("Lock not found.") };
      case (?l) { l };
    };

    if (Time.now() < lock.expires_at) {
      return #err("Lock has not expired yet (1-hour deadline not reached).");
    };

    // Slash the stake (burn from the staked balance - lost to the protocol).
    let current_staked = _get_balance(staked_balances, lock.claimant, lock.stake_token_id);
    _set_balance(staked_balances, lock.claimant, lock.stake_token_id, current_staked - lock.stake_amount);

    // Penalize reputation for abandoning verification (saturating subtraction)
    let stats = _get_verifier_stats(lock.claimant);
    var new_score : Nat = 0;
    if (stats.reputation_score > 10) {
      new_score := stats.reputation_score - 10;
    };

    Map.set(
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

  public shared query func get_available_balance(verifier : Principal, token_id : TokenId) : async Balance {
    return _get_balance(available_balances, verifier, token_id);
  };

  public shared query func get_staked_balance(verifier : Principal, token_id : TokenId) : async Balance {
    return _get_balance(staked_balances, verifier, token_id);
  };

  public shared query func get_bounty_lock(bounty_id : BountyId) : async ?BountyLock {
    return Map.get(bounty_locks, Map.nhash, bounty_id);
  };

  public shared query func get_verifier_profile(verifier : Principal) : async VerifierProfile {
    let stats = _get_verifier_stats(verifier);
    let usdc_token_id = "usdc"; // Default token ID for backward compatibility
    return {
      available_balance_usdc = _get_balance(available_balances, verifier, usdc_token_id);
      staked_balance_usdc = _get_balance(staked_balances, verifier, usdc_token_id);
      total_verifications = stats.total_verifications;
      reputation_score = stats.reputation_score;
      total_earnings = stats.total_earnings;
    };
  };

  public type EnvDependency = {
    key : Text;
    setter : Text;
    canister_name : Text;
    required : Bool;
    current_value : ?Principal;
  };

  public type EnvConfig = {
    key : Text;
    setter : Text;
    value_type : Text;
    required : Bool;
    current_value : ?Text;
  };

  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    #v1({
      dependencies = [
        {
          key = "payment_token_ledger_id";
          setter = "set_usdc_ledger_id";
          canister_name = "usdc_ledger";
          required = true;
          current_value = payment_token_ledger_id;
        },
        {
          key = "registry_canister_id";
          setter = "set_registry_canister_id";
          canister_name = "mcp_registry";
          required = true;
          current_value = registry_canister_id;
        },
        {
          key = "dashboard_canister_id";
          setter = "set_dashboard_canister_id";
          canister_name = "dashboard";
          required = false;
          current_value = dashboard_canister_id;
        },
      ];
      configuration = [];
    });
  };
};
