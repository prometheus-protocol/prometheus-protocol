import Principal "mo:base/Principal";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";
import Map "mo:map/Map";
import Types "./Types";

module {
  public func get_sponsored_bounties_for_wasm(
    state : Types.State,
    wasm_id : Types.WasmId,
  ) : [Types.BountyId] {
    Option.get(BTree.get(state.wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
  };

  public func get_sponsored_audit_types_for_wasm(
    state : Types.State,
    wasm_id : Types.WasmId,
  ) : [Text] {
    let bounty_ids = Option.get(BTree.get(state.wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    let audit_types = Buffer.Buffer<Text>(bounty_ids.size());

    for (bounty_id in bounty_ids.vals()) {
      switch (Map.get(state.sponsored_bounties, Map.nhash, bounty_id)) {
        case (?info) {
          if (not Buffer.contains<Text>(audit_types, info.audit_type, Text.equal)) {
            audit_types.add(info.audit_type);
          };
        };
        case (null) {};
      };
    };

    Buffer.toArray(audit_types);
  };

  public func is_wasm_sponsored(
    state : Types.State,
    wasm_id : Types.WasmId,
  ) : Bool {
    let bounties = Option.get(BTree.get(state.wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    bounties.size() > 0;
  };

  public func get_bounty_info(
    state : Types.State,
    bounty_id : Types.BountyId,
  ) : ?Types.SponsoredBountyInfo {
    Map.get(state.sponsored_bounties, Map.nhash, bounty_id);
  };

  public func get_total_sponsored_bounties(state : Types.State) : Nat {
    Map.size(state.sponsored_bounties);
  };

  public func get_reward_amount_for_audit_type(
    state : Types.State,
    audit_type : Text,
  ) : ?Nat {
    Map.get(state.reward_amounts, Map.thash, audit_type);
  };

  public func get_owner(state : Types.State) : Principal {
    state.owner;
  };

  public func get_env_requirements(state : Types.State) : {
    #v1 : {
      dependencies : [Types.EnvDependency];
      configuration : [Types.EnvConfig];
    };
  } {
    #v1({
      dependencies = [
        {
          key = "_registry_canister_id";
          setter = "set_registry_canister_id";
          canister_name = "mcp_registry";
          required = true;
          current_value = state.registry_canister_id;
        },
        {
          key = "_reward_token_canister_id";
          setter = "set_reward_token_canister_id";
          canister_name = "usdc_ledger";
          required = true;
          current_value = state.reward_token_canister_id;
        },
        {
          key = "_audit_hub_canister_id";
          setter = "set_audit_hub_canister_id";
          canister_name = "audit_hub";
          required = true;
          current_value = state.audit_hub_canister_id;
        },
      ];
      configuration = [];
    });
  };
};
