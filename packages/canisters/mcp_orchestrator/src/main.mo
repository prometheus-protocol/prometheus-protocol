// This file is an example canister that uses the library for this project. It is an example of how to expose the functionality of the class module to the outside world.
// It is not a complete canister and should not be used as such. It is only an example of how to use the library for this project.

import D "mo:base/Debug";

import Nat "mo:base/Nat";
import Principal "mo:base/Principal";

import ClassPlus "mo:class-plus";
import TT "mo:timer-tool";
import ICRC10 "mo:icrc10-mo";
import Log "mo:stable-local-log";
import ICRC3 "mo:icrc3-mo";
import CertTree "mo:cert/CertTree";
import Blob "mo:base/Blob";
import Sha256 "mo:sha2/Sha256";
import Result "mo:base/Result";
import Map "mo:map/Map";
import { phash } "mo:map/Map";
import Debug "mo:base/Debug";

import McpRegistry "McpRegistry";

import ICRC118WasmRegistryClient "../../../../libs/icrc118/src/client";
import System "../../../../libs/icrc120/src/system";
import ICRC120 "../../../../libs/icrc120/src";
import ICRC120Types "../../../../libs/icrc120/src/migrations/types";

shared (deployer) actor class ICRC120Canister<system>(
  args : {
    icrc120Args : ?ICRC120Types.Current.InitArgs;
    ttArgs : ?TT.InitArgList;
    registryId : Principal; // The ID of the McpRegistry canister
  }
) = this {

  let thisPrincipal = Principal.fromActor(this);
  stable var _owner = deployer.caller;

  let initManager = ClassPlus.ClassPlusInitializationManager(_owner, Principal.fromActor(this), true);
  let icrc120InitArgs = do ? { args.icrc120Args! };
  let ttInitArgs : ?TT.InitArgList = do ? { args.ttArgs! };

  stable var icrc10 = ICRC10.initCollection();

  private func reportTTExecution(execInfo : TT.ExecutionReport) : Bool {
    D.print("CANISTER: TimerTool Execution: " # debug_show (execInfo));
    return false;
  };

  private func reportTTError(errInfo : TT.ErrorReport) : ?Nat {
    D.print("CANISTER: TimerTool Error: " # debug_show (errInfo));
    return null;
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
        //do any work here necessary for initialization
      }
    );
    onStorageChange = func(state : TT.State) {
      tt_migration_state := state;
    };
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

  private stable var wasm : ?Blob = null;
  private stable var wasmHash : ?Blob = null;

  stable var managed_canisters = Map.new<Principal, Text>();

  // Store the registry ID provided at initialization
  stable var _mcp_registry_id : Principal = args.registryId;

  func canAdminCanister({
    canisterId : Principal;
    caller : Principal;
  }) : async* Bool {
    switch (Map.get(managed_canisters, phash, canisterId)) {
      case (null) { return false }; // Not a managed canister
      case (?namespace) {
        // Directly call the imported canister actor
        let registry : McpRegistry.Service = actor (Principal.toText(_mcp_registry_id));

        let result = await registry.is_controller_of_type(namespace, caller);
        switch (result) {
          case (#ok(is_controller)) { return is_controller };
          case (#err(_)) { return false }; // Registry rejected the call
        };
      };
    };
  };

  private func canInstallCanister(
    {
      args;
      caller;
      canisterId;
    } : {
      // Use the types provided by the ICRC-120 library
      args : System.install_chunked_code_args;
      caller : Principal;
      canisterId : Principal;
    }
  ) : async* Bool {
    Debug.print("Checking if canister installation is authorized for " # Principal.toText(caller) # " on " # Principal.toText(canisterId));
    switch (Map.get(managed_canisters, phash, canisterId)) {
      case (null) {
        // This canister is not managed by the orchestrator.
        return false;
      };
      case (?namespace) {
        let registry : McpRegistry.Service = actor (Principal.toText(_mcp_registry_id));

        // --- CHECK 1: Is the Wasm itself verified by the DAO? ---
        // We get the hash from the new, context-rich `args` object.
        let verified_check = await registry.is_wasm_verified(args.wasm_module_hash);
        Debug.print("Wasm verified check: " # debug_show (verified_check));
        if (not verified_check) {
          // The code has not passed the final audit gate.
          return false;
        };

        // If both checks pass, the installation/upgrade is authorized.
        return true;
      };
    };
  };

  stable var icrc120_migration_state : ICRC120.State = ICRC120.initialState();

  let ICRC118Client = ICRC118WasmRegistryClient.ICRC118WasmRegistryClient(_mcp_registry_id);

  let icrc120 = ICRC120.Init<system>({
    manager = initManager;
    initialState = icrc120_migration_state;
    args = icrc120InitArgs;
    pullEnvironment = ?(
      func() : ICRC120.Environment {
        {
          tt = tt();
          advanced = null; // Add any advanced options if needed
          log = localLog();
          add_record = null;
          get_wasm_store = ICRC118Client.getWasmStore;
          get_wasm_chunk = ICRC118Client.getWasmChunk;
          can_admin_canister = canAdminCanister;
          can_install_canister = ?canInstallCanister;
        };
      }
    );

    onInitialize = ?(
      func(
        newClass : ICRC120.ICRC120
      ) : async* () {
        D.print("Initializing ICRC120 Class");
        //do any work here necessary for initialization
      }
    );

    onStorageChange = func(state : ICRC120.State) {
      icrc120_migration_state := state;
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

  // --- Expose ICRC-120 orchestration endpoints from icrc120 class through actor ---
  public shared func icrc120_metadata() : async ICRC120Types.Current.ICRC16Map {
    icrc120().icrc120_metadata();
  };
  public shared (msg) func icrc120_upgrade_to(requests : [ICRC120Types.Current.UpgradeToRequest]) : async [ICRC120Types.Current.UpgradeToResult] {
    await icrc120().icrc120_upgrade_to(msg.caller, requests);
  };
  public shared (msg) func icrc120_create_snapshot(requests : [ICRC120Types.Current.CreateSnapshotRequest]) : async [ICRC120Types.Current.CreateSnapshotResult] {
    await icrc120().icrc120_create_snapshot(msg.caller, requests);
  };
  public shared (msg) func icrc120_clean_snapshot(requests : [ICRC120Types.Current.CleanSnapshotRequest]) : async [ICRC120Types.Current.CleanSnapshotResult] {
    await icrc120().icrc120_clean_snapshot(msg.caller, requests);
  };
  public shared (msg) func icrc120_revert_snapshot(requests : [ICRC120Types.Current.RevertSnapshotRequest]) : async [ICRC120Types.Current.RevertSnapshotResult] {
    await icrc120().icrc120_revert_snapshot(msg.caller, requests);
  };
  public shared (msg) func icrc120_start_canister(requests : [ICRC120Types.Current.StartCanisterRequest]) : async [ICRC120Types.Current.StartCanisterResult] {
    await icrc120().icrc120_start_canister(msg.caller, requests);
  };
  public shared (msg) func icrc120_stop_canister(requests : [ICRC120Types.Current.StopCanisterRequest]) : async [ICRC120Types.Current.StopCanisterResult] {
    await icrc120().icrc120_stop_canister(msg.caller, requests);
  };
  public shared (msg) func icrc120_config_canister(requests : [ICRC120Types.Current.ConfigCanisterRequest]) : async [ICRC120Types.Current.ConfigCanisterResult] {
    await icrc120().icrc120_config_canister(msg.caller, requests);
  };
  public query (msg) func icrc120_get_events(input : { filter : ?ICRC120Types.Current.GetEventsFilter; prev : ?Blob; take : ?Nat }) : async [ICRC120Types.Current.OrchestrationEvent] {
    icrc120().icrc120_get_events(input);
  };
  public shared (msg) func icrc120_upgrade_finished() : async ICRC120Types.Current.UpgradeFinishedResult {
    icrc120().icrc120_upgrade_finished();
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

  // --- McpRegistry Endpoints ---
  public shared (msg) func register_canister(canister_id : Principal, namespace : Text) : async Result.Result<(), Text> {
    // 1. Ask the registry if the caller is a controller for the given namespace.
    // let service : Service = actor("um5iw-rqaaa-aaaaq-qaaba-cai");

    let registry : McpRegistry.Service = actor (Principal.toText(_mcp_registry_id));
    let permission_result = await registry.is_controller_of_type(namespace, msg.caller);

    // 2. Handle all possible outcomes from the registry call.
    switch (permission_result) {
      case (#err(registry_error)) {
        // If the registry call itself failed, propagate the error.
        return #err("Failed to check permissions with registry: " # registry_error);
      };
      case (#ok(is_controller)) {
        // 3. Check the boolean permission result.
        if (not is_controller) {
          // If the registry says the user is NOT a controller, return a clear error.
          return #err("Unauthorized: Caller is not a controller for the namespace '" # namespace # "'.");
        } else {
          // 4. SUCCESS: The caller is authorized. Perform the action.
          Map.set(managed_canisters, phash, canister_id, namespace);
          return #ok();
        };
      };
    };
  };

  //------------------- Test FUNCTION -------------------//

  public shared func hello() : async Text {
    return "world!";
  };
};
