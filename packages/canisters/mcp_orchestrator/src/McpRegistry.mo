import Result "mo:base/Result";
// packages/canisters/mcp_orchestrator/src/McpRegistryInterface.mo

// This module defines the necessary types and the actor interface for the McpRegistry canister,
// allowing the orchestrator to make type-safe calls without a direct import.
module {

  // --- TYPE DEFINITIONS (Translated from Candid) ---

  // from: type WasmVersionPointer
  public type WasmVersionPointer = {
    canister_type_namespace : Text;
    version_number : (Nat, Nat, Nat);
  };

  // from: type GetWasmChunkRequest
  public type GetWasmChunkRequest = {
    canister_type_namespace : Text;
    chunk_id : Nat;
    hash : Blob;
    version_number : (Nat, Nat, Nat);
  };

  // from: the #Ok variant of GetWasmChunkResponse
  public type GetWasmChunkOk = {
    canister_type_namespace : Text;
    chunk_id : Nat;
    expected_chunk_hash : Blob;
    expected_wasm_hash : Blob;
    version_number : (Nat, Nat, Nat);
    wasm_chunk : Blob;
  };

  // from: type GetWasmChunkResponse
  public type GetWasmChunkResponse = Result.Result<GetWasmChunkOk, Text>;

  // --- ACTOR SERVICE INTERFACE ---

  // This defines the public functions on the McpRegistry that our orchestrator will call.
  public type Service = actor {
    // Corresponds to: is_controller_of_type: (namespace: text, user: principal) -> (Result_1);
    is_controller_of_type : (namespace : Text, user : Principal) -> async Result.Result<Bool, Text>;

    // Corresponds to: get_wasm_by_hash: (hash: blob) -> (opt record { ... });
    get_wasm_by_hash : (hash : Blob) -> async ?{
      pointer : WasmVersionPointer;
      chunk_hashes : [Blob];
    };

    // Corresponds to: icrc118_get_wasm_chunk: (req: GetWasmChunkRequest) -> (GetWasmChunkResponse) query;
    icrc118_get_wasm_chunk : (req : GetWasmChunkRequest) -> async GetWasmChunkResponse;
  };
};
