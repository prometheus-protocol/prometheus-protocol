import Map "mo:map/Map";
import Blob "mo:base/Blob";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Buffer "mo:base/Buffer";
import Time "mo:base/Time";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import { ic } "mo:ic";
import Base16 "mo:base16/Base16";
import Vector "mo:vector";
import Array "mo:base/Array";

/**
 * The UsageTracker canister serves as a high-throughput logbook for the "Proof-of-Use" system.
 * It accepts usage statistics from approved MCP server canisters and makes them available to a designated payout canister.
 *
 * Security Model (MVP):
 * Authorization is based on the Wasm hash of the calling canister. A canister is considered "approved"
 * if its Wasm hash is present in an admin-managed allowlist. This implies that the canister's Wasm
 * has passed a `beacon_v1` audit, verifying that its usage reporting logic is correct and cannot be tampered with.
 */
shared ({ caller = deployer }) persistent actor class UsageTracker() {

  // ==================================================================================================
  // TYPES
  // ==================================================================================================

  public type CallerActivity = {
    caller : Principal;
    tool_id : Text; // e.g., "get_balance", "execute_swap"
    call_count : Nat;
  };

  public type UsageStats = {
    start_timestamp_ns : Time.Time;
    end_timestamp_ns : Time.Time;
    activity : [CallerActivity];
    // The signature field is omitted for this MVP implementation.
  };

  public type LogEntry = {
    server_id : Principal;
    timestamp : Time.Time;
    stats : UsageStats;
  };

  // This struct holds all the aggregated metrics for a single server.
  public type ServerMetrics = {
    var total_invocations : Nat;
    // Maps a user's Principal to their total call count on this server.
    invocations_by_user : Map.Map<Principal, Nat>;
    // Maps a tool_id (Text) to its total call count on this server.
    invocations_by_tool : Map.Map<Text, Nat>;
  };

  // A public-facing, immutable version of ServerMetrics for query calls.
  public type ServerMetricsShared = {
    total_invocations : Nat;
    invocations_by_user : [(Principal, Nat)];
    invocations_by_tool : [(Text, Nat)];
  };

  // ==================================================================================================
  // STATE
  // ==================================================================================================

  // The admin has the sole authority to manage the Wasm hash allowlist.
  var admin : Principal = deployer;

  // The payout canister has the sole authority to read the collected logs.
  var payout_canister : ?Principal = null;

  // The allowlist: A set of approved Wasm hashes. We use a Map with Null values.
  var approved_wasm_hashes = Map.new<Text, Null>();

  // The logbook: A buffer to store incoming usage stats.
  var logs = Vector.new<LogEntry>();

  // The new top-level state for all aggregated data.
  // Maps a server's Principal to its metrics.
  var aggregated_metrics = Map.new<Principal, ServerMetrics>();

  // ==================================================================================================
  // PRIVATE HELPERS (ACCESS CONTROL)
  // ==================================================================================================

  private func is_admin(caller : Principal) : Bool {
    return Principal.equal(admin, caller);
  };

  private func is_payout_canister(caller : Principal) : Bool {
    switch (payout_canister) {
      case (null) { return false }; // No payout canister set, so no one is authorized.
      case (?payout) { return Principal.equal(payout, caller) };
    };
  };

  // Private helper to handle the aggregation logic.
  private func update_metrics(server_id : Principal, stats : UsageStats) {
    // Get the existing metrics for this server, or create a new entry.
    var server_metrics = Option.get(
      Map.get(aggregated_metrics, Map.phash, server_id),
      {
        var total_invocations = 0;
        invocations_by_user = Map.new<Principal, Nat>();
        invocations_by_tool = Map.new<Text, Nat>();
      },
    );

    // Iterate through the activity in the new stats payload.
    for (activity_item : CallerActivity in stats.activity.vals()) {
      // Update total invocations for the server.
      server_metrics.total_invocations += activity_item.call_count;

      // Update invocations by user.
      let user_calls = Option.get(Map.get(server_metrics.invocations_by_user, Map.phash, activity_item.caller), 0);
      Map.set(server_metrics.invocations_by_user, Map.phash, activity_item.caller, user_calls + activity_item.call_count);

      // Update invocations by tool.
      let tool_calls = Option.get(Map.get(server_metrics.invocations_by_tool, Map.thash, activity_item.tool_id), 0);
      Map.set(server_metrics.invocations_by_tool, Map.thash, activity_item.tool_id, tool_calls + activity_item.call_count);
    };

    // Put the updated metrics back into the main state map.
    Map.set(aggregated_metrics, Map.phash, server_id, server_metrics);
  };

  // ==================================================================================================
  // PUBLIC METHODS: ADMIN
  // ==================================================================================================

  /// Sets the designated payout canister.
  public shared (msg) func set_payout_canister(canister_id : Principal) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can set the payout canister.");
    };
    payout_canister := ?canister_id;
    return #ok(());
  };

  /// Transfers admin rights to a new principal.
  public shared (msg) func transfer_admin(new_admin : Principal) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can transfer admin rights.");
    };
    admin := new_admin;
    return #ok(());
  };

  /// Adds a Wasm hash to the allowlist of approved servers.
  public shared (msg) func add_approved_wasm_hash(hash : Blob) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can add a Wasm hash.");
    };
    let wasm_id = Base16.encode(hash);
    Map.set(approved_wasm_hashes, Map.thash, wasm_id, null);
    return #ok(());
  };

  /// Removes a Wasm hash from the allowlist.
  public shared (msg) func remove_approved_wasm_hash(hash : Blob) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can remove a Wasm hash.");
    };
    let wasm_id = Base16.encode(hash);
    Map.delete(approved_wasm_hashes, Map.thash, wasm_id);
    return #ok(());
  };

  // ==================================================================================================
  // PUBLIC METHODS: LOGGING (Called by MCP Servers)
  // ==================================================================================================

  /**
    * The primary entry point for MCP servers to submit their usage statistics.
    * This method performs an inter-canister call to verify the caller's Wasm hash against the allowlist.
    */
  public shared (msg) func log_call(stats : UsageStats) : async Result.Result<(), Text> {
    let caller = msg.caller;

    Debug.print("UsageTracker: Received log_call from " # Principal.toText(caller) # " with " # debug_show (Array.size(stats.activity)) # " activity records.");
    // 1. Get the status of the calling canister to retrieve its Wasm hash.
    let status_result = await ic.canister_info({
      canister_id = caller;
      num_requested_changes = null;
    });

    let wasm_hash = switch (status_result.module_hash) {
      case (null) {
        return #err("Could not retrieve Wasm hash for the calling canister.");
      };
      case (?hash) { hash };
    };

    // 2. Verify the Wasm hash is on the allowlist.
    let wasm_id = Base16.encode(wasm_hash);
    if (Option.isNull(Map.get(approved_wasm_hashes, Map.thash, wasm_id))) {
      return #err("Wasm hash not approved. The canister is not authorized to submit logs.");
    };

    // 3. If authorized, create and store the log entry.
    let new_log : LogEntry = {
      server_id = caller;
      timestamp = Time.now();
      stats = stats;
    };
    Vector.add(logs, new_log);

    // 4. Update the aggregated metrics for the UI.
    update_metrics(caller, stats);

    return #ok(());
  };

  // ==================================================================================================
  // PUBLIC METHODS: DATA RETRIEVAL (Called by Payout Canister)
  // ==================================================================================================

  /**
     * Allows the designated payout canister to atomically retrieve all collected logs and clear the buffer.
     * This is an update call because it modifies the canister's state by clearing the logs.
     * This pattern prevents unbounded memory growth and ensures that logs are processed exactly once.
     */
  public shared (msg) func get_and_clear_logs() : async Result.Result<[LogEntry], Text> {
    if (not is_payout_canister(msg.caller)) {
      return #err("Unauthorized: Only the designated payout canister can retrieve and clear logs.");
    };

    // 1. Create a copy of the current logs to be returned.
    let logs_to_return = Vector.toArray(logs);

    // 2. Clear the state buffer to free up memory.
    Vector.clear(logs);

    // 3. Return the copy.
    return #ok(logs_to_return);
  };

  // ==================================================================================================
  // PUBLIC QUERIES (For UI / Devs)
  // ==================================================================================================
  private func to_shared_metrics(metrics : ServerMetrics) : ServerMetricsShared {
    return {
      total_invocations = metrics.total_invocations;
      invocations_by_user = Iter.toArray(Map.entries(metrics.invocations_by_user));
      invocations_by_tool = Iter.toArray(Map.entries(metrics.invocations_by_tool));
    };
  };

  /// Returns the aggregated metrics for a specific server.
  public shared query func get_metrics_for_server(server_id : Principal) : async ?ServerMetricsShared {
    // Use Option.map to cleanly apply the conversion function if a value exists.
    return Option.map(
      Map.get(aggregated_metrics, Map.phash, server_id),
      to_shared_metrics,
    );
  };

  /// Returns the current admin principal.
  public shared query func get_admin() : async Principal {
    return admin;
  };

  /// Returns the current payout canister principal.
  public shared query func get_payout_canister() : async ?Principal {
    return payout_canister;
  };

  /// Checks if a given Wasm hash is on the allowlist.
  public shared query func is_wasm_hash_approved(hash : Blob) : async Bool {
    let wasm_id = Base16.encode(hash);
    return Option.isSome(Map.get(approved_wasm_hashes, Map.thash, wasm_id));
  };
};
