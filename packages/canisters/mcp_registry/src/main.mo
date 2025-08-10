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

import AuditorCredentials "AuditorCredentials";

import ICRC118WasmRegistry "../../../../libs/icrc118/src";
import Service "../../../../libs/icrc118/src/service";

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
          validateCanisterTypeCreation = null;
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

  //------------------- API IMPLEMENTATION -------------------//

  public shared query func icrc10_supported_standards() : async [Service.SupportedStandard] {
    icrc118wasmregistry().icrc10_supported_standards();
  };

  public shared (msg) func icrc118_create_canister_type(reqs : [Service.CreateCanisterType]) : async [Service.CreateCanisterTypeResult] {
    d("icrc118_create_canister_type" # debug_show (reqs), "main");
    await* icrc118wasmregistry().icrc118_create_canister_type(msg.caller, reqs);
  };

  public shared (msg) func icrc118_manage_controller(reqs : [Service.ManageControllerRequest]) : async [Service.ManageControllerResult] {
    await* icrc118wasmregistry().icrc118_manage_controller(msg.caller, reqs);
  };

  public shared query func icrc118_get_wasms(request : { filter : ?[Service.GetWasmsFilter]; prev : ?Service.WasmVersionPointer; take : ?Nat }) : async [Service.Wasm] {
    d("icrc118_get_wasms" # debug_show (request), "main");
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

  public shared (msg) func test_simulate_install(canister : Principal, canister_type_namespace : Text, version : (Nat, Nat, Nat)) : async Bool {
    // Only allow in development/test (optionally restrict by caller)
    let registry = icrc118wasmregistry();
    let state = registry.state;
    let set = switch (ICRC118WasmRegistry.Map.get(state.canisterIndex, ICRC118WasmRegistry.Map.phash, canister)) {
      case (?s) s;
      case null {
        let s = ICRC118WasmRegistry.Set.new<ICRC118WasmRegistry.WasmVersionPointer>();
        ignore ICRC118WasmRegistry.Map.put(state.canisterIndex, ICRC118WasmRegistry.Map.phash, canister, s);
        s;
      };
    };
    ignore ICRC118WasmRegistry.Set.put<ICRC118WasmRegistry.WasmVersionPointer>(
      set,
      ICRC118WasmRegistry.wasmVersionTool,
      {
        canister_type_namespace = canister_type_namespace;
        version_number = version;
      },
    );
    ignore ICRC118WasmRegistry.Map.put(state.canisterIndex, ICRC118WasmRegistry.Map.phash, canister, set);
    true;
  };

  public shared query func icrc118_get_wasm_chunk(req : Service.GetWasmChunkRequest) : async Service.GetWasmChunkResponse {
    icrc118wasmregistry().icrc118_get_wasm_chunk(req);
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

  stable var _auditor_credentials : Principal = args.auditorCredentialCanisterId;

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

  // HOOK 2: Get Wasm info by its hash. This is a query and can remain as an optional.
  // Your simplified implementation using the library's filter is much better.
  public shared query func get_wasm_by_hash(hash : Blob) : async ?{
    pointer : Service.WasmVersionPointer;
    chunk_hashes : [Blob];
  } {

    // Call the underlying library function, filtering by the provided hash.
    let wasms = icrc118wasmregistry().icrc118_get_wasms({
      filter = ?[#hash(hash)];
      prev = null;
      take = null;
    });

    // The result should be an array with exactly one Wasm.
    if (wasms.size() == 1) {
      // Success! Return the chunk hashes the orchestrator needs.
      // Note: The field is `chunk_hashes`, not `chunks`.
      let wasm = wasms[0];

      return ?{
        // Add the pointer to the return object
        pointer = {
          canister_type_namespace = wasm.canister_type_namespace;
          version_number = wasm.version_number;
        };
        chunk_hashes = wasm.chunks;
      };
    } else {
      // Wasm not found or data is inconsistent. Return null as per the optional return type.
      return null;
    };
  };

  //------------------- SAMPLE FUNCTION -------------------//

  public shared func hello() : async Text {
    "world!";
  }

};
