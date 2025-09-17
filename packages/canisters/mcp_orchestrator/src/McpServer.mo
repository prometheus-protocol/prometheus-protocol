import Result "mo:base/Result";
// packages/canisters/mcp_orchestrator/src/McpRegistryInterface.mo

// This module defines the necessary types and the actor interface for the McpRegistry canister,
// allowing the orchestrator to make type-safe calls without a direct import.
module {

  // --- TYPE DEFINITIONS (Translated from Candid) ---
  public type TreasuryError = {
    #NotOwner;
  };

  // --- ACTOR SERVICE INTERFACE ---

  // This defines the public functions on the McpRegistry that our orchestrator will call.
  public type Service = actor {
    set_owner : (new_owner : Principal) -> async Result.Result<(), TreasuryError>;
  };
};
