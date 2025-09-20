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
 */
shared ({ caller = deployer }) persistent actor class UsageTracker() {

  // ==================================================================================================
  // TYPES
  // ==================================================================================================

  public type CallerActivity = {
    caller : Principal;
    tool_id : Text;
    call_count : Nat;
  };

  public type UsageStats = {
    start_timestamp_ns : Time.Time;
    end_timestamp_ns : Time.Time;
    activity : [CallerActivity];
  };

  public type LogEntry = {
    wasm_id : Text;
    canister_id : Principal;
    timestamp : Time.Time;
    stats : UsageStats;
  };

  public type ServerMetrics = {
    var total_invocations : Nat;
    invocations_by_user : Map.Map<Principal, Nat>;
    invocations_by_tool : Map.Map<Text, Nat>;
  };

  public type ServerMetricsShared = {
    total_invocations : Nat;
    invocations_by_user : [(Principal, Nat)];
    invocations_by_tool : [(Text, Nat)];
  };

  // --- 1. A simplified metrics type specifically for the App Store UI ---
  public type AppMetrics = {
    total_invocations : Nat;
    unique_users : Nat;
    total_tools : Nat;
  };

  // ==================================================================================================
  // STATE
  // ==================================================================================================

  var admin : Principal = deployer;
  var payout_canister : ?Principal = null;
  var approved_wasm_hashes = Map.new<Text, Null>();
  var logs = Vector.new<LogEntry>();

  // The primary state for all aggregated data, keyed by WASM hash for payouts.
  var aggregated_metrics = Map.new<Text, ServerMetrics>();

  // --- 2. A new, lean state map for fast UI queries, keyed by canister_id ---
  var metrics_by_canister = Map.new<Principal, AppMetrics>();

  // ==================================================================================================
  // PRIVATE HELPERS
  // ==================================================================================================

  private func is_admin(caller : Principal) : Bool {
    return Principal.equal(admin, caller);
  };

  private func is_payout_canister(caller : Principal) : Bool {
    switch (payout_canister) {
      case (null) { return false };
      case (?payout) { return Principal.equal(payout, caller) };
    };
  };

  // --- 3. CORRECTED: This helper now updates BOTH state maps efficiently ---
  private func update_metrics(wasm_id : Text, canister_id : Principal, stats : UsageStats) {
    // --- Part A: Update the detailed metrics by wasm_id (for payouts) ---
    var server_metrics = Option.get(
      Map.get(aggregated_metrics, Map.thash, wasm_id),
      {
        var total_invocations = 0;
        invocations_by_user = Map.new<Principal, Nat>();
        invocations_by_tool = Map.new<Text, Nat>();
      },
    );

    for (activity_item : CallerActivity in stats.activity.vals()) {
      server_metrics.total_invocations += activity_item.call_count;
      let user_calls = Option.get(Map.get(server_metrics.invocations_by_user, Map.phash, activity_item.caller), 0);
      Map.set(server_metrics.invocations_by_user, Map.phash, activity_item.caller, user_calls + activity_item.call_count);
      let tool_calls = Option.get(Map.get(server_metrics.invocations_by_tool, Map.thash, activity_item.tool_id), 0);
      Map.set(server_metrics.invocations_by_tool, Map.thash, activity_item.tool_id, tool_calls + activity_item.call_count);
    };
    Map.set(aggregated_metrics, Map.thash, wasm_id, server_metrics);

    // --- Part B: Update the lean metrics by canister_id (for UI) ---
    // We derive the UI metrics from the fully updated `server_metrics` object.
    let app_metrics : AppMetrics = {
      total_invocations = server_metrics.total_invocations;
      unique_users = Map.size(server_metrics.invocations_by_user);
      total_tools = Map.size(server_metrics.invocations_by_tool);
    };
    Map.set(metrics_by_canister, Map.phash, canister_id, app_metrics);
  };

  // ==================================================================================================
  // PUBLIC METHODS: ADMIN
  // ==================================================================================================

  public shared (msg) func set_payout_canister(canister_id : Principal) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can set the payout canister.");
    };
    payout_canister := ?canister_id;
    return #ok(());
  };

  public shared (msg) func transfer_admin(new_admin : Principal) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can transfer admin rights.");
    };
    admin := new_admin;
    return #ok(());
  };

  public shared (msg) func add_approved_wasm_hash(wasm_id : Text) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can add a Wasm hash.");
    };
    Map.set(approved_wasm_hashes, Map.thash, wasm_id, null);
    return #ok(());
  };

  public shared (msg) func remove_approved_wasm_hash(wasm_id : Text) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can remove a Wasm hash.");
    };
    Map.delete(approved_wasm_hashes, Map.thash, wasm_id);
    return #ok(());
  };

  // ==================================================================================================
  // PUBLIC METHODS: LOGGING
  // ==================================================================================================

  public shared (msg) func log_call(stats : UsageStats) : async Result.Result<(), Text> {
    let caller = msg.caller;
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
    let wasm_id = Base16.encode(wasm_hash);
    if (Option.isNull(Map.get(approved_wasm_hashes, Map.thash, wasm_id))) {
      return #err("Wasm hash not approved. The canister is not authorized to submit logs.");
    };

    let new_log : LogEntry = {
      wasm_id = wasm_id;
      canister_id = caller;
      timestamp = Time.now();
      stats = stats;
    };
    Vector.add(logs, new_log);

    // --- 4. CORRECTED: Call the updated helper with both identifiers ---
    update_metrics(wasm_id, caller, stats);

    return #ok(());
  };

  // ==================================================================================================
  // PUBLIC METHODS: DATA RETRIEVAL
  // ==================================================================================================

  public shared (msg) func get_and_clear_logs() : async Result.Result<[LogEntry], Text> {
    if (not is_payout_canister(msg.caller)) {
      return #err("Unauthorized: Only the designated payout canister can retrieve and clear logs.");
    };
    let logs_to_return = Vector.toArray(logs);
    Vector.clear(logs);
    return #ok(logs_to_return);
  };

  // ==================================================================================================
  // PUBLIC QUERIES
  // ==================================================================================================

  // --- 5. NEW: The public query endpoint for the App Store UI ---
  public shared query func get_app_metrics(canister_id : Principal) : async ?AppMetrics {
    return Map.get(metrics_by_canister, Map.phash, canister_id);
  };

  private func to_shared_metrics(metrics : ServerMetrics) : ServerMetricsShared {
    return {
      total_invocations = metrics.total_invocations;
      invocations_by_user = Iter.toArray(Map.entries(metrics.invocations_by_user));
      invocations_by_tool = Iter.toArray(Map.entries(metrics.invocations_by_tool));
    };
  };

  public shared query func get_metrics_for_server(wasm_id : Text) : async ?ServerMetricsShared {
    return Option.map(
      Map.get(aggregated_metrics, Map.thash, wasm_id),
      to_shared_metrics,
    );
  };

  public shared query func get_all_server_metrics() : async [(Text, ServerMetricsShared)] {
    let all_metrics = Buffer.Buffer<(Text, ServerMetricsShared)>(Map.size(aggregated_metrics));
    for ((wasm_id, metrics) in Map.entries(aggregated_metrics)) {
      all_metrics.add((wasm_id, to_shared_metrics(metrics)));
    };
    return Buffer.toArray(all_metrics);
  };

  public shared query func get_admin() : async Principal { return admin };
  public shared query func get_payout_canister() : async ?Principal {
    return payout_canister;
  };
  public shared query func is_wasm_hash_approved(wasm_id : Text) : async Bool {
    return Option.isSome(Map.get(approved_wasm_hashes, Map.thash, wasm_id));
  };

  // ==================================================================================================
  // DEVELOPMENT HELPERS
  // ==================================================================================================

  public shared (msg) func seed_log(canister_id : Principal, wasm_id : Text, stats : UsageStats) : async Result.Result<(), Text> {
    if (not is_admin(msg.caller)) {
      return #err("Unauthorized: Only the admin can call seed_log.");
    };

    let new_log : LogEntry = {
      wasm_id = wasm_id;
      canister_id = canister_id;
      timestamp = Time.now();
      stats = stats;
    };
    Vector.add(logs, new_log);

    // --- 6. CORRECTED: Call the updated helper with both identifiers ---
    update_metrics(wasm_id, canister_id, stats);

    return #ok(());
  };
};
