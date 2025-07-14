import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Map "mo:map/Map";
import { phash } "mo:map/Map";
import Types "Types";
import ICRC2 "mo:icrc2-types";

module {
  // The user calls this function to pay for and activate their subscription.
  public func register_subscription(
    context : Types.Context,
    caller : Principal,
  ) : async Result.Result<Types.Subscription, Text> {
    // --- Configuration ---
    let FEE : Nat = 10_000;
    let SUB_PRICE : Nat = 100 * 100_000_000; // 100 PMP tokens
    let SUB_DURATION_NS : Time.Time = 30 * 24 * 60 * 60 * 1_000_000_000; // 30 days

    // --- Payment Execution ---
    let ledger = actor (Principal.toText(context.icrc2_ledger_id)) : ICRC2.Service;
    let transfer_args : ICRC2.TransferFromArgs = {
      from = { owner = caller; subaccount = null };
      to = { owner = context.self; subaccount = null };
      amount = SUB_PRICE;
      fee = ?FEE;
      memo = null;
      created_at_time = null;
      spender_subaccount = null;
    };
    let transfer_result = await ledger.icrc2_transfer_from(transfer_args);

    // --- Result Handling ---
    switch (transfer_result) {
      case (#Err(e)) {
        return #err("Payment failed: " # debug_show (e));
      };
      case (#Ok(_)) {
        let now = Time.now();
        let current_sub = Map.get(context.subscriptions, phash, caller);
        let start_time = switch (current_sub) {
          case (null) { now };
          case (?sub) { if (sub.expires_at > now) sub.expires_at else now };
        };
        let new_subscription : Types.Subscription = {
          user_principal = caller;
          tier = "Pro";
          expires_at = start_time + SUB_DURATION_NS;
        };
        Map.set(context.subscriptions, phash, caller, new_subscription);
        return #ok(new_subscription);
      };
    };
  };

  public func get_subscription(
    context : Types.Context,
    caller : Principal,
  ) : ?Types.Subscription {
    Map.get(context.subscriptions, phash, caller);
  };
};
