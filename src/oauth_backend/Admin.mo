import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Types "Types";
import ICRC2 "mo:icrc2-types";
import Sha256 "mo:sha2/Sha256";
import BaseX "mo:base-x-encoder";

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
};
