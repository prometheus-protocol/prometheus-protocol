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

  let ANONYMOUS_PRINCIPAL = Principal.fromText("aaaaa-aa");

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
    total_tools : Nat;
    authenticated_unique_users : Nat;
    anonymous_invocations : Nat;
  };

  // --- NEW: Namespace-level metrics for aggregated app statistics ---
  public type NamespaceMetrics = {
    namespace : Text;
    total_invocations : Nat;
    total_tools : Nat;
    authenticated_unique_users : Nat;
    anonymous_invocations : Nat;
    total_instances : Nat; // Count of all canister instances
  };

  // --- Tool-level metrics ---
  public type ToolMetrics = {
    tool_id : Text;
    total_invocations : Nat;
  };

  public type NamespaceMetricsDetailed = {
    namespace : Text;
    total_invocations : Nat;
    tools : [ToolMetrics];
    authenticated_unique_users : Nat;
    anonymous_invocations : Nat;
    total_instances : Nat;
  };

  // ==================================================================================================
  // STATE
  // ==================================================================================================

  var owner : Principal = deployer;
  var payout_canister : ?Principal = null;
  var approved_wasm_hashes = Map.new<Text, Null>();
  var logs = Vector.new<LogEntry>();
  var registry_canister_id : ?Principal = null;
  var orchestrator_canister_id : ?Principal = null;

  // The primary state for all aggregated data, keyed by WASM hash for payouts.
  var aggregated_metrics = Map.new<Text, ServerMetrics>();

  // --- 2. A new, lean state map for fast UI queries, keyed by canister_id ---
  var metrics_by_canister = Map.new<Principal, AppMetrics>();

  // --- NEW: Map to track which namespace each canister belongs to ---
  var canister_to_namespace = Map.new<Principal, Text>();

  // --- NEW: Map to track which wasm_id each canister is running ---
  var canister_to_wasm = Map.new<Principal, Text>();

  // --- NEW: Map to track all WASM IDs that have ever been used in each namespace ---
  var namespace_to_wasms = Map.new<Text, Map.Map<Text, Null>>();

  // --- NEW: Namespace-level aggregated metrics ---
  var metrics_by_namespace = Map.new<Text, NamespaceMetrics>();

  // --- NEW: Map to track tool invocations aggregated across all WASMs in a namespace ---
  var tools_by_namespace = Map.new<Text, Map.Map<Text, Nat>>();

  // ==================================================================================================
  // PRIVATE HELPERS
  // ==================================================================================================

  private func is_owner(caller : Principal) : Bool {
    return Principal.equal(owner, caller);
  };

  private func is_payout_canister(caller : Principal) : Bool {
    switch (payout_canister) {
      case (null) { return false };
      case (?payout) { return Principal.equal(payout, caller) };
    };
  };

  // --- 3. CORRECTED: This helper now updates BOTH state maps efficiently ---
  private func update_metrics(wasm_id : Text, canister_id : Principal, stats : UsageStats) {
    // Track which wasm_id this canister is running
    Map.set(canister_to_wasm, Map.phash, canister_id, wasm_id);

    // --- Part A: Update the detailed metrics by wasm_id (for payouts) ---
    // This part remains unchanged, as it's the source of truth.
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

    // --- Part B: Derive and update the lean metrics for the UI ---
    // This logic now intelligently separates anonymous and authenticated usage.
    let anonymous_invocations = Option.get(
      Map.get(server_metrics.invocations_by_user, Map.phash, ANONYMOUS_PRINCIPAL),
      0,
    );

    let total_unique_users = Map.size(server_metrics.invocations_by_user);
    let authenticated_unique_users = if (Option.isSome(Map.get(server_metrics.invocations_by_user, Map.phash, ANONYMOUS_PRINCIPAL))) {
      if (total_unique_users > 0) { total_unique_users - 1 : Nat } else { 0 };
    } else {
      total_unique_users;
    };

    let app_metrics : AppMetrics = {
      total_invocations = server_metrics.total_invocations;
      total_tools = Map.size(server_metrics.invocations_by_tool);
      authenticated_unique_users = authenticated_unique_users;
      anonymous_invocations = anonymous_invocations;
    };
    Map.set(metrics_by_canister, Map.phash, canister_id, app_metrics);

    // --- Part C: NEW - Update namespace-level metrics ---
    // Look up the namespace for this canister and aggregate metrics at namespace level
    switch (Map.get(canister_to_namespace, Map.phash, canister_id)) {
      case (?namespace) {
        // Register this WASM ID with the namespace
        let namespace_wasms = Option.get(
          Map.get(namespace_to_wasms, Map.thash, namespace),
          Map.new<Text, Null>(),
        );
        Map.set(namespace_wasms, Map.thash, wasm_id, null);
        Map.set(namespace_to_wasms, Map.thash, namespace, namespace_wasms);

        // Recalculate namespace metrics by iterating over all WASMs in this namespace
        recompute_namespace_metrics(namespace);
      };
      case (null) {
        // Namespace not registered yet - this is expected for older canisters
        Debug.print("Warning: Canister " # Principal.toText(canister_id) # " has no registered namespace");
      };
    };
  };

  // Helper function to recompute all metrics for a namespace
  private func recompute_namespace_metrics(namespace : Text) {
    var total_invocations : Nat = 0;
    var total_anonymous_invocations : Nat = 0;
    var instance_count : Nat = 0;

    // Use a map to track unique users across all WASM versions
    var unique_users = Map.new<Principal, Null>();

    // Use a map to track unique tools across all WASM versions
    var unique_tools = Map.new<Text, Null>();

    // Use a map to track tool invocations across all WASM versions
    var tool_invocations = Map.new<Text, Nat>();

    // Count the number of canister instances for this namespace
    for ((canister_id, canister_namespace) in Map.entries(canister_to_namespace)) {
      if (canister_namespace == namespace) {
        instance_count += 1;
      };
    };

    // Get all WASM IDs that have ever been registered for this namespace
    switch (Map.get(namespace_to_wasms, Map.thash, namespace)) {
      case (?wasm_set) {
        // Iterate through all WASM IDs (both current and historical)
        for ((wasm_id, _) in Map.entries(wasm_set)) {
          // Get the detailed metrics from aggregated_metrics
          switch (Map.get(aggregated_metrics, Map.thash, wasm_id)) {
            case (?server_metrics) {
              // Add invocations
              total_invocations += server_metrics.total_invocations;

              // Track unique users across all WASM versions
              for ((user_principal, _) in Map.entries(server_metrics.invocations_by_user)) {
                Map.set(unique_users, Map.phash, user_principal, null);

                // Track anonymous invocations separately
                if (Principal.equal(user_principal, ANONYMOUS_PRINCIPAL)) {
                  total_anonymous_invocations += Option.get(
                    Map.get(server_metrics.invocations_by_user, Map.phash, user_principal),
                    0,
                  );
                };
              };

              // Track unique tools and aggregate their invocations across all WASM versions
              for ((tool_id, call_count) in Map.entries(server_metrics.invocations_by_tool)) {
                Map.set(unique_tools, Map.thash, tool_id, null);

                // Aggregate tool invocations
                let current_count = Option.get(Map.get(tool_invocations, Map.thash, tool_id), 0);
                Map.set(tool_invocations, Map.thash, tool_id, current_count + call_count);
              };
            };
            case (null) {
              // No detailed metrics for this WASM ID yet
            };
          };
        };
      };
      case (null) {
        // No WASMs registered for this namespace yet
      };
    };

    // Store tool invocations in tools_by_namespace
    Map.set(tools_by_namespace, Map.thash, namespace, tool_invocations);

    // Calculate authenticated unique users (total unique users minus anonymous if present)
    let total_unique_users = Map.size(unique_users);
    let total_authenticated_users = if (Option.isSome(Map.get(unique_users, Map.phash, ANONYMOUS_PRINCIPAL))) {
      if (total_unique_users > 0) { total_unique_users - 1 : Nat } else { 0 };
    } else {
      total_unique_users;
    };

    // Create namespace-level metrics
    let namespace_metrics : NamespaceMetrics = {
      namespace = namespace;
      total_invocations = total_invocations;
      total_tools = Map.size(unique_tools);
      authenticated_unique_users = total_authenticated_users;
      anonymous_invocations = total_anonymous_invocations;
      total_instances = instance_count;
    };

    Map.set(metrics_by_namespace, Map.thash, namespace, namespace_metrics);
    Debug.print("Recomputed namespace metrics for: " # namespace # " - " # debug_show (instance_count) # " instances, " # debug_show (total_invocations) # " invocations, " # debug_show (total_authenticated_users) # " unique authenticated users");
  };

  // ==================================================================================================
  // PUBLIC METHODS: ADMIN
  // ==================================================================================================

  public shared (msg) func set_payout_canister(canister_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to set payout canister by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can set the payout canister.");
    };
    payout_canister := ?canister_id;
    return #ok(());
  };

  public shared (msg) func set_owner(new_owner : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to transfer owner by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can transfer owner rights.");
    };
    owner := new_owner;
    return #ok(());
  };

  private func is_registry_canister(caller : Principal) : Bool {
    switch (registry_canister_id) {
      case (null) { return false };
      case (?registry) { return Principal.equal(registry, caller) };
    };
  };

  public shared (msg) func add_approved_wasm_hash(wasm_id : Text) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller) and not is_registry_canister(msg.caller)) {
      Debug.print("Unauthorized attempt to add Wasm hash by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner or registry can add a Wasm hash.");
    };
    Map.set(approved_wasm_hashes, Map.thash, wasm_id, null);
    return #ok(());
  };

  public shared (msg) func remove_approved_wasm_hash(wasm_id : Text) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to remove Wasm hash by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can remove a Wasm hash.");
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
        Debug.print("Failed to get module hash for canister: " # Principal.toText(caller));
        return #err("Could not retrieve Wasm hash for the calling canister.");
      };
      case (?hash) { hash };
    };
    let wasm_id = Base16.encode(wasm_hash);
    if (Option.isNull(Map.get(approved_wasm_hashes, Map.thash, wasm_id))) {
      Debug.print("Rejected log from unapproved Wasm hash: " # wasm_id # " for canister: " # Principal.toText(caller));
      return #err("Wasm hash not approved. The canister is not authorized to submit logs.");
    };

    Debug.print("Logging usage from canister: " # Principal.toText(caller) # " with Wasm ID: " # wasm_id);

    let new_log : LogEntry = {
      wasm_id = wasm_id;
      canister_id = caller;
      timestamp = Time.now();
      stats = stats;
    };
    Vector.add(logs, new_log);

    // --- 4. CORRECTED: Call the updated helper with both identifiers ---
    update_metrics(wasm_id, caller, stats);

    Debug.print("Log entry added. Total log entries: " # debug_show (Vector.size(logs)));

    return #ok(());
  };

  public shared (msg) func set_registry_canister(canister_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to set registry canister by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can set the registry canister.");
    };
    registry_canister_id := ?canister_id;
    return #ok(());
  };

  public shared (msg) func set_orchestrator_canister(canister_id : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to set orchestrator canister by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can set the orchestrator canister.");
    };
    orchestrator_canister_id := ?canister_id;
    return #ok(());
  };

  private func is_orchestrator_canister(caller : Principal) : Bool {
    switch (orchestrator_canister_id) {
      case (null) { return false };
      case (?orchestrator) { return Principal.equal(orchestrator, caller) };
    };
  };

  /**
   * Registers the namespace for a canister. This should be called by the orchestrator
   * when a new canister is provisioned or when an existing canister is upgraded.
   */
  public shared (msg) func register_canister_namespace(canister_id : Principal, namespace : Text) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller) and not is_orchestrator_canister(msg.caller)) {
      Debug.print("Unauthorized attempt to register canister namespace by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner or orchestrator can register canister namespaces.");
    };

    Map.set(canister_to_namespace, Map.phash, canister_id, namespace);
    Debug.print("Registered canister " # Principal.toText(canister_id) # " to namespace: " # namespace);

    // Recompute namespace metrics to include this canister
    recompute_namespace_metrics(namespace);

    return #ok(());
  };

  /**
   * Rebuilds the namespace_to_wasms mapping from existing canister_to_wasm and canister_to_namespace data.
   * This is useful for migrating existing data or recovering from data inconsistencies.
   * Should be called by the owner after upgrading to ensure all historical WASMs are tracked.
   */
  public shared (msg) func rebuild_namespace_wasm_mappings() : async Result.Result<Text, Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to rebuild mappings by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can rebuild mappings.");
    };

    var total_wasms_added : Nat = 0;
    var namespaces_processed : Nat = 0;

    // Iterate through all canisters and register their WASM IDs with their namespaces
    for ((canister_id, namespace) in Map.entries(canister_to_namespace)) {
      switch (Map.get(canister_to_wasm, Map.phash, canister_id)) {
        case (?wasm_id) {
          // Get or create the set of WASMs for this namespace
          let namespace_wasms = Option.get(
            Map.get(namespace_to_wasms, Map.thash, namespace),
            Map.new<Text, Null>(),
          );

          // Check if this WASM is already registered for this namespace
          if (Option.isNull(Map.get(namespace_wasms, Map.thash, wasm_id))) {
            Map.set(namespace_wasms, Map.thash, wasm_id, null);
            Map.set(namespace_to_wasms, Map.thash, namespace, namespace_wasms);
            total_wasms_added += 1;
          };
        };
        case (null) {
          // Canister has no WASM ID yet (hasn't logged any usage)
        };
      };
    };

    // Recompute metrics for all namespaces
    for ((namespace, _) in Map.entries(namespace_to_wasms)) {
      recompute_namespace_metrics(namespace);
      namespaces_processed += 1;
    };

    let message = "Rebuilt namespace WASM mappings: " # debug_show (total_wasms_added) # " WASMs added across " # debug_show (namespaces_processed) # " namespaces";
    Debug.print(message);
    return #ok(message);
  };

  /**
   * Manually registers a historical WASM ID with a namespace.
   * This is useful for recovering historical data from WASM versions that are no longer active.
   *
   * Use case: If a canister was upgraded from v1 (wasm_id_1) to v2 (wasm_id_2), and you want to
   * include the v1 users in the namespace metrics, call this function with wasm_id_1.
   *
   * The WASM ID must exist in aggregated_metrics (meaning it has historical usage data).
   */
  public shared (msg) func register_historical_wasm(namespace : Text, wasm_id : Text) : async Result.Result<Text, Text> {
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to register historical WASM by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can register historical WASMs.");
    };

    // Verify that this WASM ID actually has historical data
    switch (Map.get(aggregated_metrics, Map.thash, wasm_id)) {
      case (null) {
        return #err("WASM ID not found in metrics. This WASM has no historical usage data.");
      };
      case (?metrics) {
        // Get or create the set of WASMs for this namespace
        let namespace_wasms = Option.get(
          Map.get(namespace_to_wasms, Map.thash, namespace),
          Map.new<Text, Null>(),
        );

        // Register the WASM with the namespace
        Map.set(namespace_wasms, Map.thash, wasm_id, null);
        Map.set(namespace_to_wasms, Map.thash, namespace, namespace_wasms);

        // Recompute namespace metrics to include this historical data
        recompute_namespace_metrics(namespace);

        let user_count = Map.size(metrics.invocations_by_user);
        let message = "Registered historical WASM " # wasm_id # " with namespace " # namespace # ". WASM has " # debug_show (user_count) # " users and " # debug_show (metrics.total_invocations) # " invocations.";
        Debug.print(message);
        return #ok(message);
      };
    };
  };

  /**
   * Lists all WASM IDs that have historical data in aggregated_metrics.
   * This is useful for discovering which historical WASMs can be registered with namespaces.
   */
  public shared query func list_all_wasm_ids() : async [(Text, Nat, Nat)] {
    let result = Buffer.Buffer<(Text, Nat, Nat)>(Map.size(aggregated_metrics));
    for ((wasm_id, metrics) in Map.entries(aggregated_metrics)) {
      result.add((wasm_id, metrics.total_invocations, Map.size(metrics.invocations_by_user)));
    };
    return Buffer.toArray(result);
  };

  /**
   * Gets all WASM IDs currently registered for a namespace.
   */
  public shared query func get_namespace_wasms(namespace : Text) : async [Text] {
    switch (Map.get(namespace_to_wasms, Map.thash, namespace)) {
      case (null) { return [] };
      case (?wasm_map) {
        let result = Buffer.Buffer<Text>(Map.size(wasm_map));
        for ((wasm_id, _) in Map.entries(wasm_map)) {
          result.add(wasm_id);
        };
        return Buffer.toArray(result);
      };
    };
  };

  // ==================================================================================================
  // PUBLIC METHODS: DATA RETRIEVAL
  // ==================================================================================================

  public shared (msg) func get_and_clear_logs() : async Result.Result<[LogEntry], Text> {
    if (not is_payout_canister(msg.caller)) {
      Debug.print("Unauthorized attempt to retrieve logs by: " # Principal.toText(msg.caller));
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

  // --- NEW: Query endpoint for namespace-level metrics ---
  public shared query func get_namespace_metrics(namespace : Text) : async ?NamespaceMetrics {
    return Map.get(metrics_by_namespace, Map.thash, namespace);
  };

  /**
   * Get detailed namespace metrics including per-tool invocation counts.
   * Returns aggregated tool usage across all WASM versions of the namespace.
   */
  public shared query func get_namespace_metrics_detailed(namespace : Text) : async ?NamespaceMetricsDetailed {
    let basic_metrics = Map.get(metrics_by_namespace, Map.thash, namespace);
    let tools = switch (Map.get(tools_by_namespace, Map.thash, namespace)) {
      case (?tool_map) {
        let result = Buffer.Buffer<ToolMetrics>(Map.size(tool_map));
        for ((tool_id, invocations) in Map.entries(tool_map)) {
          result.add({
            tool_id = tool_id;
            total_invocations = invocations;
          });
        };
        Buffer.toArray(result);
      };
      case (null) { [] };
    };

    switch (basic_metrics) {
      case (?metrics) {
        ?{
          namespace = metrics.namespace;
          total_invocations = metrics.total_invocations;
          tools = tools;
          authenticated_unique_users = metrics.authenticated_unique_users;
          anonymous_invocations = metrics.anonymous_invocations;
          total_instances = metrics.total_instances;
        };
      };
      case (null) { null };
    };
  };

  /**
   * Get tool invocations for a specific namespace.
   * Returns an array of tools with their aggregated invocation counts.
   */
  public shared query func get_namespace_tools(namespace : Text) : async [ToolMetrics] {
    switch (Map.get(tools_by_namespace, Map.thash, namespace)) {
      case (?tool_map) {
        let result = Buffer.Buffer<ToolMetrics>(Map.size(tool_map));
        for ((tool_id, invocations) in Map.entries(tool_map)) {
          result.add({
            tool_id = tool_id;
            total_invocations = invocations;
          });
        };
        Buffer.toArray(result);
      };
      case (null) { [] };
    };
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

  public shared query func get_owner() : async Principal { return owner };
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
    if (not is_owner(msg.caller)) {
      Debug.print("Unauthorized attempt to seed log by: " # Principal.toText(msg.caller));
      return #err("Unauthorized: Only the owner can call seed_log.");
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
