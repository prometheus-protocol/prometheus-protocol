import Result "mo:base/Result";
import Map "mo:map/Map";
import Types "./Types";

module {
  public func set_registry_canister_id(
    state : Types.State,
    caller : Principal,
    canister_id : Principal,
  ) : Result.Result<(), Text> {
    if (caller != state.owner) {
      return #err("Unauthorized: Only owner can set registry canister ID");
    };
    state.registry_canister_id := ?canister_id;
    #ok(());
  };

  public func set_reward_token_canister_id(
    state : Types.State,
    caller : Principal,
    canister_id : Principal,
  ) : Result.Result<(), Text> {
    if (caller != state.owner) {
      return #err("Unauthorized: Only owner can set reward token canister ID");
    };
    state.reward_token_canister_id := ?canister_id;
    #ok(());
  };

  public func set_audit_hub_canister_id(
    state : Types.State,
    caller : Principal,
    canister_id : Principal,
  ) : Result.Result<(), Text> {
    if (caller != state.owner) {
      return #err("Unauthorized: Only owner can set audit hub canister ID");
    };
    state.audit_hub_canister_id := ?canister_id;
    #ok(());
  };

  public func set_reward_amount_for_audit_type(
    state : Types.State,
    caller : Principal,
    audit_type : Text,
    amount : Nat,
  ) : Result.Result<(), Text> {
    if (caller != state.owner) {
      return #err("Unauthorized: Only owner can set reward amounts");
    };
    Map.set(state.reward_amounts, Map.thash, audit_type, amount);
    #ok(());
  };

  public func transfer_ownership(
    state : Types.State,
    caller : Principal,
    new_owner : Principal,
  ) : Result.Result<(), Text> {
    if (caller != state.owner) {
      return #err("Unauthorized: Only owner can transfer ownership");
    };
    state.owner := new_owner;
    #ok(());
  };
};
