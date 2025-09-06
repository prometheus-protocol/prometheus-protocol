// packages/canisters/mcp_registry/src/AuditHub.mo

import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import ICRC126 "../../../../libs/icrc126/src/lib";

// This module defines the public interface of the AuditHub canister,
// allowing other canisters like the mcp_registry to make type-safe calls to it.
module AuditHub {

  // --- TYPE DEFINITIONS (Translated from the AuditHub canister) ---

  public type TokenId = Text;
  public type BountyId = Nat;
  public type Balance = Nat;
  public type Timestamp = Int;

  public type BountyLock = {
    claimant : Principal;
    expires_at : Timestamp;
    stake_amount : Balance;
    stake_token_id : TokenId;
  };

  public type CallResult = Result.Result<(), Text>;

  // Helper function to safely extract bounty_id from ICRC-16 metadata
  public func get_bounty_id_from_metadata(metadata : ICRC126.ICRC16Map) : ?BountyId {
    for ((key, val) in metadata.vals()) {
      if (key == "bounty_id") {
        switch (val) {
          // Bounties are Nats, but let's be flexible and accept Text too
          case (#Nat(n)) { return ?n };
          case (#Text(t)) { return Nat.fromText(t) };
          case (_) { return null };
        };
      };
    };
    return null;
  };

  // --- ACTOR SERVICE INTERFACE ---

  public type Service = actor {
    // == ADMIN METHODS ==
    get_owner : query () -> async Principal;
    transfer_ownership : (new_owner : Principal) -> async CallResult;
    mint_tokens : (auditor : Principal, token_id : TokenId, amount : Balance) -> async CallResult;
    burn_tokens : (auditor : Principal, token_id : TokenId, amount : Balance) -> async CallResult;

    // == STAKING & LOCKING METHODS ==
    reserve_bounty : (bounty_id : BountyId, token_id : TokenId, stake_amount : Balance) -> async CallResult;
    release_stake : (bounty_id : BountyId) -> async CallResult;
    cleanup_expired_lock : (bounty_id : BountyId) -> async CallResult;

    // == PUBLIC QUERY & VERIFICATION METHODS ==
    is_bounty_ready_for_collection : query (bounty_id : BountyId, potential_claimant : Principal) -> async Bool;
    get_available_balance : query (auditor : Principal, token_id : TokenId) -> async Balance;
    get_staked_balance : query (auditor : Principal, token_id : TokenId) -> async Balance;
    get_bounty_lock : query (bounty_id : BountyId) -> async ?BountyLock;
  };
};
