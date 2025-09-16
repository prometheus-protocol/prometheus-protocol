// This file is an example canister that uses the library for this project. It is an example of how to expose the functionality of the class module to the outside world.
// It is not a complete canister and should not be used as such. It is only an example of how to use the library for this project.

import Buffer "mo:base/Buffer";
import D "mo:base/Debug";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Error "mo:base/Error";
import ClassPlus "mo:class-plus";
import TT "mo:timer-tool";
import ICRC10 "mo:icrc10-mo";
import Log "mo:stable-local-log";
import ICRC3 "mo:icrc3-mo";
import CertTree "mo:ic-certification/CertTree";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import Sha256 "mo:sha2/Sha256";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import BTree "mo:stableheapbtreemap/BTree";
import Text "mo:base/Text";
import Base16 "mo:base16/Base16";
import ICRC2 "mo:icrc2-types";
import Map "mo:map/Map";
import Order "mo:base/Order";

import AppStore "AppStore";
import AuditHub "AuditHub";
import Bounty "Bounty";
import Orchestrator "Orchestrator";

import ICRC118WasmRegistry "../../../../libs/icrc118/src";
import Service "../../../../libs/icrc118/src/service";

// --- ICRC-126 INTEGRATION ---
import ICRC126 "../../../../libs/icrc126/src/lib";
import ICRC126Service "../../../../libs/icrc126/src/service";

// --- ICRC-127 INTEGRATION ---
import ICRC127 "../../../../libs/icrc127/src/lib";
import ICRC127Service "../../../../libs/icrc127/src/service";

// ICRC-118 Registry Canister exposing the full public API contract
shared (deployer) actor class ICRC118WasmRegistryCanister<system>(
  args : ?{
    icrc118wasmregistryArgs : ?ICRC118WasmRegistry.InitArgs;
    ttArgs : ?TT.InitArgList;
  }
) = this {
  let thisPrincipal = Principal.fromActor(this);
  stable var _owner = deployer.caller;
  stable var _credentials_canister_id : ?Principal = null;
  stable var _orchestrator_canister_id : ?Principal = null;

  // --- NEW: A reverse-lookup index to find a namespace from a wasm_id ---
  // Key: wasm_id (hex string)
  // Value: namespace (Text)
  stable var wasm_to_namespace_map = BTree.init<Text, Text>(null);

  let initManager = ClassPlus.ClassPlusInitializationManager(_owner, thisPrincipal, true);
  let icrc118wasmregistryInitArgs = do ? { args!.icrc118wasmregistryArgs! };
  let ttInitArgs : ?TT.InitArgList = do ? { args!.ttArgs! };

  stable var icrc10 = ICRC10.initCollection();

  private func reportTTExecution(execInfo : TT.ExecutionReport) : Bool {
    D.print("CANISTER: TimerTool Execution: " # debug_show (execInfo));
    false;
  };

  private func reportTTError(errInfo : TT.ErrorReport) : ?Nat {
    D.print("CANISTER: TimerTool Error: " # debug_show (errInfo));
    null;
  };

  stable var tt_migration_state : TT.State = TT.Migration.migration.initialState;

  let tt = TT.Init<system>({
    manager = initManager;
    initialState = tt_migration_state;
    args = ttInitArgs;
    pullEnvironment = ?(
      func() : TT.Environment {
        {
          advanced = null;
          reportExecution = ?reportTTExecution;
          reportError = ?reportTTError;
          syncUnsafe = null;
          reportBatch = null;
        };
      }
    );
    onInitialize = ?(
      func(newClass : TT.TimerTool) : async* () {
        D.print("Initializing TimerTool");
        newClass.initialize<system>();
      }
    );
    onStorageChange = func(state : TT.State) { tt_migration_state := state };
  });

  stable var localLog_migration_state : Log.State = Log.initialState();
  let localLog = Log.Init<system>({
    args = ?{
      min_level = ?#Debug;
      bufferSize = ?5000;
    };
    manager = initManager;
    initialState = Log.initialState();
    pullEnvironment = ?(
      func() : Log.Environment {
        {
          tt = tt();
          advanced = null; // Add any advanced options if needed
          onEvict = null;
        };
      }
    );
    onInitialize = null;
    onStorageChange = func(state : Log.State) {
      localLog_migration_state := state;
    };
  });

  let d = localLog().log_debug;

  stable var icrc118wasmregistry_migration_state : ICRC118WasmRegistry.State = ICRC118WasmRegistry.initialState();

  let icrc118wasmregistry = ICRC118WasmRegistry.Init<system>({
    manager = initManager;
    initialState = icrc118wasmregistry_migration_state;
    args = icrc118wasmregistryInitArgs;
    pullEnvironment = ?(
      func() : ICRC118WasmRegistry.Environment {
        {
          tt = tt();
          advanced = null; /* Add any advanced options if needed */
          log = localLog();
          add_record = null;
          validateCanisterTypeCreation = ?(
            func(caller : Principal, req : Service.CreateCanisterType) : async* Result.Result<(), Text> {
              // For our public registry, we allow any principal to create a new type.
              // More complex logic could be added here in the future, e.g., checking for a registration fee.
              return #ok(());
            }
          );
        };
      }
    );
    onInitialize = ?(
      func(newClass : ICRC118WasmRegistry.ICRC118WasmRegistry) : async* () {
        D.print("Initializing ICRC118WasmRegistry Class");
      }
    );
    onStorageChange = func(state : ICRC118WasmRegistry.State) {
      icrc118wasmregistry_migration_state := state;
    };
  });

  // --- ICRC3 Integration ---
  stable let cert_store : CertTree.Store = CertTree.newStore();
  let ct = CertTree.Ops(cert_store);

  private func get_certificate_store() : CertTree.Store {
    cert_store;
  };

  private func updated_certification(cert : Blob, lastIndex : Nat) : Bool {
    ct.setCertifiedData();
    true;
  };

  private func get_icrc3_environment() : ICRC3.Environment {
    {
      updated_certification = ?updated_certification;
      get_certificate_store = ?get_certificate_store;
    };
  };

  stable var icrc3_migration_state = ICRC3.initialState();
  let icrc3 = ICRC3.Init<system>({
    manager = initManager;
    initialState = icrc3_migration_state;
    args = null; // Optionally add ICRC3.InitArgs if needed
    pullEnvironment = ?get_icrc3_environment;
    onInitialize = ?(
      func(newClass : ICRC3.ICRC3) : async* () {
        if (newClass.stats().supportedBlocks.size() == 0) {
          newClass.update_supported_blocks([
            { block_type = "uupdate_user"; url = "https://git.com/user" },
            { block_type = "uupdate_role"; url = "https://git.com/user" },
            { block_type = "uupdate_use_role"; url = "https://git.com/user" },
          ]);
        };
      }
    );
    onStorageChange = func(state : ICRC3.State) {
      icrc3_migration_state := state;
    };
  });

  // --- ICRC-126 Integration ---

  // This private helper function converts the rich ICRC126 value type
  // into the simpler Value type expected by the ICRC3 logger.
  private func convertIcrc126ValueToIcrc3Value(val : ICRC126.ICRC16) : ICRC3.Value {
    switch (val) {
      case (#Nat(n)) { return #Nat(n) };
      case (#Int(i)) { return #Int(i) };
      case (#Text(t)) { return #Text(t) };
      case (#Blob(b)) { return #Blob(b) };
      case (#Array(arr)) {
        // Recursively convert each element in the array.
        let converted_arr = Array.map<ICRC126.ICRC16, ICRC3.Value>(arr, convertIcrc126ValueToIcrc3Value);
        return #Array(converted_arr);
      };
      case (#Map(map)) {
        // Recursively convert each value in the map.
        let converted_map = Array.map<(Text, ICRC126.ICRC16), (Text, ICRC3.Value)>(map, func((k, v)) { (k, convertIcrc126ValueToIcrc3Value(v)) });
        return #Map(converted_map);
      };
      // --- Fallback cases for types not supported by ICRC3.Value ---
      // We convert them to text to preserve the data in a readable format.
      case (#Bool(b)) { return #Text(debug_show (b)) };
      case (#Principal(p)) { return #Text(Principal.toText(p)) };
      case (_) {
        // For any other complex type, just represent it as text.
        return #Text("Unsupported ICRC-3 Value Type");
      };
    };
  };

  // --- a post-deployment, one-time setter function ---
  public shared ({ caller }) func set_auditor_credentials_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _credentials_canister_id := ?canister_id;
    return #ok(());
  };

  public shared ({ caller }) func set_orchestrator_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _orchestrator_canister_id := ?canister_id;
    return #ok(());
  };

  stable var icrc126_migration_state : ICRC126.State = ICRC126.initialState();
  let icrc126 = ICRC126.Init<system>({
    manager = initManager;
    initialState = icrc126_migration_state;
    args = null; // Optionally add ICRC126.InitArgs if needed
    pullEnvironment = ?(
      func() : ICRC126.Environment {
        {
          tt = tt();
          advanced = null;
          log = localLog(); // Provide the logger
          add_record = ?(
            func<system>(data : ICRC126.ICRC16, meta : ?ICRC126.ICRC16) : Nat {
              let converted_data = convertIcrc126ValueToIcrc3Value(data);
              let converted_meta = Option.map(meta, convertIcrc126ValueToIcrc3Value);
              D.print("ICRC126: Adding record: " # debug_show ((converted_data, converted_meta)));
              icrc3().add_record<system>(converted_data, converted_meta);
            }
          );
          can_auditor_audit = func(auditor : Principal, audit_type : Text) : async Bool {
            switch (_credentials_canister_id) {
              case (null) {
                // If the credential canister ID is not set, no one can be an auditor.
                return false;
              };
              case (?id) {
                // The ID is set, so we can proceed with the check.
                let auditHub : AuditHub.Service = actor (Principal.toText(id));

                // Call the new method to get the auditor's balance for the specific token type.
                let balance : AuditHub.Balance = await auditHub.get_available_balance(auditor, audit_type);

                // An auditor is qualified if their available balance of the required token is greater than zero.
                return balance > 0;
              };
            };
          };
        };
      }
    );
    onStorageChange = func(state) { icrc126_migration_state := state };
    onInitialize = ?(
      func(icrc126 : ICRC126.ICRC126Verification) : async* () {
        D.print("ICRC126: Initialized");
      }
    );
  });

  // The new stable variable to store the final word on each wasm_id.
  stable var finalization_log = BTree.init<Text, FinalizationRecord>(null);

  private func _is_wasm_verified(wasm_id : Text) : Bool {
    let final_status = BTree.get(finalization_log, Text.compare, wasm_id);

    switch (final_status) {
      case (null) {
        // Not yet finalized.
        return false;
      };
      case (?record) {
        switch (record.outcome) {
          case (#Verified) {
            // Explicitly verified!
            return true;
          };
          case (#Rejected) {
            // Explicitly rejected.
            return false;
          };
        };
      };
    };
  };

  public shared query func is_wasm_verified(wasm_id : Text) : async Bool {
    _is_wasm_verified(wasm_id);
  };

  /**
   * @notice Fetches the single most recent attestation for each audit type for a given WASM.
   * @dev This function has been refactored to IGNORE the finalization log. In a reputation-
   *      based system, the stake provided by a trusted auditor is the guarantee of quality,
   *      making a secondary finalization step unnecessary. This function now returns the
   *      latest submitted attestation for each type, making the system more responsive.
   * @param wasm_id The hex string identifier of the WASM.
   * @return An array containing the most recent `AttestationRecord` for each audit type.
   */
  private func _get_attestations_for_wasm(wasm_id : Text) : [ICRC126.AttestationRecord] {

    // --- Step 1: Get all audit records for the WASM ID ---
    let state = icrc126().state;
    let all_audit_records = switch (Map.get(state.audits, Map.thash, wasm_id)) {
      case (null) {
        // No audits have ever been filed for this WASM. Return an empty array.
        Debug.print("[DEBUG] No audits found for wasm_id: \"" # wasm_id # "\"");
        return [];
      };
      case (?records) { records };
    };

    // --- Step 2: Find the single most recent attestation for each audit type ---
    // We use a mutable map to track the latest attestation we've seen for each `audit_type`.
    // This ensures that even if multiple attestations of the same type exist, only the
    // newest one is returned.
    var latest_by_type = Map.new<Text, ICRC126.AttestationRecord>();

    for (record in all_audit_records.vals()) {
      switch (record) {
        case (#Attestation(att_record)) {
          // This is an attestation record, process it.
          let existing = Map.get(latest_by_type, Map.thash, att_record.audit_type);
          switch (existing) {
            case (null) {
              // This is the first time we've seen this audit_type, so it's the latest by default.
              Map.set(latest_by_type, Map.thash, att_record.audit_type, att_record);
            };
            case (?prev_att) {
              // We've seen this type before. If the current one is newer, it replaces the old one.
              if (att_record.timestamp > prev_att.timestamp) {
                Map.set(latest_by_type, Map.thash, att_record.audit_type, att_record);
              };
            };
          };
        };
        case (#Divergence(_)) {
          // Ignore divergence records for this query.
        };
      };
    };

    // The values of the map now represent the definitive, most up-to-date set of attestations.
    return Iter.toArray(Map.vals(latest_by_type));
  };

  private func _get_bounties_for_wasm(wasm_id : Text) : [ICRC127.Bounty] {
    let state = icrc127().state;
    var matching_bounties : [ICRC127.Bounty] = [];

    // We must iterate through all bounties because the wasm_hash is not the key.
    for (bounty in BTree.toValueArray(state.bounties).vals()) {
      // The challenge parameters are an ICRC-16 value. We expect it to be a Map.
      switch (bounty.challenge_parameters) {
        case (#Map(params_map)) {
          // Iterate through the key-value pairs in the parameters map.
          label findWasmHashKey for ((key, value) in params_map.vals()) {
            // We are looking for the specific key "wasm_hash".
            if (key == "wasm_hash") {
              // We found the key. Now we check if the value is a Blob.
              switch (value) {
                case (#Blob(bounty_wasm_hash)) {
                  // It's a blob. Encode it to Base16 for comparison.
                  let bounty_wasm_id = Base16.encode(bounty_wasm_hash);
                  if (bounty_wasm_id == wasm_id) {
                    // It's a match! Add this bounty to our results.
                    matching_bounties := Array.append(matching_bounties, [bounty]);
                  };
                };
                case (_) {
                  // The value for "wasm_hash" was not a Blob, so we ignore it.
                };
              };
              // We can break the inner loop since we've found and checked the wasm_hash key.
              break findWasmHashKey;
            };
          };
        };
        case (_) {
          // The challenge_parameters were not a Map, so we ignore this bounty.
        };
      };
    };

    return matching_bounties;
  };

  public shared query func get_bounties_for_wasm(wasm_id : Text) : async [ICRC127.Bounty] {
    return _get_bounties_for_wasm(wasm_id);
  };

  /**
   * Checks if a valid audit submission (either an attestation or a divergence)
   * exists for a given WASM and the bounty's required audit type.
   *
   * @param wasm_id The hex ID of the WASM.
   * @param required_audit_type The audit type specified in the bounty's challenge parameters.
   * @returns True if a valid submission is found, false otherwise.
   */
  private func has_valid_audit_submission(wasm_id : Text, required_audit_type : Text) : Bool {
    let all_audits = icrc126().state.audits;

    switch (Map.get(all_audits, Map.thash, wasm_id)) {
      case (null) {
        // No audit records exist for this WASM at all.
        return false;
      };
      case (?records) {
        // We have records, so let's iterate through them to find a match.
        for (record in records.vals()) {
          switch (record) {
            case (#Attestation(att)) {
              // For an attestation, the audit_type must match the one required by the bounty.
              if (att.audit_type == required_audit_type) {
                return true; // Found a matching attestation.
              };
            };
            case (#Divergence(div)) {
              // A divergence report is ONLY a valid submission for a 'build_reproducibility_v1' bounty.
              // If the bounty was for a security audit, a divergence report is not a valid completion.
              if (required_audit_type == "build_reproducibility_v1") {
                return true; // Found a valid divergence report for a build bounty.
              };
            };
          };
        };
        // If we loop through all records and find no match, then no valid submission exists.
        return false;
      };
    };
  };

  // --- ICRC-127 Library Setup (The Core of this Canister) ---
  stable var icrc127_migration_state : ICRC127.State = ICRC127.initialState();
  let icrc127 = ICRC127.Init<system>({
    manager = initManager;
    initialState = icrc127_migration_state;
    args = null;
    pullEnvironment = ?(
      func() : ICRC127.Environment {
        {
          tt = tt();
          advanced = null;
          log = localLog();
          add_record = ?(
            func<system>(data : ICRC127.ICRC16, meta : ?ICRC127.ICRC16) : Nat {
              let converted_data = convertIcrc126ValueToIcrc3Value(data);
              let converted_meta = Option.map(meta, convertIcrc126ValueToIcrc3Value);
              icrc3().add_record<system>(converted_data, converted_meta);
            }
          );

          // --- Provide real token transfer hooks ---
          icrc1_fee = func(canister : Principal) : async Nat {
            let ledger : ICRC2.Service = actor (Principal.toText(canister));
            await ledger.icrc1_fee();
          };
          icrc1_transfer = func(canister : Principal, args : ICRC2.TransferArgs) : async ICRC2.TransferResult {
            let ledger : ICRC2.Service = actor (Principal.toText(canister));
            await ledger.icrc1_transfer(args);
          };
          icrc2_transfer_from = func(canister : Principal, args : ICRC2.TransferFromArgs) : async ICRC2.TransferFromResult {
            let ledger : ICRC2.Service = actor (Principal.toText(canister));
            await ledger.icrc2_transfer_from(args);
          };
          // --- Provide the core validation logic ---
          validate_submission = func(req : ICRC127Service.RunBountyRequest) : async ICRC127Service.RunBountyResult {
            // The challenge is now a map containing the wasm_hash and the required audit_type.
            let params_map = switch (req.challenge_parameters) {
              case (#Map(m)) { m };
              case (_) {
                return {
                  result = #Invalid;
                  metadata = #Map([("error", #Text("Challenge parameters must be a Map."))]);
                  trx_id = null;
                };
              };
            };

            // Safely extract wasm_hash and audit_type from the map
            var wasm_hash : ?Blob = null;
            var audit_type : ?Text = null;

            for ((key, val) in params_map.vals()) {
              if (key == "wasm_hash") {
                switch (val) {
                  case (#Blob(b)) { wasm_hash := ?b };
                  case (_) {};
                };
              } else if (key == "audit_type") {
                switch (val) {
                  case (#Text(t)) { audit_type := ?t };
                  case (_) {};
                };
              };
            };

            switch (wasm_hash, audit_type) {
              case (?wasm_hash_exists, ?audit_type_exists) {
                // Both required parameters are present.
                let wasm_id = Base16.encode(wasm_hash_exists);
                if (has_valid_audit_submission(wasm_id, audit_type_exists)) {
                  return {
                    result = #Valid;
                    metadata = #Map([("status", #Text("Attestation found for audit type: " # audit_type_exists))]);
                    trx_id = null;
                  };
                } else {
                  return {
                    result = #Invalid;
                    metadata = #Map([("status", #Text("No attestation found for audit type: " # audit_type_exists))]);
                    trx_id = null;
                  };
                };

              };
              case (_, _) {
                return {
                  result = #Invalid;
                  metadata = #Map([("error", #Text("Challenge map must contain wasm_hash (Blob) and audit_type (Text)."))]);
                  trx_id = null;
                };
              };
            };
          };
        };
      }
    );
    onStorageChange = func(state) { icrc127_migration_state := state };
    onInitialize = ?(
      func(icrc127 : ICRC127.ICRC127Bounty) : async* () {
        D.print("ICRC127: Initialized");
      }
    );
  });

  //------------------- API IMPLEMENTATION -------------------//

  // --- ICRC10 Endpoints ---

  public shared query func icrc10_supported_standards() : async [Service.SupportedStandard] {
    let standards = [
      { name = "ICRC-3"; url = "..." },
      { name = "ICRC-10"; url = "..." },
      { name = "ICRC-118"; url = "..." },
      { name = "ICRC-126"; url = "..." },
    ];

    return standards;
  };

  // --- ICRC118 Endpoints ---
  public shared (msg) func icrc118_create_canister_type(reqs : [Service.CreateCanisterType]) : async [Service.CreateCanisterTypeResult] {
    await* icrc118wasmregistry().icrc118_create_canister_type(msg.caller, reqs);
  };

  public shared (msg) func icrc118_manage_controller(reqs : [Service.ManageControllerRequest]) : async [Service.ManageControllerResult] {
    await* icrc118wasmregistry().icrc118_manage_controller(msg.caller, reqs);
  };

  public shared query func icrc118_get_wasms(request : { filter : ?[Service.GetWasmsFilter]; prev : ?Service.WasmVersionPointer; take : ?Nat }) : async [Service.Wasm] {
    icrc118wasmregistry().icrc118_get_wasms(request);
  };

  public shared (msg) func icrc118_update_wasm(req : Service.UpdateWasmRequest) : async Service.UpdateWasmResult {
    // First, delegate the core logic to the underlying library.
    let result = await* icrc118wasmregistry().icrc118_update_wasm(msg.caller, req);

    // --- NEW: If the update was successful, populate our reverse index ---
    switch (result) {
      case (#Ok(_)) {
        // The library has successfully associated the wasm with the namespace.
        // Now, we store this relationship in our fast lookup map.
        let wasm_id = Base16.encode(req.expected_hash);
        ignore BTree.insert(wasm_to_namespace_map, Text.compare, wasm_id, req.canister_type_namespace);
      };
      case (#Err(_)) {
        // The update failed, so we do nothing.
      };
    };

    return result;
  };

  public shared (msg) func icrc118_upload_wasm_chunk(req : Service.UploadRequest) : async Service.UploadResponse {
    await* icrc118wasmregistry().icrc118_upload_wasm_chunk(msg.caller, req);
  };

  public shared (msg) func icrc118_deprecate(req : Service.DeprecateRequest) : async Service.DeprecateResult {
    await* icrc118wasmregistry().icrc118_deprecate(msg.caller, req);
  };

  public shared query func icrc118_get_canister_types(req : Service.GetCanisterTypesRequest) : async [Service.CanisterType] {
    icrc118wasmregistry().icrc118_get_canister_types(req);
  };

  public shared query func icrc118_get_upgrade_path(req : Service.GetUpgradePathRequest) : async [Service.CanisterVersion] {
    icrc118wasmregistry().icrc118_get_upgrade_path(req);
  };

  public shared query func icrc118_get_wasm_chunk(req : Service.GetWasmChunkRequest) : async Service.GetWasmChunkResponse {
    icrc118wasmregistry().icrc118_get_wasm_chunk(req);
  };

  // --- ICRC126 Endpoints ---
  public shared (msg) func icrc126_verification_request(req : ICRC126Service.VerificationRequest) : async Nat {
    await icrc126().icrc126_verification_request(msg.caller, req);
  };

  public shared (msg) func icrc126_file_attestation(req : ICRC126Service.AttestationRequest) : async ICRC126Service.AttestationResult {
    let bounty_id = switch (AuditHub.get_bounty_id_from_metadata(req.metadata)) {
      case (null) {
        return #Error(#Generic("Attestation metadata must include a 'bounty_id'."));
      };
      case (?id) { id };
    };

    switch (_credentials_canister_id) {
      case (null) { Debug.trap("Audit Hub is not configured.") };
      case (?id) {
        let auditHub : AuditHub.Service = actor (Principal.toText(id));
        let is_authorized = await auditHub.is_bounty_ready_for_collection(bounty_id, msg.caller);

        if (not is_authorized) {
          return #Error(#Unauthorized);
        };
      };
    };

    // --- NEW LOGIC: Check if this attestation finalizes a verification ---
    // 2. Extract the audit_type from the metadata.
    let audit_type = AppStore.getICRC16TextOptional(req.metadata, "126:audit_type");

    if (audit_type == ?"build_reproducibility_v1") {
      // 3. This is a build verification! Finalize the request as "Verified".
      let finalization_meta : ICRC126.ICRC16Map = [
        ("auditor", #Principal(msg.caller)),
        ("bounty_id", #Nat(bounty_id)),
      ];
      ignore await _finalize_verification(req.wasm_id, #Verified, finalization_meta);
    };
    // --- END NEW LOGIC ---

    await icrc126().icrc126_file_attestation(msg.caller, req);
  };

  public shared (msg) func icrc126_file_divergence(req : ICRC126Service.DivergenceReportRequest) : async ICRC126Service.DivergenceResult {
    // --- NEW: Add authorization logic, mirroring the attestation function ---
    let metadata = switch (req.metadata) { case null []; case (?m) m };
    let bounty_id = switch (AuditHub.get_bounty_id_from_metadata(metadata)) {
      case (null) {
        return #Error(#Generic("Divergence metadata must include a 'bounty_id'."));
      };
      case (?id) { id };
    };

    switch (_credentials_canister_id) {
      case (null) { Debug.trap("Audit Hub is not configured.") };
      case (?id) {
        let auditHub : AuditHub.Service = actor (Principal.toText(id));
        let is_authorized = await auditHub.is_bounty_ready_for_collection(bounty_id, msg.caller);

        if (not is_authorized) {
          // Note: ICRC126 DivergenceResult doesn't have an #Unauthorized variant, so we use #Generic.
          return #Error(#Generic("Unauthorized: Caller is not the authorized claimant for this bounty."));
        };
      };
    };
    // --- END NEW AUTHORIZATION ---

    // 1. Let the library file the divergence report.
    let result = await icrc126().icrc126_file_divergence(msg.caller, req);

    // --- NEW LOGIC: Finalize the request as "Rejected" ---
    // 2. We assume any divergence report is for build reproducibility.
    let finalization_meta : ICRC126.ICRC16Map = [
      ("auditor", #Principal(msg.caller)),
      ("bounty_id", #Nat(bounty_id)),
      ("reason", #Text(req.divergence_report)),
    ];
    let _ = await _finalize_verification(req.wasm_id, #Rejected, finalization_meta);
    // --- END NEW LOGIC ---

    return result;
  };

  // --- ICRC127 Endpoints ---
  public shared (msg) func icrc127_create_bounty(req : ICRC127Service.CreateBountyRequest) : async ICRC127Service.CreateBountyResult {
    await icrc127().icrc127_create_bounty<system>(msg.caller, req);
  };
  public shared (msg) func icrc127_submit_bounty(req : ICRC127Service.BountySubmissionRequest) : async ICRC127Service.BountySubmissionResult {
    // ==========================================================================
    // == NEW SECURITY CHECK: Verify the caller is the authorized claimant.
    // ==========================================================================

    switch (_credentials_canister_id) {
      case (null) { Debug.trap("Audit Hub is not configured.") };
      case (?id) {
        let auditHub : AuditHub.Service = actor (Principal.toText(id));
        let is_authorized = await auditHub.is_bounty_ready_for_collection(req.bounty_id, msg.caller);

        if (not is_authorized) {
          return #Error(#Generic("Caller is not the authorized claimant for this bounty or the lock has expired."));
        };
      };
    };

    // If the identity check passes, we forward the call.
    // The underlying ICRC-127 canister will then invoke our `validate_submission` hook,
    // which is responsible for checking if the attestation has been filed.
    await icrc127().icrc127_submit_bounty(msg.caller, req);
  };
  public query func icrc127_get_bounty(bounty_id : Nat) : async ?ICRC127.Bounty {
    icrc127().icrc127_get_bounty(bounty_id);
  };
  public query func icrc127_list_bounties({
    filter : ?[ICRC127Service.ListBountiesFilter];
    prev : ?Nat;
    take : ?Nat;
  }) : async [ICRC127.Bounty] {
    icrc127().icrc127_list_bounties(filter, prev, take);
  };
  public query func icrc127_metadata() : async ICRC127.ICRC16Map {
    icrc127().icrc127_metadata();
  };

  // --- ICRC3 Endpoints ---
  public query func icrc3_get_blocks(args : ICRC3.GetBlocksArgs) : async ICRC3.GetBlocksResult {
    icrc3().get_blocks(args);
  };
  public query func icrc3_get_archives(args : ICRC3.GetArchivesArgs) : async ICRC3.GetArchivesResult {
    icrc3().get_archives(args);
  };
  public query func icrc3_supported_block_types() : async [ICRC3.BlockType] {
    icrc3().supported_block_types();
  };
  public query func icrc3_get_tip_certificate() : async ?ICRC3.DataCertificate {
    icrc3().get_tip_certificate();
  };
  public query func get_tip() : async ICRC3.Tip {
    icrc3().get_tip();
  };

  // --- MCP Orchestrator InterCanister Endpoints ---
  // Used by the MCP Orchestrator to validate user requests.
  private func _is_owner(caller : Principal) : Bool {
    Principal.equal(_owner, caller);
  };

  // HOOK 1: Check controller. Now returns a Result instead of trapping.
  public shared (msg) func is_controller_of_type(namespace : Text, user : Principal) : async Result.Result<Bool, Text> {
    // Get the current state from the ICRC-118 module.
    let state = icrc118wasmregistry().state;

    // Find the canister type by its namespace using the library's internal map.
    switch (BTree.get(state.canister_types, Text.compare, namespace)) {
      case (null) {
        // It's not an error if the type doesn't exist, just return false.
        return #ok(false);
      };
      case (?canister_type) {
        // Check if the user's principal exists in the controllers array.
        let isController = Option.isSome(
          Array.find(
            canister_type.controllers,
            func(controller : Principal) : Bool {
              Principal.equal(controller, user);
            },
          )
        );
        return #ok(isController);
      };
    };
  };

  // The outcome of a DAO-led verification process.
  type VerificationOutcome = {
    #Verified;
    #Rejected;
  };

  // A record of the final decision.
  type FinalizationRecord = {
    outcome : VerificationOutcome;
    timestamp : Time.Time;
    metadata : ICRC126.ICRC16Map;
  };

  private func _finalize_verification(
    wasm_id : Text,
    outcome : VerificationOutcome,
    metadata : ICRC126.ICRC16Map,
  ) : async Nat {
    // 1. Authorization check is no longer needed as this is an internal function.

    // 2. Create and store the finalization record.
    let record : FinalizationRecord = {
      outcome = outcome;
      timestamp = Time.now();
      metadata = metadata;
    };
    ignore BTree.insert(finalization_log, Text.compare, wasm_id, record);

    // 3. Log the official ICRC-3 block.
    let btype = switch (outcome) {
      case (#Verified) "126verified";
      case (#Rejected) "126rejected";
    };
    let tx : ICRC126.ICRC16Map = [
      ("wasm_id", #Text(wasm_id)),
      ("metadata", #Map(metadata)),
    ];
    let trx_id = icrc3().add_record<system>(
      convertIcrc126ValueToIcrc3Value(#Map(tx)),
      ?convertIcrc126ValueToIcrc3Value(#Map([("btype", #Text(btype))])),
    );

    // --- 4. REFACTORED: Automated Deployment Trigger ---
    if (outcome == #Verified) {
      switch (_orchestrator_canister_id) {
        case (?orc_id) {
          // --- a. Find the namespace using our new reverse index ---
          let namespace_opt = BTree.get(wasm_to_namespace_map, Text.compare, wasm_id);

          switch (namespace_opt) {
            case (?namespace) {
              // We found the namespace! Now we can proceed.
              Debug.print("WASM " # wasm_id # " verified for namespace " # namespace # ". Triggering auto-deployment...");

              // --- b. Find the developer's principal from the original request ---
              let request_record_opt = _get_verification_request(wasm_id);
              switch (request_record_opt) {
                case (?request_record) {

                  // --- c. Decode wasm_id and construct the request ---
                  let wasm_hash : Blob = switch (Base16.decode(wasm_id)) {
                    case (?b) { b };
                    case (null) { return trx_id; /* Should not happen */ };
                  };

                  let deploy_request : Orchestrator.InternalDeployRequest = {
                    namespace = namespace;
                    hash = wasm_hash;
                  };

                  // --- d. Make the "fire-and-forget" call ---
                  try {
                    let orchestrator : Orchestrator.Service = actor (Principal.toText(orc_id));
                    ignore orchestrator.internal_deploy_or_upgrade(deploy_request);
                  } catch (e) {
                    Debug.print("Error calling orchestrator: " # Error.message(e));
                  };
                };
                case (null) {
                  Debug.print("Auto-deploy failed: Could not find original verification request for wasm_id " # wasm_id);
                };
              };
            };
            case (null) {
              // This is a valid scenario: the WASM was verified *before* a developer
              // published it to a namespace. No deployment can happen yet.
              Debug.print("WASM " # wasm_id # " verified, but not yet published to a namespace. Skipping auto-deployment.");
            };
          };
        };
        case (null) {
          Debug.print("WASM " # wasm_id # " verified, but no orchestrator is configured.");
        };
      };
    };

    return trx_id;
  };

  // The request type for our new custom query.
  public type GetCanisterTypeVersionRequest = {
    canister_type_namespace : Text;
    version_number : (Nat, Nat, Nat); // (major, minor, patch)
  };

  // This function resolves a specific version to its full record, including the WASM hash.
  // It is not part of the ICRC-118 standard, but a helper for the orchestrator workflow.
  public shared query func get_canister_type_version(req : GetCanisterTypeVersionRequest) : async Result.Result<Service.Wasm, Text> {
    // We use the existing icrc118_get_wasms function with a precise filter
    // to find the exact version record we're looking for.
    let filter : [Service.GetWasmsFilter] = [
      #canister_type_namespace(req.canister_type_namespace),
      #version_number(req.version_number),
    ];

    // We request up to 2 records to detect if there's an unexpected duplicate.
    let results = icrc118wasmregistry().icrc118_get_wasms({
      filter = ?filter;
      prev = null;
      take = ?2;
    });

    if (results.size() == 1) {
      // Found exactly one match, which is the expected outcome.
      return #ok(results[0]);
    } else if (results.size() == 0) {
      // No match found.
      return #err("Version not found for the given namespace.");
    } else {
      // This case should ideally never happen with a unique version number.
      return #err("Internal consistency error: Multiple records found for the same version.");
    };
  };

  // --- PRIVATE HELPER: Translates AppStore filters to Registry filters ---
  private func _translate_filters(filters : [AppStore.AppListingFilter]) : [Service.GetCanisterTypesFilter] {
    var out = Buffer.Buffer<Service.GetCanisterTypesFilter>(filters.size());
    for (f in filters.vals()) {
      switch (f) {
        case (#namespace(ns)) { out.add(#namespace(ns)) };
        case (#publisher(pub)) {
          // Note: The registry doesn't filter by publisher directly.
          // This is a limitation we accept for now to gain performance.
          // A future version of the registry could add this capability.
        };
        case (#name(_)) {
          // The registry also doesn't filter by app name.
        };
      };
    };
    return Buffer.toArray(out);
  };

  /**
   * Converts a (major, minor, patch) version tuple into a standard "1.2.3" string format.
   */
  private func _format_version_number(version_tuple : (Nat, Nat, Nat)) : Text {
    let (major, minor, patch) = version_tuple;
    return Nat.toText(major) # "." # Nat.toText(minor) # "." # Nat.toText(patch);
  };

  // --- PRIVATE HELPER: Encapsulates the logic for building a single listing ---
  // This takes a CanisterType and returns a fully formed AppListing, or null if it shouldn't be listed.
  private func _build_listing_for_canister_type(canister_type : ICRC118WasmRegistry.CanisterType) : ?AppStore.AppListing {
    // 1. Find the latest version for this canister type.
    if (canister_type.versions.size() == 0) {
      return null; // No versions, so nothing to list.
    };

    var latest_version = canister_type.versions[0];
    if (canister_type.versions.size() > 1) {
      for (i in Iter.range(1, canister_type.versions.size() - 1)) {
        if (ICRC118WasmRegistry.canisterVersionCompare(canister_type.versions[i], latest_version) == #greater) {
          latest_version := canister_type.versions[i];
        };
      };
    };

    // 2. Get the wasm_id and apply the verification gateway check.
    let wasm_id = Base16.encode(latest_version.calculated_hash);
    if (not _is_wasm_verified(wasm_id)) {
      return null; // The latest version is not verified, so we don't list the app.
    };

    // 3. Determine status (Pending vs. Verified) and build the listing object.
    let audit_records = _get_audit_records_for_wasm(wasm_id);
    let app_info_attestation = Array.find<ICRC126.AuditRecord>(
      audit_records,
      func(rec) {
        switch (rec) {
          case (#Attestation(att)) { att.audit_type == "app_info_v1" };
          case (_) { false };
        };
      },
    );

    // --- 4. Restructure the return object based on status ---
    switch (app_info_attestation) {
      case (?#Attestation(att)) {
        // --- PATH A: APP IS FULLY LISTED ---
        let completed_audits = AppStore.get_completed_audit_types(audit_records);
        let tier = AppStore.calculate_security_tier(true, completed_audits);

        return ?{
          // Stable app identity from the attestation
          namespace = canister_type.canister_type_namespace;
          name = AppStore.getICRC16Text(att.metadata, "name");
          description = AppStore.getICRC16Text(att.metadata, "description");
          category = AppStore.getICRC16Text(att.metadata, "category");
          publisher = AppStore.getICRC16Text(att.metadata, "publisher");
          icon_url = AppStore.getICRC16Text(att.metadata, "icon_url");
          banner_url = AppStore.getICRC16Text(att.metadata, "banner_url");

          // Nested object with version-specific details
          latest_version = {
            wasm_id = wasm_id;
            version_string = _format_version_number(latest_version.version_number);
            security_tier = tier;
            status = #Verified;
          };
        };
      };
      case (_) {
        // --- PATH B: APP IS PENDING ---
        let verification_request = Map.get(icrc126().state.requests, Map.thash, wasm_id);
        switch (verification_request) {
          case (?req) {
            let meta = req.metadata;
            let visuals_map = AppStore.getICRC16MapOptional(meta, "visuals");
            return ?{
              // Stable app identity from the verification request
              namespace = canister_type.canister_type_namespace;
              name = AppStore.getICRC16Text(meta, "name");
              description = AppStore.getICRC16Text(meta, "description");
              category = AppStore.getICRC16Text(meta, "category");
              publisher = AppStore.getICRC16Text(meta, "publisher");
              icon_url = switch (visuals_map) {
                case (?v) { AppStore.getICRC16Text(v, "icon_url") };
                case (_) { "" };
              };
              banner_url = switch (visuals_map) {
                case (?v) { AppStore.getICRC16Text(v, "banner_url") };
                case (_) { "" };
              };

              // Nested object with version-specific details
              latest_version = {
                wasm_id = wasm_id;
                version_string = _format_version_number(latest_version.version_number);
                security_tier = #Unranked;
                status = #Pending;
              };
            };
          };
          case (null) { return null };
        };
      };
    };
  };

  // --- THE REFACTORED PUBLIC FUNCTION ---
  public query func get_app_listings(req : AppStore.AppListingRequest) : async AppStore.AppListingResponse {
    // 1. Translate AppStore filters to the underlying Registry's filter format.
    let registry_filters = switch (req.filter) {
      case (?exists) { _translate_filters(exists) };
      case (null) { [] };
    };

    // 2. Delegate filtering and pagination to the ICRC-118 registry canister.
    //    This is the core performance improvement. We only fetch the small slice of data we need.
    let paginated_canister_types = icrc118wasmregistry().icrc118_get_canister_types({
      filter = registry_filters;
      prev = req.prev;
      take = req.take;
    });

    // 3. Create a buffer for the final, enriched AppListing objects.
    //    Its size is bounded by the `take` parameter, preventing large memory allocations.
    var out = Buffer.Buffer<AppStore.AppListing>(paginated_canister_types.size());

    // 4. Iterate over the SMALL, pre-filtered list to enrich the data.
    for (canister_type in paginated_canister_types.vals()) {
      switch (_build_listing_for_canister_type(canister_type)) {
        case (?listing) {
          // The helper function successfully built a listing. Add it to our results.
          out.add(listing);
        };
        case (null) {
          // The helper returned null (e.g., latest version not verified).
          // We simply skip it and move to the next one.
        };
      };
    };

    // 5. Return the final, enriched list.
    return #ok(Buffer.toArray(out));
  };

  // Assembles the BuildInfo object by looking for a build attestation or divergence report.
  private func _build_build_info(records : [ICRC126.AuditRecord]) : AppStore.BuildInfo {

    let build_att = _find_attestation_by_type(records, "build_reproducibility_v1");
    switch (build_att) {
      case (?att) {
        return {
          status = "success";
          git_commit = AppStore.getICRC16TextOptional(att.metadata, "git_commit");
          repo_url = AppStore.getICRC16TextOptional(att.metadata, "repo_url");
          failure_reason = null;
        };
      };
      case (null) {
        /* continue to check for divergence */
      };
    };

    let divergence = Array.find<ICRC126.AuditRecord>(records, func(r) { switch (r) { case (#Divergence(_)) true; case (_) false } });
    switch (divergence) {
      case (?exists) {
        let div = switch (exists) {
          case (#Divergence(d)) d;
          case (_) Debug.trap("impossible");
        };
        return {
          status = "failure";
          git_commit = null;
          repo_url = null;
          failure_reason = ?div.report;
        };
      };
      case (null) { /* continue to default return */ };
    };

    return {
      status = "unknown";
      git_commit = null;
      repo_url = null;
      failure_reason = null;
    };
  };

  // Extracts the list of tools from the 'tools_v1' attestation.
  private func _get_tools_from_records(records : [ICRC126.AuditRecord]) : [ICRC126.ICRC16Map] {
    switch (_find_attestation_by_type(records, "tools_v1")) {
      case (?att) { AppStore.getICRC16ArrayOfMaps(att.metadata, "tools") };
      case (null) { [] };
    };
  };

  // Extracts and assembles the DataSafetyInfo object.
  private func _get_data_safety_from_records(records : [ICRC126.AuditRecord]) : AppStore.DataSafetyInfo {
    switch (_find_attestation_by_type(records, "data_safety_v1")) {
      case (?att) {
        return {
          overall_description = AppStore.getICRC16Text(att.metadata, "overall_description");
          data_points = AppStore.getICRC16ArrayOfMaps(att.metadata, "data_points");
        };
      };
      case (null) {
        return { overall_description = ""; data_points = [] };
      };
    };
  };

  // Finds a specific attestation by its type from a list of audit records.
  private func _find_attestation_by_type(records : [ICRC126.AuditRecord], audit_type : Text) : ?ICRC126.AttestationRecord {
    let found = Array.find<ICRC126.AuditRecord>(
      records,
      func(rec) {
        switch (rec) {
          case (#Attestation(att)) { att.audit_type == audit_type };
          case (_) { false };
        };
      },
    );
    switch (found) {
      case (?#Attestation(att)) { return ?att };
      case (_) { return null };
    };
  };

  /**
   * Fetches and assembles all data for an app's detail page using its stable namespace.
   * This is the single, powerful query the frontend needs.
   */
  public query func get_app_details_by_namespace(
    namespace : Text,
    opt_wasm_id : ?Text,
  ) : async Result.Result<AppStore.AppDetailsResponse, AppStore.AppStoreError> {

    // 1. Find the canister type by its namespace.
    let req : Service.GetCanisterTypesRequest = {
      filter = [#namespace(namespace)];
      prev = null;
      take = ?1; // We only expect one canister type per namespace.
    };
    let canister_types = icrc118wasmregistry().icrc118_get_canister_types(req);
    if (canister_types.size() == 0) {
      return #err(#NotFound("Canister type not found for the given namespace"));
    };

    let canister_type = canister_types[0];

    // Define a comparison function for descending order (newest first).
    func compareVersionsDesc(a : ICRC118WasmRegistry.CanisterVersion, b : ICRC118WasmRegistry.CanisterVersion) : Order.Order {
      switch (ICRC118WasmRegistry.canisterVersionCompare(a, b)) {
        case (#less) { #greater }; // a < b, so move a after b
        case (#greater) { #less }; // a > b, so move a before b
        case (#equal) { #equal };
      };
    };
    var sorted_versions = Array.sort<ICRC118WasmRegistry.CanisterVersion>(canister_type.versions, compareVersionsDesc);

    // --- 3. THE FIX: Determine which version to load ---
    let version_to_load_record = switch (opt_wasm_id) {
      case (?wasm_id_hex) {
        Debug.print("WASM ID specified in request: " # wasm_id_hex);
        // A specific version was requested. Find it.
        let wasm_hash = Base16.decode(wasm_id_hex);
        let found = Array.find<ICRC118WasmRegistry.CanisterVersion>(
          sorted_versions,
          func(v) { ?v.calculated_hash == wasm_hash },
        );

        Debug.print("Requested wasm_id: " # wasm_id_hex);
        switch (found) {
          case (?v) { v };
          case (null) {
            return #err(#NotFound("Specific version hash not found"));
          };
        };
      };
      case (null) {
        // No specific version was requested. Default to the latest.
        sorted_versions[0];
      };
    };

    // --- 4. From now on, use `version_to_load_record` instead of `latest_version_record` ---
    let wasm_id_to_load = Base16.encode(version_to_load_record.calculated_hash);

    // 3. Fetch all data for the LATEST version in parallel.
    let latest_audit_records = _get_audit_records_for_wasm(wasm_id_to_load);
    let latest_bounties = _get_bounties_for_wasm(wasm_id_to_load);

    // 4. Build the `all_versions` summary list.
    var all_versions_summary = Buffer.Buffer<AppStore.AppVersionSummary>(canister_type.versions.size());
    for (version_record in sorted_versions.vals()) {
      let wasm_id = Base16.encode(version_record.calculated_hash);
      let is_verified = _is_wasm_verified(wasm_id);
      if (is_verified) {
        let records = _get_audit_records_for_wasm(wasm_id);
        let completed_audits = AppStore.get_completed_audit_types(records);
        all_versions_summary.add({
          wasm_id = wasm_id;
          version_string = _format_version_number(version_record.version_number);
          security_tier = AppStore.calculate_security_tier(true, completed_audits);
          status = #Verified;
        });
      };
    };

    // 5. Assemble the detailed object for the LATEST version.
    let latest_build_info = _build_build_info(latest_audit_records);
    let latest_version_details : AppStore.AppVersionDetails = {
      wasm_id = wasm_id_to_load;
      version_string = _format_version_number(version_to_load_record.version_number);
      status = #Verified; // If we got this far, it must be at least Pending/Verified
      security_tier = AppStore.calculate_security_tier(true, AppStore.get_completed_audit_types(latest_audit_records));
      build_info = latest_build_info;
      tools = _get_tools_from_records(latest_audit_records);
      data_safety = _get_data_safety_from_records(latest_audit_records);
      bounties = latest_bounties;
      audit_records = latest_audit_records;
    };

    // 6. Assemble the stable, top-level app information.
    //    This comes from the app_info attestation, with a fallback to the verification request.
    let app_info_att = _find_attestation_by_type(latest_audit_records, "app_info_v1");
    switch (app_info_att) {
      case (?att) {
        // Path A: Fully listed app, use attestation as source of truth.
        return #ok({
          namespace = namespace;
          name = AppStore.getICRC16Text(att.metadata, "name");
          mcp_path = AppStore.getICRC16Text(att.metadata, "mcp_path");
          publisher = AppStore.getICRC16Text(att.metadata, "publisher");
          category = AppStore.getICRC16Text(att.metadata, "category");
          icon_url = AppStore.getICRC16Text(att.metadata, "icon_url");
          banner_url = AppStore.getICRC16Text(att.metadata, "banner_url");
          gallery_images = AppStore.getICRC16TextArray(att.metadata, "gallery_images");
          description = AppStore.getICRC16Text(att.metadata, "description");
          key_features = AppStore.getICRC16TextArray(att.metadata, "key_features");
          why_this_app = AppStore.getICRC16Text(att.metadata, "why_this_app");
          tags = AppStore.getICRC16TextArray(att.metadata, "tags");
          latest_version = latest_version_details;
          all_versions = Buffer.toArray(all_versions_summary);
        });
      };
      case (null) {
        // Path B: Pending app, use original verification request as source of truth.
        let verification_request = _get_verification_request(wasm_id_to_load);
        switch (verification_request) {
          case (?req) {
            let meta = req.metadata;
            let visuals_map = AppStore.getICRC16MapOptional(meta, "visuals");
            return #ok({
              namespace = namespace;
              name = AppStore.getICRC16Text(meta, "name");
              mcp_path = AppStore.getICRC16Text(meta, "mcp_path");
              publisher = AppStore.getICRC16Text(meta, "publisher");
              category = AppStore.getICRC16Text(meta, "category");
              description = AppStore.getICRC16Text(meta, "description");
              key_features = AppStore.getICRC16TextArray(meta, "key_features");
              why_this_app = AppStore.getICRC16Text(meta, "why_this_app");
              tags = AppStore.getICRC16TextArray(meta, "tags");
              icon_url = switch (visuals_map) {
                case (?v) { AppStore.getICRC16Text(v, "icon_url") };
                case (_) { "" };
              };
              banner_url = switch (visuals_map) {
                case (?v) { AppStore.getICRC16Text(v, "banner_url") };
                case (_) { "" };
              };
              gallery_images = switch (visuals_map) {
                case (?v) { AppStore.getICRC16TextArray(v, "gallery_images") };
                case (_) { [] };
              };
              latest_version = { latest_version_details with status = #Pending };
              all_versions = Buffer.toArray(all_versions_summary);
            });
          };
          case (null) {
            return #err(#NotFound("Verification request not found for pending app"));
          };
        };
      };
    };
  };

  /**
   * @notice Fetches a paginated and filtered list of all bounties.
   * @param req The request object containing optional filters and pagination cursors.
   * @return A result containing an array of matching `ICRC127.Bounty` records or an error.
   */
  public shared query func list_bounties(req : Bounty.BountyListingRequest) : async Bounty.BountyListingResponse {
    // 1. Handle optional arguments and set defaults.
    let filters = switch (req.filter) { case null []; case (?fs) fs };
    let take = switch (req.take) { case null 20; case (?n) Nat.min(n, 100) };
    let prev = req.prev;

    // 2. Fetch ALL bounties into an in-memory array.
    let all_bounties = BTree.toValueArray(icrc127().state.bounties);

    Debug.print("[DEBUG] Total bounties fetched: " # debug_show (all_bounties.size()));

    // 3. Define the filtering logic in a helper function.
    // A bounty must match ALL filters in the request to be included.
    func matchesAllFilters(bounty : ICRC127.Bounty, filters : [Bounty.BountyFilter]) : Bool {
      if (filters.size() == 0) return true;

      for (f in filters.vals()) {
        switch (f) {
          case (#status(statusFilter)) {
            let is_claimed = bounty.claimed != null;
            switch (statusFilter) {
              case (#Open) { if (is_claimed) return false };
              case (#Claimed) { if (not is_claimed) return false };
            };
          };
          case (#audit_type(typeFilter)) {
            // --- START: APPLYING THE REFERENCE PATTERN ---

            // 1. Safely check if challenge_parameters is a Map, just like the reference.
            switch (bounty.challenge_parameters) {
              case (#Map(params_map)) {
                // 2. It's a map! Now we can use our clean helper on it.
                switch (AppStore.getICRC16TextOptional(params_map, "audit_type")) {
                  case (?bountyType) {
                    // The key was found and was Text. Compare the value.
                    if (bountyType != typeFilter) { return false };
                  };
                  case (null) {
                    // The key was not found within the map, or was the wrong type. Filter fails.
                    return false;
                  };
                };
              };
              case (_) {
                // The challenge_parameters were not a Map at all. Filter fails.
                return false;
              };
            };
            // --- END: APPLYING THE REFERENCE PATTERN ---
          };
          case (#creator(creatorFilter)) {
            if (bounty.creator != creatorFilter) return false;
          };
        };
      };
      // If the bounty survived all filters, it's a match.
      return true;
    };

    // 4. Apply pagination and filtering to the in-memory list.
    var started = prev == null;
    var count : Nat = 0;
    let out = Buffer.Buffer<ICRC127.Bounty>(take);

    // Use a while loop to iterate from the last index (newest) to the first (oldest).
    var i = all_bounties.size();
    label collect while (i > 0) {
      i -= 1;
      let bounty = all_bounties[i];

      if (not started) {
        // If we have a `prev` cursor, we need to find it before we start collecting.
        switch (prev) {
          case (?p) {
            if (bounty.bounty_id == p) {
              // We found the last item of the previous page.
              // We will start collecting on the *next* iteration.
              started := true;
            };
            // Continue to the next iteration, skipping the current item.
            continue collect;
          };
          case (null) {
            // This case is handled by the initial `started` assignment, but included for completeness.
          };
        };
      };

      // `started` is now true. We can start collecting matching bounties.
      if (matchesAllFilters(bounty, filters)) {
        out.add(bounty);
        count += 1;
        if (count >= take) break collect; // Exit the loop once we have enough items.
      };
    };

    return #ok(Buffer.toArray(out));
  };

  // --- DAO-Specific Endpoints ---

  // Define the shape of the data we'll return for the DAO list command.
  public type PendingSubmission = {
    wasm_id : Text;
    repo_url : Text;
    commit_hash : Blob;
    attestation_types : [Text]; // A list of all NEW audit types submitted since the last review.
  };

  // A standard pagination request type.
  public type PaginationRequest = {
    take : ?Nat;
    prev : ?Text; // The wasm_id of the last item from the previous page.
  };

  private func _get_verification_request(wasm_id : Text) : ?ICRC126Service.VerificationRequest {
    let all_requests = icrc126().state.requests;
    Map.get(all_requests, Map.thash, wasm_id);
  };

  /**
   * @notice Fetches the original verification request metadata for a given WASM ID.
   * @param wasm_id The hex-encoded SHA-256 hash of the WASM.
   * @return The optional `VerificationRequest` record, which contains the repo URL and commit hash.
   *         Returns `null` if no request is found for the given ID.
   */
  public shared query func get_verification_request(wasm_id : Text) : async ?ICRC126Service.VerificationRequest {
    _get_verification_request(wasm_id);
  };

  // A new, paginated query to find all verification requests that are waiting for a bounty.
  public shared query func list_pending_verifications(
    // We can add pagination later if needed. For now, we'll return all.
  ) : async [ICRC126.VerificationRecord] {
    var pending_requests = Buffer.Buffer<ICRC126.VerificationRecord>(0);
    let all_requests = icrc126().state.requests;
    let all_bounties = BTree.toValueArray(icrc127().state.bounties);

    // --- NEW: Create a helper Set for fast lookups of sponsored WASM hashes ---
    var sponsored_wasm_ids = Map.new<Text, Null>();
    for (bounty in all_bounties.vals()) {
      // Check if this is a build reproducibility bounty
      switch (bounty.challenge_parameters) {
        case (#Map(params)) {
          let audit_type = AppStore.getICRC16TextOptional(params, "audit_type");
          if (audit_type == ?"build_reproducibility_v1") {
            // This is a build bounty. Add its wasm_id to our set.
            let wasm_hash = AppStore.getICRC16BlobOptional(params, "wasm_hash");
            switch (wasm_hash) {
              case (?h) {
                Map.set(sponsored_wasm_ids, Map.thash, Base16.encode(h), null);
              };
              case (_) {};
            };
          };
        };
        case (_) {};
      };
    };

    for ((wasm_id, request) in Map.entries(all_requests)) {
      // Condition 1: Check if the request has been finalized.
      let is_finalized = BTree.get(finalization_log, Text.compare, wasm_id) != null;

      // Condition 2: Check if a build bounty already exists for this wasm_id.
      let is_sponsored = Option.isSome(Map.get(sponsored_wasm_ids, Map.thash, wasm_id));

      // --- THE NEW, CORRECT LOGIC ---
      // Only include the request if it is NOT finalized AND NOT yet sponsored.
      if (not is_finalized and not is_sponsored) {
        pending_requests.add(request);
      };
    };

    var pending_array = Buffer.toArray(pending_requests);

    // --- Step 3: Define a custom comparison function for sorting ---
    // This function will sort records by their timestamp in descending order (newest first).
    func compareRecords(a : ICRC126.VerificationRecord, b : ICRC126.VerificationRecord) : Order.Order {
      if (a.timestamp > b.timestamp) {
        return #less; // a is newer, so it should come first
      } else if (a.timestamp < b.timestamp) {
        return #greater; // b is newer, so it should come first
      } else {
        return #equal; // timestamps are equal
      };
    };

    // --- Step 4: Sort the array in-place using the comparison function ---
    pending_array := Array.sort<ICRC126.VerificationRecord>(pending_array, compareRecords);

    // --- Step 5: Return the now-sorted array ---
    return pending_array;
  };

  private func _get_audit_records_for_wasm(wasm_id : Text) : [ICRC126.AuditRecord] {
    let all_audits = icrc126().state.audits;

    // Look up the wasm_id and return the array of records, or an empty array if none exist.
    let records = switch (Map.get(all_audits, Map.thash, wasm_id)) {
      case (null) [];
      case (?rs) rs;
    };

    return records;
  };

  public shared query func get_audit_records_for_wasm(wasm_id : Text) : async [ICRC126.AuditRecord] {
    _get_audit_records_for_wasm(wasm_id);
  };

  //------------------- SAMPLE FUNCTION -------------------//

  public shared func hello() : async Text {
    "world!";
  };

};
