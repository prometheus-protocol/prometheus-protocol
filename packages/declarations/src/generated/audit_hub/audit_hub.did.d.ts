import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Account {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export interface Account__1 {
  'owner' : Principal,
  'subaccount' : [] | [Uint8Array | number[]],
}
export interface ApiCredential {
  'api_key' : string,
  'created_at' : Timestamp__1,
  'last_used' : [] | [Timestamp__1],
  'is_active' : boolean,
  'verifier_principal' : Principal,
}
export interface AssignedJob {
  'audit_type' : string,
  'verifier' : Principal,
  'assigned_at' : Timestamp__1,
  'wasm_id' : string,
  'bounty_id' : BountyId,
  'expires_at' : Timestamp__1,
}
export interface AuditHub {
  'add_verification_job' : ActorMethod<
    [string, string, string, ICRC16Map, string, bigint, Array<BountyId>],
    Result
  >,
  'admin_add_bounties_to_job' : ActorMethod<
    [string, string, Array<bigint>],
    Result
  >,
  'cleanup_expired_lock' : ActorMethod<[BountyId], Result>,
  'create_local_bounties_for_job' : ActorMethod<
    [string, string, bigint, bigint, Principal, bigint],
    Result_5
  >,
  'deposit_stake' : ActorMethod<[TokenId, Balance], Result>,
  'generate_api_key' : ActorMethod<[], Result_4>,
  'get_available_balance_by_audit_type' : ActorMethod<
    [Principal, string],
    Balance
  >,
  'get_bounties_for_job' : ActorMethod<[string], Array<Bounty>>,
  'get_bounties_with_locks_for_job' : ActorMethod<
    [string],
    Array<[Bounty, [] | [BountyLock]]>
  >,
  'get_bounty_lock' : ActorMethod<[BountyId], [] | [BountyLock]>,
  'get_env_requirements' : ActorMethod<
    [],
    {
        'v1' : {
          'dependencies' : Array<EnvDependency>,
          'configuration' : Array<EnvConfig>,
        }
      }
  >,
  'get_owner' : ActorMethod<[], Principal>,
  'get_pending_job' : ActorMethod<[string], [] | [VerificationJob]>,
  'get_stake_requirement' : ActorMethod<[string], [] | [[TokenId, Balance]]>,
  'get_staked_balance' : ActorMethod<[Principal, TokenId], Balance>,
  'get_verifier_profile' : ActorMethod<[Principal, TokenId], VerifierProfile>,
  'has_active_bounty_lock' : ActorMethod<[Principal], boolean>,
  'icrc10_supported_standards' : ActorMethod<
    [],
    Array<{ 'url' : string, 'name' : string }>
  >,
  'icrc127_create_bounty' : ActorMethod<
    [CreateBountyRequest],
    CreateBountyResult
  >,
  'icrc127_get_bounty' : ActorMethod<[bigint], [] | [Bounty__1]>,
  'icrc127_list_bounties' : ActorMethod<
    [[] | [Array<ListBountiesFilter>], [] | [bigint], [] | [bigint]],
    Array<Bounty>
  >,
  'icrc127_metadata' : ActorMethod<[], ICRC16Map>,
  'icrc127_submit_bounty' : ActorMethod<
    [BountySubmissionRequest],
    BountySubmissionResult
  >,
  'is_bounty_ready_for_collection' : ActorMethod<
    [BountyId, Principal],
    boolean
  >,
  'list_api_keys' : ActorMethod<[], Array<ApiCredential>>,
  'list_assigned_jobs' : ActorMethod<[], Array<[BountyId, AssignedJob]>>,
  'list_bounties' : ActorMethod<[BountyListingRequest], BountyListingResponse>,
  'list_pending_jobs' : ActorMethod<
    [[] | [bigint], [] | [bigint]],
    { 'total' : bigint, 'jobs' : Array<[string, VerificationJob]> }
  >,
  'mark_verification_complete' : ActorMethod<[string, string], Result>,
  'release_job_assignment' : ActorMethod<[BountyId], Result>,
  'release_stake' : ActorMethod<[BountyId], Result>,
  'request_verification_job_with_api_key' : ActorMethod<[string], Result_3>,
  'reserve_bounty' : ActorMethod<[BountyId, string], Result>,
  'reserve_bounty_with_api_key' : ActorMethod<
    [string, BountyId, string],
    Result
  >,
  'revoke_api_key' : ActorMethod<[string], Result>,
  'set_bounty_sponsor_canister_id' : ActorMethod<[Principal], Result>,
  'set_owner' : ActorMethod<[Principal], Result>,
  'set_registry_canister_id' : ActorMethod<[Principal], Result>,
  'set_stake_requirement' : ActorMethod<[string, TokenId, Balance], Result>,
  'slash_stake_for_incorrect_consensus' : ActorMethod<[BountyId], Result>,
  'validate_api_key' : ActorMethod<[string], Result_2>,
  'withdraw' : ActorMethod<[Principal, bigint, Account], Result_1>,
  'withdraw_stake' : ActorMethod<[TokenId, Balance], Result>,
}
export type Balance = bigint;
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
  { 'creator' : Principal } |
  { 'wasm_id' : string };
export type BountyId = bigint;
export interface BountyListingRequest {
  'prev' : [] | [bigint],
  'take' : [] | [bigint],
  'filter' : [] | [Array<BountyFilter>],
}
export type BountyListingResponse = { 'ok' : Array<Bounty> } |
  { 'err' : string };
export interface BountyLock {
  'stake_token_id' : TokenId,
  'claimant' : Principal,
  'stake_amount' : Balance,
  'expires_at' : Timestamp__1,
}
export type BountyStatus = { 'Claimed' : null } |
  { 'Open' : null };
export interface BountySubmissionRequest {
  'account' : [] | [Account__1],
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
export interface Bounty__1 {
  'claims' : Array<ClaimRecord__1>,
  'created' : bigint,
  'creator' : Principal,
  'token_amount' : bigint,
  'bounty_metadata' : ICRC16Map__2,
  'claimed' : [] | [bigint],
  'token_canister_id' : Principal,
  'challenge_parameters' : ICRC16__1,
  'validation_call_timeout' : bigint,
  'bounty_id' : bigint,
  'validation_canister_id' : Principal,
  'claimed_date' : [] | [bigint],
  'timeout_date' : [] | [bigint],
  'payout_fee' : bigint,
}
export interface ClaimRecord {
  'result' : [] | [RunBountyResult],
  'claim_account' : [] | [Account__1],
  'time_submitted' : bigint,
  'claim_id' : bigint,
  'caller' : Principal,
  'claim_metadata' : ICRC16Map,
  'submission' : ICRC16,
}
export interface ClaimRecord__1 {
  'result' : [] | [RunBountyResult__1],
  'claim_account' : [] | [Account__1],
  'time_submitted' : bigint,
  'claim_id' : bigint,
  'caller' : Principal,
  'claim_metadata' : ICRC16Map__2,
  'submission' : ICRC16__1,
}
export interface CreateBountyRequest {
  'bounty_metadata' : ICRC16Map__2,
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
export interface EnvConfig {
  'key' : string,
  'value_type' : string,
  'setter' : string,
  'required' : boolean,
  'current_value' : [] | [string],
}
export interface EnvDependency {
  'key' : string,
  'setter' : string,
  'required' : boolean,
  'canister_name' : string,
  'current_value' : [] | [Principal],
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
export type ICRC16Map__2 = Array<[string, ICRC16__1]>;
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
  { 'Map' : ICRC16Map__2 } |
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
export type ListBountiesFilter = { 'claimed_by' : Account__1 } |
  { 'validation_canister' : Principal } |
  { 'metadata' : ICRC16Map__2 } |
  { 'claimed' : boolean } |
  { 'created_after' : bigint } |
  { 'created_before' : bigint };
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : bigint } |
  { 'err' : TreasuryError };
export type Result_2 = { 'ok' : Principal } |
  { 'err' : string };
export type Result_3 = { 'ok' : VerificationJobAssignment } |
  { 'err' : string };
export type Result_4 = { 'ok' : string } |
  { 'err' : string };
export type Result_5 = { 'ok' : Array<bigint> } |
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
export type Subaccount = Uint8Array | number[];
export type Timestamp = bigint;
export type Timestamp__1 = bigint;
export type TokenId = string;
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
export type TreasuryError = { 'LedgerTrap' : string } |
  { 'NotOwner' : null } |
  { 'TransferFailed' : TransferError };
export interface VerificationJob {
  'audit_type' : string,
  'creator' : Principal,
  'repo' : string,
  'bounty_ids' : Array<BountyId>,
  'completed_count' : bigint,
  'created_at' : Timestamp__1,
  'build_config' : ICRC16Map,
  'assigned_count' : bigint,
  'wasm_id' : string,
  'required_verifiers' : bigint,
  'commit_hash' : string,
}
export interface VerificationJobAssignment {
  'repo' : string,
  'build_config' : ICRC16Map,
  'wasm_id' : string,
  'bounty_id' : BountyId,
  'commit_hash' : string,
  'expires_at' : Timestamp__1,
}
export interface VerifierProfile {
  'reputation_score' : bigint,
  'total_verifications' : bigint,
  'total_earnings' : Balance,
}
export interface _SERVICE extends AuditHub {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
