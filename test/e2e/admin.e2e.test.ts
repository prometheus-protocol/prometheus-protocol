import { describe, test, expect, beforeAll } from 'vitest';
import { HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { createActor } from '../../src/declarations/oauth_backend';
import { _SERVICE as BackendService } from '../../src/declarations/oauth_backend/oauth_backend.did';
import canisterIds from '../../.dfx/local/canister_ids.json';

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.oauth_backend.local);
const replicaUrl = `http://127.0.0.1:4943`;

// --- State Variables ---
let developerIdentity: Identity;
let backendActor: BackendService;

// --- Helper Functions ---
const createActorFor = (identity: Identity) => {
  const agent = new HttpAgent({
    host: replicaUrl,
    identity,
  });
  return createActor(backendCanisterId, { agent });
};

// --- Test Suite ---
describe('Admin and Registration', () => {
  beforeAll(async () => {
    // Create a test identity for the "developer" who registers resource servers
    developerIdentity = Secp256k1KeyIdentity.generate();
    backendActor = createActorFor(developerIdentity);
  });

  describe('Dynamic Client Registration (DCR)', () => {
    test('should allow a client to dynamically register', async () => {
      // Arrange & Act
      const registerResponse = await fetch(
        `${replicaUrl}/register?canisterId=${backendCanisterId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: 'E2E Test App',
            redirect_uris: ['https://jwt.io'],
          }),
        },
      );

      // Assert
      expect(registerResponse.status).toBe(201);
      const dcrResponse = await registerResponse.json();
      expect(dcrResponse.client_id).toBeDefined();
      expect(dcrResponse.client_secret).toBeDefined();
    });

    test('should reject client registration with an empty redirect_uris array', async () => {
      // Arrange & Act
      const registerResponse = await fetch(
        `${replicaUrl}/register?canisterId=${backendCanisterId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: 'Empty URI App',
            redirect_uris: [], // Invalid empty array
          }),
        },
      );

      // Assert
      expect(registerResponse.status).toBe(400);
      const errorJson = await registerResponse.json();
      expect(errorJson.error).toBe('invalid_redirect_uri');
    });
  });

  describe('Resource Server Management', () => {
    test('should allow a developer to register a resource server', async () => {
      // Arrange & Act
      const activateResponse = await backendActor.register_resource_server({
        initial_service_principal: developerIdentity.getPrincipal(),
        name: 'E2E Test Resource Server',
        uris: ['https://some-oauth-resource-server.com'],
        payout_principal: developerIdentity.getPrincipal(),
      });

      // Assert
      expect(activateResponse).toHaveProperty('status');
      expect(activateResponse.status).toHaveProperty('active');
      expect(activateResponse.resource_server_id).toBeDefined();
      expect(activateResponse.owner.toText()).toBe(
        developerIdentity.getPrincipal().toText(),
      );
      expect(activateResponse.name).toBe('E2E Test Resource Server');
      expect(activateResponse.uris).toContain(
        'https://some-oauth-resource-server.com',
      );
      expect(activateResponse.service_principals[0].toText()).toBe(
        developerIdentity.getPrincipal().toText(),
      );
      expect(activateResponse.payout_principal.toText()).toBe(
        developerIdentity.getPrincipal().toText(),
      );
    });
  });
});
