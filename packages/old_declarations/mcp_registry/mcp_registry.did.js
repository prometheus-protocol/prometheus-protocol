export const idlFactory = ({ IDL }) => {
  const ArchivedTransactionResponse = IDL.Rec();
  const ICRC16 = IDL.Rec();
  const ICRC16Map = IDL.Rec();
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
  const Tip = IDL.Record({
    'last_block_index' : IDL.Vec(IDL.Nat8),
    'hash_tree' : IDL.Vec(IDL.Nat8),
    'last_block_hash' : IDL.Vec(IDL.Nat8),
  });
  const SupportedStandard = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
  const ICRC16Property = IDL.Record({
    'value' : ICRC16,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : ICRC16Map,
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
  ICRC16Map.fill(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16)));
  const CanisterVersion = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'calculated_hash' : IDL.Vec(IDL.Nat8),
  });
  const CreateCanisterType = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'controllers' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'metadata' : ICRC16Map,
    'repo' : IDL.Text,
    'canister_type_name' : IDL.Text,
    'description' : IDL.Text,
    'forked_from' : IDL.Opt(CanisterVersion),
  });
  const CreateCanisterTypeResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Error' : IDL.Variant({ 'Generic' : IDL.Text, 'Unauthorized' : IDL.Null }),
  });
  const DeprecateRequest = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'hash' : IDL.Vec(IDL.Nat8),
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'deprecation_flag' : IDL.Opt(IDL.Bool),
    'reason' : IDL.Opt(IDL.Text),
  });
  const DeprecateResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Error' : IDL.Variant({
      'NotFound' : IDL.Null,
      'Generic' : IDL.Text,
      'Unauthorized' : IDL.Null,
    }),
  });
  const GetCanisterTypesFilter = IDL.Variant({
    'controller' : IDL.Principal,
    'namespace' : IDL.Text,
  });
  const GetCanisterTypesRequest = IDL.Record({
    'prev' : IDL.Opt(IDL.Text),
    'take' : IDL.Opt(IDL.Nat),
    'filter' : IDL.Vec(GetCanisterTypesFilter),
  });
  const CanisterType = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'controllers' : IDL.Vec(IDL.Principal),
    'metadata' : ICRC16Map,
    'repo' : IDL.Text,
    'canister_type_name' : IDL.Text,
    'description' : IDL.Text,
    'versions' : IDL.Vec(CanisterVersion),
    'forked_from' : IDL.Opt(CanisterVersion),
  });
  const GetUpgradePathRequest = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'current_version' : IDL.Vec(IDL.Nat8),
    'target_version' : IDL.Vec(IDL.Nat8),
  });
  const GetWasmChunkRequest = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'hash' : IDL.Vec(IDL.Nat8),
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'chunk_id' : IDL.Nat,
  });
  const GetWasmChunkResponse = IDL.Variant({
    'Ok' : IDL.Record({
      'expected_wasm_hash' : IDL.Vec(IDL.Nat8),
      'canister_type_namespace' : IDL.Text,
      'expected_chunk_hash' : IDL.Vec(IDL.Nat8),
      'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
      'chunk_id' : IDL.Nat,
      'wasm_chunk' : IDL.Vec(IDL.Nat8),
    }),
    'Err' : IDL.Text,
  });
  const WasmVersionPointer = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
  });
  const GetWasmsFilter = IDL.Variant({
    'canister_type_namespace' : IDL.Text,
    'controllers' : IDL.Vec(IDL.Principal),
    'previous' : CanisterVersion,
    'hash' : IDL.Vec(IDL.Nat8),
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'canister' : IDL.Principal,
    'version_max' : IDL.Tuple(IDL.Nat, IDL.Opt(IDL.Nat), IDL.Opt(IDL.Nat)),
    'version_min' : IDL.Tuple(IDL.Nat, IDL.Opt(IDL.Nat), IDL.Opt(IDL.Nat)),
  });
  const Wasm = IDL.Record({
    'created' : IDL.Nat,
    'canister_type_namespace' : IDL.Text,
    'previous' : IDL.Opt(CanisterVersion),
    'metadata' : ICRC16Map,
    'hash' : IDL.Vec(IDL.Nat8),
    'repo' : IDL.Text,
    'description' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'calculated_hash' : IDL.Vec(IDL.Nat8),
    'deprecated' : IDL.Bool,
    'chunkCount' : IDL.Nat,
    'chunks' : IDL.Vec(IDL.Vec(IDL.Nat8)),
  });
  const ManageControllerRequest = IDL.Record({
    'op' : IDL.Variant({ 'Add' : IDL.Null, 'Remove' : IDL.Null }),
    'controller' : IDL.Principal,
    'canister_type_namespace' : IDL.Text,
  });
  const ManageControllerResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Error' : IDL.Variant({
      'NotFound' : IDL.Null,
      'Generic' : IDL.Text,
      'Unauthorized' : IDL.Null,
    }),
  });
  const UpdateWasmRequest = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'previous' : IDL.Opt(CanisterVersion),
    'expected_chunks' : IDL.Vec(IDL.Vec(IDL.Nat8)),
    'metadata' : ICRC16Map,
    'repo' : IDL.Text,
    'description' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'expected_hash' : IDL.Vec(IDL.Nat8),
  });
  const UpdateWasmResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Error' : IDL.Variant({
      'NonDeprecatedWasmFound' : IDL.Vec(IDL.Nat8),
      'Generic' : IDL.Text,
      'Unauthorized' : IDL.Null,
    }),
  });
  const UploadRequest = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'expected_chunk_hash' : IDL.Vec(IDL.Nat8),
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'chunk_id' : IDL.Nat,
    'wasm_chunk' : IDL.Vec(IDL.Nat8),
  });
  const UploadResponse = IDL.Record({
    'total_chunks' : IDL.Nat,
    'chunk_id' : IDL.Nat,
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
  const ICRC118WasmRegistryCanister = IDL.Service({
    'get_tip' : IDL.Func([], [Tip], ['query']),
    'hello' : IDL.Func([], [IDL.Text], []),
    'icrc10_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(SupportedStandard)],
        ['query'],
      ),
    'icrc118_create_canister_type' : IDL.Func(
        [IDL.Vec(CreateCanisterType)],
        [IDL.Vec(CreateCanisterTypeResult)],
        [],
      ),
    'icrc118_deprecate' : IDL.Func([DeprecateRequest], [DeprecateResult], []),
    'icrc118_get_canister_types' : IDL.Func(
        [GetCanisterTypesRequest],
        [IDL.Vec(CanisterType)],
        ['query'],
      ),
    'icrc118_get_upgrade_path' : IDL.Func(
        [GetUpgradePathRequest],
        [IDL.Vec(CanisterVersion)],
        ['query'],
      ),
    'icrc118_get_wasm_chunk' : IDL.Func(
        [GetWasmChunkRequest],
        [GetWasmChunkResponse],
        ['query'],
      ),
    'icrc118_get_wasms' : IDL.Func(
        [
          IDL.Record({
            'prev' : IDL.Opt(WasmVersionPointer),
            'take' : IDL.Opt(IDL.Nat),
            'filter' : IDL.Opt(IDL.Vec(GetWasmsFilter)),
          }),
        ],
        [IDL.Vec(Wasm)],
        ['query'],
      ),
    'icrc118_manage_controller' : IDL.Func(
        [IDL.Vec(ManageControllerRequest)],
        [IDL.Vec(ManageControllerResult)],
        [],
      ),
    'icrc118_update_wasm' : IDL.Func(
        [UpdateWasmRequest],
        [UpdateWasmResult],
        [],
      ),
    'icrc118_upload_wasm_chunk' : IDL.Func(
        [UploadRequest],
        [UploadResponse],
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
    'test_simulate_install' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat)],
        [IDL.Bool],
        [],
      ),
  });
  return ICRC118WasmRegistryCanister;
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
        'icrc118wasmregistryArgs' : IDL.Opt(InitArgs),
        'ttArgs' : IDL.Opt(InitArgList),
      })
    ),
  ];
};
