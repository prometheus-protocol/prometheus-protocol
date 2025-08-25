import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import prompts from 'prompts';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerBountyCommands } from '../../src/commands/bounty/bounty.commands.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('bounty create command', () => {
  let program: Command;
  const MOCK_REGISTRY_CANISTER_ID = 'r7inp-6aaaa-aaaaa-aaabq-cai';
  const MOCK_TOKEN_CANISTER_ID = 'mxzaz-hqaaa-aaaar-qaada-cai';

  beforeEach(() => {
    vi.clearAllMocks();

    program = new Command();
    // 2. Register the entire 'bounty' command group
    registerBountyCommands(program);

    process.env.REGISTRY_CANISTER_ID = MOCK_REGISTRY_CANISTER_ID;

    // Provide default successful implementations for all mocks
    vi.mocked(prompts).mockResolvedValue({ confirmed: true });
    vi.mocked(api.approveAllowance).mockResolvedValue(0n);
    vi.mocked(api.createBounty).mockResolvedValue(1n); // Return bounty ID 1
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);

    // Mock filesystem to provide the manifest and wasm
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: { wasm_path: './test.wasm' } });
      }
      return Buffer.from('mock wasm content');
    });
  });

  // 3. Define the new command arguments using positional args
  const cliArgs = [
    'bounty',
    'create',
    '100_000_000', // amount (positional)
    MOCK_TOKEN_CANISTER_ID, // token-canister (positional)
    '--audit-type',
    'security',
  ];

  it('should prompt, approve, create bounty, and log success on the happy path', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(cliArgs, { from: 'user' });

    // 1. Check that the user was prompted for confirmation
    expect(prompts).toHaveBeenCalledOnce();

    // 2. Check that approveAllowance was called with the correct arguments
    expect(api.approveAllowance).toHaveBeenCalledOnce();
    const approveArgs = vi.mocked(api.approveAllowance).mock.calls[0];
    expect(approveArgs[1]).toBe(100000000); // Amount
    expect(approveArgs[2].toText()).toBe(MOCK_REGISTRY_CANISTER_ID); // Spender
    expect(approveArgs[3].toText()).toBe(MOCK_TOKEN_CANISTER_ID); // Token Canister

    // 3. Check that createBounty was called with the correct arguments
    expect(api.createBounty).toHaveBeenCalledOnce();
    const createArgs = vi.mocked(api.createBounty).mock.calls[0][1];
    expect(Buffer.from(createArgs.wasm_hash).toString('hex')).toBe(
      '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47', // sha256 of "mock wasm content"
    );
    expect(createArgs.audit_type).toBe('security');
    expect(createArgs.amount).toBe(100000000n);

    // 4. Check for the final success message
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
    expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Operation failed:');
    expect(consoleErrorSpy).toHaveBeenCalledWith(approvalError);

    consoleErrorSpy.mockRestore();
  });

  it('should fail if prometheus.yml is not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.approveAllowance).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found'),
    );
    consoleErrorSpy.mockRestore();
  });
});
