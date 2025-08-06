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
export interface CanisterType {
  'canister_type_namespace' : string,
  'controllers' : Array<Principal>,
  'metadata' : ICRC16Map,
  'repo' : string,
  'canister_type_name' : string,
  'description' : string,
  'versions' : Array<CanisterVersion>,
  'forked_from' : [] | [CanisterVersion],
}
export interface CanisterVersion {
  'canister_type_namespace' : string,
  'version_number' : [bigint, bigint, bigint],
  'calculated_hash' : Uint8Array | number[],
}
export interface CreateCanisterType {
  'canister_type_namespace' : string,
  'controllers' : [] | [Array<Principal>],
  'metadata' : ICRC16Map,
  'repo' : string,
  'canister_type_name' : string,
  'description' : string,
  'forked_from' : [] | [CanisterVersion],
}
export type CreateCanisterTypeResult = { 'Ok' : bigint } |
  { 'Error' : { 'Generic' : string } | { 'Unauthorized' : null } };
export interface DataCertificate {
  'certificate' : Uint8Array | number[],
  'hash_tree' : Uint8Array | number[],
}
export interface DeprecateRequest {
  'canister_type_namespace' : string,
  'hash' : Uint8Array | number[],
  'version_number' : [bigint, bigint, bigint],
  'deprecation_flag' : [] | [boolean],
  'reason' : [] | [string],
}
export type DeprecateResult = { 'Ok' : bigint } |
  {
    'Error' : { 'NotFound' : null } |
      { 'Generic' : string } |
      { 'Unauthorized' : null }
  };
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
export type GetCanisterTypesFilter = { 'controller' : Principal } |
  { 'namespace' : string };
export interface GetCanisterTypesRequest {
  'prev' : [] | [string],
  'take' : [] | [bigint],
  'filter' : Array<GetCanisterTypesFilter>,
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
export interface GetUpgradePathRequest {
  'canister_type_namespace' : string,
  'current_version' : Uint8Array | number[],
  'target_version' : Uint8Array | number[],
}
export interface GetWasmChunkRequest {
  'canister_type_namespace' : string,
  'hash' : Uint8Array | number[],
  'version_number' : [bigint, bigint, bigint],
  'chunk_id' : bigint,
}
export type GetWasmChunkResponse = {
    'Ok' : {
      'expected_wasm_hash' : Uint8Array | number[],
      'canister_type_namespace' : string,
      'expected_chunk_hash' : Uint8Array | number[],
      'version_number' : [bigint, bigint, bigint],
      'chunk_id' : bigint,
      'wasm_chunk' : Uint8Array | number[],
    }
  } |
  { 'Err' : string };
export type GetWasmsFilter = { 'canister_type_namespace' : string } |
  { 'controllers' : Array<Principal> } |
  { 'previous' : CanisterVersion } |
  { 'hash' : Uint8Array | number[] } |
  { 'version_number' : [bigint, bigint, bigint] } |
  { 'canister' : Principal } |
  { 'version_max' : [bigint, [] | [bigint], [] | [bigint]] } |
  { 'version_min' : [bigint, [] | [bigint], [] | [bigint]] };
export interface ICRC118WasmRegistryCanister {
  'get_tip' : ActorMethod<[], Tip>,
  'hello' : ActorMethod<[], string>,
  'icrc10_supported_standards' : ActorMethod<[], Array<SupportedStandard>>,
  'icrc118_create_canister_type' : ActorMethod<
    [Array<CreateCanisterType>],
    Array<CreateCanisterTypeResult>
  >,
  'icrc118_deprecate' : ActorMethod<[DeprecateRequest], DeprecateResult>,
  'icrc118_get_canister_types' : ActorMethod<
    [GetCanisterTypesRequest],
    Array<CanisterType>
  >,
  'icrc118_get_upgrade_path' : ActorMethod<
    [GetUpgradePathRequest],
    Array<CanisterVersion>
  >,
  'icrc118_get_wasm_chunk' : ActorMethod<
    [GetWasmChunkRequest],
    GetWasmChunkResponse
  >,
  'icrc118_get_wasms' : ActorMethod<
    [
      {
        'prev' : [] | [WasmVersionPointer],
        'take' : [] | [bigint],
        'filter' : [] | [Array<GetWasmsFilter>],
      },
    ],
    Array<Wasm>
  >,
  'icrc118_manage_controller' : ActorMethod<
    [Array<ManageControllerRequest>],
    Array<ManageControllerResult>
  >,
  'icrc118_update_wasm' : ActorMethod<[UpdateWasmRequest], UpdateWasmResult>,
  'icrc118_upload_wasm_chunk' : ActorMethod<[UploadRequest], UploadResponse>,
  'icrc3_get_archives' : ActorMethod<[GetArchivesArgs], GetArchivesResult>,
  'icrc3_get_blocks' : ActorMethod<[GetBlocksArgs], GetBlocksResult>,
  'icrc3_get_tip_certificate' : ActorMethod<[], [] | [DataCertificate]>,
  'icrc3_supported_block_types' : ActorMethod<[], Array<BlockType>>,
  'test_simulate_install' : ActorMethod<
    [Principal, string, [bigint, bigint, bigint]],
    boolean
  >,
}
export type ICRC16 = { 'Int' : bigint } |
  { 'Map' : ICRC16Map } |
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
export interface ICRC16Property {
  'value' : ICRC16,
  'name' : string,
  'immutable' : boolean,
}
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
export interface ManageControllerRequest {
  'op' : { 'Add' : null } |
    { 'Remove' : null },
  'controller' : Principal,
  'canister_type_namespace' : string,
}
export type ManageControllerResult = { 'Ok' : bigint } |
  {
    'Error' : { 'NotFound' : null } |
      { 'Generic' : string } |
      { 'Unauthorized' : null }
  };
export interface SupportedStandard { 'url' : string, 'name' : string }
export type Time = bigint;
export interface Tip {
  'last_block_index' : Uint8Array | number[],
  'hash_tree' : Uint8Array | number[],
  'last_block_hash' : Uint8Array | number[],
}
export interface TransactionRange { 'start' : bigint, 'length' : bigint }
export interface UpdateWasmRequest {
  'canister_type_namespace' : string,
  'previous' : [] | [CanisterVersion],
  'expected_chunks' : Array<Uint8Array | number[]>,
  'metadata' : ICRC16Map,
  'repo' : string,
  'description' : string,
  'version_number' : [bigint, bigint, bigint],
  'expected_hash' : Uint8Array | number[],
}
export type UpdateWasmResult = { 'Ok' : bigint } |
  {
    'Error' : { 'NonDeprecatedWasmFound' : Uint8Array | number[] } |
      { 'Generic' : string } |
      { 'Unauthorized' : null }
  };
export interface UploadRequest {
  'canister_type_namespace' : string,
  'expected_chunk_hash' : Uint8Array | number[],
  'version_number' : [bigint, bigint, bigint],
  'chunk_id' : bigint,
  'wasm_chunk' : Uint8Array | number[],
}
export interface UploadResponse { 'total_chunks' : bigint, 'chunk_id' : bigint }
export type Value = { 'Int' : bigint } |
  { 'Map' : Array<[string, Value]> } |
  { 'Nat' : bigint } |
  { 'Blob' : Uint8Array | number[] } |
  { 'Text' : string } |
  { 'Array' : Array<Value> };
export interface Wasm {
  'created' : bigint,
  'canister_type_namespace' : string,
  'previous' : [] | [CanisterVersion],
  'metadata' : ICRC16Map,
  'hash' : Uint8Array | number[],
  'repo' : string,
  'description' : string,
  'version_number' : [bigint, bigint, bigint],
  'calculated_hash' : Uint8Array | number[],
  'deprecated' : boolean,
  'chunkCount' : bigint,
  'chunks' : Array<Uint8Array | number[]>,
}
export interface WasmVersionPointer {
  'canister_type_namespace' : string,
  'version_number' : [bigint, bigint, bigint],
}
export interface _SERVICE extends ICRC118WasmRegistryCanister {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
