import Result "mo:base/Result";
import Principal "mo:base/Principal";

module {
  public type Service = actor {
    add_approved_wasm_hash : (wasm_id : Text) -> async Result.Result<(), Text>;
    register_canister_namespace : (canister_id : Principal, namespace : Text) -> async Result.Result<(), Text>;
  };
};
