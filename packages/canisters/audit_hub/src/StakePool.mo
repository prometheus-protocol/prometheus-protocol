import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import ICRC2 "mo:icrc2-types";

import Types "Types";
import Account "Account";

module {

  /**
   * Deposit tokens as stake to become an eligible auditor.
   * The caller must have already approved this canister to spend tokens on their behalf.
   * @param token_id - The ledger canister ID (as Principal text) of the token to deposit (e.g., USDC, ICP)
   * @param amount - The amount to deposit (in token's smallest unit)
   */
  public func deposit_stake(
    verifier : Principal,
    token_id : Types.TokenId,
    amount : Types.Balance,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    canister_principal : Principal,
  ) : async Result.Result<(), Text> {

    Debug.print("Depositing stake: Ledger=" # token_id # " Verifier=" # Principal.toText(verifier) # " Amount=" # Nat.toText(amount));

    // Transfer tokens from verifier to this canister using icrc2_transfer_from
    let ledger : ICRC2.Service = actor (token_id);

    // Check allowance:
    let allowance = await ledger.icrc2_allowance({
      account = { owner = verifier; subaccount = null };
      spender = { owner = canister_principal; subaccount = null };
    });

    if (allowance.allowance < amount) {
      Debug.print("Insufficient allowance: Allowed=" # Nat.toText(allowance.allowance) # " Required=" # Nat.toText(amount));
      return #err("Insufficient allowance for transfer. Please approve the canister to spend your tokens.");
    };

    let transfer_args : ICRC2.TransferFromArgs = {
      from = { owner = verifier; subaccount = null };
      to = { owner = canister_principal; subaccount = null };
      amount = amount;
      fee = null; // Use default fee
      memo = null;
      created_at_time = null;
      spender_subaccount = null;
    };

    let transfer_result = await ledger.icrc2_transfer_from(transfer_args);

    switch (transfer_result) {
      case (#Ok(_)) {
        // Update available balance
        let current_balance = Account.get_balance(available_balances, verifier, token_id);
        Account.set_balance(available_balances, verifier, token_id, current_balance + amount);
        return #ok(());
      };
      case (#Err(err)) {
        return #err("Token transfer failed: " # debug_show (err));
      };
    };
  };

  /**
   * Withdraw tokens from the verifier's available balance (not currently staked).
   * The withdrawal amount will have the token's fee deducted from it during transfer.
   * @param token_id - The ledger canister ID (as Principal text) of the token to withdraw
   * @param amount - The amount to withdraw (in token's smallest unit) - this is what the user will receive
   */
  public func withdraw_stake(
    verifier : Principal,
    token_id : Types.TokenId,
    amount : Types.Balance,
    available_balances : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>,
    canister_principal : Principal,
  ) : async Result.Result<(), Text> {

    Debug.print("Withdrawing stake: Ledger=" # token_id # " Verifier=" # Principal.toText(verifier) # " Amount=" # Nat.toText(amount));

    // Get the token's fee
    let ledger : ICRC2.Service = actor (token_id);
    let fee = await ledger.icrc1_fee();

    // Check available balance - must cover amount + fee
    let current_balance = Account.get_balance(available_balances, verifier, token_id);
    let total_required = amount + fee;

    if (current_balance < total_required) {
      return #err("Insufficient available balance. You need " # Nat.toText(total_required) # " (amount + fee) but have " # Nat.toText(current_balance));
    };

    // Transfer tokens from this canister to verifier
    let transfer_args : ICRC2.TransferArgs = {
      to = { owner = verifier; subaccount = null };
      amount = amount;
      fee = null;
      memo = null;
      from_subaccount = null;
      created_at_time = null;
    };

    let transfer_result = await ledger.icrc1_transfer(transfer_args);

    switch (transfer_result) {
      case (#Ok(_)) {
        // Update available balance - deduct amount + fee
        Account.set_balance(available_balances, verifier, token_id, current_balance - total_required);
        return #ok(());
      };
      case (#Err(err)) {
        return #err("Token transfer failed: " # debug_show (err));
      };
    };
  };
};
