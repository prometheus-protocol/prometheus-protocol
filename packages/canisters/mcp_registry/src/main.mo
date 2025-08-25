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
import CertTree "mo:cert/CertTree";
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

import AppStore "AppStore";
import AuditorCredentials "AuditorCredentials";
import Bounty "Bounty";

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
    if (_credentials_canister_id != null) {
      return #err("Auditor Credentials Canister ID has already been set");
    };

    _credentials_canister_id := ?canister_id;
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
                let credentials : AuditorCredentials.Service = actor (Principal.toText(id));
                let permission_result = await credentials.verify_credential(auditor, audit_type);
                return permission_result;
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

  public shared query func is_wasm_verified(wasm_id : Text) : async Bool {
    let final_status = BTree.get(finalization_log, Text.compare, wasm_id);

    switch (final_status) {
      case (null) {
        // Not yet finalized.
        Debug.print("[DEBUG] No finalization record found for wasm_id: \"" # wasm_id # "\"");
        return false;
      };
      case (?record) {
        switch (record.outcome) {
          case (#Verified) {
            // Explicitly verified!
            Debug.print("[DEBUG] Wasm ID \"" # wasm_id # "\" is verified.");
            return true;
          };
          case (#Rejected) {
            // Explicitly rejected.
            Debug.print("[DEBUG] Wasm ID \"" # wasm_id # "\" is rejected.");
            return false;
          };
        };
      };
    };
  };

  private func _get_attestations_for_wasm(wasm_id : Text) : [ICRC126.AttestationRecord] {

    // --- Step 1: Find the timestamp of the last finalization for this WASM ID ---
    let last_finalization_record = BTree.get(finalization_log, Text.compare, wasm_id);

    let finalization_ts = switch (last_finalization_record) {
      case (null) {
        // This WASM has never been finalized. According to the logic, no attestations
        // are "official" yet. Return an empty array.
        Debug.print("[DEBUG] No finalization record found for wasm_id: \"" # wasm_id # "\"");
        return [];
      };
      case (?record) {
        // We found a finalization record, use its timestamp as our cutoff.
        record.timestamp;
      };
    };

    // --- Step 2: Get all audit records for the WASM ID ---
    let state = icrc126().state;
    let all_audit_records = switch (Map.get(state.audits, Map.thash, wasm_id)) {
      case (null) {
        Debug.print("[DEBUG] No audits found for wasm_id: \"" # wasm_id # "\"");
        return [];
      };
      case (?records) { records };
    };

    // --- Step 3: Filter for attestations created *before or at* the finalization time ---
    var valid_attestations = Buffer.Buffer<ICRC126.AttestationRecord>(0);
    for (record in all_audit_records.vals()) {
      switch (record) {
        case (#Attestation(att_record)) {
          // The core filtering logic: only include attestations "stamped" by the finalization.
          if (att_record.timestamp <= finalization_ts) {
            valid_attestations.add(att_record);
          };
        };
        case (#Divergence(_)) { /* Ignore */ };
      };
    };

    // --- Step 4: From the valid attestations, find the single most recent for each type ---
    // We use a mutable map to track the latest attestation we've seen for each audit_type.
    var latest_by_type = Map.new<Text, ICRC126.AttestationRecord>();

    for (att in valid_attestations.vals()) {
      let existing = Map.get(latest_by_type, Map.thash, att.audit_type);
      switch (existing) {
        case (null) {
          // This is the first time we've seen this audit_type, so it's the latest by default.
          Map.set(latest_by_type, Map.thash, att.audit_type, att);
        };
        case (?prev_att) {
          // We've seen this type before. If the current one is newer, it replaces the old one.
          if (att.timestamp > prev_att.timestamp) {
            Map.set(latest_by_type, Map.thash, att.audit_type, att);
          };
        };
      };
    };

    // The values of the map now represent the definitive, "official" set of attestations.
    return Iter.toArray(Map.vals(latest_by_type));
  };

  public shared query func get_attestations_for_wasm(wasm_id : Text) : async [ICRC126.AttestationRecord] {
    _get_attestations_for_wasm(wasm_id);
  };

  public shared query func get_bounties_for_wasm(wasm_id : Text) : async [ICRC127.Bounty] {
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

  private func has_attestation(wasm_id : Text, audit_type : Text) : Bool {
    // 1. Get the current state from the ICRC-126 library instance.
    let state = icrc126().state;

    // 2. Look up the wasm_id in the `audits` map.
    switch (Map.get(state.audits, Map.thash, wasm_id)) {
      case (null) {
        // If there's no entry for this wasm_id, there are no audits.
        return false;
      };
      case (?audit_records) {
        // 3. We have an array of audits. Find one that is an Attestation of the correct type.
        let found_match = Array.find<ICRC126.AuditRecord>(
          audit_records,
          func(record : ICRC126.AuditRecord) : Bool {
            switch (record) {
              case (#Attestation(att_record)) {
                // This is an attestation. Check if its audit_type matches.
                return att_record.audit_type == audit_type;
              };
              case (#Divergence(_)) {
                // This is a divergence report, not an attestation. Ignore it.
                return false;
              };
            };
          },
        );

        // 4. Return true if we found a matching attestation, false otherwise.
        return Option.isSome(found_match);
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
                if (has_attestation(wasm_id, audit_type_exists)) {
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
    await* icrc118wasmregistry().icrc118_update_wasm(msg.caller, req);
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
    await icrc126().icrc126_file_attestation(msg.caller, req);
  };

  public shared (msg) func icrc126_file_divergence(req : ICRC126Service.DivergenceReportRequest) : async ICRC126Service.DivergenceResult {
    await icrc126().icrc126_file_divergence(msg.caller, req);
  };

  // --- ICRC127 Endpoints ---
  public shared (msg) func icrc127_create_bounty(req : ICRC127Service.CreateBountyRequest) : async ICRC127Service.CreateBountyResult {
    await icrc127().icrc127_create_bounty<system>(msg.caller, req);
  };
  public shared (msg) func icrc127_submit_bounty(req : ICRC127Service.BountySubmissionRequest) : async ICRC127Service.BountySubmissionResult {
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

  public shared (msg) func finalize_verification(
    wasm_id : Text,
    outcome : VerificationOutcome,
    metadata : ICRC126.ICRC16Map,
  ) : async Result.Result<Nat, Text> {
    // 1. Authorization: Only the owner (DAO) can call this.
    if (not _is_owner(msg.caller)) {
      return #err("Caller is not the owner");
    };

    // 3. Create and store the finalization record.
    let record : FinalizationRecord = {
      outcome = outcome;
      timestamp = Time.now();
      metadata = metadata;
    };
    ignore BTree.insert(finalization_log, Text.compare, wasm_id, record);

    // 4. Log the official ICRC-3 block.
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

    return #ok(trx_id);
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

  public query func get_app_listings(req : AppStore.AppListingRequest) : async AppStore.AppListingResponse {
    // 1. Handle optional arguments, mirroring the reference implementation.
    let filters = switch (req.filter) { case null []; case (?fs) fs };
    let take = switch (req.take) { case null 20; case (?n) Nat.min(n, 100) }; // Default 20, max 100.
    let prev = req.prev;

    // 2. Fetch ALL canister types. This is the base dataset.
    let all_canister_types = icrc118wasmregistry().icrc118_get_canister_types({
      filter = [];
      prev = null;
      take = null;
    });

    // 3. Pre-process and "join" data into a complete list of potential listings.
    //    This is done in memory before filtering and pagination.
    var all_listings = Buffer.Buffer<AppStore.AppListing>(all_canister_types.size());
    for (canister_type in all_canister_types.vals()) {
      // a. Find the latest version for this canister type.
      if (canister_type.versions.size() > 0) {
        // Start with the first version as the potential latest.
        var latest_version = canister_type.versions[0];

        // If there are more versions, iterate from the second element (index 1) to the end.
        if (canister_type.versions.size() > 1) {
          // Use Iter.range to create an iterator of indices from 1 to size-1.
          for (i in Iter.range(1, canister_type.versions.size() - 1)) {
            if (ICRC118WasmRegistry.canisterVersionCompare(canister_type.versions[i], latest_version) == #greater) {
              latest_version := canister_type.versions[i];
            };
          };
        };

        // b. Get all attestations for that latest version's hash.
        let wasm_id = Base16.encode(latest_version.calculated_hash);
        let attestations_for_wasm = _get_attestations_for_wasm(wasm_id);

        // c. Find the specific 'app_info_v1' attestation.

        // Search backward to find the newest app_info_v1 attestation?
        let app_info_attestation = Array.find<ICRC126.AttestationRecord>(
          attestations_for_wasm,
          func(att) {
            att.audit_type == "app_info_v1";
          },
        );

        // d. If found, construct and add the AppListing record.
        switch (app_info_attestation) {
          case (?att) {
            var completed_audits : [Text] = [];
            for (a in attestations_for_wasm.vals()) {
              completed_audits := Array.append(completed_audits, [a.audit_type]);
            };

            // Calculate the tier using our new helper function.
            let tier = AppStore.calculate_security_tier(completed_audits);

            all_listings.add({
              id = wasm_id;
              namespace = canister_type.canister_type_namespace;
              name = AppStore.getICRC16Text(att.metadata, "name");
              description = AppStore.getICRC16Text(att.metadata, "description");
              category = AppStore.getICRC16Text(att.metadata, "category");
              publisher = AppStore.getICRC16Text(att.metadata, "publisher");
              icon_url = AppStore.getICRC16Text(att.metadata, "icon_url");
              banner_url = AppStore.getICRC16Text(att.metadata, "banner_url");
              security_tier = tier;
            });
          };
          case (null) {}; // Skip types that don't have an app_info attestation.
        };
      };
    };

    // --- 3. REVISED FILTERING LOGIC ---
    // This function now correctly handles an array of filter variants.
    // An AppListing must match ALL filters in the array to be included.
    func matchesAllFilters(listing : AppStore.AppListing, filters : [AppStore.AppListingFilter]) : Bool {
      if (filters.size() == 0) return true;

      // Iterate through each filter variant provided in the request.
      label filterLoop for (f in filters.vals()) {
        switch (f) {
          case (#namespace(nsFilter)) {
            if (listing.namespace != nsFilter) return false;
          };
          case (#publisher(pubFilter)) {
            if (listing.publisher != pubFilter) return false;
          };
          case (#name(nameFilter)) {
            if (listing.name != nameFilter) return false;
          };
        };
      };
      // If the listing survived all filters, it's a match.
      return true;
    };

    // 5. Apply pagination and filtering to the in-memory list.
    var started = prev == null;
    var count : Nat = 0;
    let out = Buffer.Buffer<AppStore.AppListing>(take);

    label main for (listing in all_listings.vals()) {
      if (not started) {
        switch prev {
          case null {}; // Should be handled by `started` initialization.
          case (?p) {
            // We skip all items until we find the one matching `prev`.
            // The next item after `prev` will be the first one included.
            if (listing.namespace == p) { started := true };
            continue main;
          };
        };
      };

      // `started` is now true.
      if (matchesAllFilters(listing, filters)) {
        out.add(listing);
        count += 1;
        if (count >= take) break main;
      };
    };

    return #ok(Buffer.toArray(out));
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

    label main for (bounty in all_bounties.vals()) {
      if (not started) {
        switch (prev) {
          case null {};
          case (?p) {
            // We skip items until we find the one matching `prev` (the last bounty_id of the previous page).
            if (bounty.bounty_id == p) { started := true };
            continue main;
          };
        };
      };

      // `started` is now true.
      if (matchesAllFilters(bounty, filters)) {
        out.add(bounty);
        count += 1;
        if (count >= take) break main;
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

  /**
   * @notice Fetches a paginated list of all WASM submissions that have new, unreviewed attestations.
   * @param req The pagination request object.
   * @return An array of `PendingSubmission` records.
   */
  public shared query func list_pending_submissions(req : PaginationRequest) : async [PendingSubmission] {
    let take = switch (req.take) { case null 20; case (?n) Nat.min(n, 100) };
    let prev = req.prev;

    // This buffer will hold all submissions that are determined to be ready for review.
    var submissions_to_review = Buffer.Buffer<PendingSubmission>(0);

    // We must iterate through all verification requests to see which ones are pending.
    let all_requests = icrc126().state.requests;

    for ((wasm_id, request) in Map.entries(all_requests)) {
      // 1. Get the timestamp of the last time this wasm_id was finalized by the DAO.
      // If it has never been finalized, the timestamp is effectively 0.
      let last_finalization_ts : Time.Time = switch (BTree.get(finalization_log, Text.compare, wasm_id)) {
        case (null) { 0 };
        case (?record) { record.timestamp };
      };

      // 2. Get all audit records (attestations and divergences) for this wasm_id.
      let audit_records = switch (Map.get(icrc126().state.audits, Map.thash, wasm_id)) {
        case (null) { [] };
        case (?records) { records };
      };

      // 3. Find all attestations that are NEWER than the last finalization.
      var new_attestations = Buffer.Buffer<ICRC126.AttestationRecord>(0);
      for (record in audit_records.vals()) {
        switch (record) {
          case (#Attestation(att_record)) {
            if (att_record.timestamp > last_finalization_ts) {
              new_attestations.add(att_record);
            };
          };
          case (_) { /* Ignore divergences for this query */ };
        };
      };

      // 4. If we found any new attestations, this submission is ready for review.
      if (new_attestations.size() > 0) {
        // Collect the audit types of the new attestations for the response.
        var new_att_types : [Text] = [];
        for (att in new_attestations.vals()) {
          new_att_types := Array.append(new_att_types, [att.audit_type]);
        };

        submissions_to_review.add({
          wasm_id = wasm_id;
          repo_url = request.repo;
          commit_hash = request.commit_hash;
          attestation_types = new_att_types;
        });
      };
    };

    // 5. Apply pagination to the in-memory list of reviewable submissions.
    var started = prev == null;
    var count : Nat = 0;
    let out = Buffer.Buffer<PendingSubmission>(take);

    label main for (sub in submissions_to_review.vals()) {
      if (not started) {
        switch (prev) {
          case null {};
          case (?p) { if (sub.wasm_id == p) { started := true }; continue main };
        };
      };

      out.add(sub);
      count += 1;
      if (count >= take) break main;
    };

    return Buffer.toArray(out);
  };

  /**
   * @notice Fetches the original verification request metadata for a given WASM ID.
   * @param wasm_id The hex-encoded SHA-256 hash of the WASM.
   * @return The optional `VerificationRequest` record, which contains the repo URL and commit hash.
   *         Returns `null` if no request is found for the given ID.
   */
  public shared query func get_verification_request(wasm_id : Text) : async ?ICRC126Service.VerificationRequest {
    // 1. Access the `requests` map from the ICRC-126 library's state.
    let all_requests = icrc126().state.requests;

    // 2. Perform a direct lookup using the wasm_id as the key.
    //    This is highly efficient as it's a hash map lookup.
    let result = Map.get(all_requests, Map.thash, wasm_id);

    // 3. Return the result. `Map.get` returns an optional, which matches our function's return type.
    return result;
  };

  //------------------- SAMPLE FUNCTION -------------------//

  public shared func hello() : async Text {
    "world!";
  };

};
