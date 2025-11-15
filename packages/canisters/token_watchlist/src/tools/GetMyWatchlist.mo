import Result "mo:base/Result";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Nat8 "mo:base/Nat8";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";

import Map "mo:map/Map";
import Json "mo:json";

import McpTypes "mo:mcp-motoko-sdk/mcp/Types";
import AuthTypes "mo:mcp-motoko-sdk/auth/Types";

module {
  // Import the TokenInfo type
  public type TokenInfo = {
    canisterId : Principal;
    symbol : Text;
    name : Text;
    decimals : Nat8;
    fee : Nat;
    lastRefreshed : Nat64;
  };

  public type Dependencies = {
    user_watchlists : Map.Map<Principal, [Principal]>;
    token_metadata_cache : Map.Map<Principal, TokenInfo>;
  };

  // Tool definition
  public func getToolDefinition() : McpTypes.Tool {
    {
      name = "get_my_watchlist";
      title = ?"Get My Watchlist";
      description = ?"Returns the list of tokens with full metadata that the authenticated user is currently tracking. The agent should use this list to scope its observations and actions.";
      inputSchema = Json.obj([
        ("type", Json.str("object")),
        ("properties", Json.obj([])),
      ]);
      outputSchema = ?Json.obj([
        ("type", Json.str("object")),
        ("properties", Json.obj([("watchlist", Json.obj([("type", Json.str("array")), ("items", Json.obj([("type", Json.str("object")), ("properties", Json.obj([("canisterId", Json.obj([("type", Json.str("string"))])), ("symbol", Json.obj([("type", Json.str("string"))])), ("name", Json.obj([("type", Json.str("string"))])), ("decimals", Json.obj([("type", Json.str("number"))])), ("lastRefreshed", Json.obj([("type", Json.str("string")), ("description", Json.str("Nanosecond timestamp"))]))])), ("required", Json.arr([Json.str("canisterId"), Json.str("symbol"), Json.str("name"), Json.str("decimals"), Json.str("lastRefreshed")]))]))]))])),
        ("required", Json.arr([Json.str("watchlist")])),
      ]);
      payment = null;
    };
  };

  // Tool implementation
  public func execute(
    deps : Dependencies,
    _args : McpTypes.JsonValue,
    auth : ?AuthTypes.AuthInfo,
    cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> (),
  ) : async () {
    let caller = switch (auth) {
      case (?authInfo) { authInfo.principal };
      case (null) {
        return _returnError("Authentication required to access watchlist.", cb);
      };
    };

    let canisterIds = switch (Map.get(deps.user_watchlists, Map.phash, caller)) {
      case (?list) { list };
      case (null) { [] };
    };

    // Look up metadata for each canister ID
    let tokenInfos = Array.mapFilter<Principal, TokenInfo>(
      canisterIds,
      func(canisterId : Principal) : ?TokenInfo {
        Map.get(deps.token_metadata_cache, Map.phash, canisterId);
      },
    );

    // Convert the watchlist to JSON array of TokenInfo objects
    let watchlist_json = Array.map<TokenInfo, McpTypes.JsonValue>(
      tokenInfos,
      func(tokenInfo : TokenInfo) : McpTypes.JsonValue {
        Json.obj([
          ("canisterId", Json.str(Principal.toText(tokenInfo.canisterId))),
          ("symbol", Json.str(tokenInfo.symbol)),
          ("name", Json.str(tokenInfo.name)),
          ("decimals", Json.int(Nat8.toNat(tokenInfo.decimals))),
          ("fee", Json.str(Nat.toText(tokenInfo.fee))),
          ("lastRefreshed", Json.str(Nat64.toText(tokenInfo.lastRefreshed))),
        ]);
      },
    );

    let structuredPayload = Json.obj([("watchlist", Json.arr(watchlist_json))]);

    cb(#ok({ content = [#text({ text = Json.stringify(structuredPayload, null) })]; isError = false; structuredContent = ?structuredPayload }));
  };

  private func _returnError(message : Text, cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> ()) {
    cb(#ok({ content = [#text({ text = message })]; isError = true; structuredContent = null }));
  };
};
