// This file is an example canister that uses the library for this project. It is an example of how to expose the functionality of the class module to the outside world.
// It is not a complete canister and should not be used as such. It is only an example of how to use the library for this project.

import D "mo:base/Debug";

import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Base16 "mo:base16/Base16";
import ClassPlus "mo:class-plus";
import TT "mo:timer-tool";
import ICRC10 "mo:icrc10-mo";
import Log "mo:stable-local-log";
import ICRC3 "mo:icrc3-mo";
import CertTree "mo:ic-certification/CertTree";
import Blob "mo:base/Blob";
import Sha256 "mo:sha2/Sha256";
import Result "mo:base/Result";
import Map "mo:map/Map";
import { phash } "mo:map/Map";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Iter "mo:base/Iter";

import McpRegistry "McpRegistry";

import ICRC118WasmRegistry "../../../../libs/icrc118/src/service";
import System "../../../../libs/icrc120/src/system";
import ICRC120 "../../../../libs/icrc120/src";
import ICRC120Types "../../../../libs/icrc120/src/migrations/types";

shared (deployer) actor class ICRC120Canister<system>(
  args : ?{
    icrc120Args : ?ICRC120Types.Current.InitArgs;
    ttArgs : ?TT.InitArgList;
  }
) = this {

  let thisPrincipal = Principal.fromActor(this);
  stable var _owner = deployer.caller;

  let initManager = ClassPlus.ClassPlusInitializationManager(_owner, Principal.fromActor(this), true);
  let icrc120InitArgs = do ? { args!.icrc120Args! };
  let ttInitArgs : ?TT.InitArgList = do ? { args!.ttArgs! };

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

  // --- FIX 1: The stable variable to hold the registry ID ---
  stable var _mcp_registry_id : ?Principal = null;

  // --- FIX 2: A post-deployment, one-time setter for the registry ID ---
  public shared ({ caller }) func set_mcp_registry_id(registryId : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    if (_mcp_registry_id != null) {
      return #err("MCP Registry ID has already been set");
    };

    _mcp_registry_id := ?registryId;
    return #ok(());
  };

  func canAdminCanister({
    canisterId : Principal;
    caller : Principal;
  }) : async* Bool {
    switch (_mcp_registry_id) {
      case (null) {
        Debug.print("Cannot admin canister: MCP Registry ID is not set.");
        return false;
      }; // Cannot admin if registry is not set
      case (?registryId) {
        switch (Map.get(managed_canisters, phash, canisterId)) {
          case (?namespace) {
            let registry : McpRegistry.Service = actor (Principal.toText(registryId));
            switch (await registry.is_controller_of_type(namespace, caller)) {
              case (#ok(is_controller)) { return is_controller };
              case (#err(_)) { return false };
            };
          };
          case (_) {
            Debug.print("Cannot admin canister: Unknown canister.");
            return false;
          };
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
    Debug.print("Checking if canister can be installed: " # Principal.toText(canisterId));
    switch (_mcp_registry_id) {
      case (null) {
        Debug.print("Cannot install canister: MCP Registry ID is not set.");
        return false;
      }; // Cannot install if registry is not set
      case (?registryId) {
        switch (Map.get(managed_canisters, phash, canisterId)) {
          case (?namespace) {
            let registry : McpRegistry.Service = actor (Principal.toText(registryId));
            let wasm_id = Base16.encode(args.wasm_module_hash);
            let verified_check = await registry.is_wasm_verified(wasm_id);
            if (not verified_check) {
              Debug.print("Cannot install canister: Wasm module is not verified.");
              return false;
            };
            return true;
          };
          case (_) {
            Debug.print("Cannot install canister: Unknown canister.");
            return false;
          };
        };
      };
    };
  };

  stable var icrc120_migration_state : ICRC120.State = ICRC120.initialState();

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
          can_admin_canister = canAdminCanister;
          can_install_canister = ?canInstallCanister;

          get_wasm_store = func(wasm_hash : Blob) : async* Result.Result<(Principal, [Blob]), Text> {
            switch (_mcp_registry_id) {
              case (null) { return #err("MCP Registry ID has not been set.") };
              case (?registryId) {
                let registry : ICRC118WasmRegistry.Service = actor (Principal.toText(registryId));
                try {
                  let result = await registry.icrc118_get_wasms({
                    filter = ?[#hash(wasm_hash)];
                    prev = null;
                    take = null;
                  });
                  if (result.size() == 0) {
                    return #err("No Wasm found for the given hash.");
                  } else {
                    // Return the registry's ID and the list of chunk hashes
                    return #ok((registryId, result[0].chunks));
                  };
                } catch (err) {
                  return #err("Error calling get_wasms: " # Error.message(err));
                };
              };
            };
          };

          get_wasm_chunk = func(hash : Blob, chunkId : Nat, expectedHash : ?Blob) : async* Result.Result<Blob, Text> {
            switch (_mcp_registry_id) {
              case (null) { return #err("MCP Registry ID has not been set.") };
              case (?registryId) {
                let registry : ICRC118WasmRegistry.Service = actor (Principal.toText(registryId));
                // Step 1: Get the WASM metadata to find its namespace and version
                let wasm_record = try {
                  let result = await registry.icrc118_get_wasms({
                    filter = ?[#hash(hash)];
                    prev = null;
                    take = null;
                  });
                  if (result.size() == 0) {
                    return #err("No Wasm found for the given hash.");
                  } else { result[0] };
                } catch (err) {
                  return #err("Error fetching wasm metadata: " # Error.message(err));
                };

                // Step 2: Use the metadata to fetch the specific chunk
                try {
                  let result = await registry.icrc118_get_wasm_chunk({
                    canister_type_namespace = wasm_record.canister_type_namespace;
                    version_number = wasm_record.version_number;
                    hash = hash;
                    chunk_id = chunkId;
                  });

                  switch (result) {
                    case (#Ok(chunk)) {
                      switch (expectedHash) {
                        case (?expected) {
                          let sha = Sha256.fromBlob(#sha256, chunk.wasm_chunk);
                          if (expected != sha) {
                            return #err("Chunk hash does not match expected hash.");
                          } else { return #ok(chunk.wasm_chunk) };
                        };
                        case (null) {
                          return #ok(chunk.wasm_chunk);
                        };
                      };
                    };
                    case (#Err(err)) {
                      // The service type for err is just Text, so we can use it directly.
                      return #err("Error from get_wasm_chunk: " # err);
                    };
                  };
                } catch (err) {
                  return #err("Error calling get_wasm_chunk: " # Error.message(err));
                };
              };
            };
          };
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

  // --- ICRC118WasmRegistryService Endpoints ---
  public shared (msg) func register_canister(canister_id : Principal, namespace : Text) : async Result.Result<(), Text> {
    // 1. Ask the registry if the caller is a controller for the given namespace.
    // let service : Service = actor("um5iw-rqaaa-aaaaq-qaaba-cai");

    let registryId = switch (_mcp_registry_id) {
      case (null) return #err("MCP Registry ID is not set. Please set it before registering canisters.");
      case (?exists) { exists };
    };

    let registry : McpRegistry.Service = actor (Principal.toText(registryId));
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

  // Get canisters for a given namespace
  public query func get_canisters(namespace : Text) : async [Principal] {
    let canisters = Map.filter(
      managed_canisters,
      phash,
      func(key : Principal, value : Text) : Bool {
        value == namespace;
      },
    );
    return Iter.toArray(Map.keys(canisters));
  };

  //------------------- Test FUNCTION -------------------//

  public shared func hello() : async Text {
    return "world!";
  };
};
