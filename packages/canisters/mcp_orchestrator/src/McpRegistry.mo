import Result "mo:base/Result";
// packages/canisters/mcp_orchestrator/src/McpRegistryInterface.mo

// This module defines the necessary types and the actor interface for the McpRegistry canister,
// allowing the orchestrator to make type-safe calls without a direct import.
module {

  // --- TYPE DEFINITIONS (Translated from Candid) ---

  // --- ACTOR SERVICE INTERFACE ---

  // This defines the public functions on the McpRegistry that our orchestrator will call.
  public type Service = actor {
    // Corresponds to: is_controller_of_type: (namespace: text, user: principal) -> (Result_1);
    is_controller_of_type : (namespace : Text, user : Principal) -> async Result.Result<Bool, Text>;

    // Checks if a Wasm has been officially verified by the DAO.
    is_wasm_verified : (wasm_id : Text) -> async Bool;

    // Checks if a caller can install a specific Wasm.
    can_install_wasm : (caller : Principal, wasm_id : Text) -> async Bool;
  };
};
