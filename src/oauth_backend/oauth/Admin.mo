import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Types "Types";
import BaseX "mo:base-x-encoder";
import Random "mo:base/Random"; // And Random for a unique ID
import Option "mo:base/Option";
import Iter "mo:base/Iter";
import Utils "Utils";

module Admin {
  public func set_frontend_canister_id(context : Types.Context, caller : Principal, id : Principal) {
    assert (caller == context.creator);
    context.frontend_canister_id := id;
  };

  public func add_test_client(context : Types.Context, caller : Principal, client : Types.Client) {
    assert (caller == context.creator);
    Map.set(context.clients, thash, client.client_id, client);
  };

  // ===================================================================
  // RESOURCE SERVER MANAGEMENT (CRUD)
  // ===================================================================

  /**
   * [CREATE] Registers a new resource server.
   * Enforces a "first-come, first-served" policy on URIs to prevent hijacking.
   */
  public func register_resource_server(
    context : Types.Context,
    caller : Principal,
    args : Types.RegisterResourceServerArgs,
  ) : async Result.Result<Types.ResourceServer, Text> {
    // SECURITY: Ensure at least one URI is provided for registration.
    if (args.uris.size() == 0) {
      return #err("At least one URI must be provided for the resource server.");
    };

    // SECURITY: "First-come, first-served" check.
    // We check all provided URIs to prevent partial registration or hijacking.
    for (uri in args.uris.vals()) {
      let normalized_uri = Utils.normalize_uri(uri);
      if (Option.isSome(Map.get(context.uri_to_rs_id, thash, normalized_uri))) {
        return #err("The resource URI '" # uri # "' has already been registered.");
      };
    };

    // Generate a unique, random ID for the resource server.
    let rs_id_blob = await Random.blob();
    let resource_server_id = "rs_" # BaseX.toHex(rs_id_blob.vals(), { isUpper = false; prefix = #none });

    let new_server : Types.ResourceServer = {
      resource_server_id = resource_server_id;
      owner = caller;
      name = args.name;
      logo_uri = args.logo_uri;
      service_principals = [args.initial_service_principal];
      status = #active;
      uris = args.uris;
      scopes = args.scopes;
      accepted_payment_canisters = args.accepted_payment_canisters;
    };

    // Update the main map.
    Map.set(context.resource_servers, thash, resource_server_id, new_server);

    // Update the URI-to-ID index for all provided URIs.
    for (uri in args.uris.vals()) {
      Map.set(context.uri_to_rs_id, thash, Utils.normalize_uri(uri), resource_server_id);
    };

    return #ok(new_server);
  };

  /**
   * [READ] Lists all resource servers owned by the caller.
   */
  public func list_my_resource_servers(
    context : Types.Context,
    caller : Principal,
  ) : async Result.Result<[Types.ResourceServer], Text> {
    let all_servers_iter = Map.vals(context.resource_servers);
    let my_servers_iter = Iter.filter<Types.ResourceServer>(all_servers_iter, func(s : Types.ResourceServer) : Bool { s.owner == caller });
    let my_servers_array = Iter.toArray(my_servers_iter);
    return #ok(my_servers_array);
  };

  /**
   * [READ] Gets the details of a specific resource server, enforcing ownership.
   */
  public func get_my_resource_server_details(
    context : Types.Context,
    id : Text,
    caller : Principal,
  ) : async Result.Result<Types.ResourceServer, Text> {
    let server = switch (Map.get(context.resource_servers, thash, id)) {
      case (null) return #err("Resource server not found.");
      case (?s) s;
    };

    // SECURITY: Enforce ownership.
    if (server.owner != caller) {
      return #err("Unauthorized: You are not the owner of this resource server.");
    };

    return #ok(server);
  };

  /**
   * [READ] Gets the public details of a resource server, without ownership check.
   * This is used for public discovery and listing.
   */
  public func get_public_resource_server_details(
    context : Types.Context,
    id : Text,
  ) : Result.Result<Types.PublicResourceServer, Text> {
    let server = switch (Map.get(context.resource_servers, thash, id)) {
      case (null) return #err("Resource server not found.");
      case (?s) s;
    };

    // Construct and return the public details.
    let public_info : Types.PublicResourceServer = {
      resource_server_id = server.resource_server_id;
      name = server.name;
      logo_uri = server.logo_uri;
      uris = server.uris;
      scopes = server.scopes;
      accepted_payment_canisters = server.accepted_payment_canisters;
      service_principals = server.service_principals; // Include service principals for public visibility
    };
    return #ok(public_info);
  };

  /**
   * [UPDATE] Updates the properties of an existing resource server.
   */
  public func update_resource_server(
    context : Types.Context,
    caller : Principal,
    args : Types.UpdateResourceServerArgs,
  ) : async Result.Result<Text, Text> {
    // 1. Fetch the existing resource server
    let server = switch (Map.get(context.resource_servers, thash, args.resource_server_id)) {
      case (null) return #err("Resource server not found.");
      case (?s) s;
    };

    // 2. SECURITY: Check permissions
    if (server.owner != caller) {
      return #err("Unauthorized: Caller is not the owner of the resource server.");
    };

    // 3. Handle the URI index update first
    switch (args.uris) {
      case (?new_uris) {
        // Remove all old URIs from the index
        for (old_uri in server.uris.vals()) {
          Map.delete(context.uri_to_rs_id, thash, Utils.normalize_uri(old_uri));
        };
        // Add all new URIs to the index, checking for conflicts
        for (new_uri in new_uris.vals()) {
          let normalized = Utils.normalize_uri(new_uri);
          if (Option.isSome(Map.get(context.uri_to_rs_id, thash, normalized))) {
            // This prevents updating to a URI that is already taken by another server.
            return #err("The resource URI '" # new_uri # "' is already in use.");
          };
          Map.set(context.uri_to_rs_id, thash, normalized, server.resource_server_id);
        };
      };
      case (null) {}; // No URI update, so no index change needed.
    };

    // 4. Construct the new, immutable ResourceServer object
    let updated_server : Types.ResourceServer = {
      server with // Start with old values
      name = Option.get(args.name, server.name);
      logo_uri = Option.get(args.logo_uri, server.logo_uri);
      uris = Option.get(args.uris, server.uris);
      service_principals = Option.get(args.service_principals, server.service_principals);
      scopes = Option.get(args.scopes, server.scopes);
      accepted_payment_canisters = Option.get(args.accepted_payment_canisters, server.accepted_payment_canisters);
    };

    // 5. Save the new object, replacing the old one
    Map.set(context.resource_servers, thash, updated_server.resource_server_id, updated_server);

    return #ok("Resource server updated successfully.");
  };

  /**
   * [DELETE] Deletes a resource server and cleans up its associated data.
   */
  public func delete_resource_server(
    context : Types.Context,
    caller : Principal,
    id : Text,
  ) : async Result.Result<Text, Text> {
    // 1. Fetch the resource server
    let server = switch (Map.get(context.resource_servers, thash, id)) {
      case (null) return #err("Resource server not found.");
      case (?s) s;
    };

    // 2. SECURITY: Check permissions
    if (server.owner != caller) {
      return #err("Unauthorized: Caller is not the owner of the resource server.");
    };

    // 3. CRITICAL: Clean up the URI index to free up the URIs.
    for (uri in server.uris.vals()) {
      Map.delete(context.uri_to_rs_id, thash, Utils.normalize_uri(uri));
    };

    // 4. Delete the main resource server record.
    Map.delete(context.resource_servers, thash, id);

    return #ok("Resource server deleted successfully.");
  };

  public func get_session_info(context : Types.Context, session_id : Text, caller : Principal) : Result.Result<Types.SessionInfo, Text> {
    // 1. Find the session
    let session = switch (Map.get(context.authorize_sessions, thash, session_id)) {
      case (null) { return #err("Invalid session ID.") };
      case (?s) s;
    };

    // VALIDATE that the caller is the bound user.
    switch (session.user_principal) {
      case (null) return #err("Session not yet associated with a user.");
      case (?owner_principal) {
        if (owner_principal != caller) {
          return #err("Caller does not match session owner.");
        };
      };
    };

    // 3. Find the internal resource_server_id.
    let resource_server_id = session.resource_server_id;

    // 4. Now, look up the full ResourceServer record using the internal ID.
    let resource_server = switch (Map.get(context.resource_servers, thash, resource_server_id)) {
      case (null) {
        // This indicates an internal data consistency error.
        return #err("Internal error: Resource server record not found for the given audience.");
      };
      case (?rs) rs;
    };

    // 5. Select the principal to be approved as the spender (the "select the first" strategy).
    if (resource_server.service_principals.size() == 0) {
      return #err("Configuration error: The target resource server has no service principals registered.");
    };
    let spender_principal = resource_server.service_principals[0];

    // 6. Get the client's name for a user-friendly UI.
    let client = switch (Map.get(context.clients, thash, session.client_id)) {
      case (null) return #err("Internal error: Client not found for session.");
      case (?c) c;
    };

    // 7. Return the correct spender principal and the client name.
    return #ok({
      resource_server_principal = spender_principal;
      client_name = client.client_name;
    });
  };
};
