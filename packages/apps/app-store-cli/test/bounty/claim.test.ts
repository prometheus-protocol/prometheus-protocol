import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { Command } from 'commander';
import { registerBountyCommands } from '../../src/commands/bounty/bounty.commands.js';
import { Principal } from '@icp-sdk/core/principal';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('bounty claim command', () => {
  let program: Command;
  // This is the real sha256 hash of the string "mock wasm content"
  const MOCK_WASM_ID =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a fresh commander instance for each test
    program = new Command();
    registerBountyCommands(program); // Register the entire 'bounty' group

    // Set up default "happy path" mocks
    vi.mocked(api.claimBounty).mockResolvedValue(123n); // Return a mock claim ID
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({
      getPrincipal: () => Principal.fromText('aaaaa-aa'),
    } as any);
  });

  // Test Case 1: Auditor with code (reads from prometheus.yml)
  it('should claim a bounty using the WASM ID from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: { wasm_path: './test.wasm' } });
      }
      return Buffer.from('mock wasm content');
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: Use the new positional argument structure
    const cliArgs = ['bounty', 'claim', '1'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.claimBounty).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.claimBounty).mock.calls[0];
    expect(callArgs.bounty_id).toBe(1n);
    expect(callArgs.wasm_id).toBe(MOCK_WASM_ID); // Calculated from the mocked file
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Your claim has been submitted with Claim ID: 123',
      ),
    );

    consoleLogSpy.mockRestore();
  });

  // Test Case 2: Auditor without code (provides WASM ID explicitly)
  it('should claim a bounty using an explicitly provided WASM ID', async () => {
    // Arrange
    const explicitWasmId = 'explicit-wasm-id-abcdef123';
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: Provide both bountyId and wasmId as arguments
    const cliArgs = ['bounty', 'claim', '2', explicitWasmId];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.claimBounty).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.claimBounty).mock.calls[0];
    expect(callArgs.bounty_id).toBe(2n);

    expect(callArgs.wasm_id).toBe(explicitWasmId); // Should use the explicit ID

    // Crucially, it should NOT have tried to read any files
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  // Test Case 3: Failure workflow (no context)
  it('should fail gracefully if no WASM ID is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['bounty', 'claim', '3'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.claimBounty).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'WASM ID not provided and prometheus.yml not found',
      ),
    );

    consoleErrorSpy.mockRestore();
  });

  // Test Case 4: API Failure
  it('should log an error if the claimBounty API call fails', async () => {
    // Arrange
    const apiError = new Error('The bounty is already claimed');
    vi.mocked(api.claimBounty).mockRejectedValue(apiError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act (using the explicit path is simpler as it requires fewer mocks)
    const cliArgs = ['bounty', 'claim', '4', 'some-wasm-id'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.claimBounty).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Operation failed:');
    expect(consoleErrorSpy).toHaveBeenCalledWith(apiError);

    consoleErrorSpy.mockRestore();
  });
});
