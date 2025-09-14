import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Leaderboard {
  'get_last_updated' : ActorMethod<[], Time>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_server_leaderboard' : ActorMethod<[], Array<ServerLeaderboardEntry>>,
  'get_tool_invocations_for_server' : ActorMethod<
    [Principal],
    Array<[string, bigint]>
  >,
  'get_user_leaderboard' : ActorMethod<[], Array<UserLeaderboardEntry>>,
  'init' : ActorMethod<[Principal], undefined>,
  'trigger_manual_update' : ActorMethod<[], Result>,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export interface ServerLeaderboardEntry {
  'total_invocations' : bigint,
  'rank' : bigint,
  'server' : Principal,
}
export type Time = bigint;
export interface UserLeaderboardEntry {
  'total_invocations' : bigint,
  'rank' : bigint,
  'user' : Principal,
}
export interface _SERVICE extends Leaderboard {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
