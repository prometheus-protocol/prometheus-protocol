import { describe, it, expect, vi, beforeEach } from 'vitest';
import prompts from 'prompts';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { Command } from 'commander';
import { registerBountyCommands } from '../../src/commands/bounty/bounty.commands.js';

// Mock all external dependencies
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js');

describe('bounty create command', () => {
  let program: Command;
  const MOCK_REGISTRY_CANISTER_ID = 'r7inp-6aaaa-aaaaa-aaabq-cai';
  const MOCK_TOKEN_CANISTER_ID = 'mxzaz-hqaaa-aaaar-qaada-cai';
  // 1. Define a valid mock WASM ID (SHA-256 hash) for the new option.
  const MOCK_WASM_ID =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    vi.clearAllMocks();

    program = new Command();
    registerBountyCommands(program);

    // Mock getCanisterId to return our test ID
    vi.mocked(api.getCanisterId).mockReturnValue(MOCK_REGISTRY_CANISTER_ID);

    // Provide default successful implementations for all mocks
    vi.mocked(prompts).mockResolvedValue({ confirmed: true });
    vi.mocked(api.approveAllowance).mockResolvedValue(0n);
    vi.mocked(api.createBounty).mockResolvedValue(1n); // Return bounty ID 1
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // 2. Define the new command arguments, including the required --wasm-id option.
  const cliArgs = [
    'bounty',
    'create',
    '100_000_000',
    MOCK_TOKEN_CANISTER_ID,
    '--audit-type',
    'security_v1',
    '--wasm-id',
    MOCK_WASM_ID,
  ];

  it('should prompt, approve, create bounty, and log success on the happy path', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(prompts).toHaveBeenCalledOnce();
    expect(api.approveAllowance).toHaveBeenCalledOnce();
    expect(api.createBounty).toHaveBeenCalledOnce();

    // 3. Verify the wasm_hash passed to the API is the correct Buffer from the hex string.
    const createArgs = vi.mocked(api.createBounty).mock.calls[0][1];
    expect(Buffer.from(createArgs.wasm_hash).toString('hex')).toBe(
      MOCK_WASM_ID,
    );
    expect(createArgs.audit_type).toBe('security_v1');
    expect(createArgs.amount).toBe(100000000n);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bounty with ID 1 is now active'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should exit gracefully if the user does not confirm', async () => {
    vi.mocked(prompts).mockResolvedValue({ confirmed: false });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.approveAllowance).not.toHaveBeenCalled();
    expect(api.createBounty).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bounty creation cancelled'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should log an error if the approveAllowance call fails', async () => {
    const approvalError = new Error('Insufficient funds for approval');
    vi.mocked(api.approveAllowance).mockRejectedValue(approvalError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.approveAllowance).toHaveBeenCalledOnce();
    expect(api.createBounty).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '\n❌ Operation failed:',
      approvalError,
    );

    consoleErrorSpy.mockRestore();
  });

  // 4. Add a new test to validate the input hash format.
  it('should fail if the provided --wasm-id is not a valid hex hash', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const invalidCliArgs = [
      'bounty',
      'create',
      '1000',
      MOCK_TOKEN_CANISTER_ID,
      '--audit-type',
      'security_v1',
      '--wasm-id',
      'not-a-valid-hash', // Invalid input
    ];

    await program.parseAsync(invalidCliArgs, { from: 'user' });

    expect(api.approveAllowance).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be a 64-character hex string'),
    );
    consoleErrorSpy.mockRestore();
  });
});
