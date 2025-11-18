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
import Orchestrator "Orchestrator";
import UsageTracker "UsageTracker";
import SearchIndex "SearchIndex";
import Treasury "Treasury";

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
  stable var _usage_tracker_canister_id : ?Principal = null;
  stable var _search_index_canister_id : ?Principal = null;
  stable var _audit_hub_canister_id : ?Principal = null; // DEPRECATED: No longer used, audit_hub is now called by bounty_sponsor
  stable var _bounty_sponsor_canister_id : ?Principal = null;
  stable var _bounty_reward_token_canister_id : ?Principal = null;
  stable var _bounty_reward_amount : Nat = 250_000; // Default: $0.25 in 6-decimal token

  // deprecated
  stable var icrc127_migration_state : ICRC127.State = ICRC127.initialState();

  // --- NEW: A reverse-lookup index to find a namespace from a wasm_id ---
  // Key: wasm_id (hex string)
  // Value: namespace (Text)
  stable var wasm_to_namespace_map = BTree.init<Text, Text>(null);

  // --- NEW: A reverse-lookup index to find bounties for a wasm_id ---
  // Key: wasm_id (hex string)
  // Value: Array of bounty_ids
  stable var wasm_to_bounties_map = BTree.init<Text, [Nat]>(null);

  // --- NEW: Track verification progress for majority consensus ---
  // Key: wasm_id, Value: Set of bounty_ids that have been successfully attested
  stable var verification_progress = BTree.init<Text, [Nat]>(null);

  // Key: wasm_id, Value: Set of bounty_ids that reported divergence
  stable var divergence_progress = BTree.init<Text, [Nat]>(null);

  // Constants for majority consensus
  let REQUIRED_VERIFIERS : Nat = 9; // Total verifiers needed
  let MAJORITY_THRESHOLD : Nat = 5; // Minimum successful verifications (5 of 9)

  // Helper function to create composite key for verification/divergence progress
  // Separates build_reproducibility_v1 from tools_v1 attestations for the same WASM
  private func _make_progress_key(wasm_id : Text, audit_type : Text) : Text {
    wasm_id # "::" # audit_type;
  };

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

  public shared ({ caller }) func set_usage_tracker_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _usage_tracker_canister_id := ?canister_id;
    return #ok(());
  };

  public shared ({ caller }) func set_search_index_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _search_index_canister_id := ?canister_id;
    return #ok(());
  };

  public shared ({ caller }) func set_bounty_sponsor_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _bounty_sponsor_canister_id := ?canister_id;
    return #ok(());
  };

  public shared ({ caller }) func set_bounty_reward_token_canister_id(canister_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _bounty_reward_token_canister_id := ?canister_id;
    return #ok(());
  };

  public shared ({ caller }) func set_bounty_reward_amount(amount : Nat) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _bounty_reward_amount := amount;
    return #ok(());
  };

  /// Withdraw USDC or other ICRC-2 tokens from the registry treasury
  /// Only the owner can call this function
  public shared ({ caller }) func withdraw(
    ledger_id : Principal,
    amount : Nat,
    destination : ICRC2.Account,
  ) : async Result.Result<Nat, Treasury.TreasuryError> {
    await Treasury.withdraw(caller, _owner, ledger_id, amount, destination);
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

                // STRATEGY: Check both token balance AND active bounty locks
                // This allows both direct auditors (with tokens) and bounty verifiers (with locks) to file attestations

                // 1. Check token balance (original logic for direct auditors)
                let balance : AuditHub.Balance = await auditHub.get_available_balance_by_audit_type(auditor, audit_type);
                if (balance > 0) {
                  return true; // Auditor has tokens, authorized
                };

                // 2. Check if auditor has any active bounty locks (for API key verifiers)
                // If they have a valid lock, they're authorized to file attestations
                let has_active_lock : Bool = await auditHub.has_active_bounty_lock(auditor);
                return has_active_lock;
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

  public shared query func can_install_wasm(caller : Principal, wasm_id : Text) : async Bool {
    // First, check if the wasm has been explicitly finalized as verified.
    if (_is_wasm_verified(wasm_id)) {
      return true;
    };

    // Next, check for 'deployment_type' value.
    // if it is 'global', and this canister is the caller, allow installation.
    // If it is 'provisioned', then the caller can be any authenticated principal.
    let verification = _get_verification_request(wasm_id);

    switch (verification) {
      case (?exists) {
        let deployment_type = Option.get(AppStore.getICRC16TextOptional(exists.metadata, "deployment_type"), "global");
        if (deployment_type == "global" and caller == thisPrincipal) {
          return true;
        } else if (deployment_type == "provisioned") {
          return true;
        } else {
          // Unknown deployment type, do not allow installation.
          return false;
        };
      };
      case (null) {
        /* build has not been reproduced */
        return false;
      };
    };

    // No final verification and no attestations means installation is not allowed.
    return false;
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

        // Index app metadata for search (moved from verification_request)
        // We get the metadata from the verification request for this wasm
        let verification_request_opt = _get_verification_request(wasm_id);
        switch (verification_request_opt) {
          case (?verification_request) {
            let name = AppStore.getICRC16Text(verification_request.metadata, "name");
            let description = AppStore.getICRC16Text(verification_request.metadata, "description");
            let publisher = AppStore.getICRC16Text(verification_request.metadata, "publisher");
            let tags = AppStore.getICRC16TextArray(verification_request.metadata, "tags");
            let combined_text = name # " " # description # " " # publisher # " " # Text.join(" ", tags.vals());
            ignore _notify_indexer_of_update(req.canister_type_namespace, combined_text);
          };
          case (null) {
            Debug.print("No verification request found for wasm_id " # wasm_id # ". Skipping indexing.");
          };
        };
      };
      case (#Error(_)) {
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

  /**
   * Helper function to check if an auditor has already filed any audit (attestation OR divergence)
   * for a given wasm_id and audit_type. This prevents race conditions in mutual exclusion.
   *
   * Returns: #Ok if no prior audit found for this audit_type, #Error if auditor already filed something
   */
  private func _check_auditor_has_not_filed(wasm_id : Text, auditor : Principal, audit_type : Text) : {
    #Ok;
    #Error : Text;
  } {
    let existing_audits = switch (Map.get(icrc126().state.audits, Map.thash, wasm_id)) {
      case (null) { return #Ok }; // No audits yet, safe to proceed
      case (?audits) { audits };
    };

    // Check if this auditor has already filed an attestation for THIS audit_type
    let found_attestation = Array.find<ICRC126.AuditRecord>(
      existing_audits,
      func(record) {
        switch (record) {
          case (#Attestation(att)) {
            att.auditor == auditor and att.audit_type == audit_type
          };
          case (#Divergence(_)) { false };
        };
      },
    );

    if (Option.isSome(found_attestation)) {
      return #Error("Auditor has already filed an attestation for this WASM and audit type");
    };

    // Check if this auditor has already filed a divergence for THIS audit_type
    // Note: Divergences don't have audit_type directly, they're associated with the verification request
    // For now, we check if they filed ANY divergence for this WASM (divergences are less common)
    let found_divergence = Array.find<ICRC126.AuditRecord>(
      existing_audits,
      func(record) {
        switch (record) {
          case (#Attestation(_)) { false };
          case (#Divergence(div)) { div.reporter == auditor };
        };
      },
    );

    if (Option.isSome(found_divergence)) {
      return #Error("Auditor has already filed a divergence report for this WASM");
    };

    #Ok;
  };

  public shared (msg) func icrc126_file_attestation(req : ICRC126Service.AttestationRequest) : async ICRC126Service.AttestationResult {
    let bounty_id = switch (AuditHub.get_bounty_id_from_metadata(req.metadata)) {
      case (null) {
        return #Error(#Generic("Attestation metadata must include a 'bounty_id'."));
      };
      case (?id) { id };
    };

    // Extract audit_type early so we can use it for progress tracking
    let audit_type = switch (AppStore.getICRC16TextOptional(req.metadata, "126:audit_type")) {
      case (?t) { t };
      case (null) {
        return #Error(#Generic("Attestation metadata must include '126:audit_type'."));
      };
    };

    // Create composite key for progress tracking (wasm_id::audit_type)
    let progress_key = _make_progress_key(req.wasm_id, audit_type);

    // --- CRITICAL: Check auditor hasn't already filed BEFORE any async calls ---
    switch (_check_auditor_has_not_filed(req.wasm_id, msg.caller, audit_type)) {
      case (#Error(err)) {
        Debug.print("🚫 Mutual exclusion check failed: " # err);
        return #Error(#Generic(err));
      };
      case (#Ok) {};
    };

    // --- CRITICAL: Check if THIS SPECIFIC BOUNTY already filed anything ---
    // This prevents race conditions where same bounty submits attestation+divergence concurrently
    let existing_attestations = Option.get(
      BTree.get(verification_progress, Text.compare, progress_key),
      [],
    );
    let existing_divergences = Option.get(
      BTree.get(divergence_progress, Text.compare, progress_key),
      [],
    );

    let bounty_in_attestations = Array.find<Nat>(existing_attestations, func(id) { id == bounty_id });
    let bounty_in_divergences = Array.find<Nat>(existing_divergences, func(id) { id == bounty_id });

    if (Option.isSome(bounty_in_attestations)) {
      Debug.print("ERROR: Bounty " # Nat.toText(bounty_id) # " already filed attestation");
      return #Error(#Generic("This bounty has already filed an attestation"));
    };
    if (Option.isSome(bounty_in_divergences)) {
      Debug.print("ERROR: Bounty " # Nat.toText(bounty_id) # " already filed divergence");
      return #Error(#Generic("This bounty has already filed a divergence - cannot file attestation"));
    };

    // --- NEW: Check if caller has already participated in this WASM verification ---
    // Check if caller already has a bounty recorded for this WASM (excluding current bounty)
    let all_recorded_bounties = Array.append(existing_attestations, existing_divergences);
    for (recorded_bounty_id in all_recorded_bounties.vals()) {
      // Skip checking the current bounty - verifier is allowed to file for their own reservation
      if (recorded_bounty_id != bounty_id) {
        // Get the bounty lock to check who claimed it
        switch (_credentials_canister_id) {
          case (null) {};
          case (?id) {
            let auditHub : AuditHub.Service = actor (Principal.toText(id));
            let lock_opt = await auditHub.get_bounty_lock(recorded_bounty_id);
            switch (lock_opt) {
              case (?lock) {
                if (Principal.equal(lock.claimant, msg.caller)) {
                  return #Error(#Generic("You have already participated in the verification of this WASM. Each verifier can only submit one attestation per WASM."));
                };
              };
              case (null) {};
            };
          };
        };
      };
    };
    // --- END NEW CHECK ---

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

    // --- FILE THE ATTESTATION (after all checks pass) ---
    let attestation_result = await icrc126().icrc126_file_attestation(msg.caller, req);

    // Only proceed with consensus tracking if attestation was successful
    switch (attestation_result) {
      case (#Error(e)) { return attestation_result };
      case (#Ok(_)) {};
    };

    // --- NOW track progress for majority consensus ---
    if (audit_type == "build_reproducibility_v1") {
      // --- NEW: Majority Consensus Logic (5 of 9) ---
      // Re-read verification progress AFTER await to get latest state
      let latest_attestations = Option.get(
        BTree.get(verification_progress, Text.compare, progress_key),
        [],
      );

      // Check if this bounty_id is already recorded
      let already_counted = Array.find<Nat>(latest_attestations, func(id) { id == bounty_id });

      if (Option.isNull(already_counted)) {
        // Add this bounty_id to the list of successful attestations
        let updated_attestations = Array.append(latest_attestations, [bounty_id]);
        ignore BTree.insert(verification_progress, Text.compare, progress_key, updated_attestations);

        Debug.print(
          "WASM " # req.wasm_id # " now has " #
          Nat.toText(updated_attestations.size()) # " of " #
          Nat.toText(REQUIRED_VERIFIERS) # " successful verifications"
        );

        // Check if we've reached majority threshold (5 of 9)
        if (updated_attestations.size() >= MAJORITY_THRESHOLD) {
          Debug.print("Majority consensus reached! Finalizing WASM " # req.wasm_id # " as Verified");

          let finalization_meta : ICRC126.ICRC16Map = [
            ("auditor", #Principal(msg.caller)),
            ("bounty_id", #Nat(bounty_id)),
            ("total_verifications", #Nat(updated_attestations.size())),
            ("verification_method", #Text("majority_consensus_5_of_9")),
          ];
          ignore await _finalize_verification(req.wasm_id, #Verified, finalization_meta);
        };
      } else {
        Debug.print("Bounty " # Nat.toText(bounty_id) # " already counted for wasm_id " # req.wasm_id);
      };
    };

    // Check if this attestation is for tools:
    if (audit_type == "tools_v1") {
      // --- NEW: Majority Consensus Logic for tools_v1 (same as build_reproducibility_v1) ---
      // Re-read verification progress AFTER await to get latest state
      let latest_attestations = Option.get(
        BTree.get(verification_progress, Text.compare, progress_key),
        [],
      );

      // Check if this bounty_id is already recorded
      let already_counted = Array.find<Nat>(latest_attestations, func(id) { id == bounty_id });

      if (Option.isNull(already_counted)) {
        // Add this bounty_id to the list of successful attestations
        let updated_attestations = Array.append(latest_attestations, [bounty_id]);
        ignore BTree.insert(verification_progress, Text.compare, progress_key, updated_attestations);

        Debug.print(
          "WASM " # req.wasm_id # " (tools_v1) now has " #
          Nat.toText(updated_attestations.size()) # " of " #
          Nat.toText(REQUIRED_VERIFIERS) # " successful verifications"
        );

        // Check if we've reached majority threshold (5 of 9)
        if (updated_attestations.size() >= MAJORITY_THRESHOLD) {
          Debug.print("Majority consensus reached for tools_v1! Finalizing WASM " # req.wasm_id);

          let finalization_meta : ICRC126.ICRC16Map = [
            ("auditor", #Principal(msg.caller)),
            ("bounty_id", #Nat(bounty_id)),
            ("total_verifications", #Nat(updated_attestations.size())),
            ("verification_method", #Text("majority_consensus_5_of_9")),
            ("audit_type", #Text("tools_v1")),
          ];
          ignore await _finalize_verification(req.wasm_id, #Verified, finalization_meta);
        };
      } else {
        Debug.print("Bounty " # Nat.toText(bounty_id) # " already counted for wasm_id " # req.wasm_id # " (tools_v1)");
      };

      // 3. Whitelist the WASM to use the usage tracker canister
      switch (_usage_tracker_canister_id) {
        case (null) { Debug.trap("Usage Tracker canister is not configured.") };
        case (?id) {
          let usage_tracker : UsageTracker.Service = actor (Principal.toText(id));
          ignore await usage_tracker.add_approved_wasm_hash(req.wasm_id);
        };
      };
    };
    // --- END NEW LOGIC ---

    return attestation_result;
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

    // Extract audit_type early so we can use it for progress tracking
    let audit_type = switch (AppStore.getICRC16TextOptional(metadata, "126:audit_type")) {
      case (?t) { t };
      case (null) {
        return #Error(#Generic("Divergence metadata must include '126:audit_type'."));
      };
    };

    // --- CRITICAL: Check auditor hasn't already filed BEFORE any async calls ---
    switch (_check_auditor_has_not_filed(req.wasm_id, msg.caller, audit_type)) {
      case (#Error(err)) {
        Debug.print("🚫 Mutual exclusion check failed: " # err);
        return #Error(#Generic(err));
      };
      case (#Ok) {};
    };

    // Create composite key for progress tracking (wasm_id::audit_type)
    let progress_key = _make_progress_key(req.wasm_id, audit_type);

    // --- NEW: Check if caller has already participated in this WASM verification ---
    let existing_attestations = Option.get(
      BTree.get(verification_progress, Text.compare, progress_key),
      [],
    );
    let existing_divergences = Option.get(
      BTree.get(divergence_progress, Text.compare, progress_key),
      [],
    );

    // --- CRITICAL: Check if THIS SPECIFIC BOUNTY already filed anything ---
    // This prevents race conditions where same bounty submits attestation+divergence concurrently
    let bounty_in_attestations = Array.find<Nat>(existing_attestations, func(id) { id == bounty_id });
    let bounty_in_divergences = Array.find<Nat>(existing_divergences, func(id) { id == bounty_id });

    if (Option.isSome(bounty_in_attestations)) {
      Debug.print("ERROR: Bounty " # Nat.toText(bounty_id) # " already filed attestation");
      return #Error(#Generic("This bounty has already filed an attestation - cannot file divergence"));
    };
    if (Option.isSome(bounty_in_divergences)) {
      Debug.print("ERROR: Bounty " # Nat.toText(bounty_id) # " already filed divergence");
      return #Error(#Generic("This bounty has already filed a divergence"));
    };

    // Check if caller already has a bounty recorded for this WASM (excluding current bounty)
    let all_recorded_bounties = Array.append(existing_attestations, existing_divergences);
    for (recorded_bounty_id in all_recorded_bounties.vals()) {
      // Skip checking the current bounty - verifier is allowed to file for their own reservation
      if (recorded_bounty_id != bounty_id) {
        // Get the bounty lock to check who claimed it
        switch (_credentials_canister_id) {
          case (null) {};
          case (?id) {
            let auditHub : AuditHub.Service = actor (Principal.toText(id));
            let lock_opt = await auditHub.get_bounty_lock(recorded_bounty_id);
            switch (lock_opt) {
              case (?lock) {
                if (Principal.equal(lock.claimant, msg.caller)) {
                  return #Error(#Generic("You have already participated in the verification of this WASM. Each verifier can only submit one report per WASM."));
                };
              };
              case (null) {};
            };
          };
        };
      };
    };
    // --- END NEW CHECK ---

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

    // Only proceed with consensus tracking if divergence was successful
    switch (result) {
      case (#Error(e)) { return result };
      case (#Ok(_)) {};
    };

    // --- NEW LOGIC: Majority Consensus for Divergence Reports (5 of 9) ---
    // Re-read divergence progress AFTER await to get latest state
    let latest_divergences = Option.get(
      BTree.get(divergence_progress, Text.compare, progress_key),
      [],
    );

    // Check if this bounty_id is already recorded
    let already_counted = Array.find<Nat>(latest_divergences, func(id) { id == bounty_id });

    if (Option.isNull(already_counted)) {
      // Add this bounty_id to the list of divergence reports
      let updated_divergences = Array.append(latest_divergences, [bounty_id]);
      ignore BTree.insert(divergence_progress, Text.compare, progress_key, updated_divergences);

      Debug.print(
        "WASM " # req.wasm_id # " now has " #
        Nat.toText(updated_divergences.size()) # " of " #
        Nat.toText(REQUIRED_VERIFIERS) # " divergence reports"
      );

      // Check if we've reached majority threshold (5 of 9 report divergence)
      if (updated_divergences.size() >= MAJORITY_THRESHOLD) {
        Debug.print("Majority divergence consensus reached! Finalizing WASM " # req.wasm_id # " as Rejected");

        let finalization_meta : ICRC126.ICRC16Map = [
          ("auditor", #Principal(msg.caller)),
          ("bounty_id", #Nat(bounty_id)),
          ("total_divergences", #Nat(updated_divergences.size())),
          ("reason", #Text(req.divergence_report)),
          ("rejection_method", #Text("majority_consensus_5_of_9_divergence")),
        ];
        let _ = await _finalize_verification(req.wasm_id, #Rejected, finalization_meta);
      };
    } else {
      Debug.print("Bounty " # Nat.toText(bounty_id) # " already counted as divergence for wasm_id " # req.wasm_id);
    };
    // --- END NEW LOGIC ---

    return result;
  };

  // --- API Key Variants for Verifier Bots ---

  /**
   * File an attestation using an API key instead of caller identity.
   * This allows verifier bots to authenticate without managing identities.
   */
  public shared func icrc126_file_attestation_with_api_key(
    api_key : Text,
    req : ICRC126Service.AttestationRequest,
  ) : async ICRC126Service.AttestationResult {
    // 1. Validate API key with audit hub
    switch (_credentials_canister_id) {
      case (null) {
        return #Error(#Generic("Audit Hub is not configured."));
      };
      case (?audit_hub_id) {
        let auditHub : AuditHub.Service = actor (Principal.toText(audit_hub_id));

        let validation_result = await auditHub.validate_api_key(api_key);
        let verifier_principal = switch (validation_result) {
          case (#err(msg)) {
            return #Error(#Generic("Invalid API key: " # msg));
          };
          case (#ok(principal)) { principal };
        };

        // 2. Get bounty_id from metadata
        let bounty_id = switch (AuditHub.get_bounty_id_from_metadata(req.metadata)) {
          case (null) {
            return #Error(#Generic("Attestation metadata must include a 'bounty_id'."));
          };
          case (?id) { id };
        };

        // 2.5. Extract audit_type early
        let audit_type = switch (AppStore.getICRC16TextOptional(req.metadata, "126:audit_type")) {
          case (?t) { t };
          case (null) {
            return #Error(#Generic("Attestation metadata must include '126:audit_type'."));
          };
        };

        // Create composite key for progress tracking (wasm_id::audit_type)
        let progress_key = _make_progress_key(req.wasm_id, audit_type);

        // 3. Check authorization FIRST (before checking participation)
        // This ensures we check the LATEST state after async calls
        Debug.print("🔐 [mcp_registry] Checking authorization for API key attestation:");
        Debug.print("   bounty_id: " # debug_show (bounty_id));
        Debug.print("   verifier_principal: " # debug_show (verifier_principal));
        Debug.print("   wasm_id: " # req.wasm_id);

        let is_authorized = await auditHub.is_bounty_ready_for_collection(bounty_id, verifier_principal);

        Debug.print("   is_authorized result: " # debug_show (is_authorized));

        if (not is_authorized) {
          Debug.print("   ❌ Authorization failed - returning Unauthorized error");
          return #Error(#Unauthorized);
        };

        Debug.print("   ✅ Authorization successful - proceeding with attestation");

        // 4. Check ICRC126 storage directly - this is the source of truth
        let state = icrc126().state;
        let audit_records = Option.get(Map.get(state.audits, Map.thash, req.wasm_id), []);

        // 4.1 Check if this specific bounty has already filed an attestation
        let has_actual_attestation = Array.find<ICRC126.AuditRecord>(
          audit_records,
          func(record) {
            switch (record) {
              case (#Attestation(att)) {
                let att_bounty_id = AuditHub.get_bounty_id_from_metadata(att.metadata);
                Option.isSome(att_bounty_id) and att_bounty_id == ?bounty_id;
              };
              case (_) { false };
            };
          },
        );
        if (Option.isSome(has_actual_attestation)) {
          Debug.print("   ❌ Bounty " # Nat.toText(bounty_id) # " already has attestation in ICRC126 storage");
          return #Error(#Generic("This bounty has already filed an attestation for this WASM."));
        };

        // 4.2 Check if this specific bounty has already filed a divergence
        let has_actual_divergence = Array.find<ICRC126.AuditRecord>(
          audit_records,
          func(record) {
            switch (record) {
              case (#Divergence(div)) {
                switch (div.metadata) {
                  case (?meta) {
                    let div_bounty_id = AuditHub.get_bounty_id_from_metadata(meta);
                    Option.isSome(div_bounty_id) and div_bounty_id == ?bounty_id;
                  };
                  case (null) { false };
                };
              };
              case (_) { false };
            };
          },
        );
        if (Option.isSome(has_actual_divergence)) {
          Debug.print("   ❌ Bounty " # Nat.toText(bounty_id) # " already has divergence in ICRC126 storage");
          return #Error(#Generic("This bounty has already filed a divergence for this WASM."));
        };

        // 4.3 Check if THIS VERIFIER has already participated with a DIFFERENT bounty (mutual exclusion)
        // Scan actual ICRC126 storage to find all work filed by this verifier for this WASM+audit_type
        let verifier_already_participated = Array.find<ICRC126.AuditRecord>(
          audit_records,
          func(record) {
            switch (record) {
              case (#Attestation(att)) {
                // Check if this attestation is from the same verifier and same audit type
                if (Principal.equal(att.auditor, verifier_principal) and att.audit_type == audit_type) {
                  // Get the bounty_id from this attestation
                  let att_bounty_id = AuditHub.get_bounty_id_from_metadata(att.metadata);
                  // If it's a different bounty than the current one, they already participated
                  switch (att_bounty_id) {
                    case (?bid) { bid != bounty_id };
                    case (null) { false };
                  };
                } else {
                  false;
                };
              };
              case (#Divergence(div)) {
                // Check if this divergence is from the same verifier
                if (Principal.equal(div.reporter, verifier_principal)) {
                  // Get the bounty_id from this divergence
                  switch (div.metadata) {
                    case (?meta) {
                      let div_bounty_id = AuditHub.get_bounty_id_from_metadata(meta);
                      switch (div_bounty_id) {
                        case (?bid) { bid != bounty_id };
                        case (null) { false };
                      };
                    };
                    case (null) { false };
                  };
                } else {
                  false;
                };
              };
            };
          },
        );
        if (Option.isSome(verifier_already_participated)) {
          Debug.print("   ❌ Verifier " # Principal.toText(verifier_principal) # " already participated in this WASM verification");
          return #Error(#Generic("You have already participated in the verification of this WASM. Each verifier can only submit one attestation per WASM."));
        };

        // 5. CRITICAL: Check verifier hasn't already filed BEFORE any further async calls
        switch (_check_auditor_has_not_filed(req.wasm_id, verifier_principal, audit_type)) {
          case (#Error(err)) {
            Debug.print("   🚫 Mutual exclusion check failed: " # err);
            return #Error(#Generic(err));
          };
          case (#Ok) {
            Debug.print("   ✅ Mutual exclusion check passed");
          };
        };

        // 6. Check if WASM has already been finalized
        // NOTE: We still allow attestations after finalization so verifiers can complete
        // their work and unlock their stakes. We just don't count them toward consensus.
        let is_finalized = Option.isSome(BTree.get(finalization_log, Text.compare, req.wasm_id));
        if (is_finalized) {
          Debug.print("   ℹ️  WASM " # req.wasm_id # " already finalized - accepting attestation but not counting toward consensus");
        };

        // 7. File the attestation with the verifier principal
        let result = await icrc126().icrc126_file_attestation(verifier_principal, req);

        Debug.print("   📝 icrc126_file_attestation result: " # debug_show (result));

        // 8. Only track progress if attestation was successfully recorded
        switch (result) {
          case (#Error(e)) {
            Debug.print("   ❌ Failed to record attestation in ICRC126: " # debug_show (e));
            return result; // Return error early, don't track progress
          };
          case (#Ok(_)) {
            Debug.print("   ✅ Attestation successfully recorded in ICRC126");
            Debug.print("   💰 Verifier can now claim bounty " # Nat.toText(bounty_id) # " from audit_hub");
          };
        };

        // 9. Track progress and check for consensus (only if not already finalized)
        if (not is_finalized) {
          // Re-read existing attestations AFTER await to get latest state
          let latest_attestations = Option.get(
            BTree.get(verification_progress, Text.compare, progress_key),
            [],
          );

          let already_counted = Array.find<Nat>(latest_attestations, func(id) { id == bounty_id });
          if (Option.isNull(already_counted)) {
            let updated_attestations = Array.append(latest_attestations, [bounty_id]);
            ignore BTree.insert(verification_progress, Text.compare, progress_key, updated_attestations);

            Debug.print(
              "WASM " # req.wasm_id # " now has " #
              Nat.toText(updated_attestations.size()) # " of " #
              Nat.toText(REQUIRED_VERIFIERS) # " attestations"
            );

            if (updated_attestations.size() >= MAJORITY_THRESHOLD) {
              Debug.print("Majority consensus reached! Finalizing WASM " # req.wasm_id);
              let finalization_meta : ICRC126.ICRC16Map = [
                ("auditor", #Principal(verifier_principal)),
                ("bounty_id", #Nat(bounty_id)),
                ("total_attestations", #Nat(updated_attestations.size())),
              ];
              let _ = await _finalize_verification(req.wasm_id, #Verified, finalization_meta);
            };
          };
        } else {
          // WASM is finalized, but we need to track this late attestation for participation counting
          // Add it to verification_progress even though it didn't affect the outcome
          let latest_attestations = Option.get(
            BTree.get(verification_progress, Text.compare, progress_key),
            [],
          );
          let already_counted = Array.find<Nat>(latest_attestations, func(id) { id == bounty_id });
          if (Option.isNull(already_counted)) {
            let updated_attestations = Array.append(latest_attestations, [bounty_id]);
            ignore BTree.insert(verification_progress, Text.compare, progress_key, updated_attestations);
            Debug.print("   📊 Late attestation tracked. Total attestations: " # Nat.toText(updated_attestations.size()));
          };

          // Check if tools_v1 audit is now complete (in late attestation path)
          let current_attestations = Option.get(
            BTree.get(verification_progress, Text.compare, progress_key),
            [],
          );
          if (audit_type == "tools_v1" and current_attestations.size() >= REQUIRED_VERIFIERS) {
            Debug.print("🎉 tools_v1 audit complete (" # Nat.toText(current_attestations.size()) # "/" # Nat.toText(REQUIRED_VERIFIERS) # "). Marking job as complete.");
            switch (_credentials_canister_id) {
              case (?audit_hub_id) {
                let auditHub : AuditHub.Service = actor (Principal.toText(audit_hub_id));
                let mark_result = await auditHub.mark_verification_complete(req.wasm_id, audit_type);
                Debug.print("   ✅ Job cleanup result: " # debug_show (mark_result));
              };
              case (null) {
                Debug.print("⚠️ Cannot mark tools_v1 complete: audit_hub not configured");
              };
            };
          };

          // Check if all verifiers have now participated to trigger stake slashing
          let latest_divergences = Option.get(
            BTree.get(divergence_progress, Text.compare, progress_key),
            [],
          );
          let total_participated = latest_attestations.size() + latest_divergences.size() + 1; // +1 for current submission

          Debug.print("   📊 Total participated: " # Nat.toText(total_participated) # " of " # Nat.toText(REQUIRED_VERIFIERS));

          if (total_participated >= REQUIRED_VERIFIERS) {
            Debug.print("🎉 All " # Nat.toText(REQUIRED_VERIFIERS) # " verifiers have now participated! Processing stakes...");
            // Get the outcome from finalization log
            let finalization_record = BTree.get(finalization_log, Text.compare, req.wasm_id);
            switch (finalization_record) {
              case (?record) {
                ignore await _handle_consensus_outcome(req.wasm_id, record.outcome, audit_type);
              };
              case (null) { /* Should not happen */ };
            };
          };
        };

        return result;
      };
    };
  };

  /**
 * File a divergence report using an API key instead of caller identity.
 * This allows verifier bots to authenticate without managing identities.
 */
  public shared func icrc126_file_divergence_with_api_key(
    api_key : Text,
    req : ICRC126Service.DivergenceReportRequest,
  ) : async ICRC126Service.DivergenceResult {
    // 1. Validate API key with audit hub
    switch (_credentials_canister_id) {
      case (null) {
        return #Error(#Generic("Audit Hub is not configured."));
      };
      case (?audit_hub_id) {
        let auditHub : AuditHub.Service = actor (Principal.toText(audit_hub_id));

        let validation_result = await auditHub.validate_api_key(api_key);
        let verifier_principal = switch (validation_result) {
          case (#err(msg)) {
            return #Error(#Generic("Invalid API key: " # msg));
          };
          case (#ok(principal)) { principal };
        };

        // 2. Get bounty_id from metadata
        let metadata = switch (req.metadata) { case null []; case (?m) m };
        let bounty_id = switch (AuditHub.get_bounty_id_from_metadata(metadata)) {
          case (null) {
            return #Error(#Generic("Divergence metadata must include a 'bounty_id'."));
          };
          case (?id) { id };
        };

        // 2.5. Extract audit_type early
        let audit_type = switch (AppStore.getICRC16TextOptional(metadata, "126:audit_type")) {
          case (?t) { t };
          case (null) {
            return #Error(#Generic("Divergence metadata must include '126:audit_type'."));
          };
        };

        // Create composite key for progress tracking (wasm_id::audit_type)
        let progress_key = _make_progress_key(req.wasm_id, audit_type);

        // 3. Check if verifier has already participated (excluding current bounty)
        let existing_attestations = Option.get(
          BTree.get(verification_progress, Text.compare, progress_key),
          [],
        );
        let existing_divergences = Option.get(
          BTree.get(divergence_progress, Text.compare, progress_key),
          [],
        );

        let all_recorded_bounties = Array.append(existing_attestations, existing_divergences);
        for (recorded_bounty_id in all_recorded_bounties.vals()) {
          // Skip checking the current bounty - verifier is allowed to file for their own reservation
          if (recorded_bounty_id != bounty_id) {
            let lock_opt = await auditHub.get_bounty_lock(recorded_bounty_id);
            switch (lock_opt) {
              case (?lock) {
                if (Principal.equal(lock.claimant, verifier_principal)) {
                  return #Error(#Generic("You have already participated in the verification of this WASM. Each verifier can only submit one report per WASM."));
                };
              };
              case (null) {};
            };
          };
        };

        // 3.5 CRITICAL: Check if this specific bounty has already SUCCESSFULLY filed attestation OR divergence
        // This prevents race conditions where concurrent calls both pass the auditor check
        // We check the actual ICRC126 storage, not just the progress tracking array
        let bounty_in_attestations = Array.find<Nat>(existing_attestations, func(id) { id == bounty_id });
        if (Option.isSome(bounty_in_attestations)) {
          // Verify the attestation actually exists in ICRC126 storage
          let state = icrc126().state;
          let audit_records = Option.get(Map.get(state.audits, Map.thash, req.wasm_id), []);
          let has_actual_attestation = Array.find<ICRC126.AuditRecord>(
            audit_records,
            func(record) {
              switch (record) {
                case (#Attestation(att)) {
                  let att_bounty_id = AuditHub.get_bounty_id_from_metadata(att.metadata);
                  Option.isSome(att_bounty_id) and att_bounty_id == ?bounty_id;
                };
                case (_) { false };
              };
            },
          );
          if (Option.isSome(has_actual_attestation)) {
            return #Error(#Generic("This bounty has already filed an attestation for this WASM."));
          } else {
            Debug.print("   ⚠️  Bounty " # Nat.toText(bounty_id) # " in progress tracking but no actual attestation found - allowing retry");
          };
        };
        let bounty_in_divergences = Array.find<Nat>(existing_divergences, func(id) { id == bounty_id });
        if (Option.isSome(bounty_in_divergences)) {
          // Verify the divergence actually exists in ICRC126 storage
          let state = icrc126().state;
          let audit_records = Option.get(Map.get(state.audits, Map.thash, req.wasm_id), []);
          let has_actual_divergence = Array.find<ICRC126.AuditRecord>(
            audit_records,
            func(record) {
              switch (record) {
                case (#Divergence(div)) {
                  switch (div.metadata) {
                    case (?meta) {
                      let div_bounty_id = AuditHub.get_bounty_id_from_metadata(meta);
                      Option.isSome(div_bounty_id) and div_bounty_id == ?bounty_id;
                    };
                    case (null) { false };
                  };
                };
                case (_) { false };
              };
            },
          );
          if (Option.isSome(has_actual_divergence)) {
            return #Error(#Generic("This bounty has already filed a divergence for this WASM."));
          } else {
            Debug.print("   ⚠️  Bounty " # Nat.toText(bounty_id) # " in divergence tracking but no actual divergence found - allowing retry");
          };
        };

        // 4. Check authorization
        Debug.print("🔐 [mcp_registry] Checking authorization for API key divergence:");
        Debug.print("   bounty_id: " # debug_show (bounty_id));
        Debug.print("   verifier_principal: " # debug_show (verifier_principal));
        Debug.print("   wasm_id: " # req.wasm_id);

        let is_authorized = await auditHub.is_bounty_ready_for_collection(bounty_id, verifier_principal);

        Debug.print("   is_authorized result: " # debug_show (is_authorized));

        if (not is_authorized) {
          Debug.print("   ❌ Authorization failed - returning error");
          return #Error(#Generic("Unauthorized: Caller is not the authorized claimant for this bounty."));
        };

        Debug.print("   ✅ Authorization successful - proceeding with divergence report");

        // 5. CRITICAL: Check verifier hasn't already filed BEFORE any further async calls
        switch (_check_auditor_has_not_filed(req.wasm_id, verifier_principal, audit_type)) {
          case (#Error(err)) {
            Debug.print("   🚫 Mutual exclusion check failed: " # err);
            return #Error(#Generic(err));
          };
          case (#Ok) {
            Debug.print("   ✅ Mutual exclusion check passed");
          };
        };

        // 6. Check if WASM has already been finalized
        // NOTE: We still allow divergences after finalization so verifiers can complete
        // their work and unlock their stakes. We just don't count them toward consensus.
        let is_finalized = Option.isSome(BTree.get(finalization_log, Text.compare, req.wasm_id));
        if (is_finalized) {
          Debug.print("   ℹ️  WASM " # req.wasm_id # " already finalized - accepting divergence but not counting toward consensus");
        };

        // 7. File the divergence with the verifier principal
        let result = await icrc126().icrc126_file_divergence(verifier_principal, req);

        Debug.print("   📝 icrc126_file_divergence result: " # debug_show (result));

        // 8. Only track progress if divergence was successfully recorded
        switch (result) {
          case (#Error(e)) {
            Debug.print("   ❌ Failed to record divergence in ICRC126: " # debug_show (e));
            return result; // Return error early, don't track progress
          };
          case (#Ok(_)) {
            Debug.print("   ✅ Divergence successfully recorded in ICRC126");
            Debug.print("   💰 Verifier can now claim bounty " # Nat.toText(bounty_id) # " from audit_hub");
          };
        };

        // 9. Track progress and check for consensus (only if not already finalized)
        if (not is_finalized) {
          // Re-read existing divergences AFTER await to get latest state
          let latest_divergences = Option.get(
            BTree.get(divergence_progress, Text.compare, progress_key),
            [],
          );

          let already_counted = Array.find<Nat>(latest_divergences, func(id) { id == bounty_id });
          if (Option.isNull(already_counted)) {
            let updated_divergences = Array.append(latest_divergences, [bounty_id]);
            ignore BTree.insert(divergence_progress, Text.compare, progress_key, updated_divergences);

            Debug.print(
              "WASM " # req.wasm_id # " now has " #
              Nat.toText(updated_divergences.size()) # " of " #
              Nat.toText(REQUIRED_VERIFIERS) # " divergence reports"
            );

            if (updated_divergences.size() >= MAJORITY_THRESHOLD) {
              Debug.print("Majority divergence consensus reached! Finalizing WASM " # req.wasm_id # " as Rejected");
              let finalization_meta : ICRC126.ICRC16Map = [
                ("auditor", #Principal(verifier_principal)),
                ("bounty_id", #Nat(bounty_id)),
                ("total_divergences", #Nat(updated_divergences.size())),
                ("reason", #Text(req.divergence_report)),
                ("rejection_method", #Text("majority_consensus_5_of_9_divergence")),
              ];
              let _ = await _finalize_verification(req.wasm_id, #Rejected, finalization_meta);
            };
          };
        } else {
          // WASM is finalized, but we need to track this late divergence for participation counting
          // Add it to divergence_progress even though it didn't affect the outcome
          let latest_divergences = Option.get(
            BTree.get(divergence_progress, Text.compare, progress_key),
            [],
          );
          let already_counted = Array.find<Nat>(latest_divergences, func(id) { id == bounty_id });
          if (Option.isNull(already_counted)) {
            let updated_divergences = Array.append(latest_divergences, [bounty_id]);
            ignore BTree.insert(divergence_progress, Text.compare, progress_key, updated_divergences);
            Debug.print("   📊 Late divergence tracked. Total divergences: " # Nat.toText(updated_divergences.size()));
          };

          // Check if all verifiers have now participated to trigger stake slashing
          let latest_attestations = Option.get(
            BTree.get(verification_progress, Text.compare, progress_key),
            [],
          );
          let total_participated = latest_attestations.size() + latest_divergences.size() + 1; // +1 for current submission

          Debug.print("   📊 Total participated: " # Nat.toText(total_participated) # " of " # Nat.toText(REQUIRED_VERIFIERS));

          if (total_participated >= REQUIRED_VERIFIERS) {
            Debug.print("🎉 All " # Nat.toText(REQUIRED_VERIFIERS) # " verifiers have now participated! Processing stakes...");
            // Get the outcome from finalization log
            let finalization_record = BTree.get(finalization_log, Text.compare, req.wasm_id);
            switch (finalization_record) {
              case (?record) {
                ignore await _handle_consensus_outcome(req.wasm_id, record.outcome, audit_type);
              };
              case (null) { /* Should not happen */ };
            };
          };
        };

        return result;
      };
    };
  };

  // --- Debug / Query helpers -------------------------------------------------
  // Expose the recorded attestations and divergences for a given WASM so we can
  // verify that attestations were actually recorded. These are read-only helper
  // methods intended for debugging and tests.
  public query func get_verification_progress(wasm_id : Text, audit_type : Text) : async [Nat] {
    let progress_key = _make_progress_key(wasm_id, audit_type);
    let arr = Option.get(BTree.get(verification_progress, Text.compare, progress_key), []);
    Debug.print("Query get_verification_progress for " # progress_key # " -> " # debug_show (arr));
    arr;
  };

  public query func get_divergence_progress(wasm_id : Text, audit_type : Text) : async [Nat] {
    let progress_key = _make_progress_key(wasm_id, audit_type);
    let arr = Option.get(BTree.get(divergence_progress, Text.compare, progress_key), []);
    Debug.print("Query get_divergence_progress for " # progress_key # " -> " # debug_show (arr));
    arr;
  };

  /**
   * Check if a verifier has already participated in the verification of a specific WASM.
   * This prevents a verifier from being assigned to multiple bounties for the same WASM.
   * Used by audit_hub during bounty reservation to enforce mutual exclusion.
   *
   * @param verifier - The principal of the verifier to check
   * @param wasm_id - The WASM hash to check participation for
   * @param audit_type - The audit type (e.g., "tools_v1", "build_reproducibility_v1")
   * @returns true if verifier has filed any audit (attestation or divergence) for this WASM+audit_type
   */
  public query func has_verifier_participated_in_wasm(
    verifier : Principal,
    wasm_id : Text,
    audit_type : Text,
  ) : async Bool {
    let state = icrc126().state;
    let audit_records = Option.get(Map.get(state.audits, Map.thash, wasm_id), []);

    // Check if verifier has filed an attestation for this audit_type
    let has_attestation = Array.find<ICRC126.AuditRecord>(
      audit_records,
      func(record) {
        switch (record) {
          case (#Attestation(att)) {
            Principal.equal(att.auditor, verifier) and att.audit_type == audit_type;
          };
          case (_) { false };
        };
      },
    );

    if (Option.isSome(has_attestation)) {
      return true;
    };

    // Check if verifier has filed a divergence for this WASM
    // Note: Divergences don't have audit_type directly, so we check any divergence
    let has_divergence = Array.find<ICRC126.AuditRecord>(
      audit_records,
      func(record) {
        switch (record) {
          case (#Divergence(div)) {
            Principal.equal(div.reporter, verifier);
          };
          case (_) { false };
        };
      },
    );

    return Option.isSome(has_divergence);
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

  /**
   * Admin method to manually trigger consensus handling for stuck bounties.
   * Use this when consensus was reached but payouts didn't happen due to bugs.
   */
  public shared (msg) func admin_retrigger_consensus(wasm_id : Text, audit_type : Text) : async Result.Result<Text, Text> {
    // Check if caller is owner
    if (not Principal.equal(msg.caller, _owner)) {
      return #err("Only the owner can retrigger consensus");
    };

    // Get the finalization record to see what the outcome was
    let finalization_opt = BTree.get(finalization_log, Text.compare, wasm_id);
    switch (finalization_opt) {
      case (null) {
        return #err("No finalization record found for WASM: " # wasm_id);
      };
      case (?record) {
        Debug.print("Retriggering consensus for WASM " # wasm_id # " with outcome " # debug_show (record.outcome));

        // Retrigger the consensus outcome handling
        await _handle_consensus_outcome(wasm_id, record.outcome, audit_type);

        return #ok("Consensus retriggered successfully for " # wasm_id);
      };
    };
  };

  /**
   * Handle consensus outcome by releasing stakes for winners and slashing stakes for losers.
   * Winners: Verifiers who voted with the majority consensus
   * Losers: Verifiers who voted against the majority consensus
   */
  private func _handle_consensus_outcome(wasm_id : Text, outcome : VerificationOutcome, audit_type : Text) : async () {
    // Create composite key for progress tracking (wasm_id::audit_type)
    let progress_key = _make_progress_key(wasm_id, audit_type);

    // Get the winning and losing attestation lists
    let winning_attestations = switch (outcome) {
      case (#Verified) {
        Option.get(BTree.get(verification_progress, Text.compare, progress_key), []);
      };
      case (#Rejected) {
        Option.get(BTree.get(divergence_progress, Text.compare, progress_key), []);
      };
    };

    let losing_attestations = switch (outcome) {
      case (#Verified) {
        // If verified, divergence reports are the losers
        Option.get(BTree.get(divergence_progress, Text.compare, progress_key), []);
      };
      case (#Rejected) {
        // If rejected, success attestations are the losers
        Option.get(BTree.get(verification_progress, Text.compare, progress_key), []);
      };
    };

    // Check if all 9 verifiers have participated before processing stakes
    // NOTE: Bounties are paid immediately when submitted, but stakes remain locked
    // until all verifiers participate so we can properly slash the losers
    let total_participated = winning_attestations.size() + losing_attestations.size();
    if (total_participated < REQUIRED_VERIFIERS) {
      Debug.print(
        "⏳ Consensus reached but only " # Nat.toText(total_participated) # " of " #
        Nat.toText(REQUIRED_VERIFIERS) # " verifiers have participated. " #
        "Waiting for remaining " # Nat.toText(REQUIRED_VERIFIERS - total_participated) #
        " verifiers before releasing/slashing stakes."
      );
      return; // Exit early - don't process stakes yet
    };

    Debug.print(
      "✅ All " # Nat.toText(REQUIRED_VERIFIERS) # " verifiers have participated. " #
      "Processing stake releases for winners and slashing for losers..."
    );

    // Get audit hub reference
    let auditHub : ?AuditHub.Service = switch (_credentials_canister_id) {
      case (null) { null };
      case (?id) { ?(actor (Principal.toText(id)) : AuditHub.Service) };
    };

    switch (auditHub) {
      case (null) {
        Debug.print("Cannot handle consensus outcome: Audit Hub not configured");
        return;
      };
      case (?hub) {
        // Release stakes for winners (bounties were already paid when they submitted)
        for (bounty_id in winning_attestations.vals()) {
          try {
            let release_result = await hub.release_stake(bounty_id);
            switch (release_result) {
              case (#ok(_)) {
                Debug.print("Released stake for winning bounty " # Nat.toText(bounty_id));
              };
              case (#err(e)) {
                Debug.print("Error releasing stake for bounty " # Nat.toText(bounty_id) # ": " # e);
              };
            };
          } catch (e) {
            Debug.print("Exception releasing stake for bounty " # Nat.toText(bounty_id) # ": " # Error.message(e));
          };
        };

        // Slash stakes for losers (they were wrong - penalize bad verifiers)
        for (bounty_id in losing_attestations.vals()) {
          try {
            let result = await hub.slash_stake_for_incorrect_consensus(bounty_id);
            switch (result) {
              case (#ok(_)) {
                Debug.print("Slashed stake for losing bounty " # Nat.toText(bounty_id) # " (incorrect consensus)");
              };
              case (#err(e)) {
                Debug.print("Error slashing stake for bounty " # Nat.toText(bounty_id) # ": " # e);
              };
            };
          } catch (e) {
            Debug.print("Exception slashing stake for bounty " # Nat.toText(bounty_id) # ": " # Error.message(e));
          };
        };
      };
    };
  };

  private func _finalize_verification(
    wasm_id : Text,
    outcome : VerificationOutcome,
    metadata : ICRC126.ICRC16Map,
  ) : async Nat {
    // 1. Authorization check is no longer needed as this is an internal function.

    // Extract audit_type from metadata for consensus handling
    let audit_type = switch (AppStore.getICRC16TextOptional(metadata, "audit_type")) {
      case (?t) { t };
      case (null) { "build_reproducibility_v1" }; // Default for legacy
    };

    // 2. Create and store the finalization record.
    let record : FinalizationRecord = {
      outcome = outcome;
      timestamp = Time.now();
      metadata = metadata;
    };
    ignore BTree.insert(finalization_log, Text.compare, wasm_id, record);

    // 2.5. Handle consensus penalties - slash stakes of verifiers on the losing side
    await _handle_consensus_outcome(wasm_id, outcome, audit_type);

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

                  let deployment_type = Option.get(AppStore.getICRC16TextOptional(request_record.metadata, "deployment_type"), "global");
                  if (deployment_type != "global") {
                    Debug.print("Auto-deployment skipped: deployment_type is '" # deployment_type # "', not 'global'.");
                    return trx_id;
                  };

                  // --- c. Decode wasm_id and construct the request ---
                  let wasm_hash : Blob = switch (Base16.decode(wasm_id)) {
                    case (?b) { b };
                    case (null) { return trx_id; /* Should not happen */ };
                  };

                  let state = icrc118wasmregistry().state;
                  // Find the canister type by its namespace using the library's internal map.
                  let owner = switch (BTree.get(state.canister_types, Text.compare, namespace)) {
                    case (null) {
                      Debug.print("Internal error: Canister type not found for namespace " # namespace);
                      return trx_id;
                    }; // Should not happen if the namespace is valid.
                    case (?canister_type) {
                      if (canister_type.controllers.size() == 0) {
                        // This should never happen
                        Debug.print("Cannot determine owner: No controllers defined for canister type " # namespace);
                        return trx_id;
                      } else {
                        // For simplicity, we take the first controller as the owner.
                        // In a real-world scenario, this logic might be more complex.
                        canister_type.controllers[0];
                      };
                    };
                  };

                  let deploy_request : Orchestrator.InternalDeployRequest = {
                    namespace = namespace;
                    hash = wasm_hash;
                    owner = owner;
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

    // Notify audit hub that verification is complete for this specific audit type
    switch (_credentials_canister_id) {
      case (?audit_hub_id) {
        let auditHub : AuditHub.Service = actor (Principal.toText(audit_hub_id));

        try {
          let result = await auditHub.mark_verification_complete(wasm_id, audit_type);

          switch (result) {
            case (#ok()) {
              Debug.print("Successfully marked " # audit_type # " verification complete in audit hub for " # wasm_id);
            };
            case (#err(e)) {
              Debug.print("Warning: Failed to mark verification complete in audit hub: " # e);
            };
          };
        } catch (e) {
          Debug.print("Exception notifying audit hub of completion: " # Error.message(e));
        };
      };
      case (null) {
        Debug.print("Audit hub not configured - skipping completion notification");
      };
    };

    return trx_id;
  };

  /**
   * [OWNER-ONLY] Manually re-triggers the deployment process for a given WASM.
   * This is a utility function for debugging failed automated deployments without
   * needing to re-run the entire verification and attestation lifecycle.
   *
   * @param wasm_id The hex-encoded SHA256 hash of the WASM to deploy.
   * @returns An empty Ok(()) on success, or a Text error on failure.
   */
  public shared ({ caller }) func retrigger_deployment(wasm_id : Text) : async Result.Result<(), Text> {
    // --- 1. Security: Ensure only the owner can call this ---
    if (caller != _owner) {
      return #err("Unauthorized: Only the owner can retrigger deployments.");
    };

    // --- 2. Pre-flight Checks ---
    // a. Ensure the orchestrator is configured.
    let orc_id = switch (_orchestrator_canister_id) {
      case (?id) { id };
      case (null) { return #err("Orchestrator is not configured.") };
    };

    // b. Ensure the WASM has actually been verified.
    switch (BTree.get(finalization_log, Text.compare, wasm_id)) {
      case (null) { return #err("WASM not found in finalization log.") };
      case (?record) {
        if (record.outcome != #Verified) {
          return #err("Cannot deploy: WASM is not in a 'Verified' state.");
        };
      };
    };

    // --- 3. Replicate the Trigger Logic from _finalize_verification ---
    // a. Find the namespace for this WASM.
    let namespace = switch (BTree.get(wasm_to_namespace_map, Text.compare, wasm_id)) {
      case (?ns) { ns };
      case (null) { return #err("Namespace not found for this WASM.") };
    };

    // b. Decode the wasm_id back into a Blob.
    let wasm_hash : Blob = switch (Base16.decode(wasm_id)) {
      case (?b) { b };
      case (null) { return #err("Invalid wasm_id format (not valid hex).") };
    };

    // c. Determine the owner (developer) from the canister type controllers.
    let state = icrc118wasmregistry().state;
    let developer_owner = switch (BTree.get(state.canister_types, Text.compare, namespace)) {
      case (null) {
        return #err("Internal error: Canister type not found for namespace.");
      };
      case (?canister_type) {
        if (canister_type.controllers.size() == 0) {
          return #err("Cannot determine owner: No controllers defined for this canister type.");
        } else {
          canister_type.controllers[0]; // Take the first controller as the owner.
        };
      };
    };

    // d. Construct the deployment request.
    let deploy_request : Orchestrator.InternalDeployRequest = {
      namespace = namespace;
      hash = wasm_hash;
      owner = developer_owner;
    };

    // --- 4. Make the Call to the Orchestrator ---
    Debug.print("Owner manually retriggering deployment for namespace " # namespace);
    try {
      let orchestrator : Orchestrator.Service = actor (Principal.toText(orc_id));
      ignore orchestrator.internal_deploy_or_upgrade(deploy_request);
      return #ok(());
    } catch (e) {
      let err_msg = "Failed to call orchestrator: " # Error.message(e);
      Debug.print(err_msg);
      return #err(err_msg);
    };
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

  /**
   * Fetches the full WASM record for a given hash.
   * This includes the `created` timestamp which is not available in CanisterVersion.
   */
  private func _get_wasm_by_hash(wasm_hash : Blob) : ?Service.Wasm {
    let results = icrc118wasmregistry().icrc118_get_wasms({
      filter = ?[#hash(wasm_hash)];
      prev = null;
      take = ?1;
    });
    if (results.size() == 1) {
      return ?results[0];
    };
    return null;
  };

  // --- PRIVATE HELPER: Encapsulates the logic for building a single listing ---
  // This takes a CanisterType and returns a fully formed AppListing, or null if it shouldn't be listed.
  private func _build_listing_for_canister_type(canister_type : ICRC118WasmRegistry.CanisterType) : ?AppStore.AppListing {
    // 1. Find the latest version for this canister type.
    if (canister_type.versions.size() == 0) {
      Debug.print("Canister type " # canister_type.canister_type_namespace # " has no versions.");
      return null; // No versions, so nothing to list.
    };

    var latest_version = canister_type.versions[0];
    var has_any_verified_version = _is_wasm_verified(Base16.encode(latest_version.calculated_hash));

    // Check all versions, updating latest and accumulating verification
    for (v in canister_type.versions.vals()) {
      if (ICRC118WasmRegistry.canisterVersionCompare(v, latest_version) == #greater) {
        latest_version := v;
      };
      if (_is_wasm_verified(Base16.encode(v.calculated_hash))) {
        has_any_verified_version := true;
      };
    };

    // If you want to list the app only when at least one version is verified:
    if (not has_any_verified_version) {
      Debug.print("Canister type " # canister_type.canister_type_namespace # " has no verified versions.");
      return null;
    };

    // 2. Get the wasm_id and apply the verification gateway check.
    let wasm_id = Base16.encode(latest_version.calculated_hash);
    let is_latest_verified = _is_wasm_verified(wasm_id);

    // 3. Determine status (Pending vs. Verified) and build the listing object.
    let audit_records = _get_audit_records_for_wasm(wasm_id);
    let completed_audits = AppStore.get_completed_audit_types(audit_records);

    // Fetch the full WASM record to get the created timestamp
    let wasm_record_opt = _get_wasm_by_hash(latest_version.calculated_hash);
    let created_timestamp = switch (wasm_record_opt) {
      case (?wasm_record) { wasm_record.created };
      case (null) { 0 }; // Fallback to 0 if not found (shouldn't happen)
    };

    let verification_request = Map.get(icrc126().state.requests, Map.thash, wasm_id);
    switch (verification_request) {
      case (?req) {
        let meta = req.metadata;
        let visuals_map = AppStore.getICRC16MapOptional(meta, "visuals");

        return ?{
          // Stable app identity from the verification request
          namespace = canister_type.canister_type_namespace;
          name = AppStore.getICRC16Text(meta, "name");
          deployment_type = Option.get(AppStore.getICRC16TextOptional(meta, "deployment_type"), "global");
          description = AppStore.getICRC16Text(meta, "description");
          category = AppStore.getICRC16Text(meta, "category");
          tags = AppStore.getICRC16TextArray(meta, "tags");
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
            security_tier = AppStore.calculate_security_tier(is_latest_verified, completed_audits);
            status = if (is_latest_verified) #Verified else #Pending;
            created = created_timestamp;
          };
        };
      };
      case (null) {
        Debug.print("No verification request found for wasm_id " # wasm_id # ". Skipping listing.");
        return null;
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
    // Note: Bounties are now managed by audit_hub, not registry
    let latest_bounties : [ICRC127.Bounty] = [];

    // 4. Build the `all_versions` summary list.
    var all_versions_summary = Buffer.Buffer<AppStore.AppVersionSummary>(canister_type.versions.size());
    for (version_record in sorted_versions.vals()) {
      let wasm_id = Base16.encode(version_record.calculated_hash);
      let is_verified = _is_wasm_verified(wasm_id);
      if (is_verified) {
        let records = _get_audit_records_for_wasm(wasm_id);
        let completed_audits = AppStore.get_completed_audit_types(records);

        // Fetch the full WASM record to get the created timestamp
        let wasm_record_opt = _get_wasm_by_hash(version_record.calculated_hash);
        let created_timestamp = switch (wasm_record_opt) {
          case (?wasm_record) { wasm_record.created };
          case (null) { 0 }; // Fallback to 0 if not found (shouldn't happen)
        };

        all_versions_summary.add({
          wasm_id = wasm_id;
          version_string = _format_version_number(version_record.version_number);
          security_tier = AppStore.calculate_security_tier(true, completed_audits);
          status = #Verified;
          created = created_timestamp;
        });
      };
    };

    // 5. Assemble the detailed object for the LATEST version.
    let latest_build_info = _build_build_info(latest_audit_records);
    let is_verified = _is_wasm_verified(wasm_id_to_load);
    let status = if (is_verified) { #Verified } else { #Pending };

    // Fetch the full WASM record to get the created timestamp
    let latest_wasm_record_opt = _get_wasm_by_hash(version_to_load_record.calculated_hash);
    let latest_created_timestamp = switch (latest_wasm_record_opt) {
      case (?wasm_record) { wasm_record.created };
      case (null) { 0 }; // Fallback to 0 if not found (shouldn't happen)
    };

    let latest_version_details : AppStore.AppVersionDetails = {
      wasm_id = wasm_id_to_load;
      version_string = _format_version_number(version_to_load_record.version_number);
      status = status;
      security_tier = AppStore.calculate_security_tier(is_verified, AppStore.get_completed_audit_types(latest_audit_records));
      build_info = latest_build_info;
      tools = _get_tools_from_records(latest_audit_records);
      data_safety = _get_data_safety_from_records(latest_audit_records);
      bounties = latest_bounties;
      audit_records = latest_audit_records;
      created = latest_created_timestamp;
    };

    // 6. Assemble the stable, top-level app information.
    //    This comes from the  the verification request.
    Debug.print("Loading app details for namespace " # namespace # " using wasm_id " # wasm_id_to_load);

    let verification_request = _get_verification_request(wasm_id_to_load);
    switch (verification_request) {
      case (?req) {
        let meta = req.metadata;
        let visuals_map = AppStore.getICRC16MapOptional(meta, "visuals");
        return #ok({
          namespace = namespace;
          name = AppStore.getICRC16Text(meta, "name");
          deployment_type = Option.get(AppStore.getICRC16TextOptional(meta, "deployment_type"), "global");
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
          latest_version = latest_version_details;
          all_versions = Buffer.toArray(all_versions_summary);
        });
      };
      case (null) {
        return #err(#NotFound("Verification request not found for pending app"));
      };

    };
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

    for ((wasm_id, request) in Map.entries(all_requests)) {
      // Check if the request has been finalized (verified or rejected).
      let is_finalized = BTree.get(finalization_log, Text.compare, wasm_id) != null;

      // --- UPDATED LOGIC ---
      // Include the request if it is NOT yet finalized.
      // This means WASMs with bounties WILL show up as pending until they're verified.
      // The verifier bot can then claim those bounties when processing them.
      if (not is_finalized) {
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

  // List ALL verification requests with optional pagination
  public shared query func list_all_verification_requests(
    offset : ?Nat,
    limit : ?Nat,
  ) : async {
    requests : [ICRC126.VerificationRecord];
    total : Nat;
  } {
    let all_requests = icrc126().state.requests;
    var all_array = Buffer.Buffer<ICRC126.VerificationRecord>(0);

    // Collect all requests
    for ((wasm_id, request) in Map.entries(all_requests)) {
      all_array.add(request);
    };

    // Sort by timestamp (newest first)
    func compareRecords(a : ICRC126.VerificationRecord, b : ICRC126.VerificationRecord) : Order.Order {
      if (a.timestamp > b.timestamp) {
        return #less;
      } else if (a.timestamp < b.timestamp) {
        return #greater;
      } else {
        return #equal;
      };
    };

    var sorted_array = Array.sort<ICRC126.VerificationRecord>(Buffer.toArray(all_array), compareRecords);
    let total = sorted_array.size();

    // Apply pagination
    let start = Option.get(offset, 0);
    let page_size = Option.get(limit, total); // Default to all if no limit
    let end = Nat.min(start + page_size, total);

    let paginated = if (start >= total) {
      [];
    } else {
      Array.tabulate<ICRC126.VerificationRecord>(
        end - start,
        func(i : Nat) : ICRC126.VerificationRecord {
          sorted_array[start + i];
        },
      );
    };

    return {
      requests = paginated;
      total = total;
    };
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

  // --- NEW: Private helper to notify the search indexer ---
  private func _notify_indexer_of_update(namespace : Text, content : Text) : async () {
    // 1. Check if the indexer canister ID is configured.
    let indexer_id = switch (_search_index_canister_id) {
      case (?id) { id };
      case (null) {
        // If not configured, print a warning and do nothing.
        Debug.print("Warning: Search indexer is not configured. Skipping indexing.");
        return;
      };
    };

    // 2. Make a "fire-and-forget" call to the indexer.
    // A failure here should be logged but should NOT trap the registry.
    try {
      Debug.print("Notifying indexer for namespace: " # namespace);
      let indexer : SearchIndex.Service = actor (Principal.toText(indexer_id));
      await indexer.update_index(namespace, content);
    } catch (e) {
      Debug.print("Warning: Failed to notify indexer canister: " # Error.message(e));
    };
  };

  // Add this temporary public function to your Registry.mo for testing purposes
  public shared ({ caller }) func test_only_notify_indexer(namespace : Text, content : Text) : async () {
    // This bypasses the full publish logic and directly calls the indexer
    // It should be secured or removed for production mainnet deployment.
    if (caller != _owner) { Debug.trap("Admin only") };
    try {
      let indexer_id = switch (_search_index_canister_id) {
        case (?id) { id };
        case (null) { Debug.trap("Indexer canister not configured") };
      };
      let indexer : SearchIndex.Service = actor (Principal.toText(indexer_id));
      await indexer.update_index(namespace, content);
    } catch (e) {
      Debug.print("Warning: Failed to notify indexer canister: " # Error.message(e));
    };
  };

  /**
   * [OWNER-ONLY] Iterates through all published apps and pushes their data
   * to the search indexer to bootstrap or rebuild the index.
   *
   * NOTE: This function is designed for a small number of apps. If the registry
   * grows to hundreds or thousands of apps, this single call may exceed the
   * instruction limit and trap.
   *
   * @returns A status message indicating how many apps were successfully indexed.
   */
  public shared ({ caller }) func bootstrap_search_index() : async Result.Result<Text, Text> {
    // 1. Security: Ensure only the owner can run this.
    if (caller != _owner) {
      return #err("Unauthorized: Only the owner can run the bootstrap process.");
    };

    // 2. Ensure the indexer is configured.
    let indexer_id = switch (_search_index_canister_id) {
      case (?id) { id };
      case (null) { return #err("Search indexer canister is not configured.") };
    };

    var indexed_count : Nat = 0;
    let all_canister_types = icrc118wasmregistry().icrc118_get_canister_types({
      filter = [];
      prev = null;
      take = null;
    });

    // 3. Loop through every canister type in the registry.
    for (canister_type in all_canister_types.vals()) {
      Debug.print("Processing namespace: " # canister_type.canister_type_namespace);
      // a. Find the latest, verified version with an app_info attestation.
      // This reuses the exact same logic as your get_app_listings function.
      let listing_opt = _build_listing_for_canister_type(canister_type);

      Debug.print("Listing found: " # debug_show (Option.isSome(listing_opt)));

      switch (listing_opt) {
        case (?listing) {
          Debug.print("Found listable app: " # listing.name # " (namespace: " # listing.namespace # ")");
          // b. We found a valid, listable app. Assemble its searchable text.
          // We can pull the data directly from the `listing` object.
          let combined_text = listing.name # " " # listing.description # " " # listing.publisher # " " # Text.join(" ", listing.tags.vals());

          // c. Make the "fire-and-forget" call to the indexer.
          try {
            let indexer : SearchIndex.Service = actor (Principal.toText(indexer_id));
            await indexer.update_index(listing.namespace, combined_text);
            indexed_count += 1;
          } catch (e) {
            // Log the error for the specific app but continue the loop.
            Debug.print(
              "Warning: Failed to index namespace " # listing.namespace # ": " # Error.message(e)
            );
          };
        };
        case (null) {
          // This canister_type is not listable (e.g., not verified), so we skip it.
        };
      };
    };

    return #ok("Bootstrap complete. Successfully indexed " # Nat.toText(indexed_count) # " apps.");
  };

  //------------------- SAMPLE FUNCTION -------------------//

  public shared func hello() : async Text {
    "world!";
  };

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

  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    #v1({
      dependencies = [
        {
          key = "_credentials_canister_id";
          setter = "set_auditor_credentials_canister_id";
          canister_name = "audit_hub";
          required = true;
          current_value = _credentials_canister_id;
        },
        {
          key = "_orchestrator_canister_id";
          setter = "set_orchestrator_canister_id";
          canister_name = "mcp_orchestrator";
          required = true;
          current_value = _orchestrator_canister_id;
        },
        {
          key = "_usage_tracker_canister_id";
          setter = "set_usage_tracker_canister_id";
          canister_name = "usage_tracker";
          required = true;
          current_value = _usage_tracker_canister_id;
        },
        {
          key = "_search_index_canister_id";
          setter = "set_search_index_canister_id";
          canister_name = "search_index";
          required = true;
          current_value = _search_index_canister_id;
        },
        {
          key = "_bounty_sponsor_canister_id";
          setter = "set_bounty_sponsor_canister_id";
          canister_name = "bounty_sponsor";
          required = true;
          current_value = _bounty_sponsor_canister_id;
        },
        {
          key = "_bounty_reward_token_canister_id";
          setter = "set_bounty_reward_token_canister_id";
          canister_name = "usdc_ledger";
          required = true;
          current_value = _bounty_reward_token_canister_id;
        },
      ];
      configuration = [];
    });
  };

};
