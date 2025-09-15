import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Action {
  'aSync' : [] | [bigint],
  'actionType' : string,
  'params' : Uint8Array | number[],
  'retries' : bigint,
}
export interface ActionId { 'id' : bigint, 'time' : Time }
export interface ArchivedTransactionResponse {
  'args' : Array<TransactionRange>,
  'callback' : GetTransactionsFn,
}
export interface BlockType { 'url' : string, 'block_type' : string }
export type CleanSnapshotError = { 'TooManyRequests' : null } |
  { 'NotFound' : null } |
  { 'Generic' : string } |
  { 'Unauthorized' : null };
export interface CleanSnapshotRequest {
  'canister_id' : Principal,
  'snapshot_id' : Uint8Array | number[],
}
export type CleanSnapshotResult = { 'Ok' : bigint } |
  { 'Err' : CleanSnapshotError };
export type ConfigCanisterError = { 'InvalidConfig' : string } |
  { 'Generic' : string } |
  { 'Unauthorized' : null };
export interface ConfigCanisterRequest {
  'configs' : Array<[string, ICRC16]>,
  'canister_id' : Principal,
}
export type ConfigCanisterResult = { 'Ok' : bigint } |
  { 'Err' : ConfigCanisterError };
export type CreateSnapshotError = { 'NotFound' : null } |
  { 'Generic' : string } |
  { 'Unauthorized' : null };
export interface CreateSnapshotRequest {
  'canister_id' : Principal,
  'restart' : boolean,
}
export type CreateSnapshotResult = { 'Ok' : bigint } |
  { 'Err' : CreateSnapshotError };
export interface DataCertificate {
  'certificate' : Uint8Array | number[],
  'hash_tree' : Uint8Array | number[],
}
export interface DeployOrUpgradeRequest {
  'snapshot' : boolean,
  'args' : Uint8Array | number[],
  'hash' : Uint8Array | number[],
  'mode' : canister_install_mode,
  'stop' : boolean,
  'parameters' : [] | [Array<[string, ICRC16__1]>],
  'restart' : boolean,
  'timeout' : bigint,
  'namespace' : string,
}
export interface GetArchivesArgs { 'from' : [] | [Principal] }
export type GetArchivesResult = Array<GetArchivesResultItem>;
export interface GetArchivesResultItem {
  'end' : bigint,
  'canister_id' : Principal,
  'start' : bigint,
}
export type GetBlocksArgs = Array<TransactionRange>;
export interface GetBlocksResult {
  'log_length' : bigint,
  'blocks' : Array<{ 'id' : bigint, 'block' : Value }>,
  'archived_blocks' : Array<ArchivedTransactionResponse>,
}
export interface GetEventsFilter {
  'event_types' : [] | [Array<OrchestrationEventType>],
  'end_time' : [] | [bigint],
  'start_time' : [] | [bigint],
  'canister' : [] | [Principal],
}
export type GetTransactionsFn = ActorMethod<
  [Array<TransactionRange>],
  GetTransactionsResult
>;
export interface GetTransactionsResult {
  'log_length' : bigint,
  'blocks' : Array<{ 'id' : bigint, 'block' : Value }>,
  'archived_blocks' : Array<ArchivedTransactionResponse>,
}
export interface ICRC120Canister {
  'deploy_or_upgrade' : ActorMethod<[DeployOrUpgradeRequest], Result_1>,
  'get_canisters' : ActorMethod<[string], Array<Principal>>,
  'get_tip' : ActorMethod<[], Tip>,
  'hello' : ActorMethod<[], string>,
  'icrc120_clean_snapshot' : ActorMethod<
    [Array<CleanSnapshotRequest>],
    Array<CleanSnapshotResult>
  >,
  'icrc120_config_canister' : ActorMethod<
    [Array<ConfigCanisterRequest>],
    Array<ConfigCanisterResult>
  >,
  'icrc120_create_snapshot' : ActorMethod<
    [Array<CreateSnapshotRequest>],
    Array<CreateSnapshotResult>
  >,
  'icrc120_get_events' : ActorMethod<
    [
      {
        'prev' : [] | [Uint8Array | number[]],
        'take' : [] | [bigint],
        'filter' : [] | [GetEventsFilter],
      },
    ],
    Array<OrchestrationEvent>
  >,
  'icrc120_metadata' : ActorMethod<[], ICRC16Map>,
  'icrc120_revert_snapshot' : ActorMethod<
    [Array<RevertSnapshotRequest>],
    Array<RevertSnapshotResult>
  >,
  'icrc120_start_canister' : ActorMethod<
    [Array<StartCanisterRequest>],
    Array<StartCanisterResult>
  >,
  'icrc120_stop_canister' : ActorMethod<
    [Array<StopCanisterRequest>],
    Array<StopCanisterResult>
  >,
  'icrc120_upgrade_finished' : ActorMethod<[], UpgradeFinishedResult>,
  'icrc120_upgrade_to' : ActorMethod<
    [Array<UpgradeToRequest>],
    Array<UpgradeToResult>
  >,
  'icrc3_get_archives' : ActorMethod<[GetArchivesArgs], GetArchivesResult>,
  'icrc3_get_blocks' : ActorMethod<[GetBlocksArgs], GetBlocksResult>,
  'icrc3_get_tip_certificate' : ActorMethod<[], [] | [DataCertificate]>,
  'icrc3_supported_block_types' : ActorMethod<[], Array<BlockType>>,
  'internal_deploy_or_upgrade' : ActorMethod<
    [InternalDeployRequest],
    undefined
  >,
  'set_mcp_registry_id' : ActorMethod<[Principal], Result>,
}
export type ICRC16 = { 'Int' : bigint } |
  { 'Map' : Array<[string, ICRC16]> } |
  { 'Nat' : bigint } |
  { 'Set' : Array<ICRC16> } |
  { 'Nat16' : number } |
  { 'Nat32' : number } |
  { 'Nat64' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Bool' : boolean } |
  { 'Int8' : number } |
  { 'Nat8' : number } |
  { 'Nats' : Array<bigint> } |
  { 'Text' : string } |
  { 'Bytes' : Uint8Array | number[] } |
  { 'Int16' : number } |
  { 'Int32' : number } |
  { 'Int64' : bigint } |
  { 'Option' : [] | [ICRC16] } |
  { 'Floats' : Array<number> } |
  { 'Float' : number } |
  { 'Principal' : Principal } |
  { 'Array' : Array<ICRC16> } |
  { 'ValueMap' : Array<[ICRC16, ICRC16]> } |
  { 'Class' : Array<ICRC16Property> };
export type ICRC16Map = Array<[string, ICRC16]>;
export type ICRC16Map__1 = Array<[string, ICRC16__1]>;
export interface ICRC16Property {
  'value' : ICRC16,
  'name' : string,
  'immutable' : boolean,
}
export interface ICRC16Property__1 {
  'value' : ICRC16__1,
  'name' : string,
  'immutable' : boolean,
}
export type ICRC16__1 = { 'Int' : bigint } |
  { 'Map' : ICRC16Map__1 } |
  { 'Nat' : bigint } |
  { 'Set' : Array<ICRC16__1> } |
  { 'Nat16' : number } |
  { 'Nat32' : number } |
  { 'Nat64' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Bool' : boolean } |
  { 'Int8' : number } |
  { 'Nat8' : number } |
  { 'Nats' : Array<bigint> } |
  { 'Text' : string } |
  { 'Bytes' : Uint8Array | number[] } |
  { 'Int16' : number } |
  { 'Int32' : number } |
  { 'Int64' : bigint } |
  { 'Option' : [] | [ICRC16__1] } |
  { 'Floats' : Array<number> } |
  { 'Float' : number } |
  { 'Principal' : Principal } |
  { 'Array' : Array<ICRC16__1> } |
  { 'ValueMap' : Array<[ICRC16__1, ICRC16__1]> } |
  { 'Class' : Array<ICRC16Property__1> };
export interface InitArgList {
  'nextCycleActionId' : [] | [bigint],
  'maxExecutions' : [] | [bigint],
  'nextActionId' : bigint,
  'lastActionIdReported' : [] | [bigint],
  'lastCycleReport' : [] | [bigint],
  'initialTimers' : Array<[ActionId, Action]>,
  'expectedExecutionTime' : Time,
  'lastExecutionTime' : Time,
}
export type InitArgs = {};
export interface InternalDeployRequest {
  'hash' : Uint8Array | number[],
  'namespace' : string,
}
export interface OrchestrationEvent {
  'id' : bigint,
  'canister_id' : Principal,
  'timestamp' : bigint,
  'details' : ICRC16,
  'event_type' : OrchestrationEventType,
}
export type OrchestrationEventType = { 'upgrade_initiated' : null } |
  { 'snapshot_requested' : null } |
  { 'snapshot_revert_requested' : null } |
  { 'snapshot_cleaned' : null } |
  { 'upgrade_finished' : null } |
  { 'configuration_changed' : null } |
  { 'snapshot_reverted' : null } |
  { 'canister_started' : null } |
  { 'snapshot_created' : null } |
  { 'canister_stopped' : null };
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : Principal } |
  { 'err' : string };
export type RevertSnapshotError = { 'TooManyRequests' : null } |
  { 'NotFound' : null } |
  { 'Generic' : string } |
  { 'Unauthorized' : null };
export interface RevertSnapshotRequest {
  'canister_id' : Principal,
  'restart' : boolean,
  'snapshot_id' : Uint8Array | number[],
}
export type RevertSnapshotResult = { 'Ok' : bigint } |
  { 'Err' : RevertSnapshotError };
export type StartCanisterError = { 'NotFound' : null } |
  { 'Generic' : string } |
  { 'Unauthorized' : null };
export interface StartCanisterRequest {
  'canister_id' : Principal,
  'timeout' : bigint,
}
export type StartCanisterResult = { 'Ok' : bigint } |
  { 'Err' : StartCanisterError };
export type StopCanisterError = { 'NotFound' : null } |
  { 'Generic' : string } |
  { 'Unauthorized' : null };
export interface StopCanisterRequest {
  'canister_id' : Principal,
  'timeout' : bigint,
}
export type StopCanisterResult = { 'Ok' : bigint } |
  { 'Err' : StopCanisterError };
export type Time = bigint;
export interface Tip {
  'last_block_index' : Uint8Array | number[],
  'hash_tree' : Uint8Array | number[],
  'last_block_hash' : Uint8Array | number[],
}
export interface TransactionRange { 'start' : bigint, 'length' : bigint }
export type UpgradeFinishedResult = { 'Failed' : [bigint, string] } |
  { 'Success' : bigint } |
  { 'InProgress' : bigint };
export type UpgradeToError = { 'InvalidPayment' : null } |
  { 'Generic' : string } |
  { 'Unauthorized' : null } |
  { 'WasmUnavailable' : null };
export interface UpgradeToRequest {
  'snapshot' : boolean,
  'args' : Uint8Array | number[],
  'hash' : Uint8Array | number[],
  'mode' : canister_install_mode,
  'stop' : boolean,
  'canister_id' : Principal,
  'parameters' : [] | [Array<[string, ICRC16]>],
  'restart' : boolean,
  'timeout' : bigint,
}
export type UpgradeToRequestId = bigint;
export type UpgradeToResult = { 'Ok' : UpgradeToRequestId } |
  { 'Err' : UpgradeToError };
export type Value = { 'Int' : bigint } |
  { 'Map' : Array<[string, Value]> } |
  { 'Nat' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string } |
  { 'Array' : Array<Value> };
export type canister_install_mode = { 'reinstall' : null } |
  {
    'upgrade' : [] | [
      {
        'wasm_memory_persistence' : [] | [
          { 'keep' : null } |
            { 'replace' : null }
        ],
        'skip_pre_upgrade' : [] | [boolean],
      }
    ]
  } |
  { 'install' : null };
export interface _SERVICE extends ICRC120Canister {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
