import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface Action {
  'aSync' : [] | [bigint],
  'actionType' : string,
  'params' : Uint8Array | number[],
  'retries' : bigint,
}
export interface ActionId { 'id' : bigint, 'time' : Time }
export interface AppListing {
  'id' : string,
  'banner_url' : string,
  'publisher' : string,
  'name' : string,
  'description' : string,
  'icon_url' : string,
  'security_tier' : SecurityTier,
  'category' : string,
  'namespace' : string,
}
export type AppListingFilter = { 'publisher' : string } |
  { 'name' : string } |
  { 'namespace' : string };
export interface AppListingRequest {
  'prev' : [] | [string],
  'take' : [] | [bigint],
  'filter' : [] | [Array<AppListingFilter>],
}
export type AppListingResponse = { 'ok' : Array<AppListing> } |
  { 'err' : string };
export interface ArchivedTransactionResponse {
  'args' : Array<TransactionRange>,
  'callback' : GetTransactionsFn,
}
export interface AttestationRecord {
  'audit_type' : string,
  'metadata' : ICRC16Map__5,
  'auditor' : Principal,
  'timestamp' : Time__1,
}
export interface AttestationRequest {
  'metadata' : ICRC16Map__3,
  'wasm_id' : string,
}
export type AttestationResult = { 'Ok' : bigint } |
  {
    'Error' : { 'NotFound' : null } |
      { 'Generic' : string } |
      { 'Unauthorized' : null }
  };
export interface BlockType { 'url' : string, 'block_type' : string }
export interface Bounty {
  'claims' : Array<ClaimRecord>,
  'created' : bigint,
  'creator' : Principal,
  'token_amount' : bigint,
  'bounty_metadata' : ICRC16Map,
  'claimed' : [] | [bigint],
  'token_canister_id' : Principal,
  'challenge_parameters' : ICRC16,
  'validation_call_timeout' : bigint,
  'bounty_id' : bigint,
  'validation_canister_id' : Principal,
  'claimed_date' : [] | [bigint],
  'timeout_date' : [] | [bigint],
  'payout_fee' : bigint,
}
export type BountyFilter = { 'status' : BountyStatus } |
  { 'audit_type' : string } |
  { 'creator' : Principal };
export interface BountyListingRequest {
  'prev' : [] | [bigint],
  'take' : [] | [bigint],
  'filter' : [] | [Array<BountyFilter>],
}
export type BountyListingResponse = { 'ok' : Array<Bounty> } |
  { 'err' : string };
export type BountyStatus = { 'Claimed' : null } |
  { 'Open' : null };
export interface BountySubmissionRequest {
  'account' : [] | [Account],
  'bounty_id' : bigint,
  'submission' : ICRC16__1,
}
export type BountySubmissionResult = {
    'Ok' : { 'result' : [] | [RunBountyResult__1], 'claim_id' : bigint }
  } |
  {
    'Error' : { 'Generic' : string } |
      { 'NoMatch' : null } |
      { 'PayoutFailed' : TransferError }
  };
export interface CanisterType {
  'canister_type_namespace' : string,
  'controllers' : Array<Principal>,
  'metadata' : ICRC16Map__4,
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
export interface ClaimRecord {
  'result' : [] | [RunBountyResult],
  'claim_account' : [] | [Account],
  'time_submitted' : bigint,
  'claim_id' : bigint,
  'caller' : Principal,
  'claim_metadata' : ICRC16Map,
  'submission' : ICRC16,
}
export interface CreateBountyRequest {
  'bounty_metadata' : ICRC16Map__1,
  'challenge_parameters' : ICRC16__1,
  'start_date' : [] | [bigint],
  'bounty_id' : [] | [bigint],
  'validation_canister_id' : Principal,
  'timeout_date' : bigint,
}
export type CreateBountyResult = {
    'Ok' : { 'trx_id' : [] | [bigint], 'bounty_id' : bigint }
  } |
  { 'Error' : { 'InsufficientAllowance' : null } | { 'Generic' : string } };
export interface CreateCanisterType {
  'canister_type_namespace' : string,
  'controllers' : [] | [Array<Principal>],
  'metadata' : ICRC16Map__4,
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
export interface DivergenceReportRequest {
  'metadata' : [] | [ICRC16Map__3],
  'wasm_id' : string,
  'divergence_report' : string,
}
export type DivergenceResult = { 'Ok' : bigint } |
  { 'Error' : { 'NotFound' : null } | { 'Generic' : string } };
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
export interface GetCanisterTypeVersionRequest {
  'canister_type_namespace' : string,
  'version_number' : [bigint, bigint, bigint],
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
  'finalize_verification' : ActorMethod<
    [string, VerificationOutcome, ICRC16Map__5],
    Result_3
  >,
  'get_app_listings' : ActorMethod<[AppListingRequest], AppListingResponse>,
  'get_attestations_for_wasm' : ActorMethod<[string], Array<AttestationRecord>>,
  'get_bounties_for_wasm' : ActorMethod<[string], Array<Bounty>>,
  'get_canister_type_version' : ActorMethod<
    [GetCanisterTypeVersionRequest],
    Result_2
  >,
  'get_tip' : ActorMethod<[], Tip>,
  'get_verification_request' : ActorMethod<
    [string],
    [] | [VerificationRequest]
  >,
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
  'icrc126_file_attestation' : ActorMethod<
    [AttestationRequest],
    AttestationResult
  >,
  'icrc126_file_divergence' : ActorMethod<
    [DivergenceReportRequest],
    DivergenceResult
  >,
  'icrc126_verification_request' : ActorMethod<[VerificationRequest], bigint>,
  'icrc127_create_bounty' : ActorMethod<
    [CreateBountyRequest],
    CreateBountyResult
  >,
  'icrc127_get_bounty' : ActorMethod<[bigint], [] | [Bounty]>,
  'icrc127_list_bounties' : ActorMethod<
    [
      {
        'prev' : [] | [bigint],
        'take' : [] | [bigint],
        'filter' : [] | [Array<ListBountiesFilter>],
      },
    ],
    Array<Bounty>
  >,
  'icrc127_metadata' : ActorMethod<[], ICRC16Map>,
  'icrc127_submit_bounty' : ActorMethod<
    [BountySubmissionRequest],
    BountySubmissionResult
  >,
  'icrc3_get_archives' : ActorMethod<[GetArchivesArgs], GetArchivesResult>,
  'icrc3_get_blocks' : ActorMethod<[GetBlocksArgs], GetBlocksResult>,
  'icrc3_get_tip_certificate' : ActorMethod<[], [] | [DataCertificate]>,
  'icrc3_supported_block_types' : ActorMethod<[], Array<BlockType>>,
  'is_controller_of_type' : ActorMethod<[string, Principal], Result_1>,
  'is_wasm_verified' : ActorMethod<[string], boolean>,
  'list_bounties' : ActorMethod<[BountyListingRequest], BountyListingResponse>,
  'list_pending_submissions' : ActorMethod<
    [PaginationRequest],
    Array<PendingSubmission>
  >,
  'set_auditor_credentials_canister_id' : ActorMethod<[Principal], Result>,
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
export type ICRC16Map__3 = Array<[string, ICRC16__2]>;
export type ICRC16Map__4 = Array<[string, ICRC16__3]>;
export type ICRC16Map__5 = Array<[string, ICRC16__4]>;
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
export interface ICRC16Property__2 {
  'value' : ICRC16__2,
  'name' : string,
  'immutable' : boolean,
}
export interface ICRC16Property__3 {
  'value' : ICRC16__3,
  'name' : string,
  'immutable' : boolean,
}
export interface ICRC16Property__4 {
  'value' : ICRC16__4,
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
export type ICRC16__2 = { 'Int' : bigint } |
  { 'Map' : ICRC16Map__3 } |
  { 'Nat' : bigint } |
  { 'Set' : Array<ICRC16__2> } |
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
  { 'Option' : [] | [ICRC16__2] } |
  { 'Floats' : Array<number> } |
  { 'Float' : number } |
  { 'Principal' : Principal } |
  { 'Array' : Array<ICRC16__2> } |
  { 'ValueMap' : Array<[ICRC16__2, ICRC16__2]> } |
  { 'Class' : Array<ICRC16Property__2> };
export type ICRC16__3 = { 'Int' : bigint } |
  { 'Map' : ICRC16Map__4 } |
  { 'Nat' : bigint } |
  { 'Set' : Array<ICRC16__3> } |
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
  { 'Option' : [] | [ICRC16__3] } |
  { 'Floats' : Array<number> } |
  { 'Float' : number } |
  { 'Principal' : Principal } |
  { 'Array' : Array<ICRC16__3> } |
  { 'ValueMap' : Array<[ICRC16__3, ICRC16__3]> } |
  { 'Class' : Array<ICRC16Property__3> };
export type ICRC16__4 = { 'Int' : bigint } |
  { 'Map' : Array<[string, ICRC16__4]> } |
  { 'Nat' : bigint } |
  { 'Set' : Array<ICRC16__4> } |
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
  { 'Option' : [] | [ICRC16__4] } |
  { 'Floats' : Array<number> } |
  { 'Float' : number } |
  { 'Principal' : Principal } |
  { 'Array' : Array<ICRC16__4> } |
  { 'ValueMap' : Array<[ICRC16__4, ICRC16__4]> } |
  { 'Class' : Array<ICRC16Property__4> };
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
export type ListBountiesFilter = { 'claimed_by' : Account } |
  { 'validation_canister' : Principal } |
  { 'metadata' : ICRC16Map__1 } |
  { 'claimed' : boolean } |
  { 'created_after' : bigint } |
  { 'created_before' : bigint };
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
export interface PaginationRequest {
  'prev' : [] | [string],
  'take' : [] | [bigint],
}
export interface PendingSubmission {
  'attestation_types' : Array<string>,
  'wasm_id' : string,
  'commit_hash' : Uint8Array | number[],
  'repo_url' : string,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : boolean } |
  { 'err' : string };
export type Result_2 = { 'ok' : Wasm } |
  { 'err' : string };
export type Result_3 = { 'ok' : bigint } |
  { 'err' : string };
export interface RunBountyResult {
  'result' : { 'Invalid' : null } |
    { 'Valid' : null },
  'metadata' : ICRC16,
  'trx_id' : [] | [bigint],
}
export interface RunBountyResult__1 {
  'result' : { 'Invalid' : null } |
    { 'Valid' : null },
  'metadata' : ICRC16__1,
  'trx_id' : [] | [bigint],
}
export type SecurityTier = { 'Gold' : null } |
  { 'Bronze' : null } |
  { 'Unranked' : null } |
  { 'Silver' : null };
export interface SupportedStandard { 'url' : string, 'name' : string }
export type Time = bigint;
export type Time__1 = bigint;
export type Timestamp = bigint;
export interface Tip {
  'last_block_index' : Uint8Array | number[],
  'hash_tree' : Uint8Array | number[],
  'last_block_hash' : Uint8Array | number[],
}
export interface TransactionRange { 'start' : bigint, 'length' : bigint }
export type TransferError = {
    'GenericError' : { 'message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : null } |
  { 'BadBurn' : { 'min_burn_amount' : bigint } } |
  { 'Duplicate' : { 'duplicate_of' : bigint } } |
  { 'BadFee' : { 'expected_fee' : bigint } } |
  { 'CreatedInFuture' : { 'ledger_time' : Timestamp } } |
  { 'TooOld' : null } |
  { 'InsufficientFunds' : { 'balance' : bigint } };
export interface UpdateWasmRequest {
  'canister_type_namespace' : string,
  'previous' : [] | [CanisterVersion],
  'expected_chunks' : Array<Uint8Array | number[]>,
  'metadata' : ICRC16Map__4,
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
export type VerificationOutcome = { 'Rejected' : null } |
  { 'Verified' : null };
export interface VerificationRequest {
  'metadata' : ICRC16Map__3,
  'repo' : string,
  'commit_hash' : Uint8Array | number[],
  'wasm_hash' : Uint8Array | number[],
}
export interface Wasm {
  'created' : bigint,
  'canister_type_namespace' : string,
  'previous' : [] | [CanisterVersion],
  'metadata' : ICRC16Map__4,
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
