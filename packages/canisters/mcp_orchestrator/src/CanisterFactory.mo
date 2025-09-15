// src/mcp/CanisterFactory.mo

import Principal "mo:base/Principal";
import Result "mo:base/Result";
import ExperimentalCycles "mo:base/ExperimentalCycles";
import { ic } "mo:ic";
import IC "mo:ic";
import Error "mo:base/Error";

/**
 * =======================================================================================
 * Canister Factory Module
 * =======================================================================================
 *
 * This module provides the core, stateless logic for creating new canisters.
 * It is designed to be imported and used by a stateful actor (like the MCP Orchestrator)
 * that manages its own cycle balance and configuration.
 *
 * The calling actor is responsible for:
 * - Checking for authorization.
 * - Managing its own cycle balance.
 * - Providing the necessary context (like its own Principal).
 */
module {

  /**
   * Creates a new, empty canister with a secure controller configuration.
   *
   * @param caller The Principal of the developer requesting the canister. This will be
   *               set as the first controller.
   * @param self The Principal of the calling actor (the Orchestrator). This will be
   *             set as the second controller.
   * @param provision_cycles The number of cycles to transfer to the new canister upon
   *                         creation.
   * @returns A Result containing the Principal of the new canister or an error message.
   */
  public func provision_canister<system>(
    self : Principal,
    provision_cycles : Nat,
  ) : async Result.Result<Principal, Text> {

    // --- 1. Pre-condition Check ---
    // The calling actor should ensure it has enough cycles before calling this.
    // This check provides a safe fallback.
    if (ExperimentalCycles.balance() < provision_cycles) {
      return #err("Insufficient funds: The factory does not have enough cycles to provision a new canister.");
    };

    // --- 2. Core Logic ---

    // Define the settings for the new canister. The controllers are the developer
    // and the Orchestrator itself.
    let new_canister_settings : IC.CreateCanisterArgs = {
      sender_canister_version = null;
      settings = ?{
        compute_allocation = null;
        controllers = ?[self];
        freezing_threshold = null;
        log_visibility = null;
        memory_allocation = null;
        reserved_cycles_limit = null;
        wasm_memory_limit = null;
        wasm_memory_threshold = null;
      };
    };

    try {

      // Create the new canister.
      let result = await (with cycles = provision_cycles) ic.create_canister(new_canister_settings);

      // --- 3. Return Result ---
      return #ok(result.canister_id);
    } catch (e) {
      return #err("Canister creation failed: " # Error.message(e));
    };
  };
};
