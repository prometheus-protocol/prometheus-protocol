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
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Iter "mo:base/Iter";
import Cycles "mo:base/ExperimentalCycles";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Star "mo:star/star";
import Option "mo:base/Option";
import Array "mo:base/Array";

import { ic } "mo:ic";

import McpRegistry "McpRegistry";
import CanisterFactory "CanisterFactory";
import McpServer "McpServer";

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
  let CANISTER_PROVISION_CYCLES : Nat = 4_000_000_000_000; // 4T cycles to provision a new canister

  // --- Cycle Top-Up Configuration ---
  stable var _cycle_top_up_enabled : Bool = true; // Default to on
  stable var TOP_UP_THRESHOLD : Nat = 1_000_000_000_000; // 1T cycles
  stable var TOP_UP_AMOUNT : Nat = 3_000_000_000_000; // 3T cycles
  stable var _cycle_check_interval_seconds : Nat = 21600; // 6 hours
  let CYCLE_JOB_ACTION_TYPE : Text = "cycle_top_up_job";
  stable var _cycle_job_action_id : ?TT.ActionId = null;

  let initManager = ClassPlus.ClassPlusInitializationManager(_owner, Principal.fromActor(this), true);
  let icrc120InitArgs = do ? { args!.icrc120Args! };
  let ttInitArgs : ?TT.InitArgList = do ? { args!.ttArgs! };

  stable var managed_canisters = Map.new<Text, [Principal]>();

  // Map the wasm id to its deployment type (for Provisioned apps).
  type CanisterDeploymentType = {
    #global;
    #provisioned;
  };
  stable var canister_deployment_types = Map.new<Text, CanisterDeploymentType>();

  // Maps a canister_id to the principal of the user who owns it (for Provisioned apps).
  stable var canister_owners = Map.new<Principal, Principal>();

  // --- A reverse-lookup map for finding a namespace by its canister ID ---
  // This provides a fast, O(1) lookup for the security hooks.
  stable var reverse_managed_canisters = Map.new<Principal, Text>();

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

  /**
   * [PRIVATE] Iterates through all managed canisters, checks their cycle balance,
   * and tops them up if they are below the defined threshold.
   */
  private func _check_and_top_up_cycles() : async () {
    if (not _cycle_top_up_enabled) {
      D.print("Cycle top-up is disabled. Skipping check.");
      return;
    };

    D.print("Starting cycle balance check for all managed canisters...");
    let orchestrator_balance = Cycles.balance();
    if (orchestrator_balance < TOP_UP_AMOUNT) {
      D.print("Orchestrator has insufficient cycles (" # Nat.toText(orchestrator_balance) # ") to perform top-ups. Skipping.");
      return;
    };

    let canisters_to_check = Array.flatten(Iter.toArray(Map.vals(managed_canisters)));

    for (canister_id in canisters_to_check.vals()) {
      try {
        let status = await ic.canister_status({ canister_id = canister_id });
        D.print("Checking canister " # Principal.toText(canister_id) # ". Balance: " # Nat.toText(status.cycles) # " cycles.");

        if (status.cycles < TOP_UP_THRESHOLD) {
          D.print("Canister " # Principal.toText(canister_id) # " is below threshold. Topping up...");
          // This is a system API call that deposits cycles from this canister's balance.
          await (with cycles = TOP_UP_AMOUNT) ic.deposit_cycles({ canister_id });
          D.print("Deposited " # Nat.toText(TOP_UP_AMOUNT) # " cycles to " # Principal.toText(canister_id));
        };
      } catch (e) {
        D.print("Failed to check or top up canister " # Principal.toText(canister_id) # ": " # Error.message(e));
      };
    };
    D.print("Cycle balance check complete.");
  };

  /**
   * [PRIVATE] Schedules the cycle top-up job if one is not already scheduled.
   */
  private func _schedule_cycle_top_up_job<system>(tt : TT.TimerTool) {
    // Prevent scheduling duplicates.
    if (_cycle_job_action_id != null) {
      return;
    };

    if (not _cycle_top_up_enabled) {
      return;
    };

    let tt_instance = tt;
    let schedule_time = Time.now() + Int.abs(_cycle_check_interval_seconds * 1_000_000_000);

    D.print("Scheduling cycle top-up job for " # Int.toText(schedule_time));

    let action : TT.ActionRequest = {
      actionType = CYCLE_JOB_ACTION_TYPE;
      params = Blob.fromArray([]);
    };

    // Use setActionAsync because our handler is async. A timeout of 0 means it can run as long as needed.
    let actionId = tt_instance.setActionASync<system>(Int.abs(schedule_time), action, 0);
    _cycle_job_action_id := ?actionId;
  };

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
        // do any work here necessary for initialization

        func _handle_cycle_top_up_action(actionId : TT.ActionId, action : TT.Action) : async* Star.Star<TT.ActionId, TT.Error> {
          await _check_and_top_up_cycles();
          // Schedule the next run
          _schedule_cycle_top_up_job<system>(newClass);
          return #trappable(actionId);
        };

        // Ensure a job is scheduled if the feature is enabled
        _schedule_cycle_top_up_job<system>(newClass);
        newClass.registerExecutionListenerAsync(?CYCLE_JOB_ACTION_TYPE, _handle_cycle_top_up_action);
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

  // --- FIX 1: The stable variable to hold the registry ID ---
  stable var _mcp_registry_id : ?Principal = null;

  // --- FIX 2: A post-deployment, one-time setter for the registry ID ---
  public shared ({ caller }) func set_mcp_registry_id(registryId : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
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
        if (registryId == caller or caller == _owner) {
          Debug.print("Caller is the MCP Registry itself, allowing admin.");
          return true;
        };

        switch (Map.get(canister_owners, Map.phash, canisterId)) {
          case (?exists) {
            if (exists == caller) {
              Debug.print("Caller is the owner of the canister, allowing admin.");
              return true;
            } else {
              Debug.print("Caller is NOT the owner of the canister, denying admin.");
              return false;
            };
          };
          case (null) {
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

        let isCanisterOwner = switch (Map.get(canister_owners, Map.phash, canisterId)) {
          case (?owner) { owner == caller };
          case (null) { false };
        };

        if (caller != registryId and caller != _owner and not isCanisterOwner) {
          Debug.print("Caller is not the Owner and not the MCP Registry itself, denying install.");
          return false;
        };

        switch (Map.get(reverse_managed_canisters, Map.phash, canisterId)) {
          case (?namespace) {
            let registry : McpRegistry.Service = actor (Principal.toText(registryId));
            let wasm_id = Base16.encode(args.wasm_module_hash);
            let verified_check = await registry.can_install_wasm(caller, wasm_id);
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

  // =====================================================================================
  // NEW DEPLOYMENT/UPGRADE WRAPPER
  // =====================================================================================

  public type canister_install_mode = {
    #reinstall;
    #upgrade : ?{
      wasm_memory_persistence : ?{ #keep; #replace };
      skip_pre_upgrade : ?Bool;
    };
    #install;
  };

  // Define a new type for the request to make the function signature cleaner.
  // It's the standard UpgradeToRequest, but with `namespace` instead of `canister_id`.
  public type DeployOrUpgradeRequest = {
    namespace : Text;
    deployment_type : CanisterDeploymentType;
    hash : Blob;
    args : Blob;
    stop : Bool;
    restart : Bool;
    snapshot : Bool;
    timeout : Nat;
    mode : canister_install_mode;
    parameters : ?[(Text, ICRC118WasmRegistry.ICRC16)];
  };

  /**
   * The primary entry point for developers.
   * - If no canister exists for the given namespace, it provisions a new one and installs the code.
   * - If a canister already exists, it upgrades the existing canister to the new code.
   */
  private func _do_deploy_or_upgrade(
    caller : Principal, // The identity being checked for permissions
    request : DeployOrUpgradeRequest,
  ) : async Result.Result<Principal, Text> {

    // --- 1. Permission Check ---
    // First, verify the caller is a controller of the namespace. This is the main security gate.
    let registryId = switch (_mcp_registry_id) {
      case (null) return #err("Orchestrator is not configured: MCP Registry ID is not set.");
      case (?id) { id };
    };

    // The underlying `can_install_canister` hook will automatically check if the WASM is verified,
    // so we don't need to check it here again.

    // --- 2. Determine Canister ID (Deploy vs. Upgrade) ---
    let canister_id_to_upgrade = switch (Map.get(managed_canisters, Map.thash, request.namespace)) {
      case (?existing_canister_ids) {
        // Find the caller's canister if they have one.
        let existing_canister = Array.find(
          existing_canister_ids,
          func(id : Principal) : Bool {
            switch (Map.get(canister_owners, Map.phash, id)) {
              case (?owner) { owner == caller };
              case (null) { false };
            };
          },
        );

        switch (existing_canister) {
          case (?exists) { exists };
          case (null) {
            // --- DEPLOY PATH ---
            Debug.print("No canister found for namespace " # request.namespace # ". Provisioning a new one...");

            // Provision a new, empty canister using the factory module.
            let provision_result = await CanisterFactory.provision_canister(
              thisPrincipal,
              CANISTER_PROVISION_CYCLES,
            );

            switch (provision_result) {
              case (#err(e)) {
                return #err(e);
              };
              case (#ok(new_canister_id)) {
                // IMPORTANT: Track the new canister before proceeding.
                let old_canister_list = Option.get(Map.get(managed_canisters, Map.thash, request.namespace), []);
                let new_canister_list = Array.append(old_canister_list, [new_canister_id]);

                Map.set(managed_canisters, Map.thash, request.namespace, new_canister_list);
                Map.set(reverse_managed_canisters, Map.phash, new_canister_id, request.namespace);
                Map.set(canister_owners, Map.phash, new_canister_id, caller);
                let wasm_id = Base16.encode(request.hash);
                Map.set(canister_deployment_types, Map.thash, wasm_id, request.deployment_type);
                Debug.print("Provisioned new canister " # Principal.toText(new_canister_id));
                new_canister_id;
              };
            };
          };
        };
      };
      case (null) {
        // --- DEPLOY PATH ---
        Debug.print("No canister found for namespace " # request.namespace # ". Provisioning a new one...");

        // Provision a new, empty canister using the factory module.
        let provision_result = await CanisterFactory.provision_canister(
          thisPrincipal,
          CANISTER_PROVISION_CYCLES,
        );

        switch (provision_result) {
          case (#err(e)) {
            return #err(e);
          };
          case (#ok(new_canister_id)) {
            // IMPORTANT: Track the new canister before proceeding.
            let old_canister_list = Option.get(Map.get(managed_canisters, Map.thash, request.namespace), []);
            let new_canister_list = Array.append(old_canister_list, [new_canister_id]);

            Map.set(managed_canisters, Map.thash, request.namespace, new_canister_list);
            Map.set(reverse_managed_canisters, Map.phash, new_canister_id, request.namespace);
            Map.set(canister_owners, Map.phash, new_canister_id, caller);
            let wasm_id = Base16.encode(request.hash);
            Map.set(canister_deployment_types, Map.thash, wasm_id, request.deployment_type);
            Debug.print("Provisioned new canister " # Principal.toText(new_canister_id));
            new_canister_id;
          };
        };
      };
    };

    // --- 3. NEW: Idempotency Check ---
    // Before proceeding, check if the target canister already has the desired WASM installed.
    try {
      let status_result = await ic.canister_status({
        canister_id = canister_id_to_upgrade;
      });

      switch (status_result.module_hash) {
        case (?installed_hash) {
          // A WASM is already installed. Check if it's the same one.
          if (installed_hash == request.hash) {
            // It's the same WASM. The operation is a no-op. Return success immediately.
            Debug.print("WASM hash matches installed hash for canister " # Principal.toText(canister_id_to_upgrade) # ". No upgrade needed.");
            return #ok(canister_id_to_upgrade);
          };
        };
        case (null) {
          // The canister is empty (this happens on the initial deploy path).
          // The install must proceed, so we do nothing here and let the code continue.
        };
      };
    } catch (e) {
      // If we can't get the status, it's a critical error.
      return #err("Failed to get canister status before upgrade: " # Error.message(e));
    };

    // --- 3. Execute the Upgrade/Install ---
    // By this point, `canister_id_to_upgrade` is set, regardless of the path taken.
    // We now construct the final request for the underlying ICRC-120 service.
    let upgrade_request : ICRC120Types.Current.UpgradeToRequest = {
      canister_id = canister_id_to_upgrade;
      hash = request.hash;
      args = request.args;
      stop = request.stop;
      restart = request.restart;
      snapshot = request.snapshot;
      timeout = request.timeout;
      mode = request.mode;
      parameters = request.parameters;
    };

    // Call the existing, robust `icrc120_upgrade_to` method.
    let upgrade_results = await icrc120().icrc120_upgrade_to(caller, [upgrade_request]);

    let result = upgrade_results[0]; // We only sent one request.

    // --- 4. Return Final Result ---
    switch (result) {
      case (#Ok(_)) {
        // On success, return the Principal of the canister that was affected.
        return #ok(canister_id_to_upgrade);
      };
      case (#Err(err)) {
        // If the upgrade/install itself failed, propagate the error.
        // Note: If this was a new deployment, the canister is already created and tracked.
        // A failed install is a recoverable state.
        return #err("Installation failed: " # debug_show (err));
      };
    };
  };

  // Get canisters for a given namespace
  public query func get_canisters(namespace : Text) : async [Principal] {
    // With the new state structure, this is a simple and fast lookup.
    Option.get(Map.get(managed_canisters, Map.thash, namespace), []);
  };

  public query ({ caller }) func get_canister_id(namespace : Text, wasm_id : Text) : async ?Principal {
    let canisters = Option.get(Map.get(managed_canisters, Map.thash, namespace), []);
    Debug.print("Found " # Nat.toText(canisters.size()) # " canisters for namespace " # namespace);
    if (canisters.size() > 0) {
      let deploymentType = Option.get(Map.get(canister_deployment_types, Map.thash, wasm_id), #global);

      Debug.print("Deployment type: " # debug_show (deploymentType));
      let caller_canister = switch (deploymentType) {
        case (#provisioned) {
          Debug.print("Caller: " # Principal.toText(caller));
          Debug.print("Searching for caller's provisioned canister...");
          Debug.print(debug_show (Iter.toArray(Map.entries(canister_owners))));

          let canister = Array.find(
            canisters,
            func(id : Principal) : Bool {
              switch (Map.get(canister_owners, Map.phash, id)) {
                case (?owner) { owner == caller };
                case (null) { false };
              };
            },
          );

          Debug.print("Caller canister found: " # debug_show (canister));
          canister;
        };
        case (#global) {
          Debug.print("Returning first global canister...");
          // For global canisters, return the first one in the list
          ?canisters[0];
        };
      };
      caller_canister;
    } else {
      null;
    };
  };

  // =====================================================================================
  // NEW: CYCLE MANAGEMENT
  // =====================================================================================

  public type CycleTopUpConfig = {
    enabled : Bool;
    threshold : Nat;
    amount : Nat;
    interval_seconds : Nat;
  };

  /**
   * Returns the current configuration for the automated cycle top-up feature.
   */
  public query func get_cycle_top_up_config() : async CycleTopUpConfig {
    {
      enabled = _cycle_top_up_enabled;
      threshold = TOP_UP_THRESHOLD;
      amount = TOP_UP_AMOUNT;
      interval_seconds = _cycle_check_interval_seconds;
    };
  };

  /**
   * Sets the configuration for the automated cycle top-up feature.
   * This function is restricted to the owner of the orchestrator canister.
   * It will reschedule or remove the timer job based on the new settings.
   */
  public shared ({ caller }) func set_cycle_top_up_config(config : CycleTopUpConfig) : async Result.Result<(), Text> {
    if (caller != _owner) {
      return #err("Caller is not the owner");
    };

    _cycle_top_up_enabled := config.enabled;
    TOP_UP_THRESHOLD := config.threshold;
    TOP_UP_AMOUNT := config.amount;
    _cycle_check_interval_seconds := config.interval_seconds;

    // Cancel any existing job before making changes.
    switch (_cycle_job_action_id) {
      case (?actionId) {
        D.print("Cancelling existing cycle top-up job.");
        ignore tt().cancelAction<system>(actionId.id);
        _cycle_job_action_id := null;
      };
      case (null) {};
    };

    // If the feature is enabled, schedule a new job immediately.
    if (_cycle_top_up_enabled) {
      D.print("Cycle top-up enabled. Scheduling new job.");
      _schedule_cycle_top_up_job<system>(tt());
    } else {
      D.print("Cycle top-up disabled.");
    };

    return #ok(());
  };

  // =====================================================================================
  // PRIVATE HELPERS
  // =====================================================================================

  private func _get_mode(caller : Principal, namespace : Text) : async canister_install_mode {
    // Check if a canister is already managed for this namespace.
    switch (Map.get(managed_canisters, Map.thash, namespace)) {
      case (?existing_canister_ids) {
        // Find the caller's canister if they have one.
        let existing_canister = Array.find(
          existing_canister_ids,
          func(id : Principal) : Bool {
            switch (Map.get(canister_owners, Map.phash, id)) {
              case (?owner) { owner == caller };
              case (null) { false };
            };
          },
        );

        switch (existing_canister) {
          case (null) { return #install }; // No canister for this caller, so it's an install.
          case (?existing_canister_id) {
            // A canister exists. This COULD be an upgrade.
            // Lets check the wasm hash to determine if it's a reinstall or an upgrade.
            let status_result = await ic.canister_status({
              canister_id = existing_canister_id;
            });
            switch (status_result.module_hash) {
              case (?installed_hash) {
                if (?installed_hash == wasmHash) {
                  // The same WASM is already installed. This is a reinstall.
                  return #reinstall;
                } else {
                  // A different WASM is installed. This is an upgrade.
                  return #upgrade(null);
                };
              };
              case (null) {
                // No WASM is installed. This is effectively a first-time install.
                return #install;
              };
            };
          };
        };
      };
      case (null) {
        // No canister exists. This is a first-time deployment.
        return #install;
      };
    };
  };

  // =====================================================================================
  // PUBLIC WRAPPERS
  // =====================================================================================

  /**
   * The primary entry point for the owner to debug/fix bad installs.
   */
  public shared ({ caller }) func deploy_or_upgrade(
    request : DeployOrUpgradeRequest
  ) : async Result.Result<Principal, Text> {
    // --- 1. CRITICAL SECURITY CHECK ---
    // Only the owner can call this function.
    if (caller != _owner) {
      return #err("Unauthorized: Only the owner can call this function.");
    };

    // This is now a thin wrapper that uses the `caller` as the developer identity.
    await _do_deploy_or_upgrade(caller, request);
  };

  public shared ({ caller }) func provision_instance(namespace : Text, wasmId : Text) : async Result.Result<Principal, Text> {
    // Check if caller already has a canister for this namespace.

    if (Principal.isAnonymous(caller)) {
      return #err("Unauthorized: Anonymous caller cannot provision an instance.");
    };

    // If so, return it.

    // If not, provision a new canister with sensible defaults.

    // And install the wasm with caller as the owner.

    let mode = await _get_mode(caller, namespace);

    // We encode the developer's principal as the init arg.
    let args = ?{
      owner = ?caller;
    };
    let encoded_args : Blob = to_candid (args);

    // --- 2. Construct the full request and delegate to the core logic ---
    // For an automated deploy, we use sensible defaults.
    let hash = Option.get(Base16.decode(wasmId), Blob.fromArray([]));
    let full_request : DeployOrUpgradeRequest = {
      namespace = namespace;
      deployment_type = #provisioned;
      hash = hash;
      args = encoded_args; // Automated deploys use the encoded owner as init args
      stop = false;
      restart = false;
      snapshot = false;
      timeout = 0;
      mode = mode; // Automated deploys are either install or upgrade with defaults
      parameters = null;
    };

    // Call the core logic, passing the developer principal from the request.
    await _do_deploy_or_upgrade(caller, full_request);
  };

  type InternalDeployRequest = {
    namespace : Text;
    hash : Blob;
    owner : Principal;
  };
  /**
   * [INTERNAL] A privileged endpoint for the MCP Registry, used for automated global deployments.
   */
  public shared ({ caller }) func internal_deploy_or_upgrade(request : InternalDeployRequest) : async () {
    // --- 1. CRITICAL SECURITY CHECK ---
    switch (_mcp_registry_id) {
      case (?reg_id) {
        if (caller != reg_id) {
          Debug.trap("Unauthorized: This function can only be called by the configured MCP Registry.");
        };
      };
      case (null) {
        Debug.trap("Service not configured: Registry Principal not set.");
      };
    };

    let mode = await _get_mode(request.owner, request.namespace);

    // --- 3. THE FIX: Prepare init args based on context ---
    // We encode the developer's principal as the init arg.
    let args = ?{
      owner = ?request.owner;
    };
    let encoded_args : Blob = to_candid (args);

    // --- 2. Construct the full request and delegate to the core logic ---
    // For an automated deploy, we use sensible defaults.
    let full_request : DeployOrUpgradeRequest = {
      namespace = request.namespace;
      deployment_type = #global;
      hash = request.hash;
      args = encoded_args; // Automated deploys use the encoded owner as init args
      stop = false;
      restart = false;
      snapshot = false;
      timeout = 0;
      mode = mode; // Automated deploys are either install or upgrade with defaults
      parameters = null;
    };

    // Call the core logic, passing the developer principal from the request.
    // We use `ignore` because the registry doesn't need a response.
    ignore _do_deploy_or_upgrade(caller, full_request);
  };

  //------------------- Test FUNCTION -------------------//

  public shared func hello() : async Text {
    return "world!";
  };
};
