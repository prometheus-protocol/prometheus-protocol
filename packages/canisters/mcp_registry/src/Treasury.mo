import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import ICRC2 "mo:icrc2-types";

module {
  public type TreasuryError = {
    #NotOwner;
    #TransferFailed : ICRC2.TransferError;
    #LedgerTrap : Text; // For when the ledger canister itself fails
  };

  /// Withdraws a specified amount of an ICRC-2 token to a destination account.
  /// Only the current owner can call this function.
  public func withdraw(
    caller : Principal,
    owner : Principal,
    ledger_id : Principal,
    amount : Nat,
    destination : ICRC2.Account,
  ) : async Result.Result<Nat, TreasuryError> {
    // SECURITY: This is the most important check.
    if (caller != owner) {
      return #err(#NotOwner);
    };

    let ledger : ICRC2.Service = actor (Principal.toText(ledger_id));

    try {
      let transferResult = await ledger.icrc1_transfer({
        from_subaccount = null; // Withdraw from the canister's default account
        to = destination;
        amount = amount;
        fee = null;
        memo = null;
        created_at_time = null;
      });

      switch (transferResult) {
        case (#Ok(blockIndex)) {
          return #ok(blockIndex);
        };
        case (#Err(err)) {
          // The transfer was rejected by the ledger (e.g., insufficient funds)
          return #err(#TransferFailed(err));
        };
      };
    } catch (e) {
      // The ledger canister itself trapped (e.g., out of cycles, uninstalled)
      let err_msg = Error.message(e);
      Debug.print("FATAL: Withdrawal failed, ledger trapped: " # err_msg);
      return #err(#LedgerTrap(err_msg));
    };
  };
};
