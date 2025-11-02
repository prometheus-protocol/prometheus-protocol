// src/lib/apikey.api.ts

import { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { getMcpServerActor } from '../actors.js';
import { McpServer } from '@prometheus-protocol/declarations';

/**
 * This module provides functions for the self-service management of API keys
 * on any MCP-compliant server.
 *
 * PHILOSOPHY:
 * - Functions take an `identity` and the `serverPrincipal` of the target MCP server.
 */

// --- API Key Management Functions ---

/**
 * Creates a new API key for the current user on a specific MCP server.
 * @param name A user-provided friendly name for the key.
 * @returns An object containing the raw, unhashed API key. This is the only time
 *          the key will be visible.
 */
export const createMyApiKey = async (
  identity: Identity,
  serverPrincipal: Principal,
  name: string,
): Promise<{ raw_key: string }> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);

  // The Motoko backend function takes scopes, but for now, we pass an empty array.
  const raw_key = await mcpActor.create_my_api_key(name, []);

  // Wrap in an object for a clearer return signature.
  return { raw_key };
};

/**
 * Fetches the metadata for all API keys owned by the current user on a specific MCP server.
 * @returns An array of API key metadata objects.
 */
export const listMyApiKeys = async (
  identity: Identity,
  serverPrincipal: Principal,
): Promise<McpServer.ApiKeyMetadata[]> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);
  const keys = await mcpActor.list_my_api_keys();
  return keys;
};

/**
 * Revokes one of the current user's API keys.
 * @param hashedKey The hashed key string to revoke.
 */
export const revokeMyApiKey = async (
  identity: Identity,
  serverPrincipal: Principal,
  hashedKey: string,
): Promise<void> => {
  const mcpActor = getMcpServerActor(serverPrincipal, identity);

  // This is an update call that returns void. The await will throw if it fails.
  await mcpActor.revoke_my_api_key(hashedKey);
};
