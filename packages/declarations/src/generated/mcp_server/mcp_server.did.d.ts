import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface ApiKeyInfo {
  'created' : Time,
  'principal' : Principal,
  'scopes' : Array<string>,
  'name' : string,
}
export interface ApiKeyMetadata {
  'info' : ApiKeyInfo,
  'hashed_key' : HashedApiKey,
}
export interface CallerActivity {
  'call_count' : bigint,
  'tool_id' : string,
  'caller' : Principal,
}
export interface Destination {
  'owner' : Principal,
  'subaccount' : [] | [Subaccount],
}
export type HashedApiKey = string;
export type Header = [string, string];
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<Header>,
  'certificate_version' : [] | [number],
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<Header>,
  'upgrade' : [] | [boolean],
  'streaming_strategy' : [] | [StreamingStrategy],
  'status_code' : number,
}
export interface McpServer {
  'call_tracker' : ActorMethod<[Principal, UsageStats], Result_2>,
  'create_my_api_key' : ActorMethod<[string, Array<string>], string>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_treasury_balance' : ActorMethod<[Principal], bigint>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_streaming_callback' : ActorMethod<
    [StreamingToken],
    [] | [StreamingCallbackResponse]
  >,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'icrc120_upgrade_finished' : ActorMethod<[], UpgradeFinishedResult>,
  'list_my_api_keys' : ActorMethod<[], Array<ApiKeyMetadata>>,
  'revoke_my_api_key' : ActorMethod<[string], undefined>,
  'set_owner' : ActorMethod<[Principal], Result_1>,
  'withdraw' : ActorMethod<[Principal, bigint, Destination], Result>,
}
export type Result = { 'ok' : bigint } |
  { 'err' : TreasuryError };
export type Result_1 = { 'ok' : null } |
  { 'err' : TreasuryError };
export type Result_2 = { 'ok' : null } |
  { 'err' : string };
export type StreamingCallback = ActorMethod<
  [StreamingToken],
  [] | [StreamingCallbackResponse]
>;
export interface StreamingCallbackResponse {
  'token' : [] | [StreamingToken],
  'body' : Uint8Array | number[],
}
export type StreamingStrategy = {
    'Callback' : { 'token' : StreamingToken, 'callback' : StreamingCallback }
  };
export type StreamingToken = Uint8Array | number[];
export type Subaccount = Uint8Array | number[];
export type Time = bigint;
export type Timestamp = bigint;
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
export type UpgradeFinishedResult = { 'Failed' : [bigint, string] } |
  { 'Success' : bigint } |
  { 'InProgress' : bigint };
export interface UsageStats {
  'start_timestamp_ns' : Time,
  'end_timestamp_ns' : Time,
  'activity' : Array<CallerActivity>,
}
export interface _SERVICE extends McpServer {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
