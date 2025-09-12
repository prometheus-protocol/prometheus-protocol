import { describe, it, expect, vi, beforeEach } from 'vitest';
import prompts from 'prompts';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { Command } from 'commander';
import { registerBountyCommands } from '../../src/commands/bounty/bounty.commands.js';
import { Principal } from '@dfinity/principal';

// Mock all external dependencies
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js');

describe('bounty create command', () => {
  let program: Command;
  const MOCK_REGISTRY_CANISTER_ID = 'r7inp-6aaaa-aaaaa-aaabq-cai';
  const MOCK_WASM_ID =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  const MOCK_USDC_TOKEN: api.Token = {
    canisterId: Principal.fromText('mxzaz-hqaaa-aaaar-qaada-cai'),
    symbol: 'USDC',
    decimals: 6,
    toAtomic: (amount: string | number) => BigInt(Number(amount) * 10 ** 6),
    fromAtomic: function (atomicAmount: bigint): string {
      throw new Error('Function not implemented.');
    },
    name: '',
    fee: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    program = new Command();
    registerBountyCommands(program);

    // 1. THE CORE FIX: Mock the entire Tokens object so Object.values() works.
    vi.mocked(api, true).Tokens = {
      USDC: MOCK_USDC_TOKEN as any,
    };

    // 2. Add the missing mock for the identity name.
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue(
      'test-identity',
    );

    vi.mocked(api.getCanisterId).mockReturnValue(MOCK_REGISTRY_CANISTER_ID);
    vi.mocked(prompts).mockResolvedValue({ confirmed: true });
    vi.mocked(api.approveAllowance).mockResolvedValue(0n);
    vi.mocked(api.createBounty).mockResolvedValue(1n);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  const cliArgs = [
    'bounty',
    'create',
    '10.5',
    'USDC',
    '--audit-type',
    'security_v1',
    '--wasm-id',
    MOCK_WASM_ID,
  ];

  it('should prompt, approve, create bounty, and log success on the happy path', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(cliArgs, { from: 'user' });

    // All these assertions will now pass because the token lookup succeeds.
    expect(prompts).toHaveBeenCalledOnce();
    expect(api.approveAllowance).toHaveBeenCalledOnce();
    expect(api.createBounty).toHaveBeenCalledOnce();

    const approveArgs = vi.mocked(api.approveAllowance).mock.calls[0];
    expect(approveArgs[1]).toEqual(MOCK_USDC_TOKEN);
    expect(approveArgs[3]).toBe('10.5');

    const createArgs = vi.mocked(api.createBounty).mock.calls[0][1];
    expect(createArgs.wasm_id).toBe(MOCK_WASM_ID);
    expect(createArgs.audit_type).toBe('security_v1');
    expect(createArgs.amount).toBe(10500000n);
    expect(createArgs.token).toEqual(MOCK_USDC_TOKEN);

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

  it('should fail if the provided --wasm-id is not a valid hex hash', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const invalidCliArgs = [
      'bounty',
      'create',
      '10',
      'USDC', // Use a VALID symbol
      '--audit-type',
      'security_v1',
      '--wasm-id',
      'not-a-valid-hash', // Invalid wasm-id
    ];

    await program.parseAsync(invalidCliArgs, { from: 'user' });

    expect(api.approveAllowance).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('must be a 64-character hex string'),
    );
    consoleErrorSpy.mockRestore();
  });

  // 5. Add a new test for the invalid token symbol case
  it('should fail if the provided token symbol is invalid', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const invalidCliArgs = [
      'bounty',
      'create',
      '10',
      'INVALID_TOKEN', // Invalid symbol
      '--audit-type',
      'security_v1',
      '--wasm-id',
      MOCK_WASM_ID,
    ];

    await program.parseAsync(invalidCliArgs, { from: 'user' });

    expect(api.approveAllowance).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid token symbol "INVALID_TOKEN"'),
    );
    consoleErrorSpy.mockRestore();
  });
});
