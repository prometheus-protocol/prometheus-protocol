import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import Text "mo:base/Text";

import Types "Types";

module {

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

  public func get_env_requirements(
    registry_canister_id : ?Principal,
    bounty_sponsor_canister_id : ?Principal,
    stake_requirements : Map.Map<Text, (Types.TokenId, Types.Balance)>,
  ) : {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    // Build stake requirement configurations
    let stake_configs = Buffer.Buffer<EnvConfig>(Map.size(stake_requirements));
    for ((audit_type, (token_id, amount)) in Map.entries(stake_requirements)) {
      stake_configs.add({
        key = audit_type; // The audit_type (e.g., "tools_v1", "build_reproducibility_v1")
        setter = "set_stake_requirement";
        value_type = "stake_requirement"; // Indicates this needs 3 params: audit_type, token_id, amount
        required = true;
        current_value = ?(token_id # "," # Nat.toText(amount)); // Format: "token_id,amount"
      });
    };

    #v1({
      dependencies = [
        {
          key = "registry_canister_id";
          setter = "set_registry_canister_id";
          canister_name = "mcp_registry";
          required = true;
          current_value = registry_canister_id;
        },
        {
          key = "bounty_sponsor_canister_id";
          setter = "set_bounty_sponsor_canister_id";
          canister_name = "bounty_sponsor";
          required = true;
          current_value = bounty_sponsor_canister_id;
        },
      ];
      configuration = Buffer.toArray(stake_configs);
    });
  };
};
