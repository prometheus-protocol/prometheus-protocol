import ICRC127Lib "../../../../libs/icrc127/src/lib";

module {
  // ==================================================================================
  // == TYPES & CONSTANTS
  // ==================================================================================

  // Use ICRC127 library types for consistency with mcp_registry
  public type ICRC16 = ICRC127Lib.ICRC16;
  public type ICRC16Map = ICRC127Lib.ICRC16Map;

  // Result type for function returns
  public type Result<Ok, Err> = {
    #ok : Ok;
    #err : Err;
  };

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
    total_verifications : Nat; // Number of successful verifications
    reputation_score : Nat; // Performance metric (0-100)
    total_earnings : Balance; // Total amount earned from successful verifications
  };

  // Job Queue Types - For managing verification work distribution

  // A verification job pending assignment
  public type VerificationJob = {
    wasm_id : Text;
    repo : Text;
    commit_hash : Text;
    build_config : ICRC16Map;
    created_at : Timestamp;
    required_verifiers : Nat;
    assigned_count : Nat; // How many verifiers currently have active assignments
    completed_count : Nat; // How many verifiers have completed and submitted attestations
    bounty_ids : [BountyId]; // IDs of auto-attached bounties
    audit_type : Text; // e.g., "build_reproducibility_v1", "tools_v1", etc.
    creator : Principal; // Who created this verification job (for registry authorization)
  }; // A job assignment to a specific verifier
  public type AssignedJob = {
    wasm_id : Text;
    audit_type : Text;
    verifier : Principal;
    bounty_id : BountyId;
    assigned_at : Timestamp;
    expires_at : Timestamp;
  };

  // Response when requesting a verification job
  public type VerificationJobAssignment = {
    bounty_id : BountyId;
    wasm_id : Text;
    repo : Text;
    commit_hash : Text;
    build_config : ICRC16Map;
    expires_at : Timestamp;
  };
};
