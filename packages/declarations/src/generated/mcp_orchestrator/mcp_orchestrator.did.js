export const idlFactory = ({ IDL }) => {
  const ArchivedTransactionResponse = IDL.Rec();
  const ICRC16 = IDL.Rec();
  const ICRC16__1 = IDL.Rec();
  const Value = IDL.Rec();
  const InitArgs = IDL.Record({});
  const Time = IDL.Nat;
  const ActionId = IDL.Record({ 'id' : IDL.Nat, 'time' : Time });
  const Action = IDL.Record({
    'aSync' : IDL.Opt(IDL.Nat),
    'actionType' : IDL.Text,
    'params' : IDL.Vec(IDL.Nat8),
    'retries' : IDL.Nat,
  });
  const InitArgList = IDL.Record({
    'nextCycleActionId' : IDL.Opt(IDL.Nat),
    'maxExecutions' : IDL.Opt(IDL.Nat),
    'nextActionId' : IDL.Nat,
    'lastActionIdReported' : IDL.Opt(IDL.Nat),
    'lastCycleReport' : IDL.Opt(IDL.Nat),
    'initialTimers' : IDL.Vec(IDL.Tuple(ActionId, Action)),
    'expectedExecutionTime' : Time,
    'lastExecutionTime' : Time,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const ActionFilter = IDL.Variant({
    'All' : IDL.Null,
    'ByActionId' : IDL.Nat,
    'ByType' : IDL.Text,
    'ByTimeRange' : IDL.Tuple(Time, Time),
    'ByRetryCount' : IDL.Nat,
  });
  const CancellationResult = IDL.Record({
    'cancelled' : IDL.Vec(ActionId),
    'errors' : IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Text)),
    'notFound' : IDL.Vec(IDL.Nat),
  });
  const CanisterCycleInfo = IDL.Record({
    'needs_top_up' : IDL.Bool,
    'canister_id' : IDL.Principal,
    'cycles' : IDL.Nat,
    'namespace' : IDL.Text,
  });
  const Result_7 = IDL.Variant({
    'ok' : IDL.Vec(CanisterCycleInfo),
    'err' : IDL.Text,
  });
  const CanisterDeploymentType = IDL.Variant({
    'provisioned' : IDL.Null,
    'global' : IDL.Null,
  });
  const canister_install_mode = IDL.Variant({
    'reinstall' : IDL.Null,
    'upgrade' : IDL.Opt(
      IDL.Record({
        'wasm_memory_persistence' : IDL.Opt(
          IDL.Variant({ 'keep' : IDL.Null, 'replace' : IDL.Null })
        ),
        'skip_pre_upgrade' : IDL.Opt(IDL.Bool),
      })
    ),
    'install' : IDL.Null,
  });
  const ICRC16Map__1 = IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__1));
  const ICRC16Property__1 = IDL.Record({
    'value' : ICRC16__1,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16__1.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : ICRC16Map__1,
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16__1),
      'Nat16' : IDL.Nat16,
      'Nat32' : IDL.Nat32,
      'Nat64' : IDL.Nat64,
      'Blob' : IDL.Vec(IDL.Nat8),
      'Bool' : IDL.Bool,
      'Int8' : IDL.Int8,
      'Nat8' : IDL.Nat8,
      'Nats' : IDL.Vec(IDL.Nat),
      'Text' : IDL.Text,
      'Bytes' : IDL.Vec(IDL.Nat8),
      'Int16' : IDL.Int16,
      'Int32' : IDL.Int32,
      'Int64' : IDL.Int64,
      'Option' : IDL.Opt(ICRC16__1),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16__1),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16__1, ICRC16__1)),
      'Class' : IDL.Vec(ICRC16Property__1),
    })
  );
  const DeployOrUpgradeRequest = IDL.Record({
    'snapshot' : IDL.Bool,
    'args' : IDL.Vec(IDL.Nat8),
    'hash' : IDL.Vec(IDL.Nat8),
    'mode' : canister_install_mode,
    'stop' : IDL.Bool,
    'parameters' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__1))),
    'restart' : IDL.Bool,
    'deployment_type' : CanisterDeploymentType,
    'timeout' : IDL.Nat,
    'namespace' : IDL.Text,
  });
  const Result_3 = IDL.Variant({ 'ok' : IDL.Principal, 'err' : IDL.Text });
  const Time__2 = IDL.Int;
  const ActionDetail = IDL.Tuple(ActionId, Action);
  const Result_6 = IDL.Variant({
    'ok' : IDL.Vec(IDL.Principal),
    'err' : IDL.Text,
  });
  const CycleJobStatus = IDL.Record({
    'job_scheduled' : IDL.Bool,
    'job_action_id' : IDL.Opt(IDL.Nat),
    'enabled' : IDL.Bool,
    'orchestrator_balance' : IDL.Nat,
    'next_check' : IDL.Opt(IDL.Int),
    'last_check' : IDL.Opt(IDL.Int),
  });
  const Result_5 = IDL.Variant({ 'ok' : CycleJobStatus, 'err' : IDL.Text });
  const CycleTopUpConfig = IDL.Record({
    'threshold' : IDL.Nat,
    'enabled' : IDL.Bool,
    'interval_seconds' : IDL.Nat,
    'amount' : IDL.Nat,
  });
  const ReconstitutionTrace = IDL.Record({
    'errors' : IDL.Vec(IDL.Text),
    'actionsRestored' : IDL.Nat,
    'timestamp' : Time,
    'migratedTo' : IDL.Text,
    'migratedFrom' : IDL.Text,
    'timersRestored' : IDL.Nat,
    'validationPassed' : IDL.Bool,
  });
  const Result_4 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const TimerId = IDL.Nat;
  const TimerDiagnostics = IDL.Record({
    'pendingActions' : IDL.Nat,
    'totalActions' : IDL.Nat,
    'overdueActions' : IDL.Nat,
    'lockStatus' : IDL.Opt(Time),
    'currentTime' : Time,
    'lastExecutionDelta' : IDL.Int,
    'nextExecutionDelta' : IDL.Opt(IDL.Int),
    'systemTimerStatus' : IDL.Opt(TimerId),
  });
  const Tip = IDL.Record({
    'last_block_index' : IDL.Vec(IDL.Nat8),
    'hash_tree' : IDL.Vec(IDL.Nat8),
    'last_block_hash' : IDL.Vec(IDL.Nat8),
  });
  const CleanSnapshotRequest = IDL.Record({
    'canister_id' : IDL.Principal,
    'snapshot_id' : IDL.Vec(IDL.Nat8),
  });
  const CleanSnapshotError = IDL.Variant({
    'TooManyRequests' : IDL.Null,
    'NotFound' : IDL.Null,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
  });
  const CleanSnapshotResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : CleanSnapshotError,
  });
  const ICRC16Property = IDL.Record({
    'value' : ICRC16,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : IDL.Vec(IDL.Tuple(IDL.Text, ICRC16)),
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16),
      'Nat16' : IDL.Nat16,
      'Nat32' : IDL.Nat32,
      'Nat64' : IDL.Nat64,
      'Blob' : IDL.Vec(IDL.Nat8),
      'Bool' : IDL.Bool,
      'Int8' : IDL.Int8,
      'Nat8' : IDL.Nat8,
      'Nats' : IDL.Vec(IDL.Nat),
      'Text' : IDL.Text,
      'Bytes' : IDL.Vec(IDL.Nat8),
      'Int16' : IDL.Int16,
      'Int32' : IDL.Int32,
      'Int64' : IDL.Int64,
      'Option' : IDL.Opt(ICRC16),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16, ICRC16)),
      'Class' : IDL.Vec(ICRC16Property),
    })
  );
  const ConfigCanisterRequest = IDL.Record({
    'configs' : IDL.Vec(IDL.Tuple(IDL.Text, ICRC16)),
    'canister_id' : IDL.Principal,
  });
  const ConfigCanisterError = IDL.Variant({
    'InvalidConfig' : IDL.Text,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
  });
  const ConfigCanisterResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : ConfigCanisterError,
  });
  const CreateSnapshotRequest = IDL.Record({
    'canister_id' : IDL.Principal,
    'restart' : IDL.Bool,
  });
  const CreateSnapshotError = IDL.Variant({
    'NotFound' : IDL.Null,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
  });
  const CreateSnapshotResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : CreateSnapshotError,
  });
  const OrchestrationEventType = IDL.Variant({
    'upgrade_initiated' : IDL.Null,
    'snapshot_requested' : IDL.Null,
    'snapshot_revert_requested' : IDL.Null,
    'snapshot_cleaned' : IDL.Null,
    'upgrade_finished' : IDL.Null,
    'configuration_changed' : IDL.Null,
    'snapshot_reverted' : IDL.Null,
    'canister_started' : IDL.Null,
    'snapshot_created' : IDL.Null,
    'canister_stopped' : IDL.Null,
  });
  const GetEventsFilter = IDL.Record({
    'event_types' : IDL.Opt(IDL.Vec(OrchestrationEventType)),
    'end_time' : IDL.Opt(IDL.Nat),
    'start_time' : IDL.Opt(IDL.Nat),
    'canister' : IDL.Opt(IDL.Principal),
  });
  const OrchestrationEvent = IDL.Record({
    'id' : IDL.Nat,
    'canister_id' : IDL.Principal,
    'timestamp' : IDL.Nat,
    'details' : ICRC16,
    'event_type' : OrchestrationEventType,
  });
  const ICRC16Map = IDL.Vec(IDL.Tuple(IDL.Text, ICRC16));
  const RevertSnapshotRequest = IDL.Record({
    'canister_id' : IDL.Principal,
    'restart' : IDL.Bool,
    'snapshot_id' : IDL.Vec(IDL.Nat8),
  });
  const RevertSnapshotError = IDL.Variant({
    'TooManyRequests' : IDL.Null,
    'NotFound' : IDL.Null,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
  });
  const RevertSnapshotResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : RevertSnapshotError,
  });
  const StartCanisterRequest = IDL.Record({
    'canister_id' : IDL.Principal,
    'timeout' : IDL.Nat,
  });
  const StartCanisterError = IDL.Variant({
    'NotFound' : IDL.Null,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
  });
  const StartCanisterResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : StartCanisterError,
  });
  const StopCanisterRequest = IDL.Record({
    'canister_id' : IDL.Principal,
    'timeout' : IDL.Nat,
  });
  const StopCanisterError = IDL.Variant({
    'NotFound' : IDL.Null,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
  });
  const StopCanisterResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Err' : StopCanisterError,
  });
  const UpgradeFinishedResult = IDL.Variant({
    'Failed' : IDL.Tuple(IDL.Nat, IDL.Text),
    'Success' : IDL.Nat,
    'InProgress' : IDL.Nat,
  });
  const UpgradeToRequest = IDL.Record({
    'snapshot' : IDL.Bool,
    'args' : IDL.Vec(IDL.Nat8),
    'hash' : IDL.Vec(IDL.Nat8),
    'mode' : canister_install_mode,
    'stop' : IDL.Bool,
    'canister_id' : IDL.Principal,
    'parameters' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16))),
    'restart' : IDL.Bool,
    'timeout' : IDL.Nat,
  });
  const UpgradeToRequestId = IDL.Nat;
  const UpgradeToError = IDL.Variant({
    'InvalidPayment' : IDL.Null,
    'Generic' : IDL.Text,
    'Unauthorized' : IDL.Null,
    'WasmUnavailable' : IDL.Null,
  });
  const UpgradeToResult = IDL.Variant({
    'Ok' : UpgradeToRequestId,
    'Err' : UpgradeToError,
  });
  const GetArchivesArgs = IDL.Record({ 'from' : IDL.Opt(IDL.Principal) });
  const GetArchivesResultItem = IDL.Record({
    'end' : IDL.Nat,
    'canister_id' : IDL.Principal,
    'start' : IDL.Nat,
  });
  const GetArchivesResult = IDL.Vec(GetArchivesResultItem);
  const TransactionRange = IDL.Record({
    'start' : IDL.Nat,
    'length' : IDL.Nat,
  });
  const GetBlocksArgs = IDL.Vec(TransactionRange);
  Value.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : IDL.Vec(IDL.Tuple(IDL.Text, Value)),
      'Nat' : IDL.Nat,
      'Blob' : IDL.Vec(IDL.Nat8),
      'Text' : IDL.Text,
      'Array' : IDL.Vec(Value),
    })
  );
  const GetTransactionsResult = IDL.Record({
    'log_length' : IDL.Nat,
    'blocks' : IDL.Vec(IDL.Record({ 'id' : IDL.Nat, 'block' : Value })),
    'archived_blocks' : IDL.Vec(ArchivedTransactionResponse),
  });
  const GetTransactionsFn = IDL.Func(
      [IDL.Vec(TransactionRange)],
      [GetTransactionsResult],
      ['query'],
    );
  ArchivedTransactionResponse.fill(
    IDL.Record({
      'args' : IDL.Vec(TransactionRange),
      'callback' : GetTransactionsFn,
    })
  );
  const GetBlocksResult = IDL.Record({
    'log_length' : IDL.Nat,
    'blocks' : IDL.Vec(IDL.Record({ 'id' : IDL.Nat, 'block' : Value })),
    'archived_blocks' : IDL.Vec(ArchivedTransactionResponse),
  });
  const DataCertificate = IDL.Record({
    'certificate' : IDL.Vec(IDL.Nat8),
    'hash_tree' : IDL.Vec(IDL.Nat8),
  });
  const BlockType = IDL.Record({ 'url' : IDL.Text, 'block_type' : IDL.Text });
  const InternalDeployRequest = IDL.Record({
    'owner' : IDL.Principal,
    'hash' : IDL.Vec(IDL.Nat8),
    'namespace' : IDL.Text,
  });
  const RegisterResourceServerArgs = IDL.Record({
    'initial_service_principal' : IDL.Principal,
    'scopes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'accepted_payment_canisters' : IDL.Vec(IDL.Principal),
    'logo_uri' : IDL.Text,
    'frontend_host' : IDL.Opt(IDL.Text),
  });
  const ResourceServer = IDL.Record({
    'status' : IDL.Variant({ 'active' : IDL.Null, 'pending' : IDL.Null }),
    'resource_server_id' : IDL.Text,
    'owner' : IDL.Principal,
    'scopes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'accepted_payment_canisters' : IDL.Vec(IDL.Principal),
    'logo_uri' : IDL.Text,
    'frontend_host' : IDL.Opt(IDL.Text),
    'service_principals' : IDL.Vec(IDL.Principal),
  });
  const Result_2 = IDL.Variant({ 'ok' : ResourceServer, 'err' : IDL.Text });
  const Result = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const ICRC120Canister = IDL.Service({
    'add_controller_to_canister' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [Result_1],
        [],
      ),
    'cancel_actions_by_filter' : IDL.Func(
        [ActionFilter],
        [CancellationResult],
        [],
      ),
    'cancel_actions_by_ids' : IDL.Func(
        [IDL.Vec(IDL.Nat)],
        [CancellationResult],
        [],
      ),
    'check_all_canister_cycles' : IDL.Func([], [Result_7], []),
    'clear_reconstitution_traces' : IDL.Func([], [], []),
    'debug_canister_info' : IDL.Func(
        [IDL.Text],
        [
          IDL.Record({
            'canister_deployment_types' : IDL.Vec(
              IDL.Tuple(IDL.Text, CanisterDeploymentType)
            ),
            'canisters' : IDL.Vec(IDL.Principal),
            'canister_owners' : IDL.Vec(
              IDL.Tuple(IDL.Principal, IDL.Principal)
            ),
            'caller_principal' : IDL.Principal,
          }),
        ],
        ['query'],
      ),
    'deploy_or_upgrade' : IDL.Func([DeployOrUpgradeRequest], [Result_3], []),
    'emergency_clear_all_timers' : IDL.Func([], [IDL.Nat], []),
    'force_release_lock' : IDL.Func([], [IDL.Opt(Time__2)], []),
    'force_system_timer_cancel' : IDL.Func([], [IDL.Bool], []),
    'get_actions_by_filter' : IDL.Func(
        [ActionFilter],
        [IDL.Vec(ActionDetail)],
        ['query'],
      ),
    'get_all_canister_cycles' : IDL.Func([], [Result_7], ['query']),
    'get_auth_server_id' : IDL.Func([], [IDL.Opt(IDL.Principal)], ['query']),
    'get_canister_controllers' : IDL.Func([IDL.Principal], [Result_6], []),
    'get_canister_id' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Opt(IDL.Principal)],
        ['query'],
      ),
    'get_canisters' : IDL.Func([IDL.Text], [IDL.Vec(IDL.Principal)], ['query']),
    'get_cycle_job_status' : IDL.Func([], [Result_5], ['query']),
    'get_cycle_top_up_config' : IDL.Func([], [CycleTopUpConfig], ['query']),
    'get_latest_reconstitution_trace' : IDL.Func(
        [],
        [IDL.Opt(ReconstitutionTrace)],
        ['query'],
      ),
    'get_orchestrator_cycles' : IDL.Func([], [Result_4], ['query']),
    'get_reconstitution_traces' : IDL.Func(
        [],
        [IDL.Vec(ReconstitutionTrace)],
        ['query'],
      ),
    'get_timer_diagnostics' : IDL.Func([], [TimerDiagnostics], ['query']),
    'get_tip' : IDL.Func([], [Tip], ['query']),
    'hello' : IDL.Func([], [IDL.Text], []),
    'icrc120_clean_snapshot' : IDL.Func(
        [IDL.Vec(CleanSnapshotRequest)],
        [IDL.Vec(CleanSnapshotResult)],
        [],
      ),
    'icrc120_config_canister' : IDL.Func(
        [IDL.Vec(ConfigCanisterRequest)],
        [IDL.Vec(ConfigCanisterResult)],
        [],
      ),
    'icrc120_create_snapshot' : IDL.Func(
        [IDL.Vec(CreateSnapshotRequest)],
        [IDL.Vec(CreateSnapshotResult)],
        [],
      ),
    'icrc120_get_events' : IDL.Func(
        [
          IDL.Record({
            'prev' : IDL.Opt(IDL.Vec(IDL.Nat8)),
            'take' : IDL.Opt(IDL.Nat),
            'filter' : IDL.Opt(GetEventsFilter),
          }),
        ],
        [IDL.Vec(OrchestrationEvent)],
        ['query'],
      ),
    'icrc120_metadata' : IDL.Func([], [ICRC16Map], []),
    'icrc120_revert_snapshot' : IDL.Func(
        [IDL.Vec(RevertSnapshotRequest)],
        [IDL.Vec(RevertSnapshotResult)],
        [],
      ),
    'icrc120_start_canister' : IDL.Func(
        [IDL.Vec(StartCanisterRequest)],
        [IDL.Vec(StartCanisterResult)],
        [],
      ),
    'icrc120_stop_canister' : IDL.Func(
        [IDL.Vec(StopCanisterRequest)],
        [IDL.Vec(StopCanisterResult)],
        [],
      ),
    'icrc120_upgrade_finished' : IDL.Func([], [UpgradeFinishedResult], []),
    'icrc120_upgrade_to' : IDL.Func(
        [IDL.Vec(UpgradeToRequest)],
        [IDL.Vec(UpgradeToResult)],
        [],
      ),
    'icrc3_get_archives' : IDL.Func(
        [GetArchivesArgs],
        [GetArchivesResult],
        ['query'],
      ),
    'icrc3_get_blocks' : IDL.Func(
        [GetBlocksArgs],
        [GetBlocksResult],
        ['query'],
      ),
    'icrc3_get_tip_certificate' : IDL.Func(
        [],
        [IDL.Opt(DataCertificate)],
        ['query'],
      ),
    'icrc3_supported_block_types' : IDL.Func(
        [],
        [IDL.Vec(BlockType)],
        ['query'],
      ),
    'internal_deploy_or_upgrade' : IDL.Func([InternalDeployRequest], [], []),
    'provision_instance' : IDL.Func([IDL.Text, IDL.Text], [Result_3], []),
    'register_oauth_resource' : IDL.Func(
        [IDL.Principal, RegisterResourceServerArgs],
        [Result_2],
        [],
      ),
    'remove_controller_from_canister' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [Result_1],
        [],
      ),
    'set_auth_server_id' : IDL.Func([IDL.Principal], [Result_1], []),
    'set_canister_owner' : IDL.Func(
        [IDL.Principal, IDL.Principal],
        [Result_1],
        [],
      ),
    'set_cycle_top_up_config' : IDL.Func([CycleTopUpConfig], [Result_1], []),
    'set_deployment_type' : IDL.Func(
        [IDL.Text, IDL.Text, CanisterDeploymentType],
        [Result_1],
        [],
      ),
    'set_mcp_registry_id' : IDL.Func([IDL.Principal], [Result_1], []),
    'set_usage_tracker_id' : IDL.Func([IDL.Principal], [Result_1], []),
    'trigger_manual_cycle_top_up' : IDL.Func([], [Result], []),
    'validate_timer_state' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
  });
  return ICRC120Canister;
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({});
  const Time = IDL.Nat;
  const ActionId = IDL.Record({ 'id' : IDL.Nat, 'time' : Time });
  const Action = IDL.Record({
    'aSync' : IDL.Opt(IDL.Nat),
    'actionType' : IDL.Text,
    'params' : IDL.Vec(IDL.Nat8),
    'retries' : IDL.Nat,
  });
  const InitArgList = IDL.Record({
    'nextCycleActionId' : IDL.Opt(IDL.Nat),
    'maxExecutions' : IDL.Opt(IDL.Nat),
    'nextActionId' : IDL.Nat,
    'lastActionIdReported' : IDL.Opt(IDL.Nat),
    'lastCycleReport' : IDL.Opt(IDL.Nat),
    'initialTimers' : IDL.Vec(IDL.Tuple(ActionId, Action)),
    'expectedExecutionTime' : Time,
    'lastExecutionTime' : Time,
  });
  return [
    IDL.Opt(
      IDL.Record({
        'icrc120Args' : IDL.Opt(InitArgs),
        'ttArgs' : IDL.Opt(InitArgList),
      })
    ),
  ];
};
