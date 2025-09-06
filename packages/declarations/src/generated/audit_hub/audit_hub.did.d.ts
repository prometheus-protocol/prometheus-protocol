import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuditHub {
  'burn_tokens' : ActorMethod<[Principal, TokenId, Balance], Result>,
  'cleanup_expired_lock' : ActorMethod<[BountyId], Result>,
  'get_available_balance' : ActorMethod<[Principal, TokenId], Balance>,
  'get_bounty_lock' : ActorMethod<[BountyId], [] | [BountyLock]>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_stake_requirement' : ActorMethod<[TokenId], [] | [Balance]>,
  'get_staked_balance' : ActorMethod<[Principal, TokenId], Balance>,
  'is_bounty_ready_for_collection' : ActorMethod<
    [BountyId, Principal],
    boolean
  >,
  'mint_tokens' : ActorMethod<[Principal, TokenId, Balance], Result>,
  'release_stake' : ActorMethod<[BountyId], Result>,
  'reserve_bounty' : ActorMethod<[BountyId, TokenId], Result>,
  'set_stake_requirement' : ActorMethod<[TokenId, Balance], Result>,
  'transfer_ownership' : ActorMethod<[Principal], Result>,
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
export type Timestamp = bigint;
export type TokenId = string;
export interface _SERVICE extends AuditHub {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
