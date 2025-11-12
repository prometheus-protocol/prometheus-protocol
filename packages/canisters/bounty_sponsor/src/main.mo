import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Map "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Blob "mo:base/Blob";
import ICRC126 "../../../../libs/icrc126/src/lib";
import Types "./Types";
import Admin "./Admin";
import BountySponsor "./BountySponsor";
import QueryMethods "./QueryMethods";

shared ({ caller = deployer }) persistent actor class BountySponsorActor() = this {
  // State variables
  var _owner = deployer;
  var _registry_canister_id : ?Principal = null;
  var _reward_token_canister_id : ?Principal = null;
  var _audit_hub_canister_id : ?Principal = null;
  var _reward_amounts = Map.new<Text, Nat>();
  var _sponsored_bounties = Map.new<Types.BountyId, Types.SponsoredBountyInfo>();
  var _wasm_to_sponsored_bounties = BTree.init<Types.WasmId, [Types.BountyId]>(null);
  var _required_verifiers : Nat = 9;
  var _pending_operations = Map.new<Types.WasmId, Bool>();

  // Create state object for modules
  let state : Types.State = {
    var owner = _owner;
    var registry_canister_id = _registry_canister_id;
    var reward_token_canister_id = _reward_token_canister_id;
    var audit_hub_canister_id = _audit_hub_canister_id;
    var reward_amounts = _reward_amounts;
    var sponsored_bounties = _sponsored_bounties;
    var wasm_to_sponsored_bounties = _wasm_to_sponsored_bounties;
    var required_verifiers = _required_verifiers;
    var pending_operations = _pending_operations;
  };

  // --- Admin Functions ---

  public shared ({ caller }) func set_registry_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    Admin.set_registry_canister_id(state, caller, canister_id);
  };

  public shared ({ caller }) func set_reward_token_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    Admin.set_reward_token_canister_id(state, caller, canister_id);
  };

  public shared ({ caller }) func set_audit_hub_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    Admin.set_audit_hub_canister_id(state, caller, canister_id);
  };

  public shared ({ caller }) func set_reward_amount_for_audit_type(audit_type : Text, amount : Nat) : async Result.Result<(), Text> {
    Admin.set_reward_amount_for_audit_type(state, caller, audit_type, amount);
  };

  public shared ({ caller }) func transfer_ownership(new_owner : Principal) : async Result.Result<(), Text> {
    Admin.transfer_ownership(state, caller, new_owner);
  };

  // --- Core Functions ---

  /**
   * Sponsor bounties for a WASM verification.
   * Creates 9 bounties for each specified audit type and registers the job with audit_hub.
   * Idempotent: safe to call multiple times for the same WASM + audit type combination.
   */
  public shared func sponsor_bounties_for_wasm(
    wasm_id : Types.WasmId,
    wasm_hash : Blob,
    audit_types_to_sponsor : [Text],
    repo : Text,
    commit_hash : Text,
    build_config : [(Text, ICRC126.ICRC16)],
    required_verifiers : Nat,
  ) : async Result.Result<{ bounty_ids : [Types.BountyId]; total_sponsored : Nat }, Text> {
    await BountySponsor.sponsor_bounties_for_wasm<system>(
      state,
      Principal.fromActor(this),
      wasm_id,
      wasm_hash,
      audit_types_to_sponsor,
      repo,
      commit_hash,
      build_config,
      required_verifiers,
    );
  };

  // --- Query Functions ---

  public shared query func get_reward_amount_for_audit_type(audit_type : Text) : async ?Nat {
    QueryMethods.get_reward_amount_for_audit_type(state, audit_type);
  };

  public shared query func get_owner() : async Principal {
    QueryMethods.get_owner(state);
  };

  public shared query func get_sponsored_bounties_for_wasm(wasm_id : Types.WasmId) : async [Types.BountyId] {
    QueryMethods.get_sponsored_bounties_for_wasm(state, wasm_id);
  };

  public shared query func get_sponsored_audit_types_for_wasm(wasm_id : Types.WasmId) : async [Text] {
    QueryMethods.get_sponsored_audit_types_for_wasm(state, wasm_id);
  };

  public shared query func is_wasm_sponsored(wasm_id : Types.WasmId) : async Bool {
    QueryMethods.is_wasm_sponsored(state, wasm_id);
  };

  public shared query func get_bounty_info(bounty_id : Types.BountyId) : async ?Types.SponsoredBountyInfo {
    QueryMethods.get_bounty_info(state, bounty_id);
  };

  public shared query func get_total_sponsored_bounties() : async Nat {
    QueryMethods.get_total_sponsored_bounties(state);
  };

  public shared query func get_config() : async {
    registry_canister_id : ?Principal;
    reward_token_canister_id : ?Principal;
    reward_amounts : [(Text, Nat)];
    required_verifiers : Nat;
  } {
    QueryMethods.get_config(state);
  };

  // --- Environment Configuration Standard ---

  /**
   * Returns the environment requirements for this canister.
   * This enables automated configuration discovery and injection.
   */
  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [Types.EnvDependency];
      configuration : [Types.EnvConfig];
    };
  } {
    QueryMethods.get_env_requirements(state);
  };
};
