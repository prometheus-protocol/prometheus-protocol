import Result "mo:base/Result";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Nat8 "mo:base/Nat8";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Debug "mo:base/Debug";

import Map "mo:map/Map";
import Json "mo:json";

import McpTypes "mo:mcp-motoko-sdk/mcp/Types";
import AuthTypes "mo:mcp-motoko-sdk/auth/Types";

module {
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
    fetchTokenMetadata : (Principal) -> async Result.Result<TokenInfo, Text>;
  };

  public func getToolDefinition() : McpTypes.Tool {
    {
      name = "add_to_watchlist";
      title = ?"Add Token to Watchlist";
      description = ?"Adds a token canister ID to the user's watchlist. Automatically fetches and caches token metadata.";
      inputSchema = Json.obj([
        ("type", Json.str("object")),
        (
          "properties",
          Json.obj([
            (
              "canister_id",
              Json.obj([
                ("type", Json.str("string")),
                ("description", Json.str("The principal of the token canister to add")),
              ]),
            ),
          ]),
        ),
        ("required", Json.arr([Json.str("canister_id")])),
      ]);
      outputSchema = ?Json.obj([
        ("type", Json.str("object")),
        (
          "properties",
          Json.obj([
            ("success", Json.obj([("type", Json.str("boolean"))])),
            ("message", Json.obj([("type", Json.str("string"))])),
          ]),
        ),
      ]);
      payment = null;
    };
  };

  public func execute(
    deps : Dependencies,
    args : McpTypes.JsonValue,
    auth : ?AuthTypes.AuthInfo,
    cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> (),
  ) : async () {
    let caller = switch (auth) {
      case (?authInfo) { authInfo.principal };
      case (null) {
        return _returnError("Authentication required to add to watchlist.", cb);
      };
    };

    // Extract canister_id from args
    let canisterIdText = switch (Result.toOption(Json.getAsText(args, "canister_id"))) {
      case (?id) { id };
      case (null) {
        return _returnError("Missing 'canister_id' parameter.", cb);
      };
    };

    let canisterId = try {
      Principal.fromText(canisterIdText);
    } catch (_) {
      return _returnError("Invalid canister_id format.", cb);
    };

    let current_list = switch (Map.get(deps.user_watchlists, Map.phash, caller)) {
      case (?list) { list };
      case (null) { [] };
    };

    Debug.print("Adding token " # Principal.toText(canisterId) # " to watchlist of " # Principal.toText(caller));

    // Check if the token already exists in the user's list
    let token_exists = Array.find<Principal>(current_list, func(id) { id == canisterId });

    // Check if metadata is already cached
    let cached_metadata = Map.get(deps.token_metadata_cache, Map.phash, canisterId);

    switch (token_exists, cached_metadata) {
      // Token in list AND metadata cached - nothing to do
      case (?_, ?_) {
        Debug.print("Token " # Principal.toText(canisterId) # " already in watchlist with cached metadata");
        return _returnSuccess("Token already in watchlist.", cb);
      };
      // Token in list but NO metadata - fetch metadata to repair inconsistent state
      case (?_, null) {
        Debug.print("Token " # Principal.toText(canisterId) # " in watchlist but metadata missing, fetching...");
        let metadataResult = await deps.fetchTokenMetadata(canisterId);
        switch (metadataResult) {
          case (#ok(tokenInfo)) {
            Debug.print("Fetched and cached metadata for " # Principal.toText(canisterId));
            Map.set(deps.token_metadata_cache, Map.phash, canisterId, tokenInfo);
            return _returnSuccess("Token metadata restored.", cb);
          };
          case (#err(errorMsg)) {
            Debug.print("Failed to fetch metadata: " # errorMsg);
            return _returnError(errorMsg, cb);
          };
        };
      };
      // Token NOT in list but metadata cached - just add to list
      case (null, ?_) {
        Debug.print("Metadata for token " # Principal.toText(canisterId) # " already in cache, adding to watchlist");
        let new_list = Array.append(current_list, [canisterId]);
        Map.set(deps.user_watchlists, Map.phash, caller, new_list);
        return _returnSuccess("Token added to watchlist.", cb);
      };
      // Token NOT in list and NO metadata - fetch and add
      case (null, null) {
        Debug.print("Token " # Principal.toText(canisterId) # " not in watchlist, fetching metadata...");
        let metadataResult = await deps.fetchTokenMetadata(canisterId);
        switch (metadataResult) {
          case (#ok(tokenInfo)) {
            Debug.print("Fetched metadata for token " # Principal.toText(canisterId) # ": " # tokenInfo.name # " (" # tokenInfo.symbol # ")");
            Map.set(deps.token_metadata_cache, Map.phash, canisterId, tokenInfo);
            let new_list = Array.append(current_list, [canisterId]);
            Map.set(deps.user_watchlists, Map.phash, caller, new_list);
            return _returnSuccess("Token added to watchlist successfully.", cb);
          };
          case (#err(errorMsg)) {
            Debug.print("Failed to fetch metadata for token " # Principal.toText(canisterId) # ": " # errorMsg);
            return _returnError(errorMsg, cb);
          };
        };
      };
    };
  };

  private func _returnError(message : Text, cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> ()) {
    let payload = Json.obj([("success", Json.bool(false)), ("message", Json.str(message))]);
    cb(#ok({ content = [#text({ text = Json.stringify(payload, null) })]; isError = true; structuredContent = ?payload }));
  };

  private func _returnSuccess(message : Text, cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> ()) {
    let payload = Json.obj([("success", Json.bool(true)), ("message", Json.str(message))]);
    cb(#ok({ content = [#text({ text = Json.stringify(payload, null) })]; isError = false; structuredContent = ?payload }));
  };
};
