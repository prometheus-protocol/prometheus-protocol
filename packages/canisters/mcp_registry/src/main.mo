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

import AuditorCredentials "AuditorCredentials";

import ICRC118WasmRegistry "../../../../libs/icrc118/src";
import Service "../../../../libs/icrc118/src/service";

// --- ICRC-126 INTEGRATION ---
import ICRC126 "../../../../libs/icrc126/src/lib";
import ICRC126Service "../../../../libs/icrc126/src/service";

// ICRC-118 Registry Canister exposing the full public API contract
shared (deployer) actor class ICRC118WasmRegistryCanister<system>(
  args : {
    icrc118wasmregistryArgs : ?ICRC118WasmRegistry.InitArgs;
    ttArgs : ?TT.InitArgList;
    auditorCredentialCanisterId : Principal; // The canister ID of the Auditor Credential Canister
  }
) = this {
  let thisPrincipal = Principal.fromActor(this);
  stable var _owner = deployer.caller;
  stable var _credentials_canister_id : Principal = args.auditorCredentialCanisterId;

  let initManager = ClassPlus.ClassPlusInitializationManager(_owner, thisPrincipal, true);
  let icrc118wasmregistryInitArgs = do ? { args.icrc118wasmregistryArgs! };
  let ttInitArgs : ?TT.InitArgList = do ? { args.ttArgs! };

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
            let credentials : AuditorCredentials.Service = actor (Principal.toText(_credentials_canister_id));
            let permission_result = await credentials.verify_credential(auditor, audit_type);
            return permission_result;
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

  stable var _mcp_orchestrator : ?Principal = null;

  private func _is_owner(caller : Principal) : Bool {
    Principal.equal(_owner, caller);
  };

  // The setter now returns a Result for cleaner error handling.
  public shared (msg) func set_mcp_orchestrator(canister_id : Principal) : async Result.Result<(), Text> {
    if (not _is_owner(msg.caller)) {
      return #err("Caller is not the owner of the registry");
    };
    _mcp_orchestrator := ?canister_id;
    return #ok();
  };

  // HOOK 1: Check controller. Now returns a Result instead of trapping.
  public shared (msg) func is_controller_of_type(namespace : Text, user : Principal) : async Result.Result<Bool, Text> {
    // Security Gate: Check if the caller is the registered orchestrator.
    switch (_mcp_orchestrator) {
      case (null) { return #err("MCP Orchestrator ID has not been set") };
      case (?id) {
        if (not Principal.equal(id, msg.caller)) {
          return #err("Caller is not the registered MCP Orchestrator");
        };
      };
    };

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

  // The new stable variable to store the final word on each wasm_id.
  stable var finalization_log = BTree.init<Text, FinalizationRecord>(null);

  public shared (msg) func finalize_verification(
    wasm_id : Text,
    outcome : VerificationOutcome,
    metadata : ICRC126.ICRC16Map,
  ) : async Result.Result<Nat, Text> {
    // 1. Authorization: Only the owner (DAO) can call this.
    if (not _is_owner(msg.caller)) {
      return #err("Caller is not the owner");
    };

    // 2. Check if already finalized.
    if (BTree.get(finalization_log, Text.compare, wasm_id) != null) {
      return #err("This wasm_id has already been finalized.");
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

  public shared query func is_wasm_verified(hash : Blob) : async Bool {
    let wasm_id = Base16.encode(hash);
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

  //------------------- SAMPLE FUNCTION -------------------//

  public shared func hello() : async Text {
    "world!";
  }

};
