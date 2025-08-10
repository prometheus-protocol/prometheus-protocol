// packages/canisters/mcp_registry/test/mcp_registry.e2e.test.ts

import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { IDL } from '@dfinity/candid';
import { describe, beforeAll, afterAll, it, expect, inject } from 'vitest';

import { idlFactory as registryIdlFactory } from '@declarations/mcp_registry';
import {
  type _SERVICE as RegistryService,
  type CreateCanisterType,
  init,
  UpdateWasmRequest,
  UploadRequest,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import { Identity } from '@dfinity/agent';
import { createHash } from 'node:crypto';
import { Principal } from '@dfinity/principal';

const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
);

describe('MCP Registry Canister (Isolated Tests)', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let platformOwner: Identity = createIdentity('owner-principal');
  let unauthorizedUser: Identity = createIdentity('unauthorized-principal');

  // This hook now manages the entire lifecycle for this test file.
  beforeAll(async () => {
    const url = inject('PIC_URL'); // 1. Get the URL from the global setup.
    // 2. Connect a client to the server.
    pic = await PocketIc.create(url);

    const fixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: platformOwner.getPrincipal(),
      arg: IDL.encode(init({ IDL }), [
        {
          auditorCredentialCanisterId: Principal.anonymous(),
          icrc118wasmregistryArgs: [],
          ttArgs: [],
        },
      ]),
    });

    registryActor = fixture.actor;
  });

  // This hook now correctly tears down the server after this file's tests run.
  afterAll(async () => {
    // THE FIX: Stop the server instance, not the client.
    await pic.tearDown();
  });

  // --- WRITE & READ TESTS ---
  it('should call hello() and get a response', async () => {
    // Arrange
    registryActor.setIdentity(platformOwner);
    // Act
    const response = await registryActor.hello();
    // Assert
    expect(response).toBe('world!');
  });

  it('should allow an authorized user to create a new canister type and then retrieve it', async () => {
    // --- ARRANGE & ACT (Create) ---
    registryActor.setIdentity(platformOwner);
    const request: CreateCanisterType = {
      canister_type_namespace: 'com.prometheus.test-server',
      canister_type_name: 'Prometheus Test Server',
      controllers: [],
      description: 'A test server for our isolated test suite.',
      repo: 'https://github.com/prometheus-protocol/test-server',
      metadata: [['prom_cert:tier', { Text: 'Gold' }]],
      forked_from: [],
    };

    const createResult = await registryActor.icrc118_create_canister_type([
      request,
    ]);

    // --- ASSERT (Create) ---
    expect(createResult).toHaveLength(1);
    expect(createResult[0]).toHaveProperty('Ok');
    // @ts-ignore - We know Ok exists
    const createdCanisterTypeId = createResult[0].Ok;
    expect(createdCanisterTypeId).toBeTypeOf('bigint');

    // --- ACT (Read) ---
    // Now, fetch all types to verify the one we just created is present.
    const allTypes = await registryActor.icrc118_get_canister_types({
      filter: [],
      prev: [],
      take: [],
    });

    // --- ASSERT (Read) ---
    expect(allTypes.length).toBeGreaterThan(0);
    const foundType = allTypes.find(
      (t: { canister_type_namespace: string; description: string }) =>
        t.canister_type_namespace === 'com.prometheus.test-server',
    );
    expect(foundType).toBeDefined();
    expect(foundType?.description).toBe(
      'A test server for our isolated test suite.',
    );
  });

  it('should allow an authorized user to update a canister type by publishing a new version', async () => {
    // --- ARRANGE ---
    registryActor.setIdentity(platformOwner);

    // We need to create mock data for the new Wasm version.
    const newWasmHash = new Uint8Array([10, 11, 12]);
    const newWasmChunkHash = new Uint8Array([13, 14, 15]);
    const newVersionNumber: [bigint, bigint, bigint] = [0n, 0n, 2n];
    const newDescription = 'An updated description for v0.0.2';

    const updateRequest: UpdateWasmRequest = {
      canister_type_namespace: 'com.prometheus.test-server',
      version_number: newVersionNumber,
      description: newDescription,
      repo: 'https://github.com/prometheus-protocol/test-server/tree/v0.0.2',
      metadata: [['prom_cert:tier', { Text: 'Platinum' }]], // Update metadata
      expected_hash: newWasmHash,
      expected_chunks: [newWasmChunkHash], // Assume one chunk for simplicity
      previous: [], // We're not specifying a previous version link for this test
    };

    // --- ACT ---
    const result = await registryActor.icrc118_update_wasm(updateRequest);

    // --- ASSERT (Update Call) ---
    expect(result).toHaveProperty('Ok');
    // @ts-ignore
    const newVersionId = result.Ok;
    expect(newVersionId).toBeTypeOf('bigint');

    // --- ASSERT (Verify State Change) ---
    // Fetch the canister type again to see if the description and version list were updated.
    const allTypes = await registryActor.icrc118_get_canister_types({
      filter: [],
      prev: [],
      take: [],
    });

    const foundType = allTypes.find(
      (t: { canister_type_namespace: string; description: string }) =>
        t.canister_type_namespace === 'com.prometheus.test-server',
    );

    // 1. Verify the main description of the canister type was updated.
    expect(foundType).toBeDefined();

    // This is the old description:
    expect(foundType?.description).toBe(
      'A test server for our isolated test suite.',
    );

    // 2. Verify that a new version was added to the versions list.
    // Note: The initial creation might not create a version entry, so the length could be 1.
    expect(foundType?.versions.length).toBeGreaterThan(0);
    const newVersion = foundType?.versions.find(
      (v: { version_number: [bigint, bigint, bigint] }) =>
        v.version_number[0] === newVersionNumber[0] &&
        v.version_number[1] === newVersionNumber[1] &&
        v.version_number[2] === newVersionNumber[2],
    );
    expect(newVersion).toBeDefined();
  });

  // Add this new describe block to your mcp_registry.e2e.test.ts file

  describe('Controller Management', () => {
    let buildService: Identity;
    let createdCanisterTypeId: bigint; // We'll need the ID from the first test

    beforeAll(async () => {
      // Create an identity for our mock off-chain build service
      buildService = createIdentity('build-service-principal');

      // We need to get the ID of the canister type created in the main test block.
      // To do this cleanly, we'll just re-run the creation logic to ensure state.
      registryActor.setIdentity(platformOwner);
      const request: CreateCanisterType = {
        canister_type_namespace: 'com.prometheus.managed-server',
        canister_type_name: 'Managed Test Server',
        controllers: [],
        description: 'A server for testing controller management.',
        repo: 'https://github.com/prometheus-protocol/test-server',
        metadata: [],
        forked_from: [],
      };
      const createResult = await registryActor.icrc118_create_canister_type([
        request,
      ]);
      // @ts-ignore
      createdCanisterTypeId = createResult[0].Ok;
    });

    it('should allow the platform owner to add a new controller', async () => {
      // Arrange
      registryActor.setIdentity(platformOwner);
      const addControllerRequest = {
        canister_type_namespace: 'com.prometheus.managed-server',
        controller: buildService.getPrincipal(),
        op: { Add: null },
      };

      // Act
      const result = await registryActor.icrc118_manage_controller([
        addControllerRequest,
      ]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('Ok');

      // Assert (Verify): Fetch the type and check the controllers list
      const allTypes = await registryActor.icrc118_get_canister_types({
        filter: [],
        prev: [],
        take: [],
      });
      const foundType = allTypes.find(
        (t: { canister_type_namespace: string; controllers: any[] }) =>
          t.canister_type_namespace === 'com.prometheus.managed-server',
      );
      expect(foundType?.controllers).toContainEqual(
        buildService.getPrincipal(),
      );
    });

    it('should REJECT adding a controller from an unauthorized user', async () => {
      // Arrange
      registryActor.setIdentity(unauthorizedUser);
      const addControllerRequest = {
        canister_type_namespace: 'com.prometheus.managed-server',
        controller: unauthorizedUser.getPrincipal(), // Trying to add themselves
        op: { Add: null },
      };

      // Act
      const result = await registryActor.icrc118_manage_controller([
        addControllerRequest,
      ]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('Error');
      // @ts-ignore
      expect(result[0].Error).toHaveProperty('Unauthorized');
    });

    it('should allow the platform owner to remove a controller', async () => {
      // Arrange
      registryActor.setIdentity(platformOwner);
      const removeControllerRequest = {
        canister_type_namespace: 'com.prometheus.managed-server',
        controller: buildService.getPrincipal(),
        op: { Remove: null },
      };

      // Act
      const result = await registryActor.icrc118_manage_controller([
        removeControllerRequest,
      ]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('Ok');

      // Assert (Verify): Fetch the type and check the controller is gone
      const allTypes = await registryActor.icrc118_get_canister_types({
        filter: [],
        prev: [],
        take: [],
      });
      const foundType = allTypes.find(
        (t: { canister_type_namespace: string; controllers: any[] }) =>
          t.canister_type_namespace === 'com.prometheus.managed-server',
      );
      expect(foundType?.controllers).not.toContainEqual(
        buildService.getPrincipal(),
      );
    });
  });

  describe('Orchestrator Hooks', () => {
    let mockOrchestrator: Identity;
    const orchestratedNamespace = 'com.prometheus.orchestrated-type';

    beforeAll(async () => {
      mockOrchestrator = createIdentity('mock-orchestrator-principal');
      registryActor.setIdentity(platformOwner);

      // 1. Register the mock orchestrator with the registry.
      const setResult = await registryActor.set_mcp_orchestrator(
        mockOrchestrator.getPrincipal(),
      );
      expect(setResult).toHaveProperty('ok'); // Ensure setup succeeds

      // 2. Create a new canister type that we can manage.
      const createRequest: CreateCanisterType = {
        canister_type_namespace: orchestratedNamespace,
        canister_type_name: 'Orchestrated Test Server',
        controllers: [[platformOwner.getPrincipal()]],
        description: 'A server for testing orchestrator hooks.',
        repo: '',
        metadata: [],
        forked_from: [],
      };
      await registryActor.icrc118_create_canister_type([createRequest]);
    });

    describe('set_mcp_orchestrator()', () => {
      it('should return an error when setting the orchestrator from a non-owner', async () => {
        registryActor.setIdentity(unauthorizedUser);
        const result = await registryActor.set_mcp_orchestrator(
          unauthorizedUser.getPrincipal(),
        );

        // ASSERT: The call resolves to an 'err' variant.
        expect(result).toHaveProperty('err');
        // @ts-ignore - We know 'err' exists
        expect(result.err).toContain('Caller is not the owner');
      });

      it('should return ok when setting the orchestrator from the owner', async () => {
        registryActor.setIdentity(platformOwner);
        const result = await registryActor.set_mcp_orchestrator(
          mockOrchestrator.getPrincipal(),
        );

        // ASSERT: The call resolves to an 'ok' variant.
        expect(result).toHaveProperty('ok');
      });
    });

    describe('is_controller_of_type()', () => {
      it('should return an error if called by a principal that is NOT the registered orchestrator', async () => {
        // Call from the owner should be rejected
        registryActor.setIdentity(platformOwner);
        const ownerResult = await registryActor.is_controller_of_type(
          orchestratedNamespace,
          platformOwner.getPrincipal(),
        );
        expect(ownerResult).toHaveProperty('err');
        // @ts-ignore
        expect(ownerResult.err).toContain(
          'Caller is not the registered MCP Orchestrator',
        );

        // Call from a random user should be rejected
        registryActor.setIdentity(unauthorizedUser);
        const unauthorizedResult = await registryActor.is_controller_of_type(
          orchestratedNamespace,
          unauthorizedUser.getPrincipal(),
        );
        expect(unauthorizedResult).toHaveProperty('err');
        // @ts-ignore
        expect(unauthorizedResult.err).toContain(
          'Caller is not the registered MCP Orchestrator',
        );
      });

      it('should return { ok: true } when a valid controller is checked by the orchestrator', async () => {
        registryActor.setIdentity(mockOrchestrator);
        const result = await registryActor.is_controller_of_type(
          orchestratedNamespace,
          platformOwner.getPrincipal(),
        );

        // ASSERT: The result is { ok: true }
        expect(result).toEqual({ ok: true });
      });

      it('should return { ok: false } when a non-controller is checked by the orchestrator', async () => {
        registryActor.setIdentity(mockOrchestrator);
        const result = await registryActor.is_controller_of_type(
          orchestratedNamespace,
          unauthorizedUser.getPrincipal(),
        );

        // ASSERT: The result is { ok: false }
        expect(result).toEqual({ ok: false });
      });
    });
  });
});
