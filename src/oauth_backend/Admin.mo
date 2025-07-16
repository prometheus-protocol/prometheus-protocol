import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Types "Types";
import ICRC2 "mo:icrc2-types";
import Sha256 "mo:sha2/Sha256";
import BaseX "mo:base-x-encoder";
import Time "mo:base/Time"; // We need Time for a unique ID
import Random "mo:base/Random"; // And Random for a unique ID
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Option "mo:base/Option";
import Iter "mo:base/Iter";
import Nat8 "mo:base/Nat8";

module Admin {
  public func set_frontend_canister_id(context : Types.Context, caller : Principal, id : Principal) {
    assert (caller == context.creator);
    context.frontend_canister_id := id;
  };

  public func add_test_client(context : Types.Context, caller : Principal, client : Types.Client) {
    assert (caller == context.creator);
    Map.set(context.clients, thash, client.client_id, client);
  };

  public func activate_client(
    context : Types.Context,
    caller : Principal,
    client_id : Text,
    client_secret : Text,
  ) : async Result.Result<Text, Text> {
    // 1. Find the client record
    let client = switch (Map.get(context.clients, thash, client_id)) {
      case (null) { return #err("Client not found.") };
      case (?c) c;
    };

    // 2. Verify ownership by checking the client_secret
    let provided_secret_hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(client_secret));
    let provided_secret_hash = BaseX.toHex(provided_secret_hash_blob.vals(), { isUpper = false; prefix = #none });

    if (provided_secret_hash != client.client_secret_hash) {
      return #err("Unauthorized: Invalid client_secret.");
    };

    // 3. Check if already active
    if (client.status == #active) {
      return #ok("Client is already active.");
    };

    // 4. Execute the activation fee payment
    let ledger = actor (Principal.toText(context.icrc2_ledger_id)) : ICRC2.Service;
    let transfer_args : ICRC2.TransferFromArgs = {
      from = { owner = caller; subaccount = null };
      to = { owner = context.self; subaccount = null };
      amount = context.registration_fee;
      fee = null;
      memo = null;
      created_at_time = null;
      spender_subaccount = null;
    };
    let transfer_result = await ledger.icrc2_transfer_from(transfer_args);

    switch (transfer_result) {
      case (#Err(e)) { return #err("Payment failed: " # debug_show (e)) };
      case (#Ok(_)) { /* Payment successful, proceed. */ };
    };

    // 5. Activate the client and officially assign ownership
    let updated_client : Types.Client = {
      client with
      owner = caller;
      status = #active;
    };
    Map.set(context.clients, thash, client_id, updated_client);

    return #ok("Client successfully activated.");
  };

  // ===================================================================
  // RESOURCE SERVER MANAGEMENT & PAYMENT LOGIC
  // ===================================================================

  // A developer calls this to register their backend service.
  public func register_resource_server(
    context : Types.Context,
    caller : Principal,
    name : Text,
    payout_principal : Principal,
    initial_service_principal : Principal,
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
      payout_principal = payout_principal;
      service_principals = [initial_service_principal];
      status = #active; // Active immediately for now
    };

    Map.set(context.resource_servers, thash, resource_server_id, new_server);
    return new_server;
  };

  // A helper function to find which resource server a given service principal belongs to.
  func findResourceServerByServicePrincipal(context : Types.Context, service_principal : Principal) : ?Types.ResourceServer {
    for ((_, server) in Map.entries(context.resource_servers)) {
      if (Option.isSome(Array.indexOf(service_principal, server.service_principals, Principal.equal))) {
        return ?server;
      };
    };
    return null;
  };

  // The core payment function. A trusted resource server calls this to charge a user.
  public func charge_user(context : Types.Context, caller : Principal, user_to_charge : Principal, amount : Nat) : async Result.Result<Null, Text> {
    // 1. Identify the resource server by the caller's Principal
    let service_principal = caller;
    let resource_server = switch (findResourceServerByServicePrincipal(context, service_principal)) {
      case (null) {
        return #err("Unauthorized: This service principal is not registered with any resource server.");
      };
      case (?server) server;
    };

    // 2. Get the payout address from the server's registration data
    let payout_principal = resource_server.payout_principal;

    // 3. Execute the payment
    let ledger = actor (Principal.toText(context.icrc2_ledger_id)) : ICRC2.Service;
    let transfer_args : ICRC2.TransferFromArgs = {
      from = { owner = user_to_charge; subaccount = null };
      to = { owner = payout_principal; subaccount = null };
      amount = amount;
      fee = null;
      memo = null;
      created_at_time = null;
      spender_subaccount = null;
    };
    let transfer_result = await ledger.icrc2_transfer_from(transfer_args);

    // 4. Return the result
    switch (transfer_result) {
      case (#Ok(_)) { return #ok(null) };
      case (#Err(e)) { return #err("Payment failed: " # debug_show (e)) };
    };
  };
};
