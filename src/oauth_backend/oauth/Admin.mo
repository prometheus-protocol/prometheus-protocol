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
    name : Text,
    uris : [Text],
    initial_service_principal : Principal,
    scopes : [(Text, Text)],
    accepted_payment_canisters : [Principal],
  ) : async Types.ResourceServer {
    // For now, registration is open. We can add a fee later.
    // 1. Get entropy
    let entropy = await Random.blob();

    // 2. Concatenate all sources of uniqueness into a single byte array
    var combined_bytes : [Nat8] = [];
    combined_bytes := Array.append(combined_bytes, Iter.toArray(Principal.toBlob(caller).vals()));
    combined_bytes := Array.append(combined_bytes, Iter.toArray(Text.encodeUtf8(name).vals()));
    combined_bytes := Array.append(combined_bytes, [Nat8.fromIntWrap(Time.now())]);
    combined_bytes := Array.append(combined_bytes, Iter.toArray(entropy.vals()));

    // 3. Create a single blob from the combined bytes and hash it
    let source_blob = Blob.fromArray(combined_bytes);
    let unique_id_blob = Sha256.fromBlob(#sha256, source_blob);
    let resource_server_id = "rs_" # BaseX.toHex(unique_id_blob.vals(), { isUpper = false; prefix = #none });

    let new_server : Types.ResourceServer = {
      resource_server_id = resource_server_id;
      owner = caller;
      name = name;
      service_principals = [initial_service_principal];
      status = #active; // Active immediately for now
      uris = uris;
      scopes = scopes;
      accepted_payment_canisters = accepted_payment_canisters;
    };

    Map.set(context.resource_servers, thash, resource_server_id, new_server);

    // 4. Update the URI to resource server ID mapping
    for (uri in Iter.fromArray(uris)) {
      Map.set(context.uri_to_rs_id, thash, Utils.normalize_uri(uri), resource_server_id);
    };

    return new_server;
  };

  // Allows the owner of a resource server to update its associated URIs.
  public func update_resource_server_uris(
    context : Types.Context,
    caller : Principal,
    resource_server_id : Text,
    new_uris : [Text],
  ) : async Result.Result<Text, Text> {
    // 1. Find the resource server by its unique ID.
    let server_opt = Map.get(context.resource_servers, thash, resource_server_id);
    let server = switch (server_opt) {
      case (null) {
        return #err("Resource server not found.");
      };
      case (?s) { s };
    };

    // 2. Authenticate the caller. Only the original owner can update the URIs.
    if (caller != server.owner) {
      return #err("Unauthorized: Caller is not the owner of this resource server.");
    };

    // 3. Clean up the old URIs from the reverse lookup map to prevent stale entries.
    for (old_uri in Iter.fromArray(server.uris)) {
      Map.delete(context.uri_to_rs_id, thash, old_uri);
    };

    // 4. Add the new URIs to the reverse lookup map.
    for (new_uri in Iter.fromArray(new_uris)) {
      Map.set(context.uri_to_rs_id, thash, Utils.normalize_uri(new_uri), resource_server_id);
    };

    // 5. Update the URIs in the main resource server record.
    let updated = { server with uris = new_uris };
    Map.set(context.resource_servers, thash, resource_server_id, updated);

    // 6. Return a success message.
    return #ok("Resource server URIs updated successfully.");
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

    // 2. Get the audience URI from the session. This is the public identifier.
    let audience_uri = session.audience;

    // 3. CRITICAL: Use the reverse-lookup map to find the internal resource_server_id.
    let resource_server_id = switch (Map.get(context.uri_to_rs_id, thash, audience_uri)) {
      case (null) {
        // This is a key validation step. The client requested an audience URI that isn't registered.
        return #err("Invalid audience: The requested resource URI is not registered with any resource server.");
      };
      case (?id) id;
    };

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
