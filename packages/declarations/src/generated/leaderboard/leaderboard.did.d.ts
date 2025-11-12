import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

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
export interface Leaderboard {
  'get_env_requirements' : ActorMethod<
    [],
    {
        'v1' : {
          'dependencies' : Array<EnvDependency>,
          'configuration' : Array<EnvConfig>,
        }
      }
  >,
  'get_last_updated' : ActorMethod<[], Time>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_server_leaderboard' : ActorMethod<[], Array<ServerLeaderboardEntry>>,
  'get_timer_status' : ActorMethod<
    [],
    { 'update_interval_minutes' : bigint, 'is_running' : boolean }
  >,
  'get_tool_invocations_for_server' : ActorMethod<
    [string],
    Array<[string, bigint]>
  >,
  'get_user_leaderboard' : ActorMethod<[], Array<UserLeaderboardEntry>>,
  'init' : ActorMethod<[Principal], undefined>,
  'restart_timer' : ActorMethod<[], Result>,
  'start_timer' : ActorMethod<[], Result>,
  'stop_timer' : ActorMethod<[], Result>,
  'trigger_manual_update' : ActorMethod<[], Result>,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export interface ServerLeaderboardEntry {
  'total_invocations' : bigint,
  'rank' : bigint,
  'server' : string,
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
