import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ApiCredential {
  'api_key' : string,
  'created_at' : Timestamp,
  'last_used' : [] | [Timestamp],
  'is_active' : boolean,
  'verifier_principal' : Principal,
}
export interface AssignedJob {
  'verifier' : Principal,
  'assigned_at' : Timestamp,
  'wasm_id' : string,
  'bounty_id' : BountyId,
  'expires_at' : Timestamp,
}
export interface AuditHub {
  'add_verification_job' : ActorMethod<
    [string, string, string, ICRC16Map, bigint, Array<BountyId>],
    Result
  >,
  'admin_add_bounties_to_job' : ActorMethod<
    [string, string, Array<bigint>],
    Result
  >,
  'cleanup_expired_lock' : ActorMethod<[BountyId], Result>,
  'debug_get_bounty' : ActorMethod<[bigint], string>,
  'deposit_stake' : ActorMethod<[TokenId, Balance], Result>,
  'generate_api_key' : ActorMethod<[], Result_3>,
  'get_available_balance_by_audit_type' : ActorMethod<
    [Principal, string],
    Balance
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
  'get_stake_requirement' : ActorMethod<[string], [] | [[TokenId, Balance]]>,
  'get_staked_balance' : ActorMethod<[Principal, TokenId], Balance>,
  'get_verifier_profile' : ActorMethod<[Principal, TokenId], VerifierProfile>,
  'has_active_bounty_lock' : ActorMethod<[Principal], boolean>,
  'is_bounty_ready_for_collection' : ActorMethod<
    [BountyId, Principal],
    boolean
  >,
  'list_api_keys' : ActorMethod<[], Array<ApiCredential>>,
  'list_assigned_jobs' : ActorMethod<[], Array<[BountyId, AssignedJob]>>,
  'list_pending_jobs' : ActorMethod<[], Array<[string, VerificationJob]>>,
  'mark_verification_complete' : ActorMethod<[string, string], Result>,
  'release_job_assignment' : ActorMethod<[BountyId], Result>,
  'release_stake' : ActorMethod<[BountyId], Result>,
  'request_verification_job_with_api_key' : ActorMethod<[string], Result_2>,
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
  'validate_api_key' : ActorMethod<[string], Result_1>,
  'withdraw_stake' : ActorMethod<[TokenId, Balance], Result>,
}
export type Balance = bigint;
export type BountyId = bigint;
export interface BountyLock {
  'stake_token_id' : TokenId,
  'claimant' : Principal,
  'stake_amount' : Balance,
  'expires_at' : Timestamp,
}
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
export interface ICRC16Property {
  'value' : ICRC16,
  'name' : string,
  'immutable' : boolean,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : Principal } |
  { 'err' : string };
export type Result_2 = { 'ok' : VerificationJobAssignment } |
  { 'err' : string };
export type Result_3 = { 'ok' : string } |
  { 'err' : string };
export type Timestamp = bigint;
export type TokenId = string;
export interface VerificationJob {
  'repo' : string,
  'bounty_ids' : Array<BountyId>,
  'created_at' : Timestamp,
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
  'expires_at' : Timestamp,
}
export interface VerifierProfile {
  'reputation_score' : bigint,
  'total_verifications' : bigint,
  'total_earnings' : Balance,
}
export interface _SERVICE extends AuditHub {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
