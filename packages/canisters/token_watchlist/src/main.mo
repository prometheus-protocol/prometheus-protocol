import Result "mo:base/Result";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Option "mo:base/Option";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Time "mo:base/Time";
import Timer "mo:base/Timer";
import Error "mo:base/Error";

import HttpTypes "mo:http-types";
import Map "mo:map/Map";
import Json "mo:json";

import AuthCleanup "mo:mcp-motoko-sdk/auth/Cleanup";
import AuthState "mo:mcp-motoko-sdk/auth/State";
import AuthTypes "mo:mcp-motoko-sdk/auth/Types";
import HttpAssets "mo:mcp-motoko-sdk/mcp/HttpAssets";
import Mcp "mo:mcp-motoko-sdk/mcp/Mcp";
import McpTypes "mo:mcp-motoko-sdk/mcp/Types";
import HttpHandler "mo:mcp-motoko-sdk/mcp/HttpHandler";
import Cleanup "mo:mcp-motoko-sdk/mcp/Cleanup";
import State "mo:mcp-motoko-sdk/mcp/State";
import Payments "mo:mcp-motoko-sdk/mcp/Payments";
import Beacon "mo:mcp-motoko-sdk/mcp/Beacon";
import ApiKey "mo:mcp-motoko-sdk/auth/ApiKey";

import SrvTypes "mo:mcp-motoko-sdk/server/Types";

import IC "mo:ic";

shared ({ caller = deployer }) persistent actor class WatchlistCanister(
  args : ?{
    owner : ?Principal;
  }
) = self {

  // =================================================================================
  // --- TYPE DEFINITIONS ---
  // =================================================================================

  // ICRC-1 Metadata Value Type
  type Value = { #Nat : Nat; #Int : Int; #Blob : Blob; #Text : Text };

  // Rich token information record
  public type TokenInfo = {
    canisterId : Principal;
    symbol : Text;
    name : Text;
    decimals : Nat8;
    fee : Nat;
    lastRefreshed : Nat64;
  };

  // ICRC-1 Token Actor Interface (for inter-canister calls)
  type ICRC1Actor = actor {
    icrc1_metadata : shared query () -> async [(Text, Value)];
  };

  // The canister owner, who can manage treasury funds.
  var owner : Principal = Option.get(do ? { args!.owner! }, deployer);

  // State for certified HTTP assets (like /.well-known/...)
  var stable_http_assets : HttpAssets.StableEntries = [];
  transient let http_assets = HttpAssets.init(stable_http_assets);

  // =================================================================================
  // --- WATCHLIST STATE ---
  // =================================================================================

  // Shared cache of token metadata, indexed by canister ID
  // This deduplicates metadata - store once, reference many times
  var token_metadata_cache : Map.Map<Principal, TokenInfo> = Map.new<Principal, TokenInfo>();

  // Per-user watchlists: just store canister IDs, not full metadata
  // The full TokenInfo is looked up from token_metadata_cache
  var user_watchlists : Map.Map<Principal, [Principal]> = Map.new<Principal, [Principal]>();

  // =================================================================================
  // --- HELPER FUNCTIONS ---
  // =================================================================================

  /**
   * Fetches ICRC-1 metadata from a token canister and returns a TokenInfo record.
   * Returns an error if the fetch fails or required fields are missing.
   */
  private func fetchTokenMetadata(canisterId : Principal) : async Result.Result<TokenInfo, Text> {
    try {
      let tokenActor : ICRC1Actor = actor (Principal.toText(canisterId));
      let metadata = await tokenActor.icrc1_metadata();

      // Extract required fields from metadata
      var symbol : ?Text = null;
      var name : ?Text = null;
      var decimals : ?Nat8 = null;
      var fee : ?Nat = null;

      for ((key, value) in metadata.vals()) {
        if (key == "icrc1:symbol") {
          switch (value) {
            case (#Text(v)) { symbol := ?v };
            case (_) {};
          };
        } else if (key == "icrc1:name") {
          switch (value) {
            case (#Text(v)) { name := ?v };
            case (_) {};
          };
        } else if (key == "icrc1:decimals") {
          switch (value) {
            case (#Nat(v)) { decimals := ?Nat8.fromNat(v) };
            case (_) {};
          };
        } else if (key == "icrc1:fee") {
          switch (value) {
            case (#Nat(v)) { fee := ?v };
            case (_) {};
          };
        };
      };

      // Validate that all required fields were found
      switch (symbol, name, decimals, fee) {
        case (?s, ?n, ?d, ?f) {
          return #ok({
            canisterId = canisterId;
            symbol = s;
            name = n;
            decimals = d;
            fee = f;
            lastRefreshed = Nat64.fromNat(Int.abs(Time.now()));
          });
        };
        case (_) {
          return #err("Token metadata is missing required fields (symbol, name, decimals, or fee)");
        };
      };
    } catch (error) {
      return #err("Failed to fetch token metadata: " # Error.message(error));
    };
  };

  // =================================================================================
  // --- UI BACKEND API ---
  // These methods are called directly by the frontend application.
  // =================================================================================

  /**
   * Retrieves the watchlist for the calling user.
   * Returns an empty array if the user has no watchlist yet.
   * Returns full TokenInfo records by looking up cached metadata.
   */
  public query ({ caller }) func get_my_watchlist() : async [TokenInfo] {
    let canisterIds = switch (Map.get(user_watchlists, Map.phash, caller)) {
      case (?list) { list };
      case (null) { return [] };
    };

    // Look up metadata for each canister ID
    let tokenInfos = Array.mapFilter<Principal, TokenInfo>(
      canisterIds,
      func(canisterId : Principal) : ?TokenInfo {
        Map.get(token_metadata_cache, Map.phash, canisterId);
      },
    );

    return tokenInfos;
  };

  /**
   * Adds a token canister ID to the caller's watchlist.
   * Fetches metadata immediately and stores it in the shared cache.
   * Idempotent: adding a token that already exists will not create duplicates.
   */
  public shared ({ caller }) func add_to_watchlist(token_canister_id : Principal) : async Result.Result<(), Text> {
    let current_list = switch (Map.get(user_watchlists, Map.phash, caller)) {
      case (?list) { list };
      case (null) { [] };
    };

    // Check if the token already exists in the user's list
    let token_exists = Array.find<Principal>(current_list, func(id) { id == token_canister_id });

    switch (token_exists) {
      case (?_) {
        // Already exists, no change
        return #ok(());
      };
      case (null) {
        // Check if metadata is already cached
        let cached_metadata = Map.get(token_metadata_cache, Map.phash, token_canister_id);

        switch (cached_metadata) {
          case (?_) {
            // Metadata already in cache, just add to user's list
            let new_list = Array.append(current_list, [token_canister_id]);
            Map.set(user_watchlists, Map.phash, caller, new_list);
            return #ok(());
          };
          case (null) {
            // Fetch metadata and add to cache
            let metadataResult = await fetchTokenMetadata(token_canister_id);

            switch (metadataResult) {
              case (#ok(tokenInfo)) {
                // Store in cache
                Map.set(token_metadata_cache, Map.phash, token_canister_id, tokenInfo);
                // Add to user's list
                let new_list = Array.append(current_list, [token_canister_id]);
                Map.set(user_watchlists, Map.phash, caller, new_list);
                return #ok(());
              };
              case (#err(errorMsg)) {
                // Return the error without modifying anything
                return #err(errorMsg);
              };
            };
          };
        };
      };
    };
  };

  /**
   * Removes a token canister ID from the caller's watchlist.
   * Does NOT remove from the shared cache (other users may still be watching it).
   * Succeeds even if the token is not in the list.
   */
  public shared ({ caller }) func remove_from_watchlist(token_canister_id : Principal) : async Result.Result<(), Text> {
    let current_list = switch (Map.get(user_watchlists, Map.phash, caller)) {
      case (?list) { list };
      case (null) { return #ok(()) }; // No list, nothing to remove
    };

    let new_list = Array.filter<Principal>(current_list, func(id) { id != token_canister_id });

    Map.set(user_watchlists, Map.phash, caller, new_list);
    return #ok(());
  };

  // =================================================================================
  // --- METADATA REFRESH MECHANISM ---
  // =================================================================================

  /**
   * Refreshes all token metadata in the shared cache.
   * This runs periodically via a timer to keep cached data fresh.
   * Only refreshes tokens that are currently being watched by at least one user.
   */
  private func refreshAllMetadata() : async () {
    Debug.print("Starting metadata refresh cycle...");

    // Collect all unique token canister IDs from all users' watchlists
    let uniqueTokenIds = Map.new<Principal, Bool>();

    for ((principal, tokenIdList) in Map.entries(user_watchlists)) {
      for (tokenId in tokenIdList.vals()) {
        Map.set(uniqueTokenIds, Map.phash, tokenId, true);
      };
    };

    let uniqueCount = Map.size(uniqueTokenIds);
    Debug.print("Found " # Nat.toText(uniqueCount) # " unique tokens to refresh");

    // Fetch fresh metadata for all unique tokens and update the cache
    for ((canisterId, _) in Map.entries(uniqueTokenIds)) {
      try {
        let result = await fetchTokenMetadata(canisterId);
        switch (result) {
          case (#ok(tokenInfo)) {
            Map.set(token_metadata_cache, Map.phash, canisterId, tokenInfo);
          };
          case (#err(errorMsg)) {
            Debug.print("Failed to refresh metadata for " # Principal.toText(canisterId) # ": " # errorMsg);
          };
        };
      } catch (error) {
        Debug.print("Error refreshing " # Principal.toText(canisterId) # ": " # Error.message(error));
      };
    };

    Debug.print("Metadata refresh cycle complete");
  };

  // The application context that holds our state for streams.
  var appContext : McpTypes.AppContext = State.init([]);

  // =================================================================================
  // --- AUTHENTICATION (ENABLED BY DEFAULT) ---
  // TaskPad is a personal application, so authentication is required to identify users.
  // =================================================================================

  let issuerUrl = "https://bfggx-7yaaa-aaaai-q32gq-cai.icp0.io";
  let requiredScopes = ["openid"];

  public query func transformJwksResponse({
    context : Blob;
    response : IC.HttpRequestResult;
  }) : async IC.HttpRequestResult {
    ignore context; // Required by interface but unused
    { response with headers = [] };
  };

  transient let authContext : ?AuthTypes.AuthContext = ?AuthState.init(
    Principal.fromActor(self),
    owner,
    issuerUrl,
    requiredScopes,
    transformJwksResponse,
  );

  // =================================================================================
  // --- OPT-IN: USAGE ANALYTICS (BEACON) ---
  // =================================================================================

  // --- UNCOMMENT THIS BLOCK TO ENABLE THE BEACON ---
  let beaconCanisterId = Principal.fromText("m63pw-fqaaa-aaaai-q33pa-cai");
  transient let beaconContext : ?Beacon.BeaconContext = ?Beacon.init(
    beaconCanisterId, // Public beacon canister ID
    ?(15 * 60) // Send a beacon every 15 minutes
  );
  // --- END OF BEACON BLOCK ---

  // --- Timers ---
  Cleanup.startCleanupTimer<system>(appContext);

  // The AuthCleanup timer only needs to run if authentication is enabled.
  switch (authContext) {
    case (?ctx) { AuthCleanup.startCleanupTimer<system>(ctx) };
    case (null) { Debug.print("Authentication is disabled.") };
  };

  // The Beacon timer only needs to run if the beacon is enabled.
  switch (beaconContext) {
    case (?ctx) { Beacon.startTimer<system>(ctx) };
    case (null) { Debug.print("Beacon is disabled.") };
  };

  // Metadata refresh timer - runs every 24 hours
  let REFRESH_INTERVAL_SECONDS = 24 * 60 * 60; // 24 hours
  ignore Timer.recurringTimer<system>(
    #seconds(REFRESH_INTERVAL_SECONDS),
    func() : async () {
      await refreshAllMetadata();
    },
  );

  // --- 1. DEFINE YOUR TOOLS ---
  transient let tools : [McpTypes.Tool] = [
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
    },
  ];

  // --- 2. DEFINE YOUR TOOL LOGIC ---

  private func _returnError(message : Text, cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> ()) {
    cb(#ok({ content = [#text({ text = message })]; isError = true; structuredContent = null }));
  };

  // Logic for getting the user's watchlist via MCP tool
  func getMyWatchlistTool(args : McpTypes.JsonValue, auth : ?AuthTypes.AuthInfo, cb : (Result.Result<McpTypes.CallToolResult, McpTypes.HandlerError>) -> ()) : async () {
    let caller = switch (auth) {
      case (?authInfo) { authInfo.principal };
      case (null) {
        return _returnError("Authentication required to access watchlist.", cb);
      };
    };

    let canisterIds = switch (Map.get(user_watchlists, Map.phash, caller)) {
      case (?list) { list };
      case (null) { [] };
    };

    // Look up metadata for each canister ID
    let tokenInfos = Array.mapFilter<Principal, TokenInfo>(
      canisterIds,
      func(canisterId : Principal) : ?TokenInfo {
        Map.get(token_metadata_cache, Map.phash, canisterId);
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

  // --- 3. CONFIGURE THE SDK ---
  transient let mcpConfig : McpTypes.McpConfig = {
    self = Principal.fromActor(self);
    allowanceUrl = null;
    serverInfo = {
      name = "org.prometheusprotocol.token-watchlist";
      title = "Token Watchlist Manager";
      version = "0.1.0";
    };
    resources = []; // No static resources for this app
    resourceReader = func(_) { null };
    tools = tools;
    toolImplementations = [
      ("get_my_watchlist", getMyWatchlistTool),
    ];
    beacon = beaconContext;
  };

  // --- 4. CREATE THE SERVER LOGIC ---
  transient let mcpServer = Mcp.createServer(mcpConfig);

  // --- PUBLIC ENTRY POINTS (Unchanged from boilerplate) ---

  public query func get_owner() : async Principal { return owner };
  public shared ({ caller }) func set_owner(new_owner : Principal) : async Result.Result<(), Payments.TreasuryError> {
    if (caller != owner) { return #err(#NotOwner) };
    owner := new_owner;
    return #ok(());
  };
  public shared func get_treasury_balance(ledger_id : Principal) : async Nat {
    return await Payments.get_treasury_balance(Principal.fromActor(self), ledger_id);
  };
  public shared ({ caller }) func withdraw(ledger_id : Principal, amount : Nat, destination : Payments.Destination) : async Result.Result<Nat, Payments.TreasuryError> {
    return await Payments.withdraw(caller, owner, ledger_id, amount, destination);
  };

  private func _create_http_context() : HttpHandler.Context {
    return {
      self = Principal.fromActor(self);
      active_streams = appContext.activeStreams;
      mcp_server = mcpServer;
      streaming_callback = http_request_streaming_callback;
      auth = authContext;
      http_asset_cache = ?http_assets.cache;
      mcp_path = ?"/mcp";
    };
  };

  public query func http_request(req : SrvTypes.HttpRequest) : async SrvTypes.HttpResponse {
    let ctx : HttpHandler.Context = _create_http_context();
    switch (HttpHandler.http_request(ctx, req)) {
      case (?mcpResponse) { return mcpResponse };
      case (null) {
        return {
          status_code = 404;
          headers = [];
          body = Blob.fromArray([]);
          upgrade = null;
          streaming_strategy = null;
        };
      };
    };
  };

  public shared func http_request_update(req : SrvTypes.HttpRequest) : async SrvTypes.HttpResponse {
    let ctx : HttpHandler.Context = _create_http_context();
    let mcpResponse = await HttpHandler.http_request_update(ctx, req);
    switch (mcpResponse) {
      case (?res) { return res };
      case (null) {
        return {
          status_code = 404;
          headers = [];
          body = Blob.fromArray([]);
          upgrade = null;
          streaming_strategy = null;
        };
      };
    };
  };

  public query func http_request_streaming_callback(token : HttpTypes.StreamingToken) : async ?HttpTypes.StreamingCallbackResponse {
    let ctx : HttpHandler.Context = _create_http_context();
    return HttpHandler.http_request_streaming_callback(ctx, token);
  };

  /**
   * Creates a new API key. This API key is linked to the caller's principal.
   * @param name A human-readable name for the key.
   * @returns The raw, unhashed API key. THIS IS THE ONLY TIME IT WILL BE VISIBLE.
   */
  public shared (msg) func create_my_api_key(name : Text, scopes : [Text]) : async Text {
    switch (authContext) {
      case (null) {
        Debug.trap("Authentication is not enabled on this canister.");
      };
      case (?ctx) {
        return await ApiKey.create_my_api_key(
          ctx,
          msg.caller,
          name,
          scopes,
        );
      };
    };
  };

  /** Revoke (delete) an API key owned by the caller.
   * @param key_id The ID of the key to revoke.
   * @returns True if the key was found and revoked, false otherwise.
   */
  public shared (msg) func revoke_my_api_key(key_id : Text) : async () {
    switch (authContext) {
      case (null) {
        Debug.trap("Authentication is not enabled on this canister.");
      };
      case (?ctx) {
        return ApiKey.revoke_my_api_key(ctx, msg.caller, key_id);
      };
    };
  };

  /** List all API keys owned by the caller.
   * @returns A list of API key metadata (but not the raw keys).
   */
  public query (msg) func list_my_api_keys() : async [AuthTypes.ApiKeyMetadata] {
    switch (authContext) {
      case (null) {
        Debug.trap("Authentication is not enabled on this canister.");
      };
      case (?ctx) {
        return ApiKey.list_my_api_keys(ctx, msg.caller);
      };
    };
  };

  /// (5.1) Upgrade finished stub
  public type UpgradeFinishedResult = {
    #InProgress : Nat;
    #Failed : (Nat, Text);
    #Success : Nat;
  };
  private func natNow() : Nat {
    return Int.abs(Time.now());
  };
  public func icrc120_upgrade_finished() : async UpgradeFinishedResult {
    #Success(natNow());
  };
};
