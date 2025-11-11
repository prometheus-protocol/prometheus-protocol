import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Int "mo:base/Int";

import ICRC127Service "../../../../libs/icrc127/src/service";
import ICRC127Lib "../../../../libs/icrc127/src/lib";

// This module defines the public interface of the McpRegistry canister,
// allowing other canisters like the mcp_registry to make type-safe calls to it.
module McpRegistry {

  // --- TYPE DEFINITIONS (Translated from the McpRegistry canister) ---

  // Job Queue Types
  public type ICRC16 = {
    #Text : Text;
    #Nat : Nat;
    #Int : Int;
    #Blob : Blob;
    #Bool : Bool;
    #Array : [ICRC16];
    #Map : [(Text, ICRC16)];
  };

  public type ICRC16Map = [(Text, ICRC16)];

  // Import types from ICRC127
  public type ClaimRecord = ICRC127Service.ClaimRecord;

  // Use the actual Bounty type from the ICRC127 library (which includes challenge_parameters)
  public type Bounty = ICRC127Lib.Bounty;

  // --- ACTOR SERVICE INTERFACE ---

  public type Service = actor {
    icrc126_list_attestations : (wasm_id : Text) -> async [Nat];
    icrc126_list_divergences : (wasm_id : Text) -> async [Nat];
    icrc127_get_bounty : (bounty_id : Nat) -> async ?Bounty;
  };
};
