import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Types "Types";
import Sha256 "mo:sha2/Sha256";
import BaseX "mo:base-x-encoder";
import Time "mo:base/Time"; // We need Time for a unique ID
import Random "mo:base/Random"; // And Random for a unique ID
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Nat8 "mo:base/Nat8";
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
  // RESOURCE SERVER MANAGEMENT & PAYMENT LOGIC
  // ===================================================================

  // A developer calls this to register their backend service.
  public func register_resource_server(
    context : Types.Context,
    caller : Principal,
    args : Types.RegisterResourceServerArgs,
  ) : async Types.ResourceServer {
    // For now, registration is open. We can add a fee later.
    // 1. Get entropy
    let entropy = await Random.blob();

    // 2. Concatenate all sources of uniqueness into a single byte array
    var combined_bytes : [Nat8] = [];
    combined_bytes := Array.append(combined_bytes, Iter.toArray(Principal.toBlob(caller).vals()));
    combined_bytes := Array.append(combined_bytes, Iter.toArray(Text.encodeUtf8(args.name).vals()));
    combined_bytes := Array.append(combined_bytes, [Nat8.fromIntWrap(Time.now())]);
    combined_bytes := Array.append(combined_bytes, Iter.toArray(entropy.vals()));

    // 3. Create a single blob from the combined bytes and hash it
    let source_blob = Blob.fromArray(combined_bytes);
    let unique_id_blob = Sha256.fromBlob(#sha256, source_blob);
    let resource_server_id = "rs_" # BaseX.toHex(unique_id_blob.vals(), { isUpper = false; prefix = #none });

    let new_server : Types.ResourceServer = {
      resource_server_id = resource_server_id;
      owner = caller;
      name = args.name;
      logo_uri = args.logo_uri;
      service_principals = [args.initial_service_principal];
      status = #active; // Active immediately for now
      uris = args.uris;
      scopes = args.scopes;
      accepted_payment_canisters = args.accepted_payment_canisters;
    };

    Map.set(context.resource_servers, thash, resource_server_id, new_server);

    // 4. Update the URI to resource server ID mapping
    for (uri in Iter.fromArray(args.uris)) {
      Map.set(context.uri_to_rs_id, thash, Utils.normalize_uri(uri), resource_server_id);
    };

    return new_server;
  };

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

    // 2. Check permissions
    if (server.owner != caller) {
      return #err("Unauthorized: Caller is not the owner of the resource server.");
    };

    // 3. Handle the URI index update first, as it's a side effect.
    // This must be done before we determine the final `uris` value.
    switch (args.uris) {
      case (?new_uris) {
        // Remove all old URIs from the index
        for (old_uri in server.uris.vals()) {
          Map.delete(context.uri_to_rs_id, thash, Utils.normalize_uri(old_uri));
        };
        // Add all new URIs to the index
        for (new_uri in new_uris.vals()) {
          Map.set(context.uri_to_rs_id, thash, Utils.normalize_uri(new_uri), server.resource_server_id);
        };
      };
      case (null) {}; // No URI update, so no index change needed.
    };

    // 4. Determine the final value for each field by composing a new object.
    // For each field, we use the new value if provided, otherwise we keep the old one.
    let final_name = switch (args.name) {
      case (?n) n;
      case (null) server.name;
    };
    let final_logo_uri = switch (args.logo_uri) {
      case (?l) l;
      case (null) server.logo_uri;
    };
    let final_uris = switch (args.uris) {
      case (?u) u;
      case (null) server.uris;
    };
    let final_service_principals = switch (args.service_principals) {
      case (?sp) sp;
      case (null) server.service_principals;
    };
    let final_scopes = switch (args.scopes) {
      case (?s) s;
      case (null) server.scopes;
    };
    let final_accepted_payment_canisters = switch (args.accepted_payment_canisters) {
      case (?apc) apc;
      case (null) server.accepted_payment_canisters;
    };

    // 5. Construct the new, immutable ResourceServer object
    let updated_server : Types.ResourceServer = {
      // Unchanged fields are copied directly from the old `server` object
      server with

      // Updated fields use the final values determined above
      name = final_name;
      logo_uri = final_logo_uri;
      uris = final_uris;
      service_principals = final_service_principals;
      scopes = final_scopes;
      accepted_payment_canisters = final_accepted_payment_canisters;
    };

    // 6. Save the new object, replacing the old one in the map
    Map.set(context.resource_servers, thash, updated_server.resource_server_id, updated_server);

    return #ok("Resource server updated successfully.");
  };

  public func get_my_resource_server_details(context : Types.Context, id : Text, caller : Principal) : async Result.Result<Types.ResourceServer, Text> {
    let server = switch (Map.get(context.resource_servers, thash, id)) {
      case (null) return #err("Resource server not found.");
      case (?s) s;
    };

    // CRITICAL: Enforce ownership
    if (server.owner != caller) {
      return #err("Unauthorized: You are not the owner of this resource server.");
    };

    return #ok(server);
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
