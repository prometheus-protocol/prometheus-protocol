import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';
import { Command } from 'commander';
import { registerClaimBountyCommand } from '../src/commands/claim-bounty.js';
import { Principal } from '@dfinity/principal';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('claim-bounty command', () => {
  let program: Command;
  // This is the real sha256 hash of the string "mock wasm content"
  const EXPECTED_WASM_ID =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    program = new Command();
    registerClaimBountyCommand(program);
    vi.clearAllMocks();

    // Set up default "happy path" mocks for all dependencies
    vi.mocked(api.claimBounty).mockResolvedValue(123n); // Return a mock claim ID
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({
      getPrincipal: () => Principal.fromText('aaaaa-aa'),
    } as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue(
      'test-auditor',
    );
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          submission: { wasm_path: './test.wasm' },
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      return '';
    });
  });

  const commandArgs = ['claim-bounty', '--bounty-id', '1'];

  it('should calculate wasm_id, load identity, and call the API with correct arguments', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(commandArgs, { from: 'user' });

    // 1. Assert the on-chain API was called
    expect(api.claimBounty).toHaveBeenCalledOnce();

    // 2. Inspect the arguments passed to the API
    const [_, callArgs] = vi.mocked(api.claimBounty).mock.calls[0];
    expect(callArgs.bounty_id).toBe(1n);
    expect(callArgs.wasm_id).toBe(EXPECTED_WASM_ID);

    // 3. Assert the success message was logged to the user
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Your claim has been submitted with Claim ID: 123',
      ),
    );

    consoleLogSpy.mockRestore();
  });

  it('should fail if prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(commandArgs, { from: 'user' });

    // Assert
    expect(api.claimBounty).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should log an error if the claimBounty API call fails', async () => {
    // Arrange
    const apiError = new Error('The bounty is already claimed');
    vi.mocked(api.claimBounty).mockRejectedValue(apiError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(commandArgs, { from: 'user' });

    // Assert
    expect(api.claimBounty).toHaveBeenCalledOnce(); // It should still be called
    expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Operation failed:');
    expect(consoleErrorSpy).toHaveBeenCalledWith(apiError);
    consoleErrorSpy.mockRestore();
  });
});
