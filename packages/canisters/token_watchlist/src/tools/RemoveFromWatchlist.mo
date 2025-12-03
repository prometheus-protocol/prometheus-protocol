import Result "mo:base/Result";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Array "mo:base/Array";

import Map "mo:map/Map";
import Json "mo:json";

import McpTypes "mo:mcp-motoko-sdk/mcp/Types";
import AuthTypes "mo:mcp-motoko-sdk/auth/Types";

module {
  public type Dependencies = {
    user_watchlists : Map.Map<Principal, [Principal]>;
  };

  public func getToolDefinition() : McpTypes.Tool {
    {
      name = "remove_from_watchlist";
      title = ?"Remove Token from Watchlist";
      description = ?"Removes a token canister ID from the user's watchlist.";
      inputSchema = Json.obj([
        ("type", Json.str("object")),
        (
          "properties",
          Json.obj([
            (
              "canister_id",
              Json.obj([
                ("type", Json.str("string")),
                ("description", Json.str("The principal of the token canister to remove")),
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
        return _returnError("Authentication required to remove from watchlist.", cb);
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
      case (null) { return _returnSuccess("Token was not in watchlist.", cb) };
    };

    let new_list = Array.filter<Principal>(current_list, func(id) { id != canisterId });

    Map.set(deps.user_watchlists, Map.phash, caller, new_list);
    _returnSuccess("Token removed from watchlist successfully.", cb);
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
