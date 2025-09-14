import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AppBounties {
  'create_bounty' : ActorMethod<
    [string, string, bigint, string, string, string],
    Result_1
  >,
  'delete_bounty' : ActorMethod<[BountyId], Result>,
  'get_all_bounties' : ActorMethod<[], Array<Bounty>>,
  'get_bounty' : ActorMethod<[BountyId], [] | [Bounty]>,
  'get_owner' : ActorMethod<[], Principal>,
  'transfer_ownership' : ActorMethod<[Principal], Result>,
  'update_bounty' : ActorMethod<
    [BountyId, string, string, bigint, string, string, string],
    Result
  >,
}
export interface Bounty {
  'id' : BountyId,
  'status' : string,
  'title' : string,
  'reward_token' : string,
  'reward_amount' : bigint,
  'short_description' : string,
  'created_at' : Timestamp,
  'details_markdown' : string,
}
export type BountyId = bigint;
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : BountyId } |
  { 'err' : string };
export type Timestamp = bigint;
export interface _SERVICE extends AppBounties {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
