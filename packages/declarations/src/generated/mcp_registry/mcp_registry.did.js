export const idlFactory = ({ IDL }) => {
  const ArchivedTransactionResponse = IDL.Rec();
  const ICRC16 = IDL.Rec();
  const ICRC16Map__1 = IDL.Rec();
  const ICRC16Map__3 = IDL.Rec();
  const ICRC16Map__4 = IDL.Rec();
  const ICRC16__1 = IDL.Rec();
  const ICRC16__2 = IDL.Rec();
  const ICRC16__3 = IDL.Rec();
  const ICRC16__4 = IDL.Rec();
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
  const VerificationOutcome = IDL.Variant({
    'Rejected' : IDL.Null,
    'Verified' : IDL.Null,
  });
  const ICRC16Property__4 = IDL.Record({
    'value' : ICRC16__4,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16__4.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__4)),
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16__4),
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
      'Option' : IDL.Opt(ICRC16__4),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16__4),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16__4, ICRC16__4)),
      'Class' : IDL.Vec(ICRC16Property__4),
    })
  );
  const ICRC16Map__5 = IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__4));
  const Result_3 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : IDL.Text });
  const AppListingFilter = IDL.Variant({
    'publisher' : IDL.Text,
    'name' : IDL.Text,
    'namespace' : IDL.Text,
  });
  const AppListingRequest = IDL.Record({
    'prev' : IDL.Opt(IDL.Text),
    'take' : IDL.Opt(IDL.Nat),
    'filter' : IDL.Opt(IDL.Vec(AppListingFilter)),
  });
  const SecurityTier = IDL.Variant({
    'Gold' : IDL.Null,
    'Bronze' : IDL.Null,
    'Unranked' : IDL.Null,
    'Silver' : IDL.Null,
  });
  const AppListing = IDL.Record({
    'id' : IDL.Text,
    'banner_url' : IDL.Text,
    'publisher' : IDL.Text,
    'name' : IDL.Text,
    'description' : IDL.Text,
    'icon_url' : IDL.Text,
    'security_tier' : SecurityTier,
    'category' : IDL.Text,
    'namespace' : IDL.Text,
  });
  const AppListingResponse = IDL.Variant({
    'ok' : IDL.Vec(AppListing),
    'err' : IDL.Text,
  });
  const Time__1 = IDL.Int;
  const AttestationRecord = IDL.Record({
    'audit_type' : IDL.Text,
    'metadata' : ICRC16Map__5,
    'auditor' : IDL.Principal,
    'timestamp' : Time__1,
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
  const RunBountyResult = IDL.Record({
    'result' : IDL.Variant({ 'Invalid' : IDL.Null, 'Valid' : IDL.Null }),
    'metadata' : ICRC16,
    'trx_id' : IDL.Opt(IDL.Nat),
  });
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const ICRC16Map = IDL.Vec(IDL.Tuple(IDL.Text, ICRC16));
  const ClaimRecord = IDL.Record({
    'result' : IDL.Opt(RunBountyResult),
    'claim_account' : IDL.Opt(Account),
    'time_submitted' : IDL.Nat,
    'claim_id' : IDL.Nat,
    'caller' : IDL.Principal,
    'claim_metadata' : ICRC16Map,
    'submission' : ICRC16,
  });
  const Bounty = IDL.Record({
    'claims' : IDL.Vec(ClaimRecord),
    'created' : IDL.Nat,
    'creator' : IDL.Principal,
    'token_amount' : IDL.Nat,
    'bounty_metadata' : ICRC16Map,
    'claimed' : IDL.Opt(IDL.Nat),
    'token_canister_id' : IDL.Principal,
    'challenge_parameters' : ICRC16,
    'validation_call_timeout' : IDL.Nat,
    'bounty_id' : IDL.Nat,
    'validation_canister_id' : IDL.Principal,
    'claimed_date' : IDL.Opt(IDL.Nat),
    'timeout_date' : IDL.Opt(IDL.Nat),
    'payout_fee' : IDL.Nat,
  });
  const GetCanisterTypeVersionRequest = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
  });
  const CanisterVersion = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'calculated_hash' : IDL.Vec(IDL.Nat8),
  });
  const ICRC16Property__3 = IDL.Record({
    'value' : ICRC16__3,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16__3.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : ICRC16Map__4,
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16__3),
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
      'Option' : IDL.Opt(ICRC16__3),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16__3),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16__3, ICRC16__3)),
      'Class' : IDL.Vec(ICRC16Property__3),
    })
  );
  ICRC16Map__4.fill(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__3)));
  const Wasm = IDL.Record({
    'created' : IDL.Nat,
    'canister_type_namespace' : IDL.Text,
    'previous' : IDL.Opt(CanisterVersion),
    'metadata' : ICRC16Map__4,
    'hash' : IDL.Vec(IDL.Nat8),
    'repo' : IDL.Text,
    'description' : IDL.Text,
    'version_number' : IDL.Tuple(IDL.Nat, IDL.Nat, IDL.Nat),
    'calculated_hash' : IDL.Vec(IDL.Nat8),
    'deprecated' : IDL.Bool,
    'chunkCount' : IDL.Nat,
    'chunks' : IDL.Vec(IDL.Vec(IDL.Nat8)),
  });
  const Result_2 = IDL.Variant({ 'ok' : Wasm, 'err' : IDL.Text });
  const Tip = IDL.Record({
    'last_block_index' : IDL.Vec(IDL.Nat8),
    'hash_tree' : IDL.Vec(IDL.Nat8),
    'last_block_hash' : IDL.Vec(IDL.Nat8),
  });
  const ICRC16Property__2 = IDL.Record({
    'value' : ICRC16__2,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16__2.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : ICRC16Map__3,
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16__2),
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
      'Option' : IDL.Opt(ICRC16__2),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16__2),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16__2, ICRC16__2)),
      'Class' : IDL.Vec(ICRC16Property__2),
    })
  );
  ICRC16Map__3.fill(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__2)));
  const VerificationRequest = IDL.Record({
    'metadata' : ICRC16Map__3,
    'repo' : IDL.Text,
    'commit_hash' : IDL.Vec(IDL.Nat8),
    'wasm_hash' : IDL.Vec(IDL.Nat8),
  });
  const SupportedStandard = IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text });
  const CreateCanisterType = IDL.Record({
    'canister_type_namespace' : IDL.Text,
    'controllers' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'metadata' : ICRC16Map__4,
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
    'metadata' : ICRC16Map__4,
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
    'metadata' : ICRC16Map__4,
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
  const AttestationRequest = IDL.Record({
    'metadata' : ICRC16Map__3,
    'wasm_id' : IDL.Text,
  });
  const AttestationResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Error' : IDL.Variant({
      'NotFound' : IDL.Null,
      'Generic' : IDL.Text,
      'Unauthorized' : IDL.Null,
    }),
  });
  const DivergenceReportRequest = IDL.Record({
    'metadata' : IDL.Opt(ICRC16Map__3),
    'wasm_id' : IDL.Text,
    'divergence_report' : IDL.Text,
  });
  const DivergenceResult = IDL.Variant({
    'Ok' : IDL.Nat,
    'Error' : IDL.Variant({ 'NotFound' : IDL.Null, 'Generic' : IDL.Text }),
  });
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
  ICRC16Map__1.fill(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__1)));
  const CreateBountyRequest = IDL.Record({
    'bounty_metadata' : ICRC16Map__1,
    'challenge_parameters' : ICRC16__1,
    'start_date' : IDL.Opt(IDL.Nat),
    'bounty_id' : IDL.Opt(IDL.Nat),
    'validation_canister_id' : IDL.Principal,
    'timeout_date' : IDL.Nat,
  });
  const CreateBountyResult = IDL.Variant({
    'Ok' : IDL.Record({ 'trx_id' : IDL.Opt(IDL.Nat), 'bounty_id' : IDL.Nat }),
    'Error' : IDL.Variant({
      'InsufficientAllowance' : IDL.Null,
      'Generic' : IDL.Text,
    }),
  });
  const ListBountiesFilter = IDL.Variant({
    'claimed_by' : Account,
    'validation_canister' : IDL.Principal,
    'metadata' : ICRC16Map__1,
    'claimed' : IDL.Bool,
    'created_after' : IDL.Nat,
    'created_before' : IDL.Nat,
  });
  const BountySubmissionRequest = IDL.Record({
    'account' : IDL.Opt(Account),
    'bounty_id' : IDL.Nat,
    'submission' : ICRC16__1,
  });
  const RunBountyResult__1 = IDL.Record({
    'result' : IDL.Variant({ 'Invalid' : IDL.Null, 'Valid' : IDL.Null }),
    'metadata' : ICRC16__1,
    'trx_id' : IDL.Opt(IDL.Nat),
  });
  const Timestamp = IDL.Nat64;
  const TransferError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : Timestamp }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const BountySubmissionResult = IDL.Variant({
    'Ok' : IDL.Record({
      'result' : IDL.Opt(RunBountyResult__1),
      'claim_id' : IDL.Nat,
    }),
    'Error' : IDL.Variant({
      'Generic' : IDL.Text,
      'NoMatch' : IDL.Null,
      'PayoutFailed' : TransferError,
    }),
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
  const Result_1 = IDL.Variant({ 'ok' : IDL.Bool, 'err' : IDL.Text });
  const BountyStatus = IDL.Variant({ 'Claimed' : IDL.Null, 'Open' : IDL.Null });
  const BountyFilter = IDL.Variant({
    'status' : BountyStatus,
    'audit_type' : IDL.Text,
    'creator' : IDL.Principal,
  });
  const BountyListingRequest = IDL.Record({
    'prev' : IDL.Opt(IDL.Nat),
    'take' : IDL.Opt(IDL.Nat),
    'filter' : IDL.Opt(IDL.Vec(BountyFilter)),
  });
  const BountyListingResponse = IDL.Variant({
    'ok' : IDL.Vec(Bounty),
    'err' : IDL.Text,
  });
  const PaginationRequest = IDL.Record({
    'prev' : IDL.Opt(IDL.Text),
    'take' : IDL.Opt(IDL.Nat),
  });
  const PendingSubmission = IDL.Record({
    'attestation_types' : IDL.Vec(IDL.Text),
    'wasm_id' : IDL.Text,
    'commit_hash' : IDL.Vec(IDL.Nat8),
    'repo_url' : IDL.Text,
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const ICRC118WasmRegistryCanister = IDL.Service({
    'finalize_verification' : IDL.Func(
        [IDL.Text, VerificationOutcome, ICRC16Map__5],
        [Result_3],
        [],
      ),
    'get_app_listings' : IDL.Func(
        [AppListingRequest],
        [AppListingResponse],
        ['query'],
      ),
    'get_attestations_for_wasm' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(AttestationRecord)],
        ['query'],
      ),
    'get_bounties_for_wasm' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(Bounty)],
        ['query'],
      ),
    'get_canister_type_version' : IDL.Func(
        [GetCanisterTypeVersionRequest],
        [Result_2],
        ['query'],
      ),
    'get_tip' : IDL.Func([], [Tip], ['query']),
    'get_verification_request' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(VerificationRequest)],
        ['query'],
      ),
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
    'icrc126_file_attestation' : IDL.Func(
        [AttestationRequest],
        [AttestationResult],
        [],
      ),
    'icrc126_file_divergence' : IDL.Func(
        [DivergenceReportRequest],
        [DivergenceResult],
        [],
      ),
    'icrc126_verification_request' : IDL.Func(
        [VerificationRequest],
        [IDL.Nat],
        [],
      ),
    'icrc127_create_bounty' : IDL.Func(
        [CreateBountyRequest],
        [CreateBountyResult],
        [],
      ),
    'icrc127_get_bounty' : IDL.Func([IDL.Nat], [IDL.Opt(Bounty)], ['query']),
    'icrc127_list_bounties' : IDL.Func(
        [
          IDL.Record({
            'prev' : IDL.Opt(IDL.Nat),
            'take' : IDL.Opt(IDL.Nat),
            'filter' : IDL.Opt(IDL.Vec(ListBountiesFilter)),
          }),
        ],
        [IDL.Vec(Bounty)],
        ['query'],
      ),
    'icrc127_metadata' : IDL.Func([], [ICRC16Map], ['query']),
    'icrc127_submit_bounty' : IDL.Func(
        [BountySubmissionRequest],
        [BountySubmissionResult],
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
    'is_controller_of_type' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result_1],
        [],
      ),
    'is_wasm_verified' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'list_bounties' : IDL.Func(
        [BountyListingRequest],
        [BountyListingResponse],
        ['query'],
      ),
    'list_pending_submissions' : IDL.Func(
        [PaginationRequest],
        [IDL.Vec(PendingSubmission)],
        ['query'],
      ),
    'set_auditor_credentials_canister_id' : IDL.Func(
        [IDL.Principal],
        [Result],
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
