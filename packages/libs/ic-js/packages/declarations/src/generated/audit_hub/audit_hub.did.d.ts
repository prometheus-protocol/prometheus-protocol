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
export interface AuditHub {
  'cleanup_expired_lock' : ActorMethod<[BountyId], Result>,
  'deposit_stake' : ActorMethod<[Balance], Result>,
  'generate_api_key' : ActorMethod<[], Result_2>,
  'get_available_balance' : ActorMethod<[Principal, TokenId], Balance>,
  'get_bounty_lock' : ActorMethod<[BountyId], [] | [BountyLock]>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_stake_requirement' : ActorMethod<[TokenId], [] | [Balance]>,
  'get_staked_balance' : ActorMethod<[Principal, TokenId], Balance>,
  'get_verifier_profile' : ActorMethod<[Principal], VerifierProfile>,
  'is_bounty_ready_for_collection' : ActorMethod<
    [BountyId, Principal],
    boolean
  >,
  'list_api_keys' : ActorMethod<[], Array<ApiCredential>>,
  'release_stake' : ActorMethod<[BountyId], Result>,
  'reserve_bounty' : ActorMethod<[BountyId, TokenId], Result>,
  'reserve_bounty_with_api_key' : ActorMethod<
    [string, BountyId, TokenId],
    Result
  >,
  'revoke_api_key' : ActorMethod<[string], Result>,
  'set_dashboard_canister_id' : ActorMethod<[Principal], Result>,
  'set_stake_requirement' : ActorMethod<[TokenId, Balance], Result>,
  'set_usdc_ledger_id' : ActorMethod<[Principal], Result>,
  'slash_stake_for_incorrect_consensus' : ActorMethod<[BountyId], Result>,
  'transfer_ownership' : ActorMethod<[Principal], Result>,
  'validate_api_key' : ActorMethod<[string], Result_1>,
  'withdraw_stake' : ActorMethod<[Balance], Result>,
}
export type Balance = bigint;
export type BountyId = bigint;
export interface BountyLock {
  'stake_token_id' : TokenId,
  'claimant' : Principal,
  'stake_amount' : Balance,
  'expires_at' : Timestamp,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : Principal } |
  { 'err' : string };
export type Result_2 = { 'ok' : string } |
  { 'err' : string };
export type Timestamp = bigint;
export type TokenId = string;
export interface VerifierProfile {
  'staked_balance_usdc' : Balance,
  'available_balance_usdc' : Balance,
  'reputation_score' : bigint,
  'total_verifications' : bigint,
}
export interface _SERVICE extends AuditHub {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
