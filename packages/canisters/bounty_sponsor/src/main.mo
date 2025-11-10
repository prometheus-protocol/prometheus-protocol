import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Debug "mo:base/Debug";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import BTree "mo:stableheapbtreemap/BTree";
import Map "mo:map/Map";
import Text "mo:base/Text";
import Error "mo:base/Error";
import ICRC2 "mo:icrc2-types";

shared ({ caller = deployer }) persistent actor class BountySponsor() = this {
  type BountyId = Nat;
  type WasmId = Text;

  var _owner = deployer;
  var _registry_canister_id : ?Principal = null;
  var _reward_token_canister_id : ?Principal = null;
  var _audit_hub_canister_id : ?Principal = null;

  // Reward amounts per audit type (in USDC with 6 decimals)
  var _reward_amounts = Map.new<Text, Nat>();

  // Track which bounties we've already sponsored (for idempotency)
  var sponsored_bounties = Map.new<BountyId, { wasm_id : WasmId; audit_type : Text; timestamp : Int }>();

  // Track bounties by WASM ID for easy lookup
  var wasm_to_sponsored_bounties = BTree.init<WasmId, [BountyId]>(null);

  transient let REQUIRED_VERIFIERS : Nat = 9;

  // --- Admin Functions ---

  public shared ({ caller }) func set_registry_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) {
      return #err("Unauthorized: Only owner can set registry canister ID");
    };
    _registry_canister_id := ?canister_id;
    #ok(());
  };

  public shared ({ caller }) func set_reward_token_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) {
      return #err("Unauthorized: Only owner can set reward token canister ID");
    };
    _reward_token_canister_id := ?canister_id;
    #ok(());
  };

  public shared ({ caller }) func set_audit_hub_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) {
      return #err("Unauthorized: Only owner can set audit hub canister ID");
    };
    _audit_hub_canister_id := ?canister_id;
    #ok(());
  };

  public shared ({ caller }) func set_reward_amount_for_audit_type(audit_type : Text, amount : Nat) : async Result.Result<(), Text> {
    if (caller != _owner) {
      return #err("Unauthorized: Only owner can set reward amounts");
    };
    Map.set(_reward_amounts, Map.thash, audit_type, amount);
    #ok(());
  };

  public shared query func get_reward_amount_for_audit_type(audit_type : Text) : async ?Nat {
    Map.get(_reward_amounts, Map.thash, audit_type);
  };

  public shared query func get_owner() : async Principal {
    _owner;
  };

  public shared ({ caller }) func transfer_ownership(new_owner : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) {
      return #err("Unauthorized: Only owner can transfer ownership");
    };
    _owner := new_owner;
    #ok(());
  };

  // --- Core Functions ---

  /**
   * Sponsor bounties for a WASM verification.
   * Creates 9 bounties for each specified audit type and registers the job with audit_hub.
   * Idempotent: safe to call multiple times for the same WASM + audit type combination.
   */
  public shared func sponsor_bounties_for_wasm(
    wasm_id : WasmId,
    wasm_hash : Blob,
    audit_types_to_sponsor : [Text],
    repo : Text,
    commit_hash : Text,
    build_config : [(Text, { #Text : Text; #Nat : Nat; #Int : Int; #Blob : Blob; #Bool : Bool; #Array : [Any]; #Map : [Any] })],
    required_verifiers : Nat,
  ) : async Result.Result<{ bounty_ids : [BountyId]; total_sponsored : Nat }, Text> {
    // Validate we have audit types to sponsor
    if (audit_types_to_sponsor.size() == 0) {
      return #err("Must specify at least one audit type to sponsor");
    };

    // Check if we've already sponsored bounties for this WASM + audit type combination
    let existing_bounties = Option.get(BTree.get(wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    if (existing_bounties.size() > 0) {
      // Check which audit types are already sponsored
      let already_sponsored_types = Buffer.Buffer<Text>(audit_types_to_sponsor.size());
      for (bounty_id in existing_bounties.vals()) {
        switch (Map.get(sponsored_bounties, Map.nhash, bounty_id)) {
          case (?info) {
            if (not Buffer.contains<Text>(already_sponsored_types, info.audit_type, Text.equal)) {
              already_sponsored_types.add(info.audit_type);
            };
          };
          case (null) {};
        };
      };

      // Filter out already-sponsored types
      let types_to_create = Buffer.Buffer<Text>(audit_types_to_sponsor.size());
      for (audit_type in audit_types_to_sponsor.vals()) {
        if (not Buffer.contains<Text>(already_sponsored_types, audit_type, Text.equal)) {
          types_to_create.add(audit_type);
        };
      };

      if (types_to_create.size() == 0) {
        Debug.print("All requested audit types already sponsored for wasm_id " # wasm_id # ". Returning existing bounty IDs.");
        return #ok({ bounty_ids = existing_bounties; total_sponsored = 0 });
      };

      Debug.print("Some audit types already sponsored for wasm_id " # wasm_id # ". Creating bounties for: " # debug_show (Buffer.toArray(types_to_create)));
    };

    // Validate configuration
    let registry_id = switch (_registry_canister_id) {
      case (?id) { id };
      case (null) { return #err("Registry canister ID not configured") };
    };

    let reward_token_id = switch (_reward_token_canister_id) {
      case (?id) { id };
      case (null) { return #err("Reward token canister ID not configured") };
    };

    Debug.print("Sponsoring " # Nat.toText(REQUIRED_VERIFIERS) # " bounties for each of " # Nat.toText(audit_types_to_sponsor.size()) # " audit types for wasm_id " # wasm_id);

    let all_bounty_ids = Buffer.Buffer<BountyId>(REQUIRED_VERIFIERS * audit_types_to_sponsor.size());
    let timestamp = Time.now();

    // Import the registry service (we'll need to define this interface)
    type ICRC16 = {
      #Text : Text;
      #Nat : Nat;
      #Int : Int;
      #Blob : Blob;
      #Bool : Bool;
      #Principal : Principal;
      #Array : [ICRC16];
      #Map : [(Text, ICRC16)];
    };

    type CreateBountyRequest = {
      challenge_parameters : ICRC16;
      timeout_date : Nat;
      start_date : ?Nat;
      bounty_id : ?Nat;
      validation_canister_id : Principal;
      bounty_metadata : [(Text, ICRC16)];
    };

    type CreateBountyResult = {
      #Ok : { bounty_id : Nat; trx_id : ?Nat };
      #Error : {
        #InsufficientAllowance;
        #Generic : Text;
      };
    };

    // Helper to convert error to text
    func errorToText(err : { #InsufficientAllowance; #Generic : Text }) : Text {
      switch (err) {
        case (#InsufficientAllowance) { "InsufficientAllowance" };
        case (#Generic(msg)) { "Generic: " # msg };
      };
    };

    let registry = actor (Principal.toText(registry_id)) : actor {
      icrc127_create_bounty : (CreateBountyRequest) -> async CreateBountyResult;
    };

    // Calculate total amount needed and approve the registry to spend it
    var total_amount_needed : Nat = 0;
    var total_bounties_count : Nat = 0;

    // Calculate total USDC needed across all audit types
    for (audit_type in audit_types_to_sponsor.vals()) {
      switch (Map.get(_reward_amounts, Map.thash, audit_type)) {
        case (?amount) {
          total_amount_needed += amount * REQUIRED_VERIFIERS;
          total_bounties_count += REQUIRED_VERIFIERS;
        };
        case (null) {
          // Will skip this type later, but don't fail here
        };
      };
    };

    // Approve the registry to spend the required USDC from this canister
    if (total_amount_needed > 0) {
      let reward_token_ledger = actor (Principal.toText(reward_token_id)) : ICRC2.Service;

      // Add fee buffer: each transfer costs 10_000 (0.01 USDC)
      // Also add generous buffer for approval fee and any registry overhead
      let transfer_fee : Nat = 10_000;
      let total_transfer_fees : Nat = transfer_fee * total_bounties_count;
      let buffer : Nat = 500_000; // 0.5 USDC buffer for fees and safety
      let approval_amount : Nat = total_amount_needed + total_transfer_fees + buffer;

      // Convert Time.now() (Int) to Nat64 for expires_at
      let now_nanos : Int = Time.now();
      let expiry_nanos : Nat64 = Nat64.fromNat(Int.abs(now_nanos + 3600_000_000_000)); // 1 hour expiry

      let approve_args : ICRC2.ApproveArgs = {
        from_subaccount = null;
        spender = { owner = registry_id; subaccount = null };
        amount = approval_amount;
        expected_allowance = null;
        expires_at = ?expiry_nanos;
        fee = null;
        memo = null;
        created_at_time = null;
      };

      try {
        let approve_result = await reward_token_ledger.icrc2_approve(approve_args);
        switch (approve_result) {
          case (#Ok(_)) {
            Debug.print("Approved registry to spend " # Nat.toText(approval_amount) # " tokens");
          };
          case (#Err(err)) {
            return #err("Failed to approve token spending: " # debug_show (err));
          };
        };
      } catch (e) {
        return #err("Exception approving tokens: " # Error.message(e));
      };
    };

    // Create bounties for each audit type
    label audit_loop for (audit_type in audit_types_to_sponsor.vals()) {
      Debug.print("Creating bounties for audit type: " # audit_type);

      // Get reward amount for this audit type
      let reward_amount = switch (Map.get(_reward_amounts, Map.thash, audit_type)) {
        case (?amount) { amount };
        case (null) {
          Debug.print("Warning: No reward amount configured for audit type " # audit_type # ". Skipping.");
          continue audit_loop;
        };
      };

      var i = 0;
      while (i < REQUIRED_VERIFIERS) {
        let bounty_request : CreateBountyRequest = {
          challenge_parameters = #Map([
            ("wasm_hash", #Blob(wasm_hash)),
            ("audit_type", #Text(audit_type)),
          ]);
          timeout_date = Int.abs(Time.now() + (7 * 24 * 60 * 60 * 1_000_000_000)); // 7 days
          start_date = null;
          bounty_id = null;
          validation_canister_id = registry_id;
          bounty_metadata = [
            ("icrc127:reward_canister", #Principal(reward_token_id)),
            ("icrc127:reward_amount", #Nat(reward_amount)),
          ];
        };

        try {
          let result = await registry.icrc127_create_bounty(bounty_request);
          switch (result) {
            case (#Ok(bounty_result)) {
              let bounty_id = bounty_result.bounty_id;
              Debug.print("Sponsored bounty #" # Nat.toText(bounty_id) # " for " # audit_type # " on wasm_id " # wasm_id);

              // Track the sponsored bounty
              Map.set(
                sponsored_bounties,
                Map.nhash,
                bounty_id,
                {
                  wasm_id;
                  audit_type;
                  timestamp;
                },
              );

              all_bounty_ids.add(bounty_id);
            };
            case (#Error(err)) {
              let errMsg = errorToText(err);
              Debug.print("Error creating bounty: " # errMsg);
              return #err("Failed to create bounty: " # errMsg);
            };
          };
        } catch (e) {
          Debug.print("Exception creating bounty: " # Error.message(e));
          return #err("Exception creating bounty: " # Error.message(e));
        };

        i += 1;
      };
    };

    // Store the mapping of wasm_id to bounty IDs
    // Append new bounty IDs to existing ones (if any)
    let existing_bounty_ids = Option.get(BTree.get(wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    let combined_bounty_ids = Buffer.fromArray<BountyId>(existing_bounty_ids);
    for (new_bounty_id in all_bounty_ids.vals()) {
      combined_bounty_ids.add(new_bounty_id);
    };
    let combined_bounty_ids_array = Buffer.toArray(combined_bounty_ids);
    ignore BTree.insert(wasm_to_sponsored_bounties, Text.compare, wasm_id, combined_bounty_ids_array);

    let new_bounty_ids_array = Buffer.toArray(all_bounty_ids);
    Debug.print("Successfully sponsored " # Nat.toText(new_bounty_ids_array.size()) # " bounties for wasm_id " # wasm_id);

    // Add verification job to audit_hub if bounties were created
    if (new_bounty_ids_array.size() > 0) {
      switch (_audit_hub_canister_id) {
        case (?hub_id) {
          let audit_hub = actor (Principal.toText(hub_id)) : actor {
            add_verification_job : (Text, Text, Text, [(Text, { #Text : Text; #Nat : Nat; #Int : Int; #Blob : Blob; #Bool : Bool; #Array : [Any]; #Map : [Any] })], Nat, [Nat]) -> async Result.Result<(), Text>;
          };

          Debug.print("Adding verification job to audit hub for WASM " # wasm_id);
          try {
            switch (await audit_hub.add_verification_job(wasm_id, repo, commit_hash, build_config, required_verifiers, new_bounty_ids_array)) {
              case (#ok()) {
                Debug.print("Successfully added verification job to audit hub");
              };
              case (#err(msg)) {
                Debug.print("Error adding verification job to audit hub: " # msg);
                // Don't fail the whole operation, bounties are already created
              };
            };
          } catch (e) {
            Debug.print("Exception adding verification job to audit hub: " # Error.message(e));
            // Don't fail the whole operation, bounties are already created
          };
        };
        case (null) {
          Debug.print("Warning: Audit hub canister ID not configured, skipping job registration");
          // Don't fail - bounties are still valid
        };
      };
    };

    #ok({
      bounty_ids = new_bounty_ids_array; // Return only new bounty IDs
      total_sponsored = new_bounty_ids_array.size(); // Count only new bounties
    });
  };

  // --- Query Functions ---

  public shared query func get_sponsored_bounties_for_wasm(wasm_id : WasmId) : async [BountyId] {
    Option.get(BTree.get(wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
  };

  public shared query func get_sponsored_audit_types_for_wasm(wasm_id : WasmId) : async [Text] {
    let bounty_ids = Option.get(BTree.get(wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    let audit_types = Buffer.Buffer<Text>(bounty_ids.size());

    for (bounty_id in bounty_ids.vals()) {
      switch (Map.get(sponsored_bounties, Map.nhash, bounty_id)) {
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

  public shared query func is_wasm_sponsored(wasm_id : WasmId) : async Bool {
    let bounties = Option.get(BTree.get(wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    bounties.size() > 0;
  };

  public shared query func get_bounty_info(bounty_id : BountyId) : async ?{
    wasm_id : WasmId;
    audit_type : Text;
    timestamp : Int;
  } {
    Map.get(sponsored_bounties, Map.nhash, bounty_id);
  };

  public shared query func get_total_sponsored_bounties() : async Nat {
    Map.size(sponsored_bounties);
  };

  public shared query func get_config() : async {
    registry_canister_id : ?Principal;
    reward_token_canister_id : ?Principal;
    reward_amounts : [(Text, Nat)];
    required_verifiers : Nat;
  } {
    {
      registry_canister_id = _registry_canister_id;
      reward_token_canister_id = _reward_token_canister_id;
      reward_amounts = Map.toArray(_reward_amounts);
      required_verifiers = REQUIRED_VERIFIERS;
    };
  };

  // --- Environment Configuration Standard ---

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

  /**
   * Returns the environment requirements for this canister.
   * This enables automated configuration discovery and injection.
   */
  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    #v1({
      dependencies = [
        {
          key = "_registry_canister_id";
          setter = "set_registry_canister_id";
          canister_name = "mcp_registry";
          required = true;
          current_value = _registry_canister_id;
        },
        {
          key = "_reward_token_canister_id";
          setter = "set_reward_token_canister_id";
          canister_name = "usdc_ledger";
          required = true;
          current_value = _reward_token_canister_id;
        },
        {
          key = "_audit_hub_canister_id";
          setter = "set_audit_hub_canister_id";
          canister_name = "audit_hub";
          required = true;
          current_value = _audit_hub_canister_id;
        },
      ];
      configuration = [];
    });
  };
};
