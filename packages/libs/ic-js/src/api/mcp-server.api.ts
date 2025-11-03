// src/lib/mcp-server.api.ts

import { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { getMcpServerActor } from '../actors.js';
import { McpServer } from '@prometheus-protocol/declarations';

/**
 * This module provides functions for interacting with MCP servers,
 * specifically for treasury management operations.
 *
 * PHILOSOPHY:
 * - Functions take an `identity` and the `serverPrincipal` of the target MCP server.
 * - For API key management, use the functions from apikey.api.ts
 */

// --- Treasury Management Functions ---

/**
 * Gets the treasury balance of a specific ICRC-1 token for an MCP server.
 * @param ledgerId The Principal ID of the token ledger canister
 * @returns The balance in atomic units
 */
export const getTreasuryBalance = async (
  identity: Identity,
  serverPrincipal: Principal,
  ledgerId: Principal,
): Promise<bigint> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);
  const balance = await mcpActor.get_treasury_balance(ledgerId);
  return balance;
};

/**
 * Withdraws tokens from the MCP server's treasury to a specified destination.
 * @param ledgerId The Principal ID of the token ledger canister
 * @param amount The amount to withdraw in atomic units
 * @param destination The destination for the withdrawal (Principal or Account)
 * @returns The transaction ID or block index on success
 */
export const withdraw = async (
  identity: Identity,
  serverPrincipal: Principal,
  ledgerId: Principal,
  amount: bigint,
  destination: McpServer.Destination,
): Promise<bigint> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);

  const result = await mcpActor.withdraw(ledgerId, amount, destination);

  if ('err' in result) {
    const error = Object.keys(result.err)[0];
    throw new Error(`Withdraw failed: ${error}`);
  }

  return result.ok;
};

/**
 * Gets the owner of the MCP server canister.
 * @returns The Principal ID of the canister owner
 */
export const getOwner = async (
  identity: Identity,
  serverPrincipal: Principal,
): Promise<Principal> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);
  const owner = await mcpActor.get_owner();
  return owner;
};

/**
 * Sets a new owner for the MCP server canister.
 * Only the current owner can call this function.
 * @param newOwner The Principal ID of the new owner
 */
export const setOwner = async (
  identity: Identity,
  serverPrincipal: Principal,
  newOwner: Principal,
): Promise<void> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);

  const result = await mcpActor.set_owner(newOwner);

  if ('err' in result) {
    const error = Object.keys(result.err)[0];
    throw new Error(`Set owner failed: ${error}`);
  }
};
