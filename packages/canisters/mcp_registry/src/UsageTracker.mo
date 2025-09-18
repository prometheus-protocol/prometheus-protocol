import Result "mo:base/Result";

module {
  public type Service = actor {
    add_approved_wasm_hash : (wasm_id : Text) -> async Result.Result<(), Text>;
  };
};
