import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { createActor } from '@declarations/auth';
import {
  _SERVICE as BackendService,
  ResourceServer,
} from '@declarations/auth/auth.did';
import canisterIds from '../../../../.dfx/local/canister_ids.json';
import { toNullable } from '@dfinity/utils';

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.auth.local);
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

  // --- NEW TEST SUITE FOR RESOURCE SERVER MANAGEMENT ---
  describe('Resource Server Management', () => {
    let resourceServerId: string | undefined;

    // Before each test in this suite, register a new resource server to ensure a clean state.
    beforeEach(async () => {
      const result = await backendActor.register_resource_server({
        name: 'Original Test Server',
        logo_uri: 'original_logo.png',
        uris: ['https://original.uri/api'],
        initial_service_principal: Principal.fromText('aaaaa-aa'),
        scopes: [['read', 'Read access']],
        accepted_payment_canisters: [],
      });

      if ('err' in result) {
        throw new Error(`Failed to register resource server: ${result.err}`);
      }
      resourceServerId = result.ok.resource_server_id;
    });

    afterEach(async () => {
      // This guard prevents errors if the beforeEach hook failed to create the server.
      if (resourceServerId) {
        await backendActor.delete_resource_server(resourceServerId);
        resourceServerId = undefined; // Reset for the next test
      }
    });

    test('should allow the owner to update their resource server', async () => {
      // Arrange: Define the updates. Optional fields are arrays: [value] for Some, [] for None.
      const updates = {
        resource_server_id: resourceServerId!,
        name: toNullable('Updated Test Server'),
        logo_uri: toNullable('updated_logo.png'),
        uris: toNullable(['https://new.uri/api', 'https://another.uri/api']),
        scopes: toNullable([
          ['read', 'Read access updated'],
          ['write', 'Write access added'],
        ] as Array<[string, string]>),
        service_principals: toNullable([Principal.fromText('aaaaa-aa')]),
        accepted_payment_canisters: toNullable([
          Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai'),
        ]),
      };

      // Act: Call the update function
      const updateResult = await backendActor.update_resource_server(updates);

      // Assert: Check that the update call was successful
      expect(updateResult).toHaveProperty('ok');

      if (!('ok' in updateResult)) {
        throw new Error(`Update failed: ${updateResult.err}`);
      }
      expect(updateResult.ok).toBe('Resource server updated successfully.');

      // Assert: Fetch the server using the owner-only query and verify all fields were updated
      const getResult = await backendActor.get_my_resource_server_details(
        resourceServerId!,
      );
      const serverDetails = (getResult as { ok: ResourceServer }).ok;

      expect(serverDetails.name).toBe('Updated Test Server');
      expect(serverDetails.logo_uri).toBe('updated_logo.png');
      expect(serverDetails.uris).toEqual([
        'https://new.uri/api',
        'https://another.uri/api',
      ]);
      expect(serverDetails.scopes).toEqual([
        ['read', 'Read access updated'],
        ['write', 'Write access added'],
      ]);
      expect(serverDetails.service_principals[0].toText()).toBe('aaaaa-aa');
      expect(serverDetails.accepted_payment_canisters[0].toText()).toBe(
        'ryjl3-tyaaa-aaaaa-aaaba-cai',
      );
    });

    test('should prevent a different identity from updating the resource server', async () => {
      // Arrange: Create a new "hacker" identity and an actor for them.
      const hackerIdentity = Secp256k1KeyIdentity.generate();
      const hackerActor = createActorFor(hackerIdentity);

      const updates = {
        resource_server_id: resourceServerId!,
        name: toNullable('Hacked Name'),
        logo_uri: toNullable(''),
        uris: toNullable<string[]>(),
        scopes: toNullable<[string, string][]>(),
        service_principals: toNullable<Principal[]>(),
        accepted_payment_canisters: toNullable<Principal[]>(),
      };

      // Act: Attempt to update the server using the hacker's identity
      const updateResult = await hackerActor.update_resource_server(updates);

      // Assert: The call must fail with an "Unauthorized" error.
      expect(updateResult).toHaveProperty('err');
      expect((updateResult as { err: string }).err).toContain('Unauthorized');
    });

    test('should return an error when updating a non-existent resource server', async () => {
      // Arrange
      const updates = {
        resource_server_id: 'non-existent-id',
        name: toNullable('Ghost Name'),
        logo_uri: toNullable(''),
        uris: toNullable([]),
        scopes: toNullable([]),
        service_principals: toNullable([]),
        accepted_payment_canisters: toNullable([]),
      };

      // Act
      const updateResult = await backendActor.update_resource_server(updates);

      // Assert: The call must fail with a "not found" error.
      expect(updateResult).toHaveProperty('err');
      expect((updateResult as { err: string }).err).toContain(
        'Resource server not found.',
      );
    });
  });
});
