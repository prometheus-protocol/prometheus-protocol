import { Identity } from '@dfinity/agent';
import { getAuthActor } from '../actors.js';
import { Principal } from '@dfinity/principal';
import { Auth } from '@prometheus-protocol/declarations';

export type { Auth };

// --- API Functions ---

/**
 * Called after a user logs in to check the required scopes and determine the next step.
 */
export const confirmLogin = async (
  identity: Identity,
  sessionId: string,
): Promise<Auth.LoginConfirmation> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.confirm_login(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Fetches information about the current session, including the resource server principal.
 */
export const getSessionInfo = async (
  identity: Identity,
  sessionId: string,
): Promise<Auth.SessionInfo> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.get_session_info(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Called when the user clicks "Allow" on the consent screen.
 * This finalizes the authorization flow and generates the authorization code.
 * @returns The final redirect URL to send the user back to the client application.
 */
export const completeAuthorize = async (
  identity: Identity,
  sessionId: string,
): Promise<string> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.complete_authorize(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Called when the user clicks "Deny" on the consent screen.
 * This cancels the authorization flow and cleans up the session on the backend.
 * @returns The final redirect URL (with error params) to send the user back to the client.
 */
export const denyConsent = async (
  identity: Identity,
  sessionId: string,
): Promise<string> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.deny_consent(sessionId);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * A utility function to get the principal of the OAuth backend canister itself.
 * This is no longer needed by the payment API but can be useful for debugging.
 */
export const getOwnPrincipal = (identity: Identity): Principal => {
  return identity.getPrincipal();
};

export const listMyResourceServers = async (
  identity: Identity,
): Promise<Auth.ResourceServer[]> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.list_my_resource_servers();

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Deletes a resource server owned by the current user's identity.
 * @param serverId The unique ID of the resource server to delete.
 */
export const deleteResourceServer = async (
  identity: Identity,
  serverId: string,
): Promise<Auth.Result> => {
  const authActor = getAuthActor(identity);
  // The result of this call is either { ok: string } or { err: string },
  // which matches the Auth.Result type.
  return await authActor.delete_resource_server(serverId);
};

/**
 * Registers a new resource server with the Prometheus auth server.
 * @param identity The identity of the user registering the server.
 * @param args The details of the server to register.
 */
export const registerResourceServer = async (
  identity: Identity,
  args: Auth.RegisterResourceServerArgs,
): Promise<Auth.ResourceServer> => {
  const authActor = getAuthActor(identity);
  const result = await authActor.register_resource_server(args);

  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};

/**
 * Updates an existing resource server with new details.
 * @param identity The identity of the user updating the server.
 * @param args The details to update.
 */
export const updateResourceServer = async (
  identity: Identity,
  args: Auth.UpdateResourceServerArgs,
): Promise<string> => {
  const authActor = getAuthActor(identity);

  const result = await authActor.update_resource_server(args);
  if ('err' in result) {
    throw new Error(result.err);
  }
  return result.ok;
};
