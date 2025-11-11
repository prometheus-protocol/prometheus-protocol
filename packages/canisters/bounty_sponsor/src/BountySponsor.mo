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
import ICRC127Service "../../../../libs/icrc127/src/service";
import Types "./Types";

module {
  type BuildConfig = [(Text, { #Text : Text; #Nat : Nat; #Int : Int; #Blob : Blob; #Bool : Bool; #Array : [Any]; #Map : [Any] })];

  public func sponsor_bounties_for_wasm<system>(
    state : Types.State,
    _canister_id : Principal,
    wasm_id : Types.WasmId,
    wasm_hash : Blob,
    audit_types_to_sponsor : [Text],
    repo : Text,
    commit_hash : Text,
    build_config : BuildConfig,
    _required_verifiers : Nat,
  ) : async Result.Result<{ bounty_ids : [Types.BountyId]; total_sponsored : Nat }, Text> {
    // Validate we have audit types to sponsor
    if (audit_types_to_sponsor.size() == 0) {
      return #err("Must specify at least one audit type to sponsor");
    };

    // Validate configuration first
    let registry_id = switch (state.registry_canister_id) {
      case (?id) { id };
      case (null) { return #err("Registry canister ID not configured") };
    };

    let reward_token_id = switch (state.reward_token_canister_id) {
      case (?id) { id };
      case (null) { return #err("Reward token canister ID not configured") };
    };

    // Check if we've already sponsored bounties for this WASM + audit type combination
    let existing_bounties = Option.get(BTree.get(state.wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    var audit_types_to_create = audit_types_to_sponsor;

    if (existing_bounties.size() > 0) {
      // Check which audit types are already sponsored
      let already_sponsored_types = Buffer.Buffer<Text>(audit_types_to_sponsor.size());
      for (bounty_id in existing_bounties.vals()) {
        switch (Map.get(state.sponsored_bounties, Map.nhash, bounty_id)) {
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
      audit_types_to_create := Buffer.toArray(types_to_create);
    };

    Debug.print("Sponsoring " # Nat.toText(state.required_verifiers) # " bounties for each of " # Nat.toText(audit_types_to_create.size()) # " audit types for wasm_id " # wasm_id);

    let all_bounty_ids = Buffer.Buffer<Types.BountyId>(state.required_verifiers * audit_types_to_create.size());
    let timestamp = Time.now();

    let registry = actor (Principal.toText(registry_id)) : ICRC127Service.Service;

    // Calculate total amount needed ONLY for audit types we're actually creating
    var total_amount_needed : Nat = 0;

    for (audit_type in audit_types_to_create.vals()) {
      switch (Map.get(state.reward_amounts, Map.thash, audit_type)) {
        case (?amount) {
          let transfer_fee = 1000; // 0.001 USDC fee
          let approval_fee = 1000; // 0.001 USDC approval fee
          let with_fees = amount + transfer_fee + approval_fee;
          total_amount_needed += with_fees * state.required_verifiers;
        };
        case (null) {
          // Will skip this type later, but don't fail here
        };
      };
    };

    // Approve the registry to spend the required USDC from this canister
    if (total_amount_needed > 0) {
      let reward_token_ledger = actor (Principal.toText(reward_token_id)) : ICRC2.Service;

      // Convert Time.now() (Int) to Nat64 for expires_at
      let now_nanos : Int = Time.now();
      let expiry_nanos : Nat64 = Nat64.fromNat(Int.abs(now_nanos + 3600_000_000_000)); // 1 hour expiry

      let approve_args : ICRC2.ApproveArgs = {
        from_subaccount = null;
        spender = { owner = registry_id; subaccount = null };
        amount = total_amount_needed;
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
            Debug.print("Approved registry to spend " # Nat.toText(total_amount_needed) # " tokens");
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
    label audit_loop for (audit_type in audit_types_to_create.vals()) {
      Debug.print("Creating bounties for audit type: " # audit_type);

      // Get reward amount for this audit type
      let reward_amount = switch (Map.get(state.reward_amounts, Map.thash, audit_type)) {
        case (?amount) { amount };
        case (null) {
          Debug.print("Warning: No reward amount configured for audit type " # audit_type # ". Skipping.");
          continue audit_loop;
        };
      };

      let audit_type_bounty_ids = Buffer.Buffer<Types.BountyId>(state.required_verifiers);

      var i = 0;
      while (i < state.required_verifiers) {
        let bounty_request : ICRC127Service.CreateBountyRequest = {
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
                state.sponsored_bounties,
                Map.nhash,
                bounty_id,
                {
                  wasm_id;
                  audit_type;
                  timestamp;
                },
              );

              all_bounty_ids.add(bounty_id);
              audit_type_bounty_ids.add(bounty_id);
            };
            case (#Error(err)) {
              let errMsg = switch (err) {
                case (#InsufficientAllowance) { "InsufficientAllowance" };
                case (#Generic(msg)) { "Generic: " # msg };
              };
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

      // Add verification job to audit_hub for this specific audit type
      if (audit_type_bounty_ids.size() > 0) {
        switch (state.audit_hub_canister_id) {
          case (?hub_id) {
            let audit_hub = actor (Principal.toText(hub_id)) : actor {
              add_verification_job : (Text, Text, Text, BuildConfig, Nat, [Nat]) -> async Result.Result<(), Text>;
            };

            // Add audit_type to build_config for this job
            let build_config_with_audit_type = Buffer.fromArray<(Text, { #Text : Text; #Nat : Nat; #Int : Int; #Blob : Blob; #Bool : Bool; #Array : [Any]; #Map : [Any] })>(build_config);
            build_config_with_audit_type.add(("audit_type", #Text(audit_type)));
            let final_build_config = Buffer.toArray(build_config_with_audit_type);

            Debug.print("Adding " # audit_type # " verification job to audit hub for WASM " # wasm_id);
            try {
              switch (await audit_hub.add_verification_job(wasm_id, repo, commit_hash, final_build_config, state.required_verifiers, Buffer.toArray(audit_type_bounty_ids))) {
                case (#ok()) {
                  Debug.print("Successfully added " # audit_type # " verification job to audit hub");
                };
                case (#err(msg)) {
                  Debug.print("Error adding " # audit_type # " verification job to audit hub: " # msg);
                  // Don't fail the whole operation, bounties are already created
                };
              };
            } catch (e) {
              Debug.print("Exception adding " # audit_type # " verification job to audit hub: " # Error.message(e));
              // Don't fail the whole operation, bounties are already created
            };
          };
          case (null) {
            Debug.print("Warning: Audit hub canister ID not configured, skipping job registration for " # audit_type);
            // Don't fail - bounties are still valid
          };
        };
      };
    };

    // Store the mapping of wasm_id to bounty IDs
    // Append new bounty IDs to existing ones (if any)
    let existing_bounty_ids = Option.get(BTree.get(state.wasm_to_sponsored_bounties, Text.compare, wasm_id), []);
    let combined_bounty_ids = Buffer.fromArray<Types.BountyId>(existing_bounty_ids);
    for (new_bounty_id in all_bounty_ids.vals()) {
      combined_bounty_ids.add(new_bounty_id);
    };
    let combined_bounty_ids_array = Buffer.toArray(combined_bounty_ids);
    ignore BTree.insert(state.wasm_to_sponsored_bounties, Text.compare, wasm_id, combined_bounty_ids_array);

    let new_bounty_ids_array = Buffer.toArray(all_bounty_ids);
    Debug.print("Successfully sponsored " # Nat.toText(new_bounty_ids_array.size()) # " bounties for wasm_id " # wasm_id);

    #ok({
      bounty_ids = new_bounty_ids_array; // Return only new bounty IDs
      total_sponsored = new_bounty_ids_array.size(); // Count only new bounties
    });
  };
};
