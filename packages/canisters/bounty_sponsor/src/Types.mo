import Principal "mo:base/Principal";
import Map "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";

module {
  public type BountyId = Nat;
  public type WasmId = Text;

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

  public type SponsoredBountyInfo = {
    wasm_id : WasmId;
    audit_type : Text;
    timestamp : Int;
  };

  public type State = {
    var owner : Principal;
    var registry_canister_id : ?Principal;
    var reward_token_canister_id : ?Principal;
    var audit_hub_canister_id : ?Principal;
    var reward_amounts : Map.Map<Text, Nat>;
    var sponsored_bounties : Map.Map<BountyId, SponsoredBountyInfo>;
    var wasm_to_sponsored_bounties : BTree.BTree<WasmId, [BountyId]>;
    var required_verifiers : Nat;
    var pending_operations : Map.Map<WasmId, Bool>; // Lock to prevent concurrent sponsoring of same WASM
  };
};
