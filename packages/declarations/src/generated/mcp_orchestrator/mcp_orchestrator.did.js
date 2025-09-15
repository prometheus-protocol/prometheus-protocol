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
    'timeout' : IDL.Nat,
    'namespace' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Principal, 'err' : IDL.Text });
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
    'hash' : IDL.Vec(IDL.Nat8),
    'namespace' : IDL.Text,
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const ICRC120Canister = IDL.Service({
    'deploy_or_upgrade' : IDL.Func([DeployOrUpgradeRequest], [Result_1], []),
    'get_canisters' : IDL.Func([IDL.Text], [IDL.Vec(IDL.Principal)], ['query']),
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
    'set_mcp_registry_id' : IDL.Func([IDL.Principal], [Result], []),
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
