import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import prompts from 'prompts';

// --- 1. Import the command and the mocked library ---
import { registerRegisterCommand } from '../src/commands/register.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';

// --- 2. Mock the external dependencies ---
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('register command', () => {
  let program: Command;

  // --- 3. Prepare mock data ---
  const mockIdentity = {} as any;
  const mockCanisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
  const mockSuccessResponse = {
    resource_server_id: 'test-rs-id',
    client_id: 'test-client-id',
  };

  beforeEach(() => {
    program = new Command();
    registerRegisterCommand(program);
    vi.clearAllMocks();

    // --- 4. Set up default mock implementations ---
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue(mockIdentity);
    vi.mocked(api.registerResourceServer).mockResolvedValue(
      mockSuccessResponse as any,
    );
  });

  it('should register a canister for production with charging enabled', async () => {
    // ARRANGE: Simulate user input for a full production registration
    vi.mocked(prompts)
      // First prompt: main details
      .mockResolvedValueOnce({
        name: 'My Prod Canister',
        logo: 'https://logo.url/prod.png',
        willCharge: true,
        tokens: 'cngnf-vqaaa-aaaar-qag4q-cai',
      })
      // Second prompt: canister ID
      .mockResolvedValueOnce({ id: mockCanisterId })
      // Third prompt: environment (production)
      .mockResolvedValueOnce({ isLocalDev: false });

    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // ACT
    await program.parseAsync(['register'], { from: 'user' });

    // ASSERT
    expect(api.registerResourceServer).toHaveBeenCalledOnce();
    const [identity, args] = vi.mocked(api.registerResourceServer).mock
      .calls[0];
    expect(identity).toBe(mockIdentity);
    expect(args.name).toBe('My Prod Canister');
    expect(args.uris[0]).toBe(`https://${mockCanisterId}.icp0.io`);
    expect(args.accepted_payment_canisters).toHaveLength(1);
    consoleTableSpy.mockRestore();
  });

  it('should register a canister for local dev with charging disabled', async () => {
    // ARRANGE: Simulate user input for a local, free canister
    vi.mocked(prompts)
      .mockResolvedValueOnce({
        name: 'My Local Canister',
        logo: 'https://logo.url/local.png',
        willCharge: false, // Charging is disabled
        // `tokens` will not be prompted for, so it's not in the response
      })
      .mockResolvedValueOnce({ id: mockCanisterId })
      .mockResolvedValueOnce({ isLocalDev: true }); // Local dev

    // ACT
    await program.parseAsync(['register'], { from: 'user' });

    // ASSERT
    expect(api.registerResourceServer).toHaveBeenCalledOnce();
    const [, args] = vi.mocked(api.registerResourceServer).mock.calls[0];
    expect(args.name).toBe('My Local Canister');
    expect(args.uris[0]).toBe(
      `http://127.0.0.1:4943/?canisterId=${mockCanisterId}`,
    );
    // Most important: `prometheus:charge` scope should NOT be present
    expect(args.scopes.map((s) => s[0])).not.toContain('prometheus:charge');
    expect(args.accepted_payment_canisters).toHaveLength(0);
  });

  it('should re-prompt for canister ID if the first one is invalid', async () => {
    // ARRANGE: Simulate user entering a bad ID, then a good one
    vi.mocked(prompts)
      .mockResolvedValueOnce({
        name: 'Test Canister',
        logo: 'logo.png',
        willCharge: false,
      })
      .mockResolvedValueOnce({ id: 'not-a-valid-id' }) // First, invalid attempt
      .mockResolvedValueOnce({ id: mockCanisterId }) // Second, valid attempt
      .mockResolvedValueOnce({ isLocalDev: true });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // ACT
    await program.parseAsync(['register'], { from: 'user' });

    // ASSERT
    // `prompts` was called 4 times instead of 3
    expect(prompts).toHaveBeenCalledTimes(4);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid Canister ID format'),
    );
    expect(api.registerResourceServer).toHaveBeenCalledOnce(); // Still succeeds in the end

    consoleErrorSpy.mockRestore();
  });

  it('should display an error message if the API call fails', async () => {
    // ARRANGE
    const errorMessage = 'Registration rejected by the server';
    vi.mocked(api.registerResourceServer).mockRejectedValue(
      new Error(errorMessage),
    );
    vi.mocked(prompts)
      .mockResolvedValueOnce({
        name: 'Fail Canister',
        logo: 'logo.png',
        willCharge: false,
      })
      .mockResolvedValueOnce({ id: mockCanisterId })
      .mockResolvedValueOnce({ isLocalDev: true });

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // ACT
    await program.parseAsync(['register'], { from: 'user' });

    // ASSERT
    expect(api.registerResourceServer).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(errorMessage),
    );
  });
});
