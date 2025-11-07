import Map "mo:map/Map";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Array "mo:base/Array";
import Timer "mo:base/Timer";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Option "mo:base/Option";

/**
 * The Leaderboard canister serves as a read-optimized cache for ecosystem rankings.
 * It periodically pulls raw data from the UsageTracker canister, computes the "Top Users" and
 * "Top Servers" leaderboards, and stores them in a sorted state.
 *
 * This separation of concerns ensures that the frontend can load leaderboard data with fast,
 * cheap query calls, without putting computational strain on the write-heavy UsageTracker.
 */
shared ({ caller = deployer }) persistent actor class Leaderboard() {

  // ==================================================================================
  // TYPES
  // ==================================================================================

  // This is the expected interface of the UsageTracker canister.
  type UsageTracker = actor {
    get_all_server_metrics : shared query () -> async [(Text, ServerMetricsShared)];
  };

  // The public-facing data structure from the UsageTracker.
  public type ServerMetricsShared = {
    total_invocations : Nat;
    invocations_by_user : [(Principal, Nat)];
    invocations_by_tool : [(Text, Nat)];
  };

  // The final, ranked data structures served to the frontend.
  public type UserLeaderboardEntry = {
    rank : Nat;
    user : Principal;
    total_invocations : Nat;
  };

  public type ServerLeaderboardEntry = {
    rank : Nat;
    server : Text;
    total_invocations : Nat;
  };

  // ==================================================================================
  // STATE
  // ==================================================================================

  var owner : Principal = deployer;
  var usage_canister_id : ?Principal = null;
  var timer_id : ?Timer.TimerId = null;

  // Store the pre-computed, sorted leaderboards for fast queries.
  var user_leaderboard : [UserLeaderboardEntry] = [];
  var server_leaderboard : [ServerLeaderboardEntry] = [];
  var server_metrics_cache = Map.new<Text, ServerMetricsShared>();

  var last_updated : Time.Time = 0;
  transient let UPDATE_INTERVAL_NS : Nat = 15 * 60 * 1_000_000_000; // 15 minutes

  // ==================================================================================
  // INITIALIZATION & TIMERS
  // ==================================================================================

  public shared (msg) func init(canister_id : Principal) : async () {
    if (msg.caller != deployer) {
      Debug.trap("Only the deployer can initialize the canister");
    };

    usage_canister_id := ?canister_id;

    // Run the first update shortly after deployment/upgrade.
    timer_id := ?Timer.recurringTimer<system>(#nanoseconds(UPDATE_INTERVAL_NS), update_leaderboards);
  };

  // ==================================================================================
  // CORE LOGIC (PRIVATE)
  // ==================================================================================

  private func update_leaderboards() : async () {
    // Fetch all metrics from the usage canister
    let usage_canister = switch (usage_canister_id) {
      case (null) {
        // Usage canister ID not set, cannot proceed.
        Debug.print("Usage canister ID not set. Cannot update leaderboards.");
        return;
      };
      case (?exists) {
        actor (Principal.toText(exists)) : UsageTracker;
      };
    };

    let all_metrics_result : [(Text, ServerMetricsShared)] = await usage_canister.get_all_server_metrics();

    // Cache the raw metrics for potential future use
    server_metrics_cache := Map.fromIter(all_metrics_result.vals(), Map.thash);

    // --- 1. Calculate Server Leaderboard ---
    var servers_unsorted = Array.map<(Text, ServerMetricsShared), (Text, Nat)>(
      all_metrics_result,
      func(entry) {
        let server_id = entry.0;
        let metrics = entry.1;
        return (server_id, metrics.total_invocations);
      },
    );

    let servers_sorted = Array.sort<(Text, Nat)>(servers_unsorted, func(a, b) { Nat.compare(b.1, a.1) });

    // Use a mutable counter with Array.map for ranking.
    var rank_s : Nat = 0;
    server_leaderboard := Array.map<(Text, Nat), ServerLeaderboardEntry>(
      servers_sorted,
      func(entry) {
        rank_s += 1;
        return {
          rank = rank_s;
          server = entry.0;
          total_invocations = entry.1;
        };
      },
    );

    // --- 2. Calculate User Leaderboard ---
    // This requires aggregating user calls across all servers.
    var user_totals = Map.new<Principal, Nat>();

    for ((server_id, metric) in all_metrics_result.vals()) {
      for ((user_principal, call_count) in metric.invocations_by_user.vals()) {
        let current_total = Option.get(Map.get(user_totals, Map.phash, user_principal), 0);
        Map.set(user_totals, Map.phash, user_principal, current_total + call_count);
      };
    };

    var users_unsorted = Iter.toArray(Map.entries(user_totals));
    let users_sorted = Array.sort<(Principal, Nat)>(users_unsorted, func(a, b) { Nat.compare(b.1, a.1) });

    var rank_u : Nat = 0;
    user_leaderboard := Array.map<(Principal, Nat), UserLeaderboardEntry>(
      users_sorted,
      func(entry) {
        rank_u += 1;
        return {
          rank = rank_u; // The rank is the counter's value
          user = entry.0;
          total_invocations = entry.1;
        };
      },
    );

    last_updated := Time.now();
  };

  // ==================================================================================
  // PUBLIC QUERIES (For Frontend)
  // ==================================================================================

  public shared query func get_user_leaderboard() : async [UserLeaderboardEntry] {
    return user_leaderboard;
  };

  public shared query func get_server_leaderboard() : async [ServerLeaderboardEntry] {
    return server_leaderboard;
  };

  public shared query func get_last_updated() : async Time.Time {
    return last_updated;
  };

  /**
   * Retrieves the invocation counts for each tool of a specific server.
   * Data is sourced from the last cached update.
   * @param server_id The Principal of the server canister.
   * @returns An array of tool names and their invocation counts. Returns an empty array if the server is not found.
   */
  public shared query func get_tool_invocations_for_server(server_id : Text) : async [(Text, Nat)] {
    switch (Map.get(server_metrics_cache, Map.thash, server_id)) {
      case (?metrics) {
        // We found the metrics for this server, return the tool invocation data.
        return metrics.invocations_by_tool;
      };
      case (null) {
        // The server was not found in our cache (e.g., it's new or has no usage).
        // Return an empty array for a consistent frontend experience.
        return [];
      };
    };
  };

  // ==================================================================================
  // ADMIN FUNCTIONS
  // ==================================================================================

  public shared (msg) func trigger_manual_update() : async Result.Result<(), Text> {
    if (msg.caller != owner) { return #err("Unauthorized") };
    await update_leaderboards();
    return #ok(());
  };

  public shared query func get_owner() : async Principal {
    return owner;
  };

  public type EnvDependency = {
    key : Text;
    setter : Text;
    canister_name : Text;
    required : Bool;
    current_value : ?Principal;
  };

  public type EnvConfig = {
    key : Text;
    setter : Text;
    value_type : Text;
    required : Bool;
    current_value : ?Text;
  };

  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    #v1({
      dependencies = [{
        key = "usage_canister_id";
        setter = "init";
        canister_name = "usage_tracker";
        required = true;
        current_value = usage_canister_id;
      }];
      configuration = [];
    });
  };
};
