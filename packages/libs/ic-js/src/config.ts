interface CanisterConfig {
  [canisterName: string]: string; // e.g., { AUTH_SERVER: "aaaa-..." }
}

// Internal state for the package. Not exported.
let _canisterIds: CanisterConfig = {};
let _isConfigured = false;

/**
 * Initializes the ic-js package with the necessary canister IDs.
 * This MUST be called once at the startup of any consuming application (CLI or frontend).
 * @param config An object mapping canister names (e.g., 'AUTH_SERVER') to their IDs.
 */
export function configure(config: {
  canisterIds: CanisterConfig;
  verbose?: boolean;
}): void {
  if (_isConfigured) {
    // Optional: prevent re-configuration if it's not desired.
    console.warn('ic-js package has already been configured.');
    return;
  }
  _canisterIds = config.canisterIds;
  _isConfigured = true;
  if (config.verbose)
    console.log('[ic-js] Configured with canister IDs:', _canisterIds);
}

/**
 * A type-safe helper to get a canister ID.
 * Reads from the internal, configured state.
 * @param name The short name of the canister (e.g., 'AUTH_SERVER')
 * @returns The canister ID principal string.
 */
export const getCanisterId = (name: string): string => {
  if (!_isConfigured) {
    throw new Error(
      'The @prometheus-protocol/ic-js package has not been configured. Please call the configure() function at application startup.',
    );
  }

  const canisterId = _canisterIds[name.toUpperCase()];

  if (!canisterId) {
    console.error(
      'Available canister names in config:',
      Object.keys(_canisterIds),
    );
    throw new Error(
      `Configuration does not contain a canister ID for '${name}'.`,
    );
  }

  return canisterId;
};
